import type { Lead, LeadEvent, LeadEventType, TrialLesson, TrialResult, CrmStats } from '@/types'
import type { ReceiptData } from '@/lib/receipt'
import { delay, uid } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { leadsMock } from '../mock/leads'

export type LeadPayload = Omit<Lead, 'id' | 'stage'>

export async function getLeads(): Promise<Lead[]> {
  if (USE_MOCK) {
    await delay()
    return leadsMock
  }
  const { data } = await api.get<Lead[]>('/admin/leads')
  return data.map((l: any) => ({
    ...l,
    firstLessonAttendance: l.firstLessonAttendance || 'no-lesson',
  }))
}

export async function createLead(payload: LeadPayload, stage: string): Promise<Lead> {
  if (USE_MOCK) {
    await delay(300)
    return { ...payload, id: uid(), stage }
  }
  const { data } = await api.post<Lead>('/admin/leads', { ...payload, stage })
  return data
}

export async function updateLead(id: string, payload: LeadPayload): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  await api.put(`/admin/leads/${id}`, payload)
}

export async function updateLeadStage(id: string, stage: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.patch(`/admin/leads/${id}`, { stage })
}

export async function deleteLead(id: string, reasonId?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.delete(`/admin/leads/${id}`, { params: reasonId ? { reasonId } : undefined })
}

/* ---------- CRM: tarix (timeline) ---------- */

export async function getLeadEvents(id: string): Promise<LeadEvent[]> {
  if (USE_MOCK) {
    await delay(200)
    return []
  }
  const { data } = await api.get<LeadEvent[]>(`/admin/leads/${id}/events`)
  return data
}

export async function addLeadEvent(id: string, type: LeadEventType, text: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.post(`/admin/leads/${id}/events`, { type, text })
}

/* ---------- CRM: sinov darslari ---------- */

export async function getLeadTrials(id: string): Promise<TrialLesson[]> {
  if (USE_MOCK) {
    await delay(200)
    return []
  }
  const { data } = await api.get<TrialLesson[]>(`/admin/leads/${id}/trials`)
  return data
}

export async function scheduleTrial(
  id: string,
  groupId: string,
  scheduledAt: string,
): Promise<string | null> {
  if (USE_MOCK) {
    await delay(200)
    return null
  }
  const { data } = await api.post<{ trialId?: string }>(`/admin/leads/${id}/trials`, {
    groupId,
    scheduledAt,
  })
  return data?.trialId ?? null
}

/** Lid sinov darsi cheki (to'lovsiz ro'yxat varaqasi) — termal chek chizish/print uchun. */
export async function getTrialReceipt(
  trialId: string,
): Promise<ReceiptData & { settingsJson: string }> {
  const { data } = await api.get<ReceiptData & { settingsJson: string }>(
    `/admin/leads/trials/${trialId}/receipt`,
  )
  return data
}

export async function setTrialResult(trialId: string, result: TrialResult): Promise<void> {
  if (USE_MOCK) {
    await delay(200)
    return
  }
  await api.patch(`/admin/leads/trials/${trialId}`, { result })
}

/* ---------- CRM: o'quvchiga aylantirish ---------- */

export async function convertLead(
  id: string,
  body: { enrollmentDate?: string; groupId?: string },
): Promise<{ studentId: string }> {
  if (USE_MOCK) {
    await delay(300)
    return { studentId: uid() }
  }
  const { data } = await api.post<{ studentId: string }>(`/admin/leads/${id}/convert`, body)
  return data
}

/* ---------- CRM: statistika ---------- */

export async function getCrmStats(): Promise<CrmStats> {
  if (USE_MOCK) {
    await delay(300)
    return { totalLeads: 0, converted: 0, conversionRate: 0, byStage: [], bySource: [], monthly: [] }
  }
  const { data } = await api.get<CrmStats>('/admin/leads/stats')
  return data
}
