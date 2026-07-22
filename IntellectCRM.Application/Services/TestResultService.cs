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
    /// Faol (muzlatilmagan) a'zolar soni ham qaytadi. Arxivlanmagan guruhlar, nomi bo'yicha tartiblangan.</summary>
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

        // Chiqarib yuborilganlar (IsActive=false) va muzlatilganlar (Status="frozen") hisobga olinmaydi
        // (GradingService bilan bir xil qoida — baholash/test faqat haqiqiy faol a'zolarga tegishli).
        var memberCounts = await db.StudentGroups.AsNoTracking()
            .Where(sg => sg.IsActive && sg.Status != "frozen")
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
            .CountAsync(sg => sg.GroupId == groupId && sg.IsActive && sg.Status != "frozen");

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
                    t.CreatedAt, t.CreatedBy, studentCount, s.Count, avg,
                    Online(t), s.Count(x => x.Source == "bot"));
            })
            .ToList();
    }

    /// <summary>Yangi test yaratish. Nomi bo'sh yoki maksimal ball ≤ 0 bo'lsa xato (message qaytadi).
    /// <paramref name="online"/> berilib Mode="online" bo'lsa — PDF/savollar soni/javob kaliti/vaqt oynasi
    /// tekshiriladi va MaxScore savollar soniga tenglashtiriladi (har savol 1 ball).</summary>
    public static async Task<(GroupTestDto? Dto, string? Error)> CreateAsync(
        IAppDbContext db, string groupId, string name, string date, decimal maxScore, string createdBy,
        OnlineTestDto? online = null)
    {
        var group = await db.Classes.FindAsync(groupId);
        if (group is null) return (null, "Guruh topilmadi");
        var testDate = string.IsNullOrWhiteSpace(date) ? AppClock.Today.ToString("yyyy-MM-dd") : date.Trim();

        var t = new TestResult
        {
            GroupId = groupId,
            Name = (name ?? "").Trim(),
            Date = testDate,
            MaxScore = maxScore,
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
            CreatedBy = createdBy,
        };
        var applyErr = ApplyOnline(t, online);
        if (applyErr != null) return (null, applyErr);
        var err = Validate(t.Name, t.MaxScore);
        if (err != null) return (null, err);

        db.TestResults.Add(t);
        await db.SaveChangesAsync();

        var studentCount = await db.StudentGroups.AsNoTracking()
            .CountAsync(sg => sg.GroupId == groupId && sg.IsActive);
        return (new GroupTestDto(t.Id, t.GroupId, t.Name, t.Date, t.MaxScore,
            t.CreatedAt, t.CreatedBy, studentCount, 0, null, Online(t), 0), null);
    }

    /// <summary>Test ma'lumotini tahrirlash (nomi/sana/maksimal ball + onlayn sozlamalari).</summary>
    public static async Task<(bool Ok, string? Error)> UpdateAsync(
        IAppDbContext db, string id, string name, string date, decimal maxScore,
        OnlineTestDto? online = null)
    {
        var t = await db.TestResults.FindAsync(id);
        if (t is null) return (false, "Test topilmadi");

        t.Name = (name ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(date)) t.Date = date.Trim();
        t.MaxScore = maxScore;
        var applyErr = ApplyOnline(t, online);
        if (applyErr != null) return (false, applyErr);
        var err = Validate(t.Name, t.MaxScore);
        if (err != null) return (false, err);

        await db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Onlayn sozlamalarni entity'ga yozadi va tekshiradi. null qaytsa — hammasi joyida.
    /// <paramref name="online"/> berilmasa yoki Mode!="online" bo'lsa test OFLAYN (eski xatti-harakat).</summary>
    private static string? ApplyOnline(TestResult t, OnlineTestDto? online)
    {
        // Sozlama UMUMAN berilmagan (masalan o'qituvchi ilovasidagi eski forma) — mavjud rejim SAQLANADI.
        // Aks holda onlayn test tasodifan oflaynga aylanib, PDF/kalit/vaqt yo'qolib ketardi.
        if (online is null)
        {
            if (t.Mode == "online") t.MaxScore = t.QuestionCount;   // ball = savollar soni (o'zgarmasin)
            return null;
        }

        var mode = (online.Mode ?? "").Trim().ToLowerInvariant();
        if (mode != "online")
        {
            t.Mode = "offline";
            return null;
        }

        var options = online.OptionCount is >= 2 and <= 6 ? online.OptionCount : 4;
        var count = online.QuestionCount;
        if (count is < 1 or > 200) return "Savollar soni 1 dan 200 gacha bo'lishi kerak";

        var key = NormalizeKey(online.AnswerKey, options);
        if (key.Length != count)
            return $"Javoblar kaliti {count} ta harfdan iborat bo'lishi kerak (hozir {key.Length} ta to'ldirilgan)";
        if (string.IsNullOrWhiteSpace(online.PdfUrl))
            return "Test savollari (PDF) faylini yuklang";

        var start = (online.StartAt ?? "").Trim();
        var end = (online.EndAt ?? "").Trim();
        if (start.Length == 0) start = t.Date + "T00:00";
        if (end.Length == 0) end = t.Date + "T23:59";
        if (string.CompareOrdinal(end, start) <= 0)
            return "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak";

        // PDF almashtirilsa Telegram file_id keshi bekor qilinadi (eski fayl yuborilib qolmasin).
        if (!string.Equals(t.PdfUrl, online.PdfUrl.Trim(), StringComparison.Ordinal)) t.PdfFileId = "";

        t.Mode = "online";
        t.PdfUrl = online.PdfUrl.Trim();
        t.PdfName = (online.PdfName ?? "").Trim();
        t.QuestionCount = count;
        t.OptionCount = options;
        t.AnswerKey = key;
        t.StartAt = start;
        t.EndAt = end;
        // Onlayn testda har savol — 1 ball (reyting/o'rtacha shu asosda ishlaydi).
        t.MaxScore = count;
        return null;
    }

    /// <summary>Javob kalitini normallashtiradi: katta harf, faqat ruxsat etilgan variantlar (A..),
    /// javobsiz savol '-' bilan belgilanadi (kalitda bo'lmasligi kerak, lekin uzunlik saqlanadi).</summary>
    private static string NormalizeKey(string? key, int options)
    {
        if (string.IsNullOrWhiteSpace(key)) return "";
        var max = (char)('A' + options - 1);
        var sb = new System.Text.StringBuilder();
        foreach (var ch in key.ToUpperInvariant())
        {
            if (ch is >= 'A' && ch <= max) sb.Append(ch);
            else if (ch == '-') sb.Append('-');
        }
        return sb.ToString();
    }

    /// <summary>Entity → onlayn sozlamalar DTO'si (frontend forma va bot uchun bir xil shakl).</summary>
    public static OnlineTestDto Online(TestResult t) => new(
        string.IsNullOrEmpty(t.Mode) ? "offline" : t.Mode,
        t.PdfUrl, t.PdfName, t.QuestionCount, t.OptionCount == 0 ? 4 : t.OptionCount,
        t.AnswerKey, t.StartAt, t.EndAt);

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

    /// <summary>Test tafsiloti — guruhning FAOL (chiqarib yuborilmagan, muzlatilmagan) o'quvchilari
    /// + ballari, ball desc bo'yicha saralangan. Ball kiritilmagan o'quvchilar oxirida (Rank=0).
    /// null = test topilmadi.</summary>
    public static async Task<TestResultDetailDto?> DetailAsync(IAppDbContext db, string id)
    {
        var t = await db.TestResults.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return null;
        var group = await db.Classes.AsNoTracking().FirstOrDefaultAsync(g => g.Id == t.GroupId);

        var members = await (from sg in db.StudentGroups.AsNoTracking()
                             join s in db.Students.AsNoTracking() on sg.StudentId equals s.Id
                             where sg.GroupId == t.GroupId && sg.IsActive && sg.Status != "frozen"
                             select new { s.Id, s.FullName }).ToListAsync();

        var scoreRows = await db.TestScores.AsNoTracking()
            .Where(s => s.TestResultId == id)
            .ToDictionaryAsync(s => s.StudentId, s => s);

        var rows = members
            .Select(m => new
            {
                m.Id, m.FullName,
                Score = scoreRows.TryGetValue(m.Id, out var sc) ? (decimal?)sc.Score : null,
                Answers = scoreRows.TryGetValue(m.Id, out var sa) ? sa.Answers : "",
                SubmittedAt = scoreRows.TryGetValue(m.Id, out var sb) ? sb.SubmittedAt : "",
                Source = scoreRows.TryGetValue(m.Id, out var so) ? so.Source : "",
            })
            // Ball kiritilganlar tepada (ball desc), keyin ism bo'yicha; kiritilmaganlar oxirida.
            .OrderByDescending(x => x.Score.HasValue)
            .ThenByDescending(x => x.Score ?? 0)
            .ThenBy(x => x.FullName)
            .ToList();

        // Standart musobaqa reytingi: ball TENG bo'lsa BIR XIL o'rin beriladi, keyingi (kichikroq)
        // ball esa nechta o'quvchi tepasida bo'lsa shuncha o'rinni "sakrab" o'tadi (masalan 1,1,3,4).
        var result = new List<TestScoreRowDto>();
        decimal? prevScore = null;
        var rank = 0;
        var position = 0;
        foreach (var x in rows)
        {
            if (!x.Score.HasValue)
            {
                result.Add(new TestScoreRowDto(x.Id, x.FullName, x.Score, 0, x.Answers, x.SubmittedAt, x.Source));
                continue;
            }
            position++;
            if (prevScore is null || x.Score.Value != prevScore.Value) rank = position;
            prevScore = x.Score.Value;
            result.Add(new TestScoreRowDto(x.Id, x.FullName, x.Score, rank, x.Answers, x.SubmittedAt, x.Source));
        }

        return new TestResultDetailDto(t.Id, t.GroupId, group?.Name ?? "", t.Name, t.Date,
            t.MaxScore, t.CreatedAt, t.CreatedBy, result, Online(t));
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
                // Standart musobaqa reytingi: mendan KATTA ball olganlar soni + 1 — ball teng bo'lganlar
                // bir xil o'rinda turadi (DetailAsync bilan bir xil mantiq).
                int rank = ordered.Count(x => x.Score > myScore) + 1;
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
