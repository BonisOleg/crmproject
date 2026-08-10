from django.db import migrations, models
from django.db.models import F


def backfill_won_at_and_profit(apps, schema_editor):
    Deal = apps.get_model('core', 'Deal')
    ReportMonth = apps.get_model('core', 'ReportMonth')
    ReportRow = apps.get_model('core', 'ReportRow')
    from django.db.models import Q, Sum

    Deal.objects.filter(won_at__isnull=True).update(won_at=F('created_at'))

    CONFIRMED = ('confirmed', 'picked', 'in_transit', 'customs', 'delivered')
    for month in ReportMonth.objects.filter(is_archived=True, finalized_profit=0):
        total = (
            ReportRow.objects.filter(month=month, report_type='won')
            .filter(
                Q(deal__isnull=True, is_manual=True)
                | Q(deal__execution__in=CONFIRMED)
                | Q(deal__payment='paid')
            )
            .aggregate(s=Sum('profit'))
            .get('s')
            or 0
        )
        month.finalized_profit = total
        month.save(update_fields=['finalized_profit'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='deal',
            name='won_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Момент виграшу (для grace 35 днів і атрибуції звіту)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='reportmonth',
            name='finalized_profit',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Зафіксований прибуток на момент архівації місяця',
                max_digits=14,
            ),
        ),
        migrations.RunPython(backfill_won_at_and_profit, migrations.RunPython.noop),
    ]
