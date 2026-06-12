// Arxiv — archived students, leads, groups, deleted items
const { motion: mA } = window.framerMotion;

const ArchivedStudentsView = () => {
  const D = window.MockData;
  const archived = D.STUDENTS.filter(s => s.status === "Graduated").slice(0, 14);
  return archived.length === 0
    ? <Card><EmptyState title="Arxivda talaba yo'q" message="Bitirgan talabalar bu yerda ko'rinadi."/></Card>
    : (
      <Card title="Arxiv talabalar" sub={`${archived.length} ta bitirgan talaba`} tight>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Talaba</th><th>Kurs</th><th>O'qituvchi</th><th>Bitirgan</th><th className="num">Davomat</th><th></th></tr></thead>
            <tbody>
              {archived.map(s => (
                <tr key={s.id} style={{ opacity: 0.85 }}>
                  <td>
                    <div className="cell-user">
                      <div className="avatar" style={{ background: D.avatarColor(s.name), filter: "grayscale(0.3)" }}>{D.initials(s.name)}</div>
                      <div className="meta"><strong>{s.name}</strong><span>{s.id}</span></div>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 12.5 }}>{s.course}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{s.teacher}</span></td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>2026-04-15</td>
                  <td className="num"><span className="mono" style={{ fontWeight: 600, color: "var(--success)" }}>{s.attendance}%</span></td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <Button variant="secondary" size="sm" icon="refresh">Tiklash</Button>
                      <button className="icon-btn" style={{ width: 28, height: 28 }}><Icon name="trash" size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
};

const ArchivedLeadsView = () => {
  const D = window.MockData;
  const archived = D.LEADS.filter(l => l.stage === "lost");
  return archived.length === 0
    ? <Card><EmptyState title="Arxivda lid yo'q" message="Yo'qotilgan lidlar bu yerda ko'rinadi."/></Card>
    : (
      <div className="entity-grid">
        {archived.map(l => (
          <div key={l.id} className="entity-card" style={{ opacity: 0.85 }}>
            <div className="ec-head">
              <Avatar name={l.name} size={40}/>
              <div style={{ flex: 1 }}>
                <div className="ec-name">{l.name}</div>
                <div className="ec-meta">{l.course}</div>
              </div>
              <Badge tone="red" dot>Lost</Badge>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              <div className="spread"><span>Manba</span><span>{l.source}</span></div>
              <div className="spread" style={{ marginTop: 4 }}><span>Yo'qotilgan</span><span>2026-04-22</span></div>
              <div className="spread" style={{ marginTop: 4 }}><span>Yo'qotilgan summa</span><span className="mono">{formatUZS(l.value)}</span></div>
            </div>
            <div className="ec-foot">
              <Button variant="secondary" size="sm" icon="refresh">Qayta faollashtirish</Button>
            </div>
          </div>
        ))}
      </div>
    );
};

const ArchivedGroupsView = () => {
  const D = window.MockData;
  const archived = D.GROUPS.slice(0, 5).map(g => ({ ...g, status: "Closed" }));
  return (
    <Card title="Arxiv guruhlar" sub={`${archived.length} ta yopilgan guruh`} tight>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Guruh</th><th>Kurs</th><th>O'qituvchi</th><th>Yopilgan</th><th className="num">Yakuniy bitirganlar</th><th></th></tr></thead>
          <tbody>
            {archived.map(g => (
              <tr key={g.id} style={{ opacity: 0.85 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{g.id}</div>
                </td>
                <td><span style={{ fontSize: 12.5 }}>{g.course}</span></td>
                <td><span style={{ fontSize: 12.5 }}>{g.teacher}</span></td>
                <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>2026-03-30</td>
                <td className="num"><span className="mono" style={{ fontWeight: 600 }}>{g.enrolled}</span></td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <Button variant="secondary" size="sm" icon="refresh">Tiklash</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const DeletedView = () => {
  const items = [
    { type: "Talaba", name: "Sherzod Toshpulatov", who: "Akmal K.", when: "2 kun oldin" },
    { type: "Lid", name: "Diyora Kamilova", who: "Madina S.", when: "3 kun oldin" },
    { type: "Tranzaksiya", name: "TX-5022", who: "Akmal K.", when: "5 kun oldin" },
    { type: "Guruh", name: "Frontend-2", who: "Akmal K.", when: "1 hafta oldin" },
    { type: "O'qituvchi", name: "Olim Nazarov", who: "Akmal K.", when: "2 hafta oldin" },
  ];
  return (
    <Card title="O'chirilganlar" sub="30 kun ichida tiklash mumkin" tight>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Element</th><th>Turi</th><th>Kim o'chirgan</th><th>Qachon</th><th></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><strong style={{ fontSize: 13 }}>{it.name}</strong></td>
                <td><Badge tone="violet">{it.type}</Badge></td>
                <td><span style={{ fontSize: 12.5 }}>{it.who}</span></td>
                <td><span style={{ fontSize: 12, color: "var(--muted)" }}>{it.when}</span></td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="sm" icon="refresh">Tiklash</Button>
                    <Button variant="secondary" size="sm" icon="trash">Butunlay o'chirish</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const ArchivePage = ({ sub }) => {
  const D = window.MockData;
  const view = sub || "students";

  const items = [
    { id: "students", label: "Talabalar", icon: "students", badge: D.STUDENTS.filter(s => s.status === "Graduated").length },
    { id: "leads", label: "Lidlar", icon: "kanban", badge: D.LEADS.filter(l => l.stage === "lost").length },
    { id: "groups", label: "Guruhlar", icon: "users", badge: 5 },
    { id: "deleted", label: "O'chirilganlar", icon: "trash", badge: 5, tone: "red" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Arxiv</h2>
          <p className="page-sub">Eski va o'chirilgan elementlarni saqlash. 30 kun ichida tiklash mumkin.</p>
        </div>
        <Button variant="secondary" icon="download" size="sm">To'liq backup</Button>
      </div>

      <SubNav items={items} current={view} onChange={(id) => window.__setRoute(`archive/${id}`)}/>

      <mA.div key={view}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {view === "students" && <ArchivedStudentsView/>}
        {view === "leads" && <ArchivedLeadsView/>}
        {view === "groups" && <ArchivedGroupsView/>}
        {view === "deleted" && <DeletedView/>}
      </mA.div>
    </div>
  );
};

window.ArchivePage = ArchivePage;
