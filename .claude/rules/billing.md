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

- **Maosh QO'LDA, 2 rejim** (`Teacher.SalaryMode`): **"fixed"** — admin `Teacher.Salary` qat'iy summasini
  kiritadi; **"percent"** — o'qituvchi guruh(lar)idan SHU OYDA haqiqatan yig'ilgan tuition to'lovining
  `Teacher.SalaryPercent` foizi (yig'ilgan sayin o'sib boradi). Hisob:
  `SalaryLedger.CollectedForTeacherGroupsAsync` — guruh = `Group.TeacherId`; to'lov
  `FinanceTransaction.GroupId` tegiga ega bo'lsa 100% o'sha guruhga, **teglanmagan** to'lov esa
  o'quvchining shu oydagi billable guruhlari `MonthlyFee` nisbatida taqsimlanadi. Frontend
  `TeacherSalaryPage` (rejim toggle + foiz).
  DIQQAT: `TeachersController.Create/Update` `Salary/SalaryMode/SalaryPercent`ni YOZADI (ilgari Salary
  umuman yozilmasdi — latent bug); `TeacherFormModal` bu maydonlarni round-trip qiladi (profil tahrirda
  reset bo'lmaydi).

- **Billing + a'zolik holati:** `StudentGroup.Status` = "trial" (sinov — to'lov YO'Q) | "active" | "frozen".
  Guruhga qo'shilganda "trial". **Aktivlashtirish** (`/members/{sid}/activate` {date}): birinchi (qisman)
  oy = (guruh `MonthlyFee` ÷ SHU OYDAGI jami dars) × shu sanadan oy oxirigacha qolgan darslar
  (`group.Days` bo'yicha) — qolgan ≤ jami bo'lgani uchun to'liqdan oshmaydi, chegirma qo'llanadi
  (`TuitionService.ChargeActivationProrateAsync`). **Muzlatish** (`/members/{sid}/freeze` {date}): shu
  oydan boshlab hisoblanmaydi; **muzlatish SANASINING O'ZI hisobga kiradi** (o'sha kuni dars bo'lsa
  to'lovga qo'shiladi) — `StudentGroupLedger.FreezeGross` previewi ham aynan shu konvensiyada va
  `TuitionService.ProratedLessonCharge` ni ishlatadi. `AccrueMonth` har oy = FAOL a'zoliklarning
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
