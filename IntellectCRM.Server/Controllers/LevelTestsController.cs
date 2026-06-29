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
        db.LevelTestInvites.RemoveRange(db.LevelTestInvites.Where(i => i.TestId == id));
        db.LevelTests.Remove(test);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Bu testga yuborilgan bir martalik havolalar (invite) — lid + SMS holati + ishlangani.</summary>
    [HttpGet("{id}/invites")]
    public async Task<ActionResult<IEnumerable<LevelTestInviteDto>>> Invites(string id)
    {
        var invites = await db.LevelTestInvites.Where(i => i.TestId == id)
            .OrderByDescending(i => i.CreatedAt).ToListAsync();
        var leadIds = invites.Select(i => i.LeadId).Distinct().ToList();
        var leads = (await db.Leads.Where(l => leadIds.Contains(l.Id)).ToListAsync())
            .ToDictionary(l => l.Id, l => l);
        return invites.Select(i =>
        {
            leads.TryGetValue(i.LeadId, out var l);
            return new LevelTestInviteDto(
                i.Id, i.TestId, i.LeadId, l?.FullName ?? "(o'chirilgan lid)", l?.Phone ?? "",
                i.SmsStatus, i.CreatedAt, !string.IsNullOrEmpty(i.UsedAt), i.UsedAt, i.Percent, i.Level);
        }).ToList();
    }

    /// <summary>BARCHA daraja testlari bo'yicha UMUMIY statistika (testga kirmasdan ro'yxatda ko'rish uchun).</summary>
    [HttpGet("overall-stats")]
    public async Task<ActionResult<LevelTestOverallStatsDto>> OverallStats()
    {
        var tests = await db.LevelTests.ToListAsync();
        var subs = await db.LevelTestSubmissions.OrderByDescending(s => s.CreatedAt).ToListAsync();
        var invites = await db.LevelTestInvites.ToListAsync();

        var byLevel = subs.GroupBy(s => string.IsNullOrEmpty(s.Level) ? "—" : s.Level)
            .Select(g => new LevelCountDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToList();

        var titleById = tests.ToDictionary(t => t.Id, t => t.Title);
        var byTest = tests
            .Select(t =>
            {
                var ts = subs.Where(s => s.TestId == t.Id).ToList();
                var ti = invites.Where(i => i.TestId == t.Id).ToList();
                return new TestStatRowDto(
                    t.Id, t.Title, ts.Count, ti.Count, ti.Count(x => !string.IsNullOrEmpty(x.UsedAt)),
                    ts.Count > 0 ? Math.Round(ts.Average(s => s.Percent), 1) : 0);
            })
            .OrderByDescending(r => r.Submissions).ToList();

        // Boyitilgan per-topshiruvchi qatorlar — bitta test statistikasidagi MANTIQ, BARCHA testlarga.
        // Qaytish tartibi `subs` bilan bir xil — test nomini biriktirish uchun zip qilamiz.
        var statRows = await LevelTestService.BuildStatRowsAsync(db, subs);
        var rows = statRows.Zip(subs, (r, s) => new LevelTestOverallRowDto(
                r.SubmissionId, s.TestId, titleById.GetValueOrDefault(s.TestId, ""),
                r.FullName, r.Phone, r.Level, r.Percent, r.CreatedAt, r.LeadId,
                r.StudentId, r.Active, r.GroupName, r.TeacherName, r.IsDeleted))
            .ToList();

        return new LevelTestOverallStatsDto(
            tests.Count, subs.Count, invites.Count,
            invites.Count(i => !string.IsNullOrEmpty(i.UsedAt)),
            subs.Count > 0 ? Math.Round(subs.Average(s => s.Percent), 1) : 0,
            statRows.Count(r => r.Active),
            byLevel, byTest, rows);
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
        var rows = await LevelTestService.BuildStatRowsAsync(db, subs);
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
