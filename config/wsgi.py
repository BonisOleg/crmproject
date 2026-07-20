"""
WSGI config for config project.
"""

import os
import sys

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
# Vercel Python runtime шукає `app`
app = application

_bootstrap_done = False


def _bootstrap_database():
    global _bootstrap_done
    if _bootstrap_done:
        return
    _bootstrap_done = True

    try:
        from django.core.management import call_command

        call_command('migrate', verbosity=0, interactive=False)
        call_command('ensure_demo_user', verbosity=0)
        # На Vercel SQLite в /tmp порожній після cold start — підсіваємо демо
        if os.environ.get('VERCEL') or os.environ.get('VERCEL_ENV'):
            call_command('seed_crm', verbosity=0)
    except Exception as exc:
        print(f'[wsgi bootstrap] {exc}', file=sys.stderr)


try:
    _bootstrap_database()
except Exception as exc:
    print(f'[wsgi bootstrap fatal] {exc}', file=sys.stderr)
