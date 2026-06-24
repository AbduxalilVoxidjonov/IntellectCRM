import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Upload, RotateCcw, ExternalLink } from 'lucide-react'
import {
  getLanding,
  saveLanding,
  resetLanding,
  uploadLandingImage,
  deleteLandingImage,
  type LandingContent,
} from '@/api/services/landing'
import { useAuth } from '@/context/auth-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'

const control =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

const LANGS: { code: string; label: string }[] = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Ruscha' },
  { code: 'en', label: 'Inglizcha' },
]

// Sertifikat rasm slotlari (apex landing "Yutuqlarimiz" bo'limidagi galereya).
const IMAGE_SLOTS: { id: string; label: string }[] = [
  { id: 'cert-en', label: 'Ingliz tili' },
  { id: 'cert-ielts', label: 'IELTS' },
  { id: 'cert-math', label: 'Matematika' },
  { id: 'cert-phys', label: 'Fizika' },
  { id: 'cert-rus', label: 'Rus tili' },
  { id: 'cert-sat', label: 'SAT' },
]

// Kalit -> chiroyli yorliq (topilmasa kalitning o'zi ishlatiladi).
const LABELS: Record<string, string> = {
  nav: 'Menyu', hero: 'Bosh ekran (Hero)', heroStats: "Hero ko'rsatkichlari",
  about: 'Markaz haqida', aboutFeatures: 'Afzalliklar', courses: 'Kurslar bo\'limi',
  coursesList: 'Kurslar ro\'yxati', why: 'Nega biz', whys: 'Sabablar',
  ach: 'Yutuqlar', achStats: 'Yutuq ko\'rsatkichlari', test: 'Daraja test',
  faq: 'FAQ sarlavha', faqs: 'Savol-javoblar', vac: 'Vakansiya bo\'limi',
  vacancies: 'Vakansiyalar', contact: 'Aloqa', trial: 'Sinov darsi', footer: 'Pastki qism',
  about_: 'Haqida', title: 'Sarlavha', title1: 'Sarlavha 1', title2: 'Sarlavha 2',
  subtitle: 'Tavsif', tag: 'Yorliq', badge: 'Belgi', desc: 'Tavsif', name: 'Nomi',
  num: 'Raqam', label: 'Yorliq', level: 'Daraja', code: 'Kod', q: 'Savol', a: 'Javob',
  cta: 'Tugma', cta1: 'Tugma 1', cta2: 'Tugma 2', p1: 'Matn 1', p2: 'Matn 2',
  type: 'Turi', req: 'Talab', course: 'Kurs', quote: 'Iqtibos', quoteBy: 'Muallif',
  cardTitle: 'Karta sarlavhasi', cardSub: 'Karta tavsifi', certLabels: 'Sertifikat yorliqlari',
  certTag: 'Sertifikat yorlig\'i', certTitle: 'Sertifikat sarlavhasi', certHint: 'Sertifikat izohi',
  certPh: 'Sertifikat placeholder', results: 'Natijalar', tiers: 'Darajalar',
  high: 'Yuqori', mid: "O'rta", low: 'Past', tagline: 'Shior', rights: 'Huquqlar',
  submitBtn: 'Yuborish tugmasi', applyBtn: 'Ariza tugmasi', chooseBtn: 'Tanlash tugmasi',
  enrollBtn: 'Yozilish tugmasi', retakeBtn: 'Qayta tugmasi',
}

function labelFor(key: string): string {
  return LABELS[key] ?? key
}

function emptyLike(sample: any): any {
  if (typeof sample === 'string') return ''
  if (Array.isArray(sample)) return sample.length ? [emptyLike(sample[0])] : []
  if (sample && typeof sample === 'object') {
    const o: Record<string, any> = {}
    for (const k of Object.keys(sample)) o[k] = emptyLike(sample[k])
    return o
  }
  return ''
}

