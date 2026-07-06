import * as signalR from '@microsoft/signalr'
import type {
  Broadcast,
  ChatMessage,
  MessageClass,
  PushMessage,
  PushRecipient,
  TelegramParent,
  TelegramStatus,
  TelegramTeacher,
} from '@/types'
import { api, USE_MOCK } from '../client'

/** Xabarlar bo'limi uchun guruhlar ro'yxati (o'quvchi soni, ro'yxatdagi ota-onalar, oxirgi xabar) */
export async function getMessageClasses(): Promise<MessageClass[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<MessageClass[]>('/admin/messages/classes')
  return data
}

/** Guruh chati xabarlari. since berilsa — shu vaqtdan keyingilar. */
export async function getChat(className: string, since?: string): Promise<ChatMessage[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<ChatMessage[]>(
    `/admin/messages/chat/${encodeURIComponent(className)}`,
    { params: since ? { since } : undefined },
  )
  return data
}

/** Guruh chatiga xabar yuborish (admin sifatida) */
export async function sendChat(className: string, text: string): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(
    `/admin/messages/chat/${encodeURIComponent(className)}`,
    { text },
  )
  return data
}

/** Yuborilgan e'lonlar tarixi (ixtiyoriy guruh bo'yicha) */
export async function getBroadcasts(className?: string): Promise<Broadcast[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<Broadcast[]>('/admin/messages/broadcasts', {
    params: className ? { className } : undefined,
  })
  return data
}

/** E'lon yuborish so'rovi. Matnda o'rinbosarlar: {fish} {sinf} {qarzdorlik} {balans} {ota-ona} {telefon}. */
export interface SendBroadcastReq {
  /** Qamrov: tanlangan guruh / barcha guruh / tanlangan o'quvchilar/o'qituvchilar */
  scope: 'class' | 'all' | 'selected'
  /** scope === 'class' bo'lganda guruh nomi */
  className?: string
  /** Faqat balansi manfiy (qarzdor) o'quvchilar */
  onlyDebtors: boolean
  /** scope === 'selected' bo'lganda tanlangan o'quvchi id'lari */
  studentIds?: string[]
  /** scope === 'selected' bo'lganda tanlangan o'qituvchi id'lari */
  teacherIds?: string[]
  text: string
}

/** Ota-onalarga Telegram bot orqali e'lon yuborish (har o'quvchiga moslab) */
export async function sendBroadcast(req: SendBroadcastReq): Promise<Broadcast> {
  const { data } = await api.post<Broadcast>('/admin/messages/broadcast', req)
  return data
}

/** Guruh bo'yicha Telegramda ro'yxatdan o'tgan ota-onalar */
export async function getTelegramRegistrations(className?: string): Promise<TelegramParent[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<TelegramParent[]>('/admin/messages/telegram/registrations', {
    params: className ? { className } : undefined,
  })
  return data
}

/** Telegramda ro'yxatdan o'tgan o'qituvchilar — "Tanlab" e'lon ro'yxati uchun */
export async function getTelegramTeacherRegistrations(): Promise<TelegramTeacher[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<TelegramTeacher[]>('/admin/messages/telegram/registrations/teachers')
  return data
}

/** Telegram bot sozlanganmi (token bormi) — admin UIga ko'rsatish uchun */
export async function getTelegramStatus(): Promise<TelegramStatus> {
  if (USE_MOCK) return { configured: false, botUsername: '' }
  const { data } = await api.get<TelegramStatus>('/admin/messages/telegram/status')
  return data
}

/* ---------- Push (Firebase / FCM) ---------- */

export interface SendPushReq {
  /** Kimga: ota-onalar / o'qituvchilar / tanlangan (custom) */
  audience: 'parents' | 'teachers' | 'selected'
  /** parents uchun guruh (bo'sh = barcha guruh) */
  className?: string
  /** selected uchun tanlangan akkaunt id'lari */
  userIds?: string[]
  title: string
  body: string
}

/** Firebase push sozlanganmi (service account bormi) */
export async function getPushStatus(): Promise<{ configured: boolean }> {
  if (USE_MOCK) return { configured: false }
  const { data } = await api.get<{ configured: boolean }>('/admin/messages/push/status')
  return data
}

/** "Tanlab" push uchun oluvchilar ro'yxati (ota-onalar + o'qituvchilar) */
export async function getPushRecipients(): Promise<PushRecipient[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<PushRecipient[]>('/admin/messages/push/recipients')
  return data
}

