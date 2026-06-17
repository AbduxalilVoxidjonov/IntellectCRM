# IntellectCRM — Integration Audit: Recommended Fixes

**Priority:** 3 Critical + 8 Medium + 6 Polish  
**Estimated effort:** 20-30 hours (sprints)

---

## CRITICAL FIX #1: Pessimistic Locking for Group Capacity

### Current (Vulnerable)
```csharp
// ClassesController.cs line 263-268
if (cls.Capacity > 0)
{
    var enrolled = await db.StudentGroups.CountAsync(sg => sg.GroupId == id && sg.IsActive);
    if (enrolled >= cls.Capacity)
        return BadRequest(new { message = $"Guruh to'lgan ({cls.Capacity} o'rin)" });
}
db.StudentGroups.Add(new StudentGroup { ... });
await db.SaveChangesAsync();
```

**Issue:** Between `CountAsync()` and `Add()`, concurrent request adds another member.

### Fixed
```csharp
[HttpPost("{id}/members")]
public async Task<IActionResult> AddMember(string id, AddStudentToGroupRequest req)
{
    var cls = await db.Classes.FindAsync(id);
    if (cls is null) return NotFound(new { message = "Guruh topilmadi" });
    
    var s = await db.Students.FindAsync(req.StudentId);
    if (s is null) return NotFound(new { message = "O'quvchi topilmadi" });

    var existing = await db.StudentGroups
        .FirstOrDefaultAsync(sg => sg.StudentId == req.StudentId && sg.GroupId == id);
    if (existing is { IsActive: true })
        return BadRequest(new { message = "O'quvchi allaqachon shu guruhda" });

    // ✓ NEW: Pessimistic locking with transaction
    using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
    try
    {
        // Re-count INSIDE transaction
        var enrolled = await db.StudentGroups
            .Where(sg => sg.GroupId == id && sg.IsActive)
            .CountAsync();
        
        if (cls.Capacity > 0 && enrolled >= cls.Capacity)
        {
            await tx.RollbackAsync();
            return BadRequest(new { message = $"Guruh to'lgan ({cls.Capacity} o'rin)" });
        }

        var joinedAt = string.IsNullOrWhiteSpace(req.JoinedAt)
            ? AppClock.Today.ToString("yyyy-MM-dd") : req.JoinedAt!;
        
        if (existing is not null)
        {
            existing.IsActive = true;
            existing.LeftAt = null;
            existing.JoinedAt = joinedAt;
            existing.Status = "trial";
            existing.ActivatedAt = string.Empty;
            existing.FrozenAt = string.Empty;
        }
        else
        {
            db.StudentGroups.Add(new StudentGroup
            {
                StudentId = req.StudentId,
                GroupId = id,
                JoinedAt = joinedAt,
                IsActive = true,
                Status = "trial",
            });
        }

        if (string.IsNullOrEmpty(s.ClassName)) 
            s.ClassName = cls.Name;

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        audit.Record(AuditService.EntityStudent, s.Id, "update",
            $"Guruhga qo'shildi: {cls.Name}",
            studentId: s.Id);

        return Ok(new { ok = true });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return BadRequest(new { message = "Xato: " + ex.Message });
    }
}
```

---

## CRITICAL FIX #2: Money Validation + Refund Category

### Updated DTOs

```csharp
// Application/Dtos/FinanceDto.cs
public record FinanceTransactionPayload(
    string Date,
    string Direction,    // "income" | "expense"
    string Category,     // "tuition" | "salary" | "refund" | ...
    decimal Amount,      // ALWAYS positive
    string? Note,
    string? StudentId,
    string? TeacherId,
    string? Month,       // For tuition tracking
    string? GroupId,     // For per-group attribution
    string? Comment      // Custom reason
);

public record FinanceTransactionDto(
    string Id, string Date, string Direction, string Category,
    decimal Amount, string? Note,
    string? StudentId, string? StudentName,
    string? TeacherId, string? TeacherName,
    string? Month, string? GroupId, string? Comment
);
```

