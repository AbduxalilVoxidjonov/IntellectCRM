using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// KITOBLAR SOTUVI — <see cref="BookSalesService"/> (ombor/buyurtma mantig'ining YAGONA joyi) va
/// <see cref="BookShopBotService"/> ning sof (bog'liqliksiz) qismlari.
///
/// <para>Kutilayotgan xulqning rasmiy manbai — <c>.claude/rules/books.md</c>:
/// <list type="bullet">
///   <item>qoldiq FAQAT admin tasdiqlaganda ayiriladi (buyurtma tushganda TEGILMAYDI);</item>
///   <item>ikkinchi marta tasdiqlash/rad etish — o'zgartirmasdan xato matni;</item>
///   <item>qoldiq yetmasa tasdiqlash rad etiladi;</item>
///   <item>kitob nomi/narxi buyurtmada SNAPSHOT;</item>
///   <item>bitta chatda bitta faol bot sessiyasi (ChatId UNIKAL).</item>
/// </list></para>
/// </summary>
public class BookSalesTests
{
    // =============================================================================================
    //  Yordamchilar
    // =============================================================================================

    private static Book NewBook(string title = "Alifbo", decimal price = 25000, int stock = 10) => new()
    {
        Title = title, Author = "Muallif", Price = price, Stock = stock, IsActive = true,
    };

    private static BookOrder NewOrder(Book book, int qty = 2, string status = BookSalesService.StatusPending) => new()
    {
        Number = 1,
        ChatId = 100,
        CustomerName = "Ali Valiyev",
        Phone = "998901234567",
        BookId = book.Id,
        BookTitle = book.Title,
        UnitPrice = book.Price,
        Qty = qty,
        Total = book.Price * qty,
        PaymentMethod = BookSalesService.PayCash,
        Status = status,
    };

    // =============================================================================================
    //  1) SOF MANTIQ — yorliqlar
    // =============================================================================================

    [Fact]
    public void PaymentLabel_NaqdVaKarta()
    {
        Assert.Equal("Karta", BookSalesService.PaymentLabel(BookSalesService.PayCard));
        Assert.Equal("Naqd", BookSalesService.PaymentLabel(BookSalesService.PayCash));
    }

    [Fact]
    public void PaymentLabel_NomalumQiymat_XomSatrniOzgartirmaydi()
    {
        // null → bo'sh satr (xabar matnida "💳 To'lov: " bo'sh chiqadi, "null" emas).
        Assert.Equal("", BookSalesService.PaymentLabel(null));
        Assert.Equal("click", BookSalesService.PaymentLabel("click"));
    }

    [Fact]
    public void StatusLabel_UchtaHolat()
    {
        Assert.Equal("Tasdiqlangan", BookSalesService.StatusLabel(BookSalesService.StatusApproved));
        Assert.Equal("Rad etilgan", BookSalesService.StatusLabel(BookSalesService.StatusRejected));
        Assert.Equal("Kutilmoqda", BookSalesService.StatusLabel(BookSalesService.StatusPending));
    }

    [Fact]
    public void StatusLabel_NomalumHolat_KutilmoqdaDeydi()
    {
        Assert.Equal("Kutilmoqda", BookSalesService.StatusLabel(null));
        Assert.Equal("Kutilmoqda", BookSalesService.StatusLabel("qandaydir"));
    }

    [Fact]
    public void Konstantalar_QoidadagiXomSatrlarGaMos()
    {
        // books.md §2: bu satrlar bazada saqlanadi va frontend (bookLabels.ts) ham AYNAN shularni
        // kutadi — o'zgartirish = eski yozuvlar "noma'lum" bo'lib qolishi.
        Assert.Equal("pending", BookSalesService.StatusPending);
        Assert.Equal("approved", BookSalesService.StatusApproved);
        Assert.Equal("rejected", BookSalesService.StatusRejected);
        Assert.Equal("initial", BookSalesService.ReasonInitial);
        Assert.Equal("restock", BookSalesService.ReasonRestock);
        Assert.Equal("sale", BookSalesService.ReasonSale);
        Assert.Equal("correction", BookSalesService.ReasonCorrection);
        Assert.Equal("cash", BookSalesService.PayCash);
        Assert.Equal("card", BookSalesService.PayCard);
    }

    // =============================================================================================
    //  2) SOF MANTIQ — Move (ombor harakati)
    // =============================================================================================

