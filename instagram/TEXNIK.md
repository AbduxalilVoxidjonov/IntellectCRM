# Instagram AI agenti — PROTOKOL MA'LUMOTNOMASI

> Bu hujjat **protokol shartnomasi**: qaysi so'rov qayerga ketadi, qanday javob keladi,
> qanday qoidalar buziladi. Har bo'lim **bizning kod nomlariga** bog'langan.
>
> Baza URL: **`https://graph.instagram.com/v23.0`** (`IgConst.GraphBase`).
> ⚠️ `graph.facebook.com` **EMAS** — Instagram Login yo'lida boshqa host.

Sozlash qo'llanmasi: [`SOZLASH.md`](SOZLASH.md) · Modul haqida: [`README.md`](README.md)

---

## 1. OAuth zanjiri

```
[1] CRM → «Instagram'ni ulash»            GET  /api/admin/instagram/connect-url
      │   IgOAuthState yaratiladi (bir martalik, 15 daqiqa)
      │   InstagramApi.BuildAuthorizeUrl(appId, redirectUri, state)
      ▼
[2] GET https://www.instagram.com/oauth/authorize?...      ← Instagram login oynasi
      │   foydalanuvchi «Allow» bosadi
      ▼
[3] GET /api/public/instagram/callback?code=AQB...&state=…  ← kod (1 soat, 1 marta)
      ▼
[4] POST https://api.instagram.com/oauth/access_token       InstagramApi.ExchangeCodeAsync
      ▼   qisqa token (1 soat)
[5] GET  https://graph.instagram.com/access_token           InstagramApi.ExchangeLongLivedAsync
      ▼   UZOQ token (~60 kun)
[6] GET  {GraphBase}/me?fields=id,user_id,username,…        InstagramApi.MeAsync
      ▼
[7] POST {GraphBase}/me/subscribed_apps                     webhook obunasi
      ▼
[8] IgAccount ga saqlanadi → /admin/marketing/settings?connected=1 ga redirect
```

### 1.1. `[2]` Authorize URL

```
GET https://www.instagram.com/oauth/authorize
```

