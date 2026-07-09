import json

from . import mock_data as md


def crm_catalog(request):
    catalog = [
        {
            "id": deal["id"],
            "car": deal["car"],
            "year": deal.get("year"),
            "client": deal["client"],
            "phone": deal.get("phone", ""),
            "vin": deal.get("vin", ""),
            "price": deal["price"],
            "paid": deal["paid"],
            "debt": deal["debt"],
            "currency": deal["currency"],
            "payment": deal["payment"],
            "payment_label": deal["payment_label"],
            "auction": deal.get("auction", "BCP"),
            "cost": deal.get("cost"),
            "execution": deal.get("execution"),
            "execution_label": deal.get("execution_label"),
            "profit": deal.get("profit"),
            "due_payments": deal.get("due_payments", []),
            "documents": deal.get("documents", []),
            "notes": deal.get("notes", ""),
        }
        for deal in md.DEALS
    ]
    return {"crm_deals_catalog_json": json.dumps(catalog, ensure_ascii=False)}
