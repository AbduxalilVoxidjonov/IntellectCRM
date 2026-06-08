using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Jurnal yozuvlaridan reyting/ko'rsatkichlarni hisoblovchi yordamchi.
/// Baholar JournalEntry.Grade, davomat esa ReasonId belgilangan yozuvlardan olinadi.
/// </summary>
public static class Analytics
{
    public record ClassResult(List<SubjectDto> Subjects, List<ClassStudentRowDto> Rows);

    private static double Round1(double v) => Math.Round(v, 1);

    private static StudentDto Map(Student s) => new(
        s.Id, s.FullName, s.BirthDate, s.Address, s.Gender,
        s.ParentFullName, s.ParentPhone, s.ClassName, s.EnrollmentDate, s.Balance);

    public static ClassResult BuildClass(
        Group cls,
        IReadOnlyList<Student> allStudents,
        IReadOnlyList<Subject> allSubjects,
        IReadOnlyList<ScheduleTemplate> classTemplates,
        IReadOnlyList<JournalEntry> classEntries,
        IReadOnlyList<LessonNote> classNotes,
        IReadOnlyCollection<string>? lateReasonIds = null)
    {
        // "Kech keldi" turidagi sabablar davomatsizlik (absence) sifatida hisoblanmaydi.
        var lateSet = lateReasonIds is null ? new HashSet<string>() : new HashSet<string>(lateReasonIds);
        var students = allStudents.Where(s => s.ClassName == cls.Name).ToList();

        // Davomat FAQAT o'tilgan darslar bo'yicha (ptichka/baho/davomat). Bir kun ichidagi har dars
        // (sana+dars raqami) alohida hisoblanadi.
        var conductedNotes = classNotes.Where(n => n.Conducted)
            .Select(n => (n.SubjectId, n.Date, n.Period)).ToHashSet();

        var fromSchedule = classTemplates.SelectMany(t => t.Lessons).Select(l => l.SubjectId).Distinct().ToList();
        var subjectIds = fromSchedule.Count > 0 ? fromSchedule : allSubjects.Select(s => s.Id).ToList();
        var subjects = subjectIds
            .Select(id => allSubjects.FirstOrDefault(s => s.Id == id))
            .Where(s => s is not null)
            .Select(s => new SubjectDto(s!.Id, s.Name))
            .ToList();

        var rows = students.Select(student =>
        {
            var studentEntries = classEntries.Where(e => e.StudentId == student.Id).ToList();

            var grades = new Dictionary<string, double>();
            foreach (var subj in subjects)
            {
                // Kunlik baholar o'rtachasi.
                var subjectGrades = studentEntries
                    .Where(e => e.SubjectId == subj.Id && e.Grade.HasValue)
                    .Select(e => (double)e.Grade!.Value)
                    .ToList();
                grades[subj.Id] = subjectGrades.Count > 0 ? Round1(subjectGrades.Average()) : 0;
            }

            // O'rtacha: kunlik baholar o'rtachasi.
            var allGrades = studentEntries.Where(e => e.Grade.HasValue).Select(e => (double)e.Grade!.Value).ToList();
            double average = allGrades.Count > 0 ? Round1(allGrades.Average()) : 0;

            // Shu o'quvchi qatnashadigan o'tilgan darslar.
            var studentConducted = conductedNotes;
            var conducted = studentConducted.Count;

            // O'tilgan darslardagi davomatsizliklar (sababli/sababsiz/kasal — KECH KELDI bundan mustasno).
            // Dars o'tilmagan bo'lsa — null.
            var absent = studentEntries.Count(e =>
                e.ReasonId != null && !lateSet.Contains(e.ReasonId)
                && studentConducted.Contains((e.SubjectId, e.Date, e.Period)));
            double? attendance = conducted > 0 ? Math.Round((double)(conducted - absent) / conducted * 100) : null;

            return new ClassStudentRowDto(Map(student), grades, average, attendance);
        }).ToList();

        return new ClassResult(subjects, rows);
    }
}
