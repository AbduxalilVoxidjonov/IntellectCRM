using System.Security.Cryptography;
using System.Text;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Webhook HAQIQIYLIGINI tekshirish — <c>X-Hub-Signature-256</c> (HMAC-SHA256) va GET verify.
///
/// <para><b>⚠️ FAIL-CLOSED.</b> NUR loyihasida App Secret bo'sh bo'lsa imzo tekshiruvi
/// O'TKAZIB YUBORILARDI (mahalliy test uchun ataylab qo'yilgan edi) — prodda bu har kim
/// bizning nomimizdan hodisa yubora oladigan OCHIQ endpoint degani. Bu yerda kalit bo'sh bo'lsa
/// so'rov RAD ETILADI: modul sozlanmagan bo'lsa umuman ishlamagani xavfsizroq.</para>
///
/// <para><b>⚠️ XOM BODY.</b> HMAC Meta yuborgan baytlardan hisoblanadi. Body deserializatsiya
/// qilinib, keyin qayta seriyalansa (bo'sh joy va kalitlar tartibi o'zgaradi) imzo HECH QACHON
/// mos kelmaydi — controller body'ni <c>byte[]</c> sifatida o'qib shu funksiyaga beradi.</para>
///
/// <para>Sof funksiyalar — baza/tarmoq yo'q, to'liq testlanadi.</para>
/// </summary>
public static class InstagramSignature
{
    private const string Prefix = "sha256=";

    /// <summary>
    /// Imzoni tekshiradi. <paramref name="appSecret"/> bo'sh bo'lsa — <c>false</c> (fail-closed).
    /// Solishtirish DOIMIY VAQTLI (<see cref="CryptographicOperations.FixedTimeEquals"/>):
    /// oddiy <c>==</c> baytma-bayt to'xtagani uchun imzoni vaqt o'lchab topish mumkin bo'lardi.
    /// </summary>
    public static bool Verify(byte[] rawBody, string? headerValue, string appSecret)
    {
        if (string.IsNullOrWhiteSpace(appSecret)) return false;      // ⚠️ FAIL-CLOSED
        if (rawBody is null) return false;
        var header = (headerValue ?? "").Trim();
        if (header.Length == 0) return false;
        if (!header.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)) return false;

        var hex = header[Prefix.Length..].Trim();
        if (hex.Length != 64) return false;

        byte[] given;
        try { given = Convert.FromHexString(hex); }
        catch (FormatException) { return false; }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var expected = hmac.ComputeHash(rawBody);
        return CryptographicOperations.FixedTimeEquals(expected, given);
    }

    /// <summary>
    /// GET verify (Meta webhook manzilini ro'yxatga olayotganda).
    /// <para><c>hub.mode == "subscribe"</c> VA token mos bo'lsa — <c>challenge</c> qaytariladi
    /// (controller uni <b>text/plain</b> qilib beradi: JSON qo'shtirnog'i bilan yuborilsa Meta
    /// tasdiqlamaydi). Aks holda <c>null</c> → 403.</para>
    /// <para>Token sozlanmagan bo'lsa ham <c>null</c> — bu yerda ham fail-closed.</para>
    /// </summary>
    public static string? VerifyChallenge(string? mode, string? token, string? challenge, string verifyToken)
    {
        if (string.IsNullOrWhiteSpace(verifyToken)) return null;      // ⚠️ FAIL-CLOSED
        if ((mode ?? "").Trim() != "subscribe") return null;
        if (!FixedEquals((token ?? "").Trim(), verifyToken.Trim())) return null;
        var ch = (challenge ?? "").Trim();
        return ch.Length == 0 ? null : ch;
    }

    /// <summary>Ikki satrni doimiy vaqtda solishtiradi (uzunlik farqi darhol false).</summary>
    private static bool FixedEquals(string a, string b)
    {
        var x = Encoding.UTF8.GetBytes(a);
        var y = Encoding.UTF8.GetBytes(b);
        if (x.Length != y.Length) return false;
        return CryptographicOperations.FixedTimeEquals(x, y);
    }
}
