import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStudentAssignments,
  getStudentAssignmentScores,
  getStudentLmsSubjects,
  type StudentAssignment,
  type StudentAssignmentScores,
  type LmsSubject,
} from '@/api/services/studentPortal'
import { Icon, Ring, gradeColor, subjectColor, subjInitial, fmtDate } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Topshiriqlar + Darslik (LMS kurslar).
   student.html: Assignments() / tasksTab() / lmsTab().
   ============================================================ */

export type FormatKey = 'test' | 'written' | 'file' | 'video'

export function formatMeta(f: string): { label: string; icon: string; color: string } {
  const map: Record<string, { label: string; icon: string; color: string }> = {
    test: { label: 'Test', icon: 'list', color: '#2563EB' },
    written: { label: 'Yozma', icon: 'edit', color: '#7C3AED' },
    file: { label: 'Fayl', icon: 'file', color: '#0D9488' },
    video: { label: 'Video', icon: 'video', color: '#EA580C' },
  }
  return map[f] || { label: f, icon: 'file', color: '#64708A' }
}

function daysLeft(due?: string | null): number | null {
  if (!due) return null
  const d = new Date(due.length <= 10 ? due + 'T00:00:00' : due)
  if (isNaN(d.getTime())) return null
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 864e5)
}

/** Topshiriq holati yorlig'i (rang + matn). */
export function dueLabel(a: { completed: boolean; dueDate?: string | null; lateAccept?: boolean }): {
  text: string
  color: string
} {
  if (a.completed) return { text: 'Topshirildi', color: 'var(--green)' }
  const dl = daysLeft(a.dueDate)
  if (dl == null) return { text: 'Muddatsiz', color: 'var(--muted)' }
  if (dl < 0) return a.lateAccept ? { text: 'Kechikkan', color: 'var(--amber)' } : { text: "Muddati o'tgan", color: 'var(--red)' }
  if (dl === 0) return { text: 'Bugun tugaydi', color: 'var(--red)' }
  if (dl === 1) return { text: 'Ertaga tugaydi', color: 'var(--amber)' }
  return { text: dl + ' kun qoldi', color: 'var(--muted)' }
}

function Chip({ label, ic, color, fontSize = 12 }: { label: string; ic?: string; color: string; fontSize?: number }) {
  return (
    <span className="chip" style={{ color, background: `color-mix(in srgb,${color} 12%,transparent)`, fontSize }}>
      {ic && <Icon name={ic} size={fontSize} color={color} />}
      {label}
    </span>
  )
}

type Filter = 'pending' | 'done' | 'all'

export function StudentAssignmentsScreen() {
  const [mode, setMode] = useState<0 | 1>(0)

  return (
    <div className="screen">
      <div className="hd lg">
        <div className="row sp" style={{ minHeight: 38 }}>
          <div />
        </div>
        <div className="hd-sub" style={{ marginTop: 8 }}>
          {mode === 0 ? 'Sinf topshiriqlari va testlar' : "Video darslar va o'quv materiallari"}
        </div>
        <div className="hd-big">Topshiriqlar</div>
      </div>

      <div className="pad" style={{ paddingBottom: 12 }}>
        <div className="seg">
          <button className={(mode === 0 ? 'on ' : '') + 'press'} onClick={() => setMode(0)}>
            <Icon name="clipboard" size={17} color={mode === 0 ? '#fff' : 'var(--muted)'} />
            Topshiriqlar
          </button>
          <button className={(mode === 1 ? 'on ' : '') + 'press'} onClick={() => setMode(1)}>
            <Icon name="book" size={17} color={mode === 1 ? '#fff' : 'var(--muted)'} />
            Darslik
          </button>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1 }}>
        {mode === 0 ? <TasksTab /> : <LmsTab />}
      </div>
    </div>
  )
}

