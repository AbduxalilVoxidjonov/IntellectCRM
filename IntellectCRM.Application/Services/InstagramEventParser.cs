using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Meta webhook payloadidan ajratib olingan BITTA hodisa (normalizatsiyalangan ichki model).
/// </summary>
/// <param name="Kind"><c>comment</c> | <c>dm</c> | <c>echo</c>.</param>
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
    string SentAtIso = "");

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

    /* ---------------- izohlar (entry.changes[]) ---------------- */

    private static void ReadComments(
        JsonElement entry, string entryId, string entryTime, IgSelf self, List<IgIncomingEvent> outList)
    {
        if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array) return;

        foreach (var ch in changes.EnumerateArray())
        {
            if (ch.ValueKind != JsonValueKind.Object) continue;
            // `mentions`, `live_comments` va boshqa maydonlar qo'llab-quvvatlanmaydi — ular
            // tashlanadi, lekin hodisa navbatda `skipped` bo'lib ko'rinadi (jimgina yo'qolmaydi).
            if (Str(ch, "field") != "comments") continue;
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

            var kind = isEcho ? IgConst.KindEcho : IgConst.KindDm;
            var key = EventKeyOf(kind, "", mid, counterparty, ts, text);
            outList.Add(new IgIncomingEvent(kind, text, counterparty, "", "", "", mid, key, isEcho, ToIso(ts)));
        }
    }

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
