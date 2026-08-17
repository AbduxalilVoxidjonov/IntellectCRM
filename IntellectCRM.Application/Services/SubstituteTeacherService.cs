using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'rinbosar o'qituvchilarni boshqarish xizmati.
/// </summary>
public static class SubstituteTeacherService
{
    /// <summary>
    /// O'rinbosar o'qituvchi tayinlovlari ro'yxatini olish.
    /// </summary>
    public static async Task<List<SubstituteTeacherAssignmentDto>> GetAssignmentsAsync(
        IAppDbContext db,
        string? groupId = null,
        string? teacherId = null,
        string? date = null,
        bool? isActive = null,
        CancellationToken ct = default)
    {
        var query = db.SubstituteTeacherAssignments.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(groupId))
            query = query.Where(a => a.GroupId == groupId);

        if (!string.IsNullOrWhiteSpace(teacherId))
            query = query.Where(a => a.SubstituteTeacherId == teacherId || a.OriginalTeacherId == teacherId);

        if (!string.IsNullOrWhiteSpace(date))
        {
            query = query.Where(a =>
                (a.EndDate == null && a.Date == date) ||
                (a.EndDate != null && string.Compare(a.Date, date) <= 0 && string.Compare(a.EndDate, date) >= 0));
        }

        if (isActive.HasValue)
            query = query.Where(a => a.IsActive == isActive.Value);

        var list = await query.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        if (list.Count == 0) return new();

        var groupIds = list.Select(a => a.GroupId).Distinct().ToList();
        var teacherIds = list.SelectMany(a => new[] { a.OriginalTeacherId, a.SubstituteTeacherId }).Distinct().ToList();

