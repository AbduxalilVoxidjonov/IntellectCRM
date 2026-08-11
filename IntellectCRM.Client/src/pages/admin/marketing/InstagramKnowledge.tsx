import { useCallback, useEffect, useState } from 'react'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import { getIgKnowledge, saveIgKnowledge, type IgKnowledge } from '@/api/services/instagram'
import { Icon, MarketingPage, MkEmpty, MkError, MkLoading } from './mk'

/**
 * BILIM BAZASI — AI javoblarining YAGONA manbasi.
 *
 * ⚠️ AI faqat shu yerda yozilgan ma'lumot asosida javob beradi: narxni, chegirmani yoki
 * jadvalni O'YLAB TOPMAYDI. Bu yer bo'sh bo'lsa agent hech qanday mazmunli javob bera olmaydi.
 *
 * Barcha bo'laklar BITTA «Saqlash» tugmasi bilan yuboriladi (bulk `PUT /knowledge`) —
 * qatorlarni erkin qo'shib/o'chirib, tartibini o'zgartirib, so'ng bir marta saqlaysiz.
 */
export function InstagramKnowledge() {
  const { can } = usePerm()
  const canEdit = can('marketing', 'edit')

  const [items, setItems] = useState<IgKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [dirty, setDirty] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getIgKnowledge()
      .then((xs) => { setItems(xs); setDirty(false) })
      .catch((e) => setError(apiErrorMessage(e, "Bilim bazasini yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const patch = (i: number, p: Partial<IgKnowledge>) => {
    setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)))
    setDirty(true)
    setSaved('')
  }

  const add = () => {
    setItems((xs) => [...xs, { title: '', content: '', order: xs.length + 1, isActive: true }])
    setDirty(true)
    setSaved('')
  }

  const remove = (i: number) => {
    if (!window.confirm("Bo'lak o'chirilsinmi? (Saqlaganingizdan keyin yo'qoladi)")) return
    setItems((xs) => xs.filter((_, k) => k !== i))
    setDirty(true)
    setSaved('')
  }

  /** Tartibni almashtirish — `order` maydonlari qayta raqamlanadi. */
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    setItems(next.map((x, k) => ({ ...x, order: k + 1 })))
    setDirty(true)
    setSaved('')
  }

  const save = async () => {
    const empty = items.findIndex((x) => !x.title.trim() || !x.content.trim())
    if (empty >= 0) {
      setError(`${empty + 1}-bo'lakning sarlavhasi yoki matni bo'sh — to'ldiring yoki o'chiring.`)
      return
    }
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const next = await saveIgKnowledge(items.map((x, k) => ({ ...x, order: k + 1 })))
      setItems(next)
      setDirty(false)
      setSaved(`Saqlandi — ${next.length} ta bo'lak.`)
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <MarketingPage
      title="Bilim bazasi"
      sub="AI shu ma'lumot asosida javob beradi"
      actions={canEdit && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={add}><Icon name="plus" /> Bo'lak qo'shish</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            <Icon name="check" /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      )}
    >
      <div className="fade-up">
        <div className="mk-alert">
          <Icon name="warn" style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="mk-alert-title">AI FAQAT shu ma'lumot asosida javob beradi</div>
            <div>
              Narx, jadval, chegirma va shartlarni AI o'ylab topmaydi — bu yerda yozilmagan
              savolga u «aniq ma'lumot uchun murojaat qiling» deb javob beradi. Ma'lumot
              o'zgarsa (masalan narx) shu yerni yangilash SHART.
            </div>
          </div>
        </div>

        {error && <div style={{ marginBottom: 14 }}><MkError text={error} /></div>}
        {saved && !error && (
          <div className="mk-alert" style={{ borderColor: 'var(--success)', background: 'var(--success-soft)', color: '#0d6b4b' }}>
            <Icon name="check" style={{ width: 18, height: 18, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{saved}</div>
          </div>
        )}

        {loading && <MkLoading />}

        {!loading && items.length === 0 && (
          <MkEmpty
            text="Bilim bazasi bo'sh"
            hint="Kurslar, narxlar, manzil, ish vaqti, hujjatlar — har mavzu uchun alohida bo'lak qo'shing."
          />
        )}

        {!loading && items.map((it, i) => (
          <div className="mk-kb-item" key={it.id ?? `yangi-${i}`}>
            <div className="mk-kb-head">
              <span className="rule-num">{i + 1}</span>
              <input
                className="input"
                style={{ flex: 1 }}
                value={it.title}
                disabled={!canEdit}
                onChange={(e) => patch(i, { title: e.target.value })}
                placeholder="Bo'lak sarlavhasi — masalan: Kurslar va narxlar"
              />
              {canEdit && (
                <>
                  <button className="icon-btn" title="Yuqoriga" style={{ width: 34, height: 34 }} onClick={() => move(i, -1)} disabled={i === 0}>
                    <Icon name="chevUp" style={{ width: 16, height: 16 }} />
                  </button>
                  <button className="icon-btn" title="Pastga" style={{ width: 34, height: 34 }} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                    <Icon name="chevDown" style={{ width: 16, height: 16 }} />
                  </button>
                  <div
                    className={'switch ' + (it.isActive ? 'on' : '')}
                    title={it.isActive ? 'Faol' : "O'chiq"}
                    onClick={() => patch(i, { isActive: !it.isActive })}
                  />
                  <button className="icon-btn" title="O'chirish" style={{ width: 34, height: 34, color: 'var(--danger)' }} onClick={() => remove(i)}>
                    <Icon name="trash" style={{ width: 16, height: 16 }} />
                  </button>
                </>
              )}
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 150 }}
              value={it.content}
              disabled={!canEdit}
              onChange={(e) => patch(i, { content: e.target.value })}
              placeholder="Matn: aniq faktlar, narxlar, shartlar. Qanday yozsangiz — AI shunday aytadi."
            />
            {it.updatedAt && (
              <div className="field-hint">
                Oxirgi o'zgarish: {it.updatedAt}{it.updatedBy ? ` · ${it.updatedBy}` : ''}
              </div>
            )}
          </div>
        ))}

        {!loading && canEdit && items.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-outline" onClick={add}><Icon name="plus" /> Bo'lak qo'shish</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
              <Icon name="check" /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
            {dirty && <span className="field-hint" style={{ alignSelf: 'center' }}>Saqlanmagan o'zgarishlar bor</span>}
          </div>
        )}
      </div>
    </MarketingPage>
  )
}
