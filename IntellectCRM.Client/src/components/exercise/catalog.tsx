/**
 * MASHQ TURLARI KATALOGI — "Topshiriq yaratish" ekranidagi kategoriyalar, turlar va ularning
 * mini "foydalanuvchi ko'rinishi" previewlari. Dizayn maketidagi tuzilma va ranglar aynan
 * saqlangan (kartalar, badge'lar, ikonlar).
 */
import type { CSSProperties, ReactNode } from 'react'
import type { ExerciseKind } from './model'

// ============================ Dizayn tokenlari ============================

export const UI = {
  /** Sahifa foni (maketdagi issiq kulrang). */
  page: '#efece6',
  /** Qorong'i yuqori panel. */
  bar: '#17161f',
  barMuted: '#8f8ca0',
  /** Asosiy binafsha aksent. */
  accent: '#6a5cff',
  accentSoft: '#8b7bff',
  ink: '#241f3a',
  muted: '#6e6a80',
  line: '#e5e1d7',
  panel: '#e7e3db',
  ok: '#1f9d55',
  danger: '#d64545',
} as const

export const display: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
export const sans: CSSProperties = { fontFamily: "'Figtree', system-ui, sans-serif" }

/** Bitta mashq turining rang sxemasi — maketdagi qiymatlar (aksent, telefon ramkasi, yumshoq fon). */
export interface Theme {
  accent: string
  /** Telefon ramkasi foni va chegarasi. */
  phone: string
  phoneBorder: string
  /** Sarlavhadagi ikon kvadrati foni. */
  head: string
  /** "Gapni tuzing" kabi kichik sarlavha rangi. */
  caption: string
  /** Izoh/tarjima blokining foni. */
  soft: string
  /** Ichki ajratuvchi chiziq. */
  line: string
}

/** Har kategoriyaning maketdagi rang sxemasi. */
export const THEMES: Record<string, Theme> = {
  sentence: { accent: '#6a5cff', phone: '#faf9ff', phoneBorder: '#d9d4ea', head: '#efecfd', caption: '#a49edb', soft: '#f5f3ff', line: '#f0eef7' },
  'sentence-choice': { accent: '#6a5cff', phone: '#faf9ff', phoneBorder: '#d9d4ea', head: '#efecfd', caption: '#a49edb', soft: '#f5f3ff', line: '#f0eef7' },
  fill: { accent: '#2f80ed', phone: '#f7faff', phoneBorder: '#d4e0ee', head: '#e7f0fd', caption: '#8fb4e6', soft: '#eff5ff', line: '#eef2f8' },
  wordpick: { accent: '#0d9488', phone: '#f4fbfa', phoneBorder: '#cfe6e2', head: '#e0f2f0', caption: '#6cc0b8', soft: '#eefaf8', line: '#eef4f3' },
  wordfind: { accent: '#d97706', phone: '#fffbf3', phoneBorder: '#eaddc4', head: '#fbeed3', caption: '#e0a75a', soft: '#fdf6e9', line: '#f4ecdd' },
  reading: { accent: '#c2410c', phone: '#fffaf6', phoneBorder: '#ecd8c9', head: '#fbe4d5', caption: '#e08a5a', soft: '#fdf3ec', line: '#f5e6dc' },
  test: { accent: '#0369a1', phone: '#f6fbfe', phoneBorder: '#d2e3ee', head: '#e2f0f9', caption: '#7fb6d8', soft: '#eef7fd', line: '#e9f1f7' },
  writing: { accent: '#1d4ed8', phone: '#f7f9ff', phoneBorder: '#d5deef', head: '#e6edfd', caption: '#8fa5df', soft: '#eef2fc', line: '#e8edf9' },
  speaking: { accent: '#be185d', phone: '#fff9fc', phoneBorder: '#eed3e0', head: '#fbe7f0', caption: '#dd8fb2', soft: '#fdf1f6', line: '#f7e6ee' },
  matching: { accent: '#1a6b52', phone: '#f5faf7', phoneBorder: '#cfe3d8', head: '#e3f0ea', caption: '#6fae95', soft: '#eaf3ef', line: '#e7f0ea' },
}

