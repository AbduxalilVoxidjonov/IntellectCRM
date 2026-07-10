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
    public record LandingLeadRequest(string FullName, string Phone, string? Subject);

    [HttpPost]
    [EnableRateLimiting("public-lead")]
    public async Task<IActionResult> Create(LandingLeadRequest p)
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
        if (subject.Length > 100)
            return BadRequest(new { message = "Yo'nalish nomi juda uzun" });

        var firstStageId = await db.LeadStages.OrderBy(s => s.Order).Select(s => s.Id).FirstOrDefaultAsync() ?? "";

        var lead = new Lead
        {
            FullName = fullName,
            Phone = normalizedPhone,
            Stage = firstStageId,
            Source = "sayt",
            InterestSubject = subject,
            CreatedAt = Now(),
        };
        db.Leads.Add(lead);
        db.LeadEvents.Add(new LeadEvent
        {
            LeadId = lead.Id, Type = "created", Text = $"Lid yaratildi ({lead.FullName})",
            ActorName = "Sayt", CreatedAt = Now(),
        });
        await db.SaveChangesAsync();

        await LeadNotifier.NotifyNewLeadAsync(db, telegram, lead, createdBy: "Sayt (ochiq forma)");
        await autoMsg.DispatchLeadAsync(db, AutoMessageTriggers.LeadNew, lead);

        return Ok(new { ok = true });
    }

    private static string Now() => AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
}
