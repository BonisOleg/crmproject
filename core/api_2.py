"""JSON API: carriers, payments, reports, settings, health, media."""

from django.conf import settings
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods
from django.views.static import serve as static_serve

from . import api_helpers as h
from .models import Carrier, Deal, Document, Payment, ReportMonth, ReportRow, SiteSettings
from .serializers import (
    serialize_carrier,
    serialize_document,
    serialize_payment,
    serialize_report_row,
    serialize_settings,
)
from .services import (
    apply_deal_money,
    archive_previous_months,
    current_month_key,
    get_or_create_month,
    month_label,
    next_carrier_code,
    to_decimal,
)


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def carriers_collection(request):
    if request.method == 'GET':
        qs = Carrier.objects.filter(is_active=True).prefetch_related('deals', 'documents')
        return h.ok([serialize_carrier(c) for c in qs])
    try:
        body = h.json_body(request)
        code = str(body.get('id') or '').strip() or next_carrier_code()
        carrier = Carrier.objects.create(
            code=code,
            driver=str(body.get('driver') or '').strip() or 'Водій',
            plate=str(body.get('plate') or '').strip(),
            route=str(body.get('route') or '').strip(),
            cars=int(body.get('cars') or 0),
            departure=parse_date(str(body.get('departure') or '')) if body.get('departure') else None,
            eta=parse_date(str(body.get('eta') or '')) if body.get('eta') else None,
            status=body.get('status') or 'planning',
        )
        codes = body.get('assigned_deals') or []
        if codes:
            deals = Deal.objects.filter(code__in=codes, is_active=True)
            carrier.deals.set(deals)
            carrier.cars = carrier.deals.count() or carrier.cars
            carrier.save(update_fields=['cars', 'updated_at'])
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_carrier(carrier), status=201)


@h.api_login_required
@require_http_methods(['GET', 'PATCH', 'DELETE'])
def carrier_detail(request, code):
    carrier = get_object_or_404(
        Carrier.objects.prefetch_related('deals', 'documents'),
        code=code,
        is_active=True,
    )
    if request.method == 'GET':
        return h.ok(serialize_carrier(carrier))
    if request.method == 'DELETE':
        carrier.is_active = False
        carrier.save(update_fields=['is_active', 'updated_at'])
        return h.ok({'id': code})
    try:
        body = h.json_body(request)
        for field in ('driver', 'plate', 'route', 'status'):
            if field in body:
                setattr(carrier, field, str(body.get(field) or '').strip())
        if 'cars' in body:
            carrier.cars = int(body.get('cars') or 0)
        if 'departure' in body:
            carrier.departure = (
                parse_date(str(body.get('departure') or '')) if body.get('departure') else None
            )
        if 'eta' in body:
            carrier.eta = parse_date(str(body.get('eta') or '')) if body.get('eta') else None
        if 'assigned_deals' in body:
            codes = body.get('assigned_deals') or []
            deals = Deal.objects.filter(code__in=codes, is_active=True)
            carrier.deals.set(deals)
            carrier.cars = carrier.deals.count() or carrier.cars
        carrier.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_carrier(carrier))


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def carrier_documents(request, code):
    carrier = get_object_or_404(Carrier, code=code, is_active=True)
    if request.method == 'GET':
        return h.ok([serialize_document(d) for d in carrier.documents.all()])
    name = request.POST.get('name') or ''
    upload = request.FILES.get('file')
    if not upload and not name:
        return h.fail('Потрібен файл або назва')
    doc = Document.objects.create(
        carrier=carrier,
        name=name or (upload.name if upload else 'Документ'),
        file=upload,
        uploaded_by=request.user,
    )
    return h.ok(serialize_document(doc), status=201)


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def payments_collection(request):
    if request.method == 'GET':
        qs = Payment.objects.select_related('deal').all()[:200]
        return h.ok([serialize_payment(p) for p in qs])
    try:
        body = h.json_body(request)
        deal_code = str(body.get('dealId') or body.get('deal_id') or '').strip()
        deal = get_object_or_404(Deal, code=deal_code, is_active=True)
        amount = to_decimal(h.parse_money(body.get('amount'), required=True))
        paid_on = body.get('date') or timezone.localdate()
        if isinstance(paid_on, str):
            paid_on = parse_date(paid_on) or timezone.localdate()
        with transaction.atomic():
            payment = Payment.objects.create(
                deal=deal,
                amount=amount,
                currency=body.get('currency') or deal.currency,
                place=str(body.get('place') or '').strip(),
                paid_on=paid_on,
                created_by=request.user,
            )
            deal.paid = to_decimal(deal.paid) + amount
            deal.recalc_money()
            deal.save()
            apply_deal_money(deal)
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok({
        'payment': serialize_payment(payment),
        'deal': {
            'id': deal.code,
            'paid': float(deal.paid),
            'debt': float(deal.debt),
            'payment': deal.payment,
            'payment_label': deal.get_payment_display(),
        },
    }, status=201)


