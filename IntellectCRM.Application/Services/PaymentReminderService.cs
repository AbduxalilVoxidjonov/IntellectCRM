using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Avtomatik to'lov eslatmasi (fon xizmati). Har oyning 1-sanasida BARCHA qarzdorlarga
/// (balansi manfiy o'quvchilar) batafsil eslatma yuboradi; keyin HAR 2 KUNDA (1, 3, 5, ...)
/// hali ham qarzdor bo'lganlarga TAKROR yuboradi (o'quvchi qarzini to'lasa balansi manfiy
/// bo'lmaydi — eslatma to'xtaydi). Yuborish vaqti: ertalab 09:00 (Toshkent, UTC+5).
///
/// Kanal: Telegram (TelegramRegistration chatlari) VA push (DeviceToken — ota-ona akkaunti).
/// Yuborish mantig'i mavjud helperlarni (TelegramService.SendMessageAsync, FcmService.SendAsync)
/// chaqiradi — yangi yuborish kodi yozilmagan.
///
/// "Oxirgi yuborilgan sana"ni alohida saqlamaymiz: eng sodda yo'l — oyning TOQ kunlarida yubor
/// (kun == 1 yoki (kun - 1) % 2 == 0 ⇒ 1, 3, 5, 7, ...). Bu "1-sanada hamma, keyin har 2 kunda
/// to'lamaganlar" talabini aniq beradi. Sikl kuniga BIR marta ishlaydi (oxirgi ishlagan sana
/// xotirada saqlanadi), 09:00 dan keyin uyg'onganda.
/// </summary>
public class PaymentReminderService(
    IServiceProvider services,
    TelegramService telegram,
    FcmService fcm,
    EskizService eskiz,
    ILogger<PaymentReminderService> logger) : BackgroundService
{
    /// <summary>Eslatma yuboriladigan soat (Toshkent vaqti).</summary>
    private const int SendHour = 9;

    /// <summary>Shu sanada (bugun) kunlik tekshiruv allaqachon ishlaganmi — takror yubormaslik uchun.</summary>
    private DateOnly _lastRun = DateOnly.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = AppClock.Now;
                var today = DateOnly.FromDateTime(now);
                // 09:00 dan o'tgan bo'lsa va bugun hali ishlamagan bo'lsak — kunlik tekshiruv.
                if (now.Hour >= SendHour && _lastRun != today)
                {
                    _lastRun = today;
                    await RunDailyAsync(today, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "To'lov eslatmasi siklida xatolik");
            }

            // Har ~1 soatda uyg'onamiz (09:00 ni o'tkazib yubormaslik uchun).
            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    /// <summary>Bugungi kun uchun eslatma yuborish kerakmi (toq kunlar: 1, 3, 5, ...) tekshiradi va yuboradi.</summary>
    private async Task RunDailyAsync(DateOnly today, CancellationToken ct)
    {
        // Eslatma faqat toq kunlarda: 1-sana (hamma qarzdor), keyin har 2 kunda (3, 5, 7, ...) — hali qarzdorlar.
        if (today.Day != 1 && (today.Day - 1) % 2 != 0) return;

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        var rule = await db.AutoMessageRules.FirstOrDefaultAsync(r => r.Trigger == AutoMessageTriggers.PaymentDebt, ct);
        if (rule is not null && !rule.Enabled)
        {
            logger.LogInformation("To'lov eslatmasi o'chirilgan (sozlama) — yuborilmadi.");
            return;
        }
        // Kanallar: qoida bo'lsa uning bayroqlaridan; qoida yo'q bo'lsa eski xulq (push + telegram).
        var sendSms = rule?.SendSms ?? false;
        var sendPush = rule?.SendPush ?? true;
        var sendTelegram = rule?.SendTelegram ?? true;

        // Qarzdorlar: balansi manfiy, arxivlanmagan o'quvchilar.
        var debtors = await db.Students
            .Where(s => !s.IsArchived && s.Balance < 0)
            .ToListAsync(ct);
        if (debtors.Count == 0)
        {
            logger.LogInformation("To'lov eslatmasi: qarzdor yo'q.");
            return;
        }

        var debtorIds = debtors.Select(s => s.Id).ToList();

        // Telegram chatlari (har qarzdor o'quvchiga 0+ chat).
        var regsByStudent = (await db.TelegramRegistrations
                .Where(r => debtorIds.Contains(r.StudentId))
                .ToListAsync(ct))
            .GroupBy(r => r.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.ChatId).Distinct().ToList());

        // Push qurilma tokenlari (ota-ona akkaunti UserId orqali).
        var userIds = debtors.Where(s => s.UserId != null).Select(s => s.UserId!).ToList();
        var tokensByUser = (await db.DeviceTokens
                .Where(d => userIds.Contains(d.UserId))
                .ToListAsync(ct))
            .GroupBy(d => d.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Token).Distinct().ToList());

        var fcmJson = meta?.FcmServiceAccountJson ?? "";
        var telegramReady = sendTelegram && telegram.IsConfigured;
        var pushReady = sendPush && FcmService.IsConfigured(fcmJson);
        var smsReady = sendSms && eskiz.IsConfigured(meta);

        int tgSent = 0, pushSent = 0, smsSent = 0, students = 0;
        var deadTokens = new List<string>();
        foreach (var s in debtors)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var (title, body) = await BuildMessageAsync(db, s, ct);
                if (body.Length == 0) continue;
                students++;

                // Ilova tarixiga (push/telegram bo'lmasa ham ilovada ko'rinadi). Push kanali yoqilganda.
                if (sendPush) NotificationStore.Add(db, s.UserId, title, body, "payment_debt");

                // Telegram.
                if (telegramReady && regsByStudent.TryGetValue(s.Id, out var chats))
                {
                    var tgText = $"💰 To'lov eslatmasi\n\n{body}";
                    foreach (var chatId in chats)
                        if (await telegram.SendMessageAsync(chatId, tgText, ct: ct)) tgSent++;
                }

                // Push (ota-ona akkauntining qurilmalariga).
                if (pushReady && s.UserId != null && tokensByUser.TryGetValue(s.UserId, out var toks))
                {
                    var res = await fcm.SendAsync(fcmJson, toks, title, body, ct);
                    pushSent += res.Sent;
                    deadTokens.AddRange(res.InvalidTokens);
                }

                // SMS (ota-ona telefoniga) — SendSms yoqilgan bo'lsa.
                if (smsReady)
                {
                    var phone = !string.IsNullOrWhiteSpace(s.ParentPhone) ? s.ParentPhone
                        : !string.IsNullOrWhiteSpace(s.FatherPhone) ? s.FatherPhone
                        : !string.IsNullOrWhiteSpace(s.MotherPhone) ? s.MotherPhone : s.Phone;
                    if (!string.IsNullOrWhiteSpace(phone))
                    {
                        var batchId = Guid.NewGuid().ToString();
                        var r = await eskiz.SendSmsAsync(db, phone, body, callbackUrl: null, ct);
                        db.SmsLogs.Add(new SmsLog
                        {
                            BatchId = batchId, PhoneNumber = EskizService.NormalizePhone(phone),
                            RecipientName = s.FullName, Message = body,
                            RequestId = r.RequestId, Status = r.Ok ? r.Status : (r.Error ?? "error"),
                        });
                        db.SmsBatches.Add(new SmsBatch
                        {
                            Id = batchId, Audience = $"Avto (Qarzdorlik eslatmasi): {s.FullName}", Message = body,
                            SenderUserId = "", SenderName = "Avto xabar", CreatedAt = AppClock.Now,
                            RecipientCount = 1, SentCount = r.Ok ? 1 : 0,
                        });
                        if (r.Ok) smsSent++;
                    }
                }
            }
            catch (Exception ex)
            {
                // Bitta o'quvchi xatosi butun siklni to'xtatmasin.
                logger.LogWarning(ex, "To'lov eslatmasi: o'quvchi {Id} uchun xatolik", s.Id);
            }
        }

        // O'lik tokenlarni bazadan tozalaymiz (ilova o'chirilgan / web token bekor qilingan).
        if (deadTokens.Count > 0)
            db.DeviceTokens.RemoveRange(db.DeviceTokens.Where(d => deadTokens.Contains(d.Token)));

        if (students > 0 || deadTokens.Count > 0) await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "To'lov eslatmasi yuborildi: {Students} qarzdor, Telegram {Tg}, push {Push}, SMS {Sms}.",
            students, tgSent, pushSent, smsSent);
    }

    /// <summary>
    /// Bitta o'quvchi uchun batafsil eslatma matnini tuzadi: har faol guruh (kurs) bo'yicha qoldiq qarz
    /// + oxirida "Jami: X so'm". Per-guruh qarz <see cref="StudentGroupLedger"/> orqali (perGroup billing).
    /// Faol/muzlatilgan a'zoliklar hisobga olinadi (trial — to'lov yo'q). A'zoligi yo'q o'quvchida (eski
    /// ClassName modeli) qarz <see cref="StudentLedger"/> umumiy qoldig'idan olinadi.
    /// </summary>
    private static async Task<(string Title, string Body)> BuildMessageAsync(
        IAppDbContext db, Student s, CancellationToken ct)
    {
        var lines = new List<string>();
        decimal total = 0m;

        // Faol/muzlatilgan a'zoliklar (trial — to'lov hisoblanmaydi).
        var memberships = await db.StudentGroups
            .Where(m => m.StudentId == s.Id && m.IsActive && (m.Status == "active" || m.Status == "frozen"))
            .ToListAsync(ct);
        var groupIds = memberships.Select(m => m.GroupId).Distinct().ToList();
        var groups = (await db.Classes.Where(g => groupIds.Contains(g.Id)).ToListAsync(ct))
            .ToDictionary(g => g.Id);

        var hasGroupDebt = false;
        foreach (var m in memberships)
        {
            if (!groups.TryGetValue(m.GroupId, out var g)) continue;
            var ledger = await StudentGroupLedger.BuildAsync(db, s, g, m);
            var owed = ledger.Months.Sum(x => x.Remaining);
            if (owed <= 0) continue;
            hasGroupDebt = true;
            total += owed;
            lines.Add($"• {ledger.CourseName}: {Money(owed)}");
        }

        // A'zoligi (yoki per-guruh qarzi) yo'q — umumiy balans qarzidan foydalanamiz.
        if (!hasGroupDebt)
        {
            total = s.Balance < 0 ? -s.Balance : 0m;
            if (total <= 0) return ("", "");
            var label = string.IsNullOrEmpty(s.ClassName) ? "Oylik to'lov" : s.ClassName;
            lines.Add($"• {label}: {Money(total)}");
        }

        if (total <= 0) return ("", "");

        var title = "To'lov eslatmasi";
        var body =
            $"{s.FullName} bo'yicha qarzdorlik:\n" +
            string.Join("\n", lines) +
            $"\n\nJami: {Money(total)}\nIltimos, to'lovni amalga oshiring.";
        return (title, body);
    }

    /// <summary>So'm formatlash: 1 700 000 so'm (probel bilan ajratilgan).</summary>
    private static string Money(decimal v)
    {
        var nfi = new System.Globalization.NumberFormatInfo { NumberGroupSeparator = " ", NumberDecimalDigits = 0 };
        return v.ToString("#,0", nfi) + " so'm";
    }
}
