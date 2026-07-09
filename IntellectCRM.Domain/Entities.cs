namespace IntellectCRM.Domain;

// Frontend (IntellectCRM.Client/src/types/index.ts) dagi tiplarga mos keluvchi
// EF Core entity'lari. ID'lar string (frontend uid() — UUID ishlatadi),
// sanalar esa ISO ("YYYY-MM-DD") ko'rinishida string sifatida saqlanadi.

/// <summary>
/// Dars o'zlashtirish darajasi (mastery level) — o'qituvchi darsda o'quvchining
/// o'zlashtirish holati qaysi darajada ekanini belgilaydi.
/// </summary>
public enum MasteryLevel
{
    /// <summary>0 — reaktiv emas (o'rgani emas, tushunarli emas).</summary>
    NonReactive = 0,

    /// <summary>1 — reaktiv (o'rgani lekin yordam bilan).</summary>
    Reactive = 1,

    /// <summary>2 — faol (o'rgani va mustaqil ishlay oladi).</summary>
    Active = 2,

    /// <summary>3 — proaktiv (chuqur o'rgani va boshqalarga o'rgata oladi).</summary>
    ProActive = 3
}

/// <summary>Tizim foydalanuvchisi (autentifikatsiya uchun).</summary>
public class AppUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FullName { get; set; } = string.Empty;
    /// <summary>admin | teacher | student | parent</summary>
    public string Role { get; set; } = "admin";
    public string Email { get; set; } = string.Empty;
    /// <summary>Telefon raqami — admin/xodim Telegram botda ro'yxatdan o'tib (yangi lid) xabarnomalarini
    /// olishi uchun shu raqam bo'yicha moslashtiriladi. Bo'sh = botda moslab bo'lmaydi.</summary>
    public string Phone { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    /// <summary>
    /// Admin yaratgan/tiklagan dastlabki parol — OCHIQ matnda, FAQAT foydalanuvchi hali u bilan
    /// kirmaguncha. Superadmin'ga ko'rsatish/eksport uchun. Birinchi login'da yoki foydalanuvchi
    /// o'zi parolni o'zgartirsa null bo'ladi (faqat hash qoladi).
    /// </summary>
    public string? InitialPassword { get; set; }
    /// <summary>Birinchi muvaffaqiyatli login vaqti (ISO "yyyy-MM-ddTHH:mm:ss") — "ilova aktivlashtirilgan" sifatida ishlatiladi.</summary>
    public string? FirstLoginAt { get; set; }
    /// <summary>Oxirgi muvaffaqiyatli login vaqti — har kirilganda yangilanadi.</summary>
    public string? LastLoginAt { get; set; }
    /// <summary>Xodim (role="staff") lavozimi — Kassir/Administrator/... (faqat ko'rsatish uchun yorliq).</summary>
    public string Position { get; set; } = string.Empty;
    /// <summary>
    /// Xodimga ochiq admin bo'limlari (adminPermissions kalitlari). FAQAT role="staff" uchun ishlatiladi;
    /// admin/superadmin uchun bo'sh (ular hamma narsani ko'radi). EF Core 8 primitive collection (JSON).
    /// </summary>
    public List<string> Permissions { get; set; } = new();
}

/// <summary>O'quv markazi filiali — nomi, manzil, GPS joylashuv va radius (mobil geo-yo'qlama uchun).</summary>
public class Branch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    /// <summary>Ruxsat etilgan radius (metr) — shu doira ichida yo'qlama hisoblanadi.</summary>
    public int RadiusMeters { get; set; }
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>Tuman (hudud) — o'quvchi qaysi tumandan ekanini tanlash uchun. Sozlamalardan boshqariladi.
/// Ichida maktablar (<see cref="School"/>) bo'ladi.</summary>
public class District
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    /// <summary>Ko'rsatish tartibi.</summary>
    public int Order { get; set; }
}

/// <summary>Maktab — tumanga tegishli (raqami yoki nomi). O'quvchi tuman → maktabni tanlaydi.
/// Sozlamalardan har tuman ichida yaratiladi.</summary>
public class School
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Tegishli tuman (<see cref="District"/> id).</summary>
    public string DistrictId { get; set; } = string.Empty;
    /// <summary>Maktab raqami yoki nomi (masalan "1", "23-son maktab").</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Ko'rsatish tartibi (tuman ichida).</summary>
    public int Order { get; set; }
}

/// <summary>
/// AI tekshiruv yozuvi (Speaking yoki Writing). Bitta yozuv = bitta tekshiruv.
/// Writing: o'quvchi <see cref="InputText"/> yozadi → Gemini tahlil qiladi.
/// Speaking: o'quvchi gapiradi (ovoz <see cref="AudioUrl"/> saqlanadi) → Azure talaffuzni baholaydi
/// (<see cref="AzureJson"/>), tanilgan matn <see cref="RecognizedText"/>, so'ng Gemini tahlil qiladi.
/// Natija (diagramma/so'z tahlili) <see cref="AnalysisJson"/> da. Tarix saqlanadi.
/// </summary>
public class AiCheck
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    /// <summary>"speaking" | "writing".</summary>
    public string Type { get; set; } = "writing";
    /// <summary>Writing rejimi: "" (umumiy) | "ielts_task1" | "ielts_task2" — IELTS band bahosi uchun.</summary>
    public string TaskType { get; set; } = string.Empty;
    /// <summary>Mavzu/topshiriq (ixtiyoriy — o'quvchi yoki tizim bergan).</summary>
    public string Prompt { get; set; } = string.Empty;
    /// <summary>Writing: o'quvchi yozgan matn. Speaking: o'qish uchun berilgan matn (reference, ixtiyoriy).</summary>
    public string InputText { get; set; } = string.Empty;
    /// <summary>Speaking: nutqdan tanilgan matn (Azure recognized). Writing: bo'sh.</summary>
    public string RecognizedText { get; set; } = string.Empty;
    /// <summary>Speaking: saqlangan ovoz fayli ("/uploads/aicheck-...wav") — qayta eshitish uchun. Writing: bo'sh.</summary>
    public string AudioUrl { get; set; } = string.Empty;
    /// <summary>Umumiy ball (0-100).</summary>
    public double Score { get; set; }
    /// <summary>Speaking: Azure natijasi JSON (SpeakingResultDto). Writing: bo'sh.</summary>
    public string AzureJson { get; set; } = string.Empty;
    /// <summary>Gemini strukturali tahlil JSON (AiCheckAnalysisDto — diagramma/tuzatish/so'z tahlili).</summary>
    public string AnalysisJson { get; set; } = string.Empty;
    /// <summary>Ishlatilgan Gemini modeli.</summary>
    public string Model { get; set; } = string.Empty;
    /// <summary>Tekshiruv sanasi ("yyyy-MM-dd") — kunlik limit hisobi uchun.</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>
/// O'quvchining AI tekshiruvdan foydalanish ruxsati/cheklovi (per-o'quvchi). Yozuv bo'lmasa —
/// global standart kunlik limit (<see cref="CenterMeta"/>.AiCheckDailyLimit) ishlatiladi.
/// </summary>
public class StudentAiAccess
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    /// <summary>Kunlik limit (per-o'quvchi override). 0 = global standart ishlatiladi.</summary>
    public int DailyLimit { get; set; }
    /// <summary>Premium — cheksiz foydalanish (limit qo'llanmaydi).</summary>
    public bool IsPremium { get; set; }
    /// <summary>Bloklangan — AI tekshiruvdan umuman foydalana olmaydi.</summary>
    public bool IsBlocked { get; set; }
    public string UpdatedAt { get; set; } = string.Empty;
}

/// <summary>Ota-ona ilova orqali yuborgan taklif yoki shikoyat.</summary>
public class Feedback
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Yuborgan o'quvchi (ota-ona o'quvchi akkaunti orqali) id'si.</summary>
    public string StudentId { get; set; } = string.Empty;
    public string ParentName { get; set; } = string.Empty;
    /// <summary>suggestion | complaint</summary>
    public string Type { get; set; } = "suggestion";
    public string Text { get; set; } = string.Empty;
    /// <summary>Ixtiyoriy biriktirilgan rasm (kameradan) — "/uploads/...". Yo'q bo'lsa null.</summary>
    public string? ImageUrl { get; set; }
    /// <summary>Yuboruvchi roli: parent | teacher.</summary>
    public string SenderRole { get; set; } = "parent";
    /// <summary>Yuboruvchining ko'rsatiladigan ismi (ota-ona FISH yoki o'qituvchi FISH).</summary>
    public string SenderName { get; set; } = string.Empty;
    /// <summary>O'qituvchi yuborgan bo'lsa — uning id'si (parent bo'lsa null).</summary>
    public string? TeacherId { get; set; }
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>new | resolved</summary>
    public string Status { get; set; } = "new";
}

/// <summary>O'quvchi.</summary>
public class Student
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>To'liq FISH — saqlanadi (ko'rsatish, qidiruv, hisobotlar). Parts'dan join qilinadi.</summary>
    public string FullName { get; set; } = string.Empty;
    /// <summary>Familiya (alohida). FullName parts'dan join qilinadi.</summary>
    public string LastName { get; set; } = string.Empty;
    /// <summary>Ism (alohida).</summary>
    public string FirstName { get; set; } = string.Empty;
    /// <summary>Otasining ismi / Sharifi (alohida).</summary>
    public string MiddleName { get; set; } = string.Empty;
    public string BirthDate { get; set; } = string.Empty;
    /// <summary>O'quvchining rasmi (profil surati) manzili (`/uploads/...`). Ilova profilida ko'rinadi.</summary>
    public string? BirthCertificateUrl { get; set; }
    public string Address { get; set; } = string.Empty;
    /// <summary>male | female</summary>
    public string Gender { get; set; } = "male";
    /// <summary>O'quvchining o'z telefon raqami (lid formasiga mos).</summary>
    public string Phone { get; set; } = string.Empty;
    /// <summary>To'liq ota-ona FISH — ASOSIY kontakt (ota, bo'lmasa ona) dan to'ldiriladi. Ota-ona
    /// portali login (telefon), Telegram, e'lonlar shunga tayanadi — shuning uchun saqlanadi.</summary>
    public string ParentFullName { get; set; } = string.Empty;
    /// <summary>Ota-ona familiyasi (alohida).</summary>
    public string ParentLastName { get; set; } = string.Empty;
    /// <summary>Ota-ona ismi (alohida).</summary>
    public string ParentFirstName { get; set; } = string.Empty;
    /// <summary>Ota-ona otasining ismi / sharifi (alohida).</summary>
    public string ParentMiddleName { get; set; } = string.Empty;
    /// <summary>ASOSIY ota-ona telefoni (ota, bo'lmasa ona) — portal login/Telegram/e'lon uchun.</summary>
    public string ParentPhone { get; set; } = string.Empty;
    /// <summary>Otasi F.I.SH (lid formasiga mos).</summary>
    public string FatherFullName { get; set; } = string.Empty;
    /// <summary>Otasi telefon raqami.</summary>
    public string FatherPhone { get; set; } = string.Empty;
    /// <summary>Onasi F.I.SH.</summary>
    public string MotherFullName { get; set; } = string.Empty;
    /// <summary>Onasi telefon raqami.</summary>
    public string MotherPhone { get; set; } = string.Empty;
    /// <summary>Ota-onaning rasmi (profil surati) manzili (`/uploads/...`). Formadan olib tashlandi —
    /// eski yozuvlar uchun saqlanadi.</summary>
    public string? ParentPassportUrl { get; set; }
    public string ClassName { get; set; } = string.Empty;
    /// <summary>O'quvchi tegishli tuman (<see cref="District"/> id). Bo'sh = tanlanmagan.</summary>
    public string DistrictId { get; set; } = string.Empty;
    /// <summary>O'quvchi tegishli maktab (<see cref="School"/> id). Bo'sh = tanlanmagan.</summary>
    public string SchoolId { get; set; } = string.Empty;
    /// <summary>Tuman nomi (DB'ga yozilmaydi — ro'yxat/profil endpointida DistrictId'dan to'ldiriladi).</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string DistrictName { get; set; } = string.Empty;
    /// <summary>Maktab nomi/raqami (DB'ga yozilmaydi — SchoolId'dan to'ldiriladi).</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string SchoolName { get; set; } = string.Empty;
    /// <summary>O'quvchi FAOL a'zo bo'lgan barcha guruh nomlari (ro'yxat ko'rinishi uchun; DB'ga yozilmaydi —
    /// ro'yxat endpointida M2M a'zoliklardan to'ldiriladi).</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public List<string> Groups { get; set; } = new();
    /// <summary>Kursda FAOL — kamida bitta a'zoligi Status=="active" (sinov/muzlatilgan/guruhsiz emas).
    /// DB'ga yozilmaydi; ro'yxat endpointida M2M a'zoliklardan hisoblanadi.</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public bool Active { get; set; }
    /// <summary>Markazga kelgan (qabul) sanasi (ISO "YYYY-MM-DD"). Oylik to'lov shu oydan boshlanadi.</summary>
    public string EnrollmentDate { get; set; } = string.Empty;
    /// <summary>Balans (so'm): manfiy = qarzdor, 0 = qarzsiz, musbat = avans.</summary>
    public decimal Balance { get; set; }
    /// <summary>Shu o'quvchiga biriktirilgan tizim akkaunti (AppUser) id'si.</summary>
    public string? UserId { get; set; }
    /// <summary>
    /// Oylik to'lov chegirmasi — foiz (0..100). Avval shu foiz olib tashlanadi, keyin
    /// <see cref="DiscountAmount"/> ayriladi. Hisoblangan oylik 0 dan past bo'lmaydi.
    /// </summary>
    public int DiscountPct { get; set; }
    /// <summary>Oylik to'lov chegirmasi — aniq summa (so'm). Foizdan keyin ayriladi.</summary>
    public decimal DiscountAmount { get; set; }
    /// <summary>Chegirma sababi/izohi (admin uchun, ko'rsatish uchun saqlanadi).</summary>
    public string DiscountNote { get; set; } = string.Empty;
    /// <summary>Chegirma amal qilish boshlanish oyi ("yyyy-MM"). Bo'sh — cheklovsiz (boshidan).</summary>
    public string DiscountStartMonth { get; set; } = string.Empty;
    /// <summary>Chegirma amal qilish tugash oyi ("yyyy-MM"). Bo'sh — cheklovsiz (oxirigacha).
    /// Ikkala chegara bo'sh bo'lsa chegirma har doim qo'llanadi (orqaga moslik).</summary>
    public string DiscountEndMonth { get; set; } = string.Empty;
    /// <summary>Chegirma qaysi GURUHGA tegishli (Classes.Id). Null/bo'sh — BARCHA guruh hisoblariga
    /// (eski xatti-harakat). To'ldirilgan bo'lsa — faqat o'sha guruh hisobiga qo'llanadi
    /// (ko'p guruhli o'quvchida qaysi guruhga berilgani aniq bo'lishi uchun).</summary>
    public string? DiscountGroupId { get; set; }
    /// <summary>
    /// O'quvchi arxivga ko'chirilganmi (boshqa maktabga ketgan, o'qishdan chiqarilgan, ...).
    /// Arxivlangan o'quvchi faol ro'yxatdan yashirinadi, oylik to'lov hisoblanmaydi, login bloklanadi,
    /// lekin tarixiy ma'lumotlari (jurnal, davomat, to'lovlar) saqlanadi.
    /// </summary>
    public bool IsArchived { get; set; }
    /// <summary>Admin o'quvchi login'ini vaqtincha cheklagan — kira olmaydi, 'hali aktiv emas' xabari.</summary>
    public bool LoginBlocked { get; set; }
    /// <summary>Arxivga ko'chirilgan sana (ISO "YYYY-MM-DD").</summary>
    public string? ArchivedAt { get; set; }
    /// <summary>Arxivga ko'chirish sababi (admin kiritadi: "boshqa maktabga ketdi", ...).</summary>
    public string? ArchiveReason { get; set; }
    /// <summary>Guruh arxivlanishi tufayli arxivlangan bo'lsa true — guruh arxivdan chiqarilganda
    /// faqat shu o'quvchilar avtomatik qaytariladi (alohida arxivlanganlar tegilmaydi).</summary>
    public bool ArchivedWithClass { get; set; }
    /// <summary>O'quvchi uy joylashuvi — kenglik (latitude). Mobil ilovadan GPS orqali keladi.</summary>
    public double? Latitude { get; set; }
    /// <summary>O'quvchi uy joylashuvi — uzunlik (longitude).</summary>
    public double? Longitude { get; set; }
    /// <summary>Joylashuv manzili (reverse geocode'dan keladigan matn, ixtiyoriy).</summary>
    public string? LocationAddress { get; set; }
    /// <summary>Joylashuv oxirgi yangilangan vaqt (ISO).</summary>
    public string? LocationUpdatedAt { get; set; }
    /// <summary>Turniket/FaceID qurilmasidagi shaxs ID'si (personId/employeeNo). Turniket o'tish
    /// hodisalari shu ID orqali o'quvchiga bog'lanadi (kirgan/chiqqan vaqt). Bo'sh = moslanmagan.</summary>
    public string DeviceUserId { get; set; } = string.Empty;
}

