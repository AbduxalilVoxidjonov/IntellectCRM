import { useState } from 'react'
import type { DragEvent } from 'react'
import { usePerm } from '@/lib/permissions'
import { apiErrorMessage } from '@/lib/utils'
import {
  isHttpsUrl, uploadIgMedia,
  IG_LIMITS,
  type IgMediaItem, type IgMediaKind, type IgPostType,
} from '@/api/services/instagramContent'
import { Icon } from '../mk'
import { firstPositive, fmtBytes, measureLocalFile, mediaKindLocked } from './helpers'

/**
 * 🔴 §5.5 + §5.6 — media talablari OCHIQ yoziladi.
 * Sabab: bu qoidalar buzilsa Meta xatoni faqat konteyner tayyorlangandan keyin qaytaradi,
 * ya'ni post o'z vaqtida chiqmasdi va nima uchunligi kech ma'lum bo'lardi.
 */
export function MediaRequirements({ type }: { type: IgPostType }) {
  const lines: string[] = [
    'Media manzili ochiq HTTPS bo‘lishi SHART — Instagram faylni o‘zi yuklab oladi, shuning uchun login, IP cheklov va yo‘naltirish (redirect) ishlamaydi.',
  ]
  if (type === 'image' || type === 'carousel') {
    lines.push(`Rasm — faqat JPEG (.jpg/.jpeg), ≤${IG_LIMITS.imageMb} MB, kenglik ${IG_LIMITS.feedWidth.min}–${IG_LIMITS.feedWidth.max} px, nisbat 4:5 – 1.91:1.`)
  }
  if (type === 'reels' || type === 'video') {
    lines.push(`Reels/video — MP4 yoki MOV, ≤${IG_LIMITS.reelsMb} MB, ${IG_LIMITS.reelsSeconds.min}–${IG_LIMITS.reelsSeconds.max} soniya, 9:16 (masalan 1080×1920).`)
  }
  if (type === 'story') {
    lines.push(`Story — 9:16. Rasm: JPEG ≤${IG_LIMITS.imageMb} MB. Video: MP4/MOV ≤${IG_LIMITS.storyVideoMb} MB, ${IG_LIMITS.storyVideoSeconds.min}–${IG_LIMITS.storyVideoSeconds.max} soniya.`)
  }
  if (type === 'carousel') {
    lines.push(`Karusel — ${IG_LIMITS.carouselItems.min}–${IG_LIMITS.carouselItems.max} ta element; qolganlari birinchi elementning nisbatiga qirqiladi.`)
  }

  return (
    <div className="mk-alert" style={{ marginBottom: 18 }}>
      <Icon name="warn" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <div className="mk-alert-title">Media talablari</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </div>
  )
}

/**
 * Bitta media elementi: manzil + texnik ma'lumot + ko'rinish (thumbnail).
 *
 * Fayl berishning UCHTA yo'li bor va ular BOSHQA-BOSHQA ish qiladi (uchalasi ham QOLADI):
 *
 * 1. **«Fayl yuklash» (yoki faylni SUDRAB TASHLASH)** — fayl SERVERGA ketadi
 *    (`POST content/media`) va `/uploads/marketing-public/` ochiq papkasidan tayyor manzil
 *    qaytadi. Bu papka ATAYIN `UploadsGuard` dan tashqarida: Instagram faylni o'zi yuklab
 *    oladi, login talab qiladigan manzil esa Meta uchun 404 bo'lardi (xato kodi `2207052`).
 *    Ruxsat: `marketing.content` (edit).
 * 2. **«Fayldan o'lchash»** — fayl YUKLANMAYDI, faqat brauzerda o'lchanadi. Tashqi CDN'da
 *    turgan fayl uchun kerak: manzil qo'lda yoziladi, o'lchamlar esa shu tugma bilan.
 * 3. **Manzilni QO'LDA yozish** — tashqi CDN uchun.
 *
 * ⚠️ O'lchamlar 0 = "noma'lum" — backend bunday holatda tekshiruvni o'tkazib yuboradi. Shu
 * sababli taxminiy qiymat yozilmaydi: noto'g'ri son to'g'ri media'ni bekorga rad etardi.
 */
