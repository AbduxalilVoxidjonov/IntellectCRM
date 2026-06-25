import { api, USE_MOCK } from '../client'
import { delay } from '@/lib/utils'

/** Bir til uchun kurs matni. */
export interface LandingCourseText {
  name: string
  desc: string
}
/** Kurs (narx + 3 til). */
export interface LandingCourse {
  price: string
  uz: LandingCourseText
  ru: LandingCourseText
  en: LandingCourseText
}
/** Bir til uchun ustoz matni. */
export interface LandingTeacherText {
  name: string
  role: string
  bio: string
}
/** Ustoz (rasm + 3 til). */
export interface LandingTeacher {
  photo: string
  uz: LandingTeacherText
  ru: LandingTeacherText
  en: LandingTeacherText
}

/** Apex landing kontenti — faqat tahrirlanadigan narsalar. */
export interface LandingContent {
  courses: LandingCourse[]
  teachers: LandingTeacher[]
  certificates: string[]
  gallery: string[]
  testLink: string
}

export const emptyLanding: LandingContent = {
  courses: [],
  teachers: [],
  certificates: [],
  gallery: [],
  testLink: '',
}

/** Backend qaytargan xom obyektni to'liq sxemaga normallashtiradi (eski/yarim ma'lumotlarga bardosh). */
function normalize(d: any): LandingContent {
  return {
    courses: Array.isArray(d?.courses) ? d.courses : [],
    teachers: Array.isArray(d?.teachers) ? d.teachers : [],
    certificates: Array.isArray(d?.certificates) ? d.certificates.filter(Boolean) : [],
    gallery: Array.isArray(d?.gallery) ? d.gallery.filter(Boolean) : [],
    testLink: typeof d?.testLink === 'string' ? d.testLink : '',
  }
}

export async function getLanding(): Promise<LandingContent> {
  if (USE_MOCK) {
    await delay()
    return { ...emptyLanding }
  }
  const { data } = await api.get('/admin/landing')
  return normalize(data)
}

export async function saveLanding(content: LandingContent): Promise<LandingContent> {
  if (USE_MOCK) {
    await delay(250)
    return content
  }
  const { data } = await api.put('/admin/landing', content)
  return normalize(data)
}

/** Bitta rasm yuklaydi — { url } qaytaradi. Frontend uni kerakli ro'yxatga (ustoz/sertifikat/galereya) qo'shadi. */
export async function uploadLandingImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  // DIQQAT: api klienti default `application/json` qo'yadi — multipart uchun ATAYLAB override qilamiz.
  const { data } = await api.post<{ url: string }>('/admin/landing/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

export async function resetLanding(): Promise<LandingContent> {
  const { data } = await api.post('/admin/landing/reset')
  return normalize(data)
}
