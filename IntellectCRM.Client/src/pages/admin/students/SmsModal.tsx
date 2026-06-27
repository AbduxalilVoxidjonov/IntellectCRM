import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, AlertTriangle, Check } from 'lucide-react'
import type { Student } from '@/types'
import { getSmsStatus, sendSms } from '@/api/services/messages'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { messageTemplates, messageTokens } from '@/config/messageTemplates'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  recipients: Student[]
}

/** SMS uzunligi → bo'laklar soni (GSM-7: 160/153, Unicode: 70/67). */
function smsParts(text: string): { len: number; parts: number } {
  const len = text.length
  // eslint-disable-next-line no-control-regex
  const unicode = /[^ -]/.test(text)
  if (len === 0) return { len: 0, parts: 0 }
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  return { len, parts: len <= single ? 1 : Math.ceil(len / multi) }
}

/**
 * O'quvchilar ro'yxatidan tanlangan(lar)ga SMS yuborish (Eskiz). Shablon tanlab, ota-ona yoki
 * o'quvchi raqamiga jo'natiladi; matn har o'quvchiga moslab to'ldiriladi ({fish} {sinf} {qarzdorlik}...).
 */
export function SmsModal({ open, onClose, recipients }: Props) {
  const [toParent, setToParent] = useState(true)
  const [message, setMessage] = useState('')
  const [configured, setConfigured] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda holatni tozalaymiz (maqsadli)
    setMessage('')
    setResult(null)
    setToParent(true)
    setSending(false)
    getSmsStatus().then((s) => setConfigured(s.configured))
  }, [open])

  const phoneCount = useMemo(
    () =>
      recipients.filter((s) =>
        toParent ? s.parentPhone || s.fatherPhone || s.motherPhone : s.phone,
      ).length,
    [recipients, toParent],
  )

  const insertToken = (token: string) => {
    const el = taRef.current
    if (!el) {
      setMessage((m) => m + token)
      return
    }
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    setMessage(message.slice(0, start) + token + message.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const handleSend = async () => {
    if (!message.trim() || sending || recipients.length === 0) return
    setSending(true)
    setResult(null)
    try {
      const b = await sendSms({
        audience: 'selected',
        studentIds: recipients.map((s) => s.id),
        onlyDebtors: false,
        toParent,
        text: message.trim(),
      })
      setResult(
        b.recipientCount === 0
          ? 'Raqamli oluvchi topilmadi — hech kimga yuborilmadi.'
          : `SMS yuborildi: ${b.sentCount}/${b.recipientCount} raqamga.`,
      )
    } catch (e) {
      setResult(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Yuborishda xatolik',
      )
    } finally {
      setSending(false)
    }
  }

  const { len, parts } = smsParts(message)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="SMS yuborish"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={handleSend} disabled={!message.trim() || sending || phoneCount === 0}>
            <Send className="h-4 w-4" /> {sending ? 'Yuborilmoqda...' : 'Yuborish'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!configured && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>SMS (Eskiz) sozlanmagan. "Sozlamalar → SMS (Eskiz)"da login/parol kiriting.</p>
          </div>
        )}

        {/* Kimga: ota-ona yoki o'quvchi raqami */}
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-600">Kimga</div>
          <div className="tabs inline-flex">
            <button
              type="button"
              onClick={() => setToParent(true)}
              className={cn('tab', toParent && 'active')}
            >
              Ota-ona raqami
            </button>
            <button
              type="button"
              onClick={() => setToParent(false)}
              className={cn('tab', !toParent && 'active')}
            >
              O'quvchi raqami
            </button>
          </div>
          <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {recipients.length === 1 ? (
              <>
                <b>{recipients[0].fullName}</b>
                {' — '}
                {(toParent
                  ? recipients[0].parentPhone || recipients[0].fatherPhone || recipients[0].motherPhone
                  : recipients[0].phone) || (
                  <span className="text-red-500">raqam yo'q</span>
                )}
              </>
            ) : (
              <>
                Qabul qiluvchilar: <b>{recipients.length} ta</b> · raqami borlar:{' '}
                <b className={phoneCount === 0 ? 'text-red-500' : 'text-emerald-600'}>{phoneCount}</b>
              </>
            )}
          </p>
        </div>

        {/* Tayyor shablonlar */}
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-600">Shablon tanlang</div>
          <div className="flex flex-wrap gap-1.5">
            {messageTemplates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setMessage(t.text)}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Matn */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Xabar matni</label>
          <textarea
            ref={taRef}
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Hurmatli ota-ona, ..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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
            O'rinbosarlar har o'quvchiga moslab to'ldiriladi.
          </p>
        </div>

        {result && (
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              result.startsWith('SMS yuborildi') ? 'text-emerald-700' : 'text-amber-700',
            )}
          >
            {result.startsWith('SMS yuborildi') && <Check className="h-4 w-4" />}
            {result}
          </p>
        )}
      </div>
    </Modal>
  )
}
