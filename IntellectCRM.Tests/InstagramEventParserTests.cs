using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// META WEBHOOK PAYLOADI PARSERI (<see cref="InstagramEventParser"/>) testlari.
/// Rasmiy manba: <c>.claude/rules/marketing-instagram.md</c> §4–§5.
///
/// <para>Payloadlar Meta yuboradigan HAQIQIY shaklda yozilgan (izoh — <c>entry[].changes[]</c>,
/// DM — <c>entry[].messaging[]</c>), chunki parser aynan shu tuzilishga tayanadi.</para>
///
/// <para>Ikkita qoida bu yerda QULFLANADI:
/// (1) <b>o'z izohimiz tashlanadi</b> — aks holda bot o'z javobiga javob yozib cheksiz halqaga
/// tushadi; (2) <b>dedup kaliti deterministik</b> — bir xil payload qayta kelganda AYNAN bir xil
/// kalit chiqishi shart (Meta muvaffaqiyatsiz yetkazishni 36 soat qayta yuboradi).</para>
/// </summary>
public class InstagramEventParserTests
{
    private const string OurId = "17841400000000000";
    private const string ClientId = "5550001112223";

    /// <summary>Izoh payloadi — Meta'ning haqiqiy shakli.</summary>
    private static string CommentPayload(
        string fromId = ClientId, string text = "Narxi qancha?", string commentId = "17900000000000001") => $$"""
        {
          "object": "instagram",
          "entry": [{
            "id": "{{OurId}}",
            "time": 1786500000,
            "changes": [{
              "field": "comments",
              "value": {
                "id": "{{commentId}}",
                "text": "{{text}}",
                "timestamp": "2026-08-12T09:15:00+0000",
                "from": { "id": "{{fromId}}", "username": "ali_valiyev" },
                "media": { "id": "18000000000000001", "media_product_type": "FEED" }
              }
            }]
          }]
        }
        """;

    /// <summary>DM payloadi (echo bayrog'i bilan yoki bo'lmasdan).</summary>
    private static string DmPayload(
        string senderId = ClientId, string text = "Salom, kurslar haqida", string mid = "aWdfZG1fMQ",
        bool isEcho = false, string? recipientId = null)
    {
        var recipient = recipientId ?? (isEcho ? ClientId : OurId);
        var echoFlag = isEcho ? ", \"is_echo\": true" : "";
        return $$"""
        {
          "object": "instagram",
          "entry": [{
            "id": "{{OurId}}",
            "time": 1786500001,
            "messaging": [{
              "sender": { "id": "{{senderId}}" },
              "recipient": { "id": "{{recipient}}" },
              "timestamp": 1786500001000,
              "message": { "mid": "{{mid}}", "text": "{{text}}"{{echoFlag}} }
            }]
          }]
        }
        """;
    }

    // ===================== 1) Izoh =====================

    [Fact]
    public void Izoh_hodisasi_oqiladi()
    {
        var ev = Assert.Single(InstagramEventParser.Parse(CommentPayload(), OurId));

        Assert.Equal(IgConst.KindComment, ev.Kind);
        Assert.Equal("Narxi qancha?", ev.Text);
        Assert.Equal(ClientId, ev.SenderId);
        Assert.Equal("ali_valiyev", ev.Username);
        Assert.Equal("17900000000000001", ev.CommentId);
        Assert.Equal("18000000000000001", ev.MediaId);
        Assert.False(ev.IsEcho);
    }

    [Fact]
    public void Izoh_kaliti_comment_id_dan_quriladi()
    {
        var ev = Assert.Single(InstagramEventParser.Parse(CommentPayload(), OurId));
        Assert.Equal("comment:17900000000000001", ev.EventKey);
    }

    [Fact]
    public void Matnsiz_izoh_ham_qaytariladi()
    {
        // Jimgina tashlab yuborilsa mijoz yo'qolardi — pipeline uni "operator kerak" qilib qo'yadi.
        var ev = Assert.Single(InstagramEventParser.Parse(CommentPayload(text: ""), OurId));
        Assert.Equal("", ev.Text);
    }

    [Fact]
    public void Qollab_quvvatlanmaydigan_field_tashlanadi()
    {
        // `mentions`, `live_comments` — ishlanmaydi (hodisa navbatda `skipped` bo'lib ko'rinadi).
        var json = CommentPayload().Replace("\"field\": \"comments\"", "\"field\": \"mentions\"");
        Assert.Empty(InstagramEventParser.Parse(json, OurId));
    }

