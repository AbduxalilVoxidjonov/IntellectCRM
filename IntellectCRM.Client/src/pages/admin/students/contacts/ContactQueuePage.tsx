import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PhoneCall, RotateCcw, Search, AlertTriangle, Trash2, MessageSquarePlus, History,
} from 'lucide-react'
import {
  getContactMeta, getContactRequests, getContactRequest, reopenContactRequest,
  deleteContactRequest, addContactNote,
  type ContactMeta, type ContactRequestItem,
} from '@/api/services/contacts'
import { ContactAttemptModal } from './ContactAttemptModal'
import { ContactStatsPanel } from './ContactStatsPanel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage, cn, formatDate, formatDateTime } from '@/lib/utils'

type Tab = 'navbat' | 'hisobot'

/** Chip rangi — server bergan `color` kalitidan (ContactService.Statuses). */
const chipTone: Record<string, string> = {
  amber: 'border-amber-500 bg-amber-50 text-amber-700',
  sky: 'border-sky-500 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-500 bg-rose-50 text-rose-700',
}

/**
 * BOG'LANISH KERAK — o'quvchi bilan bog'lanish NAVBATI va uning hisobotlari.
 *
 * <p>O'quvchi profilidagi "⋮ → Bog'lanish kerak" shu navbatga yozadi. Operator qatordan
 * "Bog'lanildi" bosadi, natija va "javobi nima dedi"ni yozadi, keyingi qadamni tanlaydi.
 * Muddati o'tgan qayta qo'ng'iroqlar tepada va qizil.</p>
 *
 * <p>Ruxsat: `contacts` (O'quvchilar bo'limidan alohida).</p>
 */
