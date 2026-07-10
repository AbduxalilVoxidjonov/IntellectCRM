using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Maoshni JURNALGA bog'lash uchun hisob: har (oy, guruh) kesimida rejadagi darslar soni va ulardan
/// nechtasi jurnalda "o'tildi" (<see cref="LessonNote.Conducted"/>) deb belgilangani.
///
/// Sozlama: <see cref="CenterMeta.SalaryRequireJournal"/> (Guruhlar → "Jurnal boshqaruvi").
/// Yoqilgan bo'lsa <see cref="SalaryLedger"/> o'qituvchining shu oydagi maoshini
/// (belgilangan darslar ÷ rejadagi darslar) nisbatiga ko'paytiradi — belgilanmagan dars = o'tilmagan
/// dars, uning haqi to'lanmaydi.
///
/// Rejadagi darslar dars jadvalidan emas, guruh hafta kunlaridan (<see cref="Group.Days"/>) chiqariladi
/// (jurnal ustunlari ham shundan — <see cref="JournalService.LessonDatesInMonth"/>).
/// Faqat MUHLATI o'tgan darslar hisoblanadi: kelajakdagi va oxirgi
/// <see cref="CenterMeta.SalaryGraceDays"/> kun ichidagi darslarni o'qituvchi hali belgilashi mumkin.
/// </summary>
public static class SalaryJournalStats
{
    /// <summary>Guruhning dars kunlarini hisoblash uchun kerakli minimal ma'lumot.</summary>
    public sealed record GroupInfo(string Id, string Name, List<int> Days, string? StartDate, string? EndDate);

    /// <summary>Bitta (oy, guruh) uchun jurnal holati. Planned=0 bo'lsa ushlanma yo'q (dars muddati kelmagan).</summary>
    public sealed record Stat(int Planned, int Conducted, List<string> MissedDates)
    {
        public int Missed => MissedDates.Count;
        /// <summary>To'langan ulush: 1 = hamma dars belgilangan, 0 = birortasi ham belgilanmagan.</summary>
        public decimal Ratio => Planned <= 0 ? 1m : (decimal)Conducted / Planned;
    }

    /// <summary>
    /// (oy, guruhId) → jurnal holati. <paramref name="notBefore"/> — o'qituvchi ishga kirgan sana
    /// ("yyyy-MM-dd"); undan oldingi darslar rejaga kirmaydi.
    /// </summary>
    public static async Task<Dictionary<(string Month, string GroupId), Stat>> BuildAsync(
        IAppDbContext db, IReadOnlyList<GroupInfo> groups,
        string startMonth, string toMonth, int graceDays, string? notBefore)
    {
        var result = new Dictionary<(string, string), Stat>();
        if (groups.Count == 0) return result;

        var groupIds = groups.Select(g => g.Id).ToList();
        var fromDate = $"{startMonth}-01";
        var toDate = $"{toMonth}-31";

        // Jurnalda "o'tildi" belgilangan darslar (guruh + sana). Fan bo'yicha filtrlamaymiz —
        // bir guruh bitta kursga tegishli, sana ustuni esa kurs bilan bir xil.
        var conducted = await db.LessonNotes
            .Where(n => groupIds.Contains(n.ClassId) && n.Conducted
                        && string.Compare(n.Date, fromDate) >= 0 && string.Compare(n.Date, toDate) <= 0)
            .Select(n => new { n.ClassId, n.Date })
            .Distinct()
            .ToListAsync();
        var conductedSet = conducted.Select(c => (c.ClassId, c.Date)).ToHashSet();

        // Muhlat chegarasi: shu sanagacha (shu sana ham) bo'lgan darslar allaqachon belgilangan bo'lishi kerak.
        var cutoff = AppClock.Today.AddDays(-Math.Max(0, graceDays)).ToString("yyyy-MM-dd");

        foreach (var month in TuitionService.MonthRange(startMonth, toMonth))
        {
            foreach (var g in groups)
            {
                var planned = 0;
                var done = 0;
                var missed = new List<string>();
                foreach (var date in JournalService.LessonDatesInMonth(g.Days, month))
                {
                    if (string.CompareOrdinal(date, cutoff) > 0) continue;             // hali muhlati kelmagan
                    if (notBefore is { Length: >= 10 } && string.CompareOrdinal(date, notBefore) < 0) continue;
                    if (g.StartDate is { Length: >= 10 } && string.CompareOrdinal(date, g.StartDate[..10]) < 0) continue;
                    if (g.EndDate is { Length: >= 10 } && string.CompareOrdinal(date, g.EndDate[..10]) > 0) continue;

                    planned++;
                    if (conductedSet.Contains((g.Id, date))) done++;
                    else missed.Add(date);
                }
                if (planned > 0) result[(month, g.Id)] = new Stat(planned, done, missed);
            }
        }
        return result;
    }
}
