using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Markaz bo'yicha o'quvchilar reytingi (o'rtacha baho + davomat) — admin "Reyting" sahifasi va
/// o'quvchi/parent portali uchun umumiy manba. HAR O'QUVCHI BITTA QATOR: bir nechta guruhda bo'lsa
/// ham, baho/davomat barcha FAOL guruhlari bo'yicha YIG'ILADI (ilgari har guruh uchun alohida qator
/// chiqib, ko'p guruhli o'quvchi reytingda DUBLIKAT bo'lardi — o'rin/jami soni xato edi).
/// </summary>
public static class RatingService
{
    /// <summary>Barcha o'quvchilarning reyting qatori (har biri bir marta, o'rtacha baho + davomat).</summary>
    public static async Task<List<StudentRatingRowDto>> SchoolAsync(IAppDbContext db)
    {
        // Arxivlanganlar reytingda qatnashmaydi.
        var students = await db.Students.Where(s => !s.IsArchived).ToListAsync();
        var classes = await db.Classes.ToListAsync();
        var classById = classes.ToDictionary(c => c.Id);
        var lateIds = (await db.AbsenceReasons.Where(r => r.IsLate).Select(r => r.Id).ToListAsync()).ToHashSet();

        // Faol a'zoliklar (M2M) — har o'quvchining guruhlari.
        var groupsByStudent = (await db.StudentGroups.Where(m => m.IsActive).ToListAsync())
            .GroupBy(m => m.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(m => m.GroupId).Distinct().ToList());

        // Jurnal yozuvlari va o'tilgan darslar — bir marta yuklab, guruh bo'yicha guruhlaymiz.
        var entriesByClass = (await db.JournalEntries.ToListAsync())
            .GroupBy(e => e.ClassId).ToDictionary(g => g.Key, g => g.ToList());
        var conductedByClass = (await db.LessonNotes.Where(n => n.Conducted).ToListAsync())
            .GroupBy(n => n.ClassId)
            .ToDictionary(g => g.Key, g => g.Select(n => (n.SubjectId, n.Date, n.Period)).ToHashSet());

        var result = new List<StudentRatingRowDto>();
        foreach (var st in students)
        {
            // O'quvchining guruhlari: faol a'zolik (M2M); yo'q bo'lsa ClassName yorlig'i bo'yicha (orqaga moslik).
            var groupIds = groupsByStudent.TryGetValue(st.Id, out var gs) && gs.Count > 0
                ? gs
                : classes.Where(c => !string.IsNullOrEmpty(st.ClassName) && c.Name == st.ClassName)
                    .Select(c => c.Id).ToList();
            if (groupIds.Count == 0) continue; // guruhsiz o'quvchi reytingda yo'q

            var grades = new List<double>();
            int conducted = 0, absent = 0;
            foreach (var gid in groupIds)
            {
                var mine = entriesByClass.TryGetValue(gid, out var ents)
                    ? ents.Where(e => e.StudentId == st.Id).ToList()
                    : new List<JournalEntry>();
                grades.AddRange(mine.Where(e => e.Grade.HasValue).Select(e => (double)e.Grade!.Value));
                if (conductedByClass.TryGetValue(gid, out var cond))
                {
                    conducted += cond.Count;
                    absent += mine.Count(e => e.ReasonId != null && !lateIds.Contains(e.ReasonId)
                        && cond.Contains((e.SubjectId, e.Date, e.Period)));
                }
            }

            var average = grades.Count > 0 ? Math.Round(grades.Average(), 1) : 0;
            double? attendance = conducted > 0 ? Math.Round((double)(conducted - absent) / conducted * 100) : null;

            // Vakil guruh: o'quvchi ClassName yorlig'i (bor bo'lsa), aks holda birinchi guruh nomi.
            var firstCls = classById.TryGetValue(groupIds[0], out var c0) ? c0 : null;
            var className = !string.IsNullOrEmpty(st.ClassName) ? st.ClassName : (firstCls?.Name ?? "");
            var gradeLevel = firstCls?.Grade ?? 0;

            result.Add(new StudentRatingRowDto(Map(st), className, gradeLevel, average, attendance));
        }
        return result;
    }

    private static StudentDto Map(Student s) => new(
        s.Id, s.FullName, s.BirthDate, s.Address, s.Gender,
        s.ParentFullName, s.ParentPhone, s.ClassName, s.EnrollmentDate, s.Balance,
        LoginBlocked: s.LoginBlocked);
}
