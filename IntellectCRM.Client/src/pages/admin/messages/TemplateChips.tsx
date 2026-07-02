import { useEffect, useState } from 'react'
import { getAllMessageTemplates, type UnifiedTemplate } from '@/api/services/messages'
import { messageTemplates } from '@/config/messageTemplates'
import { cn } from '@/lib/utils'

/**
 * "Tayyor matnlar" bloki — uchala yuborish oynasida (E'lon / Push / SMS) bir xil.
 * Tarkibi: ichki hardcode andozalar (`messageTemplates`) + backend birlashgan ro'yxati
 * (SMS andozalari + matnli eslatma qoidalari). Chip bosilganda `onPick(text, name)` chaqiriladi
 * (E'lon/SMS faqat matnni, Push esa sarlavha + matnni oladi).
 * Fragment qaytaradi — chaqiruvchi flex-wrap konteynerini o'zi beradi (Tozalash tugmasi bilan yonma-yon).
 */
export function TemplateChips({ onPick }: { onPick: (text: string, name: string) => void }) {
  const [remote, setRemote] = useState<UnifiedTemplate[]>([])

  useEffect(() => {
    getAllMessageTemplates()
      .then(setRemote)
      .catch(() => setRemote([]))
  }, [])

  return (
    <>
      {messageTemplates.map((t) => (
        <button
          key={`builtin-${t.label}`}
          type="button"
          onClick={() => onPick(t.text, t.label)}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          {t.label}
        </button>
      ))}
      {remote.map((t, i) => (
        <button
          key={`${t.source}-${i}-${t.name}`}
          type="button"
          onClick={() => onPick(t.text, t.name)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          title={t.text}
        >
          {t.name}
          <span
            className={cn(
              'rounded px-1 py-px text-[10px] font-semibold leading-none',
              t.source === 'sms' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700',
            )}
          >
            {t.source === 'sms' ? 'SMS' : 'Eslatma'}
          </span>
        </button>
      ))}
    </>
  )
}
