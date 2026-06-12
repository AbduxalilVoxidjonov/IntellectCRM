// App shell - sidebar + topbar with nested navigation
const { motion: m1, AnimatePresence: AP1 } = window.framerMotion;

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "leads", label: "Lidlar", icon: "kanban", badge: 26 },
  { id: "students", label: "Talabalar", icon: "students", badge: 87 },
  { id: "groups", label: "Guruhlar", icon: "users", badge: 18 },
  { id: "teachers", label: "O'qituvchilar", icon: "user", badge: 12 },
  { id: "finance", label: "Moliya", icon: "finance", children: [
    { id: "finance/transactions", label: "Tranzaksiyalar" },
    { id: "finance/revenue", label: "Daromadlar" },
    { id: "finance/expenses", label: "Xarajatlar" },
    { id: "finance/profit", label: "Foyda" },
    { id: "finance/debts", label: "Qarzdorlar" },
  ]},
  { id: "reports", label: "Hisobotlar", icon: "file", children: [
    { id: "reports/revenue", label: "Daromad hisoboti" },
    { id: "reports/students", label: "Talabalar hisoboti" },
    { id: "reports/attendance", label: "Davomat hisoboti" },
    { id: "reports/teachers", label: "O'qituvchilar hisoboti" },
    { id: "reports/leads", label: "Lidlar hisoboti" },
  ]},
  { id: "settings", label: "Sozlamalar", icon: "settings", children: [
    { id: "settings/general", label: "Umumiy" },
    { id: "settings/users", label: "Foydalanuvchilar" },
    { id: "settings/roles", label: "Rollar va ruxsatlar" },
    { id: "settings/integrations", label: "Integratsiyalar" },
    { id: "settings/notifications", label: "Bildirishnomalar" },
    { id: "settings/billing", label: "Hisob va to'lov" },
  ]},
  { id: "archive", label: "Arxiv", icon: "trash", children: [
    { id: "archive/students", label: "Arxiv talabalar" },
    { id: "archive/leads", label: "Arxiv lidlar" },
    { id: "archive/groups", label: "Arxiv guruhlar" },
    { id: "archive/deleted", label: "O'chirilganlar" },
  ]},
];

const PAGE_META = {
  "dashboard": { title: "Dashboard", crumb: "Boshqaruv paneli" },
  "leads": { title: "Lidlar", crumb: "CRM · Sotuv pipeline" },
  "students": { title: "Talabalar", crumb: "Odamlar · Faol ro'yxat" },
  "groups": { title: "Guruhlar", crumb: "O'quv guruhlari" },
  "teachers": { title: "O'qituvchilar", crumb: "Xodimlar · Pedagoglar" },

  "finance": { title: "Moliya", crumb: "Moliya · Umumiy" },
  "finance/transactions": { title: "Tranzaksiyalar", crumb: "Moliya · Tranzaksiyalar" },
  "finance/revenue": { title: "Daromadlar", crumb: "Moliya · Daromadlar" },
  "finance/expenses": { title: "Xarajatlar", crumb: "Moliya · Xarajatlar" },
  "finance/profit": { title: "Foyda", crumb: "Moliya · Foyda tahlili" },
  "finance/debts": { title: "Qarzdorlar", crumb: "Moliya · Qarzdorlar" },

  "reports": { title: "Hisobotlar", crumb: "Analitika · Hisobotlar" },
  "reports/revenue": { title: "Daromad hisoboti", crumb: "Hisobotlar · Daromad" },
  "reports/students": { title: "Talabalar hisoboti", crumb: "Hisobotlar · Talabalar" },
  "reports/attendance": { title: "Davomat hisoboti", crumb: "Hisobotlar · Davomat" },
  "reports/teachers": { title: "O'qituvchilar hisoboti", crumb: "Hisobotlar · O'qituvchilar" },
  "reports/leads": { title: "Lidlar hisoboti", crumb: "Hisobotlar · Lidlar" },

  "settings": { title: "Sozlamalar", crumb: "Sozlamalar" },
  "settings/general": { title: "Umumiy sozlamalar", crumb: "Sozlamalar · Umumiy" },
  "settings/users": { title: "Foydalanuvchilar", crumb: "Sozlamalar · Foydalanuvchilar" },
  "settings/roles": { title: "Rollar va ruxsatlar", crumb: "Sozlamalar · Rollar" },
  "settings/integrations": { title: "Integratsiyalar", crumb: "Sozlamalar · Integratsiyalar" },
  "settings/notifications": { title: "Bildirishnomalar", crumb: "Sozlamalar · Bildirishnomalar" },
  "settings/billing": { title: "Hisob va to'lov", crumb: "Sozlamalar · Billing" },

  "archive": { title: "Arxiv", crumb: "Arxiv · Umumiy" },
  "archive/students": { title: "Arxiv talabalar", crumb: "Arxiv · Talabalar" },
  "archive/leads": { title: "Arxiv lidlar", crumb: "Arxiv · Lidlar" },
  "archive/groups": { title: "Arxiv guruhlar", crumb: "Arxiv · Guruhlar" },
  "archive/deleted": { title: "O'chirilganlar", crumb: "Arxiv · O'chirilgan elementlar" },
};

