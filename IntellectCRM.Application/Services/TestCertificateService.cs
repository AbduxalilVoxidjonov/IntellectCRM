using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace IntellectCRM.Application.Services;

/// <summary>
/// TEST SERTIFIKATI — Word andozasini o'quvchi natijasi bilan to'ldirib PDF ga o'giradi.
///
/// <para>Oqim: <c>TestResult.CertificateEnabled</c> yoqilgan testda natijalar saqlanganda
/// (o'qituvchi/admin "Saqlash va sertifikat yaratish" bosadi) ball kiritilgan HAR bir o'quvchiga
/// bitta sertifikat yaratiladi. Andoza — <see cref="TestCertificateTemplate"/> (.docx), tokenlar
/// <see cref="DocxTemplate"/> sintaksisida (<c>@fish</c>, <c>@ball</c>, ...).</para>
///
/// <para><b>Idempotent:</b> kalit (test, o'quvchi) — qayta yaratilsa mavjud yozuv YANGILANADI va
/// eski fayllar o'chiriladi. Ya'ni "Saqlash"ni bir necha marta bosish nusxa yaratmaydi.</para>
///
/// <para><b>PDF bo'lmasa ham ishlaydi:</b> LibreOffice topilmasa <c>Status="docx"</c> bilan faqat
/// Word fayl saqlanadi — foydalanuvchi uni qo'lda PDF qiladi. Sertifikat yaratish TO'XTAMAYDI.</para>
/// </summary>
public class TestCertificateService(IHostEnvironment env, DocxToPdfConverter pdf)
{
    /// <summary>Faqat Word andozalari (boshqa format render qilinmaydi).</summary>
    public const string TemplateExtension = ".docx";

    public const string StatusReady = "ready";
    public const string StatusDocxOnly = "docx";

    /// <summary>
    /// ANDOZADA ISHLATILADIGAN O'ZGARUVCHILAR — <b>yagona manba</b>. Backend shu ro'yxat bo'yicha
    /// qiymat qo'yadi, admin paneli esa AYNAN shu ro'yxatni ko'rsatadi (ikkovi ajralib ketmasin).
    /// </summary>
    public static readonly IReadOnlyList<CertificateTokenDto> Tokens =
    [
        new("@fish", "O'quvchining F.I.Sh", "Valiyev Ali"),
        new("@guruh", "Guruh nomi", "Ingliz tili A1-2"),
        new("@kurs", "Kurs (fan) nomi", "Ingliz tili"),
        new("@oqituvchi", "Guruh o'qituvchisi", "Karimova Nodira"),
        new("@test", "Test nomi", "Unit 3 test"),
        new("@ball", "O'quvchi olgan ball", "85"),
        new("@maksball", "Maksimal ball", "100"),
        new("@foiz", "Foiz (%)", "85"),
        new("@orin", "Guruhdagi o'rni", "2"),
        new("@sana", "Test o'tkazilgan sana", "04.08.2026"),
        new("@bugun", "Sertifikat berilgan sana", "04.08.2026"),
        new("@raqam", "Sertifikat raqami", "SRT-2026-0042"),
    ];

    // =============================================================================================
    //  ANDOZALAR
    // =============================================================================================

