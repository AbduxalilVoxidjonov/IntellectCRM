# Reklama lidlari (Meta Lead Ads) — sozlash

> Kimga: markaz administratori / texnik mas'ul. Target reklamadagi **forma** (Instant Form)
> to'ldirilganda F.I.Sh. va telefon CRM'ga **avtomatik** lid bo'lib tushadi.
>
> **CRM tomonidagi ish: ~10 daqiqa. Meta tomonidagi tasdiq: 3–10 kun** (pastda sabab).

---

## 🔴 ENG MUHIM XABAR — bu izoh/DM'dan BOSHQA yo'l

[`SOZLASH.md`](SOZLASH.md) da "App Review KERAK EMAS" deb yozilgan va u **to'g'ri** — lekin
faqat **izoh va DM** uchun. Reklama lidi butunlay boshqa Meta mahsuloti orqali keladi:

| | Izoh · DM | **Reklama lidi** |
|---|---|---|
| Meta mahsuloti | Instagram API with Instagram Login | **Facebook Page** webhook'i |
| Facebook Page | kerak emas | **SHART** (Instagram akkaunt unga bog'langan bo'lishi kerak) |
| Business Verification | kerak emas | **SHART** |
| App Review | kerak emas | **SHART** — `leads_retrieval` ruxsati uchun |
| Token | OAuth bilan o'zi olinadi | **Page Access Token** qo'lda kiritiladi |

⚠️ Ya'ni kod tayyor bo'lsa ham, **Meta tasdig'i kelmaguncha lid kelmaydi**. Tasdiq odatda
3–10 kun, hujjat to'g'ri bo'lsa.

---

## ☐ 0-qadam. Shartlar

| Talab | Izoh |
|---|---|
| Instagram **Professional** akkaunt | izoh/DM moduli bilan bir xil talab |
| **Facebook Page** va unga bog'langan Instagram akkaunt | Meta Business Suite → Settings → Linked accounts |
| **Meta Business Manager** va **Business Verification** o'tgan | business.facebook.com → Security Center |
| Reklama kabineti va unda **Instant Form** bilan e'lon | Ads Manager |

---

## ☐ 1-qadam. Meta ilovasida `leadgen` webhook'ini yoqish

