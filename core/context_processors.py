import json

from django.db import OperationalError, ProgrammingError

from .models import Carrier, Deal
from .serializers import serialize_carrier, serialize_deal


def crm_catalog(request):
    empty = {
        'crm_deals_catalog_json': '[]',
        'crm_carriers_catalog_json': '[]',
    }
    if not getattr(request, 'user', None) or not request.user.is_authenticated:
        return empty

    try:
        deals = Deal.objects.filter(is_active=True).prefetch_related(
            'due_payments', 'documents', 'client'
        )
        carriers = Carrier.objects.filter(is_active=True).prefetch_related(
            'deals', 'documents'
        )
        return {
            'crm_deals_catalog_json': json.dumps(
                [serialize_deal(d) for d in deals], ensure_ascii=False
            ),
            'crm_carriers_catalog_json': json.dumps(
                [serialize_carrier(c) for c in carriers], ensure_ascii=False
            ),
        }
    except (OperationalError, ProgrammingError):
        return empty
