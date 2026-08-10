"""Звіти: синк угод, grace 35 днів, rollover і зафіксований прибуток."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from .models import (
    Deal,
    ExecutionStage,
    PaymentStatus,
    ReportMonth,
    ReportRow,
    ReportType,
)

# Підтвердження в межах цього вікна після won_at → атрибуція в поточний місяць
WON_CONFIRM_GRACE_DAYS = 35

# Підтверджено і далі по воронці (не «Виграно»)
CONFIRMED_AND_BELOW = (
    ExecutionStage.CONFIRMED,
    ExecutionStage.PICKED,
    ExecutionStage.IN_TRANSIT,
    ExecutionStage.CUSTOMS,
    ExecutionStage.DELIVERED,
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
    """Ключ YYYY-MM у локальній TZ (Europe/Kyiv)."""
    day = day or timezone.localdate()
    return day.strftime('%Y-%m')


def month_label(month_key):
    try:
        year, month = month_key.split('-')
        return f'{_MONTH_UA[int(month)]} {year}'
    except (ValueError, KeyError, TypeError):
        return month_key


def deal_won_moment(deal):
    """TZ-aware момент виграшу; fallback на created_at."""
    return deal.won_at or deal.created_at or timezone.now()


def ensure_deal_won_at(deal, *, persist=True):
    """
    Гарантує won_at.
    Стан: null → now (перший виграш / створення угоди).
    """
    if deal.won_at:
        return deal.won_at
    deal.won_at = timezone.now()
    if persist and deal.pk:
        deal.save(update_fields=['won_at', 'updated_at'])
    return deal.won_at


def home_month_key_for_deal(deal):
    """Місяць «дому» угоди = локальна дата won_at."""
    moment = deal_won_moment(deal)
    local_dt = timezone.localtime(moment) if timezone.is_aware(moment) else moment
    return current_month_key(local_dt.date())


def within_confirm_grace(deal, today=None):
    """True, якщо сьогодні в межах 35 днів від дати виграшу (локальна TZ)."""
    today = today or timezone.localdate()
    moment = deal_won_moment(deal)
    local_dt = timezone.localtime(moment) if timezone.is_aware(moment) else moment
    won_day = local_dt.date() if hasattr(local_dt, 'date') else local_dt
    return won_day + timedelta(days=WON_CONFIRM_GRACE_DAYS) >= today


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


def _write_live_rows(deal, month, snap, *, is_confirmed):
    """Записати live won (+ confirmed) рядки в target-місяць."""
    defaults = {**snap, 'is_manual': False}
    ReportRow.objects.update_or_create(
        deal=deal,
        month=month,
        report_type=ReportType.WON,
        defaults=defaults,
    )
    if is_confirmed:
        ReportRow.objects.update_or_create(
            deal=deal,
            month=month,
            report_type=ReportType.CONFIRMED,
            defaults=defaults,
        )
    else:
        ReportRow.objects.filter(
            deal=deal,
            month=month,
            report_type=ReportType.CONFIRMED,
            is_manual=False,
        ).delete()


def _ensure_archive_won_snapshot(deal, home_month, snap):
    """
    Архівний won-snapshot: створити, якщо немає.
    Стан після confirm у grace: не перезаписуємо існуючий snapshot.
    """
    exists = ReportRow.objects.filter(
        deal=deal,
        month=home_month,
        report_type=ReportType.WON,
    ).exists()
    if exists:
        return
    ReportRow.objects.create(
        month=home_month,
        deal=deal,
        report_type=ReportType.WON,
        is_manual=False,
        **snap,
    )


def _clear_open_month_rows(deal, *, keep_month):
    """Прибрати live-рядки з незаархівованих місяців, крім keep_month."""
    ReportRow.objects.filter(
        deal=deal,
        is_manual=False,
        month__is_archived=False,
    ).exclude(month=keep_month).delete()


def sync_deal_to_reports(deal, month_key=None):
    """
    Виграні / підтверджені з урахуванням grace 35 днів.

    Стани атрибуції:
    - home == current → рядки лише в поточному місяці
    - unconfirmed + home в архіві → won лишається в архіві (eligible для confirm)
    - confirmed у межах grace → won-snapshot в архіві + live financials у current
    - confirmed поза grace → атрибуція лишається в архівному (home) місяці
    """
    if not deal.is_active:
        ReportRow.objects.filter(deal=deal, is_manual=False).delete()
        return None

    ensure_deal_won_at(deal, persist=True)

    active_key = current_month_key()
    home_key = home_month_key_for_deal(deal)
    is_confirmed = deal.execution in CONFIRMED_AND_BELOW
    in_grace = within_confirm_grace(deal)
    snap = _snapshot_from_deal(deal)

    # Примусовий month_key лише для явного refresh відкритого поточного місяця
    force_active = month_key == active_key

    if home_key >= active_key:
        target_key = active_key
        grace_split = False
    elif is_confirmed and in_grace:
        # B: архів зберігає won-snapshot; current отримує confirmed/financials
        target_key = active_key
        grace_split = True
    else:
        # Unconfirmed в минулому місяці АБО confirm поза grace → home/архів
        target_key = home_key
        grace_split = False

    if force_active and home_key == active_key:
        target_key = active_key
        grace_split = False

    target_month = get_or_create_month(target_key)

    if grace_split:
        home_month = get_or_create_month(home_key)
        _ensure_archive_won_snapshot(deal, home_month, snap)
        # Confirmed financials не дублюємо в архіві під час grace
        ReportRow.objects.filter(
            deal=deal,
            month=home_month,
            report_type=ReportType.CONFIRMED,
            is_manual=False,
        ).delete()
        _write_live_rows(deal, target_month, snap, is_confirmed=True)
        _clear_open_month_rows(deal, keep_month=target_month)
        return ReportRow.objects.filter(
            deal=deal, month=target_month, report_type=ReportType.WON
        ).first()

    _write_live_rows(deal, target_month, snap, is_confirmed=is_confirmed)
    _clear_open_month_rows(deal, keep_month=target_month)
    return ReportRow.objects.filter(
        deal=deal, month=target_month, report_type=ReportType.WON
    ).first()


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
    from .services import sync_client_debt

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


def refresh_current_report_rows(month_key=None):
    """Heal угоди зі звіту, потім пересинк усіх активних угод (атрибуція сама вирішує місяць)."""
    month = get_or_create_month(month_key)
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
        or Decimal('0')
    )


def archive_previous_months(active_key=None):
    """
    Архівує минулі місяці й фіксує finalized_profit.
    Стан: is_archived=False → True + finalized_profit = monthly_profit_total.
    """
    active_key = active_key or current_month_key()
    get_or_create_month(active_key)
    now = timezone.now()
    pending = list(
        ReportMonth.objects.filter(month_key__lt=active_key, is_archived=False)
    )
    for month in pending:
        # Фіксуємо прибуток ДО прапорця архіву (формула та сама)
        month.finalized_profit = monthly_profit_total(month.month_key)
        month.is_archived = True
        month.archived_at = now
        month.save(update_fields=['finalized_profit', 'is_archived', 'archived_at'])
    return len(pending)


def ensure_month_rollover(active_key=None):
    """Архів минулих місяців + створення/наповнення звіту поточного місяця (без gap)."""
    active_key = active_key or current_month_key()
    archive_previous_months(active_key)
    # Поточний місяць завжди існує й пересинкнений
    return refresh_current_report_rows(active_key)
