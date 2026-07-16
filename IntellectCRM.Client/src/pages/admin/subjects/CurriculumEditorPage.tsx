import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, ListChecks, Check,
  Video, FileText, Music, BookOpen, ClipboardCheck, Upload, Loader2, GripVertical, Copy,
  AlertTriangle, CheckCircle2, FileSpreadsheet, FileDown, FileType, ExternalLink, X,
} from 'lucide-react'
import type {
  Curriculum, CurriculumLevel, CurriculumTopic, CurriculumSubTopic, CurriculumItem, LessonType, Subject,
} from '@/types'
import {
  getCurriculum,
  createLevel, updateLevel, deleteLevel,
  createTopic, updateTopic, deleteTopic,
  createSubTopic, updateSubTopic, deleteSubTopic,
  createItem, deleteItem,
  getCourseItem, saveItemContent,
  copyLevelToSubject,
  downloadCurriculumImportTemplate, importCurriculumExcel,
} from '@/api/services/curriculum'
import type {
  CourseItemDetail, VocabEntry, CourseQuestion, SaveItemContent, CurriculumExcelImportResult,
} from '@/api/services/curriculum'
import { uploadAdminFile } from '@/api/services/students'
import { getSubjects } from '@/api/services/subjects'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

// ---- Dars turi metadata ----
const LESSON_TYPES: { type: LessonType; label: string; icon: typeof Video }[] = [
  { type: 'video', label: 'Video', icon: Video },
  { type: 'text', label: 'Matn', icon: FileText },
  { type: 'audio', label: 'Audio', icon: Music },
  { type: 'pdf', label: 'PDF', icon: FileType },
  { type: 'vocab', label: "Lug'at", icon: BookOpen },
  { type: 'test', label: 'Test', icon: ClipboardCheck },
]

