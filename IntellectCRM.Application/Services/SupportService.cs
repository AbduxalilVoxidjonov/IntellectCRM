using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Support o'qituvchi slotlari uchun umumiy mantiq — support portali (`/api/support`) ham,
/// admin (`/api/admin/support`) ham shu metodlardan foydalanadi (bitta manba).
/// </summary>
public static class SupportService
{
    /// <summary>Berilgan o'quvchi id'lari (null'lar tashlanadi) → FISH xaritasi.</summary>
    public static async Task<Dictionary<string, string>> StudentNamesAsync(
        IAppDbContext db, IEnumerable<string?> ids)
    {
        var list = ids.Where(x => !string.IsNullOrEmpty(x)).Select(x => x!).Distinct().ToList();
        if (list.Count == 0) return new();
        return await db.Students.Where(s => list.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);
    }

    /// <summary>Support'ning barcha slotlari (o'quvchi nomi bilan), eng yangi birinchi.</summary>
    public static async Task<List<SupportSlotDto>> ListAsync(IAppDbContext db, string teacherId)
    {
        var slots = await db.SupportSlots.Where(s => s.TeacherId == teacherId)
            .OrderByDescending(s => s.Date).ThenBy(s => s.StartTime).ToListAsync();
        var names = await StudentNamesAsync(db, slots.Select(s => s.StudentId));
        return slots.Select(s => new SupportSlotDto(
            s.Id, s.TeacherId, s.Date, s.StartTime, s.EndTime, s.Status,
            s.StudentId, s.StudentId != null ? names.GetValueOrDefault(s.StudentId, "") : "",
            s.Topic, s.Notes, s.BookedAt)).ToList();
    }

    /// <summary>Bo'sh vaqt bloki qo'shadi (per-odam daqiqaga bo'lib + haftalik takror). created = qo'shilgan slot soni.</summary>
    public static async Task<(bool ok, int created, string? error)> AddAsync(
        IAppDbContext db, string teacherId, CreateSupportSlotRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Date) || string.IsNullOrWhiteSpace(req.StartTime)
            || string.IsNullOrWhiteSpace(req.EndTime))
            return (false, 0, "Sana va vaqtni to'liq kiriting");
        if (!DateTime.TryParse(req.Date, out var baseDate))
            return (false, 0, "Sana noto'g'ri");

        var subs = SplitInterval(req.StartTime, req.EndTime, req.SlotMinutes);
        if (subs.Count == 0)
            return (false, 0, "Vaqt oralig'i noto'g'ri (tugash boshlanishdan keyin bo'lsin)");

        var repeat = Math.Clamp(req.RepeatWeeks, 0, 12);
        var created = 0;
        for (var w = 0; w <= repeat; w++)
        {
            var d = baseDate.AddDays(7 * w).ToString("yyyy-MM-dd");
            foreach (var (st, en) in subs)
            {
                var exists = await db.SupportSlots.AnyAsync(
                    s => s.TeacherId == teacherId && s.Date == d && s.StartTime == st);
                if (exists) continue;
                db.SupportSlots.Add(new SupportSlot
                {
                    TeacherId = teacherId, Date = d, StartTime = st, EndTime = en,
                });
                created++;
            }
        }
        await db.SaveChangesAsync();
        return (true, created, null);
    }

    /// <summary>Slotni o'chiradi (egasiniki bo'lsa, o'tilgan darsdan tashqari).</summary>
    public static async Task<(bool ok, string? error)> DeleteAsync(IAppDbContext db, string id, string teacherId)
    {
        var slot = await db.SupportSlots.FirstOrDefaultAsync(s => s.Id == id);
        if (slot is null || slot.TeacherId != teacherId) return (false, "Slot topilmadi");
        if (slot.Status == "done") return (false, "O'tilgan darsni o'chirib bo'lmaydi");
        db.SupportSlots.Remove(slot);
        await db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Bron qilingan slotni mavzu+izoh bilan "o'tildi" qiladi.</summary>
    public static async Task<(bool ok, string? error)> CompleteAsync(
        IAppDbContext db, string id, string teacherId, CompleteSupportRequest req)
    {
        var slot = await db.SupportSlots.FirstOrDefaultAsync(s => s.Id == id);
        if (slot is null || slot.TeacherId != teacherId) return (false, "Slot topilmadi");
        if (slot.StudentId is null) return (false, "Bu slot bron qilinmagan");
        slot.Topic = (req.Topic ?? "").Trim();
        slot.Notes = (req.Notes ?? "").Trim();
        slot.Status = "done";
        await db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>"HH:mm" blokni <paramref name="minutes"/> daqiqalik qism-slotlarga bo'ladi.
    /// minutes ≤ 0 yoki blokdan katta → butun blok bitta slot. Faqat to'liq sig'gan qismlar.</summary>
    private static List<(string Start, string End)> SplitInterval(string start, string end, int minutes)
    {
        var res = new List<(string, string)>();
        if (!TryMinutes(start, out var s) || !TryMinutes(end, out var e) || e <= s) return res;
        if (minutes <= 0 || minutes >= (e - s)) { res.Add((Fmt(s), Fmt(e))); return res; }
        for (var t = s; t + minutes <= e; t += minutes)
            res.Add((Fmt(t), Fmt(t + minutes)));
        return res;
    }

    private static bool TryMinutes(string hhmm, out int total)
    {
        total = 0;
        var parts = (hhmm ?? "").Split(':');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m))
            return false;
        if (h is < 0 or > 23 || m is < 0 or > 59) return false;
        total = h * 60 + m;
        return true;
    }

    private static string Fmt(int total) => $"{total / 60:D2}:{total % 60:D2}";
}
