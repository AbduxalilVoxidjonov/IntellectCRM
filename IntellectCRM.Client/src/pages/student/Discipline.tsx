import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudentDiscipline, type StudentDiscipline } from '@/api/services/studentPortal'
import { Icon, Ring, fmtDate } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Intizomiy ball ekrani.
   ============================================================ */

export function StudentDisciplineScreen() {
  const navigate = useNavigate()
  const [data, setData] = useState<StudentDiscipline | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    getStudentDiscipline()
      .then((d) => on && setData(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [])

  const head = (
    <div className="hd">
      <div className="row gap10" style={{ minHeight: 38 }}>
        <button className="iconbtn press" onClick={() => navigate(-1)}>
          <Icon name="chevL" size={22} />
        </button>
        <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Intizomiy ball
        </div>
      </div>
    </div>
  )

  if (err) {
    return (
      <div className="screen">
        {head}
        <div className="center">
          <Empty title="Yuklab bo'lmadi" sub={err} ic="alert" />
        </div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen">
        {head}
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    )
  }

  const col = data.remaining >= 85 ? 'var(--green)' : data.remaining >= 60 ? 'var(--amber)' : 'var(--red)'
  const total = (label: string, value: string, color: string, ic: string) => (
    <div className="card row gap12" style={{ flex: 1, padding: 14, borderRadius: 16 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: `color-mix(in srgb,${color} 13%,transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={ic} size={20} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
          {label}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  )

  const items = data.items || []

  return (
    <div className="screen">
      {head}
      <div className="scroll" style={{ paddingBottom: 24 }}>
        <div className="pad">
          <div className="card row" style={{ gap: 18, borderRadius: 22, padding: 18 }}>
            <Ring value={Math.max(0, Math.min(100, data.remaining))} max={100} size={96} stroke={10} color={col}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', color: col }}>{data.remaining}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                ball
              </div>
            </Ring>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Joriy intizomiy ball</div>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 5 }}>
                100 balldan boshlanadi. Yaxshi xulq ballni oshiradi, intizom buzilishi kamaytiradi.
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />
          <div className="row gap10">
            {total('Rag‘bat', `+${data.plus}`, 'var(--green)', 'award')}
            {total('Jazo', `−${data.minus}`, 'var(--red)', 'alert')}
          </div>

          <div style={{ height: 16 }} />
          <div className="sh">
            <div className="sh-title">Tarix</div>
          </div>

          {items.length ? (
            <div className="card" style={{ padding: 4 }}>
              {items.map((r, i) => {
                const reward = r.points >= 0
                const rc = reward ? 'var(--green)' : 'var(--red)'
                const parts = [fmtDate(r.createdAt), r.source].filter(Boolean)
                return (
                  <div
                    key={(r.id || '') + '_' + i}
                    className="row gap12"
                    style={{ padding: '12px 11px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: `color-mix(in srgb,${rc} 13%,transparent)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={reward ? 'award' : 'alert'} size={20} color={rc} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.reasonName}</div>
                      {r.note && (
                        <div className="muted" style={{ fontSize: 12.5 }}>
                          {r.note}
                        </div>
                      )}
                      {parts.length > 0 && (
                        <div className="faint" style={{ fontSize: 11.5 }}>
                          {parts.join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: rc }}>
                      {reward ? '+' : '−'}
                      {Math.abs(r.points)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card">
              <Empty title="Yozuv yo'q" sub="Hozircha intizomiy ball o'zgarmagan." ic="checkCircle" />
            </div>
          )}
        </div>
      </div>
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
