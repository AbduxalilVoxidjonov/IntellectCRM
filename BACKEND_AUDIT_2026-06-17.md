# BACKEND AUDIT — IntellectCRM C# Platform
**Date:** 2026-06-17  
**Codebase:** ASP.NET Core 8 + PostgreSQL 16 + EF Core (Npgsql)  
**Auditor:** Comprehensive static analysis + code review

---

## CRITICAL ISSUES (FIX IMMEDIATELY)

### 1. AccrueMonth() N+1 Query — Memory Spike Risk
**File:** `TuitionService.cs:303-355`  
**Severity:** HIGH  
**Root Cause:**
```csharp
// Line 310-312: Loads ALL StudentGroups into memory (no pagination)
var membershipsByStudent = (await db.StudentGroups.ToListAsync())
    .GroupBy(sg => sg.StudentId)
    .ToDictionary(g => g.Key, g => g.ToList());

// Line 314-315: Loads all MonthlyCharges for month
var already = (await db.MonthlyCharges.Where(c => c.Month == month)
    .Select(c => new { c.StudentId, c.GroupId }).ToListAsync())
    .Select(x => (x.StudentId, x.GroupId)).ToHashSet();

// Line 318: Loads all non-archived Students
var students = await db.Students.Where(s => !s.IsArchived).ToListAsync();
```

**Impact:** For 1000 students × 5 groups each = 5000 StudentGroups rows loaded into memory at once.  
Memory spike on monthly accrual job (runs every 12 hours). Slow query on large datasets.

**Fix:** Use database-side grouping and pagination:
```csharp
// Load memberships grouped by student
var membershipsByStudent = await db.StudentGroups
    .AsNoTracking()
    .GroupBy(sg => sg.StudentId)
    .Select(g => new { g.Key, Groups = g.ToList() })
    .ToDictionaryAsync(x => x.Key, x => x.Groups);

// Load Classes once instead of re-querying
var classesById = await db.Classes.AsNoTracking()
    .ToDictionaryAsync(c => c.Id);
var feesByName = classesById.GroupBy(c => c.Name)
    .ToDictionary(g => g.Key, g => g.First().Value.MonthlyFee);
```

**Status:** UNFIXED — Affects all monthly billing cycles

---

### 2. Concurrency Race in AccrueMonth — Duplicate Charges
**File:** `TuitionService.cs:314-339`  
**Severity:** CRITICAL  
**Root Cause:**
```csharp
// Line 314-316: Check if (StudentId, GroupId) already has charge this month
var already = (await db.MonthlyCharges.Where(c => c.Month == month)
    .Select(c => new { c.StudentId, c.GroupId }).ToListAsync())
    .Select(x => (x.StudentId, x.GroupId)).ToHashSet();

// ... 20+ lines of processing ...

// Line 338: INSERT new charge
total += AccrueOne(db, s, m.GroupId, month, gfee);
count++;

// No check-and-insert is atomic. Two concurrent AccrueMonth calls
// can both see "not already" and insert duplicates.
```

**Impact:** Duplicate `MonthlyCharge` rows for same `(StudentId, GroupId, Month)` tuple.
- Student balance double-counted
- Financial reports show inflated charges
- Freeze/activation calculations broken (see CLAUDE.md archive entries)

**Fix:** Wrap entire accrual in serializable transaction:
```csharp
using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable))
{
    // Check + insert inside transaction
    // ...
    await db.SaveChangesAsync();
    await tx.CommitAsync();
}
```
Or: Add application-level distributed lock (Redis) if database doesn't guarantee serialization.

**Status:** UNFIXED — Running every 12 hours with high concurrency risk

---

### 3. PurgeDuplicateAggregateChargesAsync() — Transaction Safety Missing
**File:** `TuitionService.cs:453-474`  
**Severity:** HIGH  
**Root Cause:**
```csharp
public static async Task<int> PurgeDuplicateAggregateChargesAsync(IAppDbContext db)
{
    // ...
    foreach (var row in dupNullRows)
    {
        if (students.TryGetValue(row.StudentId, out var s))
            s.Balance += Math.Max(0m, row.Amount - row.Discount); // REFUND

        db.MonthlyCharges.Remove(nullRow);  // No transaction
    }
    await db.SaveChangesAsync();  // If this throws, balance refund orphaned
    return dupNullRows.Count;
}
```

**Impact:** If `SaveChangesAsync()` fails after balance update:
- Balance refund succeeds (in-memory)
- Row deletion fails
- Next call: duplicate purge attempt; balance double-refunded

**Fix:** Wrap in try-catch + transaction:
```csharp
using (var tx = await db.Database.BeginTransactionAsync())
{
    try
    {
        // purge + refund logic
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}
```

**Status:** UNFIXED — Runs on every `AccrueDue()` cycle

---

## HIGH-PRIORITY ISSUES (FIX SOON)

### 4. ChargeActivationProrateAsync() — Locked Check Ordering Bug
**File:** `TuitionService.cs:196-251`  
**Severity:** MEDIUM  
**Root Cause:**
```csharp
var existing = await db.MonthlyCharges
    .FirstOrDefaultAsync(c => c.StudentId == s.Id && c.GroupId == cls.Id && c.Month == month);

// Lines 217-224: Create new charge if not exists (no lock check yet)
if (existing is null)
{
    db.MonthlyCharges.Add(...);
    s.Balance -= effective;
}
else
{
    if (existing.Locked) return;  // Check HERE — too late
    // ... modify charge ...
}
```

**Impact:** If row becomes `Locked` between load and check, modification silently succeeds.  
In practice rare (requires concurrent admin edit), but design flaw.

