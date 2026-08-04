# `/uploads` xavfsizlik modeli

Yuklangan barcha fayllar bitta TEKIS papkada: `ContentRoot/uploads`. U docker volume
(`uploads:/app/uploads`) va tungi zaxiraga kiradigan **yagona** papka — shuning uchun fayllarni
undan chiqarish (ko'chirish) zaxiradan tushib qolish degani.

## Asosiy haqiqat: `/uploads` AUTENTIFIKATSIYASIZ beriladi

`Program.cs` da `UseStaticFiles(RequestPath = "/uploads")` — manzilni bilgan har kim **login'siz**
oladi. Buni oddiy `[Authorize]` bilan yopib bo'lmaydi: loyihada JWT Bearer (cookie YO'Q), brauzer
esa `<img src="/uploads/...">` ga `Authorization` sarlavhasini yubormaydi.

**Shundan kelib chiqadigan qoida — HAR SAFAR eslang:**

> `/uploads/...` manzilini bir marta olgan odam faylni **ABADIY** oladi — tizimdan chiqarilsa ham,
> ishdan bo'shatilsa ham, guruhdan olib tashlansa ham. Ya'ni manzilni bergan joy = ruxsatni
> BUTUNLAYGA bergan joy.

Shu sabab yangi endpoint yozganda savol "kim ko'rishi mumkin" emas, **"kim abadiy saqlab qolishi
mumkin"** bo'lishi kerak.

## Hozirgi himoya qatlamlari

| Qatlam | Nima beradi |
|---|---|
| Fayl nomi `Guid.NewGuid():N` (`UploadGuard.SafeName`) | 128 bit tasodifiylik — taxmin qilib topib bo'lmaydi. Asl nom (`ali-passport.pdf`) hech qachon saqlanmaydi |
| Katalog ro'yxati o'chiq | `UseDirectoryBrowser` yo'q; fayl nomlarini ro'yxatlaydigan endpoint ham yo'q |
| `Referrer-Policy: no-referrer` | Manzil "Referer" orqali tashqi saytga sizib chiqmaydi |
| `Cache-Control: private` | Cloudflare/proxy umumiy keshida saqlanmaydi |
| `PrivateFolderFileProvider` | `uploads/certificates` STATIK yo'l bilan berilmaydi (qarang: `tests.md`) |

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
  `[AdminPerm("students", ReadRequiresPerm = true)]`. Controllerda ochiq/o'quvchi/admin marshrutlari
  aralash bo'lgani uchun atribut **metod darajasida** qo'yilgan.

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
   `RedactDocs` `students` ruxsati yo'q xodimga `BirthCertificateUrl` (surat) va
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

## Hali OCHIQ (bilib turilgan qaror)

O'quvchi suratlari, kitob muqovalari, dars PDF'lari — `<img>`/`<iframe>` da kerak, shuning uchun
`/uploads` da ochiq qoladi. Ularni yopish yo'li: login'da `Path=/uploads` cookie qo'yib, papkani
cookie/token bilan darvozalash. Bunda mobil ilovalar ham yangilanishi kerak, shuning uchun avval
"faqat log yozadigan" rejimda o'lchash tavsiya etiladi.
