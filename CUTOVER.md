# Deploy на Render (Blueprint)

## Репозиторій
https://github.com/BonisOleg/crmproject

## Blueprint
1. Render → New → Blueprint → підключити `BonisOleg/crmproject` (гілка `main`)
2. Підтвердити `render.yaml`
3. У Environment Variables задати (обовʼязково):
   - `CRM_DEMO_PASSWORD`
   - `CRM_ADMIN_PASSWORD`
4. Deploy

## Після деплою
- `GET /healthz/` → `{"status":"ok",...}`
- Логін demo: `timofiy@auto-lot.com`
- Логін admin: `admin@auto-lot.com`

## MEDIA / Persistent Disk
На `plan: free` файли в MEDIA не персистять між деплоями.
Коли знадобиться зберігання документів:
1. Web service → Starter
2. Add Disk → mount `/var/data/media`
3. Env: `MEDIA_ROOT=/var/data/media`
4. У `render.yaml` розкоментувати блок `disk`

## Кастомний домен (пізніше)
1. Render → Custom Domain
2. Env `ALLOWED_HOSTS`: `.onrender.com,your-domain.com`
3. Django підхопить `RENDER_EXTERNAL_HOSTNAME` для CSRF; для свого домену додайте
   `CSRF_TRUSTED_ORIGINS=https://your-domain.com` у settings або через окремий env (за потреби)

## Smoke
- Login staff → cockpit
- Create deal → deals + report
- Record payment → debt
- Upload document (після підключення disk)
- Archive month (readonly)
