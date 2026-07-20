"""CRM domain models — production source of truth."""

from django.conf import settings
from django.db import models


class Currency(models.TextChoices):
    CHF = 'CHF', 'CHF'
    EUR = 'EUR', 'EUR'
    USD = 'USD', 'USD'


class ExecutionStage(models.TextChoices):
    WON = 'won', 'Виграно'
    CONFIRMED = 'confirmed', 'Підтверджено'
    PICKED = 'picked', 'Забрано'
    IN_TRANSIT = 'in_transit', 'В дорозі'
    CUSTOMS = 'customs', 'Розмитнено'
    DELIVERED = 'delivered', 'Доставлено'


class PaymentStatus(models.TextChoices):
    UNPAID = 'unpaid', 'Не оплачено'
    PENDING = 'pending', 'Очікує'
    PARTIAL = 'partial', 'Частково'
    PAID = 'paid', 'Оплачено'
    WAITING = 'waiting', 'Очікує'
    DEBT = 'debt', 'Борг'


class DeliveryType(models.TextChoices):
    PICKUP = 'pickup', 'Самовивіз'
    THEIRS = 'theirs', 'Їх доставка'
    OURS = 'ours', 'Наша доставка'


class LeadStatus(models.TextChoices):
    NEW = 'new', 'Новий'
    SEARCHING = 'searching', 'У пошуку'
    REVIEW = 'review', 'Є кандидати'
    AGREED = 'agreed', 'Погоджено'
    NEGOTIATING = 'negotiating', 'Торгуємось'
    WON = 'won', 'Виграли'
    LOST = 'lost', 'Не виграли'
    CLOSED = 'closed', 'Закрито'


class CarrierStatus(models.TextChoices):
    PLANNING = 'planning', 'Планування'
    LOADING = 'loading', 'Завантаження'
    IN_TRANSIT = 'in_transit', 'В дорозі'
    ARRIVED = 'arrived', 'Прибув'
    DONE = 'done', 'Завершено'


class ReportType(models.TextChoices):
    WON = 'won', 'Виграні'
    CONFIRMED = 'confirmed', 'Підтверджені'


class SiteSettings(models.Model):
    commission_percent = models.DecimalField(max_digits=6, decimal_places=2, default=8)
    logistics_fixed_chf = models.DecimalField(max_digits=12, decimal_places=2, default=2800)
    rate_chf_uah = models.DecimalField(max_digits=12, decimal_places=4, default=47.2)
    rate_eur_uah = models.DecimalField(max_digits=12, decimal_places=4, default=44.85)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Налаштування сайту'
        verbose_name_plural = 'Налаштування сайту'

    def __str__(self):
        return 'SiteSettings'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Client(models.Model):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True)
    telegram = models.CharField(max_length=80, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    debt = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Deal(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    car = models.CharField(max_length=160)
    year = models.PositiveIntegerField(null=True, blank=True)
    client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='deals'
    )
    client_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    execution = models.CharField(
        max_length=20, choices=ExecutionStage.choices, default=ExecutionStage.WON
    )
    payment = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )
    price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    debt = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    won_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    bid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    delivery_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    commission = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    won_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    bid_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    cost_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    price_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    delivery_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    vin = models.CharField(max_length=64, blank=True)
    lot_url = models.URLField(blank=True)
    image = models.URLField(blank=True, max_length=500)
    logistics = models.JSONField(default=dict, blank=True)
    delivery_type = models.CharField(
        max_length=20, choices=DeliveryType.choices, default=DeliveryType.PICKUP
    )
    auction = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} · {self.car}'

    @property
    def execution_label(self):
        return self.get_execution_display()

    @property
    def payment_label(self):
        return self.get_payment_display()

    def recalc_money(self):
        price = self.price or 0
        paid = self.paid or 0
        cost = self.cost or 0
        self.debt = max(price - paid, 0)
        self.profit = max(price - cost, 0)
        if self.debt <= 0 and price > 0:
            self.payment = PaymentStatus.PAID
        elif paid > 0:
            self.payment = PaymentStatus.PARTIAL
        elif self.debt > 0:
            self.payment = PaymentStatus.DEBT
        else:
            self.payment = PaymentStatus.PENDING


class DealDuePayment(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='due_payments')
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    place = models.CharField(max_length=120, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


class Lead(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    client_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True)
    criteria = models.TextField(blank=True)
    manager = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=LeadStatus.choices, default=LeadStatus.NEW)
    candidates = models.PositiveIntegerField(default=0)
    request_date = models.DateField(null=True, blank=True)
    deal = models.ForeignKey(
        Deal, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-request_date', '-created_at']

    def __str__(self):
        return f'{self.code} · {self.client_name}'

    @property
    def status_label(self):
        return self.get_status_display()


class Carrier(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    driver = models.CharField(max_length=120)
    plate = models.CharField(max_length=40, blank=True)
    route = models.CharField(max_length=160, blank=True)
    cars = models.PositiveIntegerField(default=0)
    departure = models.DateField(null=True, blank=True)
    eta = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=CarrierStatus.choices, default=CarrierStatus.PLANNING
    )
    deals = models.ManyToManyField(Deal, blank=True, related_name='carriers')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-departure', '-created_at']

    def __str__(self):
        return f'{self.code} · {self.driver}'

    @property
    def status_label(self):
        return self.get_status_display()


class Document(models.Model):
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/%Y/%m/', blank=True)
    deal = models.ForeignKey(
        Deal, on_delete=models.CASCADE, null=True, blank=True, related_name='documents'
    )
    carrier = models.ForeignKey(
        Carrier, on_delete=models.CASCADE, null=True, blank=True, related_name='documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
    )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.name


class Payment(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    place = models.CharField(max_length=120, blank=True)
    paid_on = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-paid_on', '-created_at']

    def __str__(self):
        return f'{self.amount} {self.currency} · {self.deal_id}'


class ReportMonth(models.Model):
    month_key = models.CharField(max_length=7, unique=True, db_index=True)
    label = models.CharField(max_length=64, blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-month_key']

    def __str__(self):
        return self.label or self.month_key


class ReportRow(models.Model):
    month = models.ForeignKey(ReportMonth, on_delete=models.CASCADE, related_name='rows')
    report_type = models.CharField(max_length=20, choices=ReportType.choices)
    deal = models.ForeignKey(
        Deal, on_delete=models.SET_NULL, null=True, blank=True, related_name='report_rows'
    )
    car = models.CharField(max_length=160)
    client = models.CharField(max_length=160, blank=True)
    stage = models.CharField(max_length=40, blank=True)
    won_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    bid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    delivery_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    delivery_type = models.CharField(
        max_length=20, choices=DeliveryType.choices, default=DeliveryType.PICKUP
    )
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    won_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    bid_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    cost_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    price_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    delivery_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.CHF)
    is_manual = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [
            models.Index(fields=['month', 'report_type']),
        ]

    def __str__(self):
        return f'{self.report_type} · {self.car}'

    def recalc_profit(self):
        self.profit = max((self.price or 0) - (self.cost or 0), 0)
