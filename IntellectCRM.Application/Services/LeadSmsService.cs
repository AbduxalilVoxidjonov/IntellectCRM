using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Yangi lid tushganda AVTO SMS yuborish — admin "Sozlamalar → SMS (Eskiz)"da andozani "Avto SMS"
/// deb belgilasa, shu andoza lidning telefon raqamiga avtomatik yuboriladi. Avto andoza yo'q /
/// Eskiz sozlanmagan / lidda raqam yo'q bo'lsa — jim o'tadi (lid yaratishni hech qachon buzmaydi).
/// </summary>
public static class LeadSmsService
{
    public static async Task AutoSendAsync(
        IAppDbContext db, EskizService eskiz, Lead lead, string? callbackUrl = null, CancellationToken ct = default)
    {
        try
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return;

            var phone = !string.IsNullOrWhiteSpace(lead.Phone) ? lead.Phone
                : !string.IsNullOrWhiteSpace(lead.FatherPhone) ? lead.FatherPhone : lead.MotherPhone;
            if (string.IsNullOrWhiteSpace(phone)) return;

            var tpl = await db.SmsTemplates.Where(t => t.IsAuto).OrderBy(t => t.Order).FirstOrDefaultAsync(ct);
            if (tpl is null || string.IsNullOrWhiteSpace(tpl.Text)) return;

            var msg = MessageTokenizer.Lead(tpl.Text, lead, phone, meta?.Name ?? "");
            var batchId = Guid.NewGuid().ToString();
            var r = await eskiz.SendSmsAsync(db, phone, msg, callbackUrl, ct);
            db.SmsLogs.Add(new SmsLog
            {
                BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone), RecipientName = lead.FullName,
                Message = msg, RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
            });
            db.SmsBatches.Add(new SmsBatch
            {
                Id = batchId, Audience = $"Avto (lid): {lead.FullName}", Message = tpl.Text,
                SenderUserId = "", SenderName = "Avto SMS", CreatedAt = AppClock.Now,
                RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
            });
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            // Avto SMS lid yaratishni hech qachon buzmasligi kerak — jim yutamiz.
        }
    }

}
