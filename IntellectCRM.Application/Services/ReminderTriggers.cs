using System.Linq;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "Eslatmalar" (Sozlamalar → Eslatmalar) tur katalogi. Har bir <see cref="ReminderRule"/> shu
/// ro'yxatdagi bitta kalitga bog'lanadi — yangisi qo'shilsa shu yerga yozib qo'yish kifoya, frontend
/// forma va backend validatsiya shu katalogdan avtomatik ishlaydi.
/// </summary>
public static class ReminderTriggers
{
    /// <summary>Qarzdorlik eslatmasi — <see cref="PaymentReminderService"/> boshqaradi (jadval/matn qattiq kodlangan).</summary>
    public const string PaymentDebt = "payment_debt";

    /// <summary>O'qituvchiga "davomat kiriting" eslatmasi — <see cref="LessonAttendanceReminderService"/> boshqaradi.</summary>
    public const string LessonAttendance = "lesson_attendance";

    /// <summary>Erkin eslatma (admin belgilagan matn+auditoriya+jadval) — <see cref="CustomReminderService"/> boshqaradi.</summary>
    public const string CustomSchedule = "custom_schedule";

    public record TriggerInfo(
        string Key,
        string Label,
        string Description,
        bool SupportsTemplate,
        bool SupportsOffset,
        bool SupportsAudience,
        bool SupportsSchedule,
        bool SupportsSendScope,
        string[] Tokens);

    public static readonly TriggerInfo[] All =
    {
        new(
            PaymentDebt,
            "Qarzdorlik eslatmasi",
            "Balansi manfiy o'quvchilarga har oyning 1-sanasida, keyin har 2 kunda Telegram + push orqali batafsil eslatma (har kurs bo'yicha qarz).",
            SupportsTemplate: false,
            SupportsOffset: false,
            SupportsAudience: false,
            SupportsSchedule: false,
            SupportsSendScope: false,
            Tokens: System.Array.Empty<string>()),
        new(
            LessonAttendance,
            "Davomat eslatmasi (o'qituvchi)",
            "O'qituvchilarga davomat (jurnal) eslatmasi. Rejimlar: dars boshlangach to'ldirmaganga; " +
            "kunlik belgilangan vaqtda bugun darsi bo'lib to'ldirmaganlarga; yoki hammaga (to'ldirganlarga ham).",
            SupportsTemplate: true,
            SupportsOffset: true,
            SupportsAudience: false,
            SupportsSchedule: false,
            SupportsSendScope: true,
            Tokens: new[] { "{fish}", "{guruh}", "{kurs}", "{dars_vaqti}", "{telefon}", "{markaz}" }),
        new(
            CustomSchedule,
            "Erkin eslatma (jadval bo'yicha)",
            "O'zingiz belgilagan matn — tanlangan auditoriyaga (o'qituvchilar yoki o'quvchilar/ota-onalar) belgilangan jadval bo'yicha (har kuni yoki oyning muayyan kunida, belgilangan soatda) avtomatik push + Telegram eslatma.",
            SupportsTemplate: true,
            SupportsOffset: false,
            SupportsAudience: true,
            SupportsSchedule: true,
            SupportsSendScope: false,
            Tokens: new[] { "{fish}", "{telefon}", "{markaz}", "{sana}", "{oy}", "{yil}" }),
    };

    public static bool IsKnown(string? key) => !string.IsNullOrWhiteSpace(key) && All.Any(t => t.Key == key);
}

/// <summary>"Davomat eslatmasi" yuborish rejimi — <see cref="ReminderRule.SendScope"/> qiymatlari.</summary>
public static class ReminderSendScopes
{
    /// <summary>Dars boshlangach +N daqiqada, davomat kiritilmagan bo'lsa (default — eski xatti-harakat).</summary>
    public const string LessonStart = "lesson_start";
    /// <summary>Kunlik ScheduleTime'da — bugun darsi bo'lib (boshlangan) hali to'ldirmaganlarga.</summary>
    public const string NotFilled = "not_filled";
    /// <summary>Kunlik ScheduleTime'da — BARCHA faol o'qituvchilarga (to'ldirganlarga ham).</summary>
    public const string All = "all";

    public static bool IsKnown(string? key) => key is LessonStart or NotFilled or All;
}

/// <summary>"Erkin eslatma" auditoriyasi — <see cref="ReminderRule.Audience"/> qiymatlari.</summary>
public static class ReminderAudiences
{
    public const string Teachers = "teachers";
    /// <summary>O'quvchi (va uning ota-onasi — tizimda bir xil akkaunt/qurilma tokeni ishlatiladi).</summary>
    public const string Students = "students";

    public static bool IsKnown(string? key) => key == Teachers || key == Students;
}
