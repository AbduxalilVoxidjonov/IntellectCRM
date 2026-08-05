import { api } from '../client'
import type { ActionReason } from '@/types'

/** Barcha amal sabablari (kategoriya bo'yicha tartiblangan). */
export async function getActionReasons(): Promise<ActionReason[]> {
  const { data } = await api.get<ActionReason[]>('/admin/action-reasons')
  return data
}

/**
 * Serverda RUXSAT ETILGAN kategoriyalar kalitlari (tartibi bilan).
 *
 * "Sabablar" sahifasi kartochkalarni shundan quradi — backendga qo'shilgan yangi kategoriya
 * UI'da o'z-o'zidan paydo bo'ladi (yorlig'i bo'lmasa kalit nomi bilan). Ilgari ro'yxat faqat
 * frontendda edi va `contact`/`archive_student` sahifada UMUMAN ko'rinmasdi.
 */
export async function getActionReasonCategories(): Promise<string[]> {
  const { data } = await api.get<string[]>('/admin/action-reasons/categories')
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
