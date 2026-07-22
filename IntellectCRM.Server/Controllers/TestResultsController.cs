using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Test natijalari — "O'quv bo'limi" → Testlar natijalari. Admin/superadmin barcha guruhlarni ko'radi;
/// xodim (staff) "classes" ruxsatiga qarab yozadi (o'qish har doim ochiq). Mantiq
/// <see cref="TestResultService"/>da (o'qituvchi ilovasi bilan umumiy).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("classes")]
[Route("api/admin/test-results")]
public class TestResultsController(AppDbContext db) : ControllerBase
{
    private string Actor() =>
        User.Identity?.Name
        ?? User.FindFirst("name")?.Value
        ?? User.FindFirst(ClaimTypes.Name)?.Value
        ?? "Admin";

    /// <summary>Bosh sahifa — barcha guruhlar + har biriga yaratilgan testlar soni.</summary>
    [HttpGet("groups")]
    public async Task<List<TestGroupOverviewDto>> Groups() =>
        await TestResultService.GroupsOverviewAsync(db);

    /// <summary>Bitta guruhning testlar ro'yxati (?groupId=).</summary>
    [HttpGet]
    public async Task<List<GroupTestDto>> List([FromQuery] string groupId) =>
        await TestResultService.ListForGroupAsync(db, groupId);

    /// <summary>Test tafsiloti — o'quvchilar + ballari (ball desc).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<TestResultDetailDto>> Detail(string id)
    {
        var d = await TestResultService.DetailAsync(db, id);
        return d is null ? NotFound() : d;
    }

    /// <summary>Yangi test yaratish.</summary>
    [HttpPost]
    public async Task<ActionResult<GroupTestDto>> Create(CreateTestResultRequest req)
    {
        var (dto, err) = await TestResultService.CreateAsync(
            db, req.GroupId, req.Name, req.Date, req.MaxScore, Actor(), req.Online);
        return err != null ? BadRequest(new { message = err }) : dto!;
    }

    /// <summary>Testni tahrirlash.</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, UpdateTestResultRequest req)
    {
        var (ok, err) = await TestResultService.UpdateAsync(db, id, req.Name, req.Date, req.MaxScore, req.Online);
        return ok ? NoContent() : BadRequest(new { message = err });
    }

    /// <summary>Testni o'chirish (ballari bilan).</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id) =>
        await TestResultService.DeleteAsync(db, id) ? NoContent() : NotFound();

    /// <summary>Bitta o'quvchiga ball qo'yish/tozalash. Qaytadi: qayta saralangan tafsilot.</summary>
    [HttpPut("{id}/scores")]
    public async Task<ActionResult<TestResultDetailDto>> SetScore(string id, SetTestScoreRequest req)
    {
        var (detail, err) = await TestResultService.SetScoreAsync(db, id, req.StudentId, req.Score);
        return err != null ? BadRequest(new { message = err }) : detail!;
    }

    /// <summary>Bitta o'quvchining barcha test natijalari (profil sahifasi uchun).</summary>
    [HttpGet("student/{studentId}")]
    public async Task<List<StudentGroupTestDto>> ForStudent(string studentId) =>
        await TestResultService.StudentResultsAsync(db, studentId);
}
