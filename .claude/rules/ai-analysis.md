---
description: AI tahlil (Gemini) — markaz kunlik tahlili, o'quvchi tahlili va O'QITUVCHI tahlili (o'quvchi oqimi, ketish sabablari, jurnal intizomi, rivojlanish).
paths:
  - "IntellectCRM.Application/Services/*Ai*.cs"
  - "IntellectCRM.Application/Services/GeminiService.cs"
  - "IntellectCRM.Application/Services/TeacherSnapshotBuilder.cs"
  - "IntellectCRM.Application/Services/StudentProfileBuilder.cs"
  - "IntellectCRM.Server/Controllers/AiAnalysisController.cs"
  - "IntellectCRM.Client/src/pages/admin/students/AiAnalysis*.tsx"
  - "IntellectCRM.Client/src/pages/admin/teachers/TeacherAiPanel.tsx"
  - "IntellectCRM.Client/src/components/dashboard/CenterAiAnalysisCard.tsx"
  - "IntellectCRM.Client/src/api/services/aiAnalysis.ts"
---

# AI tahlil qoidalari (Gemini)

- **UMUMIY ARXITEKTURA (uchala tahlilda ham bir xil):** RAQAMLAR DETERMINISTIK hisoblanadi (kod),
  AI faqat NARRATIV yozadi (o'zbekcha) va 0..100 sohaviy baho qo'yadi. Natija
  `ResultJson` (`{ ai, metrics }`) sifatida saqlanadi — shu sabab eski tahlil ochilganda ham
  diagrammalar ishlaydi. Gemini javobi ```json fence'dan tozalanadi va `Sanitize` bilan null'lardan
  himoyalanadi (format buzilsa — "AI javobini o'qib bo'lmadi", yozuv SAQLANMAYDI).
  **KUNIGA BIR MARTA**: shu kun yozuvi bo'lsa Gemini CHAQIRILMAYDI, mavjudi qaytadi
  (`AlreadyToday=true`) — bu tekshiruv API kaliti tekshiruvidan OLDIN (keshlangan natija kalitsiz
  ham ko'rinadi). Kalit: `AppSecrets.GeminiApiKey` (.env), model: `GEMINI_MODEL`.

- **Uchta tahlil:**
  1. **Markaz** — `CenterAiAnalysisService` + `CenterAiSchedulerService` (har kuni ertalab avtomatik),
     `AiAnalysisController` (`api/admin/ai-analysis/center`). KIRISH: superadmin yoki "ai" ruxsatli
     xodim (oddiy admin KO'RMAYDI). Bosh sahifadagi `CenterAiAnalysisCard`.
  2. **O'quvchi** — `StudentsController` (`{id}/ai-analysis`, `{id}/ai-analyses`), ma'lumot manbai
     `StudentProfileBuilder`. Ruxsat: `AdminPerm("students")`. UI: `AiAnalysisModal`/`AiAnalysisView`.
  3. **O'QITUVCHI** — `TeacherAiAnalysisService` + `TeacherSnapshotBuilder`, `TeachersController`
     (`{id}/ai-snapshot`, `{id}/ai-analyses`, `{id}/ai-analysis`). Ruxsat: `AdminPerm("teachers")`.
     UI: o'qituvchi profilidagi **"AI tahlil"** tabi (`TeacherAiPanel`).

- **O'QITUVCHI TAHLILI — ma'lumot manbalari** (`TeacherSnapshotBuilder`, oxirgi 12 oy; hammasi
  MAVJUD yagona manbalardan olinadi, yangi hisoblash mantig'i YARATILMAYDI):
  - **o'quvchi oqimi** (kim kelyapti/ketyapti) — `StudentGroup` sanalari (JoinedAt/ActivatedAt/
    FrozenAt/LeftAt) + `MembershipLifecycle.Tally` → performance va `TeacherActivityReport` bilan
    AYNAN bir xil ta'rif (faqat ARXIVLANMAGAN guruhlar; guruh tugaganda ommaviy yopilgan a'zoliklar
    "ketgan" emas);
  - **ketish sabablari** — sabab alohida ustunda saqlanmaydi: `AuditLog` (`EntityType="Membership"`,
    summary ichida `— sabab: X`; `EntityId="{groupId}:{studentId}"`) + markazdan butunlay
    arxivlanganlar uchun `ArchivedRecord.Reason`;
  - **jurnalni O'Z VAQTIDA to'ldirish** — `SalaryJournalStats` (reja/o'tilgan/`MissedDates` =
    muhlati o'tgan, lekin belgilanmagan darslar; muhlat = `CenterMeta.SalaryGraceDays`) +
    `LessonNote` (mavzu/uy vazifa/`AttendanceTaken` foizi) + qo'yilgan baholar soni;
  - **rivojlanish** — oyma-oy o'rtacha baho (`JournalEntry.Grade`), o'quvchilar davomati va bali
    (`StudentBallService.TeacherAsync`), testlar (`TestResult`/`TestScore`) va topshiriqlar;
  - qo'shimcha: o'qituvchining O'Z davomati (`TeacherAttendance`) va guruh ota-onalaridan kelgan
    shikoyat/takliflar (`Feedback`).
  DIQQAT: `GET {id}/ai-snapshot` — AI'SIZ ham ishlaydi (Gemini chaqirilmaydi). Tab ochilganda barcha
  diagramma/jadval shu endpointdan to'ladi; AI xulosasi esa alohida, tugma bosilganda yaratiladi.
