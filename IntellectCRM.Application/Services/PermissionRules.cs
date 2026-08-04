namespace IntellectCRM.Application.Services;

/// <summary>
/// XODIM (staff) RUXSATLARI — sof qoidalar (rol/HTTP kontekstisiz), shuning uchun testlanadi.
///
/// <para>Ruxsat claim'i ikki ko'rinishda bo'ladi:</para>
/// <list type="bullet">
///   <item><c>"bolim"</c> — TO'LIQ (barcha amallar). Eski yozuvlar shunday.</item>
///   <item><c>"bolim:amal"</c> — faqat shu amal: <c>create</c> / <c>edit</c> / <c>delete</c>.</item>
/// </list>
///
/// <para>Mantiq <c>AdminPermAttribute</c> dan AJRATIB olindi (nusxa emas): u Server qatlamida,
/// test loyihasi esa unga bog'lanmagan. Ruxsat qoidasi — xavfsizlikning tayanch nuqtasi,
/// shuning uchun u test bilan qoplangan bo'lishi kerak.</para>
/// </summary>
public static class PermissionRules
{
    /// <summary>
    /// Xodim shu bo'limda ISHLAYDIMI — ya'ni bo'lim ruxsatining birortasi berilganmi
    /// (to'liq <c>"bolim"</c> yoki istalgan <c>"bolim:amal"</c>).
    ///
    /// <para>DIQQAT: nom bo'yicha ADASHISH bo'lmasligi kerak — <c>"oquvchilar"</c> so'ragan joy
    /// <c>"oquvchilar-arxiv"</c> claim'i bilan ochilib ketmasin. Shuning uchun mos kelish
    /// shartlari faqat ikkita: to'liq tenglik yoki <c>"bolim:"</c> prefiksi.</para>
    /// </summary>
    /// <param name="permClaims">Foydalanuvchining <c>perm</c> turidagi claim qiymatlari.</param>
    public static bool HasSection(IEnumerable<string>? permClaims, string section)
    {
        if (permClaims is null || string.IsNullOrEmpty(section)) return false;
        var prefix = section + ":";
        foreach (var c in permClaims)
        {
            if (c == section) return true;
            if (c is not null && c.StartsWith(prefix, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    /// <summary>
    /// Bo'lim bo'yicha TO'LIQ ruxsat (barcha amallar) berilganmi — faqat yalang <c>"bolim"</c>.
    /// Nozik amallar uchun (parol eksporti va h.k.).
    /// </summary>
    public static bool HasFullSection(IEnumerable<string>? permClaims, string section) =>
        permClaims is not null && !string.IsNullOrEmpty(section) && permClaims.Contains(section);

    /// <summary>
    /// HTTP amaliga mos keladigan ruxsat harakati: POST → <c>create</c>, DELETE → <c>delete</c>,
    /// qolgan yozish amallari (PUT/PATCH) → <c>edit</c>.
    /// </summary>
    public static string ActionFor(string httpMethod) =>
        string.Equals(httpMethod, "POST", StringComparison.OrdinalIgnoreCase) ? "create"
        : string.Equals(httpMethod, "DELETE", StringComparison.OrdinalIgnoreCase) ? "delete"
        : "edit";

    /// <summary>Yozish amaliga ruxsat bormi: yalang bo'lim (to'liq) YOKI aniq <c>bolim:amal</c>.</summary>
    public static bool CanWrite(IEnumerable<string>? permClaims, string section, string httpMethod)
    {
        if (permClaims is null) return false;
        var list = permClaims as IReadOnlyCollection<string> ?? permClaims.ToList();
        return list.Contains(section) || list.Contains(section + ":" + ActionFor(httpMethod));
    }
}
