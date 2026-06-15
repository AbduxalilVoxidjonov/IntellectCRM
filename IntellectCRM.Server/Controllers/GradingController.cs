using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
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
    public async Task<ActionResult<GradingBoardDto>> Board(string groupId)
    {
        var group = await db.Classes.FindAsync(groupId);
        if (group is null) return NotFound();
        return await BuildBoardAsync(db, group);
    }

    [HttpPost("grade")]
    public async Task<ActionResult> Grade(SetCriterionGradeRequest req)
    {
        await UpsertGradeAsync(db, req);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ---------- Umumiy yordamchilar (teacher ham ishlatadi) ----------

    /// <summary>Guruh baholash grid'ini quradi: biriktirilgan mezonlar + faol o'quvchilar + bahalar.</summary>
    public static async Task<GradingBoardDto> BuildBoardAsync(AppDbContext db, Group group)
    {
        var assigns = await db.GroupGradingCriteria.Where(g => g.GroupId == group.Id)
            .OrderBy(g => g.Order).ToListAsync();
        var critIds = assigns.Select(a => a.CriterionId).ToList();
        var critDict = await db.GradingCriteria.Where(c => critIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var criteria = assigns
            .Where(a => critDict.ContainsKey(a.CriterionId))
            .Select(a => { var c = critDict[a.CriterionId]; return new GradingBoardCriterionDto(c.Id, c.Name, c.MaxScore, a.Order); })
            .ToList();

        var memberIds = await db.StudentGroups.Where(sg => sg.GroupId == group.Id && sg.IsActive)
            .Select(sg => sg.StudentId).ToListAsync();
        var students = await db.Students.Where(s => memberIds.Contains(s.Id) && !s.IsArchived)
            .OrderBy(s => s.FullName).ToListAsync();
        var grades = await db.CriterionGrades.Where(g => g.GroupId == group.Id).ToListAsync();
        var lookup = grades.GroupBy(g => g.StudentId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(x => x.CriterionId, x => x.Score));

        var rows = students.Select(s => new GradingBoardStudentDto(
            s.Id, s.FullName,
            lookup.TryGetValue(s.Id, out var d) ? d : new Dictionary<string, double>())).ToList();

        return new GradingBoardDto(group.Id, group.Name, criteria, rows);
    }

    /// <summary>Bitta katak bahosini upsert qiladi (0..MaxScore oralig'iga kesiladi).</summary>
    public static async Task UpsertGradeAsync(AppDbContext db, SetCriterionGradeRequest req)
    {
        var max = await db.GradingCriteria.Where(c => c.Id == req.CriterionId).Select(c => (int?)c.MaxScore).FirstOrDefaultAsync() ?? 5;
        var score = Math.Clamp(req.Score, 0, max);
        var existing = await db.CriterionGrades.FirstOrDefaultAsync(
            g => g.GroupId == req.GroupId && g.StudentId == req.StudentId && g.CriterionId == req.CriterionId);
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        if (existing is null)
            db.CriterionGrades.Add(new CriterionGrade
            {
                GroupId = req.GroupId, StudentId = req.StudentId, CriterionId = req.CriterionId,
                Score = score, UpdatedAt = now,
            });
        else
        {
            existing.Score = score;
            existing.UpdatedAt = now;
        }
    }
}
