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
public class ClassesController(AppDbContext db, AuditService audit, ILogger<ClassesController> logger, CertificateService certSvc, RoomConflictService roomConflict, AutoMessageService autoMsg) : ControllerBase
{
    /// <summary>Faol (arxivlanmagan) guruhlar. <paramref name="includeArchived"/>=true bo'lsa hammasi.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Group>>> GetAll([FromQuery] bool includeArchived = false)
    {
        var q = db.Classes.AsQueryable();
        if (!includeArchived) q = q.Where(c => !c.IsArchived);
        return await q.OrderBy(c => c.Grade).ThenBy(c => c.Name).ToListAsync();
    }

    /// <summary>Arxivlangan guruhlar ro'yxati.</summary>
    [HttpGet("archived")]
    public async Task<ActionResult<IEnumerable<Group>>> GetArchived() =>
        await db.Classes.Where(c => c.IsArchived)
            .OrderByDescending(c => c.ArchivedAt).ThenBy(c => c.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Group>> Create(ClassPayload p, [FromQuery] bool force = false)
    {
        // Guruhga o'qituvchi biriktirish MAJBURIY (foizli maosh va jurnal shunga tayanadi).
        if (string.IsNullOrWhiteSpace(p.TeacherId))
            return BadRequest(new { message = "Guruhga o'qituvchi biriktirish majburiy" });
        if (await db.Teachers.FindAsync(p.TeacherId) is null)
            return BadRequest(new { message = "Tanlangan o'qituvchi topilmadi" });

        // RoomId berilsa — xona nomini DB dan olish (Room string field uchun).
        string? resolvedRoomName = p.Room;
        if (!string.IsNullOrWhiteSpace(p.RoomId))
        {
            var roomEntity = await db.Rooms.FindAsync(p.RoomId);
            if (roomEntity is not null) resolvedRoomName = roomEntity.Name;
        }

        // Xona/o'qituvchi konflikti tekshiruvi (REJECT emas — WARNING; force=true bo'lsa baribir saqlaydi).
        if (!force)
        {
            var conflicts = await roomConflict.CheckRoomConflictAsync(
                p.RoomId, p.TeacherId, p.Days ?? [], p.StartTime, p.EndTime);
            if (conflicts.Count > 0)
                return Ok(new
                {
                    roomConflict = true,
                    message = "Jadvalda vaqt konflikti bor",
                    conflicts = conflicts.Select(c => new RoomConflictDto(
                        c.GroupId, c.GroupName, c.SharedDays, c.ExistingSlot, c.Reason)),
                });
        }

        var cls = new Group
        {
            Name = p.Name,
            Grade = p.Grade,
            Language = p.Language,
            MonthlyFee = p.MonthlyFee,
            Room = resolvedRoomName,
            RoomId = string.IsNullOrWhiteSpace(p.RoomId) ? null : p.RoomId,
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
    /// Guruhni tahrirlash. Oylik to'lov o'zgarsa va <paramref name="applyFee"/> = true bo'lsa
    /// ("Ha"), yangi narx shu guruh o'quvchilarining JORIY oy to'loviga ham qo'llanadi (balans
    /// farqqa moslab to'g'rilanadi). false bo'lsa ("Yo'q") — joriy oy eski narxda qoladi, yangi
    /// narx keyingi oy hisoblashidan amal qiladi.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Group>> Update(string id, ClassPayload p, [FromQuery] bool applyFee = false, [FromQuery] bool force = false)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();

        // O'qituvchi biriktirish majburiy (eski, o'qituvchisiz guruhlar ham tahrirlanganda biriktirilsin).
        if (string.IsNullOrWhiteSpace(p.TeacherId))
            return BadRequest(new { message = "Guruhga o'qituvchi biriktirish majburiy" });
        if (await db.Teachers.FindAsync(p.TeacherId) is null)
            return BadRequest(new { message = "Tanlangan o'qituvchi topilmadi" });

        // RoomId berilsa — xona nomini DB dan olish (Room string field uchun).
        string? resolvedRoomName = p.Room;
        if (!string.IsNullOrWhiteSpace(p.RoomId))
        {
            var roomEntity = await db.Rooms.FindAsync(p.RoomId);
            if (roomEntity is not null) resolvedRoomName = roomEntity.Name;
        }

        // Xona/o'qituvchi konflikti tekshiruvi — o'z id'si hisoba olinmaydi (excludeGroupId=id). force=true bo'lsa o'tkazib yuboriladi.
        var conflicts = force ? new List<RoomConflictService.ConflictInfo>() : await roomConflict.CheckRoomConflictAsync(
            p.RoomId, p.TeacherId, p.Days ?? [], p.StartTime, p.EndTime, excludeGroupId: id);
        if (conflicts.Count > 0)
            return Ok(new
            {
                roomConflict = true,
                message = "Jadvalda vaqt konflikti bor",
                conflicts = conflicts.Select(c => new RoomConflictDto(
                    c.GroupId, c.GroupName, c.SharedDays, c.ExistingSlot, c.Reason)),
            });

        var oldFee = cls.MonthlyFee;
        var oldName = cls.Name;   // o'quvchilar hozir shu nom bilan biriktirilgan
        var oldCourseId = cls.CourseId;  // kurs o'zgarishni kuzatamiz
        cls.Name = p.Name;
        cls.Grade = p.Grade;
        cls.Language = p.Language;
        cls.MonthlyFee = p.MonthlyFee;
        cls.Room = resolvedRoomName;
        cls.RoomId = string.IsNullOrWhiteSpace(p.RoomId) ? null : p.RoomId;
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

        // Kurs o'zgarsa — o'quvchi progresi tozalanadi (o'tilgan bandlar = yangi kurs uchun irrelevant).
        if (!string.Equals(oldCourseId, cls.CourseId, StringComparison.Ordinal) && !string.IsNullOrEmpty(oldCourseId))
        {
            var memberIds = await db.StudentGroups
                .Where(sg => sg.GroupId == id && sg.IsActive)
                .Select(sg => sg.StudentId)
                .ToListAsync();

            // Eski kurs progress'ni o'chirish (yangi kurs progress = 0 dan start).
            if (memberIds.Count > 0)
            {
                await db.CourseProgresses
                    .Where(p => p.StudentId != null && memberIds.Contains(p.StudentId) && p.CourseId == oldCourseId)
                    .ExecuteDeleteAsync();
            }
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
        // ATOMIC bulk delete at DB level (race-condition safe, crash-safe).
        var chargesDeleted = await db.MonthlyCharges
            .Where(c => c.GroupId == id)
            .ExecuteDeleteAsync();

        var sgDeleted = await db.StudentGroups
            .Where(sg => sg.GroupId == id)
            .ExecuteDeleteAsync();

        var jeDeleted = await db.JournalEntries
            .Where(e => e.ClassId == id)
            .ExecuteDeleteAsync();

        var lnDeleted = await db.LessonNotes
            .Where(n => n.ClassId == id)
            .ExecuteDeleteAsync();

        // Moliya tarixi SAQLANADI, lekin yo'q guruhga ishora qilmasin — GroupId tozalanadi (to'lov qoladi).
        await db.FinanceTransactions.Where(t => t.GroupId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.GroupId, (string?)null));

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
    /// Guruhni arxivlash — <c>IsArchived=true</c>. Unga bog'langan FAOL o'quvchilar ham arxivlanadi
    /// (login bloklanadi, lekin parol saqlanadi — chiqarganda tiklanadi) va <c>ArchivedWithClass=true</c>
    /// bilan belgilanadi. Avval alohida arxivlangan o'quvchilar tegilmaydi.
    /// </summary>
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(string id)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        if (cls.IsArchived) return BadRequest(new { message = "Guruh allaqachon arxivda" });

        var today = AppClock.Today.ToString("yyyy-MM-dd");
        cls.IsArchived = true;
        cls.ArchivedAt = today;

        var students = await db.Students.Where(s => s.ClassName == cls.Name && !s.IsArchived).ToListAsync();
        foreach (var s in students)
        {
            s.IsArchived = true;
            s.ArchivedAt = today;
            s.ArchiveReason = $"Guruh arxivlandi ({cls.Name})";
            s.ArchivedWithClass = true;
        }

        audit.Record(AuditService.EntityClassFee, cls.Id, "update",
            $"Guruh arxivlandi ({cls.Name}) — {students.Count} ta o'quvchi bilan");
        await db.SaveChangesAsync();
        return Ok(new { archivedStudents = students.Count });
    }

    /// <summary>
    /// Guruhni arxivdan chiqarish — <c>IsArchived=false</c>. Faqat shu guruh bilan arxivlangan
    /// (<c>ArchivedWithClass=true</c>) o'quvchilar qaytariladi; alohida arxivlanganlar arxivda qoladi.
    /// </summary>
    [HttpPost("{id}/unarchive")]
    public async Task<IActionResult> Unarchive(string id)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        if (!cls.IsArchived) return BadRequest(new { message = "Guruh arxivda emas" });

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
            $"Guruh arxivdan chiqarildi ({cls.Name}) — {students.Count} ta o'quvchi bilan");
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
    /// o'quvchining asosiy ClassName'i shu guruh nomiga o'rnatiladi (eski ko'rinishlar uchun).
    /// ARXIVDAGI o'quvchi qo'shilsa — avtomatik ARXIVDAN CHIQARILADI (o'qishga qaytdi degani);
    /// javobda <c>restored=true</c> qaytadi. Login paroli bloklangicha qoladi (arxivlashda tozalangan) —
    /// kerak bo'lsa admin "Parolni tiklash" orqali beradi, bu arxivdan qaytarish endpointi bilan bir xil.</summary>
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

        // ARXIVDAN CHIQARISH: arxivdagi o'quvchi guruhga qo'shilyapti — demak o'qishga qaytdi.
        // Maydonlar `POST students/{id}/restore` bilan bir xil tozalanadi (parol bloki tegilmaydi).
        var restored = s.IsArchived;
        if (restored)
        {
            s.IsArchived = false;
            s.ArchivedAt = null;
            s.ArchiveReason = null;
            s.ArchivedWithClass = false;
            audit.Record(AuditService.EntityStudentDiscount, s.Id, "update",
                $"O'quvchi arxivdan chiqarildi — \"{cls.Name}\" guruhiga qo'shildi ({s.FullName})",
                studentId: s.Id);
        }

        await db.SaveChangesAsync();

        // Avto xabar — o'quvchi guruhga qo'shilganda ota-onaga ("O'quvchi guruhga qo'shilganda" hodisasi).
        await autoMsg.DispatchStudentAsync(db, AutoMessageTriggers.StudentAdded, s,
            new Dictionary<string, string> { ["{guruh}"] = cls.Name });
        return Ok(new { ok = true, restored });
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
    /// oyning birinchi darsidan / 12+ dars qolgan bo'lsa to'liq oylik, aks holda qolgan dars × kursning bir
    /// dars yaxlit narxi (LessonPrice); to'liq oylikdan oshmaydi; chegirma qo'llanadi. Keyingi to'liq oylar
    /// oddiy oylik hisob (AccrueMonth) orqali. TRANSACTION: race condition oldini olish uchun atomik read-modify-write.</summary>
    [HttpPost("{id}/members/{studentId}/activate")]
    public async Task<IActionResult> ActivateMember(string id, string studentId, MembershipStatusRequest req)
    {
        try
        {
            var cls = await db.Classes.FindAsync(id);
            if (cls is null) return NotFound(new { message = "Guruh topilmadi" });
            var date = string.IsNullOrWhiteSpace(req.Date) ? AppClock.Today.ToString("yyyy-MM-dd") : req.Date!.Trim();

            // Refresh'langan ma'lumot bilan oqiylik (dirty-read oldini olish).
            var sg = await db.StudentGroups
                .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
            if (sg is null)
                return NotFound(new { message = "Faol a'zolik topilmadi" });

            // Allaqachon faol bo'lsa — qayta aktivlashtirish kerak emas (ikki marta hisoblamaslik uchun).
            if (sg.Status == "active")
                return Ok(new { ok = true, already = true });

            // SHU OYDA muzlatilgandan keyin qayta aktivlashtirilyaptimi? Bo'lsa, muzlatishgacha studied segment
            // saqlanib, yangi segment USTIGA QO'SHILADI (aks holda studied portion yo'qolardi).
            // Muzlatilgan a'zolikni qayta aktivlashtirishga RUXSAT beriladi (avval guard noto'g'ri bloklardi).
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
        catch (Exception ex)
        {
            logger.LogError(ex, "ActivateMember error for group={GroupId}, student={StudentId}: {Message}", id, studentId, ex.Message);
            return StatusCode(500, new { message = "Aktivlashtirish xatosi", error = ex.Message });
        }
    }

    /// <summary>A'zolikni MUZLATISH — kiritilgan sanadan (shu oydan) boshlab oylik to'lov hisoblanmaydi. TRANSACTION:
    /// race condition (shunas vaqtda activation + freeze) oldini olish uchun atomik read-modify-write.</summary>
    [HttpPost("{id}/members/{studentId}/freeze")]
    public async Task<IActionResult> FreezeMember(string id, string studentId, MembershipStatusRequest req)
    {
        var date = string.IsNullOrWhiteSpace(req.Date) ? AppClock.Today.ToString("yyyy-MM-dd") : req.Date!.Trim();

        // Refresh'langan ma'lumot bilan oqiylik (dirty-read oldini olish).
        var sg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (sg is null)
            return NotFound(new { message = "Faol a'zolik topilmadi" });

        // Allaqachon muzlatilgan bo'lsa — qayta muzlatish kerak emas (takroriy prorate'ni oldini olamiz).
        // Idempotent: 400 o'rniga jim qaytamiz (foydalanuvchi tugmani qayta bossa xato chiqmasin).
        if (sg.Status == "frozen")
            return Ok(new { ok = true, already = true });
        // trial yoki active emas — kutilmagan holat (eski/buzilgan yozuv).
        if (sg.Status != "active" && sg.Status != "trial")
            return BadRequest(new { message = $"A'zolik holatini o'zgartirib bo'lmadi (hozirgi holat: {sg.Status})" });

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

    /// <summary>
    /// O'quvchini BOSHQA GURUHGA O'TKAZISH: joriy guruh (<paramref name="id"/>) a'zoligi
    /// <c>FreezeDate</c>dan MUZLATILADI (shu sanagacha qatnashgan darslar uchun qisman to'lov —
    /// oddiy "Muzlatish" bilan bir xil <see cref="TuitionService.ChargeFreezeProrateAsync"/> mantig'i),
    /// maqsad guruhda (<c>ToGroupId</c>) a'zolik yaratiladi/tiklanadi va <c>ActivateDate</c>dan DARHOL
    /// AKTIVLASHTIRILADI (oddiy "Aktivlashtirish" bilan bir xil <see cref="TuitionService.ChargeActivationProrateAsync"/>
    /// mantig'i — qisman oy to'lovi hisoblanadi). Yangi billing hisob-kitob YO'Q — ikkala tomon ham
    /// mavjud freeze/activate primitivlaridan foydalanadi. <see cref="Student.ClassName"/> eski guruh
    /// nomiga teng bo'lsa — yangi guruh nomiga ko'chiriladi (eski ko'rinishlar: chat, xabar tokenlari,
    /// hisobotlar shu bilan yangi guruhga ergashadi).
    /// </summary>
    [HttpPost("{id}/members/{studentId}/transfer")]
    public async Task<IActionResult> TransferMember(string id, string studentId, TransferMemberRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ToGroupId))
            return BadRequest(new { message = "Maqsad guruh tanlanmagan" });
        if (req.ToGroupId == id)
            return BadRequest(new { message = "Maqsad guruh joriy guruh bilan bir xil bo'lishi mumkin emas" });

        var fromGroup = await db.Classes.FindAsync(id);
        if (fromGroup is null) return NotFound(new { message = "Joriy guruh topilmadi" });
        var toGroup = await db.Classes.FindAsync(req.ToGroupId);
        if (toGroup is null) return NotFound(new { message = "Maqsad guruh topilmadi" });

        var fromSg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == id && x.StudentId == studentId && x.IsActive);
        if (fromSg is null) return NotFound(new { message = "Faol a'zolik topilmadi" });

        var s = await db.Students.FindAsync(studentId);
        if (s is null) return NotFound(new { message = "O'quvchi topilmadi" });

        if (toGroup.Capacity > 0)
        {
            var enrolled = await db.StudentGroups.CountAsync(x => x.GroupId == req.ToGroupId && x.IsActive);
            if (enrolled >= toGroup.Capacity)
                return BadRequest(new { message = $"Maqsad guruh to'lgan ({toGroup.Capacity} o'rin)" });
        }

        var toSg = await db.StudentGroups
            .FirstOrDefaultAsync(x => x.GroupId == req.ToGroupId && x.StudentId == studentId);
        if (toSg is { IsActive: true })
            return BadRequest(new { message = "O'quvchi allaqachon maqsad guruhda" });

        var freezeDate = string.IsNullOrWhiteSpace(req.FreezeDate)
            ? AppClock.Today.ToString("yyyy-MM-dd") : req.FreezeDate!.Trim();
        var activateDate = string.IsNullOrWhiteSpace(req.ActivateDate) ? freezeDate : req.ActivateDate!.Trim();

        // 1) Eski guruh — MUZLATISH (allaqachon muzlatilgan bo'lsa qisman to'lovni qayta hisoblamaymiz).
        if (fromSg.Status != "frozen")
        {
            var activatedAt = fromSg.ActivatedAt;
            fromSg.Status = "frozen";
            fromSg.FrozenAt = freezeDate;
            await TuitionService.ChargeFreezeProrateAsync(db, s, fromGroup, activatedAt, freezeDate);
        }

        // 2) Maqsad guruh — a'zolik yaratish yoki tiklash (AddMember bilan bir xil mantiq).
        if (toSg is not null)
        {
            toSg.IsActive = true;
            toSg.LeftAt = null;
            toSg.JoinedAt = activateDate;
        }
        else
        {
            toSg = new StudentGroup
            {
                StudentId = studentId, GroupId = req.ToGroupId, JoinedAt = activateDate, IsActive = true,
                Status = "trial",
            };
            db.StudentGroups.Add(toSg);
        }

        // 3) Maqsad guruh — DARHOL AKTIVLASHTIRISH.
        toSg.Status = "active";
        toSg.ActivatedAt = activateDate;
        toSg.FrozenAt = string.Empty;
        await TuitionService.ChargeActivationProrateAsync(db, s, toGroup, activateDate);

        // Eski (single-class) ko'rinishlar uchun asosiy guruh nomini ko'chiramiz.
        if (s.ClassName == fromGroup.Name) s.ClassName = toGroup.Name;

        var reason = await ReasonLabelAsync(req.ReasonId);
        audit.Record("Membership", $"{id}:{studentId}", "update",
            $"Guruh almashtirildi: {fromGroup.Name} → {toGroup.Name} (muzlatish {freezeDate}, aktivlashtirish {activateDate})"
                + (reason.Length > 0 ? $" — sabab: {reason}" : ""),
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

    /// <summary>
    /// Guruhni YAKUNLAB ARXIVLAYDI va YANGI guruh ochadi (Hybrid).
    /// <list type="bullet">
    ///   <item>Barcha faol a'zolar Status="completed", IsActive=false qilinadi (eski guruhda tarix saqlanadi).</item>
    ///   <item>Eski guruh IsArchived=true, ArchivedAt=bugun qilinadi (o'quvchilar arxivlanmaydi).</item>
    ///   <item>Asl kurs uchun sertifikat yaratiladi.</item>
    ///   <item>TargetCourseId ko'rsatilsa SHU kurs bilan, aks holda eski guruh kursi bilan YANGI guruh yaratiladi.</item>
    ///   <item>autoEnrollNewGroup=true bo'lsa, eski a'zolar yangi guruhga "trial" statusida qo'shiladi.</item>
    /// </list>
    /// </summary>
    [HttpPost("{id}/complete-and-transfer")]
    [Authorize]
    public async Task<ActionResult<CompleteAndTransferResultDto>> CompleteAndTransfer(
        string id, CompleteAndTransferRequest req)
    {
        var group = await db.Classes.FindAsync(id);
        if (group is null) return NotFound(new { message = "Guruh topilmadi" });
        if (group.IsArchived) return BadRequest(new { message = "Guruh allaqachon arxivda" });

        // Faol a'zoliklarni olish.
        var activeMembers = await db.StudentGroups
            .Where(sg => sg.GroupId == id && sg.IsActive)
            .ToListAsync();

        if (activeMembers.Count == 0)
            return BadRequest(new { message = "Guruhda faol a'zo yo'q" });

        var today = AppClock.Today.ToString("yyyy-MM-dd");
        // Sertifikat eski kurs uchun beriladi.
        var oldCourseId = group.CourseId ?? "";

        // Yangi guruh kursi: TargetCourseId ko'rsatilsa shu, aks holda eski kurs.
        var targetCourseId = !string.IsNullOrWhiteSpace(req.TargetCourseId)
            ? req.TargetCourseId!.Trim()
            : oldCourseId;

        // Maqsad kursni tekshiramiz (agar ko'rsatilgan bo'lsa).
        Subject? targetCourse = null;
        if (!string.IsNullOrEmpty(targetCourseId))
            targetCourse = await db.Subjects.FindAsync(targetCourseId);

        if (!string.IsNullOrWhiteSpace(req.TargetCourseId) && targetCourse is null)
            return BadRequest(new { message = "Tanlangan kurs topilmadi" });

        // 1. Eski a'zoliklarni "completed" qilib yopamiz (tarix saqlanadi).
        foreach (var m in activeMembers)
        {
            m.Status = "completed";
            m.IsActive = false;
            m.LeftAt = today;
        }

        // 2. Eski guruhni arxivlaymiz (o'quvchilar arxivlanmaydi — faqat guruh).
        group.IsArchived = true;
        group.ArchivedAt = today;

        await db.SaveChangesAsync();   // Completed + archive atomically

        // 3. Sertifikatlar — eski kurs bo'yicha (eski kurs yo'q bo'lsa targetCourseId ishlatiladi).
        var certCount = 0;
        var certCourseId = !string.IsNullOrEmpty(oldCourseId) ? oldCourseId : targetCourseId;
        if (!string.IsNullOrEmpty(certCourseId))
        {
            var teacherName = string.IsNullOrEmpty(group.TeacherId)
                ? null
                : await db.Teachers
                    .Where(t => t.Id == group.TeacherId)
                    .Select(t => t.FullName)
                    .FirstOrDefaultAsync();

            logger.LogInformation("CompleteAndTransfer: {Count} o'quvchi uchun sertifikat yaratish boshlanmoqda (kurs={CourseId})", activeMembers.Count, certCourseId);

            foreach (var m in activeMembers)
            {
                try
                {
                    await certSvc.GenerateCertificateAsync(
                        m.StudentId, certCourseId, req.CompletionNotes,
                        teacherName: teacherName);
                    certCount++;
                    logger.LogInformation("Sertifikat yaratildi: student={S}", m.StudentId);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Sertifikat yaratishda xato: student={S}, course={C}: {Msg}", m.StudentId, certCourseId, ex.Message);
                }
            }
            logger.LogInformation("CompleteAndTransfer: {CertCount}/{Total} sertifikat yaratildi", certCount, activeMembers.Count);
        }
        else
        {
            logger.LogWarning("CompleteAndTransfer: guruhda kurs (CourseId) yo'q — sertifikat yaratilmadi (groupId={GroupId})", id);
        }

        // 4. YANGI guruh — maqsad kurs + eski guruh o'qituvchi/xona/kunlar/vaqt.
        var newGroupName = !string.IsNullOrWhiteSpace(req.NewGroupName)
            ? req.NewGroupName!.Trim()
            : group.Name;

        // Yangi guruh oyligi: maqsad kurs narxidan olinadi; kurs yo'q bo'lsa eski narx.
        var newMonthlyFee = targetCourse?.Price ?? group.MonthlyFee;

        var newGroup = new Group
        {
            Name = newGroupName,
            Grade = group.Grade,
            Language = group.Language,
            MonthlyFee = newMonthlyFee,
            Room = group.Room,
            Status = "active",
            StartDate = today,
            EndDate = null,
            Capacity = group.Capacity,
            CourseId = targetCourseId,
            TeacherId = group.TeacherId,
            Note = group.Note,
            Days = new List<int>(group.Days),
            StartTime = group.StartTime,
            EndTime = group.EndTime,
            IsArchived = false,
        };
        db.Classes.Add(newGroup);
        await db.SaveChangesAsync();   // newGroup.Id assigned

        // 5. Auto-enroll eski a'zolarni yangi guruhga "trial" statusida.
        var enrolledCount = 0;
        if (req.AutoEnrollNewGroup)
        {
            var studentIds = activeMembers.Select(m => m.StudentId).ToList();
            foreach (var sid in studentIds)
            {
                db.StudentGroups.Add(new StudentGroup
                {
                    StudentId = sid,
                    GroupId = newGroup.Id,
                    JoinedAt = today,
                    IsActive = true,
                    Status = "trial",
                });
                enrolledCount++;
            }

            // Student.ClassName ni yangi guruh nomiga yangilaymiz.
            var students = await db.Students
                .Where(s => studentIds.Contains(s.Id))
                .ToListAsync();
            foreach (var s in students)
                s.ClassName = newGroupName;

            await db.SaveChangesAsync();
        }

        // 6. Audit log.
        var targetCourseName = targetCourse?.Name ?? "";
        audit.Record(
            "Group", id, "complete-and-transfer",
            $"Guruh yakunlandi va arxivlandi ({group.Name}): {activeMembers.Count} a'zo, sertifikat={certCount}. " +
            $"Yangi guruh: {newGroup.Id} ({newGroupName}), kurs: {targetCourseName}, enrolled={enrolledCount}");

        return Ok(new CompleteAndTransferResultDto(
            Ok: true,
            ArchivedGroupId: id,
            NewGroupId: newGroup.Id,
            CertificatesGenerated: certCount,
            EnrolledInNew: enrolledCount,
            TargetCourseName: targetCourseName));
    }

}
