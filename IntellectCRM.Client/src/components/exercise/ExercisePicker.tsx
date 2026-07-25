/**
 * "TOPSHIRIQ YARATISH" — topshiriq TURINI tanlash ekrani (maketning aynan ko'chirmasi):
 * qorong'i sarlavha + kategoriya tablari, har kategoriya uchun tur kartalari, kartada esa
 * o'sha turning mini "foydalanuvchi ko'rinishi" previewi va "Yaratishni boshlash" tugmasi.
 *
 * OXIRGI tab — "Boshqa": interaktiv mashq bo'lmagan ESKI turlar (video, matn, audio, PDF,
 * lug'at, oddiy test). Ular tanlansa oddiy (eski) topshiriq yaratiladi.
 */
import { useEffect, useState } from 'react'
import type { LessonType } from '@/types'
import type { ExerciseKind } from './model'
import { CATEGORIES, LegacyPreview, MiniPreview, OTHER_CATEGORY, UI, display, sans, Icon } from './catalog'
import { ConstructorHeader } from './kit'

interface Props {
  /** Hozir tanlangan tur (mavjud mashq tahrirlanayotgan bo'lsa) — karta belgilanadi. */
  current?: ExerciseKind | null
  onPick: (kind: ExerciseKind) => void
  /** Berilsa — oxirgi "Boshqa" tabi ko'rinadi (eski topshiriq turlari). */
  onPickLegacy?: (type: LessonType) => void
  onClose: () => void
  /** Sarlavha ostidagi matn. */
  subtitle?: string
}

/** Karta ichidagi mini preview sarlavhasi. */
function CardHead({ badge, badgeOn }: { badge: string; badgeOn: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderBottom: '1px solid #f2f0f7', background: '#faf9ff' }}>
      <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: UI.accent, display: 'inline-block' }} />
      <span
        style={{
          flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
          color: '#a49edb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        Foydalanuvchi ko'rinishi
      </span>
      <span
        style={{
          flex: 'none', whiteSpace: 'nowrap', fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 20, color: badgeOn ? '#4b3fd8' : '#1f9d55', background: badgeOn ? '#eceafd' : '#e6f6ec',
        }}
      >
        {badge}
      </span>
    </div>
  )
}

/** Karta pastidagi ikon + nom + tavsif + harakat tugmasi. */
function CardBody({ icon, name, desc, cta }: { icon: string; name: string; desc: string; cta: string }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: UI.accent }}>
          <Icon name={icon} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16.5, color: UI.ink, ...display }}>{name}</h3>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: UI.muted }}>{desc}</p>
        </div>
      </div>
      <span
        className="dc-go"
        style={{
          alignSelf: 'flex-start', marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 14, fontWeight: 600, color: UI.accent, background: '#efecfd', padding: '10px 16px', borderRadius: 11, transition: 'all .15s',
        }}
      >
        {cta}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </>
  )
}

const cardStyle = (on: boolean) => ({
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 14,
  borderRadius: 16,
  padding: 16,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  minHeight: 330,
  textAlign: 'left' as const,
  background: '#fff',
  border: `1.5px solid ${on ? UI.accent : UI.line}`,
  cursor: 'pointer',
  ...sans,
})

export function ExercisePicker({ current, onPick, onPickLegacy, onClose, subtitle = 'Topshiriqlar' }: Props) {
  const tabs = onPickLegacy ? [...CATEGORIES, OTHER_CATEGORY] : CATEGORIES
  const [catId, setCatId] = useState(() => {
    if (!current) return CATEGORIES[0].id
    return CATEGORIES.find((c) => c.types.some((t) => t.kind === current))?.id ?? CATEGORIES[0].id
  })
  const active = tabs.find((c) => c.id === catId) ?? tabs[0]
  const isOther = active.id === OTHER_CATEGORY.id
  const cols = Math.min(4, Math.max(1, active.types.length))

  // Esc — yopish (CRM modallari bilan bir xil xulq).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // KATTA MODAL KARTA — ekranga sig'adi, ichki qismi aylanadi. z-index 40: CRM modallari (z-50,
    // nom so'rash / bir nechta nom) shu ekranning USTIDA ochiladi.
    <div
      className="dc-root"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(23,22,31,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px,3vh,28px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1280px,96vw)', maxHeight: '92vh', background: UI.page, borderRadius: 20, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', boxShadow: '0 40px 90px -30px rgba(23,22,31,.7)', ...sans,
        }}
      >
        <ConstructorHeader subtitle={subtitle} accent={UI.accent} onCancel={onClose} hideSave />

        {/* Kategoriya tablari — oxirgisi "Boshqa" (eski turlar), qolganlari bilan yonma-yon */}
        <div style={{ background: UI.bar, padding: '0 24px', display: 'flex', gap: 2, overflowX: 'auto', flex: 'none' }}>
          {tabs.map((c) => {
            const on = c.id === active.id
            const other = c.id === OTHER_CATEGORY.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatId(c.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', ...sans, fontWeight: 600, fontSize: 14,
                  padding: '13px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2.5px solid ${on ? '#8b7bff' : 'transparent'}`,
                  color: on ? '#fff' : UI.barMuted,
                  // "Boshqa" — boshqa guruh: chapdan nozik ajratuvchi bilan ajralib turadi.
                  borderLeft: other ? '1px solid rgba(255,255,255,.12)' : undefined,
                  marginLeft: other ? 8 : undefined,
                  paddingLeft: other ? 18 : undefined,
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', padding: '28px 32px 34px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a49edb' }}>
              {isOther ? 'Oddiy kontent' : 'Yangi topshiriq'}
            </span>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: 27, letterSpacing: '-.02em', color: UI.ink, ...display }}>{active.title}</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: UI.muted, maxWidth: 680 }}>{active.desc}</p>
          </div>

          <div
            style={{
              display: 'grid', gap: 16, alignItems: 'stretch',
              gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`,
              maxWidth: cols * 285 + (cols - 1) * 16,
            }}
          >
            {isOther
              ? OTHER_CATEGORY.types.map((t) => (
                  <button key={t.lesson} type="button" onClick={() => onPickLegacy?.(t.lesson)} className="dc-tcard" style={cardStyle(false)}>
                    <div style={{ borderRadius: 13, overflow: 'hidden', background: '#fff', border: '1px solid #ece9f3', boxShadow: '0 2px 8px -4px rgba(40,30,80,.12)' }}>
                      <CardHead badge="Oddiy" badgeOn={false} />
                      <LegacyPreview type={t.lesson} />
                    </div>
                    <CardBody icon={t.icon} name={t.name} desc={t.desc} cta="Yaratishni boshlash" />
                  </button>
                ))
              : (active as (typeof CATEGORIES)[number]).types.map((t) => {
                  const chosen = current === t.kind
                  return (
                    <button key={t.kind} type="button" onClick={() => onPick(t.kind)} className="dc-tcard" style={cardStyle(chosen)}>
                      <div style={{ borderRadius: 13, overflow: 'hidden', background: '#fff', border: '1px solid #ece9f3', boxShadow: '0 2px 8px -4px rgba(40,30,80,.12)' }}>
                        <CardHead badge={chosen ? 'Tanlangan' : 'Tayyor'} badgeOn={chosen} />
                        <MiniPreview preview={t.preview} kind={t.kind} />
                      </div>
                      <CardBody icon={t.icon} name={t.name} desc={t.desc} cta={chosen ? 'Davom etish' : 'Yaratishni boshlash'} />
                    </button>
                  )
                })}
          </div>
        </main>
      </div>
    </div>
  )
}