/// <summary>O'qituvchi.</summary>
public class Teacher
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FullName { get; set; } = string.Empty;
    public string BirthDate { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Gender { get; set; } = "male";
    /// <summary>O'qituvchining rasmi (profil surati) manzili (`/uploads/...`).</summary>
    public string? PhotoUrl { get; set; }
    /// <summary>Telefon raqami — Telegram bot orqali ro'yxatdan o'tishda moslashtiriladi (shartnoma).</summary>
    public string Phone { get; set; } = string.Empty;
    /// <summary>Turniket/FaceID qurilmasidagi xodim ID'si (personId/employeeNo). Davomat hodisalari shu
    /// ID orqali o'qituvchiga bog'lanadi. Bo'sh = qurilmada moslashtirilmagan.</summary>
    public string DeviceUserId { get; set; } = string.Empty;
    /// <summary>Guruh rahbari bo'lsa biriktirilgan guruh nomi; aks holda bo'sh.</summary>
    public string HomeroomClass { get; set; } = string.Empty;
    /// <summary>Dars beradigan fanlar (Subject id'lari). EF Core 8 primitive collection.</summary>
    public List<string> SubjectIds { get; set; } = new();
    /// <summary>Maosh rejimi: "fixed" (qat'iy oylik summa — <see cref="Salary"/>) | "percent" (foizli —
    /// o'qituvchi o'tadigan guruh(lar) o'quvchilaridan SHU OYDA haqiqatan yig'ilgan to'lovning
    /// <see cref="SalaryPercent"/> foizi). Standart: "fixed".</summary>
    public string SalaryMode { get; set; } = "fixed";
    /// <summary>Qat'iy oylik ish haqi (so'm). <see cref="SalaryMode"/>=="fixed" da ishlatiladi (admin qo'lda kiritadi).</summary>
    public decimal Salary { get; set; }
    /// <summary>Foizli maosh ulushi (%). <see cref="SalaryMode"/>=="percent" da: o'qituvchi guruhlaridan shu oyda
    /// yig'ilgan to'lovning shu foizi maosh sifatida hisoblanadi. Masalan 40 → yig'ilganning 40%i.</summary>
    public decimal SalaryPercent { get; set; }
    /// <summary>O'qituvchi toifasi — bir soat dars narxini belgilaydi: "oliy" | "1" | "2" | "mutaxasis"
    /// (bo'sh = hali belgilanmagan, narxi 0). Soat narxlari CenterMeta'da toifa bo'yicha saqlanadi.</summary>
    public string Category { get; set; } = string.Empty;
    /// <summary>Ustama foizi (%). Oylik maoshga shu foiz qo'shiladi (0 = ustama yo'q). Masalan 50 → +50%.</summary>
    public decimal BonusPct { get; set; }
    /// <summary>
    /// Oylik qaysi oydan hisoblana boshlasin ("YYYY-MM"). ESKI maydon — endi <see cref="SalaryStartDate"/>
    /// ishlatiladi (to'liq sana). Zaxira sifatida qoldirilgan (SalaryStartDate bo'sh bo'lsa o'qiladi).
    /// </summary>
    public string SalaryStartMonth { get; set; } = string.Empty;
    /// <summary>
    /// Maosh qaysi KUNdan hisoblana boshlasin ("YYYY-MM-DD"). O'qituvchi oy o'rtasida kelsa — birinchi
    /// oy shu kundan oy oxirigacha QISMAN (haqiqiy darslar soni bo'yicha) hisoblanadi. Keyingi oylar to'liq.
    /// </summary>
    public string SalaryStartDate { get; set; } = string.Empty;
    /// <summary>Shu o'qituvchiga biriktirilgan tizim akkaunti (AppUser) id'si.</summary>
    public string? UserId { get; set; }
    /// <summary>
    /// O'qituvchi web panelida foydalana oladigan bo'limlar (TeacherPermissions kalitlari).
    /// Admin belgilaydi. Bo'sh = faqat Bosh sahifa. EF Core 8 primitive collection (JSON).
    /// </summary>
    public List<string> Permissions { get; set; } = new();

    /// <summary>SUPPORT o'qituvchimi — bo'sh vaqt slotlarini e'lon qiladi, o'quvchilar bron qiladi
    /// (qo'shimcha/yordam darslari). Admin O'qituvchi formasida belgilaydi. Bo'lim: "Ilova → Support".</summary>
    public bool IsSupport { get; set; }

    /// <summary>Arxivlanganmi (ishdan ketgan/to'xtatilgan). Faol ro'yxatdan yashiriladi, login bloklanadi.</summary>
    public bool IsArchived { get; set; }
    /// <summary>Arxivga olingan sana ("YYYY-MM-DD").</summary>
    public string? ArchivedAt { get; set; }
    /// <summary>Arxivga olish sababi.</summary>
    public string? ArchiveReason { get; set; }
}

/// <summary>
/// Support o'qituvchining bo'sh vaqt SLOTi + bron. Support slot e'lon qiladi (open); o'quvchi
/// uni bron qiladi (StudentId qo'yiladi, booked); support dars o'tgach mavzu/izoh yozib yopadi (done).
/// Bitta slot = bitta bron = bitta dars yozuvi (1:1).
/// </summary>
public class SupportSlot
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Support o'qituvchi (Teacher.Id, IsSupport=true).</summary>
    public string TeacherId { get; set; } = string.Empty;
    /// <summary>Sana "yyyy-MM-dd".</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Boshlanish vaqti "HH:mm".</summary>
    public string StartTime { get; set; } = string.Empty;
    /// <summary>Tugash vaqti "HH:mm".</summary>
    public string EndTime { get; set; } = string.Empty;
    /// <summary>Holat: "open" (bo'sh) | "booked" (bron qilingan) | "done" (dars o'tildi).</summary>
    public string Status { get; set; } = "open";
    /// <summary>Bron qilgan o'quvchi (Student.Id); null = hali bo'sh.</summary>
    public string? StudentId { get; set; }
    /// <summary>Bron qilingan vaqt (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string? BookedAt { get; set; }
    /// <summary>Dars mavzusi — support dars o'tgach yozadi.</summary>
    public string Topic { get; set; } = string.Empty;
    /// <summary>Dars izohi (nimalar bo'lgani) — support dars o'tgach yozadi.</summary>
    public string Notes { get; set; } = string.Empty;
    /// <summary>Slot yaratilgan vaqt (ISO).</summary>
    public string CreatedAt { get; set; } = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
}

/// <summary>Kurs (oldin "Fan"). Nom + oylik narx.</summary>
public class Subject
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    /// <summary>Kurs oylik narxi (so'm). Guruh shu kursga biriktirilganda guruh oyligi (MonthlyFee) shundan keladi.</summary>
    public decimal Price { get; set; }
    /// <summary>Bir dars uchun yaxlit narx (so'm). Qisman-oy aktivlashtirishda 12 tadan kam dars
    /// qolganda har bir dars uchun shu summa olinadi (oylik narxdan mustaqil). 0 = kiritilmagan
    /// (eski pro-rata formula ishlatiladi).</summary>
    public decimal LessonPrice { get; set; }
}

/// <summary>O'quv xonasi (auditoriya). Guruhlarga FK orqali bog'lanadi.</summary>
public class Room
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    /// <summary>Xona sig'imi (o'quvchilar soni). Default 30.</summary>
    public int Capacity { get; set; } = 30;
    /// <summary>Bino nomi yoki raqami (ixtiyoriy).</summary>
    public string? Building { get; set; }
    /// <summary>Xona joylashuvi/tavsifi (ixtiyoriy).</summary>
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>Guruh.</summary>
public class Group
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public int Grade { get; set; }
    /// <summary>uz | ru</summary>
    public string Language { get; set; } = "uz";
    public decimal MonthlyFee { get; set; }
    /// <summary>Xona nomi (matnli, eski — backward compat). Yangi guruhlarda RoomId ishlatiladi.</summary>
    public string? Room { get; set; }
    /// <summary>O'quv xonasi FK (Room.Id). Nullable — xona ko'rsatilmasa null.</summary>
    public string? RoomId { get; set; }
    /// <summary>Guruh holati: active (faol) | full (to'lgan) | archived (arxiv).</summary>
    public string Status { get; set; } = "active";
    /// <summary>Kurs boshlanish sanasi (ISO "YYYY-MM-DD"). Ixtiyoriy.</summary>
    public string? StartDate { get; set; }
    /// <summary>Kurs tugash sanasi (ISO "YYYY-MM-DD"). Ixtiyoriy.</summary>
    public string? EndDate { get; set; }
    /// <summary>O'quvchilar soni chegarasi (0 = cheksiz).</summary>
    public int Capacity { get; set; }
    /// <summary>Guruh arxivlangan (faol ro'yxatdan olib qo'yilgan). Arxivlanganda unga bog'langan
    /// o'quvchilar ham arxivlanadi; arxivdan chiqarilganda — qaytariladi.</summary>
    public bool IsArchived { get; set; }
    public string? ArchivedAt { get; set; }

    // ---------- Kurs / biriktirish (eski "Fan biriktirish" o'rnida — guruh yaratishda kiritiladi) ----------
    /// <summary>Guruh kursi (Subject id). Guruh oyligi (MonthlyFee) shu kurs narxidan keladi.</summary>
    public string CourseId { get; set; } = string.Empty;
    /// <summary>Biriktirilgan o'qituvchi (Teacher id).</summary>
    public string TeacherId { get; set; } = string.Empty;
    /// <summary>Izoh.</summary>
    public string Note { get; set; } = string.Empty;
    /// <summary>Dars kunlari (0=Dushanba ... 6=Yakshanba).</summary>
    public List<int> Days { get; set; } = new();
    /// <summary>Dars boshlanish vaqti "HH:mm".</summary>
    public string StartTime { get; set; } = string.Empty;
    /// <summary>Dars tugash vaqti "HH:mm".</summary>
    public string EndTime { get; set; } = string.Empty;

    // ---------- O'qituvchi maoshi (PER-GURUH) ----------
    /// <summary>
    /// Shu guruh uchun o'qituvchi maoshi qanday hisoblanadi: "" (sozlanmagan — o'qituvchining umumiy
    /// <see cref="Teacher.SalaryMode"/> sozlamasiga ergashadi) | "percent" (shu guruhdan yig'ilgan
    /// to'lovning <see cref="TeacherSalaryPercent"/> foizi) | "fixed" (shu guruh uchun qat'iy summa
    /// <see cref="TeacherSalaryFixed"/>). Bir o'qituvchining har guruhi alohida sozlanishi mumkin
    /// (masalan bir guruhi 40%, keyingisi 60% yoki qat'iy summa) — o'qituvchi oyligi guruhlar yig'indisi.
    /// </summary>
    public string TeacherSalaryMode { get; set; } = string.Empty;
    /// <summary>Shu guruh foizli bo'lsa — o'qituvchiga beriladigan ulush (%). Masalan 40 → guruhdan
    /// yig'ilganning 40%i. <see cref="TeacherSalaryMode"/>=="percent" da ishlatiladi.</summary>
    public decimal TeacherSalaryPercent { get; set; }
    /// <summary>Shu guruh qat'iy bo'lsa — o'qituvchiga shu guruh uchun beriladigan oylik qat'iy summa (so'm).
    /// <see cref="TeacherSalaryMode"/>=="fixed" da ishlatiladi.</summary>
    public decimal TeacherSalaryFixed { get; set; }
}

