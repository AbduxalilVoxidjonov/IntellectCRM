/**
 * Marketing (Instagram AI agenti) bo'limining umumiy qismi — ikonlar, Instagram glyphi,
 * sahifa o'rovchisi (wrapper) va holat blokchalari (yuklanmoqda / xato / bo'sh).
 *
 * ⚠️ Mock ma'lumotlar OLIB TASHLANDI — barcha sahifalar `api/services/instagram.ts`
 * orqali haqiqiy API bilan ishlaydi. Bo'lim FAQAT Instagram'dan iborat.
 */
import type { CSSProperties, ReactNode } from 'react'

/* ---------------- ICONS (line) ---------------- */
const Ic: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  rules: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15',
  ai: 'M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 6 0 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3zM12 8v8M8 12h8',
  analytics: 'M3 3v18h18M7 16l4-4 3 3 5-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14M5 12h14',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  chevUp: 'M18 15l-6-6-6 6',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  check: 'M20 6 9 17l-5-5',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  sparkle: 'M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.1L12 3z',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  unlink: 'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M2 2l20 20',
  warn: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  play: 'M5 3l14 9-14 9V3z',
  close: 'M18 6 6 18M6 6l12 12',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  fire: 'M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 11 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12z',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
}

export function Icon({ name, style, className }: { name: string; style?: CSSProperties; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className}
    >
      <path d={Ic[name]} />
    </svg>
  )
}

/* ---------------- CHANNEL brand glyph (filled) ---------------- */
/** Bo'limda FAQAT bitta kanal bor — Instagram. */
export type ChannelId = 'instagram'

const ChannelGlyph: Record<ChannelId, string> = {
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.13-1.38.66-.66 1.07-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
}

export function ChannelIcon({ ch = 'instagram' }: { ch?: ChannelId }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d={ChannelGlyph[ch]} />
    </svg>
  )
}

/* ---------------- PAGE WRAPPER ---------------- */
/** Marketing sahifa o'rovchisi — `.marketing-app` scope + sarlavha. */
export function MarketingPage({
  title, sub, children, full, actions,
}: {
  title: string
  sub: string
  children: ReactNode
  /** Inbox kabi to'liq-kenglikdagi sahifalar uchun (content-narrow yo'q). */
  full?: boolean
  /** Sarlavha o'ng tomonidagi tugmalar. */
  actions?: ReactNode
}) {
  return (
    <div className="marketing-app">
      <div className={full ? '' : 'content-narrow'}>
        <div className="mk-head" style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="page-title">{title}</div>
            <div className="page-sub">{sub}</div>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- HOLAT BLOKCHALARI ---------------- */

/** Yuklanmoqda — har sahifada bir xil ko'rinsin. */
export function MkLoading({ text = 'Yuklanmoqda…' }: { text?: string }) {
  return <div className="mk-state">{text}</div>
}

/** Xato — sabab TO'LIQ ko'rsatiladi (jim yutilmaydi), qayta urinish tugmasi bilan. */
export function MkError({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="mk-state mk-state-error">
      <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{text}</span>
      {onRetry && (
        <button className="btn btn-outline btn-sm" onClick={onRetry}>
          <Icon name="refresh" /> Qayta urinish
        </button>
      )}
    </div>
  )
}

/** Bo'sh ro'yxat — "nima yo'q va nima qilish kerak". */
export function MkEmpty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="mk-state">
      <div>
        <div style={{ fontWeight: 700 }}>{text}</div>
        {hint && <div className="field-hint" style={{ marginTop: 4 }}>{hint}</div>}
      </div>
    </div>
  )
}

/** "Sozlangan / sozlanmagan" ko'rinishidagi holat kartochkasi. */
export function MkStatusCard({
  label, ok, value, hint, warn,
}: {
  label: string
  ok: boolean
  value?: string
  hint?: string
  /** `true` — "yaxshi emas, lekin xato ham emas" (sariq). */
  warn?: boolean
}) {
  const color = ok ? 'var(--success)' : warn ? 'var(--warning)' : 'var(--danger)'
  const bg = ok ? 'var(--success-soft)' : warn ? 'var(--warning-soft)' : 'var(--danger-soft)'
  return (
    <div className="mk-status" style={{ borderColor: color }}>
      <div className="mk-status-dot" style={{ background: bg, color }}>
        <Icon name={ok ? 'check' : 'warn'} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="mk-status-label">{label}</div>
        <div className="mk-status-value" style={{ color }}>{value ?? (ok ? 'Sozlangan' : 'Sozlanmagan')}</div>
        {hint && <div className="field-hint">{hint}</div>}
      </div>
    </div>
  )
}

/** Matnni buferga nusxalash tugmasi (webhook/callback manzillari uchun). */
export function MkCopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const copy = () => { void navigator.clipboard?.writeText(value) }
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="mk-copy">
        <code>{value || '—'}</code>
        <button className="btn btn-ghost btn-sm" onClick={copy} disabled={!value} title="Nusxa olish">
          <Icon name="copy" /> Nusxa
        </button>
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
