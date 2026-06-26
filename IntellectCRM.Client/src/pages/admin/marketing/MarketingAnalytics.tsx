import { WEEK, MarketingPage } from './mk'

export function MarketingAnalytics() {
  const W = 640, H = 200, pad = 10
  const max = Math.max(...WEEK.map((w) => w.auto + w.man))
  const pts = WEEK.map((w, i) => {
    const x = pad + (i * (W - pad * 2)) / (WEEK.length - 1)
    const y = H - pad - ((w.auto + w.man) / max) * (H - pad * 2)
    return [x, y] as const
  })
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]).join(' ')
  const area = line + ` L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`

  const metrics = [
    { name: "Narx so'rovlari", val: 1284, pct: 100, color: '#6d5ef8' },
    { name: 'Salomlashish', val: 2103, pct: 82, color: '#29a9eb' },
    { name: 'Ish vaqti & manzil', val: 642, pct: 50, color: '#25d366' },
    { name: 'Yetkazib berish', val: 398, pct: 31, color: '#e8920c' },
    { name: 'Rahmat / xayrlashuv', val: 567, pct: 44, color: '#e1306c' },
  ]
  const kpis = [
    { l: 'Jami xabarlar', v: '8,392', s: "+22% o'tgan oyga" },
    { l: 'AI hal qildi', v: '7,718', s: '92% ulush' },
    { l: 'Operatorga uzatildi', v: '674', s: '8% ulush' },
    { l: 'Tejalgan vaqt', v: '214 soat', s: '≈ 1.2 stavka' },
  ]
  return (
    <MarketingPage title="Analitika" sub="Samaradorlik va statistika">
      <div className="fade-up">
        <div className="grid-stats" style={{ marginBottom: 22 }}>
          {kpis.map((k) => (
            <div className="stat" key={k.l}>
              <div className="stat-label">{k.l}</div>
              <div className="stat-value" style={{ fontSize: 26, margin: '10px 0 4px' }}>{k.v}</div>
              <div className="stat-trend trend-up">{k.s}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <div className="card card-pad">
            <div className="section-head"><div><div className="section-title">Xabarlar dinamikasi</div><div className="page-sub">So'nggi 7 kun</div></div></div>
            <svg className="area-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 220 }}>
              <defs>
                <linearGradient id="mk-ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#mk-ag)" />
              <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />)}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
              {WEEK.map((w) => <span key={w.d} className="bar-label">{w.d}</span>)}
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-head"><div className="section-title">Qoidalar bo'yicha</div></div>
            {metrics.map((m) => (
              <div className="metric-row" key={m.name}>
                <div style={{ width: 130, fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                <div className="progress-track"><div className="progress-fill" style={{ width: m.pct + '%', background: m.color }} /></div>
                <div style={{ width: 48, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{m.val.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingPage>
  )
}
