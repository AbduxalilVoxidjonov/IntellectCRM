using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Baholash MEZONLARI (kriteriyalar): mezon CRUD + guruhga biriktirish + guruh ichida
/// o'quvchilarni mezonlar bo'yicha baholash. Har guruhga boshqa-boshqa mezonlar biriktiriladi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/grading")]
public class GradingController(AppDbContext db) : ControllerBase
{
    // ---------- Mezonlar (pul) ----------

    [HttpGet("criteria")]
    public async Task<ActionResult<IEnumerable<GradingCriterionDto>>> Criteria() =>
        await db.GradingCriteria.OrderBy(c => c.Order).ThenBy(c => c.CreatedAt)
            .Select(c => new GradingCriterionDto(c.Id, c.Name, c.Description, c.MaxScore, c.Order))
            .ToListAsync();

    [HttpPost("criteria")]
    public async Task<ActionResult<GradingCriterionDto>> CreateCriterion(CriterionInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) return BadRequest(new { message = "Nom bo'sh" });
        var maxOrder = await db.GradingCriteria.Select(c => (int?)c.Order).MaxAsync() ?? -1;
        var c = new GradingCriterion
        {
            Name = input.Name.Trim(),
            Description = (input.Description ?? "").Trim(),
            MaxScore = input.MaxScore is > 0 and <= 1000 ? input.MaxScore : 5,
            Order = maxOrder + 1,
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
        db.GradingCriteria.Add(c);
        await db.SaveChangesAsync();
        return new GradingCriterionDto(c.Id, c.Name, c.Description, c.MaxScore, c.Order);
    }

