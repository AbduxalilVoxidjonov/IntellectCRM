import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/auth-context'
import { homeByRole } from '@/config/navigation'
import { getPublicBrand, type PublicBrand } from '@/api/services/settings'

interface LocationState {
  from?: string
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? "Kirishda xatolik yuz berdi"
  }
  if (err instanceof Error) return err.message
  return "Kirishda xatolik yuz berdi"
}

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState<PublicBrand>({ name: '', logoUrl: '', phone: '' })

  useEffect(() => {
    getPublicBrand()
      .then(setBrand)
      .catch(() => {})
  }, [])

  // Allaqachon kirgan bo'lsa — o'z bo'limiga
  if (isAuthenticated && user) {
    return <Navigate to={homeByRole[user.role]} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await login(email, password)
      const from = (location.state as LocationState | null)?.from
      navigate(from ?? homeByRole[u.role], { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      {/* Yumshoq fon nuri — premium his */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[360px] w-[360px] rounded-full bg-fuchsia-200/30 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-[var(--shadow-2,0_10px_40px_-12px_rgba(0,0,0,0.18))]">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt="Logo"
              className="h-14 w-14 rounded-2xl object-contain"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-fuchsia-600 text-lg font-bold tracking-tight text-white shadow-[0_8px_24px_-6px_oklch(0.5_0.18_282_/_0.5)]">
              IC
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              {brand.name || 'IntellectCRM'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">Tizimga kirish</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Login"
            type="text"
            autoComplete="username"
            placeholder="Login"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Parol"
            type="password"
            autoComplete="current-password"
            placeholder="parol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Kirilmoqda…' : 'Kirish'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link to="/privacy" className="hover:text-brand-600 hover:underline">
            Maxfiylik siyosati
          </Link>
        </p>
      </div>
    </div>
  )
}
