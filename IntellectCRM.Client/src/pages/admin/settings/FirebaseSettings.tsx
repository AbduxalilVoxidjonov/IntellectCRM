import { useEffect, useState } from 'react'
import { Check, CheckCircle2, XCircle } from 'lucide-react'
import { getFirebaseSettings, saveFirebaseSettings, type FirebaseConfig } from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/**
 * Firebase push sozlamasi — faqat NATIVE (Flutter) ilovaga push yuborish uchun Service Account JSON.
 * Web/PWA push olib tashlandi: ilova FCM tokenni native oladi, server shu JSON bilan push yuboradi.
 */
export function FirebaseSettings() {
  const [json, setJson] = useState('')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFirebaseSettings()
      .then((c: FirebaseConfig) => {
        setJson(c.serviceAccountJson)
        setConfigured(c.configured)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      const saved = await saveFirebaseSettings({ serviceAccountJson: json.trim() })
      setJson(saved.serviceAccountJson)
      setConfigured(saved.configured)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e: unknown) {
      setStatus('idle')
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Saqlab bo'lmadi — service account JSON noto'g'ri."
      setError(msg)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          Push (Firebase)
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
        Bildirishnoma (push) Flutter ilovaga yuboriladi. Ilova FCM tokenni o'zi oladi va ro'yxatdan
        o'tkazadi; server quyidagi <b>Service Account JSON</b> bilan o'sha tokenga push yuboradi.
        Web/PWA config kerak emas. <b>Muhim:</b> bu JSON ilovadagi <code>google-services.json</code>
        bilan bitta Firebase loyihadan bo'lishi shart.
      </p>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Service account (JSON)</label>
          <p className="mb-2 text-xs text-slate-400">
            Firebase Console → Project Settings → Service accounts → "Generate new private key" →
            yuklab olingan JSON faylni to'liq shu yerga qo'ying.
          </p>
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }'
            spellCheck={false}
            className="h-44 font-mono text-xs"
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
