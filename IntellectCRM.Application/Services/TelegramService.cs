using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using System.Text;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>Xabarni tahrirlash natijasi — chaqiruvchi har biriga BOSHQACHA javob beradi.</summary>
public enum TgEditResult
{
    /// <summary>Tahrirlandi.</summary>
    Ok,
    /// <summary>Telegram: matn AYNAN eski («message is not modified») — muvaffaqiyat deb qaraladi.</summary>
    NotModified,
    /// <summary>Xabar yo'q: o'chirilgan, id buzuq, chat topilmadi yoki bot chiqarilgan. QAYTA URINILMAYDI.</summary>
    Gone,
    /// <summary>429 — tezlik chegarasi. Keyingi o'zgarishda yana urinsa bo'ladi.</summary>
    RateLimited,
    /// <summary>Boshqa xato (tarmoq, noma'lum sabab).</summary>
    Failed,
}

/// <summary>
/// Telegram Bot API bilan ishlash: e'lon yuborish (sendMessage) va bot yangilanishlarini olish
/// (getUpdates, long polling).
///
/// <para><b>TOKEN — faqat .env dan</b> (<c>TELEGRAM_BOT_TOKEN</c> / <c>Telegram__BotToken</c>,
/// <see cref="AppSecrets.TelegramBotToken"/>). Bazada saqlanmaydi va UI'dan kiritilmaydi.
/// Token bo'sh bo'lsa xizmat "sozlanmagan" — hech narsa yubormaydi, ilova baribir ishlaydi.</para>
///
/// <para>Bot <b>username/nomi</b> maxfiy emas (havola va ilovada ko'rsatish uchun) — u CenterMeta'da
/// qoladi va <see cref="Load"/> bilan startupda xotiraga olinadi, <see cref="Set"/> esa admin
/// sozlamani saqlaganda yangilaydi.</para>
/// </summary>
public class TelegramService(IHttpClientFactory httpFactory, ILogger<TelegramService> logger)
{
    private volatile string _username = "";
    private volatile string _name = "";

