"""Re-sync report ↔ deals for the current month."""

from django.core.management.base import BaseCommand

from core.services import backfill_deals_from_reports, refresh_current_report_rows


class Command(BaseCommand):
    help = 'Backfill deal money from report, then re-sync Won/Confirmed rows'

    def handle(self, *args, **options):
        healed = backfill_deals_from_reports()
        month = refresh_current_report_rows()
        self.stdout.write(
            self.style.SUCCESS(
                f'Healed {healed} deals from report; refreshed month {month.month_key}'
            )
        )
