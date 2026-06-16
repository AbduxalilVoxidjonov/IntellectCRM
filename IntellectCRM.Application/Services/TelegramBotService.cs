using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;
using System.Collections.Concurrent;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Telegram botni long polling (getUpdates) orqali yurituvchi fon xizmati.
/// Oqim: foydalanuvchi /start bosadi → telefon raqamini ulashadi → raqam o'quvchi (ParentPhone) yoki
/// o'qituvchi (Phone) bilan solishtiriladi (ro'yxatdan o'tgan); MAJBURIY kanal obunasi tekshiriladi
/// (sozlangan bo'lsa) → keyin TelegramRegistration yoziladi va mos ILOVA (APK) fayli yuboriladi.
/// Token sozlanmagan bo'lsa xizmat kutadi (ilova baribir ishlaydi).
/// </summary>
public class TelegramBotService(
    IServiceProvider sp, TelegramService telegram, IHostEnvironment env,
    ILogger<TelegramBotService> logger) : BackgroundService
{
    private const string ApkMime = "application/vnd.android.package-archive";
    private const string ApkCaption =
        "📲 Ilovani o'rnatish: faylni yuklab oling, ochib o'rnating (noma'lum manbalardan o'rnatishga ruxsat bering).";

    /// <summary>Obunadan oldin kontakt yuborgan, lekin hali obuna bo'lmaganlar: chatId → telefon.</summary>
    private readonly ConcurrentDictionary<long, string> _pendingPhone = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        long offset = 0;
        var announced = false;
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!telegram.IsConfigured)
            {
                announced = false;
                if (!await DelayAsync(10000, stoppingToken)) break;
                continue;
            }
            if (!announced)
            {
                logger.LogInformation("Telegram bot ishga tushdi (long polling).");
                announced = true;
            }

            try
            {
                var updates = await telegram.GetUpdatesAsync(offset, 30, stoppingToken);
                if (updates is null)
                {
                    if (!await DelayAsync(2000, stoppingToken)) break;
                    continue;
                }
                foreach (var upd in updates.Value.EnumerateArray())
                {
                    if (upd.TryGetProperty("update_id", out var idEl))
                        offset = idEl.GetInt64() + 1;
                    await HandleUpdateAsync(upd, stoppingToken);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Telegram getUpdates xatosi");
                if (!await DelayAsync(3000, stoppingToken)) break;
            }
        }
    }

    private static async Task<bool> DelayAsync(int ms, CancellationToken ct)
    {
        try { await Task.Delay(ms, ct); return true; }
        catch (OperationCanceledException) { return false; }
    }

    private async Task HandleUpdateAsync(JsonElement upd, CancellationToken ct)
    {
        // Inline tugma ("✅ Tekshirish") bosilgani — obunani qayta tekshiramiz.
        if (upd.TryGetProperty("callback_query", out var cq))
        {
            await HandleCallbackAsync(cq, ct);
            return;
        }

        if (!upd.TryGetProperty("message", out var msg)) return;
        if (!msg.TryGetProperty("chat", out var chat) || !chat.TryGetProperty("id", out var chatIdEl)) return;
        var chatId = chatIdEl.GetInt64();

        // Kontakt ulashildi.
        if (msg.TryGetProperty("contact", out var contact))
        {
            var phone = contact.TryGetProperty("phone_number", out var p) ? p.GetString() : null;
            await HandleContactAsync(chatId, phone, SenderName(msg), ct);
            return;
        }

        var text = msg.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";
        if (text.StartsWith("/start"))
            await telegram.SendMessageAsync(chatId,
                "Assalomu alaykum! 📱 Ilovani (o'quvchi yoki o'qituvchi) o'rnatish uchun pastdagi tugma orqali " +
                "telefon raqamingizni yuboring. Raqamingiz markaz ma'lumotlari bilan solishtiriladi.",
                ContactKeyboard, ct);
        else
            await telegram.SendMessageAsync(chatId,
                "Iltimos, pastdagi tugma orqali telefon raqamingizni yuboring.", ContactKeyboard, ct);
    }

    private async Task HandleCallbackAsync(JsonElement cq, CancellationToken ct)
    {
        var cbId = cq.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? "" : "";
        if (!cq.TryGetProperty("from", out var from) || !from.TryGetProperty("id", out var fromIdEl)) return;
        var chatId = fromIdEl.GetInt64();
        var data = cq.TryGetProperty("data", out var dEl) ? dEl.GetString() ?? "" : "";
        if (cbId.Length > 0) await telegram.AnswerCallbackAsync(cbId, ct: ct);
        if (data != "check_sub") return;

        if (!_pendingPhone.TryGetValue(chatId, out var phone))
        {
            await telegram.SendMessageAsync(chatId,
                "Telefon raqamingizni qayta yuboring.", ContactKeyboard, ct);
            return;
        }
        await HandleContactAsync(chatId, phone, "", ct);
    }

    /// <summary>Telefon kelganda: moslik → MAJBURIY obuna → register + APK.</summary>
    private async Task HandleContactAsync(long chatId, string? phone, string senderName, CancellationToken ct)
    {
        var key = PhoneUtil.Key(phone);
        if (key.Length < 7)
        {
            await telegram.SendMessageAsync(chatId, "Telefon raqami noto'g'ri. Qaytadan urinib ko'ring.", ct: ct);
            return;
        }

        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var matchedStudents = (await db.Students.ToListAsync(ct))
            .Where(s => PhoneUtil.Key(s.ParentPhone) == key).ToList();
        var matchedTeachers = (await db.Teachers.Where(t => !t.IsArchived).ToListAsync(ct))
            .Where(t => PhoneUtil.Key(t.Phone) == key).ToList();
        // Admin/xodim — telefon AppUser.Phone bilan moslashsa (yangi lid xabarnomalarini olish uchun).
        var matchedAdmins = (await db.Users
                .Where(u => u.Role == Roles.Admin || u.Role == Roles.SuperAdmin || u.Role == Roles.Staff)
                .ToListAsync(ct))
            .Where(u => PhoneUtil.Key(u.Phone) == key).ToList();

        // Ro'yxatdan o'tmagan — to'xtatamiz.
        if (matchedStudents.Count == 0 && matchedTeachers.Count == 0 && matchedAdmins.Count == 0)
        {
            _pendingPhone.TryRemove(chatId, out _);
            await telegram.SendMessageAsync(chatId,
                $"Bu raqam ({phone}) markaz ro'yxatida topilmadi. Iltimos, markaz ma'muriyatiga murojaat qiling.",
                ct: ct);
            return;
        }

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        var channel = meta?.TelegramChannel ?? "";

        // MAJBURIY obuna (ommaviy @kanal sozlangan bo'lsa).
        var channelUser = TelegramService.ChannelUsername(channel);
        if (channelUser is not null)
        {
            var status = await telegram.GetChatMemberStatusAsync(channelUser, chatId, ct);
            if (status is "left" or "kicked")
            {
                _pendingPhone[chatId] = phone!;
                await telegram.SendMessageAsync(chatId,
                    "📢 Davom etish uchun avval markaz kanaliga obuna bo'ling, so'ng \"✅ Tekshirish\" tugmasini bosing.",
                    SubscribeKeyboard(ChannelUrl(channel)), ct);
                return;
            }
            // status null (bot kanal admini emas / tekshirib bo'lmadi) → bloklamaymiz (fail-open), ogohlantiramiz.
            if (status is null)
                logger.LogWarning("Telegram obuna tekshirib bo'lmadi (bot kanal admini bo'lishi kerak): {Ch}", channelUser);
        }

        _pendingPhone.TryRemove(chatId, out _);
        await CompleteAsync(db, meta, chatId, phone!, senderName, matchedStudents, matchedTeachers, matchedAdmins, ct);
    }

    /// <summary>Obuna o'tdi: TelegramRegistration yozadi va mos APK(lar)ni yuboradi.
    /// Admin/xodim moslansa — UserId yozuvi (yangi lid xabarnomalari uchun); APK yuborilmaydi.</summary>
    private async Task CompleteAsync(
        IAppDbContext db, CenterMeta? meta, long chatId, string phone, string senderName,
        List<Student> students, List<Teacher> teachers, List<AppUser> admins, CancellationToken ct)
    {
        var digits = PhoneUtil.DigitsOnly(phone);
        var linked = new List<string>();

        foreach (var s in students)
        {
            var exists = await db.TelegramRegistrations.AnyAsync(r => r.StudentId == s.Id && r.ChatId == chatId, ct);
            if (!exists)
                db.TelegramRegistrations.Add(new TelegramRegistration
                {
                    StudentId = s.Id, ChatId = chatId, ParentName = senderName, Phone = digits, CreatedAt = AppClock.Now,
                });
            linked.Add($"{s.FullName} ({s.ClassName})");
        }
        foreach (var tch in teachers)
        {
            var exists = await db.TelegramRegistrations.AnyAsync(r => r.TeacherId == tch.Id && r.ChatId == chatId, ct);
            if (!exists)
                db.TelegramRegistrations.Add(new TelegramRegistration
                {
                    TeacherId = tch.Id, StudentId = "", ChatId = chatId, ParentName = senderName,
                    Phone = digits, CreatedAt = AppClock.Now,
                });
            linked.Add($"{tch.FullName} (xodim)");
        }
        foreach (var u in admins)
        {
            var exists = await db.TelegramRegistrations.AnyAsync(r => r.UserId == u.Id && r.ChatId == chatId, ct);
            if (!exists)
                db.TelegramRegistrations.Add(new TelegramRegistration
                {
                    UserId = u.Id, StudentId = "", ChatId = chatId, ParentName = senderName,
                    Phone = digits, CreatedAt = AppClock.Now,
                });
            linked.Add($"{u.FullName} (admin)");
        }
        await db.SaveChangesAsync(ct);

        await telegram.SendMessageAsync(chatId,
            "✅ Ro'yxatdan o'tdingiz:\n• " + string.Join("\n• ", linked), ct: ct);

        // Admin/xodim — yangi lid xabarnomalari haqida ma'lumot.
        if (admins.Count > 0)
            await telegram.SendMessageAsync(chatId,
                "🔔 Yangi lid tushganda shu yerga xabar olasiz.", ct: ct);

        // Mos ILOVA (APK) — FAQAT o'quvchi/o'qituvchi uchun (admin web paneldan foydalanadi).
        if (students.Count > 0 || teachers.Count > 0)
        {
            var sentAny = await SendAppApkAsync(db, meta, chatId, students.Count > 0, teachers.Count > 0, ct);
            if (!sentAny)
                await telegram.SendMessageAsync(chatId,
                    "ℹ️ Ilova fayli hali yuklanmagan. Iltimos, birozdan so'ng qayta urinib ko'ring yoki ma'muriyatga murojaat qiling.",
                    ct: ct);
        }
    }

    /// <summary>Roli bo'yicha APK(lar)ni yuboradi (keshlangan file_id bo'lsa qayta yuklamasdan).
    /// O'quvchi/o'qituvchi APK'si yo'q bo'lsa ikkinchisiga qaytadi. Kamida bittasi yuborilsa true.</summary>
    private async Task<bool> SendAppApkAsync(
        IAppDbContext db, CenterMeta? meta, long chatId, bool student, bool teacher, CancellationToken ct)
    {
        if (meta is null) return false;

        // Mavjud bo'lsa slot (nom/yo'l/file_id + file_id keshini yozuvchi).
        (string name, string path, string fileId, Action<string> setId)? StudentSlot =
            (meta.StudentApkPath.Length > 0 || meta.StudentApkFileId.Length > 0)
                ? (meta.StudentApkName, meta.StudentApkPath, meta.StudentApkFileId, id => meta.StudentApkFileId = id)
                : null;
        (string name, string path, string fileId, Action<string> setId)? TeacherSlot =
            (meta.TeacherApkPath.Length > 0 || meta.TeacherApkFileId.Length > 0)
                ? (meta.TeacherApkName, meta.TeacherApkPath, meta.TeacherApkFileId, id => meta.TeacherApkFileId = id)
                : null;

        var slots = new List<(string name, string path, string fileId, Action<string> setId)>();
        if (student && (StudentSlot ?? TeacherSlot) is { } s1) slots.Add(s1);
        if (teacher && (TeacherSlot ?? StudentSlot) is { } s2) slots.Add(s2);

        var seen = new HashSet<string>();
        var any = false;
        var changed = false;
        foreach (var slot in slots)
        {
            var dedupeKey = slot.path.Length > 0 ? slot.path : slot.fileId;
            if (!seen.Add(dedupeKey)) continue;

            string? newId;
            if (slot.fileId.Length > 0)
            {
                newId = await telegram.SendDocumentReturningIdAsync(
                    chatId, slot.fileId, null, FileName(slot.name), ApkMime, ApkCaption, ct);
            }
            else
            {
                var abs = Path.Combine(env.ContentRootPath, slot.path);
                if (!File.Exists(abs)) continue;
                var bytes = await File.ReadAllBytesAsync(abs, ct);
                newId = await telegram.SendDocumentReturningIdAsync(
                    chatId, null, bytes, FileName(slot.name), ApkMime, ApkCaption, ct);
            }

            if (newId is not null)
            {
                any = true;
                if (newId.Length > 0 && newId != slot.fileId) { slot.setId(newId); changed = true; }
            }
        }

        if (changed) await db.SaveChangesAsync(ct);
        return any;
    }

    private static string FileName(string name) =>
        string.IsNullOrWhiteSpace(name) ? "app.apk"
        : name.EndsWith(".apk", StringComparison.OrdinalIgnoreCase) ? name : name + ".apk";

    private static string ChannelUrl(string ch)
    {
        ch = (ch ?? "").Trim();
        if (ch.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return ch;
        return "https://t.me/" + ch.TrimStart('@');
    }

    private static string SenderName(JsonElement msg)
    {
        if (!msg.TryGetProperty("from", out var from)) return "";
        var fn = from.TryGetProperty("first_name", out var f) ? f.GetString() : null;
        var ln = from.TryGetProperty("last_name", out var l) ? l.GetString() : null;
        return string.Join(" ", new[] { fn, ln }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }

    /// <summary>Telefon so'rovchi klaviatura (request_contact).</summary>
    private static object ContactKeyboard => new
    {
        keyboard = new[] { new[] { new { text = "📱 Telefon raqamni yuborish", request_contact = true } } },
        resize_keyboard = true,
        one_time_keyboard = true,
    };

    /// <summary>Kanal havolasi + "✅ Tekshirish" inline tugmalari.</summary>
    private static object SubscribeKeyboard(string channelUrl) => new
    {
        inline_keyboard = new object[][]
        {
            new object[] { new { text = "📢 Kanalga obuna bo'lish", url = channelUrl } },
            new object[] { new { text = "✅ Tekshirish", callback_data = "check_sub" } },
        },
    };
}