/// <summary>
/// O'quvchi ↔ Guruh a'zoligi (M2M). Bir o'quvchi bir vaqtda bir nechta guruhda bo'lishi mumkin.
/// JoinedAt — qo'shilish sanasi, LeftAt — chiqish sanasi (null = hozir ham a'zo).
/// </summary>
public class StudentGroup
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    public string GroupId { get; set; } = string.Empty;
    /// <summary>Guruhga qo'shilgan sana (ISO "YYYY-MM-DD").</summary>
    public string JoinedAt { get; set; } = string.Empty;
    /// <summary>Guruhdan chiqqan sana (ISO). null = hozir ham faol a'zo.</summary>
    public string? LeftAt { get; set; }
    /// <summary>Faol a'zomi (LeftAt null bo'lsa true).</summary>
    public bool IsActive { get; set; } = true;
    /// <summary>To'lov holati: "trial" (sinov — oylik hisoblanmaydi) | "active" (faol — oylik hisoblanadi)
    /// | "frozen" (muzlatilgan — to'xtatilgan). Yangi a'zo qo'shilganda "trial".</summary>
    public string Status { get; set; } = "trial";
    /// <summary>Aktivlashtirilgan sana (ISO "YYYY-MM-DD"). Birinchi (qisman) oy = (oylik narx ÷ shu oydagi
    /// jami dars) × shu sanadan oy oxirigacha qolgan darslar (guruh kunlari bo'yicha); keyingi oylar — to'liq.</summary>
    public string ActivatedAt { get; set; } = string.Empty;
    /// <summary>Muzlatilgan sana (ISO). Shu oydan boshlab oylik to'lov hisoblanmaydi. Bo'sh = muzlatilmagan.</summary>
    public string FrozenAt { get; set; } = string.Empty;
}

/// <summary>Lid (markazga qiziqqan).</summary>
public class Lead
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FullName { get; set; } = string.Empty;
    public string Gender { get; set; } = "male";
    public string BirthDate { get; set; } = string.Empty;
    /// <summary>O'quvchining o'z telefon raqami.</summary>
    public string Phone { get; set; } = string.Empty;
    /// <summary>Otasining F.I.SH.</summary>
    public string FatherFullName { get; set; } = string.Empty;
    /// <summary>Otasining telefon raqami.</summary>
    public string FatherPhone { get; set; } = string.Empty;
    /// <summary>Onasining F.I.SH.</summary>
    public string MotherFullName { get; set; } = string.Empty;
    /// <summary>Onasining telefon raqami.</summary>
    public string MotherPhone { get; set; } = string.Empty;
    public string? Note { get; set; }
    /// <summary>Manba: instagram | referral | sayt | telegram | walkin | other ...</summary>
    public string Source { get; set; } = string.Empty;
    /// <summary>Qiziqqan fani/yo'nalishi (matn yoki Subject id).</summary>
    public string InterestSubject { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string CreatedAt { get; set; } = string.Empty;
    /// <summary>O'quvchiga aylantirilgan bo'lsa — yaratilgan Student id'si (null = hali emas).</summary>
    public string? ConvertedStudentId { get; set; }
    /// <summary>Tegishli ustun (LeadStage) id'si.</summary>
    public string Stage { get; set; } = string.Empty;
}

/// <summary>Lid bosqichi (kanban ustuni).</summary>
public class LeadStage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    /// <summary>slate | blue | emerald | amber | violet | rose | cyan | orange</summary>
    public string Color { get; set; } = "slate";
    /// <summary>Ustunlar tartibi.</summary>
    public int Order { get; set; }
}

/// <summary>Lid hodisasi (tarix) — kim, qachon, nima qildi.</summary>
public class LeadEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string LeadId { get; set; } = string.Empty;
    /// <summary>Turi: note | stage | call | trial | convert | created.</summary>
    public string Type { get; set; } = "note";
    /// <summary>Izoh / tafsilot.</summary>
    public string Text { get; set; } = string.Empty;
    /// <summary>Bajargan foydalanuvchi ismi.</summary>
    public string ActorName { get; set; } = string.Empty;
    /// <summary>Vaqt (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>Lid uchun sinov darsi — guruh + sana; natija lid statusini yangilaydi.</summary>
public class TrialLesson
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string LeadId { get; set; } = string.Empty;
    /// <summary>Tayinlangan guruh (Group id'si).</summary>
    public string GroupId { get; set; } = string.Empty;
    /// <summary>Sinov darsi vaqti (ISO "yyyy-MM-ddTHH:mm").</summary>
    public string ScheduledAt { get; set; } = string.Empty;
    /// <summary>Natija: pending (kutilmoqda) | stayed (qoldi) | left (ketdi).</summary>
    public string Result { get; set; } = "pending";
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>Jurnal katagi — baho yoki davomat sababi.</summary>
public class JournalEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ClassId { get; set; } = string.Empty;
    public string SubjectId { get; set; } = string.Empty;
    public int Quarter { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    /// <summary>Dars raqami (1-10) — bir kunda bir fan bir necha marta bo'lsa farqlash uchun.</summary>
    public int Period { get; set; }
    public int? Grade { get; set; }
    public string? ReasonId { get; set; }
    /// <summary>Uyga vazifa bajarilishi: 0 = belgilanmagan, 1 = qildi, 2 = qilmadi.</summary>
    public int Homework { get; set; }
    /// <summary>Xulq: 0 = belgilanmagan, 1 = yaxshi, 2 = yomon.</summary>
    public int Behavior { get; set; }
    /// <summary>Shu darsni o'zlashtirish darajasi (MasteryLevel enum). null = belgilanmagan.
    /// EF Core database savni int sifatida saqlaydi va enum qiymatiga o'zgartiradi.</summary>
    public MasteryLevel? Mastery { get; set; }
}

/// <summary>Dars mavzusi va uyga vazifa (sana bo'yicha).</summary>
public class LessonNote
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ClassId { get; set; } = string.Empty;
    public string SubjectId { get; set; } = string.Empty;
    public int Quarter { get; set; }
    public string Date { get; set; } = string.Empty;
    /// <summary>Dars raqami (1-10) — bir kunda bir fan bir necha marta bo'lsa farqlash uchun.</summary>
    public int Period { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string? Homework { get; set; }
    /// <summary>Dars o'tildimi (ptichka). false = dars o'tilmadi.</summary>
    public bool Conducted { get; set; }
}

/// <summary>Davomat sababi (kelmaganlik turi).</summary>
public class AbsenceReason
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Short { get; set; } = string.Empty;
    /// <summary>
    /// "Kech keldi" turi — o'quvchi DARSDA QATNASHGAN, faqat kech kelgan. Bunday belgi yo'qlik
    /// (absence) sifatida hisoblanmaydi (davomat foiziga ta'sir qilmaydi) va unga BAHO ham qo'yса bo'ladi.
    /// </summary>
    public bool IsLate { get; set; }
    /// <summary>
    /// Intizomiy ball o'zgarishi — jurnalda shu sabab bilan davomat belgilansa, o'quvchining
    /// intizomiy balliga shu qiymat qo'shiladi (manfiy = jazo). 0 = ballga ta'sir qilmaydi (default).
    /// "Ball sabablar" bo'limida belgilanadi.
    /// </summary>
    public int Points { get; set; }
}

/// <summary>
/// Intizomiy ball sababi — nomi va ball o'zgarishi. Musbat = rag'bat (qo'shiladi),
/// manfiy = jazo (ayriladi). Masalan "Darsga kech qoldi" = −5, "Faol ishtirok" = +3.
/// </summary>
public class DisciplineReason
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    /// <summary>Ball o'zgarishi (musbat yoki manfiy).</summary>
    public int Points { get; set; }
}

/// <summary>
/// O'quvchiga qo'yilgan bitta intizomiy ball yozuvi. Har o'quvchi 100 balldan boshlaydi;
/// qoldi = 100 + barcha yozuvlar ballari yig'indisi.
/// </summary>
public class DisciplinePoint
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    public string ReasonId { get; set; } = string.Empty;
    /// <summary>Sabab nomi (nusxa — sabab keyin o'zgarsa/o'chsa ham tarix saqlanadi).</summary>
    public string ReasonName { get; set; } = string.Empty;
    /// <summary>Yozuv paytidagi ball (sababdan nusxa — sabab keyin o'zgarsa tarix saqlanadi).</summary>
    public int Points { get; set; }
    public string Note { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt (ISO).</summary>
    public string CreatedAt { get; set; } = string.Empty;
    /// <summary>Kim qo'ygani (admin F.I.SH yoki login).</summary>
    public string CreatedBy { get; set; } = string.Empty;
}

/// <summary>
/// O'quvchilarni baholash turi — admin xohlagancha qo'sha oladi (masalan "Og'zaki",
/// "Yozma", "Nazorat ishi", "Loyiha"). Hozircha faqat nom va izoh; baholash mantig'i keyin qo'shiladi.
/// </summary>
public class EvaluationType
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    /// <summary>Ixtiyoriy izoh.</summary>
    public string Description { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt (ISO) — tartiblash uchun.</summary>
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>
/// O'quvchiga bitta baholash turi bo'yicha bir oyda qo'yilgan baho (1-5). Har
/// (StudentId, EvaluationTypeId, Month) uchun yagona — "har oy bir marta" baholash.
/// </summary>
public class EvaluationGrade
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    public string EvaluationTypeId { get; set; } = string.Empty;
    /// <summary>
    /// Qaysi FAN bo'yicha baholangani — shu fan o'qituvchisi qo'yadi. "" (bo'sh) = umumiy
    /// (eski/admin fan ko'rsatmasdan qo'ygan). Har (Student, Subject, Type, Month) uchun yagona.
    /// </summary>
    public string SubjectId { get; set; } = string.Empty;
    /// <summary>Baho tegishli oy ("YYYY-MM"). Har oy uchun alohida baho.</summary>
    public string Month { get; set; } = string.Empty;
    /// <summary>Oy ichida qaysi haftada baholangani (1..5; 0 = butun oy tanlangan edi).</summary>
    public int Week { get; set; }
    /// <summary>Baho 1-5.</summary>
    public int Score { get; set; }
    /// <summary>Oxirgi yangilangan vaqt (ISO).</summary>
    public string UpdatedAt { get; set; } = string.Empty;
}

/// <summary>Baholash MEZONI (kriteriya) — qayta ishlatiladigan pul. Guruhlarga biriktiriladi
/// (har guruhga boshqa-boshqa mezonlar). O'quvchilar guruh ichida shu mezonlar bo'yicha baholanadi.</summary>
public class GradingCriterion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Baho shkalasi yuqori chegarasi (masalan 5 yoki 100).</summary>
    public int MaxScore { get; set; } = 5;
    public int Order { get; set; }
    /// <summary>Mezon egasi (Teacher.Id). Bo'sh (null) — eski/umumiy mezon. Bo'lsa — mezon FAQAT shu
    /// o'qituvchiga tegishli: uning guruhlariga biriktiriladi va ro'yxatda shu o'qituvchi ostida ko'rinadi.</summary>
    public string? TeacherId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>Mezonni GURUHGA biriktirish (M2M): qaysi guruhda qaysi mezonlar bo'yicha baholanadi.</summary>
public class GroupGradingCriterion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GroupId { get; set; } = string.Empty;
    public string CriterionId { get; set; } = string.Empty;
    public int Order { get; set; }
}

/// <summary>O'quvchining bir mezon bo'yicha HAR DARSGA belgisi (bajardi/bajarmadi) — guruh ichida.
/// Har (Group, Student, Criterion, Date) uchun yagona. Done=true bo'lsa "bajardi".</summary>
public class CriterionGrade
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GroupId { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string CriterionId { get; set; } = string.Empty;
    /// <summary>Dars sanasi ("yyyy-MM-dd").</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Bajardi (true) yoki yo'q (false).</summary>
    public bool Done { get; set; }
    public string UpdatedAt { get; set; } = string.Empty;
}

