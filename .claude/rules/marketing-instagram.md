---
description: Marketing — Instagram AI sotuv agenti (webhook, OAuth, avtojavob, lidga aylantirish, inbox).
paths:
  - "IntellectCRM.Application/Services/Instagram*.cs"
  - "IntellectCRM.Server/Controllers/InstagramController.cs"
  - "IntellectCRM.Server/Controllers/InstagramWebhookController.cs"
  - "IntellectCRM.Client/src/pages/admin/marketing/**"
  - "IntellectCRM.Client/src/api/services/instagram.ts"
  - "instagram/*.md"
---

# Instagram AI agenti qoidalari

Migratsiya: `AddInstagramAgent`. Modul markazning Instagram **Professional** akkauntiga kelgan
**izohlar** va **DM**larga AI bilan javob beradi va qiziqqan odamni **lidga** aylantiradi.
Bo'lim: **Marketing** (`/admin/marketing`), ruxsat kaliti — **`marketing`**.

Yo'l: **Instagram API with Instagram Login**. Facebook Page, Business Verification va
**App Review — KERAK EMAS** (Standard Access; akkaunt bizniki). Protokol tafsilotlari:
`instagram/TEXNIK.md`, sozlash: `instagram/SOZLASH.md`.

## 1. YAGONA QOIDA: webhook HECH QACHON og'ir ish qilmaydi

**Meta 5 soniya kutadi.** LLM chaqiruvi undan uzoq — kechiksa Meta yetkazishni
muvaffaqiyatsiz deb hisoblaydi va takroriy kechikishda webhookni **o'chirib qo'yadi**.
Shuning uchun **javob va ish AJRATILGAN**:

```
POST /api/public/instagram/webhook
   1) xom body BAYT sifatida o'qiladi (EnableBuffering)
   2) InstagramSignature.Verify  → mos kelmasa 403, body ishlanmaydi
   3) IgWebhookEvent (Status="pending") yoziladi     ← DURABLE navbat, baza jadvali
   4) ══ DARHOL 200 OK ══
                    ↓ har 2 soniyada
InstagramWorkerService → InstagramPipeline.ProcessAsync   ← BUTUN og'ir ish shu yerda
```

⚠️ Controllerga AI chaqiruvi, Graph API so'rovi yoki uzun DB ishi **QO'SHILMAYDI**.
⚠️ Fire-and-forget (`_ = Task.Run(...)`) ham **YARAMAYDI** — nusxa qayta ishga tushsa hodisa
yo'qolardi. Navbat ATAYIN bazada (kesh emas): Inbox suhbat tarixini ko'rsatadi va
restartdan keyin dedup/navbat saqlanib qolishi kerak.

## 2. IMZO TEKSHIRUVI — FAIL-CLOSED

`InstagramSignature.Verify(byte[] rawBody, string? header, string appSecret)`:

| Qoida | Qiymat |
|---|---|
| Nimadan hisoblanadi | **XOM BODY BAYTLARIDAN** — qayta seriyalash/formatlash/trim YO'Q |
| Kalit | `AppSecrets.InstagramAppSecret` (`.env`) |
| Algoritm | HMAC-SHA256, kichik harfli hex, header `sha256=…` |
| Solishtirish | **doimiy vaqtli** (`CryptographicOperations.FixedTimeEquals`), `==` EMAS |
| **App Secret bo'sh** | **`false`** — so'rov RAD ETILADI |

⚠️ **FAIL-OPEN TAQIQLANADI.** Manba loyihada secret bo'sh bo'lsa tekshiruv o'tkazib
yuborilardi ("lokal test qulay bo'lsin") — prodda bu istalgan odam bizning nomimizdan
hodisa yubora oladigan **himoyasiz endpoint** degani. `InstagramSignatureTests` shu xulqni
test bilan qulflaydi — testni "qulaylik uchun" yumshatmang.

⚠️ Body **buferlanmasa** imzo HECH QACHON mos kelmaydi: framework deserializatsiya qilib
bo'lgan obyektni qayta seriyalasak bo'sh joylar va kalit tartibi o'zgaradi. Bu — eng ko'p
uchraydigan xato.

