import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


def ensure_user(email, password, first_name, *, is_superuser=False, reset_password=False):
    """Створює юзера лише якщо його (і «заміни») ще немає. Пароль з env — create/FORCE."""
    User = get_user_model()
    email = email.strip().lower()

    user = User.objects.filter(username=email).first()
    if user is None:
        # Логін уже змінили в CRM — не створюємо дублікат зі старого env-email.
        if is_superuser and User.objects.filter(is_superuser=True).exists():
            return None, False, 'skip'
        if (
            not is_superuser
            and User.objects.filter(is_staff=True, is_superuser=False).exists()
        ):
            return None, False, 'skip'

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            is_staff=True,
            is_superuser=is_superuser,
        )
        return user, True, 'created'

    user.email = email
    user.first_name = first_name
    user.is_staff = True
    user.is_superuser = is_superuser
    if reset_password:
        user.set_password(password)
    user.save()
    return user, False, 'force' if reset_password else 'exists'


class Command(BaseCommand):
    help = 'Створює demo/admin; пароль з env не перезаписує існуючих без FORCE'

    def handle(self, *args, **options):
        is_prod = bool(
            os.environ.get('RENDER')
            or os.environ.get('RENDER_EXTERNAL_HOSTNAME')
            or os.environ.get('VERCEL')
            or os.environ.get('VERCEL_ENV')
        )
        force_reset = os.environ.get('CRM_FORCE_DEMO_PASSWORD', '').lower() in (
            '1', 'true', 'yes',
        )

        demo_password = os.environ.get('CRM_DEMO_PASSWORD')
        admin_password = os.environ.get('CRM_ADMIN_PASSWORD')

        if is_prod and not demo_password:
            self.stdout.write(
                self.style.WARNING('CRM_DEMO_PASSWORD не задано — demo пропущено')
            )
        if is_prod and not admin_password:
            self.stdout.write(
                self.style.WARNING('CRM_ADMIN_PASSWORD не задано — admin пропущено')
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
            user, created, status = ensure_user(
                account['email'],
                account['password'],
                account['first_name'],
                is_superuser=account['is_superuser'],
                reset_password=force_reset,
            )
            if status == 'skip':
                self.stdout.write(
                    f'Пропущено {account["label"]}: обліковий запис уже змінено в CRM'
                )
            elif status == 'created':
                self.stdout.write(f'Створено {account["label"]}: {user.username}')
            elif status == 'force':
                self.stdout.write(f'FORCE пароль {account["label"]}: {user.username}')
            else:
                self.stdout.write(
                    f'Вже існує {account["label"]} (пароль не змінено): {user.username}'
                )
