"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

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
    except Exception:
        pass


try:
    _bootstrap_database()
except Exception:
    pass
