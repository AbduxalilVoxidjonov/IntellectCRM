using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'qituvchi maoshi bo'yicha batafsil hisob (davr bo'yicha): jami belgilangan, berilgan, qoldiq
/// va har oyda qancha maosh berilgani. Admin moliya bo'limi ham, o'qituvchi ilovasi ham shu yagona
/// mantiqdan foydalanadi (ikki joyda farq qilib ketmasligi uchun).
///
/// MAOSH HISOBI:
///   • PER-GURUH (yangi, ustuvor) — o'qituvchining HAR guruhi alohida sozlanadi (<see cref="Group.TeacherSalaryMode"/>):
///       "percent" → shu guruhdan yig'ilgan to'lovning <see cref="Group.TeacherSalaryPercent"/> foizi;
///       "fixed"   → shu guruh uchun qat'iy summa <see cref="Group.TeacherSalaryFixed"/>.
///       Oylik maosh = barcha guruhlar ulushi YIG'INDISI (bir guruhi 40%, keyingisi 60% bo'lishi mumkin).
///   • LEGACY (hech bir guruh sozlanmagan bo'lsa) — o'qituvchi darajasidagi eski sozlama:
///       "fixed" qat'iy <see cref="Teacher.Salary"/> | "percent" barcha guruhlardan yig'ilganning
///       <see cref="Teacher.SalaryPercent"/> foizi.
///
/// JURNALGA BOG'LASH (<see cref="CenterMeta.SalaryRequireJournal"/>): yoqilgan bo'lsa har oyda jurnalda
/// "o'tildi" belgilanmagan dars o'tilmagan hisoblanadi va uning haqi maoshdan ushlanadi
/// (<see cref="SalaryJournalStats"/>). Ushlanma sababi <see cref="MonthSalaryDto.Lessons"/>da
/// guruh + o'tkazib yuborilgan sanalar bilan qaytadi — moliya bo'limi shuni ko'rsatadi.
/// </summary>
public static class SalaryLedger
{
    /// <summary>Guruhning amaldagi maosh rejimi: sozlangan bo'lsa o'zi, aks holda o'qituvchi darajasidagi.</summary>
    private static string EffMode(string groupMode, string teacherMode) =>
        groupMode is "percent" or "fixed" ? groupMode : (teacherMode == "percent" ? "percent" : "fixed");

    public static async Task<SalaryLedgerDto> BuildAsync(
        IAppDbContext db, Teacher teacher, string? from, string? to)
    {
        // Maosh o'quv yili boshidan hisoblanadi (yanvardan emas) — choraklardagi eng erta oydan.
        var fromMonth = string.IsNullOrEmpty(from)
            ? await TuitionService.AcademicYearStartMonthAsync(db) : from[..7];
        var toMonth = string.IsNullOrEmpty(to) ? TuitionService.CurrentMonth() : to[..7];

        // O'qituvchi ishga kirgan KUN (yangi maydon yoki eski oy-01). Birinchi oy shu kundan qisman.
        var startDate = TeacherSalaryCalc.StartDateOf(teacher);
        var teacherStartMonth = startDate is { Length: >= 7 } ? startDate[..7] : fromMonth;
        // Oylik o'qituvchi boshlagan oydan hisoblanadi — undan oldingi oylar uchun qarz yozilmaydi.
        var startMonth = string.CompareOrdinal(teacherStartMonth, fromMonth) > 0 ? teacherStartMonth : fromMonth;

        var fromDate = $"{startMonth}-01";
        var toDate = $"{toMonth}-31";

        var payments = await db.FinanceTransactions
            .Where(t => t.TeacherId == teacher.Id && t.Direction == "expense" && t.Category == "salary"
                        && string.Compare(t.Date, fromDate) >= 0 && string.Compare(t.Date, toDate) <= 0)
            .OrderByDescending(t => t.Date).ToListAsync();

        var paidByMonth = payments
            .GroupBy(p => p.Date[..7])
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        // O'qituvchi guruhlari + per-guruh maosh sozlamasi.
        var groups = await db.Classes
            .Where(c => c.TeacherId == teacher.Id)
            .Select(c => new
            {
                c.Id, c.Name, c.CourseId, c.MonthlyFee,
                c.TeacherSalaryMode, c.TeacherSalaryPercent, c.TeacherSalaryFixed,
                c.Days, c.StartDate, c.EndDate,
            })
            .ToListAsync();

        // Maosh jurnalga bog'langanmi? (Guruhlar → "Jurnal boshqaruvi"). Yoqilgan bo'lsa — belgilanmagan
        // darslar o'tilmagan hisoblanadi va shu oy maoshidan ushlanadi.
        var policy = await JournalPolicy.GetAsync(db);
        var journalLinked = policy.SalaryRequireJournal;
        var lessonStats = journalLinked && groups.Count > 0
            ? await SalaryJournalStats.BuildAsync(db,
                groups.Select(g => new SalaryJournalStats.GroupInfo(g.Id, g.Name, g.Days, g.StartDate, g.EndDate)).ToList(),
                startMonth, toMonth, policy.SalaryGraceDays, startDate)
            : new Dictionary<(string Month, string GroupId), SalaryJournalStats.Stat>();

        // Kamida bitta guruh per-guruh sozlangan bo'lsa — YIG'INDI (per-guruh) hisob; aks holda LEGACY.
        var anyConfigured = groups.Any(g => g.TeacherSalaryMode is "percent" or "fixed");
        // Foizli ulush bo'lsa (legacy yoki per-guruh) — yig'ilgan to'lov bazasi kerak.
        var anyPercent = teacher.SalaryMode == "percent" || groups.Any(g => g.TeacherSalaryMode == "percent");
        var collectedPerGroup = (groups.Count > 0 && anyPercent)
            ? await CollectedPerGroupAsync(db, teacher, startMonth, toMonth)
            : new Dictionary<(string month, string groupId), decimal>();

        decimal TotalCollected(string month) =>
            collectedPerGroup.Where(kv => kv.Key.month == month).Sum(kv => kv.Value);

        // Kurs nomlari (breakdown uchun).
        var courseIds = groups.Where(g => !string.IsNullOrEmpty(g.CourseId)).Select(g => g.CourseId).Distinct().ToList();
        var courseNames = (await db.Subjects.Where(s => courseIds.Contains(s.Id)).ToListAsync())
            .ToDictionary(s => s.Id, s => s.Name);

        // Legacy plan oyligi (eski UI uchun ishora).
        var plannedMonthly = teacher.SalaryMode == "percent" ? 0m : teacher.Salary;

        var groupPeriodExpected = groups.ToDictionary(g => g.Id, _ => 0m);
        var groupPeriodCollected = groups.ToDictionary(g => g.Id, _ => 0m);

        var months = new List<MonthSalaryDto>();
        foreach (var month in TuitionService.MonthRange(startMonth, toMonth))
        {
            // Birinchi (ishga kirgan) oy QISMAN — qat'iy summalarga shu nisbat qo'llanadi.
            decimal factor = 1m;
            if (startDate is { Length: >= 10 } && startDate[..7] == month
                && DateOnly.TryParse(startDate, out var sd))
            {
                var dim = DateTime.DaysInMonth(sd.Year, sd.Month);
                factor = (decimal)(dim - sd.Day + 1) / dim;
            }

            // Har guruhning shu oydagi ulushi (breakdown + per-guruh yig'indisi uchun doim hisoblanadi).
            // Jurnalga bog'langan bo'lsa — shu yerda ushlanma ham ayriladi (guruh o'z darslariga javob beradi).
            decimal grossSum = 0m, groupDeduction = 0m;
            var lessonLines = new List<SalaryLessonStatDto>();
            int plannedTotal = 0, conductedTotal = 0;

            foreach (var g in groups)
            {
                var mode = EffMode(g.TeacherSalaryMode, teacher.SalaryMode);
                decimal contribution;
                if (mode == "percent")
                {
                    var pct = g.TeacherSalaryMode == "percent" ? g.TeacherSalaryPercent : teacher.SalaryPercent;
                    var col = collectedPerGroup.GetValueOrDefault((month, g.Id), 0m);
                    contribution = decimal.Round(col * pct / 100m, 2);
                    groupPeriodCollected[g.Id] += col;
                }
                else
                {
                    // Qat'iy: per-guruh sozlangan bo'lsa shu summa; sozlanmagan guruh legacy fixed'da 0 (admin kiritadi).
                    var amt = g.TeacherSalaryMode == "fixed" ? g.TeacherSalaryFixed : 0m;
                    contribution = decimal.Round(amt * factor, 2);
                }

                var stat = lessonStats.GetValueOrDefault((month, g.Id));
                decimal ded = 0m;
                if (journalLinked && stat is not null)
                {
                    plannedTotal += stat.Planned;
                    conductedTotal += stat.Conducted;
                    if (contribution > 0 && stat.Missed > 0)
                        ded = decimal.Round(contribution * stat.Missed / stat.Planned, 2);
                }

                grossSum += contribution;
                groupDeduction += ded;
                groupPeriodExpected[g.Id] += contribution - ded;
                if (journalLinked && stat is not null)
                    lessonLines.Add(new SalaryLessonStatDto(
                        g.Id, g.Name, stat.Planned, stat.Conducted, stat.Missed, ded, stat.MissedDates));
            }

            decimal baseExpected;
            if (anyConfigured)
            {
                baseExpected = decimal.Round(grossSum, 2);
            }
            else if (teacher.SalaryMode == "percent")
            {
                baseExpected = decimal.Round(TotalCollected(month) * teacher.SalaryPercent / 100m, 2);
            }
            else
            {
                baseExpected = decimal.Round(teacher.Salary * factor, 2);
            }

            // Ushlanma: per-guruh ulushi bor bo'lsa (per-guruh yoki legacy foiz) — guruhlar bo'yicha yig'indi;
            // legacy QAT'IY oylikda guruh ulushi yo'q, shuning uchun bitta dars narxi = oylik ÷ rejadagi darslar.
            decimal deduction = 0m;
            if (journalLinked && plannedTotal > 0)
            {
                if (anyConfigured || teacher.SalaryMode == "percent")
                {
                    deduction = decimal.Round(groupDeduction, 2);
                }
                else if (baseExpected > 0)
                {
                    var perLesson = baseExpected / plannedTotal;
                    for (var i = 0; i < lessonLines.Count; i++)
                    {
                        var line = lessonLines[i];
                        var ded = decimal.Round(perLesson * line.Missed, 2);
                        lessonLines[i] = line with { Deduction = ded };
                        deduction += ded;
                    }
                    if (deduction > baseExpected) deduction = baseExpected;  // yaxlitlash himoyasi
                }
            }

            var expected = baseExpected - deduction;
            var paid = paidByMonth.GetValueOrDefault(month, 0m);
            var remaining = expected - paid;
            var status = remaining <= 0 ? (expected <= 0 ? "unpaid" : "paid") : paid > 0 ? "partial" : "unpaid";
            months.Add(new MonthSalaryDto(
                month, expected, paid, remaining, status,
                baseExpected, deduction,
                plannedTotal, conductedTotal, plannedTotal - conductedTotal,
                journalLinked ? lessonLines : null));
        }

        var totalExpected = months.Sum(m => m.Expected);
        var totalPaid = payments.Sum(p => p.Amount);
        var paymentDtos = payments.Select(t => new PaymentDto(t.Date, t.Amount, t.Note, t.Month, t.Comment)).ToList();

        var groupLines = groups.Select(g => new GroupSalaryLineDto(
            g.Id, g.Name,
            string.IsNullOrEmpty(g.CourseId) ? "" : courseNames.GetValueOrDefault(g.CourseId, ""),
            g.MonthlyFee,
            EffMode(g.TeacherSalaryMode, teacher.SalaryMode),
            g.TeacherSalaryMode == "percent" ? g.TeacherSalaryPercent
                : g.TeacherSalaryMode == "fixed" ? 0m : teacher.SalaryPercent,
            g.TeacherSalaryMode == "fixed" ? g.TeacherSalaryFixed : 0m,
            decimal.Round(groupPeriodCollected.GetValueOrDefault(g.Id, 0m), 2),
            decimal.Round(groupPeriodExpected.GetValueOrDefault(g.Id, 0m), 2)
        )).ToList();

        return new SalaryLedgerDto(
            teacher.Id, teacher.FullName, plannedMonthly,
            totalExpected, totalPaid, totalExpected - totalPaid,
            months, paymentDtos, teacher.SalaryMode, teacher.SalaryPercent, groupLines,
            months.Sum(m => m.Deduction), journalLinked);
    }

    /// <summary>
    /// Foizli maosh bazasi PER-GURUH: (oy, guruh) → o'qituvchi guruhi o'quvchilaridan SHU OYDA
    /// (to'lov sanasi oyi) haqiqatan yig'ilgan tuition summasi. O'quvchi bir nechta guruhda bo'lsa,
    /// TEGLANMAGAN to'lovi guruhlar oylik narxi (MonthlyFee) nisbatida taqsimlanadi — har guruhga o'z
    /// ulushi. TEGLANGAN to'lov 100% o'sha guruhga. Trial/muzlatilgan a'zoliklar shu oyda hisobga olinmaydi.
    /// </summary>
    private static async Task<Dictionary<(string month, string groupId), decimal>> CollectedPerGroupAsync(
        IAppDbContext db, Teacher teacher, string startMonth, string toMonth)
    {
        var result = new Dictionary<(string month, string groupId), decimal>();

        void Add(string month, string groupId, decimal amount) =>
            result[(month, groupId)] = result.GetValueOrDefault((month, groupId), 0m) + amount;

        // O'qituvchi guruhlari (id → oylik narx).
        var teacherGroups = await db.Classes
            .Where(c => c.TeacherId == teacher.Id)
            .Select(c => new { c.Id, c.MonthlyFee }).ToListAsync();
        if (teacherGroups.Count == 0) return result;
        var tgIds = teacherGroups.Select(g => g.Id).ToHashSet();

        // Shu guruhlardagi o'quvchilar.
        var studentIds = await db.StudentGroups
            .Where(sg => tgIds.Contains(sg.GroupId))
            .Select(sg => sg.StudentId).Distinct().ToListAsync();
        if (studentIds.Count == 0) return result;

        // Bu o'quvchilarning BARCHA a'zoliklari (taqsimlash maxraji uchun boshqa guruhlari ham kerak).
        var memberships = await db.StudentGroups
            .Where(sg => studentIds.Contains(sg.StudentId)).ToListAsync();
        var allGroupIds = memberships.Select(m => m.GroupId).Distinct().ToList();
        var feeByGroup = (await db.Classes.Where(c => allGroupIds.Contains(c.Id)).ToListAsync())
            .ToDictionary(c => c.Id, c => c.MonthlyFee);

        // Tuition to'lovlari (kirim, o'quvchi) — GroupId tegi bilan.
        var fromDate = $"{startMonth}-01";
        var toDate = $"{toMonth}-31";
        var payments = await db.FinanceTransactions
            .Where(t => t.Direction == "income" && t.Category == "tuition" && t.StudentId != null
                        && studentIds.Contains(t.StudentId)
                        && string.Compare(t.Date, fromDate) >= 0 && string.Compare(t.Date, toDate) <= 0)
            .Select(t => new { StudentId = t.StudentId!, t.GroupId, t.Date, t.Amount }).ToListAsync();

        // TEGLANGAN to'lovlar (GroupId bor) — 100% o'sha guruhga; faqat o'qituvchi guruhi hisobga olinadi.
        // O'quvchi → oy → TEGLANMAGAN to'lov summasi (narx nisbatida taqsimlanadi).
        var untaggedByStudentMonth = new Dictionary<(string, string), decimal>();

        var membsByStudent = memberships.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        static bool BillableInMonth(StudentGroup m, string month)
        {
            if (m.Status == "trial") return false;
            var actOk = m.ActivatedAt.Length < 7 || string.CompareOrdinal(month, m.ActivatedAt[..7]) >= 0;
            var frzOk = m.FrozenAt.Length < 7 || string.CompareOrdinal(month, m.FrozenAt[..7]) <= 0;
            return actOk && frzOk;
        }

        foreach (var p in payments)
        {
            if (p.Amount <= 0) continue;
            var month = p.Date[..7];
            if (!string.IsNullOrEmpty(p.GroupId))
            {
                // Teglangan: faqat o'qituvchi guruhiga tegishli bo'lsa, 100% o'sha guruhga.
                if (tgIds.Contains(p.GroupId))
                    Add(month, p.GroupId, p.Amount);
            }
            else
            {
                var key = (p.StudentId, month);
                untaggedByStudentMonth[key] = untaggedByStudentMonth.GetValueOrDefault(key, 0m) + p.Amount;
            }
        }

        // Teglanmagan to'lovlarni narx (MonthlyFee) nisbatida o'qituvchi guruh(lar)iga taqsimlaymiz.
        foreach (var ((sid, month), collected) in untaggedByStudentMonth)
        {
            if (collected <= 0 || !membsByStudent.TryGetValue(sid, out var membs)) continue;
            var active = membs.Where(m => BillableInMonth(m, month)).ToList();
            var denom = active.Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
            if (denom <= 0) continue; // shu oyda billable guruh yo'q — taqsimlab bo'lmaydi.
            foreach (var m in active.Where(m => tgIds.Contains(m.GroupId)))
            {
                var fee = feeByGroup.GetValueOrDefault(m.GroupId, 0m);
                if (fee <= 0) continue;
                Add(month, m.GroupId, collected * fee / denom);
            }
        }

        // Yaxlitlash.
        foreach (var key in result.Keys.ToList())
            result[key] = decimal.Round(result[key], 2);
        return result;
    }
}
