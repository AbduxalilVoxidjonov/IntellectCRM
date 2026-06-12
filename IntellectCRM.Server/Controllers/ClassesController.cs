using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("classes")]
[Route("api/admin/classes")]
public class ClassesController(AppDbContext db, AuditService audit) : ControllerBase
{
    /// <summary>Faol (arxivlanmagan) sinflar. <paramref name="includeArchived"/>=true bo'lsa hammasi.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Group>>> GetAll([FromQuery] bool includeArchived = false)
    {
        var q = db.Classes.AsQueryable();
        if (!includeArchived) q = q.Where(c => !c.IsArchived);
        return await q.OrderBy(c => c.Grade).ThenBy(c => c.Name).ToListAsync();
    }

    /// <summary>Arxivlangan sinflar ro'yxati.</summary>
    [HttpGet("archived")]
    public async Task<ActionResult<IEnumerable<Group>>> GetArchived() =>
        await db.Classes.Where(c => c.IsArchived)
            .OrderByDescending(c => c.ArchivedAt).ThenBy(c => c.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Group>> Create(ClassPayload p)
    {
        // Guruhga o'qituvchi biriktirish MAJBURIY (foizli maosh va jurnal shunga tayanadi).
        if (string.IsNullOrWhiteSpace(p.TeacherId))
            return BadRequest(new { message = "Guruhga o'qituvchi biriktirish majburiy" });
        if (await db.Teachers.FindAsync(p.TeacherId) is null)
            return BadRequest(new { message = "Tanlangan o'qituvchi topilmadi" });

        var cls = new Group
        {
            Name = p.Name,
            Grade = p.Grade,
            Language = p.Language,
            MonthlyFee = p.MonthlyFee,
            Room = p.Room,
            Status = string.IsNullOrWhiteSpace(p.Status) ? "active" : p.Status!,
            StartDate = p.StartDate,
            EndDate = p.EndDate,
            Capacity = p.Capacity,
            CourseId = p.CourseId ?? "",
            TeacherId = p.TeacherId ?? "",
            Note = p.Note ?? "",
            Days = p.Days ?? new(),
            StartTime = p.StartTime ?? "",
            EndTime = p.EndTime ?? "",
        };
        // Guruh kursi belgilangan bo'lsa — guruh oyligi (MonthlyFee) shu kurs narxidan keladi.
        if (!string.IsNullOrEmpty(cls.CourseId))
        {
            var course = await db.Subjects.FindAsync(cls.CourseId);
            if (course is not null) cls.MonthlyFee = course.Price;
        }
        db.Classes.Add(cls);

        if (cls.MonthlyFee > 0)
            audit.Record(AuditService.EntityClassFee, cls.Id, "create",
                $"Oylik to'lov belgilandi: {AuditService.Money(cls.MonthlyFee)} so'm ({cls.Name})",
                after: new { cls.MonthlyFee, cls.Name });

        await db.SaveChangesAsync();
        return cls;
    }

    /// <summary>
    /// Sinfni tahrirlash. Oylik to'lov o'zgarsa va <paramref name="applyFee"/> = true bo'lsa
    /// ("Ha"), yangi narx shu sinf o'quvchilarining JORIY oy to'loviga ham qo'llanadi (balans
    /// farqqa moslab to'g'rilanadi). false bo'lsa ("Yo'q") — joriy oy eski narxda qoladi, yangi
    /// narx keyingi oy hisoblashidan amal qiladi.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Group>> Update(string id, ClassPayload p, [FromQuery] bool applyFee = false)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();

        // O'qituvchi biriktirish majburiy (eski, o'qituvchisiz guruhlar ham tahrirlanganda biriktirilsin).
        if (string.IsNullOrWhiteSpace(p.TeacherId))
            return BadRequest(new { message = "Guruhga o'qituvchi biriktirish majburiy" });
        if (await db.Teachers.FindAsync(p.TeacherId) is null)
            return BadRequest(new { message = "Tanlangan o'qituvchi topilmadi" });

        var oldFee = cls.MonthlyFee;
        var oldName = cls.Name;   // o'quvchilar hozir shu nom bilan biriktirilgan
        cls.Name = p.Name;
        cls.Grade = p.Grade;
        cls.Language = p.Language;
        cls.MonthlyFee = p.MonthlyFee;
        cls.Room = p.Room;
        if (!string.IsNullOrWhiteSpace(p.Status)) cls.Status = p.Status!;
        cls.StartDate = p.StartDate;
        cls.EndDate = p.EndDate;
        cls.Capacity = p.Capacity;
        cls.CourseId = p.CourseId ?? "";
        cls.TeacherId = p.TeacherId ?? "";
        cls.Note = p.Note ?? "";
        cls.Days = p.Days ?? new();
        cls.StartTime = p.StartTime ?? "";
        cls.EndTime = p.EndTime ?? "";
        // Guruh kursi belgilangan bo'lsa — guruh oyligi (MonthlyFee) shu kurs narxidan keladi.
        if (!string.IsNullOrEmpty(cls.CourseId))
        {
            var course = await db.Subjects.FindAsync(cls.CourseId);
            if (course is not null) cls.MonthlyFee = course.Price;
        }

        if (oldFee != cls.MonthlyFee)
        {
            var applied = 0;
            if (applyFee)
                applied = await TuitionService.ApplyGroupFeeToCurrentMonthAsync(db, cls.Id, oldName, cls.MonthlyFee);

            var summary = $"Oylik to'lov o'zgartirildi: {AuditService.Money(oldFee)} → {AuditService.Money(cls.MonthlyFee)} so'm ({cls.Name})";
            summary += applyFee
                ? $" — joriy oydan {applied} o'quvchiga qo'llandi"
                : " — keyingi oydan amal qiladi";
            audit.Record(AuditService.EntityClassFee, cls.Id, "update", summary,
                before: new { MonthlyFee = oldFee, cls.Name }, after: new { cls.MonthlyFee, cls.Name });
        }

        await db.SaveChangesAsync();
        return cls;
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        // Faol o'quvchi bo'lsa — ClassName bo'yicha YOKI faol a'zolik (M2M) bo'yicha — o'chirib bo'lmaydi.
        var byName = await db.Students.CountAsync(s => s.ClassName == cls.Name && !s.IsArchived);
        var activeMembers = await db.StudentGroups.CountAsync(sg => sg.GroupId == id && sg.IsActive);
        if (byName > 0 || activeMembers > 0)
            return BadRequest(new
            {
                message = $"Bu guruhda {Math.Max(byName, activeMembers)} ta faol o'quvchi bor — guruhni o'chirib bo'lmaydi. " +
                          "Avval o'quvchilarni chiqaring yoki arxivlang.",
            });
        // Bog'liq qatorlar orphan qolmasin: a'zoliklar (o'tganlar ham), jurnal yozuvlari, dars eslatmalari,
        // shu guruhga tegishli per-guruh oylik hisoblar (aks holda ledger yo'q guruhni hisoblardi).
        db.StudentGroups.RemoveRange(db.StudentGroups.Where(sg => sg.GroupId == id));
        db.JournalEntries.RemoveRange(db.JournalEntries.Where(e => e.ClassId == id));
        db.LessonNotes.RemoveRange(db.LessonNotes.Where(n => n.ClassId == id));
        db.MonthlyCharges.RemoveRange(db.MonthlyCharges.Where(c => c.GroupId == id));
        // Moliya tarixi SAQLANADI, lekin yo'q guruhga ishora qilmasin — GroupId tozalanadi (to'lov qoladi).
        await db.FinanceTransactions.Where(t => t.GroupId == id)
            .ForEachAsync(t => t.GroupId = null);
        db.Classes.Remove(cls);

        var reason = await ReasonLabelAsync(reasonId);
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        ArchiveService.Snapshot(db, "group", cls.Id, cls.Name, "", cls,
            reason.Length > 0 ? reason : null, actor);
        audit.Record("Group", id, "delete",
            $"Guruh o'chirildi ({cls.Name})" + (reason.Length > 0 ? $" — sabab: {reason}" : ""));
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Sinfni arxivlash — <c>IsArchived=true</c>. Unga bog'langan FAOL o'quvchilar ham arxivlanadi
    /// (login bloklanadi, lekin parol saqlanadi — chiqarganda tiklanadi) va <c>ArchivedWithClass=true</c>
    /// bilan belgilanadi. Avval alohida arxivlangan o'quvchilar tegilmaydi.
    /// </summary>
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(string id)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        if (cls.IsArchived) return BadRequest(new { message = "Sinf allaqachon arxivda" });

        var today = AppClock.Today.ToString("yyyy-MM-dd");
        cls.IsArchived = true;
        cls.ArchivedAt = today;

        var students = await db.Students.Where(s => s.ClassName == cls.Name && !s.IsArchived).ToListAsync();
        foreach (var s in students)
        {
            s.IsArchived = true;
            s.ArchivedAt = today;
            s.ArchiveReason = $"Sinf arxivlandi ({cls.Name})";
            s.ArchivedWithClass = true;
        }

        audit.Record(AuditService.EntityClassFee, cls.Id, "update",
            $"Sinf arxivlandi ({cls.Name}) — {students.Count} ta o'quvchi bilan");
        await db.SaveChangesAsync();
        return Ok(new { archivedStudents = students.Count });
    }

