"""JSON API: clients, deals, due-payments, documents, leads."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods

from . import api_helpers as h
from .models import Client, Deal, DealDuePayment, Document, Lead
from .serializers import (
    serialize_client,
    serialize_deal,
    serialize_document,
    serialize_due_payment,
    serialize_lead,
)
from .services import (
    apply_deal_money,
    next_deal_code,
    next_lead_code,
    sync_client_debt,
    to_decimal,
)


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def clients_collection(request):
    if request.method == 'GET':
        items = [serialize_client(c) for c in Client.objects.filter(is_active=True)]
        return h.ok(items)
    try:
        body = h.json_body(request)
        client = Client.objects.create(
            name=h.parse_name(body.get('name')),
            phone=h.parse_phone(body.get('phone'), required=False),
            telegram=str(body.get('telegram') or '').strip(),
            currency=body.get('currency') or 'CHF',
            debt=to_decimal(body.get('debt'), 0),
        )
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_client(client), status=201)


@h.api_login_required
@require_http_methods(['GET', 'PATCH', 'DELETE'])
def client_detail(request, pk):
    client = get_object_or_404(Client, pk=pk, is_active=True)
    if request.method == 'GET':
        return h.ok(serialize_client(client))
    if request.method == 'DELETE':
        client.is_active = False
        client.save(update_fields=['is_active', 'updated_at'])
        return h.ok({'id': pk})
    try:
        body = h.json_body(request)
        if 'name' in body:
            client.name = h.parse_name(body.get('name'))
        if 'phone' in body:
            client.phone = h.parse_phone(body.get('phone'), required=False)
        if 'telegram' in body:
            client.telegram = str(body.get('telegram') or '').strip()
        if 'currency' in body:
            client.currency = body.get('currency') or client.currency
        client.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_client(client))


def _deal_from_body(body, deal=None):
    deal = deal or Deal()
    if body.get('id') or body.get('code'):
        deal.code = str(body.get('id') or body.get('code')).strip()
    elif not deal.code:
        deal.code = next_deal_code()

    deal.car = h.parse_car(body.get('car') if 'car' in body or not deal.pk else deal.car)
    if 'year' in body:
        deal.year = h.parse_year(body.get('year'))
    if 'client' in body:
        deal.client_name = h.parse_name(body.get('client'), required=False) or str(
            body.get('client') or ''
        ).strip()
    if 'phone' in body:
        deal.phone = h.parse_phone(body.get('phone'), required=False)
    for field in (
        'execution', 'payment', 'currency', 'vin', 'lot_url', 'image',
        'delivery_type', 'auction', 'notes',
        'won_currency', 'bid_currency', 'cost_currency',
        'price_currency', 'delivery_currency',
    ):
        if field in body and body[field] is not None:
            setattr(deal, field, body[field])
    if 'logistics' in body and isinstance(body['logistics'], dict):
        deal.logistics = body['logistics']
    for money_field in (
        'price', 'paid', 'won_price', 'bid', 'cost', 'delivery_cost', 'commission',
    ):
        if money_field in body:
            setattr(deal, money_field, to_decimal(h.parse_money(body.get(money_field))))
    return deal


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def deals_collection(request):
    if request.method == 'GET':
        qs = Deal.objects.filter(is_active=True).prefetch_related(
            'due_payments', 'documents', 'client'
        )
        return h.ok([serialize_deal(d) for d in qs])
    try:
        body = h.json_body(request)
        with transaction.atomic():
            deal = _deal_from_body(body)
            deal.recalc_money()
            deal.save()
            if deal.client_name:
                client, _ = Client.objects.get_or_create(
                    name=deal.client_name,
                    defaults={'phone': deal.phone, 'currency': deal.currency},
                )
                deal.client = client
                deal.save(update_fields=['client'])
            sync_client_debt(deal)
            apply_deal_money(deal)
            deal.refresh_from_db()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_deal(deal), status=201)


@h.api_login_required
@require_http_methods(['GET', 'PATCH', 'DELETE'])
def deal_detail(request, code):
    deal = get_object_or_404(
        Deal.objects.prefetch_related('due_payments', 'documents', 'client'),
        code=code,
        is_active=True,
    )
    if request.method == 'GET':
        return h.ok(serialize_deal(deal))
    if request.method == 'DELETE':
        deal.is_active = False
        deal.save(update_fields=['is_active', 'updated_at'])
        apply_deal_money(deal)
        return h.ok({'id': code})
    try:
        body = h.json_body(request)
        with transaction.atomic():
            deal = _deal_from_body(body, deal)
            deal.recalc_money()
            deal.save()
            sync_client_debt(deal)
            apply_deal_money(deal)
            deal.refresh_from_db()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_deal(deal))


@h.api_login_required
@require_http_methods(['GET', 'PUT'])
def deal_due_payments(request, code):
    deal = get_object_or_404(Deal, code=code, is_active=True)
    if request.method == 'GET':
        return h.ok([serialize_due_payment(i) for i in deal.due_payments.all()])
    try:
        body = h.json_body(request)
        items = body.get('items') or body.get('due_payments') or []
        if not isinstance(items, list):
            raise ValueError('Очікується список due_payments')
        with transaction.atomic():
            deal.due_payments.all().delete()
            for idx, item in enumerate(items):
                DealDuePayment.objects.create(
                    deal=deal,
                    amount=to_decimal(h.parse_money(item.get('amount'))),
                    place=str(item.get('place') or '').strip(),
                    sort_order=idx,
                )
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok([serialize_due_payment(i) for i in deal.due_payments.all()])


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def deal_documents(request, code):
    deal = get_object_or_404(Deal, code=code, is_active=True)
    if request.method == 'GET':
        return h.ok([serialize_document(d) for d in deal.documents.all()])
    name = request.POST.get('name') or ''
    upload = request.FILES.get('file')
    if not upload and not name:
        return h.fail('Потрібен файл або назва')
    doc = Document.objects.create(
        deal=deal,
        name=name or (upload.name if upload else 'Документ'),
        file=upload,
        uploaded_by=request.user,
    )
    return h.ok(serialize_document(doc), status=201)


@h.api_login_required
@require_http_methods(['DELETE'])
def document_delete(request, pk):
    doc = get_object_or_404(Document, pk=pk)
    if doc.file:
        doc.file.delete(save=False)
    doc.delete()
    return h.ok({'id': pk})


@h.api_login_required
@require_http_methods(['GET', 'POST'])
def leads_collection(request):
    if request.method == 'GET':
        return h.ok([serialize_lead(x) for x in Lead.objects.filter(is_active=True)])
    try:
        body = h.json_body(request)
        code = str(body.get('id') or '').strip() or next_lead_code()
        deal = None
        deal_code = str(body.get('deal_id') or '').strip()
        if deal_code:
            deal = Deal.objects.filter(code=deal_code, is_active=True).first()
        lead = Lead.objects.create(
            code=code,
            client_name=str(body.get('client') or '').strip() or h.parse_name(
                body.get('client')
            ),
            phone=h.parse_phone(body.get('phone'), required=False),
            criteria=str(body.get('criteria') or '').strip(),
            manager=str(body.get('manager') or '').strip(),
            status=body.get('status') or 'new',
            candidates=int(body.get('candidates') or 0),
            request_date=parse_date(str(body.get('date') or '')) if body.get('date') else None,
            deal=deal,
        )
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_lead(lead), status=201)


@h.api_login_required
@require_http_methods(['GET', 'PATCH', 'DELETE'])
def lead_detail(request, code):
    lead = get_object_or_404(Lead, code=code, is_active=True)
    if request.method == 'GET':
        return h.ok(serialize_lead(lead))
    if request.method == 'DELETE':
        lead.is_active = False
        lead.save(update_fields=['is_active', 'updated_at'])
        return h.ok({'id': code})
    try:
        body = h.json_body(request)
        if 'client' in body:
            lead.client_name = str(body.get('client') or '').strip()
        if 'phone' in body:
            lead.phone = h.parse_phone(body.get('phone'), required=False)
        if 'criteria' in body:
            lead.criteria = str(body.get('criteria') or '').strip()
        if 'manager' in body:
            lead.manager = str(body.get('manager') or '').strip()
        if 'status' in body:
            lead.status = body['status']
        if 'candidates' in body:
            lead.candidates = int(body.get('candidates') or 0)
        if 'date' in body:
            lead.request_date = (
                parse_date(str(body.get('date') or '')) if body.get('date') else None
            )
        if 'deal_id' in body:
            deal_code = str(body.get('deal_id') or '').strip()
            lead.deal = (
                Deal.objects.filter(code=deal_code, is_active=True).first()
                if deal_code
                else None
            )
        lead.save()
    except ValueError as exc:
        return h.fail(str(exc))
    return h.ok(serialize_lead(lead))
