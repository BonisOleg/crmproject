import json
import re
import urllib.error
import urllib.request

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_http_methods

from . import mock_data as md


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect("cockpit")

    error = None
    username = ""

    if request.method == "POST":
        username = request.POST.get("username", "").strip().lower()
        password = request.POST.get("password", "")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            next_url = request.POST.get("next") or request.GET.get("next")
            if next_url and url_has_allowed_host_and_scheme(
                next_url,
                allowed_hosts={request.get_host()},
                require_https=request.is_secure(),
            ):
                return redirect(next_url)
            return redirect("cockpit")

        error = "Невірний email або пароль."

    return render(request, "pages/login.html", {
        "error": error,
        "username": username,
    })


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return redirect("login")


@login_required
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


@login_required
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


@login_required
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


@login_required
def reports_view(request):
    available_months = [
        {"key": k, "label": v["month"]}
        for k, v in md.MONTHLY_REPORTS.items()
    ]
    month_key = request.GET.get("month", "2026-06")
    if month_key not in md.MONTHLY_REPORTS:
        month_key = "2026-06"
    report = md.MONTHLY_REPORTS[month_key]
    sections = _report_sections_with_ids(md.REPORT_SECTIONS)
    return render(request, "pages/reports.html", {
        "report": report,
        "report_sections": sections,
        "report_sections_json": json.dumps(sections, ensure_ascii=False),
        "available_months": available_months,
        "current_month": month_key,
        "page": "reports",
    })


@login_required
@require_http_methods(["POST"])
def fetch_lot_photo_view(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Невірний JSON"}, status=400)

    url = body.get("url", "").strip()
    if not url:
        return JsonResponse({"error": "URL не передано"}, status=400)

    if "auto-lot.com" not in url:
        return JsonResponse({"error": "Дозволено лише auto-lot.com"}, status=400)

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AutolotCRM/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return JsonResponse({"error": f"Не вдалося завантажити: {exc}"}, status=502)
    except Exception:
        return JsonResponse({"error": "Помилка при отриманні сторінки"}, status=502)

    pattern = r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
    matches = re.findall(pattern, html, re.IGNORECASE)
    image_url = next(
        (m for m in matches if any(ext in m.lower() for ext in (".jpg", ".jpeg", ".png", ".webp"))),
        None,
    )

    if not image_url:
        return JsonResponse({"error": "Фото не знайдено на сторінці"}, status=404)

    if image_url.startswith("//"):
        image_url = "https:" + image_url
    elif image_url.startswith("/"):
        image_url = "https://auto-lot.com" + image_url

    return JsonResponse({"image_url": image_url})


@login_required
def clients_view(request):
    return render(request, "pages/clients.html", {
        "clients": md.CLIENTS,
        "page": "clients",
    })


@login_required
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


@login_required
def carriers_view(request):
    return render(request, "pages/carriers.html", {
        "carriers": md.CARRIERS,
        "page": "carriers",
    })


@login_required
def money_view(request):
    debtors = [d for d in md.DEALS if d.get("debt", 0) > 0]
    return render(request, "pages/money.html", {
        "debtors": debtors,
        "page": "money",
    })


@login_required
def settings_view(request):
    return render(request, "pages/settings.html", {"page": "settings"})
