import { api } from '../client'

/**
 * MARKETING → INSTAGRAM AI AGENTI — admin API klienti (`/api/admin/instagram`).
 *
 * Modul Instagram'dan kelgan izoh va DM'larga AI bilan javob beradi, qiziqqan odamni
 * LID voronkasiga (`Lead`, manba "Instagram") tushiradi va operator kerak bo'lganda
 * suhbatni odamga uzatadi.
 *
 * ⚠️ Access token, app secret va verify token HECH QACHON javobga tushmaydi — faqat
 * "sozlangan / sozlanmagan" holati (`/status` dagi `*Set` bayroqlari).
 */

// ═══════════════════════════════════════════════ TIPLAR

/** Xabar kanali: post ostidagi izoh · to'g'ridan-to'g'ri xabar · izohga shaxsiy javob. */
export type IgChannel = 'comment' | 'dm' | 'private_reply'
/** Qoida qaysi kanalga tegishli (`any` — ikkalasiga ham). */
export type IgRuleChannel = 'comment' | 'dm' | 'any'
/** Suhbat holati: bot javob beradi · operator qo'lga oldi (bot jim) · yopilgan. */
export type IgConversationStatus = 'bot' | 'operator' | 'closed'
/** Navbatdagi webhook hodisasining holati. */
export type IgEventStatus = 'pending' | 'done' | 'failed' | 'skipped'

