using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using iText.Html2pdf;
using iText.Kernel.Pdf;
using QRCoder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Models;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Sertifikat tizimi:
/// — Mavjud: HTML andozadan sertifikat yaratish, saqlash, yuklab olish, SHA-256 tekshiruv.
/// — Yangi: iText7 orqali professional PDF (A4 landscape) + QR-kod + O'zbek sanasi.
/// GenerateCertificateAsync — imzo o'zgarmagan (mavjud API bilan to'liq muvofiq).
/// GeneratePdfCertificateAsync — yangi model asosida PDF hosil qiladi.
/// </summary>
public class CertificateService(IAppDbContext db, IHostEnvironment env)
{
    // Thread-safe in-memory kesh — andoza birinchi o'qilgandan keyin saqlanadi.
    private string? _templateCache;
    private readonly object _templateLock = new();

    // ─────────────────────────────────────────────────────────────
    // MAVJUD API (imzo o'zgarmaydi)
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Yangi sertifikat yaratadi: andozadan HTML render qiladi, serverga saqlaydi,
    /// SHA-256 hash hisoblab StudentCertificate yozuvini qo'shadi.
    /// Bir (studentId, courseId) uchun bir xil kunda qayta chaqirilsa mavjudini qaytaradi (idempotent).
    /// </summary>
    public async Task<StudentCertificate> GenerateCertificateAsync(
        string studentId,
        string courseId,
        string? metadataJson = null,
        DateTime? expiresAt = null)
    {
        var today = AppClock.Now.Date;

        // Idempotency: bugun allaqachon berilgan bo'lsa
        var existing = await db.StudentCertificates
            .Where(c => c.StudentId == studentId
                     && c.CourseId == courseId
                     && c.IssuedAt.Date == today
                     && c.Status == "active")
            .FirstOrDefaultAsync();
        if (existing is not null) return existing;

        var student = await db.Students.FirstOrDefaultAsync(s => s.Id == studentId)
            ?? throw new InvalidOperationException($"O'quvchi topilmadi: {studentId}");
        var course = await db.Subjects.FirstOrDefaultAsync(s => s.Id == courseId)
            ?? throw new InvalidOperationException($"Kurs topilmadi: {courseId}");

        var template = await db.CertificateTemplates
            .Where(t => t.CourseId == courseId)
            .FirstOrDefaultAsync()
            ?? await db.CertificateTemplates.FirstOrDefaultAsync();

        var certNumber = GenerateCertificateNumber();
        var html = template is not null
            ? RenderTemplate(template.HtmlTemplate, student.FullName, course.Name,
                today, expiresAt, certNumber)
            : BuildDefaultHtml(student.FullName, course.Name, today, expiresAt, certNumber);

        var (fileName, filePath) = await SaveHtmlAsync(certNumber, html);
        var bytes = Encoding.UTF8.GetBytes(html);
        var hash = ComputeSHA256(bytes);

        var cert = new StudentCertificate
        {
            StudentId = studentId,
            CourseId = courseId,
            FileName = fileName,
            FilePath = filePath,
            FileHash = hash,
            FileSize = bytes.LongLength,
            IssuedAt = today,
            ExpiresAt = expiresAt,
            Status = "active",
            Metadata = metadataJson,
            CreatedAt = AppClock.Now,
        };
        db.StudentCertificates.Add(cert);
        await db.SaveChangesAsync();
        return cert;
    }

