using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
public class PublicTestController(AppDbContext db, TelegramService telegram, AutoMessageService autoMsg) : ControllerBase
{
    /// <summary>Ommaviy brending — markaz nomi/logo/telefon (login, daraja testi kabi sahifalar uchun).</summary>
    [HttpGet("/api/public/brand")]
    public async Task<ActionResult<PublicBrandDto>> Brand()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new PublicBrandDto(m?.Name ?? "", m?.LogoUrl ?? "", m?.Phone ?? "");
    }

    /// <summary>Ommaviy web/PWA push konfiguratsiyasi — brauzer Firebase JS SDK'ni ishga tushirib
    /// FCM token olishi uchun (web app config + VAPID ochiq kaliti). Maxfiy emas.</summary>
    [HttpGet("/api/public/push-config")]
    public async Task<ActionResult<PublicPushConfigDto>> PushConfig()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var web = m?.FcmWebConfigJson ?? "";
        var vapid = m?.FcmVapidKey ?? "";
        var configured = vapid.Trim().Length > 0 && !string.IsNullOrWhiteSpace(web);
        return new PublicPushConfigDto(web, vapid, configured);
    }

    /// <summary>PWA manifest (DINAMIK) — markaz nomi va LOGOSI bilan. Ilova o'rnatilganda (Android/desktop)
    /// shu logo ikonka bo'lib ko'rinadi. Logo bo'lmasa favicon'ga qaytadi.</summary>
    [HttpGet("/api/public/manifest.webmanifest")]
    public async Task<IActionResult> Manifest()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var name = string.IsNullOrWhiteSpace(m?.Name) ? "O'quv markazi" : m!.Name.Trim();
        var logo = (m?.LogoUrl ?? "").Trim();

        object[] icons;
        if (logo.Length > 0)
        {
            var isSvg = logo.EndsWith(".svg", StringComparison.OrdinalIgnoreCase);
            var type = isSvg ? "image/svg+xml"
                : logo.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || logo.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg"
                : logo.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) ? "image/webp"
                : "image/png";
            // Raster logoni bir nechta o'lchamga "mos" deb e'lon qilamiz — brauzer ikonkani miqyoslaydi.
            var sizes = isSvg ? "any" : "96x96 192x192 512x512";
            icons = [new { src = logo, sizes, type, purpose = "any maskable" }];
        }
        else
        {
            icons = [new { src = "/favicon.svg", sizes = "any", type = "image/svg+xml", purpose = "any maskable" }];
        }

        var manifest = new
        {
            name,
            short_name = name.Length > 12 ? name[..12] : name,
            description = $"{name} — o'quvchi va o'qituvchi portali",
            start_url = "/",
            scope = "/",
            display = "standalone",
            background_color = "#ffffff",
            theme_color = "#4f46e5",
            icons,
        };
        var json = System.Text.Json.JsonSerializer.Serialize(manifest);
        return Content(json, "application/manifest+json");
    }

    /// <summary>Slug bo'yicha faol testni oladi (to'g'ri javobSIZ). Topilmasa 404.</summary>
    [HttpGet("{slug}")]
    public async Task<ActionResult<PublicTestDto>> Get(string slug)
    {
        var dto = await LevelTestService.GetPublicAsync(db, slug);
        if (dto is null) return NotFound(new { message = "Test topilmadi yoki faol emas" });
        return dto;
    }

    /// <summary>Bir martalik havola (invite) bo'yicha testni oladi — lid ma'lumoti oldindan to'ldirilgan.</summary>
    [HttpGet("invite/{token}")]
    public async Task<ActionResult<PublicInviteDto>> GetInvite(string token)
    {
        var dto = await LevelTestService.GetByInviteAsync(db, token);
        if (dto is null) return NotFound(new { message = "Havola topilmadi yoki test faol emas" });
        if (dto.Used) return StatusCode(410, new { message = "Bu havola allaqachon ishlatilgan." });
        return dto;
    }

    /// <summary>Bir martalik havola orqali topshirish — natija lidga bog'lanadi, havola yopiladi.</summary>
    [HttpPost("invite/{token}/submit")]
    [EnableRateLimiting("public-lead")]
    public async Task<ActionResult<TestResultDto>> SubmitInvite(string token, TestSubmitRequest req)
    {
        var safeAge = Math.Clamp(req.Age, 0, 120);
        if (safeAge != req.Age) req = req with { Age = safeAge };
        var result = await LevelTestService.SubmitInviteAsync(db, token, req, telegram, autoMsg);
        if (result is null) return StatusCode(410, new { message = "Havola topilmadi yoki allaqachon ishlatilgan." });
        return result;
    }

    /// <summary>Testni topshiradi — ball/daraja hisoblanadi va lid yaratiladi.</summary>
    [HttpPost("{slug}/submit")]
    [EnableRateLimiting("public-lead")]
    public async Task<ActionResult<TestResultDto>> Submit(string slug, TestSubmitRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { message = "Ism-familiyani kiriting" });
        // Anonim endpoint — kirishni cheklab qo'yamiz (spam / ortiqcha uzun matn oldini olish).
        if (req.FullName.Trim().Length > 100)
            return BadRequest(new { message = "Ism-familiya juda uzun" });
        if ((req.Phone ?? "").Trim().Length > 32)
            return BadRequest(new { message = "Telefon raqami juda uzun" });
        var (phoneValid, _, phoneError) = PhoneUtil.Validate(req.Phone);
        if (!phoneValid)
            return BadRequest(new { message = phoneError ?? "Telefon raqami noto'g'ri" });
        // Yoshni 0..120 oralig'iga moslab beramiz.
        var safeAge = Math.Clamp(req.Age, 0, 120);
        if (safeAge != req.Age) req = req with { Age = safeAge };

        var result = await LevelTestService.SubmitAsync(db, slug, req, telegram, autoMsg);
        if (result is null) return NotFound(new { message = "Test topilmadi yoki faol emas" });
        return result;
    }
}
