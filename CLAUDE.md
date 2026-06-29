# IntellectCRM — loyiha holati va eslatma (CLAUDE.md)

> Bu fayl har sessiyada o'qiladi. Maqsad: ishni boshidan boshlamaslik. **Har bir muhim
> o'zgarish/buyruqdan keyin pastdagi "Ish jurnali" bo'limini yangilab borish.**

## 1. Loyiha haqida
**IntellectCRM** — bitta o'quv markazi uchun CRM/LMS. `IntellectCRM_TZ.md` bo'yicha eski `SchoolLms`
(maktab LMS, SQL Server) dan to'liq o'zgartirilgan.

- **Backend:** ASP.NET Core 8 (C#), Clean Architecture
- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts
- **DB:** PostgreSQL 16 (`Npgsql.EntityFrameworkCore.PostgreSQL`). Baza `intellectcrm`. 1GB RAM serverga sig'adi. DIQQAT: Program.cs'da `AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)` — AppClock.Now (Kind=Unspecified) ni `timestamp`ga saqlaydi. decimal→`numeric(18,2)`. (Ilgari SQL Server edi; 1GB uchun ko'chirildi.)
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
- **Migratsiya:** bitta `InitialCreate` (61 jadval) — PostgreSQL'da qo'llanib tasdiqlangan (jonli E2E: migrate+seed+login).
- **TZ 10/10 faza bajarilgan.**

## 4. Muhim arxitektura qarorlari (ESLAB QOLISH)
- **Multi-tenant YO'Q** — `TenantId`/Control Plane/obuna olib tashlangan. `Roles.PlatformOwner` = yagona egasi.
- **Entity rename:** `SchoolClass` → **`Group`**, `SchoolMeta` → **`CenterMeta`**, `SchoolController` → `CenterController`.
  DbSet nomi hali `Classes` (jadval "Classes"), `db.CenterMeta`.
- **Olib tashlangan:** Canteen(Dish), Quarters(QuarterPeriod/QuarterGrade), AcademicYear/rollover, SubGroup(1/2),
  **Avtobus-GPS** (Bus/BusLocation entity, GpsService, GpsController/GpsIngestController, CenterMeta.Gps* maydonlari,
  o'quvchi portali avtobus oynasi, admin GPS sahifasi+sozlamasi, frontend nav/route). `PickupRequest` (ota-ona
  "farzandni oldim") SAQLANDI — u avtobus-GPS emas. `LiveHub` qoldi (turniket uchun); kamera/turniket alohida.
- **`int Quarter`** entitylarda OPAQUE ustun sifatida qoldi (default 1) — jurnal indekslari uchun.
- **Dars jadvali OLIB TASHLANDI** (ScheduleTemplate/ScheduleLesson/WeekAssignment/Holiday/LessonTime yo'q).
  Jurnal ustunlari endi **qo'lda qo'shilgan darslardan** (`LessonNote`: ClassId, SubjectId, Quarter=1, Date, Period,
  Topic, Homework, Conducted) keladi — `JournalService.ComputeColumnsAsync` shularni qaytaradi. "Dars qo'shish" =
  `PUT /api/admin/journal/notes` `conducted:true` bilan (LessonNote upsert → yangi ustun).
- **Kurs (`Subject`) + Guruh (`Group`) modeli** ("Fan biriktirish"/`TeachingAssignment` OLIB TASHLANDI):
  - `Subject` = **Kurs** (UI'da "Kurslar"), `Name` + `Price` (oylik narx).
  - `Group`da endi: `CourseId` (kurs), `TeacherId` (o'qituvchi — guruh yaratishda tanlanadi), `Room`, `StartDate`,
    `Note`, `Days` (List<int> 0=Du..6=Yak), `StartTime`/`EndTime` ("HH:mm"). Guruh yaratish/tahrirlashda `CourseId`
    berilsa **`MonthlyFee` avtomatik kurs `Price`idan** o'rnatiladi.
  - **O'qituvchi↔guruh** = `Group.TeacherId`. "Guruh fani" = `Group.CourseId` (bir guruh — bitta kurs). Jurnal,
    o'qituvchi ilovasi, hisobotlar, davomat shunga tayanadi (eski TeachingAssignment so'rovlari shularga ko'chirildi).
- **Maosh QO'LDA, 2 rejim** (`Teacher.SalaryMode`): **"fixed"** — admin `Teacher.Salary` qat'iy summasini kiritadi;
  **"percent"** — o'qituvchi guruh(lar)idan SHU OYDA haqiqatan yig'ilgan tuition to'lovining `Teacher.SalaryPercent`
  foizi (yig'ilgan sayin o'sib boradi). Hisob: `SalaryLedger.CollectedForTeacherGroupsAsync` — guruh = `Group.TeacherId`;
  to'lov `FinanceTransaction.GroupId` tegiga ega bo'lsa 100% o'sha guruhga, **teglanmagan** to'lov esa o'quvchining shu
  oydagi billable guruhlari `MonthlyFee` nisbatida taqsimlanadi. Frontend `TeacherSalaryPage` (rejim toggle + foiz).
  DIQQAT: `TeachersController.Create/Update` endi `Salary/SalaryMode/SalaryPercent`ni YOZADI (ilgari Salary umuman
  yozilmasdi — latent bug); `TeacherFormModal` bu maydonlarni round-trip qiladi (profil tahrirda reset bo'lmaydi).
- **Quarter** hamon opaque (=1). `TuitionService.SyntheticPeriodsAsync` (sintetik davr) saqlanadi.
- **M2M guruhlar:** `StudentGroup` (StudentId, GroupId, JoinedAt, LeftAt?, IsActive). `Student.ClassName`
  "asosiy guruh" yorlig'i sifatida SAQLANADI (jurnal/chat/hisobot o'zgarmasdan ishlaydi).
- **Billing + a'zolik holati:** `StudentGroup.Status` = "trial" (sinov — to'lov YO'Q) | "active" | "frozen".
  Guruhga qo'shilganda "trial". **Aktivlashtirish** (`/members/{sid}/activate` {date}): birinchi (qisman) oy =
  (guruh `MonthlyFee` ÷ SHU OYDAGI jami dars) × shu sanadan oy oxirigacha qolgan darslar (`group.Days` bo'yicha) —
  qolgan ≤ jami bo'lgani uchun to'liqdan oshmaydi, chegirma qo'llanadi (`TuitionService.ChargeActivationProrateAsync`). **Muzlatish** (`/members/{sid}/freeze`
  {date}): shu oydan boshlab hisoblanmaydi. `AccrueMonth` har oy = FAOL a'zoliklarning `MonthlyFee` yig'indisi —
  faqat Status=="active", aktivlashtirilgan oydan KEYINGI oylar, muzlatish oyidan OLDIN (a'zoligi yo'q o'quvchi — eski
  ClassName narxi). `MonthlyCharge` hamon per (StudentId, Month) aggregate.
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

# Mahalliy ishga tushirish (PostgreSQL kerak — docker: `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=intellectcrm -p 5432:5432 postgres:16-alpine`)
dotnet run --project IntellectCRM.Server          # API + avtomatik migratsiya (baza: intellectcrm)
cd IntellectCRM.Client && npm run dev             # (ixtiyoriy) frontend dev

# Migratsiyani qayta yaratish (model o'zgarsa): Migrations/ ni o'chir -> build -> add
rm -rf IntellectCRM.Infrastructure/Migrations
dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false
dotnet ef migrations add InitialCreate --project IntellectCRM.Infrastructure --startup-project IntellectCRM.Server --no-build
# DIQQAT: ef bilan ishlashda avval BUILD qiling (migratsiya assembly'ga kirishi uchun), so'ng --no-build.
# DIQQAT 2: `migrations add`dan KEYIN `database update --no-build` qilishdan oldin YANA build qiling —
#          aks holda yangi migratsiya assembly'ga kirmaydi va EF "already up to date" deb o'tkazib yuboradi.
```

## 6. Deploy (prod)
```bash
docker compose up -d --build    # app + postgres + cloudflared + backup + mediamtx
```
- **`.env`** (git'ga tushmaydi): `ROOT_DOMAIN=intellectschool.uz`, `APP_HOST=crm.intellectschool.uz`,
  `POSTGRES_PASSWORD` (kuchli!), `POSTGRES_USER`/`POSTGRES_DB` (default intellectcrm), `JWT_KEY`, `TUNNEL_TOKEN` (tunnel `80531fd7`).
- **DB:** PostgreSQL 16 (alpine). Server'da **>=1GB RAM** (+swap tavsiya). Baza `intellectcrm`. Volume `postgres-data`.
- **Cloudflare panel:** Public Hostname `crm.intellectschool.uz` → HTTP → `app:8080`. Ko'chirishda eski serverdagi
  cloudflared'ni to'xtating (bir tokenni 2 joyda ishlatmang).
- App porti internetga ochilmaydi (faqat cloudflared). Backup: kunlik 02:00 Toshkent, `pg_dump`→`.sql.gz`, 7 kun
  (`postgres-backups` volume, backup konteynerda). Restore: `docker exec intellectcrm-backup sh -c "gunzip -c ...|psql"`.
- **Ubuntu/Docker auditi + noldan o'rnatish** — DEPLOY.md "0-bo'lim" (Docker o'rnatish, swap, klon, run, tekshirish).

## 7. Qolgan/ixtiyoriy
- [ ] `intellectcrm-transform` → `master` merge (foydalanuvchi ruxsati bilan).
- [ ] Avtomatik to'lov eslatmasi (oylik hisob yaratilganda Telegram+push).
- [ ] `BillingMode=perGroup` (hozir aggregate; MonthlyCharge unique kalit (StudentId,Month) o'zgartirilishi kerak).
- [ ] `.claude/settings.local.json` ichidagi eski `schoollms.client` yo'llari (lokal, ixtiyoriy).


## 8. Ish jurnali

To'liq o'zgarishlar tarixi alohida faylda: `WORKLOG.md` (kontekstga avtomatik yuklanmaydi).
Kerak bo'lganda qo'lda oching yoki `@WORKLOG.md` orqali import qiling.
