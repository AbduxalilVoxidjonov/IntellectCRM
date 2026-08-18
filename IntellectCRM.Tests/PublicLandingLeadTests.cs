using System.Text.RegularExpressions;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// LANDING SAHIFASINING OMMAVIY LID QABULI (<c>POST /api/public/landing-lead</c>,
/// <c>PublicLandingController</c>) va landing CMS endpointlari
/// (<c>LandingCmsController</c>) qoidalarini qo'riqlaydi.
///
/// <para>Rasmiy manba: <c>.claude/rules/lead-forms.md</c> §4 ("BIR TELEFON = BITTA LID") va §6.5
/// (bosqich), <c>.claude/rules/crm-leads.md</c>, <c>.claude/rules/uploads-security.md</c>.</para>
///
/// <para><b>NEGA IKKI XIL TEST:</b> <c>IntellectCRM.Tests</c> loyihasi <c>IntellectCRM.Server</c>
/// ga referens QILMAYDI (faqat Domain/Application/Infrastructure — qarang
/// <see cref="SensitiveReadPermTests"/>), ya'ni controllerni bu yerdan chaqirib bo'lmaydi va
/// faqat shu test uchun sun'iy referens qo'shilmaydi. Shuning uchun:</para>
/// <list type="bullet">
///   <item><b>XATTI-HARAKAT</b> testlari controller tayanadigan UMUMIY mantiqni haqiqiy baza
///     ustida tekshiradi (<see cref="LeadIntake"/>, <see cref="PhoneUtil"/>, <c>PhoneKey</c>
///     sinxronizatsiyasi) — "dublikat lid ochilmaydi", "bosqich yo'q bo'lsa lid bosqichsiz
///     qoladi" qoidalari AYNAN shu yerda hal bo'ladi;</item>
///   <item><b>DARVOZA</b> testlari controller manba matnini o'qiydi — kimdir avto-xabar
///     darvozasini yoki <c>AdminPerm</c> atributini olib tashlasa test darrov qizaradi.</item>
/// </list>
/// </summary>
public class PublicLandingLeadTests
{
    // ===================== Yordamchilar =====================

