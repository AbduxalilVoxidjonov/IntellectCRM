using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        var result = await LevelTestService.SubmitAsync(db, slug, req);
        if (result is null) return NotFound(new { message = "Test topilmadi yoki faol emas" });
        return result;
    }
}
