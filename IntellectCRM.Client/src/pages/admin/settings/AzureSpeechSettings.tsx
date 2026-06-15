import { useEffect, useState } from 'react'
import { Check, CheckCircle2, XCircle } from 'lucide-react'
import { getAzureSpeechSettings, saveAzureSpeechSettings, type AzureSpeechConfig } from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/**
 * Speaking (Azure Pronunciation Assessment) sozlamasi — kalit + region.
 * Kiritilgach, o'quvchi "speaking" topshirig'ida gapiradi va Azure talaffuzni baholaydi.
 */
export function AzureSpeechSettings() {
  const [key, setKey] = useState('')
  const [region, setRegion] = useState('')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAzureSpeechSettings()
      .then((c: AzureSpeechConfig) => {
        setRegion(c.region)
        setConfigured(c.configured)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      // Kalit faqat yangi kiritilsa yuboriladi (bo'sh qoldirilsa eski saqlanadi).
      const saved = await saveAzureSpeechSettings({ key: key.trim() || undefined, region: region.trim() })
      setRegion(saved.region)
      setConfigured(saved.configured)
      setKey('')
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
          Speaking (Azure)
          {configured ? (
            <Badge tone="green">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sozlangan
            </Badge>
          ) : (
            <Badge tone="default">
              <XCircle className="h-3.5 w-3.5" /> Sozlanmagan
            </Badge>
          )}
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Speaking topshiriqlari <b>Azure Speech — Pronunciation Assessment</b> orqali baholanadi: o'quvchi
        gapiradi, xizmat nutqni matnga o'giradi va talaffuzni (aniqlik, ravonlik, to'liqlik, ohang) baholab,
        avtomatik ball qo'yadi. Kalit/region kiritilmasa, speaking topshirig'i baholanmaydi. Kalit{' '}
        <b>Azure portal → Speech service → Keys and Endpoint</b> bo'limidan olinadi.
      </p>

      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Maxfiy kalit (Key)</label>
          <p className="mb-2 text-xs text-slate-400">
            {configured
              ? 'Allaqachon saqlangan. O‘zgartirish uchun yangi kalitni kiriting (bo‘sh qoldirsangiz eski saqlanadi).'
              : 'Azure Speech resursining KEY 1 qiymatini kiriting.'}
          </p>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={configured ? '•••••••• (saqlangan)' : 'Azure Speech kaliti'}
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Region</label>
          <p className="mb-2 text-xs text-slate-400">Masalan: eastus, westeurope, southeastasia</p>
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="eastus"
            spellCheck={false}
            className="max-w-[220px]"
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
