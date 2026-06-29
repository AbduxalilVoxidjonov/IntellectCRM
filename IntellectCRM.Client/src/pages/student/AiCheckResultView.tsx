import type { AiCheck } from '@/types'
import { Ring, fmtDate } from '@/pages/student/lib'
import { mediaUrl } from '@/api/services/studentAiCheck'

/** Ball rangi (0-100). */
function scoreColor(v: number): string {
  if (v >= 80) return '#16a34a'
  if (v >= 60) return '#2563eb'
  if (v >= 40) return '#f59e0b'
  return '#ef4444'
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="row sp" style={{ marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: scoreColor(value) }}>{value}</span>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: scoreColor(value) }} />
      </div>
    </div>
  )
}

/**
 * AI tekshiruv natijasi — diagramma + tahlil. O'quvchi ekrani VA admin ko'rinishida
 * bir xil (admin sahifa `.student-app` ichida o'raydi). Speaking bo'lsa ovoz + Azure ballari.
 */
export function AiCheckResultView({ rec }: { rec: AiCheck }) {
  const a = rec.analysis
  const sp = rec.speech
  const isSpeaking = rec.type === 'speaking'

  return (
    <div className="col gap12" style={{ padding: '4px 0' }}>
      {/* Umumiy ball */}
      <div className="card">
        <div className="row gap12">
          <Ring value={a?.overall ?? Math.round(rec.score)} size={84} stroke={8} color={scoreColor(a?.overall ?? rec.score)}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{a?.overall ?? Math.round(rec.score)}</div>
            <div className="faint" style={{ fontSize: 10 }}>/ 100</div>
          </Ring>
          <div className="col" style={{ gap: 4 }}>
            <span className="chip" style={{ background: 'var(--accentSoft)', color: 'var(--accent)', alignSelf: 'flex-start' }}>
              {isSpeaking ? '🎤 Speaking' : '✍️ Writing'}
            </span>
            {a?.level ? <div style={{ fontSize: 18, fontWeight: 800 }}>Daraja: {a.level}</div> : null}
            <div className="muted" style={{ fontSize: 12 }}>{fmtDate(rec.createdAt, true)}</div>
            {rec.prompt ? <div className="muted" style={{ fontSize: 12.5 }}>Mavzu: {rec.prompt}</div> : null}
          </div>
        </div>
      </div>

      {/* Speaking: ovozni qayta eshitish + Azure talaffuz ballari */}
      {isSpeaking && (
        <div className="card">
          <div className="sh-title" style={{ marginBottom: 8 }}>Talaffuz (Azure)</div>
          {rec.audioUrl ? (
            <audio controls src={mediaUrl(rec.audioUrl)} style={{ width: '100%', marginBottom: 12 }} />
          ) : null}
          {sp ? (
            <>
              <Bar label="Talaffuz" value={Math.round(sp.pronScore)} />
              <Bar label="Aniqlik" value={Math.round(sp.accuracy)} />
              <Bar label="Ravonlik" value={Math.round(sp.fluency)} />
              <Bar label="To'liqlik" value={Math.round(sp.completeness)} />
              <Bar label="Ohang (prosody)" value={Math.round(sp.prosody)} />
            </>
          ) : null}
          {rec.recognizedText ? (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 3 }}>Tanilgan matn:</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{rec.recognizedText}</div>
            </div>
          ) : null}
        </div>
      )}

      {/* Writing: o'quvchi yozgan matn */}
      {!isSpeaking && rec.inputText ? (
        <div className="card">
          <div className="sh-title" style={{ marginBottom: 6 }}>Sizning matningiz</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{rec.inputText}</div>
        </div>
      ) : null}

      {a ? (
        <>
          {/* Ballar diagramma */}
          <div className="card">
            <div className="sh-title" style={{ marginBottom: 10 }}>Baholar</div>
            <Bar label="Grammatika" value={a.scores.grammar} />
            <Bar label="So'z boyligi" value={a.scores.vocabulary} />
            <Bar label="Bog'lanish (coherence)" value={a.scores.coherence} />
            <Bar label="Mavzuga mosligi" value={a.scores.task} />
            {!isSpeaking ? <Bar label="Imlo/punktuatsiya" value={a.scores.mechanics} /> : null}
          </div>

          {/* Xulosa */}
          {a.summary ? (
            <div className="card">
              <div className="sh-title" style={{ marginBottom: 6 }}>Umumiy xulosa</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{a.summary}</div>
            </div>
          ) : null}

          {/* Kuchli / zaif tomonlar */}
          {(a.strengths.length > 0 || a.weaknesses.length > 0) && (
            <div className="card">
              {a.strengths.length > 0 && (
                <>
                  <div className="sh-title" style={{ marginBottom: 6, color: '#16a34a' }}>✓ Kuchli tomonlar</div>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                    {a.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </>
              )}
              {a.weaknesses.length > 0 && (
                <>
                  <div className="sh-title" style={{ marginBottom: 6, color: '#ef4444' }}>△ Yaxshilash kerak</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                    {a.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Tuzatishlar */}
          {a.corrections.length > 0 && (
            <div className="card">
              <div className="sh-title" style={{ marginBottom: 8 }}>Tuzatishlar</div>
              <div className="col gap10">
                {a.corrections.map((c, i) => (
                  <div key={i} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 13.5 }}>
                      <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{c.original}</span>
                      {' → '}
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>{c.suggestion}</span>
                    </div>
                    {c.explanation ? <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{c.explanation}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* So'z tahlili */}
          {a.vocabulary.length > 0 && (
            <div className="card">
              <div className="sh-title" style={{ marginBottom: 8 }}>So'z boyligi tavsiyalari</div>
              <div className="col gap8">
                {a.vocabulary.map((v, i) => (
                  <div key={i} className="row gap8" style={{ alignItems: 'flex-start' }}>
                    <span className="chip" style={{ background: 'var(--surface3)' }}>{v.word}</span>
                    <div style={{ flex: 1 }}>
                      {v.suggestion ? <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>{v.suggestion}</span> : null}
                      {v.note ? <div className="muted" style={{ fontSize: 12.5 }}>{v.note}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yaxshilangan variant */}
          {a.improved ? (
            <div className="card">
              <div className="sh-title" style={{ marginBottom: 6 }}>Yaxshilangan variant</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.improved}</div>
            </div>
          ) : null}

          {/* Tavsiyalar */}
          {a.recommendations.length > 0 && (
            <div className="card">
              <div className="sh-title" style={{ marginBottom: 6 }}>Tavsiyalar</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                {a.recommendations.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="muted" style={{ fontSize: 13.5 }}>
            AI matn tahlili mavjud emas{isSpeaking ? ' (faqat talaffuz bahosi)' : ''}.
          </div>
        </div>
      )}
    </div>
  )
}
