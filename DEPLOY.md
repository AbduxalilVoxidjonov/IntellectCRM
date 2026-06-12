# IntellectCRM — Deploy (Docker + SQL Server 2022 + Cloudflare Tunnel)

Bitta o'quv markazi uchun. Tashqi kirish faqat **Cloudflare Tunnel** orqali (port internetga ochilmaydi).

## 1. Talablar
- Docker + Docker Compose
- Server'da kamida **2GB bo'sh RAM** (SQL Server talabi)
- Cloudflare hisobi (Zero Trust → Tunnels) va tunnel tokeni
- Domen (Cloudflare DNS'da)

## 2. Sozlash
```bash
cp .env.example .env
# .env ni tahrirlang: ROOT_DOMAIN, APP_HOST, MSSQL_SA_PASSWORD, JWT_KEY, TUNNEL_TOKEN
# MSSQL_SA_PASSWORD: murakkab bo'lsin (>=8 belgi, katta+kichik harf+raqam+belgi) — aks holda mssql ishga tushmaydi
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
- **mssql** — SQL Server 2022 (Express), bazа `IntellectCRM_DB`, `mssql-data` volume
- **cloudflared** — tashqi kirish
- **backup** — har kuni 02:00 (Toshkent) `BACKUP DATABASE` → `/backups/*.bak.gz`, 7 kun saqlanadi
- **mediamtx** — kamera RTSP→HLS shlyuzi

## 5. Migratsiya (baza sxemasi)
App birinchi ishga tushganda `db.Database.Migrate()` avtomatik EF migratsiyalarini qo'llaydi — bo'sh serverда `IntellectCRM_DB` bazasini yaratib, barcha jadvallarni quradi. Qo'lda:
```bash
ConnectionStrings__Default="Server=localhost,1433;Database=IntellectCRM_DB;User Id=sa;Password=...;TrustServerCertificate=True;Encrypt=True" \
dotnet ef database update --project IntellectCRM.Infrastructure --startup-project IntellectCRM.Server
```

## 6. Backup'dan tiklash
`.bak` faylni mssql konteyner ko'radigan volume'ga qo'yib (yoki backup volume'idan), `RESTORE` qiling:
```bash
# .bak.gz ni yeching va backup volume ichiga (mssql /var/backups da ko'radi) joylang
docker exec intellectcrm-backup bash -c "gunzip -k /backups/IntellectCRM_DB_YYYYMMDD_HHMM.bak.gz"
docker exec intellectcrm-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q \
  "RESTORE DATABASE [IntellectCRM_DB] FROM DISK = N'/var/backups/IntellectCRM_DB_YYYYMMDD_HHMM.bak' WITH REPLACE"
```

## 7. Eslatmalar
- **DataProtection** kalitlari `dpkeys` volume'da — deploylar oralig'ida tokenlar yaroqli qoladi.
- **Yuklamalar** (`uploads`) va **kamera yozuvlari** (`cam-recordings`) volume'larda saqlanadi.
- App porti (`8080`) **internetga ochilmaydi** — faqat ichki tarmoq (cloudflared) kiradi.
