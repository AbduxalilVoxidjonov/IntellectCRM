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
[AdminPerm("finance")]
[Route("api/admin/finance")]
public class FinanceController(AppDbContext db, AuditService audit, AutoMessageService autoMsg) : ControllerBase
{
    private async Task<Dictionary<string, string>> StudentNames() =>
        await db.Students.ToDictionaryAsync(s => s.Id, s => s.FullName);

    private async Task<Dictionary<string, string>> TeacherNames() =>
        await db.Teachers.ToDictionaryAsync(t => t.Id, t => t.FullName);

    private async Task<Dictionary<string, string>> GroupNames() =>
        await db.Classes.ToDictionaryAsync(c => c.Id, c => c.Name);

    private static FinanceTransactionDto ToDto(
        FinanceTransaction t,
        IReadOnlyDictionary<string, string> students,
        IReadOnlyDictionary<string, string> teachers,
        IReadOnlyDictionary<string, string>? groups = null) =>
        new(t.Id, t.Date, t.Direction, t.Category, t.Amount, t.Note,
            t.StudentId, t.StudentId is not null && students.TryGetValue(t.StudentId, out var s) ? s : null,
            t.TeacherId, t.TeacherId is not null && teachers.TryGetValue(t.TeacherId, out var te) ? te : null,
            t.Month, t.GroupId, t.Comment, t.Method,
            t.GroupId is not null && groups is not null && groups.TryGetValue(t.GroupId, out var g) ? g : null,
            // Kiritilgan vaqt — UTC saqlangan CreatedAt'ni markaz mintaqasiga (UTC+5) o'tkazib beramiz.
            t.CreatedAt == default ? null : AppClock.ToLocal(t.CreatedAt).ToString("yyyy-MM-ddTHH:mm:ss"));

