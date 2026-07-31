import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import type { GroupTest, OnlineTest, TestResultDetail } from '@/types'
import {
  getTeacherGroupTests,
  getTeacherTestDetail,
  createTeacherTest,
  updateTeacherTest,
  deleteTeacherTest,
  setTeacherTestScore,
  uploadTeacherTestFile,
} from '@/api/services/teacher'
import { cn, formatDate, apiErrorMessage } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'

/**
 * Bitta guruh testlari — o'qituvchi ilovasidagi YAGONA komponent. Ikki joyda AYNAN bir xil ishlaydi:
 *  • pastki navigatsiyadagi "Test" bo'limi (`TeacherTestsPage` — guruh tanlangandan keyin);
 *  • guruh (jurnal) sahifasidagi "Imtihonlar" tabi (`TeacherGroupDetailPage`).
 * Shu sabab onlayn (bot) test YARATISH jurnal ichida ham bor — avval u yerdagi forma
 * qisqartirilgan (faqat oflayn) edi. Admin tarafdagi ekvivalenti — `admin/tests/GroupTestsPanel`;
 * ikkalasi ham serverda BIR XIL `TestResultService`ga boradi.
 */

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Javob varianti harflari (A, B, C, ...). */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** "2026-07-22T09:30" → "09:30" (bo'sh/noto'g'ri bo'lsa — zaxira qiymat). */
const timeOf = (iso: string, fallback: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : fallback)

const field =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:border-teal-500 focus:outline-none'
const label = 'mb-1 block text-[12px] font-semibold text-mute'


/**
 * O'qituvchi — test yaratish/tahrirlash. Admin ("O'quv bo'limi → Testlar natijalari") bilan BIR XIL
 * ikki rejim:
 *  • Oflayn — nom, sana, maksimal ball (ballni o'qituvchi qo'lda kiritadi).
 *  • Onlayn (bot) — savollar PDF'i, savollar soni, variantlar, javoblar kaliti va vaqt oynasi;
 *    o'quvchi Telegram botdan ishlaydi, ball avtomatik yoziladi (har savol — 1 ball).
 */
