---
description: CRM — lidlar, lid manbasi ma'lumotnomasi, lidda tashqi maktab, sinov darsi va konversiya.
paths:
  - "IntellectCRM.Server/Controllers/Lead*.cs"
  - "IntellectCRM.Application/Services/LeadNotifier.cs"
  - "IntellectCRM.Application/Services/TrialReminderService.cs"
  - "IntellectCRM.Client/src/pages/admin/leads/**"
  - "IntellectCRM.Client/src/pages/admin/marketing/**"
---

# CRM / lidlar qoidalari

- **CRM:** `Lead`(Source/InterestSubject/CreatedAt/ConvertedStudentId), `LeadEvent`(tarix),
  `TrialLesson`(sinov). Endpointlar `LeadsController`da: events, trials, `/{id}/convert`, `/stats`.

- **`Lead.PhoneKey`** (migratsiya `AddLeadPhoneKeyAndRepeat`) — telefonning oxirgi 9 raqami,
  INDEKSLANGAN. "Shu telefon bilan lid bormi?" (`LeadIntake.FindByPhoneAsync` — ommaviy forma va
  daraja testi har murojaatda so'raydi) endi bitta SQL so'rovi; ilgari butun `Leads` jadvali
  xotiraga o'qilardi. ⚠️ **Qo'lda to'ldirilmaydi** — `AppDbContext.SaveChanges` (`SyncLeadPhoneKeys`)
  uni `Phone` dan o'zi yozadi, ya'ni lid yaratadigan/telefonini o'zgartiradigan YANGI joy
  qo'shilganda ham unutilmaydi (unutilsa — o'sha lidga dublikat ochilardi).

- **`Lead.RepeatCount` / `LastRepeatAt`** — TAKRORIY murojaat (odam formani/daraja testini yana
  to'ldirdi). Bosqich ATAYIN o'zgarmaydi, belgisi kanban kartasida «Takroriy ×N» chipi va lid
  oynasida alohida qator bo'lib chiqadi. Batafsil: `.claude/rules/lead-forms.md` §4.

- **Lid manbasi ma'lumotnoma** (migratsiya `AddLeadSources`): `LeadSource`(Id,Name,Order) entity +
  `LeadSourcesController` (`api/admin/lead-sources`, AdminPerm "settings" — GET barcha xodimga ochiq).
  Boshqariladi: "O'quv bo'limi → Sabablar" sahifasi (`ReasonsPage` uchinchi karta). `Lead.Source` — manba
  NOMI (matn); manba nomi o'zgartirilsa server eski lidlarni ham ko'chiradi. Lid formasi select'i
  serverdan (`config/constants.ts` `leadSourceOptions` faqat FALLBACK), Lidlar sahifasida "Manba" filtri
  ("Noma'lum" = bo'sh source). Migratsiya mavjud `Leads.Source` qiymatlarini + 6 standart manbani seed
  qiladi.

- **Qiziqqan fani = KURS** (`Lead.InterestSubject` kurs NOMINI saqlaydi — `LevelTestService` bilan bir
  xil konvensiya): lid formasidagi maydon endi erkin matn emas, `GET /api/admin/leads/courses`
  (Subject nomlari; kurslar `schedule` ruxsatida bo'lgani uchun leads ruxsati ostida alohida endpoint)
  dan keladigan SELECT. Ro'yxatda yo'q eski/landing qiymati variant sifatida saqlanadi. Kurs nomi
  o'zgartirilsa `SubjectsController.Update` eski nomli lidlarni ham ko'chiradi (`LeadSource` kabi).
  **CRM statistikasi** (`/stats` → `CrmStatsDto.ByInterest`, `CrmInterestStatDto`): fan bo'yicha lid
  soni + aylantirilgan + konversiya %; normalizatsiya — kurs id → nomi, registr farqisiz kurs nomiga
  moslash, bo'sh = "Ko'rsatilmagan". UI: `CrmStatsPage` — gorizontal bar (top 10) + to'liq jadval.

- **Lidda tashqi maktab** (migratsiya `AddLeadSchool`): `Lead.DistrictId`/`SchoolId` (o'quvchidagi
  `District`/`School` ma'lumotnomasi) — formada tuman→maktab select'lari, Lidlar sahifasida shu bo'yicha
  filtr + lidlar ichida qidiruv (ism/telefon/ota-ona/manba/maktab; telefon raqamlar bo'yicha).
  Konversiyada (`/convert`) tuman/maktab `Student`ga ko'chadi.
