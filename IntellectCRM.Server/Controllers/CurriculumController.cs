using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Kurs sillabusi (Daraja → Mavzu → Band) va o'quvchi per-band progressi.
/// Sillabus kurs (Subject) ga bog'lanadi: <c>CourseLevel</c> → <c>CourseTopic</c> → <c>CourseItem</c>.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("schedule")]
[Route("api/admin/curriculum")]
public class CurriculumController(AppDbContext db) : ControllerBase
{
    // ---- To'liq sillabusni o'qish ----

    [HttpGet("{subjectId}")]
    public async Task<ActionResult<CurriculumDto>> Get(string subjectId)
    {
        var subject = await db.Subjects.FindAsync(subjectId);
        var courseName = subject?.Name ?? "";

        var levels = await db.CourseLevels
            .Where(l => l.SubjectId == subjectId)
            .OrderBy(l => l.Order).ToListAsync();
        var topics = await db.CourseTopics
            .Where(t => t.SubjectId == subjectId)
            .OrderBy(t => t.Order).ToListAsync();
        var items = await db.CourseItems
            .Where(i => i.SubjectId == subjectId)
            .OrderBy(i => i.Order).ToListAsync();

        var levelDtos = levels.Select(l => new CurriculumLevelDto(
            l.Id, l.Name, l.Note, l.Order,
            topics.Where(t => t.LevelId == l.Id).Select(t => new CurriculumTopicDto(
                t.Id, t.Title, t.Note, t.Order,
                items.Where(i => i.TopicId == t.Id).Select(i => new CurriculumItemDto(
                    i.Id, i.Text, i.Note, i.Order)).ToList()
            )).ToList()
        )).ToList();

        return new CurriculumDto(subjectId, courseName, levelDtos);
    }

    // ---- Daraja ----

    [HttpPost("{subjectId}/levels")]
    public async Task<ActionResult> CreateLevel(string subjectId, LevelInput input)
    {
        var maxOrder = await db.CourseLevels
            .Where(l => l.SubjectId == subjectId)
            .Select(l => (int?)l.Order).MaxAsync() ?? -1;
        var level = new CourseLevel
        {
            SubjectId = subjectId,
            Name = input.Name,
            Note = input.Note ?? "",
            Order = maxOrder + 1,
        };
        db.CourseLevels.Add(level);
        await db.SaveChangesAsync();
        return Ok(new { id = level.Id });
    }

