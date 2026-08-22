using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Meta webhook payloadidan ajratib olingan BITTA hodisa (normalizatsiyalangan ichki model).
/// </summary>
/// <param name="Kind"><c>comment</c> | <c>dm</c> | <c>echo</c> — va E6 bilan qo'shilgan
/// <c>deleted</c> (mijoz xabarini o'chirdi) hamda <c>policy</c> (Meta siyosati ogohlantirishi).
/// Oxirgi ikkisi SUHBAT hodisasi emas: ular yangi xabar yozmaydi, mavjud yozuvni tozalaydi
/// yoki butun modulga ta'sir qiladi.</param>
/// <param name="Text">Xabar matni. <b>Bo'sh bo'lishi mumkin</b> (rasm/stiker/ovoz) — hodisa
/// baribir qaytariladi, chunki jimgina yo'qolgan mijoz eng yomon holat.</param>
/// <param name="SenderId">SUHBATDOSHNING id'si. ⚠️ <c>echo</c> da bu BIZ EMAS, xabar KIMGA
/// ketgan bo'lsa o'sha (recipient) — pauza aynan o'sha suhbatga qo'yilishi kerak.</param>
/// <param name="Username">Faqat izohda ishonchli keladi; DM'da odatda bo'sh.</param>
/// <param name="CommentId">Izohda majburiy — javob aynan shu izoh ostiga yoziladi.</param>
/// <param name="MediaId">Izoh qaysi post ostida (AI kontekst uchun).</param>
/// <param name="IgMessageId">DM'dagi <c>mid</c> — dedup kaliti shundan.</param>
/// <param name="EventKey">Deterministik dedup kaliti.</param>
/// <param name="IsEcho">Bizning akkauntimizdan chiqqan xabar.</param>
public record IgIncomingEvent(
    string Kind,
    string Text,
    string SenderId,
    string Username,
    string CommentId,
    string MediaId,
    string IgMessageId,
    string EventKey,
    bool IsEcho,
    /// <summary>Meta bergan hodisa vaqti (ISO, mahalliy mintaqada). Bo'sh = payloadda yo'q.
    /// <para>⚠️ 24 soatlik DM oynasi SHU vaqtdan hisoblanishi kerak, hodisa QAYTA ISHLANGAN
    /// vaqtdan emas: navbat uzoq turib qolsa (modul o'chiq bo'lib keyin yoqilsa) oyna "ochiq"
    /// bo'lib ko'rinardi va Instagram javobni rad etardi.</para></summary>
    string SentAtIso = "",

    /* ─────────── E6: STORY, ULASHILGAN POST, O'CHIRISH, SIYOSAT ───────────
       Quyidagi maydonlar ATAYIN qo'shimcha (default qiymatli) parametrlar: mavjud chaqiruvchilar
       va testlar o'zgarishsiz ishlayveradi, yangi kontekst esa jimgina yo'qolmaydi. */

    /// <summary>Mijoz QAYSI story'ga javob yozgani (<c>message.reply_to.story.id</c>).
    /// Bo'sh = story javobi emas.</summary>
    string StoryId = "",

    /// <summary>O'sha story rasmining CDN manzili (<c>message.reply_to.story.url</c>).
    /// <para>⚠️ Bu manzil <b>TEZ O'LADI</b> (story 24 soatda yo'qoladi, imzolangan CDN havolasi
    /// undan ham oldin). Rasmni o'zimizga ko'chirish uchun alohida fayl saqlash (va migratsiya)
    /// kerak bo'lardi — hozircha id va manzil xabar KONTEKSTIDA matn sifatida saqlanadi, ya'ni
    /// operator hech bo'lmaganda "qaysi story haqida gap ketyapti" ni ko'radi.</para></summary>
    string StoryUrl = "",

    /// <summary>Mijoz o'z story'sida BIZNI eslatib o'tgan (<c>attachments[].type == "story_mention"</c>).
    /// Bu odatiy DM emas — javob berish odobi ham boshqacha, shuning uchun alohida belgilanadi.</summary>
    bool IsStoryMention = false,

    /// <summary>Mijoz IG postni ulashgan (<c>attachments[].type == "ig_post"</c>).
    /// <para>⚠️ Eski <c>share</c> turi 2026-02-01 da OLIB TASHLANGAN — faqat <c>ig_post</c>
    /// parse qilinadi.</para></summary>
    bool HasSharedPost = false,

    /// <summary>Ulashilgan postning manzili (bo'lsa).</summary>
    string SharedPostUrl = "",

    /// <summary>Mijoz xabarni O'CHIRDI (<c>message.is_deleted</c>). Bu YANGI xabar emas —
    /// mavjud yozuvning mazmuni tozalanishi kerak (Platform Terms talabi).</summary>
    bool IsDeleted = false,

    /// <summary>Meta'ning siyosat ogohlantirishi: amal (<c>warning</c> | <c>block</c> ...).
    /// Bo'sh = bu hodisa siyosat ogohlantirishi emas.</summary>
    string PolicyAction = "",

    /// <summary>Siyosat ogohlantirishining sababi (Meta bergan matn, xom holda).</summary>
    string PolicyReason = "");

