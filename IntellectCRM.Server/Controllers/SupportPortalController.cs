using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using System.Security.Claims;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// SUPPORT o'qituvchi portali (`/api/support`) — alohida rol. Support o'z bo'sh vaqt slotlarini
/// kiritadi (blok per-odam daqiqaga bo'linadi), o'quvchilar bron qiladi; o'z bronlari/o'tilgan
/// darslarini ko'radi va mavzu+izoh yozib yopadi. Support = Teacher record (IsSupport), UserId orqali bog'langan.
/// </summary>
[ApiController]
[Authorize(Roles = "support")]
[Route("api/support")]
public class SupportPortalController(AppDbContext db) : ControllerBase
{
    /// <summary>Tokendagi foydalanuvchi → bog'langan support (Teacher).</summary>
    private async Task<Teacher?> Me()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return uid is null ? null : await db.Teachers.FirstOrDefaultAsync(t => t.UserId == uid);
    }

    /// <summary>Profil (ism/login) — portal sarlavhasi uchun.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<object>> Profile()
    {
        var t = await Me();
        if (t is null) return NotFound();
        var user = t.UserId is null ? null : await db.Users.FindAsync(t.UserId);
        return new { t.Id, t.FullName, Email = user?.Email ?? "", t.PhotoUrl };
    }

    /// <summary>O'z slotlarim (barcha holatlar): bo'sh / bron / o'tilgan.</summary>
    [HttpGet("slots")]
    public async Task<ActionResult<IEnumerable<SupportSlotDto>>> Slots()
    {
        var me = await Me();
        if (me is null) return NotFound();
        return await SupportService.ListAsync(db, me.Id);
    }

    /// <summary>Bo'sh vaqt bloki qo'shish. SlotMinutes>0 → blok har odamga shuncha daqiqalik
    /// slotlarga bo'linadi; RepeatWeeks>0 → shu hafta kuni keyingi N haftaga ham.</summary>
    [HttpPost("slots")]
    public async Task<IActionResult> AddSlot(CreateSupportSlotRequest req)
    {
        var me = await Me();
        if (me is null) return NotFound();
        var (ok, created, error) = await SupportService.AddAsync(db, me.Id, req);
        return ok ? Ok(new { created }) : BadRequest(new { message = error });
    }

    /// <summary>Slotni o'chirish (o'tilgan darsdan tashqari).</summary>
    [HttpDelete("slots/{id}")]
    public async Task<IActionResult> DeleteSlot(string id)
    {
        var me = await Me();
        if (me is null) return NotFound();
        var (ok, error) = await SupportService.DeleteAsync(db, id, me.Id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    /// <summary>Bron qilingan darsni YOPISH: mavzu + izoh.</summary>
    [HttpPost("slots/{id}/complete")]
    public async Task<IActionResult> CompleteSlot(string id, CompleteSupportRequest req)
    {
        var me = await Me();
        if (me is null) return NotFound();
        var (ok, error) = await SupportService.CompleteAsync(db, id, me.Id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
