import { useCallback, useEffect, useMemo, useState } from 'react'
import { MonthDayStrip } from '@/components/ui/MonthDayStrip'
import { currentMonth, monthRange } from '@/lib/month'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  countHashtags, countMentions, createIgPost, defaultKind, deleteIgPost, emptyMedia, emptyOptions,
  getIgContentLimit, getIgContentStatus, getIgPosts, isEditable, isHttpsUrl, isJpegUrl, isVideoUrl,
  publishIgPost, updateIgPost,
  IG_LIMITS, IG_POST_STATUSES, IG_POST_TYPES,
  type IgContentStatus, type IgMediaItem, type IgMediaKind, type IgPost, type IgPostLimit,
  type IgPostOptions, type IgPostStatus, type IgPostTotals, type IgPostType,
} from '@/api/services/instagramContent'
import { Icon, MarketingPage, MkEmpty, MkError, MkLoading } from './mk'

/**
 * KONTENT REJALASHTIRISH — Instagram postlarini oldindan navbatga qo'yish ekrani.
 *
 * Ekran uchta savolga javob beradi:
 * (1) <b>qaysi kunda nima chiqadi</b> — oylik kalendar chizig'i va navbat ro'yxati;
 * (2) <b>bugun yana nechta post joylash mumkin</b> — Meta'ning kunlik kvotasi;
 * (3) <b>nega chiqmadi</b> — xato holatida o'zbekcha sabab va «Qayta urinish».
 *
 * ⚠️ ASOSIY TUZOQLAR (§5.9 — ekranda ham OCHIQ yozilgan):
 * 1. <b>Joylangan postni CRM'dan tahrirlab ham, o'chirib ham bo'lmaydi</b> — Instagram API'si
 *    buni qo'llab-quvvatlamaydi. Shuning uchun tahrirlash tugmasi faqat `scheduled` holatda
 *    ochiq, `DELETE` esa joylangan postda FAQAT CRM yozuvini o'chiradi (Instagram'dagi post
 *    qoladi) — tasdiqlash oynasida shu ochiq aytiladi.
 * 2. <b>Media manzili ochiq HTTPS bo'lishi shart</b> — faylni Meta O'ZI yuklab oladi.
 *    CRM'ning `/uploads` papkasi login ortida (`UploadsGuard`), ya'ni u yerdagi manzil
 *    Meta uchun 404 bo'ladi. Shu sababli bu ekran fayl YUKLAMAYDI: fayl tanlansa u faqat
 *    BRAUZERDA o'lchanadi (hajm/o'lcham/davomiylik avtomatik to'ldiriladi va oldindan
 *    ko'rsatiladi), manzil esa foydalanuvchidan olinadi.
 * 3. <b>Kunlik limit endpointi har chaqirilganda Meta'ga so'rov yuboradi</b> — u AVTO-
 *    YANGILANISHGA QO'SHILMAGAN, faqat sahifa ochilganda va qo'lda «Yangilash» bosilganda.
 * 4. <b>Jami kvota noma'lum bo'lsa "noma'lum" yoziladi</b> — taxminiy 50/100 KO'RSATILMAYDI
 *    (Meta hujjatlari zid: qo'llanmada 100, namunada 50).
 *
 * ⚠️ Ro'yxat OY bo'yicha to'liq yuklanadi (kerak bo'lsa bir necha sahifa ketma-ket) va kun
 * bo'yicha KLIENTDA filtrlanadi. Sabab: kalendar katagidagi son va ostidagi ro'yxat AYNAN
 * bitta manbadan chiqsin — aks holda "raqamlar to'g'ri kelmayapti" holati kelib chiqardi.
 */
/** Bitta oyda ko'pi bilan shuncha sahifa o'qiladi (50 × 4 = 200 post). */
const MAX_PAGES = 4