/// <summary>O'quvchiga oy uchun hisoblangan oylik to'lov (qarz yozuvi/tarix).</summary>
public class MonthlyCharge
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    /// <summary>QAYSI GURUH uchun hisoblangan (Group id). Per-guruh billing: har faol a'zolik uchun alohida
    /// hisob qatori. null = guruhsiz o'quvchi (eski ClassName narxi bo'yicha — orqaga moslik).</summary>
    public string? GroupId { get; set; }
    /// <summary>Oy ("YYYY-MM").</summary>
    public string Month { get; set; } = string.Empty;
    /// <summary>Hisoblangan TO'LIQ summa (o'sha paytdagi guruh oylik to'lovi). Chegirma ALOHIDA.</summary>
    public decimal Amount { get; set; }
    /// <summary>Shu oy uchun berilgan chegirma summasi (so'm). Haqiqiy to'lash kerak bo'lgan summa = Amount - Discount.</summary>
    public decimal Discount { get; set; }
    /// <summary>Hisoblangan sana (ISO "YYYY-MM-DD").</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Super admin qo'lda tahrirlagan — avtomatik qayta hisob (Update/kurs-narx) bu yozuvni O'ZGARTIRMAYDI.</summary>
    public bool Locked { get; set; }
}

/// <summary>Moliyaviy amal — kirim yoki chiqim.</summary>
public class FinanceTransaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Sana (ISO "YYYY-MM-DD").</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>income (kirim) | expense (chiqim)</summary>
    public string Direction { get; set; } = "income";
    /// <summary>Toifa: tuition, salary, utilities, supplies, rent, donation, other ...</summary>
    public string Category { get; set; } = "other";
    /// <summary>Summa (har doim musbat; yo'nalish belgini aniqlaydi).</summary>
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    /// <summary>Kassir qo'lda yozgan izoh (ixtiyoriy) — to'lov haqida qo'shimcha ma'lumot.</summary>
    public string? Comment { get; set; }
    /// <summary>O'quvchi to'lovi bo'lsa — tegishli o'quvchi id'si.</summary>
    public string? StudentId { get; set; }
    /// <summary>O'quvchi tuition to'lovi bo'lsa — QAYSI GURUH uchun to'langani (Group id). O'quvchi bir nechta
    /// guruhda o'qisa, to'lov kiritishda guruh tanlanadi; o'qituvchining foizli maoshi shu tegga tayanadi.
    /// null = teglanmagan (eski to'lov yoki bitta guruh — foiz hisobida narx nisbatida taqsimlanadi).</summary>
    public string? GroupId { get; set; }
    /// <summary>O'qituvchi maoshi bo'lsa — tegishli o'qituvchi id'si.</summary>
    public string? TeacherId { get; set; }
    /// <summary>Oylik to'lov bo'lsa — qaysi oy uchun ("YYYY-MM"). Boshqa amallar uchun null.</summary>
    public string? Month { get; set; }
    /// <summary>To'lov usuli (kirim/to'lov uchun): "cash" (Naqd) | "card" (Karta) | "bank" (Bank orqali).
    /// null = belgilanmagan (eski yozuvlar yoki chiqim).</summary>
    public string? Method { get; set; }
    /// <summary>Tranzaksiya yaratilgan vaqti (UTC) — idempotency check uchun (5s ichida dublikat).</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Mas'ul — to'lovni kiritgan admin/kassir F.I.Sh (chekda "Mas'ul" qatori uchun).</summary>
    public string? CreatedBy { get; set; }
}

/// <summary>O'qituvchining bir kunlik ish davomati.</summary>
public class TeacherAttendance
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TeacherId { get; set; } = string.Empty;
    /// <summary>Sana "yyyy-MM-dd".</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Holat: "present" (keldi) | "absent" (kelmadi) | "late" (kechikdi).</summary>
    public string Status { get; set; } = string.Empty;
    /// <summary>Izoh / sabab (ixtiyoriy).</summary>
    public string Note { get; set; } = string.Empty;
    /// <summary>Kelgan vaqti "HH:mm" (turniketdan birinchi KIRISH). Bo'sh = noma'lum.</summary>
    public string CheckIn { get; set; } = string.Empty;
    /// <summary>Ketgan vaqti "HH:mm" (turniketdan oxirgi CHIQISH). Bo'sh = noma'lum.</summary>
    public string CheckOut { get; set; } = string.Empty;
    /// <summary>Manba: "manual" (admin qo'lda) | "turnstile" (qurilmadan avtomatik). Sinxronlash
    /// "manual" yozuvlarni o'zgartirmaydi (admin qo'lda tuzatgan bo'lsa saqlanadi).</summary>
    public string Source { get; set; } = "manual";
}

/// <summary>Markaz kamerasi (IP/RTSP). Media-shlyuz (MediaMTX) orqali brauzerda jonli + playback.</summary>
public class Camera
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    /// <summary>Joylashuvi ("1-qavat koridor", "Hovli" ...).</summary>
    public string Location { get; set; } = string.Empty;
    /// <summary>Asosiy RTSP oqimi (login/parol bilan): rtsp://user:pass@ip:554/...</summary>
    public string RtspUrl { get; set; } = string.Empty;
    /// <summary>Past sifatli (sub) RTSP — grid (ko'p kamera) uchun. Bo'sh bo'lsa asosiy ishlatiladi.</summary>
    public string RtspSubUrl { get; set; } = string.Empty;
    /// <summary>Yozuv necha KUN saqlansin — undan eski yozuvlar shlyuz tomonidan avtomatik o'chiriladi.
    /// 0 = cheksiz (o'chirilmaydi).</summary>
    public int RetentionDays { get; set; } = 7;
    public bool IsActive { get; set; } = true;
    public string Note { get; set; } = string.Empty;
}

/// <summary>Turniket/FaceID qurilmasidan kelgan bitta o'tish hodisasi (xom log).</summary>
public class TurnstileEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Bog'langan o'qituvchi (DeviceUserId orqali topilgan). Topilmasa bo'sh.</summary>
    public string TeacherId { get; set; } = string.Empty;
    /// <summary>Qurilmadagi xodim ID'si.</summary>
    public string DeviceUserId { get; set; } = string.Empty;
    /// <summary>Hodisa vaqti (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string EventAt { get; set; } = string.Empty;
    /// <summary>Yo'nalish: "in" (kirish) | "out" (chiqish).</summary>
    public string Direction { get; set; } = "in";
    /// <summary>Qurilma nomi/manzili (qaysi eshik).</summary>
    public string DeviceName { get; set; } = string.Empty;
    /// <summary>Tizimga yozilgan vaqt (ISO).</summary>
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>Markaz umumiy holati va ma'lumotlari (bitta qator) — joriy o'quv yili + markaz profili.</summary>
public class CenterMeta
{
    // Bitta markaz — bitta CenterMeta qatori. Id unikal (Guid).
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Joriy o'quv yili, masalan "2025/2026".</summary>
    public string CurrentYear { get; set; } = string.Empty;
    /// <summary>Ko'p-guruh to'lov rejimi: aggregate (barcha faol guruhlar yig'indisi — bitta oylik hisob) |
    /// perGroup (kelajakda — har guruh uchun alohida). Default: aggregate.</summary>
    public string BillingMode { get; set; } = "aggregate";

    /* ---------- Jurnal boshqaruvi (tahrirlash siyosati) — admin "Guruhlar → Jurnal boshqaruvi" ---------- */

    /// <summary>Jurnalga kiritish oynasi: "free" — istalgan o'tgan sanaga (default) |
    /// "today" — faqat bugungi kun | "window" — faqat oxirgi <see cref="JournalRetroDays"/> kun.
    /// Kelajak sanalar HAR DOIM taqiqlangan (bu sozlamaga bog'liq emas).</summary>
    public string JournalEditMode { get; set; } = "free";
    /// <summary>"window" rejimida orqaga necha kungacha kiritish mumkin (1-90).</summary>
    public int JournalRetroDays { get; set; } = 3;
    /// <summary>true — baho/davomat faqat "o'tildi" (Conducted) deb belgilangan darsga qo'yiladi
    /// (avval davomat qilinadi, keyin baho). Ommaviy davomat bunga kirmaydi — u darsni o'zi "o'tildi" qiladi.</summary>
    public bool JournalConductedOnly { get; set; }
    /// <summary>true — yuqoridagi cheklovlar ADMIN jurnaliga ham qo'llanadi (default: faqat o'qituvchiga).</summary>
    public bool JournalApplyToAdmins { get; set; }

