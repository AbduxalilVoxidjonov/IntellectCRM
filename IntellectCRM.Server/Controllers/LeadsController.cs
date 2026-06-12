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
[AdminPerm("leads")]
[Route("api/admin/leads")]
public class LeadsController(AppDbContext db, AuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Lead>>> GetAll() =>
        await db.Leads.ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Lead>> Create(LeadCreateRequest p)
    {
        var lead = new Lead
        {
            FullName = p.FullName,
            Gender = p.Gender,
            BirthDate = p.BirthDate,
            Phone = p.Phone ?? "",
            FatherFullName = p.FatherFullName ?? "",
            FatherPhone = p.FatherPhone ?? "",
            MotherFullName = p.MotherFullName ?? "",
            MotherPhone = p.MotherPhone ?? "",
            Note = p.Note,
            Stage = p.Stage,
            Source = p.Source ?? "",
            InterestSubject = p.InterestSubject ?? "",
            CreatedAt = Now(),
        };
        db.Leads.Add(lead);
        AddEvent(lead.Id, "created", $"Lid yaratildi ({lead.FullName})");
        await db.SaveChangesAsync();
        return lead;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, LeadUpdateRequest p)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        lead.FullName = p.FullName;
        lead.Gender = p.Gender;
        lead.BirthDate = p.BirthDate;
        lead.Phone = p.Phone ?? "";
        lead.FatherFullName = p.FatherFullName ?? "";
        lead.FatherPhone = p.FatherPhone ?? "";
        lead.MotherFullName = p.MotherFullName ?? "";
        lead.MotherPhone = p.MotherPhone ?? "";
        lead.Note = p.Note;
        if (p.Source is not null) lead.Source = p.Source;
        if (p.InterestSubject is not null) lead.InterestSubject = p.InterestSubject;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Lidni boshqa bosqichga (ustunga) ko'chirish.</summary>
    [HttpPatch("{id}")]
    public async Task<IActionResult> ChangeStage(string id, LeadStageRequest req)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        var stage = await db.LeadStages.FindAsync(req.Stage);
        lead.Stage = req.Stage;
        AddEvent(id, "stage", $"Bosqich: {stage?.Title ?? req.Stage}");
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        db.LeadEvents.RemoveRange(db.LeadEvents.Where(e => e.LeadId == id));
        db.TrialLessons.RemoveRange(db.TrialLessons.Where(t => t.LeadId == id));
        db.Leads.Remove(lead);

        var reason = string.IsNullOrWhiteSpace(reasonId) ? ""
            : (await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "");
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        ArchiveService.Snapshot(db, "lead", lead.Id, lead.FullName, lead.Phone ?? "", lead,
            reason.Length > 0 ? reason : null, actor);
        audit.Record("Lead", id, "delete",
            $"Lid o'chirildi ({lead.FullName})" + (reason.Length > 0 ? $" — sabab: {reason}" : ""));
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Hodisalar tarixi ----------

    [HttpGet("{id}/events")]
    public async Task<ActionResult<IEnumerable<LeadEventDto>>> Events(string id) =>
        await db.LeadEvents.Where(e => e.LeadId == id)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new LeadEventDto(e.Id, e.Type, e.Text, e.ActorName, e.CreatedAt))
            .ToListAsync();

    [HttpPost("{id}/events")]
    public async Task<IActionResult> AddEventEndpoint(string id, AddLeadEventRequest req)
    {
        if (await db.Leads.FindAsync(id) is null) return NotFound();
        AddEvent(id, string.IsNullOrWhiteSpace(req.Type) ? "note" : req.Type, req.Text);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ---------- Sinov darslari ----------

    [HttpGet("{id}/trials")]
    public async Task<ActionResult<IEnumerable<TrialLessonDto>>> Trials(string id) =>
        await (from t in db.TrialLessons
               where t.LeadId == id
               join c in db.Classes on t.GroupId equals c.Id into gj
               from c in gj.DefaultIfEmpty()
               orderby t.ScheduledAt descending
               select new TrialLessonDto(t.Id, t.LeadId, t.GroupId, c != null ? c.Name : "", t.ScheduledAt, t.Result, t.CreatedAt))
              .ToListAsync();

    /// <summary>Lid uchun sinov darsi belgilash (guruh + vaqt).</summary>
    [HttpPost("{id}/trials")]
    public async Task<IActionResult> ScheduleTrial(string id, ScheduleTrialRequest req)
    {
        if (await db.Leads.FindAsync(id) is null) return NotFound();
        var group = await db.Classes.FindAsync(req.GroupId);
        db.TrialLessons.Add(new TrialLesson
        {
            LeadId = id, GroupId = req.GroupId, ScheduledAt = req.ScheduledAt,
            Result = "pending", CreatedAt = Now(),
        });
        AddEvent(id, "trial", $"Sinov darsi belgilandi: {group?.Name ?? req.GroupId} — {req.ScheduledAt}");
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Sinov darsi natijasi: stayed (qoldi) | left (ketdi).</summary>
    [HttpPatch("trials/{trialId}")]
    public async Task<IActionResult> SetTrialResult(string trialId, TrialResultRequest req)
    {
        var trial = await db.TrialLessons.FindAsync(trialId);
        if (trial is null) return NotFound();
        trial.Result = req.Result;
        AddEvent(trial.LeadId, "trial", $"Sinov darsi natijasi: {(req.Result == "stayed" ? "qoldi" : "ketdi")}");
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ---------- Konversiya (lid -> o'quvchi) ----------

    /// <summary>Lidni o'quvchiga aylantirish: yangi Student yaratiladi, lid yopiladi (ConvertedStudentId).
    /// GroupId berilsa o'quvchi shu guruhga (StudentGroup) qo'shiladi.</summary>
    [HttpPost("{id}/convert")]
    public async Task<IActionResult> Convert(string id, ConvertLeadRequest req)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        if (lead.ConvertedStudentId is not null)
            return BadRequest(new { message = "Lid allaqachon o'quvchiga aylantirilgan" });

        var today = AppClock.Today.ToString("yyyy-MM-dd");
        var enrollment = string.IsNullOrWhiteSpace(req.EnrollmentDate) ? today : req.EnrollmentDate!;
        Group? group = string.IsNullOrWhiteSpace(req.GroupId) ? null : await db.Classes.FindAsync(req.GroupId);

        var student = new Student
        {
            FullName = lead.FullName,
            Gender = lead.Gender,
            BirthDate = lead.BirthDate,
            // Student'da bitta ota-ona maydoni bor — otani asosiy qilamiz (bo'lmasa ona).
            ParentFullName = !string.IsNullOrWhiteSpace(lead.FatherFullName) ? lead.FatherFullName : lead.MotherFullName,
            ParentPhone = !string.IsNullOrWhiteSpace(lead.FatherPhone) ? lead.FatherPhone : lead.MotherPhone,
            EnrollmentDate = enrollment,
            ClassName = group?.Name ?? "",
        };
        db.Students.Add(student);

        if (group is not null)
            db.StudentGroups.Add(new StudentGroup
            {
                StudentId = student.Id, GroupId = group.Id, JoinedAt = enrollment, IsActive = true,
            });

        lead.ConvertedStudentId = student.Id;
        AddEvent(id, "convert", $"O'quvchiga aylantirildi ({lead.FullName})" + (group is not null ? $" — guruh: {group.Name}" : ""));
        await db.SaveChangesAsync();
        return Ok(new { studentId = student.Id });
    }

    // ---------- CRM statistikasi ----------

    /// <summary>CRM statistikasi: jami, bosqich/manba bo'yicha, konversiya %, oylik dinamika.</summary>
    [HttpGet("stats")]
    public async Task<ActionResult<CrmStatsDto>> Stats()
    {
        var leads = await db.Leads.ToListAsync();
        var stages = await db.LeadStages.ToListAsync();
        var stageTitle = stages.ToDictionary(s => s.Id, s => s.Title);

        var total = leads.Count;
        var converted = leads.Count(l => l.ConvertedStudentId != null);
        var rate = total == 0 ? 0 : Math.Round(converted * 100.0 / total, 1);

        var byStage = leads.GroupBy(l => l.Stage)
            .Select(g => new CrmStatChartItemDto(stageTitle.GetValueOrDefault(g.Key, "—"), g.Count()))
            .ToList();
        var bySource = leads.GroupBy(l => string.IsNullOrWhiteSpace(l.Source) ? "Noma'lum" : l.Source)
            .Select(g => new CrmStatChartItemDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToList();
        var monthly = leads.Where(l => l.CreatedAt.Length >= 7)
            .GroupBy(l => l.CreatedAt[..7])
            .OrderBy(g => g.Key)
            .Select(g => new CrmMonthlyDto(g.Key, g.Count(), g.Count(l => l.ConvertedStudentId != null)))
            .ToList();

        return new CrmStatsDto(total, converted, rate, byStage, bySource, monthly);
    }

    // ---------- Yordamchilar ----------

    private static string Now() => AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");

    private string Actor() =>
        User.Identity?.Name
        ?? User.FindFirst("name")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
        ?? "Admin";

    private void AddEvent(string leadId, string type, string text) =>
        db.LeadEvents.Add(new LeadEvent
        {
            LeadId = leadId, Type = type, Text = text, ActorName = Actor(), CreatedAt = Now(),
        });
}
