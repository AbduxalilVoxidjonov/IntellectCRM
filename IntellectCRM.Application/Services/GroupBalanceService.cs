using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// PER-GURUH balans (qarz/avans) — guruh kontekstidagi ro'yxatlar uchun.
/// <para>Muammo: <see cref="Student.Balance"/> — o'quvchining BARCHA guruhlari bo'yicha UMUMIY balans.
/// O'quvchi 2+ guruhda o'qib, faqat bittasiga to'lasa, umumiy balans manfiy bo'lib qoladi va HAR IKKALA
/// o'qituvchi uni "qarzdor" (qizil) ko'rardi. Bu servis har guruh uchun ALOHIDA hisoblaydi: to'lagan
/// guruhida yashil, to'lamaganida qizil.</para>
/// <para>Formula (belgi <see cref="Student.Balance"/> bilan bir xil — manfiy = qarz):
/// <c>balans_g = (shu guruhga to'langan − vozvrat) − (shu guruh uchun hisoblangan)</c>, bunda
/// hisob = <see cref="MonthlyCharge"/> qatorlari (Amount − Discount) <c>GroupId == g</c>,
/// to'lov = <see cref="FinanceTransaction"/> (income+tuition, minus expense+refund) <c>GroupId == g</c>.</para>
/// <para>TEGLANMAGAN (GroupId=null — per-guruh billingdan OLDINGI eski yozuvlar) to'lov VA hisob guruhlar
/// oylik narxi (MonthlyFee) nisbatida taqsimlanadi — <see cref="SalaryLedger"/>dagi foizli maosh bazasi
/// bilan AYNAN bir xil konvensiya (bir xil pul ikki joyda turlicha taqsimlanmasin). Ikkala tomon ham BIR XIL
/// qoida bilan taqsimlangani muhim: eski (teglanmagan hisob + teglanmagan to'lov) juftligi bir-birini
/// to'liq so'ndiradi — to'lagan o'quvchi eski oylar tufayli qizil bo'lib qolmaydi.</para>
/// <para>Shu oyda BILLABLE a'zoligi bo'lmagan davr yozuvlari (masalan o'quvchi hali hech bir guruhda
/// bo'lmaganda yozilgan hisob) hech bir guruhga taqsimlanmaydi — ular umumiy balansda qoladi.</para>
/// </summary>
public static class GroupBalanceService
{
    /// <summary>Bitta guruh bo'yicha: studentId → shu guruhdagi balans (manfiy = qarz).
    /// Ro'yxatdagi HAR o'quvchi uchun kalit qaytadi (hisob/to'lovi bo'lmasa 0).</summary>
    public static async Task<Dictionary<string, decimal>> ForGroupAsync(
        IAppDbContext db, string groupId, IEnumerable<string> studentIds)
    {
        var ids = studentIds.Distinct().ToList();
        var result = ids.ToDictionary(id => id, _ => 0m);
        if (ids.Count == 0 || string.IsNullOrEmpty(groupId)) return result;

        // Teglanmagan (GroupId=null) hisob/to'lovlar: (o'quvchi, oy) → net summa. Oxirida narx
        // nisbatida taqsimlanadi (hisob manfiy, to'lov musbat — ikkalasi bir xil qoida bilan).
        var untagged = new Dictionary<(string StudentId, string Month), decimal>();
        void AddUntagged(string studentId, string month, decimal amount) =>
            untagged[(studentId, month)] = untagged.GetValueOrDefault((studentId, month), 0m) + amount;

        // (1) Hisoblangan summa (chegirmadan keyin) — qarz tomoni. Shu guruhniki to'g'ridan-to'g'ri,
        //     teglanmagani (eski aggregate qator) taqsimlash uchun yig'iladi.
        var charges = await db.MonthlyCharges.AsNoTracking()
            .Where(c => ids.Contains(c.StudentId) && (c.GroupId == groupId || c.GroupId == null))
            .Select(c => new { c.StudentId, c.GroupId, c.Month, c.Amount, c.Discount })
            .ToListAsync();
        foreach (var c in charges)
        {
            if (!result.ContainsKey(c.StudentId)) continue;
            var effective = Math.Max(0m, c.Amount - c.Discount);
            if (effective == 0m) continue;
            if (c.GroupId == groupId) result[c.StudentId] -= effective;
            else if (c.Month.Length >= 7) AddUntagged(c.StudentId, c.Month[..7], -effective);
        }

        // (2) To'lovlar (kirim tuition) va VOZVRATLAR (chiqim refund — manfiy).
        var movements = await db.FinanceTransactions.AsNoTracking()
            .Where(t => t.StudentId != null && ids.Contains(t.StudentId)
                        && ((t.Direction == "income" && t.Category == "tuition")
                            || (t.Direction == "expense" && t.Category == "refund")))
            .Select(t => new { StudentId = t.StudentId!, t.GroupId, t.Month, t.Date, t.Amount, t.Direction })
            .ToListAsync();

        foreach (var m in movements)
        {
            var amount = m.Direction == "expense" ? -m.Amount : m.Amount;
            if (amount == 0m || !result.ContainsKey(m.StudentId)) continue;
            if (m.GroupId == groupId) { result[m.StudentId] += amount; continue; }
            if (!string.IsNullOrEmpty(m.GroupId)) continue; // boshqa guruhga teglangan — bizga tegishli emas
            // Teglanmagan to'lov — qaysi OYGA tegishli bo'lsa (Month tegi bo'lsa u, aks holda to'lov sanasi).
            var month = m.Month is { Length: >= 7 } tagged ? tagged[..7]
                : m.Date.Length >= 7 ? m.Date[..7] : "";
            if (month.Length == 0) continue;
            AddUntagged(m.StudentId, month, amount);
        }

        // (3) Teglanmagan hisob/to'lovlarning shu guruhga tegishli ULUSHINI qo'shamiz (narx nisbatida).
        if (untagged.Count > 0)
        {
            var memberships = await db.StudentGroups.AsNoTracking()
                .Where(sg => ids.Contains(sg.StudentId)).ToListAsync();
            var groupIds = memberships.Select(m => m.GroupId).Distinct().ToList();
            var feeByGroup = await db.Classes.AsNoTracking()
                .Where(c => groupIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.MonthlyFee);
            var byStudent = memberships.GroupBy(m => m.StudentId)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var ((sid, month), amount) in untagged)
            {
                if (!byStudent.TryGetValue(sid, out var membs)) continue;
                var billable = membs.Where(m => BillableInMonth(m, month)).ToList();
                var denom = billable.Sum(m => feeByGroup.GetValueOrDefault(m.GroupId, 0m));
                if (denom <= 0) continue; // shu oyda billable guruh yo'q — taqsimlab bo'lmaydi
                var fee = billable.Any(m => m.GroupId == groupId)
                    ? feeByGroup.GetValueOrDefault(groupId, 0m) : 0m;
                if (fee <= 0) continue;   // shu oyda bu guruh billable emas
                result[sid] += amount * fee / denom;
            }
        }

        foreach (var key in result.Keys.ToList())
            result[key] = decimal.Round(result[key], 2);
        return result;
    }

    /// <summary>A'zolik shu oyda hisob-kitobga kiradimi (sinov emas, aktivlashtirilgan..muzlatilgan oralig'ida).
    /// <see cref="SalaryLedger"/>dagi taqsimlash sharti bilan bir xil.</summary>
    private static bool BillableInMonth(StudentGroup m, string month)
    {
        if (m.Status == "trial") return false;
        var actOk = m.ActivatedAt.Length < 7 || string.CompareOrdinal(month, m.ActivatedAt[..7]) >= 0;
        var frzOk = m.FrozenAt.Length < 7 || string.CompareOrdinal(month, m.FrozenAt[..7]) <= 0;
        return actOk && frzOk;
    }
}
