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
    ReportMonth,
    ReportRow,
    ReportType,
)

_MONTH_UA = {
    1: 'Січень',
    2: 'Лютий',
    3: 'Березень',
    4: 'Квітень',
    5: 'Травень',
    6: 'Червень',
    7: 'Липень',
    8: 'Серпень',
    9: 'Вересень',
    10: 'Жовтень',
    11: 'Листопад',
    12: 'Грудень',
}

# Підтверджено і далі по воронці (не «Виграно»)
CONFIRMED_AND_BELOW = (
    ExecutionStage.CONFIRMED,
    ExecutionStage.PICKED,
    ExecutionStage.IN_TRANSIT,
    ExecutionStage.CUSTOMS,
    ExecutionStage.DELIVERED,
)


def current_month_key(day=None):
    day = day or timezone.localdate()
    return day.strftime('%Y-%m')


def month_label(month_key):
    try:
        year, month = month_key.split('-')
        return f'{_MONTH_UA[int(month)]} {year}'
    except (ValueError, KeyError, TypeError):
        return month_key


def _next_code(prefix, queryset, field='code', width=3):
    max_num = 0
    for code in queryset.values_list(field, flat=True):
        if not code:
            continue
        tail = str(code).rsplit('-', 1)[-1]
        if tail.isdigit():
            max_num = max(max_num, int(tail))
    return f'{prefix}{str(max_num + 1).zfill(width)}'


def next_deal_code():
    year = timezone.localdate().year
    return _next_code(f'AL-{year}-', Deal.objects.all())


def next_lead_code():
    return _next_code('RQ-', Lead.objects.all())


def next_carrier_code():
    return _next_code('TR-', Carrier.objects.all())


def to_decimal(value, default=0):
    try:
        if value is None or value == '':
            return Decimal(str(default))
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def apply_deal_money(deal):
    deal.recalc_money()
    deal.save(update_fields=[
        'debt', 'profit', 'payment', 'paid', 'price', 'cost', 'updated_at',
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


def get_or_create_month(month_key=None):
    month_key = month_key or current_month_key()
    obj, _ = ReportMonth.objects.get_or_create(
        month_key=month_key,
        defaults={'label': month_label(month_key)},
    )
    if not obj.label:
        obj.label = month_label(month_key)
        obj.save(update_fields=['label'])
    return obj


def _snapshot_from_deal(deal):
    return {
        'car': deal.car,
        'client': deal.client_name or (deal.client.name if deal.client_id else ''),
        'stage': deal.get_execution_display(),
        'won_price': deal.won_price,
        'bid': deal.bid,
        'cost': deal.cost,
        'price': deal.price,
        'delivery_cost': deal.delivery_cost if deal.delivery_type == 'ours' else 0,
        'delivery_type': deal.delivery_type,
        'currency': deal.currency,
        'won_currency': deal.won_currency,
        'bid_currency': deal.bid_currency,
        'cost_currency': deal.cost_currency,
        'price_currency': deal.price_currency,
        'delivery_currency': deal.delivery_currency,
        'profit': deal.profit,
    }


def sync_deal_to_reports(deal):
    """Виграні = усі активні; Підтверджені = confirmed і далі по воронці."""
    if not deal.is_active:
        ReportRow.objects.filter(deal=deal, is_manual=False).delete()
        return

    month = get_or_create_month()
    if month.is_archived:
        return

    snap = _snapshot_from_deal(deal)
    defaults = {**snap, 'is_manual': False}

    won_row, _ = ReportRow.objects.update_or_create(
        deal=deal,
        month=month,
        report_type=ReportType.WON,
        defaults=defaults,
    )

    if deal.execution in CONFIRMED_AND_BELOW:
        ReportRow.objects.update_or_create(
            deal=deal,
            month=month,
            report_type=ReportType.CONFIRMED,
            defaults=defaults,
        )
    else:
        ReportRow.objects.filter(
            deal=deal, report_type=ReportType.CONFIRMED, is_manual=False
        ).delete()

    return won_row


def sync_report_row_to_deal(row, *, push_to_reports=True):
    """Підтягнути гроші/авто зі рядка звіту в повʼязану угоду."""
    deal = row.deal
    if not deal or not deal.is_active:
        return None

    if row.car:
        deal.car = row.car
    if row.client:
        deal.client_name = row.client
    deal.won_price = row.won_price or 0
    deal.bid = row.bid or 0
    deal.cost = row.cost or 0
    deal.price = row.price or 0
    deal.delivery_cost = row.delivery_cost or 0
    if row.delivery_type:
        deal.delivery_type = row.delivery_type
    deal.currency = row.currency or deal.currency or 'CHF'
    deal.won_currency = row.won_currency or deal.won_currency or deal.currency
    deal.bid_currency = row.bid_currency or deal.bid_currency or deal.currency
    deal.cost_currency = row.cost_currency or deal.cost_currency or deal.currency
    deal.price_currency = row.price_currency or deal.price_currency or deal.currency
    deal.delivery_currency = (
        row.delivery_currency or deal.delivery_currency or deal.currency
    )
    deal.recalc_money()
    deal.save(update_fields=[
        'car', 'client_name', 'won_price', 'bid', 'cost', 'price', 'delivery_cost',
        'delivery_type', 'currency', 'won_currency', 'bid_currency', 'cost_currency',
        'price_currency', 'delivery_currency', 'debt', 'profit', 'payment', 'updated_at',
    ])
    sync_client_debt(deal)
    if push_to_reports:
        sync_deal_to_reports(deal)
    return deal


def backfill_deals_from_reports(month_key=None):
    """Якщо в угоді 0, а в звіті є суми — підтягнути звіт → угода."""
    month = get_or_create_month(month_key)
    if month.is_archived:
        return 0
    synced = 0
    rows = (
        ReportRow.objects.filter(month=month, report_type=ReportType.WON, deal__isnull=False)
        .select_related('deal')
        .iterator()
    )
    for row in rows:
        deal = row.deal
        if not deal or not deal.is_active:
            continue
        if (deal.price or 0) != 0 or (deal.cost or 0) != 0:
            continue
        if (row.price or 0) == 0 and (row.cost or 0) == 0 and (row.profit or 0) == 0:
            continue
        sync_report_row_to_deal(row)
        synced += 1
    return synced


def refresh_current_report_rows():
    """Спочатку heal угоди зі звіту, потім пересинк у звіт поточного місяця."""
    month = get_or_create_month()
    if month.is_archived:
        return month
    backfill_deals_from_reports(month.month_key)
    for deal in Deal.objects.filter(is_active=True).iterator():
        sync_deal_to_reports(deal)
    return month


def monthly_profit_total(month_key=None):
    """
    Прибуток місяця: рядки звіту «Виграні» за місяць для
    підтверджених+/оплачених угод (і ручних рядків без угоди).
    """
    month_key = month_key or current_month_key()
    return (
        ReportRow.objects.filter(
            month__month_key=month_key,
            report_type=ReportType.WON,
        )
        .filter(
            Q(deal__isnull=True, is_manual=True)
            | Q(deal__execution__in=CONFIRMED_AND_BELOW)
            | Q(deal__payment=PaymentStatus.PAID)
        )
        .aggregate(s=Sum('profit'))
        .get('s')
        or 0
    )


def archive_previous_months(active_key=None):
    active_key = active_key or current_month_key()
    get_or_create_month(active_key)
    now = timezone.now()
    return ReportMonth.objects.filter(month_key__lt=active_key, is_archived=False).update(
        is_archived=True,
        archived_at=now,
    )


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
