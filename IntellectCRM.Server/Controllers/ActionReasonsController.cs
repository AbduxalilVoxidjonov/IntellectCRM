using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Amal sabablari (muzlatish/o'chirish/sinovga qaytarish/lid/guruh) — markaziy CRUD.
/// Davomat (kelmaganlik) sababi alohida (Settings → absence-reasons).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("settings")]
[Route("api/admin/action-reasons")]
public class ActionReasonsController(AppDbContext db) : ControllerBase
{
    /// <summary>Ruxsat etilgan kategoriyalar.</summary>
    private static readonly HashSet<string> Categories = new()
    {
        "freeze", "return_trial", "remove_active", "remove_trial", "remove_frozen", "lead_delete", "group_delete",
        "student_delete", "teacher_delete", "staff_delete", "finance_delete", "archive_student",
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ActionReasonDto>>> GetAll() =>
        await db.ActionReasons
            .OrderBy(r => r.Category).ThenBy(r => r.Order)
            .Select(r => new ActionReasonDto(r.Id, r.Category, r.Label, r.Order))
            .ToListAsync();

    [HttpPost]
    public async Task<ActionResult<ActionReasonDto>> Create(ActionReasonCreate p)
    {
        var category = (p.Category ?? "").Trim();
        if (!Categories.Contains(category)) return BadRequest(new { message = "Noma'lum kategoriya" });
        if (string.IsNullOrWhiteSpace(p.Label)) return BadRequest(new { message = "Sabab nomini kiriting" });
        var order = (await db.ActionReasons.Where(r => r.Category == category).MaxAsync(r => (int?)r.Order) ?? -1) + 1;
        var reason = new ActionReason { Category = category, Label = p.Label.Trim(), Order = order };
        db.ActionReasons.Add(reason);
        await db.SaveChangesAsync();
        return new ActionReasonDto(reason.Id, reason.Category, reason.Label, reason.Order);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, ActionReasonUpdate p)
    {
        var reason = await db.ActionReasons.FindAsync(id);
        if (reason is null) return NotFound();
        if (string.IsNullOrWhiteSpace(p.Label)) return BadRequest(new { message = "Sabab nomini kiriting" });
        reason.Label = p.Label.Trim();
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var reason = await db.ActionReasons.FindAsync(id);
        if (reason is null) return NotFound();
        db.ActionReasons.Remove(reason);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
