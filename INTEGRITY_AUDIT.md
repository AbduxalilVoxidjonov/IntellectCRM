# DATA INTEGRITY AUDIT — IntellectCRM

## EXECUTIVE SUMMARY

Database schema analysis reveals **CRITICAL CASCADE DELETE gaps** and **MISSING FOREIGN KEY constraints** that create orphaned records and data consistency violations. The system relies on application-level delete logic instead of database-enforced referential integrity, creating multiple risk vectors.

---

## FINDINGS

### 1. MISSING FOREIGN KEY CONSTRAINTS

#### 1.1 StudentGroup → Student/Group (CRITICAL)

**Current State:**
- `StudentGroup.StudentId`: NO FK to Students(Id)
- `StudentGroup.GroupId`: NO FK to Classes(Id)
- Both columns are nvarchar(200) with NO referential constraints

**Impact:**
- When Student deleted: StudentGroup remains orphaned SILENTLY
- When Group deleted: StudentGroup removed by manual code (ClassesController.Delete)
  ```csharp
  db.StudentGroups.RemoveRange(db.StudentGroups.Where(sg => sg.GroupId == id));
  ```

**Race Condition Risk:**
1. Request A: `POST /classes/{id}/members` → Insert StudentGroup (pending)
2. Request B: `DELETE /classes/{id}` → Count activeMembers (sees 0 due to read-uncommitted)
3. Request A: SaveChanges() commits StudentGroup
4. Request B: SaveChanges() deletes StudentGroups (WHERE GroupId=id)
   - **Result: Orphan StudentGroup exists in DB** (delete not re-queried)

**Verdict:** ❌ UNPROTECTED (manual delete + race condition window)

---

#### 1.2 MonthlyCharge → Student/Group (CRITICAL)

**Current State:**
- `MonthlyCharge.StudentId`: NO FK to Students(Id)
- `MonthlyCharge.GroupId`: NO FK to Classes(Id) [NULLABLE]
- UNIQUE INDEX on (StudentId, GroupId, Month)

**Deletion Logic:**
```csharp
// In ClassesController.Delete()
db.MonthlyCharges.RemoveRange(db.MonthlyCharges.Where(c => c.GroupId == id));

// FinanceTransactions NOT deleted, just GroupId nulled
await db.FinanceTransactions.Where(t => t.GroupId == id)
    .ForEachAsync(t => t.GroupId = null);
```

**Impact:**
1. **Orphan charges:** If Group delete crashes mid-transaction, MonthlyCharges(GroupId=id) left behind
2. **Ledger breakage:** Per-guruh breakdown reports fail (GroupId=null now invalid)
3. **Duplicate aggregate charges:** 
   - Old model: `MonthlyCharge(StudentId=X, GroupId=null, Month=M)` — aggregate
   - New model: `MonthlyCharge(StudentId=X, GroupId=G1, Month=M)` — per-group
   - Both can coexist (SQL null ≠ null in UNIQUE index)
   - **Workaround:** `PurgeDuplicateAggregateChargesAsync()` runs on startup

**Verdict:** ⚠️ PARTIALLY MITIGATED (startup cleanup + app-level logic)

---

#### 1.3 Group.TeacherId → Teachers(Id) (HIGH)

**Current State:**
- `Group.TeacherId`: NO FK to Teachers(Id)
- Mandatory field (enforced in Create/Update)

**Deletion Logic:**
```csharp
// TeachersController.Delete() checks if Group references Teacher
var groupsWithTeacher = await db.Classes.CountAsync(c => c.TeacherId == id && !c.IsArchived);
if (groupsWithTeacher > 0)
    return BadRequest("O'qituvchi guruhlari bilan bog'langan...");
```

**Impact:**
- When Teacher deleted: Code blocks if any active Groups reference them
- **BUT:** If delete check passes, then Group.TeacherId becomes dangling
- Jurnal queries: `Group.TeacherId` used to filter lessons
  - If reference broken → wrong teacher or empty results
  - Journal rebuild fails silently

