/**
 * Marketing (Javobot) bo'limining umumiy qismi — ikonlar, kanal glyphlari,
 * tiplar, mock ma'lumotlar va sahifa o'rovchisi (wrapper).
 * Hozircha FAQAT UI — API keyin ulanadi (ma'lumotlar mock).
 */
import type { CSSProperties, ReactNode } from 'react'

/* ---------------- ICONS (line) ---------------- */
const Ic: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  rules: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  channels: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  ai: 'M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 6 0 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3zM12 8v8M8 12h8',
  analytics: 'M3 3v18h18M7 16l4-4 3 3 5-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14M5 12h14',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 18l6-6-6-6',
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

/* ---------------- CHANNEL brand glyphs (filled) ---------------- */
export type ChannelId = 'instagram' | 'telegram' | 'whatsapp' | 'messenger'
const ChannelGlyph: Record<ChannelId, string> = {
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.13-1.38.66-.66 1.07-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
  telegram: 'M23.07 3.36 19.6 19.73c-.26 1.16-.95 1.44-1.92.9l-5.3-3.9-2.56 2.46c-.28.28-.52.52-1.07.52l.38-5.4 9.84-8.89c.43-.38-.09-.59-.66-.21L6.62 13.43l-5.24-1.64c-1.14-.36-1.16-1.14.24-1.69L21.6 1.7c.95-.36 1.78.21 1.47 1.66z',
  whatsapp: 'M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.5 9.5 0 0 1-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.46 9.46 0 0 1-1.45-5.05c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.78a9.43 9.43 0 0 1 2.78 6.72c0 5.23-4.26 9.49-9.49 9.49zM20.5 3.49A11.45 11.45 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.07 1.56 5.85L.25 24l6.6-1.73a11.66 11.66 0 0 0 5.19 1.32h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28z',
  messenger: 'M12 0C5.24 0 0 4.95 0 11.64c0 3.5 1.44 6.53 3.77 8.62.2.18.32.43.32.7l.07 2.27c.02.72.76 1.2 1.42.9l2.53-1.12c.21-.09.45-.11.67-.05 1.1.3 2.26.46 3.45.46 6.76 0 12-4.95 12-11.64S18.76 0 12 0zm7.2 8.95-3.52 5.58c-.56.89-1.76 1.11-2.61.48l-2.8-2.1a.72.72 0 0 0-.86 0l-3.78 2.87c-.5.38-1.16-.22-.82-.75l3.52-5.58c.56-.89 1.76-1.11 2.61-.48l2.8 2.1c.26.19.6.19.86 0l3.78-2.87c.5-.38 1.16.22.82.75z',
}
export function ChannelIcon({ ch }: { ch: ChannelId }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d={ChannelGlyph[ch]} />
    </svg>
  )
}

/* ---------------- TYPES ---------------- */
export interface Channel { id: ChannelId; name: string; handle: string; cls: string }
export interface Rule {
  id: number; title: string; on: boolean; channels: ChannelId[]; keywords: string[];
  match: string; reply: string; ai: boolean; triggers: number; last: string
}
export interface ConvMsg { t: 'in' | 'out'; text: string; time: string; auto?: string }
export interface Conv {
  id: number; name: string; ch: ChannelId; color: string; snippet: string; time: string;
  unread: number; status: string; auto: boolean; msgs: ConvMsg[]
}
export interface WeekDay { d: string; auto: number; man: number }

/* ---------------- MOCK DATA ---------------- */
export const CHANNELS: Record<ChannelId, Channel> = {
  instagram: { id: 'instagram', name: 'Instagram', handle: '@mebel.lux', cls: 'ch-instagram' },
  telegram: { id: 'telegram', name: 'Telegram', handle: '@mebellux_bot', cls: 'ch-telegram' },
  whatsapp: { id: 'whatsapp', name: 'WhatsApp', handle: '+998 90 123 45 67', cls: 'ch-whatsapp' },
  messenger: { id: 'messenger', name: 'Messenger', handle: 'Mebel Lux', cls: 'ch-messenger' },
}