    /// <summary>Markaz nomi.</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Markaz logotipi (`/uploads/...`) — barcha foydalanuvchi ko'radigan joylarda (login,
    /// daraja testi, portal sarlavhalari) nom yonida ko'rsatiladi. Bo'sh bo'lsa standart ikona.</summary>
    public string LogoUrl { get; set; } = string.Empty;
    /// <summary>Direktor F.I.SH.</summary>
    public string Director { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    /// <summary>Telegram bot tokeni (BotFather'dan). Bo'sh bo'lsa bot ishlamaydi (e'lon yuborilmaydi).</summary>
    public string TelegramBotToken { get; set; } = string.Empty;
    /// <summary>Telegram bot foydalanuvchi nomi (@siz) — t.me havolasi va ro'yxat taklifi uchun.</summary>
    public string TelegramBotUsername { get; set; } = string.Empty;
    /// <summary>Telegram bot ko'rsatiladigan nomi (masalan "IntellectCRM Bot") — UI/ilovada ko'rsatish uchun.</summary>
    public string TelegramBotName { get; set; } = string.Empty;
    /// <summary>Markaz Telegram kanali (havola yoki @username) — o'quvchi/o'qituvchi ilovasida "kanalga o'tish".</summary>
    public string TelegramChannel { get; set; } = string.Empty;
    /// <summary>Bot orqali telefon ulashilganda o'quvchini QAYSI raqami bo'yicha qidirish: "parent" (default —
    /// Student.ParentPhone) yoki "student" (Student.Phone, o'quvchining o'zi raqami).</summary>
    public string TelegramPhoneMatchField { get; set; } = "parent";
    /// <summary>O'quvchi ilovasi APK fayli — Telegram bot ro'yxatdan o'tgan o'quvchiga yuboradi.
    /// Name = ko'rsatiladigan nom; Path = serverdagi nisbiy yo'l (uploads/...); FileId = Telegram
    /// keshlangan file_id (bir marta yuklangach qayta yuklamasdan yuboriladi, yangi APK yuklanganda bo'shatiladi).</summary>
    public string StudentApkName { get; set; } = string.Empty;
    public string StudentApkPath { get; set; } = string.Empty;
    public string StudentApkFileId { get; set; } = string.Empty;
    /// <summary>O'qituvchi ilovasi APK fayli (yuqoridagi kabi). Bo'sh bo'lsa o'quvchi APK'siga qaytadi.</summary>
    public string TeacherApkName { get; set; } = string.Empty;
    public string TeacherApkPath { get; set; } = string.Empty;
    public string TeacherApkFileId { get; set; } = string.Empty;
    /// <summary>
    /// Firebase service account (JSON, to'liq) — ilovaga push (FCM) yuborish uchun. Bo'sh bo'lsa
    /// push yuborilmaydi. Admin "Sozlamalar → Push (Firebase)" bo'limidan kiritadi.
    /// </summary>
    public string FcmServiceAccountJson { get; set; } = string.Empty;
    /// <summary>
    /// Firebase WEB app konfiguratsiyasi (JSON: apiKey, authDomain, projectId, messagingSenderId,
    /// appId). Web (PWA) push uchun — brauzer FCM token olishi uchun zarur. Firebase Console →
    /// Project Settings → General → Your apps → Web app config. Ommaviy (maxfiy emas).
    /// </summary>
    public string FcmWebConfigJson { get; set; } = string.Empty;
    /// <summary>
    /// Web Push (VAPID) ochiq kaliti — Firebase Console → Cloud Messaging → Web configuration →
    /// "Web Push certificates" (Key pair). Web (PWA) push uchun zarur.
    /// </summary>
    public string FcmVapidKey { get; set; } = string.Empty;

    /// <summary>Azure Speech (Cognitive Services) maxfiy kaliti — Speaking topshirig'i talaffuzni
    /// baholash uchun (Pronunciation Assessment). Bo'sh bo'lsa speaking baholanmaydi. Admin
    /// "Sozlamalar → Speaking (Azure)" bo'limidan kiritadi.</summary>
    public string AzureSpeechKey { get; set; } = string.Empty;
    /// <summary>Azure Speech resursi hududi (region), masalan "eastus", "westeurope".</summary>
    public string AzureSpeechRegion { get; set; } = string.Empty;

    /// <summary>Google Gemini API kaliti — o'quvchi profilini AI bilan tahlil qilish uchun
    /// ("AI Tahlil" tugmasi). Bo'sh bo'lsa tahlil ishlamaydi. Admin "Sozlamalar → AI Tahlil (Gemini)"
    /// bo'limidan kiritadi. Model env o'zgaruvchi GEMINI_MODEL dan olinadi (default gemini-3.1-flash-lite).</summary>
    public string GeminiApiKey { get; set; } = string.Empty;

    /// <summary>AI tekshiruv (Speaking/Writing) — o'quvchi uchun standart KUNLIK limit (necha marta).
    /// Per-o'quvchi <see cref="StudentAiAccess"/> override qiladi (premium = cheksiz). Default 3.</summary>
    public int AiCheckDailyLimit { get; set; } = 3;

    /// <summary>O'qituvchi maoshi hisoblashda toifa bo'yicha BIR SOAT dars narxi (so'm).
    /// Oylik maosh = haftalik darslar soni × 4 × shu narx. Admin "Dars jadvali → Oylik hisoblash"da kiritadi.</summary>
    public decimal SalaryRateOliy { get; set; }
    public decimal SalaryRate1 { get; set; }
    public decimal SalaryRate2 { get; set; }
    public decimal SalaryRateMutaxasis { get; set; }

    // ---------- Turniket / FaceID integratsiyasi (o'qituvchilar davomati avtomatik) ----------
    /// <summary>Integratsiya yoqilganmi.</summary>
    public bool TurnstileEnabled { get; set; }
    /// <summary>Qurilma turi/vendori: "hikvision" | "zkteco".</summary>
    public string TurnstileVendor { get; set; } = "hikvision";
    /// <summary>Qurilma manzili (IP yoki host), masalan "192.168.1.64".</summary>
    public string TurnstileHost { get; set; } = string.Empty;
    /// <summary>Qurilma porti (Hikvision ISAPI odatda 80).</summary>
    public int TurnstilePort { get; set; } = 80;
    public string TurnstileUsername { get; set; } = string.Empty;
    public string TurnstilePassword { get; set; } = string.Empty;
    /// <summary>Ish boshlanish vaqti "HH:mm" — kechikishni aniqlash uchun (dars jadvalidagi birinchi
    /// dars bilan birga, qaysi biri erta bo'lsa). Bo'sh bo'lsa faqat dars jadvali ishlatiladi.</summary>
    public string WorkStartTime { get; set; } = "08:30";
    /// <summary>Kechikishga yo'l qo'yiladigan daqiqalar (grace). Kelgan vaqt kutilgan + grace dan
    /// keyin bo'lsa — "kechikdi".</summary>
    public int LateGraceMinutes { get; set; } = 10;
    /// <summary>Oxirgi muvaffaqiyatli sinxronlash vaqti (ISO).</summary>
    public string TurnstileLastSync { get; set; } = string.Empty;

    // ---------- Kamera (videokuzatuv) integratsiyasi ----------
    /// <summary>Kamera kuzatuvi yoqilganmi.</summary>
    public bool CameraEnabled { get; set; }

    // ---------- Telegram backup ----------
    /// <summary>Telegram admin chat ID — backup faylini yuborish uchun. Faqat raqam (masalan 123456789).
    /// Bo'sh bo'lsa Telegram backup o'chiriladi.</summary>
    public string? TelegramAdminChatId { get; set; }
    /// <summary>Backup yuborish soati (UTC, 0-23). Default 21 (21:00 UTC = 02:00 Toshkent).</summary>
    public int BackupScheduleHour { get; set; } = 21;
    /// <summary>Backup yuborish daqiqasi (0-59). Default 0.</summary>
    public int BackupScheduleMinute { get; set; }
    /// <summary>Telegram backup yoqilganmi (default true).</summary>
    public bool TelegramBackupEnabled { get; set; } = true;
    /// <summary>Oxirgi muvaffaqiyatli Telegram backup yuborish vaqti (tracking uchun).</summary>
    public DateTime? TelegramBackupLastSentAt { get; set; }

    // ---------- Kunlik markaz AI tahlili ----------
    /// <summary>Kunlik avtomatik markaz AI tahlili yoqilganmi (default true). Yoqilgan va Gemini kaliti
    /// sozlangan bo'lsa, fon xizmati har kuni <see cref="AiDailyAnalysisHour"/> (Toshkent) da markazning
    /// bir kun oldingi/joriy oy ma'lumotlari asosida AI tahlil yaratadi (tushum prognozi, baholar
    /// dinamikasi, lidlar, ketganlar sabablari, tavsiyalar). Bosh sahifada "AI Tahlil" bo'limida.</summary>
    public bool AiDailyAnalysisEnabled { get; set; } = true;
    /// <summary>Kunlik AI tahlil soati (0-23, Toshkent). Default 8 (ertalab).</summary>
    public int AiDailyAnalysisHour { get; set; } = 8;

    // ---------- Eskiz.uz SMS shlyuzi ----------
    /// <summary>Eskiz kabinet email (login). Admin "Sozlamalar → SMS (Eskiz)"da kiritadi.</summary>
    public string EskizEmail { get; set; } = string.Empty;
    /// <summary>Eskiz kabinet paroli.</summary>
    public string EskizPassword { get; set; } = string.Empty;
    /// <summary>SMS jo'natuvchi nomi (sender) — tasdiqlangan nikname yoki test uchun "4546".</summary>
    public string EskizFrom { get; set; } = "4546";
    /// <summary>Eskiz Bearer tokeni (keshlangan; muddati ~30 kun). SMS yuborishda qayta login qilmaslik uchun.</summary>
    public string EskizToken { get; set; } = string.Empty;
    /// <summary>Eskiz token muddati (UTC) — shu vaqtdan oldin yangilanadi.</summary>
    public DateTime? EskizTokenExpiresAt { get; set; }
    /// <summary>To'lov cheki (termal kvitansiya) sozlamalari — JSON. Qaysi maydonlar ko'rinishi,
    /// sarlavha (logotip/nom), pastki izoh (footer), aloqa/QR. Bo'sh = standart shablon.</summary>
    public string CheckSettings { get; set; } = string.Empty;

    // ---------- Local SMS (CTI agent telefonining SIM-kartasidan) ----------
    /// <summary>Local SMS (Eskiz o'rniga agent telefonidan) yoqilganmi. Yoqilmagan bo'lsa provider
    /// tanlovi qanday bo'lishidan qat'i nazar Eskiz'ga tushadi.</summary>
    public bool LocalSmsEnabled { get; set; }
    /// <summary>Standart Local SMS agenti (CtiAgent.Id) — provider=local tanlanganda aniq agent
    /// ko'rsatilmasa (yoki avtomatik/fon xabarlarda) shu ishlatiladi.</summary>
    public string? LocalSmsDefaultAgentId { get; set; }
    /// <summary>Massaviy Local SMS yuborishda ikkita SMS orasidagi minimal kutish (soniya) — agent
    /// telefonini/operatorni haddan tashqari yuklamaslik uchun. 0 = kutishsiz (default).</summary>
    public int LocalSmsDelaySeconds { get; set; }
}

/// <summary>Avto-xabar qoidasi — hodisa (Trigger) yuz berganda tanlangan kanallar orqali
/// shablon asosida xabar yuboriladi. Admin "Xabarlar → Avto xabarlar"da boshqaradi.
/// Eski SmsTemplate+IsAuto (faqat SMS) va ReminderRule (faqat push+telegram) modellarini
/// BIRLASHTIRGAN yagona model — har qoida 3 kanalni (SMS/Push/Telegram) mustaqil yoqadi.</summary>
public class AutoMessageRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Trigger { get; set; } = string.Empty;   // AutoMessageTriggers katalogidan
    public string Name { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public bool SendSms { get; set; }
    public bool SendPush { get; set; }
    public bool SendTelegram { get; set; }
    /// <summary>SMS qaysi orqali yuborilsin: "eskiz" (default) | "local" (CTI agent telefonidan,
    /// CenterMeta.LocalSmsDefaultAgentId orqali — qoida avtomatik ishga tushgani uchun agent
    /// tanlanmaydi, doim standart agent ishlatiladi).</summary>
    public string SmsProvider { get; set; } = "eskiz";
    public string Audience { get; set; } = "parents";     // parents|students|teachers
    public string Template { get; set; } = string.Empty;  // {ism} {fish} kabi tokenlar bilan
    public int OffsetMinutes { get; set; } = 5;           // lesson_attendance uchun
    public string SendScope { get; set; } = "lesson_start"; // lesson_start|not_filled|all
    public string ScheduleType { get; set; } = "daily";   // daily|monthly (custom_schedule)
    public string ScheduleTime { get; set; } = "09:00";
    public int ScheduleDayOfMonth { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>
/// O'zgarishlar tarixi (audit) yozuvi. Moliyaga oid ma'lumot yaratilganda/tahrirlanganda/
/// o'chirilganda eski va yangi holat shu yerda saqlanadi — keyin "tarix" sifatida ko'riladi.
/// </summary>
public class AuditLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Ob'ekt turi: FinanceTransaction | TeacherSalary | ClassFee.</summary>
    public string EntityType { get; set; } = string.Empty;
    /// <summary>Tegishli yozuv id'si (amal/ o'qituvchi/ guruh id'si).</summary>
    public string EntityId { get; set; } = string.Empty;
    /// <summary>Amal: create | update | delete.</summary>
    public string Action { get; set; } = string.Empty;
    /// <summary>Vaqt (ISO "yyyy-MM-ddTHH:mm:ss").</summary>
    public string Timestamp { get; set; } = string.Empty;
    /// <summary>O'zgartirgan foydalanuvchi id'si (yo'q bo'lsa — tizim).</summary>
    public string? ActorId { get; set; }
    /// <summary>O'zgartirgan foydalanuvchi nomi (yoki "Tizim").</summary>
    public string? ActorName { get; set; }
    /// <summary>O'qiladigan o'zbekcha izoh.</summary>
    public string Summary { get; set; } = string.Empty;
    /// <summary>O'zgarishdan oldingi holat (JSON). create uchun null.</summary>
    public string? Before { get; set; }
    /// <summary>O'zgarishdan keyingi holat (JSON). delete uchun null.</summary>
    public string? After { get; set; }
    /// <summary>Tegishli o'quvchi (o'quvchi to'lovi bo'lsa) — joyida filtrlash uchun.</summary>
    public string? StudentId { get; set; }
    /// <summary>Tegishli o'qituvchi (maosh bo'lsa) — joyida filtrlash uchun.</summary>
    public string? TeacherId { get; set; }
}

/// <summary>
/// Guruh chati xabari. A'zolar: shu guruh o'quvchilari, shu guruhga dars beradigan
/// o'qituvchilar va admin. Chat guruh nomi (ClassName) bo'yicha guruhlanadi.
/// </summary>
public class ChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi guruh chati (guruh nomi, masalan "3-A").</summary>
    public string ClassName { get; set; } = string.Empty;
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    /// <summary>admin | teacher | student</summary>
    public string SenderRole { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>Guruh ota-onalariga Telegram bot orqali yuborilgan e'lon (bir tomonlama xabar).</summary>
public class Broadcast
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ClassName { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>Yuborish vaqtida shu guruhda Telegramda ro'yxatdan o'tgan ota-onalar soni.</summary>
    public int RecipientCount { get; set; }
    /// <summary>Telegram orqali muvaffaqiyatli yetkazilganlar soni.</summary>
    public int SentCount { get; set; }
}

/// <summary>Ilovaga (FCM push) yuborilgan bildirishnoma — tarix uchun.</summary>
public class PushMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qabul qiluvchi toifa yorlig'i (masalan "Ota-onalar — 9-A", "O'qituvchilar").</summary>
    public string Audience { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>Maqsadli qurilma tokenlari soni.</summary>
    public int RecipientCount { get; set; }
    /// <summary>Muvaffaqiyatli yuborilgan push soni.</summary>
    public int SentCount { get; set; }
}


/// <summary>
/// Ota-onaning Telegram ro'yxati — Telegram chatId o'quvchiga bog'lanadi (guruh o'quvchidan
/// kelib chiqadi). Ota-ona botga kontaktini ulashganda raqami o'quvchining ParentPhone'i
/// bilan solishtirilib yoziladi. Bitta ota-onaning bir nechta farzandi bo'lishi mumkin.
/// </summary>
public class TelegramRegistration
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Bog'langan o'quvchi id'si (ota-ona ro'yxati uchun). Xodim yozuvida bo'sh.</summary>
    public string StudentId { get; set; } = string.Empty;
    /// <summary>Bog'langan o'qituvchi id'si (xodim ro'yxati uchun). Ota-ona yozuvida null.</summary>
    public string? TeacherId { get; set; }
    /// <summary>Bog'langan tizim foydalanuvchisi (AppUser) id'si — ADMIN/xodim ro'yxati uchun
    /// (yangi lid xabarnomalarini olish). O'quvchi/o'qituvchi yozuvida null.</summary>
    public string? UserId { get; set; }
    /// <summary>Telegram chat (foydalanuvchi) id'si — bot shu manzilga e'lon yuboradi.</summary>
    public long ChatId { get; set; }
    /// <summary>Ulashgan foydalanuvchining Telegram ismi (ko'rsatish uchun).</summary>
    public string ParentName { get; set; } = string.Empty;
    /// <summary>Ulashilgan telefon raqami (faqat raqamlar — normallashtirilgan).</summary>
    public string Phone { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>
/// Telegram botda /start bosgan HAR BIR foydalanuvchi (admin support ro'yxati uchun). ChatId unikal.
/// "Adminga yozish" rejimida yuborgan matnlar BotSupportMessage sifatida saqlanadi.
/// </summary>
public class BotUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Telegram chat (foydalanuvchi) id'si — unikal.</summary>
    public long ChatId { get; set; }
    /// <summary>Telegram ismi (first + last).</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Telegram @username (bo'lsa).</summary>
    public string Username { get; set; } = string.Empty;
    /// <summary>Ulashilgan telefon (faqat raqamlar) — bo'lmasa bo'sh.</summary>
    public string Phone { get; set; } = string.Empty;
    /// <summary>Tizimdagi moslik yorlig'i (masalan "O'quvchi: Ali (ota-ona)" / "O'qituvchi: Vali" / "Admin").</summary>
    public string Linked { get; set; } = string.Empty;
    /// <summary>Rejim: "" (oddiy) | "support" (adminga murojaat — keyingi matnlar adminga ketadi).</summary>
    public string Mode { get; set; } = string.Empty;
    /// <summary>Birinchi /start vaqti (ISO).</summary>
    public string StartedAt { get; set; } = string.Empty;
    /// <summary>Oxirgi murojaat (foydalanuvchi xabari) vaqti (ISO) — ro'yxat tartiblanishi shunga tayanadi.</summary>
    public string? LastMessageAt { get; set; }
    /// <summary>Oxirgi murojaat matni (ro'yxatda ko'rsatish uchun qisqa preview).</summary>
    public string LastText { get; set; } = string.Empty;
    /// <summary>Admin o'qimagan murojaatlar soni (ro'yxatdagi qizil belgi).</summary>
    public int AdminUnread { get; set; }
}

/// <summary>
/// Bot QO'SHILGAN Telegram guruh(super-guruh)i — yangi lidlar shu yerga avtomatik yuboriladi.
/// Bot guruhga qo'shilganda (<c>my_chat_member</c> yangilanishi) yoziladi, chiqarilganda IsActive=false.
/// </summary>
public class TelegramGroup
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Guruh chat id'si (guruhlar uchun manfiy) — unikal.</summary>
    public long ChatId { get; set; }
    /// <summary>Guruh nomi (ko'rsatish uchun).</summary>
    public string Title { get; set; } = string.Empty;
    /// <summary>Bot hozir shu guruh a'zosimi — chiqarilsa false (xabar yuborilmaydi).</summary>
    public bool IsActive { get; set; } = true;
    public DateTime AddedAt { get; set; } = AppClock.Now;
}

/// <summary>Telegram bot foydalanuvchisi ↔ admin support yozishmasidagi bitta xabar.</summary>
public class BotSupportMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi bot foydalanuvchisi (BotUser.ChatId).</summary>
    public long ChatId { get; set; }
    /// <summary>true = foydalanuvchidan (murojaat), false = admindan (javob).</summary>
    public bool FromUser { get; set; }
    public string Text { get; set; } = string.Empty;
    /// <summary>Admin javobi bo'lsa — javob bergan adminning F.I.Sh.</summary>
    public string AdminName { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>
/// O'qituvchi yaratadigan topshiriq/test. Format: written | file | test | video. Bir nechta
/// guruhga beriladi (ClassIds). Materiallar (fayllar) va test savollari bog'liq jadvallarda.
/// </summary>
public class Assignment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Yaratgan o'qituvchining AppUser id'si.</summary>
    public string CreatedByUserId { get; set; } = string.Empty;
    public string SubjectId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Topshiriq turi (formati): written | file | test | video.</summary>
    public string Format { get; set; } = "written";
    /// <summary>Beriladigan guruhlar (Class id'lari).</summary>
    public List<string> ClassIds { get; set; } = new();
    /// <summary>Boshlash vaqti (ISO "yyyy-MM-ddTHH:mm"), ixtiyoriy.</summary>
    public string? StartDate { get; set; }
    /// <summary>Tugash/topshirish muddati (ISO "yyyy-MM-ddTHH:mm"), ixtiyoriy.</summary>
    public string? DueDate { get; set; }
    /// <summary>Muddatdan keyin qabul qilinadimi.</summary>
    public bool LateAccept { get; set; }
    /// <summary>Kechikish jarimasi (% har kun uchun).</summary>
    public int LatePenaltyPct { get; set; }
    /// <summary>Maksimal ball.</summary>
    public int MaxScore { get; set; } = 100;
    /// <summary>Test uchun avto-baholash yoqilganmi.</summary>
    public bool AutoGrade { get; set; }
    /// <summary>Speaking topshirig'i uchun o'qiladigan matn (talaffuzni baholash shu matnga taqqoslanadi).
    /// Bo'sh bo'lsa erkin gapirish (unscripted) — to'liqlik balli bo'lmaydi.</summary>
    public string ReferenceText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;

    // Eski (oddiy topshiriq) ustunlari — orqaga moslik uchun saqlanadi, yangi forma ishlatmaydi.
    public string ClassId { get; set; } = string.Empty;
    public int Quarter { get; set; }
    public string? Date { get; set; }
    public int? Period { get; set; }
    public string? TypeId { get; set; }

    public List<AssignmentMaterial> Materials { get; set; } = new();
    public List<TestQuestion> Questions { get; set; } = new();
}

/// <summary>Topshiriqqa biriktirilgan material (serverga yuklangan fayl yoki havola).</summary>
public class AssignmentMaterial
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AssignmentId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>Fayl manzili (masalan "/uploads/xxx.pdf") yoki tashqi havola.</summary>
    public string Url { get; set; } = string.Empty;
    /// <summary>Fayl hajmi (bayt).</summary>
    public long Size { get; set; }
    public string ContentType { get; set; } = string.Empty;
    /// <summary>Ixtiyoriy hamrohlik audio (masalan o'qituvchi shu materialni ovoz chiqarib o'qigan
    /// yozuvi) — bo'lsa o'quvchi ekranida "Tinglash" pleyer chiqadi.</summary>
    public string? AudioUrl { get; set; }
}