    [HttpPut("criteria/{id}")]
    public async Task<ActionResult> UpdateCriterion(string id, CriterionInput input)
    {
        var c = await db.GradingCriteria.FindAsync(id);
        if (c is null) return NotFound();
        c.Name = (input.Name ?? "").Trim();
        c.Description = (input.Description ?? "").Trim();
        c.MaxScore = input.MaxScore is > 0 and <= 1000 ? input.MaxScore : c.MaxScore;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("criteria/{id}")]
    public async Task<ActionResult> DeleteCriterion(string id)
    {
        var c = await db.GradingCriteria.FindAsync(id);
        if (c is null) return NotFound();
        await db.GroupGradingCriteria.Where(g => g.CriterionId == id).ExecuteDeleteAsync();
        await db.CriterionGrades.Where(g => g.CriterionId == id).ExecuteDeleteAsync();
        db.GradingCriteria.Remove(c);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Guruhga biriktirish ----------

    /// <summary>Guruhga biriktirilgan mezon id'lari (tartibda).</summary>
    [HttpGet("group/{groupId}/criteria")]
    public async Task<ActionResult<IEnumerable<string>>> GroupCriteria(string groupId) =>
        await db.GroupGradingCriteria.Where(g => g.GroupId == groupId)
            .OrderBy(g => g.Order).Select(g => g.CriterionId).ToListAsync();

    /// <summary>Guruhga biriktirilgan mezonlarni to'liq almashtirish.</summary>
    [HttpPut("group/{groupId}/criteria")]
    public async Task<ActionResult> SetGroupCriteria(string groupId, GroupCriteriaInput input)
    {
        await db.GroupGradingCriteria.Where(g => g.GroupId == groupId).ExecuteDeleteAsync();
        var order = 0;
        foreach (var cid in (input.CriterionIds ?? new()).Distinct())
            db.GroupGradingCriteria.Add(new GroupGradingCriterion { GroupId = groupId, CriterionId = cid, Order = order++ });
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Baholash grid'i ----------

    [HttpGet("group/{groupId}/board")]
    public async Task<ActionResult<GradingBoardDto>> Board(string groupId, [FromQuery] string? month)
    {
        var group = await db.Classes.FindAsync(groupId);
        if (group is null) return NotFound();
        return await BuildBoardAsync(db, group, month);
    }

    [HttpPost("grade")]
    public async Task<ActionResult> Grade(SetCriterionGradeRequest req)
    {
        await UpsertGradeAsync(db, req);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Shu sanada bitta mezon bo'yicha BARCHA faol o'quvchini ommaviy belgilash/belgilamaslik.</summary>
    [HttpPost("grade/bulk")]
    public async Task<ActionResult> BulkGrade(BulkCriterionGradeRequest req)
    {
        var group = await db.Classes.FindAsync(req.GroupId);
        if (group is null) return NotFound();
        await BulkGradeAsync(db, group, req.CriterionId, req.Date, req.Done);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ---------- Umumiy yordamchilar (teacher ham ishlatadi) ----------

    /// <summary>Guruh baholash grid'ini quradi: oy(lar) + dars sanalari + biriktirilgan mezonlar +
    /// faol o'quvchilar + HAR DARSGA "bajardi" belgilari.</summary>
    public static async Task<GradingBoardDto> BuildBoardAsync(AppDbContext db, Group group, string? month)
    {
        // Oylar: guruh boshlanishidan joriy oygacha (jurnaldagi kabi).
        var cur = TuitionService.CurrentMonth();
        var startMonth = !string.IsNullOrEmpty(group.StartDate) && group.StartDate.Length >= 7 ? group.StartDate[..7] : cur;
        if (string.CompareOrdinal(startMonth, cur) > 0) startMonth = cur;
        var months = TuitionService.MonthRange(startMonth, cur).ToList();
        if (months.Count == 0) months.Add(cur);
        var resolved = !string.IsNullOrEmpty(month) && months.Contains(month) ? month! : months[^1];

        var dates = JournalService.LessonDatesInMonth(group.Days, resolved).ToList();

        var assigns = await db.GroupGradingCriteria.Where(g => g.GroupId == group.Id)
            .OrderBy(g => g.Order).ToListAsync();
        var critIds = assigns.Select(a => a.CriterionId).ToList();
        var critDict = await db.GradingCriteria.Where(c => critIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var criteria = assigns
            .Where(a => critDict.ContainsKey(a.CriterionId))
            .Select(a => new GradingBoardCriterionDto(a.CriterionId, critDict[a.CriterionId].Name, a.Order))
            .ToList();

        // Muzlatilgan (frozen) o'quvchi baholanmaydi — jurnal gridi kabi faqat faol/sinov.
        var memberIds = await db.StudentGroups
            .Where(sg => sg.GroupId == group.Id && sg.IsActive && sg.Status != "frozen")
            .Select(sg => sg.StudentId).ToListAsync();
        var students = await db.Students.Where(s => memberIds.Contains(s.Id) && !s.IsArchived)
            .OrderBy(s => s.FullName).ToListAsync();

        // "Bajardi" belgilar — faqat shu oydagi sanalar (sparse: faqat Done=true).
        var marks = await db.CriterionGrades
            .Where(g => g.GroupId == group.Id && g.Done && g.Date.StartsWith(resolved))
            .Select(g => new { g.StudentId, g.CriterionId, g.Date }).ToListAsync();
        var byStudent = marks.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => $"{x.CriterionId}|{x.Date}").ToList());

        var rows = students.Select(s => new GradingBoardStudentDto(
            s.Id, s.FullName, byStudent.TryGetValue(s.Id, out var d) ? d : new List<string>())).ToList();

        return new GradingBoardDto(group.Id, group.Name, months, resolved, dates, criteria, rows);
    }

    /// <summary>Bitta katakni belgilash: Done=true → yozuv (bajardi); Done=false → yozuvni o'chiramiz (sparse).</summary>
    public static async Task UpsertGradeAsync(AppDbContext db, SetCriterionGradeRequest req)
    {
        var existing = await db.CriterionGrades.FirstOrDefaultAsync(
            g => g.GroupId == req.GroupId && g.StudentId == req.StudentId
                 && g.CriterionId == req.CriterionId && g.Date == req.Date);
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        if (req.Done)
        {
            if (existing is null)
                db.CriterionGrades.Add(new CriterionGrade
                {
                    GroupId = req.GroupId, StudentId = req.StudentId, CriterionId = req.CriterionId,
                    Date = req.Date, Done = true, UpdatedAt = now,
                });
            else { existing.Done = true; existing.UpdatedAt = now; }
        }
        else if (existing is not null)
        {
            db.CriterionGrades.Remove(existing);
        }
    }

    /// <summary>Shu sanada bitta mezon bo'yicha guruhning BARCHA faol (frozen emas) o'quvchisini belgilaydi/olib tashlaydi.</summary>
    public static async Task BulkGradeAsync(AppDbContext db, Group group, string criterionId, string date, bool done)
    {
        var memberIds = await db.StudentGroups
            .Where(sg => sg.GroupId == group.Id && sg.IsActive && sg.Status != "frozen")
            .Select(sg => sg.StudentId).ToListAsync();
        var existing = await db.CriterionGrades
            .Where(g => g.GroupId == group.Id && g.CriterionId == criterionId && g.Date == date).ToListAsync();
        var byStudent = existing.ToDictionary(g => g.StudentId);
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        foreach (var sid in memberIds)
        {
            byStudent.TryGetValue(sid, out var e);
            if (done)
            {
                if (e is null)
                    db.CriterionGrades.Add(new CriterionGrade
                    {
                        GroupId = group.Id, StudentId = sid, CriterionId = criterionId,
                        Date = date, Done = true, UpdatedAt = now,
                    });
                else { e.Done = true; e.UpdatedAt = now; }
            }
            else if (e is not null)
            {
                db.CriterionGrades.Remove(e);
            }
        }
    }
}