const Sidebar = ({ current, onNav }) => {
  const parentOfCurrent = current.includes("/") ? current.split("/")[0] : null;
  const [expanded, setExpanded] = useState(() => {
    const set = new Set();
    if (parentOfCurrent) set.add(parentOfCurrent);
    return set;
  });

  // Auto-expand the parent of the current page when navigating
  useEffect(() => {
    if (parentOfCurrent) {
      setExpanded(prev => {
        if (prev.has(parentOfCurrent)) return prev;
        const next = new Set(prev);
        next.add(parentOfCurrent);
        return next;
      });
    }
  }, [parentOfCurrent]);

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">IC</div>
        <div className="brand-text">
          <strong>Intellect</strong>
          <span>CRM v3.2</span>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section-label">Asosiy</div>
        {NAV.map(item => {
          if (!item.children) {
            return (
              <button
                key={item.id}
                className={`nav-item ${current === item.id ? "active" : ""}`}
                onClick={() => onNav(item.id)}
              >
                <Icon name={item.icon} size={17}/>
                <span className="nav-label">{item.label}</span>
                {item.badge !== undefined && <span className="badge-count">{item.badge}</span>}
              </button>
            );
          }

          const isExpanded = expanded.has(item.id);
          const isActiveParent = current.startsWith(item.id + "/") || current === item.id;
          return (
            <React.Fragment key={item.id}>
              <button
                className={`nav-item parent ${isActiveParent ? "active-parent" : ""} ${isExpanded ? "expanded" : ""}`}
                onClick={() => toggle(item.id)}
              >
                <Icon name={item.icon} size={17}/>
                <span className="nav-label">{item.label}</span>
                <span className="chev" style={{ display: "inline-flex" }}>
                  <Icon name="chevronD" size={13}/>
                </span>
              </button>
              <AP1 initial={false}>
                {isExpanded && (
                  <m1.div
                    className="nav-sub"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {item.children.map(c => (
                      <button
                        key={c.id}
                        className={`nav-item ${current === c.id ? "active" : ""}`}
                        onClick={() => onNav(c.id)}
                      >
                        <span className="nav-label">{c.label}</span>
                      </button>
                    ))}
                  </m1.div>
                )}
              </AP1>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="user">
          <div className="user-avatar">AK</div>
          <div className="user-meta">
            <strong>Akmal K.</strong>
            <span>Admin · Toshkent</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ current, search, onSearch }) => {
  const meta = PAGE_META[current] || { title: current, crumb: "" };
  return (
    <header className="topbar">
      <div>
        <h1>{meta.title}</h1>
        <div className="breadcrumb">{meta.crumb}</div>
      </div>
      <div className="search">
        <Icon name="search" size={15}/>
        <input
          placeholder="Talabalar, lidlar, tranzaksiyalar bo'ylab qidirish..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <kbd>⌘K</kbd>
      </div>
      <IconButton icon="refresh"/>
      <IconButton icon="bell" dot/>
      <IconButton icon="settings"/>
    </header>
  );
};

// SubNav — used by routed sections (Moliya, Hisobotlar, etc) to show their tabs
const SubNav = ({ items, current, onChange }) => (
  <div className="subnav">
    {items.map(it => (
      <button key={it.id}
        className={`subnav-tab ${current === it.id ? "active" : ""}`}
        onClick={() => onChange(it.id)}
      >
        {it.icon && <Icon name={it.icon} size={14}/>}
        {it.label}
        {it.badge !== undefined && <Badge tone={it.tone || "violet"}>{it.badge}</Badge>}
      </button>
    ))}
  </div>
);

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.SubNav = SubNav;
window.PAGE_META = PAGE_META;
window.NAV_ITEMS = NAV;
