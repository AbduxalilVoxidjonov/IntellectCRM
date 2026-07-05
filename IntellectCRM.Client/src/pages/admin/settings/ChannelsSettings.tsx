import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EskizSettings } from './EskizSettings'
import { TelegramSettings } from './TelegramSettings'
import { FirebaseSettings } from './FirebaseSettings'

type ChannelTab = 'sms' | 'telegram' | 'firebase'

const tabs: { value: ChannelTab; label: string }[] = [
  { value: 'sms', label: 'SMS (Eskiz)' },
  { value: 'telegram', label: 'Telegram bot' },
  { value: 'firebase', label: 'Push (Firebase)' },
]

/**
 * "Xabar kanallari" — SMS (Eskiz), Telegram bot va Push (Firebase) sozlamalari bitta joyda,
 * ichki tab orqali almashtiriladi.
 */
export function ChannelsSettings({ initialTab = 'sms' }: { initialTab?: ChannelTab }) {
  const [tab, setTab] = useState<ChannelTab>(initialTab)

  return (
    <div className="space-y-4">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            onClick={() => setTab(t.value)}
            className={cn('tab', tab === t.value && 'active')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sms' && <EskizSettings />}
      {tab === 'telegram' && <TelegramSettings />}
      {tab === 'firebase' && <FirebaseSettings />}
    </div>
  )
}
