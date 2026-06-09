# IntellectCRM — loyiha holati va eslatma (CLAUDE.md)

> Bu fayl har sessiyada o'qiladi. Maqsad: ishni boshidan boshlamaslik. **Har bir muhim
> o'zgarish/buyruqdan keyin pastdagi "Ish jurnali" bo'limini yangilab borish.**

## 1. Loyiha haqida
**IntellectCRM** — bitta o'quv markazi uchun CRM/LMS. `IntellectCRM_TZ.md` bo'yicha eski `SchoolLms`
(maktab LMS, SQL Server) dan to'liq o'zgartirilgan.

- **Backend:** ASP.NET Core 8 (C#), Clean Architecture
- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts
- **DB:** MySQL 8 (`Pomelo.EntityFrameworkCore.MySql`), utf8mb4
- **Real-time:** SignalR | **Auth:** JWT | **Push:** FCM | **Bot:** Telegram | **Hujjat:** OpenXML
- **Infra:** Docker Compose + Cloudflare Tunnel

## 2. Solution tuzilishi
```
IntellectCRM.slnx
├── IntellectCRM.Domain          (Entities.cs, Roles.cs)
├── IntellectCRM.Application      (Dtos/, Services/, Abstractions/IAppDbContext.cs, Hubs/)
├── IntellectCRM.Infrastructure   (Data/AppDbContext.cs, Migrations/ — bitta InitialCreate)
├── IntellectCRM.Server           (Controllers/, Program.cs, appsettings*.json)
└── IntellectCRM.Client           (React; oldin "schoollms.client" edi)
```

## 3. Joriy holat
- **Branch:** `intellectcrm-transform` (master'ga MERGE QILINMAGAN — foydalanuvchi ruxsatini kutadi).
- **Build:** backend 0 xato; frontend `tsc -b` 0 + `vite build` ✓.
- **Migratsiya:** bitta `InitialCreate` (53 jadval) — jonli MySQL 8 da tasdiqlangan.
- **TZ 10/10 faza bajarilgan.**

## 4. Muhim arxitektura qarorlari (ESLAB QOLISH)
- **Multi-tenant YO'Q** — `TenantId`/Control Plane/obuna olib tashlangan. `Roles.PlatformOwner` = yagona egasi.
- **Entity rename:** `SchoolClass` → **`Group`**, `SchoolMeta` → **`CenterMeta`**, `SchoolController` → `CenterController`.
  DbSet nomi hali `Classes` (jadval "Classes"), `db.CenterMeta`.
- **Olib tashlangan:** Canteen(Dish), Quarters(QuarterPeriod/QuarterGrade), AcademicYear/rollover, SubGroup(1/2).
- **`int Quarter`** entitylarda OPAQUE ustun sifatida qoldi (default 1) — jurnal indekslari uchun.
- **Jadval/hafta hisobi:** markazda chorak entity yo'q; `TuitionService.SyntheticPeriodsAsync` o'quv yili
  boshidan ~10 oylik **bitta sintetik davr** qaytaradi (`SchoolSettingsDto.Quarters`, `PortalMetaDto.Quarters`).
  Frontend hafta navigatsiyasi shunga tayanadi — buni buzmang.
- **M2M guruhlar:** `StudentGroup` (StudentId, GroupId, JoinedAt, LeftAt?, IsActive). `Student.ClassName`
  "asosiy guruh" yorlig'i sifatida SAQLANADI (jurnal/chat/hisobot o'zgarmasdan ishlaydi).
- **Billing:** `TuitionService.AccrueMonth` — o'quvchi oyligi = barcha FAOL guruhlari `MonthlyFee` yig'indisi
  (aggregate); a'zoligi bo'lmasa eski ClassName narxi. `CenterMeta.BillingMode` = "aggregate" (perGroup — kelajak).
- **CRM:** `Lead`(Source/InterestSubject/CreatedAt/ConvertedStudentId), `LeadEvent`(tarix), `TrialLesson`(sinov).
  Endpointlar `LeadsController`da: events, trials, `/{id}/convert`, `/stats`.
- **Guruh endpointlari** `ClassesController`da: `/{id}/members`, `/student/{id}/groups`, `/fill`.
- **To'lov eslatmasi:** mavjud `MessagesController` broadcast `OnlyDebtors=true` (Telegram + `{qarzdorlik}` tokenlari).
  Avtomatik (hisob yaratilganda) trigger — hali yo'q (kelajak).

## 5. Buyruqlar
```bash
# Backend build (SPA'siz — tez)
dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false
# Butun solution
dotnet build IntellectCRM.slnx -p:BuildSpa=false
# Frontend
cd IntellectCRM.Client && npx tsc -b && npm run build

# Mahalliy ishga tushirish (MySQL kerak)
docker run -d --name icrm-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=intellectcrm mysql:8.0
dotnet run --project IntellectCRM.Server          # API + avtomatik migratsiya
cd IntellectCRM.Client && npm run dev             # (ixtiyoriy) frontend dev

# Migratsiyani qayta yaratish (model o'zgarsa): Migrations/ ni o'chir -> build -> add
rm -rf IntellectCRM.Infrastructure/Migrations
dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false
dotnet ef migrations add InitialCreate --project IntellectCRM.Infrastructure --startup-project IntellectCRM.Server --no-build
# DIQQAT: ef bilan ishlashda avval BUILD qiling (migratsiya assembly'ga kirishi uchun), so'ng --no-build.
```

## 6. Deploy (prod)
```bash
docker compose up -d --build    # app + mysql + cloudflared + backup + mediamtx
```
- **`.env`** (git'ga tushmaydi): `ROOT_DOMAIN=intellectschool.uz`, `APP_HOST=crm.intellectschool.uz`,
  `MYSQL_ROOT_PASSWORD`, `JWT_KEY`, `TUNNEL_TOKEN` (tunnel `80531fd7`, sinovdan o'tgan).
- **Cloudflare panel:** Public Hostname `crm.intellectschool.uz` → HTTP → `app:8080`.
- App porti internetga ochilmaydi (faqat cloudflared). Backup: kunlik 02:00 Toshkent, mysqldump, 7 kun.

## 7. Qolgan/ixtiyoriy
- [ ] `intellectcrm-transform` → `master` merge (foydalanuvchi ruxsati bilan).
- [ ] Avtomatik to'lov eslatmasi (oylik hisob yaratilganda Telegram+push).
- [ ] `BillingMode=perGroup` (hozir aggregate; MonthlyCharge unique kalit (StudentId,Month) o'zgartirilishi kerak).
- [ ] `.claude/settings.local.json` ichidagi eski `schoollms.client` yo'llari (lokal, ixtiyoriy).

## 8. Ish jurnali (har o'zgarishdan keyin yangilanadi)
- 2026-06-08: Faza 0-10 bajarildi (MySQL ko'chish, namespace/entity rename, modul olib tashlash, M2M
  guruhlar, Leads CRM, infra). Backend+frontend build yashil. Branch `intellectcrm-transform`, 12 commit.
- 2026-06-09: Mijoz proyekti `schoollms.client` → `IntellectCRM.Client` (commit `e967b0a`).
- 2026-06-09: `.env` MySQL formatiga + yangi Cloudflare token (`80531fd7`); `APP_HOST=crm.intellectschool.uz`
  (subdomen). Token jonli sinovdan o'tdi ("Registered tunnel connection"). `dotnet run` → `--project IntellectCRM.Server`.
- (keyingi o'zgarishlar shu yerga qo'shiladi)
