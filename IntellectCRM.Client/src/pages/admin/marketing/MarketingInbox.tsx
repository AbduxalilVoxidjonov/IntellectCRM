import { useState } from 'react'
import { Icon, ChannelIcon, CHANNELS, CONVS, MarketingPage } from './mk'

export function MarketingInbox() {
  const [active, setActive] = useState(CONVS[0].id)
  const [filter, setFilter] = useState<'all' | 'unread' | 'manual'>('all')
  const [text, setText] = useState('')
  const conv = CONVS.find((c) => c.id === active)!

  const filtered = CONVS.filter((c) => {
    if (filter === 'unread') return c.unread > 0
    if (filter === 'manual') return !c.auto
    return true
  })
  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2)

  return (
    <MarketingPage title="Inbox" sub="Barcha kanallardagi suhbatlar — bitta joyda" full>
      <div className="inbox fade-up">
        {/* conversation list */}
        <div className="conv-list">
          <div className="conv-list-head">
            <div className="mk-search">
              <Icon name="search" style={{ width: 16, height: 16 }} />
              <input placeholder="Suhbatlarni qidirish…" />
            </div>
            <div className="conv-filters">
              {([['all', 'Barchasi'], ['unread', "O'qilmagan"], ['manual', 'Operator kerak']] as const).map(([k, l]) => (
                <button key={k} className={'conv-filter ' + (filter === k ? 'active' : '')} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="conv-scroll">
            {filtered.map((c) => (
              <div key={c.id} className={'conv-item ' + (active === c.id ? 'active' : '')} onClick={() => setActive(c.id)}>
                <div className="conv-avatar" style={{ background: c.color }}>
                  {initials(c.name)}
                  <div className={'conv-ch-badge ' + CHANNELS[c.ch].cls}><ChannelIcon ch={c.ch} /></div>
                </div>
                <div className="conv-main">
                  <div className="conv-name-row">
                    <span className="conv-name">{c.name}</span>
                    <span className="conv-time">{c.time}</span>
                  </div>
                  <div className="conv-snippet">{c.snippet}</div>
                  <div style={{ marginTop: 5 }}>
                    <span className="badge" style={{ fontSize: 10, padding: '2px 7px', background: c.auto ? 'var(--primary-soft)' : 'var(--warning-soft)', color: c.auto ? 'var(--primary)' : 'var(--warning)' }}>
                      {c.auto ? <><Icon name="zap" style={{ width: 10, height: 10 }} /> {c.status}</> : <>⚠ {c.status}</>}
                    </span>
                  </div>
                </div>
                {c.unread > 0 && <div className="conv-unread">{c.unread}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* chat */}
        <div className="chat">
          <div className="chat-head">
            <div className="conv-avatar" style={{ width: 40, height: 40, background: conv.color }}>
              {initials(conv.name)}
              <div className={'conv-ch-badge ' + CHANNELS[conv.ch].cls}><ChannelIcon ch={conv.ch} /></div>
            </div>
            <div className="chat-head-info">
              <div className="chat-head-name">{conv.name}</div>
              <div className="chat-head-status"><span className="live-dot" /> {CHANNELS[conv.ch].name} orqali · onlayn</div>
            </div>
            <button className="btn btn-outline btn-sm"><Icon name="users" /> Operatorga uzatish</button>
            <button className="icon-btn"><Icon name="more" /></button>
          </div>

          <div className="chat-body">
            <div className="day-divider">Bugun</div>
            {conv.msgs.map((m, i) => (
              <div key={i} className={'msg-row ' + (m.t === 'out' ? 'out' : 'in')}>
                <div>
                  <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                  <div className="msg-meta">
                    {m.auto && <span className="auto-tag"><Icon name="zap" style={{ width: 10, height: 10 }} /> {m.auto}</span>}
                    {m.time}
                    {m.t === 'out' && <Icon name="check" style={{ width: 13, height: 13, color: 'var(--success)' }} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI suggestion */}
          <div className="ai-suggest">
            <Icon name="sparkle" style={{ width: 18, height: 18, color: 'var(--primary)', flexShrink: 0 }} />
            <div className="ai-suggest-text"><b>AI taklifi:</b> «Burchakli divanlarimizning katalogini PDF ko'rinishida yuboraymi? 📎»</div>
            <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff' }} onClick={() => setText("Burchakli divanlarimizning katalogini PDF ko'rinishida yuboraymi? 📎")}>Qo'llash</button>
          </div>

          <div className="chat-input-bar">
            <button className="icon-btn"><Icon name="plus" /></button>
            <input className="chat-input" placeholder="Javob yozing yoki AI taklifini qo'llang…" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-primary btn-icon-only" style={{ padding: 11 }}><Icon name="send" /></button>
          </div>
        </div>
      </div>
    </MarketingPage>
  )
}
