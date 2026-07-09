import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus, MessageSquare } from 'lucide-react'
import type { Lead, Stage } from '@/types'
import { getLeads, createLead, updateLead, updateLeadStage, deleteLead } from '@/api/services/leads'
import {
  getStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  type StagePayload,
} from '@/api/services/stages'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { CallPickerModal, type CallOption } from '@/components/CallPickerModal'
import { LeadColumn } from './LeadColumn'
import { LeadCardContent } from './LeadCard'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'
import { LeadFormModal, type LeadFormValues } from './LeadFormModal'
import { LeadDetailModal } from './LeadDetailModal'
import { LeadBulkSmsModal } from './LeadBulkSmsModal'
import { StageFormModal } from './StageFormModal'

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  // modallar
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [leadFormOpen, setLeadFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [stageFormOpen, setStageFormOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  // Lid raqamiga qo'ng'iroq qilish oynasi
  const [callLead, setCallLead] = useState<Lead | null>(null)
  // Lidlarga ommaviy SMS oynasi
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false)
  // Sana bo'yicha filtr (kiritilgan sana): bitta kun (dan=gacha) yoki oraliq
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    Promise.all([getLeads(), getStages()])
      .then(([l, s]) => {
        setLeads(l)
        setStages(s)
      })
      .finally(() => setLoading(false))
  }, [])

  /* ---------- Karta drag-and-drop ---------- */
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const leadId = String(active.id)
    const newStage = String(over.id)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)))
    updateLeadStage(leadId, newStage).catch(() => {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l)))
    })
  }

  /* ---------- Lid CRUD ---------- */
  const handleLeadSubmit = (values: LeadFormValues) => {
    if (editingLead) {
      const id = editingLead.id
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...values } : l)))
      updateLead(id, values)
    } else {
      const stageId = stages[0]?.id ?? 'new'
      createLead(values, stageId).then((lead) => setLeads((prev) => [lead, ...prev]))
    }
    setLeadFormOpen(false)
    setEditingLead(null)
  }

  const handleLeadEdit = (lead: Lead) => {
    setDetailLead(null)
    setEditingLead(lead)
    setLeadFormOpen(true)
  }

  const handleLeadDelete = (lead: Lead) => setDeletingLead(lead)

  const doDeleteLead = (reasonId: string | undefined) => {
    const lead = deletingLead
    if (!lead) return
    deleteLead(lead.id, reasonId).then(() => {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
      setDetailLead(null)
      setDeletingLead(null)
    })
  }

  /* ---------- Ustun CRUD ---------- */
  const handleStageSubmit = (values: StagePayload) => {
    if (editingStage) {
      const id = editingStage.id
      setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...values } : s)))
      updateStage(id, values)
    } else {
      createStage(values).then((stage) => setStages((prev) => [...prev, stage]))
    }
    setStageFormOpen(false)
    setEditingStage(null)
  }

  const handleStageDelete = (stage: Stage) => {
    const count = leads.filter((l) => l.stage === stage.id).length
    if (count > 0) {
      alert("Bu ustunda lidlar bor. Avval ularni boshqa ustunga ko'chiring.")
      return
    }
    if (stages.length <= 1) {
      alert('Kamida bitta ustun bo\'lishi kerak.')
      return
    }
    if (!confirm(`"${stage.title}" ustunini o'chirasizmi?`)) return
    deleteStage(stage.id).then(() => setStages((prev) => prev.filter((s) => s.id !== stage.id)))
  }

  const handleStageMove = (id: string, dir: -1 | 1) => {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      const j = idx + dir
      if (idx < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      reorderStages(next.map((s) => s.id))
      return next
    })
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null
  const convertedCount = leads.filter((l) => l.convertedStudentId).length
  // Sana filtri: lid kiritilgan sana (createdAt) tanlangan oraliqqa kirsa ko'rinadi.
  const dateActive = !!(dateFrom || dateTo)
  const inDateRange = (l: Lead) => {
    if (!dateActive) return true
    const d = (l.createdAt || '').slice(0, 10)
    if (!d) return false
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  }
  const visibleLeads = leads.filter(inDateRange)
  // Xavfsizlik tarmog'i: bosqichi mavjud ustunlardan biriga MOS KELMAYDIGAN lid (eski bo'sh "" yoki
  // o'chirilgan ustun — masalan daraja testidan bosqich yo'q paytda tushgan) ko'rinmay qolmasin —
  // birinchi ustunda ko'rsatamiz (sudrab to'g'ri ustunga o'tkazish mumkin).
  const stageIds = new Set(stages.map((s) => s.id))

  return (
    <div>
      <PageHeader
        title="Lidlar"
        sub={
          <>
            {leads.length} ta lid · {convertedCount} aylantirilgan — kartani sudrang yoki ustiga bosing
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setBulkSmsOpen(true)}>
              <MessageSquare className="h-4 w-4" /> SMS yuborish
            </Button>
            <Button
              onClick={() => {
                setEditingLead(null)
                setLeadFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Yangi lid
            </Button>
          </div>
        }
      />

      {/* Sana bo'yicha filtr — bitta kun (Bugun) yoki "dan ... gacha" oraliq */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">Kiritilgan sana:</span>
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
        />
        <span className="text-slate-400">—</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
        />
        <button
          type="button"
          onClick={() => {
            const t = new Date().toISOString().slice(0, 10)
            setDateFrom(t)
            setDateTo(t)
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Bugun
        </button>
        {dateActive && (
          <>
            <button
              type="button"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            >
              Tozalash
            </button>
            <span className="text-sm text-slate-400">{visibleLeads.length} ta topildi</span>
          </>
        )}
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex items-start gap-3.5 overflow-x-auto pb-2">
            {stages.map((stage, i) => (
              <LeadColumn
                key={stage.id}
                stage={stage}
                leads={visibleLeads
                  .filter((l) => l.stage === stage.id || (i === 0 && !stageIds.has(l.stage)))
                  // Yangi kelgan (eng so'nggi kiritilgan) lid tepada.
                  .sort((a, b) => {
                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
                    return tb - ta
                  })}
                isFirst={i === 0}
                isLast={i === stages.length - 1}
                onCardClick={setDetailLead}
                onEdit={(s) => {
                  setEditingStage(s)
                  setStageFormOpen(true)
                }}
                onDelete={handleStageDelete}
                onMove={handleStageMove}
                onCall={setCallLead}
              />
            ))}

            <button
              onClick={() => {
                setEditingStage(null)
                setStageFormOpen(true)
              }}
              className="flex min-h-[200px] w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-400 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
            >
              <Plus className="h-5 w-5" /> Ustun qo'shish
            </button>
          </div>

          <DragOverlay>
            {activeLead ? <LeadCardContent lead={activeLead} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modallar */}
      <LeadDetailModal
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onEdit={handleLeadEdit}
        onDelete={handleLeadDelete}
        onConverted={(leadId, studentId) => {
          setLeads((prev) =>
            prev.map((l) => (l.id === leadId ? { ...l, convertedStudentId: studentId } : l)),
          )
          setDetailLead((prev) =>
            prev && prev.id === leadId ? { ...prev, convertedStudentId: studentId } : prev,
          )
        }}
      />

      <ReasonPromptModal
        open={!!deletingLead}
        category="lead_delete"
        title="Lidni o'chirish"
        message={deletingLead ? `"${deletingLead.fullName}" lidini o'chirasizmi?` : undefined}
        confirmLabel="O'chirish"
        tone="red"
        onConfirm={doDeleteLead}
        onClose={() => setDeletingLead(null)}
      />
      <LeadFormModal
        open={leadFormOpen}
        onClose={() => {
          setLeadFormOpen(false)
          setEditingLead(null)
        }}
        onSubmit={handleLeadSubmit}
        initial={editingLead}
      />
      <StageFormModal
        open={stageFormOpen}
        onClose={() => {
          setStageFormOpen(false)
          setEditingStage(null)
        }}
        onSubmit={handleStageSubmit}
        initial={editingStage}
      />
      <LeadBulkSmsModal
        open={bulkSmsOpen}
        onClose={() => setBulkSmsOpen(false)}
        leads={leads.filter((l) => !l.convertedStudentId)}
        stages={stages}
      />
      <CallPickerModal
        open={!!callLead}
        onClose={() => setCallLead(null)}
        title={callLead?.fullName}
        numbers={
          callLead
            ? (
                [
                  { label: "O'z raqami", number: callLead.phone },
                  { label: 'Otasi', number: callLead.fatherPhone },
                  { label: 'Onasi', number: callLead.motherPhone },
                ].filter((n) => n.number) as CallOption[]
              )
            : []
        }
      />
    </div>
  )
}
