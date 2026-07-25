/**
 * "TOPSHIRIQ YARATISH" — mashq TURINI tanlash ekrani (maketning aynan ko'chirmasi):
 * qorong'i sarlavha + kategoriya tablari, har kategoriya uchun tur kartalari, kartada esa
 * o'sha turning mini "foydalanuvchi ko'rinishi" previewi va "Yaratishni boshlash" tugmasi.
 */
import { useState } from 'react'
import type { ExerciseKind } from './model'
import { CATEGORIES, MiniPreview, UI, display, sans, Icon } from './catalog'
import { ConstructorHeader } from './kit'

interface Props {
  /** Hozir tanlangan tur (mavjud mashq tahrirlanayotgan bo'lsa) — karta belgilanadi. */
  current?: ExerciseKind | null
  onPick: (kind: ExerciseKind) => void
  onClose: () => void
}

export function ExercisePicker({ current, onPick, onClose }: Props) {
  const [catId, setCatId] = useState(() => {
    if (!current) return CATEGORIES[0].id
    return CATEGORIES.find((c) => c.types.some((t) => t.kind === current))?.id ?? CATEGORIES[0].id
  })
  const active = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0]
  const cols = Math.min(4, Math.max(1, active.types.length))

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: UI.page, ...sans }}>
      <ConstructorHeader subtitle="Topshiriqlar" accent={UI.accent} onCancel={onClose} hideSave />

      {/* Kategoriya tablari */}
      <div style={{ background: UI.bar, padding: '0 28px', display: 'flex', gap: 2, overflowX: 'auto' }}>
        {CATEGORIES.map((c) => {
          const on = c.id === active.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatId(c.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', ...sans, fontWeight: 600, fontSize: 14.5,
                padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                borderBottom: `2.5px solid ${on ? '#8b7bff' : 'transparent'}`,
                color: on ? '#fff' : UI.barMuted,
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 1460, margin: '0 auto', padding: '48px 40px 64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a49edb' }}>Yangi topshiriq</span>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 32, letterSpacing: '-.02em', color: UI.ink, ...display }}>{active.title}</h1>
          <p style={{ margin: 0, fontSize: 16, color: UI.muted, maxWidth: 560 }}>{active.desc}</p>
        </div>

        <div
          style={{
            display: 'grid', gap: 18, alignItems: 'stretch',
            gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`,
            maxWidth: cols * 285 + (cols - 1) * 18,
          }}
        >
          {active.types.map((t) => {
            const chosen = current === t.kind
            return (
              <button
                key={t.kind}
                type="button"
                onClick={() => onPick(t.kind)}
                className="dc-tcard"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 16, padding: 16, position: 'relative',
                  overflow: 'hidden', minHeight: 330, textAlign: 'left', background: '#fff',
                  border: `1.5px solid ${chosen ? UI.accent : UI.line}`, cursor: 'pointer', ...sans,
                }}
              >
                {/* Mini "foydalanuvchi ko'rinishi" */}
                <div style={{ borderRadius: 13, overflow: 'hidden', background: '#fff', border: '1px solid #ece9f3', boxShadow: '0 2px 8px -4px rgba(40,30,80,.12)' }}>
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
                        padding: '3px 8px', borderRadius: 20, color: chosen ? '#4b3fd8' : '#1f9d55', background: chosen ? '#eceafd' : '#e6f6ec',
                      }}
                    >
                      {chosen ? 'Tanlangan' : 'Tayyor'}
                    </span>
                  </div>
                  <MiniPreview preview={t.preview} kind={t.kind} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: UI.accent }}>
                    <Icon name={t.icon} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16.5, color: UI.ink, ...display }}>{t.name}</h3>
                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: UI.muted }}>{t.desc}</p>
                  </div>
                </div>

                <span
                  className="dc-go"
                  style={{
                    alignSelf: 'flex-start', marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8,
                    fontSize: 14, fontWeight: 600, color: UI.accent, background: '#efecfd', padding: '10px 16px', borderRadius: 11, transition: 'all .15s',
                  }}
                >
                  {chosen ? 'Davom etish' : 'Yaratishni boshlash'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
