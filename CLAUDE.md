# IntellectCRM — loyiha holati va eslatma (CLAUDE.md)

> Bu fayl har sessiyada o'qiladi. Maqsad: ishni boshidan boshlamaslik. **Har bir muhim
> o'zgarish/buyruqdan keyin pastdagi "Ish jurnali" bo'limini yangilab borish.**

## 1. Loyiha haqida
**IntellectCRM** — bitta o'quv markazi uchun CRM/LMS. `IntellectCRM_TZ.md` bo'yicha eski `SchoolLms`
(maktab LMS, SQL Server) dan to'liq o'zgartirilgan.

- **Backend:** ASP.NET Core 8 (C#), Clean Architecture
- **Frontend:** React + TypeScript + Vite + Tailwind + Recharts
- **DB:** SQL Server (`Microsoft.EntityFrameworkCore.SqlServer`). Lokal dev: LocalDB (`(localdb)\MSSQLLocalDB`, baza `IntellectCRM_DB`). nvarchar — Unicode tabiatan.
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
- **Migratsiya:** bitta `InitialCreate` (53 jadval) — LocalDB (SQL Server) da qo'llanib tasdiqlangan.
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

# Mahalliy ishga tushirish (SQL Server LocalDB — Windows'da o'rnatilgan bo'ladi, alohida docker shart emas)
dotnet run --project IntellectCRM.Server          # API + avtomatik migratsiya (baza: IntellectCRM_DB)
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
docker compose up -d --build    # app + mssql + cloudflared + backup + mediamtx
```
- **`.env`** (git'ga tushmaydi): `ROOT_DOMAIN=intellectschool.uz`, `APP_HOST=crm.intellectschool.uz`,
  `MSSQL_SA_PASSWORD` (murakkab!), `MSSQL_PID=Express`, `JWT_KEY`, `TUNNEL_TOKEN` (tunnel `80531fd7`, sinovdan o'tgan).
- **DB:** SQL Server 2022 (Express, prod uchun bepul, baza <=10GB). Server'da **>=2GB RAM** kerak. Baza `IntellectCRM_DB`.
- **Cloudflare panel:** Public Hostname `crm.intellectschool.uz` → HTTP → `app:8080`.
- App porti internetga ochilmaydi (faqat cloudflared). Backup: kunlik 02:00 Toshkent, `BACKUP DATABASE`→`.bak.gz`, 7 kun.
- Diqqat: `BACKUP DATABASE` faylni mssql konteyner ichiga yozadi — `mssql-backups` volume mssql va backup
  xizmatida ulashilgan; backup xizmati `root` bo'lib volume'ni 777 qiladi (engine `.bak` yoza olishi uchun).

## 7. Qolgan/ixtiyoriy
- [ ] `intellectcrm-transform` → `master` merge (foydalanuvchi ruxsati bilan).
- [ ] Avtomatik to'lov eslatmasi (oylik hisob yaratilganda Telegram+push).
- [ ] `BillingMode=perGroup` (hozir aggregate; MonthlyCharge unique kalit (StudentId,Month) o'zgartirilishi kerak).
- [ ] `.claude/settings.local.json` ichidagi eski `schoollms.client` yo'llari (lokal, ixtiyoriy).

## 8. Ish jurnali (har o'zgarishdan keyin yangilanadi)
- 2026-06-14: **O'qituvchi portali — "Taklif va shikoyat" ekrani qo'shildi.** Backend allaqachon bor edi
  (`POST /teacher/feedback` [FromForm] type/text/image → Feedback{SenderRole=teacher,TeacherId}; admin `FeedbackController`
  SenderRole bilan ko'rsatadi) — faqat UI yo'q edi. `teacher.ts` `sendTeacherFeedback(type,text,image?)` (multipart);
  yangi `pages/teacher/feedback/FeedbackPage.tsx` (teal: Taklif/Shikoyat segment + matn≥5 + ixtiyoriy rasm + toast).
  App.tsx route `teacher/feedback`; `TeacherProfilePage`ga "Taklif va shikoyat" menyu qatori. tsc+vite yashil, deploy ✅.
  Jonli E2E: o'qituvchi POST 204 → admin /admin/feedback teacher-dan 1 ko'rdi. (Test teacher: abduxalilvoxidjonov/5hyeacwi)
- 2026-06-13: **O'qituvchi chat TO'LIQ EKRAN + o'quvchi Progress (Duolingo) chiroyliroq.** (1) **Teacher chat:** suhbatga
  kirilganda marginlar bor edi (`px-4 pb-6 pt-3` o'rab + ChatPanel `h-[70vh]` karta) → endi to'liq ekran. `ChatPanel`ga
  `fullHeight` (kartasiz `h-full flex-col`, composer pastda pinlanadi) + `onBack` (sarlavhada orqaga tugma) proplari
  qo'shildi (admin 2-ustun `h-[70vh]` karta DEFAULT — buzilmadi). `TeacherMessagesPage` suhbat ko'rinishi: o'rovchi
  marginlar olib tashlandi, `<div className="h-full"><ChatPanel fullHeight onBack/></div>`. (2) **Progress Dastur
  (Duolingo yo'l-xaritasi):** `ForecastCard` — kurs rangli gradient fon + so'lg'in bitiruv-shapka dekori; `Roadmap`
  daraja paneli — ta'limiy rangli gradient fon + so'lg'in dekor ikonkalar (`Deco`: book/edit/sparkle/flame/award) +
  yo'l chizig'i o'tilgan qismi kurs rangida (qolgani so'lg'in) + daraja sarlavhasi gradient + ikona qutisi; oxirida
  `FinishNode` (kurs yakuni sovrini — tugatilganda oltin 🏆). Frontend-only, tsc+vite yashil, deploy ✅.
- 2026-06-13: **O'quvchi portali — UY JOYLASHUVI ekrani qo'shildi (student GPS/xaritadan joylashuv yuboradi).**
  Backend allaqachon bor edi (`Student.Latitude/Longitude/LocationAddress/LocationUpdatedAt`, `PUT/GET /student/location`,
  admin `/admin/locations` xaritasi) — student portalida UI YO'Q edi (GPS olib tashlanganda qurilmagan). Qo'shildi:
  `studentPortal.ts` `getStudentLocation`/`updateStudentLocation` + `StudentLocation` tip; yangi `pages/student/Location.tsx`
  (`StudentLocationScreen`) — Leaflet xarita (OSM tile, CDN pin), "Joriy joylashuvim" tugmasi (`navigator.geolocation`
  → marker + recenter), xaritaga bosib yoki marker'ni surib nuqta tanlash, koordinata + oxirgi yangilangan vaqt,
  "Saqlash" → PUT. App.tsx route `student/location`; Profil menyusiga "Uy joylashuvi" (pin, qizil). lib.tsx'ga
  `pin`(MapPin)+`locate`(LocateFixed) ikonkalari. tsc+vite yashil, deploy ✅ (frontend-only, migratsiya yo'q).
  Jonli E2E: E V2 login → PUT (41.311081,69.279737) → GET qaytardi → admin /locations 1 o'quvchi ko'rsatdi. ESLATMA:
  WebView'da GPS uchun Flutter location ruxsatini bersin (onGeolocationPermissionsShowPrompt → grant). Test E V2 paroli
  reset: ev2 / 476eh7fg.
- 2026-06-13: **Telegram kanal tugmasi — bosilganda native ilova ochilmasdi (tuzatildi).** Muammo: banner
  `<a href="https://t.me/..." target="_blank">` edi — Flutter WebView'da `target="_blank"` ko'p-oyna yo'qligida
  HECH NIMA qilmaydi (o'lik tugma), `https://t.me` esa WebView ICHIDA web-sahifa sifatida ochiladi (ilova emas).
  Yechim (`lib/utils`): `telegramTargets(raw)` — manzildan **native `tg://`** (`tg://resolve?domain=` username uchun,
  `tg://join?invite=` +invite/joinchat uchun) VA web (`https://t.me`) havolalarini quradi; `openTelegram(raw)` —
  (1) native ko'prik `window.openExternalUrl` bo'lsa tashqi ilovada ochadi, (2) aks holda `tg://` deep-link bilan
  ilovani ochishga urinadi (same-window, target=_blank EMAS), (3) ~1.2s ichida ochilmasa `https://t.me`ga zaxira
  (visibilitychange bilan aniqlaydi). Ikkala banner (teacher `TeacherDashboard` + student `Dashboard`) `target=_blank`
  o'rniga `onClick→openTelegram(channel)` (preventDefault). `telegramUrl` eski API zaxira sifatida qoldi.
  tsc+vite yashil, deploy ✅ (frontend-only, migratsiya yo'q); bundle'da tg://resolve+tg://join+openExternalUrl,
  jonli yangi bundle. ESLATMA (Flutter, 100% kafolat uchun): WebView `onNavigationRequest`da `http(s)`-bo'lmagan
  sxemalarni (`tg:`) `url_launcher` `LaunchMode.externalApplication` bilan ochsin — shunda `tg://` deep-link
  to'g'ridan-to'g'ri ishlaydi; YOKI Flutter `runJavaScript("window.openExternalUrl=function(u){...}")` o'rnatib
  url_launcher chaqirsin.
- 2026-06-13: **Shartnoma — CUSTOM (matnli) andoza yaratish qo'shildi** (ilgari faqat .docx yuklash bor edi).
  `ContractTemplate`ga `Body` maydoni (custom andoza matni — @-o'rinbosarli); bo'sh bo'lmasa fayl o'rniga matndan
  .docx hosil qilinadi. Inkremental migratsiya `AddContractTemplateBody` (faqat `Body` ustuni — baza saqlandi).
  `ContractService.BuildDocxFromText(body, tokens)` — matnni OpenXML bilan .docx ga aylantiradi (har qator = paragraf,
  @tokenlar almashtiriladi). `ContractsController`: `CreateTemplate` endi fayl YOKI body qabul qiladi; yangi
  `PUT templates/{id}` (faqat matnli andozani tahrir); `Send` custom bo'lsa `BuildDocxFromText`, aks holda eski
  `FillTemplate`. DTO: `ContractTemplateDto`+`Body`, `CreateContractTemplateRequest` FileUrl/FileName/Body nullable.
  Frontend: `ContractsPage`ga "Matnli andoza yaratish" tugmasi + `CustomTemplateModal` (nom + matn textarea + token
  palitrasi — bosilsa kursorga token qo'shadi); matnli andozalar ro'yxatda "Matnli" badge + tahrir (qalam) tugmasi.
  Build: backend 0 xato, tsc+vite yashil, deploy ✅ (Body ustuni qo'llandi). Jonli E2E: create(fayl yo'q)→readback
  (@tokenlar saqlandi)→update→delete hammasi OK.
- 2026-06-13: **Shartnoma (davomi) — custom @-o'rinbosar (doimiy qiymatli) qo'shish.** Foydalanuvchi: matnli
  andozada O'ZI nomlagan @-token + doimiy qiymat kerak (built-in tokenlar ham qoladi). `ContractTemplate.FieldsJson`
  (JSON: [{key:"@direktor",value:"Aliyev A."}]) + inkremental migratsiya `AddContractTemplateFields` (faqat ustun).
  DTO: `ContractFieldDto(Key,Value)`; `ContractTemplateDto`+`Fields`, `CreateContractTemplateRequest`+`Fields?`.
  `ContractsController`: `SerializeFields`/`ParseFields`/`CleanTokenKey` (kalit normallashtirish: bitta @ + faqat
  harf/_, regex bilan mos; bo'sh kalit chiqariladi); Create/Update FieldsJson yozadi; **Send** custom fieldlarni
  per-oluvchi tokenlar bilan birlashtiradi (built-in nom ustun) — BuildDocxFromText VA FillTemplate ikkalasiga
  ham qo'llanadi. Frontend: `CustomTemplateModal`ga "Qo'shimcha o'rinbosarlar" muharriri (kalit+qiymat qatorlari,
  qo'shish/o'chirish; kalit jonli tozalanadi) + custom kalitlar palitrada (binafsha chip, matnga kiritiladi).
  Backend 0, tsc+vite yashil, deploy ✅ (FieldsJson qo'llandi). Jonli E2E: 3 field→2 saqlandi (bo'sh chiqarildi),
  "markaz nomi!!"→@markaznomi, @direktor=Aliyev A. readback OK.
- 2026-06-13: **Pickup (farzandni olib ketish) TO'LIQ olib tashlandi.** `PickupRequest` entity + DbSet (IAppDbContext+
  AppDbContext) + DTO'lar (CreatePickupRequest/PickupRequestDto/HomeroomStudentDto/HandoverRequest) o'chirildi.
  StudentPortalController: `PushToUserAsync`+`PickupDto` helperlar, `POST/GET pickup`, `ResolveOwnStudentAsync`
  (faqat pickup ishlatardi) olib tashlandi; konstruktordan `FcmService fcm` (endi unread) olib tashlandi.
  TeacherPortalController: `PickupDto`, `GET pickups`, `GET homeroom`, `POST homeroom/handover`, `POST pickups/{id}/accept`
  olib tashlandi. Inkremental migratsiya `RemovePickup` (faqat DropTable PickupRequests). Frontend'da pickup UI yo'q
  edi (faqat NOTIF_ICON map'da `pickup` kaliti qoldi — zararsiz). `Teacher.HomeroomClass` maydoni SAQLANDI (ChatService/
  StudentReportBuilder homeroom o'qituvchi yorlig'i uchun). Backend 0 xato, tsc+vite yashil, deploy ✅; jonli:
  student/pickup·teacher/pickups·homeroom·handover hammasi 404.
- 2026-06-13: **Bildirishnoma TASDIQLASH (read-receipt) — admin e'lonida "Tasdiqlash" tugmasi, admin kim tasdiqlaganini
  ko'radi.** `UserNotification`ga `ConfirmedAt` + `PushMessageId` (broadcast'ga bog'lash) + inkremental migratsiya
  `AddNotificationConfirm`. `NotificationStore.Add`ga `pushMessageId`; `MessagesController.SendPush` PushMessage Id'sini
  oldindan yaratib bildirishnomalarni unga bog'laydi. Endpointlar: `POST /student|teacher/notifications/{id}/confirm`;
  `UserNotificationDto`ga `Confirmed`. Admin: `PushMessageDto`ga `ConfirmedCount`+`TargetCount` (PushHistory hisoblaydi);
  `GET /admin/messages/push/{id}/confirmations` (kim tasdiqlagan — ism/guruh/holat). Frontend: student+teacher
  Dashboard bildirishnomasida — `type==='announcement'` bo'lsa **"Tasdiqlash"** tugmasi (bosilsa → "✓ Tasdiqlandi");
  admin `PushComposer` tarixida **"X/Y tasdiqladi"** + bosilsa kim tasdiqlagani ro'yxati. tsc+vite yashil, deploy ✅
  (migratsiya qo'llandi); E2E: admin push → student confirm 204 → admin tarixi confirmedCount 1/1 + "E V2 · TEST-G · tasdiqladi".
- 2026-06-13: **Bildirishnomalar TARIXI — yuborilgan push'lar ilovada saqlanadi (qo'ng'iroq ro'yxati).** Muammo:
  push kelardi-yu, ilovada saqlanmasdi. Yangi `UserNotification` entity (UserId/Title/Body/Type/CreatedAt/ReadAt) +
  inkremental migratsiya `AddUserNotifications` (CreateTable). `NotificationStore.Add(db, userId, title, body, type)`
  helper. Yozish ulandi: **MessagesController.SendPush** (broadcast → AUDIENCE'dagi HAR userga, token yo'q bo'lsa
  ham), **JournalService** baho/davomat push (qayta tuzildi: tarix DOIM yoziladi, so'ng push), **PaymentReminderService**
  (to'lov). Endpointlar (student+teacher, JWT userId bo'yicha): `GET notifications` (unread + items), `POST
  notifications/read`. Frontend: `studentPortal`/`teacher` servislariga `getXNotifications`/`markXNotificationsRead` +
  tiplar; **Student + Teacher Dashboard qo'ng'irog'i** — o'qilmaganlar BADGE + bosilsa panel (ro'yxat: ikona/sarlavha/
  matn/sana) + o'qilgan deb belgilash. Backend 0, tsc+vite yashil, deploy ✅ (migratsiya qo'llandi); E2E: admin push →
  student `/notifications` unread:1 (token 0 bo'lsa ham saqlandi). ESLATMA: ota-ona o'z userId bo'yicha so'raydi
  (bildirishnomalar o'quvchi userId'siga yoziladi — student/teacher uchun ishlaydi).
- 2026-06-13: **Push diagnostikasi — sabab: 0 qurilma ro'yxatda (Flutter token uzatmayapti).** Tekshiruv: Service
  Account SOZLANGAN (configured=true, 2375 belgi), LEKIN `push/devices` count=0 → yuborishga token yo'q, shuning uchun
  hech narsa bormaydi. FcmService kodi to'g'ri (FCM v1 + `notification` bloki). Yaxshilashlar: (1) `FcmService.SendAsync`
  endi muvaffaqiyatsiz FCM javobini (status+body) LOGGA yozadi — token bo'lsa-yu push rad etilsa sababi ko'rinadi
  (yaroqsiz token, loyiha mos kelmasligi). (2) `window.registerFcmToken(token)` global qo'shildi (`push.ts` tipi +
  `AuthProvider` o'rnatadi) — Flutter to'g'ridan-to'g'ri chaqiradigan ishonchli nuqta (window/postMessage'dan tashqari).
  (3) `GET /admin/messages/push/devices` — ro'yxatdagi qurilmalar soni+so'nggilari (debug). Backend 0, tsc+vite yashil,
  deploy ✅; jonli: devices count=0 (Flutter integratsiyasi kerak). HAL: Flutter `getToken()` → `window.registerFcmToken
  ('<token>')`; ruxsat (POST_NOTIFICATIONS) bering; google-services.json Service Account bilan bitta loyiha bo'lsin.
- 2026-06-13: **Telegram kanal — login'da o'qituvchi/o'quvchi dashboardida "Kanalga o'tish" tugmasi.** `CenterMeta.
  TelegramChannel` (inkremental migratsiya `AddTelegramChannel` — faqat AddColumn). Admin Sozlamalar → Telegram'ga
  "Kanal" maydoni (havola yoki @username). Portallarga `school` endpoint orqali chiqadi: `SchoolNameDto`ga
  `TelegramChannel` (default "" — admin getSchoolName buzilmadi); teacher+student `school` endpointlari kanalni
  qaytaradi. `TelegramSettingsDto`/`SaveTelegramSettingsRequest`ga `Channel`. Frontend: `lib/utils.telegramUrl`
  (@username/url→t.me havola); `getTeacherSchool`/`getStudentSchool` kanalni oladi; **teacher Dashboard** banner (teal,
  #229ED9 Telegram rang); **student Dashboard** banner — FAQAT `role==='student'` (ota-ona EMAS, foydalanuvchi talabi).
  Kanal bo'sh bo'lsa banner ko'rinmaydi. Backend 0, tsc+vite yashil, deploy ✅ (migratsiya qo'llandi); E2E: admin kanal
  saqladi → student/school telegramChannel qaytardi. Sinov qiymati tozalandi.
- 2026-06-13: **Push — web tarafda avtomatik qurilma register/unregister HOOK (Flutter WebView uchun).** Yangi
  `api/services/push.ts`: `setFcmToken/getFcmToken` (Flutter `window.__FCM_TOKEN__` yoki `postMessage({type:'fcm-token',
  token})` orqali beradi), `registerDevice/unregisterDevice` (rol bo'yicha `/student` yoki `/teacher` endpoint; parent/
  admin — register endpointi yo'q). `AuthProvider`ga ulandi: **login** → token bo'lsa darhol register (token oxirgi
  kirgan userga bog'lanadi); **logout** → unregister (JWT hali tozalanmagan — explicit Authorization header bilan,
  timing xavfsiz); **postMessage listener** → Flutter token kelganda/yangilanganda (agar kirilgan bo'lsa) qayta register.
  Flutter faqat tokenni `window`ga/postMessage bilan beradi — qolgani avtomatik. tsc+vite yashil, deploy ✅; jonli E2E:
  student token bilan register 200 {ok:true}, unregister 200.
- 2026-06-13: **Push (Firebase) — faqat NATIVE (Flutter) ilovaga soddalashtirildi (PWA/web push olib tashlandi).**
  Loyiha — bitta Flutter WebView ilovasi (student+teacher), push native FCM (firebase_messaging) orqali, web push
  (service worker) WebView'da ishlamaydi. Shuning uchun web config + VAPID kerak emas — faqat **Service Account JSON**
  (server push yuborish). Olib tashlandi: `PushClientConfigDto`; `GET /student/push-config` + `GET /teacher/push-config`
  endpointlari; `SettingsController` `WebPushReady` + web/vapid GET/PUT mantig'i; `FirebaseSettingsDto`/`SaveFirebaseSettingsRequest`dan
  WebConfigJson/VapidKey; frontend `FirebaseConfig`/`SaveFirebaseInput`dan web/vapid; `FirebaseSettings.tsx` qayta yozildi
  (faqat Service Account JSON + Flutter izohi: google-services.json bilan bitta loyiha). `CenterMeta.FcmWebConfigJson/
  FcmVapidKey` ustunlari vestigial qoldi (endi o'qilmaydi/yozilmaydi; migratsiya yo'q). `notifications/register` (token
  ro'yxati) va FcmService/triggerlar (baho/to'lov/e'lon) SAQLANDI. Backend 0, tsc yashil, deploy ✅; jonli:
  push-config 404, firebase sozlama = {serviceAccountJson, configured}. ESLATMA (foydalanuvchiga): native token har
  LOGIN'da register qilinadi (token oxirgi kirgan userga bog'lanadi), logout'da unregister.
- 2026-06-13: **O'quvchi "Umumiy statistika" — to'liq diagrammали ekran (barcha yig'ilgan ma'lumot).** `getStudentNotebook`
  endi typed (`StudentNotebook` interfeysi — grades trend, attendance+reasons, discipline, assignments, oylik
  evaluations/feedback, homework/behavior). `Statistics.tsx` to'liq qayta yozildi (custom SVG/CSS diagrammalar, Recharts
  emas — yengil, blue-temaga mos): KPI plitalar + Baholar trendi (oylik bar) + Fanlar o'rtachasi (HBar) + Davomat
  (donut + kech) + Davomat sabablari (HBar) + Intizomiy ball (ring + rag'bat/jazo) + Topshiriqlar (ring + ball) +
  Oylik feedback (fan kesimida HBar) + Uy vazifa/xulq (donut). Bo'sh bo'limlar avtomatik yashiriladi. Dashboard
  "Umumiy statistika" sarlavhasiga "Batafsil →" (→ /student/statistics) qo'shildi; nb typed. tsc+vite yashil, deploy
  ✅; jonli notebook: davomat 1/2, intizom 100, 1 sabab/feedback.
- 2026-06-13: **O'quvchi Dashboard/Progress qayta tashkil + profildan chorak olib tashlandi.** (1) Duolingo o'quv
  dasturi yo'l-xaritasi (ForecastCard+Roadmap+Node) Dashboard'dan **Progress** tabiga ko'chirildi — Progress segmentlari
  endi **Dastur** (curriculum) · Sinf · Maktab (eski "Fanlar" subjects-progress segmenti almashtirildi; SubjectProgressDetail
  route orphan, zararsiz qoldi). (2) **Dashboard** qayta yozildi: to'liq **FISH bilan salom** ("Salom, {fullName} 👋"),
  tepa-o'ngda **bildirishnoma (qo'ng'iroq)** tugmasi → sheet (hozircha bo'sh holat), **qisqacha ko'rsatkichlar** (Dars
  qoldirdi · Balans · Guruh) + **umumiy statistika** (O'rtacha baho/Davomat%/Intizom/Uy vazifa% — notebook'dan). (3)
  **Profil**dagi "Chorak" ministati olib tashlandi (O'rtacha + Guruh qoldi). tsc+vite yashil, deploy ✅, /student 200.
- 2026-06-13: **Tozalash — eski SchoolLms/ishlatilmayotgan/chorak-hafta APIlar olib tashlandi (audit asosida).**
  Read-only audit agent student vs teacher API'ni solishtirib xavfsiz o'chirish ro'yxatini berdi. **Frontend:**
  o'lik `pages/teacher/journal/JournalPage.tsx` (rout qilinmagan) + `pages/teacher/ui-web/` (**244 MB** eski JSX
  prototip, hech kim import qilmaydi) o'chirildi; `teacher.ts`dan o'lik legacy funksiyalar (getTeacher Lessons/Topics/
  Students/Entries/setEntry/clearEntry/setNote) + ishlatilmagan importlar olib tashlandi. **Backend teacher:** legacy
  chorak endpointlari — `GET journal/students|columns|journal(entries)|notes(GET+PUT)|topics-template|topics-import`,
  `GET progress` — olib tashlandi (PUT/DELETE journal SAQLANDI — modern oylik UI ishlatadi; `Authorized` helper qoldi,
  `TeachesClass` o'lik bo'lib o'chirildi). **Backend student:** `GET homework`, `GET journal` (chorak/hafta, web
  chaqiruvchisi yo'q) olib tashlandi. SAQLANDI (RISKLI/native ilova uchun): pickup/homeroom/location/telegram/
  notifications/push-config/school, chorak opaque plumbing (attendance/subjects-progress, meta currentQuarter/Week),
  shared JournalService/SubjectProgressService. `getTeacherLastMessages` QAYTARILDI (audit xato — `unread-context`
  ishlatadi). Backend 0, tsc yashil, deploy ✅; jonli: o'chirilganlar 404, saqlanganlar 401. **Student↔Teacher API
  taqqoslash:** jurnal (teacher modern oylik + legacy o'chirildi; student chorak o'chirildi), chat (teacher ko'p-kanal
  + last-messages, student bitta-kanal), topshiriq (teacher yozadi/student o'qiydi), LMS (ikkalasi), curriculum
  (ikkalasi CurriculumForecast'dan) — izchil, dublikat yo'q.
- 2026-06-13: **O'quvchi portali — ikonkalar Material Symbols (font) → lucide SVG (WebView'da "icon yo'q, hammasi
  yozuv, algov-dalgov" tuzatildi).** Muammo: student portal ikonkalari Material Symbols Rounded LIGATURE-font edi
  (`<span class="ms">account_balance_wallet</span>`); WebView'da ligature shakllanmagani uchun glyph o'rniga UZUN
  MATN ("account_balance_wallet", "check_circle"...) chiqib, layoutni butunlay buzgan (navbar/sarlavhalar matn,
  ikonkalar yo'q). Yechim: `lib.tsx` `Icon` komponenti endi font o'rniga **lucide SVG** render qiladi (ICONS map:
  kalit→lucide komponent; `fill`→strokeWidth). 17 ekran `<Icon name>` orqali ishlatadi → BIR fayl o'zgarishi hammasini
  tuzatdi (teacher/admin allaqachon lucide ishlatadi — ishonchli). `index.html`dan Material Symbols font linki +
  ortiqcha yuk olib tashlandi (`.ms` CSS klassi ishlatilmaydi, qoldi — zararsiz). tsc+vite yashil, deploy ✅,
  /student 200, index.html'da Material Symbols yo'q. ✅
- 2026-06-13: **O'quvchi portali — telefon/WebView layout tuzatildi (pastki nav pinlanmasdi).** Muammo: `StudentMobileLayout`
  shell `minHeight:100dvh` (FIXED emas) edi → kontent uzun bo'lsa butun ustun o'sib, BODY scroll bo'lardi va pastki
  5-tab nav viewport tagida qolib pinlanmasdi (telefon ilova hissi yo'q). Tuzatish: (1) shell `height:100dvh` +
  `overflow:hidden`, ichki ustun `height:100%` → nav DOIM pastda pinlanadi, kontent o'rtada (header↔nav) scroll bo'ladi,
  nav ostida yashirinmaydi. (2) `.student-app .scroll`ga `min-height:0` (flex scroll to'g'ri ishlashi uchun). (3)
  `.student-app .hd` endi `position:sticky; top:0` — ekran sarlavhalari scroll paytida yuqorida yopishib turadi
  (WebView app-bar hissi; detal ekranlarda orqaga tugma doim ko'rinadi). (4) Chat root `flex:1`→`height:100%` →
  xabarlar ro'yxati scroll, yozish maydoni (composer) pastda pinlanadi. tsc+vite yashil, `app` deploy; built CSS'da
  sticky+min-height:0 tasdiqlandi, /student 200. ✅
- 2026-06-13: **Sinf rahbarligi (homeroom) GURUHLARDAN olib tashlandi + o'quvchi web-login bloki ochildi.**
  (1) **Web-login:** `AuthProvider` student/parent rolini "Mobil ilovadan foydalaning" deb bloklardi (3 joy: login
  throw, readStoredUser, fetchMe effekti) — HAMMASI olib tashlandi. Endi bitta ilovadan (Flutter WebView) o'qituvchi
  ham, o'quvchi/ota-ona ham kira oladi → `/student`. (2) **Sinf rahbari:** o'quv markazida "sinf rahbari" tushunchasi
  kerak emas. `TeacherClassDto`dan `IsHomeroom` olib tashlandi; `TeacherPortalController.Classes()` endi FAQAT
  o'qituvchi dars beradigan guruhlarni qaytaradi (Group.TeacherId==me; homeroom-only sinf inklyuziyasi olib tashlandi).
  Frontend: `TeacherClass.isHomeroom` tipi olib tashlandi; teacher portalida RAHBAR badge (Dashboard "Mening guruhlarim"
  + TeacherGroupsPage), "Sinf rahbarligi" bo'limi (Dashboard), "Rahbarlik" statistikasi (3→2 stat), Profil "Sinf
  rahbarligi" qatori (→ "Guruhlar") — hammasi olib tashlandi. `Teacher.HomeroomClass` entity/pickup-homeroom endpointlar
  QOLDI (alohida vestigial; guruh konteksti emas). Backend 0, tsc+vite yashil, deploy ✅; jonli: `/teacher/classes`
  endi isHomeroom maydonisiz (test B + TEST-G). DIQQAT: test teacher paroli reset (abduxalilvoxidjonov / rqcd8dv3).
- 2026-06-13: **YANGI — O'QUVCHI portali (student web ilova, `student.html` blue dizayni asosida, noldan).**
  Avval student frontend UMUMAN yo'q edi (faqat boy `StudentPortalController` ~40 endpoint). Foundation (men):
  (1) `index.html` TIKLANDI — oldingi moliya commitida (`00a1afa`) tasodifan o'chgan edi (foydalanuvchi student.html
  qo'shganda; `git add -A` o'chirishni commit qilgan) → Vite build buzilgan edi; + Manrope & Material Symbols shriftlari.
  (2) `index.css` — `.student-app` scoped blue dizayn tizimi (student.html'dan 1:1 portlandi: tokenlar light/dark,
  `.card/.btn/.chip/.hero/.ring/.seg/.pill/.field/.ta/.sheet/.tabbar/.hd/.sh/...`, `.ms` Material Symbols).
  (3) `studentPortal.ts` servis (40 endpoint + tiplar). (4) `pages/student/lib.tsx` (Icon/Ring/gradeColor/subjectColor/
  fmtMoney/fmtDate...). (5) `StudentMobileLayout` (480px, 5-tab: Boshqaruv/Progress/Topshiriq/Chat/Profil, light/dark).
  (6) `ProtectedRoute` student darvozasi = student+parent; `homeByRole` student/parent → `/student`; App.tsx 17 route.
  **17 ekran (4 parallel subagent):** Dashboard, Profile, Settings, Account / Progress(+rating), SubjectProgressDetail,
  Grades, Attendance, Discipline, Statistics / Assignments, AssignmentDetail(+test runner), LmsTopics, LmsTopicDetail /
  Chat, Finance, Feedback. **Adaptatsiya:** olib tashlangan funksiyalar (oshxona/avtobus/lokatsiya/jadval/chorak/
  tenant) qurilmadi; chorak opaque=1. tsc 0 (birinchi urinishda), vite yashil, `app` deploy (mssql-data saqlandi).
  **Jonli E2E:** student login (ev2, role=student) → dashboard/me/grades/finance/assignments/rating hammasi 200,
  dashboard "E V2/TEST-G/fee 400k". DIQQAT: test uchun "E V2" o'quvchi paroli reset qilindi (mkcqx9z8). ✅
- 2026-06-13: **Moliya — YANGI "Kurslar" hisobot tabi (kurs/guruh kesimida daromad).** Foydalanuvchi: qaysi kurs
  ko'p daromad keltiradi, qaysi kurs o'quvchilari to'lovni to'liq qildi, qaysi guruh (o'qituvchi) faolroq. Backend:
  yangi `CourseFinanceReport.BuildAsync(db, from, to)` servisi — **yig'ilgan (collected)** = davrdagi tuition
  to'lovlarini guruhga tegishli qilib (teglangan 100%; teglanmagan narx nisbatida billable guruhlarga — `SalaryLedger`
  attribution mantig'i umumlashtirildi, per-guruh + per-(o'quvchi,guruh)); **hisoblangan (billed)** = `MonthlyCharge`
  (Amount−Discount, GroupId yozuvlari); **to'liq to'lagan** = yig'ilgan ≥ hisoblangan (billable ichida). DTO:
  `CourseFinanceReportDto`/`CourseFinanceRowDto`/`GroupFinanceRowDto` (Dtos.cs). Endpoint `GET /admin/finance/
  course-report?from=&to=` (AdminPerm finance). Frontend: `finance.ts` `getCourseReport` + tiplar; `FinancePage`ga
  **"Kurslar"** tab (overview yonida) — 3 stat (jami yig'ilgan/hisoblangan/yig'ilish %), "Kurslar bo'yicha daromad"
  jadvali (daromad reytingi + yig'ilgan bar + yig'ilish % + to'liq to'lagan X/Y), "Guruhlar bo'yicha faollik" jadvali
  (qaysi o'qituvchi guruhi faolroq) + CSV eksport. Davr tanlash mavjud from/to'dan. Backend 0 xato, tsc+vite yashil,
  `app` deploy (mssql-data saqlandi). Jonli: Beginner kursi billed 1.476M/collected 700k/47.4%, guruh breakdown to'g'ri. ✅
- 2026-06-13: **O'qituvchi portali TO'LIQ TEAL REDIZAYN (`teacher.html` namunasi asosida, 1 foundation + 4 parallel
  subagent).** Foydalanuvchi ildizga `teacher.html` (teal mobil UI-kit: Login/Dashboard/Jurnal-picker/Vazifa+FAB/
  Suhbat/Profil, 5-tab teal bottom-nav, Plus Jakarta Sans + JetBrains Mono) qo'shdi — o'qituvchi qismi shunga
  moslandi. **Foundation (men):** (1) `index.html` — Plus Jakarta Sans + JetBrains Mono Google Fonts. (2) `index.css`
  `@theme` — teal-kulrang nomli ranglar: `ink/mute/faint/line/line-soft/paper/paper2/panel2/panel3/tealsoft/chip`
  (teal ramp = Tailwind default `teal-*`, qayta aniqlanmadi; MAVJUD `:root` violet tokenlari bilan to'qnashmaslik
  uchun YANGI nomlar). `.teacher-app` scope: Plus Jakarta Sans, `.teacher-app .font-mono`→JetBrains Mono, yashirin
  scrollbar, `tap-scale`, `--shadow-card/soft/glow/fab`. (3) `TeacherMobileLayout` — global header OLIB TASHLANDI
  (har ekran o'z sarlavhasini beradi), `teacher-app` wrapper, **5-tab teal soft-pill bottom-nav** (Bosh·Jurnal·Vazifa·
  Suhbat·Profil). **Subagentlar (prezentatsiya-only, logika/API saqlandi):** A=Dashboard (salom+sana+stats+rahbarlik+
  guruhlar) + YANGI `groups/TeacherGroupsPage` (Jurnal-tab guruh-picker); B=`TeacherGroupDetailPage` teal reskin
  (jurnal grid+curriculum logikasi tegilmadi); C=Assignments (format chiplari+FAB) + Messages (kanal kartalar+suhbat);
  D=Profil (teal cover karta + ma'lumot qatorlari, **maosh faqat hisoblangan summa, foiz YO'Q**) + Evaluation + LMS
  (yengil). App.tsx: `journal`→TeacherGroupsPage route. tsc 0 (1 unused import tuzatildi), vite yashil, `app` deploy
  (mssql-data saqlandi); jonli /teacher 200, /teacher/journal 200, build CSS'da teal tokenlar+shriftlar tasdiqlandi.
  DIQQAT: faqat `/teacher/*` teal; admin binafsha (Montserrat) o'zgarmadi (token nomlari to'qnashmaydi). ✅
- 2026-06-13: **O'qituvchi portali UX tuzatishlari (3 muammo).** (1) **Profil maoshi — FOIZ/ULUSH ko'rsatilmaydi.**
  `TeacherProfilePage` ilgari foizli rejimda "Ulush X%" ko'rsatardi; endi rejimdan qat'i nazar faqat HISOBLANGAN summa
  ("Joriy oy hisoblandi" = `expected`) + "Berildi" (`paid`) + "Qoldi" (`expected-paid`). `Percent` ikona/`salaryPercent`/
  `salary.salary` UI'dan olib tashlandi (sub matni "Yig'ilgan to'lovga asoslangan"/"Qat'iy oylik"). (2) **Xabarlar
  mobil oqimi.** `messages/MessagesPage` admin 2-ustun `lg:grid` edi → `max-w-md` shell'da stacklanib yaroqsiz
  ko'rinardi. Endi: kanal RO'YXATI (to'liq-kenglik app-kartalar, xodimlar gradient binafsha + guruhlar brend, o'qilmagan
  nuqta) → bosilsa to'liq-ekran suhbat (`ChatPanel`) + "← Kanallar" orqaga tugmasi. (3) **Guruh jurnali — o'quv dasturi
  "kichik/margin" tuzatildi.** `TeacherGroupDetailPage` `CurriculumSection` daraxti ichma-ich 3 qavat bordered/shadow
  karta edi (daraja>mavzu>band) → tekislandi: daraja = yengil yoyiladigan qator (`divide-y`), mavzu = mayda uppercase
  sarlavha, bandlar = TO'LIQ-kenglik check qatorlar (faqat `px-4` inset) → kenglik tiklandi, app-ko'rinish. Frontend-only,
  tsc+vite yashil, `app` deploy (mssql-data saqlandi), jonli /teacher 200, yangi build. ✅
- 2026-06-13: **O'qituvchi portali — "Jurnal" tab olib tashlandi, guruh-ichiga-kirib-oylik-baholash oqimi +
  `teacher_api.md` real API'ga moslandi.** (1) Pastki nav endi 4 tab: Bosh sahifa · Topshiriqlar · Xabarlar · Profil
  ("Jurnal" tab/route olib tashlandi; `JournalPage.tsx` faylda qoldi, import/route yo'q). (2) Bosh sahifada
  o'qituvchi guruhlari KARTA (bosiladi) → `/teacher/groups/:id` → yangi `TeacherGroupDetailPage` (admin
  `ClassDetailPage` ko'rinishi mobilga moslangan): oy chiplari + oylik jurnal grid (sticky o'quvchi ustuni, gorizontal
  scroll, katak bosilsa `JournalCellModal`, sarlavha-sana bosilsa ommaviy davomat) + collapsible o'quv dasturi
  (sillabus) bo'limi (prognoz + bandlar checkbox). Backend ENDPOINTLAR avval qo'shilgan (zamonaviy, o'qituvchiga
  skoplangan): `GET /teacher/journal/group?classId&month`, `PUT /teacher/journal` (quarter/period opaque=1,
  subjectId=courseId), `DELETE /teacher/journal`, `POST /teacher/journal/bulk-attendance`, `GET /teacher/curriculum/
  group/{id}`, `POST .../cover`, `POST .../revision` — hammasi `ResolveOwnedGroup` (Group.TeacherId==me) bilan
  himoyalangan. (3) `teacher.ts` servisga shu funksiyalar qo'shildi (`GroupJournal`/`GroupCurriculum` tiplari admin
  servislardan import). (4) `teacher_api.md` TO'LIQ qayta yozildi: bitta-markaz login (tenant/409/maktab kodi olib
  tashlandi), jurnal CHORAK→OYLIK guruh-asosli (ASOSIY bo'lim), sillabus o'tilishi bo'limi qo'shildi, mavjud bo'lmagan
  endpointlar (schedule/holidays/quarter-grades) olib tashlandi, eski chorak endpointlar "Legacy" deb belgilandi,
  Base URL `crm.intellectschool.uz`. Build: tsc 0 + vite yashil, `app` deploy (mssql-data saqlandi), jonli: /teacher
  200, journal/group+curriculum/group 401 (ulangan), /teacher/groups/:id SPA 200. ✅
- 2026-06-08: Faza 0-10 bajarildi (MySQL ko'chish, namespace/entity rename, modul olib tashlash, M2M
  guruhlar, Leads CRM, infra). Backend+frontend build yashil. Branch `intellectcrm-transform`, 12 commit.
- 2026-06-09: Mijoz proyekti `schoollms.client` → `IntellectCRM.Client` (commit `e967b0a`).
- 2026-06-09: `.env` MySQL formatiga + yangi Cloudflare token (`80531fd7`); `APP_HOST=crm.intellectschool.uz`
  (subdomen). Token jonli sinovdan o'tdi ("Registered tunnel connection"). `dotnet run` → `--project IntellectCRM.Server`.
- 2026-06-09: **DB MySQL → SQL Server** (lokal). `Pomelo.EntityFrameworkCore.MySql` → `Microsoft.EntityFrameworkCore.SqlServer`;
  `Program.cs` `UseMySql` → `UseSqlServer`; `AppDbContext` dan `HasCharSet/UseCollation(utf8mb4)` olib tashlandi;
  connection string → `(localdb)\MSSQLLocalDB;Database=IntellectCRM_DB`. Beshta `decimal` (Teacher.BonusPct,
  CenterMeta.SalaryRate1/2/Mutaxasis/Oliy) ga `HasPrecision(18,2)` qo'shildi. LMS FK mosligi uchun
  `LmsSubject/LmsModule/LmsTopic.Id` → `HasMaxLength(200)` (string PK default nvarchar(450), FK ustun 200 edi;
  kompozit indeks 900 bayt limiti uchun ham 200 kerak). `InitialCreate` qayta yaratildi va LocalDB'ga qo'llandi
  (53 jadval, 7 FK). Build (solution, SPA'siz) yashil.
- 2026-06-09: **Docker prod ham SQL Server'ga o'tkazildi.** `docker-compose.yml`: `mysql:8.0` → `mcr.microsoft.com/mssql/server:2022-latest`
  (Express, `mssql-data`+`mssql-backups` volume, sqlcmd healthcheck); app connection string → `Server=mssql,1433;...TrustServerCertificate=True`;
  backup `mysqldump` → `BACKUP DATABASE`+gzip (umumiy volume orqali, chunki SQL Server .bak'ni server konteyneriga yozadi).
  `.env.example`: `MYSQL_ROOT_PASSWORD` → `MSSQL_SA_PASSWORD`+`MSSQL_PID`. `DEPLOY.md` yangilandi. `docker compose config` → exit 0 (validatsiya o'tdi).
- 2026-06-09: **Docker stack jonli sinovdan o'tdi.** `docker compose up` → mssql healthy, app migratsiya qilib `IntellectCRM_DB`
  (53 jadval) yaratdi, login API HTTP 200 + JWT, backup zanjiri (`BACKUP DATABASE`→gzip umumiy volume orqali) ishladi.
- 2026-06-09: **Super admin bootstrap qo'shildi** (`Program.cs` seed bloki). Ilgari hech qanday admin SEED QILINMAGAN edi —
  `Users` bo'sh, kira oladigan hech kim yo'q edi (multi-tenant olib tashlanganda bootstrap ham yo'qolgan). Endi birinchi
  ishga tushishda `Users` bo'sh bo'lsa `Roles.SuperAdmin` yaratiladi; login/parol `Seed__OwnerLogin`/`Seed__OwnerPassword`
  (compose: `OWNER_LOGIN`/`OWNER_PASSWORD`) dan, berilmasa generatsiya + logga yoziladi. DIQQAT: `AppUser.Email` aslida
  USERNAME (login), email emas. `PlatformOwner` roli hech bir `[Authorize]` da ishlatilmaydi — funksional super admin = `superadmin`.
- 2026-06-10: **MUHIM jarayon o'zgarishi — bazani BUZMASLIK.** Endi har sxema o'zgarishida INKREMENTAL migratsiya
  (`migrations add <nom>` — Migrations/ ni O'CHIRMASDAN, InitialCreate'ni qayta yaratmasdan); app `Migrate()` mavjud
  bazaga `ALTER` qo'llaydi; docker `app` qayta quriladi, `mssql-data` volume O'CHIRILMAYDI. Ma'lumot saqlanadi.
- 2026-06-10: O'quvchi formasi lid kabi: o'z `Phone` + `Father/Mother(FullName,Phone)`; `ParentFullName/Phone` ota
  (bo'lmasa ona)dan avtomatik (portal login/Telegram/e'lon uchun); portal login ota YOKI ona raqamiga mos. Ota-ona
  rasmi olib tashlandi. (StudentPayload'da ParentFullName/Phone endi nullable.)
- 2026-06-10: **A'zolik holati + qisman-oy billing.** `StudentGroup`ga `Status`(trial/active/frozen)/`ActivatedAt`/
  `FrozenAt` (inkremental migratsiya `AddMembershipStatus` — baza saqlandi). A'zolar modalida Aktivlashtirish/Muzlatish
  (sana bilan). Aktivlashtirishda qisman oy = (oylik÷12)×qolgan darslar. Jonli sinov: 1.2M kurs, 15-iyun aktiv → 700k
  (7 dars × 100k), balans/MonthlyCharge to'g'ri. Build backend 0, tsc+vite yashil.
- 2026-06-09: **Avtobus-GPS to'liq olib tashlandi.** Backend: `Bus`/`BusLocation` entity, `Buses`/`BusLocations` DbSet
  (AppDbContext+IAppDbContext), `GpsService`, `GpsController`, `GpsIngestController`, `CenterMeta.Gps*` (5 maydon),
  `SettingsController` gps endpointlari, `StudentPortalController` avtobus oynasi (uy-joylashuv QOLDI), Dtos Bus/Gps
  recordlari, `LiveHub` doc gps eslatmasi. Frontend: `gps/GpsPage`, `GpsSettings`, `api/services/gps.ts` o'chirildi;
  `navigation`/`App.tsx`/`constants`/`SettingsPage`/`settings.ts`/`landing.html` tozalandi. Migratsiya qayta yaratildi
  → 53→**51 jadval**. Build: backend 0 xato, `tsc -b`+`vite` yashil. Docker qayta qurildi (toza DB, 51 jadval,
  admin qayta seed), login HTTP 200, eski GPS endpointlar 404. `PickupRequest` ataylab SAQLANDI (avtobus emas).
- 2026-06-09: **Lid formasi qayta tuzildi.** `Lead`dan `TargetGrade` ("nechinchi guruh"), `ParentFullName`, `ParentPhone`
  olib tashlandi; qo'shildi: `Phone` (o'quvchi o'z raqami), `FatherFullName`+`FatherPhone`, `MotherFullName`+`MotherPhone`
  (ota va ona ALOHIDA). DTO (LeadCreate/Update), `LeadsController` (Create/Update + Convert: Student'da bitta ota-ona
  maydoni bo'lgani uchun ota asosiy, bo'lmasa ona; lid o'z raqami Lead'da qoladi), frontend (`types`, `LeadFormModal`,
  `LeadCard`, `LeadDetailModal`, mock) yangilandi. Migratsiya qayta yaratildi. Build yashil; Docker'da lid yaratish
  HTTP 200 + maydonlar saqlandi. ESLATMA: Student modeli o'zgarmadi (hali bitta ota-ona maydoni).
- 2026-06-09: **Dars jadvali to'liq olib tashlandi + jurnal qayta qurildi** (eng katta o'zgarish; 2 subagent parallel —
  backend `.cs` + frontend `.ts`, kesishmaydigan fayllar). O'chirildi: ScheduleTemplate/ScheduleLesson/WeekAssignment/
  Holiday/LessonTime entitylari, jadval/bayram/dars-vaqti kontrollerlari (ScheduleTemplates/Holidays/ScheduleUtils/
  WeekAssignments), PortalSchedule servisi, 5 menyu + frontend sahifalar (guruh/o'qituvchi jadvali, jadval yaratish,
  bayram, dars vaqti). Yangi: `TeachingAssignment` entity + controller + "Fan biriktirish" admin sahifasi. Jurnal:
  ustunlar qo'lda darslardan (LessonNote) + "Dars qo'shish" tugmasi. Maosh qo'lga o'tdi (`TeacherSalaryPage`).
  8 servis (Journal/Analytics/Rating/Chat/SubjectProgress/StudentReport/TeacherActivity/Turnstile/Salary) +
  Attendance/Settings/Classes/ClassAnalytics/TeacherPortal/StudentPortal kontrollerlari sxemasiz modelga ko'chirildi.
  Migratsiya qayta yaratildi (47 jadval). Build: backend 0 xato, tsc+vite yashil. Docker jonli sinov: login OK,
  `/api/admin/teaching-assignments` 200, eski jadval/bayram/dars-vaqti endpointlari 404. `Fanlar`+`Davomat sabablari` qoldi.
- 2026-06-10: **Kurs/Guruh modeli (2 subagent parallel).** "Fanlar" → **"Kurslar"** (`Subject`ga `Price` qo'shildi).
  **"Fan biriktirish" (`TeachingAssignment`) butunlay olib tashlandi** — o'qituvchi endi GURUH yaratishda biriktiriladi.
  `Group`ga qo'shildi: `CourseId`, `TeacherId`, `Note`, `Days`, `StartTime`, `EndTime` (Room/StartDate bor edi); kurs
  tanlanganda `MonthlyFee` avtomatik kurs narxidan. Barcha eski TeachingAssignment so'rovlari `Group.TeacherId/CourseId`ga
  ko'chirildi (~12 servis/kontroller). Frontend: Kurslar+narx, guruh formasi (kurs→narx, xona, sana, o'qituvchi, izoh,
  hafta kunlari, vaqtlar), Fan-biriktirish sahifasi o'chirildi. Migratsiya qayta yaratildi. Build: backend 0, tsc+vite yashil.
  Docker jonli sinov: kurs(narx 500000) → guruh yaratildi → **MonthlyFee avtomatik 500000**, days/vaqt/xona saqlandi. ✅
- 2026-06-10: **Aktivlashtirish billing formulasi to'g'rilandi + super-admin oylik tahrir.** Qisman-oy = `oylik × qolgan_dars
  ÷ SHU_OYDAGI_jami_dars` (ilgari `÷12` edi → oy boshida to'liq oyga yopishardi). `TuitionService.ChargeActivationProrate`
  (`LessonsInRange` guruh `Days` bo'yicha). Jonli DB'da eski `÷12` yozuvlari to'g'ri formulaga moslandi (TEST-G,
  1.2M/13 = 92307.69/dars). **Super admin** oylik HISOBLANGAN summani qo'lda tahrirlay oladi: `PUT /admin/students/{id}/
  charges/{month}` (`[Authorize(SuperAdmin)]`, `EditChargeRequest`, balans effektiv farqqa moslanadi, auditga yoziladi);
  frontend `PaymentHistoryModal` "Hisoblangan" katagi super-admin uchun inline tahrirlanadi (`editStudentCharge`).
- 2026-06-10: **O'quvchi daftari (StudentDetailPage) choraklik → OYMA-OY** (Part 3). `StudentProfileBuilder` baho/davomat/
  uy-vazifa-xulqni `JournalEntry.Date[..7]` (oy) bo'yicha guruhlaydi (ilgari opaque `Quarter`). Yangi DTO: `MonthMarksDto`,
  `MonthlyAttendanceDto`; `StudentNotebookDto.Grades`=fan→oy→baho, `Attendance`=oylik, `MarksTrend`=oylik. `StudentReportDto`/
  `StudentAttendanceDto` (portal+baholar-hisoboti) TEGILMADI — izolyatsiya. Frontend: oylar qabul oyidan joriy oygacha
  uzluksiz (`monthRangeList`), grafik/jadval/tugmalar oy bo'yicha. Build: backend 0, tsc+vite yashil, deploy ✅ (DB saqlandi).
  QOLDI: Part 2 — guruh detal sahifasi + guruh `Days` bo'yicha avtomatik OYLIK jurnal (faqat aktiv o'quvchilar, oyma-oy nav).
- 2026-06-10: **Guruh OYLIK jurnali + guruh detal sahifasi** (Part 2). Backend: `JournalService.GroupMonthAsync` +
  `GET /admin/journal/group?classId=&month=` → guruh ma'lumoti (kurs/o'qituvchi/kunlar/vaqt) + mavjud oylar (guruh
  StartDate/eng-erta a'zolikdan joriy oygacha) + ustunlar **guruh `Days` bo'yicha shu oydagi sanalardan AVTOMATIK**
  (`LessonDatesInMonth`, Period=1) + faqat FAOL a'zolar + shu oy yozuvlari. Fan = guruh `CourseId`. DTO: `GroupJournalDto/
  Info/Student`. Frontend: `ClassDetailPage` to'liq qayta yozildi — guruh ma'lumot kartasi + oylik jurnal grid (oyma-oy
  nav, sticky o'quvchi ustuni, status badge, katak bosilsa mavjud `JournalCellModal`). Yozuv `setJournalEntry`
  (subjectId=CourseId, quarter=1, period=1). Jonli sinov (TEST-G, 074bb979…): 13 dars ustuni (Du/Chor/Juma iyun), 10
  faol o'quvchi; PUT baho→204→jurnalda ko'rindi→daftarda oylik baho `{kurs:{"2026-06":5}}`. Build: backend 0, tsc+vite
  yashil, deploy ✅ (DB saqlandi).
- 2026-06-10: **Guruh jurnali — muzlatilganlar grid'dan chiqarildi + "Jurnal" menyusi olib tashlandi + o'quvchi
  guruhlari kartalari.** (1) `ClassDetailPage` jurnal grid'i endi faqat `status != 'frozen'` (faol/sinov) o'quvchilarni
  ko'rsatadi; muzlatilganlar jadval ostida alohida "Muzlatilgan — jurnalga qo'shilmagan" ro'yxatida (frontend filtri).
  (2) "O'quv bo'limi" menyusidagi **"Jurnal"** (`/admin/journal`) butunlay olib tashlandi: `navigation.ts` band,
  `App.tsx` route+import, `pages/admin/journal/JournalPage.tsx` o'chirildi (jurnal endi faqat guruh sahifasidan).
  `JournalCellModal.tsx` SAQLANDI (o'qituvchi ilovasi + guruh jurnali ishlatadi). (3) `StudentGroupDto` boyitildi
  (Status/CourseName/TeacherName/MonthlyFee/Days/StartTime/EndTime/Room); `ClassesController.StudentGroups` shularni
  qaytaradi; `StudentDetailPage`da "Guruhlar" bo'limi — o'quvchining har bir guruhi KARTA (kurs/o'qituvchi/holat/kunlar/
  vaqt/narx), guruh sahifasiga havola. Build: backend 0, tsc+vite yashil; jonli sinov: E V2 (active)/Test Aziz (frozen)
  guruh kartalari to'g'ri. Deploy ✅ (DB saqlandi).
- 2026-06-10: **Guruh jurnali — jadval ko'rinishi + sarlavha sanasi bilan ommaviy davomat.** (1) Jurnal grid'i
  haqiqiy jadval ko'rinishida: vertikal+gorizontal chiziqlar (`border-r`/`border-b`), o'quvchi ustuni sticky+qalin
  ajratgich (`border-r-2`), sarlavha to'q fon (`bg-slate-100`), zebra qatorlar (`even:bg-slate-50`), bugungi kun
  ustuni ajratilgan (`today`). (2) **Sarlavhadagi sana bosilsa** — shu kun uchun BARCHA (faqat faol/sinov) o'quvchiga
  birdan davomat modali: "Hammasi keldi (bor)" yoki "Hammasi kelmadi" (sabab tanlab). Backend: `BulkAttendanceRequest`
  + `JournalService.BulkAttendanceAsync` (reasonId null → dars o'tildi + sabablar tozalanadi; reasonId → har kimga
  shu sabab) + `POST /admin/journal/bulk-attendance`. Frontend: `bulkAttendance` servis + `ClassDetailPage` modal.
  Jonli sinov: 9 faol o'quvchi (frozen chiqarib), "Hammasi keldi" → 204 + LessonNote Conducted=1. Deploy ✅.
  ESLATMA: "Hammasi kelmadi" sabab tugmalari uchun Sozlamalar → Davomat sabablari'da sabab bo'lishi kerak (hozir bo'sh).
- 2026-06-10: **Jurnal kataklari to'liq rangli (keldi=yashil, baho=bahoga qarab).** `GroupJournalDto`ga
  `ConductedDates` (o'tildi deb belgilangan dars sanalari) qo'shildi. Katak rangi: baho bo'lsa to'liq fon bahoga
  qarab (`gradeFill`: 5=yashil,4=ko'k,3=sariq,past=qizil); sabab bo'lsa qizil/sariq (kech); **keldi** (dars o'tildi +
  baho yo'q + sabab yo'q) = **yashil ✓**; aks holda kulrang "·". "Hammasi keldi" bosilsa shu kun `conducted` bo'lib,
  sababsiz hamma yashil ✓ bo'ladi. Jonli sinov: bulk-present 06-08 → conductedDates'da chiqdi. Deploy ✅ (DB saqlandi).
- 2026-06-10: **Ommaviy davomat — "Hammasi kelmadi (yo'q)" qo'shildi + "Sabablar" menyusi ko'chirildi.**
  `BulkAttendanceRequest`ga `bool Absent` qo'shildi: false→keldi (sabab tozalanadi), true→kelmadi (ReasonId berilsa
  shu sabab, aks holda BIRINCHI kech-bo'lmagan sabab, umuman yo'q bo'lsa standart **"Sababsiz"** AVTOMATIK yaratiladi —
  shuning uchun "yo'q" sozlamasiz ham ishlaydi). Modal: ikki asosiy tugma — yashil "✓ Hammasi keldi" + qizil
  "✗ Hammasi kelmadi"; sabablar sozlangan bo'lsa qo'shimcha "sabab bilan kelmadi" tugmalari. `bulkAttendance` servisi
  `{absent, reasonId}` qabul qiladi. Jonli sinov: absent 06-10 → 9 yozuv + "Sababsiz" avto-yaratildi (sinov tozalandi).
  **Navigatsiya:** "Davomat sabablari" Kurslar submenyusidan olib tashlandi; O'quv bo'limi ichiga to'g'ridan-to'g'ri
  **"Sabablar"** (`/admin/settings/reasons`, perm `settings`) qo'shildi; "Kurslar" oddiy bandga aylandi. Deploy ✅.
- 2026-06-10: **O'quv bo'limidan "Davomat" olib tashlandi** (davomat endi guruh jurnalida bor/yo'q orqali). `navigation.ts`
  band, `App.tsx` route+import o'chirildi, `pages/admin/attendance/` (AttendancePage+SubjectAttendanceModal) o'chirildi.
  O'quv bo'limi endi: Kurslar · Sabablar · Baholar hisoboti · Intizomiy ball · Shartnomalar. Build yashil, deploy ✅.
- 2026-06-10: **"Baholar hisoboti" to'liq olib tashlandi** (chorak-asosli, monthly modelga zid edi). Frontend: nav band,
  App.tsx route+import, `pages/admin/grades-report/` (4 sahifa), `services/gradesReport.ts`, `pages/ComingSoon.tsx`,
  `constants.ts` `gradesReport` perm kaliti o'chirildi. Backend: `ClassAnalyticsController` 3 endpoint (grades-report/
  school|class|student) + faqat ular ishlatgan yordamchilar (ClassStat/Classify/ComputeStat/ClassRow/ParallelRow/
  AggregateRow/LangLabel/...) olib tashlandi; `Performance`/`Stats`/`Rating` SAQLANDI. DTO: GradesProgressReportDto/
  RowDto, ClassReportDto/StudentDto o'chirildi; `StudentReportDto`/`StudentReportBuilder`/`StudentAttendanceDto` PORTAL
  uchun SAQLANDI. O'quv bo'limi endi: Kurslar · Sabablar · Intizomiy ball · Shartnomalar. Build yashil, deploy ✅.
- 2026-06-10: **Guruh jurnali UI: oy tugmalari + o'quvchidan aktiv/muzlat + qarz rangi + a'zolar modali chiroyliroq.**
  (1) Oy navigatsiyasi dropdown→yonma-yon tugmalar (faqat mavjud oylar). (2) Jurnalda o'quvchi nomi (yoki muzlatilganlar
  ro'yxati) bosilsa modal: sana bilan Aktivlashtirish/Muzlatish (`activateMember`/`freezeMember`). (3) Qarz rangi:
  `GroupJournalStudentDto`/`GroupMemberDto`ga `Balance` qo'shildi — qarzi yo'q=yashil, qarz=qizil (nuqta+nom). (4)
  `ClassMembersModal` aktiv/muzlat tugmalari yorliqli pill'ga aylandi + qarz rangi. Frontend `GroupJournalStudent`/
  `GroupMember` tiplari `balance` oldi. Build yashil, deploy ✅; jonli: E V2 balance −1.1M qaytdi.
- 2026-06-10: **PLATFORMA AUDITI — tozalash (A,C) + bug tuzatish (D).** 4 parallel agent audit qildi.
  **A (o'lik kod):** `ScheduleMath.cs`, ~18 o'lik DTO (Schedule/Holiday/LessonTime/Quarter/Feedback/StudentGroups
  qoldiqlari), frontend `services/attendance.ts`+`lib/weeks.ts`, `constants` (gradeOptions/weekDays/schedulePeriods),
  o'lik perm kalitlari (crmStats/attendance/journal) o'chirildi; `schedule` perm yorlig'i "Kurslar"ga. `appsettings`
  `Tenancy:PlatformSubdomains` olib tashlandi. **C:** `SalaryRatesController` + Teachers `salary-payments`/`salary-history`
  + orfan maosh DTO klasteri o'chirildi (maosh qo'lda); `AttendanceController` + 3 attendance DTO o'chirildi (Davomat
  sahifasi olib tashlangan, frontend chaqirmaydi); eski SchoolLms nusxasi (`.claude/worktrees/...` 6.6M) o'chirildi;
  `IAppDbContext`ga `LmsModules` qo'shildi. **D (bug):** (1) aktivlashtirish proratesi IDEMPOTENT (qayta aktivda
  ustiga qo'shmay almashtiradi); (2) **ClassName↔a'zolik**: `StudentProfileBuilder`/`StudentReportBuilder` endi FAOL
  a'zolik guruhlari bo'yicha (yo'q bo'lsa ClassName); `StudentsController.Update` a'zolikli o'quvchida ClassName-billing
  qilmaydi; (3) `MonthlyCharge.Locked` (inkremental migratsiya `AddMonthlyChargeLocked`): EditCharge Locked qo'yadi,
  Update/kurs-narx Locked'ni o'zgartirmaydi; (4) guruh/o'quvchi o'chirilganda bog'liq qatorlar ham o'chiriladi + faol
  a'zo bo'lsa bloklanadi. Build 0 xato, tsc+vite yashil, deploy ✅, smoke-test o'tdi. **QOLDI (B):** o'qituvchi React
  portali + `ui-web` — erishib bo'lmaydi, deployda `/teacher/` PWA YO'Q (404); o'chirish xavfsiz, foydalanuvchi qaror qiladi.
- 2026-06-10: **Muzlatish QISMAN hisob + to'lov-tahrir o'quvchi sahifasida + muzlatilganlar baho/davomati ko'rinadi.**
  (1) `TuitionService.ChargeFreezeProrateAsync` + `FreezeMember` chaqiradi: muzlatish OYI = shu sanagacha qatnashgan
  darslar uchun qisman (fee × muzlatishgacha_dars ÷ jami; faol-boshlanish = shu oyda aktiv bo'lsa o'sha sana, aks holda
  oy boshi); idempotent + Locked'ni hurmat qiladi. Jonli: Erta T 06-02→06-15 muzlat → June 461538.46 (5/13). (2)
  `PaymentHistoryModal` `student`→`studentId` ga refaktor; `StudentDetailPage`ga "To'lov tarixi" tugmasi qo'shildi
  (super admin o'sha yerdan hisoblangan oylikni tahrirlaydi) — `StudentsPage` ham moslandi. (3) Guruh jurnalida
  muzlatilganlar endi jadval OSTIDA read-only qatorlar (baho/davomat ustunlari bilan ko'rinadi, SAQLANADI) — avvalgi
  oddiy ro'yxat o'rniga; nomi bosilsa aktivlashtirish. (4) Muzlatilganlar ro'yxati tagma-tag. Build yashil, deploy ✅.
- 2026-06-10: **To'lov tarixi crash (oq ekran) tuzatildi + oy×kurs breakdown.** Crash sababi: `EditCharge` audit
  `action="edit"` yozardi, `AuditHistoryList` esa faqat create/update/delete'ni biladi → `actionConfig["edit"]`
  undefined → render crash. Tuzatish: `AuditHistoryList` noma'lum action'ga fallback (`?? {label, cls}`), `EditCharge`
  endi `"update"`. **Breakdown:** `MonthLedgerDto`ga `List<MonthCourseDto> Courses` qo'shildi — `StudentLedger`
  a'zolik (sana oralig'i) yoki ClassName bo'yicha har oy uchun kurs nomi+narxini hisoblaydi; `PaymentHistoryModal`
  oy ostida kurslarni ko'rsatadi. Jonli: Voxidjonov June → matematika 500k + ingliz tili 1.2M. Build yashil, deploy ✅.
- 2026-06-10: **O'quvchi "Oylik feedback" bo'limi — barcha kurslar chiqadi.** Bug: `StudentProfileBuilder`
  `evalsBySubject` faqat baho QO'YILGAN fanlarni guruhlardi → ko'p guruhli o'quvchida boshqa kurslar chiqmasdi.
  Tuzatish: `evalsBySubject` endi `report.Subjects` (o'quvchining barcha biriktirilgan kurslari) bo'yicha quriladi —
  baho yo'q kurs ham ko'rinadi (bo'sh oylar bilan). Jonli: Voxidjonov feedback → ingliz tili + matematika ikkalasi. Deploy ✅.
- 2026-06-10: **Baholash (feedback) sahifasi guruh-asosli + filtrlar bir qatorda.** Bug: guruh filtri o'quvchilarning
  ClassName'idan qurilardi → hamma ClassName=TEST-G bo'lgani uchun faqat TEST-G chiqardi; ko'p guruhli o'quvchi boshqa
  guruhida baholanmasdi. Tuzatish: `StudentEvaluationController.GetBoard`ga `groupId` param + `Groups` (barcha guruhlar)
  + `GroupId` qaytariladi; guruh tanlansa SHU guruh FAOL a'zolari + fan=guruh `CourseId` (shu kurs bo'yicha baho);
  qatnashish hisobi ham tanlangan guruh bo'yicha. Frontend `StudentEvaluationPage`: Guruh dropdowni (board.groups'dan),
  filtrlar BIR QATORDA (Oy·Guruh·Fan·qidiruv·saralash), guruh tanlansa Fan locked (=guruh kursi). Jonli: test B → matematika
  (Voxidjonov), TEST-G → ingliz tili — bitta o'quvchi ikkala guruhida baholanadi. Build yashil, deploy ✅.
- 2026-06-10: **O'quvchilar ro'yxatida BARCHA a'zo guruhlar.** `Student` entity'ga `[NotMapped] List<string> Groups`;
  `GetAll` M2M faol a'zoliklardan guruh nomlarini to'ldiradi (DB'ga yozilmaydi). Frontend `Student.groups`; jadval
  "Guruh" ustuni barcha guruhlarni chip sifatida (a'zolik bo'lmasa ClassName), filtr+eksport ham guruhlar bo'yicha.
  Jonli: Voxidjonov ['test B','TEST-G']. Deploy ✅. **Foydalanuvchi avtonomiya berdi — har o'zgarishda ruxsat so'ramayman.**
- 2026-06-11: **Dashboard "Eng yuqori bahoga ega guruhlar" 0 o'quvchi bug'i tuzatildi.** `DashboardController` guruh
  o'quvchilarini `Student.ClassName == guruh.Name` bilan sanardi (M2M'gacha qolgan) → a'zolik orqali qo'shilgan
  o'quvchi 0 chiqardi. Endi `StudentGroups` (faol a'zolik) bo'yicha sanaladi (`topClasses` + davomat). Jonli DB:
  test B 0→1, TEST-G 11. Deploy ✅.
- 2026-06-11: **O'qituvchi FOIZLI maoshi + guruh-teglangan to'lov.** (1) `Teacher.SalaryMode`(fixed/percent) +
  `SalaryPercent`; foizli rejimda oylik = guruhdan shu oyda yig'ilgan to'lovning foizi (`SalaryLedger`). (2)
  `FinanceTransaction.GroupId` — o'quvchi to'lov kiritishda bir nechta guruhda bo'lsa QAYSI guruh uchun ekani so'raladi
  (`PaymentModal` selektori; bitta guruh — avtomatik); teglangan to'lov 100% o'sha guruhga, teglanmagan — fee nisbatida.
  (3) `TeacherSalaryPage` rejim toggle + foiz. (4) Latent bug: `TeachersController` ilgari `Salary`ni umuman yozmasdi —
  endi yoziladi; `TeacherFormModal` salary maydonlarini round-trip qiladi. Inkremental migratsiya
  `AddSalaryPercentAndPaymentGroup` (Teachers.SalaryMode/SalaryPercent, FinanceTransactions.GroupId — baza saqlandi).
  Jonli sinov (Foiz Test 40%, test B, Voxidjonov ikki guruhda): teglangan 500k→200k (100% test B); teglanmagan 1.7M→
  +200k (500/1700 ulush); iyun jami 400k. ✅ Sinov ma'lumotlari tozalandi (balans/guruh/o'qituvchi tiklandi). Deploy ✅.
- 2026-06-11: **"Toifa" (Category) UI olib tashlandi** — maosh endi qat'iy/foizli (soat narxi/toifaga bog'liq emas).
  `TeacherFormModal` (yaratish/tahrir) toifa selektori o'chirildi + maosh izohi yangilandi; `TeachersPage` "Toifa"
  ustuni, `TeacherViewModal` "Toifa" qatori "Maosh turi" (qat'iy summa / foiz)ga almashtirildi. `Teacher.Category`
  entity/DB'da opaque dead-field sifatida qoldi (round-trip; migratsiya shart emas). `teacherCategories`/`teacherCategoryLabel`
  konstantalari endi ishlatilmaydi. Frontend-only; tsc+vite yashil, deploy ✅.
- 2026-06-11: **Guruh-asosli to'lov oynasi + o'qituvchi majburiy + foizli maosh moliyada ko'rinmas bug'i.**
  (1) **Per-guruh to'lov:** `PaymentModal` endi guruh tanlanmaguncha oy/summa ko'rsatmaydi; guruh tanlangach SHU
  guruh oylik hisobi (`GET /admin/students/{id}/group-ledger?groupId=` → `StudentGroupLedger`) — aggregate emas,
  shu guruh narxi (aktiv/muzlat qisman oylari bilan) + shu guruhga TEGLANGAN to'lovlar. Bir nechta guruhli o'quvchida
  endi to'g'ri (boshqa guruh summasi aralashmaydi); bitta guruh — avto. DTO `GroupMonthDto`/`GroupLedgerDto`. (2)
  **O'qituvchi MAJBURIY:** `ClassesController.Create/Update` TeacherId bo'sh/yo'q bo'lsa 400; `ClassFormModal` "O'qituvchi *"
  required. (3) **BUG:** moliya `salary-report` faqat `te.Salary`ga tayanardi → foizli o'qituvchi oyligi 0 ko'rinardi;
  endi `SalaryLedger.BuildAsync` ishlatadi (fixed+percent), `SalaryReportRowDto`+frontend `SalaryReportRow`ga
  `salaryMode`/`salaryPercent` qo'shildi, "Oylik" ustunida foiz ko'rinadi. Jonli sinov: Foiz Test 40% test B →
  moliyada expected 800k (= 40% × 2M, 4 ta teglangan to'lovdan, hammasi to'g'ri); group-ledger fee 500k/paid 1M/paid;
  o'qituvchisiz guruh POST→400. Sxema o'zgarmadi (migratsiya yo'q). Sinov ma'lumotlari tozalandi. Deploy ✅.
- 2026-06-11: **O'qituvchi formasidan "Guruh rahbarligi" olib tashlandi** — bog'lanish bir yo'nalishli: guruhga
  o'qituvchi biriktiriladi (guruh formasi, `Group.TeacherId`), o'qituvchiga guruh emas. `TeacherFormModal` homeroom
  selektori + `classes` prop olib tashlandi (`homeroomClass` form state'da round-trip — eski qiymat saqlanadi).
  `TeachersPage`: "Guruh rahbarligi" ustuni → "Guruhlari" (o'qituvchi o'tadigan guruhlar, `Group.teacherId` bo'yicha
  chip); `TeacherViewModal`: "Guruh rahbarligi" qatori → "Guruhlari" (yangi `groups` prop). `Teacher.HomeroomClass`
  entity/DB'da QOLDI (TeacherPortal/ChatService/StudentPortal homeroom mantig'i ishlatadi; eksport "Sinf rahbarligi"
  ustuni ham qoldi). Frontend-only; tsc+vite yashil, deploy ✅.
- 2026-06-11: **UI REDIZAYN — `crm/` namuna qiyofasiga o'tkazish boshlandi (Faza 0 + asosiy 6 sahifa).** Foydalanuvchi
  `crm/` papkasiga tayyor dizayn namunasini qo'shdi (static React-via-CDN: `styles.css`, `components/`, `pages/`).
  Tanlangan qiyofa: **binafsha (violet)** asosiy rang + **Manrope** shrift + raqamlar **JetBrains Mono**. Strategiya A
  (token+primitiv kaskad): Tailwind'da qolib, tokenlarni `@theme`ga, namuna komponent CSS klasslarini `index.css`ga
  ko'chirib, umumiy primitiv+shell'ni yangilash → deyarli barcha sahifaga avtomatik tarqaladi. **Faza 0 (men):**
  `index.html` Google Fonts (Manrope+JetBrains Mono); `index.css` — brand-* violet oklch ramp, font-sans=Manrope,
  font-mono=JetBrains Mono, namuna `:root` tokenlari + ko'chirilgan klasslar (`.kpi*`,`.card*`,`.badge`,`.table*`,
  `.entity-card*`,`.kanban*`,`.lead-card*`,`.subnav`,`.tabs`,`.toolbar`,`.cal*`,`.attend*`,`.state`,`.skeleton`,
  `.tt-card`,`.pagination`...); primitivlar yangilandi (Button/Card/StatCard→KPI/Modal — backward-compatible) + yangi
  `Badge`, `PageHeader`; shell (Sidebar — brand-mark gradient+bo'lim yorlig'i+user footer, Topbar — sticky+blur+icon-btn).
  **Faza 1 (6 parallel subagent):** Dashboard, Lidlar(Kanban+dnd saqlandi), O'quvchilar, Guruhlar(jurnal grid logikasi
  tegilmadi), O'qituvchilar, Moliya — faqat prezentatsiya o'zgardi, logika/API/handlerlar saqlandi. tsc+vite YASHIL.
  Bitta bug tuzatildi: AdminDashboard single-quote string ichida apostrof (`'Davomat bo'yicha'` → `"..."`).
  QOLDI: qolgan admin sahifalari (account/assignments/lms/messages/settings/staff/contracts/discipline/subjects/
  teacher-reports/cameras/locations/parents/branches/feedback/journal) + o'qituvchi portali + login/auth + umumiy
  komponentlar (chat/charts/audit/lms). Deploy hali QILINMADI (faqat lokal build).
- 2026-06-11: **UI redizayn — Faza 2 + 3 (qolgan admin + o'qituvchi portali + login).** 8 ta parallel subagent
  (kesishmaydigan papkalar). Faza 2 (admin): settings(6)+account(2), subjects+discipline+contracts(5), messages(3)+
  journal modal(1), assignments+assignment-scores+lms(9), staff+branches+feedback+cameras(4), teacher-reports+
  locations+parents(4). Faza 3: LoginPage (binafsha gradient brand-mark, premium auth card) + o'qituvchi portali
  (dashboard, journal[grid logikasi tegilmadi], evaluation, assignments, lms×2, messages). Hammasi prezentatsiya-only:
  PageHeader + Card(title/sub/actions) + Badge + .table + .entity-grid + font-mono raqamlar. Logika/API/handler/
  SignalR/leaflet/hls/dnd saqlandi. 2 bug tuzatildi: AdminDashboard apostrof-string, TeacherLmsSubjectPage PageHeader
  import. tsc+vite YASHIL; app real brauzerda (dist→http) yuklanib /login render bo'ldi. **Brif qoidasi:** Uzbek
  apostrof (bo'yicha) single-quote string'ni buzadi → har doim "..." double-quote. Student/parent web yo'q (mobil).
  QOLGAN (ixtiyoriy polish): umumiy komponentlar — components/charts (.tt-card tooltip), chat paneli, audit, lms
  matritsa.
- 2026-06-11: **UI redizayn PRODGA DEPLOY qilindi.** `docker compose up -d --build app` (faqat `app` qayta qurildi;
  mssql/cloudflared/backup/mediamtx tegilmadi, `intellectcrm_mssql-data` volume SAQLANDI — frontend-only, migratsiya yo'q).
  App qayta ishga tushdi: loglar toza ("Now listening :8080", "Application started", migratsiya/exception yo'q), mssql
  healthy. End-to-end sinov (crm.intellectschool.uz orqali cloudflared): index.html yangi build (Manrope shrift +
  yangi CSS hash `index-BVIhvvZx.css`), login API noto'g'ri parolga HTTP 401. ✅ Redizayn jonli.
- 2026-06-11: **Asosiy shrift Manrope → Plus Jakarta Sans** (foydalanuvchi "chiroyliroq" so'radi). `index.html` Google
  Fonts link + `index.css` `--font-sans`; Manrope'ga xos `font-feature-settings` (ss01/cv11) olib tashlandi; raqamlar
  hamon JetBrains Mono. Build yashil, `app` qayta deploy (mssql-data saqlandi); prodda tasdiqlandi (index.html
  Plus+Jakarta+Sans, yangi CSS hash, login 401). ✅
- 2026-06-11: **Guruhlar sahifasi: karta/jadval ko'rinish tugmasi + kattaroq kartalar.** `ClassesPage`ga `view`
  ('card'|'table') state; saralash toolbar'ining o'ng tomonida `.tabs` (Kartalar | Jadval). Karta grid endi
  `minmax(340px,1fr)` (oldin 280) + karta padding 18/20px + avatar h-12 — sal kattaroq. Jadval ko'rinishi: `.table`
  (Guruh[cell-user]/Til[Badge]/O'qituvchi/Kunlar/Vaqt/O'quvchilar/O'rtacha/Davomat/Oylik/Amallar), qator bosilsa
  detalga, amallar IconBtn. Logika o'zgarmadi.
- 2026-06-11: **SHRIFT → Times New Roman (hamma joyda, foydalanuvchi talabi).** `index.css` `@theme`: `--font-sans`
  VA `--font-mono` = `'Times New Roman', Times, serif` (raqamlar ham — "boshqada emas"). `index.html`dan Google Fonts
  link/preconnect olib tashlandi (kerak emas, TNR tizim shrifti). `font-mono` className'lari (54 fayl) avtomatik TNR —
  theme var orqali, faylga tegilmadi. Build yashil, `app` deploy (mssql-data saqlandi); prodda tasdiqlandi (yangi CSS
  hash `index-GWlIYhDW.css` ichida "Times New Roman", Google Fonts yo'q, login 401). ✅
  ESLATMA: landing.html (public marketing) alohida — TNR'ga o'tkazilmadi (CRM app emas).
- 2026-06-11: **SHRIFT → Montserrat (Google Font, hamma joyda).** Foydalanuvchi TNR o'rniga Montserrat so'radi.
  `index.html`ga Montserrat Google Fonts link (+preconnect) qaytarildi; `index.css` `--font-sans`+`--font-mono` =
  'Montserrat'. Build yashil, `app` deploy (mssql-data saqlandi); prodda tasdiqlandi (index.html Montserrat link,
  CSS hash `index-DCDAoc8w.css` ichida "Montserrat", login 401). ✅
- 2026-06-11: **Kurs narxi o'zgarganda "hozirgi oy / keyingi oy" so'rovi + bog'langan guruhlarga tarqalishi.**
  Ilgari `SubjectsController.Update` faqat `Subject.Price`ni o'zgartirardi — bog'langan guruhlar `MonthlyFee`si
  va o'quvchilar tegilmasdi (narx faqat keyingi guruh create/edit'da olinardi). Endi: narx o'zgarsa, `CourseId==id`
  bo'lgan BARCHA guruhlarning `MonthlyFee`si yangi narxga yangilanadi; `?applyFee=true` ("Ha — joriy oydan") bo'lsa,
  shu guruhlardagi o'quvchilarning JORIY oy `MonthlyCharge`i yangi narxga moslanadi (balans farqqa, `Locked` tegilmaydi),
  `false` ("Yo'q") — keyingi oydan. Joriy-oy qayta hisoblash logikasi `TuitionService.ApplyGroupFeeToCurrentMonthAsync`
  (umumiy) ga ajratildi; `ClassesController.Update` ham shuni ishlatadi (guruh-to'lov xulqi bir xil qoldi). Frontend:
  `updateSubject(id, payload, applyFee?)` + `SubjectsPage` narx o'zgarsa prompt modal (guruhdagi `feePrompt` kabi).
  Audit `EntityClassFee` (kurs + guruhlar soni + qo'llangan o'quvchilar). ESLATMA: billing aggregate (ClassName
  bo'yicha) — ko'p guruhli o'quvchida bitta guruh narxiga moslanadi (mavjud cheklov, perGroup TODO). Sxema o'zgarmadi
  (migratsiya yo'q). Backend 0 xato, tsc+vite yashil, `app` deploy (mssql-data saqlandi), prodda app sog'lom. ✅
- 2026-06-11: **O'quvchi formasida telefon DUBLIKAT tekshiruvi (arxivdagilar ham) + "Baribir saqlash/Bekor qilish".**
  Saqlash bosilganda, o'quvchi/ota/ona raqami allaqachon biror o'quvchida (arxivdagilar ham) ishlatilganmi tekshiriladi —
  bo'lsa, ogohlantirish modali (mos kelgan o'quvchi(lar) nomi/guruhi/arxiv holati/qaysi raqam) + "Baribir saqlash"
  (davom etadi) / "Bekor qilish". Backend: `POST /api/admin/students/check-phones` (`CheckPhonesRequest`→`PhoneMatchDto[]`),
  `PhoneUtil.Key` (oxirgi 9 raqam) bo'yicha normallashtirilgan solishtirish, `ExcludeId` (tahrirdagi o'zini chiqarish),
  barcha o'quvchilar (arxiv ham). Frontend: `checkStudentPhones` servis (`USE_MOCK`→[]) + `StudentFormModal` async
  handleSubmit (tekshiradi → dublikat bo'lsa tasdiq modali, aks holda onSubmit; tekshiruv xatosi saqlashni bloklamaydi).
  Sxema o'zgarmadi. Backend 0 xato, tsc+vite yashil, deploy ✅ (endpoint 401 — ulangan, app sog'lom).
  ESLATMA: lid (Lead) formasiga qo'llanmadi — faqat o'quvchi (foydalanuvchi shuni so'radi).
- 2026-06-12: **MUZLATISHDA "o'qilmagan keyingi kunlar" hisoblanishi + freeze→reactivate "ikki marta" bug'i
  tuzatildi (ildiz: aggregate+per-guruh dublikat hisob qatori).** Ildiz sabab: o'quvchi guruhsiz (faqat
  `ClassName`) paytda `AccrueMonth` aggregate `MonthlyCharge(GroupId=null, to'liq oy)` yozadi; keyin guruhga
  qo'shilib aktiv bo'lganda per-guruh `MonthlyCharge(GroupId=<guruh>)` yoziladi, lekin eski `null` qator
  O'CHIRILMAGAN edi → `StudentLedger` oy summasini ikkala qatorni qo'shib IKKI BARAVAR ko'rsatardi, va
  `ChargeFreezeProrate` faqat per-guruh qatorni studied qismга kamaytirgani uchun aggregate `null` qator to'liq
  oy bo'lib qolib MUZLATILGANDAN keyin ham o'qilmagan kunlarni hisoblardi. Tuzatish (`TuitionService`): (1)
  `PurgeDuplicateAggregateChargesAsync` — bir (o'quvchi, oy) uchun HAM null HAM per-guruh qator bo'lsa, null
  qatorni o'chiradi + effektivni balansga qaytaradi; `AccrueDue` boshida chaqiriladi (har 12 soat/finance/startup
  — o'z-o'zini tuzatadi, mavjud prod ma'lumotini tozalaydi). (2) `PurgeAggregateRowAsync` — `ChargeActivationProrate`
  va `ChargeFreezeProrate` per-guruh qator yozishdan OLDIN shu oyning null qatorini darhol tozalaydi (muzlatishda
  zudlik bilan). `StudentsController.Update` allaqachon `!hasMembership` bilan himoyalangan (yangi null yaratmaydi),
  shuning uchun dublikat faqat o'tish davridan qolgan. Sxema o'zgarmadi (migratsiya yo'q). Backend 0 xato.
  TEKSHIRUV SQL (prod): bir (StudentId,Month) uchun null va per-guruh qatorlar birga turganini topish.
  Jonli tekshirildi: muzlatish studied qismга kamayadi (92307.69=1.2M×1/13), AccrueDue frozen hisobni
  qayta inflatsiya qilmaydi, freeze→reactivate bitta to'g'ri qator, dup_months=0. Deploy ✅ (app rebuild).
- 2026-06-12: **UI: (1) Guruh a'zolar oynasi kengaytirildi; (2) Topbar'da doimiy global o'quvchi qidiruvi.**
  (1) `ClassMembersModal` `size="md"`→`"lg"` (max-w-xl→max-w-3xl, 576→768px) — jadval kengroq. (2) Yangi
  `TopbarStudentSearch` komponenti — Topbar'da DOIM ko'rinadigan inline input (desktop sm+), barcha sahifalarda;
  FISH/telefon (o'z/ota/ona) bo'yicha `searchStudents` (debounce 250ms), natijalar dropdown, tanlansa
  `/admin/students/:id`; arxivdagilar "arxiv" badge; faqat `students` ruxsati borlar uchun. Ilgari Topbar'da
  faqat Ctrl+K tugmasi (cmdk modal) bor edi — endi desktopda to'g'ridan-to'g'ri yoziladigan keng input,
  mobil'da cmdk ikona qoldi (`CommandPalette` SAQLANDI — bo'lim navigatsiyasi uchun). "Xush kelibsiz" matni
  qidiruvga joy berish uchun `lg:block` (faqat katta ekranda). tsc+vite yashil, deploy ✅ (yangi build
  `index-CTmg6lXd.js`, app sog'lom, /admin/students 12 o'quvchi qaytardi). Frontend-only, sxema o'zgarmadi.
- 2026-06-12: **Guruh a'zolar oynasi `xl` + ichidan yangi o'quvchi qo'shish.** `ClassMembersModal` `lg`→`xl`
  (768→1024px). Qidiruv yoniga "+ Yangi o'quvchi" tugmasi — `StudentFormModal` (yaratish) ochiladi, saqlangach
  `createStudent`→`addGroupMember` bilan darhol shu guruhga qo'shiladi. Frontend-only, tsc yashil, deploy ✅.
- 2026-06-12: **YANGI MODUL — Daraja testi (placement test → lid).** O'quv bo'limi ichiga qo'shildi. Admin kurs
  uchun test yaratadi (savollar: ko'p variantli, bitta to'g'ri javob; daraja diapazonlari: ball% ≥ min → daraja
  yorlig'i) → ommaviy URL `/test/{slug}` shakllanadi. Bo'lajak o'quvchi (ANONIM) kirib, FISH/telefon/yosh qoldiradi,
  testni ishlaydi → ball/daraja hisoblanadi va **CRM'da yangi LID** bo'lib tushadi (Source="Daraja testi",
  InterestSubject=kurs, birinchi Stage'ga, LeadEvent+LevelTestSubmission). Backend: 4 entity (LevelTest/Question/
  Band/Submission), `LevelTestService` (slug gen, scoring, lid yaratish), `LevelTestsController` (admin CRUD+natijalar,
  perm `schedule`), `PublicTestController` ([AllowAnonymous] get/submit). Inkremental migratsiya `AddLevelTest`
  (4 jadval qo'shildi, hech narsa o'chmadi — baza saqlanadi). Frontend: types, `levelTests`+`publicTest` servis,
  nav "Daraja testi", `LevelTestsPage` (ro'yxat+URL nusxa+yangi test), `LevelTestEditorPage` (savollar/diapazon
  editori + natijalar tab + URL), public `/test/:slug` `PublicTestPage` (intro+kontakt → savollar 1-by-1 progress →
  natija+daraja, brand binafsha dizayn). Slug noyob (`HasMaxLength(64)`+unique indeks). Backend 0 xato, tsc+vite
  yashil. Deploy: app rebuild (migratsiya startupда avto, `mssql-data` saqlandi).
- 2026-06-12: **Markaziy "Sabablar" + amallarga ulash (A).** Yangi `ActionReason`(Category/Label/Order) entity +
  `ActionReasonsController` (CRUD, perm settings) + inkremental migratsiya `AddActionReasons` (1 jadval) + Program.cs
  seed (jadval bo'sh bo'lsa 7 kategoriya × standart sabablar; prodda 25 ta seed bo'ldi). 7 kategoriya: freeze,
  return_trial, remove_active, remove_trial, remove_frozen, lead_delete, group_delete. Davomat (kelmaganlik) ALOHIDA
  (`AbsenceReason`, eski API). Yangi `pages/admin/reasons/ReasonsPage` (`/admin/reasons`) — davomat + 7 kategoriya bir
  joyda (nav "Sabablar" shu yerga); `ReasonPromptModal` qayta ishlatiladigan komponent. Amallarga ulandi (sabab →
  AuditLog): FreezeMember (freeze) + RemoveMember (holatga qarab remove_active/trial/frozen) + yangi ReturnToTrial
  (return_trial) — `ClassMembersModal`; guruh Delete (group_delete) — `ClassesPage`; lid Delete (lead_delete) —
  `LeadsPage`. `MembershipStatusRequest`ga `ReasonId`; delete endpointlarga `?reasonId=`; `LeadsController`ga
  `AuditService` inject. Jonli: 25 sabab 7 kategoriyada. ✓
- 2026-06-12: **(B) O'qituvchi guruhlari bosiladigan + (C) navigatsiyalar `<Link>` (o'ng tugma→yangi tab) +
  (D) dashboard talaba analitikasi.** 2 parallel subagent (kesishmaydigan fayllar). **B:** `TeacherViewModal`
  "Guruhlari" — har guruh `<Link to=/admin/classes/:id>` chip (bosilsa o'tadi). **C:** StudentsPage (ism),
  ClassesPage (ism karta+jadval), LevelTestsPage (sarlavha), LMS (class/subject/module kartalari) — asosiy nav
  `<a href>` (`<Link>`) bo'ldi → o'ng tugma "yangi tabda ochish" ishlaydi. **D:** `DashboardController` + yangi
  `StudentBreakdownDto`(Active/Inactive/Debtors/Paid/WithGroup/WithoutGroup) + `AdminDashboard` 6 KPI plitka.
  Ta'rif: faqat arxivlanmagan; active=≥1 faol(active) a'zolik; withGroup=≥1 faol a'zolik; debtors=Balance<0; qolgani
  jami−komplement. Jonli: active=10/inactive=2/debtors=8/paid=4/withGroup=12/withoutGroup=0. tsc+backend+vite yashil,
  deploy ✅ (`index-CWh-WK8v.js`). **Foydalanuvchi: doim subagentlardan foydalan (osonlashadi).**
- 2026-06-12: **GIT: yangi private repo.** Eski `origin` (SchoolLms) BOSHQA loyiha — `schoollms` deb qayta nomlandi.
  Yangi `github.com/AbduxalilVoxidjonov/IntellectCRM` (private) yaratildi (GitHub API + credential token), kod `main`
  branch'da (400 fayl). `.gitignore` to'g'ri (`.env`/bin/obj/node_modules/dist chiqarilgan; root `.env` parollar tracked emas).
- 2026-06-12: **(E) To'lov izohi + (F) moliya o'chirish balans bug'i (2 parallel subagent).** **E:** `FinanceTransaction.Comment`
  (user izohi, avto-`Note` alohida) + migratsiya `AddPaymentComment`; `PaymentRequest.Comment`, `PaymentDto.Comment`,
  `PaymentModal` "Izoh" textarea, `addPayment(...,comment)`, `PaymentHistoryModal` izohni ko'rsatadi. **F BUG:** moliyada
  to'lov o'chirilganda o'quvchi balansi qaytmasdi (faqat `AddPayment` `Balance+=`, lekin `FinanceController.Delete` tegmasdi).
  Tuzatish: `StudentBalanceEffect`(income+tuition+studentId→Amount) + `ApplyBalanceAsync`; Delete `-effect` qaytaradi,
  Create `+effect`, Update delta (o'quvchi o'zgarsa eskidan qaytarib yangiga). Backend 0, tsc+vite yashil, deploy ✅.
- 2026-06-12: **(G) ARXIV bo'limi — o'chirilganlarni saqlash (2 parallel subagent).** Yondashuv: `ArchivedRecord` snapshot
  jadvali (Type/EntityId/Title/Subtitle/Json/Reason/DeletedAt/ActorName) — o'chirishda entity JSON sifatida saqlanadi
  (originallar ro'yxatlarga tegmaydi). `ArchiveService.Snapshot` 6 delete endpointga ulandi: Lid/Talaba/O'qituvchi/Xodim/
  Guruh/Moliya (mavjud delete xulqi saqlandi). `ArchiveController` (perm settings): GET ?type, GET /counts, POST /{id}/restore
  (JSON deserialize → originalni qayta qo'shadi), DELETE /{id} (butunlay). Migratsiya `AddArchivedRecords`. Frontend: nav
  "Arxiv" (Sozlamalar ostida), `/admin/archive` `ArchivePage` — 6 tab (Lidlar/Talabalar/O'qituvchilar/Xodimlar/Guruhlar/
  Moliya) + sanoq, Tiklash + Butunlay o'chirish. Backend 0, tsc+vite yashil, deploy ✅.
- 2026-06-12: **O'chirish sabablari kengaytirildi (Talaba/O'qituvchi/Xodim/Moliya) + finance arxivida o'quvchi
  nomi (2 parallel subagent).** 4 yangi sabab kategoriyasi: `student_delete`/`teacher_delete`/`staff_delete`/
  `finance_delete` (ActionReasonsController.Categories + ReasonsPage 4 karta). Program.cs seed PER-KATEGORIYA
  idempotent qilindi (jadval bo'sh bo'lmasa ham, sanog'i 0 bo'lgan kategoriyalar seed bo'ladi → yangi 4 ta prodda
  paydo bo'ldi). Delete endpointlar (`StudentsController`/`TeachersController`/`StaffController`/`FinanceController`)
  `?reasonId=` qabul qiladi → sabab matni `ArchiveService.Snapshot` reason + auditga yoziladi. Frontend: 4 sahifa
  (StudentsPage/TeachersPage/StaffPage/FinancePage) `confirm()` o'rniga `ReasonPromptModal` (kategoriya bo'yicha) —
  o'chirishdan oldin sabab so'raydi. **Finance arxivi:** snapshot title endi o'quvchi nomi ("{FISH} — to'lov",
  bo'lmasa "{Kirim/Chiqim} {kategoriya}"), subtitle "{summa} so'm · {oy}" — kim to'lovi ekani ko'rinadi. Sxema
  o'zgarmadi (migratsiya yo'q). Backend 0, tsc+vite yashil, deploy ✅.
- 2026-06-12: **Sana/vaqt formati BIRLASHTIRILDI (bo'limlar bo'yicha har xil chiqardi).** Sabab: markaziy
  `formatDateTime`/`formatTime` yo'q edi — 6 xil mahalliy versiya (ba'zisi `ru-RU`, ba'zisi `new Date` TZ-bog'liq,
  ba'zisi xom ISO "T"). `lib/utils`: `formatDate` endi satrdan o'qiydi (`yyyy-MM-dd` regex, `new Date()` emas) →
  brauzer TZ'idan qat'i nazar Toshkent sanasi aynan; yangi `formatDateTime`→"DD.MM.YYYY HH:mm", `formatTime`→"HH:mm"
  (satrdan, TZ-xavfsiz). 2 parallel subagent 8 faylni o'tkazdi (AuditHistoryList, LeadDetailModal, ChatPanel,
  TeacherAttendancePage, TeacherAppPage, ParentsPage, teacher/AssignmentsPage, SubmissionsModal). O'lik
  `teacher/ui-web/*.jsx` tegilmadi. Frontend-only, tsc+vite yashil, deploy ✅.
- 2026-06-12: **TO'LIQ PLATFORMA AUDITI + buglar tuzatildi (5 review subagent + 2 fix subagent + billing o'zim).**
  5 read-only agent (billing/membership/security/frontend/data) audit qildi. Tuzatilgan asosiy buglar: **(1)** Finance
  arxiv tiklash balansni qaytarmasdi (o'chirishda −, tiklashda + yo'q edi) → `ArchiveController` finance restore endi
  `Balance += Amount`. **(2)** Arxiv tiklashda Id mavjudligi tekshirilmasdi (PK crash) + staff old parol/ruxsat tiklanardi
  → Id-guard + staff `Permissions` tozalanadi + Email band tekshiruvi. **(3)** O'qituvchi o'chirish guruh `TeacherId`ni
  dangling qoldirardi → faol guruhga biriktirilgan bo'lsa 400 (block). **(4)** Public test submit cheklovsiz (spam) →
  FullName≤100/Phone≤32/Age 0..120. **(5 billing — o'zim)** freeze→reactivate (bir oyda) studied segmentni yo'qotardi
  (revenue loss) → `ChargeActivationProrate(addSegment)` — muzlatishgacha studied segment USTIGA yangi segment qo'shiladi
  (ALMASHTIRMAY); `ActivateMember` `reactivateFromFreeze` ni hisoblaydi; Locked hurmat qilinadi. **(6)** guruh o'chirilganda
  orphan `MonthlyCharges`(GroupId) tozalanadi + `FinanceTransaction.GroupId` null. **(7 frontend)** 4 delete handlerga
  `.catch(alert)` (jim xato emas), `ReasonPromptModal` double-submit guard, ClassesPage arxiv sana `formatDate`,
  LevelTest band key barqaror. Backend 0, tsc+vite yashil, deploy ✅. **QOLDI (hisobotda, dizayn qarori kerak):**
  guruhdan chiqqan o'quvchini ClassName bilan billing (avto-to'lov xavfli — tasdiq kerak); FinanceController.Create
  tuition `Month` o'rnatmaydi; Group.Name unique emas (FirstOrDefault fee manbai); MonthlyCharge null-GroupId duplicate
  indeksi; bir nechta N+1 (perf); staff GET barcha bo'limni o'qiy oladi (dizayn).
- 2026-06-12: **YANGI MODUL — Kurs o'quv dasturi (syllabus/roadmap) + o'quvchi checklist (3 parallel subagent).**
  Ierarxiya: `Course(Subject) → CourseLevel(daraja) → CourseTopic(mavzu) → CourseItem(band)` + `CourseProgress`
  (o'quvchi×band, Done). Backend: 4 entity+DbSet+indeks, inkremental migratsiya `AddCourseCurriculum`, `CurriculumController`
  (perm schedule) — GET tree, daraja/mavzu/band CRUD (kaskad delete), `POST {id}/import` (butun dasturni almashtiradi),
  `GET {id}/progress/{studentId}` (bajarilgan band id'lari), `POST progress` (upsert). Frontend: types+`curriculum.ts`
  servis (men), `CurriculumEditorPage` (`/admin/subjects/:id/curriculum`, Kurslardan "O'quv dasturi" tugmasi —
  yig'iladigan daraja→mavzu→band, inline tahrir), `StudentDetailPage` "O'quv dasturi (checklist)" bo'limi (o'quvchining
  faol guruhlari kursi bo'yicha, groupId→courseId xarita orqali; progress bar + checkbox toggle, optimistik).
  **2 Excel import qilindi** (python/openpyxl bilan parselab `{levels:[...]}` JSON → import endpoint): `english.xlsx`
  → "ingliz tili" (4 daraja A1-B2 · 16 mavzu[grammatika/lug'at/vazifa/can-do] · 151 band); `matematika.xlsx` →
  "matematika" (12 daraja[Algebra 7-bosqich + Geometriya 5] · 32 mavzu · 172 band). Jonli: GET tree, progress
  toggle roundtrip ✓. Backend 0, tsc+vite yashil, deploy ✅. Manba xlsx repo ildizida saqlandi.
- 2026-06-12: **O'quv dasturi qayta tashkil + UI (2-ustun + card).** (1) English'ni 4 alohida daraja-kursga
  KO'CHIRDIM (API import orqali): A1→Beginner(40 band), A2→Elementary(37), B1→Pre-Intermediate(38), B2→Intermediate(36);
  so'ng "ingliz tili" kursini O'CHIRDIM (dastur tozalandi + subject delete). DIQQAT: TEST-G guruhi ingliz tili'ga
  bog'langan edi — endi CourseId dangling (qayta biriktirish kerak). (2) `CurriculumEditorPage` + `StudentDetailPage`
  checklist: mavzular endi 2-USTUNDA (`lg:grid-cols-2`) — ko'rish/yozishga qulay; topik karta ko'rinishida. (3)
  `SubjectsPage` Kurslar jadval→**CARD grid** (kurs nomi havola→o'quv dasturi, narx, "O'quv dasturi" tugma+tahrir/o'chir).
  Frontend-only (delete/import API), tsc+vite yashil, deploy ✅.
- 2026-06-13: **GURUH o'quv dasturi — darsda o'tilgan + tugatish PROGNOZI (2 parallel subagent).** Yangi
  `GroupCurriculumLog`(GroupId/ItemId/IsRevision/Date) + inkremental migratsiya `AddGroupCurriculumLog`. Guruh kursi
  (Group.CourseId) dasturidan checklist: dars o'tilganda band "o'tildi" belgilanadi (log), yoki **"takrorlash"** darsi
  (band'siz log — yangi mavzu qo'shmaydi). `CurriculumController`ga 3 endpoint: `GET group/{groupId}` (tree+covered
  bayroqlari + PROGNOZ), `POST .../cover {itemId,covered}`, `POST .../revision {delta}`. **Prognoz:** totalItems,
  coveredCount, revisionLessons; pace=covered/totalLessons (≥0.1); estLessonsLeft=ceil(remaining/pace) — takrorlash
  pace'ni tushirib tugashni suradi; estFinishDate = guruh `Days` bo'yicha oldinga yurib hisoblanadi. Frontend:
  `curriculum.ts`ga `getGroupCurriculum/setGroupCover/changeGroupRevision`; `ClassDetailPage`ga "O'quv dasturi
  (darsda o'tilgan)" bo'limi — prognoz kartasi (progress bar + "O'tilgan X/N · Takrorlash R · Qolgan · ~est dars ·
  ≈sana"), 2-ustunli daraja→mavzu→band checkbox, "keyingi" band ajratilgan, +/− takrorlash. Backend 0, tsc+vite yashil,
  deploy ✅. ESLATMA: TEST-G ingliz tili (o'chirilgan)ga bog'liq — kursi yo'q, dasturi bo'sh ko'rinadi.- 2026-06-13: **O'QITUVCHI PORTALI ISHGA TUSHIRILDI (Flutter WebView uchun) — audit + critical fix.** 2 audit
  subagent (backend/frontend) o'qituvchi API+portalni xaritalashtirdi. TOPILGAN: backend `api/teacher/*`
  (TeacherPortalController) asosan tayyor va to'g'ri scoped (jurnal/feedback/chat/topshiriq/LMS/maosh/sinf rahbar),
  LEKIN frontend portal **404 berardi** — 7 ta tayyor `pages/teacher/*.tsx` routerга ULANMAGAN edi (`/teacher/*` →
  `TeacherAppRedirect` → mavjud bo'lmagan static PWA → Program.cs 404 tuzog'i). TUZATISH: (1) App.tsx'ga
  `<ProtectedRoute role="teacher"><AppLayout>` blok + 7 route (dashboard/journal/evaluation/assignments/lms/lms/:id/
  messages/account) — admin shell (Sidebar `navByRole['teacher']`, mobil-moslashgan) qayta ishlatiladi;
  TeacherAppRedirect olib tashlandi. (2) Program.cs `/teacher/index.html` 404 tuzog'i o'chirildi → `/teacher/*`
  SPA index.html'ga tushadi. Jonli: o'qituvchi login (role=teacher), `/teacher` HTTP 200, `GET /teacher/me`+`/classes`
  ishladi. tsc+backend 0, deploy ✅. **QOLDI (kamchiliklar):** (1) o'quv dasturi coverage o'qituvchida YO'Q (admin-only
  `CurriculumController [AdminPerm schedule]` — `api/teacher/curriculum` kerak; teacher `schedule` ruxsati ishlatilmaydi);
  (2) o'qituvchi maosh SAHIFASI yo'q (endpoint bor); (3) jurnal eski per-cell model (admin monthly). Test o'qituvchi
  paroli tiklandi: abduxalilvoxidjonov / krwp5yen.
- 2026-06-13: **O'qituvchi API modernizatsiya + portal MOBIL WEB-APP (2 subagent).** (1) Backend: `TeacherPortalController`ga
  5 modern endpoint qo'shildi (teacher-scoped, Group.TeacherId==me): `GET journal/group?classId&month` (oylik jurnal,
  JournalService.GroupMonthAsync), `POST journal/bulk-attendance`, `GET curriculum/group/{id}` (o'quv dasturi coverage +
  prognoz, perm `schedule` endi ishlatiladi), `POST cover`, `POST revision`. Eski CHORAK-asosli endpointlar (journal/
  columns?quarter, journal?quarter, notes?quarter, quarter-grades, schedule?quarter, progress?quarter, topics-import)
  LEGACY deb belgilandi (o'chirilmadi — eski front chaqirishi mumkin). (2) Frontend: o'qituvchi portali endi MOBIL
  WEB-APP — `TeacherMobileLayout` (bottom-nav 5 tab: Bosh sahifa/Jurnal/Topshiriqlar/Xabarlar/Profil, app-like, eski
  ui-web dizayni), admin shell o'rniga; yangi `TeacherProfilePage` (ism/login/guruh/maosh/chiqish); dashboard+journal
  mobil-friendly. Migratsiya yo'q (mavjud DTO/service qayta ishlatildi). tsc+backend+vite 0, deploy ✅.
  QOLDI: o'qituvchi journal/curriculum ekranlarini yangi monthly endpointlarga ulash (hozir UI eski; backend tayyor).