    /// <summary>O'quvchining barcha sertifikatlarini (status va kurslari bilan) qaytaradi.</summary>
    public async Task<List<StudentCertificate>> GetStudentCertificatesAsync(string studentId)
    {
        return await db.StudentCertificates
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.IssuedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Sertifikat faylini (HTML baytlarini) qaytaradi va yuklab olish hisoblagichni yangilaydi.
    /// </summary>
    public async Task<(byte[] Bytes, string FileName, string ContentType)> DownloadCertificateAsync(
        string studentId,
        string certificateId)
    {
        var cert = await db.StudentCertificates
            .Where(c => c.Id == certificateId && c.StudentId == studentId)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Sertifikat topilmadi yoki ruxsat yo'q.");

        var absolutePath = Path.Combine(env.ContentRootPath, cert.FilePath.TrimStart('/'));
        if (!File.Exists(absolutePath))
            throw new FileNotFoundException($"Sertifikat fayli topilmadi: {cert.FilePath}");

        var bytes = await File.ReadAllBytesAsync(absolutePath);

        cert.DownloadCount++;
        if (cert.DownloadedAt is null) cert.DownloadedAt = AppClock.Now;
        await db.SaveChangesAsync();

        return (bytes, cert.FileName, "text/html");
    }

    /// <summary>
    /// Sertifikatni tekshiradi: hash DB'da bor va status==active bo'lsa IsValid=true.
    /// Har tekshiruvda CertificateVerification yozuvi qoladi.
    /// </summary>
    public async Task<CertificateVerification> VerifyCertificateAsync(
        string certificateId,
        string verifiedFromIp = "")
    {
        var cert = await db.StudentCertificates
            .Where(c => c.Id == certificateId)
            .FirstOrDefaultAsync();

        bool hashMatched = false;
        bool isValid = false;

        if (cert is not null)
        {
            var absolutePath = Path.Combine(env.ContentRootPath, cert.FilePath.TrimStart('/'));
            if (File.Exists(absolutePath))
            {
                var fileBytes = await File.ReadAllBytesAsync(absolutePath);
                var currentHash = ComputeSHA256(fileBytes);
                hashMatched = string.Equals(currentHash, cert.FileHash, StringComparison.OrdinalIgnoreCase);
            }

            var now = AppClock.Now;
            isValid = hashMatched
                   && cert.Status == "active"
                   && (cert.ExpiresAt is null || cert.ExpiresAt.Value > now);
        }

        var verification = new CertificateVerification
        {
            StudentCertificateId = certificateId,
            VerifiedAt = AppClock.Now,
            VerifiedFrom = verifiedFromIp,
            IsValid = isValid,
            HashMatched = hashMatched,
        };
        db.CertificateVerifications.Add(verification);
        await db.SaveChangesAsync();
        return verification;
    }

    // ─────────────────────────────────────────────────────────────
    // YANGI: PDF sertifikat (iText7 + QR-kod)
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Model asosida professional PDF sertifikat yaratadi va
    /// wwwroot/uploads/certificates/ ga saqlaydi.
    /// </summary>
    /// <returns>(pdfBytes, absoluteFilePath, certNumber, sha256Hex)</returns>
    public async Task<(byte[] Pdf, string FilePath, string CertNumber, string Sha256)>
        GeneratePdfCertificateAsync(CertificateGenerateModel model)
    {
        var certNumber = string.IsNullOrWhiteSpace(model.CertificateNumber)
            ? GenerateCertificateNumber()
            : model.CertificateNumber;

        var certId = string.IsNullOrWhiteSpace(model.CertificateId)
            ? Guid.NewGuid().ToString("N")
            : model.CertificateId;

        // QR-kod
        var qrUrl = string.IsNullOrWhiteSpace(model.VerifyUrl)
            ? $"CERT:{certNumber}"
            : model.VerifyUrl.Replace("{CertificateId}", certId).Replace("{certId}", certId);
        var qrBase64 = GenerateQrCode(qrUrl);

        // HTML render
        var html = await RenderPdfTemplateAsync(model, certNumber, certId, qrBase64);

        // HTML → PDF
        var pdfBytes = ConvertHtmlToPdf(html);

        // Saqlash
        var webRoot = env is IWebHostEnvironment webEnv
            ? webEnv.WebRootPath
            : env.ContentRootPath;
        var uploadsDir = Path.Combine(webRoot ?? env.ContentRootPath, "uploads", "certificates");
        Directory.CreateDirectory(uploadsDir);

        var safeDate = AppClock.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var fileName = $"Cert_{SanitizeFileName(model.StudentId)}_{SanitizeFileName(model.CourseId)}_{safeDate}.pdf";
        var filePath = Path.Combine(uploadsDir, fileName);
        await File.WriteAllBytesAsync(filePath, pdfBytes);

        var sha256 = ComputeSHA256(pdfBytes);
        return (pdfBytes, filePath, certNumber, sha256);
    }

    // ─────────────────────────────────────────────────────────────
    // HTML → PDF
    // ─────────────────────────────────────────────────────────────

    /// <summary>HTML matnini PDF baytlariga aylantiradi (iText7 HtmlConverter, A4 Landscape).</summary>
    public static byte[] ConvertHtmlToPdf(string html)
    {
        using var ms = new MemoryStream();
        using var writer = new PdfWriter(ms);
        using var pdfDoc = new PdfDocument(writer);
        pdfDoc.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4.Rotate());
        var converterProps = new ConverterProperties();
        HtmlConverter.ConvertToPdf(html, pdfDoc, converterProps);
        pdfDoc.Close();
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────
    // Andoza to'ldirish
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// wwwroot/templates/certificate-template.html andozasini model bilan to'ldirib HTML qaytaradi.
    /// </summary>
    public async Task<string> RenderPdfTemplateAsync(
        CertificateGenerateModel model,
        string certNumber,
        string certId,
        string qrBase64)
    {
        var template = await LoadPdfTemplateAsync();

        var accent = string.IsNullOrWhiteSpace(model.AccentColor) ? "#3b0764" : model.AccentColor;
        var completionDateStr = FormatCompletionDateUz(model.CompletionDate);
        var avgScore = model.AverageScore > 0
            ? model.AverageScore.ToString("F1", CultureInfo.InvariantCulture)
            : "—";
        var progress = ((int)Math.Round(model.ProgressPercent)).ToString();
        var darsCount = model.DarsCount > 0 ? model.DarsCount.ToString() : "—";
        var issuedByAddress = string.IsNullOrWhiteSpace(model.IssuedByAddress)
            ? ""
            : HttpUtility.HtmlEncode(model.IssuedByAddress);
        var notesBlock = string.IsNullOrWhiteSpace(model.CompletionNotes)
            ? ""
            : $"<div class=\"notes-text\">{HttpUtility.HtmlEncode(model.CompletionNotes)}</div>";
        var qrImg = $"<img src=\"data:image/png;base64,{qrBase64}\" width=\"70\" height=\"70\" alt=\"QR\" style=\"display:block;\"/>";

        return template
            .Replace("{accentColor}", accent)
            .Replace("{studentName}", HttpUtility.HtmlEncode(model.StudentName))
            .Replace("{courseName}", HttpUtility.HtmlEncode(model.CourseName))
            .Replace("{completionDate}", HttpUtility.HtmlEncode(completionDateStr))
            .Replace("{averageScore}", avgScore)
            .Replace("{progressPercent}", progress)
            .Replace("{darsCount}", darsCount)
            .Replace("{certificateNumber}", HttpUtility.HtmlEncode(certNumber))
            .Replace("{issuedBy}", HttpUtility.HtmlEncode(model.IssuedBy))
            .Replace("{issuedByAddress}", issuedByAddress)
            .Replace("{completionNotesBlock}", notesBlock)
            .Replace("[QR_CODE_IMAGE]", qrImg);
    }

    // ─────────────────────────────────────────────────────────────
    // QR-kod
    // ─────────────────────────────────────────────────────────────

    /// <summary>Berilgan matn uchun QR-kod yaratadi va Base64 PNG qaytaradi.</summary>
    public static string GenerateQrCode(string content)
    {
        using var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        // pixelsPerModule=3 → taxminan 111×111 piksel
        var pngBytes = qrCode.GetGraphic(3);
        return Convert.ToBase64String(pngBytes);
    }

    // ─────────────────────────────────────────────────────────────
    // Yordamchi (ham mavjud, ham yangi API uchun — public static)
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// HTML andoza matnida tokenlarni almashtirib render qiladi.
    /// Tokenlar: {{student_name}}, {{course_name}}, {{issue_date}},
    /// {{certificate_number}}, {{expires_date}}.
    /// </summary>
    public static string RenderTemplate(
        string htmlTemplate,
        string studentName,
        string courseName,
        DateTime issueDate,
        DateTime? expiresDate,
        string certNumber)
    {
        var expiresStr = expiresDate.HasValue
            ? expiresDate.Value.ToString("dd.MM.yyyy")
            : "Muddatsiz";

        return htmlTemplate
            .Replace("{{student_name}}", HtmlEncode(studentName))
            .Replace("{{course_name}}", HtmlEncode(courseName))
            .Replace("{{issue_date}}", issueDate.ToString("dd.MM.yyyy"))
            .Replace("{{certificate_number}}", HtmlEncode(certNumber))
            .Replace("{{expires_date}}", expiresStr);
    }

    /// <summary>SHA-256 hash (lowercase hex) hisoblab qaytaradi.</summary>
    public static string ComputeSHA256(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>Noyob sertifikat raqami: CERT-yyyy-MM-dd-NNNN formatida.</summary>
    public static string GenerateCertificateNumber()
    {
        var datePart = AppClock.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var suffix = (AppClock.Now.Millisecond + AppClock.Now.Second * 1000) % 10000;
        return $"CERT-{datePart}-{suffix:D4}";
    }

    /// <summary>HTML maxsus belgilarni HTML entity'lariga aylantiradi.</summary>
    public static string HtmlEncode(string text) =>
        text.Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");

    // ─────────────────────────────────────────────────────────────
    // Xususiy yordamchilar
    // ─────────────────────────────────────────────────────────────

    private static readonly string[] UzMonths =
        ["yanvar", "fevral", "mart", "aprel", "may", "iyun",
         "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

    private static string FormatCompletionDateUz(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso))
            return FormatDateUz(AppClock.Now);
        return DateTime.TryParseExact(iso, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var d)
            ? FormatDateUz(d)
            : iso;
    }

    private static string FormatDateUz(DateTime d) =>
        $"{d.Day} {UzMonths[d.Month - 1]} {d.Year}";

    private async Task<string> LoadPdfTemplateAsync()
    {
        if (_templateCache is not null) return _templateCache;

        var webRoot = env is IWebHostEnvironment webEnv
            ? webEnv.WebRootPath
            : env.ContentRootPath;
        var templatePath = Path.Combine(
            webRoot ?? env.ContentRootPath,
            "templates", "certificate-template.html");

        if (!File.Exists(templatePath))
            throw new FileNotFoundException(
                $"PDF sertifikat HTML andozasi topilmadi: {templatePath}. " +
                "wwwroot/templates/certificate-template.html faylini qo'ying.");

        var content = await File.ReadAllTextAsync(templatePath, Encoding.UTF8);

        lock (_templateLock)
        {
            _templateCache = content;
        }
        return _templateCache;
    }

    private async Task<(string fileName, string filePath)> SaveHtmlAsync(string certNumber, string html)
    {
        var certsDir = Path.Combine(env.ContentRootPath, "uploads", "certificates");
        Directory.CreateDirectory(certsDir);

        var safeName = certNumber.Replace("/", "-").Replace("\\", "-");
        var fileName = $"{safeName}.html";
        var absolutePath = Path.Combine(certsDir, fileName);
        await File.WriteAllTextAsync(absolutePath, html, Encoding.UTF8);

        return (fileName, $"/uploads/certificates/{fileName}");
    }

    private static string BuildDefaultHtml(
        string studentName,
        string courseName,
        DateTime issueDate,
        DateTime? expiresDate,
        string certNumber)
    {
        var expiresStr = expiresDate.HasValue
            ? expiresDate.Value.ToString("dd.MM.yyyy")
            : "Muddatsiz";

        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html><html lang=\"uz\"><head><meta charset=\"UTF-8\">");
        sb.AppendLine($"<title>Sertifikat — {HtmlEncode(certNumber)}</title>");
        sb.AppendLine("<style>body{font-family:serif;text-align:center;padding:60px}h1{color:#6d28d9}.cert-number{color:#6b7280;font-size:.85em}.footer{margin-top:40px;font-size:.8em;color:#9ca3af}</style>");
        sb.AppendLine("</head><body>");
        sb.AppendLine("<h1>SERTIFIKAT</h1><p>Ushbu sertifikat</p>");
        sb.AppendLine($"<h2>{HtmlEncode(studentName)}</h2>");
        sb.AppendLine($"<p>tomonidan <strong>{HtmlEncode(courseName)}</strong> kursi muvaffaqiyatli tugatilganligi sababli berildi.</p>");
        sb.AppendLine($"<p>Berilgan sana: <strong>{issueDate:dd.MM.yyyy}</strong></p>");
        sb.AppendLine($"<p>Amal qilish muddati: <strong>{expiresStr}</strong></p>");
        sb.AppendLine($"<p class=\"cert-number\">Sertifikat raqami: {HtmlEncode(certNumber)}</p>");
        sb.AppendLine("<div class=\"footer\">Bu sertifikat IntellectCRM orqali yaratilgan.</div>");
        sb.AppendLine("</body></html>");
        return sb.ToString();
    }

    private static string SanitizeFileName(string s) =>
        new string(s.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray())
            .TrimStart('-', '_');
}
