using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Auth;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Xodimlar — o'qituvchi BO'LMAGAN ishchilar (kassir, administrator, ...). Har biriga admin
/// paneliga kiruvchi tizim akkaunti (role="staff") generatsiya qilinadi. Qaysi bo'limlarni
/// ko'rishi <see cref="AppUser.Permissions"/> bilan boshqariladi — uni FAQAT superadmin
/// ("Xodimlar va rollar" bo'limi / <see cref="SetPermissions"/>) o'zgartiradi.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("staff")]
[Route("api/admin/staff")]
public class StaffController(AppDbContext db) : ControllerBase
{
    private const int MinPasswordLength = 8;
    private const string WeakPasswordMessage = "Parol kamida 8 belgidan iborat bo'lsin";


    [HttpGet]
    public async Task<ActionResult<IEnumerable<StaffDto>>> GetAll() =>
        (await db.Users.Where(u => u.Role == Roles.Staff).OrderBy(u => u.FullName).ToListAsync())
            .Select(ToDto).ToList();

    /// <summary>Barcha xodim roli shablonlari — yangi xodim qo'shishda tanlash uchun.</summary>
    [HttpGet("role-templates")]
    public async Task<ActionResult<IEnumerable<StaffRoleTemplateDto>>> GetRoleTemplates() =>
        (await db.StaffRoleTemplates.ToListAsync())
            .Select(t => new StaffRoleTemplateDto(t.Id, t.Code, t.Name, t.Description, t.DefaultPermissions))
            .ToList();

    [HttpPost]
    public async Task<ActionResult<StaffDto>> Create(CreateStaffWithTemplateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName)) return BadRequest(new { message = "F.I.SH kerak" });
        var user = AccountFactory.CreateAccountFor(db, Roles.Staff, req.FullName.Trim());
        user.Position = (req.Position ?? "").Trim();
        user.Phone = PhoneUtil.Normalize(req.Phone ?? "");

        // Role template tanlansa — default ruxsatlari qo'shiladi
        var permissions = new List<string>();
        if (!string.IsNullOrWhiteSpace(req.TemplateCode))
        {
            var template = await db.StaffRoleTemplates
                .FirstOrDefaultAsync(t => t.Code == req.TemplateCode.Trim());
            if (template is not null)
            {
                permissions.AddRange(template.DefaultPermissions);
            }
        }
        // Qo'shimcha ruxsatlari qo'shiladi
        if (req.ExtraPermissions?.Count > 0)
        {
            foreach (var perm in req.ExtraPermissions)
                if (!string.IsNullOrWhiteSpace(perm) && !permissions.Contains(perm))
                    permissions.Add(perm);
        }
        user.Permissions = permissions;

        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (req.NewPassword.Trim().Length < MinPasswordLength)
                return BadRequest(new { message = WeakPasswordMessage });
            user.SetInitialPassword(req.NewPassword.Trim());
        }
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StaffDto>> Update(string id, CreateStaffWithTemplateRequest req)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.Role != Roles.Staff) return NotFound();
        user.FullName = req.FullName.Trim();
        user.Position = (req.Position ?? "").Trim();
        user.Phone = PhoneUtil.Normalize(req.Phone ?? "");
        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (req.NewPassword.Trim().Length < MinPasswordLength)
                return BadRequest(new { message = WeakPasswordMessage });
            user.SetInitialPassword(req.NewPassword.Trim());
        }
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.Role != Roles.Staff) return NotFound();
        var reason = string.IsNullOrWhiteSpace(reasonId) ? "" : (await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "");
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        ArchiveService.Snapshot(db, "staff", user.Id, user.FullName, user.Email ?? "", user, reason.Length > 0 ? reason : null, actor);
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Xodim akkaunti logini. Parol xavfsizlik uchun saqlanmaydi — bo'sh qaytadi
    /// (ko'rsatish kerak bo'lsa <see cref="ResetPassword"/> orqali yangisini yarating).</summary>
    [HttpGet("{id}/credentials")]
    public async Task<ActionResult<CredentialsDto>> Credentials(string id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.Role != Roles.Staff) return NotFound();
        return new CredentialsDto(user.Email, user.InitialPassword ?? "", user.Role);
    }

    /// <summary>Xodimga yangi tasodifiy parol generatsiya qiladi va uni BIR MARTA qaytaradi
    /// (DB'da faqat hash saqlanadi).</summary>
    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<CredentialsDto>> ResetPassword(string id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.Role != Roles.Staff) return NotFound();
        var pwd = AccountFactory.GeneratePassword();
        user.SetInitialPassword(pwd);
        await db.SaveChangesAsync();
        return new CredentialsDto(user.Email, pwd, user.Role);
    }

    /// <summary>Xodimning admin bo'lim ruxsatlari (Rollar) — FAQAT superadmin.</summary>
    [HttpPut("{id}/permissions")]
    [Authorize(Roles = "superadmin")]
    public async Task<ActionResult<StaffDto>> SetPermissions(string id, SetStaffPermissionsRequest req)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.Role != Roles.Staff) return NotFound();
        user.Permissions = req.Permissions ?? new();
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    private static StaffDto ToDto(AppUser u) =>
        new(u.Id, u.FullName, u.Position, u.Email, u.Permissions, u.Phone);
}
