using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Hubs;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Call Center hodisa monitori (fon xizmati). AMI hodisalarini (<see cref="AsteriskService.CallEvent"/>)
/// navbatga olib, Calls yozuvini yangilaydi va LiveHub "calls" mavzusiga push qiladi
/// (hodisa: <c>callUpdated</c> — {id, status, phoneNumber, studentId, answeredAt, endedAt, durationSeconds}).
///
/// Korrelyatsiya: Originate'da kanalga CRM_CALL_ID o'zgaruvchisi yoziladi → VarSet hodisasi
/// (UniqueId ↔ callId) xotira lug'atiga tushadi → keyingi NewState/Hangup shu UniqueId bo'yicha topiladi.
/// V1 holat modeli — OPERATOR kanali bo'yicha: Ringing → "ringing", Up → "answered" (operator ko'tardi,
/// dialplan o'quvchiga termoqda), Hangup → "completed"/"no_answer"/"busy". O'quvchi kanalini alohida
/// kuzatish (DialBegin/DestUniqueId) — kelajak aniqlashtiruvi.
/// </summary>
public class AsteriskCallMonitorService(
    IServiceProvider services,
    AsteriskService asterisk,
    IHubContext<LiveHub> hub,
    Microsoft.Extensions.Configuration.IConfiguration config,
    ILogger<AsteriskCallMonitorService> logger) : BackgroundService
{
    private readonly Channel<AsteriskService.AmiCallEvent> _queue =
        Channel.CreateBounded<AsteriskService.AmiCallEvent>(new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
        });

    /// <summary>UniqueId → callId (VarSet'dan). Kun almashganda tozalanadi (kichik hajm).</summary>
    private readonly Dictionary<string, string> _uniqueToCall = new();
    private DateOnly _mapDate = DateOnly.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!asterisk.Enabled)
        {
            logger.LogInformation("Asterisk o'chiq (Asterisk:Enabled=false) — Call Center monitori ishga tushmadi");
            return;
        }

        asterisk.CallEvent += e => _queue.Writer.TryWrite(e);

        // Ulanishni ushlab turuvchi halqa (evenlar kelishi uchun doimiy AMI sessiya kerak).
        _ = Task.Run(async () =>
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                asterisk.TryEnsureConnected();
                try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
                catch (TaskCanceledException) { break; }
            }
        }, stoppingToken);

        await foreach (var e in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await HandleAsync(e, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Call Center hodisasini qayta ishlashda xato ({Kind} {UniqueId})", e.Kind, e.UniqueId);
            }
        }
    }

    private async Task HandleAsync(AsteriskService.AmiCallEvent e, CancellationToken ct)
    {
        var today = AppClock.Today;
        if (_mapDate != today)
        {
            _mapDate = today;
            _uniqueToCall.Clear();
        }

        if (e.Kind == "var")
        {
            _uniqueToCall[e.UniqueId] = e.Value;
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var call = await db.Calls.FirstOrDefaultAsync(c => c.Id == e.Value, ct);
            if (call is null) return;
            if (call.AsteriskUniqueId.Length == 0)
            {
                call.AsteriskUniqueId = e.UniqueId;
                await db.SaveChangesAsync(ct);
            }
            return;
        }

        if (!_uniqueToCall.TryGetValue(e.UniqueId, out var callId)) return; // bizniki emas

        using var scope2 = services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<IAppDbContext>();
        var c2 = await db2.Calls.FirstOrDefaultAsync(c => c.Id == callId, ct);
        if (c2 is null) return;
        // Terminal holatdan keyin kelgan hodisalar (masalan ikkinchi Hangup) e'tiborsiz.
        if (c2.Status is "completed" or "no_answer" or "busy" or "failed") return;

        if (e.Kind == "state")
        {
            if (e.Value.Equals("Ringing", StringComparison.OrdinalIgnoreCase) && c2.Status == "originating")
                c2.Status = "ringing";
            else if (e.Value.Equals("Up", StringComparison.OrdinalIgnoreCase) && c2.AnsweredAt is null)
            {
                c2.Status = "answered";
                c2.AnsweredAt = AppClock.Now;
            }
            else return; // qiziqtirmaydigan holat — DB/push shart emas
        }
        else if (e.Kind == "hangup")
        {
            c2.EndedAt = AppClock.Now;
            if (c2.AnsweredAt is { } a)
            {
                c2.Status = "completed";
                c2.DurationSeconds = Math.Max(0, (int)(c2.EndedAt.Value - a).TotalSeconds);
            }
            else
            {
                // Q.850 sabab kodi: 17 = band; qolganlari javobsiz deb qabul qilinadi.
                c2.Status = e.Value == "17" ? "busy" : "no_answer";
            }
            TryAttachRecording(c2);
            _uniqueToCall.Remove(e.UniqueId);
        }

        await db2.SaveChangesAsync(ct);

        await hub.Clients.Group(LiveHub.Group("calls")).SendAsync("callUpdated", new
        {
            id = c2.Id,
            status = c2.Status,
            phoneNumber = c2.PhoneNumber,
            studentId = c2.StudentId,
            answeredAt = c2.AnsweredAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
            endedAt = c2.EndedAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
            durationSeconds = c2.DurationSeconds,
            hasRecording = c2.RecordingFile.Length > 0,
        }, ct);
    }

    /// <summary>
    /// Yozuv faylini biriktirish: dialplan MixMonitor faylni <c>{RecordingsPath}/{callId}.wav</c>
    /// nomlashi kutiladi (masalan: <c>MixMonitor(${CRM_CALL_ID}.wav)</c>). Papka CRM serverga
    /// mount/sync qilingan bo'lsa fayl topiladi; bo'lmasa RecordingFile bo'sh qoladi.
    /// </summary>
    private void TryAttachRecording(Call call)
    {
        var dir = config["Asterisk:RecordingsPath"] ?? "";
        if (dir.Length == 0) return;
        foreach (var ext in new[] { "wav", "mp3", "ogg", "gsm", "WAV" })
        {
            var name = $"{call.Id}.{ext}";
            if (File.Exists(Path.Combine(dir, name)))
            {
                call.RecordingFile = name;
                return;
            }
        }
    }
}
