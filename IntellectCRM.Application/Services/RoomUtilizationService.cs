using IntellectCRM.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Har bir xona uchun bandlik, o'quvchi soni va samaradorlik metrikalari.
/// Endpoint: GET /api/admin/rooms/utilization-dashboard
/// </summary>
public class RoomUtilizationService(IAppDbContext db)
{
    public class RoomUtilizationMetric
    {
        public string RoomId { get; set; } = string.Empty;
        public string RoomName { get; set; } = string.Empty;
        public int Capacity { get; set; }
        /// <summary>Faol (active/trial, frozen emas) o'quvchilar yig'indisi (unique, peak approx).</summary>
        public int CurrentStudents { get; set; }
        /// <summary>Bandlik foizi: CurrentStudents / Capacity * 100.</summary>
        public double OccupancyPercent { get; set; }
        /// <summary>Xonaga biriktirilgan arxivlanmagan guruhlar soni.</summary>
        public int ActiveGroupCount { get; set; }
        /// <summary>Haftalik aktiv soatlar: guruh Days soni * dars davomiyligi soat.</summary>
        public double WeeklyActiveHours { get; set; }
        /// <summary>Haftalik bandlik foizi: weeklyActiveHours / (6 * 14) * 100. Max 100.</summary>
        public double WeeklyUtilizationPercent { get; set; }
        /// <summary>Samaradorlik ball 0-100: bandlik (60%) + haftalik bandlik (40%).</summary>
        public int EfficiencyScore { get; set; }
        /// <summary>"Optimal" | "Underutilized" | "Overcrowded" | "Empty"</summary>
        public string EfficiencyStatus { get; set; } = string.Empty;
        public string Building { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        /// <summary>Xonaga biriktirilgan faol guruh nomlari (tezkor ko'rish uchun).</summary>
        public List<string> GroupNames { get; set; } = new();
    }

    public async Task<List<RoomUtilizationMetric>> GetRoomUtilizationAsync()
    {
        var rooms = await db.Rooms
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .ToListAsync();

        // Barcha guruhlarni bir so'rovda tortib olamiz (N+1 dan qochamiz)
        var allGroups = await db.Classes
            .Where(g => !g.IsArchived && g.RoomId != null && g.RoomId != "")
            .ToListAsync();

        // Faol a'zoliklar: StudentId + GroupId (frozen emas)
        var activeMembers = await db.StudentGroups
            .Where(sg => sg.IsActive && sg.Status != "frozen")
            .Select(sg => new { sg.GroupId, sg.StudentId })
            .ToListAsync();

        var groupsByRoom = allGroups
            .GroupBy(g => g.RoomId!)
            .ToDictionary(g => g.Key, g => g.ToList());

        var membersByGroup = activeMembers
            .GroupBy(m => m.GroupId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.StudentId).ToHashSet());

        var metrics = new List<RoomUtilizationMetric>();

        foreach (var room in rooms)
        {
            var groups = groupsByRoom.GetValueOrDefault(room.Id, []);

            if (groups.Count == 0)
            {
                metrics.Add(new RoomUtilizationMetric
                {
                    RoomId = room.Id,
                    RoomName = room.Name,
                    Capacity = room.Capacity,
                    CurrentStudents = 0,
                    OccupancyPercent = 0,
                    ActiveGroupCount = 0,
                    WeeklyActiveHours = 0,
                    WeeklyUtilizationPercent = 0,
                    EfficiencyScore = 0,
                    EfficiencyStatus = "Empty",
                    Building = room.Building ?? "",
                    Location = room.Location ?? "",
                    GroupNames = [],
                });
                continue;
            }

            // Unique faol o'quvchilar (peak approximation: bir o'quvchi bir xonada nechta guruhda bo'lsa ham 1 marta)
            var uniqueStudents = new HashSet<string>();
            foreach (var g in groups)
            {
                if (membersByGroup.TryGetValue(g.Id, out var students))
                    foreach (var sid in students)
                        uniqueStudents.Add(sid);
            }
            int currentStudents = uniqueStudents.Count;

            double occupancyPct = room.Capacity > 0
                ? Math.Round((double)currentStudents / room.Capacity * 100, 1)
                : 0;

            double weeklyHours = CalculateWeeklyActiveHours(groups);
            // 6 ish kuni, kuniga 14 soat (08:00–22:00)
            const double roomCapacityHoursPerWeek = 6.0 * 14.0;
            double weeklyPct = Math.Round(Math.Min(weeklyHours / roomCapacityHoursPerWeek * 100, 100), 1);

            int score = ComputeEfficiencyScore(occupancyPct, weeklyPct);

            string status = currentStudents == 0 && groups.Count == 0
                ? "Empty"
                : occupancyPct > 110 ? "Overcrowded"
                : occupancyPct < 30   ? "Underutilized"
                :                       "Optimal";

            metrics.Add(new RoomUtilizationMetric
            {
                RoomId = room.Id,
                RoomName = room.Name,
                Capacity = room.Capacity,
                CurrentStudents = currentStudents,
                OccupancyPercent = occupancyPct,
                ActiveGroupCount = groups.Count,
                WeeklyActiveHours = Math.Round(weeklyHours, 2),
                WeeklyUtilizationPercent = weeklyPct,
                EfficiencyScore = score,
                EfficiencyStatus = status,
                Building = room.Building ?? "",
                Location = room.Location ?? "",
                GroupNames = groups.Select(g => g.Name).OrderBy(n => n).ToList(),
            });
        }

        return metrics.OrderByDescending(m => m.EfficiencyScore).ToList();
    }

    // ---------- private helpers ----------

    private static double CalculateWeeklyActiveHours(List<IntellectCRM.Domain.Group> groups)
    {
        double total = 0;
        foreach (var g in groups)
        {
            if (g.Days is null || g.Days.Count == 0) continue;
            if (string.IsNullOrWhiteSpace(g.StartTime) || string.IsNullOrWhiteSpace(g.EndTime)) continue;

            int startMin = TimeToMinutes(g.StartTime);
            int endMin   = TimeToMinutes(g.EndTime);
            double durationHours = (endMin - startMin) / 60.0;
            if (durationHours <= 0) continue;

            total += g.Days.Count * durationHours;
        }
        return total;
    }

    private static int TimeToMinutes(string hhmm)
    {
        if (string.IsNullOrWhiteSpace(hhmm)) return 0;
        var parts = hhmm.Split(':');
        if (parts.Length < 2) return 0;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return 0;
        return h * 60 + m;
    }

    /// <summary>
    /// Samaradorlik ball hisoblash:
    ///   - occupancy < 30%  → base = 20 (kam ishlatilmoqda)
    ///   - occupancy 30–100% → base = 50 + (occupancy - 30) * 0.5  (max ~85 @ 100%)
    ///   - occupancy > 100% → base = 60 (to'lib ketgan — maqbul emas)
    /// Yakuniy: base * 0.6 + weeklyPct * 0.4  (clamp 0–100)
    /// </summary>
    private static int ComputeEfficiencyScore(double occupancyPct, double weeklyPct)
    {
        double base_ = occupancyPct > 100
            ? 60
            : occupancyPct < 30
                ? 20 + occupancyPct * 0.33   // 0→20, 30→30
                : 50 + (occupancyPct - 30) * 0.5; // 30→50, 100→85

        double score = base_ * 0.6 + weeklyPct * 0.4;
        return Math.Clamp((int)Math.Round(score), 0, 100);
    }
}
