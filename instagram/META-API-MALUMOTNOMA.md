# META (Facebook + Instagram) MARKETING MODULI — CRM UCHUN TO'LIQ QURILISH PROMPTI

> **Bu hujjat nima?**
> Bu — AI koding agentiga (Claude Code, Cursor, Windsurf, Copilot Agent va h.k.) beriladigan **master prompt**.
> Uni to'liq nusxa ko'chirib agentga bering yoki bosqichlarga bo'lib (§ bo'yicha) topshiriq sifatida ishlating.
> Ichidagi barcha API faktlar 2026-yil avgust holatiga ko'ra Meta rasmiy hujjatlaridan olingan.
> **⚠️ belgisi** — Meta hujjatlarida ziddiyat bor yoki tasdiqlanmagan, kodga qattiq yozib qo'ymang (hardcode qilmang).

---

## 0. AGENTGA TOPSHIRIQ (bu qismni birinchi o'qing)

Sen — tajribali **.NET backend + React frontend** arxitektori va dasturchisisan.
Vazifang: mavjud CRM tizimiga **"Marketing" bo'limi** ni qurish. Bu bo'lim Instagram va Facebook'dagi
mijozlar bilan aloqani to'liq avtomatlashtiradi: izohlarga (comment) va shaxsiy xabarlarga (Direct/Messenger)
**AI yordamida avtomatik javob beradi**, reklama lidlarini CRM'ga avtomatik tortadi, reklama samaradorligini
ko'rsatadi va kontent joylashni rejalashtiradi.

**Muhim qoidalar:**

1. **Hech qachon API faktini o'zingdan o'ylab topma.** Endpoint, maydon nomi, ruxsat nomi kerak bo'lsa —
   ushbu hujjatdagi ilovalardan (§14–§16) foydalan. Agar bu yerda yo'q bo'lsa — kod yozishdan oldin
   `developers.facebook.com` hujjatidan tekshir va topilmasa menga ayt.
2. **Har bir qadamda ishlaydigan kod yoz.** Placeholder, `// TODO: implement` qoldirma.
3. **Migratsiya + test + Swagger** — har bir yangi endpoint uchun majburiy.
4. Kod izohlari va UI matnlari **o'zbek tilida**, kod identifikatorlari **ingliz tilida**.
5. Har bosqich oxirida `dotnet build`, `dotnet test`, `npm run build` ishlashini tekshir.
6. Meta API versiyasini **bitta joyda** (`appsettings.json` → `Meta:ApiVersion`) sozla, kodga tarqatma.

---

## 1. TEXNOLOGIK STACK

| Qatlam | Texnologiya |
|---|---|
| Backend | **.NET 9 / ASP.NET Core Web API**, C# 13 |
| ORM | **EF Core 9** + Npgsql |
| DB | **PostgreSQL 16+** (`jsonb`, `pg_trgm`, `uuid-ossp`, partitioning) |
| Navbat (queue) | **Hangfire** (PostgreSQL storage) yoki **MassTransit + RabbitMQ**. Boshlanishiga Hangfire yetarli |
| Kesh + rate limit + idempotency | **Redis** (StackExchange.Redis) |
| Real-time UI | **SignalR** (inbox jonli yangilanishi uchun) |
| HTTP client | `IHttpClientFactory` + **Polly** (retry, circuit breaker, jitter) |
| Frontend | **React 18 + TypeScript + Vite** |
| UI kutubxona | **TailwindCSS + shadcn/ui**, jadval uchun TanStack Table, grafik uchun Recharts |
| State/serverdata | **TanStack Query (React Query)** + Zustand |
| Auth | CRM'ning mavjud JWT/Identity tizimi |
| AI | **OpenAI-compatible** interfeys (`IAiProvider`) — Claude / GPT / lokal model almashtiriladigan bo'lsin |
| Vektor qidiruv (RAG) | **pgvector** kengaytmasi (alohida vektor DB shart emas) |
| Loglash | Serilog → Seq/ELK, har log'da `fbtrace_id` bo'lsin |
| Sirlar | Token'lar **AES-256-GCM** bilan shifrlanadi (kalit — ASP.NET Data Protection yoki Azure Key Vault/Vault) |

**Loyiha strukturasi (Clean Architecture):**

```
src/
  Crm.Marketing.Domain/          # Entity, Enum, Value Object, domen qoidalari
  Crm.Marketing.Application/     # UseCase (CQRS/MediatR), DTO, interfeyslar
  Crm.Marketing.Infrastructure/  # EF Core, Meta API client'lari, AI provider, Redis
  Crm.Marketing.Api/             # Controller, Webhook endpoint, SignalR Hub, DI
  Crm.Marketing.Workers/         # Hangfire job'lar (sync, publish, insights, retry)
tests/
  Crm.Marketing.UnitTests/
  Crm.Marketing.IntegrationTests/  # Testcontainers (PostgreSQL + Redis) + WireMock (Meta mock)
web/
  src/features/marketing/...
```

---

## 2. MODUL QAMROVI (nima quriladi)

| # | Modul | Qisqacha |
|---|---|---|
| M1 | **Ulanish (Onboarding)** | Facebook/Instagram akkauntini CRM'ga ulash, token boshqaruvi |
| M2 | **Webhook Gateway** | Meta'dan keladigan barcha hodisalarni qabul qilish, imzo tekshirish, navbatga qo'yish |
| M3 | **Unified Inbox** | IG Direct + Messenger DM bitta oynada, operator javobi, AI javobi, human handoff |
| M4 | **Comment Center** | IG va FB izohlari: avtomatik javob, yashirish, o'chirish, private reply (DM'ga o'tkazish) |
| M5 | **AI Engine** | Intent aniqlash, RAG bilan javob generatsiyasi, guardrail, eskalatsiya |
| M6 | **Lead Center** | Instagram/Facebook Lead Ads (Instant Form) lidlarini avtomatik CRM'ga tortish |
| M7 | **Ads Analytics** | Kampaniya/AdSet/Ad bo'yicha xarajat, lid narxi (CPL), ROAS dashboard |
| M8 | **Content Scheduler** | IG post/reels/story va FB post/reels/story rejalashtirish va joylash |
| M9 | **Attribution & CAPI** | Qaysi reklama qaysi lidni/savdoni keltirdi + natijani Meta'ga qaytarib yuborish |

---

## 3. META PLATFORMASI — ASOSIY FAKTLAR (2026-08)

### 3.1 Versiya va hostlar

- Joriy Graph API versiyasi: **v26.0** (2026-07-29 da chiqdi, ✅ tasdiqlangan). Undan oldingisi — v25.0 (2026-02-18).
  ⚠️ Changelog index sahifasi ba'zan eskirgan (v24.0) ko'rsatadi — `changelog/version26.0/` sahifasiga qarang.
- Har versiya **kamida 2 yil** yashaydi. v20.0 → 2026-09-24 da o'chadi.
- ⚠️ Meta'ning ba'zi o'zgarishlari **versiyaga bog'liq emas** — barcha versiyalarda bir vaqtda kuchga kiradi
  (metrika o'chirilishi, attribution oynalari). Versiyani "muzlatib" qo'yish sizni himoya qilmaydi.

| Host | Qachon |
|---|---|
| `https://graph.facebook.com/v{ver}/...` | Facebook Login for Business yo'li (Page + IG + Ads + Leads) |
| `https://graph.instagram.com/v{ver}/...` | Instagram Login yo'li (faqat IG, Page'siz akkauntlar) |
| `https://rupload.facebook.com/...` | Video/reels fayl yuklash (resumable upload) |

### 3.2 Ikki xil ulanish yo'li — QAROR

| | **Instagram Login** | **Facebook Login for Business** |
|---|---|---|
| Kimga | Facebook Page'siz IG professional akkaunt | Page'ga bog'langan IG akkaunt |
| Host | `graph.instagram.com` | `graph.facebook.com` |
| Ruxsat prefiksi | `instagram_business_*` | `instagram_*` + `pages_*` |
| DM | ✅ | ✅ |
| Comment | ✅ | ✅ |
| **Reklama izohida `ad_id`** | ❌ **YO'Q** | ✅ **BOR** |
| Lead Ads | ❌ | ✅ |
| Ads Insights | ❌ | ✅ |
| Handover Protocol | ❌ | ✅ (faqat Messenger) |
| Hashtag search, product tagging | ❌ | ✅ |

> **🔴 ARXITEKTURA QARORI:** Marketing CRM uchun **Facebook Login for Business asosiy yo'l** bo'lishi shart —
> chunki reklama izohlaridagi `ad_id`, Lead Ads va Ads Insights faqat shu yo'lda mavjud.
> Instagram Login'ni **ikkinchi darajali** yo'l sifatida qo'shing (Page'i yo'q mijozlar uchun),
> lekin ularga "reklama analitikasi mavjud emas" deb ogohlantirish ko'rsating.
> Kod darajasida: `IMetaChannelClient` interfeysi + ikkita implementatsiya (`FacebookLoginClient`, `InstagramLoginClient`).

### 3.3 Token turlari va muddatlari

| Token | Muddati | Izoh |
|---|---|---|
| Short-lived User token | ~1–2 soat (IG: aniq 1 soat) | Saqlamang |
| Long-lived User token | **60 kun** | `grant_type=fb_exchange_token` |
| Long-lived IG User token | **60 kun**, yangilanadi | `graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` |
| **Page access token** | **Muddatsiz** (agar long-lived user token'dan olingan bo'lsa) | Asosiy ish tokeni |
| **System User token** | **Muddatsiz** | Fon jarayonlari uchun eng yaxshisi |
| App token | Muddatsiz | `grant_type=client_credentials`. **Hech qachon frontendga bermang** |

**Token olish zanjiri:**
```
code → short-lived user token → long-lived user token (60 kun)
     → GET /me/accounts?fields=access_token,name,id,tasks,instagram_business_account
     → har Page uchun muddatsiz Page token
```

**⚠️ 90 kunlik "data access" qoidasi:** foydalanuvchi 90 kun ilovaga kirmasa, token *autentifikatsiya* uchun
amal qiladi lekin *ma'lumot olish* to'xtaydi. `auth_type=reauthorize` bilan qayta so'rang.
**Muhim yengillik:** `ads_management`, `pages_manage_posts` kabi biznes ruxsatlar bu 90 kunlik qoidadan **ozod**.

### 3.4 Ruxsatlar ro'yxati (aniq nomlar)

**Facebook Login yo'li — to'liq marketing to'plami:**
```
pages_show_list
pages_read_engagement
pages_read_user_content          # boshqalarning izohlarini o'qish/o'chirish
pages_manage_metadata            # webhook obuna qilish
pages_manage_engagement          # izoh yozish/o'chirish/yashirish
pages_manage_posts               # post joylash
pages_messaging                  # Messenger DM
pages_manage_ads                 # lead formalarga kirish
instagram_basic
instagram_manage_comments
instagram_manage_messages
instagram_manage_insights
instagram_content_publish
ads_read                         # Insights o'qish
ads_management                   # kampaniya boshqarish (ixtiyoriy)
leads_retrieval                  # lid PII o'qish
business_management              # System User token bilan ishlaganda
```

**Instagram Login yo'li:**
```
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
instagram_business_manage_insights
instagram_business_content_publish
```

**Feature (ruxsat emas, alohida App Review bandi):**
```
Human Agent                      # 24 soatdan tashqarida javob berish (7 kun)
Instagram Public Content Access
```

⚠️ Meta hujjatining o'zida `pages_showlist` deb xato yozilgan joy bor — to'g'risi `pages_show_list`.

### 3.5 App Review yo'l xaritasi (bu **3 haftadan 3 oygacha** vaqt oladi — rejaga kiriting)