    /// <summary>Repo ildizi — <c>IntellectCRM.slnx</c> yotgan papka.</summary>
    private static string RepoRoot
    {
        get
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "IntellectCRM.slnx")))
                dir = dir.Parent;
            Assert.True(dir is not null, "Repo ildizi (IntellectCRM.slnx) topilmadi");
            return dir!.FullName;
        }
    }

    private static string ControllerSource(string fileName) =>
        File.ReadAllText(Path.Combine(RepoRoot, "IntellectCRM.Server", "Controllers", fileName));

    private static string LandingLead => ControllerSource("PublicLandingController.cs");
    private static string LandingCms => ControllerSource("LandingCmsController.cs");

    /// <summary>Landing arizasi tushadigan lid (controller AYNAN shunday yozadi).</summary>
    private static Lead NewLandingLead(string name = "Aliyev Ali", string phone = "+998901234567",
        string stage = "", string subject = "General English") => new()
    {
        FullName = name,
        Phone = phone,
        Stage = stage,
        Source = "Sayt",
        InterestSubject = subject,
        CreatedAt = "2026-08-18T10:00:00",
    };

    // ===================== 1) YANGI LID: birinchi bosqich + hodisa =====================

    [Fact]
    public async Task Yangi_lid_birinchi_bosqichga_tushadi_va_hodisa_yoziladi()
    {
        using var t = TestDb.Sqlite();
        var db = t.Context;
        // Tartib ATAYIN aralash — birinchi bosqich Order bo'yicha tanlanishi kerak.
        db.LeadStages.Add(new LeadStage { Title = "Yo'qotilgan", Color = "red", Order = 5 });
        var first = new LeadStage { Title = "Yangi", Color = "blue", Order = 0 };
        db.LeadStages.Add(first);
        await db.SaveChangesAsync();

        var stageId = await LeadIntake.FirstStageIdAsync(db);
        Assert.Equal(first.Id, stageId);

        var lead = NewLandingLead(stage: stageId);
        db.Leads.Add(lead);
        db.LeadEvents.Add(new LeadEvent
        {
            LeadId = lead.Id, Type = "created", ActorName = "Sayt",
            CreatedAt = "2026-08-18T10:00:00", ToStage = stageId,
            Text = "Lid yaratildi (Aliyev Ali)",
        });
        await db.SaveChangesAsync();

        var saved = await db.Leads.SingleAsync();
        Assert.Equal(first.Id, saved.Stage);
        Assert.Equal("Sayt", saved.Source);
        Assert.Equal(0, saved.RepeatCount);

        var ev = await db.LeadEvents.SingleAsync();
        Assert.Equal("created", ev.Type);
        Assert.Equal(stageId, ev.ToStage);
    }

    // ===================== 2) TAKRORIY ARIZA: yangi lid OCHILMAYDI =====================

    [Fact]
    public async Task Takroriy_ariza_yangi_lid_ochmaydi_bosqich_va_manba_ozgarmaydi()
    {
        using var t = TestDb.Sqlite();
        var db = t.Context;
        var lost = new LeadStage { Title = "Yo'qotilgan", Order = 5 };
        db.LeadStages.AddRange(new LeadStage { Title = "Yangi", Order = 0 }, lost);
        // Odam ilgari Instagram formasidan kelgan va menejer uni "Yo'qotilgan" ga surgan.
        db.Leads.Add(new Lead
        {
            FullName = "Aliyev Ali", Phone = "+998901234567", Stage = lost.Id,
            Source = "Instagram", InterestSubject = "IELTS", CreatedAt = "2026-08-01T09:00:00",
        });
        await db.SaveChangesAsync();

        // Saytda raqam BOSHQA formatda kiritilgan — moslik PhoneKey (oxirgi 9 raqam) bo'yicha.
        var existing = await LeadIntake.FindByPhoneAsync(db, "90 123 45 67");
        Assert.NotNull(existing);

        existing!.RepeatCount++;
        existing.LastRepeatAt = "2026-08-18T10:00:00";
        db.LeadEvents.Add(new LeadEvent
        {
            LeadId = existing.Id, Type = "repeat_intake", ActorName = "Sayt",
            CreatedAt = "2026-08-18T10:00:00", ToStage = existing.Stage,
            Text = "Saytdan qayta ariza keldi (IELTS)",
        });
        await db.SaveChangesAsync();

        // Lid BITTA qoladi, bosqichi va manbasi o'zgarmaydi (first-touch).
        var lead = await db.Leads.SingleAsync();
        Assert.Equal(1, lead.RepeatCount);
        Assert.Equal(lost.Id, lead.Stage);
        Assert.Equal("Instagram", lead.Source);
        Assert.Equal("IELTS", lead.InterestSubject);
    }

    /// <summary>Controller takroriy arizada AYNAN shu shart bilan ishlashi kerak: fan FAQAT
    /// lidda umuman yo'q bo'lsa VA mijoz haqiqatan tanlagan bo'lsa to'ldiriladi.</summary>
    [Fact]
    public void Takroriy_arizada_fan_shartsiz_ustidan_yozilmaydi()
    {
        var src = LandingLead;
        // "General English" sukut qiymati FAQAT yangi lid uchun ishlatiladi.
        Assert.DoesNotContain("lead.InterestSubject = subject;", src);
        Assert.Matches(
            new Regex(@"string\.IsNullOrWhiteSpace\(lead\.InterestSubject\)\s*&&\s*chosenSubject\.Length\s*>\s*0\s*\)\s*\r?\n\s*lead\.InterestSubject",
                RegexOptions.Multiline),
            src);
    }

    // ===================== 3) AVTO-XABAR faqat YANGI lidga =====================

    [Fact]
    public void Takroriy_lidga_lead_new_avto_xabari_qayta_yuborilmaydi()
    {
        var src = LandingLead;

        // Avto-xabar `isNewLead` darvozasi ostida bo'lishi SHART (lead-forms.md §4).
        Assert.Matches(
            new Regex(@"if\s*\(isNewLead\)\s*\r?\n\s*await\s+autoMsg\.DispatchLeadAsync\(", RegexOptions.Multiline),
            src);

        // Telegram xabarnomasi esa IKKALA holatda ham ketadi — u darvozalanmaydi, lekin
        // "yangimi" bayrog'i bilan chaqiriladi (sarlavha to'g'ri chiqsin).
        Assert.Contains("isNewLead: isNewLead", src);
        Assert.Single(Regex.Matches(src, @"DispatchLeadAsync\("));
    }

    // ===================== 4) BOSQICH YO'Q — ustun YARATILMAYDI =====================

    [Fact]
    public async Task Bosqich_umuman_bolmasa_lid_bosqichsiz_qoladi_va_ustun_yaratilmaydi()
    {
        using var t = TestDb.Sqlite();
        var db = t.Context;

        var stageId = await LeadIntake.FirstStageIdAsync(db);
        Assert.Equal("", stageId);

        db.Leads.Add(NewLandingLead(stage: stageId));
        await db.SaveChangesAsync();

        // ⚠️ Sun'iy "Yangi" ustun YASALMAYDI — ommaviy endpoint kanbanni o'zgartirmaydi.
        Assert.Empty(db.LeadStages);
        Assert.Equal("", (await db.Leads.SingleAsync()).Stage);
    }

    [Fact]
    public void Controller_LeadStage_yaratmaydi_va_LeadIntake_dan_foydalanadi()
    {
        var src = LandingLead;
        Assert.DoesNotContain("new LeadStage", src);
        Assert.Contains("LeadIntake.FirstStageIdAsync(db)", src);
        Assert.Contains("LeadIntake.FindByPhoneAsync(db", src);
    }

    // ===================== 5) TEKSHIRUVLAR: telefon va ism =====================

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("123")]
    [InlineData("abcdefgh")]
    public void Notogri_telefon_qabul_qilinmaydi(string phone)
    {
        var (valid, _, error) = PhoneUtil.Validate(phone);
        Assert.False(valid);
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void Bosh_ism_va_notogri_telefon_400_qaytaradi()
    {
        var src = LandingLead;
        // Ism bo'sh / juda uzun va telefon xato bo'lganda 400 (BadRequest) — uchala darvoza ham joyida.
        Assert.Contains("if (fullName.Length == 0)", src);
        Assert.Contains("BadRequest(new { message = \"Ism-familiya kiritilishi shart\" })", src);
        Assert.Contains("if (fullName.Length > 100)", src);
        Assert.Contains("PhoneUtil.Validate(p.Phone)", src);
        Assert.Contains("if (!valid)", src);
        Assert.Equal(3, Regex.Matches(src, @"return BadRequest\(").Count);
    }

    // ===================== 6) PhoneKey — dublikat qidiruvi ishlashi uchun =====================

    [Fact]
    public async Task Saytdan_kelgan_lidning_PhoneKey_i_avtomatik_yoziladi()
    {
        using var t = TestDb.Sqlite();
        var db = t.Context;
        db.Leads.Add(NewLandingLead(phone: "+998 (90) 123-45-67"));
        await db.SaveChangesAsync();

        // PhoneKey qo'lda yozilmaydi — AppDbContext.SaveChanges o'zi hisoblaydi.
        Assert.Equal("901234567", (await db.Leads.SingleAsync()).PhoneKey);
        Assert.NotNull(await LeadIntake.FindByPhoneAsync(db, "998901234567"));
    }

    // ===================== 7) MANBA — LeadSource katalogidagi nom =====================

    [Fact]
    public void Manba_LeadSource_katalogidan_olinadi()
    {
        var src = LandingLead;
        // Ilgari qattiq "sayt" (kichik harf) yozilardi — katalogda esa "Sayt" bor va "Manba"
        // filtri bitta kanalni ikki qator qilib ko'rsatardi.
        Assert.DoesNotContain("Source = \"sayt\"", src);
        Assert.Contains("db.LeadSources", src);
    }

    // ===================== 8) LANDING CMS — ruxsat darvozasi =====================

    [Fact]
    public void Landing_CMS_admin_marshrutlari_AdminPerm_bilan_darvozalangan()
    {
        var src = LandingCms;

        // Yalang [Authorize] QOLMASLIGI kerak: u bilan ISTALGAN tizimga kirgan foydalanuvchi
        // (o'quvchi, ota-ona, o'qituvchi) landing kontentini o'zgartira olardi.
        Assert.DoesNotContain("\n    [Authorize]\n", src);

        // Har bir api/admin/landing/... marshrutidan keyin AdminPerm turishi shart.
        var routes = Regex.Matches(src, @"\[Http(Get|Post|Put|Delete)\(""api/admin/landing/[^""]*""\)\]\s*\r?\n\s*(\[[^\]]+\])");
        Assert.True(routes.Count >= 14, $"api/admin/landing marshrutlari kam topildi: {routes.Count}");
        foreach (Match m in routes)
            Assert.StartsWith("[AdminPerm(", m.Groups[2].Value);

        // Ruxsat kaliti nav (`/admin/landing`) va marshrut darvozasi bilan bir xil.
        Assert.Contains("private const string SectionPerm = \"settings\";", src);

        // Ommaviy endpoint ANONIM bo'lib qoladi.
        Assert.Matches(
            new Regex(@"\[HttpGet\(""api/public/landing-data""\)\]\s*\r?\n\s*\[AllowAnonymous\]", RegexOptions.Multiline),
            src);
    }

    // ===================== 9) LANDING CMS — ommaviy endpointda DDL YO'Q =====================

    [Fact]
    public void Ommaviy_landing_data_da_DDL_bajarilmaydi_va_xato_jim_yutilmaydi()
    {
        var src = LandingCms;

        var start = src.IndexOf("public async Task<IActionResult> GetPublicLandingData()", StringComparison.Ordinal);
        Assert.True(start > 0, "GetPublicLandingData topilmadi");
        var end = src.IndexOf("// ==================== ADMIN MAP & SOCIALS", start, StringComparison.Ordinal);
        Assert.True(end > start, "GetPublicLandingData tanasi topilmadi");

        // Ommaviy (auth'siz) endpoint har so'rovda ALTER TABLE bajarmasin.
        Assert.DoesNotContain("EnsureColumnsAsync", src[start..end]);

        // Jarayon davomida BIR MARTA + xato logga yoziladi (ilgari `catch { }` edi).
        Assert.Contains("private static bool _columnsEnsured;", src);
        Assert.Contains("if (_columnsEnsured) return;", src);
        Assert.Contains("logger.LogWarning(", src);
        Assert.DoesNotContain("catch { }", src);
    }

    // ===================== 10) LANDING CMS — bo'sh qiymat BO'SH saqlanadi =====================

    [Fact]
    public void Socials_saqlashda_qattiq_kodlangan_default_qoyilmaydi()
    {
        var src = LandingCms;

        var start = src.IndexOf("public async Task<IActionResult> UpdateSocials(", StringComparison.Ordinal);
        Assert.True(start > 0, "UpdateSocials topilmadi");
        var end = src.IndexOf("await db.SaveChangesAsync();", start, StringComparison.Ordinal);
        var body = src[start..end];

        // Admin YouTube havolasini o'chirsa u "https://youtube.com" bo'lib qaytmasligi kerak.
        foreach (var def in new[] { "https://youtube.com", "https://facebook.com", "info@intellect.uz",
                                     "+998 (90) 344-44-34", "https://t.me/intellect_kokand" })
            Assert.DoesNotContain(def, body);

        // Sukut qiymatlar FAQAT o'qishda (ommaviy javobda) qo'llanadi.
        Assert.Contains("DefaultYoutubeUrl", src);
        Assert.Contains("youtubeUrl = NormalizeUrl(meta?.YoutubeUrl, DefaultYoutubeUrl)", src);
    }
}
