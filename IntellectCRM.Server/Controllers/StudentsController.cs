using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Auth;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("students")]
[Route("api/admin/students")]
public class StudentsController(AppDbContext db, AuditService audit, IConfiguration config, EskizService eskiz) : ControllerBase
{
    private const int MinPasswordLength = 8;
    private const string WeakPasswordMessage = "Parol kamida 8 belgidan iborat bo'lsin";

    /// <summary>
    /// Faol (arxivlanmagan) o'quvchilar ro'yxati. <paramref name="includeArchived"/>=true bo'lsa
    /// arxivlangan o'quvchilar ham qaytadi.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Student>>> GetAll([FromQuery] bool includeArchived = false)
    {
        var q = db.Students.AsQueryable();
        if (!includeArchived) q = q.Where(s => !s.IsArchived);
        var students = await q.OrderBy(s => s.FullName).ToListAsync();

        // Har o'quvchiga FAOL a'zo guruhlari nomlarini biriktiramiz (ro'yxatda hammasi ko'rinsin).
        var ids = students.Select(s => s.Id).ToList();
        var memberships = await (from sg in db.StudentGroups
                                 join c in db.Classes on sg.GroupId equals c.Id
                                 where sg.IsActive && ids.Contains(sg.StudentId)
                                 select new { sg.StudentId, c.Name, sg.Status }).ToListAsync();
        var byStudent = memberships.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Name).Distinct()
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList());
        // Kursda aktiv = kamida bitta a'zoligi Status=="active" (sinov/muzlatilgan emas).
        var activeIds = memberships.Where(m => m.Status == "active").Select(m => m.StudentId).ToHashSet();

        // Tuman + maktab nomlarini biriktiramiz (DB'ga yozilmaydi — faqat ko'rsatish uchun).
        var districtNames = await db.Districts.ToDictionaryAsync(d => d.Id, d => d.Name);
        var schoolNames = await db.Schools.ToDictionaryAsync(s => s.Id, s => s.Name);

        foreach (var s in students)
        {
            s.Groups = byStudent.GetValueOrDefault(s.Id) ?? new List<string>();
            s.Active = activeIds.Contains(s.Id);
            if (!string.IsNullOrEmpty(s.DistrictId))
                s.DistrictName = districtNames.GetValueOrDefault(s.DistrictId, "");
            if (!string.IsNullOrEmpty(s.SchoolId))
                s.SchoolName = schoolNames.GetValueOrDefault(s.SchoolId, "");
        }
        return students;
    }

    /// <summary>O'quvchi shaxsiy daftari — bitta o'quvchi haqida barcha ma'lumot (profil, o'zlashtirish, davomat, intizom, topshiriqlar, oylik baholash, uy vazifa/xulq).</summary>
    [HttpGet("{id}/profile")]
    public async Task<ActionResult<StudentNotebookDto>> GetProfile(string id)
    {
        var st = await db.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (st is null) return NotFound();
        return await StudentProfileBuilder.BuildAsync(db, st);
    }

    private static readonly System.Text.Json.JsonSerializerOptions AiJsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>O'quvchining saqlangan AI tahlillari tarixi (eng yangisi birinchi). O'quvchi
    /// sahifasidagi "AI Tahlil" bo'limi shu yozuvlarni ko'rsatadi.</summary>
    [HttpGet("{id}/ai-analyses")]
    public async Task<ActionResult<IEnumerable<StudentAiAnalysisRecordDto>>> AiAnalyses(string id)
    {
        var rows = await db.StudentAiAnalyses
            .Where(a => a.StudentId == id)
            .OrderByDescending(a => a.Date).ThenByDescending(a => a.CreatedAt)
            .ToListAsync();
        return rows.Select(ToAiRecordDto).Where(r => r is not null).Select(r => r!).ToList();
    }

    /// <summary>O'quvchining BARCHA ma'lumotlarini Google Gemini orqali tahlil qiladi (strukturali:
    /// matn + diagramma sonlari). KUNIGA BIR MARTA: shu kun yozuvi bo'lsa Gemini chaqirilmaydi,
    /// mavjud yozuv qaytadi (AlreadyToday=true). Oldingi tahlil bo'lsa, yangi tahlil unga nisbatan
    /// o'zgarishlarni ham aytadi. API kaliti Sozlamalar → AI Tahlil (Gemini)da.</summary>
    [HttpPost("{id}/ai-analysis")]
    public async Task<ActionResult<StudentAiAnalysisResponseDto>> AiAnalysis(string id)
    {
        var st = await db.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (st is null) return NotFound();

        var today = AppClock.Today.ToString("yyyy-MM-dd");

        // Kuniga bir marta: bugungi yozuv bo'lsa — uni qaytaramiz (Gemini chaqirilmaydi,
        // kalit tekshiruvidan oldin — keshlangan tahlilni ko'rsatish kalitga bog'liq emas).
        var todays = await db.StudentAiAnalyses
            .FirstOrDefaultAsync(a => a.StudentId == id && a.Date == today);
        if (todays is not null)
            return new StudentAiAnalysisResponseDto(true, true, ToAiRecordDto(todays), null);

        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var model = GeminiService.ResolveModel(config);
        if (!GeminiService.IsConfigured(meta?.GeminiApiKey))
            return new StudentAiAnalysisResponseDto(false, false, null,
                "Gemini API kaliti sozlanmagan. Sozlamalar → AI Tahlil (Gemini) bo'limidan kalit kiriting.");

        // Oldingi (eng yangi) tahlil — yangi tahlil unga nisbatan o'zgarishlarni aytadi.
        var prev = await db.StudentAiAnalyses
            .Where(a => a.StudentId == id)
            .OrderByDescending(a => a.Date).ThenByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        var profile = await StudentProfileBuilder.BuildAsync(db, st);
        var json = System.Text.Json.JsonSerializer.Serialize(profile, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = false,
        });

        var prevContext = prev is null
            ? "Bu o'quvchining BIRINCHI tahlili — oldingi tahlil yo'q. \"ozgarishlar\" maydonini bo'sh (\"\") qoldir."
            : $"Oldingi tahlil ({prev.Date}) xulosasi: \"{prev.Summary}\". Oldingi umumiy ball: {prev.OverallScore}. " +
              "\"ozgarishlar\" maydonida ANA SHU oldingi tahlilga nisbatan nima o'zgarganini (yaxshilangan/yomonlashgan " +
              "joylar, ball farqi) aniq yoz.";

        var prompt =
            "Sen o'quv markazi uchun tajribali pedagog-tahlilchisan. Quyida bitta o'quvchining to'liq " +
            "ma'lumotlari JSON ko'rinishida: shaxsiy ma'lumotlar, fanlar bo'yicha oylik baholar, davomat " +
            "(qoldirgan/kasal/kech), intizomiy ball, topshiriqlar natijasi, oylik baholash (feedback), uy " +
            "vazifa va xulq dinamikasi, to'lov balansi.\n\n" +
            "Vazifa: shu ma'lumotni CHUQUR tahlil qilib, FAQAT O'ZBEK TILIDA (lotin alifbosi) natijani QUYIDAGI " +
            "JSON sxemasida QAYTAR (boshqa hech narsa yozma, faqat JSON):\n" +
            "{\n" +
            "  \"umumiy\": \"2-4 jumla — o'quvchining hozirgi umumiy holati\",\n" +
            "  \"kuchli\": [\"kuchli tomon\", ...],\n" +
            "  \"zaif\": [\"zaif tomon / e'tibor kerak\", ...],\n" +
            "  \"dinamika\": \"o'qishdagi dinamika — yaxshilanmoqda/barqaror/yomonlashmoqda, sabablari bilan\",\n" +
            "  \"ozgarishlar\": \"oldingi tahlilga nisbatan o'zgarishlar (yo'q bo'lsa bo'sh)\",\n" +
            "  \"tavsiyalar\": [\"o'qituvchi/ota-onaga aniq amaliy tavsiya\", ...],\n" +
            "  \"baholar\": { \"akademik\": 0-100, \"davomat\": 0-100, \"intizom\": 0-100, \"uyVazifa\": 0-100, \"faollik\": 0-100, \"umumiy\": 0-100 },\n" +
            "  \"trend\": \"yaxshilanmoqda\" yoki \"barqaror\" yoki \"yomonlashmoqda\"\n" +
            "}\n\n" +
            "Qoidalar: \"baholar\" — 0..100 butun sonlar (real ma'lumotga asoslangan baho; ma'lumot yo'q soha uchun " +
            "ehtiyotkor o'rta baho). \"umumiy\" — boshqa sohalarning umumlashmasi. Faqat berilgan ma'lumotga tayan, " +
            "to'qib chiqarma. Har matn maydoni qisqa va aniq. " + prevContext + "\n\n" +
            "O'quvchi ma'lumotlari (JSON):\n" + json;

        var (ok, text, err) = await GeminiService.GenerateAsync(meta!.GeminiApiKey, model, prompt, jsonMode: true);
        if (!ok)
            return new StudentAiAnalysisResponseDto(false, false, null, err);

        var result = ParseAiResult(text);
        if (result is null)
            return new StudentAiAnalysisResponseDto(false, false, null,
                "AI javobini o'qib bo'lmadi (format xato). Qaytadan urinib ko'ring.");

        var rec = new StudentAiAnalysis
        {
            StudentId = st.Id,
            Date = today,
            CreatedAt = AppClock.Iso(),
            Model = model,
            Summary = Trim(result.Umumiy, 600),
            OverallScore = Math.Clamp(result.Baholar.Umumiy, 0, 100),
            ResultJson = System.Text.Json.JsonSerializer.Serialize(result, AiJsonOpts),
        };
        db.StudentAiAnalyses.Add(rec);
        await db.SaveChangesAsync();

        return new StudentAiAnalysisResponseDto(true, false, ToAiRecordDto(rec), null);
    }

    private static string Trim(string? s, int max)
    {
        s ??= "";
        return s.Length <= max ? s : s[..max];
    }

    /// <summary>Saqlangan ResultJson'ni typed record'ga aylantiradi (yozuv → DTO).</summary>
    private static StudentAiAnalysisRecordDto? ToAiRecordDto(StudentAiAnalysis a)
    {
        var result = ParseStored(a.ResultJson);
        if (result is null) return null;
        return new StudentAiAnalysisRecordDto(a.Id, a.Date, a.CreatedAt, a.Model, a.OverallScore, result);
    }

    private static StudentAiAnalysisResultDto? ParseStored(string json)
    {
        try
        {
            var r = System.Text.Json.JsonSerializer.Deserialize<StudentAiAnalysisResultDto>(json, AiJsonOpts);
            return r is null ? null : Sanitize(r);
        }
        catch { return null; }
    }

    /// <summary>Gemini JSON javobini typed natijaga aylantiradi (kod-fence tozalanadi, null'lar to'ldiriladi).</summary>
    private static StudentAiAnalysisResultDto? ParseAiResult(string text)
    {
        var t = (text ?? "").Trim();
        // ```json ... ``` fence bo'lsa tozalaymiz.
        if (t.StartsWith("```"))
        {
            var nl = t.IndexOf('\n');
            if (nl >= 0) t = t[(nl + 1)..];
            if (t.EndsWith("```")) t = t[..^3];
            t = t.Trim();
        }
        // Birinchi { dan oxirgi } gacha (oldi/orqa shovqinni kesish).
        var open = t.IndexOf('{');
        var close = t.LastIndexOf('}');
        if (open >= 0 && close > open) t = t[open..(close + 1)];
        try
        {
            var r = System.Text.Json.JsonSerializer.Deserialize<StudentAiAnalysisResultDto>(t, AiJsonOpts);
            return r is null ? null : Sanitize(r);
        }
        catch { return null; }
    }

    private static StudentAiAnalysisResultDto Sanitize(StudentAiAnalysisResultDto r)
    {
        static int C(int v) => Math.Clamp(v, 0, 100);
        var b = r.Baholar ?? new AiRatingsDto(0, 0, 0, 0, 0, 0);
        return new StudentAiAnalysisResultDto(
            r.Umumiy ?? "",
            r.Kuchli ?? new List<string>(),
            r.Zaif ?? new List<string>(),
            r.Dinamika ?? "",
            r.Ozgarishlar ?? "",
            r.Tavsiyalar ?? new List<string>(),
            new AiRatingsDto(C(b.Akademik), C(b.Davomat), C(b.Intizom), C(b.UyVazifa), C(b.Faollik), C(b.Umumiy)),
            r.Trend ?? "");
    }

    /// <summary>O'quvchiga support o'qituvchilar bergan feedback — o'tilgan (done) support darslari
    /// (sana, support o'qituvchi ismi, mavzu, izoh), eng yangi birinchi. Support guruhga bog'lanmaydi,
    /// shuning uchun feedback shu yerda alohida ko'rsatiladi.</summary>
    [HttpGet("{id}/support-feedback")]
    public async Task<ActionResult<IEnumerable<StudentSupportFeedbackDto>>> SupportFeedback(string id)
    {
        var slots = await db.SupportSlots
            .Where(s => s.StudentId == id && s.Status == "done")
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.StartTime)
            .ToListAsync();
        if (slots.Count == 0) return new List<StudentSupportFeedbackDto>();
        var tIds = slots.Select(s => s.TeacherId).Distinct().ToList();
        var tNames = (await db.Teachers.Where(t => tIds.Contains(t.Id)).ToListAsync())
            .ToDictionary(t => t.Id, t => t.FullName);
        return slots.Select(s => new StudentSupportFeedbackDto(
            s.Date, s.StartTime, s.EndTime, tNames.GetValueOrDefault(s.TeacherId, ""),
            s.Topic, s.Notes)).ToList();
    }

    /// <summary>Faqat arxivlangan o'quvchilar ro'yxati.</summary>
    [HttpGet("archived")]
    public async Task<ActionResult<IEnumerable<Student>>> GetArchived() =>
        await db.Students.Where(s => s.IsArchived)
            .OrderByDescending(s => s.ArchivedAt).ThenBy(s => s.FullName).ToListAsync();

    /// <summary>
    /// Kiritilgan raqamlar (o'quvchi o'zi / ota / ona / ota-ona) allaqachon biror o'quvchida (ARXIVDAGILAR
    /// ham) ishlatilganmi — tekshiradi. Raqamlar <see cref="PhoneUtil.Key"/> bo'yicha (oxirgi 9 raqam)
    /// solishtiriladi. <paramref name="req"/>.ExcludeId — tahrirdagi o'quvchining o'zi (uni hisobga olmaymiz).
    /// Mos kelgan har bir o'quvchi uchun bitta qator qaytadi (qaysi raqam va qaysi rol mos kelgani bilan).
    /// </summary>
    [HttpPost("check-phones")]
    public async Task<ActionResult<IEnumerable<PhoneMatchDto>>> CheckPhones(CheckPhonesRequest req)
    {
        // Kiritilgan nomzod raqamlar (yorliq + xom qiymat + kalit). Bo'sh/juda qisqalar tashlanadi.
        var candidates = new[]
            {
                ("O'quvchi", req.Phone),
                ("Ota", req.FatherPhone),
                ("Ona", req.MotherPhone),
                ("Ota-ona", req.ParentPhone),
            }
            .Where(c => !string.IsNullOrWhiteSpace(c.Item2))
            .Select(c => (Label: c.Item1, Raw: c.Item2!.Trim(), Key: PhoneUtil.Key(c.Item2)))
            .Where(c => c.Key.Length >= 7)
            .ToList();
        if (candidates.Count == 0) return new List<PhoneMatchDto>();
        var candidateKeys = candidates.Select(c => c.Key).ToHashSet();

        // Arxivdagilar ham — barcha o'quvchilar.
        var students = await db.Students.ToListAsync();
        var matches = new List<PhoneMatchDto>();
        foreach (var s in students)
        {
            if (!string.IsNullOrEmpty(req.ExcludeId) && s.Id == req.ExcludeId) continue;
            var existing = new[]
            {
                ("O'quvchi", s.Phone),
                ("Ota", s.FatherPhone),
                ("Ona", s.MotherPhone),
                ("Ota-ona", s.ParentPhone),
            };
            foreach (var ex in existing)
            {
                if (string.IsNullOrWhiteSpace(ex.Item2)) continue;
                var key = PhoneUtil.Key(ex.Item2);
                if (key.Length < 7 || !candidateKeys.Contains(key)) continue;
                var cand = candidates.First(c => c.Key == key);
                matches.Add(new PhoneMatchDto(cand.Raw, s.Id, s.FullName, s.ClassName, s.IsArchived, ex.Item1));
                break; // bitta o'quvchi — birinchi mos kelgan raqam yetarli
            }
        }
        return matches;
    }

    /// <summary>ASOSIY ota-ona kontaktini tanlash: ota (bo'lmasa ona); ikkalasi ham bo'sh bo'lsa
    /// orqaga moslik uchun <paramref name="fallback"/> (eski ParentFullName/ParentPhone).</summary>
    private static string DerivePrimary(string? father, string? mother, string? fallback)
    {
        if (!string.IsNullOrWhiteSpace(father)) return father.Trim();
        if (!string.IsNullOrWhiteSpace(mother)) return mother.Trim();
        return (fallback ?? "").Trim();
    }

    /// <summary>"Familiya Ism Sharifi" — parts'ni birlashtirish (bo'sh qismlar tashlanadi).</summary>
    private static string JoinName(string? last, string? first, string? middle) =>
        string.Join(' ', new[] { last, first, middle }
            .Select(x => (x ?? "").Trim())
            .Where(x => !string.IsNullOrEmpty(x)));

    [HttpPost]
    public async Task<ActionResult<Student>> Create(StudentPayload p)
    {
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == p.ClassName);
        var student = AddStudent(p, cls);
        await db.SaveChangesAsync();
        return student;
    }

    /// <summary>
    /// <see cref="StudentPayload"/>'dan Student yaratib (tizim akkaunti + oylik hisoblar + audit bilan)
    /// db kontekstiga qo'shadi. SaveChanges QILMAYDI — chaqiruvchi (bitta yaratish yoki ommaviy import)
    /// hammasini qo'shib bo'lgach bir marta saqlaydi. <paramref name="cls"/> — oldindan topilgan sinf
    /// (narx/hisob uchun; null bo'lsa oylik hisob yozilmaydi).
    /// `status` — a'zolik holati (trial/active/frozen); bo'sh bo'lsa default "trial".
    /// </summary>
    private Student AddStudent(StudentPayload p, Group? cls, string status = "")
    {
        // Noto'g'ri/qisqa sana (masalan "2024", "abc") saqlanmasin — oylik billing batch'ini crash qilmasligi
        // uchun bo'sh/whitespace bilan bir xil muomala: bugungi sanaga tushamiz.
        var enrollment = string.IsNullOrWhiteSpace(p.EnrollmentDate)
                || p.EnrollmentDate.Length != 10 || !DateOnly.TryParse(p.EnrollmentDate, out _)
            ? AppClock.Today.ToString("yyyy-MM-dd")
            : p.EnrollmentDate;

        // FISH parts berilsa ulardan FullName yig'iladi. Aks holda eski yagona FullName ishlatiladi.
        var lastName = (p.LastName ?? "").Trim();
        var firstName = (p.FirstName ?? "").Trim();
        var middleName = (p.MiddleName ?? "").Trim();
        var fullName = (lastName + firstName + middleName) == ""
            ? (p.FullName ?? "").Trim()
            : JoinName(lastName, firstName, middleName);

        var parentLast = (p.ParentLastName ?? "").Trim();
        var parentFirst = (p.ParentFirstName ?? "").Trim();
        var parentMiddle = (p.ParentMiddleName ?? "").Trim();

        // Lid formasiga mos: o'quvchi telefoni + ota/ona (FISH+telefon).
        var fatherFull = (p.FatherFullName ?? "").Trim();
        var fatherPhone = PhoneUtil.Normalize(p.FatherPhone ?? "");
        var motherFull = (p.MotherFullName ?? "").Trim();
        var motherPhone = PhoneUtil.Normalize(p.MotherPhone ?? "");

        // ASOSIY ota-ona kontakti — ota (bo'lmasa ona) dan; ikkalasi bo'sh bo'lsa eski parts/payload.
        var parentFull = DerivePrimary(fatherFull, motherFull,
            (parentLast + parentFirst + parentMiddle) == ""
                ? (p.ParentFullName ?? "").Trim()
                : JoinName(parentLast, parentFirst, parentMiddle));
        var parentPhone = DerivePrimary(fatherPhone, motherPhone, PhoneUtil.Normalize(p.ParentPhone ?? ""));

        var student = new Student
        {
            FullName = fullName,
            LastName = lastName,
            FirstName = firstName,
            MiddleName = middleName,
            BirthDate = p.BirthDate,
            Address = p.Address,
            Gender = p.Gender,
            Phone = PhoneUtil.Normalize(p.Phone ?? ""),
            BirthCertificateUrl = string.IsNullOrWhiteSpace(p.BirthCertificateUrl) ? null : p.BirthCertificateUrl,
            ParentFullName = parentFull,
            ParentLastName = parentLast,
            ParentFirstName = parentFirst,
            ParentMiddleName = parentMiddle,
            ParentPhone = parentPhone,
            FatherFullName = fatherFull,
            FatherPhone = fatherPhone,
            MotherFullName = motherFull,
            MotherPhone = motherPhone,
            ParentPassportUrl = string.IsNullOrWhiteSpace(p.ParentPassportUrl) ? null : p.ParentPassportUrl,
            ClassName = p.ClassName,
            DistrictId = (p.DistrictId ?? "").Trim(),
            SchoolId = (p.SchoolId ?? "").Trim(),
            EnrollmentDate = enrollment,
            Balance = 0,
            DiscountPct = Math.Clamp(p.DiscountPct ?? 0, 0, 100),
            DiscountAmount = Math.Max(0m, p.DiscountAmount ?? 0m),
            DiscountNote = (p.DiscountNote ?? "").Trim(),
            DiscountStartMonth = (p.DiscountStartMonth ?? "").Trim(),
            DiscountEndMonth = (p.DiscountEndMonth ?? "").Trim(),
        };
        db.Students.Add(student);

        // O'quvchiga "student" rolli tizim akkaunti generatsiya qilib biriktiramiz.
        var account = AccountFactory.CreateAccountFor(db, "student", student.FullName);
        student.UserId = account.Id;

        // Guruh tanlangan bo'lsa — M2M a'zolik yaratamiz. Status: trial/active/frozen (default: trial)
        // Oylik to'lov DARROV yozilmaydi — a'zolik AKTIVLASHTIRILGANDA boshlanadi
        // (qisman birinchi oy + keyingi to'liq oylar; muzlatilsa to'xtaydi).
        if (cls is not null)
        {
            var memberStatus = NormalizeStatus(status);
            db.StudentGroups.Add(new StudentGroup
            {
                StudentId = student.Id,
                GroupId = cls.Id,
                JoinedAt = enrollment,
                IsActive = memberStatus != "frozen", // frozen — IsActive = false
                Status = memberStatus,
            });
        }

        // Chegirma berilgan bo'lsa — audit yozuvi.
        if (student.DiscountPct > 0 || student.DiscountAmount > 0)
            audit.Record(AuditService.EntityStudentDiscount, student.Id, "create",
                DiscountSummary("O'quvchi yaratildi", student.FullName, 0, 0, student.DiscountPct, student.DiscountAmount, student.DiscountNote),
                after: DiscountSnapshot(student), studentId: student.Id);

        return student;
    }

    /// <summary>Chegirma o'zgarishi audit izohini tuzadi.</summary>
    private static string DiscountSummary(
        string action, string studentName,
        int oldPct, decimal oldAmount, int newPct, decimal newAmount, string note)
    {
        var changed = (oldPct != newPct ? $"{oldPct}% → {newPct}%" : $"{newPct}%")
                    + ", "
                    + (oldAmount != newAmount
                        ? $"{AuditService.Money(oldAmount)} → {AuditService.Money(newAmount)} so'm"
                        : $"{AuditService.Money(newAmount)} so'm");
        var n = string.IsNullOrWhiteSpace(note) ? "" : $" — \"{note}\"";
        return $"{action}: chegirma {changed}{n} ({studentName})";
    }

    /// <summary>Chegirma snapshot'i (audit Before/After uchun).</summary>
    private static object DiscountSnapshot(Student s) => new
    {
        s.DiscountPct,
        s.DiscountAmount,
        s.DiscountNote,
    };

    /// <summary>
    /// O'quvchini tahrirlash. Chegirma (foiz/summa) o'zgarsa va
    /// <paramref name="applyDiscount"/> = true bo'lsa, yangi chegirma joriy oy MonthlyCharge'iga
    /// ham qo'llanadi (oylik summa qayta hisoblanadi, balans deltaga moslab to'g'rilanadi).
    /// false bo'lsa — joriy oy eski summada qoladi, yangi chegirma keyingi accrual'dan amal qiladi.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, StudentPayload p, [FromQuery] bool applyDiscount = false)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();

        var oldPct = student.DiscountPct;
        var oldAmount = student.DiscountAmount;
        var oldNote = student.DiscountNote;
        var oldStart = student.DiscountStartMonth;
        var oldEnd = student.DiscountEndMonth;
        var oldClassName = student.ClassName;

        // O'quvchi FISH — parts berilsa ulardan FullName yig'iladi.
        if (p.LastName is not null || p.FirstName is not null || p.MiddleName is not null)
        {
            student.LastName = (p.LastName ?? "").Trim();
            student.FirstName = (p.FirstName ?? "").Trim();
            student.MiddleName = (p.MiddleName ?? "").Trim();
            student.FullName = JoinName(student.LastName, student.FirstName, student.MiddleName);
        }
        else
        {
            student.FullName = p.FullName;
        }
        student.BirthDate = p.BirthDate;
        student.Address = p.Address;
        student.Gender = p.Gender;
        student.Phone = PhoneUtil.Normalize(p.Phone ?? "");
        if (p.BirthCertificateUrl is not null)
            student.BirthCertificateUrl = string.IsNullOrWhiteSpace(p.BirthCertificateUrl) ? null : p.BirthCertificateUrl;
        // Eski FISH parts berilsa ham yangilanadi (orqaga moslik); lekin ASOSIY kontakt ota/onadan keladi.
        if (p.ParentLastName is not null || p.ParentFirstName is not null || p.ParentMiddleName is not null)
        {
            student.ParentLastName = (p.ParentLastName ?? "").Trim();
            student.ParentFirstName = (p.ParentFirstName ?? "").Trim();
            student.ParentMiddleName = (p.ParentMiddleName ?? "").Trim();
        }
        // Lid formasiga mos: ota/ona (FISH+telefon) — va ulardan ASOSIY ota-ona kontaktini chiqaramiz.
        student.FatherFullName = (p.FatherFullName ?? "").Trim();
        student.FatherPhone = PhoneUtil.Normalize(p.FatherPhone ?? "");
        student.MotherFullName = (p.MotherFullName ?? "").Trim();
        student.MotherPhone = PhoneUtil.Normalize(p.MotherPhone ?? "");
        student.ParentFullName = DerivePrimary(student.FatherFullName, student.MotherFullName, (p.ParentFullName ?? "").Trim());
        student.ParentPhone = DerivePrimary(student.FatherPhone, student.MotherPhone, PhoneUtil.Normalize(p.ParentPhone ?? ""));
        if (p.ParentPassportUrl is not null)
            student.ParentPassportUrl = string.IsNullOrWhiteSpace(p.ParentPassportUrl) ? null : p.ParentPassportUrl;
        student.ClassName = p.ClassName;
        if (p.DistrictId is not null) student.DistrictId = p.DistrictId.Trim();
        if (p.SchoolId is not null) student.SchoolId = p.SchoolId.Trim();
        if (!string.IsNullOrWhiteSpace(p.EnrollmentDate))
        {
            // Noto'g'ri sana saqlanib, keyin oylik billing batch'ini crash qilmasligi uchun aniq xato qaytaramiz.
            if (p.EnrollmentDate.Length != 10 || !DateOnly.TryParse(p.EnrollmentDate, out _))
                return BadRequest(new { message = "Ro'yxatga olingan sana noto'g'ri formatda (kutilgan: YYYY-MM-DD)" });
            student.EnrollmentDate = p.EnrollmentDate;
        }

        // Chegirma — berilgan maydonlar yangilanadi (null = avvalgi saqlanadi).
        if (p.DiscountPct.HasValue) student.DiscountPct = Math.Clamp(p.DiscountPct.Value, 0, 100);
        if (p.DiscountAmount.HasValue) student.DiscountAmount = Math.Max(0m, p.DiscountAmount.Value);
        if (p.DiscountNote is not null) student.DiscountNote = p.DiscountNote.Trim();
        if (p.DiscountStartMonth is not null) student.DiscountStartMonth = p.DiscountStartMonth.Trim();
        if (p.DiscountEndMonth is not null) student.DiscountEndMonth = p.DiscountEndMonth.Trim();

        // Akkaunt nomini sinxronlaymiz va (ixtiyoriy) yangi parol o'rnatamiz.
        var user = student.UserId is null ? null : await db.Users.FindAsync(student.UserId);
        if (!string.IsNullOrWhiteSpace(p.NewPassword))
        {
            var pwd = p.NewPassword.Trim();
            if (pwd.Length < MinPasswordLength) return BadRequest(new { message = WeakPasswordMessage });
            // Akkaunt yo'q bo'lsa — yaratib biriktiramiz.
            user ??= AccountFactory.CreateAccountFor(db, "student", student.FullName);
            student.UserId = user.Id;
            user.SetInitialPassword(pwd);
        }
        if (user is not null) user.FullName = student.FullName;

        // Sinf yoki chegirma o'zgardimi?
        var classChanged = !string.Equals(oldClassName, student.ClassName, StringComparison.Ordinal);
        var discountChanged = oldPct != student.DiscountPct
                              || oldAmount != student.DiscountAmount
                              || oldNote != student.DiscountNote
                              || oldStart != student.DiscountStartMonth
                              || oldEnd != student.DiscountEndMonth;

        // Joriy sinf narxiga ko'ra hisoblarni TO'G'RILAYMIZ/TO'LDIRAMIZ (ClassName MATNI o'zgarmagan
        // bo'lsa ham — masalan o'quvchi sinf hali yaratilmagan paytda qo'shilib, keyin sinf yaratilgan):
        //  • yetishmagan oylar (kelgan oyidan joriy oygacha) — yangi narxda yaratiladi, balans kamayadi;
        //  • mavjud JORIY oy — sinf yoki (so'ralganda) chegirma o'zgarsa, yangi narxga moslanadi;
        //  • o'tgan oylardagi mavjud hisoblar — tarixiy, tegilmaydi.
        var applied = false;
        // M2M a'zolik bo'lsa billing AccrueMonth/aktivlashtirish (a'zolik narxi) orqali yuritiladi —
        // ClassName narxi bo'yicha qayta hisoblamaymiz (aks holda ikki manba bir-biriga zid summa yozadi).
        var hasMembership = await db.StudentGroups.AnyAsync(sg => sg.StudentId == student.Id);
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == student.ClassName);
        // Agar className YANGI qiymatga o'zgardi va o'quvchining hech qanday M2M a'zoligi yo'q bo'lsa —
        // bu admin o'quvchini guruhga qo'shmoqchi (StudentFormModal "Guruhga biriktirish" dropdown).
        // Bunday holatda M2M a'zolik (Status="trial") yaratamiz va billing QILINMAYDI —
        // to'lov faqat aktivlashtirish (ActivateMember) paytida boshlanishi kerak.
        if (classChanged && !hasMembership && cls is not null)
        {
            db.StudentGroups.Add(new StudentGroup
            {
                StudentId = student.Id,
                GroupId = cls.Id,
                JoinedAt = student.EnrollmentDate.Length >= 10
                    ? student.EnrollmentDate
                    : AppClock.Today.ToString("yyyy-MM-dd"),
                IsActive = true,
                Status = "trial",
            });
            hasMembership = true; // billing blokini o'tkazib yuborish uchun
        }
        if (!hasMembership && cls is not null && cls.MonthlyFee > 0)
        {
            var current = TuitionService.CurrentMonth();
            var startMonth = string.IsNullOrEmpty(student.EnrollmentDate) || student.EnrollmentDate.Length < 7
                ? current
                : student.EnrollmentDate[..7];

            // Guruhsiz o'quvchi — faqat GroupId=null (ClassName-asosli) hisoblar bilan ishlaymiz.
            var existing = await db.MonthlyCharges
                .Where(c => c.StudentId == student.Id && c.GroupId == null)
                .ToDictionaryAsync(c => c.Month, c => c);

            foreach (var month in TuitionService.MonthRange(startMonth, current))
            {
                // Chegirma faqat amal qilish davrida (DiscountStartMonth..EndMonth) qo'llanadi — har oy alohida.
                var monthDiscount = TuitionService.DiscountForMonth(student, cls.MonthlyFee, month);
                var monthEffective = cls.MonthlyFee - monthDiscount;
                if (existing.TryGetValue(month, out var charge))
                {
                    if (charge.Locked) continue; // qo'lda tahrirlangan — tegmaymiz.
                    // Faqat JORIY oyni va faqat sinf/chegirma o'zgarsa qayta hisoblaymiz (o'tgan oylar tarixiy).
                    var recompute = month == current && (classChanged || (discountChanged && applyDiscount));
                    if (recompute && (charge.Amount != cls.MonthlyFee || charge.Discount != monthDiscount))
                    {
                        var delta = monthEffective - (charge.Amount - charge.Discount);
                        charge.Amount = cls.MonthlyFee;
                        charge.Discount = monthDiscount;
                        student.Balance -= delta;   // delta > 0 → ko'proq to'lash → balans kamayadi
                        applied = true;
                    }
                }
                else
                {
                    // Hisob yo'q edi — yangi sinf narxida yaratamiz (sinfsiz qo'shilgan o'quvchi holati).
                    db.MonthlyCharges.Add(new MonthlyCharge
                    {
                        StudentId = student.Id,
                        GroupId = null, // guruhsiz (ClassName-asosli) hisob
                        Month = month,
                        Amount = cls.MonthlyFee,
                        Discount = monthDiscount,
                        Date = $"{month}-01",
                    });
                    student.Balance -= monthEffective;
                    applied = true;
                }
            }
        }

        // Audit — sinf va/yoki chegirma o'zgarishi.
        if (classChanged || discountChanged)
        {
            var parts = new List<string>();
            if (classChanged) parts.Add($"sinf: {oldClassName} → {student.ClassName}");
            if (discountChanged)
                parts.Add($"chegirma: {oldPct}%/{AuditService.Money(oldAmount)} → "
                          + $"{student.DiscountPct}%/{AuditService.Money(student.DiscountAmount)} so'm");
            var summary = "O'quvchi yangilandi (" + string.Join("; ", parts) + ")"
                + (applied ? " — joriy oy hisobi yangi summaga to'g'rilandi" : " — keyingi oydan amal qiladi");
            audit.Record(AuditService.EntityStudentDiscount, student.Id, "update", $"{summary} ({student.FullName})",
                before: new { Class = oldClassName, DiscountPct = oldPct, DiscountAmount = oldAmount, DiscountNote = oldNote },
                after: new { Class = student.ClassName, student.DiscountPct, student.DiscountAmount, student.DiscountNote },
                studentId: student.Id);
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        var reason = string.IsNullOrWhiteSpace(reasonId) ? "" : (await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "");
        // Bog'liq qatorlar orphan qolmasligi uchun ularni ham olib tashlaymiz: oylik hisob, guruh a'zoliklari,
        // jurnal yozuvlari, oylik baholar, intizomiy ballar. (Moliya yozuvlari audit uchun saqlanadi.)
        db.MonthlyCharges.RemoveRange(db.MonthlyCharges.Where(c => c.StudentId == id));
        db.StudentGroups.RemoveRange(db.StudentGroups.Where(sg => sg.StudentId == id));
        db.JournalEntries.RemoveRange(db.JournalEntries.Where(e => e.StudentId == id));
        db.EvaluationGrades.RemoveRange(db.EvaluationGrades.Where(g => g.StudentId == id));
        db.DisciplinePoints.RemoveRange(db.DisciplinePoints.Where(p => p.StudentId == id));
        // Biriktirilgan tizim akkaunti + qurilma tokenlarini ham o'chiramiz.
        if (student.UserId is not null)
        {
            db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => d.UserId == student.UserId));
            var user = await db.Users.FindAsync(student.UserId);
            if (user is not null) db.Users.Remove(user);
        }
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        ArchiveService.Snapshot(db, "student", student.Id, student.FullName,
            student.Phone ?? student.ClassName ?? "", student, reason.Length > 0 ? reason : null, actor);
        db.Students.Remove(student);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /* ---------- Arxiv ---------- */

    /// <summary>
    /// O'quvchini arxivga ko'chirish: <c>IsArchived=true</c>, sana saqlanadi, sabab yoziladi,
    /// akkaunt login bloklanadi (PasswordHash bo'shaltiriladi). Tarixiy ma'lumotlar saqlanadi.
    /// ReasonId berilsa, ActionReason.Label yoziladi; aks holda Reason suz berilsa yoziladi.
    /// </summary>
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(string id, ArchiveStudentRequest req)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        if (student.IsArchived)
            return BadRequest(new { message = "O'quvchi allaqachon arxivda" });

        student.IsArchived = true;
        student.ArchivedAt = AppClock.Today.ToString("yyyy-MM-dd");

        // Sabab: ReasonId bo'lsa undan Label, aks holda Reason suz
        if (!string.IsNullOrWhiteSpace(req.ReasonId))
        {
            var reason = await db.ActionReasons.FindAsync(req.ReasonId);
            student.ArchiveReason = reason?.Label ?? (req.Reason ?? "").Trim();
        }
        else
        {
            student.ArchiveReason = (req.Reason ?? "").Trim();
        }

        // Login bloklash — PasswordHash bo'shaltiriladi (login imkonsiz bo'ladi).
        if (student.UserId is not null)
        {
            var user = await db.Users.FindAsync(student.UserId);
            if (user is not null)
                user.BlockLogin();
        }

        audit.Record(AuditService.EntityStudentDiscount, student.Id, "update",
            $"O'quvchi arxivga ko'chirildi ({student.FullName})"
                + (string.IsNullOrWhiteSpace(student.ArchiveReason) ? "" : $": \"{student.ArchiveReason}\""),
            studentId: student.Id);

        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Arxivdan qaytarish: <c>IsArchived=false</c>, arxiv maydonlari tozalanadi. Ixtiyoriy
    /// <c>NewPassword</c> berilsa akkauntga yangi parol o'rnatiladi (aks holda parol bloklangicha qoladi).
    /// </summary>
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(string id, RestoreStudentRequest req)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        if (!student.IsArchived)
            return BadRequest(new { message = "O'quvchi arxivda emas" });

        student.IsArchived = false;
        student.ArchivedAt = null;
        student.ArchiveReason = null;
        student.ArchivedWithClass = false;

        var newPwd = (req?.NewPassword ?? "").Trim();
        if (!string.IsNullOrEmpty(newPwd))
        {
            if (newPwd.Length < MinPasswordLength) return BadRequest(new { message = WeakPasswordMessage });
            if (student.UserId is not null)
            {
                var user = await db.Users.FindAsync(student.UserId);
                if (user is null)
                {
                    user = AccountFactory.CreateAccountFor(db, "student", student.FullName);
                    student.UserId = user.Id;
                }
                user.SetInitialPassword(newPwd);
            }
        }

        audit.Record(AuditService.EntityStudentDiscount, student.Id, "update",
            $"O'quvchi arxivdan qaytarildi ({student.FullName})",
            studentId: student.Id);

        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// O'quvchi login'ini vaqtincha cheklaydi/qayta ochadi (arxivlashdan farqli — o'quvchi faol
    /// ro'yxatda qoladi, faqat tizimga kira olmaydi). Akkauntga (UserId) bog'liq emas — Student.LoginBlocked
    /// maydoni orqali ishlaydi, shuning uchun akkaunt bo'lmasa ham amal qiladi.
    /// </summary>
    [HttpPut("{id}/login-block")]
    public async Task<IActionResult> SetLoginBlock(string id, StudentLoginBlockRequest req)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();

        if (student.LoginBlocked != req.Blocked)
        {
            student.LoginBlocked = req.Blocked;
            audit.Record(AuditService.EntityStudentDiscount, student.Id, "update",
                (req.Blocked ? "O'quvchi login'i cheklandi" : "O'quvchi login'i qayta ochildi")
                    + $" ({student.FullName})",
                studentId: student.Id);
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Bir nechta o'quvchi login'ini birdaniga cheklaydi/qayta ochadi (jadvalda ko'p tanlash).
    /// Faqat holati o'zgargan o'quvchilar uchun audit yozuvi qo'shiladi, bitta SaveChangesAsync.
    /// </summary>
    [HttpPut("login-block-bulk")]
    public async Task<IActionResult> SetLoginBlockBulk(StudentLoginBlockBulkRequest req)
    {
        if (req.StudentIds is null || req.StudentIds.Count == 0)
            return BadRequest(new { message = "O'quvchilar tanlanmagan" });

        var students = await db.Students.Where(s => req.StudentIds.Contains(s.Id)).ToListAsync();

        var changed = 0;
        foreach (var student in students)
        {
            if (student.LoginBlocked != req.Blocked)
            {
                student.LoginBlocked = req.Blocked;
                audit.Record(AuditService.EntityStudentDiscount, student.Id, "update",
                    (req.Blocked ? "O'quvchi login'i cheklandi" : "O'quvchi login'i qayta ochildi")
                        + $" ({student.FullName})",
                    studentId: student.Id);
                changed++;
            }
        }

        if (changed > 0) await db.SaveChangesAsync();

        return Ok(new { changed });
    }

    /// <summary>O'quvchining tizim akkaunti (login/parol). Akkaunt yo'q bo'lsa — yaratib biriktiradi.</summary>
    [HttpGet("{id}/credentials")]
    public async Task<ActionResult<CredentialsDto>> Credentials(string id)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();

        var user = student.UserId is null ? null : await db.Users.FindAsync(student.UserId);
        if (user is null)
        {
            user = AccountFactory.CreateAccountFor(db, "student", student.FullName);
            student.UserId = user.Id;
            await db.SaveChangesAsync();
        }

        // Foydalanuvchi hali kirmagan bo'lsa dastlabki parol ko'rsatiladi; kirgach bo'sh (faqat reset-password).
        return new CredentialsDto(user.Email, user.InitialPassword ?? "", user.Role);
    }

    /// <summary>O'quvchiga yangi tasodifiy parol generatsiya qiladi va BIR MARTA qaytaradi
    /// (DB'da faqat hash saqlanadi).</summary>
    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<CredentialsDto>> ResetPassword(string id)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        var user = student.UserId is null ? null : await db.Users.FindAsync(student.UserId);
        if (user is null)
        {
            user = AccountFactory.CreateAccountFor(db, "student", student.FullName);
            student.UserId = user.Id;
        }
        var pwd = AccountFactory.GeneratePassword();
        user.PasswordHash = PasswordHasher.Hash(pwd);
        await db.SaveChangesAsync();
        return new CredentialsDto(user.Email, pwd, user.Role);
    }

    /// <summary>
    /// Barcha (faol) o'quvchilarni login/parol bilan Excel (.xlsx) ga eksport qiladi.
    /// Parol FAQAT foydalanuvchi hali kirmagan bo'lsa ko'rinadi (kirgach bo'sh). Faqat superadmin.
    /// Ustunlar: F.I.SH., Sinf, Ota-ona, Telefon, Login, Parol.
    /// </summary>
    [HttpGet("export")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> Export()
    {
        var students = await db.Students.Where(s => !s.IsArchived)
            .OrderBy(s => s.ClassName).ThenBy(s => s.FullName).ToListAsync();
        var userIds = students.Where(s => s.UserId != null).Select(s => s.UserId!).ToList();
        var byId = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id);

        var headers = new[] { "F.I.SH.", "Sinf", "Ota-ona", "Telefon", "Login", "Parol" };
        var rows = students.Select(s =>
        {
            byId.TryGetValue(s.UserId ?? "", out var u);
            return (IReadOnlyList<string>)new[]
            {
                s.FullName, s.ClassName, s.ParentFullName, s.ParentPhone,
                u?.Email ?? "", u?.InitialPassword ?? "",
            };
        });

        var bytes = ExcelExport.Build("O'quvchilar", headers, rows);
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"oquvchilar_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    /* ---------- Excel'dan ommaviy import ---------- */

    private const string XlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // Import shabloni ustunlari (1-varaq). Tartibi import o'qishi bilan AYNAN bir xil bo'lishi shart.
    private static readonly string[] ImportHeaders =
    {
        "F.I.SH (o'quvchi)*", "Telefon", "Ota ismi", "Ota tel", "Ona ismi", "Ona tel",
        "Guruh", "Holat", "Tug'ilgan sana (YYYY-MM-DD)", "Jinsi (o'g'il/qiz)",
    };

    // Guruh bo'yicha status mapping (guruh berilgan bo'lsa status to'ldirish uchun).
    private static string NormalizeGroupStatus(Group? cls, string statusFromRow)
    {
        if (cls is null) return ""; // guruh yo'q — status ko'p muhim emas
        var normalized = NormalizeStatus(statusFromRow);
        return string.IsNullOrEmpty(normalized) ? "trial" : normalized;
    }

    /// <summary>
    /// O'quvchilarni ommaviy kiritish uchun bo'sh Excel shabloni (.xlsx). 1-varaq "O'quvchilar" —
    /// to'ldiriladigan sarlavhalar; 2-varaq "Yo'riqnoma" — maydonlar izohi va MAVJUD sinflar ro'yxati.
    /// Import faqat 1-varaqni o'qiydi, shu sababli yo'riqnoma import'ga ta'sir qilmaydi.
    /// </summary>
    [HttpGet("import-template")]
    public async Task<IActionResult> ImportTemplate()
    {
        var groupNames = await db.Classes.OrderBy(c => c.Name).Select(c => c.Name).ToListAsync();
        var statuses = new[] { "trial", "active", "frozen" };

        var info = new List<IReadOnlyList<string>>
        {
            new[] { "F.I.SH (o'quvchi)*", "Majburiy. Masalan: Aliyev Vali Aliyevich" },
            new[] { "Telefon", "ixtiyoriy. O'quvchining o'z raqami" },
            new[] { "Ota ismi", "ixtiyoriy. Masalan: Aliyev Ali" },
            new[] { "Ota tel", "ixtiyoriy. Masalan: +998901234567" },
            new[] { "Ona ismi", "ixtiyoriy. Masalan: Aliyeva Nodira" },
            new[] { "Ona tel", "ixtiyoriy. Masalan: +998901234568" },
            new[] { "Guruh", "ixtiyoriy. Bo'sh bo'lsa, o'quvchi faqat yaratiladi; pastdagi ro'yxatdan aniq nom" },
            new[] { "Holat", "ixtiyoriy: trial, active yoki frozen (default: trial). Guruh bo'lsa qo'llaniladi" },
            new[] { "Tug'ilgan sana", "YYYY-MM-DD, masalan 2015-03-21 (ixtiyoriy)" },
            new[] { "Jinsi", "o'g'il yoki qiz (bo'sh bo'lsa — o'g'il)" },
            new[] { "", "" },
            new[] { "Mavjud guruhlar:", groupNames.Count == 0 ? "(guruh yaratilmagan)" : "" },
        };
        info.AddRange(groupNames.Select(c => (IReadOnlyList<string>)new[] { c, "" }));
        info.Add(new[] { "", "" });
        info.Add(new[] { "Holat qiymatları:", "" });
        info.AddRange(statuses.Select(s => (IReadOnlyList<string>)new[] { s, "" }));

        var bytes = ExcelExport.Build(new[]
        {
            new ExcelExport.SheetSpec("O'quvchilar", ImportHeaders, Array.Empty<IReadOnlyList<string>>()),
            new ExcelExport.SheetSpec("Yo'riqnoma", new[] { "Maydon", "Izoh" }, info),
        });
        return File(bytes, XlsxMime, "oquvchilar_shablon.xlsx");
    }

    /// <summary>
    /// To'ldirilgan Excel (.xlsx) shablonidan o'quvchilarni ommaviy yaratadi. Har qator alohida
    /// tekshiriladi: F.I.SH va Sinf majburiy, Sinf mavjud bo'lishi shart. To'g'ri qatorlar yaratiladi
    /// (akkaunt + oylik hisob bilan), xato qatorlar raqami/sababi bilan qaytariladi (qisman import).
    /// </summary>
    [HttpPost("import")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<StudentImportResultDto>> Import(IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Fayl tanlanmagan" });
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Faqat .xlsx (Excel) fayl qabul qilinadi" });

        List<string[]> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelImport.ReadRows(stream, ImportHeaders.Length);
        }
        catch
        {
            return BadRequest(new { message = "Faylni o'qib bo'lmadi — buzilmagan .xlsx ekanini tekshiring" });
        }

        // Sinflar oldindan yuklab olinadi (har qatorda DB so'rovi bo'lmasligi uchun).
        var classByName = (await db.Classes.ToListAsync())
            .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var errors = new List<StudentImportRowErrorDto>();
        int created = 0, skipped = 0;

        // 0-qator — sarlavha; ma'lumot 1-indeksdan boshlanadi (Excel'dagi 2-qator).
        // Ustunlar tartibi: 0=FISH, 1=telefon, 2=ota ismi, 3=ota tel, 4=ona ismi, 5=ona tel, 6=guruh (ixtiyoriy), 7=holat, 8=tug'ilgan sana, 9=jinsi
        for (var i = 1; i < rows.Count; i++)
        {
            var r = rows[i];
            var excelRow = i + 1; // Excel'da 1-asosli qator raqami

            if (r.All(string.IsNullOrWhiteSpace)) { skipped++; continue; }

            var fullName = r[0].Trim();
            if (string.IsNullOrWhiteSpace(fullName))
            { errors.Add(new StudentImportRowErrorDto(excelRow, "F.I.SH bo'sh")); continue; }

            // Ota-ona: father yoki mother (bo'lsa) ishlatiladi
            var fatherFullName = r[2].Trim();
            var fatherPhone = r[3].Trim();
            var motherFullName = r[4].Trim();
            var motherPhone = r[5].Trim();

            // GURUH — ixtiyoriy. Bo'sh bo'lsa faqat Student yaratiladi (guruhga qo'shilmay).
            var groupName = r[6].Trim();
            Group? cls = null;
            if (!string.IsNullOrWhiteSpace(groupName))
            {
                if (!classByName.TryGetValue(groupName, out cls))
                {
                    errors.Add(new StudentImportRowErrorDto(excelRow, $"Guruh topilmadi: \"{groupName}\""));
                    continue;
                }
            }

            var payload = new StudentPayload(
                FullName: fullName,
                BirthDate: NormalizeDate(r[8]),
                Address: "",
                Gender: NormalizeGender(r[9]),
                ParentFullName: null,
                ParentPhone: null,
                ClassName: cls?.Name ?? "", // guruh bo'lsa guruh nomi, aks holda bo'sh
                EnrollmentDate: null,
                Phone: PhoneUtil.Normalize(r[1]),
                FatherFullName: fatherFullName.Length > 0 ? fatherFullName : null,
                FatherPhone: fatherPhone.Length > 0 ? PhoneUtil.Normalize(fatherPhone) : null,
                MotherFullName: motherFullName.Length > 0 ? motherFullName : null,
                MotherPhone: motherPhone.Length > 0 ? PhoneUtil.Normalize(motherPhone) : null);

            // Holat — faqat guruh bo'lsa qo'llaniladi
            var status = cls is not null ? NormalizeGroupStatus(cls, r[7].Trim()) : "";
            AddStudent(payload, cls, status);
            created++;
        }

        if (created > 0) await db.SaveChangesAsync();
        return new StudentImportResultDto(created, errors.Count, skipped, errors);
    }

    private static string NormalizeGender(string raw)
    {
        var v = (raw ?? "").Trim().ToLowerInvariant();
        // qiz/female/ayol → female; qolgan hammasi (bo'sh, o'g'il, erkak, male, ...) → male
        return v is "qiz" or "female" or "ayol" or "f" or "q" or "2" ? "female" : "male";
    }

    private static string NormalizeStatus(string raw)
    {
        var v = (raw ?? "").Trim().ToLowerInvariant();
        // active yoki frozen bo'lsa shuning o'zi, aks holda default "trial"
        return v is "active" or "frozen" ? v : "trial";
    }

    private static readonly string[] DateFormats =
    {
        "yyyy-MM-dd", "yyyy/MM/dd", "dd.MM.yyyy", "d.M.yyyy", "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy",
    };

    /// <summary>Sanani "YYYY-MM-DD" ga keltiradi. Excel matn sanasini ham, raqamli (OADate) sanasini ham qabul qiladi.</summary>
    private static string NormalizeDate(string raw)
    {
        var v = (raw ?? "").Trim();
        if (v.Length == 0) return "";
        if (DateTime.TryParseExact(v, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return d.ToString("yyyy-MM-dd");
        if (double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var oa) && oa is > 1 and < 600000)
        {
            try { return DateTime.FromOADate(oa).ToString("yyyy-MM-dd"); } catch { /* e'tiborsiz */ }
        }
        return v; // ixtiyoriy maydon — noma'lum format bo'lsa, kiritilganicha qoladi
    }

    private static int? ParseIntOrNull(string raw)
    {
        var v = (raw ?? "").Replace("%", "").Trim();
        return int.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    private static decimal? ParseDecimalOrNull(string raw)
    {
        var v = (raw ?? "").Replace(" ", "").Replace(",", "").Trim();
        return decimal.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    /// <summary>Bitta guruh bo'yicha o'quvchining oylik hisobi (to'lov oynasi uchun) — aggregate emas, faqat
    /// shu guruh narxi + shu guruhga teglangan to'lovlar. O'quvchi bir nechta guruhda o'qisa shu kerak.</summary>
    [HttpGet("{id}/group-ledger")]
    public async Task<ActionResult<GroupLedgerDto>> GroupLedger(string id, [FromQuery] string groupId)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        var group = await db.Classes.FindAsync(groupId);
        if (group is null) return NotFound();
        var membership = await db.StudentGroups
            .FirstOrDefaultAsync(sg => sg.StudentId == id && sg.GroupId == groupId);
        if (membership is null)
            return new GroupLedgerDto(group.Id, group.Name, group.Name, new List<GroupMonthDto>());
        return await StudentGroupLedger.BuildAsync(db, student, group, membership);
    }

    /// <summary>O'quvchiga to'lov kiritish — balansga qo'shiladi va moliyaga kirim sifatida yoziladi.
    /// <paramref name="req"/> ichida Month ("YYYY-MM") berilsa, to'lov shu oy uchun hisoblanadi.</summary>
    [HttpPost("{id}/payments")]
    public async Task<IActionResult> AddPayment(string id, PaymentRequest req)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();

        if (req.Amount <= 0)
            return BadRequest(new { message = "To'lov summasi musbat bo'lishi kerak" });

        // OY MAJBURIY — to'lov har doim aniq oyga bog'lanadi (per-guruh billing).
        var month = (req.Month ?? "").Trim();
        if (month.Length < 7)
            return BadRequest(new { message = "To'lov qaysi oy uchun ekanini tanlang" });

        // O'quvchining billable (faol, sinov emas) guruhlari. To'lov faqat aktivlashtirilgan guruhga.
        var billableGroups = await db.StudentGroups
            .Where(sg => sg.StudentId == student.Id && sg.IsActive && sg.Status != "trial")
            .Select(sg => sg.GroupId).ToListAsync();

        var groupId = string.IsNullOrWhiteSpace(req.GroupId) ? null : req.GroupId.Trim();
        if (billableGroups.Count >= 2)
        {
            // Bir nechta guruh — guruh MAJBURIY va o'quvchining billable guruhi bo'lishi shart.
            if (groupId is null || !billableGroups.Contains(groupId))
                return BadRequest(new { message = "To'lov qaysi guruh uchun ekanini tanlang" });
        }
        else if (billableGroups.Count == 1)
            groupId = billableGroups[0]; // yagona guruh — avtomatik
        else
            groupId = null; // guruhsiz (eski ClassName) o'quvchi

        // AVANS: to'lov tushadigan (guruh, oy) hisobi hali yo'q bo'lsa — shu zahoti ochamiz
        // (kelajak oyga oldindan to'lov; balans hisob miqdorida kamayadi, to'lov esa oshiradi).
        await TuitionService.EnsureChargeAsync(db, student, groupId, month);

        student.Balance += req.Amount;

        // Guruh nomi (audit/izoh uchun).
        var groupName = groupId is null ? null
            : (await db.Classes.Where(c => c.Id == groupId).Select(c => c.Name).FirstOrDefaultAsync());

        // To'lovni moliyaviy kirim (o'quvchi to'lovi) sifatida qayd etamiz.
        var tx = new FinanceTransaction
        {
            Date = AppClock.Today.ToString("yyyy-MM-dd"),
            Direction = "income",
            Category = "tuition",
            Amount = req.Amount,
            StudentId = student.Id,
            GroupId = groupId,
            Month = month,
            Note = $"O'quvchi to'lovi ({month})"
                + (groupName is null ? "" : $" [{groupName}]")
                + $" — {student.FullName}",
            Comment = string.IsNullOrWhiteSpace(req.Comment) ? null : req.Comment.Trim(),
            Method = string.IsNullOrWhiteSpace(req.Method) ? null : req.Method.Trim().ToLowerInvariant(),
            CreatedBy = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value, // mas'ul (chek uchun)
        };
        db.FinanceTransactions.Add(tx);

        audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "create",
            $"To'lov qabul qilindi: +{AuditService.Money(req.Amount)} so'm ({month} uchun)",
            after: AuditService.Snapshot(tx), studentId: student.Id);

        await db.SaveChangesAsync();

        // Avto SMS — o'quvchi tuition to'lovi qabul qilinganda ota-onaga ("To'lov" hodisasi).
        // Moliya bo'limidagi to'lov bilan bir xil xulq (FinanceController). {summa} = faqat raqam.
        await AutoSmsService.SendForStudentAsync(db, eskiz, AutoSmsService.TriggerPayment, student,
            $"{Request.Scheme}://{Request.Host}/api/sms/callback", extra: new Dictionary<string, string>
            {
                ["{summa}"] = MessageTokenizer.MoneyPlain(req.Amount),
            }, preferStudentPhone: true);

        // Chek (kvitansiya) uchun yaratilgan tranzaksiya id'sini qaytaramiz.
        return Ok(new { id = tx.Id });
    }

    /// <summary>O'quvchi to'lov tarixi: oylar bo'yicha hisoblangan/to'langan holat.</summary>
    [HttpGet("{id}/ledger")]
    public async Task<ActionResult<StudentLedgerDto>> Ledger(string id)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        return await StudentLedger.BuildAsync(db, student);
    }

    /// <summary>FAQAT super admin: shu oyning HISOBLANGAN summasini qo'lda tahrirlaydi.
    /// Balans effektiv (summa − chegirma) farqiga moslanadi; o'zgarish auditga yoziladi.</summary>
    [HttpPut("{id}/charges/{month}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> EditCharge(string id, string month, EditChargeRequest req, [FromQuery] string? groupId = null)
    {
        var student = await db.Students.FindAsync(id);
        if (student is null) return NotFound();
        // Per-guruh: qaysi guruh hisobi tahrirlanmoqda (null = guruhsiz/ClassName hisobi).
        var gid = string.IsNullOrWhiteSpace(groupId) ? null : groupId.Trim();
        var charge = await db.MonthlyCharges
            .FirstOrDefaultAsync(c => c.StudentId == id && c.GroupId == gid && c.Month == month);
        if (charge is null) return NotFound(new { message = "Bu oy uchun hisob topilmadi" });

        var newAmount = Math.Max(0m, req.Amount);
        // Chegirma yangi summadan oshib ketmasin (effektiv manfiy bo'lmasin).
        if (charge.Discount > newAmount) charge.Discount = newAmount;

        var oldAmount = charge.Amount;
        var oldEffective = Math.Max(0m, oldAmount - charge.Discount);
        var newEffective = Math.Max(0m, newAmount - charge.Discount);
        // Hisob balansni EFFEKTIV miqdorda kamaytirgan edi — farqni balansga qaytaramiz.
        student.Balance += oldEffective - newEffective;
        charge.Amount = newAmount;
        charge.Locked = true; // qo'lda tahrirlandi — avtomatik qayta hisob endi bu yozuvni o'zgartirmaydi.

        audit.Record(AuditService.EntityStudentDiscount, student.Id, "update",
            $"Oylik hisob qo'lda tahrirlandi ({month}): {AuditService.Money(oldAmount)} → {AuditService.Money(newAmount)} so'm — {student.FullName}",
            studentId: student.Id);

        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}