## 3. MODUL O'CHIQ BO'LSA — TASHQARIGA HECH NARSA KETMAYDI

Barcha bayroqlar **default `false`** (entity default'i ham, migratsiya default'i ham —
`books.md` §4 dagi saboq): `InstagramEnabled`, `InstagramAutoReplyComments`,
`InstagramAutoReplyDm`, `InstagramPrivateReplyEnabled`.

- `CenterMeta.InstagramEnabled == false` → `InstagramWorkerService` navbatni umuman
  qayta ishlamaydi, ya'ni **Graph API'ga ham, Gemini'ga ham** so'rov ketmaydi.
- Webhook baribir hodisani **qabul qilib navbatga yozadi** (Meta obunani o'chirib
  qo'ymasin) — u yerda turadi va 30 kunda tozalanadi.

⚠️ Yangi tashqi chaqiruv qo'shsangiz — u ham shu darvozadan o'tsin. "Kichkina bitta so'rov"
sozlanmagan markazda kutilmagan xabar yuborilishiga olib keladi.

## 4. CHEKSIZ HALQADAN HIMOYA — 3 QAVAT, BIRI HAM OLIB TASHLANMAYDI

**Real hodisa:** bot izohga javob yozadi → o'z javobi webhook bo'lib qaytadi → begona izoh
deb hisoblaydi → yana javob yozadi → **cheksiz halqa** → akkaunt spam sifatida bloklanadi.

| Qavat | Mexanizm |
|---|---|
| 1. Identifikatsiya | `from.id` **ikkala** saqlangan ID (`IgAccount.IgUserId` va app-scoped `user_id`) bilan solishtiriladi + zaxira `username` (registr e'tiborsiz) |
| 2. Dedup | bir xil `EventKey` ikkinchi marta ishlanmaydi |
| 3. Avtomat o'chirgich | post bo'yicha 8/10daq · global 30/10daq · `InstagramDailyReplyLimit` |

⚠️ **Uchala identifikator ham saqlanadi** (`id`, `user_id`, `username`) — webhook'da
`from.id` **ba'zan** biri, **ba'zan** ikkinchisi bo'lib keladi. Bittasiga tayanish —
yuqoridagi halqaning aynan sababi.

DM tomonida ekvivalenti: `message.is_echo == true` bo'lsa **hech qachon** javob yozilmaydi.

## 5. DEDUP KALITI DETERMINISTIK BO'LISHI SHART

| Hodisa | `EventKey` |
|---|---|
| Izoh | `comment:{comment_id}` |
| DM | `dm:{message.mid}` |
| Echo | `echo:{message.mid}` |
| Ikkalasi yo'q | `sender + timestamp + matn` ning **barqaror kriptografik hash**i |

⚠️ **`GetHashCode()`, `Random`, `Guid` yoki jarayonga bog'liq har qanday qiymat
TAQIQLANADI.** Manba loyihada DM kaliti runtime hash'dan qurilar — restartdan keyin kalit
o'zgarardi va dedup **umuman ishlamasdi**. `InstagramEventParserTests` bir xil payload
ikki marta parse qilinganda bir xil kalit chiqishini tekshiradi.

`IgWebhookEvent.EventKey` — **UNIKAL indeks**: bir vaqtda kelgan ikki bir xil webhook ham
to'g'ri filtrlanadi (ikkinchisi `skipped`).

**Nega majburiy:** Meta muvaffaqiyatsiz yetkazishni **36 soat** qayta yuboradi va kafolat
"at-least-once" — dedupsiz mijoz bir savolga bir necha xil javob olardi.

## 6. LID — `LeadIntake` orqali, FIRST-TOUCH qoidasi bilan

Instagram lidi **mavjud `Lead` moduliga** tushadi (`InstagramLeadBridge.UpsertAsync`),
`Source = CenterMeta.InstagramLeadSource` (default `"Instagram"`).

⚠️ **`ContactRequest` EMAS:** "Bog'lanish kerak" — mavjud O'QUVCHI bilan bog'lanish navbati;
Instagram'dan **yangi mijoz** keladi, u lidlar voronkasiga tushadi (kanban, bosqichlar,
konversiya allaqachon bor). Parallel `InstagramLead` jadvali ham **yaratilmaydi**.

| Qoida | Tafsilot |
|---|---|
| Dublikat | telefon bo'lsa `LeadIntake.FindByPhoneAsync` orqali qidiriladi |
| `conv.LeadId` bor | **yangi lid yaratilmaydi** — mavjudi yangilanadi, `RepeatCount++`, `LeadEvent` yoziladi |
| **`Lead.Source` va `Lead.Stage`** | mavjud lidda **O'ZGARMAYDI** (first-touch: birinchi murojaat manbasi saqlanadi) |
| `Lead.PhoneKey` | **qo'lda yozilmaydi** — `AppDbContext.SaveChanges` o'zi to'ldiradi (`crm-leads.md`) |
| Telefonsiz qaynoq lid | baribir yoziladi: `FullName = "@username (Instagram)"` |
| Har suhbat lid bo'lmaydi | `InstagramContract.ShouldCreateLead` = `IsHot || kontakt bor`. Salom-alik va spam CRM'ni ifloslantirmaydi |

⚠️ Izoh va DM'da ID formatlari farq qilishi mumkin — lid dedup **faqat** `IgUserId` ga
tayanmasin (telefon + `conv.LeadId` birga ishlaydi), aks holda bir mijoz uchun **ikki lid**
paydo bo'ladi.

## 7. TOKEN VA MAXFIY QIYMATLAR

| Qiymat | Qayerda | Nega |
|---|---|---|
| `INSTAGRAM_APP_SECRET` | **`.env`** (`AppSecrets`) | maxfiy — baza dump'i Telegram'ga yuboriladi |
| `INSTAGRAM_VERIFY_TOKEN` | **`.env`** (`AppSecrets`) | xuddi shunday |
| `IgAccount.AccessToken` | **BAZADA** | ATAYIN chekinish: token OAuth orqali ISH VAQTIDA olinadi, `.env` ga yozib bo'lmaydi |
| `CenterMeta.InstagramAppId` va qolgan 10 sozlama | **BAZADA** (UI'dan) | maxfiy emas |

⚠️ **Token/secret HECH QACHON javobga, DTO'ga, auditga yoki logga tushmaydi.** `GET /status`
faqat holat qaytaradi: `appIdSet`, `appSecretSet`, `verifyTokenSet`, `tokenDaysLeft`,
`connected`. Qiymatning o'zi emas.

⚠️ **`.env` ga yozish YETARLI EMAS** (2026-08-14 da aynan shu tufayli modul ulanmagan edi):
prod `app` servisida `env_file` YO'Q, shuning uchun kalit `docker-compose.yml` dagi
`environment:` ro'yxatiga ham qo'yilishi SHART (`Instagram__AppSecret` / `Instagram__VerifyToken`).
Bo'lmasa `AppSecrets` bo'sh qiymat o'qiydi va webhook fail-closed bo'lib **403** qaytaradi —
tashqaridan bu "Meta tasdiqlamayapti" bo'lib ko'rinadi. `EnvKeysWiringTests` shuni qulflaydi.

⚠️ **Meta konsolida webhook maydoni ham «Callback URL» deb ataladi** — u yerga
`…/api/public/instagram/**webhook**` qo'yiladi. `…/callback` — bu OAuth qaytish manzili, faqat
"Valid OAuth Redirect URIs" uchun; webhook maydoniga qo'yilsa Meta 302 oladi va tasdiqlamaydi.

**Token hayoti:** uzoq token ~60 kun; `InstagramWorkerService` kuniga bir marta tekshiradi
va muddatiga **< 15 kun** qolganda (`IgConst.TokenRefreshDays = 45`) yangilaydi.
Muvaffaqiyatsiz bo'lsa — **Telegram alert**, jim yiqilmaydi.

## 8. RUXSAT — `marketing`

`InstagramController`: `[AdminPerm("marketing", ReadRequiresPerm = true)]`.

⚠️ `ReadRequiresPerm = true` ATAYIN: javobda mijoz suhbatlari, ismlari va **telefonlari**
bor. `AdminPermAttribute` da GET odatda har qanday xodimga ochiq (bo'limlararo o'qish
uchun), bu yerda bo'lmaydi (`uploads-security.md` dagi `ContractsController`/`CareerController`
bilan bir xil mantiq).

`InstagramWebhookController` — **`[AllowAnonymous]`**, `api/public/instagram` yo'lida.
⚠️ `[AllowAnonymous]` **hech qachon** `api/admin/...` yo'lida turmasin. Uchta marshrut
(`GET /webhook`, `POST /webhook`, `GET /callback`) himoyalanadi: webhook — HMAC imzo,
callback — bir martalik `IgOAuthState` (15 daqiqa).

⚠️ **`POST /simulate` va `POST /test-agent` — ADMIN tomonda, `marketing` ruxsati ostida.**
Manba loyihada diagnostika endpointlari **autentifikatsiyasiz** edi: tashqi odam bizning
nomimizdan xabar yubortirishi va LLM tokenimizni yeyishi mumkin edi.

Yozish amallari `can('marketing','edit')` bilan darvozalangan. `constants.ts` O'ZGARMAYDI —
`marketing` kaliti allaqachon bor, yangi kalit qo'shilmaydi.

## 9. AUDIT — `EntityType = "Instagram"`

`AuditSections.ByEntityType` da `"Instagram" → "marketing"` ("Marketing" bo'limi).
Yoziladi: akkauntni **ulash/uzish**, sozlamalarni o'zgartirish, qoida yaratish/tahrir/
o'chirish, bilim bazasini saqlash, **operator javobi**, qo'lda lidga aylantirish.

⚠️ Token va App Secret **auditga yozilmaydi** (`audit.md` §1).
⚠️ Yangi `audit.Record` qo'shsangiz — savol: *"bu amaldan keyin tarixda BITTA qator paydo
bo'ladimi — har doim?"* (`audit.md` §3.5).

**ATAYIN yozilmaydi:** botning avtomatik javoblari — ular `IgMessage` sifatida suhbat
lentasida allaqachon ko'rinadi va har javobni auditga yozish tarixni ko'mib tashlardi.

## 10. AI — narx O'YLAB TOPILMAYDI

`InstagramAgentService` mavjud **`GeminiService`** dan foydalanadi (yangi provayder = yangi
kalit = yangi billing). Model — `CenterMeta.InstagramAiModel`, bo'sh bo'lsa loyiha default'i.

| Qoida | Tafsilot |
|---|---|
| **Faqat bilim bazasidan** | narx/shart bilim bazasida yo'q bo'lsa taxmin qilinmaydi: `EscalateToHuman = true` |
| **Til va yozuv** | mijoz qaysi tilda va **yozuvda** yozsa AYNAN o'shanda javob (kirill/lotin/rus/ingliz) |
| **Spamga qarshi xilma-xillik** | bir xil shablon takrorlansa Instagram uni **spam** deb belgilaydi |
| **Operatorga o'tish** | "operator"/"odam" so'ralsa darhol eskalatsiya; majburlash **taqiqlangan** (platforma talabi) |
| **Bot oshkorligi** | birinchi xabarga `CenterMeta.InstagramGreeting` qo'shiladi (Meta talabi) |
| Uzunlik | ochiq izohga 1–2 gap; DM'da batafsilroq + telefon so'rash |

⚠️ Enum qiymatlari **bir joyda** — `IgConst.Intents` / `IgConst.Languages`. Manba loyihada
mock `price_inquiry`, sxemada `price_question` edi — mos kelmagani sezilmay qolgan.

⚠️ Strukturali chiqish sxemasida `minLength`/`minimum`/`maximum` **ISHLATILMAYDI** (sxema
rad etiladi). Diapazon kod tomonda: `ClampScore` (0..100), `NormalizeIntent` (→ `other`),
`NormalizeLanguage` (→ `uz-Latn`).

⚠️ AI javob bermasa (`ParseOutput` → `null`) pipeline **jonli javob YUBORMAYDI**. "Xato
bo'lsa umumiy matn yozib qo'yaylik" — **qilinmaydi**: mijozga mazmunsiz javob yuborishdan
ko'ra operatorga signal berish yaxshiroq.

## 11. TUZOQLAR (kod yozayotganda)

| # | Tuzoq | Qoida |
|---|---|---|
| 1 | `hub.mode` da **nuqta** bor — model binding ololmaydi | `Request.Query["hub.mode"]` bilan **qo'lda** o'qiladi; javob **`text/plain`** xom challenge (JSON emas) |
| 2 | DM hodisasi `changes[]` da EMAS | `entry[].messaging[]`; ikkala massiv bitta `entry` ichida bo'lishi mumkin — parser **ikkalasini** ko'radi |
| 3 | **24 soat oynasi** | `DmWindowOpen` yuborishdan OLDIN. Yopiq bo'lsa so'rov ketmaydi, `NeedsOperator = true` + sabab. Operator qo'lda javobida ham shu tekshiruv (400) |
| 4 | **Private reply — 7 kun, BIR MARTA** | takroriy yuborish xato beradi; yuborilgani `IgMessage` (`Channel="private_reply"`) sifatida yoziladi |
| 5 | **Echo = operator pauzasi** | `is_echo` — javob berish uchun emas, botni **jim qildirish** uchun. Iz topilmasa → odam yozgan → `OperatorPausedUntil` (`IgConst.OperatorPauseMinutes` = **720 daqiqa = 12 soat**, yagona manba). Muddat tugasa bot O'ZI qaytadi; darhol qaytarish — «Botga qaytarish» tugmasi |
| 6 | Webhook'da DM'da **username YO'Q** | faqat `sender.id`; username profil so'rovidan olinadi |
| 7 | Matnsiz xabar (rasm/stiker/ovoz) | jimgina tashlanmaydi — `NeedsOperator = true` |
| 8 | `mentions`, `live_comments` | ishlanmaydi, lekin **logga yoziladi** |
| 9 | `graph.facebook.com` | **YO'Q** — `IgConst.GraphBase` (`graph.instagram.com/v23.0`). Xom satr yozmang |
| 10 | `redirect_uri` | Meta'dagi bilan **harfma-harf** bir xil, oxirida `/` yo'q; `[2]` va `[4]` da ham bir xil |
| 11 | Kod javobi `data[]` massivida | `ExchangeCodeAsync` parseri — obyekt emas, massiv |
| 12 | `DateTime.Now` | **TAQIQLANGAN** — `AppClock.Now` / `AppClock.Iso()` |
| 13 | Telegram bildirishnomasi | xatosi **jim yutiladi** (`LeadNotifier`/`BookSalesService` bilan bir xil siyosat) — bildirishnoma javobni buzmasin |

**Xatolarga chidamlilik:** har bosqich alohida `try/catch`. Yordamchi tizim yiqilsa
(dedup, tarix, lid, Telegram) — **asosiy vazifa, mijozga javob berish, baribir bajariladi**.
Yagona istisno: **AI javobi** yiqilsa oqim to'xtaydi (yuboradigan narsa yo'q).

## 12. NIMA ATAYIN QILINMAGAN

| Narsa | Nega |
|---|---|
| **Alohida mikroservis / konteyner / Redis** | Instagram — bitta ASP.NET Core ilova ichidagi **modul**. Yangi konteyner deploy va zaxirani murakkablashtirardi; holat (navbat, dedup, tarix, pauza) mavjud bazada |
| **Alohida Telegram bot** | mavjud `TelegramService` ishlatiladi (kitob buyurtmasi bildirishnomasi bilan bir xil naqsh) |
| **Yangi ruxsat kaliti** (`instagram`) | `marketing` allaqachon bor |
| **Parallel lead/lead_events jadvallari** | mavjud `Lead` + `LeadEvent` (§6) |
| **Yangi lid bosqichi lug'ati** | mavjud bosqichlar ishlatiladi (`crm-leads.md`) |
| **Moliya bilan bog'liqlik** | modul `FinanceTransaction`ga yozmaydi va balansga tegmaydi (`books.md` §7 bilan bir xil sabab) |
| **Bir necha akkaunt UI'si** | hozircha bitta akkaunt; jadval ko'p qatorga tayyor (kelajakda filial) |
| **Instagram'dan birinchi bo'lib yozish** | platforma ruxsat bermaydi (24 soat oynasi) |
| **Xotiradagi kunlik statistika** | restartda nolga tushardi — analitika **bazadan** (`GET /analytics`) |

## 13. Frontend

**Marketing bo'limi FAQAT Instagram bo'ladi** — eski mock sahifalar (`MarketingDashboard`,
`MarketingInbox`, `MarketingRules`, `MarketingChannels`, `MarketingAi`, `MarketingAnalytics`)
o'chirilgan, `mk.tsx` qoladi (mock ma'lumotsiz, `ChannelId` faqat `'instagram'`).

