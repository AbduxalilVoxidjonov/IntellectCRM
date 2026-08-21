using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// Graph API'ni soxtalashtiruvchi handler: javob TURI so'rov YO'LIGA qarab tanlanadi
/// (akkaunt / iyerarxiya / insights).
///
/// <para><see cref="RecordingHandler"/> dan farqi shu: bitta sinxronizatsiyada to'rt xil so'rov
/// ketadi va ularga BIR XIL javob bersak, iyerarxiya javobi insights deb o'qilib, test hech
/// narsani isbotlamasdi.</para>
///
/// <para><see cref="Requests"/> — "tashqariga so'rov KETDIMI?" degan savolga javob beradi
/// (modul o'chiq bo'lsa ketmasligi kerak) va qayta urinishlarni ham ko'rsatadi.</para>
/// </summary>
internal sealed class MetaGraphHandler : HttpMessageHandler
{
    public List<string> Requests { get; } = new();

    public string AccountJson { get; set; } =
        """{"id":"act_1","name":"Intellect","currency":"UZS","timezone_name":"Asia/Tashkent","account_status":1}""";

    public string EntitiesJson { get; set; } = """{"data":[]}""";

    public string InsightsJson { get; set; } = """{"data":[]}""";

    /// <summary>Bo'sh bo'lmasa — BARCHA so'rovlar shu xato bilan yiqiladi (HTTP 400).</summary>
    public string ErrorJson { get; set; } = "";

    /// <summary>Faqat insights so'rovlari (qayta urinish va bo'laklarni sanash uchun).</summary>
    public List<string> InsightRequests => Requests.FindAll(r => r.Contains("/insights", StringComparison.Ordinal));

    /// <summary>Har insights so'rovidagi <c>time_range</c> — <c>(since, until)</c>.</summary>
    public List<(string Since, string Until)> Ranges
    {
        get
        {
            var list = new List<(string, string)>();
            foreach (var r in InsightRequests)
            {
                var m = Regex.Match(Uri.UnescapeDataString(r),
                    "\"since\":\"(\\d{4}-\\d{2}-\\d{2})\",\"until\":\"(\\d{4}-\\d{2}-\\d{2})\"");
                if (m.Success) list.Add((m.Groups[1].Value, m.Groups[2].Value));
            }
            return list;
        }
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var uri = request.RequestUri!;
        Requests.Add(uri.ToString());

        var (status, body) = ErrorJson.Length > 0
            ? (HttpStatusCode.BadRequest, ErrorJson)
            : (HttpStatusCode.OK, BodyFor(uri.AbsolutePath));

        return Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
        });
    }

    private string BodyFor(string path)
    {
        if (path.EndsWith("/insights", StringComparison.Ordinal)) return InsightsJson;
        if (path.EndsWith("/campaigns", StringComparison.Ordinal)
            || path.EndsWith("/adsets", StringComparison.Ordinal)
            || path.EndsWith("/ads", StringComparison.Ordinal)) return EntitiesJson;
        return AccountJson;
    }
}

/// <summary>
/// REKLAMA STATISTIKASI SINXRONIZATSIYASI (<see cref="MetaInsightsService"/>) — uchdan-uchgacha
/// testlar (SQLite + soxta Graph). Rasmiy manba: <c>KENGAYTIRISH-PROMPT.md</c> §4.5–§4.6.
///
/// <para><b>Nima test qilinadi va nega AYNAN shular:</b></para>
/// <list type="number">
///   <item><b>Modul darvozasi</b> — o'chiq bo'lsa tashqariga BITTA ham so'rov ketmasligi
///         (qoidaning eng qattiq qismi: "bayroq o'chiq = tashqi dunyo bilan aloqa yo'q").</item>
///   <item><b>Upsert</b> — Meta oxirgi kunlarni QAYTA yuboradi; kalit ishlamasa har
///         sinxronizatsiya sarfni ikkilantirib yuborardi.</item>
///   <item><b>Bo'laklash</b> — birinchi yuklash 10 kunlik bo'laklarga bo'linadi, aks holda
///         so'rov "juda ko'p ma'lumot" xatosiga urilardi.</item>
///   <item><b>Token xatosi</b> — QAYTA URINILMAYDI (bizning 4xx xatolarimiz kvotani
///         kamaytiradi) va sabab akkauntga yozib qo'yiladi.</item>
/// </list>
/// </summary>
public class MetaInsightsServiceTests
{
    private const string Act = "act_1";

