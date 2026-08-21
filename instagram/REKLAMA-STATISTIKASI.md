# Reklama statistikasi (Meta Ads Insights + ROI) — sozlash

> Kimga: markaz administratori / marketing mas'uli. Modul Meta reklama kabinetidagi
> **xarajat**ni CRM'dagi **lid → o'quvchi → to'lov** zanjiri bilan birlashtiradi va
> Ads Manager'da **umuman yo'q** bo'lgan savolga javob beradi:
>
> *"Bu oyda reklamaga N so'm sarfladik, M ta lid keldi, bittasi K so'mga tushdi,
> ulardan P tasi o'quvchi bo'ldi va R so'm to'ladi."*
>
> **CRM tomonidagi ish: ~15 daqiqa. Meta tomonida App Review KERAK EMAS** (pastda sabab).

Sahifa: **Marketing → Reklama statistikasi** (`/admin/marketing/reklama-statistikasi`),
sozlash: **Marketing → Sozlamalar → «Reklama statistikasi (Ads Insights)»**.

---

## 🔴 ENG MUHIM XABAR — TOKEN BOSHQA

Bu modulda eng ko'p vaqt aynan shu yerda yo'qoladi. Marketing bo'limida **uchta har xil token**
ishlatiladi va ular bir-birining o'rnini **BOSMAYDI**:

| Modul | Token | Ruxsat | Muddati |
|---|---|---|---|
| Izoh · DM agenti | Instagram Login tokeni (OAuth bilan o'zi olinadi) | `instagram_business_*` | 60 kun, avtomatik yangilanadi |
| **Reklama lidlari** | **Page Access Token** | `leads_retrieval` | muddatsiz (System User) |
| **Reklama statistikasi** | **System User tokeni** | **`ads_read`** | **muddatsiz** |

🔴 **Reklama lidlari uchun kiritilgan Page Access Token bu yerda YARAMAYDI.** Page tokenida
`ads_read` ruxsati umuman yo'q, chunki statistika **Page** obyektiga emas, **Ad Account**
(reklama kabineti) obyektiga tegishli. Almashtirib yuborilsa Meta `OAuthException 190` yoki
`200`/`10` qaytaradi va sababi tashqaridan "nimadir ishlamayapti" bo'lib ko'rinadi.

⚠️ Shuning uchun CRM'da reklama akkaunti **alohida** saqlanadi (`IgAdAccount`) va Sozlamalarda
**alohida kartochka**da kiritiladi — reklama lidlari kartochkasi bilan aralashtirmang.

**App Review kerakmi?** Reklama kabineti sizniki bo'lsa va uni ilova adminlari boshqarsa —
**kerak emas**, Standard Access yetadi. ⚠️ Amalda tekshiring: ulaganda `#200` yoki `#10` xatosi
chiqsa, demak `ads_read` uchun Advanced Access so'rash kerak.

---

## ☐ 0-qadam. Shartlar

| Talab | Qanday tekshiriladi |
|---|---|
| **Meta Business Manager** hisobi | `business.facebook.com` ochiladi |
| Unga biriktirilgan **reklama kabineti** (Ad Account) | Business settings → Accounts → Ad accounts |
| Kabinetda **haqiqiy sarf** bo'lgan bo'lsin | Ads Manager'da oxirgi 30 kunda xarajat ko'rinadi |
| CRM'da `marketing.settings` ruxsati bor foydalanuvchi | Sozlamalar → Xodimlar va rollar |

ℹ️ **Reklama lidlari moduli yoqilgan bo'lishi SHART emas** — statistika (xarajat, ko'rsatish,
Meta lidlari) usiz ham keladi. Lekin **ROI ustunlari** (CRM lidlari, o'quvchi bo'ldi, daromad)
faqat reklama lidlari CRM'ga tushayotgan bo'lsa to'ladi: zanjir `IgAdLead → Lead` orqali
quriladi. Ikkalasini birga yoqish tavsiya etiladi (`REKLAMA-LIDLARI.md`).

---

## ☐ 1-qadam. Reklama kabineti ID sini topish

1. **Ads Manager** (`adsmanager.facebook.com`) ni oching;
2. Yuqoridagi kabinet tanlagichida id ko'rinadi, yoki manzil satridagi `act=1234567890` qismini oling;
3. Yoki **Business settings → Accounts → Ad accounts** ro'yxatidan.

CRM formasiga **ikkala ko'rinishni ham** kiritish mumkin:

