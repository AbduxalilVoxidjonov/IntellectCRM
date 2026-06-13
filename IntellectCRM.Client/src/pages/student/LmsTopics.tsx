import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStudentLmsModules, type LmsModule, type LmsTopic } from '@/api/services/studentPortal'
import { Icon } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Darslik: modullar + mavzular ro'yxati.
   student.html: LmsTopics().
   ============================================================ */

export function StudentLmsTopicsScreen() {
  const { subjectId = '' } = useParams()
  const navigate = useNavigate()
  const [modules, setModules] = useState<LmsModule[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    getStudentLmsModules(subjectId)
      .then((d) => on && setModules(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [subjectId])

  const head = (
    <div className="hd">
      <div className="row gap10" style={{ minHeight: 38 }}>
        <button className="iconbtn press" onClick={() => navigate(-1)}>
          <Icon name="chevL" size={22} />
        </button>
        <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Darslik
        </div>
      </div>
    </div>
  )

  if (err)
    return (
      <div className="screen">
        {head}
        <div className="center">
          <Empty title="Yuklab bo'lmadi" sub={err} ic="alert" />
        </div>
      </div>
    )
  if (!modules)
    return (
      <div className="screen">
        {head}
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    )

  const topicRow = (t: LmsTopic) => {
    const hasVideo = !!t.videoUrl
    const hasText = !!t.textContent
    const matCount = (t.materials || []).length
    const meta =
      [hasVideo ? 'Video' : null, hasText ? 'Matn' : null, matCount ? matCount + ' material' : null]
        .filter(Boolean)
        .join(' · ') || 'Mavzu'
    const locked = !t.isUnlocked
    return (
      <button
        key={t.id}
        className="press row gap12"
        disabled={locked}
        onClick={() => !locked && navigate(`/student/lms/${subjectId}/topic/${t.id}`)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 12,
          borderBottom: '1px solid var(--border)',
          opacity: locked ? 0.5 : undefined,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: t.isCompleted ? 'var(--greenSoft)' : locked ? 'var(--surface3)' : 'var(--accentSoft)',
          }}
        >
          {t.isCompleted ? (
            <Icon name="check" size={18} color="var(--green)" />
          ) : locked ? (
            <Icon name="lock" size={16} color="var(--faint)" />
          ) : (
            <Icon name={hasVideo ? 'video' : 'book'} size={17} color="var(--accent)" />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {meta}
          </div>
        </div>
        {!locked && <Icon name="chevR" size={20} color="var(--faint)" />}
      </button>
    )
  }

  return (
    <div className="screen">
      {head}
      <div className="scroll pad" style={{ paddingBottom: 24 }}>
        {modules.length ? (
          modules.map((m) => (
            <div key={m.id} style={{ marginBottom: 14 }}>
              <div className="row sp" style={{ padding: '0 2px 8px' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{m.title}</div>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {m.completedCount}/{m.topicsCount}
                </div>
              </div>
              <div className="card" style={{ padding: 4 }}>
                {(m.topics || []).length ? (
                  (m.topics || []).map(topicRow)
                ) : (
                  <Empty title="Mavzu yo'q" ic="book" />
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty title="Modul yo'q" sub="Bu fanda hali mavzu qo'shilmagan." ic="book" />
        )}
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
