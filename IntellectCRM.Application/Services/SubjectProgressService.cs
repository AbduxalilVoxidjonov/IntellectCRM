using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "Fan progresi" — dars jadvali (reja) va jurnaldagi "dars o'tildi" belgilashi
/// (<see cref="LessonNote.Conducted"/>) asosida hisoblanadi. LMS moduliga bog'liq EMAS.
///
/// <para><b>Reja (Planned)</b> = sinfga biriktirilgan jadval (template) bo'yicha shu fanning jami
/// dars kataklari soni. <b>O'tilgan (Conducted)</b> = o'sha kataklardan o'qituvchi "o'tildi" deb
/// belgilaganlari. <b>Progress</b> = Conducted / Planned.</para>
///
/// <para>Chorak davri tizimi olib tashlandi — hafta raqamlari o'quv yili boshidan (eng erta qabul
/// oyining 1-sanasidan) ketma-ket sanaladi: WeekAssignment.Week → shu hafta dushanbasi.</para>
/// </summary>
public static class SubjectProgressService
{
    /// <summary>Bitta reja dars nusxasi (aniq kun + dars raqami).</summary>
    public sealed class LessonSlot
    {
        public string Date { get; init; } = "";
        public int Period { get; init; }
        public string SubjectId { get; init; } = "";
        public string TeacherId { get; init; } = "";
        public bool Conducted { get; init; }
        public string Topic { get; init; } = "";
        public string? Homework { get; init; }
    }

    private static string Today => AppClock.Today.ToString("yyyy-MM-dd");

    private static int Pct(int a, int b) => b <= 0 ? 0 : (int)Math.Round(a * 100.0 / b);

    /// <summary>O'quv yili birinchi dushanbasi (hafta raqamlarining tayanchi).</summary>
    private static async Task<string> FirstMondayAsync(IAppDbContext db)
    {
        var startMonth = await TuitionService.AcademicYearStartMonthAsync(db); // "yyyy-MM"
        return ScheduleMath.MondayOfISO($"{startMonth}-01");
    }

    /// <summary>Sinfning BARCHA reja dars nusxalari (har birida o'tilgan/topic bilan).</summary>
    public static async Task<List<LessonSlot>> ClassSlotsAsync(
        IAppDbContext db, string classId, int quarter)
    {
        var assignments = await db.WeekAssignments
            .Where(a => a.ClassId == classId && a.Quarter == quarter && a.TemplateId != null)
            .ToListAsync();
        if (assignments.Count == 0) return new();

        var templateIds = assignments.Select(a => a.TemplateId!).Distinct().ToList();
        var templates = (await db.ScheduleTemplates.Include(t => t.Lessons)
                .Where(t => templateIds.Contains(t.Id)).ToListAsync())
            .ToDictionary(t => t.Id, t => t.Lessons);

        var notes = await db.LessonNotes
            .Where(n => n.ClassId == classId && n.Quarter == quarter)
            .ToListAsync();
        var noteMap = notes.ToDictionary(n => (n.Date, n.Period, n.SubjectId));

        var firstMonday = await FirstMondayAsync(db);
        var slots = new List<LessonSlot>();
        foreach (var a in assignments)
        {
            if (a.TemplateId is null || a.Week <= 0 || !templates.TryGetValue(a.TemplateId, out var lessons)) continue;
            var monday = ScheduleMath.AddDaysISO(firstMonday, (a.Week - 1) * 7);
            foreach (var l in lessons)
            {
                var date = ScheduleMath.AddDaysISO(monday, l.Day);
                noteMap.TryGetValue((date, l.Period, l.SubjectId), out var n);
                slots.Add(new LessonSlot
                {
                    Date = date,
                    Period = l.Period,
                    SubjectId = l.SubjectId,
                    TeacherId = l.TeacherId,
                    Conducted = n?.Conducted ?? false,
                    Topic = n?.Topic ?? "",
                    Homework = n?.Homework,
                });
            }
        }
        return slots;
    }

    /// <summary>O'quvchi/ota-ona: umumiy + har bir fan progresi.</summary>
    public static async Task<StudentSubjectsProgressDto> ForStudentAsync(
        IAppDbContext db, string classId, int quarter)
    {
        var slots = await ClassSlotsAsync(db, classId, quarter);
        var subjectNames = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);
        var today = Today;

        var subjects = slots
            .GroupBy(s => s.SubjectId)
            .Select(g =>
            {
                var ordered = g.OrderBy(x => x.Date, StringComparer.Ordinal).ThenBy(x => x.Period).ToList();
                var planned = ordered.Count;
                var conducted = ordered.Count(x => x.Conducted);
                var expected = ordered.Count(x => string.CompareOrdinal(x.Date, today) <= 0);
                var next = ordered.FirstOrDefault(x => !x.Conducted)?.Date;
                var last = ordered.Count > 0 ? ordered[^1].Date : null;
                return new SubjectProgressDto(
                    g.Key, subjectNames.GetValueOrDefault(g.Key, ""),
                    planned, conducted, Math.Max(0, planned - conducted),
                    Pct(conducted, planned), expected, next, last);
            })
            .OrderBy(s => s.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalPlanned = subjects.Sum(s => s.Planned);
        var totalConducted = subjects.Sum(s => s.Conducted);
        return new StudentSubjectsProgressDto(
            quarter, totalPlanned, totalConducted, Pct(totalConducted, totalPlanned), subjects);
    }