| Parametr | Majburiy | Qiymat |
|---|---|---|
| `client_id` | ha | `CenterMeta.InstagramAppId` |
| `redirect_uri` | ha | Meta'da ro'yxatga olingan manzil bilan **aynan** bir xil (oxirida `/` yo'q) |
| `response_type` | ha | `code` |
| `scope` | ha | vergul bilan (quyida) |
| `state` | biz qo'yamiz | `IgOAuthState.Id` — CSRF himoyasi, callbackda tekshiriladi |

**Scope'lar:**

```
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
```

⚠️ Bular **Instagram Login** nomlari. Eski `instagram_manage_comments`,
`pages_manage_metadata`, `pages_read_engagement` — **Facebook Login** yo'liga tegishli,
bizga kerak emas.

**Javob:** `redirect_uri?code=<AUTH_CODE>#_` — URL oxiridagi `#_` fragmenti kesib
tashlanadi. Kod: **1 soat**, **bir marta**.

### 1.2. `[4]` Kod → qisqa token — `ExchangeCodeAsync`

```
POST https://api.instagram.com/oauth/access_token
Content-Type: application/x-www-form-urlencoded

client_id, client_secret, grant_type=authorization_code, redirect_uri, code
```

Javob:
```json
{ "data": [ { "access_token": "IGAA…", "user_id": "1784140…", "permissions": "…" } ] }
```

⚠️ Javob **`data[]` massivi ichida**, to'g'ridan-to'g'ri obyekt EMAS. `ExchangeCodeAsync`
parseri shuni hisobga oladi.

### 1.3. `[5]` Qisqa → uzoq token — `ExchangeLongLivedAsync`

```
GET https://graph.instagram.com/access_token
      ?grant_type=ig_exchange_token&client_secret=…&access_token=<QISQA>
```
Javob: `{ "access_token": "IGAA…", "token_type": "bearer", "expires_in": 5183944 }`
→ ≈ **60 kun**.

### 1.4. `[6]` O'z akkauntimizni aniqlash — `MeAsync`

```
GET {GraphBase}/me?fields=id,user_id,username,account_type&access_token=<UZOQ>
```

**Uchala identifikatorni ham saqlash SHART:**

| Maydon | Nima uchun |
|---|---|
| `id` | akkauntning o'z ID'si |
| `user_id` | app-scoped ID (IGSID) |
| `username` | zaxira — ID formatidan qat'i nazar ishlaydi |

⚠️ **SABAB (real hodisa, kritik):** webhook'da `from.id` **ba'zan** akkauntning `id`si,
**ba'zan** app-scoped `user_id` bo'lib keladi. Bittasiga tayanilsa bot o'z izohini begona
deb hisoblaydi va **cheksiz javob halqasiga** tushadi — akkaunt spam sifatida bloklanishi
mumkin. `InstagramEventParser.Parse(rawJson, ourIgUserId)` **ikkala** ID ni ham, zaxira
sifatida username'ni ham solishtiradi.

### 1.5. `[7]` Webhook obunasi

```
POST {GraphBase}/me/subscribed_apps
      ?subscribed_fields=comments,messages,message_echoes&access_token=<UZOQ>
```

`message_echoes` **ataylab** — operator pauzasi shunga tayanadi (§5.3).

### 1.6. Token yangilash — `RefreshTokenAsync`

```
GET https://graph.instagram.com/refresh_access_token
      ?grant_type=ig_refresh_token&access_token=<JORIY_UZOQ>
```
Javob: yangi `access_token` + `expires_in` (yana ~60 kun).

**Siyosat (`InstagramWorkerService`, 2-vazifa):**

| Qoida | Qiymat | Sabab |
|---|---|---|
| Tekshirish davri | **kuniga bir marta** | fon vazifasi |
| Yangilash chegarasi | `IgConst.TokenRefreshDays = 45` (muddatiga **< 15 kun** qolganda) | 15 kunlik zaxira qoladi |
| Xato bo'lsa | **Telegram alert** ("akkauntni qayta ulang") | jim yiqilmasin |

⚠️ Ilova bir necha nusxada ishlasa yangilash **bitta** nusxada bajarilishi kerak. Bizda
ilova bitta nusxada ishlaydi — bu holat kuzatilsin.

---

## 2. Webhook

### 2.1. `GET /api/public/instagram/webhook` — Meta verify

```
GET …/webhook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=<BIZNIKI>
```

`InstagramSignature.VerifyChallenge(mode, token, challenge, verifyToken)`:

| Shart | Javob |
|---|---|
| `mode == "subscribe"` VA token mos | `200` + **`challenge` XOM MATN** (`text/plain`, JSON emas, qo'shtirnoqsiz) |
| Aks holda | `403` |

⚠️ Query parametr nomida **nuqta** bor (`hub.mode`) — model binding buni ololmaydi.
`Request.Query["hub.mode"]` bilan **qo'lda** o'qiladi.

### 2.2. `POST /api/public/instagram/webhook` — hodisa qabul qilish

**Ketma-ketlik QAT'IY:**

1. **Xom body**ni `byte[]` sifatida o'qish (`EnableBuffering`, deserializatsiyadan OLDIN);
2. `InstagramSignature.Verify(rawBody, header, appSecret)` — mos kelmasa **403**;
3. `IgWebhookEvent` (`Status = "pending"`, `RawJson`, `EventKey`) yozish;
4. **DARHOL `200 OK`**.

⚠️ **META 5 SONIYA KUTADI.** LLM chaqiruvi undan uzoq davom etadi. Kechiksa Meta
yetkazishni muvaffaqiyatsiz deb hisoblaydi va takroriy kechikishda webhookni **o'chirib
qo'yishi** mumkin. Shuning uchun **javob va ish AJRATILGAN**: HTTP handler faqat imzo
tekshirib, navbatga yozib, 200 qaytaradi. Butun og'ir ish —
`InstagramWorkerService` → `InstagramPipeline.ProcessAsync`.

⚠️ Muvaffaqiyatsiz yetkazishni Meta **36 soat** davomida kamayib boruvchi chastota bilan
qayta yuboradi → **dedup MAJBURIY** (§5.2).

### 2.3. `X-Hub-Signature-256` — `InstagramSignature.Verify`

| Savol | Javob |
|---|---|
| Nimadan hisoblanadi? | **XOM (raw) BODY BAYTLARIDAN** — qayta seriyalash, formatlash, trim YO'Q |
| Kalit | `INSTAGRAM_APP_SECRET` (`AppSecrets.InstagramAppSecret`) |
| Algoritm | HMAC-SHA256, natija **kichik harfli hex** |
| Header formati | `sha256=a1b2c3…` |
| Solishtirish | **doimiy vaqtli** (timing attack'ga qarshi) — oddiy `==` EMAS |
| App Secret bo'sh bo'lsa | **`false`** — so'rov rad etiladi |

⚠️ **ENG KO'P UCHRAYDIGAN XATO:** framework body'ni allaqachon deserializatsiya qilgan
bo'ladi va biz uni **qayta seriyalab** HMAC hisoblaymiz — bo'sh joylar/kalit tartibi
o'zgargani uchun imzo **hech qachon** mos kelmaydi. Body **buferlanadi**, xom baytlar
ushlab qolinadi.

⚠️ **FAIL-OPEN TAQIQLANADI.** Manba loyihada App Secret bo'sh bo'lsa imzo tekshiruvi
**o'tkazib yuborilardi** (lokal test uchun) — bu prodda himoyasiz endpoint degani.
Bizda `Verify` bunday holatda **`false`** qaytaradi (**FAIL-CLOSED**), `InstagramSignatureTests`
buni test bilan qulflaydi.

### 2.4. POST payload — IZOH (`comments`)

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "time": 1754990000,
    "changes": [{
      "field": "comments",
      "value": {
        "id": "17900000000000000",
        "text": "Qancha turadi?",
        "timestamp": "2026-08-12T09:15:00+0000",
        "from": { "id": "17841411111111111", "username": "ali_valiyev" },
        "media": { "id": "17840000000000000", "media_product_type": "FEED" },
        "parent_id": "17899999999999999"
      }
    }]
  }]
}
```

| Maydon | Ma'no | `IgIncomingEvent` da |
|---|---|---|
| `changes[].field` | `comments` | faqat shu ishlanadi |
| `value.id` | **comment_id** — javob va dedup kaliti | `CommentId` |
| `value.text` | izoh matni | `Text` (bo'sh bo'lsa hodisa tashlanadi) |
| `value.from.id` / `.username` | kim yozdi | `SenderId` / `Username` |
| `value.media.id` | qaysi post | `MediaId` (caption `GetMediaAsync` bilan olinadi) |
| `value.parent_id` | ota izoh | ishlatilmaydi, bo'lmasligi mumkin |

⚠️ `media_product_type`, `parent_id` har doim kelmaydi — **nullable**. `from` obyekti
umuman bo'lmasligi mumkin (o'chirilgan akkaunt) — parser buzilmasin, hodisa tashlansin.

⚠️ `field` qiymatlari `mentions`, `live_comments` ham bo'lishi mumkin — ular ishlanmaydi,
lekin **logga yoziladi** (jimgina yo'qolmasin).

### 2.5. POST payload — DM (`messages`)

```json
{
  "object": "instagram",
  "entry": [{
    "id": "17841400000000000",
    "messaging": [{
      "sender":    { "id": "17841411111111111" },
      "recipient": { "id": "17841400000000000" },
      "timestamp": 1754990000000,
      "message": { "mid": "aWc6…", "text": "Kurs narxi qancha?" }
    }]
  }]
}
```

⚠️ **DM hodisasi `changes[]` da EMAS, `entry[].messaging[]` da.** Ikkala massiv bitta
`entry` ichida bo'lishi mumkin — `InstagramEventParser.Parse` **ikkalasini ham** ko'radi.

⚠️ Webhook `messaging[]` da **username KELMAYDI**, faqat `sender.id`. Username §3.5 dagi
profil so'rovidan olinadi.

**ECHO** — `message.is_echo == true` bo'lsa xabar **bizdan** chiqqan
(`IgIncomingEvent.Kind = "echo"`, `IsEcho = true`). Ikki manbasi bor — §5.3.

**Matnsiz xabarlar** (rasm, stiker, ovoz, reaksiya, `read`/`delivery`) — javob yozilmaydi,
lekin **suhbatda `NeedsOperator` belgilanadi**: "matnsiz xabar keldi". Manba loyihada
ular jimgina tashlanardi va mijoz javobsiz qolib, buni hech kim bilmasdi.

---

## 3. Graph API amallari — `InstagramApi`

Autentifikatsiya: har so'rovda `access_token` (`IgAccount.AccessToken`).

### 3.1. Izohga OCHIQ javob — `ReplyToCommentAsync`

```
POST {GraphBase}/{comment-id}/replies
Content-Type: application/x-www-form-urlencoded

