using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Test natijalari — guruh uchun o'tkazilgan testlar (nomi, sanasi, maksimal ball) va har o'quvchining
/// olgan bali. Admin ("O'quv bo'limi" → Testlar natijalari) va o'qituvchi ilovasi (profil → Testlar)
/// bir xil mantiqni ishlatadi (bu servis), faqat controllerlar KIRISH ruxsatini (admin = barcha guruh,
/// o'qituvchi = faqat o'z guruhi) alohida tekshiradi.
///
/// Ballar <see cref="TestScore"/> ichida per (test, o'quvchi) saqlanadi; tafsilotdagi qatorlar
/// guruhning FAOL a'zolari (<see cref="StudentGroup.IsActive"/>) bilan chapdan birlashtiriladi va
/// ball bo'yicha kamayish tartibida (ball kiritilmaganlar oxirida) saralanadi.
/// </summary>
public static class TestResultService
{
    /// <summary>Testlar natijalari bosh sahifasi — barcha guruhlar + har biriga yaratilgan testlar soni.
    /// Faol a'zolar soni ham qaytadi. Arxivlanmagan guruhlar, nomi bo'yicha tartiblangan.</summary>
    public static async Task<List<TestGroupOverviewDto>> GroupsOverviewAsync(IAppDbContext db)
    {
        var groups = await db.Classes.AsNoTracking()
            .Where(g => !g.IsArchived)
            .OrderBy(g => g.Name)
            .ToListAsync();

        var courseNames = await db.Subjects.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.Name);
        var teacherNames = await db.Teachers.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.FullName);

        var testCounts = await db.TestResults.AsNoTracking()
            .GroupBy(t => t.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count);

        var memberCounts = await db.StudentGroups.AsNoTracking()
            .Where(sg => sg.IsActive)
            .GroupBy(sg => sg.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count);

        return groups.Select(g => new TestGroupOverviewDto(
            g.Id, g.Name,
            courseNames.GetValueOrDefault(g.CourseId, ""),
            g.TeacherId,
            teacherNames.GetValueOrDefault(g.TeacherId, ""),
            memberCounts.GetValueOrDefault(g.Id, 0),
            testCounts.GetValueOrDefault(g.Id, 0))).ToList();
    }

    /// <summary>Bitta guruhning testlar ro'yxati (sana desc → yangi test tepada), har testda
    /// faol o'quvchilar soni, ball kiritilganlar soni va o'rtacha ball.</summary>
    public static async Task<List<GroupTestDto>> ListForGroupAsync(IAppDbContext db, string groupId)
    {
        var tests = await db.TestResults.AsNoTracking()
            .Where(t => t.GroupId == groupId)
            .ToListAsync();
        if (tests.Count == 0) return new List<GroupTestDto>();

        var studentCount = await db.StudentGroups.AsNoTracking()
            .CountAsync(sg => sg.GroupId == groupId && sg.IsActive);

        var testIds = tests.Select(t => t.Id).ToList();
        var scores = await db.TestScores.AsNoTracking()
            .Where(s => testIds.Contains(s.TestResultId))
            .ToListAsync();
        var byTest = scores.GroupBy(s => s.TestResultId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return tests
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t =>
            {
                var s = byTest.GetValueOrDefault(t.Id) ?? new List<TestScore>();
                decimal? avg = s.Count > 0 ? Math.Round(s.Average(x => x.Score), 1) : null;
                return new GroupTestDto(t.Id, t.GroupId, t.Name, t.Date, t.MaxScore,
                    t.CreatedAt, t.CreatedBy, studentCount, s.Count, avg);
            })
            .ToList();
    }

    /// <summary>Yangi test yaratish. Nomi bo'sh yoki maksimal ball ≤ 0 bo'lsa xato (message qaytadi).</summary>
    public static async Task<(GroupTestDto? Dto, string? Error)> CreateAsync(
        IAppDbContext db, string groupId, string name, string date, decimal maxScore, string createdBy)
    {
        var group = await db.Classes.FindAsync(groupId);
        if (group is null) return (null, "Guruh topilmadi");
        var err = Validate(name, maxScore);
        if (err != null) return (null, err);

        var t = new TestResult
        {
            GroupId = groupId,
            Name = name.Trim(),
            Date = string.IsNullOrWhiteSpace(date) ? AppClock.Today.ToString("yyyy-MM-dd") : date.Trim(),
            MaxScore = maxScore,
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
            CreatedBy = createdBy,
        };
        db.TestResults.Add(t);
        await db.SaveChangesAsync();

        var studentCount = await db.StudentGroups.AsNoTracking()
            .CountAsync(sg => sg.GroupId == groupId && sg.IsActive);
        return (new GroupTestDto(t.Id, t.GroupId, t.Name, t.Date, t.MaxScore,
            t.CreatedAt, t.CreatedBy, studentCount, 0, null), null);
    }

    /// <summary>Test ma'lumotini tahrirlash (nomi/sana/maksimal ball).</summary>
    public static async Task<(bool Ok, string? Error)> UpdateAsync(
        IAppDbContext db, string id, string name, string date, decimal maxScore)
    {
        var t = await db.TestResults.FindAsync(id);
        if (t is null) return (false, "Test topilmadi");
        var err = Validate(name, maxScore);
        if (err != null) return (false, err);

        t.Name = name.Trim();
        if (!string.IsNullOrWhiteSpace(date)) t.Date = date.Trim();
        t.MaxScore = maxScore;
        await db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Testni o'chirish (ballari FK CASCADE bilan o'chadi).</summary>
    public static async Task<bool> DeleteAsync(IAppDbContext db, string id)
    {
        var t = await db.TestResults.FindAsync(id);
        if (t is null) return false;
        db.TestResults.Remove(t);
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>Bitta testni topib GroupId'sini qaytaradi (ruxsat tekshiruvi uchun). null = topilmadi.</summary>
    public static async Task<string?> GroupIdOfAsync(IAppDbContext db, string testId) =>
        (await db.TestResults.AsNoTracking().FirstOrDefaultAsync(t => t.Id == testId))?.GroupId;

    /// <summary>Test tafsiloti — guruhning FAOL o'quvchilari + ballari, ball desc bo'yicha saralangan.
    /// Ball kiritilmagan o'quvchilar oxirida (Rank=0). null = test topilmadi.</summary>
    public static async Task<TestResultDetailDto?> DetailAsync(IAppDbContext db, string id)
    {
        var t = await db.TestResults.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return null;
        var group = await db.Classes.AsNoTracking().FirstOrDefaultAsync(g => g.Id == t.GroupId);

        var members = await (from sg in db.StudentGroups.AsNoTracking()
                             join s in db.Students.AsNoTracking() on sg.StudentId equals s.Id
                             where sg.GroupId == t.GroupId && sg.IsActive
                             select new { s.Id, s.FullName }).ToListAsync();

        var scores = await db.TestScores.AsNoTracking()
            .Where(s => s.TestResultId == id)
            .ToDictionaryAsync(s => s.StudentId, s => (decimal?)s.Score);

        var rows = members
            .Select(m => new { m.Id, m.FullName, Score = scores.GetValueOrDefault(m.Id) })
            // Ball kiritilganlar tepada (ball desc), keyin ism bo'yicha; kiritilmaganlar oxirida.
            .OrderByDescending(x => x.Score.HasValue)
            .ThenByDescending(x => x.Score ?? 0)
            .ThenBy(x => x.FullName)
            .ToList();

        int rank = 0;
        var result = rows.Select(x => new TestScoreRowDto(
            x.Id, x.FullName, x.Score, x.Score.HasValue ? ++rank : 0)).ToList();

        return new TestResultDetailDto(t.Id, t.GroupId, group?.Name ?? "", t.Name, t.Date,
            t.MaxScore, t.CreatedAt, t.CreatedBy, result);
    }

    /// <summary>Bitta o'quvchiga ball qo'yish/yangilash yoki tozalash (score=null). Ball 0..MaxScore
    /// oralig'iga qisiladi. Qaytadi: yangilangan tafsilot (qayta saralangan).</summary>
    public static async Task<(TestResultDetailDto? Detail, string? Error)> SetScoreAsync(
        IAppDbContext db, string testId, string studentId, decimal? score)
    {
        var t = await db.TestResults.FindAsync(testId);
        if (t is null) return (null, "Test topilmadi");

        var existing = await db.TestScores
            .FirstOrDefaultAsync(s => s.TestResultId == testId && s.StudentId == studentId);

        if (score is null)
        {
            if (existing is not null) db.TestScores.Remove(existing);
        }
        else
        {
            var val = Math.Clamp(score.Value, 0, t.MaxScore);
            if (existing is null)
                db.TestScores.Add(new TestScore { TestResultId = testId, StudentId = studentId, Score = val });
            else
                existing.Score = val;
        }
        await db.SaveChangesAsync();
        return (await DetailAsync(db, testId), null);
    }

    /// <summary>Bitta o'quvchining barcha test natijalari (guruhlaridan), sana desc. Har testda
    /// o'quvchining ballari orasidagi o'rni (Rank) va jami ball kiritilganlar soni (Total).</summary>
    public static async Task<List<StudentGroupTestDto>> StudentResultsAsync(IAppDbContext db, string studentId)
    {
        // O'quvchining ball kiritilgan testlari.
        var myScores = await db.TestScores.AsNoTracking()
            .Where(s => s.StudentId == studentId)
            .ToListAsync();
        if (myScores.Count == 0) return new List<StudentGroupTestDto>();

        var testIds = myScores.Select(s => s.TestResultId).Distinct().ToList();
        var tests = await db.TestResults.AsNoTracking()
            .Where(t => testIds.Contains(t.Id))
            .ToListAsync();
        var groupNames = await db.Classes.AsNoTracking()
            .Where(g => tests.Select(t => t.GroupId).Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, g => g.Name);

        // Shu testlardagi BARCHA ballar (rank/total hisoblash uchun).
        var allScores = await db.TestScores.AsNoTracking()
            .Where(s => testIds.Contains(s.TestResultId))
            .ToListAsync();
        var byTest = allScores.GroupBy(s => s.TestResultId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Score).ToList());

        var myByTest = myScores.ToDictionary(s => s.TestResultId, s => s.Score);

        return tests
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t =>
            {
                var ordered = byTest.GetValueOrDefault(t.Id) ?? new List<TestScore>();
                var myScore = myByTest.GetValueOrDefault(t.Id);
                int rank = ordered.FindIndex(x => x.StudentId == studentId) + 1;
                return new StudentGroupTestDto(t.Id, t.GroupId,
                    groupNames.GetValueOrDefault(t.GroupId, ""), t.Name, t.Date,
                    t.MaxScore, myScore, rank, ordered.Count);
            })
            .ToList();
    }

    private static string? Validate(string name, decimal maxScore)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Test nomi kerak";
        if (maxScore <= 0) return "Maksimal ball 0 dan katta bo'lishi kerak";
        return null;
    }
}
