using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Ommaviy (autentifikatsiyasiz) daraja testi: bo'lajak o'quvchi `/test/{slug}` orqali kiradi,
/// testni ishlaydi va topshiradi — natija CRM'da yangi LID bo'lib tushadi.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/test")]
public class PublicTestController(AppDbContext db) : ControllerBase
{
    /// <summary>Ommaviy brending — markaz nomi/logo/telefon (login, daraja testi kabi sahifalar uchun).</summary>
    [HttpGet("/api/public/brand")]
    public async Task<ActionResult<PublicBrandDto>> Brand()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new PublicBrandDto(m?.Name ?? "", m?.LogoUrl ?? "", m?.Phone ?? "");
    }

    /// <summary>Slug bo'yicha faol testni oladi (to'g'ri javobSIZ). Topilmasa 404.</summary>
    [HttpGet("{slug}")]
    public async Task<ActionResult<PublicTestDto>> Get(string slug)
    {
        var dto = await LevelTestService.GetPublicAsync(db, slug);
        if (dto is null) return NotFound(new { message = "Test topilmadi yoki faol emas" });
        return dto;
    }

    /// <summary>Testni topshiradi — ball/daraja hisoblanadi va lid yaratiladi.</summary>
    [HttpPost("{slug}/submit")]
    public async Task<ActionResult<TestResultDto>> Submit(string slug, TestSubmitRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { message = "Ism-familiyani kiriting" });
        if (string.IsNullOrWhiteSpace(req.Phone))
            return BadRequest(new { message = "Telefon raqamini kiriting" });
        // Anonim endpoint — kirishni cheklab qo'yamiz (spam / ortiqcha uzun matn oldini olish).
        if (req.FullName.Trim().Length > 100)
            return BadRequest(new { message = "Ism-familiya juda uzun" });
        if (req.Phone.Trim().Length > 32)
            return BadRequest(new { message = "Telefon raqami juda uzun" });
        // Yoshni 0..120 oralig'iga moslab beramiz.
        var safeAge = Math.Clamp(req.Age, 0, 120);
        if (safeAge != req.Age) req = req with { Age = safeAge };

        var result = await LevelTestService.SubmitAsync(db, slug, req);
        if (result is null) return NotFound(new { message = "Test topilmadi yoki faol emas" });
        return result;
    }
}
