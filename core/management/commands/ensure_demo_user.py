import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


def ensure_user(email, password, first_name, *, is_superuser=False):
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
    user.set_password(password)
    user.save()

    return user, created


class Command(BaseCommand):
    help = 'Створює або оновлює demo та admin користувачів для входу в CRM'

    def handle(self, *args, **options):
        accounts = [
            {
                'email': os.environ.get('CRM_DEMO_EMAIL', 'timofiy@auto-lot.com'),
                'password': os.environ.get('CRM_DEMO_PASSWORD', 'AutoLot2026!'),
                'first_name': os.environ.get('CRM_DEMO_FIRST_NAME', 'Тимофій'),
                'is_superuser': False,
                'label': 'demo',
            },
            {
                'email': os.environ.get('CRM_ADMIN_EMAIL', 'admin@auto-lot.com'),
                'password': os.environ.get('CRM_ADMIN_PASSWORD', 'AdminLot2026!'),
                'first_name': os.environ.get('CRM_ADMIN_FIRST_NAME', 'Адмін'),
                'is_superuser': True,
                'label': 'admin',
            },
        ]

        for account in accounts:
            user, created = ensure_user(
                account['email'],
                account['password'],
                account['first_name'],
                is_superuser=account['is_superuser'],
            )
            action = 'Створено' if created else 'Оновлено'
            role = account['label']
            self.stdout.write(f'{action} {role}-користувача: {user.username}')
