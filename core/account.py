"""Права та оновлення облікового запису CRM (логін/пароль)."""

import os
import re

from django.contrib.auth import password_validation, update_session_auth_hash
from django.core.exceptions import ValidationError


def demo_email():
    return os.environ.get('CRM_DEMO_EMAIL', 'timofiy@auto-lot.com').strip().lower()


def can_manage_account(user):
    """Суперюзер або Тимофій (demo) можуть змінювати свій логін/пароль у CRM."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    email = demo_email()
    if (
        (user.username or '').strip().lower() == email
        or (user.email or '').strip().lower() == email
    ):
        return True
    # Після зміни email у CRM — доступ за імʼям demo (Тимофій)
    demo_name = os.environ.get('CRM_DEMO_FIRST_NAME', 'Тимофій').strip()
    return bool(
        user.is_staff
        and not user.is_superuser
        and (user.first_name or '').strip() == demo_name
    )


def serialize_account(user):
    return {
        'email': (user.email or user.username or '').strip().lower(),
        'can_manage': can_manage_account(user),
    }


def _normalize_email(value):
    email = str(value or '').strip().lower()
    if not email:
        raise ValueError('Вкажіть email для входу')
    if len(email) > 150:
        raise ValueError('Email занадто довгий')
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise ValueError('Невірний формат email')
    return email


def update_account(request, body):
    """Оновлює логін (username+email) і опційно пароль поточного користувача."""
    user = request.user
    if not can_manage_account(user):
        raise PermissionError('Немає доступу')

    current_password = str(body.get('current_password') or '')
    if not current_password:
        raise ValueError('Введіть поточний пароль')
    if not user.check_password(current_password):
        raise ValueError('Невірний поточний пароль')

    new_email = None
    if 'email' in body:
        new_email = _normalize_email(body.get('email'))
        from django.contrib.auth import get_user_model

        User = get_user_model()
        conflict = User.objects.filter(username=new_email).exclude(pk=user.pk).exists()
        if conflict:
            raise ValueError('Користувач з таким email уже існує')
        conflict_email = User.objects.filter(email=new_email).exclude(pk=user.pk).exists()
        if conflict_email:
            raise ValueError('Користувач з таким email уже існує')

    new_password = body.get('new_password')
    if new_password is not None and str(new_password).strip() == '':
        new_password = None
    if new_password is not None:
        new_password = str(new_password)
        confirm = str(body.get('new_password_confirm') or '')
        if new_password != confirm:
            raise ValueError('Новий пароль і підтвердження не збігаються')
        if len(new_password) < 8:
            raise ValueError('Пароль мінімум 8 символів')
        try:
            password_validation.validate_password(new_password, user)
        except ValidationError as exc:
            raise ValueError('; '.join(exc.messages)) from exc

    if new_email is None and new_password is None:
        raise ValueError('Немає змін для збереження')

    if new_email is not None:
        user.username = new_email
        user.email = new_email
    if new_password is not None:
        user.set_password(new_password)
    user.save()

    if new_password is not None:
        update_session_auth_hash(request, user)

    return serialize_account(user)