    [Fact]
    public void Move_Kirim_QoldiqniOshiradi_VaStockAfterYozadi()
    {
        var book = NewBook(stock: 10);

        var move = BookSalesService.Move(book, 5, BookSalesService.ReasonRestock, "Nashriyotdan", "Admin");

        Assert.Equal(15, book.Stock);
        Assert.Equal(5, move.Qty);
        Assert.Equal(15, move.StockAfter);
        Assert.Equal(BookSalesService.ReasonRestock, move.Reason);
        Assert.Equal(book.Id, move.BookId);
        Assert.Equal(book.Title, move.BookTitle);   // kitob o'chirilsa ham tarix o'qiladi
        Assert.Null(move.OrderId);
    }

    [Fact]
    public void Move_Chiqim_QoldiqniKamaytiradi()
    {
        var book = NewBook(stock: 10);

        var move = BookSalesService.Move(book, -3, BookSalesService.ReasonSale, "", "Admin", "ord-1");

        Assert.Equal(7, book.Stock);
        Assert.Equal(-3, move.Qty);
        Assert.Equal(7, move.StockAfter);
        Assert.Equal("ord-1", move.OrderId);
    }

    [Fact]
    public void Move_KetmaKet_StockAfterZanjiriUzilmaydi()
    {
        var book = NewBook(stock: 0);

        var m1 = BookSalesService.Move(book, 20, BookSalesService.ReasonInitial, "", "Admin");
        var m2 = BookSalesService.Move(book, -3, BookSalesService.ReasonSale, "", "Admin");
        var m3 = BookSalesService.Move(book, 5, BookSalesService.ReasonRestock, "", "Admin");
        var m4 = BookSalesService.Move(book, -1, BookSalesService.ReasonCorrection, "", "Admin");

        Assert.Equal(new[] { 20, 17, 22, 21 }, new[] { m1.StockAfter, m2.StockAfter, m3.StockAfter, m4.StockAfter });
        Assert.Equal(21, book.Stock);
        // Har bir StockAfter = oldingi StockAfter + Qty (hisobot ustuni shu zanjirga tayanadi).
        Assert.Equal(m1.StockAfter + m2.Qty, m2.StockAfter);
        Assert.Equal(m2.StockAfter + m3.Qty, m3.StockAfter);
        Assert.Equal(m3.StockAfter + m4.Qty, m4.StockAfter);
    }

    [Fact]
    public void Move_NullNoteVaCreatedBy_BoshSatrgaAylanadi()
    {
        var book = NewBook();

        var move = BookSalesService.Move(book, 1, BookSalesService.ReasonRestock, null!, null!);

        Assert.Equal("", move.Note);
        Assert.Equal("", move.CreatedBy);
    }

    [Fact]
    public void Move_NolMiqdor_QoldiqniOzgartirmaydi_LekinTarixgaYoziladi()
    {
        // Move o'zi 0 ni rad etmaydi — darvoza chaqiruvchida (BooksController: "Miqdor 0 bo'lmasligi kerak").
        var book = NewBook(stock: 7);

        var move = BookSalesService.Move(book, 0, BookSalesService.ReasonCorrection, "", "Admin");

        Assert.Equal(7, book.Stock);
        Assert.Equal(7, move.StockAfter);
    }

    [Fact]
    public void Move_ManfiyQoldiqqaYolQoyadi_DarvozaChaqiruvchida()
    {
        // HOZIRGI xulq: Move past darajali — manfiy qoldiqni to'smaydi. Himoya BooksController
        // (`AddStock`: "Qoldiq manfiy bo'lib qoladi") va ApproveAsync ichida. Agar kelajakda
        // Move'ning O'ZIGA guard qo'shilsa — shu test o'zgaradi.
        var book = NewBook(stock: 2);

        var move = BookSalesService.Move(book, -5, BookSalesService.ReasonCorrection, "", "Admin");

        Assert.Equal(-3, book.Stock);
        Assert.Equal(-3, move.StockAfter);
    }

    // =============================================================================================
    //  3) MIJOZ/ADMIN MATNLARI
    // =============================================================================================

