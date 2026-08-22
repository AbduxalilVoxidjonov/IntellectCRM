import { useEffect, useState } from 'react'
import { apiErrorMessage } from '@/lib/utils'
import {
  generateIgCaption, getIgCaptionMeta,
  type IgCaptionMeta, type IgPostType,
} from '@/api/services/instagramContent'
import { Icon } from '../mk'

/**
 * ✨ AI BILAN CAPTION YOZISH (§5.10) — mavzu → tayyor post matni.
 *
 * Matn markazning BILIM BAZASIDAN (Marketing → Bilim bazasi) quriladi, ya'ni AI aynan shu
 * markaz haqida yozadi. Uslub va til ro'yxati SERVERDAN keladi (`content/caption/meta`) —
 * kalitlar ikki joyda qo'lda yozilsa drift bo'lardi (`contacts.md` §6 saboqi).
 *
 * ⚠️ MATN USTIGA JIMGINA YOZILMAYDI. Caption maydoni bo'sh bo'lsa natija darhol qo'yiladi;
 * matn BOR bo'lsa esa avval ko'rsatiladi va foydalanuvchi «Almashtirish» yoki «Oxiriga
 * qo'shish» ni O'ZI tanlaydi — bir soatlik ishni bitta tugma o'chirib yuborishi mumkin edi.
 *
 * ⚠️ Natija SERVERDA allaqachon chegaralarga (2200 belgi / 30 hashtag / 20 mention)
 * solishtirilgan va hashtaglar matn oxiriga qo'shilgan. Shuning uchun ro'yxatdagi hashtag
 * chiplari faqat KO'RSATISH uchun — ular matnga qayta qo'shilmaydi.
 *
 * ⚠️ Ilgari bu panel 900px'lik modal ichida siqilgan edi: mavzu maydoni ikki qatorli,
 * natija esa 220px oynachada skrollanardi. Endi composer to'liq ekranda — mavzu maydoni
 * kattaroq, uslub/til yonma-yon, natija esa o'qishga qulay kenglikda. MANTIQ o'zgarmadi.
 */
export function CaptionAi({
  postType, hasText, onApply, onClose,
}: {
  postType: IgPostType
  hasText: boolean
  onApply: (text: string, mode: 'replace' | 'append') => void
  onClose: () => void
}) {
  const [meta, setMeta] = useState<IgCaptionMeta | null>(null)
  const [metaError, setMetaError] = useState('')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('')
  const [language, setLanguage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ caption: string; hashtags: string[] } | null>(null)

  useEffect(() => {
    let alive = true
    getIgCaptionMeta()
      .then((m) => {
        if (!alive) return
        setMeta(m)
        setTone(m.defaultTone)
        setLanguage(m.defaultLanguage)
      })
      .catch((e) => { if (alive) setMetaError(apiErrorMessage(e, "Sozlamalarni olib bo'lmadi")) })
    return () => { alive = false }
  }, [])

  // ⚠️ Gemini kaliti yo'q bo'lsa tugma OLDINDAN o'chiriladi va sabab ko'rinadi — foydalanuvchi
  // bosib, kutib, keyin xato olishi kerak emas.
  const ready = !!meta && meta.geminiConfigured
  const canRun = ready && !busy && topic.trim().length > 0

  const run = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await generateIgCaption({ postType, topic: topic.trim(), tone, language })
      // ⚠️ Javob 200 bo'lgani MUVAFFAQIYAT DEGANI EMAS: sabab `ok`/`error` da (kalit
      // sozlanmagan, Gemini timeout, format buzuq). `ok` ni tekshirmaslik foydalanuvchiga
      // BO'SH matn qo'yib qo'yardi.
      if (!res.ok) { setError(res.error || 'AI matn yoza olmadi.'); return }
      // Maydon bo'sh — yo'qotadigan narsa yo'q, tasdiq ham so'ralmaydi.
      if (!hasText) { onApply(res.caption, 'replace'); return }
      setResult({ caption: res.caption, hashtags: res.hashtags })
    } catch (e) {
      setError(apiErrorMessage(e, "AI'ga so'rov yuborib bo'lmadi"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mk-kb-item" style={{ marginBottom: 16 }}>
      <div className="mk-kb-head">
        <span className="rule-num"><Icon name="sparkle" style={{ width: 13, height: 13 }} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>AI bilan matn yozish</div>
          <div className="field-hint" style={{ margin: 0 }}>
            Mavzuni yozing — qolganini markazning bilim bazasi asosida AI yozadi.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <Icon name="close" /> Yopish
        </button>
      </div>

      {metaError && <div className="field-hint" style={{ color: 'var(--danger)' }}>{metaError}</div>}

      {meta && !meta.geminiConfigured && (
        <div className="mk-alert" style={{ marginBottom: 12 }}>
          <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5 }}>
            <div className="mk-alert-title">Gemini API kaliti sozlanmagan</div>
            Kalit yo‘q (<code>.env</code> → <code>GEMINI_API_KEY</code>) — AI matn yoza olmaydi.
            Kalit qo‘shilgach bu tugma o‘zi ishlay boshlaydi.
          </div>
        </div>
      )}

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label">Mavzu</label>
        <textarea
          className="textarea"
          rows={4}
          value={topic}
          placeholder="Masalan: yozgi ingliz tili guruhiga qabul, dars kuniga 1 soat, chegirma bor"
          onChange={(e) => setTopic(e.target.value)}
        />
        <div className="field-hint">
          Matn markazning <b>bilim bazasi</b> asosida yoziladi — narx va jadval o‘ylab topilmaydi.
          Bilim bazasi bo‘sh bo‘lsa natija ham umumiy chiqadi.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="field" style={{ margin: 0 }}>
          <label className="field-label">Uslub</label>
          <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
            {(meta?.tones ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="field-label">Til</label>
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {(meta?.languages ?? []).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="mk-state mk-state-error" style={{ padding: 12, marginBottom: 12 }}>
          <Icon name="warn" style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {!result && (
        <button className="btn btn-primary btn-sm" disabled={!canRun} onClick={() => void run()}>
          <Icon name="sparkle" /> {busy ? 'Yozilmoqda…' : 'Matn yozdirish'}
        </button>
      )}

      {result && (
        <div>
          <div className="field-label">AI yozgan matn</div>
          <div
            style={{
              whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, maxHeight: 380,
              overflowY: 'auto', padding: 14, borderRadius: 10,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
            }}
          >
            {result.caption}
          </div>

          {result.hashtags.length > 0 && (
            <>
              <div className="field-hint">
                Hashtaglar ({result.hashtags.length} ta) matn oxiriga <b>allaqachon</b> qo‘shilgan —
                pastdagi ro‘yxat faqat ko‘rsatish uchun.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {result.hashtags.map((h) => <span className="match-pill" key={h}>{h}</span>)}
              </div>
            </>
          )}

          {/* Caption maydonida matn bor — shuning uchun tanlov O'ZIDA so'raladi. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onApply(result.caption, 'replace')}>
              <Icon name="check" /> Almashtirish
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => onApply(result.caption, 'append')}>
              <Icon name="plus" /> Oxiriga qo‘shish
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setResult(null)}>
              <Icon name="refresh" /> Boshqattan yozdirish
            </button>
          </div>
          <div className="field-hint" style={{ marginTop: 6 }}>
            ⚠️ «Almashtirish» maydondagi mavjud matnni <b>butunlay</b> o‘chiradi.
          </div>
        </div>
      )}
    </div>
  )
}
