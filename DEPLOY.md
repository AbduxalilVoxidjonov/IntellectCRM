# IntellectCRM — Deploy (Docker + PostgreSQL + Cloudflare Tunnel)

Bitta o'quv markazi uchun. Tashqi kirish faqat **Cloudflare Tunnel** orqali (port internetga ochilmaydi).

## 0. Ubuntu serverga o'rnatish (noldan, qadamba-qadam)

Yangi Ubuntu (20.04/22.04/24.04) server uchun to'liq ketma-ketlik:

```bash
# 0.1 — Docker Engine + Compose plagini (rasmiy repo)
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker   # docker'ni sudo'siz ishlatish (qayta login kerak bo'lishi mumkin)

# 0.2 — RAM. PostgreSQL yengil — 1GB serverga ham sig'adi. Barqarorlik uchun swap tavsiya:
free -h
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab    # qayta yuklashda saqlanadi

# 0.3 — Kodni klonlash (git LF bilan beradi — CRLF muammosi yo'q)
git clone https://github.com/AbduxalilVoxidjonov/IntellectCRM.git
cd IntellectCRM

# 0.4 — Sozlama
cp .env.example .env
nano .env        # quyidagilarni to'ldiring (3-bo'limga qarang)

# 0.5 — Ishga tushirish (birinchi build ~3-5 daqiqa)
docker compose up -d --build

# 0.6 — Tekshirish
docker compose ps                       # hammasi "running"/"healthy" bo'lsin
docker compose logs -f app              # "Now listening on :8080" + "Application started" + migratsiya
docker compose logs postgres | tail     # PostgreSQL tayyorligi
```

> ⚠️ **Diqqat:** `.env` ni Ubuntu'da (LF) yarating yoki klondan `cp` qiling — Windows'dan CRLF bilan
> ko'chirmang (TUNNEL_TOKEN/parol oxiriga `\r` qo'shilib tunnel/login buziladi). Repo `.gitattributes`
> infra fayllarni LF saqlaydi, lekin `.env`ni o'zingiz to'g'ri yarating.

**Firewall (ixtiyoriy, tavsiya):** app porti tashqariga ochilmaydi (faqat cloudflared chiquvchi ulanish),
shuning uchun INBOUND port shart emas. SSH'dan tashqari hammasini yopish mumkin:
```bash
sudo ufw allow OpenSSH && sudo ufw enable
```

## 0b. Lokal test (localhost) — serverga ta'sir qilmasdan

Lokal mashinada (Docker Desktop) sinash uchun `docker-compose.override.yml` ishlatiladi. Bu fayl
Docker Compose tomonidan AVTOMATIK qo'shiladi va **`.gitignore`da** — ya'ni serverga TUSHMAYDI.

```bash
# Bir marta (lokal mashinada):
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up -d --build
# Brauzer: http://localhost:8080   (login: .env dagi OWNER_LOGIN / OWNER_PASSWORD)
```

- **Lokal** (override bor) → `app` **localhost:8080** da, `postgres` **5432** da; **cloudflared ISHLAMAYDI**
  (tunnel kerak emas, prod tunnelga ulanmaydi).
- **Server** (override YO'Q — git'dan kelmaydi) → `docker compose up -d --build` AYNAN o'sha buyruq, lekin
  to'liq prod (cloudflared + port ochilmaydi). **Pull qilinganda lokal config serverga o'tib qolmaydi.**

> Server buyrug'i o'zgarmaydi. Farq faqat lokalda override fayl borligida.

## 1. Talablar
- Docker + Docker Compose
- Server'da kamida **1GB RAM** (+swap tavsiya) — PostgreSQL yengil
- Cloudflare hisobi (Zero Trust → Tunnels) va tunnel tokeni
- Domen (Cloudflare DNS'da)

## 2. Sozlash
```bash
cp .env.example .env
# .env ni tahrirlang: ROOT_DOMAIN, APP_HOST, POSTGRES_PASSWORD, JWT_KEY, TUNNEL_TOKEN
# POSTGRES_PASSWORD: kuchli parol qo'ying
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
- **postgres** — PostgreSQL 16 (alpine), bazа `intellectcrm`, `postgres-data` volume
- **cloudflared** — tashqi kirish
- **backup** — har kuni 02:00 (Toshkent) `pg_dump` → `/backups/*.sql.gz`, 7 kun saqlanadi
- **mediamtx** — kamera RTSP→HLS shlyuzi

## 5. Migratsiya (baza sxemasi)
App birinchi ishga tushganda `db.Database.Migrate()` avtomatik EF migratsiyalarini qo'llaydi — bo'sh bazada barcha jadvallarni quradi (61 jadval). Qo'lda:
```bash
ConnectionStrings__Default="Host=localhost;Port=5432;Database=intellectcrm;Username=intellectcrm;Password=..." \
dotnet ef database update --project IntellectCRM.Infrastructure --startup-project IntellectCRM.Server
```

## 6. Backup'dan tiklash
`pg_dump` SQL nusxasini `psql` orqali tiklang. Backup volume + psql + PG ulanish o'zgaruvchilari
`backup` konteynerda bor — restore'ni o'sha yerdan ishlatish eng oson (ehtiyot: mavjud ma'lumot ustiga yozadi):
```bash
docker exec intellectcrm-backup sh -c \
  "gunzip -c /backups/intellectcrm_YYYYMMDD_HHMM.sql.gz | psql"
```

## 7. Eslatmalar
- **DataProtection** kalitlari `dpkeys` volume'da — deploylar oralig'ida tokenlar yaroqli qoladi.
- **Yuklamalar** (`uploads`) va **kamera yozuvlari** (`cam-recordings`) volume'larda saqlanadi.
- App porti (`8080`) **internetga ochilmaydi** — faqat ichki tarmoq (cloudflared) kiradi.
- **Birinchi kirish:** baza bo'sh bo'lsa, app `OWNER_LOGIN`/`OWNER_PASSWORD` bilan super admin yaratadi
  (`APP_HOST` orqali kiring). Birinchi kirgach parolni o'zgartiring. Parolni bermasangiz — app logida
  generatsiya qilingan parol chiqadi (`docker compose logs app | grep -i parol`).
- **Yangilash (kod o'zgargach):** `git pull && docker compose up -d --build app` (faqat `app` qayta quriladi;
  `postgres-data` volume va baza SAQLANADI — migratsiyalar inkremental qo'llanadi).
- **Kamera (mediamtx):** hozir tashqi HLS porti ochilmagan — kamera oqimi brauzerga yetishi uchun mediamtx
  HLS portiga (8888) alohida Cloudflare route kerak. Kamera ishlatilmasa — e'tiborsiz.
- **Volume'lar:** `postgres-data` (baza), `postgres-backups`, `uploads`, `dpkeys`, `cam-recordings` — `docker compose down`
  da SAQLANADI; faqat `docker compose down -v` ularni O'CHIRADI (ishlatmang).
