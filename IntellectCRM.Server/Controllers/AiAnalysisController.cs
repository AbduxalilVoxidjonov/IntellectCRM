using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Markaz (butun o'quv markazi) kunlik AI tahlili — bosh sahifadagi "AI Tahlil" bo'limi.
/// Tahlil har kuni ertalab fon xizmati (<see cref="CenterAiSchedulerService"/>) orqali avtomatik
/// yaratiladi; admin qo'lda ham yangilashi mumkin (POST run). Kuniga bir marta (force=true superadmin).
/// </summary>
[ApiController]
[Authorize(Roles = "admin,superadmin,staff")]
[Route("api/admin/ai-analysis")]
public class AiAnalysisController(AppDbContext db, IConfiguration config) : ControllerBase
{
    /// <summary>Bugungi (yoki eng so'nggi) markaz AI tahlili. Yo'q bo'lsa null.</summary>
    [HttpGet("center")]
    public async Task<ActionResult<CenterAiRecordDto?>> GetCenter(CancellationToken ct)
        => await CenterAiAnalysisService.GetLatestAsync(db, ct);

    /// <summary>Markaz AI tahlillari tarixi (eng yangisi birinchi).</summary>
    [HttpGet("center/history")]
    public async Task<ActionResult<IEnumerable<CenterAiHistoryItemDto>>> History(CancellationToken ct)
        => await CenterAiAnalysisService.HistoryAsync(db, ct);

    /// <summary>Qo'lda markaz AI tahlilini yaratish. Bugun allaqachon qilingan bo'lsa mavjudi qaytadi
    /// (AlreadyToday=true). <paramref name="force"/>=true (faqat superadmin) bo'lsa qayta yaratiladi.</summary>
    [HttpPost("center/run")]
    public async Task<ActionResult<CenterAiResponseDto>> Run([FromQuery] bool force = false, CancellationToken ct = default)
    {
        var canForce = force && User.IsInRole("superadmin");
        return await CenterAiAnalysisService.GenerateAsync(db, config, canForce, ct);
    }
}
