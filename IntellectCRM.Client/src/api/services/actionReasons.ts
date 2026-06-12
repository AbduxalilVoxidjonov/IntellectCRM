import { api } from '../client'
import type { ActionReason } from '@/types'

/** Barcha amal sabablari (kategoriya bo'yicha tartiblangan). */
export async function getActionReasons(): Promise<ActionReason[]> {
  const { data } = await api.get<ActionReason[]>('/admin/action-reasons')
  return data
}

export async function createActionReason(category: string, label: string): Promise<ActionReason> {
  const { data } = await api.post<ActionReason>('/admin/action-reasons', { category, label })
  return data
}

export async function updateActionReason(id: string, label: string): Promise<void> {
  await api.put(`/admin/action-reasons/${id}`, { label })
}

export async function deleteActionReason(id: string): Promise<void> {
  await api.delete(`/admin/action-reasons/${id}`)
}
