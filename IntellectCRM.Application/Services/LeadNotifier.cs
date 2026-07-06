using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Yangi lid tushganda Telegram botda ro'yxatdan o'tgan ADMIN/xodimlarga xabarnoma yuboradi.
/// Oluvchilar: TelegramRegistration.UserId bog'langan, roli admin/superadmin (har doim) yoki
/// staff bo'lib "leads" ruxsatiga ega bo'lganlar. Bot sozlanmagan / oluvchi yo'q bo'lsa — jim o'tadi.
/// Daraja testi orqali kelgan lid uchun test natijasi (ball, foiz, daraja, baho, so'rovnoma) ham yuboriladi.
/// </summary>
public static class LeadNotifier
{
    public static async Task NotifyNewLeadAsync(
        IAppDbContext db, TelegramService telegram, Lead lead,
        LevelTestSubmission? submission = null, string? testTitle = null,
        bool isNewLead = true, CancellationToken ct = default)
    {
        try
        {
            if (!telegram.IsConfigured) return;

            var regs = await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "").ToListAsync(ct);
            // Bot qo'shilgan (faol) guruhlar — yangi lid avtomatik shu yerga ham yuboriladi.
            var groupChatIds = await db.TelegramGroups
                .Where(g => g.IsActive).Select(g => g.ChatId).ToListAsync(ct);
            if (regs.Count == 0 && groupChatIds.Count == 0) return;

            var userIds = regs.Select(r => r.UserId!).Distinct().ToList();
            var users = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync(ct))
                .ToDictionary(u => u.Id);

            var text = BuildText(lead, submission, testTitle, isNewLead);
            var sentChats = new HashSet<long>();
            foreach (var r in regs)
            {
                if (!users.TryGetValue(r.UserId!, out var u) || !ShouldNotify(u)) continue;
                if (!sentChats.Add(r.ChatId)) continue; // bir chatga bir marta
                await telegram.SendMessageAsync(r.ChatId, text, ct: ct);
            }
            // Guruhlarga yuborish.
            foreach (var gid in groupChatIds)
            {
                if (!sentChats.Add(gid)) continue; // bir chatga bir marta
                await telegram.SendMessageAsync(gid, text, ct: ct);
            }
        }
        catch
        {
            // Xabarnoma lid yaratishni hech qachon buzmasligi kerak — jim yutamiz.
        }
    }

    private static bool ShouldNotify(AppUser u) =>
        u.Role is Roles.Admin or Roles.SuperAdmin
        || (u.Role == Roles.Staff && u.Permissions.Contains("leads"));

    private static string BuildText(Lead l, LevelTestSubmission? sub, string? testTitle, bool isNewLead = true)
    {
        var header = isNewLead ? "🆕 Yangi lid!"
            : sub is not null ? "🔁 Mavjud lid — yangi test natijasi"
            : "🔁 Mavjud lid yangilandi";
        var lines = new List<string> { header };
        if (!string.IsNullOrWhiteSpace(l.FullName)) lines.Add($"👤 {l.FullName}");
        if (!string.IsNullOrWhiteSpace(l.Phone)) lines.Add($"📞 {l.Phone}");
        if (!string.IsNullOrWhiteSpace(l.Source)) lines.Add($"🔖 Manba: {l.Source}");
        if (!string.IsNullOrWhiteSpace(l.InterestSubject)) lines.Add($"📚 Qiziqish: {l.InterestSubject}");

        if (sub is not null)
        {
            // Daraja testi natijasi — batafsil.
            lines.Add("");
            lines.Add("📊 Daraja testi natijasi");
            if (!string.IsNullOrWhiteSpace(testTitle)) lines.Add($"📝 Test: {testTitle}");
            if (sub.Total > 0)
            {
                lines.Add($"✅ Ball: {sub.Score}/{sub.Total} ({sub.Percent}%)");
                lines.Add($"{PerfIcon(sub.Percent)} Baho: {PerfLabel(sub.Percent)}");
            }
            else
            {
                lines.Add("ℹ️ Test savolsiz (faqat so'rovnoma).");
            }
            if (!string.IsNullOrWhiteSpace(sub.Level)) lines.Add($"🎯 Daraja: {sub.Level}");
            if (sub.Age > 0) lines.Add($"🎂 Yoshi: {sub.Age}");

            var survey = ParseSurvey(sub.SurveyJson);
            if (survey.Count > 0)
            {
                lines.Add("");
                lines.Add("🗒 So'rovnoma:");
                foreach (var a in survey)
                    lines.Add($"• {a.Question}: {(a.Answers.Count > 0 ? string.Join(", ", a.Answers) : "—")}");
            }
        }
        else if (!string.IsNullOrWhiteSpace(l.Note))
        {
            lines.Add("");
            lines.Add($"📝 {l.Note}");
        }

        return string.Join("\n", lines);
    }

    /// <summary>Foizga qarab sifat bahosi (qanday ishladi).</summary>
    private static string PerfLabel(int p) => p >= 80 ? "A'lo" : p >= 60 ? "Yaxshi" : p >= 40 ? "O'rta" : "Past";
    private static string PerfIcon(int p) => p >= 60 ? "🟢" : p >= 40 ? "🟡" : "🔴";

    private static readonly System.Text.Json.JsonSerializerOptions SurveyOpts = new() { PropertyNameCaseInsensitive = true };

    private static List<SurveyAnswerDto> ParseSurvey(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<SurveyAnswerDto>>(json, SurveyOpts) ?? new();
        }
        catch { return new(); }
    }
}
