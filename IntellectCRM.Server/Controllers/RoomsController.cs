using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'quv xonalari (auditoriyalar) — yaratish, tahrirlash, o'chirish (soft delete).
/// Guruh Group.RoomId orqali xonaga bog'lanadi; xona o'chirilsa GroupId SET NULL bo'ladi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("settings")]
[Route("api/admin/rooms")]
public class RoomsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<RoomDto>> GetAll() =>
        (await db.Rooms
            .OrderBy(r => r.Name)
            .ToListAsync())
        .Select(ToDto)
        .ToList();

    [HttpPost]
    public async Task<ActionResult<RoomDto>> Create(CreateRoomRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Xona nomi kerak" });
        if (req.Capacity < 1 || req.Capacity > 1000)
            return BadRequest(new { message = "Sig'im 1–1000 oralig'ida bo'lishi kerak" });

        var room = new Room
        {
            Name     = req.Name.Trim(),
            Capacity = req.Capacity,
            Building = req.Building?.Trim(),
            Location = req.Location?.Trim(),
        };
        db.Rooms.Add(room);
        await db.SaveChangesAsync();
        return ToDto(room);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<RoomDto>> Update(string id, UpdateRoomRequest req)
    {
        var room = await db.Rooms.FindAsync(id);
        if (room is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Xona nomi kerak" });
        if (req.Capacity < 1 || req.Capacity > 1000)
            return BadRequest(new { message = "Sig'im 1–1000 oralig'ida bo'lishi kerak" });

        room.Name     = req.Name.Trim();
        room.Capacity = req.Capacity;
        room.Building = req.Building?.Trim();
        room.Location = req.Location?.Trim();
        room.IsActive = req.IsActive;

        await db.SaveChangesAsync();
        return ToDto(room);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var room = await db.Rooms.FindAsync(id);
        if (room is null) return NotFound();

        // Soft delete — xona ma'lumoti saqlanadi, guruhlarda SET NULL (FK)
        room.IsActive = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static RoomDto ToDto(Room r) =>
        new(r.Id, r.Name, r.Capacity, r.Building, r.Location,
            r.IsActive, r.CreatedAt.ToString("o"));
}
