using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "Adminga topshiriq" kunlik jo'natish fon xizmati. Har kuni sozlangan soatdan (CenterMeta.StaffTask*)
/// keyin, HALI shu kun uchun checklisti yuborilmagan (StaffTaskLog yo'q) har bir topshiriqli xodimga —
/// Telegram bot orqali ro'yxatdan o'tgan bo'lsa — shu kungi checklistni "bajarildi" tugmalari bilan yuboradi.
/// Har daqiqa tekshiradi; xodim bo'yicha bir kunda bir marta (log mavjudligi bilan idempotent, o'z-o'zini
/// tiklaydi — xizmat aynan o'sha daqiqada ishlamagan bo'lsa ham keyinroq bajaradi).
/// </summary>
public class StaffTaskDispatchService(
    IServiceProvider services,
    TelegramService telegram,
    ILogger<StaffTaskDispatchService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Xodim topshiriq jo'natish siklida xatolik"); }
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var now = AppClock.Now;                       // Toshkent vaqti
        var today = now.ToString("yyyy-MM-dd");

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (meta is null || !meta.StaffTaskEnabled) return;

        var target = Math.Clamp(meta.StaffTaskHour, 0, 23) * 60 + Math.Clamp(meta.StaffTaskMinute, 0, 59);
        if (now.Hour * 60 + now.Minute < target) return; // hali jo'natish vaqti kelmagan

        var tasks = await db.StaffTasks.ToListAsync(ct);
        if (tasks.Count == 0) return;

        // Bugun allaqachon checklisti yuborilgan xodimlar (takror jo'natmaymiz).
        var dispatched = (await db.StaffTaskLogs.Where(l => l.Date == today)
                .Select(l => l.StaffUserId).Distinct().ToListAsync(ct))
            .ToHashSet();

        // Telegram bot orqali bog'langan xodimlar: UserId → chatId(lar).
        var chatsByUser = (await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "").ToListAsync(ct))
            .GroupBy(r => r.UserId!)
            .ToDictionary(g => g.Key, g => g.Select(r => r.ChatId).Distinct().ToList());

        foreach (var grp in tasks.GroupBy(t => t.StaffUserId))
        {
            var userId = grp.Key;
            if (dispatched.Contains(userId)) continue;
            if (!chatsByUser.TryGetValue(userId, out var chats) || chats.Count == 0) continue; // bog'lanmagan

            var ordered = grp.OrderBy(t => t.Order).ThenBy(t => t.CreatedAt).ToList();
            var iso = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
            var logs = ordered.Select(t => new StaffTaskLog
            {
                TaskId = t.Id, StaffUserId = userId, Date = today, Title = t.Title,
                Order = t.Order, Done = false, CreatedAt = iso,
            }).ToList();
            db.StaffTaskLogs.AddRange(logs);
            await db.SaveChangesAsync(ct);

            var text = StaffTaskChecklist.HeaderText(today);
            var keyboard = StaffTaskChecklist.Keyboard(logs);
            foreach (var chatId in chats)
                await telegram.SendMessageAsync(chatId, text, keyboard, ct);

            logger.LogInformation("Xodim {UserId} checklisti yuborildi ({Count} band).", userId, logs.Count);
        }
    }
}
