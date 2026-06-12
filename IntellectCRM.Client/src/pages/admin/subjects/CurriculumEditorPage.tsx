import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronRight, ChevronDown, ListChecks, BookOpen, GripVertical,
} from 'lucide-react'
import type { Curriculum, CurriculumLevel, CurriculumTopic, CurriculumItem } from '@/types'
import {
  getCurriculum,
  createLevel, updateLevel, deleteLevel,
  createTopic, updateTopic, deleteTopic,
  createItem, updateItem, deleteItem,
} from '@/api/services/curriculum'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

const control =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400'

export function CurriculumEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Curriculum | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newLevel, setNewLevel] = useState('')
  const [addingLevel, setAddingLevel] = useState(false)

  useEffect(() => {
    getCurriculum(id)
      .then((c) => {
        setData(c)
        // Birinchi darajani ochiq qoldiramiz
        if (c.levels.length > 0) setExpanded(new Set([c.levels[0].id]))
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
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

  // ---- Daraja ----
  const addLevel = async () => {
    const name = newLevel.trim()
    if (!name || addingLevel) return
    setAddingLevel(true)
    try {
      const { id: lid } = await createLevel(id, name)
      const level: CurriculumLevel = { id: lid, name, note: '', order: 0, topics: [] }
      patchLevels((ls) => [...ls, level])
      setExpanded((s) => new Set(s).add(lid))
      setNewLevel('')
    } finally {
      setAddingLevel(false)
    }
  }

  const saveLevel = async (level: CurriculumLevel, name: string, note: string) => {
    if (name.trim() === level.name && note === level.note) return
    if (!name.trim()) return
    await updateLevel(level.id, name.trim(), note)
    patchLevels((ls) =>
      ls.map((l) => (l.id === level.id ? { ...l, name: name.trim(), note } : l)),
    )
  }

  const removeLevel = async (level: CurriculumLevel) => {
    if (!confirm(`"${level.name}" darajasini (barcha mavzu va bandlari bilan) o'chirasizmi?`)) return
    await deleteLevel(level.id)
    patchLevels((ls) => ls.filter((l) => l.id !== level.id))
  }

  // ---- Mavzu ----
  const addTopic = async (levelId: string, title: string) => {
    const t = title.trim()
    if (!t) return
    const { id: tid } = await createTopic(levelId, t)
    const topic: CurriculumTopic = { id: tid, title: t, note: '', order: 0, items: [] }
    patchLevels((ls) =>
      ls.map((l) => (l.id === levelId ? { ...l, topics: [...l.topics, topic] } : l)),
    )
  }

  const saveTopic = async (levelId: string, topic: CurriculumTopic, title: string, note: string) => {
    if (title.trim() === topic.title && note === topic.note) return
    if (!title.trim()) return
    await updateTopic(topic.id, title.trim(), note)
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? { ...l, topics: l.topics.map((t) => (t.id === topic.id ? { ...t, title: title.trim(), note } : t)) }
          : l,
      ),
    )
  }

  const removeTopic = async (levelId: string, topic: CurriculumTopic) => {
    if (!confirm(`"${topic.title}" mavzusini (barcha bandlari bilan) o'chirasizmi?`)) return
    await deleteTopic(topic.id)
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId ? { ...l, topics: l.topics.filter((t) => t.id !== topic.id) } : l,
      ),
    )
  }

  // ---- Band ----
  const addItem = async (levelId: string, topicId: string, text: string) => {
    const t = text.trim()
    if (!t) return
    const { id: iid } = await createItem(topicId, t)
    const item: CurriculumItem = { id: iid, text: t, note: '', order: 0 }
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
  }

  const saveItem = async (
    levelId: string, topicId: string, item: CurriculumItem, text: string,
  ) => {
    if (text.trim() === item.text) return
    if (!text.trim()) return
    await updateItem(item.id, text.trim())
    patchLevels((ls) =>
      ls.map((l) =>
        l.id === levelId
          ? {
              ...l,
              topics: l.topics.map((tp) =>
                tp.id === topicId
                  ? { ...tp, items: tp.items.map((it) => (it.id === item.id ? { ...it, text: text.trim() } : it)) }
                  : tp,
              ),
            }
          : l,
      ),
    )
  }

  const removeItem = async (levelId: string, topicId: string, item: CurriculumItem) => {
    await deleteItem(item.id)
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

  if (loading) {
    return (
      <Card>
        <Loader label="Yuklanmoqda..." />
      </Card>
    )
  }

  const courseName = data?.courseName ?? 'Kurs'

  return (
    <div>
      <PageHeader
        title={`${courseName} — o'quv dasturi`}
        sub="Daraja → mavzu → band: o'quvchilar shu ro'yxat bo'yicha o'rganadi"
        actions={
          <Button variant="secondary" onClick={() => navigate('/admin/subjects')}>
            <ArrowLeft className="h-4 w-4" /> Kurslar
          </Button>
        }
      />

      {!data || data.levels.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <ListChecks className="h-5 w-5" />
            </div>
            <h4>Hali o'quv dasturi kiritilmagan</h4>
            <p>Daraja qo'shing yoki Excel'dan import qiling.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.levels.map((level) => (
            <LevelBlock
              key={level.id}
              level={level}
              open={expanded.has(level.id)}
              onToggle={() => toggle(level.id)}
              onSave={(name, note) => saveLevel(level, name, note)}
              onDelete={() => removeLevel(level)}
              onAddTopic={(title) => addTopic(level.id, title)}
              onSaveTopic={(topic, title, note) => saveTopic(level.id, topic, title, note)}
              onDeleteTopic={(topic) => removeTopic(level.id, topic)}
              onAddItem={(topicId, text) => addItem(level.id, topicId, text)}
              onSaveItem={(topicId, item, text) => saveItem(level.id, topicId, item, text)}
              onDeleteItem={(topicId, item) => removeItem(level.id, topicId, item)}
            />
          ))}
        </div>
      )}

      {/* Daraja qo'shish */}
      <div className="mt-4 flex items-center gap-2">
        <input
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLevel()}
          placeholder="Yangi daraja nomi (masalan: Beginner, A1, 1-bosqich)..."
          className={cn(control, 'max-w-md flex-1')}
        />
        <Button onClick={addLevel} disabled={addingLevel || !newLevel.trim()}>
          <Plus className="h-4 w-4" /> Daraja qo'shish
        </Button>
      </div>
    </div>
  )
}

