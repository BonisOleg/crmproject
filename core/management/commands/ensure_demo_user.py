import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


def ensure_user(email, password, first_name, *, is_superuser=False, reset_password=True):
    User = get_user_model()
    email = email.strip().lower()

    user, created = User.objects.get_or_create(
        username=email,
        defaults={
            'email': email,
            'first_name': first_name,
            'is_staff': True,
            'is_superuser': is_superuser,
        },
    )

    user.email = email
    user.first_name = first_name
    user.is_staff = True
    user.is_superuser = is_superuser
    if created or reset_password:
        user.set_password(password)
    user.save()

    return user, created


class Command(BaseCommand):
    help = 'Створює або оновлює demo та admin користувачів для входу в CRM'

    def handle(self, *args, **options):
        is_prod = bool(
            os.environ.get('RENDER')
            or os.environ.get('RENDER_EXTERNAL_HOSTNAME')
            or os.environ.get('VERCEL')
        )
        force_reset = os.environ.get('CRM_FORCE_DEMO_PASSWORD', '').lower() in (
            '1', 'true', 'yes',
        )
        # У prod пароль з env застосовуємо лише при створенні, або з CRM_FORCE_DEMO_PASSWORD
        reset_existing = (not is_prod) or force_reset

        demo_password = os.environ.get('CRM_DEMO_PASSWORD')
        admin_password = os.environ.get('CRM_ADMIN_PASSWORD')

        if is_prod and not demo_password:
            self.stdout.write(
                self.style.WARNING('CRM_DEMO_PASSWORD не задано — demo-користувача пропущено')
            )
        if is_prod and not admin_password:
            self.stdout.write(
                self.style.WARNING('CRM_ADMIN_PASSWORD не задано — admin-користувача пропущено')
            )

        accounts = []
        if demo_password or not is_prod:
            accounts.append({
                'email': os.environ.get('CRM_DEMO_EMAIL', 'timofiy@auto-lot.com'),
                'password': demo_password or 'AutoLot2026!',
                'first_name': os.environ.get('CRM_DEMO_FIRST_NAME', 'Тимофій'),
                'is_superuser': False,
                'label': 'demo',
            })
        if admin_password or not is_prod:
            accounts.append({
                'email': os.environ.get('CRM_ADMIN_EMAIL', 'admin@auto-lot.com'),
                'password': admin_password or 'AdminLot2026!',
                'first_name': os.environ.get('CRM_ADMIN_FIRST_NAME', 'Адмін'),
                'is_superuser': True,
                'label': 'admin',
            })

        for account in accounts:
            user, created = ensure_user(
                account['email'],
                account['password'],
                account['first_name'],
                is_superuser=account['is_superuser'],
                reset_password=created or reset_existing,
            )
            action = 'Створено' if created else 'Оновлено'
            self.stdout.write(f'{action} {account["label"]}-користувача: {user.username}')
