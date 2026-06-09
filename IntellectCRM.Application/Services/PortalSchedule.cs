using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// O'qituvchi/o'quvchi ilovalari uchun dars jadvali yordamchilari.
/// Joriy chorak/haftani sanadan aniqlash va sinfning haftaga biriktirilgan jadvalini olish.
/// </summary>
public static class PortalSchedule
{
    /// <summary>Joriy chorak va hafta raqami. Chorak davri tizimi olib tashlangani uchun
    /// har doim (1, 1) qaytadi.</summary>
    public static Task<(int Quarter, int Week)> CurrentQuarterWeekAsync(IAppDbContext db) =>
        Task.FromResult((1, 1));

    /// <summary>Sinfning (chorak, hafta) ga biriktirilgan jadval darslari. Biriktirilmagan bo'lsa — bo'sh.</summary>
    public static async Task<List<ScheduleLesson>> LessonsForWeekAsync(
        IAppDbContext db, string classId, int quarter, int week)
    {
        var a = await db.WeekAssignments.FirstOrDefaultAsync(
            x => x.ClassId == classId && x.Quarter == quarter && x.Week == week);
        if (a?.TemplateId is null) return new();
        var tpl = await db.ScheduleTemplates.Include(t => t.Lessons)
            .FirstOrDefaultAsync(t => t.Id == a.TemplateId);
        return tpl?.Lessons.ToList() ?? new();
    }

    /// <summary>Portal umumiy konteksti: dars vaqtlari, davomat sabablari + joriy chorak/hafta.
    /// O'qituvchi va o'quvchi ilovalarining ikkalasi ham shu meta'dan foydalanadi.</summary>
    public static async Task<PortalMetaDto> BuildMetaAsync(IAppDbContext db)
    {
        var lessonTimes = await db.LessonTimes.OrderBy(t => t.Period)
            .Select(t => new LessonTimeDto(t.Period, t.StartTime, t.EndTime)).ToListAsync();
        var reasons = await db.AbsenceReasons
            .Select(r => new AbsenceReasonDto(r.Id, r.Name, r.Short, r.IsLate)).ToListAsync();
        var (curQ, curW) = await CurrentQuarterWeekAsync(db);
        var quarters = await TuitionService.SyntheticPeriodsAsync(db);
        return new PortalMetaDto(lessonTimes, reasons, quarters, curQ, curW);
    }
}
