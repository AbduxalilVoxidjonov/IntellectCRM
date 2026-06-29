import { useEffect, useRef, useState } from 'react'
import {
  getSpeaking,
  submitSpeaking,
  type SpeakingResult,
  type SpeakingWord,
} from '@/api/services/studentPortal'
import { startWavRecording, type WavRecorder } from '@/lib/wavRecorder'
import { RecWaveform } from '@/pages/student/RecWaveform'
import { Icon } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — Speaking (talaffuz bahosi) yozuvchisi.
   Mikrofondan WAV yozadi -> Azure Pronunciation Assessment'ga
   yuboradi -> batafsil sharhni ko'rsatadi.
   ============================================================ */

const GREEN = 'var(--green, #16a34a)'
const RED = 'var(--red, #dc2626)'
const AMBER = '#d97706'
const MAX_SECONDS = 60

function scoreColor(v: number): string {
  if (v >= 80) return GREEN
  if (v >= 60) return AMBER
  return RED
}

type Phase = 'idle' | 'recording' | 'submitting'

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface3, #e2e8f0)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', borderRadius: 99, background: scoreColor(v) }} />
      </div>
    </div>
  )
}

function WordChip({ w }: { w: SpeakingWord }) {
  const omission = w.errorType === 'Omission'
  const insertion = w.errorType === 'Insertion'
  const acc = Math.round(w.accuracy)
  const color = omission ? RED : scoreColor(w.accuracy)
  return (
    <span
      title={`${w.word} — ${acc}%${w.errorType && w.errorType !== 'None' ? ` (${w.errorType})` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 9,
        background: 'var(--surface, #f1f5f9)',
        border: `1px solid ${color}`,
        color,
        fontSize: 14,
        fontWeight: 700,
        opacity: omission ? 0.55 : 1,
        textDecoration: omission ? 'line-through' : 'none',
      }}
    >
      {w.word}
      {omission && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>tushib qoldi</span>}
      {insertion && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>ortiqcha</span>}
    </span>
  )
}

export function SpeakingRecorder({ assignmentId, referenceText }: { assignmentId: string; referenceText: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<WavRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // Oldingi natijani yuklash (qayta ochilganda oxirgi natija ko'rinadi).
  useEffect(() => {
    mountedRef.current = true
    let active = true
    getSpeaking(assignmentId)
      .then((r) => {
        if (active && r) setResult(r)
      })
      .catch(() => {
        /* natija yo'q — jim */
      })
    return () => {
      active = false
      mountedRef.current = false
      clearTimer()
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  // Yozilgan blobni yuborib, natijani olish.
  const sendBlob = async (blob: Blob) => {
    setPhase('submitting')
    try {
      const r = await submitSpeaking(assignmentId, blob)
      if (!mountedRef.current) return
      setResult(r)
      setPhase('idle')
    } catch (e) {
      if (!mountedRef.current) return
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      setError(err.response?.data?.message || err.message || "Yuborishda xatolik")
      setPhase('idle')
    }
  }

  const stopRecording = async () => {
    const rec = recorderRef.current
    if (!rec) return
    recorderRef.current = null
    clearTimer()
    let blob: Blob
    try {
      blob = await rec.stop()
    } catch (e) {
      const err = e as { message?: string }
      setError(err.message || "Yozishda xatolik")
      setPhase('idle')
      return
    }
    await sendBlob(blob)
  }

  const startRecording = async () => {
    setError(null)
    setResult(null)
    setElapsed(0)
    try {
      const rec = await startWavRecording()
      recorderRef.current = rec
      setPhase('recording')
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          const next = s + 1
          if (next >= MAX_SECONDS) {
            // ~60 soniyada avtomatik to'xtatish.
            void stopRecording()
          }
          return next
        })
      }, 1000)
    } catch {
      setError("Mikrofonga ruxsat berilmadi")
      setPhase('idle')
    }
  }

  const showReview = result && result.error === null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* O'qiladigan matn */}
      <div className="card" style={{ padding: 14, borderRadius: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>O'qing</div>
        {referenceText.trim() ? (
          <div style={{ fontSize: 16, lineHeight: 1.5 }}>{referenceText}</div>
        ) : (
          <div className="muted" style={{ fontSize: 14 }}>Mavzu bo'yicha erkin gapiring</div>
        )}
      </div>

      {/* Yozuvchi */}
      <div
        className="card"
        style={{ padding: 18, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
      >
        {phase === 'recording' ? (
          <>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 99,
                  background: RED,
                  animation: 'pulse 1s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </div>
            <RecWaveform recorder={recorderRef} active={phase === 'recording'} />
            <button className="btn btn-lg press" style={{ background: RED, color: '#fff' }} onClick={() => void stopRecording()}>
              <Icon name="x" size={18} color="#fff" />
              <span>To'xtatish</span>
            </button>
          </>
        ) : phase === 'submitting' ? (
          <div className="row" style={{ gap: 10, alignItems: 'center', padding: '14px 0' }}>
            <Icon name="refresh" size={20} color="var(--accent)" />
            <span style={{ fontWeight: 700 }}>Baholanmoqda...</span>
          </div>
        ) : (
          <>
            <button
              className="press"
              onClick={() => void startRecording()}
              style={{
                width: 84,
                height: 84,
                borderRadius: 99,
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 22px rgba(37,99,235,.32)',
              }}
            >
              <Icon name="clock" size={36} color="#fff" />
            </button>
            <div className="muted" style={{ fontSize: 13 }}>
              {showReview ? "Qayta yozish uchun bosing" : "Yozishni boshlash uchun bosing"}
            </div>
            {showReview && (
              <button className="btn press" onClick={() => void startRecording()}>
                <Icon name="refresh" size={16} />
                <span>Qayta yozish</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Xato */}
      {error && (
        <div className="card row" style={{ padding: 14, borderRadius: 16, gap: 10, alignItems: 'center', color: RED }}>
          <Icon name="alert" size={20} color={RED} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* Natijada xato bo'lsa */}
      {result && result.error !== null && !error && (
        <div className="card row" style={{ padding: 14, borderRadius: 16, gap: 10, alignItems: 'center', color: RED }}>
          <Icon name="alert" size={20} color={RED} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{result.error}</span>
        </div>
      )}

      {/* Sharh */}
      {showReview && result && (
        <>
          {/* Umumiy ball */}
          <div className="card" style={{ padding: 18, borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: scoreColor(result.pronScore) }}>
              {Math.round(result.pronScore)}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Umumiy ball</div>
          </div>

          {/* Sub-ballar */}
          <div className="card" style={{ padding: 16, borderRadius: 16 }}>
            <ScoreBar label="Aniqlik" value={result.accuracy} />
            <ScoreBar label="Ravonlik" value={result.fluency} />
            <ScoreBar label="To'liqlik" value={result.completeness} />
            <ScoreBar label="Ohang" value={result.prosody} />
          </div>

          {/* Tanilgan matn */}
          <div className="card" style={{ padding: 14, borderRadius: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Tanilgan matn</div>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>{result.recognizedText || '—'}</div>
          </div>

          {/* So'zlar */}
          {result.words.length > 0 && (
            <div className="card" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>So'zlar</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.words.map((w, i) => (
                  <WordChip key={`${w.word}-${i}`} w={w} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
