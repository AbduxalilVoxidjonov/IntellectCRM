using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Instagram modulining ASOSIY OQIMI: navbatdagi bitta <see cref="IgWebhookEvent"/> ni to'liq
/// qayta ishlaydi (parse → suhbat → xabar → qoida/AI → javob → lid → signal).
///
/// <para><b>HAR BOSQICH ALOHIDA <c>try/catch</c>:</b> yordamchi tizim yiqilsa ham asosiy vazifa
/// (mijozga javob berish va yozib qo'yish) bajariladi. Telegram xatosi esa umuman JIM yutiladi.</para>
///
/// <para><b>Modul o'chiq bo'lsa hech qanday tashqi so'rov ketmaydi:</b> kiruvchi xabar bazaga
/// yoziladi (tarix yo'qolmasin), lekin AI ham, Graph API ham chaqirilmaydi.</para>
///
/// <para><b>Cheksiz halqadan himoya — 3 qavat:</b> (1) o'z izohimiz parserda tashlanadi;
/// (2) echo xabar javob berish uchun ISHLATILMAYDI (faqat operator pauzasini yoqadi);
/// (3) bot o'z javobiga javob bermaydi — echo bizning oxirgi chiquvchi xabarimiz bilan
/// solishtiriladi.</para>
///
/// <para>DI: <c>builder.Services.AddSingleton&lt;InstagramPipeline&gt;();</c> — ichkarida
/// har chaqiruvda o'z <c>scope</c>i olinadi.</para>
/// </summary>
public sealed class InstagramPipeline(IServiceProvider services, ILogger<InstagramPipeline> logger)
{
    /// <summary>Bitta navbat yozuvini qayta ishlaydi va uning <c>Status</c>ini yangilaydi.</summary>
    public async Task ProcessAsync(string eventId, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<IAppDbContext>();

        var ev = await db.IgWebhookEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct);
        if (ev is null || ev.Status != IgConst.EvPending) return;

        ev.Attempts += 1;
        try
        {
            var api = sp.GetRequiredService<InstagramApi>();
            var telegram = sp.GetRequiredService<TelegramService>();
            var config = sp.GetRequiredService<IConfiguration>();

            var meta = await db.CenterMeta.FirstOrDefaultAsync(ct);
            var account = await db.IgAccounts
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.ConnectedAt)
                .FirstOrDefaultAsync(ct);

            var incoming = InstagramEventParser.Parse(ev.RawJson, account?.IgUserId ?? "");
            if (incoming.Count == 0)
            {
                // Qo'llab-quvvatlanmaydigan maydon (`mentions`, `live_comments`), reaksiya/o'qildi
                // hodisasi yoki O'ZIMIZNING izohimiz. Jimgina yo'qolmasin — diagnostikada ko'rinadi.
                ev.Status = IgConst.EvSkipped;
                ev.Error = "Qayta ishlanadigan hodisa topilmadi (qo'llab-quvvatlanmaydigan tur yoki o'z yozuvimiz).";
                ev.ProcessedAt = AppClock.Iso();
                await db.SaveChangesAsync(ct);
                return;
            }

