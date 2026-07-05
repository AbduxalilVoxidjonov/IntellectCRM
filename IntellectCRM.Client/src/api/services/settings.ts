import type { AbsenceReason, SchoolSettings } from '@/types'
import { delay } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { settingsMock } from '../mock/settings'

export async function getSettings(): Promise<SchoolSettings> {
  if (USE_MOCK) {
    await delay()
    return settingsMock
  }
  const { data } = await api.get<SchoolSettings>('/admin/settings')
  return data
}

export async function saveAbsenceReasons(absenceReasons: AbsenceReason[]): Promise<void> {
  if (USE_MOCK) {
    await delay(250)
    return
  }
  await api.put('/admin/settings/absence-reasons', { absenceReasons })
}

/* ---------- Markaz ma'lumotlari ---------- */

export interface SchoolInfo {
  name: string
  director: string
  phone: string
  email: string
  address: string
  region: string
  district: string
  logoUrl: string
}

const emptySchoolInfo: SchoolInfo = {
  name: '',
  director: '',
  phone: '',
  email: '',
  address: '',
  region: '',
  district: '',
  logoUrl: '',
}

export async function getSchoolInfo(): Promise<SchoolInfo> {
  if (USE_MOCK) {
    await delay()
    return emptySchoolInfo
  }
  const { data } = await api.get<SchoolInfo>('/admin/settings/school')
  return data
}

export async function saveSchoolInfo(info: SchoolInfo): Promise<void> {
  if (USE_MOCK) {
    await delay(250)
    return
  }
  await api.put('/admin/settings/school', info)
}