/// <summary>Test (format=test) savoli — matn + variantlar + to'g'ri javob indeksi.</summary>
public class TestQuestion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AssignmentId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    /// <summary>Javob variantlari (EF Core 8 primitive collection).</summary>
    public List<string> Options { get; set; } = new();
    /// <summary>To'g'ri variant indeksi (Options ichida).</summary>
    public int CorrectIndex { get; set; }
    public int Order { get; set; }
}

/// <summary>
/// O'quvchining topshiriqni bajarish holati (kim bajardi/bajarmadi). Hozircha o'qituvchi qo'lda
/// belgilaydi; keyinroq mobil ilovada o'quvchi topshirsa shu yozuv to'ldiriladi.
/// </summary>
public class AssignmentSubmission
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AssignmentId { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    /// <summary>Bajarganmi (true=bajardi).</summary>
    public bool Completed { get; set; }
    /// <summary>Bajarilgan/topshirilgan vaqt (ISO), ixtiyoriy.</summary>
    public string? SubmittedAt { get; set; }
    /// <summary>Qo'yilgan ball (ixtiyoriy). Test uchun avto-hisoblanadi.</summary>
    public int? Score { get; set; }
    /// <summary>O'quvchi yozma javobi (format=written), ixtiyoriy.</summary>
    public string? AnswerText { get; set; }
    /// <summary>O'quvchi yuklagan fayl manzili (format=file/video/speaking audio), ixtiyoriy.</summary>
    public string? FileUrl { get; set; }
    /// <summary>Speaking baholash natijasi (JSON: tanilgan matn + accuracy/fluency/completeness/prosody/
    /// pronScore + per-word). Azure Pronunciation Assessment'dan keladi.</summary>
    public string? SpeakingResultJson { get; set; }
}

/// <summary>Qo'shimcha topshiriq turi (Uy vazifasi, Mustaqil ish, Test ...). Sozlamalarda boshqariladi.</summary>
public class AssignmentType
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Foydalanuvchining shaxsiy sozlamalari (asosan o'quvchi/o'qituvchi ilovasi uchun): til, tema,
/// bildirishnoma yoqilganmi. Har foydalanuvchi uchun bitta qator (UserId — PK).
/// </summary>
public class UserSettings
{
    /// <summary>AppUser.Id — birlamchi kalit (har foydalanuvchi uchun bitta yozuv).</summary>
    public string UserId { get; set; } = string.Empty;
    /// <summary>Ilova tili: uz | ru | en. Default "uz".</summary>
    public string Language { get; set; } = "uz";
    /// <summary>Tema: light | dark | system. Default "system".</summary>
    public string Theme { get; set; } = "system";
    /// <summary>Push bildirishnoma yoqilganmi.</summary>
    public bool NotificationsEnabled { get; set; } = true;
    /// <summary>Oxirgi yangilanish vaqti (UTC, ISO).</summary>
    public DateTime UpdatedAt { get; set; } = AppClock.Now;
}

/// <summary>
/// Mobil/desktop ilovaning push bildirishnoma uchun ro'yxatdan o'tgan qurilma tokeni
/// (FCM/APNs/WebPush). Bir foydalanuvchining bir nechta qurilmasi bo'lishi mumkin.
/// </summary>
public class DeviceToken
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    /// <summary>Push provayder tokeni (unique).</summary>
    public string Token { get; set; } = string.Empty;
    /// <summary>android | ios | web</summary>
    public string Platform { get; set; } = "android";
    /// <summary>Qurilma nomi (masalan "Samsung A52", "iPhone 13") — ilova yuboradi.</summary>
    public string DeviceName { get; set; } = string.Empty;
    /// <summary>Push provayder ilova identifikatori (app_id) — ilova yuboradi.</summary>
    public string AppId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    public DateTime LastSeenAt { get; set; } = AppClock.Now;
}

/// <summary>
/// Foydalanuvchiga (o'quvchi/o'qituvchi) yuborilgan bildirishnoma — ilovadagi "Bildirishnomalar"
/// tarixi uchun (push yetib bormasa ham saqlanadi). Har push yuborilganda yoziladi.
/// </summary>
public class UserNotification
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    /// <summary>grade | payment | announcement | pickup | general ...</summary>
    public string Type { get; set; } = "general";
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>O'qilgan vaqti (null = o'qilmagan) — qo'ng'iroq ochilganda.</summary>
    public DateTime? ReadAt { get; set; }
    /// <summary>Foydalanuvchi "Tasdiqlash" tugmasini bosgan vaqti (null = tasdiqlanmagan) — admin ko'radi.</summary>
    public DateTime? ConfirmedAt { get; set; }
    /// <summary>Admin e'loni (broadcast) bo'lsa — manba PushMessage id'si (tasdiqlarni shu broadcast'ga bog'lash uchun).</summary>
    public string PushMessageId { get; set; } = string.Empty;
}

/// <summary>
/// Shartnoma uchun yuklangan Word (.docx) andoza. Har target uchun (ota-ona / xodim) alohida.
/// Ichida `@` bilan boshlanuvchi o'rinbosarlar (masalan @fish) bo'ladi — yuborishda almashtiriladi.
/// </summary>
public class ContractTemplate
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>parent | staff</summary>
    public string Target { get; set; } = "parent";
    public string Name { get; set; } = string.Empty;
    /// <summary>Yuklangan fayl manzili ("/uploads/..."). Custom (matnli) andozada bo'sh.</summary>
    public string FileUrl { get; set; } = string.Empty;
    /// <summary>Asl fayl nomi (ko'rsatish uchun). Custom andozada bo'sh.</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Custom (matnli) andoza tanasi — @-o'rinbosarli matn. Bo'sh bo'lmasa,
    /// yuborishda shu matndan .docx hosil qilinadi (fayl o'rniga).</summary>
    public string Body { get; set; } = string.Empty;
    /// <summary>Foydalanuvchi aniqlagan qo'shimcha @-o'rinbosarlar (doimiy qiymat bilan) —
    /// JSON: [{"key":"@direktor","value":"Aliyev A."}]. Yuborishda built-in tokenlar bilan
    /// birga almashtiriladi (built-in token nomi ustun).</summary>
    public string FieldsJson { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = AppClock.Now;
}

/// <summary>Yuborilgan shartnoma yozuvi (kim, qachon, qaysi raqam bilan).</summary>
public class Contract
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>parent | staff</summary>
    public string Target { get; set; } = "parent";
    /// <summary>Oluvchi kaliti: ota-ona telefon kaliti (PhoneUtil.Key) yoki teacherId.</summary>
    public string RecipientKey { get; set; } = string.Empty;
    public string RecipientName { get; set; } = string.Empty;
    /// <summary>Ketma-ket shartnoma raqami.</summary>
    public int Number { get; set; }
    public string TemplateId { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = AppClock.Now;
    /// <summary>Telegram orqali muvaffaqiyatli yetkazildimi.</summary>
    public bool Delivered { get; set; }
    /// <summary>sent</summary>
    public string Status { get; set; } = "sent";
}

// ============================ DARAJA TESTI (placement/level test) ============================
// Admin kurs uchun common test yaratadi → ommaviy URL (`/test/{slug}`) shakllanadi → bo'lajak
// o'quvchi (anonim) kirib, ismi/telefoni bilan testni ishlaydi → ball/daraja hisoblanadi va
// CRM'da yangi LID bo'lib tushadi (Source="Daraja testi").

/// <summary>Daraja (level) testi — bitta kursga bog'langan ommaviy savol to'plami.</summary>
public class LevelTest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Test nomi (masalan "Ingliz tili daraja testi").</summary>
    public string Title { get; set; } = string.Empty;
    /// <summary>Bog'langan kurs (Subject id). Lid InterestSubject'i shu kurs bo'ladi. Ixtiyoriy.</summary>
    public string CourseId { get; set; } = string.Empty;
    /// <summary>Ommaviy URL uchun qisqa noyob token (`/test/{slug}`).</summary>
    public string Slug { get; set; } = string.Empty;
    /// <summary>Test boshида ko'rsatiladigan kirish matni / yo'riqnoma.</summary>
    public string Intro { get; set; } = string.Empty;
    /// <summary>Faolmi — faqat faol test ommaviy URL orqali ochiladi.</summary>
    public bool IsActive { get; set; } = true;
    public string CreatedAt { get; set; } = string.Empty;
}

/// <summary>Daraja testi savoli (ko'p variantli — bitta to'g'ri javob).</summary>
public class LevelTestQuestion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TestId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    /// <summary>Javob variantlari (EF Core 8 primitive collection).</summary>
    public List<string> Options { get; set; } = new();
    /// <summary>To'g'ri variant indeksi (Options ichida) — faqat Kind=="question" uchun.</summary>
    public int CorrectIndex { get; set; }
    /// <summary>Element turi: "question" (baholanadigan savol, to'g'ri javobli) yoki
    /// "survey" (so'rovnoma — checkbox, to'g'ri javobsiz, BAHOLANMAYDI, javob lidda saqlanadi).</summary>
    public string Kind { get; set; } = "question";
    /// <summary>So'rovnoma uchun: ko'p variant tanlash mumkinmi (checkbox). false = bitta (radio).</summary>
    public bool Multiple { get; set; }
    public int Order { get; set; }
}

