# FACE-DETEKT — rasmdan o'quvchini aniqlash: TAHLIL VA REJA

> **HOLAT: 📋 REJA (hali boshlanmagan)** — 2026-08-07 dagi tahlil va kelishuv.
> Foydalanuvchi "face-detekt" deb so'raganda ishni SHU HUJJATDAN davom ettiriladi.
>
> Bu hujjat kod bazasining O'ZIDAN tekshirilgan faktlarga tayanadi (§7) — qayta izlash shart emas.

---

## 1. Muammo (nima uchun kerak)

**Holat (a): "Bola oldimda turibdi, ismini bilmayman."** Qabulchi/kassir bolani tanimaydi va uni
tizimdan topa olmaydi (ism noma'lum, telefonni bola bilmasligi mumkin).

Boshqa ikki holat ATAYIN bu ishga kirmaydi:
- **(b) davomat** — turniket/FaceID qurilmasi allaqachon qiladi (§7.1);
- **(c) dublikat o'quvchi** — telefon/ism bo'yicha dedup arzonroq va aniqroq.

---

## 2. QAROR: nima QILINMAYDI va nega

| Qilinmaydi | Sabab |
|---|---|
| **Modelni o'zimiz o'qitish** | Yuz modeli o'qitilmaydi — tayyori (ArcFace/InsightFace) olinadi. O'zi o'qitilgan **klassifikator** esa arxitektura xatosi: har yangi o'quvchida qayta o'qitish kerak, chiqib ketgani modelda qoladi va eng yomoni **"bu odamni bilmayman" deya olmaydi** — begona odamni ham eng o'xshash o'quvchi deb ko'rsatadi |
| **Modelni SERVERDA ishlatish** | Detektor + embedding + ONNX Runtime ≈ 250–350 MB (kichik model), `buffalo_l` ≈ 500–700 MB. Server 1 GB (§7.2) — OOM killer birinchi Postgres'ni o'ldiradi. 2 GB'da sig'adi, lekin o'sha RAM Postgres'dan olinadi |
| **Natijani AVTOMATIK tanlash** | Noto'g'ri moslik eng qimmatga tushadigan xato: operator ishonib boshqa bolaning hisobiga to'lov yozadi. Har doim **5 ta nomzod → operator bosadi** |
| **Piksel bo'yicha solishtirish ("modelsiz")** | Ishlamaydi: yorug'lik/burchak/fon o'zgarsa bir odamning ikki surati piksel darajasida ikki xil odamnikidan ko'proq farq qiladi |

---

## 3. TANLANGAN ARXITEKTURA

Asosiy g'oya: **model SERVERDA emas, BRAUZERDA ishlaydi; server faqat vektorlarni saqlaydi.**

```
ETALON (bir marta, mavjud rasmlar uchun)
  LOKAL KOMPYUTER: uploads nusxasi + o'quvchilar ro'yxati
    → tayyor model (InsightFace buffalo_s) → har rasm uchun 512 ta son
    → JSON: { studentId, vector, modelVersion, photoHash }
    → POST /api/admin/face/embeddings  (bulk)

DOIMIY ISH (yangi rasm yuklanganda)
  BRAUZER (onnxruntime-web/WASM) rasm yuklanayotganda vektorni ham hisoblaydi
    → rasm bilan birga yuboriladi (lokal skript endi kerak emas)

QIDIRUV ("Kim bu?")
  BRAUZER: kameradan kadr → vektor (512 son)
    → POST /api/admin/face/search { vector }
    → SERVER: xotiradagi vektorlar bilan kosinus (model YO'Q)
    → 5 ta nomzod + o'xshashlik foizi + RASMI
    → operator bosadi
```

**Server tomonda narx ~0:** 500 o'quvchi × 512 son × 4 bayt = **1 MB**. Taqqoslash — oddiy
matematika (kutubxona ham kerak emas), 500 vektor uchun mikrosoniyalar. Vektorlar `DataCache`
(loyihada bor) orqali xotirada tutiladi.

⚠️ **Lokal tayyorlash faqat BIRINCHI TO'LDIRISH uchun** — mavjud N ta eski rasmni brauzerda
birma-bir kutgandan ko'ra lokal skriptda 5 daqiqada qilish qulay. Doimiy ish uchun kerak emas.

⚠️ **Ulash kaliti allaqachon bor:** `Student.Id` → `BirthCertificateUrl = "/uploads/<guid>.jpg"`.
Ya'ni lokal skript natijani `StudentId` bo'yicha yozadi — ism bo'yicha qo'lda moslashtirish YO'Q.

⚠️ **`modelVersion` MAJBURIY:** vektor faqat o'zini yaratgan model bilan taqqoslanadi. Model
almashsa — hammasi qayta hisoblanadi. `photoHash` esa "qaysi rasm o'zgardi" ni biladi (faqat
o'zgarganini qayta hisoblash uchun).

---

## 4. BOSQICHLAR (kelishilgan navbat)

### Bosqich 0 — RASM THUMBNAIL *(face-detekt'siz ham KERAK)*
Hozir rasm kichraytirilmaydi: fayldan tanlangan 4–5 MB lik telefon surati asl holicha saqlanadi
va ro'yxatda ham shunday yuklanadi (§7.3). Loyihada rasm kutubxonasi UMUMAN yo'q (§7.4).
- yuklashdan oldin brauzerda ~512px ga kichraytirish (`PhotoDialog.pickFile` — hozir faylni
  tegmasdan yuboradi; `shoot()` esa allaqachon canvas orqali JPEG q0.9 chiqaradi);
- eski rasmlar uchun keshlangan thumbnail (`uploads/thumbs/<guid>_256.jpg`, birinchi so'rovda
  yaratiladi) — buning uchun ImageSharp/SkiaSharp kerak, dekodlashda 50–100 MB spike beradi
  (1 GB'da xavfli, 2 GB'da bemalol);
- foyda: barcha ro'yxatlar bugunoq tezlashadi + rasmlar to'ri (bosqich 1) umuman mumkin bo'ladi.

### Bosqich 1 — «KIM BU?» OYNASI *(model YO'Q, eng katta foyda)*
Bitta tugma (`Ctrl+K` yoki sarlavhada) → oyna:
1. **«Hozir kirganlar»** — turniketdan oxirgi 30–60 daqiqada kirgan o'quvchilar, KATTA rasm bilan.
   Bola hozirgina eshikdan kirgan bo'lsa shu yerda turadi → savol tugadi;
2. pastida — **rasmlar to'ri** (faol o'quvchilar, ism bilan), filtrlar: guruh/kurs/o'qituvchi,
   harf yozilsa toraytiriladi;
3. rasm bosiladi → o'quvchi profili.

Odam yuzni to'rdan ~0,1 soniyada tanidi; model esa 5–10 soniya + xato ehtimoli. Shu sababdan
bu bosqich birinchi va, ehtimol, bosqich 2 keraksiz bo'lib qoladi.

### Bosqich 2 — FACE-DETEKT (faqat 0 va 1 dan keyin, kerak bo'lsa)
§3 dagi arxitektura. Taxminiy ro'yxat:
- entity `StudentFaceEmbedding` (StudentId, Vector `float[]`/`bytea`, ModelVersion, PhotoHash,
  CreatedAt) — migratsiya `AddFaceEmbeddings`;
- `POST /api/admin/face/embeddings` (bulk, `students` ruxsati + `ReadRequiresPerm`),
  `POST /api/admin/face/search` (vektor → 5 nomzod), `GET /api/admin/face/status`
  (nechta o'quvchi indekslangan, nechtasi rasmsiz — qamrovni ko'rsatish);
- brauzer tomoni: onnxruntime-web + `buffalo_s` (model ~15 MB, bir marta keshlanadi);
- lokal skript: Python + insightface (repo ichida `tools/face-index/`).

---

## 5. XAVFLAR (RAM bilan HAL BO'LMAYDI)

1. **Aniqlik.** Har o'quvchida BITTA, sifat nazoratisiz etalon rasm (webcam / eski surat / turli
   burchak-yorug'lik). Bolalar yuzi tez o'zgaradi — 2 yil oldingi rasm bugungi bolaga mos
   kelmasligi mumkin. Aka-uka va tengdoshlar o'xshaydi. **Yechim:** avtomatik tanlash yo'q,
   faqat 5 nomzod + operator qarori.
2. **Biometrika + zaxira nusxa.** Yuz vektori — biometrik ma'lumot, ustiga voyaga yetmaganlarniki.
   Loyihada baza zaxirasi **Telegram'ga yuboriladi** — kalitlar aynan shu sababdan bazadan olib
   tashlangan edi (migratsiya `RemoveSecretsFromDb`). Vektorlar ham o'sha yo'l bilan chiqadi.
   Qaror qabul qilishdan oldin: zaxiradan chiqarib tashlash yoki shifrlash o'ylanadi.
3. **Rasmlarni lokalga ko'chirish** — biometrik ma'lumot serverdan chiqishi. Ish tugagach nusxa
   o'chiriladi.

---

## 6. SERVER RESURSI (2 CPU / 2 GB masalasi)

2 GB'ga chiqish **arziydi, lekin face-detekt uchun emas** — quyidagilar uchun:

| Nima | Hozir 1 GB'da |
|---|---|
| **Deploy build serverda** (`docker compose up -d --build`) | Vite build `NODE_OPTIONS=--max-old-space-size=4096`, Dockerfile izohida "VM'da ≥6 GB kerak". 1 GB'da swap'ga tushadi yoki `exit 134` |
| **Sertifikat PDF (LibreOffice)** | DEPLOY.md: 1 GB serverda **swap majburiy** aynan shu sababdan |
| **PostgreSQL** | Default sozlama (`shared_buffers` 128 MB) — hisobotlar diskdan o'qiydi |
| **Docker memory limitlari** | `docker-compose.yml` da **umuman yo'q** — bitta xizmat hammasini yeyishi mumkin |

2 GB'dagi taxminiy taqsimot: OS+Docker ~150 MB · Postgres ~400 MB · .NET ~300 MB ·
mediamtx+cloudflared ~100 MB · LibreOffice (vaqtincha) ~300 MB → **~700 MB bo'sh**.

**Tavsiya:** 2 GB olinsa ham **build'ni serverdan olib tashlash** (image lokal/GitHub Actions'da
yig'ilib, serverga `docker pull`) — bu 4 GB olishdan foydaliroq.

---

## 7. TEKSHIRILGAN KOD FAKTLARI *(2026-08-07 holatiga)*

**7.1 Turniket/FaceID allaqachon bor va O'QUVCHILAR uchun ham ishlaydi:**
`TurnstileService.cs` (Hikvision/ZKTeco), `TurnstileEvent` entity (`DeviceUserId` → odam),
`StudentTurnstilePage.tsx` + `api/services/studentTurnstile.ts` (o'quvchiga qurilma ID biriktirish,
jonli `LiveHub`). Yuzni **qurilmaning o'zi** taniydi — serverga yuk yo'q.
⚠️ `StudentTurnstilePage` da hozir **birorta rasm ko'rsatilmaydi** — bosqich 1 uchun asosiy joy.

**7.2 Server:** 1 GB RAM + 2 GB swap (`DEPLOY.md` §0.2, `vm.swappiness=10`).
`docker-compose.yml` da xizmatlar: postgres:16-alpine, app, mediamtx, cloudflared (+ CTI).
Resurs limitlari yo'q.

**7.3 Rasm:** `Student.BirthCertificateUrl` → `/uploads/<guid>.jpg` (nomi ESKI — qayta nomlanmaydi,
sabab `Entities.cs` izohida). DTO'larda `photoUrl`. Yuklash: `UploadGuard` (20 MB gacha,
`PhotoExtensions` = jpg/jpeg/png), **server tomonda kichraytirish YO'Q**.
`PhotoDialog.shoot()` — kvadrat kesib JPEG q0.9 chiqaradi; `pickFile()` — faylni **tegmasdan**
yuboradi (4–5 MB shundayligicha ketadi).
`/uploads` login talab qiladi (`UploadsGuard`, `up_at` cookie) — `.claude/rules/uploads-security.md`.

