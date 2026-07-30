using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using IntellectCRM.Infrastructure.Data;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'QUVCHINI USHLAB TURISH BONUSI — "O'quvchilar → Bonus hisoboti" bo'limining API'si.
///
/// <para>Butun mantiq <see cref="RetentionBonusService"/> da; bu controller faqat HTTP qobig'i
/// (yuklash, tekshirish natijasini tarjima qilish, audit).</para>
///
/// <para>Ruxsat kaliti <c>finance</c>: jadvalni KO'RISH staff uchun ochiq (<c>AdminPerm</c>
/// qoidasi — GET har doim ochiq), bonus BERISH/bekor qilish uchun esa moliya ruxsati kerak.
/// Frontend'da sahifa <c>students</c> menyusida turadi, «Bonus berish» tugmasi
/// <c>can('finance','edit')</c> bilan ko'rinadi.</para>
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("finance")]
[Route("api/admin/retention-bonus")]
public class RetentionBonusController(AppDbContext db, AuditService audit) : ControllerBase
{
    private const string XlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private string Actor => User.FindFirst(ClaimTypes.Name)?.Value ?? "Admin";

    /// <summary>Bonus hisoboti jadvali: ptichkali o'quvchilar, oylik holatlar, progress va tarix.</summary>
    [HttpGet]
    public async Task<ActionResult<RetentionReportDto>> Get(CancellationToken ct) =>
        await RetentionBonusService.BuildReportAsync(db, null, ct);

    /// <summary>Tayyor (sanoq to'lgan) bonuslar soni — menyudagi belgi uchun (yengil so'rov).</summary>
    [HttpGet("ready-count")]
    public async Task<ActionResult<int>> ReadyCount(CancellationToken ct) =>
        (await RetentionBonusService.BuildReportAsync(db, null, ct)).ReadyCount;

    /// <summary>
    /// Bonus berish. Holat serverda QAYTA tekshiriladi (jadval eskirgan yoki ikki admin bir vaqtda
    /// bosgan bo'lishi mumkin) va taqsimot yig'indisi jami summaga teng bo'lishi shart.
    /// </summary>
    [HttpPost("awards")]
    public async Task<IActionResult> Give(GiveRetentionBonusRequest req, CancellationToken ct)
    {
        var (award, error) = await RetentionBonusService.GiveAsync(db, req, Actor, ct);
        if (error is not null || award is null) return BadRequest(new { message = error });

        audit.Record(AuditService.EntityStudent, award.StudentId, "create",
            $"Ushlab turish bonusi berildi: {AuditService.Money(award.TotalAmount)} so'm " +
            $"({award.StudentName}, {award.PeriodFrom}…{award.PeriodTo}, {award.CycleNo}-sikl)",
            after: new { award.TotalAmount, award.PeriodFrom, award.PeriodTo, award.CycleNo, req.Shares },
            studentId: award.StudentId);

        await db.SaveChangesAsync(ct);
        return Ok(new { id = award.Id });
    }

    /// <summary>
    /// Bonusni bekor qilish (xato kiritilgan bo'lsa). Yozuv o'chirilmaydi — tarixda "cancelled"
    /// bo'lib qoladi; o'quvchining sanog'i davr boshiga qaytariladi va sikl yana "tayyor" bo'ladi.
    /// </summary>
    [HttpPost("awards/{id}/cancel")]
    public async Task<IActionResult> Cancel(string id, CancelRetentionBonusRequest? req, CancellationToken ct)
    {
        var award = await db.RetentionBonusAwards.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);
        var error = await RetentionBonusService.CancelAsync(db, id, req?.Reason, ct);
        if (error is not null) return BadRequest(new { message = error });

