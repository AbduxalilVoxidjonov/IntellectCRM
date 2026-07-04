import { api } from '../client'

/** Local Call (CTI) — Android agent-telefonlar orqali qo'ng'iroqlar: agentlar, tarix, audio, dial. */

export interface CtiAgent {
  id: string
  login: string
  displayName: string
  isActive: boolean
  isOnline: boolean
  lastSeenAt: string | null
  hasFcmToken: boolean
}

export type CtiCallDirection = 'incoming' | 'outgoing' | 'missed'

export interface CtiCall {
  id: string
  agentId: string
  agentName: string
  direction: CtiCallDirection
  remoteNumber: string
  contactName: string
  studentId: string | null
  studentName: string | null
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  durationSec: number
  hasAudio: boolean
  note: string
}

export interface CtiCallEvent {
  type: 'ringing' | 'answered' | 'ended'
  at: string
}

export interface CtiCallDetail extends CtiCall {
  events: CtiCallEvent[]
}

export interface CtiCallFilters {
  agentId?: string
  direction?: '' | CtiCallDirection
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface CtiCallList {
  total: number
  items: CtiCall[]
}

/** Agentlar ro'yxati (onlayn holat, FCM bor-yo'qligi bilan). */
export async function getCtiAgents(): Promise<CtiAgent[]> {
  const { data } = await api.get<CtiAgent[]>('/cti/agents')
  return data
}

/** Yangi agent-telefon qo'shish (login/parol Android ilovaga kiritiladi). */
export async function createCtiAgent(req: {
  login: string
  password: string
  displayName: string
}): Promise<{ id: string }> {
  const { data } = await api.post('/cti/agents', req)
  return data
}

/** Agentni tahrirlash — parol bo'sh qoldirilsa o'zgarmaydi. */
export async function updateCtiAgent(
  id: string,
  req: { displayName: string; isActive: boolean; password: string },
): Promise<void> {
  await api.put(`/cti/agents/${id}`, req)
}

/** Click-to-call — agentga push orqali buyruq (agent oflayn bo'lsa delivered=false). */
export async function dialCtiAgent(
  agentId: string,
  number: string,
): Promise<{ commandId: string; delivered: boolean }> {
  const { data } = await api.post(`/cti/agents/${agentId}/dial`, { number })
  return data
}

/** Qo'ng'iroqlar tarixi — sahifalab, filtrlar bilan. */
export async function getCtiCalls(
  f: CtiCallFilters = {},
  page = 1,
  pageSize = 50,
): Promise<CtiCallList> {
  const { data } = await api.get<CtiCallList>('/cti/calls', {
    params: {
      agentId: f.agentId || undefined,
      direction: f.direction || undefined,
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      search: f.search || undefined,
      page,
      pageSize,
    },
  })
  return data
}

/** Bitta qo'ng'iroqning to'liq detali (hodisalar vaqt chizig'i bilan). */
export async function getCtiCallDetail(id: string): Promise<CtiCallDetail> {
  const { data } = await api.get<CtiCallDetail>(`/cti/calls/${id}`)
  return data
}

/** Audio yozuvni autentifikatsiya bilan yuklab, pleyer uchun blob URL qaytaradi (bo'shatish chaqiruvchida). */
export async function fetchCtiCallAudioUrl(id: string): Promise<string> {
  const res = await api.get(`/cti/calls/${id}/audio`, { responseType: 'blob' })
  return URL.createObjectURL(res.data as Blob)
}

/** Qo'ng'iroqqa izoh saqlash. */
export async function updateCtiCallNote(id: string, note: string): Promise<void> {
  await api.put(`/cti/calls/${id}/note`, { note })
}
