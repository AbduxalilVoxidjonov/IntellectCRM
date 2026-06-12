import { api } from '../client'
import type { PublicTest, TestResult } from '@/types'

/**
 * Ommaviy (autentifikatsiyasiz) daraja testi servisi. `api` instance tokensiz ham ishlaydi —
 * endpointlar [AllowAnonymous]. Test topshirilganda CRM'da yangi lid yaratiladi.
 */

/** Slug bo'yicha faol testni oladi (to'g'ri javobsiz). 404 — topilmadi/faol emas. */
export async function getPublicTest(slug: string): Promise<PublicTest> {
  const { data } = await api.get<PublicTest>(`/public/test/${slug}`)
  return data
}

/** Testni topshiradi → ball/daraja + lid yaratiladi. */
export async function submitPublicTest(
  slug: string,
  body: { fullName: string; phone: string; age: number; answers: Record<string, number> },
): Promise<TestResult> {
  const { data } = await api.post<TestResult>(`/public/test/${slug}/submit`, body)
  return data
}
