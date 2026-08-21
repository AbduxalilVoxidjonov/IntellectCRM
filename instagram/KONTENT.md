# Kontent rejalashtirish (Instagram Content Publishing) — sozlash

> Kimga: markaz administratori / SMM mas'uli. Modul Instagram'ga **rasm, video (Reels),
> Story va karusel** postlarini CRM'dan rejalashtirib joylaydi.
>
> **CRM tomonidagi ish: ~10 daqiqa. App Review KERAK EMAS** — faqat bitta yangi OAuth ruxsati
> (`instagram_business_content_publish`) va akkauntni **qayta ulash**.

Sahifa: **Marketing → Kontent** (`/admin/marketing/kontent`),
sozlash: **Marketing → Sozlamalar → «Kontent joylash»**.

---

## 🔴 ENG MUHIM XABAR — INSTAGRAM'DA NATIVE REJALASHTIRISH YO'Q

`POST /{ig-user-id}/media` da **`scheduled_publish_time` degan parametr MAVJUD EMAS**
(u faqat Facebook Page `/feed` da bor). Yaratilgan media konteyneri esa **24 soatdan keyin
o'ladi**.

Demak:

| | |
|---|---|
| **Vaqt qayerda turadi** | Bizning navbatda (`IgScheduledPost.ScheduledAt`), Meta'da EMAS |
| **Konteyner qachon yaratiladi** | FAQAT chop etish vaqti kelganda |
| **Nega oldindan yaratilmaydi** | "Ertaga ertalabga" oldindan yaratilgan konteyner vaqti kelganda allaqachon `EXPIRED` bo'lardi va **post jimgina yo'qolardi** |
| **Server o'chib qolsa** | Reja **bazada** turadi (`IgScheduledPost` jadvali) — kesh yoki `Task.Run` emas, ya'ni yo'qolmaydi |

⚠️ Buning amaliy oqibati: **Instagram ilovasidagi "rejalashtirish" bilan bu modul bir xil emas.**
CRM postni o'z vaqtida **o'zi yuboradi**; server o'chiq bo'lsa post kechikadi (yo'qolmaydi,
keyingi tsiklda joylanadi).

---

## 🔴 IKKINCHI MUHIM XABAR — JOYLANGAN POSTNI ORQAGA QAYTARIB BO'LMAYDI

**Chop etilgan Instagram media'sini API orqali tahrirlab ham, o'chirib ham BO'LMAYDI.**
Bu Meta'ning cheklovi, CRM'ning kamchiligi emas.

| CRM'dagi amal | Instagram'da nima bo'ladi |
|---|---|
| Rejalashtirilgan postni **tahrirlash** | Ishlaydi (post hali joylanmagan) |
| Rejalashtirilgan postni **o'chirish** | Post **bekor qilinadi** (`cancelled`), Instagram'ga umuman chiqmaydi |
| **Joylangan** postni tahrirlash | ❌ Rad etiladi — matnni faqat Instagram ilovasidan o'zgartirasiz |
| **Joylangan** postni o'chirish | Faqat **CRM yozuvi** o'chadi. ⚠️ **Instagram'dagi postning O'ZI qoladi** — uni faqat Instagram ilovasidan o'chirish mumkin. CRM buni javobda ochiq yozadi |
| **Joylanayotgan** (`processing`) postni o'chirish | ❌ Rad etiladi — konteyner Meta'da, natija noaniq. Bir necha daqiqadan keyin urinib ko'ring |

---

## ☐ 0-qadam. Shartlar

| Talab | Izoh |
|---|---|
| Instagram **Professional** akkaunt CRM'ga ulangan | `SOZLASH.md` 6-qadam |
| Token tirik | Sozlamalarda «Token: N kun qoldi» |
| **`instagram_business_content_publish`** ruxsati berilgan | 1-qadam ☟ |
| Server **HTTPS** da, tashqaridan ochiq | Meta media faylni O'ZI yuklab oladi (3-qadam) |
| `marketing.content` ruxsati bor foydalanuvchi | Sozlamalar → Xodimlar va rollar |

---

