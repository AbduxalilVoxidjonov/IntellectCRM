namespace IntellectCRM.Application.Services;

/// <summary>
/// O'quvchi a'zoligi (StudentGroup) holat jamlagichi — YAGONA MANBA. O'qituvchilar hisoboti
/// (<see cref="TeacherActivityReport"/>) va o'qituvchi "performance" (TeachersController) AYNAN shu
/// ta'rifni ishlatadi, shuning uchun raqamlar hamma joyda bir xil chiqadi.
///
/// Ta'rif (arxivlanmagan guruhlar bo'yicha, per-a'zolik):
///   Ketgan  (Left)   = !IsActive yoki LeftAt bor
///   qolganlar (a'zo) → holatiga qarab:
///     Faol   (Active) = Status=="active" (yoki noma'lum holat)
///     Sinov  (Trial)  = Status=="trial"
///     Muzlat (Frozen) = Status=="frozen"
///   Kelgan (Came)      = jami a'zolik
///   Qolgan (Remaining) = Active + Trial + Frozen = Came − Left (hozir a'zolar).
/// </summary>
public readonly record struct LifecycleTally(int Came, int Active, int Trial, int Frozen, int Left)
{
    /// <summary>Hozir a'zo (faol + sinov + muzlatilgan) = Came − Left.</summary>
    public int Remaining => Active + Trial + Frozen;
    /// <summary>Kelganlardan faol bo'lib qolganlar foizi (Active / Came * 100). Came=0 → null.</summary>
    public int? ConversionPct => Came > 0 ? (int)System.Math.Round(Active * 100.0 / Came) : null;
    /// <summary>Retention % (Faol / Came * 100), bir kasr xona bilan.</summary>
    public double Retention => Came > 0 ? System.Math.Round((double)Active / Came * 100, 1) : 0;
    /// <summary>Yo'qotish % ((Muzlatilgan + Ketgan) / Came * 100).</summary>
    public double Loss => Came > 0 ? System.Math.Round((double)(Frozen + Left) / Came * 100, 1) : 0;
}

/// <summary>A'zoliklar ro'yxatidan <see cref="LifecycleTally"/> hisoblaydi.</summary>
public static class MembershipLifecycle
{
    public static LifecycleTally Tally(IEnumerable<(string Status, bool IsActive, string? LeftAt)> memberships)
    {
        int came = 0, active = 0, trial = 0, frozen = 0, left = 0;
        foreach (var (status, isActive, leftAt) in memberships)
        {
            came++;
            if (!isActive || !string.IsNullOrEmpty(leftAt)) { left++; continue; }
            switch (status)
            {
                case "trial": trial++; break;
                case "frozen": frozen++; break;
                default: active++; break; // "active" yoki noma'lum → faol
            }
        }
        return new LifecycleTally(came, active, trial, frozen, left);
    }

    /// <summary>
    /// A'zolik SHU OYDA pullik (billable) bo'lganmi — ya'ni oylik to'lov hisoblanadigan oymi.
    ///
    /// <para><b>YAGONA TA'RIF.</b> Maosh (<c>SalaryLedger</c>) teglanmagan to'lovni guruhlar orasida
    /// shu qoida bo'yicha taqsimlaydi, ushlab turish bonusi (<c>RetentionBonusService</c>) esa
    /// "shu oyda o'quvchi haqiqatan o'qiganmi" savoliga shu bilan javob beradi. Ikki nusxa bo'lsa
    /// vaqt o'tib bir-biridan ajralib ketadi va maosh bir oyni "pullik", bonus esa "pullik emas"
    /// deb hisoblab, raqamlar bir-biriga to'g'ri kelmay qoladi.</para>
    ///
    /// <para>Qoida: sinov (trial) — hisoblanmaydi; aktivlashtirilgan oydan boshlab; muzlatish
    /// oyigacha (muzlatish oyining O'ZI kiradi — billing konvensiyasi).</para>
    /// </summary>
    /// <param name="month">"YYYY-MM"</param>
    public static bool BillableInMonth(string status, string activatedAt, string frozenAt, string month)
    {
        if (status == "trial") return false;
        var actOk = activatedAt.Length < 7 || string.CompareOrdinal(month, activatedAt[..7]) >= 0;
        var frzOk = frozenAt.Length < 7 || string.CompareOrdinal(month, frozenAt[..7]) <= 0;
        return actOk && frzOk;
    }

    /// <inheritdoc cref="BillableInMonth(string,string,string,string)"/>
    public static bool BillableInMonth(Domain.StudentGroup m, string month) =>
        BillableInMonth(m.Status, m.ActivatedAt, m.FrozenAt, month);
}
