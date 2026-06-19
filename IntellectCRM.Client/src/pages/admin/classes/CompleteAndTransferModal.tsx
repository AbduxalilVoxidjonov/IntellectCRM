import { useState } from 'react'
import type { Subject } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { completeAndTransferClass } from '@/api/services/classes'

export function CompleteAndTransferModal({
  open,
  onClose,
  groupId,
  currentCourseName,
  courses,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  currentCourseName: string
  courses: Subject[]
  onSuccess?: (result: { ok: boolean; certificatesGenerated: number }) => void
}) {
  const [targetCourseId, setTargetCourseId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = targetCourseId && targetCourseId !== 'new-course'

  async function handleSubmit() {
    if (!isValid) return
    setLoading(true)
    setError(null)

    try {
      const result = await completeAndTransferClass(groupId, targetCourseId, notes || undefined)
      onSuccess?.(result)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div style={{ padding: '20px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            Guruhni tugatish
          </div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>
            Faol o'quvchilarga sertifikat beriladi va yangi kursga o'tkaziladi.
          </div>
        </div>

        {/* Current course */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', marginBottom: 4 }}>
            JORIY KURS
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--panel)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {currentCourseName}
          </div>
        </div>

        {/* Target course */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', display: 'block', marginBottom: 6 }}>
            YANGI KURS (MAQSAD)
          </label>
          <select
            value={targetCourseId}
            onChange={(e) => setTargetCourseId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="">— Kurs tanlang —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.price ? `${c.price.toLocaleString()} so'm/oy` : 'bepul'})
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', display: 'block', marginBottom: 6 }}>
            TUGATISH IZOHLAR (ixtiyoriy)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Masalan: 'A1 darajasini muvaffaqiyatli yakunladi'"
            maxLength={500}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '80px',
              outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>
            {notes.length}/500
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Info box */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: '#F0F9FF',
            fontSize: 12,
            lineHeight: 1.5,
            color: '#0369A1',
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>ℹ️ Nima bo'ladi?</div>
          <ul style={{ marginLeft: 20, margin: '4px 0' }}>
            <li>Barcha faol a'zolar sertifikat oladi</li>
            <li>Yangi kursga "sinov" statusida qo'shiladi</li>
            <li>Eski guruh tugatiladi</li>
          </ul>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ flex: 1 }}
            disabled={loading}
          >
            Bekor qilish
          </Button>
          <Button
            onClick={handleSubmit}
            style={{ flex: 1 }}
            disabled={!isValid || loading}
          >
            {loading ? '⏳ Yuklanmoqda...' : '✓ Tugatish'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
