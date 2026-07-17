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
        var subject = new Subject { Name = payload.Name, Price = payload.Price, LessonPrice = payload.LessonPrice };
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
        subject.LessonPrice = payload.LessonPrice;

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
        // O'quv dasturlari mustaqil (Curriculum) — o'chirilmaydi, faqat biriktirilgan holat tozalanadi.
        await db.SubjectCurricula.Where(sc => sc.SubjectId == id).ExecuteDeleteAsync();
        db.Subjects.Remove(subject);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Kursga biriktirilgan o'quv dasturlari (ko'p-ko'pga) ----

    /// <summary>Shu kursga biriktirilgan o'quv dasturlari ro'yxati (biriktirish tartibi bilan).</summary>
    [HttpGet("{id}/curricula")]
    public async Task<ActionResult<List<SubjectCurriculumDto>>> GetCurricula(string id)
    {
        var links = await db.SubjectCurricula
            .Where(sc => sc.SubjectId == id).OrderBy(sc => sc.Order).ToListAsync();
        var curriculumIds = links.Select(l => l.CurriculumId).ToList();
        var names = await db.Curricula.Where(c => curriculumIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);
        return links.Select(l => new SubjectCurriculumDto(
            l.CurriculumId, names.GetValueOrDefault(l.CurriculumId, "?"), l.Order)).ToList();
    }

    /// <summary>Bitta o'quv dasturini shu kursga biriktiradi (bitta dastur bir nechta kursga,
    /// bitta kurs bir nechta dasturga biriktirilishi mumkin — ko'p-ko'pga). Allaqachon biriktirilgan
    /// bo'lsa — o'zgarishsiz muvaffaqiyatli qaytadi.</summary>
    [HttpPost("{id}/curricula/{curriculumId}")]
    public async Task<ActionResult> AttachCurriculum(string id, string curriculumId)
    {
        var subject = await db.Subjects.FindAsync(id);
        if (subject is null) return NotFound(new { message = "Kurs topilmadi" });
        var curriculum = await db.Curricula.FindAsync(curriculumId);
        if (curriculum is null) return NotFound(new { message = "Dastur topilmadi" });

        var exists = await db.SubjectCurricula.AnyAsync(sc => sc.SubjectId == id && sc.CurriculumId == curriculumId);
        if (!exists)
        {
            var maxOrder = await db.SubjectCurricula
                .Where(sc => sc.SubjectId == id).Select(sc => (int?)sc.Order).MaxAsync() ?? -1;
            db.SubjectCurricula.Add(new SubjectCurriculum { SubjectId = id, CurriculumId = curriculumId, Order = maxOrder + 1 });
            await db.SaveChangesAsync();
        }
        return Ok(new { ok = true });
    }

    /// <summary>Dasturni shu kursdan uzadi (progress/kontentga tegilmaydi — faqat bog'lanish o'chadi).</summary>
    [HttpDelete("{id}/curricula/{curriculumId}")]
    public async Task<ActionResult> DetachCurriculum(string id, string curriculumId)
    {
        await db.SubjectCurricula
            .Where(sc => sc.SubjectId == id && sc.CurriculumId == curriculumId).ExecuteDeleteAsync();
        return NoContent();
    }
}
