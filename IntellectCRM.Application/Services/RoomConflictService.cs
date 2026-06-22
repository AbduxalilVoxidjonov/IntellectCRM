using IntellectCRM.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Xona konfliktini aniqlash servisi.
/// Guruh yaratish/tahrirlashda bir xil xona, kunlar va vaqt to'qnashuvini WARNING sifatida qaytaradi.
/// REJECT QILINMAYDI — admin "baribir saqlash" qila oladi.
/// </summary>
public class RoomConflictService(IAppDbContext db)
{
    public class ConflictInfo
    {
        public string GroupId { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        /// <summary>"Du, Se, Ch" kabi umumiy kunlar.</summary>
        public string SharedDays { get; set; } = string.Empty;
        /// <summary>"09:00–10:00" kabi mavjud guruh vaqt oralig'i.</summary>
        public string ExistingSlot { get; set; } = string.Empty;
    }

    /// <summary>
    /// Berilgan xona (FK RoomId), kunlar va vaqt oralig'i uchun konfliktli guruhlarni qaytaradi.
    /// Bo'sh roomId/days/time berilsa — bo'sh ro'yxat (tekshirish o'tkazilmaydi).
    /// <paramref name="excludeGroupId"/> — tahrirlash paytida o'z id'sini chiqarib tashlash uchun.
    /// </summary>
    public async Task<List<ConflictInfo>> CheckRoomConflictAsync(
        string? roomId, List<int> days, string? startTime, string? endTime,
        string? excludeGroupId = null)
    {
        if (string.IsNullOrWhiteSpace(roomId)
            || days.Count == 0
            || string.IsNullOrWhiteSpace(startTime)
            || string.IsNullOrWhiteSpace(endTime))
            return [];

        var existing = await db.Classes
            .Where(g => g.RoomId == roomId
                     && !g.IsArchived
                     && g.Id != excludeGroupId
                     && g.Days != null
                     && g.StartTime != null && g.StartTime != ""
                     && g.EndTime != null && g.EndTime != "")
            .ToListAsync();

        var conflicts = new List<ConflictInfo>();
        foreach (var g in existing)
        {
            var sharedDays = (g.Days ?? []).Intersect(days).ToList();
            if (sharedDays.Count > 0 && TimeOverlap(g.StartTime, g.EndTime, startTime, endTime))
            {
                conflicts.Add(new ConflictInfo
                {
                    GroupId = g.Id,
                    GroupName = g.Name,
                    SharedDays = FormatDays(sharedDays),
                    ExistingSlot = $"{g.StartTime}–{g.EndTime}",
                });
            }
        }
        return conflicts;
    }

    private static bool TimeOverlap(string s1, string e1, string s2, string e2)
    {
        var a1 = TimeToMinutes(s1);
        var b1 = TimeToMinutes(e1);
        var a2 = TimeToMinutes(s2);
        var b2 = TimeToMinutes(e2);
        // Yarim-ochiq oraliq: [a1, b1) va [a2, b2) — b1<=a2 yoki b2<=a1 bo'lsa to'qnashmaydi
        return !(b1 <= a2 || b2 <= a1);
    }

    private static int TimeToMinutes(string hhmm)
    {
        if (string.IsNullOrWhiteSpace(hhmm)) return 0;
        var parts = hhmm.Split(':');
        if (parts.Length < 2) return 0;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return 0;
        return h * 60 + m;
    }

    private static string FormatDays(List<int> days)
    {
        var dayNames = new[] { "Du", "Se", "Ch", "Pa", "Jum", "Sha", "Yak" };
        return string.Join(", ", days.Order().Select(d => d >= 0 && d < dayNames.Length ? dayNames[d] : d.ToString()));
    }
}