export function ContactQueuePage() {
  const { can } = usePerm()
  const canWrite = can('contacts', 'edit')
  const canDelete = can('contacts', 'delete')

  const [tab, setTab] = useState<Tab>('navbat')
  const [meta, setMeta] = useState<ContactMeta>({ statuses: [], results: [], counts: [], overdue: 0 })
  const [items, setItems] = useState<ContactRequestItem[]>([])
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState('')          // '' = ochiqlar, 'all' = hammasi
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')

  const [attemptFor, setAttemptFor] = useState<ContactRequestItem | null>(null)
  const [detail, setDetail] = useState<ContactRequestItem | null>(null)
  const [noteFor, setNoteFor] = useState<ContactRequestItem | null>(null)
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, list] = await Promise.all([
        getContactMeta(),
        getContactRequests({ status: status || undefined, q: q || undefined, overdue: onlyOverdue || undefined }),
      ])
      setMeta(m)
      setItems(list)
      setError('')
    } catch (e) {
      setError(apiErrorMessage(e, "Navbatni yuklab bo'lmadi"))
    } finally {
      setLoading(false)
    }
  }, [status, q, onlyOverdue])

  useEffect(() => {
    void load()
  }, [load])

  const countOf = useCallback(
    (key: string) => meta.counts.find((c) => c.key === key)?.count ?? 0,
    [meta.counts],
  )
  const openCount = useMemo(() => countOf('new') + countOf('callback'), [countOf])

  /** Talab yangilangach ro'yxatni ham, sanoqlarni ham qayta o'qiymiz (chiplar eskirmasin). */
  const afterChange = async (updated?: ContactRequestItem) => {
    if (updated && detail?.id === updated.id) setDetail(await getContactRequest(updated.id))
    await load()
  }

  const openDetail = async (id: string) => {
    try {
      setDetail(await getContactRequest(id))
    } catch (e) {
      setError(apiErrorMessage(e, "Tarixni yuklab bo'lmadi"))
    }
  }

  return (
    <div>
      <PageHeader
        title="Bog'lanish kerak"
        sub="O'quvchi bilan bog'lanish navbati — kim bilan bog'lanish kerak, nima deyildi va keyingi qadam"
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button
          type="button"
          className={cn('tab', tab === 'navbat' && 'active')}
          onClick={() => setTab('navbat')}
        >
          <PhoneCall className="mr-1 inline h-3.5 w-3.5" /> Navbat
          {openCount > 0 && <span className="ml-1.5 text-xs text-slate-400">({openCount})</span>}
        </button>
        <button
          type="button"
          className={cn('tab', tab === 'hisobot' && 'active')}
          onClick={() => setTab('hisobot')}
        >
          <History className="mr-1 inline h-3.5 w-3.5" /> Hisobot
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {tab === 'hisobot' ? (
        <ContactStatsPanel />
      ) : (
        <div className="space-y-4">
          {/* Muddati o'tganlar — eng muhim ogohlantirish, tepada turadi. */}
          {meta.overdue > 0 && !onlyOverdue && (
            <button
              type="button"
              onClick={() => { setOnlyOverdue(true); setStatus('') }}
              className="flex w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm text-rose-700 transition-colors hover:bg-rose-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{meta.overdue} ta</strong> qayta qo'ng'iroq muddati o'tgan — ko'rish uchun bosing
              </span>
            </button>
          )}

          <Card title="Filtr">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label="Ochiqlar"
                count={openCount}
                active={status === '' && !onlyOverdue}
                onClick={() => { setStatus(''); setOnlyOverdue(false) }}
              />
              {meta.statuses.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  count={countOf(s.key)}
                  tone={s.color}
                  active={status === s.key && !onlyOverdue}
                  onClick={() => { setStatus(s.key); setOnlyOverdue(false) }}
                />
              ))}
              <Chip
                label="Hammasi"
                count={meta.counts.reduce((a, c) => a + c.count, 0)}
                active={status === 'all' && !onlyOverdue}
                onClick={() => { setStatus('all'); setOnlyOverdue(false) }}
              />
              <Chip
                label="Muddati o'tgan"
                count={meta.overdue}
                tone="rose"
                active={onlyOverdue}
                onClick={() => { setOnlyOverdue(!onlyOverdue); setStatus('') }}
              />

              <form
                className="ml-auto flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setQ(term.trim())
                }}
              >
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="O'quvchi yoki sabab"
                  className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
                />
                <Button type="submit" variant="secondary">
                  <Search className="h-4 w-4" /> Qidirish
                </Button>
              </form>
            </div>
          </Card>

          {loading ? (
            <Loader label="Yuklanmoqda..." />
          ) : items.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm text-slate-400">
                Navbat bo'sh — bog'lanish kerak bo'lgan o'quvchi yo'q.
              </p>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {items.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/students/${r.studentId}`}
                            className="text-sm font-semibold text-slate-800 hover:text-brand-600 hover:underline"
                          >
                            {r.studentName}
                          </Link>
                          <StatusBadge label={r.statusLabel} status={r.status} overdue={r.overdue} />
                          {r.reasonLabel && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              {r.reasonLabel}
                            </span>
                          )}
                          {r.attemptCount > 0 && (
                            <span className="text-xs text-slate-400">{r.attemptCount} urinish</span>
                          )}
                        </div>

                        {r.status === 'callback' && r.dueDate && (
                          <p className={cn('mt-1 text-xs', r.overdue ? 'font-semibold text-rose-600' : 'text-sky-600')}>
                            {r.overdue ? 'Muddati o\'tgan: ' : 'Qayta qo\'ng\'iroq: '}
                            {formatDate(r.dueDate)}
                          </p>
                        )}

                        {r.lastResponse && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            <span className="text-slate-400">Javobi: </span>{r.lastResponse}
                          </p>
                        )}
                        {!r.lastResponse && r.note && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{r.note}</p>
                        )}

                        <p className="mt-1 text-xs text-slate-400">
                          {r.lastActionAt ? formatDateTime(r.lastActionAt) : formatDateTime(r.createdAt)}
                          {r.lastActorName && ` · ${r.lastActorName}`}
                        </p>

                        {r.phones.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-3">
                            {r.phones.map((p) => (
                              <a key={p} href={`tel:${p}`} className="font-mono text-xs text-brand-600 hover:underline">
                                {p}
                              </a>
                            ))}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {canWrite && (r.status === 'new' || r.status === 'callback') && (
                          <Button onClick={() => setAttemptFor(r)}>
                            <PhoneCall className="h-4 w-4" /> Bog'lanildi
                          </Button>
                        )}
                        {canWrite && (r.status === 'done' || r.status === 'failed') && (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await reopenContactRequest(r.id)
                                await afterChange()
                              } catch (e) {
                                setError(apiErrorMessage(e, "Qayta ochib bo'lmadi"))
                              }
                            }}
                          >
                            <RotateCcw className="h-4 w-4" /> Qayta ochish
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => void openDetail(r.id)}>
                          <History className="h-4 w-4" /> Tarix
                        </Button>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            onClick={() => { setNoteFor(r); setNoteText('') }}
                            title="Izoh qo'shish"
                          >
                            <MessageSquarePlus className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            title="O'chirish"
                            onClick={async () => {
                              // Modal ochilishi TelegramWebApp/brauzer dialogini bloklamasin uchun
                              // tasdiqni oddiy confirm bilan olamiz (loyihadagi boshqa joylar kabi).
                              if (!confirm(`"${r.studentName}" talabini o'chirasizmi?`)) return
                              try {
                                await deleteContactRequest(r.id)
                                await afterChange()
                              } catch (e) {
                                setError(apiErrorMessage(e, "O'chirib bo'lmadi"))
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <ContactAttemptModal
        open={!!attemptFor}
        request={attemptFor}
        meta={meta}
        onClose={() => setAttemptFor(null)}
        onSaved={(u) => void afterChange(u)}
      />

      {/* TARIX — "kim qaysi bosqichga oldi, natijasi qanday bo'ldi" */}
      <Modal open={!!detail} onClose={() => setDetail(null)} size="md" title="Bog'lanish tarixi">
        {detail && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="font-semibold text-slate-700">{detail.studentName}</p>
              <p className="mt-0.5 text-slate-500">
                {detail.reasonLabel || '— sababsiz —'} · {detail.statusLabel}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Ochgan: {detail.createdBy} · {formatDateTime(detail.createdAt)}
              </p>
            </div>
            <ul className="space-y-2">
              {(detail.history ?? []).map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-700">{eventTitle(h.type)}</span>
                    {h.resultLabel && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {h.resultLabel}
                      </span>
                    )}
                    {h.nextStatusLabel && (
                      <span className="text-xs text-slate-400">
                        → {h.nextStatusLabel}
                        {h.dueDate && ` (${formatDate(h.dueDate)})`}
                      </span>
                    )}
                  </div>
                  {h.response && <p className="mt-1 text-sm text-slate-600">{h.response}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(h.createdAt)} · {h.actorName || 'Tizim'}
                  </p>
                </li>
              ))}
              {(detail.history ?? []).length === 0 && (
                <li className="py-4 text-center text-sm text-slate-400">Hodisa yo'q</li>
              )}
            </ul>
          </div>
        )}
      </Modal>

      {/* Izoh qo'shish (bosqich o'zgarmaydi) */}
      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        size="sm"
        title="Izoh qo'shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteFor(null)}>
              Bekor
            </Button>
            <Button
              disabled={!noteText.trim()}
              onClick={async () => {
                if (!noteFor) return
                try {
                  await addContactNote(noteFor.id, noteText.trim())
                  setNoteFor(null)
                  await afterChange()
                } catch (e) {
                  setError(apiErrorMessage(e, "Izohni saqlab bo'lmadi"))
                }
              }}
            >
              Saqlash
            </Button>
          </>
        }
      >
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Masalan: ota-onasi o'zi kelib ketdi"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
        />
        <p className="mt-1 text-xs text-slate-400">Bosqich o'zgarmaydi — faqat tarixga yoziladi.</p>
      </Modal>
    </div>
  )
}

function eventTitle(type: string): string {
  switch (type) {
    case 'created': return 'Talab ochildi'
    case 'contact': return "Bog'lanildi"
    case 'note': return 'Izoh'
    case 'reopen': return 'Qayta ochildi'
    default: return type
  }
}

function StatusBadge({ label, status, overdue }: { label: string; status: string; overdue: boolean }) {
  const tone =
    overdue ? 'bg-rose-100 text-rose-700'
    : status === 'new' ? 'bg-amber-100 text-amber-700'
    : status === 'callback' ? 'bg-sky-100 text-sky-700'
    : status === 'done' ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-200 text-slate-600'
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', tone)}>
      {overdue ? 'Muddati o\'tgan' : label}
    </span>
  )
}

function Chip({
  label, count, active, onClick, tone,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  tone?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? (tone && chipTone[tone]) || 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs font-semibold',
          active ? 'bg-white/70' : 'bg-slate-100 text-slate-500',
        )}
      >
        {count}
      </span>
    </button>
  )
}
