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

## 3.5. KO'PLAB QO'SHISH (o'quvchilar ro'yxatidan)

"O'quvchilar ro'yxati"da bir nechtasini belgilab **«Bog'lanish kerak»** bosiladi — sabab/izoh/
sana BIR marta tanlanadi va hammasiga birdek qo'llanadi. `POST /api/admin/contacts/bulk`
(`MaxBulk = 500`).

⚠️ Ochiq talabi bor o'quvchi **CHETLAB O'TILADI**, butun amal to'xtamaydi — javobda
`created` / `skipped` / `skippedNames` / `notFound` qaytadi. Aks holda 100 ta tanlangandan
bittasi tufayli hech kim navbatga tushmasdi.

Bitta o'quvchi uchun ham (profil "⋮") AYNAN shu endpoint ishlatiladi — `NeedContactModal`
`students: ContactTarget[]` qabul qiladi, ya'ni qoida ikki joyda ayri ketmaydi. Talab
yaratish mantig'i controllerda bitta `AddRequest` yordamchisida (`POST /contacts` ham,
`/bulk` ham shuni chaqiradi).

## 3.6. MUDDAT GURUHLARI — "bugun kimga qo'ng'iroq kerak?"

Operatorning asosiy savoli BOSQICH emas, VAQT. Qoida `ContactService.BucketOf` da (sof
funksiya, testlangan) — `today` PARAMETR sifatida uzatiladi, ichkarida `AppClock` o'qilmaydi.

| Guruh | Nima |
|---|---|
| `todo` | **BUGUN QILISH KERAK** = `overdue` + `today` + `nodate` |
| `overdue` | Qayta qo'ng'iroq sanasi bugundan OLDIN |
| `today` / `tomorrow` | Bugun / ertaga |
| `week` | Bugundan +2..+7 kun |
| `later` | +7 kundan keyin |
| `nodate` | Sana belgilanmagan (`new` holati) — hoziroq navbatda |

⚠️ `todo` ga **kechikkanlar ham, sanasizlar ham** kiradi — aks holda operator "bugun 5 ta"
deb ko'rib, kechagi 12 tasini ko'rmay qolardi.

⚠️ Sanasiz `callback` bo'lmasligi kerak (server sanani talab qiladi), lekin eski/qo'lda
tuzatilgan yozuv shunday bo'lsa **`nodate` ga tushadi** — yo'qolib ketmaydi. Buzuq sana
(`2026-13-99`) `later` ga tushadi va navbatda ko'rinadi.

**API:** `GET /contacts?due=<guruh>` yoki `?dueDate=YYYY-MM-DD` (aniq kun). `GET /contacts/meta`
javobida `due` (kesim) va `days` (yaqin 14 kun rejasi, faqat ish BOR kunlar) qaytadi.
SQL tarjimasi controllerda, QOIDA esa `ContactService` da — ikkisi bir xil bo'lishi shart.

**UI:** navbat tepasida uchta katta raqam (Bugun qilish kerak · Muddati o'tgan · Ertaga),
"Yaqin kunlar" chizig'i (kun → nechta, bosilsa o'sha kun filtri) va "Muddat" chiplari.
Muddat va Holat filtrlari **BIR-BIRINI TOZALAYDI** — "Hal bo'ldi + bugun" kabi mantiqan bo'sh
kesishmalar operatorni chalg'itardi.

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

