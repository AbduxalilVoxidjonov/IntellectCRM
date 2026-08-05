using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// "BOG'LANISH KERAK" — o'quvchi bilan bog'lanish NAVBATI (follow-up).
///
/// <para>Oqim: o'quvchi profilidagi "⋮" → "Bog'lanish kerak" → SABAB tanlanadi → o'quvchi navbatga
/// tushadi. Operator navbatdan bog'lanadi, natijani va "javobi nima dedi"ni yozadi, so'ng keyingi
/// qadamni tanlaydi: hal bo'ldi / qayta qo'ng'iroq (sana bilan) / bog'lanib bo'lmadi.
/// Har bir amal <see cref="ContactAttempt"/> ga yoziladi — hisobotlar AYNAN shundan hisoblanadi.</para>
///
/// <para>Bosqich/natija kalitlari — <see cref="ContactService"/> (yagona katalog).</para>
///
/// <para>RUXSAT: <c>contacts</c> — o'quvchi ma'lumotidan ALOHIDA. Sabab: navbat bilan ishlaydigan
/// operatorga o'quvchilar bo'limini to'liq ochish shart emas ("Kassa" ruxsati "Moliya"dan alohida
/// bo'lgani bilan bir xil mantiq). Javobda o'quvchi ismi va TELEFONI qaytadi, shuning uchun
/// <c>ReadRequiresPerm = true</c> — o'qish ham darvozalangan.</para>
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("contacts", ReadRequiresPerm = true)]
[Route("api/admin/contacts")]
public class ContactsController(AppDbContext db, AuditService audit) : ControllerBase
{
    private string Actor => User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
    private string ActorId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                              ?? User.FindFirst("sub")?.Value ?? "";
    private static string Today => AppClock.Today.ToString("yyyy-MM-dd");

    /// <summary>Audit tur nomi — <see cref="AuditSections"/> da "Bog'lanish kerak" bo'limiga tushadi.</summary>
    private const string AuditEntity = "ContactRequest";

    /// <summary>Bir amalda navbatga qo'shiladigan eng ko'p o'quvchi ("hammasini tanlash"
    /// bosilsa ham so'rov cheksiz o'smasin).</summary>
    private const int MaxBulk = 500;

    /* =========================================================================================
     *  KATALOG + SANOQLAR
     * ====================================================================================== */

    /// <summary>
    /// Bosqich/natija katalogi va navbat sanoqlari — sahifa BITTA so'rovda ochilsin.
    /// Sanoqlar har doim JORIY holat bo'yicha (davr filtri hisobotga tegishli, navbatga emas).
    /// </summary>
    [HttpGet("meta")]
    public async Task<ActionResult<ContactMetaDto>> Meta()
    {
        var counts = (await db.ContactRequests.AsNoTracking()
                .GroupBy(c => c.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync())
            .ToDictionary(x => x.Status, x => x.Count);

        var today = Today;
        var overdue = await db.ContactRequests.AsNoTracking()
            .CountAsync(c => c.Status == ContactStatuses.Callback
                             && c.DueDate != "" && string.Compare(c.DueDate, today) < 0);

        return new ContactMetaDto(
            ContactService.Statuses.Select(s => new ContactStatusDto(s.Key, s.Label, s.IsOpen, s.Color)).ToList(),
            ContactService.Results.Select(r => new ContactResultDto(r.Key, r.Label, r.Reached)).ToList(),
            ContactService.Statuses.Select(s => new ContactCountDto(s.Key, counts.GetValueOrDefault(s.Key))).ToList(),
            overdue);
    }

    /* =========================================================================================
     *  NAVBAT
     * ====================================================================================== */

    /// <summary>
    /// Navbat ro'yxati. <paramref name="status"/> bo'sh — FAQAT ochiqlar (new + callback), chunki
    /// bo'lim ochilganda operatorga kerakli narsa shu. <paramref name="status"/>="all" — hammasi.
    /// </summary>
    /// <param name="overdue">true — faqat muddati o'tgan qayta qo'ng'iroqlar.</param>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ContactRequestDto>>> List(
        [FromQuery] string? status, [FromQuery] string? q, [FromQuery] bool overdue = false,
        [FromQuery] int limit = 200)
    {
        var today = Today;
        var query = db.ContactRequests.AsNoTracking().AsQueryable();

        if (string.IsNullOrEmpty(status))
            query = query.Where(c => c.Status == ContactStatuses.New || c.Status == ContactStatuses.Callback);
        else if (status != "all" && ContactService.IsValidStatus(status))
            query = query.Where(c => c.Status == status);

        if (overdue)
            query = query.Where(c => c.Status == ContactStatuses.Callback
                                     && c.DueDate != "" && string.Compare(c.DueDate, today) < 0);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLower();
            query = query.Where(c => c.StudentName.ToLower().Contains(needle)
                                     || c.ReasonLabel.ToLower().Contains(needle));
        }

