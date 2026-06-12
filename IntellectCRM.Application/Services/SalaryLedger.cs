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
/// MAOSH IKKI REJIMDA:
///   • "fixed"   — admin qo'lda kiritgan qat'iy oylik summa (<see cref="Teacher.Salary"/>);
///   • "percent" — o'qituvchi o'tadigan guruh(lar) o'quvchilaridan SHU OYDA haqiqatan yig'ilgan
///                 to'lovning <see cref="Teacher.SalaryPercent"/> foizi (yig'ilgan sayin qo'shilib boradi).
/// </summary>
public static class SalaryLedger
{
    public static async Task<SalaryLedgerDto> BuildAsync(
        IAppDbContext db, Teacher teacher, string? from, string? to)
    {
        // Maosh o'quv yili boshidan hisoblanadi (yanvardan emas) — choraklardagi eng erta oydan.
        var fromMonth = string.IsNullOrEmpty(from)
            ? await TuitionService.AcademicYearStartMonthAsync(db) : from[..7];
        var toMonth = string.IsNullOrEmpty(to) ? TuitionService.CurrentMonth() : to[..7];

        var percentMode = teacher.SalaryMode == "percent";

        // MAOSH QO'LDA: oylik = admin kiritgan `Teacher.Salary` (jadval-asosli avtomatik hisob olib tashlangan).
        // Plan oyligi = qo'lda kiritilgan summa (percent rejimida qat'iy plan yo'q — 0).
        var plannedMonthly = percentMode ? 0m : teacher.Salary;

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

        // Percent rejimi uchun: oy → o'qituvchi guruhlaridan shu oyda yig'ilgan to'lov bazasi.
        var collectedByMonth = percentMode
            ? await CollectedForTeacherGroupsAsync(db, teacher, startMonth, toMonth)
            : new Dictionary<string, decimal>();

        var months = new List<MonthSalaryDto>();
        foreach (var month in TuitionService.MonthRange(startMonth, toMonth))
        {
            decimal expected;
            if (percentMode)
            {
                // Foizli: shu oyda yig'ilgan to'lov × foiz. Yig'ilgan sayin oylik o'sib boradi.
                var collected = collectedByMonth.GetValueOrDefault(month, 0m);
                expected = decimal.Round(collected * teacher.SalaryPercent / 100m, 2);
            }
            else
            {
                // Qat'iy: kiritilgan maosh; birinchi (ishga kirgan) oy QISMAN — shu kundan oy oxirigacha kunlar nisbatida.
                expected = teacher.Salary;
                if (startDate is { Length: >= 10 } && startDate[..7] == month
                    && DateOnly.TryParse(startDate, out var sd))
                {
                    var dim = DateTime.DaysInMonth(sd.Year, sd.Month);
                    expected = decimal.Round(teacher.Salary * (dim - sd.Day + 1) / dim, 2);
                }
            }
            var paid = paidByMonth.GetValueOrDefault(month, 0m);
            var remaining = expected - paid;
            var status = remaining <= 0 ? (expected <= 0 ? "unpaid" : "paid") : paid > 0 ? "partial" : "unpaid";
            months.Add(new MonthSalaryDto(month, expected, paid, remaining, status));
        }

        var totalExpected = months.Sum(m => m.Expected);
        var totalPaid = payments.Sum(p => p.Amount);
        var paymentDtos = payments.Select(t => new PaymentDto(t.Date, t.Amount, t.Note, t.Month)).ToList();

        return new SalaryLedgerDto(
            teacher.Id, teacher.FullName, plannedMonthly,
            totalExpected, totalPaid, totalExpected - totalPaid,
            months, paymentDtos, teacher.SalaryMode, teacher.SalaryPercent);
    }

    /// <summary>
    /// Foizli maosh bazasi: har oy uchun o'qituvchi o'tadigan guruh(lar) o'quvchilaridan SHU OYDA
    /// (to'lov sanasi oyi) haqiqatan yig'ilgan tuition summasi. O'quvchi bir nechta guruhda bo'lsa,
    /// to'lovi guruhlar oylik narxi (MonthlyFee) nisbatida taqsimlanadi — faqat o'qituvchi guruhiga
    /// tegishli ulush olinadi. Trial/muzlatilgan a'zoliklar shu oyda hisobga olinmaydi.
    /// </summary>
    private static async Task<Dictionary<string, decimal>> CollectedForTeacherGroupsAsync(
        IAppDbContext db, Teacher teacher, string startMonth, string toMonth)
    {
        var result = new Dictionary<string, decimal>();

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
                // Teglangan: faqat o'qituvchi guruhiga tegishli bo'lsa, to'liq qo'shiladi.
                if (tgIds.Contains(p.GroupId))
                    result[month] = result.GetValueOrDefault(month, 0m) + p.Amount;
            }
            else
            {
                var key = (p.StudentId, month);
                untaggedByStudentMonth[key] = untaggedByStudentMonth.GetValueOrDefault(key, 0m) + p.Amount;
            }
        }

        // Teglanmagan to'lovlarni narx (MonthlyFee) nisbatida o'qituvchi guruhiga taqsimlaymiz.
        foreach (var ((sid, month), collected) in untaggedByStudentMonth)
        {
            if (collected <= 0 || !membsByStudent.TryGetValue(sid, out var membs)) continue;
            var active = membs.Where(m => BillableInMonth(m, month)).ToList();
            var denom = active.Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
            if (denom <= 0) continue; // shu oyda billable guruh yo'q — taqsimlab bo'lmaydi.
            var teacherFee = active.Where(m => tgIds.Contains(m.GroupId))
                .Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
            if (teacherFee <= 0) continue;
            result[month] = result.GetValueOrDefault(month, 0m) + collected * teacherFee / denom;
        }

        // Yaxlitlash.
        foreach (var month in result.Keys.ToList())
            result[month] = decimal.Round(result[month], 2);
        return result;
    }
}
