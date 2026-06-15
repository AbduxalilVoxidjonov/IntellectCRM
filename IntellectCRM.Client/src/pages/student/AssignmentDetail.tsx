import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import {
  getStudentAssignment,
  submitStudentAssignment,
  uploadStudentFile,
  type StudentAssignmentDetail,
  type UploadedFile,
  type SubmitResult,
} from '@/api/services/studentPortal'
import { Icon, Ring, fmtDate, fmtTime, subjectColor, subjInitial } from '@/pages/student/lib'
import { formatMeta, dueLabel } from '@/pages/student/Assignments'
import { SpeakingRecorder } from '@/pages/student/SpeakingRecorder'

/* ============================================================
   O'quvchi portali — Topshiriq tafsiloti + topshirish (test/yozma/fayl/video).
   student.html: AssignmentDetail() + runTest().
   ============================================================ */

/** Nisbiy fayl URL'ni API origin bilan to'ldiradi. */
function absUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '').replace(/\/$/, '')
  return url.startsWith('/') ? base + url : base + '/' + url
}

export function StudentAssignmentDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [a, setA] = useState<StudentAssignmentDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [upPct, setUpPct] = useState<number | null>(null)
  const [showTest, setShowTest] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function reload() {
    return getStudentAssignment(id)
      .then((d) => setA(d))
      .catch((e) => setLoadErr(e?.message || String(e)))
  }

  useEffect(() => {
    let on = true
    getStudentAssignment(id)
      .then((d) => on && setA(d))
      .catch((e) => on && setLoadErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [id])

  const back = () => navigate(-1)

  const head = (title: string, right?: React.ReactNode) => (
    <div className="hd">
      <div className="row gap10" style={{ minHeight: 38 }}>
        <button className="iconbtn press" onClick={back}>
          <Icon name="chevL" size={22} />
        </button>
        <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {right}
      </div>
    </div>
  )

  if (loadErr)
    return (
      <div className="screen">
        {head('Topshiriq')}
        <div className="center">
          <Empty title="Yuklab bo'lmadi" sub={loadErr} ic="alert" />
        </div>
      </div>
    )
  if (!a)
    return (
      <div className="screen">
        {head('Topshiriq')}
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    )

  const fm = formatMeta(a.format)
  const col = subjectColor(a.subjectName)
  const due = dueLabel(a)
  const isVideo = a.format === 'video'

  async function pickFile() {
    const inp = fileRef.current
    if (!inp) return
    inp.value = ''
    inp.accept = isVideo ? 'video/*' : ''
    inp.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 20 * 1024 * 1024) {
      setErr(`Fayl hajmi 20 MB dan oshmasligi kerak (${(f.size / 1e6).toFixed(1)} MB).`)
      return
    }
    setErr(null)
    setUpPct(0)
    try {
      const up = await uploadStudentFile(f, (pct) => setUpPct(pct))
      setUploaded(up)
    } catch (ex: unknown) {
      setErr((ex as { message?: string })?.message || 'Yuklab bo\'lmadi')
    } finally {
      setUpPct(null)
    }
  }

  async function submit() {
    if (!a) return
    setBusy(true)
    setErr(null)
    try {
      if (a.format === 'written') await submitStudentAssignment(a.id, { answerText: answerText.trim() })
      else await submitStudentAssignment(a.id, { fileUrl: uploaded?.url })
      await reload()
    } catch (ex: unknown) {
      setErr((ex as { message?: string })?.message || 'Yuborilmadi')
    } finally {
      setBusy(false)
    }
  }

  const metaRow = (ic: string, label: string, value: string, color?: string) => (
    <div className="row gap10" style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <Icon name={ic} size={19} color="var(--faint)" />
      <span className="muted" style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text)' }}>{value}</span>
    </div>
  )

  return (
    <div className="screen">
      {head(
        a.subjectName,
        <span className="chip" style={{ color: fm.color, background: `color-mix(in srgb,${fm.color} 12%,transparent)`, fontSize: 12 }}>
          <Icon name={fm.icon} size={13} color={fm.color} />
          {fm.label}
        </span>,
      )}

      <div className="scroll pad" style={{ paddingBottom: 28 }}>
        <div className="row gap12" style={{ alignItems: 'flex-start' }}>
          <div
            className="subj"
            style={{ width: 50, height: 50, borderRadius: 15, flex: 'none', background: col + '22', color: col, fontSize: 21 }}
          >
            {subjInitial(a.subjectName)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.3px' }}>{a.title}</div>
            {a.description && (
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                {a.description}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />

        {a.completed && (
          <>
            <div
              className="card row gap12"
              style={{
                background: 'var(--greenSoft)',
                borderColor: 'color-mix(in srgb,var(--green) 25%,transparent)',
                boxShadow: 'none',
                borderRadius: 18,
              }}
            >
              <Ring value={a.score != null ? a.score : 100} max={a.maxScore || 100} size={56} stroke={6} color="var(--green)">
                <Icon name="check" size={24} color="var(--green)" />
              </Ring>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--green)' }}>Topshirildi</div>
                {a.submittedAt && (
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {fmtDate(a.submittedAt)}, {fmtTime(a.submittedAt)}
                  </div>
                )}
              </div>
              {a.score != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: 'var(--green)' }}>{a.score}</div>
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                    / {a.maxScore} ball
                  </div>
                </div>
              )}
            </div>
            <div style={{ height: 16 }} />
          </>
        )}

        <div className="card" style={{ borderRadius: 18 }}>
          {metaRow('clock', 'Muddat', `${fmtDate(a.dueDate)}, ${fmtTime(a.dueDate)}`, due.color)}
          {metaRow('award', 'Maksimal ball', a.maxScore + ' ball')}
          {a.format === 'test' && metaRow('list', 'Savollar soni', (a.questions?.length || 0) + ' ta')}
          <div className="row gap10" style={{ paddingTop: 11 }}>
            <Icon name={a.lateAccept ? 'info' : 'alert'} size={19} color={a.lateAccept ? 'var(--amber)' : 'var(--red)'} />
            <span className="muted" style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
              {a.lateAccept
                ? `Kechikib topshirish mumkin (−${a.latePenaltyPct}% jarima)`
                : 'Kechikib topshirish qabul qilinmaydi'}
            </span>
          </div>
        </div>

        {(a.materials || []).length > 0 && (
          <>
            <div style={{ height: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 800, padding: '0 2px 8px' }}>Materiallar</div>
            {a.materials.map((m, i) => (
              <a
                key={i}
                className="card press row gap12"
                href={absUrl(m.url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderRadius: 15, padding: 12, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: 'var(--redSoft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="file" size={20} color="var(--red)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {(m.size / 1e6).toFixed(1)} MB
                  </div>
                </div>
                <Icon name="download" size={20} color="var(--accent)" />
              </a>
            ))}
          </>
        )}

        {a.format === 'speaking' && (
          <>
            <div style={{ height: 16 }} />
            <SpeakingRecorder assignmentId={a.id} referenceText={a.referenceText || ''} />
          </>
        )}

        {!a.completed && a.format !== 'speaking' && (
          <>
            <div style={{ height: 16 }} />
            {a.format === 'test' && (
              <div className="card" style={{ textAlign: 'center', borderRadius: 18 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: 'var(--accentSoft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="list" size={28} color="var(--accent)" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>{a.questions?.length || 0} ta savolli test</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Avtomatik baholanadi. Bir marta topshiriladi.
                </div>
                <div style={{ height: 16 }} />
                <button className="btn btn-primary btn-lg press" onClick={() => setShowTest(true)}>
                  <Icon name="arrowR" size={18} />
                  <span>Testni boshlash</span>
                </button>
              </div>
            )}

            {a.format === 'written' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, padding: '0 2px 8px' }}>Javobingiz</div>
                <textarea
                  className="ta"
                  rows={6}
                  placeholder="Javobingizni shu yerga yozing…"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                />
                <div className="faint" style={{ fontSize: 12, padding: '6px 2px 14px' }}>
                  {answerText.trim().split(/\s+/).filter(Boolean).length} so'z
                </div>
                <button
                  className="btn btn-primary btn-lg press"
                  disabled={answerText.trim().length < 5 || busy}
                  onClick={submit}
                >
                  <span>{busy ? 'Yuborilmoqda…' : 'Topshirish'}</span>
                </button>
              </>
            )}

            {(a.format === 'file' || a.format === 'video') && (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, padding: '0 2px 8px' }}>{isVideo ? 'Video javob' : 'Fayl javob'}</div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onFile} />
                {upPct != null ? (
                  <div className="card" style={{ borderRadius: 16, padding: 14 }}>
                    <div className="row gap10">
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Yuklanmoqda…</div>
                      <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{upPct}%</div>
                    </div>
                    <div style={{ height: 10 }} />
                    <div className="progress" style={{ height: 7 }}>
                      <div style={{ width: `${upPct}%`, background: 'var(--accent)' }} />
                    </div>
                  </div>
                ) : uploaded ? (
                  <div className="card row gap12" style={{ borderRadius: 16, padding: 13 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: 'var(--accentSoft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={isVideo ? 'video' : 'file'} size={20} color="var(--accent)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {uploaded.name}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Yuklandi</div>
                    </div>
                    <button className="press" onClick={() => setUploaded(null)}>
                      <Icon name="x" size={18} color="var(--faint)" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="press"
                    onClick={pickFile}
                    style={{
                      width: '100%',
                      padding: '26px 16px',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--borderStrong)',
                      borderRadius: 16,
                      textAlign: 'center',
                    }}
                  >
                    <Icon name={isVideo ? 'camera' : 'upload'} size={28} color="var(--accent)" />
                    <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 8 }}>{isVideo ? 'Video tanlash' : 'Fayl tanlash'}</div>
                    <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                      Maksimal 20 MB
                    </div>
                  </button>
                )}
                <div style={{ height: 14 }} />
                <button className="btn btn-primary btn-lg press" disabled={!uploaded || busy} onClick={submit}>
                  <span>{busy ? 'Yuborilmoqda…' : 'Topshirish'}</span>
                </button>
              </>
            )}
          </>
        )}

        {err && (
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, marginTop: 12 }}>{err}</div>
        )}
      </div>

      {showTest && (
        <TestRunner
          assignment={a}
          onClose={(submitted) => {
            setShowTest(false)
            if (submitted) reload()
          }}
        />
      )}
    </div>
  )
}