| Sahifa | Yo'l |
|---|---|
| Boshqaruv paneli | `/admin/marketing` |
| Inbox | `/admin/marketing/inbox` |
| Javob qoidalari | `/admin/marketing/rules` |
| Bilim bazasi | `/admin/marketing/knowledge` |
| Analitika | `/admin/marketing/analytics` |
| Sozlamalar | `/admin/marketing/settings` |

Holat boshqaruvi — `useState`/`useEffect` + axios (loyiha uslubi, TanStack Query YO'Q).
API klienti — `src/api/services/instagram.ts` (`books.ts` uslubida).

⚠️ **Sozlamalar sahifasi maxfiy qiymatni KO'RSATMAYDI** — faqat "sozlangan / sozlanmagan".
Webhook URL va Callback URL **nusxa olish** tugmasi bilan turadi (Meta'ga qo'lda kiritiladi,
harfma-harf mos bo'lishi shart).

⚠️ **Analitika grafiklari** `course-analytics.md` qoidasiga bo'ysunadi: `#0284c7` / `#e11d48`,
**yashil/qizil juftlik ISHLATILMAYDI** (deuteranopiyada ajralmaydi), ikki o'lchov bitta
grafikda **ikki y-o'q bilan ko'rsatilmaydi**.

## 14. Meta platforma talablari

| Talab | Bajarilishi |
|---|---|
| Bot ekanini oshkor qilish | birinchi xabarga `InstagramGreeting` |
| Operatorga o'tish yo'li | "operator"/"odam" → darhol eskalatsiya |
| Maxfiylik siyosati | **ochiq** (login talab qilmaydigan) marshrut `/privacy` |
| Ma'lumotni o'chirish | **ochiq** marshrut `/data-deletion` |

⚠️ Bu ikki sahifa SPA'da ochiq marshrut, lekin **hech qanday CRM ma'lumotini
KO'RSATMAYDI** — faqat: qaysi ma'lumot yig'iladi (username, ID, xabar matni), nima
yig'ilmaydi, kim bilan bo'lishiladi, qanday o'chiriladi.

## 15. Testlar

`IntellectCRM.Tests/Instagram*Tests.cs`:

| Test | Nimani qulflaydi |
|---|---|
| `InstagramSignatureTests` | to'g'ri/noto'g'ri imzo, **bo'sh secret → `false`**, verify challenge |
| `InstagramEventParserTests` | izoh/DM/echo payloadlari, buzuq JSON → bo'sh ro'yxat, **dedup kalitining deterministikligi**, o'z izohini tashlash |
| `InstagramContractTests` | `ClampScore`, `Normalize*`, `DmWindowOpen`, `OperatorPaused`, `ExtractPhone` |
| `InstagramAgentServiceTests` | `ParseOutput` — markdown fence, buzuq JSON, noma'lum enum |
| `InstagramLeadBridgeTests` | yangi lid, mavjud lid (**first-touch**: `Source`/`Stage` o'zgarmaydi), telefonsiz qaynoq lid, `conv.LeadId` bo'lsa takror yaratmaslik |
| `InstagramPipelineTests` | soxta webhook uchdan-uchgacha |

⚠️ Sof funksiyalar (`InstagramContract`, `InstagramSignature`, `InstagramEventParser`,
`BuildSystemPrompt`, `ParseOutput`) ATAYIN HTTP va DB'dan ajratilgan — aynan shular
testlanadi (`tests.md` uslubi).
