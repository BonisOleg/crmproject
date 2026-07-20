from django.contrib import admin

from . import models


class DealDuePaymentInline(admin.TabularInline):
    model = models.DealDuePayment
    extra = 0


class DocumentInline(admin.TabularInline):
    model = models.Document
    extra = 0
    fk_name = 'deal'


@admin.register(models.SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = (
        'commission_percent', 'logistics_fixed_chf', 'rate_chf_uah', 'rate_eur_uah', 'updated_at',
    )

    def has_add_permission(self, request):
        return not models.SiteSettings.objects.exists()


@admin.register(models.Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'telegram', 'currency', 'debt', 'is_active')
    search_fields = ('name', 'phone', 'telegram')
    list_filter = ('currency', 'is_active')


@admin.register(models.Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'car', 'client_name', 'execution', 'payment', 'price', 'debt', 'is_active',
    )
    search_fields = ('code', 'car', 'client_name', 'vin', 'phone')
    list_filter = ('execution', 'payment', 'currency', 'is_active')
    inlines = [DealDuePaymentInline, DocumentInline]


@admin.register(models.Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('code', 'client_name', 'status', 'manager', 'request_date', 'is_active')
    search_fields = ('code', 'client_name', 'phone', 'criteria')
    list_filter = ('status', 'is_active')


class CarrierDocumentInline(admin.TabularInline):
    model = models.Document
    extra = 0
    fk_name = 'carrier'


@admin.register(models.Carrier)
class CarrierAdmin(admin.ModelAdmin):
    list_display = ('code', 'driver', 'route', 'status', 'cars', 'departure', 'is_active')
    search_fields = ('code', 'driver', 'plate', 'route')
    list_filter = ('status', 'is_active')
    filter_horizontal = ('deals',)
    inlines = [CarrierDocumentInline]


@admin.register(models.Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('deal', 'amount', 'currency', 'place', 'paid_on', 'created_by')
    list_filter = ('currency', 'paid_on')
    search_fields = ('deal__code', 'place')


@admin.register(models.Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('name', 'deal', 'carrier', 'uploaded_at', 'uploaded_by')
    search_fields = ('name',)


@admin.register(models.ReportMonth)
class ReportMonthAdmin(admin.ModelAdmin):
    list_display = ('month_key', 'label', 'is_archived', 'archived_at')
    list_filter = ('is_archived',)


@admin.register(models.ReportRow)
class ReportRowAdmin(admin.ModelAdmin):
    list_display = ('month', 'report_type', 'car', 'client', 'price', 'profit', 'deal')
    list_filter = ('report_type', 'month')
    search_fields = ('car', 'client', 'deal__code')