function TasksTab() {
  const navigate = useNavigate()
  const [items, setItems] = useState<StudentAssignment[] | null>(null)
  const [scores, setScores] = useState<StudentAssignmentScores | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')

  useEffect(() => {
    let on = true
    getStudentAssignments()
      .then((d) => on && setItems(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    getStudentAssignmentScores()
      .then((d) => on && setScores(d))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  if (err) return <Empty title="Yuklab bo'lmadi" sub={err} ic="alert" />
  if (!items)
    return (
      <div className="center">
        <div className="spin" />
      </div>
    )

  const pending = items.filter((a) => !a.completed).length
  const filtered = items.filter((a) => (filter === 'all' ? true : filter === 'pending' ? !a.completed : a.completed))
  const tabs: [Filter, string, number][] = [
    ['pending', 'Kutilmoqda', pending],
    ['done', 'Topshirilgan', items.length - pending],
    ['all', 'Hammasi', items.length],
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {scores && scores.gradedCount > 0 && (
        <div className="pad" style={{ paddingBottom: 4 }}>
          <div className="card row" style={{ gap: 18 }}>
            <Ring
              value={scores.totalMax > 0 ? (scores.totalScore / scores.totalMax) * 100 : 0}
              size={84}
              stroke={10}
              color={gradeColor(scores.totalMax > 0 ? (scores.totalScore / scores.totalMax) * 5 : 0)}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: gradeColor(scores.totalMax > 0 ? (scores.totalScore / scores.totalMax) * 5 : 0),
                }}
              >
                {Math.round(scores.totalMax > 0 ? (scores.totalScore / scores.totalMax) * 100 : 0)}%
              </div>
              <div className="muted" style={{ fontSize: 10.5, fontWeight: 700 }}>
                ball
              </div>
            </Ring>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                Topshiriq ballari
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 3 }}>
                {scores.totalScore}
                <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>
                  {' '}
                  / {scores.totalMax} ball
                </span>
              </div>
              <div className="row gap12" style={{ marginTop: 10 }}>
                <span className="row gap6" style={{ fontSize: 13 }}>
                  <Icon name="checkCircle" size={15} color="var(--green)" />
                  <b>{scores.gradedCount}</b>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    Baholangan
                  </span>
                </span>
                <span className="row gap6" style={{ fontSize: 13 }}>
                  <Icon name="clipboard" size={15} color="var(--accent)" />
                  <b>{scores.count}</b>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    Jami
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pad row gap6" style={{ paddingTop: 4, paddingBottom: 14 }}>
        {tabs.map(([id, label, n]) => {
          const on = filter === id
          return (
            <button
              key={id}
              className="press"
              onClick={() => setFilter(id)}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: on ? 'var(--accent)' : 'var(--surface)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                color: on ? '#fff' : 'var(--muted)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: on ? 'rgba(255,255,255,.25)' : 'var(--surface3)',
                  color: on ? '#fff' : 'var(--muted)',
                }}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      <div className="pad">
        {filtered.length ? (
          filtered.map((a) => {
            const fm = formatMeta(a.format)
            const col = subjectColor(a.subjectName)
            const due = dueLabel(a)
            return (
              <button
                key={a.id}
                className="card press"
                onClick={() => navigate(`/student/assignments/${a.id}`)}
                style={{ width: '100%', textAlign: 'left', borderRadius: 18, marginBottom: 11 }}
              >
                <div className="row gap12" style={{ alignItems: 'flex-start' }}>
                  <div
                    className="subj"
                    style={{ width: 44, height: 44, borderRadius: 13, flex: 'none', background: col + '22', color: col, fontSize: 18 }}
                  >
                    {subjInitial(a.subjectName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap6">
                      <span
                        className="muted"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.subjectName}
                      </span>
                      <Chip label={fm.label} ic={fm.icon} color={fm.color} fontSize={10.5} />
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.25, marginTop: 3 }}>{a.title}</div>
                    <div className="row sp" style={{ marginTop: 8 }}>
                      <span className="row gap6" style={{ color: due.color, fontSize: 12.5, fontWeight: 700 }}>
                        <Icon name={a.completed ? 'checkCircle' : 'clock'} size={15} color={due.color} />
                        {due.text}
                      </span>
                      {a.completed && a.score != null ? (
                        <Chip label={a.score + ' ball'} color={gradeColor(a.score / 20)} fontSize={11} />
                      ) : (
                        <span className="faint" style={{ fontSize: 12 }}>
                          {fmtDate(a.dueDate)} gacha
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        ) : (
          <Empty title="Bo'sh" sub="Bu bo'limda topshiriq yo'q." ic="checkCircle" />
        )}
      </div>
    </div>
  )
}

function LmsTab() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<LmsSubject[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    getStudentLmsSubjects()
      .then((d) => on && setCourses(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  if (err) return <Empty title="Yuklab bo'lmadi" sub={err} ic="alert" />
  if (!courses)
    return (
      <div className="center">
        <div className="spin" />
      </div>
    )
  if (!courses.length)
    return (
      <div className="pad" style={{ paddingTop: 40 }}>
        <Empty title="Darslik yo'q" sub="Sizning guruhingizga hali o'quv kursi biriktirilmagan." ic="book" />
      </div>
    )

  return (
    <div className="pad" style={{ paddingBottom: 24 }}>
      {courses.map((co) => {
        const col = subjectColor(co.title)
        const pct = co.topicsCount > 0 ? Math.round((co.completedCount / co.topicsCount) * 100) : 0
        const done = co.topicsCount > 0 && co.completedCount >= co.topicsCount
        return (
          <button
            key={co.id}
            className="card press"
            onClick={() => navigate(`/student/lms/${co.id}`)}
            style={{ width: '100%', textAlign: 'left', borderRadius: 18, marginBottom: 11 }}
          >
            <div className="row gap12" style={{ alignItems: 'flex-start' }}>
              <div
                className="subj"
                style={{ width: 46, height: 46, borderRadius: 13, flex: 'none', background: col + '22', color: col, fontSize: 19 }}
              >
                {subjInitial(co.title)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.2 }}>{co.title}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                  {co.completedCount} / {co.topicsCount} mavzu
                  {co.unlockMode === 'sequential' ? ' · ketma-ket' : ''}
                </div>
              </div>
              {done ? (
                <Chip label="Tugatildi" ic="check" color="var(--green)" fontSize={11} />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{pct}%</div>
              )}
            </div>
            <div style={{ height: 12 }} />
            <div className="progress">
              <div style={{ width: `${pct}%`, background: col }} />
            </div>
          </button>
        )
      })}
    </div>
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
