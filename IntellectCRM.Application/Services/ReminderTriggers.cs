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

    public record TriggerInfo(
        string Key,
        string Label,
        string Description,
        bool SupportsTemplate,
        bool SupportsOffset,
        string[] Tokens);

    public static readonly TriggerInfo[] All =
    {
        new(
            PaymentDebt,
            "Qarzdorlik eslatmasi",
            "Balansi manfiy o'quvchilarga har oyning 1-sanasida, keyin har 2 kunda Telegram + push orqali batafsil eslatma (har kurs bo'yicha qarz).",
            SupportsTemplate: false,
            SupportsOffset: false,
            Tokens: System.Array.Empty<string>()),
        new(
            LessonAttendance,
            "Davomat eslatmasi (o'qituvchi)",
            "Guruh darsi boshlangandan N daqiqa keyin, agar davomat hali kiritilmagan bo'lsa, guruh o'qituvchisiga push + Telegram orqali eslatma.",
            SupportsTemplate: true,
            SupportsOffset: true,
            Tokens: new[] { "{fish}", "{guruh}", "{kurs}", "{dars_vaqti}", "{telefon}", "{markaz}" }),
    };

    public static bool IsKnown(string? key) => !string.IsNullOrWhiteSpace(key) && All.Any(t => t.Key == key);
}