### Updated Validation

```csharp
// FinanceController.cs
[HttpPost("transactions")]
public async Task<ActionResult<FinanceTransactionDto>> Create(FinanceTransactionPayload p)
{
    // ✓ Validate amount (always positive)
    if (p.Amount <= 0)
        return BadRequest(new { message = "Summa musbat bo'lishi kerak", code = "INVALID_AMOUNT" });

    // ✓ Validate direction
    if (!new[] { "income", "expense" }.Contains(p.Direction))
        return BadRequest(new { message = "Yo'nalish: income yoki expense", code = "INVALID_DIRECTION" });

    // ✓ Validate category
    var validCategories = direction == "income"
        ? new[] { "tuition", "refund", "donation", "other" }
        : new[] { "salary", "expense", "other" };
    if (!validCategories.Contains(p.Category))
        return BadRequest(new { message = $"Toifa: {string.Join(", ", validCategories)}", code = "INVALID_CATEGORY" });

    // ✓ If refund, direction must be "income" (conceptually: negative tuition)
    if (p.Category == "refund" && p.Direction != "income")
        return BadRequest(new { message = "Qaytarish uchun direction='income' bo'lishi kerak", code = "REFUND_DIRECTION_MISMATCH" });

    // ✓ Validate date format
    if (!DateTime.TryParseExact(p.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
        return BadRequest(new { message = "Sana: yyyy-MM-dd", code = "INVALID_DATE_FORMAT" });

    // ✓ Validate tuition requires month
    if (p.Category == "tuition" && string.IsNullOrWhiteSpace(p.Month))
        return BadRequest(new { message = "Tuition uchun oy kerak", code = "MISSING_MONTH" });

    var tx = new FinanceTransaction
    {
        Date = p.Date,
        Direction = p.Direction,
        Category = p.Category,
        Amount = p.Amount,  // Always positive
        Note = p.Note,
        StudentId = p.StudentId,
        TeacherId = p.TeacherId,
        Month = string.IsNullOrWhiteSpace(p.Month) ? null : p.Month,
        GroupId = string.IsNullOrWhiteSpace(p.GroupId) ? null : p.GroupId,
        Comment = p.Comment,
    };

    db.FinanceTransactions.Add(tx);
    await ApplyBalanceAsync(tx.StudentId, StudentBalanceEffect(tx));

    var dir = tx.Direction == "income" ? "Kirim" : "Chiqim";
    var summary = tx is { Category: "salary", TeacherId: not null }
        ? $"Maosh berildi: {AuditService.Money(tx.Amount)} so'm"
        : tx.Category == "refund"
            ? $"Qaytarish: {AuditService.Money(tx.Amount)} so'm ({tx.Note})"
            : $"{dir} qo'shildi: {tx.Category} — {AuditService.Money(tx.Amount)} so'm";

    audit.Record(AuditService.EntityFinanceTransaction, tx.Id, "create", summary,
        after: AuditService.Snapshot(tx), studentId: tx.StudentId, teacherId: tx.TeacherId);

    await db.SaveChangesAsync();
    return ToDto(tx, await StudentNames(), await TeacherNames());
}

[HttpPut("transactions/{id}")]
public async Task<ActionResult<FinanceTransactionDto>> Update(string id, FinanceTransactionPayload p)
{
    var tx = await db.FinanceTransactions.FindAsync(id);
    if (tx is null) return NotFound();

    // ✓ VALIDATE AMOUNT (was missing!)
    if (p.Amount <= 0)
        return BadRequest(new { message = "Summa musbat bo'lishi kerak", code = "INVALID_AMOUNT" });

    var before = AuditService.Snapshot(tx);
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

    // Preserve month/groupId if not provided
    if (!string.IsNullOrWhiteSpace(p.Month)) tx.Month = p.Month;
    if (!string.IsNullOrWhiteSpace(p.GroupId)) tx.GroupId = p.GroupId;
    if (p.Comment is not null) tx.Comment = p.Comment;

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
```