    public async Task<List<TestCertificateTemplateDto>> ListTemplatesAsync(
        IAppDbContext db, bool includeInactive = true, CancellationToken ct = default)
    {
        var q = db.TestCertificateTemplates.AsNoTracking();
        if (!includeInactive) q = q.Where(t => t.IsActive);
        var rows = await q.OrderByDescending(t => t.IsDefault).ThenBy(t => t.Name).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<(TestCertificateTemplateDto? Dto, string? Error)> CreateTemplateAsync(
        IAppDbContext db, TestCertificateTemplatePayload payload, string actor, CancellationToken ct = default)
    {
        var name = (payload.Name ?? "").Trim();
        if (name.Length == 0) return (null, "Shablon nomini kiriting");
        var fileUrl = (payload.FileUrl ?? "").Trim();
        if (!fileUrl.EndsWith(TemplateExtension, StringComparison.OrdinalIgnoreCase))
            return (null, "Faqat Word (.docx) fayl yuklanadi");
        if (ResolveUpload(fileUrl) is null) return (null, "Yuklangan fayl topilmadi");

        var row = new TestCertificateTemplate
        {
            Name = name,
            FileUrl = fileUrl,
            FileName = (payload.FileName ?? "").Trim(),
            IsActive = true,
            CreatedBy = actor,
        };
        db.TestCertificateTemplates.Add(row);
        // Birinchi shablon avtomatik STANDART bo'ladi — aks holda test formasida "shablon tanlanmagan"
        // holati paydo bo'lib, sertifikat jimgina yaratilmay qolardi.
        var isFirst = !await db.TestCertificateTemplates.AnyAsync(ct);
        if (payload.IsDefault || isFirst) await MakeDefaultAsync(db, row, ct);
        await db.SaveChangesAsync(ct);
        return (ToDto(row), null);
    }

    public async Task<(TestCertificateTemplateDto? Dto, string? Error)> UpdateTemplateAsync(
        IAppDbContext db, string id, TestCertificateTemplatePayload payload, CancellationToken ct = default)
    {
        var row = await db.TestCertificateTemplates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (row is null) return (null, "Shablon topilmadi");

        var name = (payload.Name ?? "").Trim();
        if (name.Length == 0) return (null, "Shablon nomini kiriting");
        row.Name = name;
        row.IsActive = payload.IsActive;

        // Fayl almashtirilsa — eskisi o'chiriladi (ombor shishmasin).
        var fileUrl = (payload.FileUrl ?? "").Trim();
        if (fileUrl.Length > 0 && fileUrl != row.FileUrl)
        {
            if (!fileUrl.EndsWith(TemplateExtension, StringComparison.OrdinalIgnoreCase))
                return (null, "Faqat Word (.docx) fayl yuklanadi");
            if (ResolveUpload(fileUrl) is null) return (null, "Yuklangan fayl topilmadi");
            DeleteUpload(row.FileUrl);
            row.FileUrl = fileUrl;
            row.FileName = (payload.FileName ?? "").Trim();
        }

        if (payload.IsDefault) await MakeDefaultAsync(db, row, ct);
        // Nofaol shablon standart bo'lib qolmasin.
        else if (!row.IsActive) row.IsDefault = false;

        await db.SaveChangesAsync(ct);
        return (ToDto(row), null);
    }

    public async Task<string?> DeleteTemplateAsync(IAppDbContext db, string id, CancellationToken ct = default)
    {
        var row = await db.TestCertificateTemplates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (row is null) return "Shablon topilmadi";
        // Shablondan sertifikat berilgan bo'lsa — o'chirmaymiz (tarix buzilmasin), nofaol qilinadi.
        if (await db.TestCertificates.AnyAsync(c => c.TemplateId == id, ct))
            return "Bu shablon bo'yicha sertifikatlar berilgan — o'chirib bo'lmaydi. Uni \"nofaol\" qiling.";

        DeleteUpload(row.FileUrl);
        db.TestCertificateTemplates.Remove(row);
        await db.SaveChangesAsync(ct);
        return null;
    }

    /// <summary>Shu shablonni standart qiladi, qolganlaridan belgini oladi (bitta standart bo'lsin).</summary>
    private static async Task MakeDefaultAsync(IAppDbContext db, TestCertificateTemplate row, CancellationToken ct)
    {
        var others = await db.TestCertificateTemplates.Where(t => t.IsDefault).ToListAsync(ct);
        foreach (var o in others) o.IsDefault = false;
        row.IsDefault = true;
        row.IsActive = true;
    }

    // =============================================================================================
    //  SERTIFIKAT YARATISH
    // =============================================================================================

    /// <summary>
    /// Test bo'yicha BALL KIRITILGAN barcha o'quvchiga sertifikat yaratadi (mavjudi yangilanadi).
    /// </summary>
    /// <returns>Yaratilgan sertifikatlar; xato bo'lsa <c>Error</c> to'ldiriladi va ro'yxat bo'sh.</returns>
    public async Task<(List<TestCertificateDto> Items, string? Error)> GenerateForTestAsync(
        IAppDbContext db, string testId, string actor, CancellationToken ct = default)
    {
        var test = await db.TestResults.FirstOrDefaultAsync(t => t.Id == testId, ct);
        if (test is null) return ([], "Test topilmadi");
        if (!test.CertificateEnabled)
            return ([], "Bu testda sertifikat berish yoqilmagan (test sozlamasidagi ptichkani belgilang)");

        var template = await ResolveTemplateAsync(db, test.CertificateTemplateId, ct);
        if (template is null)
            return ([], "Sertifikat shabloni topilmadi. \"Testlar natijalari → Sertifikat shablonlari\" bo'limida Word shablon yuklang.");
        var templatePath = ResolveUpload(template.FileUrl);
        if (templatePath is null)
            return ([], $"\"{template.Name}\" shablonining fayli topilmadi (qayta yuklang)");
        var templateBytes = await File.ReadAllBytesAsync(templatePath, ct);

        var group = await db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == test.GroupId, ct);
        var courseName = group is null || string.IsNullOrEmpty(group.CourseId)
            ? ""
            : (await db.Subjects.AsNoTracking().FirstOrDefaultAsync(s => s.Id == group.CourseId, ct))?.Name ?? "";
        var teacherName = group is null || string.IsNullOrEmpty(group.TeacherId)
            ? ""
            : (await db.Teachers.AsNoTracking().FirstOrDefaultAsync(t => t.Id == group.TeacherId, ct))?.FullName ?? "";

        // Ball kiritilganlar (oflayn qo'lda ham, onlayn botdan ham — ikkalasi bir jadvalda).
        var scores = await db.TestScores.AsNoTracking()
            .Where(s => s.TestResultId == testId)
            .ToListAsync(ct);
        if (scores.Count == 0) return ([], "Hali birorta ball kiritilmagan");

        var studentIds = scores.Select(s => s.StudentId).Distinct().ToList();
        var students = await db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);

