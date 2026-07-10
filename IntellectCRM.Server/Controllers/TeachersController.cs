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
[AdminPerm("teachers")]
[Route("api/admin/teachers")]
public class TeachersController(AppDbContext db, AuditService audit) : ControllerBase
{
    private const int MinPasswordLength = 8;
    private const string WeakPasswordMessage = "Parol kamida 8 belgidan iborat bo'lsin";

    /// <summary>
    /// Faol (arxivlanmagan) o'qituvchilar. <paramref name="includeArchived"/>=true bo'lsa hammasi.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Teacher>>> GetAll([FromQuery] bool includeArchived = false)
    {
        var q = db.Teachers.AsQueryable();
        if (!includeArchived) q = q.Where(t => !t.IsArchived);
        return await q.OrderBy(t => t.FullName).ToListAsync();
    }

    /// <summary>Faqat arxivlangan o'qituvchilar.</summary>
    [HttpGet("archived")]
    public async Task<ActionResult<IEnumerable<Teacher>>> GetArchived() =>
        await db.Teachers.Where(t => t.IsArchived)
            .OrderByDescending(t => t.ArchivedAt).ThenBy(t => t.FullName).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Teacher>> Create(TeacherPayload p)
    {
        var teacher = new Teacher
        {
            FullName = p.FullName,
            BirthDate = p.BirthDate,
            Address = p.Address,
            Gender = p.Gender,
            Phone = PhoneUtil.Normalize(p.Phone ?? ""),
            PhotoUrl = p.PhotoUrl,
            HomeroomClass = p.HomeroomClass,
            SubjectIds = p.SubjectIds ?? new(),
            // Maosh QO'LDA: rejim "fixed" (qat'iy summa) yoki "percent" (guruh to'lovidan foiz).
            SalaryMode = p.SalaryMode == "percent" ? "percent" : "fixed",
            Salary = p.Salary,
            SalaryPercent = p.SalaryPercent,
            Category = p.Category ?? "",
            IsSupport = p.IsSupport,
            SalaryStartDate = p.SalaryStartDate ?? "",
            SalaryStartMonth = !string.IsNullOrEmpty(p.SalaryStartDate) && p.SalaryStartDate.Length >= 7
                ? p.SalaryStartDate[..7]
                : p.SalaryStartMonth ?? "",
            // Yangi o'qituvchiga standart — barcha bo'limlar ochiq (admin keyin cheklashi mumkin).
            Permissions = p.Permissions ?? TeacherPermissions.All.ToList(),
        };
        db.Teachers.Add(teacher);

        // Tizim akkaunti: doimo "teacher" roli. Support o'qituvchi ham teacher portaliga kiradi —
        // "Support" sahifasi profil menyusida IsSupport bayrog'i bo'yicha ko'rinadi (alohida rol kerak emas).
        var account = AccountFactory.CreateAccountFor(db, Roles.Teacher, teacher.FullName);
        teacher.UserId = account.Id;

        if (!string.IsNullOrEmpty(teacher.Category))
            audit.Record(AuditService.EntityTeacherSalary, teacher.Id, "create",
                $"Toifa belgilandi: {teacher.Category}", teacherId: teacher.Id);

        await db.SaveChangesAsync();
        return teacher;
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Teacher>> Update(string id, TeacherPayload p)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();

        var oldCategory = teacher.Category;
        var oldStart = teacher.SalaryStartMonth;
        teacher.FullName = p.FullName;
        teacher.BirthDate = p.BirthDate;
        teacher.Address = p.Address;
        teacher.Gender = p.Gender;
        teacher.Phone = PhoneUtil.Normalize(p.Phone ?? "");
        teacher.PhotoUrl = p.PhotoUrl;
        teacher.HomeroomClass = p.HomeroomClass;
        teacher.SubjectIds = p.SubjectIds ?? new();
        // Maosh: rejim + qat'iy summa + foiz (qo'lda kiritiladi).
        teacher.SalaryMode = p.SalaryMode == "percent" ? "percent" : "fixed";
        teacher.Salary = p.Salary;
        teacher.SalaryPercent = p.SalaryPercent;
        // Toifa — berilsa yangilaymiz (oylik avtomatik shu toifa narxidan hisoblanadi).
        if (p.Category is not null) teacher.Category = p.Category;
        teacher.IsSupport = p.IsSupport;
        teacher.SalaryStartDate = p.SalaryStartDate ?? "";
        teacher.SalaryStartMonth = !string.IsNullOrEmpty(p.SalaryStartDate) && p.SalaryStartDate.Length >= 7
            ? p.SalaryStartDate[..7]
            : p.SalaryStartMonth ?? "";
        // Ruxsatlar (bo'limlar) — berilsa yangilaymiz; berilmasa joriyini saqlaymiz.
        if (p.Permissions is not null) teacher.Permissions = p.Permissions;

        // Akkaunt nomini sinxronlaymiz va (ixtiyoriy) yangi parol o'rnatamiz.
        var user = teacher.UserId is null ? null : await db.Users.FindAsync(teacher.UserId);
        if (!string.IsNullOrWhiteSpace(p.NewPassword))
        {
            var pwd = p.NewPassword.Trim();
            if (pwd.Length < MinPasswordLength) return BadRequest(new { message = WeakPasswordMessage });
            // Akkaunt yo'q bo'lsa — yaratib biriktiramiz.
            user ??= AccountFactory.CreateAccountFor(db, Roles.Teacher, teacher.FullName);
            teacher.UserId = user.Id;
            user.SetInitialPassword(pwd);
        }
        if (user is not null)
        {
            user.FullName = teacher.FullName;
            // Akkaunt roli doimo "teacher" (eski "support" rolli akkauntni ham shu yerda tuzatadi —
            // support sahifasi teacher portalida IsSupport bo'yicha ko'rinadi).
            user.Role = Roles.Teacher;
        }

        if (oldCategory != teacher.Category || oldStart != teacher.SalaryStartMonth)
        {
            var parts = new List<string>();
            if (oldCategory != teacher.Category)
                parts.Add($"toifa {(string.IsNullOrEmpty(oldCategory) ? "—" : oldCategory)} → " +
                          $"{(string.IsNullOrEmpty(teacher.Category) ? "—" : teacher.Category)}");
            if (oldStart != teacher.SalaryStartMonth)
                parts.Add($"boshlanish oyi {(string.IsNullOrEmpty(oldStart) ? "—" : oldStart)} → " +
                          $"{(string.IsNullOrEmpty(teacher.SalaryStartMonth) ? "—" : teacher.SalaryStartMonth)}");
            audit.Record(AuditService.EntityTeacherSalary, teacher.Id, "update",
                "Oylik sozlamasi: " + string.Join(", ", parts),
                before: new { Category = oldCategory, SalaryStartMonth = oldStart },
                after: new { teacher.Category, teacher.SalaryStartMonth }, teacherId: teacher.Id);
        }

        await db.SaveChangesAsync();
        return teacher;
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        // O'qituvchi guruhda MAJBURIY — faol guruhga biriktirilgan bo'lsa o'chirib bo'lmaydi (yetim TeacherId oldini olish).
        var owns = await db.Classes.CountAsync(c => c.TeacherId == id && !c.IsArchived);
        if (owns > 0)
            return BadRequest(new { message = $"Bu o'qituvchi {owns} ta faol guruhga biriktirilgan — avval guruhga boshqa o'qituvchi tayinlang yoki guruhni arxivlang." });
        var reason = string.IsNullOrWhiteSpace(reasonId) ? "" : (await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "");
        // Biriktirilgan tizim akkauntini ham o'chiramiz.
        if (teacher.UserId is not null)
        {
            var user = await db.Users.FindAsync(teacher.UserId);
            if (user is not null) db.Users.Remove(user);
        }
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        ArchiveService.Snapshot(db, "teacher", teacher.Id, teacher.FullName, teacher.Phone ?? "", teacher, reason.Length > 0 ? reason : null, actor);
        db.Teachers.Remove(teacher);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /* ---------- Arxiv ---------- */

    /// <summary>
    /// O'qituvchini arxivga ko'chirish: <c>IsArchived=true</c>, sana/sabab saqlanadi, akkaunt
    /// login bloklanadi (PasswordHash bo'shaltiriladi). Tarixiy ma'lumotlar (jurnal, hisobot) saqlanadi.
    /// </summary>
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(string id, ArchiveTeacherRequest req)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        if (teacher.IsArchived) return BadRequest(new { message = "O'qituvchi allaqachon arxivda" });

        teacher.IsArchived = true;
        teacher.ArchivedAt = AppClock.Today.ToString("yyyy-MM-dd");
        teacher.ArchiveReason = (req.Reason ?? "").Trim();

        // Login bloklash — PasswordHash bo'shaltiriladi (login imkonsiz bo'ladi).
        if (teacher.UserId is not null)
        {
            var user = await db.Users.FindAsync(teacher.UserId);
            if (user is not null) user.BlockLogin();
        }

        audit.Record(AuditService.EntityTeacherSalary, teacher.Id, "update",
            $"O'qituvchi arxivga ko'chirildi ({teacher.FullName})"
                + (string.IsNullOrWhiteSpace(teacher.ArchiveReason) ? "" : $": \"{teacher.ArchiveReason}\""),
            teacherId: teacher.Id);

        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Arxivdan qaytarish: <c>IsArchived=false</c>, arxiv maydonlari tozalanadi. Ixtiyoriy
    /// <c>NewPassword</c> berilsa akkauntga yangi parol o'rnatiladi (aks holda parol bloklangicha qoladi).
    /// </summary>
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(string id, RestoreTeacherRequest req)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        if (!teacher.IsArchived) return BadRequest(new { message = "O'qituvchi arxivda emas" });

        teacher.IsArchived = false;
        teacher.ArchivedAt = null;
        teacher.ArchiveReason = null;

        var newPwd = (req?.NewPassword ?? "").Trim();
        if (!string.IsNullOrEmpty(newPwd))
        {
            if (newPwd.Length < MinPasswordLength) return BadRequest(new { message = WeakPasswordMessage });
            var user = teacher.UserId is null ? null : await db.Users.FindAsync(teacher.UserId);
            user ??= AccountFactory.CreateAccountFor(db, "teacher", teacher.FullName);
            teacher.UserId = user.Id;
            user.SetInitialPassword(newPwd);
        }

        audit.Record(AuditService.EntityTeacherSalary, teacher.Id, "update",
            $"O'qituvchi arxivdan qaytarildi ({teacher.FullName})", teacherId: teacher.Id);

        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>O'qituvchining tizim akkaunti (login/parol). Akkaunt yo'q bo'lsa — yaratib biriktiradi.</summary>
    [HttpGet("{id}/credentials")]
    public async Task<ActionResult<CredentialsDto>> Credentials(string id)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();

        var user = teacher.UserId is null ? null : await db.Users.FindAsync(teacher.UserId);
        if (user is null)
        {
            user = AccountFactory.CreateAccountFor(db, "teacher", teacher.FullName);
            teacher.UserId = user.Id;
            await db.SaveChangesAsync();
        }

        // O'qituvchi hali kirmagan bo'lsa dastlabki parol ko'rinadi; kirgach bo'sh (faqat reset-password).
        return new CredentialsDto(user.Email, user.InitialPassword ?? "", user.Role);
    }

