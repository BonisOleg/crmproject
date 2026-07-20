import json
import re
import urllib.error
import urllib.request

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_http_methods

from . import mock_data as md

_MONTH_UA = {
    1: "Січень",
    2: "Лютий",
    3: "Березень",
    4: "Квітень",
    5: "Травень",
    6: "Червень",
    7: "Липень",
    8: "Серпень",
    9: "Вересень",
    10: "Жовтень",
    11: "Листопад",
    12: "Грудень",
}


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
    deal = next((d for d in md.DEALS if d["id"] == deal_id), None)
    if deal is None:
        deal = {
            "id": deal_id,
            "car": "",
            "year": "",
            "client": "",
            "phone": "",
            "vin": "",
            "execution": "won",
            "execution_label": "Виграно",
            "payment": "pending",
            "payment_label": "Очікує",
            "price": 0,
            "paid": 0,
            "debt": 0,
            "currency": "CHF",
            "profit": 0,
            "lot_url": "",
            "image": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&h=260&fit=crop",
            "logistics": {
                "confirmed": None,
                "picked": None,
                "transit": None,
                "customs": None,
                "delivered": None,
            },
            "delivery_type": "pickup",
            "auction": "BCP",
            "won_price": 0,
            "bid": 0,
            "cost": 0,
            "delivery_cost": 0,
            "commission": 0,
            "won_currency": "CHF",
            "bid_currency": "CHF",
            "cost_currency": "CHF",
            "price_currency": "CHF",
            "delivery_currency": "CHF",
            "due_payments": [],
            "documents": [],
            "notes": "",
        }
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


def _current_month_key():
    return timezone.localdate().strftime("%Y-%m")


def _month_label(month_key):
    meta = md.MONTHLY_REPORTS.get(month_key)
    if meta:
        return meta["month"]
    try:
        year, month = month_key.split("-")
        return f"{_MONTH_UA[int(month)]} {year}"
    except (ValueError, KeyError, TypeError):
        return month_key


def _report_rows_with_ids(rows, prefix="RPT"):
    out = []
    for index, row in enumerate(rows, start=1):
        row_id = row.get("id") or f"{prefix}-{index:03d}"
        out.append({**row, "id": row_id})
    return out


def _get_report_rows(month_key, report_type):
    by_month = md.REPORTS_BY_MONTH.get(month_key) or {}
    rows = by_month.get(report_type) or []
    return _report_rows_with_ids(rows, prefix=f"{report_type[:3].upper()}-{month_key}")


def _report_context(report_type, month_key, *, readonly=False, is_archive=False):
    rows = _get_report_rows(month_key, report_type)
    label = md.REPORT_TYPE_LABELS.get(report_type, report_type)
    month_label = _month_label(month_key)
    return {
        "report_type": report_type,
        "report_type_label": label,
        "month_key": month_key,
        "month_label": month_label,
        "report_rows": rows,
        "report_rows_json": json.dumps(rows, ensure_ascii=False),
        "deal_count": len(rows),
        "readonly": readonly,
        "is_archive": is_archive,
        "active_month_key": _current_month_key(),
        "page": "reports",
    }


@login_required
def reports_redirect_view(request):
    return redirect("reports_won")


@login_required
def reports_won_view(request):
    month_key = _current_month_key()
    ctx = _report_context("won", month_key, readonly=False, is_archive=False)
    return render(request, "pages/reports_current.html", ctx)


@login_required
def reports_confirmed_view(request):
    month_key = _current_month_key()
    ctx = _report_context("confirmed", month_key, readonly=False, is_archive=False)
    return render(request, "pages/reports_current.html", ctx)


@login_required
def reports_archive_list_view(request):
    active = _current_month_key()
    archive_months = []
    for key, meta in md.MONTHLY_REPORTS.items():
        if key == active:
            continue
        won_count = len((md.REPORTS_BY_MONTH.get(key) or {}).get("won") or [])
        conf_count = len((md.REPORTS_BY_MONTH.get(key) or {}).get("confirmed") or [])
        archive_months.append({
            "key": key,
            "label": meta["month"],
            "deal_count": won_count + conf_count,
            "won_count": won_count,
            "confirmed_count": conf_count,
        })
    archive_months.sort(key=lambda item: item["key"], reverse=True)
    return render(request, "pages/reports_archive.html", {
        "archive_months": archive_months,
        "archive_month": None,
        "report_type": None,
        "is_archive": True,
        "readonly": True,
        "active_month_key": active,
        "page": "reports",
    })


@login_required
def reports_archive_month_view(request, month_key):
    active = _current_month_key()
    if month_key == active or month_key not in md.REPORTS_BY_MONTH:
        raise Http404("Місяць не знайдено в архіві")

    report_type = request.GET.get("type", "won")
    if report_type not in ("won", "confirmed"):
        report_type = "won"

    ctx = _report_context(report_type, month_key, readonly=True, is_archive=True)
    archive_months = [
        {"key": k, "label": v["month"]}
        for k, v in md.MONTHLY_REPORTS.items()
        if k != active
    ]
    archive_months.sort(key=lambda item: item["key"], reverse=True)
    ctx["archive_months"] = archive_months
    ctx["archive_month"] = month_key
    return render(request, "pages/reports_archive.html", ctx)


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

    og_match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if not og_match:
        og_match = re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            html,
            re.IGNORECASE,
        )

    pattern = r'(?:src|data-src)=["\']([^"\']+)["\']'
    matches = re.findall(pattern, html, re.IGNORECASE)
    image_candidates = [
        m for m in matches
        if any(ext in m.lower() for ext in (".jpg", ".jpeg", ".png", ".webp"))
        and "logo" not in m.lower()
        and "icon" not in m.lower()
    ]

    image_url = None
    if og_match:
        image_url = og_match.group(1)
    elif image_candidates:
        image_url = image_candidates[0]

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
def carrier_detail_view(request, carrier_id):
    carrier = next((c for c in md.CARRIERS if c["id"] == carrier_id), None)
    if carrier is None:
        carrier = {
            "id": carrier_id,
            "route": "",
            "status": "loading",
            "status_label": "Завантаження",
            "cars": 0,
            "departure": "",
            "eta": "",
            "driver": "",
            "plate": "",
            "assigned_deals": [],
            "documents": [],
        }
    carrier = {
        **carrier,
        "assigned_deals": carrier.get("assigned_deals", []),
        "documents": carrier.get("documents", []),
    }
    return render(request, "pages/carrier_detail.html", {
        "carrier": carrier,
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
