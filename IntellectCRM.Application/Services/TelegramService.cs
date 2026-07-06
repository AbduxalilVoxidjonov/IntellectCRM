using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using System.Text;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Telegram Bot API bilan ishlash: e'lon yuborish (sendMessage) va bot yangilanishlarini olish
/// (getUpdates, long polling). Token endi BAZADAN (CenterMeta) — admin "Sozlamalar" bo'limidan
/// kiritadi; xizmat tokenni xotirada saqlaydi (Load startupda yuklaydi, Set saqlangach yangilaydi).
/// Eski appsettings "Telegram:BotToken" faqat birinchi marta (DB bo'sh bo'lsa) urug' sifatida ishlatiladi.
/// Token bo'sh bo'lsa xizmat "sozlanmagan" — hech narsa yubormaydi, ilova baribir ishlaydi.
/// </summary>
public class TelegramService(
    IConfiguration config, IHttpClientFactory httpFactory, ILogger<TelegramService> logger)
{
    private volatile string _token = "";
    private volatile string _username = "";
    private volatile string _name = "";

    public string BotToken => _token;
    public string BotUsername => _username;
    public string BotName => _name;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_token);

    /// <summary>Xotiradagi token/username/nom'ni yangilaydi (admin sozlamani saqlaganda chaqiriladi).</summary>
    public void Set(string? token, string? username, string? name = null)
    {
        _token = (token ?? "").Trim();
        _username = (username ?? "").Trim().TrimStart('@');
        _name = (name ?? "").Trim();
    }

    /// <summary>
    /// Startupda chaqiriladi: tokenni CenterMeta'dan yuklaydi. DB bo'sh, lekin appsettings'da token
    /// bo'lsa — uni bir marta DB'ga ko'chiradi (orqaga moslik + UI'da ko'rinishi uchun).
    /// </summary>
    public void Load(IAppDbContext db)
    {
        // Bitta markaz — tokenli CenterMeta qatorini topamiz (xotirada bitta token).
        var meta = db.CenterMeta
            .FirstOrDefault(m => m.TelegramBotToken != "");

        // Hech kimda token yo'q — eski appsettings urug'i (mavjud birinchi qatorga bir marta ko'chiriladi).
        if (meta is null)
        {
            var cfgToken = config["Telegram:BotToken"];
            if (!string.IsNullOrWhiteSpace(cfgToken))
            {
                var any = db.CenterMeta.IgnoreQueryFilters().FirstOrDefault();
                if (any is not null)
                {
                    any.TelegramBotToken = cfgToken.Trim();
                    any.TelegramBotUsername = (config["Telegram:BotUsername"] ?? "").Trim().TrimStart('@');
                    db.SaveChanges();
                    meta = any;
                }
            }
        }

        Set(meta?.TelegramBotToken, meta?.TelegramBotUsername, meta?.TelegramBotName);
    }

    private HttpClient Client() => httpFactory.CreateClient("telegram");
    private string ApiBase => $"https://api.telegram.org/bot{_token}";

    /// <summary>Berilgan chatga matn yuboradi (ixtiyoriy reply_markup bilan). Muvaffaqiyat — true.</summary>
    public async Task<bool> SendMessageAsync(
        long chatId, string text, object? replyMarkup = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return false;
        try
        {
            var payload = new Dictionary<string, object?> { ["chat_id"] = chatId, ["text"] = text };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await Client().PostAsync($"{ApiBase}/sendMessage", content, ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram sendMessage xatosi");
            return false;
        }
    }

    /// <summary>
    /// Berilgan chatga hujjat (fayl) yuboradi (sendDocument, multipart/form-data). Shartnoma
    /// .docx faylini yetkazish uchun. Muvaffaqiyat — true. Token yo'q bo'lsa — false (yubormaydi).
    /// </summary>
    public async Task<bool> SendDocumentAsync(
        long chatId, byte[] bytes, string fileName, string? caption = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return false;
        try
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(chatId.ToString()), "chat_id");
            if (!string.IsNullOrWhiteSpace(caption)) form.Add(new StringContent(caption), "caption");
            var fileContent = new ByteArrayContent(bytes);
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            form.Add(fileContent, "document", fileName);
            var resp = await Client().PostAsync($"{ApiBase}/sendDocument", form, ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram sendDocument xatosi");
            return false;
        }
    }

    /// <summary>
    /// Hujjat (masalan APK) yuboradi — keshlangan <paramref name="fileId"/> bo'lsa qayta yuklamasdan,
    /// aks holda <paramref name="bytes"/>ni multipart bilan yuklab. Telegram qaytargan yangi
    /// <c>file_id</c>ni qaytaradi (keshlash uchun) — muvaffaqiyatsiz bo'lsa null.
    /// </summary>
    public async Task<string?> SendDocumentReturningIdAsync(
        long chatId, string? fileId, byte[]? bytes, string fileName, string contentType,
        string? caption, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;
        try
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(chatId.ToString()), "chat_id");
            if (!string.IsNullOrWhiteSpace(caption)) form.Add(new StringContent(caption), "caption");
            if (!string.IsNullOrWhiteSpace(fileId))
            {
                form.Add(new StringContent(fileId), "document");
            }
            else if (bytes is not null)
            {
                var fileContent = new ByteArrayContent(bytes);
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
                form.Add(fileContent, "document", fileName);
            }
            else return null;

            var resp = await Client().PostAsync($"{ApiBase}/sendDocument", form, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("document", out var d) &&
                d.TryGetProperty("file_id", out var fid))
                return fid.GetString() ?? fileId ?? "";
            return fileId ?? "";
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram sendDocument (APK) xatosi");
            return null;
        }
    }

    /// <summary>
    /// getChatMember — foydalanuvchining kanal/guruh a'zoligi holatini qaytaradi
    /// (creator/administrator/member/restricted/left/kicked) yoki null (xato/yo'q).
    /// <paramref name="chatRef"/> ommaviy kanal uchun "@username" bo'lishi kerak; bot kanal a'zosi/admin bo'lishi shart.
    /// </summary>
    public async Task<string?> GetChatMemberStatusAsync(string chatRef, long userId, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(chatRef)) return null;
        try
        {
            var url = $"{ApiBase}/getChatMember?chat_id={Uri.EscapeDataString(chatRef)}&user_id={userId}";
            var resp = await Client().GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("status", out var st))
                return st.GetString();
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram getChatMember xatosi");
            return null;
        }
    }

    /// <summary>answerCallbackQuery — inline tugma bosilganda "yuklanish" spinnerini to'xtatadi.</summary>
    public async Task AnswerCallbackAsync(string callbackId, string? text = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        try
        {
            var payload = new Dictionary<string, object?> { ["callback_query_id"] = callbackId };
            if (!string.IsNullOrWhiteSpace(text)) payload["text"] = text;
            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            await Client().PostAsync($"{ApiBase}/answerCallbackQuery", content, ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Telegram answerCallbackQuery xatosi"); }
    }

    /// <summary>Kanal havolasidan/@username'dan getChatMember uchun "@username" hosil qiladi
    /// (https://t.me/foo -> @foo, foo -> @foo). Xususiy taklif havolasi (+hash/joinchat) uchun null.</summary>
    public static string? ChannelUsername(string? channel)
    {
        var c = (channel ?? "").Trim();
        if (c.Length == 0) return null;
        var i = c.IndexOf("t.me/", StringComparison.OrdinalIgnoreCase);
        if (i >= 0) c = c[(i + 5)..];
        c = c.TrimStart('@').Trim('/');
        if (c.Length == 0 || c.StartsWith('+') || c.StartsWith("joinchat", StringComparison.OrdinalIgnoreCase))
            return null; // xususiy kanal — getChatMember bilan tekshirib bo'lmaydi
        // username bo'limini ajratib olamiz (so'rov/yo'ldan keyingi qismni tashlaymiz)
        var slash = c.IndexOfAny(new[] { '/', '?' });
        if (slash >= 0) c = c[..slash];
        return c.Length == 0 ? null : "@" + c;
    }

    /// <summary>
    /// getUpdates (long polling). Telegram javobidagi "result" massivini (xom JSON) qaytaradi.
    /// Token yo'q yoki xato bo'lsa — null.
    /// </summary>
    public async Task<JsonElement?> GetUpdatesAsync(long offset, int timeoutSec, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;
        var url = $"{ApiBase}/getUpdates?offset={offset}&timeout={timeoutSec}&allowed_updates=%5B%22message%22%2C%22callback_query%22%2C%22my_chat_member%22%5D";
        var resp = await Client().GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!resp.IsSuccessStatusCode) return null;
        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return doc.RootElement.TryGetProperty("result", out var result) ? result.Clone() : null;
    }
}
