import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, fmtDate, initials } from '@/pages/student/lib'
import {
  getStudentSupport,
  bookSupportSlot,
  cancelSupportSlot,
  type StudentSupport,
} from '@/api/services/support'

/* ============================================================
   O'quvchi portali — SUPPORT.
   Support o'qituvchilari bo'sh vaqt e'lon qiladi; o'quvchi bo'sh
   vaqtni tanlab bron qiladi. O'z bronlarini ko'radi; dars o'tilgach
   mavzu/izoh bron ostida ko'rinadi. .student-app shell.
   ============================================================ */

export function StudentSupportScreen() {
  const nav = useNavigate()
  const [data, setData] = useState<StudentSupport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try {
      const d = await getStudentSupport()
      setData(d)
    } catch {
      /* xato — bo'sh holat ko'rsatamiz */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const book = async (id: string) => {
    if (busy) return
    setBusy(id)
    try {
      await bookSupportSlot(id)
      await load()
    } catch {
      /* e'tibor bermaymiz */
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (id: string) => {
    if (busy) return
    setBusy(id)
    try {
      await cancelSupportSlot(id)
      await load()
    } catch {
      /* e'tibor bermaymiz */
    } finally {
      setBusy(null)
    }
  }

  const myBookings = data?.myBookings ?? []
  const supports = (data?.supports ?? []).filter((s) => s.openSlots.length > 0)

  return (
    <div className="screen">
      <div className="hd">
        <div className="row gap10" style={{ minHeight: 38 }}>
          <button className="iconbtn press" onClick={() => nav('/student/profile')}>
            <Icon name="chevL" size={22} />
          </button>
          <div className="hd-sm" style={{ flex: 1 }}>
            Support
          </div>
        </div>
      </div>

      <div className="scroll" style={{ paddingBottom: 28 }}>
        <div className="pad">
          {loading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '40px 0', fontSize: 13.5 }}>
              Yuklanmoqda...
            </div>
          ) : (
            <>
              {/* ===== Mening bronlarim ===== */}
              {myBookings.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, opacity: 0.85 }}>
                    Mening bronlarim
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myBookings.map((b) => {
                      const done = b.status === 'done'
                      return (
                        <div key={b.id} className="card" style={{ borderRadius: 18 }}>
                          <div className="row gap10" style={{ alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{b.teacherName}</div>
                              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                                {fmtDate(b.date, true)} · {b.startTime}–{b.endTime}
                              </div>
                            </div>
                            <span
                              style={{
                                flex: 'none',
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: 999,
                                background: done ? 'var(--greenSoft, #dcfce7)' : 'var(--accentSoft)',
                                color: done ? 'var(--green, #16a34a)' : 'var(--accent)',
                              }}
                            >
                              {done ? "O'tildi" : 'Bron qilindi'}
                            </span>
                          </div>

                          {done && (b.topic || b.notes) && (
                            <div
                              style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              {b.topic && (
                                <div>
                                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>
                                    Mavzu
                                  </div>
                                  <div style={{ fontSize: 13.5, marginTop: 2 }}>{b.topic}</div>
                                </div>
                              )}
                              {b.notes && (
                                <div>
                                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>
                                    Izoh
                                  </div>
                                  <div style={{ fontSize: 13.5, marginTop: 2, lineHeight: 1.5 }}>{b.notes}</div>
                                </div>
                              )}
                            </div>
                          )}

                          {b.status === 'booked' && (
                            <button
                              className="btn btn-soft press"
                              onClick={() => cancel(b.id)}
                              disabled={busy === b.id}
                              style={{ marginTop: 12 }}
                            >
                              <Icon name="x" size={17} color="var(--accent)" />
                              {busy === b.id ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ===== Bo'sh vaqtlar ===== */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, opacity: 0.85 }}>
                Bo'sh vaqtlar
              </div>

              {supports.length === 0 ? (
                <div className="muted" style={{ textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
                  Hozircha bo'sh vaqt yo'q
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {supports.map((t) => (
                    <div key={t.teacherId} className="card" style={{ borderRadius: 18 }}>
                      <div className="row gap10" style={{ alignItems: 'center', marginBottom: 12 }}>
                        {t.photoUrl ? (
                          <img
                            src={t.photoUrl}
                            alt=""
                            style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flex: 'none' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: 'var(--accentSoft)',
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 800,
                              flex: 'none',
                            }}
                          >
                            {initials(t.fullName)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800 }}>{t.fullName}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {t.openSlots.map((s) => (
                          <div
                            key={s.id}
                            className="row gap10"
                            style={{
                              alignItems: 'center',
                              padding: '8px 12px',
                              borderRadius: 14,
                              background: 'var(--surface3, rgba(0,0,0,.03))',
                            }}
                          >
                            <div className="row gap10" style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                              <Icon name="clock" size={16} color="var(--accent)" />
                              <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                                {fmtDate(s.date)} · {s.startTime}–{s.endTime}
                              </div>
                            </div>
                            <button
                              className="btn btn-primary press"
                              onClick={() => book(s.id)}
                              disabled={busy === s.id}
                              style={{ flex: 'none', width: 'auto', padding: '7px 14px', fontSize: 12.5 }}
                            >
                              {busy === s.id ? '...' : 'Bron qilish'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