message=<javob matni>&access_token=<TOKEN>
```
Javob: `{ "id": "1790…" }` — yaratilgan javob izohining ID'si.

### 3.2. PRIVATE REPLY (izohga shaxsiy DM) — `SendPrivateReplyAsync`

```
POST {GraphBase}/me/messages
Content-Type: application/json

{ "recipient": { "comment_id": "17900000000000000" },
  "message":   { "text": "…" } }
```

**QAT'IY CHEKLOVLAR:**

| Qoida | Qiymat |
|---|---|
| Muddat | izohdan **7 kun** ichida (`IgConst.PrivateReplyDays`) |
| Soni | **har izoh uchun FAQAT BIR MARTA** |
| Manzil | `recipient.id` emas, **`recipient.comment_id`** |

⚠️ Ikkinchi marta yuborish xato beradi. Yuborilgan private reply'lar `IgMessage`
(`Channel = "private_reply"`, `CommentId`) sifatida yoziladi — takroriy webhook (Meta 36
soat retry qiladi) xato oqimini keltirib chiqarmasin.

### 3.3. Oddiy DM — `SendDmAsync`

```
POST {GraphBase}/me/messages
Content-Type: application/json

{ "recipient": { "id": "<IGSID>" }, "message": { "text": "…" } }
```

**24 SOATLIK OYNA — eng muhim qoida:**

> *"Your app has **24 hours** to respond to any message sent from an Instagram user."*

| Holat | Ruxsat |
|---|---|
| Mijoz **24 soat ichida** yozgan | DM yuborish MUMKIN |
| 24 soat o'tgan | DM **rad etiladi** — oyna yopiq |
| Mijoz hech qachon yozmagan | DM yuborib **bo'lmaydi** (birinchi bo'lib biz yoza olmaymiz) |

Matn cheklovi: **UTF-8, ≤ 1000 bayt**.

⚠️ Bizda oyna **yuborishdan OLDIN** tekshiriladi:
`InstagramContract.DmWindowOpen(conv.LastInboundAt, AppClock.Now)` (`IgConst.DmWindowHours = 24`).
Yopiq bo'lsa so'rov **umuman ketmaydi**, suhbat `NeedsOperator = true` + sabab bo'ladi va
operatorga signal beriladi. Manba loyihada oyna kuzatilmasdi: so'rov xato berardi, log'da
qolardi, **mijoz javobsiz qolardi va hech kim bilmasdi**.

Operator qo'lda javob yozganda ham (`POST /conversations/{id}/reply`) shu tekshiruv
ishlaydi — oyna yopiq bo'lsa **400** aniq matn bilan qaytadi.

### 3.4. Media (post) ma'lumoti — `GetMediaAsync`

```
GET {GraphBase}/{media-id}?fields=id,caption,media_type,media_url,permalink,timestamp
```
Kerakligi — **`caption`**: LLM'ga "mijoz qaysi post ostida yozdi" konteksti (300 belgigacha
qisqartiriladi).

### 3.5. Foydalanuvchi profili

```
GET {GraphBase}/{igsid}?fields=name,username,profile_pic,follower_count,
                               is_user_follow_business,is_business_follow_user
