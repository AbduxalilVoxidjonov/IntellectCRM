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

- **GURUH CHATI — KIM O'QIY OLADI (darvoza).** Yagona qoida: `ChatService.CanUseAdminChat(role, perms)`
  (sof funksiya, `ChatAccessTests` bilan qoplangan). Sabab: `AdminPermAttribute` xodim (staff) uchun
  BARCHA GET'larni ruxsat tekshirmasdan o'tkazadi (bo'limlararo o'qish uchun ataylab) — chat esa
  bo'limlararo ma'lumot EMAS, shuning uchun `MessagesController` chat endpointlarida ALOHIDA
  tekshiriladi (`CanUseChat()`): `chat/{className}` GET+POST va `classes` → 403 (`Forbid`),
  `last-messages` → BO'SH ro'yxat (403 emas: uni har sahifada `unread-context` chaqiradi).
  • admin/superadmin — cheklovsiz, barcha guruhlar + `__xodimlar__` (o'zgarmagan);
  • **staff — faqat "messages" bo'lim ruxsati bilan** (yalang `messages` yoki `messages:amal`) —
    frontend'dagi `RequirePerm perm="messages"` bilan AYNAN bir xil, shuning uchun UI oqimi
    o'zgarmaydi; ruxsati bo'lgan xodim admin kabi hamma kanalni ko'radi (a'zolik tekshirilmaydi —
    xodim guruhga biriktirilmaydi, `ClassNamesForUserAsync` "staff" uchun bo'sh qaytaradi);
  • o'qituvchi/o'quvchi bu endpointga umuman kirmaydi — ular o'z portalidan A'ZOLIK tekshiruvi
    bilan kiradi (`ChatService.CanAccessAsync` — `TeacherPortalController`/o'quvchi portali).
  ⚠️ Yangi chat endpointi qo'shilsa — shu darvozani ham qo'shish SHART.

- **PUSH VA O'QUVCHI ILOVASI — BITTA AKKAUNT, BITTA QURILMA.** O'quvchi ilovasidan O'QUVCHI ham,
  OTA-ONA ham foydalanadi (ota-ona uchun alohida ilova YO'Q). Shuning uchun:
  • `POST/DELETE /api/student/notifications/register` — `student` VA `parent` rollariga ochiq;
  • ota-onaning qurilma tokeni FARZANDINING `Student.UserId` iga bog'lanadi
    (`StudentPortalController.NotificationUserIdAsync`: parent → `TargetAsync(null)?.UserId`).
    Shu sabab push YUBORISH mantig'i o'zgarmaydi (u har doim `Student.UserId` ga yuboradi) va
    bildirishnoma TARIXI ham ota-onada ko'rinadi (ilgari bo'sh chiqardi — ro'yxat login qilgan
    foydalanuvchi id'si bo'yicha filtrlanardi);
  • **ro'yxatdan o'tkazishda shu akkauntning BOSHQA tokenlari O'CHIRILADI** — push faqat ENG
    OXIRGI kirilgan qurilmaga boradi (aks holda o'quvchi va ota-ona telefoniga bir xil xabar
    ikki marta ketardi);
  • Admin "Tanlab push" ro'yxatida o'quvchi akkaunti **"O'quvchi / ota-ona"** deb ko'rsatiladi
    (ilgari xato "Ota-ona" deb yozilgan edi) — ALOHIDA ota-ona oluvchisi yo'q va kerak emas.
  ⚠️ Ilova tomonda FCM: `ilova/student/lib/services/push.dart` (o'qituvchi ilovasidagi bilan bir
  xil naqsh). Ilgari ilovada FCM kodi UMUMAN yo'q edi — token serverga bormas, push ishlamasdi.

- **KALITLAR .env DA:** Telegram bot tokeni (`TELEGRAM_BOT_TOKEN`), FCM service account
  (`FCM_SERVICE_ACCOUNT_JSON`), Eskiz login/paroli (`ESKIZ_EMAIL`/`ESKIZ_PASSWORD`) — hammasi
  `AppSecrets` orqali .env dan o'qiladi, bazada saqlanmaydi va Sozlamalar sahifasidan
  kiritilmaydi (sahifada faqat holat + kerakli .env qatori — `EnvSecretField`). UI'dan
  saqlanadigan qismlar: bot username/nomi, kanal, telefon moslash, Eskiz "sender" (From),
  Firebase WEB config + VAPID (ommaviy). Eskiz Bearer tokeni endi XOTIRADA keshlanadi
  (`EskizService`), `CenterMeta.EskizToken` ustuni yo'q. Batafsil: CLAUDE.md §4 "KALITLAR".

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
  **`{oqituvchi}` — GURUH O'QITUVCHISI F.I.Sh:** `MessageTokenizer.Student/Lead` ixtiyoriy
  `teacherName` parametridan to'ladi (`Teacher(...)`da — o'qituvchining o'zi). Chaqiruvchi nomni
  `MessageTokenizer.GroupTeacherNameAsync(db, group, student)` (bitta xabar) yoki
  `TeacherNamesByIdAsync` + `TeacherNameOf(group, names)` (ro'yxat — N+1 bo'lmasin) orqali beradi.
  Guruh KONTEKSTI ({guruh}/{oqituvchi}/{dars_*}) — hodisa guruhi: `DispatchStudentAsync(..., group:)`
  ga student_added (guruhga qo'shish + yangi o'quvchi), grade_entered va attendance_absent
  (`DispatchAttendanceAbsentAsync(..., group)`) ham guruhni UZATADI; berilmasa o'quvchining asosiy
  (ClassName) guruhi olinadi. `PaymentReminderService`/`CustomReminderService` ommaviy sikllarda
  guruh+o'qituvchi lug'ati BIR MARTA yuklanadi (ilgari bu ikkisida {dars_*} bo'sh chiqardi).
  **TOZALANGAN (migratsiya `MessagingCleanup`):** `ReminderRule` entity+DbSet, `RemindersController`
  (`api/admin/reminders`), `ReminderTriggers`, `SmsTemplate.Trigger/IsAuto` ustunlari, Program.cs bir
  martalik seed bloki — hammasi O'CHIRILGAN (avto-xabar to'liq AutoMessageRule'da). `SmsTemplate` faqat
  qo'lda shablon (`{id,name,text,order}`). 3 reminder HostedService AutoMessageRules'dan o'qiydi.
  API: `api/admin/auto-messages` (+ /triggers + /tokens), AdminPerm("messages").

- **GURUHI YOPILGAN/TUGATILGAN O'QUVCHIGA AVTO-XABAR YO'Q** (`MessagingAudience.ClosedGroupStudentIdsAsync`):
  o'quvchining a'zoligi BOR-u, biror ham TIRIK a'zoligi (`StudentGroup.IsActive` + guruh ARXIVLANMAGAN)
  qolmagan bo'lsa — tizim o'zi boshlaydigan xabarlar unga yuborilmaydi: qarzdorlik eslatmasi
  (`PaymentReminderService`), tug'ilgan kun (`BirthdaySmsService`), erkin/jadvalli eslatma
  (`CustomReminderService`), ommaviy SMS/e'lon/push (`MessagesController` — "Tanlangan" rejimidan
  TASHQARI: u yerda admin kimni tanlasa o'shanga ketadi). Muzlatilgan, lekin guruhi FAOL o'quvchi
  xabar olaveradi (ta'til). A'zoligi umuman yo'q (eski ClassName) o'quvchilar tegilmaydi.
  Hodisaga JAVOB bo'lgan xabarlar (masalan "to'lov qabul qilindi") filtrlanmaydi — yopilgan guruh
  qarzini to'lagan ota-ona tasdiq oladi. O'qituvchiga dars eslatmasi allaqachon arxiv guruhlarni
  hisobga olmasdi (`LessonAttendanceReminderService` — `!g.IsArchived`).

- **Lidlarga ommaviy SMS:** `POST /api/admin/messages/sms/lead-bulk` `{leadIds:string[], text}` →
  `{sent,failed,noPhone}` (bitta SmsBatch, har lidga LeadEvent; `SendOneLeadSmsAsync` helper — sms/lead
  bilan umumiy).

- **FRONTEND:** Xabarlar sahifasi 3 tab — **Xabar yuborish (default)** | Avto xabarlar (trigger'lar
  Category bo'yicha guruhlangan) | Tarix (3 kanal + kanal filtri chiplari).
  ⚠️ **Guruh chati bu yerda EMAS:** u alohida «Chats» menyusiga chiqarilgan (menyuda «Xabarlar» dan
  TEPADA) — `/admin/chats` (`pages/admin/chats/GroupChatPage.tsx`) va yonida «Support Telegram»
  (`/admin/support-telegram`). Sidebar'dagi o'qilmagan xabar belgisi ham shu «Chats» guruhida. Yagona
  `MessageEditor` komponenti (`components/messaging/`) — token+shablon chiplar + to'g'ri SMS uzunlik
  hisobi — composer, SmsModal, RuleCard, LeadDetailModal, MessageTemplateLibrary hammasi ishlatadi.
  Kanal tartibi/yorliqlari yagona `config/channels.ts`dan (SMS → Telegram → Push). Lidlar Kanban'da
  "SMS yuborish" (bulk modal). O'quvchi detail sahifasida "SMS yuborish" tugmasi (SmsModal bitta
  o'quvchi rejimi). **`SmsModal` KO'P OLUVCHI rejimi (guruh sahifasi, o'quvchilar ro'yxati,
  davomat):** oluvchi filtri — Holat chiplari (Aktiv/Sinov/Muzlatilgan, `SmsRecipient.status`
  yoki Student'ning `memberState`i) + To'lov (Faqat qarzdorlar / Qarzi yo'q, `SmsRecipient.balance`
  manfiy = qarz) + har bir oluvchini qo'lda belgilash. Qarzdorlar MIJOZ tomonida filtrlanadi
  (`onlyDebtors:false` yuboriladi) — guruhda balans SHU GURUH bo'yicha (`GroupMember.balance`,
  GroupBalanceService), serverdagi `OnlyDebtors` esa umumiy `Student.Balance`ga qaraydi. Sozlamalarda "Xabar kanallari" bitta bo'lim (`/admin/settings/channels`, 3 ichki tab:
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

- **OMMAVIY SMS — SO'ROV ICHIDA EMAS, FONDA** (`SmsQueueService`, Application/Services; singleton +
  `AddHostedService`). SMS'lar bittalab ketadi: Eskiz'da har raqamga alohida HTTP so'rov (~0.5–1.5 s),
  Local'da esa yuborishlar orasida `LocalSmsDelaySeconds` kutish (agent oflayn bo'lsa yana ~6 s
  "uyg'otish"). 100 oluvchi = bir necha daqiqa, **Cloudflare Tunnel esa javobni 100 soniya kutadi** va
  uzadi → brauzerda "Yuborishda xatolik", SMS'lar esa aslida ketayotgan bo'ladi.
  • Controller (`MessagesController.StartBatchAsync` — `sms/send`, `sms/lead`, `sms/lead-bulk` uchun
    YAGONA joy) oluvchilar ro'yxatini yig'adi, `SmsBatch` ni DARHOL yozadi (tarixda o'sha zahoti
    ko'rinadi) va navbatga qo'yadi;
  • `InlineLimit` (3) gacha bo'lgan partiya avvalgidek so'rov ichida ketadi — bitta o'quvchi/lidga
    yuborishda admin natijani darhol ko'radi;
  • ⚠️ **HAR SMS'dan keyin saqlanadi** (`SmsLog` + `SmsBatch.SentCount`). Ilgari barcha `SmsLog`
    faqat siklning OXIRIDA saqlanardi: ulanish uzilsa (`HttpContext.RequestAborted`) sikl o'lar,
    **pul ketgan, SMS borgan, tarix esa bo'sh** qolardi — admin xatoni ko'rib qayta yuborardi;
  • holat: `GET sms/{id}/progress` — avval xotiradagi navbatdan, u yerda bo'lmasa (ilova qayta ishga
    tushgan) bazadagi `SmsLog` sonidan tiklanadi. Frontendda `watchSmsProgress` (har 2 s) — modal
    "Yuborilmoqda: 12/300" deb ko'rsatadi va oyna yopilsa ham yuborish davom etadi;
  • lid tarixi (`LeadEvent`) ham navbatda yoziladi — `Job.LeadNote` + `Target.LeadId`.
  Testlar: `IntellectCRM.Tests/SmsQueueTests.cs`.

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
