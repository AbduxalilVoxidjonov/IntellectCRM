using System.Globalization;
using IntellectCRM.Application.Dtos;

namespace IntellectCRM.Application.Services;

/// <summary>
/// LIDLAR (CRM) VORONKA ANALITIKASI hisob-kitobining <b>YAGONA MANBASI</b> — sof funksiyalar
/// (bazaga bog'liq emas, testlangan: <c>LeadAnalyticsTests</c>). Controller faqat ma'lumot yuklaydi.
///
/// <para><b>Asosiy qiyinchilik — tarix TO'LIQ EMAS.</b> Bosqich o'zgarishi ilgari faqat MATN
/// sifatida yozilardi (<c>LeadEvent.Text = "Bosqich: Yangi"</c>); <c>FromStage</c>/<c>ToStage</c>/
/// <c>ActorUserId</c> maydonlari keyin qo'shildi. Ya'ni ESKI lidlarda bosqich tarixi YO'Q.</para>
///
/// <para>Shu sababli ikki xil hisob bor:</para>
/// <list type="bullet">
///   <item><b>Voronka (<c>Reached</c>)</b> — tarixsiz ham ishlaydi: lidning JORIY bosqichi shu
///   bosqichdan past bo'lmasa, u bu bosqichdan o'tgan deb sanaladi (tarixda yozuv bo'lsa — u ham).
///   Shuning uchun voronka HAR DOIM to'la va pastga qarab kamayib boradi.</item>
///   <item><b>Bosqichda o'tirish vaqti va menejerlar kesimi</b> — FAQAT tarix bor lidlar bo'yicha.
///   Bu yerda taxmin qilinmaydi: o'lchov bo'lmasa <c>AvgHours = null</c>, va har qatorda
///   <c>Samples</c> qaytariladi — raqam nechta haqiqiy o'lchovga asoslangani ko'rinib tursin.</item>
/// </list>
/// </summary>
public static class LeadAnalytics
{
    /// <summary>Bosqich o'zgarishini bildiruvchi hodisa turlari (ToStage shularda to'ldiriladi).</summary>
    public const string TypeStage = "stage";
    public const string TypeCreated = "created";
    public const string TypeConvert = "convert";

    /// <summary>Manba yozilmagan lidlar uchun ko'rsatiladigan nom (<c>Stats()</c> bilan bir xil).</summary>
    public const string UnknownSourceLabel = "Noma'lum";

    /// <summary>Hisob uchun kerak bo'lgan lid maydonlari.</summary>
    /// <param name="CreatedAt">Yaratilgan vaqt (ISO "yyyy-MM-ddTHH:mm:ss") — davr filtri shu bo'yicha.</param>
    public readonly record struct LeadRow(
        string Id, string Stage, string Source, bool Converted, string CreatedAt);

    /// <summary>Hisob uchun kerak bo'lgan hodisa maydonlari (<c>LeadEvent</c>).</summary>
    public readonly record struct EventRow(
        string LeadId, string Type, string FromStage, string ToStage,
        string? ActorUserId, string ActorName, string CreatedAt);

    /// <summary>Bosqich (ustun) ma'lumotnomasi.</summary>
    public readonly record struct StageRow(string Id, string Title, string Color, int Order);

    /// <summary>Manba ma'lumotnomasi (<c>LeadSource</c>).</summary>
    public readonly record struct SourceRow(string Id, string Name);

    /* =========================================================================================
     *  DAVR FILTRI
     * ====================================================================================== */

    /// <summary>
    /// Lid shu davrga tushadimi. Sana ISO MATN ko'rinishida saqlanadi ("yyyy-MM-ddTHH:mm:ss"),
    /// shuning uchun solishtirish ordinal (leksikografik) — bu ISO uchun xronologik tartib bilan
    /// bir xil (loyihadagi boshqa sana solishtirishlari ham shunday).
    ///
    /// <para>Chegaralar QO'SHIB olinadi: <paramref name="from"/> va <paramref name="to"/> kunlarining
    /// o'zi ham kiradi (<c>to</c> — kun OXIRIGACHA).</para>
    /// </summary>
    public static bool InRange(string? createdAt, string? from, string? to)
    {
        var v = createdAt ?? "";
        if (v.Length < 10) return string.IsNullOrWhiteSpace(from) && string.IsNullOrWhiteSpace(to);
        var day = v[..10];
        if (!string.IsNullOrWhiteSpace(from) && string.CompareOrdinal(day, from!.Trim()) < 0) return false;
        if (!string.IsNullOrWhiteSpace(to) && string.CompareOrdinal(day, to!.Trim()) > 0) return false;
        return true;
    }