/** Markaz logosini yuklash (rasm) — yangilangan SchoolInfo qaytadi. */
export async function uploadLogo(file: File): Promise<SchoolInfo> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<SchoolInfo>('/admin/settings/logo', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Markaz logosini o'chirish — yangilangan SchoolInfo qaytadi. */
export async function deleteLogo(): Promise<SchoolInfo> {
  const { data } = await api.delete<SchoolInfo>('/admin/settings/logo')
  return data
}

/* ---------- Ommaviy brending (autentifikatsiyasiz) ---------- */

export interface PublicBrand {
  name: string
  logoUrl: string
  phone: string
}

/** Login/test sahifalari uchun ommaviy brending (tokensiz). */
export async function getPublicBrand(): Promise<PublicBrand> {
  if (USE_MOCK) {
    await delay()
    return { name: '', logoUrl: '', phone: '' }
  }
  const { data } = await api.get<PublicBrand>('/public/brand')
  return data
}

/* ---------- Telegram bot sozlamasi ---------- */

export interface TelegramConfig {
  botToken: string
  botUsername: string
  /** Bot ko'rsatiladigan nomi (masalan "IntellectCRM Bot") */
  botName: string
  /** Token bo'sh emasligini bildiradi (bot ishlashga tayyor) */
  configured: boolean
  /** Markaz Telegram kanali (havola yoki @username) — o'quvchi/o'qituvchi ilovasida ko'rinadi */
  channel: string
}

export async function getTelegramSettings(): Promise<TelegramConfig> {
  if (USE_MOCK) {
    await delay()
    return { botToken: '', botUsername: '', botName: '', configured: false, channel: '' }
  }
  const { data } = await api.get<TelegramConfig>('/admin/settings/telegram')
  return data
}

export async function saveTelegramSettings(cfg: {
  botToken: string
  botUsername: string
  botName: string
  channel: string
}): Promise<TelegramConfig> {
  if (USE_MOCK) {
    await delay(250)
    return { ...cfg, configured: !!cfg.botToken.trim() }
  }
  const { data } = await api.put<TelegramConfig>('/admin/settings/telegram', cfg)
  return data
}

/* ---------- Ilova (APK) — Telegram bot yuboradi ---------- */

export interface AppApkConfig {
  studentApkName: string
  studentApkSize: number
  teacherApkName: string
  teacherApkSize: number
}

export async function getAppApkSettings(): Promise<AppApkConfig> {
  if (USE_MOCK) {
    await delay()
    return { studentApkName: '', studentApkSize: 0, teacherApkName: '', teacherApkSize: 0 }
  }
  const { data } = await api.get<AppApkConfig>('/admin/settings/app-apk')
  return data
}

export async function uploadAppApk(role: 'student' | 'teacher', file: File): Promise<AppApkConfig> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<AppApkConfig>(`/admin/settings/app-apk/${role}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteAppApk(role: 'student' | 'teacher'): Promise<AppApkConfig> {
  const { data } = await api.delete<AppApkConfig>(`/admin/settings/app-apk/${role}`)
  return data
}

/* ---------- Push (Firebase / FCM) sozlamasi ---------- */

export interface FirebaseConfig {
  /** Firebase service account (JSON, to'liq) — server push YUBORISH uchun (maxfiy) */
  serviceAccountJson: string
  /** Service account to'g'ri kiritilgan (native push yuborishga tayyor) */
  configured: boolean
  /** Firebase web app config (JSON: apiKey, projectId, messagingSenderId, appId...) — brauzer/PWA token uchun */
  webConfigJson: string
  /** Web Push (VAPID) ochiq kaliti — brauzer/PWA token uchun */
  vapidKey: string
  /** Web/PWA push tayyor (web config + vapid kalit kiritilgan) */
  webConfigured: boolean
}

export interface SaveFirebaseInput {
  serviceAccountJson: string
  webConfigJson: string
  vapidKey: string
}

export async function getFirebaseSettings(): Promise<FirebaseConfig> {
  if (USE_MOCK) {
    await delay()
    return { serviceAccountJson: '', configured: false, webConfigJson: '', vapidKey: '', webConfigured: false }
  }
  const { data } = await api.get<FirebaseConfig>('/admin/settings/firebase')
  return data
}

export async function saveFirebaseSettings(input: SaveFirebaseInput): Promise<FirebaseConfig> {
  if (USE_MOCK) {
    await delay(250)
    return {
      ...input,
      configured: !!input.serviceAccountJson.trim(),
      webConfigured: !!input.webConfigJson.trim() && !!input.vapidKey.trim(),
    }
  }
  const { data } = await api.put<FirebaseConfig>('/admin/settings/firebase', input)
  return data
}

/** Ommaviy web/PWA push konfiguratsiyasi (autentifikatsiyasiz) — brauzer FCM token olishi uchun. */
export interface PublicPushConfig {
  /** Firebase web app config JSON satri (apiKey, projectId, messagingSenderId, appId...) */
  webConfigJson: string
  /** Web Push VAPID ochiq kaliti */
  vapidKey: string
  /** Web/PWA push sozlangan (ikkalasi ham mavjud) */
  configured: boolean
}

export async function getPublicPushConfig(): Promise<PublicPushConfig> {
  const { data } = await api.get<PublicPushConfig>('/public/push-config')
  return data
}

/* ---------- Speaking (Azure Pronunciation Assessment) ---------- */

export interface AzureSpeechConfig {
  region: string
  configured: boolean
}
export async function getAzureSpeechSettings(): Promise<AzureSpeechConfig> {
  if (USE_MOCK) {
    await delay()
    return { region: '', configured: false }
  }
  const { data } = await api.get<AzureSpeechConfig>('/admin/settings/azure-speech')
  return data
}
export async function saveAzureSpeechSettings(input: { key?: string; region: string }): Promise<AzureSpeechConfig> {
  const { data } = await api.put<AzureSpeechConfig>('/admin/settings/azure-speech', input)
  return data
}

/* ---------- AI Tahlil (Google Gemini) ---------- */

export interface GeminiConfig {
  /** Ishlatiladigan model (env GEMINI_MODEL, default gemini-3.1-flash-lite). */
  model: string
  configured: boolean
}
export async function getGeminiSettings(): Promise<GeminiConfig> {
  if (USE_MOCK) {
    await delay()
    return { model: 'gemini-3.1-flash-lite', configured: false }
  }
  const { data } = await api.get<GeminiConfig>('/admin/settings/gemini')
  return data
}
export async function saveGeminiSettings(input: { key?: string }): Promise<GeminiConfig> {
  const { data } = await api.put<GeminiConfig>('/admin/settings/gemini', input)
  return data
}

/* ---------- SMS (Eskiz.uz) ---------- */
export interface EskizConfig {
  email: string
  from: string
  configured: boolean
  /** Hisobdagi qoldiq (so'm) — sozlangan bo'lsa, aks holda null. */
  balance: number | null
}
export async function getEskizSettings(): Promise<EskizConfig> {
  if (USE_MOCK) {
    await delay()
    return { email: '', from: '4546', configured: false, balance: null }
  }
  const { data } = await api.get<EskizConfig>('/admin/settings/eskiz')
  return data
}
export async function saveEskizSettings(input: {
  email?: string
  password?: string
  from?: string
}): Promise<EskizConfig> {
  const { data } = await api.put<EskizConfig>('/admin/settings/eskiz', input)
  return data
}

/* ---------- Turniket / FaceID integratsiyasi ---------- */

export interface TeacherDeviceMap {
  teacherId: string
  fullName: string
  deviceUserId: string
}

export interface TurnstileConfig {
  enabled: boolean
  vendor: string
  host: string
  port: number
  username: string
  /** Parol saqlanganmi (parolning o'zi qaytmaydi) */
  hasPassword: boolean
  /** Ish boshlanish vaqti "HH:mm" */
  workStartTime: string
  /** Kechikishga yo'l qo'yiladigan daqiqalar */
  lateGraceMinutes: number
  /** Oxirgi sinxronlash (ISO) */
  lastSync: string
  teachers: TeacherDeviceMap[]
}

export interface SaveTurnstilePayload {
  enabled: boolean
  vendor: string
  host: string
  port: number
  username: string
  /** Bo'sh = o'zgartirilmaydi (eski parol saqlanadi) */
  password?: string
  workStartTime: string
  lateGraceMinutes: number
  teachers: TeacherDeviceMap[]
}

export async function getTurnstileSettings(): Promise<TurnstileConfig> {
  const { data } = await api.get<TurnstileConfig>('/admin/settings/turnstile')
  return data
}

export async function saveTurnstileSettings(payload: SaveTurnstilePayload): Promise<TurnstileConfig> {
  const { data } = await api.put<TurnstileConfig>('/admin/settings/turnstile', payload)
  return data
}

/* ---------- Kamera (videokuzatuv) integratsiyasi ---------- */

export interface CameraConfig {
  enabled: boolean
  cameraCount: number
}

export async function getCameraSettings(): Promise<CameraConfig> {
  const { data } = await api.get<CameraConfig>('/admin/settings/cameras')
  return data
}

export async function saveCameraSettings(payload: { enabled: boolean }): Promise<CameraConfig> {
  const { data } = await api.put<CameraConfig>('/admin/settings/cameras', payload)
  return data
}

/* ---------- Eslatmalar (avtomatik push-qoidalar) ---------- */

/** "Eslatmalar" katalogidagi bitta tur — masalan qarzdorlik eslatmasi yoki davomat eslatmasi. */
export interface ReminderTriggerInfo {
  key: string
  label: string
  description: string
  supportsTemplate: boolean
  supportsOffset: boolean
  supportsAudience: boolean
  supportsSchedule: boolean
  supportsSendScope: boolean
  tokens: string[]
}

/** "custom_schedule" auditoriyasi. */
export type ReminderAudience = 'teachers' | 'students'
/** "custom_schedule" jadval turi: har kuni | oyning muayyan kunida. */
export type ReminderScheduleType = 'daily' | 'monthly'
/** "lesson_attendance" yuborish rejimi: dars boshlangach to'ldirmaganga | kunlik vaqtda
 *  bugun darsi bo'lib to'ldirmaganlarga | kunlik vaqtda HAMMAGA (to'ldirganlarga ham). */
export type ReminderSendScope = 'lesson_start' | 'not_filled' | 'all'

export interface ReminderRule {
  id: string
  trigger: string
  name: string
  enabled: boolean
  messageTemplate: string
  offsetMinutes: number
  sendScope: ReminderSendScope | ''
  audience: ReminderAudience | ''
  scheduleType: ReminderScheduleType
  scheduleTime: string
  scheduleDayOfMonth: number
  createdAt: string
}

export interface SaveReminderRuleReq {
  trigger: string
  name: string
  enabled: boolean
  messageTemplate: string
  offsetMinutes: number
  sendScope: ReminderSendScope | ''
  audience: ReminderAudience | ''
  scheduleType: ReminderScheduleType
  scheduleTime: string
  scheduleDayOfMonth: number
}

export async function getReminderTypes(): Promise<ReminderTriggerInfo[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<ReminderTriggerInfo[]>('/admin/reminders/types')
  return data
}

export async function getReminderRules(): Promise<ReminderRule[]> {
  if (USE_MOCK) return []
  const { data } = await api.get<ReminderRule[]>('/admin/reminders')
  return data
}

export async function createReminderRule(req: SaveReminderRuleReq): Promise<ReminderRule> {
  const { data } = await api.post<ReminderRule>('/admin/reminders', req)
  return data
}

export async function updateReminderRule(id: string, req: SaveReminderRuleReq): Promise<ReminderRule> {
  const { data } = await api.put<ReminderRule>(`/admin/reminders/${id}`, req)
  return data
}

export async function deleteReminderRule(id: string): Promise<void> {
  await api.delete(`/admin/reminders/${id}`)
}

/* ---------- To'lov cheki (kvitansiya) sozlamalari ---------- */

/** Chek sozlamalari JSON satrini qaytaradi (bo'sh = standart shablon). */
export async function getCheckSettings(): Promise<string> {
  if (USE_MOCK) {
    await delay()
    return ''
  }
  const { data } = await api.get<{ json: string }>('/admin/settings/check')
  return data.json ?? ''
}

/** Chek sozlamalari JSON satrini saqlaydi. */
export async function saveCheckSettings(json: string): Promise<void> {
  if (USE_MOCK) {
    await delay(250)
    return
  }
  await api.put('/admin/settings/check', { json })
}

/* ---------- Telegram backup sozlamasi ---------- */

export interface TelegramBackupConfig {
  adminChatId: string
  scheduleHour: number
  scheduleMinute: number
  enabled: boolean
  lastSentAt?: string
}

export async function getTelegramBackupConfig(): Promise<TelegramBackupConfig> {
  if (USE_MOCK) {
    await delay()
    return { adminChatId: '', scheduleHour: 21, scheduleMinute: 0, enabled: false }
  }
  const { data } = await api.get<TelegramBackupConfig>('/admin/settings/telegram-backup')
  // Backend eski yozuvlarda adminChatId null bo'lishi mumkin — '' ga normallashtiramiz
  // (aks holda komponentda .trim() oq ekran beradi).
  return { ...data, adminChatId: data.adminChatId ?? '' }
}

export async function saveTelegramBackupConfig(cfg: TelegramBackupConfig): Promise<TelegramBackupConfig> {
  if (USE_MOCK) {
    await delay(250)
    return cfg
  }
  const { data } = await api.post<TelegramBackupConfig>('/admin/settings/telegram-backup', cfg)
  return data
}

export async function testTelegramBackup(): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await delay(1200)
    return { success: true, message: "Test backup yuborildi" }
  }
  const { data } = await api.post<{ success: boolean; message: string }>('/admin/settings/telegram-backup/test')
  return data
}

/** Backupni HOZIR yuboradi — markaz ma'lumotlari JSON qilib Telegram orqali adminga. */
export async function runTelegramBackup(): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await delay(1500)
    return { success: true, message: 'Backup yuborildi (mock)' }
  }
  const { data } = await api.post<{ success: boolean; message: string }>('/admin/settings/telegram-backup/run')
  return data
}

/** Markaz nomi + logo (brending — barcha rollar uchun) */
export interface SchoolName {
  name: string
  telegramChannel: string
  logoUrl: string
}

export async function getSchoolName(): Promise<SchoolName> {
  if (USE_MOCK) {
    await delay()
    return { name: '', telegramChannel: '', logoUrl: '' }
  }
  const { data } = await api.get<SchoolName>('/school')
  return data
}
