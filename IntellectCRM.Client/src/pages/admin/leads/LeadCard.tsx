import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Phone } from 'lucide-react'
import type { Lead } from '@/types'
import { genderLabels } from '@/config/constants'
import { Badge } from '@/components/ui/Badge'
import { formatDate, cn } from '@/lib/utils'

/** Ism-sharifdan bosh harflar (avatar uchun) */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Ismdan barqaror avatar fon rangi */
const AVATAR_BG = [
  'oklch(0.7 0.12 30)',
  'oklch(0.65 0.14 350)',
  'oklch(0.6 0.18 282)',
  'oklch(0.62 0.14 158)',
  'oklch(0.65 0.13 230)',
  'oklch(0.72 0.14 70)',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length]
}

/** Faqat ko'rinish (drag overlay uchun ham ishlatiladi) */
export function LeadCardContent({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const phone = lead.phone || lead.fatherPhone || lead.motherPhone || ''
  const meta = lead.interestSubject || genderLabels[lead.gender]

  return (
    <div className={cn('lead-card', dragging && 'dragging')}>
      <div className="lead-top">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="avatar h-7 w-7 shrink-0 text-[11px]"
            style={{ background: avatarColor(lead.fullName) }}
          >
            {initials(lead.fullName)}
          </span>
          <div className="min-w-0">
            <div className="lead-name truncate">{lead.fullName}</div>
            <div className="lead-meta truncate">{meta}</div>
          </div>
        </div>
      </div>

      <div className="lead-tags">
        <Badge tone="violet">{genderLabels[lead.gender]}</Badge>
        {lead.source && <Badge tone="blue">{lead.source}</Badge>}
        {lead.convertedStudentId && <Badge tone="green">Aylantirilgan</Badge>}
      </div>

      <div className="lead-foot">
        <span className="flex min-w-0 items-center gap-1.5">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono">{phone || '—'}</span>
        </span>
        {lead.birthDate && (
          <span className="lead-value">{formatDate(lead.birthDate)}</span>
        )}
      </div>
    </div>
  )
}

/** Sudraladigan (draggable) kartochka */
export function LeadCard({ lead, onClick }: { lead: Lead; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <LeadCardContent lead={lead} />
    </div>
  )
}
