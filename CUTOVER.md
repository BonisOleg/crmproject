# Production CRM cutover checklist
#
# Deploy (Render)
# 1. Set SECRET_KEY, DATABASE_URL, CRM_DEMO_PASSWORD, CRM_ADMIN_PASSWORD, MEDIA_ROOT=/var/data/media
# 2. Attach Persistent Disk at /var/data/media
# 3. Build runs: collectstatic, migrate, ensure_demo_user, seed_crm
# 4. GET /healthz/ → ok
#
# Manual smoke
# - Login staff → cockpit stats from DB
# - Create deal → appears in deals + report (won/confirmed)
# - Record payment → debt decreases
# - Create lead / carrier / client
# - Upload document on deal → file on MEDIA disk
# - Open archive month (readonly)
# - Clear localStorage → data still present after reload
#
# Local
#   python3 manage.py migrate
#   python3 manage.py ensure_demo_user
#   python3 manage.py seed_crm
#   python3 manage.py test core
