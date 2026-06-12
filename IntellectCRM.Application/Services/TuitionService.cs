using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Oylik to'lovlarni hisoblash (accrual). Har oy har bir o'quvchiga sinf oylik
/// to'lovi miqdorida qarz yoziladi: balans kamayadi va MonthlyCharge yozuvi yaratiladi.
/// To'lanmagan oylar balansda jamlanib boradi.
/// </summary>
public static class TuitionService
{
    public static string CurrentMonth() => AppClock.Now.ToString("yyyy-MM");

    /// <summary>
    /// Sinf oylik to'lovidan o'quvchining chegirmasini ayirib, hisoblanishi kerak bo'lgan
    /// summa. Avval foiz olib tashlanadi (<paramref name="discountPct"/>, 0..100), keyin aniq
    /// summa (<paramref name="discountAmount"/>) ayriladi. Manfiy chiqsa — 0 qaytadi.
    /// </summary>
    public static decimal ChargeFor(decimal fee, int discountPct, decimal discountAmount)
    {
        if (fee <= 0) return 0m;
        var pct = Math.Clamp(discountPct, 0, 100);
        var amount = Math.Max(0m, discountAmount);
        var afterPct = fee * (100 - pct) / 100m;
        var charge = afterPct - amount;
        if (charge < 0m) charge = 0m;
        return decimal.Round(charge, 2);
    }

    /// <summary>O'quvchining shu paytdagi haqiqiy oylik to'lovi (sinf narxi minus chegirma).
    /// Sinf topilmasa yoki narx 0 bo'lsa — 0 qaytadi.</summary>
    public static decimal ChargeFor(Student s, IDictionary<string, decimal> feeByClassName) =>
        feeByClassName.TryGetValue(s.ClassName, out var fee)
            ? ChargeFor(fee, s.DiscountPct, s.DiscountAmount)
            : 0m;

    /// <summary>Berilgan oylik to'lovga qo'yiladigan chegirma summasi (fee − effective).
    /// Chegirma fee dan oshmaydi.</summary>
    public static decimal DiscountFor(decimal fee, int discountPct, decimal discountAmount)
    {
        if (fee <= 0) return 0m;
        var effective = ChargeFor(fee, discountPct, discountAmount);
        return decimal.Round(fee - effective, 2);
    }

    /// <summary>
    /// Guruh oylik to'lovi o'zgarganda JORIY oy hisobini qayta hisoblaydi: shu guruhga
    /// (asosiy <c>ClassName</c> bo'yicha) biriktirilgan o'quvchilarning shu oygi
    /// <see cref="MonthlyCharge"/> yozuvini yangi narxga moslaydi, balansni farqqa to'g'rilaydi,
    /// <c>Locked</c> (qo'lda tahrirlangan) yozuvlarni o'tkazib yuboradi. Faqat shu oyda hisob
    /// yozuvi BOR o'quvchilar tegiladi (hali hisoblanmagan o'quvchi keyingi AccrueMonth orqali yangi
    /// narxda hisoblanadi). Qaytaradi: nechta o'quvchiga qo'llandi. SaveChanges — chaqiruvchida.
    /// </summary>
    public static async Task<int> ApplyGroupFeeToCurrentMonthAsync(IAppDbContext db, string groupId, string groupName, decimal newFee)
    {
        var month = CurrentMonth();
        var applied = 0;

        // (1) Shu GURUHGA a'zo o'quvchilarning shu oy per-guruh hisobi (GroupId == groupId).
        if (!string.IsNullOrWhiteSpace(groupId))
        {
            var groupCharges = await db.MonthlyCharges
                .Where(c => c.GroupId == groupId && c.Month == month).ToListAsync();
            if (groupCharges.Count > 0)
            {
                var sids = groupCharges.Select(c => c.StudentId).Distinct().ToList();
                var byId = (await db.Students.Where(s => sids.Contains(s.Id)).ToListAsync())
                    .ToDictionary(s => s.Id);
                foreach (var charge in groupCharges)
                    if (ApplyFeeToCharge(charge, byId.GetValueOrDefault(charge.StudentId), newFee)) applied++;
            }
        }

        // (2) Guruhsiz o'quvchilar (a'zoligi yo'q, ClassName == groupName) — GroupId=null hisobi.
        if (!string.IsNullOrWhiteSpace(groupName))
        {
            var nameStudents = await db.Students.Where(s => s.ClassName == groupName).ToListAsync();
            if (nameStudents.Count > 0)
            {
                var ids = nameStudents.Select(s => s.Id).ToList();
                var nameCharges = await db.MonthlyCharges
                    .Where(c => c.GroupId == null && c.Month == month && ids.Contains(c.StudentId)).ToListAsync();
                var byId = nameStudents.ToDictionary(s => s.Id);
                foreach (var charge in nameCharges)
                    if (ApplyFeeToCharge(charge, byId.GetValueOrDefault(charge.StudentId), newFee)) applied++;
            }
        }
        return applied;
    }

