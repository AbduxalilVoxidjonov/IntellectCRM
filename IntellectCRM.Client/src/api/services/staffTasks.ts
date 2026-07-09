import { api } from '../client'

export interface StaffTaskTarget {
  userId: string
  fullName: string
  role: string
  position: string
  phone: string
  hasTelegram: boolean
  taskCount: number
}

export interface StaffTask {
  id: string
  staffUserId: string
  title: string
  order: number
}

export interface StaffTaskHistoryItem {
  title: string
  done: boolean
  doneAt: string | null
}

export interface StaffTaskHistoryRow {
  userId: string
  fullName: string
  total: number
  done: number
  items: StaffTaskHistoryItem[]
}

export interface StaffTaskSettings {
  enabled: boolean
  hour: number
  minute: number
}

export async function getStaffTaskTargets(): Promise<StaffTaskTarget[]> {
  const { data } = await api.get<StaffTaskTarget[]>('/admin/staff-tasks/targets')
  return data
}

export async function getStaffTasks(userId: string): Promise<StaffTask[]> {
  const { data } = await api.get<StaffTask[]>(`/admin/staff-tasks/${userId}/tasks`)
  return data
}

export async function createStaffTask(userId: string, title: string): Promise<StaffTask> {
  const { data } = await api.post<StaffTask>(`/admin/staff-tasks/${userId}/tasks`, { title })
  return data
}

export async function updateStaffTask(id: string, title: string): Promise<void> {
  await api.put(`/admin/staff-tasks/tasks/${id}`, { title })
}

export async function deleteStaffTask(id: string): Promise<void> {
  await api.delete(`/admin/staff-tasks/tasks/${id}`)
}

export async function getStaffTaskHistory(date: string): Promise<StaffTaskHistoryRow[]> {
  const { data } = await api.get<StaffTaskHistoryRow[]>('/admin/staff-tasks/history', { params: { date } })
  return data
}

export async function getStaffTaskSettings(): Promise<StaffTaskSettings> {
  const { data } = await api.get<StaffTaskSettings>('/admin/staff-tasks/settings')
  return data
}

export async function setStaffTaskSettings(s: StaffTaskSettings): Promise<void> {
  await api.put('/admin/staff-tasks/settings', s)
}
