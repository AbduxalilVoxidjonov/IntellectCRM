import { useEffect, useState } from 'react'
import { Loader2, MessageSquareQuote, Trash2, Lock, Users } from 'lucide-react'
import type { StudentTeacherReviewGroup } from '@/types'
import {
  getStudentTeacherReviews,
  addTeacherReview,
  deleteTeacherReview,
} from '@/api/services/teacherReviews'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { apiErrorMessage, cn, formatDate } from '@/lib/utils'

/**
 * O'QUVCHINING O'QITUVCHI(LAR)I HAQIDAGI FIKRI — o'quvchi profilidagi «Fikr-mulohazalar» tabi.
 *
 * O'quvchi qaysi guruh(lar)da o'qisa, HAR BIRI uchun alohida blok chiqadi: guruh + o'qituvchi +
 * u haqida yozib borilgan fikrlar (eng yangisi tepada). 2 va undan ortiq guruhda o'qisa —
 * 2 va undan ortiq blok.
 *
 * KIM YOZADI: faqat admin/superadmin. O'quvchi yoki ota-ona O'ZI yozmaydi — bu ichki,
 * boshqaruv yozuvi (ma'muriyat o'quvchi bilan suhbatlashib yozib boradi).
 *
 * MAXFIYLIK: bu matnlar o'qituvchiga va uning profiliga KO'RSATILMAYDI. Ular faqat shu yerda
 * va o'qituvchining AI tahlili uchun MANBA sifatida ishlatiladi — o'qituvchi profilida
 * («Tahlillar» bo'limida) AI umumlashtirgan xulosagina chiqadi.
 */
export function TeacherReviewsSection({ studentId }: { studentId: string }) {
  const [blocks, setBlocks] = useState<StudentTeacherReviewGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** Qaysi guruh uchun matn yozilyapti: groupId → matn */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getStudentTeacherReviews(studentId)
      .then(setBlocks)
      .catch((e) => setError(apiErrorMessage(e, "Fikrlarni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    getStudentTeacherReviews(studentId)
      .then((b) => alive && setBlocks(b))
      .catch((e) => alive && setError(apiErrorMessage(e, "Fikrlarni yuklab bo'lmadi")))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [studentId])

  const save = async (b: StudentTeacherReviewGroup) => {
    const text = (drafts[b.groupId] ?? '').trim()
    if (!text || savingGroup) return
    setSavingGroup(b.groupId)
    setError('')
    try {
      const created = await addTeacherReview(studentId, {
        teacherId: b.teacherId,
        groupId: b.groupId,
        text,
      })
      // Yangi fikr TEPAGA qo'shiladi (ro'yxat sana bo'yicha kamayish tartibida).
      setBlocks((prev) =>
        prev.map((x) =>
          x.groupId === b.groupId ? { ...x, reviews: [created, ...x.reviews] } : x,
        ),
      )
      setDrafts((d) => ({ ...d, [b.groupId]: '' }))
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSavingGroup(null)
    }
  }

  const remove = async (groupId: string, id: string) => {
    setDeletingId(id)
    setError('')
    try {
      await deleteTeacherReview(id)
      setBlocks((prev) =>
        prev.map((x) =>
          x.groupId === groupId ? { ...x, reviews: x.reviews.filter((r) => r.id !== id) } : x,
        ),
      )
    } catch (e) {
      setError(apiErrorMessage(e, "O'chirib bo'lmadi"))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-xs leading-relaxed text-sky-900">
          Bu yozuvlar <b>o'qituvchiga ko'rsatilmaydi</b>. Ular o'qituvchining <b>AI tahlili</b> uchun
          manba bo'ladi — uning profilidagi «Tahlillar» bo'limida faqat AI umumlashtirgan xulosa
          chiqadi (o'quvchi ismi yozilmaydi).
        </p>
      </div>

      {error && <Card className="py-2.5 text-center text-sm text-red-500">{error}</Card>}

      {blocks.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          O'quvchi hech bir guruhda emas yoki guruhlariga o'qituvchi biriktirilmagan — fikr yozib
          bo'lmaydi.
        </Card>
      ) : (
        blocks.map((b) => (
          <div key={b.groupId} className="rounded-2xl border border-slate-200 bg-white p-4">
            {/* Guruh + o'qituvchi */}
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Users className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="font-semibold text-slate-800">{b.teacherName || "O'qituvchi"}</span>
              <span className="text-sm text-slate-400">·</span>
              <span className="text-sm text-slate-600">{b.groupName}</span>
              {b.courseName && (
                <span className="text-xs text-slate-400">({b.courseName})</span>
              )}
              {!b.isActive && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  CHIQARILGAN
                </span>
              )}
              {b.isActive && b.membershipStatus === 'frozen' && (
                <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                  MUZLATILGAN
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400">{b.reviews.length} ta fikr</span>
            </div>

            {/* Yangi fikr */}
            <div className="mb-3">
              <textarea
                value={drafts[b.groupId] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [b.groupId]: e.target.value }))}
                placeholder={`O'quvchining ${b.teacherName || "o'qituvchi"} haqidagi fikri — masalan: tushuntirish uslubi, munosabati, darslar qiziqarliligi...`}
                rows={3}
                maxLength={4000}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {(drafts[b.groupId] ?? '').length}/4000
                </span>
                <Button
                  onClick={() => void save(b)}
                  disabled={!(drafts[b.groupId] ?? '').trim() || savingGroup === b.groupId}
                >
                  {savingGroup === b.groupId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquareQuote className="h-4 w-4" />
                  )}
                  Fikrni saqlash
                </Button>
              </div>
            </div>

            {/* Yozilgan fikrlar — eng yangisi tepada */}
            {b.reviews.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                Hali fikr yozilmagan.
              </p>
            ) : (
              <div className="space-y-2">
                {b.reviews.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      'group rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5',
                      deletingId === r.id && 'opacity-50',
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {r.text}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{formatDate(r.createdAt.slice(0, 10))}</span>
                      {r.createdAt.length >= 16 && <span>{r.createdAt.slice(11, 16)}</span>}
                      {r.createdBy && <span>· {r.createdBy}</span>}
                      <button
                        type="button"
                        onClick={() => void remove(b.groupId, r.id)}
                        disabled={deletingId === r.id}
                        className="ml-auto rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        title="O'chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* Qayta yuklash — boshqa admin yozgan bo'lsa ko'rinsin */}
      {blocks.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={load}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Ro'yxatni yangilash
          </button>
        </div>
      )}
    </div>
  )
}
