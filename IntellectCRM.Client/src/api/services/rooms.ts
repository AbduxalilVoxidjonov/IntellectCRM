import { api } from '../client'

export interface Room {
  id: string
  name: string
  capacity: number
  building?: string
  location?: string
  isActive: boolean
  createdAt: string
}

export interface RoomUtilization {
  roomId: string
  roomName: string
  capacity: number
  currentStudents: number
  occupancyPercent: number
  activeGroupCount: number
  weeklyUtilizationPercent: number
  efficiencyScore: number
  efficiencyStatus: string
  building?: string
  location?: string
}

export interface CreateRoomPayload {
  name: string
  capacity: number
  building?: string
  location?: string
}

export async function getRooms(): Promise<Room[]> {
  const { data } = await api.get<Room[]>('/admin/rooms')
  return data
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const { data } = await api.post<Room>('/admin/rooms', payload)
  return data
}

export async function updateRoom(id: string, payload: CreateRoomPayload): Promise<Room> {
  const { data } = await api.put<Room>(`/admin/rooms/${id}`, payload)
  return data
}

export async function deleteRoom(id: string): Promise<void> {
  await api.delete(`/admin/rooms/${id}`)
}

export async function getRoomUtilizationDashboard(): Promise<RoomUtilization[]> {
  const { data } = await api.get<RoomUtilization[]>('/admin/rooms/utilization-dashboard')
  return data
}
