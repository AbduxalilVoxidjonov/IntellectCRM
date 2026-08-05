# "Bog'lanish kerak" (follow-up navbati) qoidalari

Migratsiya: `AddContactRequests`. Modul O'quvchilar bo'limi ostida, lekin **ruxsati alohida**.

## 1. Oqim

1. O'quvchi profili → **"⋮" → "Bog'lanish kerak"** → SABAB tanlanadi (ixtiyoriy izoh va sana bilan)
   → o'quvchi **navbatga** tushadi.
2. **Bog'lanish kerak** bo'limi (`/admin/students/boglanish`) → operator qatordan **"Bog'lanildi"**
   bosadi va uchta narsani kiritadi:
   - **Natija** — ko'tardimi (`answered` / `no_answer` / `busy` / `wrong_number` / `other`);
   - **"Javobi nima dedi"** — erkin matn (modulning asosiy ma'lumoti);
   - **Keyingi qadam** — `done` (hal bo'ldi) | `callback` (qayta qo'ng'iroq, SANA bilan) |
     `failed` (bog'lanib bo'lmadi).
3. `callback` bo'lsa talab o'sha sanada yana navbatda chiqadi; sana o'tib ketsa — **muddati o'tgan**
   (qizil, ro'yxat tepasida, alohida chip).
4. Yakunlangan talabni **qayta ochish** mumkin (yana `new` bo'ladi).

## 2. Yagona katalog — `ContactService`

Bosqichlar, natijalar va o'tish qoidalari `Application/Services/ContactService.cs` da (sof
funksiyalar, `ContactServiceTests`). Backend, navbat sahifasi va hisobot AYNAN shu kalitlarni
ishlatadi; frontend yorliqlarni `GET /api/admin/contacts/meta` dan oladi.

| Bosqich | Yorliq | Navbatdami |
|---|---|---|
| `new` | Bog'lanish kerak | ha |
| `callback` | Qayta qo'ng'iroq | ha |
| `done` | Hal bo'ldi | yo'q |
| `failed` | Bog'lanib bo'lmadi | yo'q |

⚠️ **`new` ga QAYTARIB bo'lmaydi** (`CanTransitionTo`): bog'langandan keyin boshiga qaytish
navbatni cheksiz aylantirardi va hisobotda bosqich ko'rinmasdi. Kerak bo'lsa bugungi sana bilan
`callback` tanlanadi.

⚠️ **"Bog'lanildi" ≠ "urinish"**: kunlik hisobotdagi *"nechta odam bilan bog'lanildi"* faqat
`Results[].Reached == true` bo'lgan natijalarni sanaydi (`answered`, `other`). Ko'tarmagan
qo'ng'iroq **urinish**ga kiradi, "bog'lanildi"ga emas — aks holda hisobot haqiqiy aloqani
ko'rsatmasdi.

## 3. Entitylar

| Entity | Vazifasi |
|---|---|
| `ContactRequest` | Bitta TALAB (case): o'quvchi, sabab, holat, muddat + ro'yxat uchun denormalizatsiya (`AttemptCount`, `LastResponse`, `LastActorName`, `LastActionAt`) |
| `ContactAttempt` | Har bir HODISA: `created` \| `contact` \| `note` \| `reopen`. **Hisobotlar AYNAN shundan** hisoblanadi |

**SNAPSHOT maydonlar** (`StudentName`, `ReasonLabel`, `ActorName`) — ataylab takrorlangan:
o'quvchi arxivlansa, sabab katalogi tahrirlansa yoki xodim o'chsa ham tarix va hisobot buzilmasin.

`ContactAttempt.Date` ("yyyy-MM-dd") — kunlik hisobot AYNAN shu ustun bo'yicha guruhlanadi
(ISO vaqtdan `Substring` bilan guruhlash indeksdan foydalana olmasdi).

## 4. BITTA OCHIQ TALAB qoidasi

Bir o'quvchida bir vaqtda faqat **bitta** ochiq talab (`new`/`callback`) bo'ladi — aks holda navbat
bir xil odam bilan to'lib ketardi. `POST /api/admin/contacts` ikkinchisini ochmaydi: 400 qaytaradi
va javobda `existingId` beradi, UI esa navbatga havola ko'rsatadi. `reopen` da ham shu tekshiruv bor.

Yangi sabab paydo bo'lsa — yangi talab emas, mavjud talabga **izoh** (`POST {id}/note`) qo'shiladi.

## 5. RUXSAT — `contacts`

`[AdminPerm("contacts", ReadRequiresPerm = true)]`.

- O'quvchilar bo'limidan **ATAYIN alohida**: navbat bilan ishlaydigan operatorga o'quvchilar
  bo'limini to'liq ochish shart emas ("Kassa" "Moliya"dan alohida bo'lgani bilan bir xil mantiq).
- `ReadRequiresPerm = true` — javobda o'quvchi ismi va **telefonlari** qaytadi, GET'ni odatdagidek
  har qanday xodimga ochib bo'lmaydi.
- Amallar: `contacts:create` — talab ochish ("⋮" tugmasi), `contacts:edit` — bog'lanildi/izoh/qayta
  ochish, `contacts:delete` — talabni o'chirish.
- Nav: "O'quvchilar" guruhining O'ZIDA `perm` YO'Q (bolalarga ko'chirilgan) — aks holda faqat
  `contacts` berilgan operator guruhni umuman ko'rmasdi.

## 6. Sabablar

Sozlamalar → Sabablar, kategoriya **`contact`** (`ContactService.ReasonCategory`,
`ActionReasonsController` ruxsat etilgan kategoriyalar ro'yxatida). Sabab **ixtiyoriy** — bo'sh
bo'lsa hisobotda "— sababsiz —" guruhiga tushadi.

## 7. Hisobotlar (`GET /api/admin/contacts/stats`)

Barcha sonlar **hodisalardan** (`ContactAttempt`), ya'ni "kim nima qildi" bo'yicha:

- **Kunlik** — har kuni: yangi talab, urinish, bog'lanildi, hal bo'ldi, qayta qo'ng'iroq, bo'lmadi;
- **Xodimlar kesimi** — "kim qaysi bosqichga oldi, natijasi qanday bo'ldi";
- **Sabablar kesimi** — talab OCHILGAN sana bo'yicha (urinish emas);
- **Natijalar kesimi** — ko'tarmagan/band ulushi (aloqa sifati).

`OpenNow`/`OverdueNow` — davrga bog'liq EMAS, joriy holat (navbat sanoqlari bilan bir xil bo'lsin).

## 8. Audit

`ContactRequest` turi `AuditSections` da **`contacts`** ("Bog'lanish kerak") bo'limiga xaritalangan
— talab ochish, bog'lanish, izoh, qayta ochish va o'chirish "O'zgarishlar tarixi"da ko'rinadi.
Batafsil: `.claude/rules/audit.md`.