    /// <summary>O'quvchi: bitta fanga kirilganda darslar ro'yxati (yashil/qizil). Fan topilmasa null.</summary>
    public static async Task<SubjectProgressDetailDto?> ForStudentSubjectAsync(
        IAppDbContext db, string classId, int quarter, string subjectId)
    {
        var slots = (await ClassSlotsAsync(db, classId, quarter))
            .Where(s => s.SubjectId == subjectId)
            .OrderBy(s => s.Date, StringComparer.Ordinal).ThenBy(s => s.Period)
            .ToList();
        if (slots.Count == 0) return null;

        var name = (await db.Subjects.FindAsync(subjectId))?.Name ?? "";
        var times = await db.LessonTimes.ToDictionaryAsync(x => x.Period);
        var today = Today;

        var lessons = slots.Select(s =>
        {
            times.TryGetValue(s.Period, out var lt);
            return new SubjectLessonDto(
                s.Date, s.Period, lt?.StartTime, lt?.EndTime,
                s.Topic, s.Homework, s.Conducted,
                string.CompareOrdinal(s.Date, today) <= 0);
        }).ToList();

        var planned = slots.Count;
        var conducted = slots.Count(s => s.Conducted);
        return new SubjectProgressDetailDto(
            subjectId, name, quarter, planned, conducted,
            Math.Max(0, planned - conducted), Pct(conducted, planned), lessons);
    }

    /// <summary>
    /// O'qituvchi: o'zi o'tadigan barcha (sinf, fan) bo'yicha o'tilgan darslar progresi.
    /// Barcha kerakli ma'lumot BIR martada yuklanadi (sinflar bo'ylab takroriy so'rov yo'q).
    /// </summary>
    public static async Task<TeacherProgressDto> ForTeacherAsync(IAppDbContext db, string teacherId, int quarter)
    {
        var templates = await db.ScheduleTemplates.Include(t => t.Lessons).ToListAsync();

        // O'qituvchi dars beradigan sinflar (jadval template'laridan).
        var taughtClassIds = templates
            .Where(t => t.Lessons.Any(l => l.TeacherId == teacherId))
            .Select(t => t.ClassId).ToHashSet(StringComparer.Ordinal);

        if (taughtClassIds.Count == 0)
            return new TeacherProgressDto(quarter, 0, 0, 0, new());

        var classNames = await db.Classes.ToDictionaryAsync(c => c.Id, c => c.Name);
        var subjectNames = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);

        // Faqat shu sinflar + chorak uchun: hafta biriktiruvlari va jurnal yozuvlari — bir martada.
        var assignments = await db.WeekAssignments
            .Where(a => a.Quarter == quarter && a.TemplateId != null && taughtClassIds.Contains(a.ClassId))
            .ToListAsync();
        var notes = await db.LessonNotes
            .Where(n => n.Quarter == quarter && taughtClassIds.Contains(n.ClassId))
            .ToListAsync();
        var noteMap = notes.ToDictionary(n => (n.ClassId, n.Date, n.Period, n.SubjectId));
        var tplById = templates.ToDictionary(t => t.Id, t => t.Lessons);

        var firstMonday = await FirstMondayAsync(db);
        var today = Today;

        // (sinf, fan) -> (reja, o'tilgan, bugungacha kutilgan)
        var agg = new Dictionary<(string ClassId, string SubjectId), (int Planned, int Conducted, int Expected)>();
        foreach (var a in assignments)
        {
            if (a.TemplateId is null || a.Week <= 0 || !tplById.TryGetValue(a.TemplateId, out var lessons)) continue;
            var monday = ScheduleMath.AddDaysISO(firstMonday, (a.Week - 1) * 7);
            foreach (var l in lessons.Where(l => l.TeacherId == teacherId))
            {
                var date = ScheduleMath.AddDaysISO(monday, l.Day);
                noteMap.TryGetValue((a.ClassId, date, l.Period, l.SubjectId), out var n);
                var key = (a.ClassId, l.SubjectId);
                agg.TryGetValue(key, out var cur);
                cur.Planned++;
                if (n?.Conducted == true) cur.Conducted++;
                if (string.CompareOrdinal(date, today) <= 0) cur.Expected++;
                agg[key] = cur;
            }
        }

        var items = agg
            .Select(kv => new TeacherSubjectProgressDto(
                kv.Key.ClassId, classNames.GetValueOrDefault(kv.Key.ClassId, ""),
                kv.Key.SubjectId, subjectNames.GetValueOrDefault(kv.Key.SubjectId, ""),
                kv.Value.Planned, kv.Value.Conducted,
                Math.Max(0, kv.Value.Planned - kv.Value.Conducted),
                Pct(kv.Value.Conducted, kv.Value.Planned), kv.Value.Expected))
            .OrderBy(i => i.ClassName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(i => i.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalPlanned = items.Sum(i => i.Planned);
        var totalConducted = items.Sum(i => i.Conducted);
        return new TeacherProgressDto(
            quarter, totalPlanned, totalConducted, Pct(totalConducted, totalPlanned), items);
    }
}