        if (award is not null)
            audit.Record(AuditService.EntityStudent, award.StudentId, "update",
                $"Ushlab turish bonusi BEKOR qilindi: {AuditService.Money(award.TotalAmount)} so'm " +
                $"({award.StudentName}){(string.IsNullOrWhiteSpace(req?.Reason) ? "" : $" — {req!.Reason}")}",
                before: new { award.Status, award.TotalAmount },
                studentId: award.StudentId);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Uzilgan siklni yangi oydan qayta boshlash (avvalgi sikl tarixda qoladi).</summary>
    [HttpPost("students/{id}/restart")]
    public async Task<IActionResult> Restart(string id, RestartRetentionRequest req, CancellationToken ct)
    {
        var error = await RetentionBonusService.RestartAsync(db, id, req.StartMonth, ct);
        if (error is not null) return BadRequest(new { message = error });

        audit.Record(AuditService.EntityStudent, id, "update",
            $"Ushlab turish bonusi sanog'i qayta boshlandi ({req.StartMonth})",
            after: new { req.StartMonth }, studentId: id);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Bitta o'qituvchining bonuslari — profil "Bonus" tabi va o'qituvchi ilovasi uchun.</summary>
    [HttpGet("teacher/{id}")]
    public async Task<ActionResult<TeacherRetentionSummaryDto>> ForTeacher(string id, CancellationToken ct) =>
        await RetentionBonusService.ForTeacherAsync(db, id, ct);

    /// <summary>Sozlamalar (<c>CenterMeta</c>): necha oy talab qilinadi, ruxsat etilgan tanaffus, standart summa.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<RetentionSettingsDto>> GetSettings(CancellationToken ct) =>
        RetentionBonusService.Settings(await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync(ct));

    [HttpPut("settings")]
    public async Task<ActionResult<RetentionSettingsDto>> SaveSettings(RetentionSettingsDto req, CancellationToken ct)
    {
        if (req.MonthsRequired is < 1 or > 36)
            return BadRequest(new { message = "Talab qilinadigan oylar soni 1-36 oralig'ida bo'lishi kerak" });
        if (req.MaxGapMonths is < 0 or > 12)
            return BadRequest(new { message = "Ruxsat etilgan tanaffus 0-12 oy oralig'ida bo'lishi kerak" });
        if (req.DefaultAmount < 0m)
            return BadRequest(new { message = "Standart summa manfiy bo'lishi mumkin emas" });

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (meta is null) { meta = new CenterMeta(); db.CenterMeta.Add(meta); }

        meta.RetentionMonthsRequired = req.MonthsRequired;
        meta.RetentionMaxGapMonths = req.MaxGapMonths;
        meta.RetentionDefaultAmount = req.DefaultAmount;
        await db.SaveChangesAsync(ct);

        return RetentionBonusService.Settings(meta);
    }

    /// <summary>Hisobotni Excel'ga yuklash (oylik kataklar matn belgisi bilan).</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        var report = await RetentionBonusService.BuildReportAsync(db, null, ct);

        var headers = new List<string>
        {
            "F.I.Sh", "Guruh", "Dars kunlari", "Boshlanish oyi", "Sikl",
            "Sanoq", "Holat", "Izoh", "Oylar",
        };
        var rows = report.Rows.Select(r => (IReadOnlyList<string>)new List<string>
        {
            r.FullName,
            r.GroupNames,
            r.Days,
            r.StartMonth,
            r.CycleNo.ToString(),
            $"{r.Counted}/{r.Required}",
            StatusLabel(r.Status),
            r.StatusNote,
            string.Join(" ", r.Months.Select(m => $"{m.Month}:{StateLabel(m.State)}")),
        }).ToList();

        return File(ExcelExport.Build("Bonus hisoboti", headers, rows), XlsxMime,
            $"bonus_hisobot_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    private static string StatusLabel(string status) => status switch
    {
        RetentionBonusService.RowReady => "Tayyor",
        RetentionBonusService.RowBroken => "Uzildi",
        RetentionBonusService.RowNotStarted => "Boshlanmagan",
        _ => "Yo'lda",
    };

    private static string StateLabel(string state) => state switch
    {
        RetentionBonusService.StatePaid => "to'liq",
        RetentionBonusService.StateDebt => "qarz",
        RetentionBonusService.StateFrozen => "muzlatilgan",
        _ => "a'zolik yo'q",
    };
}
