---
description: Jurnal tahrirlash siyosati (JournalPolicy) va BALL / reyting hisobi.
paths:
  - "IntellectCRM.Application/Services/Journal*.cs"
  - "IntellectCRM.Application/Services/StudentBallService.cs"
  - "IntellectCRM.Application/Services/RatingService.cs"
  - "IntellectCRM.Application/Services/GradingService.cs"
  - "IntellectCRM.Server/Controllers/JournalController.cs"
  - "IntellectCRM.Server/Controllers/ClassAnalyticsController.cs"
  - "IntellectCRM.Server/Controllers/TeacherPortalController.cs"
  - "IntellectCRM.Server/Controllers/StudentAttendanceController.cs"
  - "IntellectCRM.Client/src/pages/admin/journal/**"
  - "IntellectCRM.Client/src/pages/admin/classes/**"
  - "IntellectCRM.Client/src/pages/admin/grading/**"
---

# Jurnal va reyting qoidalari

- **Jurnal boshqaruvi (tahrirlash siyosati):** Guruhlar sahifasida "Jurnal boshqaruvi" tugmasi → modal
  (`JournalPolicyModal`). Sozlama `CenterMeta`da (migratsiya `AddJournalPolicy`): `JournalEditMode`
  ("free"|"today"|"window"), `JournalRetroDays` (window uchun 1-90), `JournalConductedOnly` (baho faqat
  "o'tildi" darsga; ommaviy davomat mustasno — u darsni o'zi conducted qiladi), `JournalApplyToAdmins`
  (default false — faqat o'qituvchiga). Nazorat nuqtasi: `JournalPolicy.CheckAsync` (Application/Services)
  — admin `JournalController` va o'qituvchi `TeacherPortalController`ning PUT/DELETE journal +
  bulk-attendance'da chaqiriladi, taqiq 400+message. API: `GET/PUT /api/admin/journal/policy`
  (AdminPerm "classes"). Kelajak sanalar HAR DOIM taqiq (JournalService).

- **Muzlatilgan o'quvchi jurnalda:** alohida yig'iladigan blokda ko'rinadi (faqat o'qish). Blok
  BALANS rangini faol qatorlar bilan bir xil ko'rsatadi (to'lagan — yashil nuqta+ism, qarzdor — qizil)
  va ism yonida "Muzlatilgan" yorlig'i turadi. Guruhda FAOL o'quvchi qolmasa (masalan guruh yopilgan)
  blok avtomatik OCHIQ bo'ladi. TUGATILGAN (arxiv) guruh jurnalida oylar ro'yxati arxiv oyida
  to'xtaydi (`JournalService.GroupMonthAsync`) — bo'sh joriy oy ochilmasin. Muzlatilgan
  sanadan KEYINGI o'tilgan darslar avto-"keldi" ✓ EMAS (faqat aniq belgilangan `entry.present` yashil);
  guruhga qo'shilishidan (`memberStart`) yoki guruh `startDate`idan OLDINGI darslar ham hech qachon
  avto-"keldi" bo'lmaydi. "Davomat" tabi ham shu chegaralarda sanaydi:
  `held = conducted ∩ (memberStart ≤ sana ≤ frozenAt)` — o'quvchi portali (`StudentAttendanceController`
  `memberEnd`) bilan bir xil.

- **BALL (reyting bali)** = `Σ(jurnal baholari) + Σ(bajarilgan baholash mezonlari)` — guruh sahifasidagi
  "Reyting" tabi bilan BIR XIL formula. Servis: `StudentBallService` (Application/Services):
  `ComputeAsync(db, groupIds?)` (groupIds=null → markaz bo'yicha), `SchoolAsync`, `TeacherAsync`.
  Endpointlar: `GET /api/admin/students/balls` (`ClassAnalyticsController`, DataCache `ball:students`),
  `GET /api/admin/teachers/{id}/rating`, `GET /api/teacher/rating` → `TeacherRatingDto`(rows: rank, ball
  tarkibi, guruhlar, o'rtacha, davomat). **UI:** admin o'qituvchi sahifasida "Reyting" tabi (TOP-3 podium
  + jadval), o'qituvchi ilovasida `/teacher/rating` (profil menyusidan), admin "O'quvchilar" ro'yxatida
  "Ball" ustuni + "Ball: yuqoridan/pastdan" saralash (TOP-3 ga medal).

- **Reyting hamma joyda YIG'ILGAN BALL bo'yicha** (o'rtacha baho EMAS): `RatingService.SchoolAsync`
  `StudentBallService.ComputeAsync` dan `Ball` ni qo'shadi (`StudentRatingRowDto.Ball`,
  `PortalRatingRowDto.Ball`), o'quvchi portali guruh/markaz reytingi ball bo'yicha saralanadi va ballni
  ko'rsatadi (teng bo'lsa o'rtacha baho hal qiladi). Kesh `rating:school` deps'iga `CriterionGrade`
  qo'shilgan (ikkala chaqiruv joyida ham). O'quvchi profilida (admin) "Yig'ilgan ballar" bo'limi va
  o'quvchi portali "Baholash" ekranida "Bu oyda / Jami yig'ilgan" ball
  (`StudentGradingGroupDto.MonthBall/TotalBall`) — o'rtacha ko'rsatilmaydi.