    private static string Fmt(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Insights javobining bitta qatori (bitta e'lon × bitta kun × Instagram).</summary>
    private static string InsightsBody(string date, string spend, long impressions = 1000, int leads = 3) =>
        $$"""
        {"data":[{"ad_id":"ad-1","adset_id":"adset-1","campaign_id":"camp-1",
          "date_start":"{{date}}","date_stop":"{{date}}","publisher_platform":"instagram",
          "impressions":"{{impressions}}","reach":"800","clicks":"40","inline_link_clicks":"25",
          "spend":"{{spend}}","attribution_setting":"7d_click",
          "actions":[{"action_type":"onsite_conversion.lead_grouped","value":"{{leads}}"}]}]}
        """;

    private static async Task<(MetaInsightsService Svc, MetaGraphHandler Handler)> BuildAsync(
        TestDb db, bool enabled, int backfillDays = 90, string lastSyncAt = "", string currency = "UZS")
    {
        db.Context.CenterMeta.Add(new CenterMeta
        {
            InstagramEnabled = false,                    // ⚠️ AI agenti O'CHIQ — statistika undan MUSTAQIL
            InstagramAdsStatsEnabled = enabled,
            InstagramAdsBackfillDays = backfillDays,
            InstagramNotifyTelegram = false,
        });

        db.Context.IgAdAccounts.Add(new IgAdAccount
        {
            AdAccountId = Act,
            Name = "Intellect",
            Currency = currency,
            CurrencyOffset = 2,
            TimezoneName = "Asia/Tashkent",
            AccessToken = "tok",
            IsActive = true,
            ConnectedAt = AppClock.Iso(),
            LastSyncAt = lastSyncAt,
        });

        await db.Context.SaveChangesAsync();

        var handler = new MetaGraphHandler();
        var api = new MetaInsightsApi(new HttpClient(handler), NullLogger<MetaInsightsApi>.Instance);
        var telegram = new TelegramService(new NoNetworkHttpClientFactory(), NullLogger<TelegramService>.Instance);

        return (new MetaInsightsService(db.Context, api, telegram, NullLogger<MetaInsightsService>.Instance), handler);
    }

    /// <summary>
    /// ⚠️ MODUL DARVOZASI: bayroq o'chiq bo'lsa Graph'ga HECH QANDAY so'rov ketmaydi va bazaga
    /// hech narsa yozilmaydi. Akkaunt ulangan va tokeni bor bo'lsa ham.
    /// </summary>
    [Fact]
    public async Task Modul_ochiq_bolsa_tashqariga_sorov_ketmaydi()
    {
        using var db = TestDb.Sqlite();
        var (svc, handler) = await BuildAsync(db, enabled: false);

        var (ok, rows, error) = await svc.SyncAsync(CancellationToken.None);

        Assert.False(ok);
        Assert.Equal(0, rows);
        Assert.Contains("o'chirilgan", error);
        Assert.Empty(handler.Requests);
        Assert.Empty(await db.Context.IgAdInsights.ToListAsync());

        // Xato akkauntga ham yozilmaydi: bu nosozlik emas, SOZLAMA.
        Assert.Equal("", (await db.Context.IgAdAccounts.SingleAsync()).LastError);
    }

    /// <summary>
    /// ⚠️ UPSERT: bir xil <c>(Level, ExternalId, StatDate, Platform)</c> ikki marta
    /// sinxronlanganda BITTA qator qoladi va qiymat YANGILANADI (Meta atributsiyani keyin
    /// tuzatadi). Aks holda har kunlik sinxronizatsiya sarfni ikkilantirardi.
    /// </summary>
    [Fact]
    public async Task Qayta_sinxronda_dublikat_yaratilmaydi()
    {
        using var db = TestDb.Sqlite();
        var (svc, handler) = await BuildAsync(db, enabled: true);

        var day = Fmt(AppClock.Today.AddDays(-3));
        handler.InsightsJson = InsightsBody(day, "312.45", impressions: 1000, leads: 3);

        var first = await svc.SyncRangeAsync(day, day, CancellationToken.None);
        Assert.True(first.Ok, first.Error);
        Assert.Equal(1, first.Rows);

        // Meta o'sha kunni QAYTA yubordi — sarf ham, lid soni ham o'zgargan.
        handler.InsightsJson = InsightsBody(day, "400.00", impressions: 1500, leads: 5);
        var second = await svc.SyncRangeAsync(day, day, CancellationToken.None);
        Assert.True(second.Ok, second.Error);

        var row = await db.Context.IgAdInsights.SingleAsync();
        Assert.Equal(MetaInsightsParser.LevelAd, row.Level);
        Assert.Equal("ad-1", row.ExternalId);
        Assert.Equal(day, row.StatDate);
        Assert.Equal("instagram", row.Platform);

        // "400.00" × 10^2 = 40000 minor (UZS offset 2).
        Assert.Equal(40000, row.SpendMinor);
        Assert.Equal(1500, row.Impressions);
        Assert.Equal(5, row.LeadsOnsite);
        Assert.Equal(Act, row.AdAccountId);
    }

    /// <summary>
    /// ⚠️ BIRINCHI ULANISH (<c>LastSyncAt</c> bo'sh) — backfill 10 kunlik BO'LAKLARGA bo'linadi.
    /// Bo'laklar uzluksiz va oxirgisi bugun bilan tugaydi (chegaradagi kun tushib qolmasin).
    /// </summary>
    [Fact]
    public async Task Birinchi_ulanishda_oraliq_bolaklarga_bolinadi()
    {
        using var db = TestDb.Sqlite();
        var (svc, handler) = await BuildAsync(db, enabled: true, backfillDays: 25);

        var (ok, _, error) = await svc.SyncAsync(CancellationToken.None);
        Assert.True(ok, error);

        var ranges = handler.Ranges;
        Assert.Equal(3, ranges.Count);                          // 25 kun → 10 + 10 + 5

        var today = AppClock.Today;                             // akkaunt zonasi = Asia/Tashkent
        Assert.Equal(Fmt(today.AddDays(-24)), ranges[0].Since);
        Assert.Equal(Fmt(today), ranges[^1].Until);

        for (var i = 0; i < ranges.Count; i++)
        {
            var from = DateOnly.ParseExact(ranges[i].Since, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            var to = DateOnly.ParseExact(ranges[i].Until, "yyyy-MM-dd", CultureInfo.InvariantCulture);

            Assert.True(from <= to);
            Assert.True(to.DayNumber - from.DayNumber + 1 <= MetaInsightsService.ChunkDays);

            if (i > 0)
            {
                var prevTo = DateOnly.ParseExact(ranges[i - 1].Until, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                Assert.Equal(prevTo.AddDays(1), from);          // uzluksiz — kun tushib qolmaydi
            }
        }

        // Muvaffaqiyatdan keyin "birinchi yuklash" holati yopiladi: ertaga faqat oxirgi kunlar.
        Assert.NotEqual("", (await db.Context.IgAdAccounts.SingleAsync()).LastSyncAt);
    }

    /// <summary>
    /// ⚠️ TOKEN XATOSI (190): QAYTA URINILMAYDI — Meta kvotasi formulasida `− 0.001 × xatolar`
    /// bor, ya'ni takroriy urinish ahvolni yomonlashtiradi. Sabab akkauntga yoziladi, aks holda
    /// nosozlik "reklama ishlayapti, statistika yangilanmayapti" bo'lib bir oydan keyin
    /// sezilardi.
    /// </summary>
    [Fact]
    public async Task Token_xatosida_qayta_urinilmaydi()
    {
        using var db = TestDb.Sqlite();
        var (svc, handler) = await BuildAsync(db, enabled: true, backfillDays: 30);

        handler.ErrorJson =
            """{"error":{"message":"Error validating access token","type":"OAuthException","code":190}}""";

        var (ok, rows, error) = await svc.SyncAsync(CancellationToken.None);

        Assert.False(ok);
        Assert.Equal(0, rows);
        Assert.Contains("token", error, StringComparison.OrdinalIgnoreCase);

        // Bitta so'rov — iyerarxiyaning birinchisi. Qayta urinish ham, keyingi bo'laklar ham yo'q.
        Assert.Single(handler.Requests);
        Assert.Empty(handler.InsightRequests);

        var acc = await db.Context.IgAdAccounts.SingleAsync();
        Assert.Contains("token", acc.LastError, StringComparison.OrdinalIgnoreCase);

        // ⚠️ LastSyncAt YANGILANMAYDI — ertaga backfill boshidan takrorlanadi (upsert tufayli
        // bu zararsiz), yarim yuklangan tarix esa hisobotda jimgina teshik qoldirardi.
        Assert.Equal("", acc.LastSyncAt);
    }

    /* =============================================================================================
     *  XATO TASNIFI — avval Meta KODI, keyin matn
     * ========================================================================================== */

    /// <summary>
    /// ⚠️ Qaror KOD bo'yicha qabul qilinishi kerak: xato matni foydalanuvchiga ko'rsatiladigan
    /// jumla va uni tahrirlash normal ish. Ilgari mantiq faqat `Contains("qisqartiring")` ga
    /// tayanardi — bitta so'z o'zgarsa backfill hech qachon BO'LINMAY qolardi.
    /// </summary>
    [Fact]
    public void Xato_kodi_matndan_ustun()
    {
        // Matn butunlay boshqa narsa deyapti, kod esa "juda ko'p ma'lumot".
        Assert.Equal(
            MetaInsightsService.SyncFailure.Shrink,
            MetaInsightsService.Classify(100, 1487534, "butunlay boshqacha yozilgan xato matni"));

        // Token/ruxsat — odam aralashuvi kerak, qayta urinish behuda.
        Assert.Equal(MetaInsightsService.SyncFailure.Fatal, MetaInsightsService.Classify(190, 0, "..."));
        Assert.Equal(MetaInsightsService.SyncFailure.Fatal, MetaInsightsService.Classify(200, 0, "..."));

        // Kvota — TO'XTAYMIZ (Meta: davom etilsa blok uzayadi).
        Assert.Equal(MetaInsightsService.SyncFailure.Stop, MetaInsightsService.Classify(80000, 2446079, "..."));
    }

    /// <summary>Kod bo'lmasa (tarmoq uzilishi, timeout) qaror MATNDAN olinadi — eski xulq saqlanadi.</summary>
    [Fact]
    public void Kod_yoq_bolsa_matnga_tushiladi()
    {
        Assert.Equal(
            MetaInsightsService.SyncFailure.Shrink,
            MetaInsightsService.Classify(0, 0, "Juda ko'p ma'lumot — sana oralig'ini qisqartiring."));
        Assert.Equal(
            MetaInsightsService.SyncFailure.Fatal,
            MetaInsightsService.Classify(0, 0, "Meta tokeni yaroqsiz."));
    }

    /// <summary>⚠️ Noma'lum kod ham, noma'lum matn ham — XAVFSIZ tomon: to'xtaymiz.
    /// Davom etib Meta blokini uzaytirishdan ko'ra kutish arzonroq.</summary>
    [Fact]
    public void Nomalum_xato_toxtatadi()
    {
        Assert.Equal(MetaInsightsService.SyncFailure.Stop, MetaInsightsService.Classify(999999, 0, "kutilmagan"));
        Assert.Equal(MetaInsightsService.SyncFailure.Stop, MetaInsightsService.Classify(0, 0, ""));
        Assert.Equal(MetaInsightsService.SyncFailure.Stop, MetaInsightsService.Classify(0, 0, null));
    }
}
