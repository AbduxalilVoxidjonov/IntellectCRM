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
    TelegramService telegram) : ControllerBase
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
            var phone = NormalizePhone(user.Email);
            // Ota ham, ona ham kira oladi — ASOSIY/ota/ona telefonidan birortasi mos kelsa yetarli.
            var children = (await db.Students.Where(s => !s.IsArchived).ToListAsync())
                .Where(s => NormalizePhone(s.ParentPhone) == phone
                            || NormalizePhone(s.FatherPhone) == phone
                            || NormalizePhone(s.MotherPhone) == phone)
                .ToList();
            // studentId berilsa — SHU farzand (FAQAT o'ziniki bo'lsa; egalik tekshiruvi). Aks holda birinchi farzand.
            return string.IsNullOrWhiteSpace(studentId)
                ? children.FirstOrDefault()
                : children.FirstOrDefault(s => s.Id == studentId);
        }

        return await db.Students.FirstOrDefaultAsync(s => s.UserId == uid);
    }

    /// <summary>Telefon raqamidan faqat raqamlarni qoldiradi (taqqoslash uchun).</summary>
    private static string NormalizePhone(string? p) =>
        new string((p ?? "").Where(char.IsDigit).ToArray());

    /// <summary>
    /// Mutatsiya (yozish) amallari uchun — FAQAT student rolida; admin impersonate qila olmaydi.
    /// </summary>
    private async Task<Student?> MeAsync()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return uid is null ? null : await db.Students.FirstOrDefaultAsync(s => s.UserId == uid);
    }

    /// <summary>O'quvchining sinf id'sini (nomidan) topadi.</summary>
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

    /// <summary>Maktab meta'si (chorak/dars vaqtlari/sabablar + joriy chorak/hafta) —
    /// hammaga bir xil, `studentId` shart emas.</summary>
    [HttpGet("meta")]
    public async Task<ActionResult<PortalMetaDto>> Meta() => await refCache.MetaAsync();

    /// <summary>Joriy maktab nomi — ilova brendingi/sarlavhasi uchun.</summary>
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
    /// <b>o'z sinfini to'liq</b>, <b>maktab bo'yicha esa faqat TOP 15</b> ko'radi.
    /// O'z qatori `MeStudentId` bilan, maktab o'rni (top 15 dan tashqarida bo'lsa ham) `MeSchoolRank` bilan beriladi.
    /// Parent farzandi nomidan; admin uchun `?studentId=` shart.
    /// </summary>
    [HttpGet("rating")]
    public async Task<ActionResult<PortalRatingDto>> Rating([FromQuery] string? studentId)
    {
        if (User.IsInRole("admin") && string.IsNullOrWhiteSpace(studentId)) return NeedStudentId();
        var s = await TargetAsync(studentId);
        if (s is null) return NotFound();

        // O'rtacha baho bo'yicha kamayish tartibida — adminnikidek (index = o'rin).
        var school = (await RatingService.SchoolAsync(db))
            .OrderByDescending(r => r.Average)
            .ToList();

        static PortalRatingRowDto Map(StudentRatingRowDto r, int i) =>
            new(i + 1, r.Student.Id, r.Student.FullName, r.ClassName, r.Average, r.Attendance);

        var classRows = school
            .Where(r => r.ClassName == s.ClassName)
            .Select(Map).ToList();                       // o'z sinfi — to'liq
        var schoolRows = school.Take(15).Select(Map).ToList(); // maktab — top 15

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

    // ---------- Guruh chati (o'z sinfi) ----------

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
        if (string.IsNullOrEmpty(s.ClassName)) return BadRequest(new { message = "Sinf biriktirilmagan" });
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var dto = await chat.PostAsync(s.ClassName, uid, req.Text);
        return dto is null ? BadRequest(new { message = "Xabar bo'sh" }) : dto;
    }

    // ---------- Topshiriqlar / testlar (o'z sinfi) ----------

    /// <summary>O'z sinfiga berilgan topshiriqlar — har birida o'z holati (bajardi/ball).</summary>
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
            i.VideoUrl, i.AudioUrl, i.TextContent, i.Meta, vocab, qs);
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

            result.Add(new StudentGradingGroupDto(g.Id, g.Name, months, resolved, dates, criteria, lessons));
        }
        return result;
    }

    /* ─── LMS (Ta'lim) ──────────────────────────────────────── */

    /// <summary>O'quvchining sinfi uchun LMS fanlar ro'yxati (progress bilan).</summary>
    [HttpGet("lms/subjects")]
    public async Task<ActionResult<IEnumerable<StudentLmsSubjectDto>>> LmsSubjects([FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return User.IsInRole("admin") ? NeedStudentId() : NotFound();

        // O'quvchining sinf id'sini topamiz
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null) return Ok(Array.Empty<StudentLmsSubjectDto>());

        var subjects = await db.LmsSubjects
            .Include(x => x.Modules).ThenInclude(m => m.Topics)
            .Where(x => x.ClassId == cls.Id)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        var topicIds = subjects
            .SelectMany(x => x.Modules.SelectMany(m => m.Topics.Select(t => t.Id))).ToList();
        var completed = (await db.LmsProgresses
            .Where(p => p.StudentId == s.Id && topicIds.Contains(p.TopicId))
            .Select(p => p.TopicId).ToListAsync()).ToHashSet();

        return subjects.Select(x =>
        {
            var allTopics = x.Modules.SelectMany(m => m.Topics).ToList();
            return new StudentLmsSubjectDto(
                x.Id, x.Title, x.Description, x.UnlockMode, x.BatchSize,
                allTopics.Count, allTopics.Count(t => completed.Contains(t.Id)));
        }).ToList();
    }

    /// <summary>
    /// Fanning to'liq mavzu ketma-ketligi (modul, keyin mavzu tartibida) ustidan ochilish
    /// bayroqlarini hisoblaydi. Ochilish konfiguratsiyasi fan (subject) darajasida turadi.
    /// </summary>
    private (List<LmsTopic> Ordered, HashSet<string> Completed, Func<int, bool> IsUnlocked) BuildUnlock(
        LmsSubject subject, HashSet<string> completedIds)
    {
        var ordered = subject.Modules
            .OrderBy(m => m.Order)
            .SelectMany(m => m.Topics.OrderBy(t => t.Order))
            .ToList();

        bool IsUnlocked(int i) => subject.UnlockMode switch
        {
            "sequential" => i == 0 || completedIds.Contains(ordered[i - 1].Id),
            "batch" => i < subject.BatchSize ||
                            completedIds.Contains(ordered[Math.Max(0, i - subject.BatchSize)].Id),
            _ => true, // "all"
        };

        return (ordered, completedIds, IsUnlocked);
    }

    /// <summary>Bitta mavzuni — ochilish holatiga qarab kontentni yashirib — DTO ga aylantiradi.</summary>
    private static StudentLmsTopicDto ToTopicDto(LmsTopic t, bool unlocked, bool completed) =>
        new StudentLmsTopicDto(
            t.Id, t.ModuleId, t.Title, t.Description,
            unlocked ? t.VideoUrl : null,
            unlocked ? t.TextContent : null,
            t.Order,
            // Qulflangan mavzularda kontent (video/matn/material) ko'rsatilmaydi
            unlocked
                ? t.Materials.Select(m => new LmsMaterialRowDto(m.Id, m.Name, m.Url, m.Size, m.ContentType)).ToList()
                : new List<LmsMaterialRowDto>(),
            unlocked, completed);

    /// <summary>Fanning modullari — har modul ichida mavzular, ochilish tartibi va progress bilan.</summary>
    [HttpGet("lms/subjects/{subjectId}/modules")]
    public async Task<ActionResult<IEnumerable<StudentLmsModuleDto>>> LmsModules(
        string subjectId, [FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return User.IsInRole("admin") ? NeedStudentId() : NotFound();

        var subject = await db.LmsSubjects
            .Include(x => x.Modules).ThenInclude(m => m.Topics).ThenInclude(t => t.Materials)
            .FirstOrDefaultAsync(x => x.Id == subjectId);
        if (subject is null) return NotFound();

        // Sinfga tegishli ekanini tekshiramiz
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null || subject.ClassId != cls.Id) return Forbid();

        var completedIds = (await db.LmsProgresses
            .Where(p => p.StudentId == s.Id &&
                subject.Modules.SelectMany(m => m.Topics).Select(t => t.Id).Contains(p.TopicId))
            .Select(p => p.TopicId).ToListAsync()).ToHashSet();

        var (ordered, _, isUnlocked) = BuildUnlock(subject, completedIds);
        // Mavzu id -> global indeks (modul.Order, keyin mavzu.Order bo'yicha)
        var idxOf = ordered.Select((t, i) => (t.Id, i)).ToDictionary(x => x.Id, x => x.i);

        return subject.Modules.OrderBy(m => m.Order).Select(m =>
        {
            var mTopics = m.Topics.OrderBy(t => t.Order)
                .Select(t => ToTopicDto(t, isUnlocked(idxOf[t.Id]), completedIds.Contains(t.Id)))
                .ToList();
            return new StudentLmsModuleDto(
                m.Id, m.Title, m.Description, m.Order,
                mTopics.Count, mTopics.Count(t => t.IsCompleted), mTopics);
        }).ToList();
    }

    /// <summary>
    /// Fanning barcha mavzulari (tekis ro'yxat, global tartibda) — eski mijozlar uchun.
    /// Ochilish tartibi va o'quvchi progressi bilan; har mavzu o'z ModuleId'sini olib yuradi.
    /// </summary>
    [HttpGet("lms/subjects/{subjectId}/topics")]
    public async Task<ActionResult<IEnumerable<StudentLmsTopicDto>>> LmsTopics(
        string subjectId, [FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return User.IsInRole("admin") ? NeedStudentId() : NotFound();

        var subject = await db.LmsSubjects
            .Include(x => x.Modules).ThenInclude(m => m.Topics).ThenInclude(t => t.Materials)
            .FirstOrDefaultAsync(x => x.Id == subjectId);
        if (subject is null) return NotFound();

        // Sinfga tegishli ekanini tekshiramiz
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null || subject.ClassId != cls.Id) return Forbid();

        var completedIds = (await db.LmsProgresses
            .Where(p => p.StudentId == s.Id &&
                subject.Modules.SelectMany(m => m.Topics).Select(t => t.Id).Contains(p.TopicId))
            .Select(p => p.TopicId).ToListAsync()).ToHashSet();

        var (ordered, _, isUnlocked) = BuildUnlock(subject, completedIds);

        var result = new List<StudentLmsTopicDto>();
        for (var i = 0; i < ordered.Count; i++)
        {
            var t = ordered[i];
            result.Add(ToTopicDto(t, isUnlocked(i), completedIds.Contains(t.Id)));
        }
        return result;
    }

    /// <summary>
    /// Bitta mavzu tafsiloti — faqat ochiq (unlocked) mavzu uchun. Qulflangan bo'lsa 403.
    /// Video, matn va materiallar shu endpoint orqali olinadi.
    /// </summary>
    [HttpGet("lms/topics/{topicId}")]
    public async Task<ActionResult<StudentLmsTopicDto>> LmsTopicDetail(
        string topicId, [FromQuery] string? studentId)
    {
        var s = await TargetAsync(studentId);
        if (s is null) return User.IsInRole("admin") ? NeedStudentId() : NotFound();

        var topic = await db.LmsTopics
            .Include(t => t.Materials)
            .Include(t => t.Module).ThenInclude(m => m.Subject)
            .FirstOrDefaultAsync(t => t.Id == topicId);
        if (topic is null) return NotFound();

        // Sinfga tegishli ekanini tekshiramiz
        var cls = await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName);
        if (cls is null || topic.Module.Subject.ClassId != cls.Id) return Forbid();

        // Fanning to'liq mavzu ketma-ketligini (modul + mavzu tartibida) yuklaymiz
        var subject = topic.Module.Subject;
        subject.Modules = await db.LmsModules
            .Include(m => m.Topics)
            .Where(m => m.SubjectId == topic.Module.SubjectId)
            .OrderBy(m => m.Order).ToListAsync();

        var ordered = subject.Modules
            .OrderBy(m => m.Order)
            .SelectMany(m => m.Topics.OrderBy(t => t.Order))
            .ToList();
        var completedIds = (await db.LmsProgresses
            .Where(p => p.StudentId == s.Id && ordered.Select(t => t.Id).Contains(p.TopicId))
            .Select(p => p.TopicId).ToListAsync()).ToHashSet();

        var (_, _, isUnlocked) = BuildUnlock(subject, completedIds);
        var idx = ordered.FindIndex(t => t.Id == topicId);

        if (idx < 0 || !isUnlocked(idx))
            return StatusCode(403, new { message = "Bu mavzu hali ochilmagan" });

        return new StudentLmsTopicDto(
            topic.Id, topic.ModuleId, topic.Title, topic.Description,
            topic.VideoUrl, topic.TextContent, topic.Order,
            topic.Materials.Select(m => new LmsMaterialRowDto(m.Id, m.Name, m.Url, m.Size, m.ContentType)).ToList(),
            true, completedIds.Contains(topic.Id));
    }

    /// <summary>Mavzuni tugallangan deb belgilash — ochilish mantig'i uchun zarur. Parent ham chaqira oladi.</summary>
    [HttpPost("lms/topics/{topicId}/complete")]
    public async Task<IActionResult> CompleteLmsTopic(string topicId)
    {
        // Student o'zi yoki parent farzandi nomidan belgilaydi
        var s = User.IsInRole("parent") ? await TargetAsync(null) : await MeAsync();
        if (s is null) return Forbid();
        if (!await db.LmsProgresses.AnyAsync(p => p.StudentId == s.Id && p.TopicId == topicId))
        {
            db.LmsProgresses.Add(new LmsProgress { StudentId = s.Id, TopicId = topicId });
            await db.SaveChangesAsync();
        }
        return NoContent();
    }
}
