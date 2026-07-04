# CTI (Local Call) moduli — qisqa yo'riqnoma

Call Center ostidagi **"Local Call"** bo'limi: xodim telefonlaridagi Android agent-ilova
qo'ng'iroqlar metadata'si va audio yozuvlarini serverga yuboradi; operator React'dan tarixni
ko'radi, audioni eshitadi va **click-to-call** qiladi (server WebSocket orqali telefonga
`dial` buyrug'i yuboradi, agent oflayn bo'lsa FCM push bilan ilova uyg'otiladi).

## Ishga tushirish

1. **Migratsiya** — alohida buyruq SHART EMAS: server startup'da avto-migratsiya
   (`20260704160829_AddCtiModule` — CtiAgents, CtiCallRecords, CtiCallEvents, CtiCommandLogs).
2. **FCM** (agent oflayn bo'lsa uyg'otish uchun) — allaqachon mavjud sozlama ishlatiladi:
   Admin → Sozlamalar → **Push (Firebase)** dagi service account JSON. Alohida secret kerak emas.
3. **JWT** — mavjud `Jwt__Key` ishlatiladi (agent tokenlari ham shu kalit bilan, rol `ctiagent`).
4. **Audio yozuvlar** — `recordings/cti/` papkada (docker'da `cti-recordings` volume,
   `/app/recordings`). Yo'lni o'zgartirish: `Cti__RecordingsPath` env. DIQQAT: `/uploads`
   ostida EMAS — faqat autentifikatsiyalangan endpoint orqali beriladi.

## Android ilovani ulash

Ilovadagi `BaseUrl` ni serverga moslang: `https://crm.intellectschool.uz` — mobil API prefiksi
`/api/mobile` (login: `POST /api/mobile/auth/login` → `{ token, agentId, wsUrl }`;
`wsUrl` = `wss://host/ws`, ulanish `?token=<JWT>` bilan).

Agent hisobini yaratish: Admin → Call Center → **Local Call** → "Agentlar" tab → "Agent qo'shish"
(login/parol/ism). Shu login-parol Android ilovaga kiritiladi.

## API xaritasi

| Kim | Prefiks | Endpointlar |
|---|---|---|
| Android agent | `/api/mobile` | `auth/login`, `calls`, `calls/{id}/audio` (multipart, 50MB), `calls/{id}/events`, `agents/heartbeat`, `agents/fcm-token` |
| Android agent | `/ws?token=` | raw WebSocket: server→ilova `{action:"dial"|"ping"|"logout"}`, ilova→server `{type:"ack"|"presence"}` |
| Operator (web) | `/api/cti` | `agents` (ro'yxat/CRUD), `agents/{id}/dial`, `calls` (filtr+sahifalash), `calls/{id}`, `calls/{id}/audio` (Range stream), `calls/{id}/note` |

Operator API ruxsati — mavjud `calls` bo'lim ruxsati (`AdminPerm("calls")`), ya'ni Call Center
ko'ra oladigan xodim Local Call'ni ham ko'radi.