/** Har kategoriyaning o'z aksent rangi — maketlardagi ranglar. */
export const ACCENTS: Record<string, string> = Object.fromEntries(
  Object.entries(THEMES).map(([k, v]) => [k, v.accent]),
)

// ============================ Ikonlar (maketdagi svg path'lar) ============================

const ICON_PATHS: Record<string, ReactNode> = {
  blocks: (
    <>
      <rect x="2" y="6" width="6" height="6" rx="1.5" />
      <rect x="10" y="6" width="5" height="6" rx="1.5" />
      <rect x="17" y="6" width="5" height="6" rx="1.5" />
      <path d="M4 17h16" />
    </>
  ),
  play: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 010 7" />
      <path d="M18.5 5.5a9 9 0 010 13" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M21 15l-5-5-8 8" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4" cy="6" r="1.4" />
      <circle cx="4" cy="12" r="1.4" />
      <circle cx="4" cy="18" r="1.4" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </>
  ),
  wave: <path d="M4 12h4l2 5 4-10 2 5h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  link: (
    <>
      <path d="M7 8H4a2 2 0 00-2 2v0a2 2 0 002 2h3" />
      <path d="M17 12h3a2 2 0 012 2v0a2 2 0 01-2 2h-3" />
      <path d="M8 10h8" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2z" />
      <path d="M20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <path d="M12 18v3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
}

export function Icon({ name, size = 20, color = '#fff', width = 2 }: { name: string; size?: number; color?: string; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name] ?? ICON_PATHS.list}
    </svg>
  )
}

// ============================ Katalog ============================

export type PreviewKind =
  | 'order' | 'audio' | 'image' | 'choice' | 'fill' | 'inline' | 'pool'
  | 'match' | 'reading' | 'writing' | 'speaking' | 'testimg' | 'testimgopts'

export interface ExerciseType {
  kind: ExerciseKind
  name: string
  desc: string
  preview: PreviewKind
  icon: string
}

export interface ExerciseCategory {
  id: string
  label: string
  title: string
  desc: string
  types: ExerciseType[]
}

