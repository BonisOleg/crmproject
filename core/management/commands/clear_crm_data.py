"""Повне очищення бізнес-даних CRM (угоди, клієнти, ліди тощо). Юзерів не чіпає."""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import (
    Carrier,
    Client,
    Deal,
    DealDuePayment,
    Document,
    Lead,
    Payment,
    ReportMonth,
    ReportRow,
)


class Command(BaseCommand):
    help = 'Видаляє всі тестові/бізнес-дані CRM. Облікові записи (User) лишаються.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Підтвердити очищення без інтерактиву',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['yes']:
            self.stderr.write('Додайте --yes щоб підтвердити очищення')
            return

        counts = {
            'documents': Document.objects.all().delete()[0],
            'payments': Payment.objects.all().delete()[0],
            'due_payments': DealDuePayment.objects.all().delete()[0],
            'report_rows': ReportRow.objects.all().delete()[0],
            'report_months': ReportMonth.objects.all().delete()[0],
            'leads': Lead.objects.all().delete()[0],
            'carriers': Carrier.objects.all().delete()[0],
            'deals': Deal.objects.all().delete()[0],
            'clients': Client.objects.all().delete()[0],
        }
        for name, n in counts.items():
            self.stdout.write(f'- {name}: {n}')
        self.stdout.write(self.style.SUCCESS('CRM дані очищено'))
