import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  disconnectIg, getIgConnectUrl, getIgSettings, getIgStatus, refreshIgToken, saveIgSettings,
  testIgAgent,
  type IgChannel, type IgSettings, type IgStatus, type IgTestAgentResult,
} from '@/api/services/instagram'
import {
  ChannelIcon, Icon, MarketingPage, MkCopyRow, MkError, MkLoading, MkStatusCard,
} from './mk'

/**
 * SOZLAMALAR — Instagram akkauntni ulash, modul bayroqlari va DIAGNOSTIKA.
 *
 * Sahifaning asosiy vazifasi — "nima ishlayapti, nima yetishmayapti" savoliga bir qarashda
 * javob berish: akkaunt ulanganmi, token necha kun qoldi, webhook obunasi bormi, Gemini
 * sozlanganmi, `.env` kalitlari qo'yilganmi.
 *
 * ⚠️ Maxfiy qiymatlar (token, app secret, verify token) HECH QACHON ko'rsatilmaydi —
 * faqat "sozlangan / sozlanmagan" holati.
 */
export function InstagramSettings() {
  const { can } = usePerm()
  const canEdit = can('marketing', 'edit')
  const [params, setParams] = useSearchParams()

  const [status, setStatus] = useState<IgStatus | null>(null)
  const [form, setForm] = useState<IgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState('')

  /** OAuth callback'dan qaytganda (`?connected=1`) muvaffaqiyat xabari ko'rsatiladi. */
  const justConnected = params.get('connected') === '1'

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([getIgStatus(), getIgSettings()])
      .then(([st, s]) => { setStatus(st); setForm(s) })
      .catch((e) => setError(apiErrorMessage(e, "Sozlamalarni yuklab bo'lmadi")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const patch = (p: Partial<IgSettings>) => setForm((f) => (f ? { ...f, ...p } : f))

  const save = async () => {
    if (!form) return
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const next = await saveIgSettings(form)
      setForm(next)
      setSaved('Sozlamalar saqlandi.')
      setStatus(await getIgStatus())
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  /** OAuth: server `state` yaratadi va bizni Instagram'ga yuboradi. */
  const connect = async () => {
    setBusy('connect')
    setError('')
    try {
      const url = await getIgConnectUrl()
      window.location.href = url
    } catch (e) {
      setError(apiErrorMessage(e, "Ulanish manzilini olib bo'lmadi"))
      setBusy('')
    }
  }

  const disconnect = async () => {
    if (!window.confirm("Akkaunt uziladi va jonli javoblar to'xtaydi. Davom etamizmi?")) return
    setBusy('disconnect')
    setError('')
    try {
      await disconnectIg()
      setStatus(await getIgStatus())
      setSaved('Akkaunt uzildi.')
    } catch (e) {
      setError(apiErrorMessage(e, "Uzib bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    setError('')
    try {
      setStatus(await refreshIgToken())
      setSaved('Token yangilandi.')
    } catch (e) {
      setError(apiErrorMessage(e, "Tokenni yangilab bo'lmadi"))
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <MarketingPage title="Sozlamalar" sub="Instagram akkaunt, AI va avtojavob bayroqlari">
        <MkLoading />
      </MarketingPage>
    )
  }

  if (!form || !status) {
    return (
      <MarketingPage title="Sozlamalar" sub="Instagram akkaunt, AI va avtojavob bayroqlari">
        <MkError text={error || "Ma'lumot yuklanmadi"} onRetry={load} />
      </MarketingPage>
    )
  }

  return (
    <MarketingPage
      title="Sozlamalar"
      sub="Instagram akkaunt, AI va avtojavob bayroqlari"
      actions={canEdit && (
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Icon name="check" /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      )}
    >
      <div className="fade-up">
        {justConnected && (
          <div className="mk-alert" style={{ borderColor: 'var(--success)', background: 'var(--success-soft)', color: '#0d6b4b' }}>
            <Icon name="check" style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="mk-alert-title">Instagram akkaunt ulandi</div>
              <div>Endi modulni yoqing va avtojavob bayroqlarini tanlang.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { params.delete('connected'); setParams(params, { replace: true }) }}>
              <Icon name="close" /> Yopish
            </button>
          </div>
        )}

        {error && <div style={{ marginBottom: 16 }}><MkError text={error} /></div>}
        {saved && !error && (
          <div className="mk-alert" style={{ borderColor: 'var(--success)', background: 'var(--success-soft)', color: '#0d6b4b' }}>
            <Icon name="check" style={{ width: 18, height: 18, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{saved}</div>
          </div>
        )}

        {/* ── AKKAUNT ── */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head">
            <div className="section-title">Instagram akkaunt</div>
            {status.connected && canEdit && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={refresh} disabled={busy === 'refresh'}>
                  <Icon name="refresh" /> Tokenni yangilash
                </button>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={disconnect} disabled={busy === 'disconnect'}>
                  <Icon name="unlink" /> Uzish
                </button>
              </div>
            )}
          </div>

          {status.connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="ch-icon ch-instagram" style={{ width: 46, height: 46, borderRadius: 13 }}>
                <ChannelIcon />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>@{status.username || '—'}</div>
                <div className="page-sub">{status.name}</div>
              </div>
              <span className="badge badge-success"><span className="badge-dot" /> Ulangan</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>Akkaunt ulanmagan</div>
                <div className="field-hint">
                  Instagram professional (Business yoki Creator) akkauntini ulang — izoh va DM'lar
                  shundan keyin keladi.
                </div>
              </div>
              {canEdit && (
                <button className="btn btn-primary" onClick={connect} disabled={busy === 'connect'}>
                  <Icon name="link" /> Instagram akkauntni ulash
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── META ILOVASI ──
            App ID AYNAN shu yerdan kiritiladi: usisiz «Ulash» tugmasi ishlamaydi (server
            "App ID kiritilmagan" deb qaytaradi). App Secret va Verify Token esa `.env` da —
            ular bu yerda ko'rsatilmaydi ham, so'ralmaydi ham. */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head">
            <div>
              <div className="section-title">Meta ilovasi</div>
              <div className="page-sub">developers.facebook.com → Instagram → API setup with Instagram login</div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Instagram App ID</label>
            <input
              className="input" value={form.instagramAppId} disabled={!canEdit}
              onChange={(e) => patch({ instagramAppId: e.target.value })}
              placeholder="masalan: 1234567890123456"
            />
            <div className="field-hint">
              Maxfiy emas — OAuth havolasida baribir ochiq ko'rinadi. Saqlanmaguncha
              «Instagram akkauntni ulash» tugmasi ishlamaydi.
            </div>
          </div>
        </div>

        {/* ── DIAGNOSTIKA ── */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head">
            <div>
              <div className="section-title">Holat</div>
              <div className="page-sub">Maxfiy qiymatlar ko'rsatilmaydi — faqat sozlangani belgilanadi</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load}><Icon name="refresh" /> Yangilash</button>
          </div>
          <div className="mk-status-grid">
            <MkStatusCard label="Modul" ok={status.enabled} value={status.enabled ? 'Yoqilgan' : "O'chirilgan"} hint={status.enabled ? undefined : 'Jonli javob ketmaydi'} />
            <MkStatusCard label="Akkaunt" ok={status.connected} value={status.connected ? `@${status.username}` : 'Ulanmagan'} />
            <MkStatusCard
              label="Token muddati"
              ok={status.connected && status.tokenDaysLeft > 15}
              warn={status.connected && status.tokenDaysLeft > 0}
              value={status.connected ? `${status.tokenDaysLeft} kun qoldi` : '—'}
              hint={status.connected && status.tokenDaysLeft <= 15 ? 'Tez orada yangilanadi' : undefined}
            />
            <MkStatusCard label="Webhook obunasi" ok={status.webhookSubscribed} value={status.webhookSubscribed ? 'Faol' : 'Yo‘q'} />
            <MkStatusCard label="INSTAGRAM_APP_SECRET" ok={status.appSecretSet} hint=".env fayldan o'qiladi" />
            <MkStatusCard label="INSTAGRAM_VERIFY_TOKEN" ok={status.verifyTokenSet} hint=".env fayldan o'qiladi" />
            <MkStatusCard label="App ID" ok={status.appIdSet} />
            <MkStatusCard label="Gemini (AI)" ok={status.geminiConfigured} hint={status.geminiConfigured ? undefined : "AI javob bera olmaydi"} />
            <MkStatusCard
              label="Bilim bazasi"
              ok={status.knowledgeCount > 0}
              value={`${status.knowledgeCount} ta bo'lak`}
              hint={status.knowledgeCount > 0 ? undefined : "Bo'sh — AI javob bermaydi"}
            />
            <MkStatusCard
              label="Navbat"
              ok={status.failedEvents === 0}
              warn={status.failedEvents === 0 && status.pendingEvents > 0}
              value={`${status.pendingEvents} kutmoqda · ${status.failedEvents} xato`}
            />
            <MkStatusCard
              label="Bugungi javoblar"
              ok={status.todayReplies < status.dailyLimit}
              value={`${status.todayReplies} / ${status.dailyLimit}`}
              hint="Kunlik chegara"
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <MkCopyRow
              label="Webhook URL"
              value={status.webhookUrl}
              hint="Meta konsolida «Callback URL» sifatida ko'rsatiladi."
            />
            <MkCopyRow
              label="OAuth callback URL"
              value={status.callbackUrl}
              hint="Meta konsolidagi «Valid OAuth Redirect URIs» ro'yxatiga aynan shu manzil qo'shiladi."
            />
          </div>
        </div>

        {/* ── AVTOJAVOB ── */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head"><div className="section-title">Avtojavob</div></div>

          <Toggle
            name="Modul yoqilgan"
            desc="O'chirilgan bo'lsa hech qanday tashqi so'rov ketmaydi va hech kimga javob yozilmaydi."
            on={form.instagramEnabled}
            disabled={!canEdit}
            onToggle={() => patch({ instagramEnabled: !form.instagramEnabled })}
          />
          <Toggle
            name="Izohlarga javob berish"
            desc="Post ostidagi izohlarga AI qisqa javob yozadi (1-2 gap)."
            on={form.instagramAutoReplyComments}
            disabled={!canEdit}
            onToggle={() => patch({ instagramAutoReplyComments: !form.instagramAutoReplyComments })}
          />
          <Toggle
            name="DM (shaxsiy xabar) ga javob berish"
            desc="To'g'ridan-to'g'ri xabarlarga batafsil javob. Instagram qoidasi: oxirgi xabardan 24 soat ichida."
            on={form.instagramAutoReplyDm}
            disabled={!canEdit}
            onToggle={() => patch({ instagramAutoReplyDm: !form.instagramAutoReplyDm })}
          />
          <Toggle
            name="Izohga shaxsiy javob (private reply)"
            desc="Izoh qoldirgan odamga qo'shimcha ravishda DM ham yuboriladi (izohdan keyingi 7 kun ichida)."
            on={form.instagramPrivateReplyEnabled}
            disabled={!canEdit}
            onToggle={() => patch({ instagramPrivateReplyEnabled: !form.instagramPrivateReplyEnabled })}
          />
          <Toggle
            name="Telegram'ga xabar berish"
            desc="Qaynoq lid paydo bo'lsa yoki operator kerak bo'lsa adminlarga Telegram xabari ketadi."
            on={form.instagramNotifyTelegram}
            disabled={!canEdit}
            onToggle={() => patch({ instagramNotifyTelegram: !form.instagramNotifyTelegram })}
          />
        </div>

        {/* ── AI VA CHEGARALAR ── */}
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head"><div className="section-title">AI va chegaralar</div></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="field-label">Gemini modeli</label>
              <input
                className="input" value={form.instagramAiModel} disabled={!canEdit}
                onChange={(e) => patch({ instagramAiModel: e.target.value })}
                placeholder="bo'sh = tizim default'i"
              />
              <div className="field-hint">Bo'sh qoldirilsa loyihaning standart modeli ishlatiladi.</div>
            </div>

            <div className="field">
              <label className="field-label">Lid manbasi</label>
              <input
                className="input" value={form.instagramLeadSource} disabled={!canEdit}
                onChange={(e) => patch({ instagramLeadSource: e.target.value })}
                placeholder="Instagram"
              />
              <div className="field-hint">Yaratilgan lidlarda «Manba» maydoniga shu nom yoziladi.</div>
            </div>

            <div className="field">
              <label className="field-label">Javob kechikishi (soniya)</label>
              <input
                className="input" type="number" min={0} max={120} disabled={!canEdit}
                value={form.instagramReplyDelaySeconds}
                onChange={(e) => patch({ instagramReplyDelaySeconds: Number(e.target.value) || 0 })}
              />
              <div className="field-hint">Bir zumda kelgan javob robot bo'lib ko'rinadi — kichik pauza tabiiyroq.</div>
            </div>

            <div className="field">
              <label className="field-label">Kunlik javob chegarasi</label>
              <input
                className="input" type="number" min={0} max={5000} disabled={!canEdit}
                value={form.instagramDailyReplyLimit}
                onChange={(e) => patch({ instagramDailyReplyLimit: Number(e.target.value) || 0 })}
              />
              <div className="field-hint">Himoya chegarasi: kutilmagan halqada akkaunt spam sifatida bloklanmasin.</div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Salomlashuv matni</label>
            <textarea
              className="textarea" value={form.instagramGreeting} disabled={!canEdit}
              onChange={(e) => patch({ instagramGreeting: e.target.value })}
              placeholder="Assalomu alaykum! Men markazning AI yordamchisiman…"
            />
            <div className="field-hint">
              Bu matnda AI ekani OSHKOR qilinishi kerak — Meta qoidasi ham, odob qoidasi ham shuni talab qiladi.
            </div>
          </div>
        </div>

        {/* ── SINOV ── */}
        <TestBlock canEdit={canEdit} />
      </div>
    </MarketingPage>
  )
}

/** Sozlamalardagi bitta bayroq qatori (nom + izoh + switch). */
function Toggle({
  name, desc, on, onToggle, disabled,
}: {
  name: string
  desc: string
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="row-between">
      <div>
        <div className="opt-name">{name}</div>
        <div className="opt-desc">{desc}</div>
      </div>
      <div
        className={'switch ' + (on ? 'on' : '')}
        style={disabled ? { opacity: .5, cursor: 'not-allowed' } : undefined}
        onClick={() => { if (!disabled) onToggle() }}
      />
    </div>
  )
}

/**
 * SINOV: matn yoziladi va AI javobi ko'rsatiladi.
 * ⚠️ Javob mijozga JONLI YUBORILMAYDI — faqat shu ekranda ko'rinadi.
 */
function TestBlock({ canEdit }: { canEdit: boolean }) {
  const [channel, setChannel] = useState<IgChannel>('dm')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<IgTestAgentResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!message.trim()) return
    setRunning(true)
    setError('')
    setResult(null)
    try {
      setResult(await testIgAgent(channel, message.trim()))
    } catch (e) {
      setError(apiErrorMessage(e, 'Sinov bajarilmadi'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="card card-pad">
      <div className="section-head">
        <div>
          <div className="section-title">Sinov</div>
          <div className="page-sub">AI javobi faqat shu yerda ko'rinadi — mijozga yuborilmaydi</div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Kanal</label>
        <div className="seg" style={{ width: 'fit-content' }}>
          {([['dm', 'Shaxsiy xabar'], ['comment', 'Izoh']] as const).map(([k, l]) => (
            <button key={k} className={channel === k ? 'active' : ''} onClick={() => setChannel(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Mijoz xabari</label>
        <textarea
          className="textarea" value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Masalan: Ingliz tili kursi qancha turadi?"
        />
      </div>

      <button className="btn btn-primary" onClick={run} disabled={!canEdit || running || !message.trim()}>
        <Icon name="play" /> {running ? 'Tekshirilmoqda…' : 'Sinab ko‘rish'}
      </button>

      {error && <div style={{ marginTop: 14 }}><MkError text={error} /></div>}

      {result && (
        <div style={{ marginTop: 16 }}>
          {result.ok ? (
            <>
              <div className="flow-step">
                <div className="flow-step-label"><Icon name="sparkle" style={{ width: 13, height: 13 }} /> AI javobi</div>
                <div className="reply-preview" style={{ whiteSpace: 'pre-line' }}>{result.reply}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <span className="badge badge-ai">Til: {result.language || '—'}</span>
                <span className="badge badge-ai">Niyat: {result.intent || '—'}</span>
                <span className="badge badge-ai">Ball: {result.leadScore}</span>
                {result.isHotLead && <span className="badge badge-warning"><Icon name="fire" style={{ width: 11, height: 11 }} /> Qaynoq lid</span>}
                {result.escalateToHuman && <span className="badge badge-danger">Operator kerak</span>}
              </div>
            </>
          ) : (
            <MkError text={result.error || 'AI javob bermadi'} />
          )}
        </div>
      )}
    </div>
  )
}