export const CATEGORIES: ExerciseCategory[] = [
  {
    id: 'sentence',
    label: 'Make sentence',
    title: 'Gap tuzish turini tanlang',
    desc: "\"Make sentence\" bir nechta turga bo'linadi. Kerakli turini tanlab, gaplarni kiritishga o'tasiz.",
    types: [
      { kind: 'sentence-order', preview: 'order', name: "So'z tartibi", desc: "Aralashtirilgan so'zlardan to'g'ri gapni yig'ish.", icon: 'blocks' },
      { kind: 'sentence-audio', preview: 'audio', name: "Audio bo'yicha", desc: "Audioni tinglab, so'zlardan gap yig'ish.", icon: 'play' },
      { kind: 'sentence-image', preview: 'image', name: "Rasm bo'yicha", desc: "Rasmga qarab, so'zlardan gap yig'ish.", icon: 'image' },
      { kind: 'sentence-choice', preview: 'choice', name: 'Variant tanlash', desc: "Bir nechta gapdan to'g'risini tanlash.", icon: 'list' },
    ],
  },
  {
    id: 'fill',
    label: "Bo'sh joyni to'ldirish",
    title: "Bo'sh joyni to'ldirish turini tanlang",
    desc: "Gapdagi bo'sh joyni (___ yoki ···) to'ldirish. To'rt xil turda mavjud.",
    types: [
      { kind: 'fill-choose', preview: 'choice', name: 'Variant tanlash', desc: "Bo'sh joyga variantlardan to'g'ri so'zni tanlash.", icon: 'list' },
      { kind: 'fill-write', preview: 'fill', name: "So'z yozish", desc: "Bo'sh joyga to'g'ri so'zni yozib qo'yish.", icon: 'edit' },
      { kind: 'fill-audio', preview: 'audio', name: "Audio bo'yicha", desc: "Audioni tinglab, bo'sh joyni to'ldirish.", icon: 'play' },
      { kind: 'fill-image', preview: 'image', name: "Rasm bo'yicha", desc: "Rasmga qarab, bo'sh joyni to'ldirish.", icon: 'image' },
    ],
  },
  {
    id: 'wordpick',
    label: "So'z tanlash",
    title: "So'z tanlash turini tanlang",
    desc: "Gap ichidagi variantlardan (bir/*ikki) to'g'ri so'zni tanlash.",
    types: [
      { kind: 'wordpick-plain', preview: 'inline', name: 'Oddiy gap', desc: "Gap ichidan to'g'ri so'zni tanlash.", icon: 'wave' },
      { kind: 'wordpick-image', preview: 'image', name: "Rasm bo'yicha", desc: "Rasmga qarab, so'zni tanlash.", icon: 'image' },
      { kind: 'wordpick-audio', preview: 'audio', name: "Audio bo'yicha", desc: "Audioni tinglab, so'zni tanlash.", icon: 'play' },
    ],
  },
  {
    id: 'wordfind',
    label: "So'z topish",
    title: "So'z topish turini tanlang",
    desc: "Gap beriladi, bir nechta so'zdan gapga mos tushadiganini topish.",
    types: [
      { kind: 'wordfind-plain', preview: 'pool', name: 'Oddiy gap', desc: "So'zlardan gapga mos tushadiganini topish.", icon: 'search' },
      { kind: 'wordfind-image', preview: 'image', name: "Rasm bo'yicha", desc: "Rasmga qarab, mos so'zni topish.", icon: 'image' },
      { kind: 'wordfind-audio', preview: 'audio', name: "Audio bo'yicha", desc: "Audioni tinglab, mos so'zni topish.", icon: 'play' },
    ],
  },
  {
    id: 'reading',
    label: 'Reading',
    title: 'Reading turini tanlang',
    desc: "Matn beriladi, foydalanuvchi o'qib savollarga javob beradi. To'rt xil turda mavjud.",
    types: [
      { kind: 'reading-choice', preview: 'reading', name: 'Variant tanlash', desc: "Matn bo'yicha variantlardan to'g'risini tanlash.", icon: 'list' },
      { kind: 'reading-truefalse', preview: 'reading', name: "To'g'ri / Xato", desc: "Fikr matnga mos yoki nomosligini aniqlash.", icon: 'check' },
      { kind: 'reading-fill', preview: 'reading', name: "Bo'sh joyni to'ldirish", desc: "Matn asosida bo'sh joyni to'ldirish.", icon: 'edit' },
      { kind: 'reading-short', preview: 'reading', name: 'Qisqa javob', desc: "Matn bo'yicha savolga qisqa javob yozish.", icon: 'book' },
    ],
  },
  {
    id: 'test',
    label: 'Test',
    title: 'Test turini tanlang',
    desc: 'Savol va variantlar kiritiladi. Rasmli yoki oddiy ko\'rinishda.',
    types: [
      { kind: 'test-image', preview: 'testimg', name: 'Rasmli test', desc: "Savolga rasm qo'yiladi, variantlardan to'g'risi tanlanadi.", icon: 'image' },
      { kind: 'test-imageopts', preview: 'testimgopts', name: 'Rasmli variantlar', desc: 'Variantlar rasm ko\'rinishida beriladi.', icon: 'grid' },
      { kind: 'test-audio', preview: 'audio', name: "Audio bo'yicha", desc: "Audioni tinglab, variantlardan to'g'risi tanlanadi.", icon: 'play' },
    ],
  },
  {
    id: 'prod',
    label: 'Writing & Speaking',
    title: 'Writing & Speaking turini tanlang',
    desc: 'Mavzu beriladi, foydalanuvchi matn yozadi yoki gapirib javob beradi.',
    types: [
      { kind: 'writing', preview: 'writing', name: 'Writing', desc: "Mavzu bo'yicha matn yozish.", icon: 'edit' },
      { kind: 'speaking', preview: 'speaking', name: 'Speaking', desc: "Mavzu bo'yicha gapirib javob berish.", icon: 'mic' },
    ],
  },
  {
    id: 'match',
    label: 'Moslashtirish',
    title: 'Moslashtirish',
    desc: "Chap va o'ng ustundagi juftliklarni bog'lash (Matching question).",
    types: [
      { kind: 'matching-plain', preview: 'match', name: 'Moslashtirish', desc: "So'z va tarjimalarni juftlab bog'lash.", icon: 'link' },
      { kind: 'matching-reading', preview: 'match', name: 'Reading', desc: 'Matn beriladi, moslarini topib bog\'lash.', icon: 'book' },
      { kind: 'matching-audio', preview: 'match', name: "Audio bo'yicha", desc: "Audioni tinglab, moslarini topib bog'lash.", icon: 'play' },
    ],
  },
]