/// <summary>
/// Amal sababi — turli amallar (muzlatish, o'chirish, sinovga qaytarish, lid/guruh o'chirish) bajarilganda
/// tanlanadigan sozlanadigan sabablar ro'yxati. Davomat (kelmaganlik) sababi alohida — <see cref="AbsenceReason"/>.
/// Kategoriya kalitlari: freeze | return_trial | remove_active | remove_trial | remove_frozen | lead_delete | group_delete.
/// </summary>
public class ActionReason
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Kategoriya kaliti (yuqoridagi ro'yxat).</summary>
    public string Category { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Order { get; set; }
}

/// <summary>
/// Arxiv yozuvi — o'chirilgan entity'ning JSON suratini (snapshot) saqlaydi. O'chirish
/// endpointlari entity'ni hard-delete qilishdan OLDIN bu yerga surat oladi, shu sababli
/// o'chirilgan Lid/O'quvchi/O'qituvchi/Xodim/Guruh/Moliya yozuvini keyinchalik ko'rish va
/// TIKLASH mumkin. <see cref="Type"/> ∈ {"lead","student","teacher","staff","group","finance"}.
/// </summary>
public class ArchivedRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Entity turi: lead | student | teacher | staff | group | finance.</summary>
    public string Type { get; set; } = string.Empty;
    /// <summary>Asl entity'ning Id'si.</summary>
    public string EntityId { get; set; } = string.Empty;
    /// <summary>Ko'rsatish uchun sarlavha (masalan F.I.SH yoki guruh nomi).</summary>
    public string Title { get; set; } = string.Empty;
    /// <summary>Ko'rsatish uchun ostsarlavha (masalan telefon yoki summa).</summary>
    public string Subtitle { get; set; } = string.Empty;
    /// <summary>Asl entity'ning to'liq JSON surati (tiklash uchun deserializatsiya qilinadi).</summary>
    public string Json { get; set; } = string.Empty;
    /// <summary>O'chirish sababi (ixtiyoriy).</summary>
    public string? Reason { get; set; }
    /// <summary>O'chirilgan vaqt (ISO, mahalliy Toshkent vaqti).</summary>
    public string DeletedAt { get; set; } = string.Empty;
    /// <summary>O'chirgan foydalanuvchi nomi.</summary>
    public string ActorName { get; set; } = string.Empty;
}

/// <summary>
/// Lidga yuborilgan BIR MARTALIK daraja-testi havolasi. Admin lid uchun "Daraja testi yuborish"
/// bosganida yaratiladi: noyob <see cref="Token"/> bilan URL (`/test/invite/{token}`) SMS orqali
/// yuboriladi. Lid o'z ma'lumotini qayta kiritmaydi (lidda bor). Bir marta ishlangach
/// (<see cref="UsedAt"/> to'ladi) havola yopiladi. Natija o'sha lidga bog'lanadi.
/// </summary>
public class LevelTestInvite
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>URL uchun noyob token (`/test/invite/{token}`).</summary>
    public string Token { get; set; } = Guid.NewGuid().ToString("N");
    public string TestId { get; set; } = string.Empty;
    public string LeadId { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    /// <summary>SMS holati: "sent" | "failed" | "" (hali yuborilmagan).</summary>
    public string SmsStatus { get; set; } = string.Empty;
    /// <summary>Eskiz RequestId (yetkazib berish holatini kuzatish uchun).</summary>
    public string SmsRequestId { get; set; } = string.Empty;
    /// <summary>Bir marta ishlatilgan vaqt (ISO). Bo'sh = hali ishlanmagan (qayta kirsa bo'ladi).</summary>
    public string UsedAt { get; set; } = string.Empty;
    /// <summary>Ishlangach yaratilgan topshiruv id'si.</summary>
    public string SubmissionId { get; set; } = string.Empty;
    /// <summary>Natija (stat uchun): ball foizi + daraja.</summary>
    public int Percent { get; set; }
    public string Level { get; set; } = string.Empty;
}

/// <summary>Daraja diapazoni — ball foiziga qarab daraja yorlig'i (masalan ≥75% → "Yuqori").</summary>
public class LevelTestBand
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TestId { get; set; } = string.Empty;
    /// <summary>Daraja nomi (masalan "Boshlang'ich", "O'rta", "Yuqori" yoki "A1", "B1"...).</summary>
    public string Label { get; set; } = string.Empty;
    /// <summary>Shu darajaga tushish uchun MINIMAL ball foizi (0..100).</summary>
    public int MinPercent { get; set; }
    public int Order { get; set; }
}

/// <summary>Daraja testi topshiruvi — kim ishladi, nechi ball, qaysi daraja, va yaratilgan lid.</summary>
public class LevelTestSubmission
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TestId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    /// <summary>Yoshi (ixtiyoriy, 0 = kiritilmagan).</summary>
    public int Age { get; set; }
    /// <summary>To'g'ri javoblar soni.</summary>
    public int Score { get; set; }
    /// <summary>Jami savollar soni.</summary>
    public int Total { get; set; }
    /// <summary>Ball foizi (0..100).</summary>
    public int Percent { get; set; }
    /// <summary>Aniqlangan daraja yorlig'i.</summary>
    public string Level { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    /// <summary>Shu topshiruvdan yaratilgan Lid id'si.</summary>
    public string LeadId { get; set; } = string.Empty;
    /// <summary>So'rovnoma (survey) javoblari JSON: [{"q":"savol matni","a":["tanlangan variant",...]}].
    /// Baholanmaydi — admin natijalarda va lidda ko'rsatish uchun.</summary>
    public string SurveyJson { get; set; } = string.Empty;
}


/// <summary>Kurs darajasi (sillabus 1-bosqich): kurs (Subject) ichidagi daraja, masalan "A1", "Boshlang'ich".</summary>
public class CourseLevel
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SubjectId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public int Order { get; set; }
}

/// <summary>Kurs mavzusi (sillabus 2-bosqich): daraja ichidagi mavzu.</summary>
public class CourseTopic
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SubjectId { get; set; } = string.Empty;
    public string LevelId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public int Order { get; set; }
}

/// <summary>Kurs bandi / DARS (sillabus 3-bosqich): mavzu ichidagi alohida o'rganiladigan dars.
/// Endi kontent ham olib yuradi: video/matn/audio/lug'at/test (rasm: Modul→Mavzu→Dars).</summary>
public class CourseItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SubjectId { get; set; } = string.Empty;
    public string TopicId { get; set; } = string.Empty;
    /// <summary>Dars nomi (sarlavha).</summary>
    public string Text { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public int Order { get; set; }
    /// <summary>Dars turi: text | video | audio | vocab | test | pdf. Default "text" (eski bandlar).</summary>
    public string Type { get; set; } = "text";
    /// <summary>Video havolasi (YouTube/mp4) yoki yuklangan fayl URL — "video" dars.</summary>
    public string VideoUrl { get; set; } = string.Empty;
    /// <summary>Audio havolasi/fayl — "audio" dars.</summary>
    public string AudioUrl { get; set; } = string.Empty;
    /// <summary>Matnli dars mazmuni (o'qish) yoki video/audio tavsifi.</summary>
    public string TextContent { get; set; } = string.Empty;
    /// <summary>Yuklangan PDF fayl URL (/uploads/...) — "pdf" bo'lim.</summary>
    public string PdfUrl { get; set; } = string.Empty;
    /// <summary>PDF faylning asl nomi (o'quvchiga ko'rsatiladi).</summary>
    public string PdfName { get; set; } = string.Empty;
    /// <summary>Lug'at ("vocab") — JSON: [{"term":"hello","meaning":"salom"}].</summary>
    public string VocabJson { get; set; } = string.Empty;
    /// <summary>Qisqa meta yorlig'i (masalan "12 daq"). Test/lug'atda avtomatik sanaladi.</summary>
    public string Meta { get; set; } = string.Empty;
}

/// <summary>Kurs darsidagi (CourseItem) test savoli: matn + variantlar + to'g'ri javob indeksi.</summary>
public class CourseQuestion
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ItemId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    /// <summary>Javob variantlari (EF Core 8 primitive collection).</summary>
    public List<string> Options { get; set; } = new();
    /// <summary>To'g'ri variant indeksi (Options ichida).</summary>
    public int CorrectIndex { get; set; }
    public int Order { get; set; }
}

/// <summary>O'quvchining bir sillabus bandi bo'yicha bajarilganlik holati (per-item progress).
/// CourseId — tracking qaysi kurs uchun (optional, for filtering progress by course).</summary>
public class CourseProgress
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    /// <summary>Qaysi kurs uchun band bajarilgani (Subject id). Optional — tracking uchun.
    /// Ixtiyoriy, bo'sh bo'lsa null; null qiymatga UNIQUE indeks qo'llanmaydi.</summary>
    public string? CourseId { get; set; }
    public bool Done { get; set; }
    public string UpdatedAt { get; set; } = string.Empty;
}

/// <summary>Guruh darajasida sillabus o'tilishi: o'tilgan band (ItemId, IsRevision=false) yoki
/// takrorlash darsi (ItemId="", IsRevision=true — sillabusni ilgarilatmaydi).</summary>
public class GroupCurriculumLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GroupId { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public bool IsRevision { get; set; }
    public string Date { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

// ============================ SERTIFIKAT ============================

/// <summary>
/// Sertifikat andozasi (HTML shablon): kurs bo'yicha o'quvchiga beriladigan
/// sertifikatning HTML shabloni. Tokenlar: {{student_name}}, {{course_name}},
/// {{issue_date}}, {{certificate_number}}, {{expires_date}}.
/// </summary>
public class CertificateTemplate
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Andoza nomi (admin ko'rishi uchun, masalan "Ingliz tili A1 sertifikat").</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Bog'langan kurs (Subject) id'si.</summary>
    public string CourseId { get; set; } = string.Empty;
    /// <summary>HTML shablon matni — @-o'rinbosarlar bilan (@fish, @kurs, @sana, @muddati, @kod).</summary>
    public string HtmlTemplate { get; set; } = string.Empty;
    /// <summary>Amal qilish muddati (kunlarda). 0 — muddatsiz.</summary>
    public int ValidityDays { get; set; }
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}


/// <summary>
/// Berilgan sertifikat (yangi model): o'quvchi + kurs + HTML fayl.
/// SHA-256 hash bilan himoyalangan. Status: active | revoked | expired.
/// </summary>
public class StudentCertificate
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Sertifikat berilgan o'quvchi.</summary>
    public string StudentId { get; set; } = string.Empty;
    /// <summary>Sertifikat kurs (Subject) id'si.</summary>
    public string CourseId { get; set; } = string.Empty;
    /// <summary>Fayl nomi (masalan "CERT-20260618-A1B2C3.html").</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Fayl yo'li — /uploads/certificates/... (server tomoni).</summary>
    public string FilePath { get; set; } = string.Empty;
    /// <summary>Fayl SHA-256 hash (hex) — hujjat butunligini tekshirish uchun.</summary>
    public string FileHash { get; set; } = string.Empty;
    /// <summary>Fayl hajmi (bayt).</summary>
    public long FileSize { get; set; }
    /// <summary>Sertifikat berilgan sana.</summary>
    public DateTime IssuedAt { get; set; } = AppClock.Now;
    /// <summary>Amal qilish muddati. Null — muddatsiz.</summary>
    public DateTime? ExpiresAt { get; set; }
    /// <summary>active | revoked | expired</summary>
    public string Status { get; set; } = "active";
    /// <summary>Bekor qilingan sana. Null — bekor qilinmagan.</summary>
    public DateTime? RevokedAt { get; set; }
    /// <summary>Bekor qilish sababi.</summary>
    public string? RevokeReason { get; set; }
    /// <summary>Qo'shimcha meta ma'lumotlar (JSON).</summary>
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>Birinchi yuklab olish vaqti.</summary>
    public DateTime? DownloadedAt { get; set; }
    /// <summary>Jami yuklab olishlar soni.</summary>
    public int DownloadCount { get; set; }
}

/// <summary>
/// O'quvchi AI tahlili (Gemini) — saqlanadigan yozuv. Bir o'quvchiga KUNIGA BIR MARTA
/// yaratiladi (Date bo'yicha cheklov). ResultJson — strukturali natija (matn bo'limlari +
/// baholar/diagramma uchun sonlar + oldingi tahlilga nisbatan o'zgarishlar). Tarix sifatida
/// o'quvchi sahifasida "AI Tahlil" bo'limida ko'rsatiladi; keyingi tahlil oldingisiga tayanadi.
/// </summary>
public class StudentAiAnalysis
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StudentId { get; set; } = string.Empty;
    /// <summary>Tahlil sanasi "yyyy-MM-dd" (Toshkent) — kuniga bir marta cheklovi shu bo'yicha.</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt ISO ("yyyy-MM-ddTHH:mm:ss", Toshkent).</summary>
    public string CreatedAt { get; set; } = AppClock.Iso();
    /// <summary>Ishlatilgan Gemini modeli.</summary>
    public string Model { get; set; } = string.Empty;
    /// <summary>Qisqa xulosa (umumiy holat) — ro'yxat ko'rinishi uchun.</summary>
    public string Summary { get; set; } = string.Empty;
    /// <summary>Umumiy ball (0-100) — tarix grafigi/badge uchun.</summary>
    public int OverallScore { get; set; }
    /// <summary>To'liq strukturali natija (JSON) — diagramma + matn bo'limlari.</summary>
    public string ResultJson { get; set; } = string.Empty;
}