**7.4 Rasm/ML kutubxonasi:** loyihada **umuman yo'q** (paketlar: OpenXml, EF Core, JwtBearer,
SpaProxy). ImageSharp/SkiaSharp/ONNX — hammasi yangi bog'liqlik bo'ladi.

**7.5 Rasm qayerda ko'rinadi:** `StudentsPage.tsx` (ro'yxatda avatar, rasm bo'lmasa harflar),
`StudentDetailPage.tsx`. **Yo'q joylari** (bosqich 1 nomzodlari): turniket sahifasi, guruh
a'zolari, jurnal, «Bog'lanish kerak» navbati, kassa qidiruvi, kitob sotish oynasi.

**7.6 Kesh:** `DataCache` (versiyali IMemoryCache, `CacheInvalidationInterceptor` bilan
avto-yangilanadi) — vektorlarni xotirada tutish uchun tayyor mexanizm.

---

## 8. KEYINGI QADAM

Foydalanuvchi tanlaydi:
1. **Bosqich 0** — thumbnail (barcha ro'yxatlarni tezlashtiradi, boshqalari uchun poydevor);
2. **Bosqich 1** — «Kim bu?» oynasi (model yo'q, muammoning ~90% i);
3. **Bosqich 2** — face-detekt (faqat 0 va 1 dan keyin).

Kelishuv: **0 → 1 → (kerak bo'lsa) 2**.
