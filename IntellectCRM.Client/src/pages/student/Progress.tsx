import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStudentSubjectsProgress,
  getStudentRating,
  type StudentSubjectsProgress,
  type StudentRating,
  type RatingRow,
} from '@/api/services/studentPortal'
import { Icon, Ring, gradeColor, subjectColor, subjInitial, initials } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Progress ekrani (Fanlar / Sinf / Maktab).
   ============================================================ */

type Mode = 0 | 1 | 2

const SUBS = [
  "Fanlar bo'yicha o'zlashtirish",
  'Sinf reytingi — barcha o‘quvchilar',
  'Maktab reytingi — TOP 15',
]
const TABS: Array<[string, string]> = [
  ['chart', 'Fanlar'],
  ['award', 'Sinf'],
  ['school', 'Maktab'],
]

function SubjectsView({ navigate }: { navigate: (id: string) => void }) {
  const [data, setData] = useState<StudentSubjectsProgress | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let on = true
    getStudentSubjectsProgress(1)
      .then((d) => on && setData(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  if (err) return <EmptyState title="Yuklab bo'lmadi" sub={err} ic="alert" />
  if (!data) return <Loading />

  return (
    <div className="pad" style={{ paddingBottom: 24 }}>
      <div className="card row" style={{ gap: 18 }}>
        <Ring value={data.totalPercent} max={100} size={92} stroke={11} color="var(--accent)">
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>
            {data.totalPercent}%
          </div>
          <div className="muted" style={{ fontSize: 10.5, fontWeight: 700 }}>
            umumiy
          </div>
        </Ring>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
            O'tilgan darslar
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, margin: '4px 0' }}>
            {data.totalConducted} / {data.totalPlanned}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            reja darslardan o'tildi
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />
      <div className="sh">
        <div className="sh-title">Fanlar bo'yicha</div>
      </div>

      {(data.subjects || []).length ? (
        (data.subjects || []).map((s) => {
          const col = subjectColor(s.subjectId)
          return (
            <button
              key={s.subjectId}
              className="card press"
              onClick={() => navigate(s.subjectId)}
              style={{ width: '100%', textAlign: 'left', borderRadius: 16, marginBottom: 10 }}
            >
              <div className="row gap12">
                <div
                  className="subj"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    flex: 'none',
                    background: subjectColor(s.subjectId) + '22',
                    color: col,
                    fontSize: 18,
                  }}
                >
                  {subjInitial(s.subjectName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row sp">
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.subjectName}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {s.conducted}/{s.planned} dars · {s.remaining} qoldi
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{s.percent}%</div>
              </div>
              <div style={{ height: 10 }} />
              <div className="progress">
                <div style={{ width: `${Math.max(0, Math.min(100, s.percent))}%`, background: 'var(--accent)' }} />
              </div>
            </button>
          )
        })
      ) : (
        <div className="card">
          <EmptyState title="Ma'lumot yo'q" sub="Fan progresi topilmadi." ic="chart" />
        </div>
      )}
    </div>
  )
}

