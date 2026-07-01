import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/marketing.css'
import App from './App.tsx'
import { AuthProvider } from '@/context/AuthProvider'
import { registerForInstall } from '@/api/services/webpush'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// PWA: startup'da service worker'ni ro'yxatdan o'tkazamiz (login'dan oldin) — sayt "o'rnatiladigan"
// bo'ladi. Push tokeni esa login'da (student/teacher) olinadi. Best-effort — xatoni yutamiz.
registerForInstall().catch(() => {})
