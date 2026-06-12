import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HubConnection } from '@microsoft/signalr'
import { RefreshCw, Wifi, WifiOff, Search, LogIn, LogOut } from 'lucide-react'
import {
  getStudentTurnstile,
  syncStudentTurnstile,
  setStudentDevice,
  type StudentTurnstileDashboard,
} from '@/api/services/studentTurnstile'
import { connectLiveTopic } from '@/api/services/live'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const syncLabel = (iso: string) => (iso && iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—')

/**
 * O'quvchilar turniketi — har o'quvchining kunlik kirgan/chiqqan vaqti (turniket/FaceID integratsiyasidan).
 * O'tishlar tarix sifatida saqlanadi; istalgan kunni tanlab ko'rish mumkin. Qurilma ID joyida biriktiriladi.
 */
export function StudentTurnstilePage() {
  const [date, setDate] = useState(today())
  const [dash, setDash] = useState<StudentTurnstileDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback((d: string) => {
    setLoading(true)
    getStudentTurnstile(d)
      .then((data) => {
        setDash(data)
        setDrafts({})
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => load(date), [date, load])

  // Real-time: turniketdan yangi o'tish kelganda joriy kun jadvalini jonli yangilaymiz (SignalR).
  const reloadRef = useRef<() => void>(() => {})
  reloadRef.current = () => load(date)
  useEffect(() => {
    let conn: HubConnection | null = null
    connectLiveTopic('turnstile', { turnstileChanged: () => reloadRef.current() })
      .then((c) => { conn = c })
      .catch(() => {})
    return () => { conn?.stop() }
  }, [])

  const onSync = async () => {
    setSyncing(true)
    try {
      const res = await syncStudentTurnstile()
      alert(res.message)
      load(date)
    } catch {
      alert('Sinxronlashda xatolik')
    } finally {
      setSyncing(false)
    }
  }

  // Qurilma ID'ni saqlash (o'zgargan bo'lsa) — keyin vaqtlar yangilanishi uchun qayta yuklaymiz.
  const saveDevice = async (studentId: string, current: string) => {
    const draft = drafts[studentId]
    if (draft === undefined || draft.trim() === current.trim()) return
    setSavingId(studentId)
    try {
      await setStudentDevice(studentId, draft.trim())
      load(date)
    } catch {
      alert("Qurilma ID'ni saqlashda xatolik")
    } finally {
      setSavingId(null)
    }
  }

  const classes = useMemo(
    () => [...new Set((dash?.rows ?? []).map((r) => r.className).filter(Boolean))].sort(),
    [dash],
  )

  const q = search.trim().toLowerCase()
  const visibleRows = (dash?.rows ?? []).filter((r) => {
    if (q && !r.fullName.toLowerCase().includes(q)) return false
    if (classFilter !== 'all' && r.className !== classFilter) return false
    return true
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="O'quvchilar turniketi"
        sub="Turniket/FaceID qurilmasidan avtomatik — har o'quvchining kirgan va chiqqan vaqti. O'tishlar saqlanib boradi, istalgan kunni tanlab ko'rishingiz mumkin."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {dash?.turnstileEnabled ? (
              <Badge tone="green">
                <Wifi className="h-3.5 w-3.5" /> Turniket yoqilgan
              </Badge>
            ) : (
              <Link to="/admin/settings/turnstile" className="hover:opacity-80">
                <Badge>
                  <WifiOff className="h-3.5 w-3.5" /> Turniket o'chiq — sozlash
                </Badge>
              </Link>
            )}
            {dash?.lastSync && (
              <span className="text-xs text-slate-400">Oxirgi sinx: {syncLabel(dash.lastSync)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O'quvchi qidirish..."
                className="w-48 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400"
              />
            </div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-400"
            >
              <option value="all">Barcha guruhlar</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-400"
            />
            <Button onClick={onSync} disabled={syncing}>
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              {syncing ? 'Sinxron...' : 'Sinxronlash'}
            </Button>
          </div>
        </div>

        {/* Jamlama */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="font-mono text-2xl font-semibold text-slate-800">{dash?.total ?? 0}</div>
            <div className="text-xs text-slate-400">Jami o'quvchi</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="font-mono text-2xl font-semibold text-emerald-600">{dash?.present ?? 0}</div>
            <div className="text-xs text-slate-400">Bugun o'tgan</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="font-mono text-2xl font-semibold text-slate-400">
              {(dash?.total ?? 0) - (dash?.present ?? 0)}
            </div>
            <div className="text-xs text-slate-400">O'tmagan</div>
          </div>
        </div>

        {loading ? (
          <Loader label="Yuklanmoqda..." />
        ) : !dash || dash.rows.length === 0 ? (
          <p className="py-8 text-center text-slate-400">O'quvchi yo'q</p>
        ) : visibleRows.length === 0 ? (
          <p className="py-8 text-center text-slate-400">Filtrga mos o'quvchi topilmadi</p>
        ) : (
          <div className="table-wrap -mx-5 -mb-5">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12 text-center">№</th>
                  <th>F.I.SH</th>
                  <th>Guruh</th>
                  <th>Qurilma ID</th>
                  <th className="text-center">Kirgan vaqti</th>
                  <th className="text-center">Chiqqan vaqti</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr key={r.studentId}>
                    <td className="text-center font-mono text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-800">{r.fullName}</td>
                    <td className="text-slate-500">{r.className || '—'}</td>
                    <td>
                      <input
                        value={drafts[r.studentId] ?? r.deviceUserId}
                        onChange={(e) => setDrafts((p) => ({ ...p, [r.studentId]: e.target.value }))}
                        onBlur={() => saveDevice(r.studentId, r.deviceUserId)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        disabled={savingId === r.studentId}
                        placeholder="ID..."
                        title="Turniket qurilmasidagi raqam (employeeNo)"
                        className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-sm text-slate-700 outline-none focus:border-brand-400 disabled:opacity-50"
                      />
                    </td>
                    <td className="text-center">
                      {r.checkIn ? (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                          <LogIn className="h-3.5 w-3.5" /> {r.checkIn}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {r.checkOut ? (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-500">
                          <LogOut className="h-3.5 w-3.5" /> {r.checkOut}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
