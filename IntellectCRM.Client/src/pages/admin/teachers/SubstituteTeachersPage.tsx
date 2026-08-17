import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Users,
  Calendar,
  UserCheck,
  XCircle,
  CheckCircle2,
  UserX,
  ArrowRight,
} from 'lucide-react'
import type { Group, Teacher, SubstituteTeacherAssignment } from '@/types'
import {
  getSubstituteAssignments,
  createSubstituteAssignment,
  cancelSubstituteAssignment,
  getGroupLessonDates,
} from '@/api/services/substituteTeachers'
import { getTeachers } from '@/api/services/teachers'
import { getClasses } from '@/api/services/classes'
import { usePerm } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardTabs } from '@/components/ui/CardTabs'
import { teacherTabs } from '@/config/sectionTabs'
import { StatCard } from '@/components/ui/StatCard'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { TablePagination, usePagination } from '@/components/ui/TablePagination'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

export function SubstituteTeachersPage() {
  const { can } = usePerm()
  const canSeeReports = can('teacherReports', 'view')

  const [assignments, setAssignments] = useState<SubstituteTeacherAssignment[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [groupIdFilter, setGroupIdFilter] = useState('')
  const [teacherIdFilter, setTeacherIdFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'cancelled' | 'all'>('all')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form State
  const [formGroupId, setFormGroupId] = useState('')
  const [formSubstituteTeacherId, setFormSubstituteTeacherId] = useState('')
  const [formMonth, setFormMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [lessonDates, setLessonDates] = useState<Array<{ date: string; dayName: string; isScheduled: boolean }>>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [loadingLessonDates, setLoadingLessonDates] = useState(false)
  const [formReason, setFormReason] = useState('')

  // Cancel Modal state
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [assRes, teachRes, clsRes] = await Promise.allSettled([
        getSubstituteAssignments(),
        getTeachers(),
        getClasses(),
      ])
      if (assRes.status === 'fulfilled') setAssignments(assRes.value)
      if (teachRes.status === 'fulfilled') setTeachers(teachRes.value)
      if (clsRes.status === 'fulfilled') setClasses(clsRes.value)
    } catch (e) {
      console.error("Ma'lumotlarni yuklashda xatolik:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!formGroupId || !formMonth) {
      setLessonDates([])
      setSelectedDates([])
      return
    }
    let active = true
    setLoadingLessonDates(true)
    getGroupLessonDates(formGroupId, formMonth)
      .then((res) => {
        if (active) {
          setLessonDates(res)
          setSelectedDates(res.map((r) => r.date))
        }
      })
      .catch(() => {
        if (active) {
          setLessonDates([])
          setSelectedDates([])
        }
      })
      .finally(() => {
        if (active) setLoadingLessonDates(false)
      })
    return () => {
      active = false
    }
  }, [formGroupId, formMonth])

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    )
  }

  const selectAllDates = () => {
    setSelectedDates(lessonDates.map((d) => d.date))
  }

  const clearAllDates = () => {
    setSelectedDates([])
  }

  // Auto-derived original teacher for selected group in modal
  const selectedGroup = useMemo(
    () => classes.find((c) => c.id === formGroupId),
    [classes, formGroupId]
  )
  const originalTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedGroup?.teacherId),
    [teachers, selectedGroup]
  )

  // Estimated Single Lesson Rate
  const singleLessonRate = useMemo(() => {
    if (!selectedGroup) return 0
    const scheduledLessons = lessonDates.length > 0 ? lessonDates.length : 12
    let groupSalaryPool = 0

    if (selectedGroup.teacherSalaryMode === 'fixed' && (selectedGroup.teacherSalaryFixed || 0) > 0) {
      groupSalaryPool = selectedGroup.teacherSalaryFixed || 0
    } else {
      const activeCount = selectedGroup.studentCount || 10
      const totalTuition = (selectedGroup.monthlyFee || 0) * (activeCount > 0 ? activeCount : 10)
      const pctVal = (selectedGroup.teacherSalaryMode === 'percent' && (selectedGroup.teacherSalaryPercent || 0) > 0)
        ? (selectedGroup.teacherSalaryPercent || 50)
        : 50
      groupSalaryPool = totalTuition * (pctVal / 100)
    }

    return Math.round(groupSalaryPool / scheduledLessons)
  }, [selectedGroup, lessonDates])

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter === 'active' && !a.isActive) return false
      if (statusFilter === 'cancelled' && a.isActive) return false
      if (groupIdFilter && a.groupId !== groupIdFilter) return false
      if (
        teacherIdFilter &&
        a.substituteTeacherId !== teacherIdFilter &&
        a.originalTeacherId !== teacherIdFilter
      )
        return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchGroup = (a.groupName || '').toLowerCase().includes(q)
        const matchOriginal = (a.originalTeacherName || '').toLowerCase().includes(q)
        const matchSubstitute = (a.substituteTeacherName || '').toLowerCase().includes(q)
        const matchReason = (a.reason || '').toLowerCase().includes(q)
        if (!matchGroup && !matchOriginal && !matchSubstitute && !matchReason) return false
      }
      return true
    })
  }, [assignments, statusFilter, groupIdFilter, teacherIdFilter, search])

  const pagination = usePagination(filteredAssignments, 15)

  const stats = useMemo(() => {
    const activeCount = assignments.filter((a) => a.isActive).length
    const totalCount = assignments.length
    const uniqueSubstituteCount = new Set(
      assignments.filter((a) => a.isActive).map((a) => a.substituteTeacherId)
    ).size
    return { activeCount, totalCount, uniqueSubstituteCount }
  }, [assignments])

  const handleOpenModal = async () => {
    if (teachers.length === 0 || classes.length === 0) {
      await loadData()
    }
    setFormGroupId('')
    setFormSubstituteTeacherId('')
    setFormMonth(new Date().toISOString().slice(0, 7))
    setLessonDates([])
    setSelectedDates([])
    setFormReason('')
    setErrorMsg('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formGroupId) {
      setErrorMsg('Guruhni tanlang')
      return
    }
    if (!formSubstituteTeacherId) {
      setErrorMsg("O'rinbosar o'qituvchini tanlang")
      return
    }
    if (selectedDates.length === 0) {
      setErrorMsg('Kamida bitta dars kunini tanlang')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      await createSubstituteAssignment({
        groupId: formGroupId,
        substituteTeacherId: formSubstituteTeacherId,
        dates: selectedDates,
        reason: formReason,
      })
      setIsModalOpen(false)
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Tayinlashda xatolik yuz berdi")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelAssignment = async () => {
    if (!cancelTargetId) return
    setCancelling(true)
    try {
      await cancelSubstituteAssignment(cancelTargetId)
      setCancelTargetId(null)
      await loadData()
    } catch (err) {
      console.error("Bekor qilishda xatolik:", err)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="O'qituvchilar"
        sub="Markaz o'qituvchilari va vaqtincha o'rinbosar biriktiruvlarini boshqarish"
        actions={
          <Button onClick={handleOpenModal}>
            <Plus className="mr-2 h-4 w-4" /> O'rinbosar biriktirish
          </Button>
        }
      />

      <CardTabs items={teacherTabs(canSeeReports)} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Faol o'rinbosarliklar"
          value={stats.activeCount}
          hint="Ayni vaqtda faol tayinlovlar"
          icon={UserCheck}
          iconBg="bg-brand-50"
          iconColor="text-brand-600"
        />
        <StatCard
          label="Barcha biriktiruvlar"
          value={stats.totalCount}
          hint="Jami tayinlovlar tarixi"
          icon={Calendar}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          label="O'rinbosar o'qituvchilar"
          value={stats.uniqueSubstituteCount}
          hint="Joriy almashtirilgan o'qituvchilar"
          icon={Users}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Guruh, o'qituvchi yoki sabab bo'yicha qidiruv..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(control, 'w-full pl-9')}
            />
          </div>

          <select
            value={groupIdFilter}
            onChange={(e) => setGroupIdFilter(e.target.value)}
            className={control}
          >
            <option value="">Barcha guruhlar</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={teacherIdFilter}
            onChange={(e) => setTeacherIdFilter(e.target.value)}
            className={control}
          >
            <option value="">Barcha o'qituvchilar</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={control}
          >
            <option value="active">Faol biriktiruvlar</option>
            <option value="cancelled">Bekor qilinganlar</option>
            <option value="all">Hammasi</option>
          </select>
        </div>
      </Card>

      {/* Assignments Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <UserX className="mx-auto h-12 w-12 text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">O'rinbosarlik tayinlovlari topilmadi</p>
            <p className="text-sm text-slate-500 mt-1">
              {search || groupIdFilter || teacherIdFilter
                ? "Filtr bo'yicha natija chiqamadi"
                : "Hali birorta ham o'rinbosar o'qituvchi biriktirilmagan"}
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Guruh</th>
                    <th className="px-4 py-3">Asosiy o'qituvchi</th>
                    <th className="px-4 py-3">O'rinbosar o'qituvchi</th>
                    <th className="px-4 py-3">Sana</th>
                    <th className="px-4 py-3 text-center">Darslar</th>
                    <th className="px-4 py-3">Hisoblangan haq</th>
                    <th className="px-4 py-3">Sababi</th>
                    <th className="px-4 py-3">Biriktirgan admin</th>
                    <th className="px-4 py-3">Holati</th>
                    <th className="px-4 py-3 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagination.paged.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <Link to={`/admin/classes/${item.groupId}`} className="hover:text-brand-600 hover:underline">
                          {item.groupName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/teachers/${item.originalTeacherId}`} className="font-medium text-slate-700 hover:text-brand-600 hover:underline">
                          {item.originalTeacherName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/teachers/${item.substituteTeacherId}`} className="flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
                          <ArrowRight className="h-3.5 w-3.5 text-brand-500" />
                          <span>{item.substituteTeacherName}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs max-w-[180px] truncate" title={item.dates?.join(', ') || item.date}>
                        {item.dates && item.dates.length > 0 ? (
                          <span>{item.dates.join(', ')}</span>
                        ) : item.endDate ? (
                          <span>
                            {item.date} ~ {item.endDate}
                          </span>
                        ) : (
                          <span>{item.date}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {item.lessonCount || 1} ta dars
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">
                        {item.estimatedSalary
                          ? `${item.estimatedSalary.toLocaleString()} so'm`
                          : "0 so'm"}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={item.reason}>
                        {item.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {item.createdBy}
                      </td>
                      <td className="px-4 py-3">
                        {item.isActive ? (
                          <Badge tone="green">
                            <CheckCircle2 className="h-3 w-3" /> Faol
                          </Badge>
                        ) : (
                          <Badge tone="default">
                            <XCircle className="h-3 w-3 text-slate-400" /> Bekor qilingan
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.isActive && (
                          <Button
                            variant="secondary"
                            onClick={() => setCancelTargetId(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs px-2.5 py-1"
                          >
                            Bekor qilish
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100">
              <TablePagination {...pagination} />
            </div>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="O'rinbosar o'qituvchi biriktirish"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Guruhni tanlang <span className="text-red-500">*</span>
            </label>
            <select
              value={formGroupId}
              onChange={(e) => setFormGroupId(e.target.value)}
              className={cn(control, 'w-full')}
              required
            >
              <option value="">-- Guruhni tanlang --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.grade ? `${c.grade}-sinf` : 'Sinf belgilanmagan'})
                </option>
              ))}
            </select>
          </div>

          {selectedGroup && (
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <span className="text-xs text-slate-500 block">Asosiy (doimiy) o'qituvchisi:</span>
              <span className="text-sm font-semibold text-slate-800">
                {originalTeacher ? originalTeacher.fullName : "Noma'lum o'qituvchi"}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              O'rinbosar (vaqtincha) o'qituvchini tanlang <span className="text-red-500">*</span>
            </label>
            <select
              value={formSubstituteTeacherId}
              onChange={(e) => setFormSubstituteTeacherId(e.target.value)}
              className={cn(control, 'w-full')}
              required
            >
              <option value="">-- O'rinbosar o'qituvchini tanlang --</option>
              {teachers
                .filter((t) => !selectedGroup || !selectedGroup.teacherId || t.id !== selectedGroup.teacherId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.phone || 'Tel ko\'rsatilmagan'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Oyni tanlang <span className="text-red-500">*</span>
            </label>
            <Input
              type="month"
              value={formMonth}
              onChange={(e) => setFormMonth(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                O'rinbosar dars o'tadigan sanalar <span className="text-red-500">*</span>
              </label>
              {lessonDates.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllDates}
                    className="text-brand-600 hover:underline font-medium"
                  >
                    Barchasini tanlash
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllDates}
                    className="text-slate-500 hover:underline font-medium"
                  >
                    Bekor qilish
                  </button>
                </div>
              )}
            </div>

            {loadingLessonDates ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                Dars sanalari yuklanmoqda...
              </div>
            ) : !formGroupId ? (
              <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Dars sanalarini ko'rish uchun avval guruhni tanlang
              </div>
            ) : lessonDates.length === 0 ? (
              <div className="p-3 text-center text-xs text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
                Ushbu oyda guruh uchun rejalashtirilgan dars kunlari topilmadi
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50 max-h-40 overflow-y-auto">
                {lessonDates.map((d) => {
                  const isSelected = selectedDates.includes(d.date)
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => toggleDate(d.date)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all border',
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                      )}
                    >
                      {d.dayName}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedGroup && selectedDates.length > 0 && (
            <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-700">
                <span>1 ta dars narxi:</span>
                <span className="font-semibold">{singleLessonRate.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tanlangan darslar soni:</span>
                <span className="font-semibold text-emerald-700">{selectedDates.length} ta dars</span>
              </div>
              <div className="flex justify-between border-t border-emerald-200 pt-1 text-emerald-800 font-semibold">
                <span>O'rinbosar o'qituvchiga to'lanadi:</span>
                <span>{(selectedDates.length * singleLessonRate).toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Asosiy o'qituvchidan ushlanadi:</span>
                <span className="text-red-600">-{(selectedDates.length * singleLessonRate).toLocaleString()} so'm</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Almashtirish sababi
            </label>
            <Textarea
              placeholder="Masalan: Asosiy o'qituvchi betobligi yoki xizmat safari munosabati bilan..."
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saqlanmoqda...' : 'Biriktirish'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={!!cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        title="Biriktiruvni bekor qilish"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ushbu o'rinbosar o'qituvchi biriktiruvini bekor qilmoqchimisiz? Bekor qilingandan so'ng
            o'rinbosar o'qituvchi ushbu guruh dars jurnali va darslariga kira olmaydi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setCancelTargetId(null)}
              disabled={cancelling}
            >
              Orqaga
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelAssignment}
              disabled={cancelling}
            >
              {cancelling ? 'Bekor qilinmoqda...' : 'Ha, bekor qilinsin'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
