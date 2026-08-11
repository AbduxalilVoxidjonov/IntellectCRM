# Instagram AI sotuv agenti — modul haqida

> Markazning Instagram **Professional** akkauntiga kelgan **izohlar** va **DM**larni webhook
> orqali qabul qilib, ularga o'zbek tilida sotuvchi sifatida javob beradigan, qiziqqan odamni
> CRM'da **lidga** aylantiradigan va operatorga xabar beradigan modul.
>
> CRM'da joyi: **Marketing** bo'limi (`/admin/marketing`), ruxsat kaliti — **`marketing`**.

Tanlangan yo'l: **Instagram API with Instagram Login**.
Facebook Page **KERAK EMAS**, Business Verification **KERAK EMAS**,
**App Review ham KERAK EMAS** (Standard Access yetadi — akkaunt bizniki).

---

## 1. Nima qiladi

| Hodisa | Modul nima qiladi |
|---|---|
| Postimiz ostiga izoh yozildi | Izohga **ochiq javob** yozadi; sozlama yoqilgan bo'lsa qo'shimcha **shaxsiy DM** (private reply) yuboradi |
| Bizga DM keldi | Bilim bazasi asosida javob beradi, kerak bo'lsa telefon so'raydi |
| Mijoz "operator", "odam bilan gaplashaman" dedi | Darhol eskalatsiya — suhbat `NeedsOperator` bo'ladi, Telegram'ga alert ketadi |
| Mijoz xarid niyatini bildirdi yoki telefon qoldirdi | Mavjud **Lidlar** moduliga lid yoziladi (`Source = "Instagram"`) |
| Operator telefonidan qo'lda javob yozdi | Bot o'sha suhbatda **jim turadi** (echo mexanizmi, §4) |

Nima QILMAYDI: o'zi birinchi bo'lib yozmaydi (Instagram ruxsat bermaydi), narx **o'ylab
topmaydi** (faqat bilim bazasidan), matnsiz xabarga (rasm/stiker/ovoz) javob yozmaydi —
faqat operatorga signal beradi.

---

## 2. Oqim (bir qarashda)

```
Instagram
   │  izoh / DM
   ▼
POST /api/public/instagram/webhook          ← InstagramWebhookController
   │  1) XOM body baytlari o'qiladi
   │  2) InstagramSignature.Verify  (mos kelmasa → 403)
   │  3) IgWebhookEvent (Status="pending") yoziladi
   │  4) ══ DARHOL 200 OK ══                (Meta 5 soniya kutadi)
   ▼
IgWebhookEvent  (durable navbat, baza jadvali)
   │  har 2 soniyada
   ▼
InstagramWorkerService (BackgroundService)  → InstagramPipeline.ProcessAsync
   │
   ├─ InstagramEventParser.Parse       → comment | dm | echo
   ├─ echo bo'lsa → operator pauzasi yoqiladi va CHIQADI
   ├─ o'zimizdan kelgan izoh → tashlanadi (cheksiz halqa himoyasi)
   ├─ IgConversation topiladi/yaratiladi, kiruvchi IgMessage yoziladi
   ├─ modul o'chiq / pauza / kunlik limit → javob berilmaydi
   ├─ IgAutoRule (kalit so'z) mos keldimi?  ha → tayyor matn, AI chaqirilmaydi
   ├─ yo'q → InstagramAgentService.AskAsync  (GeminiService)  → IgAgentOutput
   ├─ InstagramApi: ReplyToCommentAsync / SendPrivateReplyAsync / SendDmAsync
   ├─ chiquvchi IgMessage yoziladi
   ├─ ShouldCreateLead → InstagramLeadBridge.UpsertAsync → Lead
   └─ IsHot / Escalate → Telegram alert (mavjud bot)
```

---

## 3. Fayllar qayerda

### Backend — `IntellectCRM.Application/Services/`

