using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "BOG'LANISH KERAK" moduli — bosqichlar, natijalar va o'tish qoidalarining <b>YAGONA MANBASI</b>
/// (sof funksiyalar, testlangan: <c>ContactServiceTests</c>).
///
/// <para>Backend, navbat sahifasi va hisobotlar AYNAN shu kalitlarni ishlatadi. Frontenddagi
/// yorliqlar server javobidan (<c>GET /api/admin/contacts/meta</c>) keladi — u yerdagi ro'yxat
/// server javob bermasa ishlatiladigan ZAXIRA, yagona haqiqat manbai emas
/// (karyera modulidagi <c>careerLabels.ts</c> bilan bir xil konvensiya).</para>
/// </summary>
public static class ContactService
{
    /// <summary>Sabablar katalogidagi kategoriya kaliti (Sozlamalar → Sabablar).</summary>
    public const string ReasonCategory = "contact";

    /// <summary>Bosqich: kalit + yorliq + yakuniymi + rang (UI chiplari uchun).</summary>
    /// <param name="IsOpen">Ochiq (navbatda turadi) — yakuniy bosqichlar `false`.</param>
    public readonly record struct Status(string Key, string Label, bool IsOpen, string Color);

    /// <summary>Bosqichlar — UI'da SHU tartibda.</summary>
    public static readonly IReadOnlyList<Status> Statuses = new List<Status>
    {
        new(ContactStatuses.New,      "Bog'lanish kerak",   true,  "amber"),
        new(ContactStatuses.Callback, "Qayta qo'ng'iroq",   true,  "sky"),
        new(ContactStatuses.Done,     "Hal bo'ldi",         false, "emerald"),
        new(ContactStatuses.Failed,   "Bog'lanib bo'lmadi", false, "rose"),
    };

    /// <summary>OCHIQ bosqichlar — navbatda turadigan, ya'ni "hali ish bor" degani.</summary>
    public static readonly IReadOnlyList<string> OpenStatuses =
        new[] { ContactStatuses.New, ContactStatuses.Callback };

    /// <summary>Bitta bog'lanish urinishining natijasi.</summary>
    public readonly record struct Result(string Key, string Label, bool Reached);

    /// <summary>
    /// Natijalar. <c>Reached</c> — odam bilan HAQIQATAN gaplashildimi: kunlik hisobotdagi
    /// "nechta odam bilan bog'lanildi" AYNAN shu bo'yicha sanaladi (ko'tarmagan qo'ng'iroq
    /// "bog'lanildi" emas — aks holda hisobot urinishlar soni bilan aralashib ketardi).
    /// </summary>
    public static readonly IReadOnlyList<Result> Results = new List<Result>
    {
        new("answered",     "Javob berdi (gaplashildi)", true),
        new("no_answer",    "Ko'tarmadi",                false),
        new("busy",         "Band — keyin deydi",        false),
        new("wrong_number", "Raqam ishlamadi",           false),
        new("other",        "Boshqa",                    true),
    };

    public static bool IsValidStatus(string? key) => Statuses.Any(s => s.Key == key);
    public static bool IsValidResult(string? key) => Results.Any(r => r.Key == key);
    public static bool IsOpen(string? status) => OpenStatuses.Contains(status ?? "");

    /// <summary>Yorliq; noma'lum kalit uchun kalitning O'ZI qaytadi (bo'sh qator emas — tarix
    /// yozuvida "nima bo'lgani" baribir ko'rinib tursin).</summary>
    public static string StatusLabel(string? key)
    {
        foreach (var s in Statuses) if (s.Key == key) return s.Label;
        return key ?? "";
    }

    /// <inheritdoc cref="StatusLabel"/>
    public static string ResultLabel(string? key)
    {
        foreach (var r in Results) if (r.Key == key) return r.Label;
        return key ?? "";
    }

    /// <summary>Shu natijada odam bilan haqiqatan gaplashildimi (noma'lum kalit — yo'q).</summary>
    public static bool Reached(string? resultKey) =>
        Results.FirstOrDefault(r => r.Key == resultKey).Reached;

    /// <summary>
    /// MUDDATI O'TGANMI — qayta qo'ng'iroq sanasi bugundan oldin. Navbatda qizil bo'lib turadi
    /// va hisobotda alohida sanaladi.
    /// </summary>
    /// <param name="today">Bugungi kun ("yyyy-MM-dd") — <see cref="AppClock"/> dan uzatiladi
    /// (sof funksiya bo'lishi va testlanishi uchun ichkarida O'QILMAYDI).</param>
    public static bool IsOverdue(string? status, string? dueDate, string today) =>
        status == ContactStatuses.Callback
        && !string.IsNullOrEmpty(dueDate)
        && string.CompareOrdinal(dueDate, today) < 0;

    /// <summary>
    /// Bog'lanish urinishidan keyingi holat QABUL QILINADIMI.
    ///
    /// <para>Qoida: keyingi qadam sifatida faqat <c>callback</c> (qayta qo'ng'iroq),
    /// <c>done</c> (hal bo'ldi) yoki <c>failed</c> (bog'lanib bo'lmadi) tanlanadi.
    /// <c>new</c> ATAYIN taqiqlangan: bog'langandan keyin "hech narsa bo'lmagandek" boshiga
    /// qaytish navbatni cheksiz aylantirardi va hisobotda bosqich ko'rinmasdi — kerak bo'lsa
    /// bugungi sana bilan <c>callback</c> tanlanadi.</para>
    /// </summary>
    public static bool CanTransitionTo(string? next) =>
        next is ContactStatuses.Callback or ContactStatuses.Done or ContactStatuses.Failed;
}
