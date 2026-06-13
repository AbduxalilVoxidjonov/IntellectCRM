import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Icon, fmtDate } from '@/pages/student/lib'
import { getStudentLocation, updateStudentLocation } from '@/api/services/studentPortal'

/* ============================================================
   O'quvchi portali — UY JOYLASHUVI.
   O'quvchi/ota-ona uy joylashuvini yuboradi (GPS yoki xaritadan tanlash).
   Admin "Ilova → Joylashuv" xaritasida ko'rinadi. .student-app shell.
   ============================================================ */

// Leaflet default pin ikoni Vite bilan yuklanmaydi — CDN'dan ko'rsatamiz.
const PIN = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const TASHKENT: [number, number] = [41.2995, 69.2401]

/** Xaritani berilgan nuqtaga uchiradi (GPS topilganda qayta markazlash). */
function Recenter({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  const last = useRef<string>('')
  useEffect(() => {
    if (!pos) return
    const key = pos.join(',')
    if (key === last.current) return
    last.current = key
    map.setView(pos, Math.max(map.getZoom(), 16), { animate: true })
  }, [pos, map])
  return null
}

/** Xaritaga bosilganda pinni o'sha joyga qo'yadi. */
function ClickToSet({ onSet }: { onSet: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onSet([e.latlng.lat, e.latlng.lng]) })
  return null
}

export function StudentLocationScreen() {
  const nav = useNavigate()
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let alive = true
    getStudentLocation()
      .then((l) => {
        if (!alive) return
        if (l.latitude != null && l.longitude != null) setPos([l.latitude, l.longitude])
        setUpdatedAt(l.updatedAt ?? null)
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // Joriy GPS joylashuvni olish.
  const locate = () => {
    setErr('')
    setOk(false)
    if (!('geolocation' in navigator)) {
      setErr("Qurilma joylashuvni qo'llab-quvvatlamaydi.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude])
        setLocating(false)
      },
      (e) => {
        setLocating(false)
        setErr(
          e.code === e.PERMISSION_DENIED
            ? "Joylashuvga ruxsat berilmadi. Ilova sozlamalaridan ruxsat bering."
            : "Joylashuvni aniqlab bo'lmadi. Qaytadan urinib ko'ring.",
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const save = async () => {
    if (!pos) return
    setSaving(true)
    setErr('')
    setOk(false)
    try {
      await updateStudentLocation(pos[0], pos[1])
      const fresh = await getStudentLocation()
      setUpdatedAt(fresh.updatedAt ?? null)
      setOk(true)
    } catch {
      setErr("Saqlashda xatolik. Internetni tekshiring.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <div className="hd">
        <div className="row gap10" style={{ minHeight: 38 }}>
          <button className="iconbtn press" onClick={() => nav(-1)}>
            <Icon name="chevL" size={22} />
          </button>
          <div className="hd-sm" style={{ flex: 1 }}>
            Uy joylashuvi
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingBottom: 24 }}>
        {/* Izoh */}
        <div
          className="card"
          style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, borderRadius: 18 }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--accentSoft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <Icon name="pin" size={20} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Uy manzilingizni belgilang</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.5 }}>
              "Joriy joylashuvim" tugmasini bosing yoki xaritadan uyingizni tanlang, so'ng saqlang.
            </div>
          </div>
        </div>

        {/* Xarita */}
        <div
          style={{
            height: 300,
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            marginBottom: 12,
          }}
        >
          {!loading && (
            <MapContainer
              center={pos ?? TASHKENT}
              zoom={pos ? 16 : 12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickToSet onSet={setPos} />
              <Recenter pos={pos} />
              {pos && (
                <Marker
                  position={pos}
                  draggable
                  icon={PIN}
                  eventHandlers={{
                    dragend: (e) => {
                      const m = e.target as L.Marker
                      const ll = m.getLatLng()
                      setPos([ll.lat, ll.lng])
                    },
                  }}
                />
              )}
            </MapContainer>
          )}
        </div>

        {/* Koordinata + holat */}
        {pos && (
          <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginBottom: 12 }}>
            {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
            {updatedAt && <> · Oxirgi: {fmtDate(updatedAt)}</>}
          </div>
        )}

        {err && (
          <div
            style={{
              background: 'var(--redSoft)',
              color: 'var(--red)',
              borderRadius: 14,
              padding: '11px 14px',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Icon name="alert" size={17} color="var(--red)" />
            {err}
          </div>
        )}
        {ok && (
          <div
            style={{
              background: 'var(--greenSoft, #dcfce7)',
              color: 'var(--green, #16a34a)',
              borderRadius: 14,
              padding: '11px 14px',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Icon name="checkCircle" size={17} />
            Joylashuv saqlandi
          </div>
        )}

        {/* Tugmalar */}
        <button className="btn btn-soft press" onClick={locate} disabled={locating} style={{ marginBottom: 10 }}>
          <Icon name="locate" size={19} color="var(--accent)" />
          {locating ? 'Aniqlanmoqda...' : 'Joriy joylashuvim'}
        </button>
        <button className="btn btn-primary btn-lg press" onClick={save} disabled={!pos || saving}>
          <Icon name="check" size={20} color="#fff" />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </div>
  )
}
