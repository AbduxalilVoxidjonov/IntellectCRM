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
/// Kontent bitta JSON blobda (LandingContent.Json). Sodda sxema (faqat tahrirlanadigan narsalar):
///   { courses:[{price, uz:{name,desc}, ru:{...}, en:{...}}],
///     teachers:[{photo, uz:{name,role,bio}, ...}],
///     certificates:[url,...], gallery:[url,...], testLink:"https://crm.../test/slug" }
/// Statik matn (biz haqimizda, afzalliklar, FAQ...) landing HTML ichida hardcoded (editor tegmaydi).
/// Kontent apex landing serverига `window.__LANDING_CONTENT__` bo'lib inject qilinadi (Program.cs).
/// Rasm `/uploads/landing-*` ostida; saqlashda ishlatilmagan landing-* fayllar tozalanadi (GC).
/// </summary>
[ApiController]
[Authorize(Roles = "superadmin")]
[Route("api/admin/landing")]
public class LandingController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private string DefaultPath => Path.Combine(env.ContentRootPath, "page", "landing.default.json");
    private string UploadsDir => Path.Combine(env.ContentRootPath, "uploads");

    private async Task<string> CurrentJsonAsync()
    {
        var row = await db.LandingContents.AsNoTracking().FirstOrDefaultAsync();
        if (row is not null && !string.IsNullOrWhiteSpace(row.Json)) return row.Json;
        if (System.IO.File.Exists(DefaultPath)) return await System.IO.File.ReadAllTextAsync(DefaultPath);
        return "{\"courses\":[],\"teachers\":[],\"certificates\":[],\"gallery\":[],\"testLink\":\"\"}";
    }

    /// <summary>Joriy kontent JSON. DB bo'sh bo'lsa default faylidan.</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
        => Content(await CurrentJsonAsync(), "application/json");

    /// <summary>Kontentni saqlaydi (to'liq obyekt). Saqlagandan keyin yetim rasmlar tozalanadi.</summary>
    [HttpPut]
    public async Task<IActionResult> Put([FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { message = "Noto'g'ri kontent — obyekt bo'lishi shart." });
        var json = body.GetRawText();
        await SaveAsync(json);
        GcOrphanImages(json);
        return Content(json, "application/json");
    }

    /// <summary>Bitta rasm yuklaydi (ustoz/sertifikat/galereya). { url } qaytaradi — frontend ro'yxatga qo'shadi.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(20_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20_000_000)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (UploadGuard.Validate(file) is { } error) return BadRequest(new { message = error });
        Directory.CreateDirectory(UploadsDir);
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var stored = $"landing-{Guid.NewGuid():N}{ext}";
        await using (var fs = System.IO.File.Create(Path.Combine(UploadsDir, stored)))
            await file.CopyToAsync(fs);
        return Ok(new { url = $"/uploads/{stored}" });
    }

    /// <summary>Kontentni standart holatga qaytaradi — DB yozuvini o'chiradi (yuklangan rasmlar ham tozalanadi).</summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset()
    {
        var rows = await db.LandingContents.ToListAsync();
        db.LandingContents.RemoveRange(rows);
        await db.SaveChangesAsync();
        GcOrphanImages("{}"); // hech narsa ishlatilmaydi → barcha landing-* o'chadi
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

    // JSON ichidagi BARCHA "/uploads/landing-*" satrlarni yig'ib, uploads papkasidagi shunga mos
    // bo'lmagan landing-* fayllarni o'chiradi (yetim rasmlar). Faqat o'zimiz yuklagan fayllar.
    private void GcOrphanImages(string json)
    {
        try
        {
            var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            CollectStrings(JsonNode.Parse(json), used);
            if (!Directory.Exists(UploadsDir)) return;
            foreach (var path in Directory.EnumerateFiles(UploadsDir, "landing-*"))
            {
                var name = Path.GetFileName(path);
                if (!used.Contains($"/uploads/{name}"))
                    try { System.IO.File.Delete(path); } catch { /* band/yo'q — e'tiborsiz */ }
            }
        }
        catch { /* GC ixtiyoriy — xato saqlashni buzmasin */ }
    }

    private static void CollectStrings(JsonNode? node, HashSet<string> sink)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var kv in obj) CollectStrings(kv.Value, sink);
                break;
            case JsonArray arr:
                foreach (var item in arr) CollectStrings(item, sink);
                break;
            case JsonValue val when val.TryGetValue<string>(out var s) && !string.IsNullOrEmpty(s):
                sink.Add(s);
                break;
        }
    }
}