export function MediaEditor({
  item, index, showIndex, type, onChange, onRemove,
}: {
  item: IgMediaItem
  index: number
  showIndex: boolean
  type: IgPostType
  onChange: (patch: Partial<IgMediaItem>) => void
  onRemove?: () => void
}) {
  // ⚠️ Ruxsat SHU YERDA qayta tekshiriladi (sahifa faqat tahrirlash huquqi bilan ochilsa ham):
  // yuklash — YOZISH amali va u alohida darvozalanishi kerak.
  const { can } = usePerm()
  const canUpload = can('marketing.content', 'edit')

  const [measuring, setMeasuring] = useState(false)
  const [measureError, setMeasureError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [over, setOver] = useState(false)

  const measure = async (file: File) => {
    setMeasuring(true)
    setMeasureError('')
    try {
      const info = await measureLocalFile(file)
      onChange(info)
    } catch (e) {
      setMeasureError(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi")
    } finally {
      setMeasuring(false)
    }
  }

  /**
   * Faylni serverga yuklaydi va manzil bilan birga O'LCHAMLARNI ham maydonlarga qo'yadi.
   *
   * ⚠️ SERVER O'LCHOVI USTUN — u faylning o'zidan (JPEG sarlavhasi, MP4 `mvhd`) o'qiladi,
   * ya'ni brauzer bergan qiymatdan ishonchliroq. Lekin server hamma narsani o'qiy olmaydi:
   * VIDEO kengligi/balandligi unda 0 («noma'lum») bo'lib qaytadi. Shuning uchun 0 qiymat
   * brauzer o'lchovi bilan to'ldiriladi — aks holda to'g'ri o'lcham yo'qolib, backend 9:16
   * tekshiruvini umuman o'tkazib yuborardi.
   *
   * ⚠️ Eski qiymatlar SAQLANMAYDI: bu boshqa fayl, undagi o'lcham yangisiga aloqasiz.
   */
  const upload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    setMeasureError('')
    try {
      const info = await uploadIgMedia(file)

      // Brauzer o'lchovi — SERVER o'qiy olmagan maydonlar uchun. Yiqilsa yuklash BEKOR
      // QILINMAYDI: fayl allaqachon serverda va manzil ishlaydi (o'lcham esa "noma'lum").
      let local: Partial<IgMediaItem> = {}
      try { local = await measureLocalFile(file) } catch { /* ixtiyoriy */ }

      onChange({
        url: info.url,
        kind: info.kind,
        sizeBytes: firstPositive(info.sizeBytes, local.sizeBytes),
        width: firstPositive(info.width, local.width),
        height: firstPositive(info.height, local.height),
        durationSeconds: firstPositive(info.durationSeconds, local.durationSeconds),
      })
    } catch (e) {
      setUploadError(apiErrorMessage(e, "Faylni yuklab bo'lmadi"))
    } finally {
      setUploading(false)
    }
  }

  const busyFile = uploading || measuring
  const urlOk = item.url.trim().length === 0 || isHttpsUrl(item.url)
  const canPreview = !!item.url.trim() && isHttpsUrl(item.url)

  /**
   * Sudrab tashlangan fayl — «Fayl yuklash» bilan AYNAN bir xil yo'l (serverga chiqadi).
   *
   * ⚠️ Ruxsati yo'q foydalanuvchida drop JIM tashlanadi: tugma yashiringan bo'lsa,
   * sudrab tashlash orqali uni aylanib o'tib bo'lmasligi kerak.
   */
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (!canUpload || busyFile) return
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  return (
    <div className="mk-media-card">
      {/* ── Sarlavha: raqam · tur tanlovi · o'chirish ── */}
      <div className="mk-media-head">
        <span className="rule-num">
          {showIndex ? index + 1 : <Icon name="link" style={{ width: 13, height: 13 }} />}
        </span>
        <div className="seg">
          {(['image', 'video'] as IgMediaKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={item.kind === k ? 'active' : ''}
              onClick={() => onChange({ kind: k })}
              disabled={mediaKindLocked(type, k)}
              title={mediaKindLocked(type, k) ? 'Bu post turida bunday media qabul qilinmaydi' : undefined}
            >
              {k === 'image' ? 'Rasm' : 'Video'}
            </button>
          ))}
        </div>
        {onRemove && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onRemove}>
            <Icon name="trash" /> Olib tashlash
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── CHAP: ko'rinish ── */}
        <div className="mk-media-thumb">
          {canPreview && item.kind === 'image' && (
            <img src={item.url} alt={item.altText || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {canPreview && item.kind === 'video' && (
            <video
              src={item.url}
              poster={item.coverUrl || undefined}
              muted
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {!canPreview && (
            <div style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center', height: '100%' }}>
              <Icon name={item.kind === 'video' ? 'film' : 'image'} style={{ width: 24, height: 24 }} />
            </div>
          )}
        </div>

        {/* ── O'NG: maydonlar ── */}
        <div style={{ flex: 1, minWidth: 260 }}>
          {/* Sudrab tashlash maydoni — «Fayl yuklash» bilan bir xil natija beradi. */}
          <div
            className={`mk-drop${over ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (canUpload && !busyFile) setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <Icon name="upload" style={{ width: 20, height: 20, color: 'var(--text-3)' }} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>
              {uploading
                ? 'Yuklanmoqda…'
                : canUpload
                  ? 'Faylni shu yerga sudrab tashlang'
                  : 'Fayl yuklash uchun tahrirlash ruxsati kerak'}
            </div>
            <div className="field-hint" style={{ margin: 0 }}>JPEG · MP4 · MOV</div>
          </div>

          <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
            <label className="field-label">Media manzili</label>
            <input
              className="input"
              value={item.url}
              placeholder="https://…/rasm.jpg"
              onChange={(e) => onChange({ url: e.target.value })}
              style={urlOk ? undefined : { borderColor: 'var(--danger)' }}
            />
            <div className="field-hint">
              Ochiq HTTPS manzil — qo‘lda yozsangiz ham bo‘ladi (tashqi CDN uchun). ⚠️ CRM ichidagi oddiy{' '}
              <code>/uploads/…</code> manzillari <b>ishlamaydi</b> — ular login ortida, Instagram esa faylni
              tashqaridan yuklab oladi. «Fayl yuklash» tugmasi faylni maxsus <b>ochiq</b> papkaga qo‘yadi.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {canUpload && (
              <label
                className="btn btn-primary btn-sm"
                style={{ cursor: busyFile ? 'default' : 'pointer', opacity: busyFile ? 0.6 : 1 }}
              >
                <Icon name="upload" />
                {uploading ? 'Yuklanmoqda…' : 'Fayl yuklash'}
                <input
                  type="file"
                  accept="image/jpeg,video/mp4,video/quicktime"
                  style={{ display: 'none' }}
                  disabled={busyFile}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void upload(f)
                    // ⚠️ Tozalash SHART: bir xil faylni qayta tanlaganda `change` otilmasdi.
                    e.target.value = ''
                  }}
                />
              </label>
            )}

            <label className="btn btn-outline btn-sm" style={{ cursor: busyFile ? 'default' : 'pointer' }}>
              <Icon name="search" />
              {measuring ? 'O‘lchanmoqda…' : 'Fayldan o‘lchash'}
              <input
                type="file"
                accept="image/jpeg,video/mp4,video/quicktime"
                style={{ display: 'none' }}
                disabled={busyFile}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void measure(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="field-hint" style={{ marginTop: 8 }}>
            <b>Fayl yuklash</b> — fayl serverga chiqadi va manzil o‘zi yoziladi (JPEG, MP4 yoki MOV).
            <b> Fayldan o‘lchash</b> — fayl <b>yuklanmaydi</b>, faqat hajmi, o‘lchami va davomiyligi
            o‘lchanadi: manzili boshqa joyda turgan fayl uchun. Ikkalasida ham xato Instagram’dan emas,
            shu yerda ko‘rinadi.
          </div>

          {uploadError && <div className="field-hint" style={{ color: 'var(--danger)' }}>{uploadError}</div>}
          {measureError && <div className="field-hint" style={{ color: 'var(--danger)' }}>{measureError}</div>}
        </div>
      </div>

      {/* ── Texnik o'lchamlar ── */}
      <div className="mk-media-grid" style={{ marginTop: 14 }}>
        <NumField label="Kenglik, px" value={item.width} onChange={(v) => onChange({ width: v })} />
        <NumField label="Balandlik, px" value={item.height} onChange={(v) => onChange({ height: v })} />
        <NumField label="Hajm, bayt" value={item.sizeBytes} onChange={(v) => onChange({ sizeBytes: v })} />
        <NumField
          label="Davomiylik, s"
          value={item.durationSeconds}
          onChange={(v) => onChange({ durationSeconds: v })}
          disabled={item.kind !== 'video'}
        />
      </div>
      <div className="field-hint">
        0 = <b>noma’lum</b>: bunday maydon tekshirilmaydi. Taxminiy son yozmang — noto‘g‘ri qiymat
        to‘g‘ri media’ni bekorga rad etadi. Hozirgi hajm: <b>{fmtBytes(item.sizeBytes)}</b>.
      </div>

      {/* ── Video muqovasi ── */}
      {item.kind === 'video' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12, marginTop: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Muqova manzili (ixtiyoriy)</label>
            <input
              className="input"
              value={item.coverUrl}
              placeholder="https://…/muqova.jpg"
              onChange={(e) => onChange({ coverUrl: e.target.value })}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Muqova kadri, ms</label>
            <input
              className="input"
              type="number"
              value={item.thumbOffsetMs < 0 ? '' : item.thumbOffsetMs}
              placeholder="berilmagan"
              onChange={(e) => onChange({ thumbOffsetMs: e.target.value === '' ? -1 : Number(e.target.value) })}
            />
            <div className="field-hint">Bo‘sh = berilmagan; 0 = birinchi kadr.</div>
          </div>
        </div>
      )}

      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label className="field-label">Alt matn (ko‘rish imkoniyati cheklanganlar uchun)</label>
        <input
          className="input"
          value={item.altText}
          maxLength={IG_LIMITS.altTextChars}
          onChange={(e) => onChange({ altText: e.target.value })}
        />
      </div>
    </div>
  )
}

/** Butun son maydoni: bo'sh — 0 ("noma'lum"). */
function NumField({
  label, value, onChange, disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="field-label" style={{ fontSize: 11.5 }}>{label}</label>
      <input
        className="input"
        type="number"
        min={0}
        disabled={disabled}
        value={value === 0 ? '' : value}
        placeholder="noma’lum"
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </div>
  )
}
