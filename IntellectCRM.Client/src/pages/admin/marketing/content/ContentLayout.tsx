/**
 * MARKETING → KONTENT bo'limining O'ROVCHISI (layout).
 *
 * Modul ilgari bitta sahifa + katta modal edi; endi u uchta sub-sahifaga bo'lingan
 * (Navbat · Joylanganlar · Holat va limit), post muharriri esa ALOHIDA to'liq sahifa
 * (`/admin/marketing/kontent/yangi`, `/post/:id`) — u layoutdan TASHQARIDA, chunki uzun
 * forma yonida sub-nav va sarlavha faqat joyni egallardi.
 *
 * ⚠️ Sub-sahifalar sidebar nav'da YO'Q — ular shu yerdagi `MkSubnav` orqali ochiladi.
 * Sabab: bular bitta bo'limning ichki tablari, sidebar esa bo'limlar ro'yxati.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { getIgContentStatus, type IgContentStatus } from '@/api/services/instagramContent'
import { usePerm } from '@/lib/permissions'
import { Icon, MarketingPage, MkSubnav, type MkSubnavItem } from '../mk'

/**
 * Layout bolalarga uzatadigan kontekst.
 *
 * ⚠️ Layout bolalarning MA'LUMOTINI bilmaydi (navbat oy bo'yicha, joylanganlar boshqa filtr
 * bilan, holat esa umuman boshqa endpointdan o'qiydi). Shuning uchun «Yangilash» tugmasi
 * to'g'ridan-to'g'ri qayta yuklamaydi — u faqat SIGNAL beradi, bola esa uni o'z yuklash
 * effektining bog'liqligiga qo'yadi.
 */
export interface ContentOutlet {
  /** Har «Yangilash» bosilganda ortadi — bola shuni `useEffect` bog'liqligiga qo'ysin. */
  reloadKey: number
  /** Sub-nav sanoqlarini qayta o'qiydi (post joylangandan keyin bola chaqiradi). */
  refreshCounts: () => void
}

export function ContentLayout() {
  const { can } = usePerm()
  const canEdit = can('marketing.content', 'edit')

  const [diag, setDiag] = useState<IgContentStatus | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  /**
   * Sub-nav sanoqlari.
   *
   * ⚠️ `GET /content/status` FAQAT bazadan o'qiydi (Meta'ga chiqmaydi) — shuning uchun uni
   * layoutda, ya'ni HAR sub-sahifada chaqirish xavfsiz. Kunlik limit endpointi esa har
   * chaqirilganda Meta'ga so'rov yuboradi va u ATAYIN faqat "Holat va limit" sahifasida.
   *
   * ⚠️ Xato JIM yutiladi: sanoq — bezak, u yuklanmasa ham sahifalar ishlayveradi. Xatoni
   * bu yerda ko'rsatish har sahifa tepasida takrorlanadigan qizil chiziq bo'lardi.
   */
  const refreshCounts = useCallback(async () => {
    try {
      setDiag(await getIgContentStatus())
    } catch {
      setDiag(null)
    }
  }, [])

  useEffect(() => { void refreshCounts() }, [refreshCounts])

  /** «Yangilash» — sanoqlarni ham, ochiq turgan bolaning ma'lumotini ham yangilaydi. */
  const reload = useCallback(() => {
    setReloadKey((k) => k + 1)
    void refreshCounts()
  }, [refreshCounts])

  const queueCount = (diag?.scheduled ?? 0) + (diag?.processing ?? 0)
  const failedCount = diag?.failed ?? 0

  const items: MkSubnavItem[] = [
    { to: '/admin/marketing/kontent', label: 'Navbat', icon: 'clock', end: true, count: queueCount },
    { to: '/admin/marketing/kontent/joylangan', label: 'Joylanganlar', icon: 'grid' },
    { to: '/admin/marketing/kontent/holat', label: 'Holat va limit', icon: 'gauge', count: failedCount },
  ]

  /**
   * ⚠️ Kontekst `useMemo` bilan BARQAROR saqlanadi: bola `refreshCounts` ni `useEffect`
   * bog'liqligiga qo'ysa, har renderdagi yangi funksiya cheksiz sikl hosil qilardi.
   */
  const context = useMemo<ContentOutlet>(
    () => ({ reloadKey, refreshCounts: () => { void refreshCounts() } }),
    [reloadKey, refreshCounts],
  )

  return (
    <MarketingPage
      title="Kontent"
      sub="Instagram postlarini rejalashtirish va joylash — rasm, video, Reels, Story, karusel"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            <Icon name="refresh" /> Yangilash
          </button>
          {canEdit && (
            <Link className="btn btn-primary btn-sm" to="/admin/marketing/kontent/yangi">
              <Icon name="plus" /> Yangi post
            </Link>
          )}
        </div>
      }
      subnav={<MkSubnav items={items} />}
    >
      <Outlet context={context} />
    </MarketingPage>
  )
}
