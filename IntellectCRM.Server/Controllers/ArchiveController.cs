using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Arxiv — o'chirilgan Lid/O'quvchi/O'qituvchi/Xodim/Guruh/Moliya yozuvlarining JSON
/// suratlari (<see cref="ArchivedRecord"/>). Ro'yxat, tiklash (asl entity'ni qaytarib
/// qo'shadi) va butunlay o'chirish. "Sozlamalar" ruxsati talab qilinadi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("settings")]
[Route("api/admin/archive")]
public class ArchiveController(AppDbContext db) : ControllerBase
{
    /// <summary>Arxiv ro'yxati (ixtiyoriy <paramref name="type"/> bo'yicha), DeletedAt kamayuvchi.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ArchivedRecordDto>>> List([FromQuery] string? type = null)
    {
        var q = db.ArchivedRecords.AsQueryable();
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(r => r.Type == type);
        return await q
            .OrderByDescending(r => r.DeletedAt)
            .Select(r => new ArchivedRecordDto(
                r.Id, r.Type, r.EntityId, r.Title, r.Subtitle, r.Reason, r.DeletedAt, r.ActorName))
            .ToListAsync();
    }

    /// <summary>Tur bo'yicha arxiv yozuvlari soni (lead/student/teacher/staff/group/finance).</summary>
    [HttpGet("counts")]
    public async Task<ActionResult<Dictionary<string, int>>> Counts()
    {
        var counts = await db.ArchivedRecords
            .GroupBy(r => r.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync();
        var result = new Dictionary<string, int>
        {
            ["lead"] = 0, ["student"] = 0, ["teacher"] = 0,
            ["staff"] = 0, ["group"] = 0, ["finance"] = 0,
        };
        foreach (var c in counts) result[c.Type] = c.Count;
        return result;
    }

    /// <summary>Arxiv yozuvini TIKLASH — asl entity'ni qayta qo'shadi va arxiv yozuvini o'chiradi.</summary>
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(string id)
    {
        var rec = await db.ArchivedRecords.FindAsync(id);
        if (rec is null) return NotFound();

        try
        {
            var json = rec.Json;
            switch (rec.Type)
            {
                case "lead":
                    db.Leads.Add(JsonSerializer.Deserialize<Lead>(json)!);
                    break;
                case "student":
                    db.Students.Add(JsonSerializer.Deserialize<Student>(json)!);
                    break;
                case "teacher":
                    db.Teachers.Add(JsonSerializer.Deserialize<Teacher>(json)!);
                    break;
                case "staff":
                    db.Users.Add(JsonSerializer.Deserialize<AppUser>(json)!);
                    break;
                case "group":
                    db.Classes.Add(JsonSerializer.Deserialize<Group>(json)!);
                    break;
                case "finance":
                    db.FinanceTransactions.Add(JsonSerializer.Deserialize<FinanceTransaction>(json)!);
                    break;
                default:
                    return BadRequest(new { message = $"Noma'lum arxiv turi: {rec.Type}" });
            }
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Tiklab bo'lmadi: " + ex.Message });
        }

        db.ArchivedRecords.Remove(rec);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Arxiv yozuvini BUTUNLAY o'chirish (faqat surat o'chadi, boshqa narsa emas).</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Purge(string id)
    {
        var rec = await db.ArchivedRecords.FindAsync(id);
        if (rec is null) return NotFound();
        db.ArchivedRecords.Remove(rec);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
