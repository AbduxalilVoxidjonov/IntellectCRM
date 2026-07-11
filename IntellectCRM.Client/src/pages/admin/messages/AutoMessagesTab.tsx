import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, AlertTriangle, Pencil, Sparkles } from 'lucide-react'
import {
  getAutoMessageTriggers,
  getAutoMessageRules,
  createAutoMessageRule,
  updateAutoMessageRule,
  deleteAutoMessageRule,
  seedStandardSms,
  getMessageTokens,
  audienceLabel,
  sendScopeOptions,
  scheduleTypeOptions,
  type AutoMessageTrigger,
  type AutoMessageRule,
  type AutoMessageRuleInput,
  type MessageToken,
} from '@/api/services/autoMessages'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Loader } from '@/components/ui/Loader'
import { Select, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn, apiErrorMessage } from '@/lib/utils'
import { CHANNEL_LIST, CHANNELS, type ChannelKey } from '@/config/channels'
import { MessageEditor } from '@/components/messaging/MessageEditor'
import { SmsProviderPicker } from '@/components/messaging/SmsProviderPicker'

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

/** Qoidaning YAGONA kanali (bitta kanal modeli): birinchi yoqilgan — sms > telegram > push. */
function ruleChannel(r: Pick<AutoMessageRule, 'sendSms' | 'sendTelegram' | 'sendPush'>): ChannelKey {
  if (r.sendSms) return 'sms'
  if (r.sendTelegram) return 'telegram'
  return 'push'
}

/** Trigger uchun mavjud kanallar (yagona tartibda). */
function availableChannels(t: AutoMessageTrigger | undefined): ChannelKey[] {
  if (!t) return ['sms']
  return CHANNEL_LIST.filter((c) => t.channels[c.key]).map((c) => c.key)
}

/**
 * "Xabar yaratish" tab: har bir avtomatik xabar ALOHIDA yaratiladi — bo'lim (hodisa) tanlanadi,
 * kimga yuborilishi, BITTA kanal (SMS / Telegram / Push) va matn (o'zgaruvchilar bilan) belgilanadi.
 * Kanal bitta bo'lgani uchun tasodifan boshqa kanaldan yuborilib ketmaydi.
 */