const BY_KIND = new Map<ExerciseKind, { cat: ExerciseCategory; type: ExerciseType }>()
for (const cat of CATEGORIES) for (const type of cat.types) BY_KIND.set(type.kind, { cat, type })

/** Tur bo'yicha katalog yozuvi (nomi, tavsifi, kategoriyasi). */
export function kindInfo(kind: ExerciseKind) {
  return BY_KIND.get(kind)
}

/** "Gap tuzish · So'z tartibi" ko'rinishidagi to'liq nom. */
export function kindTitle(kind: ExerciseKind): string {
  const info = BY_KIND.get(kind)
  if (!info) return 'Mashq'
  return `${info.cat.label} · ${info.type.name}`
}

/** Turning rang sxemasi (oila bo'yicha — model.kindFamily bilan bir xil guruhlash). */
export function kindTheme(kind: ExerciseKind): Theme {
  if (kind === 'sentence-choice') return THEMES['sentence-choice']
  if (kind === 'writing') return THEMES.writing
  if (kind === 'speaking') return THEMES.speaking
  const family = kind.split('-')[0]
  return THEMES[family] ?? THEMES.sentence
}

/** Kategoriya (yoki tur) aksent rangi. */
export function kindAccent(kind: ExerciseKind): string {
  return kindTheme(kind).accent
}

// ============================ Mini previewlar (karta ichidagi) ============================

const chip = (text: string, i: number) => (
  <span
    key={i}
    style={{ fontSize: 11.5, fontWeight: 600, color: '#3a3552', background: '#fff', border: '1.2px solid #e2def0', borderRadius: 6, padding: '4px 8px' }}
  >
    {text}
  </span>
)

const wave = (heights: number[], colors: string[]) => (
  <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
    {heights.map((h, i) => (
      <span key={i} style={{ width: 3, height: h, background: colors[i % colors.length], borderRadius: 2 }} />
    ))}
  </span>
)

const imgIcon = (stroke: string, size = 24) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9" r="1.5" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
)

