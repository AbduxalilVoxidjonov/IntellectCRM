using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'qituvchiga "davomat kiriting" eslatmasi (fon xizmati). Har faol guruh uchun, dars boshlanish
/// vaqtidan (<see cref="Group.StartTime"/>) qoida bo'yicha belgilangan daqiqa (odatda 5) o'tgach,
/// agar shu kunga hali davomat kiritilmagan bo'lsa (<see cref="LessonNote.Conducted"/>), guruh
/// o'qituvchisiga push (FCM) + Telegram orqali eslatma yuboradi. Andoza/soniya siljishi
/// "Sozlamalar → Eslatmalar"da <see cref="ReminderRule"/> (Trigger==<see cref="ReminderTriggers.LessonAttendance"/>)
/// orqali boshqariladi — bir nechta qoida bo'lishi mumkin (masalan turli siljish bilan).
///
/// Dars vaqti aniq daqiqa talab qilgani uchun (kunlik eslatmalardan farqli) sikl HAR 1 DAQIQADA
/// uyg'onadi. Bitta darsga bir marta yuborilishi uchun xotirada (ruleId, groupId, sana) kaliti
/// bilan "yuborildi" belgisi saqlanadi — kun almashganda tozalanadi.
/// </summary>
public class LessonAttendanceReminderService(
    IServiceProvider services,
    TelegramService telegram,
    FcmService fcm,
    ILogger<LessonAttendanceReminderService> logger) : BackgroundService
{
    private readonly HashSet<string> _processed = new();
    private DateOnly _processedDate = DateOnly.MinValue;

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
                logger.LogError(ex, "Davomat eslatmasi siklida xatolik");
            }

            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var today = AppClock.Today;
        if (_processedDate != today)
        {
            _processedDate = today;
            _processed.Clear();
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var rules = await db.ReminderRules
            .Where(r => r.Enabled && r.Trigger == ReminderTriggers.LessonAttendance)
            .ToListAsync(ct);
        if (rules.Count == 0) return;

        var weekday = ((int)today.DayOfWeek + 6) % 7;
        var groups = await db.Classes
            .Where(g => !g.IsArchived && g.TeacherId != "" && g.StartTime != "")
            .ToListAsync(ct);
        groups = groups.Where(g => g.Days.Contains(weekday)).ToList();
        if (groups.Count == 0) return;

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        var fcmJson = meta?.FcmServiceAccountJson ?? "";
        var pushReady = FcmService.IsConfigured(fcmJson);
        var todayStr = today.ToString("yyyy-MM-dd");
        var now = AppClock.Now;
        var deadTokens = new List<string>();

        foreach (var rule in rules)
        foreach (var g in groups)
        {
            if (!TimeSpan.TryParse(g.StartTime, out var start)) continue;
            var target = start.Add(TimeSpan.FromMinutes(rule.OffsetMinutes));
            var elapsed = now.TimeOfDay - target;
            // 10 daqiqalik oyna — servis biroz kechiksa ham eslatma o'tkazib yuborilmasin.
            if (elapsed < TimeSpan.Zero || elapsed > TimeSpan.FromMinutes(10)) continue;

            var key = $"{rule.Id}:{g.Id}:{todayStr}";
            if (!_processed.Add(key)) continue;

            try
            {
                await SendAsync(db, rule, g, todayStr, meta?.Name ?? "", telegram, fcmJson, pushReady, deadTokens, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Davomat eslatmasi: guruh {Id} uchun xatolik", g.Id);
            }
        }

        if (deadTokens.Count > 0)
            db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => deadTokens.Contains(d.Token)));
        await db.SaveChangesAsync(ct);
    }

    private async Task SendAsync(
        IAppDbContext db, ReminderRule rule, Group g, string todayStr, string centerName,
        TelegramService telegramSvc, string fcmJson, bool pushReady, List<string> deadTokens, CancellationToken ct)
    {
        // Davomat allaqachon kiritilgan bo'lsa — jim o'tkaziladi.
        var conducted = await db.LessonNotes.AnyAsync(n =>
            n.ClassId == g.Id && n.SubjectId == g.CourseId && n.Quarter == 1 &&
            n.Date == todayStr && n.Conducted, ct);
        if (conducted) return;

        var teacher = await db.Teachers.FirstOrDefaultAsync(t => t.Id == g.TeacherId && !t.IsArchived, ct);
        if (teacher is null) return;

        var courseName = string.IsNullOrEmpty(g.CourseId) ? "" : (await db.Subjects.FindAsync(g.CourseId))?.Name ?? "";
        var template = string.IsNullOrWhiteSpace(rule.MessageTemplate)
            ? "Assalomu alaykum, {fish}! {guruh} guruhida ({kurs}) dars boshlandi ({dars_vaqti}). Iltimos, davomatni jurnalga kiriting."
            : rule.MessageTemplate;
        var body = MessageTokenizer.Teacher(template, teacher, centerName,
            extra: new Dictionary<string, string> { ["{kurs}"] = courseName }, group: g);
        var title = string.IsNullOrWhiteSpace(rule.Name) ? "Davomat eslatmasi" : rule.Name;

        if (teacher.UserId is not null)
            NotificationStore.Add(db, teacher.UserId, title, body, "attendance_reminder");

        if (pushReady && teacher.UserId is not null)
        {
            var tokens = await db.DeviceTokens.Where(d => d.UserId == teacher.UserId)
                .Select(d => d.Token).Distinct().ToListAsync(ct);
            if (tokens.Count > 0)
            {
                var res = await fcm.SendAsync(fcmJson, tokens, title, body, ct);
                deadTokens.AddRange(res.InvalidTokens);
            }
        }

        if (telegramSvc.IsConfigured)
        {
            var chatIds = await db.TelegramRegistrations
                .Where(r => r.TeacherId == teacher.Id)
                .Select(r => r.ChatId).Distinct().ToListAsync(ct);
            foreach (var chatId in chatIds)
                await telegramSvc.SendMessageAsync(chatId, $"🔔 {title}\n\n{body}", ct: ct);
        }
    }
}
