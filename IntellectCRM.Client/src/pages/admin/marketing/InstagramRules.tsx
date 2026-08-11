import { useCallback, useEffect, useState } from 'react'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  createIgRule, deleteIgRule, getIgRules, updateIgRule,
  type IgRule, type IgRuleChannel, type IgRulePayload,
} from '@/api/services/instagram'
import { Icon, MarketingPage, MkEmpty, MkError, MkLoading } from './mk'

/** Qoida qaysi kanalda ishlashi. */
const CHANNELS: { key: IgRuleChannel; label: string }[] = [
  { key: 'any', label: 'Ikkalasi' },
  { key: 'comment', label: 'Izoh' },
  { key: 'dm', label: 'Shaxsiy xabar' },
]

const channelLabel = (c: IgRuleChannel) => CHANNELS.find((x) => x.key === c)?.label ?? c

const EMPTY: IgRulePayload = {
  title: '',
  keywords: '',
  channel: 'any',
  replyText: '',
  stopAi: true,
  isActive: true,
  order: 0,
}

/**
 * JAVOB QOIDALARI — kalit so'z → tayyor javob.
 *
 * Qoidalar AI'dan OLDIN tekshiriladi: mos kelsa javob darhol (tez va arzon) yuboriladi.
 * «AI'ni to'xtatish» yoqilgan bo'lsa qoida ishlagach AI umuman chaqirilmaydi.
 * Tartib (`order`) muhim — birinchi mos kelgan qoida ishlaydi.
 */