        var groups = await db.Classes.AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, g => g, ct);

        var teachers = await db.Teachers.AsNoTracking()
            .Where(t => teacherIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t, ct);

        var meta = await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync(ct);

        var studentCounts = await db.StudentGroups.AsNoTracking()
            .Where(sg => groupIds.Contains(sg.GroupId) && sg.IsActive)
            .GroupBy(sg => sg.GroupId)
            .ToDictionaryAsync(g => g.Key, g => g.Count(), ct);

        var resultList = new List<SubstituteTeacherAssignmentDto>();
        foreach (var a in list)
        {
            var g = groups.GetValueOrDefault(a.GroupId);
            var subTeacher = teachers.GetValueOrDefault(a.SubstituteTeacherId);
            var origTeacher = teachers.GetValueOrDefault(a.OriginalTeacherId);

            int lessonCount = a.SelectedDates != null && a.SelectedDates.Count > 0
                ? a.SelectedDates.Count
                : CalculateScheduledLessons(g, a.Date, a.EndDate);

            int studentCount = g != null ? studentCounts.GetValueOrDefault(g.Id, 10) : 10;
            if (studentCount == 0) studentCount = 10;

            string safeDate = a.Date ?? "";
            string month = safeDate.Length >= 7 ? safeDate[..7] : AppClock.Today.ToString("yyyy-MM");
            decimal singleRate = CalculateSingleLessonRate(g, subTeacher, meta, studentCount, month);
            decimal estimatedSalary = Math.Round(singleRate * lessonCount, 2);

            resultList.Add(new SubstituteTeacherAssignmentDto(
                Id: a.Id,
                GroupId: a.GroupId,
                GroupName: g?.Name ?? "Noma'lum guruh",
                OriginalTeacherId: a.OriginalTeacherId,
                OriginalTeacherName: origTeacher?.FullName ?? "Noma'lum o'qituvchi",
                SubstituteTeacherId: a.SubstituteTeacherId,
                SubstituteTeacherName: subTeacher?.FullName ?? "Noma'lum o'qituvchi",
                Date: a.Date,
                EndDate: a.EndDate,
                Reason: a.Reason,
                CreatedBy: a.CreatedBy,
                CreatedAt: a.CreatedAt,
                IsActive: a.IsActive,
                LessonCount: lessonCount,
                EstimatedSalary: estimatedSalary,
                Dates: a.SelectedDates,
                PerLessonFee: singleRate
            ));
        }

        return resultList;
    }

    /// <summary>
    /// Guruhning ko'rsatilgan oydagi rejalashtirilgan dars sanalarini olish (modal uchun).
    /// </summary>
    public static async Task<List<GroupLessonDateDto>> GetGroupLessonDatesAsync(
        IAppDbContext db, string groupId, string month, CancellationToken ct = default)
    {
        var group = await db.Classes.FindAsync(new object[] { groupId }, ct);
        if (group is null || group.Days is null || group.Days.Count == 0) return new();

        if (string.IsNullOrWhiteSpace(month) || month.Length < 7)
            month = AppClock.Today.ToString("yyyy-MM");

        var moves = await db.LessonReschedules.AsNoTracking().Where(r => r.ClassId == groupId).ToListAsync(ct);
        var moveRecords = moves.Select(m => new JournalService.LessonMove(m.FromDate, m.ToDate)).ToList();

        var effectiveDates = JournalService.EffectiveLessonDatesInMonth(group.Days, month[..7], moveRecords).ToHashSet();

        if (!int.TryParse(month[..4], out var year) || !int.TryParse(month[5..7], out var mNum))
            return new();

        var daysInMonth = DateTime.DaysInMonth(year, mNum);
        var result = new List<GroupLessonDateDto>();

        string[] weekDayNames = { "Yak", "Dush", "Sesh", "Chorsh", "Paysh", "Juma", "Shanba" };

        for (int d = 1; d <= daysInMonth; d++)
        {
            var dateOnly = new DateOnly(year, mNum, d);
            var dateStr = dateOnly.ToString("yyyy-MM-dd");
            if (effectiveDates.Contains(dateStr))
            {
                var dayName = weekDayNames[(int)dateOnly.DayOfWeek];
                result.Add(new GroupLessonDateDto(dateStr, $"{d}-{month[5..7]} ({dayName})", true));
            }
        }

        return result;
    }

    /// <summary>
    /// Sana oralig'ida guruhning dars kunlariga (Group.Days) mos keladigan darslar sonini hisoblash.
    /// </summary>
    public static int CalculateScheduledLessons(Group? group, string startDateStr, string? endDateStr)
    {
        if (!DateOnly.TryParse(startDateStr, out var start))
            return 1;

        var end = start;
        if (!string.IsNullOrEmpty(endDateStr) && DateOnly.TryParse(endDateStr, out var parsedEnd) && parsedEnd >= start)
        {
            end = parsedEnd;
        }

        if (group is null || group.Days is null || group.Days.Count == 0)
        {
            return (int)(end.DayNumber - start.DayNumber) + 1;
        }

        var scheduledDaysSet = group.Days.ToHashSet();
        int count = 0;
        for (var current = start; current <= end; current = current.AddDays(1))
        {
            var dayIndex = ((int)current.DayOfWeek + 6) % 7;
            if (scheduledDaysSet.Contains(dayIndex))
            {
                count++;
            }
        }

        return count > 0 ? count : 1;
    }

    /// <summary>
    /// Bitta dars uchun o'rinbosarlik stavkasi/narxi (guruhning umumiy tushumi va oydagi darslar soni bo'yicha).
    /// </summary>
    public static decimal CalculateSingleLessonRate(Group? group, Teacher? subTeacher, CenterMeta? meta, int studentCount = 10, string? month = null)
    {
        if (group is null) return 0m;

        if (string.IsNullOrWhiteSpace(month) || month.Length < 7)
            month = AppClock.Today.ToString("yyyy-MM");

        int scheduledLessons = CalculateScheduledLessons(group, $"{month[..7]}-01", $"{month[..7]}-28");
        if (scheduledLessons <= 0) scheduledLessons = 12;

        decimal groupSalaryPool = 0m;

        if (group.TeacherSalaryMode == "fixed" && group.TeacherSalaryFixed > 0)
        {
            groupSalaryPool = group.TeacherSalaryFixed;
        }
        else
        {
            decimal totalTuition = (group.MonthlyFee > 0 ? group.MonthlyFee : 0m) * (studentCount > 0 ? studentCount : 10);
            decimal pct = group.TeacherSalaryMode == "percent" && group.TeacherSalaryPercent > 0
                ? group.TeacherSalaryPercent
                : (subTeacher != null && subTeacher.SalaryPercent > 0 ? subTeacher.SalaryPercent : 50m);

            groupSalaryPool = Math.Round(totalTuition * (pct / 100m), 2);
        }

        return Math.Round(groupSalaryPool / scheduledLessons, 2);
    }

    /// <summary>
    /// ID bo'yicha tayinlovni olish.
    /// </summary>
    public static async Task<SubstituteTeacherAssignmentDto?> GetByIdAsync(
        IAppDbContext db, string id, CancellationToken ct = default)
    {
        var item = await db.SubstituteTeacherAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);
        if (item is null) return null;

        var list = await GetAssignmentsAsync(db, groupId: item.GroupId, teacherId: null, date: null, isActive: null, ct: ct);
        return list.FirstOrDefault(a => a.Id == id);
    }

    /// <summary>
    /// Yangi o'rinbosar o'qituvchi tayinlovini yaratish.
    /// </summary>
    public static async Task<(bool Ok, string Message, SubstituteTeacherAssignment? Assignment)> CreateAssignmentAsync(
        IAppDbContext db,
        CreateSubstituteAssignmentRequest req,
        string actorName,
        string? actorUserId = null,
        CancellationToken ct = default)
    {
        var group = await db.Classes.FindAsync(new object[] { req.GroupId }, ct);
        if (group is null)
            return (false, "Guruh topilmadi", null);

        if (string.IsNullOrWhiteSpace(group.TeacherId))
            return (false, "Guruhda biriktirilgan asosiy o'qituvchi yo'q", null);

        var subTeacher = await db.Teachers.FindAsync(new object[] { req.SubstituteTeacherId }, ct);
        if (subTeacher is null)
            return (false, "O'rinbosar o'qituvchi topilmadi", null);

        if (group.TeacherId == req.SubstituteTeacherId)
            return (false, "Asosiy o'qituvchi o'ziga o'rinbosar qilib tayinlanishi mumkin emas", null);

        var selectedDates = (req.Dates ?? new List<string>())
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .Select(d => d.Trim())
            .OrderBy(d => d)
            .Distinct()
            .ToList();

        string startDate = "";
        string? endDate = null;

        if (selectedDates.Count > 0)
        {
            startDate = selectedDates.First();
            endDate = selectedDates.Count > 1 ? selectedDates.Last() : selectedDates.First();
        }
        else if (!string.IsNullOrWhiteSpace(req.Date))
        {
            startDate = req.Date.Trim();
            endDate = string.IsNullOrWhiteSpace(req.EndDate) ? null : req.EndDate.Trim();
            selectedDates.Add(startDate);
            if (!string.IsNullOrEmpty(endDate) && endDate != startDate) selectedDates.Add(endDate);
        }
        else
        {
            return (false, "Kamida bitta dars sanasi tanlanishi kerak", null);
        }

        var entity = new SubstituteTeacherAssignment
        {
            GroupId = req.GroupId,
            OriginalTeacherId = group.TeacherId,
            SubstituteTeacherId = req.SubstituteTeacherId,
            Date = startDate,
            EndDate = endDate,
            Reason = (req.Reason ?? "").Trim(),
            CreatedBy = actorName,
            CreatedById = actorUserId,
            CreatedAt = AppClock.Now,
            IsActive = true,
            SelectedDates = selectedDates
        };

        db.SubstituteTeacherAssignments.Add(entity);
        await db.SaveChangesAsync(ct);

        return (true, "O'rinbosar o'qituvchi muvaffaqiyatli biriktirildi", entity);
    }

    /// <summary>
    /// Tayinlovni bekor qilish (IsActive = false).
    /// </summary>
    public static async Task<(bool Ok, string Message)> CancelAssignmentAsync(
        IAppDbContext db, string id, CancellationToken ct = default)
    {
        var item = await db.SubstituteTeacherAssignments.FindAsync(new object[] { id }, ct);
        if (item is null)
            return (false, "Tayinlov topilmadi");

        if (!item.IsActive)
            return (false, "Tayinlov allaqachon bekor qilingan");

        item.IsActive = false;
        await db.SaveChangesAsync(ct);

        return (true, "O'rinbosar o'qituvchi tayinlovi bekor qilindi");
    }

    /// <summary>
    /// O'qituvchi muayyan sanada guruh uchun faol o'rinbosar ekanligini tekshirish.
    /// </summary>
    public static async Task<bool> IsSubstituteForGroupAsync(
        IAppDbContext db, string teacherId, string groupId, string? date = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(teacherId) || string.IsNullOrWhiteSpace(groupId))
            return false;

        var checkDate = date ?? AppClock.Today.ToString("yyyy-MM-dd");

        return await db.SubstituteTeacherAssignments.AsNoTracking().AnyAsync(a =>
            a.GroupId == groupId &&
            a.SubstituteTeacherId == teacherId &&
            a.IsActive &&
            ((a.EndDate == null && a.Date == checkDate) ||
             (a.EndDate != null && string.Compare(a.Date, checkDate) <= 0 && string.Compare(a.EndDate, checkDate) >= 0)),
            ct);
    }
}