1. `developers.facebook.com` → ilovangiz (izoh/DM uchun ishlatgani **bo'lishi mumkin**);
2. **Products → Webhooks** → obyekt sifatida **Page** ni tanlang;
3. **Callback URL** — CRM'dagi **Marketing → Sozlamalar → «Reklama lidlari»** kartasidan
   nusxa oling. Manzil `…/api/public/instagram/**leadgen**` bilan tugaydi;
4. **Verify token** — `.env` dagi `META_VERIFY_TOKEN` (bo'sh qoldirilgan bo'lsa
   `INSTAGRAM_VERIFY_TOKEN`);
5. **Verify and Save** → maydonlardan **`leadgen`** ni belgilang (Subscribe).

⚠️ **Callback URL'ni chalkashtirmang:** izoh/DM manzili `…/webhook`, reklama lidiniki
`…/leadgen`. Meta'da har ikkala obyekt (`instagram` va `page`) o'z manziliga ega.

⚠️ **Ayri ilova ishlatsangiz** (reklama uchun boshqa Meta App) — `.env` ga `META_APP_SECRET`
va `META_VERIFY_TOKEN` ni ham qo'shing. Bitta ilova bo'lsa ularni **bo'sh qoldiring**:
`INSTAGRAM_*` qiymatlari ishlatiladi.

---

## ☐ 2-qadam. `leads_retrieval` ruxsatini so'rash (App Review)

1. Ilova → **App Review → Permissions and Features**;
2. Quyidagilarga **Advanced Access** so'rang:
   - **`leads_retrieval`** (asosiysi),
   - `pages_show_list`,
   - `pages_manage_ads`,
   - `pages_read_engagement`;
3. Formada ekran-yozuv (screencast) va tushuntirish so'raladi: *"CRM tizimimiz o'z
   markazimizning reklama lidlarini avtomatik qabul qiladi"*;
4. Business Verification o'tmagan bo'lsa avval u so'raladi.

⚠️ **Tasdiqni kutmasdan sinash:** ilova **Development** rejimida bo'lsa, sahifa admini
**app admin/developer/tester** bo'lsa, webhook o'sha sahifa uchun ishlaydi. Bu — sinov uchun
to'g'ri yo'l, lekin **prod yechim EMAS**: reklama boshqa xodim nomidan yuritilsa yoki
rejim o'zgarsa lidlar jimgina kelmay qo'yadi.

---

## ☐ 3-qadam. Page Access Token olish

**Tavsiya — System User tokeni: u MUDDATSIZ**, ya'ni bir marta olinadi.

1. `business.facebook.com` → **Business settings → Users → System users** → **Add**;
2. Rolni **Admin** qiling → **Add assets** → kerakli **Page** ni tanlang va to'liq huquq bering;
3. **Generate new token** → ilovangizni tanlang → ruxsatlar: **`leads_retrieval`**,
   `pages_show_list`, `pages_manage_ads`, `pages_read_engagement`;
4. Tokenni nusxa oling — **u faqat bir marta ko'rsatiladi**.

**Page ID** — sahifaning "About" bo'limida yoki Business settings → Pages ro'yxatida.

---

## ☐ 4-qadam. CRM'da ulash

**Marketing → Sozlamalar → «Reklama lidlari (Lead Ads)»**:

1. **«Reklama lidlari yoqilgan»** — yoqing;
2. **Facebook Page ID** va **Page Access Token** ni kiriting;
3. **«Sahifani ulash va tekshirish»** bosing.

Tugma bosilganda CRM ikki ish qiladi: tokenni tekshiradi (sahifa nomi qaytadimi) va sahifani
`leadgen` maydoniga **obuna** qiladi. Natija holat kartochkalarida ko'rinadi:

| Kartochka | Nima bo'lishi kerak |
|---|---|
| Modul | Yoqilgan |
| Facebook sahifa | sahifa nomi |
| Page Access Token | Sozlangan |
| **Leadgen obunasi** | **Faol** |

⚠️ **Obuna «Yo'q» bo'lsa lid UMUMAN kelmaydi**, Meta konsolida manzil to'g'ri turgan bo'lsa
ham. Odatiy sabab — token'da `pages_manage_ads` ruxsati yo'q.

4. **Saqlash** tugmasini bosing (bayroq va lid manbasi shu bilan saqlanadi).

---

## ☐ 5-qadam. Sinash

Meta'ning rasmiy vositasi: **Lead Ads Testing Tool**
(`developers.facebook.com/tools/lead-ads-testing`).

1. Sahifa va formani tanlang → **Create lead**;
2. 5–10 soniyadan keyin **Marketing → Reklama lidlari** sahifasida qator paydo bo'ladi;
3. Lid **Lidlar** bo'limida ham (`/admin/leads`) yangi kartochka bo'lib turadi.

---

## ⚠️ Nosozliklar

| Alomat | Sabab | Yechim |
|---|---|---|
| Meta «Verify and Save» ni qabul qilmayapti | verify token mos emas yoki `…/webhook` manzili qo'yilgan | 1-qadam; manzil `…/leadgen` bo'lsin |
| Ro'yxat bo'sh, hech narsa kelmayapti | `leadgen` obunasi yo'q | Sozlamalardagi «Leadgen obunasi» kartochkasi |
| Lid keldi, lekin **ism va telefon yo'q** | Page tokeni yo'q / muddati tugagan / `leads_retrieval` yo'q | Token yangilang, so'ng qatordagi **«Qayta olish»** |
| «Ruxsat yetishmaydi» xatosi | App Review o'tmagan yoki token'da ruxsat yo'q | 2-qadam |
| «Token muddati tugagan» | Oddiy foydalanuvchi tokeni ishlatilgan (~60 kun) | System user tokeniga o'ting (3-qadam) |
| Lid CRM'da bor, lekin **yangi emas** | O'sha telefon bilan lid allaqachon bor edi | Ataylab: dublikat ochilmaydi, `RepeatCount` oshadi |
| Modul yoqilgan, lid keldi, CRM'da yo'q | Lid **bosqichi** yo'q (`LeadStage` jadvali bo'sh) | Lidlar bo'limida kamida bitta bosqich yarating |

---

## ⏱ Muddatlar eslatmasi

| Narsa | Muddat |
|---|---|
| Meta lidni saqlash muddati | **~90 kun** (undan eskisini «Qayta olish» olmaydi) |
| System user tokeni | **muddatsiz** |
| Oddiy foydalanuvchi tokeni | ~60 kun — **tavsiya etilmaydi** |
| Business Verification + App Review | odatda **3–10 kun** |
| Meta webhook javobini kutishi | **5 soniya** (CRM darhol 200 qaytaradi) |

Texnik tafsilotlar va qoidalar: [`.claude/rules/marketing-instagram.md`](../.claude/rules/marketing-instagram.md) §16.