```

⚠️ `instagram_business_basic` doirasida ishlaydi, lekin **barcha maydonlar har doim
qaytmaydi** (mijoz maxfiylik sozlamasiga qarab) — har maydon nullable deb qaralsin.
**DM oqimida `username` aynan shu yerdan olinadi** (webhook'da yo'q).

### 3.6. Xato javoblari va siyosat

```json
{ "error": { "message": "…", "type": "OAuthException",
             "code": 190, "error_subcode": 463, "fbtrace_id": "A1b2C3" } }
```

`InstagramApi` bu xatoni **o'zbekcha** matnga aylantiradi va tuple'ning `Error` maydonida
qaytaradi (istisno otilmaydi):

| Kod | Ma'nosi | Nima qilinadi |
|---|---|---|
| `190` | token yaroqsiz/muddati o'tgan | **retry YO'Q** — "Token muddati tugagan yoki bekor qilingan — akkauntni qayta ulang" + Telegram alert |
| `4`, `17`, `32`, `613` | rate limit (app/user/custom) | backoff bilan retry, so'ng navbatga qaytariladi |
| `10`, `200` | ruxsat (permission) yetishmaydi | retry YO'Q — scope masalasi, operatorga signal |
| `429` | throttling | 3 marta retry: **1s → 2s → 4s** |
| `500`, `503` | Meta tomonida vaqtinchalik | xuddi shunday retry |
| `100` | noto'g'ri parametr | retry YO'Q — kod xatosi, to'liq logga |
| Boshqa `4xx` | doimiy xato | retry YO'Q, log + oqim davom etadi |

Asosiy tamoyil: **vaqtinchalik → retry, doimiy → signal**. Aniq kod raqamlari Meta
versiyasiga qarab o'zgaradi — xarita testlar bilan qoplanadi.

---

## 4. Rate limit va throttle

| Qatlam | Qoida | Sabab |
|---|---|---|
| **Chiquvchi throttle** | ketma-ket ikki so'rov orasi kamida **1 soniya** | rate limitga urilmaslik + "spam" belgisidan qochish |
| **Javob kechikishi** | `CenterMeta.InstagramReplyDelaySeconds` (default 5 s) | javob bir zumda kelmasin — tabiiylik |
| **Retry** | 3 marta, `1s → 2s → 4s` | faqat `429/500/503` va tarmoq xatolarida |
| **Post bo'yicha limit** | **8 javob / 10 daqiqa** bitta post ostida | halqa avtomat o'chirgichi |
| **Global limit** | **30 javob / 10 daqiqa** butun akkaunt bo'yicha | xuddi shu |
| **Kunlik chegara** | `CenterMeta.InstagramDailyReplyLimit` (default 200) | himoya to'sig'i |

Limit oshsa: **javob berilmaydi**, `error` darajasida log ("CHEKLOV — TO'XTATILDI").
Normal muloqotda bunga hech qachon yetilmaydi — yetilsa, demak **halqa bor**.

⚠️ Throttle **butun ilova bo'yicha** bo'lishi kerak, har nusxa bo'yicha emas. Manba
loyihada 2 worker tufayli amalda 2 so'rov/soniya chiqib ketgan — bizda ilova bitta nusxada.

---

## 5. Cheksiz halqadan himoya, dedup, pauza

### 5.1. O'Z IZOHIGA JAVOB BERMASLIK — 3 qavatli himoya

**Muammo (real hodisa):** bot izohga javob yozadi → o'z javobi webhook bo'lib qaytadi →
uni begona izoh deb hisoblaydi → yana javob yozadi → **cheksiz halqa** → akkaunt bloklanadi.

| Qavat | Mexanizm | Qayerda |
|---|---|---|
| **1. Identifikatsiya** | `from.id` **ikkala** saqlangan ID bilan solishtiriladi; zaxira — `from.username` (registr e'tiborsiz) | `InstagramEventParser.Parse(raw, ourIgUserId)` |
| **2. Dedup** | bir xil `EventKey` ikkinchi marta ishlanmaydi | `IgWebhookEvent.EventKey` **UNIKAL indeks** |
| **3. Avtomat o'chirgich** | post/global/kunlik limitlar (§4) | `InstagramPipeline` |

DM tomonida ekvivalent: `message.is_echo == true` bo'lsa **hech qachon** javob yozilmaydi.

### 5.2. DEDUP — nima uchun MAJBURIY

Uchta mustaqil sabab:

1. Meta muvaffaqiyatsiz yetkazishni **36 soat** qayta yuboradi — bizning 200 kechiksa
   hodisa **yana keladi** va mijoz ikki xil javob oladi;
2. Meta ba'zan bir hodisani **ikki marta** yuboradi (kafolat "at-least-once");
3. Halqadan himoyaning 2-qavati.

**Dedup kaliti (`InstagramEventParser.EventKeyOf`):**

| Hodisa | Kalit |
|---|---|
| Izoh | `comment:{comment_id}` |
| DM | `dm:{message.mid}` |
| Echo | `echo:{message.mid}` |
| Ikkalasi ham yo'q | `sender + timestamp + matn` ning **barqaror kriptografik hash**i |

⚠️ **MANBA LOYIHADAGI XATO — TAKRORLANMAYDI:** DM dedup kaliti matnning **runtime
hash**idan qurilardi. Bunday hash har jarayonda boshqacha bo'ladi → restartdan keyin kalit
o'zgaradi va **dedup umuman ishlamaydi**. Kalit **DETERMINISTIK** bo'lishi SHART —
`InstagramEventParserTests` buni test bilan qulflaydi (bir xil payload → bir xil kalit).

**Saqlash:** `IgWebhookEvent.EventKey` unikal indeksi — ikki bir vaqtda kelgan bir xil
webhook ham to'g'ri filtrlanadi (ikkinchisi indeks xatosiga uriladi va `skipped` bo'ladi).
Eski `done`/`skipped` yozuvlar **30 kundan keyin** `InstagramWorkerService` bilan tozalanadi.

### 5.3. Operator pauzasi (echo mexanizmi)

Akkauntimizdan chiqqan **har** DM webhook'ga `is_echo` bo'lib qaytadi. Ikki manba:

| Manba | Nima qilinadi |
|---|---|
| **Botning o'z javobi** | e'tibor berilmaydi (chiquvchi `IgMessage` allaqachon yozilgan, `IsAi = true`) |
| **Operator telefondan qo'lda yozgani** | `OperatorPausedUntil` qo'yiladi — bot **jim turadi** (`IgConst.OperatorPauseMinutes` = 720, ya'ni **12 soat**) va muddat tugagach O'ZI botga qaytadi. Darhol qaytarish kerak bo'lsa — Inbox'dagi «Botga qaytarish» tugmasi |

Ajratish usuli: bot yuborgan matn `IgMessage` sifatida saqlangan — echo qaytganda shu
bo'yicha o'zini taniydi. Topilmasa → odam yozgan → pauza.
Tekshiruv: `InstagramContract.OperatorPaused(conv, AppClock.Now)`.

Inbox'da qo'lda ham boshqariladi: `POST /conversations/{id}/takeover` (bot jim) ·
`/release` (botni qaytarish).

> Bu mexanizm bo'lmasa mijoz bir vaqtda **"ikki odam" bilan** gaplashadi.

### 5.4. Muddatlar jamlanmasi

| Narsa | Qiymat | Konstanta |
|---|---|---|
| Auth code | **1 soat**, bir marta | — |
| OAuth `state` | **15 daqiqa**, bir marta | `IgOAuthState.ExpiresAt` |
| Qisqa token | **1 soat** | — |
| Uzoq token | **~60 kun** (`expires_in` ≈ 5 183 944 s) | — |
| Token yangilash chegarasi | **45-kun** | `IgConst.TokenRefreshDays` |
| DM oynasi | **24 soat** | `IgConst.DmWindowHours` |
| Private reply | **7 kun**, bir marta | `IgConst.PrivateReplyDays` |
| Meta webhook javobini kutishi | **5 soniya** | — |
| Meta retry davri | **36 soat** | — |
| Navbat tozalash | **30 kun** | `InstagramWorkerService` |

---

## 6. AI qatlami — `InstagramAgentService`

### 6.1. `IgAgentOutput` — strukturali chiqish

LLM (Gemini) majburan shu sxemada JSON qaytaradi:

| Maydon | Tur | Ma'no |
|---|---|---|
| `Reply` | string | Mijozga yuboriladigan matn |
| `Language` | enum | `uz-Cyrl` \| `uz-Latn` \| `ru` \| `en` (`IgConst.Languages`) |
| `Intent` | enum | `greeting` \| `price_question` \| `product_question` \| `buying_intent` \| `complaint` \| `spam` \| `other` (`IgConst.Intents`) |
| `LeadScore` | int | `0..100` |
| `IsHotLead` | bool | jiddiy xaridor belgisi |
| `MoveToDm` | bool | izohdan DM'ga o'tkazish |
| `EscalateToHuman` | bool | operatorga o'tkazish |
| `LeadName` / `LeadContact` / `LeadProductInterest` / `LeadSummary` | string | lid maydonlari (`LeadSummary` — **o'zbekcha**) |

⚠️ Sxemada `minLength`, `minimum`, `maximum` kabi cheklovlar **ISHLATILMAYDI** —
structured output ularni qo'llab-quvvatlamaydi va sxema rad etiladi. Diapazon **kod
tomonda** to'g'rilanadi: `InstagramContract.ClampScore` (0..100),
`NormalizeIntent` (noma'lum → `other`), `NormalizeLanguage` (noma'lum → `uz-Latn`).

⚠️ Enum qiymatlari **bir joyda** — `IgConst.Intents` / `IgConst.Languages`. Manba loyihada
mock provayder `price_inquiry` qaytarar, sxemada esa `price_question` edi.

`ParseOutput(raw)` — markdown fence (` ```json `) tozalanadi, buzuq JSON → `null`
(pipeline jonli javob **yubormaydi**).