    [Fact]
    public void CustomerApprovedText_Naqd_KassaQatoriBor()
    {
        var o = NewOrder(NewBook(price: 25000), qty: 2);
        o.PaymentMethod = BookSalesService.PayCash;

        var text = BookSalesService.CustomerApprovedText(o);

        Assert.Contains("tasdiqlandi", text);
        Assert.Contains("Alifbo", text);
        Assert.Contains("2 dona", text);
        Assert.Contains("50 000", text);          // AuditService.Money — bo'sh joy ajratgichi
        Assert.Contains("Naqd", text);
        Assert.Contains("kassasiga topshirasiz", text);
    }

    [Fact]
    public void CustomerApprovedText_Karta_KassaQatoriYoq()
    {
        var o = NewOrder(NewBook());
        o.PaymentMethod = BookSalesService.PayCard;

        var text = BookSalesService.CustomerApprovedText(o);

        Assert.Contains("Karta", text);
        Assert.DoesNotContain("kassasiga topshirasiz", text);
    }

    [Fact]
    public void CustomerRejectedText_SababBoshBolsa_StandartMatn()
    {
        var o = NewOrder(NewBook());
        o.RejectReason = "   ";

        var text = BookSalesService.CustomerRejectedText(o);

        Assert.Contains("rad etildi", text);
        Assert.Contains("Sabab ko'rsatilmagan.", text);
    }

    [Fact]
    public void CustomerRejectedText_SababBorBolsa_AynanShuMatn()
    {
        var o = NewOrder(NewBook());
        o.RejectReason = "Chek o'qilmadi";

        Assert.Contains("Chek o'qilmadi", BookSalesService.CustomerRejectedText(o));
    }

    [Fact]
    public void AdminNewOrderText_Karta_ChekHolatiKorsatiladi()
    {
        var o = NewOrder(NewBook());
        o.PaymentMethod = BookSalesService.PayCard;

        o.ReceiptUrl = "";
        Assert.Contains("Chek: yuborilmagan", BookSalesService.AdminNewOrderText(o));

        o.ReceiptUrl = "/uploads/abc.jpg";
        Assert.Contains("Chek: yuborildi", BookSalesService.AdminNewOrderText(o));
    }

    [Fact]
    public void AdminNewOrderText_Naqd_ChekQatoriUmumanYoq()
    {
        var o = NewOrder(NewBook());
        o.PaymentMethod = BookSalesService.PayCash;

        Assert.DoesNotContain("Chek", BookSalesService.AdminNewOrderText(o));
    }

    [Fact]
    public void AdminNewOrderText_IsmBoshBolsa_Nomalum_TelefonYoqBolsaQatorTushibQoladi()
    {
        var o = NewOrder(NewBook());
        o.CustomerName = "  ";
        o.Phone = "";

        var text = BookSalesService.AdminNewOrderText(o);

        Assert.Contains("Noma'lum", text);
        Assert.DoesNotContain("📞", text);
        Assert.Contains("#1", text);
    }

    // =============================================================================================
    //  4) BOT — callback prefikslari (Handles)
    // =============================================================================================

    [Fact]
    public void Handles_OzPrefikslariniQabulQiladi()
    {
        Assert.True(BookShopBotService.Handles(BookShopBotService.CbBook + "abc"));
        Assert.True(BookShopBotService.Handles(BookShopBotService.CbQty + "3"));
        foreach (var d in new[]
                 {
                     BookShopBotService.CbQtyOther, BookShopBotService.CbPayCash, BookShopBotService.CbPayCard,
                     BookShopBotService.CbConfirm, BookShopBotService.CbSendReceipt, BookShopBotService.CbList,
                     BookShopBotService.CbCancel,
                 })
            Assert.True(BookShopBotService.Handles(d), $"Handles({d}) false qaytardi");
    }

    [Fact]
    public void Handles_BegonaCallbacklarniQabulQilmaydi()
    {
        foreach (var d in new[] { "", "start", "check_sub_menu", "k", "kq", "kqty:3", "kbook" })
            Assert.False(BookShopBotService.Handles(d), $"Handles({d}) true qaytardi");
    }

    [Fact]
    public void Handles_OnlineTestPrefikslariBilanToqnashmaydi()
    {
        // TelegramBotService avval OnlineTestBotService.Handles ni sinaydi — ikkisi kesishsa
        // kitob tugmalari onlayn testga ketib qolardi.
        foreach (var d in new[]
                 {
                     OnlineTestBotService.CbOpen + "1", OnlineTestBotService.CbAnswer + "1:A",
                     OnlineTestBotService.CbGoto + "2", OnlineTestBotService.CbModeButtons,
                     OnlineTestBotService.CbModeText, OnlineTestBotService.CbFinish,
                     OnlineTestBotService.CbConfirm, OnlineTestBotService.CbEdit,
                     OnlineTestBotService.CbCancel, OnlineTestBotService.CbList,
                 })
            Assert.False(BookShopBotService.Handles(d), $"Kitob servisi onlayn test callback'ini oldi: {d}");
    }

