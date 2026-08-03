import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Check, Loader2, Bot, Clock, Send, FileText, Eye, EyeOff,
  Users, Globe, KeyRound, Copy,
} from 'lucide-react'
import type { TestResultDetail } from '@/types'
import { getTestDetail, setTestScore } from '@/api/services/testResults'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiErrorMessage, formatDate } from '@/lib/utils'
import { usePerm } from '@/lib/permissions'

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * Test tafsiloti — guruhning faol o'quvchilari ballari (ball bo'yicha kamayish tartibida).
 * Har o'quvchiga ball kiritiladi; kiritilganda ro'yxat qayta saralanadi (tepadan pastga).
 */
export function TestDetailPage() {
  const { groupId = '', testId = '' } = useParams()
  const navigate = useNavigate()
  const { can } = usePerm()
  const editable = can('classes', 'edit')

  const [detail, setDetail] = useState<TestResultDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Har o'quvchi input qiymati (matn) — saqlanmaguncha lokal
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  // Onlayn test: javob kalitini ko'rsatish (yopiq holatda — tasodifan ko'rinib qolmasin)
  const [showKey, setShowKey] = useState(false)

  const syncDraft = (d: TestResultDetail) =>
    setDraft(Object.fromEntries(d.rows.map((r) => [r.studentId, r.score == null ? '' : String(r.score)])))

  useEffect(() => {
    getTestDetail(testId)
      .then((d) => {
        setDetail(d)
        syncDraft(d)
      })
      .catch((e) => setError(apiErrorMessage(e, 'Yuklab bo\'lmadi')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const save = async (studentId: string) => {
    if (!detail) return
    const raw = (draft[studentId] ?? '').trim()
    const current = detail.rows.find((r) => r.studentId === studentId)?.score ?? null
    const next = raw === '' ? null : Number(raw)
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setError('Ball manfiy bo\'lmasligi kerak')
      return
    }
    if (next === current) return // o'zgarmagan
    setSavingId(studentId)
    setError('')
    try {
      const updated = await setTestScore(testId, studentId, next)
      setDetail(updated)
      syncDraft(updated)
      setSavedId(studentId)
      setTimeout(() => setSavedId((s) => (s === studentId ? null : s)), 1200)
    } catch (e) {
      setError(apiErrorMessage(e, 'Saqlab bo\'lmadi'))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />
  if (!detail)
    return <Card className="py-12 text-center text-slate-400">{error || 'Test topilmadi'}</Card>

  const scored = detail.rows.filter((r) => r.score != null).length
  const isOnline = detail.online?.mode === 'online'
  const submitted = detail.rows.filter((r) => r.source === 'bot').length
  // MARKAZDAN TASHQARI ishtirokchilar (test kodi bilan kirganlar) — alohida ro'yxat.
  const external = detail.externalRows ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(`/admin/test-results/${groupId}`)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> {detail.groupName || 'Guruh'} testlari
      </button>

      <PageHeader
        title={detail.name}
        sub={`${formatDate(detail.date)} · Maksimal ball: ${detail.maxScore} · Baholangan: ${scored}/${detail.rows.length}`}
      />

      {isOnline && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-600">
              <Bot className="h-3.5 w-3.5" /> ONLAYN TEST
            </span>
            <span className="text-slate-600">
              <span className="text-slate-400">Savollar:</span>{' '}
              <b>{detail.online.questionCount}</b> ta (A–
              {String.fromCharCode(64 + detail.online.optionCount)})
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" />
              {detail.online.startAt.slice(11, 16)} – {detail.online.endAt.slice(11, 16)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Send className="h-4 w-4 text-slate-400" />
              Botdan yuborgan: <b>{submitted}</b>
            </span>
            {detail.online.pdfUrl && (
              <a
                href={detail.online.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
              >
                <FileText className="h-4 w-4" /> Savollar (PDF)
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-700"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Javob kaliti
            </button>
            {!!detail.online.code && (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(detail.online.code)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-slate-700 hover:bg-slate-200"
                title="Test kodini nusxalash — markazda o'qimaydigan odam shu kod bilan ishlaydi"
              >
                <KeyRound className="h-3.5 w-3.5" /> {detail.online.code}
                <Copy className="h-3 w-3 text-slate-400" />
              </button>
            )}
            {!detail.online.groupOpen && (
              <span
                className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                title="Guruhga e'lon qilinmagan — faqat test kodi bilan ishlanadi"
              >
                FAQAT KOD
              </span>
            )}
          </div>
          {showKey && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {detail.online.answerKey
                .split('')
                .map((c, i) => `${i + 1}.${c}`)
                .join('   ')}
            </pre>
          )}
        </Card>
      )}

      {error && <Card className="mb-3 py-2.5 text-center text-sm text-red-500">{error}</Card>}

      {/* MARKAZDAGILAR — guruh a'zolari + test kodi bilan qo'shilgan markaz o'quvchilari */}
      {external.length > 0 && (
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Users className="h-4 w-4 text-slate-400" /> Markazdagilar
          <span className="text-xs font-normal text-slate-400">({detail.rows.length})</span>
        </h2>
      )}

      {detail.rows.length === 0 ? (
        <Card className="py-12 text-center text-slate-400">
          Guruhda faol o'quvchi yo'q.
        </Card>
      ) : (
        <Card tight className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-400">
                <th className="w-16 px-4 py-3 font-medium">O'rin</th>
                <th className="px-4 py-3 font-medium">O'quvchi</th>
                {isOnline && <th className="px-4 py-3 font-medium">Javoblari</th>}
                <th className="w-40 px-4 py-3 text-right font-medium">Ball</th>
              </tr>
            </thead>
            <tbody>
              {detail.rows.map((r) => {
                const isTop = r.rank >= 1 && r.rank <= 3
                return (
                  <tr key={r.studentId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5">
                      {r.rank === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : isTop ? (
                        <span className="text-lg leading-none">{MEDALS[r.rank - 1]}</span>
                      ) : (
                        <span className="font-semibold text-slate-500">{r.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={isTop ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}>
                        {r.fullName}
                      </span>
                      {r.rank === 1 && (
                        <Trophy className="ml-1.5 inline h-3.5 w-3.5 text-amber-400" />
                      )}
                      {r.member === false && (
                        <span
                          className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700"
                          title="Boshqa guruh o'quvchisi — test kodi bilan qo'shilgan"
                        >
                          BOSHQA GURUH
                        </span>
                      )}
                    </td>
                    {isOnline && (
                      <td className="px-4 py-2.5">
                        {r.source === 'bot' ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="max-w-[220px] truncate font-mono text-xs text-slate-500"
                              title={r.answers}
                            >
                              {r.answers}
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {r.submittedAt.slice(11, 16)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">— topshirmagan</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {savingId === r.studentId && (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                        )}
                        {savedId === r.studentId && <Check className="h-4 w-4 text-emerald-500" />}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={detail.maxScore}
                            disabled={!editable || savingId === r.studentId}
                            value={draft[r.studentId] ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, [r.studentId]: e.target.value }))
                            }
                            onBlur={() => editable && save(r.studentId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            placeholder="—"
                            className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                          <span className="text-xs text-slate-400">/ {detail.maxScore}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {editable && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Ballni kiritib bosing yoki katakdan chiqing — natija avtomatik saqlanadi va ro'yxat qayta saralanadi.
        </p>
      )}

      {/* MARKAZDAN TASHQARI — test kodi bilan kirgan, markazda o'qimaydigan ishtirokchilar.
          Ular Student emas: ball qo'lda tahrirlanmaydi (faqat botdan kelgan natija). */}
      {external.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Globe className="h-4 w-4 text-teal-500" /> Markazdan tashqari
            <span className="text-xs font-normal text-slate-400">({external.length})</span>
          </h2>
          <Card tight className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-16 px-4 py-3 font-medium">O'rin</th>
                  <th className="px-4 py-3 font-medium">Ishtirokchi</th>
                  <th className="px-4 py-3 font-medium">Javoblari</th>
                  <th className="w-32 px-4 py-3 text-right font-medium">Ball</th>
                </tr>
              </thead>
              <tbody>
                {external.map((r) => {
                  const isTop = r.rank >= 1 && r.rank <= 3
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5">
                        {isTop ? (
                          <span className="text-lg leading-none">{MEDALS[r.rank - 1]}</span>
                        ) : (
                          <span className="font-semibold text-slate-500">{r.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={isTop ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}>
                          {r.fullName}
                        </span>
                        {!!r.phone && (
                          <span className="ml-2 text-xs text-slate-400">{r.phone}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[220px] truncate font-mono text-xs text-slate-500" title={r.answers}>
                            {r.answers}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {r.submittedAt.slice(11, 16)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-semibold text-slate-800">{r.score}</span>
                        <span className="ml-1 text-xs text-slate-400">/ {detail.maxScore}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-center text-xs text-slate-400">
            Bular markazda o'qimaydigan ishtirokchilar — botda test kodi va F.I.Sh bilan kirishgan.
            Ballari faqat botdan keladi, qo'lda tahrirlanmaydi.
          </p>
        </div>
      )}
    </div>
  )
}
