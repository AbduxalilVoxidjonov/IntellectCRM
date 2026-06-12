import { useEffect, useState } from 'react'
import {
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  CalendarClock,
  History,
  GraduationCap,
} from 'lucide-react'
import type { Lead, LeadEvent, LeadEventType, TrialLesson, Group } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { genderLabels } from '@/config/constants'
import { formatDate } from '@/lib/utils'
import {
  getLeadEvents,
  addLeadEvent,
  getLeadTrials,
  scheduleTrial,
  setTrialResult,
  convertLead,
} from '@/api/services/leads'
import { getClasses } from '@/api/services/classes'

interface Props {
  lead: Lead | null
  onClose: () => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  /** Lid aylantirilgandan keyin ro'yxatni yangilash uchun */
  onConverted?: (leadId: string, studentId: string) => void
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={`text-right text-sm font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

/** Ism-sharifdan bosh harflar (avatar uchun) */
function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const eventTypeLabels: Record<LeadEventType, string> = {
  note: 'Izoh',
  stage: 'Bosqich',
  call: "Qo'ng'iroq",
  trial: 'Sinov darsi',
  convert: 'Aylantirildi',
  created: 'Yaratildi',
}

const eventTypeColors: Record<LeadEventType, string> = {
  note: 'bg-slate-100 text-slate-600',
  stage: 'bg-blue-50 text-blue-600',
  call: 'bg-amber-50 text-amber-600',
  trial: 'bg-violet-50 text-violet-600',
  convert: 'bg-emerald-50 text-emerald-600',
  created: 'bg-slate-100 text-slate-500',
}

const trialResultLabels: Record<TrialLesson['result'], string> = {
  pending: 'Kutilmoqda',
  stayed: 'Qoldi',
  left: 'Ketdi',
}

const trialResultColors: Record<TrialLesson['result'], string> = {
  pending: 'bg-amber-50 text-amber-600',
  stayed: 'bg-emerald-50 text-emerald-600',
  left: 'bg-rose-50 text-rose-600',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = formatDate(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm}`
}

export function LeadDetailModal({ lead, onClose, onEdit, onDelete, onConverted }: Props) {
  const leadId = lead?.id ?? null

  const [events, setEvents] = useState<LeadEvent[]>([])
  const [trials, setTrials] = useState<TrialLesson[]>([])
  const [groups, setGroups] = useState<Group[]>([])

  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [trialGroupId, setTrialGroupId] = useState('')
  const [trialAt, setTrialAt] = useState('')
  const [savingTrial, setSavingTrial] = useState(false)

  const [convertGroupId, setConvertGroupId] = useState('')
  const [convertDate, setConvertDate] = useState('')
  const [converting, setConverting] = useState(false)
  // Modalni yopmasdan aylantirish holatini kuzatish uchun lokal nusxa
  const [convertedStudentId, setConvertedStudentId] = useState<string | null>(null)

  const refreshTimeline = (id: string) => {
    getLeadEvents(id).then(setEvents).catch(() => setEvents([]))
    getLeadTrials(id).then(setTrials).catch(() => setTrials([]))
  }

  useEffect(() => {
    if (!leadId) return
    setNoteText('')
    setTrialGroupId('')
    setTrialAt('')
    setConvertGroupId('')
    setConvertDate('')
    setConvertedStudentId(lead?.convertedStudentId ?? null)
    refreshTimeline(leadId)
    getClasses()
      .then((gs) => setGroups(gs.filter((g) => !g.isArchived)))
      .catch(() => setGroups([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const handleAddNote = async () => {
    if (!leadId || !noteText.trim()) return
    setSavingNote(true)
    try {
      await addLeadEvent(leadId, 'note' as LeadEventType, noteText.trim())
      setNoteText('')
      const fresh = await getLeadEvents(leadId)
      setEvents(fresh)
    } finally {
      setSavingNote(false)
    }
  }

  const handleScheduleTrial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadId || !trialGroupId || !trialAt) return
    setSavingTrial(true)
    try {
      await scheduleTrial(leadId, trialGroupId, trialAt)
      setTrialGroupId('')
      setTrialAt('')
      refreshTimeline(leadId)
    } finally {
      setSavingTrial(false)
    }
  }

  const handleTrialResult = async (trialId: string, result: 'stayed' | 'left') => {
    if (!leadId) return
    await setTrialResult(trialId, result)
    refreshTimeline(leadId)
  }

  const handleConvert = async () => {
    if (!leadId) return
    setConverting(true)
    try {
      const { studentId } = await convertLead(leadId, {
        enrollmentDate: convertDate || undefined,
        groupId: convertGroupId || undefined,
      })
      setConvertedStudentId(studentId)
      onConverted?.(leadId, studentId)
      if (leadId) refreshTimeline(leadId)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Aylantirishda xatolik yuz berdi'
      alert(message)
    } finally {
      setConverting(false)
    }
  }

  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      title="Lid ma'lumotlari"
      size="lg"
      footer={
        lead && (
          <>
            <Button variant="danger" onClick={() => onDelete(lead)} className="mr-auto">
              <Trash2 className="h-4 w-4" /> O'chirish
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => onEdit(lead)}>
              <Pencil className="h-4 w-4" /> Tahrirlash
            </Button>
          </>
        )
      }
    >
      {lead && (
        <div className="space-y-6">
          {/* Sarlavha — avatar + ism */}
          <div className="flex items-center gap-3">
            <span className="avatar h-12 w-12 bg-brand-500 text-base">
              {leadInitials(lead.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight text-slate-800">
                {lead.fullName}
              </p>
              <p className="text-sm text-slate-400">
                {genderLabels[lead.gender]}
                {lead.interestSubject ? ` · ${lead.interestSubject}` : ''}
              </p>
            </div>
          </div>

          {/* Asosiy ma'lumotlar */}
          <div>
            <Row label="Jinsi" value={genderLabels[lead.gender]} />
            <Row label="Tug'ilgan kun" value={formatDate(lead.birthDate)} mono />
            <Row label="O'z raqami" value={lead.phone || '—'} mono />
            <Row label="Otasi" value={lead.fatherFullName || '—'} />
            <Row label="Otasi raqami" value={lead.fatherPhone || '—'} mono />
            <Row label="Onasi" value={lead.motherFullName || '—'} />
            <Row label="Onasi raqami" value={lead.motherPhone || '—'} mono />
            <Row label="Manba" value={lead.source || '—'} />
            <Row label="Qiziqqan fani" value={lead.interestSubject || '—'} />
            {lead.createdAt && <Row label="Yaratilgan" value={formatDate(lead.createdAt)} mono />}
            {lead.note && (
              <div className="pt-3">
                <p className="mb-1 text-sm text-slate-400">Izoh</p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{lead.note}</p>
              </div>
            )}
          </div>

          {/* O'quvchiga aylantirish */}
          <section className="rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <GraduationCap className="h-4 w-4 text-emerald-600" /> O'quvchiga aylantirish
            </h4>
            {convertedStudentId ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Aylantirilgan
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select
                    label="Guruh (ixtiyoriy)"
                    value={convertGroupId}
                    onChange={(e) => setConvertGroupId(e.target.value)}
                  >
                    <option value="">— biriktirmaslik —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Qabul sanasi (ixtiyoriy)"
                    type="date"
                    value={convertDate}
                    onChange={(e) => setConvertDate(e.target.value)}
                  />
                </div>
                <Button onClick={handleConvert} disabled={converting}>
                  <GraduationCap className="h-4 w-4" />
                  {converting ? 'Aylantirilmoqda...' : "O'quvchiga aylantirish"}
                </Button>
              </div>
            )}
          </section>

          {/* Sinov darslari */}
          <section className="rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <CalendarClock className="h-4 w-4 text-violet-600" /> Sinov darslari
            </h4>

            {trials.length === 0 ? (
              <p className="mb-3 text-sm text-slate-400">Sinov darslari belgilanmagan.</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {trials.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{t.groupName}</p>
                      <p className="font-mono text-xs text-slate-400">{formatDateTime(t.scheduledAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${trialResultColors[t.result]}`}
                      >
                        {trialResultLabels[t.result]}
                      </span>
                      {t.result === 'pending' && (
                        <>
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => handleTrialResult(t.id, 'stayed')}
                          >
                            Qoldi
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => handleTrialResult(t.id, 'left')}
                          >
                            Ketdi
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleScheduleTrial} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Guruh"
                  value={trialGroupId}
                  onChange={(e) => setTrialGroupId(e.target.value)}
                >
                  <option value="">— guruh tanlang —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Sana va vaqt"
                  type="datetime-local"
                  value={trialAt}
                  onChange={(e) => setTrialAt(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={savingTrial || !trialGroupId || !trialAt}>
                <CalendarClock className="h-4 w-4" />
                {savingTrial ? 'Saqlanmoqda...' : 'Sinov darsi belgilash'}
              </Button>
            </form>
          </section>

          {/* Tarix (timeline) */}
          <section className="rounded-xl border border-slate-100 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <History className="h-4 w-4 text-blue-600" /> Tarix
            </h4>

            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Izoh qo'shish"
                  placeholder="Izoh yozing..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddNote()
                    }
                  }}
                />
              </div>
              <Button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-slate-400">Hozircha tarix yo'q.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${eventTypeColors[ev.type]}`}
                      >
                        {eventTypeLabels[ev.type]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{ev.text}</p>
                      <p className="text-xs text-slate-400">
                        {ev.actorName ? `${ev.actorName} • ` : ''}
                        <span className="font-mono">{formatDateTime(ev.createdAt)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