    /// <summary>
    /// Sinfni arxivdan chiqarish — <c>IsArchived=false</c>. Faqat shu sinf bilan arxivlangan
    /// (<c>ArchivedWithClass=true</c>) o'quvchilar qaytariladi; alohida arxivlanganlar arxivda qoladi.
    /// </summary>
    [HttpPost("{id}/unarchive")]
    public async Task<IActionResult> Unarchive(string id)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        if (!cls.IsArchived) return BadRequest(new { message = "Sinf arxivda emas" });

        cls.IsArchived = false;
        cls.ArchivedAt = null;

        var students = await db.Students
            .Where(s => s.ClassName == cls.Name && s.IsArchived && s.ArchivedWithClass).ToListAsync();
        foreach (var s in students)
        {
            s.IsArchived = false;
            s.ArchivedAt = null;
            s.ArchiveReason = null;
            s.ArchivedWithClass = false;
        }

        audit.Record(AuditService.EntityClassFee, cls.Id, "update",
            $"Sinf arxivdan chiqarildi ({cls.Name}) — {students.Count} ta o'quvchi bilan");
        await db.SaveChangesAsync();
        return Ok(new { restoredStudents = students.Count });
    }

    // ---------- Guruh a'zoligi (M2M) ----------

    /// <summary>Guruh a'zolari (faol + o'tgan). Faol a'zolar yuqorida.</summary>
    [HttpGet("{id}/members")]
    public async Task<ActionResult<IEnumerable<GroupMemberDto>>> Members(string id)
    {
        var rows = await (from sg in db.StudentGroups
                          join s in db.Students on sg.StudentId equals s.Id
                          where sg.GroupId == id
                          orderby sg.IsActive descending, s.FullName
                          select new GroupMemberDto(s.Id, s.FullName, sg.JoinedAt, sg.LeftAt, sg.IsActive,
                              sg.Status, sg.ActivatedAt, sg.FrozenAt, s.Balance))
                         .ToListAsync();
        return rows;
    }

    /// <summary>O'quvchini guruhga qo'shish (M2M). Sig'im to'lgan bo'lsa rad etadi. Avval guruhsiz
    /// o'quvchining asosiy ClassName'i shu guruh nomiga o'rnatiladi (eski ko'rinishlar uchun).</summary>
    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(string id, AddStudentToGroupRequest req)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound(new { message = "Guruh topilmadi" });
        var s = await db.Students.FindAsync(req.StudentId);
        if (s is null) return NotFound(new { message = "O'quvchi topilmadi" });

        var existing = await db.StudentGroups
            .FirstOrDefaultAsync(sg => sg.StudentId == req.StudentId && sg.GroupId == id);
        if (existing is { IsActive: true })
            return BadRequest(new { message = "O'quvchi allaqachon shu guruhda" });

        if (cls.Capacity > 0)
        {
            var enrolled = await db.StudentGroups.CountAsync(sg => sg.GroupId == id && sg.IsActive);
            if (enrolled >= cls.Capacity)
                return BadRequest(new { message = $"Guruh to'lgan ({cls.Capacity} o'rin)" });
        }

        var joinedAt = string.IsNullOrWhiteSpace(req.JoinedAt)
            ? AppClock.Today.ToString("yyyy-MM-dd") : req.JoinedAt!;
        if (existing is not null)
        {
            existing.IsActive = true;
            existing.LeftAt = null;
            existing.JoinedAt = joinedAt;
            // Qayta qo'shilganda — yana sinov holatiga qaytadi.
            existing.Status = "trial";
            existing.ActivatedAt = string.Empty;
            existing.FrozenAt = string.Empty;
        }
        else
        {
            db.StudentGroups.Add(new StudentGroup
            {
                StudentId = req.StudentId, GroupId = id, JoinedAt = joinedAt, IsActive = true,
                Status = "trial",
            });
        }
        // Eski (single-class) ko'rinishlar uchun asosiy guruh nomini to'ldiramiz.
        if (string.IsNullOrWhiteSpace(s.ClassName)) s.ClassName = cls.Name;

        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Amal sababini (ActionReason) id bo'yicha matnga aylantiradi — yo'q/bo'sh bo'lsa "".</summary>
    private async Task<string> ReasonLabelAsync(string? reasonId)
    {
        if (string.IsNullOrWhiteSpace(reasonId)) return "";
        return await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "";
    }

    /// <summary>O'quvchini guruhdan chiqarish (LeftAt belgilanadi, IsActive=false). Tarix saqlanadi.
    /// Sabab (holatga qarab remove_active/remove_trial/remove_frozen) tanlansa auditga yoziladi.</summary>
    [HttpDelete("{id}/members/{studentId}")]
    public async Task<IActionResult> RemoveMember(string id, string studentId, [FromQuery] string? reasonId = null)
    {
        var sg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (sg is null) return NotFound(new { message = "Faol a'zolik topilmadi" });
        var status = sg.Status;
        sg.IsActive = false;
        sg.LeftAt = AppClock.Today.ToString("yyyy-MM-dd");

        var reason = await ReasonLabelAsync(reasonId);
        var cls = await db.Classes.FindAsync(id);
        var statusLabel = status == "active" ? "aktiv" : status == "frozen" ? "muzlatilgan" : "sinovdagi";
        audit.Record("Membership", $"{id}:{studentId}", "delete",
            $"Guruhdan chiqarildi ({statusLabel}, guruh: {cls?.Name ?? id})" + (reason.Length > 0 ? $" — sabab: {reason}" : ""),
            studentId: studentId);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>A'zolikni SINOVGA qaytarish (active/frozen → trial). Oylik to'lov hisoblanmaydi (trial).</summary>
    [HttpPost("{id}/members/{studentId}/return-trial")]
    public async Task<IActionResult> ReturnToTrial(string id, string studentId, MembershipStatusRequest req)
    {
        var sg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (sg is null) return NotFound(new { message = "Faol a'zolik topilmadi" });
        sg.Status = "trial";
        sg.ActivatedAt = string.Empty;
        sg.FrozenAt = string.Empty;

        var reason = await ReasonLabelAsync(req.ReasonId);
        var cls = await db.Classes.FindAsync(id);
        audit.Record("Membership", $"{id}:{studentId}", "update",
            $"Sinovga qaytarildi (guruh: {cls?.Name ?? id})" + (reason.Length > 0 ? $" — sabab: {reason}" : ""),
            studentId: studentId);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>A'zolikni AKTIVLASHTIRISH (sinov → faol). Birinchi (qisman) oy to'lovi avtomatik hisoblanadi:
    /// (guruh oylik narxi ÷ 12) × shu sanadan oy oxirigacha qolgan darslar; to'liq oylikdan oshmaydi;
    /// chegirma qo'llanadi. Keyingi to'liq oylar oddiy oylik hisob (AccrueMonth) orqali.</summary>
    [HttpPost("{id}/members/{studentId}/activate")]
    public async Task<IActionResult> ActivateMember(string id, string studentId, MembershipStatusRequest req)
    {
        var sg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (sg is null) return NotFound(new { message = "Faol a'zolik topilmadi" });
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound(new { message = "Guruh topilmadi" });
        var date = string.IsNullOrWhiteSpace(req.Date) ? AppClock.Today.ToString("yyyy-MM-dd") : req.Date!.Trim();

        // SHU OYDA muzlatilgandan keyin qayta aktivlashtirilyaptimi? Bo'lsa, muzlatishgacha studied segment
        // saqlanib, yangi segment USTIGA QO'SHILADI (aks holda studied portion yo'qolardi).
        var reactivateFromFreeze = sg.Status == "frozen"
            && sg.FrozenAt.Length >= 7 && date.Length >= 7 && sg.FrozenAt[..7] == date[..7];

        sg.Status = "active";
        sg.ActivatedAt = date;
        sg.FrozenAt = string.Empty;

        var s = await db.Students.FindAsync(studentId);
        if (s is not null)
            await TuitionService.ChargeActivationProrateAsync(db, s, cls, date, addSegment: reactivateFromFreeze);

        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>A'zolikni MUZLATISH — kiritilgan sanadan (shu oydan) boshlab oylik to'lov hisoblanmaydi.</summary>
    [HttpPost("{id}/members/{studentId}/freeze")]
    public async Task<IActionResult> FreezeMember(string id, string studentId, MembershipStatusRequest req)
    {
        var sg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (sg is null) return NotFound(new { message = "Faol a'zolik topilmadi" });
        var date = string.IsNullOrWhiteSpace(req.Date) ? AppClock.Today.ToString("yyyy-MM-dd") : req.Date!.Trim();
        var activatedAt = sg.ActivatedAt;
        sg.Status = "frozen";
        sg.FrozenAt = date;

        // Muzlatish OYINING qisman to'lovi: shu sanagacha qatnashgan darslar uchun (to'liq oy emas).
        var cls = await db.Classes.FindAsync(id);
        var s = await db.Students.FindAsync(studentId);
        if (cls is not null && s is not null)
            await TuitionService.ChargeFreezeProrateAsync(db, s, cls, activatedAt, date);

        var reason = await ReasonLabelAsync(req.ReasonId);
        audit.Record("Membership", $"{id}:{studentId}", "update",
            $"Muzlatildi ({date}, guruh: {cls?.Name ?? id})" + (reason.Length > 0 ? $" — sabab: {reason}" : ""),
            studentId: studentId);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>O'quvchining barcha guruh a'zoliklari (faol + o'tgan) — kurs/o'qituvchi/holat/narx/jadval bilan (kartalar uchun).</summary>
    [HttpGet("student/{studentId}/groups")]
    public async Task<ActionResult<IEnumerable<StudentGroupDto>>> StudentGroups(string studentId)
    {
        var memberships = await db.StudentGroups.Where(sg => sg.StudentId == studentId).ToListAsync();
        var groupIds = memberships.Select(m => m.GroupId).ToList();
        var classes = (await db.Classes.Where(c => groupIds.Contains(c.Id)).ToListAsync())
            .ToDictionary(c => c.Id);
        var courseIds = classes.Values.Select(c => c.CourseId).Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        var teacherIds = classes.Values.Select(c => c.TeacherId).Where(s => !string.IsNullOrEmpty(s)).Distinct().ToList();
        var courseNames = (await db.Subjects.Where(s => courseIds.Contains(s.Id)).ToListAsync())
            .ToDictionary(s => s.Id, s => s.Name);
        var teacherNames = (await db.Teachers.Where(t => teacherIds.Contains(t.Id)).ToListAsync())
            .ToDictionary(t => t.Id, t => t.FullName);

        var rows = memberships
            .Where(m => classes.ContainsKey(m.GroupId))
            .Select(m =>
            {
                var c = classes[m.GroupId];
                return new StudentGroupDto(
                    m.Id, c.Id, c.Name, m.JoinedAt, m.LeftAt, m.IsActive,
                    m.Status ?? "trial",
                    string.IsNullOrEmpty(c.CourseId) ? "" : courseNames.GetValueOrDefault(c.CourseId, ""),
                    string.IsNullOrEmpty(c.TeacherId) ? "" : teacherNames.GetValueOrDefault(c.TeacherId, ""),
                    c.MonthlyFee, c.Days, c.StartTime, c.EndTime, c.Room ?? "");
            })
            .OrderByDescending(r => r.IsActive).ThenBy(r => r.GroupName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return rows;
    }

    /// <summary>Guruh to'ldirish hisoboti: har guruhda nechta o'quvchi, nechta bo'sh o'rin.</summary>
    [HttpGet("fill")]
    public async Task<ActionResult<IEnumerable<GroupFillRowDto>>> Fill()
    {
        var groups = await db.Classes.Where(c => !c.IsArchived)
            .OrderBy(c => c.Grade).ThenBy(c => c.Name).ToListAsync();
        var counts = (await db.StudentGroups.Where(sg => sg.IsActive)
                .GroupBy(sg => sg.GroupId)
                .Select(g => new { GroupId = g.Key, Count = g.Count() }).ToListAsync())
            .ToDictionary(x => x.GroupId, x => x.Count);
        return groups.Select(c =>
        {
            var enrolled = counts.GetValueOrDefault(c.Id, 0);
            var free = c.Capacity > 0 ? Math.Max(0, c.Capacity - enrolled) : 0;
            return new GroupFillRowDto(c.Id, c.Name, c.Grade, c.Capacity, enrolled, free, c.Status);
        }).ToList();
    }

}
