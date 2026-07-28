using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using Microsoft.EntityFrameworkCore;

namespace IntellectCRM.Application.Services;

/// <summary>
/// KASSIR HISOBOTI — kim qancha pul qabul qilgan. Ikki joyda ishlatiladi:
/// <list type="bullet">
///   <item>Kassaning o'zida — kassir FAQAT o'zi kiritgan to'lovlarni va jamini ko'radi
///     (<c>GET /api/admin/kassa/my-payments</c>);</item>
///   <item>Moliya → "Kassirlar" — admin/superadmin barcha kassirlar kesimini va har birining
///     to'lovlarini ko'radi (<c>GET /api/admin/finance/cashiers</c>).</item>
/// </list>
///
/// <para>KIM KIRITGANI: yangi yozuvlarda <c>FinanceTransaction.CreatedById</c> (akkaunt id'si) bor;
/// ESKI yozuvlarda faqat <c>CreatedBy</c> (F.I.Sh) bo'lgani uchun kalit
/// <c>CreatedById ?? "name:"+CreatedBy</c> — ya'ni eski to'lovlar ham ism bo'yicha guruhlanadi va
/// hisobotdan tushib qolmaydi.</para>
///
/// <para>Nima hisoblanadi: FAQAT KIRIM (<c>Direction=="income"</c>) — pul kassaga tushgani.
/// Vozvrat (expense/refund) bu hisobotga kirmaydi.</para>
/// </summary>
public static class CashierReport
{
    /// <summary>Yozuv kimga tegishli ekanini bildiruvchi kalit (id bo'lsa id, aks holda ism).</summary>
    public static string KeyOf(string? createdById, string? createdBy) =>
        !string.IsNullOrEmpty(createdById) ? createdById : "name:" + (createdBy ?? "");

    /// <summary>Davr bo'yicha KASSIRLAR kesimi — har biri uchun soni, jami va usul bo'yicha yoyilma.</summary>
    public static async Task<List<CashierSummaryDto>> SummaryAsync(IAppDbContext db, string from, string to)
    {
        var rows = await IncomeQuery(db, from, to)
            .Select(t => new { t.CreatedById, t.CreatedBy, t.Amount, t.Method, t.CreatedAt })
            .ToListAsync();

        return rows
            .GroupBy(t => KeyOf(t.CreatedById, t.CreatedBy))
            .Select(g => Summarize(
                g.Key,
                g.First().CreatedById,
                // Ismi bo'sh bo'lsa (juda eski yozuv) — hisobotda ko'rinib tursin.
                string.IsNullOrWhiteSpace(g.First().CreatedBy) ? "(noma'lum)" : g.First().CreatedBy!,
                g.Select(x => (x.Amount, x.Method, x.CreatedAt))))
            .OrderByDescending(r => r.Total)
            .ToList();
    }

    /// <summary>
    /// Bitta kassir kiritgan to'lovlar ro'yxati (davr bo'yicha, eng yangisi tepada) + o'sha kassirning
    /// jami ko'rsatkichlari. <paramref name="cashierId"/> null bo'lsa faqat ism bo'yicha (eski yozuvlar).
    /// </summary>
    public static async Task<CashierPaymentsDto> PaymentsAsync(
        IAppDbContext db, string from, string to, string? cashierId, string? cashierName)
    {
        var id = string.IsNullOrWhiteSpace(cashierId) ? null : cashierId;
        var name = cashierName ?? "";

        var txs = await IncomeQuery(db, from, to)
            // Id bo'yicha (yangi yozuvlar) YOKI id'siz eski yozuvlarda ism bo'yicha.
            .Where(t => (id != null && t.CreatedById == id)
                        || (t.CreatedById == null && t.CreatedBy == name))
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        // Nomlar (o'quvchi / guruh → kurs, o'qituvchi) — N+1 bo'lmasin: bir martada lug'atga.
        var studentIds = txs.Select(t => t.StudentId).Where(x => x != null).Distinct().ToList();
        var groupIds = txs.Select(t => t.GroupId).Where(x => x != null).Distinct().ToList();
        var students = await db.Students.AsNoTracking().Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName);
        var groups = await db.Classes.AsNoTracking().Where(c => groupIds.Contains(c.Id)).ToListAsync();
        var courseIds = groups.Select(g => g.CourseId).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
        var teacherIds = groups.Select(g => g.TeacherId).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
        var courses = await db.Subjects.AsNoTracking().Where(s => courseIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);
        var teachers = await db.Teachers.AsNoTracking().Where(t => teacherIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.FullName);

        var payments = txs.Select(t =>
        {
            var g = t.GroupId is null ? null : groups.FirstOrDefault(x => x.Id == t.GroupId);
            return new CashierPaymentDto(
                Id: t.Id,
                Date: t.Date,
                Amount: t.Amount,
                Method: t.Method,
                StudentName: t.StudentId is null ? "" : students.GetValueOrDefault(t.StudentId, ""),
                GroupName: g?.Name ?? "",
                CourseName: string.IsNullOrEmpty(g?.CourseId) ? "" : courses.GetValueOrDefault(g!.CourseId, ""),
                TeacherName: string.IsNullOrEmpty(g?.TeacherId) ? "" : teachers.GetValueOrDefault(g!.TeacherId, ""),
                Month: t.Month,
                ReceiptNo: t.ReceiptNo,
                CardLast4: t.CardLast4,
                PaidTime: t.PaidTime,
                CreatedAt: t.CreatedAt.ToString("s"));
        }).ToList();

        var summary = Summarize(
            KeyOf(id, name), id,
            string.IsNullOrWhiteSpace(name) ? "(noma'lum)" : name,
            txs.Select(t => (t.Amount, t.Method, t.CreatedAt)));

        return new CashierPaymentsDto(summary, payments);
    }

    /// <summary>Davr filtri: sana "yyyy-MM-dd" matn bo'lgani uchun oddiy taqqoslash ishlaydi.</summary>
    private static IQueryable<FinanceTransaction> IncomeQuery(IAppDbContext db, string from, string to)
    {
        var q = db.FinanceTransactions.AsNoTracking().Where(t => t.Direction == "income");
        if (!string.IsNullOrWhiteSpace(from)) q = q.Where(t => string.Compare(t.Date, from) >= 0);
        if (!string.IsNullOrWhiteSpace(to)) q = q.Where(t => string.Compare(t.Date, to) <= 0);
        return q;
    }

    /// <summary>Yig'indi qatorini yasaydi (usul bo'yicha yoyilma bilan).</summary>
    private static CashierSummaryDto Summarize(
        string key, string? cashierId, string cashierName,
        IEnumerable<(decimal Amount, string? Method, DateTime CreatedAt)> items)
    {
        var list = items.ToList();
        decimal ByMethod(string m) => list.Where(x => x.Method == m).Sum(x => x.Amount);
        var total = list.Sum(x => x.Amount);
        var cash = ByMethod("cash");
        var card = ByMethod("card");
        var bank = ByMethod("bank");
        return new CashierSummaryDto(
            Key: key,
            CashierId: cashierId,
            CashierName: cashierName,
            Count: list.Count,
            Total: total,
            Cash: cash,
            Card: card,
            Bank: bank,
            Other: total - cash - card - bank,
            LastAt: list.Count == 0 ? null : list.Max(x => x.CreatedAt).ToString("s"));
    }
}
