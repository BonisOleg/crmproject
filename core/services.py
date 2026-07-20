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
    """Keep ReportRow in sync when deal is won/confirmed; remove from other type."""
    if not deal.is_active:
        ReportRow.objects.filter(deal=deal, is_manual=False).delete()
        return

    month = get_or_create_month()
    if month.is_archived:
        return

    if deal.execution == ExecutionStage.WON:
        target, other = ReportType.WON, ReportType.CONFIRMED
    elif deal.execution == ExecutionStage.CONFIRMED:
        target, other = ReportType.CONFIRMED, ReportType.WON
    else:
        ReportRow.objects.filter(deal=deal, is_manual=False).delete()
        return

    ReportRow.objects.filter(deal=deal, report_type=other, is_manual=False).delete()
    snap = _snapshot_from_deal(deal)
    row, _ = ReportRow.objects.update_or_create(
        deal=deal,
        month=month,
        report_type=target,
        defaults={**snap, 'is_manual': False},
    )
    return row


def archive_previous_months(active_key=None):
    active_key = active_key or current_month_key()
    get_or_create_month(active_key)
    now = timezone.now()
    return ReportMonth.objects.filter(month_key__lt=active_key, is_archived=False).update(
        is_archived=True,
        archived_at=now,
    )


def cockpit_stats():
    deals = Deal.objects.filter(is_active=True)
    receivable = deals.aggregate(s=Sum('debt')).get('s') or 0
    profit = deals.filter(
        created_at__month=timezone.localdate().month,
        created_at__year=timezone.localdate().year,
    ).aggregate(s=Sum('profit')).get('s') or 0
    in_transit_money = deals.filter(
        execution=ExecutionStage.IN_TRANSIT
    ).aggregate(s=Sum('price')).get('s') or 0
    cars_transit = deals.filter(
        execution__in=[ExecutionStage.IN_TRANSIT, ExecutionStage.CUSTOMS]
    ).count()

    def fmt(n):
        return f'{int(n):,}'.replace(',', ' ')

    return [
        {
            'id': 'receivable',
            'label': 'До отримання',
            'value': fmt(receivable),
            'currency': 'CHF',
            'trend': '',
            'up': True,
        },
        {
            'id': 'profit',
            'label': 'Прибуток місяця',
            'value': fmt(profit),
            'currency': 'CHF',
            'trend': '',
            'up': True,
        },
        {
            'id': 'in_transit_money',
            'label': 'Гроші в дорозі',
            'value': fmt(in_transit_money),
            'currency': 'CHF',
            'trend': '',
            'up': False,
        },
        {
            'id': 'cars_transit',
            'label': 'Авто в дорозі',
            'value': str(cars_transit),
            'currency': 'шт',
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
