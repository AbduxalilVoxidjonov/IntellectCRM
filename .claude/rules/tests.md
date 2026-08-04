---
description: Test natijalari (oflayn — ball qo'lda), ONLAYN TEST (Telegram bot orqali PDF + avtomatik baholash) va TEST SERTIFIKATI (Word andoza → PDF).
paths:
  - "IntellectCRM.Application/Services/TestResultService.cs"
  - "IntellectCRM.Application/Services/TestCertificateService.cs"
  - "IntellectCRM.Application/Services/DocxToPdfConverter.cs"
  - "IntellectCRM.Application/Services/DocxTemplate.cs"
  - "IntellectCRM.Application/Services/OnlineTestBotService.cs"
  - "IntellectCRM.Application/Services/LevelTestService.cs"
  - "IntellectCRM.Server/Controllers/TestResultsController.cs"
  - "IntellectCRM.Server/Controllers/LevelTestsController.cs"
  - "IntellectCRM.Server/Controllers/PublicTestController.cs"
  - "IntellectCRM.Client/src/pages/admin/tests/**"
  - "IntellectCRM.Client/src/pages/admin/level-tests/**"
---

# Test natijalari qoidalari

- **Test natijalari** (migratsiya `AddTestResults`): o'qituvchi o'quvchilardan olgan testlar ballarini
  kiritadi. Entity: `TestResult`(GroupId, Name, Date, MaxScore, CreatedAt, CreatedBy) +
  `TestScore`(TestResultId, StudentId, Score) — per (test, o'quvchi) unikal, test o'chsa ballari FK
  CASCADE. Mantiq YAGONA: `TestResultService` (Application/Services) — `GroupsOverviewAsync` (barcha
  guruh + testlar soni), `ListForGroupAsync`, `CreateAsync/UpdateAsync/DeleteAsync`, `DetailAsync`
  (guruhning FAOL a'zolari `StudentGroup.IsActive` + ballari, **ball desc bo'yicha saralangan**, ball
  kiritilmaganlar oxirida Rank=0), `SetScoreAsync` (0..MaxScore ga clamp, null → tozalash, qaytadi:
  qayta saralangan tafsilot), `StudentResultsAsync` (o'quvchi profili uchun).
  Admin: `TestResultsController` (`api/admin/test-results`, AdminPerm "classes") — `/groups`,
  `?groupId=`, `POST/PUT/DELETE`, `/{id}` detail, `/{id}/scores`, `/student/{sid}`. O'qituvchi:
  `TeacherPortalController`da `test-results/*` (faqat `Group.TeacherId==me` — `OwnsGroup`/`GroupIdOfAsync`).
  Frontend: **admin** "O'quv bo'limi → Testlar natijalari" (`pages/admin/tests/`: `TestResultsPage`
  guruhlar gridi → `TestGroupPage` guruh testlari + yaratish modali → `TestDetailPage` o'quvchilar
  ballari, blur'da avto-saqlanadi va qayta saralanadi, TOP-3 medal), nav "O'quv bo'limi" ostida
  (perm 'classes'); **o'qituvchi** ilovasida pastki navigatsiyadagi "Test" tabi (`/teacher/tests`,
  `TeacherTestsPage` — guruh→test→ballar drill-down); **o'quvchi** admin profilida
  (`StudentDetailPage`) "Testlar natijalari" bo'limi (ball/maks + o'rin).

- **HAR ROLDA BIR XIL — YAGONA PANEL:** test ro'yxati/yaratish/tahrir/o'chirish har bir ilovada
  BITTA komponentda, u ikki joyda qayta ishlatiladi (nusxa YO'Q):
  • admin — `pages/admin/tests/GroupTestsPanel.tsx` (`GroupTestsPanel` + ichida `TestFormModal`):
    `TestGroupPage` va guruh (jurnal) sahifasidagi "Imtihonlar" tabi (`ClassDetailPage`);
  • o'qituvchi — `pages/teacher/tests/TeacherGroupTestsPanel.tsx` (`TeacherGroupTestsPanel` +
    `TeacherTestFormModal`): `TeacherTestsPage` va jurnal sahifasidagi "Imtihonlar" tabi
    (`TeacherGroupDetailPage`).
  Ya'ni **jurnalning ichida ham onlayn/oflayn test yaratiladi** (avval u yerdagi forma faqat
  oflayn edi). Ruxsat: superadmin/admin cheklovsiz, xodim `classes` (`usePerm` + `[AdminPerm("classes")]`),
  o'qituvchi `journal` + `OwnsGroup` — hammasi bir xil `TestResultService`ga boradi.

- **ONLAYN TEST (bot orqali)** (migratsiya `AddOnlineTests`): test yaratishda rejim tanlanadi —
  **oflayn** (eski: ball qo'lda) yoki **onlayn**. Onlaynda `TestResult`da: `Mode="online"`, `PdfUrl`
  (savollar fayli) + `PdfFileId` (Telegram keshi), `QuestionCount`, `OptionCount` (A–D/A–E), `AnswerKey`
  ("ABCDA…"), `StartAt`/`EndAt` (javob qabul qilish oynasi); `MaxScore` = savollar soni (har savol 1
  ball). Javoblar `TestScore.Answers/SubmittedAt/Source="bot"` da — ya'ni **oddiy test natijalari bilan
  BIR JOYDA** (reyting/o'rtacha/profil o'zgarishsiz ishlaydi). Bot oqimi: `OnlineTestBotService` —
  «📝 Testni ishlash» reply tugmasi (kod olish ↔ adminga murojaat orasida), chatga bog'langan
  o'quvchining faol guruhlaridagi testlar → PDF → javob kiritish **2 usulda** (tugmalar bilan —
  `editMessageText` bilan joyida yangilanadigan varaqa; yoki bitta xabarda "abcda"/"1a 2b") →
  avtomatik tekshirish → natija (foiz/baho/o'rin). Bir marta topshiriladi; javob kaliti FAQAT vaqt
  tugagach ochiladi. Vaqtinchalik holat: `TestBotSession` (ChatId unikal).
  DIQQAT: `TestResultService.UpdateAsync`ga `Online` berilmasa rejim O'ZGARMAYDI (eski/qisqartirilgan
  forma onlayn testni oflaynga aylantirmasin).

- **TEST KODI + MARKAZDAN TASHQARI ISHTIROKCHILAR** (migratsiya `AddOnlineTestCodeAndExternalScores`):
  markazda O'QIMAYDIGAN odam ham onlayn testni ishlay oladi.
  • `TestResult.Code` — NOYOB test kodi (6 belgi, alifboda 0/O/1/I/L YO'Q — kodni odam qo'lda yozadi).
    Onlayn testda HAR DOIM bo'ladi: forma bo'sh yuborsa server o'zi yaratadi (`TestResultService.NewCodeAsync`),
    qo'lda kiritilsa `NormalizeCode` bilan tozalanadi (katta harf + faqat harf-raqam) va uniklik
    tekshiriladi. Uniklik DB indeksi bilan EMAS, servisda (oflayn testlarda kod bo'sh — filtrli
    unikal indeks provayderga bog'liq bo'lardi). Oflaynga o'girilsa kod BO'SHATILADI.
  • `TestResult.GroupOpen` — **"guruhga ham yaratilsinmi yoki faqat onlaynmi"**: `true` (standart) —
    guruh a'zolari botda/ilovada testni ro'yxatdan ko'radi VA tashqi odam kod bilan qo'shiladi;
    `false` — "FAQAT KOD": guruhga E'LON QILINMAYDI (`OnlineTestBotService.AvailableTestsAsync` va
    `OnlineTestService.ListForStudentAsync/DetailAsync/SubmitAsync` filtrlaydi), faqat kod bilan.
    Test HAR DOIM guruh ichida yaratiladi — natijalari o'sha guruh ichida ko'rinadi.
    ⚠️ Migratsiyada `GroupOpen` ustuni `defaultValue: true` (EF o'zi false qo'yardi) — aks holda
    barcha ESKI onlayn testlar o'quvchilar ro'yxatidan birdaniga yo'qolardi; mavjud onlayn
    testlarga kod ham SQL bilan backfill qilinadi.
  • `ExternalTestScore` (TestResultId, **ChatId**, FullName, Phone, Score, Answers, SubmittedAt) —
    tashqi ishtirokchi `Student` EMAS, shuning uchun bali `TestScore` ga (StudentId FK) yozilmaydi.
    Unikal kalit (TestResultId, ChatId) — bir chat bir marta topshiradi; test o'chsa FK CASCADE.
  • **BOT OQIMI:** «📝 Testni ishlash» → chat o'quvchiga bog'lanmagan bo'lsa DARHOL kod so'raladi
    (`BotUser.Mode="testcode"`), bog'langan bo'lsa ro'yxat + «🔑 Test kodi bilan kirish» tugmasi.
    Kod → `HandleCodeAsync`: chatda 1 o'quvchi bo'lsa uning nomidan boshlanadi, 2+ bo'lsa kim
    ishlashi so'raladi, 0 bo'lsa **F.I.Sh** so'raladi (`TestBotSession.Stage="name"` +
    `ExternalName`) va keyin odatdagi PDF → javob kiritish oqimi. `SubmitAsync` `StudentId` bo'sh
    bo'lsa `ExternalTestScore` ga yozadi (telefon `BotUser.Phone` dan). O'rin (rank) markazdagi va
    tashqi ballarni BIRGA sanaydi.
    MAJBURIY OBUNA bu yo'lda ham ishlaydi (`RequireSubscriptionAsync` — `/test` va `ocode` tugmasida).
    Klaviaturalar: «📝 Testni ishlash» endi `ContactKeyboard` va `GuestKeyboard` da ham bor
    (tashqi odam telefon ulashmasa ham testni ishlay olishi kerak).
  • **NATIJALAR IKKI RO'YXAT** (`TestResultService.DetailAsync`): `Rows` = **Markazdagilar** (guruhning
    faol a'zolari + kod bilan qo'shilgan BOSHQA guruh o'quvchilari — ular `Member=false`),
    `ExternalRows` = **Markazdan tashqari** (o'z ichida alohida saralanadi). UI: admin
    `TestDetailPage` va o'qituvchi `TeacherGroupTestsPanel` — ikkala ro'yxat sarlavha bilan; tashqi
    ballar QO'LDA tahrirlanmaydi (faqat botdan keladi). Ro'yxatda `GroupTestDto.ExternalCount`.
  • Formalar (`GroupTestsPanel` `TestFormModal` + `TeacherTestFormModal`): "Testni kimlar ishlaydi?"
    (Guruh + kod / Faqat kod bilan) va "Test kodi" (nusxalash tugmasi bilan) — IKKALASIDA bir xil.

- **ONLAYN TEST — O'QUVCHI ILOVASIDA** (`OnlineTestService`, Application/Services): bot bilan
  YAGONA mantiq — faol (muzlatilmagan) guruhlardagi `Mode="online"` testlar, oxirgi 7 kun oynasi,
  vaqt oynasi ichida BIR MARTA topshirish, natija o'sha `TestScore`ga (alohida jadval YO'Q).
  Manba: bot `Source="bot"`, ilova `Source="app"` — `OnlineTestService.IsStudentSubmission`
  ikkalasini "o'quvchi topshirdi" deb biladi (bot ham shu tekshiruvni ishlatadi), o'qituvchi
  qo'lda kiritgan ball (`Source=""`) topshirishni bloklamaydi.
  API: `GET/POST /api/student/online-tests[...]` (`StudentPortalController`). Javob kaliti FAQAT
  test vaqti tugagach qaytariladi. Ilova ekrani: `ilova/student/lib/screens/online_test_screen.dart`
  (PDF tepada + A/B/C tugmalari), "Test" tabidan ochiladi.
  **DIQQAT (gotcha):** ilova javoblarni POZITSIYA bo'yicha yuboradi ("A-C-D", `-` = javobsiz) —
  bunga `OnlineTestBotService.ParseAnswers` YARAMAYDI (u erkin matndan faqat harflarni yig'adi,
  `-` ni tashlab yuboradi → javoblar siljiydi). Shu sabab alohida `OnlineTestService.Normalize`.
  REJIM TANLASH TO'RTALA JOYDA HAM BOR (yuqoridagi ikkita YAGONA panel orqali): admin
  `TestFormModal` (`pages/admin/tests/GroupTestsPanel.tsx`) va o'qituvchi `TeacherTestFormModal`
  (`pages/teacher/tests/TeacherGroupTestsPanel.tsx`) — bir xil maydonlar va bir xil tekshiruvlar;
  admin PDF'ni `POST /api/admin/uploads` (admin/superadmin/staff — bo'lim ruxsati talab qilinmaydi),
  o'qituvchi esa `POST /api/teacher/test-results/uploads` orqali yuklaydi
  (ruxsat "journal" — topshiriqlar ruxsati shart emas). O'qituvchi test tafsilotida ham onlayn
  ma'lumot bloki bor (savollar soni, vaqt oynasi, PDF, javob kaliti — yopiq holatda, botdan yuborgan
  o'quvchilar soni) va har qatorda o'quvchining javoblari ko'rinadi.

