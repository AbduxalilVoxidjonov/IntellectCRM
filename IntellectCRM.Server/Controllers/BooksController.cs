using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using IntellectCRM.Infrastructure.Data;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// KITOBLAR SOTUVI — "O'quv bo'limi → Kitoblar sotuvi" bo'limining API'si:
/// <list type="bullet">
///   <item><b>Ombor</b> — kitob CRUD (nom, narx, muqova, tavsif) + qoldiq kirim/korreksiya
///     (<c>POST /{id}/stock</c>) va butun ombor harakatlari tarixi.</item>
///   <item><b>Buyurtmalar</b> — botdan tushgan buyurtmalarni tasdiqlash/rad etish. Tasdiqlanganda
///     qoldiqdan ayiriladi (<see cref="BookSalesService.ApproveAsync"/>) va mijozga Telegram'da
///     xabar ketadi; rad etilganda sabab bilan xabar ketadi.</item>
///   <item><b>Analitika</b> — davr bo'yicha sotuv (dona/tushum), naqd va karta kesimi, kunlik grafik,
///     kitob kesimidagi top, qoldiq va kirim jami. Barchasi Excel'ga yuklanadi.</item>
///   <item><b>Sozlamalar</b> — botda ko'rinadigan KARTA rekvizitlari (CenterMeta'da).</item>
/// </list>
/// Ruxsat kaliti: <c>books</c> (xodim uchun; admin/superadmin — cheklovsiz).
/// </summary>
[ApiController]
[Authorize]
[AdminPerm("books")]
[Route("api/admin/books")]
public class BooksController(AppDbContext db, TelegramService telegram, IWebHostEnvironment env) : ControllerBase
{
    private const string XlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private string Actor => User.FindFirst(ClaimTypes.Name)?.Value ?? "Admin";

    // =============================================================================================
    //  OMBOR — kitoblar CRUD
    // =============================================================================================

    /// <summary>Barcha kitoblar (qoldiq + sotuv statistikasi bilan). <paramref name="activeOnly"/>
    /// berilsa faqat sotuvdagilar.</summary>
    [HttpGet]
    public async Task<ActionResult<List<BookDto>>> GetAll([FromQuery] bool activeOnly = false)
    {
        var query = db.Books.AsNoTracking().AsQueryable();
        if (activeOnly) query = query.Where(b => b.IsActive);
        var books = await query.OrderBy(b => b.Title).ToListAsync();
        return await ToDtosAsync(books);
    }