Ketma-ketlik (har biri oldingisiga bog'liq):

1. **Business (Meta Business Portfolio) yaratish** va ilovani unga ulash.
2. **Business Verification** — yuridik hujjatlar, manzil, telefon. (2023-02-01 dan Advanced Access uchun majburiy.)
3. **Tech Provider verification** — *boshqa* bizneslarning ma'lumotlariga kirish uchun majburiy.
   SaaS CRM uchun **majburiy**. App Review'dan alohida jarayon.
4. **App Review** — har bir ruxsat uchun alohida: skrinkast + tushuntirish + test akkaunt + qadam-baqadam
   yo'riqnoma + Privacy Policy URL + Data Deletion callback URL. Javob odatda **~1 hafta**.
5. **Advanced Access** olinadi → endi mijozlaringiz ilovangizga ruxsat bera oladi.
6. **Data Protection Assessment (DPA)** — Meta o'zi taklif qiladi, **yiliga bir marta**, **60 kun** muddat.
   Lid PII saqlaydigan CRM uchun deyarli muqarrar.
7. **Data Use Checkup (DUC)** — yillik sertifikatsiya.

> **Standard Access** bilan ilova faqat ilovada roli bor odamlar (admin/developer/tester) bilan ishlaydi.
> Ishlab chiqish va demo shu rejimda qilinadi.

**Skrinkast tayyorlashda:** Human Agent uchun **haqiqiy operator UI'da qo'lda yozib javob berayotgani**
ko'rsatilishi shart. AI javob berayotganini ko'rsatsangiz — rad etiladi.

---

## 4. MA'LUMOTLAR BAZASI SXEMASI (PostgreSQL)

Barcha jadvallar `marketing` sxemasida. Barcha `id` — `uuid` (`gen_random_uuid()`), Meta ID'lari — `text`
(ular 64-bitdan katta bo'lishi mumkin, **hech qachon `bigint`/`int` ishlatmang**).
Multi-tenant: har jadvalda `tenant_id uuid not null` + RLS yoki global query filter.

```sql
CREATE SCHEMA IF NOT EXISTS marketing;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ 4.1 ULANISHLAR VA TOKENLAR ============

CREATE TYPE marketing.login_kind AS ENUM ('facebook_login','instagram_login');

CREATE TABLE marketing.meta_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  login_kind        marketing.login_kind NOT NULL,
  business_id       text,
  meta_user_id      text,
  user_token_enc    bytea,                    -- AES-256-GCM
  user_token_expires_at      timestamptz,
  data_access_expires_at     timestamptz,
  granted_scopes    text[] NOT NULL DEFAULT '{}',
  granular_scopes   jsonb,                    -- debug_token'dan
  status            text NOT NULL DEFAULT 'active',  -- active | needs_reauth | revoked
  last_validated_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketing.social_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  connection_id       uuid NOT NULL REFERENCES marketing.meta_connections(id) ON DELETE CASCADE,
  platform            text NOT NULL,          -- 'facebook_page' | 'instagram'
  external_id         text NOT NULL,          -- page_id yoki ig_user_id
  username            text,
  name                text,
  profile_picture_url text,
  page_token_enc      bytea,                  -- Page access token (muddatsiz)
  tasks               text[],                 -- MANAGE, MESSAGING, MODERATE, ADVERTISE, CREATE_CONTENT, ANALYZE
  linked_page_id      text,                   -- IG uchun bog'langan Page
  linked_ig_id        text,                   -- Page uchun bog'langan IG
  webhook_fields      text[] NOT NULL DEFAULT '{}',
  webhook_synced_at   timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform, external_id)
);

CREATE TABLE marketing.ad_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  connection_id  uuid NOT NULL REFERENCES marketing.meta_connections(id) ON DELETE CASCADE,
  external_id    text NOT NULL,               -- 'act_1234567890'
  name           text,
  currency       text,                        -- 'USD','UZS'
  currency_offset int NOT NULL DEFAULT 2,     -- minor unit uchun
  timezone_name  text,
  access_type    text,                        -- OWNER | AGENCY
  permitted_tasks text[],
  is_active      boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, external_id)
);

-- ============ 4.2 WEBHOOK VA IDEMPOTENTLIK ============

CREATE TABLE marketing.webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  object_type   text NOT NULL,                -- 'page' | 'instagram'
  entry_id      text NOT NULL,                -- page_id / ig_id → tenant marshrutlash
  field         text,                         -- messages, comments, feed, leadgen ...
  dedupe_key    text NOT NULL,                -- mid / comment_id / leadgen_id / hash
  raw_payload   jsonb NOT NULL,
  signature_ok  boolean NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  process_error text,
  attempts      int NOT NULL DEFAULT 0
) PARTITION BY RANGE (received_at);
-- Oylik partition yarating, 90 kundan keyin arxivlang.

CREATE UNIQUE INDEX ux_webhook_dedupe
  ON marketing.webhook_events (dedupe_key, field, received_at);

-- ============ 4.3 KONTAKTLAR (identity resolution) ============

CREATE TABLE marketing.social_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  account_id     uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  scoped_id      text NOT NULL,               -- PSID (Messenger) yoki IGSID (Instagram)
  username       text,
  display_name   text,
  profile_pic_url text,                       -- CDN link tez eskiradi → o'zimizga ko'chiramiz
  profile_pic_local text,
  crm_customer_id uuid,                       -- CRM'dagi asosiy mijoz kartochkasi
  first_ad_id    text,                        -- birinchi teginish reklamasi
  last_ad_id     text,
  first_ref      text,                        -- m.me ref parametri
  locale         text,
  is_blocked     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id, scoped_id)
);
-- ⚠️ PSID va IGSID GLOBAL EMAS: har Page/ilova uchun boshqacha.
--    Bitta odamni kanallar bo'ylab birlashtirish faqat telefon/email/ids_for_business orqali.

-- ============ 4.4 SUHBATLAR VA XABARLAR ============

CREATE TYPE marketing.conv_state AS ENUM ('bot','human','pending_human','closed');

CREATE TABLE marketing.conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  account_id        uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  contact_id        uuid NOT NULL REFERENCES marketing.social_contacts(id) ON DELETE CASCADE,
  external_thread_id text,
  channel           text NOT NULL,            -- 'instagram_dm' | 'messenger'
  state             marketing.conv_state NOT NULL DEFAULT 'bot',
  assigned_user_id  uuid,
  -- Siyosat oynalari:
  window_expires_at timestamptz,              -- oxirgi user xabari + 24 soat
  human_agent_expires_at timestamptz,         -- oxirgi user xabari + 7 kun (HUMAN_AGENT tag)
  is_thread_owner   boolean NOT NULL DEFAULT true,  -- handover / is_owner
  last_message_at   timestamptz,
  last_inbound_at   timestamptz,
  unread_count      int NOT NULL DEFAULT 0,
  ai_enabled        boolean NOT NULL DEFAULT true,
  tags              text[] NOT NULL DEFAULT '{}',
  source_ad_id      text,                     -- Click-to-Messenger reklamasi
  source_ref        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id, contact_id, channel)
);

CREATE TABLE marketing.messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES marketing.conversations(id) ON DELETE CASCADE,
  external_mid   text,                        -- Meta'ning `mid`
  direction      text NOT NULL,               -- 'in' | 'out'
  author_kind    text NOT NULL,               -- 'customer' | 'ai' | 'agent' | 'meta_inbox'
  author_user_id uuid,
  body           text,
  attachments    jsonb NOT NULL DEFAULT '[]', -- [{type,url,local_url,mime,size}]
  reply_to_mid   text,
  quick_reply_payload text,
  is_echo        boolean NOT NULL DEFAULT false,
  is_deleted     boolean NOT NULL DEFAULT false,
  is_unsupported boolean NOT NULL DEFAULT false,
  is_story_reply boolean NOT NULL DEFAULT false,
  story_id       text,
  delivery_status text,                       -- queued|sent|delivered|read|failed
  error_code     int,
  error_subcode  int,
  sent_tag       text,                        -- 'HUMAN_AGENT' va h.k.
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_mid)
);
CREATE INDEX ix_messages_conv_time ON marketing.messages (conversation_id, created_at DESC);

-- ============ 4.5 IZOHLAR ============

CREATE TABLE marketing.social_posts (            -- IG media / FB post keshi
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  account_id       uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  external_id      text NOT NULL,
  media_product_type text,                      -- FEED | REELS | STORY | AD
  permalink        text,
  caption          text,
  thumbnail_url    text,
  published_at     timestamptz,
  is_ad            boolean NOT NULL DEFAULT false,
  ad_id            text,
  original_media_id text,
  UNIQUE (tenant_id, account_id, external_id)
);

CREATE TABLE marketing.comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  account_id        uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  post_id           uuid REFERENCES marketing.social_posts(id),
  external_id       text NOT NULL,              -- IG: comment_id, FB: {post}_{comment}
  parent_external_id text,
  external_post_id  text,
  from_scoped_id    text,
  from_username     text,
  text              text,
  is_own            boolean NOT NULL DEFAULT false,   -- o'zimiz yozgan (echo)
  is_hidden         boolean NOT NULL DEFAULT false,
  is_deleted        boolean NOT NULL DEFAULT false,
  is_live           boolean NOT NULL DEFAULT false,
  ad_id             text,                       -- reklama izohi bo'lsa
  ad_title          text,
  sentiment         text,                       -- positive|neutral|negative|spam
  intent            text,
  -- javob holati:
  public_reply_id   text,
  public_replied_at timestamptz,
  private_reply_sent boolean NOT NULL DEFAULT false,  -- bitta izohga FAQAT BIR MARTA!
  private_reply_at  timestamptz,
  private_reply_deadline timestamptz,           -- created_at + 7 kun
  handled_by        text,                       -- 'ai' | 'agent' | 'rule'
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

-- ============ 4.6 LIDLAR ============

CREATE TABLE marketing.lead_forms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  account_id     uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  external_id    text NOT NULL,
  name           text,
  status         text,                          -- ACTIVE|ARCHIVED|DELETED|DRAFT
  locale         text,
  questions      jsonb NOT NULL DEFAULT '[]',   -- [{key,label,type,options}]
  field_mapping  jsonb NOT NULL DEFAULT '{}',   -- {"full_name":"crm.name","email":"crm.email",...}
  leads_count    int,
  organic_leads_count int,
  expired_leads_count int,
  synced_at      timestamptz,
  UNIQUE (tenant_id, external_id)
);

CREATE TABLE marketing.leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  account_id     uuid NOT NULL REFERENCES marketing.social_accounts(id),
  form_id        uuid REFERENCES marketing.lead_forms(id),
  external_id    text NOT NULL,                 -- leadgen_id (15-17 raqam) — CAPI uchun SAQLASH SHART
  platform       text,                          -- 'fb' | 'ig' (⚠️ enum tasdiqlanmagan, matn sifatida saqlang)
  is_organic     boolean NOT NULL DEFAULT false,
  partner_name   text,
  ad_id          text,
  adset_id       text,
  campaign_id    text,
  ad_name        text,
  adset_name     text,
  campaign_name  text,
  field_data     jsonb NOT NULL,                -- [{name, values[]}] — XOM HOLDA saqlang
  custom_disclaimer_responses jsonb,
  -- normallashtirilgan:
  full_name      text,
  email          text,
  phone          text,
  extra          jsonb NOT NULL DEFAULT '{}',
  crm_customer_id uuid,
  crm_deal_id    uuid,
  lead_status    text NOT NULL DEFAULT 'new',   -- new|contacted|qualified|won|lost
  status_changed_at timestamptz,
  capi_sent_at   timestamptz,
  meta_created_at timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);
CREATE INDEX ix_leads_phone ON marketing.leads USING gin (phone gin_trgm_ops);

-- ============ 4.7 REKLAMA STATISTIKASI ============

CREATE TABLE marketing.ad_entities (             -- campaign/adset/ad iyerarxiyasi
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  ad_account_id uuid NOT NULL REFERENCES marketing.ad_accounts(id) ON DELETE CASCADE,
  level         text NOT NULL,                  -- campaign|adset|ad
  external_id   text NOT NULL,
  parent_external_id text,
  name          text,
  status        text,
  effective_status text,
  objective     text,
  daily_budget_minor   bigint,
  lifetime_budget_minor bigint,
  start_time    timestamptz,
  stop_time     timestamptz,
  synced_at     timestamptz,
  UNIQUE (tenant_id, external_id)
);

CREATE TABLE marketing.ad_insights_daily (
  tenant_id      uuid NOT NULL,
  ad_account_id  uuid NOT NULL,
  level          text NOT NULL,
  external_id    text NOT NULL,
  stat_date      date NOT NULL,
  publisher_platform text NOT NULL DEFAULT 'all',  -- facebook|instagram|all
  platform_position  text NOT NULL DEFAULT 'all',
  impressions    bigint NOT NULL DEFAULT 0,
  reach          bigint NOT NULL DEFAULT 0,
  frequency      numeric(10,4),
  spend_minor    bigint NOT NULL DEFAULT 0,
  clicks         bigint NOT NULL DEFAULT 0,
  inline_link_clicks bigint NOT NULL DEFAULT 0,
  cpc            numeric(14,6),
  cpm            numeric(14,6),
  ctr            numeric(10,6),
  actions        jsonb NOT NULL DEFAULT '[]',
  action_values  jsonb NOT NULL DEFAULT '[]',
  cost_per_action_type jsonb NOT NULL DEFAULT '[]',
  purchase_roas  jsonb NOT NULL DEFAULT '[]',
  -- hisoblangan (generated yoki job'da):
  leads_onsite   int NOT NULL DEFAULT 0,
  leads_pixel    int NOT NULL DEFAULT 0,
  msg_started    int NOT NULL DEFAULT 0,
  attribution_setting text,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, level, external_id, stat_date, publisher_platform, platform_position)
);

-- ============ 4.8 KONTENT REJALASHTIRISH ============

CREATE TABLE marketing.scheduled_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  account_id      uuid NOT NULL REFERENCES marketing.social_accounts(id) ON DELETE CASCADE,
  post_type       text NOT NULL,            -- ig_image|ig_video|ig_reels|ig_story|ig_carousel|fb_post|fb_photo|fb_reels|fb_story
  caption         text,
  media           jsonb NOT NULL DEFAULT '[]',  -- [{url, type, cover_url, thumb_offset, alt_text, user_tags}]
  options         jsonb NOT NULL DEFAULT '{}',  -- share_to_feed, collaborators, location_id, audio_name...
  scheduled_at    timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'scheduled', -- scheduled|processing|published|failed|cancelled
  container_id    text,
  container_status text,
  external_post_id text,
  error_code      text,
  error_message   text,
  attempts        int NOT NULL DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============ 4.9 AI VA QOIDALAR ============

CREATE TABLE marketing.ai_settings (
  tenant_id          uuid PRIMARY KEY,
  is_enabled         boolean NOT NULL DEFAULT true,
  provider           text NOT NULL DEFAULT 'anthropic',
  model              text NOT NULL,
  system_prompt      text NOT NULL,
  tone               text,                    -- rasmiy | samimiy | qisqa
  languages          text[] NOT NULL DEFAULT '{uz,ru,en}',
  auto_reply_dm      boolean NOT NULL DEFAULT true,
  auto_reply_comment boolean NOT NULL DEFAULT true,
  auto_private_reply boolean NOT NULL DEFAULT true,
  reply_delay_seconds int NOT NULL DEFAULT 5,     -- "bot" ko'rinmasligi uchun
  max_ai_turns       int NOT NULL DEFAULT 6,      -- keyin odamga uzatiladi
  min_confidence     numeric(3,2) NOT NULL DEFAULT 0.65,
  working_hours      jsonb,                       -- ish vaqtidan tashqarida AI, ichida odam?
  escalation_keywords text[] NOT NULL DEFAULT '{}',
  banned_topics      text[] NOT NULL DEFAULT '{}',
  disclose_ai        boolean NOT NULL DEFAULT true -- "Men AI yordamchiman" deb aytish
);

CREATE TABLE marketing.knowledge_chunks (        -- RAG bazasi
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  source      text,                              -- 'faq' | 'product' | 'price_list' | 'doc'
  source_ref  text,
  title       text,
  content     text NOT NULL,
  embedding   vector(1536),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_kc_embedding ON marketing.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE marketing.auto_rules (              -- AI'dan oldin ishlaydigan deterministik qoidalar
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  scope        text NOT NULL,                    -- 'comment' | 'dm' | 'both'
  priority     int NOT NULL DEFAULT 100,
  match_type   text NOT NULL,                    -- keyword | regex | intent | any
  match_value  text,
  conditions   jsonb NOT NULL DEFAULT '{}',      -- {account_ids:[], only_ads:true, hours:...}
  action       text NOT NULL,                    -- reply|private_reply|hide|delete|assign|tag|escalate|ignore
  action_payload jsonb NOT NULL DEFAULT '{}',
  is_active    boolean NOT NULL DEFAULT true
);

CREATE TABLE marketing.ai_interactions (         -- audit + sifat nazorati
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  kind           text NOT NULL,                  -- dm | comment
  ref_id         uuid,
  input_text     text,
  detected_intent text,
  confidence     numeric(4,3),
  retrieved_chunks uuid[],
  output_text    text,
  was_sent       boolean NOT NULL DEFAULT false,
  block_reason   text,                           -- guardrail sababi
  model          text,
  prompt_tokens  int,
  completion_tokens int,
  latency_ms     int,
  agent_edited   boolean NOT NULL DEFAULT false,
  agent_rating   int,                            -- 1..5, operator bahosi
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============ 4.10 RATE LIMIT KUZATUVI ============

CREATE TABLE marketing.api_usage (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid,
  business_object_id text,
  buc_type      text,                            -- pages|instagram|messenger|leadgen|ads_insights|ads_management
  call_count_pct int,
  total_cputime_pct int,
  total_time_pct int,
  est_regain_minutes int,
  access_tier   text,
  observed_at   timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. M1 — ULANISH (ONBOARDING) MODULI

### 5.1 OAuth oqimi (Facebook Login for Business)

**Frontend:** "Facebook/Instagram ulash" tugmasi → backend `/api/marketing/connect/start` ni chaqiradi →
backend `state` (CSRF, Redis'da 10 daqiqa) generatsiya qilib redirect URL qaytaradi.

```
https://www.facebook.com/v{VER}/dialog/oauth
  ?client_id={APP_ID}
  &redirect_uri={CALLBACK}          # App Dashboard'da Valid OAuth Redirect URIs ro'yxatida bo'lishi shart
  &state={CSRF}
  &response_type=code
  &config_id={CONFIG_ID}            # Facebook Login for Business konfiguratsiyasi
```
> `config_id` ishlatilganda `scope` **berilmaydi** — ruxsatlar konfiguratsiyada belgilangan.
> Ishlab chiqish bosqichida `config_id` siz `scope=...` bilan ham ishlash mumkin.

**Callback (`GET /api/marketing/connect/callback`):**

```
1. state ni Redis'dan tekshir (yo'q bo'lsa → 400)
2. code → short-lived token:
   GET /v{VER}/oauth/access_token?client_id=&redirect_uri=&client_secret=&code=
3. short → long-lived (60 kun):
   GET /v{VER}/oauth/access_token?grant_type=fb_exchange_token&client_id=&client_secret=&fb_exchange_token=
4. GET /v{VER}/debug_token?input_token={LL}&access_token={APP_ID}|{APP_SECRET}
   → scopes, granular_scopes, expires_at, data_access_expires_at ni saqla
5. GET /v{VER}/me/accounts?fields=id,name,access_token,tasks,
       instagram_business_account{id,username,profile_picture_url},
       subscribed_apps{subscribed_fields}
6. GET /v{VER}/me/adaccounts?fields=id,name,currency,timezone_name,account_status
   (yoki GET /{business_id}/client_ad_accounts, /owned_ad_accounts)
7. Foydalanuvchiga qaysi Page/IG/Ad account'ni ulashni tanlatish (UI'da checkbox)
8. Tanlanganlar uchun webhook obunasi:
   POST /v{VER}/{PAGE_ID}/subscribed_apps
        ?subscribed_fields=messages,messaging_postbacks,messaging_referrals,messaging_handovers,
          message_echoes,message_reactions,messaging_seen,standby,messaging_policy_enforcement,
          feed,leadgen,mention
        &access_token={PAGE_TOKEN}
   Instagram Login yo'lida:
   POST https://graph.instagram.com/v{VER}/{IG_ID}/subscribed_apps
        ?subscribed_fields=messages,comments,live_comments,mentions,message_reactions,
          messaging_postbacks,messaging_referral,messaging_seen,standby
9. Tokenlarni AES-256-GCM bilan shifrlab saqla, granted_scopes ni yozib qo'y
```

**Instagram Login yo'li (Page'siz akkauntlar):**
```
https://www.instagram.com/oauth/authorize
  ?client_id={IG_APP_ID}&redirect_uri={CB}&response_type=code&state={CSRF}
  &scope=instagram_business_basic,instagram_business_manage_messages,
         instagram_business_manage_comments,instagram_business_manage_insights,
         instagram_business_content_publish

POST https://api.instagram.com/oauth/access_token      → short-lived (1 soat)
GET  https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=&access_token=
GET  https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=
```
⚠️ IG long-lived tokenni yangilash uchun u **kamida 24 soatlik va hali muddati o'tmagan** bo'lishi kerak
(rasmiy hujjatda tasdiqlanmagan, lekin amalda shunday). **Har 45 kunda avtomatik yangilovchi Hangfire job yozing.**

### 5.2 Token salomatligi (Hangfire recurring job, har kuni)

```
Har bir aktiv connection uchun:
  GET /debug_token → is_valid, expires_at, data_access_expires_at, granular_scopes
  Agar is_valid=false yoki 190/OAuthException → status='needs_reauth',
    CRM ichida bildirishnoma + email yubor.
  Agar data_access_expires_at < now()+14 kun → foydalanuvchiga
    "qayta ruxsat bering" bannerini ko'rsat (auth_type=reauthorize).
  Agar IG long-lived token 45 kundan oshgan → refresh_access_token chaqir.
  Har bir Page uchun GET /{page_id}/subscribed_apps → webhook obunasi
    tushib qolgan bo'lsa qayta obuna qil (bu jimgina buziladi!).
```

**190 xatoning subkodlari (foydalanuvchiga to'g'ri xabar ko'rsatish uchun):**

| subcode | Sabab | Foydalanuvchiga xabar |
|---|---|---|
| 458 | Ilova olib tashlangan | "Ulanishni qayta amalga oshiring" |
| 459 | Akkaunt checkpoint'da | "Facebook'ga kirib akkauntingizni tasdiqlang" |
| 460 | **Parol o'zgargan** | "Parolingiz o'zgardi — qayta ulaning" |
| 463 | Token muddati tugagan | "Ulanish muddati tugadi" |
| 467 | Token bekor qilingan | "Ruxsat bekor qilingan" |
| 492 | Page'da rol yo'q | "Sizda bu sahifada admin huquqi yo'q" |

---

## 6. M2 — WEBHOOK GATEWAY

### 6.1 Endpoint

`GET /api/marketing/webhooks/meta` — tekshiruv (verification):
```csharp
// hub.mode == "subscribe" && hub.verify_token == config
// → Content-Type: text/plain, body = hub.challenge (o'zgartirmasdan!)
```

`POST /api/marketing/webhooks/meta` — hodisalar.

### 6.2 Imzo tekshirish — MAJBURIY

```csharp
// Program.cs — RAW body ni o'qish uchun:
app.Use(async (ctx, next) => { ctx.Request.EnableBuffering(); await next(); });

// Handler ichida:
var raw = await ReadRawBodyBytesAsync(ctx.Request);       // ⚠️ JSON parse QILINMAGAN xom baytlar!
var header = ctx.Request.Headers["X-Hub-Signature-256"];  // "sha256=<hex>"
var expected = Convert.ToHexString(
    HMACSHA256.HashData(Encoding.UTF8.GetBytes(appSecret), raw)).ToLowerInvariant();
if (!CryptographicOperations.FixedTimeEquals(              // ⚠️ constant-time!
        Encoding.UTF8.GetBytes(expected),
        Encoding.UTF8.GetBytes(header.ToString()["sha256=".Length..])))
    return Results.Unauthorized();
```
> **Eng ko'p uchraydigan xato:** ASP.NET model binding JSON'ni parse qilib qayta serializatsiya qiladi va
> imzo mos kelmaydi. **Xom baytlar** bilan hisoblang. `X-Hub-Signature` (SHA1) — eski, ishlatmang.

### 6.3 Qabul qilish siyosati

```
1. Imzoni tekshir → noto'g'ri bo'lsa 401 (lekin logga yoz).
2. Payload'ni webhook_events ga xom holda INSERT qil (dedupe_key bilan).
   Konflikt (takror) bo'lsa → jimgina 200 qaytar.
3. Hangfire'ga job qo'y: ProcessWebhookEvent(eventId).
4. DARHOL 200 OK qaytar. Maqsad: < 500 ms, hech qachon > 5 s.
   ⚠️ LLM chaqirig'ini webhook handler ichida QILMANG.
```

**Meta'ning retry siyosati:** muvaffaqiyatsiz bo'lsa darhol, keyin **36 soat** davomida kamayib boruvchi
chastotada qayta yuboradi. Uzoq muddat javob bermasangiz — webhook **o'chirib qo'yiladi** va admin'ga email keladi.
Bitta so'rovda **1000 tagacha** yangilanish bo'lishi mumkin. **Tartib kafolatlanmaydi** → `timestamp` bo'yicha saralang.

### 6.4 Marshrutlash (routing)

```
object == "page"      → entry[].id  = PAGE_ID
object == "instagram" → entry[].id  = IG_USER_ID
→ social_accounts.external_id bo'yicha tenant_id ni topish

entry[].messaging[]  → DM hodisalari  (M3)
entry[].standby[]    → ⚠️ ALOHIDA MASSIV! `messaging` deb o'qisangiz butunlay yo'qotasiz
entry[].changes[]    → field bo'yicha: comments / live_comments / mentions / feed / leadgen
entry[].field+value  → ⚠️ Instagram Login yo'lida `changes` massivi YO'Q, to'g'ridan-to'g'ri field/value
```

**Parser ikkala shaklni ham qo'llab-quvvatlashi SHART:**

```csharp
// Instagram Login:  { entry: [{ id, time, field: "comments", value: {...} }] }
// Facebook Login:   { entry: [{ id, time, changes: [{ field: "comments", value: {...} }] }] }
IEnumerable<(string field, JsonElement value)> ExtractChanges(JsonElement entry)
{
    if (entry.TryGetProperty("changes", out var changes))
        foreach (var c in changes.EnumerateArray())
            yield return (c.GetProperty("field").GetString()!, c.GetProperty("value"));
    else if (entry.TryGetProperty("field", out var f))
        yield return (f.GetString()!, entry.GetProperty("value"));
}
```

Xuddi shu sabab: IG comment'da ID maydoni **Instagram Login'da `value.id`**, **Facebook Login'da `value.comment_id`**.

---

## 7. M3 — UNIFIED INBOX (DM)

### 7.1 Kiruvchi xabar webhook'i

```json
{
  "object": "page",
  "entry": [{
    "id": "<PAGE_ID yoki IG_ID>",
    "time": 1518479195594,
    "messaging": [{
      "sender":    { "id": "<PSID yoki IGSID>" },
      "recipient": { "id": "<PAGE_ID yoki IG_ID>" },
      "timestamp": 1518479195308,
      "message": {
        "mid": "mid.$cAAJdkrCd2ORnva8...",
        "text": "Salom, narxi qancha?",
        "quick_reply": { "payload": "PRICING" },
        "reply_to": { "mid": "m_1fTq8oLumEyIp3Q2MR..." },
        "attachments": [{ "type": "image", "payload": { "url": "<CDN_URL>" } }]
      }
    }]
  }]
}
```

Boshqa hodisa turlari (`messaging[]` ichida):

| Kalit | Ma'no | CRM'da nima qilish |
|---|---|---|
| `message.is_echo: true` | **Biz** yuborgan xabar (shu jumladan Meta Business Suite'dan!) | Suhbatga `author_kind='meta_inbox'` bilan yoz, **navbatdagi AI javobini bekor qil** |
| `message.is_deleted: true` | Foydalanuvchi xabarni o'chirdi | UI'dan olib tashla, matnni bazadan tozala (Platform Terms talabi) |
| `message.is_unsupported: true` | Qo'llab-quvvatlanmagan media | Placeholder ko'rsat, xato deb hisoblama |
| `message.reply_to.story.{id,url}` | **Story'ga javob** | `is_story_reply=true`, story rasmini darhol ko'chirib ol |
| `attachments[].type = "story_mention"` | Story'da eslatib o'tildi | Alohida belgila |
| `attachments[].type = "ig_post"` | IG post ulashildi (2025-10-30 dan) | ⚠️ Eski `share` turi 2026-02-01 da olib tashlandi — `ig_post` ni parse qiling |
| `postback.{mid,title,payload}` | Tugma/Get Started bosildi | 24 soatlik oynani ochadi |
| `reaction.{mid,action,emoji}` | Reaksiya | UI'da ko'rsat |
| `read.watermark` / `delivery.watermark` | O'qildi/yetkazildi | ⚠️ `mids` bo'lmasligi mumkin — **`watermark` bo'yicha** holatni yangilang |
| `referral.{ref,ad_id,source,ads_context_data}` | Reklama/m.me orqali kirdi | Atributsiya (§12) |

### 7.2 Javob yuborish

```
POST https://graph.facebook.com/v{VER}/{PAGE_ID}/messages     # Messenger va FB-Login IG
POST https://graph.instagram.com/v{VER}/{IG_ID}/messages      # Instagram Login
```

```json
{
  "recipient": { "id": "<PSID/IGSID>" },
  "messaging_type": "RESPONSE",
  "message": { "text": "Assalomu alaykum! Narxlar ro'yxatini yuboraman." }
}
```
Javob: `{ "recipient_id": "...", "message_id": "..." }`

**Yozish indikatori — ALOHIDA so'rov bo'lishi shart** (`message` bilan birga yuborib bo'lmaydi):
```json
{ "recipient": { "id": "<PSID>" }, "sender_action": "mark_seen" }
{ "recipient": { "id": "<PSID>" }, "sender_action": "typing_on" }
```
AI javobi ketma-ketligi: `mark_seen` → `typing_on` → LLM chaqiruvi → xabar yuborish.

**Cheklovlar:**

| | Messenger | Instagram |
|---|---|---|
| Matn | 2000 belgi | **1000 BAYT** (belgi emas!) |
| Media | 25 MB | rasm 8 MB, audio/video/pdf 25 MB |
| Quick replies | 13 ta, title 20 belgi | 13 ta, title 20 belgi, faqat mobil |
| Generic template | 10 ta element, 3 tugma | 10 ta element, 3 tugma, faqat mobil |

> ⚠️ Instagram'da 1000 **bayt** limiti — emoji va kirill/o'zbek lotin harflari ko'p joy egallaydi.
> `Encoding.UTF8.GetByteCount(text) <= 1000` bilan tekshiring, `text.Length` bilan emas.

### 7.3 XABAR OYNALARI — ENG MUHIM SIYOSAT QISMI

```
24 SOATLIK STANDART OYNA
  Ochiladi: foydalanuvchi xabar yozganda, tugma bosganda, quick reply tanlaganda,
            Click-to-Messenger reklamasini bosganda, m.me link orqali kirganda.
  Ichida: reklama/promo mazmun RUXSAT ETILGAN.
  Tashqarisida: xato 10 / subcode 2534022 yoki 2018278.

7 KUNLIK HUMAN_AGENT TEGI
  { "messaging_type": "MESSAGE_TAG", "tag": "HUMAN_AGENT", "message": {...} }
  Talab: App Review'dan "Human Agent" feature + Business Verification.
  🔴 FAQAT HAQIQIY OPERATOR YOZGAN XABAR uchun. AI javobiga bu tegni QO'YMANG.
     Meta hujjati: "a business representative to MANUALLY respond".
     AI bilan ishlatish — akkaunt cheklanishiga olib keladi.
```

**⚠️ 2026-yil fevralida katta o'zgarish:** `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`,
`POST_PURCHASE_UPDATE` teglari **2026-02-10 da o'chirildi**. Amalda **`HUMAN_AGENT` yagona
ishlaydigan teg** bo'lib qoldi. Ularning o'rniga **Utility Messages** (shablonli xabarlar) keldi:
```
POST /{PAGE_ID}/message_templates   { name, language, category:"UTILITY", components:[...] }
GET  /{PAGE_ID}/message_templates?name=...
```
⚠️ Utility Messages Instagram'da mavjud emas; `messaging_type: "UTILITY"` rasmiy Send API enum'ida yo'q — tekshiring.
Instagram'da One-Time Notification, Sponsored Messages, News Messaging **umuman ishlamaydi**.

**Kodda oyna nazorati (bu logika `MessageSender` servisida markazlashgan bo'lsin):**

```csharp
public enum SendDecision { AllowedInWindow, AllowedHumanAgent, Blocked }

SendDecision Decide(Conversation c, MessageAuthor author, DateTimeOffset now)
{
    if (c.WindowExpiresAt > now) return SendDecision.AllowedInWindow;
    if (author == MessageAuthor.Agent                 // faqat TIRIK operator
        && c.Channel is Channel.Messenger or Channel.InstagramDm
        && _features.HumanAgentApproved
        && c.HumanAgentExpiresAt > now)
        return SendDecision.AllowedHumanAgent;
    return SendDecision.Blocked;                      // UI'da sababini ko'rsat
}
```
UI'da oyna tugagan suhbatda yozish maydoni **bloklansin** va "24 soatlik oyna yopilgan —
mijoz javob yozishi kerak" deb tushuntirilsin. Operator uchun HUMAN_AGENT mavjud bo'lsa taymer ko'rsatilsin.

### 7.4 Handover / ikki marta javob berish muammosi

Bu — CRM inbox'ining **eng katta xatolik manbai**. Meta ochiq aytadi: "javoblarni Meta Inbox bilan
muvofiqlashtirish sizning zimmangizda".

**Messenger (Handover Protocol — hali kuchda):**
```
POST /v{VER}/me/pass_thread_control   { recipient:{id}, target_app_id, metadata }
POST /v{VER}/me/take_thread_control   { recipient:{id}, metadata }
POST /v{VER}/me/request_thread_control { recipient:{id}, metadata }
GET  /v{VER}/me/secondary_receivers
GET  /v{VER}/me/thread_owner?recipient={PSID}  → { data:[{ thread_owner:{ app_id } }] }
```
- Rollar App Dashboard + Page Settings → Advanced Messaging → App Settings da **qo'lda** belgilanadi.
- **Tavsiya etilgan topologiya:** CRM ilovangiz = **Primary Receiver**, Page Inbox = **Secondary Receiver**.
- Page Inbox app_id = `263902037430900` ⚠️ (rasmiy sahifada bosilmagan, amalda hamma shuni ishlatadi —
  ishga tushirishdan oldin `GET /me/secondary_receivers` bilan tekshiring).
- Standby holatida: hodisalarni **ko'rasiz**, lekin **yozolmaysiz** va postback payload'ini olmaysiz.

**Instagram (Handover Protocol 2025-10-23 da BEKOR QILINDI):**
Endi **Conversation Routing** ishlatiladi. Yangi maydonlar:
- `is_owner` (Conversations API xabarida) — bu tred bizniki mi?
- `reply_to` — javob zanjiri.

**Amaliy himoya qatlamlari (hammasini qo'shing):**
1. `standby[]` hodisalariga **hech qachon avtomatik javob bermang** — faqat UI'da ko'rsating.
2. Yuborishdan oldin `is_owner` / `GET /me/thread_owner` bilan tekshiring.
3. `is_echo` kelganda — shu suhbat uchun **navbatdagi AI javobini bekor qiling** (Redis'da
   `ai_pending:{conversationId}` kalitini o'chiring). Bu operator Business Suite'dan javob berganini bildiradi.
4. AI javobini **5–15 soniya kechiktirib** yuboring — shu vaqt ichida `is_echo` kelsa bekor bo'ladi.
5. Bitta suhbatga bir vaqtda faqat bitta AI javobi ketishi uchun Redis distributed lock ishlating.

⚠️ Yana bilib qo'ying: uchinchi tomon ilovasi orqali javob berish suhbatni **General papkaga ko'chiradi**,
papka ma'lumoti API'da **umuman ko'rinmaydi**, va "o'qilgan" holati faqat siz javob yuborganingizdan keyin
yangilanadi. Shuning uchun sizning `unread_count` mijoz ko'rgan raqamdan farq qiladi — buni UI'da
"CRM hisobi" deb ko'rsating.

### 7.5 Suhbat tarixini yuklash (bootstrap)

```
GET /v{VER}/{IG_ID}/conversations?platform=instagram
GET /v{VER}/{PAGE_ID}/conversations
GET /v{VER}/{CONVERSATION_ID}?fields=messages
GET /v{VER}/{MESSAGE_ID}?fields=id,created_time,from,to,message,reply_to,is_owner
```
**🔴 Qattiq cheklovlar:**
- **Faqat oxirgi 20 ta xabar** tafsilotini olish mumkin. To'liq tarixni backfill qilib bo'lmaydi.
- Requests papkasida 30+ kun harakatsiz suhbatlar **umuman qaytarilmaydi**.
- Conversations API: **sekundiga 2 ta so'rov** — bu eng qattiq limit. Ketma-ket navbat bilan yuklang.
- **Creator akkauntlar:** webhook kelishidan oldin **bir marta Conversations API chaqirilishi shart**,
  aks holda hech qanday hodisa kelmaydi. Ulanish paytida avtomatik chaqiring — bu "hech nima ishlamayapti"
  muammosining yashirin sababi.

> **Xulosa:** webhook — asosiy manba (system of record), Conversations API — faqat boshlang'ich yuklash.

---

## 8. M4 — COMMENT CENTER

### 8.1 Instagram izoh webhook'i

Facebook Login yo'lida (**ad_id shu yerda!**):
```json
{ "object": "instagram", "entry": [{ "id": "<IG_ID>", "time": 0, "changes": [{
  "field": "comments",
  "value": {
    "from": { "id": "<IGSID>", "username": "user123" },
    "comment_id": "<COMMENT_ID>",
    "parent_id": "<PARENT_COMMENT_ID>",
    "text": "Narxi qancha?",
    "media": {
      "id": "<MEDIA_ID>",
      "ad_id": "<AD_ID>",
      "ad_title": "<AD_TITLE>",
      "original_media_id": "<ORIGINAL_MEDIA_ID>",
      "media_product_type": "AD"
    }
  }}]}]}
```
Instagram Login yo'lida `changes` yo'q, `comment_id` o'rniga `id`, va **`ad_id` umuman yo'q**.

### 8.2 Facebook Page izoh webhook'i (`page` → `feed`)

```json
{ "object": "page", "entry": [{ "id": "<PAGE_ID>", "time": 1739450000, "changes": [{
  "field": "feed",
  "value": {
    "from": { "id": "<USER_ID>", "name": "Jane Doe" },
    "item": "comment",
    "verb": "add",
    "comment_id": "<POST_ID>_<COMMENT_ID>",
    "post_id": "<PAGE_ID>_<POST_ID>",
    "parent_id": "<PAGE_ID>_<POST_ID>",
    "created_time": 1739450000,
    "message": "Yetkazib berasizmi?"
  }}]}]}
```
- `item` qiymatlari: `post, comment, photo, video, share, status, reaction, like, mention, album, ...`
- `verb` qiymatlari: `add, edit, edited, remove, delete, hide, unhide, block, unblock, follow, mute, update`
- **Top-level yoki javob?** `parent_id == post_id` → top-level; aks holda — javob.
  ⚠️ `parent_id` Meta'ning rasmiy maydonlar jadvalida yo'q, lekin amalda keladi.
  Ishonchli zaxira: `GET /{comment_id}?fields=parent`.
- ⚠️ Meta `item:"comment"` uchun **rasmiy misol e'lon qilmagan** — yuqoridagi shakl amaliyotdan olingan.
- `verb:"remove"` ni albatta qayta ishlang — o'chirilgan izohga javob berish 100/200 xato beradi.

### 8.3 Izohga javob berish

**Instagram — ochiq javob:**
```
POST https://graph.facebook.com/v{VER}/{IG_COMMENT_ID}/replies
Content-Type: application/json
{ "message": "Rahmat! Narxlar DM'da 👇" }
→ { "id": "17873440459141029" }
```

**Facebook — ochiq javob:**
```
POST /v{VER}/{COMMENT_ID}/comments   { "message": "..." }
```
⚠️ Meta'ning `comment/comments` reference sahifasida "You can't perform this operation on this endpoint"
deb yozilgan, **lekin amalda ishlaydi** va barcha SMM CRM'lar shundan foydalanadi.
Zaxira yo'l: `POST /{POST_ID}/comments`. Facebook'da ichma-ich **maksimum 2 daraja** — javobga javob
o'sha treddagi asosiy izohga biriktiriladi.

**Yashirish / o'chirish:**
```
Instagram: POST /v{VER}/{IG_COMMENT_ID}?hide=true        → {"success": true}
           DELETE /v{VER}/{IG_COMMENT_ID}
Facebook:  POST /v{VER}/{COMMENT_ID}?is_hidden=true       ⚠️ `hide` EMAS, `is_hidden`!
           DELETE /v{VER}/{COMMENT_ID}
```
⚠️ **Kalit so'z filtri (hidden words) API'da YO'Q.** Meta'ning "yashirin so'zlar" sozlamasi faqat ilovada.
Filtrni o'zingiz qiling: webhook `text` ni tekshiring → `hide=true` chaqiring.

### 8.4 PRIVATE REPLY (izohdan DM'ga o'tkazish) — konversiyaning oltin nuqtasi

```
POST https://graph.facebook.com/v{VER}/{PAGE_ID}/messages          # Facebook
POST https://graph.facebook.com/v{VER}/{IG_ID}/messages            # Instagram (FB Login)
POST https://graph.instagram.com/v{VER}/{IG_ID}/messages           # Instagram (IG Login)

{ "recipient": { "comment_id": "<COMMENT_ID>" },
  "message": { "text": "Salom! Narxlar ro'yxatini yubordim 📋" } }
```

**🔴 QATTIQ QOIDALAR:**
1. **Bitta izohga FAQAT BIR MARTA** private reply yuborish mumkin. Ikkinchisi xato beradi.
   → `comments.private_reply_sent` flagini **yuborishdan OLDIN** transaksiya ichida qo'ying.
2. **7 kunlik oyna** — izoh yaratilganidan boshlab (post, reels va **reklama** uchun).
3. **Instagram Live izohlari** — faqat efir davomida. Efir tugagach imkonsiz.
4. Private reply — **bir tomonlama**. Mijoz javob yozsagina, standart **24 soatlik** oyna ochiladi.
5. Rate limit: post/reels izohlari uchun **soatiga 750 ta** akkaunt boshiga (Live uchun 100/sek).
   Bu — comment→DM avtomatizatsiyasining **asosiy cheklovi**. Navbat va throttle shart.

### 8.5 O'z izohingizga javob bermaslik (loop himoyasi) — 5 qatlam

```
1. Facebook: value.from.id == entry[].id (PAGE_ID) → o'zimiznikimi
   Instagram: value.from.id == entry[].id (IG_ID) yoki from.username == bizning username
   Qo'shimcha: Comment node'da `admin_creator` maydoni bo'lsa — Page admini yozgan.
2. YOZUV DAFTARI (majburiy): har yuborgan javobimizning qaytgan `id` sini saqlaymiz.
   Kiruvchi webhook comment_id shu ro'yxatda bo'lsa — tashlab yuboramiz.
   Bu boshqa vosita orqali yozilgan javoblarni ham ushlaydi.
3. parent_id bizning izohimizga ishora qilsa — javob bermaymiz.
4. Har tred uchun javob hisoblagichi + sovish vaqti (cooldown), masalan: 1 tredga max 2 javob / 1 soat.
5. Global "kill switch": tenant sozlamalarida bitta tugma bilan barcha avtomatikani o'chirish.
```
⚠️ Meta o'z izohlaringiz uchun webhook yubormaslikni **hech qayerda kafolatlamagan**. Yuboradi deb faraz qiling.

### 8.6 Reklama izohlari (marketing CRM uchun kritik)

**Instagram:** `value.media.ad_id` bor → pullik. Yo'q → organik **yoki dinamik reklama**.
⚠️ Meta hujjati: "dinamik reklamalarda ishlatilgan media uchun ad_id qaytarilmaydi".
Qo'shimcha tekshiruv: `media_product_type == "AD"`.

**Facebook — "dark post" (chop etilmagan reklama posti) muammosi:**
```
GET /v{VER}/{PAGE_ID}/ads_posts?include_inline_create=true&exclude_dynamic_ads=false&since=&until=
   Ruxsatlar: pages_manage_ads, pages_show_list, ads_management + Page'da ADVERTISE task
GET /v{VER}/{POST_ID}/comments?filter=stream

Muqobil: GET /v{VER}/{AD_ID}/adcreatives?fields=effective_object_story_id
         → bu ID = Page post ID → /comments
```
⚠️ **`feed` webhook'i dark post izohlari uchun ishga tushishi Meta hujjatida tasdiqlanmagan.**
Bu — reklama izohlari CRM'larining №1 nosozlik sababi (shuning uchun Agorapulse/NapoleonCat buni alohida
funksiya sifatida sotadi).
**Dizayn qarori:** FB reklama izohlari uchun webhook'ga **tayanmang**. Aktiv kampaniyalar uchun
`/{page_id}/ads_posts` ni **2–5 daqiqada bir marta** poll qiling, izoh ID'larini solishtiring,
webhook kelsa — dedup qiling.

### 8.7 Izohlarni o'qish

```
GET /v{VER}/{IG_MEDIA_ID}/comments?fields=id,text,timestamp,username,like_count,hidden,
      replies{id,text,timestamp,username}
   ⚠️ Sahifada maksimum 50 ta izoh. Standart — faqat top-level.
GET /v{VER}/{PAGE_POST_ID}/comments?filter=stream&order=chronological&summary=true
   filter=stream → barcha izohlar + javoblar xronologik (standart `toplevel` javoblarni yashiradi)
```
Yashirin cheklovlar: yosh chegarasi qo'yilgan media izohlari qaytarilmaydi; siz cheklagan
foydalanuvchilarning izohlari qaytarilmaydi. Ya'ni webhook kelgan izohni keyin o'qib bo'lmasligi mumkin.

---

## 9. M5 — AI JAVOB DVIGATELI

### 9.1 Umumiy oqim

```
Kiruvchi hodisa (DM yoki izoh)
   ↓
[1] Filtrlar: echo? o'zimiz? spam? bloklangan? standby? → to'xtat
   ↓
[2] Deterministik qoidalar (auto_rules, priority bo'yicha)
    Masalan: "narx" so'zi → tayyor javob + private reply
             "shikoyat|qaytarish|advokat" → darhol odamga
   ↓ (qoida topilmasa)
[3] Intent klassifikatsiyasi (kichik/tez model yoki embedding)
    Intent ro'yxati: narx_sorash, mahsulot_savol, yetkazib_berish, buyurtma_holati,
                     shikoyat, hamkorlik, spam, salomlashuv, boshqa
   ↓
[4] RAG: knowledge_chunks dan pgvector orqali top-5 kontekst
   ↓
[5] LLM javob generatsiyasi (system prompt + brend ovozi + kontekst + suhbat tarixi)
   ↓
[6] GUARDRAIL tekshiruvi (§9.3)
   ↓
[7] Kanal cheklovlari: uzunlik (IG 1000 bayt), oyna ochiqmi, thread owner'mi
   ↓
[8] Kechikish (5–15 s) + is_echo bekor qilish tekshiruvi
   ↓
[9] Yuborish → ai_interactions ga audit yozuvi
   ↓
[10] Eskalatsiya sharti bajarilsa → conversations.state = 'pending_human', operatorga bildirish
```

### 9.2 System prompt shabloni (tenant sozlamalarida saqlanadi)

```
Sen {{company_name}} kompaniyasining Instagram/Facebook sahifasidagi mijozlar bilan
ishlovchi yordamchisisan.

TIL: Mijoz qaysi tilda yozsa — shu tilda javob ber (o'zbek lotin, o'zbek kirill, rus, ingliz).
Aralash yozsa — asosiy tilni tanla.

USLUB: {{tone}}. Qisqa yoz — 1-3 gap. Emoji {{emoji_policy}}.

QAT'IY QOIDALAR:
- Faqat quyidagi KONTEKST'dagi ma'lumotga tayan. Kontekstda yo'q narsani O'YLAB TOPMA.
- Narx, muddat, mavjudlik, kafolat haqida kontekstda aniq raqam bo'lmasa —
  "operatorimiz aniq ma'lumot beradi" deb ayt va eskalatsiya qil.
- Tibbiy, huquqiy, moliyaviy maslahat berma.
- Karta raqami, parol, passport ma'lumotini SO'RAMA va qabul qilma.
- Raqobatchilar haqida gapirma.
- Chegirma, aksiya, bepul narsa VA'DA QILMA (kontekstda yozilmagan bo'lsa).
- Mijoz asabiy/norozi bo'lsa — bahslashma, uzr so'ra va odamga uzat.

{{#if disclose_ai}}
Birinchi javobingda qisqacha bildirib o't: "Men {{company_name}}ning avtomatik yordamchisiman,
kerak bo'lsa operatorga ulayman."
{{/if}}

KONTEKST:
{{retrieved_chunks}}

SUHBAT TARIXI:
{{last_10_messages}}

Javobingni FAQAT quyidagi JSON formatida ber:
{
  "reply": "<mijozga yuboriladigan matn>",
  "intent": "<aniqlangan intent>",
  "confidence": <0.0-1.0>,
  "should_escalate": <true|false>,
  "escalation_reason": "<sabab yoki null>",
  "suggested_tags": ["..."],
  "extracted": { "phone": null, "product": null, "quantity": null }
}
```

### 9.3 GUARDRAIL — yuborishdan oldingi tekshiruvlar (hammasi majburiy)

```csharp
// Har biri false qaytarsa → yubormaslik, ai_interactions.block_reason ga yozish,
// va (kritik bo'lsa) operatorga eskalatsiya.

bool[] Checks = {
  confidence >= settings.MinConfidence,          // past ishonch → odamga
  !should_escalate,
  !ContainsBannedTopic(reply, settings.BannedTopics),
  !ContainsPromise(reply),                       // "kafolatlayman","albatta","100%","bepul beramiz"
  !ContainsPii(reply),                           // karta, passport, parol
  !ContainsCompetitor(reply),
  !LooksLikeHallucinatedPrice(reply, context),   // kontekstda yo'q raqam paydo bo'lsa
  Utf8ByteCount(reply) <= channelLimit,
  aiTurnCount < settings.MaxAiTurns,             // 6 ta almashuvdan keyin odam
  !IsOutsideWindow(conversation),                // oyna yopiq → AI HECH QACHON yubormaydi
  IsThreadOwner(conversation),
  !RecentlyRepliedSameThread(conversation),      // takror himoyasi
  !IsQuietHours(settings.WorkingHours)           // ixtiyoriy
};
```

**Eskalatsiya (odamga uzatish) shartlari:**
- Mijoz "operator", "odam", "menejer", "shikoyat", "qaytarish", "sud", "advokat" deb yozsa
- 2 marta ketma-ket past `confidence`
- Salbiy tonallik (sentiment) aniqlansa
- AI navbati `max_ai_turns` dan oshsa
- To'lov/qaytarish/shaxsiy ma'lumot mavzusi
- Guardrail bloklagan holat

Eskalatsiya bo'lganda: `conversations.state='pending_human'`, SignalR orqali operatorlarga push,
mijozga bir marta "Hozir operatorimiz ulanadi" xabari (oyna ochiq bo'lsa).

### 9.4 Meta siyosati va AI

- ✅ Meta **Messenger/Instagram uchun** botni oshkor qilishni **majburiy qilmagan** (2026-08 holatiga).
  Lekin **aldash taqiqlanadi** — AI o'zini ismli tirik xodim deb tanishtirmasin.
- 🔴 **WhatsApp'da (agar keyinchalik qo'shsangiz):** 2026-01-15 dan **umumiy maqsadli AI chatbot'lar taqiqlangan**.
  Biznesga xos avtomatlashtirish (buyurtma, FAQ, lid saralash) — ruxsat. Va **odamga o'tish yo'li majburiy**.
- 🔴 **`HUMAN_AGENT` tegini AI bilan ishlatmang** (§7.3).
- Yuqori chastotali bot xatti-harakati, ma'nosiz xabarlar taqiqlangan.
- Xabarlarda karta/moliyaviy raqamlar so'ralmasin, tibbiy ma'lumot yig'ilmasin.
- **EU AI Act 50-modda** (agar EU mijozlaringiz bo'lsa) — Meta'dan qat'i nazar oshkor qilishni talab qiladi.
  Shuning uchun `disclose_ai` sozlamasini **standart holda yoqib qo'ying**.
- `messaging_policy_enforcement` webhook'iga **albatta obuna bo'ling** — bu Meta'ning ogohlantirishi,
  cheklov qo'yishidan oldingi signal. Kelganda darhol admin'ga alert yuboring va avtomatikani pauza qiling.

### 9.5 Operator interfeysi bilan integratsiya

- AI javobi **"taklif" rejimida** ham ishlay olsin: `ai_settings.auto_reply_dm = false` bo'lsa,
  javob generatsiya qilinadi lekin yuborilmaydi — operator ko'radi, tahrirlaydi, "Yuborish" bosadi.
  Bu — **ishga tushirishning eng xavfsiz boshlanishi**. Birinchi 2–4 hafta shu rejimda ishlating.
- Operator tahrirlasa → `ai_interactions.agent_edited = true` va asl/tahrir farqi saqlansin.
  Bu keyinchalik prompt'ni yaxshilash uchun eng qimmatli ma'lumot.
- Operator har javobga 1–5 baho qo'ya olsin (`agent_rating`).

---

## 10. M6 — LEAD CENTER (Instagram/Facebook reklama lidlari)

### 10.1 leadgen webhook

**⚠️ Instagram lidlari ham `page` obyekti orqali keladi** — alohida `instagram` leadgen webhook'i **yo'q**.
Manba `Lead.platform` maydonidan aniqlanadi.

```json
{ "object": "page", "entry": [{
  "id": 153125381133,
  "time": 1438292065,
  "changes": [{ "field": "leadgen", "value": {
      "leadgen_id": 123123123123,
      "page_id": 123123123,
      "form_id": 12312312312,
      "adgroup_id": 12312312312,
      "ad_id": 12312312312,
      "created_time": 1440120384
  }}]}]}
```
- **Faqat 6 ta kalit.** `campaign_id` webhook'da **YO'Q** — lead node'dan oling.
- Bitta `entry` ichida **bir nechta `changes`** bo'lishi mumkin — sikl bilan yuring.
- `ad_id`/`adgroup_id` = 0 yoki yo'q bo'lishi mumkin: organik lid, Ad Preview, yoki sizda reklama
  akkauntiga huquq yo'q.
- `created_time` webhook'da **Unix**, Graph API'da **ISO-8601 matn**. Ikkalasini ham qo'llab-quvvatlang.

### 10.2 Lidni o'qish

```
GET /v{VER}/{LEAD_ID}?fields=created_time,id,ad_id,ad_name,adset_id,adset_name,
      campaign_id,campaign_name,form_id,is_organic,platform,partner_name,
      retailer_item_id,field_data,custom_disclaimer_responses,post_submission_check_result
```
```json
{
  "created_time": "2026-08-20T08:49:14+0000",
  "id": "1231231231231231",
  "ad_id": "23851...",
  "form_id": "12312312312",
  "platform": "ig",
  "is_organic": false,
  "field_data": [
    { "name": "full_name",    "values": ["Alisher Karimov"] },
    { "name": "phone_number", "values": ["+998901234567"] },
    { "name": "email",        "values": ["a@example.com"] }
  ],
  "custom_disclaimer_responses": [ { "checkbox_key": "optional_1", "is_checked": "1" } ]
}
```
⚠️ `values` — **doim massiv** (ko'p tanlovli savollar). `is_checked` — **matn** (`"1"` / `""`), bool emas.

**Ommaviy o'qish va webhook o'tkazib yuborilganini tuzatish (reconciliation):**
```
GET /v{VER}/{FORM_ID}/leads
    ?fields=created_time,id,ad_id,form_id,field_data,platform,is_organic
    &filtering=[{"field":"time_created","operator":"GREATER_THAN","value":1761945743}]
```
Operatorlar: `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`. Qiymat — Unix timestamp.
**Har 15 daqiqada** oxirgi ko'rilgan vaqtdan keyingi lidlarni tortadigan job yozing.

### 10.3 🔴 90 KUNLIK DEVOR

Meta lidlarni **taxminan 90 kun** saqlaydi, keyin ular "expired" bo'ladi (`lead_forms.expired_leads_count`
maydoni shuni ko'rsatadi). Rate limit formulasi ham 90 kunga bog'langan:
`200 × 24 × (oxirgi 90 kundagi lidlar soni)`.

**Xulosa:**
- Lidni **darhol** webhook orqali oling.
- `field_data` ni **xom holda** saqlang — keyin qayta olib bo'lmaydi.
- Reconciliation job'i **soatlar** oralig'ida ishlasin, haftalar emas.
- CRM — yagona ishonchli manba (system of record) va PII o'chirish majburiyati ham sizda.

### 10.4 🔴 "Leads Access" — lidlar kelmasligining №1 sababi

Ikki xil qatlam bor va ular alohida:

| Qatlam | Nima |
|---|---|
| **API ruxsati** | `leads_retrieval` + to'g'ri token — *ilova* chaqira olishi |
| **Biznes aktivi (Leads Access)** | Meta Business Suite → Settings → Integrations → **Leads access** — *kim* ko'ra olishi |

Meta hujjati: agar Page admini lidlarni sozlamagan bo'lsa — **barcha Page adminlari** ko'ra oladi.
Lekin biznes bir marta Leads Access'ni sozlagan bo'lsa — **faqat aniq belgilangan** shaxs/hamkor/CRM ko'radi.

**Leads Access'da 3 ta tab: People / Partners / CRM systems.**
Meta ochiq aytadi: "yangi CRM tizimlar avtomatik lid huquqini olmaydi" — mijoz uni **qo'lda yoqishi kerak**.

**Bu — "Ads Manager'da lid bor, CRM'da yo'q" muammosining asosiy sababi.**
→ Onboarding sehrgaringizda (wizard) **alohida qadam** qiling: skrinshotli yo'riqnoma bilan
"Meta Business Suite → Settings → Integrations → Leads access → CRM systems → bizni yoqing".
→ Ulanishdan keyin darhol test qiling: `GET /{page_id}/leadgen_forms` bo'sh qaytsa yoki
`GET /{lead_id}` 100/33 xato bersa — mijozga aniq ko'rsatma bilan banner chiqaring.

Business Manager orqali dasturiy tayinlash:
```
POST /v{VER}/{PAGE_ID}/assigned_users
  ?user={BUSINESS_SCOPED_USER_ID}&tasks=["MANAGE_LEADS"]
```
`MANAGE_LEADS` — aynan lid huquqiga mos keladigan task.

### 10.5 Formalar va maydon xaritalash

```
GET /v{VER}/{PAGE_ID}/leadgen_forms?fields=id,name,status,locale,questions,leads_count,
      organic_leads_count,expired_leads_count,created_time,context_card,thank_you_page,
      privacy_policy_url,block_display_for_non_targeted_viewer,tracking_parameters
```
`questions[].key` → lidda `field_data[].name` bo'lib qaytadi.
**🔴 Har doim `key` bo'yicha xaritalang, `label` bo'yicha emas** — label tarjima qilinadi va tahrirlanadi.

Standart `key` lar: `email`, `full_name`, `first_name`, `last_name`, `phone_number`, `city`,
`street_address`, `country`, `zip`, `date_of_birth`, `gender`, `job_title`, `company_name`, `work_email`.
`CUSTOM` savollar uchun — siz bergan yoki Meta generatsiya qilgan slug.

UI'da: har forma uchun **maydon xaritalash konstruktori** (chapda Meta savoli, o'ngda CRM maydoni,
`lead_forms.field_mapping` jsonb'ga saqlanadi). Xaritalanmagan maydonlar `leads.extra` ga tushadi.

### 10.6 Lid qayta ishlash quvuri (pipeline)

```
webhook → dedupe (leadgen_id) → GET /{leadgen_id} → field_data xom saqlash
  → field_mapping bo'yicha normallashtirish (telefon E.164, email lowercase+trim)
  → dublikat qidirish (telefon/email bo'yicha, pg_trgm)
  → CRM mijoz kartochkasi yaratish/yangilash
  → CRM deal/opportunity yaratish (voronka birinchi bosqichi)
  → menejerga tayinlash (round-robin yoki qoida bo'yicha)
  → SLA taymer ishga tushirish (masalan 15 daqiqa ichida qo'ng'iroq)
  → bildirishnoma (Telegram/SMS/push) — lid tezligi konversiyaning asosiy omili
  → CAPI'ga "Lead" hodisasini yuborish (§12)
```

### 10.7 Test

- **Lead Ads Testing Tool:** `https://developers.facebook.com/tools/lead-ads-testing`
  Page → forma → **Create Lead** → **Track Status** (webhook yetkazilganini va sizning HTTP javobingizni ko'rsatadi).
- API: `POST /v{VER}/{FORM_ID}/test_leads`, `GET /{FORM_ID}/test_leads`.
  Bir vaqtda **bitta test lid**; Advertiser roli kerak.
- ⚠️ Test lidlarda soxta qiymatlar bo'ladi — validatsiyangiz ularni rad etmasligi uchun bypass qo'ying.

### 10.8 2025–2026 yangiliklari (formaga qo'shilgan parametrlar)

`POST /{page_id}/leadgen_forms` endi quyidagilarni qabul qiladi:
`is_phone_sms_verify_enabled` (SMS/OTP tasdiqlash), `should_enforce_work_email` (korporativ email),
`is_lead_capture_ai_agent_enabled` (Meta'ning AI lid agenti), `is_optimized_for_quality`,
`upload_gated_file` (fayl evaziga lid), `allow_organic_lead_retrieval`.
Lead node'da: `post_submission_check_result` (`api_call_result`, `api_error_message`, `shown_thank_you_page`)
— "lid yetkazilmadi" muammosini diagnostika qilish uchun.
Shuningdek: **Advantage+ leads** kampaniyalari global ishga tushdi.

---

## 11. M7 — ADS ANALYTICS

### 11.1 Iyerarxiya va sinxronizatsiya

```
GET /v{VER}/me/adaccounts?fields=id,name,currency,timezone_name,account_status
GET /v{VER}/{BUSINESS_ID}/owned_ad_accounts     (permitted_tasks, access_type)
GET /v{VER}/{BUSINESS_ID}/client_ad_accounts
GET /v{VER}/act_{ID}/campaigns?fields=id,name,status,effective_status,objective,
       daily_budget,lifetime_budget,start_time,stop_time&limit=500
GET /v{VER}/act_{ID}/adsets?fields=id,name,campaign_id,status,effective_status,
       daily_budget,optimization_goal,attribution_spec
GET /v{VER}/act_{ID}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,
       creative{id,effective_object_story_id,thumbnail_url}
```
⚠️ `act_` prefiksi **faqat** ad account ID'da. Byudjet maydonlari — **minor unit** (tiyin/sent):
`5000` = 50.00 USD. Valyuta uchun `GET /act_{ID}?fields=currency,currency_offset`.
**Lekin `spend` metrikasi — major unit matn** (`"312.45"`). Bu assimetriya — eng ko'p uchraydigan xato.

### 11.2 Insights so'rovi

```
GET /v{VER}/act_{ID}/insights
  ?level=ad
  &fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,
          impressions,reach,frequency,spend,clicks,inline_link_clicks,
          cpc,cpm,ctr,inline_link_click_ctr,actions,action_values,
          cost_per_action_type,purchase_roas,attribution_setting,date_start,date_stop
  &time_range={"since":"2026-08-01","until":"2026-08-19"}
  &time_increment=1
  &breakdowns=publisher_platform,platform_position
  &action_breakdowns=action_type
  &action_attribution_windows=["7d_click","1d_view"]
  &limit=500
```
**`breakdowns=publisher_platform` — Instagram va Facebook xarajatini ajratishning yagona yo'li.**
Alohida "Instagram ads insights" endpoint'i **yo'q**.

**Barcha raqamli metrikalar JSON'da MATN sifatida keladi** — `decimal.Parse(..., InvariantCulture)` ishlating.

### 11.3 Lid va suhbat konversiyalarini `actions` dan ajratish

| `action_type` | Ma'nosi |
|---|---|
| `lead` | **Jami**: Meta ichidagi + piksel lidlari |
| `onsite_conversion.lead_grouped` | Instant Form (IG/FB ichida) lidlari |
| `offsite_conversion.fb_pixel_lead` | Saytdagi piksel `Lead` hodisasi |
| `onsite_conversion.messaging_conversation_started_7d` | Yangi yozishma boshlandi (Messenger/IG Direct/WhatsApp) |
| `onsite_conversion.messaging_first_reply` | Mijozning birinchi javobi |
| `link_click`, `landing_page_view` | Bosishlar |
| `omni_purchase`, `offsite_conversion.fb_pixel_purchase` | Xaridlar |

**🔴 Ikki marta hisoblash xavfi:** `lead ≈ onsite_conversion.lead_grouped + offsite_conversion.fb_pixel_lead`.
**Uchtasini qo'shmang.** Har akkaunt uchun bitta siyosat tanlang va uni hujjatlashtiring.

```csharp
static readonly string[] LeadTypes = {
    "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead" };
static readonly string[] MsgTypes = { "onsite_conversion.messaging_conversation_started_7d" };

// ⚠️ Qiymat 0 bo'lsa action_type MASSIVDA UMUMAN BO'LMAYDI → har doim TryGetValue
decimal Get(JsonElement row, string type) =>
    row.TryGetProperty("actions", out var a)
      ? a.EnumerateArray()
         .Where(x => x.GetProperty("action_type").GetString() == type)
         .Sum(x => decimal.Parse(x.GetProperty("value").GetString()!, CultureInfo.InvariantCulture))
      : 0m;
```
⚠️ `action_breakdowns` (masalan `action_device`) ishlatilsa — bitta `action_type` **bir necha qator**
bo'lib keladi, qo'shishdan oldin guruhlang.
⚠️ `action_attribution_windows` so'ralganda har elementga qo'shimcha kalitlar qo'shiladi
(`"7d_click": "27"`), `"value"` esa akkauntning umumiy sozlamasi bo'yicha jami.
⚠️ `offsite_conversion.*` demografik breakdown'lar (`age`, `gender`) bilan birga **qaytarilmaydi**.

### 11.4 Asinxron hisobotlar (katta hajm uchun)

```
POST /v{VER}/act_{ID}/insights  (GET emas, POST!)   → { "report_run_id": "6023920149050" }
GET  /v{VER}/{report_run_id}    → { async_status, async_percent_completion, time_completed }
GET  /v{VER}/{report_run_id}/insights?limit=500
```
`async_status`: `Job Not Started | Job Started | Job Running | Job Completed | Job Failed | Job Skipped`.
**Faqat `Job Completed` VA `async_percent_completion == 100`** bo'lganda o'qing (foiz statusdan oldin 100 bo'lishi mumkin).
Natijalar **30 kun** saqlanadi. Butun jarayon **1 soatgacha** cho'zilishi mumkin.

**Strategiya:** kunlik yangilanish uchun `date_preset=last_7d`, `level=campaign` — sinxron.
Backfill va `level=ad` + breakdown — asinxron.

### 11.5 Attribution (2026 holati)

- Ruxsat etilgan qiymatlar: `1d_click`, `7d_click`, `28d_click`, `1d_view`, `1d_ev`, `default`.
- ⚠️ **`7d_view` va `28d_view` 2026-01-12 dan barcha versiyalarda ma'lumot qaytarmaydi.**
- Ko'rsatilmasa — standart `7d_click`, `value` maydonida.
- `use_unified_attribution_setting` — **2025-06-10 dan e'tiborga olinmaydi**, Insights allaqachon
  Ads Manager bilan mos keladi.
- **Har doim `attribution_setting` maydonini so'rang** va bazaga yozing — u ad set'dan ad set'ga farq qiladi.
- ⚠️ Ma'lumot saqlash muddatlari (2026-01-12 dan, barcha versiyalar): jami — 37 oy,
  unique-* maydonlar va soatlik breakdown — 13 oy, `frequency_value` — 6 oy.

### 11.6 Rate limit va tier

Har javobda o'qing:
```
X-FB-Ads-Insights-Throttle: {"app_id_util_pct":100,"acc_id_util_pct":10,"ads_api_access_tier":"standard_access"}
X-Business-Use-Case-Usage:  {"<biz_id>":[{"type":"ads_insights","call_count":42,"total_cputime":10,
                             "total_time":15,"estimated_time_to_regain_access":0,"ads_api_access_tier":"..."}]}
X-App-Usage: {"call_count":30,"total_cputime":20,"total_time":25}
```
Kvota formulalari (soatiga, ad account uchun):
| | Quyi tier | Yuqori tier |
|---|---|---|
| ads_management | `300 + 40 × aktiv reklama` | `100000 + 40 × aktiv reklama` |
| **ads_insights** | `600 + 400 × aktiv reklama − 0.001 × xatolar` | `190000 + 400 × ...` |

**`− 0.001 × user_errors`** — sizning 4xx xatolaringiz kvotangizni kamaytiradi. Xatolarni tuzating, qayta urinmang.

**Xatolar:** `80000` (ads_insights BUC, subcode 2446079), `80004` (ads_management), `4` (app limit),
`17` (user limit), `613`, `100/1487534` (bir so'rovda juda ko'p ma'lumot → **oraliqni qisqartiring yoki
async'ga o'ting, backoff yordam bermaydi**).

**Backoff qoidalari:** `estimated_time_to_regain_access` (daqiqa) qancha ko'rsatsa — shuncha kuting.
Meta ochiq aytadi: limitga yetganda **chaqiruvni to'xtating**, davom etsangiz blok uzayadi.
Akkauntlarni soat davomida taqsimlang (hammasini 00:05 da ishga tushirmang), akkaunt boshiga
parallellik 1–2 ta.

⚠️ **Tier nomlari Meta hujjatlarining o'zida bir xil emas:** header'da `development_access`/`standard_access`,
jadvalda "Standard"/"Advanced", 2026-05-04 dan blog'da "Limited"/"Full". **Header qiymatiga tayaning.**
2026-05-04 dan yuqori tier'ga o'tish talablari yumshadi: 15 kunda ≥500 chaqiruv, oxirgi 500 chaqiruvda
xato darajasi <15%, skrinkast endi shart emas.

### 11.7 Organik statistika

**Instagram** (`GET /{IG_USER_ID}/insights`):
```
metric=views,reach,accounts_engaged,total_interactions,likes,comments,shares,saves,
       profile_links_taps,follows_and_unfollows
period=day & metric_type=total_value & since=&until=   (bir so'rovda max 30 kun)
breakdown=media_product_type | follow_type | contact_button_type
```
🔴 **`impressions` 2025-04-21 dan O'CHIRILDI → `views`.** `plays`, `clips_replays_count`,
`ig_reels_aggregated_all_plays_count` ham. ⚠️ `profile_views` joriy jadvalda yo'q — o'chirilgan deb hisoblang.
🔴 **Views ≠ impressions ≠ reach.** Tarixiy grafikni bu chegara orqali "chizib o'tmang" — buzilgan bo'ladi.
UI'da 2025-04-21 chizig'ini ko'rsating.

**Facebook Page:**
🔴 **2025-11-15 dan `impressions` va `page fans` barcha versiyalarda o'chirilgan → `views`, `page_follows`.**
⚠️ **2026-06-15 da yana bir guruh Page Insights metrikalari o'chirilgan** — aniq ro'yxat login talab qiladi.
`developers.facebook.com/docs/pages-api/platforminsights/page/deprecated-metrics` ni **tizimga kirgan
holda tekshiring** — bu hujjatdagi eng xavfli noaniqlik.

**Media insights** (`GET /{IG_MEDIA_ID}/insights`):
- Feed: `views, reach, likes, comments, saved, shares, total_interactions, profile_visits, follows`
- Reels: yuqoridagilar + `ig_reels_avg_watch_time, ig_reels_video_view_total_time, reels_skip_rate`
- Stories: `views, reach, replies, shares, navigation, profile_activity, follows`
  🔴 **Faqat 24 soat mavjud** — story metrikalarini shu oyna ichida snapshot qiling, aks holda butunlay yo'qoladi.
- Ma'lumot **48 soatgacha kechikadi**, **2 yil** saqlanadi.

---

## 12. M9 — ATRIBUTSIYA VA CAPI (natijani Meta'ga qaytarish)

### 12.1 Suhbat qaysi reklamadan kelganini bilish

**Ikkita yo'l bor — ikkalasini ham ushlash SHART** (bu — atributsiyaning №1 xatosi):

```
YANGI suhbat (foydalanuvchi "Get Started" bosadi):
  → referral ma'lumoti `messaging_postbacks` ICHIDA: postback.referral.{ref, ad_id, source, ads_context_data}

MAVJUD suhbat (qaytgan foydalanuvchi reklamani bosadi):
  → alohida `messaging_referrals` hodisasi + 24 soatlik oyna QAYTA OCHILADI
```
Faqat `messaging_referrals` ni tinglasangiz — **birinchi marta yozgan har bir mijozning atributsiyasini yo'qotasiz.**

```json
{ "referral": {
    "ref": "camp_summer_2026",
    "ad_id": "23851234567890",
    "source": "ADS",
    "type": "OPEN_THREAD",
    "ads_context_data": {
      "ad_title": "Yozgi chegirma", "photo_url": "...", "post_id": "...",
      "product_id": "...", "flow_id": "..." }}}
```
`source`: `ADS`, `SHORTLINK` (⚠️ boshqa qiymatlar ham bo'lishi mumkin — enum sifatida `switch` yozmang, matn deb qarang).
`ref` — reklama URL Params maydonida beriladi, **maksimum 2083 belgi, faqat alfanumerik** (maxsus belgilar yo'q).
→ Amalda: base64url yoki qisqa kampaniya kodi bering, serverda ochib oling.

`m.me` formatlari:
```
http://m.me/PAGE-NAME
http://m.me/PAGE-NAME?ref=CAMPAIGN_CODE
http://m.me/PAGE-NAME?text=Salom
```

Zaxira yo'l: `GET /{PSID}?fields=last_ad_referral` — webhook o'tkazib yuborilgan bo'lsa.

⚠️ Meta'ning "New Conversations" metrikasi bilan sizning suhbatlar soningiz **qonuniy ravishda farq qiladi**:
foydalanuvchi hech narsa yozmaguncha (yoki tugma bosmaguncha) suhbat reklama beruvchiga ko'rinmaydi.

### 12.2 Conversions API — lid sifatini Meta'ga qaytarish

Bu narsa **reklama optimizatsiyasini tubdan yaxshilaydi**: Meta faqat "lid keldi" emas, "qaysi lid
haqiqiy mijoz bo'ldi" ni o'rganadi.

```
POST https://graph.facebook.com/v{VER}/{DATASET_ID}/events?access_token={TOKEN}
```
```json
{ "data": [{
    "event_name": "Qualified Lead",
    "event_time": 1755600000,
    "action_source": "system_generated",
    "event_id": "<META_LEAD_ID>_<STATUS_CHANGED_UNIX>",
    "user_data": {
      "lead_id": 1234567890123456,
      "em": ["<sha256(normalized_email)>"],
      "ph": ["<sha256(normalized_phone)>"]
    },
    "custom_data": { "lead_event_source": "MyCRM", "event_source": "crm" }
  }],
  "access_token": "<TOKEN>" }
```

**Hashlash qoidalari (SHA-256, hex, kichik harf):**

| Maydon | Normallashtirish |
|---|---|
| `em` | trim + lowercase |
| `ph` | faqat raqamlar, boshidagi nollarni olib tashlash, **mamlakat kodi bilan** (998...) |
| `fn`,`ln` | lowercase, tinish belgilarisiz |
| `db` | `YYYYMMDD` |
| `ct`,`st`,`zp`,`country` | lowercase, bo'shliqsiz; country — ISO alpha-2 |

**🔴 HASHLANMAYDIGANLAR:** `lead_id` (Meta lid ID — **hashlamang!**), `client_ip_address`,
`client_user_agent`, `fbc`, `fbp`, `page_id`, `page_scoped_user_id`, `ctwa_clid`,
`ig_account_id`, `ig_sid`, `external_id` (hashlash tavsiya etiladi lekin izchil bo'lsin).

**Muhim cheklovlar:**
- `event_time` **7 kundan eski bo'lmasin** — aks holda **butun so'rov rad etiladi**.
- Bir so'rovda **1000 tagacha** hodisa.
- Deduplikatsiya: `event_name` + `event_id`, **48 soatlik** oyna.
- `test_event_code` ni produksiyada **olib tashlang**.

**Conversion Leads uchun Meta talablari:** oyiga **kamida 200 lid**, kuniga kamida bir marta yuklash,
maqsadli bosqich lid kelganidan **28 kun ichida** sodir bo'lishi, konversiya darajasi **1%–40%** oralig'ida.
O'rganish bosqichi 2–4 hafta.

**Business Messaging uchun CAPI** (suhbatdan kelgan savdolarni qaytarish):
```
action_source: "business_messaging"
messaging_channel: "messenger" | "instagram" | "whatsapp"
user_data (messenger):  { page_id, page_scoped_user_id }
user_data (instagram):  { instagram_business_account_id, ig_sid }
partner_agent: "<CRM nomi>"
```
Qo'llab-quvvatlanadigan hodisalar: `Purchase, LeadSubmitted, InitiateCheckout, AddToCart, ViewContent,
OrderCreated, OrderShipped, OrderDelivered, OrderCanceled, OrderReturned, CartAbandoned,
QualifiedLead, RatingProvided, ReviewProvided`.

**CRM ichida:** `leads.lead_status` o'zgarganda avtomatik CAPI hodisasi yuboriladigan Hangfire job qiling
(`new → contacted → qualified → won`). `leads.capi_sent_at` bilan takrorni oldini oling.

---

## 13. M8 — CONTENT SCHEDULER

### 13.1 Instagram — ikki bosqichli oqim

```
1) POST /v{VER}/{IG_USER_ID}/media          → { "id": "<CONTAINER_ID>" }
2) GET  /v{VER}/{CONTAINER_ID}?fields=status_code,status
      → EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
3) POST /v{VER}/{IG_USER_ID}/media_publish?creation_id={CONTAINER_ID}  → { "id": "<MEDIA_ID>" }
```

**Parametrlar:**

| Parametr | Qaerda |
|---|---|
| `media_type` | `IMAGE`(standart) `VIDEO` `REELS` `STORIES` `CAROUSEL` |
| `image_url` / `video_url` | **Ochiq HTTPS URL** — Meta o'zi yuklab oladi |
| `caption` | ≤2200 belgi, ≤30 hashtag, ≤20 mention. **Karusel bolalarida ishlamaydi** |
| `alt_text` | faqat yakka rasm, ≤1000 belgi (2025-03-24 dan) |
| `is_carousel_item` | karusel bolalarida `true` |
| `children` | karusel ota-onasida, ≤10 container ID |
| `cover_url`, `thumb_offset` | REELS muqovasi |
| `share_to_feed` | faqat REELS |
| `audio_name` | faqat REELS, **bir marta** o'zgartiriladi |
| `collaborators` | ≤3 username, ular qabul qilishi kerak |
| `user_tags`, `product_tags`, `location_id` | teglar |
| `upload_type=resumable` | lokal fayl yuklash uchun (`rupload.facebook.com`) |

**🔴 Instagram'da native rejalashtirish YO'Q.** `scheduled_publish_time` parametri mavjud emas va
container **24 soatdan keyin o'ladi**. Demak:
- Rejalashtirilgan vaqtni **o'z navbatingizda** (Hangfire) saqlaysiz.
- Container'ni **oldindan yaratmang** — faqat chop etish vaqti kelganda.
- Oqim: job ishga tushdi → container yaratildi → 1 daqiqada bir status → FINISHED → publish.
- Meta tavsiyasi: "daqiqada bir marta, 5 daqiqadan ko'p emas". Katta reels bundan uzoq ketishi mumkin —
  eksponensial backoff qiling, 5 daqiqadan keyin "yumshoq xato" deb qayta urinishga qo'ying.

**Chop etish limiti:**
```
GET /v{VER}/{IG_USER_ID}/content_publishing_limit?fields=config,quota_usage
→ { "data": [{ "quota_usage": 2, "config": { "quota_total": 50, "quota_duration": 86400 } }] }
```
✅ Rasmiy qo'llanmada **24 soatda 100 post** deb yozilgan (karusel = 1 post).
⚠️ Reference sahifadagi namunada `quota_total: 50` turadi, karusel bo'limida ham 50 uchraydi.
**Ikkalasini ham kodga yozmang** — `config.quota_total` ni ish vaqtida o'qing va navbatni shunga
qarab cheklang. Limit `media_publish` bosqichida tekshiriladi (container yaratishda emas).

**Media talablari:**
- Rasm: **faqat JPEG**, ≤8 MB, nisbat 4:5–1.91:1, kenglik 320–1440 px, sRGB.
- Reels: MOV/MP4, ≤300 MB, **3–900 s**, 9:16, ≤25 Mbps, H.264/HEVC, audio AAC 48 kHz.
- Story rasm: JPEG ≤8 MB; Story video: ≤100 MB, **3–60 s**.
- Karusel: 2–10 element, birinchi elementning nisbatiga qirqiladi.

### 13.2 Facebook Page

```
POST /v{VER}/{PAGE_ID}/feed      ?message=&link=&published=true|false&scheduled_publish_time=<unix>
POST /v{VER}/{PAGE_ID}/photos    ?url=&caption=&published=
POST /v{VER}/{PAGE_ID}/videos
POST /v{VER}/{PAGE_ID}/video_reels   (upload_phase: start → upload → finish)
POST /v{VER}/{PAGE_ID}/photo_stories | /video_stories
```
Reels oqimi:
```
1) {"upload_phase":"start"} → { video_id, upload_url }
2) POST https://rupload.facebook.com/video-upload/v{VER}/{video_id}
   Headers: Authorization: OAuth {token}, offset: 0, file_size: {bytes}   (yoki file_url: <https url>)
3) ...?upload_phase=finish&video_id=&video_state=PUBLISHED|SCHEDULED|DRAFT&description=
```
FB Reels: 9:16, 1080×1920, **3–90 s** (story sifatida 60 s), limit **24 soatda 30 post**.

**🔴 Rejalashtirish oynasi:**
- `/page/feed` rasmiy reference: **10 daqiqa – 75 kun** (✅ tasdiqlangan).
- Pages API qo'llanmasida **30 kun** deb yozilgan — sahifalar zid.
- ("6 oy" degan keng tarqalgan ma'lumot **noto'g'ri**.)
→ Xavfsiz yo'l: CRM'da **10 daqiqa – 30 kun** ni majburiy qiling (ikki hujjatning kesishmasi),
undan uzog'ini o'z navbatingizda (Hangfire) saqlab, vaqti kelganda joylang.
Yozgandan keyin `scheduled_publish_time` ni qayta o'qib Meta nimani qabul qilganini tasdiqlang.

### 13.3 Publisher'ning muhim nuqtalari

1. **Ochiq HTTPS URL majburiy.** Presigned S3 link'lar butun create→poll→publish siklidan uzoqroq yashashi kerak.
   Auth, IP cheklov, redirect — ishlamaydi. Eng yaxshisi: media'ni o'z CDN'ingizda saqlang.
2. **Chop etilgan IG media'ni API orqali tahrirlab ham, o'chirib ham bo'lmaydi.** UI'da shuni ochiq yozing.
3. **Page Publishing Authorization (PPA)** — ba'zi Page'lar chop etishdan oldin buni o'tishi kerak va
   **sizning ilovangiz buni aniqlay olmaydi**. Onboarding'da ogohlantiring — bu jimgina nosozlik manbai.
4. Xatolar (⚠️ rasmiy sahifa mavjud emas, uchinchi tomon manbasidan):
   `2207052` media yuklab bo'lmadi (eng ko'p uchraydi), `2207020` container muddati o'tdi,
   `2207003` timeout, `2207005` JPEG emas, `2207009` nisbat noto'g'ri, `2207010` caption uzun,
   `2207026` video kodek, `2207042` kunlik limit, `2207001` spam deb belgilandi.
5. **Token muddati** — soat 3:00 da ishga tushgan job'ning tokeni o'lik bo'lishi produksiyadagi
   eng ko'p uchraydigan nosozlik. System User token ishlating yoki job boshida token validatsiyasi qiling.

---

## 14. FRONTEND (React) — EKRANLAR

```
/marketing
  ├── /dashboard          KPI: bugungi lidlar, javob berilmagan DM, CPL, ROAS, AI javoblar ulushi
  ├── /inbox              Unified Inbox
  ├── /comments           Comment Center
  ├── /leads              Lead Center
  ├── /ads                Ads Analytics
  ├── /content            Content Scheduler (kalendar)
  ├── /ai                 AI sozlamalari + Bilim bazasi + Qoidalar
  └── /settings           Ulanishlar, akkauntlar, ruxsatlar holati
```

### 14.1 Inbox (`/marketing/inbox`)

Uch panelli tartib:
- **Chap:** suhbatlar ro'yxati. Filtrlar: kanal (IG/FB), holat (bot/odam kutmoqda/yopiq),
  tayinlangan operator, teg, "oyna yopilmoqda" (2 soatdan kam qolgan), qidiruv.
  Har kartochkada: avatar, ism, oxirgi xabar, kanal ikonkasi, **24 soatlik taymer**,
  reklama manbasi bo'lsa 📢 belgisi.
- **Markaz:** xabarlar tasmasi. AI javoblari boshqa rangda + "🤖 AI" belgisi.
  Story javoblari alohida ko'rinishda. Yuborilmagan/xato xabarlar qizil + sabab.
  Pastda: matn maydoni + **bayt hisoblagichi** (IG uchun 1000), tez javoblar, media biriktirish.
  **Oyna yopiq bo'lsa** — maydon bloklanadi va sabab yoziladi; Human Agent mavjud bo'lsa
  operator uchun "7 kunlik oyna" tugmasi (AI uchun emas!).
- **O'ng:** mijoz kartochkasi — CRM profil linki, oldingi buyurtmalar, teglar, izohlar,
  manba reklama (kampaniya nomi + xarajat), "AI'ni bu suhbatda o'chirish" tugmasi,
  "Menga tayinlash" / "Yopish".

SignalR: `ConversationUpdated`, `MessageReceived`, `MessageStatusChanged`, `EscalationRaised`.

### 14.2 Comment Center

Jadval/karta: post preview, izoh matni, muallif, vaqt, **organik/reklama badge'i** (ad_id bo'lsa
kampaniya nomi bilan), sentiment, holat (javob berilgan/private reply yuborilgan/yashirilgan).
Amallar: Javob berish · Private reply (agar hali yuborilmagan bo'lsa — bo'lmasa tugma o'chiq va
"allaqachon yuborilgan" deb yozilgan) · Yashirish · O'chirish · Tegga qo'shish · AI javobini generatsiya qilish.
Ommaviy amallar. **7 kunlik private reply taymeri** har izohda ko'rinsin.

### 14.3 Lead Center

Kanban (yangi → aloqada → sifatli → yutildi/yo'qotildi) + jadval ko'rinishi.
Har lidda: manba (IG/FB ikonkasi), kampaniya/adset/reklama nomi, **shu lidning taxminiy narxi**,
forma nomi, barcha maydonlar, SLA taymeri (qancha vaqt javobsiz).
Filtrlar: kampaniya, forma, sana, holat, menejer, organik/pullik.
"Formani xaritalash" konstruktori.
⚠️ Meta'da 90 kundan keyin lid yo'qolishi haqida bir marta tushuntiruvchi banner.

### 14.4 Ads Analytics

Yuqorida: sana oralig'i, ad account, platforma (IG/FB/hammasi) filtri.
KPI kartochkalari: Xarajat · Ko'rsatishlar · Qamrov · Bosishlar · CTR · **Lidlar** · **CPL** ·
**Suhbatlar** · Suhbat narxi · ROAS.
Grafiklar (Recharts): kunlik xarajat vs lidlar (ikki o'q), platformalar bo'yicha ulush (IG vs FB),
kampaniyalar bo'yicha CPL taqqoslash, voronka (ko'rsatish → bosish → lid → sifatli → savdo).
Jadval: kampaniya → adset → ad (ochiladigan daraja), ustunlar sozlanadigan.
**CRM ma'lumoti bilan birlashtirish:** Meta'ning "lid" soni yonida CRM'dagi *haqiqiy* sifatli lidlar
va savdo summasi — bu sizning CRM'ning asosiy ustunligi.
⚠️ Metrika uzilishlarini (2025-04-21 IG, 2025-11-15 FB, 2026-06-15 FB) grafikda vertikal chiziq
bilan belgilang va tooltip'da tushuntiring.

### 14.5 Content Scheduler

Kalendar (oy/hafta) + navbat ro'yxati. Yangi post modali: akkaunt(lar) tanlash, tur (post/reels/story/karusel),
media yuklash (o'z CDN'ingizga), caption + emoji + hashtag yordamchisi + **AI bilan caption generatsiya**,
IG/FB preview, vaqt tanlash.
**Kunlik limit indikatori** (`content_publishing_limit` dan real vaqtda).
Xato holatida aniq sabab + "Qayta urinish" tugmasi.

### 14.6 AI sozlamalari

- Yoqish/o'chirish (global + kanal bo'yicha + akkaunt bo'yicha)
- **Rejim: "Taklif" / "Avtomatik"** (boshlanishiga "Taklif")
- System prompt tahrirlagich + preview ("test xabar yuboring va javobni ko'ring")
- Ton, tillar, emoji siyosati, kechikish, max AI navbatlari, min ishonch
- Eskalatsiya kalit so'zlari, taqiqlangan mavzular
- Ish vaqti jadvali
- **Bilim bazasi:** FAQ/narx/mahsulot matnlarini yuklash (fayl yoki qo'lda), avtomatik chunk + embedding
- **Qoidalar konstruktori** (auto_rules): "agar izohda 'narx' bo'lsa → javob + private reply"
- **AI jurnali:** har javob, ishonchi, bloklangan bo'lsa sababi, operator bahosi/tahriri

---

## 15. KO'NDALANG TALABLAR (barcha modullar uchun)

### 15.1 Meta API client (bitta markazlashgan servis)

```csharp
public interface IMetaApiClient
{
    Task<TResult> GetAsync<TResult>(MetaRequest req, CancellationToken ct);
    Task<TResult> PostAsync<TResult>(MetaRequest req, CancellationToken ct);
}
```
Majburiy xususiyatlar:
1. **Versiya bitta joydan** (`Meta:ApiVersion`).
2. **`appsecret_proof`** har server so'roviga qo'shiladi: `HMAC-SHA256(access_token, app_secret)` hex.
   App Dashboard → Settings → Advanced → **"Require App Secret" ni YOQING**.
3. **Rate limit headerlarini o'qish**: `X-App-Usage`, `X-Business-Use-Case-Usage`,
   `X-FB-Ads-Insights-Throttle` → `api_usage` jadvaliga yozish.
4. **Adaptiv throttle**: biror foiz >75 bo'lsa shu tenant/BUC navbatini pauza qilish (Redis token bucket).
5. **Polly siyosati**: faqat `1, 2, 4, 17, 613, 80000-80006, 551/1545041` uchun retry (jitter bilan,
   base 2s, cap 15 daq, max 6 urinish). **Hech qachon retry qilmang:** `10/2534022` (oyna yopiq),
   `10/2018108` (foydalanuvchi qabul qilmaydi), `551` (bloklagan), `100/2018001` (noto'g'ri PSID),
   `2018300` (tred boshqa ilovada), `100/1487534` (juda ko'p ma'lumot), `190` (token).
6. **`fbtrace_id` ni har logga** yozish — Meta support usiz gaplashmaydi.
7. **Batch** (`POST /` + `batch=[...]`, max 50): tarmoq kechikishini kamaytiradi, **lekin kvotani tejamaydi**
   (har sub-so'rov alohida hisoblanadi). Kvotani tejash uchun **field expansion** ishlating:
   `GET /me/accounts?fields=id,name,access_token,instagram_business_account{id,username},subscribed_apps{subscribed_fields}`.

### 15.2 Xato → foydalanuvchi xabari xaritasi (UI'da texnik kod ko'rsatmang)

| Kod | Foydalanuvchiga (o'zbekcha) |
|---|---|
| 10/2534022, 10/2018278 | "24 soatlik javob oynasi yopilgan. Mijoz yozgach javob bera olasiz." |
| 10/2018108 | "Bu foydalanuvchi sizdan xabar qabul qilmaydi." |
| 551 | "Foydalanuvchi sahifangizni bloklagan." |
| 551/1545041, 200/1545041 | "Vaqtincha yetkazib bo'lmadi, qayta urinamiz." |
| 613/2018338 | ⚠️ "Meta faoliyatingizni shubhali deb belgiladi" — **darhol avtomatikani sekinlashtiring** |
| 2018300 | "Suhbat hozir boshqa ilova nazoratida (Meta Inbox)." |
| 190/* | "Facebook ulanishi yangilanishi kerak" + "Qayta ulash" tugmasi |
| 200 | "Ilovada yetarli ruxsat yo'q — sozlamalarni tekshiring." |
| 80000-80006 | "So'rovlar chegarasiga yetildi, N daqiqadan keyin davom etamiz." |
| 100/33 (lid) | "Lidlarga ruxsat yo'q — Meta Business Suite → Leads access da CRM'ni yoqing." |

### 15.3 Xavfsizlik va ma'lumot himoyasi

- Tokenlar **AES-256-GCM** bilan shifrlanadi; kalit — Key Vault/Vault yoki ASP.NET Data Protection.
  Tokenlar **hech qachon** frontendga, logga, xato xabariga tushmasin.
- Webhook imzosi majburiy; imzosiz so'rovlar 401.
- **Data Deletion Callback** (App Dashboard'da majburiy — yo callback, yo instructions URL):
  ```
  POST /api/marketing/meta/data-deletion
  signed_request = base64url(payload).base64url(sig)
  → sig = HMAC-SHA256(payload_part, app_secret) ni tekshir → user_id ni ol → o'chirish job'i
  → Javob AYNAN: { "url": "https://crm.uz/deletion-status?id=abc123", "confirmation_code": "abc123" }
  ```
- Platform Terms: ma'lumot kerak bo'lmay qolganda "iloji boricha tez" o'chirilishi kerak.
  Foydalanuvchi ilovani uzsa — uning ma'lumotini o'chiring.
  **Platform Data'ni sotish/litsenziyalash taqiqlangan.**
- Messaging metadata **maqsadga bog'liq**: xabar mazmunidan tashqari ma'lumotni boshqa maqsadda ishlatmang.
- Xabarlarda **karta raqami / moliyaviy hisob raqami so'ramang va uzatmang**; **tibbiy ma'lumot yig'manг**.
- Lid PII — eng nozik ma'lumot. Saqlash muddati siyosatini yozing (masalan 24 oy), avtomatik
  anonimlashtirish job'i qiling. DPA'da aynan shu so'raladi.
- `is_deleted` xabar kelganda — mazmunni **haqiqatan o'chiring**, faqat UI'dan yashirmang.
- Multi-tenant izolyatsiya: har so'rovda `tenant_id` filtri (EF global query filter + RLS).
  Bitta ilova — bitta sizib chiqqan token butun tizim uchun xavf. DPA aynan shuni tekshiradi.

### 15.4 Monitoring va alertlar

Kuzatiladigan ko'rsatkichlar:
- Webhook: kutish navbati uzunligi, ishlov berish kechikishi, imzo xatolari, dedup ulushi
- Har BUC turi bo'yicha `call_count` foizi (Prometheus gauge)
- AI: o'rtacha kechikish, bloklangan javoblar ulushi, eskalatsiya darajasi, token xarajati
- Xabar yuborish xatolari kod bo'yicha
- **Kritik alertlar:** `613/2018338` (abusive behavior), `messaging_policy_enforcement` webhook,
  token 190, webhook 5 daqiqa davomida kelmayapti, publishing limit 80% ga yetdi

---

## 16. BOSQICHMA-BOSQICH REJA (agent shu tartibda ishlasin)

| Sprint | Nima | Natija |
|---|---|---|
| **S0** | Meta App yaratish, Business Verification boshlash, ngrok bilan webhook test | App ID/Secret, test Page + IG |
| **S1** | Domain model + EF migratsiyalar + tenant izolyatsiya + token shifrlash | DB tayyor |
| **S2** | **M1 Onboarding**: OAuth (FB Login for Business), token almashinuvi, Page/IG/AdAccount tanlash, webhook obunasi, token salomatligi job'i | Akkaunt ulanadi |
| **S3** | **M2 Webhook Gateway**: imzo, dedup, navbat, ikkala payload shakli, marshrutlash | Hodisalar bazaga tushadi |
| **S4** | **M3 Inbox (o'qish)**: DM ko'rsatish, kontakt, media ko'chirish, SignalR | Xabarlar ko'rinadi |
| **S5** | **M3 Inbox (yozish)**: operator javobi, oyna nazorati, typing/seen, echo/handover himoyasi | Operator javob beradi |
| **S6** | **M4 Comments**: IG + FB izohlar, ochiq javob, yashirish/o'chirish, **private reply** (bir marta + 7 kun + 750/soat) | Izohlar boshqariladi |
| **S7** | **M5 AI (taklif rejimi)**: intent, RAG (pgvector), prompt, guardrail, ai_interactions | AI taklif beradi |
| **S8** | **M5 AI (avtomatik)**: qoidalar dvigateli, kechikish+bekor qilish, eskalatsiya, kill switch | AI o'zi javob beradi |
| **S9** | **M6 Lead Center**: leadgen webhook, lid o'qish, xaritalash, CRM'ga yozish, reconciliation, Leads Access wizard | Lidlar avtomatik tushadi |
| **S10** | **M7 Ads Analytics**: iyerarxiya sync, insights (sync+async), CPL/ROAS, dashboard | Reklama hisoboti |
| **S11** | **M9 Attribution + CAPI**: referral ushlash, lid holati → CAPI | Meta optimallashadi |
| **S12** | **M8 Content Scheduler**: IG container oqimi, FB feed/reels/stories, kalendar | Postlar rejalashtiriladi |
| **S13** | **App Review paketi**: skrinkastlar, test akkaunt, privacy policy, data deletion, hujjatlar | Advanced Access so'raladi |
| **S14** | Yuklama testi, monitoring, alertlar, hujjat, operator qo'llanmasi | Produksiya |

---

## 17. 🔴 ENG MUHIM 20 TA OGOHLANTIRISH (bularni e'tiborsiz qoldirsangiz tizim buziladi)

1. **Webhook imzosini xom baytlar ustidan hisoblang** — JSON parse qilingandan keyin emas.
2. **`entry[].standby[]` alohida massiv** — `messaging` deb o'qisangiz hodisalarni butunlay yo'qotasiz.
3. **Instagram Login'da `changes` massivi yo'q** — parser ikkala shaklni bilishi shart.
4. **Bitta izohga faqat BITTA private reply** — flagni yuborishdan oldin transaksiyada qo'ying.
5. **Private reply: post/reels uchun soatiga 750** — comment→DM avtomatikasining asosiy tomog'i.
6. **`is_echo` = boshqa joydan javob berildi** → navbatdagi AI javobini bekor qiling.
7. **AI'ga `HUMAN_AGENT` tegini bermang** — akkaunt cheklanadi.
8. **Instagram matni 1000 BAYT**, belgi emas.
9. **Conversations API sekundiga 2 ta so'rov** va **faqat oxirgi 20 xabar** — tarixni backfill qilib bo'lmaydi.
10. **Creator akkauntlar**: ulangandan keyin bir marta Conversations API chaqirmasangiz webhook kelmaydi.
11. **Lidlar ~90 kunda yo'qoladi** — darhol oling va xom saqlang.
12. **Leads Access (Business Suite → Integrations)** yoqilmasa lid kelmaydi — onboarding'da alohida qadam.
13. **`ad_id` faqat Facebook Login yo'lida** keladi — marketing CRM uchun shu yo'lni tanlang.
14. **Dinamik reklamalarda `ad_id` qaytmaydi** — organikdan ajratib bo'lmaydi.
15. **FB dark post izohlari uchun webhook kafolatlanmagan** — `/{page_id}/ads_posts` ni poll qiling.
16. **`spend` major unit matn, byudjet minor unit integer** — bu assimetriya №1 xato.
17. **`actions` massivida qiymati 0 bo'lgan tur umuman bo'lmaydi** — indeks bo'yicha o'qimang.
18. **`lead` = onsite + pixel** — uchtasini qo'shmang.
19. **IG'da native rejalashtirish yo'q**, container 24 soatda o'ladi — o'z navbatingiz bilan joylang.
20. **Chop etilgan IG media'ni API orqali tahrirlash/o'chirish mumkin emas.**

**Bonus:** `content_publishing_limit` (qo'llanma 100 / reference 50), FB rejalashtirish oynasi (30 vs 75 kun),
Page Inbox app_id (`263902037430900`), 2026-06-15 Page Insights o'chirilishi — bularning **hammasi
Meta hujjatlarida noaniq**. Kodda konstanta qilmang, ish vaqtida o'qing yoki sozlamaga chiqaring.

---

## 18. AGENT UCHUN YAKUNIY KO'RSATMA

Ishni **S1 sprintdan** boshla. Har sprint oxirida:
1. `dotnet build && dotnet test && npm run build` ishlashini tasdiqla.
2. Qo'shilgan endpointlarni Swagger'da ko'rsat.
3. Yangi jadval/migratsiya bo'lsa `dotnet ef migrations script` ni chiqar.
4. Qisqacha hisobot ber: nima qilindi, nima qoldi, qanday qaror qabul qilinganini tushuntir.
5. Meta API'ning qaysidir fakti bu hujjatdagi bilan mos kelmasa — **to'xta va menga ayt**,
   o'zingcha taxmin qilma.

Integratsion testlarda **Testcontainers** (PostgreSQL + Redis) va **WireMock.Net** bilan Meta API'ni
mock qil — real Meta'ga test paytida murojaat qilma. Webhook payload'larining
har bir namunasini (§7.1, §8.1, §8.2, §10.1) fixture sifatida saqla va parser testlarini yoz.
