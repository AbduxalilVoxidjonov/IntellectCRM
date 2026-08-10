using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Markaz bo'yicha o'quvchilar reytingi — admin "Reyting" sahifasi va o'quvchi/parent portali uchun
/// umumiy manba. O'RIN <b>YIG'ILGAN BALL</b> bo'yicha belgilanadi (o'rtacha baho EMAS):
/// <c>Ball = Σ(jurnal baholari) + Σ(bajarilgan baholash mezonlari)</c> — <see cref="StudentBallService"/>.
/// O'rtacha baho va davomat qo'shimcha ko'rsatkich sifatida qaytadi.
/// HAR O'QUVCHI BITTA QATOR: bir nechta guruhda bo'lsa ham, baho/davomat barcha FAOL guruhlari bo'yicha
/// YIG'ILADI (ilgari har guruh uchun alohida qator chiqib, ko'p guruhli o'quvchi reytingda DUBLIKAT
/// bo'lardi — o'rin/jami soni xato edi).
/// </summary>
public static class RatingService
{
    /// <summary>Barcha o'quvchilarning reyting qatori (har biri bir marta: ball + o'rtacha baho + davomat).</summary>
    public static async Task<List<StudentRatingRowDto>> SchoolAsync(IAppDbContext db)
    {
        // Yig'ilgan ball (jurnal baholari + bajarilgan mezonlar) — reyting shu bo'yicha saralanadi.
        var balls = await StudentBallService.ComputeAsync(db);
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

            var ball = balls.GetValueOrDefault(st.Id)?.Ball ?? 0;
            // GroupIds — guruh reytingi SHU bo'yicha ajratiladi (ClassName matni emas).
            result.Add(new StudentRatingRowDto(
                Map(st), className, gradeLevel, average, attendance, ball, groupIds));
        }
        return result;
    }

    /// <summary>
    /// O'QUVCHI/PARENT PORTALI reytingi: markaz TOP 15 + o'quvchining HAR BIR faol guruhi alohida.
    ///
    /// <para><b>Nega guruh a'zoligi bo'yicha:</b> ilgari guruh ro'yxati <c>ClassName</c> matn
    /// yorlig'i tengligi bilan qurilardi. M2M a'zolikka o'tilgandan keyin bu yorliq ko'p
    /// o'quvchida BO'SH yoki ESKIRGAN — bo'sh bo'lsa ro'yxat umuman bo'sh chiqar
    /// ("Reyting yo'q"), eskirgan bo'lsa butunlay boshqa guruh odamlari ko'rinardi.</para>
    ///
    /// <para>Har guruh ichida o'rin QAYTA raqamlanadi (1,2,3...) — podium (1/2/3) shunga tayanadi.
    /// Faol a'zoligi yo'q o'quvchida eski <c>ClassName</c> tengligiga qaytiladi (fallback) —
    /// eski/guruhsiz yozuvlar yo'qolmasin.</para>
    /// </summary>
    /// <param name="school">Keshdan olingan markaz reytingi (<see cref="SchoolAsync"/>) — bu yerda
    /// saralanadi, chaqiruvchi oldindan saralashi shart emas.</param>
    public static async Task<PortalRatingDto> PortalAsync(
        IAppDbContext db, Student s, IEnumerable<StudentRatingRowDto> school)
    {
        // YIG'ILGAN BALL bo'yicha kamayish tartibida (teng bo'lsa o'rtacha baho hal qiladi).
        var ordered = school.OrderByDescending(r => r.Ball).ThenByDescending(r => r.Average).ToList();

        static PortalRatingRowDto Map(StudentRatingRowDto r, int i) =>
            new(i + 1, r.Student.Id, r.Student.FullName, r.ClassName, r.Average, r.Attendance, r.Ball);

        // O'quvchining FAOL guruhlari — bitta so'rov (N+1 yo'q).
        var myGroupIds = await db.StudentGroups.AsNoTracking()
            .Where(sg => sg.StudentId == s.Id && sg.IsActive)
            .Select(sg => sg.GroupId).Distinct().ToListAsync();

        var groups = new List<PortalRatingGroupDto>();
        if (myGroupIds.Count > 0)
        {
            // Guruh nomlari — yana bitta so'rov (har guruh uchun alohida emas).
            var names = await db.Classes.AsNoTracking()
                .Where(c => myGroupIds.Contains(c.Id))
                .Select(c => new { c.Id, c.Name })
                .ToListAsync();
            foreach (var g in names.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
            {
                var rows = ordered
                    .Where(r => r.GroupIds != null && r.GroupIds.Contains(g.Id))
                    .Select(Map).ToList();   // o'rin guruh ICHIDA qayta raqamlanadi
                if (rows.Count == 0) continue;
                var me = rows.FindIndex(r => r.StudentId == s.Id);
                groups.Add(new PortalRatingGroupDto(g.Id, g.Name, rows, me >= 0 ? me + 1 : 0, rows.Count));
            }
        }
        else if (!string.IsNullOrEmpty(s.ClassName))
        {
            // FALLBACK: faol a'zolik yo'q — eski "asosiy guruh" yorlig'i bo'yicha.
            var rows = ordered.Where(r => r.ClassName == s.ClassName).Select(Map).ToList();
            if (rows.Count > 0)
            {
                var me = rows.FindIndex(r => r.StudentId == s.Id);
                groups.Add(new PortalRatingGroupDto("", s.ClassName, rows, me >= 0 ? me + 1 : 0, rows.Count));
            }
        }

        // ClassRows — ESKI maydon (web klient va ilovaning eski versiyalari o'qiydi): birinchi guruh.
        var classRows = groups.Count > 0 ? groups[0].Rows : new List<PortalRatingRowDto>();
        var schoolRows = ordered.Take(15).Select(Map).ToList();

        var meIdx = ordered.FindIndex(r => r.Student.Id == s.Id);
        int? meSchoolRank = meIdx >= 0 ? meIdx + 1 : null;

        return new PortalRatingDto(s.Id, classRows, schoolRows, meSchoolRank, ordered.Count, groups);
    }

    private static StudentDto Map(Student s) => new(
        s.Id, s.FullName, s.BirthDate, s.Address, s.Gender,
        s.ParentFullName, s.ParentPhone, s.ClassName, s.EnrollmentDate, s.Balance,
        LoginBlocked: s.LoginBlocked);
}
