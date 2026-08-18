import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Search,
  CheckCircle2,
  X,
  Eye,
  Send,
  Sparkles,
  ArrowLeft,
  Share2,
} from 'lucide-react'
import { api } from '@/api/client'

export interface PublicCertItem {
  id: string
  title: string
  studentName: string
  certType: string
  overallScore: string
  listeningScore?: string
  readingScore?: string
  writingScore?: string
  speakingScore?: string
  imageUrl: string
  order: number
}

export function PublicCertificatesPage() {
  const [certs, setCerts] = useState<PublicCertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedImg, setSelectedImg] = useState<string | null>(null)
  const [selectedCert, setSelectedCert] = useState<PublicCertItem | null>(null)

  const [socials, setSocials] = useState({
    telegramUrl: 'https://t.me/intellect_kokand',
    instagramUrl: 'https://instagram.com/intellect_kokand',
    youtubeUrl: 'https://youtube.com',
    facebookUrl: 'https://facebook.com',
    centerEmail: 'info@intellect.uz',
    contactPhone: '+998 (90) 344-44-34',
    centerAddress: "Farg'ona viloyati, Qo'qon shahar, Asqarali charxiy 5A",
    workingHours: 'Dushanba — Shanba: 09:00 – 17:00',
  })

  useEffect(() => {
    // Load public landing data
    api
      .get('/public/landing-data')
      .then((res) => {
        if (res.data?.certificates) {
          setCerts(res.data.certificates)
        }
        if (res.data?.socials) {
          setSocials(res.data.socials)
        }
      })
      .catch((err) => console.error('Failed to load certificates:', err))
      .finally(() => setLoading(false))
  }, [])

  // Categories extraction
  const categories = [
    { id: 'all', label: 'Barcha Natijalar' },
    { id: 'ielts', label: 'IELTS (7.0+)' },
    { id: 'cefr', label: 'Multilevel (CEFR)' },
    { id: 'sat', label: 'SAT / Math' },
    { id: 'milliy', label: 'Milliy Sertifikat' },
  ]

  const filteredCerts = certs.filter((item) => {
    const matchesSearch =
      item.studentName.toLowerCase().includes(search.toLowerCase()) ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.certType.toLowerCase().includes(search.toLowerCase()) ||
      item.overallScore.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (activeCategory === 'all') return true
    const typeLower = (item.certType || '').toLowerCase()
    const titleLower = (item.title || '').toLowerCase()

    if (activeCategory === 'ielts') return typeLower.includes('ielts') || titleLower.includes('ielts')
    if (activeCategory === 'cefr') return typeLower.includes('cefr') || typeLower.includes('multi') || titleLower.includes('cefr')
    if (activeCategory === 'sat') return typeLower.includes('sat') || titleLower.includes('sat')
    if (activeCategory === 'milliy') return typeLower.includes('milli') || titleLower.includes('milli')

    return true
  })

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#090d16]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              🎓
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-blue-400 transition-colors">
              Intellect Kokand
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="/#courses" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
              Kurslar
            </a>
            <a href="/#teachers" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
              Ustozlar
            </a>
            <Link to="/sertifikatlar" className="text-sm font-bold text-blue-400 border-b-2 border-blue-500 pb-1">
              Sertifikatlar
            </Link>
            <a href="/#contact" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
              Aloqa
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>Bosh Sahifa</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative py-16 overflow-hidden border-b border-white/5 bg-gradient-to-b from-blue-950/20 to-transparent">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Faxrimiz va Natijalarimiz</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
              O'quvchilarimizning Sertifikatlari Katalogi
            </h1>
            <p className="max-w-2xl mx-auto text-gray-400 text-base sm:text-lg">
              Intellect Kokand o'quv markazining IELTS, Multilevel (CEFR), SAT va Milliy Sertifikat topshirgan o'quvchilarining rasmiy natijalari.
            </p>

            {/* SEARCH & FILTERS */}
            <div className="mt-10 max-w-3xl mx-auto space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="O'quvchi ismi yoki imtihon turi bo'yicha qidirish..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-900/80 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base backdrop-blur"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      activeCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-500'
                        : 'bg-gray-900/60 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CERTIFICATES GRID */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p>Sertifikatlar yuklanmoqda...</p>
              </div>
            ) : filteredCerts.length === 0 ? (
              <div className="py-20 text-center text-gray-400 bg-gray-900/40 rounded-3xl border border-white/5 max-w-xl mx-auto">
                <Award className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Mos sertifikatlar topilmadi</h3>
                <p className="text-sm text-gray-500">Qidiruv so'rovini ozroq o'zgartirib ko'ring.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCerts.map((cert) => (
                  <div
                    key={cert.id}
                    className="group bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 shadow-xl hover:shadow-blue-500/10"
                  >
                    {/* Image Preview Container */}
                    <div
                      className="relative h-64 bg-gray-950 overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedImg(cert.imageUrl)
                        setSelectedCert(cert)
                      }}
                    >
                      <img
                        src={cert.imageUrl || '/placeholder.png'}
                        alt={cert.studentName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80" />

                      {/* Badge Top Right */}
                      <span className="absolute top-3 right-3 px-3 py-1 bg-blue-600/90 backdrop-blur text-white text-xs font-black rounded-lg shadow-lg border border-blue-400/30">
                        {cert.certType} — {cert.overallScore}
                      </span>

                      {/* View Hover Overlay */}
                      <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 rounded-xl bg-black/70 text-white text-xs font-bold flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-400" /> Kattalashtirish
                        </span>
                      </div>
                    </div>

                    {/* Content Bottom */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                          {cert.studentName}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium">{cert.title}</p>

                        {/* Sub-scores grid if available */}
                        {(cert.listeningScore || cert.readingScore || cert.writingScore || cert.speakingScore) && (
                          <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-white/5 text-center">
                            {cert.listeningScore && (
                              <div className="bg-white/5 rounded-lg p-1.5">
                                <span className="block text-[10px] text-gray-400 font-bold uppercase">L</span>
                                <span className="text-xs font-extrabold text-blue-400">{cert.listeningScore}</span>
                              </div>
                            )}
                            {cert.readingScore && (
                              <div className="bg-white/5 rounded-lg p-1.5">
                                <span className="block text-[10px] text-gray-400 font-bold uppercase">R</span>
                                <span className="text-xs font-extrabold text-blue-400">{cert.readingScore}</span>
                              </div>
                            )}
                            {cert.writingScore && (
                              <div className="bg-white/5 rounded-lg p-1.5">
                                <span className="block text-[10px] text-gray-400 font-bold uppercase">W</span>
                                <span className="text-xs font-extrabold text-blue-400">{cert.writingScore}</span>
                              </div>
                            )}
                            {cert.speakingScore && (
                              <div className="bg-white/5 rounded-lg p-1.5">
                                <span className="block text-[10px] text-gray-400 font-bold uppercase">S</span>
                                <span className="text-xs font-extrabold text-blue-400">{cert.speakingScore}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tasdiqlangan Natija
                        </span>
                        <button
                          onClick={() => {
                            setSelectedImg(cert.imageUrl)
                            setSelectedCert(cert)
                          }}
                          className="text-blue-400 hover:text-blue-300 font-bold underline"
                        >
                          Ko'rish
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* LIGHTBOX MODAL */}
      {selectedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedImg(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-gray-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gray-950 flex items-center justify-between border-b border-white/10">
              <div>
                <h4 className="font-bold text-white text-base">
                  {selectedCert?.studentName} — {selectedCert?.certType} {selectedCert?.overallScore}
                </h4>
                <p className="text-xs text-gray-400">{selectedCert?.title}</p>
              </div>
              <button
                onClick={() => setSelectedImg(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[80vh] overflow-auto flex items-center justify-center bg-black">
              <img src={selectedImg} alt="Certificate" className="max-w-full max-h-[75vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-[#060911] border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-lg text-white">
              🎓
            </div>
            <span className="font-bold text-white text-lg">Intellect Kokand</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={socials.telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </a>
            <a
              href={socials.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-pink-600 transition-colors"
            >
              <Share2 className="w-4 h-4 text-white" />
            </a>
          </div>

          <p className="text-xs text-gray-500">
            © 2013-2026 Intellect Kokand. Barcha huquqlar himoyalangan. | <a href="/privacy" className="underline">Ommaviy offerta</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
