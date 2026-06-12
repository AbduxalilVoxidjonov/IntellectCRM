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
}