/// <summary>
/// Meta'ning XOM webhook JSON'ini ichki hodisalarga aylantiradi.
///
/// <para><b>Cheksiz halqa himoyasining 1-qavati SHU YERDA:</b> o'z akkauntimizdan kelgan izoh
/// (<c>from.id</c> bizniki) umuman qaytarilmaydi. NUR loyihasida bot o'z javobini begona izoh deb
/// hisoblab, unga yana javob yozgan va akkaunt spam sifatida bloklanish arafasiga kelgan.
/// Solishtirish UCHALA identifikator bo'yicha (<see cref="InstagramEventParser.IgSelf"/>):
/// saqlangan <c>IgUserId</c>, app-scoped <c>id</c>, <c>username</c> va payloaddagi
/// <c>entry.id</c> — <c>from.id</c> ba'zan biri, ba'zan boshqasi formatida keladi.</para>
///
/// <para><b>Dedup kaliti DETERMINISTIK.</b> NUR'da kalit matnning runtime hash'idan qurilgan edi:
/// har jarayonda boshqacha chiqib, restartdan keyin dedup umuman ishlamasdi. Bu yerda kalit —
/// Meta bergan <c>comment_id</c>/<c>mid</c>, ular bo'lmasa SHA-256 (barqaror).</para>
///
/// <para>Sof funksiyalar — baza/tarmoq yo'q, to'liq testlanadi. Buzuq JSON → BO'SH ro'yxat
/// (istisno otilmaydi: bitta noto'g'ri payload navbatni to'xtatib qo'ymasin).</para>
/// </summary>
public static class InstagramEventParser
{
    /// <summary>
    /// AKKAUNTIMIZNING IDENTIFIKATORLARI — halqa himoyasining 1-qavati shular bo'yicha ishlaydi.
    ///
    /// <para>⚠️ Webhook'da <c>from.id</c> <b>ba'zan</b> IG professional akkaunt id'si,
    /// <b>ba'zan</b> app-scoped id (IGSID) bo'lib keladi — bittasiga tayanish bot o'z izohini
    /// begona deb bilib, unga javob yozib CHEKSIZ HALQAGA tushishining aynan sababi.
    /// Shuning uchun uchala qiymat ham solishtiriladi.</para>
    /// </summary>
    /// <param name="IgUserId">IG professional akkaunt id (<c>me.user_id</c>).</param>
    /// <param name="AppScopedId">App-scoped id (<c>me.id</c>) — DM'larda shu keladi.</param>
    /// <param name="Username">Zaxira: id umuman kelmagan/boshqa formatdagi hollarda (registr e'tiborsiz).</param>
    public readonly record struct IgSelf(string IgUserId = "", string AppScopedId = "", string Username = "");