    [HttpGet("transactions")]
    public async Task<ActionResult<IEnumerable<FinanceTransactionDto>>> GetTransactions(
        [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? direction, [FromQuery] string? category)
    {
        var query = db.FinanceTransactions.AsQueryable();
        if (!string.IsNullOrEmpty(from)) query = query.Where(t => string.Compare(t.Date, from) >= 0);
        if (!string.IsNullOrEmpty(to)) query = query.Where(t => string.Compare(t.Date, to) <= 0);
        if (!string.IsNullOrEmpty(direction)) query = query.Where(t => t.Direction == direction);
        if (!string.IsNullOrEmpty(category)) query = query.Where(t => t.Category == category);

        var list = await query.OrderByDescending(t => t.Date).ThenByDescending(t => t.Id).ToListAsync();
        var students = await StudentNames();
        var teachers = await TeacherNames();
        var groups = await GroupNames();
        return list.Select(t => ToDto(t, students, teachers, groups)).ToList();
    }

    /// <summary>Bitta to'lov uchun chek (termal kvitansiya) ma'lumotlari — barcha maydonlar + markaz sarlavhasi
    /// + chek sozlamalari (JSON). Frontend shu ma'lumotdan termal chekni chizadi/print qiladi.</summary>
    [HttpGet("receipt/{id}")]
    public async Task<ActionResult<ReceiptDto>> Receipt(string id)
    {
        var tx = await db.FinanceTransactions.FirstOrDefaultAsync(t => t.Id == id);
        if (tx is null) return NotFound();
        var meta = await db.CenterMeta.FirstOrDefaultAsync();

        var studentName = tx.StudentId is null ? "" : (await db.Students.FindAsync(tx.StudentId))?.FullName ?? "";
        var groupName = "";
        var teacherName = "";
        if (tx.GroupId is not null && await db.Classes.FindAsync(tx.GroupId) is { } grp)
        {
            groupName = grp.Name;
            if (!string.IsNullOrWhiteSpace(grp.TeacherId))
                teacherName = (await db.Teachers.FindAsync(grp.TeacherId))?.FullName ?? "";
        }

        var dt = (tx.CreatedAt == default ? AppClock.Now : AppClock.ToLocal(tx.CreatedAt)).ToString("yyyy-MM-dd HH:mm");
        return new ReceiptDto(
            ReceiptNumber(tx.Id), dt, studentName, teacherName, tx.CreatedBy ?? "", groupName,
            tx.Method ?? "", string.IsNullOrWhiteSpace(tx.Comment) ? tx.Note : tx.Comment, tx.Amount,
            meta?.Name ?? "", meta?.Phone ?? "", meta?.Address ?? "", meta?.LogoUrl ?? "",
            meta?.CheckSettings ?? "");
    }

    /// <summary>GUID'dan barqaror 9 xonali chek raqami (lid sinov cheki ham shu formatdan foydalanadi).</summary>
    public static string ReceiptNumber(string guid)
    {
        var hash = 0;
        foreach (var c in guid) hash = unchecked(hash * 31 + c);
        return ((long)(uint)hash % 1_000_000_000).ToString("D9");
    }

    [HttpPost("transactions")]
    public async Task<ActionResult<FinanceTransactionDto>> Create(FinanceTransactionPayload p)
    {
        if (p.Amount <= 0)
            return BadRequest(new { message = "Summa musbat bo'lishi kerak" });

        // IDEMPOTENCY CHECK: oxirgi 5 soniyada bir xil tranzaksiya bo'lsa — dublikat qo'shmasdan
        // mavjudni qaytaramiz (admin double-click yoki network retry uchun).
        // Shartlar: bir xil StudentId, Amount, Direction, Category, Type (tuition/salary/other),
        // Month va GroupId → bitta tranzaksiya (summa yoxud sana o'zgargan bo'lsa yangi).
        var txType = p.Category == "tuition" ? "tuition"
                   : (p.Category == "salary" ? "salary" : "other");
        var recentDuplicate = await db.FinanceTransactions
            .Where(t => t.StudentId == p.StudentId
                && t.TeacherId == p.TeacherId
                && t.Amount == p.Amount
                && t.Direction == p.Direction
                && t.Category == p.Category
                && t.Month == (string.IsNullOrWhiteSpace(p.Month) ? null : p.Month)
                && t.GroupId == (string.IsNullOrWhiteSpace(p.GroupId) ? null : p.GroupId))
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();

        if (recentDuplicate != null
            && DateTime.UtcNow.Subtract(recentDuplicate.CreatedAt).TotalSeconds < 5)
        {
            // Idempotent: oxirgi 5s ichida bir xil qiymatli tranzaksiya — qaytaramiz.
            return ToDto(recentDuplicate, await StudentNames(), await TeacherNames());
        }

        var tx = new FinanceTransaction
        {
            Date = p.Date,
            Direction = p.Direction,
            Category = p.Category,
            Amount = p.Amount,
            Note = p.Note,
            StudentId = p.StudentId,
            TeacherId = p.TeacherId,
            // Tuition kirimi uchun oy/guruh teglari (foizli maosh + per-guruh hisobot shularga tayanadi).
            Month = string.IsNullOrWhiteSpace(p.Month) ? null : p.Month,
            GroupId = string.IsNullOrWhiteSpace(p.GroupId) ? null : p.GroupId,
            Comment = p.Comment,
            Method = string.IsNullOrWhiteSpace(p.Method) ? null : p.Method.Trim().ToLowerInvariant(),
            CreatedBy = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value, // mas'ul (chek uchun)
        };
        db.FinanceTransactions.Add(tx);
        // O'quvchiga bog'langan tuition kirimi balansni oshiradi (izchillik — o'chirishda qaytariladi).
        await ApplyBalanceAsync(tx.StudentId, StudentBalanceEffect(tx));

        var dir = tx.Direction == "income" ? "Kirim" : "Chiqim";
        var summary = tx is { Category: "salary", TeacherId: not null }
            ? $"Maosh berildi: {AuditService.Money(tx.Amount)} so'm"
            : $"{dir} qo'shildi: {tx.Category} — {AuditService.Money(tx.Amount)} so'm";
        audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "create",
            summary, after: AuditService.Snapshot(tx), studentId: tx.StudentId, teacherId: tx.TeacherId);

        await db.SaveChangesAsync();

        // Avto xabar — o'quvchi tuition to'lovi qabul qilinganda ("To'lov qabul qilinganda" hodisasi):
        // yoqilgan qoidalar bo'yicha SMS + push + telegram. {sana} = to'lovning HAQIQIY sanasi
        // (tx.Date — orqaga sanalgan bo'lishi mumkin, bugun emas). {oy} = to'lov QAYSI OY uchun
        // (tx.Month — "yyyy-MM"), bugungi oy EMAS (masalan avgustda iyun oyi uchun to'lansa ham "iyun").
        if (tx is { Direction: "income", Category: "tuition", StudentId: not null })
        {
            var student = await db.Students.FindAsync(tx.StudentId);
            if (student is not null)
            {
                var monthName = tx.Month is { Length: >= 7 } tm && int.TryParse(tm.Substring(5, 2), out var mm)
                    ? MessageTokenizer.MonthNameUz(mm) : "";
                await autoMsg.DispatchStudentAsync(db, AutoMessageTriggers.PaymentReceived, student,
                    new Dictionary<string, string>
                    {
                        ["{summa}"] = MessageTokenizer.MoneyPlain(tx.Amount),
                        ["{sana}"] = tx.Date.Length >= 10 ? $"{tx.Date[8..10]}.{tx.Date[5..7]}.{tx.Date[..4]}" : tx.Date,
                        ["{oy}"] = monthName,
                    });
            }
        }

        return ToDto(tx, await StudentNames(), await TeacherNames());
    }

