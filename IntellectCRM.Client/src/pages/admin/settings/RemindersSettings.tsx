import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, XCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getReminderTypes,
  getReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  type ReminderTriggerInfo,
  type ReminderRule,
  type SaveReminderRuleReq,
  type ReminderAudience,
  type ReminderScheduleType,
  type ReminderSendScope,
} from '@/api/services/settings'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'

/**
 * Eslatmalar — avtomatik push (+ Telegram) eslatma qoidalari. Har qoida "Eslatmalar" katalogidagi
 * bitta turga (masalan qarzdorlik eslatmasi yoki o'qituvchiga davomat eslatmasi) bog'lanadi; yuborish
 * mantig'i backend fon xizmatlarida — bu yerda faqat yoqish/o'chirish va matn/vaqt sozlanadi.
 */
export function RemindersSettings() {
  const [types, setTypes] = useState<ReminderTriggerInfo[]>([])
  const [items, setItems] = useState<ReminderRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ReminderRule | null>(null)
  const [adding, setAdding] = useState(false)

  const [trigger, setTrigger] = useState('')
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [messageTemplate, setMessageTemplate] = useState('')
  const [offsetMinutes, setOffsetMinutes] = useState(5)
  const [sendScope, setSendScope] = useState<ReminderSendScope>('lesson_start')
  const [audience, setAudience] = useState<ReminderAudience | ''>('')
  const [scheduleType, setScheduleType] = useState<ReminderScheduleType>('daily')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1)
  const [saving, setSaving] = useState(false)

  const load = () =>
    Promise.all([getReminderTypes(), getReminderRules()]).then(([t, r]) => {
      setTypes(t)
      setItems(r)
    })

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const typeInfo = (key: string) => types.find((t) => t.key === key)

  const reset = () => {
    setEditing(null)
    setAdding(false)
    setTrigger(types[0]?.key ?? '')
    setName('')
    setEnabled(true)
    setMessageTemplate('')
    setOffsetMinutes(5)
    setSendScope('lesson_start')
    setAudience('')
    setScheduleType('daily')
    setScheduleTime('09:00')
    setScheduleDayOfMonth(1)
  }

  const startAdd = () => {
    reset()
    setTrigger(types[0]?.key ?? '')
    setAdding(true)
  }

  const startEdit = (r: ReminderRule) => {
    setEditing(r)
    setTrigger(r.trigger)
    setName(r.name)
    setEnabled(r.enabled)
    setMessageTemplate(r.messageTemplate)
    setOffsetMinutes(r.offsetMinutes)
    setSendScope(r.sendScope || 'lesson_start')
    setAudience(r.audience)
    setScheduleType(r.scheduleType)
    setScheduleTime(r.scheduleTime)
    setScheduleDayOfMonth(r.scheduleDayOfMonth)
    setAdding(true)
  }

  const save = async () => {
    if (!name.trim() || !trigger || saving) return
    setSaving(true)
    try {
      const payload: SaveReminderRuleReq = {
        trigger,
        name: name.trim(),
        enabled,
        messageTemplate: messageTemplate.trim(),
        offsetMinutes,
        sendScope,
        audience,
        scheduleType,
        scheduleTime,
        scheduleDayOfMonth,
      }
      if (editing) await updateReminderRule(editing.id, payload)
      else await createReminderRule(payload)
      await load()
      reset()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: ReminderRule) => {
    if (!confirm(`"${r.name}" eslatmasini o'chirasizmi?`)) return
    await deleteReminderRule(r.id)
    await load()
  }

  const toggleEnabled = async (r: ReminderRule) => {
    await updateReminderRule(r.id, {
      trigger: r.trigger,
      name: r.name,
      enabled: !r.enabled,
      messageTemplate: r.messageTemplate,
      offsetMinutes: r.offsetMinutes,
      sendScope: r.sendScope,
      audience: r.audience,
      scheduleType: r.scheduleType,
      scheduleTime: r.scheduleTime,
      scheduleDayOfMonth: r.scheduleDayOfMonth,
    })
    await load()
  }

  const insertToken = (token: string) => setMessageTemplate((x) => x + token)

  if (loading) return <Loader label="Yuklanmoqda..." />

  const activeType = typeInfo(trigger)

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Bell className="h-4 w-4 text-brand-600" /> Eslatmalar
        </span>
      }
      actions={
        !adding ? (
          <Button variant="secondary" onClick={startAdd}>
            <Plus className="h-4 w-4" /> Yangi eslatma
          </Button>
        ) : undefined
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Avtomatik push (+ Telegram) eslatmalar — masalan qarzdorlarga to'lov eslatmasi yoki
        o'qituvchilarga har dars boshlanganda "davomat kiriting" eslatmasi. Har biri alohida
        yoqiladi/o'chiriladi va (turi qo'llasa) matni tahrirlanadi.
      </p>

      {adding && (
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Eslatma turi</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              disabled={!!editing}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {types.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {activeType && <p className="mt-1 text-xs text-slate-400">{activeType.description}</p>}
          </div>

          <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} placeholder="masalan: Davomat eslatmasi" />

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
            />
            Yoqilgan
          </label>

          {activeType?.supportsSendScope && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Kimga yuborish</label>
              <select
                value={sendScope}
                onChange={(e) => setSendScope(e.target.value as ReminderSendScope)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="lesson_start">Darsi boshlanganda to'ldirmaganga (har dars, +N daqiqa)</option>
                <option value="not_filled">To'ldirmaganlarga — kunlik vaqtda, bugun darsi bo'lib to'ldirmaganlarga</option>
                <option value="all">Hammaga — kunlik vaqtda BARCHA o'qituvchilarga (to'ldirganlarga ham)</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                {sendScope === 'lesson_start'
                  ? "Har guruh darsi boshlangach, davomat hali kiritilmagan bo'lsa o'sha guruh o'qituvchisiga yuboriladi."
                  : sendScope === 'not_filled'
                    ? "Belgilangan vaqtda — bugun darsi bo'lib (boshlangan) davomatini hali kiritmagan o'qituvchilarga, har guruh uchun alohida."
                    : "Belgilangan vaqtda — barcha faol o'qituvchilarga, davomatni to'ldirgan bo'lsa ham."}
              </p>
            </div>
          )}

          {activeType?.supportsOffset && (!activeType?.supportsSendScope || sendScope === 'lesson_start') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Dars boshlanishidan necha daqiqa keyin yuborilsin
              </label>
              <Input
                type="number"
                min={0}
                value={offsetMinutes}
                onChange={(e) => setOffsetMinutes(Math.max(0, Number(e.target.value) || 0))}
                className="max-w-[140px]"
              />
            </div>
          )}

          {activeType?.supportsSendScope && sendScope !== 'lesson_start' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Yuborish vaqti (har kuni)</label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="max-w-[140px]"
              />
            </div>
          )}

          {activeType?.supportsAudience && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Auditoriya</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as ReminderAudience)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">— Tanlang —</option>
                <option value="teachers">O'qituvchilar</option>
                <option value="students">O'quvchilar (ota-onalar)</option>
              </select>
            </div>
          )}

          {activeType?.supportsSchedule && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Jadval</label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as ReminderScheduleType)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="daily">Har kuni</option>
                  <option value="monthly">Oyning muayyan kunida</option>
                </select>
              </div>
              {scheduleType === 'monthly' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Oyning kuni</label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleDayOfMonth}
                    onChange={(e) => setScheduleDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Vaqti</label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="max-w-[140px]"
                />
              </div>
            </div>
          )}

          {activeType?.supportsTemplate && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Xabar matni</label>
              <textarea
                rows={3}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Xabar matni (o'rinbosarlar bilan)"
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {activeType.tokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={save}
              disabled={!name.trim() || !trigger || saving || !!(activeType?.supportsAudience && !audience)}
            >
              {saving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : "Qo'shish"}
            </Button>
            <Button variant="secondary" onClick={reset}>Bekor</Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Eslatma yo'q. "Yangi eslatma" bilan qo'shing.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <Badge tone="default">{typeInfo(r.trigger)?.label ?? r.trigger}</Badge>
                  <button type="button" onClick={() => toggleEnabled(r)}>
                    {r.enabled ? (
                      <Badge tone="green">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yoqilgan
                      </Badge>
                    ) : (
                      <Badge tone="default">
                        <XCircle className="h-3.5 w-3.5" /> O'chirilgan
                      </Badge>
                    )}
                  </button>
                </div>
                {typeInfo(r.trigger)?.supportsSchedule && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {r.audience === 'teachers' ? "O'qituvchilar" : "O'quvchilar (ota-onalar)"} ·{' '}
                    {r.scheduleType === 'monthly' ? `Har oyning ${r.scheduleDayOfMonth}-kunida` : 'Har kuni'}
                    {' '}soat {r.scheduleTime}
                  </p>
                )}
                {typeInfo(r.trigger)?.supportsSendScope && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {(r.sendScope || 'lesson_start') === 'lesson_start'
                      ? `Darsi boshlanganda to'ldirmaganga (+${r.offsetMinutes} daq)`
                      : r.sendScope === 'not_filled'
                        ? `To'ldirmaganlarga · har kuni soat ${r.scheduleTime}`
                        : `Hammaga (to'ldirganlarga ham) · har kuni soat ${r.scheduleTime}`}
                  </p>
                )}
                {r.messageTemplate && <p className="mt-0.5 text-xs text-slate-500">{r.messageTemplate}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" title="Tahrirlash" onClick={() => startEdit(r)} className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600')}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title="O'chirish" onClick={() => remove(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
