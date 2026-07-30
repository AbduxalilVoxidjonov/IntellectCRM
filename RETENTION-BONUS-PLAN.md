# O'quvchini ushlab turish bonusi (Student Retention Bonus) — TAHLIL VA REJA

> **HOLAT: REJA — hali kod yozilmagan.** Bu hujjat mavjud tizim tahlili, tanlangan dizayn va
> bosqichma-bosqich ish rejasi. Amalga oshirilgandan keyin bu fayl `.claude/rules/retention-bonus.md`
> ga aylantiriladi (yoki shu yerda "BAJARILDI" deb belgilanadi).
>
> Sana: 2026-07-30 · Tahlil manbai: kod bazasining o'zi (havolalar `fayl:satr` ko'rinishida).

---

## 1. Maqsad

O'quvchini markazda uzoq muddat ushlab turgan o'qituvchi(lar)ni rag'batlantirish. O'quvchi belgilangan
muddat (default **6 oy**) davomida uzluksiz o'qib, to'lovlarini qilsa — uni o'qitgan o'qituvchi(lar)ga
bonus ajratiladi. O'quvchi bu muddat ichida o'qituvchi/guruh almashtirgan bo'lsa, bonus **o'qigan oylar
nisbatida** bo'linadi.

**Asosiy tamoyil:** bonus *ushlab turgani* uchun beriladi, *o'z vaqtida to'laganligi* uchun emas.
Shu sabab kechikkan to'lov siklni buzmaydi (pastda 5-bo'limga qarang).

---

## 2. Tanlangan yondashuv: QO'LDA PTICHKA (avtomatik aniqlash EMAS)

Ikki variant ko'rib chiqildi:

| | Avtomatik (rad etildi) | **Qo'lda ptichka (tanlandi)** |
|---|---|---|
| Kim ishtirok etadi | Tizim "yangi o'quvchi" ni o'zi topadi | Admin o'quvchi formasida ptichka qo'yadi |
| Bonus summasi | Qoidada oldindan belgilanadi | **Berish paytida admin kiritadi** |
| Qoida jadvali | `RetentionBonusRule` entity kerak | ❌ kerak emas — 3 ta sozlama `CenterMeta` da |
| Fon xizmati | `BackgroundService` (12 soatda bir) kerak | ❌ **kerak emas** — jadval jonli hisoblanadi |
| Retroaktiv xavf | Ishga tushgan kuni o'nlab eski o'quvchiga bonus chiqadi | ❌ yo'q — ptichkasiz o'quvchi ko'rinmaydi |

Sabab: qo'lda ptichka kamroq kod, kamroq xavf va boshqarish tushunarli. Markaz egasi kimga bonus
tizimi tegishli ekanini o'zi hal qiladi.

---

## 3. Mavjud tizimda nima bor (tayanch nuqtalar)

Kerakli ma'lumotlarning deyarli hammasi allaqachon bazada bor — yangi "kuzatuv" mexanizmi kerak emas.

### 3.1. O'quvchi a'zoligi tarixi — BOR va yetarli
`IntellectCRM.Domain/Entities.cs:503` — `StudentGroup`:
`StudentId, GroupId, JoinedAt, LeftAt?, IsActive, Status ("trial"|"active"|"frozen"), ActivatedAt, FrozenAt, RecordedAt`

Bu bilan **istalgan oy uchun** o'quvchi qaysi guruh(lar)da pullik a'zo bo'lganini aniq tiklash mumkin.
Mantiq allaqachon yozilgan — `SalaryLedger.cs:283`:

```csharp
static bool BillableInMonth(StudentGroup m, string month)
{
    if (m.Status == "trial") return false;
    var actOk = m.ActivatedAt.Length < 7 || string.CompareOrdinal(month, m.ActivatedAt[..7]) >= 0;
    var frzOk = m.FrozenAt.Length   < 7 || string.CompareOrdinal(month, m.FrozenAt[..7])   <= 0;
    return actOk && frzOk;
}
```

