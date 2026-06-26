import { useNavigate } from 'react-router-dom'
import { Icon, ChannelIcon, CHANNELS, RULES, WEEK, MarketingPage, type ChannelId } from './mk'

export function MarketingDashboard() {
  const nav = useNavigate()
  const go = (p: string) => nav(`/admin/marketing${p === 'dashboard' ? '' : '/' + p}`)
  const max = Math.max(...WEEK.map((w) => w.auto + w.man))

  const channelDist = [
    { name: 'Instagram', val: 1842, color: '#e1306c', pct: 42 },
    { name: 'Telegram', val: 1196, color: '#29a9eb', pct: 27 },
    { name: 'WhatsApp', val: 921, color: '#25d366', pct: 21 },
    { name: 'Messenger', val: 438, color: '#0084ff', pct: 10 },
  ]
  const feed: { ch: ChannelId; text: string; time: string; warn?: boolean }[] = [
    { ch: 'instagram', text: "<b>Dilnoza K.</b> savoliga «Narx so'rovlari» qoidasi javob berdi", time: '2 daqiqa oldin' },
    { ch: 'telegram', text: "<b>Sardor A.</b> «Yetkazib berish» bo'yicha AI javobini oldi", time: '8 daqiqa oldin' },
    { ch: 'whatsapp', text: '<b>Madina Y.</b> operatorga ulanishni so\'radi — tekshiruv kerak', time: '23 daqiqa oldin', warn: true },
    { ch: 'messenger', text: '<b>Aziza R.</b> AI tomonidan to\'liq xizmat ko\'rsatildi', time: '1 soat oldin' },
    { ch: 'telegram', text: 'Yangi qoida «Aksiya & chegirma» yaratildi', time: '3 soat oldin' },
  ]
  const stats = [
    { label: 'Bugungi xabarlar', value: '1,284', trend: '+18%', up: true, icon: 'msg', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    { label: 'Avto-javob ulushi', value: '92%', trend: '+4%', up: true, icon: 'zap', bg: 'var(--success-soft)', fg: 'var(--success)' },
    { label: "O'rtacha javob", value: '1.2s', trend: '−0.3s', up: true, icon: 'clock', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
    { label: 'Faol qoidalar', value: '12', trend: '2 ta yangi', up: true, icon: 'rules', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  ]

  return (
    <MarketingPage title="Boshqaruv paneli" sub="Umumiy holat va bugungi natijalar">
      <div className="fade-up">
        {/* hero */}
        <div className="card card-pad" style={{ background: 'var(--ai-grad)', border: 'none', marginBottom: 22, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
          <div style={{ position: 'absolute', right: 80, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.2)', padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                <span className="live-dot" style={{ background: '#fff' }} /> Tizim faol — 4 kanal ulangan
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Xush kelibsiz, Mebel Lux 👋</h2>
              <p style={{ fontSize: 14, opacity: 0.9, maxWidth: 520, lineHeight: 1.5 }}>Bugun AI yordamchingiz <b>1,182 ta xabarga</b> avtomatik javob berdi va sizning jamoangizga <b>8 soat</b> vaqtni tejadi.</p>
            </div>
            <button className="btn" style={{ background: '#fff', color: 'var(--primary-700)' }} onClick={() => go('rules')}>
              <Icon name="plus" /> Yangi qoida
            </button>
          </div>
        </div>

        {/* stats */}
        <div className="grid-stats" style={{ marginBottom: 22 }}>
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-top">
                <div className="stat-icon" style={{ background: s.bg, color: s.fg }}><Icon name={s.icon} style={{ width: 19, height: 19 }} /></div>
                <span className={'stat-trend ' + (s.up ? 'trend-up' : 'trend-down')}><Icon name="trendUp" style={{ width: 13, height: 13 }} /> {s.trend}</span>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 22 }}>
          {/* chart */}
          <div className="card card-pad">
            <div className="section-head">
              <div>
                <div className="section-title">Xabarlar oqimi</div>
                <div className="page-sub">So'nggi 7 kun · avto vs qo'lda</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--primary)' }} /> Avto-javob</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-3)' }} /> Qo'lda</span>
              </div>
            </div>
            <div className="bars">
              {WEEK.map((w) => (
                <div className="bar-col" key={w.d}>
                  <div className="bar-stack" style={{ height: ((w.auto + w.man) / max) * 100 + '%' }}>
                    <div className="bar-seg" style={{ height: (w.man / (w.auto + w.man)) * 100 + '%', background: 'var(--surface-3)' }} />
                    <div className="bar-seg" style={{ height: (w.auto / (w.auto + w.man)) * 100 + '%', background: 'var(--primary)' }} />
                  </div>
                  <span className="bar-label">{w.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* channel distribution */}
          <div className="card card-pad">
            <div className="section-head"><div className="section-title">Kanallar bo'yicha</div></div>
            {channelDist.map((c) => (
              <div className="legend-row" key={c.name}>
                <span className="legend-dot" style={{ background: c.color }} />
                <span className="legend-name">{c.name}</span>
                <span className="legend-val">{c.val.toLocaleString()}</span>
                <span className="legend-pct">{c.pct}%</span>
              </div>
            ))}
            <div style={{ marginTop: 14, height: 9, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
              {channelDist.map((c) => <div key={c.name} style={{ width: c.pct + '%', background: c.color }} />)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* activity */}
          <div className="card card-pad">
            <div className="section-head">
              <div className="section-title">So'nggi faollik</div>
              <button className="link-btn" onClick={() => go('inbox')}>Inbox <Icon name="chevRight" style={{ width: 13, height: 13 }} /></button>
            </div>
            {feed.map((f, i) => (
              <div className="feed-item" key={i}>
                <div className={'ch-icon ' + CHANNELS[f.ch].cls} style={{ width: 30, height: 30 }}><ChannelIcon ch={f.ch} /></div>
                <div className="feed-body">
                  <div className="feed-text" dangerouslySetInnerHTML={{ __html: f.text }} />
                  <div className="feed-time">{f.warn && <span className="badge badge-warning" style={{ marginRight: 6 }}>Diqqat</span>}{f.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* top rules */}
          <div className="card card-pad">
            <div className="section-head">
              <div className="section-title">Eng faol qoidalar</div>
              <button className="link-btn" onClick={() => go('rules')}>Barchasi <Icon name="chevRight" style={{ width: 13, height: 13 }} /></button>
            </div>
            {RULES.slice(0, 4).sort((a, b) => b.triggers - a.triggers).map((r, i) => (
              <div className="feed-item" key={r.id} style={{ alignItems: 'center' }}>
                <div className="rule-num" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{i + 1}</div>
                <div className="feed-body">
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.title}</div>
                  <div className="feed-time">{r.keywords.length} kalit so'z · {r.channels.length} kanal</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{r.triggers.toLocaleString()}</div>
                  <div className="feed-time">ishga tushdi</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingPage>
  )
}
