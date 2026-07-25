/**
 * TOPSHIRIQ KONSTRUKTORI — umumiy UI bo'laklari (maketdagi chrome aynan ko'chirilgan):
 * qorong'i sarlavha paneli, tur banneri, ikki panelli ish maydoni, telefon ramkasidagi jonli
 * "foydalanuvchi ko'rinishi", toast, chiqishni tasdiqlash, audio/rasm yuklagichlar.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { uploadAdminFile } from '@/api/services/students'
import { UI, display, sans, Icon } from './catalog'
import type { Lang } from './model'

// ============================ Umumiy stillar ============================

export const inputStyle: CSSProperties = {
  ...sans,
  width: '100%',
  fontSize: 16,
  color: UI.ink,
  background: '#fff',
  border: '1px solid #ddd8ea',
  borderRadius: 11,
  padding: '12px 15px',
  outline: 'none',
}

export const softInput: CSSProperties = {
  ...sans,
  width: '100%',
  fontSize: 16,
  fontWeight: 500,
  color: UI.ink,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #ece9f3',
  padding: '2px 0 6px',
  outline: 'none',
}

export const darkBtn: CSSProperties = {
  ...sans,
  background: UI.ink,
  border: 'none',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  padding: '0 20px',
  borderRadius: 11,
  cursor: 'pointer',
}

export const ghostBtn: CSSProperties = {
  ...sans,
  background: '#f1eff8',
  border: 'none',
  color: '#7a7590',
  fontWeight: 600,
  fontSize: 15,
  padding: '14px 16px',
  borderRadius: 13,
  cursor: 'pointer',
}

/** Kichik "×" o'chirish tugmasi. */
export function RemoveBtn({ onClick, title = "O'chirish", size = 19 }: { onClick: () => void; title?: string; size?: number }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{ border: 'none', background: 'transparent', color: '#c3bece', cursor: 'pointer', fontSize: size, lineHeight: 1, padding: '2px 4px', flex: 'none' }}
    >
      ×
    </button>
  )
}

// ============================ Sarlavha paneli ============================

interface HeaderProps {
  /** Kichik sarlavha ostidagi matn ("Yangi mashq" yoki topshiriq nomi). */
  subtitle: string
  saving?: boolean
  saved?: boolean
  accent: string
  onCancel: () => void
  onSave?: () => void
  /** Saqlash tugmasi ko'rsatilmasin (tur tanlash ekrani). */
  hideSave?: boolean
}

export function ConstructorHeader({ subtitle, saving, saved, accent, onCancel, onSave, hideSave }: HeaderProps) {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', background: UI.bar, color: '#fff', position: 'sticky', top: 0, zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6a5cff,#8b7bff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, ...display,
          }}
        >
          T
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 13, color: UI.barMuted, fontWeight: 500 }}>Test konstruktori</span>
          <span style={{ fontWeight: 600, fontSize: 16, ...display }}>{subtitle}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...sans, background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: '#d7d5df', fontWeight: 500, fontSize: 14, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' }}
        >
          {hideSave ? 'Yopish' : 'Bekor qilish'}
        </button>
        {!hideSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              ...sans, background: saved ? UI.ok : accent, border: 'none', color: '#fff', fontWeight: 600, fontSize: 14,
              padding: '9px 18px', borderRadius: 9, cursor: saving ? 'default' : 'pointer', transition: 'background .15s', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saqlanmoqda…' : saved ? 'Saqlandi ✓' : 'Saqlash'}
          </button>
        )}
      </div>
    </header>
  )
}

// ============================ Tur banneri ============================

interface BannerProps {
  accent: string
  /** Banner fon gradienti (turga mos yumshoq rang). */
  tint: [string, string]
  icon: string
  title: string
  badge: string
  desc: string
  lang: Lang
  onLang: (l: Lang) => void
  /** Qo'shimcha boshqaruv (masalan "Bo'sh joy" tanlagichi). */
  extra?: ReactNode
}