    /// <summary>O'qituvchiga yangi tasodifiy parol generatsiya qiladi va BIR MARTA qaytaradi
    /// (DB'da faqat hash saqlanadi).</summary>
    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<CredentialsDto>> ResetPassword(string id)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        var user = teacher.UserId is null ? null : await db.Users.FindAsync(teacher.UserId);
        if (user is null)
        {
            user = AccountFactory.CreateAccountFor(db, "teacher", teacher.FullName);
            teacher.UserId = user.Id;
        }
        var pwd = AccountFactory.GeneratePassword();
        user.PasswordHash = PasswordHasher.Hash(pwd);
        await db.SaveChangesAsync();
        return new CredentialsDto(user.Email, pwd, user.Role);
    }

    /// <summary>
    /// Barcha (faol) o'qituvchilarni login/parol bilan Excel (.xlsx) ga eksport qiladi.
    /// Parol FAQAT o'qituvchi hali kirmagan bo'lsa ko'rinadi (kirgach bo'sh). Faqat superadmin.
    /// Ustunlar: F.I.SH., Telefon, Guruh rahbarligi, Login, Parol.
    /// </summary>
    [HttpGet("export")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> Export()
    {
        var teachers = await db.Teachers.Where(t => !t.IsArchived)
            .OrderBy(t => t.FullName).ToListAsync();
        var userIds = teachers.Where(t => t.UserId != null).Select(t => t.UserId!).ToList();
        var byId = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync())
            .ToDictionary(u => u.Id);

        var headers = new[] { "F.I.SH.", "Telefon", "Guruh rahbarligi", "Login", "Parol" };
        var rows = teachers.Select(t =>
        {
            byId.TryGetValue(t.UserId ?? "", out var u);
            return (IReadOnlyList<string>)new[]
            {
                t.FullName, t.Phone, t.HomeroomClass, u?.Email ?? "", u?.InitialPassword ?? "",
            };
        });

        var bytes = ExcelExport.Build("O'qituvchilar", headers, rows);
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"oqituvchilar_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    /// <summary>
    /// Bitta o'qituvchining talaba saqlab qolish statistikasi (lifetime, per-group).
    /// Barcha guruhlar aggregati: retention%, loss%, effectiveness score.
    /// </summary>
    [HttpGet("{id}/performance")]
    public async Task<ActionResult<TeacherPerformanceDto>> GetSinglePerformance(string id)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();

        var groups = await db.Classes
            .Where(c => c.TeacherId == id && !c.IsArchived)
            .Select(c => c.Id)
            .ToListAsync();

        var memberships = await db.StudentGroups
            .Where(sg => groups.Contains(sg.GroupId))
            .Select(sg => new { sg.Status, sg.IsActive, sg.LeftAt })
            .ToListAsync();

        int total    = memberships.Count;
        int active   = memberships.Count(s => s.Status == "active" && s.IsActive);
        int frozen   = memberships.Count(s => s.Status == "frozen");
        int left     = memberships.Count(s => !s.IsActive || s.LeftAt != null);
        double retention = total > 0 ? Math.Round((double)active / total * 100, 1) : 0;
        double loss      = total > 0 ? Math.Round((double)(frozen + left) / total * 100, 1) : 0;

        return new TeacherPerformanceDto(
            teacher.Id, teacher.FullName, teacher.Phone ?? "",
            total, active, frozen, left,
            retention, loss,
            (int)Math.Round(retention),
            groups.Count
        );
    }

    /// <summary>
    /// Barcha faol o'qituvchilarning talaba saqlab qolish statistikasi (lifetime, per-group).
    /// Qaytadi: retention%, loss%, effectiveness score — saralash retention bo'yicha (kamayish).
    /// </summary>
    [HttpGet("performance")]
    public async Task<ActionResult<List<TeacherPerformanceDto>>> GetPerformance()
    {
        // Faol o'qituvchilar va ularning guruhlari (arxivlanmagan)
        var teachers = await db.Teachers
            .Where(t => !t.IsArchived)
            .OrderBy(t => t.FullName)
            .ToListAsync();

        var teacherIds = teachers.Select(t => t.Id).ToList();

        // Guruhlar (TeacherId in list) + StudentGroup a'zoliklari
        var groups = await db.Classes
            .Where(c => c.TeacherId != null && teacherIds.Contains(c.TeacherId!) && !c.IsArchived)
            .Select(c => new { c.Id, c.TeacherId })
            .ToListAsync();

        var groupIds = groups.Select(g => g.Id).ToList();

        var memberships = await db.StudentGroups
            .Where(sg => groupIds.Contains(sg.GroupId))
            .Select(sg => new { sg.GroupId, sg.Status, sg.IsActive, sg.LeftAt })
            .ToListAsync();

        // groupId → teacherId xaritasi
        var groupTeacher = groups.ToDictionary(g => g.Id, g => g.TeacherId!);

        // Per-teacher aggregat
        var byTeacher = memberships
            .GroupBy(sg => groupTeacher.GetValueOrDefault(sg.GroupId, ""))
            .ToDictionary(g => g.Key, g => g.ToList());

        var groupCount = groups
            .GroupBy(g => g.TeacherId!)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = teachers.Select(t =>
        {
            var slots = byTeacher.GetValueOrDefault(t.Id, new());
            int total    = slots.Count;
            int active   = slots.Count(s => s.Status == "active" && s.IsActive);
            int frozen   = slots.Count(s => s.Status == "frozen");
            int left     = slots.Count(s => !s.IsActive || s.LeftAt != null);
            double retention = total > 0 ? Math.Round((double)active / total * 100, 1) : 0;
            double loss      = total > 0 ? Math.Round((double)(frozen + left) / total * 100, 1) : 0;

            return new TeacherPerformanceDto(
                t.Id, t.FullName, t.Phone ?? "",
                total, active, frozen, left,
                retention, loss,
                (int)Math.Round(retention),
                groupCount.GetValueOrDefault(t.Id, 0)
            );
        })
        .OrderByDescending(x => x.RetentionPercent)
        .ThenBy(x => x.TeacherName)
        .ToList();

        return result;
    }

    /// <summary>
    /// O'qituvchi o'quvchilarining REYTINGI — faqat shu o'qituvchi guruhlaridagi ball bo'yicha
    /// (ball = jurnal baholari yig'indisi + bajarilgan baholash mezonlari).
    /// </summary>
    [HttpGet("{id}/rating")]
    public async Task<ActionResult<TeacherRatingDto>> Rating(string id)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        return await StudentBallService.TeacherAsync(db, teacher);
    }

    /// <summary>
    /// O'qituvchi maoshi bo'yicha batafsil hisob (davr bo'yicha): jami berilgan, qoldiq va
    /// har oyda qancha oylik berilgani. Oylar davr (from..to) bo'yicha, oy = to'lov sanasi oyi.
    /// </summary>
    [HttpGet("{id}/salary-ledger")]
    public async Task<ActionResult<SalaryLedgerDto>> SalaryLedger(
        string id, [FromQuery] string? from, [FromQuery] string? to)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();
        return await IntellectCRM.Application.Services.SalaryLedger.BuildAsync(db, teacher, from, to);
    }

    /// <summary>
    /// O'qituvchi guruhlarining PER-GURUH maosh sozlamasini yangilaydi: har guruhga alohida rejim
    /// ("percent" — shu guruh to'lovidan foiz | "fixed" — qat'iy summa | "" — o'qituvchi umumiy sozlamasi).
    /// Faqat shu o'qituvchiga biriktirilgan guruhlar yangilanadi. O'qituvchi oyligi guruhlar ulushi yig'indisi.
    /// </summary>
    [HttpPut("{id}/group-salaries")]
    public async Task<IActionResult> UpdateGroupSalaries(string id, GroupSalaryUpdateRequest req)
    {
        var teacher = await db.Teachers.FindAsync(id);
        if (teacher is null) return NotFound();

        var items = req.Items ?? new();
        var ids = items.Select(i => i.GroupId).ToList();
        // FAQAT shu o'qituvchining guruhlari — boshqa o'qituvchi guruhini o'zgartirib bo'lmaydi.
        var groups = await db.Classes
            .Where(c => c.TeacherId == id && ids.Contains(c.Id))
            .ToListAsync();
        var byId = groups.ToDictionary(g => g.Id);

        var changed = new List<string>();
        foreach (var it in items)
        {
            if (!byId.TryGetValue(it.GroupId, out var g)) continue;
            var mode = it.Mode is "percent" or "fixed" ? it.Mode : "";
            var pct = mode == "percent" ? Math.Max(0m, it.Percent) : 0m;
            var fixedAmt = mode == "fixed" ? Math.Max(0m, it.Fixed) : 0m;
            if (g.TeacherSalaryMode == mode && g.TeacherSalaryPercent == pct && g.TeacherSalaryFixed == fixedAmt)
                continue;
            g.TeacherSalaryMode = mode;
            g.TeacherSalaryPercent = pct;
            g.TeacherSalaryFixed = fixedAmt;
            changed.Add(mode == "percent" ? $"{g.Name}: {pct}%"
                : mode == "fixed" ? $"{g.Name}: {AuditService.Money(fixedAmt)} so'm"
                : $"{g.Name}: umumiy");
        }

        if (changed.Count > 0)
        {
            audit.Record(AuditService.EntityTeacherSalary, teacher.Id, "update",
                "Per-guruh maosh: " + string.Join(", ", changed), teacherId: teacher.Id);
            await db.SaveChangesAsync();
        }
        return NoContent();
    }
}
