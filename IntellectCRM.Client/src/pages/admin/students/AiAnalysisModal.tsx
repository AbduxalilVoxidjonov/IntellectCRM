import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, FileDown, AlertCircle } from 'lucide-react'
import { getStudentAiAnalysis } from '@/api/services/students'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
}

/* ---------- Yengil Markdown → HTML (## sarlavha, - ro'yxat, **qalin**) ---------- */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  let html = ''
  let listOpen = false
  const closeList = () => {
    if (listOpen) {
      html += '</ul>'
      listOpen = false
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      closeList()
      continue
    }
    if (line.startsWith('### ')) {
      closeList()
      html += `<h3>${inline(line.slice(4))}</h3>`
    } else if (line.startsWith('## ')) {
      closeList()
      html += `<h2>${inline(line.slice(3))}</h2>`
    } else if (line.startsWith('# ')) {
      closeList()
      html += `<h2>${inline(line.slice(2))}</h2>`
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) {
        html += '<ul>'
        listOpen = true
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`
    } else {
      closeList()
      html += `<p>${inline(line)}</p>`
    }
  }
  closeList()
  return html
}

export function AiAnalysisModal({ open, onClose, studentId, studentName }: Props) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setLoading(true)
    setError(null)
    setAnalysis('')
    getStudentAiAnalysis(studentId)
      .then((r) => {
        if (r.ok) {
          setAnalysis(r.analysis)
          setModel(r.model)
        } else {
          setError(r.error || 'Tahlil qilib bo\'lmadi.')
        }
      })
      .catch((e) => {
        setError(
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Tahlil qilib bo\'lmadi. Internet yoki API kalitini tekshiring.',
        )
      })
      .finally(() => setLoading(false))
  }

  // Oyna ochilganda avtomatik tahlil boshlanadi (bir marta).
  useEffect(() => {
    if (open && !analysis && !loading && !error) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Yopilganda holatni tozalaymiz (keyingi ochishda yangidan).
  useEffect(() => {
    if (!open) {
      setAnalysis('')
      setError(null)
    }
  }, [open])

  const downloadPdf = () => {
    if (!analysis) return
    const now = new Date()
    const dateStr = now.toLocaleString('uz-UZ')
    const win = window.open('', '_blank', 'width=840,height=920')
    if (!win) {
      alert('Brauzer yangi oynani bloklab qo\'ydi. Pop-up\'ga ruxsat bering.')
      return
    }
    win.document.write(`<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><title>AI Tahlil — ${escapeHtml(studentName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #1e293b; margin: 0; padding: 40px 48px; line-height: 1.6; }
  .head { border-bottom: 3px solid #6d28d9; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { color: #6d28d9; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; }
  h1 { font-size: 24px; margin: 6px 0 2px; }
  .meta { font-size: 12px; color: #64748b; }
  h2 { font-size: 17px; color: #4c1d95; margin: 20px 0 6px; border-left: 4px solid #a78bfa; padding-left: 10px; }
  h3 { font-size: 15px; margin: 14px 0 4px; }
  p { margin: 4px 0; }
  ul { margin: 4px 0 10px; padding-left: 22px; }
  li { margin: 3px 0; }
  strong { color: #0f172a; }
  .foot { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 20px 24px; } }
</style></head>
<body>
  <div class="head">
    <div class="brand">IntellectCRM · AI Tahlil</div>
    <h1>${escapeHtml(studentName)}</h1>
    <div class="meta">Sana: ${escapeHtml(dateStr)}${model ? ` · Model: ${escapeHtml(model)}` : ''}</div>
  </div>
  <div class="content">${mdToHtml(analysis)}</div>
  <div class="foot">Ushbu tahlil sun'iy intellekt (${escapeHtml(model || 'Gemini')}) tomonidan o'quvchi ma'lumotlari asosida yaratilgan. Yakuniy qarorlar uchun pedagogik baholash bilan birga ko'rib chiqilsin.</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`)
    win.document.close()
    win.focus()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="AI Tahlil"
      footer={
        <>
          <Button variant="secondary" onClick={run} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Qayta tahlil
          </Button>
          <Button onClick={downloadPdf} disabled={loading || !analysis}>
            <FileDown className="h-4 w-4" /> PDF yuklab olish
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <span>
          <b className="text-slate-700">{studentName}</b> — barcha ma'lumotlar AI orqali tahlil qilinmoqda
        </span>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-400">
          <RefreshCw className="h-7 w-7 animate-spin text-brand-500" />
          <p className="text-sm">AI o'quvchi ma'lumotlarini tahlil qilmoqda...</p>
          <p className="text-xs text-slate-400">Bu bir necha soniya olishi mumkin.</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Tahlil amalga oshmadi</p>
            <p className="mt-0.5 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && analysis && (
        <div
          className="space-y-1 text-sm leading-relaxed text-slate-700 [&_h2]:mt-5 [&_h2]:border-l-4 [&_h2]:border-brand-300 [&_h2]:pl-2.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-brand-800 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: mdToHtml(analysis) }}
        />
      )}
    </Modal>
  )
}
