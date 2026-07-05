import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Plus, Trash2, Smartphone, Bell, MessageCircle, AlertTriangle } from 'lucide-react'
import {
  getAutoMessageTriggers,
  getAutoMessageRules,
  createAutoMessageRule,
  updateAutoMessageRule,
  deleteAutoMessageRule,
  audienceLabel,
  sendScopeOptions,
  scheduleTypeOptions,
  type AutoMessageTrigger,
  type AutoMessageRule,
  type AutoMessageRuleInput,
} from '@/api/services/autoMessages'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'
import { Select } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

type Ch = 'sms' | 'push' | 'telegram'
const CHANNEL_META: { key: Ch; label: string; icon: typeof Smartphone }[] = [
  { key: 'sms', label: 'SMS', icon: Smartphone },
  { key: 'push', label: 'Push', icon: Bell },
  { key: 'telegram', label: 'Telegram', icon: MessageCircle },
]

/** Avto xabarlar tab: hodisalar katalogi + har hodisaning qoidalari. */
export function AutoMessagesTab() {
  const [triggers, setTriggers] = useState<AutoMessageTrigger[]>([])
  const [rules, setRules] = useState<AutoMessageRule[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [err, setErr] = useState('')

  const reloadRules = () => getAutoMessageRules().then(setRules).catch(() => setRules([]))

  useEffect(() => {
    Promise.all([getAutoMessageTriggers(), getAutoMessageRules()])
      .then(([t, r]) => {
        setTriggers(t)
        setRules(r)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  const rulesByTrigger = useMemo(() => {
    const m = new Map<string, AutoMessageRule[]>()
    for (const r of rules) {
      const arr = m.get(r.trigger) ?? []
      arr.push(r)
      m.set(r.trigger, arr)
    }
    return m
  }, [rules])

  // Hodisa uchun standart yangi qoida (birinchi mavjud kanal yoqiq — SMS ustuvor).
  const buildDefaultRule = (t: AutoMessageTrigger): AutoMessageRuleInput => ({
    trigger: t.key,
    name: t.label,
    enabled: true,
    sendSms: t.channels.sms,
    sendPush: !t.channels.sms && t.channels.push,
    sendTelegram: !t.channels.sms && !t.channels.push && t.channels.telegram,
    audience: t.defaultAudience,
    template: t.defaultTemplate ?? '',
    offsetMinutes: 0,
    sendScope: t.supportsSendScope ? (sendScopeOptions[0]?.value ?? '') : '',
    scheduleType: t.supportsSchedule ? 'daily' : '',
    scheduleTime: t.supportsSchedule ? '09:00' : '',
    scheduleDayOfMonth: 1,
  })

  const addRule = async (t: AutoMessageTrigger) => {
    try {
      await createAutoMessageRule(buildDefaultRule(t))
      await reloadRules()
      setErr('')
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Qoida qo'shib bo'lmadi")
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  if (failed || triggers.length === 0) {
    return (
      <Card>
        <div className="flex items-start gap-2 text-sm text-slate-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            Avto xabar hodisalari topilmadi. Backend hali sozlanmagan bo'lishi mumkin — keyinroq
            qayta urinib ko'ring.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{err}</p>
          <button
            type="button"
            onClick={() => setErr('')}
            className="text-red-400 transition-colors hover:text-red-700"
            aria-label="Yopish"
          >
            ×
          </button>
        </div>
      )}
      {/* 2 ustun (katta ekranda) — sahifa juda uzun bo'lib ketmasligi uchun; items-start —
          yonma-yon kartalar bir-biriga qarab cho'zilmaydi. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {triggers.map((t) => {
        const trRules = rulesByTrigger.get(t.key) ?? []
        return (
          <Card
            key={t.key}
            title={
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-500" />
                {t.label}
              </span>
            }
            sub={t.description}
            actions={
              <button
                type="button"
                onClick={() => addRule(t)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Plus className="h-3.5 w-3.5" /> Qoida qo'shish
              </button>
            }
          >
            {trRules.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge>Sozlanmagan</Badge>
                  <span className="text-sm text-slate-500">
                    Bu hodisada avtomatik xabar yuborilmaydi.
                  </span>
                </div>
                <Button variant="secondary" onClick={() => addRule(t)}>
                  <Plus className="h-4 w-4" /> Yoqish
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {trRules.map((r) => (
                  <RuleCard
                    key={r.id}
                    rule={r}
                    trigger={t}
                    onSaved={reloadRules}
                    onDeleted={reloadRules}
                  />
                ))}
              </div>
            )}
          </Card>
        )
      })}
      </div>
    </div>
  )
}

/** Bitta avto xabar qoidasi kartasi — o'z draft holatini boshqaradi, "Saqlash" bilan yozadi. */
function RuleCard({
  rule,
  trigger,
  onSaved,
  onDeleted,
}: {
  rule: AutoMessageRule
  trigger: AutoMessageTrigger
  onSaved: () => Promise<void> | void
  onDeleted: () => Promise<void> | void
}) {
  const [draft, setDraft] = useState<AutoMessageRule>(rule)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setDraft(rule), [rule])

  const set = <K extends keyof AutoMessageRule>(k: K, v: AutoMessageRule[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setSaved(false)
  }

  const toggleEnabled = async () => {
    const next = { ...draft, enabled: !draft.enabled }
    setDraft(next)
    setSaving(true)
    try {
      await updateAutoMessageRule(rule.id, toInput(next))
      await onSaved()
      setError('')
    } catch (e: any) {
      setDraft(draft)
      setError(e?.response?.data?.message || "O'zgartirib bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const insertToken = (token: string) => {
    const el = textRef.current
    if (!el) {
      set('template', draft.template + token)
      return
    }
    const start = el.selectionStart ?? draft.template.length
    const end = el.selectionEnd ?? draft.template.length
    const next = draft.template.slice(0, start) + token + draft.template.slice(end)
    set('template', next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateAutoMessageRule(rule.id, toInput(draft))
      setSaved(true)
      setError('')
      await onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.message || "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm("Bu qoidani o'chirasizmi?")) return
    setSaving(true)
    try {
      await deleteAutoMessageRule(rule.id)
      await onDeleted()
    } finally {
      setSaving(false)
    }
  }

  const channelFlag: Record<Ch, keyof AutoMessageRule> = {
    sms: 'sendSms',
    push: 'sendPush',
    telegram: 'sendTelegram',
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        draft.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50',
      )}
    >
      {/* Sarlavha: faol toggle (birlashgan pill — switch + holat matni) + o'chirish */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-xs font-semibold transition-all',
            draft.enabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600',
          )}
        >
          <span
            className={cn(
              'relative h-4 w-7 shrink-0 rounded-full transition-colors',
              draft.enabled ? 'bg-emerald-500' : 'bg-slate-300',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
                draft.enabled ? 'translate-x-3.5' : 'translate-x-0.5',
              )}
            />
          </span>
          {draft.enabled ? 'Faol' : "O'chirilgan"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs font-medium text-red-600">{error}</span>}
          {!error && saved && <span className="text-xs font-medium text-emerald-600">Saqlandi</span>}
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Qoidani o'chirish"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Kanallar + auditoriya + reja/scope */}
        <div className="space-y-3">
          {/* Kanal chiplari (faqat mavjudlari) */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Kanallar</p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNEL_META.filter((c) => trigger.channels[c.key]).map((c) => {
                const flag = channelFlag[c.key]
                const on = draft[flag] as boolean
                const Icon = c.icon
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => set(flag, !on as never)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      on
                        ? 'border-brand-400 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <Icon className="h-3 w-3" /> {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Auditoriya */}
          {trigger.audiences.length > 0 && (
            <Select
              label="Kimga"
              value={draft.audience}
              onChange={(e) => set('audience', e.target.value)}
              className="w-full"
            >
              {trigger.audiences.map((a) => (
                <option key={a} value={a}>
                  {audienceLabel(a)}
                </option>
              ))}
            </Select>
          )}

          {/* Yuborish qamrovi + offset */}
          {trigger.supportsSendScope && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Qamrov"
                value={draft.sendScope}
                onChange={(e) => set('sendScope', e.target.value)}
                className="w-full"
              >
                {sendScopeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">Surilish (daq)</span>
                <input
                  type="number"
                  value={draft.offsetMinutes}
                  onChange={(e) => set('offsetMinutes', Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>
          )}

          {/* Reja */}
          {trigger.supportsSchedule && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Reja"
                value={draft.scheduleType}
                onChange={(e) => set('scheduleType', e.target.value)}
                className="w-full"
              >
                {scheduleTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">Vaqt</span>
                <input
                  type="time"
                  value={draft.scheduleTime}
                  onChange={(e) => set('scheduleTime', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              {draft.scheduleType === 'monthly' && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600">Oy kuni (1-28)</span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={draft.scheduleDayOfMonth}
                    onChange={(e) => set('scheduleDayOfMonth', Number(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* O'ng: shablon matn + tokenlar */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Xabar matni</p>
          <textarea
            ref={textRef}
            className="h-28 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            value={draft.template}
            onChange={(e) => set('template', e.target.value)}
            placeholder="Xabar matni — o'rinbosarlar bilan"
          />
          {trigger.tokens.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trigger.tokens.map((tk) => (
                <button
                  key={tk}
                  type="button"
                  onClick={() => insertToken(tk)}
                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {tk}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-3">
            {trigger.tokens.length > 0 && !draft.template.trim() && (
              <span className="text-xs text-amber-600">Xabar matni bo'sh bo'lmasligi kerak</span>
            )}
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** AutoMessageRule → yozish uchun input (id/createdAt siz). */
function toInput(r: AutoMessageRule): AutoMessageRuleInput {
  const { id: _id, createdAt: _createdAt, ...rest } = r
  return rest
}
