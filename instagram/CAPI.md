# CAPI — lid sifatini Meta'ga qaytarish (Conversions API)

> Kimga: markaz administratori / marketing mas'uli.
>
> **Muammo:** Meta hozir faqat **"lid keldi"** ni biladi. **"Bu lid o'quvchi bo'ldi va pul
> to'ladi"** ni bilmaydi — shuning uchun reklama *arzon lid* beradigan auditoriyaga
> optimallashadi, *haqiqiy mijoz* beradiganiga emas.
>
> **Yechim:** CRM natijani Meta'ga qaytaradi. Meta o'sha ma'lumot bilan qayta o'rganadi.
> Amaliyotda bu lid narxini sezilarli tushiradi, lekin **kafolat emas** va **darhol emas**:
> o'rganish bosqichi 2–4 hafta.

Sozlash: **Marketing → Sozlamalar → «Lid sifatini Meta'ga qaytarish (CAPI)»**. Navbat va diagnostika o'sha kartochkada.

---

## 🔴 ENG MUHIM UCH XABAR

1. **`event_name` — ERKIN MATN**, Meta hech qanday qat'iy satrni talab qilmaydi. Yagona shart:
   u **Events Manager'da sozlangan bosqich nomi bilan AYNAN bir xil** bo'lishi. Shuning uchun
   nomlar kodda emas, **CRM sozlamasida** turadi.
2. **`lead_id` HASHLANMAYDI** — telefon va email hashlanadi, Meta'ning lid id'si esa **xom
   raqam** sifatida yuboriladi. Hashlab yuborilsa hodisa hech kimga bog'lanmaydi.
3. **`event_time` 7 kundan eski bo'lsa Meta BUTUN so'rovni rad etadi** — bitta eski qator
   tufayli qolgan 999 tasi ham yo'qolardi. CRM bunday qatorni **paketdan chiqarib tashlaydi**.

---

## ☐ 0-qadam. Shartlar va Meta talablari

CAPI **faqat reklama formasidan (Instant Form) kelgan lidlar** uchun ishlaydi: Meta hodisani
`lead_id` orqali e'longa bog'laydi, u esa faqat reklama lidida bo'ladi.

⚠️ **DM yoki izohdan kelgan lid bu navbatga UMUMAN tushmaydi** — uni Meta hech qanday
reklamaga bog'lay olmaydi.

Meta'ning **"Conversion Leads"** optimizatsiyasi uchun rasmiy talablari:

| Talab | Qiymat | Markazda bormi |
|---|---|---|
| Lead Ads (Instant Form) ishlatilishi | — | `REKLAMA-LIDLARI.md` bo'yicha ulangan bo'lishi kerak |
| Meta lid ID (15–17 raqam) CRM'da saqlangan | `IgAdLead.LeadgenId` | ✅ **allaqachon saqlanadi** |
| Oyiga kamida **200 lid** | — | ⚠️ tekshiring |
| Kuniga kamida bir marta yuklash | — | ✅ worker kuniga bir marta yuboradi |
| Maqsadli bosqich lid kelganidan **28 kun ichida** | "to'lov qildi" odatda 1–2 hafta | ✅ |
| Konversiya darajasi **1%–40%** oralig'ida | — | ⚠️ tekshiring |

⚠️ **200 lid yo'q bo'lsa ham modulni yoqing.** Meta "Conversion Leads" optimizatsiyasini
yoqmaydi, lekin hodisalar **atributsiya hisobotlarida** baribir ko'rinadi va kelajakda talab
bajarilganda tarix tayyor bo'ladi.

---

## ☐ 1-qadam. Events Manager'da bosqichlarni yaratish

1. `business.facebook.com/events_manager` ni oching;
2. Reklama kabinetiga bog'langan **Dataset** ni tanlang (yoki yarating);
3. **Settings → Lead stages** (yoki "Conversion Leads" sozlamasi) bo'limida ikkita bosqich
   qo'shing, masalan:
   - `Sifatli lid`
   - `To'lov qildi`
