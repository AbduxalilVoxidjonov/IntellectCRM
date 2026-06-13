import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import {
  getStudentDashboard,
  getStudentGrades,
  type StudentDashboard,
  type StudentGradesReport,
} from '@/api/services/studentPortal'
import {
  Icon,
  gradeColor,
  subjectColor,
  subjInitial,
  initials,
  fmtMoney,
  MONTHS,
  WEEKDAYS,
} from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — BOSHQARUV (Dashboard).
   Dizayn: student.html DASHBOARD. Blue UI-kit, .student-app shell.
   ============================================================ */

export function StudentDashboardScreen() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [dash, setDash] = useState<StudentDashboard | null>(null)
  const [report, setReport] = useState<StudentGradesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getStudentDashboard()
      .then(async (d) => {
        if (!alive) return
        setDash(d)
        try {
          const r = await getStudentGrades()
          if (alive) setReport(r)
        } catch {
          /* baholar bo'lmasligi mumkin */
        }
      })
      .catch((e) => {
        if (alive) setError(e?.message || "Yuklab bo'lmadi")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading)
    return (
      <div className="center" style={{ minHeight: '60dvh' }}>
        <div className="spin" />
      </div>
    )
  if (error || !dash)
    return (
      <div className="pad" style={{ paddingTop: 40 }}>
        <div className="empty">
          <div className="empty-ic">
            <Icon name="alert" size={30} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Yuklab bo'lmadi</div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
            {error || ''}
          </div>
        </div>
      </div>
    )

  // GPA: oxirgi baholar o'rtachasi (opaque quarter=1)
  const gpaVals = report
    ? Object.values(report.grades || {})
        .map((m) => (m as Record<number, number>)[1])
        .filter((v): v is number => typeof v === 'number')
    : []
  const gpa = gpaVals.length ? gpaVals.reduce((a, b) => a + b, 0) / gpaVals.length : 0

  const missedMap = report?.attendance?.missedLessons || {}
  const missed = Object.values(missedMap).reduce((a, b) => a + (Number(b) || 0), 0)

  const fullName = dash.profile.fullName || user?.fullName || ''
  const firstName = (user?.fullName || fullName).trim().split(/\s+/)[0] || ''

  const now = new Date()
  const wd = (now.getDay() + 6) % 7
  const subtitle = `${WEEKDAYS[wd]}, ${now.getDate()}-${MONTHS[now.getMonth()].toLowerCase()}`

  const todayGrades = (dash.todayGrades || []).filter((g) => g.grade != null)
  const balance = dash.balance ?? 0

  const StatCard = ({
    label,
    value,
    sub,
    color,
    to,
  }: {
    label: string
    value: string
    sub: string
    color: string
    to: string
  }) => (
    <button
      className="card press"
      onClick={() => nav(to)}
      style={{ flex: 1, padding: 13, borderRadius: 18, textAlign: 'left' }}
    >
      <div
        style={{
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: '-.5px',
          color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{label}</div>
      <div className="muted" style={{ fontSize: 11 }}>
        {sub}
      </div>
    </button>
  )

  const SubjSquare = ({ id, name }: { id: string; name: string }) => (
    <div
      className="subj"
      style={{
        width: 34,
        height: 34,
        borderRadius: 11,
        flex: 'none',
        background: subjectColor(id) + '22',
        color: subjectColor(id),
        fontSize: 14,
      }}
    >
      {subjInitial(name)}
    </div>
  )

  const GradeChip = ({ grade, size = 34 }: { grade: number; size?: number }) => {
    const col = gradeColor(grade)
    const label = grade === Math.round(grade) ? String(Math.round(grade)) : Number(grade).toFixed(1)
    return (
      <div
        className="badge"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: col + '22',
          color: col,
          fontSize: size * 0.5,
        }}
      >
        {label}
      </div>
    )
  }

  return (
    <div className="screen">
      <div style={{ paddingBottom: 24 }}>
        {/* Greeting header (custom) */}
        <div className="row sp" style={{ padding: '10px 20px' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              className="muted"
              style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {subtitle}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-.6px',
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Salom, {firstName}
            </div>
          </div>
          <button className="iconbtn press" type="button">
            <Icon name="bell" size={20} />
          </button>
          <div
            className="subj"
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              flex: 'none',
              marginLeft: 10,
              background: 'linear-gradient(135deg,var(--accent),#5340c4)',
              color: '#fff',
              fontSize: 15,
            }}
          >
            {initials(fullName)}
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 4 }}>
          {/* Hero card */}
          <div className="hero row gap12">
            <div
              className="subj"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                flex: 'none',
                background: 'linear-gradient(135deg,var(--accent),#5340c4)',
                color: '#fff',
                fontSize: 20,
                boxShadow: '0 0 0 3px rgba(255,255,255,.25)',
              }}
            >
              {initials(fullName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: '-.3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {fullName}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
                {dash.profile.className} sinf
              </div>
            </div>
            <span
              className="chip"
              style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 11 }}
            >
              {dash.meta?.currentWeek || 1}-hafta
            </span>
          </div>

          <div style={{ height: 18 }} />

          {/* 3 stat cards */}
          <div className="row gap10">
            <StatCard
              label="O'rtacha baho"
              value={gpa > 0 ? gpa.toFixed(2) : '—'}
              sub={gpa > 0 ? 'baholar' : "baho yo'q"}
              color={gradeColor(gpa)}
              to="/student/grades"
            />
            <StatCard
              label="Davomatsiz"
              value={missed + ' kun'}
              sub={missed > 0 ? 'qoldirilgan' : 'alo'}
              color={missed > 0 ? 'var(--amber)' : 'var(--green)'}
              to="/student/attendance"
            />
            <StatCard
              label="Balans"
              value={fmtMoney(balance)}
              sub={balance < 0 ? 'Qarzdor' : 'Qarzsiz'}
              color={balance < 0 ? 'var(--red)' : 'var(--green)'}
              to="/student/finance"
            />
          </div>

          <div style={{ height: 18 }} />

          {/* Bugungi baholar */}
          {todayGrades.length > 0 && (
            <>
              <div className="sh">
                <div className="sh-title">Bugungi baholar</div>
              </div>
              <div
                className="row gap10"
                style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}
              >
                {todayGrades.map((g, i) => (
                  <div
                    key={i}
                    className="card"
                    style={{ width: 150, flex: 'none', padding: 13, borderRadius: 18 }}
                  >
                    <div className="row sp">
                      <SubjSquare id={g.subjectId} name={g.subjectName} />
                      <GradeChip grade={g.grade as number} />
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginTop: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {g.subjectName}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {g.topic || ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bugungi darslar */}
          <div className="sh">
            <div className="sh-title">Bugungi darslar</div>
          </div>
          <div className="card" style={{ padding: 6 }}>
            {(dash.todayLessons || []).length > 0 ? (
              (dash.todayLessons || []).map((l, i) => {
                const col = subjectColor(l.subjectId)
                return (
                  <div
                    key={i}
                    className="row gap10"
                    style={{ padding: '9px 10px', borderRadius: 14 }}
                  >
                    <div style={{ width: 44, textAlign: 'center' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{l.startTime || '—'}</div>
                      <div className="faint" style={{ fontSize: 11 }}>
                        {l.endTime || ''}
                      </div>
                    </div>
                    <div
                      style={{ width: 3, height: 34, borderRadius: 3, background: col }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{l.subjectName}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {l.teacherName || ''} · {l.period}-dars
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="empty">
                <div className="empty-ic">
                  <Icon name="calendar" size={30} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Bugun dars yo'q</div>
                <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
                  Dam oling!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
