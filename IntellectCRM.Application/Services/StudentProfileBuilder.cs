using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'quvchi shaxsiy daftari — bitta o'quvchi haqida BARCHA ma'lumotni jamlaydi:
/// profil, o'zlashtirish (<see cref="StudentReportBuilder"/>), qatnashish (<see cref="Analytics"/>
/// mantig'i), davomat sabablari, intizomiy ball, topshiriqlar (<see cref="AssignmentService"/>),
/// oylik baholash va jurnaldagi uy vazifa/xulq belgilari.
/// </summary>
public static class StudentProfileBuilder
{
    public static async Task<StudentNotebookDto> BuildAsync(IAppDbContext db, Student st)
    {
        var cls = await db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Name == st.ClassName);
        // O'quvchining FAOL guruh(lar)i (M2M) — yo'q bo'lsa ClassName (StudentReportBuilder bilan bir xil mantiq).
        var memberGroupIds = await db.StudentGroups.AsNoTracking()
            .Where(sg => sg.StudentId == st.Id && sg.IsActive).Select(sg => sg.GroupId).ToListAsync();
        var classIds = memberGroupIds.Count > 0
            ? memberGroupIds.ToHashSet()
            : (cls is null ? new HashSet<string>() : new HashSet<string> { cls.Id });
        // Topshiriqlar bitta guruhga tegishli — asosiy (ClassName) guruh, bo'lmasa birinchi guruh.
        var classId = cls?.Id ?? classIds.FirstOrDefault();

        var report = await StudentReportBuilder.BuildAsync(db, st);
        // Bu builder faqat-o'qish (hisobot generatori) — barcha ro'yxatlar AsNoTracking.
        // (Lug'atlar — AbsenceReasons/Subjects — har chaqiruvda yuklanadi; ReferenceCache'ni ulash
        // static builder imzosini KO'P chaqiruv joyida o'zgartirishni talab qiladi, shu sabab hozircha
        // AsNoTracking bilan cheklanamiz — tracking overhead va identity-map yig'ilishini oldini oladi.)
        var entries = await db.JournalEntries.AsNoTracking().Where(e => e.StudentId == st.Id).ToListAsync();
        var reasons = await db.AbsenceReasons.AsNoTracking().ToListAsync();
        var reasonMap = reasons.ToDictionary(r => r.Id);
        var lateSet = reasons.Where(r => r.IsLate).Select(r => r.Id).ToHashSet();

        // ---- Qatnashish (o'tilgan / qatnashgan) — o'quvchining faol guruh(lar)i bo'yicha ----
        var studentConducted = classIds.Count == 0
            ? new HashSet<(string SubjectId, string Date, int Period)>()
            : (await db.LessonNotes.AsNoTracking().Where(n => n.Conducted && classIds.Contains(n.ClassId))
                    .Select(n => new { n.SubjectId, n.Date, n.Period }).ToListAsync())
                .Select(n => (n.SubjectId, n.Date, n.Period)).ToHashSet();
        var conducted = studentConducted.Count;
        var absent = entries.Count(e => e.ReasonId != null && !lateSet.Contains(e.ReasonId)
            && studentConducted.Contains((e.SubjectId, e.Date, e.Period)));
        var attended = Math.Max(0, conducted - absent);
        var pct = conducted > 0 ? (int)Math.Round((double)attended / conducted * 100) : 0;

        // ---- Davomat sabablari taqsimoti (barcha belgilar) ----
        var reasonCounts = entries
            .Where(e => e.ReasonId != null && reasonMap.ContainsKey(e.ReasonId))
            .GroupBy(e => e.ReasonId!)
            .Select(g =>
            {
                var r = reasonMap[g.Key];
                return new AttendanceReasonCountDto(r.Id, r.Name, r.Short, r.IsLate, g.Count());
            })
            .OrderByDescending(x => x.Count).ToList();

