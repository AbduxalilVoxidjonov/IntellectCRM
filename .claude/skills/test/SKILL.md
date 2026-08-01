---
name: test
description: IntellectCRM testlari — unit testlarni ishga tushirish, yangi test yozish va butun loyihani tester sifatida audit qilish (xato/kamchilik izlash). Test yozish, "testlarni ishga tushir", "xatolarni top", regressiya tekshiruvi kerak bo'lganda ishlating.
---

# Testlar (IntellectCRM)

## 1. Ishga tushirish

```bash
dotnet test IntellectCRM.Tests/IntellectCRM.Tests.csproj          # hammasi
dotnet test IntellectCRM.Tests/IntellectCRM.Tests.csproj \
  --filter "FullyQualifiedName~PhoneUtil"                          # bitta guruh
dotnet test IntellectCRM.Tests/IntellectCRM.Tests.csproj \
  --collect:"XPlat Code Coverage"                                  # qamrov (coverlet)
```

> Backendni alohida qurish kerak bo'lsa DOIM `-p:BuildSpa=false` bilan:
> `dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false`
> (aks holda `npm`/esproj talab qilinadi). Test loyihasi Server'ga havola QILMAYDI —
> shuning uchun `dotnet test` uchun bu bayroq kerak emas.

## 2. Test loyihasi

`IntellectCRM.Tests/` — xUnit **v2**, `net8.0`. Havolalar: Domain · Application · Infrastructure
(**Server ATAYIN yo'q** — u esproj/SPA ga bog'lanib test qurishni buzadi; controller darajasidagi
test kerak bo'lsa `WebApplicationFactory` bilan alohida loyiha ochiladi).

**Konvensiyalar:**
- Sof `Assert.*` — **FluentAssertions ISHLATILMAYDI** (yangi versiyalari tijorat litsenziyasi talab qiladi).
- Kod izohlari va test nomlari mazmuni — **o'zbek tilida** (repo uslubi).
- Baza kerak bo'lsa `TestDb` (`IntellectCRM.Tests/TestDb.cs`):
  ```csharp
  using var db = TestDb.Sqlite();      // ASOSIY: haqiqiy relyatsion baza (unique indeks/FK ishlaydi)
  db.Context.Students.Add(...);
  ```
  `TestDb.InMemory()` — faqat zaxira (SQLite ishlamay qolsa). Har chaqiriq izolyatsiyalangan baza beradi;
  `using` shart — SQLite in-memory bazasi ulanish yopilishi bilan yo'qoladi.
- Vaqt: kodda `DateTime.Now` emas, `AppClock.Now` (Asia/Tashkent, UTC+5). Testda ham shundan boshlang —
  UTC bilan solishtirish 5 soatlik xatoga olib keladi.

## 3. Yangi test yozganda

1. Avval **`.claude/rules/*.md`** ni o'qing — kutilayotgan xulqning RASMIY manbai
   (`billing.md`, `journal.md`, `tests.md`, `exercise.md`, `messaging.md`, `books.md`,
   `crm-leads.md`, `career.md`). Kod bilan qoida orasidagi farq — bu **xato**, testni qoidaga qarab yozing.
2. Sof (static/DB'siz) mantiqni birinchi qamrang — eng arzon va eng foydali:
   `PhoneUtil`, `UploadGuard`, `TelegramInitData`, `MessageTokenizer`, `JournalPolicy`,
   `TeacherSalaryCalc`, `CareerService` bosqichlari, `AuditService.Money`.
3. Chegara holatlarini yozing: bo'sh/null, 0 va manfiy, oyning oxiri, bir xil ball (rank),
   uzunlik mos kelmasligi, mintaqa chegarasi (23:00–01:00), juda uzun matn.

## 4. Tester rejimi (to'liq audit)

Katta audit so'ralganda ish **PM uslubida agentlarga bo'linadi** (qarang: `pm-delegate` skill).
Sinalgan bo'linish — hududlar bir-birining fayllariga tegmaydi:

| Agent | Hudud |
|---|---|
| Moliya | `TuitionService`, `MembershipLifecycle`, `StudentLedger`, `GroupBalanceService`, `TeacherSalaryCalc`, `SalaryLedger`, `RetentionBonusService`, `CourseFinanceReport`, `PaymentIntake`, `CashierReport` |
| O'quv jarayoni | `JournalService/Policy`, `GradingService`, `TestResultService`, `OnlineTest*`, `LevelTestService`, `AssignmentService`, `CurriculumForecast`, `RatingService` |
| Bot / xabar / xavfsizlik | `Telegram*`, `Career*`, `TelegramInitData`, `AutoMessage*`, `MessageTokenizer`, `PhoneUtil`, `UploadGuard`, `AppSecrets`, `AdminPermAttribute`, ochiq (`Public*`) controllerlar |
| Frontend | `src/lib/utils.ts`, `src/lib/permissions.ts`, `src/api/services/**`, `careerLabels.ts` |

**Qoidalar:** audit agentlari FAQAT o'qiydi — production kodini o'zgartirmaydi, topilmani
`fayl:qator — muammo — qanday sindiradi — tuzatish` ko'rinishida qaytaradi. Tuzatish qarori odamda.
Test yozuvchi agentlarga har biriga ALOHIDA test fayllari beriladi (parallel konflikt bo'lmasin).

## 5. Frontend testlari

Hozircha **yo'q** (vitest o'rnatilmagan). Bu mashinada `node`/`npm` PATH da yo'q —
Docker orqali ishlatiladi:
```bash
cd IntellectCRM.Client
docker run --rm -v "$PWD":/w -w /w node:20-slim npx tsc -b --pretty false   # tipni tekshirish
docker run --rm -v "$PWD":/w -w /w node:20-slim npx eslint .                # lint
```
Vitest qo'shilganda `npm run test` shu yerga yoziladi.

## 6. Flutter ilovalari

O'qituvchi/o'quvchi ilovalari **alohida repolarda** (`Intellect-Teacher-app-new`,
`Intellect-Student-app-new`) — bu skill ularni qamrab olmaydi. U yerda `flutter test`.
