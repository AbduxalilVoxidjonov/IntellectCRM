using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using IntellectCRM.Infrastructure.Auth;
using IntellectCRM.Infrastructure.Data;

namespace IntellectCRM.Server.Controllers.Cti;

/// <summary>
/// CTI (Local Call) OPERATOR API — admin panel (React) uchun. Agentlarni boshqaradi, tarixni
/// ko'radi, click-to-call qiladi VA agent telefonining SIM-kartasidan ixtiyoriy SMS yuboradi
/// (ikkalasi ham WebSocket, oflaynda FCM+poll). Ruxsat: <see cref="AdminPermAttribute"/>
/// "calls" (Call Center bilan bir bo'lim).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("calls")]
[Route("api/cti")]
public class CtiController(
    AppDbContext db, CtiConnectionManager conn, FcmService fcm, CtiSmsService ctiSms,
    IConfiguration config, IWebHostEnvironment env) : ControllerBase
{
    // ---------- Agentlar ----------

    /// <summary>Barcha agentlar — <c>isOnline</c> JONLI (konnektsiya menejeridan, DB emas).</summary>
    [HttpGet("agents")]
    public async Task<ActionResult<List<CtiAgentDto>>> Agents()
    {
        var agents = await db.CtiAgents.AsNoTracking().OrderBy(a => a.DisplayName).ToListAsync();
        return agents.Select(a => new CtiAgentDto(
            a.Id, a.Login, a.DisplayName, a.IsActive,
            conn.IsConnected(a.Id),
            a.LastSeenAt is { } t ? t.ToString("yyyy-MM-ddTHH:mm:ss") : null,
            a.FcmToken.Length > 0)).ToList();
    }

    /// <summary>Yangi agent yaratadi (login band bo'lmasligi tekshiriladi).</summary>
    [HttpPost("agents")]
    public async Task<ActionResult> CreateAgent(CtiAgentCreateRequest req)
    {
        var login = (req.Login ?? "").Trim();
        if (login.Length == 0 || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Login va parol majburiy" });
        if (await db.CtiAgents.AnyAsync(a => a.Login == login))
            return BadRequest(new { message = "Bu login band" });

        var agent = new CtiAgent
        {
            Login = login,
            PasswordHash = PasswordHasher.Hash(req.Password),
            DisplayName = (req.DisplayName ?? "").Trim(),
        };
        db.CtiAgents.Add(agent);
        await db.SaveChangesAsync();
        return Ok(new { id = agent.Id });
    }

    /// <summary>Agentni tahrirlaydi (parol bo'sh/null bo'lsa o'zgarmaydi).</summary>
    [HttpPut("agents/{id}")]
    public async Task<ActionResult> UpdateAgent(string id, CtiAgentUpdateRequest req)
    {
        var agent = await db.CtiAgents.FirstOrDefaultAsync(a => a.Id == id);
        if (agent is null) return NotFound();

        agent.DisplayName = (req.DisplayName ?? "").Trim();
        agent.IsActive = req.IsActive;
        if (!string.IsNullOrWhiteSpace(req.Password))
            agent.PasswordHash = PasswordHasher.Hash(req.Password);
        await db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Click-to-call: agent telefoniga <c>dial</c> buyrug'ini yuboradi. WS ulangan bo'lsa darhol;
    /// aks holda FCM data-push bilan uyg'otib, ~6 soniya WS ulanishini kutadi (500ms interval).
    /// </summary>
    [HttpPost("agents/{id}/dial")]
    public async Task<ActionResult<CtiDialResponse>> Dial(string id, CtiDialRequest req)
    {
        var agent = await db.CtiAgents.FirstOrDefaultAsync(a => a.Id == id);
        if (agent is null) return NotFound();
        var number = NormalizePhone(req.Number ?? "");
        if (number.Length == 0) return BadRequest(new { message = "Raqam bo'sh" });

        var commandId = Guid.NewGuid().ToString();
        var cmd = new CtiCommandLog { AgentId = id, Action = "dial", Payload = number, Status = "pending" };
        db.CtiCommandLogs.Add(cmd);
        await db.SaveChangesAsync();

        object DialMsg() => new { action = "dial", number, commandId };

        // 1) WS ulangan — darhol yuboramiz.
        if (conn.IsConnected(id) && await conn.SendAsync(id, DialMsg()))
        {
            cmd.Status = "sent";
            await db.SaveChangesAsync();
            return new CtiDialResponse(commandId, true);
        }

        // 2) Oflayn — FCM bilan uyg'otamiz, so'ng WS ulanishini poll qilamiz.
        if (agent.FcmToken.Length > 0)
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync();
            var json = meta?.FcmServiceAccountJson ?? "";
            await fcm.SendDataAsync(json, agent.FcmToken, new Dictionary<string, string>
            {
                ["action"] = "dial",
                ["number"] = number,
                ["commandId"] = commandId,
            }, HttpContext.RequestAborted);

            // ~6 soniya: ilova uyg'onib WS ulansa dial yuboramiz.
            for (var i = 0; i < 12; i++)
            {
                await Task.Delay(500, HttpContext.RequestAborted);
                if (conn.IsConnected(id) && await conn.SendAsync(id, DialMsg()))
                {
                    cmd.Status = "sent";
                    await db.SaveChangesAsync();
                    return new CtiDialResponse(commandId, true);
                }
            }
        }

        cmd.Status = "failed";
        await db.SaveChangesAsync();
        return new CtiDialResponse(commandId, false);
    }

    /// <summary>
    /// Agent telefonining SIM-kartasidan ixtiyoriy matnli SMS yuborish: <c>send_sms</c> buyrug'i.
    /// Yetkazish oqimi <see cref="Dial"/> bilan bir xil (WS ulangan bo'lsa darhol, aks holda FCM
    /// data-push bilan uyg'otib ~6 soniya kutadi) — <see cref="CtiSmsService"/>ga delegatsiya qilinadi,
    /// shu bilan bu yerdan yuborilgan SMS ham umumiy SMS Tarix (SmsLog, Provider=local)da ko'rinadi.
    /// </summary>
    [HttpPost("agents/{id}/sms")]
    public async Task<ActionResult<CtiSmsResponse>> SendSms(string id, CtiSmsRequest req)
    {
        if (await db.CtiAgents.FindAsync(id) is null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.Number)) return BadRequest(new { message = "Raqam bo'sh" });
        var text = (req.Text ?? "").Trim();
        if (text.Length == 0) return BadRequest(new { message = "SMS matni bo'sh" });
        if (text.Length > 1000) return BadRequest(new { message = "SMS matni juda uzun (max 1000 belgi)" });

        var r = await ctiSms.SendSmsAsync(db, id, req.Number, text, ct: HttpContext.RequestAborted);
        return new CtiSmsResponse(r.CommandId, r.Ok);
    }

    // ---------- Qo'ng'iroqlar tarixi ----------

    /// <summary>CTI qo'ng'iroqlar tarixi — filtr (agent/yo'nalish/sana/qidiruv/aniq raqam), sahifalash.</summary>
    [HttpGet("calls")]
    public async Task<ActionResult<CtiCallListDto>> Calls(
        [FromQuery] string? agentId, [FromQuery] string? direction,
        [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        [FromQuery] string? search, [FromQuery] string? number,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = FilteredCalls(agentId, direction, dateFrom, dateTo, search, number);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(c => c.StartedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var (agentNames, studentNames) = await LookupNamesAsync(items);
        static string Iso(DateTime d) => d.ToString("yyyy-MM-ddTHH:mm:ss");
        var dtos = items.Select(c => new CtiCallDto(
            c.Id, c.AgentId, agentNames.GetValueOrDefault(c.AgentId, ""),
            c.Direction, c.RemoteNumber, c.ContactName,
            c.StudentId, c.StudentId != null ? studentNames.GetValueOrDefault(c.StudentId, "") : "",
            Iso(c.StartedAt), c.AnsweredAt is { } a ? Iso(a) : null, c.EndedAt is { } e ? Iso(e) : null,
            c.DurationSec, c.AudioUploaded && c.AudioPath.Length > 0, c.Note)).ToList();

        return new CtiCallListDto(total, dtos);
    }

    /// <summary>
    /// Qo'ng'iroqlar RAQAM bo'yicha guruhlangan tarixi — har raqam BITTA qator: jami/o'tkazib
    /// yuborilgan soni + oxirgi qo'ng'iroq ma'lumotlari. Filtrlar oddiy tarix bilan bir xil.
    /// Raqam bosilganda uning barcha qo'ng'iroqlari <c>GET calls?number=...</c> bilan olinadi.
    /// </summary>
    [HttpGet("calls/grouped")]
    public async Task<ActionResult<CtiNumberGroupListDto>> CallsGrouped(
        [FromQuery] string? agentId, [FromQuery] string? direction,
        [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = FilteredCalls(agentId, direction, dateFrom, dateTo, search, number: null);

        // 1) Raqam bo'yicha agregatlar (oxirgi qo'ng'iroq vaqti bo'yicha kamayish tartibida sahifalanadi).
        var total = await q.Select(c => c.RemoteNumber).Distinct().CountAsync();
        var groups = await q.GroupBy(c => c.RemoteNumber)
            .Select(g => new
            {
                Number = g.Key,
                Count = g.Count(),
                Missed = g.Count(c => c.Direction == "missed"),
                HasAudio = g.Any(c => c.AudioUploaded && c.AudioPath.Length > 0),
                LastAt = g.Max(c => c.StartedAt),
            })
            .OrderByDescending(x => x.LastAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        // 2) Sahifadagi raqamlarning OXIRGI qo'ng'iroq satri (yo'nalish/agent/o'quvchi nomi uchun).
        var numbers = groups.Select(x => x.Number).ToList();
        var lastCalls = await q.Where(c => numbers.Contains(c.RemoteNumber))
            .GroupBy(c => c.RemoteNumber)
            .Select(g => g.OrderByDescending(c => c.StartedAt).First())
            .ToListAsync();
        var lastByNumber = lastCalls.ToDictionary(c => c.RemoteNumber);
        var (agentNames, studentNames) = await LookupNamesAsync(lastCalls);

        static string Iso(DateTime d) => d.ToString("yyyy-MM-ddTHH:mm:ss");
        var items = groups.Select(x =>
        {
            var last = lastByNumber.GetValueOrDefault(x.Number);
            return new CtiNumberGroupDto(
                x.Number,
                last?.ContactName ?? "",
                last?.StudentId,
                last?.StudentId != null ? studentNames.GetValueOrDefault(last.StudentId, "") : "",
                x.Count, x.Missed, x.HasAudio,
                Iso(x.LastAt),
                last?.Direction ?? "outgoing",
                last?.DurationSec ?? 0,
                last != null ? agentNames.GetValueOrDefault(last.AgentId, "") : "");
        }).ToList();

        return new CtiNumberGroupListDto(total, items);
    }

    /// <summary>Bitta CTI qo'ng'irog'ining to'liq tafsiloti (hodisalar bilan).</summary>
    [HttpGet("calls/{id}")]
    public async Task<ActionResult<CtiCallDetailDto>> CallDetail(string id)
    {
        var c = await db.CtiCallRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();

        var agentName = await db.CtiAgents.Where(a => a.Id == c.AgentId)
            .Select(a => a.DisplayName).FirstOrDefaultAsync() ?? "";
        var studentName = c.StudentId != null
            ? await db.Students.Where(s => s.Id == c.StudentId).Select(s => s.FullName).FirstOrDefaultAsync() ?? ""
            : "";
        var events = await db.CtiCallEvents.AsNoTracking()
            .Where(e => e.CallId == id).OrderBy(e => e.At).ToListAsync();

        static string Iso(DateTime d) => d.ToString("yyyy-MM-ddTHH:mm:ss");
        return new CtiCallDetailDto(
            c.Id, c.AgentId, agentName, c.Direction, c.RemoteNumber, c.ContactName,
            c.StudentId, studentName,
            Iso(c.StartedAt), c.AnsweredAt is { } a ? Iso(a) : null, c.EndedAt is { } e ? Iso(e) : null,
            c.DurationSec, c.AudioUploaded && c.AudioPath.Length > 0, c.Note,
            events.Select(ev => new CtiCallEventDto(ev.Type, Iso(ev.At))).ToList());
    }

    /// <summary>Qo'ng'iroq audio yozuvini eshittiradi (recordings papkasidan, range qo'llab-quvvatlanadi).
    /// Path-traversal himoyasi: fayl faqat papka ICHIDAN beriladi.</summary>
    [HttpGet("calls/{id}/audio")]
    public async Task<IActionResult> Audio(string id)
    {
        var c = await db.CtiCallRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c is null || !c.AudioUploaded || c.AudioPath.Length == 0)
            return NotFound(new { message = "Yozuv mavjud emas" });

        var dir = RecordingsDir();
        var fileName = Path.GetFileName(c.AudioPath); // faqat nom — path-traversal yo'q
        var full = Path.GetFullPath(Path.Combine(dir, fileName));
        // Fayl AYNAN papka ichida ekanini tasdiqlaymiz.
        if (!full.StartsWith(Path.GetFullPath(dir) + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            || !System.IO.File.Exists(full))
            return NotFound(new { message = "Yozuv fayli topilmadi" });

        return PhysicalFile(full, ContentType(Path.GetExtension(full)), enableRangeProcessing: true);
    }

    /// <summary>Operator izohini yangilaydi.</summary>
    [HttpPut("calls/{id}/note")]
    public async Task<IActionResult> UpdateNote(string id, CtiNoteRequest req)
    {
        var affected = await db.CtiCallRecords.Where(c => c.Id == id)
            .ExecuteUpdateAsync(up => up.SetProperty(c => c.Note, (req.Note ?? "").Trim()));
        return affected > 0 ? Ok() : NotFound();
    }

    // ---------- Yordamchi ----------

    /// <summary>Terilayotgan raqamni xalqaro formatga keltiradi: O'zbekiston uchun <c>+998</c> kodi bilan
    /// (ilova qo'ng'iroq qilishi uchun oldida <c>+</c> shart). 9-xonali lokal raqam → <c>+998XXXXXXXXX</c>;
    /// <c>998</c> bilan boshlansa yoki boshqa formatda — shunchaki <c>+</c> qo'shiladi.</summary>
    private static string NormalizePhone(string raw)
    {
        var digits = new string((raw ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length == 0) return "";
        if (digits.StartsWith("998")) return "+" + digits;
        if (digits.Length == 10 && digits.StartsWith("0")) digits = digits[1..];
        if (digits.Length == 9) return "+998" + digits;
        return "+" + digits;
    }

    /// <summary>Tarix so'rovlarining UMUMIY filtri (oddiy va guruhlangan ro'yxat bir xil ishlaydi).
    /// <paramref name="number"/> — aniq raqam (guruh ichini ochish uchun).</summary>
    private IQueryable<CtiCallRecord> FilteredCalls(
        string? agentId, string? direction, string? dateFrom, string? dateTo, string? search, string? number)
    {
        var q = db.CtiCallRecords.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(agentId)) q = q.Where(c => c.AgentId == agentId);
        if (direction is "incoming" or "outgoing" or "missed") q = q.Where(c => c.Direction == direction);
        if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var df))
            q = q.Where(c => c.StartedAt >= df);
        if (!string.IsNullOrWhiteSpace(dateTo) && DateTime.TryParse(dateTo, out var dt))
            q = q.Where(c => c.StartedAt < dt.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => c.RemoteNumber.Contains(s) || c.ContactName.Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(number))
        {
            var n = number.Trim();
            q = q.Where(c => c.RemoteNumber == n);
        }
        return q;
    }

    private string RecordingsDir()
    {
        var configured = config["Cti:RecordingsPath"];
        var dir = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "recordings", "cti")
            : configured;
        Directory.CreateDirectory(dir);
        return dir;
    }

    private async Task<(Dictionary<string, string> Agents, Dictionary<string, string> Students)>
        LookupNamesAsync(List<CtiCallRecord> items)
    {
        var agentIds = items.Select(c => c.AgentId).Distinct().ToList();
        var studentIds = items.Where(c => c.StudentId != null).Select(c => c.StudentId!).Distinct().ToList();
        var agents = await db.CtiAgents.Where(a => agentIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.DisplayName);
        var students = await db.Students.Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);
        return (agents, students);
    }

    private static string ContentType(string ext) => ext.ToLowerInvariant() switch
    {
        ".mp3" => "audio/mpeg",
        ".m4a" or ".aac" => "audio/mp4",
        ".ogg" => "audio/ogg",
        ".amr" => "audio/amr",
        _ => "audio/wav",
    };
}
