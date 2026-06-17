import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, ListChecks, Check,
  Video, FileText, Music, BookOpen, ClipboardCheck, Upload, Loader2, GripVertical, Copy, X,
} from 'lucide-react'
import type {
  Curriculum, CurriculumLevel, CurriculumTopic, CurriculumItem, LessonType, Subject,
} from '@/types'
import {
  getCurriculum,
  createLevel, updateLevel, deleteLevel,
  createTopic, updateTopic, deleteTopic,
  createItem, deleteItem,
  getCourseItem, saveItemContent,
  copyLevelToSubject,
} from '@/api/services/curriculum'
import type { CourseItemDetail, VocabEntry, CourseQuestion, SaveItemContent } from '@/api/services/curriculum'
import { uploadAdminFile } from '@/api/services/students'
import { getSubjects } from '@/api/services/admin'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
  { type: 'vocab', label: "Lug'at", icon: BookOpen },
  { type: 'test', label: 'Test', icon: ClipboardCheck },
]

function typeMeta(type: LessonType) {
  return LESSON_TYPES.find((t) => t.type === type) ?? LESSON_TYPES[1]
}

function genId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
  const [addingLevel, setAddingLevel] = useState(false)

  // Copy modal state
  const [copyingLevelId, setCopyingLevelId] = useState<string | null>(null)
  const [copyingLevelName, setCopyingLevelName] = useState<string>('')
  const [copyTarget, setCopyTarget] = useState<string>('')
  const [isCopying, setIsCopying] = useState(false)

  useEffect(() => {
    Promise.all([
      getCurriculum(id)
        .then((c) => {
          setData(c)
          if (c.levels.length > 0) setExpanded(new Set([c.levels[0].id]))
        })
        .catch(() => setData(null)),
      getSubjects()
        .then((s) => setSubjects(s.filter((subj) => subj.id !== id)))
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

  // ---- Modul (daraja) ----
  const addLevel = async () => {
    if (addingLevel) return
    const name = prompt("Yangi modul nomi (masalan: Beginner, A1, 1-modul):")?.trim()
    if (!name) return
    setAddingLevel(true)
    try {
      const { id: lid } = await createLevel(id, name)
      const level: CurriculumLevel = { id: lid, name, note: '', order: 0, topics: [] }
      patchLevels((ls) => [...ls, level])
      setExpanded((s) => new Set(s).add(lid))
    } finally {
      setAddingLevel(false)
    }
  }

  const saveLevel = async (level: CurriculumLevel, name: string) => {
    if (name.trim() === level.name || !name.trim()) return
    await updateLevel(level.id, name.trim(), level.note)
    patchLevels((ls) => ls.map((l) => (l.id === level.id ? { ...l, name: name.trim() } : l)))
  }

  const removeLevel = async (level: CurriculumLevel) => {
    if (!confirm(`"${level.name}" modulini (barcha mavzu va darslari bilan) o'chirasizmi?`)) return
    await deleteLevel(level.id)
    patchLevels((ls) => ls.filter((l) => l.id !== level.id))
  }

  const doCopyLevel = async () => {
    if (!copyTarget || !copyingLevelId) return
    setIsCopying(true)
    try {
      const result = await copyLevelToSubject(copyingLevelId, copyTarget)
      alert(`✓ "${copyingLevelName}" → "${subjects.find((s) => s.id === copyTarget)?.name}": ${result.topicCount} mavzu va ${result.itemCount} dars nusxalandi!`)
      setCopyingLevelId(null)
      setCopyingLevelName('')
      setCopyTarget('')
    } catch (err: any) {
      alert(`Xato: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsCopying(false)
    }
  }

  // ---- Mavzu ----
  const addTopic = async (levelId: string) => {
    const title = prompt("Yangi mavzu nomi:")?.trim()
    if (!title) return
    const { id: tid } = await createTopic(levelId, title)
    const topic: CurriculumTopic = { id: tid, title, note: '', order: 0, items: [] }
    patchLevels((ls) =>
      ls.map((l) => (l.id === levelId ? { ...l, topics: [...l.topics, topic] } : l)),
    )
  }

  const saveTopic = async (levelId: string, topic: CurriculumTopic, title: string) => {
    if (title.trim() === topic.title || !title.trim()) return
    await updateTopic(topic.id, title.trim(), topic.note)
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? { ...l, topics: l.topics.map((t) => (t.id === topic.id ? { ...t, title: title.trim() } : t)) }
          : l,
      ),
    )
  }

  const removeTopic = async (levelId: string, topic: CurriculumTopic) => {
    if (!confirm(`"${topic.title}" mavzusini (barcha darslari bilan) o'chirasizmi?`)) return
    await deleteTopic(topic.id)
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId ? { ...l, topics: l.topics.filter((t) => t.id !== topic.id) } : l,
      ),
    )
  }

  // ---- Dars (band) ----
  const addItem = async (levelId: string, topicId: string) => {
    const text = prompt("Yangi dars nomi:")?.trim()
    if (!text) return
    const { id: iid } = await createItem(topicId, text)
    const item: CurriculumItem = {
      id: iid, text, note: '', order: 0, type: 'text', meta: '', ready: false,
    }
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? {
              ...l,
              topics: l.topics.map((tp) =>
                tp.id === topicId ? { ...tp, items: [...tp.items, item] } : tp,
              ),
            }
          : l,
      ),
    )
    setSelectedId(iid)
  }

  const removeItem = async (levelId: string, topicId: string, item: CurriculumItem) => {
    if (!confirm(`"${item.text}" darsini o'chirasizmi?`)) return
    await deleteItem(item.id)
    if (selectedId === item.id) setSelectedId(null)
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? {
              ...l,
              topics: l.topics.map((tp) =>
                tp.id === topicId ? { ...tp, items: tp.items.filter((it) => it.id !== item.id) } : tp,
              ),
            }
          : l,
      ),
    )
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
  const allItems = (data?.levels ?? []).flatMap((l) => l.topics.flatMap((t) => t.items))
  const totalItems = allItems.length
  const readyItems = allItems.filter((it) => it.ready).length

  return (
    <div>
      <PageHeader
        title={`${courseName} — o'quv dasturi`}
        sub={totalItems > 0 ? `${readyItems} / ${totalItems} dars tayyor` : "Modul → mavzu → dars: o'quvchilar shu ro'yxat bo'yicha o'rganadi"}
        actions={
          <Button variant="secondary" onClick={() => navigate('/admin/subjects')}>
            <ArrowLeft className="h-4 w-4" /> Orqaga
          </Button>
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
                <Button onClick={addLevel} disabled={addingLevel}>
                  <Plus className="h-4 w-4" /> Modul
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

            {/* Modullar */}
            {!data || data.levels.length === 0 ? (
              <div className="state">
                <div className="state-icon">
                  <ListChecks className="h-5 w-5" />
                </div>
                <h4>Hali modul kiritilmagan</h4>
                <p>Yuqoridagi "+ Modul" tugmasi bilan boshlang.</p>
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
                    onAddItem={(topicId) => addItem(level.id, topicId)}
                    onSelectItem={(itemId) => setSelectedId(itemId)}
                    onDeleteItem={(topicId, item) => removeItem(level.id, topicId, item)}
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
      {copyingLevelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">"{copyingLevelName}" modulini nusxalash</h3>
                <p className="text-xs text-slate-500">Maqsadli kursni tanlang:</p>
              </div>
              <button
                onClick={() => setCopyingLevelId(null)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
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

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setCopyingLevelId(null)}
                disabled={isCopying}
              >
                Bekor qilish
              </Button>
              <Button
                onClick={doCopyLevel}
                disabled={!copyTarget || isCopying}
              >
                {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Nusxalash
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ============================ Modul bloki ============================

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
  onAddItem: (topicId: string) => void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (topicId: string, item: CurriculumItem) => void
}

function ModuleBlock({
  index, level, open, selectedId, onToggle, onSaveName, onDelete, onCopy,
  onAddTopic, onSaveTopic, onDeleteTopic, onAddItem, onSelectItem, onDeleteItem,
}: ModuleBlockProps) {
  const [name, setName] = useState(level.name)
  useEffect(() => setName(level.name), [level.name])

  const allItems = level.topics.flatMap((t) => t.items)
  const total = allItems.length
  const ready = allItems.filter((it) => it.ready).length

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Modul sarlavhasi */}
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
          placeholder="Modul nomi"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <span className="flex-shrink-0 text-xs font-medium text-slate-400">
          {ready}/{total}
        </span>
        <button
          type="button"
          onClick={() => onCopy(level.id, level.name)}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
          title="Modulni nusxalash"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Modulni o'chirish"
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
                onAddItem={() => onAddItem(topic.id)}
                onSelectItem={onSelectItem}
                onDeleteItem={(item) => onDeleteItem(topic.id, item)}
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
  onAddItem: () => void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (item: CurriculumItem) => void
}

function TopicBlock({
  topic, selectedId, onSaveTitle, onDelete, onAddItem, onSelectItem, onDeleteItem,
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

      {/* Darslar */}
      <div className="mt-1 space-y-1">
        {topic.items.map((item) => (
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
        onClick={onAddItem}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        <Plus className="h-3.5 w-3.5" /> Dars qo'shish
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
        type,
        videoUrl,
        audioUrl,
        textContent,
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

        {/* Bo'limlar — bir nechtasini to'ldirsa bo'ladi (o'quvchi ketma-ket ko'radi) */}
        <label className="mb-1.5 mt-4 block text-xs font-semibold text-slate-500">
          Dars bo'limlari <span className="font-normal text-slate-400">— bir nechtasini to'ldiring (yashil = to'ldirilgan)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LESSON_TYPES.map((t) => {
            const TIcon = t.icon
            const on = type === t.type
            const filled =
              t.type === 'video' ? !!videoUrl
              : t.type === 'audio' ? !!audioUrl
              : t.type === 'text' ? !!textContent.trim()
              : t.type === 'vocab' ? vocab.some((v) => v.term.trim() || v.meaning.trim())
              : t.type === 'test' ? questions.some((q) => q.text.trim()) : false
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setType(t.type)}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors',
                  on
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <TIcon className="h-4 w-4" /> {t.label}
                {filled && <span className="ml-0.5 h-2 w-2 rounded-full bg-emerald-500" title="To'ldirilgan" />}
              </button>
            )
          })}
        </div>

        {/* Turga xos tahrirlovchi */}
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
      sub="Interaktiv savol-javob"
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
