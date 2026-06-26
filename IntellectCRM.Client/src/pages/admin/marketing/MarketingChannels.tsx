import { Icon, ChannelIcon, CHANNELS, MarketingPage, type ChannelId } from './mk'

export function MarketingChannels() {
  const connected: { id: ChannelId; name: string; handle: string; msgs: string; rate: string; on: boolean }[] = [
    { id: 'instagram', name: 'Instagram', handle: '@mebel.lux', msgs: '1,842', rate: '94%', on: true },
    { id: 'telegram', name: 'Telegram', handle: '@mebellux_bot', msgs: '1,196', rate: '97%', on: true },
    { id: 'whatsapp', name: 'WhatsApp Business', handle: '+998 90 123 45 67', msgs: '921', rate: '89%', on: true },
    { id: 'messenger', name: 'Messenger', handle: 'Mebel Lux', msgs: '438', rate: '91%', on: false },
  ]
  const available: { id: ChannelId; name: string; desc: string }[] = [
    { id: 'telegram', name: 'Telegram', desc: 'Yana bir bot yoki kanal' },
    { id: 'instagram', name: 'Instagram', desc: 'Boshqa biznes-akkaunt' },
  ]
  return (
    <MarketingPage title="Kanallar" sub="Ijtimoiy tarmoqlarni ulang va boshqaring">
      <div className="fade-up">
        <div className="section-head" style={{ marginBottom: 18 }}>
          <div><div className="section-title">Ulangan kanallar</div><div className="page-sub">Barcha xabarlar shu yerga yig'iladi va bitta joydan boshqariladi.</div></div>
          <button className="btn btn-primary"><Icon name="plus" /> Kanal ulash</button>
        </div>
        <div className="grid-cards" style={{ marginBottom: 30 }}>
          {connected.map((c) => (
            <div className="channel-card" key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className={'ch-big ' + CHANNELS[c.id].cls}><ChannelIcon ch={c.id} /></div>
                <span className="badge" style={{ background: c.on ? 'var(--success-soft)' : 'var(--surface-2)', color: c.on ? 'var(--success)' : 'var(--text-3)' }}>
                  <span className="badge-dot" /> {c.on ? 'Ulangan' : "To'xtatilgan"}
                </span>
              </div>
              <div className="channel-name">{c.name}</div>
              <div className="channel-handle">{c.handle}</div>
              <div className="channel-stats">
                <div><div className="channel-stat-v">{c.msgs}</div><div className="channel-stat-l">xabar / oy</div></div>
                <div><div className="channel-stat-v">{c.rate}</div><div className="channel-stat-l">avto-javob</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}><Icon name="settings" style={{ width: 14, height: 14 }} /> Sozlash</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}>Loglar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="section-title" style={{ marginBottom: 14 }}>Qo'shish mumkin</div>
        <div className="grid-cards">
          {available.map((c, i) => (
            <div className="channel-card" key={i} style={{ borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className={'ch-big ' + CHANNELS[c.id].cls} style={{ marginBottom: 0, width: 44, height: 44 }}><ChannelIcon ch={c.id} /></div>
              <div style={{ flex: 1 }}>
                <div className="channel-name" style={{ fontSize: 15 }}>{c.name}</div>
                <div className="channel-handle">{c.desc}</div>
              </div>
              <button className="btn btn-outline btn-sm"><Icon name="plus" /> Ulash</button>
            </div>
          ))}
        </div>
      </div>
    </MarketingPage>
  )
}