    [Fact]
    public void CallbackPrefikslari_Noyob_Va64BaytdanQisqa()
    {
        var all = new[]
        {
            BookShopBotService.CbBook, BookShopBotService.CbQty, BookShopBotService.CbQtyOther,
            BookShopBotService.CbPayCash, BookShopBotService.CbPayCard, BookShopBotService.CbConfirm,
            BookShopBotService.CbSendReceipt, BookShopBotService.CbList, BookShopBotService.CbCancel,
        };

        Assert.Equal(all.Length, all.Distinct().Count());
        // Telegram cheklovi: callback_data ≤ 64 bayt (prefiks + Guid("N") = 32 → hali ham sig'adi).
        foreach (var p in all) Assert.True(p.Length + 36 <= 64, $"Prefiks juda uzun: {p}");
    }

    // =============================================================================================
    //  5) BAZA — buyurtma raqami
    // =============================================================================================

    [Fact]
    public async Task NextOrderNumber_BoshBazada_Bir()
    {
        using var db = TestDb.Sqlite();

        Assert.Equal(1, await BookSalesService.NextOrderNumberAsync(db.Context));
    }

    [Fact]
    public async Task NextOrderNumber_EngKattaRaqamdanKeyingisi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook();
        ctx.Books.Add(book);
        foreach (var n in new[] { 1, 2, 7 })
        {
            var o = NewOrder(book);
            o.Number = n;
            ctx.BookOrders.Add(o);
        }
        await ctx.SaveChangesAsync();

