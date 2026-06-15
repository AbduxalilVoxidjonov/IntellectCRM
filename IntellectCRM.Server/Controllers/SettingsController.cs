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
public class SettingsController(AppDbContext db, TelegramService telegram) : ControllerBase
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
            m?.Address ?? "", m?.Region ?? "", m?.District ?? "");
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

    // ---------- Push (Firebase / FCM) — faqat native (Flutter) ilovaga ----------
    // PWA/web push olib tashlandi: ilova FCM tokenni native oladi, server Service Account
    // JSON bilan o'sha tokenga push yuboradi (web config / VAPID kerak emas).

    [HttpGet("firebase")]
    public async Task<ActionResult<FirebaseSettingsDto>> GetFirebase()
    {
        var json = (await db.CenterMeta.FirstOrDefaultAsync())?.FcmServiceAccountJson ?? "";
        return new FirebaseSettingsDto(json, FcmService.IsConfigured(json));
    }

    [HttpPut("firebase")]
    public async Task<ActionResult<FirebaseSettingsDto>> SaveFirebase(SaveFirebaseSettingsRequest req)
    {
        var json = (req.ServiceAccountJson ?? "").Trim();
        if (json.Length > 0 && !FcmService.IsConfigured(json))
            return BadRequest(new { message = "Service account JSON noto'g'ri (client_email/private_key/project_id kerak)" });

        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.FcmServiceAccountJson = json;
        await db.SaveChangesAsync();
        return new FirebaseSettingsDto(json, FcmService.IsConfigured(json));
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

    // ---------- Avtomatik to'lov eslatmasi ----------

    [HttpGet("payment-reminders")]
    public async Task<ActionResult<PaymentReminderSettingsDto>> GetPaymentReminders()
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        // Yozuv hali yo'q bo'lsa — default YONIQ.
        return new PaymentReminderSettingsDto(m?.PaymentRemindersEnabled ?? true);
    }

    [HttpPut("payment-reminders")]
    public async Task<ActionResult<PaymentReminderSettingsDto>> SavePaymentReminders(
        SavePaymentReminderSettingsRequest req)
    {
        var m = await db.CenterMeta.FirstOrDefaultAsync();
        if (m is null) { m = new CenterMeta(); db.CenterMeta.Add(m); }
        m.PaymentRemindersEnabled = req.Enabled;
        await db.SaveChangesAsync();
        return new PaymentReminderSettingsDto(m.PaymentRemindersEnabled);
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