| Kiritilgan | Bazada saqlanadi |
|---|---|
| `act_1234567890` | `act_1234567890` |
| `1234567890` | `act_1234567890` (prefiks o'zi qo'shiladi) |

⚠️ Prefikssiz qiymat Graph so'roviga to'g'ridan-to'g'ri qo'yilsa `code 100` beradi, shuning uchun
CRM normalizatsiyani **saqlashdan oldin** qiladi — bazada har doim prefiksli qiymat turadi.
Raqamdan boshqa belgi bo'lsa forma darhol rad etadi.

---

## ☐ 2-qadam. System User tokeni (`ads_read`)

**Tavsiya — System User tokeni: u MUDDATSIZ**, ya'ni bir marta olinadi va 60 kunda o'lmaydi.

1. `business.facebook.com` → **Business settings → Users → System users** → **Add**
   (reklama lidlari uchun yaratgan sistema foydalanuvchisi bo'lsa **o'shani** ishlatish mumkin);
2. Rolni **Admin** qiling;
3. **Add assets** → **Ad accounts** → kerakli kabinetni tanlang va **to'liq huquq** bering;
   ⚠️ Aynan **Ad account** biriktirilishi shart — faqat Page biriktirilgan sistema foydalanuvchisi
   statistikani ko'ra olmaydi;
4. **Generate new token** → ilovangizni tanlang → ruxsatlar:
   - **`ads_read`** (asosiysi, majburiy),
   - `business_management` (System User bilan ishlaganda tavsiya etiladi);
5. Tokenni nusxa oling — **u faqat bir marta ko'rsatiladi**.

⚠️ `ads_management` **kerak emas**: CRM reklamani boshqarmaydi, faqat **o'qiydi**. Ortiqcha ruxsat
so'rash App Review talabini oshiradi.

---

## ☐ 3-qadam. CRM'da ulash

**Marketing → Sozlamalar → «Reklama statistikasi (Ads Insights)»**:

1. **«Reklama statistikasi yoqilgan»** — yoqing;
2. **Reklama akkaunti ID** va **System User tokeni** ni kiriting;
3. **«Ulash va tekshirish»** bosing.

Tugma bosilganda CRM **saqlashdan OLDIN** Meta'ga bitta so'rov yuboradi
(`GET /act_{id}?fields=name,currency,timezone_name,account_status`) va undan:

| Nima olinadi | Nima uchun kerak |
|---|---|
| Kabinet **nomi** | ekranda ko'rsatiladi |
| **Valyuta** (`USD` / `UZS` / …) | summalarni to'g'ri ko'rsatish uchun |
| **Vaqt zonasi** (`Asia/Tashkent`, `America/Los_Angeles` …) | statistika kunlari AYNAN shu zonada kesiladi |

🔴 **Tekshiruv o'tmasa hech narsa saqlanmaydi** va xato sababi o'zbekcha ko'rsatiladi. Bu ataylab:
aks holda nosozlik "ulandi, lekin statistika kelmayapti" bo'lib bir haftadan keyin sezilardi.