export function TypeBanner({ accent, tint, icon, title, badge, desc, lang, onLang, extra }: BannerProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '18px 28px',
        background: `linear-gradient(90deg,${tint[0]},${tint[1]})`, borderBottom: '1px solid #e2ddf5', flexWrap: 'wrap',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontWeight: 700, fontSize: 19, color: UI.ink, ...display }}>{title}</span>
          <span
            style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
              color: accent, background: '#fff', padding: '3px 9px', borderRadius: 20,
            }}
          >
            {badge}
          </span>
        </div>
        <span style={{ fontSize: 14, color: UI.muted }}>{desc}</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {extra}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#8b8798' }}>Til</span>
          <select
            value={lang}
            onChange={(e) => onLang(e.target.value as Lang)}
            style={{ ...sans, fontSize: 14, fontWeight: 600, color: UI.ink, background: '#fff', border: '1px solid #ddd8ea', borderRadius: 9, padding: '8px 12px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="uz">O'zbek</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </div>
    </div>
  )
}

/** Banner ichidagi "Bo'sh joy" (___ / ···) tanlagichi — maketdagi kabi. */
export function BlankToggle({ value, onChange, accent }: { value: 'line' | 'dots'; onChange: (v: 'line' | 'dots') => void; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#8b8798' }}>Bo'sh joy</span>
      <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid #ddd8ea', borderRadius: 9, padding: 3 }}>
        {([
          ['line', '___'],
          ['dots', '···'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              ...sans, fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 7, padding: '5px 11px', cursor: 'pointer',
              background: value === v ? accent : 'transparent',
              color: value === v ? '#fff' : '#8b8798',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================ Ish maydoni ============================

export function Split({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(420px,1fr) minmax(380px,520px)', alignItems: 'stretch' }}>{children}</div>
  )
}

export function EditorPane({ children }: { children: ReactNode }) {
  return (
    <section style={{ padding: '26px 30px 30px', display: 'flex', flexDirection: 'column', gap: 16, borderRight: '1px solid #e0ddd4', minWidth: 0 }}>
      {children}
    </section>
  )
}

export function PreviewPane({ accent, hint, children }: { accent: string; hint: string; children: ReactNode }) {
  return (
    <section style={{ padding: '30px 30px 40px', background: UI.panel, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontWeight: 600, fontSize: 15, letterSpacing: '.02em', textTransform: 'uppercase', color: '#8a8677', ...display }}>
          Foydalanuvchi ko'rinishi
        </h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: accent, background: '#fff', padding: '5px 11px', borderRadius: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, display: 'inline-block' }} />
          Jonli
        </span>
      </div>
      {children}
      <p style={{ textAlign: 'center', fontSize: 12.5, color: '#96917f', margin: 0 }}>{hint}</p>
    </section>
  )
}

/** Telefon ramkasi — preview ichidagi qurilma ko'rinishi. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        alignSelf: 'center', width: 340, maxWidth: '100%', background: '#faf9ff', borderRadius: 30, padding: 14,
        boxShadow: '0 24px 50px -18px rgba(40,30,80,.4)', border: '1px solid #d9d4ea',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 520 }}>{children}</div>
    </div>
  )
}

/** Telefon ichidagi yuqori qism: orqaga strelkasi + progress + bo'lim nomi. */
export function PhoneHead({ accent, tint, progress, label, caption }: { accent: string; tint: string; progress: number; label: string; caption: string }) {
  return (
    <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f0eef7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.4} strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#eeecf6', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', background: accent, borderRadius: 4, transition: 'width .2s ease' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#b3adc6' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: accent, opacity: 0.75 }}>{caption}</div>
    </div>
  )
}

/** Ro'yxat sarlavhasi: "GAPLAR" + "3 ta gap" hisoblagichi. */
export function SectionHead({ title, count }: { title: string; count: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0, fontWeight: 600, fontSize: 15, letterSpacing: '.02em', textTransform: 'uppercase', color: '#9793a3', ...display }}>{title}</h2>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8b8798', background: '#e6e2d9', padding: '4px 11px', borderRadius: 20 }}>{count}</span>
    </div>
  )
}

/** Aylanadigan ro'yxat konteyneri (maketdagi `.slist`). */
export function ScrollList({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: '52vh', paddingRight: 4 }}>{children}</div>
  )
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', fontSize: 14, color: '#a7a2b6', padding: 20, border: '1px dashed #d4cfe0', borderRadius: 12 }}>{text}</div>
  )
}

