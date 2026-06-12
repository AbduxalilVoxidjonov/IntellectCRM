import { useEffect, useState } from 'react'
import { Check, CheckCircle2, XCircle } from 'lucide-react'
import {
  getFirebaseSettings,
  saveFirebaseSettings,
  type FirebaseConfig,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/**
 * Firebase web config'ni JSON'ga normallashtiradi. Firebase Console `const firebaseConfig = {...};`
 * ko'rinishidagi JS beradi (kalitlar qo'shtirnoqsiz) — uni to'g'ri JSON'ga o'giramiz.
 */
function toJsonObject(text: string): string {
  const t = text.trim()
  if (!t) return ''
  try {
    JSON.parse(t)
    return t // allaqachon to'g'ri JSON
  } catch {
    /* JS snippet — pastda o'giramiz */
  }
  let s = t
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a >= 0 && b > a) s = s.slice(a, b + 1) // faqat { ... } qismi
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // kalitlarni qo'shtirnoqqa
  s = s.replace(/'/g, '"') // bitta qo'shtirnoqlarni ikkilamchiga
  s = s.replace(/,(\s*[}\]])/g, '$1') // oxirgi vergullar
  return s
}

/** Firebase push sozlamasi — yuborish (service account) + web (PWA) push olish (web config + VAPID). */
export function FirebaseSettings() {
  const [json, setJson] = useState('')
  const [webJson, setWebJson] = useState('')
  const [vapid, setVapid] = useState('')
  const [configured, setConfigured] = useState(false)
  const [webConfigured, setWebConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFirebaseSettings()
      .then((c: FirebaseConfig) => {
        setJson(c.serviceAccountJson)
        setWebJson(c.webConfigJson)
        setVapid(c.vapidKey)
        setConfigured(c.configured)
        setWebConfigured(c.webConfigured)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    // Web config'ni JSON'ga normallashtiramiz (Firebase JS snippet'ini ham qabul qilamiz).
    const webNormalized = toJsonObject(webJson)
    if (webNormalized) {
      try {
        JSON.parse(webNormalized)
      } catch {
        setStatus('idle')
        setError("Web app config noto'g'ri — Firebase Console'dagi firebaseConfig obyektini ({ ... }) to'liq qo'ying.")
        return
      }
    }
    try {
      const saved = await saveFirebaseSettings({
        serviceAccountJson: json.trim(),
        webConfigJson: webNormalized,
        vapidKey: vapid.trim(),
      })
      setJson(saved.serviceAccountJson)
      setWebJson(saved.webConfigJson)
      setVapid(saved.vapidKey)
      setConfigured(saved.configured)
      setWebConfigured(saved.webConfigured)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e: unknown) {
      setStatus('idle')
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Saqlab bo'lmadi — service account yoki web config JSON noto'g'ri."
      setError(msg)
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  const StatusChip = ({ ok, label }: { ok: boolean; label: string }) =>
    ok ? (
      <Badge tone="green">
        <CheckCircle2 className="h-3.5 w-3.5" /> {label}
      </Badge>
    ) : (
      <Badge tone="default">
        <XCircle className="h-3.5 w-3.5" /> {label}
      </Badge>
    )

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          Push (Firebase)
          <StatusChip ok={configured} label={configured ? 'Yuborish sozlangan' : 'Yuborish sozlanmagan'} />
          <StatusChip ok={webConfigured} label={webConfigured ? 'Web push sozlangan' : 'Web push sozlanmagan'} />
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Bildirishnoma (push) uchun Firebase sozlamalari. <b>Service account</b> — push yuborish uchun
        (server). <b>Web app config + VAPID</b> — web (PWA: o'qituvchi sayti) brauzerda bildirishnoma
        olishi uchun. Bitta Firebase loyiha barcha ilovalar uchun ishlaydi.
      </p>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Service account (JSON) — push <b>yuborish</b>
          </label>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Web app config (JSON) — web push <b>olish</b>
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Firebase Console → Project Settings → General → Your apps → <b>Web app</b> (yo'q bo'lsa
            "Add app" → Web) → "SDK setup and configuration" → <code>firebaseConfig</code> obyektini
            (apiKey, authDomain, projectId, messagingSenderId, appId) JSON ko'rinishida shu yerga qo'ying.
          </p>
          <Textarea
            value={webJson}
            onChange={(e) => setWebJson(e.target.value)}
            placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "messagingSenderId": "...", "appId": "..." }'
            spellCheck={false}
            className="h-32 font-mono text-xs"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">VAPID ochiq kaliti (Web Push)</label>
          <p className="mb-2 text-xs text-slate-400">
            Firebase Console → Project Settings → Cloud Messaging → "Web configuration" → "Web Push
            certificates" → Key pair (B... bilan boshlanadigan uzun matn).
          </p>
          <Input
            value={vapid}
            onChange={(e) => setVapid(e.target.value)}
            placeholder="BPxxxx…"
            spellCheck={false}
            className="font-mono text-xs"
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
