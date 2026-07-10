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
            "lot_url": deal.get("lot_url", ""),
            "image": deal.get("image", ""),
            "price": deal["price"],
            "paid": deal["paid"],
            "debt": deal["debt"],
            "currency": deal["currency"],
            "payment": deal["payment"],
            "payment_label": deal["payment_label"],
            "auction": deal.get("auction", "BCP"),
            "cost": deal.get("cost", 0),
            "won_price": deal.get("won_price", 0),
            "bid": deal.get("bid", 0),
            "delivery_cost": deal.get("delivery_cost", 0),
            "delivery_type": deal.get("delivery_type", "pickup"),
            "commission": deal.get("commission", 0),
            "won_currency": deal.get("won_currency", deal.get("currency", "CHF")),
            "bid_currency": deal.get("bid_currency", deal.get("currency", "CHF")),
            "cost_currency": deal.get("cost_currency", deal.get("currency", "CHF")),
            "price_currency": deal.get("price_currency", deal.get("currency", "CHF")),
            "delivery_currency": deal.get("delivery_currency", deal.get("currency", "CHF")),
            "execution": deal.get("execution"),
            "execution_label": deal.get("execution_label"),
            "profit": deal.get("profit"),
            "logistics": deal.get("logistics", {}),
            "due_payments": deal.get("due_payments", []),
            "documents": deal.get("documents", []),
            "notes": deal.get("notes", ""),
        }
        for deal in md.DEALS
    ]
    return {"crm_deals_catalog_json": json.dumps(catalog, ensure_ascii=False)}
