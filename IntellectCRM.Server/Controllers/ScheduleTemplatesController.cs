using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/classes/{classId}/schedule-templates")]
public class ScheduleTemplatesController(AppDbContext db) : ControllerBase
{
    private static ScheduleTemplateDto ToDto(ScheduleTemplate t) => new(
        t.Id, t.ClassId, t.Name,
        t.Lessons.OrderBy(l => l.Day).ThenBy(l => l.Period)
            .Select(l => new ScheduleLessonDto(l.Day, l.Period, l.SubjectId, l.TeacherId)).ToList());

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ScheduleTemplateDto>>> GetAll(string classId)
    {
        var templates = await db.ScheduleTemplates
            .Include(t => t.Lessons)
            .Where(t => t.ClassId == classId)
            .ToListAsync();
        return templates.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<ScheduleTemplateDto>> Create(string classId, CreateTemplateRequest req)
    {
        var tpl = new ScheduleTemplate { ClassId = classId, Name = req.Name };
        db.ScheduleTemplates.Add(tpl);
        await db.SaveChangesAsync();
        return ToDto(tpl);
    }

    [HttpPatch("{templateId}")]
    public async Task<IActionResult> Rename(string classId, string templateId, RenameTemplateRequest req)
    {
        var tpl = await db.ScheduleTemplates.FirstOrDefaultAsync(t => t.Id == templateId && t.ClassId == classId);
        if (tpl is null) return NotFound();
        tpl.Name = req.Name;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{templateId}")]
    public async Task<IActionResult> Delete(string classId, string templateId)
    {
        var tpl = await db.ScheduleTemplates.FirstOrDefaultAsync(t => t.Id == templateId && t.ClassId == classId);
        if (tpl is null) return NotFound();
        db.ScheduleTemplates.Remove(tpl);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Jadval katagini butun sinf uchun belgilash (eski oqim — orqaga moslik).
    /// Avval (Day,Period) dagi BARCHA yozuvlar o'chiriladi va bitta lesson qo'shiladi.
    /// Yangi UI <c>cell</c> endpoint'idan foydalanadi.
    /// </summary>
    [HttpPut("{templateId}/{day:int}/{period:int}")]
    public async Task<IActionResult> SetSlot(string classId, string templateId, int day, int period, ScheduleLessonDto lesson)
    {
        var tpl = await db.ScheduleTemplates.Include(t => t.Lessons)
            .FirstOrDefaultAsync(t => t.Id == templateId && t.ClassId == classId);
        if (tpl is null) return NotFound();

        var existing = tpl.Lessons.Where(l => l.Day == day && l.Period == period).ToList();
        db.RemoveRange(existing);
        tpl.Lessons.Add(new ScheduleLesson
        {
            TemplateId = tpl.Id,
            Day = day,
            Period = period,
            SubjectId = lesson.SubjectId,
            TeacherId = lesson.TeacherId,
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Jadval katagini tozalash.</summary>
    [HttpDelete("{templateId}/{day:int}/{period:int}")]
    public async Task<IActionResult> ClearSlot(string classId, string templateId, int day, int period)
    {
        var tpl = await db.ScheduleTemplates.Include(t => t.Lessons)
            .FirstOrDefaultAsync(t => t.Id == templateId && t.ClassId == classId);
        if (tpl is null) return NotFound();

        var existing = tpl.Lessons.Where(l => l.Day == day && l.Period == period).ToList();
        db.RemoveRange(existing);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Bir katak (Day,Period) ning to'liq holatini almashtirish. Lessons: bo'sh = tozalash,
    /// 1 ta = butun sinf darsi. Day/Period mos kelmasa 400.
    /// </summary>
    [HttpPut("{templateId}/cell")]
    public async Task<IActionResult> SetCell(string classId, string templateId, SetCellRequest req)
    {
        var tpl = await db.ScheduleTemplates.Include(t => t.Lessons)
            .FirstOrDefaultAsync(t => t.Id == templateId && t.ClassId == classId);
        if (tpl is null) return NotFound();

        var lessons = req.Lessons ?? new();
        if (lessons.Any(l => l.Day != req.Day || l.Period != req.Period))
            return BadRequest(new { message = "Day/Period darslarda mos kelmaydi" });
        if (lessons.Count > 1)
            return BadRequest(new { message = "Bir katakda faqat bitta dars bo'lishi mumkin" });

        var existing = tpl.Lessons.Where(l => l.Day == req.Day && l.Period == req.Period).ToList();
        db.RemoveRange(existing);
        foreach (var l in lessons)
        {
            tpl.Lessons.Add(new ScheduleLesson
            {
                TemplateId = tpl.Id,
                Day = l.Day,
                Period = l.Period,
                SubjectId = l.SubjectId,
                TeacherId = l.TeacherId,
            });
        }
        await db.SaveChangesAsync();
        return NoContent();
    }
}
