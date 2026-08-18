using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>Apex domendagi statik landing sahifasi ("Bepul darsga yozilish" formasi) uchun ommaviy
/// (autentifikatsiyasiz) lid qabul qiluvchi endpoint. LeadsController.Create bilan bir xil mantiq —
/// Source="sayt" bilan, birinchi LeadStage'ga tushadi. Lid obyekti qaytarilmaydi (faqat {ok:true}).</summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/landing-lead")]
public class PublicLandingController(AppDbContext db, TelegramService telegram, AutoMessageService autoMsg) : ControllerBase
{
    public record LandingLeadRequest(string FullName, string Phone, string? Subject, string? Note);

    [HttpPost]
    [HttpPost("/api/public/leads")]
    [EnableRateLimiting("public-lead")]
    public async Task<IActionResult> Create([FromBody] LandingLeadRequest p)
    {
        var fullName = (p.FullName ?? "").Trim();
        if (fullName.Length == 0)
            return BadRequest(new { message = "Ism-familiya kiritilishi shart" });
        if (fullName.Length > 100)
            return BadRequest(new { message = "Ism-familiya juda uzun" });

        var (valid, normalizedPhone, phoneError) = PhoneUtil.Validate(p.Phone);
        if (!valid)
            return BadRequest(new { message = phoneError ?? "Telefon raqami noto'g'ri" });

        var subject = (p.Subject ?? "").Trim();
        if (string.IsNullOrWhiteSpace(subject))
            subject = "General English";
        else if (subject.Length > 100)
            subject = subject.Substring(0, 100);

        var note = (p.Note ?? "").Trim();
        if (note.Length > 500)
            note = note.Substring(0, 500);

        var firstStageId = await db.LeadStages.OrderBy(s => s.Order).Select(s => s.Id).FirstOrDefaultAsync();
        if (string.IsNullOrEmpty(firstStageId))
        {
            var defaultStage = new LeadStage { Title = "Yangi", Color = "blue", Order = 0 };
            db.LeadStages.Add(defaultStage);
            await db.SaveChangesAsync();
            firstStageId = defaultStage.Id;
        }

        // MAVJUD LIDNI TEKSHIRISH (dublikat yaratmaydi, balki hodisa va izoh qo'shadi)
        var existingLead = await LeadIntake.FindByPhoneAsync(db, normalizedPhone);
        Lead lead;
        if (existingLead != null)
        {
            lead = existingLead;
            lead.RepeatCount++;
            lead.LastRepeatAt = Now();
            if (!string.IsNullOrWhiteSpace(note))
            {
                lead.Note = string.IsNullOrWhiteSpace(lead.Note) ? note : $"{lead.Note} | Sayt: {note}";
            }
            if (!string.IsNullOrWhiteSpace(subject))
            {
                lead.InterestSubject = subject;
            }

            db.LeadEvents.Add(new LeadEvent
            {
                LeadId = lead.Id,
                Type = "repeat_intake",
                Text = string.IsNullOrWhiteSpace(note) 
                    ? $"Saytdan qayta ariza keldi ({subject})" 
                    : $"Saytdan qayta ariza keldi ({subject}) — Izoh: {note}",
                ActorName = "Sayt",
                CreatedAt = Now(),
                ToStage = lead.Stage,
            });
        }
        else
        {
            lead = new Lead
            {
                FullName = fullName,
                Phone = normalizedPhone,
                Stage = firstStageId,
                Source = "sayt",
                InterestSubject = subject,
                Note = note,
                CreatedAt = Now(),
            };
            db.Leads.Add(lead);
            db.LeadEvents.Add(new LeadEvent
            {
                LeadId = lead.Id,
                Type = "created",
                Text = string.IsNullOrWhiteSpace(note) 
                    ? $"Lid yaratildi ({lead.FullName})" 
                    : $"Lid yaratildi ({lead.FullName}) — Izoh: {note}",
                ActorName = "Sayt",
                CreatedAt = Now(),
                ToStage = firstStageId,
            });
        }

        await db.SaveChangesAsync();

        try
        {
            await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead, createdBy: string.IsNullOrWhiteSpace(note) ? "Sayt (ochiq forma)" : $"Sayt ({note})");
            await autoMsg.DispatchLeadAsync(db, AutoMessageTriggers.LeadNew, lead);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PublicLandingController] Bildirishnoma xatosi: {ex.Message}");
        }

        return Ok(new { ok = true, id = lead.Id });
    }

    private static string Now() => AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
}