    // ===================== 2) CHEKSIZ HALQA HIMOYASI =====================

    [Fact]
    public void Oz_izohimiz_tashlanadi()
    {
        // `from.id` bizning saqlangan akkaunt id'miz — bu bizning javobimiz, unga javob yozilmaydi.
        Assert.Empty(InstagramEventParser.Parse(CommentPayload(fromId: OurId), OurId));
    }

    [Fact]
    public void Oz_izohimiz_entry_id_bilan_ham_tanib_olinadi()
    {
        // Saqlangan id hali yo'q (akkaunt endi ulangan) — zaxira solishtiruv `entry.id` bo'yicha.
        Assert.Empty(InstagramEventParser.Parse(CommentPayload(fromId: OurId), ourIgUserId: ""));
    }

    [Fact]
    public void Ozimiz_yuborgan_DM_echo_deb_belgilanadi_bayroqsiz_ham()
    {
        // `is_echo` kelmasa ham jo'natuvchi biz bo'lsak — bu bizning xabarimiz.
        var ev = Assert.Single(InstagramEventParser.Parse(
            DmPayload(senderId: OurId, recipientId: ClientId), OurId));
        Assert.True(ev.IsEcho);
        Assert.Equal(IgConst.KindEcho, ev.Kind);
    }

    // ===================== 3) DM va echo =====================

    [Fact]
    public void DM_hodisasi_oqiladi()
    {
        var ev = Assert.Single(InstagramEventParser.Parse(DmPayload(), OurId));

        Assert.Equal(IgConst.KindDm, ev.Kind);
        Assert.Equal("Salom, kurslar haqida", ev.Text);
        Assert.Equal(ClientId, ev.SenderId);
        Assert.Equal("aWdfZG1fMQ", ev.IgMessageId);
        Assert.Equal("dm:aWdfZG1fMQ", ev.EventKey);
        Assert.False(ev.IsEcho);
        Assert.Equal("", ev.Username);   // DM'da username kelmaydi
    }

    [Fact]
    public void Echo_hodisasida_suhbatdosh_qabul_qiluvchi_boladi()
    {
        // ⚠️ Echo'da `sender` — BIZ. Pauza mijozning suhbatiga qo'yilishi kerak, ya'ni `recipient`.
        var ev = Assert.Single(InstagramEventParser.Parse(
            DmPayload(senderId: OurId, text: "Assalomu alaykum!", mid: "echo-1", isEcho: true), OurId));

        Assert.True(ev.IsEcho);
        Assert.Equal(IgConst.KindEcho, ev.Kind);
        Assert.Equal(ClientId, ev.SenderId);
        Assert.Equal("echo:echo-1", ev.EventKey);
    }

    [Fact]
    public void Xabar_bolmagan_hodisa_tashlanadi()
    {
        // `reaction` / `read` / `delivery` — xabar emas.
        var json = $$"""
            { "entry": [{ "id": "{{OurId}}", "messaging": [
                { "sender": {"id":"{{ClientId}}"}, "recipient": {"id":"{{OurId}}"},
                  "reaction": { "mid": "m1", "action": "react", "emoji": "❤️" } }
            ]}]}
            """;
        Assert.Empty(InstagramEventParser.Parse(json, OurId));
    }

    // ===================== 4) Bitta bodyda bir nechta hodisa =====================

    [Fact]
    public void Bitta_entry_ichida_izoh_ham_DM_ham_oqiladi()
    {
        // ⚠️ Ikkala massiv bitta `entry` ichida bo'lishi mumkin — parser IKKALASINI ko'radi.
        var json = $$"""
            {
              "object": "instagram",
              "entry": [{
                "id": "{{OurId}}",
                "time": 1786500000,
                "changes": [{ "field": "comments", "value": {
                    "id": "c-1", "text": "Izoh", "from": { "id": "{{ClientId}}", "username": "ali" } } } ],
                "messaging": [{
                    "sender": { "id": "{{ClientId}}" }, "recipient": { "id": "{{OurId}}" },
                    "timestamp": 1786500001000,
                    "message": { "mid": "m-1", "text": "DM" } }]
              }]
            }
            """;

        var list = InstagramEventParser.Parse(json, OurId);

        Assert.Equal(2, list.Count);
        Assert.Equal(IgConst.KindComment, list[0].Kind);
        Assert.Equal(IgConst.KindDm, list[1].Kind);
    }