/** Yuborilgan push tarixi */
export async function getPushMessages(): Promise<PushMessage[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<PushMessage[]>('/admin/messages/push')
  return data
}

export interface PushConfirmation {
  name: string
  group: string
  confirmed: boolean
  confirmedAt: string | null
}
/** Bitta e'lon bo'yicha kim tasdiqlagani (admin ko'rishi uchun). */
export async function getPushConfirmations(id: string): Promise<PushConfirmation[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<PushConfirmation[]>(`/admin/messages/push/${id}/confirmations`)
  return data
}

/** Ilovaga push yuborish */
export async function sendPush(req: SendPushReq): Promise<PushMessage> {
  const { data } = await api.post<PushMessage>('/admin/messages/push/send', req)
  return data
}

/* ---------- SMS (Eskiz.uz) ---------- */

export interface SmsBatch {
  id: string
  audience: string
  message: string
  senderName: string
  createdAt: string
  recipientCount: number
  sentCount: number
  /** Yuborish manbai: "eskiz" (default) | "local" (CTI agent telefonidan). */
  provider: string
}
export interface SmsLog {
  id: string
  phoneNumber: string
  recipientName: string
  status: string
  createdAt: string
  /** Yuborish manbai: "eskiz" (default) | "local" (CTI agent telefonidan). */
  provider: string
}
/** SMS qaysi orqali yuborilsin — Eskiz (standart) yoki Local Call agent telefonidan (SIM). */
export type SmsProvider = 'eskiz' | 'local'
export interface SendSmsReq {
  /** Kimga: ota-onalar / o'quvchilar / o'qituvchilar / tanlangan (studentIds/teacherIds) */
  audience: 'parents' | 'students' | 'teachers' | 'selected'
  /** parents/students uchun guruh (bo'sh = barcha) */
  className?: string
  onlyDebtors: boolean
  /** selected uchun tanlangan o'quvchi id'lari */
  studentIds?: string[]
  /** selected uchun tanlangan o'qituvchi id'lari (doim o'z raqamiga — toParent ularga taalluqli emas) */
  teacherIds?: string[]
  /** selected uchun: ota-ona (true) yoki o'quvchi (false) raqamiga */
  toParent?: boolean
  text: string
  /** Yuborish manbai — bo'sh bo'lsa "eskiz". */
  provider?: SmsProvider
  /** provider="local" bo'lsa — aniq agent (bo'sh — Sozlamalardagi standart agent). */
  agentId?: string
}

/** SMS holati: Eskiz sozlanganmi + sender, Local SMS yoqilganmi + standart agent. */
export interface SmsStatus {
  configured: boolean
  from: string
  localEnabled: boolean
  localDefaultAgentId: string | null
}
export async function getSmsStatus(): Promise<SmsStatus> {
  if (USE_MOCK) return { configured: false, from: '4546', localEnabled: false, localDefaultAgentId: null }
  const { data } = await api.get<SmsStatus>('/admin/messages/sms/status')
  return data
}

/** Yuborilgan SMS partiyalari (tarix) */
export async function getSmsBatches(): Promise<SmsBatch[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<SmsBatch[]>('/admin/messages/sms')
  return data
}

/** Bitta SMS partiyasi bo'yicha raqamlar va holat */
export async function getSmsLogs(id: string): Promise<SmsLog[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<SmsLog[]>(`/admin/messages/sms/${id}/logs`)
  return data
}

/** SMS yuborish (Eskiz orqali, har o'quvchiga moslab) */
export async function sendSms(req: SendSmsReq): Promise<SmsBatch> {
  const { data } = await api.post<SmsBatch>('/admin/messages/sms/send', req)
  return data
}

/** "Tanlab" SMS uchun oluvchi (o'quvchi). Telefon yo'q bo'lsa null. */
export interface SmsRecipient {
  studentId: string
  fullName: string
  className: string
  parentPhone: string | null
  studentPhone: string | null
}
/** "Tanlab" SMS uchun barcha arxivlanmagan o'quvchilar (ism bo'yicha). */
export async function getSmsRecipients(): Promise<SmsRecipient[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<SmsRecipient[]>('/admin/messages/sms/recipients')
  return data
}

