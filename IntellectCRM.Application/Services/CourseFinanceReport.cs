using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Moliyaviy hisobot KURS va GURUH kesimida: qaysi kurs ko'p daromad keltiradi, qaysi kurs
/// o'quvchilari to'lovni to'liq amalga oshirdi, qaysi guruh (o'qituvchi) to'lov yig'ishda faolroq.
///
/// "Yig'ilgan" (collected) = SHU DAVRDA kelgan tuition to'lovlari, guruhga tegishli qilib:
///   • teglangan to'lov (FinanceTransaction.GroupId bor) → 100% o'sha guruhga;
///   • teglanmagan to'lov → o'quvchining SHU OYDAGI billable guruhlari oylik narxi (MonthlyFee)
///     nisbatida taqsimlanadi (maosh hisobidagi bilan bir xil mantiq — SalaryLedger).
/// "Hisoblangan" (billed) = MonthlyCharge (Amount − Discount), per-guruh (GroupId) yozuvlaridan.
/// "To'liq to'lagan" = o'quvchining shu guruh uchun yig'ilgani ≥ hisoblangani (billed > 0 bo'lganlar ichida).
/// </summary>
public static class CourseFinanceReport
{
    public static async Task<CourseFinanceReportDto> BuildAsync(
        IAppDbContext db, string? from, string? to)
    {
        var fromDate = string.IsNullOrEmpty(from)
            ? $"{await TuitionService.AcademicYearStartMonthAsync(db)}-01"
            : from;
        var toDate = string.IsNullOrEmpty(to) ? $"{AppClock.Today:yyyy-MM-dd}" : to;
        var fromMonth = fromDate.Length >= 7 ? fromDate[..7] : fromDate;
        var toMonth = toDate.Length >= 7 ? toDate[..7] : toDate;
        var monthsSet = TuitionService.MonthRange(fromMonth, toMonth).ToHashSet();

        // ---- Guruhlar / kurslar / o'qituvchilar ----
        var groups = await db.Classes.ToListAsync();
        var feeByGroup = groups.ToDictionary(g => g.Id, g => g.MonthlyFee);

        var subjects = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s);
        var teacherNames = await db.Teachers.ToDictionaryAsync(t => t.Id, t => t.FullName);

