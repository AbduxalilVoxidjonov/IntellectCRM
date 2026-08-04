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

    // Buyurtma manbai: mijoz botdan bergan yoki markazda qo'lda sotilgan
    public const string SourceBot = "bot";
    public const string SourceManual = "manual";

    public static string PaymentLabel(string? method) =>
        method == PayCard ? "Karta" : method == PayCash ? "Naqd" : (method ?? "");

    public static string SourceLabel(string? source) =>
        source == SourceManual ? "Qo'lda" : "Bot";

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

    /// <summary>
    /// BUYURTMA RAQAMI NAVBATI — bir vaqtda faqat BITTA chaqiruv raqam oladi.
    /// Sabab: raqam bazadagi eng kattasidan keyingisi bo'lib beriladi, lekin raqam olingandan
    /// keyin buyurtma bazaga YOZILGUNCHA bir necha <c>await</c> bor (o'quvchi qidiruvi, chek
    /// saqlash va h.k.). Ikki kassir (yoki bot bilan kassir) bir vaqtda sotsa, ikkalasi ham bir
    /// xil "eng katta"ni ko'rib, IKKALA buyurtma ham <c>#57</c> bo'lib qolardi.
    /// Ilova BITTA nusxada ishlagani uchun jarayon ichidagi navbat yetarli
    /// (<c>TestCertificateService.NumberGate</c> bilan bir xil yondashuv).
    /// </summary>
    private static readonly SemaphoreSlim NumberGate = new(1, 1);

    /// <summary>
    /// Shu jarayonda oxirgi BERILGAN raqam — hali bazaga yozilmagan bo'lishi mumkin.
    /// Faqat qulfning o'zi yetmaydi: qulf ostida berilgan raqam bazada darhol paydo bo'lmaydi,
    /// shuning uchun keyingi chaqiruv <c>MAX(Number)</c> dan yana o'shani ko'rardi. Belgi shu
    /// "berildi, lekin hali saqlanmadi" oralig'ini qoplaydi.
    /// </summary>
    private static int _lastIssuedNumber;

    /// <summary>Keyingi ko'rsatiladigan buyurtma raqami (#1, #2 ...). Qarang: <see cref="NumberGate"/>.</summary>
    public static async Task<int> NextOrderNumberAsync(IAppDbContext db, CancellationToken ct = default)
    {
        await NumberGate.WaitAsync(ct);
        try
        {
            var max = await db.BookOrders.MaxAsync(o => (int?)o.Number, ct) ?? 0;
            // Raqam olingach buyurtma yozilmasligi mumkin (masalan qoldiq yetmadi) — u holda shu
            // raqam "kuyadi" va ro'yxatda bo'shliq qoladi. Bu takrorlanishdan ko'ra zararsizroq.
            var next = Math.Max(max, _lastIssuedNumber) + 1;
            _lastIssuedNumber = next;
            return next;
        }
        finally
        {
            NumberGate.Release();
        }
    }

    /// <summary>
    /// FAQAT TESTLAR uchun: raqam navbatining xotiradagi belgisini nolga qaytaradi. Har test o'z
    /// bazasi bilan ishlagani uchun, oldingi testdan qolgan belgi natijani buzmasin.
    /// </summary>
    public static void ResetOrderNumberSequence() => _lastIssuedNumber = 0;

    /// <summary>Telefon bo'yicha qidiruvda talab qilinadigan eng kam raqam soni.</summary>
    public const int MinPhoneDigits = 4;

    /// <summary>
    /// TELEFON QIDIRUVI mosligi (qo'lda sotuvda o'quvchi tanlash uchun).
    ///
    /// <para>Bazada raqam <c>+998-90-123-45-67</c> ko'rinishida saqlanadi, ya'ni HAMMA raqam
    /// <c>998</c> bilan boshlanadi. Shu sabab xom raqamlar ustida oddiy <c>Contains</c> qilinsa,
    /// "9989" kabi so'rov deyarli har bir o'quvchiga mos kelib, kassirga tasodifiy begona
    /// odamlar ro'yxatini chiqarardi.</para>
    ///
    /// <para>Yechim: ikkala tomon ham MAHALLIY qismga keltiriladi (mamlakat kodisiz oxirgi 9
    /// raqam — <see cref="PhoneUtil.Key"/>), keyin solishtiriladi. Shunda "9989" faqat mahalliy
    /// raqami aynan shu bo'lakni o'z ichiga olganlarga mos keladi.</para>
    /// </summary>
    /// <param name="stored">Bazadagi raqam (istalgan formatda).</param>
    /// <param name="needleKey">Qidiruv raqami — allaqachon <see cref="PhoneUtil.Key"/> dan o'tgan.</param>
    public static bool PhoneMatches(string? stored, string needleKey) =>
        needleKey.Length >= MinPhoneDigits && PhoneUtil.Key(stored).Contains(needleKey);

    /// <summary>
    /// QO'LDA SOTUV uchun kitob darvozasi: sotuvdan olingan (<c>IsActive=false</c>) kitobni
    /// sotib bo'lmaydi. Frontend'da bunday kitob ro'yxatda ko'rinmaydi, lekin API to'g'ridan-to'g'ri
    /// chaqirilsa tekshiruv YO'Q edi — sotuvdan olingan kitob baribir sotilardi.
    /// </summary>
    /// <returns><c>null</c> — sotsa bo'ladi; aks holda foydalanuvchiga ko'rsatiladigan xato matni.</returns>
    public static string? ManualSaleBookError(Book? book) =>
        book is null ? "Kitob topilmadi"
        : !book.IsActive ? "Kitob sotuvdan olingan — avval \"Sotuvda\" belgisini yoqing"
        : null;

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

        var move = Move(
            book, -order.Qty, ReasonSale,
            $"Buyurtma #{order.Number} — {order.CustomerName}".Trim(), decidedBy, order.Id);
        db.BookStockMoves.Add(move);

        order.Status = StatusApproved;
        order.RejectReason = string.Empty;
        order.DecidedAt = AppClock.Now;
        order.DecidedBy = decidedBy ?? string.Empty;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // QOLDIQ POYGASI: yuqoridagi tekshiruv bilan SaveChanges orasida BOSHQA amal
            // (ikkinchi kassir, bot buyurtmasini tasdiqlash, ombor korreksiyasi) shu kitobning
            // qoldig'ini o'zgartirgan. `Book.Stock` konkurentlik tokeni bo'lgani uchun (qarang:
            // AppDbContext, "Kitoblar sotuvi") EF ning UPDATE'i 0 qator yangilagan — ya'ni bazaga
            // HECH NARSA yozilmagan. Xotiradagi o'zgarishlarni ham qaytaramiz: chaqiruvchi
            // "ayrilgan" qoldiqni yoki "tasdiqlangan" buyurtmani ko'rib qolmasin.
            book.Stock += order.Qty;
            db.BookStockMoves.Remove(move);
            order.Status = StatusPending;
            order.DecidedAt = null;
            order.DecidedBy = string.Empty;
            return "Qoldiq shu payt boshqa amalda o'zgardi — qaytadan urinib ko'ring.";
        }
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
