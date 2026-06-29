using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using System.Text.Json;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// AI tekshiruv (Speaking/Writing) — ADMIN boshqaruvi (Ilova → AI check).
/// Kim necha marta foydalanayotgani, kunlik limit/premium/blok, va o'quvchi tarixini ko'rish.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("app")]
[Route("api/admin/ai-check")]
public class AiCheckController(AppDbContext db) : ControllerBase
{
    /// <summary>Foydalanuvchilar bo'yicha umumiy ko'rinish — kim necha marta (speaking/writing) ishlatgan + limit holati.</summary>
    [HttpGet("overview")]
    public async Task<ActionResult<IEnumerable<AiCheckOverviewRowDto>>> Overview()
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var defaultLimit = meta?.AiCheckDailyLimit > 0 ? meta.AiCheckDailyLimit : 3;
        var today = AppClock.Today.ToString("yyyy-MM-dd");

        var checks = await db.AiChecks.ToListAsync();
        var byStudent = checks.GroupBy(c => c.StudentId).ToList();
        var ids = byStudent.Select(g => g.Key).ToList();

        var students = (await db.Students.Where(s => ids.Contains(s.Id)).ToListAsync())
            .ToDictionary(s => s.Id);
        var access = (await db.StudentAiAccesses.Where(a => ids.Contains(a.StudentId)).ToListAsync())
            .ToDictionary(a => a.StudentId);

        var rows = new List<AiCheckOverviewRowDto>();
        foreach (var g in byStudent)
        {
            students.TryGetValue(g.Key, out var st);
            access.TryGetValue(g.Key, out var ac);
            var speaking = g.Count(c => c.Type == "speaking");
            var writing = g.Count(c => c.Type == "writing");
            var todayUsed = g.Count(c => c.Date == today);
            var limit = ac is { DailyLimit: > 0 } ? ac.DailyLimit : defaultLimit;
            rows.Add(new AiCheckOverviewRowDto(
                g.Key, st?.FullName ?? "(noma'lum)", st?.ClassName ?? "",
                speaking, writing, g.Count(), todayUsed, limit,
                ac?.IsPremium ?? false, ac?.IsBlocked ?? false));
        }
        return rows.OrderByDescending(r => r.Total).ToList();
    }

    /// <summary>Global standart kunlik limit.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<AiCheckSettingsDto>> GetSettings()
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        return new AiCheckSettingsDto(meta?.AiCheckDailyLimit > 0 ? meta.AiCheckDailyLimit : 3);
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings(SaveAiCheckSettingsRequest req)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (meta is null) { meta = new CenterMeta(); db.CenterMeta.Add(meta); }
        meta.AiCheckDailyLimit = Math.Clamp(req.DailyLimit, 0, 1000);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>O'quvchiga limit/premium/blok belgilash (upsert).</summary>
    [HttpPut("access/{studentId}")]
    public async Task<IActionResult> SaveAccess(string studentId, SaveAiAccessRequest req)
    {
        if (!await db.Students.AnyAsync(s => s.Id == studentId)) return NotFound();
        var access = await db.StudentAiAccesses.FirstOrDefaultAsync(a => a.StudentId == studentId);
        if (access is null)
        {
            access = new StudentAiAccess { StudentId = studentId };
            db.StudentAiAccesses.Add(access);
        }
        access.DailyLimit = Math.Clamp(req.DailyLimit, 0, 1000);
        access.IsPremium = req.IsPremium;
        access.IsBlocked = req.IsBlocked;
        access.UpdatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>O'quvchining AI tekshiruv tarixi (admin ko'rinishi — o'quvchidagidek).</summary>
    [HttpGet("history/{studentId}")]
    public async Task<ActionResult<IEnumerable<AiCheckListItemDto>>> History(string studentId) =>
        await db.AiChecks.Where(a => a.StudentId == studentId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AiCheckListItemDto(a.Id, a.Type, a.Prompt, a.Score, a.Date, a.CreatedAt, a.AudioUrl != ""))
            .ToListAsync();

    /// <summary>Bitta yozuv (to'liq — matn/ovoz/tahlil).</summary>
    [HttpGet("item/{id}")]
    public async Task<ActionResult<AiCheckDto>> Item(string id)
    {
        var a = await db.AiChecks.FindAsync(id);
        return a is null ? NotFound() : ToDto(a);
    }

    private static AiCheckDto ToDto(AiCheck a)
    {
        var analysis = AiCheckService.ParseStored(a.AnalysisJson);
        AiCheckSpeechDto? speech = null;
        if (a.Type == "speaking" && !string.IsNullOrWhiteSpace(a.AzureJson))
        {
            try
            {
                var r = JsonSerializer.Deserialize<SpeakingResultDto>(a.AzureJson);
                if (r is not null)
                    speech = new AiCheckSpeechDto(r.RecognizedText, r.PronScore, r.Accuracy,
                        r.Fluency, r.Completeness, r.Prosody, r.Words ?? new());
            }
            catch { /* buzuq json — speech null */ }
        }
        return new AiCheckDto(a.Id, a.Type, a.Prompt, a.InputText, a.RecognizedText, a.AudioUrl,
            a.Score, a.Date, a.CreatedAt, analysis, speech);
    }
}
