from django.conf import settings


def crm_catalog(request):
    return {
        'crm_deals_catalog_json': '[]',
        'crm_carriers_catalog_json': '[]',
        'use_static_bundles': not settings.DEBUG,
    }
