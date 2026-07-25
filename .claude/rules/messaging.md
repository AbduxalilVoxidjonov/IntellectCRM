---
description: Xabar tizimi — yagona AVTO-XABAR (AutoMessageRule + 13 trigger), Local SMS provider, Telegram bot (majburiy obuna, guruhga lid yuborish), xabarlar frontendi.
paths:
  - "IntellectCRM.Application/Services/AutoMessage*.cs"
  - "IntellectCRM.Application/Services/Message*.cs"
  - "IntellectCRM.Application/Services/Telegram*.cs"
  - "IntellectCRM.Application/Services/Eskiz*.cs"
  - "IntellectCRM.Application/Services/Cti*.cs"
  - "IntellectCRM.Application/Services/Fcm*.cs"
  - "IntellectCRM.Application/Services/*Reminder*.cs"
  - "IntellectCRM.Application/Services/BirthdaySmsService.cs"
  - "IntellectCRM.Application/Services/LeadNotifier.cs"
  - "IntellectCRM.Application/Services/NotificationStore.cs"
  - "IntellectCRM.Server/Controllers/MessagesController.cs"
  - "IntellectCRM.Server/Controllers/AutoMessagesController.cs"
  - "IntellectCRM.Server/Controllers/NotificationsController.cs"
  - "IntellectCRM.Server/Controllers/SmsCallbackController.cs"
  - "IntellectCRM.Client/src/pages/admin/messages/**"
  - "IntellectCRM.Client/src/components/messaging/**"
---

# Xabar tizimi qoidalari

- **Yagona AVTO-XABAR tizimi:** `AutoMessageRule` entity (migratsiya `AddAutoMessages`) — har qoida:
  Trigger + 3 kanal bayrog'i (SendSms/SendPush/SendTelegram) + Audience + Template (tokenli) + jadval
  maydonlari. **13 trigger** katalogi `AutoMessageTriggers` (Application/Services): payment_received,
  monthly_charge, payment_debt, attendance_absent, birthday, student_added, lead_new, trial_reminder,
  test_link, test_result, lesson_attendance, custom_schedule, **grade_entered** (baho qo'yilganda).
  Har trigger `Category` maydoniga ega ("Lidlar" | "O'quv jarayoni" | "Moliya" | "Boshqa") —
  GET /triggers javobida `category` chiqadi, frontend shu bo'yicha guruhlaydi. Markaziy dispatcher
  `AutoMessageService` (singleton) — DispatchStudent/LeadAsync (SMS=Eskiz+SmsLog,
  Push=FCM+DeviceTokens+NotificationStore, Telegram=TelegramRegistrations). `DispatchTeacherAsync`
  O'CHIRILGAN (chaqiruvchi yo'q edi).
  **`grade_entered`:** `JournalService.SetEntryAsync` ixtiyoriy `AutoMessageService?` parametr oladi —
  baho push'i qoida MAVJUD bo'lsa dispatcher orqali (extra {baho},{sana},{guruh}); qoida yo'q bo'lsa eski
  to'g'ridan-to'g'ri FCM push (default-on). Davomat push'i (type "attendance") o'zgarmagan.
  **Token katalogi:** `MessageTokenCatalog` + `GET /api/admin/auto-messages/tokens` →
  `[{token,label,group}]` (group: student|lead|common|event); frontend token chiplarini shundan oladi
  (lokal `messageTemplates.ts` faqat fallback).
  **TOZALANGAN (migratsiya `MessagingCleanup`):** `ReminderRule` entity+DbSet, `RemindersController`
  (`api/admin/reminders`), `ReminderTriggers`, `SmsTemplate.Trigger/IsAuto` ustunlari, Program.cs bir
  martalik seed bloki — hammasi O'CHIRILGAN (avto-xabar to'liq AutoMessageRule'da). `SmsTemplate` faqat
  qo'lda shablon (`{id,name,text,order}`). 3 reminder HostedService AutoMessageRules'dan o'qiydi.
  API: `api/admin/auto-messages` (+ /triggers + /tokens), AdminPerm("messages").

- **Lidlarga ommaviy SMS:** `POST /api/admin/messages/sms/lead-bulk` `{leadIds:string[], text}` →
  `{sent,failed,noPhone}` (bitta SmsBatch, har lidga LeadEvent; `SendOneLeadSmsAsync` helper — sms/lead
  bilan umumiy).

