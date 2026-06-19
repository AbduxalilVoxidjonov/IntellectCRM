using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas;
using iText.Kernel.Geom;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.IO.Font.Constants;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using iText.Kernel.Pdf.Xobject;
using iText.IO.Image;
using QRCoder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Models;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Sertifikat tizimi:
/// Professional PDF sertifikat (A4 landscape, navy + gold dizayn, o'zbek matni).
/// iText7 native canvas orqali quriladi — HTML→PDF emas, to'g'ri vektor chizish.
/// </summary>
public class CertificateService(IAppDbContext db, IHostEnvironment env)
{
    // ─────────────────────────────────────────────────────────────
    // Asosiy ranglar (DeviceRgb, 0..255)
    // ─────────────────────────────────────────────────────────────

    // Navy ko'k (#1a3a5e)
    private static readonly DeviceRgb Navy = new(26, 58, 94);
    // Och navy (#1f4a7a)
    private static readonly DeviceRgb NavyLight = new(31, 74, 122);
    // Oltin (#FDB913)
    private static readonly DeviceRgb Gold = new(253, 185, 19);
    // Och oltin (#F5C842)
    private static readonly DeviceRgb GoldLight = new(245, 200, 66);
    // Oq
    private static readonly DeviceRgb White = new(255, 255, 255);
    // Qora
    private static readonly DeviceRgb Black = new(0, 0, 0);
    // Kulrang (#B0B8C1)
    private static readonly DeviceRgb Gray = new(176, 184, 193);

    // A4 Landscape o'lchami (pt: 1pt = 1/72 dyuym)
    // 297mm × 210mm
    private static readonly PageSize A4Landscape = PageSize.A4.Rotate();
    private const float W = 841.89f; // 297mm in pt
    private const float H = 595.28f; // 210mm in pt

