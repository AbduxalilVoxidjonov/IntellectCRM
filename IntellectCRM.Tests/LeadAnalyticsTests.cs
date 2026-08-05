using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// CRM VORONKA ANALITIKASI (<see cref="LeadAnalytics"/>) testlari — hisob-kitob sof funksiyalarda,
/// shuning uchun bazasiz tekshiriladi.
///
/// <para>Asosiy talablar: voronka pastga qarab KAMAYIB borsin (tarixsiz eski lidlarda ham),
/// o'lchov bo'lmasa <c>AvgHours</c> aynan <c>null</c> bo'lsin (nol yoki taxmin EMAS), menejerlar
/// <c>ActorUserId</c> bo'yicha to'g'ri guruhlansin va bo'sh ma'lumotda hech narsa yiqilmasin.</para>
/// </summary>
public class LeadAnalyticsTests
{
    // ===================== Yordamchilar =====================

    private static readonly List<LeadAnalytics.StageRow> Stages =
    [
        new("s1", "Yangi", "slate", 0),
        new("s2", "Aloqada", "blue", 1),
        new("s3", "Sinov darsi", "amber", 2),
        new("s4", "Shartnoma", "emerald", 3),
    ];

    private static LeadAnalytics.LeadRow Lead(
        string id, string stage, string source = "", bool converted = false, string createdAt = "2026-05-10T09:00:00")
        => new(id, stage, source, converted, createdAt);

    private static LeadAnalytics.EventRow Created(string leadId, string toStage, string at)
        => new(leadId, LeadAnalytics.TypeCreated, "", toStage, null, "Sayt", at);

    private static LeadAnalytics.EventRow Moved(
        string leadId, string fromStage, string toStage, string at, string? userId = null, string actor = "Menejer")
        => new(leadId, LeadAnalytics.TypeStage, fromStage, toStage, userId, actor, at);

    private static LeadAnalytics.EventRow Converted(string leadId, string at, string? userId, string actor = "Menejer")
        => new(leadId, LeadAnalytics.TypeConvert, "", "", userId, actor, at);

    // ===================== 1) Voronka =====================

    [Fact]
    public void Voronka_TARIXSIZ_eski_lidlarda_ham_joriy_bosqich_boyicha_toladi()
    {
        // Hech qanday hodisa yo'q (eski lidlar) — voronka faqat JORIY bosqichdan quriladi.
        var leads = new[]
        {
            Lead("a", "s1"), Lead("b", "s2"), Lead("c", "s3"), Lead("d", "s4"),
        };

        var funnel = LeadAnalytics.BuildFunnel(leads, [], Stages);

        // s1 dan hammasi o'tgan, s2 dan uchtasi, s3 dan ikkitasi, s4 ga bittasi yetdi.
        Assert.Equal([4, 3, 2, 1], funnel.Select(f => f.Reached));
        Assert.Equal(["s1", "s2", "s3", "s4"], funnel.Select(f => f.StageId));
    }

    [Fact]
    public void Voronka_pastga_qarab_KAMAYIB_boradi()
    {
        var leads = Enumerable.Range(0, 10)
            .Select(i => Lead($"l{i}", i < 5 ? "s1" : i < 8 ? "s2" : i < 9 ? "s3" : "s4"))
            .ToList();

        var funnel = LeadAnalytics.BuildFunnel(leads, [], Stages);

        for (var i = 1; i < funnel.Count; i++)
            Assert.True(funnel[i].Reached <= funnel[i - 1].Reached,
                $"{funnel[i].StageId} ({funnel[i].Reached}) oldingisidan ({funnel[i - 1].Reached}) katta bo'lib qoldi");
    }

    [Fact]
    public void Voronka_Pct_jamiga_nisbatan_hisoblanadi_va_Total_nolda_yiqilmaydi()
    {
        var leads = new[] { Lead("a", "s1"), Lead("b", "s3"), Lead("c", "s3"), Lead("d", "s3") };
        var funnel = LeadAnalytics.BuildFunnel(leads, [], Stages);

        Assert.Equal(100, funnel[0].Pct);            // 4/4
        Assert.Equal(75, funnel[1].Pct);             // 3/4
        Assert.Equal(75, funnel[2].Pct);             // 3/4
        Assert.Equal(0, funnel[3].Pct);              // 0/4

        var bosh = LeadAnalytics.BuildFunnel([], [], Stages);
        Assert.All(bosh, f => Assert.Equal(0, f.Pct));
        Assert.All(bosh, f => Assert.Equal(0, f.Reached));
    }

