// Students page - table + filters + pagination + modal
const { motion: m5 } = window.framerMotion;

const StudentsPage = ({ search }) => {
  const D = window.MockData;
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", course: "", teacher: "", age: 16 });

  const onSort = (k) => {
    if (sortBy === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = D.STUDENTS.filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (courseFilter !== "all" && s.course !== courseFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.course.toLowerCase().includes(q)
        || s.id.toLowerCase().includes(q) || s.teacher.toLowerCase().includes(q);
    });
    arr.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [statusFilter, courseFilter, search, sortBy, sortDir]);

  useEffect(() => { setPage(1); }, [statusFilter, courseFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  const allSelected = visible.length > 0 && visible.every(s => selected.includes(s.id));

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => allSelected ? s.filter(id => !visible.some(v => v.id === id)) : [...new Set([...s, ...visible.map(v => v.id)])]);

  const openNew = () => { setEditing(null); setForm({ name: "", phone: "", course: D.COURSES[0], teacher: D.TEACHERS[0], age: 16 }); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, phone: s.phone, course: s.course, teacher: s.teacher, age: s.age }); setModalOpen(true); };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Students</h2>
          <p className="page-sub">{D.STUDENTS.length} total · {D.STUDENTS.filter(s => s.status === "Active").length} active</p>
        </div>
        <div className="row">
          <Button variant="secondary" icon="download" size="sm">Export</Button>
          <Button variant="primary" icon="plus" size="sm" onClick={openNew}>Add student</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="left">
          <div className="search-inline">
            <Icon name="search" size={14}/>
            <input placeholder="Search by name, ID, teacher..."/>
          </div>
          <button className={`filter-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All</button>
          <button className={`filter-chip ${statusFilter === "Active" ? "active" : ""}`} onClick={() => setStatusFilter("Active")}>Active</button>
          <button className={`filter-chip ${statusFilter === "Trial" ? "active" : ""}`} onClick={() => setStatusFilter("Trial")}>Trial</button>
          <button className={`filter-chip ${statusFilter === "On hold" ? "active" : ""}`} onClick={() => setStatusFilter("On hold")}>On hold</button>
          <button className={`filter-chip ${statusFilter === "Graduated" ? "active" : ""}`} onClick={() => setStatusFilter("Graduated")}>Graduated</button>
        </div>
        <div className="right">
          <select className="select" style={{ width: 160 }} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="all">All courses</option>
            {D.COURSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <m5.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "var(--primary-soft)", borderRadius: 8, marginBottom: 12,
            fontSize: 13, fontWeight: 500, color: "var(--primary)",
          }}
        >
          <strong>{selected.length} selected</strong>
          <span className="spacer"/>
          <Button variant="secondary" size="sm" icon="mail">Send message</Button>
          <Button variant="secondary" size="sm" icon="flag">Tag</Button>
          <Button variant="secondary" size="sm" icon="trash">Archive</Button>
          <button className="btn-ghost btn btn-sm" onClick={() => setSelected([])}><Icon name="x" size={12}/></button>
        </m5.div>
      )}

      <Card tight>
        {filtered.length === 0 ? (
          <EmptyState
            title="No students found"
            message="Try adjusting your filters or add a new student."
            action={<Button variant="primary" icon="plus" size="sm" onClick={openNew}>Add student</Button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}/>
                    </th>
                    <th style={{ cursor: "pointer" }} onClick={() => onSort("name")}>
                      <span className="row" style={{ gap: 4 }}>Student <Icon name="sort" size={11}/></span>
                    </th>
                    <th>Course</th>
                    <th>Teacher</th>
                    <th>Group</th>
                    <th style={{ cursor: "pointer" }} onClick={() => onSort("attendance")} className="num">Attendance</th>
                    <th style={{ cursor: "pointer" }} onClick={() => onSort("balance")} className="num">Balance</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => (
                    <tr key={s.id}>
                      <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)}/></td>
                      <td>
                        <div className="cell-user">
                          <div className="avatar" style={{ background: D.avatarColor(s.name) }}>{D.initials(s.name)}</div>
                          <div className="meta">
                            <strong>{s.name}</strong>
                            <span>{s.id} · age {s.age}</span>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 12.5 }}>{s.course}</span></td>
                      <td><span style={{ fontSize: 12.5 }}>{s.teacher}</span></td>
                      <td><span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{s.group}</span></td>
                      <td className="num">
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                          <div style={{ width: 60, height: 5, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{
                              width: `${s.attendance}%`, height: "100%",
                              background: s.attendance > 90 ? "var(--success)" : s.attendance > 80 ? "var(--warning)" : "var(--danger)",
                            }}/>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{s.attendance}%</span>
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight: 600, color: s.balance < 0 ? "var(--danger)" : "var(--fg-2)" }}>
                        {s.balance < 0 ? "−" : ""}{Math.abs(s.balance).toLocaleString("en-US")}
                      </td>
                      <td>
                        <Badge tone={
                          s.status === "Active" ? "green" :
                          s.status === "Trial" ? "violet" :
                          s.status === "On hold" ? "amber" : "blue"
                        } dot>{s.status}</Badge>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => openEdit(s)}><Icon name="edit" size={13}/></button>
                          <button className="icon-btn" style={{ width: 28, height: 28 }}><Icon name="more" size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <div>Showing <strong>{(page-1)*perPage + 1}</strong>–<strong>{Math.min(page*perPage, filtered.length)}</strong> of <strong>{filtered.length}</strong></div>
              <div className="pages">
                <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><Icon name="chevronL" size={12}/></button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return <button key={p} className={`pg-btn ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><Icon name="chevronR" size={12}/></button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add new student"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={() => setModalOpen(false)}>
              {editing ? "Save changes" : "Create student"}
            </Button>
          </>
        }
      >
        <div className="field-row">
          <div className="field">
            <label>Full name</label>
            <input className="input" placeholder="Aziza Karimova" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}/>
          </div>
          <div className="field">
            <label>Age</label>
            <input className="input" type="number" value={form.age} onChange={(e) => setForm(f => ({ ...f, age: +e.target.value }))}/>
          </div>
        </div>
        <div className="field">
          <label>Phone number</label>
          <input className="input" placeholder="+998 90 123-45-67" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}/>
          <span className="hint">Used for SMS reminders and parent contact.</span>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Course</label>
            <select className="select" value={form.course} onChange={(e) => setForm(f => ({ ...f, course: e.target.value }))}>
              {D.COURSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Teacher</label>
            <select className="select" value={form.teacher} onChange={(e) => setForm(f => ({ ...f, teacher: e.target.value }))}>
              {D.TEACHERS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea className="textarea" rows="3" placeholder="Anything important about this student..."/>
        </div>
      </Modal>
    </div>
  );
};

window.StudentsPage = StudentsPage;