/** Pastdagi "yangi element qo'shish" bloki. */
export function AddPanel({
  label, placeholder, value, onChange, onAdd, hint, btnLabel = "Qo'shish",
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onAdd: () => void
  hint?: string
  btnLabel?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f4f2ec', border: '1px solid #e2ded4', borderRadius: 14, padding: '14px 15px', marginTop: 2 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#514d63' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={onAdd} style={darkBtn}>
          {btnLabel}
        </button>
      </div>
      {hint && <span style={{ fontSize: 12.5, color: '#948fa2' }}>{hint}</span>}
    </div>
  )
}

/** Element kartasi (ro'yxatdagi bitta gap/savol) — tanlangani aksent bilan ajraladi. */
export function ItemCard({
  active, accent, num, onSelect, children, onRemove,
}: {
  active: boolean
  accent: string
  num: number
  onSelect: () => void
  children: ReactNode
  onRemove: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: '#fff', borderRadius: 14, padding: '13px 14px', cursor: 'pointer',
        border: active ? `1.5px solid ${accent}` : '1.5px solid #ece9f3',
        boxShadow: active ? `0 10px 22px -14px ${accent}` : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            flex: 'none', width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, ...display,
            background: active ? accent : '#f2f0f9',
            color: active ? '#fff' : '#8b8798',
          }}
        >
          {num}
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
        <RemoveBtn onClick={onRemove} />
      </div>
    </div>
  )
}

// ============================ Toast va tasdiq ============================

export function Toast({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 10, background: UI.ok, color: '#fff', fontWeight: 600, fontSize: 14.5,
        padding: '12px 20px', borderRadius: 12, boxShadow: '0 12px 30px -8px rgba(31,157,85,.55)', ...sans,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {text}
    </div>
  )
}

export function ConfirmExit({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div
      onClick={onStay}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(23,22,31,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: '26px 26px 22px', maxWidth: 380, width: '100%', boxShadow: '0 30px 60px -20px rgba(23,22,31,.5)' }}
      >
        <h3 style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 19, color: UI.ink, ...display }}>Chiqishni tasdiqlaysizmi?</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14.5, lineHeight: 1.5, color: UI.muted }}>Saqlanmagan o'zgarishlar yo'qoladi.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onStay} style={{ ...sans, background: '#f1eff8', border: 'none', color: '#514d63', fontWeight: 600, fontSize: 14, padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}>
            Davom etish
          </button>
          <button type="button" onClick={onLeave} style={{ ...sans, background: UI.danger, border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}>
            Ha, chiqish
          </button>
        </div>
      </div>
    </div>
  )
}

/** Toastni 1.6 soniyada avtomatik o'chiradigan holat. */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(t)
  }, [toast])
  return { toast, setToast }
}

// ============================ Media yuklagichlar ============================

