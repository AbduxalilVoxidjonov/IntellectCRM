import { useEffect, useState } from 'react'
import { ArrowLeft, Bot, ClipboardList, Plus, Pencil, Trash2, GraduationCap } from 'lucide-react'
import type { GroupTest, TeacherClass, TestResultDetail } from '@/types'
import {
  getMyClasses,
  getTeacherGroupTests,
  getTeacherTestDetail,
  createTeacherTest,
  updateTeacherTest,
  deleteTeacherTest,
  setTeacherTestScore,
} from '@/api/services/teacher'
import { cn, formatDate, apiErrorMessage } from '@/lib/utils'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const todayIso = () => new Date().toISOString().slice(0, 10)

interface TestForm {
  name: string
  date: string
  maxScore: string
}

const emptyForm: TestForm = { name: '', date: todayIso(), maxScore: '100' }

/** O'qituvchi — Test natijalari. Ichki drill-down: guruhlar → testlar → test tafsiloti (marshrutsiz). */
export function TeacherTestsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classesLoading, setClassesLoading] = useState(true)

  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null)
  const [tests, setTests] = useState<GroupTest[]>([])
  const [testsLoading, setTestsLoading] = useState(false)
  const [testsError, setTestsError] = useState<string | null>(null)

  const [detail, setDetail] = useState<TestResultDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTest, setEditingTest] = useState<GroupTest | null>(null)
  const [form, setForm] = useState<TestForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<GroupTest | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    getMyClasses()
      .then(setClasses)
      .catch(() => {})
      .finally(() => setClassesLoading(false))
  }, [])

  const loadTests = (classId: string) => {
    setTestsLoading(true)
    setTestsError(null)
    getTeacherGroupTests(classId)
      .then(setTests)
      .catch((err) => setTestsError(apiErrorMessage(err, "Testlarni yuklab bo'lmadi")))
      .finally(() => setTestsLoading(false))
  }

  const openClass = (c: TeacherClass) => {
    setSelectedClass(c)
    setTests([])
    loadTests(c.classId)
  }

  const backToClasses = () => {
    setSelectedClass(null)
    setTests([])
    setTestsError(null)
  }

  const openDetail = (t: GroupTest) => {
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    getTeacherTestDetail(t.id)
      .then((d) => {
        setDetail(d)
        setScoreDrafts(
          Object.fromEntries(d.rows.map((r) => [r.studentId, r.score == null ? '' : String(r.score)])),
        )
      })
      .catch((err) => setDetailError(apiErrorMessage(err, "Test tafsilotini yuklab bo'lmadi")))
      .finally(() => setDetailLoading(false))
  }

  const backToTests = () => {
    setDetail(null)
    setDetailError(null)
    if (selectedClass) loadTests(selectedClass.classId)
  }

  const openCreate = () => {
    setEditingTest(null)
    setForm(emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (t: GroupTest) => {
    setEditingTest(t)
    setForm({ name: t.name, date: t.date.slice(0, 10), maxScore: String(t.maxScore) })
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditingTest(null)
  }

  const submitForm = async () => {
    if (!selectedClass) return
    const name = form.name.trim()
    const maxScore = Number(form.maxScore)
    if (!name) {
      setFormError('Test nomini kiriting')
      return
    }
    if (!form.date) {
      setFormError('Sanani tanlang')
      return
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setFormError("Maksimal ball 0 dan katta bo'lishi kerak")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editingTest) {
        await updateTeacherTest(editingTest.id, { name, date: form.date, maxScore })
      } else {
        await createTeacherTest({ groupId: selectedClass.classId, name, date: form.date, maxScore })
      }
      setFormOpen(false)
      setEditingTest(null)
      loadTests(selectedClass.classId)
    } catch (err) {
      setFormError(apiErrorMessage(err, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !selectedClass) return
    setDeleting(true)
    try {
      await deleteTeacherTest(deleteTarget.id)
      setDeleteTarget(null)
      loadTests(selectedClass.classId)
    } catch (err) {
      alert(apiErrorMessage(err, "O'chirib bo'lmadi"))
    } finally {
      setDeleting(false)
    }
  }

  const saveScore = async (studentId: string) => {
    if (!detail) return
    const raw = scoreDrafts[studentId] ?? ''
    const score = raw.trim() === '' ? null : Number(raw)
    if (score != null && (!Number.isFinite(score) || score < 0 || score > detail.maxScore)) {
      alert(`Ball 0 dan ${detail.maxScore} gacha bo'lishi kerak`)
      return
    }
    setSavingRow(studentId)
    try {
      const updated = await setTeacherTestScore(detail.id, studentId, score)
      setDetail(updated)
      setScoreDrafts(
        Object.fromEntries(updated.rows.map((r) => [r.studentId, r.score == null ? '' : String(r.score)])),
      )
    } catch (err) {
      alert(apiErrorMessage(err, "Ballni saqlab bo'lmadi"))
    } finally {
      setSavingRow(null)
    }
  }

  // ---------------- 3. Test tafsiloti ----------------
  if (detail || detailLoading || detailError) {
    return (
      <div className="px-4 pt-3 pb-6">
        <div className="mb-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={backToTests}
            className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-ink">{detail?.name ?? 'Test'}</p>
            {detail && (
              <p className="text-[12px] text-mute">
                {formatDate(detail.date)} · Maks: <span className="font-mono">{detail.maxScore}</span> ball
              </p>
            )}
          </div>
        </div>

        {detailLoading ? (
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : detailError ? (
          <div className="rounded-[20px] border border-line bg-white p-6 text-center text-[13px] font-semibold text-rose-600 shadow-[var(--shadow-card)]">
            {detailError}
          </div>
        ) : detail && detail.rows.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center text-[13px] text-faint shadow-[var(--shadow-card)]">
            Bu guruhda faol o'quvchi yo'q.
          </div>
        ) : (
          detail && (
            <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
              {detail.rows.map((r, i) => {
                const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null
                return (
                  <div
                    key={r.studentId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      i < detail.rows.length - 1 && 'border-b border-line',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[14px] font-bold text-mute">
                      {r.rank === 0 ? '' : medal ?? r.rank}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{r.fullName}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={detail.maxScore}
                        placeholder="—"
                        value={scoreDrafts[r.studentId] ?? ''}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({ ...prev, [r.studentId]: e.target.value }))
                        }
                        onBlur={() => saveScore(r.studentId)}
                        disabled={savingRow === r.studentId}
                        className="h-9 w-16 rounded-lg border border-line bg-panel2 text-center font-mono text-[14px] font-bold text-ink focus:border-teal-500 focus:outline-none disabled:opacity-50"
                      />
                      <span className="text-[12px] text-faint">/{detail.maxScore}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
        {savingRow && <p className="mt-2 text-center text-[12px] text-mute">Saqlanmoqda...</p>}
      </div>
    )
  }

  // ---------------- 2. Tanlangan guruh testlari ----------------
  if (selectedClass) {
    return (
      <div className="px-4 pt-3 pb-6">
        <div className="mb-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={backToClasses}
            className="tap-scale flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-mute shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-ink">{selectedClass.className}</p>
            <p className="text-[12px] text-mute">Test natijalari</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="tap-scale flex shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Yangi test
          </button>
        </div>

        {testsLoading ? (
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
            <Loader label="Yuklanmoqda..." />
          </div>
        ) : testsError ? (
          <div className="rounded-[20px] border border-line bg-white p-6 text-center text-[13px] font-semibold text-rose-600 shadow-[var(--shadow-card)]">
            {testsError}
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-tealsoft text-teal-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h4 className="text-[15px] font-bold text-ink">Hali test yo'q</h4>
            <p className="mt-1 text-[13px] text-mute">"Yangi test" tugmasi orqali yarating.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map((t) => (
              <div
                key={t.id}
                className="tap-scale rounded-[20px] border border-line bg-white p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail(t)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div
                      className={
                        t.online?.mode === 'online'
                          ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600'
                          : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tealsoft text-teal-600'
                      }
                    >
                      {t.online?.mode === 'online' ? <Bot className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink">
                        {t.name}
                        {t.online?.mode === 'online' && (
                          <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                            ONLAYN
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-mute">
                        {formatDate(t.date)}
                        {t.online?.mode === 'online' &&
                          ` · botdan yuborgan: ${t.submittedCount}/${t.studentCount}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel3 hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className="mt-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-panel2 px-3 py-2 text-left text-[12px] text-mute"
                >
                  <span>
                    <span className="font-mono font-bold text-ink">{t.scoredCount}</span>/
                    <span className="font-mono">{t.studentCount}</span> baholangan
                  </span>
                  {t.avgScore != null && (
                    <span>
                      O'rtacha: <span className="font-mono font-bold text-ink">{t.avgScore.toFixed(1)}</span>
                    </span>
                  )}
                  <span>
                    Maks: <span className="font-mono font-bold text-ink">{t.maxScore}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={formOpen}
          onClose={closeForm}
          size="sm"
          title={editingTest ? 'Testni tahrirlash' : 'Yangi test'}
          footer={
            <>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-mute disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={saving}
                className="rounded-lg bg-teal-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {formError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-600">
                {formError}
              </p>
            )}
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-mute">Nom</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Masalan: 1-chorak test"
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:border-teal-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-mute">Sana</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:border-teal-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-mute">Maksimal ball</span>
              <input
                type="number"
                min={1}
                value={form.maxScore}
                onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>
        </Modal>

        <Modal
          open={!!deleteTarget}
          onClose={() => !deleting && setDeleteTarget(null)}
          size="sm"
          title="Testni o'chirish"
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-mute disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </>
          }
        >
          <p className="text-[13px] text-mute">
            <span className="font-semibold text-ink">{deleteTarget?.name}</span> testini va uning barcha
            ballarini o'chirasizmi? Bu amalni qaytarib bo'lmaydi.
          </p>
        </Modal>
      </div>
    )
  }

  // ---------------- 1. Guruhlar ro'yxati ----------------
  return (
    <div className="px-4 pt-3 pb-6">
      <p className="mb-3 text-[17px] font-extrabold text-ink">Test natijalari</p>

      {classesLoading ? (
        <div className="rounded-[20px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
          <Loader label="Yuklanmoqda..." />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-white px-5 py-8 text-center text-[13px] text-faint shadow-[var(--shadow-card)]">
          Sizga biriktirilgan guruh yo'q.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--shadow-card)]">
          {classes.map((c, i) => (
            <button
              key={c.classId}
              type="button"
              onClick={() => openClass(c)}
              className={cn(
                'tap-scale flex w-full items-center gap-3 px-4 py-3.5 text-left',
                i < classes.length - 1 && 'border-b border-line',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-tealsoft text-[15px] font-extrabold text-teal-700">
                {initialsOf(c.className)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-ink">{c.className}</p>
                {c.subjects.length > 0 && (
                  <p className="truncate text-[11px] text-mute">
                    {c.subjects.map((s) => s.name).join(', ')}
                  </p>
                )}
              </div>
              <GraduationCap className="h-4 w-4 shrink-0 text-faint" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
