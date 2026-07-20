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
        self.assertFalse(
            ReportRow.objects.filter(deal=deal, report_type='won', is_manual=False).exists()
        )
        self.assertTrue(
            ReportRow.objects.filter(deal=deal, report_type='confirmed').exists()
        )

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