**O'quv bo'limi → Sabablar** sahifasida "Bog'lanish kerak" kartochkasi, kategoriya **`contact`** (`ContactService.ReasonCategory`,
`ActionReasonsController.Categories` ro'yxatida). Sabab **ixtiyoriy** — bo'sh bo'lsa hisobotda
"— sababsiz —" guruhiga tushadi.

⚠️ **KATEGORIYA IKKI JOYDA EDI va DRIFT bo'ldi:** backendda `contact` bor edi, `ReasonsPage.tsx`
dagi `CATEGORIES` da esa YO'Q — natijada admin sabab qo'sha olmas, tanlash ro'yxati doim bo'sh
chiqardi (xuddi shu sabab `archive_student` ham ko'rinmasdi). Endi kartochkalar
**`GET /api/admin/action-reasons/categories`** dan quriladi: frontenddagi ro'yxat faqat
SARLAVHA/IKONKA beradi, yorlig'i topilmagan kategoriya baribir (kalit nomi bilan) ko'rinadi —
bo'shliq jimgina yo'qolmaydi.

## 7. Hisobotlar (`GET /api/admin/contacts/stats`)

Barcha sonlar **hodisalardan** (`ContactAttempt`), ya'ni "kim nima qildi" bo'yicha:

- **Kunlik** — har kuni: yangi talab, urinish, bog'lanildi, hal bo'ldi, qayta qo'ng'iroq, bo'lmadi;
- **Xodimlar kesimi** — "kim qaysi bosqichga oldi, natijasi qanday bo'ldi";
- **Sabablar kesimi** — talab OCHILGAN sana bo'yicha (urinish emas);
- **Natijalar kesimi** — ko'tarmagan/band ulushi (aloqa sifati).

`OpenNow`/`OverdueNow` — davrga bog'liq EMAS, joriy holat (navbat sanoqlari bilan bir xil bo'lsin).

## 7.5. JAVOBLAR TAHLILI ("nima deb yozilgan")

Sonlar "nechta" ga javob beradi, bu bo'lim esa **"NIMA deyilgan"** ga:

- **`GET /api/admin/contacts/responses`** — javoblar lentasi. Faqat `Type=contact` VA
  `Response != ""` qatorlar (bo'sh javoblar lentani suyultirib, o'qishni qiyinlashtirardi).
  Filtrlar: davr, natija, xodim, matn ichidan qidiruv. Chegara 500 (default 200).
- **`ContactStatsDto.TopWords`** — javoblarda eng ko'p uchragan so'zlar
  (`ContactService.TopWords`, sof funksiya, testlangan).
  - ⚠️ Bir matnda takrorlangan so'z **BIR marta** sanaladi: savol "necha marta yozildi" emas,
    "NECHTA JAVOBDA uchradi" — aks holda bitta uzun izoh butun hisobotni egallab olardi.
  - ⚠️ Apostroflar (`'` `ʻ` `’` `` ` ``) bir ko'rinishga keltiriladi — aks holda "to'lov" va
    "toʻlov" ikki xil so'z bo'lib sanalardi (matn turli klaviaturalardan kiritiladi).
  - `StopWords` ATAYIN qisqa: faqat bog'lovchi/olmosh/yordamchi so'zlar. "to'lov", "dars",
    "kasal", "kerak" QOLADI — aynan ular hisobotning ma'nosi.
- UI'da so'z bosilsa javoblar lentasi o'sha so'z bo'yicha filtrlanadi ("nega bu so'z ko'p?").

## 7.6. O'QUVCHI PROFILIDA

`GET /contacts/student/{id}` **tarixni ham** qaytaradi (ro'yxat endpointi qaytarmaydi — bu bitta
o'quvchi uchun ikkita yengil so'rov). O'quvchi profilining **"Aloqa"** tabida:

- **"Bog'lanish tarixi"** — talab darajasi: sabab, bosqich, muddat ("NIMA UCHUN va qaysi
  bosqichda");
- **"Qo'ng'iroqlar tarixi"** — ARALASH lenta: haqiqiy qo'ng'iroqlar (Local Call) va bog'lanish
  javoblari BITTA vaqt o'qida, eng yangisi tepada.

⚠️ Javob matni **faqat lentada** chiqadi, yuqoridagi bo'limda TAKRORLANMAYDI — aks holda bir
xil matn bitta tabda ikki marta ko'rinardi. Sabab: operator qo'ng'iroq qiladi, keyin "javobi
nima dedi" ni yozadi — bular bitta hodisaning ikki tomoni, ayri ro'yxatlarda bir-biridan
uzoqda tushib qolardi.

## 8. Audit

`ContactRequest` turi `AuditSections` da **`contacts`** ("Bog'lanish kerak") bo'limiga xaritalangan
— talab ochish, bog'lanish, izoh, qayta ochish va o'chirish "O'zgarishlar tarixi"da ko'rinadi.
Batafsil: `.claude/rules/audit.md`.