/** "Tanlab" SMS uchun o'qituvchi oluvchi. Phone yo'q bo'lsa null. */
export interface SmsTeacherRecipient {
  teacherId: string
  fullName: string
  phone: string | null
}
/** "Tanlab" SMS uchun barcha arxivlanmagan o'qituvchilar (ism bo'yicha). */
export async function getSmsTeacherRecipients(): Promise<SmsTeacherRecipient[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<SmsTeacherRecipient[]>('/admin/messages/sms/recipients/teachers')
  return data
}

/* ---------- Birlashgan tayyor matnlar (SMS andozalari + eslatma qoidalari) ---------- */
/** Birlashgan tayyor matn. source: "sms" (Eskiz andozasi) | "reminder" (eslatma qoidasi matni). */
export interface UnifiedTemplate {
  source: 'sms' | 'reminder'
  name: string
  text: string
}
/** Barcha tayyor matnlar — uchala yuborish oynasida (e'lon/push/SMS) chip sifatida. */
export async function getAllMessageTemplates(): Promise<UnifiedTemplate[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<UnifiedTemplate[]>('/admin/messages/templates/all')
  return data
}

/* ---------- SMS andozalari (shablonlar) ---------- */
/** Qo'lda yuboriladigan SMS andozasi. (Avto xabarlar endi AutoMessageRule'da — trigger/isAuto YO'Q.) */
export interface SmsTemplate {
  id: string
  name: string
  text: string
  order: number
}
export interface SaveSmsTemplateReq {
  name: string
  text: string
}
export async function getSmsTemplates(): Promise<SmsTemplate[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<SmsTemplate[]>('/admin/messages/sms/templates')
  return data
}
export async function createSmsTemplate(req: SaveSmsTemplateReq): Promise<SmsTemplate> {
  const { data } = await api.post<SmsTemplate>('/admin/messages/sms/templates', req)
  return data
}
export async function updateSmsTemplate(id: string, req: SaveSmsTemplateReq): Promise<SmsTemplate> {
  const { data } = await api.put<SmsTemplate>(`/admin/messages/sms/templates/${id}`, req)
  return data
}
export async function deleteSmsTemplate(id: string): Promise<void> {
  await api.delete(`/admin/messages/sms/templates/${id}`)
}

/** provider="local" bo'lganda qaysi agent orqali yuborilsin (bo'sh — Sozlamalardagi standart agent). */
export interface SmsProviderOpts {
  provider?: SmsProvider
  agentId?: string
}

/** Lidga SMS yuborish (lid telefon raqamiga). */
export async function sendLeadSms(leadId: string, text: string, opts: SmsProviderOpts = {}): Promise<SmsBatch> {
  const { data } = await api.post<SmsBatch>('/admin/messages/sms/lead', {
    leadId, text, provider: opts.provider, agentId: opts.agentId,
  })
  return data
}

/** Lidlarga OMMAVIY SMS natijasi. */
export interface LeadBulkSmsResult {
  sent: number
  failed: number
  noPhone: number
}
/** Bir nechta lidga SMS yuborish (har biriga o'z raqamiga, tokenlar lidga moslab to'ldiriladi). */
export async function sendLeadSmsBulk(
  leadIds: string[], text: string, opts: SmsProviderOpts = {},
): Promise<LeadBulkSmsResult> {
  const { data } = await api.post<LeadBulkSmsResult>('/admin/messages/sms/lead-bulk', {
    leadIds,
    text,
    provider: opts.provider,
    agentId: opts.agentId,
  })
  return data
}

/**
 * Har bir kanal uchun oxirgi xabar vaqti — o'qilmagan xabarlarni aniqlash uchun.
 * Qaytadi: { [channelName]: ISO vaqt yoki null (xabari yo'q kanal) }
 */
export async function getAdminLastMessages(): Promise<Record<string, string | null>> {
  if (USE_MOCK) return {}
  const { data } = await api.get<Record<string, string | null>>('/admin/messages/last-messages')
  return data
}

/**
 * Guruh chati uchun real-time SignalR ulanishi. Yangi xabar kelganda onMessage chaqiriladi
 * (foydalanuvchi a'zo bo'lgan BARCHA guruhlar bo'yicha — komponent kerakli guruhni filtrlaydi).
 * Mock rejimida null qaytaradi.
 */
export function connectChat(onMessage: (m: ChatMessage) => void): signalR.HubConnection | null {
  if (USE_MOCK) return null
  const conn = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/chat', { accessTokenFactory: () => localStorage.getItem('token') ?? '' })
    .withAutomaticReconnect()
    .build()
  conn.on('message', (m: ChatMessage) => onMessage(m))
  return conn
}
