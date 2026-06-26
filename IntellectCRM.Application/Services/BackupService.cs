using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Backup — markazning BARCHA ma'lumotlarini JSON ko'rinishida yig'ib, Telegram orqali adminga
/// yuboradi. Ilova ichida ishlaydi (alohida docker konteyner/pg_dump/curl KERAK EMAS) — bot tokeni
/// va admin chat ID DB'da (CenterMeta), yuborish ilovaning ishlaydigan <see cref="TelegramService"/>i
/// orqali. Avtomatik (kunlik, jadval bo'yicha) <see cref="BackupSchedulerService"/> chaqiradi yoki
/// admin "Hozir yuborish" tugmasi.
/// </summary>
public static class BackupService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    /// <summary>Barcha jadvallarni JSON (UTF-8 baytlar) ko'rinishida yig'adi.</summary>
    public static async Task<(byte[] Json, int TableCount, long Rows)> BuildJsonAsync(
        IAppDbContext db, CancellationToken ct = default)
    {
        var data = new Dictionary<string, object>();
        long rows = 0;
        async Task Add<T>(string name, IQueryable<T> q) where T : class
        {
            var list = await q.AsNoTracking().ToListAsync(ct);
            data[name] = list;
            rows += list.Count;
        }

        data["generatedAt"] = AppClock.Iso();
        // ---- Asosiy biznes ma'lumotlari ----
        await Add("users", db.Users);
        await Add("students", db.Students);
        await Add("teachers", db.Teachers);
        await Add("teacherAttendances", db.TeacherAttendances);
        await Add("subjects", db.Subjects);
        await Add("classes", db.Classes);
        await Add("studentGroups", db.StudentGroups);
        await Add("leads", db.Leads);
        await Add("leadStages", db.LeadStages);
        await Add("leadEvents", db.LeadEvents);
        await Add("trialLessons", db.TrialLessons);
        // ---- Jurnal / baholash / intizom ----
        await Add("journalEntries", db.JournalEntries);
        await Add("lessonNotes", db.LessonNotes);
        await Add("absenceReasons", db.AbsenceReasons);
        await Add("disciplineReasons", db.DisciplineReasons);
        await Add("disciplinePoints", db.DisciplinePoints);
        await Add("evaluationTypes", db.EvaluationTypes);
        await Add("evaluationGrades", db.EvaluationGrades);
        await Add("gradingCriteria", db.GradingCriteria);
        await Add("groupGradingCriteria", db.GroupGradingCriteria);
        await Add("criterionGrades", db.CriterionGrades);
        // ---- Moliya ----
        await Add("financeTransactions", db.FinanceTransactions);
        await Add("monthlyCharges", db.MonthlyCharges);
        // ---- Aloqa / bildirishnoma ----
        await Add("chatMessages", db.ChatMessages);
        await Add("broadcasts", db.Broadcasts);
        await Add("pushMessages", db.PushMessages);
        await Add("telegramRegistrations", db.TelegramRegistrations);
        await Add("userNotifications", db.UserNotifications);
        await Add("deviceTokens", db.DeviceTokens);
        await Add("feedbacks", db.Feedbacks);
        // ---- Topshiriqlar / LMS ----
        await Add("assignments", db.Assignments);
        await Add("assignmentTypes", db.AssignmentTypes);
        await Add("assignmentMaterials", db.AssignmentMaterials);
        await Add("testQuestions", db.TestQuestions);
        await Add("assignmentSubmissions", db.AssignmentSubmissions);
        await Add("lmsSubjects", db.LmsSubjects);
        await Add("lmsModules", db.LmsModules);
        await Add("lmsTopics", db.LmsTopics);
        await Add("lmsMaterials", db.LmsMaterials);
        await Add("lmsProgresses", db.LmsProgresses);
        // ---- Kurs dasturi (curriculum) ----
        await Add("courseLevels", db.CourseLevels);
        await Add("courseTopics", db.CourseTopics);
        await Add("courseItems", db.CourseItems);
        await Add("courseQuestions", db.CourseQuestions);
        await Add("courseProgresses", db.CourseProgresses);
        await Add("groupCurriculumLogs", db.GroupCurriculumLogs);
        // ---- Boshqa ----
        await Add("actionReasons", db.ActionReasons);
        await Add("archivedRecords", db.ArchivedRecords);
        await Add("levelTests", db.LevelTests);
        await Add("levelTestQuestions", db.LevelTestQuestions);
        await Add("levelTestBands", db.LevelTestBands);
        await Add("levelTestSubmissions", db.LevelTestSubmissions);
        await Add("supportSlots", db.SupportSlots);
        await Add("certificateTemplates", db.CertificateTemplates);
        await Add("studentCertificates", db.StudentCertificates);
        await Add("studentAiAnalyses", db.StudentAiAnalyses);
        await Add("rooms", db.Rooms);
        await Add("landingContents", db.LandingContents);
        await Add("userSettings", db.UserSettings);
        await Add("centerMeta", db.CenterMeta);

        var bytes = JsonSerializer.SerializeToUtf8Bytes(data, JsonOpts);
        return (bytes, data.Count - 1, rows); // -1: generatedAt jadval emas
    }

    /// <summary>
    /// Backupni yig'ib Telegram orqali adminga yuboradi. Muvaffaqiyat — (true, xabar).
    /// Bot/chat sozlanmagan bo'lsa (false, sabab).
    /// </summary>
    public static async Task<(bool Ok, string Message)> SendAsync(
        IAppDbContext db, TelegramService telegram, ILogger? logger = null, CancellationToken ct = default)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (meta is null || !meta.TelegramBackupEnabled)
            return (false, "Telegram backup o'chirilgan (Sozlamalar → Telegram bot → Backup).");
        if (!telegram.IsConfigured)
            return (false, "Telegram bot sozlanmagan (token yo'q).");
        var chatStr = (meta.TelegramAdminChatId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(chatStr) || !long.TryParse(chatStr, out var chatId) || chatId == 0)
            return (false, "Admin chat ID kiritilmagan yoki noto'g'ri.");

        try
        {
            var (json, tables, rows) = await BuildJsonAsync(db, ct);
            var ts = AppClock.Now.ToString("yyyyMMdd_HHmm");
            var fileName = $"intellectcrm_backup_{ts}.json";
            var sizeKb = Math.Round(json.Length / 1024.0, 1);
            var caption = $"✅ IntellectCRM backup (JSON)\n📅 {AppClock.Now:yyyy-MM-dd HH:mm}\n" +
                          $"🗂 {tables} jadval · {rows} yozuv · {sizeKb} KB";

            // Telegram hujjat chegarasi ~50MB.
            if (json.Length > 49_000_000)
                return (false, $"Backup juda katta ({Math.Round(json.Length / 1_048_576.0, 1)} MB > 50MB) — yuborilmadi.");

            var ok = await telegram.SendDocumentAsync(chatId, json, fileName, caption, ct);
            if (!ok)
                return (false, "Telegram'ga yuborib bo'lmadi (chat ID yoki bot huquqini tekshiring).");

            meta.TelegramBackupLastSentAt = AppClock.Now;
            await db.SaveChangesAsync(ct);
            return (true, $"Backup yuborildi: {tables} jadval, {rows} yozuv, {sizeKb} KB.");
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "Backup yuborishda xatolik");
            return (false, $"Xatolik: {ex.Message}");
        }
    }
}