### Updated SalaryLedger (exclude refunds)

```csharp
// Application/Services/SalaryLedger.cs
public static async Task<List<SalaryLedgerDto>> CollectedForTeacherGroupsAsync(
    IAppDbContext db, string teacherId, string month)
{
    var groups = await db.Classes
        .Where(g => g.TeacherId == teacherId && !g.IsArchived)
        .ToListAsync();

    var groupIds = groups.Select(g => g.Id).ToHashSet();

    // ✓ EXCLUDE refunds (category != "refund")
    var collected = await db.FinanceTransactions
        .Where(t => t.Direction == "income" 
                 && t.Category != "refund"  // ← NEW
                 && t.Month == month
                 && (t.GroupId != null && groupIds.Contains(t.GroupId)
                     || t.GroupId == null))  // Untagged income
        .ToListAsync();

    // ... rest of logic ...
}
```

---

## CRITICAL FIX #3: Student Group Access Gate

### Add Helper Method

```csharp
// StudentPortalController.cs
private async Task<bool> HasActiveGroupAccess(Student student, string groupId)
{
    return await db.StudentGroups.AnyAsync(
        sg => sg.StudentId == student.Id 
           && sg.GroupId == groupId 
           && sg.IsActive
    );
}

private async Task<bool> HasAnyActiveGroup(Student student)
{
    return await db.StudentGroups.AnyAsync(
        sg => sg.StudentId == student.Id && sg.IsActive
    );
}
```

### Updated Endpoints

```csharp
[HttpPost("{id}/submission")]
public async Task<IActionResult> SetSubmission(string id, SubmitAssignmentRequest req)
{
    var a = await db.Assignments.FindAsync(id);
    if (a is null) return NotFound();

    var s = await MeAsync();
    if (s is null) return Unauthorized();

    // ✓ NEW: Check group access
    var classIds = a.ClassIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
    var hasAccess = false;
    foreach (var classId in classIds)
    {
        if (await HasActiveGroupAccess(s, classId))
        {
            hasAccess = true;
            break;
        }
    }
    if (!hasAccess)
        return Forbid("Bu topshiriq uchun ruxsatingiz yo'q");

    // ... rest of logic ...
}

[HttpPost("payments")]
public async Task<IActionResult> AddPayment(string? studentId, [FromBody] StudentPaymentRequest req)
{
    if (User.IsInRole("parent"))
    {
        // Parent can only pay for their own children
        var parentPhone = User.FindFirst(ClaimTypes.Name)?.Value;
        if (string.IsNullOrWhiteSpace(parentPhone))
            return Unauthorized();

        // Get parent's children
        var children = (await db.Students.Where(s => !s.IsArchived).ToListAsync())
            .Where(s => NormalizePhone(s.ParentPhone) == NormalizePhone(parentPhone)
                     || NormalizePhone(s.FatherPhone) == NormalizePhone(parentPhone)
                     || NormalizePhone(s.MotherPhone) == NormalizePhone(parentPhone))
            .ToList();

        if (children.Count == 0)
            return Unauthorized("Farzandingiz topilmadi");

        // If studentId specified, verify it's their child
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            if (!children.Any(c => c.Id == studentId))
                return Forbid("Bu farzandning ota-onasi siz emassiz");
        }
        else
        {
            // Default to first child (but alert if multiple)
            if (children.Count > 1)
                return BadRequest(new { 
                    message = "Bir nechta farzandingiz bor — qaysi farzand uchun to'lovni belgilang", 
                    code = "MULTIPLE_CHILDREN",
                    children = children.Select(c => new { c.Id, c.FullName, c.ClassName })
                });
        }
    }

    var s = string.IsNullOrWhiteSpace(studentId) 
        ? await MeAsync() 
        : await TargetAsync(studentId);
    
    if (s is null) return Unauthorized();

    // ... rest of logic ...
}
```

---

