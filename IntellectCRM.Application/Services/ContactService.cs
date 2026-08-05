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

    /* =========================================================================================
     *  JAVOBLAR TAHLILI ("javobi nima dedi" matnlari)
     * ====================================================================================== */

    /// <summary>
    /// MA'NOSIZ so'zlar — chastota tahlilida chiqarib tashlanadi.
    ///
    /// <para>Ro'yxat ATAYIN qisqa: faqat bog'lovchi/olmosh/yordamchi so'zlar. "to'lov", "dars",
    /// "kasal", "kerak" kabi so'zlar QOLADI — aynan ular hisobotning ma'nosi.</para>
    /// </summary>
    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "va", "bilan", "uchun", "ham", "lekin", "ammo", "yoki", "shu", "bu", "u", "o'sha",
        "men", "sen", "siz", "biz", "ular", "uni", "unga", "meni", "menga", "bizga", "sizga",
        "deb", "dedi", "deydi", "aytdi", "gapirdi", "javob", "berdi",
        "bo'ldi", "bo'lib", "bo'lgan", "bo'ladi", "edi", "emas", "yana", "endi",
        "qildi", "qilib", "qilish", "qilaman", "qiladi",
        "haqida", "ustida", "keyin", "oldin", "hozir", "juda", "faqat", "yaxshi",
        "bir", "ikki", "uch", "ha", "yo'q", "mumkin", "kelmadi", "kelaman",
        "the", "and", "for", "with",
    };

    /// <summary>Chastotaga kiradigan eng qisqa so'z (uzunligi shundan kichik so'z tashlab yuboriladi).</summary>
    private const int MinWordLength = 3;

    /// <summary>
    /// Javob matnlaridagi eng ko'p uchragan so'zlar.
    ///
    /// <para>Har matn ichida bir so'z bir necha marta kelsa ham BIR marta sanaladi — aks holda
    /// bitta uzun izoh butun hisobotni egallab olardi ("nechta javobda uchradi" degan savol
    /// "necha marta yozildi" dan foydaliroq).</para>
    ///
    /// <para>Apostroflar (' ʻ ’ `) BIR ko'rinishga keltiriladi: aks holda "to'lov" va "toʻlov"
    /// ikki xil so'z bo'lib sanalardi (matn turli klaviaturalardan kiritiladi).</para>
    /// </summary>
    public static List<(string Word, int Count)> TopWords(IEnumerable<string> texts, int take = 25)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var text in texts)
        {
            if (string.IsNullOrWhiteSpace(text)) continue;
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var word in Tokenize(text))
            {
                if (word.Length < MinWordLength || StopWords.Contains(word)) continue;
                if (!seen.Add(word)) continue;                      // bitta matnda bir marta
                counts[word] = counts.GetValueOrDefault(word) + 1;
            }
        }

        return counts
            .OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key, StringComparer.Ordinal)
            .Take(Math.Max(1, take))
            .Select(kv => (kv.Key, kv.Value))
            .ToList();
    }

    /// <summary>Matnni so'zlarga ajratadi: kichik harf, apostrof normallashtirilgan, tinish belgisisiz.</summary>
    public static IEnumerable<string> Tokenize(string text)
    {
        var buf = new System.Text.StringBuilder();
        foreach (var raw in text)
        {
            var ch = raw switch
            {
                'ʻ' or 'ʼ' or '’' or '‘' or '`' or '´' => '\'',
                _ => char.ToLowerInvariant(raw),
            };
            if (char.IsLetterOrDigit(ch) || ch == '\'') buf.Append(ch);
            else if (buf.Length > 0) { yield return Trim(buf); buf.Clear(); }
        }
        if (buf.Length > 0) yield return Trim(buf);
    }

    /// <summary>Chetidagi apostroflarni olib tashlaydi ("'kasal'" → "kasal").</summary>
    private static string Trim(System.Text.StringBuilder b) => b.ToString().Trim('\'');

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