## ☐ 1-qadam. `content_publish` ruxsati — AKKAUNTNI QAYTA ULASH

Yangi scope **avtomatik qo'llanmaydi**: OAuth ruxsatlari token olingan paytda muzlatiladi.
Modul ilgari ulangan akkauntda ishlamaydi, chunki eski tokenda bu ruxsat **yo'q**.

1. CRM → **Marketing → Sozlamalar** → **«Qayta ulash»** (Instagram kartochkasi);
2. Instagram login oynasida ruxsatlar ro'yxatida **kontent joylash** ham ko'rinadi — tasdiqlang;
3. Ulanish tugagach yangi token saqlanadi.

⚠️ **CRM sizda bu ruxsat bor-yo'qligini ANIQ ayta olmaydi.** Berilgan scope'lar ro'yxati
saqlanmaydi, shuning uchun diagnostikada bu maydon **«noma'lum»** deb turadi — yolg'on "ha"
dan ko'ra ochiq "bilmayman" yaxshiroq. Ruxsat yo'qligi birinchi postda ma'lum bo'ladi:

> «Ruxsat yetishmaydi — akkauntni qayta ulab, kontent joylash ruxsatini bering
> (`instagram_business_content_publish`).»

---

## ☐ 2-qadam. Modulni yoqish

**Marketing → Sozlamalar → «Kontent joylash»** → **«Kontent joylash yoqilgan»**.

⚠️ Bayroq **default O'CHIQ**. O'chiq bo'lsa navbat umuman qayta ishlanmaydi va Instagram'ga
**hech qanday so'rov ketmaydi** — rejalashtirilgan postlar navbatda turaveradi.

---

## ☐ 3-qadam. Media qanday yuklanadi (va nega ochiq papka kerak)

🔴 **Meta media faylni O'ZI yuklab oladi.** Manzil **ochiq HTTPS** bo'lishi SHART:
autentifikatsiya, IP cheklov va redirect **ishlamaydi**.

Loyihaning `/uploads` papkasi esa `UploadsGuard` ortida (login talab qiladi) — ya'ni oddiy
yuklash manzilini bu yerga qo'yib bo'lmaydi: har post `2207052` («Media yuklab bo'lmadi»)
bilan yiqilardi. Shuning uchun **alohida ochiq papka** ochilgan:

```
/uploads/marketing-public/{32 ta hex belgi}.jpg|.jpeg|.mp4|.mov
```

**Bu yerga faqat rejalashtirilgan post uchun yuklangan rasm/video tushadi** — hujjat,
shartnoma, sertifikat, selfi, o'quvchi surati **hech qachon**. Papka qatlamlab chegaralangan
(statik marshrut aynan shu jismoniy papkaga ildizlangan, MIME xaritasi yopiq, fayl nomi
tasodifiy, yuklashda uch mustaqil tekshiruv). To'liq tavsif — **takrorlamaymiz**:
[`../.claude/rules/uploads-security.md`](../.claude/rules/uploads-security.md) →
«OCHIQ MEDIA — `uploads/marketing-public/`».

Amalda bu shuni bildiradi:

| | |
|---|---|
| Fayl **postdan oldin** yuklanadi | Post modalida «Fayl yuklash» |
| Nomi almashtiriladi | `reklama-oktabr.jpg` → `{guid}.jpg`; asl nom saqlanmaydi |
| Yuklashda **uch tekshiruv** | kengaytma · `Content-Type` · fayl boshidagi baytlar — uchalasi mos kelishi shart |
| O'lcham/davomiylik **o'lchanadi** | JPEG kengligi/balandligi sarlavhadan, MP4 davomiyligi `mvhd` dan — shu qiymatlar bilan nisbat va davomiylik **oldindan** tekshiriladi |
| Manzil **absolut** quriladi | `https://<domen>/uploads/marketing-public/...` — Meta nisbiy manzilni yuklab ololmaydi |

⚠️ **Lokal muhitda (http) post joylab bo'lmaydi.** Manzil HTTPS bo'lmagani uchun validatsiya
uni ATAYIN rad etadi: buni yashirish "lokalda ishladi, serverda ishlamadi" holatini keltirib
chiqarardi.

⚠️ Fayl o'lchamini o'qib bo'lmasa (masalan g'ayrioddiy JPEG) qiymat **0 = "noma'lum"** bo'ladi
va tegishli tekshiruv **o'tkazib yuboriladi** — qarorni Meta chiqaradi va xato kodi o'zbekcha
matnga aylantiriladi. "Bilmasak — rad etamiz" qoidasi butunlay ishlaydigan postlarni to'sib
qo'yardi.