        // ---- Intizomiy ball (100 + plus − minus) ----
        var manual = await db.DisciplinePoints.AsNoTracking().Where(p => p.StudentId == st.Id).ToListAsync();
        int plus = 0, minus = 0;
        void Apply(int pts) { if (pts > 0) plus += pts; else if (pts < 0) minus += -pts; }
        foreach (var m in manual) Apply(m.Points);
        foreach (var e in entries)
            if (e.ReasonId != null && reasonMap.TryGetValue(e.ReasonId, out var r) && r.Points != 0) Apply(r.Points);
        var disciplineScore = 100 + plus - minus;

        var dPoints = manual.Select(p => new DisciplinePointDto(
            p.Id, p.StudentId, string.IsNullOrEmpty(p.ReasonName) ? "—" : p.ReasonName,
            p.Points, p.Note, p.CreatedAt, p.CreatedBy, "manual")).ToList();
        foreach (var e in entries)
            if (e.ReasonId != null && reasonMap.TryGetValue(e.ReasonId, out var r) && r.Points != 0)
                dPoints.Add(new DisciplinePointDto(e.Id, st.Id, r.Name, r.Points, "Jurnal davomati", e.Date, "", "attendance"));
        dPoints = dPoints.OrderByDescending(p => p.CreatedAt, StringComparer.Ordinal).ToList();

        // ---- Topshiriqlar ballari ----
        var assignments = classId is null
            ? new StudentAssignmentScoresDto(0, 0, 0, 0, [])
            : await AssignmentService.ScoresForStudentAsync(db, classId, st.Id);

        // ---- Oylik baholash (fan kesimida + umumiy fanlar o'rtachasi) ----
        var evalTypes = await db.EvaluationTypes.AsNoTracking().OrderBy(t => t.CreatedAt)
            .Select(t => new EvaluationTypeDto(t.Id, t.Name, t.Description)).ToListAsync();
        // Faqat fan kesimidagi baholar — "Umumiy" (SubjectId="") ga baho qo'yilmaydi,
        // umumiy statistika butunlay fanlar o'rtachasidan hisoblanadi.
        var evalGrades = (await db.EvaluationGrades.AsNoTracking().Where(g => g.StudentId == st.Id).ToListAsync())
            .Where(g => !string.IsNullOrEmpty(g.Month) && !string.IsNullOrEmpty(g.SubjectId))
            .ToList();