- **FRONTEND:** Xabarlar sahifasi 4 tab — **Xabar yuborish (default)** | Avto xabarlar (trigger'lar
  Category bo'yicha guruhlangan) | Tarix (3 kanal + kanal filtri chiplari) | Guruh chati. Yagona
  `MessageEditor` komponenti (`components/messaging/`) — token+shablon chiplar + to'g'ri SMS uzunlik
  hisobi — composer, SmsModal, RuleCard, LeadDetailModal, MessageTemplateLibrary hammasi ishlatadi.
  Kanal tartibi/yorliqlari yagona `config/channels.ts`dan (SMS → Telegram → Push). Lidlar Kanban'da
  "SMS yuborish" (bulk modal). O'quvchi detail sahifasida "SMS yuborish" tugmasi (SmsModal bitta
  o'quvchi rejimi). Sozlamalarda "Xabar kanallari" bitta bo'lim (`/admin/settings/channels`, 3 ichki tab:
  SMS(Eskiz) / Telegram bot / Push(Firebase)); Telegram backup → `/admin/settings/backup`, APK yuklash →
  `/admin/settings/apk`; eski telegram/firebase/eskiz section'lari redirect, "Eslatmalar" section
  o'chirilgan (→ /admin/messages).

- **Local SMS (Eskiz'ga muqobil provider — CTI agent telefonining SIM-kartasidan):** har SMS yuborish
  joyida (Xabar yuborish, Lidga SMS, Lidlar ommaviy SMS, Avto-xabar qoidalari) "Eskiz" bilan bir qatorda
  "Local" tanlanishi mumkin (`SmsProviderPicker`, `components/messaging/`) — faqat
  `CenterMeta.LocalSmsEnabled` yoqilgan bo'lsa ko'rinadi (Sozlamalar → Xabar kanallari → SMS,
  `LocalSmsSettings.tsx`). Standart agent `CenterMeta.LocalSmsDefaultAgentId` — interaktiv yuborishda
  o'zgartirish mumkin, avtomatik/fon xabarlarda (AutoMessageService, 3 ta eslatma HostedService) HAR
  DOIM shu standart ishlatiladi (tanlaydigan admin yo'q). Markaziy gateway: `CtiSmsService` — WS/FCM+poll
  yetkazish (dial bilan bir xil oqim) + `SmsLog`/`SmsBatch` yozish (`Provider="local"`); chaqiruvchi
  batchId bermasa (masalan Local Call sahifasidan ad-hoc yuborish) o'zi bittalik `SmsBatch` yaratadi —
  shu bilan HAR QANDAY Local SMS umumiy "Xabarlar → Tarix"da Eskiz bilan bir joyda, "Manba" belgisi
  bilan ko'rinadi (`HistoryTab.tsx`, filtr chiplari bilan). `CtiConnectionManager` (avval Server/Cti/)
  Application qatlamiga ko'chirilgan — sababi: AutoMessageService kabi Application xizmatlari ham Local
  SMS yubora olishi kerak (Server'dan Application'ga bog'liqlik yo'nalishi noto'g'ri bo'lardi).
  `AutoMessageRule.SmsProvider` — har qoida mustaqil Eskiz/Local tanlaydi (`AutoMessageSmsSender` —
  umumiy yordamchi, provider bo'yicha branch qiladi, `SmsLog`/`SmsBatch` yozadi).

- **To'lov eslatmasi:** mavjud `MessagesController` broadcast `OnlyDebtors=true` (Telegram +
  `{qarzdorlik}` tokenlari). Avtomatik (hisob yaratilganda) trigger — hali yo'q (kelajak).

- **Lidni Telegram guruhga avto-yuborish:** Bot GURUHGA qo'shilsa (`my_chat_member` yangilanishi —
  `TelegramService.GetUpdatesAsync` allowed_updates'ga qo'shilgan) — `TelegramGroup` entity'ga yoziladi
  (migratsiya `AddTelegramGroups`, ChatId unikal, IsActive), guruhga bir marta tasdiq yuboriladi;
  chiqarilsa IsActive=false. Yangi lid tushganda `LeadNotifier.NotifyNewLeadAsync` adminlarga (private
  reg) VA barcha faol guruhlarga bir xil matnni yuboradi (dedupe: `sentChats`). Handler:
  `TelegramBotService.HandleMyChatMemberAsync`. Guruhda `/start` yo'q — faqat qo'shilish kifoya.

- **BOTDA MAJBURIY OBUNA:** yagona darvoza `TelegramBotService.RequireSubscriptionAsync` — `/start`,
  telefon yuborish, `/kod` (kirish kodi) va `/test` (onlayn test) shu yerdan o'tadi (5 daqiqa
  keshlanadi); «Adminga murojaat» ATAYIN ochiq. DIQQAT: Telegram `getChatMember` faqat bot kanalda
  **ADMIN** bo'lsagina ishlaydi; bot admin bo'lmasa yoki kanal xususiy havola (`t.me/+…`) bo'lsa
  tekshirib BO'LMAYDI — tizim fail-open (hammani o'tkazadi), lekin `TelegramService.CheckChannelAsync`
  diagnostikasi Sozlamalar → Telegram bot sahifasida sababni ko'rsatib turadi
  (ok | not-set | no-token | private | not-found | bot-not-admin).
