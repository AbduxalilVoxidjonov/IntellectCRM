// O'qituvchilar page
const { motion: mT } = window.framerMotion;

const TeachersPage = ({ search }) => {
  const D = window.MockData;
  const [view, setView] = useState("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return D.TEACHERS_FULL.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q) || t.subjects.join(" ").toLowerCase().includes(q);
    });
  }, [search, statusFilter]);

  const totalStudents = D.TEACHERS_FULL.reduce((a, t) => a + t.students, 0);
  const avgRating = (D.TEACHERS_FULL.reduce((a, t) => a + +t.rating, 0) / D.TEACHERS_FULL.length).toFixed(2);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">O'qituvchilar</h2>
          <p className="page-sub">{D.TEACHERS_FULL.length} ta xodim · {totalStudents} ta talaba · {avgRating}/5.0 reyting</p>
        </div>
        <div className="row">
          <Button variant="secondary" icon="download" size="sm">Eksport</Button>
          <Button variant="primary" icon="plus" size="sm" onClick={() => setModalOpen(true)}>Yangi o'qituvchi</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard label="Faol o'qituvchilar" value={D.TEACHERS_FULL.filter(t => t.status === "Active").length.toString()} delta={2.0} deltaLabel="bu oy" icon="users" spark={D.KPI_SPARK.students} sparkTone="primary"/>
        <KPICard label="O'rtacha reyting" value={`${avgRating}/5`} delta={1.4} deltaLabel="o'tgan oyga nisbatan" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="success"/>
        <KPICard label="Jami talabalar" value={totalStudents.toString()} delta={8.6} deltaLabel="biriktirilgan" icon="user" spark={D.KPI_SPARK.students} sparkTone="info"/>
        <KPICard label="Oylik fond" value={formatUZS(D.TEACHERS_FULL.reduce((a, t) => a + t.salary, 0))} delta={3.2} deltaLabel="ish haqi" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="warning"/>
      </div>

      <div className="toolbar">
        <div className="left">
          <button className={`filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>Barchasi</button>
          <button className={`filter-chip ${statusFilter === "Active" ? "active" : ""}`} onClick={() => setStatusFilter("Active")}>Faol</button>
          <button className={`filter-chip ${statusFilter === "On leave" ? "active" : ""}`} onClick={() => setStatusFilter("On leave")}>Ta'tilda</button>
        </div>
        <div className="right">
          <Tabs value={view} onChange={setView} options={[
            { value: "grid", label: "Kartalar" },
            { value: "table", label: "Jadval" },
          ]}/>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="O'qituvchi topilmadi" message="Filtrlarni o'zgartirib ko'ring."/></Card>
      ) : view === "grid" ? (
        <div className="entity-grid">
          {filtered.map((t, i) => (
            <mT.div
              key={t.id}
              className="entity-card"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.4), ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="ec-head">
                <div className="avatar" style={{ background: D.avatarColor(t.name) }}>{D.initials(t.name)}</div>
                <div style={{ flex: 1 }}>
                  <div className="ec-name">{t.name}</div>
                  <div className="ec-meta">{t.role} · {t.yearsAt} yil</div>
                </div>
                <Badge tone={t.status === "Active" ? "green" : "amber"} dot>{t.status === "Active" ? "Faol" : "Ta'tilda"}</Badge>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {t.subjects.map(s => <Badge key={s} tone="violet">{s}</Badge>)}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                <div className="spread">
                  <span className="muted"><Icon name="phone" size={11}/></span>
                  <span className="mono" style={{ fontSize: 12 }}>{t.phone}</span>
                </div>
              </div>

              <div className="ec-stats">
                <div>
                  <div className="ec-stat-label">Guruhlar</div>
                  <div className="ec-stat-value">{t.groups}</div>
                </div>
                <div>
                  <div className="ec-stat-label">Talabalar</div>
                  <div className="ec-stat-value">{t.students}</div>
                </div>
                <div>
                  <div className="ec-stat-label">Reyting</div>
                  <div className="ec-stat-value" style={{ color: "var(--success)" }}>{t.rating}</div>
                </div>
              </div>

              <div className="ec-foot">
                <Button variant="secondary" size="sm" icon="calendar">Jadval</Button>
                <Button variant="secondary" size="sm" icon="edit">Tahrirlash</Button>
              </div>
            </mT.div>
          ))}
        </div>
      ) : (
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>O'qituvchi</th><th>Lavozim</th><th>Fanlar</th>
                  <th className="num">Guruhlar</th><th className="num">Talabalar</th>
                  <th className="num">Reyting</th><th className="num">Ish haqi</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="cell-user">
                        <div className="avatar" style={{ background: D.avatarColor(t.name) }}>{D.initials(t.name)}</div>
                        <div className="meta"><strong>{t.name}</strong><span>{t.id} · {t.yearsAt} yil</span></div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12.5 }}>{t.role}</span></td>
                    <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{t.subjects.map(s => <Badge key={s}>{s}</Badge>)}</div></td>
                    <td className="num"><span className="mono">{t.groups}</span></td>
                    <td className="num"><span className="mono">{t.students}</span></td>
                    <td className="num"><span className="mono" style={{ color: "var(--success)", fontWeight: 600 }}>{t.rating}</span></td>
                    <td className="num"><span className="mono" style={{ fontWeight: 600 }}>{formatUZS(t.salary)}</span></td>
                    <td><Badge tone={t.status === "Active" ? "green" : "amber"} dot>{t.status === "Active" ? "Faol" : "Ta'tilda"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title="Yangi o'qituvchi qo'shish"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button variant="primary" icon="check" onClick={() => setModalOpen(false)}>Qo'shish</Button>
          </>
        }
      >
        <div className="field-row">
          <div className="field"><label>To'liq ism</label><input className="input" placeholder="Masalan: Aziza Karimova"/></div>
          <div className="field"><label>Lavozim</label>
            <select className="select"><option>Teacher</option><option>Senior Teacher</option><option>Lead Teacher</option></select>
          </div>
        </div>
        <div className="field"><label>Telefon</label><input className="input" placeholder="+998 90 123-45-67"/></div>
        <div className="field"><label>Fanlar</label>
          <select className="select">{D.COURSES.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field"><label>Ish haqi (oylik)</label><input className="input" placeholder="masalan: 1 500 000"/></div>
      </Modal>
    </div>
  );
};

window.TeachersPage = TeachersPage;
