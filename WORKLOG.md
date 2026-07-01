# IntellectCRM — Ish jurnali (o'zgarishlar tarixi)

> Bu fayl CLAUDE.md dan ajratildi (kontekstni yengillashtirish uchun). Avtomatik yuklanmaydi.

## 8. Ish jurnali (har o'zgarishdan keyin yangilanadi)
- 2026-07-01: **Web/PWA push (Firebase FCM) qo'shildi — Service Account yoniga.** Ilgari push faqat NATIVE
  (Flutter WebView, token native beriladi) ishlar edi. Endi ODDIY BRAUZER/PWA ham FCM token oladi. **Backend:**
  `CenterMeta.FcmWebConfigJson`/`FcmVapidKey` (entity+DB'da allaqachon bor edi) endi ishlatiladi. `FirebaseSettingsDto`
  + `SaveFirebaseSettingsRequest`ga `WebConfigJson`/`VapidKey`/`WebConfigured`; `SettingsController` firebase GET/PUT
  shularni o'qiydi/yozadi (web config JSON obyekt ekanini validatsiya). Yangi ommaviy endpoint
  `GET /api/public/push-config` (`PublicPushConfigDto`) — brauzer web config+vapid oladi (maxfiy emas). `FcmService`
  o'zgarmadi (`notification` payload web'da avtomatik ko'rinadi). **Frontend:** `webpush.ts` — `initWebPush()`
  (config oladi → `firebase-messaging-sw.js` register → `Notification.requestPermission` → Firebase JS SDK
  gstatic CDN'dan DINAMIK import (npm dep yo'q) → `getToken({vapidKey, swReg})`). `public/firebase-messaging-sw.js`
  (compat SDK, config query'da, onBackgroundMessage + notificationclick). `push.ts` `registerDevice`ga
  `platform:'web'`. `AuthProvider` — native token bo'lmasa student/teacher kirganda `initWebPush` → `registerDevice(..,'web')`.
  `FirebaseSettings.tsx` — Service Account yoniga "Web app config (JSON)" + "VAPID key" maydonlari + 2 status badge.
  PWA: `public/manifest.webmanifest` + index.html `<link rel=manifest>`/theme-color/apple-touch-icon.
  Migratsiya SHART EMAS (ustunlar InitialCreate'da). Backend 0 xato, frontend tsc+vite ✓.
- 2026-06-29: **YANGI — AI CHECK (Speaking & Writing) — o'quvchi AI tekshiruv + admin boshqaruv (limit/premium/blok).**
  Foydalanuvchi: o'quvchida "Speaking & Writing" — writing'ni Gemini, speaking'ni Azure tekshiradi, natija chiroyli
  diagramma/so'z tahlili (Gemini), har tekshiruv TARIXI saqlanadi (speaking ovozi ham — qayta eshitish); Ilova ichida
  "AI check" — kim necha marta (speaking/writing) ishlatgani, kunlik LIMIT, PREMIUM, BLOK; admin o'quvchi tarixini
  o'quvchidagidek ko'radi. **Backend:** 2 entity `AiCheck`(Type speaking/writing, Prompt, InputText, RecognizedText,
  AudioUrl, Score, AzureJson, AnalysisJson, Date) + `StudentAiAccess`(DailyLimit/IsPremium/IsBlocked) + CenterMeta
  `AiCheckDailyLimit`(default 3); migratsiya `AddAiCheck` (2 jadval + 1 ustun). `AiCheckService` (Gemini prompt
  tuzish + JSON parse → `AiCheckAnalysisDto`: overall/level/scores{grammar,vocab,coherence,task,mechanics,
  pronunciation,fluency}/summary/strengths/weaknesses/corrections/vocabulary/improved/recommendations).
  `GeminiService`/`AzureSpeechService` (mavjud) qayta ishlatildi. **Student endpoints** (`/api/student/ai-check`):
  status (limit/premium/blok + kalit tayyorligi), history, history/{id}, POST writing (Gemini), POST speaking
  (multipart audio → Azure assess + ovoz saqlash `/uploads/aicheck-*.wav` + Gemini). Limit GUARD: blok→403,
  premium→cheksiz, aks holda kunlik limit (per-o'quvchi override yoki global). Guard config'dan OLDIN (blocked
  user "cheklangan" oladi). **Admin endpoints** (`/api/admin/ai-check`, AdminPerm app): overview (kim necha marta),
  settings (global limit), access/{studentId} (limit/premium/blok upsert), history/{studentId}, item/{id}.
  **Frontend:** `studentAiCheck.ts`+`aiCheck.ts` servis; `AiCheckResultView` (`.student-app` scoped — diagramma/
  bar/ovoz player/tuzatish/so'z tahlili, student VA admin bir xil ko'rinish); student `AiCheck` ekrani (Writing/
  Speaking tab + wavRecorder ovoz + status banner + tarix) → Profil menyu "AI tekshiruv"; admin `AiCheckPage`
  (global limit + foydalanuvchi jadvali: limit input/premium/blok toggle) + `AiCheckStudentPage` (tarix + natija
  `.student-app` o'rab — o'quvchidagidek), Ilova nav "AI check". **JONLI E2E** (throwaway PG): migratsiya qo'llandi;
  district/school/student CRUD; student status limit=3, writing kalitsiz→400 "sozlanmagan"; admin blok→student
  writing 403 "cheklangan"; premium→remaining 999; overview/settings/access 200. Backend 0, tsc+vite yashil.
  **DEPLOYDA:** `docker compose up -d --build app` (migratsiya avto; postgres-data saqlanadi). Ishlashi uchun:
  Sozlamalar → AI Tahlil (Gemini) kaliti (writing+speaking tahlil), Speaking (Azure) kalit/region (speaking baho).
- 2026-06-29: **O'quvchi portali — DESKTOP responsiv (chap yon-menyu + markazlashgan kontent).** Foydalanuvchi:
  Chrome'da (keng ekran) o'quvchi profili "hunuk" — cho'zilib ketardi (`.student-app`da `width:100%`, `max-width`
  YO'Q → telefon dizayni butun monitorga yoyilardi). Yechim (o'qituvchi portali kabi — CSS media query, har ekranni
  tahrirlamasdan): `StudentMobileLayout`ga desktop `.st-side` yon-menyu (brand + 5 nav, NavLink active) qo'shildi;
  `index.css` `.student-app` scope ichida — `@media >=700px` `.screen` markazlashadi (max-width 920px), `@media
  >=1024px` `.student-app` row bo'ladi (chap 248px yon-menyu + keng kontent, `.tabbar` yashiriladi, `.screen`
  max-width 980px). Telefon/WebView (<700px) BAYT-MA-BAYT o'zgarmaydi (media query trigger bo'lmaydi). Barcha 25
  routed ekran `.screen` ishlatadi (GradingPanel/SpeakingRecorder — embed sub-komponent, lib.tsx — util). tsc+vite
  yashil. **PWA ESLATMA:** platforma hozir PWA EMAS (manifest/SW yo'q) — "ilova" = Flutter WebView APK (Telegram bot
  orqali). Brauzerdan "Install" kerak bo'lsa alohida (manifest+SW) qo'shiladi. **DEPLOYDA:** `docker compose up -d
  --build app` (frontend-only, migratsiya yo'q).
- 2026-06-29: **YANGI — TUMAN + MAKTAB (Sozlamalar) + o'quvchi formasida tuman→maktab kaskadi.** Foydalanuvchi:
  o'quvchi ma'lumotini kiritishda (admin forma) tuman tanlab, keyin shu tumanning maktabini tanlash kerak; tuman/maktab
  Sozlamalardan boshqariladi (tuman yaratib ichiga maktablar qo'shiladi, kengaytirib boriladi). **Backend:** 2 entity
  `District`(Name/Order) + `School`(DistrictId/Name/Order); `Student`ga `DistrictId`/`SchoolId` (+ `[NotMapped]`
  `DistrictName`/`SchoolName` — GetAll'da id'dan to'ldiriladi); migratsiya `AddDistrictsSchools` (2 jadval + Students'ga
  2 ustun, default ""; data loss YO'Q). `DistrictsController` (AdminPerm settings, `/api/admin`): `GET districts`
  (har tuman ichidagi maktablari bilan), POST/PUT/DELETE `districts` (delete → ichidagi maktablar ExecuteDelete),
  POST `districts/{id}/schools`, PUT/DELETE `schools/{id}`. `StudentsController` Create/Update DistrictId/SchoolId
  yozadi; GetAll DistrictName/SchoolName biriktiradi. `StudentPayload`ga 2 ixtiyoriy maydon (trailing, default null —
  Excel import positional construction buzilmaydi). DTO: `DistrictDto`(+Schools)/`SchoolDto`/Create/Update. **Frontend:**
  `types` District/School + Student'ga districtId/schoolId/districtName/schoolName; `districts.ts` servis (CRUD); yangi
  `DistrictsPage` (`/admin/districts`, Sozlamalar nav "Tuman va maktablar") — tuman qo'shish + har tuman kartasi
  (tahrir/o'chir + ichida maktab qo'shish/tahrir/o'chir); `StudentFormModal` "Boshqa ma'lumotlar" bo'limiga Tuman +
  Maktab kaskad select (tuman tanlansa maktablar chiqadi, tuman o'zgarsa maktab tozalanadi; tahrirda preselect).
  Backend 0, tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app` (migratsiya avto; postgres-data saqlanadi).
- 2026-06-27: **SMS andozalari (Sozlamalar → SMS) DB-driven + AVTO SMS + LIDGA SMS yuborish.** Foydalanuvchi:
  SMS matn andozalari Sozlamalar → SMS (Eskiz)da yaratiladi/tahrirlanadi/o'chiriladi; "Avto SMS" deb belgilash;
  lid kartasida lidga SMS yuborish (shablon tanlab). **Backend:** `SmsTemplate` entity (Name/Text/IsAuto/Order) +
  migratsiya `AddSmsTemplates` + Program.cs seed (4 standart andoza, jadval bo'sh bo'lsa). Endpointlar
  (MessagesController): `GET/POST/PUT/DELETE sms/templates`, `POST sms/lead` (lid telefon raqamiga, {fish}/{telefon}
  moslab, lid tarixiga "SMS yuborildi" yozadi). `LeadSmsService.AutoSendAsync` — yangi lid tushganda IsAuto
  andozani avtomatik yuboradi; `LeadsController.Create` + `LevelTestService.SubmitAsync` (PublicTest) chaqiradi
  (EskizService inject). **Frontend:** `messages.ts` template CRUD + sendLeadSms; `EskizSettings`ga "SMS andozalari"
  kartasi (ro'yxat + yaratish/tahrir/o'chir + o'rinbosar tugmalari + "Avto SMS" checkbox/badge); `SmsComposer` +
  `SmsModal` endi DB andozalarini yuklaydi (statik messageTemplates emas — push/broadcast eski statikda qoldi);
  `LeadDetailModal`ga "SMS yuborish" bo'limi (shablon chiplari + matn + yuborish, lid raqamiga). **JONLI E2E**
  (throwaway PG, .env Eskiz creds): seed 4 andoza; auto template yaratildi → lid yaratilganda AVTO SMS batch
  ("Avto (lid)", matn "Assalomu alaykum Lid Test!" — {fish} moslandi, 998901234567); manual lid SMS batch
  ("Lid: ..."), lid timeline "SMS yuborildi"; (soxta creds → sent=0, real creds bilan yetkaziladi). Backend 0,
  tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app` (migratsiya + seed avto).
- 2026-06-27: **Chegirma AMAL QILISH MUDDATI (oy oralig'i) — chegirma faqat belgilangan oylarda hisoblanadi.**
  Foydalanuvchi: chegirma (foiz/qat'iy summa) ostiga muddat — masalan iyun–avgust (3 oy) belgilansa, chegirma
  faqat shu oylar uchun qo'llanadi. `Student.DiscountStartMonth`/`DiscountEndMonth` ("yyyy-MM") + migratsiya
  `AddDiscountValidityPeriod` (2 ustun, default "" → eski chegirmalar HAR DOIM amal qiladi, orqaga moslik).
  **Backend:** `TuitionService.DiscountActiveForMonth(s, month)` + `DiscountForMonth(s, fee, month)` — davr
  tashqarisida 0. Barcha billing nuqtalari oy bo'yicha gate qilindi: `AccrueOne`, `ChargeActivationProrate`
  (+addSegment), `ChargeFreezeProrate`, `ApplyFeeToCharge` (charge.Month), `StudentGroupLedger` (per-oy preview),
  `StudentLedger` (joriy oy effektiv), `StudentsController.Update` legacy ClassName loop (har oy alohida).
  `StudentPayload` + Create/Update Month maydonlarini yozadi; discountChanged davrni ham hisobga oladi.
  **Frontend:** `Student` tipi +discountStartMonth/EndMonth; `StudentFormModal` Chegirma bo'limiga 2 `type=month`
  input (Amal qilish boshi/oxiri) + izoh; bo'sh = har doim. **JONLI E2E** (throwaway PG): migratsiya 2 ustun;
  chegirma 50%, kurs 1M — IN range (2026-06..08, joriy 2026-06) → effektiv 500k; FUTURE range (2026-09..10) →
  1M (chegirma yo'q); bo'sh range → 500k (har doim). Backend 0, tsc+vite yashil. **DEPLOYDA:**
  `docker compose up -d --build app` (migratsiya avto; postgres-data saqlanadi).
- 2026-06-27: **To'lov USULI (Naqd/Karta/Bank) — to'lov kiritishda tanlanadi, moliyada ko'rinadi.**
  `FinanceTransaction.Method` (cash|card|bank, null=belgilanmagan) + migratsiya `AddFinanceTransactionMethod`
  (1 nullable ustun). **Backend:** `PaymentRequest`/`FinanceTransactionPayload`/`FinanceTransactionDto`/`PaymentDto`ga
  Method; `StudentsController.AddPayment` + `FinanceController.Create` Method yozadi (lowercase), `Update`
  preserve-if-empty; `ToDto` + `StudentLedger` Method qaytaradi. **Frontend:** `constants.ts` `paymentMethods`
  (cash=Naqd, card=Karta, bank=Bank orqali) + `paymentMethodLabel`. To'lov kiritish joylarida usul tanlash
  (default Naqd): (1) `PaymentModal` (o'quvchi to'lovi — 3 tugmali segment), (2) `TransactionFormModal` (Moliya →
  yangi amal, kirim bo'lsa usul tanlovi). **Moliyada ko'rinish:** FinancePage tranzaksiyalar jadvaliga "To'lov
  usuli" ustuni (kirim uchun Badge, aks holda —) + CSV eksportga; `PaymentHistoryModal` har to'lovda usul badge.
  `addPayment(... method)` + FinancePage tuition handleSubmit method uzatadi. **JONLI E2E** (throwaway PG):
  migratsiya Method ustuni; addPayment method=card → finance transactions method=card, student ledger payment
  method=card. Backend 0, tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app` (migratsiya avto;
  postgres-data saqlanadi). Eski to'lovlarda Method=null → "—" ko'rinadi.
- 2026-06-27: **O'quvchilar ro'yxatidan SHABLON bilan SMS yuborish (bitta yoki tanlanganlarga).** Foydalanuvchi:
  bitta raqam yozish o'rniga — o'quvchilar ro'yxatida bosib, shablon tanlab SMS yuborish. (Oldingi "Bitta raqam"
  composer tab REVERT qilindi — commit qilinmagandi.) **Frontend:** mavjud stub `SmsModal` (faqat alert qilardi)
  to'liq qayta yozildi — Eskiz orqali HAQIQIY yuborish: "Kimga" toggle (Ota-ona raqami / O'quvchi raqami) + tayyor
  SHABLONLAR (`messageTemplates` chiplari) + o'rinbosar tugmalari + belgi/SMS hisoblagich + natija; sozlanmagan
  bo'lsa ogohlantirish. `StudentsPage`: (a) HAR QATORDA "SMS yuborish" tugmasi (Send ikon) → shu o'quvchiga modal;
  (b) tanlangan(lar) uchun mavjud bulk "SMS yuborish" tugmasi ham shu modalni ochadi (`smsRecipients: Student[]`
  state — bitta yoki ko'p). Modal `sendSms({audience:'selected', studentIds, toParent, text})` chaqiradi. **Backend:**
  `SendSmsRequest`ga `ToParent` (default true) qo'shildi; `MessagesController.SendSms` 'selected'da ToParent=false
  bo'lsa o'quvchi raqamiga, aks holda ota-ona raqamiga (label mos: "O'quvchilar/Ota-onalar — Tanlangan (N)").
  Matn har o'quvchiga moslab ({fish} va h.k.). Sxema o'zgarmadi — migratsiya YO'Q. **JONLI E2E** (throwaway PG,
  Eskiz .env creds): status configured (from=MAKTAB); o'quvchi yaratildi (ota 935.., o'zi 901..) → selected
  toParent=true → log 998935556677 (Ota-onalar), toParent=false → 998901112233 (O'quvchilar), matn "Salom {fish}"→
  "Salom Olim Test". Backend 0, tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app` (migratsiya yo'q).
- 2026-06-27: **Telegram yangi-lid xabarnomasiga DARAJA TESTI natijasi (batafsil) + SMS'ni .env orqali sozlash.**
  **(1) Lid xabarnomasi batafsil:** `LeadNotifier.NotifyNewLeadAsync`ga ixtiyoriy `LevelTestSubmission? submission` +
  `testTitle` qo'shildi; daraja testi orqali kelgan lid uchun Telegram xabari endi to'liq natijani ko'rsatadi:
  "📊 Daraja testi natijasi · 📝 Test · ✅ Ball: X/Y (P%) · 🟢/🟡/🔴 Baho: A'lo/Yaxshi/O'rta/Past · 🎯 Daraja ·
  🎂 Yoshi · 🗒 So'rovnoma javoblari". Testsiz oddiy lidlar uchun lid `Note` ko'rsatiladi. `LevelTestService.SubmitAsync`
  endi submission obyektini saqlab notifier'ga uzatadi (test.Title bilan). SurveyJson parse case-insensitive (defensiv).
  **(2) SMS .env:** EskizService endi login/parol/sender'ni avval CenterMeta (Sozlamalar)dan, bo'sh bo'lsa
  `.env`/appsettings (`Eskiz__Email`/`Eskiz__Password`/`Eskiz__From`)dan oladi (DB ustun turadi). `IsConfigured`/
  `SenderOf` instance metodga aylandi (config fallback); GetTokenAsync .env-only holatda CenterMeta qatorini token
  keshlash uchun avtomatik yaratadi. docker-compose `app` env'iga `Eskiz__Email/Password/From` + `.env.example`ga
  ESKIZ_* qo'shildi (izoh bilan). Sxema o'zgarmadi — migratsiya YO'Q. **JONLI E2E** (throwaway PG): daraja testi
  yaratildi → ommaviy submit (1/2 50% → Intermediate, yosh 12, so'rovnoma Speaking+Grammar) → lid Note to'g'ri,
  submission saqlandi, notifier (soxta telegram token) BuildText'ni ishlatdi (crash yo'q); SurveyJson formati
  PascalCase, parse mos; SMS endpointlar regalmadi. Backend 0, compose valid. **DEPLOYDA:** `docker compose up -d
  --build app` (migratsiya yo'q). SMS'ni .env'dan sozlash uchun `.env`ga ESKIZ_EMAIL/ESKIZ_PASSWORD/ESKIZ_FROM
  yozib `docker compose up -d app` (yoki CRM Sozlamalar → SMS (Eskiz) — bu DB'da, ustun turadi).
- 2026-06-27: **YANGI — SMS yuborish (Eskiz.uz) + Xabarlar bo'limiga "SMS yuborish" tab + yuborilgan SMS jurnali.**
  Foydalanuvchi: Xabarlar (Guruh chati · E'lon · Push) yoniga **SMS yuborish** qo'shilsin + yuborilgan SMS'larni
  ko'rib turish. **Backend:** `EskizService` (typed `IHttpClientFactory`, login/parol/sender CenterMeta'dan o'qiydi
  — FcmService kabi; Bearer token CenterMeta'da keshlanadi ~30 kun, eskirsa qayta login, 401'da yangilab bir marta
  retry; `SendSmsAsync`/`GetBalanceAsync`/`NormalizePhone` 998-format). Entitilar: `SmsBatch` (yuborish partiyasi —
  audience/matn/kim/qachon/recipient+sent count), `SmsLog` (raqam bo'yicha: phone/name/requestId/status, callback
  yangilaydi). CenterMeta: EskizEmail/Password/From/Token/TokenExpiresAt. Migratsiya `AddEskizSms` (2 jadval + 5
  ustun). **Endpointlar (MessagesController):** `GET sms/status`, `GET sms` (tarix), `GET sms/{id}/logs`, `POST
  sms/send` (audience: parents=ota-ona raqami | students=o'quvchi raqami | teachers=o'qituvchi raqami | selected;
  className/onlyDebtors filtr; bir xil raqam bir marta — dedupe; matn {fish}{sinf}{qarzdorlik}{balans}{telefon}
  o'rinbosar; callback_url avtomatik). Public **`POST /api/sms/callback`** ([AllowAnonymous]) — Eskiz yetkazib
  berish holatini request_id bo'yicha SmsLog'ga yozadi (JSON yoki form-data). `SettingsController` `GET/PUT
  /admin/settings/eskiz` (email/parol/sender — parol qaytmaydi, balans best-effort). DI: `EskizService` singleton +
  appsettings `Eskiz:BaseUrl`. **Frontend:** `messages.ts` sms funksiyalari+tiplar; `SmsComposer.tsx` (audience tab +
  guruh + qarzdorlar + andoza/o'rinbosar + belgi/SMS bo'lak hisoblagich + tarix kartalari → "Raqamlar va holat"
  expand: Yetkazildi/Kutilmoqda/Yetkazilmadi badge); MessagesPage'ga **SMS yuborish** tab (Smartphone ikon);
  `settings.ts` eskiz funksiyalari; `EskizSettings.tsx` (login/parol/sender + Sozlangan/Balans badge) + nav
  "SMS (Eskiz)" + SettingsPage seksiya. **JONLI E2E** (throwaway PG): migratsiya 2 jadval+5 ustun; sms/status
  false→true (creds saqlangach); settings PUT/GET (parol qaytmaydi); o'qituvchi (telefon) yaratib SMS yuborildi →
  partiya saqlandi (recipient 1/sent 0 — soxta creds → eskiz login 401), tarix+logs ko'rsatdi (raqam 998901234567
  ga normallashtirildi, status=login xato); callback anonim 200. Backend 0, tsc+vite yashil. **DEPLOYDA:**
  `docker compose up -d --build app` (migratsiya avto; postgres-data saqlanadi). Ishlashi uchun: Sozlamalar →
  SMS (Eskiz)da eskiz.uz login/parol + tasdiqlangan sender (nikname) kiritilsin (tasdiqlanmasa faqat test matni
  ketadi; test sender "4546"). Callback ishlashi uchun domen internetdan ochiq bo'lsin (prod). **QOLDI/DEFER:**
  OTP (telefon tasdiqlash/parol tiklash) + React PhoneInput/OtpVerification — hozir CRM'da telefon-OTP login
  oqimi yo'q (qo'shilsa speculativ dead-code bo'lardi); kerak bo'lsa keyin ulaymiz.
- 2026-06-27: **Bosh sahifa "Dars jadvali"ga o'qituvchi tanlash (filter).** `WeeklySchedule` karta sarlavhasiga
  o'qituvchi `<select>` qo'shildi ("Barcha o'qituvchilar" default; jadvali bor o'qituvchilar ro'yxati nom bo'yicha).
  Tanlansa FAQAT shu o'qituvchining guruhlari haftalik gridda + legendada ko'rsatiladi. Ranglar BARQAROR (barcha
  guruhlar bo'yicha bir marta hisoblanadi, filterga bog'liq emas — guruh "barcha" va filtrlangan ko'rinishda bir xil
  rangda). Bo'sh holat matni filterga moslashadi ("Bu o'qituvchining vaqti belgilangan guruhi yo'q"). Frontend-only
  (yangi API yo'q — getClasses/getTeachers/getSubjects). tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app`
  (migratsiya yo'q).
- 2026-06-27: **LANDING (apex marketing sayti) TO'LIQ OLIB TASHLANDI — backend + CRM sozlama + page/.**
  Foydalanuvchi: apex landing (intellectschool.uz marketing sayti) HAM, undagi CRM Sozlamalar → "Landing page"
  tahrirlovchi HAM kerak emas. **Backend:** `LandingController` o'chirildi; `LandingContent` entity + DbSet
  (IAppDbContext/AppDbContext) olib tashlandi; `BackupService`dan `landingContents` chiqarildi (o'rniga
  `centerAiAnalyses` qo'shildi); `Program.cs` host-based landing routing (landingDir/appHost/landingEnabled/
  IsLandingHost + `MapWhen` page/ branch + `__LANDING_CONTENT__` inject) butunlay olib tashlandi → CSP endi DOIM
  qat'iy CRM CSP (apex/landing yumshoq CSP yo'q); SPA fallback endi BARCHA hostlarda (apex `intellectschool.uz` ham,
  `crm.*` ham → CRM SPA). `page/` papkasi (Intellect Kokand.dc.html, landing.default.json, screenshots) + Dockerfile
  `COPY page/` o'chirildi. Migratsiya `RemoveLandingContent` (DropTable LandingContents — landing kontenti o'chadi,
  boshqa ma'lumot saqlanadi). **Frontend:** `services/landing.ts` + `LandingSettings.tsx` o'chirildi; navigation.ts
  "Landing page" bandi, SettingsPage import/label/render olib tashlandi. **JONLI E2E** (throwaway PG): migratsiya
  zanjiri toza qo'llandi (LandingContents jadval DROP), `RemoveLandingContent` history'da, `GET /api/admin/landing`
  → 404, health 200, startup xato yo'q. Backend 0, tsc+vite yashil. **DEPLOYDA:** `docker compose up -d --build app`
  (migratsiya LandingContents jadvalini DROP qiladi; postgres-data SAQLANADI). ESLATMA: apex `intellectschool.uz`
  endi CRM SPA'ni ko'rsatadi (login). Cloudflare panelida apex Public Hostname endi shart emas (lekin qolsa ham
  zararsiz — SPA ochiladi).
- 2026-06-27: **Dashboard: guruh statistikasi qayta dizayn + MARKAZ kunlik AI Tahlil (Gemini) + super-admin
  per-guruh oylik hisob tahrirlash.** **(1) Guruh statistikasi (ClassPerformanceChart) qayta yozildi:** ilgari bitta
  bar-chart (x o'qida o'qituvchi custom tick — "hunuk") edi → endi HAR O'QITUVCHI ALOHIDA panel (responsive grid,
  yonma-yon kartalar), har panelda o'qituvchi guruhlari gorizontal bar; tepadagi "O'rtacha baho / Davomat" toggle
  (AdminDashboard'da bor) hamma panelda bir vaqtda almashadi (recharts emas — yengil CSS bar). **(2) AI Tahlil (markaz,
  bosh sahifa, guruh statistikasidan TEPADA):** kuniga BIR MARTA (ertalab soat 8, `CenterAiSchedulerService` fon xizmati;
  CenterMeta `AiDailyAnalysisEnabled`=true/`AiDailyAnalysisHour`=8) + admin qo'lda "Yangilash" (superadmin "Qayta" =
  force). `CenterAiAnalysis` entity (kuniga 1, Date index) + migratsiya `AddCenterAiAnalysis` (1 jadval + 2 CenterMeta
  ustun, data loss YO'Q). **Raqamlar DETERMINISTIK** (`CenterAiAnalysisService.BuildSnapshotAsync` — moliya: shu oy
  kutilayotgan hisob/yig'ilgan tushum/qarzdorlik/kechagi tushum/oy oxiri chiziqli prognoz/oxirgi 14 kun; o'quvchilar:
  aktiv/yangi lidlar oy+kecha/konversiya/ketganlar; baholar shu oy vs o'tgan oy; lidlar manbasi; ketish sabablari
  arxivdan), **Gemini esa faqat O'ZBEK narrativ** (umumiy/tushum tahlili/baholar/lidlar/ketganlar/xavflar/tavsiyalar/
  salomatlik 0-100/trend) jsonMode bilan. `GeminiService` (mavjud, `CenterMeta.GeminiApiKey`) — o'quvchi AI tahlili bilan
  bir xil integratsiya. Endpoint `AiAnalysisController` (`GET center` 204/rekord, `GET center/history`, `POST center/run
  [?force]`). Frontend: `aiAnalysis.ts` servis + tiplar + `CenterAiAnalysisCard` (tushum kartalari+yig'ilish bari+14 kun
  bar, baholar delta, lidlar/ketganlar mini-bar, xavflar/tavsiyalar) → AdminDashboard'ga ulandi. **(3) Super-admin
  per-guruh oylik hisob:** ko'p guruhli o'quvchining oylik to'lovini guruh bo'yicha ALOHIDA tahrirlash bug'i (ilgari
  ko'p guruhli oyda tahrir tugmasi DISABLE edi). Backend `EditCharge` ALLAQACHON `?groupId=` qo'llab-quvvatlardi —
  yetishmagani: `MonthCourseDto`ga `GroupId` qo'shildi (`StudentLedger.CoursesForMonth`), `PaymentHistoryModal` endi
  HAR KURS qatorida (per-guruh) inline qalam → `editStudentCharge(month, amount, groupId)`; "Hisoblangan" katak faqat
  yig'indi (eski disable tugma olib tashlandi). **JONLI E2E** (throwaway PG): migratsiya qo'llandi (CenterAiAnalyses
  jadval + CenterMeta AiDaily* ustunlar), superadmin login → GET center 204 → history [] → POST run kalitsiz "kalit
  sozlanmagan" → kalit saqlab POST run: SNAPSHOT to'liq qurildi (barcha LINQ ishladi) so'ng Gemini 400 "API key not
  valid" (kutilgan, soxta kalit) → unhandled exception YO'Q; dashboard 200. Backend 0, tsc+vite yashil.
  **DEPLOYDA:** `docker compose up -d --build app` (migratsiya startupda avto; postgres-data SAQLANADI). AI tahlil
  ishlashi uchun Sozlamalar → AI Tahlil (Gemini)da kalit bo'lsin (aks holda "kalit sozlanmagan").
- 2026-06-26: **5 ta ish: lid yoshi rangi · o'quvchi-edit dublikat bug · Marketing permission · dashboard grafik ·
  backup app-side JSON.** **(1) Lid yoshi (LeadCard):** lid o'quvchiga AYLANTIRILGAN bo'lsa YASHIL chap-chiziq;
  aks holda lidlar bo'limida qancha uzoq qolib ketsa shuncha QIZARADI (kulrang<3kun → amber 3-6 → orange 7-13 →
  qizil 14+) + "N kun" chip + hover'da sana. `leadAgeDays`/`leadAging` (createdAt'dan). **(2) O'quvchi edit dublikat
  bug:** tahrirda o'quvchining O'ZI "bunday o'quvchi bor" bo'lib chiqardi. Backend `check-phones` excludeId'ni
  to'g'ri chiqaradi (jonli tasdiqlandi: excludeId bilan []), lekin mijoz tarafida ham KAFOLAT qo'shildi:
  `StudentFormModal` natijani `m.studentId !== initial.id` bilan filtrlaydi → o'zini hech qachon dublikat sanamaydi.
  **(3) Marketing permission:** `adminPermissions`ga `marketing` qo'shildi (Xodimlar va rollar checklistida ko'rinadi);
  nav `perm:'marketing'`; 6 route `<RequirePerm perm="marketing">`. Superadmin/admin (permissions yo'q) ko'radi,
  xodim — berilsa. **(4) Dashboard grafik:** "Guruhlar bo'yicha statistika" x o'qida endi GURUH nomi emas O'QITUVCHI
  (bir o'qituvchi nomi faqat guruhlari boshida, custom tick); guruh nomi faqat HOVER'da (tooltip). "Eng yuqori bahoga
  ega guruhlar" Top-5 kartasi OLIB TASHLANDI; grafik to'liq kenglik. Backend `ClassPerformanceItemDto`ga `TeacherName`
  + o'qituvchi bo'yicha tartiblash. **(5) Backup — APP-SIDE JSON (Telegram'ga yubormayotgani hal qilindi):** ilgari
  docker `backup` konteyner (pg_dump+curl) ishonchsiz edi (qayta deploy + curl o'rnatish kerak). Endi ILOVA o'zi:
  `BackupService.BuildJsonAsync` (60 jadval → JSON, IgnoreCycles) + `SendAsync` (ishlaydigan `TelegramService`
  orqali adminga, LastSentAt yangilanadi); `BackupSchedulerService` (hosted, kunlik CenterMeta jadval bo'yicha,
  daqiqa aniqligi); `POST /admin/settings/telegram-backup/run` (qo'lda) + Sozlamalar→Telegram bot→Backup'da
  "Backupni hozir yuborish" tugmasi. Docker `backup` konteyner endi FAQAT lokal .sql.gz (tiklash uchun; Telegram
  send + curl olib tashlandi → dublikat yo'q). **JONLI TEST** (throwaway PG): app-side run → JSON BUILD muvaffaqiyatli
  (60 jadval serialize, send bosqichiga yetdi, faqat soxta token'da to'xtadi — real token bilan yuboradi); check-phones
  excludeId []; backup minute roundtrip. Backend 0, tsc+vite yashil, `docker compose config` valid.
  **DEPLOYDA:** `docker compose up -d --build app` (app-side backup; sxema o'zgarmadi — migratsiya yo'q) +
  `docker compose up -d backup` (lokal-only). Backup ishlashi uchun: Sozlamalar→Telegram bot'da BOT TOKEN + Backup'da
  CHAT ID, admin botga /start qilgan bo'lsin → "Backupni hozir yuborish" bilan sinab ko'rilsin.

- 2026-06-26: **YANGI BO'LIM — MARKETING (ijtimoiy tarmoq avtojavob, "Javobot" UI ko'chirildi; FAQAT UI/mock).**
  Foydalanuvchi `Documents/calude.auto` (Javobot — AI avtojavob platformasi: CDN React+Babel prototip) UI'ini CRM'ga
  ko'chirishni so'radi — "Marketing" bo'limi, **boshqaruvdan (Bosh sahifa) OLDIN**, ijtimoiy tarmoq (Instagram/
  Telegram/WhatsApp/Messenger) avtojavoblarini boshqarish uchun. Hozircha **API yo'q — faqat UI, mock ma'lumot**.
  **Yondashuv (teacher/student portal kabi):** Javobot `styles.css` dizayn tizimi `.marketing-app` ostiga SCOPE
  qilindi (`src/styles/marketing.css`, main.tsx'da import; shell/sidebar/topbar tashlandi — CRM'niki ishlatiladi;
  171 qoida bundle'da). Prototip 6 sahifasi CDN-React JSX → TSX ga ko'chirildi: `src/pages/admin/marketing/`
  — `mk.tsx` (Icon+ChannelIcon brand glyphlari+tiplar+mock data CHANNELS/RULES/CONVS/WEEK + `MarketingPage`
  o'rovchi), `MarketingDashboard` (hero+4 stat+bar chart+kanal taqsimoti+faollik+top qoidalar), `MarketingInbox`
  (2-panel suhbat+chat+AI taklif, full-height), `MarketingRules` (qoida kartalar+kalit so'z→javob flow+RuleModal),
  `MarketingChannels` (ulangan/qo'shiladigan kanal kartalar), `MarketingAi` (ohang/til/xulq sozlamalari),
  `MarketingAnalytics` (KPI+SVG area chart+qoida progress). `go(page)` → react-router `useNavigate`. **Integratsiya:**
  navigation.ts admin massiviga "Marketing" (Megaphone ikon) BIRINCHI band — 6 sub-sahifa; App.tsx 6 route
  (`/admin/marketing[/inbox|rules|channels|ai|analytics]`). Dizayn binafsha (--primary #6d5ef8) CRM brendiga mos,
  shrift CRM'niki (Montserrat) — integratsiyalashgan. tsc+vite yashil. **JONLI BROWSER SINOV** (vite dev, mock
  rejim, admin@maktab.uz login): Dashboard/Inbox/Rules/Analytics — hammasi CRM shell ichida to'g'ri render bo'ldi
  (sidebar'da Marketing birinchi, sub-menyu; hero/stat/chart/inbox 2-panel/qoida flow/SVG chart), 0 konsol xato.
  **QOLDI (foydalanuvchi rejasi):** backend/API — kanal ulanishi, real suhbatlar, qoida CRUD, AI integratsiya
  (hozircha mock). Manba prototip `Documents/calude.auto` (repo'ga kiritilmadi).

- 2026-06-26: **AI Tahlil v2 (kuniga 1 marta + saqlash + delta + diagrammalar) + backup DAQIQA + backup DB-driven.**
  **(1) AI Tahlil qayta qurildi:** ilgari har bosishda matn qaytarardi. Endi: **kuniga BIR MARTA** (per o'quvchi,
  `StudentAiAnalysis` entity, unique-ish (StudentId,Date) — bugun yozuvi bo'lsa Gemini chaqirilmaydi, mavjudi
  qaytadi `AlreadyToday=true`, kalit tekshiruvidan OLDIN); **SAQLANADI** — o'quvchi sahifasida yangi **"AI Tahlil"
  bo'limi** (tarix: sana+ball chiplari, tanlangani diagrammalar bilan); **DELTA** — keyingi tahlil oldingisining
  xulosa+balliga tayanib "ozgarishlar"ni aytadi (prompt'ga oldingi yozuv kontekst sifatida beriladi); **DIAGRAMMALAR**
  — Gemini endi STRUKTURALI JSON qaytaradi (responseMimeType=application/json): `{umumiy,kuchli[],zaif[],dinamika,
  ozgarishlar,tavsiyalar[],baholar{akademik,davomat,intizom,uyVazifa,faollik,umumiy 0-100},trend}` → frontend
  `AiAnalysisView` (umumiy ball SVG halqa + 5-sohali RADAR + mini-bar + matn bo'limlari + kuchli/zaif/tavsiya
  kartalari). **Backend:** `StudentAiAnalysis` entity+DbSet+index(StudentId,Date); migratsiya
  `AddBackupMinuteAndAiAnalysis`; `GeminiService.GenerateAsync` jsonMode; `StudentsController` `POST {id}/ai-analysis`
  (once/day+delta+parse+saqlash) + `GET {id}/ai-analyses` (tarix); DTO AiRatingsDto/StudentAiAnalysisResultDto/
  RecordDto/ResponseDto; defensive JSON parse (fence-strip+Sanitize+clamp). **Frontend:** students.ts yangi tiplar+
  getStudentAiAnalyses/generateStudentAiAnalysis; `AiAnalysisView.tsx` (recharts radar+ring); `AiAnalysisModal.tsx`
  qayta yozildi (once/day gate, "bugun qilingan" banner, PDF — strukturali HTML print); `StudentDetailPage` AI bo'lim+
  modal records/onGenerated. **(2) Backup DAQIQA:** ilgari faqat soat — endi `BackupScheduleMinute` (CenterMeta +
  migratsiya); Sozlamalar→Telegram bot→Backup UI'da soat:daqiqa input (0-23 : 0-59); DTO/SettingsController
  validatsiya (daqiqa 0-59). **(3) Backup DB-DRIVEN (ildiz: UI sozlamasi dekorativ edi):** docker `backup` konteyner
  ilgari faqat env'dan o'qirdi → UI'dagi soat/chat/yoqilgan HECH NIMA qilmasdi. Endi konteyner har 60s'da
  `CenterMeta`'dan psql bilan token+chatId+hour+minute+enabled o'qiydi (env zaxira), yuborilgach
  `TelegramBackupLastSentAt`ni (Toshkent) yangilaydi → UI'dagi "Oxirgi backup yuborildi" ishlaydi; bot token ham
  DB'dan (foydalanuvchi .env'ga token yozishi shart emas). **JONLI TEST** (throwaway PG): migratsiya 0 xato →
  StudentAiAnalyses jadval+index, CenterMeta GeminiApiKey/BackupScheduleHour/Minute ustunlar; login→backup minute
  roundtrip(30 saqlandi, 99→400)→gemini GET(model env)→ai-analyses []→ai-analysis kalitsiz {ok:false}→insert rec→
  GET parse OK→POST alreadyToday:true(Gemini chaqirilmadi); backup psql ekstraksiya+parsing(target=1290)+LastSentAt
  UPDATE OK. Backend 0, tsc+vite yashil, `docker compose config` valid. **DEPLOYDA:** `docker compose up -d --build app`
  (migratsiya avto) + `docker compose up -d backup` (DB-driven). Bot token+chat+vaqt ilovadan: Sozlamalar→Telegram bot.

- 2026-06-26: **YANGI — O'quvchi profilida "AI Tahlil" (Google Gemini) + Telegram backup bug fix.**
  **(1) AI Tahlil:** har o'quvchi profili tepasida (StudentDetailPage) **"AI Tahlil"** tugmasi (binafsha gradient) —
  bosilganda o'quvchining BARCHA ma'lumotlari (`StudentProfileBuilder.BuildAsync` → StudentNotebookDto: baholar,
  davomat, intizom, topshiriqlar, baholash, balans) JSON sifatida Gemini'ga yuboriladi va o'zbek tilida tuzilgan
  tahlil (Umumiy holat · Kuchli/Zaif tomonlar · Dinamika · Tavsiyalar) qaytaradi. **Backend:** `CenterMeta.GeminiApiKey`
  (DB'da kalit) + inkremental migratsiya `AddGeminiApiKey` (1 ustun, data loss YO'Q); model env `GEMINI_MODEL`
  (default `gemini-3.1-flash-lite`, docker-compose + .env.example'ga qo'shildi); `GeminiService` (static, REST
  generateContent, `x-goog-api-key` header); `SettingsController` `GET/PUT /admin/settings/gemini` (kalit saqlash —
  GET kalitni qaytarmaydi, faqat model+configured); `StudentsController` `POST /admin/students/{id}/ai-analysis` →
  `StudentAiAnalysisDto(Ok, Analysis, Model, Error)`. DTO: `GeminiSettingsDto`/`SaveGeminiRequest`/`StudentAiAnalysisDto`.
  **Frontend:** `settings.ts` GeminiConfig+get/save; `GeminiSettings.tsx` (Sozlamalar → "AI Tahlil (Gemini)" nav +
  SettingsPage `section==='gemini'`) — kalit input + model (read-only) + sozlangan badge; `students.ts`
  `getStudentAiAnalysis`; `AiAnalysisModal.tsx` — oyna ochilganda avto-tahlil, yengil markdown→HTML render (## / - /
  **qalin**), **"PDF yuklab olish"** (yangi oynada chiroyli formatlangan HTML + `window.print()` → brauzer "Save as
  PDF") + "Qayta tahlil". Backend 0 xato, tsc+vite yashil. Migratsiya hand-written (EF tool v10≠EF Core 8) — `.cs`+
  `.Designer.cs`+snapshot yangilandi, Infrastructure build 0.
  **(2) TELEGRAM BACKUP BUG (yubormayotgan edi):** ildiz sabab — `docker-compose.yml` backup xizmati `postgres:16-alpine`
  image'da ishlaydi, LEKIN bu image'da **`curl` YO'Q** (tasdiqlandi: `curl MISSING`); backup skripti esa Telegram'ga
  `curl ... sendDocument` bilan yuborardi → `curl: not found` → "Telegram xatosi" log, backup faqat LOCAL saqlanardi.
  **Yechim:** backup konteyner startupida (token sozlangan bo'lsa) `apk add --no-cache curl ca-certificates` o'rnatiladi
  (jonli tasdiqlandi: curl 8.19 o'rnatildi); send blokiga 50MB Telegram chegarasi guard + curl mavjudlik tekshiruvi +
  `-H Content-Type` olib tashlandi (`-F` boundary'ni o'zi qo'yadi). `docker compose config` valid.
  **(2b) Backup vaqtiga DAQIQA qo'shildi:** ilgari faqat `BACKUP_HOUR` (soat) bor edi → endi `BACKUP_MINUTE` ham
  (`.env`dan, default 0). Loop kun-ichi-daqiqasi solishtiruvi (`now = H*60+M >= target`, 10-daqiqali oyna, kuniga bir
  marta `last` guard; `10#` leading-zero uchun) + poll 300s→60s (daqiqa aniqligi). docker-compose env'lari `.env`dan
  o'qiydi (`BACKUP_HOUR:-21`, `BACKUP_MINUTE:-0`). Vaqt mantig'i jonli simulyatsiya bilan tasdiqlandi (21:30 target →
  21:30/21:35 BACKUP, 21:40 skip, takror skip).
  **DEPLOYDA:** `docker compose up -d --build app` (AI tahlil — migratsiya startupda avto, postgres-data saqlanadi) +
  `docker compose up -d backup` (curl-fix yangi backup konteyner). Telegram backup ishlashi uchun prod `.env`da
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` to'ldirilgan bo'lishi SHART (admin chatga bot /start qilgan bo'lsin).
  AI tahlil uchun Sozlamalar → AI Tahlil (Gemini)'da Gemini API kaliti kiritilsin (aistudio.google.com/app/apikey).

- 2026-06-25: **BUG FIX — daraja testi statistikasida HAMMA "o'chirilgan" (qizil) ko'rinardi.** Muammo
  (`LevelTestsController.Stats`): `isDeleted = string.IsNullOrEmpty(LeadId) || sid == null || !existing.Contains(sid)`
  — bu yerda `sid` = lidning `ConvertedStudentId`i. Test topshirgan odam birinchi bosqichdagi LID bo'lib turadi
  (hali o'quvchiga AYLANTIRILMAGAN) → `sid == null` → `isDeleted = true` → BARCHA konvertatsiya qilinmagan lid xato
  "o'chirilgan" deb (qizil, line-through, "(o'chirilgan)") ko'rsatilardi. **Yechim:** "o'chirilgan" endi LIDNING
  o'zi CRM'dan o'chirilganini bildiradi (konvertatsiya holatiga bog'liq emas). Lid o'chirilganda `db.Leads`'dan
  o'chadi (ArchiveService snapshot qoladi) → mavjud lid id'lar to'plami (`existingLeadIds`) hisoblanadi;
  `isDeleted = LeadId bor && existingLeadIds'da YO'Q`. Endi birinchi bosqichdagi lid "o'chirilgan" emas; faqat
  haqiqatan o'chirilgan lid qizil bo'ladi. Endi ishlatilmaydigan `existing` (arxivlanmagan o'quvchilar) so'rovi
  olib tashlandi. Frontend tegilmadi (StatsPanel `r.isDeleted` ni ishlatadi). Sxema/migratsiya yo'q. Backend 0.
  **JONLI E2E** (throwaway PG): test → public submit (lid yaratildi, konvertatsiya yo'q) → stats `isDeleted=False`;
  lidni o'chirdik → stats `isDeleted=True`. **DEPLOYDA:** `docker compose up -d --build app` (migratsiya yo'q).
- 2026-06-25: **BAHOLASH MEZON CHECKLARI SONI = JURNAL BAHOSI (avto-sinxron) + REYTING DUBLIKAT BUG TUZATILDI.**
  Foydalanuvchi: baholash (grading) bo'limida o'quvchiga bir darsda nechta mezon ✓ (ptichka) qo'yilsa, SHU SON
  jurnalga baho bo'lib tushsin (4 mezondan 3tasi belgilansa → jurnalda 3). **Backend (GradingController):** yangi
  `SyncJournalGradeAsync(db, group, studentId, date)` — (guruh, o'quvchi, sana) bo'yicha BELGILANGAN (Done) va
  guruhga BIRIKTIRILGAN mezonlar sonini hisoblab `JournalEntry.Grade` ga yozadi (SubjectId=Group.CourseId,
  Quarter=1, Period=1; 0 bo'lsa Grade=null, boshqa maydonlar saqlanadi; darsni LessonNote.Conducted=true qiladi;
  kelajak/StartDate'dan oldingi sanaga yozmaydi). `UpsertGradeAsync` (bitta toggle) va `BulkGradeAsync` (mezon →
  hamma) endi mezon o'zgarishini saqlab so'ng shu helperni chaqiradi — ADMIN ham, O'QITUVCHI portali ham bir xil
  static helperlarni ishlatgani uchun ikkalasiga ham tatbiq bo'ladi. Kurssiz guruhda jurnal yo'q → o'tkazib yuboradi.
  **Frontend:** GradingSection allaqachon "Jami" (check soni) ustunini ko'rsatadi; "Jurnal" tabiga bosilganda jurnal
  qayta yuklanadi (`ClassDetailPage` + `TeacherGroupDetailPage`) — baho darhol ko'rinadi (har toggleda emas, tab
  almashganda — yengil). **REYTING BUG (RatingService.SchoolAsync):** ilgari har (o'quvchi, guruh) uchun ALOHIDA
  qator chiqardi → bir nechta guruhdagi o'quvchi reytingda DUBLIKAT bo'lib, o'rin/jami soni/top-15 xato edi (student
  portali `Progress`). Endi HAR O'QUVCHI BITTA QATOR: baho/davomat barcha FAOL guruhlari bo'yicha YIG'ILADI;
  arxivlanganlar chiqarildi; vakil sinf = ClassName yorlig'i (bor bo'lsa) yoki birinchi guruh. `Analytics.BuildClass`
  TEGILMADI (ClassAnalytics Stats/Performance o'zgarmadi). Sxema o'zgarmadi (migratsiya YO'Q). Backend 0, tsc+vite
  yashil. **JONLI E2E** (throwaway PG): 4 mezon biriktirildi → 3 ✓ → jurnal baho 3; 4 ✓ → 4; 2 olib tashlandi → 2;
  hammasi olib tashlandi → null; bulk 1 ✓ → 1; o'quvchi 2 guruhda → reyting 1 qator (dedup). **DEPLOYDA:**
  `docker compose up -d --build app` (migratsiya yo'q, postgres-data saqlanadi).
- 2026-06-25: **LANDING TO'LIQ QAYTA QURILDI (vanilla, 8 bo'lim) + EDITOR SODDALASHTIRILDI (4 narsa).**
  Foydalanuvchi: apex landing yangi navigatsiya — Biz haqimizda · Afzalliklarimiz · Ustozlar · Natijalar ·
  Narxlar · Fotogalereya · Vakansiyalar · FAQ; CRM editordan FAQAT 4 narsa tahrirlanadi — kurslar (narx+matn),
  ustozlar (rasm+matn), sertifikatlar (rasm), daraja test LINKI. Qarorlar (foydalanuvchi): 3 til (uz/ru/en),
  narx editorda kurs bilan kiritiladi, fotogalereya alohida rasm yuklash. **DC-runtime (support.js/image-slot.js,
  unpkg/Babel) OLIB TASHLANDI** → `page/Intellect Kokand.dc.html` endi self-contained VANILLA (inline CSS+JS,
  Google Fonts; window.__LANDING_CONTENT__ dan o'qiydi, statik matn HTML ichida hardcoded zaxira). 8 bo'lim +
  hero + aloqa + footer; til almashtirish, FAQ akkordeon, rasm lightbox, "Daraja test" CTA → testLink (yo'q
  bo'lsa #contact). **Sxema:** `{courses:[{price,uz/ru/en:{name,desc}}], teachers:[{photo,uz/ru/en:{name,role,bio}}],
  certificates:[url], gallery:[url], testLink}` (sertifikat/galereya bo'sh bo'lsa bo'lim ko'rinmaydi). **Backend
  (LandingController):** GET/PUT kontent (obyekt validatsiya), `POST upload` (generic rasm → {url}), `reset`;
  saqlashda YETIM `landing-*` fayllar avto-tozalanadi (GC — JSON'da ishlatilmagan rasm o'chadi). `page/landing.default.json`
  yangi sxemaga (editor boshlang'ich holati). LandingContent entity/jadval o'zgarmadi (faqat JSON shakli) → migratsiya
  YO'Q. **Program.cs:** inject anchor `support.js` o'rniga `</head>` oldi; landing CSP'dan unpkg/unsafe-eval olib
  tashlandi (vanilla → eval kerak emas). **Frontend:** `landing.ts` yangi tiplar (LandingCourse/Teacher) + generic
  upload; `LandingSettings.tsx` to'liq qayta yozildi — uz/ru/en tab + Daraja test linki (URL + mavjud testlardan
  tanlash → `origin/test/{slug}`) + Kurslar (narx+nom+tavsif) + Ustozlar (rasm+ism+yo'nalish+bio) + Sertifikatlar
  (ko'p rasm grid) + Fotogalereya (ko'p rasm grid). Backend 0, tsc+vite yashil. **JONLI SINOV** (throwaway PG,
  Production, DLL): apex `/` → vanilla landing (8 bo'lim, "Daraja test", CSP unpkgsiz, support.js/unpkg refs=0);
  login → GET default (4 kurs/1 ustoz) → PUT (TEST-KURS-XYZ + ustoz + testLink) → apex injection `</head>` OLDIDA
  edited kontent; crm host izolyatsiya (qat'iy CSP, landing app div yo'q); apex `/api/health` 200; upload → {url};
  GC: galereyaga teglangan rasm SAQLANDI, teglanmagan O'CHDI. **DEPLOYDA:** `docker compose up -d --build app`
  (`page/` Dockerfile'da nusxalanadi; migratsiya yo'q, postgres-data saqlanadi). **QOLDI (foydalanuvchi/infra):**
  Cloudflare panelida apex `intellectschool.uz` (+www) → HTTP → `app:8080` Public Hostname (DNS/tunnel dashboard ishi).
- 2026-06-24: **YANGI — APEX domen LANDING sahifasi (intellectschool.uz → marketing sayti, crm.* → SPA).**
  Repo ildizida `page/` statik marketing sayti bor (`Intellect Kokand.dc.html` + `support.js`/`image-slot.js` DC
  runtime — Babel/React'ni unpkg'dan yuklab brauzerda render qiladi + `screenshots/trial.png`). **Talab:** asosiy
  domen `intellectschool.uz`ga kirilganda shu landing, subdomen `crm.intellectschool.uz`da esa CRM (SPA) ishlasin.
  **Yechim (Program.cs, host-based routing):** CRM SPA FAQAT `App:Host` (=`APP_HOST`=crm.intellectschool.uz) hostida;
  boshqa BARCHA hostlar (apex + www) → `page/` (mavjud `App__Host` env va izohiga mos — "qolganlari → landing").
  `MapWhen(IsLandingHost && !/api && !/hubs && !/uploads)` branch: `page/` statik fayllar + `/`→landing index
  (`*.dc.html`). `/api`·`/hubs`·`/uploads` landing hostda ham backendga o'tadi. **CSP host-aware:** apex uchun
  yumshoqroq (unsafe-inline/eval + unpkg + Google Fonts — DC runtime ishlashi uchun), crm uchun eski qat'iy CSP.
  **Xavfsiz fallback:** `App:Host` bo'sh (dev) yoki `page/` yo'q bo'lsa landing O'CHIQ — hamma host SPA (lockout yo'q).
  **Dockerfile:** `COPY page/ ./page/` (final stage). **Jonli sinov (lokal, Production, throwaway PG):** apex `/`→landing
  (x-dc, 200), apex CSP unpkg/fonts, crm `/`→SPA + qat'iy CSP, apex support.js/trial.png 200, /api/health ikkala
  hostda, crm support.js→404 (izolyatsiya). Backend 0 xato. **QOLDI (foydalanuvchi/infra):** Cloudflare panelida
  apex `intellectschool.uz` (+ www) uchun Public Hostname → HTTP → `app:8080` qo'shilishi kerak (DNS/tunnel —
  dashboard ishi). **KEYINGI bosqich (foydalanuvchi rejasi):** superadmin crm panelidan landing kontentini
  tahrirlaydigan bo'lim — hozircha QILINMADI (statik serving birinchi qadam).
- 2026-06-24: **YANGI — LANDING KONTENT MUHARRIRI (Sozlamalar → Landing page, superadmin) + rasm yuklash backendda.**
  Apex landing (`page/Intellect Kokand.dc.html`) kontenti DC-runtime HTML ichidagi inline `T` obyektida (uz/ru/en;
  nav/hero/courses/faqs/vacancies/... ~19 bo'lim) hardcoded edi. Endi superadmin CRM'dan tahrirlaydi.
  **Backend:** `LandingContent` entity (singleton, bitta JSON blob `{langs:{uz,ru,en}, images:{slotId:url}}`);
  inkremental migratsiya `AddLandingContent` (1 jadval, data loss YO'Q); `LandingController` [`Authorize(Roles=
  "superadmin")`] — `GET/PUT /api/admin/landing` (kontent), `POST/DELETE /api/admin/landing/images/{slotId}` (rasm),
  `POST .../reset`. **Apex serving (Program.cs):** landing branch endi HTML'ni o'qib, DB kontentini
  `<script>window.__LANDING_CONTENT__=...</script>` bo'lib support.js'dan OLDIN inject qiladi (HTML bir marta keshlanadi,
  DB har so'rovda; `</`→`<\/` breakout himoyasi). DB BO'SH bo'lsa inject YO'Q → HTML ichidagi hardcoded (zaxira)
  kontent ishlaydi (xavfsiz fallback, standalone DC editor ham buzilmaydi). `page/landing.default.json` (35KB, HTML
  `T`'dan node bilan ajratilgan) — controller DB bo'sh bo'lsa shuni qaytaradi (editor uchun boshlang'ich). **Landing
  HTML:** `T = (window.__LANDING_CONTENT__ && .langs) || {hardcoded}`; cert `x-import`ga `src="{{ cs.src }}"` +
  certSlots `src` = injected images map. **`image-slot.js`:** tashrifchi yuklashi O'CHIRILDI — empty-click file-picker
  va drag-drop endi FAQAT DC editor runtime'da (`window.omelette`); produksiyada rasm faqat ko'rsatiladi (`src` =
  backend). Rasm endi superadmin CRM'dan backendga yuklanadi (`/uploads/landing-*`). **Frontend:** `Sozlamalar →
  "Landing page"` (nav `roles:['superadmin']`; SettingsPage `section==='landing'`); `LandingSettings.tsx` — til tablari
  (uz/ru/en) + REKURSIV kontent muharriri (satr/satrlar-massivi/obyektlar-massivi/ichma-ich obyekt — qo'shish/tahrir/
  o'chirish, bo'limlar `<details>` collapsible) + 6 sertifikat rasm sloti (yuklash/almashtirish/o'chirish, backend) +
  Saqlash/Standart/Saytni-ko'rish; `api/services/landing.ts`. Non-superadmin'ga komponent "faqat superadmin" deydi
  (backend ham 403). **JONLI SINOV** (throwaway PG, Production): migratsiya `LandingContents` yaratdi; login → GET
  default → PUT (nav.about tahrir + yangi kurs qo'shildi) → apex injection edited kontentni ko'rsatdi (TEST-EDIT-XYZ +
  "Yangi kurs"); rasm upload 200 → apex injectionда url + `src="{{ cs.src }}"` binding; crm host injection YO'Q
  (izolyatsiya, SPA); reset → DB bo'sh → apex hardcoded fallback. Backend 0, tsc+vite yashil, push ✅. **DEPLOYDA:**
  `docker compose up -d --build app` (migratsiya startupда avto; `page/` Dockerfile'da nusxalanadi → default.json +
  yangilangan HTML/image-slot.js boradi). Sxema o'zgardi → migratsiya qo'llanadi (postgres-data SAQLANADI).
- 2026-06-24: **FIX — landing host moslashuvi PORT-AGNOSTIK qilindi (apex→page/, crm→SPA, BITTA dokerda).**
  Muammo: `IsLandingHost` `c.Request.Host.Host` (PORTSIZ hostname) ni `App:Host` (port BILAN bo'lishi mumkin,
  mas. lokal `localhost:8080`) bilan solishtirardi → `"localhost" != "localhost:8080"` → hamma host landing'ga
  ketardi (lokalda CRM ochilmasdi). Yechim (1 qator): `appHost`dan port olib tashlandi (`.Split(':')[0]`) →
  hostname↔hostname. Prod (`crm.intellectschool.uz`, portsiz) ta'sirlanmaydi. **JONLI SINOV** (throwaway PG,
  Production, DLL to'g'ridan ishga tushirildi — `dotnet run` SPA-proxy'sidan qochib): apex `intellectschool.uz`/
  `www` `/`→page/ landing (Intellect Kokand+support.js+x-import), `/support.js`→200 JS, `/screenshots/trial.png`→200,
  crm `/`→CRM SPA marker + deep route `/admin/students`→SPA fallback, crm `/support.js`→404 (izolyatsiya), `/api/health`
  ikkala hostda backend. Backend 0 xato. **QOLDI (foydalanuvchi/infra, men qila olmayman):** Cloudflare panelida
  apex `intellectschool.uz` (+`www`) uchun Public Hostname → HTTP → `app:8080` qo'shilishi SHART (DNS/tunnel dashboard
  ishi) — busiz apex murojaat dokerga yetib bormaydi. **DEPLOYDA:** prod `.env` `APP_HOST=crm.intellectschool.uz`,
  `ROOT_DOMAIN=intellectschool.uz` (lokal `.env`da hozir `localhost`). **KEYINGI (deferred, "hozircha faqat shuni"):**
  superadmin crm subdomenidan landing kontent/ma'lumotini yuklaydigan bo'lim — hali QILINMADI.
- 2026-06-24: **BUG FIX — guruh o'quvchilar SONI (studentsCount) endi M2M a'zolikdan (ClassName emas).** Muammo:
  guruh kartasidagi "o'quvchilar soni" (`/admin/classes/stats` → `Analytics.BuildClass`) eski `Student.ClassName ==
  guruh nomi` bo'yicha sanardi, lekin haqiqiy a'zolik M2M `StudentGroup` jadvalida (a'zolar oynasi "azolar" shu
  manbadan ishlaydi). Natija: a'zolar oynasidan qo'shilgan (ClassName o'rnatilmaydi) yoki guruhdan chiqarilgan
  o'quvchilarda karta soni a'zolar oynasi bilan MOS KELMASDI. **Yechim:** `Analytics.BuildClass`ga 2 ixtiyoriy param
  (`activeMemberIds`, `anyMemberIds`); berilsa roster = FAOL `StudentGroup` a'zoligi + (orqaga moslik) bu guruh uchun
  umuman a'zolik yozuvi YO'Q eski ClassName-o'quvchilari. `ClassAnalyticsController` (Stats/Performance) va
  `RatingService.SchoolAsync` endi `db.StudentGroups`ni yuklab per-guruh active/any id'larni uzatadi. Param berilmasa
  eski ClassName xulqi (to'liq orqaga moslik). Reyting ham endi a'zolik bo'yicha. Backend 0 xato. Frontend tegilmadi
  (`studentsCount` shu endpointdan keladi). Chiqarilgan/muzlatilgan a'zo endi sanalmaydi (to'g'ri).
- 2026-06-23: **"Oylik hisoblash" (teacher-level maosh) sahifasi OLIB TASHLANDI** — maosh endi PER-GURUH
  (o'qituvchi "Maosh" tabida har guruhga alohida foiz/qat'iy summa) bo'lgani uchun teacher-level rejim sozlash
  sahifasi ortiqcha. O'chirildi: `pages/admin/teachers/TeacherSalaryPage.tsx`, nav band ("O'qituvchilar → Oylik
  hisoblash"), `App.tsx` import+route (`teachers/salary`). `TeacherFormModal` izohi yangilandi (maosh "Maosh"
  tabida per-guruh belgilanadi); `salaryStartDate` input + salaryMode/Salary/SalaryPercent round-trip SAQLANDI
  (legacy fallback + proratsiya uchun). Backend o'zgarmadi (teacher-level maydonlar legacy fallback sifatida qoladi).
  Teacher PORTAL `SalaryPage` (o'qituvchi o'z oyligini ko'radi) TEGILMADI. tsc+vite yashil.
- 2026-06-23: **O'qituvchi maoshi — PER-GURUH foiz/qat'iy summa (oyligi guruhlar yig'indisi).** Ilgari maosh
  o'qituvchi DARAJASIDA edi (bitta `Teacher.SalaryMode` + bitta `SalaryPercent`/`Salary`). Endi HAR GURUH alohida
  sozlanadi: bir guruhi 40%, keyingisi 60% yoki qat'iy summa bo'lishi mumkin — o'qituvchi oyligi guruhlar ulushi
  YIG'INDISI. **Backend:** `Group`ga 3 ustun — `TeacherSalaryMode` ("" umumiy | "percent" | "fixed"),
  `TeacherSalaryPercent`, `TeacherSalaryFixed` (inkremental migratsiya `AddGroupTeacherSalary` — 3 ustun, default 0/"",
  data loss YO'Q). `SalaryLedger.BuildAsync` qayta yozildi: `CollectedForTeacherGroupsAsync` → `CollectedPerGroupAsync`
  ((oy,guruh)→yig'ilgan; teglangan 100% guruhga, teglanmagan fee nisbatida har guruhga). Har oy = guruhlar ulushi
  yig'indisi (percent → guruh yig'ilgani×foiz; fixed → qat'iy summa, 1-oy qisman proratsiya). **LEGACY fallback:**
  hech bir guruh sozlanmagan bo'lsa eski xulq (teacher-level fixed/percent) — to'liq orqaga moslik. Guruh "umumiy"
  (mode="") bo'lsa o'qituvchi darajasidagi sozlamaga ergashadi. `SalaryLedgerDto.Groups` (per-guruh breakdown:
  rejim/qiymat/davr yig'ilgani/davr hisoblangani). Endpoint `PUT /admin/teachers/{id}/group-salaries` (faqat shu
  o'qituvchi guruhlari, audit). FinanceController.salary-report o'zgarmasdan to'g'ri ishlaydi (ledger jami). **Frontend:**
  `Group`ga 3 maydon, `SalaryLedger.groups`+`GroupSalaryLine` tip, `teachers.ts` `saveGroupSalaries`. `TeacherDetailPage`
  Maosh tabida yangi `GroupSalaryEditor` — har guruh: Umumiy|Foiz|Qat'iy segment + qiymat input + davr bo'yicha ulush;
  "Saqlash" → reload; KPI 4 karta (guruhlar/joriy oy/jami hisoblangan/berildi). Backend 0, tsc+vite yashil.
- 2026-06-23: **O'qituvchilar hisoboti OYLIK bo'ldi (subagent).** Oy tanlash paneli ("Umumiy" + har oy, uzluksiz
  yillar bo'ylab `formatMonth` yorlig'i). Har o'qituvchi bo'yicha shu oyda qancha o'quvchi kelgan/aktivlashgan/
  ketgan/muzlatilgan + dars faolligi shu oy. Lifecycle EVENT-DATE oqimi (JoinedAt/ActivatedAt/FrozenAt/LeftAt oyi)
  → oylar yig'indisi = "Umumiy". Dars faolligi `Date[..7]==month`. Oylar: eng erta data oyidan joriygacha
  (`TuitionService.MonthRange`). `TeacherReportOverviewDto{Months,Month,Rows}`; controller `?month=`; detail ham
  oyga bog'landi. Sxema o'zgarmadi. Backend 0, tsc+vite yashil.
- 2026-06-23: **Pul maydonlari istalgan summani qabul qiladi (`step="any"`).** number input `step={50000}`/`{1000}`
  HTML5 da karrali bo'lmagan summani (137000) rad etardi → forma yuborilmasdi. 7 maydon: kurs oylik/dars narxi,
  to'lov (PaymentModal), moliya tranzaksiyasi, guruh narxi, o'qituvchi maoshi, chegirma.
- 2026-06-23: **Xodimlar va rollar — buglar tuzatildi (subagent audit).** (A, xavfsizlik) `StaffController.Create`
  ruxsat (template/extra) o'rnatishni `superadmin`ga chegaraladi — oldin "staff" ruxsatli xodim yangi xodimga
  istalgan ruxsat (finance/settings/staff) berib privilege escalation qila olardi (`SetPermissions` superadmin-only
  edi, lekin `Create` himoyasiz). (B) `Update` FullName null/bo'sh tekshiruvi (NRE). (C) `SetPermissions` null/bo'sh/
  dublikat ruxsatlarni tozalaydi (null claim → `OnTokenValidated` 500 oldini olish). (D, UX) `StaffPage`
  handleSubmit/savePerms `.catch`+alert; rol shablonlari alohida yuklanadi (ixtiyoriy shablon xatosi xodim ro'yxatini
  buzmaydi). Sxema o'zgarmadi. Backend 0, tsc+vite yashil.
- 2026-06-23: **O'qituvchilar hisobotiga o'quvchi KONVERSIYA/lifecycle metrikalari (subagent).** Har o'qituvchi
  (`Group.TeacherId` guruhlari → `StudentGroup` a'zoliklari): Kelgan (jami) / Faol (active) / Sinov (trial) /
  Muzlatilgan (frozen) / Ketgan (IsActive=false) + Sotuv konversiyasi (faol÷kelgan %). `TeacherReportRowDto`/
  `TeacherReportDetailDto`ga 6 maydon; `TeacherActivityReport.ComputeAsync` lifecycle sanoqlari; `TeacherReportsPage`
  6 ustun + 3 KPI karta + detail blok. Backend 0, tsc+vite yashil.
- 2026-06-23: **Support feedback o'quvchi profilida.** Support o'qituvchiga guruh biriktirilmaydi (faqat slot),
  shuning uchun u o'quvchiga bergan feedback alohida ko'rsatiladi. Support o'tilgan darsni mavzu+izoh bilan yopadi
  (mavjud `complete` oqimi) → izoh = o'sha o'quvchiga feedback. Yangi endpoint `GET /admin/students/{id}/support-feedback`
  (`StudentsController` → done holatdagi SupportSlotlar: sana/vaqt/support ismi/mavzu/izoh, eng yangi birinchi) +
  DTO `StudentSupportFeedbackDto`. Frontend `students.ts` `getStudentSupportFeedback` + `StudentDetailPage`ga
  "Support feedback" bo'limi (LifeBuoy ikon, Oylik feedback'dan oldin). O'quvchining O'Z portalida bu allaqachon
  ko'rinadi (StudentSupportBookingDto done bronlar mavzu/izoh bilan). Backend 0, tsc+vite yashil, deploy ✅.
- 2026-06-23: **SUPPORT tizimi — KRITIK bug tuzatildi (support portali umuman ishlamasdi) + tozalash.**
  Ildiz: `TeachersController` IsSupport o'qituvchiga `AppUser.Role="support"` berardi, LEKIN frontend "support"
  rolini umuman tanimaydi (`Role` tipida yo'q, `homeByRole`da yo'q) va support sahifasi `/teacher/support`
  (TeacherPortalController, role="teacher") endpointlarini chaqiradi. Natija: support o'qituvchi login qilsa
  teacher portaliga KIRA OLMASDI (role gate) → butun support portali ishlamasdi. Bundan tashqari `/api/support`
  (`SupportPortalController`, role="support") — frontend hech qachon chaqirmaydigan O'LIK dublikat edi.
  **Yechim (Option A):** support o'qituvchi ham `role="teacher"` (+ `Teacher.IsSupport` bayrog'i) — "Support"
  sahifasi teacher portalida IsSupport bo'yicha ko'rinadi (frontend allaqachon shunday qurilgan). O'zgarishlar:
  TeachersController Create/Update rolni doimo `Roles.Teacher` qiladi (eski support akkauntni tahrirda ham
  tuzatadi); `Program.cs` startup self-heal (mavjud `Role="support"` → `"teacher"`, idempotent ExecuteUpdate);
  o'lik `SupportPortalController.cs` O'CHIRILDI; `SupportService` faqat `StudentNamesAsync` qoldi (ListAsync/
  AddAsync/DeleteAsync/CompleteAsync — faqat SupportPortal ishlatardi, o'chirildi); `Roles.Support` konstantasi
  olib tashlandi (endi alohida rol yo'q). **Bonus bug:** o'quvchi slot bron qilish (`StudentPortalController.
  BookSupport`) check-then-act RACE edi (2 o'quvchi bir slotga) → atomik `ExecuteUpdateAsync` (faqat "open"+egasiz
  qator) bilan race-safe qilindi. ESLATMA (qolgan, dizayn): support bron qilingan slotni o'chira oladi (o'quvchi
  broni jimgina yo'qoladi); o'tilgan slot o'chirilmaydi. Backend 0, deploy ✅.
- 2026-06-23: **Aktivlashtirish (qisman-oy) billing FORMULASI o'zgartirildi + kursga "bir dars narxi" qo'shildi.**
  Muammo: oy o'rtasida aktivlashtirilganda eski formula `oylik × qolgan_dars ÷ shu_oydagi_jami_dars` edi → 13 darsli
  oyda to'lov biroz kam chiqardi. **Yangi formula** (`TuitionService.ProratedLessonCharge`, yagona helper): qolgan
  dars == jami (oyning BIRINCHI darsidan) YOKI 12+ qolgan → **to'liq oylik narx**; 12 tadan kam qolgan → **qolgan dars
  × kursning bir dars yaxlit narxi** (`Subject.LessonPrice`); to'liq oylikdan oshmaydi (cap). `LessonPrice` kiritilmagan
  (0) bo'lsa — eski pro-rata fallback (orqaga moslik). Bir xil formula **muzlatish** (freeze) qisman to'loviga ham
  qo'llandi (izchillik: aktivlashtir→muzlat bir oyda mos). `addSegment` (muzlatib→qayta aktiv) yig'indisi ham oylikdan
  oshmaydi. **Subject.LessonPrice** (decimal) qo'shildi — kurs yaratish/tahrirlashda "Bir dars narxi (yaxlit)" maydoni
  (SubjectFormModal + SubjectsPage karta + SubjectPayload/types). Proration metodlari narxni `cls.CourseId` orqali jonli
  o'qiydi (signature/caller o'zgarmadi). Migratsiya `AddSubjectLessonPrice` (inkremental, 1 ustun default 0, data loss
  YO'Q). Backend 0, tsc+vite yashil, deploy ✅. ESLATMA: yangi xulq uchun admin kursga LessonPrice kiritishi kerak;
  kiritmasa eski formula ishlaydi.
- 2026-06-23: **Xona samaradorligi (room utilization) — buglar tuzatildi.** (1) **CRASH:** `RoomUtilizationService.
  GetRoomUtilizationAsync` `rooms.ToDictionary(r => r.Name, …)` — Room.Name unique EMAS → bir xil nomli ikki faol
  xona bo'lsa ArgumentException → butun utilization-dashboard 500. Yechim: `TryAdd` loop (birinchi g'olib). Ildiz
  sabab ham yopildi: `RoomsController.Create/Update` endi dublikat faol xona nomini bloklaydi (case-insensitive,
  Update'da o'zini chiqaradi) → 400 "Bu nomli faol xona allaqachon mavjud". (2) **MODAL noto'g'ri ko'rsatardi:**
  `GetRoomDetailMetricAsync`da `actualStudents` = guruhlar yig'indisi (unique EMAS) va `occupancyPercent = actualStudents
  / totalSlots`, lekin modal uni "**Unique** o'quvchilar: {actualStudents} / **capacity**" + "% bandlik (**unique**)"
  deb ko'rsatardi (40/30 ko'rinib foiz 66.7% — qarama-qarshi). Tuzatildi: yorliq "O'quvchilar", denominator
  `/ totalSlots`, "(unique)" olib tashlandi. Bundan tashqari `utilizationPercent === occupancyPercent` (alias) bo'lgani
  uchun modaldagi takror "Slot bandligi" progress bar olib tashlandi. `getRoomCapacity`/`/capacity` endpoint o'lik
  (ishlatilmaydi — tegilmadi). Backend 0, tsc+vite yashil, deploy ✅.
- 2026-06-17: **FIX 2: DOUBLE-CHARGE race condition — idempotency check qo'shildi.** Muammo: admin to'lov
  2 marta POST qilsa (double-click yoki network retry) → 2 transaction + balance 2x kattalaşir (revenue loss).
  Frontend submitting guard yetarli emas. **Yechim:** `FinanceTransaction`ga `CreatedAt` (UTC DateTime) qo'shildi;
  `POST /api/admin/finance/transactions` endi 5-soniyada bir xil tranzaksiyani tekshiradi (StudentId+Amount+Direction+
  Category+Month+GroupId+TeacherId mos bo'lsa) → bo'lsa dublikat qaytaradi (idempotent), aks holda yangi qo'shadi.
  Migratsiya `AddFinanceTransactionCreatedAt` (incremental, data loss YO'Q). Backend 0, `app` rebuild deploy ✅.
  Jonli: POST→201, qayta POST (5s ichida)→200 shu id (idempotent).
- 2026-06-16: **Telegram bot — ADMIN/xodim ro'yxatdan o'tib YANGI LID xabarnomasini oladi.** `AppUser.Phone`
  (admin/xodim telefoni) + `TelegramRegistration.UserId` (admin yozuvi) + migratsiya `AddAdminPhoneAndTgUser`.
  Bot kontakt kelganda endi o'quvchi/o'qituvchi BILAN BIR QATORDA admin/superadmin/staff AppUser.Phone'ni ham
  moslaydi → mos kelsa UserId registratsiya yoziladi (APK yuborilmaydi, "yangi lid xabarnomasi olasiz" deydi).
  `LeadNotifier.NotifyNewLeadAsync` (yangi servis): yangi lid yaratilganda UserId-registratsiyali admin/superadmin
  (har doim) yoki staff (leads ruxsati) chatlariga Telegram xabar (ism/telefon/manba/qiziqish). Chaqiriladi:
  `LeadsController.Create` (qo'lda) + `LevelTestService.SubmitAsync` (daraja testi; PublicTestController telegram
  uzatadi). Telefon kiritish: xodim formasi (StaffPayload/StaffController/StaffPage) + akkaunt sozlamalari
  (UpdateAccountRequest/AuthController/AccountSettings) — superadmin o'z telefonini akkauntdan kiritadi. UserDto/
  User.phone qaytadi. Backend 0, tsc+vite yashil, deploy ✅ (Phone+UserId ustunlar tasdiqlandi); E2E: admin login →
  account phone saqlandi/me roundtrip → lid yaratish 200 (notifier bot o'chiq → no-op, lid buzilmadi). ESLATMA:
  haqiqiy yuborish uchun bot tokeni kerak; xabar borishi uchun admin o'z telefonini kiritib BOTGA shu raqamni
  yuborib ro'yxatdan o'tishi shart.
- 2026-06-16: **YANGI — SUPPORT o'qituvchi (bo'sh vaqt + bron darslari).** `Teacher.IsSupport` (admin
  O'qituvchi formasida "Support o'qituvchi" checkbox). Yangi `SupportSlot` entity (TeacherId/Date/StartTime/EndTime/
  Status[open|booked|done]/StudentId?/BookedAt/Topic/Notes) — bitta slot = bitta bron = bitta dars (1:1). Migratsiya
  `AddSupport` (Teachers.IsSupport + SupportSlots jadval). **Backend:** admin `SupportController` (`/admin/support/teachers`
  list+stats, `/teachers/{id}` tafsilot = o'tilgan/bron/bo'sh slotlar — kim, qachon, mavzu); teacher `TeacherPortalController`
  (`GET/POST/DELETE support/slots`, `POST support/slots/{id}/complete` mavzu+izoh) — **blok qism-slotlarga bo'linadi**:
  `CreateSupportSlotRequest.SlotMinutes` (har odamga ajratilgan davomiylik, masalan 1 soat + 30 → 2 slot) + `RepeatWeeks`
  (haftalik/oylik takror); student `StudentPortalController` (`GET support`, `POST support/slots/{id}/book|cancel`).
  `SupportService.StudentNamesAsync` umumiy. **Frontend:** `api/services/support.ts` (barcha API+tiplar); admin
  `pages/admin/support/SupportPage`+`SupportDetailPage` (nav "Ilova → Support", `/admin/support`); teacher
  `pages/teacher/support/SupportPage` (`TeacherSupportPage`, Profil menyuda faqat IsSupport bo'lsa, `/teacher/support`);
  student `pages/student/Support` (`StudentSupportScreen`, Profil menyuda, `/student/support`). `TeacherProfile.isSupport`
  /teacher/me'dan keladi; TeacherFormModal checkbox round-trip. 3 ekran 3 parallel subagent bilan qurildi. Backend 0,
  tsc+vite yashil, deploy ✅ (migratsiya qo'llandi: SupportSlots jadval + IsSupport ustun tasdiqlandi); 9 endpoint 401
  (auth-gated), 3 SPA route 200. Oqim: admin teacher'ni support qiladi → support bo'sh vaqt bloki + per-odam daqiqa
  kiritadi (slotlarga bo'linadi) → o'quvchi Profil→Support'dan slot bron qiladi → support "Darsni yopish" (mavzu+izoh)
  → admin SupportDetail'da kim/qachon/mavzu ko'radi.

- 2026-06-15: **YANGI — SPEAKING topshirig'i (Azure Pronunciation Assessment, AI avto-baho).** Topshiriqlarga yangi
  format "speaking": o'quvchi diktafonda gapiradi → Azure talaffuzni baholaydi → avto-ball + batafsil review.
  **Backend:** `CenterMeta.AzureSpeechKey/Region` + `SettingsController` GET/PUT `/admin/settings/azure-speech`;
  `Assignment.ReferenceText` (o'qiladigan matn) + `AssignmentSubmission.SpeakingResultJson`; migratsiya
  `AddSpeakingAssignment` (4 ustun). `AzureSpeechService` (REST, SDK'siz — Docker yengil): WAV PCM 16k → Pronunciation
  Assessment (Comprehensive + prosody) → recognizedText + PronScore/Accuracy/Fluency/Completeness/Prosody + per-word.
  Student endpoint `POST /student/assignments/{id}/speaking` (multipart audio) → Azure → submission saqlaydi (Score=
  PronScore, SpeakingResultJson) + qaytaradi; `GET .../speaking` oldingi natija. Kalit yo'q bo'lsa 400. DTO:
  SpeakingResultDto/WordDto, AzureSpeechSettingsDto. **Frontend:** `wavRecorder.ts` (mic→16k mono WAV, server
  konvertatsiyasiz, WebView'da ham); `AssignmentWizard`ga "Speaking" format + o'qiladigan matn maydoni (admin+teacher
  shared); `SpeakingRecorder.tsx` (diktafon yozish→yuborish→review: umumiy ball + 4 bal bar + tanilgan matn + per-word
  rang) — `AssignmentDetail`da format=speaking bo'lsa ko'rsatiladi; admin `AzureSpeechSettings.tsx` (Sozlamalar →
  "Speaking (Azure)" — kalit+region). AssignmentFormat'ga 'speaking' (5 Record map yangilandi). tsc+vite+backend 0,
  deploy ✅ (migratsiya). Jonli E2E: speaking topshiriq yaratildi (referenceText) → o'quvchi ko'rdi → kalitsiz submit
  400 "sozlanmagan". ESLATMA: Flutter WebView'da mic uchun RECORD_AUDIO ruxsati + onPermissionRequest grant kerak;
  Azure baholash faqat admin kalit/region kiritgach ishlaydi.
- 2026-06-15: **DB SQL Server → PostgreSQL ko'chirildi (1GB RAM server uchun).** SQL Server fizik >=2GB talab qiladi
  (swap yordam bermaydi) → 1GB server uchun Postgres'ga o'tildi. Loyiha XOM SQL'siz (LINQ-only) bo'lgani uchun xavf past.
  **Backend:** `Npgsql.EntityFrameworkCore.PostgreSQL` (Infrastructure.csproj; Server'dan o'lik `Pomelo.MySql` olib tashlandi);
  Program.cs `UseSqlServer`→`UseNpgsql` (EnableRetryOnFailure `errorCodesToAdd`, SplitQuery saqlandi) + **eng tepada
  `AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)`** (AppClock.Now Kind=Unspecified → `timestamp`
  timezonesiz; aks holda Npgsql 6+ `timestamptz` UTC talab qilib istisno tashlardi). appsettings.json dev conn →
  `Host=...;Username=postgres`. decimal→`numeric(18,2)` (billing aniq). Migratsiyalar O'CHIRILIB bitta `InitialCreate`
  qayta yaratildi (Postgres tiplari; yangi baza bo'sh — to'g'ri). **docker-compose:** `mssql`→`postgres:16-alpine`
  (pg_isready healthcheck, `postgres-data` volume); conn string `Host=postgres;...`; backup `BACKUP DATABASE`→`pg_dump|gzip`
  (.sql.gz, busybox-portable soat-poll rejasi); volume'lar `postgres-data`/`postgres-backups`. `.env.example`:
  `MSSQL_*`→`POSTGRES_PASSWORD/USER/DB`. DEPLOY.md + CLAUDE.md yangilandi. **Test:** vaqtinchalik Postgres konteynerda
  (prodga tegmasdan) — migratsiya 61 jadval yaratdi, decimal=numeric(18,2); ilova ulanib startupda Migrate+seed
  (super admin+sabablar), login→JWT, noto'g'ri parol→401, Users=admin/superadmin. Backend 0, compose validatsiya OK.
  ESLATMA: Postgres string solishtiruvi CASE-SENSITIVE (SQL Server CI emas) — login/qidiruv aniq harf; ID'lar GUID
  (ta'sir yo'q). Eski SQL Server prod ma'lumotini Postgres'ga ko'chirish kerak bo'lsa — alohida bir martalik (pgloader).
- 2026-06-15: **Dashboard "Eng yuqori bahoga ega guruhlar" — AKTIV talabalar soni qo'shildi.** Karta ilgari faqat
  jami a'zo (`MembersOf`, IsActive — sinov/muzlatilgan ham) ko'rsatardi; endi AKTIV (Status=="active") son ham.
  `DashboardController`: `classMemberships` (GroupId+Status) → `membersByClass`+`activeByClass`; `ActiveOf(c)`.
  `TopClassDto`ga `ActiveCount` (StudentsCount'dan keyin); TS `TopClass.activeCount`; mock yangilandi; AdminDashboard
  karta "● {activeCount} aktiv · {studentsCount} o'quvchi" (aktiv yashil). Migratsiya yo'q. Backend 0, tsc+vite yashil,
  deploy ✅. Jonli: TEST-G 8 aktiv/12 jami (4 sinov/muzlatilgan), test B 3/3. (Per-guruh aktiv yig'indisi breakdown.active=10
  dan farq qilishi mumkin — o'quvchi bir nechta guruhda aktiv bo'lsa har guruhda sanaladi, breakdown'da bir marta.)
- 2026-06-15: **SQL INJECTION auditi — loyiha HIMOYALANGAN (kod o'zgartirilmadi).** Butun kodbaza skani: xom SQL
  YO'Q (FromSqlRaw/FromSqlInterpolated/ExecuteSqlRaw/Interpolated/SqlCommand/ADO.NET/Dapper/Dynamic LINQ/migrationBuilder.Sql —
  hech biri). Barcha DB kirishi EF Core 8 (SqlServer) LINQ orqali → EF avtomatik PARAMETRLAYDI. Bulk `ExecuteDelete/
  UpdateAsync` ham LINQ-predikat (parametrli). `db.Database.Migrate()` faqat (kiritmasiz). Qidiruv/filtr `.Contains(ids)`/
  `==` (parametrlangan IN/=) yoki client-side. Backup/connection: qat'iy DB nomi + env parol (kiritma emas). XULOSA:
  SQLi zaifligi yo'q — kod tuzatish shart emas (kalit-so'z bloklash kabi anti-pattern QILINMADI). QOLDI (ixtiyoriy
  defense-in-depth, infra): app DB'ga `sa` (sysadmin) bilan ulanadi — least-privilege login tavsiya etiladi (migratsiya
  uchun DDL ruxsati kerakligi sabab — foydalanuvchi qarori bilan).
- 2026-06-15: **O'quvchi STATISTIKA bo'limiga BAHOLASH mezonlari (har darslik) + uy-vazifa trendi qo'shildi (audit).**
  Audit: `Statistics.tsx` `StudentNotebook`ning deyarli barchasini ko'rsatardi (baho/davomat/intizom/topshiriq/feedback/
  uy-vazifa), lekin (1) `marksTrend` (oylik uy-vazifa) render qilinmagan, (2) **baholash mezonlari** (alohida
  `/student/grading` endpoint) umuman yo'q edi — faqat Profil menyusidagi alohida ekranda. Yechim: `Grading.tsx`
  tanasi umumiy **`GradingPanel`** komponentiga ajratildi (`pages/student/GradingPanel.tsx`: oy nav + guruh tab +
  oylik mezon xulosasi done/total + har darslik mezon ✓/✗ grid; `hideWhenEmpty`+`title` proplari). Grading ekrani endi
  ingichka wrapper (shu panelni ishlatadi — dublikat yo'q). `Statistics.tsx`: oxiriga `<GradingPanel hideWhenEmpty
  title="Baholash mezonlari"/>` (baholash bo'lmasa umuman ko'rinmaydi) + `marksTrend`dan "Uy vazifa trendi" (oylik
  bajarish %, ma'lumot bo'lsa). Frontend-only, migratsiya yo'q. tsc+vite yashil, deploy ✅. Jonli: ev2 → /student/grading
  1 guruh (6 mezon × 13 dars) → statistikada oylik+har darslik chiqadi; marksTrend bo'sh → trend yashirin. ESLATMA:
  per-item detallar (har topshiriq/intizom hodisalari) o'z ekranlarida qoladi; statistika = agregat + baholash.
- 2026-06-15: **Telegram bot — ro'yxatdan o'tgan o'quvchi/o'qituvchiga ILOVA (APK) yuborish + MAJBURIY kanal obunasi.**
  Mavjud bot (`TelegramBotService`, long polling: /start→kontakt→ParentPhone/Teacher.Phone moslik→`TelegramRegistration`)
  kengaytirildi. Yangi oqim: kontakt → moslik (topilmasa "ro'yxatda yo'q") → **MAJBURIY kanal obunasi** (sozlangan
  ommaviy @kanal bo'lsa `getChatMember`; left/kicked→"obuna bo'ling" + inline [Kanalga obuna]+[✅ Tekshirish], status
  null=tekshirib bo'lmadi→fail-open+log) → register → **mos APK yuboriladi**. `TelegramService`ga: `SendDocumentReturningIdAsync`
  (file_id keshli — bir marta yuklab keyin file_id bilan yuboradi), `GetChatMemberStatusAsync`, `AnswerCallbackAsync`,
  `ChannelUsername` helper; `getUpdates` `allowed_updates`ga `callback_query` qo'shildi. Bot: in-memory `_pendingPhone`
  (chatId→telefon, obunadan oldin), callback "check_sub" qayta tekshiradi; `IHostEnvironment` inject (APK faylni o'qish).
  APK rol bo'yicha (o'quvchi/o'qituvchi); biri yo'q bo'lsa ikkinchisiga qaytadi (bitta ilova bo'lsa bittasini yuklash
  yetarli). **CenterMeta**ga 6 ustun (Student/Teacher × ApkName/Path/FileId) + migratsiya `AddAppApk`. `SettingsController`:
  `IWebHostEnvironment` inject + `GET/POST{role}/DELETE{role} app-apk` (.apk only, ≤50MB Telegram chegarasi, yangi yuklasa
  FileId kesh bo'shaydi). DTO `AppApkSettingsDto`. **Frontend:** `settings.ts` getAppApkSettings/uploadAppApk/deleteAppApk;
  `TelegramSettings.tsx`ga "Ilova (APK)" karta (2 slot: o'quvchi/o'qituvchi — yuklash/almashtirish/o'chirish + nom/hajm).
  Backend 0, tsc+vite yashil, deploy ✅ (migratsiya qo'llandi). Jonli E2E: GET app-apk 200 (ustunlar bor), student .apk
  upload→nom/hajm qaytdi, non-apk→400, noto'g'ri rol→400, delete→tozalandi. ESLATMA: obuna darvozasi HAQIQATAN ishlashi
  uchun kanal OMMAVIY (@username) bo'lib, bot kanal ADMINI bo'lishi shart (getChatMember talabi); APK>50MB Telegram bot
  orqali yuborilmaydi (kelajakda public URL/file_id fallback). Bot real token+kanalsiz jonli sinab bo'lmadi (kod tekshirildi).
- 2026-06-15: **Bosh sahifaga DARS JADVALI (raspisaniye) — guruhlar haftalik jadvali, har guruh alohida rangda.**
  Yangi `components/dashboard/WeeklySchedule.tsx` (frontend-only — `getClasses`+`getTeachers`+`getSubjects`ni
  `useAsync` bilan parallel oladi; backend o'zgarmadi, migratsiya yo'q). `/admin/classes` `teacherName`/`courseName`
  QAYTARMAYDI (faqat `teacherId`/`courseId`) → komponent nom xaritalarini o'zi quradi. Arxivlanmagan + `days.length>0`
  + `startTime` bo'lgan guruhlar 7-ustunli grid (Du..Yak)ga joylashadi (kun ustunida boshlanish vaqti bo'yicha
  saralangan rangli bloklar: guruh nomi/kurs/vaqt/o'qituvchi/xona; bugun ustuni `bg-brand-600`). Har guruhga 12-rangli
  PALETTE'dan barqaror rang (indeks bo'yicha) — bir o'qituvchining har guruhi turli rangda; legenda o'qituvchi bo'yicha
  guruhlanadi (rangli chiplar). `todayIdx=(getDay()+6)%7`. AdminDashboard pastiga `<WeeklySchedule/>` qo'shildi. Inline
  hex rang (Tailwind dinamik klass purge'idan qochish). tsc+vite yashil, deploy ✅; jonli: 2 guruh (test B/matematika,
  TEST-G/Beginner) Du/Cho/Jum, har biri alohida rang.
- 2026-06-15: **Speaking AUDIT tuzatmalari (code-review topgan 4 backend bug — `SubmitSpeaking`).** (1) **Egalik:**
  ilgari faqat `Format=="speaking"` tekshirardi → har qanday o'quvchi istalgan speaking id'ga pullik Azure chaqirardi;
  endi `ClassIdOf(s)` + `a.ClassIds.Contains(classId)` (normal yo'l kabi), aks holda 404. (2) **MaxScore masshtab:**
  `Score=Round(PronScore)` (0..100) → `Math.Clamp(Round(PronScore*MaxScore/100),0,MaxScore)` — scoreboard `totalMax+=
  MaxScore` bilan mos (MaxScore≠100 da foiz buzilmaydi). (3) **Validatsiya:** `RequestSizeLimit` 25MB→8MB + `audio.Length
  >8MB` 400 + `AzureSpeechService.LooksLikeWav` (RIFF/WAVE sniff) — ixtiyoriy/buzuq bayt Azure'ga ketmaydi. (4) **Rate-
  limit:** mavjud `sub.SubmittedAt`dan 5s cooldown (ketma-ket pullik chaqiruvni cheklaydi). Sxema o'zgarmadi (migratsiya
  yo'q). Backend 0, deploy ✅. Jonli E2E: begona guruh A2→404 (egalik), o'z guruhi A1 kalitsiz→400 "sozlanmagan" (egalik
  o'tdi). QOLDI (review, past, tuzatilmagan): region URL validatsiyasi (SSRF, admin-gated), catch ex.Message oqishi,
  /uploads ovoz auth'siz, wavRecorder resume() yo'q (WebView bo'sh WAV xavfi), mic→destination echo.
- 2026-06-15: **O'quvchilar ro'yxatiga "Holat" (Aktiv / Aktiv emas) ustuni.** Kursda aktivlik = kamida bitta a'zoligi
  `Status=="active"` (sinov/muzlatilgan/guruhsiz EMAS). `Student`ga `[NotMapped] bool Active` (DB'ga yozilmaydi —
  migratsiya yo'q); `StudentsController.GetAll` mavjud a'zolik so'roviga `sg.Status` qo'shib hisoblaydi (active
  a'zolik bo'lganlar HashSet). TS `Student.active?`; `StudentsPage` "Guruh"dan keyin "Holat" ustuni (yashil "● Aktiv" /
  kulrang "● Aktiv emas" badge) + CSV eksportga "Holat" + colSpan 10→11 / 12→13. Backend 0, tsc+vite yashil, deploy ✅;
  jonli: 13 o'quvchidan 10 aktiv / 3 aktiv emas (E V2 guruhda bor-u sinov/muzlatilgan → aktiv emas).
- 2026-06-15: **O'quvchi profiliga BAHOLASH statistikasi (oylik + har darslik).** Backend `GET /student/grading?month=`
  (`StudentPortalController.Grading`): o'quvchining har faol guruhi bo'yicha — mezonlarda OYLIK xulosa (done/total =
  shu oyda nechta darsda bajardi / jami dars) + HAR DARSLIK (har sana → bajarilgan mezon id'lari). DTO `StudentGradingGroupDto`/
  `StudentGradingCriterionDto`/`StudentGradingDateDto`. Frontend `studentPortal.ts` `getStudentGrading`+tiplar; yangi
  `pages/student/Grading.tsx` (`StudentGradingScreen`, route `/student/grading`, Profil menyusiga "Baholash") — guruh
  tanlash + oy nav + Oylik xulosa (mezon: done/total + progress bar + %) + Har darslik (sana[hafta kuni+kun] → mezon
  chiplari ✓/✗). Backend 0, tsc+vite yashil, deploy ✅ (migratsiya yo'q). Jonli E2E: E V2 → 1 guruh, oylik "Uy vazifa
  2/13", har darslik 2026-06-01 1 mezon bajarilgan.
- 2026-06-15: **O'qituvchi portali RESPONSIV (web+ilova ajralgan) + baholash chiroyli sanalar + ommaviy belgilash.**
  (1) **Responsiv:** `TeacherMobileLayout` — telefon/WebView yo'li AYNAN o'zgarmadi (mobil-first, default stillar);
  desktop (`lg:`) qatlam QO'SHILDI: chap yon-menyu (avatar+ism+vertikal nav, `hidden lg:flex`), kontent kengroq
  (`max-w-md lg:max-w-4xl`), bottom-nav `lg:hidden`. Tailwind mobile-first → WebView (telefon kengligi) `lg:` ni
  KO'RMAYDI → ilova bayt-ma-bayt bir xil; web va ilova aralashmaydi. (2) **Chiroyli sanalar:** GradingSection dars
  sanalari endi jurnaldagidek — hafta kuni (Du/Se/Ch..) + sana, bugun teal, tanlangani to'q. (3) **Ommaviy belgilash:**
  mezon sarlavhasiga bosilsa popover — "Hammaga belgilash" / "Belgilamaslik" (shu sanada, frozen emas barchaga).
  Backend `BulkCriterionGradeRequest` + `BulkGradeAsync` + `POST grade/bulk` (admin) + `POST teacher/grading/grade/bulk`
  (o'z guruhi). Frontend `bulkGrade`/`bulkTeacherGrade` + GradingSection prop. tsc+vite+backend 0, deploy ✅ (migratsiya
  yo'q). Jonli E2E: bulk 8/8 belgilandi → 0 ga olindi. QOLDI: o'quvchi profiliga baholash statistikasi (oylik+har darslik).
- 2026-06-15: **Baholash → HAR DARSGA CHECK (bajardi/bajarmadi) + Jurnal/Baholash toggle + frozen chiqarildi.**
  Foydalanuvchi: baho 1-5 emas, har mezon CHECK (bajardi/bajarmadi); BIR MARTA emas HAR DARSGA; guruh detalida
  "Jurnal | Baholash" toggle. **Backend:** `CriterionGrade` `Score(double)` → `Date(string)`+`Done(bool)` (unique
  Group+Student+Criterion+Date); migratsiya `GradingPerLessonCheck` (Score drop, Date/Done add, indeks). `BuildBoardAsync`
  endi oy param oladi → months/month/dates(JournalService.LessonDatesInMonth public qilindi)/criteria/students(doneKeys);
  `UpsertGradeAsync` Done=true→yozadi, false→o'chiradi (sparse). **Frozen baholanmaydi:** memberlar `IsActive && Status!=
  "frozen"` (jurnal gridi kabi). MaxScore vestigial (mezonlar endi check). **Frontend:** `grading.ts`/`teacher.ts`
  tiplar+month param; `GradingSection` qayta yozildi — oy nav + dars-sana chiplari + o'quvchilar×mezonlar CHECK grid
  (katak ✓ toggle, sparse upsert); admin `GradingCriteriaPage` maxScore olib tashlandi; admin `ClassDetailPage` +
  teacher `TeacherGroupDetailPage`ga "Jurnal | Baholash" segmented toggle (tanlangani ko'rinadi). Backend 0, tsc+vite
  yashil, deploy ✅ (migratsiya). Jonli E2E: board 13 sana/8 o'quvchi (12→8: 4 frozen chiqdi)/1 mezon → 2026-06-01 ✓
  belgilandi (doneKeys) → olib tashlandi (sparse).
- 2026-06-15: **YANGI — BAHOLASH MEZONLARI (per-guruh kriteriya + guruh detalida baholash, teacher-scoped).**
  Mavjud `EvaluationType` (global feedback board)dan ALOHIDA. **Backend:** 3 entity — `GradingCriterion`(mezon pul:
  Name/Description/MaxScore/Order), `GroupGradingCriterion`(M2M: guruhga biriktirish), `CriterionGrade`(o'quvchi×guruh×
  mezon bahosi, unique). Migratsiya `AddGradingCriteria` (3 jadval). `GradingController` (admin, perm schedule): mezon
  CRUD, `GET/PUT group/{id}/criteria` (biriktirish), `GET group/{id}/board` (grid: faol o'quvchilar × mezonlar + bahalar),
  `POST grade` (upsert, 0..MaxScore clamp). Umumiy statik helperlar `BuildBoardAsync`/`UpsertGradeAsync`. **Teacher
  (o'z guruhi):** `TeacherPortalController` `GET teacher/grading/group/{id}/board` + `POST teacher/grading/grade` —
  `ResolveOwnedGroup` (Group.TeacherId==me) bilan, begona guruhga 403. **Frontend:** `grading.ts` servis+tiplar; admin
  "Baholash mezonlari" sahifa (`/admin/grading`, O'quv bo'limi nav) — mezon CRUD + guruhga biriktirish (checklist,
  darhol saqlanadi); umumiy `GradingSection` komponenti (o'quvchilar × mezonlar grid, katakka baho, onBlur upsert) —
  admin `ClassDetailPage` + teacher `TeacherGroupDetailPage`ga "Baholash" karta sifatida (jurnaldan keyin). teacher.ts
  `getTeacherGradingBoard`/`setTeacherGrade`. Backend 0, tsc+vite yashil, deploy ✅ (migratsiya qo'llandi). Jonli E2E:
  admin mezon→guruhga biriktir→board(12 o'quvchi)→baho 8.5 + clamp 999→10; teacher o'z guruhi board(students=3)+baho 4
  saqlandi. ESLATMA: baholash o'qituvchining O'Z guruhiga tegishli (teacher-scoped, foydalanuvchi talabi).
- 2026-06-15: **Daraja testi — STATISTIKA (voronka) tabi.** Test topshirganlar (har biri lid) qaysi bosqichda:
  lid → o'quvchiga aylandi → guruhga qo'shildi → to'lov qildi → aktiv. Backend `GET /admin/level-tests/{id}/stats`
  (`LevelTestsController.Stats`): submission `LeadId` → `Lead.ConvertedStudentId` → Student → StudentGroups(IsActive=
  qo'shildi, Status=="active"=aktiv) + FinanceTransactions(tuition kirimi=to'lov). DTO: `LevelTestStatsDto`(Total/
  Converted/JoinedGroup/Paid/Active+Rows), `LevelTestStatRowDto`. Frontend: `levelTests.ts` `getLevelTestStats`+tiplar;
  `LevelTestEditorPage`ga 3-tab "Statistika" — 5 KPI plitka (Topshirgan/O'quvchi bo'ldi/Guruhga qo'shildi/To'lov qildi/
  Aktiv + foiz) + topshiruvchilar jadvali (har qatorda ✓/— ustunlar). Backend 0, tsc+vite yashil, deploy ✅. Jonli E2E:
  public submit→total=1/converted=0→lid convert→converted=1/joined=0/paid=0/active=0 (voronka to'g'ri); sinov ma'lumoti
  tozalandi.
- 2026-06-15: **Dars QULFI (o'qituvchi o'tgach ochiladi) + video mobil + joylashuv ko'prigi + lug'at MOSLASH o'yini.**
  (1) **Qulf:** o'quvchi darsni FAQAT o'qituvchi shu guruhda "o'tildi" qilgach (GroupCurriculumLog) ocha oladi.
  Frontend (`Progress.tsx`): roadmap node FAQAT `it.covered` bo'lsa `/student/lesson/:id`ga o'tadi, aks holda toast
  ("Bu dars hali yopiq..."). Backend NAZORAT: `GET /student/curriculum/item/{id}` covered bo'lmasa **403** (locked)
  qaytaradi (myGroups GroupCurriculumLog tekshiruvi). Jonli E2E: uncovered→403, o'qituvchi cover→200 (video=True).
  DIQQAT: `StudentGroupDto.Id`=a'zolik id, `.GroupId`=guruh(Class) id — cover GROUP id bilan. (2) **Video mobil:**
  `youtube-nocookie/embed?playsinline=1&rel=0`, `<video playsInline>`, + "tashqi ilovada ochish" fallback havola
  (WebView ichida ochilmasa). (3) **Joylashuv:** native ko'prik — `window.__setLocation(lat,lng)` / postMessage
  `{type:'location'}` (Flutter beradi) + `window.requestNativeLocation()` hook + navigator.geolocation; aniqroq xato
  matni. (4) **Lug'at MOSLASH o'yini:** `Lesson.tsx` VocabBlock — so'zlar tartibda, tarjimalar CHALKASH; so'zni tanlab
  to'g'ri tarjimani bossa yashil/qulflanadi, xato bo'lsa qizil chaqnaydi; "Moslandi X/N" + "Barakalla". tsc+vite yashil,
  deploy ✅. ESLATMA (Flutter): video ichki o'ynashi uchun WebView `allowsInlineMediaPlayback`/`mediaPlaybackRequiresUserGesture:false`;
  GPS uchun geolocation ruxsati (onGeolocationPermissionsShowPrompt→grant) yoki `requestNativeLocation` ni implement qilsin.
- 2026-06-15: **Dars KO'P BO'LIMLI bo'ldi (video+matn+audio+lug'at+test) — o'quvchi ketma-ket ko'radi (oldin faqat
  `type` chiqardi).** Muammo: har dars BITTA `type`ga ega edi, o'quvchi ko'rinishi faqat shu turni ko'rsatardi (admin
  bir nechta bo'lim to'ldirsa ham faqat test chiqardi). Aslida `CourseItem` barcha maydonlarni (videoUrl/textContent/
  audioUrl/vocab/questions) birga saqlaydi — editor allaqachon hammasini saqlardi. Yechim: **(1) O'quvchi viewer**
  (`Lesson.tsx`) qayta yozildi — STEPPER: mavjud bo'limlar (qat'iy tartib: Video→Matn→Audio→Lug'at→Test) tepada segment
  progress + "Tugatdim · Keyingi"/"Oldingi"/"Yakunlash" bilan ketma-ket. (2) **Backend** `ToItemDto`: `ready`=kamida
  bitta bo'lim to'ldirilgan, `meta`=bo'limlar ro'yxati ("Video · Matn · Lug'at · Test"); `SaveItemContent` meta avto-
  hisoblashni olib tashladi (erkin yorliq, bo'sh bo'lsa tree bo'lim ro'yxatini ko'rsatadi). (3) **Editor** decoupling:
  video/audio "Tavsif" (textContent) olib tashlandi — Matn endi ALOHIDA bo'lim (to'qnashuv yo'q); tur tugmalariga
  "to'ldirilgan" yashil nuqta + "bir nechtasini to'ldiring" izohi. Backend 0, tsc+vite yashil, deploy ✅. Jonli E2E:
  video+matn+lug'at(2)+test(2) saqlandi → tree meta='Video · Matn · Lug'at · Test' ready=True → o'quvchi hammasini oldi
  (video=T text=T vocab=2 test=2). DIQQAT: PowerShell `Invoke-WebRequest|ConvertFrom-Json` ham massiv javoblarni ba'zan
  ustun-massivga aylantiradi — subject id'lar qo'shilib ketadi; test uchun ID'ni hardcode qilish ishonchli.
- 2026-06-15: **YANGI EPIK — O'quv dasturi KONTENTLI (Modul→Mavzu→Dars, dars ichida video/matn/audio/lug'at/test).**
  Foydalanuvchi `modul.png` (Kurs tahrirlovchi: chap modul-daraxt + o'ng dars tahrir/test tuzuvchi) namunasini berdi.
  Qaror: mavjud `CourseLevel→CourseTopic→CourseItem` (3 daraja, Modul→Mavzu→Dars ga mos) KENGAYTIRILADI — eski
  Duolingo yo'l-xaritasi + o'qituvchi "dars o'tilishi" SAQLANADI (additive). **P1 (backend, BAJARILDI):** `CourseItem`ga
  `Type`(text/video/audio/vocab/test)/`VideoUrl`/`AudioUrl`/`TextContent`/`VocabJson`/`Meta`; yangi `CourseQuestion`
  entity (test savoli: Text/Options/CorrectIndex/Order) + DbSet + indeks; inkremental migratsiya `AddCourseLessonContent`
  (6 ustun + CourseQuestions jadval, baza saqlandi). `CurriculumController`: tree endi item'ga Type/Meta/Ready qaytaradi
  (`ToItemDto` — test savol soni/lug'at so'z soni meta, tayyorlik), yangi `GET item/{id}` (to'liq kontent+savollar),
  `PUT items/{id}/content` (nom+tur+kontent+lug'at+savollar — savollar to'liq almashtiriladi), topic/level delete
  CourseQuestions ham tozalaydi. DTO: `CurriculumItemDto`+Type/Meta/Ready, `CourseItemDetailDto`, `CourseQuestionDto`,
  `VocabEntryDto`, `SaveItemContentRequest`. Backend 0, deploy ✅ (migratsiya qo'llandi); jonli E2E: level→topic→item
  yaratish → video kontent saqlandi → test (2 savol) PUT OK → readback type/savollar/meta/ready to'g'ri → cascade delete.
  **P2 (admin editor, BAJARILDI):** `CurriculumEditorPage` 2-panel qayta dizayn (admin binafsha tema, modul.png joylashuvi) —
  chap: O'quv dasturi daraxti (X/Y dars tayyor + progress, +Modul; modul→mavzu→dars, tur ikonkasi+meta+tayyor nuqtasi,
  +Mavzu/+Dars; dars bosilsa tanlanadi); o'ng: Dars tafsilotlari (nom, tur tanlash, video URL+yuklash+tavsif / matn /
  audio / lug'at qatorlari / Test tuzuvchi savol+variant+to'g'ri) → Saqlash `saveItemContent` → tree refresh. Frontend
  `curriculum.ts`ga `getCourseItem`/`saveItemContent`+tiplar; `CurriculumItem`ga type/meta/ready. (subagent qurdi.)
  **P3 (o'quvchi ko'rish, BAJARILDI — FAQAT o'quvchi, foydalanuvchi: o'qituvchiga shart emas, u faqat "o'tildi" qiladi):**
  backend `GET /student/curriculum/item/{id}` (o'quvchi faqat o'z FAOL guruh kursidagi darsni ko'radi — ownership join);
  yangi `pages/student/Lesson.tsx` (`StudentLessonScreen`, route `/student/lesson/:id`) — tur bo'yicha: YouTube/mp4
  video player + tavsif, matn, audio player, lug'at jadvali, INTERAKTIV test runner (variant tanlanadi→darhol yashil/qizil
  feedback + ball). `Progress.tsx` Duolingo roadmap node endi BOSILADI (button) → `/student/lesson/:id` (roadmap o'zi
  o'zgarmadi). `studentPortal.ts` `getStudentLesson`+tiplar. Backend 0, tsc+vite yashil, deploy ✅; jonli E2E (curl+
  ConvertFrom-Json): E V2 (Beginner frozen a'zo) darsni ochdi → type=video/videoUrl/meta/desc qaytdi; ownership guard
  ishlaydi. ESLATMA: PowerShell IRM massiv javoblarni ustun-massivga aylantiradi (test buzilardi) → `(IWR).Content|
  ConvertFrom-Json` ishlat.
- 2026-06-14: **O'qituvchi profil TO'LIQ kengaytirildi — tungi rejim + barcha bo'limlar (4 parallel subagent).**
  (1) **TUNGI REJIM:** `.teacher-app.dark` CSS bloki (index.css) — semantik tokenlar (ink/mute/faint/line/paper/
  panel/tealsoft/chip) dark qiymatga + hardcoded neutral utility'lar (`bg-white`→panel, `bg/text/border-slate-*`,
  `text-teal-*` yorqinlash) `!important` bilan remap → har bir o'qituvchi ekrani faylga tegmasdan dark-aware. Toggle:
  `TeacherMobileLayout`ga `getTeacherTheme/setTeacherTheme` (localStorage `teacher_theme` + `teacher-theme` event) +
  Shell `dark` klassini qo'llaydi. (2) **PROFIL HUB:** `TeacherProfilePage` qayta tashkil — menyu (Dars o'tilishi,
  Ta'lim progresi, Maosh, Taklif va shikoyat, Parolni almashtirish) + "Sozlamalar" karta (Tungi rejim + Bildirishnoma
  toggle'lari). (3) **4 yangi ekran (subagentlar, teal):** `salary/SalaryPage`(getTeacherSalary — hisoblandi/berildi/
  qoldi + oylar), `coverage/CoveragePage`(Dars o'tilishi — har guruh getTeacherGroupCurriculum coverage%+prognoz),
  `learning/LearningPage`(Ta'lim progresi — har guruh getTeacherGroupJournal o'rtacha baho+baholar soni), `account/
  AccountPage`(parol — updateAccount /auth/account). Har guruh fetch try/catch bilan (404 guruh o'tkazib yuboriladi).
  App.tsx 4 route (`TeacherSalaryPage`→`TeacherOwnSalaryPage` alias, admin bilan to'qnashmaslik uchun). Parol almashtirish
  shared `auth.updateAccount` (PUT /auth/account, role-agnostik). tsc+vite yashil, deploy ✅; jonli: salary OK,
  SPA routes 200, dark CSS bundle'da (21 qoida). Test teacher: abduxalilvoxidjonov/5fgvph3z.
- 2026-06-14: **Audit tuzatishlari (H1/H2/H3/H4) + o'lik fayl o'chirildi.** To'liq tizim auditi (3 parallel agent).
  **H1/H2 (HAQIQIY BUG, tuzatildi):** moliyada tuition to'lovni TAHRIRLAGANDA `Month`/`GroupId`/`Comment` yo'qolardi
  (`FinanceTransactionPayload` DTO'da bu maydonlar yo'q edi) → per-guruh hisobot + foizli o'qituvchi maoshi buzilardi.
  Yechim: DTO'ga Month/GroupId/Comment (ixtiyoriy) qo'shildi; `FinanceController.Create` ularni yozadi; **`Update`
  bo'sh kelsa ESKI qiymatni saqlaydi** (preserve-if-empty — tahrir formasi yubormasa ham yo'qolmaydi); `FinanceTransactionDto`
  GroupId/Comment qaytaradi. Jonli E2E: create(month+group)→edit(yubormay)→teglar SAQLANDI ✓. **H3/H4 (allaqachon
  himoyalangan):** `MonthlyCharge(StudentId,GroupId,Month)` UNIQUE indeks PROD'DA ALLAQACHON BOR (model+DB tasdiqlandi;
  CLAUDE.md TODO eskirган) + `ChargeActivationProrateAsync` idempotent upsert → bir (o'quvchi,guruh,oy) uchun dublikat
  hisob STRUKTURAVIY imkonsiz (qayta qo'shishda ham). To'lov double-click himoyasi qo'shildi: `PaymentModal` `submitting`
  state (tugma bloklanadi). **O'lik kod:** `components/TeacherAppRedirect.tsx` (0 import) o'chirildi. Audit xulosasi:
  loyiha toza (boshqa o'lik kod yo'q; vestigial maydonlar ataylab). Backend 0, tsc+vite yashil, deploy ✅ (migratsiya yo'q).
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
- 2026-06-17: **MEGA-UPDATE — 8 ta parallel bug fix + feature (workflow):** 
  **(1) Jurnal baholash mezonlari:** ClassDetailPage'da grading criteria columns + total sum (har o'quvchi uchun barcha mezon ball yig'indisi).
  `getGradingBoard` parallel load + grid ustunlar.
  **(2) Leads attendance:** Lead'ni birinchi darsga kelishi/kelmasi rangga (yashil/qizil badge). LeadCard+LeadDetailModal.
  **(3) Groups count:** ClassesPage'da o'quvchi soni disappear bug'i — card/jadval ko'rinishida doim ko'rinadi.
  **(4) Import template:** StudentsPage Excel shablon — F.I.SH/Tel/Ota/Ona/Guruh/Holat ustunlari.
  **(5) Curriculum copy:** CurriculumEditorPage — daraja "Copy to..." (boshqa kursga deep copy, M2M).
  **(6) Schedule coloring:** WeeklySchedule o'qituvchi bo'yicha rang (12-palette) + ClassesPage/StudentsPage teacher filter.
  **(7) Bulk grading fix:** GradingSection "Hammaga" modal'da selection clear — nav change'da reset.
  **(8) Teacher journal totals:** TeacherGroupDetailPage grading tab + Ratings tab (o'quvchi baholar summary).
  8 parallel agent, 15 fayl, backend 0 xato, tsc+vite ✅, deploy ✅.
- 2026-06-17: **Jurnal StartDate validation:** Guruh StartDate'dan OLDIN bo'lgan kunlarga baho/davomat qo'yishni blok.
  Backend: `JournalService.SetEntryAsync` date validation (400). Frontend: date < StartDate → sarrang disabled + warning.
  `JournalCellModal` red alert + disabled Save. ClassDetailPage grid ustunlari disabled/grayed. Backend 0, deploy ✅.
- 2026-06-17: **GIT:** Barcha o'zgarishlar main branch'ga merge qilindi (crm → main). origin/main up-to-date. ✅
- 2026-06-17: **MEGA-UPDATE 2 — Jami ba'holar xulosa + o'qituvchi portali responsiveness (4 agent + 3 subagent):**
  **(1) Journal TOTAL columns:** ClassDetailPage + TeacherGroupDetailPage + GradingSection — har o'quvchining barcha baholari yig'indisi (TOTAL ustun sticky right).
  **(2) Student profile grading:** "Baholash xulosa" karta — oylik o'rtachasi + jami yig'indi. `GET /student/grading/summary` endpoint.
  **(3) Admin dashboard stats:** "Baholash faollik" KPI + "Baholash" ustuni ClassesPage'da grading count. `getAllGroupsGradingStats` batch.
  **(4) TypeScript fixes:** CurriculumEditorPage import, classPerformance.ts getClasses, AdminDashboard unused import.
  **(5) Teacher journal TOTAL:** TeacherGroupDetailPage jurnalda TOTAL column qo'shildi (sticky, tealsoft).
  **(6) Fonts global:** index.css Times New Roman barcha portal'da (admin + teacher + student = bir xil).
  **(7) Teacher portal responsive:** TeacherMobileLayout lg breakpoint — mobile (bottom nav) → lg (left sidebar 208px + full-width content). StudentMobileLayout moslandi.
  **(8) Layout constraints:** max-w-md/lg olib tashlandi, content full-width (web'da 1920px sarflash, bo'sh 2 checkmark GONE). Desktop beautiful, mobile app-like.
  Build: tsc+vite ✅, backend 0, deploy ✅ (commit 00d1c04 + fixes).
- 2026-06-17: **CRITICAL DATA INTEGRITY FIX — MonthlyCharge ORPHANS on Group delete (commit b2efa5e).** 
  Muammo: `ClassesController.Delete()` `RemoveRange()`+`ForEachAsync()` ishlatardi — app-level delete, memory load, 
  SaveChanges() crash window. Agar delete crash bo'lsa → `MonthlyCharges(GroupId=id)` orphan qolirdi (DB broken).
  TUZATISH: **atomic bulk operations** — EF Core 8 `ExecuteDeleteAsync()` + `ExecuteUpdateAsync()` (single SQL command):
  ```
  // OLD: RemoveRange → load memory, delete row-by-row → race condition window
  db.MonthlyCharges.RemoveRange(db.MonthlyCharges.Where(c => c.GroupId == id));
  
  // NEW: atomic SQL DELETE (transaction-safe, crash-safe)
  await db.MonthlyCharges.Where(c => c.GroupId == id).ExecuteDeleteAsync();
  await db.StudentGroups.Where(sg => sg.GroupId == id).ExecuteDeleteAsync();
  await db.JournalEntries.Where(e => e.ClassId == id).ExecuteDeleteAsync();
  await db.LessonNotes.Where(n => n.ClassId == id).ExecuteDeleteAsync();
  await db.FinanceTransactions.Where(t => t.GroupId == id)
      .ExecuteUpdateAsync(s => s.SetProperty(t => t.GroupId, (string?)null));
  ```
  Faydalar: ✓ Atomic (no crash window), ✓ Orphans impossible, ✓ Fast (no memory overhead), ✓ Race-safe.
  INTEGRITY_AUDIT.md updated (verdict: ✅ FIXED). Backend 0, tsc+vite ✅. Deploy ready — code solid.
- 2026-06-18: **YANGI — SERTIFIKAT TIZIMI (3 jadval, 6 endpoint, CompleteAndTransfer).** Kurs tugaganda o'quvchiga sertifikat berish. **Entitiylar (Domain):** `CertificateTemplate` (kurs andozasi: Name/CourseId/HtmlTemplate/ValidityDays), `StudentCertificate` (berilgan sertifikat: StudentId/CourseId/FileName/FilePath/FileHash/IssuedAt/ExpiresAt/Status/Metadata), `CertificateVerification` (tekshiruv yozuvi: StudentCertificateId/VerifiedAt/IP/IsValid/HashMatched). **Migratsiya:** `AddCertificates` (3 jadval inkremental). **CertificateService:** `GenerateCertificateAsync` (idempotent, HTML fayl yaratadi yoki fallback, SHA-256 hash), `DownloadCertificateAsync`, `VerifyCertificateAsync` (hash tekshirish + CertificateVerification yozuvi). **Endpointlar:** (1) `GET api/student/certificates` (student), (2) `GET api/student/certificates/{id}/download` (student), (3) `GET/POST/DELETE api/admin/certificate-templates` (admin), (4) `GET api/admin/certificate-templates/{id}` (admin), (5) `GET api/public/certificates/{id}/verify` (anon). **ClassesController:** `POST api/admin/classes/{id}/complete-and-transfer` — barcha faol a'zolar "completed"/IsActive=false, guruh kursi maqsad kursga, GroupCurriculumLog tozalanadi, yangi "trial" a'zoliklar, fire-and-forget sertifikat yaratish. DI: `CertificateService` Program.cs'da registered. Build: 0 xato, migratsiya yaratildi.
- 2026-06-19: **PDF SERTIFIKAT — iText7 native canvas, Uzbek dizayn (commit 34aad08).** HTML→PDF (HtmlConverter) o'rniga iText7 `PdfCanvas` bilan to'g'ridan-to'g'ri vektor chizish. Dizayn: navy (#1a3a5e) fon + oltin (#FDB913) trapetsiya banner + burchak uchburchak bezaklar + medal icon (ribbon + doira + yulduz nurlari) + oltin "SERTIFIKAT" sarlavha + o'quvchi ismi oltin kursivda (yon chiziqlar bilan) + kurs tavsifi + 3 imzo blok (Manager / O'qituvchi / Tugatilgan sana) + QR kod (pastki o'ngda) + sertifikat raqami. Shriftlar: Times-Bold/Italic/BoldItalic/Roman (iText standart serif). Tekshirish URL: `crm.intellectschool.uz/verify-certificate/{certId}`. `GenerateCertificateAsync` yangi optional param `teacherName` qabul qiladi (DB dan avtomatik oladi agar berilmasa); `ClassesController.CompleteAndTransfer` o'qituvchi ismini query'dan olib uzatadi; `DownloadCertificateAsync` `.pdf` fayllar uchun `application/pdf` qaytaradi. HTML fallback template ham o'zbek matni va {{teacher_name}} token bilan yangilandi. Backend 0 xato, deploy ✅. Qanday test qilish: `POST /api/admin/classes/{id}/complete-and-transfer` → sertifikat `.pdf` yaratiladi; `GET /api/admin/students/{id}/certificates/{certId}/download` → PDF yuklanadi.
- 2026-06-18: **TELEFON NORMALIZATSIYA — barcha kontrollerlarda `PhoneUtil.Normalize()` qo'shildi (commit d74deb3).**
  Variantlar: (A) Kiritish-vaqtida normalize (database), (B) Display-vaqtida format (UI), (C) Tanlama. **Tanlov: Variant A**.
  Taqdim qilingan `PhoneUtil.Normalize()` metodini tg'ri joylarida qo'llandi. **Kontollerlar (5):**
  1. **StudentsController** — Create/Update: `Student.Phone`, `Student.FatherPhone`, `Student.MotherPhone`, `Student.ParentPhone` + Excel import.
  2. **TeachersController** — Create/Update: `Teacher.Phone`.
  3. **StaffController** — Create/Update: `AppUser.Phone`.
  4. **LeadsController** — Create/Update: `Lead.Phone`, `Lead.FatherPhone`, `Lead.MotherPhone`.
  5. **AuthController** — UpdateAccount: `AppUser.Phone`.
  **Jami:** 22 telefon normalizatsiya chaqiruvi (taplangan).
  **Formatla:** `PhoneUtil.Normalize()` — faqat raqamlarni saqlaydi, "998" prefiksi qo'shadi, `+998-XX-XXX-XX-XX` formatiga keltiriladi.
  Noto'g'ri format bo'lsa asl kiritilgan qiymat qaytaradi (backward compatible). Build: 0 xato, deploy ✅.
- 2026-06-19: **BUG FIX — "Guruhga biriktirish" dropdown'i trial o'quvchiga qarz yozardi (commit fc585b8).**
  Muammo: `StudentFormModal`da "Guruhga biriktirish" dropdown'i orqali o'quvchiga sinf tanlanganda va
  `PUT /admin/students/{id}` chaqirilganda — `StudentsController.Update()` ichida `hasMembership=false` bo'lsa
  ClassName-asosli `MonthlyCharge(GroupId=null)` yozib balansni darhol kamaytirardi. O'quvchi sinov
  (trial) holatida bo'lsa ham, "Guruhga biriktirish" dropdowni aktivlashtirish vazifasini bajarmasdi —
  lekin xuddi aktivlashtirgandek qarz yozilardi. **Asosiy sabab:** `Update()` `classChanged=true` va
  `!hasMembership` bo'lsa ClassName billing loopini ishga tushirardi, M2M a'zolik yaratmasdi. 
  **Tuzatish:** `Update()` ichida `classChanged && !hasMembership && cls != null` holatida
  ClassName billing o'rniga `StudentGroup(Status="trial", IsActive=true)` M2M yozuvi yaratiladi →
  `hasMembership=true` qilinadi → billing loop o'tkazib yuboriladi. To'lov faqat `ActivateMember`
  chaqirilganda boshlanadi (oldingi xulq saqlanadi). Legacy o'quvchilar (`classChanged=false`) ta'sir
  ko'rmaydi. Backend 0 xato, push ✅ (commit fc585b8).
- 2026-06-22: **BUG FIX — Xona boshqaruvi (Room management) audit va utilization tuzatildi (commit 0beee72).**
  Muammo: `RoomUtilizationService` guruhlarni `g.RoomId != null` bilan filterlab, xona bog'lanishini FK orqali izlardi.
  Lekin guruh formasi xonani `Group.Room` (matnli string) sifatida saqlaydi, `Group.RoomId` (FK) ni emas.
  Natija: utilization dashboard barcha xonalar uchun "Empty" (0 guruh, 0 o'quvchi) ko'rsatardi.
  Tuzatish: `RoomUtilizationService` endi `RoomId` (ustuvor) va `Room` (xona nomi bo'yicha text match) ikkalasini
  qo'llab-quvvatlaydi (backward-compatible). Frontend `RoomUtilization` tipiga `weeklyActiveHours` va `groupNames`
  qo'shildi (backend qaytaradi, lekin tip to'liq emas edi); `RoomUtilizationPage` da guruh nomlari chiplari ko'rinadi.
  Rooms jadvali hozir bo'sh (0 xona) — tizim to'g'ri, ma'lumot hali kiritilmagan. Backend 0, tsc yashil, deploy ✅.
