import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Plus, Trash2, AlertTriangle } from 'lucide-react'
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
import { CHANNEL_LIST, type ChannelKey } from '@/config/channels'
import { MessageEditor } from '@/components/messaging/MessageEditor'
import { SmsProviderPicker } from '@/components/messaging/SmsProviderPicker'

type Ch = ChannelKey

/** Bo'limlar tartibi (trigger.category bo'yicha guruhlash). */
const CATEGORY_ORDER = ['Lidlar', "O'quv jarayoni", 'Moliya', 'Boshqa'] as const

/** Backend `category` bermasa — client-side fallback xarita. */
const CATEGORY_FALLBACK: Record<string, string> = {
  lead_new: 'Lidlar',
  trial_reminder: 'Lidlar',
  test_link: 'Lidlar',
  test_result: 'Lidlar',
  student_added: "O'quv jarayoni",
  attendance_absent: "O'quv jarayoni",
  lesson_attendance: "O'quv jarayoni",
  birthday: "O'quv jarayoni",
  grade_entered: "O'quv jarayoni",
  payment_received: 'Moliya',
  monthly_charge: 'Moliya',
  payment_debt: 'Moliya',
}

/** Trigger qaysi bo'limga tegishli (server category → fallback → "Boshqa"). */
function triggerCategory(t: AutoMessageTrigger): string {
  const c = t.category || CATEGORY_FALLBACK[t.key] || 'Boshqa'
  return (CATEGORY_ORDER as readonly string[]).includes(c) ? c : 'Boshqa'
}

/** Avto xabarlar tab: hodisalar katalogi + har hodisaning qoidalari. */
export function AutoMessagesTab({ highlightRuleId }: { highlightRuleId?: string | null } = {}) {
  const [triggers, setTriggers] = useState<AutoMessageTrigger[]>([])
  const [rules, setRules] = useState<AutoMessageRule[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [err, setErr] = useState('')
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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

  // "Xabar yuborish" tabidan "Sozlash" bosilганda shu qoidaga scroll qilish.
  useEffect(() => {
    if (!highlightRuleId) return
    const el = cardRefs.current.get(highlightRuleId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [rules, highlightRuleId])

  const rulesByTrigger = useMemo(() => {
    const m = new Map<string, AutoMessageRule[]>()
    for (const r of rules) {
      const arr = m.get(r.trigger) ?? []
      arr.push(r)
      m.set(r.trigger, arr)
    }
    return m
  }, [rules])

  // Trigger kartalarini bo'limlarga ajratamiz (Lidlar / O'quv jarayoni / Moliya / Boshqa)
  const triggersByCategory = useMemo(() => {
    const m = new Map<string, AutoMessageTrigger[]>()
    for (const t of triggers) {
      const cat = triggerCategory(t)
      const arr = m.get(cat) ?? []
      arr.push(t)
      m.set(cat, arr)
    }
    return m
  }, [triggers])

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
    smsProvider: 'eskiz',
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
      {/* Bo'limlar: Lidlar / O'quv jarayoni / Moliya / Boshqa */}
      {CATEGORY_ORDER.filter((cat) => (triggersByCategory.get(cat) ?? []).length > 0).map((cat) => (
        <section key={cat}>
          <h3 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            {cat}
          </h3>
          {/* 2 ustun (katta ekranda) — sahifa juda uzun bo'lib ketmasligi uchun; items-start —
              yonma-yon kartalar bir-biriga qarab cho'zilmaydi. */}
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {(triggersByCategory.get(cat) ?? []).map((t) => {
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
                    highlight={highlightRuleId === r.id}
                    registerRef={(el) => {
                      if (el) cardRefs.current.set(r.id, el)
                      else cardRefs.current.delete(r.id)
                    }}
                  />
                ))}
              </div>
            )}
          </Card>
        )
      })}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Bitta avto xabar qoidasi kartasi — o'z draft holatini boshqaradi, "Saqlash" bilan yozadi. */
function RuleCard({
  rule,
  trigger,
  onSaved,
  onDeleted,
  highlight,
  registerRef,
}: {
  rule: AutoMessageRule
  trigger: AutoMessageTrigger
  onSaved: () => Promise<void> | void
  onDeleted: () => Promise<void> | void
  highlight?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}) {
  const [draft, setDraft] = useState<AutoMessageRule>(rule)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showRing, setShowRing] = useState(false)

  useEffect(() => setDraft(rule), [rule])

  // Vaqtincha ring-highlight: "Xabar yuborish"dan "Sozlash" bosilganda 2.5s yonib so'nadi.
  useEffect(() => {
    if (!highlight) return
    setShowRing(true)
    const t = setTimeout(() => setShowRing(false), 2500)
    return () => clearTimeout(t)
  }, [highlight])

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
      ref={registerRef}
      className={cn(
        'rounded-xl border p-4 transition-shadow',
        draft.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50',
        showRing && 'ring-2 ring-brand-400 ring-offset-2',
      )}
    >
      {/* Sarlavha: nozik switch + holat matni (kam bezakli — matn kartaning asosiy fokusi qolishi uchun) + o'chirish */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={draft.enabled}
          onClick={toggleEnabled}
          disabled={saving}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60',
            draft.enabled ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              draft.enabled ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
        <span
          className={cn(
            'text-xs font-medium',
            draft.enabled ? 'text-emerald-600' : 'text-slate-400',
          )}
        >
          {draft.enabled ? 'Yoqilgan' : "O'chirilgan"}
        </span>
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
              {CHANNEL_LIST.filter((c) => trigger.channels[c.key]).map((c) => {
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

          {draft.sendSms && (
            <SmsProviderPicker
              provider={draft.smsProvider === 'local' ? 'local' : 'eskiz'}
              onProviderChange={(p) => set('smsProvider', p)}
              agentId=""
              onAgentChange={() => {}}
              allowAgentOverride={false}
            />
          )}

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

        {/* O'ng: shablon matn + tokenlar (server-driven — trigger.tokens) */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Xabar matni</p>
          <MessageEditor
            value={draft.template}
            onChange={(v) => set('template', v)}
            tokens={trigger.tokens.map((tk) => ({ token: tk, label: tk }))}
            showSmsCounter={draft.sendSms}
            rows={4}
            placeholder="Xabar matni — o'rinbosarlar bilan"
          />
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
