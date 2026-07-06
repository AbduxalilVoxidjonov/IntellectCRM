using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using IntellectCRM.Application.Services;

namespace IntellectCRM.Server.Controllers;

[ApiController]
[Authorize]
[AdminPerm("settings")]
[Route("api/admin/settings")]
public class SettingsController(AppDbContext db, TelegramService telegram, IWebHostEnvironment env, IConfiguration config, EskizService eskiz) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SchoolSettingsDto>> Get()
    {
        var reasons = await db.AbsenceReasons
            .Select(r => new AbsenceReasonDto(r.Id, r.Name, r.Short, r.IsLate)).ToListAsync();
        var quarters = await TuitionService.SyntheticPeriodsAsync(db);
        // Dars vaqtlari (qo'ng'iroqlar jadvali) olib tashlandi — bo'sh ro'yxat.
        return new SchoolSettingsDto(new List<LessonTimeDto>(), reasons, quarters);
    }

    [HttpGet("school")]
    public async Task<ActionResult<SchoolInfoDto>> GetSchool()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new SchoolInfoDto(
            m?.Name ?? "", m?.Director ?? "", m?.Phone ?? "", m?.Email ?? "",
            m?.Address ?? "", m?.Region ?? "", m?.District ?? "", m?.LogoUrl ?? "");
    }

    [HttpPut("school")]
    public async Task<IActionResult> SaveSchool(SchoolInfoDto req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null)
        {
            m = new CenterMeta();
            db.CenterMeta.Add(m);
        }
        m.Name = req.Name;
        m.Director = req.Director;
        m.Phone = req.Phone;
        m.Email = req.Email;
        m.Address = req.Address;
        m.Region = req.Region;
        m.District = req.District;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Markaz logotipini yuklaydi (rasm) — barcha foydalanuvchi ko'radigan joylarda ko'rsatiladi.</summary>
    [HttpPost("logo")]
    [RequestSizeLimit(8_000_000)]
    public async Task<ActionResult<SchoolInfoDto>> UploadLogo(IFormFile file)
    {
        if (Application.Services.UploadGuard.Validate(file) is { } error)
            return BadRequest(new { message = error });
        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = Application.Services.UploadGuard.SafeName(file);
        await using (var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.LogoUrl = $"/uploads/{stored}";
        await db.SaveChangesAsync();
        return await GetSchool();
    }

    /// <summary>Logotipni o'chiradi.</summary>
    [HttpDelete("logo")]
    public async Task<ActionResult<SchoolInfoDto>> DeleteLogo()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is not null) { m.LogoUrl = ""; await db.SaveChangesAsync(); }
        return await GetSchool();
    }

    // ---------- Telegram bot ----------

    [HttpGet("telegram")]
    public async Task<ActionResult<TelegramSettingsDto>> GetTelegram()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new TelegramSettingsDto(
            m?.TelegramBotToken ?? "", m?.TelegramBotUsername ?? "", m?.TelegramBotName ?? "",
            telegram.IsConfigured, m?.TelegramChannel ?? "");
    }

    [HttpPut("telegram")]
    public async Task<ActionResult<TelegramSettingsDto>> SaveTelegram(SaveTelegramSettingsRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null)
        {
            m = new CenterMeta();
            db.CenterMeta.Add(m);
        }
        m.TelegramBotToken = (req.BotToken ?? "").Trim();
        m.TelegramBotUsername = (req.BotUsername ?? "").Trim().TrimStart('@');
        m.TelegramBotName = (req.BotName ?? "").Trim();
        m.TelegramChannel = (req.Channel ?? "").Trim();
        await db.SaveChangesAsync();

        // Ishlab turgan xizmat (va bot) darrov yangi tokenni ishlatishi uchun keshni yangilaymiz.
        telegram.Set(m.TelegramBotToken, m.TelegramBotUsername, m.TelegramBotName);

        return new TelegramSettingsDto(m.TelegramBotToken, m.TelegramBotUsername, m.TelegramBotName, telegram.IsConfigured, m.TelegramChannel);
    }

    // ---------- Telegram backup ----------

    [HttpGet("telegram-backup")]
    public async Task<ActionResult<TelegramBackupConfigDto>> GetTelegramBackupConfig()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new TelegramBackupConfigDto(
            m?.TelegramAdminChatId ?? "",
            m?.BackupScheduleHour ?? 21,
            m?.BackupScheduleMinute ?? 0,
            m?.TelegramBackupEnabled ?? true,
            m?.TelegramBackupLastSentAt);
    }

    [HttpPost("telegram-backup")]
    public async Task<ActionResult<TelegramBackupConfigDto>> SaveTelegramBackupConfig(SaveTelegramBackupConfigRequest req)
    {
        if (req.ScheduleHour is < 0 or > 23)
            return BadRequest(new { message = "ScheduleHour 0-23 oralig'ida bo'lishi kerak" });
        if (req.ScheduleMinute is < 0 or > 59)
            return BadRequest(new { message = "ScheduleMinute 0-59 oralig'ida bo'lishi kerak" });

        var chatId = (req.AdminChatId ?? "").Trim();
        if (chatId.Length > 0)
        {
            if (!long.TryParse(chatId, out var parsed) || parsed == 0)
                return BadRequest(new { message = "AdminChatId faqat raqam bo'lishi kerak (masalan: 123456789)" });
        }

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }

        m.TelegramAdminChatId = chatId.Length > 0 ? chatId : null;
        m.BackupScheduleHour = req.ScheduleHour;
        m.BackupScheduleMinute = req.ScheduleMinute;
        m.TelegramBackupEnabled = req.Enabled;
        await db.SaveChangesAsync();

        return new TelegramBackupConfigDto(
            m.TelegramAdminChatId ?? "",
            m.BackupScheduleHour,
            m.BackupScheduleMinute,
            m.TelegramBackupEnabled,
            m.TelegramBackupLastSentAt);
    }

    // ---------- Push (Firebase / FCM) ----------
    // Ikki qatlam: (1) ServiceAccountJson — server FCM'ga push YUBORISHI uchun (maxfiy);
    // (2) WebConfigJson + VapidKey — brauzer/PWA token OLISHI uchun (ommaviy). Native (Flutter)
    // ilova tokenni o'zi oladi; web/PWA esa quyidagi web config bilan Firebase JS SDK orqali oladi.

    [HttpGet("firebase")]
    public async Task<ActionResult<FirebaseSettingsDto>> GetFirebase()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var json = m?.FcmServiceAccountJson ?? "";
        var web = m?.FcmWebConfigJson ?? "";
        var vapid = m?.FcmVapidKey ?? "";
        return new FirebaseSettingsDto(
            json, FcmService.IsConfigured(json), web, vapid, WebPushConfigured(web, vapid));
    }

    [HttpPut("firebase")]
    public async Task<ActionResult<FirebaseSettingsDto>> SaveFirebase(SaveFirebaseSettingsRequest req)
    {
        var json = (req.ServiceAccountJson ?? "").Trim();
        if (json.Length > 0 && !FcmService.IsConfigured(json))
            return BadRequest(new { message = "Service account JSON noto'g'ri (client_email/private_key/project_id kerak)" });

        var web = (req.WebConfigJson ?? "").Trim();
        if (web.Length > 0 && !IsValidJsonObject(web))
            return BadRequest(new { message = "Web app config noto'g'ri — Firebase Console'dagi JSON obyektni to'liq qo'ying." });
        var vapid = (req.VapidKey ?? "").Trim();

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.FcmServiceAccountJson = json;
        m.FcmWebConfigJson = web;
        m.FcmVapidKey = vapid;
        await db.SaveChangesAsync();
        return new FirebaseSettingsDto(
            json, FcmService.IsConfigured(json), web, vapid, WebPushConfigured(web, vapid));
    }

    /// <summary>Web/PWA push tayyor — web config JSON obyekti va VAPID kalit ham kiritilgan.</summary>
    private static bool WebPushConfigured(string webConfigJson, string vapidKey) =>
        IsValidJsonObject(webConfigJson) && vapidKey.Trim().Length > 0;

    private static bool IsValidJsonObject(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object;
        }
        catch { return false; }
    }

    // ---------- Speaking (Azure Pronunciation Assessment) ----------

    [HttpGet("azure-speech")]
    public async Task<ActionResult<AzureSpeechSettingsDto>> GetAzureSpeech()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new AzureSpeechSettingsDto(
            m?.AzureSpeechRegion ?? "",
            AzureSpeechService.IsConfigured(m?.AzureSpeechKey, m?.AzureSpeechRegion));
    }

    [HttpPut("azure-speech")]
    public async Task<ActionResult<AzureSpeechSettingsDto>> SaveAzureSpeech(SaveAzureSpeechRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        // Kalit faqat yangi qiymat berilsa yangilanadi (bo'sh qoldirilsa eski saqlanadi — GET kalitni qaytarmaydi).
        if (!string.IsNullOrWhiteSpace(req.Key)) m.AzureSpeechKey = req.Key.Trim();
        if (req.Region is not null) m.AzureSpeechRegion = req.Region.Trim();
        await db.SaveChangesAsync();
        return new AzureSpeechSettingsDto(m.AzureSpeechRegion, AzureSpeechService.IsConfigured(m.AzureSpeechKey, m.AzureSpeechRegion));
    }

    // ---------- AI Tahlil (Google Gemini) ----------

    [HttpGet("gemini")]
    public async Task<ActionResult<GeminiSettingsDto>> GetGemini()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new GeminiSettingsDto(
            GeminiService.ResolveModel(config),
            GeminiService.IsConfigured(m?.GeminiApiKey));
    }

    [HttpPut("gemini")]
    public async Task<ActionResult<GeminiSettingsDto>> SaveGemini(SaveGeminiRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        // Kalit faqat yangi qiymat berilsa yangilanadi (bo'sh qoldirilsa eski saqlanadi — GET kalitni qaytarmaydi).
        if (!string.IsNullOrWhiteSpace(req.Key)) m.GeminiApiKey = req.Key.Trim();
        await db.SaveChangesAsync();
        return new GeminiSettingsDto(GeminiService.ResolveModel(config), GeminiService.IsConfigured(m.GeminiApiKey));
    }

    // ---------- To'lov cheki (termal kvitansiya) sozlamalari ----------

    /// <summary>Chek sozlamalari (JSON). Bo'sh = standart shablon (frontend default'i ishlaydi).</summary>
    [HttpGet("check")]
    public async Task<ActionResult<CheckSettingsDto>> GetCheck()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new CheckSettingsDto(m?.CheckSettings ?? "");
    }

    [HttpPut("check")]
    public async Task<ActionResult<CheckSettingsDto>> SaveCheck(CheckSettingsDto req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.CheckSettings = (req.Json ?? "").Trim();
        await db.SaveChangesAsync();
        return new CheckSettingsDto(m.CheckSettings);
    }

    // ---------- SMS (Eskiz.uz) ----------

    [HttpGet("eskiz")]
    public async Task<ActionResult<EskizSettingsDto>> GetEskiz()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        // Balans — sozlangan bo'lsa best-effort (tarmoq xatosi UI'ni buzmaydi).
        decimal? balance = eskiz.IsConfigured(m) ? await eskiz.GetBalanceAsync(db) : null;
        return new EskizSettingsDto(eskiz.DisplayEmail(m), eskiz.SenderOf(m), eskiz.IsConfigured(m), balance);
    }

    [HttpPut("eskiz")]
    public async Task<ActionResult<EskizSettingsDto>> SaveEskiz(SaveEskizRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        var changed = false;
        if (req.Email is not null && req.Email.Trim() != m.EskizEmail) { m.EskizEmail = req.Email.Trim(); changed = true; }
        // Parol faqat yangi qiymat berilsa yangilanadi (bo'sh qoldirilsa eski saqlanadi — GET parolni qaytarmaydi).
        if (!string.IsNullOrWhiteSpace(req.Password)) { m.EskizPassword = req.Password.Trim(); changed = true; }
        if (req.From is not null) m.EskizFrom = string.IsNullOrWhiteSpace(req.From) ? "4546" : req.From.Trim();
        // Login/parol o'zgarsa keshlangan tokenni bekor qilamiz (yangisi bilan qayta login bo'ladi).
        if (changed) { m.EskizToken = ""; m.EskizTokenExpiresAt = null; }
        await db.SaveChangesAsync();
        decimal? balance = eskiz.IsConfigured(m) ? await eskiz.GetBalanceAsync(db) : null;
        return new EskizSettingsDto(eskiz.DisplayEmail(m), eskiz.SenderOf(m), eskiz.IsConfigured(m), balance);
    }

    // ---------- Local SMS (CTI agent telefonining SIM-kartasidan) ----------

    [HttpGet("local-sms")]
    public async Task<ActionResult<LocalSmsSettingsDto>> GetLocalSms()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return new LocalSmsSettingsDto(m?.LocalSmsEnabled ?? false, m?.LocalSmsDefaultAgentId);
    }

    [HttpPut("local-sms")]
    public async Task<ActionResult<LocalSmsSettingsDto>> SaveLocalSms(SaveLocalSmsRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.DefaultAgentId)
            && await db.CtiAgents.FindAsync(req.DefaultAgentId) is null)
            return BadRequest(new { message = "Tanlangan agent topilmadi" });

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.LocalSmsEnabled = req.Enabled;
        m.LocalSmsDefaultAgentId = string.IsNullOrWhiteSpace(req.DefaultAgentId) ? null : req.DefaultAgentId;
        await db.SaveChangesAsync();
        return new LocalSmsSettingsDto(m.LocalSmsEnabled, m.LocalSmsDefaultAgentId);
    }

    // ---------- Ilova (APK) — Telegram bot ro'yxatdan o'tganga yuboradi ----------

    private const long MaxApkBytes = 50_000_000; // Telegram bot sendDocument chegarasi ~50 MB

    [HttpGet("app-apk")]
    public async Task<ActionResult<AppApkSettingsDto>> GetAppApk()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        return AppApkDto(m);
    }

    [HttpPost("app-apk/{role}")]
    [RequestSizeLimit(MaxApkBytes + 2_000_000)]
    public async Task<ActionResult<AppApkSettingsDto>> UploadAppApk(string role, IFormFile file)
    {
        if (role is not ("student" or "teacher"))
            return BadRequest(new { message = "role 'student' yoki 'teacher' bo'lishi kerak" });
        if (file is null || file.Length == 0) return BadRequest(new { message = "Fayl bo'sh" });
        if (file.Length > MaxApkBytes)
            return BadRequest(new { message = "APK 50 MB dan katta — Telegram bot orqali yuborib bo'lmaydi." });
        if (!file.FileName.EndsWith(".apk", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Faqat .apk fayl qabul qilinadi" });

        var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
        System.IO.Directory.CreateDirectory(dir);
        var stored = $"app-{role}-{Guid.NewGuid():N}.apk";
        await using (var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        var relPath = $"uploads/{stored}";
        var name = System.IO.Path.GetFileName(file.FileName);
        if (role == "student")
        {
            DeleteApk(m.StudentApkPath);
            m.StudentApkName = name; m.StudentApkPath = relPath; m.StudentApkFileId = ""; // kesh bo'shatiladi
        }
        else
        {
            DeleteApk(m.TeacherApkPath);
            m.TeacherApkName = name; m.TeacherApkPath = relPath; m.TeacherApkFileId = "";
        }
        await db.SaveChangesAsync();
        return AppApkDto(m);
    }

    [HttpDelete("app-apk/{role}")]
    public async Task<ActionResult<AppApkSettingsDto>> DeleteAppApk(string role)
    {
        if (role is not ("student" or "teacher"))
            return BadRequest(new { message = "role 'student' yoki 'teacher' bo'lishi kerak" });
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) return AppApkDto(null);
        if (role == "student")
        {
            DeleteApk(m.StudentApkPath);
            m.StudentApkName = ""; m.StudentApkPath = ""; m.StudentApkFileId = "";
        }
        else
        {
            DeleteApk(m.TeacherApkPath);
            m.TeacherApkName = ""; m.TeacherApkPath = ""; m.TeacherApkFileId = "";
        }
        await db.SaveChangesAsync();
        return AppApkDto(m);
    }

    private void DeleteApk(string relPath)
    {
        if (string.IsNullOrWhiteSpace(relPath)) return;
        try
        {
            var abs = System.IO.Path.Combine(env.ContentRootPath, relPath);
            if (System.IO.File.Exists(abs)) System.IO.File.Delete(abs);
        }
        catch { /* eski faylni o'chirib bo'lmasa — e'tiborsiz */ }
    }

    private AppApkSettingsDto AppApkDto(CenterMeta? m)
    {
        long Size(string relPath)
        {
            if (string.IsNullOrWhiteSpace(relPath)) return 0;
            var abs = System.IO.Path.Combine(env.ContentRootPath, relPath);
            return System.IO.File.Exists(abs) ? new System.IO.FileInfo(abs).Length : 0;
        }
        return new AppApkSettingsDto(
            m?.StudentApkName ?? "", Size(m?.StudentApkPath ?? ""),
            m?.TeacherApkName ?? "", Size(m?.TeacherApkPath ?? ""));
    }

    // ---------- Turniket / FaceID integratsiyasi ----------

    [HttpGet("turnstile")]
    public async Task<ActionResult<TurnstileSettingsDto>> GetTurnstile()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var teachers = (await db.Teachers.Where(t => !t.IsArchived).OrderBy(t => t.FullName).ToListAsync())
            .Select(t => new TeacherDeviceMapDto(t.Id, t.FullName, t.DeviceUserId)).ToList();
        return new TurnstileSettingsDto(
            m?.TurnstileEnabled ?? false,
            string.IsNullOrEmpty(m?.TurnstileVendor) ? "hikvision" : m!.TurnstileVendor,
            m?.TurnstileHost ?? "", m?.TurnstilePort ?? 80, m?.TurnstileUsername ?? "",
            !string.IsNullOrEmpty(m?.TurnstilePassword),
            string.IsNullOrEmpty(m?.WorkStartTime) ? "08:30" : m!.WorkStartTime,
            m?.LateGraceMinutes ?? 10, m?.TurnstileLastSync ?? "", teachers);
    }

    [HttpPut("turnstile")]
    public async Task<ActionResult<TurnstileSettingsDto>> SaveTurnstile(SaveTurnstileSettingsRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.TurnstileEnabled = req.Enabled;
        m.TurnstileVendor = (req.Vendor ?? m.TurnstileVendor).Trim().ToLowerInvariant();
        m.TurnstileHost = (req.Host ?? "").Trim();
        m.TurnstilePort = req.Port is > 0 ? req.Port.Value : 80;
        m.TurnstileUsername = (req.Username ?? "").Trim();
        // Parol bo'sh kelsa — eskisi saqlanadi (UI parolni qaytarmaydi).
        if (!string.IsNullOrEmpty(req.Password)) m.TurnstilePassword = req.Password;
        if (!string.IsNullOrEmpty(req.WorkStartTime)) m.WorkStartTime = req.WorkStartTime.Trim();
        if (req.LateGraceMinutes is >= 0) m.LateGraceMinutes = req.LateGraceMinutes.Value;

        // O'qituvchi ↔ qurilma ID moslamasi.
        if (req.Teachers is not null)
        {
            var byId = await db.Teachers.ToDictionaryAsync(t => t.Id);
            foreach (var map in req.Teachers)
                if (byId.TryGetValue(map.TeacherId, out var te))
                    te.DeviceUserId = (map.DeviceUserId ?? "").Trim();
        }
        await db.SaveChangesAsync();
        return await GetTurnstile();
    }

    // ---------- Kamera (videokuzatuv) integratsiyasi ----------

    [HttpGet("cameras")]
    public async Task<ActionResult<CameraSettingsDto>> GetCameras()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var count = await db.Cameras.CountAsync();
        return new CameraSettingsDto(m?.CameraEnabled ?? false, count);
    }

    [HttpPut("cameras")]
    public async Task<ActionResult<CameraSettingsDto>> SaveCameras(SaveCameraSettingsRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.CameraEnabled = req.Enabled;
        await db.SaveChangesAsync();
        return await GetCameras();
    }

    [HttpPost("telegram-backup/test")]
    public async Task<ActionResult<object>> TestTelegramBackup()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        var chatIdStr = m?.TelegramAdminChatId ?? "";
        if (string.IsNullOrWhiteSpace(chatIdStr))
            return BadRequest(new { success = false, message = "Admin Chat ID kiritilmagan. Avval Chat ID saqlang." });
        if (!long.TryParse(chatIdStr.Trim(), out var chatId) || chatId == 0)
            return BadRequest(new { success = false, message = "Admin Chat ID noto'g'ri format (faqat raqam bo'lishi kerak)." });
        if (!telegram.IsConfigured)
            return BadRequest(new { success = false, message = "Telegram bot sozlanmagan. Avval bot token saqlang." });

        var sent = await telegram.SendMessageAsync(chatId,
            $"IntellectCRM Backup testi — {AppClock.Now:yyyy-MM-dd HH:mm}. Bu xabar test maqsadida yuborildi.");
        if (sent)
            return Ok(new { success = true, message = "Test xabari muvaffaqiyatli yuborildi." });
        return Ok(new { success = false, message = "Xabar yuborishda xatolik. Chat ID va bot tokenni tekshiring." });
    }

    /// <summary>Backupni HOZIR yuboradi — markaz ma'lumotlari JSON qilib Telegram orqali adminga.</summary>
    [HttpPost("telegram-backup/run")]
    public async Task<ActionResult<object>> RunTelegramBackup()
    {
        var (ok, msg) = await BackupService.SendAsync(db, telegram);
        return Ok(new { success = ok, message = msg });
    }

    [HttpPut("absence-reasons")]
    public async Task<IActionResult> SaveAbsenceReasons(SaveAbsenceReasonsRequest req)
    {
        // Mavjud id'larni saqlab qolamiz (jurnal yozuvlari reasonId orqali bog'langan).
        // Intizomiy ball (Points) "Ball sabablar"da belgilanadi — bu yerda qayta yaratilganda
        // id bo'yicha eski ballni saqlab qolamiz (aks holda 0 ga tushib qolardi).
        var oldPoints = await db.AbsenceReasons.ToDictionaryAsync(r => r.Id, r => r.Points);
        db.AbsenceReasons.RemoveRange(db.AbsenceReasons);
        db.AbsenceReasons.AddRange(req.AbsenceReasons.Select(r => new AbsenceReason
        {
            Id = string.IsNullOrWhiteSpace(r.Id) ? Guid.NewGuid().ToString() : r.Id,
            Name = r.Name,
            Short = r.Short,
            IsLate = r.IsLate,
            Points = oldPoints.GetValueOrDefault(r.Id, 0),
        }));
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Topshiriq turlari ----------

    [HttpGet("assignment-types")]
    public async Task<ActionResult<IEnumerable<AssignmentTypeDto>>> GetAssignmentTypes() =>
        await db.AssignmentTypes.Select(t => new AssignmentTypeDto(t.Id, t.Name)).ToListAsync();

    [HttpPut("assignment-types")]
    public async Task<IActionResult> SaveAssignmentTypes(SaveAssignmentTypesRequest req)
    {
        // Mavjud id'larni saqlaymiz (topshiriqlar TypeId orqali bog'langan).
        db.AssignmentTypes.RemoveRange(db.AssignmentTypes);
        db.AssignmentTypes.AddRange(req.Types
            .Where(t => !string.IsNullOrWhiteSpace(t.Name))
            .Select(t => new AssignmentType
            {
                Id = string.IsNullOrWhiteSpace(t.Id) ? Guid.NewGuid().ToString() : t.Id,
                Name = t.Name.Trim(),
            }));
        await db.SaveChangesAsync();
        return NoContent();
    }
}
