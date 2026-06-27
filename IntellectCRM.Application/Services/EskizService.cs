using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Eskiz.uz SMS shlyuzi (https://notify.eskiz.uz). Login/parol/sender BAZADAN (CenterMeta) o'qiladi —
/// admin "Sozlamalar → SMS (Eskiz)"dan kiritadi (FcmService kabi — har chaqiruvda DB'dan). Bearer token
/// CenterMeta'da keshlanadi (~30 kun); SMS yuborishda muddati tekshiriladi, eskirsa qayta login qilinadi.
/// 401 qaytsa token yangilanib bir marta qayta urinadi. IHttpClientFactory ishlatiladi (singleton).
/// </summary>
public class EskizService(
    IConfiguration config, IHttpClientFactory httpFactory, ILogger<EskizService> logger)
{
    // Login/parol/sender — avval CenterMeta (admin Sozlamalar), bo'sh bo'lsa .env / appsettings
    // (Eskiz__Email / Eskiz__Password / Eskiz__From) zaxira sifatida ishlatiladi.
    private string EmailOf(CenterMeta? m) =>
        !string.IsNullOrWhiteSpace(m?.EskizEmail) ? m!.EskizEmail.Trim() : (config["Eskiz:Email"] ?? "").Trim();
    private string PasswordOf(CenterMeta? m) =>
        !string.IsNullOrWhiteSpace(m?.EskizPassword) ? m!.EskizPassword.Trim() : (config["Eskiz:Password"] ?? "").Trim();

    public bool IsConfigured(CenterMeta? m) =>
        !string.IsNullOrWhiteSpace(EmailOf(m)) && !string.IsNullOrWhiteSpace(PasswordOf(m));

    public string SenderOf(CenterMeta? m) =>
        !string.IsNullOrWhiteSpace(m?.EskizFrom) ? m!.EskizFrom.Trim()
        : !string.IsNullOrWhiteSpace(config["Eskiz:From"]) ? config["Eskiz:From"]!.Trim()
        : "4546";

    /// <summary>Ko'rsatish uchun amaldagi email (DB yoki .env).</summary>
    public string DisplayEmail(CenterMeta? m) => EmailOf(m);

    private string BaseUrl => (config["Eskiz:BaseUrl"] ?? "https://notify.eskiz.uz").TrimEnd('/');
    private HttpClient Client() => httpFactory.CreateClient("eskiz");

    /// <summary>Telefonni Eskiz formatiga keltiradi: faqat raqam, 998 prefiks bilan (998901234567).</summary>
    public static string NormalizePhone(string? phone)
    {
        var d = PhoneUtil.DigitsOnly(phone);
        if (d.Length == 9) d = "998" + d;                       // 901234567 -> 998901234567
        else if (d.Length > 9 && !d.StartsWith("998")) d = "998" + d[^9..];
        return d;
    }

    /// <summary>Keshlangan (yaroqli) tokenni qaytaradi; yo'q/eskirgan yoki <paramref name="forceRefresh"/>
    /// bo'lsa login qiladi va CenterMeta'ga saqlaydi. (token, error).</summary>
    public async Task<(string? Token, string? Error)> GetTokenAsync(
        IAppDbContext db, bool forceRefresh = false, CancellationToken ct = default)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (!IsConfigured(meta)) return (null, "Eskiz login/parol sozlanmagan.");

        if (!forceRefresh && meta is not null && !string.IsNullOrWhiteSpace(meta.EskizToken)
            && meta.EskizTokenExpiresAt is { } exp && exp > DateTime.UtcNow.AddDays(1))
            return (meta.EskizToken, null);

        // .env orqali sozlangan, lekin CenterMeta qatori bo'lmasa — tokenni keshlash uchun yaratamiz.
        if (meta is null) { meta = new CenterMeta(); db.CenterMeta.Add(meta); }

        try
        {
            using var form = new MultipartFormDataContent
            {
                { new StringContent(EmailOf(meta)), "email" },
                { new StringContent(PasswordOf(meta)), "password" },
            };
            var resp = await Client().PostAsync($"{BaseUrl}/api/auth/login", form, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                return (null, $"Eskiz login xato ({(int)resp.StatusCode}). Login/parolni tekshiring.");
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("data", out var data) ||
                !data.TryGetProperty("token", out var tok) || tok.GetString() is not { Length: > 0 } token)
                return (null, "Eskiz token qaytmadi.");

            meta.EskizToken = token;
            meta.EskizTokenExpiresAt = DateTime.UtcNow.AddDays(29);
            await db.SaveChangesAsync(ct);
            return (token, null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Eskiz login xatosi");
            return (null, "Eskiz bilan bog'lanishda xatolik.");
        }
    }

    public record SmsResult(bool Ok, string RequestId, string Status, string? Error);

    /// <summary>Bitta raqamga SMS yuboradi (token + 401 retry bilan). RequestId/status qaytaradi.</summary>
    public async Task<SmsResult> SendSmsAsync(
        IAppDbContext db, string phone, string message, string? callbackUrl = null, CancellationToken ct = default)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (!IsConfigured(meta)) return new SmsResult(false, "", "error", "Eskiz sozlanmagan.");
        var from = SenderOf(meta);
        var mobile = NormalizePhone(phone);
        if (mobile.Length < 12) return new SmsResult(false, "", "error", "Telefon raqami noto'g'ri.");

        var (token, err) = await GetTokenAsync(db, false, ct);
        if (token is null) return new SmsResult(false, "", "error", err);

        var (result, unauthorized) = await TrySendAsync(token, mobile, message, from, callbackUrl, ct);
        if (unauthorized)
        {
            // Token eskirgan/yaroqsiz — yangilab bir marta qayta urinamiz.
            (token, err) = await GetTokenAsync(db, true, ct);
            if (token is null) return new SmsResult(false, "", "error", err);
            (result, _) = await TrySendAsync(token, mobile, message, from, callbackUrl, ct);
        }
        return result;
    }

    private async Task<(SmsResult Result, bool Unauthorized)> TrySendAsync(
        string token, string mobile, string message, string from, string? callbackUrl, CancellationToken ct)
    {
        try
        {
            using var form = new MultipartFormDataContent
            {
                { new StringContent(mobile), "mobile_phone" },
                { new StringContent(message), "message" },
                { new StringContent(from), "from" },
            };
            if (!string.IsNullOrWhiteSpace(callbackUrl))
                form.Add(new StringContent(callbackUrl), "callback_url");

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/message/sms/send")
            { Content = form };
            req.Headers.Add("Authorization", $"Bearer {token}");
            var resp = await Client().SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                return (new SmsResult(false, "", "error", "Token yaroqsiz."), true);

            if (!resp.IsSuccessStatusCode)
            {
                var msg = TryGetMessage(body) ?? $"Eskiz xato ({(int)resp.StatusCode}).";
                return (new SmsResult(false, "", "error", msg), false);
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var id = root.TryGetProperty("id", out var idEl) ? (idEl.GetString() ?? idEl.ToString()) : "";
            var status = root.TryGetProperty("status", out var stEl) ? (stEl.GetString() ?? "") : "waiting";
            if (string.IsNullOrEmpty(id) && string.IsNullOrEmpty(status))
                return (new SmsResult(false, "", "error", TryGetMessage(body) ?? "Noma'lum javob."), false);
            return (new SmsResult(true, id, string.IsNullOrEmpty(status) ? "waiting" : status, null), false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Eskiz SMS yuborish xatosi");
            return (new SmsResult(false, "", "error", "Yuborishda xatolik."), false);
        }
    }

    /// <summary>Hisobdagi qoldiq (balans). Xato bo'lsa null.</summary>
    public async Task<decimal?> GetBalanceAsync(IAppDbContext db, CancellationToken ct = default)
    {
        var (token, _) = await GetTokenAsync(db, false, ct);
        if (token is null) return null;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/api/user/get-limit");
            req.Headers.Add("Authorization", $"Bearer {token}");
            var resp = await Client().SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("balance", out var bal))
                return bal.ValueKind == JsonValueKind.Number ? bal.GetDecimal()
                    : decimal.TryParse(bal.GetString(), out var b) ? b : null;
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Eskiz balans xatosi");
            return null;
        }
    }

    private static string? TryGetMessage(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("message", out var m))
                return m.ValueKind == JsonValueKind.String ? m.GetString() : m.ToString();
        }
        catch { /* ignore */ }
        return null;
    }
}
