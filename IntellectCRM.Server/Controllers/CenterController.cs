using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;

namespace IntellectCRM.Server.Controllers;

/// <summary>Maktab nomi — brending uchun (barcha kirgan foydalanuvchilarga ochiq).</summary>
[ApiController]
[Authorize]
[Route("api/school")]
public class CenterController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SchoolNameDto>> Get()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new SchoolNameDto(m?.Name ?? "");
    }
}