/** Karta ichidagi "Foydalanuvchi ko'rinishi" mini maketi — maketdagi har bir variant. */
export function MiniPreview({ preview, kind }: { preview: PreviewKind; kind: ExerciseKind }) {
  switch (preview) {
    case 'order':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#9490a6' }}>"I go running every morning"</div>
          <div style={{ display: 'flex', gap: 5, borderBottom: '1.5px dashed #e6e2f2', paddingBottom: 9, flexWrap: 'wrap' }}>
            {['Men', 'har'].map((t, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', background: '#6a5cff', borderRadius: 6, padding: '4px 8px' }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{['yugurishni', 'kuni', 'yaxshi', "ko'raman"].map(chip)}</div>
        </div>
      )
    case 'audio':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: '#6a5cff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            </span>
            {wave([8, 16, 22, 13, 18, 9, 15, 7], ['#cfc8ec', '#a99cf0', '#6a5cff', '#a99cf0', '#8b7bff', '#cfc8ec', '#a99cf0', '#cfc8ec'])}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', borderTop: '1.5px dashed #e6e2f2', paddingTop: 9 }}>
            {['kuni', 'har', 'Men', 'yaxshi'].map(chip)}
          </div>
        </div>
      )
    case 'image':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 52, borderRadius: 9, background: 'linear-gradient(135deg,#efe9fd,#f5f2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ece7f9' }}>
            {imgIcon('#b4a9ee')}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{['bola', 'olma', 'yemoqda'].map(chip)}</div>
        </div>
      )
    case 'choice':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5f5a78' }}>To'g'ri tarjimani tanlang:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { t: 'He runs slowly', on: false },
              { t: 'I run every morning', on: true },
              { t: 'She likes reading', on: false },
            ].map((o, i) => (
              <span
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, borderRadius: 8, padding: '6px 9px',
                  fontWeight: o.on ? 600 : 400,
                  color: o.on ? '#3a2f6a' : '#6e6a80',
                  background: o.on ? '#efecfd' : '#fff',
                  border: o.on ? '1.4px solid #6a5cff' : '1.2px solid #e6e2f2',
                }}
              >
                <span style={{ width: 11, height: 11, borderRadius: '50%', border: o.on ? '3.5px solid #6a5cff' : '1.5px solid #cfc8e0', display: 'inline-block' }} />
                {o.t}
              </span>
            ))}
          </div>
        </div>
      )
    case 'fill':
      return (
        <div style={{ padding: '14px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#3a3552' }}>
            Bu <span style={{ borderBottom: '2px solid #6a5cff', padding: '0 14px', color: 'transparent' }}>x</span> juda qiziqarli
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#faf9ff', border: '1.2px solid #e2def0', borderRadius: 8, padding: '7px 9px' }}>
            <span style={{ fontSize: 11.5, color: '#b6b0c8' }}>javobni yozing…</span>
            <span style={{ marginLeft: 'auto', width: 1.5, height: 13, background: '#6a5cff', display: 'inline-block' }} />
          </div>
        </div>
      )
    case 'inline':
      return (
        <div style={{ padding: '16px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, lineHeight: 2, color: '#3a3552' }}>
            Men
            <span style={{ display: 'inline-flex', gap: 4, verticalAlign: 'middle', margin: '0 3px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 7, padding: '3px 9px', background: '#fff', border: '1.4px solid #cfe6e2', color: '#6e6a80' }}>bir</span>
              <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 7, padding: '3px 9px', background: '#0d9488', border: '1.4px solid #0d9488', color: '#fff' }}>ikki</span>
            </span>
            olma yedim
          </div>
        </div>
      )
    case 'pool':
      return (
        <div style={{ padding: '14px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#3a3552' }}>
            Men har kuni{' '}
            <span style={{ display: 'inline-block', minWidth: 44, borderRadius: 6, background: '#fbeed3', border: '1.4px dashed #e6b567', verticalAlign: 'middle', height: 15 }} /> yaxshi
            ko'raman
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['yugurishni', 'uxlashni', 'kitobni'].map((t, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: '#4a3411', background: '#fff', border: '1.2px solid #ecdcbf', borderRadius: 6, padding: '4px 8px' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )
    case 'testimg':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ height: 56, borderRadius: 9, background: 'linear-gradient(135deg,#e2f0f9,#f0f8fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #dceaf3' }}>
            {imgIcon('#8ec2e0')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, color: '#08496b', background: '#e2f0f9', border: '1.3px solid #0369a1', borderRadius: 7, padding: '5px 8px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', border: '3px solid #0369a1', display: 'inline-block' }} />
              Olma
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#6e6a80', background: '#fff', border: '1.2px solid #dae5ec', borderRadius: 7, padding: '5px 8px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #ccd9e2', display: 'inline-block' }} />
              Banan
            </span>
          </div>
        </div>
      )
    case 'testimgopts':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#132c3a' }}>Qaysi rasmda olma bor?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[true, false, false, false].map((on, i) => (
              <span
                key={i}
                style={{
                  height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? '#e2f0f9' : '#f7fafc',
                  border: on ? '2px solid #0369a1' : '1.5px solid #dae5ec',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={on ? '#0369a1' : '#b9cbd6'} strokeWidth={1.9} strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M21 16l-5-5-9 9" />
                </svg>
              </span>
            ))}
          </div>
        </div>
      )
    case 'writing':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ background: '#eef2fc', borderRadius: 8, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8fa5df' }}>Mavzu</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16224a' }}>Mening yozgi ta'tilim</span>
          </div>
          <div style={{ background: '#fafbfe', border: '1.3px solid #dbe2f2', borderRadius: 8, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 44 }}>
            {[90, 75, 45].map((w, i) => (
              <span key={i} style={{ height: 5, width: `${w}%`, borderRadius: 3, background: '#e4e9f6', display: 'inline-block' }} />
            ))}
          </div>
        </div>
      )
    case 'speaking':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ background: '#fdf1f6', borderRadius: 8, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#dd8fb2' }}>Mavzu</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4a1030' }}>Sevimli kitobingiz haqida</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#be185d', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="mic" size={16} />
            </span>
            {wave([8, 16, 22, 13, 18, 9], ['#f0b8d0', '#e8578f', '#be185d', '#e8578f', '#d64d86', '#f0b8d0'])}
          </div>
        </div>
      )
    case 'reading':
      return (
        <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ background: '#fdf3ec', borderRadius: 8, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[100, 85, 60].map((w, i) => (
              <span key={i} style={{ height: 6, width: `${w}%`, borderRadius: 3, background: '#f0dccc', display: 'inline-block' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4a40' }}>How does Ali go to school?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, color: '#8a2f0a', background: '#fbeadf', border: '1.3px solid #c2410c', borderRadius: 7, padding: '5px 8px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', border: '3px solid #c2410c', display: 'inline-block' }} />
              By bus
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#6e6a80', background: '#fff', border: '1.2px solid #ecd8c9', borderRadius: 7, padding: '5px 8px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #d8c4b6', display: 'inline-block' }} />
              By car
            </span>
          </div>
        </div>
      )
    case 'match':
    default: {
      const cell = { padding: 2, borderLeft: '1px solid #eae5f3', borderTop: '1px solid #eae5f3' } as CSSProperties
      const tick = (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 16, borderRadius: 3, background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>
      )
      return (
        <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {kind === 'matching-reading' && (
            <div style={{ background: '#f5f0ff', borderRadius: 7, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[100, 72].map((w, i) => (
                <span key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: '#e2d8f6', display: 'inline-block' }} />
              ))}
            </div>
          )}
          {kind === 'matching-audio' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f5f0ff', borderRadius: 7, padding: '6px 8px' }}>
              <span style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
              </span>
              <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
                {[5, 10, 12, 7].map((h, i) => (
                  <span key={i} style={{ width: 2, height: h, background: ['#c4b0ee', '#9b76e8', '#7c3aed', '#9b76e8'][i], borderRadius: 1 }} />
                ))}
              </span>
            </div>
          )}
          <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #eae5f3', borderRadius: 6 }}>
            <tbody>
              <tr style={{ background: '#f7f5fc' }}>
                <td style={{ padding: '4px 6px' }} />
                {['A', 'B', 'C'].map((l) => (
                  <td key={l} style={{ padding: '4px 0', textAlign: 'center', fontWeight: 700, fontSize: 9, color: '#8b86a0', borderLeft: '1px solid #eae5f3', ...display }}>
                    {l}
                  </td>
                ))}
              </tr>
              {[
                { label: '1. apple', at: 0 },
                { label: '2. book', at: 1 },
              ].map((r) => (
                <tr key={r.label}>
                  <td style={{ padding: '3px 6px', fontSize: 9.5, fontWeight: 700, color: '#33234f', borderTop: '1px solid #eae5f3', whiteSpace: 'nowrap' }}>{r.label}</td>
                  {[0, 1, 2].map((c) => (
                    <td key={c} style={cell}>
                      {r.at === c ? tick : <span style={{ display: 'block', height: 16 }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
  }
}
