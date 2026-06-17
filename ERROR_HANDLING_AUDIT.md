# IntellectCRM — Error Handling Audit Report
**Date:** 2026-06-17  
**Scope:** Database exceptions, file upload errors, API error recovery, validation errors, user feedback  
**Status:** CRITICAL GAPS FOUND — mitigation strategies provided

---

## Executive Summary

The IntellectCRM platform has **inconsistent error handling** across layers. Key findings:

| Category | Status | Risk | Impact |
|----------|--------|------|--------|
| **Database errors** | ⚠️ PARTIAL | HIGH | Silent failures, no user feedback |
| **File uploads** | ⚠️ PARTIAL | MEDIUM | 413/timeout errors unhandled by frontend |
| **API retries** | ❌ NONE | MEDIUM | No exponential backoff; silent failures |
| **Validation errors** | ✅ GOOD | LOW | Backend 400 caught by axios interceptor |
| **User feedback** | ⚠️ POOR | MEDIUM | Try-catch blocks fail silently (`.catch(alert)` anti-pattern) |

---

## 1. DATABASE ERRORS — Silent Failures

### Current State

**Backend (C# / EF Core):**
- ✅ Retry logic: `EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: 10s)` in Program.cs:37
- ✅ Npgsql error mapping configured
- ❌ **No controller-level try-catch blocks** — exceptions propagate to ASP.NET middleware
- ❌ **No global exception handler** — database exceptions not caught or logged

**Frontend (React):**
- ✅ Axios response interceptor catches 401/500 errors
- ❌ Catch blocks **use bare `.catch(alert)`** or **silently ignore** errors

### Problems Found

#### Issue #1: SaveChanges() Failures → 500 (Unlogged)
**File:** `FinanceController.cs` line 80, 133, 230

```csharp
// NO try-catch — if SaveChanges() throws, user gets generic 500 and error is unlogged
await db.SaveChangesAsync();  // DbUpdateException, DbUpdateConcurrencyException not caught
return ToDto(tx, await StudentNames(), await TeacherNames());
```

**Scenario:** 
- Foreign key violation (student deleted before saving transaction) → SQL error
- User sees "Error" toast (if axios interceptor catches it)
- Backend logs nothing useful — sysadmin has no trace

#### Issue #2: Transaction Rollback Implicit
**File:** All controllers using `DbContext`

```csharp
// No explicit transaction; if one SaveChanges() fails mid-operation, partial state left
var tx = new FinanceTransaction { ... };
db.FinanceTransactions.Add(tx);
await ApplyBalanceAsync(tx.StudentId, delta);  // if this modifies Student, then...
await db.SaveChangesAsync();  // ...this single call commits both or none
```

**Problem:** If `ApplyBalance` queries fail (balance student missing), SaveChanges throws; but `tx` already added — partial state.

#### Issue #3: Migration Failures → App Won't Start
**File:** `Program.cs` line 224

```csharp
db.Database.Migrate();  // No try-catch; if migration fails, app crashes, no fallback
```

**Scenario:**
- Migration script has bug (e.g., ALTER TABLE references non-existent column after code rollback)
- App fails to start; production down
- No graceful degradation or admin alert

---

## 2. FILE UPLOAD ERRORS — Partial Handling

### Current State

**Backend (UploadGuard):**
- ✅ Validation: size check (20MB), extension allowlist
- ✅ Returns `BadRequest` with error message
- ✅ Safe filename generation (GUID + ext)

**Controllers:**
- ✅ `[RequestSizeLimit(20_000_000)]` attribute on POST handlers
- ⚠️ **File.CopyToAsync() not in try-catch** — stream I/O errors not caught
- ❌ **No cleanup on partial upload** — orphaned files remain if copy fails mid-stream

**Frontend (React):**
- ❌ **No upload timeout handling** — long files → default axios timeout (120s) → 408/timeout silently ignored
- ❌ **No progress tracking** — 50MB file → user sees spinning button for 2+ minutes, no feedback
- ❌ **.catch(alert)** anti-pattern — errors shown as browser alert, not toast

### Problems Found

#### Issue #4: CopyToAsync() IO Exception
**File:** `AssignmentsController.cs` line 92

```csharp
[HttpPost("uploads")]
[RequestSizeLimit(20_000_000)]
public async Task<ActionResult<UploadedFileDto>> Upload(IFormFile file)
{
    if (Application.Services.UploadGuard.Validate(file) is { } error)
        return BadRequest(new { message = error });
    
    var dir = System.IO.Path.Combine(env.ContentRootPath, "uploads");
    System.IO.Directory.CreateDirectory(dir);
    var stored = Application.Services.UploadGuard.SafeName(file);
    
    // NO TRY-CATCH — if disk is full, permissions denied, file is deleted mid-copy → orphaned temp file
    await using (var fs = System.IO.File.Create(System.IO.Path.Combine(dir, stored)))
        await file.CopyToAsync(fs);  // Throws IOException, no catch
    
    return new UploadedFileDto(file.FileName, $"/uploads/{stored}", file.Length, file.ContentType ?? "");
}
```

**Scenarios:**
- Disk full (1GB uploads partition) → IOException → 500 response, file handle left open
- Network timeout during upload → CopyToAsync cancels → partial .jpg written to disk
- Permission denied on /uploads → UnauthorizedAccessException → user sees "Error"

#### Issue #5: Frontend Upload Timeout
**File:** `src/pages/admin/assignments/` (any file upload form)

```typescript
// Example: uploadAdminFile (assignments.ts)
export async function uploadAdminFile(file: File): Promise<MaterialInput> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<MaterialInput>('/admin/assignments/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data  // NO timeout, NO progress, NO retry
}
```

**Usage (typical form):**
```typescript
const handleUpload = async (file: File) => {
  try {
    const result = await uploadAdminFile(file)
    setMaterial(result)
  } catch (err) {
    alert(`Upload failed: ${err}`)  // ← ANTI-PATTERN: browser alert instead of toast
  }
}
```

**Problems:**
- 50MB file on 1Mbps connection → 416 seconds → default axios timeout (120s) → 408 "Request Timeout"
- Frontend catches 408 and shows `alert("Upload failed: ...")` — not user-friendly
- No retry mechanism — user must re-upload
- No progress bar — user unaware file is uploading
- IFormFile stream may not be disposed if error occurs mid-upload

---

## 3. API ERROR RECOVERY — No Retry Logic

### Current State

**Frontend (client.ts):**
```typescript
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
})

// 401 handling: logout and redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('token')
      window.location.assign('/login')
    }
    return Promise.reject(error)  // ← NO RETRY, just reject
  },
)
```

**Problems:**
- ❌ No exponential backoff for 500/503 (server temporarily down)
- ❌ No retry on network timeout (connection reset mid-transfer)
- ❌ No idempotency check — retrying POST creates duplicates (e.g., duplicate payment)

### Scenarios

#### Issue #6: Transient Network Error → Silent Failure
**Scenario:** User network glitches (WiFi drop, ISP hiccup)

```
Student→POST /api/admin/finance/transactions (payment: 500k)
  ├─ Network timeout (3s)
  ├─ Axios rejects with error
  ├─ catch block: alert("Error") — dismissed by user
  └─ User refreshes page → payment STILL CREATED (backend received request before timeout)
      → user re-enters same amount → DUPLICATE 500k payment
```

**Root cause:** No frontend retry + no backend idempotency token

#### Issue #7: Backend 503 (Graceful Shutdown) → Partial Data Loss
**Scenario:** Deploy new code; old app instance shutting down receives request

```
Payment form → POST /api/admin/finance/transactions
  ├─ Instance receives request
  ├─ SaveChanges() starts
  ├─ Graceful shutdown signal arrives
  ├─ Transaction rolls back (instance force-closed)
  └─ Frontend gets 503 or connection reset
      → User not told to retry
      → Leads to abandoned transaction or duplicate when retried manually
```

---

## 4. VALIDATION ERRORS — Partial Coverage

### Current State

**Good:**
- ✅ Backend validation: Amount > 0, required fields checked
- ✅ Returns HTTP 400 with descriptive message
- ✅ Axios interceptor passes 400 to caller

**Bad:**
- ⚠️ No server-side model validation (ASP.NET `[Required]`, `[StringLength]` not used)
- ⚠️ Frontend form validation minimal; relies on backend to reject

### Example: Finance Transaction

**Backend (FinanceController.cs:52-53):**
```csharp
if (p.Amount <= 0)
    return BadRequest(new { message = "Summa musbat bo'lishi kerak" });
```

**Frontend (PaymentModal.tsx:114):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
    if (submitting || amount <= 0 || !month || (needGroup && !groupId)) return
    // ← User gets no error message, button just disabled
}
```

**Problem:** If somehow invalid data reaches backend, 400 returned; but frontend catches it:

```typescript
try {
  await onSubmit(amount, month, groupId, comment)
} catch (err) {
  // No error handling — silent catch
  setSubmitting(false)
}
```

**Result:** User never sees "Summa musbat bo'lishi kerak" message.

---

## 5. USER FEEDBACK — Toast/Alert Inconsistency

### Current State

**Patterns used (inconsistent):**
1. ✅ `.then(setData)` + no error handling (silent)
2. ❌ `.catch(alert)` (browser alert, bad UX)
3. ⚠️ `.catch(() => {})` (silent failure)
4. ⚠️ Try-catch with no error message

### Examples

#### Issue #8: Silent Catch (Student Profile Update)
**File:** `TransactionFormModal.tsx:63-73`

```typescript
getStudentLedger(id).then((l) => {
  setLedgerMonths(l.months)
  // NO .catch() — if API 500, user sees empty month list, no error message
})
```

#### Issue #9: Alert() Anti-pattern (File Upload)
**File:** Example form using `uploadAdminFile`

```typescript
try {
  await uploadAdminFile(file)
} catch {
  alert(`Upload failed: ${err}`)  // ← Browser alert, blocks UI, bad UX
}
```

#### Issue #10: Unhandled Promise Rejection (ClassPerformance)
**File:** `classPerformance.ts`

```typescript
.then((stats) => {
  // success
})
.catch(() => {
  // Ignore errors for individual groups — NO MESSAGE TO USER
})
```

---

## 6. DATABASE TRANSACTION ISOLATION — Potential Race Conditions

### Issue #11: No Optimistic Locking
**File:** `MonthlyCharge`, all entities

```csharp
// Entity has NO [ConcurrencyToken] or [Timestamp]
public class MonthlyCharge
{
    public string Id { get; set; }
    public string StudentId { get; set; }
    public decimal Amount { get; set; }
    // ← No [Timestamp] byte[] RowVersion
}
```

**Scenario:** Two admins edit same student's charge simultaneously

```
Admin A: GET charge (Amount=500k)
Admin B: GET charge (Amount=500k)
Admin A: PUT charge (Amount=600k) → SaveChanges OK
Admin B: PUT charge (Amount=550k) → SaveChanges OK (OVERWRITES A's change)
```

**Result:** A's update lost, data inconsistent.

---

## 7. SUMMARY TABLE: Error Handling Gaps

| Error Type | Backend | Frontend | Recovery | User Feedback |
|------------|---------|----------|----------|---|
| **DB connection loss** | Retry 5× ✅ | — | Automatic ✅ | None ❌ |
| **DB constraint violation** | No catch ❌ | Axios 500 | N/A | Generic "Error" ❌ |
| **File I/O (disk full)** | No catch ❌ | — | N/A | Generic 500 ❌ |
| **Upload timeout (50MB)** | N/A | No timeout ⚠️ | None ❌ | Alert() ❌ |
| **Network timeout** | N/A | No retry ❌ | Manual ❌ | Silent ❌ |
| **API 503 (deploy)** | Graceful 🔶 | No retry ❌ | Manual ❌ | Connection reset ❌ |
| **Validation 400** | Clear msg ✅ | Axios OK ✅ | Form fix ✅ | Frontend miss ❌ |
| **Concurrent update** | No lock ❌ | — | Last-write-wins ❌ | None ❌ |
| **Migration failure** | No fallback ❌ | — | Manual ❌ | App crash 🔴 |

---

## 8. RECOMMENDATIONS

### CRITICAL (Fix Immediately)

1. **Add Global Exception Handler**
   ```csharp
   // Program.cs
   app.UseExceptionHandler("/error");
   app.MapPost("/error", (HttpContext ctx) => {
       var ex = ctx.Features.Get<IExceptionHandlerFeature>();
       app.Logger.LogError(ex?.Error, "Unhandled exception");
       return Results.Problem(
           detail: "Server error occurred",
           statusCode: 500
       );
   });
   ```

2. **Wrap Database Operations in Try-Catch**
   ```csharp
   try {
       await db.SaveChangesAsync();
   } catch (DbUpdateException ex) {
       app.Logger.LogError(ex, "Database update failed");
       return BadRequest(new { message = "Maslahani save qilib bo'lmadi" });
   } catch (DbUpdateConcurrencyException ex) {
       app.Logger.LogError(ex, "Concurrent update conflict");
       return Conflict(new { message = "Bu ma'lumot boshqa admin tarafindan o'zgartirilgan" });
   }
   ```

3. **Add Retry Logic to Frontend**
   ```typescript
   import axios, { AxiosError } from 'axios'
   
   const retryConfig = {
       retries: 3,
       retryDelay: (retryCount: number) => 
           Math.min(1000 * Math.pow(2, retryCount), 10000),
       retryCondition: (error: AxiosError) =>
           !error.response || error.response.status >= 500
   }
   
   api.defaults.timeout = 30000  // Explicit 30s timeout
   api.interceptors.response.use(
       response => response,
       async error => {
           if (retryConfig.retryCondition(error) && retryCount < retries) {
               await new Promise(r => setTimeout(r, retryDelay(retryCount)))
               retryCount++
               return api.request(error.config)
           }
           return Promise.reject(error)
       }
   )
   ```

4. **Handle File Upload Errors**
   ```csharp
   try {
       var stored = Application.Services.UploadGuard.SafeName(file);
       var fullPath = System.IO.Path.Combine(dir, stored);
       await using (var fs = System.IO.File.Create(fullPath))
           await file.CopyToAsync(fs);
   } catch (IOException ex) {
       System.IO.File.Delete(System.IO.Path.Combine(dir, stored));  // Cleanup
       app.Logger.LogError(ex, "File save failed");
       return StatusCode(507, new { message = "Server xotirasida joy yo'q" });
   }
   ```

5. **Add Upload Progress & Timeout**
   ```typescript
   export async function uploadAdminFile(
       file: File,
       onProgress?: (percent: number) => void
   ): Promise<MaterialInput> {
       const fd = new FormData()
       fd.append('file', file)
       
       return api.post<MaterialInput>(
           '/admin/assignments/uploads',
           fd,
           {
               headers: { 'Content-Type': 'multipart/form-data' },
               timeout: 60000,  // 60s for large files
               onUploadProgress: (pe) => {
                   const percent = Math.round((pe.loaded / pe.total) * 100)
                   onProgress?.(percent)
               }
           }
       ).then(r => r.data)
   }
   ```

### HIGH (Fix Within Sprint)

6. **Add Concurrency Tokens**
   ```csharp
   public class MonthlyCharge {
       [Timestamp]  // EF tracks row version
       public byte[]? RowVersion { get; set; }
   }
   
   // Migration: ADD COLUMN RowVersion bytea NOT NULL DEFAULT '\x00'
   
   // On update:
   try {
       await db.SaveChangesAsync();
   } catch (DbUpdateConcurrencyException) {
       return Conflict(new { message = "Ma'lumot o'zgartirilgan, qayta yoqing" });
   }
   ```

7. **Add Idempotency to Payment Endpoints**
   ```csharp
   [HttpPost("transactions")]
   public async Task<ActionResult<FinanceTransactionDto>> Create(
       [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
       FinanceTransactionPayload p)
   {
       if (string.IsNullOrEmpty(idempotencyKey))
           return BadRequest(new { message = "Idempotency-Key header kerak" });
       
       var existing = await db.FinanceTransactions
           .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
       if (existing != null)
           return Ok(existing);  // Return cached response
       
       var tx = new FinanceTransaction { 
           IdempotencyKey = idempotencyKey,
           // ... rest
       };
   }
   ```

8. **Frontend: Toast Instead of Alert**
   ```typescript
   // Replace all .catch(alert) with proper toast
   import { useToast } from '@/components/ui/useToast'
   
   const handleSubmit = async () => {
       const { showError } = useToast()
       try {
           await uploadAdminFile(file)
       } catch (err) {
           showError(`Yuklash muvaffaqiyatsiz: ${err.message}`)
       }
   }
   ```

### MEDIUM (Nice to Have)

9. **Database Migration Safe Mode**
   ```csharp
   try {
       db.Database.Migrate();
   } catch (Exception ex) {
       app.Logger.LogError(ex, "Migration failed");
       if (!app.Environment.IsProduction()) throw;
       
       // Prod: log error, send alert to admin, don't crash
       app.Logger.LogCritical("MIGRATION FAILED - app still running with old schema");
   }
   ```

10. **Client-Side Validation Before Submit**
    ```typescript
    <form onSubmit={(e) => {
        e.preventDefault()
        const errors = validateForm(form)
        if (errors.length > 0) {
            showError(errors[0])
            return
        }
        // Safe to submit
    }}>
    ```

---

## 9. Testing Checklist

### Before Production Deployment

- [ ] **DB Error**: Create payment with deleted student → expect 400, not 500
- [ ] **File I/O**: Fill disk, upload file → expect 507, not 500
- [ ] **Upload Timeout**: Upload 50MB file on throttled connection → expect retry+progress bar, not silent timeout
- [ ] **Concurrent Update**: Two admins edit same charge → second gets Conflict (409), not overwrite
- [ ] **Migration Failure**: Rollback migration, restart app → app logs error (doesn't crash)
- [ ] **Network Flake**: Simulate packet loss mid-payment → expect retry, not duplicate
- [ ] **Validation**: Submit invalid form → expect user-facing error message, not alert()

### Load Test Scenarios

- 50 simultaneous transactions (payment accrual) → monitor for DB locks/deadlocks
- 10 concurrent 50MB file uploads → monitor disk/memory, expect graceful timeouts
- Deploy new version while transactions in-flight → expect 503 retry, not lost updates

---

## 10. Implementation Priority

| Priority | Task | Effort | Impact | Timeline |
|----------|------|--------|--------|----------|
| **CRITICAL** | Global exception handler | 2h | Prod stability | This week |
| **CRITICAL** | Try-catch around SaveChanges | 4h | Data integrity | This week |
| **CRITICAL** | File upload error cleanup | 1h | Disk cleanup | This week |
| **HIGH** | Retry logic (API) | 3h | UX resilience | Next sprint |
| **HIGH** | Upload timeout + progress | 2h | File handling | Next sprint |
| **HIGH** | Concurrency tokens | 3h | Race condition fix | Next sprint |
| **HIGH** | Idempotency keys (payments) | 2h | Duplicate prevention | Next sprint |
| **MEDIUM** | Toast instead of alert | 2h | UX polish | Next sprint |
| **MEDIUM** | Migration fallback | 1h | Deployment safety | Backlog |

---

## 11. Files to Review / Audit

### Backend
- [ ] `IntellectCRM.Server/Program.cs` — global exception handler missing
- [ ] `IntellectCRM.Server/Controllers/*.cs` — all SaveChangesAsync() calls
- [ ] `IntellectCRM.Application/Services/TuitionService.cs` — billing transactions
- [ ] `IntellectCRM.Application/Services/UploadGuard.cs` — file validation OK; but usage unguarded

### Frontend
- [ ] `src/api/client.ts` — no retry logic; 401 handling only
- [ ] `src/pages/admin/finance/*.tsx` — .catch(alert) antipatterns
- [ ] `src/pages/admin/students/PaymentModal.tsx` — no error on ledger fetch
- [ ] `src/api/services/assignments.ts` — file upload no timeout

---

## Conclusion

The platform has **adequate backend structure** (retry logic, validation) but **poor error recovery** (no retries, no try-catch) and **poor user feedback** (silent catches, alert() instead of toast). 

**Most critical risk:** Payment/billing transactions can silently fail or duplicate due to lack of idempotency + retry logic + concurrency control.

**Recommended action:** Implement the CRITICAL + HIGH items before next payment cycle; enforce `.catch()` → toast pattern in code review.

