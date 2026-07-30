using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Services;

/// <summary>
/// KITOBLAR SOTUVI — ombor va buyurtma mantig'ining YAGONA joyi. Admin panel
/// (<c>BooksController</c>) ham, Telegram bot (<see cref="BookShopBotService"/>) ham shu yerdan
/// foydalanadi, shunda "qoldiq qanday o'zgaradi" qoidasi ikki joyda ikki xil bo'lib ketmaydi.
///
/// <para><b>Qoldiq (ostatka) qoidasi:</b> <see cref="Book.Stock"/> — joriy qoldiq, va uning HAR
/// bir o'zgarishi <see cref="BookStockMove"/> ga yoziladi (musbat = kirim, manfiy = chiqim).
/// Buyurtma tushganda qoldiq TEGILMAYDI — faqat admin <b>tasdiqlaganda</b> ayiriladi (spetsifikatsiya:
/// "admin tasdiqlasa keyin o'quvchiga sotiladi ... sotilganidan keyin ostatkadan ayiradi").</para>
/// </summary>
public static class BookSalesService
{
    // Buyurtma holatlari
    public const string StatusPending = "pending";
    public const string StatusApproved = "approved";
    public const string StatusRejected = "rejected";

    // Ombor harakati sabablari
    public const string ReasonInitial = "initial";
    public const string ReasonRestock = "restock";
    public const string ReasonSale = "sale";
    public const string ReasonCorrection = "correction";

    // To'lov turlari (avtomatik to'lov tizimi YO'Q — faqat naqd yoki karta raqamiga o'tkazma)
    public const string PayCash = "cash";
    public const string PayCard = "card";

    public static string PaymentLabel(string? method) =>
        method == PayCard ? "Karta" : method == PayCash ? "Naqd" : (method ?? "");

    public static string StatusLabel(string? status) => status switch
    {
        StatusApproved => "Tasdiqlangan",
        StatusRejected => "Rad etilgan",
        _ => "Kutilmoqda",
    };

    /// <summary>
    /// Ombor qoldig'ini o'zgartiradi va tarixga (<see cref="BookStockMove"/>) yozadi.
    /// <paramref name="qty"/> musbat = kirim, manfiy = chiqim. <b>SaveChanges chaqirilmaydi</b> —
    /// chaqiruvchi o'z tranzaksiyasida saqlaydi (buyurtma tasdiqlash bilan bitta SaveChanges'da ketsin).
    /// </summary>
    public static BookStockMove Move(
        Book book, int qty, string reason, string note, string createdBy, string? orderId = null)
    {
        book.Stock += qty;
        return new BookStockMove
        {
            BookId = book.Id,
            BookTitle = book.Title,
            Qty = qty,
            Reason = reason,
            OrderId = orderId,
            Note = note ?? string.Empty,
            StockAfter = book.Stock,
            CreatedBy = createdBy ?? string.Empty,
        };
    }

    /// <summary>Keyingi ko'rsatiladigan buyurtma raqami (#1, #2 ...).</summary>
    public static async Task<int> NextOrderNumberAsync(IAppDbContext db, CancellationToken ct = default)
    {
        var max = await db.BookOrders.MaxAsync(o => (int?)o.Number, ct) ?? 0;
        return max + 1;
    }

    /// <summary>
    /// Buyurtmani TASDIQLAYDI: qoldiqdan kitob soni ayiriladi, harakat tarixi yoziladi, holat
    /// <c>approved</c> bo'ladi. Qoldiq yetmasa yoki buyurtma allaqachon hal qilingan bo'lsa —
    /// o'zgartirmasdan xato matnini qaytaradi (chaqiruvchi 400 qiladi va mijozga xabar yubormaydi).
    /// </summary>
    /// <returns><c>null</c> — muvaffaqiyat; aks holda foydalanuvchiga ko'rsatiladigan xato matni.</returns>
    public static async Task<string?> ApproveAsync(
        IAppDbContext db, BookOrder order, string decidedBy, CancellationToken ct = default)
    {
        if (order.Status != StatusPending)
            return $"Buyurtma allaqachon hal qilingan ({StatusLabel(order.Status)}).";

        var book = await db.Books.FirstOrDefaultAsync(x => x.Id == order.BookId, ct);
        if (book is null) return "Kitob topilmadi (o'chirilgan bo'lishi mumkin).";
        if (book.Stock < order.Qty)
            return $"Omborda yetarli emas: qoldiq {book.Stock} dona, buyurtma {order.Qty} dona.";

        db.BookStockMoves.Add(Move(
            book, -order.Qty, ReasonSale,
            $"Buyurtma #{order.Number} — {order.CustomerName}".Trim(), decidedBy, order.Id));

        order.Status = StatusApproved;
        order.RejectReason = string.Empty;
        order.DecidedAt = AppClock.Now;
        order.DecidedBy = decidedBy ?? string.Empty;
        await db.SaveChangesAsync(ct);
        return null;
    }

