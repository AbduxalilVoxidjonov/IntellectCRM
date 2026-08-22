import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  countHashtags, countMentions, createIgPost, defaultKind, emptyMedia, emptyOptions,
  getIgPost, isEditable, isHttpsUrl, isJpegUrl, isVideoUrl, publishIgPost, updateIgPost,
  IG_LIMITS, IG_POST_TYPES,
  type IgMediaItem, type IgPost, type IgPostOptions, type IgPostType,
} from '@/api/services/instagramContent'
import { Icon, MarketingPage, MkCard, MkDialog, MkError, MkLoading, MkNotice, MkSteps } from '../mk'
import { fmtBytes, fmtWhen, isVertical, postTypeIcon, trim } from './helpers'
import { MediaEditor, MediaRequirements } from './MediaEditor'
import { CaptionAi } from './CaptionAi'
import { IgPreview } from './IgPreview'

/**
 * POST MUHARRIRI (composer) — TO'LIQ EKRANLI ALOHIDA SAHIFA.
 *
 * Ilgari bu forma 900px'lik MODAL ichida edi: ikkita ustun siqilib, media maydonlari,
 * AI paneli va Instagram ko'rinishi bir-birini itarardi. Endi u alohida marshrut:
 *   `/admin/marketing/kontent/yangi`      — yangi post;
 *   `/admin/marketing/kontent/post/:id`   — mavjud rejani tahrirlash.
 *
 * ⚠️ BOSQICHLAR — SEHRGAR (wizard) EMAS. Ular shunchaki bitta formaning bo'laklari va
 * QULFLANMAYDI: foydalanuvchi istagan bosqichga bosa oladi. Sabab: tahrirlashda odam ko'pincha
 * BITTA narsani (masalan vaqtni) o'zgartirgani keladi — uni to'rtta qadamdan o'tkazish bekorga
 * ish bo'lardi.
 *
 * ⚠️ Faol bosqich URL'da (`?bosqich=matn`) saqlanadi — sahifa yangilansa yoki havola ulashilsa
 * o'sha joy ochiladi.
 *
 * ⚠️ Instagram ko'rinishi (`IgPreview`) o'ng ustunda HAR BOSQICHDA turadi: odam nima
 * yasayotganini doim ko'rib tursin (modal'da u faqat forma yonida siqilib turardi).
 *
 * ⚠️ MEDIA MANZILI OCHIQ HTTPS BO'LISHI SHART — Instagram faylni O'ZI yuklab oladi. Uchta
 * yo'l bor va uchalasi ham QOLADI (batafsil `MediaEditor.tsx` da):
 * 1. «Fayl yuklash» (yoki sudrab tashlash) — ALOHIDA ochiq papkaga;
 * 2. «Fayldan o'lchash» — fayl YUKLANMAYDI, faqat brauzerda o'lchanadi;
 * 3. manzilni QO'LDA yozish.
 *
 * ⚠️ O'lchamlar 0 = "noma'lum" — backend bunday holatda tekshiruvni o'tkazib yuboradi.
 */

/** Bosqichlar — sahifa ichidagi "sub-sahifa" tugmalari. */
const STEPS = [
  { id: 'tur', label: 'Tur va media', hint: 'Nima chiqadi', icon: 'image' },
  { id: 'matn', label: 'Matn', hint: 'Caption va hashtag', icon: 'text' },
  { id: 'vaqt', label: 'Vaqt va sozlamalar', hint: 'Qachon chiqadi', icon: 'calendar' },
  { id: 'tekshir', label: 'Ko‘rib chiqish', hint: 'Xatolarni tekshirish', icon: 'eye' },
]

const STEP_IDS = STEPS.map((s) => s.id)

/** Navbat sahifasining manzili — «Bekor qilish», `back` va saqlashdan keyingi qaytish. */
const QUEUE = '/admin/marketing/kontent'

