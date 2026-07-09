import json

from django.shortcuts import render

from . import mock_data as md


def login_view(request):
    return render(request, "pages/login.html")


def cockpit_view(request):
    pipeline = [
        {
            **stage,
            "count": sum(1 for deal in md.DEALS if deal["execution"] == stage["key"]),
        }
        for stage in md.EXECUTION_STAGES
    ]
    return render(request, "pages/cockpit.html", {
        "stats": md.COCKPIT_STATS,
        "queues": md.ACTION_QUEUES,
        "pipeline": pipeline,
        "recent_deals": md.DEALS[:4],
        "page": "cockpit",
    })


def deals_view(request):
    view_mode = request.GET.get("view", "cards")
    auctions = ["BCP", "SCC", "ALLIANZ", "REST", "BCP", "SCC"]
    deals = []
    for i, deal in enumerate(md.DEALS):
        deals.append({
            **deal,
            "auction": deal.get("auction") or auctions[i % len(auctions)],
        })
    stages = [
        {
            **stage,
            "count": sum(1 for deal in deals if deal["execution"] == stage["key"]),
        }
        for stage in md.EXECUTION_STAGES
    ]
    return render(request, "pages/deals.html", {
        "deals": deals,
        "view_mode": view_mode,
        "stages": stages,
        "page": "deals",
    })


def deal_detail_view(request, deal_id):
    deal = next((d for d in md.DEALS if d["id"] == deal_id), md.DEALS[0])
    deal = {
        **deal,
        "due_payments": deal.get("due_payments", []),
        "documents": deal.get("documents", []),
        "notes": deal.get("notes", ""),
    }
    return render(request, "pages/deal_detail.html", {
        "deal": deal,
        "stages": md.EXECUTION_STAGES,
        "payments": md.PAYMENTS_SAMPLE,
        "price_breakdown": md.PRICE_BREAKDOWN,
        "page": "deals",
    })


def _report_sections_with_ids(sections):
    out = []
    counter = 1
    for section in sections:
        rows = []
        for row in section["rows"]:
            row_id = row.get("id") or f"RPT-{counter:03d}"
            rows.append({**row, "id": row_id})
            counter += 1
        out.append({**section, "rows": rows})
    return out


def reports_view(request):
    sections = _report_sections_with_ids(md.REPORT_SECTIONS)
    return render(request, "pages/reports.html", {
        "report": md.MONTHLY_REPORT,
        "report_sections": sections,
        "report_sections_json": json.dumps(sections, ensure_ascii=False),
        "page": "reports",
    })


def clients_view(request):
    return render(request, "pages/clients.html", {
        "clients": md.CLIENTS,
        "page": "clients",
    })


def leads_view(request):
    status_order = {s["key"]: i for i, s in enumerate(md.LEAD_STATUSES)}
    valid_statuses = {s["key"] for s in md.LEAD_STATUSES}
    counts = {s["key"]: 0 for s in md.LEAD_STATUSES}
    active_keys = {"new", "searching", "review", "agreed", "negotiating"}

    enriched = []
    active_count = 0

    for lead in md.LEADS:
        item = {**lead, "status_index": status_order.get(lead["status"], 0)}
        enriched.append(item)
        counts[lead["status"]] = counts.get(lead["status"], 0) + 1
        if lead["status"] in active_keys:
            active_count += 1

    won_count = counts.get("won", 0)
    statuses = [{**stage, "count": counts.get(stage["key"], 0)} for stage in md.LEAD_STATUSES]

    active_status = request.GET.get("status") or "all"
    if active_status != "all" and active_status not in valid_statuses:
        active_status = "all"

    return render(request, "pages/leads.html", {
        "leads": enriched,
        "lead_statuses": statuses,
        "total_leads": len(enriched),
        "active_count": active_count,
        "won_count": won_count,
        "active_status": active_status,
        "page": "leads",
    })


def carriers_view(request):
    return render(request, "pages/carriers.html", {
        "carriers": md.CARRIERS,
        "page": "carriers",
    })


def money_view(request):
    debtors = [d for d in md.DEALS if d.get("debt", 0) > 0]
    return render(request, "pages/money.html", {
        "debtors": debtors,
        "page": "money",
    })


def settings_view(request):
    return render(request, "pages/settings.html", {"page": "settings"})
