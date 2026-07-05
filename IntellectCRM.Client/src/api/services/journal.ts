import type { JournalColumn, JournalEntry, JournalTopic, MasteryLevel } from '@/types'
import { delay } from '@/lib/utils'
import { api, USE_MOCK } from '../client'
import { journalMock } from '../mock/journal'
import { journalTopicsMock } from '../mock/journalTopics'

const gkey = (classId: string, subjectId: string, quarter: number) =>
  `${classId}-${subjectId}-${quarter}`

/** Berilgan sanada o'tilgan darslar (sinf+fan+dars raqami) — bosh sahifada yashil/qizil ko'rsatish uchun */
export interface ConductedLesson {
  classId: string
  subjectId: string
  period: number
}

export async function getConductedLessons(date: string): Promise<ConductedLesson[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<ConductedLesson[]>('/admin/journal/conducted', {
    params: { date },
  })
  return data
}

/* ---------- Guruh OYLIK jurnali (guruh sahifasi) ---------- */

export interface GroupJournalInfo {
  id: string
  name: string
  courseId: string
  courseName: string
  teacherName: string
  days: number[]
  startTime: string
  endTime: string
  room: string
  startDate: string
  monthlyFee: number
}
export interface GroupJournalStudent {
  studentId: string
  fullName: string
  status: string
  activatedAt: string
  /** O'quvchi balansi (manfiy = qarz). */
  balance: number
}
export interface GroupJournal {
  group: GroupJournalInfo
  months: string[]
  month: string
  columns: JournalColumn[]
  students: GroupJournalStudent[]
  entries: JournalEntry[]
  /** "O'tildi" deb belgilangan dars sanalari — sababsiz o'quvchi shu kunda keldi (yashil). */
  conductedDates: string[]
}

/** Guruhning bitta oylik jurnali — ustunlar guruh dars kunlari bo'yicha avtomatik, qatorlar faqat faol o'quvchilar. */
export async function getGroupJournal(classId: string, month?: string): Promise<GroupJournal> {
  if (USE_MOCK) {
    await delay()
    return {
      group: { id: classId, name: '', courseId: '', courseName: '', teacherName: '', days: [], startTime: '', endTime: '', room: '', startDate: '', monthlyFee: 0 },
      months: [], month: month ?? '', columns: [], students: [], entries: [], conductedDates: [],
    }
  }
  const { data } = await api.get<GroupJournal>('/admin/journal/group', { params: { classId, month } })
  return data
}

export async function getJournalColumns(
  classId: string,
  subjectId: string,
  quarter: number,
): Promise<JournalColumn[]> {
  if (USE_MOCK) {
    await delay()
    return []
  }
  const { data } = await api.get<JournalColumn[]>('/admin/journal/columns', {
    params: { classId, subjectId, quarter },
  })
  return data
}

export async function getJournalEntries(
  classId: string,
  subjectId: string,
  quarter: number,
): Promise<JournalEntry[]> {
  if (USE_MOCK) {
    await delay()
    return journalMock[gkey(classId, subjectId, quarter)] ?? []
  }
  const { data } = await api.get<JournalEntry[]>('/admin/journal', {
    params: { classId, subjectId, quarter },
  })
  return data
}

interface EntryPayload {
  /** null — bahoni o'chiradi; berilmasa o'zgartirmaydi (API'da ikkalasi ham yuboriladi) */
  grade?: number | null
  /** null — davomat sababini o'chiradi */
  reasonId?: string | null
  /** Uyga vazifa: 0 = belgilanmagan, 1 = qildi, 2 = qilmadi */
  homework?: number
  /** Xulq: 0 = belgilanmagan, 1 = yaxshi, 2 = yomon */
  behavior?: number
  /** O'zlashtirish darajasi (MasteryLevel); null = tozalash */
  mastery?: MasteryLevel | null
}

/** Bitta katakni belgilash — baho yoki davomat sababi (sana + dars raqami bo'yicha) */
export async function setJournalEntry(
  classId: string,
  subjectId: string,
  quarter: number,
  studentId: string,
  date: string,
  period: number,
  payload: EntryPayload,
): Promise<void> {
  if (USE_MOCK) {
    await delay(100)
    const k = gkey(classId, subjectId, quarter)
    const arr = (journalMock[k] ??= [])
    const entry: JournalEntry = {
      studentId, date, period,
      grade: payload.grade ?? undefined,
      reasonId: payload.reasonId ?? undefined,
      homework: payload.homework ?? 0,
      behavior: payload.behavior ?? 0,
      mastery: payload.mastery ?? null,
    }
    const i = arr.findIndex((e) => e.studentId === studentId && e.date === date && e.period === period)
    if (i >= 0) arr[i] = entry
    else arr.push(entry)
    return
  }
  await api.put('/admin/journal', { classId, subjectId, quarter, studentId, date, period, ...payload })
}

/** Bitta dars (sana) uchun BARCHA o'quvchiga birdan davomat. absent=false → hammasi keldi; true → hammasi kelmadi
 * (reasonId berilsa shu sabab, aks holda standart "Sababsiz"). */
