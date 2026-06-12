import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileText, Video } from 'lucide-react'
import type { LmsMaterial, LmsTopic } from '@/types'
import type { SaveTopicPayload } from '@/api/services/lms'
import { uploadLmsMaterial } from '@/api/services/lms'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  editing?: LmsTopic
  saving: boolean
  onClose: () => void
  onSave: (payload: SaveTopicPayload) => void
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const VIDEO_HINT = "YouTube, Vimeo, Google Drive yoki to'g'ridan-to'g'ri video URL"

export function LmsTopicModal({ open, editing, saving, onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [materials, setMaterials] = useState<LmsMaterial[]>([])
  const [uploading, setUploading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDescription(editing?.description ?? '')
      setVideoUrl(editing?.videoUrl ?? '')
      setTextContent(editing?.textContent ?? '')
      setMaterials(editing?.materials ?? [])
    }
  }, [open, editing])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploads = await Promise.all(Array.from(files).map((f) => uploadLmsMaterial(f)))
      setMaterials((prev) => [...prev, ...uploads])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeMaterial = (id: string) =>
    setMaterials((prev) => prev.filter((m) => m.id !== id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      videoUrl: videoUrl.trim(),
      textContent: textContent.trim(),
      materials,
    })
  }

  const fileIcon = (ct: string) => {
    if (ct.startsWith('video/')) return <Video className="h-4 w-4 text-brand-600" />
    return <FileText className="h-4 w-4 text-slate-400" />
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Mavzuni tahrirlash' : "Yangi mavzu qo'shish"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="lms-topic-form" disabled={saving || uploading || !title.trim()}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </>
      }
    >
      <form id="lms-topic-form" onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Mavzu sarlavhasi"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: Kvadrat tenglamalar"
        />

        <Textarea
          label="Qisqacha ta'rif"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bu mavzuda nima o'rganiladi..."
        />

        {/* Video URL */}
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Video className="h-4 w-4 text-brand-600" />
            Video havolasi
          </span>
          <Input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="mt-1 text-xs text-slate-400">{VIDEO_HINT}</p>
        </div>

        {/* Matn mazmuni */}
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <FileText className="h-4 w-4 text-slate-400" />
            Matn mazmuni
            <span className="ml-1 text-xs font-normal text-slate-400">(video bo'lmasa yoki qo'shimcha izoh)</span>
          </span>
          <Textarea
            rows={5}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Dars mazmunini shu yerga yozing..."
            className="leading-relaxed"
          />
        </div>

        {/* Materiallar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-600">Materiallar (fayllar)</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50',
                uploading && 'opacity-50',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Yuklanmoqda...' : 'Fayl yuklash'}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {materials.length > 0 ? (
            <div className="space-y-1.5">
              {materials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {fileIcon(m.contentType)}
                    <span className="truncate text-sm text-slate-700">{m.name}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">{humanSize(m.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMaterial(m.id)}
                    className="shrink-0 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
              Fayl yuklash uchun yuqoridagi tugmani bosing
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