    /// <summary>Kitoblar ro'yxatiga sotuv/kutilayotgan statistikani biriktiradi (N+1 bo'lmasin —
    /// buyurtmalar BIR marta guruhlab o'qiladi).</summary>
    private async Task<List<BookDto>> ToDtosAsync(List<Book> books)
    {
        var ids = books.Select(b => b.Id).ToList();
        var stats = await db.BookOrders.AsNoTracking()
            .Where(o => ids.Contains(o.BookId))
            .GroupBy(o => new { o.BookId, o.Status })
            .Select(g => new { g.Key.BookId, g.Key.Status, Qty = g.Sum(x => x.Qty), Total = g.Sum(x => x.Total) })
            .ToListAsync();

        return books.Select(b =>
        {
            var sold = stats.FirstOrDefault(s => s.BookId == b.Id && s.Status == BookSalesService.StatusApproved);
            var pending = stats.FirstOrDefault(s => s.BookId == b.Id && s.Status == BookSalesService.StatusPending);
            return new BookDto(
                b.Id, b.Title, b.Author, b.Description, b.CoverUrl, b.Price, b.Stock, b.IsActive,
                sold?.Qty ?? 0, sold?.Total ?? 0m, pending?.Qty ?? 0,
                b.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"), b.CreatedBy);
        }).ToList();
    }

    /// <summary>Yangi kitob. <c>InitialStock</c> berilsa boshlang'ich qoldiq "initial" kirim sifatida
    /// tarixga ham yoziladi (kitob qachon va qancha miqdorda kirim qilingani hisoboti uchun).</summary>
    [HttpPost]
    public async Task<ActionResult<BookDto>> Create(BookPayload payload)
    {
        var title = (payload.Title ?? "").Trim();
        if (title.Length == 0) return BadRequest(new { message = "Kitob nomi kerak" });
        if (payload.Price < 0) return BadRequest(new { message = "Narx manfiy bo'lmaydi" });
        if (payload.InitialStock < 0) return BadRequest(new { message = "Boshlang'ich qoldiq manfiy bo'lmaydi" });

        var book = new Book
        {
            Title = title,
            Author = (payload.Author ?? "").Trim(),
            Description = (payload.Description ?? "").Trim(),
            CoverUrl = (payload.CoverUrl ?? "").Trim(),
            Price = payload.Price,
            Stock = 0,
            IsActive = payload.IsActive,
            CreatedBy = Actor,
        };
        db.Books.Add(book);

        if (payload.InitialStock > 0)
            db.BookStockMoves.Add(BookSalesService.Move(
                book, payload.InitialStock, BookSalesService.ReasonInitial,
                "Kitob qo'shildi (boshlang'ich qoldiq)", Actor));

        await db.SaveChangesAsync();
        return (await ToDtosAsync(new List<Book> { book }))[0];
    }

    /// <summary>Kitobni tahrirlash (nom/narx/muqova/tavsif/holat). QOLDIQ bu yerda o'zgarmaydi —
    /// u faqat <c>POST /{id}/stock</c> orqali (tarix yoziladigan) yo'l bilan o'zgaradi.</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<BookDto>> Update(string id, BookPayload payload)
    {
        var book = await db.Books.FirstOrDefaultAsync(b => b.Id == id);
        if (book is null) return NotFound();
        var title = (payload.Title ?? "").Trim();
        if (title.Length == 0) return BadRequest(new { message = "Kitob nomi kerak" });
        if (payload.Price < 0) return BadRequest(new { message = "Narx manfiy bo'lmaydi" });

        var newCover = (payload.CoverUrl ?? "").Trim();
        // Muqova o'zgarsa Telegram keshini bo'shatamiz — aks holda bot eski rasmni yuboraverardi.
        if (newCover != book.CoverUrl) book.CoverFileId = string.Empty;

        book.Title = title;
        book.Author = (payload.Author ?? "").Trim();
        book.Description = (payload.Description ?? "").Trim();
        book.CoverUrl = newCover;
        book.Price = payload.Price;
        book.IsActive = payload.IsActive;
        await db.SaveChangesAsync();
        return (await ToDtosAsync(new List<Book> { book }))[0];
    }

    /// <summary>Kitobni o'chirish. Buyurtma tarixi bor kitob O'CHIRILMAYDI (hisobot buzilmasin) —
    /// uni "sotuvdan olish" (<c>IsActive=false</c>) kerak. Ombor harakatlari tarixi o'chadi.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var book = await db.Books.FirstOrDefaultAsync(b => b.Id == id);
        if (book is null) return NotFound();

        if (await db.BookOrders.AnyAsync(o => o.BookId == id))
            return BadRequest(new
            {
                message = "Bu kitob bo'yicha buyurtmalar bor — o'chirib bo'lmaydi. "
                          + "Uni sotuvdan olish uchun \"Sotuvda\" belgisini o'chiring.",
            });

        await db.BookStockMoves.Where(m => m.BookId == id).ExecuteDeleteAsync();
        db.Books.Remove(book);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Omborga KIRIM (yoki qo'lda korreksiya). <c>Qty &gt; 0</c> — kirim ("qoldiq to'ldirildi"),
    /// <c>Qty &lt; 0</c> — ayirish (yo'qolgan/buzilgan kitob). Har amal tarixga yoziladi.
    /// </summary>
    [HttpPost("{id}/stock")]
    public async Task<ActionResult<BookDto>> AddStock(string id, BookStockPayload payload)
    {
        var book = await db.Books.FirstOrDefaultAsync(b => b.Id == id);
        if (book is null) return NotFound();
        if (payload.Qty == 0) return BadRequest(new { message = "Miqdor 0 bo'lmasligi kerak" });
        if (book.Stock + payload.Qty < 0)
            return BadRequest(new { message = $"Qoldiq manfiy bo'lib qoladi (joriy qoldiq {book.Stock})" });

        var reason = payload.Qty > 0 ? BookSalesService.ReasonRestock : BookSalesService.ReasonCorrection;
        db.BookStockMoves.Add(BookSalesService.Move(book, payload.Qty, reason, payload.Note ?? "", Actor));
        await db.SaveChangesAsync();
        return (await ToDtosAsync(new List<Book> { book }))[0];
    }

    /// <summary>Ombor harakatlari tarixi (kirim/sotuv/korreksiya). <paramref name="onlyIn"/> = true —
    /// faqat KIRIM (kitoblar qachon va qancha miqdorda qo'shilgani).</summary>
    [HttpGet("stock-moves")]
    public async Task<ActionResult<List<BookStockMoveDto>>> StockMoves(
        [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? bookId,
        [FromQuery] bool onlyIn = false)
    {
        var moves = await FilteredMovesAsync(from, to, bookId, onlyIn);
        return moves.Select(ToMoveDto).ToList();
    }

    private async Task<List<BookStockMove>> FilteredMovesAsync(
        string? from, string? to, string? bookId, bool onlyIn)
    {
        var query = db.BookStockMoves.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(bookId)) query = query.Where(m => m.BookId == bookId);
        if (onlyIn) query = query.Where(m => m.Qty > 0);
        var (fromDt, toDt) = DateRange(from, to);
        if (fromDt is not null) query = query.Where(m => m.CreatedAt >= fromDt);
        if (toDt is not null) query = query.Where(m => m.CreatedAt < toDt);
        return await query.OrderByDescending(m => m.CreatedAt).Take(2000).ToListAsync();
    }

    private static BookStockMoveDto ToMoveDto(BookStockMove m) => new(
        m.Id, m.BookId, m.BookTitle, m.Qty, m.Reason, m.OrderId, m.Note, m.StockAfter,
        m.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"), m.CreatedBy);

    // =============================================================================================
    //  BUYURTMALAR
    // =============================================================================================

    /// <summary>Buyurtmalar ro'yxati. Filtrlar: holat, davr, kitob, to'lov turi, qidiruv (ism/telefon/
    /// buyurtma raqami). Eng yangisi yuqorida.</summary>
    [HttpGet("orders")]
    public async Task<ActionResult<List<BookOrderDto>>> Orders(
        [FromQuery] string? status, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? bookId, [FromQuery] string? method, [FromQuery] string? q)
    {
        var orders = await FilteredOrdersAsync(status, from, to, bookId, method, q);
        return await ToOrderDtosAsync(orders);
    }

    private async Task<List<BookOrder>> FilteredOrdersAsync(
        string? status, string? from, string? to, string? bookId, string? method, string? q)
    {
        var query = db.BookOrders.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
        if (!string.IsNullOrWhiteSpace(bookId)) query = query.Where(o => o.BookId == bookId);
        if (!string.IsNullOrWhiteSpace(method)) query = query.Where(o => o.PaymentMethod == method);
        var (fromDt, toDt) = DateRange(from, to);
        if (fromDt is not null) query = query.Where(o => o.CreatedAt >= fromDt);
        if (toDt is not null) query = query.Where(o => o.CreatedAt < toDt);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var digits = PhoneUtil.DigitsOnly(term);
            query = digits.Length >= 4
                ? query.Where(o => o.Phone.Contains(digits) || o.CustomerName.Contains(term))
                : query.Where(o => o.CustomerName.Contains(term) || o.BookTitle.Contains(term)
                                   || o.Number.ToString().Contains(term));
        }
        return await query.OrderByDescending(o => o.CreatedAt).Take(1000).ToListAsync();
    }

    /// <summary>Buyurtmalarga o'quvchi ismi va kitobning joriy qoldig'ini biriktiradi (bitta so'rovda).</summary>
    private async Task<List<BookOrderDto>> ToOrderDtosAsync(List<BookOrder> orders)
    {
        var studentIds = orders.Where(o => !string.IsNullOrEmpty(o.StudentId))
            .Select(o => o.StudentId!).Distinct().ToList();
        var names = studentIds.Count == 0
            ? new Dictionary<string, string>()
            : await db.Students.AsNoTracking().Where(s => studentIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => s.FullName);

        var bookIds = orders.Select(o => o.BookId).Distinct().ToList();
        var stocks = bookIds.Count == 0
            ? new Dictionary<string, int>()
            : await db.Books.AsNoTracking().Where(b => bookIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, b => b.Stock);

        return orders.Select(o => new BookOrderDto(
            o.Id, o.Number, o.CustomerName, o.Phone, o.StudentId,
            o.StudentId is null ? null : names.GetValueOrDefault(o.StudentId),
            o.BookId, o.BookTitle, o.UnitPrice, o.Qty, o.Total, o.PaymentMethod, o.ReceiptUrl,
            o.Status, o.RejectReason, o.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss"),
            o.DecidedAt?.ToString("yyyy-MM-ddTHH:mm:ss"), o.DecidedBy,
            stocks.GetValueOrDefault(o.BookId, 0))).ToList();
    }

    /// <summary>Kutilayotgan buyurtmalar soni (nav/tab belgisi uchun).</summary>
    [HttpGet("orders/pending-count")]
    public async Task<ActionResult<object>> PendingCount() =>
        Ok(new { count = await db.BookOrders.CountAsync(o => o.Status == BookSalesService.StatusPending) });

    /// <summary>
    /// Buyurtmani TASDIQLASH: qoldiqdan kitob soni ayiriladi, sotuv analitikaga tushadi va mijozga
    /// botda "Buyurtmangiz tasdiqlandi!" xabari ketadi.
    /// </summary>
    [HttpPost("orders/{id}/approve")]
    public async Task<ActionResult<BookOrderDto>> Approve(string id)
    {
        var order = await db.BookOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();

        var error = await BookSalesService.ApproveAsync(db, order, Actor);
        if (error is not null) return BadRequest(new { message = error });

        await telegram.SendMessageAsync(order.ChatId, BookSalesService.CustomerApprovedText(order));
        return (await ToOrderDtosAsync(new List<BookOrder> { order }))[0];
    }

    /// <summary>Buyurtmani RAD etish (sabab bilan). Qoldiq tegilmaydi; mijozga sabab yuboriladi.</summary>
    [HttpPost("orders/{id}/reject")]
    public async Task<ActionResult<BookOrderDto>> Reject(string id, BookRejectPayload payload)
    {
        var order = await db.BookOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return NotFound();
        if (string.IsNullOrWhiteSpace(payload.Reason))
            return BadRequest(new { message = "Rad etish sababini kiriting" });

        var error = await BookSalesService.RejectAsync(db, order, payload.Reason, Actor);
        if (error is not null) return BadRequest(new { message = error });

        await telegram.SendMessageAsync(order.ChatId, BookSalesService.CustomerRejectedText(order));
        return (await ToOrderDtosAsync(new List<BookOrder> { order }))[0];
    }

    // =============================================================================================
    //  ANALITIKA
    // =============================================================================================

    /// <summary>
    /// Davr bo'yicha kitoblar sotuvi analitikasi. Tushum FAQAT tasdiqlangan buyurtmalardan
    /// hisoblanadi (kutilayotgan/rad etilgan pul emas). Naqd va karta alohida ko'rsatiladi.
    /// </summary>
    [HttpGet("analytics")]
    public async Task<ActionResult<BookAnalyticsDto>> Analytics([FromQuery] string? from, [FromQuery] string? to)
        => await BuildAnalyticsAsync(from, to);

    private async Task<BookAnalyticsDto> BuildAnalyticsAsync(string? from, string? to)
    {
        var (fromDt, toDt) = DateRange(from, to);

        var ordersQuery = db.BookOrders.AsNoTracking().AsQueryable();
        if (fromDt is not null) ordersQuery = ordersQuery.Where(o => o.CreatedAt >= fromDt);
        if (toDt is not null) ordersQuery = ordersQuery.Where(o => o.CreatedAt < toDt);
        var orders = await ordersQuery.ToListAsync();

        var approved = orders.Where(o => o.Status == BookSalesService.StatusApproved).ToList();
        var books = await db.Books.AsNoTracking().ToListAsync();
        var stockById = books.ToDictionary(b => b.Id, b => b.Stock);

        var byDay = approved
            .GroupBy(o => (o.DecidedAt ?? o.CreatedAt).ToString("yyyy-MM-dd"))
            .OrderBy(g => g.Key)
            .Select(g => new BookDaySalesDto(
                g.Key,
                g.Sum(x => x.Qty),
                g.Where(x => x.PaymentMethod == BookSalesService.PayCash).Sum(x => x.Total),
                g.Where(x => x.PaymentMethod == BookSalesService.PayCard).Sum(x => x.Total),
                g.Sum(x => x.Total)))
            .ToList();

        var byBook = approved
            .GroupBy(o => new { o.BookId, o.BookTitle })
            .Select(g => new BookSalesByBookDto(
                g.Key.BookId, g.Key.BookTitle, g.Sum(x => x.Qty), g.Sum(x => x.Total),
                stockById.GetValueOrDefault(g.Key.BookId, 0)))
            .OrderByDescending(x => x.Qty)
            .ToList();

        var lowStock = books
            .Where(b => b.IsActive && b.Stock <= 3)
            .OrderBy(b => b.Stock).ThenBy(b => b.Title)
            .Select(b => new BookSalesByBookDto(b.Id, b.Title, 0, 0m, b.Stock))
            .ToList();

        var movesQuery = db.BookStockMoves.AsNoTracking().Where(m => m.Qty > 0);
        if (fromDt is not null) movesQuery = movesQuery.Where(m => m.CreatedAt >= fromDt);
        if (toDt is not null) movesQuery = movesQuery.Where(m => m.CreatedAt < toDt);
        var stockIn = await movesQuery.SumAsync(m => (int?)m.Qty) ?? 0;

        return new BookAnalyticsDto(
            From: from ?? "", To: to ?? "",
            OrdersApproved: approved.Count,
            OrdersPending: orders.Count(o => o.Status == BookSalesService.StatusPending),
            OrdersRejected: orders.Count(o => o.Status == BookSalesService.StatusRejected),
            SoldQty: approved.Sum(o => o.Qty),
            RevenueCash: approved.Where(o => o.PaymentMethod == BookSalesService.PayCash).Sum(o => o.Total),
            RevenueCard: approved.Where(o => o.PaymentMethod == BookSalesService.PayCard).Sum(o => o.Total),
            RevenueTotal: approved.Sum(o => o.Total),
            StockTotal: books.Sum(b => b.Stock),
            StockInQty: stockIn,
            ByDay: byDay,
            ByBook: byBook,
            LowStock: lowStock);
    }

    // =============================================================================================
    //  EXCEL EKSPORT
    // =============================================================================================

    /// <summary>Sotuvlar tarixi (buyurtmalar) — .xlsx. Filtrlar ro'yxatdagi bilan bir xil.</summary>
    [HttpGet("orders/export")]
    public async Task<IActionResult> ExportOrders(
        [FromQuery] string? status, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? bookId, [FromQuery] string? method, [FromQuery] string? q)
    {
        var dtos = await ToOrderDtosAsync(await FilteredOrdersAsync(status, from, to, bookId, method, q));
        var headers = new[]
        {
            "№", "Sana", "Mijoz", "Telefon", "O'quvchi", "Kitob", "Soni",
            "Narx", "Summa", "To'lov turi", "Holat", "Sabab", "Qaror vaqti", "Qaror qildi",
        };
        var rows = dtos.Select(o => (IReadOnlyList<string>)new[]
        {
            o.Number.ToString(),
            o.CreatedAt.Replace('T', ' '),
            o.CustomerName,
            o.Phone,
            o.StudentName ?? "",
            o.BookTitle,
            o.Qty.ToString(),
            AuditService.Money(o.UnitPrice),
            AuditService.Money(o.Total),
            BookSalesService.PaymentLabel(o.PaymentMethod),
            BookSalesService.StatusLabel(o.Status),
            o.RejectReason,
            o.DecidedAt?.Replace('T', ' ') ?? "",
            o.DecidedBy,
        });
        return File(ExcelExport.Build("Kitob sotuvlari", headers, rows), XlsxMime,
            $"kitob_sotuvlari_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    /// <summary>Ombor harakatlari (kirim tarixi) — .xlsx.</summary>
    [HttpGet("stock-moves/export")]
    public async Task<IActionResult> ExportStockMoves(
        [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? bookId,
        [FromQuery] bool onlyIn = false)
    {
        var moves = await FilteredMovesAsync(from, to, bookId, onlyIn);
        var headers = new[] { "Sana", "Kitob", "Miqdor", "Turi", "Izoh", "Qoldiq (keyin)", "Kim" };
        var rows = moves.Select(m => (IReadOnlyList<string>)new[]
        {
            m.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            m.BookTitle,
            (m.Qty > 0 ? "+" : "") + m.Qty,
            ReasonLabel(m.Reason),
            m.Note,
            m.StockAfter.ToString(),
            m.CreatedBy,
        });
        return File(ExcelExport.Build("Ombor harakati", headers, rows), XlsxMime,
            $"kitob_ombor_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    /// <summary>Moliyaviy/analitik hisobot — 3 varaqli .xlsx: umumiy, kunlik, kitob kesimi.</summary>
    [HttpGet("analytics/export")]
    public async Task<IActionResult> ExportAnalytics([FromQuery] string? from, [FromQuery] string? to)
    {
        var a = await BuildAnalyticsAsync(from, to);

        var summary = new List<IReadOnlyList<string>>
        {
            new[] { "Davr", $"{(a.From.Length > 0 ? a.From : "boshidan")} — {(a.To.Length > 0 ? a.To : "hozirgacha")}" },
            new[] { "Tasdiqlangan buyurtmalar", a.OrdersApproved.ToString() },
            new[] { "Kutilayotgan buyurtmalar", a.OrdersPending.ToString() },
            new[] { "Rad etilgan buyurtmalar", a.OrdersRejected.ToString() },
            new[] { "Sotilgan kitob (dona)", a.SoldQty.ToString() },
            new[] { "Tushum — Naqd (so'm)", AuditService.Money(a.RevenueCash) },
            new[] { "Tushum — Karta (so'm)", AuditService.Money(a.RevenueCard) },
            new[] { "Tushum — Jami (so'm)", AuditService.Money(a.RevenueTotal) },
            new[] { "Davr ichida kirim (dona)", a.StockInQty.ToString() },
            new[] { "Ombordagi qoldiq (dona)", a.StockTotal.ToString() },
        };

        var bytes = ExcelExport.Build(new[]
        {
            new ExcelExport.SheetSpec("Umumiy", new[] { "Ko'rsatkich", "Qiymat" }, summary),
            new ExcelExport.SheetSpec("Kunlik",
                new[] { "Sana", "Dona", "Naqd", "Karta", "Jami" },
                a.ByDay.Select(d => (IReadOnlyList<string>)new[]
                {
                    d.Date, d.Qty.ToString(), AuditService.Money(d.Cash),
                    AuditService.Money(d.Card), AuditService.Money(d.Total),
                })),
            new ExcelExport.SheetSpec("Kitoblar",
                new[] { "Kitob", "Sotilgan (dona)", "Tushum", "Joriy qoldiq" },
                a.ByBook.Select(b => (IReadOnlyList<string>)new[]
                {
                    b.BookTitle, b.Qty.ToString(), AuditService.Money(b.Total), b.Stock.ToString(),
                })),
        });
        return File(bytes, XlsxMime, $"kitob_hisobot_{AppClock.Now:yyyy-MM-dd}.xlsx");
    }

    // =============================================================================================
    //  SOZLAMALAR — botda ko'rinadigan to'lov rekvizitlari
    // =============================================================================================

    /// <summary>Botdagi kitob sotuvi sozlamalari (karta raqami/egasi). Maxfiy emas — mijozga
    /// baribir ko'rsatiladi, shuning uchun bazada (CenterMeta) saqlanadi.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<BookSettingsDto>> GetSettings()
    {
        var meta = await db.CenterMeta.AsNoTracking().FirstOrDefaultAsync();
        return new BookSettingsDto(
            meta?.BookSalesEnabled ?? true,
            meta?.BookCardNumber ?? "",
            meta?.BookCardHolder ?? "",
            meta?.BookPaymentNote ?? "");
    }

    [HttpPut("settings")]
    public async Task<ActionResult<BookSettingsDto>> SaveSettings(BookSettingsDto payload)
    {
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (meta is null)
        {
            meta = new CenterMeta();
            db.CenterMeta.Add(meta);
        }
        meta.BookSalesEnabled = payload.BookSalesEnabled;
        meta.BookCardNumber = (payload.BookCardNumber ?? "").Trim();
        meta.BookCardHolder = (payload.BookCardHolder ?? "").Trim();
        meta.BookPaymentNote = (payload.BookPaymentNote ?? "").Trim();
        await db.SaveChangesAsync();
        return new BookSettingsDto(
            meta.BookSalesEnabled, meta.BookCardNumber, meta.BookCardHolder, meta.BookPaymentNote);
    }

    /// <summary>Kitob muqovasini yuklash — umumiy uploads endpoint'i bilan bir xil, lekin
    /// <c>books</c> ruxsati bilan (kitob bilan ishlaydigan xodimga "uploads" roli kerak bo'lmasin).</summary>
    [HttpPost("cover")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<UploadedFileDto>> UploadCover(IFormFile file)
    {
        if (UploadGuard.Validate(file) is { } error) return BadRequest(new { message = error });

        var dir = Path.Combine(env.ContentRootPath, "uploads");
        Directory.CreateDirectory(dir);
        var stored = UploadGuard.SafeName(file);
        await using (var fs = System.IO.File.Create(Path.Combine(dir, stored)))
            await file.CopyToAsync(fs);
        return new UploadedFileDto(file.FileName, $"/uploads/{stored}", file.Length, file.ContentType ?? "");
    }

    // =============================================================================================
    //  Yordamchilar
    // =============================================================================================

    private static string ReasonLabel(string reason) => reason switch
    {
        BookSalesService.ReasonInitial => "Boshlang'ich qoldiq",
        BookSalesService.ReasonRestock => "Kirim",
        BookSalesService.ReasonSale => "Sotuv",
        BookSalesService.ReasonCorrection => "Korreksiya",
        _ => reason,
    };

    /// <summary>"YYYY-MM-DD" filtrlarini <see cref="DateTime"/> oraliqqa aylantiradi
    /// (<paramref name="to"/> — SHU KUN ham kirsin uchun +1 kun, yarim ochiq oraliq).</summary>
    private static (DateTime? From, DateTime? To) DateRange(string? from, string? to)
    {
        DateTime? f = DateTime.TryParse(from, out var fd) ? fd.Date : null;
        DateTime? t = DateTime.TryParse(to, out var td) ? td.Date.AddDays(1) : null;
        return (f, t);
    }
}
