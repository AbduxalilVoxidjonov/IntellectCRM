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

    /// <summary>Barcha qo'ng'iroqlar (eng oxirgisi tepada) — "Yozuvlar tarixi" bo'limi uchun.</summary>
    [HttpGet]
    public async Task<ActionResult<CallListDto>> List(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = db.Calls.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            var sids = await db.Students
                .Where(x => x.FullName.ToLower().Contains(s))
                .Select(x => x.Id).ToListAsync();
            q = q.Where(c => c.PhoneNumber.Contains(s) || (c.StudentId != null && sids.Contains(c.StudentId)));
        }

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(c => c.StartedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new CallListDto(total, await ToDtosAsync(items));
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
                return NotFound(new { message = "Yozuvni provayderdan olib bo'lmadi" });
            var mediaType = resp.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
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
