import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Pencil, Copy, ChevronRight, ListChecks, Loader2,
  FileSpreadsheet, FileDown, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import type { Curriculum, CurriculumModule } from '@/types'
import {
  getCurriculum, createModule, updateModule, deleteModule, copyModuleToCurriculum,
  downloadCurriculumImportTemplate, importCurriculumExcel, listCurricula,
} from '@/api/services/curriculum'
import type { CurriculumExcelImportResult, CurriculumSummary } from '@/api/services/curriculum'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { apiErrorMessage, cn } from '@/lib/utils'
import { NameModal, ConfirmDeleteModal } from './shared'

type Notice = { type: 'success' | 'error'; text: string }

/** O'quv dasturi 1-bosqich: bitta dastur ichidagi Modullar ro'yxati. Modul ustiga bosilsa —
 *  ichiga (Mavzular) kiriladi. */
export function CurriculumModulesPage() {
  const { curriculumId = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Curriculum | null>(null)
  const [otherCurricula, setOtherCurricula] = useState<CurriculumSummary[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [renaming, setRenaming] = useState<CurriculumModule | null>(null)
  const [renameBusy, setRenameBusy] = useState(false)
  const [deleting, setDeleting] = useState<CurriculumModule | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [copyingModule, setCopyingModule] = useState<CurriculumModule | null>(null)
  const [copyTarget, setCopyTarget] = useState('')
  const [isCopying, setIsCopying] = useState(false)

  const load = () =>
    Promise.all([
      getCurriculum(curriculumId).then(setData).catch(() => setData(null)),
      listCurricula().then((cs) => setOtherCurricula(cs.filter((c) => c.id !== curriculumId))).catch(() => setOtherCurricula([])),
    ]).finally(() => setLoading(false))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumId])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const addModule = async (name: string) => {
    setAddBusy(true)
    try {
      const { id: mid } = await createModule(curriculumId, name)
      const module: CurriculumModule = { id: mid, name, note: '', order: 0, topics: [] }
      setData((d) => (d ? { ...d, modules: [...d.modules, module] } : d))
      setAddOpen(false)
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err, 'Xato yuz berdi') })
    } finally {
      setAddBusy(false)
    }
  }

  const submitRename = async (name: string) => {
    if (!renaming) return
    setRenameBusy(true)
    try {
      await updateModule(renaming.id, name, renaming.note)
      setData((d) => (d ? { ...d, modules: d.modules.map((m) => (m.id === renaming.id ? { ...m, name } : m)) } : d))
      setRenaming(null)
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err, 'Xato yuz berdi') })
    } finally {
      setRenameBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteModule(deleting.id)
      setData((d) => (d ? { ...d, modules: d.modules.filter((m) => m.id !== deleting.id) } : d))
      setDeleting(null)
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err, "O'chirib bo'lmadi") })
    } finally {
      setDeleteBusy(false)
    }
  }

  const doCopyModule = async () => {
    if (!copyTarget || !copyingModule) return
    setIsCopying(true)
    try {
      const result = await copyModuleToCurriculum(copyingModule.id, copyTarget)
      setNotice({
        type: 'success',
        text: `"${copyingModule.name}" → "${otherCurricula.find((c) => c.id === copyTarget)?.name}": ${result.topicCount} mavzu, ${result.lessonCount} dars va ${result.itemCount} topshiriq nusxalandi`,
      })
      setCopyingModule(null)
      setCopyTarget('')
    } catch (err) {
      setNotice({ type: 'error', text: apiErrorMessage(err, 'Xato yuz berdi') })
    } finally {
      setIsCopying(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <Loader label="Yuklanmoqda..." />
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="py-12 text-center text-slate-400">
        Dastur topilmadi.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => navigate('/admin/curricula')}>
            <ArrowLeft className="h-4 w-4" /> Dasturlarga qaytish
          </Button>
        </div>
      </Card>
    )
  }

  const allItems = data.modules.flatMap((m) => m.topics.flatMap((t) => t.lessons.flatMap((s) => s.items)))
  const totalItems = allItems.length
  const readyItems = allItems.filter((it) => it.ready).length

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/admin/curricula')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Dasturlarga qaytish
      </button>

      <PageHeader
        title={data.name}
        sub={
          totalItems > 0
            ? `${readyItems} / ${totalItems} topshiriq tayyor · Modul tanlang`
            : 'Modul → Mavzu → Dars → Topshiriq'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel'dan yuklash
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Modul
            </Button>
          </>
        }
      />

      {notice && (
        <div
          className={cn(
            'mb-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium',
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800',
          )}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {data.modules.length === 0 ? (
        <Card className="py-12 text-center text-slate-400">
          <ListChecks className="mx-auto mb-2 h-6 w-6" />
          Hali modul kiritilmagan. Yuqoridagi "+ Modul" tugmasi bilan boshlang.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.modules.map((module) => {
            const items = module.topics.flatMap((t) => t.lessons.flatMap((s) => s.items))
            const ready = items.filter((it) => it.ready).length
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => navigate(`/admin/curricula/${curriculumId}/${module.id}`)}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-300 hover:shadow-[0_4px_16px_oklch(0.5_0.18_282_/_0.1)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{module.name}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    <span className="text-slate-500">{module.topics.length} mavzu</span>
                    <span className="font-medium text-brand-600">
                      {ready}/{items.length} topshiriq
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenaming(module)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                    title="Nomini o'zgartirish"
                  >
                    <Pencil className="h-4 w-4" />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCopyingModule(module)
                      setCopyTarget('')
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    title="Boshqa dasturga nusxalash"
                  >
                    <Copy className="h-4 w-4" />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleting(module)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="O'chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <NameModal
        open={addOpen}
        title="Yangi modul"
        label="Modul nomi"
        placeholder="Masalan: Beginner, A1, 1-modul..."
        hint="Modul — dasturning katta bosqichi. Ichiga mavzular qo'shiladi."
        busy={addBusy}
        onClose={() => setAddOpen(false)}
        onSubmit={addModule}
      />

      <NameModal
        open={!!renaming}
        title="Modul nomini o'zgartirish"
        label="Modul nomi"
        placeholder="Modul nomi"
        initialValue={renaming?.name ?? ''}
        submitLabel="Saqlash"
        busy={renameBusy}
        onClose={() => setRenaming(null)}
        onSubmit={submitRename}
      />

      <ConfirmDeleteModal
        open={!!deleting}
        title="Modulni o'chirish"
        message={
          deleting && (
            <>
              <b>"{deleting.name}"</b> moduli barcha mavzu, dars va topshiriqlari bilan birga
              o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </>
          )
        }
        busy={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />

      <Modal
        open={!!copyingModule}
        onClose={() => setCopyingModule(null)}
        size="sm"
        title={`"${copyingModule?.name}" modulini nusxalash`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyingModule(null)} disabled={isCopying}>
              Bekor qilish
            </Button>
            <Button onClick={doCopyModule} disabled={!copyTarget || isCopying}>
              {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Nusxalash
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs font-semibold text-slate-500">Maqsadli dasturni tanlang:</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {otherCurricula.length === 0 ? (
            <p className="text-xs text-slate-400">Boshqa dastur yo'q</p>
          ) : (
            otherCurricula.map((c) => (
              <button
                key={c.id}
                onClick={() => setCopyTarget(c.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  copyTarget === c.id
                    ? 'border-brand-400 bg-brand-50 font-medium text-brand-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      </Modal>

      <ImportExcelModal
        open={importOpen}
        curriculumId={curriculumId}
        onClose={() => setImportOpen(false)}
        onImported={async (r) => {
          await load()
          if (r.errors.length === 0)
            setNotice({
              type: 'success',
              text: `Import yakunlandi: ${r.modules} modul, ${r.topics} mavzu, ${r.lessons} dars qo'shildi`,
            })
        }}
      />
    </div>
  )
}

// ============================ Excel import modali ============================

interface ImportExcelModalProps {
  open: boolean
  curriculumId: string
  onClose: () => void
  onImported: (r: CurriculumExcelImportResult) => void
}

function ImportExcelModal({ open, curriculumId, onClose, onImported }: ImportExcelModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<CurriculumExcelImportResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setFile(null)
      setReplace(false)
      setResult(null)
      setError('')
    }
  }, [open])

  const downloadTemplate = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadCurriculumImportTemplate()
    } finally {
      setDownloading(false)
    }
  }

  const submit = async () => {
    if (!file || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const r = await importCurriculumExcel(curriculumId, file, replace)
      setResult(r)
      onImported(r)
    } catch (err) {
      setError(apiErrorMessage(err, 'Xato yuz berdi'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="O'quv dasturini Excel'dan yuklash"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {result ? 'Yopish' : 'Bekor qilish'}
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Yuklash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">1. Shablonni yuklab oling</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Ustunlar: Modul, Mavzu, Dars nomi, Izoh. Yo'riqnoma varag'ida namuna bor. Topshiriqlar
              import'dan keyin har dars ichida qo'lda qo'shiladi.
            </p>
          </div>
          <Button variant="secondary" onClick={downloadTemplate} disabled={downloading} className="flex-shrink-0">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Shablon
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">2. To'ldirilgan faylni tanlang</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setResult(null)
              setError('')
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium transition-colors',
              file
                ? 'border-brand-300 bg-brand-50/50 text-brand-700'
                : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600',
            )}
          >
            <FileSpreadsheet className="h-5 w-5" />
            {file ? file.name : 'Fayl tanlash (.xlsx)'}
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          <span className="text-sm">
            <span className="font-semibold text-slate-800">Mavjud dasturni almashtirish</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              Belgilansa — eski modul/mavzu/darslar (o'quvchilar progressi bilan) O'CHIRILIB, faqat
              fayldagi dastur qoladi. Belgilanmasa — fayldagi darslar mavjud dasturga qo'shiladi
              (bir xil nomli modul/mavzu takrorlanmaydi).
            </span>
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3',
              result.errors.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50',
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span className={result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}>
                {result.modules} modul, {result.topics} mavzu, {result.lessons} dars qo'shildi
                {result.skipped > 0 ? ` (${result.skipped} bo'sh qator o'tkazildi)` : ''}
              </span>
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-amber-800">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row}-qator: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
