import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, AlertTriangle, ChevronDown, MessageCircle, Search, Check } from 'lucide-react'
import type { MessageClass } from '@/types'
import {
  getSmsStatus,
  getSmsBatches,
  getSmsLogs,
  getSmsRecipients,
  getSmsTeacherRecipients,
  sendSms,
  type SmsBatch,
  type SmsLog,
  type SmsRecipient,
  type SmsTeacherRecipient,
  type SendSmsReq,
} from '@/api/services/messages'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'
import { Select } from '@/components/ui/Input'
import { cn, formatDate } from '@/lib/utils'
import { messageTokens } from '@/config/messageTemplates'
import { TemplateChips } from './TemplateChips'

type Audience = 'parents' | 'students' | 'teachers' | 'selected'

/** SMS holatini guruhlaydi: yetkazildi / kutilmoqda / yetkazilmadi. */
function statusInfo(status: string): { label: string; tone: 'green' | 'amber' | 'red' } {
  const s = (status || '').toUpperCase()
  if (s === 'DELIVRD' || s === 'DELIVERED') return { label: 'Yetkazildi', tone: 'green' }
  if (s === 'WAITING' || s === 'NEW' || s === 'ACCEPTED' || s === 'STORED')
    return { label: 'Kutilmoqda', tone: 'amber' }
  return { label: 'Yetkazilmadi', tone: 'red' }
}

/** SMS uzunligi → bo'laklar soni (GSM-7: 160/153, Unicode: 70/67). */
function smsParts(text: string): { len: number; parts: number } {
  const len = text.length
  // eslint-disable-next-line no-control-regex
  const unicode = /[^ -]/.test(text)
  if (len === 0) return { len: 0, parts: 0 }
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const parts = len <= single ? 1 : Math.ceil(len / multi)
  return { len, parts }
}

