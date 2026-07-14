import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Pencil, Trash2, ClipboardList, ChevronRight, AlertTriangle, Loader2,
} from 'lucide-react'
import type { GroupTest, TestGroupOverview } from '@/types'
import {
  getGroupTests, getTestGroups, createTest, updateTest, deleteTest,
} from '@/api/services/testResults'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiErrorMessage, formatDate } from '@/lib/utils'
import { usePerm } from '@/lib/permissions'

const control =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Bitta guruhning testlar ro'yxati + yangi test yaratish/tahrirlash/o'chirish. */
export function TestGroupPage() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const { can } = usePerm()
  const [tests, setTests] = useState<GroupTest[]>([])
  const [group, setGroup] = useState<TestGroupOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GroupTest | null>(null)
  const [deleting, setDeleting] = useState<GroupTest | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = () =>
    Promise.all([getGroupTests(groupId), getTestGroups()])
      .then(([t, groups]) => {
        setTests(t)
        setGroup(groups.find((g) => g.groupId === groupId) ?? null)
      })
      .catch((e) => setError(apiErrorMessage(e, 'Yuklab bo\'lmadi')))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: GroupTest) => {
    setEditing(t)
    setFormOpen(true)
  }

  const handleSaved = (t: GroupTest) => {
    setTests((prev) => {
      const exists = prev.some((x) => x.id === t.id)
      const next = exists ? prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)) : [t, ...prev]
      return next.sort((a, b) => b.date.localeCompare(a.date))
    })
    setGroup((g) => (g ? { ...g, testCount: g.testCount + (tests.some((x) => x.id === t.id) ? 0 : 1) } : g))
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteTest(deleting.id)
      setTests((prev) => prev.filter((x) => x.id !== deleting.id))
      setGroup((g) => (g ? { ...g, testCount: Math.max(0, g.testCount - 1) } : g))
      setDeleting(null)
    } catch (e) {
      setError(apiErrorMessage(e, 'O\'chirib bo\'lmadi'))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/admin/test-results')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Barcha guruhlar
      </button>

      <PageHeader
        title={group?.name || 'Guruh testlari'}
        sub={
          group
            ? [group.courseName, group.teacherName, `${group.studentCount} o'quvchi`]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          can('classes', 'create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Yangi test
            </Button>
          )
        }
      />

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <>
          {error && <Card className="mb-3 py-3 text-center text-sm text-red-500">{error}</Card>}
          {tests.length === 0 ? (
            <Card className="py-12 text-center text-slate-400">
              Hali test yaratilmagan. "Yangi test" tugmasini bosing.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {tests.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-brand-300"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/test-results/${groupId}/tests/${t.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(t.date)} · Maks: {t.maxScore} ball
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span>
                          Baholangan:{' '}
                          <span className="font-medium text-slate-700">
                            {t.scoredCount}/{t.studentCount}
                          </span>
                        </span>
                        {t.avgScore != null && (
                          <span>
                            O'rtacha: <span className="font-medium text-slate-700">{t.avgScore}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {can('classes', 'edit') && (
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        title="Tahrirlash"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {can('classes', 'delete') && (
                      <button
                        type="button"
                        onClick={() => setDeleting(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="O'chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {formOpen && (
        <TestFormModal
          groupId={groupId}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(t) => {
            handleSaved(t)
            setFormOpen(false)
          }}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Testni o'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Bekor
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "O'chirish"}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-slate-600">
            <b>{deleting?.name}</b> testi va unga kiritilgan barcha ballar o'chiriladi. Bu amalni
            qaytarib bo'lmaydi.
          </p>
        </div>
      </Modal>
    </div>
  )
}

/** Test yaratish/tahrirlash modali. */
function TestFormModal({
  groupId,
  editing,
  onClose,
  onSaved,
}: {
  groupId: string
  editing: GroupTest | null
  onClose: () => void
  onSaved: (t: GroupTest) => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [date, setDate] = useState(editing?.date ?? todayIso())
  const [maxScore, setMaxScore] = useState<string>(editing ? String(editing.maxScore) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const max = useMemo(() => Number(maxScore), [maxScore])
  const valid = name.trim().length > 0 && date && Number.isFinite(max) && max > 0

  const submit = async () => {
    if (!valid) {
      setErr('Nom, sana va 0 dan katta maksimal ball kiriting')
      return
    }
    setBusy(true)
    setErr('')
    try {
      if (editing) {
        await updateTest(editing.id, { name: name.trim(), date, maxScore: max })
        onSaved({ ...editing, name: name.trim(), date, maxScore: max })
      } else {
        const created = await createTest({ groupId, name: name.trim(), date, maxScore: max })
        onSaved(created)
      }
    } catch (e) {
      setErr(apiErrorMessage(e, 'Saqlab bo\'lmadi'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Testni tahrirlash' : 'Yangi test'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Test nomi</label>
          <input
            className={control}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Unit 3 test"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Sana</label>
            <input type="date" className={control} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Maksimal ball</label>
            <input
              type="number"
              min={1}
              className={control}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              placeholder="100"
            />
          </div>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
      </div>
    </Modal>
  )
}