4. Bosqich nomlarini **aynan** ko'chirib oling.

🔴 **NOM HARFMA-HARF MOS BO'LISHI SHART.** `Sifatli lid` va `sifatli lid` — Meta uchun **ikki
xil bosqich**. Nom mos kelmasa so'rov **200 OK** qaytadi, hodisa qabul qilinadi, lekin hech
qanday bosqichga tushmaydi — ya'ni nosozlik **jimgina** yuz beradi va hech qayerda xato
ko'rinmaydi.

⚠️ Ingliz tilidagi nomlar ham bo'ladi (`Marketing Qualified Lead`, `Converted`) — muhimi
ikkala tomonda bir xil bo'lsin.

---

## ☐ 2-qadam. Dataset ID va token

1. Events Manager → Dataset → **Settings** → **Dataset ID** ni ko'chirib oling;
2. O'sha sahifada **Generate access token** (yoki System User tokeni, unda **`ads_management`**
   ruxsati va shu Dataset ustidan huquq bo'lsin).

⚠️ **Bu token ham boshqa.** Marketing bo'limida endi **to'rtta** har xil token bo'lishi mumkin:

| Modul | Token |
|---|---|
| Izoh · DM agenti | Instagram Login tokeni |
| Reklama lidlari | Page Access Token (`leads_retrieval`) |
| Reklama statistikasi | System User tokeni (`ads_read`) |
| **CAPI** | **Dataset (Events Manager) tokeni** (`ads_management`) |

Tokenlarni almashtirib yuborish `OAuthException 190` bo'lib chiqadi va sababini topish qiyin.

---

## ☐ 3-qadam. CRM'da sozlash

**Marketing → Sozlamalar → «Lid sifatini Meta'ga qaytarish (CAPI)»**:

| Maydon | Qiymat |
|---|---|
| **CAPI yoqilgan** | yoqing (default o'chiq) |
| **Dataset ID** | 2-qadamdagi id |
| **Token** | 2-qadamdagi token |
| **«Sifatli lid» bosqichi nomi** | Events Manager'dagi nom bilan **AYNAN** bir xil |
| **«To'lov qildi» bosqichi nomi** | xuddi shunday |

**«CAPI sozlamalarini saqlash»** → so'ng **«Hoziroq yuborish»** bosing (kutmasdan natijani ko'rish uchun; worker buni
kuniga bir marta o'zi bajaradi).

⚠️ **Dataset ID ham, token ham javobda hech qachon QAYTMAYDI** — faqat "sozlangan /
sozlanmagan" holati. Shuning uchun forma har safar **bo'sh** ochiladi va **bo'sh yuborilgan
maydon mavjud qiymatni O'CHIRMAYDI**. (Ilgari Dataset ID shartsiz yozilardi va faqat toggle'ni
o'zgartirgan admin uni **bilmasdan o'chirib qo'yardi** — CAPI jimgina ishlamay qolardi.)

⚠️ Bosqich nomlari bo'sh yuborilsa oldingi qiymat qoladi; hech qachon sozlanmagan bo'lsa
standart nomlar ishlatiladi (`Sifatli lid` / `To'lov qildi`) — bo'sh `event_name` bilan ketgan
so'rovni Meta rad etardi.

---

## 🗺 Hodisa xaritasi — CRM'da nima bo'lganda nima yuboriladi

| CRM'da nima bo'ldi | CAPI hodisasi | Hodisa VAQTI |
|---|---|---|
| Reklama lidi yaratildi | ❌ **yuborilmaydi** | — |
| Lid **o'quvchiga aylantirildi** (`ConvertedStudentId` to'ldi) | «Sifatli lid» | skan vaqti |
| Lid kanbanda **«sifatli» ma'noli bosqich**ga o'tdi | «Sifatli lid» | skan vaqti |
| Lid bo'yicha **birinchi `tuition` to'lovi** bo'ldi | «To'lov qildi» + summa (`value`, `UZS`) | **birinchi to'lov SANASI** |