### 6.2. Prompt qoidalari — `BuildSystemPrompt`

System prompt = **persona + qoidalar + BILIM BAZASI**; `system` barqaror (keshlanadi),
`messages` o'zgaruvchan.

| # | Qoida |
|---|---|
| 1 | **Til va yozuv aniqlash** — mijoz qaysi tilda va **yozuvda** yozsa AYNAN o'shanda javob (kirill → kirill, lotin → lotin, rus → rus, ingliz → ingliz). Jonli, samimiy — "hurmatli mijoz" emas |
| 2 | **NARX O'YLAB TOPILMAYDI** — faqat bilim bazasidan. Bilmasa taxmin qilmaydi: `EscalateToHuman = true` + "operatorlarimiz bog'lanadi" |
| 3 | **Spamga qarshi xilma-xillik** — har javob biroz boshqacha. Bir xil shablon takrorlansa Instagram uni **spam** deb belgilaydi |
| 4 | **Operatorga o'tish** — "operator"/"odam" so'ralsa **darhol** eskalatsiya. Mijozni bot bilan gaplashishga majburlash **taqiqlangan** (platforma talabi) |
| 5 | **Qisqalik va CTA** — ochiq izohga **1–2 gap**; DM'da batafsilroq + telefon so'rash |
| 6 | **Lead baholash** — §6.3 |
| 7 | **Namuna javoblar** — uslub uchun 2–3 misol |

