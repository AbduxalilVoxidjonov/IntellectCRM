using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// TEST SERTIFIKATI — Word andozasidan sertifikat yaratish
/// (<see cref="TestCertificateService"/> + <see cref="DocxTemplate"/>).
///
/// <para>PDF konvertatsiyasi (LibreOffice) test muhitida BO'LMASLIGI mumkin — shuning uchun
/// testlar "PDF yo'q" holatini ham kutadi: sertifikat baribir yaratiladi, faqat
/// <c>Status="docx"</c> bo'ladi. Bu ataylab: server LibreOfficesiz ham ishlashi kerak.</para>
/// </summary>
public class TestCertificateTests : IDisposable
{
    private sealed class FakeEnv(string root) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "IntellectCRM.Tests";
        public string ContentRootPath { get; set; } = root;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private readonly string _root = Path.Combine(
        Path.GetTempPath(), "intellect-testcert", Guid.NewGuid().ToString("N"));

    public TestCertificateTests() => Directory.CreateDirectory(Path.Combine(_root, "uploads"));

    public void Dispose()
    {
        try { if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true); }
        catch { /* tozalash xatosi natijaga ta'sir qilmasin */ }
    }

    private TestCertificateService Service() =>
        new(new FakeEnv(_root), new DocxToPdfConverter(NullLogger<DocxToPdfConverter>.Instance));

    // =============================================================================================
    //  Yordamchilar — soxta .docx andoza
    // =============================================================================================

    /// <summary>Berilgan paragraflardan .docx yasaydi (har paragraf — bitta run).</summary>
    private static byte[] MakeDocx(params string[] paragraphs)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            var body = new Body();
            foreach (var p in paragraphs)
                body.Append(new Paragraph(new Run(new Text(p) { Space = SpaceProcessingModeValues.Preserve })));
            main.Document = new Document(body);
            main.Document.Save();
        }
        return ms.ToArray();
    }

    /// <summary>Bitta paragrafni bir NECHTA runga bo'lib yozadi — Word real hayotda shunday qiladi
    /// (imlo/formatlash sabab), va aynan shu holat oddiy Replace'ni ishlatmay qo'yadi.</summary>
    private static byte[] MakeDocxSplitRuns(params string[] pieces)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            var para = new Paragraph();
            foreach (var piece in pieces)
                para.Append(new Run(new Text(piece) { Space = SpaceProcessingModeValues.Preserve }));
            main.Document = new Document(new Body(para));
            main.Document.Save();
        }
        return ms.ToArray();
    }

    private static string ReadText(byte[] docx)
    {
        using var ms = new MemoryStream(docx);
        using var doc = WordprocessingDocument.Open(ms, false);
        return string.Concat(doc.MainDocumentPart!.Document.Descendants<Text>().Select(t => t.Text));
    }

    /// <summary>Diskka andoza yozadi va "/uploads/..." manzilini qaytaradi.</summary>
    private string WriteTemplateFile(byte[] bytes)
    {
        var name = $"tpl-{Guid.NewGuid():N}.docx";
        File.WriteAllBytes(Path.Combine(_root, "uploads", name), bytes);
        return "/uploads/" + name;
    }

    // =============================================================================================
    //  1) SOF MANTIQ — token almashtirish
    // =============================================================================================

    [Fact]
    public void Apply_TokenlarniAlmashtiradi_NomalumlariniQoldiradi()
    {
        var tokens = new Dictionary<string, string> { ["@fish"] = "Ali Valiyev", ["@ball"] = "85" };

        Assert.Equal("Ali Valiyev — 85 ball", DocxTemplate.Apply("@fish — @ball ball", tokens));
        // Noma'lum token O'Z HOLICHA qoladi — andoza muallifi xatoni ko'rsin (jimgina o'chmasin).
        Assert.Equal("@yoq", DocxTemplate.Apply("@yoq", tokens));
    }

    [Fact]
    public void Apply_RaqamliMatnTokenDebOqilmaydi()
    {
        // "@2026" token emas (regex faqat harf/pastki chiziq) — sanalar buzilmasin.
        Assert.Equal("@2026", DocxTemplate.Apply("@2026", new Dictionary<string, string>()));
    }

    [Fact]
    public void Fill_BolinganRUNlardagiTokenniHamAlmashtiradi()
    {
        // Word "@fish" ni "@fi" + "sh" qilib bo'lib yozgan — paragraf darajasidagi almashtirish shart.
        var docx = MakeDocxSplitRuns("Hurmatli ", "@fi", "sh", ", tabriklaymiz!");
        var filled = DocxTemplate.Fill(docx, new Dictionary<string, string> { ["@fish"] = "Ali Valiyev" });

        Assert.Equal("Hurmatli Ali Valiyev, tabriklaymiz!", ReadText(filled));
    }

    [Fact]
    public void FindTokens_TakrorlanmaydiganRoyxat()
    {
        var found = DocxTemplate.FindTokens("@fish @ball @fish");
        Assert.Equal(2, found.Count);
        Assert.Contains("@fish", found);
        Assert.Contains("@ball", found);
    }

    [Fact]
    public void Tokenlar_KatalogiBoshEmas_VaHammasiBirXilShaklda()
    {
        Assert.NotEmpty(TestCertificateService.Tokens);
        Assert.All(TestCertificateService.Tokens, t =>
        {
            Assert.StartsWith("@", t.Token);
            Assert.NotEmpty(t.Label);
        });
        // Takroriy token bo'lmasin (ikkita bir xil qator UI'da chalkashtirardi).
        Assert.Equal(TestCertificateService.Tokens.Count,
            TestCertificateService.Tokens.Select(t => t.Token).Distinct().Count());
    }

    // =============================================================================================
    //  2) BAZA — andozalar
    // =============================================================================================

    [Fact]
    public async Task Andoza_BirinchisiAvtomatikSTANDARTBoladi()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var url = WriteTemplateFile(MakeDocx("@fish"));

        var (dto, err) = await svc.CreateTemplateAsync(
            db.Context, new TestCertificateTemplatePayload("Birinchi", url, "a.docx"), "Admin");

        Assert.Null(err);
        Assert.True(dto!.IsDefault);   // birinchi shablon — hech kim tanlamasa ham ishlasin
    }

    [Fact]
    public async Task Andoza_YangiStandartQoyilsa_EskisidanBelgiOlinadi()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (a, _) = await svc.CreateTemplateAsync(db.Context,
            new TestCertificateTemplatePayload("A", WriteTemplateFile(MakeDocx("@fish")), "a.docx"), "Admin");
        var (b, _) = await svc.CreateTemplateAsync(db.Context,
            new TestCertificateTemplatePayload("B", WriteTemplateFile(MakeDocx("@fish")), "b.docx", IsDefault: true), "Admin");

        var list = await svc.ListTemplatesAsync(db.Context);
        Assert.False(list.Single(t => t.Id == a!.Id).IsDefault);
        Assert.True(list.Single(t => t.Id == b!.Id).IsDefault);
    }

    [Fact]
    public async Task Andoza_FaqatDocxQabulQilinadi()
    {
        using var db = TestDb.Sqlite();
        var (_, err) = await Service().CreateTemplateAsync(db.Context,
            new TestCertificateTemplatePayload("PDF andoza", "/uploads/x.pdf", "x.pdf"), "Admin");

        Assert.NotNull(err);
        Assert.Contains(".docx", err);
    }

    [Fact]
    public async Task Andoza_SertifikatBerilganBolsa_OCHIRILMAYDI()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var svc = Service();
        var (tpl, _) = await svc.CreateTemplateAsync(ctx,
            new TestCertificateTemplatePayload("A", WriteTemplateFile(MakeDocx("@fish")), "a.docx"), "Admin");
        // FK bor — sertifikat REAL testga bog'lanishi shart.
        var test = new TestResult { GroupId = "g1", Name = "T", Date = "2026-08-04", MaxScore = 10 };
        ctx.TestResults.Add(test);
        ctx.TestCertificates.Add(new TestCertificate { TestResultId = test.Id, StudentId = "s1", TemplateId = tpl!.Id });
        await ctx.SaveChangesAsync();

        var err = await svc.DeleteTemplateAsync(ctx, tpl.Id);

        Assert.NotNull(err);
        Assert.Contains("nofaol", err);
    }

    // =============================================================================================
    //  3) BAZA — sertifikat yaratish
    // =============================================================================================

    private async Task<(TestResult Test, Student A, Student B)> SeedTestAsync(
        TestDb db, TestCertificateService svc, bool certificateEnabled = true)
    {
        var ctx = db.Context;
        var course = new Subject { Name = "Ingliz tili" };
        var teacher = new Teacher { FullName = "Nodira Karimova" };
        var group = new Group { Name = "A1-2", CourseId = course.Id, TeacherId = teacher.Id };
        var a = new Student { FullName = "Ali Valiyev" };
        var b = new Student { FullName = "Vali Aliyev" };
        var test = new TestResult
        {
            GroupId = group.Id, Name = "Unit 3", Date = "2026-08-04", MaxScore = 100,
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
            CertificateEnabled = certificateEnabled,
        };
        ctx.Subjects.Add(course);
        ctx.Teachers.Add(teacher);
        ctx.Classes.Add(group);
        ctx.Students.AddRange(a, b);
        ctx.TestResults.Add(test);
        ctx.TestScores.AddRange(
            new TestScore { TestResultId = test.Id, StudentId = a.Id, Score = 90 },
            new TestScore { TestResultId = test.Id, StudentId = b.Id, Score = 70 });
        await ctx.SaveChangesAsync();

        await svc.CreateTemplateAsync(ctx, new TestCertificateTemplatePayload(
            "Standart", WriteTemplateFile(MakeDocx("@fish", "@ball / @maksball", "@foiz", "@orin", "@raqam", "@kurs")),
            "cert.docx"), "Admin");
        return (test, a, b);
    }

    [Fact]
    public async Task Yaratish_HarBallliOquvchigaBittadan_VaTokenlarQoyiladi()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, a, _) = await SeedTestAsync(db, svc);

        var (items, err) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");

        Assert.Null(err);
        Assert.Equal(2, items.Count);

        var top = items.Single(c => c.StudentId == a.Id);
        Assert.Equal("Ali Valiyev", top.StudentName);
        Assert.Equal(90, top.Score);
        Assert.Equal(90, top.Percent);
        Assert.StartsWith("SRT-", top.Number);
        Assert.NotEmpty(top.DocxUrl);

        // Word fayl haqiqatan yozilgan va tokenlar almashtirilgan.
        var path = Path.Combine(_root, "uploads", "certificates", Path.GetFileName(top.DocxUrl));
        Assert.True(File.Exists(path));
        var text = ReadText(await File.ReadAllBytesAsync(path));
        Assert.Contains("Ali Valiyev", text);
        Assert.Contains("90 / 100", text);      // @ball / @maksball — ortiqcha nol yo'q
        Assert.Contains("Ingliz tili", text);   // @kurs guruh kursidan olindi
        Assert.DoesNotContain("@fish", text);

        // LibreOffice bo'lmasa PDF bo'lmaydi, LEKIN sertifikat baribir yaratilgan.
        Assert.Equal(DocxToPdfConverter.IsAvailable
            ? TestCertificateService.StatusReady
            : TestCertificateService.StatusDocxOnly, top.Status);
    }

    [Fact]
    public async Task Yaratish_HarKIMOZFayliniOladi_INDEKSSILJIMAYDI()
    {
        // Fayllar bitta LibreOffice chaqiruvida TO'PLAM bo'lib konvertatsiya qilinadi
        // (ConvertManyAsync) — natijalar kirish TARTIBIGA qat'iy mos kelishi shart, aks holda
        // Ali'ning sertifikati Vali'ga tegib ketardi. Shu yerda aynan shuni tekshiramiz.
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, a, b) = await SeedTestAsync(db, svc);

        var (items, _) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");

        string TextOf(string studentId)
        {
            var c = items.Single(x => x.StudentId == studentId);
            var path = Path.Combine(_root, "uploads", "certificates", Path.GetFileName(c.DocxUrl));
            return ReadText(File.ReadAllBytes(path));
        }

        var aText = TextOf(a.Id);
        var bText = TextOf(b.Id);
        Assert.Contains("Ali Valiyev", aText);
        Assert.DoesNotContain("Vali Aliyev", aText);
        Assert.Contains("90 / 100", aText);
        Assert.Contains("Vali Aliyev", bText);
        Assert.Contains("70 / 100", bText);
        // Fayllar ham har xil bo'lishi kerak (bitta fayl ikki marta yozilib qolmasin).
        Assert.NotEqual(items.Single(x => x.StudentId == a.Id).DocxUrl,
                        items.Single(x => x.StudentId == b.Id).DocxUrl);
    }

    [Fact]
    public async Task Yaratish_IKKINCHIMartaNusxaYARATMAYDI()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, _, _) = await SeedTestAsync(db, svc);

        var (first, _) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");
        var (second, _) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");

        Assert.Equal(2, first.Count);
        Assert.Equal(2, second.Count);
        Assert.Equal(2, await db.Context.TestCertificates.CountAsync());
        // Raqam SAQLANADI — qayta yaratish sertifikat raqamini o'zgartirmasin.
        Assert.Equal(
            first.OrderBy(c => c.StudentId).Select(c => c.Number),
            second.OrderBy(c => c.StudentId).Select(c => c.Number));
    }

    [Fact]
    public async Task Yaratish_BallOZGARSA_SertifikatYANGILANADI()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var svc = Service();
        var (test, a, _) = await SeedTestAsync(db, svc);
        await svc.GenerateForTestAsync(ctx, test.Id, "Admin");

        var score = await ctx.TestScores.FirstAsync(s => s.StudentId == a.Id);
        score.Score = 50;
        await ctx.SaveChangesAsync();
        var (again, _) = await svc.GenerateForTestAsync(ctx, test.Id, "Admin");

        var cert = again.Single(c => c.StudentId == a.Id);
        Assert.Equal(50, cert.Score);
        Assert.Equal(50, cert.Percent);
    }

    [Fact]
    public async Task Yaratish_PtichkaBELGILANMAGAN_XatoQaytadi()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, _, _) = await SeedTestAsync(db, svc, certificateEnabled: false);

        var (items, err) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");

        Assert.Empty(items);
        Assert.NotNull(err);
        Assert.Contains("yoqilmagan", err);
    }

    [Fact]
    public async Task Yaratish_ANDOZAYOQ_TushunarliXato()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var group = new Group { Name = "A1" };
        var test = new TestResult
        {
            GroupId = group.Id, Name = "T", Date = "2026-08-04", MaxScore = 10,
            CertificateEnabled = true,
        };
        var st = new Student { FullName = "Ali" };
        ctx.Classes.Add(group);
        ctx.Students.Add(st);
        ctx.TestResults.Add(test);
        ctx.TestScores.Add(new TestScore { TestResultId = test.Id, StudentId = st.Id, Score = 8 });
        await ctx.SaveChangesAsync();

        var (_, err) = await Service().GenerateForTestAsync(ctx, test.Id, "Admin");

        Assert.NotNull(err);
        Assert.Contains("shablon", err, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Yaratish_BallYOQ_XatoQaytadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var svc = Service();
        var (test, _, _) = await SeedTestAsync(db, svc);
        ctx.TestScores.RemoveRange(await ctx.TestScores.ToListAsync());
        await ctx.SaveChangesAsync();

        var (_, err) = await svc.GenerateForTestAsync(ctx, test.Id, "Admin");

        Assert.NotNull(err);
        Assert.Contains("ball", err, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task YuklabOlish_FaylNomiOquvchiIsmiBilan()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, a, _) = await SeedTestAsync(db, svc);
        var (items, _) = await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");
        var cert = items.Single(c => c.StudentId == a.Id);

        var file = await svc.ReadFileAsync(db.Context, cert.Id);

        Assert.NotNull(file);
        Assert.Contains("Ali Valiyev", file!.Value.FileName);
        Assert.NotEmpty(file.Value.Bytes);
    }

    [Fact]
    public async Task ZIP_BarchaSertifikatlarniQadoqlaydi()
    {
        using var db = TestDb.Sqlite();
        var svc = Service();
        var (test, _, _) = await SeedTestAsync(db, svc);
        await svc.GenerateForTestAsync(db.Context, test.Id, "Admin");

        var zip = await svc.ZipForTestAsync(db.Context, test.Id);

        Assert.NotNull(zip);
        using var ms = new MemoryStream(zip!.Value.Bytes);
        using var archive = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Read);
        Assert.Equal(2, archive.Entries.Count);
    }
}
