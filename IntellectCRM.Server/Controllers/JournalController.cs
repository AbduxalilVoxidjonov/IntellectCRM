using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

// "classes" (Guruhlar) — admin jurnali faqat Guruh detali sahifasidan ochiladi, alohida "Jurnal"
// bo'limi/ruxsat katalogida yo'q; "journal" kaliti bo'lsa xodimga hech qachon berib bo'lmas edi.
[ApiController]
[Authorize]
[AdminPerm("classes")]
[Route("api/admin/journal")]
public class JournalController(AppDbContext db, FcmService fcm) : ControllerBase
{
    /// <summary>Fanning chorakdagi darslari (sana + dars raqami). Bir kunda bir fan bir necha marta bo'lishi mumkin.</summary>
    [HttpGet("columns")]
    public async Task<ActionResult<IEnumerable<JournalColumnDto>>> GetColumns(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter)
        => await JournalService.ComputeColumnsAsync(db, classId, subjectId, quarter);

    /// <summary>Berilgan sanada o'tilgan darslar (sinf+fan+dars raqami): ptichka yoki baho/davomat bo'lganlar.</summary>
    [HttpGet("conducted")]
    public async Task<ActionResult<IEnumerable<ConductedLessonDto>>> Conducted([FromQuery] string date)
    {
        var fromNotes = await db.LessonNotes
            .Where(n => n.Date == date && n.Conducted)
            .Select(n => new ConductedLessonDto(n.ClassId, n.SubjectId, n.Period))
            .ToListAsync();
        var fromEntries = await db.JournalEntries
            .Where(e => e.Date == date && (e.Grade != null || e.ReasonId != null))
            .Select(e => new ConductedLessonDto(e.ClassId, e.SubjectId, e.Period))
            .ToListAsync();
        return fromNotes.Concat(fromEntries).Distinct().ToList();
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<JournalEntryDto>>> GetEntries(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter)
        => await JournalService.GetEntriesAsync(db, classId, subjectId, quarter);

    /// <summary>Guruhning bitta OYLIK jurnali (guruh sahifasi uchun): ustunlar guruh dars kunlari bo'yicha
    /// avtomatik, qatorlar faqat faol o'quvchilar, oyma-oy navigatsiya. <paramref name="month"/> berilmasa — oxirgi oy.</summary>
    [HttpGet("group")]
    public async Task<ActionResult<GroupJournalDto>> GroupMonth(
        [FromQuery] string classId, [FromQuery] string? month)
    {
        var result = await JournalService.GroupMonthAsync(db, classId, month);
        return result is null ? NotFound(new { message = "Guruh topilmadi" }) : result;
    }

    /// <summary>Bitta katakni belgilash — baho yoki davomat sababi (mavjud bo'lsa ustiga yoziladi).</summary>
    [HttpPut]
    public async Task<IActionResult> SetEntry(SetJournalEntryRequest req)
    {
        // Jurnal siyosati (sana oynasi / faqat o'tilgan dars) — "Adminlarga ham qo'llash" yoqiq bo'lsa cheklaydi.
        var deny = await JournalPolicy.CheckAsync(db, req.ClassId, req.SubjectId, req.Date, req.Period, isAdmin: true);
        if (deny is not null) return BadRequest(new { message = deny });
        await JournalService.SetEntryAsync(db, req, fcm);
        return NoContent();
    }

    /// <summary>Bitta dars (sana) uchun BARCHA o'quvchiga birdan davomat: reasonId null = hammasi keldi, aks holda hammasi shu sabab bilan kelmadi.</summary>
    [HttpPost("bulk-attendance")]
    public async Task<IActionResult> BulkAttendance(BulkAttendanceRequest req)
    {
        // skipConducted: ommaviy davomat darsni o'zi "o'tildi" qiladi — conducted talabi unga qo'llanmaydi.
        var deny = await JournalPolicy.CheckAsync(db, req.ClassId, req.SubjectId, req.Date, req.Period,
            isAdmin: true, skipConducted: true);
        if (deny is not null) return BadRequest(new { message = deny });
        await JournalService.BulkAttendanceAsync(db, req);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> ClearEntry(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter,
        [FromQuery] string studentId, [FromQuery] string date, [FromQuery] int period)
    {
        // Tozalash ham sana oynasiga bo'ysunadi (yopiq davr yozuvini o'chirib ham bo'lmaydi).
        var deny = await JournalPolicy.CheckAsync(db, classId, subjectId, date, period,
            isAdmin: true, skipConducted: true);
        if (deny is not null) return BadRequest(new { message = deny });
        await JournalService.ClearEntryAsync(db, classId, subjectId, quarter, studentId, date, period);
        return NoContent();
    }

    /* ---------- Jurnal boshqaruvi (tahrirlash siyosati) — "Guruhlar → Jurnal boshqaruvi" oynasi ---------- */

    /// <summary>Joriy jurnal siyosati (sana oynasi, faqat o'tilgan dars, adminlarga qo'llash).</summary>
    [HttpGet("policy")]
    public async Task<ActionResult<JournalPolicyDto>> GetPolicy() => await JournalPolicy.GetAsync(db);

    /// <summary>Jurnal siyosatini saqlaydi (noto'g'ri qiymatlar xavfsiz defaultga tushiriladi).</summary>
    [HttpPut("policy")]
    public async Task<ActionResult<JournalPolicyDto>> SavePolicy(JournalPolicyDto req) =>
        await JournalPolicy.SaveAsync(db, req);

    /* ---------- Mavzu va uyga vazifa ---------- */

    [HttpGet("notes")]
    public async Task<ActionResult<IEnumerable<JournalTopicDto>>> GetNotes(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter)
        => await JournalService.GetNotesAsync(db, classId, subjectId, quarter);

    [HttpPut("notes")]
    public async Task<IActionResult> SetNote(SetLessonNoteRequest req)
    {
        await JournalService.SetNoteAsync(db, req);
        return NoContent();
    }

    /* ---------- Mavzularni Excel'dan ommaviy yuklash (mavzu + uy vazifa) ---------- */

    private const string XlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <summary>Tanlangan sinf+fan+chorak uchun mavzular shabloni (.xlsx) — jadval kunlari oldindan to'ldirilgan.</summary>
    [HttpGet("topics-template")]
    public async Task<IActionResult> TopicsTemplate(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter)
    {
        var bytes = await JournalService.TopicTemplateXlsxAsync(db, classId, subjectId, quarter);
        return File(bytes, XlsxMime, "mavzular_shablon.xlsx");
    }

    /// <summary>To'ldirilgan Excel'dan mavzu+uy vazifani import qiladi (darsni "o'tilgan" qilmaydi).</summary>
    [HttpPost("topics-import")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<TopicImportResultDto>> TopicsImport(
        [FromForm] string classId, [FromForm] string subjectId, [FromForm] int quarter, IFormFile? file)
    {
        if (string.IsNullOrWhiteSpace(classId) || string.IsNullOrWhiteSpace(subjectId))
            return BadRequest(new { message = "Sinf va fan ko'rsatilishi shart" });
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Fayl tanlanmagan" });
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Faqat .xlsx (Excel) fayl qabul qilinadi" });

        List<string[]> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ExcelImport.ReadRows(stream, JournalService.TopicHeaders.Length);
        }
        catch
        {
            return BadRequest(new { message = "Faylni o'qib bo'lmadi — buzilmagan .xlsx ekanini tekshiring" });
        }

        return await JournalService.ImportTopicsAsync(db, classId, subjectId, quarter, rows);
    }
}