    public string BotToken => AppSecrets.TelegramBotToken;
    public string BotUsername => _username;
    public string BotName => _name;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken);

    /// <summary>Xotiradagi bot username/nomini yangilaydi (admin sozlamani saqlaganda chaqiriladi).
    /// Token bu yerda YO'Q — u .env dan o'qiladi.</summary>
    public void Set(string? username, string? name = null)
    {
        _username = (username ?? "").Trim().TrimStart('@');
        _name = (name ?? "").Trim();
    }

    /// <summary>Startupda chaqiriladi: bot username/nomini CenterMeta'dan xotiraga oladi
    /// (token .env dan kelgani uchun bu yerda o'qilmaydi).</summary>
    public void Load(IAppDbContext db)
    {
        var meta = db.CenterMeta.FirstOrDefault();
        Set(meta?.TelegramBotUsername, meta?.TelegramBotName);
    }

    private HttpClient Client() => httpFactory.CreateClient("telegram");
    private string ApiBase => $"https://api.telegram.org/bot{BotToken}";

    /// <summary>Berilgan chatga matn yuboradi (ixtiyoriy reply_markup va parseMode bilan). Muvaffaqiyat — true.
    /// parseMode="HTML" bersa — masalan &lt;code&gt; bilan o'ralgan qism Telegram mijozlarida
    /// bosilganda avtomatik nusxa olinadigan (tap-to-copy) monospace bo'lib ko'rinadi.
    /// <para><paramref name="replyToMessageId"/> berilsa xabar o'sha xabarga JAVOB bo'lib ketadi —
    /// masalan takroriy murojaat signali lid kartasiga javob qilinadi va bosilganda kartaga sakraydi.
    /// ⚠️ Parametr ataylab ENG OXIRIDA: mavjud chaqiruvchilar pozitsiyaviy argument uzatadi
    /// (<c>SendMessageAsync(chatId, text, kb, ct, "HTML")</c>), o'rtaga qo'shilsa hammasi sinardi.</para></summary>
    public async Task<bool> SendMessageAsync(
        long chatId, string text, object? replyMarkup = null, CancellationToken ct = default,
        string? parseMode = null, long? replyToMessageId = null)
    {
        if (!IsConfigured) return false;
        try
        {
            var payload = new Dictionary<string, object?> { ["chat_id"] = chatId, ["text"] = text };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            if (parseMode is not null) payload["parse_mode"] = parseMode;
            if (replyToMessageId is not null) payload["reply_to_message_id"] = replyToMessageId;
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

    /// <summary>Xabar yuboradi va Telegram bergan <c>message_id</c>ni qaytaradi (keyin o'sha xabarni
    /// JOYIDA yangilash uchun — masalan onlayn test javob varaqasi yoki lid kartasi). Xato bo'lsa null.
    /// <para><paramref name="replyToMessageId"/> — yuboriladigan xabar JAVOB bo'ladigan xabar id'si
    /// (ENG OXIRGI parametr: mavjud pozitsiyaviy chaqiruvlar buzilmasin).</para></summary>
    public async Task<long?> SendMessageReturningIdAsync(
        long chatId, string text, object? replyMarkup = null, CancellationToken ct = default,
        string? parseMode = null, long? replyToMessageId = null)
    {
        if (!IsConfigured) return null;
        try
        {
            var payload = new Dictionary<string, object?> { ["chat_id"] = chatId, ["text"] = text };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            if (parseMode is not null) payload["parse_mode"] = parseMode;
            if (replyToMessageId is not null) payload["reply_to_message_id"] = replyToMessageId;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await Client().PostAsync($"{ApiBase}/sendMessage", content, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("message_id", out var mid))
                return mid.GetInt64();
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram sendMessage (id bilan) xatosi");
            return null;
        }
    }

    /// <summary>Mavjud xabar MATNINI va tugmalarini joyida yangilaydi (editMessageText) — onlayn test
    /// javob varaqasi har bosishda yangi xabar yubormasdan shu yerda o'zgaradi. Muvaffaqiyat — true
    /// (xabar eskirgan/o'chirilgan bo'lsa false, chaqiruvchi yangi xabar yuborishi mumkin).
    /// <para>Bu — <see cref="EditMessageTextDetailedAsync"/> ustidagi SODDA qobiq (imzosi ataylab
    /// o'zgarmagan, eski chaqiruvchilar buzilmasin). <see cref="TgEditResult.NotModified"/> ham
    /// TRUE deb qaraladi: matn allaqachon aynan shunday bo'lsa ish BAJARILGAN hisoblanadi —
    /// ilgari bu holat false qaytarib, chaqiruvchini bekorga yangi xabar yuborishga majburlardi.</para></summary>
    public async Task<bool> EditMessageTextAsync(
        long chatId, long messageId, string text, object? replyMarkup = null,
        CancellationToken ct = default, string? parseMode = null)
    {
        var result = await EditMessageTextDetailedAsync(chatId, messageId, text, replyMarkup, ct, parseMode);
        return result is TgEditResult.Ok or TgEditResult.NotModified;
    }

    /// <summary>
    /// <see cref="EditMessageTextAsync"/> bilan AYNAN bir xil so'rov yuboradi, farqi — javob TANASINI
    /// ham o'qiydi va xatoni TASNIFLAYDI. Kerak, chunki chaqiruvchi har xatoga boshqacha javob beradi:
    /// «matn o'zgarmagan» — muvaffaqiyat, «xabar o'chirilgan» — qayta urinmaslik, «429» — keyinroq.
    /// Yalang <c>bool</c> hammasini bir xil «false» qilib ko'rsatardi.
    /// </summary>
    public async Task<TgEditResult> EditMessageTextDetailedAsync(
        long chatId, long messageId, string text, object? replyMarkup = null,
        CancellationToken ct = default, string? parseMode = null)
    {
        // Token yo'q — xizmat sozlanmagan; bu tarmoq xatosi emas, lekin tahrir ham bo'lmadi.
        if (!IsConfigured) return TgEditResult.Failed;
        try
        {
            var payload = new Dictionary<string, object?>
            {
                ["chat_id"] = chatId, ["message_id"] = messageId, ["text"] = text,
            };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            if (parseMode is not null) payload["parse_mode"] = parseMode;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await Client().PostAsync($"{ApiBase}/editMessageText", content, ct);

            var body = await resp.Content.ReadAsStringAsync(ct);
            var ok = resp.IsSuccessStatusCode && OkFlag(body) is not false;
            if (ok) return TgEditResult.Ok;

            // Telegram xatoni {"ok":false,"description":"..."} ko'rinishida qaytaradi — sabab SHU YERDA.
            var description = DescriptionOf(body);
            var result = ClassifyEditError((int)resp.StatusCode, description);
            // ⚠️ Logga chat id yoki token TUSHMAYDI (maxfiylik) — faqat tasnif va Telegram izohi.
            if (result is not TgEditResult.NotModified)
                logger.LogWarning("Telegram editMessageText rad etdi: {Result} ({Description})", result, description);
            return result;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram editMessageText xatosi");
            return TgEditResult.Failed;
        }
    }

    /// <summary>
    /// Telegram xato javobini (HTTP kodi + <c>description</c>) <see cref="TgEditResult"/> ga aylantiradi.
    /// SOF funksiya — tarmoqsiz testlanadi, shuning uchun tasnif mantig'i so'rov yuborishdan ajratilgan.
    /// Solishtirish registrga BOG'LIQ EMAS: Telegram xato matnlari vaqt o'tishi bilan o'zgaradi.
    /// </summary>
    internal static TgEditResult ClassifyEditError(int statusCode, string? description)
    {
        var d = description ?? "";

        // «Matn aynan eski» — xato emas, ish allaqachon bajarilgan. Eng oldin tekshiriladi.
        if (Has(d, "message is not modified")) return TgEditResult.NotModified;

        // Xabar/chat YO'Q yoki bot u yerda emas — qayta urinishning ma'nosi yo'q.
        if (Has(d, "message to edit not found")
            || Has(d, "MESSAGE_ID_INVALID")
            || Has(d, "chat not found")
            || Has(d, "message can't be edited")
            || Has(d, "bot was kicked")
            || Has(d, "bot is not a member")
            || Has(d, "chat_id is empty"))
            return TgEditResult.Gone;

        // Tezlik chegarasi — keyingi o'zgarishda yana urinsa bo'ladi.
        if (statusCode == 429 || Has(d, "Too Many Requests")) return TgEditResult.RateLimited;

        return TgEditResult.Failed;

        static bool Has(string haystack, string needle) =>
            haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Javob tanasidan <c>"ok"</c> bayrog'ini oladi (JSON buzuq bo'lsa — null, ya'ni
    /// "bilib bo'lmadi": u holda HTTP kodiga tayanamiz).</summary>
    private static bool? OkFlag(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("ok", out var ok) && ok.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? ok.GetBoolean()
                : null;
        }
        catch (JsonException) { return null; }
    }

    /// <summary>Javob tanasidan <c>"description"</c> matnini oladi (bo'lmasa/buzuq bo'lsa — null).</summary>
    private static string? DescriptionOf(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("description", out var d) ? d.GetString() : null;
        }
        catch (JsonException) { return null; }
    }

    /// <summary>Mavjud xabarning inline-klaviaturasini (reply_markup) yangilaydi (editMessageReplyMarkup).
    /// Checklist tugmalari holatini (☐ → ✅) o'sha xabarning O'ZIDA yangilash uchun.</summary>
    public async Task<bool> EditMessageReplyMarkupAsync(
        long chatId, long messageId, object? replyMarkup, CancellationToken ct = default)
    {
        if (!IsConfigured) return false;
        try
        {
            var payload = new Dictionary<string, object?> { ["chat_id"] = chatId, ["message_id"] = messageId };
            if (replyMarkup is not null) payload["reply_markup"] = replyMarkup;
            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await Client().PostAsync($"{ApiBase}/editMessageReplyMarkup", content, ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram editMessageReplyMarkup xatosi");
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
    /// Rasm yuboradi (sendPhoto) — keshlangan <paramref name="fileId"/> bo'lsa qayta yuklamasdan,
    /// aks holda <paramref name="bytes"/>ni multipart bilan yuklab. Telegram qaytargan yangi
    /// <c>file_id</c>ni qaytaradi (keshlash uchun; muvaffaqiyatsiz bo'lsa null).
    /// <para>Caption HTML sifatida yuboriladi va inline tugmalar qo'shilishi mumkin — kitob
    /// katalogida muqova + narx + "Sotib olish" tugmasi bitta xabarda chiqadi.</para>
    /// </summary>
    public async Task<string?> SendPhotoReturningIdAsync(
        long chatId, string? fileId, byte[]? bytes, string fileName, string? caption,
        object? replyMarkup = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;
        try
        {
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(chatId.ToString()), "chat_id");
            if (!string.IsNullOrWhiteSpace(caption))
            {
                form.Add(new StringContent(caption, Encoding.UTF8), "caption");
                form.Add(new StringContent("HTML"), "parse_mode");
            }
            if (replyMarkup is not null)
                form.Add(new StringContent(JsonSerializer.Serialize(replyMarkup), Encoding.UTF8), "reply_markup");

            if (!string.IsNullOrWhiteSpace(fileId))
            {
                form.Add(new StringContent(fileId), "photo");
            }
            else if (bytes is not null && bytes.Length > 0)
            {
                var content = new ByteArrayContent(bytes);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(MimeOf(fileName));
                form.Add(content, "photo", fileName);
            }
            else return null;

            var resp = await Client().PostAsync($"{ApiBase}/sendPhoto", form, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            // sendPhoto "photo" massivini qaytaradi (turli o'lchamlar) — eng kattasining file_id'sini olamiz.
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("photo", out var photos) && photos.GetArrayLength() > 0)
            {
                var last = photos[photos.GetArrayLength() - 1];
                if (last.TryGetProperty("file_id", out var fid)) return fid.GetString() ?? fileId ?? "";
            }
            return fileId ?? "";
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram sendPhoto xatosi");
            return null;
        }
    }

    private static string MimeOf(string fileName) =>
        Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "image/jpeg",
        };

    /// <summary>
    /// getFile — Telegram serverdagi fayl yo'lini (<c>file_path</c>) qaytaradi. Keyin
    /// <see cref="DownloadFileAsync"/> bilan yuklab olinadi. Xato bo'lsa null.
    /// <para>Kitob buyurtmasidagi to'lov CHEKI (rasm/PDF) shu ikkisi bilan serverga ko'chiriladi —
    /// Telegram file_id vaqt o'tib ishlamay qolishi mumkin, admin panelida esa chek doim ochilishi kerak.</para>
    /// </summary>
    public async Task<string?> GetFilePathAsync(string fileId, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(fileId)) return null;
        try
        {
            var resp = await Client().GetAsync($"{ApiBase}/getFile?file_id={Uri.EscapeDataString(fileId)}", ct);
            if (!resp.IsSuccessStatusCode) return null;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var r) &&
                r.TryGetProperty("file_path", out var fp))
                return fp.GetString();
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram getFile xatosi");
            return null;
        }
    }

    /// <summary>Telegram serverdan faylni (<paramref name="filePath"/> — getFile natijasi) yuklab oladi.
    /// Xato bo'lsa null.</summary>
    public async Task<byte[]?> DownloadFileAsync(string filePath, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(filePath)) return null;
        try
        {
            var url = $"https://api.telegram.org/file/bot{BotToken}/{filePath}";
            var resp = await Client().GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;
            return await resp.Content.ReadAsByteArrayAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram fayl yuklab olish xatosi");
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

    /// <summary>Botning o'z Telegram user id'si — token boshidagi raqam ("&lt;botId&gt;:&lt;hash&gt;").
    /// Token yo'q/noto'g'ri bo'lsa 0.</summary>
    public long BotId()
    {
        var t = BotToken;
        var i = t.IndexOf(':');
        return i > 0 && long.TryParse(t[..i], out var id) ? id : 0;
    }

    /// <summary>
    /// MAJBURIY OBUNA sozlamasi haqiqatan ishlayaptimi — diagnostika (Sozlamalar → Telegram bot).
    /// Telegram <c>getChatMember</c> faqat bot kanalda ADMIN bo'lsagina ishlaydi; aks holda bot
    /// tekshira olmaydi va (foydalanuvchini qulflab qo'ymaslik uchun) hammani o'tkazib yuboradi.
    /// Shu sabab admin buni ko'rib turishi kerak.
    /// </summary>
    /// <returns>Status: ok | not-set | no-token | private | not-found | bot-not-admin.</returns>
    public async Task<(string Status, string Message)> CheckChannelAsync(
        string? channel, CancellationToken ct = default)
    {
        if (!IsConfigured)
            return ("no-token", "Bot tokeni sozlanmagan — obuna tekshiruvi ishlamaydi.");

        var c = (channel ?? "").Trim();
        if (c.Length == 0)
            return ("not-set", "Kanal ko'rsatilmagan — majburiy obuna TEKSHIRILMAYDI (hamma kira oladi).");

        var user = ChannelUsername(c);
        if (user is null)
            return ("private",
                "Xususiy kanal havolasi (+ yoki joinchat) — Telegram API bunday kanalda obunani "
                + "tekshira olmaydi. Kanalni ommaviy qilib, @username ko'rinishida kiriting.");

        var botId = BotId();
        if (botId == 0)
            return ("no-token", "Bot tokeni noto'g'ri — obuna tekshiruvi ishlamaydi.");

        var status = await GetChatMemberStatusAsync(user, botId, ct);
        if (status is null)
            return ("not-found",
                $"{user} topilmadi yoki bot unga kira olmadi. Kanal nomini tekshiring va botni "
                + "kanalga ADMIN qilib qo'shing — aks holda obuna tekshirilmaydi.");
        if (status is "administrator" or "creator")
            return ("ok", $"Majburiy obuna ishlayapti ({user}).");

        return ("bot-not-admin",
            $"Bot {user} kanalida admin emas (holati: {status}) — obuna TEKSHIRILMAYDI, hamma "
            + "o'tkazib yuboriladi. Botni kanalga admin qiling.");
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
