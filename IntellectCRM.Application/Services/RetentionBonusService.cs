using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'QUVCHINI USHLAB TURISH BONUSI — butun mantiqning YAGONA joyi (jadval, sikl holati,
/// taqsimot, bonus berish/bekor qilish). Controller ham, kelajakdagi har qanday chaqiruvchi ham
/// shu orqali o'tadi (<see cref="BookSalesService"/> uslubida static xizmat).
///
/// <para><b>Maqsad:</b> o'quvchini markazda uzoq muddat ushlab turgan o'qituvchi(lar)ni
/// rag'batlantirish. O'quvchi <c>CenterMeta.RetentionMonthsRequired</c> (default 6) oy uzluksiz
/// o'qib to'lasa — uni o'qitgan o'qituvchi(lar)ga bonus ajratiladi, o'qigan oylar NISBATIDA.</para>
///
/// <para><b>Asosiy tamoyil:</b> bonus <i>ushlab turgani</i> uchun beriladi, <i>o'z vaqtida
/// to'laganligi</i> uchun emas. Shu sabab kechikkan to'lov siklni BUZMAYDI — u faqat tugma
/// chiqishini kechiktiradi.</para>
///
/// <para><b>Hech narsa saqlanmaydi</b> (faqat yakuniy <see cref="RetentionBonusAward"/>): oylik
/// kataklar har so'rovda qayta hisoblanadi. Superadmin <see cref="MonthlyCharge"/>ni tahrirlashi,
/// to'lov tuzatilishi yoki vozvrat qilinishi mumkin — saqlansa jadval haqiqatdan uzilib qolardi.
/// Sentabr to'lovi yanvarda kelsa, sentabr katagi O'Z-O'ZIDAN ✅ ga aylanadi (maosh —
/// <c>SalaryLedger</c> — ham aynan shunday ishlaydi).</para>
///
/// <para><b>Pul chiqimi EMAS:</b> «Bonus berish» — hisoblash/qayd. Haqiqiy pul odatdagi maosh
/// to'lovi (<c>FinanceTransaction</c> expense/salary) orqali beriladi va bonus <c>SalaryLedger</c>
/// ga ULANMAYDI — Moliya, Kassa va Chiqimlar raqamlari o'zgarmaydi.</para>
/// </summary>
public static class RetentionBonusService
{
    /* ---------- Oy katagi holatlari (DTO'dagi State) ---------- */
    /// <summary>✅ pullik a'zolik bor + qarz yo'q → sanoqqa +1.</summary>
    public const string StatePaid = "paid";
    /// <summary>⏳ pullik a'zolik bor + qarz bor → +0, LEKIN sikl uzilmaydi.</summary>
    public const string StateDebt = "debt";
    /// <summary>❄️ muzlatilgan (ta'til yoki guruh almashtirish) → pauza.</summary>
    public const string StateFrozen = "frozen";
    /// <summary>🚪 pullik a'zolik umuman yo'q → pauza.</summary>
    public const string StateGone = "gone";

    /* ---------- Qator holatlari (DTO'dagi Status) ---------- */
    public const string RowNotStarted = "notstarted";
    public const string RowProgress = "progress";
    public const string RowReady = "ready";
    public const string RowBroken = "broken";

    private static readonly string[] DayShort = ["Du", "Se", "Cho", "Pay", "Ju", "Sha", "Yak"];

    /// <summary>Hisobot uchun kerakli guruh maydonlari (butun <see cref="Group"/> yuklanmaydi).</summary>
    private sealed record GroupInfo(string Id, string Name, decimal MonthlyFee, string TeacherId, List<int> Days);

    /* ==================== SOZLAMALAR ==================== */

    /// <summary>
    /// Sozlamalar — himoyalangan o'qish. <c>MonthsRequired == 0</c> "sozlanmagan" degani
    /// (migratsiyagacha yaratilgan qator) va 6 ga tushiriladi: 0 qolsa har bir o'quvchi darhol
    /// "tayyor" bo'lib chiqardi.
    /// </summary>
    public static RetentionSettingsDto Settings(CenterMeta? meta) => new(
        MonthsRequired: (meta?.RetentionMonthsRequired ?? 0) <= 0
            ? 6 : Math.Min(meta!.RetentionMonthsRequired, 36),
        MaxGapMonths: Math.Clamp(meta?.RetentionMaxGapMonths ?? 2, 0, 12),
        DefaultAmount: Math.Max(0m, meta?.RetentionDefaultAmount ?? 0m));