## TEST SERTIFIKATI — Word andoza → PDF (migratsiya `AddTestCertificates`)

Test natijasi bo'yicha o'quvchiga sertifikat beriladi. Andoza — **Word (.docx)**, admin yuklaydi;
PDF ga o'girish **LibreOffice headless** orqali (ko'rinish AYNAN saqlanadi).

- **Entitylar:** `TestCertificateTemplate` (Name, FileUrl `/uploads/*.docx`, IsDefault, IsActive) va
  `TestCertificate` (kalit **(TestResultId, StudentId) UNIKAL** — bir test bo'yicha o'quvchiga bitta;
  Number `SRT-yyyy-NNNN`, DocxUrl, PdfUrl, Status, ball/foiz SNAPSHOT). `TestResult` ga
  `CertificateEnabled` (test formasidagi ptichka) + `CertificateTemplateId` qo'shildi.
  ⚠️ Bu mavjud `StudentCertificate` (kursni TUGATGANLIK, HTML) dan ALOHIDA: u yerda kalit
  (o'quvchi, kurs, sana) bo'lib, bir kunda ikkita test sertifikati to'qnashardi.
- **Tokenlar** — `TestCertificateService.Tokens` **yagona manba**: `@fish @guruh @kurs @oqituvchi
  @test @ball @maksball @foiz @orin @sana @bugun @raqam`. Admin paneli shu ro'yxatni
  `GET /api/admin/test-results/certificate-tokens` dan oladi (qo'lda takrorlanmaydi).
  Almashtirish `DocxTemplate` da — **shartnoma andozalari bilan bir xil kod** (ilgari
  `ContractService` ichida edi, ajratib olindi). Paragraf darajasida ishlaydi, chunki Word bitta
  so'zni bir nechta "run"ga bo'lib yozadi va oddiy `Replace` topa olmaydi.
- **Oqim:** test formasida ptichka + shablon tanlanadi → natijalar kiritiladi → **«Saqlash va
  sertifikat yaratish»** → `POST .../{testId}/certificates` ball kiritilgan HAR o'quvchiga bitta
  sertifikat yaratadi. **IDEMPOTENT**: qayta bosilsa mavjudlari YANGILANADI (ball o'zgargan
  bo'lishi mumkin), raqam saqlanadi, nusxa yaratilmaydi.
- **PDF bo'lmasa ham ishlaydi:** `DocxToPdfConverter` LibreOffice'ni topa olmasa `null` qaytaradi →
  sertifikat `Status="docx"` bilan faqat Word sifatida saqlanadi va UI amber ogohlantirish
  ko'rsatadi. **Server LibreOfficesiz ham ishlaydi — bu ataylab.**
  ⚠️ 1GB RAM: konvertatsiya ~150-200MB oladi, shuning uchun `SemaphoreSlim(1,1)` bilan NAVBAT
  bilan bajariladi. Docker image'ga `libreoffice-writer` + `fonts-liberation`/`fonts-dejavu`
  qo'shilgan (shriftsiz o'zbek harflari kvadratga aylanadi), `HOME=/tmp` shart.
- **Fayllar `ContentRootPath/uploads/certificates`** ga yoziladi — `wwwroot` ga EMAS. Sabab:
  `/uploads` Program.cs'da ContentRoot dan beriladi va docker volume + tungi zaxiraga kiradi;
  wwwroot esa har deployda qayta yoziladi (eski HTML sertifikatlardagi xato aynan shu).
- **API:** admin `api/admin/test-results` — `certificate-tokens`, `certificate-templates`
  (GET/POST/PUT/DELETE), `{id}/certificates` (POST yaratish / GET ro'yxat),
  `certificates/{id}/download?format=docx`, `{id}/certificates/download` (ZIP).
  O'qituvchi `api/teacher/test-results` — `certificate-templates` (faqat o'qish),
  `{id}/certificates` (POST), download + ZIP; hammasi `OwnsGroup` bilan darvozalangan.
  Andozalarni FAQAT admin boshqaradi, o'qituvchi tanlaydi.
- **UI:** admin `/admin/test-results/certificate-templates`
  («Testlar natijalari» sarlavhasidagi «Sertifikat shablonlari» tugmasi): shablonlar CRUD +
  bosilsa nusxalanadigan o'zgaruvchilar jadvali. Test tafsilotida (admin va o'qituvchi) har
  o'quvchi yonida `ball / maks · foiz`, pastda «Saqlash va sertifikat yaratish» va
  «Sertifikatlar» bo'limi (har biri uchun «Yuklab olish» + «Hammasini yuklab olish (ZIP)»).
- Shablon o'chirilmaydi, agar undan sertifikat berilgan bo'lsa — **nofaol** qilinadi (tarix buzilmasin).
