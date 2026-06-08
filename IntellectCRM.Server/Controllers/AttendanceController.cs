using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using System.Globalization;

using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("attendance")]
[Route("api/admin/attendance")]
public class AttendanceController(AppDbContext db) : ControllerBase
{
    private static StudentDto Map(Student s) => new(
        s.Id, s.FullName, s.BirthDate, s.Address, s.Gender,
        s.ParentFullName, s.ParentPhone, s.ClassName, s.EnrollmentDate, s.Balance);

    /// <summary>Sana o'quv yili birinchi dushanbasidan nechanchi haftaga to'g'ri kelishi (1-asosli).
    /// Sana o'quv yili boshidan oldin bo'lsa 0 qaytaradi.</summary>
    private async Task<int> WeekNumberForDateAsync(string date)
    {
        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return 0;
        var startMonth = await TuitionService.AcademicYearStartMonthAsync(db); // "yyyy-MM"
        var firstMondayIso = ScheduleMath.MondayOfISO($"{startMonth}-01");
        if (!DateOnly.TryParseExact(firstMondayIso, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fm))
            return 0;
        var days = d.DayNumber - fm.DayNumber;
        if (days < 0) return 0;
        return days / 7 + 1;
    }

    [HttpGet]
    public async Task<ActionResult<DailyAttendanceDto>> GetDaily(
        [FromQuery] string classId, [FromQuery] string date)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls is null) return new DailyAttendanceDto(0, []);

        var students = await db.Students.Where(s => s.ClassName == cls.Name).ToListAsync();
        var total = students.Count;

        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return new DailyAttendanceDto(total, []);

        var jsDay = (int)d.DayOfWeek; // 0=Yakshanba ... 6=Shanba
        if (jsDay == 0) return new DailyAttendanceDto(total, []);
        var lessonDay = jsDay - 1; // Dushanba=0 ... Shanba=5

        // Chorak davri tizimi olib tashlandi — sana qaysi WeekAssignment.Week ekanini o'quv yili
        // birinchi dushanbasiga nisbatan hisoblaymiz.
        var week = await WeekNumberForDateAsync(date);
        if (week <= 0) return new DailyAttendanceDto(total, []);

        var assignment = await db.WeekAssignments.FirstOrDefaultAsync(a =>
            a.ClassId == classId && a.Week == week);
        if (assignment?.TemplateId is null) return new DailyAttendanceDto(total, []);

        var tpl = await db.ScheduleTemplates.Include(t => t.Lessons)
            .FirstOrDefaultAsync(t => t.Id == assignment.TemplateId);
        if (tpl is null) return new DailyAttendanceDto(total, []);

        var dayLessons = tpl.Lessons.Where(l => l.Day == lessonDay).OrderBy(l => l.Period).ToList();
        var subjects = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);
        var reasons = await db.AbsenceReasons.ToDictionaryAsync(r => r.Id, r => r.Name);
        // "Kech keldi" turidagi sabablar yo'qlik (absent) sifatida hisoblanmaydi.
        var lateReasonIds = (await db.AbsenceReasons.Where(r => r.IsLate).Select(r => r.Id).ToListAsync())
            .ToHashSet();

        var entries = await db.JournalEntries
            .Where(e => e.ClassId == classId && e.Date == date && e.ReasonId != null)
            .ToListAsync();

        var result = new List<SubjectAttendanceDto>();
        foreach (var l in dayLessons)
        {
            var subjEntries = entries.Where(e => e.SubjectId == l.SubjectId).ToList();
            var reasonCounts = subjEntries
                .GroupBy(e => e.ReasonId!)
                .Select(g => new ReasonCountDto(reasons.GetValueOrDefault(g.Key, "?"), g.Count()))
                .ToList();
            var absent = subjEntries.Count(e => !lateReasonIds.Contains(e.ReasonId!));
            result.Add(new SubjectAttendanceDto(
                l.SubjectId, subjects.GetValueOrDefault(l.SubjectId, ""), l.Period,
                total, total - absent, absent, reasonCounts));
        }

        return new DailyAttendanceDto(total, result);
    }

    /// <summary>Bitta fan/kun bo'yicha har bir o'quvchining holati.</summary>
    [HttpGet("subject")]
    public async Task<ActionResult<IEnumerable<StudentStatusDto>>> GetSubjectDetail(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] string date)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls is null) return new List<StudentStatusDto>();

        var students = await db.Students.Where(s => s.ClassName == cls.Name)
            .OrderBy(s => s.FullName).ToListAsync();

        var reasons = await db.AbsenceReasons.ToDictionaryAsync(r => r.Id, r => r.Name);

        var entries = await db.JournalEntries.Where(e =>
            e.ClassId == classId && e.SubjectId == subjectId &&
            e.Date == date && e.ReasonId != null).ToListAsync();

        return students.Select(s =>
        {
            var e = entries.FirstOrDefault(x => x.StudentId == s.Id);
            return new StudentStatusDto(Map(s), e is not null,
                e?.ReasonId is null ? null : reasons.GetValueOrDefault(e.ReasonId));
        }).ToList();
    }
}
