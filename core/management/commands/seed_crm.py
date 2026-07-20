"""Seed CRM entities from mock_data (one-time / demo)."""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from core import mock_data as md
from core.models import (
    Carrier,
    Client,
    Deal,
    DealDuePayment,
    Lead,
    ReportMonth,
    ReportRow,
    SiteSettings,
)
from core.services import month_label, sync_deal_to_reports, to_decimal


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


class Command(BaseCommand):
    help = 'Імпорт mock-даних у Postgres/SQLite (демо). Без --force не дублює існуючі коди.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Оновити існуючі записи за code',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options['force']
        SiteSettings.get_solo()

        clients_by_name = {}
        for row in md.CLIENTS:
            client, created = Client.objects.update_or_create(
                name=row['name'],
                defaults={
                    'phone': row.get('phone', ''),
                    'telegram': row.get('telegram', ''),
                    'currency': row.get('currency', 'CHF'),
                    'debt': to_decimal(row.get('debt')),
                    'is_active': True,
                },
            )
            clients_by_name[client.name] = client
            self.stdout.write(f'{"+" if created else "~"} client {client.name}')

        for row in md.DEALS:
            if Deal.objects.filter(code=row['id']).exists() and not force:
                self.stdout.write(f'= skip deal {row["id"]}')
                continue
            client = clients_by_name.get(row.get('client'))
            deal, created = Deal.objects.update_or_create(
                code=row['id'],
                defaults={
                    'car': row['car'],
                    'year': row.get('year') or None,
                    'client': client,
                    'client_name': row.get('client', ''),
                    'phone': row.get('phone', ''),
                    'execution': row.get('execution', 'won'),
                    'payment': row.get('payment', 'pending'),
                    'price': to_decimal(row.get('price')),
                    'paid': to_decimal(row.get('paid')),
                    'debt': to_decimal(row.get('debt')),
                    'profit': to_decimal(row.get('profit')),
                    'won_price': to_decimal(row.get('won_price')),
                    'bid': to_decimal(row.get('bid')),
                    'cost': to_decimal(row.get('cost')),
                    'delivery_cost': to_decimal(row.get('delivery_cost')),
                    'commission': to_decimal(row.get('commission')),
                    'currency': row.get('currency', 'CHF'),
                    'won_currency': row.get('won_currency', 'CHF'),
                    'bid_currency': row.get('bid_currency', 'CHF'),
                    'cost_currency': row.get('cost_currency', 'CHF'),
                    'price_currency': row.get('price_currency', 'CHF'),
                    'delivery_currency': row.get('delivery_currency', 'CHF'),
                    'vin': row.get('vin', ''),
                    'lot_url': row.get('lot_url', ''),
                    'image': row.get('image', ''),
                    'logistics': row.get('logistics') or {},
                    'delivery_type': row.get('delivery_type', 'pickup'),
                    'auction': row.get('auction', ''),
                    'notes': row.get('notes', ''),
                    'is_active': True,
                },
            )
            deal.due_payments.all().delete()
            for idx, due in enumerate(row.get('due_payments') or []):
                DealDuePayment.objects.create(
                    deal=deal,
                    amount=to_decimal(due.get('amount')),
                    place=due.get('place', ''),
                    sort_order=idx,
                )
            sync_deal_to_reports(deal)
            self.stdout.write(f'{"+" if created else "~"} deal {deal.code}')

        for row in md.LEADS:
            if Lead.objects.filter(code=row['id']).exists() and not force:
                self.stdout.write(f'= skip lead {row["id"]}')
                continue
            deal = None
            if row.get('deal_id'):
                deal = Deal.objects.filter(code=row['deal_id']).first()
            Lead.objects.update_or_create(
                code=row['id'],
                defaults={
                    'client_name': row.get('client', ''),
                    'phone': row.get('phone', ''),
                    'criteria': row.get('criteria', ''),
                    'manager': row.get('manager', ''),
                    'status': row.get('status', 'new'),
                    'candidates': row.get('candidates', 0),
                    'request_date': _parse_date(row.get('date')),
                    'deal': deal,
                    'is_active': True,
                },
            )
            self.stdout.write(f'~ lead {row["id"]}')

        for row in md.CARRIERS:
            if Carrier.objects.filter(code=row['id']).exists() and not force:
                self.stdout.write(f'= skip carrier {row["id"]}')
                continue
            carrier, _ = Carrier.objects.update_or_create(
                code=row['id'],
                defaults={
                    'driver': row.get('driver', ''),
                    'plate': row.get('plate', ''),
                    'route': row.get('route', ''),
                    'cars': row.get('cars', 0),
                    'departure': _parse_date(row.get('departure')),
                    'eta': _parse_date(row.get('eta')),
                    'status': row.get('status', 'planning'),
                    'is_active': True,
                },
            )
            deals = Deal.objects.filter(code__in=row.get('assigned_deals') or [])
            carrier.deals.set(deals)
            self.stdout.write(f'~ carrier {carrier.code}')

        for month_key, sections in (md.REPORTS_BY_MONTH or {}).items():
            month, _ = ReportMonth.objects.get_or_create(
                month_key=month_key,
                defaults={
                    'label': (md.MONTHLY_REPORTS.get(month_key) or {}).get(
                        'month', month_label(month_key)
                    ),
                    'is_archived': month_key < date.today().strftime('%Y-%m'),
                },
            )
            for report_type, rows in (sections or {}).items():
                for row in rows or []:
                    deal = None
                    if row.get('deal_id'):
                        deal = Deal.objects.filter(code=row['deal_id']).first()
                        if deal and ReportRow.objects.filter(
                            deal=deal, month=month, report_type=report_type
                        ).exists():
                            continue
                    ReportRow.objects.create(
                        month=month,
                        report_type=report_type,
                        deal=deal,
                        car=row.get('car', ''),
                        client=row.get('client', ''),
                        stage=row.get('stage', ''),
                        won_price=to_decimal(row.get('won_price')),
                        bid=to_decimal(row.get('bid')),
                        cost=to_decimal(row.get('cost')),
                        price=to_decimal(row.get('price')),
                        delivery_cost=to_decimal(row.get('delivery_cost')),
                        profit=to_decimal(row.get('profit')),
                        delivery_type=row.get('delivery_type', 'pickup'),
                        currency=row.get('currency', 'CHF'),
                        won_currency=row.get('won_currency', 'CHF'),
                        bid_currency=row.get('bid_currency', 'CHF'),
                        cost_currency=row.get('cost_currency', 'CHF'),
                        price_currency=row.get('price_currency', 'CHF'),
                        delivery_currency=row.get('delivery_currency', 'CHF'),
                        is_manual=not bool(deal),
                    )

        self.stdout.write(self.style.SUCCESS('Seed CRM завершено'))
