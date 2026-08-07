---
description: Lid formalari — har bir ijtimoiy tarmoq uchun alohida ommaviy forma, ariza → lid, kanal kesimidagi voronka statistikasi.
paths:
  - "IntellectCRM.Application/Services/LeadFormService.cs"
  - "IntellectCRM.Application/Services/LeadOutcome.cs"
  - "IntellectCRM.Application/Services/LeadIntake.cs"
  - "IntellectCRM.Server/Controllers/LeadFormsController.cs"
  - "IntellectCRM.Server/Controllers/PublicLeadFormController.cs"
  - "IntellectCRM.Client/src/pages/admin/forms/**"
  - "IntellectCRM.Client/src/pages/public/PublicLeadFormPage.tsx"
  - "IntellectCRM.Client/src/api/services/leadForms.ts"
---

# Lid formalari qoidalari

Migratsiya: `AddLeadForms` (20260806140000). Bo'lim: **"O'quv bo'limi → Formalar"**.

## 1. «FORMALAR» — ikki turdagi forma, bitta bo'lim

Ilgari menyuda «Daraja testi» turardi. Endi u **«Formalar»** bo'limining bir turi:

| Tur | Sahifa | Ommaviy manzil | Ruxsat |
|---|---|---|---|
| **Lid formalari** (yangi) | `/admin/forms` | `/forma/{slug}` | `leads` |
| **Daraja testlari** (mavjud) | `/admin/level-tests` | `/test/{slug}` | `schedule` |

Sahifalar orasida `CardTabs` bilan o'tiladi (`config/sectionTabs.ts` → `formTabs`), marshrutlar
o'zgarmagan — eski havolalar ishlayveradi. Cardlar: **Lid formalari · Lid statistikasi ·
Daraja testlari** (o'rtadagisi ATAYIN "Statistika" emas — yonida daraja testi turgani va uning
O'Z statistika sahifasi ham borligi uchun yalang nom qaysi turga tegishli ekani noaniq bo'lardi).

⚠️ **Menyu qoidasi IKKI joyda:** Sidebar (`permAny`) va **Ctrl+K buyruq paneli**
(`CommandPalette`). Palitradagi `canSee` ilgari yalang `permissions.includes(perm)` edi —
`permAny` umuman tekshirilmasdi (ya'ni "Formalar" hech qanday ruxsati yo'q xodimga ham chiqardi)
va granular tokenli (`leads:view`) xodim menyuda ko'rinadigan bo'limni topa olmasdi. Endi ikkalasi
ham `lib/permissions.can` dan foydalanadi. Bo'lim ichidagi cardlar ham palitraga qo'shilgan
(`formTabs`) — aks holda «Daraja testi» menyudan card'ga aylangach **Ctrl+K dan yo'qolib qolardi**.

⚠️ **RUXSATLAR HAR XIL va ATAYIN shunday qoldirilgan:** daraja testi tarixan `schedule` (kurs
bilan bog'liq), lid formasi esa `leads` (u AYNAN lid ishlab chiqaradi va javobida telefonlar
qaytadi). Shu sabab menyu bandiga `permAny: ['leads','schedule']` qo'shildi — **ulardan
BIRORTASI** bo'lsa band ko'rinadi, ichkarida esa har bir card va marshrut o'z ruxsati bilan
darvozalangan. Yagona `perm` qo'yilsa faqat bitta ruxsati bor xodim bo'limni umuman ko'rmasdi.

⚠️ `/admin/forms` marshrutida yalang `RequirePerm` EMAS, **`FormsEntry`** turadi: `leads` yo'q-u
`schedule` bor xodim darhol `/admin/level-tests` ga yo'naltiriladi. Aks holda u menyudan kelib
"ruxsatingiz yo'q" kartasiga tushar va o'ziga OCHIQ bo'lgan daraja testlariga o'ta olmasdi —
cardlar ham o'sha yopiq sahifaning ichida.

## 2. NEGA HAR TARMOQQA ALOHIDA FORMA