function TeacherTestFormModal({
  groupId,
  editing,
  onClose,
  onSaved,
}: {
  groupId: string
  editing: GroupTest | null
  onClose: () => void
  onSaved: () => void
}) {
  const initialOnline = editing?.online
  const [mode, setMode] = useState<'offline' | 'online'>(
    initialOnline?.mode === 'online' ? 'online' : 'offline',
  )
  const [name, setName] = useState(editing?.name ?? '')
  const [date, setDate] = useState(editing ? editing.date.slice(0, 10) : todayIso())
  const [maxScore, setMaxScore] = useState<string>(editing ? String(editing.maxScore) : '100')

  // --- onlayn maydonlari ---
  const [pdfUrl, setPdfUrl] = useState(initialOnline?.pdfUrl ?? '')
  const [pdfName, setPdfName] = useState(initialOnline?.pdfName ?? '')
  const [uploading, setUploading] = useState(false)
  const [count, setCount] = useState<string>(
    initialOnline?.questionCount ? String(initialOnline.questionCount) : '20',
  )
  const [options, setOptions] = useState<number>(initialOnline?.optionCount || 4)
  const [key, setKey] = useState<string[]>(
    (initialOnline?.answerKey ?? '').split('').map((c) => (c === '-' ? '' : c)),
  )
  const [bulkKey, setBulkKey] = useState('')
  const [startTime, setStartTime] = useState(timeOf(initialOnline?.startAt ?? '', '09:00'))
  const [endTime, setEndTime] = useState(timeOf(initialOnline?.endAt ?? '', '11:00'))

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const qCount = useMemo(() => {
    const n = Number(count)
    return Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : 0
  }, [count])

  // Savollar soni o'zgarsa kalit massivi moslanadi (kiritilganlar saqlanadi).
  const keys = useMemo(() => {
    const arr = key.slice(0, qCount)
    while (arr.length < qCount) arr.push('')
    return arr
  }, [key, qCount])
  const filled = keys.filter(Boolean).length

  const setAnswer = (i: number, letter: string) =>
    setKey(() => {
      const next = keys.slice()
      next[i] = next[i] === letter ? '' : letter
      return next
    })

  /** Kalitni matndan to'ldirish: "abcdab..." yoki "1a 2b 3c" — harflar tartib bilan olinadi. */
  const applyBulk = () => {
    const allowed = LETTERS.slice(0, options)
    const letters = bulkKey
      .toUpperCase()
      .split('')
      .filter((c) => allowed.includes(c))
    if (letters.length === 0) {
      setErr('Kalit topilmadi — masalan: abcdabcd...')
      return
    }
    const next = letters.slice(0, qCount)
    while (next.length < qCount) next.push('')
    setKey(next)
    setBulkKey('')
    setErr('')
  }

  const handlePdf = async (file: File) => {
    setUploading(true)
    setErr('')
    try {
      const up = await uploadTeacherTestFile(file)
      setPdfUrl(up.url)
      setPdfName(up.name)
    } catch (e) {
      setErr(apiErrorMessage(e, "Faylni yuklab bo'lmadi"))
    } finally {
      setUploading(false)
    }
  }

  const max = useMemo(() => Number(maxScore), [maxScore])
  const validOffline = name.trim().length > 0 && !!date && Number.isFinite(max) && max > 0
  const validOnline =
    name.trim().length > 0 &&
    !!date &&
    qCount > 0 &&
    !!pdfUrl &&
    filled === qCount &&
    startTime < endTime
  const valid = mode === 'online' ? validOnline : validOffline

  const submit = async () => {
    if (!valid) {
      setErr(
        mode === 'online'
          ? "Nom, sana, PDF, savollar soni, to'liq javob kaliti va to'g'ri vaqt oralig'i kerak"
          : 'Nom, sana va 0 dan katta maksimal ball kiriting',
      )
      return
    }
    setBusy(true)
    setErr('')
    const online: OnlineTest =
      mode === 'online'
        ? {
            mode: 'online',
            pdfUrl,
            pdfName,
            questionCount: qCount,
            optionCount: options,
            answerKey: keys.join(''),
            startAt: `${date}T${startTime}`,
            endAt: `${date}T${endTime}`,
          }
        : {
            mode: 'offline',
            pdfUrl: '',
            pdfName: '',
            questionCount: 0,
            optionCount: 4,
            answerKey: '',
            startAt: '',
            endAt: '',
          }
    const finalMax = mode === 'online' ? qCount : max
    try {
      if (editing) {
        await updateTeacherTest(editing.id, { name: name.trim(), date, maxScore: finalMax, online })
      } else {
        await createTeacherTest({ groupId, name: name.trim(), date, maxScore: finalMax, online })
      }
      onSaved()
    } catch (e) {
      setErr(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      size="lg"
      title={editing ? 'Testni tahrirlash' : 'Yangi test'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-mute disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !valid}
            className="rounded-lg bg-teal-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Rejim tanlash */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-panel2 p-1">
          {(
            [
              { v: 'offline', icon: ClipboardList, t: 'Oflayn', s: "Ballni qo'lda kiritasiz" },
              { v: 'online', icon: Bot, t: 'Onlayn (bot)', s: "O'quvchi botdan ishlaydi" },
            ] as const
          ).map((m) => {
            const Icon = m.icon
            const active = mode === m.v
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => setMode(m.v)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-white shadow-[var(--shadow-card)]' : 'hover:bg-white/60',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-teal-600' : 'text-faint')} />
                <span className="min-w-0">
                  <span
                    className={cn('block text-[13px] font-bold', active ? 'text-ink' : 'text-mute')}
                  >
                    {m.t}
                  </span>
                  <span className="block truncate text-[10px] text-faint">{m.s}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div>
          <span className={label}>Test nomi</span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: 1-chorak test"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Sana</span>
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {mode === 'offline' ? (
            <div>
              <span className={label}>Maksimal ball</span>
              <input
                type="number"
                min={1}
                className={field}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="100"
              />
            </div>
          ) : (
            <div>
              <span className={label}>Maksimal ball (avtomatik)</span>
              <div className="flex h-10 items-center rounded-lg border border-dashed border-line bg-panel2 px-3 text-[13px] text-mute">
                {qCount || '—'} ball · har savol 1 ball
              </div>
            </div>
          )}
        </div>

        {mode === 'online' && (
          <>
            {/* PDF */}
            <div>
              <span className={label}>Test savollari (PDF)</span>
              {pdfUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-red-500" />
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-[13px] font-semibold text-teal-600"
                  >
                    {pdfName || 'test.pdf'}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfUrl('')
                      setPdfName('')
                    }}
                    className="shrink-0 rounded-md p-1 text-faint hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line px-3 py-4 text-[13px] font-semibold text-mute transition-colors hover:border-teal-300 hover:text-teal-600',
                    uploading && 'pointer-events-none opacity-60',
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? 'Yuklanmoqda...' : 'PDF faylni tanlang (20 MB gacha)'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handlePdf(f)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
              <p className="mt-1 text-[11px] text-faint">
                Shu fayl o'quvchiga Telegram botda yuboriladi.
              </p>
            </div>

            {/* Savollar soni / variantlar / vaqt */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Savollar soni</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className={field}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div>
                <span className={label}>Variantlar</span>
                <select
                  className={field}
                  value={options}
                  onChange={(e) => setOptions(Number(e.target.value))}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      A–{LETTERS[n - 1]} ({n} ta)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Boshlanishi</span>
                <input
                  type="time"
                  className={field}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <span className={label}>Tugashi</span>
                <input
                  type="time"
                  className={field}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-faint">
              O'quvchi javoblarni faqat shu vaqt oralig'ida yubora oladi ({date} kuni).
            </p>

            {/* Javoblar kaliti */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-mute">To'g'ri javoblar kaliti</span>
                <span
                  className={cn(
                    'text-[12px] font-semibold',
                    filled === qCount && qCount > 0 ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {filled}/{qCount} to'ldirildi
                </span>
              </div>
              <div className="mb-2 flex gap-2">
                <input
                  className={field}
                  value={bulkKey}
                  onChange={(e) => setBulkKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyBulk()
                    }
                  }}
                  placeholder="Tez to'ldirish: abcdabcd..."
                />
                <button
                  type="button"
                  onClick={applyBulk}
                  disabled={!bulkKey.trim()}
                  className="shrink-0 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-mute disabled:opacity-50"
                >
                  To'ldirish
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-line bg-panel2 p-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {keys.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5"
                    >
                      <span className="w-7 shrink-0 text-right text-[11px] font-bold text-faint">
                        {i + 1}.
                      </span>
                      <div className="flex flex-1 gap-1">
                        {LETTERS.slice(0, options).map((L) => (
                          <button
                            key={L}
                            type="button"
                            onClick={() => setAnswer(i, L)}
                            className={cn(
                              'h-7 flex-1 rounded-md text-[12px] font-bold transition-colors',
                              v === L ? 'bg-teal-600 text-white' : 'bg-panel3 text-mute',
                            )}
                          >
                            {L}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {err && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-600">{err}</p>
        )}
      </div>
    </Modal>
  )
}
/**
 * Guruh testlari paneli — ro'yxat, test tafsiloti (ball qo'yish) va yaratish/tahrirlash/o'chirish.
 * Tashqi padding'ni CHAQIRUVCHI beradi (sahifada `px-4 pt-3 pb-6`, jurnal tabida — hech narsa).
 */
export function TeacherGroupTestsPanel({
  groupId,
  title,
  subtitle,
  onBack,
}: {
  groupId: string
  /** Ro'yxat rejimidagi sarlavha — guruh nomi yoki "Imtihonlar (testlar)". */
  title: string
  /** Sarlavha ostidagi kichik matn. */
  subtitle?: string
  /** Berilsa — ro'yxat rejimida chapda "orqaga" tugmasi ko'rinadi (guruhlar ro'yxatiga). */
  onBack?: () => void
}) {
  const [tests, setTests] = useState<GroupTest[]>([])
  const [testsLoading, setTestsLoading] = useState(true)
  const [testsError, setTestsError] = useState<string | null>(null)

  const [detail, setDetail] = useState<TestResultDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  // Onlayn test: javob kaliti yopiq turadi (tasodifan ko'rinib qolmasin)
  const [showKey, setShowKey] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTest, setEditingTest] = useState<GroupTest | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<GroupTest | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({})

  const loadTests = useCallback(() => {
    setTestsLoading(true)
    setTestsError(null)
    getTeacherGroupTests(groupId)
      .then(setTests)
      .catch((err) => setTestsError(apiErrorMessage(err, "Testlarni yuklab bo'lmadi")))
      .finally(() => setTestsLoading(false))
  }, [groupId])

  useEffect(() => {
    loadTests()
  }, [loadTests])

  const openDetail = (t: GroupTest) => {
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    setShowKey(false)
    getTeacherTestDetail(t.id)
      .then((d) => {
        setDetail(d)
        setScoreDrafts(
          Object.fromEntries(d.rows.map((r) => [r.studentId, r.score == null ? '' : String(r.score)])),
        )
      })
      .catch((err) => setDetailError(apiErrorMessage(err, "Test tafsilotini yuklab bo'lmadi")))
      .finally(() => setDetailLoading(false))
  }

  const backToTests = () => {
    setDetail(null)
    setDetailError(null)
    loadTests()
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingTest(null)
  }

  const onFormSaved = () => {
    setFormOpen(false)
    setEditingTest(null)
    loadTests()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTeacherTest(deleteTarget.id)
      setDeleteTarget(null)
      loadTests()
    } catch (err) {
      alert(apiErrorMessage(err, "O'chirib bo'lmadi"))
    } finally {
      setDeleting(false)
    }
  }

  const saveScore = async (studentId: string) => {
    if (!detail) return
    const raw = scoreDrafts[studentId] ?? ''
    const score = raw.trim() === '' ? null : Number(raw)
    if (score != null && (!Number.isFinite(score) || score < 0 || score > detail.maxScore)) {
      alert(`Ball 0 dan ${detail.maxScore} gacha bo'lishi kerak`)
      return
    }
    setSavingRow(studentId)
    try {
      const updated = await setTeacherTestScore(detail.id, studentId, score)
      setDetail(updated)
      setScoreDrafts(
        Object.fromEntries(updated.rows.map((r) => [r.studentId, r.score == null ? '' : String(r.score)])),
      )
    } catch (err) {
      alert(apiErrorMessage(err, "Ballni saqlab bo'lmadi"))
    } finally {
      setSavingRow(null)
    }
  }

  // ---------------- Test tafsiloti (ball qo'yish + onlayn ma'lumot) ----------------
  if (detail || detailLoading || detailError) {
    const isOnline = detail?.online?.mode === 'online'
    const submitted = detail ? detail.rows.filter((r) => r.source === 'bot').length : 0
    return (
      <div>
        <div className="mb-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={backToTests}
            className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-ink">{detail?.name ?? 'Test'}</p>
            {detail && (
              <p className="text-[12px] text-mute">
                {formatDate(detail.date)} · Maks: <span className="font-mono">{detail.maxScore}</span> ball
              </p>
            )}
          </div>
        </div>

        {detail && isOnline && (
          <div className="mb-3 rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mute">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-600">
                <Bot className="h-3.5 w-3.5" /> ONLAYN TEST
              </span>
              <span>
                Savollar: <b className="text-ink">{detail.online.questionCount}</b> ta (A–
                {String.fromCharCode(64 + detail.online.optionCount)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-faint" />
                {timeOf(detail.online.startAt, '—')}–{timeOf(detail.online.endAt, '—')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Send className="h-4 w-4 text-faint" />
                Botdan yuborgan: <b className="text-ink">{submitted}</b>
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              {detail.online.pdfUrl && (
                <a
                  href={detail.online.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-600"
                >
                  <FileText className="h-4 w-4" /> Savollar (PDF)
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                Javob kaliti
              </button>
            </div>
            {showKey && (
              <pre className="mt-2.5 overflow-x-auto rounded-lg bg-panel2 p-3 text-[11px] leading-relaxed text-mute">
                {detail.online.answerKey
                  .split('')
                  .map((c, i) => `${i + 1}.${c}`)
                  .join('   ')}
              </pre>
            )}
          </div>
        )}

        {detailLoading ? (
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : detailError ? (
          <div className="rounded-[20px] border border-line bg-white p-6 text-center text-[13px] font-semibold text-rose-600 shadow-[var(--shadow-card)]">
            {detailError}
          </div>
        ) : detail && detail.rows.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center text-[13px] text-faint shadow-[var(--shadow-card)]">
            Bu guruhda faol o'quvchi yo'q.
          </div>
        ) : (
          detail && (
            <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
              {detail.rows.map((r, i) => {
                const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null
                return (
                  <div
                    key={r.studentId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      i < detail.rows.length - 1 && 'border-b border-line',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[14px] font-bold text-mute">
                      {r.rank === 0 ? '' : medal ?? r.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{r.fullName}</p>
                      {isOnline &&
                        (r.source === 'bot' ? (
                          <p className="truncate text-[11px] text-faint" title={r.answers}>
                            <span className="font-mono">{r.answers}</span> · {timeOf(r.submittedAt, '—')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-faint">— topshirmagan</p>
                        ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={detail.maxScore}
                        placeholder="—"
                        value={scoreDrafts[r.studentId] ?? ''}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({ ...prev, [r.studentId]: e.target.value }))
                        }
                        onBlur={() => saveScore(r.studentId)}
                        disabled={savingRow === r.studentId}
                        className="h-9 w-16 rounded-lg border border-line bg-panel2 text-center font-mono text-[14px] font-bold text-ink focus:border-teal-500 focus:outline-none disabled:opacity-50"
                      />
                      <span className="text-[12px] text-faint">/{detail.maxScore}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
        {savingRow && <p className="mt-2 text-center text-[12px] text-mute">Saqlanmoqda...</p>}
      </div>
    )
  }

  // ---------------- Guruh testlari ro'yxati ----------------
  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-extrabold text-ink">{title}</p>
          {subtitle && <p className="text-[12px] text-mute">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingTest(null)
            setFormOpen(true)
          }}
          className="tap-scale flex shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Yangi test
        </button>
      </div>

      {testsLoading ? (
        <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
          <Loader label="Yuklanmoqda..." />
        </div>
      ) : testsError ? (
        <div className="rounded-[20px] border border-line bg-white p-6 text-center text-[13px] font-semibold text-rose-600 shadow-[var(--shadow-card)]">
          {testsError}
        </div>
      ) : tests.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-600">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h4 className="text-[15px] font-bold text-ink">Hali test yo'q</h4>
          <p className="mt-1 text-[13px] text-mute">"Yangi test" tugmasi orqali yarating.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <div
              key={t.id}
              className="tap-scale rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <div
                    className={
                      t.online?.mode === 'online'
                        ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600'
                        : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tealsoft text-teal-600'
                    }
                  >
                    {t.online?.mode === 'online' ? <Bot className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink">
                      {t.name}
                      {t.online?.mode === 'online' && (
                        <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                          ONLAYN
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-mute">
                      {formatDate(t.date)}
                      {t.online?.mode === 'online' &&
                        ` · botdan yuborgan: ${t.submittedCount}/${t.studentCount}`}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTest(t)
                      setFormOpen(true)
                    }}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel3 hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(t)}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDetail(t)}
                className="mt-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-panel2 px-3 py-2 text-left text-[12px] text-mute"
              >
                <span>
                  <span className="font-mono font-bold text-ink">{t.scoredCount}</span>/
                  <span className="font-mono">{t.studentCount}</span> baholangan
                </span>
                {t.avgScore != null && (
                  <span>
                    O'rtacha: <span className="font-mono font-bold text-ink">{t.avgScore.toFixed(1)}</span>
                  </span>
                )}
                <span>
                  Maks: <span className="font-mono font-bold text-ink">{t.maxScore}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <TeacherTestFormModal
          key={editingTest?.id ?? 'new'}
          groupId={groupId}
          editing={editingTest}
          onClose={closeForm}
          onSaved={onFormSaved}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        size="sm"
        title="Testni o'chirish"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-mute disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "O'chirilmoqda..." : "O'chirish"}
            </button>
          </>
        }
      >
        <p className="text-[13px] text-mute">
          <span className="font-semibold text-ink">{deleteTarget?.name}</span> testini va uning barcha
          ballarini o'chirasizmi? Bu amalni qaytarib bo'lmaydi.
        </p>
      </Modal>
    </div>
  )
}
