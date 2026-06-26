import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, CheckCircle2, XCircle, Smartphone, Upload, Trash2, GraduationCap, Database, Send, Clock } from 'lucide-react'
import {
  getTelegramSettings,
  saveTelegramSettings,
  getAppApkSettings,
  uploadAppApk,
  deleteAppApk,
  getTelegramBackupConfig,
  saveTelegramBackupConfig,
  testTelegramBackup,
  runTelegramBackup,
  type TelegramConfig,
  type AppApkConfig,
  type TelegramBackupConfig,
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
        setToken(c.botToken ?? '')
        setUsername(c.botUsername ?? '')
        setName(c.botName ?? '')
        setChannel(c.channel ?? '')
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

    {configured && <TelegramBackupSection />}
    <AppApkSection />
    </div>
  )
}

/** Axios xato javobidan backend xabarini ajratib oladi ({ message } yoki { error }). */
function backendMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data
  return data?.message || data?.error || ''
}

function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Telegram orqali kunlik DB backup — bot sozlangan bo'lsa ko'rinadi. */
function TelegramBackupSection() {
  const [cfg, setCfg] = useState<TelegramBackupConfig>({
    adminChatId: '',
    scheduleHour: 21,
    scheduleMinute: 0,
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [testing, setTesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [chatIdError, setChatIdError] = useState('')

  useEffect(() => {
    getTelegramBackupConfig()
      .then(setCfg)
      .finally(() => setLoading(false))
  }, [])

  const validateChatId = (val: string) => {
    const v = (val ?? '').trim()
    if (!v) return ''
    if (!/^-?\d{9,}$/.test(v)) return "Chat ID faqat raqamdan iborat bo'lishi va kamida 9 ta raqam bo'lishi kerak"
    return ''
  }

  const onChatIdChange = (val: string) => {
    setCfg((p) => ({ ...p, adminChatId: val }))
    setChatIdError(validateChatId(val))
    setTestResult(null)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateChatId(cfg.adminChatId)
    if (err) { setChatIdError(err); return }
    setStatus('saving')
    setTestResult(null)
    try {
      const updated = await saveTelegramBackupConfig(cfg)
      setCfg({ ...updated, adminChatId: updated.adminChatId ?? '' })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e) {
      setStatus('idle')
      setTestResult({ success: false, message: backendMessage(e) || 'Saqlashda xatolik' })
    }
  }

  const onTest = async () => {
    const err = validateChatId(cfg.adminChatId)
    if (err) { setChatIdError(err); return }
    if (!(cfg.adminChatId ?? '').trim()) { setChatIdError("Chat ID kiriting"); return }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testTelegramBackup()
      setTestResult(res)
    } catch (e) {
      setTestResult({ success: false, message: backendMessage(e) || "So'rov yuborishda xatolik" })
    } finally {
      setTesting(false)
    }
  }

  // Backupni HOZIR yuborish (markaz ma'lumotlari JSON qilib Telegram orqali adminga).
  const onRunBackup = async () => {
    const err = validateChatId(cfg.adminChatId)
    if (err) { setChatIdError(err); return }
    if (!(cfg.adminChatId ?? '').trim()) { setChatIdError("Chat ID kiriting"); return }
    setRunning(true)
    setTestResult(null)
    try {
      const res = await runTelegramBackup()
      setTestResult(res)
    } catch (e) {
      setTestResult({ success: false, message: backendMessage(e) || "Backup yuborishda xatolik" })
    } finally {
      setRunning(false)
    }
  }

  if (loading) return null

  const canSave = !chatIdError && status !== 'saving'

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Database className="h-4 w-4 text-brand-600" /> Telegram Backup
        </span>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Har kuni belgilangan vaqtda ma'lumotlar bazasi zaxirasi Telegram orqali admin chatiga yuboriladi.
        Chat ID'ni bilish uchun Telegramda{' '}
        <span className="font-medium text-slate-500">@userinfobot</span>'ga /start yuboring.
      </p>

      <form onSubmit={onSave} className="max-w-2xl space-y-4">
        {/* Enabled toggle */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Backup yuborish</p>
            <p className="text-xs text-slate-400">Yoqilsa — har kuni belgilangan soatda yuboriladi</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cfg.enabled}
            onClick={() => setCfg((p) => ({ ...p, enabled: !p.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none ${
              cfg.enabled ? 'bg-brand-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                cfg.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Admin Chat ID */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Admin Chat ID
          </label>
          <input
            type="text"
            placeholder="123456789"
            value={cfg.adminChatId}
            onChange={(e) => onChatIdChange(e.target.value)}
            className={`block w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
              chatIdError
                ? 'border-red-400 bg-red-50 focus:ring-red-300/30'
                : 'border-slate-200 bg-white focus:border-brand-500'
            }`}
          />
          {chatIdError ? (
            <p className="text-xs text-red-600">{chatIdError}</p>
          ) : (
            <p className="text-xs text-slate-400">
              @userinfobot Telegram'da /start yuboring — chat ID'ngizni ko'rsatadi
            </p>
          )}
        </div>

        {/* Schedule hour + minute */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" /> Kunlik backup vaqti (soat:daqiqa)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={cfg.scheduleHour}
              onChange={(e) => {
                const h = Math.max(0, Math.min(23, Number(e.target.value) || 0))
                setCfg((p) => ({ ...p, scheduleHour: h }))
              }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-lg font-semibold text-slate-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={cfg.scheduleMinute}
              onChange={(e) => {
                const mm = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                setCfg((p) => ({ ...p, scheduleMinute: mm }))
              }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-sm text-slate-500">
              {String(cfg.scheduleHour).padStart(2, '0')}:{String(cfg.scheduleMinute).padStart(2, '0')} (UTC)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Soat 0-23, daqiqa 0-59 (UTC). Toshkent = UTC+5 — masalan 02:30 Toshkent uchun 21:30.
          </p>
        </div>

        {/* Last sent info */}
        {cfg.lastSentAt && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Oxirgi backup yuborildi: {fmtDateTime(cfg.lastSentAt)}</span>
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSave}>
            {status === 'saving' ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testing || running || !(cfg.adminChatId ?? '').trim()}
            onClick={onTest}
          >
            <Send className="h-4 w-4" />
            {testing ? 'Yuborilmoqda...' : 'Test xabar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={running || testing || !(cfg.adminChatId ?? '').trim()}
            onClick={onRunBackup}
            title="Markaz ma'lumotlarini JSON qilib hozir Telegram'ga yuboradi"
          >
            <Database className="h-4 w-4" />
            {running ? 'Yuborilmoqda...' : 'Backupni hozir yuborish'}
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
