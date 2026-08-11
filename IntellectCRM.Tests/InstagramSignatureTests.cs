using System.Security.Cryptography;
using System.Text;
using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// INSTAGRAM WEBHOOK IMZOSI (<see cref="InstagramSignature"/>) testlari.
/// Rasmiy manba: <c>.claude/rules/marketing-instagram.md</c> §2.
///
/// <para>Eng muhim qoida — <b>FAIL-CLOSED</b>: App Secret bo'sh bo'lsa so'rov RAD ETILADI.
/// Manba loyihada secret bo'sh bo'lsa tekshiruv o'tkazib yuborilardi ("lokal test qulay bo'lsin")
/// va prodda bu har kim bizning nomimizdan hodisa yubora oladigan himoyasiz endpoint edi.
/// Quyidagi testlar shu xulqni QULFLAYDI — ularni "qulaylik uchun" yumshatmang.</para>
/// </summary>
public class InstagramSignatureTests
{
    private const string Secret = "juda-maxfiy-app-secret";

    private static byte[] Body(string json = "{\"object\":\"instagram\"}") => Encoding.UTF8.GetBytes(json);

    /// <summary>Meta yuboradigan sarlavhaning aynan o'zi: <c>sha256=</c> + kichik harfli hex.</summary>
    private static string Sign(byte[] body, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return "sha256=" + Convert.ToHexString(hmac.ComputeHash(body)).ToLowerInvariant();
    }

    // ===================== 1) Verify — to'g'ri imzo =====================

    [Fact]
    public void Togri_imzo_qabul_qilinadi()
    {
        var body = Body();
        Assert.True(InstagramSignature.Verify(body, Sign(body, Secret), Secret));
    }

    [Fact]
    public void Imzo_hex_registriga_bogliq_emas()
    {
        // Meta kichik harf yuboradi, lekin katta harfli hex ham matematik jihatdan o'sha imzo.
        var body = Body();
        var upper = Sign(body, Secret).ToUpperInvariant();   // "SHA256=..." — prefiks ham katta
        Assert.True(InstagramSignature.Verify(body, upper, Secret));
    }

    [Fact]
    public void Bosh_body_uchun_ham_imzo_hisoblanadi()
    {
        var body = Array.Empty<byte>();
        Assert.True(InstagramSignature.Verify(body, Sign(body, Secret), Secret));
    }

    // ===================== 2) Verify — rad etiladigan holatlar =====================

    [Fact]
    public void Buzilgan_imzo_rad_etiladi()
    {
        var body = Body();
        var sig = Sign(body, Secret);
        // Oxirgi hex belgini o'zgartiramiz — imzo shakli to'g'ri, qiymati xato.
        var broken = sig[..^1] + (sig[^1] == 'a' ? 'b' : 'a');
        Assert.False(InstagramSignature.Verify(body, broken, Secret));
    }

    [Fact]
    public void Body_bir_bayt_ozgarsa_imzo_mos_kelmaydi()
    {
        var sig = Sign(Body("{\"a\":1}"), Secret);
        Assert.False(InstagramSignature.Verify(Body("{\"a\":2}"), sig, Secret));
    }

    [Fact]
    public void Boshqa_secret_bilan_hisoblangan_imzo_rad_etiladi()
    {
        var body = Body();
        Assert.False(InstagramSignature.Verify(body, Sign(body, "boshqa-secret"), Secret));
    }

    [Fact]
    public void Prefiksisiz_imzo_rad_etiladi()
    {
        var body = Body();
        var hex = Sign(body, Secret)["sha256=".Length..];
        Assert.False(InstagramSignature.Verify(body, hex, Secret));
    }

    [Fact]
    public void Boshqa_algoritm_prefiksi_rad_etiladi()
    {
        var body = Body();
        var hex = Sign(body, Secret)["sha256=".Length..];
        Assert.False(InstagramSignature.Verify(body, "sha1=" + hex, Secret));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Header_yoq_bolsa_rad_etiladi(string? header)
    {
        Assert.False(InstagramSignature.Verify(Body(), header, Secret));
    }

    [Theory]
    [InlineData("sha256=")]                       // hex umuman yo'q
    [InlineData("sha256=abcd")]                   // juda qisqa
    [InlineData("sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]  // 63 belgi
    public void Notogri_uzunlikdagi_hex_rad_etiladi(string header)
    {
        Assert.False(InstagramSignature.Verify(Body(), header, Secret));
    }

    [Fact]
    public void Hex_bolmagan_belgilar_istisno_otmasdan_rad_etiladi()
    {
        // Uzunligi to'g'ri (64), lekin hex emas — Convert.FromHexString istisno otadi, uni yutamiz.
        var header = "sha256=" + new string('z', 64);
        Assert.False(InstagramSignature.Verify(Body(), header, Secret));
    }

    [Fact]
    public void Body_null_bolsa_rad_etiladi()
    {
        Assert.False(InstagramSignature.Verify(null!, "sha256=" + new string('a', 64), Secret));
    }

    // ===================== 3) FAIL-CLOSED — eng muhim test =====================

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void App_secret_bosh_bolsa_HAR_QANDAY_imzo_rad_etiladi(string emptySecret)
    {
        // ⚠️ Bu yerda imzo BO'SH KALIT bilan MATEMATIK TO'G'RI hisoblangan — ya'ni "fail-open"
        // amalga oshirilgan bo'lsa test yashil bo'lardi. Modul sozlanmagan bo'lsa umuman
        // ishlamagani xavfsizroq (marketing-instagram.md §2).
        var body = Body();
        Assert.False(InstagramSignature.Verify(body, Sign(body, emptySecret), emptySecret));
    }

    [Fact]
    public void App_secret_bosh_bolsa_togri_imzo_ham_otmaydi()
    {
        var body = Body();
        Assert.False(InstagramSignature.Verify(body, Sign(body, Secret), ""));
    }

    // ===================== 4) VerifyChallenge (GET verify) =====================

    private const string Token = "verify-token-123";

    [Fact]
    public void Verify_challenge_togri_tokenda_challenge_qaytaradi()
    {
        Assert.Equal("12345", InstagramSignature.VerifyChallenge("subscribe", Token, "12345", Token));
    }

    [Fact]
    public void Verify_challenge_notogri_tokenda_null()
    {
        Assert.Null(InstagramSignature.VerifyChallenge("subscribe", "boshqa-token", "12345", Token));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Verify_challenge_verifyToken_bosh_bolsa_null(string emptyToken)
    {
        // FAIL-CLOSED: sozlanmagan token bilan "hamma narsa mos keladi" bo'lib qolmasin.
        Assert.Null(InstagramSignature.VerifyChallenge("subscribe", emptyToken, "12345", emptyToken));
    }

    [Theory]
    [InlineData("unsubscribe")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("SUBSCRIBE")]   // registr farqi qabul qilinmaydi (Meta aynan "subscribe" yuboradi)
    public void Verify_challenge_mode_subscribe_bolmasa_null(string? mode)
    {
        Assert.Null(InstagramSignature.VerifyChallenge(mode, Token, "12345", Token));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Verify_challenge_bosh_challenge_uchun_null(string? challenge)
    {
        Assert.Null(InstagramSignature.VerifyChallenge("subscribe", Token, challenge, Token));
    }

    [Fact]
    public void Verify_challenge_token_null_bolsa_null()
    {
        Assert.Null(InstagramSignature.VerifyChallenge("subscribe", null, "12345", Token));
    }
}
