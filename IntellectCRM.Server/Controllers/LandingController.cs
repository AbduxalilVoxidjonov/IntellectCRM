using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Asosiy domen (apex) LANDING sahifasi kontentini boshqarish — FAQAT superadmin.
/// Kontent bitta JSON blobda (LandingContent.Json): { langs:{uz,ru,en}, images:{slotId:url} }.
/// Tahrirlangan kontent apex landing serverига `window.__LANDING_CONTENT__` bo'lib inject qilinadi
/// (Program.cs). DB bo'sh bo'lsa GET `page/landing.default.json` (HTML hardcoded kontentidan ajratilgan)
/// ni qaytaradi. Rasm (sertifikat slotlari) backendga yuklanadi — `/uploads/landing-*` ostida.
/// </summary>
[ApiController]
[Authorize(Roles = "superadmin")]
[Route("api/admin/landing")]
public class LandingController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private string DefaultPath => Path.Combine(env.ContentRootPath, "page", "landing.default.json");

    private async Task<string> CurrentJsonAsync()
    {
        var row = await db.LandingContents.AsNoTracking().FirstOrDefaultAsync();
        if (row is not null && !string.IsNullOrWhiteSpace(row.Json)) return row.Json;
        // DB bo'sh — zaxira (default) faylidan
        if (System.IO.File.Exists(DefaultPath)) return await System.IO.File.ReadAllTextAsync(DefaultPath);
        return "{\"langs\":{},\"images\":{}}";
    }

    /// <summary>Joriy kontent JSON ({ langs, images }). DB bo'sh bo'lsa default faylidan.</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
        => Content(await CurrentJsonAsync(), "application/json");

    /// <summary>Kontentni saqlaydi (to'liq { langs, images } obyekti). Validatsiya: langs bo'lishi shart.</summary>
    [HttpPut]
    public async Task<IActionResult> Put([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("langs", out _))
            return BadRequest(new { message = "Noto'g'ri kontent: 'langs' bo'lishi shart." });
        var json = body.GetRawText();
        await SaveAsync(json);
        return Content(json, "application/json");
    }

    /// <summary>Rasm yuklaydi (sertifikat sloti, masalan cert-en) — backendda saqlanadi, images xaritasiga yoziladi.</summary>
    [HttpPost("images/{slotId}")]
    [RequestSizeLimit(20_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20_000_000)]
    public async Task<IActionResult> UploadImage(string slotId, IFormFile file)
    {
        slotId = SanitizeSlot(slotId);
        if (string.IsNullOrEmpty(slotId)) return BadRequest(new { message = "Slot id noto'g'ri." });
        if (UploadGuard.Validate(file) is { } error) return BadRequest(new { message = error });

        var dir = Path.Combine(env.ContentRootPath, "uploads");
        Directory.CreateDirectory(dir);
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var stored = $"landing-{slotId}-{Guid.NewGuid():N}{ext}";
        await using (var fs = System.IO.File.Create(Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);
        var url = $"/uploads/{stored}";

        var root = JsonNode.Parse(await CurrentJsonAsync())!.AsObject();
        var images = root["images"] as JsonObject;
        if (images is null) { images = new JsonObject(); root["images"] = images; }
        // eski faylni o'chir (agar bizning yuklanganimiz bo'lsa)
        DeleteIfOwned(images[slotId]?.GetValue<string>());
        images[slotId] = url;
        var json = root.ToJsonString();
        await SaveAsync(json);
        return Ok(new { slotId, url });
    }

    /// <summary>Slot rasmini o'chiradi (faylni va xaritadagi yozuvni).</summary>
    [HttpDelete("images/{slotId}")]
    public async Task<IActionResult> DeleteImage(string slotId)
    {
        slotId = SanitizeSlot(slotId);
        var root = JsonNode.Parse(await CurrentJsonAsync())!.AsObject();
        if (root["images"] is JsonObject images && images.ContainsKey(slotId))
        {
            DeleteIfOwned(images[slotId]?.GetValue<string>());
            images.Remove(slotId);
            await SaveAsync(root.ToJsonString());
        }
        return Ok(new { slotId });
    }

    /// <summary>Kontentni standart (default) holatga qaytaradi — DB yozuvini o'chiradi.</summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset()
    {
        var rows = await db.LandingContents.ToListAsync();
        db.LandingContents.RemoveRange(rows);
        await db.SaveChangesAsync();
        return Content(await CurrentJsonAsync(), "application/json");
    }

    private async Task SaveAsync(string json)
    {
        var row = await db.LandingContents.FirstOrDefaultAsync();
        if (row is null) { row = new LandingContent(); db.LandingContents.Add(row); }
        row.Json = json;
        row.UpdatedAt = AppClock.Now;
        await db.SaveChangesAsync();
    }

    // faqat harf/raqam/chiziqcha (cert-en, cert-ielts ...) — yo'l hujumidan himoya
    private static string SanitizeSlot(string s)
        => new string((s ?? "").Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());

    private void DeleteIfOwned(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("/uploads/landing-")) return;
        try
        {
            var abs = Path.Combine(env.ContentRootPath, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (System.IO.File.Exists(abs)) System.IO.File.Delete(abs);
        }
        catch { /* fayl yo'q bo'lsa e'tiborsiz */ }
    }
}
