// Attendance - calendar + quick marking + analytics
const { motion: m6, AnimatePresence: AP6 } = window.framerMotion;

const AttendancePage = () => {
  const D = window.MockData;
  const today = new Date(2026, 4, 19); // May 19, 2026
  const [view, setView] = useState("month"); // month | quick | analytics
  const [month, setMonth] = useState(4); // 0-indexed (May)
  const [year, setYear] = useState(2026);
  const [activeClass, setActiveClass] = useState(D.TODAY_CLASSES[0].id);
  const [roster, setRoster] = useState(() =>
    Object.fromEntries(D.TODAY_CLASSES.map(c => [c.id, D.CLASS_ROSTER.map(s => ({ ...s }))]))
  );

  const markStudent = (status, sId) => {
    setRoster(prev => {
      const next = { ...prev };
      next[activeClass] = next[activeClass].map(s => s.id === sId ? { ...s, status } : s);
      return next;
    });
  };

  const markAll = (status) => {
    setRoster(prev => {
      const next = { ...prev };
      next[activeClass] = next[activeClass].map(s => ({ ...s, status }));
      return next;
    });
  };

  const monthName = new Date(year, month).toLocaleString("en", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay(); // 0 sun
  const offset = (firstDay + 6) % 7; // make Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const stats = useMemo(() => {
    const r = roster[activeClass] || [];
    return {
      present: r.filter(s => s.status === "present").length,
      late: r.filter(s => s.status === "late").length,
      absent: r.filter(s => s.status === "absent").length,
      total: r.length,
    };
  }, [roster, activeClass]);

  const currentClass = D.TODAY_CLASSES.find(c => c.id === activeClass);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Attendance</h2>
          <p className="page-sub">Calendar, quick marking, and analytics for all groups.</p>
        </div>
        <div className="row">
          <Tabs value={view} onChange={setView} options={[
            { value: "month", label: "Calendar" },
            { value: "quick", label: "Quick mark" },
            { value: "analytics", label: "Analytics" },
          ]}/>
        </div>
      </div>

      {view === "month" && (
        <div className="grid grid-12">
          <div className="col-8">
            <Card
              title={`${monthName} ${year}`}
              sub="Click a day to mark attendance"
              actions={
                <div className="row">
                  <button className="icon-btn" onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
                    <Icon name="chevronL" size={14}/>
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setMonth(4); setYear(2026); }}>Today</button>
                  <button className="icon-btn" onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
                    <Icon name="chevronR" size={14}/>
                  </button>
                </div>
              }
            >
              <div className="cal">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="cal-head">{d}</div>)}
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} className="cal-cell dim" style={{ visibility: "hidden" }}/>;
                  const isToday = d === 19 && month === 4 && year === 2026;
                  const events = D.CAL_EVENTS[d] || [];
                  return (
                    <m6.div
                      key={d} className={`cal-cell ${isToday ? "today" : ""}`}
                      whileHover={{ y: -1 }}
                    >
                      <div className="d">{d}</div>
                      <div className="pills">
                        {events.map((e, ei) => (
                          <div key={ei}
                            className="cal-pill"
                            style={{
                              background: e.tone === "violet" ? "var(--primary-soft)" :
                                          e.tone === "amber" ? "var(--warning-soft)" :
                                          e.tone === "red" ? "var(--danger-soft)" : "var(--bg-2)",
                              color: e.tone === "violet" ? "var(--primary)" :
                                     e.tone === "amber" ? "var(--warning)" :
                                     e.tone === "red" ? "var(--danger)" : "var(--fg-2)",
                            }}
                          >{e.label}</div>
                        ))}
                      </div>
                    </m6.div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="col-4">
            <Card title="Today's classes" sub="Tuesday, May 19">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {D.TODAY_CLASSES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveClass(c.id); setView("quick"); }}
                    style={{
                      textAlign: "left", padding: 10, borderRadius: 8,
                      border: "1px solid var(--border-2)",
                      background: "var(--surface-2)", cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <div className="spread" style={{ alignItems: "flex-start" }}>
                      <strong style={{ fontSize: 13 }}>{c.name}</strong>
                      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{c.time}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {c.teacher} · {c.room} · {c.students} students
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {view === "quick" && (
        <div className="grid grid-12">
          <div className="col-8">
            <Card
              title={currentClass.name}
              sub={`${currentClass.time} · ${currentClass.teacher} · ${currentClass.room}`}
              tight
              actions={
                <div className="row">
                  <Button variant="secondary" size="sm" icon="check" onClick={() => markAll("present")}>Mark all present</Button>
                  <select className="select" style={{ width: 200 }} value={activeClass} onChange={(e) => setActiveClass(e.target.value)}>
                    {D.TODAY_CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              }
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {roster[activeClass].map((s, i) => (
                  <div className="attend-row" key={s.id}>
                    <div className="cell-user">
                      <div className="avatar" style={{ background: D.avatarColor(s.name) }}>{D.initials(s.name)}</div>
                      <div className="meta">
                        <strong>{s.name}</strong>
                        <span>{s.id}</span>
                      </div>
                    </div>
                    <div>
                      {s.status && (
                        <Badge tone={s.status === "present" ? "green" : s.status === "late" ? "amber" : "red"} dot>
                          {s.status}
                        </Badge>
                      )}
                    </div>
                    <div className="attend-actions">
                      <button
                        className={`attend-chip present ${s.status === "present" ? "active" : ""}`}
                        onClick={() => markStudent("present", s.id)}>
                        <Icon name="check" size={11}/> Present
                      </button>
                      <button
                        className={`attend-chip late ${s.status === "late" ? "active" : ""}`}
                        onClick={() => markStudent("late", s.id)}>
                        Late
                      </button>
                      <button
                        className={`attend-chip absent ${s.status === "absent" ? "active" : ""}`}
                        onClick={() => markStudent("absent", s.id)}>
                        <Icon name="x" size={11}/> Absent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="col-4">
            <Card title="Class summary" sub="Live as you mark">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ padding: 12, background: "var(--success-soft)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Present</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--success)" }}>{stats.present}</div>
                  </div>
                  <div style={{ padding: 12, background: "var(--warning-soft)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Late</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--warning)" }}>{stats.late}</div>
                  </div>
                  <div style={{ padding: 12, background: "var(--danger-soft)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Absent</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--danger)" }}>{stats.absent}</div>
                  </div>
                </div>

                <div>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <span className="muted" style={{ fontSize: 12 }}>Progress</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {stats.present + stats.late + stats.absent} / {stats.total}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                    <m6.div initial={{ width: 0 }} animate={{ width: `${(stats.present / stats.total) * 100}%` }}
                      style={{ background: "var(--success)", height: "100%" }}/>
                    <m6.div initial={{ width: 0 }} animate={{ width: `${(stats.late / stats.total) * 100}%` }}
                      style={{ background: "var(--warning)", height: "100%" }}/>
                    <m6.div initial={{ width: 0 }} animate={{ width: `${(stats.absent / stats.total) * 100}%` }}
                      style={{ background: "var(--danger)", height: "100%" }}/>
                  </div>
                </div>

                <Button variant="primary" icon="check" style={{ width: "100%", justifyContent: "center" }}>
                  Save attendance
                </Button>
                <Button variant="secondary" icon="mail" size="sm" style={{ width: "100%", justifyContent: "center" }}>
                  Notify parents of absent
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {view === "analytics" && (
        <>
          <div className="kpi-grid">
            <KPICard label="Avg attendance" value="89.4%" delta={2.1} deltaLabel="vs last month" icon="check" spark={D.KPI_SPARK.students} sparkTone="success"/>
            <KPICard label="Total absences" value="142" delta={-8.2} deltaLabel="this month" icon="warn" spark={D.KPI_SPARK.debt} sparkTone="danger"/>
            <KPICard label="Late arrivals" value="58" delta={4.3} deltaLabel="this month" icon="trendUp" spark={D.KPI_SPARK.trials} sparkTone="warning"/>
            <KPICard label="Perfect attendance" value="124" delta={11.6} deltaLabel="students this month" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            <Card title="Weekly attendance" sub="Present / Late / Absent across all groups">
              <AttendanceChart data={D.ATTENDANCE_WEEK}/>
            </Card>
            <Card title="Attendance trend" sub="Daily rate, last 14 days">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={D.TRIAL_DAILY.map((d, i) => ({ day: d.day, rate: 80 + (i % 4) * 3 + (i % 2 ? 2 : -1) }))}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
                  <XAxis dataKey="day" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[60, 100]} tickFormatter={(v) => `${v}%`}/>
                  <Tooltip content={<TT fmt={(v) => `${v}%`}/>}/>
                  <Line type="monotone" dataKey="rate" name="Rate" stroke={CHART_COLORS.success} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.success }}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Worst attendance — needs attention" sub="Students below 80% this month" tight>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Student</th><th>Course</th><th>Teacher</th><th className="num">Attendance</th><th className="num">Last seen</th><th></th></tr>
                </thead>
                <tbody>
                  {D.STUDENTS.filter(s => s.attendance < 80).slice(0, 6).map(s => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-user">
                          <div className="avatar" style={{ background: D.avatarColor(s.name) }}>{D.initials(s.name)}</div>
                          <div className="meta"><strong>{s.name}</strong><span>{s.id}</span></div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 12.5 }}>{s.course}</span></td>
                      <td><span style={{ fontSize: 12.5 }}>{s.teacher}</span></td>
                      <td className="num">
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                          <div style={{ width: 60, height: 5, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${s.attendance}%`, height: "100%", background: "var(--danger)" }}/>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--danger)" }}>{s.attendance}%</span>
                        </div>
                      </td>
                      <td className="num"><span style={{ fontSize: 12, color: "var(--muted)" }}>3 days ago</span></td>
                      <td><Button variant="secondary" size="sm" icon="mail">Contact</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

window.AttendancePage = AttendancePage;
