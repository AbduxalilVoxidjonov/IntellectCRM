---
name: deploy
description: IntellectCRM'ni prod serverga deploy qilish (docker compose, .env, Cloudflare Tunnel, PostgreSQL backup/restore). Deploy, serverni ko'chirish, backup tiklash yoki tunnel sozlash kerak bo'lganda ishlating.
---

# Deploy (prod)

```bash
docker compose up -d --build    # app + postgres + cloudflared + backup + mediamtx
```

- **`.env`** (git'ga tushmaydi): `ROOT_DOMAIN=intellectschool.uz`, `APP_HOST=crm.intellectschool.uz`,
  `POSTGRES_PASSWORD` (kuchli!), `POSTGRES_USER`/`POSTGRES_DB` (default intellectcrm), `JWT_KEY`,
  `TUNNEL_TOKEN` (tunnel `80531fd7`).
- **KALITLAR faqat `.env` da** (bazada saqlanmaydi, UI'dan kiritilmaydi — `AppSecrets`):
  `TELEGRAM_BOT_TOKEN`, `FCM_SERVICE_ACCOUNT_JSON`, `GEMINI_API_KEY`, `AZURE_SPEECH_KEY/REGION`,
  `ESKIZ_EMAIL/PASSWORD`, `TURNSTILE_USERNAME/PASSWORD`, `MOIZVONKI_*`. O'zgartirgach
  `docker compose up -d`. Eski (kalitlar bazada bo'lgan) o'rnatishdan yangilashda — DEPLOY.md §2.1
  (migratsiya ustunlarni o'chiradi; qiymatlar startup logida `.env` qatorlari bo'lib chiqadi).
- **DB:** PostgreSQL 16 (alpine). Server'da **>=1GB RAM** (+swap tavsiya). Baza `intellectcrm`.
  Volume `postgres-data`.
- **Cloudflare panel:** Public Hostname `crm.intellectschool.uz` → HTTP → `app:8080`. Ko'chirishda
  eski serverdagi cloudflared'ni to'xtating (bir tokenni 2 joyda ishlatmang).
- App porti internetga ochilmaydi (faqat cloudflared).
- **Backup:** kunlik 02:00 Toshkent, `pg_dump` → `.sql.gz`, 7 kun saqlanadi (`postgres-backups`
  volume, backup konteynerda).
  Restore: `docker exec intellectcrm-backup sh -c "gunzip -c ...|psql"`.
- **Ubuntu/Docker auditi + noldan o'rnatish** — `DEPLOY.md` "0-bo'lim" (Docker o'rnatish, swap,
  klon, run, tekshirish).
