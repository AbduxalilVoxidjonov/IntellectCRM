using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using System.Text.Json;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Kurs sillabusi (Bo'lim → Mavzu → Sub-mavzu → Band) va o'quvchi per-band progressi.
/// Sillabus kurs (Subject) ga bog'lanadi: <c>CourseLevel</c> → <c>CourseTopic</c> →
/// <c>CourseSubTopic</c> (BITTA turga qulflangan) → <c>CourseItem</c>.
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
        var subTopics = await db.CourseSubTopics
            .Where(s => s.SubjectId == subjectId)
            .OrderBy(s => s.Order).ToListAsync();
        var items = await db.CourseItems
            .Where(i => i.SubjectId == subjectId)
            .OrderBy(i => i.Order).ToListAsync();

        // Test darslarining savol sonini olamiz (meta + tayyorlik uchun).
        var itemIds = items.Select(i => i.Id).ToList();
        var qCounts = (await db.CourseQuestions.Where(q => itemIds.Contains(q.ItemId))
                .Select(q => q.ItemId).ToListAsync())
            .GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());

        var levelDtos = levels.Select(l => new CurriculumLevelDto(
            l.Id, l.Name, l.Note, l.Order,
            topics.Where(t => t.LevelId == l.Id).Select(t => new CurriculumTopicDto(
                t.Id, t.Title, t.Note, t.Order,
                subTopics.Where(s => s.TopicId == t.Id).Select(s => new CurriculumSubTopicDto(
                    s.Id, s.Title, s.Note, s.Order, s.Type,
                    items.Where(i => i.SubTopicId == s.Id).Select(i => ToItemDto(i, qCounts)).ToList()
                )).ToList()
            )).ToList()
        )).ToList();

        return new CurriculumDto(subjectId, courseName, levelDtos);
    }

    /// <summary>Dars (CourseItem) → daraxt DTO: tur (ota sub-mavzudan meros), meta (test savoli/
    /// lug'at so'zi soni), tayyorlik (o'z turiga mos maydon to'ldirilganmi).</summary>
    private static CurriculumItemDto ToItemDto(CourseItem i, IReadOnlyDictionary<string, int> qCounts)
    {
        var qc = qCounts.GetValueOrDefault(i.Id, 0);
        var vocabCount = ParseVocab(i.VocabJson).Count;
        var sections = new List<string>();
        if (!string.IsNullOrWhiteSpace(i.VideoUrl)) sections.Add("Video");
        if (!string.IsNullOrWhiteSpace(i.TextContent)) sections.Add("Matn");
        if (!string.IsNullOrWhiteSpace(i.AudioUrl)) sections.Add("Audio");
        if (!string.IsNullOrWhiteSpace(i.PdfUrl)) sections.Add("PDF");
        if (vocabCount > 0) sections.Add("Lug'at");
        if (qc > 0) sections.Add("Test");
        var meta = !string.IsNullOrWhiteSpace(i.Meta) ? i.Meta : string.Join(" · ", sections);
        var ready = sections.Count > 0;
        return new CurriculumItemDto(i.Id, i.Text, i.Note, i.Order, i.Type, meta, ready);
    }

    private static readonly string[] AllowedTypes = { "text", "video", "audio", "vocab", "test", "pdf" };
    private static string NormalizeType(string? t) => t is not null && AllowedTypes.Contains(t) ? t : "text";
    private static List<VocabEntryDto> ParseVocab(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try { return JsonSerializer.Deserialize<List<VocabEntryDto>>(json) ?? new(); }
        catch { return new(); }
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
        var subTopicIds = await db.CourseSubTopics
            .Where(s => topicIds.Contains(s.TopicId)).Select(s => s.Id).ToListAsync();
        var itemIds = await db.CourseItems
            .Where(i => subTopicIds.Contains(i.SubTopicId)).Select(i => i.Id).ToListAsync();

        await db.CourseProgresses.Where(p => itemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseQuestions.Where(q => itemIds.Contains(q.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => itemIds.Contains(i.Id)).ExecuteDeleteAsync();
        await db.CourseSubTopics.Where(s => subTopicIds.Contains(s.Id)).ExecuteDeleteAsync();
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

        var subTopicIds = await db.CourseSubTopics
            .Where(s => s.TopicId == id).Select(s => s.Id).ToListAsync();
        var itemIds = await db.CourseItems
            .Where(i => subTopicIds.Contains(i.SubTopicId)).Select(i => i.Id).ToListAsync();
        await db.CourseProgresses.Where(p => itemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseQuestions.Where(q => itemIds.Contains(q.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => itemIds.Contains(i.Id)).ExecuteDeleteAsync();
        await db.CourseSubTopics.Where(s => s.TopicId == id).ExecuteDeleteAsync();
        db.CourseTopics.Remove(topic);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Sub-mavzu (BITTA turga qulflanadi — yaratishda tanlanadi) ----

    [HttpPost("topics/{topicId}/subtopics")]
    public async Task<ActionResult> CreateSubTopic(string topicId, SubTopicInput input)
    {
        var topic = await db.CourseTopics.FindAsync(topicId);
        if (topic == null) return NotFound();
        var maxOrder = await db.CourseSubTopics
            .Where(s => s.TopicId == topicId)
            .Select(s => (int?)s.Order).MaxAsync() ?? -1;
        var subTopic = new CourseSubTopic
        {
            SubjectId = topic.SubjectId,
            TopicId = topicId,
            Title = input.Title,
            Note = input.Note ?? "",
            Order = maxOrder + 1,
            Type = NormalizeType(input.Type),
        };
        db.CourseSubTopics.Add(subTopic);
        await db.SaveChangesAsync();
        return Ok(new { id = subTopic.Id });
    }

    /// <summary>Sub-mavzu nomi/izohini yangilaydi — turi (Type) O'ZGARTIRILMAYDI (qulflangan).</summary>
    [HttpPut("subtopics/{id}")]
    public async Task<ActionResult> UpdateSubTopic(string id, TopicInput input)
    {
        var subTopic = await db.CourseSubTopics.FindAsync(id);
        if (subTopic == null) return NotFound();
        subTopic.Title = input.Title;
        subTopic.Note = input.Note ?? "";
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("subtopics/{id}")]
    public async Task<ActionResult> DeleteSubTopic(string id)
    {
        var subTopic = await db.CourseSubTopics.FindAsync(id);
        if (subTopic == null) return NotFound();
        var itemIds = await db.CourseItems
            .Where(i => i.SubTopicId == id).Select(i => i.Id).ToListAsync();
        await db.CourseProgresses.Where(p => itemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseQuestions.Where(q => itemIds.Contains(q.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => itemIds.Contains(i.Id)).ExecuteDeleteAsync();
        db.CourseSubTopics.Remove(subTopic);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Band (sub-mavzuning qulflangan turida) ----

    [HttpPost("subtopics/{subTopicId}/items")]
    public async Task<ActionResult> CreateItem(string subTopicId, ItemInput input)
    {
        var subTopic = await db.CourseSubTopics.FindAsync(subTopicId);
        if (subTopic == null) return NotFound();
        var maxOrder = await db.CourseItems
            .Where(i => i.SubTopicId == subTopicId)
            .Select(i => (int?)i.Order).MaxAsync() ?? -1;
        var item = new CourseItem
        {
            SubjectId = subTopic.SubjectId,
            SubTopicId = subTopicId,
            Text = input.Text,
            Note = input.Note ?? "",
            Order = maxOrder + 1,
            Type = subTopic.Type, // ota sub-mavzudan meros — bu yerda tanlanmaydi
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
        await db.CourseQuestions.Where(q => q.ItemId == id).ExecuteDeleteAsync();
        db.CourseItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Dars KONTENTI (video/matn/audio/lug'at/test) ----

    /// <summary>Bitta darsning to'liq kontenti — tahrirlovchi va ko'rish ekranlari uchun.</summary>
    [HttpGet("item/{id}")]
    public async Task<ActionResult<CourseItemDetailDto>> GetItem(string id)
    {
        var i = await db.CourseItems.FindAsync(id);
        if (i == null) return NotFound();
        var qs = await db.CourseQuestions.Where(q => q.ItemId == id).OrderBy(q => q.Order)
            .Select(q => new CourseQuestionDto(q.Id, q.Text, q.Options, q.CorrectIndex)).ToListAsync();
        return new CourseItemDetailDto(
            i.Id, i.SubTopicId, i.Text, i.Note, i.Order, i.Type,
            i.VideoUrl, i.AudioUrl, i.TextContent, i.PdfUrl, i.PdfName,
            i.Meta, ParseVocab(i.VocabJson), qs);
    }

    /// <summary>Dars kontentini saqlash: nom + (video/matn/audio/lug'at) + test savollari (almashtiriladi).
    /// Type BU YERDA O'ZGARTIRILMAYDI — ota sub-mavzudan qulflangan.</summary>
    [HttpPut("items/{id}/content")]
    public async Task<ActionResult> SaveItemContent(string id, SaveItemContentRequest req)
    {
        var item = await db.CourseItems.FindAsync(id);
        if (item == null) return NotFound();

        item.Text = (req.Text ?? "").Trim();
        item.VideoUrl = (req.VideoUrl ?? "").Trim();
        item.AudioUrl = (req.AudioUrl ?? "").Trim();
        item.TextContent = req.TextContent ?? "";
        item.PdfUrl = (req.PdfUrl ?? "").Trim();
        // PDF olib tashlansa nomi ham tozalanadi.
        item.PdfName = item.PdfUrl.Length > 0 ? (req.PdfName ?? "").Trim() : "";

        var vocab = (req.Vocab ?? new()).Where(v => !string.IsNullOrWhiteSpace(v.Term)).ToList();
        item.VocabJson = vocab.Count > 0 ? JsonSerializer.Serialize(vocab) : "";

        // Test savollari — to'liq almashtiriladi.
        await db.CourseQuestions.Where(q => q.ItemId == id).ExecuteDeleteAsync();
        var questions = (req.Questions ?? new()).Where(q => !string.IsNullOrWhiteSpace(q.Text)).ToList();
        var order = 0;
        foreach (var q in questions)
            db.CourseQuestions.Add(new CourseQuestion
            {
                ItemId = id,
                Text = q.Text.Trim(),
                Options = (q.Options ?? new()).Select(o => o ?? "").ToList(),
                CorrectIndex = q.CorrectIndex,
                Order = order++,
            });

        // Meta — foydalanuvchi erkin yorlig'i (masalan "12 daq"); bo'sh bo'lsa daraxtda
        // bo'limlar ro'yxati avtomatik ko'rsatiladi (ToItemDto).
        item.Meta = (req.Meta ?? "").Trim();

        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Excel import (shablon + fayl) ----

    private const string XlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // Shablon ustunlari (1-varaq). Tartibi Excel importi o'qishi bilan AYNAN bir xil bo'lishi shart.
    private static readonly string[] ExcelImportHeaders = { "Bo'lim*", "Mavzu*", "Dars nomi*", "Izoh" };

    /// <summary>
    /// O'quv dasturini ommaviy kiritish uchun Excel shabloni (.xlsx). 1-varaq "Dastur" —
    /// to'ldiriladigan sarlavhalar; 2-varaq "Yo'riqnoma" — maydonlar izohi va namuna.
    /// Import faqat 1-varaqni o'qiydi.
    /// </summary>
    [HttpGet("import-template")]
    public IActionResult ImportTemplate()
    {
        var info = new List<IReadOnlyList<string>>
        {
            new[] { "Bo'lim*", "Kursning katta bosqichi. Masalan: Beginner, A1, 1-bo'lim" },
            new[] { "Mavzu*", "Bo'lim ichidagi mavzu. Masalan: Present Simple" },
            new[] { "Dars nomi*", "Mavzu ichidagi dars. Masalan: 1-dars. Tanishuv" },
            new[] { "Izoh", "ixtiyoriy — dars izohi" },
            new[] { "", "" },
            new[] { "QOIDA:", "Bo'lim va Mavzu ustunlari bo'sh qoldirilsa — YUQORIDAGI qator qiymati olinadi." },
            new[] { "", "Ya'ni bo'lim/mavzu nomini faqat birinchi darsida yozish kifoya." },
            new[] { "", "" },
            new[] { "NAMUNA:", "" },
            new[] { "Bo'lim", "Mavzu | Dars nomi" },
            new[] { "Beginner", "Alifbo | 1-dars. Harflar" },
            new[] { "(bo'sh)", "(bo'sh) | 2-dars. Talaffuz" },
            new[] { "(bo'sh)", "Salomlashish | 3-dars. Greetings" },
            new[] { "Elementary", "Present Simple | 4-dars. Fe'llar" },
        };

        var bytes = ExcelExport.Build(new[]
        {
            new ExcelExport.SheetSpec("Dastur", ExcelImportHeaders, Array.Empty<IReadOnlyList<string>>()),
            new ExcelExport.SheetSpec("Yo'riqnoma", new[] { "Maydon", "Izoh" }, info),
        });
        return File(bytes, XlsxMime, "oquv_dasturi_shablon.xlsx");
    }

    /// <summary>
    /// To'ldirilgan Excel (.xlsx) shablonidan o'quv dasturini yuklaydi. Har qator = bitta dars;
    /// Bo'lim/Mavzu bo'sh bo'lsa yuqoridagi qator qiymati olinadi (carry-forward). Har mavzu darslari
    /// standart "Matn" sub-mavzusi ostiga qo'shiladi (Excel'da tur ustuni yo'q).
    /// <paramref name="replace"/>=true bo'lsa mavjud dastur (progress bilan) O'CHIRILIB, o'rniga yoziladi;
    /// aks holda mavjud bo'lim/mavzularga nomi bo'yicha QO'SHILADI (bir xil nom — takrorlanmaydi).
    /// </summary>
    [HttpPost("{subjectId}/import-excel")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<CurriculumExcelImportResultDto>> ImportExcel(
        string subjectId, IFormFile? file, [FromQuery] bool replace = false)
    {
        var subject = await db.Subjects.FindAsync(subjectId);
        if (subject == null) return NotFound(new { message = "Kurs topilmadi" });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Fayl tanlanmagan" });
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Faqat .xlsx (Excel) fayl qabul qilinadi" });

        List<string[]> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelImport.ReadRows(stream, ExcelImportHeaders.Length);
        }
        catch
        {
            return BadRequest(new { message = "Faylni o'qib bo'lmadi — buzilmagan .xlsx ekanini tekshiring" });
        }

        if (replace)
        {
            // Eski dastur (progress va test savollari bilan) tozalanadi.
            var oldItemIds = await db.CourseItems
                .Where(i => i.SubjectId == subjectId).Select(i => i.Id).ToListAsync();
            await db.CourseProgresses.Where(p => oldItemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
            await db.CourseQuestions.Where(q => oldItemIds.Contains(q.ItemId)).ExecuteDeleteAsync();
            await db.CourseItems.Where(i => i.SubjectId == subjectId).ExecuteDeleteAsync();
            await db.CourseSubTopics.Where(s => s.SubjectId == subjectId).ExecuteDeleteAsync();
            await db.CourseTopics.Where(t => t.SubjectId == subjectId).ExecuteDeleteAsync();
            await db.CourseLevels.Where(l => l.SubjectId == subjectId).ExecuteDeleteAsync();
        }

        // Mavjud bo'lim/mavzular (append rejimida nomi bo'yicha qayta ishlatiladi).
        var existingLevels = replace
            ? new List<CourseLevel>()
            : await db.CourseLevels.Where(l => l.SubjectId == subjectId).ToListAsync();
        var existingTopics = replace
            ? new List<CourseTopic>()
            : await db.CourseTopics.Where(t => t.SubjectId == subjectId).ToListAsync();
        // Excel'da "tur" ustuni yo'q — har mavzu uchun bitta "Matn" (text) sub-mavzu ostiga qo'shiladi
        // (kerak bo'lsa admin keyin kontentni video/audio/pdf'ga alohida sub-mavzuda joylashtiradi).
        var existingSubTopics = replace
            ? new List<CourseSubTopic>()
            : await db.CourseSubTopics.Where(s => s.SubjectId == subjectId).ToListAsync();

        var levelByName = existingLevels
            .GroupBy(l => l.Name.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        // Mavzu kaliti: levelId + "|" + nom (kichik harfda)
        var topicByKey = existingTopics
            .GroupBy(t => $"{t.LevelId}|{t.Title.Trim().ToLowerInvariant()}")
            .ToDictionary(g => g.Key, g => g.First());
        // Har mavzuning standart ("Matn") sub-mavzusi — lazy: birinchi darsi import qilinganda yaratiladi.
        var defaultSubTopicByTopic = existingSubTopics
            .Where(s => s.Type == "text")
            .GroupBy(s => s.TopicId)
            .ToDictionary(g => g.Key, g => g.First());

        var nextLevelOrder = existingLevels.Count > 0 ? existingLevels.Max(l => l.Order) + 1 : 0;
        var nextTopicOrder = new Dictionary<string, int>(); // levelId -> keyingi order
        var nextSubTopicOrder = new Dictionary<string, int>(); // topicId -> keyingi order
        var nextItemOrder = new Dictionary<string, int>(); // subTopicId -> keyingi order
        foreach (var g in existingTopics.GroupBy(t => t.LevelId))
            nextTopicOrder[g.Key] = g.Max(t => t.Order) + 1;
        foreach (var g in existingSubTopics.GroupBy(s => s.TopicId))
            nextSubTopicOrder[g.Key] = g.Max(s => s.Order) + 1;
        if (!replace)
        {
            var existingItemOrders = await db.CourseItems
                .Where(i => i.SubjectId == subjectId)
                .GroupBy(i => i.SubTopicId)
                .Select(g => new { SubTopicId = g.Key, Max = g.Max(i => i.Order) })
                .ToListAsync();
            foreach (var e in existingItemOrders) nextItemOrder[e.SubTopicId] = e.Max + 1;
        }

        // Berilgan mavzuning standart "Matn" sub-mavzusini qaytaradi — bo'lmasa yaratadi.
        CourseSubTopic GetOrCreateDefaultSubTopic(CourseTopic topic)
        {
            if (defaultSubTopicByTopic.TryGetValue(topic.Id, out var existing)) return existing;
            var order = nextSubTopicOrder.GetValueOrDefault(topic.Id, 0);
            nextSubTopicOrder[topic.Id] = order + 1;
            var st = new CourseSubTopic
            {
                SubjectId = subjectId, TopicId = topic.Id, Title = "Matn", Note = "", Order = order, Type = "text",
            };
            db.CourseSubTopics.Add(st);
            defaultSubTopicByTopic[topic.Id] = st;
            return st;
        }

        var errors = new List<StudentImportRowErrorDto>();
        int newLevels = 0, newTopics = 0, newItems = 0, skipped = 0;

        CourseLevel? currentLevel = null;
        CourseTopic? currentTopic = null;

        // 0-qator — sarlavha; ma'lumot 1-indeksdan (Excel'dagi 2-qator) boshlanadi.
        for (var i = 1; i < rows.Count; i++)
        {
            var r = rows[i];
            var excelRow = i + 1;
            if (r.All(string.IsNullOrWhiteSpace)) { skipped++; continue; }

            var levelName = r[0].Trim();
            var topicTitle = r[1].Trim();
            var itemText = r[2].Trim();
            var note = r[3].Trim();

            // Bo'lim: nom berilgan bo'lsa topamiz/yaratamiz, bo'sh bo'lsa oldingi qator bo'limi.
            if (levelName.Length > 0)
            {
                if (!levelByName.TryGetValue(levelName, out var lvl))
                {
                    lvl = new CourseLevel
                    {
                        SubjectId = subjectId,
                        Name = levelName,
                        Note = "",
                        Order = nextLevelOrder++,
                    };
                    db.CourseLevels.Add(lvl);
                    levelByName[levelName] = lvl;
                    newLevels++;
                }
                if (!ReferenceEquals(currentLevel, lvl)) currentTopic = null; // modul almashdi
                currentLevel = lvl;
            }
            if (currentLevel == null)
            {
                errors.Add(new StudentImportRowErrorDto(excelRow, "Bo'lim ko'rsatilmagan"));
                continue;
            }

            // Mavzu: xuddi shunday carry-forward.
            if (topicTitle.Length > 0)
            {
                var key = $"{currentLevel.Id}|{topicTitle.ToLowerInvariant()}";
                if (!topicByKey.TryGetValue(key, out var tp))
                {
                    var order = nextTopicOrder.GetValueOrDefault(currentLevel.Id, 0);
                    nextTopicOrder[currentLevel.Id] = order + 1;
                    tp = new CourseTopic
                    {
                        SubjectId = subjectId,
                        LevelId = currentLevel.Id,
                        Title = topicTitle,
                        Note = "",
                        Order = order,
                    };
                    db.CourseTopics.Add(tp);
                    topicByKey[key] = tp;
                    newTopics++;
                }
                currentTopic = tp;
            }

            // Dars nomi bo'sh qator — faqat modul/mavzu e'lon qilingan bo'lishi mumkin.
            if (itemText.Length == 0) { skipped++; continue; }

            if (currentTopic == null)
            {
                errors.Add(new StudentImportRowErrorDto(excelRow, "Mavzu ko'rsatilmagan"));
                continue;
            }

            var subTopic = GetOrCreateDefaultSubTopic(currentTopic);
            var itemOrder = nextItemOrder.GetValueOrDefault(subTopic.Id, 0);
            nextItemOrder[subTopic.Id] = itemOrder + 1;
            db.CourseItems.Add(new CourseItem
            {
                SubjectId = subjectId,
                SubTopicId = subTopic.Id,
                Text = itemText,
                Note = note,
                Order = itemOrder,
                Type = "text",
            });
            newItems++;
        }

        if (newLevels + newTopics + newItems > 0 || replace)
            await db.SaveChangesAsync();

        return new CurriculumExcelImportResultDto(newLevels, newTopics, newItems, skipped, errors);
    }

    // ---- Import (butun sillabusni almashtirish) ----

    // ---- Copy level (daraja) to another course ----

    /// <summary>
    /// Daraja bilan barcha mavzular va darslari (kontent siz) boshqa kursga nusxalanadi.
    /// ID'lar yangi yaratiladi, content bo'lim nomi va izoh qoladi.
    /// </summary>
    [HttpPost("levels/{levelId}/copy-to/{targetSubjectId}")]
    public async Task<ActionResult> CopyLevelToSubject(string levelId, string targetSubjectId)
    {
        var sourceLevel = await db.CourseLevels.FindAsync(levelId);
        if (sourceLevel == null) return NotFound("Daraja topilmadi");

        var targetSubject = await db.Subjects.FindAsync(targetSubjectId);
        if (targetSubject == null) return NotFound("Maqsadli kurs topilmadi");

        // Source daraja mavzulari, sub-mavzulari va bandlari
        var sourceTopics = await db.CourseTopics
            .Where(t => t.LevelId == levelId)
            .OrderBy(t => t.Order)
            .ToListAsync();

        var sourceTopicIds = sourceTopics.Select(t => t.Id).ToList();
        var sourceSubTopics = await db.CourseSubTopics
            .Where(s => sourceTopicIds.Contains(s.TopicId))
            .OrderBy(s => s.Order)
            .ToListAsync();
        var sourceSubTopicIds = sourceSubTopics.Select(s => s.Id).ToList();
        var sourceItems = await db.CourseItems
            .Where(i => sourceSubTopicIds.Contains(i.SubTopicId))
            .OrderBy(i => i.Order)
            .ToListAsync();

        // Target subject dagi ushbu nomi bo'lgan daraja mavjudmi?
        var existingLevel = await db.CourseLevels
            .FirstOrDefaultAsync(l => l.SubjectId == targetSubjectId && l.Name == sourceLevel.Name);

        if (existingLevel != null)
            return BadRequest($"\"{sourceLevel.Name}\" nomi bilan daraja allaqachon mavjud");

        // Yangi daraja yaratish
        var maxOrder = await db.CourseLevels
            .Where(l => l.SubjectId == targetSubjectId)
            .Select(l => (int?)l.Order)
            .MaxAsync() ?? -1;

        var newLevel = new CourseLevel
        {
            SubjectId = targetSubjectId,
            Name = sourceLevel.Name,
            Note = sourceLevel.Note,
            Order = maxOrder + 1,
        };
        db.CourseLevels.Add(newLevel);

        // Old→New mapping (mavzu, sub-mavzu va bandlar)
        var topicMapping = new Dictionary<string, string>(); // Old → New
        var subTopicMapping = new Dictionary<string, string>(); // Old → New
        var itemMapping = new Dictionary<string, string>(); // Old → New

        // Mavzularni nusxalash
        foreach (var sourceTopic in sourceTopics)
        {
            var newTopic = new CourseTopic
            {
                SubjectId = targetSubjectId,
                LevelId = newLevel.Id,
                Title = sourceTopic.Title,
                Note = sourceTopic.Note,
                Order = sourceTopic.Order,
            };
            db.CourseTopics.Add(newTopic);
            topicMapping[sourceTopic.Id] = newTopic.Id;
        }

        // EF in-memory ID'lari yaratishi uchun SaveChanges chaqirish
        await db.SaveChangesAsync();

        // Sub-mavzularni nusxalash (tur saqlanadi — u har sub-mavzuda qulflangan).
        foreach (var sourceSubTopic in sourceSubTopics)
        {
            if (!topicMapping.TryGetValue(sourceSubTopic.TopicId, out var newTopicId))
                continue;

            var newSubTopic = new CourseSubTopic
            {
                SubjectId = targetSubjectId,
                TopicId = newTopicId,
                Title = sourceSubTopic.Title,
                Note = sourceSubTopic.Note,
                Order = sourceSubTopic.Order,
                Type = sourceSubTopic.Type,
            };
            db.CourseSubTopics.Add(newSubTopic);
            subTopicMapping[sourceSubTopic.Id] = newSubTopic.Id;
        }

        await db.SaveChangesAsync();

        // Bandlarni nusxalash (kontent yo'q, faqat nom va izoh)
        foreach (var sourceItem in sourceItems)
        {
            if (!subTopicMapping.TryGetValue(sourceItem.SubTopicId, out var newSubTopicId))
                continue;

            var newItem = new CourseItem
            {
                SubjectId = targetSubjectId,
                SubTopicId = newSubTopicId,
                Text = sourceItem.Text,
                Note = sourceItem.Note,
                Type = sourceItem.Type,
                Order = sourceItem.Order,
                // Kontent maydonlari BO'SH qoladi (video, audio, matn, lug'at, test)
            };
            db.CourseItems.Add(newItem);
            itemMapping[sourceItem.Id] = newItem.Id;
        }

        await db.SaveChangesAsync();

        return Ok(new
        {
            levelId = newLevel.Id,
            levelName = newLevel.Name,
            topicCount = sourceTopics.Count,
            itemCount = sourceItems.Count,
        });
    }

    [HttpPost("{subjectId}/import")]
    public async Task<ActionResult> Import(string subjectId, CurriculumImportDto payload)
    {
        // Eski sillabusni (va unga tegishli progressni) tozalash.
        var oldItemIds = await db.CourseItems
            .Where(i => i.SubjectId == subjectId).Select(i => i.Id).ToListAsync();
        await db.CourseProgresses.Where(p => oldItemIds.Contains(p.ItemId)).ExecuteDeleteAsync();
        await db.CourseItems.Where(i => i.SubjectId == subjectId).ExecuteDeleteAsync();
        await db.CourseSubTopics.Where(s => s.SubjectId == subjectId).ExecuteDeleteAsync();
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

                // "Tur" import formatida yo'q — bitta standart "Matn" (text) sub-mavzu ostiga qo'shiladi.
                var items = tp.Items ?? new List<ImportItemDto>();
                if (items.Count == 0) continue;
                var subTopic = new CourseSubTopic
                {
                    SubjectId = subjectId, TopicId = topic.Id, Title = "Matn", Note = "", Order = 0, Type = "text",
                };
                db.CourseSubTopics.Add(subTopic);

                for (int ii = 0; ii < items.Count; ii++)
                {
                    var it = items[ii];
                    db.CourseItems.Add(new CourseItem
                    {
                        SubjectId = subjectId,
                        SubTopicId = subTopic.Id,
                        Text = it.Text,
                        Note = it.Note ?? "",
                        Order = ii,
                        Type = "text",
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
        return await CurriculumForecast.BuildGroupAsync(db, group);
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

        // Tegishli kurslarning band/sub-mavzu/mavzu/daraja lug'atlari (per-log so'rovsiz).
        var items = await db.CourseItems
            .Where(i => courseIds.Contains(i.SubjectId))
            .ToListAsync();
        var subTopics = await db.CourseSubTopics
            .Where(s => courseIds.Contains(s.SubjectId))
            .ToListAsync();
        var topics = await db.CourseTopics
            .Where(t => courseIds.Contains(t.SubjectId))
            .ToListAsync();
        var levels = await db.CourseLevels
            .Where(l => courseIds.Contains(l.SubjectId))
            .ToListAsync();

        var itemById = items.ToDictionary(i => i.Id);
        var subTopicById = subTopics.ToDictionary(s => s.Id);
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
                var hasSubTopic = subTopicById.TryGetValue(item.SubTopicId, out var subTopic);
                var topicTitle = hasSubTopic && topicById.TryGetValue(subTopic!.TopicId, out var topic) ? topic.Title : "";
                var levelName = hasSubTopic && topicById.TryGetValue(subTopic!.TopicId, out var tp)
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
