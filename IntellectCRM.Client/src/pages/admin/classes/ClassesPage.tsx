import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  List,
  ArrowDown,
  CalendarDays,
  Clock,
  User,
} from 'lucide-react'
import type { Group, GroupFillRow, Teacher } from '@/types'
import type { ClassPayload } from '@/api/services/classes'
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getArchivedClasses,
  archiveClass,
  unarchiveClass,
  getGroupFill,
} from '@/api/services/classes'
import { getClassesStats, type ClassStats, getAllGroupsGradingStats, type GradingGroupStats } from '@/api/services/classPerformance'
import { getTeachers } from '@/api/services/teachers'
import { languageLabels } from '@/config/constants'
import { formatMoney, formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'
import { ClassFormModal } from './ClassFormModal'
import { ClassMembersModal } from './ClassMembersModal'

// Avatar uchun ism harflari va barqaror rang (faqat ko'rinish uchun)
const initialsOf = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s[0]?.toUpperCase())
    .join('')

const AVATAR_COLORS = [
  '#7c3aed',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
]
const avatarColor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ClassesPage() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState<Group[]>([])
  const [stats, setStats] = useState<Record<string, ClassStats>>({})
  const [gradingStats, setGradingStats] = useState<Record<string, GradingGroupStats>>({})
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  // Oylik to'lov o'zgarganda — yangi narxni o'quvchilarga qachondan qo'llashni so'rash uchun
  const [feePrompt, setFeePrompt] = useState<{
    id: string
    values: ClassPayload
    oldFee: number
  } | null>(null)
  /** Arxivlangan sinflar ro'yxati + arxiv ko'rinishi yoqilganmi */
  const [archived, setArchived] = useState<Group[]>([])
  const [showArchived, setShowArchived] = useState(false)
  /** A'zolarni boshqarish modali uchun tanlangan guruh */
  const [membersOf, setMembersOf] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  /** Guruh to'ldirish ko'rinishi */
  const [fill, setFill] = useState<GroupFillRow[]>([])
  const [showFill, setShowFill] = useState(false)
  /** Saralash (reyting): tartib bo'yicha | o'rtacha baho | davomat. Baho/davomat — yuqoridan pastga. */
  const [sort, setSort] = useState<'order' | 'grade' | 'attendance'>('order')
  /** Ko'rinish: kartalar yoki jadval */
  const [view, setView] = useState<'card' | 'table'>('card')
  /** O'qituvchi filteri — faqat shu o'qituvchining guruhlari ko'rsatiladi */
  const [teacherFilter, setTeacherFilter] = useState('all')

  const filteredClasses = useMemo(() => {
    if (teacherFilter === 'all') return classes
    return classes.filter((c) => c.teacherId === teacherFilter)
  }, [classes, teacherFilter])

  const sortedClasses = useMemo(() => {
    if (sort === 'order') return filteredClasses
    return [...filteredClasses].sort((a, b) => {
      const sa = stats[a.id]
      const sb = stats[b.id]
      if (sort === 'grade') return (sb?.averageGrade ?? -1) - (sa?.averageGrade ?? -1)
      return (sb?.attendance ?? -1) - (sa?.attendance ?? -1)
    })
  }, [filteredClasses, stats, sort])

  const teacherName = (id?: string) =>
    id ? (teachers.find((t) => t.id === id)?.fullName ?? '—') : '—'

  useEffect(() => {
    Promise.all([getClasses(), getClassesStats(), getArchivedClasses(), getTeachers(), getAllGroupsGradingStats()])
      .then(([cl, st, ar, te, gs]) => {
        setClasses(cl)
        setStats(st)
        setArchived(ar)
        setTeachers(te)
        setGradingStats(gs)
      })
      .finally(() => setLoading(false))
  }, [])

  const applyUpdate = (id: string, values: ClassPayload, applyFee?: boolean) =>
    updateClass(id, values, applyFee)
      .then((u) => {
        // Backend xona konflikti warning qaytarsa (200 + roomConflict=true) — yangilamaymiz
        const any = u as unknown as Record<string, unknown>
        if (any.roomConflict) {
          const list = (any.conflicts as Array<{ groupName: string; sharedDays: string; existingSlot: string }> | undefined)
            ?.map((c) => `${c.groupName} (${c.sharedDays}, ${c.existingSlot})`)
            .join('; ')
          alert(`Xonada vaqt konflikti: ${list ?? ''}`)
          return
        }
        setClasses((prev) => prev.map((c) => (c.id === u.id ? u : c)))
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        alert(msg ?? 'Saqlashda xatolik yuz berdi')
      })

  const handleSubmit = (values: ClassPayload) => {
    if (editing) {
      // Oylik to'lov o'zgargan bo'lsa — o'quvchilarga qo'llashni so'raymiz (Ha/Yo'q)
      if (values.monthlyFee !== editing.monthlyFee) {
        setFeePrompt({ id: editing.id, values, oldFee: editing.monthlyFee })
        setFormOpen(false)
        setEditing(null)
        return
      }
      applyUpdate(editing.id, values)
    } else {
      createClass(values)
        .then((c) => {
          const any = c as unknown as Record<string, unknown>
          if (any.roomConflict) {
            const list = (any.conflicts as Array<{ groupName: string; sharedDays: string; existingSlot: string }> | undefined)
              ?.map((x) => `${x.groupName} (${x.sharedDays}, ${x.existingSlot})`)
              .join('; ')
            alert(`Xonada vaqt konflikti: ${list ?? ''}`)
            return
          }
          setClasses((prev) => [...prev, c])
        })
        .catch((e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          alert(msg ?? 'Saqlashda xatolik yuz berdi')
        })
    }
    setFormOpen(false)
    setEditing(null)
  }

  const resolveFeePrompt = (applyFee: boolean) => {
    if (!feePrompt) return
    applyUpdate(feePrompt.id, feePrompt.values, applyFee)
    setFeePrompt(null)
  }

  const handleDelete = (c: Group) => setDeletingGroup(c)

  const doDeleteGroup = (reasonId: string | undefined) => {
    const c = deletingGroup
    if (!c) return
    deleteClass(c.id, reasonId)
      .then(() => {
        setClasses((prev) => prev.filter((x) => x.id !== c.id))
        setArchived((prev) => prev.filter((x) => x.id !== c.id))
        setDeletingGroup(null)
      })
      .catch((e) => alert(e?.response?.data?.message ?? "Guruhni o'chirib bo'lmadi"))
  }

  const handleArchive = (c: Group) => {
    if (!confirm(`"${c.name}" guruhini arxivlaysizmi?\nGuruhdagi barcha o'quvchilar ham arxivlanadi (login bloklanadi).`))
      return
    archiveClass(c.id)
      .then((r) => {
        setClasses((prev) => prev.filter((x) => x.id !== c.id))
        setArchived((prev) => [{ ...c, isArchived: true }, ...prev])
        alert(`"${c.name}" arxivlandi — ${r.archivedStudents} ta o'quvchi ham arxivlandi.`)
      })
      .catch((e) => alert(e?.response?.data?.message ?? 'Arxivlashda xatolik'))
  }

  const handleUnarchive = (c: Group) => {
    if (!confirm(`"${c.name}" guruhini arxivdan chiqarasizmi?\nGuruh bilan arxivlangan o'quvchilar ham qaytariladi.`))
      return
    unarchiveClass(c.id)
      .then((r) => {
        setArchived((prev) => prev.filter((x) => x.id !== c.id))
        setClasses((prev) => [...prev, { ...c, isArchived: false }])
        alert(`"${c.name}" arxivdan chiqarildi — ${r.restoredStudents} ta o'quvchi ham qaytarildi.`)
      })
      .catch((e) => alert(e?.response?.data?.message ?? 'Arxivdan chiqarishda xatolik'))
  }

  return (
    <div>
      <PageHeader
        title={showArchived ? 'Arxivlangan guruhlar' : 'Guruhlar'}
        sub={
          showArchived
            ? `${archived.length} ta arxivlangan guruh`
            : `Jami ${classes.length} ta guruh`
        }
        actions={
          <>
            {!showArchived && (
              <Button
                variant="secondary"
                onClick={() => {
                  setShowFill((v) => {
                    const next = !v
                    if (next && fill.length === 0) getGroupFill().then(setFill).catch(() => {})
                    return next
                  })
                }}
              >
                <LayoutGrid className="h-4 w-4" /> {showFill ? 'Jadvalni yopish' : "Guruh to'ldirish"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? (
                <>
                  <Users className="h-4 w-4" /> Faol guruhlar
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Arxiv ({archived.length})
                </>
              )}
            </Button>
            {!showArchived && (
              <Button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Yangi guruh
              </Button>
            )}
          </>
        }
      />

      {/* Saralash (reyting) toolbar — faqat faol guruhlar uchun */}
      {!showArchived && !loading && classes.length > 0 && (
        <div className="toolbar">
          <div className="left">
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">Barcha o'qituvchilar</option>
              {teachers
                .filter((t) => classes.some((c) => c.teacherId === t.id))
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
            </select>

            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Saralash:
            </span>
            <SortChip
              label="Tartib"
              active={sort === 'order'}
              onClick={() => setSort('order')}
            />
            <SortChip
              label="O'rtacha baho"
              active={sort === 'grade'}
              onClick={() => setSort('grade')}
            />
            <SortChip
              label="Davomat"
              active={sort === 'attendance'}
              onClick={() => setSort('attendance')}
            />
          </div>

          {/* Ko'rinishni tanlash: kartalar | jadval */}
          <div className="right">
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                onClick={() => setView('card')}
                className={cn('tab inline-flex items-center gap-1.5', view === 'card' && 'active')}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kartalar
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => setView('table')}
                className={cn('tab inline-flex items-center gap-1.5', view === 'table' && 'active')}
              >
                <List className="h-3.5 w-3.5" /> Jadval
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : showArchived ? (
        <Card tight>
          <ArchivedTable items={archived} onUnarchive={handleUnarchive} onDelete={handleDelete} />
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <div className="state">
            <h4>Guruhlar yo'q</h4>
            <p>Yangi guruh qo'shing.</p>
          </div>
        </Card>
      ) : view === 'table' ? (
        /* ---- Faol guruhlar — jadval ko'rinishi ---- */
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guruh</th>
                  <th>Til</th>
                  <th>O'qituvchi</th>
                  <th>Kunlar</th>
                  <th>Vaqt</th>
                  <th className="num">O'quvchilar</th>
                  <th className="num">O'rtacha</th>
                  <th className="num">Davomat</th>
                  <th className="num">Baholash</th>
                  <th className="num">Oylik to'lov</th>
                  <th className="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {sortedClasses.map((c) => {
                  const st = stats[c.id]
                  const gs = gradingStats[c.id]
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/classes/${c.id}`)}
                    >
                      <td>
                        <div className="cell-user">
                          <div className="avatar" style={{ background: avatarColor(c.name) }}>
                            {initialsOf(c.name)}
                          </div>
                          <div className="meta">
                            <strong>
                              <Link
                                to={`/admin/classes/${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-inherit no-underline hover:underline"
                              >
                                {c.name}
                              </Link>
                            </strong>
                            <span>{c.room || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={c.language === 'uz' ? 'blue' : 'amber'}>
                          {languageLabels[c.language]}
                        </Badge>
                      </td>
                      <td className="text-slate-600">{teacherName(c.teacherId)}</td>
                      <td className="text-slate-600">{formatDays(c.days)}</td>
                      <td className="num text-slate-600">{formatTime(c.startTime, c.endTime)}</td>
                      <td className="num">{st ? st.studentsCount : '—'}</td>
                      <td className={cn('num font-semibold', st && gradeColor(st.averageGrade))}>
                        {st ? st.averageGrade.toFixed(1) : '—'}
                      </td>
                      <td
                        className={cn(
                          'num font-semibold',
                          st && st.attendance != null && attColor(st.attendance),
                        )}
                      >
                        {st && st.attendance != null ? `${st.attendance}%` : '—'}
                      </td>
                      <td className="num text-slate-700 font-mono">
                        {gs ? `${gs.totalGrades}` : '—'}
                      </td>
                      <td className="num font-semibold text-slate-800">
                        {formatMoney(c.monthlyFee)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <IconBtn icon={Users} title="A'zolar" onClick={() => setMembersOf(c)} />
                          <IconBtn
                            icon={Pencil}
                            title="Tahrirlash"
                            onClick={() => {
                              setEditing(c)
                              setFormOpen(true)
                            }}
                          />
                          <IconBtn icon={Archive} title="Arxivlash" onClick={() => handleArchive(c)} />
                          <IconBtn icon={Trash2} title="O'chirish" danger onClick={() => handleDelete(c)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ---- Faol guruhlar — kartalar (kattaroq) ---- */
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
          {sortedClasses.map((c) => {
            const st = stats[c.id]
            const gs = gradingStats[c.id]
            return (
              <div
                key={c.id}
                className="entity-card cursor-pointer"
                style={{ padding: '18px 20px' }}
                onClick={() => navigate(`/admin/classes/${c.id}`)}
              >
                <div className="ec-head">
                  <div
                    className="avatar h-12 w-12 text-[15px]"
                    style={{ background: avatarColor(c.name) }}
                  >
                    {initialsOf(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="ec-name truncate">
                      <Link
                        to={`/admin/classes/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-inherit no-underline hover:underline"
                      >
                        {c.name}
                      </Link>
                    </div>
                    <div className="ec-meta truncate">
                      {languageLabels[c.language]}
                      {st && st.studentsCount > 0 && (
                        <span className="ml-2 text-slate-500">
                          • {st.studentsCount} o'quvchi
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge tone={c.language === 'uz' ? 'blue' : 'amber'}>
                    {languageLabels[c.language]}
                  </Badge>
                </div>

                {/* O'qituvchi · kunlar · vaqt · xona */}
                <div className="flex flex-col gap-1.5 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <User className="h-3.5 w-3.5" /> O'qituvchi
                    </span>
                    <span className="truncate font-medium text-slate-700">
                      {teacherName(c.teacherId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" /> Kunlar
                    </span>
                    <span className="text-slate-600">{formatDays(c.days)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" /> Vaqt
                    </span>
                    <span className="font-mono text-slate-600">
                      {formatTime(c.startTime, c.endTime)}
                    </span>
                  </div>
                </div>

                {/* Statistika bloki: o'quvchilar · o'rtacha baho · davomat · baholash */}
                <div className="ec-stats">
                  <div>
                    <div className="ec-stat-label">O'quvchilar</div>
                    <div className="ec-stat-value font-semibold">
                      {st?.studentsCount ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="ec-stat-label">O'rtacha</div>
                    <div className={cn('ec-stat-value', st && gradeColor(st.averageGrade))}>
                      {st ? st.averageGrade.toFixed(1) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="ec-stat-label">Davomat</div>
                    <div
                      className={cn(
                        'ec-stat-value',
                        st && st.attendance != null && attColor(st.attendance),
                      )}
                    >
                      {st && st.attendance != null ? `${st.attendance}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="ec-stat-label">Baholash</div>
                    <div className="ec-stat-value font-mono font-semibold text-blue-600">
                      {gs ? `📊 ${gs.averageScore.toFixed(1)}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Oylik to'lov + xona */}
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-slate-400">Oylik to'lov</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatMoney(c.monthlyFee)}
                  </span>
                </div>

                <div className="ec-foot" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setMembersOf(c)}
                  >
                    <Users className="h-4 w-4" /> A'zolar
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setEditing(c)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Tahrirlash
                  </Button>
                  <Button
                    variant="secondary"
                    title="Arxivlash (o'quvchilari bilan)"
                    aria-label="Arxivlash"
                    onClick={() => handleArchive(c)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    title="O'chirish"
                    aria-label="O'chirish"
                    onClick={() => handleDelete(c)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showFill && !showArchived && (
        <Card tight className="mt-5">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Guruh to'ldirish</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Guruh</th>
                  <th className="px-4 py-3">Daraja</th>
                  <th className="px-4 py-3">O'quvchilar</th>
                  <th className="px-4 py-3">Sig'im</th>
                  <th className="px-4 py-3">Bo'sh o'rin</th>
                  <th className="px-4 py-3">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fill.map((r) => (
                  <tr key={r.groupId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.grade}</td>
                    <td className="px-4 py-3 text-slate-600">{r.enrolled}</td>
                    <td className="px-4 py-3 text-slate-600">{r.capacity === 0 ? 'cheksiz' : r.capacity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'font-medium',
                          r.capacity > 0 && r.freeSeats === 0 ? 'text-red-600' : 'text-emerald-600',
                        )}
                      >
                        {r.capacity === 0 ? '—' : r.freeSeats}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          statusBadge(r.status),
                        )}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {fill.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      Ma'lumot yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ClassFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <ClassMembersModal group={membersOf} onClose={() => setMembersOf(null)} />

      <ReasonPromptModal
        open={!!deletingGroup}
        category="group_delete"
        title="Guruhni o'chirish"
        message={deletingGroup ? `"${deletingGroup.name}" guruhini o'chirasizmi?` : undefined}
        confirmLabel="O'chirish"
        tone="red"
        onConfirm={doDeleteGroup}
        onClose={() => setDeletingGroup(null)}
      />

      <Modal
        open={!!feePrompt}
        onClose={() => setFeePrompt(null)}
        title="Oylik to'lovni o'quvchilarga qo'llash"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => resolveFeePrompt(false)}>
              Yo'q — keyingi oydan
            </Button>
            <Button onClick={() => resolveFeePrompt(true)}>Ha — joriy oydan</Button>
          </>
        }
      >
        {feePrompt && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-800">{feePrompt.values.name}</span> guruhining
              oylik to'lovi{' '}
              <span className="font-medium">{formatMoney(feePrompt.oldFee)}</span> →{' '}
              <span className="font-medium">{formatMoney(feePrompt.values.monthlyFee)}</span> so'mga
              o'zgardi. Yangi narx shu guruhdagi o'quvchilarga qachondan qo'llansin?
            </p>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500">
              <p>
                <b className="text-slate-700">Ha</b> — joriy oy to'lovi yangi narxga o'zgaradi
                (balans farqqa moslab to'g'rilanadi).
              </p>
              <p className="mt-1">
                <b className="text-slate-700">Yo'q</b> — joriy oy eski narxda qoladi, yangi narx
                keyingi oydan hisoblanadi.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function gradeColor(g: number): string {
  if (g >= 4.5) return 'text-emerald-600'
  if (g >= 4) return 'text-brand-600'
  if (g >= 3.5) return 'text-amber-600'
  return 'text-red-600'
}

function attColor(a: number): string {
  if (a >= 95) return 'text-emerald-600'
  if (a >= 90) return 'text-amber-600'
  return 'text-red-600'
}

const DAY_SHORT = ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Yak']
function formatDays(days?: number[]): string {
  if (!days || days.length === 0) return '—'
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d] ?? '?').join(', ')
}
function formatTime(start?: string, end?: string): string {
  if (start && end) return `${start}–${end}`
  return start || end || '—'
}

/** Saralash chipi (reyting uchun — bosilganda yuqoridan pastga saralaydi). */
function SortChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Reyting bo'yicha saralash"
      className={cn('filter-chip', active && 'active')}
    >
      {label}
      {active && label !== 'Tartib' && <ArrowDown className="h-3 w-3" />}
    </button>
  )
}

function statusLabel(s: GroupFillRow['status']): string {
  return s === 'full' ? "To'lgan" : s === 'archived' ? 'Arxiv' : 'Faol'
}

function statusBadge(s: GroupFillRow['status']): string {
  return s === 'full'
    ? 'bg-red-50 text-red-700'
    : s === 'archived'
      ? 'bg-slate-100 text-slate-500'
      : 'bg-emerald-50 text-emerald-700'
}

function ArchivedTable({
  items,
  onUnarchive,
  onDelete,
}: {
  items: Group[]
  onUnarchive: (c: Group) => void
  onDelete: (c: Group) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="w-10 px-4 py-3">#</th>
            <th className="px-4 py-3">Guruh nomi</th>
            <th className="px-4 py-3">Til</th>
            <th className="px-4 py-3">Xona</th>
            <th className="px-4 py-3">Arxiv sanasi</th>
            <th className="px-4 py-3 text-right">Amallar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((c, i) => (
            <tr key={c.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-3 text-slate-400">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    c.language === 'uz' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {languageLabels[c.language]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{c.room || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{c.archivedAt ? formatDate(c.archivedAt) : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-0.5">
                  <IconBtn
                    icon={ArchiveRestore}
                    title="Arxivdan chiqarish (o'quvchilari bilan)"
                    onClick={() => onUnarchive(c)}
                  />
                  <IconBtn icon={Trash2} title="O'chirish" danger onClick={() => onDelete(c)} />
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                Arxivlangan guruh yo'q
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface IconBtnProps {
  icon: typeof Pencil
  title: string
  onClick: () => void
  danger?: boolean
}

function IconBtn({ icon: Icon, title, onClick, danger }: IconBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        danger
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
