import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import { getGeminiSettings, saveGeminiSettings, type GeminiConfig } from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/**
 * AI Tahlil (Google Gemini) sozlamasi — API kaliti.
 * Kiritilgach, har o'quvchi profilidagi "AI Tahlil" tugmasi o'quvchining barcha
 * ma'lumotlarini Gemini orqali tahlil qilib, o'zbek tilida xulosa+tavsiya beradi.
 * Model env o'zgaruvchi GEMINI_MODEL dan olinadi (default gemini-3.1-flash-lite).
 */
export function GeminiSettings() {
  const [key, setKey] = useState('')
  const [model, setModel] = useState('gemini-3.1-flash-lite')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeminiSettings()
      .then((c: GeminiConfig) => {
        setModel(c.model)
        setConfigured(c.configured)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      const saved = await saveGeminiSettings({ key: (key ?? '').trim() || undefined })
      setModel(saved.model)
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
          <Sparkles className="h-4 w-4 text-brand-600" /> AI Tahlil (Gemini)
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
        Har o'quvchi profilida <b>"AI Tahlil"</b> tugmasi bo'ladi: bosilganda o'quvchining barcha
        ma'lumotlari (baholar, davomat, intizom, topshiriqlar, baholash, balans) <b>Google Gemini</b>{' '}
        orqali tahlil qilinib, o'zbek tilida xulosa va tavsiyalar beriladi. Kalit kiritilmasa AI tahlil
        ishlamaydi. Kalit <b>Google AI Studio → Get API key</b> (aistudio.google.com/app/apikey) dan olinadi.
      </p>

      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">API kaliti (API key)</label>
          <p className="mb-2 text-xs text-slate-400">
            {configured
              ? 'Allaqachon saqlangan. O‘zgartirish uchun yangi kalitni kiriting (bo‘sh qoldirsangiz eski saqlanadi).'
              : 'Gemini API kalitini kiriting (AIza... bilan boshlanadi).'}
          </p>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={configured ? '•••••••• (saqlangan)' : 'AIzaSy...'}
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
          <p className="mb-2 text-xs text-slate-400">
            Server <code className="rounded bg-slate-100 px-1">GEMINI_MODEL</code> env o'zgaruvchisidan olinadi
            (o'zgartirish uchun serverda sozlanadi).
          </p>
          <Input value={model} readOnly disabled className="max-w-[280px] font-mono text-xs" />
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
