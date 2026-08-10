"""Business services: codes, money, reports, cockpit aggregates."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from .models import (
    Carrier,
    Client,
    Deal,
    ExecutionStage,
    Lead,
    PaymentStatus,
)
from .report_sync import (  # noqa: F401 — re-export для API/views/tests
    CONFIRMED_AND_BELOW,
    WON_CONFIRM_GRACE_DAYS,
    archive_previous_months,
    backfill_deals_from_reports,
    current_month_key,
    ensure_deal_won_at,
    ensure_month_rollover,
    get_or_create_month,
    home_month_key_for_deal,
    month_label,
    monthly_profit_total,
    refresh_current_report_rows,
    sync_deal_to_reports,
    sync_report_row_to_deal,
    within_confirm_grace,
)


def next_deal_code():
    year = timezone.localdate().year
    return _next_code(f'AL-{year}-', Deal.objects.all())


def next_lead_code():
    return _next_code('RQ-', Lead.objects.all())


def next_carrier_code():
    return _next_code('TR-', Carrier.objects.all())


def _next_code(prefix, queryset, field='code', width=3):
    max_num = 0
    for code in queryset.values_list(field, flat=True):
        if not code:
            continue
        tail = str(code).rsplit('-', 1)[-1]
        if tail.isdigit():
            max_num = max(max_num, int(tail))
    return f'{prefix}{str(max_num + 1).zfill(width)}'


def to_decimal(value, default=0):
    try:
        if value is None or value == '':
            return Decimal(str(default))
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def apply_deal_money(deal):
    deal.recalc_money()
    ensure_deal_won_at(deal, persist=False)
    deal.save(update_fields=[
        'debt', 'profit', 'payment', 'paid', 'price', 'cost', 'won_at', 'updated_at',
    ])
    sync_client_debt(deal)
    sync_deal_to_reports(deal)
    return deal


def sync_client_debt(deal):
    name = deal.client_name or (deal.client.name if deal.client_id else '')
    if deal.client_id:
        client = deal.client
    elif name:
        client, _ = Client.objects.get_or_create(
            name=name,
            defaults={
                'phone': deal.phone or '',
                'currency': deal.currency,
            },
        )
        if not deal.client_id:
            deal.client = client
            deal.save(update_fields=['client', 'updated_at'])
    else:
        return

    total = (
        Deal.objects.filter(client=client, is_active=True)
        .aggregate(total=Sum('debt'))
        .get('total')
        or 0
    )
    client.debt = total
    if deal.currency:
        client.currency = deal.currency
    if deal.phone and not client.phone:
        client.phone = deal.phone
    client.save(update_fields=['debt', 'currency', 'phone', 'updated_at'])


def fmt_money(n):
    return f'{int(n):,}'.replace(',', ' ')


def attention_deal_count():
    """Угоди, що реально потребують уваги (без подвійного підрахунку)."""
    deals = Deal.objects.filter(is_active=True)
    stuck_before = timezone.now() - timedelta(days=14)
    return deals.filter(
        Q(execution=ExecutionStage.WON)
        | Q(execution=ExecutionStage.CONFIRMED)
        | Q(execution__in=[ExecutionStage.IN_TRANSIT, ExecutionStage.CUSTOMS])
        | Q(execution=ExecutionStage.DELIVERED, debt__gt=0)
        | Q(vin='')
        | Q(image='')
        | Q(execution=ExecutionStage.PICKED, updated_at__lt=stuck_before)
    ).distinct().count()


def attention_subtitle(count=None):
    n = attention_deal_count() if count is None else int(count)
    if n == 0:
        return 'Немає угод, що потребують уваги'
    mod100 = n % 100
    mod10 = n % 10
    if 11 <= mod100 <= 14:
        word = 'угод'
    elif mod10 == 1:
        word = 'угода'
    elif 2 <= mod10 <= 4:
        word = 'угоди'
    else:
        word = 'угод'
    verb = 'потребує' if word == 'угода' else 'потребують'
    return f'{n} {word} {verb} уваги'


def cockpit_stats():
    deals = Deal.objects.filter(is_active=True)
    # До отримання: лише підтверджені+ (виграні ще не наші — боргу немає)
    receivable_qs = deals.filter(execution__in=CONFIRMED_AND_BELOW)
    receivable = receivable_qs.aggregate(s=Sum('debt')).get('s') or 0
    receivable_parts = [
        {
            'amount': float(row['s'] or 0),
            'currency': row['currency'] or 'CHF',
        }
        for row in receivable_qs.values('currency')
        .annotate(s=Sum('debt'))
        .filter(s__gt=0)
        .order_by('currency')
    ]
    # Прибуток поточного місяця — динамічно лише з current month rows
    profit = monthly_profit_total()
    in_transit_money = deals.filter(
        execution=ExecutionStage.IN_TRANSIT
    ).aggregate(s=Sum('price')).get('s') or 0
    cars_transit = deals.filter(
        execution__in=[ExecutionStage.IN_TRANSIT, ExecutionStage.CUSTOMS]
    ).count()
    deals_total = deals.count()

    return [
        {
            'id': 'receivable',
            'label': 'До отримання',
            'value': fmt_money(receivable),
            'raw': float(receivable),
            'currency': 'CHF',
            'parts': receivable_parts,
            'trend': '',
            'up': True,
        },
        {
            'id': 'profit',
            'label': 'Прибуток місяця',
            'value': fmt_money(profit),
            'raw': float(profit),
            'currency': 'CHF',
            'trend': '',
            'up': True,
        },
        {
            'id': 'in_transit_money',
            'label': 'Гроші в дорозі',
            'value': fmt_money(in_transit_money),
            'raw': float(in_transit_money),
            'currency': 'CHF',
            'trend': '',
            'up': False,
        },
        {
            'id': 'cars_transit',
            'label': 'Авто в дорозі',
            'value': str(cars_transit),
            'raw': cars_transit,
            'currency': 'шт',
            'trend': '',
            'up': True,
        },
        {
            'id': 'deals_total',
            'label': 'Угод всього',
            'value': str(deals_total),
            'raw': deals_total,
            'currency': '',
            'trend': '',
            'up': True,
        },
    ]


def action_queues():
    deals = Deal.objects.filter(is_active=True)
    return [
        {
            'id': 'confirm',
            'title': 'Чекають підтвердження',
            'count': deals.filter(execution=ExecutionStage.WON).count(),
            'icon': 'clock',
            'color': 'amber',
        },
        {
            'id': 'pickup',
            'title': 'Готові до забору',
            'count': deals.filter(execution=ExecutionStage.CONFIRMED).count(),
            'icon': 'truck',
            'color': 'cyan',
        },
        {
            'id': 'customs',
            'title': 'В дорозі / митниця',
            'count': deals.filter(
                execution__in=[ExecutionStage.IN_TRANSIT, ExecutionStage.CUSTOMS]
            ).count(),
            'icon': 'route',
            'color': 'blue',
        },
        {
            'id': 'debt',
            'title': 'Доставлено + борг',
            'count': deals.filter(
                execution=ExecutionStage.DELIVERED, debt__gt=0
            ).count(),
            'icon': 'wallet',
            'color': 'red',
        },
        {
            'id': 'no_vin',
            'title': 'Без VIN / фото',
            'count': deals.filter(Q(vin='') | Q(image='')).count(),
            'icon': 'alert',
            'color': 'orange',
        },
        {
            'id': 'stuck',
            'title': 'Застрягли',
            'count': deals.filter(
                execution=ExecutionStage.PICKED,
                updated_at__lt=timezone.now() - timedelta(days=14),
            ).count(),
            'icon': 'pause',
            'color': 'purple',
        },
    ]


def suggest_client_names(query, limit=8):
    """
    Унікальні імена клієнтів з Client + Deal.client_name + Lead.client_name (icontains).
    """
    q = (query or '').strip()
    if not q:
        return []
    names = set()
    for name in Client.objects.filter(is_active=True, name__icontains=q).values_list(
        'name', flat=True
    )[:limit * 2]:
        if name:
            names.add(name.strip())
    for name in Deal.objects.filter(is_active=True, client_name__icontains=q).values_list(
        'client_name', flat=True
    )[:limit * 2]:
        if name:
            names.add(name.strip())
    for name in Lead.objects.filter(is_active=True, client_name__icontains=q).values_list(
        'client_name', flat=True
    )[:limit * 2]:
        if name:
            names.add(name.strip())
    return sorted(names, key=lambda n: (n.lower(), n))[:limit]
