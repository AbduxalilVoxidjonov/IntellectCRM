// Guruhlar page
const { motion: mG } = window.framerMotion;

const GroupsPage = ({ search }) => {
  const D = window.MockData;
  const [view, setView] = useState("grid"); // grid | table
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return D.GROUPS.filter(g => {
      if (levelFilter !== "all" && g.level !== levelFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q) ||
             g.course.toLowerCase().includes(q) ||
             g.teacher.toLowerCase().includes(q);
    });
  }, [search, levelFilter, statusFilter]);

  const totalEnrolled = D.GROUPS.reduce((a, g) => a + g.enrolled, 0);
  const totalCapacity = D.GROUPS.reduce((a, g) => a + g.capacity, 0);
  const avgFill = Math.round((totalEnrolled / totalCapacity) * 100);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Guruhlar</h2>
          <p className="page-sub">{D.GROUPS.length} ta guruh · {totalEnrolled} ta o'quvchi · {avgFill}% to'lganlik</p>
        </div>
        <div className="row">
          <Button variant="secondary" icon="download" size="sm">Eksport</Button>
          <Button variant="primary" icon="plus" size="sm" onClick={() => setModalOpen(true)}>Yangi guruh</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard label="Faol guruhlar" value={D.GROUPS.filter(g => g.status === "Active").length.toString()} delta={5.2} deltaLabel="o'tgan oyga nisbatan" icon="users" spark={D.KPI_SPARK.students} sparkTone="primary"/>
        <KPICard label="O'rtacha to'lganlik" value={`${avgFill}%`} delta={3.1} deltaLabel="oxirgi oy" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="success"/>
        <KPICard label="Bo'sh joylar" value={(totalCapacity - totalEnrolled).toString()} delta={-2.4} deltaLabel="joy mavjud" icon="user" spark={D.KPI_SPARK.trials} sparkTone="info"/>
        <KPICard label="Oylik daromad" value={formatUZS(D.GROUPS.reduce((a, g) => a + g.revenue, 0))} delta={11.8} deltaLabel="barcha guruhlardan" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="warning"/>
      </div>

      <div className="toolbar">
        <div className="left">
          <button className={`filter-chip ${levelFilter === "all" ? "active" : ""}`} onClick={() => setLevelFilter("all")}>Barchasi</button>
          <button className={`filter-chip ${levelFilter === "Beginner" ? "active" : ""}`} onClick={() => setLevelFilter("Beginner")}>Beginner</button>
          <button className={`filter-chip ${levelFilter === "Intermediate" ? "active" : ""}`} onClick={() => setLevelFilter("Intermediate")}>Intermediate</button>
          <button className={`filter-chip ${levelFilter === "Advanced" ? "active" : ""}`} onClick={() => setLevelFilter("Advanced")}>Advanced</button>
        </div>
        <div className="right">
          <select className="select" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Hammasi</option>
            <option value="Active">Faol</option>
            <option value="Forming">Shakllanmoqda</option>
          </select>
          <Tabs value={view} onChange={setView} options={[
            { value: "grid", label: "Kartalar" },
            { value: "table", label: "Jadval" },
          ]}/>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="Guruh topilmadi" message="Filtrlarni o'zgartirib ko'ring yoki yangi guruh qo'shing."/></Card>
      ) : view === "grid" ? (
        <div className="entity-grid">
          {filtered.map((g, i) => (
            <mG.div
              key={g.id}
              className="entity-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.4), ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="ec-head">
                <div className="avatar" style={{
                  width: 44, height: 44, borderRadius: 10, fontSize: 13,
                  background: D.avatarColor(g.name),
                }}>{g.name.slice(0, 3).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="ec-name">{g.name}</div>
                  <div className="ec-meta">{g.course}</div>
                </div>
                <Badge tone={g.status === "Active" ? "green" : "amber"} dot>{g.status === "Active" ? "Faol" : "Shakllanmoqda"}</Badge>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                <div className="spread">
                  <span className="muted">O'qituvchi</span>
                  <strong>{g.teacher}</strong>
                </div>
                <div className="spread">
                  <span className="muted">Jadval</span>
                  <span>{g.schedule}</span>
                </div>
                <div className="spread">
                  <span className="muted">Vaqt</span>
                  <span className="mono">{g.time}</span>
                </div>
                <div className="spread">
                  <span className="muted">Xona</span>
                  <span>{g.room}</span>
                </div>
              </div>

              <div>
                <div className="spread" style={{ marginBottom: 4 }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>To'lganlik</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{g.enrolled} / {g.capacity}</span>
                </div>
                <div style={{ height: 6, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden" }}>
                  <mG.div initial={{ width: 0 }} animate={{ width: `${(g.enrolled / g.capacity) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: "100%", background: g.enrolled >= g.capacity ? "var(--danger)" : g.enrolled / g.capacity > 0.85 ? "var(--warning)" : "var(--primary)" }}/>
                </div>
              </div>

              <div className="ec-stats">
                <div>
                  <div className="ec-stat-label">Daraja</div>
                  <div className="ec-stat-value" style={{ fontSize: 13, fontFamily: "var(--font-ui)" }}>{g.level}</div>
                </div>
                <div>
                  <div className="ec-stat-label">Davomat</div>
                  <div className="ec-stat-value" style={{ color: g.attendance > 90 ? "var(--success)" : "var(--warning)" }}>{g.attendance}%</div>
                </div>
                <div>
                  <div className="ec-stat-label">Daromad</div>
                  <div className="ec-stat-value">{formatUZS(g.revenue)}</div>
                </div>
              </div>

              <div className="ec-foot">
                <Button variant="secondary" size="sm" icon="users">Talabalar</Button>
                <Button variant="secondary" size="sm" icon="edit">Tahrirlash</Button>
              </div>
            </mG.div>
          ))}
        </div>
      ) : (
        <Card tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Guruh</th>
                  <th>Kurs</th>
                  <th>O'qituvchi</th>
                  <th>Jadval</th>
                  <th>Vaqt</th>
                  <th className="num">To'lganlik</th>
                  <th className="num">Davomat</th>
                  <th className="num">Daromad</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{g.id} · {g.room}</div>
                    </td>
                    <td><span style={{ fontSize: 12.5 }}>{g.course}</span></td>
                    <td><span style={{ fontSize: 12.5 }}>{g.teacher}</span></td>
                    <td><span style={{ fontSize: 12 }}>{g.schedule}</span></td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{g.time}</span></td>
                    <td className="num">
                      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 50, height: 5, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${(g.enrolled/g.capacity)*100}%`, height: "100%", background: "var(--primary)" }}/>
                        </div>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{g.enrolled}/{g.capacity}</span>
                      </div>
                    </td>
                    <td className="num"><span className="mono" style={{ fontWeight: 600 }}>{g.attendance}%</span></td>
                    <td className="num"><span className="mono" style={{ fontWeight: 600 }}>{formatUZS(g.revenue)}</span></td>
                    <td><Badge tone={g.status === "Active" ? "green" : "amber"} dot>{g.status === "Active" ? "Faol" : "Shakllanmoqda"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title="Yangi guruh yaratish"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button variant="primary" icon="check" onClick={() => setModalOpen(false)}>Yaratish</Button>
          </>
        }
      >
        <div className="field"><label>Guruh nomi</label><input className="input" placeholder="masalan: IELTS-7"/></div>
        <div className="field-row">
          <div className="field"><label>Kurs</label>
            <select className="select">{D.COURSES.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="field"><label>Daraja</label>
            <select className="select"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
          </div>
        </div>
        <div className="field-row">
          <div className="field"><label>O'qituvchi</label>
            <select className="select">{D.TEACHERS.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field"><label>Xona</label><input className="input" placeholder="Room 201"/></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Sig'imi</label><input className="input" type="number" defaultValue="16"/></div>
          <div className="field"><label>Jadval</label>
            <select className="select"><option>Du, Cho, Ju</option><option>Se, Pa, Sh</option></select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

window.GroupsPage = GroupsPage;
