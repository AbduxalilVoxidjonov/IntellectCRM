using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Jurnal o'qish/yozish mantig'i (baho, davomat, dars mavzusi/uyga vazifa). Admin jurnali ham,
/// o'qituvchi ilovasi ham shu yagona mantiqdan foydalanadi (faqat ruxsat tekshiruvi farq qiladi).
/// </summary>
public static class JournalService
{
    /// <summary>
    /// Fanning darslari (sana + dars raqami). Dars jadvali olib tashlandi — ustunlar endi QO'LDA
    /// qo'shilgan darslardan (LessonNote) keladi: o'qituvchi/admin dars qo'shsa yoki birinchi baho/davomat
    /// kiritilsa LessonNote yaratiladi (Conducted=true) va ustun paydo bo'ladi. Bir kunda bir fan bir
    /// necha marta bo'lishi mumkin (Period — oddiy tartib raqami).
    /// </summary>
    public static async Task<List<JournalColumnDto>> ComputeColumnsAsync(
        IAppDbContext db, string classId, string subjectId, int quarter) =>
        await db.LessonNotes
            .Where(n => n.ClassId == classId && n.SubjectId == subjectId && n.Quarter == quarter)
            .OrderBy(n => n.Date).ThenBy(n => n.Period)
            .Select(n => new JournalColumnDto(n.Date, n.Period))
            .ToListAsync();

