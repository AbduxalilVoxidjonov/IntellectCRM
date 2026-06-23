using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'qituvchilarning faollik hisobotini quradi: dars o'tyaptimi (jadvalga nisbatan bajarilish),
/// baho qo'ymoqdami, mavzu va uy vazifa bermoqdami.
///
/// <para>Jurnal yozuvlarida (LessonNote/JournalEntry) o'qituvchi id'si yo'q — kim o'qitishi dars
/// jadvalidan (ScheduleLesson.TeacherId) (ClassId, SubjectId) kaliti orqali aniqlanadi.
/// "Reja" (Expected) = haftalarga biriktirilgan jadvaldan kelib chiqib BUGUNGACHA bo'lishi kerak
/// bo'lgan dars sonidir.</para>
/// </summary>
public static class TeacherActivityReport
{
    /// <summary>Bir (o'qituvchi, sinf, fan) kesimi bo'yicha yig'ma sonlar.</summary>
    private sealed class Agg
    {
        public int Expected, Conducted, Topic, Homework, Grades;
    }

    private sealed class Computed
    {
        public Dictionary<(string Teacher, string Class, string Subject), Agg> ByKey = new();
        public Dictionary<string, string> LastActivity = new(); // teacherId -> ISO sana
    }

    /// <summary>Umumiy ko'rinish: barcha o'qituvchilar bo'yicha bitta-bitta qator.</summary>
    public static async Task<List<TeacherReportRowDto>> BuildOverviewAsync(IAppDbContext db)
    {
        var (c, teachers, _, _, lifecycle) = await ComputeAsync(db);
        var rows = teachers
            .Select(t => Row(t.Id, t.FullName, t.IsArchived, KeysFor(c, t.Id), c.LastActivity.GetValueOrDefault(t.Id),
                lifecycle.GetValueOrDefault(t.Id, new LifecycleCounts())))
            .OrderBy(r => r.IsArchived).ThenBy(r => r.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return rows;
    }

    /// <summary>Bitta o'qituvchining batafsil hisoboti (sinf/fan yoyilmasi bilan).</summary>
    public static async Task<TeacherReportDetailDto?> BuildDetailAsync(IAppDbContext db, string teacherId)
    {
        var (c, teachers, classNames, subjectNames, lifecycle) = await ComputeAsync(db);
        var teacher = teachers.FirstOrDefault(t => t.Id == teacherId);
        if (teacher is null) return null;

        var keys = KeysFor(c, teacherId);
        var lc = lifecycle.GetValueOrDefault(teacherId, new LifecycleCounts());
        var total = Row(teacher.Id, teacher.FullName, teacher.IsArchived, keys, c.LastActivity.GetValueOrDefault(teacherId), lc);

        var breakdown = keys
            .Select(kv => new TeacherReportBreakdownDto(
                classNames.GetValueOrDefault(kv.Key.Class, kv.Key.Class),
                subjectNames.GetValueOrDefault(kv.Key.Subject, kv.Key.Subject),
                kv.Value.Expected, kv.Value.Conducted, Pct(kv.Value.Conducted, kv.Value.Expected, cap: true),
                kv.Value.Grades, Pct(kv.Value.Topic, kv.Value.Conducted), Pct(kv.Value.Homework, kv.Value.Conducted)))
            .OrderBy(r => r.ClassName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new TeacherReportDetailDto(
            total.TeacherId, total.FullName, total.IsArchived,
            total.Expected, total.Conducted, total.DonePct,
            total.Grades, total.TopicPct, total.HomeworkPct,
            total.LastActivity, total.Status,
            total.Came, total.Active, total.Trial, total.Frozen, total.Left, total.ConversionPct,
            breakdown);
    }

    // ---------- Ichki hisoblash ----------

    /// <summary>Bir o'qituvchi guruhlari bo'yicha o'quvchi lifecycle sanoqlari.</summary>
    private sealed class LifecycleCounts
    {
        public int Came, Active, Trial, Frozen, Left;
        public int? ConversionPct => Came > 0 ? (int)Math.Round(Active * 100.0 / Came) : null;
    }

    private static List<KeyValuePair<(string Teacher, string Class, string Subject), Agg>>
        KeysFor(Computed c, string teacherId) =>
        c.ByKey.Where(kv => kv.Key.Teacher == teacherId).ToList();

    private static TeacherReportRowDto Row(
        string teacherId, string fullName, bool isArchived,
        List<KeyValuePair<(string Teacher, string Class, string Subject), Agg>> keys,
        string? lastActivity,
        LifecycleCounts lc)
    {
        var exp = keys.Sum(k => k.Value.Expected);
        var cond = keys.Sum(k => k.Value.Conducted);
        var topic = keys.Sum(k => k.Value.Topic);
        var hw = keys.Sum(k => k.Value.Homework);
        var grades = keys.Sum(k => k.Value.Grades);

        var donePct = Pct(cond, exp, cap: true);
        // Holat: rejaga nisbatan bajarilish (reja bo'lmasa — faollik bor-yo'qligiga qarab).
        var score = exp > 0 ? donePct ?? 0 : (cond > 0 ? 100 : 0);
        var status = (exp == 0 && cond == 0 && grades == 0)
            ? "none"
            : (score >= 70 ? "active" : "low");

        return new TeacherReportRowDto(
            teacherId, fullName, isArchived,
            exp, cond, donePct, grades,
            Pct(topic, cond), Pct(hw, cond), lastActivity, status,
            lc.Came, lc.Active, lc.Trial, lc.Frozen, lc.Left, lc.ConversionPct);
    }

    /// <summary>a/b foizi (butun son). b=0 → null. cap=true bo'lsa 100 dan oshmaydi.</summary>
    private static int? Pct(int a, int b, bool cap = false)
    {
        if (b <= 0) return null;
        var p = (int)Math.Round(a * 100.0 / b);
        return cap && p > 100 ? 100 : p;
    }

    private static async Task<(
        Computed Computed,
        List<Teacher> Teachers,
        Dictionary<string, string> ClassNames,
        Dictionary<string, string> SubjectNames,
        Dictionary<string, LifecycleCounts> Lifecycle)> ComputeAsync(IAppDbContext db)
    {
        var teachers = await db.Teachers.ToListAsync();
        var classes = await db.Classes.ToListAsync();
        var classNames = classes.ToDictionary(c => c.Id, c => c.Name);
        var subjectNames = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);

        var notes = await db.LessonNotes.ToListAsync();
        var entries = await db.JournalEntries.Where(e => e.Grade != null).ToListAsync();

        // (ClassId, SubjectId=CourseId) -> TeacherId; va (ClassId, SubjectId) -> o'qituvchilar to'plami.
        // Biriktirish endi to'g'ridan-to'g'ri guruhda: Group.TeacherId (o'qituvchi) + Group.CourseId (kurs).
        var exact = new Dictionary<(string, string), string>();
        var bySubject = new Dictionary<(string, string), HashSet<string>>();
        foreach (var g in classes)
        {
            if (string.IsNullOrEmpty(g.TeacherId) || string.IsNullOrEmpty(g.CourseId)) continue;
            exact[(g.Id, g.CourseId)] = g.TeacherId;
            if (!bySubject.TryGetValue((g.Id, g.CourseId), out var set))
                bySubject[(g.Id, g.CourseId)] = set = new();
            set.Add(g.TeacherId);
        }

        string? Attribute(string classId, string subjectId)
        {
            if (exact.TryGetValue((classId, subjectId), out var t1)) return t1;
            if (bySubject.TryGetValue((classId, subjectId), out var set) && set.Count == 1) return set.First();
            return null;
        }

        var c = new Computed();
        Agg Key(string teacher, string classId, string subjectId)
        {
            var k = (teacher, classId, subjectId);
            if (!c.ByKey.TryGetValue(k, out var a)) c.ByKey[k] = a = new();
            return a;
        }
        void Touch(string teacher, string date)
        {
            if (string.IsNullOrEmpty(date)) return;
            if (!c.LastActivity.TryGetValue(teacher, out var cur) || string.CompareOrdinal(date, cur) > 0)
                c.LastActivity[teacher] = date;
        }

        // --- Reja (Expected): qo'lda qo'shilgan darslar, bugungacha (jadval olib tashlandi) ---
        var today = AppClock.Today.ToString("yyyy-MM-dd");
        foreach (var n in notes)
        {
            if (string.CompareOrdinal(n.Date, today) > 0) continue; // kelajak dars — hali reja emas
            var teacher = Attribute(n.ClassId, n.SubjectId);
            if (teacher is null) continue;
            Key(teacher, n.ClassId, n.SubjectId).Expected++;
        }

        // --- O'tilgan darslar + mavzu/uy vazifa (LessonNote) ---
        foreach (var n in notes)
        {
            if (!n.Conducted) continue;
            var teacher = Attribute(n.ClassId, n.SubjectId);
            if (teacher is null) continue;
            var agg = Key(teacher, n.ClassId, n.SubjectId);
            agg.Conducted++;
            if (!string.IsNullOrWhiteSpace(n.Topic)) agg.Topic++;
            if (!string.IsNullOrWhiteSpace(n.Homework)) agg.Homework++;
            Touch(teacher, n.Date);
        }

        // --- Qo'yilgan baholar (JournalEntry) ---
        foreach (var e in entries)
        {
            var teacher = Attribute(e.ClassId, e.SubjectId);
            if (teacher is null) continue;
            Key(teacher, e.ClassId, e.SubjectId).Grades++;
            Touch(teacher, e.Date);
        }

        // --- O'quvchi lifecycle sanoqlari: har o'qituvchi guruhlari bo'yicha ---
        // Arxivlanmagan guruhlar (active/full) -> TeacherId xaritasi
        var groupTeacher = classes
            .Where(g => !g.IsArchived && !string.IsNullOrEmpty(g.TeacherId))
            .ToDictionary(g => g.Id, g => g.TeacherId);

        // Guruh IDlari to'plami (arxivlanmagan)
        var nonArchivedGroupIds = groupTeacher.Keys.ToHashSet();

        // Barcha a'zoliklar (faqat arxivlanmagan guruhlar bo'yicha)
        var memberships = await db.StudentGroups
            .Where(sg => nonArchivedGroupIds.Contains(sg.GroupId))
            .ToListAsync();

        var lifecycle = new Dictionary<string, LifecycleCounts>();
        foreach (var sg in memberships)
        {
            if (!groupTeacher.TryGetValue(sg.GroupId, out var tId)) continue;
            if (!lifecycle.TryGetValue(tId, out var lc)) lifecycle[tId] = lc = new LifecycleCounts();

            lc.Came++;
            if (!sg.IsActive)
                lc.Left++;
            else if (sg.Status == "active")
                lc.Active++;
            else if (sg.Status == "trial")
                lc.Trial++;
            else if (sg.Status == "frozen")
                lc.Frozen++;
        }

        return (c, teachers, classNames, subjectNames, lifecycle);
    }
}
