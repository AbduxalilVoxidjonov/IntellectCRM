using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// To'lov oynasi uchun BITTA guruh bo'yicha oylik hisob. Aggregate `MonthlyCharge`dan farqli — bu yerda
/// faqat shu guruhning oylik narxi (aktivlashtirish/muzlatish qisman oylari bilan) va shu guruhga TEGLANGAN
/// to'lovlar olinadi. Maqsad: o'quvchi bir nechta guruhda o'qisa, to'lov kiritishda tanlangan guruh bo'yicha
/// to'g'ri oy va summa ko'rsatish (boshqa guruhlar summasi aralashmasin).
/// </summary>
public static class StudentGroupLedger
{
    /// <summary>Avans uchun joriy oydan keyin ko'rsatiladigan oylar soni (kassir oldindan to'lay olishi uchun).</summary>
    private const int AdvanceMonths = 3;

    public static async Task<GroupLedgerDto> BuildAsync(
        IAppDbContext db, Student student, Group group, StudentGroup membership)
    {
        var courseName = string.IsNullOrEmpty(group.CourseId) ? group.Name
            : (await db.Subjects.Where(s => s.Id == group.CourseId).Select(s => s.Name).FirstOrDefaultAsync())
              ?? group.Name;

        var months = new List<GroupMonthDto>();
        // Sinov (trial) — to'lov hisoblanmaydi.
        if (membership.Status == "trial")
            return new GroupLedgerDto(group.Id, group.Name, courseName, months);

        var current = TuitionService.CurrentMonth();
        var startMonth = membership.ActivatedAt.Length >= 7 ? membership.ActivatedAt[..7]
            : membership.JoinedAt.Length >= 7 ? membership.JoinedAt[..7] : current;
        var endMonth = current;
        if (membership.FrozenAt.Length >= 7 && string.CompareOrdinal(membership.FrozenAt[..7], endMonth) < 0)
            // Muzlatilgan — kelajak yo'q, oxiri = muzlatish oyi.
            endMonth = membership.FrozenAt[..7];
        else
            // AVANS: muzlatilmagan a'zolik uchun joriy oydan keyingi 3 oyni ham ko'rsatamiz — kassir
            // oldindan to'lay olsin (to'lov qilinsa o'sha oy hisobi EnsureCharge orqali ochiladi).
            for (var i = 0; i < AdvanceMonths; i++) endMonth = TuitionService.NextMonth(endMonth);
        if (string.CompareOrdinal(startMonth, endMonth) > 0)
            return new GroupLedgerDto(group.Id, group.Name, courseName, months);

        // Shu guruhga TEGLANGAN tuition to'lovlari — oy bo'yicha.
        var paidByMonth = (await db.FinanceTransactions
                .Where(t => t.StudentId == student.Id && t.GroupId == group.Id
                            && t.Direction == "income" && t.Category == "tuition" && t.Month != null)
                .ToListAsync())
            .GroupBy(t => t.Month!)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        // Mavjud per-guruh hisoblar — HAQIQAT MANBAI (super-admin qo'lda tahrir/Locked shu yerda).
        var chargeByMonth = (await db.MonthlyCharges
                .Where(c => c.StudentId == student.Id && c.GroupId == group.Id)
                .ToListAsync())
            .GroupBy(c => c.Month).ToDictionary(g => g.Key, g => g.First());

        foreach (var month in TuitionService.MonthRange(startMonth, endMonth))
        {
            decimal gross, discount;
            if (chargeByMonth.TryGetValue(month, out var ch))
            {
                // Hisob mavjud — uning summasi/chegirmasi (haqiqat).
                gross = ch.Amount;
                discount = ch.Discount;
            }
            else
            {
                // Hisob hali yo'q (kelajak/avans yoki accrue qilinmagan) — guruh narxidan PREVIEW.
                if (membership.ActivatedAt.Length >= 10 && membership.ActivatedAt[..7] == month)
                    gross = ActivationGross(group, membership.ActivatedAt);
                else if (membership.FrozenAt.Length >= 10 && membership.FrozenAt[..7] == month)
                    gross = FreezeGross(group, membership.ActivatedAt, membership.FrozenAt);
                else
                    gross = group.MonthlyFee;
                discount = TuitionService.DiscountForMonth(student, gross, month);
            }
            var effective = gross - discount;
            if (effective < 0) effective = 0;

            var paid = paidByMonth.GetValueOrDefault(month, 0m);
            var remaining = effective - paid;
            if (remaining < 0) remaining = 0;
            var status = effective <= 0 || remaining <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
            months.Add(new GroupMonthDto(month, effective, paid, remaining, status));
        }
        return new GroupLedgerDto(group.Id, group.Name, courseName, months);
    }

    /// <summary>Aktivlashtirilgan oyning qisman narxi (TuitionService.ChargeActivationProrate bilan bir formula).</summary>
    private static decimal ActivationGross(Group cls, string dateIso)
    {
        if (cls.MonthlyFee <= 0 || !DateOnly.TryParse(dateIso, out var d)) return cls.MonthlyFee;
        var ms = new DateOnly(d.Year, d.Month, 1);
        var me = new DateOnly(d.Year, d.Month, DateTime.DaysInMonth(d.Year, d.Month));
        var total = TuitionService.LessonsInRange(cls.Days, ms, me);
        var rem = TuitionService.LessonsInRange(cls.Days, d, me);
        if (total <= 0 || rem <= 0) return 0m;
        return decimal.Round(cls.MonthlyFee * rem / total, 2);
    }

    /// <summary>Muzlatilgan oyning qisman narxi (TuitionService.ChargeFreezeProrate bilan bir formula).</summary>
    private static decimal FreezeGross(Group cls, string actIso, string fzIso)
    {
        if (cls.MonthlyFee <= 0 || !DateOnly.TryParse(fzIso, out var fz)) return 0m;
        var ms = new DateOnly(fz.Year, fz.Month, 1);
        var me = new DateOnly(fz.Year, fz.Month, DateTime.DaysInMonth(fz.Year, fz.Month));
        var total = TuitionService.LessonsInRange(cls.Days, ms, me);
        var from = ms;
        if (actIso.Length >= 10 && actIso[..7] == fzIso[..7] && DateOnly.TryParse(actIso, out var act) && act > ms)
            from = act;
        var before = fz > from ? TuitionService.LessonsInRange(cls.Days, from, fz.AddDays(-1)) : 0;
        return total > 0 && before > 0 ? decimal.Round(cls.MonthlyFee * before / total, 2) : 0m;
    }
}
