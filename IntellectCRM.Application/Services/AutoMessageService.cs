using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// YAGONA avto-xabar dispatcheri (singleton). Hodisa (trigger) yuz berganda shu hodisaga yoqilgan
/// <see cref="AutoMessageRule"/> qoidalarni topadi va har qoidada YOQILGAN kanallar (SMS / Push / Telegram)
/// bo'yicha shablonni render qilib yuboradi. Eski <c>AutoSmsService</c> (faqat SMS) + 3 ta eslatma
/// fon-xizmati (faqat push/telegram) o'rniga bitta markaz.
///
/// HECH QACHON tashqariga exception chiqarmaydi — asosiy oqim (to'lov/lid/davomat) buzilmaydi
/// (kanal xatosi loglanadi, davom etadi).
/// </summary>
public class AutoMessageService(
    EskizService eskiz,
    FcmService fcm,
    TelegramService telegram,
    ILogger<AutoMessageService> logger)
{
    /// <summary>O'quvchi (ota-ona) uchun avto-xabar — SMS + Push + Telegram (qoidada yoqilganiga qarab).</summary>
    public async Task DispatchStudentAsync(
        IAppDbContext db, string trigger, Student s,
        Dictionary<string, string>? extraTokens = null, CancellationToken ct = default)
    {
        try
        {
            var rules = await RulesAsync(db, trigger, ct);
            if (rules.Count == 0) return;

            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            var centerName = meta?.Name ?? "";
            var fcmJson = meta?.FcmServiceAccountJson ?? "";
            // O'quvchining asosiy guruhi (ClassName bo'yicha) — dars jadvali tokenlari uchun.
            var group = string.IsNullOrWhiteSpace(s.ClassName) ? null
                : await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName, ct);

            var deadTokens = new List<string>();
            var dirty = false;

            foreach (var rule in rules)
            {
                try
                {
                    var audienceStudent = rule.Audience == "students";
                    var audienceTeachers = rule.Audience == "teachers";

                    // O'qituvchi auditoriyasi: MATN o'quvchi haqida (Student tokenizer — o'zgarmaydi), lekin
                    // YETKAZISH guruh o'qituvchisiga bo'ladi. Guruh/o'qituvchi bo'lmasa — bu qoidani o'tkazib yubor.
                    Teacher? teacher = null;
                    if (audienceTeachers)
                    {
                        if (group?.TeacherId is null) continue;
                        teacher = await db.Teachers.FindAsync(new object?[] { group.TeacherId }, ct);
                        if (teacher is null) continue;
                    }

                    // Telefon: render ({telefon} tokeni) + o'quvchi/ota-ona auditoriyasi SMS manzili.
                    // O'quvchi auditoriyasi — o'z raqami birinchi; aks holda ota-ona birinchi.
                    var phone = audienceStudent
                        ? Coalesce(s.Phone, s.ParentPhone, s.FatherPhone, s.MotherPhone)
                        : Coalesce(s.ParentPhone, s.FatherPhone, s.MotherPhone, s.Phone);

                    var withExtra = MessageTokenizer.ApplyExtra(rule.Template, extraTokens);
                    var msg = MessageTokenizer.Student(withExtra, s, s.ParentFullName, phone, centerName, extra: null, group: group);
                    var title = Title(rule, trigger);
                    if (string.IsNullOrWhiteSpace(msg)) continue;

                    // Yetkazish manzili auditoriya bo'yicha (matn bir xil — faqat manzil o'zgaradi).
                    var smsPhone     = audienceTeachers ? teacher!.Phone    : phone;
                    var smsRecipient = audienceTeachers ? teacher!.FullName : s.FullName;
                    var pushUserId   = audienceTeachers ? teacher!.UserId   : s.UserId;

                    // SMS.
                    if (rule.SendSms && !string.IsNullOrWhiteSpace(smsPhone) && eskiz.IsConfigured(meta))
                        dirty |= await SendSmsAsync(db, trigger, smsPhone!, smsRecipient, rule.Template, msg, ct);

                    // Push (ilova akkaunti) + ichki bildirishnoma tarixi.
                    if (rule.SendPush && !string.IsNullOrWhiteSpace(pushUserId))
                    {
                        NotificationStore.Add(db, pushUserId!, title, msg, trigger);
                        dirty = true;
                        if (FcmService.IsConfigured(fcmJson))
                        {
                            var tokens = await db.DeviceTokens.Where(d => d.UserId == pushUserId)
                                .Select(d => d.Token).Distinct().ToListAsync(ct);
                            if (tokens.Count > 0)
                            {
                                var res = await fcm.SendAsync(fcmJson, tokens, title, msg, ct);
                                deadTokens.AddRange(res.InvalidTokens);
                            }
                        }
                    }

                    // Telegram (o'qituvchi auditoriyasida — o'qituvchi chatlari; aks holda o'quvchi chatlari).
                    if (rule.SendTelegram && telegram.IsConfigured)
                    {
                        var teacherId = teacher?.Id;
                        var chats = audienceTeachers
                            ? await db.TelegramRegistrations.Where(r => r.TeacherId == teacherId)
                                .Select(r => r.ChatId).Distinct().ToListAsync(ct)
                            : await db.TelegramRegistrations.Where(r => r.StudentId == s.Id)
                                .Select(r => r.ChatId).Distinct().ToListAsync(ct);
                        foreach (var chatId in chats)
                            await telegram.SendMessageAsync(chatId, $"🔔 {title}\n\n{msg}", ct: ct);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Avto-xabar ({Trigger}) o'quvchi {Id} qoida {Rule} — xatolik", trigger, s.Id, rule.Id);
                }
            }

            if (deadTokens.Count > 0)
            {
                db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => deadTokens.Contains(d.Token)));
                dirty = true;
            }
            if (dirty) await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Avto-xabar ({Trigger}) o'quvchi {Id} — umumiy xatolik", trigger, s.Id);
        }
    }

    /// <summary>Lid uchun avto-xabar — FAQAT SMS (lidda ilova/telegram yo'q).</summary>
    public async Task DispatchLeadAsync(
        IAppDbContext db, string trigger, Lead lead,
        Dictionary<string, string>? extraTokens = null,
        Group? group = null, string? trialAt = null, CancellationToken ct = default)
    {
        try
        {
            var rules = await RulesAsync(db, trigger, ct);
            if (rules.Count == 0) return;

            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return;
            var centerName = meta?.Name ?? "";
            var phone = Coalesce(lead.Phone, lead.FatherPhone, lead.MotherPhone);
            if (string.IsNullOrWhiteSpace(phone)) return;

            var dirty = false;
            foreach (var rule in rules)
            {
                if (!rule.SendSms) continue;
                try
                {
                    var withExtra = MessageTokenizer.ApplyExtra(rule.Template, extraTokens);
                    var msg = MessageTokenizer.Lead(withExtra, lead, phone, centerName, extra: null, group: group, trialAt: trialAt);
                    if (string.IsNullOrWhiteSpace(msg)) continue;
                    dirty |= await SendSmsAsync(db, trigger, phone!, lead.FullName, rule.Template, msg, ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Avto-xabar ({Trigger}) lid {Id} qoida {Rule} — xatolik", trigger, lead.Id, rule.Id);
                }
            }
            if (dirty) await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Avto-xabar ({Trigger}) lid {Id} — umumiy xatolik", trigger, lead.Id);
        }
    }

    /// <summary>O'qituvchi uchun avto-xabar — SMS + Push + Telegram (qoidada yoqilganiga qarab).</summary>
    public async Task DispatchTeacherAsync(
        IAppDbContext db, string trigger, Teacher t,
        Dictionary<string, string>? extraTokens = null,
        Group? group = null, CancellationToken ct = default)
    {
        try
        {
            var rules = await RulesAsync(db, trigger, ct);
            if (rules.Count == 0) return;

            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            var centerName = meta?.Name ?? "";
            var fcmJson = meta?.FcmServiceAccountJson ?? "";

            var deadTokens = new List<string>();
            var dirty = false;

            foreach (var rule in rules)
            {
                try
                {
                    var withExtra = MessageTokenizer.ApplyExtra(rule.Template, extraTokens);
                    var msg = MessageTokenizer.Teacher(withExtra, t, centerName, extra: null, group: group);
                    var title = Title(rule, trigger);
                    if (string.IsNullOrWhiteSpace(msg)) continue;

                    if (rule.SendSms && !string.IsNullOrWhiteSpace(t.Phone) && eskiz.IsConfigured(meta))
                        dirty |= await SendSmsAsync(db, trigger, t.Phone, t.FullName, rule.Template, msg, ct);

                    if (rule.SendPush && !string.IsNullOrWhiteSpace(t.UserId))
                    {
                        NotificationStore.Add(db, t.UserId, title, msg, trigger);
                        dirty = true;
                        if (FcmService.IsConfigured(fcmJson))
                        {
                            var tokens = await db.DeviceTokens.Where(d => d.UserId == t.UserId)
                                .Select(d => d.Token).Distinct().ToListAsync(ct);
                            if (tokens.Count > 0)
                            {
                                var res = await fcm.SendAsync(fcmJson, tokens, title, msg, ct);
                                deadTokens.AddRange(res.InvalidTokens);
                            }
                        }
                    }

                    if (rule.SendTelegram && telegram.IsConfigured)
                    {
                        var chats = await db.TelegramRegistrations.Where(r => r.TeacherId == t.Id)
                            .Select(r => r.ChatId).Distinct().ToListAsync(ct);
                        foreach (var chatId in chats)
                            await telegram.SendMessageAsync(chatId, $"🔔 {title}\n\n{msg}", ct: ct);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Avto-xabar ({Trigger}) o'qituvchi {Id} qoida {Rule} — xatolik", trigger, t.Id, rule.Id);
                }
            }

            if (deadTokens.Count > 0)
            {
                db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => deadTokens.Contains(d.Token)));
                dirty = true;
            }
            if (dirty) await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Avto-xabar ({Trigger}) o'qituvchi {Id} — umumiy xatolik", trigger, t.Id);
        }
    }

    /// <summary>O'quvchi darsga kelmaganda (attendance_absent) ota-onaga xabar. {sana}=dars sanasi (dd.MM.yyyy),
    /// {guruh}=guruh nomi, {sabab}=davomat sababi. Jurnal (SetEntry) yoki ommaviy davomat muvaffaqiyatidan keyin chaqiriladi.</summary>
    public Task DispatchAttendanceAbsentAsync(
        IAppDbContext db, Student s, string groupName, string reasonName, string dateIso, CancellationToken ct = default)
    {
        var sana = dateIso.Length >= 10 ? $"{dateIso[8..10]}.{dateIso[5..7]}.{dateIso[..4]}" : dateIso;
        return DispatchStudentAsync(db, AutoMessageTriggers.AttendanceAbsent, s, new Dictionary<string, string>
        {
            ["{sana}"] = sana,
            ["{guruh}"] = groupName,
            ["{sabab}"] = reasonName,
        }, ct);
    }

    /// <summary>Yangi yaratilgan oylik hisoblar (monthly_charge) uchun ota-onaga xabar. (o'quvchi, oy)
    /// bo'yicha yig'iladi — bitta o'quvchiga bir oyda BITTA xabar (guruhlar summasi). {oy}=oy nomi,
    /// {summa}=shu oy hisobi, {qarzdorlik}=joriy balans (dispatcher Student tokenizeridan). Idempotent:
    /// faqat YANGI yozilgan hisoblar keladi (AccrueMonth mavjudlarni tashlab ketadi).</summary>
    public async Task DispatchMonthlyChargesAsync(
        IAppDbContext db, IReadOnlyCollection<(string StudentId, string Month, decimal Amount)> charges,
        CancellationToken ct = default)
    {
        try
        {
            if (charges.Count == 0) return;
            var hasRule = await db.AutoMessageRules.AnyAsync(
                r => r.Enabled && r.Trigger == AutoMessageTriggers.MonthlyCharge, ct);
            if (!hasRule) return;

            foreach (var g in charges.GroupBy(c => (c.StudentId, c.Month)))
            {
                var s = await db.Students.FindAsync(new object?[] { g.Key.StudentId }, ct);
                if (s is null || s.IsArchived) continue;
                var summa = g.Sum(x => x.Amount);
                var monthName = g.Key.Month.Length >= 7 && int.TryParse(g.Key.Month.Substring(5, 2), out var mm)
                    ? MessageTokenizer.MonthNameUz(mm) : "";
                await DispatchStudentAsync(db, AutoMessageTriggers.MonthlyCharge, s, new Dictionary<string, string>
                {
                    ["{summa}"] = MessageTokenizer.MoneyPlain(summa),
                    ["{oy}"] = monthName,
                }, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Avto-xabar (monthly_charge) — umumiy xatolik");
        }
    }

    /// <summary>Lidga BIR MARTALIK daraja-test havolasini SMS qilib yuboradi (test_link hodisasi, {link}).
    /// Interaktiv amal (admin "Test yuborish") — natijani (yuborildimi + status + RequestId) qaytaradi,
    /// invite holatini saqlash uchun. Rule yo'q/o'chirilgan / Eskiz sozlanmagan / raqam yo'q ⇒ Ok=false.</summary>
    public async Task<(bool Ok, string Status, string RequestId)> SendLeadTestLinkAsync(
        IAppDbContext db, Lead lead, string link, CancellationToken ct = default)
    {
        try
        {
            var rule = (await RulesAsync(db, AutoMessageTriggers.TestLink, ct)).FirstOrDefault(r => r.SendSms);
            if (rule is null) return (false, "Avto-xabar qoidasi yo'q (test_link, SMS)", "");
            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            if (!eskiz.IsConfigured(meta)) return (false, "Eskiz sozlanmagan", "");
            var phone = Coalesce(lead.Phone, lead.FatherPhone, lead.MotherPhone);
            if (string.IsNullOrWhiteSpace(phone)) return (false, "Lidda raqam yo'q", "");

            var withExtra = MessageTokenizer.ApplyExtra(rule.Template, new Dictionary<string, string> { ["{link}"] = link });
            var msg = MessageTokenizer.Lead(withExtra, lead, phone, meta?.Name ?? "");
            var batchId = Guid.NewGuid().ToString();
            var r = await eskiz.SendSmsAsync(db, phone!, msg, callbackUrl: null, ct);
            db.SmsLogs.Add(new SmsLog
            {
                BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone!), RecipientName = lead.FullName,
                Message = msg, RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
            });
            db.SmsBatches.Add(new SmsBatch
            {
                Id = batchId, Audience = $"Daraja testi havolasi: {lead.FullName}", Message = rule.Template,
                SenderUserId = "", SenderName = "Avto xabar", CreatedAt = AppClock.Now,
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

    // ---------- Yordamchilar ----------

    private static Task<List<AutoMessageRule>> RulesAsync(IAppDbContext db, string trigger, CancellationToken ct) =>
        db.AutoMessageRules.Where(r => r.Enabled && r.Trigger == trigger).ToListAsync(ct);

    private static string Title(AutoMessageRule rule, string trigger) =>
        !string.IsNullOrWhiteSpace(rule.Name) ? rule.Name
        : (AutoMessageTriggers.Get(trigger)?.Label ?? "Xabar");

    private static string? Coalesce(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    /// <summary>Bitta raqamga SMS yuboradi va jurnalga (SmsLog + SmsBatch) yozadi — mavjud AutoSmsService
    /// uslubi. SaveChanges CHAQIRUVCHIDA (dirty flag orqali). Qaytaradi: log yozildimi.</summary>
    private async Task<bool> SendSmsAsync(
        IAppDbContext db, string trigger, string phone, string recipientName,
        string templateText, string message, CancellationToken ct)
    {
        var batchId = Guid.NewGuid().ToString();
        var r = await eskiz.SendSmsAsync(db, phone, message, callbackUrl: null, ct);
        var label = AutoMessageTriggers.Get(trigger)?.Label ?? "Avto";
        db.SmsLogs.Add(new SmsLog
        {
            BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone), RecipientName = recipientName,
            Message = message, RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
        });
        db.SmsBatches.Add(new SmsBatch
        {
            Id = batchId, Audience = $"Avto ({label}): {recipientName}", Message = templateText,
            SenderUserId = "", SenderName = "Avto xabar", CreatedAt = AppClock.Now,
            RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
        });
        return true;
    }
}