export function ContentComposer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { can } = usePerm()
  const canEdit = can('marketing.content', 'edit')

  /* ── Forma holati ── */
  const [type, setType] = useState<IgPostType>('image')
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState<IgMediaItem[]>([emptyMedia('image')])
  const [options, setOptions] = useState<IgPostOptions>(emptyOptions())
  const [at, setAt] = useState('')

  /* ── Yuklash / saqlash ── */
  const [post, setPost] = useState<IgPost | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [askLeave, setAskLeave] = useState(false)

  /**
   * "O'zgardimi" ni bilish uchun BOSHLANG'ICH holat satri.
   *
   * ⚠️ Maydonlarni birma-bir solishtirish o'rniga bitta seriyalangan satr: media massivi
   * ichma-ich obyektlardan iborat va qo'lda solishtirish tez orada haqiqatdan uzilib qolardi
   * (yangi maydon qo'shilsa esa jimgina "o'zgarmagan" deb ko'rinardi).
   */
  const [baseline, setBaseline] = useState(() => snapshot('image', '', [emptyMedia('image')], emptyOptions(), ''))

  /* ── Faol bosqich URL'da ── */
  const rawStep = params.get('bosqich') ?? ''
  const step = STEP_IDS.includes(rawStep) ? rawStep : 'tur'
  const setStep = useCallback((next: string) => {
    const p = new URLSearchParams(params)
    p.set('bosqich', next)
    // `replace` — bosqich almashuvi brauzer tarixini to'ldirmasin: "orqaga" tugmasi
    // foydalanuvchini navbatga qaytarishi kerak, o'n bitta bosqichdan emas.
    setParams(p, { replace: true })
  }, [params, setParams])

  /* ── Mavjud rejani yuklash ── */
  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    setLoadError('')
    getIgPost(id)
      .then((p) => {
        if (!alive) return
        setPost(p)
        setType(p.postType)
        setCaption(p.caption)
        const rows = p.media.length > 0 ? p.media.map((m) => ({ ...m })) : [emptyMedia(defaultKind(p.postType))]
        setMedia(rows)
        const opts = { ...p.options, collaborators: [...p.options.collaborators] }
        setOptions(opts)
        const when = (p.scheduledAt ?? '').slice(0, 16)
        setAt(when)
        setBaseline(snapshot(p.postType, p.caption, rows, opts, when))
      })
      .catch((e) => { if (alive) setLoadError(apiErrorMessage(e, "Rejani yuklab bo'lmadi")) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  /**
   * YANGI post uchun boshlang'ich vaqt: Navbat sahifasidagi kalendardan kelingan bo'lsa
   * (`?kun=YYYY-MM-DD`) o'sha kunning 10:00 i.
   *
   * ⚠️ Faqat BIR MARTA, sahifa ochilganda: keyin foydalanuvchi vaqtni o'zgartirsa, URL
   * o'sha kunda qolgani uchun tanlov qayta yozib yuborilardi.
   */
  useEffect(() => {
    if (id) return
    const day = params.get('kun') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return
    const when = `${day}T10:00`
    setAt(when)
    // Boshlang'ich vaqt "o'zgarish" hisoblanmaydi: foydalanuvchi hali hech narsa yozmagan,
    // shuning uchun darhol chiqib ketsa tasdiq so'ralmasligi kerak.
    setBaseline(snapshot('image', '', [emptyMedia('image')], emptyOptions(), when))
    // Faqat MOUNT'da: keyin foydalanuvchi vaqtni o'zgartirsa, URL o'sha kunda qolgani uchun
    // tanlov qayta yozib yuborilardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Sanagichlar (backenddagi qoida bilan bir xil) ── */
  const chars = caption.length
  const tags = countHashtags(caption)
  const mentions = countMentions(caption)

  /** Tur o'zgarganda media ro'yxati va turi moslashtiriladi (karuselda kamida 2 ta element). */
  const changeType = (next: IgPostType) => {
    setType(next)
    setMedia((prev) => {
      const kind = defaultKind(next)
      // ⚠️ Story va karusel IKKALA turni ham qabul qiladi — u yerda foydalanuvchi tanlovi
      // saqlanadi. Qolgan turlarda tur bir xil (reels/video — video, rasm — rasm).
      const keepKind = next === 'story' || next === 'carousel'
      const rows = prev.map((m) => (keepKind ? m : { ...m, kind }))
      if (next === 'carousel') {
        while (rows.length < IG_LIMITS.carouselItems.min) rows.push(emptyMedia('image'))
        return rows.slice(0, IG_LIMITS.carouselItems.max)
      }
      return rows.slice(0, 1)
    })
  }

  const patchMedia = (index: number, patch: Partial<IgMediaItem>) => {
    setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  /**
   * Klientdagi tekshiruv — SERVERNIKINI almashtirmaydi, faqat oldindan ogohlantiradi.
   * Yakuniy qaror baribir serverda (`InstagramPublishContract.ValidatePost`).
   */
  const localError = useMemo(() => {
    if (chars > IG_LIMITS.captionChars) return `Matn juda uzun: ${chars} belgi (ruxsat ${IG_LIMITS.captionChars}).`
    if (tags > IG_LIMITS.hashtags) return `Hashtag ko‘p: ${tags} ta (ruxsat ${IG_LIMITS.hashtags}).`
    if (mentions > IG_LIMITS.mentions) return `Mention ko‘p: ${mentions} ta (ruxsat ${IG_LIMITS.mentions}).`

    if (type === 'carousel') {
      if (media.length < IG_LIMITS.carouselItems.min || media.length > IG_LIMITS.carouselItems.max) {
        return `Karuselda ${IG_LIMITS.carouselItems.min}–${IG_LIMITS.carouselItems.max} ta element bo‘lishi kerak (hozir ${media.length}).`
      }
      const withCaption = media.findIndex((m) => m.caption.trim().length > 0)
      if (withCaption >= 0) {
        return `${withCaption + 1}-elementga matn yozilgan: karusel elementlarida matn ishlamaydi, uni umumiy matn maydoniga yozing.`
      }
    }

    for (let i = 0; i < media.length; i++) {
      const m = media[i]
      const prefix = media.length > 1 ? `${i + 1}-element: ` : ''
      if (!m.url.trim()) return `${prefix}media manzili bo‘sh.`
      if (!isHttpsUrl(m.url)) return `${prefix}manzil ochiq HTTPS bo‘lishi shart — Instagram faylni o‘zi yuklab oladi.`
      if (m.kind === 'image' && !isJpegUrl(m.url)) return `${prefix}rasm faqat JPEG bo‘lishi kerak (.jpg yoki .jpeg).`
      if (m.kind === 'video' && !isVideoUrl(m.url)) return `${prefix}video faqat MP4 yoki MOV bo‘lishi kerak.`
      if (m.coverUrl && !isHttpsUrl(m.coverUrl)) return `${prefix}muqova manzili ham HTTPS bo‘lishi kerak.`
    }
    return ''
  }, [chars, tags, mentions, type, media])

  /**
   * Bosqich "to'ldirilganmi" — MkSteps'dagi ✓ belgisi uchun.
   *
   * ⚠️ `vaqt` HAR DOIM bajarilgan: bo'sh vaqt ham TO'G'RI qiymat (post navbatning keyingi
   * aylanishida joylanadi). Uni "to'ldirilmagan" deb ko'rsatish yolg'on ogohlantirish bo'lardi.
   */
  const done: Record<string, boolean> = {
    tur: media.length > 0 && media.every(mediaUrlOk),
    matn: caption.trim().length > 0
      && chars <= IG_LIMITS.captionChars
      && tags <= IG_LIMITS.hashtags
      && mentions <= IG_LIMITS.mentions,
    vaqt: true,
    tekshir: !localError,
  }

  /* ── Saqlanmagan o'zgarish ── */
  const dirty = snapshot(type, caption, media, options, at) !== baseline

  /**
   * Brauzer darajasidagi himoya (tabni yopish / yangilash).
   *
   * ⚠️ Router navigatsiyasi ATAYIN bloklanmaydi — `useBlocker` bilan har bir havolani
   * ushlash murakkab va sinuvchan. «Bekor qilish» tugmasida esa tasdiq so'raladi (pastda).
   */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  /** Saqlash uchun yuboriladigan tana — yaratish ham, tahrirlash ham AYNAN shundan. */
  const payload = () => ({
    postType: type,
    caption,
    // Karuseldan boshqasida faqat BIRINCHI element yuboriladi: tur almashganda ortiqcha
    // elementlar ekranda yo'q, lekin holatda qolib ketishi mumkin.
    media: type === 'carousel' ? media : media.slice(0, 1),
    options,
    // Bo'sh bo'lsa backend "hozir" deb oladi — post keyingi worker tsiklida joylanadi.
    scheduledAt: at ? `${at}:00` : '',
  })

  /** Navbatga qaytish + yashil xabar. ⚠️ `mkNotice` — Navbat sahifasi bilan KONTRAKT. */
  const backToQueue = (mkNotice: string) => navigate(QUEUE, { state: { mkNotice } })

  const save = async () => {
    if (localError) { setError(localError); return }
    setSaving(true)
    setError('')
    try {
      if (post) {
        await updateIgPost(post.id, payload())
        backToQueue('Reja yangilandi.')
      } else {
        await createIgPost(payload())
        backToQueue('Post navbatga qo‘shildi.')
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  /**
   * «Saqlab, hoziroq joylash» — FAQAT yangi postda.
   *
   * ⚠️ IKKI QADAM: avval `createIgPost`, keyin qaytgan `id` bilan `publishIgPost`. Agar
   * SAQLASH o'tib, JOYLASH yiqilsa — foydalanuvchiga AYNAN shu aytiladi va u navbatga
   * o'tkaziladi. Aks holda odam "saqlanmadi" deb o'ylab, postni IKKI MARTA yaratardi.
   *
   * ⚠️ So'rov joylanishni KUTMAYDI: rasm odatda darhol chiqadi, video/reels esa
   * «Joylanmoqda» bo'lib qoladi va uni worker oxiriga yetkazadi.
   */
  const saveAndPublish = async () => {
    if (localError) { setError(localError); return }
    setSaving(true)
    setError('')
    try {
      // 1-qadam — SAQLASH. Bu yerdagi xato oddiy saqlash xatosi: forma ochiq qoladi.
      const created = await createIgPost(payload())

      // 2-qadam — JOYLASH. ALOHIDA `try`: bu yerdagi xato "saqlanmadi" DEGANI EMAS,
      // shuning uchun foydalanuvchi navbatga o'tkaziladi va sabab ochiq aytiladi.
      try {
        const res = await publishIgPost(created.id)
        backToQueue(res.status === 'published'
          ? 'Post Instagram’ga joylandi.'
          : 'Post joylashga yuborildi — holati «Joylanmoqda». Video bir necha daqiqa olishi mumkin.')
      } catch (e) {
        backToQueue(`Reja saqlandi, lekin joylab bo‘lmadi: ${apiErrorMessage(e, "noma'lum sabab")}`)
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Saqlab bo'lmadi"))
    } finally {
      setSaving(false)
    }
  }

  /** «Bekor qilish» — o'zgarish bo'lsa avval tasdiq so'raladi. */
  const cancel = () => {
    if (dirty) { setAskLeave(true); return }
    navigate(QUEUE)
  }

  /* ═══════════ Darvozalar: ruxsat · yuklash · tahrirlab bo'lmaydigan post ═══════════ */

  if (!canEdit) {
    return (
      <MarketingPage
        title={id ? 'Rejani tahrirlash' : 'Yangi post'}
        sub="Post yaratish va tahrirlash uchun ruxsat kerak"
        back={{ to: QUEUE, label: 'Navbat' }}
      >
        <MkError text="Bu sahifa uchun «Marketing → Kontent» bo‘limida TAHRIRLASH ruxsati kerak. Ruxsatni «Xodimlar va rollar» bo‘limidan berish mumkin." />
      </MarketingPage>
    )
  }

  if (loading) {
    return (
      <MarketingPage title="Rejani tahrirlash" sub="Yuklanmoqda…" back={{ to: QUEUE, label: 'Navbat' }}>
        <MkLoading />
      </MarketingPage>
    )
  }

  if (loadError) {
    return (
      <MarketingPage title="Rejani tahrirlash" sub="Reja topilmadi" back={{ to: QUEUE, label: 'Navbat' }}>
        <MkError text={loadError} onRetry={() => navigate(0)} />
      </MarketingPage>
    )
  }

  /**
   * ⚠️ Faqat «Rejalashtirilgan» post tahrirlanadi (§5.9). Backend ham 400 qaytaradi, LEKIN
   * foydalanuvchi buni SAQLASH tugmasini bosishdan OLDIN bilishi kerak — aks holda u butun
   * formani to'ldirib, oxirida xato olardi.
   */
  if (post && !isEditable(post)) {
    return (
      <MarketingPage
        title="Rejani tahrirlash"
        sub={`${post.postTypeLabel} · ${fmtWhen(post.scheduledAt)} · ${post.statusLabel}`}
        back={{ to: QUEUE, label: 'Navbat' }}
      >
        <div className="mk-alert mk-alert-danger fade-up">
          <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            <div className="mk-alert-title">Bu postni endi o‘zgartirib bo‘lmaydi</div>
            Postning holati — <b>{post.statusLabel}</b>. Instagram API’si joylangan (yoki joylanayotgan)
            postni tahrirlashni qo‘llab-quvvatlamaydi: matnni ham, rasmni ham faqat <b>Instagram
            ilovasidan</b> o‘zgartirish mumkin. Tahrirlash faqat <b>«Rejalashtirilgan»</b> holatda ochiq.
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(QUEUE)}>
                <Icon name="arrowLeft" /> Navbatga qaytish
              </button>
            </div>
          </div>
        </div>
      </MarketingPage>
    )
  }

  /* ═══════════ Sarlavha ma'lumoti ═══════════ */

  const typeLabel = IG_POST_TYPES.find((t) => t.id === type)?.label ?? type
  const whenLabel = at ? fmtWhen(`${at}:00`) : 'vaqt belgilanmagan (hoziroq navbatga)'
  const stateLabel = post
    ? (dirty ? 'saqlanmagan o‘zgarish bor' : 'saqlangan')
    : 'hali saqlanmagan'
  const stepIndex = STEP_IDS.indexOf(step)
  const nextStep = STEPS[stepIndex + 1]

  return (
    <MarketingPage
      title={post ? 'Rejani tahrirlash' : 'Yangi post'}
      sub={`${typeLabel} · ${whenLabel} · ${stateLabel}`}
      back={{ to: QUEUE, label: 'Navbat' }}
      actions={
        <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>
          <Icon name="close" /> Bekor qilish
        </button>
      }
    >
      <div className="fade-up">
        {/* Bosqichlar — QULFLANMAGAN: istalganiga bosish mumkin. */}
        <MkSteps steps={STEPS} active={step} onSelect={setStep} done={done} />

        <div className="mk-composer">
          {/* ── CHAP: faqat FAOL bosqich ── */}
          <div style={{ minWidth: 0 }}>
            {step === 'tur' && (
              <StepMedia
                type={type}
                media={media}
                onChangeType={changeType}
                onPatch={patchMedia}
                onAdd={() => setMedia((prev) => [...prev, emptyMedia('image')])}
                onRemove={(i) => setMedia((prev) => prev.filter((_, k) => k !== i))}
              />
            )}

            {step === 'matn' && (
              <StepCaption
                type={type}
                caption={caption}
                chars={chars}
                tags={tags}
                mentions={mentions}
                aiOpen={aiOpen}
                onToggleAi={() => setAiOpen((v) => !v)}
                onCaption={setCaption}
                onAiApply={(text, mode) => {
                  setCaption((prev) => (
                    mode === 'append' && prev.trim().length > 0
                      ? `${prev.trimEnd()}\n\n${text}`
                      : text
                  ))
                  setAiOpen(false)
                }}
              />
            )}

            {step === 'vaqt' && (
              <StepSchedule
                type={type}
                at={at}
                options={options}
                onAt={setAt}
                onOptions={setOptions}
              />
            )}

            {step === 'tekshir' && (
              <StepReview type={type} media={media} caption={caption} at={at} localError={localError} />
            )}
          </div>

          {/* ── O'NG: Instagram ko'rinishi HAR BOSQICHDA ── */}
          <div className="mk-side-sticky">
            <div className="field-label">Instagram’da qanday ko‘rinadi</div>
            <IgPreview type={type} media={media} caption={caption} />

            <MkCard title="Tez ma’lumot">
              <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
                <Quick label="Tur" value={typeLabel} />
                <Quick label="Media" value={`${media.length} ta · ${media.filter(mediaUrlOk).length} tasi tayyor`} />
                <Quick
                  label="Matn"
                  value={`${chars} / ${IG_LIMITS.captionChars} belgi`}
                  danger={chars > IG_LIMITS.captionChars}
                />
                <Quick
                  label="Hashtag"
                  value={`${tags} / ${IG_LIMITS.hashtags}`}
                  danger={tags > IG_LIMITS.hashtags}
                />
                <Quick label="Joylash" value={whenLabel} />
              </div>
            </MkCard>
          </div>
        </div>

        {/* ── PASTKI AMALLAR QATORI ── */}
        <div className="mk-actionbar">
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* ⚠️ Server xatosi — QIZIL. To'ldirilmagan joy esa hali XATO emas: u shunchaki
                "saqlash uchun nima yetishmayapti" degan maslahat (yangi forma ochilishi bilan
                qizil blok chiqishi bekorga qo'rqitardi). */}
            {error && (
              <div className="mk-state mk-state-error" style={{ padding: 10 }}>
                <Icon name="warn" style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
            {!error && localError && (
              <div className="field-hint" style={{ margin: 0 }}>Saqlash uchun: {localError}</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={cancel} disabled={saving}>Bekor qilish</button>

            {nextStep && (
              <button className="btn btn-outline" onClick={() => setStep(nextStep.id)} disabled={saving}>
                Keyingi: {nextStep.label} <Icon name="arrowRight" />
              </button>
            )}

            {!post && (
              <button
                className="btn btn-outline"
                onClick={() => void saveAndPublish()}
                disabled={saving || !!localError}
                title="Reja saqlanadi va darhol Instagram’ga yuboriladi"
              >
                <Icon name="send" /> Saqlab, hoziroq joylash
              </button>
            )}

            <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !!localError}>
              <Icon name="check" /> {saving ? 'Saqlanmoqda…' : post ? 'Saqlash' : 'Navbatga qo‘shish'}
            </button>
          </div>
        </div>
      </div>

      {/* Saqlanmagan o'zgarish — chiqishdan oldin tasdiq. */}
      {askLeave && (
        <MkDialog
          title="O‘zgarishlar saqlanmaydi"
          tone="danger"
          onClose={() => setAskLeave(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAskLeave(false)}>Formaga qaytish</button>
              <button className="btn btn-primary" onClick={() => navigate(QUEUE)}>
                <Icon name="close" /> Ha, chiqilsin
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            Formada saqlanmagan o‘zgarishlar bor. Chiqsangiz ular <b>yo‘qoladi</b> — yuklangan
            fayllar serverda qoladi, lekin post yozuvi yaratilmaydi.
          </div>
        </MkDialog>
      )}
    </MarketingPage>
  )
}

/* ═══════════════════════════════════════ 1) TUR VA MEDIA ═══════════════════════════════════════ */

function StepMedia({
  type, media, onChangeType, onPatch, onAdd, onRemove,
}: {
  type: IgPostType
  media: IgMediaItem[]
  onChangeType: (t: IgPostType) => void
  onPatch: (index: number, patch: Partial<IgMediaItem>) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <>
      <MkCard title="Post turi" sub="Instagram’da qaysi ko‘rinishda chiqishini tanlang">
        <div className="mk-type-grid">
          {IG_POST_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`mk-type${type === t.id ? ' sel' : ''}`}
              onClick={() => onChangeType(t.id)}
            >
              <span className="mk-type-ic"><Icon name={postTypeIcon(t.id)} /></span>
              <span className="mk-type-name">{t.label}</span>
              <span className="mk-type-hint">{t.hint}</span>
            </button>
          ))}
        </div>
        <div className="field-hint" style={{ marginTop: 10 }}>
          Tur o‘zgarsa media ro‘yxati ham moslashadi: karuselda kamida {IG_LIMITS.carouselItems.min} ta
          element bo‘ladi, qolgan turlarda esa faqat birinchisi yuboriladi.
        </div>
      </MkCard>

      <MediaRequirements type={type} />

      <MkCard
        title="Media"
        sub={type === 'carousel'
          ? `Karusel: ${media.length} / ${IG_LIMITS.carouselItems.max} ta element`
          : 'Bitta fayl — sudrab tashlang, yuklang yoki ochiq HTTPS manzilni yozing'}
      >
        {media.map((m, i) => (
          <MediaEditor
            key={i}
            item={m}
            index={i}
            showIndex={type === 'carousel'}
            type={type}
            onChange={(patch) => onPatch(i, patch)}
            onRemove={media.length > 1 ? () => onRemove(i) : undefined}
          />
        ))}

        {type === 'carousel' && media.length < IG_LIMITS.carouselItems.max && (
          <button className="btn btn-outline btn-sm" onClick={onAdd} style={{ marginTop: 12 }}>
            <Icon name="plus" /> Element qo‘shish ({media.length} / {IG_LIMITS.carouselItems.max})
          </button>
        )}
      </MkCard>
    </>
  )
}

/* ═══════════════════════════════════════ 2) MATN ═══════════════════════════════════════ */

function StepCaption({
  type, caption, chars, tags, mentions, aiOpen, onToggleAi, onCaption, onAiApply,
}: {
  type: IgPostType
  caption: string
  chars: number
  tags: number
  mentions: number
  aiOpen: boolean
  onToggleAi: () => void
  onCaption: (v: string) => void
  onAiApply: (text: string, mode: 'replace' | 'append') => void
}) {
  return (
    <MkCard
      title="Post matni (caption)"
      sub="Hashtaglar shu maydonning ichida yoziladi"
      actions={
        <button className={`btn btn-sm ${aiOpen ? 'btn-outline' : 'btn-ghost'}`} onClick={onToggleAi}>
          <Icon name="sparkle" /> AI bilan yozish
        </button>
      }
    >
      {aiOpen && (
        <CaptionAi
          postType={type}
          hasText={caption.trim().length > 0}
          onApply={onAiApply}
          onClose={onToggleAi}
        />
      )}

      <textarea
        className="textarea"
        value={caption}
        rows={14}
        placeholder="Postning matni, hashtaglar bilan…"
        onChange={(e) => onCaption(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <Counter label="belgi" value={chars} max={IG_LIMITS.captionChars} />
        <Counter label="hashtag" value={tags} max={IG_LIMITS.hashtags} />
        <Counter label="mention" value={mentions} max={IG_LIMITS.mentions} />
      </div>

      {type === 'carousel' && (
        <div className="field-hint">
          ⚠️ Karuselda matn faqat SHU maydondan olinadi — alohida elementlarga yozilgan matn
          Instagram’da ko‘rinmaydi.
        </div>
      )}
    </MkCard>
  )
}

/** Chegara sanagichi — oshib ketsa qizil bo'ladi (backend baribir rad etadi). */
function Counter({ label, value, max }: { label: string; value: number; max: number }) {
  const over = value > max
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: over ? 'var(--danger)' : 'var(--text-3)' }}>
      {value} / {max} {label}
    </span>
  )
}

/* ═══════════════════════════════════════ 3) VAQT VA SOZLAMALAR ═══════════════════════════════════════ */

function StepSchedule({
  type, at, options, onAt, onOptions,
}: {
  type: IgPostType
  at: string
  options: IgPostOptions
  onAt: (v: string) => void
  onOptions: (o: IgPostOptions) => void
}) {
  // ⚠️ O'tib ketgan vaqt XATO EMAS: post navbatning keyingi aylanishida joylanadi. Lekin
  // odam buni ADASHIB tanlagan bo'lishi mumkin — shuning uchun sariq MASLAHAT chiqadi.
  const past = !!at && at < localNow()

  return (
    <>
      <MkCard title="Joylash vaqti" sub="CRM navbatida saqlanadi — Instagram’da hech narsa band qilinmaydi">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, minWidth: 240 }}>
            <label className="field-label">Sana va vaqt</label>
            <input
              className="input"
              type="datetime-local"
              value={at}
              onChange={(e) => onAt(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {/* «Hoziroq» — maydonni BO'SHATADI: bo'sh vaqt backend uchun "hozir" degani. */}
          <button className="btn btn-outline btn-sm" onClick={() => onAt('')}>Hoziroq</button>
          <button className="btn btn-outline btn-sm" onClick={() => onAt(dayAt(0, '10:00'))}>Bugun 10:00</button>
          <button className="btn btn-outline btn-sm" onClick={() => onAt(dayAt(1, '10:00'))}>Ertaga 10:00</button>
          <button className="btn btn-outline btn-sm" onClick={() => onAt(dayAt(1, '19:00'))}>Ertaga 19:00</button>
        </div>

        {past && (
          <div className="mk-alert" style={{ marginTop: 14, marginBottom: 0 }}>
            <Icon name="clock" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <div className="mk-alert-title">Tanlangan vaqt allaqachon o‘tgan</div>
              Bu <b>xato emas</b> — bunday post navbatning keyingi aylanishida (bir daqiqa ichida)
              joylanadi. Agar kelajakdagi vaqtni nazarda tutgan bo‘lsangiz, sanani tekshiring.
            </div>
          </div>
        )}

        <div className="field-hint" style={{ marginTop: 12 }}>
          Bo‘sh qoldirilsa post navbatning keyingi aylanishida (bir daqiqa ichida) joylanadi.
          Vaqt CRM navbatida saqlanadi — Instagram’da hech narsa oldindan band qilinmaydi, shuning
          uchun vaqtni istagancha o‘zgartirsa bo‘ladi.
        </div>
      </MkCard>

      {(type === 'reels' || type === 'video') && (
        <MkCard title="Lentaga chiqarish">
          <div className="row-between">
            <div>
              <div className="opt-name">Lentaga ham chiqarilsin</div>
              <div className="opt-desc">Reels profil lentasida ham ko‘rinadi (share_to_feed).</div>
            </div>
            <div
              className={`switch${options.shareToFeed ? ' on' : ''}`}
              onClick={() => onOptions({ ...options, shareToFeed: !options.shareToFeed })}
            />
          </div>
        </MkCard>
      )}

      {/* ⚠️ Ilgari bu blok `<details>` ichida yashiringan edi (modalda joy yo'q edi). Endi
          sahifa to'liq ekranli — sozlamalar OCHIQ turadi va ogohlantirishlar ko'rinadi. */}
      <MkCard title="Qo‘shimcha sozlamalar" sub="Ixtiyoriy — bo‘sh qoldirilsa Instagram’ga yuborilmaydi">
        <div className="field">
          <label className="field-label">Hammualliflar (collaborators)</label>
          <input
            className="input"
            value={options.collaborators.join(', ')}
            placeholder="username1, username2"
            onChange={(e) => onOptions({
              ...options,
              collaborators: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })}
          />
          <div className="field-hint">
            Ko‘pi bilan {IG_LIMITS.collaborators} ta. ⚠️ Ular taklifni Instagram’da <b>qabul qilishi</b> kerak —
            aks holda post faqat sizning profilingizda qoladi.
          </div>
        </div>

        <div className="field">
          <label className="field-label">Joylashuv ID (location_id)</label>
          <input
            className="input"
            value={options.locationId}
            placeholder="Ixtiyoriy — Facebook Page joylashuv ID’si"
            onChange={(e) => onOptions({ ...options, locationId: e.target.value })}
          />
        </div>

        {(type === 'reels' || type === 'video') && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Audio nomi (Reels)</label>
            <input
              className="input"
              value={options.audioName}
              onChange={(e) => onOptions({ ...options, audioName: e.target.value })}
            />
            <div className="field-hint">⚠️ Instagram’da audio nomini keyin faqat BIR MARTA o‘zgartirish mumkin.</div>
          </div>
        )}
      </MkCard>
    </>
  )
}

/* ═══════════════════════════════════════ 4) KO'RIB CHIQISH ═══════════════════════════════════════ */

/**
 * Yakuniy tekshiruv.
 *
 * ⚠️ `localError` faqat BITTA (birinchi) muammoni qaytaradi — pastdagi tugmalar uchun shu
 * yetadi. Bu yerda esa har bir shart ALOHIDA ko'rsatiladi: foydalanuvchi "yana nima
 * yetishmaydi" ni bittalab tuzatib yurmasin.
 */
function StepReview({
  type, media, caption, at, localError,
}: {
  type: IgPostType
  media: IgMediaItem[]
  caption: string
  at: string
  localError: string
}) {
  const chars = caption.length
  const tags = countHashtags(caption)
  const mentions = countMentions(caption)
  const rows = type === 'carousel' ? media : media.slice(0, 1)

  const checks: { ok: boolean; label: string; detail: string }[] = [
    {
      ok: true,
      label: 'Post turi tanlandi',
      detail: `${IG_POST_TYPES.find((t) => t.id === type)?.label ?? type} · ${isVertical(type) ? '9:16 (vertikal)' : 'kvadrat/lenta'}`,
    },
    {
      ok: type !== 'carousel'
        || (rows.length >= IG_LIMITS.carouselItems.min && rows.length <= IG_LIMITS.carouselItems.max),
      label: 'Elementlar soni',
      detail: type === 'carousel'
        ? `${rows.length} ta (ruxsat ${IG_LIMITS.carouselItems.min}–${IG_LIMITS.carouselItems.max})`
        : '1 ta element yuboriladi',
    },
    {
      ok: rows.length > 0 && rows.every((m) => !!m.url.trim() && isHttpsUrl(m.url)),
      label: 'Media manzillari ochiq HTTPS',
      detail: 'Instagram faylni o‘zi yuklab oladi — login, IP cheklov va redirect ishlamaydi.',
    },
    {
      ok: rows.every((m) => (m.kind === 'image' ? isJpegUrl(m.url) : isVideoUrl(m.url))),
      label: 'Fayl formati to‘g‘ri',
      detail: 'Rasm — faqat JPEG (.jpg/.jpeg); video — MP4 yoki MOV.',
    },
    {
      ok: rows.every((m) => !m.coverUrl || isHttpsUrl(m.coverUrl)),
      label: 'Muqova manzili (bo‘lsa) HTTPS',
      detail: 'Video muqovasi ham tashqaridan yuklab olinadi.',
    },
    {
      ok: type !== 'carousel' || rows.every((m) => m.caption.trim().length === 0),
      label: 'Karusel elementlarida matn yo‘q',
      detail: 'Karuselda matn faqat umumiy maydondan olinadi — element matnini backend rad etadi.',
    },
    {
      ok: chars <= IG_LIMITS.captionChars && tags <= IG_LIMITS.hashtags && mentions <= IG_LIMITS.mentions,
      label: 'Matn chegaralarda',
      detail: `${chars}/${IG_LIMITS.captionChars} belgi · ${tags}/${IG_LIMITS.hashtags} hashtag · ${mentions}/${IG_LIMITS.mentions} mention`,
    },
    {
      ok: true,
      label: 'Joylash vaqti',
      detail: at ? fmtWhen(`${at}:00`) : 'belgilanmagan — navbatning keyingi aylanishida joylanadi',
    },
  ]

  return (
    <>
      <MkCard
        title="Tekshiruv ro‘yxati"
        sub={localError ? 'Saqlashdan oldin tuzatilishi kerak' : 'Hammasi joyida — saqlash mumkin'}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {checks.map((c) => (
            <div key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                className="rule-num"
                style={{
                  flexShrink: 0,
                  background: c.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
                  color: c.ok ? 'var(--success)' : 'var(--danger)',
                }}
              >
                <Icon name={c.ok ? 'check' : 'close'} style={{ width: 13, height: 13 }} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.label}</div>
                <div className="field-hint" style={{ margin: 0 }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {localError && (
          <div style={{ marginTop: 14 }}>
            <MkNotice tone="danger" text={`Birinchi to‘siq: ${localError}`} />
          </div>
        )}
      </MkCard>

      <MkCard title="Media jamlanmasi" sub="0 = noma’lum: bunday maydon tekshirilmaydi">
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="mk-media-thumb" style={{ width: 64, height: 64, flexShrink: 0 }}>
                {m.url && isHttpsUrl(m.url) && m.kind === 'image'
                  ? <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (
                    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-3)' }}>
                      <Icon name={m.kind === 'video' ? 'film' : 'image'} style={{ width: 20, height: 20 }} />
                    </div>
                  )}
              </div>
              <div style={{ minWidth: 0, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>
                  {rows.length > 1 ? `${i + 1}-element · ` : ''}{m.kind === 'video' ? 'Video' : 'Rasm'}
                </div>
                <div className="field-hint" style={{ margin: 0 }}>
                  {fmtBytes(m.sizeBytes)}
                  {' · '}
                  {m.width > 0 && m.height > 0 ? `${m.width}×${m.height} px` : 'o‘lcham noma’lum'}
                  {m.kind === 'video' && ` · ${m.durationSeconds > 0 ? `${m.durationSeconds} s` : 'davomiylik noma’lum'}`}
                </div>
                <div className="field-hint" style={{ margin: 0, wordBreak: 'break-all' }}>
                  {m.url ? trim(m.url, 70) : 'manzil kiritilmagan'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </MkCard>

      {/* 🔴 §5.9 — SAQLASHDAN OLDIN, chunki bu qaytarib bo'lmaydigan amal haqida. */}
      <div className="mk-alert mk-alert-danger">
        <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <div className="mk-alert-title">Joylangan postni CRM’dan o‘zgartirib bo‘lmaydi</div>
          Instagram API’si joylangan postni tahrirlashni ham, o‘chirishni ham qo‘llab-quvvatlamaydi —
          matnni ham, rasmni ham faqat <b>Instagram ilovasidan</b> o‘zgartirish mumkin. Shu sababli
          tahrirlash faqat <b>«Rejalashtirilgan»</b> postlarda ochiq. Joylangan postni navbatdan
          o‘chirsangiz — <b>faqat CRM yozuvi</b> o‘chadi, Instagram’dagi post o‘z joyida qoladi.
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════ KICHIK YORDAMCHILAR ═══════════════════════════════════════ */

/** «Tez ma'lumot» kartochkasidagi bitta qator. */
function Quick({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: 'right', color: danger ? 'var(--danger)' : undefined }}>
        {value}
      </span>
    </div>
  )
}

/**
 * Media manzili "tayyor"mi — bosqich ✓ belgisi va «Tez ma'lumot» sanog'i uchun.
 *
 * ⚠️ Bu YENGIL tekshiruv (manzil + format). To'liq qoida `localError` da qoladi: ikkinchi
 * nusxasini yasash ikki joyda ikki xil javob berish xavfini tug'dirardi.
 */
function mediaUrlOk(m: IgMediaItem): boolean {
  if (!m.url.trim() || !isHttpsUrl(m.url)) return false
  return m.kind === 'image' ? isJpegUrl(m.url) : isVideoUrl(m.url)
}

/** Forma holatining seriyalangan surati — "o'zgardimi" savoli uchun. */
function snapshot(
  type: IgPostType, caption: string, media: IgMediaItem[], options: IgPostOptions, at: string,
): string {
  return JSON.stringify({ type, caption, media, options, at })
}

/**
 * `datetime-local` formatidagi HOZIRGI vaqt ("yyyy-MM-ddTHH:mm").
 *
 * ⚠️ `toISOString()` ATAYIN ishlatilmaydi — u UTC'ga o'tkazadi va O'zbekistonda soatni
 * 5 soatga surib yuborardi ("o'tgan vaqt" ogohlantirishi noto'g'ri chiqardi).
 */
function localNow(): string {
  return stamp(new Date())
}

/** Bugundan `plusDays` keyingi kunning berilgan soati ("yyyy-MM-ddTHH:mm"). */
function dayAt(plusDays: number, time: string): string {
  const d = new Date()
  d.setDate(d.getDate() + plusDays)
  return `${stamp(d).slice(0, 10)}T${time}`
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