function typeMeta(type: LessonType) {
  return LESSON_TYPES.find((t) => t.type === type) ?? LESSON_TYPES[1]
}

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ---- Modal holatlari (brauzer prompt/confirm/alert o'rniga) ----
// Tuzilma: Bo'lim → Mavzu → Sub-mavzu (tur SHU YERDA tanlanadi va qulflanadi) → Dars(lar) (shu turdan).
type NamePrompt =
  | { kind: 'level' }
  | { kind: 'topic'; levelId: string }
  | { kind: 'item'; levelId: string; topicId: string; subTopicId: string; itemTypeLabel: string }

/** Sub-mavzu yaratish — nom VA tur birga so'raladi (tur shu yerda qulflanadi). */
type SubTopicPrompt = { levelId: string; topicId: string }

type DeleteTarget =
  | { kind: 'level'; level: CurriculumLevel }
  | { kind: 'topic'; levelId: string; topic: CurriculumTopic }
  | { kind: 'subtopic'; levelId: string; topicId: string; subTopic: CurriculumSubTopic }
  | { kind: 'item'; levelId: string; topicId: string; subTopicId: string; item: CurriculumItem }

type Notice = { type: 'success' | 'error'; text: string }

const NAME_PROMPT_META: Record<NamePrompt['kind'], { title: string; label: string; placeholder: string; hint?: string }> = {
  level: {
    title: 'Yangi bo\'lim',
    label: 'Bo\'lim nomi',
    placeholder: 'Masalan: Beginner, A1, 1-bo\'lim...',
    hint: "Bo'lim — kursning katta bosqichi. Ichiga mavzular qo'shiladi.",
  },
  topic: {
    title: 'Yangi mavzu',
    label: 'Mavzu nomi',
    placeholder: 'Masalan: Present Simple, Kirish...',
    hint: "Mavzu ichiga sub-mavzular (video/matn/audio/pdf/lug'at/test) qo'shiladi.",
  },
  item: {
    title: 'Yangi dars',
    label: 'Dars nomi',
    placeholder: 'Masalan: 1-dars. Tanishuv...',
    hint: "Kontentni keyin o'ng paneldan to'ldirasiz.",
  },
}

/** "item" prompt uchun sarlavha/label sub-mavzuning qulflangan turiga qarab moslashadi. */
function namePromptMeta(p: NamePrompt): typeof NAME_PROMPT_META['level'] {
  if (p.kind !== 'item') return NAME_PROMPT_META[p.kind]
  return {
    title: `Yangi ${p.itemTypeLabel.toLowerCase()}`,
    label: `${p.itemTypeLabel} nomi`,
    placeholder: `Masalan: 1-${p.itemTypeLabel.toLowerCase()}...`,
    hint: `Bu sub-mavzu "${p.itemTypeLabel}" turiga qulflangan — kontentni keyin o'ng paneldan to'ldirasiz.`,
  }
}

// ============================ Asosiy sahifa ============================

export function CurriculumEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Curriculum | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Copy modal state
  const [copyingLevelId, setCopyingLevelId] = useState<string | null>(null)
  const [copyingLevelName, setCopyingLevelName] = useState<string>('')
  const [copyTarget, setCopyTarget] = useState<string>('')
  const [isCopying, setIsCopying] = useState(false)

  // Nom kiritish / sub-mavzu (nom+tur) / o'chirishni tasdiqlash modallari
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [subTopicPrompt, setSubTopicPrompt] = useState<SubTopicPrompt | null>(null)
  const [subTopicBusy, setSubTopicBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    Promise.all([
      getCurriculum(id)
        .then((c) => {
          setData(c)
          if (c.levels.length > 0) setExpanded(new Set([c.levels[0].id]))
        })
        .catch(() => setData(null)),
      getSubjects()
        .then((s: Subject[]) => setSubjects(s.filter((subj: Subject) => subj.id !== id)))
        .catch(() => setSubjects([])),
    ]).finally(() => setLoading(false))
  }, [id])

  // ---- Lokal holatni yangilash yordamchilari ----
  const patchLevels = (fn: (levels: CurriculumLevel[]) => CurriculumLevel[]) =>
    setData((d) => (d ? { ...d, levels: fn(d.levels) } : d))

  const toggle = (levelId: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(levelId)) next.delete(levelId)
      else next.add(levelId)
      return next
    })

  /** Mavzu daraxtida bitta topicni (ichidagi sub-mavzular bilan) yangilaydi. */
  const patchTopic = (levelId: string, topicId: string, fn: (t: CurriculumTopic) => CurriculumTopic) =>
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? { ...l, topics: l.topics.map((t) => (t.id === topicId ? fn(t) : t)) }
          : l,
      ),
    )

  /** Sub-mavzu ichidagi bandlar (items) ro'yxatini yangilaydi. */
  const patchSubTopic = (
    levelId: string, topicId: string, subTopicId: string, fn: (st: CurriculumSubTopic) => CurriculumSubTopic,
  ) =>
    patchTopic(levelId, topicId, (t) => ({
      ...t, subTopics: t.subTopics.map((st) => (st.id === subTopicId ? fn(st) : st)),
    }))

  // ---- Bo'lim ----
  const addLevel = () => setNamePrompt({ kind: 'level' })
  const addTopic = (levelId: string) => setNamePrompt({ kind: 'topic', levelId })
  const addSubTopic = (levelId: string, topicId: string) => setSubTopicPrompt({ levelId, topicId })
  const addItem = (levelId: string, topicId: string, subTopicId: string, itemTypeLabel: string) =>
    setNamePrompt({ kind: 'item', levelId, topicId, subTopicId, itemTypeLabel })

  const submitName = async (name: string) => {
    if (!namePrompt || nameBusy) return
    setNameBusy(true)
    try {
      if (namePrompt.kind === 'level') {
        const { id: lid } = await createLevel(id, name)
        const level: CurriculumLevel = { id: lid, name, note: '', order: 0, topics: [] }
        patchLevels((ls) => [...ls, level])
        setExpanded((s) => new Set(s).add(lid))
      } else if (namePrompt.kind === 'topic') {
        const { levelId } = namePrompt
        const { id: tid } = await createTopic(levelId, name)
        const topic: CurriculumTopic = { id: tid, title: name, note: '', order: 0, subTopics: [] }
        patchLevels((ls) =>
          ls.map((l) => (l.id === levelId ? { ...l, topics: [...l.topics, topic] } : l)),
        )
      } else {
        const { levelId, topicId, subTopicId } = namePrompt
        const { id: iid } = await createItem(subTopicId, name)
        // Ota sub-mavzuning qulflangan turi — yangi bandga meros qilib beriladi.
        const parentTopic = data?.levels.find((l) => l.id === levelId)?.topics.find((t) => t.id === topicId)
        const itemType = parentTopic?.subTopics.find((st) => st.id === subTopicId)?.type ?? 'text'
        const item: CurriculumItem = {
          id: iid, text: name, note: '', order: 0, type: itemType, meta: '', ready: false,
        }
        patchSubTopic(levelId, topicId, subTopicId, (st) => ({ ...st, items: [...st.items, item] }))
        setSelectedId(iid)
      }
      setNamePrompt(null)
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || err.message || 'Xato yuz berdi' })
    } finally {
      setNameBusy(false)
    }
  }

  const submitSubTopic = async (title: string, type: LessonType) => {
    if (!subTopicPrompt || subTopicBusy) return
    setSubTopicBusy(true)
    try {
      const { levelId, topicId } = subTopicPrompt
      const { id: sid } = await createSubTopic(topicId, title, type)
      const subTopic: CurriculumSubTopic = { id: sid, title, note: '', order: 0, type, items: [] }
      patchTopic(levelId, topicId, (t) => ({ ...t, subTopics: [...t.subTopics, subTopic] }))
      setSubTopicPrompt(null)
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || err.message || 'Xato yuz berdi' })
    } finally {
      setSubTopicBusy(false)
    }
  }

  const saveLevel = async (level: CurriculumLevel, name: string) => {
    if (name.trim() === level.name || !name.trim()) return
    await updateLevel(level.id, name.trim(), level.note)
    patchLevels((ls) => ls.map((l) => (l.id === level.id ? { ...l, name: name.trim() } : l)))
  }

  const removeLevel = (level: CurriculumLevel) => setDeleteTarget({ kind: 'level', level })
  const removeTopic = (levelId: string, topic: CurriculumTopic) =>
    setDeleteTarget({ kind: 'topic', levelId, topic })
  const removeSubTopic = (levelId: string, topicId: string, subTopic: CurriculumSubTopic) =>
    setDeleteTarget({ kind: 'subtopic', levelId, topicId, subTopic })
  const removeItem = (levelId: string, topicId: string, subTopicId: string, item: CurriculumItem) =>
    setDeleteTarget({ kind: 'item', levelId, topicId, subTopicId, item })

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    try {
      if (deleteTarget.kind === 'level') {
        const { level } = deleteTarget
        await deleteLevel(level.id)
        patchLevels((ls) => ls.filter((l) => l.id !== level.id))
      } else if (deleteTarget.kind === 'topic') {
        const { levelId, topic } = deleteTarget
        await deleteTopic(topic.id)
        patchLevels((ls) =>
          ls.map((l) =>
            l.id === levelId ? { ...l, topics: l.topics.filter((t) => t.id !== topic.id) } : l,
          ),
        )
      } else if (deleteTarget.kind === 'subtopic') {
        const { levelId, topicId, subTopic } = deleteTarget
        await deleteSubTopic(subTopic.id)
        if (subTopic.items.some((it) => it.id === selectedId)) setSelectedId(null)
        patchTopic(levelId, topicId, (t) => ({
          ...t, subTopics: t.subTopics.filter((st) => st.id !== subTopic.id),
        }))
      } else {
        const { levelId, topicId, subTopicId, item } = deleteTarget
        await deleteItem(item.id)
        if (selectedId === item.id) setSelectedId(null)
        patchSubTopic(levelId, topicId, subTopicId, (st) => ({
          ...st, items: st.items.filter((it) => it.id !== item.id),
        }))
      }
      setDeleteTarget(null)
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || err.message || 'Xato yuz berdi' })
    } finally {
      setDeleteBusy(false)
    }
  }

  const doCopyLevel = async () => {
    if (!copyTarget || !copyingLevelId) return
    setIsCopying(true)
    try {
      const result = await copyLevelToSubject(copyingLevelId, copyTarget)
      setNotice({
        type: 'success',
        text: `"${copyingLevelName}" → "${subjects.find((s) => s.id === copyTarget)?.name}": ${result.topicCount} mavzu va ${result.itemCount} dars nusxalandi`,
      })
      setCopyingLevelId(null)
      setCopyingLevelName('')
      setCopyTarget('')
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || err.message || 'Xato yuz berdi' })
    } finally {
      setIsCopying(false)
    }
  }

  const saveTopic = async (levelId: string, topic: CurriculumTopic, title: string) => {
    if (title.trim() === topic.title || !title.trim()) return
    await updateTopic(topic.id, title.trim(), topic.note)
    patchTopic(levelId, topic.id, (t) => ({ ...t, title: title.trim() }))
  }

  const saveSubTopic = async (levelId: string, topicId: string, subTopic: CurriculumSubTopic, title: string) => {
    if (title.trim() === subTopic.title || !title.trim()) return
    await updateSubTopic(subTopic.id, title.trim(), subTopic.note)
    patchSubTopic(levelId, topicId, subTopic.id, (st) => ({ ...st, title: title.trim() }))
  }

  // Kontent saqlangach: butun dasturni qayta yuklab tree'ni yangilaymiz (type/meta/ready)
  const reloadCurriculum = async () => {
    const c = await getCurriculum(id)
    setData(c)
  }

  if (loading) {
    return (
      <Card>
        <Loader label="Yuklanmoqda..." />
      </Card>
    )
  }

  const courseName = data?.courseName ?? 'Kurs'
  const allItems = (data?.levels ?? []).flatMap((l) =>
    l.topics.flatMap((t) => t.subTopics.flatMap((st) => st.items)),
  )
  const totalItems = allItems.length
  const readyItems = allItems.filter((it) => it.ready).length

  return (
    <div>
      <PageHeader
        title={`${courseName} — o'quv dasturi`}
        sub={totalItems > 0 ? `${readyItems} / ${totalItems} dars tayyor` : "Bo'lim → mavzu → sub-mavzu → dars: o'quvchilar shu ro'yxat bo'yicha o'rganadi"}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel'dan yuklash
            </Button>
            <Button variant="secondary" onClick={() => navigate('/admin/subjects')}>
              <ArrowLeft className="h-4 w-4" /> Orqaga
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ===== CHAP: o'quv dasturi daraxti ===== */}
        <div className="lg:col-span-5">
          <Card tight className="overflow-hidden">
            {/* Panel sarlavhasi */}
            <div className="border-b border-slate-100 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight text-slate-800">O'quv dasturi</h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    {readyItems} / {totalItems} dars tayyor
                  </p>
                </div>
                <Button onClick={addLevel}>
                  <Plus className="h-4 w-4" /> Bo'lim
                </Button>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: totalItems > 0 ? `${(readyItems / totalItems) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Bo'limlar */}
            {!data || data.levels.length === 0 ? (
              <div className="state">
                <div className="state-icon">
                  <ListChecks className="h-5 w-5" />
                </div>
                <h4>Hali bo'lim kiritilmagan</h4>
                <p>Yuqoridagi "+ Bo'lim" tugmasi bilan boshlang.</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {data.levels.map((level, idx) => (
                  <ModuleBlock
                    key={level.id}
                    index={idx + 1}
                    level={level}
                    open={expanded.has(level.id)}
                    selectedId={selectedId}
                    onToggle={() => toggle(level.id)}
                    onSaveName={(name) => saveLevel(level, name)}
                    onDelete={() => removeLevel(level)}
                    onCopy={(levelId, levelName) => {
                      setCopyingLevelId(levelId)
                      setCopyingLevelName(levelName)
                      setCopyTarget('')
                    }}
                    onAddTopic={() => addTopic(level.id)}
                    onSaveTopic={(topic, title) => saveTopic(level.id, topic, title)}
                    onDeleteTopic={(topic) => removeTopic(level.id, topic)}
                    onAddSubTopic={(topicId) => addSubTopic(level.id, topicId)}
                    onSaveSubTopic={(topicId, subTopic, title) => saveSubTopic(level.id, topicId, subTopic, title)}
                    onDeleteSubTopic={(topicId, subTopic) => removeSubTopic(level.id, topicId, subTopic)}
                    onAddItem={(topicId, subTopicId, itemTypeLabel) =>
                      addItem(level.id, topicId, subTopicId, itemTypeLabel)}
                    onSelectItem={(itemId) => setSelectedId(itemId)}
                    onDeleteItem={(topicId, subTopicId, item) => removeItem(level.id, topicId, subTopicId, item)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ===== O'NG: tanlangan dars tahrirlovchi ===== */}
        <div className="lg:col-span-7">
          {selectedId ? (
            <LessonEditor
              key={selectedId}
              itemId={selectedId}
              onSaved={reloadCurriculum}
            />
          ) : (
            <Card>
              <div className="state">
                <div className="state-icon">
                  <FileText className="h-5 w-5" />
                </div>
                <h4>Dars tanlanmagan</h4>
                <p>Tahrirlash uchun chapdan dars tanlang.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ===== Copy modal ===== */}
      <Modal
        open={!!copyingLevelId}
        onClose={() => setCopyingLevelId(null)}
        size="sm"
        title={`"${copyingLevelName}" bo'limini nusxalash`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyingLevelId(null)} disabled={isCopying}>
              Bekor qilish
            </Button>
            <Button onClick={doCopyLevel} disabled={!copyTarget || isCopying}>
              {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Nusxalash
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs font-semibold text-slate-500">Maqsadli kursni tanlang:</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {subjects.length === 0 ? (
            <p className="text-xs text-slate-400">Mavjud kurslar yo'q</p>
          ) : (
            subjects.map((subj) => (
              <button
                key={subj.id}
                onClick={() => setCopyTarget(subj.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  copyTarget === subj.id
                    ? 'border-brand-400 bg-brand-50 font-medium text-brand-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {subj.name}
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* ===== Excel import modali ===== */}
      <ImportExcelModal
        open={importOpen}
        subjectId={id}
        onClose={() => setImportOpen(false)}
        onImported={async (r) => {
          await reloadCurriculum()
          if (r.errors.length === 0)
            setNotice({
              type: 'success',
              text: `Import yakunlandi: ${r.levels} bo'lim, ${r.topics} mavzu, ${r.items} dars qo'shildi`,
            })
        }}
      />

      {/* ===== Nom kiritish modali (bo'lim/mavzu/dars) ===== */}
      <NameModal
        open={!!namePrompt}
        meta={namePrompt ? namePromptMeta(namePrompt) : NAME_PROMPT_META.level}
        busy={nameBusy}
        onClose={() => setNamePrompt(null)}
        onSubmit={submitName}
      />

      {/* ===== Sub-mavzu yaratish modali (nom + tur birga — tur shu yerda qulflanadi) ===== */}
      <SubTopicModal
        open={!!subTopicPrompt}
        busy={subTopicBusy}
        onClose={() => setSubTopicPrompt(null)}
        onSubmit={submitSubTopic}
      />

      {/* ===== O'chirishni tasdiqlash modali ===== */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        busy={deleteBusy}
        title={
          deleteTarget?.kind === 'level'
            ? "Bo'limni o'chirish"
            : deleteTarget?.kind === 'topic'
              ? "Mavzuni o'chirish"
              : deleteTarget?.kind === 'subtopic'
                ? "Sub-mavzuni o'chirish"
                : "Darsni o'chirish"
        }
        message={
          deleteTarget?.kind === 'level' ? (
            <>
              <b>"{deleteTarget.level.name}"</b> bo'limi barcha mavzu va darslari bilan birga
              o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </>
          ) : deleteTarget?.kind === 'topic' ? (
            <>
              <b>"{deleteTarget.topic.title}"</b> mavzusi barcha sub-mavzu va darslari bilan birga
              o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </>
          ) : deleteTarget?.kind === 'subtopic' ? (
            <>
              <b>"{deleteTarget.subTopic.title}"</b> sub-mavzusi barcha darslari bilan birga
              o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </>
          ) : deleteTarget ? (
            <>
              <b>"{deleteTarget.item.text}"</b> darsi o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </>
          ) : null
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* ===== Bildirishnoma (toast) ===== */}
      {notice && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
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
    </div>
  )
}

// ============================ Excel import modali ============================

interface ImportExcelModalProps {
  open: boolean
  subjectId: string
  onClose: () => void
  onImported: (r: CurriculumExcelImportResult) => void
}

function ImportExcelModal({ open, subjectId, onClose, onImported }: ImportExcelModalProps) {
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
      const r = await importCurriculumExcel(subjectId, file, replace)
      setResult(r)
      onImported(r)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Xato yuz berdi')
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
        {/* 1-qadam: shablon */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">1. Shablonni yuklab oling</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Ustunlar: Bo'lim, Mavzu, Dars nomi, Izoh. Yo'riqnoma varag'ida namuna bor.
            </p>
          </div>
          <Button variant="secondary" onClick={downloadTemplate} disabled={downloading} className="flex-shrink-0">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Shablon
          </Button>
        </div>

        {/* 2-qadam: fayl tanlash */}
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

        {/* 3-qadam: rejim */}
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
              Belgilansa — eski bo'lim/mavzu/darslar (o'quvchilar progressi bilan) O'CHIRILIB, faqat
              fayldagi dastur qoladi. Belgilanmasa — fayldagi darslar mavjud dasturga qo'shiladi
              (bir xil nomli bo'lim/mavzu takrorlanmaydi).
            </span>
          </span>
        </label>

        {/* Xato */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Natija */}
        {result && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3',
              result.errors.length === 0
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50',
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span className={result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}>
                {result.levels} bo'lim, {result.topics} mavzu, {result.items} dars qo'shildi
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

// ============================ Nom kiritish modali ============================

interface NameModalProps {
  open: boolean
  meta: { title: string; label: string; placeholder: string; hint?: string }
  busy: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}

function NameModal({ open, meta, busy, onClose, onSubmit }: NameModalProps) {
  const [value, setValue] = useState('')
  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v || busy) return
    onSubmit(v)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={meta.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" form="curriculum-name-form" disabled={busy || !value.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Qo'shish
          </Button>
        </>
      }
    >
      <form id="curriculum-name-form" onSubmit={submit}>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500">{meta.label}</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={meta.placeholder}
          className={control}
        />
        {meta.hint && <p className="mt-2 text-xs leading-relaxed text-slate-400">{meta.hint}</p>}
      </form>
    </Modal>
  )
}

// ============================ Sub-mavzu yaratish modali (nom + tur) ============================

interface SubTopicModalProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onSubmit: (title: string, type: LessonType) => void
}

/** Sub-mavzu — nom VA tur birga tanlanadi. Tur bu yerda QULFLANADI: shu sub-mavzu ichida
 *  keyinchalik faqat SHU turdan (masalan bir nechta video) dars qo'shiladi. */
function SubTopicModal({ open, busy, onClose, onSubmit }: SubTopicModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<LessonType>('video')
  useEffect(() => {
    if (open) {
      setTitle('')
      setType('video')
    }
  }, [open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = title.trim()
    if (!v || busy) return
    onSubmit(v, type)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Yangi sub-mavzu"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" form="curriculum-subtopic-form" disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Qo'shish
          </Button>
        </>
      }
    >
      <form id="curriculum-subtopic-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Sub-mavzu nomi</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masalan: Qoidalar, Mustahkamlash..."
            className={control}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Turi <span className="font-normal text-slate-400">— yaratilgach o'zgarmaydi</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LESSON_TYPES.map((t) => {
              const TIcon = t.icon
              const on = type === t.type
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setType(t.type)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors',
                    on
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <TIcon className="h-4 w-4" /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          Ushbu sub-mavzu ichida FAQAT shu turdagi darslar (bir nechtasi bo'lishi mumkin) yaratiladi.
        </p>
      </form>
    </Modal>
  )
}

// ============================ O'chirishni tasdiqlash modali ============================

interface ConfirmDeleteModalProps {
  open: boolean
  title: string
  message: React.ReactNode
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

function ConfirmDeleteModal({ open, title, message, busy, onClose, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            O'chirish
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      </div>
    </Modal>
  )
}

// ============================ Bo'lim bloki ============================

interface ModuleBlockProps {
  index: number
  level: CurriculumLevel
  open: boolean
  selectedId: string | null
  onToggle: () => void
  onSaveName: (name: string) => void
  onDelete: () => void
  onCopy: (levelId: string, levelName: string) => void
  onAddTopic: () => void
  onSaveTopic: (topic: CurriculumTopic, title: string) => void
  onDeleteTopic: (topic: CurriculumTopic) => void
  onAddSubTopic: (topicId: string) => void
  onSaveSubTopic: (topicId: string, subTopic: CurriculumSubTopic, title: string) => void
  onDeleteSubTopic: (topicId: string, subTopic: CurriculumSubTopic) => void
  onAddItem: (topicId: string, subTopicId: string, itemTypeLabel: string) => void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (topicId: string, subTopicId: string, item: CurriculumItem) => void
}

function ModuleBlock({
  index, level, open, selectedId, onToggle, onSaveName, onDelete, onCopy,
  onAddTopic, onSaveTopic, onDeleteTopic,
  onAddSubTopic, onSaveSubTopic, onDeleteSubTopic, onAddItem, onSelectItem, onDeleteItem,
}: ModuleBlockProps) {
  const [name, setName] = useState(level.name)
  useEffect(() => setName(level.name), [level.name])

  const allItems = level.topics.flatMap((t) => t.subTopics.flatMap((st) => st.items))
  const total = allItems.length
  const ready = allItems.filter((it) => it.ready).length

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Bo'lim sarlavhasi */}
      <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-2.5">
        <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-300" />
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-600">
          {index}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onSaveName(name)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Bo'lim nomi"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <span className="flex-shrink-0 text-xs font-medium text-slate-400">
          {ready}/{total}
        </span>
        <button
          type="button"
          onClick={() => onCopy(level.id, level.name)}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
          title="Bo'limni nusxalash"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Bo'limni o'chirish"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          title={open ? 'Yopish' : 'Ochish'}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 p-2.5">
          {level.topics.length === 0 ? (
            <p className="px-1 text-xs text-slate-400">Mavzu yo'q.</p>
          ) : (
            level.topics.map((topic) => (
              <TopicBlock
                key={topic.id}
                topic={topic}
                selectedId={selectedId}
                onSaveTitle={(title) => onSaveTopic(topic, title)}
                onDelete={() => onDeleteTopic(topic)}
                onAddSubTopic={() => onAddSubTopic(topic.id)}
                onSaveSubTopic={(subTopic, title) => onSaveSubTopic(topic.id, subTopic, title)}
                onDeleteSubTopic={(subTopic) => onDeleteSubTopic(topic.id, subTopic)}
                onAddItem={(subTopicId, itemTypeLabel) => onAddItem(topic.id, subTopicId, itemTypeLabel)}
                onSelectItem={onSelectItem}
                onDeleteItem={(subTopicId, item) => onDeleteItem(topic.id, subTopicId, item)}
              />
            ))
          )}

          <button
            type="button"
            onClick={onAddTopic}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Mavzu
          </button>
        </div>
      )}
    </div>
  )
}

// ============================ Mavzu bloki ============================

interface TopicBlockProps {
  topic: CurriculumTopic
  selectedId: string | null
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onAddSubTopic: () => void
  onSaveSubTopic: (subTopic: CurriculumSubTopic, title: string) => void
  onDeleteSubTopic: (subTopic: CurriculumSubTopic) => void
  onAddItem: (subTopicId: string, itemTypeLabel: string) => void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (subTopicId: string, item: CurriculumItem) => void
}

function TopicBlock({
  topic, selectedId, onSaveTitle, onDelete,
  onAddSubTopic, onSaveSubTopic, onDeleteSubTopic, onAddItem, onSelectItem, onDeleteItem,
}: TopicBlockProps) {
  const [title, setTitle] = useState(topic.title)
  useEffect(() => setTitle(topic.title), [topic.title])

  return (
    <div>
      {/* Mavzu sarlavhasi */}
      <div className="flex items-center gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onSaveTitle(title)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Mavzu nomi"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Mavzuni o'chirish"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sub-mavzular */}
      <div className="mt-1.5 space-y-2 border-l border-slate-100 pl-2.5">
        {topic.subTopics.map((subTopic) => (
          <SubTopicBlock
            key={subTopic.id}
            subTopic={subTopic}
            selectedId={selectedId}
            onSaveTitle={(title) => onSaveSubTopic(subTopic, title)}
            onDelete={() => onDeleteSubTopic(subTopic)}
            onAddItem={(label) => onAddItem(subTopic.id, label)}
            onSelectItem={onSelectItem}
            onDeleteItem={(item) => onDeleteItem(subTopic.id, item)}
          />
        ))}

        <button
          type="button"
          onClick={onAddSubTopic}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> Sub-mavzu
        </button>
      </div>
    </div>
  )
}

// ============================ Sub-mavzu bloki ============================

interface SubTopicBlockProps {
  subTopic: CurriculumSubTopic
  selectedId: string | null
  onSaveTitle: (title: string) => void
  onDelete: () => void
  onAddItem: (itemTypeLabel: string) => void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (item: CurriculumItem) => void
}

function SubTopicBlock({
  subTopic, selectedId, onSaveTitle, onDelete, onAddItem, onSelectItem, onDeleteItem,
}: SubTopicBlockProps) {
  const [title, setTitle] = useState(subTopic.title)
  useEffect(() => setTitle(subTopic.title), [subTopic.title])
  const meta = typeMeta(subTopic.type)
  const TypeIcon = meta.icon

  return (
    <div className="rounded-lg bg-slate-50/60 p-1.5">
      {/* Sub-mavzu sarlavhasi — qulflangan turi belgi bilan ko'rsatiladi */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600"
          title={`Qulflangan tur: ${meta.label}`}
        >
          <TypeIcon className="h-3 w-3" /> {meta.label}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onSaveTitle(title)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Sub-mavzu nomi"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Sub-mavzuni o'chirish"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Darslar — hammasi sub-mavzuning qulflangan turida */}
      <div className="mt-1 space-y-1">
        {subTopic.items.map((item) => (
          <LessonRow
            key={item.id}
            item={item}
            active={selectedId === item.id}
            onSelect={() => onSelectItem(item.id)}
            onDelete={() => onDeleteItem(item)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAddItem(meta.label)}
        title={`Yana "${meta.label}" turida dars qo'shish`}
        className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        <Plus className="h-3 w-3" /> {meta.label} qo'shish
      </button>
    </div>
  )
}

// ============================ Dars qatori ============================

interface LessonRowProps {
  item: CurriculumItem
  active: boolean
  onSelect: () => void
  onDelete: () => void
}

function LessonRow({ item, active, onSelect, onDelete }: LessonRowProps) {
  const meta = typeMeta(item.type)
  const Icon = meta.icon

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
        active
          ? 'border-brand-300 bg-brand-50/60'
          : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800">{item.text}</div>
        <div className="truncate text-xs text-slate-400">
          {meta.label}
          {item.meta ? ` · ${item.meta}` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="flex-shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        title="Darsni o'chirish"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {/* Tayyor belgisi */}
      {item.ready ? (
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-slate-200" />
      )}
    </div>
  )
}

// ============================ Dars tahrirlovchi (o'ng panel) ============================

interface LessonEditorProps {
  itemId: string
  onSaved: () => void | Promise<void>
}

function LessonEditor({ itemId, onSaved }: LessonEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [detail, setDetail] = useState<CourseItemDetail | null>(null)

  // Tahrirlanadigan maydonlar
  const [text, setText] = useState('')
  const [type, setType] = useState<LessonType>('text')
  const [videoUrl, setVideoUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfName, setPdfName] = useState('')
  const [meta, setMeta] = useState('')
  const [vocab, setVocab] = useState<VocabEntry[]>([])
  const [questions, setQuestions] = useState<CourseQuestion[]>([])

  useEffect(() => {
    setLoading(true)
    getCourseItem(itemId)
      .then((d) => {
        setDetail(d)
        setText(d.text)
        setType(d.type)
        setVideoUrl(d.videoUrl)
        setAudioUrl(d.audioUrl)
        setTextContent(d.textContent)
        setPdfUrl(d.pdfUrl)
        setPdfName(d.pdfName)
        setMeta(d.meta)
        setVocab(d.vocab ?? [])
        setQuestions(d.questions ?? [])
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [itemId])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    try {
      const payload: SaveItemContent = {
        text: text.trim() || 'Dars',
        videoUrl,
        audioUrl,
        textContent,
        pdfUrl,
        pdfName,
        meta,
        vocab: vocab.filter((v) => v.term.trim() || v.meaning.trim()),
        questions: questions
          .filter((q) => q.text.trim())
          .map((q) => ({ ...q, options: q.options })),
      }
      await saveItemContent(itemId, payload)
      await onSaved()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <Loader label="Dars yuklanmoqda..." />
      </Card>
    )
  }
  if (!detail) {
    return (
      <Card>
        <div className="state">
          <h4>Dars topilmadi</h4>
        </div>
      </Card>
    )
  }

  const tMeta = typeMeta(type)

  return (
    <div className="space-y-4">
      {/* ===== Dars tafsilotlari ===== */}
      <Card
        title="Dars tafsilotlari"
        actions={
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
            <tMeta.icon className="h-3.5 w-3.5" /> {tMeta.label}
          </span>
        }
      >
        {/* Dars nomi */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Dars nomi</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dars nomi"
          className={control}
        />

        {/* Turga xos tahrirlovchi — tur YARATISHDA belgilangan (yuqoridagi belgi), bu yerda o'zgarmaydi. */}
        <div className="mt-4">
          {(type === 'video' || type === 'audio') && (
            <MediaEditor
              kind={type}
              url={type === 'video' ? videoUrl : audioUrl}
              onUrl={type === 'video' ? setVideoUrl : setAudioUrl}
              meta={meta}
              onMeta={setMeta}
            />
          )}

          {type === 'text' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Dars matni</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Dars matnini kiriting..."
                rows={10}
                className={cn(control, 'resize-y leading-relaxed')}
              />
            </div>
          )}

          {type === 'pdf' && (
            <PdfEditor
              url={pdfUrl}
              name={pdfName}
              onChange={(u, n) => {
                setPdfUrl(u)
                setPdfName(n)
              }}
            />
          )}

          {type === 'vocab' && (
            <VocabEditor vocab={vocab} onChange={setVocab} />
          )}
        </div>
      </Card>

      {/* ===== Test tuzuvchi ===== */}
      {type === 'test' && (
        <TestBuilder questions={questions} onChange={setQuestions} />
      )}

      {/* ===== Saqlash ===== */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Saqlandi
          </span>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Saqlash
        </Button>
      </div>
    </div>
  )
}

// ============================ Media (video/audio) tahrirlovchi ============================

interface MediaEditorProps {
  kind: 'video' | 'audio'
  url: string
  onUrl: (v: string) => void
  meta: string
  onMeta: (v: string) => void
}

function MediaEditor({ kind, url, onUrl, meta, onMeta }: MediaEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const isVideo = kind === 'video'

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAdminFile(file)
      onUrl(res.url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500">
          {isVideo ? 'Video havolasi' : 'Audio havolasi'}
        </label>
        <div className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder={isVideo ? 'YouTube yoki MP4 havolasi...' : 'Audio (MP3) havolasi...'}
            className={control}
          />
          <input
            ref={fileRef}
            type="file"
            accept={isVideo ? 'video/*' : 'audio/*'}
            onChange={onFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Yuklash
          </Button>
        </div>
        {url && (
          <p className="mt-1 truncate text-xs text-slate-400">{url}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Davomiyligi (meta)</label>
        <input
          value={meta}
          onChange={(e) => onMeta(e.target.value)}
          placeholder="masalan: 12 daq"
          className={cn(control, 'max-w-[200px]')}
        />
      </div>
    </div>
  )
}

// ============================ PDF tahrirlovchi ============================

interface PdfEditorProps {
  url: string
  name: string
  onChange: (url: string, name: string) => void
}

function PdfEditor({ url, name, onChange }: PdfEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Faqat PDF fayl yuklash mumkin')
      return
    }
    if (file.size > 20_000_000) {
      setError('Fayl 20 MB dan katta')
      return
    }
    setUploading(true)
    try {
      const res = await uploadAdminFile(file)
      onChange(res.url, file.name)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Yuklashda xato yuz berdi')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">PDF fayl</label>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={onFile}
        className="hidden"
      />

      {url ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <FileType className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{name || 'Fayl.pdf'}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              <ExternalLink className="h-3 w-3" /> Ochib ko'rish
            </a>
          </div>
          <Button
            variant="secondary"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Almashtirish
          </Button>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="PDF'ni olib tashlash"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm font-medium text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {uploading ? 'Yuklanmoqda...' : 'PDF fayl tanlash (maks. 20 MB)'}
        </button>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        O'quvchi darsda PDF'ni ichida ko'radi va yuklab olishi mumkin (masalan: qo'llanma,
        mashqlar to'plami, tarqatma material).
      </p>
    </div>
  )
}

// ============================ Lug'at tahrirlovchi ============================

interface VocabEditorProps {
  vocab: VocabEntry[]
  onChange: (v: VocabEntry[]) => void
}

function VocabEditor({ vocab, onChange }: VocabEditorProps) {
  const setRow = (i: number, patch: Partial<VocabEntry>) =>
    onChange(vocab.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  const addRow = () => onChange([...vocab, { term: '', meaning: '' }])
  const removeRow = (i: number) => onChange(vocab.filter((_, idx) => idx !== i))

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">So'zlar</label>
      <div className="space-y-2">
        {vocab.length === 0 && (
          <p className="text-xs text-slate-400">Hali so'z qo'shilmagan.</p>
        )}
        {vocab.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v.term}
              onChange={(e) => setRow(i, { term: e.target.value })}
              placeholder="So'z"
              className={control}
            />
            <input
              value={v.meaning}
              onChange={(e) => setRow(i, { meaning: e.target.value })}
              placeholder="Tarjima"
              className={control}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="O'chirish"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        <Plus className="h-3.5 w-3.5" /> So'z qo'shish
      </button>
    </div>
  )
}

// ============================ Test tuzuvchi ============================

interface TestBuilderProps {
  questions: CourseQuestion[]
  onChange: (q: CourseQuestion[]) => void
}

function TestBuilder({ questions, onChange }: TestBuilderProps) {
  const patchQ = (qid: string, patch: Partial<CourseQuestion>) =>
    onChange(questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)))

  const addQuestion = () =>
    onChange([
      ...questions,
      { id: genId(), text: '', options: ['', ''], correctIndex: 0 },
    ])

  const removeQuestion = (qid: string) => onChange(questions.filter((q) => q.id !== qid))

  const addOption = (q: CourseQuestion) => patchQ(q.id, { options: [...q.options, ''] })

  const setOption = (q: CourseQuestion, i: number, value: string) =>
    patchQ(q.id, { options: q.options.map((o, idx) => (idx === i ? value : o)) })

  const removeOption = (q: CourseQuestion, i: number) => {
    if (q.options.length <= 2) return
    const options = q.options.filter((_, idx) => idx !== i)
    let correctIndex = q.correctIndex
    if (i === correctIndex) correctIndex = 0
    else if (i < correctIndex) correctIndex -= 1
    patchQ(q.id, { options, correctIndex })
  }

  return (
    <Card
      title="Test tuzuvchi"
      sub="Savollar va variantlar o'quvchiga TASODIFIY tartibda chiqadi. Audio bo'limi ham to'ldirilgan bo'lsa — test o'quvchiga audio bilan birga ('Audio test' — tinglab ishlash) ko'rinadi."
      actions={
        <Button variant="secondary" type="button" onClick={addQuestion}>
          <Plus className="h-4 w-4" /> Savol
        </Button>
      }
    >
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400">Hali savol qo'shilmagan.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {qi + 1}-savol
                </span>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Savolni o'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <input
                value={q.text}
                onChange={(e) => patchQ(q.id, { text: e.target.value })}
                placeholder="Savol matni..."
                className={cn(control, 'font-medium')}
              />

              <div className="mt-2 space-y-2">
                {q.options.map((opt, oi) => {
                  const correct = q.correctIndex === oi
                  return (
                    <div
                      key={oi}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors',
                        correct ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => patchQ(q.id, { correctIndex: oi })}
                        title="To'g'ri javob"
                        className={cn(
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          correct
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 text-transparent hover:border-emerald-400',
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <input
                        value={opt}
                        onChange={(e) => setOption(q, oi, e.target.value)}
                        placeholder={`Variant ${oi + 1}`}
                        className={cn(
                          'min-w-0 flex-1 bg-transparent text-sm outline-none',
                          correct ? 'font-semibold text-emerald-800' : 'text-slate-700',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(q, oi)}
                        disabled={q.options.length <= 2}
                        className="flex-shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                        title="Variantni o'chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => addOption(q)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                <Plus className="h-3.5 w-3.5" /> variant
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
