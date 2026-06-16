using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Yangi lid tushganda Telegram botda ro'yxatdan o'tgan ADMIN/xodimlarga xabarnoma yuboradi.
/// Oluvchilar: TelegramRegistration.UserId bog'langan, roli admin/superadmin (har doim) yoki
/// staff bo'lib "leads" ruxsatiga ega bo'lganlar. Bot sozlanmagan / oluvchi yo'q bo'lsa — jim o'tadi.
/// </summary>
public static class LeadNotifier
{
    public static async Task NotifyNewLeadAsync(
        IAppDbContext db, TelegramService telegram, Lead lead, CancellationToken ct = default)
    {
        try
        {
            if (!telegram.IsConfigured) return;

            var regs = await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "").ToListAsync(ct);
            if (regs.Count == 0) return;

            var userIds = regs.Select(r => r.UserId!).Distinct().ToList();
            var users = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync(ct))
                .ToDictionary(u => u.Id);

            var text = BuildText(lead);
            var sentChats = new HashSet<long>();
            foreach (var r in regs)
            {
                if (!users.TryGetValue(r.UserId!, out var u) || !ShouldNotify(u)) continue;
                if (!sentChats.Add(r.ChatId)) continue; // bir chatga bir marta
                await telegram.SendMessageAsync(r.ChatId, text, ct: ct);
            }
        }
        catch
        {
            // Xabarnoma lid yaratishni hech qachon buzmasligi kerak — jim yutamiz.
        }
    }

    private static bool ShouldNotify(AppUser u) =>
        u.Role is Roles.Admin or Roles.SuperAdmin
        || (u.Role == Roles.Staff && u.Permissions.Contains("leads"));

    private static string BuildText(Lead l)
    {
        var lines = new List<string> { "🆕 Yangi lid!" };
        if (!string.IsNullOrWhiteSpace(l.FullName)) lines.Add($"👤 {l.FullName}");
        if (!string.IsNullOrWhiteSpace(l.Phone)) lines.Add($"📞 {l.Phone}");
        if (!string.IsNullOrWhiteSpace(l.Source)) lines.Add($"🔖 Manba: {l.Source}");
        if (!string.IsNullOrWhiteSpace(l.InterestSubject)) lines.Add($"📚 Qiziqish: {l.InterestSubject}");
        return string.Join("\n", lines);
    }
}