| Fayl | Vazifasi |
|---|---|
| `InstagramContract.cs` | `IgConst` konstantalari + **sof funksiyalar**: `ClampScore`, `NormalizeIntent/Language`, `IsHot`, `ShouldCreateLead`, `DmWindowOpen`, `OperatorPaused`, `ExtractPhone` |
| `InstagramSignature.cs` | `X-Hub-Signature-256` tekshiruvi (xom baytlardan, **fail-closed**) + GET verify challenge |
| `InstagramEventParser.cs` | Meta xom JSON → `IgIncomingEvent[]`; **deterministik** dedup kaliti |
| `InstagramApi.cs` | Graph API klienti: OAuth almashuv, token yangilash, izohga javob, private reply, DM, media caption |
| `InstagramAgentService.cs` | Prompt qurish + Gemini chaqiruvi + `IgAgentOutput` parse |
| `InstagramPipeline.cs` | Asosiy oqim — bitta `IgWebhookEvent`ni boshidan oxirigacha |
| `InstagramLeadBridge.cs` | Suhbatdan **Lead** yaratish/yangilash (first-touch qoidasi) |
| `InstagramWorkerService.cs` | `BackgroundService`: navbat · token yangilash · eski hodisalarni tozalash |

### Backend — controllerlar (`IntellectCRM.Server/Controllers/`)

| Fayl | Yo'l | Kirish |
|---|---|---|
| `InstagramWebhookController.cs` | `api/public/instagram` | **`[AllowAnonymous]`** — Meta murojaat qiladi (GET verify · POST webhook · GET callback) |
| `InstagramController.cs` | `api/admin/instagram` | `[AdminPerm("marketing", ReadRequiresPerm = true)]` |

### Domen va baza

`IntellectCRM.Domain/Entities.cs` → `// ═══ MARKETING — INSTAGRAM AI AGENTI ═══` bo'limi:
`IgAccount` · `IgWebhookEvent` · `IgConversation` · `IgMessage` · `IgAutoRule` ·
`IgKnowledge` · `IgOAuthState`, hamda `CenterMeta` ga qo'shilgan `Instagram*` sozlamalari.
Migratsiya: **`AddInstagramAgent`**.

### Frontend — `IntellectCRM.Client/src/pages/admin/marketing/`

| Sahifa | Yo'l |
|---|---|
| Boshqaruv paneli | `/admin/marketing` |
| Inbox (suhbatlar) | `/admin/marketing/inbox` |
| Javob qoidalari | `/admin/marketing/rules` |
| Bilim bazasi | `/admin/marketing/knowledge` |
| Analitika | `/admin/marketing/analytics` |
| Sozlamalar (ulash) | `/admin/marketing/settings` |

API klienti — `src/api/services/instagram.ts`.

---

## 4. Qanday yoqiladi (qisqacha)

To'liq bosqichma-bosqich qo'llanma: **[`SOZLASH.md`](SOZLASH.md)** (~30–40 daqiqa).

1. Instagram akkaunt **Professional** (Business yoki Creator) qilinadi;
2. `developers.facebook.com` da Meta App ochiladi → **Instagram → API setup with
   Instagram login** → App ID va App Secret olinadi;
3. `.env` ga `INSTAGRAM_APP_SECRET` va `INSTAGRAM_VERIFY_TOKEN` yoziladi (`docker compose up -d`);
4. CRM → Marketing → Sozlamalar: **App ID** kiritiladi;
5. Meta'da webhook ulanadi: `https://<domen>/api/public/instagram/webhook`,
   maydonlar `comments`, `messages`, `message_echoes`;
6. **«Instagram'ni ulash»** bosiladi (OAuth) — token, ID lar va webhook obunasi avtomatik;
7. **Bilim bazasi** to'ldiriladi (kurslar va narxlar);
8. `POST /test-agent` yoki Sozlamalardagi sinov maydoni bilan tekshiriladi;
9. **Oxirida** avtojavob yoqiladi: `InstagramEnabled` + `InstagramAutoReplyComments` /
   `InstagramAutoReplyDm`.

⚠️ Barcha bayroqlar **default `false`** — sozlanmaguncha mijozga jonli javob **ketmaydi**.

---

## 5. Qayerdan boshlash

| Savol | Qayerga qarash |
|---|---|
| "Qanday sozlanadi, qadamma-qadam?" | [`SOZLASH.md`](SOZLASH.md) |
| "Meta bilan qaysi so'rov almashinadi, xato kodi nima degani?" | [`TEXNIK.md`](TEXNIK.md) |
| "Kod yozayotganda nimaga tegmaslik kerak?" | [`../.claude/rules/marketing-instagram.md`](../.claude/rules/marketing-instagram.md) |
| "Lid qanday yoziladi?" | `.claude/rules/crm-leads.md` + `InstagramLeadBridge` |
| "Audit qayerda ko'rinadi?" | `.claude/rules/audit.md`, `EntityType = "Instagram"` → bo'lim `marketing` |