/** Rekursiv kontent muharriri — satr / satrlar massivi / obyektlar massivi / ichma-ich obyekt. */
function Node({
  label,
  value,
  onChange,
  depth = 0,
}: {
  label: string
  value: any
  onChange: (v: any) => void
  depth?: number
}) {
  // Satr maydoni
  if (typeof value === 'string') {
    const long = value.length > 55 || value.includes('\n')
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
        {long ? (
          <textarea
            className={control}
            rows={Math.min(6, Math.max(2, Math.ceil(value.length / 60)))}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input className={control} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </label>
    )
  }

  // Massiv (satrlar yoki obyektlar)
  if (Array.isArray(value)) {
    const updateAt = (i: number, v: any) => {
      const next = value.slice()
      next[i] = v
      onChange(next)
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          <button
            type="button"
            onClick={() => onChange([...value, emptyLike(value[0] ?? '')])}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus size={13} /> Qo'shish
          </button>
        </div>
        <div className="space-y-2">
          {value.map((item, i) => (
            <div
              key={i}
              className="relative rounded-lg border border-slate-200 bg-slate-50/60 p-3 pr-9"
            >
              <Node label={`#${i + 1}`} value={item} onChange={(v) => updateAt(i, v)} depth={depth + 1} />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="O'chirish"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {value.length === 0 && (
            <p className="text-xs text-slate-400">Bo'sh — "Qo'shish" tugmasini bosing.</p>
          )}
        </div>
      </div>
    )
  }

  // Obyekt
  if (value && typeof value === 'object') {
    return (
      <div className={depth === 0 ? '' : 'space-y-3'}>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(value).map(([k, v]) => {
            const complex = Array.isArray(v) || (v && typeof v === 'object')
            return (
              <div key={k} className={complex ? 'sm:col-span-2' : ''}>
                <Node
                  label={labelFor(k)}
                  value={v}
                  onChange={(nv) => onChange({ ...value, [k]: nv })}
                  depth={depth + 1}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}

export function LandingSettings() {
  const { user } = useAuth()
  const [content, setContent] = useState<LandingContent | null>(null)
  const [lang, setLang] = useState('uz')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    getLanding()
      .then((c) => setContent({ langs: c.langs ?? {}, images: c.images ?? {} }))
      .catch(() => setMsg('Kontentni yuklab bo\'lmadi.'))
      .finally(() => setLoading(false))
  }, [])

  if (user && user.role !== 'superadmin') {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Landing sahifa sozlamalari faqat <b>superadmin</b> uchun.
        </p>
      </Card>
    )
  }

  if (loading || !content) return <Loader />

  const langData = content.langs[lang]

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const saved = await saveLanding(content)
      setContent({ langs: saved.langs ?? {}, images: saved.images ?? {} })
      setMsg('Saqlandi ✓')
    } catch {
      setMsg('Saqlashda xatolik.')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const reset = async () => {
    if (!confirm('Landing kontentini standart holatga qaytarasizmi? Tahrirlar o\'chadi.')) return
    setSaving(true)
    try {
      const c = await resetLanding()
      setContent({ langs: c.langs ?? {}, images: c.images ?? {} })
      setMsg('Standart holatga qaytarildi.')
    } catch {
      setMsg('Qaytarishda xatolik.')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const onPickImage = async (slotId: string, file?: File) => {
    if (!file) return
    setBusySlot(slotId)
    try {
      const { url } = await uploadLandingImage(slotId, file)
      setContent((c) => (c ? { ...c, images: { ...c.images, [slotId]: url } } : c))
    } catch {
      setMsg('Rasm yuklashda xatolik.')
    } finally {
      setBusySlot(null)
    }
  }

  const onDeleteImage = async (slotId: string) => {
    setBusySlot(slotId)
    try {
      await deleteLandingImage(slotId)
      setContent((c) => {
        if (!c) return c
        const images = { ...c.images }
        delete images[slotId]
        return { ...c, images }
      })
    } catch {
      setMsg('Rasmni o\'chirishda xatolik.')
    } finally {
      setBusySlot(null)
    }
  }

  // langData yo'q bo'lsa (bo'sh kontent) — ogohlantirish.
  const sections = langData && typeof langData === 'object' ? Object.keys(langData) : []

  return (
    <div className="space-y-5">
      {/* Yuqori panel: til tablari + saqlash */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                (lang === l.code ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')
              }
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
          <a
            href="https://intellectschool.uz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink size={15} /> Saytni ko'rish
          </a>
          <Button variant="ghost" onClick={reset} disabled={saving}>
            <RotateCcw size={15} className="mr-1" /> Standart
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </div>
      </div>

      {/* Rasmlar (sertifikat galereyasi) — backendga yuklanadi */}
      <Card title="Sertifikat rasmlari" sub="Apex landing 'Yutuqlarimiz' galereyasi. Rasm backendga yuklanadi va saytda ko'rinadi (tashrifchi yuklay olmaydi).">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMAGE_SLOTS.map((s) => {
            const url = content.images[s.id]
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm font-medium text-slate-700">{s.label}</div>
                <div className="mb-2 flex h-32 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                  {url ? (
                    <img src={url} alt={s.label} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">Rasm yo'q</span>
                  )}
                </div>
                <input
                  ref={(el) => {
                    fileRefs.current[s.id] = el
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  hidden
                  onChange={(e) => onPickImage(s.id, e.target.files?.[0] ?? undefined)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busySlot === s.id}
                    onClick={() => fileRefs.current[s.id]?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                  >
                    <Upload size={13} /> {busySlot === s.id ? '…' : url ? 'Almashtirish' : 'Yuklash'}
                  </button>
                  {url && (
                    <button
                      type="button"
                      disabled={busySlot === s.id}
                      onClick={() => onDeleteImage(s.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="O'chirish"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Matn kontenti — har bir bo'lim yig'iladigan (collapsible) */}
      {sections.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Bu til uchun kontent topilmadi. "Standart" tugmasi orqali boshlang'ich kontentni yuklang.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((sec) => (
            <details key={sec} className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 font-semibold text-slate-800">
                <span>{labelFor(sec)}</span>
                <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <Node
                  label={labelFor(sec)}
                  value={langData[sec]}
                  onChange={(nv) =>
                    setContent((c) =>
                      c ? { ...c, langs: { ...c.langs, [lang]: { ...c.langs[lang], [sec]: nv } } } : c,
                    )
                  }
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
