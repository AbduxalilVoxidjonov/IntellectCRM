import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStudentLesson, getStudentCurriculum, type LessonContent, type LessonQuestion } from '@/api/services/studentPortal'
import { Icon } from '@/pages/student/lib'

/* ============================================================
   O'quvchi portali — DARS ko'rish (Duolingo node bosilganda ochiladi).
   Bitta dars BIR NECHTA bo'limdan iborat bo'lishi mumkin: video → matn →
   audio → lug'at → test. O'quvchi tepadagi progress bilan ketma-ket o'tadi.
   Ko'p kurs bo'lsa, tepada kurs selector ko'rinadi.
   ============================================================ */

type SectionKind = 'video' | 'text' | 'audio' | 'vocab' | 'test'

const SECTION_LABEL: Record<SectionKind, string> = {
  video: 'Video',
  text: 'Matn',
  audio: 'Audio',
  vocab: "Lug'at",
  test: 'Test',
}
const SECTION_ICON: Record<SectionKind, string> = {
  video: 'video',
  text: 'file',
  audio: 'clock',
  vocab: 'book',
  test: 'checkCircle',
}

/** YouTube/oddiy URL'dan embed havolasini quradi (YouTube bo'lsa iframe).
 * playsinline=1 — telefonda (WebView) ichki o'ynashi uchun; nocookie — kamroq bloklash. */