Modulning butun ma'nosi: **`LeadForm.Source`** — formaning MANBASI. Instagram uchun bir forma,
Facebook uchun boshqasi, Telegram uchun uchinchisi; har birining havolasi o'sha tarmoqqa
qo'yiladi. Mijozdan "qayerdan eshitdingiz?" deb SO'RALMAYDI — javob havolaning o'zidan ma'lum,
ya'ni ma'lumot ishonchli (odam yodidan emas).

Manba `LeadSource` ma'lumotnomasidan tanlanadi (O'quv bo'limi → Sabablar) va lidga NOM sifatida
yoziladi — `Lead.Source` bilan bir xil konvensiya (`.claude/rules/crm-leads.md`).

**«Nusxalash»** (`POST /{id}/duplicate`) — "Instagram formasini Facebook uchun ham" holati:
savollar va matnlar ko'chadi, YANGI havola beriladi, lekin **manba bo'sh** va forma **o'chiq**
holda keladi. Sabab: nusxa tasodifan boshqa kanalning manbasi bilan lid yig'a boshlamasin.

**Sub-kanal (`?ref=`)** — bitta formaning havolasi bir necha joyga qo'yilganda
(`/forma/x?ref=story`, `?ref=bio`). Belgi topshiruvda saqlanadi va statistikada alohida kesim
bo'ladi. Tozalanadi (`NormalizeRef`): faqat harf/raqam/`-`/`_`, 40 belgi — ochiq havoladan
kelgani xom saqlanmaydi.

## 2.5. KURS — MARKAZ KATALOGIDAN OLINMAYDI

⚠️ Bu modulda kurs `Subject` ("Kurslar" bo'limi) ga **BOG'LANMAGAN** — tashqi kalit ham,
kurslar ma'lumotnomasi endpointi ham YO'Q:

| Maydon | Nima |
|---|---|
| `LeadForm.CourseName` | Formaning kursi — **ERKIN MATN**. Lidning `InterestSubject`i shu bo'ladi |
| `LeadForm.CourseOptions` | Mijozga ko'rsatiladigan **VARIANTLAR** — formaning O'ZIDA yoziladi (`text[]`) |

**Nega:** reklama formasida ko'pincha markazdagi rasmiy kurs nomi emas, taklifning O'ZI yoziladi
("Bepul sinov darsi", "Yozgi IELTS intensiv") va u hali kurs sifatida ochilmagan bo'lishi mumkin.
Ilgari bu yerda `Subject` ro'yxatidan tanlanadigan select turardi — kanal formasi markaz katalogiga
qarab qolar, marketolog o'z taklifini yoza olmasdi.

- `AskCourse` yoqilganda mijoz **faqat `CourseOptions` dan** tanlaydi; tanlanmasa (yoki begona
  qiymat kelsa) `CourseName` qoladi.
- `CourseOptions` **bo'sh** bo'lsa savol ommaviy formada UMUMAN ko'rsatilmaydi (`GetPublicAsync`
  `askCourse=false` qaytaradi) — bo'sh select mijozni boshi berk ko'chaga olib borardi.
- `CleanCourseOptions` — bo'sh/100 belgidan uzun qiymat tashlanadi, takror (registr farqisiz)
  birlashadi, **admin yozgan TARTIB saqlanadi**, ko'pi bilan `MaxCourseOptions` (30).
- Nusxalashda variantlar KO'CHADI (nusxa olishdan maqsad aynan shu ro'yxatni qayta yozmaslik).

⚠️ **Lidlar bo'limining o'zida qoida BOSHQACHA:** u yerda "qiziqqan fani" markaz kurslaridan
tanlanadi (`GET /api/admin/leads/courses`, `.claude/rules/crm-leads.md`). Ikkalasi ham `Lead.
InterestSubject` ga NOM yozgani uchun CRM statistikasi baribir bir joyda yig'iladi — lekin formada
kurs nomi markazdagidan farq qilishi MUMKIN va bu normal.

## 3. Entitylar

| Entity | Vazifasi |
|---|---|
| `LeadForm` | Forma: nom, `Slug`, **`Source`**, kurs (`CourseName` + `CourseOptions`), matnlar, standart maydon bayroqlari, ijtimoiy tarmoq havolalari, `IsActive`, `Views` |
| `LeadFormField` | Qo'shimcha savol: `Label`, `Kind`, `Options`, `Required`, `Order` |
| `LeadFormSubmission` | Bitta ariza: lid id, `IsNewLead`, kontakt, `CourseName` (SNAPSHOT), `Ref`, `AnswersJson` |

