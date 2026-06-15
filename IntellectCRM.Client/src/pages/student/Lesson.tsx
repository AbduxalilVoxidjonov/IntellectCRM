import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStudentLesson, type LessonContent, type LessonQuestion } from '@/api/services/studentPortal'
import { Icon } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — DARS ko'rish (Duolingo node bosilganda ochiladi).
   Tur bo'yicha: video / matn / audio / lug'at / test (interaktiv).
   ============================================================ */

const TYPE_LABEL: Record<string, string> = {
  video: 'Video dars',
  text: "Matnli dars",
  audio: 'Audio dars',
  vocab: "Lug'at",
  test: 'Test',
}
const TYPE_ICON: Record<string, string> = {
  video: 'video',
  text: 'file',
  audio: 'clock',
  vocab: 'book',
  test: 'checkCircle',
}

/** YouTube/oddiy URL'dan embed havolasini quradi (YouTube bo'lsa iframe, aks holda null). */
function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

export function StudentLessonScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [lesson, setLesson] = useState<LessonContent | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getStudentLesson(id)
      .then((l) => alive && setLesson(l))
      .catch(() => alive && setErr("Dars topilmadi yoki kontent yo'q"))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className="screen">
      <div className="hd">
        <div className="row gap10" style={{ minHeight: 38 }}>
          <button className="iconbtn press" onClick={() => nav(-1)}>
            <Icon name="chevL" size={22} />
          </button>
          <div className="hd-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lesson?.text || 'Dars'}
          </div>
        </div>
      </div>

      <div className="scroll" style={{ paddingBottom: 28 }}>
        <div className="pad">
          {err ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="empty">
                <div className="empty-ic"><Icon name="alert" size={28} /></div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{err}</div>
              </div>
            </div>
          ) : !lesson ? (
            <div className="center"><div className="spin" /></div>
          ) : (
            <>
              {/* Tur belgisi */}
              <div className="chip" style={{ marginTop: 4, marginBottom: 12, color: 'var(--accent)', background: 'var(--accentSoft)', display: 'inline-flex', gap: 6 }}>
                <Icon name={TYPE_ICON[lesson.type] || 'book'} size={14} color="var(--accent)" />
                {TYPE_LABEL[lesson.type] || 'Dars'}{lesson.meta ? ` · ${lesson.meta}` : ''}
              </div>

              {lesson.type === 'video' && <VideoBlock lesson={lesson} />}
              {lesson.type === 'audio' && <AudioBlock lesson={lesson} />}
              {lesson.type === 'text' && <TextBlock text={lesson.textContent} />}
              {lesson.type === 'vocab' && <VocabBlock lesson={lesson} />}
              {lesson.type === 'test' && <TestRunner questions={lesson.questions} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function VideoBlock({ lesson }: { lesson: LessonContent }) {
  const embed = lesson.videoUrl ? youtubeEmbed(lesson.videoUrl) : null
  return (
    <>
      {lesson.videoUrl ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
          {embed ? (
            <iframe
              src={embed}
              title={lesson.text}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <video src={lesson.videoUrl} controls style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>Video yuklanmagan.</p>
      )}
      {lesson.textContent && <TextBlock text={lesson.textContent} top />}
    </>
  )
}

function AudioBlock({ lesson }: { lesson: LessonContent }) {
  return (
    <>
      {lesson.audioUrl ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <audio src={lesson.audioUrl} controls style={{ width: '100%' }} />
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>Audio yuklanmagan.</p>
      )}
      {lesson.textContent && <TextBlock text={lesson.textContent} />}
    </>
  )
}

function TextBlock({ text, top }: { text: string; top?: boolean }) {
  if (!text) return null
  return (
    <div className="card" style={{ marginTop: top ? 12 : 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15 }}>
      {text}
    </div>
  )
}

function VocabBlock({ lesson }: { lesson: LessonContent }) {
  if (!lesson.vocab.length) return <p className="muted" style={{ fontSize: 13 }}>So'zlar yo'q.</p>
  return (
    <div className="card" style={{ padding: 4 }}>
      {lesson.vocab.map((v, i) => (
        <div
          key={i}
          className="row"
          style={{
            justifyContent: 'space-between',
            gap: 12,
            padding: '11px 12px',
            borderBottom: i < lesson.vocab.length - 1 ? '1px solid var(--border)' : undefined,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>{v.term}</span>
          <span className="muted" style={{ fontSize: 14, textAlign: 'right' }}>{v.meaning}</span>
        </div>
      ))}
    </div>
  )
}

/** Interaktiv test — variant tanlanadi, darhol to'g'ri/xato ko'rinadi (Duolingo uslubi). */
function TestRunner({ questions }: { questions: LessonQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})

  if (!questions.length) return <p className="muted" style={{ fontSize: 13 }}>Savollar yo'q.</p>

  const answered = Object.keys(answers).length
  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Ball */}
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', background: 'var(--accentSoft)', borderColor: 'transparent' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>Natija</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{correct} / {questions.length}</span>
      </div>

      {questions.map((q, qi) => {
        const picked = answers[q.id]
        const isAnswered = picked !== undefined
        return (
          <div key={q.id} className="card">
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              {qi + 1}. {q.text}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt, oi) => {
                const isPicked = picked === oi
                const isCorrect = oi === q.correctIndex
                let bg = 'var(--surface)'
                let bd = 'var(--border)'
                let col = 'var(--text)'
                if (isAnswered && isCorrect) { bg = 'var(--greenSoft, #dcfce7)'; bd = 'var(--green, #16a34a)'; col = 'var(--green, #16a34a)' }
                else if (isAnswered && isPicked && !isCorrect) { bg = 'var(--redSoft, #fee2e2)'; bd = 'var(--red, #dc2626)'; col = 'var(--red, #dc2626)' }
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className="press row gap10"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 13px',
                      borderRadius: 13,
                      border: `1.5px solid ${bd}`,
                      background: bg,
                      color: col,
                      fontSize: 14.5,
                      fontWeight: 600,
                    }}
                  >
                    {isAnswered && isCorrect && <Icon name="checkCircle" size={18} color="var(--green, #16a34a)" />}
                    {isAnswered && isPicked && !isCorrect && <Icon name="x" size={18} color="var(--red, #dc2626)" />}
                    <span style={{ flex: 1 }}>{opt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {answered === questions.length && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>
            {correct === questions.length ? "Barakalla! Hammasi to'g'ri \u{1F389}" : `${correct}/${questions.length} to'g'ri`}
          </div>
        </div>
      )}
    </div>
  )
}
