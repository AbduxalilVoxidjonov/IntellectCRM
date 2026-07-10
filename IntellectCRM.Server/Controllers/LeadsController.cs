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
public class LeadsController(AppDbContext db, AuditService audit, TelegramService telegram, AutoMessageService autoMsg) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LeadWithAttendanceDto>>> GetAll()
    {
        var leads = await db.Leads.AsNoTracking().ToListAsync();

        // Ilgari HAR lid uchun GetFirstLessonAttendanceAsync 3 tagacha alohida so'rov qilardi
        // (500 lid = ~1500 so'rov). Endi barcha konvertilgan o'quvchilar uchun davomat holati
        // bir necha TO'PLAMLI so'rovda hisoblanadi (semantikasi AYNAN saqlangan).
        var studentIds = leads
            .Where(l => !string.IsNullOrWhiteSpace(l.ConvertedStudentId))
            .Select(l => l.ConvertedStudentId!)
            .Distinct().ToList();
        var attendanceByStudent = await ComputeFirstLessonAttendanceAsync(studentIds);

        return leads.Select(lead => new LeadWithAttendanceDto(
            lead.Id, lead.FullName, lead.Gender, lead.BirthDate, lead.Phone,
            lead.FatherFullName, lead.FatherPhone, lead.MotherFullName,
            lead.MotherPhone, lead.Note, lead.Stage, lead.Source,
            lead.InterestSubject, lead.CreatedAt, lead.ConvertedStudentId,
            string.IsNullOrWhiteSpace(lead.ConvertedStudentId)
                ? "no-lesson"
                : attendanceByStudent.GetValueOrDefault(lead.ConvertedStudentId, "no-lesson")
        )).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<Lead>> Create(LeadCreateRequest p)
    {
        var lead = new Lead
        {
            FullName = p.FullName,
            Gender = p.Gender,
            BirthDate = p.BirthDate,
            Phone = PhoneUtil.Normalize(p.Phone ?? ""),
            FatherFullName = p.FatherFullName ?? "",
            FatherPhone = PhoneUtil.Normalize(p.FatherPhone ?? ""),
            MotherFullName = p.MotherFullName ?? "",
            MotherPhone = PhoneUtil.Normalize(p.MotherPhone ?? ""),
            Note = p.Note,
            Stage = p.Stage,
            Source = p.Source ?? "",
            InterestSubject = p.InterestSubject ?? "",
            CreatedAt = Now(),
        };
        db.Leads.Add(lead);
        AddEvent(lead.Id, "created", $"Lid yaratildi ({lead.FullName})");
        await db.SaveChangesAsync();
        // Botda ro'yxatdan o'tgan admin/xodimlarga yangi lid xabarnomasi (kim kiritgani bilan).
        await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead, createdBy: Actor());
        // Avto xabar — "Yangi lid kelganda" hodisasiga yoqilgan qoida bo'lsa, lidga avtomatik SMS.
        await autoMsg.DispatchLeadAsync(db, AutoMessageTriggers.LeadNew, lead);
        return lead;
    }

    /// <summary>Lidga BIR MARTALIK daraja-testi havolasini SMS qilib yuboradi (avto-SMS andoza, {link}).
    /// Lid testni o'z ma'lumotini qayta kiritmasdan ishlaydi; natija shu lidga bog'lanadi.</summary>
    [HttpPost("{id}/send-test")]
    public async Task<ActionResult<SendLeadTestResultDto>> SendTest(string id, SendLeadTestRequest req)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound(new { message = "Lid topilmadi" });
        var test = await db.LevelTests.FirstOrDefaultAsync(t => t.Id == req.TestId);
        if (test is null) return NotFound(new { message = "Test topilmadi" });

        var invite = new LevelTestInvite
        {
            TestId = test.Id, LeadId = lead.Id, CreatedAt = Now(),
        };
        db.LevelTestInvites.Add(invite);
        await db.SaveChangesAsync();

        var link = $"{Request.Scheme}://{Request.Host}/test/invite/{invite.Token}";
        var (ok, status, reqId) = await autoMsg.SendLeadTestLinkAsync(db, lead, link);
        invite.SmsStatus = ok ? "sent" : status;
        invite.SmsRequestId = reqId;
        AddEvent(lead.Id, "note", ok ? $"Daraja testi havolasi yuborildi: {test.Title}" : $"Test havolasi SMS xato: {status}");
        await db.SaveChangesAsync();

        return new SendLeadTestResultDto(ok, status, link);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, LeadUpdateRequest p)
    {
        var lead = await db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        lead.FullName = p.FullName;
        lead.Gender = p.Gender;
        lead.BirthDate = p.BirthDate;
        lead.Phone = PhoneUtil.Normalize(p.Phone ?? "");
        lead.FatherFullName = p.FatherFullName ?? "";
        lead.FatherPhone = PhoneUtil.Normalize(p.FatherPhone ?? "");
        lead.MotherFullName = p.MotherFullName ?? "";
        lead.MotherPhone = PhoneUtil.Normalize(p.MotherPhone ?? "");
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
        var trial = new TrialLesson
        {
            LeadId = id, GroupId = req.GroupId, ScheduledAt = req.ScheduledAt,
            Result = "pending", CreatedAt = Now(),
        };
        db.TrialLessons.Add(trial);
        AddEvent(id, "trial", $"Sinov darsi belgilandi: {group?.Name ?? req.GroupId} — {req.ScheduledAt}");
        await db.SaveChangesAsync();
        return Ok(new { ok = true, trialId = trial.Id });
    }

    /// <summary>Lid sinov darsiga yozilganda chiqadigan chek (TO'LOVSIZ ro'yxat varaqasi):
    /// O'quvchi(lid)/Guruh/O'qituvchi/Sana-vaqt. Jami/to'lov turi bo'lmaydi (Total=null → frontend "Jami"ni
    /// ko'rsatmaydi). Chek sozlamalari (maydon tanlovi, sarlavha, footer) moliya cheki bilan bir xil.</summary>
    [HttpGet("trials/{trialId}/receipt")]
    public async Task<ActionResult<ReceiptDto>> TrialReceipt(string trialId)
    {
        var trial = await db.TrialLessons.FindAsync(trialId);
        if (trial is null) return NotFound();
        var lead = await db.Leads.FindAsync(trial.LeadId);
        var meta = await db.CenterMeta.FirstOrDefaultAsync();

        var groupName = "";
        var teacherName = "";
        if (!string.IsNullOrWhiteSpace(trial.GroupId) && await db.Classes.FindAsync(trial.GroupId) is { } grp)
        {
            groupName = grp.Name;
            if (!string.IsNullOrWhiteSpace(grp.TeacherId))
                teacherName = (await db.Teachers.FindAsync(grp.TeacherId))?.FullName ?? "";
        }
        // Sana/vaqt = sinov darsi vaqti ("yyyy-MM-ddTHH:mm" → "yyyy-MM-dd HH:mm").
        var dt = trial.ScheduledAt.Length >= 16 ? trial.ScheduledAt[..16].Replace('T', ' ') : trial.ScheduledAt;
        var responsible = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "";

        return new ReceiptDto(
            FinanceController.ReceiptNumber(trial.Id), dt, lead?.FullName ?? "", teacherName,
            responsible, groupName, "", null, null, // Method/Comment/Total yo'q (to'lovsiz)
            meta?.Name ?? "", meta?.Phone ?? "", meta?.Address ?? "", meta?.LogoUrl ?? "",
            meta?.CheckSettings ?? "", Subtitle: "Sinov darsiga yozildi");
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

        // Sig'im tekshiruvi — ClassesController.AddMember bilan bir xil qoida: Capacity>0 va
        // faol a'zolar soni yetib borgan bo'lsa, guruhga QO'SHILMAYDI (lekin o'quvchi baribir yaratiladi).
        var groupFull = false;
        if (group is not null)
        {
            if (group.Capacity > 0 &&
                await db.StudentGroups.CountAsync(sg => sg.GroupId == group.Id && sg.IsActive) >= group.Capacity)
            {
                groupFull = true;
            }
            else
            {
                db.StudentGroups.Add(new StudentGroup
                {
                    StudentId = student.Id, GroupId = group.Id, JoinedAt = enrollment, IsActive = true,
                });
            }
        }

        // Poyga holati (race condition) tekshiruvi: shu lid ustida parallel yuborilgan boshqa
        // /convert so'rovi bizdan oldin saqlagan bo'lishi mumkin — SaveChangesAsync'dan OLDIN qayta
        // (no-tracking) tekshiramiz va shunday bo'lsa bekor qilamiz (ikkilangan Student yaratmaslik uchun).
        var alreadyConverted = await db.Leads.AsNoTracking()
            .Where(l => l.Id == id)
            .Select(l => l.ConvertedStudentId)
            .FirstOrDefaultAsync();
        if (alreadyConverted is not null)
            return BadRequest(new { message = "Lid allaqachon o'quvchiga aylantirilgan" });

        lead.ConvertedStudentId = student.Id;
        AddEvent(id, "convert", $"O'quvchiga aylantirildi ({lead.FullName})" + (group is not null
            ? (groupFull ? $" — guruh to'lgan, qo'shilmadi: {group.Name}" : $" — guruh: {group.Name}")
            : ""));
        await db.SaveChangesAsync();
        return Ok(new { studentId = student.Id, groupFull });
    }

    // ---------- CRM statistikasi ----------

    /// <summary>CRM statistikasi: jami, bosqich/manba bo'yicha, konversiya %, oylik dinamika.</summary>
    [HttpGet("stats")]
    public async Task<ActionResult<CrmStatsDto>> Stats()
    {
        var leads = await db.Leads.AsNoTracking().ToListAsync();
        var stages = await db.LeadStages.AsNoTracking().ToListAsync();
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

    /// <summary>
    /// Konvertilgan o'quvchilarning birinchi dars davomat holatini TO'PLAMLI hisoblaydi
    /// (avvalgi HAR lid uchun 3 ta so'rov o'rniga jami 4 ta so'rov). Natija: studentId →
    /// "attended" | "absent". Ro'yxatda BO'LMAGAN o'quvchi = "no-lesson" (default).
    /// Semantikasi eski har-lidli mantiq bilan AYNAN bir xil:
    /// 1. O'quvchi mavjud bo'lmasa → "no-lesson"
    /// 2. FAOL (IsActive && Status=="active") guruh(lar)i bo'lmasa → "no-lesson"
    /// 3. Shu guruhlarda o'tilgan (Conducted) birinchi dars (Date, keyin Period) bo'lmasa → "no-lesson"
    /// 4. Shu dars uchun JournalEntry yo'q → "no-lesson"; ReasonId to'la → "absent"; bo'sh → "attended".
    /// </summary>
    private async Task<Dictionary<string, string>> ComputeFirstLessonAttendanceAsync(List<string> studentIds)
    {
        var result = new Dictionary<string, string>();
        if (studentIds.Count == 0) return result;

        // 1) Mavjud o'quvchilar (ConvertedStudentId o'chirilgan o'quvchiga ishora qilishi mumkin).
        var existing = (await db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id)).Select(s => s.Id).ToListAsync()).ToHashSet();

        // 2) Har o'quvchining FAOL (active) guruhlari.
        var sgRows = await db.StudentGroups.AsNoTracking()
            .Where(sg => studentIds.Contains(sg.StudentId) && sg.IsActive && sg.Status == "active")
            .Select(sg => new { sg.StudentId, sg.GroupId })
            .ToListAsync();
        var groupsByStudent = sgRows
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.GroupId).ToHashSet());

        // 3) Shu guruhlardagi o'tilgan (Conducted) darslar.
        var allGroupIds = sgRows.Select(x => x.GroupId).Distinct().ToList();
        var notes = allGroupIds.Count == 0
            ? new List<(string ClassId, string SubjectId, string Date, int Period)>()
            : (await db.LessonNotes.AsNoTracking()
                    .Where(n => allGroupIds.Contains(n.ClassId) && n.Conducted)
                    .Select(n => new { n.ClassId, n.SubjectId, n.Date, n.Period })
                    .ToListAsync())
                .Select(n => (n.ClassId, n.SubjectId, n.Date, n.Period)).ToList();
        var notesByGroup = notes.GroupBy(n => n.ClassId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // 4) Har o'quvchi uchun BIRINCHI dars (Date, keyin Period bo'yicha) — sanalar "yyyy-MM-dd"
        //    (ISO) formatda, shu sabab ordinal solishtirish = xronologik tartib (DB OrderBy bilan bir xil).
        var firstLessons = new Dictionary<string, (string ClassId, string SubjectId, string Date, int Period)>();
        foreach (var sid in existing)
        {
            if (!groupsByStudent.TryGetValue(sid, out var gids) || gids.Count == 0) continue;
            (string ClassId, string SubjectId, string Date, int Period)? first = null;
            foreach (var gid in gids)
            {
                if (!notesByGroup.TryGetValue(gid, out var list)) continue;
                foreach (var n in list)
                {
                    if (first is null
                        || string.CompareOrdinal(n.Date, first.Value.Date) < 0
                        || (n.Date == first.Value.Date && n.Period < first.Value.Period))
                        first = n;
                }
            }
            if (first is not null) firstLessons[sid] = first.Value;
        }
        if (firstLessons.Count == 0) return result;

        // 5) Shu birinchi darslar uchun jurnal yozuvlari (faqat aloqador o'quvchilar bo'yicha).
        var involved = firstLessons.Keys.ToList();
        var journalMap = new Dictionary<(string, string, string, string, int), string?>();
        var jRows = await db.JournalEntries.AsNoTracking()
            .Where(je => involved.Contains(je.StudentId))
            .Select(je => new { je.StudentId, je.ClassId, je.SubjectId, je.Date, je.Period, je.ReasonId })
            .ToListAsync();
        foreach (var je in jRows)
            journalMap[(je.StudentId, je.ClassId, je.SubjectId, je.Date, je.Period)] = je.ReasonId;

        foreach (var (sid, fl) in firstLessons)
        {
            if (journalMap.TryGetValue((sid, fl.ClassId, fl.SubjectId, fl.Date, fl.Period), out var reasonId))
                result[sid] = string.IsNullOrWhiteSpace(reasonId) ? "attended" : "absent";
            // topilmasa result'ga qo'shilmaydi → default "no-lesson".
        }
        return result;
    }

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