/// <summary>
/// Markaz (butun o'quv markazi) AI tahlili (Gemini) — KUNIGA BIR MARTA (ertalab soat ~8da fon
/// xizmati orqali, yoki admin qo'lda). ResultJson — strukturali natija: AI narrativ (umumiy holat,
/// tushum tahlili, baholar dinamikasi, lidlar, ketganlar, xavflar, tavsiyalar) + deterministik
/// hisoblangan raqamlar (moliya prognozi, ko'rsatkichlar, diagramma nuqtalari). Bosh sahifada
/// "AI Tahlil" bo'limida ko'rsatiladi.
/// </summary>
public class CenterAiAnalysis
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Tahlil sanasi "yyyy-MM-dd" (Toshkent) — kuniga bir marta cheklovi shu bo'yicha.</summary>
    public string Date { get; set; } = string.Empty;
    /// <summary>Yaratilgan vaqt ISO (Toshkent).</summary>
    public string CreatedAt { get; set; } = AppClock.Iso();
    /// <summary>Ishlatilgan Gemini modeli.</summary>
    public string Model { get; set; } = string.Empty;
    /// <summary>Qisqa umumiy xulosa — ro'yxat/badge uchun.</summary>
    public string Summary { get; set; } = string.Empty;
    /// <summary>Markaz salomatligi (0-100) — tarix/badge uchun.</summary>
    public int Health { get; set; }
    /// <summary>To'liq strukturali natija (JSON): { ai, revenue, metrics }.</summary>
    public string ResultJson { get; set; } = string.Empty;
}

/// <summary>
/// SMS yuborish partiyasi (Xabarlar → SMS yuborish) — bitta yuborish (bir nechta raqamga).
/// Push/E'lon tarixiga o'xshash: kim/qachon/qancha. Har bir raqam yozuvi <see cref="SmsLog"/>da.
/// </summary>
public class SmsBatch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qabul qiluvchi guruh yorlig'i (masalan "Ota-onalar — 9-A", "O'qituvchilar").</summary>
    public string Audience { get; set; } = string.Empty;
    /// <summary>Yuborilgan matn (andoza — o'rinbosarlar bilan).</summary>
    public string Message { get; set; } = string.Empty;
    public string SenderUserId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    /// <summary>Jami oluvchilar (raqamlar) soni.</summary>
    public int RecipientCount { get; set; }
    /// <summary>Eskiz qabul qilgan (yuborishga ketgan) soni.</summary>
    public int SentCount { get; set; }
    /// <summary>Yuborish manbai: "eskiz" (default) | "local" (CTI agent telefonidan). Butun partiya
    /// bitta provider orqali yuboriladi (provider tanlovi bitta yuborish amalida bir marta qilinadi).</summary>
    public string Provider { get; set; } = "eskiz";
}

/// <summary>
/// SMS andozasi (shablon) — admin "Sozlamalar → SMS (Eskiz)"da yaratadi/tahrirlaydi. SMS yuborishda
/// (o'quvchi/ota-ona/lid) tanlanadi. Faqat QO'LDA yuborish uchun — avto-hodisalar
/// <see cref="AutoMessageRule"/>da. Matnda o'rinbosarlar: {fish} {sinf} {telefon}...
/// </summary>
public class SmsTemplate
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Andoza nomi (ko'rsatish uchun).</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Andoza matni (o'rinbosarlar bilan).</summary>
    public string Text { get; set; } = string.Empty;
    public int Order { get; set; }
    public string CreatedAt { get; set; } = AppClock.Iso();
}

/// <summary>
/// Yuborilgan bitta SMS jurnali (raqam bo'yicha). Eskiz qaytargan <c>RequestId</c> orqali yetkazib
/// berish holati (callback webhook) yangilanadi.
/// </summary>
public class SmsLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi partiyaga tegishli (ixtiyoriy — OTP/avto-SMS uchun null).</summary>
    public string? BatchId { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    /// <summary>Oluvchi nomi (ko'rsatish uchun — o'quvchi/ota-ona/o'qituvchi).</summary>
    public string RecipientName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    /// <summary>Eskiz qaytargan so'rov identifikatori (UUID) — callback shu bo'yicha topadi.</summary>
    public string RequestId { get; set; } = string.Empty;
    /// <summary>Holat: waiting | NEW | ACCEPTED | DELIVRD | UNDELIV | REJECTD | EXPIRED | error | ...
    /// (provider=local uchun granular yetkazish holati yo'q — "yuborildi"/"yetkazilmadi").</summary>
    public string Status { get; set; } = string.Empty;
    /// <summary>Yuborish manbai: "eskiz" (default) | "local" (CTI agent telefonidan).</summary>
    public string Provider { get; set; } = "eskiz";
    /// <summary>Provider=local bo'lsa — qaysi agent (CtiAgent.Id) orqali yuborilgani.</summary>
    public string? AgentId { get; set; }
    public DateTime CreatedAt { get; set; } = AppClock.Now;
    public DateTime UpdatedAt { get; set; } = AppClock.Now;
}

/// <summary>
/// Sertifikat tekshiruvi yozuvi: /verify/{id} so'rovida qoldiriladi.
/// IsValid: hash to'g'ri va status==active bo'lsa true.
/// </summary>
public class CertificateVerification
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Tekshirilgan StudentCertificate id'si.</summary>
    public string StudentCertificateId { get; set; } = string.Empty;
    public DateTime VerifiedAt { get; set; } = AppClock.Now;
    /// <summary>Tekshiruvchi IP manzili.</summary>
    public string VerifiedFrom { get; set; } = string.Empty;
    /// <summary>Sertifikat haqiqiy va amal qiladimi.</summary>
    public bool IsValid { get; set; }
    /// <summary>Hash to'g'ri tekshirilganmi (SHA-256 mos kelgan).</summary>
    public bool HashMatched { get; set; }
}

/// <summary>Xodim roli shabloni — standart roller (Qo'ng'iroq operatori, Kassir, Administrator).
/// Yangi xodim qo'shishda shablonni tanlab olsa, default ruxsatlari avtomatik belgilanadi.
/// Keyin qo'shimcha ruxsatlarni qo'shish mumkin.</summary>
public class StaffRoleTemplate
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Shablonning kodli nomi (system uchun): call_operator, cashier, administrator.</summary>
    public string Code { get; set; } = string.Empty;
    /// <summary>Ko'rsatiladigan nomi: "Qo'ng'iroq operatori", "Kassir", "Administrator".</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>Izoh (ixtiyoriy): "Qo'ng'iroq qabul qiladi va lidlarni boshqaradi" va h.k.</summary>
    public string Description { get; set; } = string.Empty;
    /// <summary>Default ruxsatlari (adminPermissions kalitlari)  — JSON massiv stringlar:
    /// ["leads","messages"] — yangi xodimga belgilanadi. Keyin qo'shimcha ruxsatlarni qo'shish mumkin.</summary>
    public List<string> DefaultPermissions { get; set; } = new();
    /// <summary>Yaratilgan vaqt — faqat info uchun.</summary>
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}


/// <summary>
/// Call Center qo'ng'irog'i (provayder telefoniya orqali). O'quvchi topilsa StudentId to'ladi
/// (qo'lda terilgan/notanish raqamda null). Operator = CRM foydalanuvchisi (Users).
/// AsteriskUniqueId — provayder hodisalarini (ringing/answer/finish) shu yozuvga bog'lash kaliti.
/// </summary>
public class Call
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Raqam o'quvchiga tegishli bo'lsa — Students.Id, aks holda null.</summary>
    public string? StudentId { get; set; }
    /// <summary>Qo'ng'iroqni boshlagan/qabul qilgan operator (Users.Id).</summary>
    public string? OperatorUserId { get; set; }
    /// <summary>Normallashtirilgan telefon raqam (+998...).</summary>
    public string PhoneNumber { get; set; } = string.Empty;
    /// <summary>"outbound" (chiquvchi) | "inbound" (kiruvchi).</summary>
    public string Direction { get; set; } = "outbound";
    /// <summary>originating | ringing | answered | completed | no_answer | busy | failed.</summary>
    public string Status { get; set; } = "originating";
    public DateTime StartedAt { get; set; } = AppClock.Now;
    public DateTime? AnsweredAt { get; set; }
    public DateTime? EndedAt { get; set; }
    /// <summary>Gaplashuv davomiyligi soniyada (javobdan tugashgacha; javobsiz — 0).</summary>
    public int DurationSeconds { get; set; }
    /// <summary>Provayder qo'ng'iroq id'si: MoiZvonki event_pbx_call_id —
    /// jonli hodisalarni shu yozuvga bog'lash kaliti. (Maydon nomi tarixiy sabab bilan qoldi.)</summary>
    public string AsteriskUniqueId { get; set; } = string.Empty;
    /// <summary>MoiZvonki db_call_id — calls.list sinxronizatsiyasida takrorlanmaslik kaliti
    /// (webhook call.finish ham to'ldiradi). Bo'sh — sinxron qilinmagan/boshqa provayder.</summary>
    public string ProviderDbId { get; set; } = string.Empty;
    /// <summary>Suhbatning SO'ZMA-SO'Z transkripti (Azure Speech, hech qanday moslashtirishsiz).
    /// Bo'sh — hali transkript qilinmagan ("Transkriptga o'girish" tugmasi bilan yaratiladi).</summary>
    public string Transcript { get; set; } = string.Empty;
    /// <summary>Transkript bo'yicha Gemini AI tahlili (operator nima deyishi mumkin edi, tavsiyalar).</summary>
    public string AiAnalysis { get; set; } = string.Empty;
    /// <summary>Suhbat yozuvi: provayder yozuv URL'i (MoiZvonki) yoki lokal fayl nomi. Bo'sh — yozuv yo'q.</summary>
    public string RecordingFile { get; set; } = string.Empty;
    /// <summary>Operator izohi (ixtiyoriy).</summary>
    public string Note { get; set; } = string.Empty;
}

/* ---------- CTI (Local Call) — Android agent-ilovalar bilan lokal call-center ---------- */

/// <summary>
/// CTI agent — xodim telefoniga o'rnatilgan Android ilova akkaunti (mavjud <see cref="AppUser"/>dan
/// alohida; login/parol shu yerda). Ilova qo'ng'iroq metadata+audio yuboradi, WebSocket orqali
/// serverdan <c>dial</c> buyrug'ini oladi. Oflaynda FCM push (data-message) bilan uyg'otiladi.
/// </summary>
public class CtiAgent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Ilovaga kirish logini (unikal).</summary>
    public string Login { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    /// <summary>Operator paneli va tarixda ko'rinadigan nom (masalan xodim ismi).</summary>
    public string DisplayName { get; set; } = string.Empty;
    /// <summary>Faol emas bo'lsa — login qila olmaydi (o'chirish o'rniga).</summary>
    public bool IsActive { get; set; } = true;
    /// <summary>Oflaynda uyg'otish uchun FCM qurilma tokeni (bo'sh — hali ro'yxatdan o'tmagan).</summary>
    public string FcmToken { get; set; } = string.Empty;
    /// <summary>Hozir WebSocket orqali ulanganmi (heartbeat/ulanish yangilaydi; jonli haqiqat
    /// konnektsiya menejeridan olinadi).</summary>
    public bool IsOnline { get; set; }
    /// <summary>Oxirgi faollik (heartbeat/presence).</summary>
    public DateTime? LastSeenAt { get; set; }
}

/// <summary>
/// CTI qo'ng'iroq yozuvi (Android ilovadan yuboriladi). Id = <c>serverCallId</c> (ilova audio va
/// hodisalarni shu bo'yicha yuklaydi). O'quvchi telefon bo'yicha topilsa <see cref="StudentId"/> to'ladi.
/// </summary>
public class CtiCallRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi agent (telefon) qildi/qabul qildi.</summary>
    public string AgentId { get; set; } = string.Empty;
    /// <summary>"incoming" (kiruvchi) | "outgoing" (chiquvchi) | "missed" (javobsiz).</summary>
    public string Direction { get; set; } = "outgoing";
    /// <summary>Suhbatdosh raqami (agent telefonidagi ikkinchi tomon).</summary>
    public string RemoteNumber { get; set; } = string.Empty;
    /// <summary>Ilovadagi kontakt nomi (bo'lsa).</summary>
    public string ContactName { get; set; } = string.Empty;
    /// <summary>Raqam o'quvchiga (yoki ota-onaga) tegishli bo'lsa — Students.Id; aks holda null.</summary>
    public string? StudentId { get; set; }
    public DateTime StartedAt { get; set; } = AppClock.Now;
    public DateTime? AnsweredAt { get; set; }
    public DateTime? EndedAt { get; set; }
    /// <summary>Gaplashuv davomiyligi soniyada.</summary>
    public int DurationSec { get; set; }
    /// <summary>Yozuv fayli — recordings papkasiga NISBIY fayl nomi (bo'sh — hali yuklanmagan).</summary>
    public string AudioPath { get; set; } = string.Empty;
    /// <summary>Audio serverga yuklanganmi.</summary>
    public bool AudioUploaded { get; set; }
    /// <summary>Operator izohi (admin paneldan).</summary>
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}

/// <summary>CTI qo'ng'irog'ining oraliq hodisasi (jonli holat tarixi). Qo'ng'iroq o'chsa — kaskad o'chadi.</summary>
public class CtiCallEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi qo'ng'iroqqa tegishli (CtiCallRecord.Id).</summary>
    public string CallId { get; set; } = string.Empty;
    /// <summary>"ringing" | "answered" | "ended".</summary>
    public string Type { get; set; } = string.Empty;
    public DateTime At { get; set; } = AppClock.Now;
}

/// <summary>Server→ilova yuborilgan buyruq jurnali (masalan click-to-call <c>dial</c>) va yetkazish holati.</summary>
public class CtiCommandLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    /// <summary>Qaysi agentga yuborildi.</summary>
    public string AgentId { get; set; } = string.Empty;
    /// <summary>Buyruq turi, masalan "dial".</summary>
    public string Action { get; set; } = string.Empty;
    /// <summary>Buyruq yuki (masalan teriladigan raqam).</summary>
    public string Payload { get; set; } = string.Empty;
    /// <summary>"pending" | "sent" | "acked" | "failed".</summary>
    public string Status { get; set; } = "pending";
    public DateTime CreatedAt { get; set; } = AppClock.Now;
}
