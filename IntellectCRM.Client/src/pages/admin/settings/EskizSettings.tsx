import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Smartphone, XCircle, Wallet, Plus, Pencil, Trash2, Zap, MessageSquare } from 'lucide-react'
import { getEskizSettings, saveEskizSettings, type EskizConfig } from '@/api/services/settings'
import {
  getSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  type SmsTemplate,
} from '@/api/services/messages'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'
import { messageTokens } from '@/config/messageTemplates'
import { formatMoney, cn } from '@/lib/utils'

/**
 * SMS (Eskiz.uz) sozlamasi — kabinet login/parol + jo'natuvchi nomi (sender).
 * Kiritilgach, Xabarlar → "SMS yuborish" bo'limida ota-ona/o'quvchi/o'qituvchi raqamlariga SMS yuboriladi.
 */
export function EskizSettings() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('4546')
  const [configured, setConfigured] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const apply = (c: EskizConfig) => {
    setEmail(c.email)
    setFrom(c.from || '4546')
    setConfigured(c.configured)
    setBalance(c.balance)
  }

  useEffect(() => {
    getEskizSettings()
      .then(apply)
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      const saved = await saveEskizSettings({
        email: email.trim(),
        password: password.trim() || undefined,
        from: from.trim() || '4546',
      })
      apply(saved)
      setPassword('')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e: unknown) {
      setStatus('idle')
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Saqlab bo'lmadi.",
      )
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand-600" /> SMS (Eskiz)
          {configured ? (
            <Badge tone="green">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sozlangan
            </Badge>
          ) : (
            <Badge tone="default">
              <XCircle className="h-3.5 w-3.5" /> Sozlanmagan
            </Badge>
          )}
          {balance != null && (
            <Badge tone="blue">
              <Wallet className="h-3.5 w-3.5" /> Balans: {formatMoney(balance)}
            </Badge>
          )}
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        <b>Eskiz.uz</b> SMS shlyuzi orqali ota-ona/o'quvchi/o'qituvchi raqamlariga SMS yuboriladi
        (Xabarlar → <b>SMS yuborish</b>). Login/parol — eskiz.uz kabinetingiznikidir. Jo'natuvchi nomi
        (sender) tasdiqlangan niknemingiz; tasdiqlanmaguncha faqat test matnlari ketadi (test uchun{' '}
        <span className="font-mono">4546</span>).
      </p>

      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email (login)</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sizning@email.uz"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Parol</label>
          <p className="mb-2 text-xs text-slate-400">
            {configured
              ? "Allaqachon saqlangan. O'zgartirish uchun yangi parolni kiriting (bo'sh qoldirsangiz eski saqlanadi)."
              : 'Eskiz kabinet parolini kiriting.'}
          </p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={configured ? '•••••••• (saqlangan)' : 'Parol'}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Jo'natuvchi (sender)</label>
          <p className="mb-2 text-xs text-slate-400">
            Tasdiqlangan nikname yoki test uchun <span className="font-mono">4546</span>.
          </p>
          <Input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="4546"
            className="max-w-[200px] font-mono text-sm"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
          {status === 'saved' && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Saqlandi
            </span>
          )}
        </div>
      </form>
    </Card>

    <SmsTemplatesCard />
    </div>
  )
}

/** SMS andozalari (shablonlar) — yaratish/tahrirlash/o'chirish + "Avto SMS" belgilash. */
function SmsTemplatesCard() {
  const [items, setItems] = useState<SmsTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SmsTemplate | null>(null)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [isAuto, setIsAuto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = () =>
    getSmsTemplates()
      .then(setItems)
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  const reset = () => {
    setEditing(null)
    setName('')
    setText('')
    setIsAuto(false)
    setAdding(false)
  }

  const startAdd = () => {
    reset()
    setAdding(true)
  }
  const startEdit = (t: SmsTemplate) => {
    setEditing(t)
    setName(t.name)
    setText(t.text)
    setIsAuto(t.isAuto)
    setAdding(true)
  }

  const save = async () => {
    if (!name.trim() || !text.trim() || saving) return
    setSaving(true)
    try {
      if (editing) await updateSmsTemplate(editing.id, { name: name.trim(), text: text.trim(), isAuto })
      else await createSmsTemplate({ name: name.trim(), text: text.trim(), isAuto })
      await load()
      reset()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: SmsTemplate) => {
    if (!confirm(`"${t.name}" andozasini o'chirasizmi?`)) return
    await deleteSmsTemplate(t.id)
    await load()
  }

  const insertToken = (token: string) => setText((x) => x + token)

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-600" /> SMS andozalari (shablonlar)
        </span>
      }
      actions={
        !adding ? (
          <Button variant="secondary" onClick={startAdd}>
            <Plus className="h-4 w-4" /> Yangi andoza
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm text-slate-400">
        Bu andozalar SMS yuborishda (o'quvchi/ota-ona/lid) tanlanadi. <b>Avto SMS</b> deb belgilangan
        andoza yangi lid tushganda avtomatik yuboriladi. O'rinbosarlar: {'{fish}'}, {'{telefon}'} va h.k.
      </p>

      {adding && (
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <Input label="Andoza nomi" value={name} onChange={(e) => setName(e.target.value)} placeholder="masalan: Qarzdorlik eslatmasi" />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Matn</label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="SMS matni (o'rinbosarlar bilan)"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {messageTokens.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insertToken(t.token)}
                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isAuto} onChange={(e) => setIsAuto(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            <Zap className="h-4 w-4 text-amber-500" /> Avto SMS (yangi lid tushganda avtomatik yuboriladi)
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={!name.trim() || !text.trim() || saving}>
              {saving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : "Qo'shish"}
            </Button>
            <Button variant="secondary" onClick={reset}>Bekor</Button>
          </div>
        </div>
      )}

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Andoza yo'q. "Yangi andoza" bilan qo'shing.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{t.name}</span>
                  {t.isAuto && (
                    <Badge tone="amber">
                      <Zap className="h-3 w-3" /> Avto
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{t.text}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" title="Tahrirlash" onClick={() => startEdit(t)} className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600')}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title="O'chirish" onClick={() => remove(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
