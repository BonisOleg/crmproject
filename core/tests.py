"""API і моделі CRM — smoke tests."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from core.models import Deal, Payment, ReportRow, SiteSettings
from core.services import sync_deal_to_reports


class CrmApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='tester@auto-lot.com',
            email='tester@auto-lot.com',
            password='TestPass123!',
            is_staff=True,
        )
        self.client = Client()
        self.client.login(username='tester@auto-lot.com', password='TestPass123!')
        SiteSettings.get_solo()

    def test_healthz_public(self):
        anon = Client()
        resp = anon.get('/healthz/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['ok'])

    def test_healthz_ignores_bad_host(self):
        """Render probe з «чужим» Host не має давати 400."""
        anon = Client(HTTP_HOST='invalid.internal.render')
        resp = anon.get('/healthz/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['ok'])

    def test_api_requires_auth(self):
        anon = Client()
        resp = anon.get('/api/deals/')
        self.assertIn(resp.status_code, (302, 401, 403))

    def test_deal_crud_and_report_sync(self):
        resp = self.client.post(
            '/api/deals/',
            data={
                'car': 'BMW Test',
                'client': 'Тест Клієнт',
                'phone': '+380671234567',
                'price': 10000,
                'paid': 0,
                'cost': 8000,
                'execution': 'won',
                'currency': 'CHF',
            },
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        data = resp.json()['data']
        code = data['id']
        deal = Deal.objects.get(code=code)
        self.assertEqual(deal.debt, Decimal('10000'))
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='won').exists()
        )

        resp = self.client.patch(
            f'/api/deals/{code}/',
            data={'execution': 'confirmed', 'paid': 2000},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        deal.refresh_from_db()
        self.assertEqual(deal.execution, 'confirmed')
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='won', is_manual=False).exists()
        )
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='confirmed').exists()
        )

    def test_delivered_stays_in_both_report_tabs(self):
        deal = Deal.objects.create(
            code='AL-2026-888',
            car='Skoda Test',
            client_name='Клієнт',
            price=Decimal('5000'),
            paid=Decimal('0'),
            debt=Decimal('5000'),
            cost=Decimal('4000'),
            execution='delivered',
        )
        sync_deal_to_reports(deal)
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='won', is_manual=False).exists()
        )
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='confirmed', is_manual=False).exists()
        )

    def test_won_excluded_from_receivable(self):
        from core.services import cockpit_stats

        Deal.objects.create(
            code='AL-2026-777',
            car='Won Only',
            client_name='Клієнт',
            price=Decimal('3000'),
            paid=Decimal('0'),
            debt=Decimal('3000'),
            cost=Decimal('2000'),
            execution='won',
        )
        Deal.objects.create(
            code='AL-2026-776',
            car='Confirmed Debt',
            client_name='Клієнт',
            price=Decimal('4000'),
            paid=Decimal('1000'),
            debt=Decimal('3000'),
            cost=Decimal('2500'),
            execution='confirmed',
        )
        stats = {s['id']: s for s in cockpit_stats()}
        self.assertEqual(stats['receivable']['raw'], 3000.0)

    def test_payment_updates_debt(self):
        deal = Deal.objects.create(
            code='AL-2026-999',
            car='Audi Test',
            client_name='Клієнт',
            price=Decimal('5000'),
            paid=Decimal('0'),
            debt=Decimal('5000'),
            cost=Decimal('4000'),
            execution='won',
        )
        sync_deal_to_reports(deal)
        resp = self.client.post(
            '/api/payments/',
            data={
                'dealId': deal.code,
                'amount': 1500,
                'currency': 'CHF',
                'place': 'Офіс',
                'date': '2026-07-20',
            },
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        deal.refresh_from_db()
        self.assertEqual(deal.paid, Decimal('1500'))
        self.assertEqual(deal.debt, Decimal('3500'))
        self.assertEqual(Payment.objects.filter(deal=deal).count(), 1)

    def test_settings_get_patch(self):
        resp = self.client.get('/api/settings/')
        self.assertEqual(resp.status_code, 200)
        resp = self.client.patch(
            '/api/settings/',
            data={'commission_percent': 9.5},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(float(resp.json()['data']['commission_percent']), 9.5)

    def test_account_forbidden_for_regular_staff(self):
        resp = self.client.get('/api/account/')
        self.assertEqual(resp.status_code, 403)

    def test_account_superuser_can_change_email_and_password(self):
        User = get_user_model()
        admin = User.objects.create_superuser(
            username='admin@auto-lot.com',
            email='admin@auto-lot.com',
            password='AdminOld123!',
        )
        client = Client()
        self.assertTrue(client.login(username='admin@auto-lot.com', password='AdminOld123!'))

        resp = client.patch(
            '/api/account/',
            data={
                'email': 'new-admin@auto-lot.com',
                'current_password': 'AdminOld123!',
                'new_password': 'AdminNew123!',
                'new_password_confirm': 'AdminNew123!',
            },
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()['data']['email'], 'new-admin@auto-lot.com')
        admin.refresh_from_db()
        self.assertEqual(admin.username, 'new-admin@auto-lot.com')
        self.assertTrue(admin.check_password('AdminNew123!'))

    def test_account_timofiy_can_manage(self):
        User = get_user_model()
        User.objects.create_user(
            username='timofiy@auto-lot.com',
            email='timofiy@auto-lot.com',
            password='DemoOld123!',
            is_staff=True,
            first_name='Тимофій',
        )
        client = Client()
        self.assertTrue(client.login(username='timofiy@auto-lot.com', password='DemoOld123!'))
        resp = client.get('/api/account/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['data']['can_manage'])

    def test_monthly_profit_from_report_confirmed_or_paid(self):
        from core.services import cockpit_stats, get_or_create_month

        month = get_or_create_month()
        won_only = Deal.objects.create(
            code='AL-2026-701',
            car='Won Only Profit',
            client_name='Клієнт',
            price=Decimal('10000'),
            cost=Decimal('8000'),
            profit=Decimal('2000'),
            execution='won',
            payment='debt',
        )
        confirmed = Deal.objects.create(
            code='AL-2026-702',
            car='Confirmed Profit',
            client_name='Клієнт',
            price=Decimal('0'),
            cost=Decimal('0'),
            profit=Decimal('0'),
            execution='confirmed',
            payment='debt',
        )
        paid = Deal.objects.create(
            code='AL-2026-703',
            car='Paid Profit',
            client_name='Клієнт',
            price=Decimal('0'),
            cost=Decimal('0'),
            profit=Decimal('0'),
            execution='won',
            payment='paid',
        )
        sync_deal_to_reports(won_only)
        sync_deal_to_reports(confirmed)
        sync_deal_to_reports(paid)

        ReportRow.objects.filter(deal=confirmed, report_type='won', month=month).update(
            price=Decimal('5000'),
            cost=Decimal('4000'),
            profit=Decimal('1000'),
        )
        ReportRow.objects.filter(deal=paid, report_type='won', month=month).update(
            price=Decimal('3000'),
            cost=Decimal('2500'),
            profit=Decimal('500'),
        )

        stats = {s['id']: s for s in cockpit_stats()}
        self.assertEqual(stats['profit']['raw'], 1500.0)

    def test_report_patch_syncs_deal_money(self):
        deal = Deal.objects.create(
            code='AL-2026-704',
            car='Empty Deal',
            client_name='Клієнт',
            price=Decimal('0'),
            cost=Decimal('0'),
            profit=Decimal('0'),
            execution='confirmed',
        )
        sync_deal_to_reports(deal)
        row = ReportRow.objects.get(deal=deal, report_type='won')
        resp = self.client.patch(
            f'/api/reports/rows/{row.pk}/',
            data={'price': 4800, 'cost': 4012},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        deal.refresh_from_db()
        self.assertEqual(deal.price, Decimal('4800'))
        self.assertEqual(deal.cost, Decimal('4012'))
        self.assertEqual(deal.profit, Decimal('788'))
