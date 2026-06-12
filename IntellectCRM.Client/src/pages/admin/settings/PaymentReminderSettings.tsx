import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CheckCircle2, XCircle, Info } from 'lucide-react'
import {
  getPaymentReminderSettings,
  savePaymentReminderSettings,
  type PaymentReminderConfig,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'

/**
 * Avtomatik to'lov eslatmasi sozlamasi. Yoqilgan bo'lsa, fon xizmati har oyning 1-sanasida BARCHA
 * qarzdorlarga (balansi manfiy), keyin har 2 kunda hali to'lamaganlarga Telegram + push orqali
 * batafsil eslatma yuboradi (ertalab 09:00, Toshkent vaqti). O'quvchi qarzini to'lasa to'xtaydi.
 */
export function PaymentReminderSettings() {
  const [cfg, setCfg] = useState<PaymentReminderConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    getPaymentReminderSettings().then(setCfg).finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cfg) return
    setStatus('saving')
    const saved = await savePaymentReminderSettings({ enabled: cfg.enabled })
    setCfg(saved)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  if (loading || !cfg) return <Loader label="Yuklanmoqda..." />

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            Avtomatik to'lov eslatmasi
            {cfg.enabled ? (
              <Badge tone="green">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yoqilgan
              </Badge>
            ) : (
              <Badge tone="default">
                <XCircle className="h-3.5 w-3.5" /> O'chiq
              </Badge>
            )}
          </span>
        }
      >
        <p className="mb-4 text-sm text-slate-400">
          Qarzdor o'quvchilarga (balansi manfiy) avtomatik eslatma yuboriladi — Telegram va ilova
          (push) orqali.
        </p>

        <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Avtomatik to'lov eslatmasini yoqish
        </label>

        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-500">Qanday ishlaydi:</div>
          <ul className="list-inside list-disc space-y-1">
            <li>Har oyning <b>1-sanasida</b> barcha qarzdorlarga eslatma yuboriladi.</li>
            <li>Keyin <b>har 2 kunda</b> (3, 5, 7-...) hali to'lamaganlarga takror yuboriladi.</li>
            <li>O'quvchi qarzini to'lasa — eslatma <b>to'xtaydi</b>.</li>
            <li>Xabar batafsil: har kurs bo'yicha qarz + jami summa. Yuborish vaqti — ertalab <b>09:00</b>.</li>
          </ul>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-400">
          <Info className="h-4 w-4" /> Telegram boti va Firebase (push) sozlangan bo'lsa har ikkala
          kanaldan ham yuboriladi.
        </p>
      </Card>

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
  )
}