        // O'RIN — test tafsilotidagi bilan bir xil qoida (teng ball = teng o'rin, keyingisi tashlab ketiladi).
        var ordered = scores.OrderByDescending(s => s.Score).ToList();
        var rankOf = new Dictionary<string, int>();
        decimal? prev = null;
        var rank = 0;
        for (var i = 0; i < ordered.Count; i++)
        {
            if (prev is null || ordered[i].Score != prev) rank = i + 1;
            rankOf[ordered[i].StudentId] = rank;
            prev = ordered[i].Score;
        }

        var existing = await db.TestCertificates.Where(c => c.TestResultId == testId).ToListAsync(ct);
        var seq = await NextNumberSeedAsync(db, ct);
        var result = new List<TestCertificate>();

        foreach (var s in ordered)
        {
            ct.ThrowIfCancellationRequested();
            var fullName = students.GetValueOrDefault(s.StudentId) ?? "";
            if (fullName.Length == 0) continue;   // o'quvchi o'chirilgan — sertifikat berilmaydi

            var percent = test.MaxScore > 0 ? (int)Math.Round(s.Score / test.MaxScore * 100m) : 0;
            var row = existing.FirstOrDefault(c => c.StudentId == s.StudentId);
            var number = row?.Number is { Length: > 0 } n ? n : $"SRT-{AppClock.Today:yyyy}-{seq++:D4}";

            var tokens = new Dictionary<string, string>
            {
                ["@fish"] = fullName,
                ["@guruh"] = group?.Name ?? "",
                ["@kurs"] = courseName,
                ["@oqituvchi"] = teacherName,
                ["@test"] = test.Name,
                ["@ball"] = Num(s.Score),
                ["@maksball"] = Num(test.MaxScore),
                ["@foiz"] = percent.ToString(),
                ["@orin"] = rankOf.GetValueOrDefault(s.StudentId, 0).ToString(),
                ["@sana"] = FormatDate(test.Date),
                ["@bugun"] = AppClock.Today.ToString("dd.MM.yyyy"),
                ["@raqam"] = number,
            };

            var filled = DocxTemplate.Fill(templateBytes, tokens);
            var pdfBytes = await pdf.ConvertAsync(filled, ct);

            // Qayta yaratishda eski fayllar o'chiriladi (ombor shishmasin).
            if (row is not null) { DeleteCertFile(row.DocxUrl); DeleteCertFile(row.PdfUrl); }

            var baseName = $"cert-{Guid.NewGuid():N}";
            var docxUrl = await SaveCertFileAsync(baseName + ".docx", filled, ct);
            var pdfUrl = pdfBytes is null ? "" : await SaveCertFileAsync(baseName + ".pdf", pdfBytes, ct);

            if (row is null)
            {
                row = new TestCertificate { TestResultId = testId, StudentId = s.StudentId };
                db.TestCertificates.Add(row);
                existing.Add(row);
            }
            row.StudentName = fullName;
            row.TemplateId = template.Id;
            row.TemplateName = template.Name;
            row.Number = number;
            row.DocxUrl = docxUrl;
            row.PdfUrl = pdfUrl;
            row.Status = pdfBytes is null ? StatusDocxOnly : StatusReady;
            row.Score = s.Score;
            row.MaxScore = test.MaxScore;
            row.Percent = percent;
            row.IssuedAt = AppClock.Now;
            row.CreatedBy = actor;
            result.Add(row);
        }

