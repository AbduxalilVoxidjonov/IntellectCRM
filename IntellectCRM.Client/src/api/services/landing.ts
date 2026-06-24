import { api, USE_MOCK } from '../client'
import { delay } from '@/lib/utils'

/** Apex landing kontenti — { langs: { uz, ru, en }, images: { slotId: url } }. */
export interface LandingContent {
  langs: Record<string, any>
  images: Record<string, string>
}

const empty: LandingContent = { langs: {}, images: {} }

export async function getLanding(): Promise<LandingContent> {
  if (USE_MOCK) {
    await delay()
    return empty
  }
  const { data } = await api.get<LandingContent>('/admin/landing')
  return data
}

export async function saveLanding(content: LandingContent): Promise<LandingContent> {
  if (USE_MOCK) {
    await delay(250)
    return content
  }
  const { data } = await api.put<LandingContent>('/admin/landing', content)
  return data
}

export async function uploadLandingImage(
  slotId: string,
  file: File,
): Promise<{ slotId: string; url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<{ slotId: string; url: string }>(
    `/admin/landing/images/${slotId}`,
    fd,
  )
  return data
}

export async function deleteLandingImage(slotId: string): Promise<void> {
  await api.delete(`/admin/landing/images/${slotId}`)
}

export async function resetLanding(): Promise<LandingContent> {
  const { data } = await api.post<LandingContent>('/admin/landing/reset')
  return data
}