Har chaqiruvdagi kontekst bloki:
```
[Kontekst]
Kanal: ochiq IZOH            (yoki: shaxsiy xabar (DM))
Mijoz username: @ali
Post matni: <media caption, 300 belgigacha>

[Mijoz xabari]
Qancha turadi?
```
**Kanal muhim** — "izohga qisqa, DM'ga batafsil" qoidasi shundan.

**DM kontekst tarixi:** oxirgi **20 ta** xabar (`IgConst.DmHistoryLimit`) — mijoz
"boshlang'ich daraja bormi?" deb, keyin "narxi qancha?" desa AI qaysi kurs haqida gap
ketayotganini bilishi kerak.

**Bilim bazasi bo'sh bo'lsa** promptga aniq ko'rsatma yoziladi:
*"(Bilim bazasi hali to'ldirilmagan — narx so'ralsa operatorga o'tkaz.)"*

### 6.3. Lid baholash va yozish

| Ball | Holat |
|---|---|
| **0–30** | salom-alik, spam, mavzudan tashqari |
| **40–60** | qiziqish bor: kurs haqida so'rayapti |
| **70–100** | **xarid niyati**: narx so'radi + kontakt qoldirdi, "yozilaman", "kelaman" |

`InstagramContract.IsHot(o)` = `o.IsHotLead || LeadScore >= IgConst.HotLeadScore (70) ||
kontakt bor`.
`InstagramContract.ShouldCreateLead(o)` = `IsHot(o) || kontakt bor`.