---

## ☐ 4-qadam. Post yaratish

**Marketing → Kontent** → **«Yangi post»**:

1. **Tur** (rasm / video · Reels / Story / karusel);
2. **Media** yuklash;
3. **Matn** (caption) — sanagich bilan;
4. **Vaqt** — bo'sh qoldirilsa **HOZIR** (post keyingi tsiklda joylanadi);
5. Saqlash.

⚠️ **Tekshiruv SAQLASHDA bo'ladi**, joylash paytida emas: JPEG emasligi, nisbat, hajm, caption
uzunligi va karusel qoidalari **darhol** aytiladi. Aks holda xato faqat rejalashtirilgan vaqt
kelganda, 10 daqiqalik kutishdan **keyin** ko'rinardi — post o'z vaqtida chiqmasdi va sababi
kech ma'lum bo'lardi.

### Media talablari

| Tur | Format | Hajm | Davomiyligi | Nisbat / o'lcham |
|---|---|---|---|---|
| **Rasm** (feed) | **faqat JPEG** (`.jpg`/`.jpeg`) | ≤ 8 MB | — | 4:5 – 1.91:1, kenglik **320–1440 px** |
| **Reels / video** | MP4 yoki MOV | ≤ 300 MB | 3–900 s | **9:16** (±0.02) |
| **Story — rasm** | JPEG | ≤ 8 MB | — | **9:16** |
| **Story — video** | MP4 yoki MOV | ≤ 100 MB | 3–60 s | **9:16** |
| **Karusel** | 2–10 element | har biri o'z turi bo'yicha | | ⚠️ nisbat **faqat BIRINCHI element** bo'yicha tekshiriladi — qolganlarini Instagram shunga qirqadi |

**Matn (caption):** ≤ **2200** belgi, ≤ **30** hashtag, ≤ **20** mention.
Bo'sh matn — xato emas.

⚠️ **PNG, WebP va HEIC qabul qilinmaydi** — Instagram ularni `2207005` bilan rad etadi.
Buni oldindan aytish 10 daqiqalik kutishdan keyingi xatodan foydaliroq.

⚠️ **Karusel elementiga alohida matn yozib bo'lmaydi.** Meta uni **jimgina e'tiborsiz
qoldiradi**, ya'ni yozilgan matn hech qayerda ko'rinmasdi — shuning uchun CRM buni **xato**
deb qaytaradi va matnni umumiy maydonga ko'chirishni so'raydi.

