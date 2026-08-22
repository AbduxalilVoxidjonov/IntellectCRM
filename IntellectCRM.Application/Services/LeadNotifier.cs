using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Lid haqidagi Telegram xabari — <b>KARTA</b>.
///
/// <para>Oluvchilar: SHAXSIY xabar FAQAT SUPERADMIN(lar)ga (<see cref="ShouldNotify"/>) + bot
/// qo'shilgan faol GURUH(lar)ga. Bot sozlanmagan / oluvchi yo'q bo'lsa — jim o'tadi.</para>
///
/// <para><b>NEGA KARTA:</b> ilgari lidning har o'zgarishi (bosqich, izoh, sinov darsi, konversiya)
/// guruhga umuman yetib bormasdi — faqat lid TUG'ILGANDAGI xabar turardi va u tezda eskirardi.
/// Endi yuborilgan xabarning <c>message_id</c>'si <see cref="LeadTelegramMessage"/> da saqlanadi va
/// har o'zgarishda o'sha xabar <b>joyida tahrirlanadi</b> (<see cref="SyncCardAsync"/>) — guruh
/// "o'zgardi / yana o'zgardi" xabarlari bilan to'lib ketmaydi.</para>
///
/// <para>⚠️ <b>TAHRIR = JIM YOZUV.</b> Telegram tahrirlangan xabarni bildirishnoma bilan
/// ko'rsatmaydi: chat ro'yxat tepasiga chiqmaydi, telefon jiringlamaydi. Bosqich/izoh/dars
/// o'zgarishi uchun bu TO'G'RI (o'zgarishni qilgan odam CRM'ning o'zida turibdi), lekin
/// TASHQARIDAN kelgan yangi ish (takroriy murojaat, daraja testi natijasi) sezilmay qolardi —
/// shuning uchun u holatda karta tahrirlanadi VA kartaga javob qilib bitta qatorli
/// SIGNAL yuboriladi (<see cref="SignalText"/>).</para>
/// </summary>
public static class LeadNotifier
{
    /// <summary>
    /// Xabar matnining chegarasi. Telegram <c>sendMessage</c>/<c>editMessageText</c> uchun 4096
    /// belgi beradi; biz 4000 da qirqamiz (zaxira bilan).
    ///
    /// <para>⚠️ Bu HOZIR HAM mavjud bo'lgan yashirin nosozlikni yopadi: uzun so'rovnomali daraja
    /// testi matni 4096 dan oshib ketsa Telegram 400 qaytarardi, xato esa tashqi <c>catch</c> da
    /// jim yutilib, XABARNOMA UMUMAN YO'QOLARDI (karta rejimida esa karta hech qachon
    /// yangilanmasdi).</para>
    /// </summary>
    private const int MaxTextLength = 4000;

    /// <summary>Kartada ko'rsatiladigan oxirgi izohlar soni (karta — TARIX emas, JORIY holat).</summary>
    private const int MaxNoteLines = 2;

    /// <summary>Bitta izohning kartadagi eng katta uzunligi (uzuni "…" bilan qirqiladi).</summary>
    private const int MaxNoteLength = 120;