/** Bo'sh qiymatlarni tashlab, faqat to'ldirilgan filtrlarni yuboradi. */
function clean(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

/**
 * DIAGNOSTIKA ekrani — "nima ishlayapti, nima yetishmayapti" bitta javobda.
 * Sozlamalar sahifasining holat kartochkalari aynan shundan quriladi.
 */
export interface IgStatus {
  /** Instagram akkaunt ulanganmi (OAuth o'tganmi). */
  connected: boolean
  username: string
  name: string
  pictureUrl: string
  /** Token muddati tugashiga necha kun qolgani (ulanmagan bo'lsa 0). */
  tokenDaysLeft: number
  /** Meta webhook obunasi faolmi. */
  webhookSubscribed: boolean
  /** Modulning o'zi yoqilganmi (`CenterMeta.InstagramEnabled`). */
  enabled: boolean
  /** `.env`/sozlama kalitlari holati — QIYMAT ko'rsatilmaydi, faqat bor/yo'q. */
  appIdSet: boolean
  appSecretSet: boolean
  verifyTokenSet: boolean
  geminiConfigured: boolean
  /** Bilim bazasidagi bo'laklar soni (0 bo'lsa AI javob bera olmaydi). */
  knowledgeCount: number
  /** Navbat holati: qayta ishlanmagan va xato bo'lgan hodisalar. */
  pendingEvents: number
  failedEvents: number
  /** Meta konsolida ro'yxatdan o'tkaziladigan manzillar. */
  webhookUrl: string
  callbackUrl: string
  /** Bugun yuborilgan javoblar va kunlik chegara. */
  todayReplies: number
  dailyLimit: number
}

/** `CenterMeta` dagi Instagram sozlamalari (maxfiy qiymatlar bu yerda YO'Q). */
export interface IgSettings {
  /** Modul umuman ishlaydimi. `false` — hech qanday tashqi so'rov ketmaydi. */
  instagramEnabled: boolean
  /** Post ostidagi izohlarga avtomatik javob berilsinmi. */
  instagramAutoReplyComments: boolean
  /** DM'larga avtomatik javob berilsinmi. */
  instagramAutoReplyDm: boolean
  /** Izoh muallifiga qo'shimcha shaxsiy xabar (private reply) yuborilsinmi. */
  instagramPrivateReplyEnabled: boolean
  /** Meta ilovasining App ID'si (maxfiy emas). */
  instagramAppId: string
  /** Gemini modeli — bo'sh bo'lsa tizim default'i ishlatiladi. */
  instagramAiModel: string
  /** Yaratiladigan lidning manba nomi (`Lead.Source`). */
  instagramLeadSource: string
  /** Qaynoq lid/eskalatsiyada Telegram'ga xabar yuborilsinmi. */
  instagramNotifyTelegram: boolean
  /** Javobdan oldingi kechikish (soniya) — tabiiylik uchun, spam bo'lib ko'rinmasin. */
  instagramReplyDelaySeconds: number
  /** Kuniga ko'pi bilan nechta javob yuborilishi mumkin (himoya chegarasi). */
  instagramDailyReplyLimit: number
  /** Bot ekanini oshkor qiluvchi salomlashuv matni. */
  instagramGreeting: string
}

/** Suhbat ro'yxatidagi bitta qator. */
export interface IgConversation {
  id: string
  igUserId: string
  username: string
  status: IgConversationStatus
  /** Operator pauzasi qachongacha kuchda (ISO); bo'sh — pauza yo'q. */
  operatorPausedUntil: string
  /** Oxirgi KIRUVCHI xabar vaqti — DM 24 soat oynasi shundan hisoblanadi. */
  lastInboundAt: string
  lastOutboundAt: string
  lastMessageText: string
  messageCount: number
  unread: boolean
  /** Odam aralashuvi kerak (24 soat oynasi yopildi, mijoz operator so'radi va h.k.). */
  needsOperator: boolean
  needsOperatorReason: string
  language: string
  intent: string
  /** 0..100 — qiziqish darajasi; 70+ "qaynoq". */
  leadScore: number
  leadId?: string | null
  createdAt: string
}

/** Suhbatdagi bitta xabar. */
export interface IgMessage {
  id: string
  conversationId: string
  direction: 'in' | 'out'
  channel: IgChannel
  text: string
  mediaId: string
  commentId: string
  igMessageId: string
  /** "AI agent" | xodim ismi | @username */
  actorName: string
  /** Javobni AI yozganmi (qoida/operator emas). */
  isAi: boolean
  aiIntent: string
  aiScore: number
  /** Yuborishda xato bo'lgan bo'lsa — sababi. */
  error: string
  createdAt: string
}

/** Suhbatga bog'langan lid haqida qisqacha ma'lumot. */
export interface IgLeadBrief {
  id: string
  fullName: string
  phone: string
  stage: string
  source: string
}

/** Bitta suhbat + xabarlar lentasi (oxirgi 200 ta). */
export interface IgConversationDetail {
  conversation: IgConversation
  messages: IgMessage[]
  lead?: IgLeadBrief | null
  /** DM 24 soat oynasi hozir ochiqmi (yopiq bo'lsa operator javob yubora olmaydi). */
  dmWindowOpen: boolean
}

/** Suhbatlar ro'yxati + umumiy soni (sahifalash uchun). */
export interface IgConversationList {
  items: IgConversation[]
  total: number
}

export interface IgConversationFilters {
  status?: IgConversationStatus | ''
  needsOperator?: boolean
  q?: string
  channel?: IgChannel | ''
  page?: number
  pageSize?: number
}

/** Kalit so'z qoidasi — AI'dan OLDIN ishlaydi (tez, arzon, aniq javob). */
export interface IgRule {
  id: string
  title: string
  /** Vergul bilan ajratilgan kalit so'zlar. */
  keywords: string
  channel: IgRuleChannel
  replyText: string
  /** `true` — qoida ishlagach AI umuman chaqirilmaydi. */
  stopAi: boolean
  isActive: boolean
  order: number
  /** Qoida necha marta mos kelgani. */
  matchCount: number
  createdAt: string
}

export interface IgRulePayload {
  title: string
  keywords: string
  channel: IgRuleChannel
  replyText: string
  stopAi: boolean
  isActive: boolean
  order: number
}

/** Bilim bazasi bo'lagi — AI FAQAT shu ma'lumot asosida javob beradi. */
export interface IgKnowledge {
  id?: string
  title: string
  content: string
  order: number
  isActive: boolean
  updatedAt?: string
  updatedBy?: string
}

/** Sinov: AI javobi ko'rsatiladi, mijozga JONLI yuborilmaydi. */
export interface IgTestAgentResult {
  ok: boolean
  reply: string
  language: string
  intent: string
  leadScore: number
  isHotLead: boolean
  escalateToHuman: boolean
  error: string
}

/** Analitika: kunlik qator. */
export interface IgDailyPoint {
  date: string
  events: number
  replies: number
  leads: number
  hot: number
}

/** Analitika: kesim qatori (intent · til · kanal). */
export interface IgBreakdown {
  key: string
  count: number
}

/** Analitika: eng ko'p ishlagan qoidalar. */
export interface IgTopRule {
  id: string
  title: string
  count: number
}

export interface IgAnalyticsTotals {
  events: number
  replies: number
  leads: number
  hot: number
  escalations: number
}

export interface IgAnalytics {
  from: string
  to: string
  daily: IgDailyPoint[]
  totals: IgAnalyticsTotals
  byIntent: IgBreakdown[]
  byLanguage: IgBreakdown[]
  byChannel: IgBreakdown[]
  topRules: IgTopRule[]
}

/** Navbat diagnostikasi — webhook hodisalari (xatolar shu yerda ko'rinadi). */
export interface IgEvent {
  id: string
  eventKey: string
  status: IgEventStatus
  attempts: number
  error: string
  receivedAt: string
  processedAt: string
}

// ═══════════════════════════════════════════════ HOLAT · SOZLAMALAR · ULANISH

/** Diagnostika: ulanish, token, navbat, `.env` kalitlari holati. */
export async function getIgStatus(): Promise<IgStatus> {
  const { data } = await api.get<IgStatus>('/admin/instagram/status')
  return data
}

export async function getIgSettings(): Promise<IgSettings> {
  const { data } = await api.get<IgSettings>('/admin/instagram/settings')
  return data
}

export async function saveIgSettings(payload: IgSettings): Promise<IgSettings> {
  const { data } = await api.put<IgSettings>('/admin/instagram/settings', payload)
  return data
}

/** OAuth: `state` yaratiladi va Instagram authorize manzili qaytadi. */
export async function getIgConnectUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/admin/instagram/connect-url')
  return data.url
}