**Verdict:** ⚠️ GUARDED (delete blocked) but not enforced at DB

---

#### 1.4 FinanceTransaction.GroupId → Classes(Id) (MEDIUM)

**Current State:**
- NO FK constraint
- When Group deleted: GroupId SET TO NULL (not deleted)

**Impact:**
- Finance audit trail preserved ✓
- Per-guruh ledger broken (GroupId was link to course)
- SalaryLedger attribution fails (per-group collections)

**Verdict:** ⚠️ AUDIT-SAFE but LEDGER-BROKEN

---

### 2. CASCADE DELETE ANALYSIS

#### Confirmed CASCADE Deletes
✓ Assignment → AssignmentMaterials/Questions (Cascade)
✓ LmsSubject → LmsModules → LmsTopics → LmsMaterials (Cascade)
✓ LmsTopic → LmsProgresses (Cascade)

#### Missing CASCADE Deletes
❌ Group ← StudentGroup (manual)
❌ Group ← MonthlyCharges (manual)
❌ Group ← JournalEntries (manual)
❌ Group ← LessonNotes (manual)
❌ Student ← StudentGroup (manual — should auto-cascade, but relying on IsActive flag)
❌ Student ← MonthlyCharge (manual)

**Crash Scenario:**
1. Start: `DELETE FROM Classes WHERE Id='G1'`
2. EF removes StudentGroups from tracking
3. **CRASH before SaveChanges()**
4. DB still has: `StudentGroups(GroupId='G1')`
5. Next request: StudentGroups query succeeds → GroupId dangling

**Verdict:** 🔴 RISKY (all-or-nothing, no atomicity guarantee)

---

### 3. UNIQUE CONSTRAINT ANALYSIS

#### (StudentId, GroupId, Month) UNIQUE Index ✓
- **Exists:** Line 1412-1413 in migration
- **Purpose:** Prevent duplicate charges per student+group+month
- **SQL NULL issue:** Multiple `(StudentId, null, Month)` allowed (aggregate vs per-group)
- **Mitigation:** 
  - `PurgeDuplicateAggregateChargesAsync()` cleanup
  - CLAUDE.md confirms duplicate detection

**Verdict:** ⚠️ PARTIALLY EFFECTIVE (null bypass documented)

#### Group.Name: NO UNIQUE ✗
- By design (multi-branch support)
- **Risk:** `Student.ClassName` uses string lookup
  - `FirstOrDefault(c => c.Name == ClassName)` unpredictable if 2 groups same name
  - Billing aggregation by ClassName could select wrong group
- **Mitigation:** ClassName rarely used (M2M StudentGroup model preferred)

**Verdict:** ⚠️ TOLERABLE (ClassName legacy, M2M primary)

---

### 4. BILLING DATA INTEGRITY ISSUE

**Legacy Model:** Aggregate `MonthlyCharge(StudentId, GroupId=null, Month)`
**New Model:** Per-Group `MonthlyCharge(StudentId, GroupId=G1|G2, Month)`

**Problem:**
```
O'quvchi 2 guruhlada:
  Group A (100k/month)
  Group B (200k/month)

Hisob:
  - AccrueMonth yozadi: MonthlyCharge(SID, null, "2026-06", 300k) ← aggregate
  - Yangi qo'shish: MonthlyCharge(SID, GA, "2026-06", 100k) ← per-group
  - RESULT: Ledger.Amount = 300k + 100k = 400k ← DOUBLE!
```

**Current Mitigation:**
- `PurgeAggregateRowAsync()`: Removes null-GroupId when per-group added
- `ChargeActivationProrate`: Calls purge before writing per-group
- Startup task: `AccrueDue` → `PurgeDuplicateAggregateChargesAsync()`

**Verdict:** ✓ MITIGATED (but relies on app startup task)

---

### 5. CASCADING DELETE RACE CONDITION

