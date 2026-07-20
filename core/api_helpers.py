"""Shared API helpers: JSON body, CSRF session responses, validation."""

import json
import re
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


def api_login_required(view):
    @login_required
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        return view(request, *args, **kwargs)

    return wrapper


def json_body(request):
    if not request.body:
        return {}
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError('Невірний JSON') from exc
    if not isinstance(data, dict):
        raise ValueError('Очікується JSON-обʼєкт')
    return data


def ok(data=None, status=200):
    return JsonResponse({'ok': True, 'data': data, 'error': None}, status=status)


def fail(error, status=400, data=None):
    return JsonResponse({'ok': False, 'data': data, 'error': error}, status=status)


def parse_phone(value, required=False):
    v = str(value or '').strip()
    if not v:
        if required:
            raise ValueError('Заповніть номер телефону')
        return ''
    if re.search(r'[a-zA-Zа-яА-ЯіїєґІЇЄҐ]', v):
        raise ValueError('Лише цифри, +, пробіли та дужки')
    digits = re.sub(r'\D', '', v)
    if len(digits) < 10:
        raise ValueError('Мінімум 10 цифр')
    if len(digits) > 15:
        raise ValueError('Занадто довгий номер')
    return v


def parse_name(value, required=True):
    v = str(value or '').strip()
    if not v:
        if required:
            raise ValueError('Заповніть це поле')
        return ''
    if len(v) < 2:
        raise ValueError('Мінімум 2 символи')
    if re.search(r'\d', v):
        raise ValueError('Не використовуйте цифри')
    return v


def parse_car(value):
    v = str(value or '').strip()
    if not v:
        raise ValueError('Вкажіть модель авто')
    if len(v) < 2:
        raise ValueError('Мінімум 2 символи')
    return v


def parse_year(value, required=False):
    v = str(value or '').strip()
    if not v:
        if required:
            raise ValueError('Вкажіть рік')
        return None
    if not re.fullmatch(r'\d{4}', v):
        raise ValueError('4 цифри, напр. 2021')
    year = int(v)
    from datetime import date

    max_year = date.today().year + 1
    if year < 1990 or year > max_year:
        raise ValueError(f'Рік від 1990 до {max_year}')
    return year


def parse_money(value, required=False, field='сума'):
    v = str(value if value is not None else '').strip()
    if not v:
        if required:
            raise ValueError(f'Вкажіть {field}')
        return 0
    if not re.fullmatch(r'\d+(\.\d{1,2})?', v):
        raise ValueError('Невірний формат суми')
    num = float(v)
    if num < 0:
        raise ValueError('Сума не може бути відʼємною')
    if num > 9999999:
        raise ValueError('Занадто велика сума')
    return num


def methods(*allowed):
    return require_http_methods(list(allowed))
