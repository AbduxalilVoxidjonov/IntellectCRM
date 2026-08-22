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

/// <summary>
/// 2026-08-19 da TUZATILGAN kamchiliklar — qayta qaytib kelmasin.
///
/// <para>Har bir test aynan bitta xatoni qulflaydi: halqa avtomat o'chirgichi (hujjatda va'da
/// qilingan, lekin kodda YO'Q edi) va telefon ajratishdagi "ikki son qo'shilib ketishi".</para>
/// </summary>
public class InstagramHardeningTests
{
    // ─────────────── HALQA AVTOMAT O'CHIRGICHI ───────────────

    [Fact]
    public void Burst_chegaradan_PAST_bolsa_javob_MUMKIN()
    {
        Assert.Equal("", InstagramContract.BurstBlockReason(0, 0));
        Assert.Equal("", InstagramContract.BurstBlockReason(IgConst.BurstPerPost - 1, IgConst.BurstGlobal - 1));
    }

    [Fact]
    public void Burst_POST_chegarasi_javobni_TOXTATADI()
    {
        // Halqa odatda BITTA post ostida qiziydi — global chegaraga yetmasdan ushlanishi kerak.
        var reason = InstagramContract.BurstBlockReason(IgConst.BurstPerPost, 0);
        Assert.NotEqual("", reason);
        Assert.Contains("post", reason);
    }

    [Fact]
    public void Burst_GLOBAL_chegarasi_javobni_TOXTATADI()
    {
        var reason = InstagramContract.BurstBlockReason(0, IgConst.BurstGlobal);
        Assert.NotEqual("", reason);
        Assert.Contains("daqiqada", reason);
    }

    [Fact]
    public void Burst_chegaralari_KUNLIK_chegaradan_ancha_PAST()
    {
        // Kunlik chegara (default 200) yolg'iz qolsa halqa 200 ta javob yozib ulgurardi —
        // Instagram esa bundan ancha oldin akkauntni spam deb belgilaydi. Qisqa oynadagi
        // chegaralar shu sababdan MAJBURIY va sezilarli darajada past bo'lishi shart.
        Assert.True(IgConst.BurstGlobal < 200);
        Assert.True(IgConst.BurstPerPost < IgConst.BurstGlobal);
        Assert.True(IgConst.BurstWindowMinutes is > 0 and <= 60);
    }

    // ─────────────── TELEFON AJRATISH ───────────────

