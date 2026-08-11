using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// INSTAGRAM MODULINING SOF QOIDALARI (<see cref="InstagramContract"/>) testlari.
/// Rasmiy manba: <c>.claude/rules/marketing-instagram.md</c> §10–§11.
///
/// <para>Bu funksiyalarda baza ham, tarmoq ham yo'q — ular ATAYIN ajratilgan, chunki
/// modulning eng qimmat qarorlari (javob yuborilsinmi, lid ochilsinmi) aynan shu yerda.</para>
/// </summary>
public class InstagramContractTests
{
    /// <summary>AI chiqishining bo'sh namunasi — testda faqat kerakli maydon o'zgartiriladi.</summary>
    private static IgAgentOutput Output(
        int score = 0, bool hot = false, string contact = "", bool escalate = false) =>
        new("Javob", "uz-Latn", "other", score, hot, false, escalate, "", contact, "", "");

    // ===================== 1) ClampScore =====================

    [Theory]
    [InlineData(-5, 0)]
    [InlineData(0, 0)]
    [InlineData(50, 50)]
    [InlineData(100, 100)]
    [InlineData(150, 100)]
    [InlineData(int.MinValue, 0)]
    [InlineData(int.MaxValue, 100)]
    public void ClampScore_ballni_0_100_oraligiga_keltiradi(int given, int expected)
    {
        // LLM sxemasida `minimum`/`maximum` ISHLATILMAYDI (sxema rad etiladi) — chegara kod tomonda.
        Assert.Equal(expected, InstagramContract.ClampScore(given));
    }

    // ===================== 2) Normalizatsiya =====================

    [Theory]
    [InlineData("greeting", "greeting")]
    [InlineData("buying_intent", "buying_intent")]
    [InlineData("PRICE_QUESTION", "price_question")]
    [InlineData("  spam  ", "spam")]
    [InlineData("price_inquiry", "other")]   // NUR'dagi mos kelmagan nom — yo'qolmaydi, "other"ga tushadi
    [InlineData("", "other")]
    [InlineData("   ", "other")]
    [InlineData(null, "other")]
    public void NormalizeIntent_nomalum_niyatni_other_ga_otkazadi(string? given, string expected)
    {
        Assert.Equal(expected, InstagramContract.NormalizeIntent(given));
    }

    [Theory]
    [InlineData("uz-Latn", "uz-Latn")]
    [InlineData("uz-Cyrl", "uz-Cyrl")]
    [InlineData("ru", "ru")]
    [InlineData("EN", "en")]              // registr farqi — kanonik shakl qaytadi
    [InlineData("uz-cyrl", "uz-Cyrl")]
    [InlineData("de", "uz-Latn")]
    [InlineData("", "uz-Latn")]
    [InlineData(null, "uz-Latn")]
    public void NormalizeLanguage_nomalum_tilni_uz_Latn_ga_otkazadi(string? given, string expected)
    {
        Assert.Equal(expected, InstagramContract.NormalizeLanguage(given));
    }

    [Fact]
    public void Normalizatsiya_natijasi_doim_katalogdan_boladi()
    {
        Assert.Contains(InstagramContract.NormalizeIntent("aaa"), IgConst.Intents);
        Assert.Contains(InstagramContract.NormalizeLanguage("aaa"), IgConst.Languages);
    }

    // ===================== 3) IsHot / ShouldCreateLead =====================

    [Fact]
    public void Ball_chegaradan_past_bolsa_qaynoq_emas()
    {
        Assert.False(InstagramContract.IsHot(Output(score: IgConst.HotLeadScore - 1)));
    }

    [Fact]
    public void Ball_chegaraga_teng_bolsa_qaynoq()
    {
        Assert.True(InstagramContract.IsHot(Output(score: IgConst.HotLeadScore)));
    }

    [Fact]
    public void Kontakt_qoldirgan_odam_ball_past_bolsa_ham_qaynoq()
    {
        // "Telefon qoldirdi" = "operator qo'ng'iroq qilsin" — LLM ehtiyotkorligi buni bekor qilmaydi.
        Assert.True(InstagramContract.IsHot(Output(score: 0, contact: "901234567")));
    }