**Scenario 1: Student Delete + Active Group**
```
DELETE /admin/students/S1
→ Check: IsArchived?
→ Check: StudentGroups.IsActive? (WINDOW OPENS)
→ (concurrent: POST /classes/G1/members → add S1)
→ SaveChanges() → S1 deleted, but StudentGroup(S1,G1) still added
→ RESULT: Orphan StudentGroup
```

**Scenario 2: Group Delete + Active Members**
```
DELETE /classes/G1
→ Check: activeMembers count (WINDOW OPENS)
→ (concurrent: remove S1 from group → IsActive=false)
→ Manual: RemoveRange(StudentGroup WHERE GroupId=G1)
→ (but S1 no longer active, so not counted)
→ SaveChanges() → StudentGroup deleted, but may skip S1
```

**Verdict:** 🔴 RACE CONDITIONS EXIST (no transaction isolation/locking)

---

### 6. DATA TYPE MISMATCHES

**Observed:**
- `StudentGroup.StudentId/GroupId`: nvarchar(200)
- `Students.Id`: nvarchar(max) by default
- **Result:** GUID (36 chars) fits, no FK needed, no constraint error

**But:** If string IDs exceed 200 chars:
- Insert `Students` (any length)
- Insert `StudentGroup(StudentId='...really long...')` → FK would block, but none exists

**Verdict:** ⚠️ POTENTIAL OVERFLOW (no DB enforcement)

---

### 7. REFERENTIAL INTEGRITY GAPS

#### Student.UserId → AppUser(Id)
- NO FK (nullable)
- **Risk:** AppUser deleted → Student.UserId dangling
- **Mitigation:** Can login via phone (ParentPhone) instead
- **Verdict:** ⚠️ ALLOWED (by design, multi-auth)

#### Teacher.UserId → AppUser(Id)
- NO FK (nullable)
- **Risk:** AppUser deleted → Teacher auth broken
- **Mitigation:** Auto-create new account
- **Verdict:** ⚠️ ALLOWED

#### Lead.ConvertedStudentId → Students(Id)
- NO FK
- **Risk:** Student deleted → Lead.ConvertedStudentId dangling
- **Verdict:** 🔴 UNPROTECTED

---

### 8. AUDIT DATA CONSISTENCY

**Design:** Deliberately NO FK on AuditLog (preserves history of deleted entities)

**Risk:** 
- Group deleted → AuditLog records deletion
- BUT: If delete fails mid-transaction, orphan remains without audit entry
- Sync tables: AuditLog says "deleted" but DB still has StudentGroup

**Verdict:** ✓ CORRECT DESIGN (immutable audit) ⚠️ + orphan risk

---

## CRITICAL ISSUES RANKED

### 🔴 TIER 1 (Data Loss Risk)

| Issue | Severity | Root Cause |
|-------|----------|-----------|
| StudentGroup orphans on Group delete | CRITICAL | No FK + manual delete + race condition |
| MonthlyCharge orphans on Group delete | CRITICAL | No FK + manual delete |
| Duplicate aggregate+per-group charges | CRITICAL | NULL bypass in UNIQUE index |
| Group.TeacherId dangling references | CRITICAL | No FK, blocking delete only |
| Student delete while in Group | CRITICAL | No FK, manual cleanup race |

### ⚠️ TIER 2 (Data Inconsistency)

| Issue | Severity | Root Cause |
|-------|----------|-----------|
| FinanceTransaction.GroupId broken links | HIGH | Set to NULL, breaks per-group ledger |
| Lead.ConvertedStudentId dangling | HIGH | No FK, no block on Student delete |
| Student.UserId/Teacher.UserId orphans | MEDIUM | Nullable, no FK |

### ⚠️ TIER 3 (Process Risk)

| Issue | Severity | Root Cause |
|-------|----------|-----------|
| Group.Name collision (ClassName lookup) | MEDIUM | No unique constraint, legacy string model |
| Concurrent delete races | MEDIUM | READ COMMITTED isolation insufficient |
| String ID overflow (>200 chars) | LOW | nvarchar(200) limit, no check |

---

## RECOMMENDED FIXES

### Priority 1: Add Foreign Keys with CASCADE

