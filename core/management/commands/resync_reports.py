"""Re-sync all active deals into monthly report rows."""

from django.core.management.base import BaseCommand

from core.models import Deal
from core.services import sync_deal_to_reports


class Command(BaseCommand):
    help = 'Re-sync active deals into Won/Confirmed report rows'

    def handle(self, *args, **options):
        deals = Deal.objects.filter(is_active=True)
        synced = 0
        for deal in deals.iterator():
            sync_deal_to_reports(deal)
            synced += 1
        self.stdout.write(self.style.SUCCESS(f'Synced {synced} deals'))
