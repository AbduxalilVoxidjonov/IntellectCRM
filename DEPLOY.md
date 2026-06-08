# IntellectCRM — Deploy (Docker + MySQL 8 + Cloudflare Tunnel)

Bitta o'quv markazi uchun. Tashqi kirish faqat **Cloudflare Tunnel** orqali (port internetga ochilmaydi).

## 1. Talablar
- Docker + Docker Compose
- Cloudflare hisobi (Zero Trust → Tunnels) va tunnel tokeni
- Domen (Cloudflare DNS'da)

## 2. Sozlash
```bash
cp .env.example .env
# .env ni tahrirlang: ROOT_DOMAIN, APP_HOST, MYSQL_ROOT_PASSWORD, JWT_KEY, TUNNEL_TOKEN
# JWT_KEY: openssl rand -base64 48
```

## 3. Cloudflare Tunnel
Zero Trust → Networks → Tunnels → (tunnel) → Public Hostname:
- `APP_HOST` (masalan `app.intellectcrm.uz`) → `http://app:8080` → SPA
- `ROOT_DOMAIN` (apex/www) → `http://app:8080` → landing sahifa

## 4. Ishga tushirish
```bash
docker compose up -d --build
```
Servislar:
- **app** — API + SPA (8080, faqat tunnel orqali)
- **mysql** — MySQL 8 (utf8mb4), `mysql-data` volume
- **cloudflared** — tashqi kirish
- **backup** — har kuni 02:00 (Toshkent) `mysqldump` → `/backups`, 7 kun saqlanadi
- **mediamtx** — kamera RTSP→HLS shlyuzi

## 5. Migratsiya (baza sxemasi)
App birinchi ishga tushganda `db.Database.Migrate()` avtomatik EF migratsiyalarini qo'llaydi (bo'sh bazada barcha jadvallarni yaratadi). Qo'lda:
```bash
ConnectionStrings__Default="Server=localhost;Port=3306;Database=intellectcrm;User=root;Password=...;CharSet=utf8mb4" \
dotnet ef database update --project IntellectCRM.Infrastructure --startup-project IntellectCRM.Server
```

## 6. Backup'dan tiklash
```bash
gunzip < backups/intellectcrm_YYYYMMDD_HHMM.sql.gz | docker exec -i intellectcrm-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
```

## 7. Eslatmalar
- **DataProtection** kalitlari `dpkeys` volume'da — deploylar oralig'ida tokenlar yaroqli qoladi.
- **Yuklamalar** (`uploads`) va **kamera yozuvlari** (`cam-recordings`) volume'larda saqlanadi.
- App porti (`8080`) **internetga ochilmaydi** — faqat ichki tarmoq (cloudflared) kiradi.
