using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using IntellectCRM.Infrastructure.Data;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// INSTAGRAM — OCHIQ (login talab qilmaydigan) kirish nuqtalari. Uchta marshrut bor va uchalasi
/// ham <b>Meta tomonidan</b> chaqiriladi, ya'ni ularga bizning JWT'imiz kelmaydi:
/// <list type="bullet">
///   <item><c>GET /webhook</c> — Meta manzilni ro'yxatga olayotganda yuboradigan tasdiq (verify);</item>
///   <item><c>POST /webhook</c> — izoh/DM hodisalari (imzo bilan);</item>
///   <item><c>GET /callback</c> — OAuth (akkauntni ulash) qaytish manzili.</item>
/// </list>
///
/// <para><b>⚠️ ENG MUHIM QOIDA — 5 SONIYA.</b> Meta webhook javobini ~5 soniyada kutadi; kechiksa
/// hodisani muvaffaqiyatsiz deb belgilaydi, 36 soat davomida qayta yuboradi va takrorlansa
/// webhookni butunlay o'chirib qo'yishi mumkin. AI chaqiruvi esa bundan uzoq. Shuning uchun bu
/// yerda <b>HECH QANDAY</b> AI/Graph/HTTP ishi bajarilmaydi: imzo tekshiriladi, xom JSON
/// <see cref="IgWebhookEvent"/> navbatiga yoziladi va DARHOL 200 qaytariladi. Haqiqiy ish —
/// <c>InstagramWorkerService</c> + <c>InstagramPipeline</c> da.</para>
///
/// <para><b>⚠️ FAIL-CLOSED.</b> <c>INSTAGRAM_APP_SECRET</c> bo'sh bo'lsa imzoni tekshirib
/// bo'lmaydi va so'rov RAD ETILADI (403). "Sozlanmagan bo'lsa o'tkazib yuborish" varianti
/// ATAYIN yo'q: u endpointni butunlay himoyasiz qoldirardi.</para>
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/instagram")]
public class InstagramWebhookController(
    AppDbContext db,
    InstagramApi api,
    AuditService audit,
    ILogger<InstagramWebhookController> logger) : ControllerBase
{
    /// <summary>Audit yozuvlaridagi yagona `EntityType` (`AuditSections`: `marketing`).</summary>
    private const string AuditEntity = "Instagram";


    /// <summary>Xom body uchun yuqori chegara — Meta payloadlari kichik (bir necha KB).
    /// Chegarasiz o'qish ochiq endpointda xotira hujumiga yo'l qoldirardi.</summary>
    private const int MaxBodyBytes = 512 * 1024;

    /// <summary>`EventKey` ustuni uzun bo'lib ketmasin — bundan uzun kalit hash bilan qisqartiriladi.</summary>
    private const int MaxEventKeyLength = 400;

    // =============================================================================================
    //  GET /webhook — Meta tasdig'i (verify)
    // =============================================================================================

    /// <summary>
    /// Meta webhook manzilini ro'yxatga olayotganda (va vaqti-vaqti bilan) yuboradi.
    /// Mos kelsa <c>hub.challenge</c> <b>xom matn</b> sifatida qaytariladi (JSON EMAS,
    /// qo'shtirnoqsiz), aks holda 403.
    ///
    /// <para>⚠️ Parametr nomlarida NUQTA bor (<c>hub.mode</c>) — ASP.NET model binding'i uni
    /// argumentga bog'lay olmaydi (nuqta ichma-ich obyekt deb qaraladi), shuning uchun
    /// <c>Request.Query[...]</c> dan QO'LDA o'qiladi.</para>
    /// </summary>
    [HttpGet("webhook")]
    public IActionResult Verify()
    {
        var mode = Request.Query["hub.mode"].ToString();
        var token = Request.Query["hub.verify_token"].ToString();
        var challenge = Request.Query["hub.challenge"].ToString();

        var ok = InstagramSignature.VerifyChallenge(mode, token, challenge, AppSecrets.InstagramVerifyToken);
        if (ok is null)
        {
            logger.LogWarning("[instagram] webhook verify rad etildi (mode: {Mode})", mode);
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        logger.LogInformation("[instagram] webhook verify muvaffaqiyatli");
        return Content(ok, "text/plain");
    }

    // =============================================================================================
    //  POST /webhook — hodisa qabul qilish (faqat NAVBATGA yoziladi)
    // =============================================================================================

    /// <summary>
    /// Izoh/DM hodisasi. Ketma-ketlik QAT'IY:
    /// <list type="number">
    ///   <item>xom body <b>BAYT</b> sifatida o'qiladi (deserializatsiyadan OLDIN — HMAC aynan
    ///     shu baytlardan hisoblanadi; qayta seriyalangan JSON'da bo'sh joy/kalit tartibi
    ///     o'zgarib, imzo HECH QACHON mos kelmasdi);</item>
    ///   <item>imzo tekshiriladi — xato bo'lsa 403 va body umuman ishlanmaydi;</item>
    ///   <item>navbatga (<see cref="IgWebhookEvent"/>, <c>pending</c>) yoziladi;</item>
    ///   <item>darhol 200.</item>
    /// </list>
    ///
    /// <para><b>Dedup:</b> <c>EventKey</c> ustunida UNIKAL indeks bor. Meta bir hodisani bir necha
    /// marta yuborishi mumkin (kafolat "at-least-once"); takror kelsa <c>DbUpdateException</c>
    /// ushlanadi va baribir <b>200</b> qaytariladi — aks holda Meta uni "yetkazilmadi" deb
    /// hisoblab, 36 soat davomida qayta yuboraverardi.</para>
    /// </summary>
    [HttpPost("webhook")]
    [EnableRateLimiting("instagram-webhook")]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        // (1) XOM BAYTLAR — hech qanday parse/trim/qayta seriyalashsiz.
        var raw = await ReadBodyAsync(ct);
        if (raw is null)
        {
            logger.LogWarning("[instagram] webhook body juda katta yoki o'qib bo'lmadi");
            return BadRequest();
        }

        // (2) IMZO. Bo'sh secret → `InstagramSignature.Verify` false qaytaradi (fail-closed).
        var header = Request.Headers["X-Hub-Signature-256"].ToString();
        if (!InstagramSignature.Verify(raw, header, AppSecrets.InstagramAppSecret))
        {
            logger.LogWarning("[instagram] webhook imzosi mos kelmadi — so'rov rad etildi");
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        var json = Encoding.UTF8.GetString(raw);

        // (3) NAVBATGA. Hodisa kaliti qayta ishlashdan OLDIN kerak (unikal indeks dedupni shu
        // yerda, bitta INSERT bilan bajaradi — alohida "bormi?" so'rovi poygaga ochiq bo'lardi).
        var ourIgUserId = await db.IgAccounts.AsNoTracking()
            .Where(a => a.IsActive)
            .Select(a => a.IgUserId)
            .FirstOrDefaultAsync(ct) ?? "";

        db.IgWebhookEvents.Add(new IgWebhookEvent
        {
            EventKey = BuildEventKey(json, raw, ourIgUserId),
            RawJson = json,
            Status = IgConst.EvPending,
            ReceivedAt = AppClock.Iso(),
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Takroriy hodisa (unikal indeks) — normal holat, xato EMAS.
            db.ChangeTracker.Clear();
            logger.LogInformation("[instagram] takroriy webhook hodisasi o'tkazib yuborildi");
        }

        // (4) DARHOL 200 — qolgan ishni fon xizmati bajaradi.
        return Ok();
    }

    /// <summary>
    /// Dedup kaliti. Odatda bitta POST ichida bitta hodisa keladi — u holda kalit AYNAN
    /// <c>comment_id</c> / <c>mid</c> bo'ladi (barqaror, Meta beradi). Bir necha hodisa bo'lsa
    /// ular birlashtiriladi, juda uzayib ketsa hash'ga aylantiriladi.
    ///
    /// <para>Hodisa umuman ajratilmasa (buzuq JSON, e'tiborsiz maydon yoki O'ZIMIZ yozgan izoh —
    /// parser uni tashlaydi) kalit sifatida <b>xom bodyning hash'i</b> ishlatiladi: u ham
    /// deterministik, ya'ni Meta o'sha payloadni qayta yuborsa takror yozilmaydi.</para>
    /// </summary>
    private static string BuildEventKey(string json, byte[] raw, string ourIgUserId)
    {
        var keys = new List<string>();
        try
        {
            foreach (var e in InstagramEventParser.Parse(json, ourIgUserId))
                if (!string.IsNullOrWhiteSpace(e.EventKey)) keys.Add(e.EventKey);
        }
        catch
        {
            // Parser bu yerda hech qachon yiqilmasligi kerak, lekin webhook qabul qilish
            // undan MUHIMROQ — kalitni hash'dan quramiz va hodisa navbatda qoladi.
        }

        if (keys.Count == 0) return "body:" + Sha256Hex(raw);

        var joined = string.Join("|", keys);
        return joined.Length <= MaxEventKeyLength
            ? joined
            : "multi:" + Sha256Hex(Encoding.UTF8.GetBytes(joined));
    }

    private static string Sha256Hex(byte[] data) => Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();

    /// <summary>Body'ni to'liq baytlar sifatida o'qiydi (chegaradan oshsa <c>null</c>).</summary>
    private async Task<byte[]?> ReadBodyAsync(CancellationToken ct)
    {
        try
        {
            if (Request.ContentLength is > MaxBodyBytes) return null;
            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms, ct);
            if (ms.Length > MaxBodyBytes) return null;
            return ms.ToArray();
        }
        catch
        {
            return null;
        }
    }

    // =============================================================================================
    //  GET /callback — OAuth (akkauntni ulash)
    // =============================================================================================

    /// <summary>
    /// Instagram "Allow" bosilgandan keyin foydalanuvchini SHU manzilga qaytaradi.
    /// Oqim: <c>state</c> tekshiruvi → kod → qisqa token → 60 kunlik token → <c>me</c> →
    /// <see cref="IgAccount"/> yoziladi → webhook obunasi → SPA'ga redirect.
    ///
    /// <para>⚠️ Javob har doim <b>redirect</b>: bu manzilni foydalanuvchining BRAUZERI ochadi,
    /// ya'ni u JSON emas, sahifa ko'rishi kerak. Xato bo'lsa URL'ga faqat QISQA KOD qo'shiladi
    /// (<c>?error=token</c>) — Meta'ning to'liq xato matnida token/secret bo'lakchalari bo'lishi
    /// mumkin va ular brauzer tarixiga, proxy loglariga tushib qolardi.</para>
    /// </summary>
    [HttpGet("callback")]
    [EnableRateLimiting("public-lead")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, CancellationToken ct)
    {
        // Foydalanuvchi Instagram oynasida "Cancel" bosgan bo'lsa Meta `error` bilan qaytaradi.
        if (!string.IsNullOrWhiteSpace(error)) return Back("bekor");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state)) return Back("kod");

        // --- state: mavjud, ishlatilmagan, muddati o'tmagan ---
        var st = await db.IgOAuthStates.FirstOrDefaultAsync(s => s.Id == state, ct);
        if (st is null || st.Used) return Back("state");
        if (string.Compare(st.ExpiresAt, AppClock.Iso(), StringComparison.Ordinal) < 0) return Back("muddat");
        st.Used = true;   // bir martalik — natijadan qat'i nazar yopiladi
        await db.SaveChangesAsync(ct);

        var meta = await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync(ct);
        var appId = (meta?.InstagramAppId ?? "").Trim();
        var appSecret = AppSecrets.InstagramAppSecret;
        if (appId.Length == 0 || appSecret.Length == 0) return Back("sozlama");

        var redirectUri = CallbackUrl(Request);

        // --- kod → qisqa token → uzoq token ---
        var (okCode, shortToken, _, errCode) = await api.ExchangeCodeAsync(appId, appSecret, redirectUri, code, ct);
        if (!okCode)
        {
            logger.LogWarning("[instagram] kodni almashtirib bo'lmadi: {Err}", errCode);
            return Back("kod");
        }

        var (okLong, longToken, expiresIn, errLong) = await api.ExchangeLongLivedAsync(appSecret, shortToken, ct);
        if (!okLong)
        {
            logger.LogWarning("[instagram] uzoq muddatli tokenni olib bo'lmadi: {Err}", errLong);
            return Back("token");
        }

        // --- biz kimmiz (cheksiz halqa himoyasi shu ID'ga tayanadi) ---
        var (okMe, igUserId, username, name, pictureUrl, errMe) = await api.MeAsync(longToken, ct);
        if (!okMe || string.IsNullOrWhiteSpace(igUserId))
        {
            logger.LogWarning("[instagram] akkaunt ma'lumotini olib bo'lmadi: {Err}", errMe);
            return Back("profil");
        }

        // --- webhook obunasi (comments, messages, message_echoes) ---
        // Obuna bo'lmasa hodisalar UMUMAN kelmaydi, lekin akkaunt baribir saqlanadi: holat
        // Sozlamalar sahifasida qizil ko'rinadi va "Qayta ulash" bilan tuzatiladi.
        var (okSub, errSub) = await api.SubscribeWebhookAsync(longToken, ct);
        if (!okSub) logger.LogWarning("[instagram] webhook obunasi bo'lmadi: {Err}", errSub);

        // --- saqlash: eskisi arxivga, yangisi faol ---
        var now = AppClock.Iso();
        var olds = await db.IgAccounts.Where(a => a.IsActive).ToListAsync(ct);
        foreach (var o in olds)
        {
            o.IsActive = false;
            o.AccessToken = "";   // eski token bazada qolib ketmasin
        }

        var account = new IgAccount
        {
            IgUserId = igUserId,
            Username = username ?? "",
            Name = name ?? "",
            ProfilePictureUrl = pictureUrl ?? "",
            AccessToken = longToken,
            TokenExpiresAt = AppClock.Now.AddSeconds(expiresIn > 0 ? expiresIn : 0).ToString("yyyy-MM-ddTHH:mm:ss"),
            TokenRefreshedAt = now,
            WebhookSubscribed = okSub,
            IsActive = true,
            ConnectedAt = now,
            ConnectedBy = st.CreatedBy,
        };
        db.IgAccounts.Add(account);

        // ⚠️ Bu marshrut `[AllowAnonymous]` — so'rovni foydalanuvchining brauzeri olib keladi,
        // lekin JWT'siz, ya'ni `AuditService` aktyorni "Tizim" deb yozadi. Shuning uchun oqimni
        // KIM boshlagani (`IgOAuthState.CreatedBy`) summary matniga qo'lda qo'shiladi.
        // Token/secret bu yerga HECH QACHON yozilmaydi.
        audit.Record(AuditEntity, account.Id, "create",
            $"Instagram akkaunti ulandi: @{account.Username} "
            + $"(ulagan: {(st.CreatedBy.Length > 0 ? st.CreatedBy : "noma'lum")}, "
            + $"webhook obunasi: {(okSub ? "bor" : "YO'Q")})");
        await db.SaveChangesAsync(ct);

        logger.LogInformation("[instagram] akkaunt ulandi: @{Username} (obuna: {Sub})", username, okSub);
        return Redirect("/admin/marketing/settings?connected=1");
    }

    /// <summary>Xato bilan SPA'ga qaytish — faqat QISQA KOD (maxfiy tafsilot URL'ga tushmaydi).</summary>
    private RedirectResult Back(string errorCode) =>
        Redirect("/admin/marketing/settings?error=" + Uri.EscapeDataString(errorCode));

    /// <summary>
    /// OAuth qaytish manzili — so'rov HOSTIDAN quriladi (Meta'dagi "OAuth redirect URI" bilan
    /// AYNAN bir xil bo'lishi shart, oxirida `/` YO'Q). Sozlamalar sahifasi ham xuddi shu
    /// funksiyadan olingan manzilni "nusxa olish" tugmasi bilan ko'rsatadi — ikki joyda ayri
    /// yozilsa <c>Invalid redirect_uri</c> xatosi chiqardi.
    /// </summary>
    public static string CallbackUrl(HttpRequest req) => PublicBase(req) + "/api/public/instagram/callback";

    /// <summary>Meta Dashboard'ga kiritiladigan webhook manzili.</summary>
    public static string WebhookUrl(HttpRequest req) => PublicBase(req) + "/api/public/instagram/webhook";

    /// <summary>Tashqi manzil asosi. Cloudflare Tunnel ortida sxema <c>X-Forwarded-Proto</c> dan
    /// tiklanadi (Program.cs `UseForwardedHeaders`), shuning uchun bu yerda qo'shimcha ish yo'q.</summary>
    private static string PublicBase(HttpRequest req) => $"{req.Scheme}://{req.Host}";
}
