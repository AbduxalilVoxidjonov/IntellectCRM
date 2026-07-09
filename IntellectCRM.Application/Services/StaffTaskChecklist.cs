using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>Xodim kunlik checklisti Telegram ko'rinishi — YAGONA joy (jo'natish xizmati ham, bot
/// callback ham shundan foydalanadi, tugmalar bir xil bo'lishi uchun).</summary>
public static class StaffTaskChecklist
{
    /// <summary>Callback data prefiksi: "stask:{logId}".</summary>
    public const string CallbackPrefix = "stask:";

    /// <summary>Checklist inline-klaviaturasi: har band bitta tugma (☐ / ✅ holati bilan).</summary>
    public static object Keyboard(IEnumerable<StaffTaskLog> logs) => new
    {
        inline_keyboard = logs
            .OrderBy(l => l.Order).ThenBy(l => l.Title)
            .Select(l => new object[]
            {
                new { text = (l.Done ? "✅ " : "☐ ") + l.Title, callback_data = CallbackPrefix + l.Id },
            })
            .ToArray(),
    };

    /// <summary>Checklist xabari sarlavhasi (sana bilan).</summary>
    public static string HeaderText(string dateIso)
    {
        var d = dateIso.Length >= 10 ? $"{dateIso[8..10]}.{dateIso[5..7]}.{dateIso[..4]}" : dateIso;
        return $"📋 Bugungi topshiriqlar ({d}):\n\n" +
               "Bajarilgan topshiriq ustiga bosing — ✅ bo'ladi (xato bo'lsa qayta bossangiz — bekor qilinadi).";
    }
}
