"""Перевірки slim login / app-shell для PageSpeed."""

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from core.models import SiteSettings


class PerformanceShellTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='tester@auto-lot.com',
            email='tester@auto-lot.com',
            password='TestPass123!',
            is_staff=True,
        )
        self.client = Client()
        SiteSettings.get_solo()

    def test_login_page_is_slim(self):
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        html = resp.content.decode()
        self.assertNotIn('fonts.googleapis.com', html)
        self.assertNotIn('js/modal.js', html)
        self.assertNotIn('js/crm-report.js', html)
        self.assertNotIn('css/glass-fx.css', html)
        self.assertNotIn('animate-fade-up', html)
        self.assertNotIn('glow-orb', html)
        self.assertTrue(
            'css/pages/login.css' in html or 'css/bundles/crm-public.css' in html
        )
        self.assertTrue(
            'js/theme.js' in html or 'js/bundles/crm-public.js' in html
        )

    def test_app_shell_loads_catalog_via_api_not_html(self):
        self.client.login(username='tester@auto-lot.com', password='TestPass123!')
        resp = self.client.get('/cockpit/')
        self.assertEqual(resp.status_code, 200)
        html = resp.content.decode()
        self.assertIn('id="crm-deals-catalog">[]</script>', html)
        self.assertIn('id="crm-carriers-catalog">[]</script>', html)
        self.assertTrue(
            'js/modal.js' in html or 'js/bundles/crm-core.js' in html
        )
        self.assertNotIn('js/crm-report.js', html)
        self.assertNotIn('fonts.googleapis.com', html)

    def test_reports_page_loads_report_scripts(self):
        self.client.login(username='tester@auto-lot.com', password='TestPass123!')
        resp = self.client.get('/reports/won/')
        self.assertEqual(resp.status_code, 200)
        html = resp.content.decode()
        self.assertIn('js/crm-report.js', html)
        self.assertIn('js/crm-report-2.js', html)
