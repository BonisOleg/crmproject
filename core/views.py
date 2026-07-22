import json
import re
import socket
import urllib.error
import urllib.request
from ipaddress import ip_address
from urllib.parse import urlparse

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_http_methods

from . import mock_data as md
from .models import Carrier, Client, Deal, Lead, Payment, ReportMonth, SiteSettings
from .serializers import (
    serialize_carrier,
    serialize_client,
    serialize_deal,
    serialize_lead,
    serialize_payment,
    serialize_report_row,
    serialize_settings,
)
from .services import (
    CONFIRMED_AND_BELOW,
    action_queues,
    archive_previous_months,
    attention_subtitle,
    cockpit_stats,
    current_month_key,
    get_or_create_month,
    month_label,
    refresh_current_report_rows,
)


@require_http_methods(['GET', 'POST'])
def login_view(request):
    if request.user.is_authenticated:
        return redirect('cockpit')

    error = None
    username = ''

    if request.method == 'POST':
        username = request.POST.get('username', '').strip().lower()
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            next_url = request.POST.get('next') or request.GET.get('next')
            if next_url and url_has_allowed_host_and_scheme(
                next_url,
                allowed_hosts={request.get_host()},
                require_https=request.is_secure(),
            ):
                return redirect(next_url)
            return redirect('cockpit')

        error = 'Невірний email або пароль.'

    return render(request, 'pages/login.html', {
        'error': error,
        'username': username,
    })


@require_http_methods(['POST'])
def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def cockpit_view(request):
    deals = list(
        Deal.objects.filter(is_active=True)
        .prefetch_related('due_payments', 'documents', 'client')[:8]
    )
    pipeline = [
        {
            **stage,
            'count': Deal.objects.filter(
                is_active=True, execution=stage['key']
            ).count(),
        }
        for stage in md.EXECUTION_STAGES
    ]
    stats = [s for s in cockpit_stats() if s['id'] != 'deals_total']
    display_name = (request.user.first_name or request.user.get_username() or '').strip()
    return render(request, 'pages/cockpit.html', {
        'stats': stats,
        'queues': action_queues(),
        'pipeline': pipeline,
        'recent_deals': [serialize_deal(d) for d in deals[:4]],
        'attention_text': attention_subtitle(),
        'cockpit_name': display_name or 'власника',
        'page': 'cockpit',
    })


@login_required
def deals_view(request):
    view_mode = request.GET.get('view', 'cards')
    qs = Deal.objects.filter(is_active=True).prefetch_related(
        'due_payments', 'documents', 'client'
    )
    deals = [serialize_deal(d) for d in qs]
    stages = [
        {
            **stage,
            'count': sum(1 for deal in deals if deal['execution'] == stage['key']),
        }
        for stage in md.EXECUTION_STAGES
    ]
    return render(request, 'pages/deals.html', {
        'deals': deals,
        'view_mode': view_mode,
        'stages': stages,
        'page': 'deals',
    })


@login_required
def deal_detail_view(request, deal_id):
    deal_obj = Deal.objects.filter(code=deal_id, is_active=True).prefetch_related(
        'due_payments', 'documents', 'payments', 'client'
    ).first()
    if deal_obj is None:
        raise Http404('Угоду не знайдено')
    deal = serialize_deal(deal_obj)
    payments = [serialize_payment(p) for p in deal_obj.payments.all()[:20]]
    if not payments:
        payments = md.PAYMENTS_SAMPLE
    settings_obj = SiteSettings.get_solo()
    price_breakdown = [
        {'label': 'Виграш', 'amount': deal.get('won_price') or 0},
        {'label': 'Комісія', 'amount': deal.get('commission') or 0},
        {'label': 'Логістика', 'amount': deal.get('delivery_cost') or 0},
        {'label': 'Собівартість', 'amount': deal.get('cost') or 0},
    ]
    return render(request, 'pages/deal_detail.html', {
        'deal': deal,
        'stages': md.EXECUTION_STAGES,
        'payments': payments,
        'price_breakdown': price_breakdown,
        'site_settings': serialize_settings(settings_obj),
        'page': 'deals',
    })


