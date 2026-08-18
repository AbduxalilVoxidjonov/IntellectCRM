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
  `ESKIZ_EMAIL/PASSWORD`, `TURNSTILE_USERNAME/PASSWORD`, `MOIZVONKI_*`,
  `INSTAGRAM_APP_SECRET/VERIFY_TOKEN`. O'zgartirgach `docker compose up -d`.
  ⚠️ **Yangi kalit qo'shsangiz `docker-compose.yml` dagi `app` → `environment:` ga HAM qo'shing** —
  `app` servisida `env_file` YO'Q, ya'ni faqat `.env` ga yozilgan qiymat konteynerga UMUMAN
  yetib bormaydi va modul jimgina "sozlanmagan" bo'lib qoladi (`EnvKeysWiringTests` shuni qulflaydi). Eski (kalitlar bazada bo'lgan) o'rnatishdan yangilashda — DEPLOY.md §2.1
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

## ⚠️ "Lokalda ishlaydi, prodda yo'q" — landing va lid formasi

Sabab deyarli har doim BITTA: **CSP faqat proddagina qo'llanadi**
(`Program.cs` → `if (!app.Environment.IsDevelopment())`). Dev'da (`dotnet run`) CSP UMUMAN
yuborilmaydi, konteynerda esa `ASPNETCORE_ENVIRONMENT=Production` — ya'ni brauzer prodda
qo'shimcha qoidalarni qo'llaydi va farq shu yerdan chiqadi.

Statik sahifa (`landing.html`, `sertifikatlar.html`) yozganda:

- **Inline `<script>` ISHLAMAYDI** — `script-src 'self' …` da `'unsafe-inline'` YO'Q (ataylab).
  Butun mantiq inline blokda bo'lsa sahifa prodda O'LIK bo'ladi: tugmalar bosilmaydi, forma
  yuborilmaydi, hech qanday xato ko'rinmaydi. Skriptni ALOHIDA `.js` fayliga chiqaring.
- **Inline `on*=` atributlari** (`onclick=`, `onmouseover=`) ham shu sababdan ishlamaydi —
  `addEventListener` ishlating.
- **Yangi tashqi host** (iframe, shrift, skript, so'rov) qo'shsangiz — CSP'dagi tegishli
  direktivaga ham qo'shing: `frame-src` (xarita), `style-src`+`font-src` (Google Fonts),
  `connect-src` (fetch), `script-src`. Aks holda faqat prodda jim bloklanadi.

Tekshirish (deploydan keyin, 1 daqiqa): sahifani prodda oching → DevTools → Console.
`Refused to … because it violates the Content Security Policy` qatorlari aynan shu muammoni
ko'rsatadi.

## Deploy tekshiruvi (landing/lid)

1. `docker compose up -d --build` — **`--build` SHART**: landing fayllari image ICHIDA keladi
   (bind-mount YO'Q), ya'ni `up -d` bilan eski nusxa qolib ketadi.
2. Cloudflare panelda **ikkala** Public Hostname bo'lsin: `crm.intellectschool.uz` VA apex
   `intellectschool.uz` (+ `www`) → HTTP → `app:8080`. Apex marshrutsiz landing umuman ochilmaydi.
3. Cloudflare keshi: `landing.js`/`landing.html` origin'dan `Cache-Control: no-cache` bilan
   keladi, lekin CF sozlamalarida "Cache Everything" qoidasi bo'lsa eski nusxa qolishi mumkin —
   shubha bo'lsa **Purge Everything**.
4. Lidni oxirigacha sinang: apex sahifasidagi forma → CRM → "Lidlar" bo'limida yangi qator.
   `429` chiqsa — bu rate-limit (`public-lead`, IP bo'yicha daqiqada 5 ta); javob endi
   o'zbekcha matn bilan keladi ("Juda ko'p urinish…"), ya'ni chalkashmaydi.