    /// <param name="createdBy">Lidni KIM kiritgani (xabar tagida ko'rsatiladi): admin/xodim ismi,
    /// "Sayt" (ochiq forma) yoki "Daraja testi" (o'quvchi o'zi topshirgan). Bo'sh bo'lsa qator chiqmaydi.</param>
    /// <param name="isNewLead">
    /// <c>true</c> — lid ENDI tug'ildi (har chatga yangi karta yuboriladi).
    /// <c>false</c> — TAKRORIY murojaat yoki mavjud lidga yangi test natijasi: mavjud karta
    /// TAHRIRLANADI va unga javob qilib qisqa signal yuboriladi (yangi to'liq karta emas).
    /// Kartasi yo'q eski lidda esa odatdagidek to'liq karta yuboriladi.
    /// </param>
    public static async Task NotifyNewLeadAsync(
        IAppDbContext db, TelegramService telegram, Lead lead,
        LevelTestSubmission? submission = null, string? testTitle = null,
        bool isNewLead = true, string? createdBy = null, CancellationToken ct = default)
    {
        try
        {
            if (!telegram.IsConfigured) return;

            var regs = await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "").ToListAsync(ct);
            // Bot qo'shilgan (faol) guruhlar — yangi lid avtomatik shu yerga ham yuboriladi.
            var groupChatIds = await db.TelegramGroups
                .Where(g => g.IsActive).Select(g => g.ChatId).ToListAsync(ct);
            if (regs.Count == 0 && groupChatIds.Count == 0) return;

            var userIds = regs.Select(r => r.UserId!).Distinct().ToList();
            var users = (await db.Users.Where(u => userIds.Contains(u.Id)).ToListAsync(ct))
                .ToDictionary(u => u.Id);

            // Oluvchi chatlar — TAKRORSIZ va eski tartibda (avval shaxsiy, keyin guruhlar).
            var chats = new List<long>();
            var seen = new HashSet<long>();
            foreach (var r in regs)
            {
                if (!users.TryGetValue(r.UserId!, out var u) || !ShouldNotify(u)) continue;
                if (seen.Add(r.ChatId)) chats.Add(r.ChatId);
            }
            foreach (var gid in groupChatIds)
                if (seen.Add(gid)) chats.Add(gid);
            if (chats.Count == 0) return;

            var text = await ComposeCardAsync(db, lead, submission, testTitle, createdBy, ct);
            var hash = Sha256Hex(text);
            var now = NowIso();

            // Shu lidning mavjud kartalari (chat bo'yicha). (LeadId, ChatId) UNIKAL — dublikat yo'q.
            var rows = await db.LeadTelegramMessages
                .Where(m => m.LeadId == lead.Id).ToListAsync(ct);
            var byChat = rows.GroupBy(m => m.ChatId).ToDictionary(g => g.Key, g => g.First());
            var dirty = false;

            foreach (var chatId in chats)
            {
                byChat.TryGetValue(chatId, out var row);

                // TAKRORIY MUROJAAT / TEST NATIJASI + shu chatda TIRIK karta bor:
                // yangi to'liq xabar YUBORILMAYDI — karta tahrirlanadi, ustiga qisqa signal ketadi.
                if (!isNewLead && row is { IsDead: false })
                {
                    var res = row.TextHash == hash
                        ? TgEditResult.NotModified            // matn o'zgarmagan — so'rov ham yubormaymiz
                        : await telegram.EditMessageTextDetailedAsync(row.ChatId, row.MessageId, text, ct: ct);

                    if (res is TgEditResult.Ok or TgEditResult.NotModified)
                    {
                        row.TextHash = hash;
                        row.UpdatedAt = now;
                        dirty = true;
                    }
                    else if (res is TgEditResult.Gone)
                    {
                        // Xabar yo'q (o'chirilgan / bot chiqarilgan) — pastda YANGI karta yuboriladi.
                        row.IsDead = true;
                        dirty = true;
                    }

                    if (!row.IsDead)
                    {
                        // ⚠️ SIGNAL — tahrir jim bo'lgani uchun. Uning id'si SAQLANMAYDI: u bir
                        // martalik bildirishnoma, hech qachon tahrirlanmaydi.
                        // Tahrir muvaffaqiyatsiz bo'lsa (429/tarmoq) ham yuboriladi — hodisa
                        // menejerdan yashirin qolmasin.
                        await telegram.SendMessageAsync(
                            chatId, SignalText(lead, submission), ct: ct, replyToMessageId: row.MessageId);
                        continue;
                    }
                }

                // YANGI KARTA: yuboramiz va message_id'ni SAQLAYMIZ (keyin shu xabar tahrirlanadi).
                var mid = await telegram.SendMessageReturningIdAsync(chatId, text, ct: ct);
                if (mid is null) continue; // yubora olmadik — yolg'on yozuv qoldirmaymiz

                if (row is null)
                {
                    db.LeadTelegramMessages.Add(new LeadTelegramMessage
                    {
                        LeadId = lead.Id, ChatId = chatId, MessageId = mid.Value,
                        TextHash = hash, CreatedAt = now, UpdatedAt = now,
                    });
                }
                else
                {
                    // ⚠️ (LeadId, ChatId) UNIKAL — mavjud yozuv YANGILANADI, yangi qator qo'shilmaydi.
                    row.MessageId = mid.Value;
                    row.TextHash = hash;
                    row.IsDead = false;
                    row.UpdatedAt = now;
                }
                dirty = true;
            }

            // ⚠️ Saqlash SHU YERDA: LeadNotifier chaqiruvchining tranzaksiyasidan KEYIN ishlaydi
            // (masalan LeadsController.Create allaqachon SaveChanges qilgan), ya'ni o'z yozuvini
            // o'zi saqlashi kerak — aks holda message_id yo'qolib, karta yangilanmay qolardi.
            if (dirty) await db.SaveChangesAsync(ct);
        }
        catch
        {
            // Xabarnoma lid yaratishni hech qachon buzmasligi kerak — jim yutamiz.
        }
    }

    /// <summary>
    /// Lid kartasini JORIY holatga keltiradi: mavjud Telegram xabar(lar)ini <b>joyida tahrirlaydi</b>.
    /// Lid o'zgargan HAR joydan (bosqich, izoh, sinov darsi, konversiya, tahrir) SaveChanges'dan
    /// KEYIN chaqiriladi.
    ///
    /// <para>🔴 <b>ENG MUHIM QOIDA — yozuvi yo'q lidga karta YARATILMAYDI.</b> Aks holda deploydan
    /// ertasiga bir menejer kanbanda 200 ta eski lidni surganda guruhga 200 ta yangi karta
    /// yog'ilardi. Karta faqat HODISADAN tug'iladi (yangi lid / takroriy murojaat / test natijasi —
    /// <see cref="NotifyNewLeadAsync"/>), bu funksiya esa faqat MAVJUDINI yangilaydi.</para>
    ///
    /// <para>Hech qachon istisno chiqarmaydi (ichida <c>try/catch</c>) — karta CRM ishini
    /// buza olmaydi.</para>
    /// </summary>
    public static async Task SyncCardAsync(
        IAppDbContext db, TelegramService telegram, string leadId, CancellationToken ct = default)
    {
        try
        {
            if (!telegram.IsConfigured || string.IsNullOrWhiteSpace(leadId)) return;

            // O'lik (xabar o'chirilgan) yozuvlar olinmaydi — ularga qayta urinilmaydi.
            var rows = await db.LeadTelegramMessages
                .Where(m => m.LeadId == leadId && !m.IsDead).ToListAsync(ct);
            if (rows.Count == 0) return; // 🔴 kartasi yo'q lid — YANGI xabar YUBORILMAYDI (yuqoriga qarang)

            var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == leadId, ct);
            if (lead is null) return; // o'chirilgan lid — `MarkDeletedAsync` ishi

            // Kartada oxirgi daraja testi natijasi ham turadi — u lidning JORIY holatining bir qismi
            // (aks holda birinchi tahrirdanoq test bloki kartadan yo'qolardi).
            var sub = await db.LevelTestSubmissions
                .Where(s => s.LeadId == leadId)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync(ct);
            var testTitle = sub is null
                ? null
                : await db.LevelTests.Where(t => t.Id == sub.TestId).Select(t => t.Title).FirstOrDefaultAsync(ct);

            var text = await ComposeCardAsync(db, lead, sub, testTitle, createdBy: null, ct);
            var hash = Sha256Hex(text);
            var now = NowIso();
            var dirty = false;

            foreach (var row in rows)
            {
                // Matn o'zgarmagan bo'lsa Telegram "message is not modified" qaytarardi —
                // so'rovni umuman yubormaymiz (tezlik chegarasi bekorga sarflanmasin).
                if (row.TextHash == hash) continue;

                switch (await telegram.EditMessageTextDetailedAsync(row.ChatId, row.MessageId, text, ct: ct))
                {
                    case TgEditResult.Ok:
                    case TgEditResult.NotModified:
                        row.TextHash = hash;
                        row.UpdatedAt = now;
                        dirty = true;
                        break;
                    case TgEditResult.Gone:
                        // Xabar yo'q — boshqa urinilmaydi (har o'zgarishda bekorga so'rov ketmasin).
                        row.IsDead = true;
                        dirty = true;
                        break;
                    default:
                        // RateLimited | Failed — hech narsa qilmaymiz, keyingi o'zgarishda yana urinamiz.
                        break;
                }
            }

            if (dirty) await db.SaveChangesAsync(ct);
        }
        catch
        {
            // Karta yangilanmasligi CRM amalini buza olmaydi — jim yutamiz (mavjud siyosat).
        }
    }

    /// <summary>
    /// Lid O'CHIRILGANDA kartani "🗑 Lid o'chirildi" holatiga o'tkazadi va bog'lovchi yozuvlarni
    /// tozalaydi. Lid o'chirilgandan KEYIN chaqiriladi (ism chaqiruvchidan uzatiladi).
    ///
    /// <para><b>NEGA XABAR O'CHIRILMAYDI:</b> Telegram <c>deleteMessage</c> 48 soatdan eski xabarga
    /// ishlamaydi — ya'ni eski karta baribir guruhda qolib, mavjud bo'lmagan lidni ko'rsatib
    /// turardi. Shuning uchun MATNI almashtiriladi.</para>
    ///
    /// <para><b>NEGA ALOHIDA FUNKSIYA</b> (<see cref="SyncCardAsync"/> ga "overrideText" emas):
    /// bu yerda ish tahrir bilan tugamaydi — lid yo'q bo'lgani uchun yozuvlar ham O'CHIRILADI,
    /// aks holda jadvalda hech qachon ishlatilmaydigan yetim qatorlar to'planib borardi.</para>
    /// </summary>
    public static async Task MarkDeletedAsync(
        IAppDbContext db, TelegramService telegram, string leadId, string leadName,
        CancellationToken ct = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(leadId)) return;

            var rows = await db.LeadTelegramMessages.Where(m => m.LeadId == leadId).ToListAsync(ct);
            if (rows.Count == 0) return;

            if (telegram.IsConfigured)
            {
                var lines = new List<string> { "🗑 Lid o'chirildi" };
                if (!string.IsNullOrWhiteSpace(leadName)) lines.Add($"👤 {leadName}");
                lines.Add($"🕒 O'chirildi: {AppClock.Now:HH:mm}");
                var text = Trim(string.Join("\n", lines));

                foreach (var row in rows)
                {
                    if (row.IsDead) continue;
                    await telegram.EditMessageTextDetailedAsync(row.ChatId, row.MessageId, text, ct: ct);
                    // Natija AHAMIYATSIZ: yozuv baribir o'chiriladi (lid yo'q — qayta urinish ham yo'q).
                }
            }

            db.LeadTelegramMessages.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            // Jim — o'chirish amalini buzmaymiz.
        }
    }

    // Shaxsiy xabar FAQAT superadminga (ilgari admin/xodimga ham ketardi). Guruhga yuborish alohida — saqlanadi.
    private static bool ShouldNotify(AppUser u) => u.Role == Roles.SuperAdmin;

    /// <summary>
    /// Tahrirlangan karta ustiga yuboriladigan BITTA QATORLI signal — tahrir jim bo'lgani uchun
    /// (Telegram tahrirni bildirishnoma qilmaydi). Ataylab qisqa: batafsili kartaning o'zida,
    /// signal esa faqat "qarang" deydi.
    /// </summary>
    private static string SignalText(Lead l, LevelTestSubmission? sub)
    {
        var who = string.Join(" · ", new[] { l.FullName, l.Phone }
            .Where(x => !string.IsNullOrWhiteSpace(x)));
        var tail = who.Length > 0 ? $" — {who}" : "";
        if (sub is not null) return $"📝 Daraja testi topshirildi{tail}";
        if (l.RepeatCount > 0) return $"🔁 Takroriy murojaat (×{l.RepeatCount}){tail}";
        return $"🔁 Lid yangilandi{tail}";
    }

    /// <summary>
    /// Karta matnini yig'adi: kerakli ma'lumotni yuklaydi va <see cref="BuildCardText"/> ga beradi.
    /// Yuborishda ham, keyingi tahrirlarda ham AYNAN shu funksiya ishlaydi — ya'ni matn
    /// DETERMINLASHGAN (bir xil holatdan bir xil matn), aks holda hash bekorga farq qilib,
    /// har safar ortiqcha tahrir so'rovi ketardi.
    /// </summary>
    private static async Task<string> ComposeCardAsync(
        IAppDbContext db, Lead lead, LevelTestSubmission? sub, string? testTitle,
        string? createdBy, CancellationToken ct)
    {
        var stageTitle = string.IsNullOrWhiteSpace(lead.Stage)
            ? null
            : await db.LeadStages.Where(s => s.Id == lead.Stage).Select(s => s.Title).FirstOrDefaultAsync(ct);

        // Sinov darsi — FAQAT oxirgisi: karta tarix emas, joriy holat.
        var trial = await db.TrialLessons
            .Where(t => t.LeadId == lead.Id)
            .OrderByDescending(t => t.ScheduledAt)
            .FirstOrDefaultAsync(ct);
        var trialGroup = trial is null || string.IsNullOrWhiteSpace(trial.GroupId)
            ? null
            : await db.Classes.Where(c => c.Id == trial.GroupId).Select(c => c.Name).FirstOrDefaultAsync(ct);

        // FAQAT izoh/qo'ng'iroq: bosqich, sinov darsi va konversiya kartada ALOHIDA qatorlar bilan
        // ko'rsatiladi — ularni yana izohlar ro'yxatida takrorlash kartani suyultirardi.
        var notes = await db.LeadEvents
            .Where(e => e.LeadId == lead.Id && (e.Type == "note" || e.Type == "call"))
            .OrderByDescending(e => e.CreatedAt)
            .Take(MaxNoteLines)
            .ToListAsync(ct);

        // "Kiritdi" qatori kartadan YO'QOLMASIN: chaqiruvchi ismni bermasa (tahrir oqimi) uni
        // lidning "created" hodisasidan olamiz.
        if (string.IsNullOrWhiteSpace(createdBy))
            createdBy = await db.LeadEvents
                .Where(e => e.LeadId == lead.Id && e.Type == "created")
                .OrderBy(e => e.CreatedAt)
                .Select(e => e.ActorName)
                .FirstOrDefaultAsync(ct);

        return BuildCardText(lead, sub, testTitle, createdBy, stageTitle, trial, trialGroup, notes);
    }

    /// <summary>
    /// KARTA matni = eski xabar matni (<see cref="BuildText"/>, barcha qatorlari saqlangan) +
    /// lidning JORIY holati (bosqich, sinov darsi, takror, oxirgi izohlar, konversiya, yangilangan vaqt).
    /// </summary>
    private static string BuildCardText(
        Lead l, LevelTestSubmission? sub, string? testTitle, string? createdBy,
        string? stageTitle, TrialLesson? trial, string? trialGroupName, IReadOnlyList<LeadEvent> notes)
    {
        // Sarlavha lidning O'ZIDAN hisoblanadi (hodisadan emas: "yangi"/"takroriy" holati
        // `RepeatCount` da turibdi) — shu sabab karta har tahrirda bir xil sarlavha bilan chiziladi.
        var parts = new List<string> { BuildText(l, sub, testTitle, isNewLead: l.RepeatCount == 0, createdBy) };

        var state = new List<string> { "", "— — —" };
        if (!string.IsNullOrWhiteSpace(stageTitle)) state.Add($"📍 Bosqich: {stageTitle}");
        if (trial is not null)
        {
            var group = string.IsNullOrWhiteSpace(trialGroupName) ? "" : $" · {trialGroupName}";
            state.Add($"🎓 Sinov darsi: {HumanDate(trial.ScheduledAt)}{group} — {TrialLabel(trial.Result)}");
        }
        if (l.RepeatCount > 0)
        {
            var when = string.IsNullOrWhiteSpace(l.LastRepeatAt) ? "" : $" ({HumanDate(l.LastRepeatAt)})";
            state.Add($"🔁 Takroriy murojaat: ×{l.RepeatCount}{when}");
        }
        if (notes.Count > 0)
        {
            state.Add("💬 Oxirgi izohlar:");
            foreach (var n in notes)
                state.Add($"• {Shorten(n.Text, MaxNoteLength)}"
                          + (string.IsNullOrWhiteSpace(n.ActorName) ? "" : $" — {n.ActorName}"));
        }
        if (!string.IsNullOrWhiteSpace(l.ConvertedStudentId)) state.Add("✅ O'quvchi bo'ldi");
        // Odam kartaning TIRIK ekanini ko'rsin (oxirgi tahrir vaqti).
        state.Add($"🕒 Yangilandi: {AppClock.Now:HH:mm}");

        parts.AddRange(state);
        return Trim(string.Join("\n", parts));
    }

    private static string BuildText(
        Lead l, LevelTestSubmission? sub, string? testTitle, bool isNewLead = true, string? createdBy = null)
    {
        var header = isNewLead ? "🆕 Yangi lid!"
            : sub is not null ? "🔁 Mavjud lid — yangi test natijasi"
            : "🔁 Mavjud lid yangilandi";
        var lines = new List<string> { header };
        if (!string.IsNullOrWhiteSpace(l.FullName)) lines.Add($"👤 {l.FullName}");
        if (!string.IsNullOrWhiteSpace(l.Phone)) lines.Add($"📞 {l.Phone}");
        if (!string.IsNullOrWhiteSpace(l.Source)) lines.Add($"🔖 Manba: {l.Source}");
        if (!string.IsNullOrWhiteSpace(l.InterestSubject)) lines.Add($"📚 Qiziqish: {l.InterestSubject}");

        if (sub is not null)
        {
            // Daraja testi natijasi — batafsil.
            lines.Add("");
            lines.Add("📊 Daraja testi natijasi");
            if (!string.IsNullOrWhiteSpace(testTitle)) lines.Add($"📝 Test: {testTitle}");
            if (sub.Total > 0)
            {
                lines.Add($"✅ Ball: {sub.Score}/{sub.Total} ({sub.Percent}%)");
                lines.Add($"{PerfIcon(sub.Percent)} Baho: {PerfLabel(sub.Percent)}");
            }
            else
            {
                lines.Add("ℹ️ Test savolsiz (faqat so'rovnoma).");
            }
            if (!string.IsNullOrWhiteSpace(sub.Level)) lines.Add($"🎯 Daraja: {sub.Level}");
            if (sub.Age > 0) lines.Add($"🎂 Yoshi: {sub.Age}");

            var survey = ParseSurvey(sub.SurveyJson);
            if (survey.Count > 0)
            {
                lines.Add("");
                lines.Add("🗒 So'rovnoma:");
                foreach (var a in survey)
                {
                    // ⚠️ `Answers` NULL bo'lishi mumkin: JSON'da "Answers" maydoni umuman bo'lmasa
                    // deserializatsiya uni null qoldiradi. Ilgari `a.Answers.Count` NullReference
                    // tashlar, tashqi catch uni yutar va BUTUN XABARNOMA yo'qolardi (karta rejimida
                    // esa karta hech qachon yangilanmasdi). Endi bo'sh javob "—" bo'lib chiqadi.
                    var answers = a.Answers is { Count: > 0 } ? string.Join(", ", a.Answers) : "—";
                    lines.Add($"• {a.Question}: {answers}");
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(l.Note))
        {
            lines.Add("");
            lines.Add($"📝 {l.Note}");
        }

        // Eng tagida — lidni kim kiritgani.
        if (!string.IsNullOrWhiteSpace(createdBy))
        {
            lines.Add("");
            lines.Add($"🧑‍💼 Kiritdi: {createdBy}");
        }

        return string.Join("\n", lines);
    }

    /// <summary>Foizga qarab sifat bahosi (qanday ishladi).</summary>
    private static string PerfLabel(int p) => p >= 80 ? "A'lo" : p >= 60 ? "Yaxshi" : p >= 40 ? "O'rta" : "Past";
    private static string PerfIcon(int p) => p >= 60 ? "🟢" : p >= 40 ? "🟡" : "🔴";

    private static string TrialLabel(string? result) => result switch
    {
        "stayed" => "qoldi",
        "left" => "ketdi",
        _ => "kutilmoqda",
    };

    /// <summary>ISO sana/vaqtni odam o'qiydigan ko'rinishga keltiradi ("2026-08-22T15:00" → "2026-08-22 15:00").</summary>
    private static string HumanDate(string? iso)
    {
        var v = (iso ?? "").Trim();
        if (v.Length == 0) return "—";
        if (v.Length > 16) v = v[..16];
        return v.Replace('T', ' ');
    }

    /// <summary>Uzun matnni qirqadi (izoh kartani bosib ketmasin).</summary>
    private static string Shorten(string? text, int max)
    {
        var v = (text ?? "").Replace("\n", " ").Trim();
        return v.Length <= max ? v : Cut(v, max);
    }

    /// <summary>Butun xabarni Telegram chegarasiga sig'diradi (<see cref="MaxTextLength"/>).</summary>
    private static string Trim(string text) => text.Length <= MaxTextLength ? text : Cut(text, MaxTextLength);

    private static string Cut(string text, int max)
    {
        var cut = max - 1;
        // ⚠️ Emoji ikkita `char` (surrogat juftlik) — o'rtasidan kesilsa buzuq belgi chiqardi.
        if (cut > 0 && char.IsHighSurrogate(text[cut - 1])) cut--;
        return string.Concat(text.AsSpan(0, cut), "…");
    }

    /// <summary>Matn xeshi — kartani bekorga tahrirlamaslik uchun (<see cref="LeadTelegramMessage.TextHash"/>).</summary>
    private static string Sha256Hex(string text) =>
        Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text)));

    private static string NowIso() => AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");

    private static readonly System.Text.Json.JsonSerializerOptions SurveyOpts = new() { PropertyNameCaseInsensitive = true };

    private static List<SurveyAnswerDto> ParseSurvey(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            // Null elementlar ham tashlanadi ("[null]" kabi buzuq JSON butun matnni yiqitmasin).
            return System.Text.Json.JsonSerializer.Deserialize<List<SurveyAnswerDto>>(json, SurveyOpts)
                       ?.Where(a => a is not null).ToList()
                   ?? new();
        }
        catch { return new(); }
    }
}