    [Fact]
    public void Telefon_PROBEL_bilan_ajratilgan_ikki_son_orasidan_topiladi()
    {
        // ⚠️ ESKI XATO: probel "ajratuvchi" deb hisoblanib, raqamlar oqimini UZMASDI —
        // "500000" va "901234567" qo'shilib 15 raqamli son bo'lardi va telefon YO'QOLARDI.
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("narxi 500000 901234567"));
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("2 ta kurs 901234567"));
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("2026 901234567"));
    }

    [Fact]
    public void Telefon_BOLAKLARGA_bolingan_holda_ham_topiladi()
    {
        // Bir guruh ichidagi bo'laklar AVVAL birlashtiriladi — bu asosiy yozilish usuli.
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("+998 90 123 45 67"));
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("tel: 90-123-45-67"));
        Assert.Equal("+998-90-123-45-67", InstagramContract.ExtractPhone("(90) 123 45 67 ga qo'ng'iroq qiling"));
    }

    [Fact]
    public void Instagram_IDsi_telefon_deb_OLINMAYDI()
    {
        // Eng xavfli noto'g'ri ijobiy: 17 raqamli IG id begona lidga biriktirilib ketardi.
        Assert.Equal("", InstagramContract.ExtractPhone("id 17841400000000000"));
        Assert.Equal("", InstagramContract.ExtractPhone("17841400000000000"));
        // Narx va yil ham telefon emas.
        Assert.Equal("", InstagramContract.ExtractPhone("narxi 500000 so'm"));
        Assert.Equal("", InstagramContract.ExtractPhone("2026 yildan beri"));
        // 0 bilan boshlanadigan mahalliy raqam ham yo'q.
        Assert.Equal("", InstagramContract.ExtractPhone("012345678"));
    }

    // ═══════════════════════ REKLAMA ATRIBUTSIYASI (E3) — ko'rinadigan qism ═══════════════════════

    /// <summary>
    /// `?source=ads` filtri: faqat AYNAN shu kalit ishlaydi, noma'lum qiymat esa filtrni
    /// UMUMAN qo'llamaydi.
    ///
    /// <para>⚠️ Nega shunday: klientdagi xato kalit tufayli inbox butunlay bo'shab qolsa
    /// operator "suhbat yo'q" deb o'ylardi (jurnaldagi noma'lum tur bilan bir xil siyosat).</para>
    /// </summary>
    [Fact]
    public void WantsAdsOnly_faqat_ads_kalitida_ishlaydi()
    {
        Assert.True(InstagramContract.WantsAdsOnly("ads"));
        Assert.True(InstagramContract.WantsAdsOnly(" ADS "));
        Assert.Equal("ads", IgConst.SourceAds);

        Assert.False(InstagramContract.WantsAdsOnly(""));
        Assert.False(InstagramContract.WantsAdsOnly(null));
        Assert.False(InstagramContract.WantsAdsOnly("organik"));
        Assert.False(InstagramContract.WantsAdsOnly("advertisement"));
    }

    /// <summary>"Reklamadan kelganmi" — e'lon id'si bor bo'lsa HA (kampaniya aniqlanmagan
    /// bo'lsa ham: iyerarxiya hali sinxronlanmagan bo'lishi mumkin).</summary>
    [Fact]
    public void FromAd_elon_idsi_bolsa_true()
    {
        Assert.True(InstagramContract.FromAd("120200000000000"));
        Assert.False(InstagramContract.FromAd(""));
        Assert.False(InstagramContract.FromAd("   "));
        Assert.False(InstagramContract.FromAd(null));
    }

    /// <summary>
    /// Kampaniya yorlig'i: nom bo'lsa nom, bo'lmasa id'ning O'ZI, u ham bo'lmasa e'lon id'si.
    /// <para>⚠️ Sun'iy "Noma'lum kampaniya" YOZILMAYDI — id Ads Manager'da qidirsa bo'ladigan
    /// qiymat, o'ylab topilgan matn esa emas (<c>MetaAdsRoi.BuildNode</c> bilan bir xil qoida).</para>
    /// </summary>
    [Fact]
    public void AdCampaignLabel_nom_yoq_bolsa_id_qaytadi()
    {
        Assert.Equal("Yoz-2026", InstagramContract.AdCampaignLabel("c1", "Yoz-2026"));
        Assert.Equal("c1", InstagramContract.AdCampaignLabel("c1", ""));
        Assert.Equal("c1", InstagramContract.AdCampaignLabel("c1", "   "));
        Assert.Equal("c1", InstagramContract.AdCampaignLabel("c1", null));

        // Kampaniya umuman aniqlanmagan — hech bo'lmasa e'lon id'si ko'rinsin.
        Assert.Equal("ad9", InstagramContract.AdCampaignLabel("", "", "ad9"));

        // Hech narsa yo'q — BO'SH satr (chip umuman chizilmaydi).
        Assert.Equal("", InstagramContract.AdCampaignLabel("", "", ""));
        Assert.Equal("", InstagramContract.AdCampaignLabel(null, null, null));
    }

    /* =============================================================================================
     *  OAuth SCOPE'lari — kontent joylash SHARTLI
     * ========================================================================================== */

    /// <summary>
    /// 🔴 Meta ilovada YOQILMAGAN scope so'ralsa authorize so'rovini BUTUNLAY rad etadi.
    /// Shuning uchun `instagram_business_content_publish` asosiy ro'yxatda TURMASLIGI shart:
    /// aks holda kontent modulini ishlatmaydigan markaz «Qayta ulash» bosganda ISHLAB TURGAN
    /// izoh/DM agentini qayta ulay olmay qolardi.
    /// </summary>
    [Fact]
    public void Kontent_scopei_asosiy_royxatda_YOQ()
    {
        Assert.DoesNotContain(IgConst.ContentPublishScope, IgConst.Scopes);
        Assert.Equal(IgConst.Scopes, IgConst.ScopesFor(false));
    }

    /// <summary>Modul yoqilgan bo'lsa — qo'shiladi, asosiy ruxsatlar esa JOYIDA qoladi.</summary>
    [Fact]
    public void Kontent_yoqilganda_scope_qoshiladi()
    {
        var scopes = IgConst.ScopesFor(true);

        Assert.Contains(IgConst.ContentPublishScope, scopes);
        Assert.StartsWith(IgConst.Scopes, scopes);
        // Asosiy uchta ruxsat yo'qolmasin — ular bo'lmasa modul umuman ishlamaydi.
        Assert.Contains("instagram_business_basic", scopes);
        Assert.Contains("instagram_business_manage_messages", scopes);
        Assert.Contains("instagram_business_manage_comments", scopes);
    }

    /// <summary>Authorize manzili berilgan scope ro'yxatini ishlatadi; berilmasa — asosiysini.</summary>
    [Fact]
    public void Authorize_manzili_scopeni_hurmat_qiladi()
    {
        var with = InstagramApi.BuildAuthorizeUrl("app", "https://x/cb", "st", IgConst.ScopesFor(true));
        var without = InstagramApi.BuildAuthorizeUrl("app", "https://x/cb", "st");

        Assert.Contains(Uri.EscapeDataString(IgConst.ContentPublishScope), with);
        Assert.DoesNotContain(IgConst.ContentPublishScope, Uri.UnescapeDataString(without));
    }

    /* ═══════════ TASHQI MANZIL (webhook · OAuth redirect_uri) ═══════════ */

    /// <summary>Kanonik host sozlangan bo'lsa — AYNAN o'sha ishlatiladi, so'rov hosti emas.
    /// <para>⚠️ Bu OAuth'ning eng qiyin topiladigan xatosini yopadi: Meta'da ro'yxatdan o'tgan
    /// <c>redirect_uri</c> harfma-harf bir xil bo'lishi shart, admin esa CRM'ni boshqa nom
    /// (IP, <c>www.</c>, vaqtinchalik domen) bilan ochgan bo'lishi mumkin.</para></summary>
    [Theory]
    [InlineData("crm.intellect.uz", "https://crm.intellect.uz")]
    [InlineData("https://crm.intellect.uz", "https://crm.intellect.uz")]
    [InlineData("  crm.intellect.uz/  ", "https://crm.intellect.uz")]
    [InlineData("https://crm.intellect.uz/admin/marketing", "https://crm.intellect.uz")]
    public void Tashqi_manzil_kanonik_hostdan_quriladi(string configured, string expected)
    {
        Assert.Equal(expected, InstagramContract.PublicBase(configured, "http", "192.168.0.10:8080"));
    }

    /// <summary>Sozlanmagan bo'lsa — eski xatti-harakat (so'rov hostidan). Sxema
    /// <c>X-Forwarded-Proto</c> dan tiklangan bo'ladi.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Host_sozlanmagan_bolsa_sorov_hostiga_qaytiladi(string? configured)
    {
        Assert.Equal("https://crm.intellect.uz",
            InstagramContract.PublicBase(configured, "https", "crm.intellect.uz"));
    }

    /// <summary>Lokal hostda HTTPS majburlanmaydi — dev'da mavjud bo'lmagan manzil chiqardi.
    /// Ochiq yozilgan sxema esa har doim hurmat qilinadi.</summary>
    [Theory]
    [InlineData("localhost:5000", "http://localhost:5000")]
    [InlineData("127.0.0.1:5000", "http://127.0.0.1:5000")]
    [InlineData("https://localhost:5001", "https://localhost:5001")]
    [InlineData("http://crm.intellect.uz", "http://crm.intellect.uz")]
    public void Sxema_lokal_va_ochiq_yozilgan_holatda_togri_tanlanadi(string configured, string expected)
    {
        Assert.Equal(expected, InstagramContract.PublicBase(configured, "https", "boshqa.uz"));
    }

    /* ═══════════ INSTAGRAM LOGIN TOKENI KIMGA KERAK ═══════════ */

    /// <summary>
    /// 🔴 Token yangilash FAQAT AI agentiga bog'liq EMAS: kontent joylash AYNAN shu tokendan
    /// foydalanadi. Ilgari faqat <c>InstagramEnabled</c> tekshirilar va faqat kontent modulini
    /// yoqqan markazda token 60 kunda JIMGINA o'lardi.
    /// </summary>
    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]    // ⚠️ AYNAN SHU holat tushib qolgan edi
    [InlineData(true, true, true)]
    public void Login_tokeni_kerakligi_ikkala_moduldan_hisoblanadi(bool agent, bool publish, bool expected)
    {
        Assert.Equal(expected, InstagramContract.NeedsLoginToken(agent, publish));
    }

}