```sql
-- StudentGroup
ALTER TABLE StudentGroups
ADD CONSTRAINT FK_StudentGroups_Students
FOREIGN KEY (StudentId) REFERENCES Students(Id)
ON DELETE CASCADE;

ALTER TABLE StudentGroups
ADD CONSTRAINT FK_StudentGroups_Classes
FOREIGN KEY (GroupId) REFERENCES Classes(Id)
ON DELETE CASCADE;

-- MonthlyCharge (aggregate cleanup on group delete)
ALTER TABLE MonthlyCharges
ADD CONSTRAINT FK_MonthlyCharges_Students
FOREIGN KEY (StudentId) REFERENCES Students(Id)
ON DELETE CASCADE;

ALTER TABLE MonthlyCharges
ADD CONSTRAINT FK_MonthlyCharges_Classes
FOREIGN KEY (GroupId) REFERENCES Classes(Id)
ON DELETE CASCADE; -- or SET NULL for audit trail
```

### Priority 2: Add Blocking Foreign Keys

```sql
-- Group.TeacherId (block delete if groups exist)
ALTER TABLE Classes
ADD CONSTRAINT FK_Classes_Teachers
FOREIGN KEY (TeacherId) REFERENCES Teachers(Id)
ON DELETE RESTRICT;

-- Lead.ConvertedStudentId (block student delete if lead references)
ALTER TABLE Leads
ADD CONSTRAINT FK_Leads_Students
FOREIGN KEY (ConvertedStudentId) REFERENCES Students(Id)
ON DELETE RESTRICT;
```

### Priority 3: Fix Billing Duplicate Detection

```sql
-- Prevent multiple null-GroupId charges per (StudentId, Month)
CREATE UNIQUE INDEX IX_MonthlyCharges_StudentId_Month_Null
ON MonthlyCharges (StudentId, Month)
WHERE GroupId IS NULL;
```

### Priority 4: Enforce Constraints in EF

```csharp
// In OnModelCreating:
b.Entity<StudentGroup>()
    .HasOne<Student>().WithMany()
    .HasForeignKey(sg => sg.StudentId)
    .OnDelete(DeleteBehavior.Cascade);

b.Entity<StudentGroup>()
    .HasOne<Group>().WithMany()
    .HasForeignKey(sg => sg.GroupId)
    .OnDelete(DeleteBehavior.Cascade);

b.Entity<MonthlyCharge>()
    .HasOne<Student>().WithMany()
    .HasForeignKey(mc => mc.StudentId)
    .OnDelete(DeleteBehavior.Cascade);

b.Entity<MonthlyCharge>()
    .HasOne<Group>().WithMany()
    .HasForeignKey(mc => mc.GroupId)
    .OnDelete(DeleteBehavior.SetNull);

b.Entity<Group>()
    .HasOne<Teacher>().WithMany()
    .HasForeignKey(g => g.TeacherId)
    .OnDelete(DeleteBehavior.Restrict);
```

### Priority 5: Remove Manual Cascade Code

**DELETE THIS:**
```csharp
// In ClassesController.Delete()
db.StudentGroups.RemoveRange(db.StudentGroups.Where(sg => sg.GroupId == id));
db.JournalEntries.RemoveRange(db.JournalEntries.Where(e => e.ClassId == id));
db.LessonNotes.RemoveRange(db.LessonNotes.Where(n => n.ClassId == id));
db.MonthlyCharges.RemoveRange(db.MonthlyCharges.Where(c => c.GroupId == id));
```

**REPLACE WITH:**
```csharp
db.Classes.Remove(cls);
// EF + DB cascade handles rest
```

---

## DATA AUDIT QUERIES

Run these to identify existing corruption:

### Orphan StudentGroups (Group deleted, record exists)
```sql
SELECT sg.* FROM StudentGroups sg 
WHERE NOT EXISTS (SELECT 1 FROM Classes c WHERE c.Id = sg.GroupId);
```

