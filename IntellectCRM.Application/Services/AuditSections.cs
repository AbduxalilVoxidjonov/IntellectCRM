namespace IntellectCRM.Application.Services;

/// <summary>
/// O'ZGARISHLAR TARIXINI BO'LIMLARGA AJRATISH — <b>yagona manba</b> (sof funksiyalar, testlangan:
/// <c>AuditSectionsTests</c>).
///
/// <para><c>AuditLog.EntityType</c> texnik nom (masalan <c>"StudentDiscount"</c>), foydalanuvchi
/// esa BO'LIM ko'radi ("O'quvchilar"). Shu ikkisi orasidagi xarita AYNAN shu yerda — Sozlamalardagi
/// "O'zgarishlar tarixi" sahifasi ham, `GET /api/admin/audit?section=` filtri ham shundan oziqlanadi.</para>
///
/// <para>⚠️ TARIXIY NOMLAR ALDAMASIN: `EntityType` qiymatlari yillar davomida qayta ishlatilgan va
/// nomi bilan mazmuni har doim mos EMAS. Masalan <c>"StudentDiscount"</c> nafaqat chegirma, balki
/// o'quvchini arxivlash, login bloklash va qo'lda hisob tahriri uchun ham yozilgan; <c>"ClassFee"</c>
/// guruhni arxivlashda ham ishlatilgan; <c>"TeacherSalary"</c> o'qituvchi yozuvining o'zi
/// o'zgarganda ham yoziladi. Shuning uchun xarita nom bo'yicha emas, <b>o'sha yozuv qaysi bo'lim
/// sahifasida ko'rinishi kerakligi</b> bo'yicha tuzilgan.</para>
///
/// <para>Yangi `audit.Record(...)` chaqiruvi qo'shsangiz — `EntityType`ni shu yerga ham qo'shing,
/// aks holda yozuv "Boshqa" bo'limiga tushib qoladi (yo'qolmaydi, lekin filtrda topilmaydi).</para>
/// </summary>
public static class AuditSections
{
    /// <summary>Xaritaga tushmagan `EntityType` uchun zaxira bo'lim.</summary>
    public const string Other = "other";

    /// <summary>Bo'lim: kalit (ruxsat kaliti bilan bir xil) + ko'rinadigan nom.</summary>
    /// <param name="Key">Ruxsat/nav kaliti — `adminPermissions` dagi bilan AYNAN bir xil.</param>
    public readonly record struct Section(string Key, string Label);

    /// <summary>Bo'limlar — UI'da SHU tartibda ko'rsatiladi.</summary>
    public static readonly IReadOnlyList<Section> All = new List<Section>
    {
        new("students",  "O'quvchilar"),
        new("classes",   "Guruhlar"),
        new("teachers",  "O'qituvchilar"),
        new("schedule",  "Kurslar"),
        new("finance",   "Moliya"),
        new("leads",     "Lidlar"),
        new("books",     "Kitoblar sotuvi"),
        new("contracts", "Shartnomalar"),
        new("vacancies", "Vakansiyalar"),
        new("staff",     "Xodimlar"),
        new("settings",  "Sozlamalar"),
        new(Other,       "Boshqa"),
    };

    /// <summary>
    /// `EntityType` → bo'lim kaliti. Bir bo'limga bir nechta tur tushishi mumkin.
    /// </summary>
    private static readonly Dictionary<string, string> ByEntityType = new(StringComparer.Ordinal)
    {
        // --- O'quvchilar ---
        // "StudentDiscount" — chegirma, arxivlash/tiklash, login bloklash, qo'lda oylik tahriri.
        ["StudentDiscount"] = "students",
        ["Student"] = "students",

        // --- Guruhlar ---
        ["Group"] = "classes",
        // "Membership" — a'zolik hodisalari (qo'shish/aktivlashtirish/muzlatish/ko'chirish/chiqarish),
        // EntityId = "{groupId}:{studentId}".
        ["Membership"] = "classes",
        // "ClassFee" — guruh oyligi, guruh yaratish/tahrir/arxiv.
        ["ClassFee"] = "classes",

        // --- Kurslar ---
        ["Course"] = "schedule",

        // --- O'qituvchilar ---
        // "TeacherSalary" — maosh to'lovi VA o'qituvchi yozuvining o'zi (yaratish/tahrir/arxiv).
        ["TeacherSalary"] = "teachers",
        ["TeacherReview"] = "teachers",

        // --- Moliya ---
        ["FinanceTransaction"] = "finance",

        // --- Qolgan bo'limlar ---
        ["Lead"] = "leads",
        ["Book"] = "books",
        ["BookOrder"] = "books",
        ["Contract"] = "contracts",
        ["Vacancy"] = "vacancies",
        ["JobApplication"] = "vacancies",
        ["Staff"] = "staff",
        ["CenterMeta"] = "settings",
        ["CertificateTemplate"] = "settings",
    };

    /// <summary>Yozuv qaysi bo'limga tegishli (noma'lum tur → <see cref="Other"/>).</summary>
    public static string SectionOf(string? entityType) =>
        entityType is not null && ByEntityType.TryGetValue(entityType, out var s) ? s : Other;

    /// <summary>
    /// Bo'lim kalitiga tegishli `EntityType`lar. Noma'lum/bo'sh kalit uchun BO'SH ro'yxat qaytadi —
    /// chaqiruvchi bunda filtr qo'ymasligi kerak (aks holda "hech narsa" chiqib qolardi).
    /// <see cref="Other"/> uchun ham bo'sh: uni ro'yxat bilan emas, "xaritada yo'q" shartida
    /// filtrlash kerak (<see cref="KnownEntityTypes"/>).
    /// </summary>
    public static IReadOnlyList<string> EntityTypesOf(string? section) =>
        string.IsNullOrEmpty(section) || section == Other
            ? Array.Empty<string>()
            : ByEntityType.Where(kv => kv.Value == section).Select(kv => kv.Key).ToList();

    /// <summary>Xaritada BOR barcha turlar — "Boshqa" bo'limini (bularning teskarisi) yasash uchun.</summary>
    public static IReadOnlyList<string> KnownEntityTypes { get; } = ByEntityType.Keys.ToList();

    /// <summary>Bo'lim kaliti haqiqiymi (noma'lum kalit filtrga qo'yilmaydi).</summary>
    public static bool IsKnownSection(string? section) =>
        !string.IsNullOrEmpty(section) && All.Any(s => s.Key == section);
}