        // ---- A'zoliklar (taqsimlash maxraji + o'quvchi sanog'i uchun) ----
        var memberships = await db.StudentGroups.ToListAsync();
        var membsByStudent = memberships.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());
        // Guruhdagi faol o'quvchilar soni (arxivlanmagan a'zolik).
        var activeStudentsByGroup = memberships
            .Where(m => m.IsActive)
            .GroupBy(m => m.GroupId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.StudentId).Distinct().Count());

        // ---- HISOBLANGAN (billed): per-guruh MonthlyCharge ----
        var charges = await db.MonthlyCharges
            .Where(c => c.GroupId != null)
            .Select(c => new { c.StudentId, c.GroupId, c.Month, c.Amount, c.Discount })
            .ToListAsync();
        var billedByGroup = new Dictionary<string, decimal>();
        var billedBySg = new Dictionary<(string, string), decimal>();
        foreach (var c in charges)
        {
            if (!monthsSet.Contains(c.Month) || c.GroupId is null) continue;
            var net = c.Amount - c.Discount;
            if (net <= 0) continue;
            billedByGroup[c.GroupId] = billedByGroup.GetValueOrDefault(c.GroupId) + net;
            var key = (c.StudentId, c.GroupId);
            billedBySg[key] = billedBySg.GetValueOrDefault(key) + net;
        }

        // ---- YIG'ILGAN (collected): tuition to'lovlarini guruhga tegishli qilish ----
        var payments = await db.FinanceTransactions
            .Where(t => t.Direction == "income" && t.Category == "tuition" && t.StudentId != null
                        && string.Compare(t.Date, fromDate) >= 0 && string.Compare(t.Date, toDate) <= 0)
            .Select(t => new { StudentId = t.StudentId!, t.GroupId, t.Date, t.Amount })
            .ToListAsync();

        var collectedByGroup = new Dictionary<string, decimal>();
        var collectedBySg = new Dictionary<(string, string), decimal>();
        var untaggedByStudentMonth = new Dictionary<(string Sid, string Month), decimal>();

        void AddCollected(string groupId, string studentId, decimal amount)
        {
            collectedByGroup[groupId] = collectedByGroup.GetValueOrDefault(groupId) + amount;
            var key = (studentId, groupId);
            collectedBySg[key] = collectedBySg.GetValueOrDefault(key) + amount;
        }

        foreach (var p in payments)
        {
            if (p.Amount <= 0) continue;
            var month = p.Date.Length >= 7 ? p.Date[..7] : p.Date;
            if (!string.IsNullOrEmpty(p.GroupId))
                AddCollected(p.GroupId, p.StudentId, p.Amount);
            else
            {
                var key = (p.StudentId, month);
                untaggedByStudentMonth[key] = untaggedByStudentMonth.GetValueOrDefault(key) + p.Amount;
            }
        }

        // Teglanmagan to'lovni narx nisbatida billable guruhlarga taqsimlash.
        foreach (var ((sid, month), amount) in untaggedByStudentMonth)
        {
            if (amount <= 0 || !membsByStudent.TryGetValue(sid, out var membs)) continue;
            var active = membs.Where(m => BillableInMonth(m, month)).ToList();
            var denom = active.Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
            if (denom <= 0) continue;
            foreach (var m in active)
            {
                var fee = feeByGroup.GetValueOrDefault(m.GroupId, 0m);
                if (fee <= 0) continue;
                AddCollected(m.GroupId, sid, amount * fee / denom);
            }
        }

        // ---- GURUH qatorlari ----
        var groupRows = new List<GroupFinanceRowDto>();
        foreach (var g in groups)
        {
            var billed = decimal.Round(billedByGroup.GetValueOrDefault(g.Id), 2);
            var collected = decimal.Round(collectedByGroup.GetValueOrDefault(g.Id), 2);
            var students = activeStudentsByGroup.GetValueOrDefault(g.Id, 0);
            // Bu davrda hech qanday faollik bo'lmagan bo'sh guruhni chiqarib tashlaymiz.
            if (billed <= 0 && collected <= 0 && students == 0) continue;

            // To'liq to'lagan / billable o'quvchilar (shu guruh uchun).
            var sgStudents = billedBySg.Keys.Where(k => k.Item2 == g.Id).Select(k => k.Item1).ToHashSet();
            var billable = 0;
            var fullyPaid = 0;
            foreach (var sid in sgStudents)
            {
                var b = billedBySg.GetValueOrDefault((sid, g.Id));
                if (b <= 0) continue;
                billable++;
                var c = collectedBySg.GetValueOrDefault((sid, g.Id));
                if (c + 0.5m >= b) fullyPaid++;
            }

            var courseName = subjects.TryGetValue(g.CourseId, out var subj) ? subj.Name : "—";
            var teacherName = teacherNames.GetValueOrDefault(g.TeacherId, "—");
            var pct = billed > 0 ? decimal.Round(collected / billed * 100m, 1) : 0m;

            groupRows.Add(new GroupFinanceRowDto(
                g.Id, g.Name, courseName, g.TeacherId, teacherName,
                students, billed, collected, pct, fullyPaid, billable));
        }

        // ---- KURS qatorlari (guruhlarni CourseId bo'yicha jamlash) ----
        var courseRows = new List<CourseFinanceRowDto>();
        var byCourse = groups.GroupBy(g => g.CourseId);
        foreach (var grp in byCourse)
        {
            var courseId = grp.Key;
            if (string.IsNullOrEmpty(courseId)) continue;
            var gids = grp.Select(g => g.Id).ToHashSet();

            var billed = decimal.Round(gids.Sum(id => billedByGroup.GetValueOrDefault(id)), 2);
            var collected = decimal.Round(gids.Sum(id => collectedByGroup.GetValueOrDefault(id)), 2);
            if (billed <= 0 && collected <= 0) continue;

            // Kurs o'quvchilari (shu kurs guruhlaridagi faol a'zolar, takrorlanmas).
            var studentCount = memberships
                .Where(m => m.IsActive && gids.Contains(m.GroupId))
                .Select(m => m.StudentId).Distinct().Count();

            // To'liq to'lagan / billable — shu kurs guruhlari bo'yicha (har (o'quvchi,guruh) bir marta).
            var billable = 0;
            var fullyPaid = 0;
            foreach (var key in billedBySg.Keys.Where(k => gids.Contains(k.Item2)))
            {
                var b = billedBySg.GetValueOrDefault(key);
                if (b <= 0) continue;
                billable++;
                var c = collectedBySg.GetValueOrDefault(key);
                if (c + 0.5m >= b) fullyPaid++;
            }

            var name = subjects.TryGetValue(courseId, out var subj) ? subj.Name : "—";
            var price = subj?.Price ?? 0m;
            var pct = billed > 0 ? decimal.Round(collected / billed * 100m, 1) : 0m;
            var paidPct = billable > 0 ? decimal.Round((decimal)fullyPaid / billable * 100m, 1) : 0m;

            courseRows.Add(new CourseFinanceRowDto(
                courseId, name, price, grp.Count(), studentCount,
                billed, collected, pct, fullyPaid, billable, paidPct));
        }

        var totalBilled = decimal.Round(billedByGroup.Values.Sum(), 2);
        var totalCollected = decimal.Round(collectedByGroup.Values.Sum(), 2);
        var collectionPct = totalBilled > 0 ? decimal.Round(totalCollected / totalBilled * 100m, 1) : 0m;

        return new CourseFinanceReportDto(
            fromDate, toDate, totalBilled, totalCollected, collectionPct,
            courseRows.OrderByDescending(c => c.Collected).ToList(),
            groupRows.OrderByDescending(g => g.Collected).ToList());
    }

    /// <summary>
    /// BITTA guruh ichidagi to'lov holati: har bir o'quvchi uchun davr bo'yicha hisoblangan/yig'ilgan
    /// va to'liq to'laganmi (kim to'ladi / kim to'lamadi). Yig'ilgan logikasi <see cref="BuildAsync"/>
    /// bilan bir xil — teglangan to'lov 100% shu guruhga, teglanmagan narx nisbatida shu guruh ulushiga.
    /// </summary>
    public static async Task<GroupPaymentsReportDto> BuildGroupPaymentsAsync(
        IAppDbContext db, string groupId, string? from, string? to)
    {
        var fromDate = string.IsNullOrEmpty(from)
            ? $"{await TuitionService.AcademicYearStartMonthAsync(db)}-01"
            : from;
        var toDate = string.IsNullOrEmpty(to) ? $"{AppClock.Today:yyyy-MM-dd}" : to;
        var fromMonth = fromDate.Length >= 7 ? fromDate[..7] : fromDate;
        var toMonth = toDate.Length >= 7 ? toDate[..7] : toDate;
        var monthsSet = TuitionService.MonthRange(fromMonth, toMonth).ToHashSet();

        var group = await db.Classes.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
            return new GroupPaymentsReportDto(groupId, "—", fromDate, toDate, 0, 0, 0, 0, 0, new());

        // Narxlar — teglanmagan to'lovni shu guruh ulushiga taqsimlash uchun.
        var feeByGroup = await db.Classes.ToDictionaryAsync(g => g.Id, g => g.MonthlyFee);
        var groupFee = feeByGroup.GetValueOrDefault(groupId, 0m);

        var memberships = await db.StudentGroups.ToListAsync();
        var membsByStudent = memberships.GroupBy(m => m.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        // HISOBLANGAN (billed) — shu guruh MonthlyCharge'laridan, davr ichida.
        var charges = await db.MonthlyCharges
            .Where(c => c.GroupId == groupId)
            .Select(c => new { c.StudentId, c.Month, c.Amount, c.Discount })
            .ToListAsync();
        var billedByStudent = new Dictionary<string, decimal>();
        foreach (var c in charges)
        {
            if (!monthsSet.Contains(c.Month)) continue;
            var net = c.Amount - c.Discount;
            if (net <= 0) continue;
            billedByStudent[c.StudentId] = billedByStudent.GetValueOrDefault(c.StudentId) + net;
        }

        // YIG'ILGAN (collected) — shu guruhga tegishli ulush.
        var payments = await db.FinanceTransactions
            .Where(t => t.Direction == "income" && t.Category == "tuition" && t.StudentId != null
                        && string.Compare(t.Date, fromDate) >= 0 && string.Compare(t.Date, toDate) <= 0)
            .Select(t => new { StudentId = t.StudentId!, t.GroupId, t.Date, t.Amount })
            .ToListAsync();
        var collectedByStudent = new Dictionary<string, decimal>();
        foreach (var p in payments)
        {
            if (p.Amount <= 0) continue;
            if (!string.IsNullOrEmpty(p.GroupId))
            {
                if (p.GroupId == groupId)
                    collectedByStudent[p.StudentId] = collectedByStudent.GetValueOrDefault(p.StudentId) + p.Amount;
                continue;
            }
            // Teglanmagan — narx nisbatida shu guruh ulushini olamiz.
            if (groupFee <= 0 || !membsByStudent.TryGetValue(p.StudentId, out var membs)) continue;
            var month = p.Date.Length >= 7 ? p.Date[..7] : p.Date;
            var active = membs.Where(m => BillableInMonth(m, month)).ToList();
            if (!active.Any(m => m.GroupId == groupId)) continue;
            var denom = active.Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
            if (denom <= 0) continue;
            collectedByStudent[p.StudentId] =
                collectedByStudent.GetValueOrDefault(p.StudentId) + p.Amount * groupFee / denom;
        }

        // Ko'rsatiladigan o'quvchilar: shu guruh faol a'zolari + hisoblangani/yig'ilgani bor bo'lganlar.
        var sids = new HashSet<string>(memberships.Where(m => m.GroupId == groupId && m.IsActive).Select(m => m.StudentId));
        foreach (var k in billedByStudent.Keys) sids.Add(k);
        foreach (var k in collectedByStudent.Keys) sids.Add(k);

        var nameById = (await db.Students.Where(s => sids.Contains(s.Id))
            .Select(s => new { s.Id, s.FullName }).ToListAsync())
            .ToDictionary(s => s.Id, s => s.FullName);
        var statusByStudent = memberships
            .Where(m => m.GroupId == groupId)
            .GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => (g.FirstOrDefault(m => m.IsActive) ?? g.First()).Status);

        var rows = sids.Select(sid =>
        {
            var billed = decimal.Round(billedByStudent.GetValueOrDefault(sid), 2);
            var collected = decimal.Round(collectedByStudent.GetValueOrDefault(sid), 2);
            var debt = decimal.Round(Math.Max(0m, billed - collected), 2);
            var fullyPaid = billed > 0 && collected + 0.5m >= billed;
            return new GroupPaymentRowDto(
                sid, nameById.GetValueOrDefault(sid, "—"), statusByStudent.GetValueOrDefault(sid, ""),
                billed, collected, debt, fullyPaid, collected > 0);
        })
        .OrderByDescending(r => r.Debt)
        .ThenByDescending(r => r.Billed)
        .ThenBy(r => r.FullName)
        .ToList();

        return new GroupPaymentsReportDto(
            groupId, group.Name, fromDate, toDate,
            decimal.Round(billedByStudent.Values.Sum(), 2),
            decimal.Round(collectedByStudent.Values.Sum(), 2),
            rows.Count(r => r.Billed > 0 && r.FullyPaid),
            rows.Count(r => r.Billed > 0 && !r.FullyPaid),
            rows.Count, rows);
    }

    /// <summary>A'zolik shu oyda hisob-kitobga kiradimi (trial emas, aktiv-muzlat oralig'ida).</summary>
    private static bool BillableInMonth(StudentGroup m, string month)
    {
        if (m.Status == "trial") return false;
        var actOk = m.ActivatedAt.Length < 7 || string.CompareOrdinal(month, m.ActivatedAt[..7]) >= 0;
        var frzOk = m.FrozenAt.Length < 7 || string.CompareOrdinal(month, m.FrozenAt[..7]) <= 0;
        return actOk && frzOk;
    }
}
