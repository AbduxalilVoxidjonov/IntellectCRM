import { useEffect, useState } from 'react'
import { ArrowLeft, Briefcase, MessageSquare, ChevronRight } from 'lucide-react'
import { getTeacherChatClasses, getTeacherChat, sendTeacherChat } from '@/api/services/teacher'
import { STAFF_CHANNEL, STAFF_CHANNEL_LABEL } from '@/config/constants'
import { useUnread } from '@/context/unread-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { cn } from '@/lib/utils'
import { ChatPanel } from '@/components/chat/ChatPanel'

/**
 * O'qituvchi xabarlari — MOBIL oqim: kanal ro'yxati → bosilsa to'liq-ekran suhbat
 * (orqaga tugma bilan). Admin 2-ustun grid'i mobilda yaroqsiz edi.
 */
export function TeacherMessagesPage() {
  const { unreadChannels } = useUnread()
  const [classes, setClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // null = ro'yxat ko'rinishi; aks holda — tanlangan kanal suhbati
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    getTeacherChatClasses()
      .then((cs) => setClasses(cs.filter((c) => c !== STAFF_CHANNEL)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ---- Suhbat ko'rinishi ----
  if (selected) {
    const isStaff = selected === STAFF_CHANNEL
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kanallar
        </button>
        <ChatPanel
          key={selected}
          className={selected}
          fetchMessages={getTeacherChat}
          sendMessage={sendTeacherChat}
          title={isStaff ? STAFF_CHANNEL_LABEL : `${selected} — guruh chati`}
          subtitle={isStaff ? "Barcha o'qituvchilar va adminlar" : undefined}
        />
      </div>
    )
  }

  // ---- Kanallar ro'yxati ----
  return (
    <div className="space-y-4">
      <PageHeader title="Xabarlar" sub="Guruh va xodimlar chati" />

      {loading ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="space-y-2">
          {/* Xodimlar kanali — har bir o'qituvchiga ochiq */}
          <ChannelRow
            icon={Briefcase}
            name={STAFF_CHANNEL_LABEL}
            hint="Barcha o'qituvchilar va adminlar"
            unread={unreadChannels.has(STAFF_CHANNEL)}
            staff
            onClick={() => setSelected(STAFF_CHANNEL)}
          />

          {classes.map((c) => (
            <ChannelRow
              key={c}
              icon={MessageSquare}
              name={c}
              hint="Guruh chati"
              unread={unreadChannels.has(c)}
              onClick={() => setSelected(c)}
            />
          ))}

          {classes.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Sizga biriktirilgan guruh yo'q.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ChannelRow({
  icon: Icon,
  name,
  hint,
  unread,
  staff,
  onClick,
}: {
  icon: typeof MessageSquare
  name: string
  hint: string
  unread: boolean
  staff?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-[var(--shadow-1)] transition-colors hover:border-brand-300 hover:bg-brand-50/40 active:bg-brand-50"
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white',
          staff
            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
            : 'bg-gradient-to-br from-brand-500 to-brand-700',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold tracking-tight text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-400">{hint}</p>
      </div>
      {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
    </button>
  )
}