> ⚠️ Bonus xizmati **AYNAN shu funksiyani** ishlatishi shart (umumiy joyga chiqariladi). Aks holda
> maosh bir oyni "pullik" deb, bonus esa "pullik emas" deb hisoblab, raqamlar bir-biriga to'g'ri kelmaydi.

### 3.2. To'lov intizomi — BOR
- `MonthlyCharge` (`Entities.cs:894`) — per-guruh, per-oy: `Amount`, `Discount`, `Locked`
- `FinanceTransaction` (`Entities.cs:914`) — `StudentId`, `GroupId`, `Month`, `Category="tuition"`,
  vozvrat `Category="refund"`
- Tayyor hisoblagichlar: `StudentGroupLedger.cs:19` (oyma-oy hisob/to'lov), `GroupBalanceService.cs:29`
  (per-guruh balans)

### 3.3. Maosh — oyma-oy, JONLI hisoblanadi
`SalaryLedger.cs:33` `BuildAsync` → `MonthSalaryDto(Month, Expected, Paid, Remaining, Status, BaseExpected, Deduction, …)`.
Maosh hech qayerda saqlanmaydi — har so'rovda qayta hisoblanadi. Maosh *to'lovi* esa
`FinanceTransaction(expense, "salary", TeacherId)`.

**Uchta iste'molchi, uchalasi ham bitta funksiyani chaqiradi:**
- `TeachersController.cs:414` → admin modal (`TeacherSalaryDetailModal.tsx`)
- `FinanceController.cs:288` `salary-report` → Moliya → O'qituvchilar jadvali
- `TeacherPortalController.cs:228` → **o'qituvchi ilovasi** (`teacher/salary/SalaryPage.tsx`)

→ Bonusni `SalaryLedger` ga qo'shsak, uchala ekranda ham avtomatik paydo bo'ladi.

### 3.4. Orqaga sanashdan himoya — BOR
`StudentGroup.RecordedAt` (`Entities.cs:528`) — *"HAQIQATDA tizimga kiritilgan sana, ORQAGA SANALMAYDI"*.
Har doim `AppClock.Today` bilan yoziladi: `ClassesController.cs:401,408` (guruhga qo'shishda) va
`:522` (aktivlashtirishda). Admin `ActivatedAt` ni orqaga sanay oladi, `RecordedAt` ni esa yo'q.

### 3.5. Fon xizmati namunasi (kerak bo'lsa)
`TuitionAccrualService.cs` — `BackgroundService`, startupda + har 12 soatda. **Bu rejada ishlatilmaydi**,
lekin kelajakda "6 oy to'ldi" Telegram xabarnomasi kerak bo'lsa shu shablon olinadi.

### 3.6. Topilma: `Teacher.BonusPct` — O'LIK MAYDON
`Entities.cs:353` da "Ustama foizi (%)" bor, lekin butun `Server`/`Application`/`Client` bo'ylab
**hech qayerda o'qilmaydi**. `TeacherSalaryCalc.WithBonus()` ni ham hech kim chaqirmaydi (dars jadvali
olib tashlanganda o'lgan). Yangi maydonlar `Retention*` prefiksi bilan nomlanadi — chalkashmasin.

---

## 4. Yagona jiddiy to'siq: guruhning o'qituvchi TARIXI yo'q

**Nima bor:** `Group.TeacherId` (`Entities.cs:472`) — faqat **HOZIRGI** o'qituvchi.
**Nima yo'q:** kim qachondan qachongacha o'qitgani.

Tekshirildi — tarix hech qayerda saqlanmaydi:
- `LessonNote` (`Entities.cs:721`) — `ClassId, SubjectId, Date, Topic, Conducted` — **`TeacherId` YO'Q**
- `JournalEntry` (`Entities.cs:695`) — ham yo'q
- `ClassesController.cs:158` — `cls.TeacherId = p.TeacherId ?? ""` — eski qiymat ustiga yoziladi

**Oqibati:** guruhda A o'qituvchi 4 oy ishlab, keyin B kelsa — bonus to'liq B ga ketadi.

**Yechim:** yangi `GroupTeacherAssignment` entity (6-bo'limga qarang) va uni `ClassesController`
`Create` (satr 32) / `Update` (satr 158) da yozish.

**❗ Halol ogohlantirish:** migratsiyadagi backfill eski guruhlar uchun bitta "ochiq" qator yaratadi,
lekin **o'tmishdagi almashuvlarni tiklay olmaydi** — bunday ma'lumot bazada yo'q. Tizim to'g'ri
taqsimlashni **joriy qilingan kundan** boshlaydi.

> Yumshatuvchi omil: bonus summasi va taqsimoti berish paytida **qo'lda tahrirlanadi**, ya'ni admin
> noto'g'ri taqsimotni ko'rsa tuzata oladi. Shu sabab bu to'siq bloklovchi emas.

**Shuning uchun Bosqich 0 (tarixni yozishni boshlash) BIRINCHI bajariladi** — kechikkan har kun
qayta tiklab bo'lmaydigan ma'lumot yo'qotadi.

---

## 5. Oy holatlari va sikl qoidalari ⭐

Bu bo'lim tizimning yuragi. To'rt xil holat bor va ular **bir xil emas**.

### 5.1. MUHIM: tekshiruv O'QUVCHI darajasida, a'zolik darajasida EMAS

O'quvchi guruh almashtirsa — `TransferMember` (`ClassesController.cs:615`) eski a'zolikni **muzlatadi**
va yangisini ochadi. Ya'ni "muzlatilgan" belgisi ikki xil narsani anglatishi mumkin:

1. Haqiqatan ta'tilga chiqdi
2. Shunchaki boshqa guruhga o'tdi (markazdan **ketmadi**)

→ Shuning uchun savol *"bu a'zolik faolmi?"* emas, *"shu oyda o'quvchining KAMIDA BITTA pullik
a'zoligi bormi?"* bo'lishi shart. Shunda guruh almashtirish va kurs qo'shish siklni buzmaydi.

### 5.2. Holatlar jadvali

| Holat | Aniqlash | Sanoqqa ta'siri |
|---|---|---|
| ✅ **To'liq** | pullik a'zolik bor + qarz yo'q | **+1** |
| ⏳ **Qarzdor** | pullik a'zolik bor + qarz bor | **+0**, lekin sikl **uzilmaydi** |
| ❄️ **Muzlatilgan** | hamma a'zolik `frozen` | **PAUZA** — oyna cho'ziladi |
| 🚪 **Ketgan** | pullik a'zolik umuman yo'q | **PAUZA**, `MaxGapMonths` dan oshsa → **UZILDI** |
| 🔴 **Arxivlangan** | `Student.IsArchived == true` (`Entities.cs:275`) | **DARHOL UZILDI** |

Bitta oy uchun hisob:
```
AKTIV?    → shu oyda billable a'zolik bormi          ← SalaryLedger.cs:283
TO'LADI?  → Σ MonthlyCharge(Amount − Discount) − Σ to'langan ≤ 0
             to'lov: FinanceTransaction.Month bo'yicha (StudentGroupLedger.cs:60 kabi),
             vozvrat (Category="refund") ayiriladi
```

### 5.3. Nega qarz siklni uzmaydi

Jadval **jonli** hisoblanadi (hech narsa saqlanmaydi). Demak ota-ona sentabr to'lovini yanvarda
to'lasa — sentabr katagi **o'z-o'zidan ✅ ga aylanadi**. Kechikkan to'lov bonusni yo'qotmaydi, faqat
tugma chiqishini kechiktiradi. Buning uchun qo'shimcha kod kerak emas.

```
Yanvargacha:        ✅  ⏳  ✅  ✅  ✅  ✅   → 5/6, tugma yo'q
09-oy to'langach:   ✅  ✅  ✅  ✅  ✅  ✅   → 6/6, tugma paydo bo'ladi
```

### 5.4. Nega ta'til siklni uzmaydi (lekin cheklov bor)

O'qituvchi o'quvchini yo'qotmadi — vaqtincha to'xtatdi. Lekin cheklovsiz qoldirib bo'lmaydi: 8 oy
muzlab yotgan o'quvchi ham bonus keltirsa, tizimning ma'nosi qolmaydi.

**Ta'tilga chiqdi, qaytdi → bonus BERILADI (sikl cho'ziladi):**
```
Oy      08  09  10  11  12  01  02  03
Holat   ✅  ✅  ✅  ❄️  ❄️  ✅  ✅  ✅
Sanoq   1   2   3   ·   ·   4   5   6      → 6/6 ✅  bonus 2027-03 da
```

**Butunlay ketdi → sikl UZILADI:**
```
Oy      08  09  10  11  12  01
Holat   ✅  ✅  ✅  🚪  🚪  🚪
Sanoq   1   2   3   ·   ·   ·              → gap 3 > 2  →  ❌ UZILDI
```

**Arxivlash — aniq signal.** Admin o'quvchini arxivga o'tkazsa, bu "ketdi" degani; 2 oy kutib
o'tirilmaydi, sikl darhol uziladi.

### 5.5. Uzilgandan keyin

Qator ro'yxatda **qoladi**: `❌ Uzildi · 2026-11 · sabab: 3 oy a'zolik yo'q`. Yo'qolib ketmaydi —
statistika va "nega bonus bermadik" savoliga javob uchun kerak.
O'quvchi qaytsa — **«Qayta boshlash»** tugmasi yangi boshlanish oyi bilan yangi sikl ochadi;
avvalgi sikl tarixda `broken` bo'lib qoladi.

---

## 6. Ma'lumot modeli

```csharp
// 1) Student (mavjud entity'ga 2 maydon) — Entities.cs:178
public bool   RetentionBonus          { get; set; }          // ptichka
public string RetentionBonusStartMonth { get; set; } = "";   // "2026-08" — sanoq qaysi oydan

// 2) Berilgan bonus (sikl darajasi)
public class RetentionBonusAward
{
    string Id;
    string StudentId;
    int    CycleNo;            // 1, 2, 3 …
    string PeriodFrom;         // "2026-08"
    string PeriodTo;           // "2027-01"
    decimal TotalAmount;
    string Status;             // "given" | "broken" | "restarted"
    string? BrokenReason;      // uzilgan bo'lsa sabab
    DateTime? GivenAt;
    string GivenBy;            // admin F.I.Sh
    string Note;
}
// UNIQUE INDEX (StudentId, CycleNo)  ← takroriy bonus mumkin emas

// 3) O'qituvchilar ulushi (bir sikl → N qator)
public class RetentionBonusShare
{
    string Id;
    string AwardId;
    string TeacherId;
    string TeacherName;        // SNAPSHOT — o'qituvchi o'chirilsa ham tarix o'qiladi
    decimal Months;            // masalan 2.0 (nechta oy shu o'qituvchida)
    decimal Amount;
    string SalaryMonth;        // "2027-01" — qaysi oy maoshiga qo'shiladi
}

// 4) Guruhning o'qituvchi TARIXI (4-bo'limdagi to'siq yechimi)
public class GroupTeacherAssignment
{
    string  Id;
    string  GroupId;
    string  TeacherId;
    string  FromDate;          // "YYYY-MM-DD"
    string? ToDate;            // null = hozirgi o'qituvchi
    string  CreatedBy;
}
// INDEX (GroupId, FromDate)

// 5) CenterMeta (Entities.cs:1028) — 3 ta sozlama
public int     RetentionMonthsRequired { get; set; } = 6;
public int     RetentionMaxGapMonths   { get; set; } = 2;
public decimal RetentionDefaultAmount  { get; set; }   // modal'ga oldindan to'ladi
```

**Migratsiya nomi:** `RetentionBonusSystem`

### Nega oylik ptichkalar saqlanmaydi

Superadmin `MonthlyCharge`ni tahrirlashi, to'lov tuzatilishi yoki vozvrat qilinishi mumkin. Saqlansa —
jadval haqiqatdan uzilib qoladi. Shu sabab **faqat yakuniy bonus saqlanadi**, oylik holatlar har safar
qaytadan hisoblanadi (maosh ham aynan shunday ishlaydi — `SalaryLedger`).

---

## 7. Taqsimot algoritmi

```
Sikl oynasi: hisobga kirgan oylar [m1 … m6]

Har oy m uchun:
  1. O'quvchining m oyidagi billable a'zoliklari        ← SalaryLedger.cs:283
  2. Har a'zolik → guruh → O'SHA OYDAGI o'qituvchi      ← GroupTeacherAssignment
     (topilmasa fallback: Group.TeacherId)
  3. Oy vazni 1.0 — a'zoliklar orasida MonthlyFee nisbatida bo'linadi
     (teglanmagan to'lovni taqsimlash bilan BIR XIL konvensiya — SalaryLedger.cs:308)
  4. weight[teacher] += ulush

Jami vazn = 6.0
Har o'qituvchi summasi = TotalAmount × weight[t] / 6
Yaxlitlash qoldig'i eng katta ulushli o'qituvchiga qo'shiladi (yig'indi aniq teng chiqsin)
```

**Misol 1 — ketma-ket:** 2 oy A (Matematika), 4 oy B (Ingliz), bonus 300 000
→ A: `300 000 × 2/6 = 100 000` · B: `300 000 × 4/6 = 200 000`

**Misol 2 — parallel (2 kursda bir vaqtda, 6 oy):** A guruhi 500 000, B guruhi 400 000
→ oy vazni: A `500/900 = 0.556`, B `0.444`
→ A: **166 667** · B: **133 333**

Taqsimot modalda ko'rsatiladi va **admin qo'lda o'zgartira oladi** (yig'indi `TotalAmount` ga teng
bo'lishi tekshiriladi).

---

## 8. Foydalanuvchi oqimi

### ① Ptichka — o'quvchi qo'shish/tahrirlash
`StudentFormModal.tsx` (chegirma bloki yonida, ~satr 443) — bir qatorli checkbox.
`StudentDto` (`Dtos.cs:715`) ga 2 ta **default qiymatli** parametr qo'shiladi — eski chaqiruvlar buzilmaydi.

**Boshlanish oyi:** ptichka birinchi marta yoqilganda avtomatik = o'quvchining **birinchi aktivlashgan
oyi** (`StudentGroup.ActivatedAt` eng ertasi). Yo'q bo'lsa — "hali boshlanmagan" holati. Maydon
tahrirlanadi.

> Nega qo'shilgan oy emas? Sinov (trial) oyida to'lov hisoblanmaydi (`SalaryLedger.cs:285`) — sanoq
> qo'shilgan oydan boshlansa, birinchi katak har doim ✗ chiqadi va jadval buzilgandek ko'rinadi.

### ② «Bonus hisoboti» sahifasi
`navigation.ts` → **O'quvchilar** → "Bonus hisoboti" (`/admin/students/bonus`).
Sahifa `students` ruxsati bilan ko'rinadi; **«Bonus berish» tugmasi** `can('finance','edit')` bilan.

| F.I.Sh | Guruh | Dars kunlari | 08 | 09 | 10 | 11 | 12 | 01 | Holat |
|---|---|---|---|---|---|---|---|---|---|
| Aliyev S. | Ingliz A1 | Du·Cho·Ju | ✅ | ✅ | ✅ | ❄️ | ✅ | ✅ | 5/6 |

- **Guruh** ← faol `StudentGroup` → `Group.Name`
- **Dars kunlari** ← `Group.Days` (`Entities.cs:476`); qisqartma jadvali bor — `ClassesPage.tsx:920` `DAY_SHORT`
- Har oy katagi ostida — **o'sha oydagi o'qituvchi** (taqsimot shaffof bo'lsin)
- Filtr: `hammasi | yo'lda | tayyor | uzilgan | berilgan`

### ③ Bonus berish modali
```
O'quvchi: Aliyev Sardor · Davr: 2026-08 … 2027-01

Summa:  [ 300 000 ]  so'm          (CenterMeta.RetentionDefaultAmount dan oldindan to'ladi)

Taqsimot (avtomatik, tahrirlanadi):
  Karimov A. (Matematika)  2 oy   →  [100 000]
  Sobirov B. (Ingliz)      4 oy   →  [200 000]
                                     ─────────
                                      300 000 ✓
  [ Bekor ]  [ Bonusni berish ]
```

### ④ O'qituvchi profilida «Bonus» bo'limi
`TeacherDetailPage.tsx:53` — hozirgi tablar `info | groups | rating | salary | performance`,
ularga **`bonus`** qo'shiladi: qaysi o'quvchi · qaysi davr · necha oy · summa · qachon berilgan · jami.
O'qituvchi ilovasida ham (`teacher/salary/SalaryPage.tsx`) shu ma'lumot ko'rinadi.

---

## 9. API — `RetentionBonusController` (`api/admin/retention-bonus`, `[AdminPerm("finance")]`)

| Metod · yo'l | Vazifasi |
|---|---|
| `GET /` | Bonus hisoboti jadvali (ptichkali o'quvchilar + oylik holatlar + progress) |
| `GET /ready-count` | Tayyor (6/6) bonuslar soni — nav belgisi uchun |
| `POST /awards` | Bonus berish: `{studentId, totalAmount, shares[]}` → `Award` + `Share` yozadi |
| `POST /awards/{id}/cancel` | Bekor qilish (xato kiritilgan bo'lsa) |
| `POST /students/{id}/restart` | Uzilgan siklni yangi oydan qayta boshlash |
| `GET /teacher/{id}` | Bitta o'qituvchining bonuslari (profil tabi uchun) |
| `GET /export` | .xlsx (mavjud `ExcelExport`) |
| `GET|PUT /settings` | `CenterMeta` dagi 3 ta sozlama |

> `AdminPermAttribute` qoidasi: xodimga GET har doim ochiq, yozish uchun `finance` ruxsati kerak.

**Yagona mantiq joyi:** `Application/Services/RetentionBonusService.cs` — `BookSalesService` uslubida
static xizmat. Jadval hisobi, holat mantig'i, taqsimot va bonus yaratish **faqat shu yerda**;
controller ham, kelajakdagi har qanday chaqiruvchi ham shu orqali o'tadi.

---

## 10. Maoshga ulash

Tanlangan yo'l: **tasdiqlangan bonus `SalaryLedger` da alohida qator sifatida `Expected` ga qo'shiladi.**

```
Expected = BaseExpected − Deduction + Bonus
```

- `MonthSalaryDto` (`Dtos.cs:185`) → `+ decimal Bonus = 0, List<RetentionBonusLineDto>? Bonuses = null`
- `SalaryLedgerDto` (`Dtos.cs:198`) → `+ decimal TotalBonus = 0`
- `SalaryReportRowDto` (`Dtos.cs:209`) → `+ decimal Bonus = 0`
- `SalaryLedger.cs:193` → `var expected = baseExpected - deduction + bonus;`

Barcha yangi parametrlar **default qiymatli** — eski chaqiruvlar buzilmaydi.

### Nega darhol chiqim yozilmaydi

«Bonus berish» = **hisoblash**, pul chiqarish emas. Haqiqiy pul mavjud maosh to'lovi orqali beriladi
(`FinanceTransaction(expense, "salary")`). Aks holda Kassa/Moliya bir xil pulni ikki marta hisoblaydi
va "berilgan" deb ko'rsatilgan pul aslida kassadan chiqmagan bo'lib qoladi.

Natijada: bonus o'qituvchining `Remaining` (qoldiq) summasiga qo'shiladi → oddiy maosh to'lovi bilan
yopiladi → Moliya, Kassirlar hisoboti va Chiqimlar bo'limi **hech narsa o'zgarmaydi**.

---

## 11. Bosqichlar

| # | Ish | Fayllar | Vaqt |
|---|---|---|---|
| **0** | `GroupTeacherAssignment` + `ClassesController.cs:32,158` ga ilgak + backfill | Domain, Infrastructure, ClassesController | ~1 soat |
| 1 | Entity'lar + `CenterMeta` maydonlari + migratsiya `RetentionBonusSystem` | Entities.cs, IAppDbContext, AppDbContext | ~1.5 soat |
| 2 | `RetentionBonusService` — jadval, holat mantig'i, taqsimot | Application/Services | ~3 soat |
| 3 | `RetentionBonusController` + .xlsx eksport | Server/Controllers | ~1.5 soat |
| 4 | O'quvchi formasi ptichkasi + DTO | StudentFormModal, StudentsController, Dtos | ~1 soat |
| 5 | «Bonus hisoboti» sahifasi + berish modali | pages/admin/students/bonus/ | ~3 soat |
| 6 | O'qituvchi profili `bonus` tabi + o'qituvchi ilovasi | TeacherDetailPage, teacher/salary | ~2 soat |
| 7 | `SalaryLedger` ga ulash | SalaryLedger.cs, Dtos.cs | ~1.5 soat |

**Jami ~14 soat.**

**Bosqich 0 birinchi bajariladi** — u kechikkan har kun qayta tiklab bo'lmaydigan ma'lumot yo'qotadi
(4-bo'limga qarang).

---

## 12. Xavflar va diqqat nuqtalari

1. **`SalaryLedger` — tizimning eng nozik joyi.** Uni 3 ta ekran ishlatadi (3.3-bo'lim). O'zgartirishdan
   keyin: bonusi yo'q o'qituvchining raqamlari **bitta ham o'zgarmasligi** tekshiriladi.
2. **`BillableInMonth` nusxalanmasin** — `SalaryLedger.cs:283` dan umumiy joyga chiqariladi. Ikki nusxa
   bo'lsa, vaqt o'tib bir-biridan ajralib ketadi.
3. **Arxivlangan o'qituvchi** — bonus baribir hisoblanadi (o'tgan mehnati uchun), lekin ro'yxatda
   "arxivda" belgisi bilan chiqadi; admin qaror qiladi.
4. **Guruh yopilishi** (`ClassesController.cs:940` `close`) barcha a'zoliklarni muzlatadi → sikl pauzaga
   tushadi. Markaz o'zi yopib, o'quvchini boshqa guruhga o'tkazsa — `MaxGapMonths` buni ushlaydi.
5. **Kesh ishlatilmaydi** (`DataCache`) — moliya raqamlari darhol yangilanishi kerak.
6. **Unumdorlik** — ptichkali o'quvchilar soni kam bo'ladi; barcha ma'lumot ~5 ta so'rovda ommaviy
   yuklanadi (`.AsNoTracking()`), o'quvchi boshiga alohida so'rov qilinmaydi (N+1 bo'lmasin).

---

## 13. Tasdiqlanishi kerak bo'lgan qarorlar

| # | Savol | Tavsiya |
|---|---|---|
| 1 | Sanoq qaysi oydan? | **Birinchi aktivlashgan (pullik) oy** — sinov oyi ✗ chiqmasin |
| 2 | Muzlatilgan oy? | **PAUZA, max 2 oy** — ta'til kechiriladi, uzoq muzlash siklni uzadi |
| 3 | Bonus maoshga qo'shiladimi? | **Ha, alohida qator sifatida** (`Expected` ga) — o'qituvchi ilovasida ham ko'rinadi |
| 4 | «Berish» = pul chiqdimi? | **Yo'q — hisoblanadi.** Pul odatdagi maosh to'lovi orqali beriladi |

3 va 4 bir-biriga bog'liq: eng xavfsiz kombinatsiya — bonus maoshga alohida qator bo'lib qo'shiladi,
pul esa mavjud maosh to'lovi bilan chiqadi.

---

## 14. Ochiq savollar (keyinroq hal qilinadi)

- 6 oy to'lganda adminga Telegram xabarnomasi kerakmi? (`BookSalesService.NotifyAdminsAsync` tayyor
  namuna, `TuitionAccrualService` shabloni bilan yengil job)
- Ikkinchi va keyingi sikllar avtomatik boshlanadimi yoki admin qayta ptichka qo'yadimi?
- Bonus o'quvchining o'ziga/ota-onasiga ko'rinadimi? (hozircha **yo'q** deb rejalashtirilgan)
