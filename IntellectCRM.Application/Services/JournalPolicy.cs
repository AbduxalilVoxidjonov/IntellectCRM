using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Jurnal tahrirlash siyosati — admin "Guruhlar → Jurnal boshqaruvi" oynasida belgilanadi,
/// <see cref="CenterMeta"/>'da saqlanadi. Admin jurnali ham, o'qituvchi ilovasi ham katakka
/// yozishdan OLDIN <see cref="CheckAsync"/> ni chaqiradi (yagona nazorat nuqtasi).
/// Kelajak sanalar HAR DOIM taqiqlangan (JournalService ichida) — siyosat faqat O'TGAN sanalarni cheklaydi.
/// </summary>
public static class JournalPolicy
{
    public const string ModeFree = "free";
    public const string ModeToday = "today";
    public const string ModeWindow = "window";

    /// <summary>Joriy siyosat (CenterMeta yo'q/buzuq bo'lsa — xavfsiz default: erkin).</summary>
    public static async Task<JournalPolicyDto> GetAsync(IAppDbContext db)
    {
        var m = await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync();
        var mode = m?.JournalEditMode is ModeToday or ModeWindow ? m.JournalEditMode : ModeFree;
        return new JournalPolicyDto(mode, m?.JournalRetroDays ?? 3,
            m?.JournalConductedOnly ?? false, m?.JournalApplyToAdmins ?? false,
            m?.SalaryRequireJournal ?? false, m?.SalaryGraceDays ?? 0);
    }

    /// <summary>Siyosatni saqlaydi (noto'g'ri qiymatlar xavfsiz defaultga tushiriladi) va yangisini qaytaradi.</summary>
    public static async Task<JournalPolicyDto> SaveAsync(IAppDbContext db, JournalPolicyDto req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null)
        {
            m = new CenterMeta();
            db.CenterMeta.Add(m);
        }
        m.JournalEditMode = req.EditMode is ModeToday or ModeWindow ? req.EditMode : ModeFree;
        m.JournalRetroDays = Math.Clamp(req.RetroDays, 1, 90);
        m.JournalConductedOnly = req.ConductedOnly;
        m.JournalApplyToAdmins = req.ApplyToAdmins;
        m.SalaryRequireJournal = req.SalaryRequireJournal;
        m.SalaryGraceDays = Math.Clamp(req.SalaryGraceDays, 0, 30);
        await db.SaveChangesAsync();
        return await GetAsync(db);
    }

    /// <summary>
    /// Katakka yozish/tozalashdan OLDIN chaqiriladi. null = ruxsat; aks holda foydalanuvchiga
    /// ko'rsatiladigan taqiq xabari (controller BadRequest bilan qaytaradi).
    /// <paramref name="skipConducted"/> — ommaviy davomat (darsni o'zi "o'tildi" qiladi) va
    /// tozalash uchun (o'tilmagan darsda o'chiriladigan yozuv bo'lmaydi).
    /// </summary>
    public static async Task<string?> CheckAsync(
        IAppDbContext db, string classId, string subjectId, string date, int period,
        bool isAdmin, bool skipConducted = false)
    {
        var p = await GetAsync(db);
        if (isAdmin && !p.ApplyToAdmins) return null;

        var today = AppClock.Today.ToString("yyyy-MM-dd");
        if (p.EditMode == ModeToday && string.CompareOrdinal(date, today) < 0)
            return "Jurnal sozlamasi: baho/davomat faqat BUGUNGI kun uchun kiritiladi — eski sanalar yopiq";
        if (p.EditMode == ModeWindow)
        {
            var min = AppClock.Today.AddDays(-p.RetroDays).ToString("yyyy-MM-dd");
            if (string.CompareOrdinal(date, min) < 0)
                return $"Jurnal sozlamasi: faqat oxirgi {p.RetroDays} kun ichidagi darslarga kiritish mumkin";
        }

        if (p.ConductedOnly && !skipConducted)
        {
            var conducted = await db.LessonNotes.AnyAsync(n =>
                n.ClassId == classId && n.SubjectId == subjectId &&
                n.Date == date && n.Period == period && n.Conducted);
            if (!conducted)
                return "Bu dars hali \"o'tildi\" deb belgilanmagan — avval davomat qiling (sana ustunini bosib), so'ng baho qo'yiladi";
        }
        return null;
    }
}