    /// <summary>Bitta hisob qatorini yangi narxga moslaydi (balans farqqa to'g'rilanadi). <c>Locked</c>
    /// (qo'lda tahrirlangan) yoki o'zgarishsiz bo'lsa tegmaydi. Qaytaradi: qo'llandimi.</summary>
    private static bool ApplyFeeToCharge(MonthlyCharge charge, Student? s, decimal newFee)
    {
        if (s is null || charge.Locked) return false;
        var newDiscount = DiscountFor(newFee, s.DiscountPct, s.DiscountAmount);
        var newEffective = newFee - newDiscount;
        var oldEffective = charge.Amount - charge.Discount;
        var delta = newEffective - oldEffective;
        if (delta == 0 && charge.Amount == newFee && charge.Discount == newDiscount) return false;
        charge.Amount = newFee;
        charge.Discount = newDiscount;
        s.Balance -= delta;
        return true;
    }

    /// <summary>"yyyy-MM" -> keyingi oy "yyyy-MM".</summary>
    public static string NextMonth(string month)
    {
        var year = int.Parse(month[..4]);
        var m = int.Parse(month[5..]);
        if (m == 12) { year++; m = 1; } else { m++; }
        return $"{year:D4}-{m:D2}";
    }

    /// <summary>fromMonth..toMonth (inklyuziv) oralig'idagi oylar ("yyyy-MM"). from > to bo'lsa — bo'sh.</summary>
    public static IEnumerable<string> MonthRange(string fromMonth, string toMonth)
    {
        if (string.IsNullOrEmpty(fromMonth) || string.IsNullOrEmpty(toMonth)) yield break;
        var m = fromMonth;
        while (string.CompareOrdinal(m, toMonth) <= 0)
        {
            yield return m;
            m = NextMonth(m);
        }
    }

    /// <summary>
    /// O'quv yili boshlanish oyi ("yyyy-MM") — faol (arxivlanmagan) o'quvchilarning ENG ERTA
    /// qabul (EnrollmentDate) oyi. Faol o'quvchi yoki sana bo'lmasa — joriy oy.
    /// Maosh/hisob shu oydan boshlanadi.
    /// </summary>
    public static async Task<string> AcademicYearStartMonthAsync(IAppDbContext db)
    {
        var dates = await db.Students
            .Where(s => !s.IsArchived && s.EnrollmentDate.Length >= 7)
            .Select(s => s.EnrollmentDate).ToListAsync();
        return dates.Count == 0 ? CurrentMonth() : dates.Min()![..7];
    }

    /// <summary>
    /// Frontend jadval/hafta navigatsiyasi uchun BITTA sintetik davr (markazda chorak tizimi yo'q).
    /// O'quv yili boshlanish oyidan ~10 oy oraliq. Frontend shu davrni haftalarga bo'lib jadvalni
    /// ko'rsatadi (eski chorak-asosli mantiq buzilmasin).
    /// </summary>
    public static async Task<List<QuarterPeriodDto>> SyntheticPeriodsAsync(IAppDbContext db)
    {
        var start = await AcademicYearStartMonthAsync(db);
        var end = start;
        for (var i = 0; i < 10; i++) end = NextMonth(end);
        return new List<QuarterPeriodDto> { new(1, $"{start}-01", $"{end}-28", true) };
    }

