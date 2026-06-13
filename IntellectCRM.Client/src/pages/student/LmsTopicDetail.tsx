import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { getStudentLmsTopic, completeStudentLmsTopic, type LmsTopic } from '@/api/services/studentPortal'
import { Icon } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Darslik mavzu tafsiloti (video + matn + material).
   student.html: LmsTopicDetail().
   ============================================================ */

function absUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '').replace(/\/$/, '')
  return url.startsWith('/') ? base + url : base + '/' + url
}

/** YouTube id'ni URL'dan ajratib oladi (yoki to'g'ridan-to'g'ri 11-belgili id). */
function ytId(u?: string | null): string | null {
  if (!u) return null
  const m = String(u).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  )
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{11}$/.test(u) ? u : null
}

export function StudentLmsTopicDetailScreen() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()
  const [t, setT] = useState<LmsTopic | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reload() {
    return getStudentLmsTopic(topicId)
      .then((d) => setT(d))
      .catch((e) => setErr(e?.message || String(e)))
  }

  useEffect(() => {
    let on = true
    getStudentLmsTopic(topicId)
      .then((d) => on && setT(d))
      .catch((e) => on && setErr(e?.message || String(e)))
    return () => {
      on = false
    }
  }, [topicId])

  const head = (title: string) => (
    <div className="hd">
      <div className="row gap10" style={{ minHeight: 38 }}>
        <button className="iconbtn press" onClick={() => navigate(-1)}>
          <Icon name="chevL" size={22} />
        </button>
        <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
      </div>
    </div>
  )

  if (err)
    return (
      <div className="screen">
        {head('Mavzu')}
        <div className="center">
          <Empty title="Ochib bo'lmadi" sub={err} ic="alert" />
        </div>
      </div>
    )
  if (!t)
    return (
      <div className="screen">
        {head('Mavzu')}
        <div className="center">
          <div className="spin" />
        </div>
      </div>
    )

  const yt = ytId(t.videoUrl)
  const hasVideo = !!t.videoUrl
  const hasText = !!t.textContent

  async function complete() {
    setBusy(true)
    try {
      await completeStudentLmsTopic(topicId)
      await reload()
    } catch (ex: unknown) {
      setErr((ex as { message?: string })?.message || 'Saqlab bo\'lmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      {head(t.title)}
      <div className="scroll pad" style={{ paddingBottom: 28 }}>
        {hasVideo &&
          (yt ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <iframe
                src={`https://www.youtube.com/embed/${yt}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                allowFullScreen
                title={t.title}
              />
            </div>
          ) : (
            <a
              className="card press row gap12"
              href={absUrl(t.videoUrl as string)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: 16, textDecoration: 'none', color: 'inherit' }}
            >
              <Icon name="video" size={22} color="var(--accent)" />
              <span style={{ flex: 1, fontWeight: 700 }}>Videoni ochish</span>
              <Icon name="arrowR" size={20} color="var(--faint)" />
            </a>
          ))}

        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.3px', lineHeight: 1.2 }}>{t.title}</div>
        {t.description && (
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            {t.description}
          </div>
        )}

        {hasText && (
          <div className="card" style={{ marginTop: 16, lineHeight: 1.6, fontWeight: 600, whiteSpace: 'pre-wrap' }}>
            {t.textContent}
          </div>
        )}

        {(t.materials || []).length > 0 && (
          <>
            <div style={{ height: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 800, padding: '0 2px 8px' }}>Materiallar</div>
            {t.materials.map((m, i) => (
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
                </div>
                <Icon name="download" size={20} color="var(--accent)" />
              </a>
            ))}
          </>
        )}

        <div style={{ height: 20 }} />

        {t.isCompleted ? (
          <div
            className="card row gap10"
            style={{
              background: 'var(--greenSoft)',
              borderColor: 'color-mix(in srgb,var(--green) 25%,transparent)',
              boxShadow: 'none',
              justifyContent: 'center',
            }}
          >
            <Icon name="checkCircle" size={22} color="var(--green)" />
            <b style={{ color: 'var(--green)' }}>Mavzu tugatildi</b>
          </div>
        ) : (
          <button className="btn btn-primary btn-lg press" disabled={busy} onClick={complete}>
            <Icon name="check" size={18} />
            <span>{busy ? 'Saqlanmoqda…' : 'Mavzuni tugatdim'}</span>
          </button>
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
