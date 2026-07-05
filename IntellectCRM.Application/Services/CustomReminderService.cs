using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "Erkin eslatma" (fon xizmati) — admin Sozlamalar → Eslatmalarda o'zi yozgan matn, tanlagan
/// auditoriya (o'qituvchilar yoki o'quvchilar/ota-onalar) va jadval (har kuni yoki oyning muayyan
/// kunida, belgilangan soatda) bo'yicha push (FCM) + Telegram orqali avtomatik yuboriladigan qoida
/// (<see cref="ReminderRule"/>, Trigger==<see cref="ReminderTriggers.CustomSchedule"/>).
///
/// Jadval aniq daqiqa talab qilgani uchun sikl HAR 1 DAQIQADA uyg'onadi; bitta qoida bitta kunga bir
/// marta yuborilishi uchun xotirada (ruleId, sana) kaliti bilan "yuborildi" belgisi saqlanadi.
/// </summary>
public class CustomReminderService(
    IServiceProvider services,
    TelegramService telegram,
    FcmService fcm,
    EskizService eskiz,
    ILogger<CustomReminderService> logger) : BackgroundService
{
    private readonly HashSet<string> _sent = new();
    private DateOnly _sentDate = DateOnly.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erkin eslatma siklida xatolik");
            }

            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var today = AppClock.Today;
        if (_sentDate != today)
        {
            _sentDate = today;
            _sent.Clear();
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var rules = await db.AutoMessageRules
            .Where(r => r.Enabled && r.Trigger == AutoMessageTriggers.CustomSchedule)
            .ToListAsync(ct);
        if (rules.Count == 0) return;

        var now = AppClock.Now;
        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        var fcmJson = meta?.FcmServiceAccountJson ?? "";
        var pushReady = FcmService.IsConfigured(fcmJson);
        var eskizReady = eskiz.IsConfigured(meta);
        var centerName = meta?.Name ?? "";

        foreach (var rule in rules)
        {
            if (rule.ScheduleType == "monthly" && today.Day != rule.ScheduleDayOfMonth) continue;
            if (!TimeSpan.TryParse(rule.ScheduleTime, out var target)) continue;

            var elapsed = now.TimeOfDay - target;
            // 10 daqiqalik oyna — servis biroz kechiksa ham eslatma o'tkazib yuborilmasin.
            if (elapsed < TimeSpan.Zero || elapsed > TimeSpan.FromMinutes(10)) continue;

            var key = $"{rule.Id}:{today}";
            if (!_sent.Add(key)) continue;

            try
            {
                await SendAsync(db, rule, centerName, fcmJson, pushReady, eskizReady, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Erkin eslatma: qoida {Id} uchun xatolik", rule.Id);
            }
        }
    }

    private async Task SendAsync(
        IAppDbContext db, AutoMessageRule rule, string centerName, string fcmJson, bool pushReady,
        bool eskizReady, CancellationToken ct)
    {
        var title = string.IsNullOrWhiteSpace(rule.Name) ? "Eslatma" : rule.Name;
        var deadTokens = new List<string>();

        if (rule.Audience == "teachers")
        {
            // SMS ham yoqilgan bo'lsa UserId'siz o'qituvchilar ham raqam orqali oladi.
            var teachers = await db.Teachers.Where(t => !t.IsArchived && (t.UserId != null || rule.SendSms)).ToListAsync(ct);
            foreach (var t in teachers)
            {
                var body = MessageTokenizer.Teacher(rule.Template, t, centerName);
                await DeliverAsync(db, rule, t.UserId, t.Id, isTeacher: true, t.Phone, t.FullName, title, body,
                    fcmJson, pushReady, eskizReady, deadTokens, ct);
            }
        }
        else
        {
            var students = await db.Students.Where(s => !s.IsArchived).ToListAsync(ct);
            foreach (var s in students)
            {
                var phone = !string.IsNullOrWhiteSpace(s.ParentPhone) ? s.ParentPhone
                    : !string.IsNullOrWhiteSpace(s.FatherPhone) ? s.FatherPhone
                    : !string.IsNullOrWhiteSpace(s.MotherPhone) ? s.MotherPhone : s.Phone;
                var body = MessageTokenizer.Student(rule.Template, s, s.ParentFullName, phone, centerName);
                await DeliverAsync(db, rule, s.UserId, s.Id, isTeacher: false, phone, s.FullName, title, body,
                    fcmJson, pushReady, eskizReady, deadTokens, ct);
            }
        }

        if (deadTokens.Count > 0)
            db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => deadTokens.Contains(d.Token)));
        await db.SaveChangesAsync(ct);
    }

    private async Task DeliverAsync(
        IAppDbContext db, AutoMessageRule rule, string? userId, string entityId, bool isTeacher,
        string? smsPhone, string recipientName, string title, string body,
        string fcmJson, bool pushReady, bool eskizReady, List<string> deadTokens, CancellationToken ct)
    {
        if (rule.SendPush && userId is not null)
        {
            NotificationStore.Add(db, userId, title, body, "custom_schedule");
            if (pushReady)
            {
                var tokens = await db.DeviceTokens.Where(d => d.UserId == userId)
                    .Select(d => d.Token).Distinct().ToListAsync(ct);
                if (tokens.Count > 0)
                {
                    var res = await fcm.SendAsync(fcmJson, tokens, title, body, ct);
                    deadTokens.AddRange(res.InvalidTokens);
                }
            }
        }

        if (rule.SendTelegram && telegram.IsConfigured)
        {
            var chatIds = isTeacher
                ? await db.TelegramRegistrations.Where(r => r.TeacherId == entityId).Select(r => r.ChatId).Distinct().ToListAsync(ct)
                : await db.TelegramRegistrations.Where(r => r.StudentId == entityId).Select(r => r.ChatId).Distinct().ToListAsync(ct);
            foreach (var chatId in chatIds)
                await telegram.SendMessageAsync(chatId, $"🔔 {title}\n\n{body}", ct: ct);
        }

        if (rule.SendSms && eskizReady && !string.IsNullOrWhiteSpace(smsPhone))
        {
            var batchId = Guid.NewGuid().ToString();
            var r = await eskiz.SendSmsAsync(db, smsPhone, body, callbackUrl: null, ct);
            db.SmsLogs.Add(new SmsLog
            {
                BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(smsPhone),
                RecipientName = recipientName, Message = body,
                RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
            });
            db.SmsBatches.Add(new SmsBatch
            {
                Id = batchId, Audience = $"Avto (Erkin eslatma): {recipientName}", Message = body,
                SenderUserId = "", SenderName = "Avto xabar", CreatedAt = AppClock.Now,
                RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
            });
        }
    }
}
