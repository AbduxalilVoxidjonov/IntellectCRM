import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, CheckCircle2, XCircle, Smartphone, Upload, Trash2, GraduationCap } from 'lucide-react'
import {
  getTelegramSettings,
  saveTelegramSettings,
  getAppApkSettings,
  uploadAppApk,
  deleteAppApk,
  type TelegramConfig,
  type AppApkConfig,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'

/** Telegram bot tokenini (ota-onalarga e'lon yuborish uchun) kiritadigan sozlama. */
export function TelegramSettings() {
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    getTelegramSettings()
      .then((c: TelegramConfig) => {
        setToken(c.botToken)
        setUsername(c.botUsername)
        setName(c.botName)
        setChannel(c.channel)
        setConfigured(c.configured)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    const saved = await saveTelegramSettings({
      botToken: token.trim(),
      botUsername: username.trim(),
      botName: name.trim(),
      channel: channel.trim(),
    })
    setConfigured(saved.configured)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  return (
    <div className="space-y-4">
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
          placeholder="Markaz LMS Bot"
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
          Ota-ona botni ochib (masalan {username ? `@${username}` : '@BotUsername'}) "Start" bossin va
          telefon raqamini ulashsin — raqami o'quvchining ota-ona raqami bilan solishtirilib, e'lon
          oluvchilar ro'yxatiga qo'shiladi.
        </div>

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

    <AppApkSection />
    </div>
  )
}

function fmtSize(bytes: number): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Ilova (APK) yuklash — Telegram bot ro'yxatdan o'tgan o'quvchi/o'qituvchiga yuboradi. */
function AppApkSection() {
  const [cfg, setCfg] = useState<AppApkConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'student' | 'teacher' | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getAppApkSettings()
      .then(setCfg)
      .finally(() => setLoading(false))
  }, [])

  const onUpload = async (role: 'student' | 'teacher', file: File) => {
    setErr('')
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setErr('Faqat .apk fayl yuklang')
      return
    }
    setBusy(role)
    try {
      setCfg(await uploadAppApk(role, file))
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(msg || 'Yuklashda xatolik (APK 50 MB dan oshmasin)')
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (role: 'student' | 'teacher') => {
    setBusy(role)
    try {
      setCfg(await deleteAppApk(role))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return null

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand-600" /> Ilova (APK)
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Bu yerga ilova (APK) faylini yuklang. Foydalanuvchi botda telefon raqamini yuborib,
        kanalga obuna bo'lganidan so'ng — o'quvchi yoki o'qituvchi ilovasini bot avtomatik yuboradi.
        Bittagina ilova bo'lsa, faqat bittasini yuklang (ikkala rol uchun ishlatiladi). Telegram chegarasi: 50 MB.
      </p>

      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <ApkSlot
          role="student"
          label="O'quvchi ilovasi"
          icon={<Smartphone className="h-4 w-4" />}
          name={cfg?.studentApkName ?? ''}
          size={cfg?.studentApkSize ?? 0}
          busy={busy === 'student'}
          onUpload={(f) => onUpload('student', f)}
          onDelete={() => onDelete('student')}
        />
        <ApkSlot
          role="teacher"
          label="O'qituvchi ilovasi"
          icon={<GraduationCap className="h-4 w-4" />}
          name={cfg?.teacherApkName ?? ''}
          size={cfg?.teacherApkSize ?? 0}
          busy={busy === 'teacher'}
          onUpload={(f) => onUpload('teacher', f)}
          onDelete={() => onDelete('teacher')}
        />
      </div>
    </Card>
  )
}

function ApkSlot({
  label,
  icon,
  name,
  size,
  busy,
  onUpload,
  onDelete,
}: {
  role: 'student' | 'teacher'
  label: string
  icon: ReactNode
  name: string
  size: number
  busy: boolean
  onUpload: (file: File) => void
  onDelete: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        {icon} {label}
      </div>
      {name ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-emerald-800">{name}</p>
            <p className="font-mono text-xs text-emerald-600">{fmtSize(size)}</p>
          </div>
          <button
            type="button"
            title="O'chirish"
            disabled={busy}
            onClick={onDelete}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-400">Hali yuklanmagan</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".apk"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="secondary"
        className="mt-3 w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" /> {busy ? 'Yuklanmoqda…' : name ? 'Almashtirish' : 'APK yuklash'}
      </Button>
    </div>
  )
}
