using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'QUVCHILAR DAVOMATI (admin):
///   • <c>GET absent?date=</c> — shu kunda darsga kelmagan (va kechikkan) o'quvchilar ro'yxati,
///     telefon raqamlari bilan (ota-onaga darrov qo'ng'iroq qilish uchun).
///   • <c>GET journal?studentId=&amp;groupId=&amp;month=</c> — bitta o'quvchining guruh jurnalidagi
///     O'Z QATORI (faqat o'qish; baho qo'yish/tahrirlash yo'q).
///
/// Manba: jurnal yozuvlari (<see cref="JournalEntry"/>) + o'tilgan darslar (<see cref="LessonNote"/>).
/// "Kelmadi" = davomat sababi qo'yilgan va sabab <see cref="AbsenceReason.IsLate"/> EMAS
/// (kech kelgan o'quvchi darsda qatnashgan hisoblanadi).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("students")]
[Route("api/admin/student-attendance")]
public class StudentAttendanceController(AppDbContext db) : ControllerBase
{
    /// <summary>Berilgan kundagi kelmagan/kechikkan o'quvchilar (sana berilmasa — bugun).</summary>
    [HttpGet("absent")]
    public async Task<ActionResult<DailyAbsenceDto>> Absent([FromQuery] string? date)
    {
        var day = string.IsNullOrWhiteSpace(date)
            ? AppClock.Today.ToString("yyyy-MM-dd")
            : (DateOnly.TryParse(date, out var d) ? d.ToString("yyyy-MM-dd") : null);
        if (day is null) return BadRequest(new { message = "Sana noto'g'ri" });

        // Shu kunda "o'tildi" deb belgilangan darslar — davomat olingan guruhlar.
        var conductedGroupIds = await db.LessonNotes.AsNoTracking()
            .Where(n => n.Date == day && n.Conducted)
            .Select(n => n.ClassId).Distinct().ToListAsync();

        // Shu kundagi davomat sababi qo'yilgan yozuvlar (kelmadi yoki kechikdi).
        var entries = await db.JournalEntries.AsNoTracking()
            .Where(e => e.Date == day && e.ReasonId != null)
            .Select(e => new { e.StudentId, e.ClassId, e.ReasonId })
            .ToListAsync();

        var reasons = await db.AbsenceReasons.AsNoTracking().ToDictionaryAsync(r => r.Id);
        var groupIds = entries.Select(e => e.ClassId).Concat(conductedGroupIds).Distinct().ToList();
        var groups = await db.Classes.AsNoTracking()
            .Where(c => groupIds.Contains(c.Id)).ToListAsync();
        var groupById = groups.ToDictionary(g => g.Id);

        var courseNames = (await db.Subjects.AsNoTracking().ToListAsync()).ToDictionary(s => s.Id, s => s.Name);
        var teacherNames = (await db.Teachers.AsNoTracking().ToListAsync()).ToDictionary(t => t.Id, t => t.FullName);

        var studentIds = entries.Select(e => e.StudentId).Distinct().ToList();
        var students = await db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id) && !s.IsArchived).ToListAsync();
        var studentById = students.ToDictionary(s => s.Id);

        // Davomat olingan o'quvchilar soni (o'tilgan darsdagi faol a'zolar) — "N tadan M tasi kelmadi".
        var markedStudents = conductedGroupIds.Count == 0 ? 0 : await db.StudentGroups.AsNoTracking()
            .Where(sg => conductedGroupIds.Contains(sg.GroupId) && sg.IsActive)
            .Select(sg => sg.StudentId).Distinct().CountAsync();

        var rows = new List<AbsentStudentDto>();
        foreach (var e in entries)
        {
            if (!studentById.TryGetValue(e.StudentId, out var st)) continue;      // arxivlangan/o'chirilgan
            if (!reasons.TryGetValue(e.ReasonId!, out var reason)) continue;
            groupById.TryGetValue(e.ClassId, out var g);

            rows.Add(new AbsentStudentDto(
                st.Id, st.FullName, st.Phone,
                st.ParentFullName, st.ParentPhone, st.FatherPhone, st.MotherPhone,
                e.ClassId, g?.Name ?? "", g is null || string.IsNullOrEmpty(g.CourseId) ? "" : courseNames.GetValueOrDefault(g.CourseId, ""),
                g is null || string.IsNullOrEmpty(g.TeacherId) ? "" : teacherNames.GetValueOrDefault(g.TeacherId, ""),
                g?.StartTime ?? "", g?.EndTime ?? "", g?.Room ?? "",
                reason.Id, reason.Name, reason.Short, reason.IsLate));
        }

        rows = rows
            .OrderBy(r => r.IsLate)                                     // avval kelmaganlar
            .ThenBy(r => r.StartTime, StringComparer.Ordinal)
            .ThenBy(r => r.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new DailyAbsenceDto(
            day, conductedGroupIds.Count, markedStudents,
            rows.Count(r => !r.IsLate), rows.Count(r => r.IsLate), rows);
    }

    /// <summary>
    /// O'quvchining guruh jurnalidagi o'z qatori (oy bo'yicha, faqat o'qish uchun).
    /// Guruh berilmasa — birinchi faol guruhi; oy berilmasa — oxirgi (joriy) oy.
    /// </summary>
    [HttpGet("journal")]
    public async Task<ActionResult<StudentJournalDto>> Journal(
        [FromQuery] string studentId, [FromQuery] string? groupId, [FromQuery] string? month)
    {
        var student = await db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studentId);
        if (student is null) return NotFound();

        // O'quvchining a'zoliklari (faol bo'lganlari tanlovda birinchi).
        var memberships = await db.StudentGroups.AsNoTracking()
            .Where(sg => sg.StudentId == studentId).ToListAsync();
        var mGroupIds = memberships.Select(m => m.GroupId).Distinct().ToList();
        var groups = await db.Classes.AsNoTracking().Where(c => mGroupIds.Contains(c.Id)).ToListAsync();
        if (groups.Count == 0)
            return new StudentJournalDto(student.Id, student.FullName, new(), "", new(), "", new(), 0, 0, 0, 0, 0);

        var courseNames = (await db.Subjects.AsNoTracking().ToListAsync()).ToDictionary(s => s.Id, s => s.Name);
        var teacherNames = (await db.Teachers.AsNoTracking().ToListAsync()).ToDictionary(t => t.Id, t => t.FullName);

        var options = groups
            .OrderByDescending(g => memberships.Any(m => m.GroupId == g.Id && m.IsActive))
            .ThenBy(g => g.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => new StudentJournalGroupDto(
                g.Id, g.Name,
                string.IsNullOrEmpty(g.CourseId) ? "" : courseNames.GetValueOrDefault(g.CourseId, ""),
                string.IsNullOrEmpty(g.TeacherId) ? "" : teacherNames.GetValueOrDefault(g.TeacherId, "")))
            .ToList();

        var gid = !string.IsNullOrWhiteSpace(groupId) && groups.Any(g => g.Id == groupId)
            ? groupId! : options[0].GroupId;
        var group = groups.First(g => g.Id == gid);
        var membership = memberships.FirstOrDefault(m => m.GroupId == gid);
        var subjectId = group.CourseId ?? "";

        // Mavjud oylar: guruh boshlanish sanasi (yoki a'zolik) oyidan joriy oygacha.
        var cur = TuitionService.CurrentMonth();
        var starts = new List<string>();
        if (group.StartDate is { Length: >= 7 }) starts.Add(group.StartDate[..7]);
        if (membership?.JoinedAt is { Length: >= 7 }) starts.Add(membership.JoinedAt[..7]);
        var from = starts.Count > 0 ? starts.Min()! : cur;
        if (string.CompareOrdinal(from, cur) > 0) from = cur;
        var months = TuitionService.MonthRange(from, cur).ToList();
        if (months.Count == 0) months.Add(cur);
        var resolved = !string.IsNullOrEmpty(month) && months.Contains(month) ? month! : months[^1];

        // A'zolik boshlangan sana — undan oldingi darslar o'quvchiga tegishli emas (blocked).
        var memberStart = membership?.ActivatedAt is { Length: >= 10 } ? membership.ActivatedAt[..10]
            : membership?.JoinedAt is { Length: >= 10 } ? membership.JoinedAt[..10] : null;
        // A'zolik tugagan/muzlatilgan sana — undan KEYINGI darslar ham tegishli emas (blocked).
        // Muzlatilgan bo'lsa FrozenAt sanasi o'zi hali hisoblanadi (shu kungacha qatnashgan), undan keyingisi emas.
        var memberEnd = membership?.Status == "frozen" && membership.FrozenAt is { Length: >= 10 } ? membership.FrozenAt[..10]
            : !string.Equals(membership?.Status, "frozen", StringComparison.Ordinal) && membership?.LeftAt is { Length: >= 10 } ? membership.LeftAt[..10]
            : null;

        var entries = string.IsNullOrEmpty(subjectId)
            ? new List<JournalEntry>()
            : await db.JournalEntries.AsNoTracking()
                .Where(e => e.ClassId == gid && e.SubjectId == subjectId
                            && e.StudentId == studentId && e.Date.StartsWith(resolved))
                .ToListAsync();
        var entryByDate = entries.GroupBy(e => e.Date).ToDictionary(g => g.Key, g => g.First());

        var conducted = string.IsNullOrEmpty(subjectId)
            ? new HashSet<string>()
            : (await db.LessonNotes.AsNoTracking()
                .Where(n => n.ClassId == gid && n.SubjectId == subjectId && n.Conducted && n.Date.StartsWith(resolved))
                .Select(n => n.Date).Distinct().ToListAsync()).ToHashSet();

        var reasons = await db.AbsenceReasons.AsNoTracking().ToDictionaryAsync(r => r.Id);

        var moves = (await db.LessonReschedules.Where(r => r.ClassId == gid).ToListAsync())
            .Select(m => new JournalService.LessonMove(m.FromDate, m.ToDate)).ToList();
        var cells = new List<StudentJournalCellDto>();
        foreach (var date in JournalService.EffectiveLessonDatesInMonth(group.Days, resolved, moves))
        {
            var blocked = (group.StartDate is { Length: >= 10 } && string.CompareOrdinal(date, group.StartDate[..10]) < 0)
                || (memberStart is not null && string.CompareOrdinal(date, memberStart) < 0)
                || (memberEnd is not null && string.CompareOrdinal(date, memberEnd) > 0);
            entryByDate.TryGetValue(date, out var e);
            AbsenceReason? reason = e?.ReasonId is not null ? reasons.GetValueOrDefault(e.ReasonId) : null;
            var isConducted = conducted.Contains(date);
            var present = !blocked && isConducted && e?.Grade is null && reason is null;

            cells.Add(new StudentJournalCellDto(
                date, isConducted, blocked, present,
                e?.Grade, reason?.Name, reason?.Short, reason?.IsLate ?? false,
                e?.Homework ?? 0, e?.Behavior ?? 0, e?.Mastery));
        }

        var live = cells.Where(c => !c.Blocked && c.Conducted).ToList();
        var absent = live.Count(c => c.ReasonName is not null && !c.IsLate);
        var late = live.Count(c => c.ReasonName is not null && c.IsLate);
        var grades = cells.Where(c => c.Grade.HasValue).Select(c => (double)c.Grade!.Value).ToList();

        return new StudentJournalDto(
            student.Id, student.FullName, options, gid, months, resolved, cells,
            live.Count, live.Count - absent, absent, late,
            grades.Count > 0 ? Math.Round(grades.Average(), 1) : 0);
    }
}