def _report_context(report_type, month_key, *, readonly=False, is_archive=False):
    month = get_or_create_month(month_key)
    rows = [
        serialize_report_row(r)
        for r in month.rows.filter(report_type=report_type).select_related('deal')
    ]
    return {
        'report_type': report_type,
        'report_type_label': md.REPORT_TYPE_LABELS.get(report_type, report_type),
        'month_key': month.month_key,
        'month_label': month.label or month_label(month.month_key),
        'report_rows': rows,
        'report_rows_json': json.dumps(rows, ensure_ascii=False),
        'deal_count': len(rows),
        'readonly': readonly or month.is_archived,
        'is_archive': is_archive or month.is_archived,
        'active_month_key': current_month_key(),
        'page': 'reports',
    }


@login_required
def reports_redirect_view(request):
    archive_previous_months()
    return redirect('reports_won')


@login_required
def reports_won_view(request):
    archive_previous_months()
    refresh_current_report_rows()
    return render(
        request,
        'pages/reports_current.html',
        _report_context('won', current_month_key()),
    )


@login_required
def reports_confirmed_view(request):
    archive_previous_months()
    refresh_current_report_rows()
    return render(
        request,
        'pages/reports_current.html',
        _report_context('confirmed', current_month_key()),
    )


@login_required
def reports_archive_list_view(request):
    active = current_month_key()
    archive_months = []
    for month in ReportMonth.objects.exclude(month_key=active).order_by('-month_key'):
        won = month.rows.filter(report_type='won').count()
        conf = month.rows.filter(report_type='confirmed').count()
        archive_months.append({
            'key': month.month_key,
            'label': month.label or month_label(month.month_key),
            'deal_count': won + conf,
            'won_count': won,
            'confirmed_count': conf,
        })
    return render(request, 'pages/reports_archive.html', {
        'archive_months': archive_months,
        'archive_month': None,
        'report_type': None,
        'is_archive': True,
        'readonly': True,
        'active_month_key': active,
        'page': 'reports',
    })


@login_required
def reports_archive_month_view(request, month_key):
    active = current_month_key()
    if month_key == active:
        raise Http404('Місяць не знайдено в архіві')
    month = ReportMonth.objects.filter(month_key=month_key).first()
    if month is None:
        raise Http404('Місяць не знайдено в архіві')

    report_type = request.GET.get('type', 'won')
    if report_type not in ('won', 'confirmed'):
        report_type = 'won'

    ctx = _report_context(report_type, month_key, readonly=True, is_archive=True)
    archive_months = [
        {'key': m.month_key, 'label': m.label or month_label(m.month_key)}
        for m in ReportMonth.objects.exclude(month_key=active).order_by('-month_key')
    ]
    ctx['archive_months'] = archive_months
    ctx['archive_month'] = month_key
    return render(request, 'pages/reports_archive.html', ctx)


_ALLOWED_LOT_HOSTS = {'auto-lot.com', 'www.auto-lot.com'}


def _is_public_ip(host):
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            ip = ip_address(info[4][0])
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return False
    return True


@login_required
@require_http_methods(['POST'])
def fetch_lot_photo_view(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Невірний JSON'}, status=400)

    url = (body.get('url') or '').strip()
    if not url:
        return JsonResponse({'ok': False, 'error': 'URL не передано'}, status=400)

    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return JsonResponse({'ok': False, 'error': 'Лише http/https'}, status=400)
    host = (parsed.hostname or '').lower()
    if host not in _ALLOWED_LOT_HOSTS:
        return JsonResponse({'ok': False, 'error': 'Дозволено лише auto-lot.com'}, status=400)
    if not _is_public_ip(host):
        return JsonResponse({'ok': False, 'error': 'Небезпечний хост'}, status=400)

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; AutolotCRM/1.0)'},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310
            if resp.status >= 400:
                return JsonResponse({'ok': False, 'error': 'Сторінка недоступна'}, status=502)
            html = resp.read(500_000).decode('utf-8', errors='replace')
    except urllib.error.URLError as exc:
        return JsonResponse({'ok': False, 'error': f'Не вдалося завантажити: {exc}'}, status=502)
    except Exception:
        return JsonResponse({'ok': False, 'error': 'Помилка при отриманні сторінки'}, status=502)

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

    matches = re.findall(r'(?:src|data-src)=["\']([^"\']+)["\']', html, re.IGNORECASE)
    image_candidates = [
        m for m in matches
        if any(ext in m.lower() for ext in ('.jpg', '.jpeg', '.png', '.webp'))
        and 'logo' not in m.lower()
        and 'icon' not in m.lower()
    ]

    image_url = None
    if og_match:
        image_url = og_match.group(1)
    elif image_candidates:
        image_url = image_candidates[0]

    if not image_url:
        return JsonResponse({'ok': False, 'error': 'Фото не знайдено на сторінці'}, status=404)

    if image_url.startswith('//'):
        image_url = 'https:' + image_url
    elif image_url.startswith('/'):
        image_url = 'https://auto-lot.com' + image_url

    return JsonResponse({'ok': True, 'image_url': image_url, 'data': {'image_url': image_url}})