⚠️ **HAR suhbat lid bo'lmaydi** — salom-alik va spam CRM'ni ifloslantirmaydi.

Telefon matndan `InstagramContract.ExtractPhone` bilan ajratiladi (o'zbek raqamlari:
`+998…`, `998…`, 9 xonali).

### 6.4. Eskalatsiya

| Trigger | Natija |
|---|---|
| `EscalateToHuman == true` | `NeedsOperator = true` + sabab, Telegram alert |
| `IsHot == true` | xuddi shunday |
| Mijoz "operator"/"odam" so'radi | prompt qoidasi №4 → `EscalateToHuman` |
| Bilim bazasida javob yo'q | `EscalateToHuman` (narx o'ylab topilmaydi) |
| **DM 24 soat oynasi yopiq** | `NeedsOperator = true` + "javob bera olmadik" sababi |
| **Matnsiz xabar** (rasm/stiker/ovoz) | `NeedsOperator = true` |

Oxirgi ikkisi manba loyihada **YO'Q edi** — bizda qo'shilgan.

### 6.5. Xatolarga chidamlilik — `InstagramPipeline`

Har bosqich **alohida `try/catch`** ichida:

| # | Qadam | Yiqilsa |
|---|---|---|
| 0 | Echo bo'lsa — pauza mexanizmi | to'xtaydi (normal) |
| 1 | Dedup tekshiruvi | **davom etadi** (fail-open) |
| 1a | Rate limit (izoh) | davom etadi |
| 1b | Operator pauzasi (DM) | davom etadi |
| 2 | Kontekst (DM tarixi) | bo'sh tarix bilan davom etadi |
| 3 | **AI javobi** | **TO'XTAYDI** — javob bo'lmasa yuboradigan narsa yo'q |
| 4 | Instagram'ga yuborish | keyingi qadamga o'tadi (xato `IgMessage.Error` ga yoziladi) |
| 5 | Tarixni saqlash | davom etadi |
| 6 | **Lidga yozish** (`InstagramLeadBridge`) | davom etadi (+ retry, so'ng operatorga signal) |
| 7 | Telegram bildirishnomasi | davom etadi (**jim yutiladi**) |

**Tamoyil:** yordamchi tizim yiqilsa ham **asosiy vazifa — mijozga javob berish** bajariladi.

`IgWebhookEvent.Attempts >= 3` bo'lsa `Status = "failed"` va xato matni saqlanadi
(`GET /events` da ko'rinadi).

---

## 7. Meta platforma talablari (majburiy xulq)

| Talab | Bajarilishi |
|---|---|
| **Bot ekanini oshkor qilish** | suhbatning **BIRINCHI** xabariga avtomatik qo'shiladi — `CenterMeta.InstagramGreeting` |
| **Operatorga o'tish yo'li** | mijoz "operator"/"odam" desa darhol eskalatsiya. Mijozni bot bilan gaplashishga **majburlash taqiqlangan** |
| **Maxfiylik siyosati** | **login talab qilmaydigan ochiq** URL: `https://<domen>/privacy` |
| **Ma'lumotni o'chirish** | ochiq URL: `https://<domen>/data-deletion` |

⚠️ Loyihada butun SPA login ortida. Bu ikki sahifa **ochiq marshrut** bo'lishi kerak —
lekin ular **hech qanday CRM ma'lumotini KO'RSATMAYDI**.

---

## 8. Standard Access — App Review kerak emas

> *"Standard Access is the default access level for all apps… **If your app only serves your
> Instagram professional account or an account you manage, Standard Access is all your app
> needs.**"*
>
> *"Advanced Access is the access level required if your app serves Instagram professional
> accounts that you **don't** own or manage…"*

| Holat | App Review |
|---|---|
| Faqat O'Z akkauntimiz (bizning holat) | **KERAK EMAS** |
| Ilovani boshqa markazlarga sotish | KERAK |

Ilovani **Live rejimga** o'tkazish ham shart emas. Facebook Page va Business Verification —
**KERAK EMAS** (Instagram Login yo'li).

---

## 9. Manba loyihadagi tuzatilmagan muammolar — bizda takrorlanmaydi

| # | Muammo | Bizdagi yechim |
|---|---|---|
| 1 | Fail-open imzo tekshiruvi (App Secret bo'sh → o'tkazib yuborilardi) | `InstagramSignature.Verify` → **`false`** (fail-closed), test bilan qulflangan |
| 2 | Barqaror bo'lmagan dedup kaliti (runtime hash) | `EventKeyOf` **deterministik**, `EventKey` unikal indeks |
| 3 | DM 24 soat oynasi kuzatilmasdi | `DmWindowOpen` yuborishdan oldin, yopiq bo'lsa `NeedsOperator` |
| 4 | Matnsiz DM jimgina yo'qolardi | operatorga signal |
| 5 | Ochiq (autentifikatsiyasiz) `/simulate` va `/reload-knowledge` | `POST /api/admin/instagram/simulate` — **`marketing` ruxsati ostida** |
| 6 | 2 worker: ikki throttle, bo'lingan statistika, ikki marta hisobot | ilova **bitta nusxada**, navbat bazada (`IgWebhookEvent`) |
| 7 | Eskalatsiya lidni hech kimga biriktirmasdi | `NeedsOperator` + sabab + Telegram alert; Inbox'da qizil chip |
| 8 | Xotiradagi kunlik statistika (restartda nolga tushardi) | analitika **bazadan** hisoblanadi (`GET /analytics`) |

---

## 10. Ochiq savollar (implementatsiyada tasdiqlanadi)

1. Token **kamida bir marta ishlatilgan** bo'lmasa refresh rad etiladimi — Meta hujjatida
   aniq emas. Amalda bizda token doim ishlatiladi.
2. Izoh javobi matnining aniq uzunlik chegarasi (`ReplyToCommentAsync`) hujjatda
   ko'rsatilmagan — DM uchun ≤ 1000 bayt aniq.
3. `error.code` + `error_subcode` xaritasi Meta versiyasiga qarab o'zgaradi — testlar bilan
   qoplanib, vaqti-vaqti bilan tekshirilishi kerak.
4. `follower_count`, `is_user_follow_business` va boshqa profil maydonlari mijoz maxfiylik
   sozlamasiga qarab qaytmasligi mumkin — nullable deb ishlanadi.

---

*Protokol tafsilotlari `developers.facebook.com` rasmiy hujjatidan tekshirilgan (2026-08-12).
Amaliy tuzoqlar — oldingi loyihada real sodir bo'lgan hodisalardan.*
