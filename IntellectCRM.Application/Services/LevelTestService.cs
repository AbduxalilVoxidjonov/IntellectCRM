using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Daraja (placement) testi mantig'i: admin testlarini DTO'ga yig'ish, ommaviy ko'rinish,
/// ball/daraja hisoblash va topshiruvdan CRM LID yaratish.
/// </summary>
public static class LevelTestService
{
    /// <summary>Kurs nomini (Subject) id bo'yicha oladi — bo'sh/yo'q bo'lsa "".</summary>
    private static async Task<string> CourseNameAsync(IAppDbContext db, string courseId)
    {
        if (string.IsNullOrEmpty(courseId)) return "";
        return await db.Subjects.Where(s => s.Id == courseId).Select(s => s.Name).FirstOrDefaultAsync() ?? "";
    }

    /// <summary>Admin uchun bitta testning to'liq tafsiloti (savollar + diapazonlar).</summary>
    public static async Task<LevelTestDetailDto> BuildDetailAsync(IAppDbContext db, LevelTest t)
    {
        var questions = await db.LevelTestQuestions.Where(q => q.TestId == t.Id)
            .OrderBy(q => q.Order).ToListAsync();
        var bands = await db.LevelTestBands.Where(x => x.TestId == t.Id)
            .OrderBy(x => x.MinPercent).ToListAsync();
        return new LevelTestDetailDto(
            t.Id, t.Title, t.CourseId, await CourseNameAsync(db, t.CourseId), t.Slug, t.Intro,
            t.IsActive, t.CreatedAt,
            questions.Select(q => new LevelTestQuestionDto(q.Id, q.Text, q.Options, q.CorrectIndex, q.Order, q.Kind, q.Multiple)).ToList(),
            bands.Select(x => new LevelTestBandDto(x.Id, x.Label, x.MinPercent, x.Order)).ToList());
    }