    [Fact]
    public void Voronka_ORQAGA_qaytarilgan_lid_ham_yetib_kelgan_deb_sanaladi()
    {
        // Lid s3 gacha borib, keyin s1 ga qaytarilgan. Joriy bosqichi s1 bo'lsa ham,
        // u s2 va s3 dan O'TGAN — tarix buni saqlaydi.
        var leads = new[] { Lead("a", "s1") };
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T09:00:00"),
            Moved("a", "s1", "s2", "2026-05-01T10:00:00"),
            Moved("a", "s2", "s3", "2026-05-01T12:00:00"),
            Moved("a", "s3", "s1", "2026-05-02T09:00:00"),
        };

        var funnel = LeadAnalytics.BuildFunnel(leads, events, Stages);

        Assert.Equal(1, funnel[0].Reached);   // s1
        Assert.Equal(1, funnel[1].Reached);   // s2 — faqat tarixdan
        Assert.Equal(1, funnel[2].Reached);   // s3 — faqat tarixdan
        Assert.Equal(0, funnel[3].Reached);   // s4 — hech qachon bo'lmagan
    }

    [Fact]
    public void Voronka_ochirilgan_bosqichdagi_lid_dasturni_buzmaydi()
    {
        // Lidning joriy bosqichi ma'lumotnomada YO'Q (ustun o'chirilgan) — faqat tarix qoladi.
        var leads = new[] { Lead("a", "yoq-bunday-bosqich") };
        var events = new[] { Created("a", "s1", "2026-05-01T09:00:00") };

        var funnel = LeadAnalytics.BuildFunnel(leads, events, Stages);

        Assert.Equal(1, funnel[0].Reached);
        Assert.Equal(0, funnel[1].Reached);
    }

    // ===================== 2) Bosqichda o'tirish vaqti =====================

    [Fact]
    public void AvgHours_Samples_NOL_bolsa_aynan_NULL_qaytadi()
    {
        // Tarix yo'q → hech qanday to'liq oraliq o'lchanmagan.
        var funnel = LeadAnalytics.BuildFunnel([Lead("a", "s2")], [], Stages);

        Assert.All(funnel, f => Assert.Equal(0, f.Samples));
        Assert.All(funnel, f => Assert.Null(f.AvgHours));
    }

    [Fact]
    public void AvgHours_kirgan_va_chiqqan_paytlar_orasidagi_ortacha()
    {
        // a: s1 da 2 soat, s2 da 4 soat (keyin s3 ga o'tdi — s3 hali TUGAMAGAN).
        // b: s1 da 4 soat.
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T08:00:00"),
            Moved("a", "s1", "s2", "2026-05-01T10:00:00"),
            Moved("a", "s2", "s3", "2026-05-01T14:00:00"),
            Created("b", "s1", "2026-05-01T08:00:00"),
            Moved("b", "s1", "s2", "2026-05-01T12:00:00"),
        };

        var funnel = LeadAnalytics.BuildFunnel([Lead("a", "s3"), Lead("b", "s2")], events, Stages);

        var s1 = funnel.Single(f => f.StageId == "s1");
        Assert.Equal(2, s1.Samples);
        Assert.Equal(3.0, s1.AvgHours);              // (2 + 4) / 2

        var s2 = funnel.Single(f => f.StageId == "s2");
        Assert.Equal(1, s2.Samples);                 // b hali s2 da — u sanalmaydi
        Assert.Equal(4.0, s2.AvgHours);

        var s3 = funnel.Single(f => f.StageId == "s3");
        Assert.Equal(0, s3.Samples);                 // joriy bosqich — chiqilmagan
        Assert.Null(s3.AvgHours);
    }

    [Fact]
    public void AvgHours_bir_xil_bosqichga_TAKROR_otkazish_oraliqni_yopmaydi()
    {
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T08:00:00"),
            Moved("a", "s1", "s1", "2026-05-01T09:00:00"),   // hech narsa o'zgarmadi
            Moved("a", "s1", "s2", "2026-05-01T12:00:00"),
        };

        var d = LeadAnalytics.StageDurations(events);

        Assert.Equal(1, d["s1"].Samples);
        Assert.Equal(4.0, d["s1"].Hours);            // 08:00 → 12:00, oradagi takror e'tiborsiz
    }

    [Fact]
    public void AvgHours_vaqti_OQIB_BOLMAYDIGAN_hodisa_etiborsiz_qoldiriladi()
    {
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T10:00:00"),
            Moved("a", "s1", "s2", "vaqt-emas"),   // o'qib bo'lmaydi → oraliq YOPILMAYDI
        };

        Assert.Empty(LeadAnalytics.StageDurations(events));
    }

    [Fact]
    public void AvgHours_TESKARI_oraliq_olchanmaydi()
    {
        // Yozuvlar vaqt MATNI bo'yicha tartiblanadi; format buzilgan bo'lsa (bir xil vaqt turlicha
        // yozilgan) tartib haqiqiy vaqtga mos kelmay, oraliq manfiy chiqishi mumkin — sanalmaydi.
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T10:00:00"),
            Moved("a", "s1", "s2", "2026-5-1T09:00:00"),
        };

        Assert.Empty(LeadAnalytics.StageDurations(events));
    }

    [Fact]
    public void AvgHours_faqat_bosqich_hodisalaridan_hisoblanadi()
    {
        // "note" turidagi hodisa oraliqni yopmaydi ham, ochmaydi ham.
        var events = new[]
        {
            Created("a", "s1", "2026-05-01T08:00:00"),
            new LeadAnalytics.EventRow("a", "note", "", "", null, "Menejer", "2026-05-01T09:00:00"),
            Moved("a", "s1", "s2", "2026-05-01T10:00:00"),
        };

        var d = LeadAnalytics.StageDurations(events);

        Assert.Equal(2.0, d["s1"].Hours);
        Assert.Equal(1, d["s1"].Samples);
    }

    // ===================== 3) Menejerlar =====================

    [Fact]
    public void Menejerlar_ActorUserId_boyicha_guruhlanadi()
    {
        var events = new[]
        {
            Moved("a", "s1", "s2", "2026-05-01T10:00:00", "u1", "Ali"),
            Moved("a", "s2", "s3", "2026-05-01T11:00:00", "u1", "Ali"),
            Moved("b", "s1", "s2", "2026-05-01T12:00:00", "u1", "Ali"),
            Moved("c", "s1", "s2", "2026-05-01T13:00:00", "u2", "Vali"),
            Converted("a", "2026-05-02T09:00:00", "u1", "Ali"),
        };

        var rows = LeadAnalytics.BuildManagers(events);

        var ali = rows.Single(r => r.UserId == "u1");
        Assert.Equal("Ali", ali.Name);
        Assert.Equal(3, ali.Moves);      // uchta bosqich o'zgarishi
        Assert.Equal(2, ali.Leads);      // ikkita HAR XIL lid (a, b)
        Assert.Equal(1, ali.Won);

        var vali = rows.Single(r => r.UserId == "u2");
        Assert.Equal(1, vali.Moves);
        Assert.Equal(1, vali.Leads);
        Assert.Equal(0, vali.Won);

        // Eng ko'p ishlagani yuqorida.
        Assert.Equal("u1", rows[0].UserId);
    }

    [Fact]
    public void Menejer_FAQAT_aylantirgan_bolsa_ham_jadvalda_KORINADI()
    {
        // Bosqichni boshqa xodim ko'chirgan, lidni o'quvchiga esa BOSHQA menejer aylantirgan.
        // Guruhlash faqat `stage` bo'yicha bo'lsa, aylantirgan menejer jadvalga umuman tushmasdi
        // va uning yutug'i JIMGINA yo'qolardi — holbuki konversiya eng muhim ko'rsatkich.
        var events = new[]
        {
            Moved("a", "s1", "s2", "2026-05-01T10:00:00", "u1", "Ali"),
            Converted("a", "2026-05-02T09:00:00", "u2", "Vali"),
        };

        var rows = LeadAnalytics.BuildManagers(events);

        var vali = rows.Single(r => r.UserId == "u2");
        Assert.Equal(1, vali.Won);
        Assert.Equal(0, vali.Moves);     // bosqich ko'chirmagan — `Moves` ta'rifi o'zgarmaydi
        Assert.Equal(1, vali.Leads);
        // Natija faollikdan ustun: yutug'i bori tepada.
        Assert.Equal("u2", rows[0].UserId);
    }

    [Fact]
    public void Menejerlar_ActorUserId_BOSH_yozuvlar_umuman_tashlab_yuboriladi()
    {
        // Eski yozuvlar va tizim (sayt/daraja testi) hodisalari — "Noma'lum" qatoriga YIG'ILMAYDI.
        var events = new[]
        {
            Moved("a", "s1", "s2", "2026-05-01T10:00:00", null, "Admin"),
            Moved("b", "s1", "s2", "2026-05-01T11:00:00", "", "Admin"),
            Moved("c", "s1", "s2", "2026-05-01T12:00:00", "  ", "Admin"),
            Created("d", "s1", "2026-05-01T13:00:00"),
            Moved("e", "s1", "s2", "2026-05-01T14:00:00", "u1", "Ali"),
        };

        var rows = LeadAnalytics.BuildManagers(events);

        Assert.Single(rows);
        Assert.Equal("u1", rows[0].UserId);
        Assert.DoesNotContain(rows, r => r.Name == "Noma'lum");
    }

    [Fact]
    public void Menejer_ismi_JORIY_royxatdan_olinadi_bolmasa_hodisadagi_oxirgisi()
    {
        var events = new[]
        {
            Moved("a", "s1", "s2", "2026-05-01T10:00:00", "u1", "Eski Ism"),
            Moved("b", "s1", "s2", "2026-05-02T10:00:00", "u1", "Yangi Ism"),
        };

        Assert.Equal("Yangi Ism", LeadAnalytics.BuildManagers(events)[0].Name);
        Assert.Equal("Toʻgʻri Ism",
            LeadAnalytics.BuildManagers(events, new Dictionary<string, string> { ["u1"] = "Toʻgʻri Ism" })[0].Name);
    }

    [Fact]
    public void Menejerning_Won_soni_bir_lidni_ikki_marta_sanamaydi()
    {
        var events = new[]
        {
            Moved("a", "s1", "s2", "2026-05-01T10:00:00", "u1"),
            Converted("a", "2026-05-02T09:00:00", "u1"),
            Converted("a", "2026-05-02T09:05:00", "u1"),   // dublikat yozuv
        };

        Assert.Equal(1, LeadAnalytics.BuildManagers(events)[0].Won);
    }

    // ===================== 4) Manbalar =====================

    [Fact]
    public void Manbalar_nomi_malumotnomadan_yechiladi()
    {
        var leads = new[]
        {
            Lead("a", "s1", source: "src-1"),        // id bo'yicha
            Lead("b", "s1", source: "instagram"),    // nom bo'yicha (registr farqisiz)
            Lead("c", "s1", source: "Landing"),      // ma'lumotnomada yo'q — o'zi
            Lead("d", "s1", source: ""),             // yozilmagan
        };
        var sources = new[]
        {
            new LeadAnalytics.SourceRow("src-1", "Tanishlar"),
            new LeadAnalytics.SourceRow("src-2", "Instagram"),
        };

        var slices = LeadAnalytics.BuildSources(leads, sources);

        Assert.Equal("Tanishlar", slices.Single(s => s.Source == "src-1").Label);
        Assert.Equal("Instagram", slices.Single(s => s.Source == "instagram").Label);
        Assert.Equal("Landing", slices.Single(s => s.Source == "Landing").Label);
        Assert.Equal("Noma'lum", slices.Single(s => s.Source == "").Label);
        Assert.All(slices, s => Assert.Equal(25, s.Pct));
    }

    [Fact]
    public void Manbalar_kopidan_kamiga_tartiblanadi_va_KESILMAYDI()
    {
        var leads = new List<LeadAnalytics.LeadRow>();
        for (var i = 0; i < 12; i++) leads.Add(Lead($"x{i}", "s1", source: $"m{i}"));
        leads.Add(Lead("y", "s1", source: "m0"));

        var slices = LeadAnalytics.BuildSources(leads, []);

        Assert.Equal(12, slices.Count);      // hammasi qaytadi — "Boshqa"ga yig'ish frontendda
        Assert.Equal("m0", slices[0].Source);
        Assert.Equal(2, slices[0].Count);
    }

    // ===================== 5) Umumiy yig'ma va davr filtri =====================

    [Fact]
    public void Build_davrni_Lead_CreatedAt_boyicha_filtrlaydi_chegaralar_KIRADI()
    {
        var leads = new[]
        {
            Lead("a", "s1", createdAt: "2026-04-30T23:59:00"),
            Lead("b", "s1", createdAt: "2026-05-01T00:00:00"),
            Lead("c", "s1", createdAt: "2026-05-31T23:59:00"),
            Lead("d", "s1", createdAt: "2026-06-01T00:01:00"),
        };

        var res = LeadAnalytics.Build(leads, [], Stages, [], "2026-05-01", "2026-05-31");

        Assert.Equal(2, res.Total);
        Assert.Equal("2026-05-01", res.From);
        Assert.Equal("2026-05-31", res.To);

        // Davr berilmasa — hammasi.
        Assert.Equal(4, LeadAnalytics.Build(leads, [], Stages, []).Total);
        Assert.Equal(3, LeadAnalytics.Build(leads, [], Stages, [], from: "2026-05-01").Total);
        Assert.Equal(2, LeadAnalytics.Build(leads, [], Stages, [], to: "2026-05-01").Total);
    }

    [Fact]
    public void Build_davrdan_TASHQARIDAGI_lidlarning_hodisalari_hisobga_kirmaydi()
    {
        var leads = new[] { Lead("ichkarida", "s2", createdAt: "2026-05-10T09:00:00") };
        var events = new[]
        {
            Moved("ichkarida", "s1", "s2", "2026-05-10T10:00:00", "u1"),
            Moved("tashqarida", "s1", "s2", "2026-05-10T10:00:00", "u2"),   // lidi filtrga tushmagan
        };

        var res = LeadAnalytics.Build(leads, events, Stages, [], "2026-05-01", "2026-05-31");

        Assert.Single(res.Managers);
        Assert.Equal("u1", res.Managers[0].UserId);
    }

    [Fact]
    public void Build_konversiya_foizi()
    {
        var leads = new[]
        {
            Lead("a", "s4", converted: true), Lead("b", "s4", converted: true),
            Lead("c", "s2"), Lead("d", "s1"),
        };

        var res = LeadAnalytics.Build(leads, [], Stages, []);

        Assert.Equal(4, res.Total);
        Assert.Equal(2, res.Converted);
        Assert.Equal(50, res.ConversionRate);
    }

    [Fact]
    public void Build_BOSH_malumotda_yiqilmaydi()
    {
        var res = LeadAnalytics.Build([], [], [], []);

        Assert.Equal(0, res.Total);
        Assert.Equal(0, res.Converted);
        Assert.Equal(0, res.ConversionRate);
        Assert.Empty(res.Funnel);
        Assert.Empty(res.Sources);
        Assert.Empty(res.Managers);
        Assert.Equal("", res.From);
        Assert.Equal("", res.To);

        // Bosqichlar bor, lid yo'q — voronka bo'sh qatorlar bilan qaytadi.
        var faqatBosqich = LeadAnalytics.Build([], [], Stages, [], "2026-01-01", "2026-12-31");
        Assert.Equal(4, faqatBosqich.Funnel.Count);
        Assert.All(faqatBosqich.Funnel, f => Assert.Equal(0, f.Reached));
        Assert.All(faqatBosqich.Funnel, f => Assert.Null(f.AvgHours));
    }

    [Fact]
    public void Build_notogri_sanali_lidlar_davr_berilganda_tashlanadi()
    {
        var leads = new[] { Lead("a", "s1", createdAt: ""), Lead("b", "s1", createdAt: "2026-05-10T09:00:00") };

        Assert.Equal(2, LeadAnalytics.Build(leads, [], Stages, []).Total);              // filtr yo'q — hammasi
        Assert.Equal(1, LeadAnalytics.Build(leads, [], Stages, [], "2026-05-01").Total); // filtr bor — sanasi yo'q lid tushmaydi
    }
}