export async function bulkAttendance(
  classId: string,
  subjectId: string,
  date: string,
  period: number,
  studentIds: string[],
  opts: { absent: boolean; reasonId?: string | null },
): Promise<void> {
  if (USE_MOCK) {
    await delay(120)
    return
  }
  await api.post('/admin/journal/bulk-attendance', {
    classId, subjectId, date, period, studentIds,
    absent: opts.absent, reasonId: opts.reasonId ?? null,
  })
}

export async function clearJournalEntry(
  classId: string,
  subjectId: string,
  quarter: number,
  studentId: string,
  date: string,
  period: number,
): Promise<void> {
  if (USE_MOCK) {
    await delay(100)
    const k = gkey(classId, subjectId, quarter)
    const arr = journalMock[k]
    if (arr)
      journalMock[k] = arr.filter(
        (e) => !(e.studentId === studentId && e.date === date && e.period === period),
      )
    return
  }
  await api.delete('/admin/journal', {
    params: { classId, subjectId, quarter, studentId, date, period },
  })
}

/* ---------- Jurnal boshqaruvi (tahrirlash siyosati) ---------- */

/** Jurnal tahrirlash siyosati — admin "Guruhlar → Jurnal boshqaruvi" oynasida belgilanadi. */
export interface JournalPolicy {
  /** free — istalgan o'tgan sanaga; today — faqat bugungi kun; window — oxirgi retroDays kun */
  editMode: 'free' | 'today' | 'window'
  /** window rejimida orqaga necha kungacha ruxsat (1-90) */
  retroDays: number
  /** true — baho/davomat faqat "o'tildi" deb belgilangan darsga (avval davomat, keyin baho) */
  conductedOnly: boolean
  /** true — cheklovlar admin jurnaliga ham qo'llanadi */
  applyToAdmins: boolean
}

const DEFAULT_POLICY: JournalPolicy = {
  editMode: 'free', retroDays: 3, conductedOnly: false, applyToAdmins: false,
}

export async function getJournalPolicy(): Promise<JournalPolicy> {
  if (USE_MOCK) {
    await delay()
    return { ...DEFAULT_POLICY }
  }
  const { data } = await api.get<JournalPolicy>('/admin/journal/policy')
  return data
}

export async function saveJournalPolicy(p: JournalPolicy): Promise<JournalPolicy> {
  if (USE_MOCK) {
    await delay(100)
    return { ...p }
  }
  const { data } = await api.put<JournalPolicy>('/admin/journal/policy', p)
  return data
}

/* ---------- Mavzu va uyga vazifa ---------- */

export async function getLessonNotes(
  classId: string,
  subjectId: string,
  quarter: number,
): Promise<JournalTopic[]> {
  if (USE_MOCK) {
    await delay()
    return journalTopicsMock[gkey(classId, subjectId, quarter)] ?? []
  }
  const { data } = await api.get<JournalTopic[]>('/admin/journal/notes', {
    params: { classId, subjectId, quarter },
  })
  return data
}

export async function setLessonNote(
  classId: string,
  subjectId: string,
  quarter: number,
  date: string,
  period: number,
  topic: string,
  homework: string,
  conducted: boolean,
): Promise<void> {
  if (USE_MOCK) {
    await delay(100)
    const k = gkey(classId, subjectId, quarter)
    const arr = (journalTopicsMock[k] ??= [])
    const i = arr.findIndex((t) => t.date === date && t.period === period)
    if (topic.trim() === '' && homework.trim() === '' && !conducted) {
      if (i >= 0) arr.splice(i, 1)
    } else if (i >= 0) {
      arr[i] = { date, period, topic, homework, conducted }
    } else {
      arr.push({ date, period, topic, homework, conducted })
    }
    return
  }
  await api.put('/admin/journal/notes', {
    classId,
    subjectId,
    quarter,
    date,
    period,
    topic,
    homework,
    conducted,
  })
}

/* ---------- Mavzularni Excel'dan ommaviy yuklash ---------- */

export interface TopicImportRowError {
  row: number
  reason: string
}
export interface TopicImportResult {
  imported: number
  skipped: number
  errors: number
  rowErrors: TopicImportRowError[]
}

/** Tanlangan sinf+fan+chorak uchun mavzular shabloni (.xlsx) — jadval kunlari oldindan to'ldirilgan. */
export async function downloadTopicsTemplate(
  classId: string,
  subjectId: string,
  quarter: number,
): Promise<void> {
  if (USE_MOCK) {
    alert('Shablon faqat real serverda ishlaydi (VITE_USE_MOCK=false).')
    return
  }
  const res = await api.get('/admin/journal/topics-template', {
    params: { classId, subjectId, quarter },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mavzular_shablon.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** To'ldirilgan Excel'dan mavzu+uy vazifani import qiladi (darsni "o'tilgan" qilmaydi). */
export async function importTopics(
  file: File,
  classId: string,
  subjectId: string,
  quarter: number,
): Promise<TopicImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('classId', classId)
  fd.append('subjectId', subjectId)
  fd.append('quarter', String(quarter))
  const { data } = await api.post<TopicImportResult>('/admin/journal/topics-import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