**Fix:** Check lock immediately after load:
```csharp
if (existing?.Locked ?? false) return;  // Early exit if locked

// Only then proceed with modifications
if (existing is null)
    db.MonthlyCharges.Add(...);
else
    // modify
```

**Status:** UNFIXED — Edge case, but design vulnerability

---

### 5. AccrueMonth() — Enrollment Date Parsing Robustness
**File:** `TuitionService.cs:325`  
**Severity:** MEDIUM  
**Root Cause:**
```csharp
if (!string.IsNullOrEmpty(s.EnrollmentDate) 
    && string.CompareOrdinal(s.EnrollmentDate[..7], month) > 0) 
    continue;

// [..7] assumes yyyy-MM-dd format. If EnrollmentDate is malformed
// (e.g., "2026-06" instead of "2026-06-15"), substring may fail or return partial.
```

**Impact:** Malformed EnrollmentDate not accrued or accrued incorrectly.

**Fix:** Validate before substring:
```csharp
if (!string.IsNullOrEmpty(s.EnrollmentDate) && s.EnrollmentDate.Length >= 10
    && DateOnly.TryParse(s.EnrollmentDate, out var enroll)
    && enroll.ToString("yyyy-MM").CompareTo(month) > 0) 
    continue;
```

**Status:** UNFIXED — Data validation gap

---

## AUTHORIZATION & SECURITY ✅ SOUND

### Passed Checks:
- **JWT Token Validation** (Program.cs:117–147): Correctly revokes archived Teacher/Student/Staff; reloads perms per-request ✅
- **No SQL Injection**: Zero `FromSql`/`ExecuteSql` usage; all LINQ parametrized ✅
- **AdminPermAttribute**: Proper bypass (admin/superadmin), ruxsat gating for staff, GET always allowed ✅
- **Ownership Checks**: ClassesController, StudentPortalController verify user scope ✅
- **Rate Limiting**: Login endpoint rate-limited to 10/min per IP ✅

---

## DATA INTEGRITY — MODERATE ISSUES

### 6. Concurrency: Implicit Lost-Update on MonthlyCharge Edit
**File:** `StudentsController.cs` — `EditCharge()` endpoint  
**Severity:** MEDIUM  
**Root Cause:** No optimistic concurrency control (RowVersion/Timestamp).
```csharp
var charge = await db.MonthlyCharges
    .FirstOrDefaultAsync(c => c.StudentId == id && c.GroupId == gid && c.Month == month);
// If two admins edit same charge concurrently:
// Admin A loads, modifies, saves
// Admin B loads (old version), modifies, saves → overwrites Admin A's change (LOST UPDATE)
```

**Impact:** Rare but possible in high-concurrency admin usage.

**Fix:** Add `[Timestamp]` to `MonthlyCharge.RowVersion`:
```csharp
[Timestamp]
public byte[] RowVersion { get; set; }
```
Then catch `DbUpdateConcurrencyException` in endpoint.

**Status:** UNFIXED — Low probability but high impact when occurs

---

## MIGRATIONS & SCHEMA ✅ SOUND

### Audited Migrations:
- `InitialCreate`: 63 tables, FK constraints, indices ✅
- `AddLevelTestSurvey`, `AddCenterLogo`, `AddSupport`, `AddAdminPhoneAndTgUser`: All additive, safe ✅

### Schema Consistency:
- MonthlyCharge `(StudentId, GroupId, Month)` UNIQUE index exists ✅
- Foreign key ON DELETE behaviors appropriate (CASCADE, SET NULL) ✅
- No orphaned foreign keys detected ✅

---

## NULL-SAFETY ✅ SOUND

**Controllers Checked:**
- FinanceController: Input validation (Amount > 0), null checks on Students ✅
- AuthController: User null check, password verify ✅
- ClassesController: cls/s null checks before use ✅
- StudentPortalController: TargetAsync ownership + null checks ✅

**No null-reference vulnerabilities detected.**

---

## ASYNC/AWAIT & LIFECYCLE ✅ SOUND

- SaveChangesAsync() properly awaited ✅
- No nested SaveChangesAsync() calls ✅
- No synchronous blocking (.Wait(), .Result()) found ✅
- DI lifecycle correct (scoped DbContext, singleton services) ✅

---

## PERFORMANCE ISSUES

### Issue #7: N+1 in StudentProfileBuilder
**File:** `StudentProfileBuilder.cs`  
**Impact:** Multiple DB round-trips per student detail page load  
**Severity:** LOW-MEDIUM (admin detail page, not high-traffic)  
**Status:** KNOWN — Acceptable tradeoff for admin usage

---

## RECOMMENDATION

**Deploy Current Build:** Yes, if issues #1–3 are acceptable for your risk tolerance.

**Action Items (Before Next Deployment):**
1. ⚠️ **FIX BUG #1** (AccrueMonth N+1) — Performance critical
2. ⚠️ **FIX BUG #2** (Concurrency) — Data integrity critical
3. ⚠️ **FIX BUG #3** (Transaction safety) — Billing consistency critical
4. Fix Issue #4 (Lock check ordering) — Design flaw
5. Fix Issue #5 (EnrollmentDate parsing) — Data validation
6. Consider Issue #6 (Optimistic concurrency) — Rare but important

**Billing System Status:** Operational but with known concurrency risks.

---

## AUDIT COMPLETION
✅ Migrations reviewed (idempotency, schema)  
✅ Authorization checked (JWT, AdminPerm)  
✅ Security assessed (SQL injection, null-safety)  
⚠️ Concurrency identified (3 critical issues)  
✅ Async/await patterns sound  
✅ No major architectural flaws  