    /* ==================== HISOBOT ==================== */

    /// <summary>
    /// Bonus hisoboti jadvali — ptichkasi yoqilgan BARCHA o'quvchilar uchun (yoki
    /// <paramref name="onlyStudentId"/> berilsa faqat bittasi — bonus berishda qayta tekshirish).
    ///
    /// <para>Barcha ma'lumot OMMAVIY yuklanadi (o'quvchi boshiga alohida so'rov YO'Q — N+1
    /// bo'lmasin); ptichkali o'quvchilar soni kam bo'lgani uchun bu yetarli.</para>
    /// </summary>
    public static async Task<RetentionReportDto> BuildReportAsync(
        IAppDbContext db, string? onlyStudentId = null, CancellationToken ct = default)
    {
        var meta = await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync(ct);
        var settings = Settings(meta);

        var q = db.Students.AsNoTracking().Where(s => s.RetentionBonus);
        if (onlyStudentId is not null) q = q.Where(s => s.Id == onlyStudentId);
        var students = await q
            .Select(s => new { s.Id, s.FullName, s.IsArchived, s.ArchivedAt, s.RetentionBonusStartMonth })
            .ToListAsync(ct);
        if (students.Count == 0) return new RetentionReportDto([], settings, 0);

        var ids = students.Select(s => s.Id).ToList();

        var memberships = await db.StudentGroups.AsNoTracking()
            .Where(m => ids.Contains(m.StudentId)).ToListAsync(ct);
        var groupIds = memberships.Select(m => m.GroupId)
            .Where(g => !string.IsNullOrEmpty(g)).Distinct().ToList();
        var groupById = (await db.Classes.AsNoTracking()
                .Where(c => groupIds.Contains(c.Id))
                .Select(c => new GroupInfo(c.Id, c.Name, c.MonthlyFee, c.TeacherId, c.Days))
                .ToListAsync(ct))
            .ToDictionary(g => g.Id);

        // Oy bo'yicha JAMI hisoblangan (chegirma ayirilgan). Savol "shu oyda o'quvchi qarzdormi" —
        // per-guruh emas, o'quvchi darajasida (reja §5.1).
        var chargedBy = (await db.MonthlyCharges.AsNoTracking()
                .Where(c => ids.Contains(c.StudentId))
                .Select(c => new { c.StudentId, c.Month, c.Amount, c.Discount })
                .ToListAsync(ct))
            .GroupBy(c => (c.StudentId, c.Month))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount - x.Discount));

        // To'lovlar — QAYSI OY UCHUN to'langani (t.Month) bo'yicha; vozvrat MANFIY qo'shiladi.
        // DIQQAT: SalaryLedger t.Date bo'yicha yig'adi — u "shu oyda qancha pul TUSHDI" ni
        // so'raydi; bu yerda esa "falon oy YOPILDIMI" — boshqa savol, shuning uchun Month.
        var paidBy = (await db.FinanceTransactions.AsNoTracking()
                .Where(t => t.StudentId != null && ids.Contains(t.StudentId) && t.Month != null
                            && ((t.Direction == "income" && t.Category == "tuition")
                                || (t.Direction == "expense" && t.Category == "refund")))
                .Select(t => new { StudentId = t.StudentId!, Month = t.Month!, t.Amount, t.Direction })
                .ToListAsync(ct))
            .GroupBy(t => (t.StudentId, t.Month))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Direction == "expense" ? -x.Amount : x.Amount));

        var history = await GroupTeacherHistory.LoadAsync(db, groupIds, ct);

        var teacherIds = groupById.Values.Select(g => g.TeacherId)
            .Concat(history.Values.SelectMany(v => v.Select(a => a.TeacherId)))
            .Where(t => !string.IsNullOrEmpty(t)).Distinct().ToList();
        var teacherNames = (await db.Teachers.AsNoTracking()
                .Where(t => teacherIds.Contains(t.Id))
                .Select(t => new { t.Id, t.FullName }).ToListAsync(ct))
            .ToDictionary(t => t.Id, t => t.FullName);

        var awards = await db.RetentionBonusAwards.AsNoTracking()
            .Where(a => ids.Contains(a.StudentId)).ToListAsync(ct);
        var awardIds = awards.Select(a => a.Id).ToList();
        var sharesByAward = (await db.RetentionBonusShares.AsNoTracking()
                .Where(s => awardIds.Contains(s.AwardId)).ToListAsync(ct))
            .GroupBy(s => s.AwardId).ToDictionary(g => g.Key, g => g.ToList());
        var awardsByStudent = awards.GroupBy(a => a.StudentId)
            .ToDictionary(g => g.Key, g => g.OrderBy(a => a.CycleNo).ToList());

        var membsByStudent = memberships.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var currentMonth = TuitionService.CurrentMonth();
        var rows = new List<RetentionRowDto>();

        foreach (var s in students)
        {
            var membs = membsByStudent.GetValueOrDefault(s.Id, []);
            var studentAwards = awardsByStudent.GetValueOrDefault(s.Id, []);

            var awardDtos = studentAwards.Select(a => new RetentionAwardDto(
                a.Id, a.StudentId, a.StudentName, a.CycleNo, a.PeriodFrom, a.PeriodTo,
                a.TotalAmount, a.Status, a.CancelReason, a.CreatedAt, a.GivenBy, a.Note,
                sharesByAward.GetValueOrDefault(a.Id, [])
                    .Select(x => new RetentionShareDto(x.TeacherId, x.TeacherName, x.Months, x.Amount))
                    .ToList())).ToList();

            // Joriy sikl raqami — bekor qilinmagan bonuslardan keyingisi.
            var cycleNo = studentAwards.Count(a => a.Status == RetentionBonusAward.StatusGiven) + 1;

            // Ko'rsatish uchun: hozirgi faol guruhlar va ularning dars kunlari.
            var activeGroups = membs
                .Where(m => m.IsActive && m.Status != "frozen" && groupById.ContainsKey(m.GroupId))
                .Select(m => groupById[m.GroupId]).ToList();
            var groupNames = string.Join(", ", activeGroups.Select(g => g.Name).Distinct());
            var days = string.Join(" · ", activeGroups
                .Select(g => FormatDays(g.Days)).Where(d => d != "").Distinct());

            var startMonth = (s.RetentionBonusStartMonth ?? "").Trim();
            if (startMonth.Length < 7)
            {
                rows.Add(new RetentionRowDto(
                    s.Id, s.FullName, groupNames, days, "", cycleNo, [], 0, settings.MonthsRequired,
                    RowNotStarted, "Boshlanish oyi kiritilmagan", s.IsArchived, [], awardDtos));
                continue;
            }
            startMonth = startMonth[..7];

            var walk = Walk(s.Id, startMonth, currentMonth, settings, membs, groupById, history,
                            teacherNames, chargedBy, paidBy, s.IsArchived, s.ArchivedAt);

            // Tayyor bo'lsa — taxminiy taqsimot: standart summa bo'yicha oldindan hisoblanadi
            // (admin modalda summani ham, ulushlarni ham o'zgartira oladi; summa o'zgarsa klient
            // Months nisbatida qayta bo'ladi).
            var shareDtos = walk.Status == RowReady
                ? Distribute(walk.Cells, membs, groupById, history, teacherNames, settings.DefaultAmount)
                : [];

            rows.Add(new RetentionRowDto(
                s.Id, s.FullName, groupNames, days, startMonth, cycleNo,
                walk.Cells, walk.Counted, settings.MonthsRequired,
                walk.Status, walk.Note, s.IsArchived, shareDtos, awardDtos));
        }

        rows = [.. rows
            .OrderByDescending(r => r.Status == RowReady)
            .ThenByDescending(r => r.Counted)
            .ThenBy(r => r.FullName, StringComparer.OrdinalIgnoreCase)];

        return new RetentionReportDto(rows, settings, rows.Count(r => r.Status == RowReady));
    }

    /* ==================== SIKL MANTIG'I ==================== */

    private sealed record WalkResult(List<RetentionMonthCellDto> Cells, int Counted, string Status, string Note);

    /// <summary>
    /// Boshlanish oyidan joriy oygacha yurib har oyning holatini aniqlaydi va siklni baholaydi.
    ///
    /// <para><b>Tekshiruv O'QUVCHI darajasida, a'zolik darajasida EMAS.</b> Guruh almashtirishda
    /// (<c>ClassesController.TransferMember</c>) eski a'zolik MUZLATILADI va yangisi ochiladi —
    /// ya'ni "muzlatilgan" belgisi "markazdan ketdi" degani emas. Shuning uchun savol
    /// <i>"shu oyda o'quvchining KAMIDA BITTA pullik a'zoligi bormi?"</i> bo'ladi va guruh
    /// almashtirish ham, yangi kurs qo'shish ham siklni buzmaydi.</para>
    ///
    /// <para>Qoidalar: ✅ → +1 · ⏳ (qarz) → +0, lekin sikl uzilmaydi va pauza ham emas (o'quvchi
    /// shu oyda O'QIGAN) · ❄️/🚪 → pauza, ketma-ket <c>MaxGapMonths</c> dan oshsa UZILADI ·
    /// 🔴 arxivlangan → DARHOL uziladi (aniq signal, 2 oy kutilmaydi).</para>
    /// </summary>
    private static WalkResult Walk(
        string studentId, string startMonth, string currentMonth, RetentionSettingsDto settings,
        List<StudentGroup> membs,
        Dictionary<string, GroupInfo> groupById,
        Dictionary<string, List<GroupTeacherAssignment>> history,
        Dictionary<string, string> teacherNames,
        Dictionary<(string, string), decimal> chargedBy,
        Dictionary<(string, string), decimal> paidBy,
        bool isArchived, string? archivedAt)
    {
        var cells = new List<RetentionMonthCellDto>();
        var counted = 0;
        var gap = 0;
        var archiveMonth = (archivedAt ?? "").Length >= 7 ? archivedAt![..7] : null;

        if (string.CompareOrdinal(startMonth, currentMonth) > 0)
            return new WalkResult(cells, 0, RowProgress, "Boshlanish oyi hali kelmagan");

        foreach (var month in TuitionService.MonthRange(startMonth, currentMonth))
        {
            // Arxivlash — aniq signal: o'quvchi ketdi, 2 oy kutib o'tirilmaydi.
            if (isArchived && (archiveMonth is null || string.CompareOrdinal(month, archiveMonth) >= 0))
                return new WalkResult(cells, counted, RowBroken,
                    archiveMonth is null ? "O'quvchi arxivlangan" : $"O'quvchi arxivlangan ({archiveMonth})");

            var billable = membs.Where(m => MembershipLifecycle.BillableInMonth(m, month)).ToList();
            var (tid, tname) = TeachersOfMonth(billable, groupById, history, teacherNames, month);

            if (billable.Count == 0)
            {
                // Muzlatilgan (ta'til) va butunlay ketgan — ikkalasi ham PAUZA; farqi ko'rinishda.
                // Muzlashning ham chegarasi bor: 8 oy muzlab yotgan o'quvchi bonus keltirsa
                // tizimning ma'nosi qolmaydi (qaror #2 — pauza, maks MaxGapMonths oy).
                var frozen = membs.Any(m => m.Status == "frozen" && m.FrozenAt.Length >= 7
                                            && string.CompareOrdinal(month, m.FrozenAt[..7]) >= 0);
                cells.Add(new RetentionMonthCellDto(month, frozen ? StateFrozen : StateGone, 0m, 0m, tid, tname, false));
                gap++;
                if (gap > settings.MaxGapMonths)
                    return new WalkResult(cells, counted, RowBroken,
                        $"{gap} oy uzluksiz {(frozen ? "muzlatilgan" : "a'zolik yo'q")} — ruxsat {settings.MaxGapMonths} oy");
                continue;
            }

            gap = 0;
            var charged = chargedBy.GetValueOrDefault((studentId, month), 0m);
            var paid = paidBy.GetValueOrDefault((studentId, month), 0m);
            var closed = charged - paid <= 0m;
            cells.Add(new RetentionMonthCellDto(month, closed ? StatePaid : StateDebt, charged, paid, tid, tname, closed));

            if (!closed) continue;
            counted++;
            if (counted >= settings.MonthsRequired)
                return new WalkResult(cells, counted, RowReady, "Bonus berish mumkin");
        }

        return new WalkResult(cells, counted, RowProgress, $"{counted}/{settings.MonthsRequired}");
    }

    /* ==================== TAQSIMOT ==================== */

    /// <summary>
    /// Bonusni o'qituvchilar orasida O'QIGAN OYLAR nisbatida bo'ladi.
    ///
    /// <para>Har HISOBGA KIRGAN oy vazni 1.0; o'quvchi bir vaqtda bir nechta guruhda o'qisa —
    /// oy vazni a'zoliklar orasida <c>MonthlyFee</c> nisbatida bo'linadi (teglanmagan to'lovni
    /// taqsimlash bilan AYNAN BIR XIL konvensiya — <c>SalaryLedger</c>, <c>GroupBalanceService</c>).
    /// Har a'zolik → guruh → O'SHA OYDAGI o'qituvchi (<see cref="GroupTeacherHistory"/>; tarix
    /// topilmasa <c>Group.TeacherId</c> ga fallback).</para>
    ///
    /// <para>Yaxlitlash qoldig'i eng katta ulushli o'qituvchiga qo'shiladi — ulushlar yig'indisi
    /// <paramref name="totalAmount"/> ga ANIQ teng chiqsin.</para>
    /// </summary>
    private static List<RetentionShareDto> Distribute(
        List<RetentionMonthCellDto> cells, List<StudentGroup> membs,
        Dictionary<string, GroupInfo> groupById,
        Dictionary<string, List<GroupTeacherAssignment>> history,
        Dictionary<string, string> teacherNames,
        decimal totalAmount)
    {
        var weight = new Dictionary<string, decimal>();
        foreach (var c in cells.Where(x => x.Counted))
        {
            var billable = membs.Where(m => MembershipLifecycle.BillableInMonth(m, c.Month)).ToList();
            if (billable.Count == 0) continue;
            var denom = billable.Sum(m => FeeOf(m.GroupId, groupById));
            foreach (var m in billable)
            {
                var tid = TeacherFor(m.GroupId, c.Month, groupById, history);
                if (string.IsNullOrEmpty(tid)) continue;
                // Narxlar noma'lum (hammasi 0) bo'lsa — teng bo'linadi, oy vazni baribir 1.0 qoladi.
                var share = denom > 0 ? FeeOf(m.GroupId, groupById) / denom : 1m / billable.Count;
                weight[tid] = weight.GetValueOrDefault(tid) + share;
            }
        }

        var totalWeight = weight.Values.Sum();
        if (weight.Count == 0 || totalWeight <= 0) return [];

        var ordered = weight.OrderByDescending(kv => kv.Value)
            .ThenBy(kv => teacherNames.GetValueOrDefault(kv.Key, ""), StringComparer.OrdinalIgnoreCase)
            .ToList();

        var list = ordered.Select(kv => new RetentionShareDto(
                kv.Key,
                teacherNames.GetValueOrDefault(kv.Key, "(o'chirilgan o'qituvchi)"),
                decimal.Round(kv.Value, 4),
                decimal.Round(totalAmount * kv.Value / totalWeight, 0, MidpointRounding.AwayFromZero)))
            .ToList();

        // Yaxlitlash qoldig'i — eng katta ulushga (ro'yxat kamayish tartibida).
        var diff = totalAmount - list.Sum(x => x.Amount);
        if (diff != 0m)
            list[0] = list[0] with { Amount = list[0].Amount + diff };

        return list;
    }

    private static decimal FeeOf(string groupId, Dictionary<string, GroupInfo> groupById) =>
        groupById.TryGetValue(groupId, out var g) ? g.MonthlyFee : 0m;

    /// <summary>Guruhning shu oydagi o'qituvchisi — tarixdan; topilmasa hozirgi biriktirilgani.</summary>
    private static string TeacherFor(
        string groupId, string month,
        Dictionary<string, GroupInfo> groupById,
        Dictionary<string, List<GroupTeacherAssignment>> history)
    {
        var fromHistory = GroupTeacherHistory.TeacherAtMonth(history.GetValueOrDefault(groupId), month);
        if (!string.IsNullOrEmpty(fromHistory)) return fromHistory;
        return groupById.TryGetValue(groupId, out var g) ? g.TeacherId : "";
    }

    /// <summary>Oy katagi ostida ko'rsatiladigan o'qituvchi(lar): eng katta narxli guruhniki
    /// birinchi, bir nechta bo'lsa hammasi vergul bilan.</summary>
    private static (string Id, string Name) TeachersOfMonth(
        List<StudentGroup> billable,
        Dictionary<string, GroupInfo> groupById,
        Dictionary<string, List<GroupTeacherAssignment>> history,
        Dictionary<string, string> teacherNames,
        string month)
    {
        var byTeacher = new Dictionary<string, decimal>();
        foreach (var m in billable)
        {
            var tid = TeacherFor(m.GroupId, month, groupById, history);
            if (string.IsNullOrEmpty(tid)) continue;
            byTeacher[tid] = byTeacher.GetValueOrDefault(tid) + FeeOf(m.GroupId, groupById);
        }
        if (byTeacher.Count == 0) return ("", "");
        var ordered = byTeacher.OrderByDescending(kv => kv.Value).Select(kv => kv.Key).ToList();
        return (ordered[0], string.Join(", ", ordered.Select(id => teacherNames.GetValueOrDefault(id, "—"))));
    }

    /* ==================== BONUS BERISH ==================== */

    /// <summary>
    /// Bonusni yozadi: <see cref="RetentionBonusAward"/> + har o'qituvchi uchun
    /// <see cref="RetentionBonusShare"/>, va o'quvchining sanog'ini KEYINGI siklga suradi
    /// (<c>RetentionBonusStartMonth</c> = davr oxiridan keyingi oy) — aks holda o'sha sikl
    /// jadvalda «tayyor» bo'lib turaverardi.
    ///
    /// <para>Holat qayta tekshiriladi (<see cref="BuildReportAsync"/> orqali, AYNAN o'sha mantiq):
    /// ikki admin bir vaqtda bosgan yoki jadval eskirgan bo'lsa xato qaytadi.
    /// Qo'shimcha himoya — <c>(StudentId, CycleNo)</c> unikal indeksi.</para>
    ///
    /// <para><c>SaveChangesAsync</c> chaqirilmaydi — chaqiruvchi saqlaydi.</para>
    /// </summary>
    /// <returns>Xato bo'lsa (Award=null, Error=sabab).</returns>
    public static async Task<(RetentionBonusAward? Award, string? Error)> GiveAsync(
        IAppDbContext db, GiveRetentionBonusRequest req, string actor, CancellationToken ct = default)
    {
        if (req.TotalAmount <= 0m) return (null, "Bonus summasi 0 dan katta bo'lishi kerak");

        var report = await BuildReportAsync(db, req.StudentId, ct);
        var row = report.Rows.FirstOrDefault();
        if (row is null) return (null, "O'quvchi topilmadi yoki bonus ptichkasi yoqilmagan");
        if (row.Status != RowReady)
            return (null, $"Sikl hali tayyor emas ({row.Counted}/{row.Required}) — {row.StatusNote}");
        if (row.Months.Count == 0) return (null, "Davr aniqlanmadi");

        var shares = (req.Shares ?? []).Where(s => !string.IsNullOrWhiteSpace(s.TeacherId)).ToList();
        if (shares.Count == 0) return (null, "Taqsimot bo'sh — kamida bitta o'qituvchi bo'lishi kerak");
        if (shares.Any(s => s.Amount < 0m)) return (null, "Ulush manfiy bo'lishi mumkin emas");
        if (shares.Sum(s => s.Amount) != req.TotalAmount)
            return (null, $"Taqsimot yig'indisi ({shares.Sum(s => s.Amount):N0}) jami summaga ({req.TotalAmount:N0}) teng emas");

        var teacherIds = shares.Select(s => s.TeacherId).Distinct().ToList();
        if (teacherIds.Count != shares.Count) return (null, "Bir o'qituvchi ikki marta ko'rsatilgan");
        var names = (await db.Teachers.AsNoTracking()
                .Where(t => teacherIds.Contains(t.Id))
                .Select(t => new { t.Id, t.FullName }).ToListAsync(ct))
            .ToDictionary(t => t.Id, t => t.FullName);
        if (names.Count != teacherIds.Count) return (null, "Ko'rsatilgan o'qituvchilardan biri topilmadi");

        var student = await db.Students.FirstOrDefaultAsync(s => s.Id == req.StudentId, ct);
        if (student is null) return (null, "O'quvchi topilmadi");

        var periodTo = row.Months[^1].Month;
        var award = new RetentionBonusAward
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            CycleNo = row.CycleNo,
            PeriodFrom = row.StartMonth,
            PeriodTo = periodTo,
            TotalAmount = req.TotalAmount,
            Status = RetentionBonusAward.StatusGiven,
            GivenBy = actor,
            Note = (req.Note ?? "").Trim(),
        };
        db.RetentionBonusAwards.Add(award);

        foreach (var s in shares)
            db.RetentionBonusShares.Add(new RetentionBonusShare
            {
                AwardId = award.Id,
                TeacherId = s.TeacherId,
                TeacherName = names[s.TeacherId],
                Months = decimal.Round(s.Months, 4),
                Amount = s.Amount,
            });

        // Keyingi sikl davr oxiridan KEYINGI oydan boshlanadi — uzluksiz zanjir.
        // (Admin bu oyni o'quvchi formasida istalgan payt o'zgartira oladi.)
        student.RetentionBonusStartMonth = TuitionService.NextMonth(periodTo);

        return (award, null);
    }

    /// <summary>
    /// Bonusni bekor qiladi (xato kiritilgan bo'lsa). Yozuv O'CHIRILMAYDI — "cancelled" bo'lib
    /// tarixda qoladi, ulushlari ham (o'qituvchi profilida "bekor qilingan" belgisi bilan ko'rinadi).
    /// O'quvchining sanog'i davr boshiga QAYTARILADI — sikl yana "tayyor" bo'lib chiqadi.
    /// </summary>
    public static async Task<string?> CancelAsync(
        IAppDbContext db, string awardId, string? reason, CancellationToken ct = default)
    {
        var award = await db.RetentionBonusAwards.FirstOrDefaultAsync(a => a.Id == awardId, ct);
        if (award is null) return "Bonus topilmadi";
        if (award.Status == RetentionBonusAward.StatusCancelled) return "Bonus allaqachon bekor qilingan";

        award.Status = RetentionBonusAward.StatusCancelled;
        award.CancelReason = (reason ?? "").Trim();

        var student = await db.Students.FirstOrDefaultAsync(s => s.Id == award.StudentId, ct);
        if (student is not null) student.RetentionBonusStartMonth = award.PeriodFrom;
        return null;
    }

    /// <summary>Uzilgan (yoki istalgan) siklni yangi oydan qayta boshlash.</summary>
    public static async Task<string?> RestartAsync(
        IAppDbContext db, string studentId, string startMonth, CancellationToken ct = default)
    {
        var month = (startMonth ?? "").Trim();
        if (month.Length < 7 || !DateOnly.TryParse($"{month[..7]}-01", out _))
            return "Boshlanish oyi noto'g'ri (kutilgan: YYYY-MM)";

        var student = await db.Students.FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null) return "O'quvchi topilmadi";

        student.RetentionBonus = true;
        student.RetentionBonusStartMonth = month[..7];
        return null;
    }

    /* ==================== O'QITUVCHI KESIMI ==================== */

    /// <summary>Bitta o'qituvchining barcha bonus ulushlari (profil tabi va o'qituvchi ilovasi uchun).
    /// Bekor qilinganlar ham qaytadi (belgisi bilan), lekin JAMI ga kirmaydi.</summary>
    public static async Task<TeacherRetentionSummaryDto> ForTeacherAsync(
        IAppDbContext db, string teacherId, CancellationToken ct = default)
    {
        var shares = await db.RetentionBonusShares.AsNoTracking()
            .Where(s => s.TeacherId == teacherId).ToListAsync(ct);
        if (shares.Count == 0) return new TeacherRetentionSummaryDto(0m, 0, []);

        var awardIds = shares.Select(s => s.AwardId).Distinct().ToList();
        var awards = (await db.RetentionBonusAwards.AsNoTracking()
                .Where(a => awardIds.Contains(a.Id)).ToListAsync(ct))
            .ToDictionary(a => a.Id);

        var items = shares
            .Where(s => awards.ContainsKey(s.AwardId))
            .Select(s =>
            {
                var a = awards[s.AwardId];
                return new TeacherRetentionBonusDto(
                    a.Id, a.StudentId, a.StudentName, a.PeriodFrom, a.PeriodTo,
                    s.Months, s.Amount, a.CreatedAt, a.GivenBy, a.Status);
            })
            .OrderByDescending(x => x.GivenAt)
            .ToList();

        var active = items.Where(x => x.Status == RetentionBonusAward.StatusGiven).ToList();
        return new TeacherRetentionSummaryDto(active.Sum(x => x.Amount), active.Count, items);
    }

    /* ==================== YORDAMCHI ==================== */

    private static string FormatDays(List<int> days) =>
        days is null || days.Count == 0 ? "" :
        string.Join(", ", days.Order().Select(d => d >= 0 && d < DayShort.Length ? DayShort[d] : "?"));
}