function RatingView({ scope }: { scope: 'class' | 'school' }) {
  const [board, setBoard] = useState<StudentRating | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let on = true
    getStudentRating()
      .then((d) => on && setBoard(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  if (err) return <EmptyState title="Yuklab bo'lmadi" sub={err} ic="alert" />
  if (!board) return <Loading />

  const isSchool = scope === 'school'
  const rows: RatingRow[] = isSchool ? board.schoolRows || [] : board.classRows || []
  const meId = board.meStudentId
  const me = rows.find((r) => r.studentId === meId)
  const meRank = isSchool ? board.meSchoolRank || me?.rank || 0 : me?.rank || 0
  const meTotal = isSchool ? board.schoolSize : (board.classRows || []).length

  const medal = (r: number) => (r === 1 ? '#F5B301' : r === 2 ? '#9AA3B2' : r === 3 ? '#CD7F32' : null)

  return (
    <div className="pad" style={{ paddingTop: 4, paddingBottom: 24 }}>
      {me && meRank > 0 && (
        <>
          <div
            className="card row"
            style={{
              gap: 18,
              background: 'var(--accentSoft)',
              borderColor: 'color-mix(in srgb,var(--accent) 25%,transparent)',
              boxShadow: 'none',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>#{meRank}</div>
              {meTotal > 0 && (
                <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                  {meTotal} dan
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                Sizning o'rningiz
              </div>
              <div
                style={{
                  fontSize: 16.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {me.fullName}
              </div>
              {me.className && (
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {me.className}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: gradeColor(me.average) }}>
                {me.average.toFixed(1)}
              </div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                o'rtacha
              </div>
            </div>
          </div>
          <div style={{ height: 16 }} />
        </>
      )}

      <div className="sh">
        <div className="sh-title">{isSchool ? 'Maktab reytingi · TOP 15' : 'Sinf reytingi'}</div>
      </div>

      {rows.length ? (
        <div className="card" style={{ padding: 4 }}>
          {rows.map((e, i) => {
            const m = medal(e.rank)
            const isMe = e.studentId === meId
            return (
              <div
                key={e.studentId + '_' + i}
                className="row gap10"
                style={{
                  padding: 8,
                  borderRadius: 12,
                  background: isMe ? 'var(--accentSoft)' : undefined,
                  borderBottom: !isMe && i < rows.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div
                  className="badge"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    color: m || 'var(--muted)',
                    background: m ? `color-mix(in srgb,${m} 16%,transparent)` : 'var(--surface3)',
                    fontSize: 15,
                  }}
                >
                  {e.rank}
                </div>
                <div
                  className="subj"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    flex: 'none',
                    background: 'linear-gradient(135deg,var(--accent),#5340c4)',
                    color: '#fff',
                    fontSize: 14,
                  }}
                >
                  {initials(e.fullName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap6">
                    <span
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.fullName}
                    </span>
                    {isMe && (
                      <span
                        className="chip"
                        style={{ color: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 12%,transparent)', fontSize: 9.5 }}
                      >
                        Siz
                      </span>
                    )}
                  </div>
                  {isSchool && e.className && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {e.className}
                    </div>
                  )}
                </div>
                <div
                  className="badge"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: `color-mix(in srgb,${gradeColor(e.average)} 16%,var(--surface))`,
                    color: gradeColor(e.average),
                    fontSize: 17,
                  }}
                >
                  {e.average === Math.round(e.average) ? Math.round(e.average) : e.average.toFixed(1)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState title="Reyting yo'q" sub="Reyting ma'lumoti topilmadi." ic="award" />
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="center">
      <div className="spin" />
    </div>
  )
}
function EmptyState({ title, sub, ic = 'sparkle' }: { title: string; sub?: string; ic?: string }) {
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

export function StudentProgressScreen() {
  const [mode, setMode] = useState<Mode>(0)
  const navigate = useNavigate()

  return (
    <div className="screen">
      <div className="hd lg">
        <div className="row sp" style={{ minHeight: 38 }}>
          <div />
          <div className="row gap8" />
        </div>
        <div className="hd-sub" style={{ marginTop: 8 }}>
          {SUBS[mode]}
        </div>
        <div className="hd-big">Progress</div>
      </div>

      <div className="pad" style={{ paddingBottom: 12 }}>
        <div className="seg">
          {TABS.map(([ic, label], i) => (
            <button key={i} className={i === mode ? 'on' : 'press'} onClick={() => setMode(i as Mode)}>
              <Icon name={ic} size={16} color={i === mode ? '#fff' : 'var(--muted)'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll">
        {mode === 0 ? (
          <SubjectsView navigate={(id) => navigate(`/student/progress/subject/${id}`)} />
        ) : (
          <RatingView scope={mode === 2 ? 'school' : 'class'} />
        )}
      </div>
    </div>
  )
}