export function InstagramContent() {
  const { can } = usePerm()
  const canEdit = can('marketing.content', 'edit')

  const [month, setMonth] = useState(currentMonth())
  const [day, setDay] = useState('')
  const [status, setStatus] = useState<IgPostStatus | 'all'>('all')

  const [items, setItems] = useState<IgPost[]>([])
  const [totals, setTotals] = useState<IgPostTotals | null>(null)
  const [truncated, setTruncated] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [limit, setLimit] = useState<IgPostLimit | null>(null)
  const [limitLoading, setLimitLoading] = useState(true)
  const [limitError, setLimitError] = useState('')

  const [diag, setDiag] = useState<IgContentStatus | null>(null)

  const [editing, setEditing] = useState<IgPost | null>(null)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<IgPost | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { from, to } = monthRange(month)
    try {
      const rows: IgPost[] = []
      let total = 0
      let sums: IgPostTotals | null = null
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await getIgPosts({ from, to, status, page })
        if (page === 1) {
          sums = res.totals
          total = res.total
        }
        rows.push(...res.items)
        if (res.items.length === 0 || rows.length >= res.total) break
      }
      setItems(rows)
      setTotals(sums)
      setTruncated(Math.max(0, total - rows.length))
    } catch (e) {
      setError(apiErrorMessage(e, "Rejalashtirilgan postlarni yuklab bo'lmadi"))
    } finally {
      setLoading(false)
    }
  }, [month, status])

  useEffect(() => { void load() }, [load])

  /**
   * Kunlik limit — ALOHIDA yuklanadi va qayta so'rov faqat QO'LDA.
   * ⚠️ `load()` ga qo'shilmagan: u oy/filtr o'zgarganda qayta ishlaydi, limit endpointi esa
   * har safar Meta'ga chiqadi.
   */
  const loadLimit = useCallback(async () => {
    setLimitLoading(true)
    setLimitError('')
    try {
      setLimit(await getIgContentLimit())
    } catch (e) {
      setLimitError(apiErrorMessage(e, "Kunlik limitni o'qib bo'lmadi"))
    } finally {
      setLimitLoading(false)
    }
  }, [])

  const loadDiag = useCallback(async () => {
    try {
      setDiag(await getIgContentStatus())
    } catch {
      // Diagnostika ikkinchi darajali — u yuklanmasa ham sahifa ishlayveradi.
      setDiag(null)
    }
  }, [])

  useEffect(() => { void loadLimit(); void loadDiag() }, [loadLimit, loadDiag])

  /** Kalendar kataklaridagi sonlar — AYNAN ro'yxatdagi postlardan. */
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of items) {
      const d = (p.scheduledAt || '').slice(0, 10)
      if (d) map[d] = (map[d] ?? 0) + 1
    }
    return map
  }, [items])

  /**
   * Ro'yxat — VAQT bo'yicha o'sish tartibida (ertalabdan kechgacha, 1-sanadan oxirigacha).
   * ⚠️ Boshqa ro'yxatlarda "eng yangisi tepada", bu yerda esa teskarisi: bu NAVBAT, ya'ni
   * savol "keyingi nima chiqadi" — kalendar o'qi bilan bir xil yo'nalish.
   */
  const shown = useMemo(() => {
    const rows = day ? items.filter((p) => p.scheduledAt.slice(0, 10) === day) : items
    return [...rows].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }, [items, day])

  const afterChange = async (message: string) => {
    setNotice(message)
    await load()
    await loadDiag()
  }

  const publish = async (post: IgPost) => {
    setBusy(post.id)
    setError('')
    setNotice('')
    try {
      const res = await publishIgPost(post.id)
      await afterChange(
        res.status === 'published'
          ? 'Post Instagram’ga joylandi.'
          : 'Post joylashga yuborildi — holati «Joylanmoqda». Video bir necha daqiqa olishi mumkin.',
      )
      // Joylash kvotani yeydi — limitni shu yerda yangilaymiz (avto-yangilanish yo'q).
      await loadLimit()
    } catch (e) {
      setError(apiErrorMessage(e, "Postni joylab bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  const remove = async (post: IgPost) => {
    setBusy(post.id)
    setError('')
    setNotice('')
    try {
      const res = await deleteIgPost(post.id)
      setRemoving(null)
      await afterChange(res.message)
    } catch (e) {
      setError(apiErrorMessage(e, "O'chirib bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  const monthTitle = day ? `${day.slice(8, 10)}.${day.slice(5, 7)} kuni` : 'Butun oy'

  return (
    <MarketingPage
      title="Kontent rejalashtirish"
      sub="Instagram postlarini oldindan navbatga qo'yish — rasm, video, Reels, Story va karusel"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            <Icon name="refresh" /> Yangilash
          </button>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={() => { setCreating(true); setEditing(null) }}>
              <Icon name="plus" /> Yangi post
            </button>
          )}
        </div>
      }
    >
      <div className="fade-up">
        <DiagnosticsBanners diag={diag} />

        {/* 🔴 §5.9.1 — ekranda DOIM turadi, chunki bu qaytarib bo'lmaydigan amal haqida. */}
        <div className="mk-alert">
          <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mk-alert-title">Joylangan postni CRM’dan o‘zgartirib bo‘lmaydi</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Instagram API’si joylangan postni tahrirlashni ham, o‘chirishni ham qo‘llab-quvvatlamaydi —
              matnni ham, rasmni ham faqat <b>Instagram ilovasidan</b> o‘zgartirish mumkin. Shu sababli
              tahrirlash tugmasi faqat <b>«Rejalashtirilgan»</b> postlarda ochiq. Joylangan postni bu yerda
              o‘chirsangiz — <b>faqat CRM yozuvi</b> o‘chadi, Instagram’dagi post o‘z joyida qoladi.
            </div>
          </div>
        </div>

        <LimitCard limit={limit} loading={limitLoading} error={limitError} onRefresh={() => void loadLimit()} />

        {notice && (
          <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="check" style={{ width: 17, height: 17, color: 'var(--success)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{notice}</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setNotice('')}>
              <Icon name="close" />
            </button>
          </div>
        )}

        {totals && (
          <div className="grid-stats" style={{ marginBottom: 20 }}>
            {[
              { label: 'Rejalashtirilgan', value: totals.scheduled },
              { label: 'Joylanmoqda', value: totals.processing },
              { label: 'Joylandi', value: totals.published },
              { label: 'Xato', value: totals.failed },
            ].map((s) => (
              <div className="stat" key={s.label}>
                <div className="stat-value">{s.value.toLocaleString()}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Kalendar + holat filtri */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <MonthDayStrip
            month={month}
            onMonthChange={(m) => { setMonth(m); setDay('') }}
            selected={day}
            onSelect={setDay}
            counts={counts}
            hint="Katakdagi son — o‘sha kunga rejalashtirilgan postlar. Kun bosilsa faqat o‘sha kun ko‘rsatiladi, qayta bosilsa butun oy qaytadi."
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <div className="seg">
              <button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Hammasi</button>
              {IG_POST_STATUSES.map((s) => (
                <button key={s.id} className={status === s.id ? 'active' : ''} onClick={() => setStatus(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            {day && (
              <button className="btn btn-outline btn-sm" onClick={() => setDay('')}>
                <Icon name="close" /> Kun filtri
              </button>
            )}
          </div>
        </div>

        {loading && <MkLoading />}
        {!loading && error && <MkError text={error} onRetry={() => void load()} />}

        {!loading && !error && (
          <div className="card card-pad">
            <div className="section-head">
              <div>
                <div className="section-title">Navbat — {monthTitle}</div>
                <div className="page-sub">Vaqt bo‘yicha o‘sish tartibida: keyin nima chiqishi tepadan pastga o‘qiladi</div>
              </div>
              <div className="feed-time">{shown.length} ta</div>
            </div>

            {truncated > 0 && (
              <div className="field-hint" style={{ marginBottom: 10 }}>
                Bu oyda postlar ko‘p: yana {truncated} tasi ro‘yxatga sig‘madi. Kerakli kunni kalendardan
                tanlang yoki holat filtridan foydalaning.
              </div>
            )}

            {shown.length === 0
              ? (
                <MkEmpty
                  text="Bu davrda post yo‘q"
                  hint={canEdit
                    ? 'Yuqoridagi «Yangi post» tugmasi bilan reja qo‘shing.'
                    : 'Reja qo‘shish uchun «Kontent rejalashtirish» bo‘limida tahrirlash ruxsati kerak.'}
                />
              )
              : shown.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  canEdit={canEdit}
                  busy={busy === p.id}
                  onEdit={() => { setEditing(p); setCreating(false) }}
                  onPublish={() => void publish(p)}
                  onDelete={() => setRemoving(p)}
                />
              ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <PostModal
          post={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={async (message) => {
            setCreating(false)
            setEditing(null)
            await afterChange(message)
          }}
        />
      )}

      {removing && (
        <DeleteConfirm
          post={removing}
          busy={busy === removing.id}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove(removing)}
        />
      )}
    </MarketingPage>
  )
}

/* ═══════════════════════════════════════ DIAGNOSTIKA ═══════════════════════════════════════ */

/**
 * "Nega post chiqmayapti" savolining eng ko'p uchraydigan sabablari.
 *
 * ⚠️ `scopeGranted === null` — "noma'lum" (berilgan OAuth ruxsatlari saqlanmaydi). Yolg'on
 * "ha" dan ko'ra ochiq "noma'lum" yaxshi, shuning uchun bu holatda maslahat ko'rsatiladi,
 * xato emas.
 */
function DiagnosticsBanners({ diag }: { diag: IgContentStatus | null }) {
  if (!diag) return null
  return (
    <>
      {!diag.accountConnected && (
        <div className="mk-alert mk-alert-danger">
          <Icon name="unlink" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mk-alert-title">Instagram akkaunti ulanmagan</div>
            <div style={{ fontSize: 12.5 }}>
              Post joylash uchun Marketing → Sozlamalar bo‘limida akkauntni ulang.
            </div>
          </div>
        </div>
      )}

      {diag.accountConnected && !diag.enabled && (
        <div className="mk-alert mk-alert-danger">
          <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mk-alert-title">Chop etish moduli o‘chiq</div>
            <div style={{ fontSize: 12.5 }}>
              Reja saqlanadi, lekin <b>hech qanday post joylanmaydi</b>. Marketing → Sozlamalar bo‘limidan
              «Instagram’ga post joylash» ni yoqing.
            </div>
          </div>
        </div>
      )}

      {diag.accountConnected && diag.scopeGranted !== true && (
        <div className="mk-alert">
          <Icon name="link" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mk-alert-title">Chop etish ruxsati (scope) noma’lum</div>
            <div style={{ fontSize: 12.5 }}>
              Post joylash uchun <code>{diag.publishScope}</code> ruxsati kerak va u <b>qayta ulanish</b>
              orqali beriladi. Agar postlar «Xato» bo‘lib qolayotgan bo‘lsa — Sozlamalardagi «Qayta ulash»
              ni bosing va Instagram so‘ragan ruxsatlarni tasdiqlang.
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════ KUNLIK LIMIT ═══════════════════════════════════════ */

/**
 * Meta'ning kunlik chop etish kvotasi.
 *
 * 🔴 Jami kvota noma'lum bo'lsa (`unknown` yoki `total === 0`) ekranda AYNAN "noma'lum"
 * yoziladi. Taxminiy 50/100 chiqarish MUMKIN EMAS: Meta hujjatlari o'zaro zid, noto'g'ri
 * raqam esa "yana 40 ta post joylasam bo'ladi" deb chalg'itardi.
 *
 * ⚠️ Bu ma'lumot Meta'dan so'raladi, shuning uchun avtomatik yangilanmaydi — faqat qo'lda.
 */
function LimitCard({
  limit, loading, error, onRefresh,
}: {
  limit: IgPostLimit | null
  loading: boolean
  error: string
  onRefresh: () => void
}) {
  const unknown = !limit || limit.unknown || limit.total <= 0
  const pct = !unknown && limit ? Math.min(100, Math.round((limit.usage / limit.total) * 100)) : 0

  return (
    <div className="card card-pad" style={{ marginBottom: 18 }}>
      <div className="section-head">
        <div>
          <div className="section-title">Kunlik chop etish limiti</div>
          <div className="page-sub">Instagram sutkada nechta post qabul qilishini o‘zi belgilaydi</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
          <Icon name="refresh" /> {loading ? 'So‘ralmoqda…' : 'Yangilash'}
        </button>
      </div>

      {error && <MkError text={error} onRetry={onRefresh} />}

      {!error && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div className="stat-value" style={{ margin: 0 }}>{limit ? limit.usage : '—'}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
              / {unknown ? 'noma’lum' : limit?.total}
            </div>
            {limit?.text && <div className="feed-time">{limit.text}</div>}
          </div>

          {!unknown && (
            <div className="progress-track" style={{ marginTop: 10 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: '#0284c7' }} />
            </div>
          )}

          <div className="field-hint" style={{ marginTop: 8 }}>
            {unknown
              ? 'Instagram jami kvotani bermadi — bu son noma’lum. Taxminiy raqam ataylab ko‘rsatilmaydi: Meta hujjatlarida 50 va 100 deb zid yozilgan, noto‘g‘ri son esa chalg‘itadi. Limit to‘lsa post «Rejalashtirilgan» bo‘lib qoladi va kvota bo‘shashi bilan avtomatik joylanadi.'
              : 'Karusel — 1 ta post hisoblanadi. Limit to‘lsa post «Rejalashtirilgan» bo‘lib qoladi va kvota bo‘shashi bilan avtomatik joylanadi.'}
          </div>
          <div className="field-hint">
            ⚠️ Bu son Instagram’dan so‘raladi va o‘zi yangilanmaydi — kerak bo‘lganda «Yangilash» ni bosing.
          </div>
        </>
      )}

      {limit?.error && <div className="field-hint" style={{ color: 'var(--danger)' }}>{limit.error}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════ NAVBAT QATORI ═══════════════════════════════════════ */

const STATUS_STYLE: Record<IgPostStatus, { bg: string; color: string; icon: string }> = {
  scheduled: { bg: 'var(--primary-soft)', color: 'var(--primary)', icon: 'clock' },
  processing: { bg: 'var(--warning-soft)', color: 'var(--warning)', icon: 'refresh' },
  published: { bg: 'var(--success-soft)', color: 'var(--success)', icon: 'check' },
  failed: { bg: 'var(--danger-soft)', color: 'var(--danger)', icon: 'warn' },
  cancelled: { bg: 'var(--surface-2)', color: 'var(--text-3)', icon: 'close' },
}

/**
 * Bitta reja qatori.
 *
 * ⚠️ Tahrirlash tugmasi faqat `scheduled` holatda ochiq (backend ham 400 qaytaradi, lekin
 * foydalanuvchi buni tugmani bosishdan OLDIN ko'rishi kerak — aks holda "o'zgartirdim" deb
 * o'ylab qolardi).
 */
function PostRow({
  post, canEdit, busy, onEdit, onPublish, onDelete,
}: {
  post: IgPost
  canEdit: boolean
  busy: boolean
  onEdit: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  const st = STATUS_STYLE[post.status] ?? STATUS_STYLE.scheduled
  const editable = isEditable(post)
  const first = post.media[0]
  const when = (post.scheduledAt || '').replace('T', ' ').slice(0, 16)

  return (
    <div className="feed-item" style={{ alignItems: 'flex-start' }}>
      <div className="rule-num" style={{ background: st.bg, color: st.color }}>
        <Icon name={st.icon} style={{ width: 14, height: 14 }} />
      </div>

      <div className="feed-body" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{post.postTypeLabel}</span>
          <span
            className="badge"
            style={{ background: st.bg, color: st.color }}
          >
            {post.statusLabel}
          </span>
          {post.media.length > 1 && <span className="match-pill">{post.media.length} ta element</span>}
          {post.attempts > 0 && post.status !== 'published' && (
            <span className="match-pill">{post.attempts}-urinish</span>
          )}
        </div>

        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45, color: 'var(--text-2)' }}>
          {post.caption ? trim(post.caption, 160) : <i>matnsiz post</i>}
        </div>

        <div className="page-sub" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          <span><Icon name="clock" style={{ width: 12, height: 12, verticalAlign: -1 }} /> {when}</span>
          {first?.url && <span style={{ wordBreak: 'break-all' }}>· {trim(first.url, 60)}</span>}
          {post.createdBy && <span>· {post.createdBy}</span>}
        </div>

        {post.status === 'processing' && (
          <div className="field-hint">
            Meta media konteynerini tayyorlamoqda{post.containerStatus ? ` (${post.containerStatus})` : ''} —
            video uchun bu bir necha daqiqa davom etadi.
          </div>
        )}

        {post.error && (
          <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12.5, lineHeight: 1.45 }}>
            {post.error}
          </div>
        )}

        {post.permalink && (
          <a
            className="link-btn" href={post.permalink} target="_blank" rel="noreferrer"
            style={{ marginTop: 6 }}
          >
            <Icon name="link" style={{ width: 13, height: 13 }} /> Instagram’da ochish
          </a>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        {canEdit && (
          <>
            <button
              className="btn btn-outline btn-sm"
              onClick={onEdit}
              disabled={!editable}
              title={editable
                ? 'Tahrirlash'
                : 'Faqat «Rejalashtirilgan» post tahrirlanadi — joylangan postni Instagram API’si o‘zgartirishga ruxsat bermaydi'}
            >
              <Icon name="edit" /> Tahrirlash
            </button>

            {(post.status === 'scheduled' || post.status === 'failed') && (
              <button className="btn btn-ghost btn-sm" onClick={onPublish} disabled={busy}>
                <Icon name={post.status === 'failed' ? 'refresh' : 'send'} />
                {busy ? 'Yuborilmoqda…' : post.status === 'failed' ? 'Qayta urinish' : 'Hoziroq joylash'}
              </button>
            )}

            <button className="btn btn-ghost btn-sm" onClick={onDelete} disabled={busy}>
              <Icon name="trash" /> {post.status === 'scheduled' ? 'Bekor qilish' : 'O‘chirish'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ O'CHIRISH TASDIQI ═══════════════════════════════════════ */

/**
 * ⚠️ Joylangan postda o'chirish MA'NOSI BOSHQACHA — Instagram'dagi post QOLADI, faqat CRM
 * yozuvi o'chadi. Bu tasdiqlash oynasida OCHIQ yoziladi (§5.9), aks holda admin "o'chirdim"
 * deb o'ylab, post profilda turaverardi.
 */
function DeleteConfirm({
  post, busy, onCancel, onConfirm,
}: {
  post: IgPost
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const published = post.status === 'published'
  const cancelOnly = post.status === 'scheduled'

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{cancelOnly ? 'Postni bekor qilish' : 'Yozuvni o‘chirish'}</div>
          <button className="icon-btn" onClick={onCancel}><Icon name="close" style={{ width: 18, height: 18 }} /></button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <b>{post.postTypeLabel}</b> · {(post.scheduledAt || '').replace('T', ' ').slice(0, 16)}
          </div>

          {cancelOnly && (
            <div className="field-hint" style={{ marginTop: 10 }}>
              Post navbatdan chiqadi va Instagram’ga joylanmaydi. Yozuv tarixda «Bekor qilingan» bo‘lib qoladi.
            </div>
          )}

          {published && (
            <div className="mk-alert mk-alert-danger" style={{ marginTop: 14, marginBottom: 0 }}>
              <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                <div className="mk-alert-title">Instagram’dagi post O‘CHMAYDI</div>
                Bu amal <b>faqat CRM yozuvini</b> o‘chiradi. Post Instagram profilida o‘z joyida qoladi —
                uni faqat <b>Instagram ilovasidan</b> o‘chirish mumkin (API bunga ruxsat bermaydi).
                O‘chirilgandan keyin post bu ro‘yxatda va hisobotlarda ko‘rinmaydi.
              </div>
            </div>
          )}

          {!published && !cancelOnly && (
            <div className="field-hint" style={{ marginTop: 10 }}>
              Yozuv butunlay o‘chadi. Instagram’ga hech narsa joylanmagan.
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            <Icon name={cancelOnly ? 'close' : 'trash'} />
            {busy ? 'Bajarilmoqda…' : cancelOnly ? 'Ha, bekor qilinsin' : 'Ha, yozuv o‘chirilsin'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ POST MODALI ═══════════════════════════════════════ */

/** Post turiga qarab media 9:16 bo'lishi kerakmi (preview ramkasi ham shunga qarab chiziladi). */
function isVertical(type: IgPostType): boolean {
  return type === 'story' || type === 'reels' || type === 'video'
}

/**
 * Yangi post / tahrirlash oynasi.
 *
 * ⚠️ MEDIA YUKLANMAYDI. Instagram faylni O'ZI yuklab oladi, ya'ni manzil ochiq HTTPS bo'lishi
 * shart; CRM'ning `/uploads` papkasi esa login ortida. Shuning uchun bu yerda manzil qo'lda
 * kiritiladi, tanlangan fayl esa faqat BRAUZERDA o'lchanadi (hajm, o'lcham, davomiylik) —
 * bu qiymatlar serverga tekshiruv uchun yuboriladi va xato 10 daqiqalik poll'dan keyin emas,
 * SHU YERDA ko'rinadi.
 *
 * ⚠️ O'lchamlar 0 = "noma'lum" — backend bunday holatda tekshiruvni o'tkazib yuboradi. Shu
 * sababli taxminiy qiymat yozilmaydi: noto'g'ri son to'g'ri media'ni bekorga rad etardi.
 */
function PostModal({
  post, onClose, onSaved,
}: {
  post: IgPost | null
  onClose: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const [type, setType] = useState<IgPostType>(post?.postType ?? 'image')
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [media, setMedia] = useState<IgMediaItem[]>(
    post && post.media.length > 0 ? post.media.map((m) => ({ ...m })) : [emptyMedia('image')],
  )
  const [options, setOptions] = useState<IgPostOptions>(
    post ? { ...post.options, collaborators: [...post.options.collaborators] } : emptyOptions(),
  )
  const [at, setAt] = useState((post?.scheduledAt ?? '').slice(0, 16))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const chars = caption.length
  const tags = countHashtags(caption)
  const mentions = countMentions(caption)

  /** Tur o'zgarganda media ro'yxati va turi moslashtiriladi (karuselda kamida 2 ta element). */
  const changeType = (next: IgPostType) => {
    setType(next)
    setMedia((prev) => {
      const kind = defaultKind(next)
      // ⚠️ Story va karusel IKKALA turni ham qabul qiladi — u yerda foydalanuvchi tanlovi
      // saqlanadi. Qolgan turlarda tur bir xil (reels/video — video, rasm — rasm).
      const keepKind = next === 'story' || next === 'carousel'
      const rows = prev.map((m) => (keepKind ? m : { ...m, kind }))
      if (next === 'carousel') {
        while (rows.length < IG_LIMITS.carouselItems.min) rows.push(emptyMedia('image'))
        return rows.slice(0, IG_LIMITS.carouselItems.max)
      }
      return rows.slice(0, 1)
    })
  }

  const patchMedia = (index: number, patch: Partial<IgMediaItem>) => {
    setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  /** Klientdagi tekshiruv — SERVERNIKINI almashtirmaydi, faqat oldindan ogohlantiradi. */
  const localError = useMemo(() => {
    if (chars > IG_LIMITS.captionChars) return `Matn juda uzun: ${chars} belgi (ruxsat ${IG_LIMITS.captionChars}).`
    if (tags > IG_LIMITS.hashtags) return `Hashtag ko‘p: ${tags} ta (ruxsat ${IG_LIMITS.hashtags}).`
    if (mentions > IG_LIMITS.mentions) return `Mention ko‘p: ${mentions} ta (ruxsat ${IG_LIMITS.mentions}).`

    if (type === 'carousel') {
      if (media.length < IG_LIMITS.carouselItems.min || media.length > IG_LIMITS.carouselItems.max) {
        return `Karuselda ${IG_LIMITS.carouselItems.min}–${IG_LIMITS.carouselItems.max} ta element bo‘lishi kerak (hozir ${media.length}).`
      }
      const withCaption = media.findIndex((m) => m.caption.trim().length > 0)
      if (withCaption >= 0) {
        return `${withCaption + 1}-elementga matn yozilgan: karusel elementlarida matn ishlamaydi, uni umumiy matn maydoniga yozing.`
      }
    }

    for (let i = 0; i < media.length; i++) {
      const m = media[i]
      const prefix = media.length > 1 ? `${i + 1}-element: ` : ''
      if (!m.url.trim()) return `${prefix}media manzili bo‘sh.`
      if (!isHttpsUrl(m.url)) return `${prefix}manzil ochiq HTTPS bo‘lishi shart — Instagram faylni o‘zi yuklab oladi.`
      if (m.kind === 'image' && !isJpegUrl(m.url)) return `${prefix}rasm faqat JPEG bo‘lishi kerak (.jpg yoki .jpeg).`
      if (m.kind === 'video' && !isVideoUrl(m.url)) return `${prefix}video faqat MP4 yoki MOV bo‘lishi kerak.`
      if (m.coverUrl && !isHttpsUrl(m.coverUrl)) return `${prefix}muqova manzili ham HTTPS bo‘lishi kerak.`
    }
    return ''
  }, [chars, tags, mentions, type, media])

  const save = async () => {
    if (localError) { setError(localError); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        postType: type,
        caption,
        media: type === 'carousel' ? media : media.slice(0, 1),
        options,
        // Bo'sh bo'lsa backend "hozir" deb oladi — post keyingi worker tsiklida joylanadi.
        scheduledAt: at ? `${at}:00` : '',
      }
      if (post) {
        await updateIgPost(post.id, payload)
        await onSaved('Reja yangilandi.')
      } else {
        await createIgPost(payload)
        await onSaved('Post navbatga qo‘shildi.')
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{post ? 'Rejani tahrirlash' : 'Yangi post'}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" style={{ width: 18, height: 18 }} /></button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 22 }}>
          {/* ── CHAP: forma ── */}
          <div style={{ minWidth: 0 }}>
            <div className="field">
              <label className="field-label">Post turi</label>
              <div className="tone-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {IG_POST_TYPES.map((t) => (
                  <div
                    key={t.id}
                    className={`tone-opt${type === t.id ? ' sel' : ''}`}
                    onClick={() => changeType(t.id)}
                  >
                    <div className="tone-name">{t.label}</div>
                    <div className="tone-desc">{t.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <MediaRequirements type={type} />

            <div className="field">
              <label className="field-label">
                Media {type === 'carousel' && <span className="field-hint" style={{ display: 'inline' }}>
                  ({media.length} / {IG_LIMITS.carouselItems.max})
                </span>}
              </label>

              {media.map((m, i) => (
                <MediaEditor
                  key={i}
                  item={m}
                  index={i}
                  showIndex={type === 'carousel'}
                  type={type}
                  onChange={(patch) => patchMedia(i, patch)}
                  onRemove={media.length > 1 ? () => setMedia((prev) => prev.filter((_, k) => k !== i)) : undefined}
                />
              ))}

              {type === 'carousel' && media.length < IG_LIMITS.carouselItems.max && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setMedia((prev) => [...prev, emptyMedia('image')])}
                >
                  <Icon name="plus" /> Element qo‘shish
                </button>
              )}
            </div>

            <div className="field">
              <label className="field-label">Post matni (caption)</label>
              <textarea
                className="textarea"
                value={caption}
                rows={6}
                placeholder="Postning matni, hashtaglar bilan…"
                onChange={(e) => setCaption(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                <Counter label="belgi" value={chars} max={IG_LIMITS.captionChars} />
                <Counter label="hashtag" value={tags} max={IG_LIMITS.hashtags} />
                <Counter label="mention" value={mentions} max={IG_LIMITS.mentions} />
              </div>
              {type === 'carousel' && (
                <div className="field-hint">
                  ⚠️ Karuselda matn faqat SHU maydondan olinadi — alohida elementlarga yozilgan matn
                  Instagram’da ko‘rinmaydi.
                </div>
              )}
            </div>

            <div className="field">
              <label className="field-label">Joylash vaqti</label>
              <input
                className="input"
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
              <div className="field-hint">
                Bo‘sh qoldirilsa post navbatning keyingi aylanishida (bir daqiqa ichida) joylanadi.
                Vaqt CRM navbatida saqlanadi — Instagram’da hech narsa oldindan band qilinmaydi, shuning
                uchun vaqtni istagancha o‘zgartirsa bo‘ladi.
              </div>
            </div>

            {(type === 'reels' || type === 'video') && (
              <div className="row-between">
                <div>
                  <div className="opt-name">Lentaga ham chiqarilsin</div>
                  <div className="opt-desc">Reels profil lentasida ham ko‘rinadi (share_to_feed).</div>
                </div>
                <div
                  className={`switch${options.shareToFeed ? ' on' : ''}`}
                  onClick={() => setOptions({ ...options, shareToFeed: !options.shareToFeed })}
                />
              </div>
            )}

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Qo‘shimcha sozlamalar</summary>
              <div style={{ marginTop: 14 }}>
                <div className="field">
                  <label className="field-label">Hammualliflar (collaborators)</label>
                  <input
                    className="input"
                    value={options.collaborators.join(', ')}
                    placeholder="username1, username2"
                    onChange={(e) => setOptions({
                      ...options,
                      collaborators: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                  <div className="field-hint">
                    Ko‘pi bilan {IG_LIMITS.collaborators} ta. ⚠️ Ular taklifni Instagram’da <b>qabul qilishi</b> kerak —
                    aks holda post faqat sizning profilingizda qoladi.
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Joylashuv ID (location_id)</label>
                  <input
                    className="input"
                    value={options.locationId}
                    placeholder="Ixtiyoriy — Facebook Page joylashuv ID’si"
                    onChange={(e) => setOptions({ ...options, locationId: e.target.value })}
                  />
                </div>

                {(type === 'reels' || type === 'video') && (
                  <div className="field">
                    <label className="field-label">Audio nomi (Reels)</label>
                    <input
                      className="input"
                      value={options.audioName}
                      onChange={(e) => setOptions({ ...options, audioName: e.target.value })}
                    />
                    <div className="field-hint">⚠️ Instagram’da audio nomini keyin faqat BIR MARTA o‘zgartirish mumkin.</div>
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* ── O'NG: Instagram ko'rinishi ── */}
          <div>
            <div className="field-label">Instagram’da qanday ko‘rinadi</div>
            <IgPreview type={type} media={media} caption={caption} />
          </div>
        </div>

        <div className="modal-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          {/* Server xatosi — QIZIL. To'ldirilmagan joy esa hali XATO emas: u shunchaki
              "saqlash uchun nima yetishmayapti" degan maslahat (yangi oyna ochilishi bilan
              qizil blok chiqishi bekorga qo'rqitardi). */}
          {error && (
            <div className="mk-state mk-state-error" style={{ padding: 12 }}>
              <Icon name="warn" style={{ width: 17, height: 17, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          {!error && localError && (
            <div className="field-hint" style={{ margin: 0 }}>Saqlash uchun: {localError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Bekor qilish</button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !!localError}>
              <Icon name="check" /> {saving ? 'Saqlanmoqda…' : post ? 'Saqlash' : 'Navbatga qo‘shish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Chegara sanagichi — oshib ketsa qizil bo'ladi (backend baribir rad etadi). */
function Counter({ label, value, max }: { label: string; value: number; max: number }) {
  const over = value > max
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: over ? 'var(--danger)' : 'var(--text-3)' }}>
      {value} / {max} {label}
    </span>
  )
}

/**
 * 🔴 §5.5 + §5.6 — media talablari OCHIQ yoziladi.
 * Sabab: bu qoidalar buzilsa Meta xatoni faqat konteyner tayyorlangandan keyin qaytaradi,
 * ya'ni post o'z vaqtida chiqmasdi va nima uchunligi kech ma'lum bo'lardi.
 */
function MediaRequirements({ type }: { type: IgPostType }) {
  const lines: string[] = [
    'Media manzili ochiq HTTPS bo‘lishi SHART — Instagram faylni o‘zi yuklab oladi, shuning uchun login, IP cheklov va yo‘naltirish (redirect) ishlamaydi.',
  ]
  if (type === 'image' || type === 'carousel') {
    lines.push(`Rasm — faqat JPEG (.jpg/.jpeg), ≤${IG_LIMITS.imageMb} MB, kenglik ${IG_LIMITS.feedWidth.min}–${IG_LIMITS.feedWidth.max} px, nisbat 4:5 – 1.91:1.`)
  }
  if (type === 'reels' || type === 'video') {
    lines.push(`Reels/video — MP4 yoki MOV, ≤${IG_LIMITS.reelsMb} MB, ${IG_LIMITS.reelsSeconds.min}–${IG_LIMITS.reelsSeconds.max} soniya, 9:16 (masalan 1080×1920).`)
  }
  if (type === 'story') {
    lines.push(`Story — 9:16. Rasm: JPEG ≤${IG_LIMITS.imageMb} MB. Video: MP4/MOV ≤${IG_LIMITS.storyVideoMb} MB, ${IG_LIMITS.storyVideoSeconds.min}–${IG_LIMITS.storyVideoSeconds.max} soniya.`)
  }
  if (type === 'carousel') {
    lines.push(`Karusel — ${IG_LIMITS.carouselItems.min}–${IG_LIMITS.carouselItems.max} ta element; qolganlari birinchi elementning nisbatiga qirqiladi.`)
  }

  return (
    <div className="mk-alert" style={{ marginBottom: 18 }}>
      <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <div className="mk-alert-title">Media talablari</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </div>
  )
}

/**
 * Bitta media elementi: manzil + texnik ma'lumot.
 *
 * ⚠️ «Fayldan o'lchash» fayl YUKLAMAYDI — u faqat brauzerda hajm/o'lcham/davomiylikni o'lchaydi
 * va shu maydonlarni to'ldiradi. Fayl serverga ketmaydi, chunki CRM'ning `/uploads` manzili
 * login ortida va Meta uni yuklab ola olmasdi (§5.6): fayl ochiq HTTPS hostda turishi kerak.
 */
function MediaEditor({
  item, index, showIndex, type, onChange, onRemove,
}: {
  item: IgMediaItem
  index: number
  showIndex: boolean
  type: IgPostType
  onChange: (patch: Partial<IgMediaItem>) => void
  onRemove?: () => void
}) {
  const [measuring, setMeasuring] = useState(false)
  const [measureError, setMeasureError] = useState('')

  const measure = async (file: File) => {
    setMeasuring(true)
    setMeasureError('')
    try {
      const info = await measureLocalFile(file)
      onChange(info)
    } catch (e) {
      setMeasureError(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi")
    } finally {
      setMeasuring(false)
    }
  }

  const urlOk = item.url.trim().length === 0 || isHttpsUrl(item.url)

  return (
    <div className="mk-kb-item">
      <div className="mk-kb-head">
        <span className="rule-num">{showIndex ? index + 1 : <Icon name="link" style={{ width: 13, height: 13 }} />}</span>
        <div className="seg">
          {(['image', 'video'] as IgMediaKind[]).map((k) => (
            <button
              key={k}
              className={item.kind === k ? 'active' : ''}
              onClick={() => onChange({ kind: k })}
              disabled={mediaKindLocked(type, k)}
            >
              {k === 'image' ? 'Rasm' : 'Video'}
            </button>
          ))}
        </div>
        {onRemove && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onRemove}>
            <Icon name="trash" /> Olib tashlash
          </button>
        )}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <input
          className="input"
          value={item.url}
          placeholder="https://…/rasm.jpg"
          onChange={(e) => onChange({ url: e.target.value })}
          style={urlOk ? undefined : { borderColor: 'var(--danger)' }}
        />
        <div className="field-hint">
          Ochiq HTTPS manzil. ⚠️ CRM ichidagi <code>/uploads/…</code> manzillari <b>ishlamaydi</b> — ular
          login ortida, Instagram esa faylni tashqaridan yuklab oladi.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
          <Icon name="search" />
          {measuring ? 'O‘lchanmoqda…' : 'Fayldan o‘lchash'}
          <input
            type="file"
            accept="image/jpeg,video/mp4,video/quicktime"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void measure(f)
              e.target.value = ''
            }}
          />
        </label>
        <span className="field-hint" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          Fayl <b>yuklanmaydi</b> — faqat hajmi, o‘lchami va davomiyligi o‘lchanib, quyidagi maydonlarga
          yoziladi. Shu tufayli xato Instagram’dan emas, shu yerda ko‘rinadi.
        </span>
      </div>

      {measureError && <div className="field-hint" style={{ color: 'var(--danger)' }}>{measureError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
        <NumField label="Kenglik, px" value={item.width} onChange={(v) => onChange({ width: v })} />
        <NumField label="Balandlik, px" value={item.height} onChange={(v) => onChange({ height: v })} />
        <NumField label="Hajm, bayt" value={item.sizeBytes} onChange={(v) => onChange({ sizeBytes: v })} />
        <NumField
          label="Davomiylik, s"
          value={item.durationSeconds}
          onChange={(v) => onChange({ durationSeconds: v })}
          disabled={item.kind !== 'video'}
        />
      </div>
      <div className="field-hint">
        0 = <b>noma’lum</b>: bunday maydon tekshirilmaydi. Taxminiy son yozmang — noto‘g‘ri qiymat
        to‘g‘ri media’ni bekorga rad etadi.
      </div>

      {item.kind === 'video' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <label className="field-label">Muqova manzili (ixtiyoriy)</label>
            <input
              className="input"
              value={item.coverUrl}
              placeholder="https://…/muqova.jpg"
              onChange={(e) => onChange({ coverUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Muqova kadri, ms</label>
            <input
              className="input"
              type="number"
              value={item.thumbOffsetMs < 0 ? '' : item.thumbOffsetMs}
              placeholder="berilmagan"
              onChange={(e) => onChange({ thumbOffsetMs: e.target.value === '' ? -1 : Number(e.target.value) })}
            />
            <div className="field-hint">Bo‘sh = berilmagan; 0 = birinchi kadr.</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <label className="field-label">Alt matn (ko‘rish imkoniyati cheklanganlar uchun)</label>
        <input
          className="input"
          value={item.altText}
          maxLength={IG_LIMITS.altTextChars}
          onChange={(e) => onChange({ altText: e.target.value })}
        />
      </div>
    </div>
  )
}

/**
 * Post turida shu media turi TAQIQLANGANMI.
 *
 * ⚠️ Story ham, KARUSEL ham rasm va videoni birga qabul qiladi (backend `ValidateMedia`
 * ikkalasini ham o'tkazadi) — shuning uchun u yerda hech narsa bloklanmaydi. Reels/video esa
 * faqat video, oddiy rasm posti esa faqat rasm.
 */
function mediaKindLocked(type: IgPostType, kind: IgMediaKind): boolean {
  if (type === 'reels' || type === 'video') return kind === 'image'
  if (type === 'image') return kind === 'video'
  return false
}

/** Butun son maydoni: bo'sh — 0 ("noma'lum"). */
function NumField({
  label, value, onChange, disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="field-label" style={{ fontSize: 11.5 }}>{label}</label>
      <input
        className="input"
        type="number"
        min={0}
        disabled={disabled}
        value={value === 0 ? '' : value}
        placeholder="noma’lum"
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </div>
  )
}

/**
 * Instagram ko'rinishining SODDA maketi: kvadrat (lenta) yoki 9:16 (story/reels) ramka +
 * matn. Maqsad — nisbatni va matnning qirqilishini oldindan ko'rsatish, piksel-aniq nusxa
 * yasash emas.
 */
function IgPreview({ type, media, caption }: { type: IgPostType; media: IgMediaItem[]; caption: string }) {
  const vertical = isVertical(type)
  const first = media[0]
  const show = first?.url && isHttpsUrl(first.url)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div className="ch-icon ch-instagram" style={{ width: 24, height: 24, borderRadius: 7 }}>
          <Icon name="user" style={{ width: 13, height: 13 }} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>markazingiz</div>
        {media.length > 1 && <span className="match-pill" style={{ marginLeft: 'auto' }}>1/{media.length}</span>}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: vertical ? '9 / 16' : '1 / 1',
          background: 'var(--surface-3)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {show && first.kind === 'image' && (
          <img src={first.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {show && first.kind === 'video' && (
          <video
            src={first.url}
            poster={first.coverUrl || undefined}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {!show && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 16 }}>
            <Icon name="link" style={{ width: 22, height: 22 }} />
            <div style={{ marginTop: 6 }}>Media manzili kiritilmagan</div>
          </div>
        )}
        {type === 'story' && (
          <div className="badge" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.5)', color: '#fff' }}>
            Story · 24 soat
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {caption
          ? <><b>markazingiz</b> {trim(caption, 220)}</>
          : <span style={{ color: 'var(--text-3)' }}>Matn kiritilmagan</span>}
      </div>

      <div className="field-hint" style={{ padding: '0 12px 12px' }}>
        ⚠️ Bu taxminiy ko‘rinish. Haqiqiy natijada Instagram rasmni o‘z nisbatiga qirqishi va sRGB
        bo‘lmagan ranglarni o‘zgartirishi mumkin.
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ YORDAMCHILAR ═══════════════════════════════════════ */

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * Tanlangan faylni BRAUZERDA o'lchaydi (serverga YUBORMAYDI).
 *
 * ⚠️ `URL.createObjectURL` bilan yaratilgan manzil har holatda `revokeObjectURL` bilan
 * bo'shatiladi — aks holda katta video butun sessiya davomida xotirada qolardi.
 */
async function measureLocalFile(file: File): Promise<Partial<IgMediaItem>> {
  const isVideo = file.type.startsWith('video/')
  const src = URL.createObjectURL(file)
  try {
    if (isVideo) {
      const el = document.createElement('video')
      el.preload = 'metadata'
      await loadMedia(el, src)
      return {
        kind: 'video',
        sizeBytes: file.size,
        width: el.videoWidth,
        height: el.videoHeight,
        durationSeconds: Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : 0,
      }
    }
    const img = new Image()
    await loadMedia(img, src)
    return {
      kind: 'image',
      sizeBytes: file.size,
      width: img.naturalWidth,
      height: img.naturalHeight,
      durationSeconds: 0,
    }
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** `load`/`error` hodisalarini Promise'ga o'raydi (video uchun `loadedmetadata`). */
function loadMedia(el: HTMLImageElement | HTMLVideoElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => resolve()
    const fail = () => reject(new Error("Faylni o'qib bo'lmadi — format qo'llab-quvvatlanmaydi."))
    if (el instanceof HTMLVideoElement) el.addEventListener('loadedmetadata', ok, { once: true })
    else el.addEventListener('load', ok, { once: true })
    el.addEventListener('error', fail, { once: true })
    el.src = src
  })
}