export function InstagramRules() {
  const { can } = usePerm()
  const canCreate = can('marketing', 'create')
  const canEdit = can('marketing', 'edit')
  const canDelete = can('marketing', 'delete')

  const [rules, setRules] = useState<IgRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<IgRule | 'new' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getIgRules()
      .then(setRules)
      .catch((e) => setError(apiErrorMessage(e, "Qoidalarni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const remove = async (r: IgRule) => {
    if (!window.confirm(`«${r.title}» qoidasi o'chirilsinmi?`)) return
    setError('')
    try {
      await deleteIgRule(r.id)
      load()
    } catch (e) {
      setError(apiErrorMessage(e, "O'chirib bo'lmadi"))
    }
  }

  return (
    <MarketingPage
      title="Javob qoidalari"
      sub="Kalit so'z → tayyor javob. AI'dan oldin ishlaydi."
      actions={canCreate && (
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Icon name="plus" /> Yangi qoida
        </button>
      )}
    >
      <div className="fade-up">
        {error && <div style={{ marginBottom: 14 }}><MkError text={error} onRetry={load} /></div>}

        {loading && <MkLoading />}

        {!loading && rules.length === 0 && (
          <MkEmpty
            text="Qoida yo'q"
            hint="Eng ko'p beriladigan savollar (narx, manzil, ish vaqti) uchun qoida qo'shsangiz, javob bir zumda va aniq bo'ladi."
          />
        )}

        {!loading && rules.length > 0 && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="mk-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Tartib</th>
                  <th>Sarlavha</th>
                  <th>Kalit so'zlar</th>
                  <th>Kanal</th>
                  <th>Javob</th>
                  <th>AI</th>
                  <th>Holat</th>
                  <th className="mk-num">Moslik</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="mk-num">{r.order}</td>
                    <td style={{ fontWeight: 700 }}>{r.title}</td>
                    <td>
                      <div className="kw-wrap">
                        {r.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => (
                          <span key={k} className="chip-kw">{k}</span>
                        ))}
                      </div>
                    </td>
                    <td>{channelLabel(r.channel)}</td>
                    <td style={{ maxWidth: 320, color: 'var(--text-2)' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.replyText}
                      </div>
                    </td>
                    <td>
                      {r.stopAi
                        ? <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>To'xtatiladi</span>
                        : <span className="badge badge-ai"><Icon name="sparkle" style={{ width: 11, height: 11 }} /> Davom etadi</span>}
                    </td>
                    <td>
                      {r.isActive
                        ? <span className="badge badge-success"><span className="badge-dot" /> Faol</span>
                        : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>O'chiq</span>}
                    </td>
                    <td className="mk-num">{r.matchCount.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <button className="icon-btn" title="Tahrirlash" style={{ width: 32, height: 32 }} onClick={() => setModal(r)}>
                            <Icon name="edit" style={{ width: 15, height: 15 }} />
                          </button>
                        )}
                        {canDelete && (
                          <button className="icon-btn" title="O'chirish" style={{ width: 32, height: 32, color: 'var(--danger)' }} onClick={() => remove(r)}>
                            <Icon name="trash" style={{ width: 15, height: 15 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modal && (
          <RuleModal
            rule={modal === 'new' ? null : modal}
            nextOrder={rules.length ? Math.max(...rules.map((r) => r.order)) + 1 : 1}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); load() }}
          />
        )}
      </div>
    </MarketingPage>
  )
}

/** Qoida yaratish/tahrirlash modali. */
function RuleModal({
  rule, nextOrder, onClose, onSaved,
}: {
  rule: IgRule | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<IgRulePayload>(
    rule
      ? {
        title: rule.title,
        keywords: rule.keywords,
        channel: rule.channel,
        replyText: rule.replyText,
        stopAi: rule.stopAi,
        isActive: rule.isActive,
        order: rule.order,
      }
      : { ...EMPTY, order: nextOrder },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const patch = (p: Partial<IgRulePayload>) => setForm((f) => ({ ...f, ...p }))

  const save = async () => {
    if (!form.title.trim() || !form.replyText.trim()) {
      setError("Sarlavha va javob matni to'ldirilishi shart.")
      return
    }
    setSaving(true)
    setError('')
    try {
      if (rule) await updateIgRule(rule.id, form)
      else await createIgRule(form)
      onSaved()
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{rule ? 'Qoidani tahrirlash' : 'Yangi qoida'}</div>
          <button className="icon-btn" onClick={onClose} style={{ background: 'transparent' }}>
            <Icon name="close" style={{ width: 17, height: 17 }} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div style={{ marginBottom: 14 }}><MkError text={error} /></div>}

          <div className="field">
            <label className="field-label">Sarlavha</label>
            <input
              className="input" value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Masalan: Narx so'rovlari"
            />
          </div>

          <div className="field">
            <label className="field-label">Kalit so'zlar</label>
            <input
              className="input" value={form.keywords}
              onChange={(e) => patch({ keywords: e.target.value })}
              placeholder="narx, qancha, narxi, price, цена"
            />
            <div className="field-hint">Vergul bilan ajrating. Mijoz shu so'zlardan birini yozsa qoida ishlaydi.</div>
          </div>

          <div className="field">
            <label className="field-label">Kanal</label>
            <div className="seg" style={{ width: 'fit-content' }}>
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  className={form.channel === c.key ? 'active' : ''}
                  onClick={() => patch({ channel: c.key })}
                >{c.label}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Javob matni</label>
            <textarea
              className="textarea" value={form.replyText}
              onChange={(e) => patch({ replyText: e.target.value })}
              placeholder="Mijozga yuboriladigan javob…"
            />
          </div>

          <div className="field">
            <label className="field-label">Tartib</label>
            <input
              className="input" type="number" min={0} value={form.order}
              onChange={(e) => patch({ order: Number(e.target.value) || 0 })}
              style={{ maxWidth: 140 }}
            />
            <div className="field-hint">Kichik raqam oldin tekshiriladi — birinchi mos kelgan qoida ishlaydi.</div>
          </div>

          <div className="row-between">
            <div>
              <div className="opt-name">AI'ni to'xtatish</div>
              <div className="opt-desc">
                Yoqilgan bo'lsa qoida javob bergach AI umuman chaqirilmaydi (tez va arzon).
                O'chirilsa AI javobni to'ldiradi.
              </div>
            </div>
            <div className={'switch ' + (form.stopAi ? 'on' : '')} onClick={() => patch({ stopAi: !form.stopAi })} />
          </div>

          <div className="row-between">
            <div>
              <div className="opt-name">Faol</div>
              <div className="opt-desc">O'chirilgan qoida saqlanadi, lekin ishlamaydi.</div>
            </div>
            <div className={'switch ' + (form.isActive ? 'on' : '')} onClick={() => patch({ isActive: !form.isActive })} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Icon name="check" /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  )
}
