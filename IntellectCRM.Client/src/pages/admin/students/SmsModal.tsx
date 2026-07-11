import { useEffect, useMemo, useState } from 'react'
import { Send, AlertTriangle, Check } from 'lucide-react'
import { getSmsStatus, getPickableTemplates, sendSms, type SmsProvider, type PickableTemplate } from '@/api/services/messages'
import { getMessageTokens } from '@/api/services/autoMessages'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MessageEditor, type TokenDef } from '@/components/messaging/MessageEditor'
import { SmsProviderPicker } from '@/components/messaging/SmsProviderPicker'
import { cn } from '@/lib/utils'

/** SMS oluvchi — SmsModal faqat shu maydonlarni ishlatadi (Student ham mos keladi). */
export interface SmsRecipient {
  id: string
  fullName: string
  phone?: string | null
  parentPhone?: string | null
  fatherPhone?: string | null
  motherPhone?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Bitta o'quvchi ham bo'lishi mumkin (masalan o'quvchi sahifasidan) — UI mos ko'rinadi. */
  recipients: SmsRecipient[]
}

/**
 * O'quvchilar ro'yxatidan tanlangan(lar)ga SMS yuborish (Eskiz). Shablon tanlab, ota-ona yoki
 * o'quvchi raqamiga jo'natiladi; matn har o'quvchiga moslab to'ldiriladi ({fish} {sinf} {qarzdorlik}...).
 */
export function SmsModal({ open, onClose, recipients }: Props) {
  const [toParent, setToParent] = useState(true)
  const [message, setMessage] = useState('')
  const [provider, setProvider] = useState<SmsProvider>('eskiz')
  const [agentId, setAgentId] = useState('')
  const [configured, setConfigured] = useState(true)
  const [templates, setTemplates] = useState<PickableTemplate[]>([])
  const [tokens, setTokens] = useState<TokenDef[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda holatni tozalaymiz (maqsadli)
    setMessage('')
    setResult(null)
    setToParent(true)
    setProvider('eskiz')
    setAgentId('')
    setSending(false)
    getSmsStatus().then((s) => setConfigured(s.configured))
    getPickableTemplates('student').then(setTemplates).catch(() => setTemplates([]))
    getMessageTokens()
      .then((ts) => setTokens(ts.filter((t) => t.group !== 'lead')))
      .catch(() => setTokens([]))
  }, [open])

  const phoneCount = useMemo(
    () =>
      recipients.filter((s) =>
        toParent ? s.parentPhone || s.fatherPhone || s.motherPhone : s.phone,
      ).length,
    [recipients, toParent],
  )

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
        provider,
        agentId: agentId || undefined,
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
        {!configured && provider === 'eskiz' && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>SMS (Eskiz) sozlanmagan. "Sozlamalar → Xabar kanallari"da login/parol kiriting.</p>
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

        <SmsProviderPicker
          provider={provider}
          onProviderChange={setProvider}
          agentId={agentId}
          onAgentChange={setAgentId}
        />

        {/* Matn (shablon chiplari + tokenlar + SMS hisoblagich — yagona MessageEditor) */}
        <MessageEditor
          label="Xabar matni"
          value={message}
          onChange={setMessage}
          tokens={tokens}
          templates={templates.map((t) => ({ name: t.name, text: t.text }))}
          showSmsCounter
          rows={5}
          placeholder="Hurmatli ota-ona, ..."
          hint="O'rinbosarlar har o'quvchiga moslab to'ldiriladi."
        />

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