/** Akkauntni uzish — token tozalanadi, jonli javob to'xtaydi. */
export async function disconnectIg(): Promise<void> {
  await api.post('/admin/instagram/disconnect')
}

/** Uzoq muddatli tokenni qo'lda yangilash. */
export async function refreshIgToken(): Promise<IgStatus> {
  const { data } = await api.post<IgStatus>('/admin/instagram/refresh-token')
  return data
}

// ═══════════════════════════════════════════════ SUHBATLAR (INBOX)

export async function getIgConversations(
  filters: IgConversationFilters = {},
): Promise<IgConversationList> {
  const { data } = await api.get<IgConversationList>('/admin/instagram/conversations', {
    params: clean(filters),
  })
  return data
}

export async function getIgConversation(id: string): Promise<IgConversationDetail> {
  const { data } = await api.get<IgConversationDetail>(`/admin/instagram/conversations/${id}`)
  return data
}

/**
 * Operator javobi (DM). 24 soat oynasi yopiq bo'lsa server **400** qaytaradi —
 * chaqiruvchi xato matnini foydalanuvchiga ko'rsatishi shart.
 */
export async function replyIgConversation(id: string, text: string): Promise<IgMessage> {
  const { data } = await api.post<IgMessage>(`/admin/instagram/conversations/${id}/reply`, { text })
  return data
}

/** Botni to'xtatish — suhbatni operator qo'lga oladi. */
export async function takeoverIgConversation(id: string): Promise<IgConversation> {
  const { data } = await api.post<IgConversation>(`/admin/instagram/conversations/${id}/takeover`)
  return data
}

/** Botga qaytarish — AI yana javob bera boshlaydi. */
export async function releaseIgConversation(id: string): Promise<IgConversation> {
  const { data } = await api.post<IgConversation>(`/admin/instagram/conversations/${id}/release`)
  return data
}

export async function closeIgConversation(id: string): Promise<IgConversation> {
  const { data } = await api.post<IgConversation>(`/admin/instagram/conversations/${id}/close`)
  return data
}

export async function markIgConversationRead(id: string): Promise<void> {
  await api.post(`/admin/instagram/conversations/${id}/read`)
}

/** Qo'lda lidga aylantirish (voronkaga tushiradi). */
export async function createIgLead(id: string): Promise<IgLeadBrief> {
  const { data } = await api.post<IgLeadBrief>(`/admin/instagram/conversations/${id}/create-lead`)
  return data
}

// ═══════════════════════════════════════════════ JAVOB QOIDALARI

export async function getIgRules(): Promise<IgRule[]> {
  const { data } = await api.get<IgRule[]>('/admin/instagram/rules')
  return data
}

export async function createIgRule(payload: IgRulePayload): Promise<IgRule> {
  const { data } = await api.post<IgRule>('/admin/instagram/rules', payload)
  return data
}

export async function updateIgRule(id: string, payload: IgRulePayload): Promise<IgRule> {
  const { data } = await api.put<IgRule>(`/admin/instagram/rules/${id}`, payload)
  return data
}

export async function deleteIgRule(id: string): Promise<void> {
  await api.delete(`/admin/instagram/rules/${id}`)
}

// ═══════════════════════════════════════════════ BILIM BAZASI

export async function getIgKnowledge(): Promise<IgKnowledge[]> {
  const { data } = await api.get<IgKnowledge[]>('/admin/instagram/knowledge')
  return data
}

/** BULK saqlash: ro'yxat butunlay almashtiriladi (bitta "Saqlash" tugmasi). */
export async function saveIgKnowledge(items: IgKnowledge[]): Promise<IgKnowledge[]> {
  const { data } = await api.put<IgKnowledge[]>('/admin/instagram/knowledge', { items })
  return data
}

// ═══════════════════════════════════════════════ SINOV VA DIAGNOSTIKA

/** AI'ni sinash — javob faqat ekranda ko'rsatiladi, mijozga yuborilmaydi. */
export async function testIgAgent(channel: IgChannel, message: string): Promise<IgTestAgentResult> {
  const { data } = await api.post<IgTestAgentResult>('/admin/instagram/test-agent', {
    channel,
    message,
  })
  return data
}

/** Soxta webhook hodisasi — navbatga qo'yiladi va butun oqim tekshiriladi. */
export async function simulateIgEvent(payload: {
  kind: 'comment' | 'dm'
  text: string
  username: string
  senderId?: string
}): Promise<void> {
  await api.post('/admin/instagram/simulate', payload)
}

export async function getIgEvents(status?: IgEventStatus | ''): Promise<IgEvent[]> {
  const { data } = await api.get<IgEvent[]>('/admin/instagram/events', { params: clean({ status }) })
  return data
}

// ═══════════════════════════════════════════════ ANALITIKA

export async function getIgAnalytics(from?: string, to?: string): Promise<IgAnalytics> {
  const { data } = await api.get<IgAnalytics>('/admin/instagram/analytics', {
    params: clean({ from, to }),
  })
  return data
}
