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
            Tokens: System.Array.Empty<string>()),
        new(
            LessonAttendance,
            "Davomat eslatmasi (o'qituvchi)",
            "Guruh darsi boshlangandan N daqiqa keyin, agar davomat hali kiritilmagan bo'lsa, guruh o'qituvchisiga push + Telegram orqali eslatma.",
            SupportsTemplate: true,
            SupportsOffset: true,
            SupportsAudience: false,
            SupportsSchedule: false,
            Tokens: new[] { "{fish}", "{guruh}", "{kurs}", "{dars_vaqti}", "{telefon}", "{markaz}" }),
        new(
            CustomSchedule,
            "Erkin eslatma (jadval bo'yicha)",
            "O'zingiz belgilagan matn — tanlangan auditoriyaga (o'qituvchilar yoki o'quvchilar/ota-onalar) belgilangan jadval bo'yicha (har kuni yoki oyning muayyan kunida, belgilangan soatda) avtomatik push + Telegram eslatma.",
            SupportsTemplate: true,
            SupportsOffset: false,
            SupportsAudience: true,
            SupportsSchedule: true,
            Tokens: new[] { "{fish}", "{telefon}", "{markaz}", "{sana}", "{oy}", "{yil}" }),
    };

    public static bool IsKnown(string? key) => !string.IsNullOrWhiteSpace(key) && All.Any(t => t.Key == key);
}

/// <summary>"Erkin eslatma" auditoriyasi — <see cref="ReminderRule.Audience"/> qiymatlari.</summary>
public static class ReminderAudiences
{
    public const string Teachers = "teachers";
    /// <summary>O'quvchi (va uning ota-onasi — tizimda bir xil akkaunt/qurilma tokeni ishlatiladi).</summary>
    public const string Students = "students";

    public static bool IsKnown(string? key) => key == Teachers || key == Students;
}
