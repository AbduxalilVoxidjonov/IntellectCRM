using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Local SMS — CTI (Local Call) agent telefonining SIM-kartasidan ixtiyoriy matnli SMS yuborish.
/// Eskiz'ga muqobil "provider" sifatida MessagesController, AutoMessageService va Local Call
/// operator paneli (<c>CtiController</c>) tomonidan ishlatiladi — bittasi yetkazish (WS/FCM+poll,
/// <see cref="CtiCommandLog"/>) va SmsLog yozuvini markazlashtiradi, shu bilan Tarix bitta joyda qoladi.
/// </summary>
public class CtiSmsService(CtiConnectionManager conn, FcmService fcm)
{
    public record LocalSmsResult(bool Ok, string CommandId, string Status, string? Error);

    /// <summary>
    /// SMS yuboradi va natijani <see cref="SmsLog"/>ga yozadi (Provider="local"). <paramref name="agentId"/>
    /// berilmasa — CenterMeta.LocalSmsDefaultAgentId ishlatiladi (avtomatik/fon xabarlar shu yo'l bilan).
    /// <paramref name="batchId"/> chaqiruvchining O'ZI bir SmsBatch yaratadigan hollarda beriladi
    /// (masalan MessagesController/AutoMessageService — bir nechta oluvchi bitta partiya ostida).
    /// Berilmasa (masalan Local Call sahifasidan ixtiyoriy raqamga ad-hoc yuborish) — bu metod O'ZI
    /// bittalik SmsBatch yaratadi, shu bilan har qanday yuborish umumiy SMS Tarixida ko'rinadi.
    /// </summary>
    public async Task<LocalSmsResult> SendSmsAsync(
        IAppDbContext db, string? agentId, string phone, string message,
        string recipientName = "", string? batchId = null, CancellationToken ct = default)
    {
        var ownsBatch = batchId is null;
        batchId ??= Guid.NewGuid().ToString();

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        var resolvedAgentId = !string.IsNullOrWhiteSpace(agentId) ? agentId : meta?.LocalSmsDefaultAgentId;
        if (string.IsNullOrWhiteSpace(resolvedAgentId))
            return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, false,
                "", "yetkazilmadi", "Standart Local SMS agent tanlanmagan (Sozlamalar → Xabar kanallari → SMS).", null, ct);

        var agent = await db.CtiAgents.FirstOrDefaultAsync(a => a.Id == resolvedAgentId, ct);
        if (agent is null)
            return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, false,
                "", "yetkazilmadi", "Local SMS agent topilmadi.", null, ct);

        var number = NormalizePhone(phone);
        if (number.Length == 0)
            return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, false,
                "", "yetkazilmadi", "Telefon raqami noto'g'ri.", null, ct);

        var commandId = Guid.NewGuid().ToString();
        var cmd = new CtiCommandLog
        {
            AgentId = resolvedAgentId, Action = "send_sms", Payload = $"{number}: {message}", Status = "pending",
        };
        db.CtiCommandLogs.Add(cmd);
        await db.SaveChangesAsync(ct);

        object SmsMsg() => new { action = "send_sms", to = number, text = message, commandId };

        // 1) WS ulangan — darhol yuboramiz.
        if (conn.IsConnected(resolvedAgentId) && await conn.SendAsync(resolvedAgentId, SmsMsg()))
        {
            cmd.Status = "sent";
            await db.SaveChangesAsync(ct);
            return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, true,
                commandId, "yuborildi", null, resolvedAgentId, ct);
        }

        // 2) Oflayn — FCM bilan uyg'otamiz, so'ng WS ulanishini poll qilamiz.
        if (agent.FcmToken.Length > 0)
        {
            var json = meta?.FcmServiceAccountJson ?? "";
            await fcm.SendDataAsync(json, agent.FcmToken, new Dictionary<string, string>
            {
                ["action"] = "send_sms",
                ["commandId"] = commandId,
            }, ct);

            for (var i = 0; i < 12; i++)
            {
                await Task.Delay(500, ct);
                if (conn.IsConnected(resolvedAgentId) && await conn.SendAsync(resolvedAgentId, SmsMsg()))
                {
                    cmd.Status = "sent";
                    await db.SaveChangesAsync(ct);
                    return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, true,
                        commandId, "yuborildi", null, resolvedAgentId, ct);
                }
            }
        }

        cmd.Status = "failed";
        await db.SaveChangesAsync(ct);
        return await FinishAsync(db, phone, message, recipientName, batchId, ownsBatch, false,
            commandId, "yetkazilmadi", "Agent oflayn — yetkazilmadi.", resolvedAgentId, ct);
    }

    /// <summary>SmsLog (har doim) + agar <paramref name="ownsBatch"/> bo'lsa bittalik SmsBatch yozadi.</summary>
    private static async Task<LocalSmsResult> FinishAsync(
        IAppDbContext db, string phone, string message, string recipientName, string batchId,
        bool ownsBatch, bool ok, string commandId, string status, string? error, string? agentId,
        CancellationToken ct)
    {
        db.SmsLogs.Add(new SmsLog
        {
            BatchId = batchId, PhoneNumber = phone, RecipientName = recipientName, Message = message,
            RequestId = commandId, Status = status, Provider = "local", AgentId = agentId,
        });
        if (ownsBatch)
        {
            db.SmsBatches.Add(new SmsBatch
            {
                Id = batchId,
                Audience = recipientName.Length > 0 ? recipientName : phone,
                Message = message, SenderUserId = "", SenderName = "Local Call", CreatedAt = AppClock.Now,
                RecipientCount = 1, SentCount = ok ? 1 : 0, Provider = "local",
            });
        }
        await db.SaveChangesAsync(ct);
        return new LocalSmsResult(ok, commandId, status, error);
    }

    /// <summary>Terilayotgan/SMS oluvchi raqamni xalqaro formatga keltiradi (dial bilan bir xil qoida).</summary>
    private static string NormalizePhone(string raw)
    {
        var digits = new string((raw ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length == 0) return "";
        if (digits.StartsWith("998")) return "+" + digits;
        if (digits.Length == 10 && digits.StartsWith("0")) digits = digits[1..];
        if (digits.Length == 9) return "+998" + digits;
        return "+" + digits;
    }
}
