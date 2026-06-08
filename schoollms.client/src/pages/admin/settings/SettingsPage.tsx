import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { AbsenceReason, LessonTime } from '@/types'
import {
  getSettings,
  saveLessonTimes,
  saveAbsenceReasons,
} from '@/api/services/settings'
import { uid } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { Time24Input } from '@/components/ui/Input'
import { SchoolSettings } from './SchoolSettings'
import { TelegramSettings } from './TelegramSettings'
import { FirebaseSettings } from './FirebaseSettings'
import { TurnstileSettings } from './TurnstileSettings'
import { GpsSettings } from './GpsSettings'
import { CameraSettings } from './CameraSettings'

type Status = 'idle' | 'saving' | 'saved'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400'

const sectionTitles: Record<string, string> = {
  'lesson-times': 'Dars vaqtlari',
  reasons: 'Davomat sabablari',
  school: "Markaz ma'lumotlari",
  telegram: 'Telegram bot',
  firebase: 'Push (Firebase)',
  turnstile: 'Turniket integratsiya',
  gps: 'GPS integratsiya',
  cameras: 'Kamera integratsiya',
}

export function SettingsPage() {
  const { section = 'lesson-times' } = useParams()
  const [lessonTimes, setLessonTimes] = useState<LessonTime[]>([])
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [loading, setLoading] = useState(true)
  const [tStatus, setTStatus] = useState<Status>('idle')
  const [rStatus, setRStatus] = useState<Status>('idle')

  useEffect(() => {
    getSettings()
      .then((s) => {
        setLessonTimes(s.lessonTimes)
        setReasons(s.absenceReasons)
      })
      .finally(() => setLoading(false))
  }, [])

  const updateTime = (i: number, field: 'startTime' | 'endTime', value: string) =>
    setLessonTimes((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))

  const addTime = () =>
    setLessonTimes((prev) => [...prev, { period: prev.length + 1, startTime: '', endTime: '' }])

  const removeTime = (i: number) =>
    setLessonTimes((prev) =>
      prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, period: idx + 1 })),
    )

  const onSaveTimes = async () => {
    setTStatus('saving')
    await saveLessonTimes(lessonTimes)
    setTStatus('saved')
    setTimeout(() => setTStatus('idle'), 2000)
  }

  const updateReason = (i: number, field: 'name' | 'short', value: string) =>
    setReasons((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))

  const toggleReasonLate = (i: number) =>
    setReasons((prev) => prev.map((r, idx) => (idx === i ? { ...r, isLate: !r.isLate } : r)))

  const addReason = () =>
    setReasons((prev) => [...prev, { id: uid(), name: '', short: '', isLate: false }])

  const removeReason = (i: number) =>
    setReasons((prev) => prev.filter((_, idx) => idx !== i))

  const onSaveReasons = async () => {
    setRStatus('saving')
    await saveAbsenceReasons(reasons.filter((r) => r.name.trim()))
    setRStatus('saved')
    setTimeout(() => setRStatus('idle'), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Sozlamalar</h1>
        <p className="text-sm text-slate-400">{sectionTitles[section] ?? 'Sozlamalar'}</p>
      </div>

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="max-w-3xl space-y-6">
          {/* Dars vaqtlari */}
          {section === 'lesson-times' && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Dars vaqtlari</h2>
              <SaveButton status={tStatus} onClick={onSaveTimes} />
            </div>
            <div className="space-y-2">
              {lessonTimes.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-sm font-medium text-slate-600">{t.period}-dars</span>
                  <Time24Input
                    value={t.startTime}
                    onChange={(v) => updateTime(i, 'startTime', v)}
                  />
                  <span className="text-slate-400">—</span>
                  <Time24Input
                    value={t.endTime}
                    onChange={(v) => updateTime(i, 'endTime', v)}
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(i)}
                    title="O'chirish"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addTime}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Plus className="h-4 w-4" /> Dars qo'shish
              </button>
            </div>
          </Card>
          )}

          {/* Davomat sabablari */}
          {section === 'reasons' && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Davomat sabablari</h2>
              <SaveButton status={rStatus} onClick={onSaveReasons} />
            </div>
            <div className="space-y-2">
              {reasons.map((r, i) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => updateReason(i, 'name', e.target.value)}
                    placeholder="Sabab nomi (masalan: Kasal)"
                    className={`${control} flex-1 min-w-[180px]`}
                  />
                  <input
                    value={r.short}
                    onChange={(e) => updateReason(i, 'short', e.target.value)}
                    placeholder="Belgi"
                    maxLength={3}
                    className={`${control} w-20 text-center`}
                  />
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm text-slate-600"
                    title="Kech keldi — yo'qlik emas, baho qo'ysa bo'ladi"
                  >
                    <input
                      type="checkbox"
                      checked={r.isLate}
                      onChange={() => toggleReasonLate(i)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Kech qolish
                  </label>
                  <button
                    type="button"
                    onClick={() => removeReason(i)}
                    title="O'chirish"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addReason}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Plus className="h-4 w-4" /> Sabab qo'shish
              </button>
            </div>
          </Card>
          )}

          {/* Markaz ma'lumotlari */}
          {section === 'school' && <SchoolSettings />}

          {/* Telegram bot */}
          {section === 'telegram' && <TelegramSettings />}

          {/* Push (Firebase) */}
          {section === 'firebase' && <FirebaseSettings />}

          {/* Turniket / FaceID integratsiya */}
          {section === 'turnstile' && <TurnstileSettings />}

          {/* GPS (avtobus kuzatuvi) integratsiya */}
          {section === 'gps' && <GpsSettings />}

          {/* Kamera (videokuzatuv) integratsiya */}
          {section === 'cameras' && <CameraSettings />}
        </div>
      )}
    </div>
  )
}

function SaveButton({ status, onClick }: { status: Status; onClick: () => void }) {
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
        <Check className="h-4 w-4" /> Saqlandi
      </span>
    )
  }
  return (
    <Button onClick={onClick} disabled={status === 'saving'}>
      {status === 'saving' ? 'Saqlanmoqda...' : 'Saqlash'}
    </Button>
  )
}