    // ─────────────────────────────────────────────────────────────
    // Asosiy API: sertifikat yaratish
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// O'quvchi uchun professional Uzbek PDF sertifikat yaratadi.
    /// Bir (studentId, courseId) uchun bir xil kunda idempotent.
    /// </summary>
    public async Task<StudentCertificate> GenerateCertificateAsync(
        string studentId,
        string courseId,
        string? metadataJson = null,
        DateTime? expiresAt = null,
        string? teacherName = null)
    {
        var today = AppClock.Now.Date;

        // Idempotency: bugun allaqachon berilgan bo'lsa qaytaramiz
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

        // O'qituvchi ismini DB dan olish (berilmagan bo'lsa)
        if (string.IsNullOrWhiteSpace(teacherName))
        {
            var group = await db.Classes
                .Where(g => g.CourseId == courseId && !g.IsArchived)
                .FirstOrDefaultAsync();
            if (group?.TeacherId is not null)
            {
                teacherName = await db.Teachers
                    .Where(t => t.Id == group.TeacherId)
                    .Select(t => t.FullName)
                    .FirstOrDefaultAsync();
            }
        }

        var certId = Guid.NewGuid().ToString("N");
        var certNumber = GenerateCertificateNumber();

        // Tekshirish URL (QR uchun)
        var verifyUrl = $"https://crm.intellectschool.uz/verify-certificate/{certId}";

        // PDF generatsiya
        var pdfBytes = GeneratePdfCertificateUzbekAsync(
            studentName: student.FullName,
            courseName: course.Name,
            teacherName: teacherName ?? "O'qituvchi",
            certNumber: certNumber,
            certId: certId,
            issueDate: today,
            verifyUrl: verifyUrl
        );

        // Saqlash yo'li
        var certsDir = GetCertificatesDirectory();
        var safeName = certNumber.Replace("/", "-").Replace("\\", "-");
        var fileName = $"{safeName}.pdf";
        var absolutePath = System.IO.Path.Combine(certsDir, fileName);
        await System.IO.File.WriteAllBytesAsync(absolutePath, pdfBytes);

        var hash = ComputeSHA256(pdfBytes);

        var cert = new StudentCertificate
        {
            Id = certId,
            StudentId = studentId,
            CourseId = courseId,
            FileName = fileName,
            FilePath = $"/uploads/certificates/{fileName}",
            FileHash = hash,
            FileSize = pdfBytes.LongLength,
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

    /// <summary>O'quvchining barcha sertifikatlarini qaytaradi.</summary>
    public async Task<List<StudentCertificate>> GetStudentCertificatesAsync(string studentId)
    {
        return await db.StudentCertificates
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.IssuedAt)
            .ToListAsync();
    }

    /// <summary>Sertifikat faylini (PDF baytlarini) qaytaradi.</summary>
    public async Task<(byte[] Bytes, string FileName, string ContentType)> DownloadCertificateAsync(
        string studentId,
        string certificateId)
    {
        var cert = await db.StudentCertificates
            .Where(c => c.Id == certificateId && c.StudentId == studentId)
            .FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Sertifikat topilmadi yoki ruxsat yo'q.");

        var absolutePath = ResolveAbsolutePath(cert.FilePath);
        if (!System.IO.File.Exists(absolutePath))
            throw new System.IO.FileNotFoundException($"Sertifikat fayli topilmadi: {cert.FilePath}");

        var bytes = await System.IO.File.ReadAllBytesAsync(absolutePath);

        cert.DownloadCount++;
        if (cert.DownloadedAt is null) cert.DownloadedAt = AppClock.Now;
        await db.SaveChangesAsync();

        var contentType = cert.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
            ? "application/pdf"
            : "text/html";

        return (bytes, cert.FileName, contentType);
    }

    /// <summary>Sertifikatni tekshiradi. Har tekshiruvda CertificateVerification yozuvi qoladi.</summary>
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
            var absolutePath = ResolveAbsolutePath(cert.FilePath);
            if (System.IO.File.Exists(absolutePath))
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(absolutePath);
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
    // PDF GENERATSIYA — iText7 native canvas
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Professional Uzbek PDF sertifikat yaratadi.
    /// Navy ko'k fon + oltin bezaklar + serif shriftlar.
    /// A4 Landscape (297mm × 210mm).
    /// </summary>
    private static byte[] GeneratePdfCertificateUzbekAsync(
        string studentName,
        string courseName,
        string teacherName,
        string certNumber,
        string certId,
        DateTime issueDate,
        string verifyUrl)
    {
        using var ms = new System.IO.MemoryStream();
        using var writer = new PdfWriter(ms);
        using var pdfDoc = new PdfDocument(writer);

        pdfDoc.SetDefaultPageSize(A4Landscape);

        // Canvas orqali chizish
        var page = pdfDoc.AddNewPage(A4Landscape);
        var canvas = new PdfCanvas(page);

        // ── 1. Navy gradient fon ──
        DrawNavyBackground(canvas);

        // ── 2. Burchak bezaklari (oltin uchburchaklar) ──
        DrawCornerDecorations(canvas);

        // ── 3. Yuqori oltin banner ──
        DrawTopGoldBanner(canvas);

        // ── 4. Medal/yulduz ──
        DrawMedalIcon(canvas);

        // ── 5. "SERTIFIKAT" sarlavha ──
        DrawTitle(canvas, pdfDoc);

        // ── 6. "Faxriyat bilan taqdim etilmoqda:" ──
        DrawAwardedTo(canvas, pdfDoc);

        // ── 7. O'quvchi ismi ──
        DrawStudentName(canvas, pdfDoc, studentName);

        // ── 8. Kurs tavsifi ──
        DrawCourseDescription(canvas, pdfDoc, courseName);

        // ── 9. Imzo bo'limi ──
        DrawSignatureSection(canvas, pdfDoc, teacherName, issueDate);

        // ── 10. QR kod + sertifikat raqami ──
        DrawQrAndCertNumber(canvas, pdfDoc, certNumber, verifyUrl);

        // ── 11. Markaziy nomi (pastki chiziq) ──
        DrawCenterName(canvas, pdfDoc);

        // ── 12. Bezak chiziqlari ──
        DrawDecorativeLines(canvas);

        canvas.Release();
        pdfDoc.Close();
        return ms.ToArray();
    }

    private static void DrawNavyBackground(PdfCanvas canvas)
    {
        // Asosiy navy fon
        canvas.SetFillColor(Navy)
              .Rectangle(0, 0, W, H)
              .Fill();

        // Yengil gradient effekti — markazda biroz ochroq
        canvas.SaveState()
              .SetFillColor(NavyLight)
              .SetExtGState(new iText.Kernel.Pdf.Extgstate.PdfExtGState().SetFillOpacity(0.3f))
              .Rectangle(W * 0.2f, H * 0.1f, W * 0.6f, H * 0.8f)
              .Fill()
              .RestoreState();
    }

    private static void DrawCornerDecorations(PdfCanvas canvas)
    {
        float size = 70f;
        float opacity = 0.35f;

        canvas.SaveState()
              .SetFillColor(Gold)
              .SetExtGState(new iText.Kernel.Pdf.Extgstate.PdfExtGState().SetFillOpacity(opacity));

        // Yuqori-chap uchburchak
        canvas.MoveTo(0, H)
              .LineTo(size, H)
              .LineTo(0, H - size)
              .ClosePathFillStroke();

        // Yuqori-o'ng uchburchak
        canvas.MoveTo(W, H)
              .LineTo(W - size, H)
              .LineTo(W, H - size)
              .ClosePathFillStroke();

        // Pastki-chap uchburchak
        canvas.MoveTo(0, 0)
              .LineTo(size, 0)
              .LineTo(0, size)
              .ClosePathFillStroke();

        // Pastki-o'ng uchburchak
        canvas.MoveTo(W, 0)
              .LineTo(W - size, 0)
              .LineTo(W, size)
              .ClosePathFillStroke();

        canvas.RestoreState();
    }

    private static void DrawTopGoldBanner(PdfCanvas canvas)
    {
        float bannerH = 85f;
        float margin = 60f;
        float taper = 40f;

        // Trapetsiya shaklida oltin banner (yuqoridan keng, pastdan torayadi)
        canvas.SaveState()
              .SetFillColor(Gold);

        canvas.MoveTo(margin, H)
              .LineTo(W - margin, H)
              .LineTo(W - margin - taper, H - bannerH)
              .LineTo(margin + taper, H - bannerH)
              .ClosePathFillStroke();

        // Banner ustida ingichka chiziq
        canvas.SetStrokeColor(GoldLight)
              .SetLineWidth(1.5f)
              .MoveTo(margin + taper * 1.2f, H - bannerH - 3)
              .LineTo(W - margin - taper * 1.2f, H - bannerH - 3)
              .Stroke();

        canvas.RestoreState();
    }

    private static void DrawMedalIcon(PdfCanvas canvas)
    {
        // Medal ribbon (ikki tasma)
        float ribbonX = W / 2f;
        float ribbonTopY = H - 90f;
        float ribbonW = 18f;
        float ribbonH = 40f;

        canvas.SaveState()
              .SetFillColor(Gold);

        // Chap tasma
        canvas.MoveTo(ribbonX - ribbonW - 5, ribbonTopY)
              .LineTo(ribbonX - 5, ribbonTopY)
              .LineTo(ribbonX - 8, ribbonTopY - ribbonH)
              .LineTo(ribbonX - ribbonW - 2, ribbonTopY - ribbonH)
              .ClosePathFillStroke();

        // O'ng tasma
        canvas.MoveTo(ribbonX + 5, ribbonTopY)
              .LineTo(ribbonX + ribbonW + 5, ribbonTopY)
              .LineTo(ribbonX + ribbonW + 2, ribbonTopY - ribbonH)
              .LineTo(ribbonX + 8, ribbonTopY - ribbonH)
              .ClosePathFillStroke();

        canvas.RestoreState();

        // Medal doirasi
        float cx = W / 2f;
        float cy = H - 135f;
        float r = 30f;

        // Tashqi halqa (oltin)
        canvas.SaveState()
              .SetFillColor(Gold)
              .Circle(cx, cy, r)
              .Fill()
              .RestoreState();

        // Ichki halqa (qorong'i oltin)
        canvas.SaveState()
              .SetFillColor(NavyLight)
              .Circle(cx, cy, r - 5f)
              .Fill()
              .RestoreState();

        // Markaziy yulduz nuqtasi
        canvas.SaveState()
              .SetFillColor(Gold)
              .Circle(cx, cy, 12f)
              .Fill()
              .RestoreState();

        // Yulduz nurlari
        DrawStarRays(canvas, cx, cy, 8f, 22f, 8);
    }

    private static void DrawStarRays(PdfCanvas canvas, float cx, float cy, float innerR, float outerR, int points)
    {
        canvas.SaveState().SetFillColor(Gold);

        double step = Math.PI / points;
        var pathStarted = false;
        for (int i = 0; i < points * 2; i++)
        {
            double angle = i * step - Math.PI / 2;
            float r = (i % 2 == 0) ? outerR : innerR;
            float x = cx + (float)(r * Math.Cos(angle));
            float y = cy + (float)(r * Math.Sin(angle));
            if (!pathStarted) { canvas.MoveTo(x, y); pathStarted = true; }
            else canvas.LineTo(x, y);
        }
        canvas.ClosePath().Fill().RestoreState();
    }

    private static void DrawTitle(PdfCanvas canvas, PdfDocument pdfDoc)
    {
        var font = PdfFontFactory.CreateFont(StandardFonts.TIMES_BOLD);
        float y = H - 195f;

        // "SERTIFIKAT" sarlavha oq rangda
        using var doc = new Document(pdfDoc);
        var title = new Paragraph("SERTIFIKAT")
            .SetFont(font)
            .SetFontSize(52f)
            .SetFontColor(White)
            .SetCharacterSpacing(8f)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFixedPosition(0, y, W);
        doc.Add(title);
    }

    private static void DrawAwardedTo(PdfCanvas canvas, PdfDocument pdfDoc)
    {
        var font = PdfFontFactory.CreateFont(StandardFonts.TIMES_ITALIC);
        float y = H - 235f;

        using var doc = new Document(pdfDoc);
        var text = new Paragraph("Faxriyat bilan taqdim etilmoqda:")
            .SetFont(font)
            .SetFontSize(13f)
            .SetFontColor(Gray)
            .SetCharacterSpacing(1.5f)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFixedPosition(0, y, W);
        doc.Add(text);
    }

    private static void DrawStudentName(PdfCanvas canvas, PdfDocument pdfDoc, string studentName)
    {
        var font = PdfFontFactory.CreateFont(StandardFonts.TIMES_BOLDITALIC);
        float y = H - 280f;
        float nameW = 520f;
        float nameX = (W - nameW) / 2f;

        // O'quvchi ismi oltin rangda — catakka katta shrift
        using var doc = new Document(pdfDoc);
        var name = new Paragraph(studentName)
            .SetFont(font)
            .SetFontSize(38f)
            .SetFontColor(Gold)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFixedPosition(nameX, y, nameW);
        doc.Add(name);

        // Tagida chiziq (gorizontal chiziqlar ismi ikki yonida)
        float lineY = y - 2f;
        float lineLen = 160f;
        float gap = 15f;

        canvas.SaveState()
              .SetStrokeColor(Gold)
              .SetLineWidth(1.2f);

        // Chap chiziq
        canvas.MoveTo(nameX - gap - lineLen, lineY)
              .LineTo(nameX - gap, lineY)
              .Stroke();

        // O'ng chiziq
        canvas.MoveTo(nameX + nameW + gap, lineY)
              .LineTo(nameX + nameW + gap + lineLen, lineY)
              .Stroke();

        canvas.RestoreState();
    }

    private static void DrawCourseDescription(PdfCanvas canvas, PdfDocument pdfDoc, string courseName)
    {
        var font = PdfFontFactory.CreateFont(StandardFonts.TIMES_ITALIC);
        float y = H - 320f;

        using var doc = new Document(pdfDoc);
        var text = new Paragraph($"{courseName} kursini muvaffaqiyatli yakunladi.")
            .SetFont(font)
            .SetFontSize(15f)
            .SetFontColor(White)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFixedPosition(0, y, W);
        doc.Add(text);
    }

    private static void DrawSignatureSection(PdfCanvas canvas, PdfDocument pdfDoc, string teacherName, DateTime issueDate)
    {
        var boldFont = PdfFontFactory.CreateFont(StandardFonts.TIMES_BOLD);
        var normalFont = PdfFontFactory.CreateFont(StandardFonts.TIMES_ROMAN);

        float sigY = H - 390f;
        float lineLen = 140f;
        float labelY = sigY - 18f;
        float titleY = sigY - 34f;

        // Uch imzo blok: Manager | Sana | O'qituvchi
        float managerX = W * 0.18f;
        float dateX = W * 0.5f;
        float teacherX = W * 0.78f;

        var signPositions = new[]
        {
            (managerX, "________________________", "Markazboshining imzosi", "Manager"),
            (dateX, FormatDateUz(issueDate), "Tugatilgan sana", ""),
            (teacherX, teacherName, teacherName.Length > 20 ? "" : "O'qituvchi", ""),
        };

        canvas.SaveState().SetStrokeColor(Gold).SetLineWidth(1f);

        using var doc = new Document(pdfDoc);

        foreach (var (cx, value, label, subtitle) in signPositions)
        {
            float left = cx - lineLen / 2f;

            // Gorizontal chiziq
            canvas.MoveTo(left, sigY).LineTo(left + lineLen, sigY).Stroke();

            // Qiymat (imzo nomi yoki sana)
            var valPara = new Paragraph(value)
                .SetFont(normalFont)
                .SetFontSize(10f)
                .SetFontColor(White)
                .SetTextAlignment(TextAlignment.CENTER)
                .SetFixedPosition(left, labelY, lineLen);
            doc.Add(valPara);

            // Yorliq
            if (!string.IsNullOrEmpty(label))
            {
                var lblPara = new Paragraph(label)
                    .SetFont(boldFont)
                    .SetFontSize(9f)
                    .SetFontColor(Gray)
                    .SetTextAlignment(TextAlignment.CENTER)
                    .SetFixedPosition(left, titleY, lineLen);
                doc.Add(lblPara);
            }
        }

        canvas.RestoreState();
    }

    private static void DrawQrAndCertNumber(PdfCanvas canvas, PdfDocument pdfDoc, string certNumber, string verifyUrl)
    {
        // QR kod pastki o'ngda
        float qrSize = 65f;
        float qrX = W - qrSize - 28f;
        float qrY = 22f;

        try
        {
            var qrBase64 = GenerateQrCode(verifyUrl);
            var qrBytes = Convert.FromBase64String(qrBase64);

            var imgData = iText.IO.Image.ImageDataFactory.Create(qrBytes);

            // Oq fon QR atrofida
            canvas.SaveState()
                  .SetFillColor(White)
                  .Rectangle(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6)
                  .Fill()
                  .RestoreState();

            canvas.AddImageFittedIntoRectangle(imgData, new Rectangle(qrX, qrY, qrSize, qrSize), false);
        }
        catch
        {
            // QR generatsiya muvaffaqiyatsiz bo'lsa o'tkazib yuborish
        }

        // Sertifikat raqami (pastda chapda)
        var monoFont = PdfFontFactory.CreateFont(StandardFonts.COURIER);
        float certY = 32f;

        using var doc = new Document(pdfDoc);
        var certPara = new Paragraph($"Sertifikat: {certNumber}")
            .SetFont(monoFont)
            .SetFontSize(8f)
            .SetFontColor(Gray)
            .SetFixedPosition(28f, certY + 12f, 300f);
        doc.Add(certPara);

        var verifyPara = new Paragraph($"Tekshirish: crm.intellectschool.uz/verify-certificate")
            .SetFont(monoFont)
            .SetFontSize(7.5f)
            .SetFontColor(Gray)
            .SetFixedPosition(28f, certY, 300f);
        doc.Add(verifyPara);
    }

    private static void DrawCenterName(PdfCanvas canvas, PdfDocument pdfDoc)
    {
        // Markaziy nom — pastda markazda, kichik harflarda
        var font = PdfFontFactory.CreateFont(StandardFonts.TIMES_ROMAN);

        using var doc = new Document(pdfDoc);
        var centerPara = new Paragraph("Intellect Kokand o'quv markazi")
            .SetFont(font)
            .SetFontSize(10f)
            .SetFontColor(Gray)
            .SetCharacterSpacing(1f)
            .SetTextAlignment(TextAlignment.CENTER)
            .SetFixedPosition(0, 18f, W);
        doc.Add(centerPara);
    }

    private static void DrawDecorativeLines(PdfCanvas canvas)
    {
        // Yuqori bezak chiziqlari (banner ostida)
        float lineY1 = H - 90f;
        float lineY2 = H - 95f;
        float marginX = 55f;

        canvas.SaveState()
              .SetStrokeColor(Gold)
              .SetLineWidth(0.8f);

        canvas.MoveTo(marginX, lineY1)
              .LineTo(W - marginX, lineY1)
              .Stroke();

        canvas.SetLineWidth(0.3f);
        canvas.MoveTo(marginX, lineY2)
              .LineTo(W - marginX, lineY2)
              .Stroke();

        // Pastki bezak chiziqlari
        float btmY1 = 58f;
        float btmY2 = 63f;
        canvas.SetLineWidth(0.8f);
        canvas.MoveTo(marginX, btmY1)
              .LineTo(W * 0.55f, btmY1)
              .Stroke();

        canvas.SetLineWidth(0.3f);
        canvas.MoveTo(marginX, btmY2)
              .LineTo(W * 0.55f, btmY2)
              .Stroke();

        canvas.RestoreState();
    }

    // ─────────────────────────────────────────────────────────────
    // Yordamchilar (ommaviy — mavjud API bilan muvofiq)
    // ─────────────────────────────────────────────────────────────

    /// <summary>SHA-256 hash (lowercase hex).</summary>
    public static string ComputeSHA256(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>Noyob sertifikat raqami: CERT-yyyy-MM-dd-NNNN.</summary>
    public static string GenerateCertificateNumber()
    {
        var datePart = AppClock.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var suffix = (AppClock.Now.Millisecond + AppClock.Now.Second * 1000) % 10000;
        return $"CERT-{datePart}-{suffix:D4}";
    }

    /// <summary>QR-kod yaratadi va Base64 PNG qaytaradi.</summary>
    public static string GenerateQrCode(string content)
    {
        using var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(3);
        return Convert.ToBase64String(pngBytes);
    }

    /// <summary>Sertifikat andozasi uchun token almashtirish (HTML andoza uchun).</summary>
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

    /// <summary>HTML maxsus belgilarni encode qiladi.</summary>
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

    private static string FormatDateUz(DateTime d) =>
        $"{d.Day} {UzMonths[d.Month - 1]} {d.Year}-yil";

    private string GetCertificatesDirectory()
    {
        var webRoot = env is IWebHostEnvironment webEnv
            ? webEnv.WebRootPath
            : env.ContentRootPath;
        var dir = System.IO.Path.Combine(webRoot ?? env.ContentRootPath, "uploads", "certificates");
        System.IO.Directory.CreateDirectory(dir);
        return dir;
    }

    private string ResolveAbsolutePath(string filePath)
    {
        var webRoot = env is IWebHostEnvironment webEnv
            ? webEnv.WebRootPath
            : env.ContentRootPath;
        return System.IO.Path.Combine(webRoot ?? env.ContentRootPath, filePath.TrimStart('/'));
    }
}