    [HttpPut("transactions/{id}")]
    public async Task<ActionResult<FinanceTransactionDto>> Update(string id, FinanceTransactionPayload p)
    {
        var tx = await db.FinanceTransactions.FindAsync(id);
        if (tx is null) return NotFound();

        if (p.Amount <= 0)
            return BadRequest(new { message = "Summa musbat bo'lishi kerak" });

        var before = AuditService.Snapshot(tx);
        // Eski balans ta'sirini (eski o'quvchida) hisoblab olamiz — tahrirdan keyin delta qo'llaymiz.
        var oldEffect = StudentBalanceEffect(tx);
        var oldStudentId = tx.StudentId;
        var changes = new List<string>();
        if (tx.Amount != p.Amount)
            changes.Add($"summa {AuditService.Money(tx.Amount)} → {AuditService.Money(p.Amount)} so'm");
        if (tx.Date != p.Date) changes.Add($"sana {tx.Date} → {p.Date}");
        if (tx.Direction != p.Direction) changes.Add($"yo'nalish {tx.Direction} → {p.Direction}");
        if (tx.Category != p.Category) changes.Add($"toifa {tx.Category} → {p.Category}");
        if (tx.Note != p.Note) changes.Add("izoh o'zgartirildi");

        tx.Date = p.Date;
        tx.Direction = p.Direction;
        tx.Category = p.Category;
        tx.Amount = p.Amount;
        tx.Note = p.Note;
        tx.StudentId = p.StudentId;
        tx.TeacherId = p.TeacherId;
        // Oy/guruh teglarini SAQLAB QOLAMIZ: tahrir formasi ularni yubormasa (bo'sh kelsa) eski qiymat qoladi —
        // aks holda tuition to'lovni tahrirlaganda Month/GroupId yo'qolib, foizli maosh + per-guruh hisobot buzilardi.
        if (!string.IsNullOrWhiteSpace(p.Month)) tx.Month = p.Month;
        if (!string.IsNullOrWhiteSpace(p.GroupId)) tx.GroupId = p.GroupId;
        if (p.Comment is not null) tx.Comment = p.Comment;
        if (!string.IsNullOrWhiteSpace(p.Method)) tx.Method = p.Method.Trim().ToLowerInvariant();

        // Balansni moslaymiz: o'quvchi o'zgarmasa — delta; o'zgarsa — eskidan qaytarib, yangisiga qo'llaymiz.
        var newEffect = StudentBalanceEffect(tx);
        if (oldStudentId == tx.StudentId)
            await ApplyBalanceAsync(tx.StudentId, newEffect - oldEffect);
        else
        {
            await ApplyBalanceAsync(oldStudentId, -oldEffect);
            await ApplyBalanceAsync(tx.StudentId, newEffect);
        }

        audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "update",
            changes.Count > 0 ? "Tahrirlandi: " + string.Join(", ", changes) : "Tahrirlandi",
            before: before, after: AuditService.Snapshot(tx),
            studentId: tx.StudentId, teacherId: tx.TeacherId);

