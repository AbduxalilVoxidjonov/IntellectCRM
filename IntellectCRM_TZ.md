# Texnik Topshiriq (TZ) — IntellectCRM

**Bitta o'quv markazi uchun veb-asosli boshqaruv tizimi (CRM & LMS)**

Hujjat versiyasi: 2026-06-08
Hujjat tayyorlandi: 2026-06-08

---

## O'ZGARISHLAR XARITASI (Qisqa Ko'rinish)

| Holat | Modullar |
|---|---|
| ✅ **Aynan olinadi** | Auth/JWT/xavfsizlik, Clean Architecture, Docker/Cloudflare infra, SignalR chat, Push/Telegram bildirishnomalar, LMS, Topshiriqlar, Reyting, Hisobotlar/diagrammalar |
| 🔄 **Moslashtiriladi** | Rollar va nomlar, Moliya, Jadval, Jurnal/baho, O'quvchi portali, Excel import/eksport |
| ➕ **Yangi qo'shiladi** | Leads (CRM) moduli, Guruhlar (sinflar o'rniga), Sinov darslari, To'lov eslatmalari, Trialdan konversiya oqimi |
| ❌ **Olib tashlanadi** | Multi-tenant/TenantId, Control Plane, Obuna tizimi, Sinf ichida kichik guruh (1/2), Oshxona moduli, Choraklar/bayram kunlari, Fan progresi (o'quv reja bo'yicha) |

---

## 1. Loyiha haqida umumiy ma'lumot

**IntellectCRM** — xususiy o'quv markazlari, repetitorlik markazlari va kurs platformalari uchun mo'ljallangan zamonaviy, veb-asosli CRM va boshqaruv tizimi. Tizim **bitta o'quv markazi** uchun quriladi — ko'p-ijarachilik (multi-tenant) arxitekturasi yo'q.

Tizim **o'quv markazining barcha jarayonlarini raqamlashtiradi**: mijozlar (leads) boshqaruvi, talabalar bazasi, guruhlar va dars jadvali, elektron jurnal (baho/davomat), uy vazifalari va topshiriqlar, mustaqil ta'lim (LMS), oylik to'lovlar va moliya, intizom, hisobotlar va tahlil. O'quvchilar va ota-onalar **mobil/veb portal** orqali o'z ma'lumotlarini real vaqtda kuzatadilar; bildirishnomalar **Telegram bot** va **push** orqali yetkaziladi.

---

## 2. Maqsad va vazifalar

