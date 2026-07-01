using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// "Eslatmalar" (Sozlamalar → Eslatmalar) — avtomatik push-eslatma qoidalari CRUD'i. Har qoida
/// <see cref="ReminderTriggers"/> katalogidagi bitta turga bog'lanadi (masalan qarzdorlik eslatmasi
/// yoki o'qituvchiga davomat eslatmasi); haqiqiy yuborish mantig'i tegishli fon xizmatida
/// (<see cref="PaymentReminderService"/> / <see cref="LessonAttendanceReminderService"/>).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("settings")]
[Route("api/admin/reminders")]
public class RemindersController(AppDbContext db) : ControllerBase
{
    [HttpGet("types")]
    public ActionResult<IEnumerable<ReminderTriggerInfoDto>> Types() =>
        ReminderTriggers.All.Select(t => new ReminderTriggerInfoDto(
            t.Key, t.Label, t.Description, t.SupportsTemplate, t.SupportsOffset,
            t.SupportsAudience, t.SupportsSchedule, t.Tokens)).ToList();

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ReminderRuleDto>>> List()
    {
        var list = await db.ReminderRules.OrderBy(r => r.CreatedAt).ToListAsync();
        return list.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<ReminderRuleDto>> Create(SaveReminderRuleRequest req)
    {
        var error = Validate(req);
        if (error is not null) return BadRequest(new { message = error });

        var rule = new ReminderRule
        {
            Trigger = req.Trigger,
            Name = req.Name.Trim(),
            Enabled = req.Enabled,
            MessageTemplate = req.MessageTemplate.Trim(),
            OffsetMinutes = req.OffsetMinutes,
            Audience = req.Audience,
            ScheduleType = req.ScheduleType,
            ScheduleTime = req.ScheduleTime,
            ScheduleDayOfMonth = req.ScheduleDayOfMonth,
        };
        db.ReminderRules.Add(rule);
        await db.SaveChangesAsync();
        return ToDto(rule);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ReminderRuleDto>> Update(string id, SaveReminderRuleRequest req)
    {
        var rule = await db.ReminderRules.FindAsync(id);
        if (rule is null) return NotFound();
        var error = Validate(req);
        if (error is not null) return BadRequest(new { message = error });

        rule.Trigger = req.Trigger;
        rule.Name = req.Name.Trim();
        rule.Enabled = req.Enabled;
        rule.MessageTemplate = req.MessageTemplate.Trim();
        rule.OffsetMinutes = req.OffsetMinutes;
        rule.Audience = req.Audience;
        rule.ScheduleType = req.ScheduleType;
        rule.ScheduleTime = req.ScheduleTime;
        rule.ScheduleDayOfMonth = req.ScheduleDayOfMonth;
        await db.SaveChangesAsync();
        return ToDto(rule);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var rule = await db.ReminderRules.FindAsync(id);
        if (rule is null) return NotFound();
        db.ReminderRules.Remove(rule);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static string? Validate(SaveReminderRuleRequest req)
    {
        if (!ReminderTriggers.IsKnown(req.Trigger)) return "Noma'lum eslatma turi";
        if (string.IsNullOrWhiteSpace(req.Name)) return "Nom kerak";
        if (req.OffsetMinutes < 0) return "Vaqt siljishi manfiy bo'lishi mumkin emas";

        var type = ReminderTriggers.All.First(t => t.Key == req.Trigger);
        if (type.SupportsAudience && !ReminderAudiences.IsKnown(req.Audience))
            return "Auditoriya tanlanmagan";
        if (type.SupportsSchedule)
        {
            if (req.ScheduleType != "daily" && req.ScheduleType != "monthly")
                return "Jadval turi noto'g'ri";
            if (!System.TimeSpan.TryParse(req.ScheduleTime, out _))
                return "Vaqt formati noto'g'ri (HH:mm)";
            if (req.ScheduleType == "monthly" && req.ScheduleDayOfMonth is < 1 or > 31)
                return "Oyning kuni 1-31 oralig'ida bo'lishi kerak";
        }
        return null;
    }

    private static ReminderRuleDto ToDto(ReminderRule r) =>
        new(r.Id, r.Trigger, r.Name, r.Enabled, r.MessageTemplate, r.OffsetMinutes,
            r.Audience, r.ScheduleType, r.ScheduleTime, r.ScheduleDayOfMonth, r.CreatedAt);
}