    /// <summary>
    /// O'quvchining shu paytdagi to'liq oylik to'lovi (chegirmasiz). Ko'p-guruh: barcha FAOL
    /// guruhlari oylik narxining yig'indisi (aggregate). A'zoligi bo'lmasa — eski ClassName
    /// bo'yicha guruh narxi (orqaga moslik). <paramref name="feesById"/>/<paramref name="feesByName"/>
    /// — oldindan yuklangan narx jadvallari; <paramref name="activeGroupIds"/> — o'quvchining
    /// faol guruh id'lari.
    /// </summary>
    public static decimal GrossFee(
        Student s,
        IDictionary<string, decimal> feesById,
        IDictionary<string, decimal> feesByName,
        IReadOnlyCollection<string>? activeGroupIds)
    {
        if (activeGroupIds is { Count: > 0 })
            return activeGroupIds.Sum(gid => feesById.TryGetValue(gid, out var f) ? f : 0m);
        return feesByName.TryGetValue(s.ClassName, out var fee) ? fee : 0m;
    }

    /// <summary>Hafta kunlari (0=Du..6=Yak) bo'yicha [from..to] (inklyuziv) oralig'idagi darslar soni.</summary>
    public static int LessonsInRange(IReadOnlyCollection<int> days, DateOnly from, DateOnly to)
    {
        if (days.Count == 0 || from > to) return 0;
        var set = days.ToHashSet();
        var count = 0;
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            var wd = ((int)d.DayOfWeek + 6) % 7; // Dushanba=0..Yakshanba=6
            if (set.Contains(wd)) count++;
        }
        return count;
    }

    /// <summary>Aktivlashtirilgan oyning QISMAN to'lovini hisoblab o'quvchiga yozadi (balans kamayadi,
    /// shu oy MonthlyCharge'iga qo'shiladi yoki yaratiladi). Formula: bir dars = guruh oylik narxi ÷ SHU
    /// OYDAGI jami dars soni (guruh kunlari bo'yicha); to'lov = bir dars × shu sanadan oy oxirigacha qolgan
    /// dars. Qolgan ≤ jami bo'lgani uchun to'liq oylikdan oshmaydi. Chegirma qo'llanadi. SaveChanges — chaqiruvchida.</summary>
    public static async Task ChargeActivationProrateAsync(IAppDbContext db, Student s, Group cls, string dateIso)
    {
        if (cls.MonthlyFee <= 0 || dateIso.Length < 10 || !DateOnly.TryParse(dateIso, out var d)) return;
        var monthStart = new DateOnly(d.Year, d.Month, 1);
        var monthEnd = new DateOnly(d.Year, d.Month, DateTime.DaysInMonth(d.Year, d.Month));
        var totalInMonth = LessonsInRange(cls.Days, monthStart, monthEnd);
        var remaining = LessonsInRange(cls.Days, d, monthEnd);
        if (totalInMonth <= 0 || remaining <= 0) return; // shu oyda dars yo'q — qisman to'lov yo'q

        // Bir dars = oylik narx ÷ shu oydagi jami dars; to'lov = bir dars × qolgan dars (qolgan ≤ jami → to'liqdan oshmaydi).
        var gross = decimal.Round(cls.MonthlyFee * remaining / totalInMonth, 2);
        if (gross <= 0) return;

        var month = dateIso[..7];
        var discount = DiscountFor(gross, s.DiscountPct, s.DiscountAmount);
        var effective = gross - discount;

        // Per-guruh billingga o'tdik — shu oyning eski aggregate (GroupId=null) qatorini darhol tozalaymiz.
        await PurgeAggregateRowAsync(db, s, month);
        // Per-guruh: hisob shu GURUH (cls.Id) uchun yoziladi.
        var existing = await db.MonthlyCharges.FirstOrDefaultAsync(c => c.StudentId == s.Id && c.GroupId == cls.Id && c.Month == month);
        if (existing is null)
        {
            db.MonthlyCharges.Add(new MonthlyCharge
            {
                StudentId = s.Id, GroupId = cls.Id, Month = month, Amount = gross, Discount = discount, Date = dateIso,
            });
            s.Balance -= effective;
        }
        else
        {
            // IDEMPOTENT: qayta aktivlashtirilsa (yoki ikki marta bosilsa) shu oy hisobini ustiga QO'SHMAY
            // ALMASHTIRAMIZ — ikki marta yozilib qolmasin. Eski effektivni balansga qaytarib, yangisini yechamiz.
            var oldEffective = Math.Max(0m, existing.Amount - existing.Discount);
            existing.Amount = gross;
            existing.Discount = discount;
            existing.Date = dateIso;
            s.Balance += oldEffective - effective;
        }
    }

    /// <summary>MUZLATILGAN oyning QISMAN to'lovini hisoblaydi: o'quvchi shu oyda muzlatilgunga QADAR qatnashgan
    /// darslar uchun to'lov. Bir dars = oylik narx ÷ shu oydagi jami dars; to'lov = bir dars × (faol boshlanishidan
    /// muzlatish sanasigacha, sanasidan OLDINGI darslar). Faol boshlanishi = shu oyda aktivlashtirilgan bo'lsa o'sha
    /// sana, aks holda oy boshi. Mavjud yozuvni IDEMPOTENT almashtiradi; <c>Locked</c> bo'lsa tegmaydi.</summary>
    public static async Task ChargeFreezeProrateAsync(IAppDbContext db, Student s, Group cls, string activatedAtIso, string freezeDateIso)
    {
        if (cls.MonthlyFee <= 0 || freezeDateIso.Length < 10 || !DateOnly.TryParse(freezeDateIso, out var fz)) return;
        var monthStart = new DateOnly(fz.Year, fz.Month, 1);
        var monthEnd = new DateOnly(fz.Year, fz.Month, DateTime.DaysInMonth(fz.Year, fz.Month));
        var totalInMonth = LessonsInRange(cls.Days, monthStart, monthEnd);
        var month = freezeDateIso[..7];

        // Faol boshlanishi: shu oyda aktivlashtirilgan bo'lsa o'sha sanadan, aks holda oy boshidan.
        var activeFrom = monthStart;
        if (!string.IsNullOrEmpty(activatedAtIso) && activatedAtIso.Length >= 10 && activatedAtIso[..7] == month
            && DateOnly.TryParse(activatedAtIso, out var act) && act > monthStart)
            activeFrom = act;
        // Muzlatish sanasidan OLDINGI darslar (shu sananing o'zi hisoblanmaydi — "shu sanadan to'xtaydi").
        var before = fz > activeFrom ? LessonsInRange(cls.Days, activeFrom, fz.AddDays(-1)) : 0;
        var gross = totalInMonth > 0 && before > 0 ? decimal.Round(cls.MonthlyFee * before / totalInMonth, 2) : 0m;
        var discount = gross > 0 ? DiscountFor(gross, s.DiscountPct, s.DiscountAmount) : 0m;
        var effective = gross - discount;

        // Per-guruh billingga o'tdik — shu oyning eski aggregate (GroupId=null) qatorini darhol tozalaymiz
        // (aks holda muzlatish faqat per-guruh qatorni kamaytirib, aggregate qator to'liq oy bo'lib qolardi).
        await PurgeAggregateRowAsync(db, s, month);
        var existing = await db.MonthlyCharges.FirstOrDefaultAsync(c => c.StudentId == s.Id && c.GroupId == cls.Id && c.Month == month);
        if (existing is null)
        {
            if (gross <= 0) return;
            db.MonthlyCharges.Add(new MonthlyCharge
            {
                StudentId = s.Id, GroupId = cls.Id, Month = month, Amount = gross, Discount = discount, Date = freezeDateIso,
            });
            s.Balance -= effective;
        }
        else
        {
            if (existing.Locked) return; // qo'lda tahrirlangan — tegmaymiz.
            var oldEffective = Math.Max(0m, existing.Amount - existing.Discount);
            existing.Amount = gross;
            existing.Discount = discount;
            existing.Date = freezeDateIso;
            s.Balance += oldEffective - effective;
        }
    }

    /// <summary>Bitta oy uchun hisoblash (PER-GURUH). Har FAOL a'zolik uchun alohida hisob qatori
    /// (StudentId, GroupId, Month); guruhsiz (eski ClassName) o'quvchiga GroupId=null. Allaqachon hisoblangan
    /// (o'quvchi, guruh) juftliklari o'tkazib yuboriladi — idempotent.</summary>
    public static async Task<(int Count, decimal Total)> AccrueMonth(IAppDbContext db, string month)
    {
        var classList = await db.Classes.ToListAsync();
        var feesById = classList.ToDictionary(c => c.Id, c => c.MonthlyFee);
        var feesByName = classList.GroupBy(c => c.Name).ToDictionary(g => g.Key, g => g.First().MonthlyFee);
        // Barcha a'zoliklar (holat bilan). Oylik to'lov faqat FAOL (active) a'zolikka — aktivlashtirilgan
        // oydan KEYINGI oylar uchun (aktiv oyi qisman to'lov bilan alohida yozilgan) va muzlatish oyidan OLDIN.
        var membershipsByStudent = (await db.StudentGroups.ToListAsync())
            .GroupBy(sg => sg.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());
        // Idempotentlik PER-GURUH: (o'quvchi, guruh) juftligi shu oyda allaqachon hisoblangan bo'lsa o'tkazamiz.
        var already = (await db.MonthlyCharges.Where(c => c.Month == month)
                .Select(c => new { c.StudentId, c.GroupId }).ToListAsync())
            .Select(x => (x.StudentId, x.GroupId)).ToHashSet();
        // Arxivlangan o'quvchilarga oylik hisoblanmaydi.
        var students = await db.Students.Where(s => !s.IsArchived).ToListAsync();

        var count = 0;
        decimal total = 0;
        foreach (var s in students)
        {
            // O'quvchi shu oydan oldin kelmagan bo'lsa, hisoblamaymiz.
            if (!string.IsNullOrEmpty(s.EnrollmentDate) && string.CompareOrdinal(s.EnrollmentDate[..7], month) > 0) continue;

            if (membershipsByStudent.TryGetValue(s.Id, out var mships) && mships.Count > 0)
            {
                // Har FAOL a'zolik uchun alohida hisob qatori.
                foreach (var m in mships)
                {
                    if (m.Status != "active") continue;
                    if (!(m.ActivatedAt.Length >= 7 && string.CompareOrdinal(month, m.ActivatedAt[..7]) > 0)) continue;
                    if (!(m.FrozenAt.Length < 7 || string.CompareOrdinal(month, m.FrozenAt[..7]) < 0)) continue;
                    if (already.Contains((s.Id, (string?)m.GroupId))) continue;
                    var gfee = feesById.TryGetValue(m.GroupId, out var f) ? f : 0m;
                    if (gfee <= 0) continue;
                    total += AccrueOne(db, s, m.GroupId, month, gfee);
                    count++;
                }
            }
            else
            {
                // Guruhsiz (eski ClassName) — GroupId=null, narx ClassName→guruh nomi orqali.
                if (already.Contains((s.Id, (string?)null))) continue;
                var nfee = feesByName.TryGetValue(s.ClassName, out var nf) ? nf : 0m;
                if (nfee <= 0) continue;
                total += AccrueOne(db, s, null, month, nfee);
                count++;
            }
        }

        if (count > 0) await db.SaveChangesAsync();
        return (count, total);
    }

    /// <summary>Bitta (o'quvchi, guruh, oy) hisob qatorini yozadi va balansni effektiv miqdorda kamaytiradi.
    /// Amount = to'liq narx; Discount = chegirma; effektiv = Amount − Discount. Effektiv qaytariladi.
    /// Effektiv 0 (100% chegirma) bo'lsa ham qator qoldiriladi — hisobotda ko'rinsin. SaveChanges — chaqiruvchida.</summary>
    private static decimal AccrueOne(IAppDbContext db, Student s, string? groupId, string month, decimal fee)
    {
        var discount = DiscountFor(fee, s.DiscountPct, s.DiscountAmount);
        var effective = fee - discount;
        db.MonthlyCharges.Add(new MonthlyCharge
        {
            StudentId = s.Id, GroupId = groupId, Month = month, Amount = fee, Discount = discount, Date = $"{month}-01",
        });
        s.Balance -= effective;
        return effective;
    }

    /// <summary>AVANS uchun: berilgan (o'quvchi, guruh, oy) hisobi mavjudligini ta'minlaydi — yo'q bo'lsa
    /// to'liq oylik narxda yaratadi (balans effektiv miqdorda kamayadi). Kassir kelajak oyga to'lasa, o'sha
    /// oy hisobi shu zahoti ochiladi. Mavjud bo'lsa tegmaydi (idempotent). null narx/guruh bo'lsa — hech narsa.
    /// SaveChanges — chaqiruvchida. Qaytaradi: yangi hisob yaratildimi.</summary>
    public static async Task<bool> EnsureChargeAsync(IAppDbContext db, Student s, string? groupId, string month)
    {
        if (month.Length < 7) return false;
        var existing = await db.MonthlyCharges
            .FirstOrDefaultAsync(c => c.StudentId == s.Id && c.GroupId == groupId && c.Month == month);
        if (existing is not null) return false;

        decimal fee;
        if (groupId is null)
            fee = (await db.Classes.FirstOrDefaultAsync(c => c.Name == s.ClassName))?.MonthlyFee ?? 0m;
        else
            fee = (await db.Classes.Where(c => c.Id == groupId).Select(c => c.MonthlyFee).FirstOrDefaultAsync());
        if (fee <= 0) return false;

        AccrueOne(db, s, groupId, month, fee);
        return true;
    }

    /// <summary>
    /// Hisoblanishi kerak bo'lgan BARCHA oylarni (eng erta o'quvchi kelgan oydan / o'quv yili
    /// boshidan — qaysi biri ertaroq — joriy oygacha) to'ldiradi. Har oy uchun
    /// <see cref="AccrueMonth"/> chaqiriladi: u idempotent (allaqachon hisoblangan o'quvchini
    /// o'tkazib yuboradi) va har o'quvchini faqat o'z EnrollmentDate'idan boshlab hisoblaydi.
    /// Shu sabab: import/seed orqali qo'shilgan, hali hisoblanmagan o'quvchilar ham tutiladi,
    /// va oraliqdagi "tushib qolgan" oylar to'ldiriladi (avvalgi xulq faqat oxirgi oydan
    /// keyingi oylarni qo'shardi — yangi/eski o'quvchilar 0 bo'lib qolardi).
    /// </summary>
    public static async Task<List<string>> AccrueDue(IAppDbContext db)
    {
        // Avval eski aggregate (GroupId=null) + per-guruh dublikat hisoblarni tozalaymiz (o'z-o'zini tuzatish).
        await PurgeDuplicateAggregateChargesAsync(db);

        var cur = CurrentMonth();
        var start = await AcademicYearStartMonthAsync(db);

        // Faol o'quvchilarning eng erta kelgan oyi (o'quv yili boshidan oldin kelgan bo'lsa,
        // o'sha oydan boshlab). AccrueMonth har o'quvchini o'z enrollment'idan tekshiradi.
        var enrolls = await db.Students
            .Where(s => !s.IsArchived && s.EnrollmentDate != null && s.EnrollmentDate.Length >= 7)
            .Select(s => s.EnrollmentDate).ToListAsync();
        if (enrolls.Count > 0)
        {
            var minEnroll = enrolls.Min()![..7];
            if (string.CompareOrdinal(minEnroll, start) < 0) start = minEnroll;
        }

        if (string.CompareOrdinal(start, cur) > 0) start = cur; // o'quv yili hali boshlanmagan bo'lsa

        var accrued = new List<string>();
        foreach (var month in MonthRange(start, cur))
        {
            var (count, _) = await AccrueMonth(db, month);
            if (count > 0) accrued.Add(month);
        }
        return accrued;
    }

    /// <summary>DUBLIKAT TUZATISH: o'quvchi guruhga qo'shilib per-guruh billingiga o'tganda, u guruhsiz paytda
    /// yozilgan eski ClassName-asosli aggregate (GroupId=null) hisob qatori SHU OY uchun per-guruh qator bilan
    /// BIRGA qolib ketishi mumkin (per-guruh qator yaratilganda null qator o'chirilmaydi). Bu ikki muammo beradi:
    ///  (1) <see cref="StudentLedger"/> oy summasini ikkala qatorni qo'shib IKKI BARAVAR ko'rsatadi;
    ///  (2) <see cref="ChargeFreezeProrateAsync"/> faqat per-guruh qatorni kamaytirgani uchun aggregate qator
    ///      to'liq oy bo'lib qolib, MUZLATILGANDAN keyin ham "o'qilmagan keyingi kunlar"ni hisoblab turadi.
    /// Bu yerda: bir (o'quvchi, oy) uchun HAM null, HAM kamida bitta per-guruh qator bo'lsa — null (aggregate)
    /// qatorni o'chiramiz va uning effektiv summasini balansga QAYTARAMIZ (yaratilganda balans kamaygan edi).
    /// Idempotent + o'z-o'zini tuzatuvchi (har AccrueDue siklida ishlaydi, mavjud prod ma'lumotini ham tozalaydi).</summary>
    /// <summary>Bitta (o'quvchi, oy) uchun aggregate (GroupId=null) hisob qatorini o'chiradi va effektivni
    /// balansga qaytaradi. Per-guruh qator yozishdan oldin chaqiriladi (dublikat oldini olish). SaveChanges — chaqiruvchida.</summary>
    private static async Task PurgeAggregateRowAsync(IAppDbContext db, Student s, string month)
    {
        var nullRow = await db.MonthlyCharges
            .FirstOrDefaultAsync(c => c.StudentId == s.Id && c.GroupId == null && c.Month == month);
        if (nullRow is null) return;
        s.Balance += Math.Max(0m, nullRow.Amount - nullRow.Discount);
        db.MonthlyCharges.Remove(nullRow);
    }

    public static async Task<int> PurgeDuplicateAggregateChargesAsync(IAppDbContext db)
    {
        var all = await db.MonthlyCharges.ToListAsync();
        var dupNullRows = all
            .GroupBy(c => (c.StudentId, c.Month))
            .Where(g => g.Any(c => c.GroupId == null) && g.Any(c => c.GroupId != null))
            .SelectMany(g => g.Where(c => c.GroupId == null))
            .ToList();
        if (dupNullRows.Count == 0) return 0;

        var ids = dupNullRows.Select(c => c.StudentId).Distinct().ToList();
        var students = (await db.Students.Where(s => ids.Contains(s.Id)).ToListAsync())
            .ToDictionary(s => s.Id);
        foreach (var row in dupNullRows)
        {
            if (students.TryGetValue(row.StudentId, out var s))
                s.Balance += Math.Max(0m, row.Amount - row.Discount); // yaratilganda yechilgan effektivni qaytaramiz
            db.MonthlyCharges.Remove(row);
        }
        await db.SaveChangesAsync();
        return dupNullRows.Count;
    }
}
