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

/** Barcha qo'ng'iroqlar (eng oxirgisi tepada) — "Yozuvlar tarixi". */
export async function getCalls(search = '', page = 1, pageSize = 50): Promise<CallList> {
  const { data } = await api.get<CallList>('/admin/calls', { params: { search: search || undefined, page, pageSize } })
  return data
}

/** Bitta o'quvchining qo'ng'iroqlar tarixi (detalli oynadagi tab). */
export async function getStudentCalls(studentId: string): Promise<CallRow[]> {
  const { data } = await api.get<CallRow[]>(`/admin/calls/student/${studentId}`)
  return data
}

/** Yozuvni autentifikatsiya bilan yuklab, pleyer uchun blob URL qaytaradi (bo'shatish chaqiruvchida). */
export async function fetchRecordingUrl(callId: string): Promise<string> {
  const res = await api.get(`/admin/calls/${callId}/recording`, { responseType: 'blob' })
  return URL.createObjectURL(res.data as Blob)
}