@login_required
def clients_view(request):
    clients = [serialize_client(c) for c in Client.objects.filter(is_active=True)]
    return render(request, 'pages/clients.html', {
        'clients': clients,
        'page': 'clients',
    })


@login_required
def leads_view(request):
    status_order = {s['key']: i for i, s in enumerate(md.LEAD_STATUSES)}
    valid_statuses = {s['key'] for s in md.LEAD_STATUSES}
    counts = {s['key']: 0 for s in md.LEAD_STATUSES}
    active_keys = {'new', 'searching', 'review', 'agreed', 'negotiating'}

    enriched = []
    active_count = 0
    for lead_obj in Lead.objects.filter(is_active=True).select_related('deal'):
        lead = serialize_lead(lead_obj)
        lead['status_index'] = status_order.get(lead['status'], 0)
        enriched.append(lead)
        counts[lead['status']] = counts.get(lead['status'], 0) + 1
        if lead['status'] in active_keys:
            active_count += 1

    statuses = [{**stage, 'count': counts.get(stage['key'], 0)} for stage in md.LEAD_STATUSES]
    active_status = request.GET.get('status') or 'all'
    if active_status != 'all' and active_status not in valid_statuses:
        active_status = 'all'

    return render(request, 'pages/leads.html', {
        'leads': enriched,
        'lead_statuses': statuses,
        'total_leads': len(enriched),
        'active_count': active_count,
        'won_count': counts.get('won', 0),
        'active_status': active_status,
        'page': 'leads',
    })


@login_required
def carriers_view(request):
    carriers = [
        serialize_carrier(c)
        for c in Carrier.objects.filter(is_active=True).prefetch_related('deals', 'documents')
    ]
    return render(request, 'pages/carriers.html', {
        'carriers': carriers,
        'page': 'carriers',
    })


@login_required
def carrier_detail_view(request, carrier_id):
    carrier_obj = get_object_or_404(
        Carrier.objects.prefetch_related('deals', 'documents'),
        code=carrier_id,
        is_active=True,
    )
    return render(request, 'pages/carrier_detail.html', {
        'carrier': serialize_carrier(carrier_obj),
        'page': 'carriers',
    })


@login_required
def money_view(request):
    stats_by_id = {s['id']: s for s in cockpit_stats()}
    debtors = [
        serialize_deal(d)
        for d in Deal.objects.filter(
            is_active=True,
            debt__gt=0,
            execution__in=CONFIRMED_AND_BELOW,
        ).prefetch_related(
            'due_payments', 'documents', 'client'
        )
    ]
    return render(request, 'pages/money.html', {
        'debtors': debtors,
        'receivable': stats_by_id.get('receivable'),
        'profit': stats_by_id.get('profit'),
        'in_transit': stats_by_id.get('in_transit_money'),
        'deals_total': stats_by_id.get('deals_total'),
        'page': 'money',
    })


@login_required
def settings_view(request):
    from .account import can_manage_account, serialize_account

    ctx = {
        'page': 'settings',
        'site_settings': serialize_settings(SiteSettings.get_solo()),
        'can_manage_account': can_manage_account(request.user),
        'account': serialize_account(request.user),
    }
    return render(request, 'pages/settings.html', ctx)