    /* ─────────────── E6 HODISA TURLARI VA MAYDON NOMLARI ───────────────
       ⚠️ Nega `IgConst` da EMAS: bu qiymatlar parser bilan pipeline O'RTASIDA qoladi va bazaga
       hech qachon yozilmaydi (`IgMessage.Channel` qiymatlari o'zgarmagan). Ular hodisa turining
       ICHKI belgisi, ya'ni modulning tashqi shartnomasi emas. */

    /// <summary>Mijoz o'z xabarini O'CHIRDI (<c>message.is_deleted</c>).
    /// <para>⚠️ Kalit ATAYIN <c>dm:</c> dan farq qiladi: o'chirish hodisasi AYNAN o'sha
    /// <c>mid</c> bilan keladi va kalit bir xil bo'lsa navbatdagi UNIKAL indeks uni "takror"
    /// deb rad etardi — ya'ni o'chirish so'rovi bizga UMUMAN yetib kelmasdi.</para></summary>
    public const string KindDeleted = "deleted";

    /// <summary>Meta'ning siyosat ogohlantirishi (<c>messaging_policy_enforcement</c>) — cheklov
    /// qo'yilishidan OLDINGI signal, modulning eng yuqori qiymatli hodisasi.</summary>
    public const string KindPolicy = "policy";

    /// <summary>Story'da eslatib o'tish attachment turi.</summary>
    public const string AttachStoryMention = "story_mention";

    /// <summary>Ulashilgan IG post attachment turi (eski <c>share</c> 2026-02-01 da olib tashlangan).</summary>
    public const string AttachIgPost = "ig_post";

    /// <summary>Siyosat ogohlantirishi keladigan webhook maydoni.</summary>
    public const string FieldPolicyEnforcement = "messaging_policy_enforcement";

    /// <summary>Story manzili kontekst matniga shuncha belgigacha kiradi (CDN havolalari juda uzun).</summary>
    private const int MaxContextUrlLength = 300;

    /// <summary>Siyosat hodisasi kelishi mumkin bo'lgan kalitlar (§<see cref="TryPolicy"/>).</summary>
    private static readonly string[] PolicyKeys =
        { "policy-enforcement", "policy_enforcement", FieldPolicyEnforcement };

    /// <summary>Xom JSON → 0..N hodisa. <paramref name="ourIgUserId"/> — bizning akkaunt id'miz
    /// (bo'sh bo'lsa ham parser ishlaydi, lekin halqa himoyasi faqat <c>entry.id</c> ga tayanadi).
    /// <para>Uchala identifikatorni beradigan ko'rinishi: <see cref="Parse(string, IgSelf)"/>.</para></summary>
    public static IReadOnlyList<IgIncomingEvent> Parse(string rawJson, string ourIgUserId) =>
        Parse(rawJson, new IgSelf(IgUserId: ourIgUserId ?? ""));

    /// <summary>Xom JSON → 0..N hodisa (halqa himoyasi UCHALA identifikator bo'yicha).</summary>
    public static IReadOnlyList<IgIncomingEvent> Parse(string rawJson, IgSelf self)
    {
        var result = new List<IgIncomingEvent>();
        if (string.IsNullOrWhiteSpace(rawJson)) return result;

        JsonDocument doc;
        try { doc = JsonDocument.Parse(rawJson); }
        catch (JsonException) { return result; }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return result;
            if (!root.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
                return result;

            foreach (var entry in entries.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object) continue;
                var entryId = Str(entry, "id");
                var entryTime = Raw(entry, "time");

                ReadComments(entry, entryId, entryTime, self, result);
                ReadMessaging(entry, entryId, entryTime, self, result);
            }
        }