⚠️ **Story'da caption yo'q** (Instagram uni ko'rsatmaydi), **`alt_text` faqat yakka rasmda**,
**`share_to_feed` va `audio_name` faqat Reels'da**, **hammuallif (collaborators) ko'pi bilan 3 ta**
va ular Instagram'da taklifni **qabul qilishi** kerak.

### Turlar Meta tomonida qanday yuboriladi

| CRM turi | Meta `media_type` | Izoh |
|---|---|---|
| `image` | *(yuborilmaydi)* | Standart qiymat; ortiqcha parametr `code 100` berishi mumkin |
| `video`, `reels` | `REELS` | ⚠️ Feed videosi ham **REELS** bo'lib ketadi: Meta 2022-yildan beri shunday joylaydi, `media_type=VIDEO` esa eskirgan yo'l |
| `story` | `STORIES` | |
| `carousel` | `CAROUSEL` | Avval bolalar (`is_carousel_item=true`), keyin ota-ona (`children=id1,id2,…`) |

---

## ⚙️ Post qanday joylanadi (oqim)

```
Vaqt keldi (worker har 30 soniyada ko'radi)
   ├─ token tirikmi?               → yo'q bo'lsa navbat TO'XTAYDI (post yiqilmaydi)
   ├─ validatsiya                  → o'tmasa TARMOQQA UMUMAN CHIQILMAYDI
   ├─ kunlik limit tekshiriladi    → to'lgan bo'lsa post `scheduled` bo'lib qoladi
   ├─ 1) POST /media               → konteyner yaratiladi
   ├─ 2) GET  /{container}         → status_code so'raladi (30 → 60 → 120 → 300 s)
   │        IN_PROGRESS → post `processing` da QOLADI, keyingi tsiklda davom etadi
   │        ERROR/EXPIRED → o'zbekcha sabab, qayta urinish
   │        FINISHED → ↓
   └─ 3) POST /media_publish       → post Instagram'da
         → MediaId, Permalink, PublishedAt
```

| Holat | Ma'nosi |
|---|---|
| `scheduled` | Rejalashtirilgan — vaqtini kutmoqda |
| `processing` | Konteyner yaratilgan, Instagram media'ni tayyorlamoqda |
| `published` | Joylandi |
| `failed` | 3 marta urinildi — sabab qatorda yozilgan |
| `cancelled` | Admin bekor qilgan |

⚠️ **Rasm odatda AYNI tsiklda joylanadi** — konteyner darhol `FINISHED` bo'ladi va CRM
birinchi so'rovni o'sha yerdayoq qiladi (30 soniya kutilmaydi). **Video/Reels** esa
`processing` bo'lib qoladi: fayl Instagram tomonida qayta kodlanadi.

⚠️ **«Hoziroq joylash» tugmasi natijani KUTMAYDI.** Video uchun javobda post `processing`
bo'lib qaytadi va worker uni oxiriga yetkazadi — so'rov ip'ini 10 daqiqa ushlab turish mumkin
emas.

⚠️ **10 daqiqadan keyin post `failed` bo'ladi** ("Instagram postni tayyorlab ulgurmadi").
Odatiy sabab — fayl juda katta.

---

## 📊 Kunlik chop etish limiti

Ekran tepasida indikator turadi (`GET /{ig-user-id}/content_publishing_limit`).

⚠️ **Meta hujjatlari ZID:** qo'llanmada 24 soatda **100** post, reference namunasida esa **50**.
Shuning uchun CRM **hech qanday standart qiymat ishlatmaydi** — jami kvota faqat Meta javobidan
o'qiladi. Meta uni bermasa ekranda **«2 / noma'lum»** deb yoziladi va post **to'xtatilmaydi**:

- taxminiy limit tufayli ishlaydigan postni bloklash — noto'g'ri;
- haqiqiy limitni Meta `media_publish` bosqichida o'zi tekshiradi va `2207042` qaytaradi,
  u esa tushunarli matnga aylanadi.

⚠️ Limit to'lgani aniq bo'lsa post **`failed` QILINMAYDI**: u `scheduled` bo'lib qoladi,
urinishlar hisobi ham **oshmaydi** va limit bo'shashi bilan o'zi joylanadi.

**Karusel — 1 post** deb sanaladi (ichida 10 ta rasm bo'lsa ham).

---

## 🧯 Xato kodlari

⚠️ **Instagram publishing xato kodlarining RASMIY sahifasi MAVJUD EMAS.** Quyidagilar
amaliyotdan (uchinchi tomon manbalaridan) olingan, shuning uchun xarita **"yopiq" emas**:
noma'lum kod ham **jimgina yutilmaydi** — kod raqami bilan umumiy matn qaytadi va operatorda
qidiruvga soladigan narsa qoladi.

| Kod | Ma'nosi | Odatiy sabab |
|---|---|---|
| **`2207052`** | Media yuklab bo'lmadi | **ENG KO'P UCHRAYDI.** Manzil ochiq emas, sekin javob berdi yoki HTTPS emas |
| `2207003` | Yuklab olish vaqti tugadi | Fayl katta yoki server sekin |
| `2207005` | JPEG emas | PNG/WebP/HEIC yuborilgan |
| `2207009` | Nisbat noto'g'ri | feed 4:5–1.91:1, story/reels 9:16 |
| `2207010` | Matn juda uzun | > 2200 belgi |
| `2207026` | Video kodeki qo'llab-quvvatlanmaydi | MP4 (H.264) + AAC bilan qayta saqlang |
| `2207020` | Konteyner muddati o'tdi (24 soat) | Qayta urinish kerak |
| `2207042` | Kunlik limit to'ldi | Post keyingi sutkada joylanadi |
| `2207001` | Spam deb belgilandi | Matn va hashtag'larni o'zgartiring |

⚠️ Bu kodlar HTTP xatosi sifatida emas, ko'pincha konteyner **`status` MATNI ichida** keladi:
`"Error: 2207020 - The media container has expired"`. CRM matndan `2207xxx` shaklidagi kodni
ajratib oladi va o'zbekcha sababga aylantiradi.

---

## ⚠️ Nosozliklar

| Alomat | Sabab | Yechim |
|---|---|---|
| **«Ruxsat yetishmaydi … instagram_business_content_publish»** | Akkaunt eski token bilan ulangan | Sozlamalar → **«Qayta ulash»** (1-qadam) |
| **«Kontent joylash moduli o'chirilgan»** | Bayroq o'chiq (default) | 2-qadam |
| **«Instagram tokeni muddati tugagan»** | Token o'lgan — bu modulning eng ko'p uchraydigan nosozligi | «Qayta ulash». ⚠️ Bunda postlar **`failed` bo'lmaydi**: sabab ULANISHDA, postda emas — akkaunt tiklangach navbat o'zi davom etadi |
| **`2207052`** har postda | Server tashqaridan ochiq emas yoki HTTPS yo'q | `https://<domen>/uploads/marketing-public/<fayl>` ni **boshqa qurilmadan, tarmoqdan tashqarida** brauzerda oching |
| Post `processing` da **uzoq turibdi** | Video qayta kodlanmoqda | 10 daqiqagacha normal; undan keyin `failed` bo'ladi va sabab yoziladi |
| Post **ikki marta chiqib ketdi** | Ilgari mumkin bo'lgan holat; endi jarayon ichidagi qulf va `media_publish` da qayta urinmaslik bilan yopilgan | Ikkinchisini **Instagram ilovasidan** o'chiring — API orqali bo'lmaydi |
| «Post Instagram tomonidan allaqachon chop etilgan deb belgilangan» | Konteyner `PUBLISHED` qaytardi (avvalgi urinishda javob yo'lda yo'qolgan) | Profilni tekshiring — post joyida. CRM ataylab **ikkinchi marta chop etmaydi** |
| «Post Instagram'da joylangan bo'lishi ham mumkin — Instagram'da tekshiring» | `media_publish` javobi noaniq (5xx/timeout) | ⚠️ **Avtomatik qayta urinilmaydi.** Instagram'ni tekshiring: post bo'lmasa «Qayta urinish» bosing |
| Media tanlashda **«Fayl mazmuni kengaytmaga mos kelmadi»** | Fayl nomi `.jpg`, mazmuni boshqa (masalan qayta nomlangan PNG) | Faylni haqiqiy JPEG qilib qayta saqlang |
| Lokalda post joylanmayapti | Manzil `http://` | Ataylab — Meta faqat ochiq HTTPS'dan yuklab oladi |
| Joylangan postni CRM'dan o'chirdim, Instagram'da turibdi | Meta cheklovi | Instagram ilovasidan o'chiring (yuqoridagi jadval) |

---

## ⏱ Muddatlar va chegaralar

| Narsa | Qiymat |
|---|---|
| Media konteynerining umri | **24 soat** |
| Konteyner holatini so'rash jadvali | **30 → 60 → 120 → 300 s** (Meta tavsiyasi: daqiqada bir marta, 5 daqiqadan ko'p emas) |
| Tayyorlanishni kutish muddati | **10 daqiqa**, keyin `failed` |
| Navbat tsikli | har **30 soniya**, bir tsiklda **3 ta** post |
| Urinishlar soni | **3**, keyin `failed` + Telegram signali |
| Kunlik chop etish limiti | Meta beradi (hujjatlar zid: 100 yoki 50) |
| Ro'yxat sahifasi | 50 post |

---

## 📎 Ruxsat va tarix

- Sahifani ko'rish — **`marketing.content`**; post yaratish/tahrirlash/o'chirish, media yuklash
  va «Hoziroq joylash» — **`marketing.content`**; modul bayrog'i — `marketing.settings`.
- Post yaratish, tahrirlash, bekor qilish, o'chirish, qo'lda joylash va media yuklash/o'chirish
  **«O'zgarishlar tarixi»**da ko'rinadi (bo'lim: Marketing).
- ⚠️ **Auditga fayl manzili YOZILMAYDI** — manzil ochiq, ya'ni tarixni ko'rgan har kim faylni
  abadiy olib qolardi (`uploads-security.md` §1).
- «Qo'lda joylash» **har doim** yoziladi — muvaffaqiyatda ham, xatoda ham: "kim qo'lda joylashga
  urindi" savoli aynan nosozlikdan keyin beriladi.

Texnik qoidalar va tuzoqlar: [`../.claude/rules/marketing-instagram.md`](../.claude/rules/marketing-instagram.md) §18.

---

## 🤖 AI bilan matn yozdirish (caption)

Post modalida matn maydonining tepasida **«Matn yozdirish»** tugmasi bor. Siz **MAVZU** yozasiz
("ingliz tili yozgi kurs, chegirma"), AI esa markazning **bilim bazasi** asosida post matnini va
hashtaglarni tayyorlab beradi.

### Qanday ishlaydi

| Qadam | Nima bo'ladi |
|---|---|
| 1 | Mavzu, **post turi**, **til** va **uslub** tanlanadi |
| 2 | Prompt markazning **bilim bazasidan** (Marketing → Bilim bazasi) quriladi |
| 3 | Natija Instagram chegaralariga **solishtiriladi** (2200 belgi · 30 hashtag · 20 mention) |
| 4 | Matn maydoniga qo'yiladi |

**Uslublar:** Samimiy (default) · Ishonchli (ekspert) · Jonli · Sotuvga yo'naltirilgan.
**Tillar:** O'zbekcha (lotin, default) · Ўзбекча (кирилл) · Ruscha · Inglizcha.

⚠️ **Post turi matn shakliga ta'sir qiladi:** Reels uchun birinchi gap «ilmoq» (hook) bo'ladi,
Story uchun 1–2 gap (Story matni ekranda ko'rinmaydi — u faqat ichki eslatma), karusel uchun
matn barcha slaydlarni umumlashtiradi.

### 🔴 AI narxni O'YLAB TOPMAYDI

Promptda qat'iy qoida bor: **bilim bazasida yo'q raqamni matnga yozish TAQIQ**. Bilim bazasi
bo'sh bo'lsa AI narx, jadval va chegirma haqida hech narsa yozmaydi — «batafsil ma'lumot uchun
yozing» deydi.

⚠️ Ya'ni **matn sifati bilim bazasiga bog'liq**: u to'ldirilmagan bo'lsa natija umumiy va
quruq chiqadi. Bilim bazasini to'ldirish — [`SOZLASH.md`](SOZLASH.md) 7-qadam.

⚠️ AI **`@mention` yozmaydi** (begona akkauntni teglash markaz nomidan spam bo'lardi) va
**va'da bermaydi** («100% natija» kabi iboralar taqiqlangan).

### ⚠️ Matningiz ustiga JIMGINA yozilmaydi

- Matn maydoni **bo'sh** bo'lsa natija darhol qo'yiladi;
- Matn **bor** bo'lsa avval AI yozgani ko'rsatiladi va siz o'zingiz tanlaysiz:
  **«Almashtirish»** · **«Oxiriga qo'shish»** · **«Boshqattan yozdirish»**.

🔴 **«Almashtirish» maydondagi matnni BUTUNLAY o'chiradi** — bu ekranda ham ochiq yozilgan.

⚠️ Natijadagi **hashtag chiplari faqat KO'RSATISH uchun** — ular matn oxiriga **allaqachon
qo'shilgan**. Ularni qo'lda qayta yozish takror bo'ladi.

### Chegaraga sig'masa nima bo'ladi

AI'dan **zaxira bilan** so'raladi (matn ~1400 belgi, 12 ta hashtag), chunki model uzunlikni
aniq hisoblay olmaydi. Baribir oshib ketsa:

1. **avval hashtaglar** oxiridan qirqiladi (ular yordamchi);
2. keyin matnning o'zi **so'z chegarasida** kesiladi va oxiriga **`…`** qo'yiladi.

⚠️ `…` ataylab: qirqilgani **ko'rinib tursin** — jimgina kesilgan matn sizni aldardi.

Bu ish serverda bajariladi, ya'ni maydonga tushgan matn **saqlashda albatta o'tadi**. Aks holda
siz AI matnini qo'yib, «Saqlash» bosganda «Matn juda uzun» xatosini olardingiz — ya'ni yordamchi
tugma muammo yasab bergan bo'lardi.

### ⚠️ Nosozliklar

| Alomat | Sabab | Yechim |
|---|---|---|
| Tugma **o'chiq** | Gemini API kaliti sozlanmagan | `.env` da `GEMINI_API_KEY` (server bu holatni oldindan aytadi — bekorga so'rov ketmaydi) |
| «Mavzu yozilmagan» | Mavzu maydoni bo'sh | Mavzu — yagona majburiy maydon |
| «AI javobini o'qib bo'lmadi (format xato)» | Model kutilgan JSON o'rniga erkin matn qaytardi | «Boshqattan yozdirish» — bu vaqtinchalik holat |
| Matn **umumiy va quruq** chiqyapti | Bilim bazasi bo'sh yoki kam | Marketing → Bilim bazasi |
| «AI matnida hashtag/mention ko'p» | Model qoidani buzdi | Qaytadan urinib ko'ring; matn maydoniga **buzuq natija qo'yilmaydi** |

⚠️ **Auditga yozilmaydi:** matn yaratish hech qanday ma'lumotni o'zgartirmaydi. Matn haqiqatan
ishlatilsa, u **post saqlanganda** tarixga tushadi.

---

## 📏 Fayl yuklash va o'lchamlar

**«Fayl yuklash»** bosilganda fayl serverga ketadi va o'lchamlari **ikki manbadan** to'ldiriladi.

| Nima | Server o'qiydimi | Izoh |
|---|---|---|
| Fayl hajmi | ✅ | |
| **Rasm** kengligi/balandligi | ✅ | JPEG sarlavhasidan |
| **Video davomiyligi** | ✅ | MP4/MOV `mvhd` bo'lagidan (u faylning oxirida ham bo'lishi mumkin — bosh va oxir ko'riladi) |
| **Video kengligi/balandligi** | ❌ | 🔴 Server buni o'qimaydi va **`0` = «noma'lum»** qaytaradi |

⚠️ Shuning uchun **brauzer** video o'lchamini o'zi o'lchaydi va faqat **bo'sh** maydonlarni
to'ldiradi. Buni qilmaslik Reels uchun **9:16 tekshiruvini butunlay o'chirib qo'yardi**: post
saqlanardi, keyin esa joylash paytida `2207009` («nisbat noto'g'ri») bilan yiqilardi.

**Qoida:** server qiymati **ustun** (u faylning o'zidan o'qilgan), brauzer esa faqat to'ldiradi.
Brauzer o'lchay olmasa yuklash **bekor qilinmaydi** — fayl serverda va manzil ishlaydi, o'lcham
esa "noma'lum" bo'lib qoladi va tegishli tekshiruv **o'tkazib yuboriladi** (qarorni Instagram
chiqaradi).

⚠️ **Manzilni qo'lda ham kiritish mumkin** (tashqi CDN) — lekin u **ochiq HTTPS** bo'lishi shart
va o'lchamlar "noma'lum" bo'lib qoladi.
