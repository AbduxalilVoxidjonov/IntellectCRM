using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize(Roles = "admin,superadmin,staff")]
public class ClassAnalyticsController(AppDbContext db) : ControllerBase
{
    private async Task<(List<Student>, List<Subject>, List<StudentGroup>)> LoadCommon() =>
        (await db.Students.ToListAsync(), await db.Subjects.ToListAsync(), await db.StudentGroups.ToListAsync());

    private async Task<Analytics.ClassResult> BuildFor(Group cls, List<Student> students, List<Subject> subjects, List<StudentGroup> memberships)
    {
        var assignedSubjectIds = string.IsNullOrEmpty(cls.CourseId)
            ? new List<string>() : new List<string> { cls.CourseId };
        var entries = await db.JournalEntries.Where(e => e.ClassId == cls.Id).ToListAsync();
        var notes = await db.LessonNotes.Where(n => n.ClassId == cls.Id).ToListAsync();
        var lateIds = await db.AbsenceReasons.Where(r => r.IsLate).Select(r => r.Id).ToListAsync();
        // Guruh a'zolari = M2M StudentGroup (a'zolar oynasidagi manba). Faol a'zolik = roster;
        // a'zolik yozuvi umuman bo'lmagan eski ClassName-o'quvchilari fallback bilan qo'shiladi.
        var groupMs = memberships.Where(m => m.GroupId == cls.Id).ToList();
        var activeIds = groupMs.Where(m => m.IsActive).Select(m => m.StudentId).ToHashSet();
        var anyIds = groupMs.Select(m => m.StudentId).ToHashSet();
        return Analytics.BuildClass(cls, students, subjects, assignedSubjectIds, entries, notes,
            lateReasonIds: lateIds, activeMemberIds: activeIds, anyMemberIds: anyIds);
    }

    [HttpGet("api/admin/classes/{classId}/performance")]
    public async Task<ActionResult<ClassPerformanceDataDto>> Performance(string classId)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls is null) return new ClassPerformanceDataDto([], []);
        var (students, subjects, memberships) = await LoadCommon();
        var res = await BuildFor(cls, students, subjects, memberships);
        return new ClassPerformanceDataDto(res.Subjects, res.Rows);
    }

    [HttpGet("api/admin/classes/stats")]
    public async Task<ActionResult<Dictionary<string, ClassStatsDto>>> Stats()
    {
        var (students, subjects, memberships) = await LoadCommon();
        var classes = await db.Classes.ToListAsync();
        var result = new Dictionary<string, ClassStatsDto>();
        foreach (var cls in classes)
        {
            var rows = (await BuildFor(cls, students, subjects, memberships)).Rows;
            var n = rows.Count;
            var att = rows.Where(r => r.Attendance.HasValue).Select(r => r.Attendance!.Value).ToList();
            result[cls.Id] = new ClassStatsDto(
                n,
                n > 0 ? Math.Round(rows.Average(r => r.Average), 1) : 0,
                att.Count > 0 ? Math.Round(att.Average()) : null);
        }
        return result;
    }

    [HttpGet("api/admin/students/rating")]
    public async Task<ActionResult<IEnumerable<StudentRatingRowDto>>> Rating() =>
        await RatingService.SchoolAsync(db);
}