    [Fact]
    public void LLM_ozi_qaynoq_desa_ball_past_bolsa_ham_qaynoq()
    {
        Assert.True(InstagramContract.IsHot(Output(score: 10, hot: true)));
    }

    [Fact]
    public void Salom_alik_lidga_aylanmaydi()
    {
        // Har suhbat lid EMAS — salom-alik va spam CRM'ni ifloslantirmaydi.
        Assert.False(InstagramContract.ShouldCreateLead(Output(score: 20)));
    }

    [Theory]
    [InlineData(69, false)]
    [InlineData(70, true)]
    public void ShouldCreateLead_chegarasi_IsHot_bilan_bir_xil(int score, bool expected)
    {
        Assert.Equal(expected, InstagramContract.ShouldCreateLead(Output(score: score)));
    }

    [Fact]
    public void Kontakt_bosh_joy_bolsa_kontakt_hisoblanmaydi()
    {
        Assert.False(InstagramContract.HasContact(Output(contact: "   ")));
    }

    // ===================== 4) DM 24 soatlik oynasi =====================

    private static readonly DateTime Now = new(2026, 8, 12, 12, 0, 0);

    private static string Iso(DateTime t) => t.ToString("yyyy-MM-ddTHH:mm:ss");

    [Fact]
    public void Oyna_23_soat_59_daqiqada_ochiq()
    {
        Assert.True(InstagramContract.DmWindowOpen(Iso(Now.AddHours(-23).AddMinutes(-59)), Now));
    }

    [Fact]
    public void Oyna_24_soat_01_daqiqada_yopiq()
    {
        Assert.False(InstagramContract.DmWindowOpen(Iso(Now.AddHours(-24).AddMinutes(-1)), Now));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("buzuq-sana")]
    [InlineData(null)]
    public void Oyna_sana_notogri_bolsa_YOPIQ(string? iso)
    {
        // ⚠️ FAIL-CLOSED: "bilmasak yubormaymiz" — Meta baribir rad etardi, bizda esa bu
        // operator signaliga aylanadi.
        Assert.False(InstagramContract.DmWindowOpen(iso!, Now));
    }

    [Fact]
    public void Oyna_kelajakdagi_sanada_ochiq_deb_qaraladi()
    {
        // Soat farqi yoki qo'lda tuzatilgan yozuv tufayli javobsiz qolmasin.
        Assert.True(InstagramContract.DmWindowOpen(Iso(Now.AddMinutes(5)), Now));
    }

    // ===================== 5) Operator pauzasi =====================

    [Fact]
    public void Operator_holatidagi_suhbat_doim_pauzada()
    {
        var conv = new IgConversation { Status = IgConst.StatusOperator };
        Assert.True(InstagramContract.OperatorPaused(conv, Now));
    }

    [Fact]
    public void Muddati_otmagan_pauza_kuchda()
    {
        var conv = new IgConversation { Status = IgConst.StatusBot, OperatorPausedUntil = Iso(Now.AddMinutes(10)) };
        Assert.True(InstagramContract.OperatorPaused(conv, Now));
    }

    [Fact]
    public void Muddati_otgan_pauza_ozi_tugaydi()
    {
        var conv = new IgConversation { Status = IgConst.StatusBot, OperatorPausedUntil = Iso(Now.AddMinutes(-1)) };
        Assert.False(InstagramContract.OperatorPaused(conv, Now));
    }

    [Theory]
    [InlineData("")]
    [InlineData("buzuq")]
    public void Pauza_sanasi_bosh_yoki_buzuq_bolsa_pauza_yoq(string until)
    {
        var conv = new IgConversation { Status = IgConst.StatusBot, OperatorPausedUntil = until };
        Assert.False(InstagramContract.OperatorPaused(conv, Now));
    }

    [Fact]
    public void Yopilgan_suhbatga_bot_javob_bermaydi()
    {
        Assert.False(InstagramContract.BotMayReply(new IgConversation { Status = IgConst.StatusClosed }, Now));
    }

    [Fact]
    public void Oddiy_bot_suhbatiga_javob_beriladi()
    {
        Assert.True(InstagramContract.BotMayReply(new IgConversation { Status = IgConst.StatusBot }, Now));
    }

    // ===================== 6) ExtractPhone =====================