**Ism va telefon HAR DOIM so'raladi** (lidning eng kam ma'lumoti) — ular bayroq bilan
o'chirilmaydi. Sozlanadigan standart maydonlar: `AskAge`, `AskCourse`, `AskParentPhone`.
Ota-ona telefoni `Lead.FatherPhone` ga yoziladi (lidlar qidiruvi shu ustunni ham qamraydi;
ota/ona ATAYIN ajratilmaydi — ochiq formada bunday tafsilot so'ralmaydi).

Maydon turlari `LeadFormService.Kinds`: `text | textarea | number | select | radio | checkbox`.
Frontenddagi ro'yxat ham shu kalitlardan (`fieldKindLabels`, `GET /field-kinds`).

**Ijtimoiy tarmoq havolalari** (`InstagramUrl`/`TelegramUrl`/`FacebookUrl`/`YoutubeUrl`/
`WebsiteUrl`) — ariza YUBORILGANDAN KEYIN "Rahmat!" ekranida chip bo'lib chiqadi: mijoz menejer
qo'ng'iroq qilgunicha kanalga obuna bo'lib qolsin. Har formada ALOHIDA (Instagram reklamasidan
kelganga Instagram ko'rsatiladi). Bo'sh maydon chizilmaydi.

- `LeadFormService.NormalizeUrl` — sxemasiz yozilsa `https://` qo'shiladi, **faqat http/https**
  qabul qilinadi (`javascript:` mijozning brauzerida kod ishga tushirardi), noto'g'ri qiymat
  jimgina bo'shga aylanadi.
- ⚠️ Entity/DTO'da nom `Youtube` (`YouTube` EMAS) — camelCase JSON siyosati `YouTube` ni
  `youTube` qilib yuborardi (`CareerAbout` dagi bilan bir xil sabab).
- ⚠️ Ommaviy sahifada ikonkalar UMUMIY (`lucide-react` da brend ikonkalari yo'q), shu sabab
  yonida NOM ham yozilgan — mijoz qaysi tarmoq ekanini o'ylab qolmasin.

## 4. BIR TELEFON = BITTA LID (dublikat ochilmaydi)

Ariza kelganda telefon bo'yicha mavjud lid izlanadi — **`LeadIntake.FindByPhoneAsync`**
(oxirgi 9 raqam bo'yicha; eng birinchi yaratilgan lid olinadi). Bu daraja testi bilan
**YAGONA** kod: bir odam Instagram formasini to'ldirib, keyin daraja testini ham ishlasa —
Kanban bir xil odam bilan to'lib ketmasin.

Solishtirish **`Lead.PhoneKey`** (indekslangan ustun, migratsiya `AddLeadPhoneKeyAndRepeat`)
bo'yicha, DB tomonda. Ilgari bu qidiruv butun `Leads` jadvalini xotiraga o'qirdi — anonim
endpointdan chaqirilishini hisobga olsak, bu tashqaridan boshqariladigan og'irlik edi.

> ⚠️ `PhoneKey` **qo'lda yozilmaydi**: `AppDbContext.SaveChanges` uni `Phone` dan o'zi hisoblaydi
> (`SyncLeadPhoneKeys`). Sabab: lid to'rt joyda yaratiladi (lid formasi, daraja testi, CRM formasi,
> landing) va telefon tahrirlanadi ham — beshinchi joy qo'shilganda unutilsa, o'sha lid qidiruvdan
> tushib qolar va **unga dublikat lid ochilardi**. Migratsiya mavjud qatorlarni SQL bilan to'ldiradi.

⚠️ **TAKRORIY ariza mavjud lidning MANBASINI O'ZGARTIRMAYDI** (first-touch): odamni BIRINCHI
qaysi kanal olib kelgani saqlanadi. Forma kesimidagi hisobot baribir to'g'ri — topshiruv o'z
`FormId` si bilan yoziladi. Takroriy arizada lidga `LeadEvent` (izoh) qo'shiladi va
`IsNewLead=false` belgilanadi (UI'da "takroriy" deb ko'rinadi).

⚠️ **BOSQICH ham o'zgarmaydi — o'rniga «TAKRORIY» BELGISI** (`Lead.RepeatCount` / `LastRepeatAt`):
"yo'qotilgan" ustunida turgan odam qayta murojaat qilsa lid o'sha ustunda qolaveradi (first-touch
qoidasi), ya'ni ilgari bu faqat izoh va Telegram xabarida ko'rinardi — menejer sezmay qolardi.
Endi kanban kartasida **«Takroriy ×N»** chipi (`LeadCard`, oxirgi sana tooltipda) va lid oynasida
"Takroriy murojaat" qatori chiqadi. Sanoqni **lid formasi ham, daraja testi ham** oshiradi
(`LeadFormService.SubmitAsync` / `LevelTestService`) — birinchi murojaat sanalmaydi (0 = takror yo'q).
Avtomatik birinchi bosqichga QAYTARILMAYDI: menejerning kanbandagi qo'lda qo'ygan holatini
tizim o'zgartirib yubormasin.

⚠️ **Avto-xabar (`lead_new`) FAQAT yangi lidga** yuboriladi — takroriy arizaga tanishuv SMS'i
qayta ketmasin. Telegram xabarnomasi esa ikkalasida ham ketadi (sarlavha "mavjud lid yangilandi").

## 4.5. OMMAVIY SAHIFA — TELEFON BIRINCHI

Forma havolasi Instagram/Telegram profiliga qo'yiladi, ya'ni mijoz deyarli har doim TELEFONDA
turadi. Umumiy bo'laklar `pages/public/publicFormUi.tsx` da — lid formasi ham, DARAJA TESTI ham
(`/test/{slug}`) shulardan foydalanadi (ilgari ikkala sahifada ayri-ayri yozilgan edi).

- ⚠️ **Maydon shrifti telefonda 16px** (`text-base sm:text-sm`): iOS Safari 16px dan kichik
  maydonga bosilganda sahifani o'zi kattalashtiradi (auto-zoom) va foydalanuvchi kattalashgan
  ko'rinishda qolib ketadi — ariza formasida bu to'g'ridan-to'g'ri yo'qotilgan lid.
- Maydonlar haqiqiy **`<form>`** ichida: telefon klaviaturasida "yuborish" tugmasi chiqadi,
  brauzerning avto-to'ldirishi ishlaydi (`autoComplete="name"/"tel"`), Enter bilan ham yuboriladi.
- ⚠️ **Ota-ona telefonida avto-to'ldirish ATAYIN o'chiq** (`autoComplete="off"`) — bu BOSHQA
  odamning raqami, brauzer mijozning o'zinikini taklif qilib xato ma'lumot yozdirardi.
- Tegish maydonlari ≥44px (`py-3`), kartaning gorizontal padding'i telefonda torroq (`cardPadX`) —
  360px ekranda matnga 40px ko'proq joy qoladi.

## 5. Tekshiruvlar (ochiq endpoint)

Hammasi `LeadFormService.SubmitAsync` ichida — controller ham, kelajakdagi boshqa chaqiruvchi
ham bir xil qoidada:

- ism bo'sh/100 belgidan uzun → 400; telefon `PhoneUtil.Validate` dan o'tadi;
- **majburiy savol bo'sh bo'lsa ariza UMUMAN saqlanmaydi** (yarim holatdagi lid qolib ketmasin);
- variantli savolda (`select/radio/checkbox`) **faqat mavjud variantlar** qabul qilinadi —
  API'ga qo'lda yuborilgan begona matn lidga tushmaydi;
- bitta tanlovli savolga bir nechta javob kelsa — birinchisi olinadi;
- javob uzunligi `MaxAnswerLength` (500), maydonlar soni `MaxFields` (25), variantlar `MaxOptions` (30);
- `AskCourse` da mijoz tanlagan kurs **formaning `CourseOptions` ro'yxati bilan** solishtiriladi
  (registr farqisiz); ro'yxatda yo'q qiymat jim rad etiladi va formaning `CourseName` iga
  qaytiladi (CRM statistikasi kurs nomlari bo'yicha yig'iladi — axlat qiymat kerak emas);
- endpoint `public-lead` rate-limit ostida (daraja testi bilan bir xil).

⚠️ Variantsiz qolgan `select/radio/checkbox` maydoni **saqlashda oddiy matnga tushiriladi**
(`WriteFields`) — aks holda mijoz hech narsa tanlay olmaydigan bo'sh maydon ko'rardi.

## 6. Statistika — voronka

`GET /api/admin/lead-forms/stats` (`LeadFormService.BuildStatsAsync`):
**ochildi (`Views`) → ariza → lid → o'quvchi → hozir faol**, forma / manba / `ref` kesimida +
oxirgi 30 kunlik oqim.

⚠️ **Konversiya foizi TAKRORSIZ LIDLAR bo'yicha** hisoblanadi, arizalar bo'yicha emas: bir odam
formani ikki marta to'ldirsa ham u bitta mijoz — aks holda ko'p to'ldirilgan forma sun'iy
ravishda yomon ko'rinardi. `SubmitRate` esa ariza/ochilish (bu yerda takrorlar sanaladi — savol
"havolani ochgan necha kishi to'ldirdi").

`Views` ommaviy `GET /api/public/form/{slug}` da **bitta `ExecuteUpdate`** bilan oshiriladi
(entity yuklab-yozish ikki mijoz bir vaqtda kirganda sanoqni yo'qotardi).

**Natija `DataCache` da** (`leadforms:stats`, TTL 10 daq zaxira; bog'liq turlar: `LeadForm`,
`LeadFormSubmission`, `Lead`, `LeadStage`, `StudentGroup`, `FinanceTransaction`) — voronka qisman
ma'lumotdan chiqmagani uchun hisob BUTUN arizalar to'plami ustida boradi. Arizalar to'liq entity
sifatida emas, **yengil proyeksiya** bilan o'qiladi (`SubRow`: forma, lid, yangimi, ref, sana) —
ism/telefon/javoblar JSON'i sanoqqa umuman kerak emas.

> ⚠️ `ExecuteUpdate` **`SaveChanges`dan o'tmaydi**, ya'ni `CacheInvalidationInterceptor` uni
> sezmaydi. Shu sabab `PublicLeadFormController` ochilishni oshirgach `dataCache.Bump(LeadForm)`
> ni O'ZI chaqiradi — aks holda "Ochilgan" soni TTL tugagunicha qotib qolardi.

**"Lid → BOSQICH → o'quvchi → TO'LOV → faol a'zolik" zanjiri — `LeadOutcome` (YAGONA manba):**
daraja testi statistikasi (`LevelTestService.BuildStatRowsAsync`) ham AYNAN shundan o'qiydi, ya'ni
"aktiv" yoki "to'ladi" so'zi ikki bo'limda ikki xil ma'no anglatmaydi.
Aktiv = `StudentGroup.IsActive && Status=="active"`.

## 6.5. SOTUV KONVERSIYASI — bosqich va to'lov

Savol "nechta o'quvchi bo'ldi" emas, **"nechtasi PUL to'ladi"**: o'quvchiga aylantirilgan lid hali
pul degani emas (sinov darsiga kelib, keyin yo'qolishi mumkin).

| Ko'rsatkich | Manba | Ma'nosi |
|---|---|---|
| `StageTitle`/`StageColor` | `Lead.Stage` → `LeadStage` | Lid HOZIR kanbanning qaysi ustunida |
| `Paid` / `PaidTotal` | `FinanceTransaction` | Kirim `tuition` MINUS chiqim `refund` > 0 |
| `FirstPaidAt` | birinchi kirim sanasi | "Qachon pul keldi" (vozvrat ta'sir qilmaydi) |
| `PayRate` | `Paid / takrorsiz lid` | **Sotuv konversiyasi** |
| `ByStage` | takrorsiz lidlar | "Voronka qayerda tiqilib qolgan" |

- ⚠️ To'lov QAYSI kurs uchun ekani AHAMIYATSIZ — savol "shu kanal markazga pul keltirdimi".
- ⚠️ **Kitob sotuvi kirmaydi** (u `FinanceTransaction`ga umuman yozilmaydi — `books.md`), ya'ni
  "to'ladi" faqat O'QISH uchun to'lovni bildiradi.
- ⚠️ Puli TO'LIQ qaytarilgan lid **to'lamagan** hisoblanadi (sof summa ≤ 0) va `Revenue` ga
  manfiy qo'shilmaydi — aks holda hisobot bo'lmagan daromadni ko'rsatardi.
- ⚠️ Yangi lid AVTOMATIK birinchi bosqichga tushadi (`LeadIntake.FirstStageIdAsync`) — ya'ni
  formadan kelgan lid voronkada darhol ko'rinadi. Ustun O'CHIRILGAN bo'lsa lid bosqichsiz qoladi
  va `ByStage` ga kirmaydi (kanbanda ham ko'rinmaydi) — sun'iy "Noma'lum bosqich" YASALMAYDI.

UI: arizalar jadvalida «Bosqich» chipi (`components/leads/LeadStageChip.tsx` — ranglar kanban
ustunlari bilan bir xil), «To'lov» ustuni (summa + birinchi to'lov sanasi) va **«Lidni ochish →»**
(`/admin/leads?lead={id}` — `LeadsPage` shu parametr bilan AYNAN o'sha lid oynasini ochadi va
parametrni manzildan darhol olib tashlaydi, aks holda oyna yopilib-yopilib qayta ochilaverardi;
lid o'chirilgan bo'lsa tugma umuman ko'rsatilmaydi); statistika sahifasida
«To'lov qildi» kartasi, forma/manba/ref kesimlarida `To'ladi`+`Tushum`, «Lidlar qaysi bosqichda»
kartasi. Daraja testi statistikasida ham AYNAN shu ustunlar bor.

## 7. API

| Metod · yo'l | Vazifasi |
|---|---|
| `GET /api/admin/lead-forms` | Formalar + maydon/ariza sanog'i |
| `GET|POST|PUT|DELETE /{id}` | CRUD (maydonlar TO'LIQ almashtiriladi) |
| `POST /{id}/duplicate` | Nusxa — yangi havola, manbasiz va o'chiq |
| `GET /submissions?formId=` | Arizalar (max 1000) + lidning hozirgi holati |
| `GET /stats` | Voronka (forma / manba / ref / kunlik) |
| `GET /sources`, `/field-kinds` | Ma'lumotnomalar (**kurslar endpointi YO'Q** — §2.5) |
| `GET /api/public/form/{slug}` | Ommaviy forma (+ `Views`) |
| `POST /api/public/form/{slug}/submit` | Ariza (`public-lead` rate-limit) |

Admin controller `[AdminPerm("leads", ReadRequiresPerm = true)]` — javobda abituriyentlarning
telefon raqamlari bor, shuning uchun GET ham darvozalangan (odatdagi bo'limlararo o'qish
istisnosi bu yerda ochiq qolmaydi).

**Formani o'chirish** arizalar tarixini ham o'chiradi, LEKIN ular yaratgan **lidlar CRM'da
qoladi** (mijoz yo'qolmasin) — UI tasdiqda shu aytiladi.

## 8. Audit

`LeadForm` turi `AuditSections` da **`leads`** ("Lidlar") bo'limiga xaritalangan: yaratish,
tahrir, nusxa va o'chirish "O'zgarishlar tarixi"da ko'rinadi. Batafsil: `.claude/rules/audit.md`.

## 9. Testlar

`IntellectCRM.Tests/LeadFormsTests.cs` — takroriy murojaat belgisi (`RepeatCount`), telefon
kalitining avtomatik yozilishi/yangilanishi va chala raqamda begona lidga biriktirilmasligi,
manba formadan olinishi, dublikat lid ochilmasligi,
first-touch manba, majburiy savol, begona variant, faol bo'lmagan forma, `?ref=` tozalanishi,
takrorsiz-lid konversiyasi va **kurs qoidalari** (formaning o'z variantlaridan olinishi, ro'yxatda
yo'q kursning rad etilishi, variantsiz savolning ko'rsatilmasligi, variantlar tozalanishi).
