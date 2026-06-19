import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, GraduationCap, CalendarCheck, ShieldAlert, ClipboardCheck,
  User, Phone, Wallet, BookOpen, MapPin, Cake, CalendarPlus, Percent, IdCard,
  School, Clock, CalendarDays, ChevronRight, History, ListChecks, ChevronDown, Check,
  CalendarClock, Award, Download,
} from 'lucide-react'
import { genderLabels } from '@/config/constants'
import {
  Area, AreaChart, Bar, BarChart, Cell, CartesianGrid, Legend,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getStudentNotebook, type StudentNotebook } from '@/api/services/studentNotebook'
import {
  getStudentCertificates,
  downloadStudentCertificate,
  generateStudentCertificate,
  type StudentCompletedCourse,
} from '@/api/services/students'
import { getStudentGroups, getClasses } from '@/api/services/classes'
import { getCurriculum, getProgress, setProgress, getStudentCoverageLog, type CoverageLogEntry } from '@/api/services/curriculum'
import { getStudentGradingSummary, type MonthGradingSummary } from '@/api/services/grading'
import type { StudentGroupMembership, Curriculum } from '@/types'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { Loader } from '@/components/ui/Loader'
import { PaymentHistoryModal } from './PaymentHistoryModal'

const uzMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
const monthLabel = (m: string) =>
  m && m.length >= 7 ? `${uzMonths[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}` : m
const weekdayShort = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']

function groupStatusBadge(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'active':
      return { label: 'Aktiv', tone: 'green' }
    case 'frozen':
      return { label: 'Muzlatilgan', tone: 'blue' }
    case 'completed':
      return { label: 'Tugatilgan', tone: 'teal' }
    case 'left':
      return { label: 'Chiqgan', tone: 'default' }
    default:
      return { label: 'Sinov', tone: 'amber' }
  }
}

