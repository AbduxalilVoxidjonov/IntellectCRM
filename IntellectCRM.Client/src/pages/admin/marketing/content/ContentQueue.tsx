/**
 * MARKETING → KONTENT → «NAVBAT» (bo'limning asosiy sahifasi).
 *
 * Sahifa BITTA savolga javob beradi: <b>qaysi kunda nima chiqadi va nima qilish kerak</b>.
 *
 * ⚠️ ASOSIY TUZOQLAR (§5.9 — ekranda ham OCHIQ yozilgan, olib tashlanmaydi):
 * 1. <b>Joylangan postni CRM'dan tahrirlab ham, o'chirib ham bo'lmaydi</b> — Instagram API'si
 *    buni qo'llab-quvvatlamaydi. Shuning uchun «Tahrirlash» faqat `scheduled` holatda ochiq,
 *    o'chirish esa joylangan postda FAQAT CRM yozuvini o'chiradi (Instagram'dagi post qoladi).
 * 2. <b>Ro'yxat OY bo'yicha to'liq yuklanadi</b> va kun bo'yicha KLIENTDA filtrlanadi
 *    (`loadAllPosts`): kalendar katagidagi son va ostidagi ro'yxat AYNAN bitta manbadan
 *    chiqsin — aks holda "raqamlar to'g'ri kelmayapti" holati kelib chiqardi.
 * 3. <b>Tartib O'SISH bo'yicha</b> — pastga qarab kelajakka. Boshqa ro'yxatlardagi
 *    "eng yangisi tepada" qoidasi bu yerda ATAYIN teskari (izoh `groupByDay` da ham bor).
 *
 * ⚠️ Bu sahifa `MarketingPage` ni CHIZMAYDI — sarlavha, «Yangilash» va «Yangi post» tugmalari
 * `ContentLayout` da (u sub-nav bilan birga o'rovchi vazifasini bajaradi).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { MonthDayStrip } from '@/components/ui/MonthDayStrip'
import { currentMonth, monthRange } from '@/lib/month'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  deleteIgPost, isEditable, isHttpsUrl, publishIgPost,
  IG_POST_STATUSES,
  type IgPost, type IgPostStatus, type IgPostTotals,
} from '@/api/services/instagramContent'
import { Icon, MkCard, MkDialog, MkEmpty, MkError, MkLoading, MkNotice, MkStat } from '../mk'
import {
  STATUS_STYLE, countsByDay, fmtDayTitle, fmtTime, groupByDay, loadAllPosts, postTypeIcon, trim,
} from './helpers'
import type { ContentOutlet } from './ContentLayout'

export function ContentQueue() {
  const { can } = usePerm()
  const canEdit = can('marketing.content', 'edit')
  const { reloadKey, refreshCounts } = useOutletContext<ContentOutlet>()

  const location = useLocation()
  const navigate = useNavigate()

  const [month, setMonth] = useState(currentMonth())
  const [day, setDay] = useState('')
  const [status, setStatus] = useState<IgPostStatus | 'all'>('all')

  const [items, setItems] = useState<IgPost[]>([])
  const [totals, setTotals] = useState<IgPostTotals | null>(null)
  const [truncated, setTruncated] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [removing, setRemoving] = useState<IgPost | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  /**
   * Muharrir («Yangi post» / «Tahrirlash») saqlagandan keyin shu sahifaga `state.mkNotice`
   * bilan qaytadi — natija ALOHIDA ekranda emas, ish joyida ko'rinsin.
   *
   * ⚠️ Ko'rsatgandan keyin marshrut holati TOZALANADI: aks holda foydalanuvchi sahifani
   * yangilaganda (F5) allaqachon eskirgan xabar qayta chiqib turardi.
   */
  useEffect(() => {
    const text = (location.state as { mkNotice?: string } | null)?.mkNotice
    if (!text) return
    setNotice(text)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  /** Oylik ro'yxat. `reloadKey` — layoutdagi «Yangilash» tugmasining signali. */
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { from, to } = monthRange(month)
    try {
      const res = await loadAllPosts({ from, to, status })
      setItems(res.items)
      setTotals(res.totals)
      setTruncated(res.truncated)
    } catch (e) {
      setError(apiErrorMessage(e, "Rejalashtirilgan postlarni yuklab bo'lmadi"))
    } finally {
      setLoading(false)
    }
    // `reloadKey` qiymati ishlatilmaydi — u faqat funksiya kimligini o'zgartirib,
    // quyidagi effektni qayta ishga tushirish uchun bog'liqlikda turadi.
    void reloadKey
  }, [month, status, reloadKey])

  useEffect(() => { void load() }, [load])

  /** Kalendar kataklaridagi sonlar — AYNAN ro'yxatdagi postlardan. */
  const counts = useMemo(() => countsByDay(items), [items])

  /**
   * Ko'rinadigan postlar — kun filtri KLIENTDA (yuqoridagi 2-tuzoq).
   * Guruhlash va tartib `groupByDay` da: kunlar ham, kun ichidagi vaqt ham O'SISH bo'yicha.
   */
  const days = useMemo(() => {
    const rows = day ? items.filter((p) => p.scheduledAt.slice(0, 10) === day) : items
    return groupByDay(rows)
  }, [items, day])

  const shownCount = useMemo(() => days.reduce((sum, d) => sum + d.items.length, 0), [days])

  /** Post holati o'zgargandan keyin: ro'yxat ham, sub-nav sanoqlari ham yangilanadi. */
  const afterChange = async (message: string) => {
    setNotice(message)
    await load()
    refreshCounts()
  }

  const publish = async (post: IgPost) => {
    setBusy(post.id)
    setError('')
    setNotice('')
    try {
      const res = await publishIgPost(post.id)
      // ⚠️ So'rov joylanishni KUTMAYDI: rasm odatda darhol chiqadi, video/reels esa
      // `processing` bo'lib qoladi va uni worker oxiriga yetkazadi.
      await afterChange(
        res.status === 'published'
          ? 'Post Instagram’ga joylandi.'
          : 'Post joylashga yuborildi — holati «Joylanmoqda». Video bir necha daqiqa olishi mumkin.',
      )
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
      // Javobdagi matn "bekor qilindi" va "yozuv o'chdi" ni ajratadi — o'zimiz yozmaymiz.
      const res = await deleteIgPost(post.id)
      setRemoving(null)
      await afterChange(res.message)
    } catch (e) {
      setError(apiErrorMessage(e, "O'chirib bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  const periodTitle = day ? fmtDayTitle(day) : 'Butun oy'

  return (
    <div className="fade-up">
      {notice && <MkNotice text={notice} tone="success" onClose={() => setNotice('')} />}

      {totals && (
        <div className="mk-kpi">
          <MkStat label="Rejalashtirilgan" value={totals.scheduled} tone="primary" icon="clock" />
          <MkStat label="Joylanmoqda" value={totals.processing} tone="warning" icon="refresh" />
          <MkStat label="Joylandi" value={totals.published} tone="success" icon="check" />
          <MkStat label="Xato" value={totals.failed} tone="danger" icon="warn" />
        </div>
      )}

      {/* 🔴 §5.9.1 — ekranda DOIM turadi, chunki bu QAYTARIB BO'LMAYDIGAN amal haqida.
          `details` ichiga yashirilmaydi: o'qilmagan ogohlantirish yo'q ogohlantirish bilan teng. */}
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

      {/* Kalendar + holat filtri */}
      <MkCard>
        <MonthDayStrip
          month={month}
          // ⚠️ Oy almashganda kun tanlovi TOZALANADI — boshqa oyda o'sha sana bo'lmasligi mumkin
          // va ro'yxat sababsiz bo'shab qolardi.
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
            <>
              {canEdit && (
                // Muharrir shu kunni oldindan to'ldiradi — operator sanani qayta terib o'tirmasin.
                <Link className="btn btn-primary btn-sm" to={`/admin/marketing/kontent/yangi?kun=${day}`}>
                  <Icon name="plus" /> Shu kunga post
                </Link>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setDay('')}>
                <Icon name="close" /> Kun filtri
              </button>
            </>
          )}
        </div>
      </MkCard>

      {loading && <MkLoading />}
      {!loading && error && <MkError text={error} onRetry={() => void load()} />}

      {!loading && !error && (
        <MkCard
          title={`Navbat — ${periodTitle}`}
          sub="Vaqt bo‘yicha o‘sish tartibida: keyin nima chiqishi tepadan pastga o‘qiladi"
          actions={<span className="mk-num">{shownCount} ta</span>}
          pad={false}
        >
          {truncated > 0 && (
            <div className="field-hint" style={{ padding: '10px 14px 0' }}>
              Bu oyda postlar ko‘p: yana {truncated} tasi ro‘yxatga sig‘madi. Kerakli kunni kalendardan
              tanlang yoki holat filtridan foydalaning.
            </div>
          )}

          {days.length === 0
            ? (
              <MkEmpty
                text="Bu davrda post yo‘q"
                hint={canEdit
                  ? 'Yuqoridagi «Yangi post» tugmasi bilan reja qo‘shing.'
                  : 'Reja qo‘shish uchun «Kontent» bo‘limida tahrirlash ruxsati kerak.'}
              />
            )
            : days.map((group) => (
              <div className="mk-day" key={group.day}>
                <div className="mk-day-head">
                  <span className="mk-day-date">{fmtDayTitle(group.day)}</span>
                  <span className="mk-day-count">{group.items.length} ta post</span>
                </div>
                <div className="mk-day-items">
                  {group.items.map((p) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      canEdit={canEdit}
                      busy={busy === p.id}
                      onPublish={() => void publish(p)}
                      onDelete={() => setRemoving(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </MkCard>
      )}

      {removing && (
        <DeleteConfirm
          post={removing}
          busy={busy === removing.id}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove(removing)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════ NAVBAT QATORI ═══════════════════════════════════════ */

/**
 * Bitta reja qatori.
 *
 * ⚠️ «Tahrirlash» faqat `scheduled` holatda ochiq (backend ham 400 qaytaradi, lekin
 * foydalanuvchi buni tugmani bosishdan OLDIN ko'rishi kerak — aks holda "o'zgartirdim" deb
 * o'ylab qolardi). O'chiq tugmaning `title` ida SABAB yozilgan.
 */
function PostRow({
  post, canEdit, busy, onPublish, onDelete,
}: {
  post: IgPost
  canEdit: boolean
  busy: boolean
  onPublish: () => void
  onDelete: () => void
}) {
  const st = STATUS_STYLE[post.status] ?? STATUS_STYLE.scheduled
  const editable = isEditable(post)

  return (
    // Chapdagi 3px rangli chiziq holatni SANAMASDAN ko'rsatadi (rang manbai — `STATUS_STYLE`).
    <div className="mk-post-row" style={{ ['--rail' as string]: st.color }}>
      <PostThumb post={post} />

      <div className="mk-post-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{fmtTime(post.scheduledAt) || '—'}</span>
          <span style={{ fontSize: 13 }}>{post.postTypeLabel}</span>
          <span className="badge" style={{ background: st.bg, color: st.color }}>{post.statusLabel}</span>
          {post.media.length > 1 && <span className="match-pill">{post.media.length} ta element</span>}
          {post.attempts > 0 && post.status !== 'published' && (
            <span className="match-pill">{post.attempts}-urinish</span>
          )}
        </div>

        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45, color: 'var(--text-2)' }}>
          {post.caption ? trim(post.caption, 150) : <i>matnsiz post</i>}
        </div>

        {post.status === 'processing' && (
          <div className="field-hint">
            Meta media konteynerini tayyorlamoqda{post.containerStatus ? ` (${post.containerStatus})` : ''} —
            video uchun bu bir necha daqiqa davom etadi.
          </div>
        )}

        {/* Sabab O'ZBEKCHA — backend Meta xato kodini tarjima qilib beradi, biz o'zimiz yozmaymiz. */}
        {post.error && (
          <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12.5, lineHeight: 1.45 }}>
            {post.error}
          </div>
        )}

        {post.permalink && (
          <a className="link-btn" href={post.permalink} target="_blank" rel="noreferrer" style={{ marginTop: 6 }}>
            <Icon name="link" style={{ width: 13, height: 13 }} /> Instagram’da ochish
          </a>
        )}
      </div>

      {canEdit && (
        <div className="mk-post-acts">
          {editable
            ? (
              <Link className="btn btn-outline btn-sm" to={`/admin/marketing/kontent/post/${post.id}`}>
                <Icon name="edit" /> Tahrirlash
              </Link>
            )
            : (
              <button
                className="btn btn-outline btn-sm"
                disabled
                title="Faqat «Rejalashtirilgan» post tahrirlanadi — joylangan postni Instagram API’si o‘zgartirishga ruxsat bermaydi"
              >
                <Icon name="edit" /> Tahrirlash
              </button>
            )}

          {(post.status === 'scheduled' || post.status === 'failed') && (
            <button className="btn btn-ghost btn-sm" onClick={onPublish} disabled={busy}>
              <Icon name={post.status === 'failed' ? 'refresh' : 'send'} />
              {busy ? 'Yuborilmoqda…' : post.status === 'failed' ? 'Qayta urinish' : 'Hoziroq joylash'}
            </button>
          )}

          <button className="btn btn-ghost btn-sm" onClick={onDelete} disabled={busy}>
            <Icon name="trash" /> {post.status === 'scheduled' ? 'Bekor qilish' : 'O‘chirish'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Qator boshidagi 64×64 media ko'rinishi.
 *
 * ⚠️ Haqiqiy rasm/video FAQAT manzil ochiq HTTPS bo'lganda chiziladi: `/uploads/…` yoki
 * qo'lda yozilgan noto'g'ri manzil sinuq rasm ikonkasini bergan bo'lardi. Manzil yaroqsiz
 * bo'lsa post TURI ikonkasi ko'rsatiladi — bo'sh kvadratdan ko'ra ma'lumotli.
 */
function PostThumb({ post }: { post: IgPost }) {
  const first = post.media[0]
  const show = !!first?.url && isHttpsUrl(first.url)

  return (
    <div className="mk-post-media">
      {show && first.kind === 'image' && <img src={first.url} alt="" loading="lazy" />}
      {show && first.kind === 'video' && (
        // `preload="metadata"` — butun video yuklanmasin (navbatda o'nlab qator bo'lishi mumkin).
        <video src={first.url} poster={first.coverUrl || undefined} muted preload="metadata" />
      )}
      {!show && <Icon name={postTypeIcon(post.postType)} style={{ width: 22, height: 22 }} />}
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
    <MkDialog
      title={cancelOnly ? 'Postni bekor qilish' : 'Yozuvni o‘chirish'}
      tone="danger"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            <Icon name={cancelOnly ? 'close' : 'trash'} />
            {busy ? 'Bajarilmoqda…' : cancelOnly ? 'Ha, bekor qilinsin' : 'Ha, yozuv o‘chirilsin'}
          </button>
        </>
      }
    >
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
    </MkDialog>
  )
}
