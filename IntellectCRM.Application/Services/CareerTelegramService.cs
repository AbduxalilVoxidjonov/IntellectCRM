using System.Text;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// KARYERA BOTI (Intellect Career) uchun Telegram Bot API mijozi — ALOHIDA token bilan
/// (<see cref="AppSecrets.CareerBotToken"/>, <c>.env: CAREER_BOT_TOKEN</c>).
///
/// <para>Nega alohida servis: <see cref="TelegramService"/> markazning ASOSIY botiga bog'langan
/// (bitta token) — o'quvchi/o'qituvchi, e'lonlar, onlayn test, kitob sotuvi hammasi o'sha yerda.
/// Ishga qabul boti mustaqil BotFather boti bo'lgani uchun uning long polling'i va yuborishlari
/// ham mustaqil bo'lishi kerak. Metodlar to'plami ATAYIN kichik: karyera botining butun ishi —
/// xush kelibsiz xabari + Mini App tugmasi va bosqich o'zgarganda bildirishnoma.</para>
/// </summary>
public class CareerTelegramService(IHttpClientFactory httpFactory, ILogger<CareerTelegramService> logger)
{
    private volatile string _username = "";

    public string BotToken => AppSecrets.CareerBotToken;
    /// <summary>Bot username'i (<c>getMe</c> orqali startupda aniqlanadi) — havolalarda ko'rsatiladi.</summary>
    public string BotUsername => _username;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken);

    private HttpClient Client() => httpFactory.CreateClient("telegram");
    private string ApiBase => $"https://api.telegram.org/bot{BotToken}";

    /// <summary>Matn yuboradi (ixtiyoriy reply_markup / parse_mode bilan). Muvaffaqiyat — true.</summary>
    public async Task<bool> SendMessageAsync(
        long chatId, string text, object? replyMarkup = null, CancellationToken ct = default,
        string? parseMode = null)
    {
        if (!IsConfigured) return false;
        try
        {
            var payload = new Dictionary<string, object?> { ["chat_id"] = chatId, ["text"] = text };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            if (parseMode is not null) payload["parse_mode"] = parseMode;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await Client().PostAsync($"{ApiBase}/sendMessage", content, ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Karyera boti: sendMessage xatosi");
            return false;
        }
    }

    /// <summary>Inline tugma bosilganidagi "soatchani" to'xtatadi (ixtiyoriy ogohlantirish bilan).</summary>
    public async Task AnswerCallbackAsync(string callbackId, string? text = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return;
        try
        {
            var payload = new Dictionary<string, object?> { ["callback_query_id"] = callbackId };
            if (!string.IsNullOrEmpty(text)) payload["text"] = text;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            await Client().PostAsync($"{ApiBase}/answerCallbackQuery", content, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Karyera boti: answerCallbackQuery xatosi");
        }
    }

    /// <summary>Long polling — yangi update'lar (null = xato/sozlanmagan).</summary>
    public async Task<JsonElement?> GetUpdatesAsync(long offset, int timeoutSec, CancellationToken ct)
    {
        if (!IsConfigured) return null;
        try
        {
            var url = $"{ApiBase}/getUpdates?offset={offset}&timeout={timeoutSec}"
                      + "&allowed_updates=[\"message\",\"callback_query\"]";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            // Long polling timeout'i HttpClient'nikidan kichik bo'lishi kerak.
            var resp = await Client().SendAsync(req, HttpCompletionOption.ResponseContentRead, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("result", out var result)) return null;
            return result.Clone();
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Karyera boti: getUpdates xatosi");
            return null;
        }
    }

    /// <summary>Bot username'ini aniqlaydi (<c>getMe</c>) va xotiraga oladi.</summary>
    public async Task<string> RefreshUsernameAsync(CancellationToken ct = default)
    {
        if (!IsConfigured) return "";
        try
        {
            var resp = await Client().GetAsync($"{ApiBase}/getMe", ct);
            if (!resp.IsSuccessStatusCode) return _username;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("username", out var u))
                _username = u.GetString() ?? "";
            return _username;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Karyera boti: getMe xatosi");
            return _username;
        }
    }

    /// <summary>Chat menyusi tugmasini Mini App'ga bog'laydi — foydalanuvchi klaviatura yonidagi
    /// tugmadan ham ilovani ocha oladi (inline tugmadan tashqari). Bir marta, startupda.</summary>
    public async Task SetMenuButtonAsync(string miniAppUrl, string text, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(miniAppUrl)) return;
        try
        {
            var payload = new
            {
                menu_button = new { type = "web_app", text, web_app = new { url = miniAppUrl } },
            };
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            await Client().PostAsync($"{ApiBase}/setChatMenuButton", content, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Karyera boti: setChatMenuButton xatosi");
        }
    }
}
