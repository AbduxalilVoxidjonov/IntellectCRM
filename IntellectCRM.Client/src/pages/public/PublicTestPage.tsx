import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GraduationCap, ArrowRight, ArrowLeft, Check, Loader2, PartyPopper, AlertCircle } from 'lucide-react'
import type { PublicTest, TestResult } from '@/types'
import { getPublicTest, submitPublicTest } from '@/api/services/publicTest'
import { getPublicBrand, type PublicBrand } from '@/api/services/settings'

type Phase = 'loading' | 'notfound' | 'intro' | 'quiz' | 'done'

export function PublicTestPage() {
  const { slug = '' } = useParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [test, setTest] = useState<PublicTest | null>(null)

  // Kontakt
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')

  // Test
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, number[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState('')
  const [brand, setBrand] = useState<PublicBrand>({ name: '', logoUrl: '', phone: '' })

  useEffect(() => {
    getPublicTest(slug)
      .then((t) => {
        setTest(t)
        setPhase('intro')
      })
      .catch(() => setPhase('notfound'))
  }, [slug])

  useEffect(() => {
    getPublicBrand()
      .then(setBrand)
      .catch(() => {})
  }, [])

  const start = () => {
    if (!fullName.trim()) return setError('Ism-familiyangizni kiriting')
    if (!phone.trim()) return setError('Telefon raqamingizni kiriting')
    setError('')
    setPhase('quiz')
  }

  const submit = async () => {
    if (!test || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const r = await submitPublicTest(slug, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        age: Number(age) || 0,
        answers,
        surveyAnswers,
      })
      setResult(r)
      setPhase('done')
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as any)?.response?.data?.message ?? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const questions = test?.questions ?? []
  const q = questions[step]
  // So'rovnoma ixtiyoriy (har doim "javob berilgan" deb hisoblanadi); savol — variant tanlanishi shart.
  const answered = q ? (q.kind === 'survey' ? true : answers[q.id] !== undefined) : false
  const progress = questions.length ? Math.round(((step + (answered ? 1 : 0)) / questions.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-50 px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-xl object-contain shadow-lg"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
              <GraduationCap className="h-6 w-6" />
            </div>
          )}
          <span className="text-lg font-bold tracking-tight text-slate-800">
            {brand.name || 'IntellectCRM'}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">Yuklanmoqda...</p>
            </div>
          )}

          {phase === 'notfound' && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="text-lg font-bold text-slate-800">Test topilmadi</h1>
              <p className="text-sm text-slate-500">
                Bu havola noto'g'ri yoki test faol emas. Iltimos, markaz bilan bog'laning.
              </p>
            </div>
          )}

          {/* Kirish + kontakt */}
          {phase === 'intro' && test && (
            <div>
              <div className="bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-7 text-white">
                <h1 className="text-xl font-bold">{test.title}</h1>
                {test.courseName && <p className="mt-1 text-sm text-white/80">{test.courseName}</p>}
              </div>
              <div className="space-y-4 px-6 py-6">
                {test.intro && <p className="text-sm leading-relaxed text-slate-600">{test.intro}</p>}
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <p className="font-medium text-slate-700">{questions.length} ta savol</p>
                  <p className="mt-0.5">Avval o'zingiz haqingizda qisqa ma'lumot qoldiring.</p>
                </div>

                <div className="space-y-3">
                  <Field label="Ism-familiya *">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masalan: Aliyev Ali"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Telefon raqam *">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      inputMode="tel"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Yoshingiz (ixtiyoriy)">
                    <input
                      value={age}
                      onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
                      placeholder="18"
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                <button
                  onClick={start}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700"
                >
                  Testni boshlash <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Test */}
          {phase === 'quiz' && test && q && (
            <div>
              {/* Progress */}
              <div className="px-6 pt-6">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>
                    Savol {step + 1} / {questions.length}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="px-6 py-6">
                <h2 className="text-base font-semibold leading-relaxed text-slate-800">{q.text}</h2>
                {q.kind === 'survey' && (
                  <p className="mt-1 text-xs text-slate-400">
                    So'rovnoma{q.multiple ? ' — bir nechtasini tanlashingiz mumkin' : ''} (ixtiyoriy)
                  </p>
                )}
                <div className="mt-4 space-y-2.5">
                  {q.options.map((opt, oi) => {
                    const isSurvey = q.kind === 'survey'
                    const selected = isSurvey
                      ? (surveyAnswers[q.id]?.includes(oi) ?? false)
                      : answers[q.id] === oi
                    const onPick = () => {
                      if (!isSurvey) {
                        setAnswers((a) => ({ ...a, [q.id]: oi }))
                      } else {
                        setSurveyAnswers((a) => {
                          const cur = a[q.id] ?? []
                          if (q.multiple)
                            return {
                              ...a,
                              [q.id]: cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi],
                            }
                          return { ...a, [q.id]: [oi] }
                        })
                      }
                    }
                    // checkbox (ko'p tanlash) → kvadrat; radio/savol → doira
                    const square = isSurvey && q.multiple
                    return (
                      <button
                        key={oi}
                        onClick={onPick}
                        className={
                          'flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ' +
                          (selected
                            ? 'border-brand-500 bg-brand-50 text-brand-800'
                            : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50')
                        }
                      >
                        <span
                          className={
                            'flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-bold ' +
                            (square ? 'rounded-md ' : 'rounded-full ') +
                            (selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-slate-400')
                          }
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : isSurvey ? '' : String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    )
                  })}
                </div>

                {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

                <div className="mt-6 flex items-center gap-2">
                  {step > 0 && (
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4" /> Orqaga
                    </button>
                  )}
                  {step < questions.length - 1 ? (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!answered}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                    >
                      Keyingi <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={submit}
                      disabled={!answered || submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Yakunlash
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Natija */}
          {phase === 'done' && result && (
            <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <PartyPopper className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Rahmat!</h1>

              {result.total > 0 && (
                <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-slate-50 px-6 py-6">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Natija</p>
                    <p className="mt-1 font-mono text-3xl font-bold text-slate-800">
                      {result.score}
                      <span className="text-lg text-slate-400">/{result.total}</span>
                    </p>
                    <p className="font-mono text-sm text-slate-500">{result.percent}%</p>
                  </div>
                  {result.level && (
                    <div className="rounded-full bg-brand-600 px-5 py-1.5 text-sm font-bold text-white">
                      Darajangiz: {result.level}
                    </div>
                  )}
                </div>
              )}

              <p className="max-w-sm text-sm leading-relaxed text-slate-500">{result.message}</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          {brand.name || 'IntellectCRM'} · O'quv markazi
        </p>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
