import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Users, Search, ChevronRight } from 'lucide-react'
import type { TestGroupOverview } from '@/types'
import { getTestGroups } from '@/api/services/testResults'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiErrorMessage } from '@/lib/utils'

/**
 * "O'quv bo'limi" → Testlar natijalari — bosh sahifa: barcha guruhlar kartalari.
 * Har kartada guruh nomi, kurs/o'qituvchi, faol o'quvchilar soni va yaratilgan testlar soni.
 * Guruhga kirilsa — shu guruhning testlar ro'yxati.
 */
export function TestResultsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<TestGroupOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    getTestGroups()
      .then(setGroups)
      .catch((e) => setError(apiErrorMessage(e, 'Guruhlarni yuklab bo\'lmadi')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return groups
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(s) ||
        g.courseName.toLowerCase().includes(s) ||
        g.teacherName.toLowerCase().includes(s),
    )
  }, [groups, q])

  return (
    <div>
      <PageHeader
        title="Testlar natijalari"
        sub="Guruh tanlang — o'quvchilardan olingan testlar natijalarini kiriting"
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Guruh, kurs yoki o'qituvchi qidirish..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400"
        />
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : error ? (
        <Card className="py-10 text-center text-red-500">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-slate-400">
          {groups.length === 0 ? 'Guruhlar topilmadi' : 'Qidiruvga mos guruh yo\'q'}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <button
              key={g.groupId}
              type="button"
              onClick={() => navigate(`/admin/test-results/${g.groupId}`)}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-300 hover:shadow-[0_4px_16px_oklch(0.5_0.18_282_/_0.1)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{g.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {[g.courseName, g.teacherName].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Users className="h-3.5 w-3.5" /> {g.studentCount}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-brand-600">
                    <ClipboardList className="h-3.5 w-3.5" /> {g.testCount} ta test
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
