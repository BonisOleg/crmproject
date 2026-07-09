from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='timofiy@auto-lot.com',
            email='timofiy@auto-lot.com',
            password='AutoLot2026!',
            first_name='Тимофій',
        )

    def test_cockpit_requires_login(self):
        response = self.client.get(reverse('cockpit'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)

    def test_login_with_valid_credentials(self):
        response = self.client.post(reverse('login'), {
            'username': 'timofiy@auto-lot.com',
            'password': 'AutoLot2026!',
        })
        self.assertRedirects(response, reverse('cockpit'))

    def test_login_with_invalid_credentials(self):
        response = self.client.post(reverse('login'), {
            'username': 'timofiy@auto-lot.com',
            'password': 'wrong-password',
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Невірний email або пароль')

    def test_logout_clears_session(self):
        self.client.login(username='timofiy@auto-lot.com', password='AutoLot2026!')
        response = self.client.post(reverse('logout'))
        self.assertRedirects(response, reverse('login'))

class AdminAccessTests(TestCase):
    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            username='admin@auto-lot.com',
            email='admin@auto-lot.com',
            password='AdminLot2026!',
            first_name='Адмін',
        )

    def test_admin_can_login_to_crm(self):
        response = self.client.post(reverse('login'), {
            'username': 'admin@auto-lot.com',
            'password': 'AdminLot2026!',
        })
        self.assertRedirects(response, reverse('cockpit'))

    def test_admin_panel_requires_login(self):
        response = self.client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response.url)

    def test_superuser_can_open_admin_panel(self):
        self.client.login(username='admin@auto-lot.com', password='AdminLot2026!')
        response = self.client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 200)


class EnsureDemoUserCommandTests(TestCase):
    def test_command_creates_admin_and_demo_users(self):
        from django.core.management import call_command

        call_command('ensure_demo_user', verbosity=0)
        User = get_user_model()

        demo = User.objects.get(username='timofiy@auto-lot.com')
        admin = User.objects.get(username='admin@auto-lot.com')

        self.assertFalse(demo.is_superuser)
        self.assertTrue(demo.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.check_password('AdminLot2026!'))
