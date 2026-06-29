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

    /// <summary>
    /// Topshiruvlar ro'yxatini boyitilgan statistika qatorlariga aylantiradi: har bir topshiruvchi
    /// AKTIV o'quvchiga aylandimi (Status=="active" guruh a'zoligi), qaysi guruh(lar) + o'qituvchi (FISH),
    /// va lid o'chirilganmi. Natija KIRISH tartibida qaytadi. Bitta test (`/stats`) va UMUMIY statistika
    /// uchun bitta umumiy mantiq (takrorlanmasligi uchun).
    /// </summary>
    public static async Task<List<LevelTestStatRowDto>> BuildStatRowsAsync(
        IAppDbContext db, List<LevelTestSubmission> subs)
    {
        var leadIds = subs.Select(s => s.LeadId).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
        // Lid → o'quvchi (ConvertedStudentId)
        var leadToStudent = (await db.Leads.Where(l => leadIds.Contains(l.Id) && l.ConvertedStudentId != null)
                .Select(l => new { l.Id, l.ConvertedStudentId })
                .ToListAsync())
            .ToDictionary(l => l.Id, l => l.ConvertedStudentId!);
        var studentIds = leadToStudent.Values.Distinct().ToList();

        // Hali MAVJUD lidlar (CRM'dan o'chirilmagan) — "o'chirilgan" bayrog'i UCHUN.
        var existingLeadIds = (await db.Leads.Where(l => leadIds.Contains(l.Id))
            .Select(l => l.Id).ToListAsync()).ToHashSet();
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

        return subs.Select(s =>
        {
            string? sid = leadToStudent.TryGetValue(s.LeadId, out var v) ? v : null;
            // IsDeleted: lid yaratilgan edi-yu, hozir CRM'da YO'Q (o'chirilgan). Konvertatsiya holati
            // ta'sir qilmaydi — birinchi bosqichdagi (hali o'quvchiga aylanmagan) lid "o'chirilgan" emas.
            bool isDeleted = !string.IsNullOrEmpty(s.LeadId) && !existingLeadIds.Contains(s.LeadId);
            var isActive = sid != null && active.Contains(sid);
            var info = sid != null && byStudent.TryGetValue(sid, out var gi) ? gi : ("", "");
            return new LevelTestStatRowDto(
                s.Id, s.FullName, s.Phone, s.Level, s.Percent, s.CreatedAt, s.LeadId,
                sid, isActive, info.Item1, info.Item2, isDeleted);
        }).ToList();
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
        IAppDbContext db, string slug, TestSubmitRequest req, TelegramService? telegram = null, EskizService? eskiz = null)
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
        var submission = new LevelTestSubmission
        {
            TestId = test.Id, FullName = lead.FullName, Phone = lead.Phone, Age = req.Age,
            Score = score, Total = total, Percent = percent, Level = level, CreatedAt = now, LeadId = lead.Id,
            SurveyJson = surveyJson,
        };
        db.LevelTestSubmissions.Add(submission);
        await db.SaveChangesAsync();

        // Botda ro'yxatdan o'tgan admin/xodimlarga yangi lid xabarnomasi — test natijasi bilan (batafsil).
        if (telegram is not null)
            await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead, submission, test.Title);
        // Avto SMS — "Test natijasi" hodisasiga belgilangan andoza bo'lsa, abituriyentga yuboriladi.
        // {natija}/{daraja}/{ball} tokenlari test natijasi bilan to'ldiriladi.
        if (eskiz is not null)
        {
            var natija = total > 0
                ? $"{score}/{total} ({percent}%)" + (string.IsNullOrEmpty(level) ? "" : $" — {level}")
                : "";
            await AutoSmsService.SendForLeadAsync(db, eskiz, AutoSmsService.TriggerTestResult, lead, extra:
                new Dictionary<string, string>
                {
                    ["{natija}"] = natija,
                    ["{daraja}"] = level ?? "",
                    ["{ball}"] = total > 0 ? $"{score}/{total}" : "",
                    ["{foiz}"] = total > 0 ? $"{percent}%" : "",
                });
        }

        var msg = total == 0
            ? "Rahmat! Ma'lumotlaringiz qabul qilindi — tez orada bog'lanamiz."
            : $"Rahmat! Siz {total} ta savoldan {score} tasiga to'g'ri javob berdingiz"
              + (string.IsNullOrEmpty(level) ? "." : $". Sizning darajangiz: {level}.")
              + " Tez orada siz bilan bog'lanamiz.";
        return new TestResultDto(score, total, percent, level, msg);
    }

    // ==================== Bir martalik havola (invite) ====================

    /// <summary>Token bo'yicha testni oladi (lid nomi/telefoni oldindan to'ldirilgan). Token yo'q/test
    /// faol emas — null. Allaqachon ishlatilgan bo'lsa Used=true (test ko'rsatilmaydi).</summary>
    public static async Task<PublicInviteDto?> GetByInviteAsync(IAppDbContext db, string token)
    {
        var inv = await db.LevelTestInvites.FirstOrDefaultAsync(i => i.Token == token);
        if (inv is null) return null;
        if (!string.IsNullOrEmpty(inv.UsedAt)) return new PublicInviteDto(null, "", "", true);
        var test = await db.LevelTests.FirstOrDefaultAsync(t => t.Id == inv.TestId && t.IsActive);
        if (test is null) return null;
        var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == inv.LeadId);
        var questions = await db.LevelTestQuestions.Where(q => q.TestId == test.Id).OrderBy(q => q.Order).ToListAsync();
        var pub = new PublicTestDto(test.Title, test.Intro, await CourseNameAsync(db, test.CourseId),
            questions.Select(q => new PublicTestQuestionDto(q.Id, q.Text, q.Options, q.Kind, q.Multiple)).ToList());
        return new PublicInviteDto(pub, lead?.FullName ?? "", lead?.Phone ?? "", false);
    }

    /// <summary>Bir martalik havola orqali topshirish: baholaydi, natijani MAVJUD lidga bog'laydi,
    /// havolani yopadi (UsedAt). Token yo'q/test yo'q/allaqachon ishlatilgan — null.</summary>
    public static async Task<TestResultDto?> SubmitInviteAsync(
        IAppDbContext db, string token, TestSubmitRequest req, TelegramService? telegram = null, EskizService? eskiz = null)
    {
        var inv = await db.LevelTestInvites.FirstOrDefaultAsync(i => i.Token == token);
        if (inv is null || !string.IsNullOrEmpty(inv.UsedAt)) return null; // yo'q yoki allaqachon ishlatilgan
        var test = await db.LevelTests.FirstOrDefaultAsync(t => t.Id == inv.TestId);
        if (test is null) return null;
        var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == inv.LeadId);

        var items = await db.LevelTestQuestions.Where(q => q.TestId == test.Id).ToListAsync();
        var bands = await db.LevelTestBands.Where(x => x.TestId == test.Id).ToListAsync();

        var graded = items.Where(q => q.Kind != "survey").ToList();
        var total = graded.Count;
        var score = 0;
        foreach (var q in graded)
            if (req.Answers != null && req.Answers.TryGetValue(q.Id, out var picked) && picked == q.CorrectIndex)
                score++;

        var surveyAnswers = new List<SurveyAnswerDto>();
        foreach (var s in items.Where(q => q.Kind == "survey").OrderBy(x => x.Order))
        {
            var picks = new List<string>();
            if (req.SurveyAnswers != null && req.SurveyAnswers.TryGetValue(s.Id, out var idxs) && idxs != null)
                foreach (var i in idxs.Distinct())
                    if (i >= 0 && i < s.Options.Count) picks.Add(s.Options[i]);
            surveyAnswers.Add(new SurveyAnswerDto(s.Text, picks));
        }
        var surveyJson = surveyAnswers.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(surveyAnswers) : "";
        var surveyText = surveyAnswers.Count > 0
            ? "\nSo'rovnoma:\n" + string.Join("\n", surveyAnswers.Select(
                a => $"• {a.Question}: {(a.Answers.Count > 0 ? string.Join(", ", a.Answers) : "—")}"))
            : "";

        var percent = total > 0 ? (int)Math.Round(score * 100.0 / total) : 0;
        var level = ResolveLevel(bands, percent);
        var levelText = string.IsNullOrEmpty(level) ? "" : $" — {level}";
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        var courseName = await CourseNameAsync(db, test.CourseId);

        // Natijani MAVJUD lidga bog'laymiz (yangi lid yaratilmaydi).
        if (lead is not null)
        {
            lead.Note = ((lead.Note ?? "").TrimEnd() + $"\nDaraja testi: {score}/{total} ({percent}%){levelText}" + surveyText).Trim();
            if (string.IsNullOrWhiteSpace(lead.InterestSubject))
                lead.InterestSubject = string.IsNullOrEmpty(courseName) ? test.Title : courseName;
            db.LeadEvents.Add(new LeadEvent
            {
                LeadId = lead.Id, Type = "note", ActorName = "Daraja testi", CreatedAt = now,
                Text = $"Daraja testini ishladi: {score}/{total} ({percent}%){levelText}",
            });
        }

        var submission = new LevelTestSubmission
        {
            TestId = test.Id, FullName = lead?.FullName ?? "", Phone = lead?.Phone ?? "", Age = req.Age,
            Score = score, Total = total, Percent = percent, Level = level, CreatedAt = now,
            LeadId = inv.LeadId, SurveyJson = surveyJson,
        };
        db.LevelTestSubmissions.Add(submission);

        inv.UsedAt = now;
        inv.SubmissionId = submission.Id;
        inv.Percent = percent;
        inv.Level = level ?? "";
        await db.SaveChangesAsync();

        if (telegram is not null && lead is not null)
            await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead, submission, test.Title);

        var msg = total == 0
            ? "Rahmat! Javoblaringiz qabul qilindi."
            : $"Rahmat! Siz {total} ta savoldan {score} tasiga to'g'ri javob berdingiz"
              + (string.IsNullOrEmpty(level) ? "." : $". Sizning darajangiz: {level}.");
        return new TestResultDto(score, total, percent, level, msg);
    }
}