⚠️ **Lid yaratilgani uchun hodisa YUBORILMAYDI** — Meta lidni o'zi qabul qilgan va buni
allaqachon biladi; qaytarilsa konversiya ikkilanardi.

⚠️ **"Sifatli lid" ikki manbadan keladi, lekin hodisa BITTA** — Events Manager'da ham bosqich
bitta. Kanban bosqichi **nom bo'yicha** taniladi (`sifatli`, `sinov`, `trial`, `qualified`,
`aylantir`, `convert`): bosqichlar admin tomonidan erkin yaratiladi va ularda "tur" ustuni
yo'q. Markaz bosqichni butunlay boshqacha nomlagan bo'lsa ham hodisa baribir **o'quvchiga
aylantirilganda** yuboriladi — ya'ni nomlar ro'yxati "qo'shimcha signal", yagona shart emas.

⚠️ **"To'lov qildi" hodisasining vaqti — BIRINCHI TO'LOV SANASI**, skan vaqti emas: Meta
hodisani atributsiya oynasiga aynan shu vaqt bo'yicha joylashtiradi. Demak modul **birinchi
marta yoqilganda 7 kundan eski to'lovlar YUBORILMAYDI** — ular `skipped` bo'ladi. Bu ataylab:
eski to'lovni "bugun bo'ldi" deb yuborish **yolg'on ma'lumot** bo'lardi.

### Nega "hook" emas, KUNLIK SKAN

Lid holati bir necha joydan o'zgaradi (kanban, konvertatsiya, kassa). Har biriga hodisa
tinglovchisi qo'yilsa **bittasi tushib qolgani zahoti** hodisa jimgina yo'qolardi. Kunlik skan
esa "hozirgi holat"ni **qayta hisoblaydi**: o'tkazib yuborilgan o'zgarish keyingi kuni
o'z-o'zidan tuziladi. Kechikish (eng ko'pi 24 soat) Meta uchun ahamiyatsiz.

Skan oynasi — **90 kun**: bundan eski reklama lidi umuman ko'rilmaydi (Meta talabi 28 kun,
ya'ni bu uch barobar zaxira; butun arxivni har kuni qayta o'qish esa keraksiz).

---

## 🔐 Hashlash qoidalari

**SHA-256 → hex → KICHIK harf.** Meta hashni o'z bazasidagi qiymat bilan **bayt-ma-bayt**
solishtiradi: normallashtirish bir belgi bilan farq qilsa moslik (match rate) **0** bo'ladi va
nosozlik **jimgina** yuz beradi — so'rov 200 OK qaytadi, lekin hodisa hech kimga bog'lanmaydi.

| Maydon | Normallashtirish | Misol |
|---|---|---|
| `ph` (telefon) | faqat raqamlar, boshidagi nollar olib tashlanadi, **mamlakat kodi BILAN** | `+998 90 123-45-67` → `sha256("998901234567")` |
| `em` (email) | trim + kichik harf | `Ali@Mail.uz ` → `sha256("ali@mail.uz")` |
| `fn` / `ln` | kichik harf, tinish belgilarisiz | ⚠️ **yuborilmaydi**, sabab quyida |
| **`lead_id`** | 🔴 **HASHLANMAYDI** | xom **raqam**: `1234567890123456` |

