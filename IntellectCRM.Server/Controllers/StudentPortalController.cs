using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Infrastructure.Auth;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;
using System.Security.Claims;
using System.Text.Json;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'quvchi (oila) ilovasi API'si — `/api/student/*`. Asosiy foydalanuvchi `student` roli (o'z
/// ma'lumotini o'zi ko'radi), lekin `admin` roli ham `?studentId=...` so'rovi orqali istalgan
/// o'quvchining ma'lumotini ko'ra oladi (admin'ga alohida ko'rinish endpointlari qilmaslik uchun).
/// Mutatsiyalar (xabar yuborish, vazifa topshirish, fayl yuklash, shaxsiy sozlamani saqlash)
/// — faqat `student` rolida: admin boshqa odam nomidan amal qila olmaydi.
/// </summary>
[ApiController]
[Authorize(Roles = "student,parent,admin")]
[Route("api/student")]
public class StudentPortalController(
    AppDbContext db, ChatService chat, IWebHostEnvironment env, ReferenceCache refCache,
    TelegramService telegram, IConfiguration config, DataCache dataCache) : ControllerBase
{

    /// <summary>
    /// Maqsadli o'quvchini topadi.
    /// • student → o'z akkauntidan (UserId bo'yicha)
    /// • parent  → logini (email) telefon raqami sifatida Student.ParentPhone bilan taqqoslanadi
    /// • admin   → ?studentId=... query param orqali istalgan o'quvchi
    /// </summary>
    private async Task<Student?> TargetAsync(string? studentId)
    {
        if (User.IsInRole("admin"))
        {
            if (string.IsNullOrWhiteSpace(studentId)) return null;
            return await db.Students.FindAsync(studentId);
        }
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return null;

        if (User.IsInRole("parent"))
        {
            var user = await db.Users.FindAsync(uid);
            if (user is null) return null;
            // Telefonlar bazaga HAR DOIM PhoneUtil.Normalize orqali yoziladi (StudentsController
            // Create/Update va CSV import — barcha yozuv yo'llari kanonik "+998-XX-XXX-XX-XX" formatda
            // saqlaydi; Normalize idempotent). Shu sababli kiruvchi login-telefonni bir marta Normalize
            // qilib DB TOMONDA taqqoslash mumkin — butun jadvalni xotiraga yuklamaymiz.
            var norm = PhoneUtil.Normalize(user.Email);
            if (string.IsNullOrEmpty(norm)) return null;
            // Ota ham, ona ham kira oladi — ASOSIY/ota/ona telefonidan birortasi mos kelsa yetarli.
            var children = await db.Students.AsNoTracking()
                .Where(s => !s.IsArchived
                            && (s.ParentPhone == norm || s.FatherPhone == norm || s.MotherPhone == norm))
                .ToListAsync();
            // studentId berilsa — SHU farzand (FAQAT o'ziniki bo'lsa; egalik tekshiruvi). Aks holda birinchi farzand.
            return string.IsNullOrWhiteSpace(studentId)
                ? children.FirstOrDefault()
                : children.FirstOrDefault(s => s.Id == studentId);
        }

        return await db.Students.FirstOrDefaultAsync(s => s.UserId == uid);
    }

    /// <summary>
    /// Mutatsiya (yozish) amallari uchun — FAQAT student rolida; admin impersonate qila olmaydi.
    /// </summary>
    private async Task<Student?> MeAsync()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return uid is null ? null : await db.Students.FirstOrDefaultAsync(s => s.UserId == uid);
    }

    /// <summary>O'quvchining guruh id'sini (nomidan) topadi.</summary>
    private async Task<string?> ClassIdOf(Student s) =>
        (await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName))?.Id;

    /// <summary>Admin uchun: studentId berilmagan bo'lsa 400 javobi.</summary>
    private ActionResult NeedStudentId() =>
        BadRequest(new { message = "Admin chaqiruvi uchun ?studentId=... kerak" });

    /// <summary>Yuklangan faylni `uploads/` ga saqlab, `/uploads/...` manzilini qaytaradi.</summary>
    private async Task<string> SaveUploadAsync(IFormFile file)
    {
        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = Application.Services.UploadGuard.SafeName(file);
        await using var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored));
        await file.CopyToAsync(fs);
        return $"/uploads/{stored}";
    }

    /// <summary>
    /// Ilova (ota-ona/o'quvchi) uchun Telegram bot holati va shu o'quvchi botda ro'yxatdan o'tganmi.
    /// Ilova birinchi kirilganda — agar <c>configured=true</c> va <c>registered=false</c> bo'lsa —
    /// foydalanuvchini botga (<c>deepLink</c>) yo'naltirib, e'lon olish uchun ro'yxatdan o'tishni taklif qiladi.
    /// </summary>
    [HttpGet("telegram")]
    [Authorize(Roles = "student,parent")]
    public async Task<ActionResult<object>> TelegramInfo([FromQuery] string? studentId)
    {
        var s = User.IsInRole("parent") ? await TargetAsync(null) : await MeAsync();
        if (s is null) return NotFound();
        var registered = await db.TelegramRegistrations.AnyAsync(r => r.StudentId == s.Id);
        var username = telegram.BotUsername ?? "";
        return Ok(new
        {
            configured = telegram.IsConfigured,
            botUsername = username,
            botName = telegram.BotName ?? "",
            deepLink = string.IsNullOrEmpty(username) ? "" : $"https://t.me/{username}",
            registered,
        });
    }

    /// <summary>
    /// Ota-ona (o'quvchi akkaunti orqali) taklif yoki shikoyat yuboradi. Faqat student rolida.
    /// Admin "Taklif va shikoyatlar" bo'limida ko'radi.
    /// </summary>
    [HttpPost("feedback")]
    [Authorize(Roles = "student,parent")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> SubmitFeedback(
        [FromForm] string type, [FromForm] string text, IFormFile? image)
    {
        // Student o'zi, parent farzandi nomidan yuboradi.
        var s = User.IsInRole("parent") ? await TargetAsync(null) : await MeAsync();
        if (s is null) return Unauthorized();
        var body = (text ?? "").Trim();
        if (body.Length == 0) return BadRequest(new { message = "Matn bo'sh" });
        if (image is not null && Application.Services.UploadGuard.Validate(image) is { } imgError)
            return BadRequest(new { message = imgError });

        var feedbackType = type == "complaint" ? "complaint" : "suggestion";
        var senderName = s.ParentFullName ?? "";
        db.Feedbacks.Add(new Feedback
        {
            StudentId = s.Id,
            ParentName = senderName,
            SenderRole = "parent",
            SenderName = senderName,
            Type = feedbackType,
            Text = body,
            ImageUrl = image is { Length: > 0 } ? await SaveUploadAsync(image) : null,
            CreatedAt = AppClock.Now,
            Status = "new",
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<StudentProfileDto>> Profile([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return new StudentProfileDto(
            s.Id, s.FullName, s.ClassName, s.BirthDate, s.Gender,
            s.ParentFullName, s.ParentPhone, s.EnrollmentDate,
            s.BirthCertificateUrl, s.ParentPassportUrl);
    }

    /// <summary>
    /// O'quvchining TO'LIQ "shaxsiy daftari" — admin ko'radigan detal sahifasi bilan AYNAN bir xil
    /// (<see cref="StudentProfileBuilder"/>): profil + shaxsiy ma'lumot (manzil, chegirma, guruh,
    /// hujjatlar, balans), fan×chorak baholar va o'rtacha, davomat (qoldirgan/kech + sabablar),
    /// intizomiy ball va tarixi, topshiriqlar ballari, OYLIK BAHOLASH (turlar×oy), uy vazifa/xulq
    /// jamlamasi va oylik trend — bularning bari bitta javobda.
    /// student — o'ziniki; parent — farzandiniki; admin — <c>?studentId=...</c>.
    /// </summary>
    [HttpGet("notebook")]
    public async Task<ActionResult<StudentNotebookDto>> Notebook([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return await StudentProfileBuilder.BuildAsync(db, s);
    }

    /// <summary>Markaz meta'si (chorak/dars vaqtlari/sabablar + joriy chorak/hafta) —
    /// hammaga bir xil, `studentId` shart emas.</summary>
    [HttpGet("meta")]
    public async Task<ActionResult<PortalMetaDto>> Meta() => await refCache.MetaAsync();

    /// <summary>Joriy markaz nomi — ilova brendingi/sarlavhasi uchun.</summary>
    [HttpGet("school")]
    public async Task<ActionResult<SchoolNameDto>> School()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new SchoolNameDto(m?.Name ?? "", m?.TelegramChannel ?? "", m?.LogoUrl ?? "");
    }

    /// <summary>Ilova bildirishnomalari tarixi (yuborilgan push'lar) — o'qilmaganlar soni bilan.</summary>
    [HttpGet("notifications")]
    public async Task<ActionResult<NotificationsResponseDto>> Notifications()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var items = await db.UserNotifications.Where(n => n.UserId == uid)
            .OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync();
        var unread = items.Count(n => n.ReadAt == null);
        return new NotificationsResponseDto(unread, items.Select(n =>
            new UserNotificationDto(n.Id, n.Title, n.Body, n.Type, n.CreatedAt.ToString("o"),
                n.ReadAt != null, n.ConfirmedAt != null)).ToList());
    }

    /// <summary>Barcha bildirishnomalarni o'qilgan deb belgilaydi.</summary>
    [HttpPost("notifications/read")]
    public async Task<IActionResult> MarkNotificationsRead()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var unread = await db.UserNotifications.Where(n => n.UserId == uid && n.ReadAt == null).ToListAsync();
        foreach (var n in unread) n.ReadAt = AppClock.Now;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Bitta bildirishnomani TASDIQLAYDI (o'qib tasdiqladim) — admin shu holatni ko'radi.</summary>
    [HttpPost("notifications/{id}/confirm")]
    public async Task<IActionResult> ConfirmNotification(string id)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var n = await db.UserNotifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == uid);
        if (n is null) return NotFound();
        if (n.ConfirmedAt is null)
        {
            n.ConfirmedAt = AppClock.Now;
            n.ReadAt ??= AppClock.Now;
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    /// <summary>
    /// O'quvchining intizomiy balli: qoldi (100 dan boshlanadi) + rag'bat(+)/jazo(−) + tarix.
    /// Tarix qo'lda kiritilgan ballar va jurnal davomati (sabab balli != 0) yozuvlaridan iborat.
    /// </summary>
    [HttpGet("discipline")]
    public async Task<ActionResult<StudentDisciplineDto>> Discipline([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        var manual = await db.DisciplinePoints.Where(p => p.StudentId == s.Id).ToListAsync();
        var drNames = await db.DisciplineReasons.ToDictionaryAsync(r => r.Id, r => r.Name);
        var absReasons = await db.AbsenceReasons.ToDictionaryAsync(r => r.Id, r => new { r.Name, r.Points });

        var items = manual.Select(p => new DisciplinePointDto(
            p.Id, p.StudentId,
            string.IsNullOrEmpty(p.ReasonName) ? drNames.GetValueOrDefault(p.ReasonId, "—") : p.ReasonName,
            p.Points, p.Note, p.CreatedAt, p.CreatedBy, "manual")).ToList();

        var journal = await db.JournalEntries
            .Where(e => e.StudentId == s.Id && e.ReasonId != null).ToListAsync();
        foreach (var e in journal)
        {
            if (e.ReasonId is null || !absReasons.TryGetValue(e.ReasonId, out var r) || r.Points == 0) continue;
            items.Add(new DisciplinePointDto(e.Id, s.Id, r.Name, r.Points, "Jurnal davomati", e.Date, "", "attendance"));
        }

        var plus = items.Where(i => i.Points > 0).Sum(i => i.Points);
        var minus = items.Where(i => i.Points < 0).Sum(i => -i.Points);
        var ordered = items.OrderByDescending(i => i.CreatedAt, StringComparer.Ordinal).ToList();
        return new StudentDisciplineDto(100 + plus - minus, plus, minus, ordered);
    }

    // ---------- Baholar va davomat (o'ziniki) ----------

    [HttpGet("grades")]
    public async Task<ActionResult<StudentReportDto>> Grades([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return await StudentReportBuilder.BuildAsync(db, s);
    }

    /// <summary>
    /// O'quvchi reytingi (admin "Reyting"i bilan bir xil hisob — o'rtacha baho bo'yicha):
    /// <b>o'z guruhini to'liq</b>, <b>markaz bo'yicha esa faqat TOP 15</b> ko'radi.
    /// O'z qatori `MeStudentId` bilan, markaz o'rni (top 15 dan tashqarida bo'lsa ham) `MeSchoolRank` bilan beriladi.
    /// Parent farzandi nomidan; admin uchun `?studentId=` shart.
    /// </summary>
    [HttpGet("rating")]
    public async Task<ActionResult<PortalRatingDto>> Rating([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        // YIG'ILGAN BALL bo'yicha kamayish tartibida (o'rtacha baho emas; teng bo'lsa o'rtacha baho hal qiladi).
        // Butun markaz reytingi admin endpointi bilan BIR xil kesh kalitidan ("rating:school") o'qiladi —
        // bog'liq jadval o'zgarsa interceptor uni avtomatik yangilaydi.
        var school = (await dataCache.GetOrCreateAsync(
                "rating:school",
                new[]
                {
                    nameof(JournalEntry), nameof(LessonNote), nameof(Student),
                    nameof(StudentGroup), nameof(Group), nameof(AbsenceReason), nameof(CriterionGrade),
                },
                TimeSpan.FromMinutes(15),
                db2 => RatingService.SchoolAsync(db2)))
            .OrderByDescending(r => r.Ball)
            .ThenByDescending(r => r.Average)
            .ToList();

        static PortalRatingRowDto Map(StudentRatingRowDto r, int i) =>
            new(i + 1, r.Student.Id, r.Student.FullName, r.ClassName, r.Average, r.Attendance, r.Ball);

        var classRows = school
            .Where(r => r.ClassName == s.ClassName)
            .Select(Map).ToList();                       // o'z guruhi — to'liq
        var schoolRows = school.Take(15).Select(Map).ToList(); // markaz — top 15

        var meIdx = school.FindIndex(r => r.Student.Id == s.Id);
        int? meSchoolRank = meIdx >= 0 ? meIdx + 1 : null;

        return new PortalRatingDto(s.Id, classRows, schoolRows, meSchoolRank, school.Count);
    }

    /// <summary>
    /// O'quvchi davomati — chorak bo'yicha umumlashtirilgan ko'rsatkichlar + kunlik
    /// davomatsizlik/kech qolish yozuvlari ro'yxati.
    /// </summary>
    [HttpGet("attendance")]
    public async Task<ActionResult<StudentAttendanceFullDto>> Attendance(
        [FromQuery] int? quarter, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null) return new StudentAttendanceFullDto(
            new StudentAttendanceDto(new(), new(), new(), new(), new()),
            new List<StudentAbsenceRowDto>());

        var report = await StudentReportBuilder.BuildAsync(db, s);

        var subjects = await db.Subjects.ToDictionaryAsync(x => x.Id, x => x.Name);
        var reasonRows = await db.AbsenceReasons.ToListAsync();
        var reasons = reasonRows.ToDictionary(r => r.Id);

        var rowsQuery = db.JournalEntries
            .Where(e => e.ClassId == cls.Id && e.StudentId == s.Id && e.ReasonId != null);
        if (quarter.HasValue) rowsQuery = rowsQuery.Where(e => e.Quarter == quarter.Value);

        var rows = (await rowsQuery.ToListAsync())
            .OrderByDescending(e => e.Date, StringComparer.Ordinal).ThenByDescending(e => e.Period)
            .Select(e =>
            {
                reasons.TryGetValue(e.ReasonId!, out var r);
                var name = r?.Name ?? "";
                return new StudentAbsenceRowDto(
                    e.Date, e.Period, e.Quarter,
                    e.SubjectId, subjects.GetValueOrDefault(e.SubjectId, ""),
                    e.ReasonId!, name, r?.IsLate ?? false,
                    name.ToLowerInvariant().Contains("kasal"));
            })
            .ToList();

        return new StudentAttendanceFullDto(report.Attendance, rows);
    }

    /// <summary>
    /// Bosh sahifa uchun YAGONA chaqiruv — profil + meta + bugungi darslar + bugungi baholar +
    /// bajarilmagan topshiriqlar soni + balans. Bir o'rinda hammasi (Flutter Dashboard ekraniga mos).
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<StudentDashboardDto>> Dashboard([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        var profile = new StudentProfileDto(
            s.Id, s.FullName, s.ClassName, s.BirthDate, s.Gender,
            s.ParentFullName, s.ParentPhone, s.EnrollmentDate,
            s.BirthCertificateUrl, s.ParentPassportUrl);
        var meta = await refCache.MetaAsync();

        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);

        // Bugungi darslar — jadval tizimi olib tashlangan; bugun yozilgan darslar (LessonNote) bo'yicha.
        var today = AppClock.Today.ToString("yyyy-MM-dd");

        var todayLessons = new List<StudentLessonDto>();
        var todayGrades = new List<HomeworkItemDto>();
        if (cls is not null)
        {
            var subjects = await db.Subjects.ToDictionaryAsync(x => x.Id, x => x.Name);
            var teacherNames = await db.Teachers.ToDictionaryAsync(x => x.Id, x => x.FullName);
            var teacherByGroupSubject = new Dictionary<string, string>();
            if (!string.IsNullOrEmpty(cls.CourseId) && !string.IsNullOrEmpty(cls.TeacherId))
                teacherByGroupSubject[cls.CourseId] = cls.TeacherId;

            var todayNotes = await db.LessonNotes
                .Where(n => n.ClassId == cls.Id && n.Date == today)
                .ToListAsync();

            todayLessons = todayNotes
                .OrderBy(n => n.Period)
                .Select(n =>
                {
                    var teacherId = teacherByGroupSubject.GetValueOrDefault(n.SubjectId, "");
                    return new StudentLessonDto(
                        0, n.Period, null, null,
                        n.SubjectId, subjects.GetValueOrDefault(n.SubjectId, ""),
                        teacherId, teacherNames.GetValueOrDefault(teacherId, ""));
                })
                .ToList();

            // Bugungi baholar — shu o'quvchining bugungi jurnal yozuvlari (Grade != null).
            var entries = await db.JournalEntries
                .Where(e => e.ClassId == cls.Id && e.StudentId == s.Id && e.Date == today && e.Grade != null)
                .ToListAsync();
            var notes = await db.LessonNotes
                .Where(n => n.ClassId == cls.Id && n.Date == today)
                .ToListAsync();
            var noteMap = notes.ToDictionary(n => (n.Date, n.Period, n.SubjectId));
            var reasons = await db.AbsenceReasons.ToDictionaryAsync(r => r.Id);

            todayGrades = entries
                .OrderBy(e => e.Period)
                .Select(e =>
                {
                    noteMap.TryGetValue((e.Date, e.Period, e.SubjectId), out var n);
                    AbsenceReason? r = null;
                    if (e.ReasonId is not null) reasons.TryGetValue(e.ReasonId, out r);
                    return new HomeworkItemDto(
                        e.Date, e.Period, e.SubjectId, subjects.GetValueOrDefault(e.SubjectId, ""),
                        n?.Topic ?? "", n?.Homework, n?.Conducted ?? true,
                        e.Grade, e.ReasonId, r?.Name, r?.IsLate ?? false);
                })
                .ToList();
        }

        // Bajarilmagan topshiriqlar soni.
        int pending = 0;
        var classId = cls?.Id;
        if (classId is not null)
        {
            var assignments = await AssignmentService.ListForStudentAsync(db, classId, s.Id);
            pending = assignments.Count(a => !a.Completed);
        }

        var monthlyFee = cls?.MonthlyFee ?? 0m;

        return new StudentDashboardDto(
            profile, meta, todayLessons, todayGrades, pending, s.Balance, monthlyFee);
    }

    // ---------- Foydalanuvchi sozlamalari (til, tema, bildirishnoma) ----------

    /// <summary>Foydalanuvchi sozlamasini qaytaradi. Student — o'ziniki; admin — `?studentId` o'quvchining
    /// foydalanuvchisi (o'quvchiga akkaunt biriktirilmagan bo'lsa default qaytadi).</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<UserSettingsDto>> GetSettings([FromQuery] string? studentId)
    {
        string? targetUid;
        if (User.IsInRole("admin"))
        {
            if (string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
            var st = await db.Students.FindAsync(studentId);
            if (st is null) return NotFound();
            targetUid = st.UserId;
        }
        else
        {
            targetUid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
        if (string.IsNullOrWhiteSpace(targetUid))
            return new UserSettingsDto("uz", "system", true);
        var us = await db.UserSettings.FindAsync(targetUid);
        return us is null
            ? new UserSettingsDto("uz", "system", true)
            : new UserSettingsDto(us.Language, us.Theme, us.NotificationsEnabled);
    }

    /// <summary>Sozlamani yangilash (qator yo'q bo'lsa yaratiladi). Faqat student rolida — o'ziniki.</summary>
    [HttpPut("settings")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult<UserSettingsDto>> SaveSettings(SaveUserSettingsRequest req)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var st = await db.UserSettings.FindAsync(uid);
        if (st is null)
        {
            st = new UserSettings { UserId = uid };
            db.UserSettings.Add(st);
        }
        if (!string.IsNullOrWhiteSpace(req.Language)) st.Language = req.Language!.Trim();
        if (!string.IsNullOrWhiteSpace(req.Theme)) st.Theme = req.Theme!.Trim();
        if (req.NotificationsEnabled.HasValue) st.NotificationsEnabled = req.NotificationsEnabled.Value;
        st.UpdatedAt = AppClock.Now;
        await db.SaveChangesAsync();
        return new UserSettingsDto(st.Language, st.Theme, st.NotificationsEnabled);
    }

    /// <summary>
    /// O'quvchi/ota-ona ilova ichida o'z parolini almashtiradi. Joriy parol bilan tasdiqlanadi,
    /// yangi parol kamida 8 belgi. Faqat o'zinikiga (admin bu yerda impersonate qila olmaydi).
    /// Login (email) o'zgarmagani uchun joriy token amal qilaveradi — qayta kirish shart emas.
    /// </summary>
    [HttpPut("password")]
    [Authorize(Roles = "student,parent")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var user = await db.Users.FindAsync(uid);
        if (user is null) return Unauthorized();

        if (!PasswordHasher.Verify(req.CurrentPassword ?? "", user.PasswordHash))
            return BadRequest(new { message = "Joriy parol noto'g'ri" });

        var newPwd = (req.NewPassword ?? "").Trim();
        if (newPwd.Length < 8)
            return BadRequest(new { message = "Yangi parol kamida 8 belgidan iborat bo'lsin" });

        user.SetOwnPassword(newPwd);
        await db.SaveChangesAsync();
        return Ok(new { message = "Parol almashtirildi" });
    }

    // ---------- Joylashuv (GPS) ----------

    /// <summary>
    /// Uy joylashuvini yangilash — mobil ilova GPS dan keladi (latitude/longitude, ixtiyoriy address).
    /// Ilova foydalanuvchisi (o'quvchi/ota-ona — bitta akkaunt) o'z joylashuvini kiritadi (admin impersonate emas).
    /// Saqlangan joylashuv admin "Ilova → Joylashuv" xaritasida (Leaflet) ko'rinadi.
    /// </summary>
    [HttpPut("location")]
    [Authorize(Roles = "student,parent")]
    public async Task<ActionResult> UpdateLocation(UpdateLocationRequest req)
    {
        var s = await TargetAsync(null);   // akkauntga bog'langan o'quvchi
        if (s is null) return NotFound();
        if (req.Latitude is < -90 or > 90 || req.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Koordinatalar noto'g'ri" });
        s.Latitude = req.Latitude;
        s.Longitude = req.Longitude;
        s.LocationAddress = (req.Address ?? "").Trim();
        s.LocationUpdatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Joriy saqlangan joylashuvni o'qish (ilova xaritada ko'rsatishi uchun). Hali yo'q bo'lsa null'lar.</summary>
    [HttpGet("location")]
    public async Task<ActionResult<StudentLocationDto>> GetLocation([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return new StudentLocationDto(s.Latitude, s.Longitude, s.LocationAddress, s.LocationUpdatedAt);
    }

    // ---------- Push bildirishnoma (qurilma tokeni) ----------

    /// <summary>Push (FCM/APNs/Web) qurilma tokenini ro'yxatdan o'tkazadi (yangi bo'lsa qo'shadi,
    /// mavjud bo'lsa LastSeenAt yangilanadi). Token boshqa foydalanuvchiga bog'langan bo'lsa
    /// joriy foydalanuvchiga ko'chiriladi (qurilma boshqa akkauntga kirgan deb hisoblanadi).
    /// Faqat student rolida — token tokendagi foydalanuvchiga bog'lanadi.</summary>
    [HttpPost("notifications/register")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult> RegisterDevice(RegisterDeviceRequest req)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var token = req.Token?.Trim();
        if (string.IsNullOrWhiteSpace(token)) return BadRequest(new { message = "Token bo'sh" });
        var platform = string.IsNullOrWhiteSpace(req.Platform) ? "android" : req.Platform!.Trim().ToLowerInvariant();
        var deviceName = (req.DeviceName ?? "").Trim();
        var appId = (req.AppId ?? "").Trim();

        var existing = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token);
        if (existing is null)
        {
            db.DeviceTokens.Add(new DeviceToken
            {
                UserId = uid,
                Token = token,
                Platform = platform,
                DeviceName = deviceName,
                AppId = appId,
            });
        }
        else
        {
            existing.UserId = uid;
            existing.Platform = platform;
            if (deviceName.Length > 0) existing.DeviceName = deviceName;
            if (appId.Length > 0) existing.AppId = appId;
            existing.LastSeenAt = AppClock.Now;
        }
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Qurilma tokenini o'chiradi (logout/disable). Topilmasa ham 200 qaytaradi.</summary>
    [HttpDelete("notifications/register")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult> UnregisterDevice([FromQuery] string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest(new { message = "Token bo'sh" });
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var d = await db.DeviceTokens.FirstOrDefaultAsync(x => x.Token == token && x.UserId == uid);
        if (d is not null)
        {
            db.DeviceTokens.Remove(d);
            await db.SaveChangesAsync();
        }
        return Ok(new { ok = true });
    }

    // ---------- To'lovlar (o'ziniki) ----------

    [HttpGet("finance")]
    public async Task<ActionResult<StudentLedgerDto>> Finance([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return await StudentLedger.BuildAsync(db, s);
    }

    // ---------- Guruh chati (o'z guruhi) ----------

    [HttpGet("chat")]
    public async Task<ActionResult<IEnumerable<ChatMessageDto>>> Chat(
        [FromQuery] string? since, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        if (string.IsNullOrEmpty(s.ClassName)) return new List<ChatMessageDto>();
        return await chat.GetMessagesAsync(s.ClassName, ChatService.ParseSince(since));
    }

    /// <summary>Chatga xabar yuborish — faqat student rolida (admin o'zining /api/admin/messages
    /// orqali yozadi; bu yerda admin impersonate qila olmaydi).</summary>
    [HttpPost("chat")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult<ChatMessageDto>> SendChat(SendChatRequest req)
    {
        var s = await MeAsync();
        if (s is null) return NotFound();
        if (string.IsNullOrEmpty(s.ClassName)) return BadRequest(new { message = "Guruh biriktirilmagan" });
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var dto = await chat.PostAsync(s.ClassName, uid, req.Text);
        return dto is null ? BadRequest(new { message = "Xabar bo'sh" }) : dto;
    }

    // ---------- Topshiriqlar / testlar (o'z guruhi) ----------

    /// <summary>O'z guruhiga berilgan topshiriqlar — har birida o'z holati (bajardi/ball).</summary>
    [HttpGet("assignments")]
    public async Task<ActionResult<IEnumerable<StudentAssignmentDto>>> Assignments(
        [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var classId = await ClassIdOf(s);
        if (classId is null) return new List<StudentAssignmentDto>();
        return await AssignmentService.ListForStudentAsync(db, classId, s.Id);
    }

    /// <summary>SPEAKING topshirig'i — o'quvchi audio (WAV) yuboradi, Azure talaffuzni baholaydi,
    /// natija + avto-baho saqlanadi va qaytariladi.</summary>
    [HttpPost("assignments/{id}/speaking")]
    [Authorize(Roles = "student,parent")]
    [RequestSizeLimit(8_000_000)]
    public async Task<ActionResult<SpeakingResultDto>> SubmitSpeaking(string id, IFormFile audio)
    {
        var s = await TargetAsync(null);
        if (s is null) return NotFound();
        // FIX 1 — egalik: topshiriq o'quvchining guruhiga tegishli bo'lishi shart (normal yo'l kabi).
        var classId = await ClassIdOf(s);
        var a = await db.Assignments.FindAsync(id);
        if (a is null || a.Format != "speaking" || classId is null || !a.ClassIds.Contains(classId))
            return NotFound(new { message = "Speaking topshirig'i topilmadi" });

        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var key = meta?.AzureSpeechKey ?? "";
        var region = meta?.AzureSpeechRegion ?? "";
        if (!AzureSpeechService.IsConfigured(key, region))
            return BadRequest(new { message = "Speaking baholash hali sozlanmagan (admin Azure kalitini kiritishi kerak)." });
        if (audio is null || audio.Length == 0) return BadRequest(new { message = "Audio bo'sh" });
        // FIX 3 — hajm chegarasi (60s 16kHz mono WAV ≈ 2 MB; 8 MB yetarli zaxira).
        if (audio.Length > 8_000_000) return BadRequest(new { message = "Audio juda katta (8 MB dan oshmasin)." });

        var sub = await db.AssignmentSubmissions.FirstOrDefaultAsync(x => x.AssignmentId == id && x.StudentId == s.Id);
        // FIX 4 — rate-limit: ketma-ket pullik Azure chaqiruvlarini cheklash (5s cooldown).
        if (sub is not null && DateTime.TryParse(sub.SubmittedAt, out var last)
            && (AppClock.Now - last).TotalSeconds < 5)
            return BadRequest(new { message = "Biroz kuting — qayta urinishdan oldin bir necha soniya o'ting." });

        using var ms = new MemoryStream();
        await audio.CopyToAsync(ms);
        var bytes = ms.ToArray();
        // FIX 3 — kontent tekshiruvi: faqat haqiqiy WAV Azure'ga ketadi (ixtiyoriy bayt emas).
        if (!AzureSpeechService.LooksLikeWav(bytes))
            return BadRequest(new { message = "Audio formati noto'g'ri (WAV kutilgan)." });

        var result = await AzureSpeechService.AssessAsync(bytes, a.ReferenceText, key, region);
        if (result.Error is not null) return BadRequest(new { message = result.Error });

        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = $"speaking-{Guid.NewGuid():N}.wav";
        await System.IO.File.WriteAllBytesAsync(System.IO.Path.Combine(dir, stored), bytes);

        if (sub is null) { sub = new AssignmentSubmission { AssignmentId = id, StudentId = s.Id }; db.AssignmentSubmissions.Add(sub); }
        sub.Completed = true;
        sub.SubmittedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        // FIX 2 — PronScore (0..100) ni topshiriq MaxScore'iga masshtablash (boshqa formatlar kabi).
        var max = a.MaxScore > 0 ? a.MaxScore : 100;
        sub.Score = Math.Clamp((int)Math.Round(result.PronScore * max / 100.0), 0, max);
        sub.FileUrl = $"/uploads/{stored}";
        sub.SpeakingResultJson = JsonSerializer.Serialize(result);
        await db.SaveChangesAsync();
        return result;
    }

    /// <summary>Oldingi speaking natijasini o'qish (bor bo'lsa) — qaytadan ko'rsatish uchun.</summary>
    [HttpGet("assignments/{id}/speaking")]
    public async Task<ActionResult<SpeakingResultDto>> GetSpeaking(string id, [FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var sub = await db.AssignmentSubmissions.FirstOrDefaultAsync(x => x.AssignmentId == id && x.StudentId == s.Id);
        if (sub?.SpeakingResultJson is null) return NoContent();
        try
        {
            var r = JsonSerializer.Deserialize<SpeakingResultDto>(sub.SpeakingResultJson);
            return r is null ? NoContent() : r;
        }
        catch { return NoContent(); }
    }

    // ==================== AI tekshiruv (Speaking / Writing) ====================

    /// <summary>O'quvchining bugungi AI tekshiruv holati (kalitlar tayyorligi + limit/premium/blok).</summary>
    [HttpGet("ai-check/status")]
    public async Task<ActionResult<AiCheckStatusDto>> AiCheckStatus([FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var geminiReady = GeminiService.IsConfigured(meta?.GeminiApiKey);
        var azureReady = AzureSpeechService.IsConfigured(meta?.AzureSpeechKey, meta?.AzureSpeechRegion);
        var (premium, blocked, limit, used) = await AiAccessAsync(s.Id, meta);
        var remaining = premium ? 999 : Math.Max(0, limit - used);
        return new AiCheckStatusDto(geminiReady, azureReady, premium, blocked, limit, used, remaining);
    }

    /// <summary>O'quvchi AI tekshiruv tarixi (eng yangi birinchi).</summary>
    [HttpGet("ai-check/history")]
    public async Task<ActionResult<IEnumerable<AiCheckListItemDto>>> AiCheckHistory([FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        return await db.AiChecks.Where(a => a.StudentId == s.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AiCheckListItemDto(a.Id, a.Type, a.Prompt, a.Score, a.Date, a.CreatedAt, a.AudioUrl != ""))
            .ToListAsync();
    }

    /// <summary>Bitta AI tekshiruv yozuvi (to'liq — matn/ovoz/tahlil).</summary>
    [HttpGet("ai-check/history/{id}")]
    public async Task<ActionResult<AiCheckDto>> AiCheckItem(string id, [FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var a = await db.AiChecks.FirstOrDefaultAsync(x => x.Id == id && x.StudentId == s.Id);
        return a is null ? NotFound() : ToAiCheckDto(a);
    }

    /// <summary>Writing (yozma) — o'quvchi matn yozadi, Gemini tahlil qiladi va saqlaydi.</summary>
    [HttpPost("ai-check/writing")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult<AiCheckDto>> AiCheckWriting(AiCheckWritingRequest req)
    {
        var s = await MeAsync();
        if (s is null) return NotFound();
        var text = (req.Text ?? "").Trim();
        if (text.Length < 10) return BadRequest(new { message = "Matn juda qisqa (kamida 10 belgi)." });
        if (text.Length > 8000) text = text[..8000];

        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (await GuardLimitAsync(s.Id, meta) is { } limitError) return limitError;
        if (!GeminiService.IsConfigured(meta?.GeminiApiKey))
            return BadRequest(new { message = "AI tekshiruv hali sozlanmagan (admin Gemini kalitini kiritishi kerak)." });

        var taskType = (req.TaskType ?? "").Trim();
        if (taskType != "ielts_task1" && taskType != "ielts_task2") taskType = "";

        var model = GeminiService.ResolveModel(config);
        var prompt = AiCheckService.WritingPrompt(req.Prompt, text, taskType);
        var (ok, raw, err) = await GeminiService.GenerateAsync(meta!.GeminiApiKey, model, prompt, jsonMode: true);
        if (!ok) return BadRequest(new { message = err ?? "AI tahlil qilolmadi." });
        var analysis = AiCheckService.Parse(raw);
        if (analysis is null) return BadRequest(new { message = "AI javobini o'qib bo'lmadi. Qaytadan urinib ko'ring." });

        var rec = new AiCheck
        {
            StudentId = s.Id,
            Type = "writing",
            TaskType = taskType,
            Prompt = (req.Prompt ?? "").Trim(),
            InputText = text,
            // IELTS bo'lsa umumiy band (0-9), aks holda 0-100 ball.
            Score = taskType.Length > 0 && analysis.Ielts is not null ? analysis.Ielts.Overall : analysis.Overall,
            AnalysisJson = JsonSerializer.Serialize(analysis),
            Model = model,
            Date = AppClock.Today.ToString("yyyy-MM-dd"),
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
        db.AiChecks.Add(rec);
        await db.SaveChangesAsync();
        return ToAiCheckDto(rec);
    }

    /// <summary>
    /// Speaking (nutq) — ovoz yuboriladi. Oqim: Azure talaffuzni baholaydi (Pronunciation Assessment —
    /// nutqni matnga o'giradi + HAR SO'Z talaffuz aniqligi + umumiy ravonlik/ohang) → Gemini har so'z
    /// bo'yicha talaffuz maslahati beradi. Natijada: so'zlar yashil (yaxshi)/qizil (xato) + so'z soni. Ovoz saqlanadi.
    /// </summary>
    [HttpPost("ai-check/speaking")]
    [Authorize(Roles = "student")]
    [RequestSizeLimit(8_000_000)]
    public async Task<ActionResult<AiCheckDto>> AiCheckSpeaking(
        IFormFile audio, [FromForm] string? prompt, [FromForm] string? referenceText)
    {
        var s = await MeAsync();
        if (s is null) return NotFound();
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (await GuardLimitAsync(s.Id, meta) is { } limitError) return limitError;
        var key = meta?.AzureSpeechKey ?? "";
        var region = meta?.AzureSpeechRegion ?? "";
        if (!AzureSpeechService.IsConfigured(key, region))
            return BadRequest(new { message = "Speaking baholash hali sozlanmagan (admin Azure kalitini kiritishi kerak)." });
        if (!GeminiService.IsConfigured(meta?.GeminiApiKey))
            return BadRequest(new { message = "AI tahlil hali sozlanmagan (admin Gemini kalitini kiritishi kerak)." });
        if (audio is null || audio.Length == 0) return BadRequest(new { message = "Audio bo'sh" });
        if (audio.Length > 8_000_000) return BadRequest(new { message = "Audio juda katta (8 MB dan oshmasin)." });

        using var ms = new MemoryStream();
        await audio.CopyToAsync(ms);
        var bytes = ms.ToArray();
        if (!AzureSpeechService.LooksLikeWav(bytes))
            return BadRequest(new { message = "Audio formati noto'g'ri (WAV kutilgan)." });

        // 1-qadam: Azure talaffuzni baholaydi (matn + har so'z aniqligi + ravonlik/ohang).
        // Reference matn berilsa — aniq per-so'z baholash (scripted). Bo'lmasa erkin nutq:
        // talaffuz ballari kelmasligi mumkin — bu holda faqat matn + Gemini tahlili bo'ladi.
        var azure = await AzureSpeechService.AssessAsync(bytes, referenceText ?? "", key, region);
        if (azure.Error is not null) return BadRequest(new { message = azure.Error });
        // Talaffuz ballari haqiqatan keldimi? (erkin rejimda kelmasligi mumkin)
        var hasPron = azure.Words.Count > 0 || azure.PronScore > 0 || azure.Accuracy > 0;

        // Ovozni saqlaymiz (qayta eshitish uchun).
        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = $"aicheck-{Guid.NewGuid():N}.wav";
        await System.IO.File.WriteAllBytesAsync(System.IO.Path.Combine(dir, stored), bytes);

        // 2-qadam: Gemini — Azure talaffuz natijasini (har so'z aniqligi bilan) tahlil qiladi va maslahat beradi.
        var model = GeminiService.ResolveModel(config);
        var aiPrompt = AiCheckService.SpeakingPrompt(prompt, azure.RecognizedText, azure);
        var (ok, raw, err) = await GeminiService.GenerateAsync(meta!.GeminiApiKey, model, aiPrompt, jsonMode: true);
        var analysis = ok ? AiCheckService.Parse(raw) : null;
        // Gemini tahlili bo'lmasa ham Azure talaffuz natijasi (ballar + so'zlar) bilan yozuvni saqlaymiz.

        var rec = new AiCheck
        {
            StudentId = s.Id,
            Type = "speaking",
            Prompt = (prompt ?? "").Trim(),
            InputText = (referenceText ?? "").Trim(),
            RecognizedText = azure.RecognizedText,
            AudioUrl = $"/uploads/{stored}",
            Score = analysis?.Overall ?? azure.PronScore,
            // Talaffuz ballari kelgan bo'lsa saqlaymiz (per-so'z yashil/qizil); aks holda bo'sh.
            AzureJson = hasPron ? JsonSerializer.Serialize(azure) : "",
            AnalysisJson = analysis is null ? "" : JsonSerializer.Serialize(analysis),
            Model = model,
            Date = AppClock.Today.ToString("yyyy-MM-dd"),
            CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        };
        db.AiChecks.Add(rec);
        await db.SaveChangesAsync();
        return ToAiCheckDto(rec);
    }

    /// <summary>O'quvchi ruxsati: (premium, blocked, effektiv limit, bugun ishlatilgan).</summary>
    private async Task<(bool Premium, bool Blocked, int Limit, int Used)> AiAccessAsync(string studentId, CenterMeta? meta)
    {
        var access = await db.StudentAiAccesses.FirstOrDefaultAsync(a => a.StudentId == studentId);
        var defaultLimit = meta?.AiCheckDailyLimit > 0 ? meta.AiCheckDailyLimit : 3;
        var limit = access is { DailyLimit: > 0 } ? access.DailyLimit : defaultLimit;
        var today = AppClock.Today.ToString("yyyy-MM-dd");
        var used = await db.AiChecks.CountAsync(a => a.StudentId == studentId && a.Date == today);
        return (access?.IsPremium ?? false, access?.IsBlocked ?? false, limit, used);
    }

    /// <summary>Limit/blok tekshiruvi — buzilsa xato javobi, aks holda null (davom etadi).</summary>
    private async Task<ActionResult?> GuardLimitAsync(string studentId, CenterMeta? meta)
    {
        var (premium, blocked, limit, used) = await AiAccessAsync(studentId, meta);
        if (blocked) return StatusCode(403, new { message = "AI tekshiruv sizga cheklangan. Adminga murojaat qiling." });
        if (premium) return null;
        if (used >= limit)
            return StatusCode(429, new { message = $"Kunlik limit tugadi ({used}/{limit}). Premium uchun adminga murojaat qiling." });
        return null;
    }

    private static AiCheckDto ToAiCheckDto(AiCheck a)
    {
        var analysis = AiCheckService.ParseStored(a.AnalysisJson);
        AiCheckSpeechDto? speech = null;
        if (a.Type == "speaking" && !string.IsNullOrWhiteSpace(a.AzureJson))
        {
            try
            {
                var r = JsonSerializer.Deserialize<SpeakingResultDto>(a.AzureJson);
                if (r is not null)
                    speech = new AiCheckSpeechDto(r.RecognizedText, r.PronScore, r.Accuracy,
                        r.Fluency, r.Completeness, r.Prosody, r.Words ?? new());
            }
            catch { /* azure json buzuq — speech null */ }
        }
        return new AiCheckDto(a.Id, a.Type, a.Prompt, a.InputText, a.RecognizedText, a.AudioUrl,
            a.Score, a.Date, a.CreatedAt, analysis, speech, a.TaskType);
    }

    /// <summary>
    /// "Topshiriq ballari" — o'quvchiga berilgan topshiriqlar va uning har biridagi bali (+ yig'ma).
    /// Ota-ona ham shu orqali farzandi ballarini ko'radi.
    /// </summary>
    [HttpGet("assignment-scores")]
    public async Task<ActionResult<StudentAssignmentScoresDto>> AssignmentScores([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var classId = await ClassIdOf(s);
        if (classId is null) return new StudentAssignmentScoresDto(0, 0, 0, 0, new());
        return await AssignmentService.ScoresForStudentAsync(db, classId, s.Id);
    }

    /// <summary>Topshiriq tafsiloti (test bo'lsa — to'g'ri javobsiz savollar).</summary>
    [HttpGet("assignments/{id}")]
    public async Task<ActionResult<StudentAssignmentDetailDto>> Assignment(
        string id, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var classId = await ClassIdOf(s);
        if (classId is null) return NotFound();
        var dto = await AssignmentService.GetForStudentAsync(db, id, classId, s.Id);
        return dto is null ? NotFound() : dto;
    }

    /// <summary>Topshiriqni topshirish — faqat student rolida (admin o'zi o'rniga topshira olmaydi).</summary>
    [HttpPost("assignments/{id}/submit")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult<SubmitResultDto>> Submit(string id, SubmitAssignmentRequest req)
    {
        var s = await MeAsync();
        if (s is null) return NotFound();
        var classId = await ClassIdOf(s);
        if (classId is null) return NotFound();
        var res = await AssignmentService.SubmitAsync(db, id, classId, s.Id, req);
        return res is null ? NotFound() : res;
    }

    /// <summary>O'quvchi javobi sifatida fayl yuklash (rasm/PDF/video, maks ~20MB).
    /// Faqat student rolida — admin yuklamaydi.</summary>
    [HttpPost("uploads")]
    [Authorize(Roles = "student")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<UploadedFileDto>> Upload(IFormFile file)
    {
        var s = await MeAsync();
        if (s is null) return NotFound();
        if (Application.Services.UploadGuard.Validate(file) is { } error)
            return BadRequest(new { message = error });

        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = Application.Services.UploadGuard.SafeName(file);
        await using (var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);

        return new UploadedFileDto(file.FileName, $"/uploads/{stored}", file.Length, file.ContentType ?? "");
    }

    /* ─── Fan progresi (dars o'tilishiga qarab — LMS'siz) ──────
       Progress = o'tilgan darslar / chorakdagi reja darslar. O'qituvchi jurnalda
       "dars o'tildi" deb belgilashidan kelib chiqadi. */

    /// <summary>Barcha fanlar bo'yicha umumiy + har bir fan progresi (joriy/berilgan chorak).</summary>
    [HttpGet("subjects-progress")]
    public async Task<ActionResult<StudentSubjectsProgressDto>> SubjectsProgress(
        [FromQuery] int? quarter, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var q = quarter ?? 1;
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null) return new StudentSubjectsProgressDto(q, 0, 0, 0, new());
        return await SubjectProgressService.ForStudentAsync(db, cls.Id, q);
    }

    /// <summary>Bitta fanga kirilganda — darslar ro'yxati (yashil = o'tilgan, qizil = hali yo'q).</summary>
    [HttpGet("subjects-progress/{subjectId}")]
    public async Task<ActionResult<SubjectProgressDetailDto>> SubjectProgressDetail(
        string subjectId, [FromQuery] int? quarter, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null) return NotFound();
        var dto = await SubjectProgressService.ForStudentSubjectAsync(
            db, cls.Id, quarter ?? 1, subjectId);
        return dto is null ? NotFound() : dto;
    }

    /// <summary>O'quvchining O'QUV DASTURI — har bir faol guruh kursi bo'yicha o'tilgan/qolgan bandlar +
    /// foiz + tugash prognozi (Duolingo uslubidagi yo'l-xarita uchun). Guruh kursida dastur bo'lmasa chiqmaydi.</summary>
    [HttpGet("curriculum")]
    public async Task<ActionResult<IEnumerable<GroupCurriculumDto>>> Curriculum([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        var groupIds = await db.StudentGroups
            .Where(sg => sg.StudentId == s.Id && sg.IsActive)
            .Select(sg => sg.GroupId).Distinct().ToListAsync();
        var groups = await db.Classes
            .Where(c => groupIds.Contains(c.Id) && c.CourseId != "").ToListAsync();

        var result = new List<GroupCurriculumDto>();
        foreach (var g in groups)
        {
            var dto = await CurriculumForecast.BuildGroupAsync(db, g);
            if (dto.TotalItems > 0) result.Add(dto); // faqat dasturi bor kurslar
        }
        return result.OrderByDescending(r => r.TotalItems).ToList();
    }

    /// <summary>Bitta DARS kontentini o'qish (Duolingo node bosilganda ochiladi): video/matn/audio/lug'at/test.
    /// O'quvchi faqat o'z faol guruh(lar)i kursidagi darsni ko'ra oladi.</summary>
    [HttpGet("curriculum/item/{id}")]
    public async Task<ActionResult<CourseItemDetailDto>> CurriculumItem(string id, [FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        var i = await db.CourseItems.FindAsync(id);
        if (i is null) return NotFound();

        // O'quvchining faol guruhlari + ularning kurslari.
        var myGroups = await (from sg in db.StudentGroups
                              join c in db.Classes on sg.GroupId equals c.Id
                              where sg.StudentId == s.Id && sg.IsActive
                              select new { sg.GroupId, c.CourseId }).ToListAsync();
        // Faqat o'quvchining kursidagi darsni ko'rsatamiz.
        if (!myGroups.Any(g => g.CourseId == i.SubjectId)) return NotFound();

        // NAZORAT: dars FAQAT o'qituvchi shu guruhda "o'tildi" qilgach (GroupCurriculumLog) ochiladi.
        var myGroupIds = myGroups.Select(g => g.GroupId).ToList();
        var covered = await db.GroupCurriculumLogs
            .AnyAsync(g => myGroupIds.Contains(g.GroupId) && g.ItemId == id && !g.IsRevision);
        if (!covered)
            return StatusCode(403, new { message = "Bu dars hali ochilmagan — o'qituvchi o'tgach ochiladi", locked = true });

        var qs = await db.CourseQuestions.Where(q => q.ItemId == id).OrderBy(q => q.Order)
            .Select(q => new CourseQuestionDto(q.Id, q.Text, q.Options, q.CorrectIndex)).ToListAsync();
        var vocab = string.IsNullOrWhiteSpace(i.VocabJson)
            ? new List<VocabEntryDto>()
            : (TryDeserialize(i.VocabJson) ?? new());
        return new CourseItemDetailDto(
            i.Id, i.TopicId, i.Text, i.Note, i.Order, i.Type,
            i.VideoUrl, i.AudioUrl, i.TextContent, i.PdfUrl, i.PdfName,
            i.Meta, vocab, qs);
    }

    private static List<VocabEntryDto>? TryDeserialize(string json)
    {
        try { return JsonSerializer.Deserialize<List<VocabEntryDto>>(json); }
        catch { return null; }
    }

    /// <summary>O'quvchining BAHOLASH statistikasi (har faol guruh bo'yicha): mezonlarda
    /// OYLIK xulosa (nechta darsda bajardi / jami) + HAR DARSLIK belgilar.</summary>
    [HttpGet("grading")]
    public async Task<ActionResult<IEnumerable<StudentGradingGroupDto>>> Grading(
        [FromQuery] string? studentId, [FromQuery] string? month)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        var groups = await (from sg in db.StudentGroups
                            join c in db.Classes on sg.GroupId equals c.Id
                            where sg.StudentId == s.Id && sg.IsActive
                            select c).ToListAsync();

        var result = new List<StudentGradingGroupDto>();
        var cur = TuitionService.CurrentMonth();
        foreach (var g in groups)
        {
            var assigns = await db.GroupGradingCriteria.Where(x => x.GroupId == g.Id)
                .OrderBy(x => x.Order).ToListAsync();
            if (assigns.Count == 0) continue;
            var critIds = assigns.Select(a => a.CriterionId).ToList();
            var critDict = await db.GradingCriteria.Where(c => critIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
            var orderedCrits = assigns.Where(a => critDict.ContainsKey(a.CriterionId))
                .Select(a => critDict[a.CriterionId]).ToList();
            if (orderedCrits.Count == 0) continue;

            var startMonth = !string.IsNullOrEmpty(g.StartDate) && g.StartDate.Length >= 7 ? g.StartDate[..7] : cur;
            if (string.CompareOrdinal(startMonth, cur) > 0) startMonth = cur;
            var months = TuitionService.MonthRange(startMonth, cur).ToList();
            if (months.Count == 0) months.Add(cur);
            var resolved = !string.IsNullOrEmpty(month) && months.Contains(month) ? month! : months[^1];
            var dates = JournalService.LessonDatesInMonth(g.Days, resolved).ToList();
            var dateSet = dates.ToHashSet();

            var marks = await db.CriterionGrades
                .Where(x => x.GroupId == g.Id && x.StudentId == s.Id && x.Done && x.Date.StartsWith(resolved))
                .Select(x => new { x.CriterionId, x.Date }).ToListAsync();

            var byCriterion = marks.GroupBy(m => m.CriterionId)
                .ToDictionary(gr => gr.Key, gr => gr.Select(x => x.Date).ToHashSet());
            var criteria = orderedCrits.Select(c => new StudentGradingCriterionDto(
                c.Id, c.Name,
                byCriterion.TryGetValue(c.Id, out var ds) ? ds.Count(d => dateSet.Contains(d)) : 0,
                dates.Count)).ToList();

            var byDate = marks.GroupBy(m => m.Date)
                .ToDictionary(gr => gr.Key, gr => gr.Select(x => x.CriterionId).ToList());
            var lessons = dates.Select(d => new StudentGradingDateDto(
                d, byDate.TryGetValue(d, out var cids) ? cids : new List<string>())).ToList();

            // Yig'ilgan ball: shu oyda (dars sanalari bo'yicha) va shu guruhda BARCHA vaqt bo'yicha.
            var monthBall = criteria.Sum(c => c.Done);
            var totalBall = await db.CriterionGrades.CountAsync(x =>
                x.GroupId == g.Id && x.StudentId == s.Id && x.Done && critIds.Contains(x.CriterionId));

            result.Add(new StudentGradingGroupDto(
                g.Id, g.Name, months, resolved, dates, criteria, lessons, monthBall, totalBall));
        }
        return result;
    }

    // ---------- Support (yordam darslari — bo'sh vaqtga bron) ----------

    /// <summary>Support ekrani: bo'sh slotli support o'qituvchilar + o'quvchining o'z bronlari.</summary>
    [HttpGet("support")]
    public async Task<ActionResult<StudentSupportDto>> Support([FromQuery] string? studentId = null)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var today = AppClock.Today.ToString("yyyy-MM-dd");

        var supports = await db.Teachers.Where(t => t.IsSupport && !t.IsArchived)
            .OrderBy(t => t.FullName).ToListAsync();
        var supIds = supports.Select(t => t.Id).ToList();

        // Bo'sh + bugundan keyingi slotlar (sana ISO bo'lgani uchun matn taqqoslash to'g'ri).
        var openSlots = (await db.SupportSlots
                .Where(x => supIds.Contains(x.TeacherId) && x.Status == "open").ToListAsync())
            .Where(x => string.CompareOrdinal(x.Date, today) >= 0)
            .OrderBy(x => x.Date).ThenBy(x => x.StartTime).ToList();
        var openByTeacher = openSlots.GroupBy(x => x.TeacherId).ToDictionary(g => g.Key, g => g.ToList());

        // Har support o'qituvchi uchun dars beradigan kurslar nomini bitta so'rovda olamiz (N+1 dan qochish).
        var teacherCourseNames = await (
            from c in db.Classes
            join sub in db.Subjects on c.CourseId equals sub.Id
            where supIds.Contains(c.TeacherId)
            select new { c.TeacherId, sub.Name }
        ).ToListAsync();
        var subjectByTeacher = teacherCourseNames
            .GroupBy(x => x.TeacherId)
            .ToDictionary(
                g => g.Key,
                g => string.Join(", ", g.Select(x => x.Name).Distinct()));

        var supDtos = supports
            .Select(t => new StudentSupportTeacherDto(t.Id, t.FullName, t.PhotoUrl,
                subjectByTeacher.GetValueOrDefault(t.Id, ""),
                (openByTeacher.GetValueOrDefault(t.Id) ?? new())
                    .Select(x => new StudentSupportSlotDto(x.Id, x.Date, x.StartTime, x.EndTime)).ToList()))
            .Where(d => d.OpenSlots.Count > 0)
            .ToList();

        // Mening bronlarim (barcha holatlar — o'tilganlari mavzu/izoh bilan).
        var mine = await db.SupportSlots.Where(x => x.StudentId == s.Id)
            .OrderByDescending(x => x.Date).ThenBy(x => x.StartTime).ToListAsync();
        var tNames = (await db.Teachers.Where(t => mine.Select(m => m.TeacherId).Contains(t.Id)).ToListAsync())
            .ToDictionary(t => t.Id, t => t.FullName);
        var myBookings = mine.Select(x => new StudentSupportBookingDto(
            x.Id, x.TeacherId, tNames.GetValueOrDefault(x.TeacherId, ""), x.Date, x.StartTime, x.EndTime,
            x.Status, x.Topic, x.Notes)).ToList();

        return new StudentSupportDto(supDtos, myBookings);
    }

    /// <summary>Bo'sh slotni bron qilish.</summary>
    [HttpPost("support/slots/{id}/book")]
    public async Task<IActionResult> BookSupport(string id, [FromQuery] string? studentId = null)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var bookedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        // ATOMIK bron: faqat hali "open" va egasi yo'q slot yangilanadi. Ikki o'quvchi bir vaqtda bron
        // qilsa — faqat bittasi 1 qator yangilaydi, ikkinchisi 0 qator oladi → "band qilingan" (race-safe).
        var affected = await db.SupportSlots
            .Where(x => x.Id == id && x.Status == "open" && x.StudentId == null)
            .ExecuteUpdateAsync(up => up
                .SetProperty(x => x.StudentId, s.Id)
                .SetProperty(x => x.Status, "booked")
                .SetProperty(x => x.BookedAt, bookedAt));
        if (affected == 0)
            return await db.SupportSlots.AnyAsync(x => x.Id == id)
                ? BadRequest(new { message = "Bu vaqt allaqachon band qilingan" })
                : NotFound();
        return NoContent();
    }

    /// <summary>O'z bronini bekor qilish (o'tilgan darsdan tashqari) — slot yana bo'sh bo'ladi.</summary>
    [HttpPost("support/slots/{id}/cancel")]
    public async Task<IActionResult> CancelSupport(string id, [FromQuery] string? studentId = null)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();
        var slot = await db.SupportSlots.FindAsync(id);
        if (slot is null || slot.StudentId != s.Id) return NotFound();
        if (slot.Status == "done") return BadRequest(new { message = "O'tilgan darsni bekor qilib bo'lmaydi" });
        slot.StudentId = null;
        slot.Status = "open";
        slot.BookedAt = null;
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- O'quv dasturi (curriculum) progress ----------

    /// <summary>O'quvchining shu kursda o'tilgan (Done=true) bandlar id'larini qaytaradi.</summary>
    [HttpGet("curriculum/{courseId}/progress")]
    public async Task<ActionResult<string[]>> GetCourseProgress(string courseId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        // O'quvchi shu kursda faol guruhda bo'lganini tekshirish
        var hasAccess = await db.StudentGroups
            .AnyAsync(sg => sg.StudentId == userId
                         && sg.IsActive
                         && sg.Status != "frozen"
                         && db.Classes.Any(c => c.Id == sg.GroupId && c.CourseId == courseId));

        if (!hasAccess) return Forbid();

        var done = await db.CourseProgresses
            .Where(p => p.StudentId == userId && p.CourseId == courseId && p.Done)
            .Select(p => p.ItemId)
            .ToListAsync();

        return done.ToArray();
    }

    /// <summary>Dars progresini yangilash (o'tildi/o'tilmadi) — upsert. Faqat student rolida.</summary>
    [HttpPost("curriculum/progress")]
    [Authorize(Roles = "student")]
    public async Task<ActionResult> SetCourseProgress([FromBody] SetCourseProgressRequest req)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        // ItemId → CourseId topish
        var item = await db.CourseItems.FirstOrDefaultAsync(i => i.Id == req.ItemId);
        if (item is null) return NotFound(new { message = "Dars topilmadi" });

        var courseId = item.SubjectId;

        // Access control — o'quvchi shu kursda faol guruhda bo'lish kerak
        var hasAccess = await db.StudentGroups
            .AnyAsync(sg => sg.StudentId == userId
                         && sg.IsActive
                         && db.Classes.Any(c => c.Id == sg.GroupId && c.CourseId == courseId));

        if (!hasAccess) return Forbid();

        // Upsert
        var existing = await db.CourseProgresses
            .FirstOrDefaultAsync(p => p.StudentId == userId
                                   && p.ItemId == req.ItemId
                                   && p.CourseId == courseId);

        if (existing is not null)
        {
            existing.Done = req.Done;
        }
        else
        {
            db.CourseProgresses.Add(new CourseProgress
            {
                StudentId = userId,
                ItemId = req.ItemId,
                CourseId = courseId,
                Done = req.Done,
                UpdatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
            });
        }

        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    public class SetCourseProgressRequest
    {
        public string ItemId { get; set; } = "";
        public bool Done { get; set; }
    }
}
