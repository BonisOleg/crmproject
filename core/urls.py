from django.urls import path

from . import views

urlpatterns = [
    path("", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("cockpit/", views.cockpit_view, name="cockpit"),
    path("deals/", views.deals_view, name="deals"),
    path("deals/<str:deal_id>/", views.deal_detail_view, name="deal_detail"),
    path("reports/", views.reports_view, name="reports"),
    path("clients/", views.clients_view, name="clients"),
    path("leads/", views.leads_view, name="leads"),
    path("carriers/", views.carriers_view, name="carriers"),
    path("money/", views.money_view, name="money"),
    path("settings/", views.settings_view, name="settings"),
]
