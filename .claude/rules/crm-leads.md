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

- **Lid manbasi ma'lumotnoma** (migratsiya `AddLeadSources`): `LeadSource`(Id,Name,Order) entity +
  `LeadSourcesController` (`api/admin/lead-sources`, AdminPerm "settings" — GET barcha xodimga ochiq).
  Boshqariladi: "O'quv bo'limi → Sabablar" sahifasi (`ReasonsPage` uchinchi karta). `Lead.Source` — manba
  NOMI (matn); manba nomi o'zgartirilsa server eski lidlarni ham ko'chiradi. Lid formasi select'i
  serverdan (`config/constants.ts` `leadSourceOptions` faqat FALLBACK), Lidlar sahifasida "Manba" filtri
  ("Noma'lum" = bo'sh source). Migratsiya mavjud `Leads.Source` qiymatlarini + 6 standart manbani seed
  qiladi.

- **Lidda tashqi maktab** (migratsiya `AddLeadSchool`): `Lead.DistrictId`/`SchoolId` (o'quvchidagi
  `District`/`School` ma'lumotnomasi) — formada tuman→maktab select'lari, Lidlar sahifasida shu bo'yicha
  filtr + lidlar ichida qidiruv (ism/telefon/ota-ona/manba/maktab; telefon raqamlar bo'yicha).
  Konversiyada (`/convert`) tuman/maktab `Student`ga ko'chadi.