export const RULES: Rule[] = [
  { id: 1, title: "Narx so'rovlari", on: true, channels: ['instagram', 'telegram', 'whatsapp'], keywords: ['narx', 'qancha', 'narxi', 'price', 'почем', 'цена'], match: "Tarkibida bo'lsa", reply: "Assalomu alaykum! 😊 Narxlar haqida to'liq ma'lumot uchun katalogimizni yuboraman. Aniq mahsulot nomini yozsangiz, narxini darhol aytaman.", ai: true, triggers: 1284, last: '5 daqiqa oldin' },
  { id: 2, title: 'Ish vaqti va manzil', on: true, channels: ['instagram', 'telegram', 'whatsapp', 'messenger'], keywords: ['manzil', 'qayerda', 'ish vaqti', 'адрес', 'работаете'], match: "Tarkibida bo'lsa", reply: '📍 Manzil: Toshkent sh., Chilonzor 19-kvartal.\n🕗 Ish vaqti: Dush–Shan, 09:00–19:00.\nLokatsiya: maps.google.com/mebellux', ai: false, triggers: 642, last: '12 daqiqa oldin' },
  { id: 3, title: 'Yetkazib berish', on: true, channels: ['telegram', 'whatsapp'], keywords: ['yetkazib', 'dostavka', 'доставка', 'delivery'], match: "Tarkibida bo'lsa", reply: "🚚 Toshkent bo'ylab yetkazib berish 1–2 kun. Viloyatlarga 3–5 kun. 5 mln so'mdan yuqori buyurtmalarga bepul!", ai: false, triggers: 398, last: '1 soat oldin' },
  { id: 4, title: 'Salomlashish', on: true, channels: ['instagram', 'telegram', 'whatsapp', 'messenger'], keywords: ['salom', 'assalomu alaykum', 'hi', 'hello', 'привет'], match: 'Boshlansa', reply: "Assalomu alaykum! Mebel Lux'ga xush kelibsiz 🛋️ Sizga qanday yordam bera olaman?", ai: true, triggers: 2103, last: 'Hozirgina' },
  { id: 5, title: 'Rahmat / xayrlashuv', on: false, channels: ['instagram', 'telegram'], keywords: ['rahmat', 'spasibo', 'thanks', 'xayr'], match: "Tarkibida bo'lsa", reply: "Sizga ham rahmat! 🙏 Yana savollaringiz bo'lsa, bemalol yozing. Xaridingiz xayrli bo'lsin!", ai: false, triggers: 567, last: '3 soat oldin' },
]