const evalColors = ['#1f47f5', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
// Har fan uchun alohida rang (statistika uslubidagi rangli nuqtalar/legend uchun)
const dynColors = [
  '#3b82f6', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#a3e635',
  '#ef4444', '#14b8a6', '#eab308', '#8b5cf6',
]
const gridStroke = '#eef0f4'
const axisTick = { fontSize: 12, fill: '#94a3b8' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0' }

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<StudentNotebook | null>(null)
  const [groups, setGroups] = useState<StudentGroupMembership[]>([])
  /** groupId → courseId (Group.courseId) — o'quv dasturini olish uchun kurs id'sini topish. */
  const [groupCourse, setGroupCourse] = useState<Record<string, string>>({})
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  /** Oylik baholash jadvalida tanlangan oy ("YYYY-MM"). */
  const [evalMonth, setEvalMonth] = useState('')
  /** Fan baholari dinamikasida tanlangan oy ("YYYY-MM"). */
  const [gradeMonth, setGradeMonth] = useState('')
  /** Darslar tarixi — o'tilgan mavzular jadvali (eng yangisi birinchi). */
  const [coverageLog, setCoverageLog] = useState<CoverageLogEntry[]>([])
  /** Baholash xulosa (oylik o'rtacha + jami mezonlar). */
  const [gradingSummary, setGradingSummary] = useState<MonthGradingSummary[]>([])
  /** Tugatgan kurslar + sertifikatlar. */
  const [certificates, setCertificates] = useState<StudentCompletedCourse[]>([])
  const [certGenerating, setCertGenerating] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getStudentNotebook(id)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    getStudentGroups(id)
      .then(setGroups)
      .catch(() => {})
    getStudentCoverageLog(id)
      .then(setCoverageLog)
      .catch(() => {})
    getStudentGradingSummary(id)
      .then(setGradingSummary)
      .catch(() => {})
    getStudentCertificates(id)
      .then(setCertificates)
      .catch((e) => console.warn('Sertifikatlar yuklanmadi:', e))
  }, [id])

  // O'quv dasturi uchun guruh→kurs id xaritasi. A'zolikda faqat courseName bor (courseId yo'q),
  // shuning uchun guruhlar ro'yxatidan (Group.courseId) groupId orqali kurs id'sini topamiz.
  useEffect(() => {
    getClasses()
      .then((list) => {
        const map: Record<string, string> = {}
        list.forEach((g) => {
          if (g.courseId) map[g.id] = g.courseId
        })
        setGroupCourse(map)
      })
      .catch(() => {})
  }, [])

  // O'quvchi o'qiydigan ALOHIDA kurslar — faqat FAOL a'zolikdagi guruhlardan, groupId→courseId orqali.
  const studentCourses = useMemo(() => {
    const seen = new Set<string>()
    const out: { courseId: string; courseName: string }[] = []
    groups
      .filter((g) => g.isActive)
      .forEach((g) => {
        const courseId = groupCourse[g.groupId]
        if (!courseId || seen.has(courseId)) return
        seen.add(courseId)
        out.push({ courseId, courseName: g.courseName })
      })
    return out
  }, [groups, groupCourse])

  // O'quvchining barcha oylari — qabul oyidan (yoki eng erta ma'lumot oyidan) joriy/oxirgi oygacha uzluksiz.
  const allMonths = useMemo(() => {
    if (!data) return []
    const present = new Set<string>()
    Object.values(data.grades).forEach((mm) => Object.keys(mm).forEach((k) => present.add(k)))
    const a = data.attendance
    ;[a.missedDays, a.illnessDays, a.missedLessons, a.illnessLessons, a.lateCount].forEach((d) =>
      Object.keys(d).forEach((k) => present.add(k)),
    )
    data.marksTrend.forEach((m) => present.add(m.month))
    const enroll = data.enrollmentDate && data.enrollmentDate.length >= 7 ? data.enrollmentDate.slice(0, 7) : ''
    const cur = new Date().toISOString().slice(0, 7)
    const sorted = [...present].sort()
    const from = [enroll, sorted[0]].filter(Boolean).sort()[0] ?? cur
    const to = [sorted[sorted.length - 1] ?? '', cur].filter(Boolean).sort().slice(-1)[0] ?? from
    return monthRangeList(from, to)
  }, [data])

  const attendanceChart = useMemo(() => {
    if (!data) return []
    return allMonths.map((m) => ({
      name: monthLabel(m),
      Qoldirgan: data.attendance.missedLessons[m] ?? 0,
      'Kech keldi': data.attendance.lateCount[m] ?? 0,
    }))
  }, [data, allMonths])

  // Standart oy — bahosi bor eng oxirgi oy (bo'lmasa oxirgi oy).
  const lastGradeMonth = useMemo(() => {
    if (!data) return ''
    for (const m of [...allMonths].reverse())
      if (data.subjects.some((s) => data.grades[s.id]?.[m] != null)) return m
    return allMonths[allMonths.length - 1] ?? ''
  }, [data, allMonths])
  useEffect(() => setGradeMonth(lastGradeMonth), [lastGradeMonth])

  // Tanlangan oyda har fan o'rtacha bahosi (bar chart) — fan rangi barqaror (subjects tartibida).
  const monthBars = useMemo(() => {
    if (!data) return []
    return data.subjects
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => data.grades[s.id]?.[gradeMonth] != null)
      .map(({ s, idx }) => ({
        name: s.name,
        baho: data.grades[s.id]?.[gradeMonth] ?? 0,
        color: dynColors[idx % dynColors.length],
      }))
  }, [data, gradeMonth])


  // Oylik baholash — barcha oylar (fanlar bo'yicha) katalogi.
  const evalMonths = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.evaluationsBySubject.forEach((s) => s.evaluations.forEach((e) => set.add(e.month)))
    return [...set].sort()
  }, [data])

  // Feedback dinamikasi uchun tur nomlari (yozma, og'zaki/suhbat... — har biri alohida chiziq).
  const evalTypeNames = useMemo(
    () => data?.evaluationTypes.map((t) => t.name) ?? [],
    [data],
  )

  // Feedback dinamikasi: har oy uchun HAR TUR (yozma, og'zaki/suhbat) bo'yicha o'rtacha — oyda bir
  // marta qo'yiladigan baholar (barcha fanlar bo'yicha o'rtacha), fanlar o'rtachasi EMAS.
  const typeDynamics = useMemo(() => {
    if (!data) return []
    return data.evaluations.map((e) => {
      const row: Record<string, string | number> = { name: monthLabel(e.month) }
      data.evaluationTypes.forEach((t) => {
        const v = e.grades[t.id]
        if (v != null) row[t.name] = v
      })
      return row
    })
  }, [data])

  // Tanlangan oy yo'q yoki ro'yxatda bo'lmasa — eng oxirgi oyni standart tanlaymiz.
  useEffect(() => {
    if (evalMonths.length === 0) return
    setEvalMonth((prev) => (evalMonths.includes(prev) ? prev : evalMonths[evalMonths.length - 1]))
  }, [evalMonths])

  // Turlar bo'yicha UMUMIY o'rtacha — har bir baholash turi uchun barcha fan va oylar bo'yicha o'rtacha (radar uchun).
  const evalTypeAvg = useMemo(() => {
    if (!data) return []
    return data.evaluationTypes.map((t) => {
      const vals: number[] = []
      data.evaluationsBySubject.forEach((s) =>
        s.evaluations.forEach((e) => {
          const v = e.grades[t.id]
          if (v != null) vals.push(v)
        }),
      )
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
      return { type: t.name, avg }
    })
  }, [data])

  const marksChart = useMemo(
    () =>
      data?.marksTrend.map((m) => ({
        name: monthLabel(m.month),
        'Uy vazifa ✓': m.homeworkDone,
        'Uy vazifa ✗': m.homeworkMissed,
        'Xulq ✓': m.behaviorGood,
        'Xulq ✗': m.behaviorBad,
      })) ?? [],
    [data],
  )

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (notFound || !data)
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="py-16 text-center text-slate-400">O'quvchi topilmadi</Card>
      </div>
    )

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Profil sarlavhasi */}
      <Card className="flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-2xl font-semibold text-brand-600">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt={data.fullName} className="h-full w-full object-cover" />
          ) : (
            initials(data.fullName)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-slate-800">{data.fullName}</h1>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-slate-400" /> {data.className || '—'}
            </span>
            {data.homeroomTeacher && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" /> {data.homeroomTeacher}
              </span>
            )}
            {data.parentFullName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" /> Ota-ona: {data.parentFullName}
              </span>
            )}
            {data.parentPhone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-slate-400" /> {data.parentPhone}
              </span>
            )}
          </div>
        </div>
        <div
          className={cn(
            'rounded-xl px-4 py-2 text-right',
            data.balance < 0 ? 'bg-red-50' : 'bg-emerald-50',
          )}
        >
          <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
            <Wallet className="h-3.5 w-3.5" /> Balans
          </p>
          <p className={cn('font-mono text-lg font-semibold', data.balance < 0 ? 'text-red-600' : 'text-emerald-700')}>
            {formatMoney(data.balance)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          <History className="h-4 w-4" /> To'lov tarixi
        </button>
      </Card>

      {/* Shaxsiy ma'lumotlar */}
      <Section title="Shaxsiy ma'lumotlar" icon={User}>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow icon={User} label="Jinsi" value={genderLabels[data.gender as 'male' | 'female'] ?? data.gender} />
          <InfoRow icon={Cake} label="Tug'ilgan kun" value={data.birthDate ? formatDate(data.birthDate) : '—'} />
          <InfoRow icon={CalendarPlus} label="Qabul sanasi" value={data.enrollmentDate ? formatDate(data.enrollmentDate) : '—'} />
          <InfoRow icon={MapPin} label="Manzil" value={data.address || '—'} />
          <InfoRow icon={GraduationCap} label="Guruh rahbari" value={data.homeroomTeacher || '—'} />
          <InfoRow icon={User} label="Ota-ona" value={data.parentFullName || '—'} />
          <InfoRow icon={Phone} label="Ota-ona telefoni" value={data.parentPhone || '—'} />
          <InfoRow
            icon={Percent}
            label="Chegirma"
            value={
              data.discountPct > 0 || data.discountAmount > 0
                ? [
                    data.discountPct > 0 ? `${data.discountPct}%` : null,
                    data.discountAmount > 0 ? formatMoney(data.discountAmount) : null,
                  ]
                    .filter(Boolean)
                    .join(' + ') + (data.discountNote ? ` — ${data.discountNote}` : '')
                : 'Yo\'q'
            }
          />
        </div>
        {(data.photoUrl || data.parentPassportUrl) && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
            {data.photoUrl && (
              <a href={data.photoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                <IdCard className="h-4 w-4" /> O'quvchi hujjati / surati
              </a>
            )}
            {data.parentPassportUrl && (
              <a href={data.parentPassportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                <IdCard className="h-4 w-4" /> Ota-ona passporti
              </a>
            )}
          </div>
        )}
      </Section>

      {/* Guruhlar — o'quvchi bir nechta guruhda bo'lishi mumkin (har biri karta) */}
      {groups.length > 0 && (
        <Section title="Guruhlar" icon={School}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((gr) => {
              const sb = groupStatusBadge(
                gr.status === 'completed' ? 'completed' : gr.isActive ? gr.status : 'left',
              )
              return (
                <Link
                  key={gr.id}
                  to={`/admin/classes/${gr.groupId}`}
                  className="group flex flex-col gap-2 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">{gr.groupName}</span>
                    <Badge tone={sb.tone}>{sb.label}</Badge>
                  </div>
                  {gr.courseName && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" /> {gr.courseName}
                    </p>
                  )}
                  {gr.teacherName && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <User className="h-3.5 w-3.5 text-slate-400" /> {gr.teacherName}
                    </p>
                  )}
                  {(gr.days.length > 0 || gr.startTime) && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {gr.days.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {gr.days.map((d) => weekdayShort[d] ?? d).join(', ')}
                        </span>
                      )}
                      {gr.startTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {gr.startTime}{gr.endTime ? `–${gr.endTime}` : ''}
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1 font-mono text-sm font-medium text-slate-600">
                      <Wallet className="h-3.5 w-3.5 text-slate-400" /> {formatMoney(gr.monthlyFee)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                </Link>
              )
            })}
          </div>
        </Section>
      )}

      {/* Tugatgan kurslar va sertifikatlar */}
      <Section
        title="Tugatgan kurslar va sertifikatlar"
        icon={Award}
      >
        {certificates.length === 0 && studentCourses.length === 0 ? (
          <p className="text-sm text-slate-400">Sertifikat yo'q va faol kurs topilmadi.</p>
        ) : (
          <>
            {/* Mavjud sertifikatlar */}
            {certificates.length > 0 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {certificates.map((c) => {
                  const revoked = c.status === 'revoked'
                  return (
                    <div
                      key={c.certificateId}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50/60 to-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <Award className="h-4 w-4 shrink-0 text-amber-500" />
                          {c.courseName || 'Kurs'}
                        </span>
                        <Badge tone={revoked ? 'red' : 'green'}>
                          {revoked ? 'Bekor qilingan' : 'Faol'}
                        </Badge>
                      </div>
                      {c.groupName && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <School className="h-3.5 w-3.5 text-slate-400" /> {c.groupName}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarPlus className="h-3.5 w-3.5 text-slate-400" /> Berilgan: {formatDate(c.issuedAt)}
                      </p>
                      {c.expiresAt && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <CalendarClock className="h-3.5 w-3.5" /> Muddati: {formatDate(c.expiresAt)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          downloadStudentCertificate(data.id, c.certificateId, c.fileName).catch(() =>
                            alert('Sertifikatni yuklab bo\'lmadi'),
                          )
                        }
                        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                      >
                        <Download className="h-4 w-4" /> Yuklab olish
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Qo'lda sertifikat yaratish (faol kurslar bo'yicha) */}
            {studentCourses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Qo'lda sertifikat yaratish
                </p>
                <div className="flex flex-wrap gap-2">
                  {studentCourses.map((sc) => (
                    <button
                      key={sc.courseId}
                      type="button"
                      disabled={certGenerating === sc.courseId}
                      onClick={async () => {
                        setCertGenerating(sc.courseId)
                        try {
                          const cert = await generateStudentCertificate(data.id, sc.courseId)
                          setCertificates((prev) => {
                            const exists = prev.find((c) => c.certificateId === cert.certificateId)
                            return exists ? prev : [cert, ...prev]
                          })
                        } catch (e: unknown) {
                          alert('Sertifikat yaratishda xato: ' + (e instanceof Error ? e.message : String(e)))
                        } finally {
                          setCertGenerating(null)
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Award className="h-4 w-4" />
                      {certGenerating === sc.courseId ? 'Yaratilmoqda...' : sc.courseName + ' sertifikat'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* O'quv dasturi (checklist) — har kurs uchun daraja → mavzu → band, bajarilganini belgilash */}
      <Section title="O'quv dasturi (checklist)" icon={ListChecks}>
        {studentCourses.length === 0 ? (
          <Empty>O'quvchi hech qaysi kursga biriktirilmagan</Empty>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {studentCourses.map((c) => (
              <CourseCurriculum
                key={c.courseId}
                courseId={c.courseId}
                fallbackName={c.courseName}
                studentId={data.id}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Darslar tarixi — guruh jurnalida belgilangan o'tilgan mavzular, eng yangisi birinchi */}
      <Section title="Darslar tarixi (o'tilgan mavzular)" icon={CalendarClock}>
        {coverageLog.length === 0 ? (
          <Empty>Hali dars o'tilmagan</Empty>
        ) : (
          <ul className="space-y-2">
            {coverageLog.map((e, i) => (
              <li
                key={`${e.date}-${i}`}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand-700">
                  {formatDate(e.date)}
                </span>
                <div className="min-w-0 flex-1">
                  {e.isRevision ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber">Takrorlash</Badge>
                      <span className="text-sm text-slate-600">
                        {e.courseName}
                        {e.groupName ? ` · ${e.groupName}` : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className="break-words text-sm font-semibold text-slate-800">{e.topicTitle}</p>
                      {e.itemText && (
                        <p className="mt-0.5 break-words text-sm text-slate-500">{e.itemText}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {e.courseName}
                        {e.groupName ? ` · ${e.groupName}` : ''}
                        {e.levelName ? ` · ${e.levelName}` : ''}
                      </p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Stat kartalar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="O'rtacha baho"
          value={data.avgGrade || '—'}
          icon={GraduationCap}
          iconBg="bg-brand-50"
          iconColor="text-brand-600"
        />
        <StatCard
          label="Davomat"
          value={data.conducted > 0 ? `${data.attendancePct}%` : '—'}
          hint={data.conducted > 0 ? `${data.attended} / ${data.conducted} dars` : undefined}
          icon={CalendarCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Intizomiy ball"
          value={data.disciplineScore}
          hint={`+${data.disciplinePlus} / −${data.disciplineMinus}`}
          icon={ShieldAlert}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Topshiriqlar"
          value={`${data.assignments.gradedCount}/${data.assignments.count}`}
          hint={data.assignments.totalMax > 0 ? `${data.assignments.totalScore}/${data.assignments.totalMax} ball` : undefined}
          icon={ClipboardCheck}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
      </div>

      {/* Diagrammalar */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Davomat (oy bo'yicha)" icon={CalendarCheck}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={attendanceChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Qoldirgan" fill="#dc2626" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Kech keldi" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {marksChart.length > 0 && (
          <Section title="Uy vazifa va xulq (oylik)" icon={BookOpen}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={marksChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Uy vazifa ✓" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Uy vazifa ✗" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Xulq ✓" fill="#1f47f5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Xulq ✗" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>

      {/* Fan baholari dinamikasi — chorak tanlanadi, har fan o'rtacha bahosi bar chartda */}
      {data.subjects.length > 0 && (
        <Section title="Fan baholari dinamikasi (oy bo'yicha)" icon={GraduationCap}>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {allMonths.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGradeMonth(m)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  gradeMonth === m
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>

          {monthBars.length === 0 ? (
            <Empty>Bu oyda baho yo'q</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={monthBars} margin={{ top: 16, right: 20, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={28} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="baho" name="O'rtacha baho" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {monthBars.map((b) => (
                    <Cell key={b.name} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      )}

      {/* Baholar matritsasi (fan × oy) */}
      <Section title="Baholar (fan × oy)" icon={GraduationCap}>
        {data.subjects.length === 0 ? (
          <Empty>Fan yo'q</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Fan</th>
                  {allMonths.map((m) => (
                    <th key={m} className="whitespace-nowrap px-3 py-2 text-center">{monthLabel(m)}</th>
                  ))}
                  <th className="px-3 py-2 text-center">O'rtacha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.subjects.map((s) => {
                  const byM = data.grades[s.id] ?? {}
                  const vals = Object.values(byM)
                  const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-700">{s.name}</td>
                      {allMonths.map((m) => (
                        <td key={m} className="px-3 py-2 text-center">
                          {byM[m] != null ? <span className={gradeCls(byM[m])}>{byM[m]}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">{avg ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Davomat sabablari */}
      <Section title="Davomat sabablari" icon={CalendarCheck}>
        {data.reasons.length === 0 ? (
          <Empty>Davomat belgilari yo'q</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.reasons.map((r) => (
              <span
                key={r.reasonId}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium',
                  r.isLate ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600',
                )}
              >
                {r.name} <span className="font-semibold">×{r.count}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Oylik baholash */}
      {data.evaluationTypes.length > 0 && (
        <Section title="Oylik feedback" icon={ClipboardCheck}>
          {data.evaluationsBySubject.length === 0 ? (
            <Empty>Hali baholanmagan</Empty>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-5">
                {/* Feedback dinamikasi — turlar bo'yicha (yozma, og'zaki/suhbat...), oylar bo'yicha */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 lg:col-span-3">
                  <p className="mb-3 text-sm font-medium text-slate-600">
                    Feedback dinamikasi (turlar bo'yicha)
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={typeDynamics} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        {evalTypeNames.map((name, i) => {
                          const c = evalColors[i % evalColors.length]
                          return (
                            <linearGradient key={name} id={`evalArea${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={c} stopOpacity={0.03} />
                            </linearGradient>
                          )
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} tick={axisTick} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      {evalTypeNames.map((name, i) => (
                        <Area
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={evalColors[i % evalColors.length]}
                          strokeWidth={2.5}
                          fill={`url(#evalArea${i})`}
                          fillOpacity={1}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Turlar bo'yicha UMUMIY o'rtacha — radar (≥3 tur), aks holda gorizontal bar */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 lg:col-span-2">
                  <p className="mb-3 text-sm font-medium text-slate-600">Turlar bo'yicha umumiy o'rtacha</p>
                  <ResponsiveContainer width="100%" height={300}>
                    {evalTypeAvg.length >= 3 ? (
                      <RadarChart data={evalTypeAvg} outerRadius="72%">
                        <defs>
                          <radialGradient id="evalRadarFill">
                            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.12} />
                          </radialGradient>
                        </defs>
                        <PolarGrid stroke={gridStroke} />
                        <PolarAngleAxis dataKey="type" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                        <Radar dataKey="avg" name="O'rtacha" stroke="#7c3aed" strokeWidth={2} fill="url(#evalRadarFill)" />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadarChart>
                    ) : (
                      <BarChart layout="vertical" data={evalTypeAvg} margin={{ top: 6, right: 18, left: 6, bottom: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                        <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis type="category" dataKey="type" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="avg" name="O'rtacha" radius={[0, 6, 6, 0]} barSize={22}>
                          {evalTypeAvg.map((_, i) => (
                            <Cell key={i} fill={evalColors[i % evalColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Oy tanlovi — faqat oy o'zgaradi; pastda shu oydagi BARCHA fanlar natijasi */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Oy:</span>
                <select
                  value={evalMonth}
                  onChange={(e) => setEvalMonth(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
                >
                  {evalMonths.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">Tanlangan oydagi barcha fanlar</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Fan</th>
                      {data.evaluationTypes.map((t) => (
                        <th key={t.id} className="px-3 py-2 text-center">{t.name}</th>
                      ))}
                      <th className="px-3 py-2 text-center">O'rtacha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.evaluationsBySubject.map((s) => {
                      const e = s.evaluations.find((x) => x.month === evalMonth)
                      return (
                        <tr key={s.subjectId || 'umumiy'} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{s.subjectName}</td>
                          {data.evaluationTypes.map((t) => (
                            <td key={t.id} className="px-3 py-2 text-center">
                              {e && e.grades[t.id] != null ? (
                                <span className={gradeCls(e.grades[t.id])}>{e.grades[t.id]}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">{e?.avg || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>
      )}

      {/* Topshiriqlar */}
      <Section title="Topshiriqlar ballari" icon={ClipboardCheck}>
        {data.assignments.items.length === 0 ? (
          <Empty>Topshiriq yo'q</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Topshiriq</th>
                  <th className="px-3 py-2">Fan</th>
                  <th className="px-3 py-2 text-center">Holat</th>
                  <th className="px-3 py-2 text-center">Ball</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.assignments.items.map((a) => (
                  <tr key={a.assignmentId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-700">{a.title}</td>
                    <td className="px-3 py-2 text-slate-500">{a.subjectName}</td>
                    <td className="px-3 py-2 text-center">
                      {a.completed ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Bajardi</span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                      {a.score != null ? `${a.score}/${a.maxScore}` : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Baholash xulosa (oylik o'rtacha + jami) */}
      {gradingSummary.length > 0 && (
        <Section title="Baholash xulosa" icon={ClipboardCheck}>
          <div className="flex flex-wrap gap-2">
            {gradingSummary.map((month) => (
              <div
                key={month.month}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-brand-50 to-slate-50 px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {monthLabel(month.month)}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold text-slate-800">
                    {month.averageScore.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">o'rtacha</span>
                </div>
                <p className="text-xs text-slate-600">
                  Jami: <span className="font-mono font-semibold">{month.totalScore}/{month.criteriaCount}</span>
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Intizomiy ball tarixi */}
      <Section title="Intizomiy ball tarixi" icon={ShieldAlert}>
        {data.disciplinePoints.length === 0 ? (
          <Empty>Yozuv yo'q</Empty>
        ) : (
          <div className="space-y-2">
            {data.disciplinePoints.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 font-mono text-sm font-semibold',
                    p.points < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
                  )}
                >
                  {p.points > 0 ? `+${p.points}` : p.points}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{p.reasonName}</p>
                  {p.note && <p className="truncate text-xs text-slate-400">{p.note}</p>}
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-400">{formatDate(p.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PaymentHistoryModal
        studentId={showHistory ? (data?.id ?? null) : null}
        onClose={() => setShowHistory(false)}
      />
    </div>
  )
}

/** Bitta kurs o'quv dasturi: o'z progress bari + yopilgan darajalar (har biri x/y), band checklisti. */
function CourseCurriculum({
  courseId,
  fallbackName,
  studentId,
}: {
  courseId: string
  fallbackName: string
  studentId: string
}) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  /** Bajarilgan band id'lari (optimistik). */
  const [done, setDone] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    Promise.all([getCurriculum(courseId), getProgress(courseId, studentId)])
      .then(([c, ids]) => {
        if (!alive) return
        setCurriculum(c)
        setDone(new Set(ids))
      })
      .catch(() => {
        if (alive) setError(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [courseId, studentId])

  // Optimistik toggle — xatoda asl holatga qaytaramiz.
  const toggle = (itemId: string, next: boolean) => {
    setDone((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(itemId)
      else copy.delete(itemId)
      return copy
    })
    setProgress(studentId, itemId, next).catch(() => {
      setDone((prev) => {
        const copy = new Set(prev)
        if (next) copy.delete(itemId)
        else copy.add(itemId)
        return copy
      })
    })
  }

  const name = curriculum?.courseName || fallbackName

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
        <p className="text-sm font-semibold text-slate-700">{name}</p>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200/70" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
        <p className="text-sm font-semibold text-slate-700">{name}</p>
        <p className="mt-2 text-sm text-slate-400">O'quv dasturini yuklab bo'lmadi</p>
      </div>
    )
  }

  const allItems = (curriculum?.levels ?? []).flatMap((lv) => lv.topics.flatMap((t) => t.items))
  if (allItems.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
        <p className="text-sm font-semibold text-slate-700">{name}</p>
        <p className="mt-2 text-sm text-slate-400">O'quv dasturi kiritilmagan</p>
      </div>
    )
  }

  const totalDone = allItems.filter((it) => done.has(it.id)).length
  const total = allItems.length
  const pct = total ? Math.round((totalDone / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <BookOpen className="h-4 w-4 text-brand-600" /> {name}
        </p>
        <span className="font-mono text-xs font-medium text-slate-500">
          {totalDone}/{total} · {pct}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 space-y-2">
        {curriculum!.levels.map((lv) => (
          <LevelBlock key={lv.id} level={lv} done={done} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}

/** Yopiladigan daraja: o'z x/y hisobi bilan; ochilganda mavzular va band checklisti. */
function LevelBlock({
  level,
  done,
  onToggle,
}: {
  level: Curriculum['levels'][number]
  done: Set<string>
  onToggle: (itemId: string, next: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const items = level.topics.flatMap((t) => t.items)
  const lvDone = items.filter((it) => done.has(it.id)).length
  const lvTotal = items.length
  const complete = lvTotal > 0 && lvDone === lvTotal

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{level.name}</span>
        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold',
            complete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {lvDone}/{lvTotal}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-3">
          {level.topics.length === 0 ? (
            <p className="text-xs text-slate-400">Mavzu yo'q</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {level.topics.map((topic) => {
                const tDone = topic.items.filter((it) => done.has(it.id)).length
                return (
                  <div
                    key={topic.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {topic.title}
                    </p>
                    {topic.items.length > 0 && (
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        {tDone}/{topic.items.length}
                      </span>
                    )}
                  </div>
                  {topic.items.length === 0 ? (
                    <p className="text-xs text-slate-300">Band yo'q</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {topic.items.map((item) => {
                        const checked = done.has(item.id)
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onToggle(item.id, !checked)}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                checked
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-slate-300 bg-white text-transparent',
                              )}
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <span
                              className={cn(
                                'min-w-0 flex-1 text-sm',
                                checked ? 'text-slate-400 line-through' : 'text-slate-700',
                              )}
                            >
                              {item.text}
                              {item.note && (
                                <span className="ml-1 text-xs text-slate-400">— {item.note}</span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/admin/students"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
    >
      <ArrowLeft className="h-4 w-4" /> O'quvchilar ro'yxati
    </Link>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof GraduationCap
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-8 text-center text-sm text-slate-400">{children}</p>
)

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="break-words text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  )
}

/** "yyyy-MM" dan "yyyy-MM" gacha (inklyuziv) uzluksiz oylar ro'yxati. */
function monthRangeList(from: string, to: string): string[] {
  if (!from || !to || from > to) return from ? [from] : []
  const out: string[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const ty = Number(to.slice(0, 4))
  const tm = Number(to.slice(5, 7))
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function gradeCls(g: number): string {
  return cn(
    'inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-sm font-semibold',
    g >= 5 ? 'bg-emerald-50 text-emerald-700' : g >= 4 ? 'bg-brand-50 text-brand-700' : g >= 3 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600',
  )
}