export function AutoMessagesTab({ highlightRuleId }: { highlightRuleId?: string | null } = {}) {
  const [triggers, setTriggers] = useState<AutoMessageTrigger[]>([])
  const [rules, setRules] = useState<AutoMessageRule[]>([])
  const [allTokens, setAllTokens] = useState<MessageToken[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [err, setErr] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')
  /** Modal: 'new' — yaratish; AutoMessageRule — tahrirlash; null — yopiq. */
  const [modal, setModal] = useState<'new' | AutoMessageRule | null>(null)

  const reloadRules = () => getAutoMessageRules().then(setRules).catch(() => setRules([]))

  useEffect(() => {
    Promise.all([getAutoMessageTriggers(), getAutoMessageRules(), getMessageTokens()])
      .then(([t, r, tk]) => {
        setTriggers(t)
        setRules(r)
        setAllTokens(tk)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  // "Xabar yuborish" tabidan "Sozlash" bosilganda shu qoidani tahrirlash uchun ochamiz.
  useEffect(() => {
    if (!highlightRuleId || rules.length === 0) return
    const r = rules.find((x) => x.id === highlightRuleId)
    if (r) setModal(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, highlightRuleId])

  const triggerByKey = useMemo(() => {
    const m = new Map<string, AutoMessageTrigger>()
    for (const t of triggers) m.set(t.key, t)
    return m
  }, [triggers])

  // Yaratilgan xabarlarni bo'limlarga ajratamiz.
  const rulesByCategory = useMemo(() => {
    const m = new Map<string, AutoMessageRule[]>()
    for (const r of rules) {
      const t = triggerByKey.get(r.trigger)
      const cat = t ? triggerCategory(t) : 'Boshqa'
      const arr = m.get(cat) ?? []
      arr.push(r)
      m.set(cat, arr)
    }
    return m
  }, [rules, triggerByKey])

  const doSeed = async () => {
    setSeeding(true)
    setSeedMsg('')
    setErr('')
    try {
      const { created } = await seedStandardSms()
      await reloadRules()
      setSeedMsg(
        created > 0
          ? `${created} ta tayyor SMS habar qo'shildi. Matnini kerak bo'lsa tahrirlang.`
          : "Barcha standart SMS habarlar allaqachon mavjud — yangi qo'shilmadi.",
      )
    } catch (e) {
      setErr(apiErrorMessage(e, "Namunaviy habarlarni qo'shib bo'lmadi"))
    } finally {
      setSeeding(false)
    }
  }

  const toggleEnabled = async (r: AutoMessageRule) => {
    try {
      await updateAutoMessageRule(r.id, { ...toInput(r), enabled: !r.enabled })
      await reloadRules()
    } catch (e) {
      setErr(apiErrorMessage(e, "O'zgartirib bo'lmadi"))
    }
  }

  const remove = async (r: AutoMessageRule) => {
    if (!window.confirm(`"${r.name || 'Xabar'}" o'chirilsinmi?`)) return
    try {
      await deleteAutoMessageRule(r.id)
      await reloadRules()
    } catch (e) {
      setErr(apiErrorMessage(e, "O'chirib bo'lmadi"))
    }
  }

  if (loading) return <Loader label="Yuklanmoqda..." />

  if (failed || triggers.length === 0) {
    return (
      <Card>
        <div className="flex items-start gap-2 text-sm text-slate-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>Avto xabar hodisalari topilmadi. Keyinroq qayta urinib ko'ring.</p>
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
          <button type="button" onClick={() => setErr('')} className="text-red-400 hover:text-red-700" aria-label="Yopish">
            ×
          </button>
        </div>
      )}
      {seedMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{seedMsg}</p>
          <button type="button" onClick={() => setSeedMsg('')} className="text-emerald-400 hover:text-emerald-700" aria-label="Yopish">
            ×
          </button>
        </div>
      )}

      {/* Sarlavha + amallar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Yaratilgan xabarlar ({rules.length})</h3>
          <p className="text-xs text-slate-500">
            Har xabar bitta hodisada, bitta kanaldan (SMS / Telegram / Push) yuboriladi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={doSeed} disabled={seeding}>
            <Sparkles className="h-4 w-4" /> {seeding ? 'Qo\'shilmoqda...' : 'Namunaviy SMS'}
          </Button>
          <Button onClick={() => setModal('new')}>
            <Plus className="h-4 w-4" /> Yangi xabar
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-full bg-brand-50 p-3">
              <Plus className="h-6 w-6 text-brand-500" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-700">Hali xabar yaratilmagan</h4>
              <p className="mt-1 text-sm text-slate-500">
                "Yangi xabar" bilan boshlang yoki tayyor SMS to'plamini qo'shing.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={doSeed} disabled={seeding}>
                <Sparkles className="h-4 w-4" /> Namunaviy SMS qo'shish
              </Button>
              <Button onClick={() => setModal('new')}>
                <Plus className="h-4 w-4" /> Yangi xabar
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        CATEGORY_ORDER.filter((cat) => (rulesByCategory.get(cat) ?? []).length > 0).map((cat) => (
          <section key={cat}>
            <h3 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">{cat}</h3>
            <div className="space-y-2">
              {(rulesByCategory.get(cat) ?? []).map((r) => {
                const t = triggerByKey.get(r.trigger)
                const ch = CHANNELS[ruleChannel(r)]
                const Icon = ch.icon
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-xl border p-3',
                      r.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50',
                    )}
                  >
                    {/* Yoqish/o'chirish switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.enabled}
                      onClick={() => toggleEnabled(r)}
                      className={cn(
                        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                        r.enabled ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                      title={r.enabled ? 'Yoqilgan' : "O'chirilgan"}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                          r.enabled ? 'translate-x-4' : 'translate-x-0.5',
                        )}
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('truncate font-semibold', r.enabled ? 'text-slate-800' : 'text-slate-400')}>
                          {r.name || t?.label || r.trigger}
                        </span>
                        <Badge tone={ch.tone}>
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3 w-3" /> {ch.label}
                          </span>
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {t?.label ?? r.trigger}
                        {t && t.audiences.length > 0 && <span> · {audienceLabel(r.audience)}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setModal(r)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        title="Tahrirlash"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="O'chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      {modal && (
        <MessageFormModal
          triggers={triggers}
          allTokens={allTokens}
          rule={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await reloadRules()
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

/** Yaratish/tahrirlash modali — bo'lim → hodisa → kimga → kanal → matn. */
function MessageFormModal({
  triggers,
  allTokens,
  rule,
  onClose,
  onSaved,
}: {
  triggers: AutoMessageTrigger[]
  allTokens: MessageToken[]
  rule: AutoMessageRule | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const triggersByCategory = useMemo(() => {
    const m = new Map<string, AutoMessageTrigger[]>()
    for (const t of triggers) {
      const arr = m.get(triggerCategory(t)) ?? []
      arr.push(t)
      m.set(triggerCategory(t), arr)
    }
    return m
  }, [triggers])

  const firstTrigger = triggers[0]
  const initialTrigger = rule ? triggers.find((t) => t.key === rule.trigger) ?? firstTrigger : firstTrigger

  const [category, setCategory] = useState(initialTrigger ? triggerCategory(initialTrigger) : CATEGORY_ORDER[0])
  const [triggerKey, setTriggerKey] = useState(initialTrigger?.key ?? '')
  const [name, setName] = useState(rule?.name ?? initialTrigger?.label ?? '')
  const [audience, setAudience] = useState(rule?.audience ?? initialTrigger?.defaultAudience ?? 'parents')
  const [channel, setChannel] = useState<ChannelKey>(
    rule ? ruleChannel(rule) : availableChannels(initialTrigger)[0] ?? 'sms',
  )
  const [template, setTemplate] = useState(rule?.template ?? initialTrigger?.defaultTemplate ?? '')
  const [smsProvider, setSmsProvider] = useState<'eskiz' | 'local'>(rule?.smsProvider === 'local' ? 'local' : 'eskiz')
  const [sendScope, setSendScope] = useState(rule?.sendScope || sendScopeOptions[0].value)
  const [offsetMinutes, setOffsetMinutes] = useState(rule?.offsetMinutes ?? 0)
  const [scheduleType, setScheduleType] = useState(rule?.scheduleType || 'daily')
  const [scheduleTime, setScheduleTime] = useState(rule?.scheduleTime || '09:00')
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(rule?.scheduleDayOfMonth ?? 1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trigger = triggers.find((t) => t.key === triggerKey)
  const chans = availableChannels(trigger)

  // Matn ostidagi o'zgaruvchilar: butun katalog (lid hodisasi → lid+umumiy+hodisa; aks holda o'quvchi+umumiy+hodisa).
  // Katalog bo'sh bo'lsa (server bermasa) — hodisaning o'z tokenlariga qaytamiz.
  const editorTokens = useMemo(() => {
    const isLead = !!trigger && trigger.audiences.length === 0
    const groups = isLead ? ['lead', 'common', 'event'] : ['student', 'common', 'event']
    const seen = new Set<string>()
    const list = allTokens
      .filter((t) => groups.includes(t.group) && !seen.has(t.token) && seen.add(t.token))
      .map((t) => ({ token: t.token, label: t.label }))
    if (list.length > 0) return list
    return (trigger?.tokens ?? []).map((tk) => ({ token: tk, label: tk }))
  }, [allTokens, trigger])

  // Bo'lim o'zgarsa — birinchi hodisaga o'tamiz va shu hodisa standartlarini qo'llaymiz.
  const applyTriggerDefaults = (t: AutoMessageTrigger | undefined) => {
    if (!t) return
    setName(t.label)
    setAudience(t.defaultAudience)
    setTemplate(t.defaultTemplate ?? '')
    setChannel(availableChannels(t)[0] ?? 'sms')
    setSendScope(sendScopeOptions[0].value)
    setScheduleType('daily')
    setScheduleTime('09:00')
    setScheduleDayOfMonth(1)
  }

  const onCategoryChange = (cat: string) => {
    setCategory(cat)
    const first = (triggersByCategory.get(cat) ?? [])[0]
    if (first) {
      setTriggerKey(first.key)
      applyTriggerDefaults(first)
    }
  }

  const onTriggerChange = (key: string) => {
    setTriggerKey(key)
    applyTriggerDefaults(triggers.find((t) => t.key === key))
  }

  // Kanal mavjud emas bo'lib qolsa (hodisa o'zgarganda) — birinchi mavjudga tushiramiz.
  const effChannel = chans.includes(channel) ? channel : chans[0] ?? 'sms'

  const save = async () => {
    if (!trigger) return
    if (!name.trim()) {
      setError('Nom kerak')
      return
    }
    // Token ishlatadigan hodisalarda matn bo'sh bo'lmasin (qarzdorlik matni tizim tomonidan tuziladi — shart emas).
    if (trigger.tokens.length > 0 && !template.trim()) {
      setError('Xabar matni kerak')
      return
    }
    setSaving(true)
    setError('')
    const input: AutoMessageRuleInput = {
      trigger: trigger.key,
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      sendSms: effChannel === 'sms',
      sendTelegram: effChannel === 'telegram',
      sendPush: effChannel === 'push',
      audience,
      template,
      offsetMinutes,
      sendScope: trigger.supportsSendScope ? sendScope : '',
      scheduleType: trigger.supportsSchedule ? scheduleType : '',
      scheduleTime: trigger.supportsSchedule ? scheduleTime : '',
      scheduleDayOfMonth,
      smsProvider,
    }
    try {
      if (rule) await updateAutoMessageRule(rule.id, input)
      else await createAutoMessageRule(input)
      await onSaved()
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Xabarni tahrirlash' : 'Yangi xabar'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={save} disabled={saving || !trigger}>
            {saving ? 'Saqlanmoqda...' : rule ? 'Saqlash' : 'Yaratish'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Bo'lim + hodisa */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Bo'lim" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {CATEGORY_ORDER.filter((c) => (triggersByCategory.get(c) ?? []).length > 0).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label="Hodisa" value={triggerKey} onChange={(e) => onTriggerChange(e.target.value)}>
            {(triggersByCategory.get(category) ?? []).map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        {trigger && <p className="-mt-1 text-xs text-slate-500">{trigger.description}</p>}

        {/* Nom */}
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Xabar nomi" />

        {/* Kimga */}
        {trigger && trigger.audiences.length > 0 && (
          <Select label="Kimga" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {trigger.audiences.map((a) => (
              <option key={a} value={a}>
                {audienceLabel(a)}
              </option>
            ))}
          </Select>
        )}

        {/* Kanal — BITTA (radio) */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-600">Kanal</p>
          <div className="flex flex-wrap gap-2">
            {chans.map((key) => {
              const c = CHANNELS[key]
              const Icon = c.icon
              const on = effChannel === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChannel(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Icon className="h-4 w-4" /> {c.label}
                </button>
              )
            })}
          </div>
          {trigger && chans.length === 1 && chans[0] === 'sms' && (
            <p className="mt-1 text-xs text-slate-400">Bu hodisada faqat SMS mavjud (lidda ilova/telegram yo'q).</p>
          )}
        </div>

        {/* SMS provayderi (faqat SMS kanalida) */}
        {effChannel === 'sms' && (
          <SmsProviderPicker
            provider={smsProvider}
            onProviderChange={setSmsProvider}
            agentId=""
            onAgentChange={() => {}}
            allowAgentOverride={false}
          />
        )}

        {/* Yuborish qamrovi (davomat eslatmasi) */}
        {trigger?.supportsSendScope && (
          <div className="grid grid-cols-2 gap-2">
            <Select label="Qamrov" value={sendScope} onChange={(e) => setSendScope(e.target.value)}>
              {sendScopeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              label="Surilish (daq)"
              type="number"
              value={offsetMinutes}
              onChange={(e) => setOffsetMinutes(Number(e.target.value) || 0)}
            />
          </div>
        )}

        {/* Reja (erkin eslatma) */}
        {trigger?.supportsSchedule && (
          <div className="grid grid-cols-2 gap-2">
            <Select label="Reja" value={scheduleType} onChange={(e) => setScheduleType(e.target.value)}>
              {scheduleTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input label="Vaqt" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            {scheduleType === 'monthly' && (
              <Input
                label="Oy kuni (1-28)"
                type="number"
                min={1}
                max={28}
                value={scheduleDayOfMonth}
                onChange={(e) => setScheduleDayOfMonth(Number(e.target.value) || 1)}
              />
            )}
          </div>
        )}

        {/* Matn + o'zgaruvchilar (tokenlar) */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-600">Xabar matni</p>
          {trigger && trigger.tokens.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Bu hodisa matni tizim tomonidan avtomatik tuziladi — alohida matn shart emas.
            </p>
          ) : (
            <MessageEditor
              value={template}
              onChange={setTemplate}
              tokens={editorTokens}
              showSmsCounter={effChannel === 'sms'}
              rows={4}
              placeholder="Xabar matni — o'zgaruvchilar bilan"
            />
          )}
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

/** AutoMessageRule → yozish uchun input (id/createdAt siz). */
function toInput(r: AutoMessageRule): AutoMessageRuleInput {
  const { id: _id, createdAt: _createdAt, ...rest } = r
  return rest
}
