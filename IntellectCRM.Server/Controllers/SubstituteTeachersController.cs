using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Infrastructure.Data;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'rinbosar o'qituvchilarni boshqarish API (Admin portal).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("teachers")]
[Route("api/admin/substitute-teachers")]
public class SubstituteTeachersController(AppDbContext db, AuditService audit) : ControllerBase
{
    private string ActorName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst(ClaimTypes.Email)?.Value ?? "Admin";
    private string? ActorUserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// O'rinbosar o'qituvchi tayinlovlari ro'yxatini olish.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAssignments(
        [FromQuery] string? groupId,
        [FromQuery] string? teacherId,
        [FromQuery] string? date,
        [FromQuery] bool? isActive)
    {
        var result = await SubstituteTeacherService.GetAssignmentsAsync(db, groupId, teacherId, date, isActive);
        return Ok(result);
    }

    /// <summary>
    /// Guruhning oydagi dars kunlarini olish (modal uchun).
    /// </summary>
    [HttpGet("group-lesson-dates")]
    public async Task<IActionResult> GetGroupLessonDates(
        [FromQuery] string groupId,
        [FromQuery] string month)
    {
        var result = await SubstituteTeacherService.GetGroupLessonDatesAsync(db, groupId, month);
        return Ok(result);
    }

    /// <summary>
    /// ID bo'yicha tayinlovni olish.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var item = await SubstituteTeacherService.GetByIdAsync(db, id);
        if (item is null) return NotFound();
        return Ok(item);
    }

    /// <summary>
    /// Yangi o'rinbosar o'qituvchi tayinlash.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSubstituteAssignmentRequest req)
    {
        var (ok, message, entity) = await SubstituteTeacherService.CreateAssignmentAsync(db, req, ActorName, ActorUserId);
        if (!ok)
            return BadRequest(new { message });

        audit.Record("substitute_teacher", entity!.Id, "create",
            $"O'rinbosar o'qituvchi biriktirildi. Guruh: {req.GroupId}, O'rinbosar: {req.SubstituteTeacherId}, Sana: {req.Date}");

        var created = await SubstituteTeacherService.GetByIdAsync(db, entity.Id);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, created);
    }

    /// <summary>
    /// O'rinbosar o'qituvchi tayinlovini bekor qilish.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Cancel(string id)
    {
        var (ok, message) = await SubstituteTeacherService.CancelAssignmentAsync(db, id);
        if (!ok)
            return BadRequest(new { message });

        audit.Record("substitute_teacher", id, "cancel",
            $"O'rinbosar o'qituvchi tayinlovi bekor qilindi (ID: {id})");

        return Ok(new { message });
    }
}
