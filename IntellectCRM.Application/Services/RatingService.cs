using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Maktab bo'yicha o'quvchilar reytingi (o'rtacha baho + davomat) — admin "Reyting" sahifasi va
/// o'quvchi/parent portali uchun umumiy manba. Hisoblash <see cref="Analytics.BuildClass"/> orqali.
/// </summary>
public static class RatingService
{
    /// <summary>Barcha sinflar bo'yicha har bir o'quvchining qatori (o'rtacha baho + davomat).</summary>
    public static async Task<List<StudentRatingRowDto>> SchoolAsync(IAppDbContext db)
    {
        var students = await db.Students.ToListAsync();
        var subjects = await db.Subjects.ToListAsync();
        var classes = await db.Classes.ToListAsync();
        var lateIds = await db.AbsenceReasons.Where(r => r.IsLate).Select(r => r.Id).ToListAsync();
        var memberships = await db.StudentGroups.ToListAsync();

        var result = new List<StudentRatingRowDto>();
        foreach (var cls in classes)
        {
            var assignedSubjectIds = string.IsNullOrEmpty(cls.CourseId)
                ? new List<string>() : new List<string> { cls.CourseId };
            var entries = await db.JournalEntries.Where(e => e.ClassId == cls.Id).ToListAsync();
            var notes = await db.LessonNotes.Where(n => n.ClassId == cls.Id).ToListAsync();
            // Guruh a'zolari M2M StudentGroup'dan (a'zolar oynasidagi manba) — ClassName yorlig'i bilan emas.
            var groupMs = memberships.Where(m => m.GroupId == cls.Id).ToList();
            var activeIds = groupMs.Where(m => m.IsActive).Select(m => m.StudentId).ToHashSet();
            var anyIds = groupMs.Select(m => m.StudentId).ToHashSet();
            var rows = Analytics.BuildClass(cls, students, subjects, assignedSubjectIds, entries, notes,
                lateReasonIds: lateIds, activeMemberIds: activeIds, anyMemberIds: anyIds).Rows;
            result.AddRange(rows.Select(r =>
                new StudentRatingRowDto(r.Student, cls.Name, cls.Grade, r.Average, r.Attendance)));
        }
        return result;
    }
}