        return result;
    }

    /// <summary>
    /// Payloadda QO'LLAB-QUVVATLANMAYDIGAN <c>changes[].field</c> nomlari (masalan
    /// <c>mentions</c>, <c>live_comments</c>) — vergul bilan, takrorsiz. Hech nima bo'lmasa
    /// bo'sh satr.
    ///
    /// <para><b>Nega kerak:</b> parser bunday hodisani jimgina tashlab yuboradi va navbatda
    /// faqat "qayta ishlanadigan hodisa topilmadi" degan UMUMIY sabab qolardi. Meta'da esa
    /// keraksiz maydonga obuna bo'lib qolish oson — o'shanda admin "hodisa kelyapti, lekin
    /// hech narsa bo'lmayapti" holatini ko'rar, sababini esa hech qayerdan topa olmasdi
    /// (qoidalar §11 tuzoq 8: "ishlanmaydi, lekin LOGGA yoziladi").</para>
    ///
    /// <para>⚠️ Sof funksiya: hech narsa o'zgartirmaydi, buzuq JSON'da bo'sh satr qaytaradi.</para>
    /// </summary>
    public static string UnsupportedFields(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson)) return "";

        JsonDocument doc;
        try { doc = JsonDocument.Parse(rawJson); }
        catch (JsonException) { return ""; }

        var found = new List<string>();
        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return "";
            if (!root.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
                return "";

            foreach (var entry in entries.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object) continue;
                if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
                    continue;

                foreach (var ch in changes.EnumerateArray())
                {
                    if (ch.ValueKind != JsonValueKind.Object) continue;
                    var field = Str(ch, "field");
                    if (field.Length == 0) continue;
                    if (field == "comments" || field == FieldPolicyEnforcement) continue;
                    if (!found.Contains(field)) found.Add(field);
                }
            }
        }

        return string.Join(", ", found);
    }

    /* ---------------- izohlar (entry.changes[]) ---------------- */

    private static void ReadComments(
        JsonElement entry, string entryId, string entryTime, IgSelf self, List<IgIncomingEvent> outList)
    {
        if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array) return;

        foreach (var ch in changes.EnumerateArray())
        {
            if (ch.ValueKind != JsonValueKind.Object) continue;

            // SIYOSAT OGOHLANTIRISHI `changes[]` ko'rinishida ham kelishi mumkin (Meta uni
            // `messaging[]` ichida yuboradi, lekin shakl hujjatlarda qat'iy qotirilmagan).
            // Ikkala ko'rinishni ham qabul qilamiz: bu hodisani BOY BERISH — modulning eng
            // qimmat signalini yo'qotish degani.
            var field = Str(ch, "field");
            if (field == FieldPolicyEnforcement)
            {
                if (ch.TryGetProperty("value", out var pv) && pv.ValueKind == JsonValueKind.Object)
                    AddPolicy(pv, entryId, entryTime, outList);
                continue;
            }

            // `mentions`, `live_comments` va boshqa maydonlar qo'llab-quvvatlanmaydi — ular
            // tashlanadi, lekin hodisa navbatda `skipped` bo'lib ko'rinadi (jimgina yo'qolmaydi).
            if (field != "comments") continue;
            if (!ch.TryGetProperty("value", out var v) || v.ValueKind != JsonValueKind.Object) continue;

            var commentId = Str(v, "id");
            var text = Str(v, "text");
            var fromId = "";
            var username = "";
            if (v.TryGetProperty("from", out var from) && from.ValueKind == JsonValueKind.Object)
            {
                fromId = Str(from, "id");
                username = Str(from, "username");
            }
            var mediaId = "";
            if (v.TryGetProperty("media", out var media) && media.ValueKind == JsonValueKind.Object)
                mediaId = Str(media, "id");

            // ⚠️ HALQA HIMOYASI: o'z izohimizga javob yozmaymiz.
            if (IsOurs(fromId, username, self, entryId)) continue;
            if (fromId.Length == 0 && commentId.Length == 0) continue;   // taniqli hech narsa yo'q

            var ts = Str(v, "timestamp") is { Length: > 0 } t ? t : entryTime;
            var key = EventKeyOf(IgConst.KindComment, commentId, "", fromId, ts, text);
            outList.Add(new IgIncomingEvent(
                IgConst.KindComment, text, fromId, username, commentId, mediaId, "", key, false, ToIso(ts)));
        }
    }

    /* ---------------- DM va echo (entry.messaging[]) ---------------- */

    private static void ReadMessaging(
        JsonElement entry, string entryId, string entryTime, IgSelf self, List<IgIncomingEvent> outList)
    {
        if (!entry.TryGetProperty("messaging", out var arr) || arr.ValueKind != JsonValueKind.Array) return;

        foreach (var m in arr.EnumerateArray())
        {
            if (m.ValueKind != JsonValueKind.Object) continue;

            // ── META SIYOSATI OGOHLANTIRISHI ──
            // `message` obyekti YO'Q, shuning uchun u pastdagi tekshiruvdan OLDIN ko'riladi
            // (aks holda hodisa jimgina tashlanardi).
            if (TryPolicy(m, out var policyValue))
            {
                AddPolicy(policyValue, entryId, entryTime, outList);
                continue;
            }

            // `reaction`, `read`, `delivery` — xabar emas, e'tiborga olinmaydi.
            if (!m.TryGetProperty("message", out var msg) || msg.ValueKind != JsonValueKind.Object) continue;

            var senderId = Sub(m, "sender", "id");
            var recipientId = Sub(m, "recipient", "id");
            var mid = Str(msg, "mid");
            var text = Str(msg, "text");
            var ts = Raw(m, "timestamp") is { Length: > 0 } t ? t : entryTime;

            // Echo — Meta bayrog'i YOKI jo'natuvchi biz (ikki qavatli tekshiruv: bayroq
            // kelmasa ham o'z xabarimizga javob yozib qo'ymaymiz).
            var isEcho = Bool(msg, "is_echo") || IsOurs(senderId, "", self, entryId);
            var counterparty = isEcho ? recipientId : senderId;
            if (counterparty.Length == 0) continue;
            if (IsOurs(counterparty, "", self, entryId)) continue;   // o'zimizga o'zimiz — mumkin emas

            // ── XABAR O'CHIRILDI (`is_deleted`) ──
            // Bu YANGI xabar emas: mavjud yozuvning MAZMUNI o'chirilishi kerak (Platform Terms).
            // Kalit ham alohida (`deleted:{mid}`) — aks holda navbatdagi unikal indeks uni
            // asl xabarning takrori deb rad etardi.
            if (Bool(msg, "is_deleted"))
            {
                var delKey = EventKeyOf(KindDeleted, "", mid, counterparty, ts, text);
                outList.Add(new IgIncomingEvent(
                    KindDeleted, "", counterparty, "", "", "", mid, delKey, isEcho, ToIso(ts),
                    IsDeleted: true));
                continue;
            }

            // ── STORY JAVOBI · STORY MENTION · ULASHILGAN IG POST ──
            var (storyId, storyUrl) = ReadStoryReply(msg);
            var (isMention, mentionUrl, hasPost, postUrl) = ReadAttachments(msg);

            var kind = isEcho ? IgConst.KindEcho : IgConst.KindDm;
            var key = EventKeyOf(kind, "", mid, counterparty, ts, text);
            outList.Add(new IgIncomingEvent(
                kind, text, counterparty, "", "", "", mid, key, isEcho, ToIso(ts),
                StoryId: storyId,
                // Story rasmi manzili ikki yo'ldan keladi: javobda `reply_to.story.url`,
                // eslatishda esa attachment payload'ida. Ustun — javobniki.
                StoryUrl: storyUrl.Length > 0 ? storyUrl : mentionUrl,
                IsStoryMention: isMention, HasSharedPost: hasPost, SharedPostUrl: postUrl));
        }
    }

    /* ---------------- E6: story, attachment, o'chirish, siyosat ---------------- */

    /// <summary>Story'ga javob: <c>message.reply_to.story.{id,url}</c>.
    /// <para>⚠️ <c>reply_to</c> ODATIY xabarga javobda ham keladi (u yerda faqat <c>mid</c>) —
    /// story konteksti FAQAT ichki <c>story</c> obyekti bo'lganda paydo bo'ladi.</para></summary>
    private static (string Id, string Url) ReadStoryReply(JsonElement msg)
    {
        if (!msg.TryGetProperty("reply_to", out var replyTo) || replyTo.ValueKind != JsonValueKind.Object)
            return ("", "");
        if (!replyTo.TryGetProperty("story", out var story) || story.ValueKind != JsonValueKind.Object)
            return ("", "");
        return (Str(story, "id"), Str(story, "url"));
    }

    /// <summary>Attachment turlari: story'da eslatish va ulashilgan IG post.
    /// <para>⚠️ Eski <c>share</c> turi 2026-02-01 da olib tashlangan — <c>ig_post</c> ko'riladi.
    /// Qolgan turlar (rasm, video, ovoz) bu yerda e'tiborga olinmaydi: ular uchun mavjud
    /// "matnsiz xabar → operator" qoidasi ishlaydi.</para></summary>
    private static (bool StoryMention, string MentionUrl, bool SharedPost, string PostUrl) ReadAttachments(
        JsonElement msg)
    {
        if (!msg.TryGetProperty("attachments", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return (false, "", false, "");

        var mention = false;
        var mentionUrl = "";
        var post = false;
        var postUrl = "";
        foreach (var a in arr.EnumerateArray())
        {
            if (a.ValueKind != JsonValueKind.Object) continue;
            var type = Str(a, "type");
            var payloadUrl = a.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object
                ? Str(p, "url")
                : "";

            if (string.Equals(type, AttachStoryMention, StringComparison.OrdinalIgnoreCase))
            {
                mention = true;
                if (mentionUrl.Length == 0) mentionUrl = payloadUrl;
            }
            else if (string.Equals(type, AttachIgPost, StringComparison.OrdinalIgnoreCase))
            {
                post = true;
                if (postUrl.Length == 0) postUrl = payloadUrl;
            }
        }

        return (mention, mentionUrl, post, postUrl);
    }

    /// <summary>
    /// <c>messaging[]</c> elementida siyosat ogohlantirishi bormi.
    ///
    /// <para>⚠️ Meta hujjatida maydon <c>messaging_policy_enforcement</c> deb ataladi, hodisa
    /// obyekti esa <c>policy-enforcement</c> (DEFIS bilan) kaliti ostida keladi. Loyihaning
    /// API ma'lumotnomasida bu shakl QAT'IY qotirilmagan, shuning uchun parser ATAYIN kechirimli:
    /// uchala yozilishni ham qabul qiladi. Bu hodisani boy berish — Meta cheklov qo'yishidan
    /// oldingi YAGONA ogohlantirishni yo'qotish degani.</para>
    /// </summary>
    private static bool TryPolicy(JsonElement m, out JsonElement value)
    {
        foreach (var name in PolicyKeys)
        {
            if (m.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object)
            {
                value = v;
                return true;
            }
        }

        value = default;
        return false;
    }

    /// <summary>Siyosat hodisasini ro'yxatga qo'shadi. Kalit deterministik: <c>action</c> va
    /// <c>reason</c> ning barqaror hash'i (Meta bu hodisada <c>mid</c> bermaydi).</summary>
    private static void AddPolicy(JsonElement value, string entryId, string entryTime, List<IgIncomingEvent> outList)
    {
        var action = Str(value, "action");
        var reason = Str(value, "reason");
        if (action.Length == 0 && reason.Length == 0) action = "warning";   // shakl kutilmagan — signal baribir qoladi

        var key = EventKeyOf(KindPolicy, "", "", entryId, entryTime, action + "|" + reason);
        outList.Add(new IgIncomingEvent(
            KindPolicy, "", entryId, "", "", "", "", key, false, ToIso(entryTime),
            PolicyAction: action, PolicyReason: reason));
    }

    /// <summary>
    /// Payloadda siyosat ogohlantirishi bormi — <b>webhook controlleri</b> uchun tez tekshiruv.
    /// <para>Navbat fon xizmatida qayta ishlanadi, ya'ni ogohlantirish logga bir necha soniya
    /// (yoki modul o'chiq bo'lsa — umuman) kechikib tushardi. Bu funksiya so'rov kelgan
    /// ZAHOTI log yozish imkonini beradi va HECH QANDAY og'ir ish qilmaydi.</para>
    /// </summary>
    public static bool ContainsPolicyEnforcement(string? rawJson)
    {
        var json = rawJson ?? "";
        // Arzon oldingi tekshiruv: payloadlarning aksariyatida bu so'z umuman yo'q.
        if (json.IndexOf("policy", StringComparison.OrdinalIgnoreCase) < 0) return false;

        foreach (var e in Parse(json, new IgSelf()))
            if (e.Kind == KindPolicy) return true;
        return false;
    }

    /// <summary>
    /// Xabarning QO'SHIMCHA KONTEKSTI o'zbekcha, bitta qatorda ("[Story'ga javob …]").
    ///
    /// <para>Nega matnga qo'shiladi: story id/url uchun alohida ustun YO'Q (migratsiya bu
    /// bosqichda qilinmaydi), AI esa "nimaga javob yozilyapti" ni bilmasa mazmunsiz javob
    /// beradi ("Salom!" degan story javobi kontekstsiz umuman tushunarsiz). Kontekst
    /// operatorga ham ko'rinadi — lentada xabar ustida turadi.</para>
    ///
    /// <para>Konteksti yo'q oddiy xabarda BO'SH satr qaytadi, ya'ni mavjud xulq o'zgarmaydi.</para>
    /// </summary>
    public static string ContextNote(IgIncomingEvent e)
    {
        var parts = new List<string>();

        // ⚠️ ESLATISH ustun: mijoz o'z story'sida bizni belgilagan bo'lsa bu "javob" emas,
        // boshqa hodisa — ikkalasi bir vaqtda kelsa ham matn chalkashmasin.
        if (e.IsStoryMention)
        {
            var s = "Story'da bizni eslatib o'tdi";
            if (e.StoryUrl.Length > 0) s += $" · rasm: {ShortUrl(e.StoryUrl)}";
            parts.Add(s);
        }
        else if (e.StoryId.Length > 0 || e.StoryUrl.Length > 0)
        {
            var s = "Story'ga javob";
            if (e.StoryId.Length > 0) s += $" · story: {e.StoryId}";
            if (e.StoryUrl.Length > 0) s += $" · rasm: {ShortUrl(e.StoryUrl)}";
            parts.Add(s);
        }

        if (e.HasSharedPost)
            parts.Add(e.SharedPostUrl.Length > 0
                ? $"IG post ulashildi: {ShortUrl(e.SharedPostUrl)}"
                : "IG post ulashildi");

        return parts.Count == 0 ? "" : "[" + string.Join(" | ", parts) + "]";
    }

    /// <summary>Kontekst matni CDN havolasi bilan cheksiz uzayib ketmasin.</summary>
    private static string ShortUrl(string url) =>
        url.Length <= MaxContextUrlLength ? url : url[..MaxContextUrlLength] + "…";

    /* ---------------- dedup kaliti ---------------- */

    /// <summary>
    /// DETERMINISTIK dedup kaliti: izohda <c>comment_id</c>, DM/echo'da <c>mid</c>; ikkalasi ham
    /// bo'lmasa jo'natuvchi + vaqt + matnning SHA-256 hash'i (16 hex belgi).
    /// <para>⚠️ <c>Guid</c>, <c>DateTime.Now</c> yoki <c>string.GetHashCode()</c> ISHLATILMAYDI —
    /// bir xil hodisa qayta kelganda AYNAN bir xil kalit chiqishi shart, aks holda Meta'ning
    /// 36 soatlik qayta yuborishlari mijozga takroriy javob bo'lib ketardi.</para>
    /// </summary>
    public static string EventKeyOf(string kind, string commentId, string mid, string senderId, string timestamp, string text)
    {
        if (kind == IgConst.KindComment && !string.IsNullOrWhiteSpace(commentId))
            return $"comment:{commentId.Trim()}";
        if (!string.IsNullOrWhiteSpace(mid))
            return $"{kind}:{mid.Trim()}";
        return $"{kind}:{senderId}:{timestamp}:{Sha256Short(text)}";
    }

    private static string Sha256Short(string s)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(s ?? ""));
        var sb = new StringBuilder(16);
        for (var i = 0; i < 8; i++) sb.Append(bytes[i].ToString("x2"));
        return sb.ToString();
    }

    /* ---------------- yordamchilar ---------------- */

    /// <summary>Berilgan id bizga tegishlimi — saqlangan akkaunt id'si YOKI payloaddagi
    /// <c>entry.id</c> bilan mos kelsa (ID formatlari farq qilishi mumkin).</summary>
    /// <summary>
    /// Bu yozuv BIZNIKIMI — cheksiz halqa himoyasining 1-qavati.
    ///
    /// <para>To'rtta manba solishtiriladi: saqlangan IG id, saqlangan app-scoped id,
    /// payloaddagi <c>entry.id</c> (shu hodisa qaysi akkauntga tegishli) va zaxira sifatida
    /// <c>username</c> (registr e'tiborsiz). Bittasiga tayanish — halqaning aynan sababi
    /// (<c>marketing-instagram.md</c> §4).</para>
    /// </summary>
    private static bool IsOurs(string id, string username, IgSelf self, string entryId)
    {
        if (id.Length > 0)
        {
            if (self.IgUserId.Length > 0 && string.Equals(id, self.IgUserId, StringComparison.Ordinal)) return true;
            if (self.AppScopedId.Length > 0 && string.Equals(id, self.AppScopedId, StringComparison.Ordinal)) return true;
            if (entryId.Length > 0 && string.Equals(id, entryId, StringComparison.Ordinal)) return true;
        }
        // Zaxira: id formati kutilmagan bo'lsa ham o'z username'imizga javob yozmaymiz.
        return username.Length > 0 && self.Username.Length > 0
               && string.Equals(username.TrimStart('@'), self.Username.TrimStart('@'), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Meta vaqtini loyihaning ISO ko'rinishiga o'giradi ("yyyy-MM-ddTHH:mm:ss", MAHALLIY vaqt).
    ///
    /// <para>Meta ikki xil beradi: <c>entry.time</c> — epoch (soniya yoki millisekund),
    /// izoh <c>value.timestamp</c> — ISO satr. O'qib bo'lmasa BO'SH qaytadi va chaqiruvchi
    /// o'zining joriy vaqtiga qaytadi — noto'g'ri vaqt yozgandan ko'ra "noma'lum" yaxshiroq.</para>
    /// </summary>
    internal static string ToIso(string? raw)
    {
        var v = (raw ?? "").Trim();
        if (v.Length == 0) return "";

        if (long.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var num) && num > 0)
        {
            // 13 xonali — millisekund, 10 xonali — soniya (Meta ikkalasini ham ishlatadi).
            var utc = v.Length >= 12
                ? DateTimeOffset.FromUnixTimeMilliseconds(num)
                : DateTimeOffset.FromUnixTimeSeconds(num);
            return utc.ToLocalTime().ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        }

        return DateTimeOffset.TryParse(v, CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso)
            ? iso.ToLocalTime().ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture)
            : "";
    }

    private static string Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "") : "";

    private static string Raw(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind is JsonValueKind.Number or JsonValueKind.String
            ? v.ToString()
            : "";

    private static bool Bool(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    private static string Sub(JsonElement e, string obj, string name) =>
        e.TryGetProperty(obj, out var o) && o.ValueKind == JsonValueKind.Object ? Str(o, name) : "";
}