        // Fan kesimida: o'quvchining BARCHA biriktirilgan kurslari (baho qo'yilmagan bo'lsa ham KO'RINADI —
        // shu sabab ko'p guruhli o'quvchida hamma kurs/guruh chiqadi, faqat baholangani emas).
        var gradesBySubj = evalGrades.GroupBy(g => g.SubjectId).ToDictionary(g => g.Key, g => g.ToList());
        var evalsBySubject = report.Subjects
            .Select(subj =>
            {
                var sg = gradesBySubj.GetValueOrDefault(subj.Id) ?? new List<EvaluationGrade>();
                var months = sg.GroupBy(g => g.Month)
                    .OrderBy(m => m.Key, StringComparer.Ordinal)
                    .Select(m =>
                    {
                        var dict = m.GroupBy(x => x.EvaluationTypeId).ToDictionary(x => x.Key, x => x.First().Score);
                        return new MonthlyEvaluationDto(m.Key, dict, dict.Count > 0 ? Math.Round(dict.Values.Average(), 1) : 0);
                    }).ToList();
                var subjAvg = sg.Count > 0 ? Math.Round(sg.Average(x => x.Score), 1) : 0;
                return new SubjectEvaluationDto(subj.Id, subj.Name, subjAvg, months);
            })
            .OrderBy(x => x.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Umumiy: oy → tur bo'yicha FANLAR O'RTACHASI (yaxlitlangan); oylik avg = o'sha oy barcha baholari o'rtachasi.
        var evals = evalGrades
            .GroupBy(g => g.Month)
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .Select(g =>
            {
                var dict = g.GroupBy(x => x.EvaluationTypeId)
                    .ToDictionary(x => x.Key, x => (int)Math.Round(x.Average(v => v.Score)));
                var avg = g.Any() ? Math.Round(g.Average(v => v.Score), 1) : 0;
                return new MonthlyEvaluationDto(g.Key, dict, avg);
            }).ToList();

        // ---- O'zlashtirish: fan → OY ("yyyy-MM") → o'rtacha baho (daftar oyma-oy) ----
        var gradesByMonth = new Dictionary<string, Dictionary<string, double>>();
        foreach (var subj in report.Subjects)
        {
            var byM = entries.Where(e => e.SubjectId == subj.Id && e.Grade != null && e.Date.Length >= 7)
                .GroupBy(e => e.Date[..7])
                .ToDictionary(g => g.Key, g => Math.Round(g.Average(e => (double)e.Grade!.Value), 2));
            if (byM.Count > 0) gradesByMonth[subj.Id] = byM;
        }

        // ---- Davomat oyma-oy: har metrika OY → son ----
        var illSet = reasons.Where(r => !r.IsLate && r.Name.ToLowerInvariant().Contains("kasal"))
            .Select(r => r.Id).ToHashSet();
        var absencesM = entries.Where(e => e.ReasonId != null && e.Date.Length >= 7).ToList();
        bool IsLateE(JournalEntry e) => lateSet.Contains(e.ReasonId!);
        bool IsIllE(JournalEntry e) => illSet.Contains(e.ReasonId!);
        Dictionary<string, int> PerM(Func<JournalEntry, bool> pred) =>
            absencesM.Where(pred).GroupBy(e => e.Date[..7]).ToDictionary(g => g.Key, g => g.Count());
        Dictionary<string, int> PerMDays(Func<JournalEntry, bool> pred) =>
            absencesM.Where(pred).GroupBy(e => e.Date[..7])
                .ToDictionary(g => g.Key, g => g.Select(e => e.Date).Distinct().Count());
        var monthlyAttendance = new MonthlyAttendanceDto(
            PerMDays(e => !IsLateE(e)), PerMDays(IsIllE),
            PerM(e => !IsLateE(e)), PerM(IsIllE), PerM(IsLateE));

        // ---- Uy vazifa + xulq (jami + OYMA-OY trend) ----
        var hwDone = entries.Count(e => e.Homework == 1);
        var hwMissed = entries.Count(e => e.Homework == 2);
        var bGood = entries.Count(e => e.Behavior == 1);
        var bBad = entries.Count(e => e.Behavior == 2);
        var markByMonth = entries.Where(e => (e.Homework != 0 || e.Behavior != 0) && e.Date.Length >= 7)
            .GroupBy(e => e.Date[..7]).ToDictionary(g => g.Key, g => g.ToList());
        var trend = markByMonth.Keys.OrderBy(k => k, StringComparer.Ordinal).Select(m =>
        {
            var list = markByMonth[m];
            return new MonthMarksDto(m,
                list.Count(e => e.Homework == 1), list.Count(e => e.Homework == 2),
                list.Count(e => e.Behavior == 1), list.Count(e => e.Behavior == 2));
        }).ToList();

        // ---- O'rtacha baho (barcha fan/oy baholarining o'rtachasi) ----
        var allGradeVals = gradesByMonth.Values.SelectMany(d => d.Values).ToList();
        var avgGrade = allGradeVals.Count > 0 ? Math.Round(allGradeVals.Average(), 1) : 0;

        return new StudentNotebookDto(
            st.Id, st.FullName, st.ClassName, report.HomeroomTeacher,
            st.ParentFullName, st.ParentPhone, st.Gender, st.BirthDate,
            st.EnrollmentDate, st.Balance, st.BirthCertificateUrl,
            st.Address, st.DiscountPct, st.DiscountAmount, st.DiscountNote,
            st.ParentPassportUrl,
            report.Subjects, gradesByMonth, avgGrade,
            monthlyAttendance, conducted, attended, pct, reasonCounts,
            disciplineScore, plus, minus, dPoints,
            assignments,
            evalTypes, evals, evalsBySubject,
            hwDone, hwMissed, bGood, bBad, trend);
    }
}
