namespace IntellectCRM.Application.Services;

/// <summary>
/// `/uploads` DARVOZASINING SOF QOIDALARI — HTTP/token kontekstisiz, shuning uchun testlanadi.
///
/// <para>Darvozaning o'zi <c>UploadsGuard</c> (Server) da: u tokenni tekshiradi va cookie qo'yadi.
/// Bu yerda esa faqat "qaysi manzil qamrovga kiradi" va "qaysi fayl OCHIQ qoladi" qarorlari —
/// aynan shu joyda xato qilinsa maxfiy fayl ochilib ketadi yoki login sahifasining logotipi
/// yo'qoladi, shuning uchun ular alohida testlanadi.</para>
/// </summary>
public static class UploadAccessRules
{
    /// <summary>Brauzerga qo'yiladigan cookie nomi (faqat <c>/uploads</c> yo'liga tegishli).</summary>
    public const string CookieName = "up_at";

    /// <summary>
    /// Manzildan FAYL NOMINI ajratadi (papkasiz). Solishtirish faqat nom bo'yicha bo'ladi, chunki
    /// `/uploads` — tekis papka va bazada manzil `/uploads/&lt;guid&gt;.png` ko'rinishida saqlanadi.
    /// </summary>
    public static string FileNameOf(string? urlOrPath)
    {
        if (string.IsNullOrWhiteSpace(urlOrPath)) return "";
        var s = urlOrPath.Trim();
        // So'rov qatori bo'lsa tashlanadi ("/uploads/a.png?v=2").
        var q = s.IndexOfAny(['?', '#']);
        if (q >= 0) s = s[..q];
        var slash = s.LastIndexOf('/');
        return slash >= 0 ? s[(slash + 1)..] : s;
    }

    /// <summary>
    /// Shu fayl LOGIN'SIZ berilishi kerakmi.
    ///
    /// <para>Yagona holat — markazning LOGOTIPI: u login sahifasida, PWA manifestida va ochiq
    /// vakansiya sahifasida ko'rsatiladi, ya'ni foydalanuvchi hali tizimga kirmagan paytda kerak.
    /// Ro'yxat bazadagi joriy logotip manzillaridan yig'iladi (<c>CenterMeta.LogoUrl</c>,
    /// <c>CareerAbout.LogoUrl</c>) — ya'ni "ochiq" deb faqat markaz O'ZI ommaviy ko'rsatayotgan
    /// fayl hisoblanadi, boshqa hech narsa emas.</para>
    /// </summary>
    public static bool IsPublicFile(string? path, IReadOnlyCollection<string>? publicFileNames)
    {
        if (publicFileNames is null || publicFileNames.Count == 0) return false;
        var name = FileNameOf(path);
        if (name.Length == 0) return false;
        foreach (var p in publicFileNames)
            if (string.Equals(p, name, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    /// <summary>
    /// Bazadagi manzillar ro'yxatidan ochiq fayl nomlari to'plamini yasaydi (bo'sh qiymatlar tashlanadi).
    /// </summary>
    public static HashSet<string> PublicNamesFrom(IEnumerable<string?> urls)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in urls)
        {
            var name = FileNameOf(u);
            if (name.Length > 0) set.Add(name);
        }
        return set;
    }
}
