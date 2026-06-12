import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Copy, Check, ExternalLink, Link2, GripVertical, Save, ListChecks, Users,
} from 'lucide-react'
import type { LevelTestDetail, LevelTestSubmission, Subject } from '@/types'
import { getLevelTest, updateLevelTest, getLevelTestSubmissions } from '@/api/services/levelTests'
import { getSubjects } from '@/api/services/subjects'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn, formatDate } from '@/lib/utils'

interface QState { id?: string; text: string; options: string[]; correctIndex: number }
interface BState { id?: string; label: string; minPercent: number }

function testUrl(slug: string) {
  return `${window.location.origin}/test/${slug}`
}

export function LevelTestEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<LevelTestDetail | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tab, setTab] = useState<'edit' | 'results'>('edit')
  const [copied, setCopied] = useState(false)

  // Forma holati
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [intro, setIntro] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [questions, setQuestions] = useState<QState[]>([])
  const [bands, setBands] = useState<BState[]>([])

  // Natijalar
  const [subs, setSubs] = useState<LevelTestSubmission[] | null>(null)

  useEffect(() => {
    Promise.all([getLevelTest(id), getSubjects()])
      .then(([d, s]) => {
        setDetail(d)
        setSubjects(s)
        setTitle(d.title)
        setCourseId(d.courseId)
        setIntro(d.intro)
        setIsActive(d.isActive)
        setQuestions(d.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex })))
        setBands(d.bands.map((b) => ({ id: b.id, label: b.label, minPercent: b.minPercent })))
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (tab === 'results' && subs === null) getLevelTestSubmissions(id).then(setSubs)
  }, [tab, subs, id])

  const copy = async () => {
    if (!detail) return
    try {
      await navigator.clipboard.writeText(testUrl(detail.slug))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* jim */
    }
  }

  // ---- Savollar ----
  const addQuestion = () =>
    setQuestions((qs) => [...qs, { text: '', options: ['', ''], correctIndex: 0 }])
  const removeQuestion = (i: number) => setQuestions((qs) => qs.filter((_, x) => x !== i))
  const patchQuestion = (i: number, patch: Partial<QState>) =>
    setQuestions((qs) => qs.map((q, x) => (x === i ? { ...q, ...patch } : q)))
  const addOption = (i: number) =>
    setQuestions((qs) => qs.map((q, x) => (x === i ? { ...q, options: [...q.options, ''] } : q)))
  const setOption = (i: number, oi: number, val: string) =>
    setQuestions((qs) =>
      qs.map((q, x) => (x === i ? { ...q, options: q.options.map((o, y) => (y === oi ? val : o)) } : q)),
    )
  const removeOption = (i: number, oi: number) =>
    setQuestions((qs) =>
      qs.map((q, x) => {
        if (x !== i) return q
        const options = q.options.filter((_, y) => y !== oi)
        let correctIndex = q.correctIndex
        if (oi === correctIndex) correctIndex = 0
        else if (oi < correctIndex) correctIndex -= 1
        return { ...q, options, correctIndex: Math.max(0, correctIndex) }
      }),
    )

  // ---- Daraja diapazonlari ----
  const addBand = () => setBands((bs) => [...bs, { label: '', minPercent: 0 }])
  const removeBand = (i: number) => setBands((bs) => bs.filter((_, x) => x !== i))
  const patchBand = (i: number, patch: Partial<BState>) =>
    setBands((bs) => bs.map((b, x) => (x === i ? { ...b, ...patch } : b)))

  const handleSave = async () => {
    if (!detail || saving) return
    setSaving(true)
    try {
      const updated = await updateLevelTest(id, {
        title: title.trim(),
        courseId,
        intro: intro.trim(),
        isActive,
        questions: questions
          .map((q) => ({
            id: q.id,
            text: q.text.trim(),
            options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
            correctIndex: q.correctIndex,
          }))
          .filter((q) => q.text.length > 0 && q.options.length >= 2),
        bands: bands
          .map((b) => ({ id: b.id, label: b.label.trim(), minPercent: Math.max(0, Math.min(100, b.minPercent || 0)) }))
          .filter((b) => b.label.length > 0),
      })
      setDetail(updated)
      // Tozalangan/qayta tartiblangan ma'lumotni qaytadan yuklaymiz
      setQuestions(updated.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex })))
      setBands(updated.bands.map((b) => ({ id: b.id, label: b.label, minPercent: b.minPercent })))
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Saqlab bo\'lmadi')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (!detail)
    return (
      <Card>
        <p className="py-10 text-center text-slate-400">Test topilmadi.</p>
      </Card>
    )

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/level-tests')}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
              title="Orqaga"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {detail.title || 'Daraja testi'}
          </span>
        }
        sub={detail.courseName ? `Kurs: ${detail.courseName}` : 'Kurs tanlanmagan'}
        actions={
          tab === 'edit' ? (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          ) : undefined
        }
      />

      {/* Ommaviy havola */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2.5">
        <Link2 className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="flex-1 truncate font-mono text-sm text-slate-600">{testUrl(detail.slug)}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:text-brand-600"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </button>
        <a
          href={testUrl(detail.slug)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:text-brand-600"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ochish
        </a>
      </div>

      {/* Tablar */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          onClick={() => setTab('edit')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors',
            tab === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <ListChecks className="h-4 w-4" /> Tahrirlash
        </button>
        <button
          onClick={() => setTab('results')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors',
            tab === 'results' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Users className="h-4 w-4" /> Natijalar
        </button>
      </div>

      {tab === 'edit' ? (
        <div className="space-y-4">
          {/* Asosiy */}
          <Card title="Asosiy ma'lumot">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Test nomi" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select label="Kurs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">— Kurs tanlanmagan —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea
              label="Kirish matni (test boshida ko'rinadi)"
              className="mt-3"
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Masalan: Bu test darajangizni aniqlaydi. Diqqat bilan javob bering."
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Faol (ommaviy havola orqali ochiladi)
            </label>
          </Card>

          {/* Savollar */}
          <Card
            title={`Savollar (${questions.length})`}
            sub="Har savolда bitta to'g'ri javobni belgilang (yashil doira)"
            actions={
              <Button variant="secondary" onClick={addQuestion}>
                <Plus className="h-4 w-4" /> Savol
              </Button>
            }
          >
            {questions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Savol yo'q. "Savol" tugmasini bosing.</p>
            ) : (
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        {i + 1}
                      </span>
                      <textarea
                        rows={1}
                        value={q.text}
                        onChange={(e) => patchQuestion(i, { text: e.target.value })}
                        placeholder="Savol matni..."
                        className="min-h-[40px] flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400"
                      />
                      <button
                        onClick={() => removeQuestion(i)}
                        title="Savolni o'chirish"
                        className="mt-1 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 space-y-1.5 pl-8">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => patchQuestion(i, { correctIndex: oi })}
                            title="To'g'ri javob"
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                              q.correctIndex === oi
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 text-transparent hover:border-emerald-400',
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <input
                            value={opt}
                            onChange={(e) => setOption(i, oi, e.target.value)}
                            placeholder={`Variant ${oi + 1}`}
                            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() => removeOption(i, oi)}
                              title="Variantni o'chirish"
                              className="rounded p-1 text-slate-300 transition-colors hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(i)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Variant qo'shish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Daraja diapazonlari */}
          <Card
            title="Daraja diapazonlari"
            sub="Ball foiziga qarab daraja aniqlanadi (foiz ≥ minimal foiz bo'lgan eng yuqori daraja)"
            actions={
              <Button variant="secondary" onClick={addBand}>
                <Plus className="h-4 w-4" /> Daraja
              </Button>
            }
          >
            {bands.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Daraja yo'q — natija faqat ball bo'ladi.</p>
            ) : (
              <div className="space-y-2">
                {[...bands]
                  .map((b, i) => ({ b, i }))
                  .sort((a, z) => a.b.minPercent - z.b.minPercent)
                  .map(({ b, i }) => (
                    <div key={b.id ?? i} className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                      <input
                        value={b.label}
                        onChange={(e) => patchBand(i, { label: e.target.value })}
                        placeholder="Daraja nomi (masalan B1)"
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">≥</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={b.minPercent}
                          onChange={(e) => patchBand(i, { minPercent: Number(e.target.value) })}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center font-mono text-sm text-slate-700 outline-none focus:border-brand-400"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                      <button
                        onClick={() => removeBand(i)}
                        className="rounded p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </div>
      ) : (
        <Card title="Testni topshirganlar" sub="Har bir topshiruvchi CRM Lidlar bo'limida yangi lid bo'lib turadi">
          {subs === null ? (
            <Loader label="Yuklanmoqda..." />
          ) : subs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Hali hech kim topshirmagan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">F.I.SH</th>
                    <th className="px-3 py-2">Telefon</th>
                    <th className="px-3 py-2 text-center">Yosh</th>
                    <th className="px-3 py-2 text-center">Ball</th>
                    <th className="px-3 py-2 text-center">Foiz</th>
                    <th className="px-3 py-2">Daraja</th>
                    <th className="px-3 py-2">Sana</th>
                    <th className="px-3 py-2 text-right">Lid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subs.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-700">{s.fullName}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{s.phone}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{s.age || '—'}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">
                        {s.score}/{s.total}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700">{s.percent}%</td>
                      <td className="px-3 py-2">
                        {s.level ? (
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                            {s.level}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{formatDate(s.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => navigate('/admin/leads')}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          Lidlarda →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