🔴 **Boshqa hashlanmaydigan maydonlar** (kelajakda qo'shilsa): `client_ip_address`,
`client_user_agent`, `fbc`, `fbp`, `page_id`, `page_scoped_user_id`, `ig_sid`.

⚠️ **Mamlakat kodi SHART.** Meta raqamni xalqaro formatda saqlaydi: kodsiz yuborilgan
`901234567` **butunlay boshqa hash** beradi va hech qachon mos kelmaydi. Shuning uchun
9 xonali (mahalliy) raqamga `998` **o'zimiz** qo'shamiz.

⚠️ **Apostroflar olib tashlanadi.** `To'lqin`, `Toʻlqin`, `To’lqin` — uchalasi ham `tolqin`
bo'lishi kerak. Matn turli klaviaturalardan kiritiladi va aks holda bitta odam **uchta xil
hash** berardi.

⚠️ **Ism va familiya (`fn`/`ln`) ATAYIN YUBORILMAYDI.** O'zbekistonda formaga "Familiya Ism"
ham, "Ism Familiya" ham yoziladi va tartibni aniqlashning ishonchli yo'li yo'q. Noto'g'ri
joylashgan `fn`/`ln` moslikni **oshirmaydi** (ikkalasi ham 0 chiqadi), lekin Meta hisobotida
"sifatsiz integratsiya" bo'lib ko'rinardi. `lead_id` baribir eng kuchli identifikator.

⚠️ **Yaroqsiz qiymat umuman yuborilmaydi.** Forma maydoniga `yo'q`, `-` kabi matn yozilgan
bo'lsa u hashlanmaydi va maydon payloadga **qo'shilmaydi**: yaroqsiz qiymatning hashi hech
qachon mos kelmaydi, lekin Meta'ning "match rate" ko'rsatkichini pasaytirardi.

---

## 🔒 Maxfiylik

🔴 **Navbat jadvalida XOM telefon va email SAQLANMAYDI.** `IgCapiEvent.PayloadJson` ga faqat
**hashlangan** ko'rinish tushadi; xom PII faqat `Lead` jadvalida qoladi. Data Protection
Assessment (DPA) aynan shuni tekshiradi, bundan tashqari bu ustunni ko'rgan **har qanday
xodim** mijoz raqamini olib qolardi.

⚠️ Navbat ro'yxati (ekrandagi jadval) `PayloadJson` ni **umuman qaytarmaydi** — uzun va
diagnostik foydasi yo'q; kerakli hammasi `event_name` / holat / xato ustunlarida.

⚠️ `test_event_code` **produksiyada ishlatilmaydi**: u bilan kelgan hodisalar faqat Events
Manager'ning "Test Events" oynasida ko'rinadi va reklama optimizatsiyasiga **umuman
qo'shilmaydi** — ya'ni modul "ishlayotgandek" ko'rinib, aslida hech narsa qilmasdi.

---

## 📋 Navbat — holatlar va sonlar

| Holat | Ma'nosi |
|---|---|
| `pending` | Navbatda — keyingi yuborishda ketadi |
| `sent` | Meta qabul qildi |
| `failed` | **3 marta** urinildi va bo'lmadi (yoki payload buzuq) |
| `skipped` | **Urinilmadi va urinilmaydi** — odatda `event_time` 7 kundan eski |

⚠️ **`skipped` va `failed` ATAYIN ajratilgan.** "Xato" deb ko'rsatilsa admin muammo izlab
vaqt sarflardi, holbuki bu **normal** holat (eski to'lov modul yoqilishidan oldin bo'lgan).

⚠️ **Xato bo'lgan paket YO'QOLMAYDI:** qatorlar `pending` bo'lib qoladi va keyingi ishga
tushishda qayta yuboriladi. Qayta yuborish **xavfsiz**, chunki `event_id` deterministik —
Meta takrorni 48 soatlik oynada o'zi tashlaydi.

Ekrandagi sonlar (Navbatda · Yuborilgan · Xato · O'tkazib yuborilgan) **butun jadval** bo'yicha
hisoblanadi va filtrga bog'liq emas — "navbat qanday holatda" degan savol filtr o'zgarganda
sakramasligi kerak.

---

## ⚠️ Nosozliklar

| Alomat | Sabab | Yechim |
|---|---|---|
| **«CAPI moduli o'chirilgan»** | Bayroq o'chiq (default) | 3-qadam |
| **«Dataset ID kiritilmagan»** / **«tokeni kiritilmagan»** | Maydon bo'sh | 3-qadam. Sabablar ATAYIN ayri yoziladi — qaysi maydon yetishmayotgani darhol ko'rinsin |
| **«Token muddati tugagan yoki bekor qilingan»** (`190`) | Boshqa modulning tokeni qo'yilgan yoki token bekor qilingan | 2-qadam; Events Manager tokenini oling |
| **«Ruxsat yetishmaydi»** (`10`/`200`/`299`) | Tokenda `ads_management` yo'q yoki Dataset ustidan huquq yo'q | System User'ga Dataset'ni asset sifatida biriktiring |
| **«Dataset obyekti topilmadi»** (`803`) | Dataset ID xato | Events Manager → Settings dan qayta ko'chiring |
| **«Noto'g'ri so'rov»** (`100`) | Odatda payload xatosi: noto'g'ri Dataset ID, eski `event_time`, yoki hashlanmasligi kerak bo'lgan maydon hashlangan | Xato matnidagi sababni o'qing |
| Navbatda **hammasi `skipped`** | To'lovlar 7 kundan eski (modul yangi yoqilgan) | Normal. Yangi to'lovlar odatdagidek ketadi |
| Hodisalar **`sent`**, lekin Events Manager'da **ko'rinmaydi** | 🔴 Bosqich nomi Events Manager'dagi bilan mos kelmagan | 1-qadam — harfma-harf solishtiring. Meta bunday holatda **xato bermaydi** |
| Events Manager'da ko'rinadi, lekin **"Conversion Leads" yoqilmayapti** | Oyiga 200 lid yoki 1–40% konversiya talabi bajarilmagan | Talablar bajarilguncha kutiladi; hodisalarni yuborishda davom eting |
| Meta qo'llab-quvvatlash **`fbtrace_id`** so'rayapti | — | U **har yuborishda** (muvaffaqiyatda ham) log'ga yoziladi; navbat qatoridagi `event_id` ham javobda qaytadi |
| Bir konversiya **ikki marta** sanaldi | Bunday bo'lmasligi kerak | Dedup ikki qavat: CRM'da `(lid, hodisa nomi)` juftligi va `event_id` unikal indeksi; Meta tomonida `event_name` + `event_id` bo'yicha **48 soat** |

---

## ⏱ Muddatlar va chegaralar

| Narsa | Qiymat |
|---|---|
| `event_time` eng eski chegarasi | **7 kun** (CRM 1 soatlik zaxira bilan ishlaydi) |
| Kelajakka ruxsat etilgan farq | 5 daqiqa (server soati siljishi) |
| Bir so'rovdagi hodisalar | **1000** |
| Bir ishga tushishda | 5 paket = **5000** qator |
| Urinishlar | **3**, keyin `failed` |
| Skan oynasi | **90 kun** |
| Meta tomonidagi dedup oynasi | **48 soat** (`event_name` + `event_id`) |
| Yuborish jadvali | kuniga **bir marta** (+ qo'lda «Hoziroq yuborish») |

---

## 📎 Ruxsat va tarix

- Ko'rish (holat, navbat) — bo'lim ruxsati **`marketing`**;
  sozlamalarni saqlash va «Hoziroq yuborish» — **`marketing.settings`**.
- Sozlama o'zgarishi va qo'lda yuborish **«O'zgarishlar tarixi»**da ko'rinadi (bo'lim: Marketing).
- ⚠️ **Token auditga yozilmaydi.** Dataset ID esa yoziladi — u sir emas, oddiy identifikator
  (Page ID bilan bir xil maqom) va "qaysi datasetga ulandik" savoli tarixdan javobsiz
  qolmasligi kerak.

Texnik qoidalar va tuzoqlar: [`../.claude/rules/marketing-instagram.md`](../.claude/rules/marketing-instagram.md) §19.
