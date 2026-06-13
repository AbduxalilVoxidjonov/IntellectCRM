import { useEffect, useState } from 'react'
import {
  getStudentCurriculum,
  getStudentRating,
  type StudentCurriculum,
  type CurriculumItem,
  type StudentRating,
  type RatingRow,
} from '@/api/services/studentPortal'
import { Icon, Ring, gradeColor, subjectColor, initials, fmtDate } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Progress ekrani (Dastur / Sinf / Maktab).
   "Dastur" = Duolingo uslubidagi o'quv dasturi yo'l-xaritasi.
   ============================================================ */

type Mode = 0 | 1 | 2

const SUBS = [
  "O'quv dasturi — o'tilgan / qolgan",
  'Sinf reytingi — barcha o‘quvchilar',
  'Maktab reytingi — TOP 15',
]
const TABS: Array<[string, string]> = [
  ['book', 'Dastur'],
  ['award', 'Sinf'],
  ['school', 'Maktab'],
]

/** Birinchi o'tilmagan band (kurs tartibida) — "hozir o'rganiladigan". */
function findNext(cur: StudentCurriculum): string | null {
  for (const lv of cur.levels) for (const tp of lv.topics) for (const it of tp.items) if (!it.covered) return it.id
  return null
}

function DasturView() {
  const [courses, setCourses] = useState<StudentCurriculum[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  useEffect(() => {
    let on = true
    getStudentCurriculum()
      .then((c) => on && setCourses(c))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  if (err) return <EmptyState title="Yuklab bo'lmadi" sub={err} ic="alert" />
  if (!courses) return <Loading />
  if (!courses.length)
    return (
      <div className="card" style={{ margin: '0 16px' }}>
        <EmptyState title="O'quv dasturi yo'q" sub="Hozircha kursingizga o'quv dasturi biriktirilmagan." ic="book" />
      </div>
    )

  const cur = courses[Math.min(sel, courses.length - 1)]
  return (
    <div className="pad" style={{ paddingBottom: 28 }}>
      {courses.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {courses.map((c, i) => (
            <button
              key={c.groupId}
              onClick={() => setSel(i)}
              className="press"
              style={{
                flex: 'none',
                padding: '8px 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: i === sel ? 'var(--accent)' : 'var(--surface)',
                color: i === sel ? '#fff' : 'var(--muted)',
                border: `1px solid ${i === sel ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {c.courseName}
            </button>
          ))}
        </div>
      )}
      <ForecastCard cur={cur} />
      <Roadmap cur={cur} />
    </div>
  )
}

function ForecastCard({ cur }: { cur: StudentCurriculum }) {
  const pct = cur.totalItems > 0 ? Math.round((cur.coveredCount / cur.totalItems) * 100) : 0
  const done = cur.remainingItems <= 0
  const col = subjectColor(cur.courseId)
  return (
    <div className="card" style={{ marginTop: 4, display: 'flex', gap: 14, alignItems: 'center' }}>
      <Ring value={pct} max={100} size={80} stroke={9} color={col}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{pct}%</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>o'tildi</div>
      </Ring>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{cur.courseName}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          O'tildi {cur.coveredCount}/{cur.totalItems} mavzu
        </div>
        <div className="progress" style={{ marginTop: 8 }}>
          <div style={{ width: `${pct}%`, background: col }} />
        </div>
        <div style={{ fontSize: 12.5, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={done ? 'award' : 'clock'} size={15} color={done ? 'var(--green)' : col} fill={done} />
          {done ? (
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>Kurs tugatildi! {'\u{1F389}'}</span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>
              ~{cur.estLessonsLeft} dars qoldi
              {cur.estFinishDate ? ` · ≈ ${fmtDate(cur.estFinishDate)}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Roadmap({ cur }: { cur: StudentCurriculum }) {
  const nextId = findNext(cur)
  const col = subjectColor(cur.courseId)
  return (
    <div style={{ marginTop: 18 }}>
      {cur.levels.map((lv) => {
        const items = lv.topics.flatMap((t) => t.items)
        if (!items.length) return null
        const cov = items.filter((i) => i.covered).length
        return (
          <div key={lv.id} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 14px',
                borderRadius: 16,
                background: col,
                color: '#fff',
                marginBottom: 4,
                boxShadow: `0 8px 20px ${col}40`,
              }}
            >
              <Icon name="book" size={20} color="#fff" fill />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Bo'lim
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{lv.name}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>
                {cov}/{items.length}
              </div>
            </div>

            <div style={{ position: 'relative', padding: '10px 0 4px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 6,
                  bottom: 6,
                  width: 3,
                  background: 'var(--surface3)',
                  transform: 'translateX(-1.5px)',
                  borderRadius: 3,
                }}
              />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                {items.map((it, idx) => (
                  <Node
                    key={it.id}
                    item={it}
                    state={it.covered ? 'done' : it.id === nextId ? 'now' : 'lock'}
                    offset={Math.round(Math.sin(idx * 0.85) * 58)}
                    color={col}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Node({
  item,
  state,
  offset,
  color,
}: {
  item: CurriculumItem
  state: 'done' | 'now' | 'lock'
  offset: number
  color: string
}) {
  const bg = state === 'done' ? 'var(--green)' : state === 'now' ? color : 'var(--surface3)'
  const fg = state === 'lock' ? 'var(--faint)' : '#fff'
  const icon = state === 'done' ? 'check' : state === 'now' ? 'book' : 'lock'
  return (
    <div style={{ transform: `translateX(${offset}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, maxWidth: 150 }}>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: bg,
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
          border: state === 'lock' ? '1px solid var(--border)' : 'none',
          boxShadow:
            state === 'now'
              ? `0 0 0 4px var(--surface), 0 0 0 7px ${color}`
              : state === 'done'
                ? '0 4px 10px rgba(22,163,74,.30)'
                : 'none',
        }}
      >
        <Icon name={icon} size={26} color={fg} fill={state !== 'lock'} />
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: state === 'lock' ? 'var(--faint)' : 'var(--text)',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 132,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.text}
      </div>
      {state === 'now' && <div style={{ fontSize: 10, fontWeight: 800, color }}>HOZIR</div>}
      {state === 'done' && item.coveredDate && (
        <div style={{ fontSize: 10, color: 'var(--faint)' }}>{fmtDate(item.coveredDate)}</div>
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

  return (
    <div className="screen">
      <div className="hd lg">
        <div className="hd-sub" style={{ marginTop: 4 }}>
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
        {mode === 0 ? <DasturView /> : <RatingView scope={mode === 2 ? 'school' : 'class'} />}
      </div>
    </div>
  )
}
