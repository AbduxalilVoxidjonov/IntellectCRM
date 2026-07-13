import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { getPublicBrand, type PublicBrand } from '@/api/services/settings'

/**
 * Ommaviy (autentifikatsiyasiz) maxfiylik siyosati sahifasi — `/privacy`.
 * Google Play / App Store ilova sahifasida talab qilinadigan "Privacy Policy" URL'i
 * shu sahifaga ishora qiladi (masalan https://crm.intellectschool.uz/privacy).
 * Matn markaz nomi va telefonini ommaviy brendingdan (tokensiz /public/brand) oladi.
 */
export function PrivacyPolicyPage() {
  const [brand, setBrand] = useState<PublicBrand>({ name: '', logoUrl: '', phone: '' })

  useEffect(() => {
    getPublicBrand()
      .then(setBrand)
      .catch(() => {})
  }, [])

  const centerName = brand.name || 'IntellectCRM'
  const updated = '13.07.2026'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Sarlavha */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="Logo" className="h-14 w-14 rounded-2xl object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white shadow-[0_8px_24px_-6px_oklch(0.5_0.18_282_/_0.5)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Maxfiylik siyosati
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {centerName} · oxirgi yangilanish: {updated}
            </p>
          </div>
        </div>

        {/* Matn */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-6 text-[15px] leading-relaxed text-slate-700">
            <p>
              Ushbu maxfiylik siyosati <b>{centerName}</b> o'quv markazining mobil ilovasi va veb-tizimi
              (bundan buyon — «Ilova») foydalanuvchilarining shaxsiy ma'lumotlari qanday to'planishi,
              ishlatilishi va himoyalanishini tushuntiradi. Ilovadan foydalanish orqali siz ushbu
              siyosat shartlariga rozilik bildirasiz.
            </p>

            <Section title="1. Biz to'playdigan ma'lumotlar">
              <p>Ilova quyidagi ma'lumotlarni to'plashi mumkin:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <b>Shaxsiy ma'lumotlar:</b> ism-familiya, telefon raqami, login va o'quv markazi
                  bergan hisob ma'lumotlari (o'quvchi, ota-ona, o'qituvchi yoki xodim sifatida).
                </li>
                <li>
                  <b>O'quv ma'lumotlari:</b> davomat, baholar, topshiriqlar, to'lovlar va o'quv
                  jarayoniga oid boshqa yozuvlar.
                </li>
                <li>
                  <b>Qurilma va bildirishnoma ma'lumotlari:</b> push-bildirishnoma yuborish uchun
                  qurilma tokeni (Firebase Cloud Messaging), qurilma turi va operatsion tizim versiyasi.
                </li>
                <li>
                  <b>Joylashuv (ixtiyoriy):</b> agar tegishli funksiya yoqilgan bo'lsa va siz ruxsat
                  bergan bo'lsangiz, xavfsizlik maqsadida joylashuv ma'lumoti ishlatilishi mumkin.
                  Ruxsatni istalgan vaqtda qurilma sozlamalaridan bekor qilishingiz mumkin.
                </li>
              </ul>
            </Section>

            <Section title="2. Ma'lumotlardan foydalanish maqsadi">
              <ul className="list-disc space-y-1 pl-5">
                <li>O'quv jarayonini yuritish: davomat, baho, topshiriq va to'lovlarni kuzatish;</li>
                <li>Bildirishnomalar yuborish (dars, baho, to'lov eslatmalari va e'lonlar);</li>
                <li>Foydalanuvchini autentifikatsiya qilish va hisob xavfsizligini ta'minlash;</li>
                <li>Ilova ishini yaxshilash va texnik nosozliklarni bartaraf etish.</li>
              </ul>
            </Section>

            <Section title="3. Ma'lumotlarni uchinchi tomonlarga berish">
              <p>
                Biz sizning shaxsiy ma'lumotlaringizni sotmaymiz. Ma'lumotlar faqat Ilova ishlashi
                uchun zarur bo'lgan xizmat provayderlari bilan ulashiladi:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <b>Google Firebase</b> — push-bildirishnomalarni yetkazish uchun;
                </li>
                <li>
                  <b>SMS provayderi</b> — hisob va to'lovga oid SMS xabarlarni yuborish uchun;
                </li>
                <li>
                  <b>Telegram</b> — foydalanuvchi ulagan bo'lsa, bildirishnomalarni yuborish uchun.
                </li>
              </ul>
              <p className="mt-2">
                Bundan tashqari, ma'lumotlar qonun talab qilgan hollardagina tegishli davlat
                organlariga taqdim etilishi mumkin.
              </p>
            </Section>

            <Section title="4. Ma'lumotlarni saqlash va himoya">
              <p>
                Ma'lumotlar himoyalangan serverlarda saqlanadi va ruxsatsiz kirishdan himoyalash
                uchun texnik va tashkiliy choralar ko'riladi (shifrlangan ulanish, kirish nazorati).
                Ma'lumotlar o'quv markazi bilan munosabatlaringiz davomida va qonun talab qilgan
                muddat davomida saqlanadi.
              </p>
            </Section>

            <Section title="5. Bolalar ma'lumotlari">
              <p>
                Ilova o'quv markazi tomonidan boshqariladi. Voyaga yetmagan o'quvchilarning
                ma'lumotlari ota-onasi/qonuniy vakili roziligi asosida o'quv markazi tomonidan
                kiritiladi va faqat o'quv maqsadlarida ishlatiladi.
              </p>
            </Section>

            <Section title="6. Sizning huquqlaringiz">
              <p>
                Siz o'zingiz haqingizdagi ma'lumotlarni ko'rish, tuzatish yoki o'chirishni so'rash
                huquqiga egasiz. Hisobingizni yoki ma'lumotlaringizni o'chirish uchun o'quv markaziga
                murojaat qiling{brand.phone ? <> (tel: <b>{brand.phone}</b>)</> : ''}.
              </p>
            </Section>

            <Section title="7. Siyosatdagi o'zgarishlar">
              <p>
                Ushbu maxfiylik siyosati vaqti-vaqti bilan yangilanishi mumkin. Muhim o'zgarishlar
                Ilova orqali e'lon qilinadi. Sahifaning yuqorisidagi «oxirgi yangilanish» sanasi
                joriy versiyani bildiradi.
              </p>
            </Section>

            <Section title="8. Biz bilan bog'lanish">
              <p>
                Maxfiylik bo'yicha savollaringiz bo'lsa, <b>{centerName}</b> o'quv markaziga murojaat
                qiling{brand.phone ? <>: <b>{brand.phone}</b></> : ''}.
              </p>
            </Section>
          </div>
        </div>

        {/* Orqaga */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Kirish sahifasiga qaytish
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  )
}