- O'quv markaziga kelgan **yangi mijozlardan (leads) to o'quvchiga** aylantirishgacha bo'lgan jarayonni avtomatlashtirish (CRM).
- O'qituvchiga jurnal, baho, davomat, uy vazifa va topshiriqlarni **bitta tizimda** boshqarish.
- Ota-ona va o'quvchiga farzandining **o'zlashtirishi, davomati, to'lovi, intizomi** haqida shaffof, real-vaqtli ma'lumot berish.
- Moliyani (oylik to'lov, chegirma, qarzdorlik, maosh) **avtomatik hisoblash va nazorat qilish**.
- Ma'lumot xavfsizligi, zaxira nusxa va uzluksiz ishlashni ta'minlash.

---

## 3. Foydalanuvchi rollari

| Rol | Tavsif | Asosiy imkoniyatlari |
|---|---|---|
| **Platforma egasi** | Tizim boshlig'i (yagona) | Barcha modullar, adminlar/foydalanuvchilar, statistika, tizimni boshqarish, ma'lumotlarni o'chirish |
| **Superadmin** | Markaz bosh administratori | Barcha modullariga to'liq kirish |
| **Admin** | Markaz administratori | O'quvchi/o'qituvchi/jurnal/moliya/leads boshqaruvi (rol ruxsatlariga ko'ra) |
| **O'qituvchi** | Fan o'qituvchisi / guruh rahbari | Jurnal, baho, davomat, uy vazifa, topshiriq, o'z hisobotlari |
| **O'quvchi** | Talaba | O'z baholari, davomati, to'lovi, topshiriqlari, LMS, reytingi |
| **Ota-ona** | O'quvchining vakili | Farzandi ma'lumotlari (o'quvchi bilan bir xil ko'rinish), pickup |
| **Xodim** (staff) | Markaz xodimi | Ruxsat matritsasiga ko'ra cheklangan kirish; shartnoma/maosh |

> **Platforma egasi** — bitta tizim, bitta markaz. Yangi "tenant" yaratish, obuna, subdomen boshqaruvi yo'q. Platforma egasi tizimni to'liq nazorat qiladi: foydalanuvchilarni o'chirish, ma'lumotlarni tozalash, sozlamalar.

---

## 4. Texnologiyalar (Tech stack)

| Qatlam | Texnologiya |
|---|---|
| Backend | ASP.NET Core (.NET 8), C# |
| Frontend (admin/veb) | React + TypeScript, Vite, Tailwind CSS, Recharts |
| **Ma'lumotlar bazasi** | **MySQL 8** |
| Real-time | SignalR (chat, jonli yangilanish) |
| Autentifikatsiya | JWT (Bearer token), rol asosida |
| Hujjat generatsiyasi | OpenXML (Excel `.xlsx`, Word `.docx` shartnoma) |
| Bildirishnoma | Firebase Cloud Messaging (push), Telegram Bot API |
| Infratuzilma | Docker / Docker Compose |
| Tashqi kirish | **Cloudflare Tunnel** (subdomen yo'q — faqat tunnel orqali yagona domen) |

> **SQL Server → MySQL 8:** EF Core MySQL provayderiga o'tish (`Pomelo.EntityFrameworkCore.MySql`). Migratsiyalar qaytadan generatsiya qilinadi. OpenXML, SignalR, JWT — o'zgarmaydi.

---

## 5. Arxitektura

- **Clean Architecture** — 4 qatlam: `Domain`, `Application`, `Infrastructure`, `Server`. IntellectCRM arxitekturasi.
- **Yagona markaz (Single-tenant):** `TenantId` va global query-filter **yo'q**. Barcha so'rovlar to'g'ridan-to'g'ri ma'lumotga murojaat qiladi.
- **Cloudflare Tunnel:** yagona domen, subdomen yo'q. Tunnel orqali tashqi kirish.
- **Vaqt zonasi:** `AppClock` (Asia/Tashkent, UTC+5).

> Domain entity nomlarida o'zgarish: `School` → `Center`, `Class` → `Group`.

---

## 6. Modullar — Batafsil tavsif

---

### 6.1. ✅ Autentifikatsiya va xavfsizlik — AYNAN OLINADI

- Login faqat `login + parol`.
- JWT token (12 soat), rol asosida himoya.
- Login avtomatik generatsiya (F.I.SH → lotin translit).
- **OWASP / Zero-Trust**: rate-limiting, parol hash (PBKDF2), JWT revocation, xavfsizlik sarlavhalari (CSP, HSTS).
- DataProtection kalitlari doimiy volumeda.

---

### 6.2. ❌ Ko'p-markazlilik va obuna (Control Plane) — OLIB TASHLANADI

Multi-tenant arxitekturasi, `TenantId`, global query-filter, Control Plane, subdomen boshqaruvi, obuna (modullar/muddat/narx) — **barchasi olib tashlanadi**. Tizim bitta markaz uchun.

---

### 6.3. ➕ Leads (CRM) moduli — YANGI

O'quv markazi uchun eng muhim yangi modul.

**Leads — yangi mijozlar boshqaruvi:**
- Lead kartochkasi: ism, telefon, manba (Instagram, referral, sayt va h.k.), qiziqish fani, izoh, sana.
- **Kanban board** (Trello uslubida): bosqichlar — `Yangi` → `Bog'lanildi` → `Sinov darsi belgilandi` → `Sinov darsi o'tdi` → `Ro'yxatdan o'tdi` → `Rad etdi`.
- Bosqichlar sozlanadi (admin tomonidan).
- Har leadga hodisalar tarixi (kim, qachon, nima qildi).
- Lead → O'quvchiga konversiya: bir tugma bilan o'quvchi yaratiladi, lead yopiladi.
- **Statistika:** konversiya foizi, manba bo'yicha tahlil, oylik dinamika.

**Sinov darslari:**
- Lead uchun sinov darsi belgilash (guruh + sana/vaqt).
- O'qituvchiga bildirishnoma.
- Sinov darsi natijasi: qoldi / ketdi → lead statusini yangilaydi.

---

### 6.4. 🔄 O'quvchilar — MOSLASHTIRILADI

**Saqlanadi:**
- To'liq CRUD (F.I.SH, tug'ilgan sana, jinsi, manzil, ota-ona).
- Fayl yuklash (rasm/hujjat).
- Chegirma (foiz + summa).
- Arxivlash (soft-delete), arxivdan qaytarish.
- Excel ommaviy import (shablon + yuklash + xato hisoboti).
- Shaxsiy daftar (batafsil sahifa) — diagrammalar bilan.
- **GPS uy joylashuvi** — o'quvchi mobil ilovadan bir marta uy koordinatasi yuboradi; admin Leaflet xaritada qaysi hududda qancha o'quvchi borligini ko'radi (filial rejalashtirish, reklama hududi uchun).

**O'zgaradi:**
- `Sinf` → `Guruh` (bir o'quvchi bir vaqtda **bir nechta guruhda** bo'lishi mumkin).
- Sinf ichida kichik guruh (1/2 bo'linish) — **olib tashlanadi**.

**Qo'shiladi:**
- Guruhga qo'shilish/chiqish **sanasi**.
- Qaysi fanlarda o'qishi (bir nechta guruh → bir nechta fan).

**Saqlanadi — Pickup funksiyasi:**
- Ota-ona "farzandimni olishga keldim" tugmasini bosadi → guruh rahbariga push bildirishnoma → rahbar javob beradi → ota-onaga push.

---

### 6.5. ✅ O'qituvchilar va xodimlar — AYNAN OLINADI

- O'qituvchilar bazasi, fanlarga biriktirish, guruh rahbarligi, maosh.
- Arxivlash.
- Xodimlar (staff) — rol ruxsat matritsasi; shartnoma.

---

### 6.6. 🔄 Guruhlar, fanlar, jadval — MOSLASHTIRILADI

**"Sinflar" → "Guruhlar"** deb nomlanadi.

**Saqlanadi:**
- Guruh nomi, oylik narx, fanlar.
- Dars jadvali (kun/dars raqami/vaqt).
- Dars vaqtlari.

**Olib tashlanadi:**
- Choraklar tizimi (o'quv markazida chorak yo'q; oylik davr yetarli).
- Bayram kunlari to'liq taqvimi → faqat markaz tomonidan belgilangan **ta'til kunlari** qoladi.

**Qo'shiladi:**
- Guruh holati: `Faol`, `To'lgan`, `Arxiv`.
- Guruh boshlanish/tugash sanasi (kurs muddati).
- Guruhda o'quvchilar soni chegarasi (opsional).

---

### 6.7. ✅ Elektron jurnal — AYNAN OLINADI

- Har dars: o'tildi belgisi, mavzu, uy vazifa, **baho**, **davomat** (sabab bilan: sababsiz/kasal/kech).
- Uy vazifa holati (qildi/qilmadi) va xulq.
- Admin va o'qituvchi uchun yagona jurnal modali.

---

### 6.8. 🔄 Oylik baholash — MOSLASHTIRILADI

- Sozlanadigan baholash turlari — **saqlanadi**.
- Chorak bo'yicha yig'ma baho — **olib tashlanadi**.
- Oylik o'rtacha va dinamika diagrammasi — **saqlanadi**.

---

### 6.9. ✅ Intizom — AYNAN OLINADI

- 100 ball tizimi, manfiy/musbat sabablar.
- Jurnal davomatidan avtomatik ball.
- To'liq tarix.

---

### 6.10. ✅ Topshiriqlar (Assignments) — AYNAN OLINADI

- Formatlar: yozma, fayl, test, video.
- Avtomatik baholash (test), qo'lda baholash (yozma/fayl).
- Kech topshirish jarimasi, maksimal ball.
- Ballar jadvali (scoreboard).

---

### 6.11. ✅ LMS (mustaqil ta'lim) — AYNAN OLINADI

- Fan → mavzu → material ierarxiyasi.
- Qulflanish mantig'i (sequential, batch, all).
- Progress kuzatuvi.

---

### 6.12. ❌ Fan progresi (o'quv reja bo'yicha) — OLIB TASHLANADI

"O'quv yili rejasida nechta dars bor" tizimi o'quv markaziga mos kelmaydi. Guruh boshlanish/tugash sanasi va o'tilgan darslar soni yetarli.

---

### 6.13. ✅ Reyting — AYNAN OLINADI

- O'quvchi reytingi (o'rtacha baho): o'z guruhi to'liq + markaz TOP 15.

---

### 6.14. 🔄 Moliya — MOSLASHTIRILADI

**Saqlanadi:**
- Guruh oylik narxi asosida avtomatik hisob.
- Chegirma (foiz/summa).
- To'lov qabul qilish, balans, to'lov tarixi (ledger).
- Kirim/chiqim tranzaksiyalari.
- Login/parol Excel eksporti.

**Qo'shiladi:**
- **To'lov eslatmasi**: oylik hisob yaratilganda ota-onaga Telegram + push bildirishnoma.
- Bir o'quvchi bir nechta guruhda bo'lsa — har guruh uchun **alohida to'lov** yoki **yig'ma** (sozlanadigan).
- **Qarzdorlik hisoboti**: kim qancha qarzdor — filtrlab, eksport qilib.

**Olib tashlanadi:**
- Chorak bo'yicha hisob-kitob.

---

### 6.15. ✅ Shartnomalar — AYNAN OLINADI

- Word andoza (`@`-o'rinbosarlar) → OpenXML → `.docx`.
- Telegram bot orqali yuborish.

---

### 6.16. ✅ Boshqaruv — AYNAN OLINADI

- Filiallar (xarita + radius).
- Rollar (xodim ruxsat matritsasi).
- Xodimlar.
- Taklif/shikoyatlar (rasm bilan).

---

### 6.17. ❌ Oshxona moduli — OLIB TASHLANADI

O'quv markazida oshxona yo'q.

---

### 6.18. 🔄 O'quvchi / ota-ona portali — MOSLASHTIRILADI

**Saqlanadi:**
- Bosh sahifa, jadval, baholar, davomat, intizom, reyting, moliya, topshiriqlar, LMS, chat, sozlamalar, taklif/shikoyat.
- `/api/student/notebook` — bitta so'rovda barcha ma'lumot.
- **Pickup** — ota-ona "farzandimni olishga keldim" → guruh rahbariga push → javob ota-onaga.
- GPS joylashuv yuborish (bir martalik).

**O'zgaradi:**
- Oshxona bo'limi — olib tashlanadi.
- Bayramlar bo'limi → ta'til kunlari.
- Bir o'quvchi bir nechta guruhda bo'lsa — portalda **guruh tanlash** imkoniyati.

---

### 6.19. ✅ O'qituvchi portali va hisobotlar — AYNAN OLINADI

- `/api/teacher/*` API.
- Faollik hisoboti (jadvalga nisbatan bajarilish foizi).

---

### 6.20. 🔄 Bildirishnomalar va real-time — MOSLASHTIRILADI

**Saqlanadi:**
- Telegram bot: e'lonlar, shartnoma.
- Push (FCM): yangi baho, davomat, e'lon, pickup javobi.
- Chat (SignalR): guruh chati.

**Olib tashlanadi:**
- `tenant-izolyatsiyalangan` chat mantiq (yagona markaz, izolyatsiya shart emas).

**Qo'shiladi:**
- To'lov eslatmasi push/Telegram.
- Sinov darsi eslatmasi (lead uchun).

---

### 6.21. 🔄 Hisobotlar va tahlil — MOSLASHTIRILADI

**Saqlanadi:**
- O'zlashtirish, davomat, oylik baholash, uy vazifa/xulq diagrammalari.

**Qo'shiladi:**
- **CRM hisoboti**: leads soni, konversiya foizi, manbalar bo'yicha, oylik dinamika.
- **Guruh to'ldirish hisoboti**: nechta guruh to'la, nechta bo'sh joy bor.
- **Qarzdorlik tahlili**: jami qarzdorlik summasi, eng ko'p qarzdorlar.

---

### 6.22. 🔄 Import / Eksport — MOSLASHTIRILADI

**Saqlanadi:**
- O'quvchi import shabloni (`.xlsx`) + ommaviy yuklash.
- Login/parol eksporti.
- CSV eksport.

**Qo'shiladi:**
- Leads import (Excel'dan toplu yuklash).
- Qarzdorlik hisoboti eksporti.

---

## 7. Modul kalitlari (AdminModules)

| Modul | IntellectCRM | O'zgarish |
|---|---|---|
| `leads` | `leads` | ✅ Saqlanadi (kengaytiriladi) |
| `students` | `students` | ✅ Saqlanadi |
| `teachers` | `teachers` | ✅ Saqlanadi |
| `attendance` | `attendance` | ✅ Saqlanadi |
| `schedule` | `schedule` | ✅ Saqlanadi |
| `classes` | `groups` | 🔄 Nom o'zgaradi |
| `journal` | `journal` | ✅ Saqlanadi |
| `messages` | `messages` | ✅ Saqlanadi |
| `app` | `app` | ✅ Saqlanadi |
| `gradesReport` | `gradesReport` | ✅ Saqlanadi |
| `teacherReports` | `teacherReports` | ✅ Saqlanadi |
| `contracts` | `contracts` | ✅ Saqlanadi |
| `finance` | `finance` | ✅ Saqlanadi |
| `academicYear` | — | ❌ Olib tashlanadi |
| `settings` | `settings` | ✅ Saqlanadi |
| `staff` | `staff` | ✅ Saqlanadi |
| `feedback` | `feedback` | ✅ Saqlanadi |
| `discipline` | `discipline` | ✅ Saqlanadi |
| — | `crmStats` | ➕ Yangi (leads statistikasi) |

---

## 8. Funksional bo'lmagan talablar

| Yo'nalish | Yechim |
|---|---|
| **Xavfsizlik** | OWASP/Zero-Trust, JWT revocation, rate-limit, upload allowlist, CSP/HSTS, parol hash |
| **Ishonchlilik** | Kunlik avtomatik DB backup (7 kun), DB retry |
| **Unumdorlik** | Kesh, batch hisob |
| **Uzluksizlik** | Docker `restart: unless-stopped`, Cloudflare tunnel |
| **Til** | O'zbek tili |
| **Vaqt** | AppClock (Asia/Tashkent) |

---

## 9. Integratsiyalar

- **Telegram Bot API** — e'lon, shartnoma, to'lov eslatmasi, sinov darsi eslatmasi.
- **Firebase Cloud Messaging** — mobil push.
- **Cloudflare Tunnel** — xavfsiz tashqi kirish (subdomen yo'q, yagona tunnel).
- **OpenXML** — Excel/Word generatsiyasi.

---

## 10. Infratuzilma va deploy

Docker Compose 4 ta servis:

- `app` — API + frontend (SPA), 8080-port (faqat tunnel orqali).
- `mysql` — MySQL 8 (ma'lumot va backup volume'lari).
- `cloudflared` — Cloudflare tunnel.
- `backup` — kunlik 02:00 (Toshkent) barcha bazalarni dump qiladi, 7 kun saqlaydi.

---

## 11. API hujjatlari

- `student_api.md` — o'quvchi/ota-ona portali (moslashtiriladi).
- `teacher_api.md` — o'qituvchi portali (moslashtiriladi).
- `leads_api.md` — **yangi** (leads/CRM endpointlari).
- Admin API — `/api/admin/*`.

---

## 12. Kelajakda amalga oshirish mumkin

- **Onlayn to'lov** (Payme, Click, Uzum).
- **SMS-shlyuz** (to'lov eslatmasi, parol, davomat).
- **Onlayn test/imtihon** kengaytmasi.
- **AI yordamchi**: konversiya prognozi, xavf ostidagi o'quvchi.
- **Mahalliy mobil ilovalar** (mavjud API ustiga).
- **Ko'p tillilik** (o'zbek/rus/ingliz).
- **Bulutga ofsayt backup** (S3/Object Storage).
- **WhatsApp/Telegram bot** orqali lead qabul qilish (avto-yaratish).

---

## 13. Xulosa — Nima olinadi, nima olib tashlanadi

### ✅ Aynan olinadi
- Auth, JWT, xavfsizlik (OWASP/Zero-Trust)
- Clean Architecture, Docker, Cloudflare infra
- O'qituvchilar moduli
- Elektron jurnal (baho, davomat)
- Topshiriqlar (assignments)
- LMS (mustaqil ta'lim)
- Intizom tizimi
- Reyting
- Shartnomalar
- Bildirishnomalar (Telegram + Push + SignalR chat)
- Boshqaruv (filiallar, rollar, xodimlar, taklif/shikoyat)
- Hisobot diagrammalari
- Pickup funksiyasi

### 🔄 Moslashtiriladi
- **Ma'lumotlar bazasi**: SQL Server → MySQL 8
- **Tashqi kirish**: subdomen yo'q, faqat Cloudflare tunnel
- O'quvchilar moduli (guruh tizimi; GPS saqlanadi)
- Guruhlar (sinflar o'rniga; kurs muddati, holat qo'shiladi)
- Jadval (choraklar olib tashlanadi)
- Moliya (ko'p-guruh to'lov, eslatma qo'shiladi)
- O'quvchi/ota-ona portali (oshxona olib tashlanadi)
- Modul kalitlari (`classes` → `groups`, `academicYear` olib tashlanadi)
- Import/Eksport (leads import qo'shiladi)

### ➕ Yangi qo'shiladi
- **Leads (CRM) moduli** — kanban, bosqichlar, hodisalar tarixi, konversiya
- **Sinov darslari** — lead → sinov → ro'yxatdan o'tish oqimi
- **CRM statistikasi** — konversiya foizi, manba tahlili
- **To'lov eslatmalari** — push + Telegram avtomatik yuborish
- **Qarzdorlik hisoboti** — eksport bilan
- **Guruh to'ldirish hisoboti**

### ❌ Olib tashlanadi
- Multi-tenant arxitekturasi (`TenantId`, global query-filter)
- Control Plane (tenant provisioning, subdomen boshqaruvi)
- Obuna tizimi (modullar/muddat/narx)
- Oshxona moduli
- Choraklar tizimi
- Fan progresi (o'quv reja bo'yicha)
- Sinf ichida kichik guruh (1/2)
- Bayram kunlari to'liq taqvimi (faqat ta'til kunlari qoladi)

---

> **Xulosa:** IntellectCRM — bitta o'quv markazi uchun qurilgan, leads-dan to o'quvchiga qadar to'liq CRM oqimini qamragan platforma. MySQL'ga o'tish va multi-tenant olib tashlanishi tizimni soddalashtirib, ishlab chiqish va xizmat ko'rsatishni tezlashtiradi.
