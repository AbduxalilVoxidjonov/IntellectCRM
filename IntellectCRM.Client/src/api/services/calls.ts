import { api } from '../client'

/** Call Center — Asterisk qo'ng'iroqlari: originate, jurnal, yozuvni tinglash. */

export type CallStatus =
  | 'originating'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'

export interface CallRow {
  id: string
  studentId: string | null
  studentName: string
  phoneNumber: string
  direction: 'outbound' | 'inbound'
  status: CallStatus
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number
  operatorName: string
  hasRecording: boolean
  note: string
}

export interface CallList {
  total: number
  items: CallRow[]
}

/** Raqam bo'yicha guruhlangan qator — tarixda bitta raqam = bitta qator. */
export interface CallGroup {
  phoneNumber: string
  studentId: string | null
  studentName: string
  callsCount: number
  answeredCount: number
  totalDurationSeconds: number
  lastCallAt: string
  lastStatus: CallStatus | ''
  lastDirection: 'inbound' | 'outbound' | ''
}

export interface CallGroupList {
  total: number
  items: CallGroup[]
}

/** Tarix filtrlari: sana oralig'i (yyyy-MM-dd), yo'nalish, holat. */
export interface CallFilters {
  search?: string
  dateFrom?: string
  dateTo?: string
  direction?: '' | 'inbound' | 'outbound'
  status?: '' | 'answered' | 'missed'
}

/** SignalR "callUpdated" hodisasi payload'i (LiveHub, topic "calls"). */
export interface CallUpdate {
  id: string
  status: CallStatus
  phoneNumber: string
  studentId: string | null
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number
  hasRecording: boolean
}

/** Modul sozlanganmi (banner uchun) + faol provayder ("moizvonki" | "asterisk" | ""). */
export async function getCallsConfig(): Promise<{
  configured: boolean
  provider: string
  defaultOperatorExtension: string
}> {
  const { data } = await api.get('/admin/calls/config')
  return data
}

/** Chiquvchi qo'ng'iroq: studentId YOKI phoneNumber (dialpad'dan). */
export async function originateCall(req: {
  studentId?: string
  phoneNumber?: string
  operatorExtension?: string
}): Promise<{ callId: string; status: CallStatus; phoneNumber: string; studentId: string | null }> {
  const { data } = await api.post('/admin/calls/originate', req)
  return data
}

/** Qo'ng'iroqlar ro'yxati (eng oxirgisi tepada). phone berilsa — faqat shu raqam bilan suhbatlar. */
export async function getCalls(f: CallFilters & { phone?: string } = {}, page = 1, pageSize = 50): Promise<CallList> {
  const { data } = await api.get<CallList>('/admin/calls', {
    params: {
      search: f.search || undefined,
      phone: f.phone || undefined,
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      direction: f.direction || undefined,
      status: f.status || undefined,
      page, pageSize,
    },
  })
  return data
}

/** Raqam bo'yicha guruhlangan tarix (har raqam bitta qator). */
export async function getCallGroups(f: CallFilters = {}, page = 1, pageSize = 50): Promise<CallGroupList> {
  const { data } = await api.get<CallGroupList>('/admin/calls/by-number', {
    params: {
      search: f.search || undefined,
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      direction: f.direction || undefined,
      status: f.status || undefined,
      page, pageSize,
    },
  })
  return data
}

/** Bitta o'quvchining qo'ng'iroqlar tarixi (detalli oynadagi tab). */
export async function getStudentCalls(studentId: string): Promise<CallRow[]> {
  const { data } = await api.get<CallRow[]>(`/admin/calls/student/${studentId}`)
  return data
}

/** Tarixni provayderdan QO'LDA sinxronlash (MoiZvonki calls.list) — eski qo'ng'iroqlar ham tortiladi. */
export async function syncCallHistory(): Promise<{ added: number; updated: number }> {
  const { data } = await api.post('/admin/calls/telephony/sync', {})
  return data
}

/** Yozuvni autentifikatsiya bilan yuklab, pleyer uchun blob URL qaytaradi (bo'shatish chaqiruvchida). */
export async function fetchRecordingUrl(callId: string): Promise<string> {
  const res = await api.get(`/admin/calls/${callId}/recording`, { responseType: 'blob' })
  return URL.createObjectURL(res.data as Blob)
}
