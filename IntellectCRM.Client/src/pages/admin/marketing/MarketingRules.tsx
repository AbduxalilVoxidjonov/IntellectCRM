import { useState } from 'react'
import { Icon, ChannelIcon, CHANNELS, RULES, MarketingPage, type Rule, type ChannelId } from './mk'

export function MarketingRules() {
  const [rules, setRules] = useState<Rule[]>(RULES)
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all')
  const [open, setOpen] = useState<number | null>(1)
  const [modal, setModal] = useState<Rule | 'new' | null>(null)

  const toggle = (id: number) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)))
  const shown = rules.filter((r) => filter === 'all' || (filter === 'on' ? r.on : !r.on))

  return (
    <MarketingPage title="Javob qoidalari" sub="Kalit so'z → avtomatik javob">
      <div className="fade-up">
        <div className="rules-toolbar">
          <div className="seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Barchasi {rules.length}</button>
            <button className={filter === 'on' ? 'active' : ''} onClick={() => setFilter('on')}>Faol {rules.filter((r) => r.on).length}</button>
            <button className={filter === 'off' ? 'active' : ''} onClick={() => setFilter('off')}>O'chiq {rules.filter((r) => !r.on).length}</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm"><Icon name="filter" /> Kanal</button>
            <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" /> Yangi qoida</button>
          </div>
        </div>

        {shown.map((r, idx) => (
          <div className="rule-card" key={r.id}>
            <div className="rule-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div className="rule-num">{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="rule-title">{r.title}</div>
                <div className="rule-meta">
                  <span>{r.keywords.length} kalit so'z</span>
                  <span>·</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {r.channels.map((c) => <span key={c} className={'ch-icon ' + CHANNELS[c].cls} style={{ width: 18, height: 18, borderRadius: 5 }}><ChannelIcon ch={c} /></span>)}
                  </span>
                  <span>·</span>
                  <span>{r.triggers.toLocaleString()} marta</span>
                  {r.ai && <span className="badge badge-ai"><Icon name="sparkle" style={{ width: 11, height: 11 }} /> AI</span>}
                </div>
              </div>
              <span className="badge" style={{ background: r.on ? 'var(--success-soft)' : 'var(--surface-2)', color: r.on ? 'var(--success)' : 'var(--text-3)' }}>
                <span className="badge-dot" /> {r.on ? 'Faol' : "O'chiq"}
              </span>
              <div className={'switch ' + (r.on ? 'on' : '')} onClick={(e) => { e.stopPropagation(); toggle(r.id) }} />
              <Icon name="chevDown" style={{ width: 18, height: 18, color: 'var(--text-3)', transform: open === r.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </div>

            {open === r.id && (
              <div className="rule-flow fade-up">
                <div className="flow-col">
                  <div className="flow-step">
                    <div className="flow-step-label"><Icon name="search" style={{ width: 13, height: 13 }} /> Kalit so'zlar</div>
                    <div className="kw-wrap" style={{ marginBottom: 12 }}>
                      {r.keywords.map((k) => <span key={k} className="chip-kw">{k}</span>)}
                    </div>
                    <span className="match-pill">Moslik: {r.match}</span>
                  </div>
                </div>
                <div className="flow-arrow"><Icon name="arrowRight" style={{ width: 20, height: 20 }} /></div>
                <div className="flow-col">
                  <div className="flow-step">
                    <div className="flow-step-label">
                      {r.ai ? <><Icon name="sparkle" style={{ width: 13, height: 13 }} /> AI-kuchaytirilgan javob</> : <><Icon name="msg" style={{ width: 13, height: 13 }} /> Tayyor javob</>}
                    </div>
                    <div className="reply-preview" style={{ whiteSpace: 'pre-line' }}>{r.reply}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, justifyContent: 'center' }}>
                  <button className="icon-btn" title="Tahrirlash" onClick={() => setModal(r)}><Icon name="edit" style={{ width: 17, height: 17 }} /></button>
                  <button className="icon-btn" title="Nusxa"><Icon name="copy" style={{ width: 17, height: 17 }} /></button>
                  <button className="icon-btn" title="O'chirish" style={{ color: 'var(--danger)' }}><Icon name="trash" style={{ width: 17, height: 17 }} /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {modal && <RuleModal rule={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}
      </div>
    </MarketingPage>
  )
}

function RuleModal({ rule, onClose }: { rule: Rule | null; onClose: () => void }) {
  const [title, setTitle] = useState(rule?.title || '')
  const [kws, setKws] = useState<string[]>(rule?.keywords || [])
  const [draft, setDraft] = useState('')
  const [match, setMatch] = useState(rule?.match || "Tarkibida bo'lsa")
  const [reply, setReply] = useState(rule?.reply || '')
  const [ai, setAi] = useState(rule?.ai ?? true)
  const [chans, setChans] = useState<ChannelId[]>(rule?.channels || ['instagram', 'telegram'])

  const addKw = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault()
      if (!kws.includes(draft.trim())) setKws([...kws, draft.trim()])
      setDraft('')
    } else if (e.key === 'Backspace' && !draft && kws.length) {
      setKws(kws.slice(0, -1))
    }
  }
  const toggleChan = (c: ChannelId) => setChans((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{rule ? 'Qoidani tahrirlash' : 'Yangi qoida'}</div>
          <button className="icon-btn" onClick={onClose} style={{ background: 'transparent' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Qoida nomi</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Narx so'rovlari" />
          </div>

          <div className="field">
            <label className="field-label">Kalit so'zlar <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>— mijoz shu so'zlarni yozsa</span></label>
            <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 46, cursor: 'text' }}>
              {kws.map((k) => (
                <span key={k} className="chip-kw" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                  {k}<span onClick={() => setKws(kws.filter((x) => x !== k))} style={{ cursor: 'pointer', opacity: .6 }}>✕</span>
                </span>
              ))}
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={addKw} placeholder={kws.length ? '' : 'narx, qancha, price…'} style={{ border: 'none', background: 'none', outline: 'none', flex: 1, minWidth: 90, fontSize: 13.5, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="field-hint">Enter yoki vergul bilan qo'shing. Katta-kichik harf va tildan qat'i nazar mos keladi.</div>
          </div>

          <div className="field">
            <label className="field-label">Moslik turi</label>
            <div className="seg" style={{ width: 'fit-content' }}>
              {['Tarkibida bo\'lsa', 'Aniq mos', 'Boshlansa'].map((m) => (
                <button key={m} className={match === m ? 'active' : ''} onClick={() => setMatch(m)}>{m}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Kanallar</label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {Object.values(CHANNELS).map((c) => (
                <button key={c.id} onClick={() => toggleChan(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 10, border: '1.5px solid ' + (chans.includes(c.id) ? 'var(--primary)' : 'var(--border)'), background: chans.includes(c.id) ? 'var(--primary-soft)' : 'transparent', fontWeight: 700, fontSize: 13 }}>
                  <span className={'ch-icon ' + c.cls} style={{ width: 22, height: 22, borderRadius: 6 }}><ChannelIcon ch={c.id} /></span>
                  {c.name}
                  {chans.includes(c.id) && <Icon name="check" style={{ width: 14, height: 14, color: 'var(--primary)' }} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Javob matni</label>
            <textarea className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Mijozga yuboriladigan javob…" />
          </div>

          <div className="row-between" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }}>
            <div>
              <div className="opt-name" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="sparkle" style={{ width: 16, height: 16, color: 'var(--primary)' }} /> AI bilan kuchaytirish</div>
              <div className="opt-desc">AI javobni mijoz savoliga moslab, tabiiy va shaxsiy qilib yuboradi.</div>
            </div>
            <div className={'switch ' + (ai ? 'on' : '')} onClick={() => setAi(!ai)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={onClose}><Icon name="check" /> Saqlash</button>
        </div>
      </div>
    </div>
  )
}
