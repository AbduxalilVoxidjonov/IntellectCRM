using System.Globalization;
using System.Text.RegularExpressions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// SMS / Telegram e'lon / Push matnidagi {o'rinbosar}larni real ma'lumotga almashtiradi.
/// BITTA joy — barcha kanal va auditoriyalar (o'quvchi, ota-ona, o'qituvchi, lid) shu yerga tayanadi,
/// shuning uchun tokenlar har joyda bir xil ishlaydi.
///
/// Tokenlar braces bilan ajratilgani uchun ({ota} ⊄ {ota-ona}) almashtirish tartibi muhim emas.
/// </summary>
public static class MessageTokenizer
{
    private static readonly string[] UzMonths =
    {
        "yanvar", "fevral", "mart", "aprel", "may", "iyun",
        "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
    };

    /// <summary>So'm formatlash: 1 500 000 so'm (probel bilan ajratilgan).</summary>
    public static string Money(decimal v)
    {
        var nfi = new NumberFormatInfo { NumberGroupSeparator = " ", NumberDecimalDigits = 0 };
        return v.ToString("#,0", nfi) + " so'm";
    }

    private static string Rep(string input, string token, string? value) =>
        Regex.Replace(input, Regex.Escape(token),
            (value ?? "").Replace("$", "$$"), RegexOptions.IgnoreCase);

    /// <summary>Barcha kanal/auditoriyalar uchun umumiy tokenlar: markaz nomi va joriy sana.</summary>
    private static string Common(string text, string? centerName)
    {
        var now = AppClock.Now;
        var r = Rep(text, "{markaz}", centerName);
        r = Rep(r, "{sana}", now.ToString("dd.MM.yyyy"));
        r = Rep(r, "{oy}", now.Month is >= 1 and <= 12 ? UzMonths[now.Month - 1] : "");
        r = Rep(r, "{yil}", now.Year.ToString());
        return r;
    }

    /// <summary>O'quvchi/ota-ona xabari — barcha o'quvchi tokenlari.</summary>
    public static string Student(string text, Student s, string? parentName, string? contactPhone, string? centerName)
    {
        var debt = s.Balance < 0 ? -s.Balance : 0m;
        var parent = string.IsNullOrWhiteSpace(parentName) ? "Ota-ona" : parentName!;
        var r = text;
        r = Rep(r, "{fish}", s.FullName);
        r = Rep(r, "{ism}", s.FirstName);
        r = Rep(r, "{familiya}", s.LastName);
        r = Rep(r, "{sharif}", s.MiddleName);
        r = Rep(r, "{sinf}", s.ClassName);
        r = Rep(r, "{guruh}", s.ClassName);
        r = Rep(r, "{qarzdorlik}", Money(debt));
        r = Rep(r, "{balans}", Money(s.Balance));
        r = Rep(r, "{ota-ona}", parent);
        r = Rep(r, "{ota_ona}", parent);
        r = Rep(r, "{telefon}", contactPhone);
        r = Rep(r, "{ota}", s.FatherFullName);
        r = Rep(r, "{ota_telefon}", s.FatherPhone);
        r = Rep(r, "{ona}", s.MotherFullName);
        r = Rep(r, "{ona_telefon}", s.MotherPhone);
        r = Rep(r, "{oquvchi_telefon}", s.Phone);
        r = Rep(r, "{manzil}", s.Address);
        r = Rep(r, "{tugilgan}", s.BirthDate);
        return Common(r, centerName);
    }

    /// <summary>O'qituvchi xabari — {fish}/{telefon}/{manzil}/{tugilgan}; o'quvchi tokenlari bo'sh.</summary>
    public static string Teacher(string text, Teacher t, string? centerName)
    {
        var r = text;
        r = Rep(r, "{fish}", t.FullName);
        r = Rep(r, "{telefon}", t.Phone);
        r = Rep(r, "{oquvchi_telefon}", t.Phone);
        r = Rep(r, "{manzil}", t.Address);
        r = Rep(r, "{tugilgan}", t.BirthDate);
        foreach (var tok in new[]
                 {
                     "{ism}", "{familiya}", "{sharif}", "{sinf}", "{guruh}", "{qarzdorlik}", "{balans}",
                     "{ota-ona}", "{ota_ona}", "{ota}", "{ota_telefon}", "{ona}", "{ona_telefon}",
                 })
            r = Rep(r, tok, "");
        return Common(r, centerName);
    }

    /// <summary>Lid xabari — lid ma'lumotlari; o'quvchi-spetsifik tokenlar bo'sh.</summary>
    public static string Lead(string text, Lead l, string? contactPhone, string? centerName)
    {
        var r = text;
        r = Rep(r, "{fish}", l.FullName);
        r = Rep(r, "{telefon}", contactPhone);
        r = Rep(r, "{oquvchi_telefon}", l.Phone);
        r = Rep(r, "{ota}", l.FatherFullName);
        r = Rep(r, "{ota_telefon}", l.FatherPhone);
        r = Rep(r, "{ona}", l.MotherFullName);
        r = Rep(r, "{ona_telefon}", l.MotherPhone);
        r = Rep(r, "{fan}", l.InterestSubject);
        r = Rep(r, "{tugilgan}", l.BirthDate);
        foreach (var tok in new[]
                 {
                     "{ism}", "{familiya}", "{sharif}", "{sinf}", "{guruh}", "{qarzdorlik}", "{balans}",
                     "{ota-ona}", "{ota_ona}", "{manzil}",
                 })
            r = Rep(r, tok, "");
        return Common(r, centerName);
    }
}