export const CONVS: Conv[] = [
  { id: 1, name: 'Dilnoza Karimova', ch: 'instagram', color: '#e1306c', snippet: "Divan narxi qancha bo'ladi?", time: '2 daq', unread: 2, status: 'AI javob berdi', auto: true, msgs: [
    { t: 'in', text: 'Salom, divanlaringiz bormi?', time: '14:21' },
    { t: 'out', text: "Assalomu alaykum! Mebel Lux'ga xush kelibsiz 🛋️ Ha, turli xil divanlar mavjud. Qanaqasini qidiryapsiz?", time: '14:21', auto: 'Qoida: Salomlashish' },
    { t: 'in', text: 'Burchakli divan kerak edi', time: '14:23' },
    { t: 'in', text: "Divan narxi qancha bo'ladi?", time: '14:23' },
    { t: 'out', text: "Burchakli divanlarimiz 4.5 mln so'mdan boshlanadi 😊 Rang va o'lchamga qarab narx farq qiladi. Katalogni yuboraymi?", time: '14:24', auto: "AI + Qoida: Narx so'rovlari" },
  ] },
  { id: 2, name: 'Sardor Aliyev', ch: 'telegram', color: '#29a9eb', snippet: 'Yetkazib berish bormi?', time: '8 daq', unread: 0, status: 'AI javob berdi', auto: true, msgs: [
    { t: 'in', text: 'Yetkazib berish bormi Samarqandga?', time: '14:10' },
    { t: 'out', text: "🚚 Toshkent bo'ylab yetkazib berish 1–2 kun. Viloyatlarga 3–5 kun. 5 mln so'mdan yuqori buyurtmalarga bepul!", time: '14:10', auto: 'Qoida: Yetkazib berish' },
    { t: 'in', text: 'Rahmat, tushunarli', time: '14:12' },
  ] },
  { id: 3, name: 'Madina Yusupova', ch: 'whatsapp', color: '#25d366', snippet: "Operator bilan gaplashsam bo'ladimi?", time: '23 daq', unread: 1, status: 'Operator kutilmoqda', auto: false, msgs: [
    { t: 'in', text: 'Buyurtmamni qaytarmoqchiman', time: '13:48' },
    { t: 'out', text: 'Tushundim. Bu masala bo\'yicha sizni operatorimizga ulayman 🙏', time: '13:48', auto: 'AI' },
    { t: 'in', text: "Operator bilan gaplashsam bo'ladimi?", time: '13:49' },
  ] },
  { id: 4, name: 'Jasur Toshmatov', ch: 'instagram', color: '#9b59b6', snippet: 'Ish vaqtingiz nechigacha?', time: '41 daq', unread: 0, status: 'AI javob berdi', auto: true, msgs: [
    { t: 'in', text: 'Ish vaqtingiz nechigacha?', time: '13:30' },
    { t: 'out', text: '📍 Manzil: Toshkent sh., Chilonzor 19-kvartal.\n🕗 Ish vaqti: Dush–Shan, 09:00–19:00.', time: '13:30', auto: 'Qoida: Ish vaqti va manzil' },
  ] },
  { id: 5, name: 'Aziza Rahimova', ch: 'messenger', color: '#0084ff', snippet: 'Kreslo rangi qanaqalar bor?', time: '1 soat', unread: 0, status: 'AI javob berdi', auto: true, msgs: [
    { t: 'in', text: 'Kreslo rangi qanaqalar bor?', time: '13:05' },
    { t: 'out', text: "Kreslolarimiz bej, kulrang, ko'k va qora ranglarda mavjud 🎨 Qaysi biri kerak?", time: '13:05', auto: 'AI' },
  ] },
  { id: 6, name: 'Bekzod Normatov', ch: 'telegram', color: '#e67e22', snippet: 'Rahmat sizga!', time: '2 soat', unread: 0, status: 'Yopildi', auto: true, msgs: [
    { t: 'in', text: 'Rahmat sizga!', time: '12:15' },
    { t: 'out', text: "Sizga ham rahmat! 🙏 Xaridingiz xayrli bo'lsin!", time: '12:15', auto: 'Qoida: Rahmat' },
  ] },
]

export const WEEK: WeekDay[] = [
  { d: 'Du', auto: 210, man: 34 }, { d: 'Se', auto: 256, man: 41 }, { d: 'Ch', auto: 198, man: 28 },
  { d: 'Pa', auto: 312, man: 52 }, { d: 'Ju', auto: 388, man: 61 }, { d: 'Sh', auto: 274, man: 38 },
  { d: 'Ya', auto: 189, man: 22 },
]

/* ---------------- PAGE WRAPPER ---------------- */
/** Marketing sahifa o'rovchisi — `.marketing-app` scope + sarlavha. */
export function MarketingPage({
  title, sub, children, full,
}: {
  title: string
  sub: string
  children: ReactNode
  /** Inbox kabi to'liq-kenglikdagi sahifalar uchun (content-narrow yo'q). */
  full?: boolean
}) {
  return (
    <div className="marketing-app">
      <div className={full ? '' : 'content-narrow'}>
        <div className="mk-head">
          <div className="page-title">{title}</div>
          <div className="page-sub">{sub}</div>
        </div>
        {children}
      </div>
    </div>
  )
}
