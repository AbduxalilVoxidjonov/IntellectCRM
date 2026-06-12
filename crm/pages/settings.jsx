// Sozlamalar — settings with sub-routes
const { motion: mS } = window.framerMotion;

const SettingsRow = ({ label, hint, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, padding: "16px 0", borderBottom: "1px solid var(--border-2)" }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange?.(!checked)}
    style={{
      width: 36, height: 20, border: 0, padding: 0,
      borderRadius: 999, cursor: "pointer",
      background: checked ? "var(--primary)" : "var(--border)",
      position: "relative", transition: "background .15s ease",
    }}
  >
    <span style={{
      position: "absolute", top: 2, left: checked ? 18 : 2,
      width: 16, height: 16, borderRadius: "50%", background: "#fff",
      transition: "left .15s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    }}/>
  </button>
);

const GeneralSettings = () => {
  const [orgName, setOrgName] = useState("Intellect Education Center");
  const [tz, setTz] = useState("Asia/Tashkent");
  return (
    <Card title="Umumiy" sub="Tashkilot va asosiy sozlamalar">
      <SettingsRow label="Tashkilot nomi" hint="Bu nom hisobotlar va kvitansiyalarda chiqadi.">
        <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={{ maxWidth: 360 }}/>
      </SettingsRow>
      <SettingsRow label="Vaqt zonasi" hint="Davomat va jadval bu zonada ko'rsatiladi.">
        <select className="select" value={tz} onChange={(e) => setTz(e.target.value)} style={{ maxWidth: 360 }}>
          <option>Asia/Tashkent</option><option>Asia/Almaty</option><option>Europe/Moscow</option><option>Asia/Dubai</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Til" hint="CRM interfeysi tili.">
        <div className="row">
          <button className="filter-chip active">O'zbek</button>
          <button className="filter-chip">Русский</button>
          <button className="filter-chip">English</button>
        </div>
      </SettingsRow>
      <SettingsRow label="Valyuta" hint="Barcha summalar shu valyutada ko'rsatiladi.">
        <select className="select" style={{ maxWidth: 200 }}><option>UZS — so'm</option><option>USD</option><option>RUB</option></select>
      </SettingsRow>
      <SettingsRow label="Logo">
        <div className="row">
          <div style={{ width: 56, height: 56, borderRadius: 10, background: "linear-gradient(135deg, var(--primary), oklch(0.58 0.2 310))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>IC</div>
          <Button variant="secondary" size="sm" icon="download">Logo yuklash</Button>
        </div>
      </SettingsRow>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, gap: 8 }}>
        <Button variant="ghost">Bekor qilish</Button>
        <Button variant="primary" icon="check">O'zgarishlarni saqlash</Button>
      </div>
    </Card>
  );
};

const USERS = [
  { name: "Akmal Karimov", email: "akmal@intellect.uz", role: "Owner", status: "Active" },
  { name: "Madina Saidova", email: "madina@intellect.uz", role: "Admin", status: "Active" },
  { name: "Bekzod Tursunov", email: "bekzod@intellect.uz", role: "Manager", status: "Active" },
  { name: "Nigora Iskandarova", email: "nigora@intellect.uz", role: "Teacher", status: "Active" },
  { name: "Sardor Hakimov", email: "sardor@intellect.uz", role: "Teacher", status: "Invited" },
  { name: "Aziza Olimova", email: "aziza@intellect.uz", role: "Manager", status: "Active" },
];

const UsersSettings = () => (
  <Card title="Foydalanuvchilar" sub={`${USERS.length} ta xodim CRM ga ulangan`}
    actions={<Button variant="primary" icon="plus" size="sm">Yangi foydalanuvchi</Button>} tight
  >
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Foydalanuvchi</th><th>Email</th><th>Rol</th><th>Status</th><th>Oxirgi kirish</th><th></th></tr></thead>
        <tbody>
          {USERS.map(u => (
            <tr key={u.email}>
              <td>
                <div className="cell-user">
                  <div className="avatar" style={{ background: window.MockData.avatarColor(u.name) }}>{window.MockData.initials(u.name)}</div>
                  <div className="meta"><strong>{u.name}</strong></div>
                </div>
              </td>
              <td><span className="mono" style={{ fontSize: 12 }}>{u.email}</span></td>
              <td><Badge tone={u.role === "Owner" ? "violet" : u.role === "Admin" ? "blue" : "green"}>{u.role}</Badge></td>
              <td><Badge tone={u.status === "Active" ? "green" : "amber"} dot>{u.status}</Badge></td>
              <td><span style={{ fontSize: 12, color: "var(--muted)" }}>2 soat oldin</span></td>
              <td><button className="icon-btn" style={{ width: 28, height: 28 }}><Icon name="more" size={13}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ROLES = [
  { name: "Owner", users: 1, perms: ["Hammasi"], color: "violet" },
  { name: "Admin", users: 2, perms: ["Talabalar", "Lidlar", "Moliya", "Hisobotlar", "Sozlamalar"], color: "blue" },
  { name: "Manager", users: 3, perms: ["Talabalar", "Lidlar", "Davomat"], color: "green" },
  { name: "Teacher", users: 12, perms: ["Davomat", "O'z guruhlari"], color: "amber" },
  { name: "Accountant", users: 2, perms: ["Moliya", "Tranzaksiyalar", "Hisobotlar"], color: "info" },
];

const RolesSettings = () => (
  <Card title="Rollar va ruxsatlar" sub="Kim nimaga ruxsat olganini boshqaring"
    actions={<Button variant="primary" icon="plus" size="sm">Yangi rol</Button>}
  >
    <div className="entity-grid">
      {ROLES.map(r => (
        <div key={r.name} className="entity-card">
          <div className="ec-head">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <Icon name="user" size={18}/>
            </div>
            <div style={{ flex: 1 }}>
              <div className="ec-name">{r.name}</div>
              <div className="ec-meta">{r.users} ta foydalanuvchi</div>
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>RUXSATLAR</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.perms.map(p => <Badge key={p} tone={r.color}>{p}</Badge>)}
            </div>
          </div>
          <div className="ec-foot">
            <Button variant="secondary" size="sm" icon="edit">Tahrirlash</Button>
            <Button variant="secondary" size="sm" icon="users">Foydalanuvchilar</Button>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const INTEGRATIONS = [
  { name: "Telegram Bot", desc: "Talabalarga avtomatik bildirishnoma", icon: "📨", connected: true },
  { name: "Payme", desc: "Onlayn to'lovlarni qabul qilish", icon: "💳", connected: true },
  { name: "Click", desc: "Onlayn to'lov gateway", icon: "🟢", connected: true },
  { name: "Eskiz.uz", desc: "SMS yuborish xizmati", icon: "📱", connected: false },
  { name: "Google Calendar", desc: "Jadval sinxronizatsiyasi", icon: "📅", connected: false },
  { name: "Instagram DM", desc: "Lidlar avtomatik yig'ish", icon: "📷", connected: true },
  { name: "Zoom", desc: "Online darslar uchun", icon: "🎥", connected: false },
  { name: "1C Buxgalteriya", desc: "Buxgalteriya eksport", icon: "📊", connected: false },
];

const IntegrationsSettings = () => (
  <Card title="Integratsiyalar" sub={`${INTEGRATIONS.filter(i => i.connected).length} ta faol integratsiya`}>
    <div className="entity-grid">
      {INTEGRATIONS.map(it => (
        <div key={it.name} className="entity-card">
          <div className="ec-head">
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--bg-2)", fontSize: 24, display: "grid", placeItems: "center" }}>{it.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="ec-name">{it.name}</div>
              <div className="ec-meta">{it.desc}</div>
            </div>
            {it.connected && <Badge tone="green" dot>Ulangan</Badge>}
          </div>
          <Button variant={it.connected ? "secondary" : "primary"} size="sm" style={{ width: "100%", justifyContent: "center" }}>
            {it.connected ? "Boshqarish" : "Ulash"}
          </Button>
        </div>
      ))}
    </div>
  </Card>
);

const NotificationsSettings = () => {
  const [prefs, setPrefs] = useState({
    newLead: true, payment: true, debt: true, attendance: false, trial: true, weekly: true, daily: false,
  });
  const items = [
    { k: "newLead", label: "Yangi lid keldi", hint: "Yangi lid yaratilganda email va Telegram bilan xabar olasiz." },
    { k: "payment", label: "Yangi to'lov", hint: "Talaba to'lov qilganda darhol xabar." },
    { k: "debt", label: "Qarz ogohlantirishi", hint: "Talaba 7 kundan ortiq qarzdor bo'lsa." },
    { k: "attendance", label: "Past davomat", hint: "Bir hafta ichida 3+ marta yo'q kelganda." },
    { k: "trial", label: "Trial dars uchrashuvi", hint: "Trial dars 1 soat oldin eslatma." },
    { k: "weekly", label: "Haftalik xulosa", hint: "Har dushanba ertalab haftalik hisobot." },
    { k: "daily", label: "Kunlik sintez", hint: "Har kuni ertalab oldingi kun bo'yicha xulosa." },
  ];
  return (
    <Card title="Bildirishnomalar" sub="Qachon va qanday xabar olishni tanlang">
      {items.map(it => (
        <SettingsRow key={it.k} label={it.label} hint={it.hint}>
          <div className="spread">
            <div className="row">
              <Toggle checked={prefs[it.k]} onChange={(v) => setPrefs(p => ({ ...p, [it.k]: v }))}/>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{prefs[it.k] ? "Yoqilgan" : "O'chirilgan"}</span>
            </div>
            <div className="row">
              <Badge tone={prefs[it.k] ? "violet" : ""}>Email</Badge>
              <Badge tone={prefs[it.k] ? "blue" : ""}>Telegram</Badge>
            </div>
          </div>
        </SettingsRow>
      ))}
    </Card>
  );
};

const BillingSettings = () => (
  <>
    <div className="grid grid-2" style={{ marginBottom: 16 }}>
      <Card title="Joriy tarif" sub="Sizning obunangiz">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ padding: 16, background: "var(--primary-soft)", borderRadius: 12, flex: 1 }}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase" }}>Tarif</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>Business Pro</div>
            <div className="mono" style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>2 400 000 so'm / oy</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12 }}>Keyingi to'lov</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>2026-06-01</div>
            <Button variant="secondary" size="sm" icon="refresh" style={{ marginTop: 8 }}>Tarifni o'zgartirish</Button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11 }}>Talabalar limit</div>
            <div className="mono" style={{ fontWeight: 600 }}>487 / 1000</div>
          </div>
          <div style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11 }}>Foydalanuvchilar</div>
            <div className="mono" style={{ fontWeight: 600 }}>6 / 20</div>
          </div>
          <div style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11 }}>SMS qoldi</div>
            <div className="mono" style={{ fontWeight: 600 }}>4 280</div>
          </div>
        </div>
      </Card>
      <Card title="To'lov usuli" sub="Asosiy karta">
        <div style={{ padding: 18, borderRadius: 12, background: "linear-gradient(135deg, var(--fg) 0%, oklch(0.3 0.03 270) 100%)", color: "#fff" }}>
          <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: ".08em" }}>UZCARD · BUSINESS</div>
          <div className="mono" style={{ fontSize: 18, marginTop: 18, letterSpacing: ".1em" }}>•••• •••• •••• 4582</div>
          <div className="spread" style={{ marginTop: 16, fontSize: 11.5, opacity: 0.8 }}>
            <span>AKMAL KARIMOV</span>
            <span>08/28</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon="edit" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
          Karta o'zgartirish
        </Button>
      </Card>
    </div>

    <Card title="To'lov tarixi" tight>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Sana</th><th>Tavsif</th><th>Davr</th><th>Status</th><th className="num">Summa</th><th></th></tr></thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>2026-{String(5-i).padStart(2,"0")}-01</td>
                <td><strong style={{ fontSize: 13 }}>Business Pro</strong></td>
                <td><span style={{ fontSize: 12.5 }}>1 oy</span></td>
                <td><Badge tone="green" dot>To'langan</Badge></td>
                <td className="num" style={{ fontWeight: 600 }}>2 400 000</td>
                <td><button className="btn btn-ghost btn-sm">PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </>
);

const SettingsPage = ({ sub }) => {
  const view = sub || "general";
  const items = [
    { id: "general", label: "Umumiy", icon: "settings" },
    { id: "users", label: "Foydalanuvchilar", icon: "users" },
    { id: "roles", label: "Rollar", icon: "flag" },
    { id: "integrations", label: "Integratsiyalar", icon: "spark" },
    { id: "notifications", label: "Bildirishnomalar", icon: "bell" },
    { id: "billing", label: "Hisob va to'lov", icon: "money" },
  ];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Sozlamalar</h2>
          <p className="page-sub">Tashkilotingiz konfiguratsiyasi va shaxsiy sozlamalar.</p>
        </div>
      </div>
      <SubNav items={items} current={view} onChange={(id) => window.__setRoute(`settings/${id}`)}/>
      <mS.div key={view}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {view === "general" && <GeneralSettings/>}
        {view === "users" && <UsersSettings/>}
        {view === "roles" && <RolesSettings/>}
        {view === "integrations" && <IntegrationsSettings/>}
        {view === "notifications" && <NotificationsSettings/>}
        {view === "billing" && <BillingSettings/>}
      </mS.div>
    </div>
  );
};

window.SettingsPage = SettingsPage;