### Orphan MonthlyCharges (Group deleted, record exists)
```sql
SELECT mc.* FROM MonthlyCharges mc 
WHERE mc.GroupId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM Classes c WHERE c.Id = mc.GroupId);
```

### Duplicate charges (same student+month)
```sql
SELECT StudentId, Month, COUNT(*) cnt FROM MonthlyCharges 
GROUP BY StudentId, Month HAVING COUNT(*) > 1;
```

### Groups with deleted Teacher
```sql
SELECT c.* FROM Classes c 
WHERE c.TeacherId != ''
  AND NOT EXISTS (SELECT 1 FROM Teachers t WHERE t.Id = c.TeacherId);
```

### Leads with deleted Student
```sql
SELECT l.* FROM Leads l 
WHERE l.ConvertedStudentId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM Students s WHERE s.Id = l.ConvertedStudentId);
```

---

## MIGRATION STRATEGY

### Phase 1: Pre-Production
1. Run audit queries (above) to quantify orphans
2. Create cleanup migration to remove/fix orphans
3. Add FK constraints with initial ON DELETE actions

### Phase 2: Deployment
4. Apply migrations (will take lock on large tables)
5. Update EF model (OnModelCreating) to reflect new FKs
6. Remove manual cascade code from controllers
7. Test: Verify delete operations work end-to-end

### Phase 3: Validation
8. Run audit queries again (expect 0 rows)
9. Monitor logs for FK constraint violations

---

## TESTING STRATEGY

### Test 1: Group Delete with Active Members
```
1. Create group G1 with 2 active students
2. POST DELETE /classes/G1 → should 400 "faol o'quvchi bor"
3. Change students to trial/frozen
4. DELETE /classes/G1 → should succeed
5. Query: StudentGroup, MonthlyCharge, JournalEntry
   Expected: All cleaned up (via CASCADE)
```

### Test 2: Concurrent Delete
```
1. Student S1, Group G1
2. Parallel:
   - DELETE /classes/G1 (in transaction)
   - POST /classes/G1/members (add S1)
3. Expected: One fails (FK constraint or duplicate key)
4. State after: Consistent (no orphans)
```

### Test 3: Teacher Delete with Groups
```
1. Teacher T1, Groups G1+G2
2. DELETE /teachers/T1 → should 400 "guruhlari bor"
3. Remove T1 from all groups
4. DELETE /teachers/T1 → should succeed
5. Query: Classes → no T1 (via CASCADE)
```

---

## CURRENT PRODUCTION STATE

✓ **Mitigations in Place:**
- Manual delete logic in controllers (app-enforced cascade)
- Startup cleanup: `PurgeDuplicateAggregateChargesAsync()`
- Delete guards: Check for references before allowing delete

⚠️ **Residual Risks:**
- Race conditions in multi-request scenarios
- Orphans if process crashes mid-transaction
- No atomic guarantees (partial deletes possible)

❌ **Not Protected:**
- Lead.ConvertedStudentId (no constraint)
- Group.TeacherId (no FK, only delete guard)

---

## SUMMARY TABLE

| Relationship | FK Exists | Cascade | Manual Clean | Risk |
|---|---|---|---|---|
| StudentGroup → Student | ❌ | ❌ | ✓ | HIGH |
| StudentGroup → Group | ❌ | ❌ | ✓ | HIGH |
| MonthlyCharge → Student | ❌ | ❌ | ✓ | HIGH |
| MonthlyCharge → Group | ❌ | ❌ | ✓ | HIGH |
| Group → Teacher | ❌ | ❌ | Delete guard | MEDIUM |
| Lead → Student | ❌ | ❌ | None | HIGH |
| Student → AppUser | ❌ | ❌ | None | LOW |
| Teacher → AppUser | ❌ | ❌ | None | LOW |
| Assignment → Questions | ✓ | ✓ | None | LOW |
| LmsSubject → Modules | ✓ | ✓ | None | LOW |

---

**Generated:** 2026-06-17  
**Status:** PRODUCTION DATA AT RISK — recommend Priority 1 fixes before next major deployment

