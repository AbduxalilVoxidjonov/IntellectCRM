using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Call Center — Asterisk (AMI) orqali chiquvchi qo'ng'iroq va qo'ng'iroqlar jurnali.
/// Oqim: POST originate → AsteriskService (AMI Originate: avval operator kanali, keyin dialplan
/// GSM gateway orqali raqamga teradi) → Call yozuvi "originating". Holat yangilanishi (ringing/
/// answered/completed) — keyingi bosqichda AMI eventlari + SignalR bilan.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("calls")]
[Route("api/admin/calls")]
public class CallsController(AppDbContext db, AsteriskService asterisk) : ControllerBase
{
    private string Uid => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";

    /// <summary>Frontend uchun modul holati: Asterisk sozlanganmi (banner ko'rsatish uchun).</summary>
    [HttpGet("config")]
    public ActionResult<object> Config() => Ok(new
    {
        configured = asterisk.IsConfigured,
        defaultOperatorExtension = asterisk.DefaultOperatorExtension,
    });

    /// <summary>
    /// Chiquvchi qo'ng'iroq. Body: studentId YOKI phoneNumber (dialpad). OperatorExtension
    /// berilmasa Asterisk:DefaultOperatorExtension ishlatiladi. Qo'lda terilgan raqam o'quvchiga
    /// tegishli bo'lsa (telefonlari bo'yicha moslash) — tarix o'sha o'quvchiga bog'lanadi.
    /// </summary>
    [HttpPost("originate")]
    public async Task<ActionResult> Originate(OriginateCallRequest req)
    {
        if (!asterisk.IsConfigured)
            return StatusCode(503, new { message = "Asterisk sozlanmagan — Asterisk:Enabled/Host/Username (env: Asterisk__Host ...) bering" });

        // 1) Raqam va (iloji bo'lsa) o'quvchini aniqlash.
        string phone;
        Student? student = null;

        if (!string.IsNullOrWhiteSpace(req.StudentId))
        {
            student = await db.Students.FindAsync(req.StudentId);
            if (student is null) return NotFound(new { message = "O'quvchi topilmadi" });
            var candidate = new[] { student.Phone, student.ParentPhone, student.FatherPhone, student.MotherPhone }
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
            if (candidate is null)
                return BadRequest(new { message = "O'quvchida telefon raqam kiritilmagan" });
            phone = PhoneUtil.Normalize(candidate);
        }
        else
        {
            var (valid, normalized, error) = PhoneUtil.Validate(req.PhoneNumber);
            if (!valid) return BadRequest(new { message = error ?? "Telefon raqam noto'g'ri" });
            phone = normalized;
            // Qo'lda terilgan raqam bazadagi o'quvchiga tegishlimi? (tarix bog'lash uchun)
            student = await db.Students.FirstOrDefaultAsync(s =>
                s.Phone == phone || s.ParentPhone == phone || s.FatherPhone == phone || s.MotherPhone == phone);
        }

        // 2) Operator ichki (SIP) raqami.
        var ext = string.IsNullOrWhiteSpace(req.OperatorExtension)
            ? asterisk.DefaultOperatorExtension
            : req.OperatorExtension.Trim();
        if (string.IsNullOrWhiteSpace(ext))
            return BadRequest(new { message = "Operator ichki (SIP) raqami berilmagan — operatorExtension yoki Asterisk:DefaultOperatorExtension" });

        // 3) Jurnal yozuvi + Originate.
        var call = new Call
        {
            StudentId = student?.Id,
            OperatorUserId = Uid.Length > 0 ? Uid : null,
            PhoneNumber = phone,
            Direction = "outbound",
            Status = "originating",
        };
        db.Calls.Add(call);
        await db.SaveChangesAsync();

        var (ok, message) = await asterisk.OriginateAsync(phone, ext, call.Id);
        if (!ok)
        {
            call.Status = "failed";
            call.EndedAt = AppClock.Now;
            call.Note = message;
            await db.SaveChangesAsync();
            return StatusCode(502, new { message, callId = call.Id });
        }

        return Ok(new { callId = call.Id, status = call.Status, phoneNumber = phone, studentId = student?.Id });
    }

    /// <summary>Barcha qo'ng'iroqlar (eng oxirgisi tepada) — "Yozuvlar tarixi" bo'limi uchun.</summary>
    [HttpGet]
    public async Task<ActionResult<CallListDto>> List(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = db.Calls.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            var sids = await db.Students
                .Where(x => x.FullName.ToLower().Contains(s))
                .Select(x => x.Id).ToListAsync();
            q = q.Where(c => c.PhoneNumber.Contains(s) || (c.StudentId != null && sids.Contains(c.StudentId)));
        }

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(c => c.StartedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new CallListDto(total, await ToDtosAsync(items));
    }

    /// <summary>Bitta o'quvchining qo'ng'iroqlar tarixi (detalli oynadagi tab).</summary>
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<List<CallDto>>> ByStudent(string studentId)
    {
        var items = await db.Calls.AsNoTracking()
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.StartedAt)
            .Take(200).ToListAsync();
        return await ToDtosAsync(items);
    }

    private async Task<List<CallDto>> ToDtosAsync(List<Call> items)
    {
        var studentIds = items.Where(c => c.StudentId != null).Select(c => c.StudentId!).Distinct().ToList();
        var operatorIds = items.Where(c => c.OperatorUserId != null).Select(c => c.OperatorUserId!).Distinct().ToList();
        var studentNames = await db.Students.Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);
        var operatorNames = await db.Users.Where(u => operatorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        static string Iso(DateTime d) => d.ToString("yyyy-MM-ddTHH:mm:ss");
        return items.Select(c => new CallDto(
            c.Id, c.StudentId,
            c.StudentId != null ? studentNames.GetValueOrDefault(c.StudentId, "") : "",
            c.PhoneNumber, c.Direction, c.Status,
            Iso(c.StartedAt),
            c.AnsweredAt is { } a ? Iso(a) : null,
            c.EndedAt is { } e ? Iso(e) : null,
            c.DurationSeconds,
            c.OperatorUserId != null ? operatorNames.GetValueOrDefault(c.OperatorUserId, "") : "",
            c.RecordingFile.Length > 0,
            c.Note)).ToList();
    }
}
