---
description: AI tahlil (Gemini) — markaz kunlik tahlili, o'quvchi, O'QITUVCHI va GURUH tahlili (oqim, ketish sabablari, davomat, jurnal intizomi, imtihon, to'lov).
paths:
  - "IntellectCRM.Application/Services/*Ai*.cs"
  - "IntellectCRM.Application/Services/GeminiService.cs"
  - "IntellectCRM.Application/Services/TeacherSnapshotBuilder.cs"
  - "IntellectCRM.Application/Services/GroupSnapshotBuilder.cs"
  - "IntellectCRM.Application/Services/StudentProfileBuilder.cs"
  - "IntellectCRM.Server/Controllers/AiAnalysisController.cs"
  - "IntellectCRM.Client/src/pages/admin/students/AiAnalysis*.tsx"
  - "IntellectCRM.Client/src/pages/admin/teachers/TeacherAiPanel.tsx"
  - "IntellectCRM.Client/src/pages/admin/classes/GroupAiPanel.tsx"
  - "IntellectCRM.Client/src/components/ai/**"
  - "IntellectCRM.Client/src/lib/ai.ts"
  - "IntellectCRM.Client/src/components/dashboard/CenterAiAnalysisCard.tsx"
  - "IntellectCRM.Client/src/api/services/aiAnalysis.ts"
---

# AI tahlil qoidalari (Gemini)

- **UMUMIY ARXITEKTURA (to'rttala tahlilda ham bir xil):** RAQAMLAR DETERMINISTIK hisoblanadi (kod),
  AI faqat NARRATIV yozadi (o'zbekcha) va 0..100 sohaviy baho qo'yadi. Natija
  `ResultJson` (`{ ai, metrics }`) sifatida saqlanadi — shu sabab eski tahlil ochilganda ham
  diagrammalar ishlaydi. Gemini javobi ```json fence'dan tozalanadi va `Sanitize` bilan null'lardan
  himoyalanadi (format buzilsa — "AI javobini o'qib bo'lmadi", yozuv SAQLANMAYDI).
  **KUNIGA BIR MARTA**: shu kun yozuvi bo'lsa Gemini CHAQIRILMAYDI, mavjudi qaytadi
  (`AlreadyToday=true`) — bu tekshiruv API kaliti tekshiruvidan OLDIN (keshlangan natija kalitsiz
  ham ko'rinadi). Kalit: `AppSecrets.GeminiApiKey` (.env), model: `GEMINI_MODEL`.

- **UMUMIY UI QISMLARI:** `components/ai/AiParts.tsx` (ScoreRing, AiRadar, ScoreGrid, PctRow,
  RankedBars, CardList, TextBlock, MiniStat, AiErrorBox) + `lib/ai.ts` (scoreColor, trendInfo,
  escapeHtml, openPrintWindow, printCss). Yangi AI paneli yozilganda SHULAR ishlatiladi (nusxa
  ko'chirilmaydi). DIQQAT: komponent va oddiy funksiyalar ARALASH bo'lmasin (eslint
  `react-refresh/only-export-components`) — shuning uchun funksiyalar `lib/ai.ts` da.

- **To'rtta tahlil:**
  1. **Markaz** — `CenterAiAnalysisService` + `CenterAiSchedulerService` (har kuni ertalab avtomatik),
     `AiAnalysisController` (`api/admin/ai-analysis/center`). KIRISH: superadmin yoki "ai" ruxsatli
     xodim (oddiy admin KO'RMAYDI). Bosh sahifadagi `CenterAiAnalysisCard`.
  2. **O'quvchi** — `StudentsController` (`{id}/ai-analysis`, `{id}/ai-analyses`), ma'lumot manbai
     `StudentProfileBuilder`. Ruxsat: `AdminPerm("students")`. UI: `AiAnalysisModal`/`AiAnalysisView`.
  3. **O'QITUVCHI** — `TeacherAiAnalysisService` + `TeacherSnapshotBuilder`, `TeachersController`
     (`{id}/ai-snapshot`, `{id}/ai-analyses`, `{id}/ai-analysis`). Ruxsat: `AdminPerm("teachers")`.
     UI: o'qituvchi profilidagi **"AI tahlil"** tabi (`TeacherAiPanel`).
  4. **GURUH** — `GroupAiAnalysisService` + `GroupSnapshotBuilder`, `ClassesController`
     (`{id}/ai-snapshot`, `{id}/ai-analyses`, `{id}/ai-analysis`). Ruxsat: `AdminPerm("classes")`.
     UI: guruh sahifasidagi **"AI tahlil"** tabi (`GroupAiPanel`).

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

- **O'QUVCHILARNING O'QITUVCHI HAQIDAGI FIKRI** (migratsiya `AddTeacherReviews`, entity
  `TeacherReview`): o'qituvchini rivojlantirish uchun yig'iladigan **MATNLI** manba — AI aynan
  shundan raqamlar ko'rsatmaydigan narsani (tushuntirish uslubi, munosabat, adolatlilik) biladi.
  • **KIM YOZADI:** FAQAT `admin`/`superadmin` (+platforma egasi) — o'quvchi profili →
    «Fikr-mulohaza» tabi → "O'qituvchilar haqida fikr". O'quvchi/ota-ona O'ZI yozmaydi, xodim
    (staff) ham ko'rmaydi: `TeacherReviewsController` da ATAYIN `[AdminPerm]` EMAS, balki
    `[Authorize(Roles = admin,superadmin,platformowner)]` (AdminPerm xodimga GET'ni ochib qo'yardi).
  • **HAR GURUH UCHUN ALOHIDA:** kalit (o'quvchi, o'qituvchi, guruh). O'quvchi 2+ guruhda o'qisa —
    2+ blok chiqadi. Chiqarilgan/tugatgan a'zolik ham ko'rinadi (tarix qimmatli), faollar tepada.
    Server klientdan kelgan `teacherId`ga ISHONMAYDI — guruhning amaldagi o'qituvchisi olinadi.
  • **KO'RISH — ADMIN uchun IKKI joyda:** (1) o'quvchi profilida (guruh bo'yicha bloklar);
    (2) **o'qituvchi profilida «Fikrlar» tabi** (`GET /api/admin/teachers/{id}/reviews` →
    `TeacherReviewService.ForTeacherAsync`) — shu o'qituvchi haqidagi BARCHA fikrlar bir joyda
    yig'iladi, eng yangisi tepada, o'quvchi (profiliga havola bilan) va guruh nomi ko'rinadi,
    guruh bo'yicha filtr va o'chirish bor. Yozish u yerda YO'Q — fikr faqat o'quvchi profilida
    yoziladi (u yerda guruh/o'qituvchi konteksti aniq).
  • **MAXFIYLIK — CHEGARA QAYERDA:** xom matn **O'QITUVCHINING O'ZIGA** hech qachon berilmaydi —
    o'qituvchi portalida (`api/teacher/*`) va Flutter ilovasida bunday endpoint ATAYIN yo'q;
    auditga ham matn yozilmaydi (faqat fakt). ADMIN esa yuqoridagi ikki joyda ko'radi.
    AI xulosasi o'qituvchiga ko'rsatilishi mumkin, shuning uchun
    `TeacherReviewService.TextsForTeacherAsync` matnga faqat
    **sana + guruh nomi** qo'shadi, O'QUVCHI ISMINI QO'SHMAYDI; promptda ham "so'zma-so'z ko'chirma,
    ism yozma" ko'rsatmasi bor — chunki xulosa o'qituvchining o'ziga ham ko'rsatiladi.
  • **AI'ga ULANISHI:** `TeacherSnapshotBuilder` 7b-bo'lim → snapshotdagi `oquvchilarFikri`
    (`{soni, matnlar}`, oxirgi 12 oy, eng yangi 25 ta, har biri 400 belgigacha);
    `TeacherAiMetricsDto.StudentReviewCount` (faqat SON — UI'ga chiqadi, matn emas);
    `TeacherAiNarrativeDto.OquvchilarFikri` — AI ajratgan TAKRORLANUVCHI naqshlar.
    Prompt AI'ga bu fikrlarni `kuchli`/`zaif`/`tavsiyalar` ro'yxatlarida ham hisobga olishni buyuradi.
  • **KO'RINISHI:** o'qituvchi profili → «AI tahlil» tabida (1) yangi **«Tahlillar»** kartochkasi —
    tahlillar TARIXI sana + umumiy ball bilan, **eng yangisi tepada**, qatorni bosib o'shanisi
    ochiladi (ilgari oddiy `<select>` edi, tarix ko'rinmasdi); (2) «O'quvchilar fikri asosida»
    binafsha bloki + nechta fikr asosida ekani. PDF eksportga ham qo'shilgan.
  • Flutter O'QITUVCHI ilovasida AI tahlil ekrani UMUMAN yo'q — u yerga hech narsa qo'shilmaydi
    (va qo'shilmasligi ham kerak: xom fikrlar o'qituvchiga ko'rinmaydi).

- **GURUH TAHLILI — ma'lumot manbalari** (`GroupSnapshotBuilder`, oxirgi 12 oy; hammasi MAVJUD
  yagona manbalardan, yangi hisoblash mantig'i yaratilmaydi):
  - **a'zolik oqimi** — `StudentGroup` sanalari + `MembershipLifecycle.Tally`;
  - **ketish/muzlatish sabablari** — `AuditLog` (`EntityType="Membership"`, `EntityId` shu guruh bilan
    boshlanadi, summary ichida `— sabab: X`) + `ArchivedRecord.Reason`;
  - **davomat** — jurnal "Davomat" tabi bilan AYNAN bir xil qoida: o'tilgan darslar a'zolik oynasi
    ichida (`JournalService.MemberStart` .. muzlatilgan/chiqqan sana), qoldirgan = sababli belgi
    (`AbsenceReason.IsLate` MUSTASNO);
  - **jurnal intizomi** — `SalaryJournalStats` (reja/o'tilgan/`MissedDates`) + `LessonNote`
    (mavzu/uy vazifa/`AttendanceTaken`);
  - **o'zlashtirish** — `JournalEntry` baholari/uy vazifa/xulq, `StudentBallService.ComputeAsync`,
    `CurriculumForecast.BuildGroupAsync` (dastur qamrovi va tugash prognozi);
  - **imtihonlar** — `TestResult`/`TestScore` (onlayn/oflayn, o'rtacha foiz, topshirmaganlar);
  - **to'lovlar** — `CourseFinanceReport.BuildGroupPaymentsAsync` (hisoblangan/yig'ilgan/qarz/
    to'lamaganlar) + oyma-oy `MonthlyCharge`/`FinanceTransaction`.
  MOLIYA RUXSATI: `ClassesController.CanSeeFinance()` (admin/superadmin yoki "finance" ruxsatli
  xodim) — false bo'lsa to'lov raqamlari UMUMAN yig'ilmaydi (`FinanceIncluded=false`), AI promptida
  ham bo'lmaydi va panelda to'lov bloki ko'rinmaydi. Guruh sahifasidagi "To'lovlar" tabi bilan bir xil.
  PROMPT: guruh tahlili ATAYIN **TANQIDIY** — kamchilikni yumshatmasdan, har da'voni raqam bilan
  asoslab, muammoli o'quvchilarni ism bilan ko'rsatib yozadi.