/** Xabarlar → "SMS yuborish": Eskiz orqali ota-ona/o'quvchi/o'qituvchi raqamlariga SMS + tarix. */
export function SmsComposer({ classes }: { classes: MessageClass[] }) {
  const [audience, setAudience] = useState<Audience>('parents')
  const [className, setClassName] = useState('')
  const [onlyDebtors, setOnlyDebtors] = useState(false)
  const [text, setText] = useState('')

  const [configured, setConfigured] = useState(true)
  const [from, setFrom] = useState('4546')
  const [history, setHistory] = useState<SmsBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // "Tanlab" rejimi: oluvchilar ro'yxati + tanlov + kimning raqamiga (ota-ona/o'quvchi).
  const [recipients, setRecipients] = useState<SmsRecipient[]>([])
  const [teacherRecipients, setTeacherRecipients] = useState<SmsTeacherRecipient[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [toParent, setToParent] = useState(true)
  const recipientsLoaded = useRef(false)

  // Tarix tafsiloti (qaysi raqamga, qanday holat) — bitta partiya bo'yicha
  const [openId, setOpenId] = useState<string | null>(null)
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getSmsStatus().then((s) => {
      setConfigured(s.configured)
      setFrom(s.from)
    })
    getSmsBatches()
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [])

  // Oluvchilar ro'yxatini birinchi marta "Tanlab" tanlanganda yuklaymiz.
  useEffect(() => {
    if (audience === 'selected' && !recipientsLoaded.current) {
      recipientsLoaded.current = true
      getSmsRecipients().then(setRecipients).catch(() => setRecipients([]))
      getSmsTeacherRecipients().then(setTeacherRecipients).catch(() => setTeacherRecipients([]))
    }
  }, [audience])

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recipients
    return recipients.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.className.toLowerCase().includes(q),
    )
  }, [recipients, search])

  const filteredTeacherRecipients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teacherRecipients
    return teacherRecipients.filter((t) => t.fullName.toLowerCase().includes(q))
  }, [teacherRecipients, search])

  const toggleRecipient = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleTeacherRecipient = (id: string) =>
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleLogs = (id: string) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    setLogs([])
    setLogsLoading(true)
    getSmsLogs(id)
      .then(setLogs)
      .finally(() => setLogsLoading(false))
  }

  const insertToken = (token: string) => {
    const el = textRef.current
    if (!el) {
      setText((b) => b + token)
      return
    }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    setText(text.slice(0, start) + token + text.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const selected = audience === 'selected'
    if (selected && selectedIds.size === 0 && selectedTeacherIds.size === 0) {
      setResult('Hech kim tanlanmadi.')
      return
    }
    setSending(true)
    setResult(null)
    try {
      const req: SendSmsReq = {
        audience,
        className: (audience === 'parents' || audience === 'students') && className ? className : undefined,
        onlyDebtors: audience !== 'teachers' && !selected && onlyDebtors,
        studentIds: selected ? [...selectedIds] : undefined,
        teacherIds: selected ? [...selectedTeacherIds] : undefined,
        toParent: selected ? toParent : undefined,
        text: text.trim(),
      }
      const b = await sendSms(req)
      setHistory((prev) => [b, ...prev])
      setText('')
      setResult(`SMS yuborildi: ${b.sentCount}/${b.recipientCount} raqamga.`)
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Yuborishda xatolik'
      setResult(msg)
    } finally {
      setSending(false)
    }
  }

  const { len, parts } = smsParts(text)
  const withClass = audience === 'parents' || audience === 'students'

  return (
    <div className="space-y-4">
      {!configured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            SMS (Eskiz) hali sozlanmagan. Yuborish uchun "Sozlamalar → SMS (Eskiz)" bo'limida
            login/parolni kiriting.
          </p>
        </div>
      )}

      <Card
        title="Kimga yuborish"
        actions={
          audience === 'selected' ? (
            <Badge tone="violet">
              <span className="font-mono">{selectedIds.size + selectedTeacherIds.size}</span> ta tanlandi
            </Badge>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="tabs">
            <button
              type="button"
              onClick={() => setAudience('parents')}
              className={cn('tab', audience === 'parents' && 'active')}
            >
              Ota-onalar
            </button>
            <button
              type="button"
              onClick={() => setAudience('students')}
              className={cn('tab', audience === 'students' && 'active')}
            >
              O'quvchilar
            </button>
            <button
              type="button"
              onClick={() => setAudience('teachers')}
              className={cn('tab', audience === 'teachers' && 'active')}
            >
              O'qituvchilar
            </button>
            <button
              type="button"
              onClick={() => setAudience('selected')}
              className={cn('tab', audience === 'selected' && 'active')}
            >
              Tanlab
            </button>
          </div>

          {withClass && (
            <Select value={className} onChange={(e) => setClassName(e.target.value)} className="w-auto">
              <option value="">Barcha guruhlar</option>
              {classes.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          {audience !== 'teachers' && audience !== 'selected' && (
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyDebtors}
                onChange={(e) => setOnlyDebtors(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Faqat qarzdorlar
            </label>
          )}

          {/* Tanlab: kimning raqamiga — ota-ona yoki o'quvchi */}
          {audience === 'selected' && (
            <div className="inline-flex items-center gap-2">
              <span className="text-sm text-slate-500">Kimning raqamiga:</span>
              <div className="tabs">
                <button
                  type="button"
                  onClick={() => setToParent(true)}
                  className={cn('tab', toParent && 'active')}
                >
                  Ota-ona
                </button>
                <button
                  type="button"
                  onClick={() => setToParent(false)}
                  className={cn('tab', !toParent && 'active')}
                >
                  O'quvchi
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {audience === 'parents'
            ? "Har o'quvchining ota-onasi raqamiga (telefon kiritilganlarga)."
            : audience === 'students'
              ? "O'quvchining o'z raqamiga."
              : audience === 'teachers'
                ? "Har o'qituvchining raqamiga."
                : toParent
                  ? "Tanlangan o'quvchilarning ota-onasi raqamiga (o'qituvchilar — o'z raqamiga)."
                  : "Tanlangan o'quvchilarning o'z raqamiga (o'qituvchilar — o'z raqamiga)."}{' '}
          Bir xil raqam bir marta oladi. Jo'natuvchi: <span className="font-mono">{from}</span>
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="SMS matni" bodyClassName="space-y-3">
          {/* Tayyor matnlar (andozalar + SMS/eslatma matnlari) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <TemplateChips onPick={(t) => setText(t)} />
            {text && (
              <button
                type="button"
                onClick={() => setText('')}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-50"
              >
                Tozalash
              </button>
            )}
          </div>

          <div>
            <textarea
              ref={textRef}
              className="h-32 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="SMS matni"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {messageTokens.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    title={t.token}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="shrink-0 font-mono text-xs text-slate-400">
                {len} belgi · {parts} SMS
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              O'rinbosarlar har o'quvchiga moslab to'ldiriladi. O'qituvchilarga faqat {'{fish}'} ishlaydi.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            {result && <p className="text-sm font-medium text-emerald-700">{result}</p>}
            <Button className="ml-auto" onClick={handleSend} disabled={!text.trim() || sending}>
              <Send className="h-4 w-4" /> {sending ? 'Yuborilmoqda...' : 'SMS yuborish'}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {/* Tanlab — o'quvchilar ro'yxati */}
          {audience === 'selected' && (
            <Card title="Oluvchilarni tanlang">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="O'quvchi, o'qituvchi yoki guruh..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filteredRecipients.length === 0 && filteredTeacherRecipients.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">Oluvchi topilmadi</p>
                )}
                {filteredRecipients.map((r) => {
                  const active = selectedIds.has(r.studentId)
                  const phone = toParent ? r.parentPhone : r.studentPhone
                  const noPhone = !phone
                  return (
                    <button
                      key={r.studentId}
                      type="button"
                      disabled={noPhone}
                      onClick={() => toggleRecipient(r.studentId)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        noPhone
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                          : active
                            ? 'border-brand-300 bg-brand-50'
                            : 'border-slate-100 hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          active && !noPhone ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300',
                        )}
                      >
                        {active && !noPhone && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1">
                        <span className={cn('font-medium', noPhone ? 'text-slate-400' : 'text-slate-700')}>
                          {r.fullName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {' '}· {r.className || '—'}
                          {phone && <span className="ml-1 font-mono">{phone}</span>}
                        </span>
                      </span>
                      {noPhone && <Badge tone="amber">raqam yo'q</Badge>}
                    </button>
                  )
                })}
                {filteredTeacherRecipients.map((t) => {
                  const active = selectedTeacherIds.has(t.teacherId)
                  const noPhone = !t.phone
                  return (
                    <button
                      key={t.teacherId}
                      type="button"
                      disabled={noPhone}
                      onClick={() => toggleTeacherRecipient(t.teacherId)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        noPhone
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                          : active
                            ? 'border-brand-300 bg-brand-50'
                            : 'border-slate-100 hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          active && !noPhone ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300',
                        )}
                      >
                        {active && !noPhone && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1">
                        <span className={cn('font-medium', noPhone ? 'text-slate-400' : 'text-slate-700')}>
                          {t.fullName}
                        </span>
                        {t.phone && <span className="ml-1 text-xs font-mono text-slate-400">{t.phone}</span>}
                      </span>
                      <Badge tone="blue">O'qituvchi</Badge>
                      {noPhone && <Badge tone="amber">raqam yo'q</Badge>}
                    </button>
                  )
                })}
              </div>
              {(selectedIds.size > 0 || selectedTeacherIds.size > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set())
                    setSelectedTeacherIds(new Set())
                  }}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                >
                  Tanlovni tozalash ({selectedIds.size + selectedTeacherIds.size})
                </button>
              )}
            </Card>
          )}

          <Card title="Yuborilgan SMS'lar">
            {loading ? (
              <Loader label="Yuklanmoqda..." />
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {history.length === 0 && (
                  <div className="py-8 text-center">
                    <MessageCircle className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    <p className="text-sm text-slate-400">Hali SMS yuborilmagan</p>
                  </div>
                )}
                {history.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge>{b.audience}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{b.message}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono">{formatDate(b.createdAt)}</span>
                      <span className="font-mono">
                        {b.sentCount}/{b.recipientCount} yuborildi
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleLogs(b.id)}
                      className="mt-2 flex w-full items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      Raqamlar va holat
                      <ChevronDown
                        className={cn('ml-auto h-3.5 w-3.5 transition-transform', openId === b.id && 'rotate-180')}
                      />
                    </button>

                    {openId === b.id && (
                      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        {logsLoading ? (
                          <p className="text-xs text-slate-400">Yuklanmoqda...</p>
                        ) : logs.length === 0 ? (
                          <p className="text-xs text-slate-400">Yozuv yo'q</p>
                        ) : (
                          logs.map((l) => {
                            const si = statusInfo(l.status)
                            return (
                              <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-slate-600">
                                  {l.recipientName}
                                  <span className="ml-1 font-mono text-slate-400">{l.phoneNumber}</span>
                                </span>
                                <Badge tone={si.tone}>{si.label}</Badge>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