/** Audio yuklash tugmasi + yuklangan fayl qatori (maketdagi ko'rinish). */
export function AudioPicker({
  accent, url, name, onChange,
}: {
  accent: string
  url?: string
  name?: string
  onChange: (url: string, name: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const res = await uploadAdminFile(file)
      onChange(res.url, file.name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      <label
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', ...sans, fontWeight: 600, fontSize: 13,
          color: accent, background: '#fff', border: `1px solid ${accent}33`, borderRadius: 9, padding: '8px 13px', cursor: 'pointer',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <rect x="4" y="15" width="16" height="6" rx="2" />
        </svg>
        {busy ? 'Yuklanmoqda…' : url ? 'Audioni almashtirish' : 'Audio yuklash'}
        <input ref={ref} type="file" accept="audio/*" onChange={pick} style={{ display: 'none' }} />
      </label>
      {url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: UI.muted, background: '#f4f2fc', borderRadius: 8, padding: '6px 10px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'audio'}</span>
          <RemoveBtn onClick={() => onChange('', '')} size={15} />
        </div>
      )}
    </div>
  )
}

/** Rasm yuklash kvadrati (maketdagi `image-slot` o'rnida — haqiqiy yuklash bilan). */
export function ImagePicker({
  url, onChange, size = 76, radius = 11, label = 'Rasm',
}: {
  url?: string
  onChange: (url: string) => void
  size?: number
  radius?: number
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const res = await uploadAdminFile(file)
      onChange(res.url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'relative', flex: 'none' }} onClick={(e) => e.stopPropagation()}>
      <label
        style={{
          width: size, height: size, borderRadius: radius, overflow: 'hidden', border: '1px solid #e5e1ef', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: url ? '#fff' : 'linear-gradient(135deg,#efe9fd,#f5f2ff)',
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#b4a9ee', fontSize: 11, fontWeight: 600 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b4a9ee" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
            {busy ? '…' : label}
          </span>
        )}
        <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
      </label>
      {url && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Rasmni olib tashlash"
          style={{
            position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none',
            background: '#fff', color: '#8b8798', boxShadow: '0 2px 6px -1px rgba(0,0,0,.25)', cursor: 'pointer', fontSize: 13, lineHeight: '18px', padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Preview ichidagi audio tugmasi (o'ynatadi). */
export function PlayButton({ accent, tint, url, label }: { accent: string; tint: string; url?: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const toggle = () => {
    if (!url) return
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      void audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: tint, border: 'none', borderRadius: 14,
        padding: '12px 14px', cursor: url ? 'pointer' : 'default', ...sans, fontSize: 14, fontWeight: 600, color: accent, opacity: url ? 1 : 0.55,
      }}
    >
      <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </span>
      <span style={{ flex: 1, textAlign: 'left' }}>{label ?? (url ? (playing ? 'To\'xtatish' : 'Tinglash') : 'Audio yuklanmagan')}</span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 20 }}>
        {[9, 15, 20, 12, 16].map((h, i) => (
          <span key={i} style={{ width: 3, height: playing ? h : 6, background: accent, opacity: playing ? 1 : 0.4, borderRadius: 2, transition: 'height .2s ease' }} />
        ))}
      </span>
    </button>
  )
}

/** Natija paneli (to'g'ri / xato). */
export function ResultBar({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      style={{
        borderRadius: 12, padding: '11px 14px', fontSize: 14, fontWeight: 600,
        background: ok ? '#e6f6ec' : '#fdeaea',
        color: ok ? '#1f7a45' : '#b03434',
      }}
    >
      {text}
    </div>
  )
}

/** Preview pastidagi "↺ / Tekshirish" tugmalari. */
export function CheckBar({ accent, onReset, onCheck, disabled }: { accent: string; onReset: () => void; onCheck: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" onClick={onReset} style={{ ...ghostBtn, flex: 'none' }} title="Qayta boshlash">
        ↺
      </button>
      <button
        type="button"
        onClick={onCheck}
        disabled={disabled}
        style={{
          ...sans, flex: 1, background: disabled ? '#d9d5e6' : accent, border: 'none', color: '#fff', fontWeight: 700, fontSize: 15,
          padding: '14px 16px', borderRadius: 13, cursor: disabled ? 'default' : 'pointer',
        }}
      >
        Tekshirish
      </button>
    </div>
  )
}