    [Fact]
    public void Bir_nechta_entry_ham_oqiladi()
    {
        var json = $$"""
            { "entry": [
              { "id": "{{OurId}}", "changes": [{ "field": "comments", "value": {
                  "id": "c-1", "text": "Birinchi", "from": { "id": "{{ClientId}}" } } } ] },
              { "id": "{{OurId}}", "changes": [{ "field": "comments", "value": {
                  "id": "c-2", "text": "Ikkinchi", "from": { "id": "999" } } } ] }
            ]}
            """;

        var list = InstagramEventParser.Parse(json, OurId);

        Assert.Equal(2, list.Count);
        Assert.Equal(new[] { "comment:c-1", "comment:c-2" }, list.Select(e => e.EventKey).ToArray());
    }

    // ===================== 5) Buzuq / kutilmagan JSON =====================

    [Theory]
    [InlineData("{buzuq")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("[]")]                       // massiv — obyekt kutilgan
    [InlineData("\"shunchaki matn\"")]
    [InlineData("{}")]                       // `entry` yo'q
    [InlineData("{\"entry\": {}}")]          // `entry` massiv emas
    [InlineData("{\"entry\": [null, 5]}")]   // elementlar obyekt emas
    public void Buzuq_yoki_kutilmagan_JSON_bosh_royxat_qaytaradi(string raw)
    {
        // ⚠️ Istisno OTILMAYDI: bitta noto'g'ri payload butun navbatni to'xtatib qo'ymasin.
        Assert.Empty(InstagramEventParser.Parse(raw, OurId));
    }

    [Fact]
    public void Taniqli_id_siz_izoh_tashlanadi()
    {
        var json = "{\"entry\":[{\"id\":\"" + OurId + "\",\"changes\":[{\"field\":\"comments\"," +
                   "\"value\":{\"text\":\"kim yozdi noma'lum\"}}]}]}";
        Assert.Empty(InstagramEventParser.Parse(json, OurId));
    }

    // ===================== 6) DEDUP KALITI — DETERMINISTIK =====================

    [Fact]
    public void Bir_xil_payload_ikki_marta_parse_qilinsa_kalit_bir_xil()
    {
        // ⚠️ Kalit `Guid`/`Random`/`GetHashCode()` ga tayanmaydi — aks holda restartdan keyin
        // dedup umuman ishlamasdi va Meta'ning qayta yuborishlari takroriy javobga aylanardi.
        var json = DmPayload();
        var birinchi = Assert.Single(InstagramEventParser.Parse(json, OurId)).EventKey;
        var ikkinchi = Assert.Single(InstagramEventParser.Parse(json, OurId)).EventKey;

        Assert.Equal(birinchi, ikkinchi);
    }

    [Fact]
    public void Kalit_id_siz_hodisada_ham_takrorlanadigan_hash()
    {
        // `comment_id` ham, `mid` ham yo'q — kalit jo'natuvchi + vaqt + matn hash'idan.
        var a = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "", "555", "1786500000", "Salom");
        var b = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "", "555", "1786500000", "Salom");

        Assert.Equal(a, b);
        Assert.StartsWith("dm:555:1786500000:", a);
    }

    [Fact]
    public void Turli_hodisa_turli_kalit_beradi()
    {
        var izoh = InstagramEventParser.EventKeyOf(IgConst.KindComment, "c-1", "", "555", "1", "Salom");
        var boshqaIzoh = InstagramEventParser.EventKeyOf(IgConst.KindComment, "c-2", "", "555", "1", "Salom");
        var dm = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "m-1", "555", "1", "Salom");

        Assert.NotEqual(izoh, boshqaIzoh);
        Assert.NotEqual(izoh, dm);
    }

    [Fact]
    public void Kalit_matn_ozgarsa_ozgaradi()
    {
        var a = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "", "555", "1", "Salom");
        var b = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "", "555", "1", "Salom!");
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Echo_va_DM_bir_xil_mid_da_turli_kalit_beradi()
    {
        // Aks holda bizning javobimiz mijozning xabari bilan bir hodisa deb sanalardi.
        var dm = InstagramEventParser.EventKeyOf(IgConst.KindDm, "", "m-1", "555", "1", "x");
        var echo = InstagramEventParser.EventKeyOf(IgConst.KindEcho, "", "m-1", "555", "1", "x");
        Assert.NotEqual(dm, echo);
    }
}