    /// <summary>
    /// Guruhning bitta OYLIK jurnali. Dars jadvali yo'q — ustunlar guruh <see cref="Group.Days"/> (hafta
    /// kunlari) bo'yicha SHU OYDAGI sanalardan avtomatik quriladi (Period=1). Qatorlar — faqat FAOL a'zolar.
    /// Mavjud oylar: guruh boshlanish sanasidan (yoki eng erta a'zolik) joriy oygacha. Fan = guruh kursi.
    /// </summary>
    public static async Task<GroupJournalDto?> GroupMonthAsync(IAppDbContext db, string classId, string? month)
    {
        var cls = await db.Classes.FindAsync(classId);
        if (cls is null) return null;
        var subjectId = cls.CourseId ?? "";
        var courseName = string.IsNullOrEmpty(subjectId) ? "" : (await db.Subjects.FindAsync(subjectId))?.Name ?? "";
        var teacherName = string.IsNullOrEmpty(cls.TeacherId) ? "" : (await db.Teachers.FindAsync(cls.TeacherId))?.FullName ?? "";

        // Faol a'zolar (IsActive). Status: trial/active/frozen.
        var memberships = await db.StudentGroups.Where(sg => sg.GroupId == classId && sg.IsActive).ToListAsync();
        var ids = memberships.Select(m => m.StudentId).ToList();
        var studentById = (await db.Students.Where(s => ids.Contains(s.Id)).ToListAsync())
            .ToDictionary(s => s.Id);
        var students = memberships
            .Where(m => studentById.ContainsKey(m.StudentId))
            .Select(m =>
            {
                var st = studentById[m.StudentId];
                return new GroupJournalStudentDto(m.StudentId, st.FullName, m.Status ?? "trial", m.ActivatedAt ?? "", st.Balance);
            })
            .OrderBy(s => s.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Mavjud oylar: guruh StartDate (yoki eng erta a'zolik JoinedAt) oyidan joriy oygacha.
        var starts = new List<string>();
        if (!string.IsNullOrEmpty(cls.StartDate) && cls.StartDate.Length >= 7) starts.Add(cls.StartDate[..7]);
        foreach (var m in memberships)
            if (!string.IsNullOrEmpty(m.JoinedAt) && m.JoinedAt.Length >= 7) starts.Add(m.JoinedAt[..7]);
        var cur = TuitionService.CurrentMonth();
        var from = starts.Count > 0 ? starts.Min()! : cur;
        if (string.CompareOrdinal(from, cur) > 0) from = cur;
        var months = TuitionService.MonthRange(from, cur).ToList();
        if (months.Count == 0) months.Add(cur);
        var resolved = !string.IsNullOrEmpty(month) && months.Contains(month) ? month! : months[^1];

        // Ustunlar: shu oyda guruh kunlariga to'g'ri keladigan sanalar (Period=1).
        var columns = LessonDatesInMonth(cls.Days, resolved)
            .Select(d => new JournalColumnDto(d, 1)).ToList();

        // Yozuvlar: shu guruh + kurs + oy (sana prefiksi bo'yicha).
        var entries = string.IsNullOrEmpty(subjectId)
            ? new List<JournalEntryDto>()
            : await db.JournalEntries
                .Where(e => e.ClassId == classId && e.SubjectId == subjectId && e.Date.StartsWith(resolved))
                .Select(e => new JournalEntryDto(e.StudentId, e.Date, e.Period, e.Grade, e.ReasonId, e.Homework, e.Behavior, e.Mastery))
                .ToListAsync();

        // "O'tildi" deb belgilangan dars sanalari — sababsiz o'quvchi shu kunda KELDI (yashil) deb ko'rsatiladi.
        var conductedDates = string.IsNullOrEmpty(subjectId)
            ? new List<string>()
            : await db.LessonNotes
                .Where(n => n.ClassId == classId && n.SubjectId == subjectId && n.Conducted && n.Date.StartsWith(resolved))
                .Select(n => n.Date).Distinct().ToListAsync();

        var info = new GroupJournalInfoDto(
            cls.Id, cls.Name, subjectId, courseName, teacherName,
            cls.Days, cls.StartTime, cls.EndTime, cls.Room ?? "", cls.StartDate ?? "", cls.MonthlyFee);
        return new GroupJournalDto(info, months, resolved, columns, students, entries, conductedDates);
    }

    /// <summary>"yyyy-MM" oyidagi, berilgan hafta kunlariga (0=Du..6=Yak) to'g'ri keladigan sanalar ("yyyy-MM-dd").</summary>
    public static IEnumerable<string> LessonDatesInMonth(IReadOnlyCollection<int> days, string month)
    {
        if (days.Count == 0 || month.Length < 7) yield break;
        var y = int.Parse(month[..4]);
        var m = int.Parse(month[5..7]);
        var set = days.ToHashSet();
        for (var day = 1; day <= DateTime.DaysInMonth(y, m); day++)
        {
            var d = new DateOnly(y, m, day);
            if (set.Contains(((int)d.DayOfWeek + 6) % 7)) yield return d.ToString("yyyy-MM-dd");
        }
    }

    public static async Task<List<JournalEntryDto>> GetEntriesAsync(
        IAppDbContext db, string classId, string subjectId, int quarter) =>
        await db.JournalEntries
            .Where(e => e.ClassId == classId && e.SubjectId == subjectId && e.Quarter == quarter)
            .Select(e => new JournalEntryDto(e.StudentId, e.Date, e.Period, e.Grade, e.ReasonId, e.Homework, e.Behavior, e.Mastery))
            .ToListAsync();

    /// <summary>
    /// Bitta katakni belgilash — baho yoki davomat sababi (mavjud bo'lsa ustiga yoziladi).
    /// </summary>
    /// <summary>Bitta katakni belgilaydi (baho/davomat). Qaytaradi: davomat SABABI YANGI belgilandimi
    /// (req.ReasonId != null va eski qiymatdan o'zgardi) — chaqiruvchi shunga qarab "darsga kelmadi"
    /// avto-xabarini (attendance_absent) yuboradi.</summary>
    public static async Task<bool> SetEntryAsync(IAppDbContext db, SetJournalEntryRequest req, FcmService? fcm = null)
    {
        // Guruhning StartDate'i tekshirish — undan oldin dars bo'lmaydi.
        var cls = await db.Classes.FindAsync(req.ClassId);
        if (cls is null)
            throw new InvalidOperationException("Guruh topilmadi");
        if (!string.IsNullOrEmpty(cls.StartDate) && string.Compare(req.Date, cls.StartDate) < 0)
            throw new InvalidOperationException("Sana guruh yaratilishidan oldin");

        // Tutkun: kelasi kunlarga baho/davomat kirita olmassin.
        var today = AppClock.Today.ToString("yyyy-MM-dd");
        if (string.Compare(req.Date, today) > 0)
            throw new InvalidOperationException("Kelasi kunlarga o'quvchi ma'lumoti kirita olmassin");

        var entry = await db.JournalEntries.FirstOrDefaultAsync(e =>
            e.ClassId == req.ClassId && e.SubjectId == req.SubjectId && e.Quarter == req.Quarter &&
            e.StudentId == req.StudentId && e.Date == req.Date && e.Period == req.Period);
        // Push uchun — yangi/o'zgargan baho yoki sababnigina xabar qilamiz.
        var oldGrade = entry?.Grade;
        var oldReason = entry?.ReasonId;

        var student = await db.Students.FindAsync(req.StudentId);

        if (entry is null)
        {
            entry = new JournalEntry
            {
                ClassId = req.ClassId,
                SubjectId = req.SubjectId,
                Quarter = req.Quarter,
                StudentId = req.StudentId,
                Date = req.Date,
                Period = req.Period,
            };
            db.JournalEntries.Add(entry);
        }
        entry.Grade = req.Grade;
        entry.ReasonId = req.ReasonId;
        entry.Homework = req.Homework;
        entry.Behavior = req.Behavior;
        entry.Mastery = req.Mastery;

        // Baho/davomat/uyga vazifa/xulq/o'zlashtirish kiritilsa — shu darsni "o'tildi" deb avtomatik belgilaymiz.
        if (req.Grade.HasValue || req.ReasonId is not null || req.Homework != 0 || req.Behavior != 0 || req.Mastery.HasValue)
        {
            var note = await db.LessonNotes.FirstOrDefaultAsync(n =>
                n.ClassId == req.ClassId && n.SubjectId == req.SubjectId &&
                n.Quarter == req.Quarter && n.Date == req.Date && n.Period == req.Period);
            if (note is null)
                db.LessonNotes.Add(new LessonNote
                {
                    ClassId = req.ClassId,
                    SubjectId = req.SubjectId,
                    Quarter = req.Quarter,
                    Date = req.Date,
                    Period = req.Period,
                    Conducted = true,
                });
            else if (!note.Conducted)
                note.Conducted = true;
        }

        await db.SaveChangesAsync();

        // Avtomatik push: farzandi baho olsa yoki davomatda belgilansa, oila ilovasiga xabar.
        await NotifyEntryAsync(db, fcm, req, student, oldGrade, oldReason);

        // Davomat sababi YANGI belgilandimi (kelmadi) — chaqiruvchi avto-xabar yuborishi uchun.
        return req.ReasonId is not null && req.ReasonId != oldReason;
    }

    /// <summary>Baho/davomat yozuvi o'zgarganda oila ilovasiga push yuboradi (fire-and-forget).</summary>
    private static async Task NotifyEntryAsync(
        IAppDbContext db, FcmService? fcm, SetJournalEntryRequest req, Student? student,
        int? oldGrade, string? oldReason)
    {
        if (student?.UserId is null) return;
        var notifyGrade = req.Grade.HasValue && req.Grade != oldGrade;
        var notifyAbsence = !notifyGrade && req.ReasonId is not null && req.ReasonId != oldReason;
        if (!notifyGrade && !notifyAbsence) return;

        var subject = (await db.Subjects.FindAsync(req.SubjectId))?.Name ?? "";
        string title, body, type;
        if (notifyGrade)
        {
            title = "Yangi baho";
            body = $"{student.FullName}: {subject} fanidan {req.Grade} baho ({req.Date})";
            type = "grade";
        }
        else
        {
            var reason = (await db.AbsenceReasons.FindAsync(req.ReasonId!))?.Name ?? "Davomat";
            title = "Davomat";
            body = $"{student.FullName}: {subject} darsida — {reason} ({req.Date})";
            type = "attendance";
        }

        // Tarixga yozamiz — push sozlanmagan yoki token bo'lmasa ham ilovada ko'rinadi.
        NotificationStore.Add(db, student.UserId, title, body, type);
        await db.SaveChangesAsync();

        // Push (FCM sozlangan + token bor bo'lsa) — fire-and-forget, jurnal javobini bloklamaymiz.
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var json = meta?.FcmServiceAccountJson ?? "";
        if (fcm is null || !FcmService.IsConfigured(json)) return;
        var tokens = await db.DeviceTokens.Where(d => d.UserId == student.UserId)
            .Select(d => d.Token).Distinct().ToListAsync();
        if (tokens.Count == 0) return;
        _ = fcm.SendAsync(json, tokens, title, body);
    }

    /// <summary>
    /// Bitta dars (sana+dars raqami) uchun BARCHA berilgan o'quvchiga birdan davomat. <c>ReasonId == null</c> →
    /// "hammasi keldi": mavjud davomat sabablari tozalanadi (baho saqlanadi). <c>ReasonId != null</c> →
    /// "hammasi kelmadi": har bir o'quvchiga shu sabab yoziladi. Ikkala holatda ham dars "o'tildi" (Conducted) bo'ladi.
    /// </summary>
    /// <summary>Qaytaradi: haqiqatan ishlatilgan davomat sababi id'si (Absent=true bo'lganda) — chaqiruvchi
    /// shu bo'yicha "darsga kelmadi" avto-xabarini yuboradi. Absent=false (hammasi keldi) ⇒ null.</summary>
    public static async Task<string?> BulkAttendanceAsync(IAppDbContext db, BulkAttendanceRequest req)
    {
        const int quarter = 1;
        if (req.StudentIds.Count == 0) return null;

        // Guruhning StartDate'i tekshirish — undan oldin dars bo'lmaydi.
        var cls = await db.Classes.FindAsync(req.ClassId);
        if (cls is null)
            throw new InvalidOperationException("Guruh topilmadi");
        if (!string.IsNullOrEmpty(cls.StartDate) && string.Compare(req.Date, cls.StartDate) < 0)
            throw new InvalidOperationException("Sana guruh yaratilishidan oldin");

        // Tutkun: kelasi kunlarga davomat kirita olmassin.
        var today = AppClock.Today.ToString("yyyy-MM-dd");
        if (string.Compare(req.Date, today) > 0)
            throw new InvalidOperationException("Kelasi kunlarga o'quvchi ma'lumoti kirita olmassin");

        // Darsni "o'tildi" deb belgilash (LessonNote).
        var note = await db.LessonNotes.FirstOrDefaultAsync(n =>
            n.ClassId == req.ClassId && n.SubjectId == req.SubjectId &&
            n.Quarter == quarter && n.Date == req.Date && n.Period == req.Period);
        if (note is null)
            db.LessonNotes.Add(new LessonNote
            {
                ClassId = req.ClassId, SubjectId = req.SubjectId, Quarter = quarter,
                Date = req.Date, Period = req.Period, Conducted = true,
            });
        else
            note.Conducted = true;

        // Hammasi KELMADI bo'lsa — sabab: berilgani, yo'q bo'lsa birinchi (kech bo'lmagan) sabab,
        // umuman sabab bo'lmasa standart "Sababsiz" avtomatik yaratiladi (yo'q tugmasi har doim ishlasin).
        string? absentReasonId = null;
        if (req.Absent)
        {
            absentReasonId = req.ReasonId;
            if (string.IsNullOrEmpty(absentReasonId))
            {
                var def = await db.AbsenceReasons.FirstOrDefaultAsync(r => !r.IsLate);
                if (def is null)
                {
                    def = new AbsenceReason { Name = "Sababsiz", Short = "S", IsLate = false, Points = 0 };
                    db.AbsenceReasons.Add(def);
                }
                absentReasonId = def.Id;
            }
        }

        var existing = await db.JournalEntries.Where(e =>
            e.ClassId == req.ClassId && e.SubjectId == req.SubjectId && e.Quarter == quarter &&
            e.Date == req.Date && e.Period == req.Period && req.StudentIds.Contains(e.StudentId)).ToListAsync();
        var byStudent = existing.ToDictionary(e => e.StudentId);

        foreach (var sid in req.StudentIds)
        {
            byStudent.TryGetValue(sid, out var entry);
            if (req.Absent)
            {
                // Hammasi kelmadi — har bir o'quvchiga sabab yoziladi (mavjud baho saqlanadi).
                if (entry is null)
                {
                    entry = new JournalEntry
                    {
                        ClassId = req.ClassId, SubjectId = req.SubjectId, Quarter = quarter,
                        StudentId = sid, Date = req.Date, Period = req.Period,
                    };
                    db.JournalEntries.Add(entry);
                }
                entry.ReasonId = absentReasonId;
            }
            else if (entry is not null)
            {
                // Hammasi keldi — davomat sababi tozalanadi (baho/uy vazifa/xulq tegilmaydi).
                entry.ReasonId = null;
            }
        }

        await db.SaveChangesAsync();
        return req.Absent ? absentReasonId : null;
    }

    public static async Task ClearEntryAsync(
        IAppDbContext db, string classId, string subjectId, int quarter,
        string studentId, string date, int period)
    {
        var entries = db.JournalEntries.Where(e =>
            e.ClassId == classId && e.SubjectId == subjectId && e.Quarter == quarter &&
            e.StudentId == studentId && e.Date == date && e.Period == period);
        db.JournalEntries.RemoveRange(entries);
        await db.SaveChangesAsync();
    }

    public static async Task<List<JournalTopicDto>> GetNotesAsync(
        IAppDbContext db, string classId, string subjectId, int quarter) =>
        await db.LessonNotes
            .Where(n => n.ClassId == classId && n.SubjectId == subjectId && n.Quarter == quarter)
            .Select(n => new JournalTopicDto(n.Date, n.Period, n.Topic, n.Homework, n.Conducted))
            .ToListAsync();

    public static async Task SetNoteAsync(IAppDbContext db, SetLessonNoteRequest req)
    {
        var note = await db.LessonNotes.FirstOrDefaultAsync(n =>
            n.ClassId == req.ClassId && n.SubjectId == req.SubjectId &&
            n.Quarter == req.Quarter && n.Date == req.Date && n.Period == req.Period);

        // Mavzu, uyga vazifa va "dars o'tildi" — uchchovi ham bo'sh bo'lsa yozuvni o'chiramiz.
        var empty = string.IsNullOrWhiteSpace(req.Topic) && string.IsNullOrWhiteSpace(req.Homework) && !req.Conducted;
        if (empty)
        {
            if (note is not null) db.LessonNotes.Remove(note);
        }
        else if (note is null)
        {
            db.LessonNotes.Add(new LessonNote
            {
                ClassId = req.ClassId,
                SubjectId = req.SubjectId,
                Quarter = req.Quarter,
                Date = req.Date,
                Period = req.Period,
                Topic = req.Topic,
                Homework = req.Homework,
                Conducted = req.Conducted,
            });
        }
        else
        {
            note.Topic = req.Topic;
            note.Homework = req.Homework;
            note.Conducted = req.Conducted;
        }
        await db.SaveChangesAsync();
    }

    // ---------- Mavzular Excel shablon / import (mavzu + uy vazifa; darsni "o'tilgan" QILMAYDI) ----------

    public static readonly string[] TopicHeaders =
        { "Dars raqami", "Mavzu", "Uy vazifa" };

    /// <summary>Tanlangan guruh+fan+chorak uchun mavzular shabloni (.xlsx): "Dars raqami" jadval tartibida
    /// (1, 2, 3, ...) oldindan to'ldirilgan — sana va guruh shu raqamdan avtomatik aniqlanadi;
    /// "Mavzu"/"Uy vazifa" ustunlari foydalanuvchi to'ldirishi uchun (mavjudi ham ko'rsatiladi).</summary>
    public static async Task<byte[]> TopicTemplateXlsxAsync(IAppDbContext db, string classId, string subjectId, int quarter)
    {
        var cols = await ComputeColumnsAsync(db, classId, subjectId, quarter);
        var notes = (await db.LessonNotes
                .Where(n => n.ClassId == classId && n.SubjectId == subjectId && n.Quarter == quarter).ToListAsync())
            .GroupBy(n => (n.Date, n.Period)).ToDictionary(g => g.Key, g => g.First());

        // Har bir dars slotiga jadval tartibidagi raqam beriladi (1-asosli); sana shu raqamdan kelib chiqadi.
        var rows = cols.Select((c, i) =>
        {
            notes.TryGetValue((c.Date, c.Period), out var n);
            return (IReadOnlyList<string>)new[]
            {
                (i + 1).ToString(), n?.Topic ?? "", n?.Homework ?? "",
            };
        }).ToList();

        var info = new List<IReadOnlyList<string>>
        {
            new[] { "Dars raqami", "O'zgartirmang — jadval tartibidagi dars raqami (sana va guruh avtomatik aniqlanadi)" },
            new[] { "Mavzu", "Dars mavzusini yozing" },
            new[] { "Uy vazifa", "Uyga vazifani yozing (ixtiyoriy)" },
            new[] { "", "" },
            new[] { "Eslatma:", "Import faqat mavzu/uy vazifani to'ldiradi — darsni \"o'tilgan\" QILMAYDI (buni jurnalda o'zingiz belgilaysiz)." },
        };

        return ExcelExport.Build(new[]
        {
            new ExcelExport.SheetSpec("Mavzular", TopicHeaders, rows),
            new ExcelExport.SheetSpec("Yo'riqnoma", new[] { "Ustun", "Izoh" }, info),
        });
    }

    /// <summary>Excel qatorlaridan mavzu+uy vazifani jurnalga import qiladi. MUHIM: darsni "o'tilgan"
    /// QILMAYDI — yangi yozuvda Conducted=false, mavjud yozuvda Conducted o'zgarmaydi. Faqat "Dars raqami"
    /// (jadval tartibidagi 1-asosli raqam) o'qiladi; mos sana/dars/guruh shu raqamdan avtomatik aniqlanadi.</summary>
    public static async Task<TopicImportResultDto> ImportTopicsAsync(
        IAppDbContext db, string classId, string subjectId, int quarter, List<string[]> rows)
    {
        // Tartiblangan dars ketma-ketligi — "Dars raqami" shu ro'yxatga 1-asosli indeks.
        var cols = await ComputeColumnsAsync(db, classId, subjectId, quarter);
        var notes = (await db.LessonNotes
                .Where(n => n.ClassId == classId && n.SubjectId == subjectId && n.Quarter == quarter).ToListAsync())
            .GroupBy(n => (n.Date, n.Period)).ToDictionary(g => g.Key, g => g.First());

        var errors = new List<TopicImportRowErrorDto>();
        int imported = 0, skipped = 0;
        for (var i = 1; i < rows.Count; i++) // 0-qator = sarlavha
        {
            var r = rows[i];
            var excelRow = i + 1;
            if (r.All(string.IsNullOrWhiteSpace)) { skipped++; continue; }

            var lessonOk = int.TryParse((r.ElementAtOrDefault(0) ?? "").Trim(), out var lessonNo);
            var topic = (r.ElementAtOrDefault(1) ?? "").Trim();
            var homework = (r.ElementAtOrDefault(2) ?? "").Trim();

            if (!lessonOk || lessonNo <= 0)
            { errors.Add(new TopicImportRowErrorDto(excelRow, "Dars raqami noto'g'ri")); continue; }
            if (topic.Length == 0 && homework.Length == 0) { skipped++; continue; }
            if (lessonNo > cols.Count)
            { errors.Add(new TopicImportRowErrorDto(excelRow, $"Dars raqami {lessonNo} jadvalda yo'q (jami {cols.Count} ta dars)")); continue; }

            var slot = cols[lessonNo - 1];
            var key = (slot.Date, slot.Period);

            if (notes.TryGetValue(key, out var n))
            {
                n.Topic = topic;
                n.Homework = homework;
                // Conducted O'ZGARMAYDI — import darsni o'tilgan qilmaydi.
            }
            else
            {
                var fresh = new LessonNote
                {
                    ClassId = classId, SubjectId = subjectId, Quarter = quarter,
                    Date = slot.Date, Period = slot.Period,
                    Topic = topic, Homework = homework, Conducted = false,
                };
                db.LessonNotes.Add(fresh);
                notes[key] = fresh; // bir slot ikki marta kelsa qayta qo'shmaymiz
            }
            imported++;
        }
        if (imported > 0) await db.SaveChangesAsync();
        return new TopicImportResultDto(imported, skipped, errors.Count, errors);
    }
}
