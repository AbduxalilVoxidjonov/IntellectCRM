using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Guruh sillabus (o'quv dasturi) o'tilishi + tugash prognozi. Admin, o'qituvchi va o'quvchi
/// portallari shu yagona mantiqdan foydalanadi (uch joyda farq qilmasligi uchun).
///
/// "O'tilgan" = <see cref="GroupCurriculumLog"/> (revision bo'lmagan, mavjud band) yozuvlari.
/// "Tugash prognozi" = pace (o'tilgan / jami dars) bo'yicha qolgan bandlar uchun kerakli darslar,
/// guruh dars kunlari (Days) bo'yicha oldinga yurib sana hisoblanadi.
/// </summary>
public static class CurriculumForecast
{
    public static async Task<GroupCurriculumDto> BuildGroupAsync(IAppDbContext db, Group group)
    {
        var courseId = group.CourseId;
        var subject = await db.Subjects.FindAsync(courseId);
        var courseName = subject?.Name ?? "";

        var levels = await db.CourseLevels
            .Where(l => l.SubjectId == courseId).OrderBy(l => l.Order).ToListAsync();
        var topics = await db.CourseTopics
            .Where(t => t.SubjectId == courseId).OrderBy(t => t.Order).ToListAsync();
        var items = await db.CourseItems
            .Where(i => i.SubjectId == courseId).OrderBy(i => i.Order).ToListAsync();
        var existingItemIds = items.Select(i => i.Id).ToHashSet();

        var logs = await db.GroupCurriculumLogs.Where(g => g.GroupId == group.Id).ToListAsync();

        var coveredItemIds = logs
            .Where(l => !l.IsRevision && l.ItemId != "" && existingItemIds.Contains(l.ItemId))
            .Select(l => l.ItemId).Distinct().ToHashSet();

        var coverDateByItem = logs
            .Where(l => !l.IsRevision && l.ItemId != "")
            .GroupBy(l => l.ItemId)
            .ToDictionary(g => g.Key, g => g.OrderBy(l => l.Date).ThenBy(l => l.CreatedAt).First().Date);

        var totalItems = items.Count;
        var coveredCount = coveredItemIds.Count;
        var revisionLessons = logs.Count(l => l.IsRevision);
        var totalLessons = coveredCount + revisionLessons;
        var remainingItems = Math.Max(0, totalItems - coveredCount);

        var pace = totalLessons > 0 ? (double)coveredCount / totalLessons : 1.0;
        pace = Math.Max(pace, 0.1);
        var estLessonsLeft = remainingItems == 0 ? 0 : (int)Math.Ceiling(remainingItems / pace);

        var days = group.Days ?? new List<int>();
        var lessonsPerWeek = days.Count > 0 ? days.Count : 3;

        var estFinishDate = "";
        if (estLessonsLeft > 0)
        {
            if (days.Count > 0)
            {
                var daySet = days.ToHashSet();
                var date = AppClock.Today;
                var counted = 0;
                var guard = 0;
                while (counted < estLessonsLeft && guard < 3000)
                {
                    date = date.AddDays(1);
                    var weekday = ((int)date.DayOfWeek + 6) % 7; // Monday=0..Sunday=6
                    if (daySet.Contains(weekday)) counted++;
                    guard++;
                }
                estFinishDate = date.ToString("yyyy-MM-dd");
            }
            else
            {
                estFinishDate = AppClock.Today.AddDays(estLessonsLeft * 7 / 3).ToString("yyyy-MM-dd");
            }
        }

        var levelDtos = levels.Select(l => new GroupCurriculumLevelDto(
            l.Id, l.Name, l.Note, l.Order,
            topics.Where(t => t.LevelId == l.Id).Select(t => new GroupCurriculumTopicDto(
                t.Id, t.Title, t.Note, t.Order,
                items.Where(i => i.TopicId == t.Id).Select(i => new GroupCurriculumItemDto(
                    i.Id, i.Text, i.Note, i.Order, coveredItemIds.Contains(i.Id),
                    coveredItemIds.Contains(i.Id) && coverDateByItem.TryGetValue(i.Id, out var cd) ? cd : "")).ToList()
            )).ToList()
        )).ToList();

        return new GroupCurriculumDto(
            group.Id, courseId, courseName,
            totalItems, coveredCount, revisionLessons, totalLessons,
            remainingItems, estLessonsLeft, lessonsPerWeek, estFinishDate,
            levelDtos);
    }
}
