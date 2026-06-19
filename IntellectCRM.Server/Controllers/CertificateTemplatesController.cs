using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;
using System.Text.RegularExpressions;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Sertifikat andozalari (CertificateTemplate) boshqaruvi — admin uchun.
/// — CRUD: Yaratish, o'qish, yangilash, o'chirish
/// — Preview: Test ma'lumotlar bilan HTML andoza ko'rish
/// — Import: HTML/DOCX fayldan andoza yuklash
/// Audit logging bilan barcha o'zgarishlar qayd qilinadi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/certificate-templates")]
public class CertificateTemplatesController(
    AppDbContext db,
    AuditService audit,
    ILogger<CertificateTemplatesController> logger) : ControllerBase
{
    /// <summary>Barcha sertifikat andozalarini ro'yxatini ko'rish (tez, pagination yo'q).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CertificateTemplateDto>>> GetAll()
    {
        var templates = await db.CertificateTemplates
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var courseIds = templates
            .Where(t => !string.IsNullOrEmpty(t.CourseId))
            .Select(t => t.CourseId)
            .Distinct()
            .ToList();

        var courseNames = await db.Subjects
            .Where(s => courseIds.Contains(s.Id))
            .Select(s => new { s.Id, s.Name })
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        return templates
            .Select(t => ToTemplateDto(t, courseNames.GetValueOrDefault(t.CourseId ?? "", "")))
            .ToList();
    }

    /// <summary>Bitta andoza id bo'yicha olish (edit uchun, barcha maydonlar bilan).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<CertificateTemplateDto>> GetById(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { message = "Andoza ID kiritilmagan" });

        var template = await db.CertificateTemplates.FindAsync(id);
        if (template is null)
            return NotFound(new { message = "Andoza topilmadi" });

        var courseName = !string.IsNullOrEmpty(template.CourseId)
            ? await db.Subjects
                .Where(s => s.Id == template.CourseId)
                .Select(s => s.Name)
                .FirstOrDefaultAsync() ?? ""
            : "";

        return ToTemplateDto(template, courseName);
    }

    /// <summary>
    /// Yangi sertifikat andozasi yaratish.
    /// Parametrlar:
    /// - name: andoza nomi (majburiy, max 200 belgi)
    /// - courseId: bog'langan kurs id'si (ixtiyoriy, kiritilsa mavjud bo'lishi kerak)
    /// - htmlTemplate: HTML shablon matn (majburiy, @-o'rinbosarlar: @fish, @kurs, @sana, @muddati, @kod)
    /// - validityDays: sertifikatning amal qilish muddati kunlarda (standart: 0 = muddatsiz)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CertificateTemplateDto>> Create(CreateCertificateTemplateRequest req)
    {
        // Validatsiya
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Andoza nomi bo'sh bo'lmasligi kerak" });
        if (req.Name.Length > 200)
            return BadRequest(new { message = "Andoza nomi 200 belgidan oshmasligi kerak" });

        if (string.IsNullOrWhiteSpace(req.HtmlTemplate))
            return BadRequest(new { message = "HTML andoza bo'sh bo'lmasligi kerak" });

        var validityDays = Math.Max(0, req.ValidityDays);

        // Kursni tekshirish (mavjud bo'lsa)
        if (!string.IsNullOrWhiteSpace(req.CourseId))
        {
            var course = await db.Subjects.FindAsync(req.CourseId);
            if (course is null)
                return BadRequest(new { message = "Tanlangan kurs topilmadi" });
        }

        var template = new CertificateTemplate
        {
            Name = req.Name.Trim(),
            CourseId = req.CourseId ?? "",
            HtmlTemplate = req.HtmlTemplate.Trim(),
            ValidityDays = validityDays,
        };

        db.CertificateTemplates.Add(template);

        // Audit logging
        audit.Record(
            AuditService.EntityTemplate,
            template.Id,
            "create",
            $"Sertifikat andozasi yaratildi: '{template.Name}'",
            after: new { template.Name, template.CourseId, ValidityDays = template.ValidityDays });

        await db.SaveChangesAsync();

        var courseName = !string.IsNullOrEmpty(template.CourseId)
            ? await db.Subjects
                .Where(s => s.Id == template.CourseId)
                .Select(s => s.Name)
                .FirstOrDefaultAsync() ?? ""
            : "";

        logger.LogInformation("Sertifikat andozasi yaratildi: {TemplateId} - {TemplateName}", template.Id, template.Name);
        return StatusCode(201, ToTemplateDto(template, courseName));
    }

    /// <summary>
    /// Sertifikat andozasini yangilash (tahrirlash).
    /// Parametrlar:
    /// - id: andoza id'si (URL da)
    /// - name: yangi nomi (majburiy)
    /// - courseId: bog'langan kurs (ixtiyoriy)
    /// - htmlTemplate: yangi HTML shablon (majburiy)
    /// - validityDays: yangi muddati (standart: 0)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<CertificateTemplateDto>> Update(string id, UpdateCertificateTemplateRequest req)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { message = "Andoza ID kiritilmagan" });

        // Validatsiya
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Andoza nomi bo'sh bo'lmasligi kerak" });
        if (req.Name.Length > 200)
            return BadRequest(new { message = "Andoza nomi 200 belgidan oshmasligi kerak" });

        if (string.IsNullOrWhiteSpace(req.HtmlTemplate))
            return BadRequest(new { message = "HTML andoza bo'sh bo'lmasligi kerak" });

        var template = await db.CertificateTemplates.FindAsync(id);
        if (template is null)
            return NotFound(new { message = "Andoza topilmadi" });

        // Kursni tekshirish (mavjud bo'lsa)
        if (!string.IsNullOrWhiteSpace(req.CourseId))
        {
            var course = await db.Subjects.FindAsync(req.CourseId);
            if (course is null)
                return BadRequest(new { message = "Tanlangan kurs topilmadi" });
        }

        // Eski qiymatlarni saqlash (audit uchun)
        var oldName = template.Name;
        var oldCourseId = template.CourseId;
        var oldHtmlTemplate = template.HtmlTemplate;
        var oldValidityDays = template.ValidityDays;

        // Yangilash
        template.Name = req.Name.Trim();
        template.CourseId = req.CourseId ?? "";
        template.HtmlTemplate = req.HtmlTemplate.Trim();
        template.ValidityDays = Math.Max(0, req.ValidityDays);

        // O'zgarishi bor-yo'qni tekshirish
        var changed = oldName != template.Name
                   || oldCourseId != template.CourseId
                   || oldHtmlTemplate != template.HtmlTemplate
                   || oldValidityDays != template.ValidityDays;

        if (changed)
        {
            // Audit logging
            audit.Record(
                AuditService.EntityTemplate,
                template.Id,
                "update",
                $"Sertifikat andozasi yangilandi: '{template.Name}'",
                before: new { Name = oldName, CourseId = oldCourseId, ValidityDays = oldValidityDays },
                after: new { template.Name, template.CourseId, template.ValidityDays });

            logger.LogInformation("Sertifikat andozasi yangilandi: {TemplateId} - {TemplateName}", template.Id, template.Name);
        }

        await db.SaveChangesAsync();

        var courseName = !string.IsNullOrEmpty(template.CourseId)
            ? await db.Subjects
                .Where(s => s.Id == template.CourseId)
                .Select(s => s.Name)
                .FirstOrDefaultAsync() ?? ""
            : "";

        return ToTemplateDto(template, courseName);
    }

    /// <summary>
    /// Sertifikat andozasini o'chirish (faqat andoza o'chiriladi,
    /// mavjud sertifikatlar saqlanib qoladi).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { message = "Andoza ID kiritilmagan" });

        var template = await db.CertificateTemplates.FindAsync(id);
        if (template is null)
            return NotFound(new { message = "Andoza topilmadi" });

        var templateName = template.Name;

        db.CertificateTemplates.Remove(template);

        // Audit logging
        audit.Record(
            AuditService.EntityTemplate,
            template.Id,
            "delete",
            $"Sertifikat andozasi o'chirildi: '{templateName}'",
            before: new { template.Name, template.CourseId });

        await db.SaveChangesAsync();

        logger.LogInformation("Sertifikat andozasi o'chirildi: {TemplateId} - {TemplateName}", template.Id, templateName);
        return NoContent();
    }

    /// <summary>
    /// Andoza previewini ko'rish — test ma'lumotlari bilan HTML render qilish.
    /// Parametrlar:
    /// - id: andoza id'si (URL da)
    /// - studentName: o'quvchi FISH'i (test uchun, standart: "Abdullayev Abbos")
    /// - courseName: kurs nomi (test uchun, standart: tanlangan kurs yoki "Test Kursi")
    /// - certificateNumber: sertifikat raqami (test uchun, standart: generate)
    ///
    /// Javob: HTML teksti (text/html content-type), brauzerda render qilinadi.
    /// </summary>
    [HttpGet("{id}/preview")]
    public async Task<ActionResult> Preview(
        string id,
        [FromQuery] string? studentName = null,
        [FromQuery] string? courseName = null,
        [FromQuery] string? certificateNumber = null)
    {
        if (string.IsNullOrWhiteSpace(id))
            return BadRequest(new { message = "Andoza ID kiritilmagan" });

        var template = await db.CertificateTemplates.FindAsync(id);
        if (template is null)
            return NotFound(new { message = "Andoza topilmadi" });

        // Test ma'lumotlari
        var testStudent = studentName ?? "Abdullayev Abbos";
        var testCourse = courseName;
        if (string.IsNullOrEmpty(testCourse))
        {
            testCourse = !string.IsNullOrEmpty(template.CourseId)
                ? await db.Subjects
                    .Where(s => s.Id == template.CourseId)
                    .Select(s => s.Name)
                    .FirstOrDefaultAsync() ?? "Test Kursi"
                : "Test Kursi";
        }

        var testDate = DateTime.Now;
        var testExpires = template.ValidityDays > 0
            ? testDate.AddDays(template.ValidityDays)
            : (DateTime?)null;
        var testCertNumber = certificateNumber ?? $"TEST-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";

        // Render
        var html = RenderTemplate(
            template.HtmlTemplate,
            testStudent,
            testCourse,
            testDate,
            testExpires,
            testCertNumber);

        return Content(html, "text/html; charset=utf-8");
    }

    /// <summary>
    /// HTML fayldan sertifikat andozasi import qilish (upload).
    /// Multipart/form-data:
    /// - file: .html yoki .txt fayl (max 1 MB)
    /// - name: andoza nomi (majburiy)
    /// - courseId: kurs id'si (ixtiyoriy)
    /// - validityDays: muddati kunlarda (standart: 0)
    ///
    /// Fayl o'qiladi, uning matni HTML shablon sifatida saqlanadi.
    /// </summary>
    [HttpPost("import")]
    public async Task<ActionResult<CertificateTemplateDto>> Import(
        [FromForm] IFormFile file,
        [FromForm] string name,
        [FromForm] string? courseId = null,
        [FromForm] int validityDays = 0)
    {
        // Validatsiya
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Fayl yuborilmadi" });

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Andoza nomi kiritilmagan" });

        const int maxFileSize = 1 * 1024 * 1024; // 1 MB
        if (file.Length > maxFileSize)
            return BadRequest(new { message = "Fayl 1 MB'dan oshmasligi kerak" });

        // Fayl turi tekshirish
        var allowedExtensions = new[] { ".html", ".htm", ".txt" };
        var fileExt = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(fileExt))
            return BadRequest(new { message = "Faqat .html yoki .txt fayllar qabul qilinadi" });

        // Kursni tekshirish
        if (!string.IsNullOrWhiteSpace(courseId))
        {
            var course = await db.Subjects.FindAsync(courseId);
            if (course is null)
                return BadRequest(new { message = "Tanlangan kurs topilmadi" });
        }

        // Fayl matnini o'qish
        string htmlContent;
        try
        {
            using (var reader = new StreamReader(file.OpenReadStream()))
            {
                htmlContent = await reader.ReadToEndAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Fayl o'qishda xatolik");
            return StatusCode(500, new { message = "Fayl o'qishda xatolik yuz berdi" });
        }

        if (string.IsNullOrWhiteSpace(htmlContent))
            return BadRequest(new { message = "Fayl bo'sh yoki o'qilmadi" });

        // Andoza yaratish
        var template = new CertificateTemplate
        {
            Name = name.Trim(),
            CourseId = courseId ?? "",
            HtmlTemplate = htmlContent.Trim(),
            ValidityDays = Math.Max(0, validityDays),
        };

        db.CertificateTemplates.Add(template);

        // Audit logging
        audit.Record(
            AuditService.EntityTemplate,
            template.Id,
            "import",
            $"Sertifikat andozasi fayldan import qilindi: '{template.Name}' ({file.FileName})",
            after: new { template.Name, template.CourseId, FileName = file.FileName });

        await db.SaveChangesAsync();

        var courseName = !string.IsNullOrEmpty(template.CourseId)
            ? await db.Subjects
                .Where(s => s.Id == template.CourseId)
                .Select(s => s.Name)
                .FirstOrDefaultAsync() ?? ""
            : "";

        logger.LogInformation(
            "Sertifikat andozasi import qilindi: {TemplateId} - {TemplateName} (File: {FileName})",
            template.Id, template.Name, file.FileName);

        return StatusCode(201, ToTemplateDto(template, courseName));
    }

    // ─────────────────────────── Helpers ───────────────────────────

    /// <summary>
    /// HTML andozasini o'rinbosarlar bilan render qilish.
    /// @-o'rinbosarlar:
    /// - @fish: o'quvchi FISH'i
    /// - @kurs: kurs nomi
    /// - @sana: bugungi sana (yyyy-MM-dd)
    /// - @muddati: sertifikat amal qilish muddati (yyyy-MM-dd), yo'q bo'lsa bo'sh
    /// - @kod: sertifikat raqami (unique identifier)
    /// </summary>
    private static string RenderTemplate(
        string htmlTemplate,
        string studentName,
        string courseName,
        DateTime issuedDate,
        DateTime? expiresDate,
        string certificateNumber)
    {
        var result = htmlTemplate;

        // O'rinbosarlarni almashtirish
        result = Regex.Replace(result, @"@fish\b", studentName, RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"@kurs\b", courseName, RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"@sana\b", issuedDate.ToString("yyyy-MM-dd"), RegexOptions.IgnoreCase);
        result = Regex.Replace(
            result,
            @"@muddati\b",
            expiresDate?.ToString("yyyy-MM-dd") ?? "",
            RegexOptions.IgnoreCase);
        result = Regex.Replace(result, @"@kod\b", certificateNumber, RegexOptions.IgnoreCase);

        return result;
    }

    /// <summary>CertificateTemplate entityni DTO'ga aylantirish.</summary>
    private static CertificateTemplateDto ToTemplateDto(CertificateTemplate t, string courseName) =>
        new(
            Id: t.Id,
            Name: t.Name,
            CourseId: t.CourseId ?? "",
            CourseName: courseName,
            ValidityDays: t.ValidityDays,
            CreatedAt: t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"));
}