        await db.SaveChangesAsync(ct);
        return (result.Select(ToDto).ToList(), null);
    }

    /// <summary>Test bo'yicha berilgan sertifikatlar (o'rin bo'yicha emas — ball kamayishi bo'yicha).</summary>
    public static async Task<List<TestCertificateDto>> ListForTestAsync(
        IAppDbContext db, string testId, CancellationToken ct = default)
    {
        // Saralash XOTIRADA: SQLite (testlar) `decimal` bo'yicha ORDER BY ni qo'llamaydi,
        // qatorlar soni esa bitta testdagi o'quvchilar soni — kichik.
        var rows = await db.TestCertificates.AsNoTracking()
            .Where(c => c.TestResultId == testId)
            .ToListAsync(ct);
        return rows
            .OrderByDescending(c => c.Score).ThenBy(c => c.StudentName, StringComparer.OrdinalIgnoreCase)
            .Select(ToDto).ToList();
    }

    /// <summary>
    /// Yuklab olish uchun fayl. <paramref name="preferPdf"/> — PDF bo'lsa PDF, aks holda .docx.
    /// Fayl nomi o'quvchi ismi bilan beriladi ("Sertifikat - Valiyev Ali.pdf").
    /// </summary>
    public async Task<(byte[] Bytes, string FileName, string ContentType)?> ReadFileAsync(
        IAppDbContext db, string certificateId, bool preferPdf = true, CancellationToken ct = default)
    {
        var row = await db.TestCertificates.AsNoTracking().FirstOrDefaultAsync(c => c.Id == certificateId, ct);
        if (row is null) return null;

        var usePdf = preferPdf && row.PdfUrl.Length > 0;
        var url = usePdf ? row.PdfUrl : row.DocxUrl;
        var path = ResolveCertFile(url);
        if (path is null) return null;

        var safeName = string.Join("_", (row.StudentName.Length > 0 ? row.StudentName : row.Number)
            .Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        return (await File.ReadAllBytesAsync(path, ct),
            $"Sertifikat - {safeName}{(usePdf ? ".pdf" : ".docx")}",
            usePdf ? "application/pdf"
                   : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    /// <summary>Test bo'yicha barcha sertifikatlar — bitta ZIP (PDF bo'lsa PDF, bo'lmasa .docx).</summary>
    public async Task<(byte[] Bytes, string FileName)?> ZipForTestAsync(
        IAppDbContext db, string testId, CancellationToken ct = default)
    {
        var rows = (await db.TestCertificates.AsNoTracking()
                .Where(c => c.TestResultId == testId).ToListAsync(ct))
            .OrderByDescending(c => c.Score).ToList();   // saralash xotirada (SQLite decimal cheklovi)
        if (rows.Count == 0) return null;

        var testName = (await db.TestResults.AsNoTracking()
            .Where(t => t.Id == testId).Select(t => t.Name).FirstOrDefaultAsync(ct)) ?? "test";

        using var ms = new MemoryStream();
        using (var zip = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Create, true))
        {
            var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in rows)
            {
                var usePdf = r.PdfUrl.Length > 0;
                var path = ResolveCertFile(usePdf ? r.PdfUrl : r.DocxUrl);
                if (path is null) continue;

                var safe = string.Join("_", (r.StudentName.Length > 0 ? r.StudentName : r.Number)
                    .Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
                var name = $"{safe}{(usePdf ? ".pdf" : ".docx")}";
                // Bir xil ismli ikki o'quvchi bo'lsa ZIP ichida nom to'qnashmasin.
                for (var i = 2; !used.Add(name); i++) name = $"{safe} ({i}){(usePdf ? ".pdf" : ".docx")}";

                var entry = zip.CreateEntry(name, System.IO.Compression.CompressionLevel.Fastest);
                await using var es = entry.Open();
                await using var fs = File.OpenRead(path);
                await fs.CopyToAsync(es, ct);
            }
        }
        var zipName = string.Join("_", $"Sertifikatlar - {testName}"
            .Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        return (ms.ToArray(), zipName + ".zip");
    }

    // =============================================================================================
    //  Yordamchilar
    // =============================================================================================

    private static async Task<TestCertificateTemplate?> ResolveTemplateAsync(
        IAppDbContext db, string? templateId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(templateId))
        {
            var chosen = await db.TestCertificateTemplates.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == templateId, ct);
            if (chosen is not null) return chosen;
        }
        // Tanlanmagan yoki o'chirilgan — standart, u ham bo'lmasa birinchi faol shablon.
        return await db.TestCertificateTemplates.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderByDescending(t => t.IsDefault).ThenBy(t => t.Name)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>Joriy yildagi keyingi tartib raqami (SRT-yyyy-NNNN).</summary>
    private static async Task<int> NextNumberSeedAsync(IAppDbContext db, CancellationToken ct)
    {
        var prefix = $"SRT-{AppClock.Today:yyyy}-";
        var last = await db.TestCertificates.AsNoTracking()
            .Where(c => c.Number.StartsWith(prefix))
            .OrderByDescending(c => c.Number)
            .Select(c => c.Number)
            .FirstOrDefaultAsync(ct);
        if (last is null) return 1;
        return int.TryParse(last[prefix.Length..], out var n) ? n + 1 : 1;
    }

    /// <summary>"1234.50" emas, "1234.5"/"1234" — sertifikatda ortiqcha nol chiqmasin.</summary>
    private static string Num(decimal v) =>
        v == Math.Floor(v) ? ((long)v).ToString() : v.ToString("0.##");

    /// <summary>"2026-08-04" → "04.08.2026" (noto'g'ri format bo'lsa o'z holicha).</summary>
    private static string FormatDate(string? iso) =>
        DateTime.TryParse(iso, out var d) ? d.ToString("dd.MM.yyyy") : (iso ?? "");

    private static TestCertificateTemplateDto ToDto(TestCertificateTemplate t) =>
        new(t.Id, t.Name, t.FileUrl, t.FileName, t.IsDefault, t.IsActive,
            t.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"), t.CreatedBy);

    private static TestCertificateDto ToDto(TestCertificate c) =>
        new(c.Id, c.TestResultId, c.StudentId, c.StudentName, c.Number, c.TemplateName,
            c.DocxUrl, c.PdfUrl, c.Status, c.Score, c.MaxScore, c.Percent,
            c.IssuedAt.ToString("yyyy-MM-ddTHH:mm:ss"));

    // ---- Fayl yo'llari -------------------------------------------------------------------------
    // DIQQAT: `/uploads` Program.cs'da ContentRootPath/uploads dan beriladi (docker volume + zaxira).
    // Shuning uchun sertifikatlar ham SHU YERGA yoziladi — WebRootPath (wwwroot) ga EMAS: u Docker'da
    // har deployda qayta yoziladi va zaxiraga kirmaydi (eski HTML sertifikatlardagi xato shu edi).

    private string UploadsDir => Path.Combine(env.ContentRootPath, "uploads");
    private string CertificatesDir => Path.Combine(UploadsDir, "certificates");

    /// <summary>"/uploads/xxx.docx" → diskdagi yo'l. Manzildan FAQAT fayl nomi olinadi
    /// (papkadan chiqib ketish mumkin emas).</summary>
    private string? ResolveUpload(string? fileUrl)
    {
        var name = Path.GetFileName(fileUrl ?? "");
        if (string.IsNullOrEmpty(name)) return null;
        var path = Path.Combine(UploadsDir, name);
        return File.Exists(path) ? path : null;
    }

    private string? ResolveCertFile(string? fileUrl)
    {
        var name = Path.GetFileName(fileUrl ?? "");
        if (string.IsNullOrEmpty(name)) return null;
        var path = Path.Combine(CertificatesDir, name);
        return File.Exists(path) ? path : null;
    }

    private async Task<string> SaveCertFileAsync(string fileName, byte[] bytes, CancellationToken ct)
    {
        Directory.CreateDirectory(CertificatesDir);
        await File.WriteAllBytesAsync(Path.Combine(CertificatesDir, fileName), bytes, ct);
        return "/uploads/certificates/" + fileName;
    }

    private void DeleteCertFile(string? fileUrl)
    {
        var path = ResolveCertFile(fileUrl);
        if (path is null) return;
        try { File.Delete(path); } catch { /* band/yo'q — yozuvni yangilashga to'sqinlik qilmasin */ }
    }

    private void DeleteUpload(string? fileUrl)
    {
        var path = ResolveUpload(fileUrl);
        if (path is null) return;
        try { File.Delete(path); } catch { /* yuqoridagi bilan bir xil siyosat */ }
    }
}
