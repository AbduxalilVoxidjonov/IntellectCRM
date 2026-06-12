using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/subjects")]
public class SubjectsController(AppDbContext db, AuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Subject>>> GetAll() =>
        await db.Subjects.OrderBy(s => s.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Subject>> Create(SubjectPayload payload)
    {
        var subject = new Subject { Name = payload.Name, Price = payload.Price };
        db.Subjects.Add(subject);
        await db.SaveChangesAsync();
        return subject;
    }

    /// <summary>
    /// Kursni tahrirlash. Narx o'zgarsa — shu kursga bog'langan BARCHA guruhlarning oylik to'lovi
    /// (<c>MonthlyFee</c>) yangi narxga yangilanadi. <paramref name="applyFee"/> = true ("Ha — joriy
    /// oydan") bo'lsa, yangi narx shu guruhlardagi o'quvchilarning JORIY oy hisobiga ham qo'llanadi
    /// (balans farqqa moslanadi, qo'lda tahrirlangan oyliklar tegilmaydi). false ("Yo'q") bo'lsa —
    /// joriy oy eski narxda qoladi, yangi narx keyingi oy hisoblashidan amal qiladi.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Subject>> Update(string id, SubjectPayload payload, [FromQuery] bool applyFee = false)
    {
        var subject = await db.Subjects.FindAsync(id);
        if (subject is null) return NotFound();
        var oldPrice = subject.Price;
        subject.Name = payload.Name;
        subject.Price = payload.Price;

        if (oldPrice != payload.Price)
        {
            // Shu kursga bog'langan guruhlar oyligini yangi narxga yangilaymiz.
            var groups = await db.Classes.Where(c => c.CourseId == id).ToListAsync();
            var appliedTotal = 0;
            foreach (var g in groups)
            {
                var gOld = g.MonthlyFee;
                g.MonthlyFee = payload.Price;
                if (applyFee && gOld != payload.Price)
                    appliedTotal += await TuitionService.ApplyGroupFeeToCurrentMonthAsync(db, g.Id, g.Name, payload.Price);
            }

            var summary = $"Kurs narxi o'zgartirildi: {AuditService.Money(oldPrice)} → {AuditService.Money(payload.Price)} so'm ({subject.Name}) — {groups.Count} ta guruhga";
            summary += applyFee
                ? $", joriy oydan {appliedTotal} o'quvchiga qo'llandi"
                : ", keyingi oydan amal qiladi";
            audit.Record(AuditService.EntityClassFee, subject.Id, "update", summary,
                before: new { Price = oldPrice, subject.Name }, after: new { subject.Price, subject.Name });
        }

        await db.SaveChangesAsync();
        return subject;
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var subject = await db.Subjects.FindAsync(id);
        if (subject is null) return NotFound();
        db.Subjects.Remove(subject);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
