import { useEffect, useState } from 'react'
import { Check, Receipt as ReceiptIcon } from 'lucide-react'
import {
  getCheckSettings,
  saveCheckSettings,
  getSchoolInfo,
  type SchoolInfo,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'
import {
  parseCheckSettings,
  checkFieldLabels,
  type CheckSettings as CheckSettingsModel,
  type CheckFieldFlags,
} from '@/config/checkSettings'
import { receiptHtml, receiptCss, type ReceiptData } from '@/lib/receipt'

/** Sozlamalar o'zgarganda jonli ko'rsatiladigan namuna chek. */
const sampleBase = {
  receiptNo: '693096843',
  dateTime: '2026-06-30 15:00',
  studentName: "Azamjon Qo'chqorov",
  teacherName: 'Odilov Azizbek',
  responsibleName: 'Vohidjonov Abduhalil',
  groupName: 'A100',
  method: 'cash',
  comment: "Oylik to'lov",
  total: 200000,
}

/** Yoqish/o'chirish qatori (checkbox). */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
      <span className="text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-600"
      />
    </label>
  )
}

/**
 * To'lov cheki (termal kvitansiya) sozlamalari. Qaysi maydonlar ko'rinishi, sarlavha (logotip/nom),
 * pastki izoh, aloqa/QR — o'ng tarafda jonli namuna bilan. Saqlanganda CenterMeta.CheckSettings (JSON).
 */
export function CheckSettings() {
  const [s, setS] = useState<CheckSettingsModel | null>(null)
  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    Promise.all([getCheckSettings(), getSchoolInfo()])
      .then(([json, info]) => {
        setS(parseCheckSettings(json))
        setSchool(info)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!s) return
    setStatus('saving')
    try {
      await saveCheckSettings(JSON.stringify(s))
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('idle')
    }
  }

  if (loading || !s) return <Loader label="Yuklanmoqda..." />

  const setField = (key: keyof CheckFieldFlags, v: boolean) =>
    setS({ ...s, fields: { ...s.fields, [key]: v } })

  const preview: ReceiptData = {
    ...sampleBase,
    centerName: school?.name || 'Intellect',
    centerPhone: school?.phone || '+998 90 123 45 67',
    centerAddress: school?.address || 'Toshkent sh.',
    logoUrl: school?.logoUrl || '',
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ReceiptIcon className="h-4 w-4 text-brand-600" /> To'lov cheki (kvitansiya)
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        To'lov kiritilganda chiqadigan <b>termal chek</b> (58/80mm) ko'rinishini sozlang. Maydonlarni
        yoqib/o'chiring — o'ng tarafda namuna real vaqtda yangilanadi. Chek Moliya bo'limida "Chek" tugmasi
        bilan yoki to'lov kiritilgach avtomatik bosib chiqariladi.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chap: sozlamalar */}
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sarlavha</h4>
            <div className="space-y-2">
              <Toggle checked={s.showLogo} onChange={(v) => setS({ ...s, showLogo: v })} label="Markaz logotipi" />
              <Toggle checked={s.showName} onChange={(v) => setS({ ...s, showName: v })} label="Markaz nomi" />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Maydonlar (qaysi qatorlar ko'rinsin)
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {checkFieldLabels.map((f) => (
                <Toggle
                  key={f.key}
                  checked={s.fields[f.key]}
                  onChange={(v) => setField(f.key, v)}
                  label={f.label}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">"Jami" (to'lov summasi) doim ko'rinadi.</p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Past qismi</h4>
            <div className="space-y-3">
              <Toggle
                checked={s.showContact}
                onChange={(v) => setS({ ...s, showContact: v })}
                label="Aloqa (markaz telefoni + manzili)"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Pastki izoh (footer)</label>
                <Input
                  value={s.footerText}
                  onChange={(e) => setS({ ...s, footerText: e.target.value })}
                  placeholder="Tashrifingiz uchun rahmat!"
                />
              </div>
              <Toggle checked={s.showQr} onChange={(v) => setS({ ...s, showQr: v })} label="QR kod" />
              {s.showQr && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">QR matni / havola</label>
                  <Input
                    value={s.qrText}
                    onChange={(e) => setS({ ...s, qrText: e.target.value })}
                    placeholder="Bo'sh = markaz telefoni"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={status === 'saving'}>
              {status === 'saving' ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
            {status === 'saved' && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" /> Saqlandi
              </span>
            )}
          </div>
        </div>

        {/* O'ng: jonli namuna */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Namuna</h4>
          <div className={cn('flex justify-center rounded-xl bg-slate-100 py-5')}>
            <style>{receiptCss}</style>
            <div
              className="receipt shadow-md"
              dangerouslySetInnerHTML={{ __html: receiptHtml(preview, s) }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
