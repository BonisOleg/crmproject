"""Serialize ORM models to frontend-compatible dicts."""

from decimal import Decimal


def _num(value):
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return float(value)
    return value


def _date(value):
    if not value:
        return ''
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)[:10]


def serialize_document(doc):
    return {
        'id': f'doc-{doc.pk}',
        'pk': doc.pk,
        'name': doc.name,
        'added': _date(doc.uploaded_at.date()) if doc.uploaded_at else '',
        'url': doc.file.url if doc.file else '',
    }


def serialize_due_payment(item):
    return {
        'id': f'due-{item.pk}',
        'pk': item.pk,
        'amount': _num(item.amount),
        'place': item.place or '',
    }


def serialize_deal(deal, *, include_nested=True):
    client_name = deal.client_name or (deal.client.name if deal.client_id else '')
    data = {
        'id': deal.code,
        'pk': deal.pk,
        'car': deal.car,
        'year': deal.year or '',
        'client': client_name,
        'client_id': deal.client_id,
        'phone': deal.phone or '',
        'execution': deal.execution,
        'execution_label': deal.get_execution_display(),
        'payment': deal.payment,
        'payment_label': deal.get_payment_display(),
        'price': _num(deal.price),
        'paid': _num(deal.paid),
        'debt': _num(deal.debt),
        'currency': deal.currency,
        'profit': _num(deal.profit),
        'vin': deal.vin or '',
        'lot_url': deal.lot_url or '',
        'image': deal.image or '',
        'logistics': deal.logistics or {},
        'delivery_type': deal.delivery_type,
        'auction': deal.auction or 'BCP',
        'won_price': _num(deal.won_price),
        'bid': _num(deal.bid),
        'cost': _num(deal.cost),
        'delivery_cost': _num(deal.delivery_cost),
        'commission': _num(deal.commission),
        'won_currency': deal.won_currency,
        'bid_currency': deal.bid_currency,
        'cost_currency': deal.cost_currency,
        'price_currency': deal.price_currency,
        'delivery_currency': deal.delivery_currency,
        'notes': deal.notes or '',
    }
    if include_nested:
        data['due_payments'] = [
            serialize_due_payment(item) for item in deal.due_payments.all()
        ]
        data['documents'] = [
            serialize_document(item) for item in deal.documents.all()
        ]
    return data


def serialize_client(client, deals_count=None):
    if deals_count is None:
        deals_count = client.deals.filter(is_active=True).count()
    return {
        'id': client.pk,
        'pk': client.pk,
        'name': client.name,
        'phone': client.phone or '',
        'telegram': client.telegram or '',
        'deals': deals_count,
        'debt': _num(client.debt),
        'currency': client.currency,
    }


def serialize_lead(lead):
    return {
        'id': lead.code,
        'pk': lead.pk,
        'client': lead.client_name,
        'phone': lead.phone or '',
        'date': _date(lead.request_date),
        'criteria': lead.criteria or '',
        'manager': lead.manager or '',
        'status': lead.status,
        'status_label': lead.get_status_display(),
        'candidates': lead.candidates,
        'deal_id': lead.deal.code if lead.deal_id else '',
    }


def serialize_carrier(carrier, *, include_nested=True):
    data = {
        'id': carrier.code,
        'pk': carrier.pk,
        'route': carrier.route or '',
        'status': carrier.status,
        'status_label': carrier.get_status_display(),
        'cars': carrier.cars,
        'departure': _date(carrier.departure),
        'eta': _date(carrier.eta),
        'driver': carrier.driver,
        'plate': carrier.plate or '',
    }
    if include_nested:
        data['assigned_deals'] = list(
            carrier.deals.filter(is_active=True).values_list('code', flat=True)
        )
        data['documents'] = [
            serialize_document(item) for item in carrier.documents.all()
        ]
    return data


def serialize_payment(payment):
    return {
        'id': f'pay-{payment.pk}',
        'pk': payment.pk,
        'dealId': payment.deal.code,
        'deal_id': payment.deal.code,
        'amount': _num(payment.amount),
        'currency': payment.currency,
        'place': payment.place or '',
        'date': _date(payment.paid_on),
    }


def serialize_report_row(row):
    return {
        'id': f'RPT-{row.pk}',
        'pk': row.pk,
        'deal_id': row.deal.code if row.deal_id else '',
        'car': row.car,
        'client': row.client,
        'stage': row.stage,
        'won_price': _num(row.won_price),
        'bid': _num(row.bid),
        'cost': _num(row.cost),
        'price': _num(row.price),
        'delivery_cost': _num(row.delivery_cost),
        'profit': _num(row.profit),
        'delivery_type': row.delivery_type,
        'currency': row.currency,
        'won_currency': row.won_currency,
        'bid_currency': row.bid_currency,
        'cost_currency': row.cost_currency,
        'price_currency': row.price_currency,
        'delivery_currency': row.delivery_currency,
        'is_manual': row.is_manual,
    }


def serialize_settings(settings_obj):
    return {
        'commission_percent': _num(settings_obj.commission_percent),
        'logistics_fixed_chf': _num(settings_obj.logistics_fixed_chf),
        'rate_chf_uah': _num(settings_obj.rate_chf_uah),
        'rate_eur_uah': _num(settings_obj.rate_eur_uah),
    }