    /* =========================================================================================
     *  UMUMIY YIG'MA
     * ====================================================================================== */

    /// <summary>
    /// Butun analitika. <paramref name="allEvents"/> — barcha lid hodisalari (davr bo'yicha
    /// KESILMAYDI: davr LID yaratilgan sana bo'yicha tanlanadi, shu lidlarning BUTUN tarixi olinadi).
    /// <paramref name="userNames"/> — AppUser.Id → ism (bo'lmasa hodisadagi <c>ActorName</c> ishlatiladi).
    /// </summary>
    public static LeadAnalyticsDto Build(
        IEnumerable<LeadRow> allLeads,
        IEnumerable<EventRow> allEvents,
        IEnumerable<StageRow> stages,
        IEnumerable<SourceRow> sources,
        string? from = null,
        string? to = null,
        IReadOnlyDictionary<string, string>? userNames = null)
    {
        var leads = (allLeads ?? []).Where(l => InRange(l.CreatedAt, from, to)).ToList();
        var leadIds = leads.Select(l => l.Id).ToHashSet(StringComparer.Ordinal);
        // Davrdan tashqaridagi lidlarning hodisalari hisobga kirmasin.
        var events = (allEvents ?? []).Where(e => leadIds.Contains(e.LeadId)).ToList();

        var total = leads.Count;
        var converted = leads.Count(l => l.Converted);

        return new LeadAnalyticsDto(
            From: from ?? "",
            To: to ?? "",
            Total: total,
            Converted: converted,
            ConversionRate: Percent(converted, total),
            Funnel: BuildFunnel(leads, events, stages ?? []),
            Sources: BuildSources(leads, sources ?? []),
            Managers: BuildManagers(events, userNames));
    }

    /* =========================================================================================
     *  VORONKA
     * ====================================================================================== */

    /// <summary>
    /// Voronka bosqichlari (<c>Order</c> bo'yicha). Lid bosqichga YETIB KELGAN deb sanaladi, agar:
    /// <list type="number">
    ///   <item>uning JORIY bosqichi tartibi shu bosqich tartibidan past bo'lmasa (tarixsiz eski
    ///   lidlar uchun ham ishlaydi), YOKI</item>
    ///   <item>tarixda shu bosqichga o'tgani yozilgan bo'lsa (<c>ToStage == stageId</c>) — lid
    ///   keyin ORQAGA qaytarilgan bo'lsa ham o'tgani yo'qolmaydi.</item>
    /// </list>
    /// </summary>
    public static List<LeadFunnelStageDto> BuildFunnel(
        IEnumerable<LeadRow> leads, IEnumerable<EventRow> events, IEnumerable<StageRow> stages)
    {
        var leadList = leads as IReadOnlyList<LeadRow> ?? leads.ToList();
        var eventList = events as IReadOnlyList<EventRow> ?? events.ToList();
        var ordered = stages
            .OrderBy(s => s.Order)
            .ThenBy(s => s.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (ordered.Count == 0) return [];

        // Bosqich id → tartib. Lidning joriy bosqichi o'chirilgan bo'lishi mumkin — u holda
        // "joriy bosqich bo'yicha" qoida ishlamaydi, faqat tarix qoladi.
        var orderById = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var s in ordered) orderById[s.Id] = s.Order;

        // Lid → tarixda yetib kelgan bosqichlar.
        var reachedByLead = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var e in eventList)
        {
            if (string.IsNullOrEmpty(e.ToStage)) continue;
            if (!reachedByLead.TryGetValue(e.LeadId, out var set))
                reachedByLead[e.LeadId] = set = new HashSet<string>(StringComparer.Ordinal);
            set.Add(e.ToStage);
        }

        var durations = StageDurations(eventList);
        var total = leadList.Count;

