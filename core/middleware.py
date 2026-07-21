"""Ранній healthcheck для Render (обхід DisallowedHost / SSL redirect)."""

from django.http import JsonResponse
from django.utils import timezone


class HealthCheckMiddleware:
    """
    Render health probes інколи шлють Host поза ALLOWED_HOSTS → 400,
    і деплой «висить». Відповідаємо 200 до SecurityMiddleware.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.rstrip('/') or '/'
        if path == '/healthz':
            return JsonResponse({
                'ok': True,
                'data': {'status': 'ok', 'time': timezone.now().isoformat()},
                'error': None,
            })
        return self.get_response(request)