⚠️ **Token formada hech qachon ko'rsatilmaydi.** Faqat "Sozlangan / Sozlanmagan" holati chiqadi.
Token maydonini **bo'sh qoldirib** saqlasangiz — mavjud token o'z joyida qoladi (ya'ni faqat
akkaunt id'sini tuzatish uchun tokenni qayta yozish shart emas).

⚠️ **Bir vaqtda faqat BITTA faol reklama akkaunti** bo'ladi. Yangisi ulanganda eskisi
**uziladi** (`IsActive=false`) va tokeni tozalanadi, lekin **qatori va yig'ilgan statistikasi
o'chirilmaydi** — o'tgan oylarning hisoboti buzilmaydi.

✅ **Qanday tekshiriladi:** kartochkada kabinet nomi, valyuta va vaqt zonasi ko'rinadi,
«Token: Sozlangan» yashil bo'ladi.

---

## ☐ 4-qadam. Birinchi sinxronizatsiya

Ulangandan keyin **«Hoziroq sinxronlash»** tugmasini bosing (yoki ertalabki avtomatik ishni kuting).

### Sinxronizatsiya siyosati

| Qachon | Qaysi oraliq | Nega shunday |
|---|---|---|
| **Birinchi ulanish** (`LastSyncAt` bo'sh) | oxirgi **90 kun** (sozlanadi), **10 kunlik bo'laklarda** | 90 kunni bitta so'rovda so'rash `100/1487534` («juda ko'p ma'lumot») xatosini beradi: `level=ad` + kunlik + platforma bo'linmasi bilan bitta reklama bir kunda 2–3 qator chiqaradi |
| **Har kuni** soat **5:00** da (sozlanadi) | oxirgi **7 kun** qayta yuklanadi | ⚠️ Meta atributsiyani **48 soatgacha** (ba'zi hodisalarda 7 kunlik oyna bilan) tuzatib turadi — bir marta yozilgan kun keyin ham o'zgaradi |
| **Qo'lda** («Hoziroq sinxronlash») | tanlangan oraliq (ko'pi bilan 365 kun) | tarixni to'ldirish yoki tekshirish uchun |

⚠️ **Qayta yuklash dublikat yaratmaydi.** Har qator `(daraja, obyekt id, sana, platforma)`
kaliti bo'yicha **upsert** qilinadi — bu kalit bazadagi unikal indeks bilan aynan bir xil.

⚠️ **Yarim bajarilgan yuklash "tugadi" deb belgilanmaydi.** Backfill o'rtasida to'xtasa
`LastSyncAt` yangilanmaydi va ertaga u **boshidan** takrorlanadi. Bu ataylab: upsert takroriy
yuklashni zararsiz qiladi, "yarim yuklangan tarix" esa hisobotda **jimgina teshik** qoldirardi.

⚠️ **Kvota tugashiga oz qolganda CRM O'ZI to'xtaydi** (95%). Meta ochiq aytadi: limitga
yetganda chaqiruvni davom ettirish blokni **uzaytiradi**. Qolgan bo'laklar keyingi ishga
qoladi va yo'qolmaydi.

✅ **Qanday tekshiriladi:** kartochkada «Oxirgi yangilash» vaqti va bazadagi qatorlar soni
ko'rinadi; sahifada kunlik xarajat grafigi to'ladi.

---

## ☐ 5-qadam. Ekranni o'qish

**Marketing → Reklama statistikasi** sahifasi:

| Blok | Nima |
|---|---|
| **Filtr** | sana oralig'i (tayyor tugmalar), platforma (Hammasi / Instagram / Facebook), kampaniya |
| **KPI (7 ta)** | Xarajat · Ko'rsatish · Qamrov · CRM lidlari · **CPL** · O'quvchi bo'ldi · **ROI** |
| **Grafik 1** | kunlik **xarajat** |
| **Grafik 2** | kunlik **lidlar** — ⚠️ ATAYIN alohida grafik: bitta grafikda ikki y-o'q ishlatish loyihada taqiqlangan |
| **Grafik 3** | platforma ulushi (Instagram / Facebook) |
| **Jadval** | kampaniya → adset → e'lon daraxti, ROI ustunlari bilan; har qatorda **«Lidlarni ko'rish →»** |
| **Holat** | oxirgi yangilash, oxirgi xato, «Qayta urinish» |

Sana berilmasa — **oxirgi 30 kun**. Bir so'rovda ko'pi bilan **400 kun** ko'rish mumkin
(oshsa 400 xato va tushunarli sabab qaytadi, jimgina qirqilmaydi).

Jadvalda ko'pi bilan **200 ta kampaniya** va har kampaniya ostida **100 tagacha** adset/e'lon
chiziladi. Oshib ketgani **jim tashlanmaydi** — jadval tagida ochiq yoziladi, **yuqoridagi
jamlanma esa BARCHASI bo'yicha**.

---

## 📐 ROI ustunlari — qaysi raqam qayerdan

| Ustun | Manba | Izoh |
|---|---|---|
| **Kampaniya / adset / e'lon** | `IgAdEntity.Name` | nom topilmasa Meta id'ning O'ZI chiziladi (Ads Manager'da qidirsa bo'ladi), sun'iy "Noma'lum" yozilmaydi |
| **Xarajat** | `SUM(IgAdInsight.SpendMinor)` | ⚠️ faqat **tanlangan oraliqda** |
| **Ko'rsatish** | `SUM(Impressions)` | |
| **Qamrov** | `MAX(Reach)` … `SUM(Reach)` | 🔴 **TAXMINIY** — pastdagi «Halollik» bo'limiga qarang |
| **Meta lidlari** | `LeadsOnsite + LeadsPixel` | ⚠️ Meta'ning `lead` turi **ishlatilmaydi**: u shu ikkisining yig'indisi, uchtasini qo'shsak lid ikki marta sanalardi |
| **CRM lidlari** | `COUNT(DISTINCT IgAdLead.LeadId)` | takrorsiz; bir odam ikki marta ariza qoldirsa ham CRM'da bitta lid bo'lishi mumkin |
| **CPL** (lid narxi) | Xarajat ÷ CRM lidlari | xarajat 0 yoki lid 0 bo'lsa — **«—»**, `0` YOZILMAYDI ("lid tekinga tushdi" degan yolg'on xulosa chiqmasin) |
| **O'quvchi bo'ldi** | `LeadOutcome` — `ConvertedStudentId` to'lgan lidlar | |
| **To'lov qildi** | `LeadOutcome` — sof `tuition` to'lovi > 0 | kitob savdosi **kirmaydi** (`books.md` §7: u `FinanceTransaction` ga yozilmaydi) |
| **Daromad** | shu lidlarning sof `tuition` yig'indisi | ⚠️ **butun umr bo'yi**; to'liq qaytarilgan to'lov **manfiy qo'shilmaydi** |
| **CAC** (mijoz narxi) | Xarajat ÷ to'lov qilganlar | CPL bilan bir xil qoida (bo'luvchi 0 → «—») |
| **ROI** | (Daromad − Xarajat) ÷ Xarajat | `1.5` = **+150%**. Xarajat 0 → «—»; daromad 0 → **−100%** (bu haqiqiy qiymat, «—» emas) |