    /// <summary>Buyurtmani RAD etadi (sabab bilan). Qoldiq tegilmaydi.</summary>
    /// <returns><c>null</c> — muvaffaqiyat; aks holda xato matni.</returns>
    public static async Task<string?> RejectAsync(
        IAppDbContext db, BookOrder order, string reason, string decidedBy, CancellationToken ct = default)
    {
        if (order.Status != StatusPending)
            return $"Buyurtma allaqachon hal qilingan ({StatusLabel(order.Status)}).";

        order.Status = StatusRejected;
        order.RejectReason = (reason ?? string.Empty).Trim();
        order.DecidedAt = AppClock.Now;
        order.DecidedBy = decidedBy ?? string.Empty;
        await db.SaveChangesAsync(ct);
        return null;
    }

    // ---------------------------------------------------------------------------------
    //  Mijozga (botga) yuboriladigan xabar matnlari — controller ham, bot ham shu yerdan oladi
    // ---------------------------------------------------------------------------------

    public static string CustomerApprovedText(BookOrder o)
    {
        var lines = new List<string>
        {
            "✅ Buyurtmangiz tasdiqlandi!",
            "",
            $"📕 {o.BookTitle}",
            $"🔢 Soni: {o.Qty} dona",
            $"💰 Summa: {AuditService.Money(o.Total)} so'm",
            $"💳 To'lov: {PaymentLabel(o.PaymentMethod)}",
        };
        if (o.PaymentMethod == PayCash)
            lines.Add("\n💵 To'lovni kitobni olib ketayotganda markaz kassasiga topshirasiz.");
        lines.Add("\n📍 Kitobni markazdan olib ketishingiz mumkin. Savol bo'lsa administratorga yozing.");
        return string.Join("\n", lines);
    }

    public static string CustomerRejectedText(BookOrder o)
    {
        var reason = string.IsNullOrWhiteSpace(o.RejectReason) ? "Sabab ko'rsatilmagan." : o.RejectReason;
        return string.Join("\n", new[]
        {
            "❌ Buyurtmangiz rad etildi.",
            "",
            $"📕 {o.BookTitle} — {o.Qty} dona",
            $"💬 Sabab: {reason}",
            "",
            "Savolingiz bo'lsa «✍️ Adminga murojaat» tugmasi orqali yozing.",
        });
    }

    /// <summary>Adminlarga (Telegram) yuboriladigan "yangi buyurtma" xabari.</summary>
    public static string AdminNewOrderText(BookOrder o)
    {
        var lines = new List<string>
        {
            "📚 Yangi kitob buyurtmasi!",
            $"#️⃣ Buyurtma: #{o.Number}",
            $"👤 {(string.IsNullOrWhiteSpace(o.CustomerName) ? "Noma'lum" : o.CustomerName)}",
        };
        if (!string.IsNullOrWhiteSpace(o.Phone)) lines.Add($"📞 {o.Phone}");
        lines.Add($"📕 {o.BookTitle}");
        lines.Add($"🔢 Soni: {o.Qty} dona");
        lines.Add($"💰 Summa: {AuditService.Money(o.Total)} so'm");
        lines.Add($"💳 To'lov turi: {PaymentLabel(o.PaymentMethod)}");
        if (o.PaymentMethod == PayCard)
            lines.Add(string.IsNullOrWhiteSpace(o.ReceiptUrl) ? "🧾 Chek: yuborilmagan" : "🧾 Chek: yuborildi");
        lines.Add("");
        lines.Add("Tasdiqlash/rad etish: Admin panel → O'quv bo'limi → Kitoblar sotuvi.");
        return string.Join("\n", lines);
    }

    /// <summary>
    /// Yangi buyurtma haqida ADMIN/SUPERADMIN'larga Telegram xabarnomasi (botga bog'langan
    /// <see cref="TelegramRegistration"/> orqali). Xato xabarnomani buyurtmani buzmasligi kerak —
    /// jim yutiladi (<see cref="LeadNotifier"/> bilan bir xil siyosat).
    /// </summary>
    public static async Task NotifyAdminsAsync(
        IAppDbContext db, TelegramService telegram, BookOrder order, CancellationToken ct = default)
    {
        try
        {
            if (!telegram.IsConfigured) return;
            var regs = await db.TelegramRegistrations
                .Where(r => r.UserId != null && r.UserId != "").ToListAsync(ct);
            if (regs.Count == 0) return;

            var userIds = regs.Select(r => r.UserId!).Distinct().ToList();
            var adminIds = (await db.Users
                    .Where(u => userIds.Contains(u.Id) && (u.Role == Roles.Admin || u.Role == Roles.SuperAdmin))
                    .Select(u => u.Id).ToListAsync(ct))
                .ToHashSet();
            if (adminIds.Count == 0) return;

            var text = AdminNewOrderText(order);
            var sent = new HashSet<long>();
            foreach (var r in regs)
            {
                if (r.UserId is null || !adminIds.Contains(r.UserId)) continue;
                if (!sent.Add(r.ChatId)) continue;
                await telegram.SendMessageAsync(r.ChatId, text, ct: ct);
            }
        }
        catch
        {
            // Xabarnoma buyurtmani buzmasligi kerak.
        }
    }
}