// ============================ Daraja bloki ============================

interface LevelBlockProps {
  level: CurriculumLevel
  open: boolean
  onToggle: () => void
  onSave: (name: string, note: string) => void
  onDelete: () => void
  onAddTopic: (title: string) => void
  onSaveTopic: (topic: CurriculumTopic, title: string, note: string) => void
  onDeleteTopic: (topic: CurriculumTopic) => void
  onAddItem: (topicId: string, text: string) => void
  onSaveItem: (topicId: string, item: CurriculumItem, text: string) => void
  onDeleteItem: (topicId: string, item: CurriculumItem) => void
}

function LevelBlock({
  level, open, onToggle, onSave, onDelete,
  onAddTopic, onSaveTopic, onDeleteTopic, onAddItem, onSaveItem, onDeleteItem,
}: LevelBlockProps) {
  const [name, setName] = useState(level.name)
  const [note, setNote] = useState(level.note)
  const [newTopic, setNewTopic] = useState('')

  useEffect(() => setName(level.name), [level.name])
  useEffect(() => setNote(level.note), [level.note])

  const topicCount = level.topics.length
  const itemCount = level.topics.reduce((sum, t) => sum + t.items.length, 0)

  const submitTopic = () => {
    if (!newTopic.trim()) return
    onAddTopic(newTopic)
    setNewTopic('')
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-1)]">
      {/* Daraja sarlavhasi */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          title={open ? 'Yopish' : 'Ochish'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <BookOpen className="h-4 w-4" />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onSave(name, note)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Daraja nomi"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <span className="hidden flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-block">
          {topicCount} mavzu · {itemCount} band
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Darajani o'chirish"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 p-3">
          {/* Daraja izohi */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onSave(name, note)}
            placeholder="Daraja izohi (ixtiyoriy)..."
            className={cn(control, 'w-full text-xs text-slate-500')}
          />

          {/* Mavzular */}
          {level.topics.length === 0 ? (
            <p className="px-1 text-xs text-slate-400">Mavzu yo'q — quyida qo'shing.</p>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {level.topics.map((topic) => (
                <TopicBlock
                  key={topic.id}
                  topic={topic}
                  onSave={(title, n) => onSaveTopic(topic, title, n)}
                  onDelete={() => onDeleteTopic(topic)}
                  onAddItem={(text) => onAddItem(topic.id, text)}
                  onSaveItem={(item, text) => onSaveItem(topic.id, item, text)}
                  onDeleteItem={(item) => onDeleteItem(topic.id, item)}
                />
              ))}
            </div>
          )}

          {/* Mavzu qo'shish */}
          <div className="flex items-center gap-2">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTopic()}
              placeholder="+ mavzu qo'shish..."
              className={cn(control, 'flex-1')}
            />
            <Button variant="secondary" onClick={submitTopic} disabled={!newTopic.trim()}>
              <Plus className="h-4 w-4" /> Mavzu
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================ Mavzu bloki ============================

interface TopicBlockProps {
  topic: CurriculumTopic
  onSave: (title: string, note: string) => void
  onDelete: () => void
  onAddItem: (text: string) => void
  onSaveItem: (item: CurriculumItem, text: string) => void
  onDeleteItem: (item: CurriculumItem) => void
}

function TopicBlock({ topic, onSave, onDelete, onAddItem, onSaveItem, onDeleteItem }: TopicBlockProps) {
  const [title, setTitle] = useState(topic.title)
  const [note, setNote] = useState(topic.note)
  const [newItem, setNewItem] = useState('')

  useEffect(() => setTitle(topic.title), [topic.title])
  useEffect(() => setNote(topic.note), [topic.note])

  const submitItem = () => {
    if (!newItem.trim()) return
    onAddItem(newItem)
    setNewItem('')
  }

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-1)]">
      {/* Mavzu sarlavhasi */}
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onSave(title, note)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Mavzu nomi"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
        <span className="hidden flex-shrink-0 text-xs text-slate-400 sm:inline">{topic.items.length} band</span>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Mavzuni o'chirish"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onSave(title, note)}
        placeholder="Mavzu izohi (ixtiyoriy)..."
        className="mt-1.5 w-full rounded-lg border border-transparent bg-transparent px-2.5 py-1 text-xs text-slate-500 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white"
      />

      {/* Bandlar */}
      {topic.items.length > 0 && (
        <div className="mt-2 space-y-1">
          {topic.items.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
              <input
                key={item.id}
                defaultValue={item.text}
                onBlur={(e) => onSaveItem(item, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder="Band matni"
                className="min-w-0 flex-1 rounded-md border border-transparent bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-200 focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => onDeleteItem(item)}
                className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Bandni o'chirish"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Band qo'shish */}
      <div className="mt-2 flex items-center gap-1.5 pl-5">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitItem()}
          placeholder="+ band qo'shish..."
          className="min-w-0 flex-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition-colors focus:border-brand-400"
        />
        <button
          type="button"
          onClick={submitItem}
          disabled={!newItem.trim()}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
