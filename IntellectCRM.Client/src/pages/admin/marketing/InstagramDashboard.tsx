import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '@/lib/utils'
import {
  getIgAnalytics, getIgConversations, getIgStatus,
  type IgAnalytics, type IgConversation, type IgStatus,
} from '@/api/services/instagram'
import { ChannelIcon, Icon, MarketingPage, MkEmpty, MkError, MkLoading } from './mk'

/** Bugungi sana ("yyyy-MM-dd"). */
const today = () => new Date().toISOString().slice(0, 10)

/** Suhbat "qaynoq" hisoblanadigan ball chegarasi (backend bilan bir xil: `IgConst.HotLeadScore`). */
const HOT_SCORE = 70

/**
 * BOSHQARUV PANELI — "hozir nima bo'lyapti" ekrani.
 *
 * Bugungi raqamlar (hodisa, javob, lid, qaynoq), navbat holati (qayta ishlanmagan va xato
 * bo'lgan webhook hodisalari), operator kutayotgan hamda qaynoq suhbatlar.
 * Modul o'chirilgan bo'lsa — hech qanday javob ketmayotgani KATTA ogohlantirish bilan
 * aytiladi (jimgina ishlamay turishi eng yomon holat).
 */
export function InstagramDashboard() {
  const nav = useNavigate()
  const [status, setStatus] = useState<IgStatus | null>(null)
  const [analytics, setAnalytics] = useState<IgAnalytics | null>(null)
  const [convs, setConvs] = useState<IgConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const d = today()
    Promise.all([
      getIgStatus(),
      getIgAnalytics(d, d),
      getIgConversations({ page: 1, pageSize: 50 }),
    ])
      .then(([st, an, list]) => { setStatus(st); setAnalytics(an); setConvs(list.items) })
      .catch((e) => setError(apiErrorMessage(e, "Ma'lumotni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  if (loading) {
    return (
      <MarketingPage title="Boshqaruv paneli" sub="Instagram AI agenti — bugungi holat">
        <MkLoading />
      </MarketingPage>
    )
  }

  if (error || !status || !analytics) {
    return (
      <MarketingPage title="Boshqaruv paneli" sub="Instagram AI agenti — bugungi holat">
        <MkError text={error || "Ma'lumot yuklanmadi"} onRetry={load} />
      </MarketingPage>
    )
  }

  const t = analytics.totals
  const hot = convs.filter((c) => c.leadScore >= HOT_SCORE).slice(0, 6)
  const needsOperator = convs.filter((c) => c.needsOperator).slice(0, 6)

  const stats = [
    { label: 'Kelgan hodisalar', value: t.events, icon: 'inbox', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    { label: 'Yuborilgan javoblar', value: t.replies, icon: 'send', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    { label: 'Yangi lidlar', value: t.leads, icon: 'users', bg: 'var(--success-soft)', fg: 'var(--success)' },
    { label: 'Qaynoq lidlar', value: t.hot, icon: 'fire', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  ]

  return (
    <MarketingPage
      title="Boshqaruv paneli"
      sub="Instagram AI agenti — bugungi holat"
      actions={<button className="btn btn-ghost btn-sm" onClick={load}><Icon name="refresh" /> Yangilash</button>}
    >
      <div className="fade-up">
        {/* Modul o'chiq — eng muhim ogohlantirish */}
        {!status.enabled && (
          <div className="mk-alert mk-alert-danger">
            <Icon name="warn" style={{ width: 22, height: 22, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="mk-alert-title">Instagram moduli O'CHIRILGAN</div>
              <div>
                Kelgan izoh va xabarlarga hech qanday javob yuborilmayapti. Yoqish uchun
                Sozlamalar bo'limiga o'ting.
              </div>
            </div>
            <Link className="btn btn-primary btn-sm" to="/admin/marketing/settings">
              <Icon name="settings" /> Sozlamalar
            </Link>
          </div>
        )}

        {status.enabled && !status.connected && (
          <div className="mk-alert">
            <Icon name="warn" style={{ width: 22, height: 22, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="mk-alert-title">Akkaunt ulanmagan</div>
              <div>Modul yoqilgan, lekin Instagram akkaunti ulanmagani uchun hodisa kelmaydi.</div>
            </div>
            <Link className="btn btn-primary btn-sm" to="/admin/marketing/settings">
              <Icon name="link" /> Ulash
            </Link>
          </div>
        )}

        {status.enabled && status.connected && status.knowledgeCount === 0 && (
          <div className="mk-alert">
            <Icon name="warn" style={{ width: 22, height: 22, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="mk-alert-title">Bilim bazasi bo'sh</div>
              <div>AI faqat kiritilgan ma'lumot asosida javob beradi — hozircha javob bera olmaydi.</div>
            </div>
            <Link className="btn btn-primary btn-sm" to="/admin/marketing/knowledge">
              <Icon name="book" /> To'ldirish
            </Link>
          </div>
        )}

        {/* Bugungi raqamlar */}
        <div className="grid-stats" style={{ marginBottom: 22 }}>
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-top">
                <div className="stat-icon" style={{ background: s.bg, color: s.fg }}>
                  <Icon name={s.icon} style={{ width: 19, height: 19 }} />
                </div>
              </div>
              <div className="stat-value">{s.value.toLocaleString()}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
          {/* Navbat */}
          <div className="card card-pad">
            <div className="section-head"><div className="section-title">Navbat holati</div></div>
            <div className="row-between">
              <div>
                <div className="opt-name">Qayta ishlanmagan hodisalar</div>
                <div className="opt-desc">Webhook'dan kelgan, hali javob berilmagan xabarlar.</div>
              </div>
              <div className="stat-value" style={{ fontSize: 24, margin: 0 }}>{status.pendingEvents}</div>
            </div>
            <div className="row-between">
              <div>
                <div className="opt-name">Xato bo'lgan hodisalar</div>
                <div className="opt-desc">3 martadan keyin ham qayta ishlanmagan — sababi «Sozlamalar» diagnostikasida.</div>
              </div>
              <div className="stat-value" style={{ fontSize: 24, margin: 0, color: status.failedEvents > 0 ? 'var(--danger)' : undefined }}>
                {status.failedEvents}
              </div>
            </div>
            <div className="row-between">
              <div>
                <div className="opt-name">Bugungi javoblar</div>
                <div className="opt-desc">Kunlik chegara: {status.dailyLimit}</div>
              </div>
              <div className="stat-value" style={{ fontSize: 24, margin: 0 }}>{status.todayReplies}</div>
            </div>
            <div className="row-between">
              <div>
                <div className="opt-name">Eskalatsiyalar (bugun)</div>
                <div className="opt-desc">AI o'zi hal qila olmay, odamga uzatgan suhbatlar.</div>
              </div>
              <div className="stat-value" style={{ fontSize: 24, margin: 0 }}>{t.escalations}</div>
            </div>
          </div>

          {/* Operator kerak */}
          <div className="card card-pad">
            <div className="section-head">
              <div className="section-title">Operator kerak</div>
              <button className="link-btn" onClick={() => nav('/admin/marketing/inbox')}>
                Inbox <Icon name="chevRight" style={{ width: 13, height: 13 }} />
              </button>
            </div>
            {needsOperator.length === 0
              ? <MkEmpty text="Hozircha odam aralashuvi kerak emas" />
              : needsOperator.map((c) => (
                <div className="feed-item" key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/admin/marketing/inbox?id=${c.id}`)}>
                  <div className="ch-icon ch-instagram"><ChannelIcon /></div>
                  <div className="feed-body">
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>@{c.username || c.igUserId}</div>
                    <div className="feed-time">{c.needsOperatorReason || 'Sabab ko‘rsatilmagan'}</div>
                  </div>
                  <span className="badge badge-danger">Operator</span>
                </div>
              ))}
          </div>
        </div>

        {/* Qaynoq suhbatlar */}
        <div className="card card-pad">
          <div className="section-head">
            <div>
              <div className="section-title">Oxirgi qaynoq suhbatlar</div>
              <div className="page-sub">Qiziqish balli {HOT_SCORE} va undan yuqori</div>
            </div>
            <button className="link-btn" onClick={() => nav('/admin/marketing/inbox')}>
              Barchasi <Icon name="chevRight" style={{ width: 13, height: 13 }} />
            </button>
          </div>
          {hot.length === 0
            ? <MkEmpty text="Qaynoq suhbat yo'q" hint="Mijoz aniq qiziqish bildirsa yoki telefon qoldirsa shu yerda chiqadi." />
            : hot.map((c) => (
              <div className="feed-item" key={c.id} style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => nav(`/admin/marketing/inbox?id=${c.id}`)}>
                <div className="ch-icon ch-instagram"><ChannelIcon /></div>
                <div className="feed-body">
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>@{c.username || c.igUserId}</div>
                  <div className="feed-time" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                    {c.lastMessageText || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {c.leadId && <span className="badge badge-success">Lid</span>}
                  <span className="badge badge-warning"><Icon name="fire" style={{ width: 11, height: 11 }} /> {c.leadScore}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </MarketingPage>
  )
}