/* ── Test runner: butun ekran overlay (`.scrim` bg var(--bg)) ── */
function TestRunner({
  assignment,
  onClose,
}: {
  assignment: StudentAssignmentDetail
  onClose: (submitted: boolean) => void
}) {
  const qs = assignment.questions || []
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function grade() {
    setSubmitting(true)
    setErr(null)
    try {
      const arr = Object.entries(answers).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex }))
      const r = await submitStudentAssignment(assignment.id, { answers: arr })
      setResult(r)
    } catch (ex: unknown) {
      setErr((ex as { message?: string })?.message || 'Yuborilmadi')
      setSubmitting(false)
    }
  }

  const overlay = (children: React.ReactNode) => (
    <div className="scrim" style={{ alignItems: 'stretch', background: 'var(--bg)' }}>
      <div className="screen" style={{ maxWidth: 480, margin: '0 auto', width: '100%', background: 'var(--bg)' }}>
        {children}
      </div>
    </div>
  )

  if (result) {
    const total = result.total || qs.length
    const correct = result.correctCount || 0
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const good = pct >= 60
    const color = good ? 'var(--green)' : 'var(--amber)'
    return overlay(
      <div className="center" style={{ flexDirection: 'column', padding: '0 28px', textAlign: 'center' }}>
        <Ring value={pct} size={150} stroke={13} color={color}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color }}>{result.score || 0}</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            ball
          </div>
        </Ring>
        <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.3px', marginTop: 24 }}>
          {good ? 'Ajoyib ish!' : 'Topshirildi'}
        </div>
        <div className="muted" style={{ fontSize: 15, marginTop: 6 }}>
          {total} tadan <b style={{ color: 'var(--green)' }}>{correct} ta</b> to'g'ri javob
        </div>
        <div style={{ height: 28 }} />
        <button className="btn btn-primary btn-lg press" onClick={() => onClose(true)}>
          <span>Topshiriqlarga qaytish</span>
        </button>
      </div>,
    )
  }

  if (!qs.length) return overlay(<div className="center">Savollar yo'q</div>)

  const q = qs[idx]
  const sel = answers[q.id]
  const last = idx === qs.length - 1

  return overlay(
    <>
      <div className="row gap12" style={{ padding: '8px 16px 12px' }}>
        <button className="iconbtn press" onClick={() => onClose(false)}>
          <Icon name="x" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="progress">
            <div style={{ width: `${(idx / qs.length) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 13.5, fontWeight: 800 }}>
          {idx + 1}/{qs.length}
        </div>
      </div>

      <div className="scroll" style={{ padding: '12px 20px' }}>
        <span className="chip" style={{ color: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 12%,transparent)', fontSize: 12 }}>
          {assignment.subjectName}
        </span>
        <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.35, letterSpacing: '-.3px', margin: '14px 0 22px' }}>{q.text}</div>
        {q.options.map((o, i) => {
          const on = sel === i
          return (
            <button
              key={i}
              className="press"
              onClick={() => setAnswers((m) => ({ ...m, [q.id]: i }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                width: '100%',
                textAlign: 'left',
                padding: 16,
                marginBottom: 11,
                borderRadius: 16,
                background: on ? 'var(--accentSoft)' : 'var(--surface)',
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: on ? undefined : 'var(--shadow)',
              }}
            >
              <span
                className="badge"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: on ? 'var(--accent)' : 'var(--surface3)',
                  color: on ? '#fff' : 'var(--muted)',
                  fontSize: 13,
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{o}</span>
            </button>
          )
        })}
      </div>

      <div
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '12px 20px 20px',
          display: 'flex',
          gap: 10,
        }}
      >
        {idx > 0 && (
          <button className="btn btn-ghost btn-lg press" onClick={() => setIdx((i) => i - 1)} style={{ width: 'auto', padding: '0 18px' }}>
            <Icon name="chevL" size={20} />
          </button>
        )}
        {err ? (
          <div style={{ flex: 1, color: 'var(--red)', fontSize: 12, fontWeight: 600, alignSelf: 'center' }}>{err}</div>
        ) : last ? (
          <button
            className="btn btn-primary btn-lg press"
            disabled={Object.keys(answers).length < qs.length || submitting}
            onClick={grade}
          >
            {submitting ? 'Yuborilmoqda…' : 'Yakunlash'}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg press" disabled={sel == null} onClick={() => setIdx((i) => i + 1)}>
            Keyingisi
          </button>
        )}
      </div>
    </>,
  )
}

function Empty({ title, sub, ic = 'sparkle' }: { title: string; sub?: string; ic?: string }) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon name={ic} size={30} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      {sub && (
        <div className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
