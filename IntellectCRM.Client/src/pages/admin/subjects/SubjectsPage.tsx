import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, BookOpen, ListChecks } from 'lucide-react'
import type { Subject } from '@/types'
import type { SubjectPayload } from '@/api/services/subjects'
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/api/services/subjects'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn, formatMoney } from '@/lib/utils'
import { SubjectFormModal } from './SubjectFormModal'

export function SubjectsPage() {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  // Narx o'zgarganda — yangi narxni bog'langan guruh o'quvchilariga qachondan qo'llashni so'rash uchun
  const [feePrompt, setFeePrompt] = useState<{
    id: string
    values: SubjectPayload
    oldPrice: number
  } | null>(null)

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .finally(() => setLoading(false))
  }, [])

  const applyUpdate = (id: string, values: SubjectPayload, applyFee?: boolean) =>
    updateSubject(id, values, applyFee).then((u) =>
      setSubjects((prev) => prev.map((s) => (s.id === u.id ? u : s))),
    )

  const handleSubmit = (values: SubjectPayload) => {
    if (editing) {
      // Narx o'zgargan bo'lsa — bog'langan guruhlar o'quvchilariga qo'llashni so'raymiz (Ha/Yo'q)
      if (values.price !== editing.price) {
        setFeePrompt({ id: editing.id, values, oldPrice: editing.price })
        setFormOpen(false)
        setEditing(null)
        return
      }
      applyUpdate(editing.id, values)
    } else {
      createSubject(values).then((c) => setSubjects((prev) => [...prev, c]))
    }
    setFormOpen(false)
    setEditing(null)
  }

  const resolveFeePrompt = (applyFee: boolean) => {
    if (!feePrompt) return
    applyUpdate(feePrompt.id, feePrompt.values, applyFee)
    setFeePrompt(null)
  }

  const handleDelete = (s: Subject) => {
    if (!confirm(`"${s.name}" kursini o'chirasizmi?`)) return
    deleteSubject(s.id).then(() => setSubjects((prev) => prev.filter((x) => x.id !== s.id)))
  }

  return (
    <div>
      <PageHeader
        title="Kurslar"
        sub={`Jami ${subjects.length} ta kurs`}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Yangi kurs
          </Button>
        }
      />

      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : subjects.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <BookOpen className="h-5 w-5" />
            </div>
            <h4>Kurslar yo'q</h4>
            <p>"Yangi kurs" tugmasi orqali birinchi kursni qo'shing.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-1)] transition-shadow hover:shadow-[var(--shadow-pop)]"
            >
              {/* Kurs nomi (bosilsa o'quv dasturi) */}
              <Link to={`/admin/subjects/${s.id}/curriculum`} className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                  <BookOpen className="h-[22px] w-[22px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold tracking-tight text-slate-800 transition-colors group-hover:text-brand-600">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    <span className="font-mono font-medium text-slate-700">{formatMoney(s.price)}</span>{' '}
                    so'm / oy
                  </p>
                </div>
              </Link>

              {/* Amallar */}
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/subjects/${s.id}/curriculum`)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                >
                  <ListChecks className="h-4 w-4" /> O'quv dasturi
                </button>
                <IconBtn
                  icon={Pencil}
                  title="Tahrirlash"
                  onClick={() => {
                    setEditing(s)
                    setFormOpen(true)
                  }}
                />
                <IconBtn icon={Trash2} title="O'chirish" danger onClick={() => handleDelete(s)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <SubjectFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <Modal
        open={!!feePrompt}
        onClose={() => setFeePrompt(null)}
        title="Kurs narxini o'quvchilarga qo'llash"
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
              <span className="font-medium text-slate-800">{feePrompt.values.name}</span> kursining
              oylik narxi{' '}
              <span className="font-medium">{formatMoney(feePrompt.oldPrice)}</span> →{' '}
              <span className="font-medium">{formatMoney(feePrompt.values.price)}</span> so'mga
              o'zgardi. Yangi narx shu kursga bog'langan guruhlardagi o'quvchilarga qachondan
              qo'llansin?
            </p>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500">
              <p>
                <b className="text-slate-700">Ha</b> — joriy oy to'lovi yangi narxga o'zgaradi
                (balans farqqa moslab to'g'rilanadi; qo'lda tahrirlangan oyliklar tegilmaydi).
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
