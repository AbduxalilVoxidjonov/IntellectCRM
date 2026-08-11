using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Instagram modulining FON XIZMATI — uchta vazifa:
/// <list type="number">
///   <item><b>Navbat:</b> har 2 soniyada <c>pending</c> hodisalarni (10 tagacha)
///     <see cref="InstagramPipeline"/> ga beradi. Webhook controlleri faqat yozib 200 qaytaradi
///     (Meta 5 soniya kutadi), haqiqiy ish shu yerda bajariladi.</item>
///   <item><b>Token:</b> kuniga bir marta — muddatiga 15 kundan kam qolgan tokenni yangilaydi
///     (60 kunlik token amalda 45-kunda yangilanadi). Muvaffaqiyatsiz bo'lsa Telegram signali.</item>
///   <item><b>Tozalash:</b> kuniga bir marta — 30 kundan eski <c>done</c>/<c>skipped</c>
///     hodisalar o'chiriladi (jadval cheksiz o'smasin).</item>
/// </list>
///
/// <para><b>⚠️ <c>CenterMeta.InstagramEnabled == false</c> bo'lsa xizmat UMUMAN ishlamaydi</b> —
/// navbat ham qayta ishlanmaydi, token ham yangilanmaydi, ya'ni HECH QANDAY tashqi so'rov ketmaydi.
/// Webhook baribir qabul qilinaveradi: modul yoqilganda tarix joyida turadi.</para>
///
/// <para>DI: <c>builder.Services.AddHostedService&lt;InstagramWorkerService&gt;();</c></para>
/// </summary>
public class InstagramWorkerService(
    IServiceProvider services,
    ILogger<InstagramWorkerService> logger) : BackgroundService
{
    private DateOnly _lastDaily = DateOnly.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Instagram fon siklida xatolik"); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
        if (meta is null || !meta.InstagramEnabled) return;   // modul o'chiq — hech narsa qilinmaydi

        await ProcessQueueAsync(scope.ServiceProvider, db, ct);

        // Kunlik vazifalar (idempotentlik `CenterAiSchedulerService` bilan bir xil naqshda).
        var today = AppClock.Today;
        if (_lastDaily == today) return;
        _lastDaily = today;

        var telegram = scope.ServiceProvider.GetRequiredService<TelegramService>();
        try { await RefreshTokensAsync(scope.ServiceProvider, db, meta, telegram, ct); }
        catch (Exception ex) { logger.LogError(ex, "Instagram tokenini yangilashda xatolik"); }
        try { await CleanupAsync(db, ct); }
        catch (Exception ex) { logger.LogError(ex, "Instagram navbatini tozalashda xatolik"); }
    }

    /* ═════════════════════════ 1) Navbat ═════════════════════════ */

    private async Task ProcessQueueAsync(IServiceProvider sp, IAppDbContext db, CancellationToken ct)
    {
        var pending = await db.IgWebhookEvents
            .Where(e => e.Status == IgConst.EvPending)
            .OrderBy(e => e.ReceivedAt)
            .Take(IgConst.QueueBatch)
            .ToListAsync(ct);
        if (pending.Count == 0) return;

        // Uch marta urinilgani — `failed`. Cheksiz sikl bo'lmasin, xato esa diagnostikada qolsin.
        var ready = new List<string>();
        var changed = false;
        foreach (var e in pending)
        {
            if (e.Attempts >= IgConst.MaxAttempts)
            {
                e.Status = IgConst.EvFailed;
                e.ProcessedAt = AppClock.Iso();
                if (e.Error.Length == 0) e.Error = $"{IgConst.MaxAttempts} marta urinildi — muvaffaqiyatsiz.";
                changed = true;
                continue;
            }
            ready.Add(e.Id);
        }
        if (changed) await db.SaveChangesAsync(ct);
        if (ready.Count == 0) return;

        var pipeline = sp.GetRequiredService<InstagramPipeline>();
        foreach (var id in ready)
        {
            if (ct.IsCancellationRequested) return;
            // Pipeline O'Z scope'ida ishlaydi va o'zi holatni yozadi — bu yerda faqat id uzatiladi.
            await pipeline.ProcessAsync(id, ct);
        }
    }

    /* ═════════════════════════ 2) Token ═════════════════════════ */

    private async Task RefreshTokensAsync(
        IServiceProvider sp, IAppDbContext db, CenterMeta meta, TelegramService telegram, CancellationToken ct)
    {
        var accounts = await db.IgAccounts.Where(a => a.IsActive && a.AccessToken != "").ToListAsync(ct);
        if (accounts.Count == 0) return;

        var api = sp.GetRequiredService<InstagramApi>();
        var now = AppClock.Now;

        foreach (var acc in accounts)
        {
            // Muddat noma'lum bo'lsa ham yangilaymiz: "bilmaymiz" holati tokenning jimgina
            // o'lishiga olib kelmasin.
            var known = InstagramContract.TryIso(acc.TokenExpiresAt, out var expires);
            if (known && (expires - now).TotalDays > IgConst.TokenRefreshBeforeDays) continue;

            var (ok, token, expiresIn, err) = await api.RefreshTokenAsync(acc.AccessToken, ct);
            if (ok)
            {
                acc.AccessToken = token;
                acc.TokenRefreshedAt = AppClock.Iso();
                acc.TokenExpiresAt = now.AddSeconds(expiresIn > 0 ? expiresIn : 60 * 24 * 3600)
                    .ToString("yyyy-MM-ddTHH:mm:ss");
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Instagram tokeni yangilandi (@{User})", acc.Username);
            }
            else
            {
                logger.LogWarning("Instagram tokenini yangilab bo'lmadi (@{User}): {Err}", acc.Username, err);
                await InstagramPipeline.NotifyAdminsAsync(db, telegram, meta,
                    $"🔑 Instagram: tokenni yangilab bo'lmadi (@{acc.Username}). {err}\n" +
                    "Marketing → Sozlamalar bo'limidan akkauntni QAYTA ULANG.", ct);
            }
        }
    }

    /* ═════════════════════════ 3) Tozalash ═════════════════════════ */

    private async Task CleanupAsync(IAppDbContext db, CancellationToken ct)
    {
        var cutoff = AppClock.Now.AddDays(-IgConst.EventRetentionDays).ToString("yyyy-MM-ddTHH:mm:ss");
        var old = await db.IgWebhookEvents
            .Where(e => (e.Status == IgConst.EvDone || e.Status == IgConst.EvSkipped)
                        && e.ReceivedAt.CompareTo(cutoff) < 0)
            .Take(1000)   // bir kunda 1000 tadan — katta jadvalda ham xotira shishmasin
            .ToListAsync(ct);
        if (old.Count == 0) return;

        db.IgWebhookEvents.RemoveRange(old);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Instagram navbatidan {Count} ta eski hodisa tozalandi", old.Count);
    }
}