            var problems = new List<string>();
            foreach (var inc in incoming)
            {
                try
                {
                    await HandleOneAsync(db, api, telegram, config, meta, account, inc, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Instagram hodisasini qayta ishlashda xatolik ({Key})", inc.EventKey);
                    problems.Add(ex.Message);
                }
            }

            ev.Status = IgConst.EvDone;
            ev.Error = problems.Count == 0 ? "" : InstagramContract.Trim(string.Join(" | ", problems), 500);
            ev.ProcessedAt = AppClock.Iso();
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Instagram navbat yozuvi qayta ishlanmadi ({Id})", eventId);
            ev.Status = ev.Attempts >= IgConst.MaxAttempts ? IgConst.EvFailed : IgConst.EvPending;
            ev.Error = InstagramContract.Trim(ex.Message, 500);
            ev.ProcessedAt = AppClock.Iso();
            try { await db.SaveChangesAsync(ct); }
            catch (Exception saveEx) { logger.LogError(saveEx, "Instagram navbat holatini saqlab bo'lmadi"); }
        }
    }

    /* ═════════════════════════ Bitta hodisa ═════════════════════════ */

    private async Task HandleOneAsync(
        IAppDbContext db, InstagramApi api, TelegramService telegram, IConfiguration config,
        CenterMeta? meta, IgAccount? account, IgIncomingEvent inc, CancellationToken ct)
    {
        var now = AppClock.Now;
        var nowIso = AppClock.Iso();

        // ── 0) HODISA DARAJASIDAGI DEDUP (navbat kalitidan MUSTAQIL) ──
        if (await AlreadyHandledAsync(db, inc, ct))
        {
            logger.LogInformation(
                "Instagram: hodisa allaqachon qayta ishlangan — o'tkazib yuborildi ({Key})", inc.EventKey);
            return;
        }

        var conv = await db.IgConversations.FirstOrDefaultAsync(c => c.IgUserId == inc.SenderId, ct);

        // ── ECHO: javob uchun EMAS, faqat operator pauzasi uchun ──
        if (inc.IsEcho)
        {
            await HandleEchoAsync(db, conv, inc, now, nowIso, ct);
            return;
        }

        if (conv is null)
        {
            conv = new IgConversation
            {
                IgUserId = inc.SenderId,
                Username = inc.Username,
                Status = IgConst.StatusBot,
                CreatedAt = nowIso,
            };
            db.IgConversations.Add(conv);
        }
        else if (conv.Username.Length == 0 && inc.Username.Length > 0)
        {
            conv.Username = inc.Username;   // DM'da username kelmaydi, izohda keladi
        }

        var channel = inc.Kind == IgConst.KindComment ? IgConst.ChannelComment : IgConst.ChannelDm;

        // ── 1) Kiruvchi xabar HAR DOIM yoziladi (javob berilmasa ham tarix qoladi) ──
        db.IgMessages.Add(new IgMessage
        {
            ConversationId = conv.Id,
            Direction = IgConst.DirIn,
            Channel = channel,
            Text = inc.Text,
            MediaId = inc.MediaId,
            CommentId = inc.CommentId,
            IgMessageId = inc.IgMessageId,
            ActorName = inc.Username.Length > 0 ? "@" + inc.Username : "Mijoz",
            CreatedAt = nowIso,
        });
        conv.LastInboundAt = nowIso;
        conv.LastMessageText = InstagramContract.Trim(inc.Text, 300);
        conv.MessageCount += 1;
        conv.Unread = true;

        // ── 2) MATNSIZ xabar (rasm/stiker/ovoz) — jimgina yo'qolmaydi ──
        if (string.IsNullOrWhiteSpace(inc.Text))
        {
            Escalate(conv, "Matnsiz xabar keldi (rasm/stiker/ovozli xabar) — AI javob bera olmaydi");
            conv.LastMessageText = "[matnsiz xabar]";
            await db.SaveChangesAsync(ct);
            await NotifyAdminsAsync(db, telegram, meta, $"📎 Instagram: @{conv.Username} matnsiz xabar yubordi — operator ko'rsin.", ct);
            return;
        }

        // ── 3) DARVOZALAR: shu yerdan keyin tashqi so'rov ketishi mumkin ──
        if (meta is null || !meta.InstagramEnabled) { await db.SaveChangesAsync(ct); return; }
        if (channel == IgConst.ChannelComment && !meta.InstagramAutoReplyComments) { await db.SaveChangesAsync(ct); return; }
        if (channel == IgConst.ChannelDm && !meta.InstagramAutoReplyDm) { await db.SaveChangesAsync(ct); return; }
        if (!InstagramContract.BotMayReply(conv, now)) { await db.SaveChangesAsync(ct); return; }

        if (account is null || string.IsNullOrWhiteSpace(account.AccessToken))
        {
            Escalate(conv, "Instagram akkaunt ulanmagan yoki token yo'q — javob yuborilmadi");
            await db.SaveChangesAsync(ct);
            await NotifyAdminsAsync(db, telegram, meta, "⚠️ Instagram: akkaunt ulanmagan — mijozga javob yuborilmadi.", ct);
            return;
        }

        // ── 4) KUNLIK LIMIT (halqa/hujum himoyasi) ──
        var today = now.ToString("yyyy-MM-dd");
        var limit = Math.Max(1, meta.InstagramDailyReplyLimit);
        var sentToday = await db.IgMessages
            .CountAsync(m => m.Direction == IgConst.DirOut && m.CreatedAt.StartsWith(today), ct);
        if (sentToday >= limit)
        {
            Escalate(conv, $"Kunlik javob chegarasi tugadi ({limit}) — javob yuborilmadi");
            await db.SaveChangesAsync(ct);
            await NotifyAdminsAsync(db, telegram, meta, $"🚦 Instagram: kunlik javob chegarasi ({limit}) tugadi.", ct);
            return;
        }

        // ── 5) KALIT SO'Z QOIDASI (AI'dan oldin: tez, arzon, aniq) ──
        var reply = "";
        var actor = "";
        var isAi = false;
        IgAgentOutput? output = null;

        var rules = await db.IgAutoRules.Where(r => r.IsActive).OrderBy(r => r.Order).ToListAsync(ct);
        var matched = rules.FirstOrDefault(r => InstagramContract.RuleMatches(r, channel, inc.Text));
        if (matched is not null)
        {
            matched.MatchCount += 1;
            reply = matched.ReplyText;
            actor = matched.Title.Length > 0 ? $"Qoida: {matched.Title}" : IgConst.ActorRule;
        }

        // ── 6) AI (qoida topilmasa yoki qoida AI'ni to'xtatmasa) ──
        if (matched is null || !matched.StopAi)
        {
            var caption = "";
            if (channel == IgConst.ChannelComment && inc.MediaId.Length > 0)
            {
                try
                {
                    var media = await api.GetMediaAsync(inc.MediaId, account.AccessToken, ct);
                    if (media.Ok) caption = media.Caption;
                }
                catch (Exception ex) { logger.LogWarning(ex, "Instagram post matnini olib bo'lmadi"); }
            }

            var history = await db.IgMessages.AsNoTracking()
                .Where(m => m.ConversationId == conv.Id)
                .OrderByDescending(m => m.CreatedAt)
                .Take(IgConst.DmHistoryLimit)
                .ToListAsync(ct);
            history.Reverse();

            var (aiOk, aiOut, aiErr) = await InstagramAgentService.AskAsync(
                db, config, channel, conv.Username, caption, inc.Text, history, ct);

            if (aiOk && aiOut is not null)
            {
                output = aiOut;
                reply = aiOut.Reply;
                isAi = true;
                actor = IgConst.ActorAi;
            }
            else if (matched is null)
            {
                // ⚠️ AI ishlamadi va tayyor qoida ham yo'q — JONLI JAVOB YUBORILMAYDI.
                Escalate(conv, InstagramContract.Trim($"AI javob bera olmadi: {aiErr}", 200));
                await db.SaveChangesAsync(ct);
                await NotifyAdminsAsync(db, telegram, meta,
                    $"🤖 Instagram: AI javob bera olmadi (@{conv.Username}). Sabab: {aiErr}", ct);
                return;
            }
        }

        if (string.IsNullOrWhiteSpace(reply)) { await db.SaveChangesAsync(ct); return; }
        reply = InstagramContract.Trim(reply, IgConst.MaxReplyLength);

        // ── 7) TABIIY KECHIKISH (bir zumda kelgan javob spamga o'xshaydi) ──
        var delay = Math.Clamp(meta.InstagramReplyDelaySeconds, 0, IgConst.MaxReplyDelaySeconds);
        if (delay > 0)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(delay), ct); }
            catch (TaskCanceledException) { }
        }

        // ── 8) YUBORISH ──
        var sendError = "";
        var alert = "";
        if (channel == IgConst.ChannelComment)
        {
            var res = await api.ReplyToCommentAsync(inc.CommentId, reply, account.AccessToken, ct);
            sendError = res.Ok ? "" : res.Error;
            AddOutbound(db, conv, IgConst.ChannelComment, reply, actor, isAi, output, inc.CommentId, nowIso, sendError);

            // Yopiq javob (private reply) — yoqilgan bo'lsa va shu izohga HALI yuborilmagan bo'lsa.
            if (res.Ok && meta.InstagramPrivateReplyEnabled && inc.CommentId.Length > 0)
            {
                var already = await db.IgMessages.AnyAsync(
                    m => m.CommentId == inc.CommentId && m.Channel == IgConst.ChannelPrivateReply, ct);
                if (!already)
                {
                    var pr = await api.SendPrivateReplyAsync(inc.CommentId, reply, account.AccessToken, ct);
                    AddOutbound(db, conv, IgConst.ChannelPrivateReply, reply, actor, isAi, output,
                        inc.CommentId, AppClock.Iso(), pr.Ok ? "" : pr.Error);
                }
            }
        }
        else
        {
            // ⚠️ 24 SOATLIK OYNA — yuborishdan OLDIN (NUR'da bu tekshiruv umuman yo'q edi).
            if (!InstagramContract.DmWindowOpen(conv.LastInboundAt, now))
            {
                Escalate(conv, "24 soatlik javob oynasi yopiq — DM yuborib bo'lmadi, operator boshqa yo'l bilan bog'lansin");
                await db.SaveChangesAsync(ct);
                await NotifyAdminsAsync(db, telegram, meta,
                    $"⏰ Instagram: @{conv.Username} bilan 24 soatlik oyna yopiq — javob yuborilmadi.", ct);
                return;
            }

            var res = await api.SendDmAsync(account.IgUserId, conv.IgUserId, reply, account.AccessToken, ct);
            sendError = res.Ok ? "" : res.Error;
            AddOutbound(db, conv, IgConst.ChannelDm, reply, actor, isAi, output, "", nowIso, sendError);
        }

        if (sendError.Length > 0)
        {
            Escalate(conv, InstagramContract.Trim($"Javob yuborilmadi: {sendError}", 200));
            alert = $"❌ Instagram: @{conv.Username} ga javob yuborilmadi. {sendError}";
        }
        else
        {
            conv.LastOutboundAt = nowIso;
            conv.LastMessageText = InstagramContract.Trim(reply, 300);
        }

        // ── 9) LID (faqat qiziqish belgisi bo'lsa — salom-alik CRM'ni ifloslantirmaydi) ──
        if (output is not null)
        {
            conv.Language = output.Language;
            conv.Intent = output.Intent;
            conv.LeadScore = Math.Max(conv.LeadScore, InstagramContract.ClampScore(output.LeadScore));

            if (InstagramContract.ShouldCreateLead(output))
            {
                try
                {
                    var source = string.IsNullOrWhiteSpace(meta.InstagramLeadSource) ? "Instagram" : meta.InstagramLeadSource;
                    var (leadId, isNew) = await InstagramLeadBridge.UpsertAsync(db, conv, output, source, ct);
                    logger.LogInformation("Instagram lid {State} ({LeadId})", isNew ? "yaratildi" : "yangilandi", leadId);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Instagram suhbatidan lid yaratib bo'lmadi ({Conv})", conv.Id);
                    Escalate(conv, "Lid yaratib bo'lmadi — operator qo'lda kiritsin");
                }
            }

            if (output.EscalateToHuman)
                Escalate(conv, "Mijoz operator bilan gaplashmoqchi (yoki AI javobni topa olmadi)");
            else if (InstagramContract.IsHot(output))
                Escalate(conv, $"Qaynoq lid — qiziqish bali {InstagramContract.ClampScore(output.LeadScore)}");
        }

        await db.SaveChangesAsync(ct);

        // ── 10) TELEGRAM SIGNALI (xatosi JIM yutiladi) ──
        if (alert.Length == 0 && output is not null && (output.EscalateToHuman || InstagramContract.IsHot(output)))
            alert = BuildHotAlert(conv, output);
        if (alert.Length > 0)
            await NotifyAdminsAsync(db, telegram, meta, alert, ct);
    }

    /* ═════════════════════════ Hodisa darajasidagi dedup ═════════════════════════ */

    /// <summary>
    /// Shu AYNAN hodisa (izoh yoki DM) allaqachon qayta ishlanganmi.
    ///
    /// <para><b>Nega navbat kaliti YETMAYDI:</b> <see cref="IgWebhookEvent.EventKey"/> bitta POST
    /// BODY'ga tegishli va u ichidagi hodisa kalitlarini <c>|</c> bilan birlashtiradi. Meta bir
    /// necha hodisani bitta bodyda ham, alohida ham yuborishi mumkin — A va B birga kelib kalit
    /// <c>A|B</c> bo'lsa, keyin faqat A qayta yuborilganda kalit <c>A</c> bo'ladi va unikal indeks
    /// buni TAKROR deb bilmaydi. Natijada A ikkinchi marta qayta ishlanib mijozga IKKI javob
    /// ketardi (Meta muvaffaqiyatsiz yetkazishni 36 soat qayta yuboradi — bu nazariy emas,
    /// kutiladigan holat).</para>
    ///
    /// <para>Shuning uchun haqiqat manbai — <b>yozilgan xabarlar</b>: Meta bergan barqaror
    /// identifikator (<c>mid</c> / <c>comment_id</c>) bilan qator bor bo'lsa, hodisa qayta
    /// ishlangan. Izohda <c>Direction == in</c> sharti SHART: chiquvchi javob qatorida ham
    /// <c>CommentId</c> saqlanadi (biz JAVOB BERGAN izohning id'si), ya'ni filtrsiz o'z javobimiz
    /// kiruvchi izohni "takror" deb ko'rsatib qo'yardi.</para>
    ///
    /// <para>⚠️ FAIL-OPEN (IG-SPEC §5.5): tekshiruvning o'zi yiqilsa hodisa BARIBIR qayta
    /// ishlanadi — bitta buzilgan so'rov butun oqimni to'xtatib qo'ymasin. Halqadan himoyaning
    /// qolgan qavatlari (o'zimizni tanish, kunlik chegara) joyida turadi.</para>
    /// </summary>
    private async Task<bool> AlreadyHandledAsync(IAppDbContext db, IgIncomingEvent inc, CancellationToken ct)
    {
        try
        {
            if (inc.IgMessageId.Length > 0)
                return await db.IgMessages.AnyAsync(m => m.IgMessageId == inc.IgMessageId, ct);

            if (inc.CommentId.Length > 0)
                return await db.IgMessages.AnyAsync(
                    m => m.CommentId == inc.CommentId && m.Direction == IgConst.DirIn, ct);

            // Meta identifikator bermagan holat: kalit hash'dan qurilgan va navbatdagi unikal
            // indeks aynan shu payloadning takrorini allaqachon ushlaydi.
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Instagram: takrorlik tekshiruvi bajarilmadi — hodisa qayta ishlanaveradi");
            return false;
        }
    }

    /* ═════════════════════════ Echo → operator pauzasi ═════════════════════════ */

    /// <summary>
    /// Akkauntimizdan chiqqan xabar webhook'ga qaytdi. Ikki manba bor:
    /// <list type="bullet">
    ///   <item><b>Botning o'z javobi</b> — e'tibor berilmaydi (aks holda bot o'ziga javob yozib
    ///     cheksiz halqaga tushardi);</item>
    ///   <item><b>Operator telefondan qo'lda yozgani</b> — bot o'sha suhbatda vaqtincha jim
    ///     bo'ladi, aks holda mijoz bir vaqtda "ikki odam" bilan gaplashardi.</item>
    /// </list>
    /// Ajratish BAZA orqali: shu matnli chiquvchi xabar oxirgi daqiqalarda yozilgan bo'lsa — bizniki.
    /// (NUR'dagi xotiradagi "barmoq izi" restartda yo'qolardi.)
    /// </summary>
    private async Task HandleEchoAsync(
        IAppDbContext db, IgConversation? conv, IgIncomingEvent inc, DateTime now, string nowIso, CancellationToken ct)
    {
        if (conv is null) return;   // bizdan boshlangan suhbat bo'lishi mumkin emas (mijoz avval yozadi)

        var since = now.AddMinutes(-IgConst.EchoOwnReplyMinutes).ToString("yyyy-MM-ddTHH:mm:ss");
        var ours = await db.IgMessages.AnyAsync(
            m => m.ConversationId == conv.Id
                 && m.Direction == IgConst.DirOut
                 && m.Text == inc.Text
                 && m.CreatedAt.CompareTo(since) >= 0, ct);
        if (ours) return;

        conv.OperatorPausedUntil = now.AddMinutes(IgConst.OperatorPauseMinutes).ToString("yyyy-MM-ddTHH:mm:ss");
        conv.LastOutboundAt = nowIso;
        conv.MessageCount += 1;
        if (!string.IsNullOrWhiteSpace(inc.Text))
            conv.LastMessageText = InstagramContract.Trim(inc.Text, 300);

        db.IgMessages.Add(new IgMessage
        {
            ConversationId = conv.Id,
            Direction = IgConst.DirOut,
            Channel = IgConst.ChannelDm,
            Text = inc.Text,
            IgMessageId = inc.IgMessageId,
            ActorName = IgConst.ActorOperatorIg,
            IsAi = false,
            CreatedAt = nowIso,
        });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Instagram: operator qo'lda javob berdi — bot {Min} daqiqaga pauzada (@{User})",
            IgConst.OperatorPauseMinutes, conv.Username);
    }

    /* ═════════════════════════ Yordamchilar ═════════════════════════ */

    private static void AddOutbound(
        IAppDbContext db, IgConversation conv, string channel, string text, string actor, bool isAi,
        IgAgentOutput? output, string commentId, string nowIso, string error)
    {
        db.IgMessages.Add(new IgMessage
        {
            ConversationId = conv.Id,
            Direction = IgConst.DirOut,
            Channel = channel,
            Text = text,
            CommentId = commentId,
            ActorName = actor.Length > 0 ? actor : IgConst.ActorAi,
            IsAi = isAi,
            AiIntent = output?.Intent ?? "",
            AiScore = output is null ? 0 : InstagramContract.ClampScore(output.LeadScore),
            Error = error,
            CreatedAt = nowIso,
        });
    }

    /// <summary>Suhbatni "operator kerak" holatiga qo'yadi (sabab bilan) — inbox'da qizil chip.</summary>
    private static void Escalate(IgConversation conv, string reason)
    {
        conv.NeedsOperator = true;
        conv.NeedsOperatorReason = reason;
        conv.Unread = true;
    }

    private static string BuildHotAlert(IgConversation conv, IgAgentOutput o)
    {
        var lines = new List<string>
        {
            "🔥 Instagram: qaynoq lid!",
            $"👤 @{conv.Username}",
        };
        if (o.LeadName.Length > 0) lines.Add($"🧑 {o.LeadName}");
        if (o.LeadContact.Length > 0) lines.Add($"📞 {o.LeadContact}");
        if (o.LeadProductInterest.Length > 0) lines.Add($"📚 Qiziqish: {o.LeadProductInterest}");
        lines.Add($"⭐ Ball: {InstagramContract.ClampScore(o.LeadScore)}");
        if (o.LeadSummary.Length > 0) lines.Add($"📝 {o.LeadSummary}");
        if (o.EscalateToHuman) lines.Add("⚠️ Operator so'raldi");
        return string.Join("\n", lines);
    }

    /// <summary>
    /// Admin/superadminlarga Telegram xabari (mavjud bot orqali — yangi bot ochilmaydi).
    /// ⚠️ Xato JIM yutiladi: xabarnoma asosiy vazifani HECH QACHON buzmaydi
    /// (<c>LeadNotifier</c> / <c>BookSalesService.NotifyAdminsAsync</c> bilan bir xil siyosat).
    /// </summary>
    public static async Task NotifyAdminsAsync(
        IAppDbContext db, TelegramService telegram, CenterMeta? meta, string text, CancellationToken ct)
    {
        try
        {
            // ⚠️ MASTER DARVOZA: modul o'chiq bo'lsa bu yerdan ham tashqariga hech narsa ketmaydi.
            // (Matnsiz xabar signali `InstagramEnabled` tekshiruvidan OLDIN turadi — darvoza shu
            // yerda bo'lmasa o'chirilgan modul baribir Telegram'ga yozib turardi.)
            if (meta is null || !meta.InstagramEnabled || !meta.InstagramNotifyTelegram) return;
            if (!telegram.IsConfigured) return;

            var regs = await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "")
                .ToListAsync(ct);
            if (regs.Count == 0) return;

            var userIds = regs.Select(r => r.UserId!).Distinct().ToList();
            var adminIds = (await db.Users
                .Where(u => userIds.Contains(u.Id) && (u.Role == Roles.Admin || u.Role == Roles.SuperAdmin))
                .Select(u => u.Id)
                .ToListAsync(ct)).ToHashSet();
            if (adminIds.Count == 0) return;

            var sent = new HashSet<long>();
            foreach (var r in regs)
            {
                if (r.UserId is null || !adminIds.Contains(r.UserId)) continue;
                if (!sent.Add(r.ChatId)) continue;      // bir chatga bir marta
                await telegram.SendMessageAsync(r.ChatId, text, ct: ct);
            }
        }
        catch { /* Xabarnoma suhbatni buzmasligi kerak. */ }
    }
}
