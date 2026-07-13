import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePersistentState } from '@/hooks/usePersistentState'
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Download,
  Users,
  GraduationCap,
  BookOpen,
  ArrowUpRight,
  X,
} from 'lucide-react'
import type { Gender, Group, Subject, Teacher } from '@/types'
import type { TeacherPayload } from '@/api/services/teachers'
import {
  getTeachers,
  getArchivedTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  archiveTeacher,
  restoreTeacher,
  downloadTeacherCredentials,
} from '@/api/services/teachers'
import { useAuth } from '@/context/auth-context'
import { usePerm } from '@/lib/permissions'
import { getSubjects } from '@/api/services/subjects'
import { getClasses } from '@/api/services/classes'
import { genderLabels } from '@/config/constants'
import { formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { TeacherFormModal } from './TeacherFormModal'
import { TeacherViewModal } from './TeacherViewModal'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'

type Tab = 'active' | 'archived'

// Avatar uchun ism harflari va barqaror rang (faqat ko'rinish uchun)
const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
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

export function TeachersPage() {
  const { user } = useAuth()
  const { can } = usePerm()
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [archived, setArchived] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = usePersistentState<Tab>('teachers.tab', 'active')
  const [search, setSearch] = usePersistentState('teachers.search', '')
  const [genderFilter, setGenderFilter] = usePersistentState<'all' | Gender>('teachers.genderFilter', 'all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [viewing, setViewing] = useState<Teacher | null>(null)

  // Arxivga ko'chirish tasdiq oynasi
  const [archiveTarget, setArchiveTarget] = useState<Teacher | null>(null)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState<Teacher | null>(null)

  useEffect(() => {
    Promise.all([getTeachers(), getArchivedTeachers(), getSubjects(), getClasses()])
      .then(([t, a, s, c]) => {
        setTeachers(t)
        setArchived(a)
        setSubjects(s)
        setClasses(c)
      })
      .finally(() => setLoading(false))
  }, [])

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id
  // O'qituvchi o'tadigan guruhlar (guruhga o'qituvchi guruh formasida biriktiriladi — Group.teacherId).
  const teacherGroups = (tid: string) => classes.filter((c) => c.teacherId === tid && !c.isArchived)

  const source = tab === 'archived' ? archived : teachers
  const filtered = source.filter((t) => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || t.fullName.toLowerCase().includes(q)
    const matchGender = genderFilter === 'all' || t.gender === genderFilter
    return matchSearch && matchGender
  })

  // Filtrlar standart holatdan farq qiladimi — "Tozalash" tugmasi shunda ko'rinadi.
  const filtersActive = search !== '' || genderFilter !== 'all'
  const clearFilters = () => {
    setSearch('')
    setGenderFilter('all')
  }

  // KPI: faol guruhlarda biriktirilgan o'qituvchilar soni
  const activeGroups = classes.filter((c) => !c.isArchived)
  const assignedTeachers = new Set(activeGroups.map((c) => c.teacherId).filter(Boolean)).size

  const handleSubmit = (values: TeacherPayload) => {
    if (editing) {
      updateTeacher(editing.id, values).then((u) =>
        setTeachers((prev) => prev.map((t) => (t.id === u.id ? u : t))),
      )
    } else {
      createTeacher(values).then((c) => {
        setTeachers((prev) => [c, ...prev])
        setViewing(c)
      })
    }
    setFormOpen(false)
    setEditing(null)
  }

  const confirmArchive = () => {
    if (!archiveTarget) return
    const t = archiveTarget
    const today = new Date().toISOString().slice(0, 10)
    archiveTeacher(t.id, reason.trim()).then(() => {
      setTeachers((prev) => prev.filter((x) => x.id !== t.id))
      setArchived((prev) => [
        { ...t, isArchived: true, archivedAt: today, archiveReason: reason.trim() },
        ...prev,
      ])
    })
    setArchiveTarget(null)
    setReason('')
  }

  const handleRestore = (t: Teacher) => {
    if (!confirm(`"${t.fullName}" o'qituvchini arxivdan qaytarasizmi?`)) return
    restoreTeacher(t.id).then(() => {
      setArchived((prev) => prev.filter((x) => x.id !== t.id))
      setTeachers((prev) =>
        [{ ...t, isArchived: false, archivedAt: null, archiveReason: null }, ...prev].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        ),
      )
    })
  }

  const handleDelete = (t: Teacher) => setDeleting(t)

  const doDelete = (reasonId?: string) => {
    const t = deleting
    if (!t) return
    deleteTeacher(t.id, reasonId)
      .then(() => {
        setArchived((prev) => prev.filter((x) => x.id !== t.id))
        setDeleting(null)
      })
      .catch((e) => alert(e?.response?.data?.message ?? "O'chirib bo'lmadi"))
  }

  return (
    <div>
      <PageHeader
        title="O'qituvchilar"
        sub={`Faol ${teachers.length} ta · Arxivda ${archived.length} ta`}
        actions={
          <>
            {/* Faqat superadmin: o'qituvchilarni login/parol bilan Excel'ga yuklab olish.
                Parol faqat o'qituvchi hali kirmagan bo'lsa ko'rinadi. */}
            {user?.role === 'superadmin' && (
              <Button variant="secondary" onClick={() => downloadTeacherCredentials()}>
                <Download className="h-4 w-4" /> Login/parollar
              </Button>
            )}
            {tab === 'active' && can('teachers', 'create') && (
              <Button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Yangi qo'shish
              </Button>
            )}
          </>
        }
      />

      {/* KPI kartochkalar */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Faol o'qituvchilar" value={teachers.length} icon={Users} />
        <StatCard
          label="Guruhga biriktirilgan"
          value={assignedTeachers}
          icon={GraduationCap}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
        <StatCard
          label="Fanlar soni"
          value={subjects.length}
          icon={BookOpen}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Faol | Arxiv toggle */}
      <div className="tabs mb-4" role="tablist">
        <button
          type="button"
          className={cn('tab', tab === 'active' && 'active')}
          onClick={() => setTab('active')}
        >
          Faol ({teachers.length})
        </button>
        <button
          type="button"
          className={cn('tab', tab === 'archived' && 'active')}
          onClick={() => setTab('archived')}
        >
          Arxiv ({archived.length})
        </button>
      </div>

      {/* Qidiruv + filtr toolbar */}
      <div className={cn('toolbar')}>
        <div className="left">
          <div className="search-inline">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="F.I.SH bo'yicha qidirish..."
            />
          </div>
        </div>
        <div className="right">
          <button
            type="button"
            className={cn('filter-chip', genderFilter === 'all' && 'active')}
            onClick={() => setGenderFilter('all')}
          >
            Barchasi
          </button>
          <button
            type="button"
            className={cn('filter-chip', genderFilter === 'male' && 'active')}
            onClick={() => setGenderFilter('male')}
          >
            {genderLabels.male}
          </button>
          <button
            type="button"
            className={cn('filter-chip', genderFilter === 'female' && 'active')}
            onClick={() => setGenderFilter('female')}
          >
            {genderLabels.female}
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              title="Barcha filtrlarni tozalash"
            >
              <X className="h-4 w-4" /> Filtrni tozalash
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="state">
            <h4>{tab === 'active' ? 'Hech narsa topilmadi' : "Arxivda o'qituvchi yo'q"}</h4>
            <p>Filtrlarni o'zgartirib ko'ring.</p>
          </div>
        </Card>
      ) : tab === 'active' ? (
        /* ---- Faol o'qituvchilar — kartalar ---- */
        <div className="entity-grid">
          {filtered.map((t) => {
            const groups = teacherGroups(t.id)
            return (
              <div
                key={t.id}
                className="entity-card cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/teachers/${t.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/admin/teachers/${t.id}`)
                  }
                }}
              >
                <div className="ec-head">
                  {t.photoUrl ? (
                    <img
                      src={t.photoUrl}
                      alt=""
                      className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="avatar h-11 w-11 text-sm"
                      style={{ background: avatarColor(t.fullName) }}
                    >
                      {initialsOf(t.fullName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="ec-name truncate">{t.fullName}</div>
                    <div className="ec-meta">
                      {genderLabels[t.gender]}
                      {t.birthDate ? ` · ${formatDate(t.birthDate)}` : ''}
                    </div>
                  </div>
                  <Badge tone={t.salaryMode === 'percent' ? 'blue' : 'violet'} dot>
                    {t.salaryMode === 'percent' ? 'Foiz' : "Qat'iy"}
                  </Badge>
                </div>

                {/* Fanlar */}
                <div className="flex flex-wrap gap-1">
                  {t.subjectIds.length > 0 ? (
                    t.subjectIds.map((id) => (
                      <Badge key={id} tone="violet">
                        {subjectName(id)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Fan biriktirilmagan</span>
                  )}
                </div>

                {/* Statistika bloki */}
                <div className="ec-stats">
                  <div>
                    <div className="ec-stat-label">Guruhlar</div>
                    <div className="ec-stat-value">{groups.length}</div>
                  </div>
                  <div>
                    <div className="ec-stat-label">Fanlar</div>
                    <div className="ec-stat-value">{t.subjectIds.length}</div>
                  </div>
                  <div>
                    <div className="ec-stat-label">Telefon</div>
                    <div className="ec-stat-value font-mono text-[12px]">{t.phone || '—'}</div>
                  </div>
                </div>

                {/* O'qituvchi o'tadigan guruhlar chiplari */}
                {groups.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {groups.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="ec-foot" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/admin/teachers/${t.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <ArrowUpRight className="h-4 w-4" /> Batafsil
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => setViewing(t)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {can('teachers', 'edit') && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(t)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {can('teachers', 'delete') && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReason('')
                        setArchiveTarget(t)
                      }}
                      title="Arxivga ko'chirish"
                      aria-label="Arxivga ko'chirish"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ---- Arxiv — jadval ---- */
        <Card tight>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-10 px-4 py-3">#</th>
                  <th className="px-4 py-3">F.I.SH</th>
                  <th className="px-4 py-3">Jinsi</th>
                  <th className="px-4 py-3">Fanlar</th>
                  <th className="px-4 py-3">Arxiv sanasi</th>
                  <th className="px-4 py-3">Sabab</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t, i) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="cell-user">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt="" className="avatar object-cover" />
                        ) : (
                          <div className="avatar" style={{ background: avatarColor(t.fullName) }}>
                            {initialsOf(t.fullName)}
                          </div>
                        )}
                        <div className="meta">
                          <strong className="text-slate-800">{t.fullName}</strong>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{genderLabels[t.gender]}</td>
                    <td className="px-4 py-3">
                      <SubjectTags ids={t.subjectIds} name={subjectName} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.archivedAt ? formatDate(t.archivedAt) : '—'}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3 text-slate-500"
                      title={t.archiveReason ?? ''}
                    >
                      {t.archiveReason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconBtn icon={Eye} title="Ko'rish" onClick={() => setViewing(t)} />
                        {can('teachers', 'edit') && (
                          <IconBtn
                            icon={RotateCcw}
                            title="Arxivdan qaytarish"
                            onClick={() => handleRestore(t)}
                          />
                        )}
                        {can('teachers', 'delete') && (
                          <IconBtn
                            icon={Trash2}
                            title="Butunlay o'chirish"
                            danger
                            onClick={() => handleDelete(t)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TeacherFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initial={editing}
        subjects={subjects}
      />
      <TeacherViewModal
        teacher={viewing}
        subjects={subjects}
        groups={viewing ? teacherGroups(viewing.id) : []}
        onClose={() => setViewing(null)}
      />

      <ReasonPromptModal
        open={!!deleting}
        category="teacher_delete"
        title="O'qituvchini o'chirish"
        message={deleting ? `"${deleting.fullName}" o'qituvchini BUTUNLAY o'chirasizmi? Bu amalni ortga qaytarib bo'lmaydi.` : undefined}
        confirmLabel="O'chirish"
        tone="red"
        onConfirm={doDelete}
        onClose={() => setDeleting(null)}
      />

      {/* Arxivga ko'chirish tasdiqi */}
      <Modal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        size="md"
        title="Arxivga ko'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              Bekor qilish
            </Button>
            <Button variant="danger" onClick={confirmArchive}>
              <Archive className="h-4 w-4" /> Arxivga ko'chirish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{archiveTarget?.fullName}</span> arxivga
            ko'chiriladi: faol ro'yxatdan yashiriladi va tizimga kirishi bloklanadi. Jurnal va
            hisobot ma'lumotlari saqlanib qoladi.
          </p>
          <Textarea
            label="Sabab (ixtiyoriy)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Masalan: ishdan bo'shadi"
          />
        </div>
      </Modal>
    </div>
  )
}

function SubjectTags({ ids, name }: { ids: string[]; name: (id: string) => string }) {
  if (ids.length === 0) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span
          key={id}
          className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
        >
          {name(id)}
        </span>
      ))}
    </div>
  )
}

interface IconBtnProps {
  icon: typeof Eye
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
