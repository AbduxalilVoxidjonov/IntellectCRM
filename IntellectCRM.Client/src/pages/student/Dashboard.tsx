import { useEffect, useState } from 'react'
import {
  getStudentCurriculum,
  type StudentCurriculum,
  type CurriculumItem,
} from '@/api/services/studentPortal'
import { useAuth } from '@/context/auth-context'
import { Icon, Ring, fmtDate, subjectColor } from '@/pages/student/lib'

/* ============================================================
   O'quvchi Dashboard — O'QUV DASTURI (Duolingo uslubidagi yo'l-xarita).
   Har kurs bo'yicha: o'tilgan/qolgan + foiz + tugash prognozi; bo'limlar
   (darajalar) bo'yicha mavzular tugun-tugun yo'l ko'rinishida.
   ============================================================ */

const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const MO = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
function todayLine(): string {
  const d = new Date()
  return `${d.getDate()}-${MO[d.getMonth()]}, ${WD[d.getDay()]}`
}

/** Birinchi o'tilmagan band (kurs tartibida) — "hozir o'rganiladigan". */
function findNext(cur: StudentCurriculum): string | null {
  for (const lv of cur.levels) for (const tp of lv.topics) for (const it of tp.items) if (!it.covered) return it.id
  return null
}

export function StudentDashboardScreen() {
  const { user } = useAuth()
  const first = (user?.fullName || '').trim().split(/\s+/)[0] || ''
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

  const header = (
    <div className="hd lg">
      <div className="hd-sub">{todayLine()}</div>
      <div className="hd-big">
        Salom, <span style={{ color: 'var(--accent)' }}>{first}</span> {'\u{1F44B}'}
      </div>
    </div>
  )

  if (courses === null && !err)
    return (
      <>
        {header}
        <div className="center" style={{ minHeight: '50dvh' }}>
          <div className="spin" />
        </div>
      </>
    )
  if (err)
    return (
      <>
        {header}
        <Empty ic="alert" title="Yuklab bo'lmadi" sub={err} />
      </>
    )
  if (!courses || !courses.length)
    return (
      <>
        {header}
        <Empty ic="book" title="O'quv dasturi yo'q" sub="Hozircha kursingizga o'quv dasturi biriktirilmagan." />
      </>
    )

  const cur = courses[Math.min(sel, courses.length - 1)]

  return (
    <>
      {header}
      <div className="pad" style={{ paddingBottom: 28 }}>
        {courses.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 0 2px' }}>
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
    </>
  )
}

function ForecastCard({ cur }: { cur: StudentCurriculum }) {
  const pct = cur.totalItems > 0 ? Math.round((cur.coveredCount / cur.totalItems) * 100) : 0
  const done = cur.remainingItems <= 0
  const col = subjectColor(cur.courseId)
  return (
    <div className="card" style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
      <Ring value={pct} max={100} size={78} stroke={8} color={col}>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{pct}%</div>
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
            {/* Bo'lim (daraja) banneri */}
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

            {/* Yo'l (tugunlar) */}
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

function Empty({ ic, title, sub }: { ic: string; title: string; sub: string }) {
  return (
    <div className="empty" style={{ paddingTop: 56 }}>
      <div className="empty-ic">
        <Icon name={ic} size={28} color="var(--faint)" />
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{title}</div>
      <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
        {sub}
      </div>
    </div>
  )
}
