using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;
using System.Security.Claims;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// O'qituvchi ilovasi uchun API — faqat "teacher" roli (web admin'ga tegishli emas).
/// Har amal tokendagi foydalanuvchidan o'qituvchini aniqlaydi va faqat o'ziga tegishli
/// ma'lumotni ko'rsatadi/o'zgartiradi. Jurnalga yozish faqat o'qituvchining o'zi dars
/// beradigan sinf+fan uchun ruxsat etiladi (boshqasiga 403).
/// </summary>
[ApiController]
[Authorize(Roles = "teacher")]
[Route("api/teacher")]
public class TeacherPortalController(
    AppDbContext db, ChatService chat, IWebHostEnvironment env, ReferenceCache refCache,
    FcmService fcm) : ControllerBase
{
    /// <summary>Tokendagi foydalanuvchi id'si bo'yicha joriy o'qituvchini topadi.</summary>
    private async Task<Teacher?> Me()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return uid is null ? null : await db.Teachers.FirstOrDefaultAsync(t => t.UserId == uid);
    }

    /// <summary>O'qituvchi shu guruhda shu kursni (fan) o'qitadimi? Biriktirish to'g'ridan-to'g'ri
    /// guruhda: Group.TeacherId (o'qituvchi) + Group.CourseId (kurs). subjectId bo'sh = faqat o'qituvchi.</summary>
    private async Task<bool> Teaches(string teacherId, string classId, string subjectId)
    {
        var g = await db.Classes.FindAsync(classId);
        return g != null && g.TeacherId == teacherId
            && (g.CourseId == subjectId || string.IsNullOrEmpty(subjectId));
    }

    // ---------- Profil ----------

    [HttpGet("me")]
    public async Task<ActionResult<TeacherProfileDto>> Profile()
    {
        var t = await Me();
        if (t is null) return NotFound();
        var user = t.UserId is null ? null : await db.Users.FindAsync(t.UserId);
        var names = (await db.Subjects.Where(s => t.SubjectIds.Contains(s.Id)).ToListAsync())
            .Select(s => new SubjectDto(s.Id, s.Name, s.Price))
            .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
        return new TeacherProfileDto(t.Id, t.FullName, user?.Email ?? "", t.HomeroomClass, names, t.Permissions, t.PhotoUrl);
    }

    [HttpGet("meta")]
    public async Task<ActionResult<PortalMetaDto>> Meta() => await refCache.MetaAsync();

    /// <summary>Joriy maktab nomi — ilova brendingi/sarlavhasi uchun.</summary>
    [HttpGet("school")]
    public async Task<ActionResult<SchoolNameDto>> School()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new SchoolNameDto(m?.Name ?? "", m?.TelegramChannel ?? "");
    }

    // ---------- Farzandni olib ketish (pickup) — sinf rahbari ----------

    private static PickupRequestDto PickupDto(PickupRequest p) =>
        new(p.Id, p.StudentId, p.StudentName, p.ClassName, p.Status, p.CreatedAt, p.AcceptedAt, p.AcceptedByName);

    /// <summary>Sinf rahbari sinfidagi pickup so'rovlari (kutilayotgan + so'nggilar).</summary>
    [HttpGet("pickups")]
    public async Task<ActionResult<IEnumerable<PickupRequestDto>>> Pickups()
    {
        var t = await Me();
        if (t is null) return NotFound();
        if (string.IsNullOrEmpty(t.HomeroomClass)) return new List<PickupRequestDto>();
        // Faqat bugungi so'rovlar — har o'qish kuni mustaqil.
        var today = AppClock.Now.ToString("yyyy-MM-dd");
        var list = await db.PickupRequests
            .Where(p => p.ClassName == t.HomeroomClass && p.CreatedAt.StartsWith(today))
            .OrderByDescending(p => p.CreatedAt).Take(50).ToListAsync();
        return list.Select(PickupDto).ToList();
    }

    /// <summary>
    /// Sinf rahbarligi bo'limi: shu rahbar sinfidagi o'quvchilar ro'yxati. Ota-onasi kelgan
    /// (pending pickup) o'quvchilar <c>hasPendingPickup=true</c> bilan belgilanadi.
    /// </summary>
    [HttpGet("homeroom")]
    public async Task<ActionResult<object>> Homeroom()
    {
        var t = await Me();
        if (t is null) return NotFound();
        var cls = t.HomeroomClass ?? "";
        if (string.IsNullOrEmpty(cls))
            return Ok(new { className = "", students = new List<HomeroomStudentDto>() });

        var students = await db.Students.Where(s => !s.IsArchived && s.ClassName == cls)
            .OrderBy(s => s.FullName).ToListAsync();
        var ids = students.Select(s => s.Id).ToList();
        // Pickup holati KUNLIK — faqat bugungi (o'qish kuni) so'rovlari; har kuni o'zi yangilanadi.
        var today = AppClock.Now.ToString("yyyy-MM-dd");
        var latest = (await db.PickupRequests
                .Where(p => ids.Contains(p.StudentId) && p.CreatedAt.StartsWith(today)).ToListAsync())
            .GroupBy(p => p.StudentId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt, StringComparer.Ordinal).First());

        var rows = students.Select(s =>
        {
            latest.TryGetValue(s.Id, out var pr);
            return new HomeroomStudentDto(s.Id, s.FullName, pr?.Status == "pending", pr?.Status, pr?.CreatedAt);
        }).ToList();
        return Ok(new { className = cls, students = rows });
    }

    /// <summary>"Topshirish" — farzandni ota-onasiga topshiradi (sana qoldiradi) va ota-onaga push yuboradi.</summary>
    [HttpPost("homeroom/handover")]
    public async Task<ActionResult<PickupRequestDto>> Handover(HandoverRequest req)
    {
        var t = await Me();
        if (t is null) return NotFound();
        var s = await db.Students.FindAsync(req.StudentId);
        if (s is null || s.ClassName != t.HomeroomClass) return Forbid();

        var now = AppClock.Now.ToString("o");
        var today = AppClock.Now.ToString("yyyy-MM-dd");
        var pr = await db.PickupRequests.FirstOrDefaultAsync(
            p => p.StudentId == s.Id && p.Status == "pending" && p.CreatedAt.StartsWith(today));
        if (pr is null)
        {
            pr = new PickupRequest
            {
                StudentId = s.Id,
                StudentName = s.FullName,
                ClassName = s.ClassName,
                RequestedByUserId = s.UserId ?? "",
                Status = "accepted",
                CreatedAt = now,
            };
            db.PickupRequests.Add(pr);
        }
        else
        {
            pr.Status = "accepted";
        }
        pr.AcceptedAt = now;
        pr.AcceptedByTeacherId = t.Id;
        pr.AcceptedByName = t.FullName;
        await db.SaveChangesAsync();

        if (s.UserId is not null)
        {
            var meta = await db.CenterMeta.FirstOrDefaultAsync();
            var json = meta?.FcmServiceAccountJson ?? "";
            if (FcmService.IsConfigured(json))
            {
                var tokens = await db.DeviceTokens.Where(d => d.UserId == s.UserId)
                    .Select(d => d.Token).Distinct().ToListAsync();
                if (tokens.Count > 0)
                    _ = fcm.SendAsync(json, tokens, "Farzandingiz topshirildi",
                        $"Farzandingiz {s.FullName}ni olib ketishingiz mumkin — {t.FullName} topshirdi.");
            }
        }
        return PickupDto(pr);
    }

    /// <summary>"Qabul qildim" — so'rovni tasdiqlaydi va ota-onaga ruxsat push'i yuboradi.</summary>
    [HttpPost("pickups/{id}/accept")]
    public async Task<ActionResult<PickupRequestDto>> AcceptPickup(string id)
    {
        var t = await Me();
        if (t is null) return NotFound();
        var pr = await db.PickupRequests.FindAsync(id);
        if (pr is null) return NotFound();
        if (pr.ClassName != t.HomeroomClass) return Forbid();

        if (pr.Status != "accepted")
        {
            pr.Status = "accepted";
            pr.AcceptedAt = AppClock.Now.ToString("o");
            pr.AcceptedByTeacherId = t.Id;
            pr.AcceptedByName = t.FullName;
            await db.SaveChangesAsync();

            // Ota-onaga (oila akkaunti — o'quvchi UserId) ruxsat push'i.
            var student = await db.Students.FindAsync(pr.StudentId);
            if (student?.UserId is not null)
            {
                var meta = await db.CenterMeta.FirstOrDefaultAsync();
                var json = meta?.FcmServiceAccountJson ?? "";
                if (FcmService.IsConfigured(json))
                {
                    var tokens = await db.DeviceTokens.Where(d => d.UserId == student.UserId)
                        .Select(d => d.Token).Distinct().ToListAsync();
                    if (tokens.Count > 0)
                        _ = fcm.SendAsync(json, tokens, "Ruxsat berildi",
                            $"Farzandingiz {pr.StudentName}ni olib ketishingiz mumkin — {t.FullName} qabul qildi.");
                }
            }
        }
        return PickupDto(pr);
    }

    // ---------- Push qurilma (bildirishnoma) ----------

    /// <summary>Qurilma push tokenini ro'yxatdan o'tkazadi (token, platform, qurilma nomi, app_id).</summary>
    [HttpPost("notifications/register")]
    public async Task<ActionResult> RegisterDevice(RegisterDeviceRequest req)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (uid is null) return Unauthorized();
        var token = req.Token?.Trim();
        if (string.IsNullOrWhiteSpace(token)) return BadRequest(new { message = "Token bo'sh" });
        var platform = string.IsNullOrWhiteSpace(req.Platform) ? "android" : req.Platform!.Trim().ToLowerInvariant();
        var deviceName = (req.DeviceName ?? "").Trim();
        var appId = (req.AppId ?? "").Trim();

        var existing = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token);
        if (existing is null)
        {
            db.DeviceTokens.Add(new DeviceToken
            {
                UserId = uid,
                Token = token,
                Platform = platform,
                DeviceName = deviceName,
                AppId = appId,
            });
        }
        else
        {
            existing.UserId = uid;
            existing.Platform = platform;
            if (deviceName.Length > 0) existing.DeviceName = deviceName;
            if (appId.Length > 0) existing.AppId = appId;
            existing.LastSeenAt = AppClock.Now;
        }
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Qurilma tokenini o'chiradi (logout). Topilmasa ham 200.</summary>
    [HttpDelete("notifications/register")]
    public async Task<ActionResult> UnregisterDevice([FromQuery] string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest(new { message = "Token bo'sh" });
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var d = await db.DeviceTokens.FirstOrDefaultAsync(x => x.Token == token && x.UserId == uid);
        if (d is not null) { db.DeviceTokens.Remove(d); await db.SaveChangesAsync(); }
        return Ok(new { ok = true });
    }

    // ---------- Dars beradigan sinflar ----------

    [HttpGet("classes")]
    public async Task<ActionResult<IEnumerable<TeacherClassDto>>> Classes()
    {
        var t = await Me();
        if (t is null) return NotFound();

        var subjectNames = await db.Subjects.ToDictionaryAsync(s => s.Id, s => s.Name);
        var classes = await db.Classes.ToListAsync();

        // O'qituvchi qaysi guruhda qaysi kursni o'qitishi to'g'ridan-to'g'ri guruhda: Group.TeacherId + Group.CourseId.
        var taught = new Dictionary<string, HashSet<string>>(); // classId -> subjectIds (CourseId)
        foreach (var g in classes.Where(c => c.TeacherId == t.Id))
        {
            if (!taught.TryGetValue(g.Id, out var set))
                taught[g.Id] = set = new();
            if (!string.IsNullOrEmpty(g.CourseId)) set.Add(g.CourseId);
        }

        var result = new List<TeacherClassDto>();
        foreach (var cls in classes)
        {
            // Faqat o'qituvchi DARS BERADIGAN guruhlar (Group.TeacherId == me). Sinf rahbarligi tushunchasi olib tashlandi.
            taught.TryGetValue(cls.Id, out var subjIds);
            if (subjIds is null || subjIds.Count == 0) continue;
            var subjects = subjIds
                .Select(id => new SubjectDto(id, subjectNames.GetValueOrDefault(id, "")))
                .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
            result.Add(new TeacherClassDto(cls.Id, cls.Name, cls.Grade, subjects));
        }
        return result.OrderBy(c => c.Grade).ThenBy(c => c.ClassName).ToList();
    }

    // ---------- Maosh (faqat o'ziniki) ----------

    [HttpGet("salary")]
    public async Task<ActionResult<SalaryLedgerDto>> Salary([FromQuery] string? from, [FromQuery] string? to)
    {
        var t = await Me();
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Salary)) return Forbid();
        return await SalaryLedger.BuildAsync(db, t, from, to);
    }

    // ---------- Jurnal katak (PUT/DELETE) ----------
    // ZAMONAVIY oylik guruh jurnali (journal/group) shu ikki endpointni quarter/period opaque=1 bilan
    // ishlatadi (bitta katakni belgilash/tozalash). Eski chorak GET endpointlari olib tashlandi.

    [HttpPut("journal")]
    public async Task<IActionResult> SetEntry(SetJournalEntryRequest req)
    {
        if (!await Authorized(req.ClassId, req.SubjectId)) return Forbid();
        // Hali o'tilmagan (sanasi kelmagan) darsga baho/jurnal kiritib bo'lmaydi.
        if (string.CompareOrdinal(req.Date, AppClock.Now.ToString("yyyy-MM-dd")) > 0)
            return BadRequest(new { message = "Dars hali o'tilmagan — kelajakdagi sanaga baho qo'yib bo'lmaydi" });
        await JournalService.SetEntryAsync(db, req, fcm);
        return NoContent();
    }

    [HttpDelete("journal")]
    public async Task<IActionResult> ClearEntry(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] int quarter,
        [FromQuery] string studentId, [FromQuery] string date, [FromQuery] int period)
    {
        if (!await Authorized(classId, subjectId)) return Forbid();
        await JournalService.ClearEntryAsync(db, classId, subjectId, quarter, studentId, date, period);
        return NoContent();
    }

    // ---------- O'quvchilarni baholash (fan o'qituvchisi o'z fanidan) ----------

    /// <summary>Baholash turlari (admin belgilaydi; o'qituvchi shular bo'yicha o'z fanidan baho qo'yadi).</summary>
    [HttpGet("evaluation/types")]
    public async Task<ActionResult<IEnumerable<EvaluationTypeDto>>> EvalTypes() =>
        await db.EvaluationTypes.OrderBy(t => t.CreatedAt)
            .Select(t => new EvaluationTypeDto(t.Id, t.Name, t.Description)).ToListAsync();

    /// <summary>
    /// O'qituvchining shu sinf+fan bo'yicha baholash jadvali (tanlangan oy): o'quvchilar × baholash
    /// turlari bo'yicha 1-5 baho. Faqat o'qituvchi shu sinfda shu fanni o'qitsa (aks holda 403).
    /// </summary>
    [HttpGet("evaluation/board")]
    public async Task<ActionResult<EvaluationBoardDto>> EvalBoard(
        [FromQuery] string classId, [FromQuery] string subjectId, [FromQuery] string? month)
    {
        var t = await Me();
        if (t is null) return NotFound();
        if (!await Teaches(t.Id, classId, subjectId)) return Forbid();
        var cls = await db.Classes.FindAsync(classId);
        if (cls is null) return NotFound();

        var current = AppClock.Now.ToString("yyyy-MM");
        var gradeMonths = await db.EvaluationGrades
            .Where(g => g.SubjectId == subjectId && g.Month.Length >= 7)
            .Select(g => g.Month).Distinct().ToListAsync();
        var months = gradeMonths.Append(current).Distinct()
            .OrderByDescending(x => x, StringComparer.Ordinal).ToList();
        if (string.IsNullOrEmpty(month) || month.Length < 7 || !months.Contains(month))
            month = months.FirstOrDefault() ?? current;

        var types = await db.EvaluationTypes.OrderBy(x => x.CreatedAt)
            .Select(x => new EvaluationTypeDto(x.Id, x.Name, x.Description)).ToListAsync();
        var students = await db.Students.Where(s => s.ClassName == cls.Name && !s.IsArchived)
            .OrderBy(s => s.FullName).Select(s => new { s.Id, s.FullName, s.ClassName }).ToListAsync();
        var gradesByStudent = (await db.EvaluationGrades
                .Where(g => g.SubjectId == subjectId && g.Month == month).ToListAsync())
            .GroupBy(g => g.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        var rows = students.Select(s =>
        {
            var dict = (gradesByStudent.GetValueOrDefault(s.Id) ?? [])
                .GroupBy(g => g.EvaluationTypeId).ToDictionary(g => g.Key, g => g.First().Score);
            var avg = dict.Count > 0 ? Math.Round(dict.Values.Average(), 1) : 0;
            return new EvaluationRowDto(s.Id, s.FullName, s.ClassName, 0, 0,
                Array.Empty<AttendanceReasonCountDto>(), dict, avg);
        }).ToList();

        return new EvaluationBoardDto(months, month, 0, types, rows, subjectId, Array.Empty<SubjectDto>());
    }

    /// <summary>
    /// O'qituvchi o'z fanidan bitta o'quvchiga bitta tur bo'yicha bir oyda baho qo'yadi (1-5).
    /// Score bo'sh/1-5 dan tashqari = o'sha bahoni tozalash. So'rovda <c>ClassId</c> va <c>SubjectId</c>
    /// majburiy (egalik tekshiruvi); o'quvchi shu sinfga tegishli bo'lishi shart.
    /// </summary>
    [HttpPost("evaluation/grade")]
    public async Task<IActionResult> EvalGrade(SetEvaluationGradeRequest req)
    {
        var t = await Me();
        if (t is null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.ClassId) || string.IsNullOrWhiteSpace(req.SubjectId))
            return BadRequest(new { message = "Sinf va fan ko'rsatilishi shart" });
        if (string.IsNullOrEmpty(req.Month) || req.Month.Length < 7)
            return BadRequest(new { message = "Oy tanlanmagan" });
        if (!await Teaches(t.Id, req.ClassId!, req.SubjectId!)) return Forbid();

        var cls = await db.Classes.FindAsync(req.ClassId);
        var student = await db.Students.FindAsync(req.StudentId);
        if (cls is null || student is null || student.ClassName != cls.Name)
            return BadRequest(new { message = "O'quvchi bu sinfga tegishli emas" });

        var subj = req.SubjectId!;
        var existing = await db.EvaluationGrades.FirstOrDefaultAsync(g =>
            g.StudentId == req.StudentId && g.EvaluationTypeId == req.TypeId
            && g.Month == req.Month && g.SubjectId == subj);

        if (req.Score is null or < 1 or > 5)
        {
            if (existing is not null) db.EvaluationGrades.Remove(existing);
        }
        else if (existing is null)
        {
            db.EvaluationGrades.Add(new EvaluationGrade
            {
                StudentId = req.StudentId,
                EvaluationTypeId = req.TypeId,
                SubjectId = subj,
                Month = req.Month,
                Week = req.Week,
                Score = req.Score.Value,
                UpdatedAt = AppClock.Now.ToString("o"),
            });
        }
        else
        {
            existing.Score = req.Score.Value;
            existing.Week = req.Week;
            existing.UpdatedAt = AppClock.Now.ToString("o");
        }
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Joriy o'qituvchida shu bo'limga (perm) ruxsat bormi.</summary>
    private async Task<bool> HasPerm(string perm)
    {
        var t = await Me();
        return t is not null && t.Permissions.Contains(perm);
    }

    /// <summary>Jurnal ruxsati + shu sinf+fanga dars beradimi.</summary>
    private async Task<bool> Authorized(string classId, string subjectId)
    {
        var t = await Me();
        return t is not null && t.Permissions.Contains(TeacherPermissions.Journal)
            && await Teaches(t.Id, classId, subjectId);
    }

    /// <summary>Guruh joriy o'qituvchinikimi (Group.TeacherId == me). Topilmasa null, egasi bo'lmasa false.</summary>
    private async Task<(Teacher? Me, Group? Group, bool Owns)> ResolveOwnedGroup(string classId)
    {
        var t = await Me();
        if (t is null) return (null, null, false);
        var g = await db.Classes.FindAsync(classId);
        if (g is null) return (t, null, false);
        return (t, g, g.TeacherId == t.Id);
    }

    // ---------- ZAMONAVIY: Guruh OYLIK jurnali + sillabus o'tilishi (admin bilan bir xil, o'qituvchiga skoplangan) ----------
    // Yangi monthly model: guruh dars kunlari bo'yicha avtomatik ustunlar + sillabus o'tilishi/prognoz.
    // Faqat guruh EGASI (Group.TeacherId == me) kirishi mumkin (aks holda 403/404).

    /// <summary>Guruhning bitta OYLIK jurnali (admin <c>GET /admin/journal/group</c> bilan bir xil), faqat o'z guruhi uchun.</summary>
    [HttpGet("journal/group")]
    public async Task<ActionResult<GroupJournalDto>> JournalGroupMonth(
        [FromQuery] string classId, [FromQuery] string? month)
    {
        var (t, g, owns) = await ResolveOwnedGroup(classId);
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Journal)) return Forbid();
        if (g is null) return NotFound(new { message = "Guruh topilmadi" });
        if (!owns) return Forbid();
        var result = await JournalService.GroupMonthAsync(db, classId, month);
        return result is null ? NotFound(new { message = "Guruh topilmadi" }) : result;
    }

    /// <summary>Bitta dars (sana) uchun BARCHA o'quvchiga birdan davomat (admin bilan bir xil), faqat o'z guruhi uchun.</summary>
    [HttpPost("journal/bulk-attendance")]
    public async Task<IActionResult> JournalBulkAttendance(BulkAttendanceRequest req)
    {
        var (t, g, owns) = await ResolveOwnedGroup(req.ClassId);
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Journal)) return Forbid();
        if (g is null) return NotFound(new { message = "Guruh topilmadi" });
        if (!owns) return Forbid();
        await JournalService.BulkAttendanceAsync(db, req);
        return NoContent();
    }

    /// <summary>Guruh sillabus o'tilishi + tugash prognozi (admin <c>GET /admin/curriculum/group/{id}</c> bilan bir xil), o'z guruhi uchun.</summary>
    [HttpGet("curriculum/group/{groupId}")]
    public async Task<ActionResult<GroupCurriculumDto>> CurriculumGroup(string groupId)
    {
        var (t, group, owns) = await ResolveOwnedGroup(groupId);
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Schedule)) return Forbid();
        if (group is null) return NotFound();
        if (!owns) return Forbid();

        return await CurriculumForecast.BuildGroupAsync(db, group);
    }

    /// <summary>Bandni o'tilgan/o'tilmagan qilish (admin <c>POST /admin/curriculum/group/{id}/cover</c> bilan bir xil), o'z guruhi uchun.</summary>
    [HttpPost("curriculum/group/{groupId}/cover")]
    public async Task<ActionResult> CurriculumCover(string groupId, CoverRequest req)
    {
        var (t, group, owns) = await ResolveOwnedGroup(groupId);
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Schedule)) return Forbid();
        if (group is null) return NotFound();
        if (!owns) return Forbid();

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

    /// <summary>Takrorlash darsi qo'shish/olib tashlash (admin <c>POST /admin/curriculum/group/{id}/revision</c> bilan bir xil), o'z guruhi uchun.</summary>
    [HttpPost("curriculum/group/{groupId}/revision")]
    public async Task<ActionResult> CurriculumRevision(string groupId, RevisionRequest req)
    {
        var (t, group, owns) = await ResolveOwnedGroup(groupId);
        if (t is null) return NotFound();
        if (!t.Permissions.Contains(TeacherPermissions.Schedule)) return Forbid();
        if (group is null) return NotFound();
        if (!owns) return Forbid();

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

    // ---------- Guruh chati (dars beradigan sinflar + sinf rahbarligi) ----------

    /// <summary>
    /// Har bir kanal uchun oxirgi xabar vaqti (ISO) — frontend o'qilmagan xabarlarni aniqlaydi.
    /// O'qituvchining barcha kanallari (sinflar + xodimlar) qaytadi. Xabari yo'q kanal uchun null.
    /// </summary>
    [HttpGet("chat/last-messages")]
    public async Task<ActionResult<Dictionary<string, string?>>> ChatLastMessages()
    {
        if (!await HasPerm(TeacherPermissions.Messages)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var channels = await chat.ClassNamesForUserAsync(uid, "teacher");
        var lastByChannel = (await db.ChatMessages
                .Where(m => channels.Contains(m.ClassName))
                .GroupBy(m => m.ClassName)
                .Select(g => new { Name = g.Key, Last = g.Max(x => x.CreatedAt) })
                .ToListAsync())
            .ToDictionary(x => x.Name, x => (string?)x.Last.ToString("o"));
        return channels.ToDictionary(c => c, c => lastByChannel.GetValueOrDefault(c, null));
    }

    [HttpGet("chat/classes")]
    public async Task<ActionResult<IEnumerable<string>>> ChatClasses()
    {
        if (!await HasPerm(TeacherPermissions.Messages)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        return await chat.ClassNamesForUserAsync(uid, "teacher");
    }

    [HttpGet("chat/{className}")]
    public async Task<ActionResult<IEnumerable<ChatMessageDto>>> Chat(string className, [FromQuery] string? since)
    {
        if (!await HasPerm(TeacherPermissions.Messages)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        if (!await chat.CanAccessAsync(uid, "teacher", className)) return Forbid();
        return await chat.GetMessagesAsync(className, ChatService.ParseSince(since));
    }

    [HttpPost("chat/{className}")]
    public async Task<ActionResult<ChatMessageDto>> SendChat(string className, SendChatRequest req)
    {
        if (!await HasPerm(TeacherPermissions.Messages)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        if (!await chat.CanAccessAsync(uid, "teacher", className)) return Forbid();
        var dto = await chat.PostAsync(className, uid, req.Text);
        return dto is null ? BadRequest(new { message = "Xabar bo'sh" }) : dto;
    }

    // ---------- Topshiriqlar / testlar (o'qituvchi yaratadi) ----------

    /// <summary>O'qituvchining o'zi yaratgan topshiriqlari.</summary>
    [HttpGet("assignments")]
    public async Task<ActionResult<IEnumerable<AssignmentDto>>> Assignments()
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        return await AssignmentService.ListForTeacherAsync(db, uid);
    }

    [HttpPost("assignments")]
    public async Task<ActionResult<AssignmentDto>> CreateAssignment(SaveAssignmentRequest req)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { message = "Topshiriq nomi kerak" });
        if (req.ClassIds is null || req.ClassIds.Count == 0)
            return BadRequest(new { message = "Kamida bitta sinf tanlang" });
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        return await AssignmentService.CreateAsync(db, uid, req);
    }

    [HttpPut("assignments/{id}")]
    public async Task<IActionResult> UpdateAssignment(string id, SaveAssignmentRequest req)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var a = await db.Assignments.FindAsync(id);
        if (a is null) return NotFound();
        if (a.CreatedByUserId != uid) return Forbid(); // faqat o'zinikini tahrirlaydi
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { message = "Topshiriq nomi kerak" });
        await AssignmentService.UpdateAsync(db, id, req);
        return NoContent();
    }

    [HttpDelete("assignments/{id}")]
    public async Task<IActionResult> DeleteAssignment(string id)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var a = await db.Assignments.FindAsync(id);
        if (a is null) return NotFound();
        if (a.CreatedByUserId != uid) return Forbid();
        await AssignmentService.DeleteAsync(db, id);
        return NoContent();
    }

    /// <summary>Topshiriq materiali sifatida fayl yuklash (PDF/rasm/doc, maks ~20MB).</summary>
    [HttpPost("uploads")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<UploadedFileDto>> Upload(IFormFile file)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        if (Application.Services.UploadGuard.Validate(file) is { } error)
            return BadRequest(new { message = error });

        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = Application.Services.UploadGuard.SafeName(file);
        await using (var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);

        return new UploadedFileDto(file.FileName, $"/uploads/{stored}", file.Length, file.ContentType ?? "");
    }

    /// <summary>Topshiriq natijalari — kim bajardi/bajarmadi (faqat o'zining topshirig'i).</summary>
    [HttpGet("assignments/{id}/results")]
    public async Task<ActionResult<AssignmentResultDto>> AssignmentResults(string id)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var a = await db.Assignments.FindAsync(id);
        if (a is null) return NotFound();
        if (a.CreatedByUserId != uid) return Forbid();
        var res = await AssignmentService.GetResultsAsync(db, id);
        return res is null ? NotFound() : res;
    }

    /// <summary>O'quvchining bajarish holatini belgilash (bajardi/bajarmadi + ixtiyoriy ball).</summary>
    [HttpPut("assignments/{id}/submissions/{studentId}")]
    public async Task<IActionResult> SetSubmission(string id, string studentId, SetSubmissionRequest req)
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var a = await db.Assignments.FindAsync(id);
        if (a is null) return NotFound();
        if (a.CreatedByUserId != uid) return Forbid();
        await AssignmentService.SetSubmissionAsync(db, id, studentId, req.Completed, req.Score);
        return NoContent();
    }

    /// <summary>Topshiriq turlari (faqat o'qish) — topshiriq formasidagi dropdown uchun.</summary>
    [HttpGet("assignment-types")]
    public async Task<ActionResult<IEnumerable<AssignmentTypeDto>>> AssignmentTypes()
    {
        if (!await HasPerm(TeacherPermissions.Assignments)) return Forbid();
        return await db.AssignmentTypes.Select(t => new AssignmentTypeDto(t.Id, t.Name)).ToListAsync();
    }


    // ---------- Taklif va shikoyatlar (o'qituvchi → admin) ----------

    /// <summary>
    /// O'qituvchi taklif yoki shikoyat yuboradi (matn + ixtiyoriy rasm). Admin/superadmin
    /// "Taklif va shikoyatlar" bo'limida ko'radi (yuboruvchi = o'qituvchi).
    /// </summary>
    [HttpPost("feedback")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> SubmitFeedback(
        [FromForm] string type, [FromForm] string text, IFormFile? image)
    {
        var t = await Me();
        if (t is null) return NotFound();
        var body = (text ?? "").Trim();
        if (body.Length == 0) return BadRequest(new { message = "Matn bo'sh" });
        if (image is not null && Application.Services.UploadGuard.Validate(image) is { } imgError)
            return BadRequest(new { message = imgError });

        string? imageUrl = null;
        if (image is { Length: > 0 })
        {
            var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
            System.IO.Directory.CreateDirectory(dir);
            var stored = Application.Services.UploadGuard.SafeName(image);
            await using var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored));
            await image.CopyToAsync(fs);
            imageUrl = $"/uploads/{stored}";
        }

        db.Feedbacks.Add(new Feedback
        {
            StudentId = "",
            ParentName = "",
            SenderRole = "teacher",
            SenderName = t.FullName,
            TeacherId = t.Id,
            Type = type == "complaint" ? "complaint" : "suggestion",
            Text = body,
            ImageUrl = imageUrl,
            CreatedAt = AppClock.Now,
            Status = "new",
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- LMS (Ta'lim) — FAQAT KO'RISH + progress ----------
    // O'qituvchi LMS kontentini yaratmaydi (uni admin qiladi); faqat o'zi dars beradigan
    // (yoki rahbarlik qiladigan) sinflarning materialini va o'quvchilar tugatishini ko'radi.

    /// <summary>O'qituvchi dars beradigan/rahbarlik qiladigan sinflar id'lari (jadval + rahbarlik).</summary>
    private async Task<HashSet<string>> TaughtClassIdsAsync(Teacher t)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var groupIds = await db.Classes.Where(c => c.TeacherId == t.Id)
            .Select(c => c.Id).ToListAsync();
        foreach (var gid in groupIds) ids.Add(gid);
        if (!string.IsNullOrEmpty(t.HomeroomClass))
        {
            var hc = await db.Classes.FirstOrDefaultAsync(c => c.Name == t.HomeroomClass);
            if (hc is not null) ids.Add(hc.Id);
        }
        return ids;
    }

    /// <summary>O'qituvchi sinflaridagi LMS fanlar. ?classId= bilan bitta sinfga filtrlash mumkin.</summary>
    [HttpGet("lms/subjects")]
    public async Task<ActionResult<IEnumerable<LmsSubjectDto>>> LmsSubjects([FromQuery] string? classId)
    {
        var t = await Me();
        if (t is null) return NotFound();

        var taught = await TaughtClassIdsAsync(t);
        if (!string.IsNullOrEmpty(classId))
        {
            if (!taught.Contains(classId)) return Forbid();
            taught = new HashSet<string>(StringComparer.Ordinal) { classId };
        }

        var subjects = await db.LmsSubjects.Include(s => s.Modules).ThenInclude(m => m.Topics)
            .Where(s => taught.Contains(s.ClassId))
            .OrderBy(s => s.CreatedAt).ToListAsync();
        var classNames = await db.Classes.Where(c => taught.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);

        return subjects.Select(s => new LmsSubjectDto(
            s.Id, s.ClassId, classNames.GetValueOrDefault(s.ClassId, ""),
            s.Title, s.Description, s.UnlockMode, s.BatchSize,
            s.Modules.Sum(m => m.Topics.Count), s.CreatedAt.ToString("o"))).ToList();
    }

    /// <summary>Fanning mavzulari (to'liq kontent — o'qituvchiga hammasi ochiq). Tugatgan o'quvchi soni bilan.</summary>
    [HttpGet("lms/subjects/{subjectId}/topics")]
    public async Task<ActionResult<IEnumerable<LmsTopicDto>>> LmsTopics(string subjectId)
    {
        var t = await Me();
        if (t is null) return NotFound();
        var subject = await db.LmsSubjects.FindAsync(subjectId);
        if (subject is null) return NotFound();
        if (!(await TaughtClassIdsAsync(t)).Contains(subject.ClassId)) return Forbid();

        // Mavzular fan modullari orqali yig'iladi (modul → mavzu tartibida).
        var modules = await db.LmsModules.Include(m => m.Topics).ThenInclude(t => t.Materials)
            .Where(m => m.SubjectId == subjectId).OrderBy(m => m.Order).ToListAsync();
        var topics = modules.SelectMany(m => m.Topics.OrderBy(x => x.Order)).ToList();
        var topicIds = topics.Select(x => x.Id).ToList();
        var completedMap = (await db.LmsProgresses
                .Where(p => topicIds.Contains(p.TopicId))
                .GroupBy(p => p.TopicId)
                .Select(g => new { Id = g.Key, Count = g.Count() })
                .ToListAsync())
            .ToDictionary(x => x.Id, x => x.Count);

        return topics.Select(x => new LmsTopicDto(
            x.Id, x.ModuleId, x.Title, x.Description, x.VideoUrl, x.TextContent, x.Order,
            x.Materials.Select(m => new LmsMaterialRowDto(m.Id, m.Name, m.Url, m.Size, m.ContentType)).ToList(),
            completedMap.GetValueOrDefault(x.Id, 0))).ToList();
    }

    /// <summary>Fan bo'yicha o'quvchilar progress matritsasi: kim qaysi mavzuni tugatgan.</summary>
    [HttpGet("lms/subjects/{subjectId}/progress")]
    public async Task<ActionResult<LmsProgressReportDto>> LmsProgress(string subjectId)
    {
        var t = await Me();
        if (t is null) return NotFound();
        var subject = await db.LmsSubjects.FindAsync(subjectId);
        if (subject is null) return NotFound();
        if (!(await TaughtClassIdsAsync(t)).Contains(subject.ClassId)) return Forbid();

        var cls = await db.Classes.FindAsync(subject.ClassId);
        if (cls is null) return NotFound();

        var modules = await db.LmsModules.Include(m => m.Topics)
            .Where(m => m.SubjectId == subjectId).OrderBy(m => m.Order).ToListAsync();
        var topics = modules.SelectMany(m => m.Topics.OrderBy(x => x.Order)).ToList();
        var topicIds = topics.Select(x => x.Id).ToList();

        var students = await db.Students
            .Where(s => s.ClassName == cls.Name && !s.IsArchived)
            .OrderBy(s => s.FullName).ToListAsync();
        var studentIds = students.Select(s => s.Id).ToList();

        var byStudent = (await db.LmsProgresses
                .Where(p => topicIds.Contains(p.TopicId) && studentIds.Contains(p.StudentId))
                .ToListAsync())
            .GroupBy(p => p.StudentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.TopicId).ToList());

        return new LmsProgressReportDto(
            topics.Select(x => new LmsTopicBriefDto(x.Id, x.Title, x.Order)).ToList(),
            students.Select(s =>
            {
                var done = byStudent.GetValueOrDefault(s.Id, new List<string>());
                return new LmsStudentProgressDto(s.Id, s.FullName, done, done.Count, topics.Count);
            }).ToList());
    }
}