    [HttpPut("levels/{id}")]
    public async Task<ActionResult> UpdateLevel(string id, LevelInput input)
    {
        var level = await db.CourseLevels.FindAsync(id);
        if (level == null) return NotFound();
        level.Name = input.Name;
        level.Note = input.Note ?? "";
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("levels/{id}")]
    public async Task<ActionResult> DeleteLevel(string id)
    {
        var level = await db.CourseLevels.FindAsync(id);
        if (level == null) return NotFound();

        var topicIds = await db.CourseTopics
            .Where(t => t.LevelId == id).Select(t => t.Id).ToListAsync();
        var itemIds = await db.CourseItems
            .Where(i => topicIds.Contains(i.TopicId)).Select(i => i.Id).ToListAsync();

        await db.CourseProgresses.Where(p => itemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => itemIds.Contains(i.Id)).ExecuteDeleteAsync();
        await db.CourseTopics.Where(t => t.LevelId == id).ExecuteDeleteAsync();
        db.CourseLevels.Remove(level);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Mavzu ----

    [HttpPost("levels/{levelId}/topics")]
    public async Task<ActionResult> CreateTopic(string levelId, TopicInput input)
    {
        var level = await db.CourseLevels.FindAsync(levelId);
        if (level == null) return NotFound();
        var maxOrder = await db.CourseTopics
            .Where(t => t.LevelId == levelId)
            .Select(t => (int?)t.Order).MaxAsync() ?? -1;
        var topic = new CourseTopic
        {
            SubjectId = level.SubjectId,
            LevelId = levelId,
            Title = input.Title,
            Note = input.Note ?? "",
            Order = maxOrder + 1,
        };
        db.CourseTopics.Add(topic);
        await db.SaveChangesAsync();
        return Ok(new { id = topic.Id });
    }

    [HttpPut("topics/{id}")]
    public async Task<ActionResult> UpdateTopic(string id, TopicInput input)
    {
        var topic = await db.CourseTopics.FindAsync(id);
        if (topic == null) return NotFound();
        topic.Title = input.Title;
        topic.Note = input.Note ?? "";
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("topics/{id}")]
    public async Task<ActionResult> DeleteTopic(string id)
    {
        var topic = await db.CourseTopics.FindAsync(id);
        if (topic == null) return NotFound();

        var itemIds = await db.CourseItems
            .Where(i => i.TopicId == id).Select(i => i.Id).ToListAsync();
        await db.CourseProgresses.Where(p => itemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => i.TopicId == id).ExecuteDeleteAsync();
        db.CourseTopics.Remove(topic);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Band ----

    [HttpPost("topics/{topicId}/items")]
    public async Task<ActionResult> CreateItem(string topicId, ItemInput input)
    {
        var topic = await db.CourseTopics.FindAsync(topicId);
        if (topic == null) return NotFound();
        var maxOrder = await db.CourseItems
            .Where(i => i.TopicId == topicId)
            .Select(i => (int?)i.Order).MaxAsync() ?? -1;
        var item = new CourseItem
        {
            SubjectId = topic.SubjectId,
            TopicId = topicId,
            Text = input.Text,
            Note = input.Note ?? "",
            Order = maxOrder + 1,
        };
        db.CourseItems.Add(item);
        await db.SaveChangesAsync();
        return Ok(new { id = item.Id });
    }

    [HttpPut("items/{id}")]
    public async Task<ActionResult> UpdateItem(string id, ItemInput input)
    {
        var item = await db.CourseItems.FindAsync(id);
        if (item == null) return NotFound();
        item.Text = input.Text;
        item.Note = input.Note ?? "";
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("items/{id}")]
    public async Task<ActionResult> DeleteItem(string id)
    {
        var item = await db.CourseItems.FindAsync(id);
        if (item == null) return NotFound();
        await db.CourseProgresses.Where(p => p.ItemId == id).ExecuteDeleteAsync();
        db.CourseItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Import (butun sillabusni almashtirish) ----

    [HttpPost("{subjectId}/import")]
    public async Task<ActionResult> Import(string subjectId, CurriculumImportDto payload)
    {
        // Eski sillabusni (va unga tegishli progressni) tozalash.
        var oldItemIds = await db.CourseItems
            .Where(i => i.SubjectId == subjectId).Select(i => i.Id).ToListAsync();
        await db.CourseProgresses.Where(p => oldItemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => i.SubjectId == subjectId).ExecuteDeleteAsync();
        await db.CourseTopics.Where(t => t.SubjectId == subjectId).ExecuteDeleteAsync();
        await db.CourseLevels.Where(l => l.SubjectId == subjectId).ExecuteDeleteAsync();

        int levelCount = 0, topicCount = 0, itemCount = 0;
        var levels = payload.Levels ?? new List<ImportLevelDto>();
        for (int li = 0; li < levels.Count; li++)
        {
            var lvl = levels[li];
            var level = new CourseLevel
            {
                SubjectId = subjectId,
                Name = lvl.Name,
                Note = lvl.Note ?? "",
                Order = li,
            };
            db.CourseLevels.Add(level);
            levelCount++;

            var topics = lvl.Topics ?? new List<ImportTopicDto>();
            for (int ti = 0; ti < topics.Count; ti++)
            {
                var tp = topics[ti];
                var topic = new CourseTopic
                {
                    SubjectId = subjectId,
                    LevelId = level.Id,
                    Title = tp.Title,
                    Note = tp.Note ?? "",
                    Order = ti,
                };
                db.CourseTopics.Add(topic);
                topicCount++;

                var items = tp.Items ?? new List<ImportItemDto>();
                for (int ii = 0; ii < items.Count; ii++)
                {
                    var it = items[ii];
                    db.CourseItems.Add(new CourseItem
                    {
                        SubjectId = subjectId,
                        TopicId = topic.Id,
                        Text = it.Text,
                        Note = it.Note ?? "",
                        Order = ii,
                    });
                    itemCount++;
                }
            }
        }

        await db.SaveChangesAsync();
        return Ok(new { levels = levelCount, topics = topicCount, items = itemCount });
    }

    // ---- Progress ----

    [HttpGet("{subjectId}/progress/{studentId}")]
    public async Task<ActionResult<string[]>> GetProgress(string subjectId, string studentId)
    {
        var ids = await db.CourseProgresses
            .Where(p => p.StudentId == studentId && p.Done)
            .Join(db.CourseItems.Where(i => i.SubjectId == subjectId),
                p => p.ItemId, i => i.Id, (p, i) => p.ItemId)
            .ToListAsync();
        return ids.ToArray();
    }

    [HttpPost("progress")]
    public async Task<ActionResult> SetProgress(SetProgressRequest req)
    {
        var existing = await db.CourseProgresses
            .FirstOrDefaultAsync(p => p.StudentId == req.StudentId && p.ItemId == req.ItemId);
        var now = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss");
        if (existing != null)
        {
            existing.Done = req.Done;
            existing.UpdatedAt = now;
        }
        else
        {
            db.CourseProgresses.Add(new CourseProgress
            {
                StudentId = req.StudentId,
                ItemId = req.ItemId,
                Done = req.Done,
                UpdatedAt = now,
            });
        }
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ---- Guruh sillabus o'tilishi + tugash prognozi ----

    [HttpGet("group/{groupId}")]
    public async Task<ActionResult<GroupCurriculumDto>> GetGroupCurriculum(string groupId)
    {
        var group = await db.Classes.FindAsync(groupId);
        if (group == null) return NotFound();

        var courseId = group.CourseId;
        var subject = await db.Subjects.FindAsync(courseId);
        var courseName = subject?.Name ?? "";

        var levels = await db.CourseLevels
            .Where(l => l.SubjectId == courseId)
            .OrderBy(l => l.Order).ToListAsync();
        var topics = await db.CourseTopics
            .Where(t => t.SubjectId == courseId)
            .OrderBy(t => t.Order).ToListAsync();
        var items = await db.CourseItems
            .Where(i => i.SubjectId == courseId)
            .OrderBy(i => i.Order).ToListAsync();

        var existingItemIds = items.Select(i => i.Id).ToHashSet();

        var logs = await db.GroupCurriculumLogs
            .Where(g => g.GroupId == groupId).ToListAsync();

        var coveredItemIds = logs
            .Where(l => !l.IsRevision && l.ItemId != "" && existingItemIds.Contains(l.ItemId))
            .Select(l => l.ItemId).Distinct().ToHashSet();

        // Har band uchun eng erta o'tilgan sana (bir nechta yozuv bo'lsa Date, so'ng CreatedAt bo'yicha).
        var coverDateByItem = logs
            .Where(l => !l.IsRevision && l.ItemId != "")
            .GroupBy(l => l.ItemId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(l => l.Date).ThenBy(l => l.CreatedAt).First().Date);

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
            groupId, courseId, courseName,
            totalItems, coveredCount, revisionLessons, totalLessons,
            remainingItems, estLessonsLeft, lessonsPerWeek, estFinishDate,
            levelDtos);
    }

    [HttpPost("group/{groupId}/cover")]
    public async Task<ActionResult> CoverItem(string groupId, CoverRequest req)
    {
        if (req.Covered)
        {
            var exists = await db.GroupCurriculumLogs
                .AnyAsync(g => g.GroupId == groupId && g.ItemId == req.ItemId && !g.IsRevision);
            if (!exists)
            {
                db.GroupCurriculumLogs.Add(new GroupCurriculumLog
                {
                    GroupId = groupId,
                    ItemId = req.ItemId,
                    IsRevision = false,
                    Date = AppClock.Today.ToString("yyyy-MM-dd"),
                    CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
                });
            }
        }
        else
        {
            await db.GroupCurriculumLogs
                .Where(g => g.GroupId == groupId && g.ItemId == req.ItemId && !g.IsRevision)
                .ExecuteDeleteAsync();
        }
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("group/{groupId}/revision")]
    public async Task<ActionResult> Revision(string groupId, RevisionRequest req)
    {
        if (req.Delta > 0)
        {
            db.GroupCurriculumLogs.Add(new GroupCurriculumLog
            {
                GroupId = groupId,
                ItemId = "",
                IsRevision = true,
                Date = AppClock.Today.ToString("yyyy-MM-dd"),
                CreatedAt = AppClock.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
            });
        }
        else if (req.Delta < 0)
        {
            var last = await db.GroupCurriculumLogs
                .Where(g => g.GroupId == groupId && g.IsRevision)
                .OrderByDescending(g => g.CreatedAt)
                .FirstOrDefaultAsync();
            if (last != null) db.GroupCurriculumLogs.Remove(last);
        }
        await db.SaveChangesAsync();

        var revisionLessons = await db.GroupCurriculumLogs
            .CountAsync(g => g.GroupId == groupId && g.IsRevision);
        return Ok(new { ok = true, revisionLessons });
    }

    // ---- O'quvchining o'tilgan sillabus vaqt jadvali (per-student coverage timeline) ----

    [HttpGet("student/{studentId}/coverage-log")]
    public async Task<ActionResult<List<CoverageLogEntryDto>>> GetStudentCoverageLog(string studentId)
    {
        // O'quvchining FAOL guruh a'zoliklari.
        var groupIds = await db.StudentGroups
            .Where(sg => sg.StudentId == studentId && sg.IsActive)
            .Select(sg => sg.GroupId)
            .Distinct()
            .ToListAsync();
        if (groupIds.Count == 0) return new List<CoverageLogEntryDto>();

        var groups = await db.Classes
            .Where(g => groupIds.Contains(g.Id))
            .ToListAsync();

        var courseIds = groups.Select(g => g.CourseId).Where(c => c != "").Distinct().ToList();

        var subjects = await db.Subjects
            .Where(s => courseIds.Contains(s.Id))
            .ToListAsync();
        var courseNameById = subjects.ToDictionary(s => s.Id, s => s.Name);

        // Tegishli kurslarning band/mavzu/daraja lug'atlari (per-log so'rovsiz).
        var items = await db.CourseItems
            .Where(i => courseIds.Contains(i.SubjectId))
            .ToListAsync();
        var topics = await db.CourseTopics
            .Where(t => courseIds.Contains(t.SubjectId))
            .ToListAsync();
        var levels = await db.CourseLevels
            .Where(l => courseIds.Contains(l.SubjectId))
            .ToListAsync();

        var itemById = items.ToDictionary(i => i.Id);
        var topicById = topics.ToDictionary(t => t.Id);
        var levelById = levels.ToDictionary(l => l.Id);

        var logs = await db.GroupCurriculumLogs
            .Where(g => groupIds.Contains(g.GroupId))
            .ToListAsync();

        var entries = new List<(string Date, string CreatedAt, CoverageLogEntryDto Dto)>();

        foreach (var log in logs)
        {
            var group = groups.FirstOrDefault(g => g.Id == log.GroupId);
            if (group == null) continue;
            var groupName = group.Name;
            var courseName = courseNameById.TryGetValue(group.CourseId, out var cn) ? cn : "";

            if (log.IsRevision)
            {
                entries.Add((log.Date, log.CreatedAt, new CoverageLogEntryDto(
                    log.Date, courseName, groupName, "", "", "Takrorlash darsi", true)));
            }
            else
            {
                if (!itemById.TryGetValue(log.ItemId, out var item)) continue; // band o'chirilgan
                var topicTitle = topicById.TryGetValue(item.TopicId, out var topic) ? topic.Title : "";
                var levelName = topicById.TryGetValue(item.TopicId, out var tp)
                    && levelById.TryGetValue(tp.LevelId, out var level) ? level.Name : "";
                entries.Add((log.Date, log.CreatedAt, new CoverageLogEntryDto(
                    log.Date, courseName, groupName, levelName, topicTitle, item.Text, false)));
            }
        }

        return entries
            .OrderByDescending(e => e.Date)
            .ThenByDescending(e => e.CreatedAt)
            .Select(e => e.Dto)
            .ToList();
    }
}
