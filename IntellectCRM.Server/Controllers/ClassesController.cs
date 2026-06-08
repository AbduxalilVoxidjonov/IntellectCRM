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
    public async Task<ActionResult<IEnumerable<SchoolClass>>> GetAll([FromQuery] bool includeArchived = false)
    {
        var q = db.Classes.AsQueryable();
        if (!includeArchived) q = q.Where(c => !c.IsArchived);
        return await q.OrderBy(c => c.Grade).ThenBy(c => c.Name).ToListAsync();
    }

    /// <summary>Arxivlangan sinflar ro'yxati.</summary>
    [HttpGet("archived")]
    public async Task<ActionResult<IEnumerable<SchoolClass>>> GetArchived() =>
        await db.Classes.Where(c => c.IsArchived)
            .OrderByDescending(c => c.ArchivedAt).ThenBy(c => c.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<SchoolClass>> Create(ClassPayload p)
    {
        var cls = new SchoolClass
        {
            Name = p.Name,
            Grade = p.Grade,
            Language = p.Language,
            MonthlyFee = p.MonthlyFee,
            Room = p.Room,
        };
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
    public async Task<ActionResult<SchoolClass>> Update(string id, ClassPayload p, [FromQuery] bool applyFee = false)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();

        var oldFee = cls.MonthlyFee;
        var oldName = cls.Name;   // o'quvchilar hozir shu nom bilan biriktirilgan
        cls.Name = p.Name;
        cls.Grade = p.Grade;
        cls.Language = p.Language;
        cls.MonthlyFee = p.MonthlyFee;
        cls.Room = p.Room;

        if (oldFee != cls.MonthlyFee)
        {
            var applied = 0;
            if (applyFee)
            {
                var month = TuitionService.CurrentMonth();
                var students = await db.Students.Where(s => s.ClassName == oldName).ToListAsync();
                var ids = students.Select(s => s.Id).ToList();
                var charges = await db.MonthlyCharges
                    .Where(c => c.Month == month && ids.Contains(c.StudentId))
                    .ToListAsync();
                var byStudent = charges.ToDictionary(c => c.StudentId);

                foreach (var s in students)
                {
                    if (!byStudent.TryGetValue(s.Id, out var charge)) continue;
                    // Yangi narx + o'quvchining chegirmasi.
                    var newDiscount = TuitionService.DiscountFor(cls.MonthlyFee, s.DiscountPct, s.DiscountAmount);
                    var newEffective = cls.MonthlyFee - newDiscount;
                    var oldEffective = charge.Amount - charge.Discount;
                    var delta = newEffective - oldEffective;
                    if (delta == 0 && charge.Amount == cls.MonthlyFee && charge.Discount == newDiscount) continue;
                    charge.Amount = cls.MonthlyFee;
                    charge.Discount = newDiscount;
                    s.Balance -= delta;
                    applied++;
                }
            }

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
    public async Task<IActionResult> Delete(string id)
    {
        var cls = await db.Classes.FindAsync(id);
        if (cls is null) return NotFound();
        // Sinfga bog'langan (faol) o'quvchi bo'lsa — bittasi ham bo'lsa — o'chirib bo'lmaydi.
        var studentCount = await db.Students.CountAsync(s => s.ClassName == cls.Name && !s.IsArchived);
        if (studentCount > 0)
            return BadRequest(new
            {
                message = $"Bu sinfda {studentCount} ta o'quvchi bor — sinfni o'chirib bo'lmaydi. " +
                          "Avval o'quvchilarni boshqa sinfga o'tkazing yoki arxivlang.",
            });
        // Sinf jadval shablonlari va hafta biriktirishlarini ham o'chiramiz — "yetim" jadval
        // qolmasin (aks holda maosh/hisoblar o'chirilgan sinf darslarini sanayverardi).
        db.ScheduleTemplates.RemoveRange(
            await db.ScheduleTemplates.Where(t => t.ClassId == cls.Id).ToListAsync());
        db.WeekAssignments.RemoveRange(
            await db.WeekAssignments.Where(w => w.ClassId == cls.Id).ToListAsync());
        db.Classes.Remove(cls);
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

}
