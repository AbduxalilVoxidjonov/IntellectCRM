using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize(Roles = "admin,superadmin,staff")]
[Route("api/admin/dashboard")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminDashboardDto>> Get()
    {
        var studentsCount = await db.Students.CountAsync();
        var teachersCount = await db.Teachers.CountAsync();
        var classes = await db.Classes.OrderBy(c => c.Grade).ToListAsync();
        var entries = await db.JournalEntries.ToListAsync();

        // Guruh a'zolari — M2M faol a'zoliklar bo'yicha (ClassName yorlig'i emas; o'quvchi bir nechta guruhda bo'lishi mumkin).
        var classMemberships = await db.StudentGroups.Where(sg => sg.IsActive)
            .Select(sg => new { sg.GroupId, sg.Status }).ToListAsync();
        var membersByClass = classMemberships.GroupBy(m => m.GroupId)
            .ToDictionary(g => g.Key, g => g.Count());
        // Aktiv a'zolar — Status=="active" (sinov/muzlatilgan emas).
        var activeByClass = classMemberships.Where(m => m.Status == "active").GroupBy(m => m.GroupId)
            .ToDictionary(g => g.Key, g => g.Count());
        int MembersOf(Group c) => membersByClass.TryGetValue(c.Id, out var n) ? n : 0;
        int ActiveOf(Group c) => activeByClass.TryGetValue(c.Id, out var n) ? n : 0;

        // Davomat FAQAT o'tilgan darslar bo'yicha (Conducted=true). O'tilmagan darslar hisobga olinmaydi.
        var conductedByClass = (await db.LessonNotes.Where(n => n.Conducted).ToListAsync())
            .GroupBy(n => n.ClassId)
            .ToDictionary(g => g.Key, g => g.Select(n => (n.SubjectId, n.Date, n.Period)).ToHashSet());

        // "Kech keldi" turidagi sabablar davomatsizlik sifatida hisoblanmaydi.
        var lateReasonIds = (await db.AbsenceReasons.Where(r => r.IsLate).Select(r => r.Id).ToListAsync())
            .ToHashSet();

        double AvgGrade(IEnumerable<JournalEntry> es)
        {
            var grades = es.Where(e => e.Grade.HasValue).Select(e => (double)e.Grade!.Value).ToList();
            return grades.Count > 0 ? Math.Round(grades.Average(), 1) : 0;
        }

        // Sinf davomati: o'tilgan darslar × o'quvchilar = imkoniyatlar; davomatsizliklar ayriladi.
        // O'tilgan dars bo'lmasa — ma'lumot yo'q (null), o'rtachaga qo'shilmaydi.
        (long Opp, int Abs) ClassAttParts(Group c)
        {
            if (!conductedByClass.TryGetValue(c.Id, out var set) || set.Count == 0) return (0, 0);
            var studentsN = MembersOf(c);
            if (studentsN == 0) return (0, 0);
            var abs = entries.Count(e => e.ClassId == c.Id && e.ReasonId != null
                && !lateReasonIds.Contains(e.ReasonId) && set.Contains((e.SubjectId, e.Date, e.Period)));
            return ((long)set.Count * studentsN, abs);
        }
        double? Rate(long opp, int abs) => opp > 0 ? Math.Round((double)(opp - abs) / opp * 100) : null;

        long totalOpp = 0;
        var totalAbs = 0;
        var classPerformance = classes.Select(c =>
        {
            var (opp, abs) = ClassAttParts(c);
            totalOpp += opp;
            totalAbs += abs;
            return new ClassPerformanceItemDto(
                c.Id, c.Name, AvgGrade(entries.Where(e => e.ClassId == c.Id)), Rate(opp, abs));
        }).ToList();

        var stats = new AdminStatsDto(studentsCount, teachersCount, AvgGrade(entries), Rate(totalOpp, totalAbs));

        // O'quvchilar bo'yicha taqsimot — faqat arxivlanmaganlar.
        var activeStudents = await db.Students.Where(s => !s.IsArchived).Select(s => new { s.Id, s.Balance }).ToListAsync();
        var nonArchivedTotal = activeStudents.Count;
        // Faol a'zoliklar (guruhli) va Status=="active" a'zoliklar.
        var memberships = await db.StudentGroups
            .Where(sg => sg.IsActive)
            .Select(sg => new { sg.StudentId, sg.Status })
            .ToListAsync();
        var nonArchivedIds = activeStudents.Select(s => s.Id).ToHashSet();
        var withGroupIds = memberships
            .Where(m => nonArchivedIds.Contains(m.StudentId))
            .Select(m => m.StudentId).ToHashSet();
        var activeMemberIds = memberships
            .Where(m => m.Status == "active" && nonArchivedIds.Contains(m.StudentId))
            .Select(m => m.StudentId).ToHashSet();
        var withGroup = withGroupIds.Count;
        var activeCount = activeMemberIds.Count;
        var debtors = activeStudents.Count(s => s.Balance < 0);
        var studentBreakdown = new StudentBreakdownDto(
            activeCount,
            nonArchivedTotal - activeCount,
            debtors,
            nonArchivedTotal - debtors,
            withGroup,
            nonArchivedTotal - withGroup);

        // Grading statistikasi — shu oyda nechta ba'ho kiritilgan
        var cur = TuitionService.CurrentMonth();
        var grades = await db.CriterionGrades.Where(g => g.Done && g.Date.StartsWith(cur)).ToListAsync();
        var gradesByClass = grades.GroupBy(g => g.GroupId)
            .ToDictionary(g => g.Key, g => g.Count());
        int GradesOf(Group c) => gradesByClass.TryGetValue(c.Id, out var n) ? n : 0;

        var topClasses = classes
            .Select(c => new TopClassDto(
                c.Id, c.Name,
                MembersOf(c),
                ActiveOf(c),
                AvgGrade(entries.Where(e => e.ClassId == c.Id))))
            .OrderByDescending(t => t.AverageGrade)
            .Take(5)
            .ToList();

        // Baholash faollik — barcha guruhlarda shu oyda nechta ba'ho kiritilgan
        var totalGradesCount = grades.Count;

        return new AdminDashboardDto(stats, classPerformance, topClasses, studentBreakdown, totalGradesCount);
    }
}
