using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// AVTOMATIK SMS — hodisa (trigger) yuz berganda mos SMS andozasini topib yuboradi.
/// Andoza admin "Sozlamalar → SMS (Eskiz)"da yaratilib, hodisa turi (<see cref="SmsTemplate.Trigger"/>)
/// belgilanadi. Hodisalar:
///   • lead_new     — yangi lid qo'shilganda (lidning telefoniga)
///   • payment      — o'quvchi tuition to'lovi qabul qilinganda (ota-ona telefoniga)
///   • birthday     — o'quvchining tug'ilgan kunida (kunlik scheduler — <see cref="BirthdaySmsService"/>)
///   • test_result  — daraja testi natijasi tayyor bo'lganda (lid/abituriyent telefoniga)
/// Har hodisada Order bo'yicha BIRINCHI mos andoza yuboriladi. Hech qachon throw qilmaydi —
/// asosiy oqimni (lid/to'lov yaratish) buzmaydi (Eskiz sozlanmagan / raqam yo'q / andoza yo'q ⇒ jim).
/// </summary>
public static class AutoSmsService
{
    public const string TriggerLeadNew = "lead_new";
    public const string TriggerPayment = "payment";
    public const string TriggerBirthday = "birthday";
    public const string TriggerTestResult = "test_result";
    public const string TriggerTestLink = "test_link";

    public static string TriggerLabel(string t) => t switch
    {
        TriggerLeadNew => "yangi lid",
        TriggerPayment => "to'lov",
        TriggerBirthday => "tug'ilgan kun",
        TriggerTestResult => "test natijasi",
        TriggerTestLink => "daraja testi havolasi",
        _ => "avto",
    };

    /// <summary>
    /// Lidga BIR MARTALIK daraja-test havolasini SMS qilib yuboradi ("test_link" andoza, {link} tokeni).
    /// Natija (yuborildimi + RequestId) qaytadi — invite holatini saqlash uchun. Andoza/Eskiz/raqam
    /// yo'q bo'lsa Ok=false.
    /// </summary>
    public static async Task<(bool Ok, string Status, string RequestId)> SendTestLinkAsync(
        IAppDbContext db, EskizService eskiz, Lead lead, string link, string? callbackUrl = null, CancellationToken ct = default)
    {
        try
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return (false, "Eskiz sozlanmagan", "");
            var phone = !string.IsNullOrWhiteSpace(lead.Phone) ? lead.Phone
                : !string.IsNullOrWhiteSpace(lead.FatherPhone) ? lead.FatherPhone : lead.MotherPhone;
            if (string.IsNullOrWhiteSpace(phone)) return (false, "Lidda raqam yo'q", "");
            var tpl = await FindTemplateAsync(db, TriggerTestLink, ct);
            if (tpl is null || string.IsNullOrWhiteSpace(tpl.Text))
                return (false, "Andoza yo'q (Sozlamalar → SMS: 'daraja testi havolasi')", "");

            var msg = MessageTokenizer.Lead(tpl.Text, lead, phone, meta?.Name ?? "",
                new Dictionary<string, string> { ["{link}"] = link });
            var batchId = Guid.NewGuid().ToString();
            var r = await eskiz.SendSmsAsync(db, phone, msg, callbackUrl, ct);
            db.SmsLogs.Add(new SmsLog
            {
                BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone), RecipientName = lead.FullName,
                Message = msg, RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
            });
            db.SmsBatches.Add(new SmsBatch
            {
                Id = batchId, Audience = $"Daraja testi havolasi: {lead.FullName}", Message = tpl.Text,
                SenderUserId = "", SenderName = "Avto SMS", CreatedAt = AppClock.Now,
                RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
            });
            await db.SaveChangesAsync(ct);
            return (r.Ok, r.Ok ? "sent" : (r.Error ?? "failed"), r.RequestId ?? "");
        }
        catch (Exception ex)
        {
            return (false, ex.Message, "");
        }
    }

    /// <summary>Hodisa uchun mos avto-andozani topadi (yo'q bo'lsa null).</summary>
    private static Task<SmsTemplate?> FindTemplateAsync(IAppDbContext db, string trigger, CancellationToken ct) =>
        db.SmsTemplates.Where(t => t.Trigger == trigger).OrderBy(t => t.Order).FirstOrDefaultAsync(ct);

    /// <summary>O'quvchiga (ota-ona raqamiga) avto-SMS — to'lov / tug'ilgan kun.</summary>
    public static async Task SendForStudentAsync(
        IAppDbContext db, EskizService eskiz, string trigger, Student s,
        string? callbackUrl = null, IReadOnlyDictionary<string, string>? extra = null, CancellationToken ct = default)
    {
        try
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return;
            var phone = !string.IsNullOrWhiteSpace(s.ParentPhone) ? s.ParentPhone
                : !string.IsNullOrWhiteSpace(s.FatherPhone) ? s.FatherPhone
                : !string.IsNullOrWhiteSpace(s.MotherPhone) ? s.MotherPhone : s.Phone;
            if (string.IsNullOrWhiteSpace(phone)) return;
            var tpl = await FindTemplateAsync(db, trigger, ct);
            if (tpl is null || string.IsNullOrWhiteSpace(tpl.Text)) return;
            var msg = MessageTokenizer.Student(tpl.Text, s, s.ParentFullName, phone, meta?.Name ?? "", extra);
            await SendAndLogAsync(db, eskiz, trigger, phone, s.FullName, tpl.Text, msg, callbackUrl, ct);
        }
        catch { /* avto-SMS asosiy oqimni hech qachon buzmaydi */ }
    }

    /// <summary>Lidga avto-SMS — yangi lid / daraja testi natijasi.</summary>
    public static async Task SendForLeadAsync(
        IAppDbContext db, EskizService eskiz, string trigger, Lead lead,
        string? callbackUrl = null, IReadOnlyDictionary<string, string>? extra = null, CancellationToken ct = default)
    {
        try
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return;
            var phone = !string.IsNullOrWhiteSpace(lead.Phone) ? lead.Phone
                : !string.IsNullOrWhiteSpace(lead.FatherPhone) ? lead.FatherPhone : lead.MotherPhone;
            if (string.IsNullOrWhiteSpace(phone)) return;
            var tpl = await FindTemplateAsync(db, trigger, ct);
            if (tpl is null || string.IsNullOrWhiteSpace(tpl.Text)) return;
            var msg = MessageTokenizer.Lead(tpl.Text, lead, phone, meta?.Name ?? "", extra);
            await SendAndLogAsync(db, eskiz, trigger, phone, lead.FullName, tpl.Text, msg, callbackUrl, ct);
        }
        catch { /* avto-SMS asosiy oqimni hech qachon buzmaydi */ }
    }

    private static async Task SendAndLogAsync(
        IAppDbContext db, EskizService eskiz, string trigger, string phone, string recipientName,
        string templateText, string message, string? callbackUrl, CancellationToken ct)
    {
        var batchId = Guid.NewGuid().ToString();
        var r = await eskiz.SendSmsAsync(db, phone, message, callbackUrl, ct);
        db.SmsLogs.Add(new SmsLog
        {
            BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone), RecipientName = recipientName,
            Message = message, RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
        });
        db.SmsBatches.Add(new SmsBatch
        {
            Id = batchId, Audience = $"Avto ({TriggerLabel(trigger)}): {recipientName}", Message = templateText,
            SenderUserId = "", SenderName = "Avto SMS", CreatedAt = AppClock.Now,
            RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
        });
        await db.SaveChangesAsync(ct);
    }
}