## MEDIUM FIX #4: Archive Restore Uniqueness

```csharp
// ArchiveController.cs
[HttpPost("{id}/restore")]
public async Task<IActionResult> Restore(string id)
{
    var rec = await db.ArchivedRecords.FindAsync(id);
    if (rec is null) return NotFound();

    try
    {
        // ✓ NEW: Check if entity already exists
        switch (rec.Type)
        {
            case "student":
                var existingS = await db.Students.FindAsync(rec.EntityId);
                if (existingS is not null)
                    return BadRequest(new { 
                        message = $"Bu o'quvchi allaqachon mavjud (ID: {rec.EntityId})", 
                        code = "ENTITY_EXISTS" 
                    });
                break;

            case "teacher":
                var existingT = await db.Teachers.FindAsync(rec.EntityId);
                if (existingT is not null)
                    return BadRequest(new { 
                        message = $"Bu o'qituvchi allaqachon mavjud", 
                        code = "ENTITY_EXISTS" 
                    });
                break;

            case "group":
                var existingG = await db.Classes.FindAsync(rec.EntityId);
                if (existingG is not null)
                    return BadRequest(new { 
                        message = $"Bu guruh allaqachon mavjud", 
                        code = "ENTITY_EXISTS" 
                    });
                break;
        }

        // ... rest of restore logic ...
    }
    catch (Exception ex)
    {
        return BadRequest(new { message = "Tiklab bo'lmadi: " + ex.Message });
    }
}
```

---

## MEDIUM FIX #5: Idempotent Accrual

```csharp
// Program.cs (or FinanceService.cs)
public static async Task AccrueMonthlyChargesAsync(IAppDbContext db)
{
    var month = TuitionService.CurrentMonth();

    // ✓ NEW: Check if already accrued today
    var lastAccrued = await db.MonthlyCharges
        .Where(c => c.Month == month)
        .OrderByDescending(c => c.CreatedAt)
        .FirstOrDefaultAsync();

    if (lastAccrued?.CreatedAt.Date == DateTime.UtcNow.Date)
    {
        // Already accrued today — skip
        return;
    }

    // ... proceed with accrual for new month ...
}
```

---

## MEDIUM FIX #6: SignalR Cleanup

```csharp
// Application/Hubs/MessagesHub.cs
[Authorize]
public class MessagesHub : Hub
{
    private readonly AppDbContext _db;

    public MessagesHub(AppDbContext db) => _db = db;

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value;

        if (userId != null)
        {
            // Add to user-specific group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

            // Add to role-based groups
            if (role == "admin")
                await Groups.AddToGroupAsync(Context.ConnectionId, "admin-updates");
            else if (role == "teacher")
                await Groups.AddToGroupAsync(Context.ConnectionId, $"teacher-{userId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId != null)
        {
            // ✓ NEW: Clean up groups on disconnect
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admin-updates");
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"teacher-{userId}");

            // Remove any other dynamic groups
            // (per-group, per-class message subscriptions)
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ... rest of hub methods ...
}
```

---

## Summary of Changes

| File | Change | Lines | Priority |
|------|--------|-------|----------|
| ClassesController.cs | Add pessimistic locking | +15 | CRITICAL |
| FinanceDto.cs | Standardize payload | +5 | CRITICAL |
| FinanceController.cs | Validate amount on Update | +3 | CRITICAL |
| StudentPortalController.cs | Add group access gates | +25 | CRITICAL |
| SalaryLedger.cs | Exclude refunds | +1 | CRITICAL |
| ArchiveController.cs | Check entity uniqueness | +25 | MEDIUM |
| FinanceService.cs | Idempotent marker | +8 | MEDIUM |
| MessagesHub.cs | OnDisconnect cleanup | +18 | MEDIUM |

**Total estimated changes:** ~100 lines of code  
**Test cases needed:** ~20 (concurrent, refund, access, restore, accrual)

---

**Next step:** PR with fixes, full test suite, and deployment notes.
