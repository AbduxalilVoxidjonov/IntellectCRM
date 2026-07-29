import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Smartphone, XCircle, Wallet } from 'lucide-react'
import { getEskizSettings, saveEskizSettings, type EskizConfig } from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'
import { formatMoney } from '@/lib/utils'
import { EnvSecretField } from '@/components/settings/EnvSecretField'
import type { EnvSecret } from '@/api/services/settings'

/**
 * SMS (Eskiz.uz) sozlamasi.
 * Kabinet LOGIN/PAROLI serverdagi `.env` faylida (ESKIZ_EMAIL / ESKIZ_PASSWORD) — bazada
 * saqlanmaydi va UI'dan kiritilmaydi. Bu yerdan faqat jo'natuvchi nomi (sender) o'zgartiriladi.
 */
export function EskizSettings() {
  const [email, setEmail] = useState('')
  const [login, setLogin] = useState<EnvSecret | null>(null)
  const [password, setPassword] = useState<EnvSecret | null>(null)
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
    setLogin(c.login ?? null)
    setPassword(c.password ?? null)
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
      const saved = await saveEskizSettings({ from: from.trim() || '4546' })
      apply(saved)
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
        (Xabarlar → <b>SMS yuborish</b>). Login/parol — eskiz.uz kabinetingiznikidir va serverdagi
        <code className="rounded bg-slate-100 px-1">.env</code> faylida turadi. Jo'natuvchi nomi
        (sender) tasdiqlangan niknemingiz; tasdiqlanmaguncha faqat test matnlari ketadi (test uchun{' '}
        <span className="font-mono">4546</span>).
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <EnvSecretField
          label="Eskiz kabinet logini (email)"
          secret={login}
          sample="sizning@email.uz"
          hint={email ? `Hozirgi qiymat: ${email}` : undefined}
        />
        <EnvSecretField label="Eskiz kabinet paroli" secret={password} sample="********" />

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
  )
}