        // Tartib: eng shoshilinch yuqorida — muddati o'tganlar, so'ng muddati yaqinlar, so'ng yangilar.
        // `DueDate` bo'sh bo'lgan (new) yozuvlar ostida qolmasin uchun avval holat bo'yicha saralaymiz.
        var items = await query
            .OrderBy(c => c.Status == ContactStatuses.Callback ? 0 : 1)
            .ThenBy(c => c.DueDate)
            .ThenByDescending(c => c.CreatedAt)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync();

        var phones = await PhonesAsync(items.Select(i => i.StudentId).Distinct().ToList());
        return items.Select(c => ToDto(c, today, phones)).ToList();
    }

    /// <summary>Bitta talab — TARIXI bilan ("kim qaysi bosqichga oldi, natijasi qanday bo'ldi").</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ContactRequestDto>> Get(string id)
    {
        var c = await db.ContactRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound(new { message = "Talab topilmadi" });

        var history = await db.ContactAttempts.AsNoTracking()
            .Where(a => a.RequestId == id)
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .ToListAsync();

        var phones = await PhonesAsync(new List<string> { c.StudentId });
        return ToDto(c, Today, phones, history);
    }

    /// <summary>
    /// O'quvchining BARCHA talablari — HAR BIRI TARIXI BILAN.
    ///
    /// <para>Tarix ataylab qo'shiladi: o'quvchi profilining "Aloqa" tabida har bog'lanish urinishi
    /// ("javobi nima dedi") qo'ng'iroqlar tarixi bilan yonma-yon ko'rinadi. Bitta o'quvchi
    /// bo'lgani uchun bu ikkita yengil so'rov — ro'yxat endpointiga tarix qo'shilmaydi.</para>
    /// </summary>
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<IEnumerable<ContactRequestDto>>> ByStudent(string studentId)
    {
        var items = await db.ContactRequests.AsNoTracking()
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
        if (items.Count == 0) return new List<ContactRequestDto>();

        var ids = items.Select(c => c.Id).ToList();
        var history = (await db.ContactAttempts.AsNoTracking()
                .Where(a => ids.Contains(a.RequestId))
                .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
                .ToListAsync())
            .GroupBy(a => a.RequestId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var phones = await PhonesAsync(new List<string> { studentId });
        return items.Select(c => ToDto(c, Today, phones, history.GetValueOrDefault(c.Id))).ToList();
    }

    /* =========================================================================================
     *  AMALLAR
     * ====================================================================================== */

    /// <summary>
    /// Yangi talab ochish ("Bog'lanish kerak"). Bir o'quvchida bir vaqtda faqat BITTA ochiq talab
    /// bo'ladi — aks holda navbat bir xil odam bilan to'lib ketardi. Ochiq talab bo'lsa 400 va
    /// javobda o'sha talab id'si qaytadi (klient uni ocha oladi).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ContactRequestDto>> Create(CreateContactRequest req)
    {
        var student = await db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == req.StudentId);
        if (student is null) return NotFound(new { message = "O'quvchi topilmadi" });

        var open = await db.ContactRequests
            .FirstOrDefaultAsync(c => c.StudentId == req.StudentId
                                      && (c.Status == ContactStatuses.New || c.Status == ContactStatuses.Callback));
        if (open is not null)
            return BadRequest(new
            {
                message = $"Bu o'quvchida allaqachon ochiq talab bor ({ContactService.StatusLabel(open.Status)}) — "
                          + "yangisini ochish o'rniga o'shanga izoh qo'shing.",
                existingId = open.Id,
            });

        var (reasonId, reasonLabel) = await ResolveReasonAsync(req.ReasonId);

        var due = (req.DueDate ?? "").Trim();
        if (due.Length > 0 && !DateOnly.TryParse(due, out _))
            return BadRequest(new { message = "Sana noto'g'ri (YYYY-MM-DD)" });

        var c = AddRequest(student, reasonId, reasonLabel, (req.Note ?? "").Trim(), due);
        await db.SaveChangesAsync();
        return ToDto(c, Today, await PhonesAsync(new List<string> { c.StudentId }));
    }

    /// <summary>
    /// KO'PLAB o'quvchini birdan navbatga qo'shish — "O'quvchilar ro'yxati"da bir nechtasini
    /// belgilab "Bog'lanish kerak" bosilganda.
    ///
    /// <para>DIQQAT: bitta o'quvchida ochiq talab bo'lsa BUTUN amal to'xtamaydi — u chetlab
    /// o'tiladi va javobda soni/ismlari qaytadi. Aks holda 100 ta tanlangan o'quvchidan bittasi
    /// tufayli hech kim navbatga tushmasdi.</para>
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<ContactBulkResultDto>> CreateBulk(CreateContactRequestsBulk req)
    {
        var ids = (req.StudentIds ?? new List<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        if (ids.Count == 0) return BadRequest(new { message = "O'quvchi tanlanmagan" });
        if (ids.Count > MaxBulk)
            return BadRequest(new { message = $"Bir vaqtda ko'pi bilan {MaxBulk} ta o'quvchi tanlanadi" });

        var due = (req.DueDate ?? "").Trim();
        if (due.Length > 0 && !DateOnly.TryParse(due, out _))
            return BadRequest(new { message = "Sana noto'g'ri (YYYY-MM-DD)" });

        var (reasonId, reasonLabel) = await ResolveReasonAsync(req.ReasonId);
        var note = (req.Note ?? "").Trim();

        // Ikkita TO'PLAMLI so'rov — o'quvchi boshiga alohida so'rov ketmasin (N+1).
        var students = await db.Students.AsNoTracking()
            .Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
        var alreadyOpen = (await db.ContactRequests
                .Where(c => ids.Contains(c.StudentId)
                            && (c.Status == ContactStatuses.New || c.Status == ContactStatuses.Callback))
                .Select(c => c.StudentId).ToListAsync())
            .ToHashSet();

        var created = 0;
        var skipped = new List<string>();
        var notFound = 0;
        foreach (var id in ids)
        {
            if (!students.TryGetValue(id, out var student)) { notFound++; continue; }
            if (alreadyOpen.Contains(id)) { skipped.Add(student.FullName); continue; }
            AddRequest(student, reasonId, reasonLabel, note, due);
            created++;
        }

        await db.SaveChangesAsync();
        // Ismlar ro'yxati CHEGARALANADI — 300 ta ism xabarga sig'maydi (soni baribir to'liq).
        return new ContactBulkResultDto(created, skipped.Count, skipped.Take(10).ToList(), notFound);
    }

    /// <summary>
    /// Talabni (va uning "ochildi" hodisasini) tranzaksiyaga qo'shadi. <b>SaveChanges QILMAYDI</b> —
    /// chaqiruvchi saqlaydi (ko'plab qo'shishda bitta SaveChanges bo'lsin).
    /// </summary>
    private ContactRequest AddRequest(
        Student student, string reasonId, string reasonLabel, string note, string due)
    {
        var now = AppClock.Iso();
        var c = new ContactRequest
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            ReasonId = reasonId,
            ReasonLabel = reasonLabel,
            Note = note,
            // Sana berilgan bo'lsa darhol "qayta qo'ng'iroq" — masalan "ertaga bog'laning".
            Status = due.Length > 0 ? ContactStatuses.Callback : ContactStatuses.New,
            DueDate = due,
            CreatedAt = now,
            CreatedBy = Actor,
            LastActorName = Actor,
            LastActionAt = now,
        };
        db.ContactRequests.Add(c);

        db.ContactAttempts.Add(new ContactAttempt
        {
            RequestId = c.Id,
            StudentId = c.StudentId,
            Type = ContactAttemptTypes.Created,
            NextStatus = c.Status,
            DueDate = due,
            Response = c.Note,
            ActorId = ActorId,
            ActorName = Actor,
            CreatedAt = now,
            Date = Today,
        });

        audit.Record(AuditEntity, c.Id, "create",
            $"Bog'lanish kerak: {c.StudentName}"
            + (reasonLabel.Length > 0 ? $" — sabab: {reasonLabel}" : "")
            + (due.Length > 0 ? $", qayta qo'ng'iroq: {due}" : ""),
            studentId: c.StudentId);

        return c;
    }

    /// <summary>Sabab id'sini tekshiradi va MATNINI (snapshot) qaytaradi. Topilmasa ikkalasi ham
    /// bo'sh — sabab ixtiyoriy, noto'g'ri id tufayli amal to'xtamasin.</summary>
    private async Task<(string Id, string Label)> ResolveReasonAsync(string? reasonId)
    {
        var id = (reasonId ?? "").Trim();
        if (id.Length == 0) return ("", "");
        var label = await db.ActionReasons.Where(r => r.Id == id).Select(r => r.Label)
            .FirstOrDefaultAsync() ?? "";
        return label.Length == 0 ? ("", "") : (id, label);
    }

    /// <summary>
    /// BOG'LANILDI — urinish natijasi + "javobi nima dedi" + keyingi bosqich.
    /// Modulning asosiy amali; hisobotlardagi barcha sonlar shu yerdan kelib chiqadi.
    /// </summary>
    [HttpPost("{id}/attempt")]
    public async Task<ActionResult<ContactRequestDto>> Attempt(string id, ContactAttemptRequest req)
    {
        var c = await db.ContactRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound(new { message = "Talab topilmadi" });
        if (!ContactService.IsOpen(c.Status))
            return BadRequest(new { message = "Talab yakunlangan — avval uni qayta oching." });

        if (!ContactService.IsValidResult(req.Result))
            return BadRequest(new { message = "Natija tanlanmagan" });
        if (!ContactService.CanTransitionTo(req.NextStatus))
            return BadRequest(new { message = "Keyingi qadam noto'g'ri (qayta qo'ng'iroq / hal bo'ldi / bog'lanib bo'lmadi)" });

        var due = (req.DueDate ?? "").Trim();
        if (req.NextStatus == ContactStatuses.Callback)
        {
            if (due.Length == 0) return BadRequest(new { message = "Qayta qo'ng'iroq sanasini tanlang" });
            if (!DateOnly.TryParse(due, out _)) return BadRequest(new { message = "Sana noto'g'ri (YYYY-MM-DD)" });
        }
        else due = "";

        var response = (req.Response ?? "").Trim();
        if (response.Length > 2000) response = response[..2000];

        var now = AppClock.Iso();
        db.ContactAttempts.Add(new ContactAttempt
        {
            RequestId = c.Id,
            StudentId = c.StudentId,
            Type = ContactAttemptTypes.Contact,
            Result = req.Result,
            Response = response,
            NextStatus = req.NextStatus,
            DueDate = due,
            ActorId = ActorId,
            ActorName = Actor,
            CreatedAt = now,
            Date = Today,
        });

        c.AttemptCount++;
        c.Status = req.NextStatus;
        c.DueDate = due;
        c.LastResponse = response;
        c.LastActorName = Actor;
        c.LastActionAt = now;
        if (!ContactService.IsOpen(c.Status))
        {
            c.ClosedAt = now;
            c.ClosedBy = Actor;
        }
        else
        {
            // Qayta ochilgan talab yana yopilsa "eski" yopilish izi qolib ketmasin.
            c.ClosedAt = "";
            c.ClosedBy = "";
        }

        audit.Record(AuditEntity, c.Id, "update",
            $"Bog'lanildi: {c.StudentName} — {ContactService.ResultLabel(req.Result)} → "
            + $"{ContactService.StatusLabel(c.Status)}"
            + (due.Length > 0 ? $" ({due})" : "")
            + (response.Length > 0 ? $" — javobi: {response}" : ""),
            studentId: c.StudentId);

        await db.SaveChangesAsync();
        return ToDto(c, Today, await PhonesAsync(new List<string> { c.StudentId }));
    }

    /// <summary>Bosqichni o'zgartirmasdan izoh qo'shish (masalan "ota-onasi kelib ketdi").</summary>
    [HttpPost("{id}/note")]
    public async Task<ActionResult<ContactRequestDto>> AddNote(string id, ContactNoteRequest req)
    {
        var c = await db.ContactRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound(new { message = "Talab topilmadi" });
        var text = (req.Text ?? "").Trim();
        if (text.Length == 0) return BadRequest(new { message = "Izoh bo'sh" });
        if (text.Length > 2000) text = text[..2000];

        var now = AppClock.Iso();
        db.ContactAttempts.Add(new ContactAttempt
        {
            RequestId = c.Id, StudentId = c.StudentId, Type = ContactAttemptTypes.Note,
            Response = text, ActorId = ActorId, ActorName = Actor, CreatedAt = now, Date = Today,
        });
        c.LastActorName = Actor;
        c.LastActionAt = now;

        audit.Record(AuditEntity, c.Id, "update", $"Bog'lanish izohi ({c.StudentName}): {text}",
            studentId: c.StudentId);
        await db.SaveChangesAsync();
        return ToDto(c, Today, await PhonesAsync(new List<string> { c.StudentId }));
    }

    /// <summary>Yakunlangan talabni QAYTA ochish — yana navbatga qaytadi.</summary>
    [HttpPost("{id}/reopen")]
    public async Task<ActionResult<ContactRequestDto>> Reopen(string id, ContactReopenRequest req)
    {
        var c = await db.ContactRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound(new { message = "Talab topilmadi" });
        if (ContactService.IsOpen(c.Status))
            return BadRequest(new { message = "Talab allaqachon ochiq" });

        // Shu o'quvchida boshqa ochiq talab bo'lsa ikkitasi paydo bo'lmasin (Create bilan bir qoida).
        var open = await db.ContactRequests.AnyAsync(x => x.StudentId == c.StudentId && x.Id != c.Id
            && (x.Status == ContactStatuses.New || x.Status == ContactStatuses.Callback));
        if (open)
            return BadRequest(new { message = "Bu o'quvchida boshqa ochiq talab bor — avval uni yakunlang." });

        var now = AppClock.Iso();
        var note = (req.Note ?? "").Trim();
        c.Status = ContactStatuses.New;
        c.DueDate = "";
        c.ClosedAt = "";
        c.ClosedBy = "";
        c.LastActorName = Actor;
        c.LastActionAt = now;

        db.ContactAttempts.Add(new ContactAttempt
        {
            RequestId = c.Id, StudentId = c.StudentId, Type = ContactAttemptTypes.Reopen,
            Response = note, NextStatus = ContactStatuses.New,
            ActorId = ActorId, ActorName = Actor, CreatedAt = now, Date = Today,
        });

        audit.Record(AuditEntity, c.Id, "update",
            $"Bog'lanish talabi qayta ochildi: {c.StudentName}" + (note.Length > 0 ? $" — {note}" : ""),
            studentId: c.StudentId);
        await db.SaveChangesAsync();
        return ToDto(c, Today, await PhonesAsync(new List<string> { c.StudentId }));
    }

    /// <summary>Talabni butunlay o'chirish (xato ochilgan bo'lsa) — tarixi bilan.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var c = await db.ContactRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound(new { message = "Talab topilmadi" });

        await db.ContactAttempts.Where(a => a.RequestId == id).ExecuteDeleteAsync();
        audit.Record(AuditEntity, c.Id, "delete", $"Bog'lanish talabi o'chirildi: {c.StudentName}",
            studentId: c.StudentId);
        db.ContactRequests.Remove(c);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /* =========================================================================================
     *  HISOBOTLAR
     * ====================================================================================== */

    /// <summary>
    /// Davr bo'yicha hisobot: kunlik oqim, xodimlar kesimi ("kim qaysi bosqichga oldi"),
    /// sabablar va natijalar kesimi. Sanoqlar <see cref="ContactAttempt"/> dan — ya'ni
    /// "nima bo'ldi" emas, "kim nima qildi" bo'yicha.
    /// </summary>
    /// <param name="from">"yyyy-MM-dd" (bo'sh — oxirgi 30 kun).</param>
    [HttpGet("stats")]
    public async Task<ActionResult<ContactStatsDto>> Stats([FromQuery] string? from, [FromQuery] string? to)
    {
        var today = AppClock.Today;
        var fromDate = string.IsNullOrWhiteSpace(from)
            ? today.AddDays(-29).ToString("yyyy-MM-dd") : from!.Trim();
        var toDate = string.IsNullOrWhiteSpace(to) ? today.ToString("yyyy-MM-dd") : to!.Trim();
        if (!DateOnly.TryParse(fromDate, out var f) || !DateOnly.TryParse(toDate, out var t))
            return BadRequest(new { message = "Sana noto'g'ri (YYYY-MM-DD)" });
        if (t < f) (fromDate, toDate, f, t) = (toDate, fromDate, t, f);

        var attempts = await db.ContactAttempts.AsNoTracking()
            .Where(a => string.Compare(a.Date, fromDate) >= 0 && string.Compare(a.Date, toDate) <= 0)
            .ToListAsync();

        // "Bog'lanildi" hisoblanadigan urinishlar — natija kaliti Reached bo'lganlari.
        // Qoida ContactService da (yagona manba), shuning uchun bu yerda SQL emas, C# da sanaladi.
        bool Reached(ContactAttempt a) => a.Type == ContactAttemptTypes.Contact && ContactService.Reached(a.Result);
        bool IsContact(ContactAttempt a) => a.Type == ContactAttemptTypes.Contact;

        var daily = new List<ContactDailyRowDto>();
        for (var d = f; d <= t; d = d.AddDays(1))
        {
            var key = d.ToString("yyyy-MM-dd");
            var day = attempts.Where(a => a.Date == key).ToList();
            daily.Add(new ContactDailyRowDto(
                key,
                Created: day.Count(a => a.Type == ContactAttemptTypes.Created),
                Attempts: day.Count(IsContact),
                Reached: day.Count(Reached),
                Done: day.Count(a => a.NextStatus == ContactStatuses.Done),
                Callback: day.Count(a => a.NextStatus == ContactStatuses.Callback && IsContact(a)),
                Failed: day.Count(a => a.NextStatus == ContactStatuses.Failed)));
        }

        var byStaff = attempts
            .Where(a => a.ActorName.Length > 0)
            .GroupBy(a => a.ActorName)
            .Select(g => new ContactStaffRowDto(
                g.Key,
                Attempts: g.Count(IsContact),
                Reached: g.Count(Reached),
                Done: g.Count(a => a.NextStatus == ContactStatuses.Done),
                Callback: g.Count(a => a.NextStatus == ContactStatuses.Callback && IsContact(a)),
                Failed: g.Count(a => a.NextStatus == ContactStatuses.Failed)))
            .Where(r => r.Attempts > 0 || r.Done > 0 || r.Failed > 0)
            .OrderByDescending(r => r.Attempts).ThenBy(r => r.ActorName)
            .ToList();

        var byResult = ContactService.Results
            .Select(r => new ContactResultRowDto(r.Key, r.Label,
                attempts.Count(a => IsContact(a) && a.Result == r.Key)))
            .Where(r => r.Count > 0)
            .ToList();

        // SABABLAR — talab OCHILGAN sana bo'yicha (urinish emas): "qaysi sabab bilan kelgan".
        var requests = await db.ContactRequests.AsNoTracking()
            .Where(c => c.CreatedAt.Length >= 10
                        && string.Compare(c.CreatedAt.Substring(0, 10), fromDate) >= 0
                        && string.Compare(c.CreatedAt.Substring(0, 10), toDate) <= 0)
            .ToListAsync();

        var byReason = requests
            .GroupBy(c => c.ReasonLabel.Length > 0 ? c.ReasonLabel : "— sababsiz —")
            .Select(g => new ContactReasonRowDto(
                g.Key,
                Created: g.Count(),
                Done: g.Count(c => c.Status == ContactStatuses.Done),
                Failed: g.Count(c => c.Status == ContactStatuses.Failed),
                Open: g.Count(c => ContactService.IsOpen(c.Status))))
            .OrderByDescending(r => r.Created).ThenBy(r => r.ReasonLabel)
            .ToList();

        var todayKey = today.ToString("yyyy-MM-dd");
        var openNow = await db.ContactRequests.CountAsync(
            c => c.Status == ContactStatuses.New || c.Status == ContactStatuses.Callback);
        var overdueNow = await db.ContactRequests.CountAsync(
            c => c.Status == ContactStatuses.Callback && c.DueDate != ""
                 && string.Compare(c.DueDate, todayKey) < 0);

        return new ContactStatsDto(
            fromDate, toDate,
            Created: attempts.Count(a => a.Type == ContactAttemptTypes.Created),
            Attempts: attempts.Count(IsContact),
            Reached: attempts.Count(Reached),
            Done: attempts.Count(a => a.NextStatus == ContactStatuses.Done),
            Callback: attempts.Count(a => a.NextStatus == ContactStatuses.Callback && IsContact(a)),
            Failed: attempts.Count(a => a.NextStatus == ContactStatuses.Failed),
            OpenNow: openNow, OverdueNow: overdueNow,
            Daily: daily, ByStaff: byStaff, ByReason: byReason, ByResult: byResult,
            // JAVOBLAR TAHLILI — eng ko'p uchragan so'zlar. Qoida `ContactService.TopWords` da
            // (sof funksiya, testlangan): bir matnda takrorlangan so'z BIR marta sanaladi.
            TopWords: ContactService
                .TopWords(attempts.Where(IsContact).Select(a => a.Response), 25)
                .Select(w => new ContactWordDto(w.Word, w.Count)).ToList(),
            WithResponse: attempts.Count(a => IsContact(a) && a.Response.Length > 0));
    }

    /// <summary>
    /// JAVOBLAR LENTASI — "javobi nima dedi" matnlarini o'qish uchun. Hisobotdagi sonlar
    /// "nechta" ga javob beradi, bu esa "NIMA deyilgan" ga.
    /// </summary>
    /// <param name="result">Natija kaliti bo'yicha filtr (answered / no_answer / ...).</param>
    /// <param name="q">Javob matni ichidan qidiruv.</param>
    [HttpGet("responses")]
    public async Task<ActionResult<IEnumerable<ContactResponseRowDto>>> Responses(
        [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? result,
        [FromQuery] string? actor, [FromQuery] string? q, [FromQuery] int limit = 200)
    {
        var query = db.ContactAttempts.AsNoTracking()
            // Faqat HAQIQIY bog'lanish urinishlari va faqat MATN yozilganlari — bo'sh qatorlar
            // lentani suyultirib, o'qishni qiyinlashtirardi.
            .Where(a => a.Type == ContactAttemptTypes.Contact && a.Response != "");

        if (!string.IsNullOrWhiteSpace(from)) query = query.Where(a => string.Compare(a.Date, from) >= 0);
        if (!string.IsNullOrWhiteSpace(to)) query = query.Where(a => string.Compare(a.Date, to) <= 0);
        if (!string.IsNullOrWhiteSpace(result)) query = query.Where(a => a.Result == result);
        if (!string.IsNullOrWhiteSpace(actor)) query = query.Where(a => a.ActorName == actor);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLower();
            query = query.Where(a => a.Response.ToLower().Contains(needle));
        }

        var rows = await query
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync();

        // Talab ma'lumoti (o'quvchi ismi, sabab) — bitta so'rovda biriktiriladi (N+1 emas).
        var requestIds = rows.Select(r => r.RequestId).Distinct().ToList();
        var requests = await db.ContactRequests.AsNoTracking()
            .Where(c => requestIds.Contains(c.Id))
            .Select(c => new { c.Id, c.StudentName, c.ReasonLabel })
            .ToDictionaryAsync(c => c.Id);

        return rows.Select(a =>
        {
            var req = requests.GetValueOrDefault(a.RequestId);
            return new ContactResponseRowDto(
                a.Id, a.RequestId, a.StudentId, req?.StudentName ?? "",
                req?.ReasonLabel ?? "", a.Result, ContactService.ResultLabel(a.Result),
                a.NextStatus, ContactService.StatusLabel(a.NextStatus),
                a.Response, a.ActorName, a.CreatedAt);
        }).ToList();
    }

    /* =========================================================================================
     *  Yordamchilar
     * ====================================================================================== */

    /// <summary>O'quvchi id → bog'lanish uchun raqamlar (o'zi + ota-ona), takrorsiz va bo'shsiz.</summary>
    private async Task<Dictionary<string, List<string>>> PhonesAsync(List<string> studentIds)
    {
        if (studentIds.Count == 0) return new Dictionary<string, List<string>>();
        var rows = await db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .Select(s => new { s.Id, s.Phone, s.ParentPhone, s.FatherPhone, s.MotherPhone })
            .ToListAsync();
        return rows.ToDictionary(
            r => r.Id,
            r => new[] { r.Phone, r.ParentPhone, r.FatherPhone, r.MotherPhone }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim())
                .Distinct()
                .ToList());
    }

    private static ContactRequestDto ToDto(
        ContactRequest c, string today, Dictionary<string, List<string>> phones,
        List<ContactAttempt>? history = null) =>
        new(
            c.Id, c.StudentId, c.StudentName,
            c.ReasonId, c.ReasonLabel, c.Note,
            c.Status, ContactService.StatusLabel(c.Status), c.DueDate,
            ContactService.IsOverdue(c.Status, c.DueDate, today),
            c.AttemptCount, c.LastResponse, c.LastActorName, c.LastActionAt,
            c.CreatedAt, c.CreatedBy, c.ClosedAt, c.ClosedBy,
            phones.GetValueOrDefault(c.StudentId) ?? new List<string>(),
            history?.Select(a => new ContactAttemptDto(
                a.Id, a.Type, a.Result, ContactService.ResultLabel(a.Result), a.Response,
                a.NextStatus, ContactService.StatusLabel(a.NextStatus), a.DueDate,
                a.ActorName, a.CreatedAt)).ToList());
}
