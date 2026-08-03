---
description: Moliya — a'zolik holati (trial/active/frozen), per-guruh hisob va balans, o'qituvchi maoshi va maoshning jurnalga bog'lanishi.
paths:
  - "IntellectCRM.Application/Services/Tuition*.cs"
  - "IntellectCRM.Application/Services/Salary*.cs"
  - "IntellectCRM.Application/Services/TeacherSalaryCalc.cs"
  - "IntellectCRM.Application/Services/GroupBalanceService.cs"
  - "IntellectCRM.Application/Services/StudentGroupLedger.cs"
  - "IntellectCRM.Application/Services/StudentLedger.cs"
  - "IntellectCRM.Application/Services/CourseFinanceReport.cs"
  - "IntellectCRM.Application/Services/MembershipLifecycle.cs"
  - "IntellectCRM.Server/Controllers/FinanceController.cs"
  - "IntellectCRM.Server/Controllers/TeachersController.cs"
  - "IntellectCRM.Client/src/pages/admin/finance/**"
---

# Moliya / billing qoidalari

- **MAOSH QAYSI OYGA TEGISHLI — `FinanceTransaction.Month`, to'lov SANASI EMAS.** Iyul maoshi
  5-avgustda berilishi mumkin: `Date` = pul berilgan kun, `Month` ("yyyy-MM") = qaysi oy uchun.
  `SalaryLedger.BuildAsync` to'lovlarni `Month` bo'yicha guruhlaydi; `Month` bo'sh/buzuq bo'lsa
  (eski yozuvlar) — orqaga moslik uchun `Date`dan olinadi (`PayMonth` yordamchisi). **So'rov
  sana oralig'i bilan filtrlanMAYDI** — aks holda kech berilgan to'lov (masalan iyul maoshi
  sentyabrda) oraliqdan tushib qolib, umuman ko'rinmasdi; filtr oy bo'yicha keyin qo'llanadi.
  UI: Moliya → "Yangi amal" (maosh chiqimi) va o'qituvchi profili → Maosh → "To'lov qilish" —
  ikkalasida ham **"Qaysi oy uchun"** va **"Sana (berilgan kun)"** ALOHIDA maydonlar.
  ⚠️ Ilgari Moliya formasi maoshda `Month`ni umuman saqlamasdi (`month: isTuitionIncome ? ... : undefined`)
  va backend sanadan olardi — oylar aralashib ketardi. Eski (Month'siz) yozuvlar avvalgidek
  sana bo'yicha hisoblanaveradi, o'z-o'zidan tuzalmaydi — kerak bo'lsa qo'lda tahrirlanadi.

- **Maosh QO'LDA, 2 rejim** (`Teacher.SalaryMode`): **"fixed"** — admin `Teacher.Salary` qat'iy summasini
  kiritadi; **"percent"** — o'qituvchi guruh(lar)idan **SHU OY UCHUN** yig'ilgan tuition to'lovining
  `Teacher.SalaryPercent` foizi. Hisob: `SalaryLedger.CollectedPerGroupAsync` — guruh =
  `Group.TeacherId`; to'lov `FinanceTransaction.GroupId` tegiga ega bo'lsa 100% o'sha guruhga,
  **teglanmagan** to'lov esa o'quvchining shu oydagi billable guruhlari `MonthlyFee` nisbatida
  taqsimlanadi. Frontend `TeacherSalaryPage` (rejim toggle + foiz).
  **TO'LOV QAYSI OYGA — `FinanceTransaction.Month`, to'lov SANASI EMAS** (yuqoridagi maosh to'lovlari
  bilan AYNAN bir xil qoida): o'quvchi 3-avgustda IYUL uchun to'lasa, pul o'qituvchining IYUL
  maoshiga kiradi — u iyulda dars bergan. Vozvrat ham o'z oyidan ayriladi. `Month` bo'sh bo'lgan
  ESKI yozuvlarda sana ishlatiladi; so'rov shu sabab ikki shartli (oyi mos YOKI oyi yo'q va sanasi
  oraliqda) — aks holda kech to'langan pul umuman tushib qolardi (`CourseFinanceReport
  .LoadPaymentsAsync` bilan bir xil naqsh).
  ⚠️ Ilgari FAQAT shu joyda to'lov SANASI ishlatilardi va o'qituvchi profilida bitta qatorning ikki
  yarmi turlicha hisoblanardi ("iyul uchun berilgan maosh" — `Month`, "iyulda yig'ilgan" — SANA);
  raqamlar tushunarsiz chiqardi. Endi butun tizim bitta konvensiyada.
  DIQQAT: `TeachersController.Create/Update` `Salary/SalaryMode/SalaryPercent`ni YOZADI (ilgari Salary
  umuman yozilmasdi — latent bug); `TeacherFormModal` bu maydonlarni round-trip qiladi (profil tahrirda
  reset bo'lmaydi).

- **Billing + a'zolik holati:** `StudentGroup.Status` = "trial" (sinov — to'lov YO'Q) | "active" | "frozen".
  Guruhga qo'shilganda "trial". **Aktivlashtirish** (`/members/{sid}/activate` {date}): birinchi (qisman)
  oy = (guruh `MonthlyFee` ÷ SHU OYDAGI jami dars) × shu sanadan oy oxirigacha qolgan darslar
  (`group.Days` bo'yicha) — qolgan ≤ jami bo'lgani uchun to'liqdan oshmaydi, chegirma qo'llanadi
  (`TuitionService.ChargeActivationProrateAsync`). **ORQAGA SANALGAN aktivlashtirishda** (masalan iyulda
  fevraldan) oraliq oylar — aktiv oydan KEYINGI oydan joriy oygacha — DARHOL to'liq oylik bilan yoziladi
  (`TuitionService.AccrueCatchUpAsync`, javobda `catchUpMonths`); ilgari ularni faqat fon xizmati
  (har 12 soatda) yozardi va `AccrueMonth` dagi `EnrollmentDate` filtri tufayli umuman yozilmasdi.
  **Muzlatish** (`/members/{sid}/freeze` {date}): shu
  oydan boshlab hisoblanmaydi; **muzlatish SANASINING O'ZI hisobga kiradi** (o'sha kuni dars bo'lsa
  to'lovga qo'shiladi) — `StudentGroupLedger.FreezeGross` previewi ham aynan shu konvensiyada va
  `TuitionService.ProratedLessonCharge` ni ishlatadi.
  **ORQAGA SANALGAN muzlatishda muzlatish oyidan KEYINGI hisoblar BEKOR qilinadi**
  (`TuitionService.PurgeChargesAfterMonthAsync`, javobda `restored`) — o'quvchi o'qimagan oylar uchun
  qarzdor bo'lib qolmasin; `Locked` qatorlar tegilmaydi. Bu AKTIVLASHTIRISHNING teskarisi va uchala
  yo'lda ham bir xil: **muzlatish**, **guruh almashtirish** (`transfer`) va **guruhni yopish** (`close`).
  Muzlatish sanasi AKTIVLASHTIRISH sanasidan oldin bo'lsa (umuman o'qimagan) — qisman to'lov ham
  yozilmaydi va aktivlashtirish oyi hisobi ham bekor qilinadi (`inclusive: true`).
  DIQQAT (`transfer`): bekor qilingan oylar ro'yxati `CarryGroupAdvanceAsync` ga `zeroOwedMonths`
  sifatida uzatiladi — EF hali flush qilinmagan (o'chirishga belgilangan) qatorni so'rovda baribir
  qaytargani uchun, usiz o'sha oylar "hisoblangan" bo'lib ko'rinib, ularga to'langan pul eski guruhda
  qolib ketardi. `AccrueMonth` har oy = FAOL a'zoliklarning
  `MonthlyFee` yig'indisi — faqat Status=="active", aktivlashtirilgan oydan KEYINGI oylar, muzlatish
  oyidan OLDIN (a'zoligi yo'q o'quvchi — eski ClassName narxi). **`MonthlyCharge` PER-GURUH** — unikal
  kalit (StudentId, **GroupId**, Month); guruhsiz (eski ClassName) o'quvchida GroupId=null. To'lov
  (`FinanceTransaction`) ham guruhga teglanadi (`AddPayment`: 2+ guruh bo'lsa guruh MAJBURIY, bitta
  bo'lsa avtomatik).

- **KVITANSIYA RAQAMI va TO'LOV VAQTI** (migratsiya `AddPaymentReceiptAndTime`): `FinanceTransaction`da
  `ReceiptNo` (qog'oz kvitansiya, **naqd** to'lovda kassir kiritadi — seriya "KV" + raqam) va `PaidTime`
  ("HH:mm", **karta** to'lovida pul o'tkazilgan haqiqiy vaqt). Normalizatsiya BITTA joyda —
  `PaymentFields.NormalizeReceiptNo` ("kv-123" → "KV123") / `TryNormalizeTime`; ikkala yozish yo'li
  (`StudentsController.AddPayment` va `FinanceController.Create/Update/EditPayment`) shuni ishlatadi.
  UI: `PaymentModal` usulga qarab maydon ko'rsatadi (naqd → KV prefiksli input, karta → vaqt);
  Moliya → To'lovlar jadvalida "Kvitansiya" ustuni + qidiruv ("kv123" ham, "123" ham topadi) + CSV;
  `PaymentEditModal`da tuzatish mumkin; chekda (`receipt.ts`) "Kvitansiya" qatori chiqadi.
  DIQQAT: chekdagi `ReceiptNo` (tranzaksiya Id'sidan hosil bo'ladigan ichki raqam) va qog'oz
  kvitansiya raqami (`KvNo`) — BOSHQA-BOSHQA maydonlar.

- **KARTA RAQAMINING OXIRGI 4 RAQAMI** (migratsiya `AddPaymentCardLast4`): `FinanceTransaction.CardLast4`
  — KARTA to'lovida kassir kiritadi (bank ko'chirmasi bilan solishtirish uchun), to'lov vaqtidan
  OLDIN so'raladi. Normalizatsiya `PaymentFields.TryNormalizeCardLast4`: faqat raqamlar qoldiriladi
  va OXIRGI 4 tasi olinadi — **to'liq karta raqami hech qachon saqlanmaydi** (kassir butun raqamni
  yopishtirsa ham). Raqamlari 4 tadan kam bo'lsa 400. UI'da ham `slice(-4)` bilan cheklangan.
  KO'RINISHI: Moliya → To'lovlar jadvalidagi **"Kvitansiya" ustuni** ikki maqsadli — naqdda
  kvitansiya raqami ("KV000123"), kartada `•••• 1234` (`receiptCell()`). Shunga mos ravishda
  "Kvitansiya raqami: bor / yo'q" filtri ikkalasini ham hisobga oladi, qidiruv karta oxirgi 4
  raqami bo'yicha ham topadi, CSV'da `**** 1234` chiqadi. SARALASH esa faqat kvitansiya raqami
  bo'yicha (karta oxiri tasodifiy son — saralash ma'nosiz), kartalar ro'yxat oxirida qoladi.

- **KVITANSIYA RAQAMI BIR MARTA ISHLATILADI** (`ReceiptGuard.FindDuplicateAsync`): bitta qog'oz
  blank bo'yicha ikki marta to'lov yozilmasin. BARCHA yozish yo'llari tekshiradi —
  `StudentsController.AddPayment`, `FinanceController.Create/Update/UpdatePayment` (tahrirda
  `excludeTxId` bilan o'zini hisobga olmaydi). Band bo'lsa **409 Conflict** +
  `{ message, duplicate: DuplicateReceiptDto }` (F.I.Sh · guruh/kurs · o'qituvchi · summa · oy ·
  sana/usul · kim va qachon kiritgan). Klientda `receiptDuplicateOf(err)` shu ma'lumotni ajratadi va
  `PaymentModal`/`PaymentEditModal` ichida OGOHLANTIRISH KARTOCHKASI chiqaradi: "Bekor qilish" yoki
  **"Baribir saqlash"** (`ForceReceipt=true` — haqiqatan takroriy blank uchun; auditga
  "[takroriy kvitansiya KV… — ataylab saqlandi]" izohi tushadi).
  DIQQAT: to'lov modallari endi xatoni YUTMAYDI — `onSubmit` xatoni qayta otadi va modal faqat
  saqlash muvaffaqiyatli bo'lgandagina yopiladi (ilgari `StudentsPage` `addPayment`ni `await`
  qilmasdan modalni yopib yuborardi — xato bilinmay qolardi).

- **KASSA — TELEFON uchun alohida portal** (`/kassa`, ruxsat kaliti **`kassa`**): kassirda faqat telefon
  bor, shuning uchun admin paneli EMAS — `KassaMobileLayout` (bosh sahifa/yon menyu YO'Q, pastda 2 tab:
  "To'lov" va "To'lovlarim"). FAQAT `kassa` ruxsatiga ega xodim login'dan keyin shu yerga tushadi va
  `/admin/*` ga kirsa `/kassa` ga qaytariladi (`isKassaOnly`/`homeFor` — `config/navigation.ts`,
  `ProtectedRoute`). Admin/superadmin uchun o'sha ekran admin panelida ham bor (`/admin/kassa`).
  O'quvchini topish: (1) F.I.Sh yoki telefon qidiruvi (`GET /api/admin/kassa/students?q=`, server
  tomonda, 30 tagacha; telefon bazada `+998-XX-...` formatida saqlangani uchun raqamli moslashtirish
  XOTIRADA, kamida 4 raqam), (2) "ichiga kirish": **BARCHA** o'qituvchilar (arxivdagilar ham) → uning
  guruhlari (**ARXIV guruhlar ham** — `getClasses(true)`) → guruh o'quvchilari (chiqarilgan/muzlatilgan/
  sinov ham, balans PER-GURUH). Sabab: eski/yopilgan guruhning qarzi ham to'lanadi.
  "To'lov qilish" o'quvchilar bo'limidagi AYNAN SHU `PaymentModal`ni ochadi, saqlangach chek chiqadi.
  **YOZISH YO'LI BITTA:** `PaymentIntake.AddAsync` (Application) — `StudentsController.AddPayment`
  ham, `KassaController` (`POST /api/admin/kassa/students/{id}/payments`) ham shu xizmatni chaqiradi
  (kvitansiya nazorati, idempotentlik, avans `EnsureCharge`, audit, avto-xabar — nusxalanmagan);
  HTTP tarjimasi `PaymentIntakeHttp.ToActionResult` (409 dublikat / 400 xato / 200 `{id}`).
  NEGA ALOHIDA CONTROLLER: to'lov `[AdminPerm("students")]` ostida edi — kassirga to'lov uchun
  o'quvchi yaratish/tahrirlash huquqini ham berish kerak bo'lardi; endi "kassa" ruxsati YETADI
  (xodimga GET har doim ochiq, shuning uchun ro'yxatlar uchun yangi endpoint kerak emas).
  "Kassir" xodim shabloni (Program.cs seed) endi `kassa` ruxsatini ham beradi.

- **KIM QANCHA PUL QABUL QILGAN** (`CashierReport`, migratsiya `AddFinanceCreatedById`):
  `FinanceTransaction.CreatedById` — to'lovni kiritgan xodimning AKKAUNT id'si (`CreatedBy` esa
  ko'rsatish uchun F.I.Sh, chekdagi "Mas'ul"). ESKI yozuvlarda `CreatedById` null, shuning uchun
  guruhlash kaliti `CreatedById ?? "name:"+CreatedBy` — eski to'lovlar ism bo'yicha guruhlanadi va
  hisobotdan tushib qolmaydi. Faqat KIRIM (`Direction=="income"`) hisoblanadi.
  Ikki ko'rinish: **kassirning o'zi** — `GET /api/admin/kassa/my-payments?from&to` (kim ekani
  TOKENDAN olinadi, boshqa kassirnikini so'rab bo'lmaydi; standart davr — BUGUN) → "To'lovlarim"
  tabi (Bugun/7 kun/Shu oy, jami + naqd/karta/bank, qatorni bosib chekni qayta chiqarish);
  **admin/superadmin** — Moliya → **"Kassirlar"** tabi (`GET /api/admin/finance/cashiers`, qatorni
  bosish → `GET /api/admin/finance/cashier-payments`). DIQQAT: bu ikki finance endpointi ATAYIN
  qattiqroq (`CanSeeCashiers`) — odatdagi "staff'ga GET ochiq" qoidasidan farqli, kassir boshqa
  kassirlarning tushumini ko'rmaydi (faqat admin/superadmin yoki `finance` ruxsatli xodim).
  Bitta kassirni bosish — MODAL emas, **alohida sahifa** `/admin/finance/cashiers/:key`
  (`?name=&from=&to=`): ichida qidiruv (F.I.Sh · guruh · kurs · o'qituvchi · kvitansiya "kv123"/"123" ·
  karta oxiri · summa), davr, sahifalash, CSV va chek. `key` — akkaunt id'si yoki "name:F.I.Sh".
  BIRLASHTIRISH: eski (id'siz) yozuvning ismi NOYOB akkauntga to'g'ri kelsa, o'sha akkaunt id'si
  kalit bo'ladi — bitta odam ro'yxatda ikki marta chiqmaydi. Vaqtlar `AppClock.ToLocal` (UTC+5).
  Kassirning "To'lovlarim" ekrani: KUNMA-KUN (◀ sana ▶ yoki kalendardan istalgan kun) + "7 kun"/
  "Shu oy", ichida qidiruv va naqd/karta/bank filtri; jami summalar EKRANDAGI (filtrlangan) ro'yxatga
  qarab hisoblanadi.

- **KIM KIRITGANI JADVALLARDA KO'RINADI**: `FinanceTransactionDto.CreatedBy` (backend
  `FinanceController.ToDto`) — Moliya → **To'lovlar** jadvalida "Kiritgan" ustuni (qidiruv va CSV'ga
  ham kiradi) va **Umumiy → Kunlik hisobot**da kun tanlanganda "Vaqt · Kvitansiya · Kiritgan"
  ustunlari. Ya'ni har bir to'lov yonida qaysi kassir kiritgani va qog'oz kvitansiya raqami turadi.
  **"Kiritgan" FILTRI** (Moliya → To'lovlar): ro'yxat `GET /api/admin/finance/payment-authors`
  (`CashierReport.AuthorsAsync`, gate = `CanSeeCashiers`) — to'lov KIRITA OLADIGAN barcha akkauntlar
  (admin/superadmin + `kassa`/`students`/`finance` yozish ruxsatli xodim, hali to'lov kiritmagani ham)
  **+** davr ichida kiritgan, ammo endi ruxsati yo'q/o'chirilgan akkauntlar. Kalit — `CashierReport.KeyOf`
  (id yoki "name:F.I.Sh"), eski id'siz yozuv NOYOB ism bo'yicha akkauntga birlashadi. Mos kelish
  qoidasi klientda ham bir xil: `createdById == id` YOKI (id yo'q eski yozuvda) `createdBy == ism` —
  shuning uchun `FinanceTransactionDto`ga `CreatedById` qo'shilgan.

- **MOLIYA JADVALLARI SAHIFALANADI** (`components/ui/TablePagination.tsx`): `usePagination(items)`
  hook + `<TablePagination {...pg} />` — 20/30/50/100 talik, filtr/qidiruv o'zgarsa 1-sahifaga
  qaytadi. Ulangan joylar: Moliya → Amallar, O'qituvchilar, To'lovlar, Vozvratlar. CSV eksporti va
  jami summalar SAHIFAGA emas, butun FILTRLANGAN ro'yxatga tayanadi.
  To'lovlar bo'limida qo'shimcha filtrlar: **to'lov usuli** (naqd/karta/bank — chipda o'sha usul
  jami summasi) va **kvitansiya** (raqami bor / raqami yo'q).

- **ESKI / ARXIV GURUHGA TO'LOV QABUL QILINADI** (`PaymentIntake.AddAsync`): "billable guruhlar"
  ro'yxatida `sg.IsActive` sharti **YO'Q** — faqat `Status != "trial"`. Guruhdan CHIQARILGAN,
  "tugatgan" (sertifikat bilan yopilgan guruh) va MUZLATILGAN a'zoliklarda ham qarz qolishi mumkin,
  kassir uni keyin ham qabul qila olishi shart. UI allaqachon shunday ishlaydi (`PaymentModal`
  sinovdan boshqa BARCHA a'zoliklarni ko'rsatadi, "— chiqarilgan" yorlig'i bilan; Kassa esa arxiv
  guruhlarni ataylab ro'yxatlaydi).
  ⚠️ Ilgari `sg.IsActive` talab qilinardi va IKKI xil buzilish berardi: (1) o'quvchining boshqa faol
  guruhi bo'lsa — 400 "To'lov qaysi guruh uchun ekanini tanlang" (tanlangan eski guruh ro'yxatda
  yo'q edi); (2) faol guruhi BITTA bo'lsa — to'lov JIMGINA o'sha noto'g'ri guruhga teglanardi.
  `FinanceController` (Moliya → to'lovni tahrirlash) allaqachon `IsActive`siz tekshirardi.

- **MUZLATISH HISOBI — YAGONA MANBA `MembershipBilling.SettleFreezeAsync`** (Application/Services):
  qisman to'lov (`ChargeFreezeProrateAsync`) + muzlatish oyidan keyingi hisoblarni bekor qilish
  (`PurgeChargesAfterMonthAsync`, muzlatish sanasi aktivlashtirishdan oldin bo'lsa `inclusive: true`).
  TO'RTTA yo'l ham AYNAN shuni chaqiradi: **Muzlatish** (`FreezeMember`), **Guruh almashtirish**
  (`TransferMember`), **Guruhni yopish** (`Close`) va **Guruhni tugatish — sertifikat bilan**
  (`CompleteAndTransfer`). Yangi muzlatish yo'li qo'shilsa — SHU metod chaqiriladi, nusxa ko'chirilmaydi.

- **GURUHNI TUGATISH (SERTIFIKAT BILAN)** (`POST /api/admin/classes/{id}/complete-and-transfer`,
  guruh sahifasi "⋮" → "Tugatish (sertifikat bilan)"): modalda **IKKITA SANA** so'raladi —
  `closeDate` (eski guruh yopiladigan sana) va `activateDate` (yangi guruhda aktivlashtirish sanasi;
  `activateInNewGroup` ptichkasi bilan o'chirilsa o'quvchilar yangi guruhda "sinov"da qoladi).
  Oqim `TransferMember` (guruh almashtirish) bilan bir xil, faqat OMMAVIY: eski guruhdagi FAOL
  a'zoliklar `closeDate`dan muzlatiladi (`MembershipBilling.SettleFreezeAsync` — shu sanagacha o'qilgan
  darslar uchun oylik **ESKI GURUHGA** yoziladi, keyingi oylar bekor qilinadi), a'zolik
  `Status="completed"`, `IsActive=false`, `LeftAt=FrozenAt=closeDate` bo'ladi (FrozenAt — hisob-kitob
  chegarasi: `StudentGroupLedger`/`GroupBalanceService`/`SalaryLedger`/`RetentionBonusService` hammasi
  shunga qaraydi), sertifikat beriladi, guruh `IsArchived`+`Status="archived"` bo'ladi, yangi guruhda
  esa eski guruhda FAOL bo'lganlar `activateDate`dan aktivlashtiriladi
  (`ChargeActivationProrateAsync` + `AccrueCatchUpAsync` + `CarryGroupAdvanceAsync` — eski guruhda
  ortib qolgan avans yangi guruhga ko'chadi). Sinov/muzlatilgan a'zolar yangi guruhda "sinov"da qoladi.
  ⚠️ Ilgari bu endpoint hisobga UMUMAN tegmasdi: a'zolik shunchaki "completed" bo'lib yopilar,
  yopish oyining allaqachon yozilgan TO'LIQ oyligi kamaymas, hisob umuman bo'lmagan holatda esa oy
  "to'langan" bo'lib ko'rinardi va eski guruhga qarz yozilmasdi.
  Javob: `CloseDate/ActivateDate/ChargedOldGroup/RestoredCharges/ActivatedInNew/MovedAdvance`.
  `StudentGroupLedger` ham chiqish oyini endi QISMAN ko'rsatadi (`!IsActive && LeftAt` shu oyda →
  `FreezeGross`), to'liq oylik emas — hisob qatori hali yozilmagan holatda ham.

- **GURUHNI YOPISH** (`POST /api/admin/classes/{id}/close`, guruh sahifasi "⋮" → "Guruhni yopish"):
  berilgan sanadan guruhning BARCHA faol a'zoliklari muzlatiladi (har biriga oddiy muzlatish bilan bir
  xil qisman to'lov), muzlatish oyidan KEYINGI hisoblar bekor qilinadi
  (`TuitionService.PurgeChargesAfterMonthAsync` — orqaga sanalgan yopishda qarz sanadan keyin o'smasin;
  `Locked` tegilmaydi), trial a'zoliklar yakunlanadi (hisobi yo'q — muzlatilsa soxta qarz chiqardi),
  guruh `IsArchived`+`Status="archived"` bo'ladi. O'quvchilar ARXIVLANMAYDI va a'zoliklar saqlanadi —
  **muzlatilgan/arxiv guruhga to'lov qabul qilinaveradi**: `PaymentModal` trial'dan boshqa barcha
  a'zoliklarni ko'rsatadi, `StudentGroupLedger` esa muzlatilgan/chiqarilgan a'zolikda oylarni
  muzlatish (yoki chiqish) oyida to'xtatadi va avans oylarini ko'rsatmaydi.

- **PER-GURUH BALANS (qizil/yashil):** guruh kontekstidagi ro'yxatlar (jurnal qatorlari, guruh a'zolari —
  admin ham, o'qituvchi ilovasi ham) `Student.Balance` (UMUMIY) emas, `GroupBalanceService.ForGroupAsync`
  hisoblagan **shu guruh** balansini ko'rsatadi: `to'langan(shu guruh) − hisoblangan(shu guruh)`,
  manfiy = qarz. Shu sabab 2 kursda o'qiydigan o'quvchi bittasiga to'lasa — o'sha o'qituvchida YASHIL,
  to'lamaganida QIZIL. Teglanmagan (eski, GroupId=null) hisob VA to'lov guruhlar `MonthlyFee` nisbatida
  taqsimlanadi — `SalaryLedger`/`CourseFinanceReport` bilan bir xil konvensiya (per-guruh balanslar
  yig'indisi umumiy balansga teng chiqadi). DIQQAT: markaz bo'yicha qarzdorlik (Dashboard, qarzdorlarga
  SMS, o'quvchi profili/portali) ATAYIN umumiy `Student.Balance`da qoladi.
  **UCHINCHI RANG — 2+ OYLIK QARZ (fuchsia):** `GroupBalanceService.DetailedForGroupAsync` balans bilan
  birga **qarzdor OYLAR sonini** (`GroupBalanceInfo.DebtMonths`) qaytaradi — o'sha bir so'rovdagi
  hisob/to'lov OYMA-OY yig'iladi (teglanmagan yozuvlar o'sha `MonthlyFee` nisbatida taqsimlanadi) va
  `StudentGroupLedger`dagi qoida takrorlanadi: `hisoblangan(oy) − o'sha oyga to'langan > 0` → oy qarz
  (har oy MUSTAQIL — keyingi oyga to'langan avans o'tgan oy qarzini yopmaydi). `ForGroupAsync` — shu
  metodning o'rami, balans raqami o'zgarmagan. Jurnalda (admin ham, o'qituvchi ham — bitta
  `GroupJournalStudentDto.DebtMonths`) 2+ oy qarz **qizildan USTUN** va binafsha-pushti ko'rsatiladi;
  frontend ranglari yagona joyda — `lib/utils.ts` `balanceTextCls/balanceDotCls/balanceTitle`,
  chegara `HEAVY_DEBT_MONTHS`.

- **GURUH ALMASHTIRISHDA AVANS YANGI GURUHGA KO'CHADI** (`TuitionService.CarryGroupAdvanceAsync`):
  o'quvchi oy boshida ESKI guruhga to'lab, so'ng boshqa guruhga o'tkazilsa — muzlatish qisman hisobi eski
  guruh hisobini (oy boshidan muzlatilsa) nolga tushiradi, lekin PUL eski guruhga teglangan qolardi:
  eski guruh yashil (avans), yangi guruh esa to'liq qizil ("to'lamagan") bo'lib ko'rinardi. Endi eski
  guruhda **ortib qolgan summa** (to'langan − vozvrat − hisoblangan, HAR OY uchun alohida; faqat muzlatish
  oyi va undan KEYINGI oylar) yangi guruhga qayta teglanadi: to'lov to'liq ortiqcha bo'lsa `GroupId`
  almashadi, qisman bo'lsa tranzaksiya ikkiga bo'linadi (asl yozuv kamayadi + yangi guruhga yangi yozuv,
  izohda "[guruh almashtirildi: A → B]"). Umumiy pul, `Student.Balance` va kassa hisobotlari
  O'ZGARMAYDI — faqat guruh tegi (shu sabab foizli maosh ham to'g'ri o'qituvchiga o'tadi). Chaqiriladi:
  `TransferMember` (guruh almashtirish tugmasi) va `ActivateMember` — ikkinchisida faqat **AYNAN SHU OYDA**
  muzlatilgan boshqa a'zolikdan (qo'lda "muzlatish + yangi guruhga qo'shish" oqimi); ilgari muzlatilgan
  (ta'tildagi) a'zolik avansi tegilmaydi. Ko'chirilgan summa auditga yoziladi. Eski (fiks'dan oldingi)
  yozuvlarni tuzatish: Moliya → to'lovni tahrirlash → guruhni yangi guruhga o'zgartirish.

- **Maoshni jurnalga bog'lash** (migratsiya `AddSalaryJournalPolicy`): "Jurnal boshqaruvi" modalidagi
  "Maosh va jurnal" bo'limi — `CenterMeta.SalaryRequireJournal` + `SalaryGraceDays` (0-30). Yoqilsa har
  oyda guruh `Days` bo'yicha REJADAGI darslardan jurnalda `LessonNote.Conducted` belgilanmaganlari
  **o'tilmagan** hisoblanadi va maoshdan ushlanadi (`SalaryJournalStats.BuildAsync` → (oy,guruh) →
  Planned/Conducted/MissedDates; muhlati kelmagan = `AppClock.Today − graceDays` dan keyingi darslar
  hisobga olinmaydi). `SalaryLedger`: per-guruh va legacy-foizda ushlanma har guruh ulushidan
  (`contribution × missed/planned`), legacy-qat'iyda bitta dars narxi = `oylik ÷ rejadagi darslar`.
  `MonthSalaryDto` — `BaseExpected/Deduction/Planned-Conducted-MissedLessons/Lessons[]`
  (`SalaryLessonStatDto` — guruh + belgilanmagan SANALAR); `SalaryLedgerDto` `TotalDeduction/JournalLinked`;
  `SalaryReportRowDto` `Deduction/MissedLessons`. **Sabab ko'rinadi:** Moliya → O'qituvchilar jadvalida
  "Ushlanma" ustuni, `TeacherSalaryDetailModal`da oy qatorini bosib guruh+sanalar, o'qituvchining
  `SalaryPage`ida ham xuddi shunday.