@h.api_login_required
@require_http_methods(['GET'])
def reports_rows(request):
    month_key = request.GET.get('month') or current_month_key()
    report_type = request.GET.get('type') or 'won'
    if report_type not in ('won', 'confirmed'):
        report_type = 'won'
    month = get_or_create_month(month_key)
    rows = ReportRow.objects.filter(month=month, report_type=report_type).select_related('deal')
    return h.ok({
        'month_key': month.month_key,
        'month_label': month.label or month_label(month.month_key),
        'is_archived': month.is_archived,
        'rows': [serialize_report_row(r) for r in rows],
    })


@h.api_login_required
@require_http_methods(['POST'])
def reports_add_row(request):
    try:
        body = h.json_body(request)
        month_key = body.get('month') or current_month_key()
        report_type = body.get('type') or 'won'
        month = get_or_create_month(month_key)
        if month.is_archived:
            return h.fail('Архівний місяць лише для перегляду', status=403)
        deal = None
        deal_code = str(body.get('deal_id') or '').strip()
        if deal_code:
            deal = Deal.objects.filter(code=deal_code, is_active=True).first()
        row = ReportRow(
            month=month,
            report_type=report_type,
            deal=deal,
            car=str(body.get('car') or (deal.car if deal else '')).strip(),
            client=str(body.get('client') or '').strip(),
            stage=str(body.get('stage') or '').strip(),
            won_price=to_decimal(body.get('won_price')),
            bid=to_decimal(body.get('bid')),
            cost=to_decimal(body.get('cost')),
            price=to_decimal(body.get('price')),
            delivery_cost=to_decimal(body.get('delivery_cost')),
            delivery_type=body.get('delivery_type') or 'pickup',
            currency=body.get('currency') or 'CHF',
            won_currency=body.get('won_currency') or 'CHF',
            bid_currency=body.get('bid_currency') or 'CHF',
            cost_currency=body.get('cost_currency') or 'CHF',
            price_currency=body.get('price_currency') or 'CHF',
            delivery_currency=body.get('delivery_currency') or 'CHF',
            is_manual=not bool(deal),
        )
        row.recalc_profit()
        row.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_report_row(row), status=201)


@h.api_login_required
@require_http_methods(['PATCH', 'DELETE'])
def report_row_detail(request, pk):
    row = get_object_or_404(ReportRow.objects.select_related('month', 'deal'), pk=pk)
    if row.month.is_archived:
        return h.fail('Архівний місяць лише для перегляду', status=403)
    if request.method == 'DELETE':
        row.delete()
        return h.ok({'id': pk})
    try:
        body = h.json_body(request)
        for field in (
            'car', 'client', 'stage', 'delivery_type', 'currency',
            'won_currency', 'bid_currency', 'cost_currency',
            'price_currency', 'delivery_currency',
        ):
            if field in body:
                setattr(row, field, body[field])
        for money in ('won_price', 'bid', 'cost', 'price', 'delivery_cost'):
            if money in body:
                setattr(row, money, to_decimal(body.get(money)))
        row.recalc_profit()
        row.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_report_row(row))


@h.api_login_required
@require_http_methods(['POST'])
def reports_rollover(request):
    active = current_month_key()
    archived = archive_previous_months(active)
    month = get_or_create_month(active)
    return h.ok({
        'active_month': active,
        'archived_count': archived,
        'month': {'key': month.month_key, 'label': month.label},
    })


@h.api_login_required
@require_http_methods(['GET'])
def reports_archive_list(request):
    active = current_month_key()
    months = []
    for m in ReportMonth.objects.exclude(month_key=active).order_by('-month_key'):
        won = m.rows.filter(report_type='won').count()
        conf = m.rows.filter(report_type='confirmed').count()
        months.append({
            'key': m.month_key,
            'label': m.label or month_label(m.month_key),
            'deal_count': won + conf,
            'won_count': won,
            'confirmed_count': conf,
            'is_archived': m.is_archived,
        })
    return h.ok(months)


@h.api_login_required
@require_http_methods(['GET', 'PATCH'])
def settings_view(request):
    obj = SiteSettings.get_solo()
    if request.method == 'GET':
        return h.ok(serialize_settings(obj))
    try:
        body = h.json_body(request)
        for field in (
            'commission_percent', 'logistics_fixed_chf', 'rate_chf_uah', 'rate_eur_uah',
        ):
            if field in body:
                setattr(obj, field, to_decimal(body.get(field)))
        obj.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_settings(obj))


@h.api_login_required
@require_http_methods(['GET', 'PATCH'])
def account_view(request):
    from . import account as acct

    if request.method == 'GET':
        if not acct.can_manage_account(request.user):
            return h.fail('Немає доступу', status=403)
        return h.ok(acct.serialize_account(request.user))
    try:
        body = h.json_body(request)
        data = acct.update_account(request, body)
    except PermissionError as exc:
        return h.fail(str(exc), status=403)
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(data)


@require_http_methods(['GET'])
def healthz(request):
    return h.ok({'status': 'ok', 'time': timezone.now().isoformat()})


@h.api_login_required
@require_http_methods(['GET'])
def media_serve(request, path):
    """Serve MEDIA files for authenticated staff (prod disk)."""
    if '..' in path or path.startswith('/'):
        raise Http404()
    return static_serve(request, path, document_root=settings.MEDIA_ROOT)