⚠️ **Konversiya LID bo'yicha, daromad esa O'QUVCHI bo'yicha dedup qilinadi.** Bir odam ikki
marta ariza qoldirsa CRM'da ikki lid bo'lib, ikkalasi ham bitta o'quvchiga ulanishi mumkin:
"nechta lid to'lov qildi" — sotuv voronkasining o'lchovi (lid darajasida qoladi), pulni esa
ikki marta qo'shish "daromad ikki barobar" degan yolg'on berardi.

⚠️ **`LeadOutcome` — YAGONA manba.** "To'ladi" so'zi lid formalari statistikasida, daraja
testlarida va shu hisobotda **bir xil** ma'no anglatishi shart.

---

## 🔴 HALOLLIK — hisobotni noto'g'ri o'qimaslik uchun

Bu bo'lim ekranda ham (jadval ostidagi izohlar sifatida) ko'rinadi. Uni **o'qib chiqing**:
raqamlar to'g'ri, lekin ularning **ma'nosi** birinchi qarashda ko'rinmaydi.

### 1. Qamrov (Reach) — TAXMINIY, "≈" bilan

Statistika `publisher_platform` bo'linmasi bilan, **har kun uchun alohida** yuklanadi
(Instagram va Facebook sarfini ajratishning yagona yo'li shu). Meta bunday qatorlarni
**dedup QILMAYDI**: bitta odam dushanba ham, seshanba ham reklamani ko'rgan bo'lsa —
ikkala kunlik qatorda ham sanaladi; Instagram va Facebook kesimida ham alohida.

Ya'ni `SUM(Reach)` — qamrov EMAS, "ko'rsatish-odam"lar yig'indisi. Shuning uchun CRM ikkita
**halol chegara** beradi:

| | Nima | Ma'nosi |
|---|---|---|
| **Kamida** | qatorlar bo'yicha `MAX` | haqiqiy qamrov bundan **kichik bo'lishi mumkin emas** |
| **Ko'pi bilan** | `SUM` (takrorlar bilan) | bundan **ko'p bo'lishi mumkin emas** |

Aniq qamrovni faqat Meta'dan **butun davr uchun bitta so'rov** bilan (kunlik kesimsiz va
bo'linmasiz) olish mumkin — bu alohida ish va hozircha qilinmagan. Shuning uchun ekranda
raqam **«≈»** bilan turadi.

### 2. «Meta lidlari» ≠ «CRM lidlari» — bu NORMAL

Ikki ustun ATAYIN alohida turadi va farqi ekranda ochiq yoziladi. Odatiy sabablar:

| Sabab | Nima bo'ladi |
|---|---|
| **Telefon dublikati** | bir odam formani ikki marta to'ldirsa CRM bitta lid ochadi (first-touch), Meta esa ikkitasini sanaydi |
| **90 kunlik devor** | Meta lidni ~90 kun saqlaydi; undan eskisi CRM'ga umuman kelmaydi |
| **Token / obuna xatosi** | lid webhook'i kelmagan yoki mazmuni olinmagan (`REKLAMA-LIDLARI.md` → «Qayta olish») |
| **Piksel lidlari** | `offsite_conversion.fb_pixel_lead` sayt formasidan keladi va u CRM'ga umuman bog'lanmagan bo'lishi mumkin |

⚠️ Farq **doimiy va katta** bo'lsa (masalan Meta 100, CRM 30) — bu hisobot xatosi emas,
**lid oqimidagi nosozlik**: reklama lidlari sozlamasini tekshiring.

### 3. Daromad va xarajat — TAQQOSLANMAYDIGAN o'lchov

- **Xarajat** — faqat **tanlangan oraliqda**;
- **Daromad** — o'sha oraliqda kelgan lidlarning **BUTUN UMR** bo'yicha to'lovi.

Bu ataylab shunday: lid bugun keladi, pulni keyingi oyda to'laydi va sinf bo'yicha bir necha
oy to'lab yuradi. Lekin demak **ROI'ni "aniq foyda" deb o'qib bo'lmaydi** — u "shu davrda
sarflangan pul qanday uzoq muddatli natija berdi" degan ko'rsatkich. Yangi kampaniyada ROI
past ko'rinadi, chunki lidlar hali to'lay boshlamagan.

### 4. Valyuta farqi

Reklama kabineti valyutasi **UZS bo'lmasa** (odatda `USD`), ekranda ochiq ogohlantirish
chiqadi: xarajat dollarda, CRM to'lovlari esa so'mda — **ROI va CAC to'g'ridan-to'g'ri
taqqoslanmaydi**. CRM valyuta kursini o'zi qo'llamaydi (kurs tarixi loyihada yo'q va uni
o'ylab topish hisobotni yolg'on qilardi).

### 5. Vaqt zonasi farqi

**Xarajat sanasi — reklama kabineti vaqt zonasida** (Meta kunni o'sha yerda kesadi),
**lidlar esa markaz vaqtida** (Toshkent). Chegaradagi kunlarda **bir kunlik siljish** bo'lishi
mumkin: kabinet `America/Los_Angeles` da bo'lsa farq 12 soatgacha yetadi.

⚠️ Sanani "to'g'rilashga" urinilmaydi: kun chegarasi surilsa sarf boshqa kunga tushib qolardi
va **Ads Manager bilan solishtirganda raqamlar mos kelmasdi**. Zona nomi ekranda ko'rsatiladi.

### 6. Darajalar QO'SHILMAYDI

`IgAdInsight` da uch daraja (kampaniya · adset · e'lon) bitta jadvalda yotadi va kampaniya
qatori o'z e'lonlari yig'indisi bilan **bir xil**. Ular birga sanalsa sarf ikki-uch barobar
ko'rinardi. Shuning uchun hisobot **HAR DOIM bitta darajadan** yig'iladi (eng maydasi — e'lon),
qolgan darajalar esa `ParentId` orqali yuqoriga ko'tariladi.

---

## ⚠️ Nosozliklar

| Alomat | Sabab | Yechim |
|---|---|---|
| Ulashda **«Ruxsat yetishmaydi»** (`#200` / `#10`) | Tokenda `ads_read` yo'q yoki System User'ga **Ad account** biriktirilmagan | 2-qadam; kabinetni assets ro'yxatiga qo'shing |
| Ulashda **«Token yaroqsiz yoki muddati tugagan»** (`190`) | Page Access Token qo'yilgan yoki oddiy foydalanuvchi tokeni o'lgan | System User tokeni oling (2-qadam) |
| **«Reklama akkaunti ID noto'g'ri»** | id'da raqamdan boshqa belgi bor | `act_1234567890` yoki faqat raqamlar |
| Ulandi, lekin **statistika bo'sh** | Kabinet faol emas (to'lov qolgan / o'chirilgan) — `account_status ≠ 1`; yoki tanlangan oraliqda sarf bo'lmagan | Ads Manager'da kabinet holatini tekshiring; log'da ogohlantirish yoziladi |
| **«So'rovlar chegarasiga yetildi»** (`80000`) | `ads_insights` kvotasi tugagan | Kutish kerak — CRM `estimated_time_to_regain_access` ni o'qiydi va o'zi qayta urinadi. ⚠️ **Qo'lda «Hoziroq sinxronlash» ni takror bosmang**: 4xx xatolar kvotani yanada **kamaytiradi** |
| **«Bir so'rovda juda ko'p ma'lumot»** (`100/1487534`) | Oraliq katta | CRM oraliqni **o'zi ikkiga bo'lib** qayta so'raydi (24 martagacha). Qo'lda so'ralayotgan bo'lsa oraliqni qisqartiring — **kutish yordam bermaydi** |
| **«Ma'lumot juda ko'p (20 sahifadan oshdi)»** | Bitta so'rovda 10 000 dan ortiq qator | Oraliqni qisqartiring (masalan 10 kunlik bo'laklar). ⚠️ Bunday holatda ma'lumot **jim kesilmaydi** — yuklash to'xtaydi va xato yoziladi |
| Statistika bor, lekin **ROI ustunlari bo'sh** | Reklama lidlari moduli ulanmagan yoki lidlar `CampaignId` siz kelgan | `REKLAMA-LIDLARI.md`; kampaniya id'si Meta lid tugunidan keladi |
| Ads Manager'dagi son bilan **1 kunlik farq** | Vaqt zonasi (Halollik §5) | Chegaradagi kunlarni bir kun kengaytirib ko'ring |
| Ads Manager'dagi son bilan **kichik farq** | Meta atributsiyani 48 soatgacha tuzatadi | Oxirgi 7 kun har kuni qayta yuklanadi — bir-ikki kundan keyin tenglashadi |
| Instagram/Facebook kesimi **bo'sh** | Statistika platformalarga ajratilmasdan yuklangan (eski qatorlar) | Shu oraliqni qo'lda qayta yuklang; «Hammasi» filtri baribir to'g'ri ishlaydi |
| Sozlamalarda qizil xato turibdi, lekin hammasi ishlayapti | Muvaffaqiyatdan keyin kvota **ogohlantirishi** yoziladi (≥80%) | Bu xato emas — keyingi yuklash chegaraga urilishi mumkinligini bildiradi |

---

## ⚠️ `currency_offset` haqida (texnik izoh)

Meta pul birligini **ikki xil** beradi va bu eng ko'p xatoga sabab bo'ladigan joy:

| Nima | Format | Misol |
|---|---|---|
| Byudjet (`daily_budget`, `lifetime_budget`) | **butun son, minor unit** (tiyin/sent) | `5000` = 50.00 |
| Insights `spend` | **MATN, major unit** | `"312.45"` = 312.45 |

🔴 **`currency_offset` degan maydon Meta'da YO'Q.** Ad Account tugunida u umuman qaytmaydi
(u eskirgan `Currency` tugunida edi), so'ralsa Graph **butun so'rovni** `code 100` bilan rad
etadi — ya'ni statistika **umuman kelmay qo'yadi**. Shuning uchun offset **bizning tomonda**,
valyuta kodidan hisoblanadi (`MetaCurrency`): "zero-decimal" valyutalarda (JPY, KRW, VND …) 0,
qolganlarida — jumladan **UZS** da ham — **2**. Noma'lum kod → 2 (xavfsiz default).

---

## ⏱ Muddatlar va chegaralar

| Narsa | Qiymat |
|---|---|
| System User tokeni | **muddatsiz** |
| Birinchi yuklash chuqurligi | **90 kun** (sozlanadi, 1–365) |
| Bo'lak uzunligi | **10 kun** |
| Har kuni qayta yuklanadigan oraliq | **7 kun** |
| Avtomatik yuklash vaqti | soat **5:00** (sozlanadi) |
| Bir sinxronizatsiyadagi eng uzun oraliq | **365 kun** |
| Hisobotda ko'riladigan eng uzun oraliq | **400 kun** |
| Sahifalash to'sig'i | **20 sahifa** (× 500 qator) |
| Kvotada to'xtash chegarasi | **95%** |
| Meta ma'lumotining kechikishi/tuzatilishi | **48 soatgacha** |
| Meta lidni saqlash muddati | **~90 kun** |

---

## 📎 Ruxsat va tarix

- Sahifani ko'rish — **`marketing.adsstats`**; akkauntni ulash/uzish va qo'lda yangilash —
  **`marketing.settings`**.
- Akkaunt ulash/uzish va qo'lda sinxronizatsiya **«O'zgarishlar tarixi»**da ko'rinadi
  (bo'lim: Marketing). ⚠️ **Token auditga hech qachon yozilmaydi**, akkaunt id va nomi yoziladi.
- Hisobot endpointlari (`overview` · `campaigns` · `roi`) hech narsani o'zgartirmaydi —
  ular auditga yozilmaydi.

Texnik qoidalar va tuzoqlar: [`../.claude/rules/marketing-instagram.md`](../.claude/rules/marketing-instagram.md) §17.
