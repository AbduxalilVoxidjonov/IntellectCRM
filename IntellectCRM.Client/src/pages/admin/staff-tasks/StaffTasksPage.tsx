import { useEffect, useState } from 'react'
import { ClipboardCheck, Plus, Pencil, Trash2, Send } from 'lucide-react'
import {
  getStaffTaskTargets,
  getStaffTasks,
  createStaffTask,
  updateStaffTask,
  deleteStaffTask,
  getStaffTaskHistory,
  getStaffTaskSettings,
  setStaffTaskSettings,
  type StaffTaskTarget,
  type StaffTask,
  type StaffTaskHistoryRow,
} from '@/api/services/staffTasks'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Input, Time24Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn, apiErrorMessage } from '@/lib/utils'

type Tab = 'manage' | 'history'

export function StaffTasksPage() {
  const [tab, setTab] = useState<Tab>('manage')

  return (
    <div>
      <PageHeader
        title="Adminga topshiriq"
        sub="Xodimlarga kunlik checklist tayinlang — belgilangan vaqtda Telegram bot orqali yuboriladi"
      />

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        {(
          [
            { key: 'manage', label: 'Topshiriqlar' },
            { key: 'history', label: 'Topshiriqlar tarixi' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-400 hover:text-slate-600',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'manage' ? <ManageTab /> : <HistoryTab />}
    </div>
  )
}

function ManageTab() {
  const [targets, setTargets] = useState<StaffTaskTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Sozlamalar
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('08:00')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Yangi topshiriq
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  // Tahrirlash modali
  const [editing, setEditing] = useState<StaffTask | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadTargets = () => getStaffTaskTargets().then(setTargets)

  useEffect(() => {
    Promise.all([loadTargets(), getStaffTaskSettings()])
      .then(([, s]) => {
        setEnabled(s.enabled)
        setTime(`${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`)
      })
      .catch((err) => alert(apiErrorMessage(err, "Ma'lumotlarni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [])

  const selected = targets.find((t) => t.userId === selectedId) || null

  const loadTasks = (userId: string) => {
    setTasksLoading(true)
    getStaffTasks(userId)
      .then(setTasks)
      .catch((err) => alert(apiErrorMessage(err, "Topshiriqlarni yuklab bo'lmadi")))
      .finally(() => setTasksLoading(false))
  }

  const selectStaff = (userId: string) => {
    setSelectedId(userId)
    setNewTitle('')
    loadTasks(userId)
  }

  const handleSaveSettings = async () => {
    if (settingsSaving) return
    const [h, m] = time.split(':')
    setSettingsSaving(true)
    setSettingsSaved(false)
    try {
      await setStaffTaskSettings({ enabled, hour: Number(h) || 0, minute: Number(m) || 0 })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 1600)
    } catch (err) {
      alert(apiErrorMessage(err, "Sozlamani saqlab bo'lmadi"))
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedId || !newTitle.trim() || adding) return
    setAdding(true)
    try {
      await createStaffTask(selectedId, newTitle.trim())
      setNewTitle('')
      loadTasks(selectedId)
      loadTargets()
    } catch (err) {
      alert(apiErrorMessage(err, "Qo'shib bo'lmadi"))
    } finally {
      setAdding(false)
    }
  }

  const openEdit = (t: StaffTask) => {
    setEditing(t)
    setEditTitle(t.title)
  }

  const handleEditSave = async () => {
    if (!editing || !editTitle.trim() || editSaving) return
    setEditSaving(true)
    try {
      await updateStaffTask(editing.id, editTitle.trim())
      setEditing(null)
      if (selectedId) loadTasks(selectedId)
    } catch (err) {
      alert(apiErrorMessage(err, "Saqlab bo'lmadi"))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (t: StaffTask) => {
    if (!confirm("Topshiriqni o'chirasizmi?")) return
    try {
      await deleteStaffTask(t.id)
      if (selectedId) loadTasks(selectedId)
      loadTargets()
    } catch (err) {
      alert(apiErrorMessage(err, "O'chirib bo'lmadi"))
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div className="space-y-4">
      <Card
        title="Har kuni ertalab jo'natish"
        sub="Belgilangan vaqtda har topshiriqli xodimga Telegram bot orqali checklist yuboriladi"
        actions={
          <Button onClick={handleSaveSettings} disabled={settingsSaving}>
            <Send className="h-4 w-4" /> {settingsSaved ? 'Saqlandi' : 'Saqlash'}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
            />
            <span className="text-sm font-medium text-slate-700">Yoqilgan</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Vaqt:</span>
            <Time24Input value={time} onChange={setTime} disabled={!enabled} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Xodimlar" tight>
          {targets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="px-4 text-sm text-slate-500">Xodimlar topilmadi.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {targets.map((t) => (
                <button
                  key={t.userId}
                  type="button"
                  onClick={() => selectStaff(t.userId)}
                  className={cn(
                    'flex w-full items-center gap-3 px-[18px] py-3 text-left transition-colors hover:bg-slate-50',
                    selectedId === t.userId && 'bg-brand-50 hover:bg-brand-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.fullName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {t.position || t.role}
                      {t.hasTelegram ? (
                        <span className="ml-2 text-emerald-600">🔗 Telegram</span>
                      ) : (
                        <span className="ml-2 text-slate-400">Telegram ulanmagan</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {t.taskCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title={selected ? `«${selected.fullName}» topshiriqlari` : 'Topshiriqlar'}>
          {!selected ? (
            <p className="py-10 text-center text-sm text-slate-400">Chapdan xodim tanlang</p>
          ) : (
            <div className="space-y-4">
              {!selected.hasTelegram && (
                <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  Bu xodim hali Telegram botdan ro'yxatdan o'tmagan — unga checklist yuborilmaydi.
                  Xodim botga o'z raqamini yuborishi kerak.
                </p>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Yangi topshiriq matni"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                  }}
                />
                <Button onClick={handleAdd} disabled={!newTitle.trim() || adding} className="shrink-0">
                  <Plus className="h-4 w-4" /> Qo'shish
                </Button>
              </div>

              {tasksLoading ? (
                <Loader label="Yuklanmoqda..." />
              ) : tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Hali topshiriq yo'q.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                      <p className="min-w-0 flex-1 text-sm font-medium text-slate-700">{t.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Tahrirlash"
                          onClick={() => openEdit(t)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="O'chirish"
                          onClick={() => handleDelete(t)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Topshiriqni tahrirlash"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Bekor
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editTitle.trim()}>
              Saqlash
            </Button>
          </>
        }
      >
        <Input
          label="Topshiriq matni"
          required
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          autoFocus
        />
      </Modal>
    </div>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function HistoryTab() {
  const [date, setDate] = useState(todayIso())
  const [rows, setRows] = useState<StaffTaskHistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getStaffTaskHistory(date)
      .then(setRows)
      .catch((err) => alert(apiErrorMessage(err, "Tarixni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [date])

  return (
    <Card
      title="Topshiriqlar tarixi"
      actions={
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      }
    >
      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Bu kunda checklist yuborilmagan yoki topshiriq yo'q.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const color =
              r.total === 0
                ? 'text-slate-400 bg-slate-100'
                : r.done === r.total
                  ? 'text-emerald-700 bg-emerald-50'
                  : r.done === 0
                    ? 'text-red-700 bg-red-50'
                    : 'text-amber-700 bg-amber-50'
            return (
              <div key={r.userId} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{r.fullName}</p>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', color)}>
                    {r.done}/{r.total}
                  </span>
                </div>
                {r.items.length > 0 && (
                  <ul className="space-y-1">
                    {r.items.map((it, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <span>{it.done ? '✅' : '☐'}</span>
                        <span className={cn('flex-1', it.done ? 'text-slate-600' : 'text-slate-500')}>
                          {it.title}
                        </span>
                        {it.done && it.doneAt && (
                          <span className="text-xs text-slate-400">
                            {(/T(\d{2}:\d{2})/.exec(it.doneAt) || [])[1] || ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
