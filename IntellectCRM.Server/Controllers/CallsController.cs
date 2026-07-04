using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Call Center — Asterisk (AMI) orqali chiquvchi qo'ng'iroq va qo'ng'iroqlar jurnali.
/// Oqim: POST originate → AsteriskService (AMI Originate: avval operator kanali, keyin dialplan
/// GSM gateway orqali raqamga teradi) → Call yozuvi "originating". Holat yangilanishi (ringing/
/// answered/completed) — keyingi bosqichda AMI eventlari + SignalR bilan.
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("calls")]
[Route("api/admin/calls")]
public class CallsController(
    AppDbContext db, AsteriskService asterisk, MoiZvonkiService moizvonki,
    MoiZvonkiCallSyncService callSync,
    IConfiguration config, IHttpClientFactory httpFactory) : ControllerBase
{
    private string Uid => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";

    /// <summary>Faol telefoniya provayderi: MoiZvonki birinchi (sozlangan bo'lsa), keyin Asterisk.</summary>
    private string Provider =>
        moizvonki.IsConfigured ? "moizvonki" : asterisk.IsConfigured ? "asterisk" : "";

    /// <summary>Frontend uchun modul holati: telefoniya sozlanganmi + qaysi provayder.</summary>
    [HttpGet("config")]
    public ActionResult<object> Config() => Ok(new
    {
        configured = Provider.Length > 0,
        provider = Provider,
        defaultOperatorExtension = asterisk.DefaultOperatorExtension,
    });

    /// <summary>
    /// MoiZvonki webhook obunasini qo'lda ishga tushirish (superadmin diagnostikasi):
    /// bizning webhook URL provayderga ro'yxatdan o'tkaziladi, provayderning XOM javobi
    /// qaytariladi (sxema mos kelmasa shu yerda ko'rinadi). URL App:Host'dan quriladi.
    /// </summary>
    [HttpPost("telephony/subscribe")]
    [Authorize(Roles = "superadmin")]
    public async Task<ActionResult> SubscribeTelephonyWebhooks()
    {
        if (!moizvonki.IsConfigured)
            return StatusCode(503, new { message = "MoiZvonki sozlanmagan (MoiZvonki__Enabled/Domain/UserName/ApiKey)" });
        var host = config["App:Host"] ?? "";
        if (host.Length == 0)
            return BadRequest(new { message = "App:Host (APP_HOST env) sozlanmagan — webhook URL qurib bo'lmaydi" });
        var url = $"https://{host}/api/telephony/moizvonki/{moizvonki.WebhookSecret}";
        var (ok, body) = await moizvonki.SubscribeWebhooksAsync(url);
        return Ok(new { ok, url, providerResponse = body });
    }

    /// <summary>
    /// Chiquvchi qo'ng'iroq. Body: studentId YOKI phoneNumber (dialpad). OperatorExtension
    /// berilmasa Asterisk:DefaultOperatorExtension ishlatiladi. Qo'lda terilgan raqam o'quvchiga
    /// tegishli bo'lsa (telefonlari bo'yicha moslash) — tarix o'sha o'quvchiga bog'lanadi.
    /// </summary>
    [HttpPost("originate")]
    public async Task<ActionResult> Originate(OriginateCallRequest req)
    {
        if (Provider.Length == 0)
            return StatusCode(503, new { message = "Telefoniya sozlanmagan — MoiZvonki (MoiZvonki__Enabled/Domain/UserName/ApiKey) yoki Asterisk (Asterisk__Enabled/Host/Username) bering" });

        // 1) Raqam va (iloji bo'lsa) o'quvchini aniqlash.
        string phone;
        Student? student = null;

        if (!string.IsNullOrWhiteSpace(req.StudentId))
        {
            student = await db.Students.FindAsync(req.StudentId);
            if (student is null) return NotFound(new { message = "O'quvchi topilmadi" });
            var candidate = new[] { student.Phone, student.ParentPhone, student.FatherPhone, student.MotherPhone }
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
            if (candidate is null)
                return BadRequest(new { message = "O'quvchida telefon raqam kiritilmagan" });
            phone = PhoneUtil.Normalize(candidate);
        }
        else
        {
            var (valid, normalized, error) = PhoneUtil.Validate(req.PhoneNumber);
            if (!valid) return BadRequest(new { message = error ?? "Telefon raqam noto'g'ri" });
            phone = normalized;
            // Qo'lda terilgan raqam bazadagi o'quvchiga tegishlimi? (tarix bog'lash uchun)
            student = await db.Students.FirstOrDefaultAsync(s =>
                s.Phone == phone || s.ParentPhone == phone || s.FatherPhone == phone || s.MotherPhone == phone);
        }

        // 2) Provayderga xos talab: Asterisk'da operator ichki (SIP) raqami majburiy
        //    (MoiZvonki'da qo'ng'iroq konfiguratsiyadagi akkaunt telefonidan chiqadi).
        var ext = "";
        if (Provider == "asterisk")
        {
            ext = string.IsNullOrWhiteSpace(req.OperatorExtension)
                ? asterisk.DefaultOperatorExtension
                : req.OperatorExtension.Trim();
            if (string.IsNullOrWhiteSpace(ext))
                return BadRequest(new { message = "Operator ichki (SIP) raqami berilmagan — operatorExtension yoki Asterisk:DefaultOperatorExtension" });
        }

        // 3) Jurnal yozuvi + qo'ng'iroq buyrug'i.
        var call = new Call
        {
            StudentId = student?.Id,
            OperatorUserId = Uid.Length > 0 ? Uid : null,
            PhoneNumber = phone,
            Direction = "outbound",
            Status = "originating",
        };
        db.Calls.Add(call);
        await db.SaveChangesAsync();

        var (ok, message) = Provider == "moizvonki"
            ? await moizvonki.MakeCallAsync(new string(phone.Where(char.IsDigit).ToArray()))
            : await asterisk.OriginateAsync(phone, ext, call.Id);
        if (!ok)
        {
            call.Status = "failed";
            call.EndedAt = AppClock.Now;
            call.Note = message;
            await db.SaveChangesAsync();
            return StatusCode(502, new { message, callId = call.Id });
        }

        return Ok(new { callId = call.Id, status = call.Status, phoneNumber = phone, studentId = student?.Id });
    }

    /// <summary>
    /// Qo'ng'iroqlar tarixini provayderdan QO'LDA sinxronlash (calls.list) — "Yozuvlar tarixi"
    /// tabidagi "Yangilash" tugmasi. Davriy avto-sinxron baribir 5 daqiqada yuradi; bu darhol ko'rish uchun.
    /// </summary>
    [HttpPost("telephony/sync")]
    public async Task<ActionResult> SyncTelephonyHistory()
    {
        if (!moizvonki.IsConfigured)
            return StatusCode(503, new { message = "MoiZvonki sozlanmagan" });
        var (added, updated) = await callSync.SyncOnceAsync(HttpContext.RequestAborted);
        return Ok(new { added, updated });
    }

    /// <summary>Umumiy filtrlar: sana oralig'i (yyyy-MM-dd), yo'nalish, holat, aniq raqam.</summary>
    private static IQueryable<Call> ApplyFilters(
        IQueryable<Call> q, string? phone, string? dateFrom, string? dateTo, string? direction, string? status)
    {
        if (!string.IsNullOrWhiteSpace(phone))
            q = q.Where(c => c.PhoneNumber == phone);
        if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var df))
            q = q.Where(c => c.StartedAt >= df);
        if (!string.IsNullOrWhiteSpace(dateTo) && DateTime.TryParse(dateTo, out var dt))
            q = q.Where(c => c.StartedAt < dt.AddDays(1)); // kun oxirigacha inklyuziv
        if (direction is "inbound" or "outbound")
            q = q.Where(c => c.Direction == direction);
        if (status == "answered")
            q = q.Where(c => c.AnsweredAt != null);
        else if (status == "missed")
            q = q.Where(c => c.AnsweredAt == null && c.EndedAt != null);
        return q;
    }

    /// <summary>Ism/raqam qidiruvi (raqam contains, ism — Students orqali).</summary>
    private async Task<IQueryable<Call>> ApplySearchAsync(IQueryable<Call> q, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return q;
        var s = search.Trim().ToLower();
        var sids = await db.Students
            .Where(x => x.FullName.ToLower().Contains(s))
            .Select(x => x.Id).ToListAsync();
        return q.Where(c => c.PhoneNumber.Contains(s) || (c.StudentId != null && sids.Contains(c.StudentId)));
    }

    /// <summary>Barcha qo'ng'iroqlar (eng oxirgisi tepada). <paramref name="phone"/> berilsa —
    /// faqat shu raqam bilan suhbatlar (guruh qatori ichini ochish uchun).</summary>
    [HttpGet]
    public async Task<ActionResult<CallListDto>> List(
        [FromQuery] string? search, [FromQuery] string? phone,
        [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        [FromQuery] string? direction, [FromQuery] string? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = ApplyFilters(db.Calls.AsNoTracking(), phone, dateFrom, dateTo, direction, status);
        q = await ApplySearchAsync(q, search);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(c => c.StartedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new CallListDto(total, await ToDtosAsync(items));
    }

    /// <summary>
    /// RAQAM BO'YICHA guruhlangan tarix: har raqam bitta qator (nechta qo'ng'iroq, oxirgisi
    /// qachon/holati, jami gaplashuv). Qator ochilganda <see cref="List"/> phone= bilan chaqiriladi.
    /// </summary>
    [HttpGet("by-number")]
    public async Task<ActionResult<CallGroupListDto>> ByNumber(
        [FromQuery] string? search,
        [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        [FromQuery] string? direction, [FromQuery] string? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = ApplyFilters(db.Calls.AsNoTracking(), null, dateFrom, dateTo, direction, status);
        q = await ApplySearchAsync(q, search);

        var grouped = q.GroupBy(c => c.PhoneNumber).Select(g => new
        {
            Phone = g.Key,
            Count = g.Count(),
            Answered = g.Count(c => c.AnsweredAt != null),
            TotalDuration = g.Sum(c => c.DurationSeconds),
            LastAt = g.Max(c => c.StartedAt),
        });

        var total = await grouped.CountAsync();
        var pageRows = await grouped.OrderByDescending(x => x.LastAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var phones = pageRows.Select(x => x.Phone).ToList();

        // Sahifadagi raqamlarning qo'ng'iroqlari — oxirgi holat + o'quvchi nomi uchun
        // (bitta so'rov, keyin xotirada eng so'nggisi olinadi).
        var meta = await db.Calls.AsNoTracking()
            .Where(c => phones.Contains(c.PhoneNumber))
            .Select(c => new { c.PhoneNumber, c.StartedAt, c.Status, c.Direction, c.StudentId })
            .ToListAsync();
        var lastByPhone = meta.GroupBy(m => m.PhoneNumber)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.StartedAt).First());
        var studentByPhone = meta.Where(m => m.StudentId != null)
            .GroupBy(m => m.PhoneNumber)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.StartedAt).First(m => m.StudentId != null).StudentId!);
        var studentIds = studentByPhone.Values.Distinct().ToList();
        var studentNames = await db.Students.Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);

        var items = pageRows.Select(x =>
        {
            var last = lastByPhone.GetValueOrDefault(x.Phone);
            var sid = studentByPhone.GetValueOrDefault(x.Phone);
            return new CallGroupDto(
                x.Phone, sid,
                sid != null ? studentNames.GetValueOrDefault(sid, "") : "",
                x.Count, x.Answered, x.TotalDuration,
                x.LastAt.ToString("yyyy-MM-ddTHH:mm:ss"),
                last?.Status ?? "", last?.Direction ?? "");
        }).ToList();

        return new CallGroupListDto(total, items);
    }

    /// <summary>Bitta o'quvchining qo'ng'iroqlar tarixi (detalli oynadagi tab).</summary>
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<List<CallDto>>> ByStudent(string studentId)
    {
        var items = await db.Calls.AsNoTracking()
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.StartedAt)
            .Take(200).ToListAsync();
        return await ToDtosAsync(items);
    }

    /// <summary>
    /// Suhbat yozuvini eshittirish. DIQQAT: yozuvlar ATAYIN /uploads (ochiq statik) ostida EMAS —
    /// faqat shu autentifikatsiyalangan endpoint orqali beriladi. Fayl Asterisk:RecordingsPath
    /// papkasidan olinadi (dialplan MixMonitor {callId}.wav nomlashi kutiladi).
    /// </summary>
    [HttpGet("{id}/recording")]
    public async Task<IActionResult> Recording(string id)
    {
        var call = await db.Calls.FindAsync(id);
        if (call is null) return NotFound();

        // MoiZvonki: yozuv to'liq URL bo'lib keladi — provayderdan oqim qilib uzatamiz
        // (proxy: havola brauzerga oshkor bo'lmaydi, auth bizning tomonda qoladi).
        if (call.RecordingFile.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            var http = httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(60);
            var resp = await http.GetAsync(call.RecordingFile, HttpCompletionOption.ResponseHeadersRead);
            if (!resp.IsSuccessStatusCode)
                return NotFound(new { message = $"Yozuvni provayderdan olib bo'lmadi (HTTP {(int)resp.StatusCode})" });
            var mediaType = resp.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
            // Provayder audio o'rniga sahifa/xato qaytarsa (himoyalangan havola) — aniq xabar,
            // pleyerga HTML berib "jim ishlamaslik" holatiga tushmaymiz.
            if (mediaType.StartsWith("text/") || mediaType.Contains("html"))
                return NotFound(new { message = "Provayder yozuv o'rniga sahifa qaytardi — havola himoyalangan bo'lishi mumkin" });
            return File(await resp.Content.ReadAsStreamAsync(), mediaType);
        }

        var dir = config["Asterisk:RecordingsPath"] ?? "";
        if (dir.Length == 0)
            return NotFound(new { message = "Yozuvlar papkasi sozlanmagan (Asterisk:RecordingsPath)" });

        // Fayl nomi DBdan; bo'sh bo'lsa konvensiya bo'yicha izlanadi ({callId}.wav ...).
        var candidates = call.RecordingFile.Length > 0
            ? new[] { call.RecordingFile }
            : new[] { $"{call.Id}.wav", $"{call.Id}.mp3", $"{call.Id}.ogg", $"{call.Id}.gsm" };

        foreach (var name in candidates)
        {
            var full = Path.GetFullPath(Path.Combine(dir, name));
            // Path traversal himoyasi — fayl faqat recordings papkasi ichidan.
            if (!full.StartsWith(Path.GetFullPath(dir), StringComparison.OrdinalIgnoreCase)) continue;
            if (!System.IO.File.Exists(full)) continue;

            if (call.RecordingFile.Length == 0)
            {
                call.RecordingFile = name;
                await db.SaveChangesAsync();
            }
            var ct = Path.GetExtension(full).ToLowerInvariant() switch
            {
                ".mp3" => "audio/mpeg",
                ".ogg" => "audio/ogg",
                _ => "audio/wav",
            };
            return PhysicalFile(full, ct, enableRangeProcessing: true);
        }

        return NotFound(new { message = "Yozuv fayli topilmadi" });
    }

    private async Task<List<CallDto>> ToDtosAsync(List<Call> items)
    {
        var studentIds = items.Where(c => c.StudentId != null).Select(c => c.StudentId!).Distinct().ToList();
        var operatorIds = items.Where(c => c.OperatorUserId != null).Select(c => c.OperatorUserId!).Distinct().ToList();
        var studentNames = await db.Students.Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);
        var operatorNames = await db.Users.Where(u => operatorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        static string Iso(DateTime d) => d.ToString("yyyy-MM-ddTHH:mm:ss");
        return items.Select(c => new CallDto(
            c.Id, c.StudentId,
            c.StudentId != null ? studentNames.GetValueOrDefault(c.StudentId, "") : "",
            c.PhoneNumber, c.Direction, c.Status,
            Iso(c.StartedAt),
            c.AnsweredAt is { } a ? Iso(a) : null,
            c.EndedAt is { } e ? Iso(e) : null,
            c.DurationSeconds,
            c.OperatorUserId != null ? operatorNames.GetValueOrDefault(c.OperatorUserId, "") : "",
            c.RecordingFile.Length > 0,
            c.Note)).ToList();
    }
}
