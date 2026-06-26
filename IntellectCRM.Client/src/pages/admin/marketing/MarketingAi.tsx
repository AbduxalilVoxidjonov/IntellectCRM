import { useState } from 'react'
import { Icon, MarketingPage } from './mk'

export function MarketingAi() {
  const [tone, setTone] = useState('friendly')
  const [lang, setLang] = useState('auto')
  const [fallback, setFallback] = useState(true)
  const [handoff, setHandoff] = useState(true)
  const [hours, setHours] = useState(true)
  const tones = [
    { id: 'friendly', emoji: '😊', name: "Do'stona", desc: 'Iliq, emoji bilan' },
    { id: 'formal', emoji: '🤝', name: 'Rasmiy', desc: 'Professional, jiddiy' },
    { id: 'short', emoji: '⚡', name: 'Qisqa', desc: "Lo'nda, tez" },
  ]
  const behaviors: [string, string, boolean, (v: boolean) => void][] = [
    ['AI fallback', 'Hech qaysi qoida mos kelmasa, AI mustaqil javob beradi.', fallback, setFallback],
    ['Operatorga uzatish', 'AI murakkab savolni aniqlasa, suhbatni operatorga yo\'naltiradi.', handoff, setHandoff],
    ['Ish vaqtidan tashqari', 'Ish vaqti tugagach «ertaga javob beramiz» xabarini avtomatik yuboradi.', hours, setHours],
  ]
  return (
    <MarketingPage title="AI yordamchi" sub="Avtojavoblarning ohangi va xulqi">
      <div className="fade-up" style={{ maxWidth: 860 }}>
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div className="stat-icon" style={{ background: 'var(--ai-grad)', color: '#fff' }}><Icon name="sparkle" style={{ width: 19, height: 19 }} /></div>
            <div><div className="section-title">AI yordamchi</div><div className="page-sub">Qoidaga tushmagan savollarga AI qanday javob berishini sozlang.</div></div>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="field-label" style={{ marginBottom: 12 }}>Muloqot ohangi</div>
          <div className="tone-grid">
            {tones.map((t) => (
              <div key={t.id} className={'tone-opt ' + (tone === t.id ? 'sel' : '')} onClick={() => setTone(t.id)}>
                <div className="tone-emoji">{t.emoji}</div>
                <div className="tone-name">{t.name}</div>
                <div className="tone-desc">{t.desc}</div>
              </div>
            ))}
          </div>

          <div className="field" style={{ marginTop: 22 }}>
            <label className="field-label">Biznes konteksti <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>— AI shu ma'lumotga tayanib javob beradi</span></label>
            <textarea className="textarea" defaultValue={"Mebel Lux — Toshkentdagi mebel do'koni. Divan, kreslo, oshxona va yotoqxona mebellari sotamiz. Toshkent bo'ylab yetkazib berish 1–2 kun. Ish vaqti 09:00–19:00."} style={{ minHeight: 100 }} />
            <div className="field-hint">Mahsulotlar, narx oralig'i, qoidalar — AI shularni bilib javob beradi.</div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Javob tili</label>
            <div className="seg" style={{ width: 'fit-content' }}>
              {([['auto', 'Avtomatik (mijoz tilida)'], ['uz', "O'zbek"], ['ru', 'Rus'], ['en', 'Ingliz']] as const).map(([k, l]) => (
                <button key={k} className={lang === k ? 'active' : ''} onClick={() => setLang(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="field-label" style={{ marginBottom: 4 }}>Xulq-atvor</div>
          {behaviors.map(([n, d, v, set], i) => (
            <div className="row-between" key={i}>
              <div><div className="opt-name">{n}</div><div className="opt-desc">{d}</div></div>
              <div className={'switch ' + (v ? 'on' : '')} onClick={() => set(!v)} />
            </div>
          ))}
        </div>
      </div>
    </MarketingPage>
  )
}