    [Theory]
    [InlineData("+998901234567")]
    [InlineData("998901234567")]
    [InlineData("901234567")]
    [InlineData("90 123 45 67")]
    [InlineData("90-123-45-67")]
    [InlineData("+998 (90) 123-45-67")]
    [InlineData("Mening raqamim 90 123 45 67, qo'ng'iroq qiling")]
    [InlineData("yozing: +998901234567 rahmat")]
    public void ExtractPhone_ozbek_raqamini_topadi(string text)
    {
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone(text));
    }

    [Theory]
    [InlineData("17841400000000000", "Instagram akkaunt id (17 raqam)")]
    [InlineData("Narxi 350000 so'm", "narx")]
    [InlineData("Kurs 2026-08-12 da boshlanadi", "sana")]
    [InlineData("Salom, qanaqa kurslaringiz bor?", "raqamsiz matn")]
    [InlineData("", "bo'sh matn")]
    [InlineData("   ", "faqat bo'sh joy")]
    [InlineData("012345678", "0 bilan boshlanadi — mahalliy raqam emas")]
    [InlineData("12345", "juda qisqa")]
    public void ExtractPhone_telefon_bolmagan_raqamni_olmaydi(string text, string nima)
    {
        // ⚠️ Aks holda Instagram id yoki narx telefon deb olinib, begona lidga biriktirilardi.
        Assert.True(InstagramContract.ExtractPhone(text).Length == 0, $"Telefon deb olindi: {nima}");
    }

    [Fact]
    public void ExtractPhone_matnda_narx_ham_raqam_ham_bolsa_raqamni_topadi()
    {
        Assert.Equal("+998-90-123-45-67",
            InstagramContract.ExtractPhone("Narxi 350000 so'm, raqamim 901234567"));
    }

    // ===================== 7) Kalit so'z qoidasi =====================

    private static IgAutoRule Rule(string keywords = "narx,qancha", string channel = "any", bool active = true) =>
        new() { Keywords = keywords, Channel = channel, IsActive = active, ReplyText = "Javob" };

    [Fact]
    public void Qoida_sozning_bir_qismi_boyicha_ham_moslashadi()
    {
        Assert.True(InstagramContract.RuleMatches(Rule(), IgConst.ChannelDm, "Kursning NARXI qancha?"));
    }

    [Fact]
    public void Qoida_kanali_mos_kelmasa_ishlamaydi()
    {
        Assert.False(InstagramContract.RuleMatches(Rule(channel: IgConst.ChannelComment), IgConst.ChannelDm, "narx"));
    }

    [Fact]
    public void Yopiq_javob_izoh_qoidalari_bilan_tekshiriladi()
    {
        // private_reply — izohning davomi, shuning uchun `comment` qoidalari qo'llanadi.
        Assert.True(InstagramContract.RuleMatches(
            Rule(channel: IgConst.ChannelComment), IgConst.ChannelPrivateReply, "narx qancha"));
    }

    [Fact]
    public void Ochirilgan_qoida_ishlamaydi()
    {
        Assert.False(InstagramContract.RuleMatches(Rule(active: false), IgConst.ChannelDm, "narx"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Bosh_matnga_qoida_moslanmaydi(string text)
    {
        Assert.False(InstagramContract.RuleMatches(Rule(), IgConst.ChannelDm, text));
    }

    [Fact]
    public void Kalit_sozsiz_qoida_hech_narsaga_moslanmaydi()
    {
        Assert.False(InstagramContract.RuleMatches(Rule(keywords: "  ,  "), IgConst.ChannelDm, "narx"));
    }

    // ===================== 8) Trim =====================

    [Fact]
    public void Trim_uzun_matnni_qisqartiradi_va_uch_nuqta_qoyadi()
    {
        var uzun = new string('a', 50);
        var natija = InstagramContract.Trim(uzun, 10);

        Assert.Equal(10, natija.Length);
        Assert.EndsWith("…", natija);
    }

    [Fact]
    public void Trim_qisqa_matnga_tegmaydi()
    {
        Assert.Equal("salom", InstagramContract.Trim("  salom  ", 100));
    }

    [Fact]
    public void Trim_null_uchun_bosh_satr()
    {
        Assert.Equal("", InstagramContract.Trim(null, 100));
    }
}
