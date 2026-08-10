using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Services;
using IntellectCRM.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace IntellectCRM.Server;

/// <summary>
/// `/uploads` DARVOZASI — yuklangan fayllar endi login talab qiladi.
///
/// <para><b>Muammo:</b> `/uploads` statik papka autentifikatsiyasiz berilardi. Manzil tasodifiy
/// GUID bo'lsa ham, uni bir marta olgan odam faylni <b>abadiy</b> ola olardi — tizimdan
/// chiqarilsa ham, ishdan bo'shatilsa ham.</para>
///
/// <para><b>Nega cookie?</b> Loyihada JWT Bearer ishlatiladi (cookie yo'q edi), brauzer esa
/// <c>&lt;img src="/uploads/..."&gt;</c> ga <c>Authorization</c> sarlavhasini YUBORMAYDI. Shuning
/// uchun login qilgan foydalanuvchiga <c>Path=/uploads</c> ga cheklangan cookie qo'yiladi —
/// brauzer uni rasm so'rovlarida o'zi yuboradi va frontend kodiga tegish kerak bo'lmaydi.
/// Bu loyihadagi mavjud yondashuv bilan bir xil: <c>/ws</c> va SignalR ham sarlavha yubora
/// olmagani uchun tokenni boshqa yo'l bilan oladi.</para>
///
/// <para><b>Cookie qanday paydo bo'ladi?</b> Alohida "login" qadami YO'Q: SPA har qanday
/// avtorizatsiyalangan API so'rovi qilganda cookie o'z-o'zidan qo'yiladi
/// (<see cref="IssueCookie"/>). Ya'ni mavjud sessiyalar ham qayta login qilmasdan ishlayveradi.</para>
///
/// <para><b>Nima OCHIQ qoladi:</b> faqat markaz LOGOTIPI — u login sahifasida, PWA manifestida va
/// ochiq vakansiya sahifasida kerak (foydalanuvchi hali kirmagan). Ro'yxat bazadan olinadi va
/// keshlanadi.</para>
///
/// <para><b>Favqulodda o'chirish:</b> <c>Uploads:RequireAuth=false</c> — kodni qayta yig'masdan
/// eski xatti-harakatga qaytaradi. Rad etilgan har so'rov logga yoziladi.</para>
/// </summary>
public sealed class UploadsGuard(
    JwtOptions jwt,
    IServiceScopeFactory scopes,
    IConfiguration config,
    ILogger<UploadsGuard> logger)
{
    /// <summary>Darvoza yoqilganmi (standart — HA).</summary>
    public bool Enabled { get; } = config.GetValue("Uploads:RequireAuth", true);

    /// <summary>Ochiq fayllar ro'yxati shuncha vaqtda bir yangilanadi (logotip kamdan-kam o'zgaradi).</summary>
    private static readonly TimeSpan PublicCacheTtl = TimeSpan.FromMinutes(1);

    private volatile IReadOnlyCollection<string> _publicNames = [];
    private DateTime _publicLoadedUtc = DateTime.MinValue;
    private readonly SemaphoreSlim _publicLock = new(1, 1);

    /// <summary>
    /// Tekshirilgan tokenlar keshi: token → amal qilish muddati (UTC).
    /// Bitta sahifada o'nlab rasm bo'lishi mumkin — har biri uchun imzoni qaytadan tekshirmaymiz.
    /// </summary>
    private readonly ConcurrentDictionary<string, DateTime> _tokenCache = new();

    private TokenValidationParameters Parameters() => new()
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
    };

    /// <summary>Token haqiqiymi (imzo/muddat/issuer/audience). Muddati — keshga yoziladi.</summary>
    private bool IsTokenValid(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;

        if (_tokenCache.TryGetValue(token, out var until))
        {
            if (until > DateTime.UtcNow) return true;
            _tokenCache.TryRemove(token, out _);   // muddati o'tgan — qaytadan tekshiriladi
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(token, Parameters(), out var validated);
            var expires = validated.ValidTo;
            if (expires <= DateTime.UtcNow) return false;

            // YUZ TASDIG'I KUTILAYOTGAN sessiya (scope=face) — `/uploads` ga KIRITILMAYDI.
            // Bu darvoza pipeline'da `UseAuthentication` dan OLDIN turadi, ya'ni `FaceScopeGate`
            // middleware'i bu so'rovni umuman ko'rmaydi. Busiz cheklangan token bilan
            // sarlavha orqali istalgan yuklangan faylni (passport skani, shartnoma) olib
            // bo'lardi — cheklangan token esa faqat SELFI yuborish uchun berilgan.
            if (validated is JwtSecurityToken jwtToken
                && jwtToken.Claims.Any(c => c.Type == JwtTokenService.FaceScopeClaimType
                                            && c.Value == JwtTokenService.FaceScopeClaimValue))
                return false;
            // Kesh cheksiz o'smasin — vaqti-vaqti bilan eskirganlarini tozalaymiz.
            if (_tokenCache.Count > 500)
                foreach (var (k, v) in _tokenCache)
                    if (v <= DateTime.UtcNow) _tokenCache.TryRemove(k, out _);
            _tokenCache[token] = expires;
            return true;
        }
        catch
        {
            return false;   // imzo/muddat/format — sabab muhim emas, natija bir xil
        }
    }

    /// <summary>So'rovdagi token: avval <c>Authorization: Bearer</c>, keyin cookie.</summary>
    private static string? TokenOf(HttpContext ctx)
    {
        var header = ctx.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return header["Bearer ".Length..].Trim();
        return ctx.Request.Cookies[UploadAccessRules.CookieName];
    }

    /// <summary>Ochiq fayllar (logotip) ro'yxati — keshdan, kerak bo'lsa bazadan yangilanadi.</summary>
    private async Task<IReadOnlyCollection<string>> PublicNamesAsync()
    {
        if (DateTime.UtcNow - _publicLoadedUtc < PublicCacheTtl) return _publicNames;
        await _publicLock.WaitAsync();
        try
        {
            if (DateTime.UtcNow - _publicLoadedUtc < PublicCacheTtl) return _publicNames;
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var urls = new List<string?>();
            urls.AddRange(await db.CenterMeta.AsNoTracking().Select(m => m.LogoUrl).ToListAsync());
            urls.AddRange(await db.CareerAbout.AsNoTracking().Select(a => a.LogoUrl).ToListAsync());
            _publicNames = UploadAccessRules.PublicNamesFrom(urls);
            _publicLoadedUtc = DateTime.UtcNow;
            return _publicNames;
        }
        catch (Exception ex)
        {
            // Baza vaqtincha yetib bo'lmasa — eski ro'yxat bilan davom etamiz (logotip yo'qolmasin).
            logger.LogWarning(ex, "Ochiq fayllar ro'yxatini yangilab bo'lmadi — eski ro'yxat ishlatiladi.");
            return _publicNames;
        }
        finally
        {
            _publicLock.Release();
        }
    }

    /// <summary>
    /// So'rovga RUXSAT bormi. <c>false</c> bo'lsa chaqiruvchi 404 qaytaradi (403 emas —
    /// faylning mavjudligini ham tasdiqlamaymiz).
    /// </summary>
    public async Task<bool> IsAllowedAsync(HttpContext ctx)
    {
        if (!Enabled) return true;
        if (IsTokenValid(TokenOf(ctx))) return true;
        return UploadAccessRules.IsPublicFile(ctx.Request.Path.Value, await PublicNamesAsync());
    }

    /// <summary>
    /// Avtorizatsiyalangan so'rovdan keyin <c>/uploads</c> uchun cookie qo'yadi (kerak bo'lsa).
    /// Alohida "login" qadami yo'q — SPA'ning har qanday API so'rovi cookie'ni tiklaydi.
    /// </summary>
    public void IssueCookie(HttpContext ctx)
    {
        if (!Enabled) return;
        var header = ctx.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return;
        var token = header["Bearer ".Length..].Trim();
        if (token.Length == 0) return;
        // Allaqachon shu token turgan bo'lsa — qayta qo'yish shart emas.
        if (ctx.Request.Cookies[UploadAccessRules.CookieName] == token) return;
        if (!IsTokenValid(token)) return;
        _tokenCache.TryGetValue(token, out var expires);

        var https = ctx.Request.IsHttps;
        ctx.Response.Cookies.Append(UploadAccessRules.CookieName, token, new CookieOptions
        {
            HttpOnly = true,                 // JS o'qiy olmaydi (XSS bilan o'g'irlanmasin)
            Secure = https,
            // Telegram Mini App SPA'ni web.telegram.org ichida IFRAME'da ochadi — u yerdan
            // kelgan rasm so'rovlari "cross-site" hisoblanadi va Lax cookie YUBORILMAYDI.
            // Shuning uchun HTTPS'da None (u Secure'ni talab qiladi); dev (http) da Lax.
            SameSite = https ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/uploads",               // API so'rovlariga umuman yuborilmaydi
            Expires = expires == default ? null : new DateTimeOffset(expires, TimeSpan.Zero),
            IsEssential = true,
        });
    }

    /// <summary>Chiqishda (logout) cookie'ni o'chirish uchun.</summary>
    public static void ClearCookie(HttpContext ctx) =>
        ctx.Response.Cookies.Delete(UploadAccessRules.CookieName, new CookieOptions { Path = "/uploads" });

    /// <summary>Rad etilgan so'rovni logga yozadi (kutilmagan mijoz shu yerdan ko'rinadi).</summary>
    public void LogDenied(HttpContext ctx) =>
        logger.LogWarning("/uploads rad etildi: {Path} (UA: {UserAgent})",
            ctx.Request.Path.Value, ctx.Request.Headers.UserAgent.ToString());
}
