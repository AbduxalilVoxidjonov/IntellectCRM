using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'quvchi "BALL"i — guruh sahifasidagi "Reyting" tabi bilan BIR XIL formula:
/// <c>Ball = Σ(jurnal baholari) + Σ(bajarilgan baholash mezonlari)</c>.
///
/// Ikki joyda ishlatiladi:
///   • <b>O'qituvchi reytingi</b> — faqat SHU o'qituvchi guruhlaridagi ball (admin o'qituvchi sahifasi
///     "Reyting" tabi + o'qituvchi ilovasidagi "O'quvchilar reytingi").
///   • <b>Admin "O'quvchilar" ro'yxati</b> — markaz bo'yicha umumiy ball ustuni (barcha guruhlar).
///
/// Manbalar: <see cref="JournalEntry.Grade"/> (jurnal bahosi) va <see cref="CriterionGrade"/>
/// (<c>Done=true</c> belgilangan baholash mezonlari).
/// </summary>
public static class StudentBallService
{
    /// <summary>Bitta o'quvchining ball tarkibi.</summary>
    public sealed record BallStat(int JournalTotal, int GradeCount, int CriteriaDone)
    {
        public int Ball => JournalTotal + CriteriaDone;
        /// <summary>O'rtacha baho (baho qo'yilgan darslar bo'yicha); baho yo'q bo'lsa 0.</summary>
        public double Average => GradeCount > 0 ? Math.Round((double)JournalTotal / GradeCount, 1) : 0;
    }

    /// <summary>
    /// O'quvchi → ball tarkibi. <paramref name="groupIds"/> berilsa faqat shu guruhlardagi
    /// baho/mezonlar hisoblanadi (o'qituvchi reytingi); null bo'lsa — barcha guruhlar (markaz bo'yicha).
    /// </summary>
    public static async Task<Dictionary<string, BallStat>> ComputeAsync(
        IAppDbContext db, IReadOnlyCollection<string>? groupIds = null)
    {
        if (groupIds is { Count: 0 }) return new Dictionary<string, BallStat>();

        var jq = db.JournalEntries.AsNoTracking().Where(e => e.Grade != null);
        if (groupIds is not null) jq = jq.Where(e => groupIds.Contains(e.ClassId));
        var journal = await jq
            .GroupBy(e => e.StudentId)
            .Select(g => new { StudentId = g.Key, Total = g.Sum(x => x.Grade ?? 0), Count = g.Count() })
            .ToListAsync();

        var cq = db.CriterionGrades.AsNoTracking().Where(g => g.Done);
        if (groupIds is not null) cq = cq.Where(g => groupIds.Contains(g.GroupId));
        var criteria = await cq
            .GroupBy(g => g.StudentId)
            .Select(g => new { StudentId = g.Key, Done = g.Count() })
            .ToListAsync();

        var result = new Dictionary<string, BallStat>();
        foreach (var j in journal) result[j.StudentId] = new BallStat(j.Total, j.Count, 0);
        foreach (var c in criteria)
            result[c.StudentId] = result.TryGetValue(c.StudentId, out var b)
                ? b with { CriteriaDone = c.Done }
                : new BallStat(0, 0, c.Done);
        return result;
    }

    /// <summary>Markaz bo'yicha barcha (arxivlanmagan) o'quvchilar bali — admin ro'yxati ustuni uchun.</summary>
    public static async Task<List<StudentBallDto>> SchoolAsync(IAppDbContext db)
    {
        var balls = await ComputeAsync(db);
        var ids = await db.Students.AsNoTracking().Where(s => !s.IsArchived).Select(s => s.Id).ToListAsync();
        return ids.Select(id =>
        {
            var b = balls.GetValueOrDefault(id, new BallStat(0, 0, 0));
            return new StudentBallDto(id, b.JournalTotal, b.CriteriaDone, b.Ball, b.Average);
        }).ToList();
    }

