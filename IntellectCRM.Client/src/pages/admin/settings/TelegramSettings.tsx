import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CheckCircle2, XCircle } from 'lucide-react'
import {
  getTelegramSettings,
  saveTelegramSettings,
  type TelegramConfig,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/**
 * Telegram bot tokenini (ota-onalarga e'lon yuborish uchun) kiritadigan sozlama.
 * Zaxira nusxa va APK yuklash alohida bo'limlarga ajratilgan:
 * "Sozlamalar → Zaxira nusxa" va "Sozlamalar → Mobil ilova (APK)".
 */
export function TelegramSettings() {
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('')
  const [phoneMatchField, setPhoneMatchField] = useState<'parent' | 'student'>('parent')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    getTelegramSettings()
      .then((c: TelegramConfig) => {
        setToken(c.botToken ?? '')
        setUsername(c.botUsername ?? '')
        setName(c.botName ?? '')
        setChannel(c.channel ?? '')
        setPhoneMatchField(c.phoneMatchField === 'student' ? 'student' : 'parent')
        setConfigured(c.configured)
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    try {
      const saved = await saveTelegramSettings({
        botToken: (token ?? '').trim(),
        botUsername: (username ?? '').trim(),
        botName: (name ?? '').trim(),
        channel: (channel ?? '').trim(),
        phoneMatchField,
      })
      setConfigured(saved.configured)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      console.error('Telegram sozlamalarini saqlashda xato:', err)
      setStatus('idle')
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Telegram bot
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
        Bot orqali guruh ota-onalariga e'lon yuboriladi. Tokenni Telegramdagi{' '}
        <span className="font-medium text-slate-500">@BotFather</span> dan oling
        (/newbot → token). Token kiritilgandan so'ng bot avtomatik ishga tushadi.
      </p>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
        <Input
          label="Bot tokeni"
          placeholder="123456789:AAH..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Bot nomi (ko'rsatish uchun)"
          placeholder="IntellectCRM Bot"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Bot foydalanuvchi nomi (@username)"
          placeholder="MarkazBot"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
        />

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Ota-ona (yoki o'quvchi) botni ochib (masalan {username ? `@${username}` : '@BotUsername'}) "Start"
          bossin va telefon raqamini ulashsin — raqami pastdagi sozlamaga qarab solishtiriladi.
        </div>

        <Select
          label="Kontakt ulashilganda qaysi raqam bo'yicha tekshirilsin"
          value={phoneMatchField}
          onChange={(e) => setPhoneMatchField(e.target.value as 'parent' | 'student')}
        >
          <option value="parent">Ota-ona raqami</option>
          <option value="student">O'quvchining o'zi raqami</option>
        </Select>
        <p className="-mt-2 text-xs text-slate-400">
          "Ota-ona raqami" — botga ota-ona o'z raqamini yuborsa moslashadi (standart). "O'quvchining
          o'zi raqami" — bot orqali o'quvchi o'zi ro'yxatdan o'tsa, uning shaxsiy telefon raqami
          bilan solishtiriladi.
        </p>

        <div className="border-t border-slate-100 pt-4">
          <Input
            label="Telegram kanal (o'quvchi/o'qituvchi ilovasida ko'rinadi)"
            placeholder="@intellectschool yoki https://t.me/intellectschool"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-400">
            To'ldirilsa — o'quvchi va o'qituvchi ilovasida "Telegram kanalga o'tish" tugmasi chiqadi.
            Botdan alohida (markaz e'lonlari kanali).
          </p>
        </div>

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