        Assert.Equal(8, await BookSalesService.NextOrderNumberAsync(ctx));
    }

    // =============================================================================================
    //  6) BAZA — TASDIQLASH (qoldiq faqat shu yerda ayiriladi)
    // =============================================================================================

    [Fact]
    public async Task Approve_QoldiqniAyiradi_HarakatYozadi_HolatniYangilaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 10, price: 25000);
        var order = NewOrder(book, qty: 3);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        var err = await BookSalesService.ApproveAsync(ctx, order, "Superadmin");

        Assert.Null(err);
        Assert.Equal(7, book.Stock);
        Assert.Equal(BookSalesService.StatusApproved, order.Status);
        Assert.Equal("Superadmin", order.DecidedBy);
        Assert.NotNull(order.DecidedAt);

        var move = await ctx.BookStockMoves.SingleAsync();
        Assert.Equal(-3, move.Qty);
        Assert.Equal(7, move.StockAfter);
        Assert.Equal(BookSalesService.ReasonSale, move.Reason);
        Assert.Equal(order.Id, move.OrderId);
        Assert.Contains($"#{order.Number}", move.Note);
    }

    [Fact]
    public async Task Approve_QoldiqAynanYetarli_Nolgacha()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 4);
        var order = NewOrder(book, qty: 4);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.ApproveAsync(ctx, order, "Admin"));
        Assert.Equal(0, book.Stock);
    }

    [Fact]
    public async Task Approve_IkkinchiMarta_QoldiqQaytaAyrilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 10);
        var order = NewOrder(book, qty: 3);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.ApproveAsync(ctx, order, "Admin"));
        var err = await BookSalesService.ApproveAsync(ctx, order, "Admin");

        Assert.NotNull(err);
        Assert.Contains("allaqachon hal qilingan", err);
        Assert.Contains("Tasdiqlangan", err);
        Assert.Equal(7, book.Stock);                                  // ikki marta ayirilmadi
        Assert.Equal(1, await ctx.BookStockMoves.CountAsync());       // ikkinchi harakat yozilmadi
    }

    [Fact]
    public async Task Approve_QoldiqYetmasa_HechNarsaOzgarmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 2);
        var order = NewOrder(book, qty: 5);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        var err = await BookSalesService.ApproveAsync(ctx, order, "Admin");

        Assert.NotNull(err);
        Assert.Contains("qoldiq 2", err);
        Assert.Contains("buyurtma 5", err);
        Assert.Equal(2, book.Stock);
        Assert.Equal(BookSalesService.StatusPending, order.Status);
        Assert.Null(order.DecidedAt);
        Assert.Empty(await ctx.BookStockMoves.ToListAsync());
    }

    [Fact]
    public async Task Approve_KitobOchirilgan_XatoQaytaradi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var order = NewOrder(NewBook());
        order.BookId = "yoq-kitob";
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        var err = await BookSalesService.ApproveAsync(ctx, order, "Admin");

        Assert.NotNull(err);
        Assert.Contains("Kitob topilmadi", err);
        Assert.Equal(BookSalesService.StatusPending, order.Status);
    }

    [Fact]
    public async Task Approve_RadEtilganBuyurtmani_TasdiqlabBolmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 10);
        var order = NewOrder(book, qty: 2);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.RejectAsync(ctx, order, "Chek yo'q", "Admin"));
        var err = await BookSalesService.ApproveAsync(ctx, order, "Admin");

        Assert.NotNull(err);
        Assert.Contains("Rad etilgan", err);
        Assert.Equal(10, book.Stock);                          // rad etilganda qoldiq TEGILMAGAN
        Assert.Empty(await ctx.BookStockMoves.ToListAsync());
    }

    // =============================================================================================
    //  7) BAZA — RAD ETISH
    // =============================================================================================

    [Fact]
    public async Task Reject_QoldiqTegilmaydi_SababTrimlanadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 6);
        var order = NewOrder(book, qty: 2);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        var err = await BookSalesService.RejectAsync(ctx, order, "  Chek soxta  ", "Admin");

        Assert.Null(err);
        Assert.Equal(BookSalesService.StatusRejected, order.Status);
        Assert.Equal("Chek soxta", order.RejectReason);
        Assert.Equal("Admin", order.DecidedBy);
        Assert.NotNull(order.DecidedAt);
        Assert.Equal(6, book.Stock);
        Assert.Empty(await ctx.BookStockMoves.ToListAsync());
    }

    [Fact]
    public async Task Reject_NullSabab_BoshSatr()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var order = NewOrder(NewBook());
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.RejectAsync(ctx, order, null!, "Admin"));
        Assert.Equal("", order.RejectReason);
    }

    [Fact]
    public async Task Reject_TasdiqlanganBuyurtmani_RadEtibBolmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 10);
        var order = NewOrder(book, qty: 2);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.ApproveAsync(ctx, order, "Admin"));
        var err = await BookSalesService.RejectAsync(ctx, order, "Fikrim o'zgardi", "Admin");

        Assert.NotNull(err);
        Assert.Contains("Tasdiqlangan", err);
        Assert.Equal(BookSalesService.StatusApproved, order.Status);
        Assert.Equal(8, book.Stock);   // BEKOR QILISH YO'Q: tasdiqlangan buyurtmada qoldiq qaytmaydi
    }

    [Fact(Skip = "XATO (BookSalesService.cs:104 RejectAsync): tasdiqlangan buyurtmani BEKOR qilish "
                 + "(qoldiqni omborga qaytarish) mantig'i UMUMAN yo'q. Admin xato tasdiqlasa — qoldiqni "
                 + "faqat qo'lda 'correction' kirimi bilan tiklaydi va buyurtma 'approved' bo'lib qoladi. "
                 + "Tuzatish: BookSalesService'ga CancelApprovedAsync(order, reason, by) qo'shilsin — "
                 + "Move(book, +Qty, ReasonCorrection, 'Buyurtma #N bekor qilindi', by, order.Id) + "
                 + "Status='rejected'. Shundan keyin shu test yoqiladi.")]
    public async Task Approve_KeyinBekorQilish_QoldiqOmborgaQaytadi_KUTILGAN()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(stock: 10);
        var order = NewOrder(book, qty: 3);
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        Assert.Null(await BookSalesService.ApproveAsync(ctx, order, "Admin"));
        Assert.Equal(7, book.Stock);

        // KUTILGAN: bekor qilish qoldiqni qaytaradi va teskari harakat yozadi.
        Assert.Null(await BookSalesService.RejectAsync(ctx, order, "Xato tasdiqlandi", "Admin"));
        Assert.Equal(10, book.Stock);
        Assert.Equal(2, await ctx.BookStockMoves.CountAsync());
    }

    // =============================================================================================
    //  8) BAZA — SNAPSHOT va sessiya cheklovi
    // =============================================================================================

    [Fact]
    public async Task BuyurtmaNarxi_SNAPSHOT_KitobNarxiOzgarsaHamOzgarmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(price: 25000, stock: 10);
        var order = NewOrder(book, qty: 2);      // UnitPrice=25000, Total=50000
        ctx.Books.Add(book);
        ctx.BookOrders.Add(order);
        await ctx.SaveChangesAsync();

        book.Price = 40000;
        book.Title = "Alifbo (2-nashr)";
        await ctx.SaveChangesAsync();
        Assert.Null(await BookSalesService.ApproveAsync(ctx, order, "Admin"));

        var saved = await ctx.BookOrders.AsNoTracking().SingleAsync();
        Assert.Equal(25000m, saved.UnitPrice);
        Assert.Equal(50000m, saved.Total);
        Assert.Equal("Alifbo", saved.BookTitle);
    }

    [Fact]
    public async Task BotSessiyasi_BittaChatdaBittaSessiya_UnikalIndeks()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        ctx.BookBotSessions.Add(new BookBotSession { ChatId = 777, Step = "qty", BookId = "b1" });
        await ctx.SaveChangesAsync();

        ctx.BookBotSessions.Add(new BookBotSession { ChatId = 777, Step = "pay", BookId = "b2" });

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task BotSessiyasi_BoshqaChat_MustaqilYashaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        ctx.BookBotSessions.Add(new BookBotSession { ChatId = 1, Step = "qty", BookId = "b1" });
        ctx.BookBotSessions.Add(new BookBotSession { ChatId = 2, Step = "receipt", BookId = "b2" });
        await ctx.SaveChangesAsync();

        Assert.Equal(2, await ctx.BookBotSessions.CountAsync());
    }

    [Fact]
    public async Task StockMove_KitobOchirilsaHam_TarixdagiNomSaqlanadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var book = NewBook(title: "Fizika 9", stock: 5);
        ctx.Books.Add(book);
        ctx.BookStockMoves.Add(BookSalesService.Move(book, 5, BookSalesService.ReasonInitial, "", "Admin"));
        await ctx.SaveChangesAsync();

        ctx.Books.Remove(book);
        await ctx.SaveChangesAsync();

        var move = await ctx.BookStockMoves.AsNoTracking().SingleAsync();
        Assert.Equal("Fizika 9", move.BookTitle);   // hisobot buzilmaydi
    }

    // =============================================================================================
    //  9) HUJJATLASHTIRILGAN XATOLAR (Skip) — kutilgan to'g'ri xulq
    // =============================================================================================

    [Fact(Skip = "XATO (BookShopBotService.cs:276 HandleTextAsync + BookBotSession.UpdatedAt): bot "
                 + "savdo sessiyasining MUDDATI yo'q. UpdatedAt yoziladi, lekin hech qayerda O'QILMAYDI "
                 + "va eski sessiyalarni tozalaydigan xizmat yo'q. Natija: bir oy oldin kitob ochib "
                 + "tashlab ketgan chatda step='qty' abadiy qoladi va mijozning ISTALGAN 1-4 raqamli "
                 + "matni (masalan '2' — boshqa menyuga javob) kitob soni sifatida yutiladi. "
                 + "Tuzatish: HandleTextAsync/SessionWithBookAsync sessiya yoshini tekshirsin "
                 + "(masalan 30 daqiqa) yoki fon xizmati eskisini o'chirsin.")]
    public async Task BotSessiyasi_EskirganSessiya_MatnniYutmasligiKerak_KUTILGAN()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var eski = AppClock.Now.AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss");
        ctx.BookBotSessions.Add(new BookBotSession
        {
            ChatId = 55, Step = "qty", BookId = "b1", UpdatedAt = eski,
        });
        await ctx.SaveChangesAsync();

        // KUTILGAN: 30 kunlik sessiya "eskirgan" hisoblanadi va bazadan yo'qoladi/inobatga olinmaydi.
        var session = await ctx.BookBotSessions.FirstAsync(s => s.ChatId == 55);
        var yosh = AppClock.Now - DateTime.Parse(session.UpdatedAt);
        Assert.True(yosh > TimeSpan.FromMinutes(30));
        Assert.Empty(await ctx.BookBotSessions.Where(s => s.ChatId == 55).ToListAsync());
    }
}