    /// <summary>
    /// O'qituvchi guruhlaridagi o'quvchilar reytingi (ball kamayish tartibida, o'rin bilan).
    /// Faqat FAOL a'zolar va arxivlanmagan o'quvchilar. Davomat — shu o'qituvchi guruhlarida
    /// o'tilgan darslar bo'yicha (kech kelish sababi qatnashmaydi).
    /// </summary>
    public static async Task<TeacherRatingDto> TeacherAsync(IAppDbContext db, Teacher teacher)
    {
        var groups = await db.Classes.AsNoTracking()
            .Where(c => c.TeacherId == teacher.Id && !c.IsArchived)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync();
        if (groups.Count == 0)
            return new TeacherRatingDto(teacher.Id, teacher.FullName, 0, 0, 0, new List<TeacherRatingRowDto>());

        var groupIds = groups.Select(g => g.Id).ToList();
        var groupName = groups.ToDictionary(g => g.Id, g => g.Name);

        // Faol a'zoliklar: o'quvchi → shu o'qituvchining qaysi guruhlarida o'qiydi.
        var memberships = await db.StudentGroups.AsNoTracking()
            .Where(sg => groupIds.Contains(sg.GroupId) && sg.IsActive)
            .Select(sg => new { sg.StudentId, sg.GroupId })
            .ToListAsync();
        var studentIds = memberships.Select(m => m.StudentId).Distinct().ToList();
        if (studentIds.Count == 0)
            return new TeacherRatingDto(teacher.Id, teacher.FullName, groups.Count, 0, 0, new List<TeacherRatingRowDto>());

        var students = await db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id) && !s.IsArchived)
            .Select(s => new { s.Id, s.FullName })
            .ToListAsync();

        var balls = await ComputeAsync(db, groupIds);

        // Davomat: o'tilgan darslar (LessonNote.Conducted) va sababli qoldirilganlar (kech kelish emas).
        var lateIds = (await db.AbsenceReasons.AsNoTracking().Where(r => r.IsLate).Select(r => r.Id).ToListAsync())
            .ToHashSet();
        var conductedByGroup = (await db.LessonNotes.AsNoTracking()
                .Where(n => groupIds.Contains(n.ClassId) && n.Conducted)
                .Select(n => new { n.ClassId, n.SubjectId, n.Date, n.Period })
                .ToListAsync())
            .GroupBy(n => n.ClassId)
            .ToDictionary(g => g.Key, g => g.Select(n => (n.SubjectId, n.Date, n.Period)).ToHashSet());
        var absencesByStudent = (await db.JournalEntries.AsNoTracking()
                .Where(e => groupIds.Contains(e.ClassId) && e.ReasonId != null)
                .Select(e => new { e.StudentId, e.ClassId, e.SubjectId, e.Date, e.Period, e.ReasonId })
                .ToListAsync())
            .Where(e => !lateIds.Contains(e.ReasonId!))
            .GroupBy(e => e.StudentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var groupsByStudent = memberships.GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.GroupId).Distinct().ToList());

        var rows = students.Select(st =>
        {
            var mine = groupsByStudent.GetValueOrDefault(st.Id, new List<string>());
            var b = balls.GetValueOrDefault(st.Id, new BallStat(0, 0, 0));

            int conducted = 0, absent = 0;
            foreach (var gid in mine)
            {
                if (!conductedByGroup.TryGetValue(gid, out var cond)) continue;
                conducted += cond.Count;
                if (absencesByStudent.TryGetValue(st.Id, out var abs))
                    absent += abs.Count(e => e.ClassId == gid && cond.Contains((e.SubjectId, e.Date, e.Period)));
            }
            double? attendance = conducted > 0
                ? Math.Round((double)(conducted - absent) / conducted * 100)
                : null;

            var names = string.Join(", ", mine.Select(g => groupName.GetValueOrDefault(g, "")).Where(n => n != ""));
            return new TeacherRatingRowDto(
                0, st.Id, st.FullName, names, b.JournalTotal, b.CriteriaDone, b.Ball, b.Average, attendance);
        })
        .OrderByDescending(r => r.Ball)
        .ThenBy(r => r.FullName, StringComparer.OrdinalIgnoreCase)
        .Select((r, i) => r with { Rank = i + 1 })
        .ToList();

        var avgBall = rows.Count > 0 ? Math.Round(rows.Average(r => (double)r.Ball), 1) : 0;
        return new TeacherRatingDto(teacher.Id, teacher.FullName, groups.Count, rows.Count, avgBall, rows);
    }
}