        await db.SaveChangesAsync();
        return ToDto(tx, await StudentNames(), await TeacherNames());
    }

    /// <summary>O'qituvchilarga berilgan maoshlar hisoboti (davr bo'yicha): oylik, kerakli
    /// (oylik × davr oylari), berilgan va qoldiq.</summary>
    [HttpGet("salary-report")]
    public async Task<ActionResult<IEnumerable<SalaryReportRowDto>>> SalaryReport(
        [FromQuery] string? from, [FromQuery] string? to)
    {
        // Maosh o'quv yili boshidan hisoblanadi (yanvardan emas) — choraklardagi eng erta oydan.
        var fromMonth = string.IsNullOrEmpty(from)
            ? await TuitionService.AcademicYearStartMonthAsync(db) : from[..7];
        var toMonth = string.IsNullOrEmpty(to) ? TuitionService.CurrentMonth() : to[..7];

        var teachers = await db.Teachers.OrderBy(t => t.FullName).ToListAsync();
        // YAGONA MANTIQ: har o'qituvchi uchun SalaryLedger ishlatamiz — u "fixed" ham, "percent" (guruh
        // to'lovidan foiz) ham hisoblaydi. Ilgari bu yer faqat te.Salary'ga tayanardi → foizli oylik
        // moliyada 0 bo'lib ko'rinmasdi (bug).
        var result = new List<SalaryReportRowDto>();
        foreach (var te in teachers)
        {
            var ledger = await Application.Services.SalaryLedger.BuildAsync(db, te, from, to);
            result.Add(new SalaryReportRowDto(
                te.Id, te.FullName, ledger.Salary, ledger.TotalPaid, ledger.Payments.Count,
                ledger.Months.Count, ledger.TotalExpected, ledger.Remaining,
                te.SalaryMode, te.SalaryPercent,
                ledger.TotalDeduction, ledger.Months.Sum(m => m.MissedLessons)));
        }
        return result;
    }

    /// <summary>O'quvchilar bo'yicha to'lov hisoboti (joriy holat):
    /// Hisoblangan (to'liq guruh narxi yig'indi), Chegirma (berilgan), To'langan (HAQIQIY naqd to'lov),
    /// Qarz va Avans. Eng katta qarzdorlar yuqorida.</summary>
    [HttpGet("student-report")]
    public async Task<ActionResult<IEnumerable<StudentFinanceRowDto>>> StudentReport()
    {
        var students = await db.Students.ToListAsync();
        var charges = await db.MonthlyCharges.ToListAsync();
        var chargedByStudent = charges.GroupBy(c => c.StudentId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var discountByStudent = charges.GroupBy(c => c.StudentId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Discount));
        // Haqiqiy naqd to'lov — chegirma TA'SIR QILMAYDI, har doim turg'un.
        var paidByStudent = (await db.FinanceTransactions
                .Where(t => t.Direction == "income" && t.Category == "tuition" && t.StudentId != null)
                .ToListAsync())
            .GroupBy(t => t.StudentId!)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        return students.Select(s =>
        {
            var charged = chargedByStudent.GetValueOrDefault(s.Id, 0m);
            var discount = discountByStudent.GetValueOrDefault(s.Id, 0m);
            var paid = paidByStudent.GetValueOrDefault(s.Id, 0m);
            var debt = s.Balance < 0 ? -s.Balance : 0m;
            var advance = s.Balance > 0 ? s.Balance : 0m;
            return new StudentFinanceRowDto(
                s.Id, s.FullName, s.ClassName, charged, discount, paid, debt, advance,
                s.DiscountPct, s.DiscountAmount);
        }).OrderByDescending(r => r.Debt).ThenBy(r => r.FullName).ToList();
    }

    /// <summary>Tranzaksiyaning o'quvchi BALANSIGA ta'siri: o'quvchiga bog'langan tuition KIRIMI balansni
    /// shu summaga oshiradi (qarzni kamaytiradi). Boshqa turdagilar (chiqim/maosh/guruhsiz) — 0.</summary>
    private static decimal StudentBalanceEffect(FinanceTransaction tx) =>
        tx.Direction == "income" && tx.Category == "tuition" && !string.IsNullOrEmpty(tx.StudentId) ? tx.Amount : 0m;

    private async Task ApplyBalanceAsync(string? studentId, decimal delta)
    {
        if (delta == 0m || string.IsNullOrEmpty(studentId)) return;
        var st = await db.Students.FindAsync(studentId);
        if (st is not null) st.Balance += delta;
    }

    /// <summary>
    /// O'QUVCHI TO'LOVINI tahrirlash — FAQAT superadmin ("To'lovlar" bo'limidagi qalam tugmasi).
    /// Sana, summa, qaysi oy uchun, qaysi guruh, to'lov usuli va kassir izohi o'zgartiriladi.
    ///
    /// Tahrir HAMMA bog'liq joyni moslaydi:
    ///   • <b>Balans</b> — summa farqi (yangi − eski) o'quvchi balansiga qo'llanadi;
    ///   • <b>Oylik hisob</b> — yangi (guruh, oy) uchun hisob yo'q bo'lsa ochiladi
    ///     (<see cref="TuitionService.EnsureChargeAsync"/>, to'lov qabul qilishdagi kabi avans mantiqi);
    ///   • <b>Izoh</b> — avtomatik izoh (oy/guruh yozilgan) yangi qiymatlar bilan qayta yoziladi;
    ///   • <b>Hisobotlar</b> (o'quvchi qarzi, guruh/kurs tushumi, o'qituvchining FOIZLI maoshi, chek)
    ///     to'lovdan agregat qilinadi — saqlanmaydi, shuning uchun avtomatik yangilanadi;
    ///   • <b>Audit</b> — "update" yozuvi o'zgarishlar ro'yxati + before/after surati bilan.
    ///
    /// O'quvchini almashtirish bu yerda MUMKIN EMAS (o'chirib qaytadan kiritiladi).
    /// Eski oyning hisobi (agar to'lov boshqa oyga ko'chirilsa) AVTOMATIK o'chirilmaydi — u
    /// o'quvchining haqiqiy o'quv oyi bo'lishi mumkin; kerak bo'lsa qo'lda tahrirlanadi.
    /// </summary>
    [HttpPut("payments/{id}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<ActionResult<FinanceTransactionDto>> UpdatePayment(string id, PaymentEditPayload p)
    {
        var tx = await db.FinanceTransactions.FindAsync(id);
        if (tx is null) return NotFound();
        if (tx.Direction != "income" || tx.Category != "tuition" || string.IsNullOrEmpty(tx.StudentId))
            return BadRequest(new { message = "Bu yozuv o'quvchi to'lovi emas — uni bu yerda tahrirlab bo'lmaydi" });

        var student = await db.Students.FindAsync(tx.StudentId);
        if (student is null) return BadRequest(new { message = "O'quvchi topilmadi" });

        if (p.Amount <= 0) return BadRequest(new { message = "Summa musbat bo'lishi kerak" });

        var date = (p.Date ?? "").Trim();
        if (!DateOnly.TryParse(date, out var parsed))
            return BadRequest(new { message = "Sana noto'g'ri" });
        date = parsed.ToString("yyyy-MM-dd");
        if (string.CompareOrdinal(date, AppClock.Today.ToString("yyyy-MM-dd")) > 0)
            return BadRequest(new { message = "Kelajak sanaga to'lov kiritib bo'lmaydi" });

        var month = (p.Month ?? "").Trim();
        if (month.Length < 7) return BadRequest(new { message = "To'lov qaysi oy uchun ekanini tanlang" });
        month = month[..7];

        // Guruh: bo'sh = guruhsiz. Aks holda o'quvchining a'zoligi bo'lishi (yoki eski tegi) shart.
        var groupId = string.IsNullOrWhiteSpace(p.GroupId) ? null : p.GroupId.Trim();
        if (groupId is not null && groupId != tx.GroupId)
        {
            var isMember = await db.StudentGroups.AnyAsync(sg => sg.StudentId == student.Id && sg.GroupId == groupId);
            if (!isMember) return BadRequest(new { message = "Tanlangan guruh o'quvchiga tegishli emas" });
        }

        var before = AuditService.Snapshot(tx);
        var groupNames = await db.Classes.ToDictionaryAsync(c => c.Id, c => c.Name);
        string GName(string? gid) => gid is null ? "guruhsiz" : groupNames.GetValueOrDefault(gid, gid);

        var changes = new List<string>();
        if (tx.Amount != p.Amount) changes.Add($"summa {AuditService.Money(tx.Amount)} → {AuditService.Money(p.Amount)} so'm");
        if (tx.Date != date) changes.Add($"sana {tx.Date} → {date}");
        if (tx.Month != month) changes.Add($"oy {tx.Month ?? "—"} → {month}");
        if (tx.GroupId != groupId) changes.Add($"guruh {GName(tx.GroupId)} → {GName(groupId)}");
        var method = string.IsNullOrWhiteSpace(p.Method) ? null : p.Method.Trim().ToLowerInvariant();
        if (tx.Method != method) changes.Add($"usul {tx.Method ?? "—"} → {method ?? "—"}");
        var comment = string.IsNullOrWhiteSpace(p.Comment) ? null : p.Comment.Trim();
        if (tx.Comment != comment) changes.Add("izoh o'zgartirildi");

        // 1) BALANS — faqat summa farqi (o'quvchi va toifa o'zgarmaydi).
        student.Balance += p.Amount - tx.Amount;

        // 2) Yozuvning o'zi.
        var oldAutoNote = $"O'quvchi to'lovi ({tx.Month})"
            + (tx.GroupId is null ? "" : $" [{GName(tx.GroupId)}]")
            + $" — {student.FullName}";
        var wasAutoNote = string.IsNullOrWhiteSpace(tx.Note) || tx.Note == oldAutoNote;

        tx.Date = date;
        tx.Amount = p.Amount;
        tx.Month = month;
        tx.GroupId = groupId;
        tx.Method = method;
        tx.Comment = comment;
        if (wasAutoNote)
            tx.Note = $"O'quvchi to'lovi ({month})"
                + (groupId is null ? "" : $" [{GName(groupId)}]")
                + $" — {student.FullName}";

        // 3) OYLIK HISOB — yangi (guruh, oy) hisobi yo'q bo'lsa ochamiz (to'lov qabul qilishdagi avans mantiqi).
        await TuitionService.EnsureChargeAsync(db, student, groupId, month);

        audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "update",
            changes.Count > 0
                ? $"To'lov tahrirlandi ({student.FullName}): " + string.Join(", ", changes)
                : $"To'lov tahrirlandi ({student.FullName})",
            before: before, after: AuditService.Snapshot(tx), studentId: tx.StudentId);

        await db.SaveChangesAsync();
        return ToDto(tx, await StudentNames(), await TeacherNames());
    }

    [HttpDelete("transactions/{id}")]
    public async Task<IActionResult> Delete(string id, [FromQuery] string? reasonId = null)
    {
        var tx = await db.FinanceTransactions.FindAsync(id);
        if (tx is null) return NotFound();

        var reason = string.IsNullOrWhiteSpace(reasonId) ? "" : (await db.ActionReasons.Where(r => r.Id == reasonId).Select(r => r.Label).FirstOrDefaultAsync() ?? "");
        var dir = tx.Direction == "income" ? "Kirim" : "Chiqim";
        var actor = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Admin";
        // To'lov o'quvchiga tegishli bo'lsa — arxiv sarlavhasida kimning to'lovi ekanini ko'rsatamiz.
        var sName = tx.StudentId is null ? null : await db.Students.Where(s => s.Id == tx.StudentId).Select(s => s.FullName).FirstOrDefaultAsync();
        ArchiveService.Snapshot(db, "finance", tx.Id,
            sName != null ? $"{sName} — to'lov" : $"{(tx.Direction == "income" ? "Kirim" : "Chiqim")} {tx.Category}",
            $"{tx.Amount} so'm" + (string.IsNullOrEmpty(tx.Month) ? "" : $" · {tx.Month}"),
            tx, reason.Length > 0 ? reason : null, actor);
        audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "delete",
            $"O'chirildi: {dir} {tx.Category} — {AuditService.Money(tx.Amount)} so'm" + (reason.Length > 0 ? $" — sabab: {reason}" : ""),
            before: AuditService.Snapshot(tx), studentId: tx.StudentId, teacherId: tx.TeacherId);

        // To'lov o'chirilsa — o'quvchi balansiga qo'shilgan summani QAYTARAMIZ (qarz tiklanadi).
        await ApplyBalanceAsync(tx.StudentId, -StudentBalanceEffect(tx));
        db.FinanceTransactions.Remove(tx);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Tanlangan davr bo'yicha umumiy moliyaviy xulosa.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<FinanceSummaryDto>> Summary([FromQuery] string? from, [FromQuery] string? to)
    {
        var query = db.FinanceTransactions.AsQueryable();
        if (!string.IsNullOrEmpty(from)) query = query.Where(t => string.Compare(t.Date, from) >= 0);
        if (!string.IsNullOrEmpty(to)) query = query.Where(t => string.Compare(t.Date, to) <= 0);
        var txs = await query.ToListAsync();

        var income = txs.Where(t => t.Direction == "income").ToList();
        var expense = txs.Where(t => t.Direction == "expense").ToList();

        var totalIncome = income.Sum(t => t.Amount);
        var totalExpense = expense.Sum(t => t.Amount);
        var tuition = income.Where(t => t.Category == "tuition").Sum(t => t.Amount);

        var incomeByCat = income.GroupBy(t => t.Category)
            .Select(g => new CategoryAmountDto(g.Key, g.Sum(x => x.Amount)))
            .OrderByDescending(c => c.Amount).ToList();
        var expenseByCat = expense.GroupBy(t => t.Category)
            .Select(g => new CategoryAmountDto(g.Key, g.Sum(x => x.Amount)))
            .OrderByDescending(c => c.Amount).ToList();

        var balances = await db.Students.Select(s => s.Balance).ToListAsync();
        var studentDebt = balances.Where(b => b < 0).Sum(b => -b);
        var studentAdvance = balances.Where(b => b > 0).Sum();

        return new FinanceSummaryDto(
            totalIncome, totalExpense, totalIncome - totalExpense,
            tuition, totalIncome - tuition,
            incomeByCat, expenseByCat,
            studentDebt, studentAdvance, txs.Count);
    }

    /// <summary>Kurs/guruh kesimida moliyaviy hisobot: qaysi kurs ko'p daromad keltiradi,
    /// qaysi kurs o'quvchilari to'lovni to'liq qildi, qaysi guruh (o'qituvchi) to'lov yig'ishda faolroq.</summary>
    [HttpGet("course-report")]
    public async Task<ActionResult<CourseFinanceReportDto>> CourseReport(
        [FromQuery] string? from, [FromQuery] string? to) =>
        await CourseFinanceReport.BuildAsync(db, from, to);

    /// <summary>Bitta guruh ichidagi to'lov holati — kim to'ladi, kim to'lamadi (davr bo'yicha).</summary>
    [HttpGet("group-payments/{groupId}")]
    public async Task<ActionResult<GroupPaymentsReportDto>> GroupPayments(
        string groupId, [FromQuery] string? from, [FromQuery] string? to) =>
        await CourseFinanceReport.BuildGroupPaymentsAsync(db, groupId, from, to);

    /// <summary>Oylik to'lovni qo'lda hisoblash. month berilmasa — hisoblanmagan barcha oylar.</summary>
    [HttpPost("accrue")]
    public async Task<ActionResult<AccrueResultDto>> Accrue([FromQuery] string? month)
    {
        if (!string.IsNullOrEmpty(month))
        {
            var (count, total, created) = await TuitionService.AccrueMonth(db, month);
            // Avto xabar — har YANGI hisob uchun ota-onaga ("Oylik hisob yaratilganda" hodisasi).
            await autoMsg.DispatchMonthlyChargesAsync(db,
                created.Select(c => (c.StudentId, month, c.Amount)).ToList());
            return new AccrueResultDto([month], count, total);
        }

        var (accrued, createdDue) = await TuitionService.AccrueDue(db);
        await autoMsg.DispatchMonthlyChargesAsync(db, createdDue);
        var sum = accrued.Count == 0
            ? 0m
            : await db.MonthlyCharges.Where(c => accrued.Contains(c.Month)).SumAsync(c => c.Amount);
        var cnt = accrued.Count == 0
            ? 0
            : await db.MonthlyCharges.CountAsync(c => accrued.Contains(c.Month));
        return new AccrueResultDto(accrued, cnt, sum);
    }

    /// <summary>Bir yil bo'yicha oylik kirim/chiqim (grafik uchun, 12 oy).</summary>
    [HttpGet("monthly")]
    public async Task<ActionResult<IEnumerable<FinanceMonthlyDto>>> Monthly([FromQuery] int? year)
    {
        var y = year ?? AppClock.Now.Year;
        var prefix = y.ToString("D4") + "-";
        var txs = await db.FinanceTransactions
            .Where(t => t.Date.StartsWith(prefix))
            .ToListAsync();

        var result = new List<FinanceMonthlyDto>();
        for (var m = 1; m <= 12; m++)
        {
            var month = $"{y:D4}-{m:D2}";
            var monthTxs = txs.Where(t => t.Date.StartsWith(month)).ToList();
            result.Add(new FinanceMonthlyDto(
                month,
                monthTxs.Where(t => t.Direction == "income").Sum(t => t.Amount),
                monthTxs.Where(t => t.Direction == "expense").Sum(t => t.Amount)));
        }
        return result;
    }
}
