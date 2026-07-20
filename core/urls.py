from django.urls import path

from . import views

urlpatterns = [
    path("", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("cockpit/", views.cockpit_view, name="cockpit"),
    path("deals/", views.deals_view, name="deals"),
    path("deals/<str:deal_id>/", views.deal_detail_view, name="deal_detail"),
    path("reports/", views.reports_redirect_view, name="reports"),
    path("reports/won/", views.reports_won_view, name="reports_won"),
    path("reports/confirmed/", views.reports_confirmed_view, name="reports_confirmed"),
    path("reports/archive/", views.reports_archive_list_view, name="reports_archive"),
    path(
        "reports/archive/<str:month_key>/",
        views.reports_archive_month_view,
        name="reports_archive_month",
    ),
    path("clients/", views.clients_view, name="clients"),
    path("leads/", views.leads_view, name="leads"),
    path("carriers/", views.carriers_view, name="carriers"),
    path("carriers/<str:carrier_id>/", views.carrier_detail_view, name="carrier_detail"),
    path("money/", views.money_view, name="money"),
    path("settings/", views.settings_view, name="settings"),
    path("api/fetch-lot-photo/", views.fetch_lot_photo_view, name="fetch_lot_photo"),
]