    /// <summary>Test nomidan o'qiladigan, NOYOB slug yasaydi (`ingliz-tili-3f2a`).</summary>
    public static async Task<string> GenerateSlugAsync(IAppDbContext db, string title)
    {
        var baseSlug = Slugify(title);
        if (baseSlug.Length == 0) baseSlug = "test";
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var suffix = Guid.NewGuid().ToString("N")[..4];
            var slug = $"{baseSlug}-{suffix}";
            if (!await db.LevelTests.AnyAsync(t => t.Slug == slug)) return slug;
        }
        return Guid.NewGuid().ToString("N")[..10];
    }

    /// <summary>Lotin harf/raqamlarni saqlab, qolganini "-"ga aylantiradi (sodda slugify).</summary>
    private static string Slugify(string s)
    {
        var chars = s.Trim().ToLowerInvariant()
            .Select(c => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '-')
            .ToArray();
        var slug = new string(chars);
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        slug = slug.Trim('-');
        return slug.Length > 40 ? slug[..40].Trim('-') : slug;
    }

    /// <summary>Ommaviy ko'rinish (to'g'ri javobSIZ). Test yo'q yoki faol emas — null.</summary>
    public static async Task<PublicTestDto?> GetPublicAsync(IAppDbContext db, string slug)
    {
        var test = await db.LevelTests.FirstOrDefaultAsync(t => t.Slug == slug && t.IsActive);
        if (test is null) return null;
        var questions = await db.LevelTestQuestions.Where(q => q.TestId == test.Id)
            .OrderBy(q => q.Order).ToListAsync();
        return new PublicTestDto(
            test.Title, test.Intro, await CourseNameAsync(db, test.CourseId),
            questions.Select(q => new PublicTestQuestionDto(q.Id, q.Text, q.Options, q.Kind, q.Multiple)).ToList());
    }

    /// <summary>Ball foiziga mos daraja yorlig'i — foiz ≥ MinPercent bo'lgan ENG YUQORI diapazon.</summary>
    private static string ResolveLevel(IReadOnlyList<LevelTestBand> bands, int percent)
    {
        var match = bands.Where(b => percent >= b.MinPercent)
            .OrderByDescending(b => b.MinPercent).FirstOrDefault();
        return match?.Label ?? "";
    }

    /// <summary>
    /// Testni topshiradi: ball/daraja hisoblaydi, topshiruvni saqlaydi va CRM'da yangi LID yaratadi
    /// (Source="Daraja testi", InterestSubject=kurs). Test yo'q/faol emas bo'lsa null qaytaradi.
    /// SaveChanges shu yerda bajariladi.
    /// </summary>
    public static async Task<TestResultDto?> SubmitAsync(
        IAppDbContext db, string slug, TestSubmitRequest req, TelegramService? telegram = null)
    {
        var test = await db.LevelTests.FirstOrDefaultAsync(t => t.Slug == slug && t.IsActive);
        if (test is null) return null;

        var items = await db.LevelTestQuestions.Where(q => q.TestId == test.Id).ToListAsync();
        var bands = await db.LevelTestBands.Where(x => x.TestId == test.Id).ToListAsync();

        // Baholash FAQAT savollar ("question") bo'yicha; so'rovnoma ("survey") chiqarib tashlanadi.
        var graded = items.Where(q => q.Kind != "survey").ToList();
        var total = graded.Count;
        var score = 0;
        foreach (var q in graded)
            if (req.Answers != null && req.Answers.TryGetValue(q.Id, out var picked) && picked == q.CorrectIndex)
                score++;

        // So'rovnoma javoblari (baholanmaydi) — tanlangan variant matnlarini yig'amiz.
        var surveyAnswers = new List<SurveyAnswerDto>();
        foreach (var s in items.Where(q => q.Kind == "survey").OrderBy(x => x.Order))
        {
            var picks = new List<string>();
            if (req.SurveyAnswers != null && req.SurveyAnswers.TryGetValue(s.Id, out var idxs) && idxs != null)
                foreach (var i in idxs.Distinct())
                    if (i >= 0 && i < s.Options.Count) picks.Add(s.Options[i]);
            surveyAnswers.Add(new SurveyAnswerDto(s.Text, picks));
        }
        var surveyJson = surveyAnswers.Count > 0
            ? System.Text.Json.JsonSerializer.Serialize(surveyAnswers)
            : "";
        var surveyText = surveyAnswers.Count > 0
            ? "\nSo'rovnoma:\n" + string.Join("\n", surveyAnswers.Select(
                a => $"• {a.Question}: {(a.Answers.Count > 0 ? string.Join(", ", a.Answers) : "—")}"))
            : "";

        var percent = total > 0 ? (int)Math.Round(score * 100.0 / total) : 0;
        var level = ResolveLevel(bands, percent);
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        var courseName = await CourseNameAsync(db, test.CourseId);

        // CRM LID — birinchi (Order) bosqichga tushadi.
        var firstStage = await db.LeadStages.OrderBy(s => s.Order).Select(s => s.Id).FirstOrDefaultAsync() ?? "";
        var levelText = string.IsNullOrEmpty(level) ? "" : $" — {level}";
        var lead = new Lead
        {
            FullName = string.IsNullOrWhiteSpace(req.FullName) ? "Noma'lum (daraja testi)" : req.FullName.Trim(),
            Phone = (req.Phone ?? "").Trim(),
            Source = "Daraja testi",
            InterestSubject = string.IsNullOrEmpty(courseName) ? test.Title : courseName,
            Note = $"Daraja testi: {score}/{total} ({percent}%){levelText}"
                   + (req.Age > 0 ? $". Yoshi: {req.Age}" : "") + surveyText,
            Stage = firstStage,
            CreatedAt = now,
        };
        db.Leads.Add(lead);
        db.LeadEvents.Add(new LeadEvent
        {
            LeadId = lead.Id, Type = "created", ActorName = "Daraja testi", CreatedAt = now,
            Text = $"Daraja testi orqali keldi: {score}/{total} ({percent}%){levelText}",
        });
        db.LevelTestSubmissions.Add(new LevelTestSubmission
        {
            TestId = test.Id, FullName = lead.FullName, Phone = lead.Phone, Age = req.Age,
            Score = score, Total = total, Percent = percent, Level = level, CreatedAt = now, LeadId = lead.Id,
            SurveyJson = surveyJson,
        });
        await db.SaveChangesAsync();

        // Botda ro'yxatdan o'tgan admin/xodimlarga yangi lid xabarnomasi.
        if (telegram is not null)
            await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead);

        var msg = total == 0
            ? "Rahmat! Ma'lumotlaringiz qabul qilindi — tez orada bog'lanamiz."
            : $"Rahmat! Siz {total} ta savoldan {score} tasiga to'g'ri javob berdingiz"
              + (string.IsNullOrEmpty(level) ? "." : $". Sizning darajangiz: {level}.")
              + " Tez orada siz bilan bog'lanamiz.";
        return new TestResultDto(score, total, percent, level, msg);
    }
}