        var result = new List<LeadFunnelStageDto>(ordered.Count);
        foreach (var s in ordered)
        {
            var reached = 0;
            foreach (var l in leadList)
            {
                if (orderById.TryGetValue(l.Stage, out var cur) && cur >= s.Order) { reached++; continue; }
                if (reachedByLead.TryGetValue(l.Id, out var set) && set.Contains(s.Id)) reached++;
            }

            durations.TryGetValue(s.Id, out var d);
            result.Add(new LeadFunnelStageDto(
                StageId: s.Id, Title: s.Title, Color: s.Color, Order: s.Order,
                Reached: reached,
                Pct: total == 0 ? 0 : reached * 100 / total,
                // Samples == 0 → o'lchov yo'q. Nol yoki taxminiy son EMAS, aynan null.
                AvgHours: d.Samples == 0 ? null : Math.Round(d.Hours / d.Samples, 1),
                Samples: d.Samples));
        }
        return result;
    }

    /// <summary>
    /// Har bir bosqich uchun unda o'tirilgan JAMI soat va o'lchovlar soni.
    ///
    /// <para>Har lidning bosqich hodisalari (<c>created</c> + <c>stage</c>, <c>ToStage</c> to'ldirilgani)
    /// vaqt bo'yicha tartiblanadi; KETMA-KET ikki hodisa bir oraliqni yopadi: oldingisining
    /// <c>ToStage</c> bosqichiga KIRDI, keyingisi paytida undan CHIQDI. Oxirgi hodisadan keyingi
    /// (ya'ni JORIY) bosqich hali tugamagan — u hisobga OLINMAYDI.</para>
    ///
    /// <para>Bir xil bosqichga takror o'tkazish (<c>ToStage</c> o'zgarmasa) oraliqni yopmaydi —
    /// bosqich almashmagan, demak chiqish bo'lmagan. Vaqti o'qib bo'lmaydigan yoki teskari
    /// (manfiy) oraliqlar tashlab yuboriladi.</para>
    /// </summary>
    public static Dictionary<string, (double Hours, int Samples)> StageDurations(IEnumerable<EventRow> events)
    {
        var acc = new Dictionary<string, (double Hours, int Samples)>(StringComparer.Ordinal);

        var byLead = events
            .Where(e => !string.IsNullOrEmpty(e.ToStage) && (e.Type == TypeStage || e.Type == TypeCreated))
            .GroupBy(e => e.LeadId, StringComparer.Ordinal);

        foreach (var g in byLead)
        {
            string? cur = null;
            var enteredAt = default(DateTime);
            foreach (var e in g.OrderBy(x => x.CreatedAt, StringComparer.Ordinal))
            {
                if (!TryTime(e.CreatedAt, out var t)) continue;
                if (cur is not null && !string.Equals(cur, e.ToStage, StringComparison.Ordinal))
                {
                    var hours = (t - enteredAt).TotalHours;
                    if (hours >= 0)
                    {
                        acc.TryGetValue(cur, out var prev);
                        acc[cur] = (prev.Hours + hours, prev.Samples + 1);
                    }
                }
                if (cur is null || !string.Equals(cur, e.ToStage, StringComparison.Ordinal))
                {
                    cur = e.ToStage;
                    enteredAt = t;
                }
            }
        }
        return acc;
    }

    /* =========================================================================================
     *  MANBALAR
     * ====================================================================================== */

    /// <summary>
    /// Manba kesmalari (ko'pidan kamiga). <c>Label</c> — <c>LeadSource</c> ma'lumotnomasidan:
    /// avval id bo'yicha, so'ng nom bo'yicha (registr farqisiz); topilmasa lidda yozilgan
    /// qiymatning o'zi. Bo'sh manba — <see cref="UnknownSourceLabel"/>.
    ///
    /// <para>Ro'yxat KESILMAYDI (limit yo'q) — kichik kesmalarni "Boshqa"ga yig'ishni frontend
    /// o'zi hal qiladi.</para>
    /// </summary>
    public static List<LeadSourceSliceDto> BuildSources(IEnumerable<LeadRow> leads, IEnumerable<SourceRow> sources)
    {
        var byId = new Dictionary<string, string>(StringComparer.Ordinal);
        var byName = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var s in sources)
        {
            var name = (s.Name ?? "").Trim();
            if (name.Length == 0) continue;
            if (!string.IsNullOrEmpty(s.Id)) byId[s.Id] = name;
            byName.TryAdd(name.ToLowerInvariant(), name);
        }

        string Label(string src)
        {
            if (src.Length == 0) return UnknownSourceLabel;
            if (byId.TryGetValue(src, out var n)) return n;
            if (byName.TryGetValue(src.ToLowerInvariant(), out var n2)) return n2;
            return src;
        }

        var leadList = leads as IReadOnlyList<LeadRow> ?? leads.ToList();
        var total = leadList.Count;

        return leadList
            .GroupBy(l => (l.Source ?? "").Trim(), StringComparer.Ordinal)
            .Select(g => new LeadSourceSliceDto(g.Key, Label(g.Key), g.Count(), Percent(g.Count(), total)))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /* =========================================================================================
     *  MENEJERLAR
     * ====================================================================================== */

    /// <summary>
    /// Menejerlar kesimi — <c>stage</c> VA <c>convert</c> hodisalari <c>ActorUserId</c> bo'yicha.
    ///
    /// <para><b>Nega ikkala tur ham?</b> Faqat <c>stage</c> bo'yicha guruhlansa, lidni o'quvchiga
    /// AYLANTIRGAN, lekin bosqichni o'zi ko'chirmagan menejer jadvalga umuman tushmasdi va uning
    /// <c>Won</c> i jimgina yo'qolardi — holbuki konversiya eng muhim ko'rsatkich. <c>Moves</c>
    /// baribir faqat bosqich ko'chirishlarini sanaydi (ta'rifi shu), ya'ni bunday menejerda 0 bo'ladi.</para>
    ///
    /// <para><c>ActorUserId</c> BO'SH yozuvlar butunlay TASHLAB YUBORILADI (ular "Noma'lum" qatoriga
    /// ham yig'ilmaydi): bu maydon eski hodisalarda yo'q, tizim yozgan hodisalarda esa (sayt formasi,
    /// daraja testi) menejer umuman yo'q — ularni bitta uyumga qo'shish yolg'on qator yasardi.</para>
    ///
    /// <para>Tartib: avval <c>Won</c> (natija), keyin <c>Moves</c> (faollik) — "samaradorlik"
    /// jadvalida yutuq faollikdan ustun turadi.</para>
    /// </summary>
    public static List<LeadManagerRowDto> BuildManagers(
        IEnumerable<EventRow> events, IReadOnlyDictionary<string, string>? userNames = null)
    {
        var list = events as IReadOnlyList<EventRow> ?? events.ToList();

        // "Won" — shu menejer o'quvchiga aylantirgan lidlar (bir lid faqat bir marta sanaladi).
        var wonByUser = list
            .Where(e => e.Type == TypeConvert && !string.IsNullOrWhiteSpace(e.ActorUserId))
            .GroupBy(e => e.ActorUserId!, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Select(e => e.LeadId).Distinct(StringComparer.Ordinal).Count(),
                StringComparer.Ordinal);

        return list
            .Where(e => (e.Type == TypeStage || e.Type == TypeConvert)
                        && !string.IsNullOrWhiteSpace(e.ActorUserId))
            .GroupBy(e => e.ActorUserId!, StringComparer.Ordinal)
            .Select(g => new LeadManagerRowDto(
                UserId: g.Key,
                Name: ResolveName(g.Key, g, userNames),
                // Faqat bosqich ko'chirishlari — `convert` bu yerda sanalmaydi.
                Moves: g.Count(e => e.Type == TypeStage),
                Leads: g.Select(e => e.LeadId).Distinct(StringComparer.Ordinal).Count(),
                Won: wonByUser.GetValueOrDefault(g.Key, 0)))
            .OrderByDescending(m => m.Won)
            .ThenByDescending(m => m.Moves)
            .ThenBy(m => m.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Menejer ismi: avval joriy ro'yxatdan (ism o'zgargan bo'lishi mumkin), aks holda
    /// hodisada yozilgan ENG SO'NGGI ism; u ham bo'lmasa — bo'sh (frontend id ko'rsatadi).</summary>
    private static string ResolveName(
        string userId, IEnumerable<EventRow> userEvents, IReadOnlyDictionary<string, string>? userNames)
    {
        if (userNames is not null && userNames.TryGetValue(userId, out var n) && !string.IsNullOrWhiteSpace(n))
            return n;
        return userEvents
            .Where(e => !string.IsNullOrWhiteSpace(e.ActorName))
            .OrderBy(e => e.CreatedAt, StringComparer.Ordinal)
            .Select(e => e.ActorName)
            .LastOrDefault() ?? "";
    }

    /* =========================================================================================
     *  KICHIK YORDAMCHILAR
     * ====================================================================================== */

    /// <summary>Yaxlitlangan foiz (0-100). Bo'luvchi 0 bo'lsa — 0.</summary>
    private static int Percent(int part, int total) =>
        total == 0 ? 0 : (int)Math.Round(part * 100.0 / total);

    /// <summary>ISO matn vaqtini o'qiydi. O'qib bo'lmasa — hodisa hisobga olinmaydi.</summary>
    private static bool TryTime(string? iso, out DateTime value) =>
        DateTime.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.None, out value);
}
