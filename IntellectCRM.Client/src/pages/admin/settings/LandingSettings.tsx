import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Upload, RotateCcw, ExternalLink, Link2 } from 'lucide-react'
import {
  getLanding,
  saveLanding,
  resetLanding,
  uploadLandingImage,
  type LandingContent,
  type LandingCourse,
  type LandingTeacher,
} from '@/api/services/landing'
import { getLevelTests } from '@/api/services/levelTests'
import type { LevelTestListItem } from '@/types'
import { useAuth } from '@/context/auth-context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'

const control =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

type Lang = 'uz' | 'ru' | 'en'
const LANGS: { code: Lang; label: string }[] = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Ruscha' },
  { code: 'en', label: 'Inglizcha' },
]

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

const emptyCourse = (): LandingCourse => ({
  price: '',
  uz: { name: '', desc: '' },
  ru: { name: '', desc: '' },
  en: { name: '', desc: '' },
})
const emptyTeacher = (): LandingTeacher => ({
  photo: '',
  uz: { name: '', role: '', bio: '' },
  ru: { name: '', role: '', bio: '' },
  en: { name: '', role: '', bio: '' },
})

export function LandingSettings() {
  const { user } = useAuth()
  const [content, setContent] = useState<LandingContent | null>(null)
  const [lang, setLang] = useState<Lang>('uz')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tests, setTests] = useState<LevelTestListItem[]>([])
  const certInput = useRef<HTMLInputElement | null>(null)
  const galInput = useRef<HTMLInputElement | null>(null)
  const teacherInputs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    getLanding()
      .then(setContent)
      .catch(() => setMsg("Kontentni yuklab bo'lmadi."))
      .finally(() => setLoading(false))
    getLevelTests()
      .then((t) => setTests(t.filter((x) => x.isActive)))
      .catch(() => {})
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

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }
  const patch = (p: Partial<LandingContent>) => setContent((c) => (c ? { ...c, ...p } : c))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      setContent(await saveLanding(content))
      flash('Saqlandi ✓')
    } catch {
      flash('Saqlashda xatolik.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!confirm("Landing kontentini standart holatga qaytarasizmi? Tahrirlar va yuklangan rasmlar o'chadi."))
      return
    setSaving(true)
    try {
      setContent(await resetLanding())
      flash('Standart holatga qaytarildi.')
    } catch {
      flash('Qaytarishda xatolik.')
    } finally {
      setSaving(false)
    }
  }

  const uploadOne = async (file: File): Promise<string | null> => {
    try {
      return await uploadLandingImage(file)
    } catch (e: any) {
      const m = e?.response?.data?.message
      flash(m ? `Rasm yuklashda xatolik: ${m}` : 'Rasm yuklashda xatolik.')
      return null
    }
  }

  // ---- Kurslar ----
  const updCourse = (i: number, fn: (c: LandingCourse) => LandingCourse) =>
    patch({ courses: content.courses.map((c, j) => (j === i ? fn(c) : c)) })

  // ---- Ustozlar ----
  const updTeacher = (i: number, fn: (t: LandingTeacher) => LandingTeacher) =>
    patch({ teachers: content.teachers.map((t, j) => (j === i ? fn(t) : t)) })

  const pickTeacherPhoto = async (i: number, file?: File) => {
    if (!file) return
    setBusy('teacher-' + i)
    const url = await uploadOne(file)
    if (url) updTeacher(i, (t) => ({ ...t, photo: url }))
    setBusy(null)
  }

  // ---- Rasm ro'yxatlari (sertifikat / galereya) ----
  const addImages = async (key: 'certificates' | 'gallery', files: FileList | null) => {
    if (!files || !files.length) return
    setBusy(key)
    const urls: string[] = []
    for (const f of Array.from(files)) {
      const u = await uploadOne(f)
      if (u) urls.push(u)
    }
    if (urls.length) patch({ [key]: [...content[key], ...urls] } as Partial<LandingContent>)
    setBusy(null)
  }
  const removeImage = (key: 'certificates' | 'gallery', i: number) =>
    patch({ [key]: content[key].filter((_, j) => j !== i) } as Partial<LandingContent>)

  return (
    <div className="space-y-5">
      {/* Yuqori panel */}
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

      <p className="text-xs text-slate-400">
        Matn maydonlari <b>{LANGS.find((l) => l.code === lang)?.label}</b> tili uchun. Narx va rasmlar barcha tillar
        uchun umumiy. O'zgartirgach <b>Saqlash</b> tugmasini bosing.
      </p>

      {/* Daraja test linki */}
      <Card title="Daraja test linki" sub="Landing 'Daraja test' tugmalari shu manzilga olib boradi. Tayyor testdan tanlang yoki manzilni qo'lda kiriting.">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Test manzili (URL)</span>
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-slate-400" />
              <input
                className={control}
                placeholder="https://crm.intellectschool.uz/test/..."
                value={content.testLink}
                onChange={(e) => patch({ testLink: e.target.value })}
              />
            </div>
          </label>
          {tests.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Yoki mavjud testdan tanlang</span>
              <select
                className={control}
                value=""
                onChange={(e) => {
                  const t = tests.find((x) => x.id === e.target.value)
                  if (t) patch({ testLink: `${window.location.origin}/test/${t.slug}` })
                }}
              >
                <option value="">— Tanlang —</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.courseName})
                  </option>
                ))}
              </select>
            </label>
          )}
          {content.testLink && (
            <a
              href={content.testLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              <ExternalLink size={14} /> Testni ochib ko'rish
            </a>
          )}
        </div>
      </Card>

      {/* Kurslar */}
      <Card
        title="Kurslar / Narxlar"
        sub="Landing 'Narxlar' bo'limi. Har kurs uchun nom, tavsif va oylik narx."
        actions={
          <Button variant="ghost" onClick={() => patch({ courses: [...content.courses, emptyCourse()] })}>
            <Plus size={15} className="mr-1" /> Kurs qo'shish
          </Button>
        }
      >
        <div className="space-y-3">
          {content.courses.map((c, i) => (
            <div key={i} className="relative rounded-lg border border-slate-200 bg-slate-50/60 p-4 pr-10">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Kurs nomi</span>
                  <input
                    className={control}
                    value={c[lang].name}
                    onChange={(e) =>
                      updCourse(i, (x) => ({ ...x, [lang]: { ...x[lang], name: e.target.value } }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Oylik narx (masalan: 500 000)</span>
                  <input
                    className={control}
                    value={c.price}
                    onChange={(e) => updCourse(i, (x) => ({ ...x, price: e.target.value }))}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Tavsif</span>
                  <textarea
                    className={control}
                    rows={2}
                    value={c[lang].desc}
                    onChange={(e) =>
                      updCourse(i, (x) => ({ ...x, [lang]: { ...x[lang], desc: e.target.value } }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => patch({ courses: content.courses.filter((_, j) => j !== i) })}
                className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="O'chirish"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {content.courses.length === 0 && (
            <p className="text-xs text-slate-400">Bo'sh — "Kurs qo'shish" tugmasini bosing.</p>
          )}
        </div>
      </Card>

      {/* Ustozlar */}
      <Card
        title="Ustozlar"
        sub="Landing 'Ustozlar' bo'limi. Har ustoz uchun rasm, ism, yo'nalish va qisqa ma'lumot."
        actions={
          <Button variant="ghost" onClick={() => patch({ teachers: [...content.teachers, emptyTeacher()] })}>
            <Plus size={15} className="mr-1" /> Ustoz qo'shish
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {content.teachers.map((t, i) => (
            <div key={i} className="relative rounded-lg border border-slate-200 bg-slate-50/60 p-4 pr-10">
              <div className="flex gap-3">
                <div className="flex-none">
                  <div className="mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                    {t.photo ? (
                      <img src={t.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">Rasm</span>
                    )}
                  </div>
                  <input
                    ref={(el) => {
                      teacherInputs.current[i] = el
                    }}
                    type="file"
                    accept={ACCEPT}
                    hidden
                    onChange={(e) => pickTeacherPhoto(i, e.target.files?.[0] ?? undefined)}
                  />
                  <button
                    type="button"
                    disabled={busy === 'teacher-' + i}
                    onClick={() => teacherInputs.current[i]?.click()}
                    className="inline-flex w-24 items-center justify-center gap-1 rounded-md bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                  >
                    <Upload size={12} /> {busy === 'teacher-' + i ? '…' : t.photo ? 'Almashtirish' : 'Yuklash'}
                  </button>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    className={control}
                    placeholder="Ism familiya"
                    value={t[lang].name}
                    onChange={(e) =>
                      updTeacher(i, (x) => ({ ...x, [lang]: { ...x[lang], name: e.target.value } }))
                    }
                  />
                  <input
                    className={control}
                    placeholder="Yo'nalish (masalan: Ingliz tili)"
                    value={t[lang].role}
                    onChange={(e) =>
                      updTeacher(i, (x) => ({ ...x, [lang]: { ...x[lang], role: e.target.value } }))
                    }
                  />
                  <textarea
                    className={control}
                    rows={2}
                    placeholder="Qisqa ma'lumot"
                    value={t[lang].bio}
                    onChange={(e) =>
                      updTeacher(i, (x) => ({ ...x, [lang]: { ...x[lang], bio: e.target.value } }))
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => patch({ teachers: content.teachers.filter((_, j) => j !== i) })}
                className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="O'chirish"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {content.teachers.length === 0 && (
            <p className="text-xs text-slate-400">Bo'sh — "Ustoz qo'shish" tugmasini bosing.</p>
          )}
        </div>
      </Card>

      {/* Sertifikatlar */}
      <ImageGallery
        title="Sertifikatlar"
        sub="Landing 'Natijalar' bo'limidagi sertifikat galereyasi. Rasm bo'lmasa bo'lim ko'rinmaydi."
        urls={content.certificates}
        busy={busy === 'certificates'}
        inputRef={certInput}
        onAdd={(files) => addImages('certificates', files)}
        onRemove={(i) => removeImage('certificates', i)}
      />

      {/* Fotogalereya */}
      <ImageGallery
        title="Fotogalereya"
        sub="Landing 'Fotogalereya' bo'limi. Rasm bo'lmasa bo'lim umuman ko'rinmaydi."
        urls={content.gallery}
        busy={busy === 'gallery'}
        inputRef={galInput}
        onAdd={(files) => addImages('gallery', files)}
        onRemove={(i) => removeImage('gallery', i)}
      />
    </div>
  )
}

function ImageGallery({
  title,
  sub,
  urls,
  busy,
  inputRef,
  onAdd,
  onRemove,
}: {
  title: string
  sub: string
  urls: string[]
  busy: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onAdd: (files: FileList | null) => void
  onRemove: (i: number) => void
}) {
  return (
    <Card
      title={title}
      sub={sub}
      actions={
        <Button variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={15} className="mr-1" /> {busy ? 'Yuklanmoqda…' : 'Rasm yuklash'}
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onAdd(e.target.files)
          e.target.value = ''
        }}
      />
      {urls.length === 0 ? (
        <p className="text-xs text-slate-400">Bo'sh — "Rasm yuklash" tugmasini bosing (bir nechtasini tanlash mumkin).</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {urls.map((u, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border border-slate-200">
              <img src={u} alt="" className="h-32 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-slate-500 shadow hover:bg-red-50 hover:text-red-600"
                title="O'chirish"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