function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/)
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?playsinline=1&rel=0&modestbranding=1` : null
}

export function StudentLessonScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [lesson, setLesson] = useState<LessonContent | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])

  // Dars kontentini va kurslarni parallel yuklash
  useEffect(() => {
    let alive = true
    Promise.all([
      getStudentLesson(id),
      getStudentCurriculum()
    ])
      .then(([l, curriculums]) => {
        if (!alive) return
        setLesson(l)

        // Kurslarni deduplicate qilish
        const courseMap = new Map<string, string>()
        curriculums?.forEach(c => {
          if (c.courseId && c.courseName) {
            courseMap.set(c.courseId, c.courseName)
          }
        })

        const uniqueCourses = Array.from(courseMap).map(([id, name]) => ({ id, name }))
        setCourses(uniqueCourses)

        // Agar bitta kurs bo'lsa, avtomatik tanlash
        if (uniqueCourses.length === 1 && !selectedCourseId) {
          setSelectedCourseId(uniqueCourses[0].id)
        }
      })
      .catch(() => alive && setErr("Dars topilmadi yoki kontent yo'q"))

    return () => {
      alive = false
    }
  }, [id])


  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId)
  }

  // Mavjud bo'limlar (faqat to'ldirilganlari) — qat'iy tartibda.
  const sections = useMemo<SectionKind[]>(() => {
    if (!lesson) return []
    const s: SectionKind[] = []
    if (lesson.videoUrl) s.push('video')
    if (lesson.textContent) s.push('text')
    if (lesson.audioUrl) s.push('audio')
    if (lesson.vocab.length) s.push('vocab')
    if (lesson.questions.length) s.push('test')
    return s
  }, [lesson])

  const total = sections.length
  const cur = sections[Math.min(step, total - 1)]
  const isLast = step >= total - 1

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

        {/* Kurs selector — ko'p kurs bo'lsa */}
        {courses.length > 1 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Kurs:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="">— tanlang —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tepadagi progress — bo'limlar bo'yicha */}
        {total > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {sections.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 6,
                    background: i <= step ? 'var(--accent)' : 'var(--surface3)',
                    transition: 'background .2s',
                  }}
                />
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                <Icon name={SECTION_ICON[cur]} size={14} color="var(--accent)" />
                {SECTION_LABEL[cur]}
              </span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                {step + 1} / {total}
              </span>
            </div>
          </div>
        )}
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
          ) : total === 0 ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="empty">
                <div className="empty-ic"><Icon name="book" size={28} /></div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Kontent hali qo'shilmagan</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: 4 }}>
                {cur === 'video' && <VideoBlock lesson={lesson} />}
                {cur === 'audio' && <AudioBlock lesson={lesson} />}
                {cur === 'text' && <TextBlock text={lesson.textContent} />}
                {cur === 'vocab' && <VocabBlock lesson={lesson} />}
                {cur === 'test' && <TestRunner questions={lesson.questions} />}
              </div>

              {/* Navigatsiya: oldingi / keyingi-tugatdim */}
              <div className="row gap10" style={{ marginTop: 20 }}>
                {step > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost press"
                    style={{ flex: 1 }}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    <Icon name="chevL" size={18} />
                    Oldingi
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary press"
                  style={{ flex: 2 }}
                  onClick={() => (isLast ? nav(-1) : setStep((s) => s + 1))}
                >
                  {isLast ? (
                    <>
                      <Icon name="check" size={18} color="#fff" />
                      Yakunlash
                    </>
                  ) : (
                    <>
                      Tugatdim · Keyingi
                      <Icon name="arrowR" size={18} color="#fff" />
                    </>
                  )}
                </button>
              </div>
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
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
        {embed ? (
          <iframe
            src={embed}
            title={lesson.text}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <video src={lesson.videoUrl} controls playsInline preload="metadata" style={{ width: '100%', height: '100%' }} />
        )}
      </div>
      {/* Telefonda ichida ochilmasa — tashqi havola (YouTube ilovasi) */}
      <a
        href={lesson.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="row gap10 press"
        style={{ marginTop: 10, justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}
      >
        <Icon name="arrowR" size={16} color="var(--accent)" />
        Video ochilmasa — tashqi ilovada ochish
      </a>
    </>
  )
}

function AudioBlock({ lesson }: { lesson: LessonContent }) {
  return (
    <div className="card">
      <audio src={lesson.audioUrl} controls style={{ width: '100%' }} />
    </div>
  )
}

function TextBlock({ text }: { text: string }) {
  return (
    <div className="card" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15 }}>
      {text}
    </div>
  )
}

/** Lug'at — CHALKASHTIRILGAN MOSLASH o'yini: so'zni tanlab, to'g'ri tarjimasini tanlaydi. */
function VocabBlock({ lesson }: { lesson: LessonContent }) {
  const pairs = lesson.vocab
  // Tarjimalarni bir marta aralashtiramiz (so'zlar tartibda, tarjimalar chalkash).
  const shuffled = useMemo(() => {
    const arr = pairs.map((p, i) => ({ meaning: p.meaning, idx: i }))
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [pairs])

  const [sel, setSel] = useState<number | null>(null) // tanlangan so'z indeksi
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<number | null>(null) // xato chaqnash (tarjima idx)

  const tapTerm = (i: number) => {
    if (matched.has(i)) return
    setSel((cur) => (cur === i ? null : i))
  }
  const tapMeaning = (m: { meaning: string; idx: number }) => {
    if (matched.has(m.idx) || sel === null) return
    if (m.idx === sel) {
      setMatched((s) => new Set(s).add(sel))
      setSel(null)
    } else {
      setWrong(m.idx)
      window.setTimeout(() => setWrong(null), 450)
      setSel(null)
    }
  }

  const done = matched.size === pairs.length

  const chip = (active: boolean, ok: boolean, bad: boolean): CSSProperties => ({
    width: '100%',
    textAlign: 'center',
    padding: '12px 10px',
    borderRadius: 13,
    fontSize: 14.5,
    fontWeight: 700,
    border: `1.5px solid ${ok ? 'var(--green,#16a34a)' : bad ? 'var(--red,#dc2626)' : active ? 'var(--accent)' : 'var(--border)'}`,
    background: ok ? 'var(--greenSoft,#dcfce7)' : bad ? 'var(--redSoft,#fee2e2)' : active ? 'var(--accentSoft)' : 'var(--surface)',
    color: ok ? 'var(--green,#16a34a)' : bad ? 'var(--red,#dc2626)' : active ? 'var(--accent)' : 'var(--text)',
    opacity: ok ? 0.85 : 1,
  })

  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
        So'zni tanlab, to'g'ri tarjimasini bosing
      </p>
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', background: 'var(--accentSoft)', borderColor: 'transparent', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>Moslandi</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{matched.size} / {pairs.length}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* So'zlar (tartibda) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pairs.map((p, i) => (
            <button
              key={i}
              type="button"
              className="press"
              disabled={matched.has(i)}
              onClick={() => tapTerm(i)}
              style={chip(sel === i, matched.has(i), false)}
            >
              {p.term}
            </button>
          ))}
        </div>
        {/* Tarjimalar (chalkash) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shuffled.map((m) => (
            <button
              key={m.idx}
              type="button"
              className="press"
              disabled={matched.has(m.idx)}
              onClick={() => tapMeaning(m)}
              style={chip(false, matched.has(m.idx), wrong === m.idx)}
            >
              {m.meaning}
            </button>
          ))}
        </div>
      </div>

      {done && (
        <div className="card" style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green,#16a34a)' }}>
            Barakalla! Hammasi to'g'ri moslandi {'\u{1F389}'}
          </div>
        </div>
      )}
    </>
  )
}

/** Interaktiv test — variant tanlanadi, darhol to'g'ri/xato ko'rinadi (Duolingo uslubi). */
function TestRunner({ questions }: { questions: LessonQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
    </div>
  )
}
