import { useEffect, useState } from 'react'
import { Plus, Eye, Pencil, Trash2, Users } from 'lucide-react'
import type { Staff, Credentials, StaffRoleTemplate } from '@/types'
import {
  getStaff,
  getAdmins,
  getStaffRoleTemplates,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffCredentials,
  resetStaffPassword,
  setStaffPermissions,
  type CreateStaffWithTemplatePayload,
} from '@/api/services/staff'
import { adminPermissions } from '@/config/constants'
import { useAuth } from '@/context/auth-context'
import { toggleSectionAction, sectionActions, type PermAction } from '@/lib/permissions'
import { PermMatrix } from '@/components/staff/PermMatrix'
import { cn, randomPassword } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader } from '@/components/ui/Loader'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { CredentialsBox } from '@/components/ui/CredentialsBox'
import { ReasonPromptModal } from '@/components/ui/ReasonPromptModal'

const POSITIONS = ['Kassir', 'Administrator', "Direktor o'rinbosari", 'Qorovul', 'Hisobchi']

// Avatar uchun ism harflari (faqat ko'rinish uchun)
const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6']
const avatarColor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function StaffPage() {
  const { user } = useAuth()
  // Rollar (ruxsatlar)ni faqat tizim egasi (superadmin) o'zgartira oladi — backend ham shuni talab qiladi.
  const canManageRoles = user?.role === 'superadmin'

  const [staff, setStaff] = useState<Staff[]>([])
  const [templates, setTemplates] = useState<StaffRoleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form, setForm] = useState<CreateStaffWithTemplatePayload>({ fullName: '', position: '' })
  // Rol shabloni (ixtiyoriy — matritsani oldindan to'ldiradi) + yangi xodim ruxsat matritsasi.
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [createPerms, setCreatePerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Har bir xodim uchun tahrirlanayotgan ruxsatlar (id → kalitlar to'plami)
  const [draft, setDraft] = useState<Record<string, Set<string>>>({})
  const [savingPermsId, setSavingPermsId] = useState<string | null>(null)

  // Login/parol oynasi
  const [credOf, setCredOf] = useState<Staff | null>(null)
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [credLoading, setCredLoading] = useState(false)
  const [deleting, setDeleting] = useState<Staff | null>(null)

  // Adminlar (role="admin") — faqat superadmin ko'radi/tahrirlaydi. Bo'sh ruxsat = cheklovsiz.
  const [admins, setAdmins] = useState<Staff[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminDraft, setAdminDraft] = useState<Record<string, Set<string>>>({})
  const [savingAdminPermsId, setSavingAdminPermsId] = useState<string | null>(null)

  const syncDraft = (list: Staff[]) =>
    setDraft(Object.fromEntries(list.map((s) => [s.id, new Set(s.permissions)])))

  const syncAdminDraft = (list: Staff[]) =>
    setAdminDraft(Object.fromEntries(list.map((s) => [s.id, new Set(s.permissions)])))

  useEffect(() => {
    getStaff()
      .then((list) => {
        setStaff(list)
        syncDraft(list)
      })
      .finally(() => setLoading(false))
    // Shablonlar — ixtiyoriy; yuklanmasa xodim ro'yxati buzilmaydi.
    getStaffRoleTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    if (!canManageRoles) return
    setAdminsLoading(true)
    getAdmins()
      .then((list) => {
        setAdmins(list)
        syncAdminDraft(list)
      })
      .catch(() => setAdmins([]))
      .finally(() => setAdminsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageRoles])

  const toggleAdminAction = (adminId: string, section: string, action: PermAction) =>
    setAdminDraft((d) => ({
      ...d,
      [adminId]: toggleSectionAction(d[adminId] ?? new Set<string>(), section, action),
    }))

  const adminDirty = (a: Staff) => {
    const cur = adminDraft[a.id] ?? new Set()
    return cur.size !== a.permissions.length || a.permissions.some((p) => !cur.has(p))
  }

  const saveAdminPerms = (a: Staff) => {
    const perms = [...(adminDraft[a.id] ?? new Set())]
    setSavingAdminPermsId(a.id)
    setStaffPermissions(a.id, perms)
      .then((u) => setAdmins((p) => p.map((x) => (x.id === u.id ? u : x))))
      .catch((e) => alert(e?.response?.data?.message ?? "Ruxsatlarni saqlab bo'lmadi"))
      .finally(() => setSavingAdminPermsId(null))
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ fullName: '', position: '', phone: '' })
    setSelectedTemplate(null)
    setCreatePerms(new Set())
    setFormOpen(true)
  }

  // Rol shabloni tanlanganda — matritsani shablonning default ruxsatlaridan to'ldiramiz (keyin qo'lda o'zgartirish mumkin).
  const applyTemplate = (code: string | null) => {
    setSelectedTemplate(code)
    if (code) {
      const t = templates.find((x) => x.code === code)
      if (t) setCreatePerms(new Set(t.defaultPermissions))
    }
  }
  const openEdit = (s: Staff) => {
    setEditing(s)
    setForm({ fullName: s.fullName, position: s.position, phone: s.phone ?? '' })
    setFormOpen(true)
  }

  const showCredentials = (s: Staff) => {
    setCredOf(s)
    setCreds(null)
    setCredLoading(true)
    getStaffCredentials(s.id)
      .then(setCreds)
      .finally(() => setCredLoading(false))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const u = await updateStaff(editing.id, form)
        setStaff((p) => p.map((x) => (x.id === u.id ? u : x)))
        setFormOpen(false)
      } else {
        // Ruxsatlar to'g'ridan-to'g'ri matritsadan (shablon faqat oldindan to'ldirish uchun edi).
        const payload: CreateStaffWithTemplatePayload = {
          ...form,
          extraPermissions: createPerms.size > 0 ? [...createPerms] : undefined,
        }
        const created = await createStaff(payload)
        setStaff((p) => [created, ...p])
        setDraft((d) => ({ ...d, [created.id]: new Set(created.permissions) }))
        setFormOpen(false)
        showCredentials(created)
      }
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (s: Staff) => setDeleting(s)

  const doDelete = (reasonId?: string) => {
    const s = deleting
    if (!s) return
    deleteStaff(s.id, reasonId)
      .then(() => {
        setStaff((p) => p.filter((x) => x.id !== s.id))
        setDraft((d) => {
          const { [s.id]: _, ...rest } = d
          return rest
        })
        setDeleting(null)
      })
      .catch((e) => alert(e?.response?.data?.message ?? "O'chirib bo'lmadi"))
  }

  const toggleAction = (staffId: string, section: string, action: PermAction) =>
    setDraft((d) => ({
      ...d,
      [staffId]: toggleSectionAction(d[staffId] ?? new Set<string>(), section, action),
    }))

  const dirty = (s: Staff) => {
    const cur = draft[s.id] ?? new Set()
    return cur.size !== s.permissions.length || s.permissions.some((p) => !cur.has(p))
  }

  const savePerms = (s: Staff) => {
    const perms = [...(draft[s.id] ?? new Set())]
    setSavingPermsId(s.id)
    setStaffPermissions(s.id, perms)
      .then((u) => setStaff((p) => p.map((x) => (x.id === u.id ? u : x))))
      .catch((e) => alert(e?.response?.data?.message ?? "Ruxsatlarni saqlab bo'lmadi"))
      .finally(() => setSavingPermsId(null))
  }

  return (
    <div>
      <PageHeader
        title="Xodimlar va rollar"
        sub={
          <>
            O'qituvchi bo'lmagan ishchilar (kassir, administrator, ...)
            {canManageRoles
              ? " — har biriga kerakli bo'limlarni (rollarni) shu yerda belgilang."
              : "."}
          </>
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Yangi xodim
          </Button>
        }
      />

      {canManageRoles && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Adminlar</h3>
          <p className="mb-3 text-xs text-slate-400">
            Adminlar standart holatda <b>cheklovsiz</b> (barcha bo'limlarga to'liq kirish). Bu yerda
            aynan qaysi bo'lim(lar)ga ruxsat berilishini belgilasangiz — o'sha admin ENDI FAQAT
            belgilangan bo'lim(lar)ga kira oladi. Barcha katakchalarni bo'shatib saqlasangiz —
            yana cheklovsiz holatga qaytadi.
          </p>
          {adminsLoading ? (
            <Card>
              <Loader label="Yuklanmoqda..." />
            </Card>
          ) : admins.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-400">Admin akkauntlari topilmadi.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {admins.map((a) => {
                const cur = adminDraft[a.id] ?? new Set<string>()
                const restricted = a.permissions.length > 0
                return (
                  <Card key={a.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div className="cell-user">
                        <div className="avatar h-10 w-10 text-sm" style={{ background: avatarColor(a.fullName) }}>
                          {initialsOf(a.fullName)}
                        </div>
                        <div className="meta">
                          <strong className="text-slate-800">{a.fullName}</strong>
                          <span className="text-slate-400">
                            {a.position || 'Admin'} · <code className="font-mono">{a.login}</code>
                          </span>
                        </div>
                      </div>
                      <Badge tone={restricted ? 'violet' : 'green'}>
                        {restricted ? 'Cheklangan' : "To'liq kirish"}
                      </Badge>
                    </div>
                    <PermMatrix perms={cur} onToggle={(section, action) => toggleAdminAction(a.id, section, action)} />
                    <div className="mt-3 flex justify-end">
                      <Button
                        onClick={() => saveAdminPerms(a)}
                        disabled={!adminDirty(a) || savingAdminPermsId === a.id}
                      >
                        {savingAdminPermsId === a.id ? 'Saqlanmoqda...' : 'Ruxsatlarni saqlash'}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold text-slate-700">Xodimlar</h3>
      {loading ? (
        <Card>
          <Loader label="Yuklanmoqda..." />
        </Card>
      ) : staff.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state-icon">
              <Users className="h-6 w-6" />
            </div>
            <h4>Hali xodim qo'shilmagan</h4>
            <p>"Yangi xodim" tugmasi orqali qo'shing.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {staff.map((s) => {
            const cur = draft[s.id] ?? new Set<string>()
            return (
              <Card key={s.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="cell-user">
                    <div className="avatar h-10 w-10 text-sm" style={{ background: avatarColor(s.fullName) }}>
                      {initialsOf(s.fullName)}
                    </div>
                    <div className="meta">
                      <strong className="text-slate-800">{s.fullName}</strong>
                      <span className="text-slate-400">
                        {s.position || 'Xodim'} · <code className="font-mono">{s.login}</code>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconBtn icon={Eye} title="Login/parol" onClick={() => showCredentials(s)} />
                    <IconBtn icon={Pencil} title="Tahrirlash" onClick={() => openEdit(s)} />
                    <IconBtn icon={Trash2} title="O'chirish" danger onClick={() => handleDelete(s)} />
                  </div>
                </div>

                {canManageRoles ? (
                  <>
                    <p className="mb-2 text-xs text-slate-400">
                      Har bo'lim uchun ruxsat: <b>Ko'rish</b> (ochadi), <b>Qo'shish</b>, <b>Tahrir</b>,
                      <b> O'chirish</b>. Ko'rishsiz bo'lim yashiriladi; yozish uchun ko'rish avtomatik yoqiladi.
                    </p>
                    <PermMatrix perms={cur} onToggle={(section, action) => toggleAction(s.id, section, action)} />
                    <div className="mt-3 flex justify-end">
                      <Button
                        onClick={() => savePerms(s)}
                        disabled={!dirty(s) || savingPermsId === s.id}
                      >
                        {savingPermsId === s.id ? 'Saqlanmoqda...' : 'Ruxsatlarni saqlash'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {s.permissions.length === 0 ? (
                      <span className="text-xs text-slate-400">Ruxsatlar belgilanmagan</span>
                    ) : (
                      adminPermissions
                        .filter((p) => sectionActions(new Set(s.permissions), p.key).size > 0)
                        .map((p) => {
                          const acts = sectionActions(new Set(s.permissions), p.key)
                          const full = acts.size === 4
                          return (
                            <Badge key={p.key} tone="violet">
                              {p.label}
                              {!full && (
                                <span className="ml-1 opacity-70">
                                  ({[...acts].length} amal)
                                </span>
                              )}
                            </Badge>
                          )
                        })
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Yaratish / tahrirlash */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Xodimni tahrirlash' : 'Yangi xodim'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="staff-form" disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="F.I.SH"
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Lavozim</label>
            <input
              list="staff-positions"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="Masalan: Kassir"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <datalist id="staff-positions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <PhoneInput
            label="Telefon"
            value={form.phone ?? ''}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
          />
          {editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Parolni almashtirish</label>
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  autoComplete="new-password"
                  placeholder="Bo'sh qoldirilsa — parol o'zgarmaydi"
                  value={form.newPassword ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForm((f) => ({ ...f, newPassword: randomPassword() }))}
                >
                  Generatsiya
                </Button>
              </div>
            </div>
          )}
          {!editing && canManageRoles && (
            <div className="space-y-4">
              {/* Rol shabloni — tanlansa matritsani oldindan to'ldiradi (keyin qo'lda o'zgartirish mumkin). */}
              {templates.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    Rol shabloni (ixtiyoriy)
                  </label>
                  <div className="space-y-2">
                    <select
                      value={selectedTemplate ?? ''}
                      onChange={(e) => applyTemplate(e.target.value || null)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">— Tanlang yoki qo'lda belgilang —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.code}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {selectedTemplate && (
                      <p className="text-xs text-slate-500">
                        {templates.find((t) => t.code === selectedTemplate)?.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ruxsatlar matritsasi — har bo'lim uchun amallar */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Ruxsatlar (har bo'lim uchun amallar)
                </label>
                <PermMatrix
                  perms={createPerms}
                  onToggle={(section, action) =>
                    setCreatePerms((s) => toggleSectionAction(s, section, action))
                  }
                />
              </div>
            </div>
          )}
          {!editing && (
            <p className="text-xs text-slate-400">
              Saqlangach tizimga kirish uchun login va parol avtomatik yaratiladi va ko'rsatiladi.
              {canManageRoles
                ? " Ruxsatlarni keyinroq ham har bir xodim kartasidan o'zgartirishingiz mumkin."
                : " Ruxsatlarni (bo'limlarni) tizim egasi belgilaydi."}
            </p>
          )}
        </form>
      </Modal>

      {/* Login/parol */}
      <Modal
        open={!!credOf}
        onClose={() => setCredOf(null)}
        title={credOf ? `${credOf.fullName} — akkaunt` : 'Akkaunt'}
        footer={
          <Button variant="secondary" onClick={() => setCredOf(null)}>
            Yopish
          </Button>
        }
      >
        <CredentialsBox
          credentials={creds}
          loading={credLoading}
          onReset={
            credOf
              ? async () => {
                  const c = await resetStaffPassword(credOf.id)
                  setCreds(c)
                }
              : undefined
          }
        />
      </Modal>

      <ReasonPromptModal
        open={!!deleting}
        category="staff_delete"
        title="Xodimni o'chirish"
        message={deleting ? `"${deleting.fullName}" xodimni o'chirasizmi? Akkaunti ham o'chadi.` : undefined}
        confirmLabel="O'chirish"
        tone="red"
        onConfirm={doDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function IconBtn({
  icon: Icon,
  title,
  onClick,
  danger,
}: {
  icon: typeof Eye
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        danger
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
