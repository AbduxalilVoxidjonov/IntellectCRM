# `/uploads` xavfsizlik modeli

Yuklangan barcha fayllar bitta TEKIS papkada: `ContentRoot/uploads`. U docker volume
(`uploads:/app/uploads`) va tungi zaxiraga kiradigan **yagona** papka — shuning uchun fayllarni
undan chiqarish (ko'chirish) zaxiradan tushib qolish degani.

## `/uploads` DARVOZASI — login talab qiladi (`UploadsGuard`)

`/uploads` ilgari autentifikatsiyasiz berilardi. Endi `UploadsGuard` (Server) middleware'i uni
darvozalaydi: **token yo'q → 404** (403 emas — faylning mavjudligini ham tasdiqlamaymiz).

**Nega cookie?** Loyihada JWT Bearer ishlatiladi, brauzer esa `<img src="/uploads/...">` ga
`Authorization` sarlavhasini **yubormaydi**. Shuning uchun `Path=/uploads` ga cheklangan
`up_at` cookie'si qo'yiladi — brauzer uni rasm so'rovlarida o'zi yuboradi va **frontend kodiga
tegish kerak bo'lmadi**. (Loyihadagi mavjud yondashuv bilan bir xil: `/ws` va SignalR ham sarlavha
yubora olmagani uchun tokenni boshqa yo'ldan oladi.)

**Cookie qanday paydo bo'ladi?** Alohida qadam YO'Q: `UseAuthentication` dan keyingi middleware
har qanday avtorizatsiyalangan API so'rovida cookie'ni qo'yadi/tiklaydi. Ya'ni **mavjud
sessiyalar qayta login qilmasdan** ishlayveradi.

Cookie sozlamalari va ular NEGA shunday:
- `HttpOnly` — JS o'qiy olmaydi (XSS bilan o'g'irlanmasin);
- `Path=/uploads` — API so'rovlariga umuman yuborilmaydi;
- HTTPS'da `SameSite=None; Secure` — Telegram Mini App SPA'ni `web.telegram.org` ichida
  IFRAME'da ochadi, u yerdan kelgan rasm so'rovlari "cross-site" hisoblanadi va `Lax` cookie
  **yuborilmasdi**. Dev (http) da `Lax`.

**Token tekshiruvi qo'lda:** statik fayllar pipeline'da `UseAuthentication` dan OLDIN turadi, ya'ni
guard ichida `HttpContext.User` hali bo'sh. Shuning uchun token (sarlavha yoki cookie) qo'lda
tekshiriladi va natija keshlanadi (bitta sahifada o'nlab rasm bo'lishi mumkin).

**OCHIQ qoladigan narsalar — LOGIN'SIZ ko'riladigan sahifalarning rasmlari.** Printsip BITTA:
"ochiq" deb faqat markaz **O'ZI ommaviy ko'rsatayotgan** fayl hisoblanadi. Ro'yxat bazadan olinadi,
1 daqiqa keshlanadi (`UploadsGuard.PublicNamesAsync`), qaror esa `UploadAccessRules` (Application)
da — testlangan.

| Manba | Nima uchun ochiq | Filtr |
|---|---|---|
| `CenterMeta.LogoUrl`, `CareerAbout.LogoUrl` | Logotip login sahifasida, PWA manifestida va ochiq vakansiya sahifasida kerak — foydalanuvchi hali kirmagan | — (hammasi) |
| `LandingTeacher.PhotoUrl` | Landing OMMAVIY sahifa (`GET /api/public/landing-data`, `[AllowAnonymous]`) — o'qituvchi surati mehmonga ko'rsatiladi | **faqat `IsActive`** |
| `LandingCertificate.ImageUrl` | O'sha landing: natija/sertifikat rasmi | **faqat `IsActive`** |
| `LandingTestimonial.AvatarUrl` | O'sha landing: "Ota-onalar va o'quvchilar fikri" bo'limidagi avatar | **faqat `IsActive`** |

⚠️ **NEGA landing rasmlari ochilishi SHART edi:** admin CMS orqali rasmni yuklaydi, manzil
`/uploads/<guid>.png` bo'lib bazaga tushadi. Admin o'zi (login qilgan, `up_at` cookie'si bor) rasmni
KO'RADI, tashqaridagi mehmon esa 404 olib **sinuq rasm** ko'rardi. Ya'ni nosozlik "lokalda ishlaydi,
serverda ishlamaydi" bo'lib ko'rinardi — aslida farq lokal/server emas, **login qilgan/qilmagan** edi.

⚠️ **YANGI LANDING BO'LIMI QO'SHSANGIZ — bu jadvalni ham to'ldiring.** "Fikrlar" (testimonials)
CMS tabi aynan shu sababdan yarim ishlagan: admin fikr qo'shardi, `landing-data` uni qaytarardi,
lekin avatar ro'yxatda yo'q edi — ya'ni bo'lim chizilganda mehmon sinuq rasm ko'rardi. Qoida:
**landing markup'iga `/uploads/...` manzili chiqadigan har bir yangi maydon shu ro'yxatga
qo'shilishi SHART**, aks holda nosozlik faqat login qilmagan mehmonda ko'rinadi (ishlab
chiquvchida esa ishlaydi).

⚠️ **NEGA faqat `IsActive`:** admin sertifikatni yoki o'qituvchini saytdan olib tashlasa, fayl ham
darhol (kesh muddatidan keyin, ko'pi bilan 1 daqiqada) YOPILADI. "Bir marta ommaviy bo'lgan fayl
abadiy ommaviy" qoidasi bu yerda ishlamaydi — filtr `landing-data` endpointidagi filtr bilan
AYNAN bir xil.

⚠️ **CHEGARA — `UploadAccessRules.MaxPublicNames` (2000).** Ro'yxat xotirada turadi va har
`/uploads` so'rovida ko'riladi, ya'ni cheksiz o'sa olmaydi. Chegaradan oshgani **jimgina
tashlanmaydi** — `PublicNamesFrom` nechtasi kirmaganini qaytaradi, guard esa ogohlantirish logi
yozadi ("nega bu sertifikat saytda ko'rinmayapti" savoli javobsiz qolmasin). Guard manzillarni
**LOGOTIPDAN boshlab** yig'adi, shuning uchun chegara faqat landing rasmlarini qirqadi —
login sahifasi hech qachon buzilmaydi.

**Favqulodda o'chirish:** `Uploads:RequireAuth=false` — kodni qayta yig'masdan eski xatti-harakatga
qaytaradi (startupda ogohlantirish logi yoziladi). Rad etilgan har so'rov logga yoziladi
(`/uploads rad etildi: <yo'l> (UA: ...)`) — kutilmagan mijoz shu yerdan ko'rinadi.

⚠️ **MOBIL ILOVALAR:** Flutter ilovalari bu repoda EMAS. Agar ular rasmlarni `Authorization`
sarlavhasisiz yuklasa, ular uchun rasm ko'rinmay qoladi. Guard sarlavhani ham qabul qiladi, ya'ni
ilova HTTP mijoziga token qo'shsa yetadi. Deploydan keyin log'da `/uploads rad etildi` qatorlarini
kuzating.

**Eski qoida hamon kuchda** (endpoint yozganda):

> Manzilni bergan joy = faylni ko'rishga ruxsat bergan joy. Endi u login talab qiladi, lekin
> tizimdagi ISTALGAN foydalanuvchi manzilni bilsa ochadi — ya'ni "kim ko'rishi mumkin" savoli
> baribir muhim.

## Hozirgi himoya qatlamlari

| Qatlam | Nima beradi |
|---|---|
| Fayl nomi `Guid.NewGuid():N` (`UploadGuard.SafeName`) | 128 bit tasodifiylik — taxmin qilib topib bo'lmaydi. Asl nom (`ali-passport.pdf`) hech qachon saqlanmaydi |
| Katalog ro'yxati o'chiq | `UseDirectoryBrowser` yo'q; fayl nomlarini ro'yxatlaydigan endpoint ham yo'q |
| `Referrer-Policy: no-referrer` | Manzil "Referer" orqali tashqi saytga sizib chiqmaydi |
| `Cache-Control: private` | Cloudflare/proxy umumiy keshida saqlanmaydi |
| `PrivateFolderFileProvider` | `uploads/certificates` va `uploads/face` STATIK yo'l bilan berilmaydi (qarang: `tests.md`) |

⚠️ **So'rov loglari YO'Q:** `appsettings.json` da `"Microsoft.AspNetCore": "Warning"` — ya'ni
`/uploads` ga kim murojaat qilgani **yozilmaydi**. Demak "sizdimi?" degan savolga o'tmishga qarab
javob berib bo'lmaydi. Buni yoqish — alohida ish.

## Kim qaysi fayl manzilini oladi (darvozalar)

### Sertifikatlar — API orqali, fayl statik yo'ldan BERILMAYDI
- Eski HTML sertifikatlar (`CertificatesController`) va yangi test sertifikatlari
  (`TestResultsController` / `TeacherPortalController`) — fayl faqat avtorizatsiyalangan
  endpointdan, diskdan o'qib beriladi.
- ⚠️ `CertificatesController` da ilgari admin marshrutlarida **yalang `[Authorize]`** turardi —
  ya'ni istalgan o'quvchi/ota-ona begona o'quvchining sertifikat faylini yuklab olardi, sertifikat
  yaratardi va shablonlarni o'chira olardi. Endi har bir admin amalida
  `[AdminPerm("students.list", ReadRequiresPerm = true)]`. Controllerda ochiq/o'quvchi/admin marshrutlari
  aralash bo'lgani uchun atribut **metod darajasida** qo'yilgan.

### Yuz bilan kirish selfilari — `uploads/face/`
- Fayl statik yo'ldan **berilmaydi** (`PrivateFolderFileProvider`), faqat
  `GET /api/admin/face/checks/{id}/image` va `GET /api/admin/face/profile/{studentId}/image`
  (`[AdminPerm("students.face", ReadRequiresPerm = true)]`). DTO'lardagi `imageUrl`/`sampleUrl`
  aynan shu API yo'lini qaytaradi — `/uploads/...` manzili **hech qachon** javobga tushmaydi.
- ⚠️ `Uploads:PublicCertificates=true` favqulodda kaliti bu papkaga **TA'SIR QILMAYDI**: u faqat
  sertifikatlarni ochadi. Biometrik suratni "vaqtincha ochib qo'yish" varianti yo'q.
- Papka kunlik zaxira arxividan ham chiqarilgan (`docker-compose` → `tar --exclude`), sabab
  `DEPLOY.md` §6.1 da.

### Xodim (staff) uchun O'QISH darvozasi
`AdminPermAttribute` da GET/HEAD/OPTIONS xodimga **ataylab ochiq** — bo'limlararo o'qish buzilmasin
(masalan Moliya → o'quvchilar ro'yxati). Lekin nozik HUJJAT qaytaradigan bo'limlarda bu xavfli, shu
sabab ikkita vosita bor:

1. **`[AdminPerm("bolim", ReadRequiresPerm = true)]`** — o'qish uchun ham bo'lim ruxsati talab
   qilinadi. Yoqilgan joylar (u yerda bo'limlararo o'qish kerak emasligi tekshirilgan):
   - `ContractsController` — shartnoma `PdfUrl`/`DocxUrl`
   - `CareerController` — nomzod `CvUrl`
   - `AiCheckController` — o'quvchi ovoz yozuvi `AudioUrl`
2. **Javobni tozalash** — bo'limlararo o'qish HAQIQATAN kerak bo'lgan joyda
   (`StudentsController`: moliya/qabul o'quvchilar ro'yxatini o'qishi kerak). U yerda
   `RedactDocs` `students.list` ruxsati yo'q xodimga `BirthCertificateUrl` (surat) va
   `ParentPassportUrl` (passport skani) manzillarini **bermaydi**; ism/telefon/balans qoladi.
   UI'da surat o'rniga bosh harflar chiqadi — ish buzilmaydi.
   DIQQAT: tozalanadigan endpointlar `AsNoTracking` bo'lishi SHART — aks holda bo'shatilgan
   maydonlar tasodifan bazaga yozilib ketishi mumkin.

Ruxsat qoidasining O'ZI — `Application/Services/PermissionRules.cs` (sof funksiyalar, testlangan:
`PermissionRulesTests`). `AdminPermAttribute` faqat rol tekshiruvini qo'shadi. Nom bo'yicha
adashish yo'q: `"students-arxiv"` ruxsati `"students"` ni ochmaydi.

## Yangi endpoint yozganda tekshiring

- Javobda `/uploads/...` manzili bormi? Bo'lsa — uni ko'rishi mumkin bo'lgan HAR BIR rol shu faylni
  abadiy saqlab qolishga haqlimi?
- Agar yo'q bo'lsa: `ReadRequiresPerm` yoqing, yoki manzilni javobdan tozalang, yoki faylni
  avtorizatsiyalangan download endpoint orqali bering (manzil o'rniga).
- `[AllowAnonymous]` sinf darajasidagi `[Authorize]` va `[AdminPerm]` ni **ham** bekor qiladi.
  `/api/admin/...` yo'lida u hech qachon turmasligi kerak (ilgari `GradingController` da shunday
  xato bor edi — studentId bilan baholash statistikasi login'siz ochiq edi).

## Qatlamlar (kim nimani ko'radi)

1. **Tashqaridagi begona** — `/uploads` dan faqat LOGOTIP va landing sahifasining FAOL rasmlarini
   (o'qituvchi surati, sertifikat) oladi, boshqa hech narsani (404).
2. **Tizimga kirgan foydalanuvchi** — manzilni bilsa faylni oladi. Shuning uchun manzilni
   javobga qo'shishdan oldin "bu rol buni ko'rishi kerakmi" savoli baribir muhim (yuqoridagi
   darvozalar shu uchun).
3. **`uploads/certificates`** — hech kimga statik yo'ldan berilmaydi (hatto adminga ham), faqat
   avtorizatsiyalangan download endpointlari orqali.
