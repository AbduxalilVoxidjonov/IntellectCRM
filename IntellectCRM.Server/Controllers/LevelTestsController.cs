using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>Daraja testi — admin CRUD + ommaviy URL + natijalar (topshiruvchilar lid bo'lib tushadi).</summary>
[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/level-tests")]
public class LevelTestsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LevelTestListDto>>> GetAll()
    {
        var tests = await db.LevelTests.ToListAsync();
        var subjects = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);
        var qCounts = (await db.LevelTestQuestions.GroupBy(q => q.TestId)
                .Select(g => new { g.Key, C = g.Count() }).ToListAsync())
            .ToDictionary(x => x.Key, x => x.C);
        var sCounts = (await db.LevelTestSubmissions.GroupBy(s => s.TestId)
                .Select(g => new { g.Key, C = g.Count() }).ToListAsync())
            .ToDictionary(x => x.Key, x => x.C);
        return tests
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new LevelTestListDto(
                t.Id, t.Title, t.CourseId, subjects.GetValueOrDefault(t.CourseId, ""), t.Slug,
                t.IsActive, t.CreatedAt,
                qCounts.GetValueOrDefault(t.Id, 0), sCounts.GetValueOrDefault(t.Id, 0)))
            .ToList();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<LevelTestDetailDto>> Get(string id)
    {
        var test = await db.LevelTests.FindAsync(id);
        if (test is null) return NotFound();
        return await LevelTestService.BuildDetailAsync(db, test);
    }

    [HttpPost]
    public async Task<ActionResult<LevelTestDetailDto>> Create(LevelTestPayload p)
    {
        var test = new LevelTest
        {
            Title = (p.Title ?? "").Trim(),
            CourseId = p.CourseId ?? "",
            Intro = p.Intro ?? "",
            IsActive = p.IsActive,
            Slug = await LevelTestService.GenerateSlugAsync(db, p.Title ?? ""),
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
        db.LevelTests.Add(test);
        WriteQuestions(test.Id, p.Questions);
        WriteBands(test.Id, p.Bands);
        await db.SaveChangesAsync();
        return await LevelTestService.BuildDetailAsync(db, test);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<LevelTestDetailDto>> Update(string id, LevelTestPayload p)
    {
        var test = await db.LevelTests.FindAsync(id);
        if (test is null) return NotFound();
        test.Title = (p.Title ?? "").Trim();
        test.CourseId = p.CourseId ?? "";
        test.Intro = p.Intro ?? "";
        test.IsActive = p.IsActive;

        // Savol va diapazonlar — to'liq almashtiriladi (oddiy va ishonchli).
        db.LevelTestQuestions.RemoveRange(db.LevelTestQuestions.Where(q => q.TestId == id));
        db.LevelTestBands.RemoveRange(db.LevelTestBands.Where(b => b.TestId == id));
        WriteQuestions(id, p.Questions);
        WriteBands(id, p.Bands);
        await db.SaveChangesAsync();
        return await LevelTestService.BuildDetailAsync(db, test);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var test = await db.LevelTests.FindAsync(id);
        if (test is null) return NotFound();
        db.LevelTestQuestions.RemoveRange(db.LevelTestQuestions.Where(q => q.TestId == id));
        db.LevelTestBands.RemoveRange(db.LevelTestBands.Where(b => b.TestId == id));
        db.LevelTestSubmissions.RemoveRange(db.LevelTestSubmissions.Where(s => s.TestId == id));
        db.LevelTests.Remove(test);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Natijalar — testni topshirganlar (har biri CRM'da lid).</summary>
    [HttpGet("{id}/submissions")]
    public async Task<ActionResult<IEnumerable<LevelTestSubmissionDto>>> Submissions(string id)
    {
        var subs = await db.LevelTestSubmissions.Where(s => s.TestId == id)
            .OrderByDescending(s => s.CreatedAt).ToListAsync();
        return subs.Select(s => new LevelTestSubmissionDto(
            s.Id, s.FullName, s.Phone, s.Age, s.Score, s.Total, s.Percent, s.Level, s.CreatedAt, s.LeadId,
            ParseSurvey(s.SurveyJson))).ToList();
    }

    /// <summary>SurveyJson → DTO ro'yxati (buzilgan bo'lsa bo'sh).</summary>
    private static List<SurveyAnswerDto> ParseSurvey(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try { return System.Text.Json.JsonSerializer.Deserialize<List<SurveyAnswerDto>>(json) ?? new(); }
        catch { return new(); }
    }

    /// <summary>Daraja testi STATISTIKASI — topshiruvchilardan nechtasi AKTIV o'quvchi bo'ldi +
    /// qaysi guruh(lar)ga qo'shilgani va o'qituvchisi (FISH).</summary>
    [HttpGet("{id}/stats")]
    public async Task<ActionResult<LevelTestStatsDto>> Stats(string id)
    {
        var subs = await db.LevelTestSubmissions.Where(s => s.TestId == id)
            .OrderByDescending(s => s.CreatedAt).ToListAsync();

        var leadIds = subs.Select(s => s.LeadId).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
        // Lid → o'quvchi (ConvertedStudentId)
        var leadToStudent = (await db.Leads.Where(l => leadIds.Contains(l.Id) && l.ConvertedStudentId != null)
                .Select(l => new { l.Id, l.ConvertedStudentId })
                .ToListAsync())
            .ToDictionary(l => l.Id, l => l.ConvertedStudentId!);
        var studentIds = leadToStudent.Values.Distinct().ToList();

        // Mavjud (arxivlanmagan) o'quvchilar
        var existing = (await db.Students.Where(st => studentIds.Contains(st.Id) && !st.IsArchived)
            .Select(st => st.Id).ToListAsync()).ToHashSet();
        // AKTIV guruh a'zoliklari (Status=="active") — guruh + o'qituvchi (FISH) uchun.
        var activeMemberships = await db.StudentGroups
            .Where(sg => studentIds.Contains(sg.StudentId) && sg.IsActive && sg.Status == "active")
            .Select(sg => new { sg.StudentId, sg.GroupId }).ToListAsync();
        var active = activeMemberships.Select(m => m.StudentId).ToHashSet();

        // Guruh nomi + o'qituvchi (FISH)
        var groupIds = activeMemberships.Select(m => m.GroupId).Distinct().ToList();
        var groups = await db.Classes.Where(g => groupIds.Contains(g.Id))
            .Select(g => new { g.Id, g.Name, g.TeacherId }).ToListAsync();
        var groupById = groups.ToDictionary(g => g.Id, g => g);
        var teacherIds = groups.Select(g => g.TeacherId).Where(t => !string.IsNullOrEmpty(t)).Distinct().ToList();
        var teacherNames = await db.Teachers.Where(t => teacherIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.FullName);

        // O'quvchi → aktiv guruh(lar)i nomi va o'qituvchisi (bir nechta bo'lsa vergul bilan)
        var byStudent = activeMemberships
            .GroupBy(m => m.StudentId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var names = new List<string>();
                    var teachers = new List<string>();
                    foreach (var m in g)
                    {
                        if (!groupById.TryGetValue(m.GroupId, out var grp)) continue;
                        if (!string.IsNullOrEmpty(grp.Name)) names.Add(grp.Name);
                        var tn = teacherNames.GetValueOrDefault(grp.TeacherId ?? "", "");
                        if (!string.IsNullOrEmpty(tn)) teachers.Add(tn);
                    }
                    return (Groups: string.Join(", ", names.Distinct()),
                            Teachers: string.Join(", ", teachers.Distinct()));
                });

        var rows = subs.Select(s =>
        {
            string? sid = leadToStudent.TryGetValue(s.LeadId, out var v) && existing.Contains(v) ? v : null;
            var isActive = sid != null && active.Contains(sid);
            var info = sid != null && byStudent.TryGetValue(sid, out var gi) ? gi : ("", "");
            return new LevelTestStatRowDto(
                s.Id, s.FullName, s.Phone, s.Level, s.Percent, s.CreatedAt, s.LeadId,
                sid, isActive, info.Item1, info.Item2);
        }).ToList();

        return new LevelTestStatsDto(rows.Count, rows.Count(r => r.Active), rows);
    }

    private void WriteQuestions(string testId, List<LevelTestQuestionInput>? questions)
    {
        if (questions is null) return;
        var order = 0;
        foreach (var q in questions)
        {
            if (string.IsNullOrWhiteSpace(q.Text)) continue;
            var opts = (q.Options ?? new()).Select(o => (o ?? "").Trim()).Where(o => o.Length > 0).ToList();
            if (opts.Count < 2) continue; // kamida 2 variant
            var kind = q.Kind == "survey" ? "survey" : "question";
            var correct = q.CorrectIndex >= 0 && q.CorrectIndex < opts.Count ? q.CorrectIndex : 0;
            db.LevelTestQuestions.Add(new LevelTestQuestion
            {
                TestId = testId, Text = q.Text.Trim(), Options = opts, CorrectIndex = correct,
                Kind = kind, Multiple = kind == "survey" && q.Multiple, Order = order++,
            });
        }
    }

    private void WriteBands(string testId, List<LevelTestBandInput>? bands)
    {
        if (bands is null) return;
        var order = 0;
        foreach (var b in bands.OrderBy(x => x.MinPercent))
        {
            if (string.IsNullOrWhiteSpace(b.Label)) continue;
            var min = Math.Clamp(b.MinPercent, 0, 100);
            db.LevelTestBands.Add(new LevelTestBand
            {
                TestId = testId, Label = b.Label.Trim(), MinPercent = min, Order = order++,
            });
        }
    }
}
