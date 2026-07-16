using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// "Adminga topshiriq" — xodim (admin/staff) uchun kunlik CHECKLIST topshiriqlari. "Xodimlar"
/// ruxsati kerak (superadmin/admin har doim). Har xodimga alohida custom topshiriqlar tuziladi;
/// har kuni ertalab (sozlanadigan soat) Telegram bot orqali xodimga "bajarildi" tugmasi bilan
/// yuboriladi; bajarilishi tarixga yoziladi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("staff")]
[Route("api/admin/staff-tasks")]
public class StaffTasksController(AppDbContext db) : ControllerBase
{
    // ---------- Chap taraf: xodimlar ro'yxati ----------

    /// <summary>Topshiriq biriktirish mumkin bo'lgan xodimlar (admin + staff) — topshiriq soni va
    /// Telegram bog'lanish holati bilan.</summary>
    [HttpGet("targets")]
    public async Task<ActionResult<IEnumerable<StaffTaskTargetDto>>> Targets()
    {
        var users = await db.Users
            .Where(u => u.Role == Roles.Admin || u.Role == Roles.Staff)
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.Role, u.Position, u.Phone })
            .ToListAsync();

        var counts = (await db.StaffTasks.Select(t => t.StaffUserId).ToListAsync())
            .GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
        var linked = (await db.TelegramRegistrations.Where(r => r.UserId != null && r.UserId != "")
                .Select(r => r.UserId!).ToListAsync())
            .ToHashSet();

        return users.Select(u => new StaffTaskTargetDto(
            u.Id, u.FullName, u.Role, u.Position, u.Phone,
            linked.Contains(u.Id), counts.GetValueOrDefault(u.Id, 0))).ToList();
    }

    // ---------- O'ng taraf: tanlangan xodimning topshiriqlari ----------

    [HttpGet("{userId}/tasks")]
    public async Task<ActionResult<IEnumerable<StaffTaskDto>>> Tasks(string userId) =>
        await db.StaffTasks.Where(t => t.StaffUserId == userId)
            .OrderBy(t => t.Order).ThenBy(t => t.CreatedAt)
            .Select(t => new StaffTaskDto(t.Id, t.StaffUserId, t.Title, t.Order))
            .ToListAsync();

    [HttpPost("{userId}/tasks")]
    public async Task<ActionResult<StaffTaskDto>> Create(string userId, StaffTaskInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title))
            return BadRequest(new { message = "Topshiriq nomi bo'sh" });
        var user = await db.Users.FindAsync(userId);
        if (user is null || (user.Role != Roles.Admin && user.Role != Roles.Staff))
            return BadRequest(new { message = "Xodim topilmadi" });

        var maxOrder = await db.StaffTasks.Where(t => t.StaffUserId == userId)
            .Select(t => (int?)t.Order).MaxAsync() ?? -1;
        var t = new StaffTask
        {
            StaffUserId = userId,
            Title = input.Title.Trim(),
            Order = maxOrder + 1,
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
        db.StaffTasks.Add(t);
        await db.SaveChangesAsync();
        return new StaffTaskDto(t.Id, t.StaffUserId, t.Title, t.Order);
    }

    [HttpPut("tasks/{id}")]
    public async Task<ActionResult> Update(string id, StaffTaskInput input)
    {
        var t = await db.StaffTasks.FindAsync(id);
        if (t is null) return NotFound();
        if (string.IsNullOrWhiteSpace(input.Title))
            return BadRequest(new { message = "Topshiriq nomi bo'sh" });
        t.Title = input.Title.Trim();
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Topshiriqni o'chirish. TARIX (StaffTaskLog) SAQLANADI — o'tgan kunlar hisoboti buzilmaydi.</summary>
    [HttpDelete("tasks/{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        var t = await db.StaffTasks.FindAsync(id);
        if (t is null) return NotFound();
        db.StaffTasks.Remove(t);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Topshiriqlar tarixi ----------

    /// <summary>Berilgan kun uchun har xodimning shu kungi checklisti va bajarildi/bajarilmadi holati.</summary>
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<StaffTaskHistoryRowDto>>> History([FromQuery] string? date)
    {
        var day = string.IsNullOrWhiteSpace(date) ? AppClock.Today.ToString("yyyy-MM-dd") : date.Trim();
        var logs = await db.StaffTaskLogs.Where(l => l.Date == day)
            .OrderBy(l => l.Order).ThenBy(l => l.Title).ToListAsync();
        if (logs.Count == 0) return new List<StaffTaskHistoryRowDto>();

        var userIds = logs.Select(l => l.StaffUserId).Distinct().ToList();
        var names = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id, u => u.FullName);

        return logs.GroupBy(l => l.StaffUserId)
            .Select(g => new StaffTaskHistoryRowDto(
                g.Key,
                names.GetValueOrDefault(g.Key, "—"),
                g.Count(),
                g.Count(x => x.Done),
                g.OrderBy(x => x.Order).ThenBy(x => x.Title)
                    .Select(x => new StaffTaskHistoryItemDto(x.Title, x.Done, x.DoneAt)).ToList()))
            .OrderBy(r => r.FullName)
            .ToList();
    }

    // ---------- Kunlik jo'natish sozlamalari ----------

    [HttpGet("settings")]
    public async Task<ActionResult<StaffTaskSettingsDto>> GetSettings()
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        return new StaffTaskSettingsDto(
            meta?.StaffTaskEnabled ?? true,
            meta?.StaffTaskHour ?? 9,
            meta?.StaffTaskMinute ?? 0);
    }

    [HttpPut("settings")]
    public async Task<ActionResult> SetSettings(StaffTaskSettingsDto req)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (meta is null) return NotFound(new { message = "Markaz sozlamalari topilmadi" });
        meta.StaffTaskEnabled = req.Enabled;
        meta.StaffTaskHour = Math.Clamp(req.Hour, 0, 23);
        meta.StaffTaskMinute = Math.Clamp(req.Minute, 0, 59);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
