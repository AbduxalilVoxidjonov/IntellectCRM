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

/* ---------- Maktab ma'lumotlari ---------- */

export interface SchoolInfo {
  name: string
  director: string
  phone: string
  email: string
  address: string
  region: string
  district: string
}

const emptySchoolInfo: SchoolInfo = {
  name: '',
  director: '',
  phone: '',
  email: '',
  address: '',
  region: '',
  district: '',
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

/* ---------- Telegram bot sozlamasi ---------- */

export interface TelegramConfig {
  botToken: string
  botUsername: string
  /** Bot ko'rsatiladigan nomi (masalan "Maktab LMS Bot") */
  botName: string
  /** Token bo'sh emasligini bildiradi (bot ishlashga tayyor) */
  configured: boolean
}

export async function getTelegramSettings(): Promise<TelegramConfig> {
  if (USE_MOCK) {
    await delay()
    return { botToken: '', botUsername: '', botName: '', configured: false }
  }
  const { data } = await api.get<TelegramConfig>('/admin/settings/telegram')
  return data
}

export async function saveTelegramSettings(cfg: {
  botToken: string
  botUsername: string
  botName: string
}): Promise<TelegramConfig> {
  if (USE_MOCK) {
    await delay(250)
    return { ...cfg, configured: !!cfg.botToken.trim() }
  }
  const { data } = await api.put<TelegramConfig>('/admin/settings/telegram', cfg)
  return data
}

/* ---------- Push (Firebase / FCM) sozlamasi ---------- */

export interface FirebaseConfig {
  /** Firebase service account (JSON, to'liq) — native (Flutter) ilovaga push YUBORISH uchun */
  serviceAccountJson: string
  /** Service account to'g'ri kiritilgan (push yuborishga tayyor) */
  configured: boolean
}

export interface SaveFirebaseInput {
  serviceAccountJson: string
}

export async function getFirebaseSettings(): Promise<FirebaseConfig> {
  if (USE_MOCK) {
    await delay()
    return { serviceAccountJson: '', configured: false }
  }
  const { data } = await api.get<FirebaseConfig>('/admin/settings/firebase')
  return data
}

export async function saveFirebaseSettings(input: SaveFirebaseInput): Promise<FirebaseConfig> {
  if (USE_MOCK) {
    await delay(250)
    return { ...input, configured: !!input.serviceAccountJson.trim() }
  }
  const { data } = await api.put<FirebaseConfig>('/admin/settings/firebase', input)
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

/* ---------- Avtomatik to'lov eslatmasi ---------- */

export interface PaymentReminderConfig {
  /** Avtomatik to'lov eslatmasi yoqilganmi (default true) */
  enabled: boolean
}

export async function getPaymentReminderSettings(): Promise<PaymentReminderConfig> {
  if (USE_MOCK) {
    await delay()
    return { enabled: true }
  }
  const { data } = await api.get<PaymentReminderConfig>('/admin/settings/payment-reminders')
  return data
}

export async function savePaymentReminderSettings(payload: {
  enabled: boolean
}): Promise<PaymentReminderConfig> {
  if (USE_MOCK) {
    await delay(250)
    return payload
  }
  const { data } = await api.put<PaymentReminderConfig>('/admin/settings/payment-reminders', payload)
  return data
}

/** Maktab nomi (brending — barcha rollar uchun) */
export async function getSchoolName(): Promise<string> {
  if (USE_MOCK) {
    await delay()
    return ''
  }
  const { data } = await api.get<{ name: string }>('/school')
  return data.name
}
