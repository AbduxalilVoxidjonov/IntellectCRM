// Hisobotlar — reports with sub-routes
const { motion: mR } = window.framerMotion;

const ReportShell = ({ kpis, charts, table }) => (
  <>
    <div className="kpi-grid">{kpis}</div>
    <div className="grid grid-2" style={{ marginBottom: 16 }}>{charts}</div>
    {table}
  </>
);

const RevenueReport = () => {
  const D = window.MockData;
  return (
    <ReportShell
      kpis={<>
        <KPICard label="Jami daromad" value="234.8M so'm" delta={12.4} deltaLabel="oy davomida" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
        <KPICard label="O'rtacha kunlik" value="7.8M so'm" delta={3.2} deltaLabel="kun" icon="trendUp" spark={D.KPI_SPARK.trials} sparkTone="success"/>
        <KPICard label="Eng yaxshi kun" value="14.2M so'm" delta={0} deltaLabel="12-May" icon="spark" spark={D.KPI_SPARK.revenue} sparkTone="warning"/>
        <KPICard label="Tushum yo'qotish" value="6.4M so'm" delta={-12.3} deltaLabel="qaytarishlar" icon="refresh" spark={D.KPI_SPARK.debt} sparkTone="info"/>
      </>}
      charts={<>
        <Card title="Yillik daromad trendi" sub="Oylik"><RevenueChart data={D.REVENUE_SERIES} fmt={formatUZS}/></Card>
        <Card title="Kurs bo'yicha taqsimot" sub="Bu oy">
          <CourseMixPie data={D.COURSE_MIX.map(c => ({ name: c.name, value: c.value * 50000 }))}/>
        </Card>
      </>}
      table={
        <Card title="Top to'lovchi talabalar" sub="Bu oydagi to'lov hajmi bo'yicha" tight>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Talaba</th><th>Kurs</th><th>To'lovlar soni</th><th className="num">Jami summa</th></tr></thead>
              <tbody>
                {D.STUDENTS.slice(0, 8).map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-user">
                        <div className="avatar" style={{ background: D.avatarColor(s.name) }}>{D.initials(s.name)}</div>
                        <div className="meta"><strong>{s.name}</strong><span>{s.id}</span></div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12.5 }}>{s.course}</span></td>
                    <td className="num"><span className="mono">{(i % 3) + 2}</span></td>
                    <td className="num" style={{ fontWeight: 600 }}>{((8 - i) * 280000).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      }
    />
  );
};

const StudentsReport = () => {
  const D = window.MockData;
  return (
    <ReportShell
      kpis={<>
        <KPICard label="Jami talabalar" value="487" delta={8.2} deltaLabel="+37 bu oy" icon="users" spark={D.KPI_SPARK.students} sparkTone="primary"/>
        <KPICard label="Yangi qabul" value="42" delta={11.4} deltaLabel="bu oy" icon="user" spark={D.KPI_SPARK.trials} sparkTone="success"/>
        <KPICard label="Ketganlar" value="8" delta={-12} deltaLabel="bu oy" icon="trendDn" spark={D.KPI_SPARK.debt} sparkTone="danger"/>
        <KPICard label="Saqlanish darajasi" value="93.6%" delta={1.8} deltaLabel="kvartal" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="info"/>
      </>}
      charts={<>
        <Card title="Talaba o'sishi" sub="Yangi vs ketganlar"><StudentGrowthChart data={D.STUDENT_GROWTH}/></Card>
        <Card title="Kursdagi mix" sub="Hozirgi taqsimot"><CourseMixPie data={D.COURSE_MIX}/></Card>
      </>}
      table={
        <Card title="Yosh bo'yicha taqsimot" sub="Joriy talabalar">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[["8–12", 78], ["13–17", 142], ["18–24", 198], ["25+", 69]].map(([label, n]) => (
              <div key={label} style={{ padding: 16, background: "var(--bg-2)", borderRadius: 10 }}>
                <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{label} yosh</div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>{n}</div>
                <div style={{ marginTop: 8, height: 4, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${(n / 487) * 100}%`, height: "100%", background: "var(--primary)" }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
    />
  );
};

const AttendanceReport = () => {
  const D = window.MockData;
  return (
    <ReportShell
      kpis={<>
        <KPICard label="O'rtacha davomat" value="89.4%" delta={2.1} deltaLabel="oy davomida" icon="check" spark={D.KPI_SPARK.students} sparkTone="success"/>
        <KPICard label="Jami yo'q kelganlar" value="142" delta={-8.2} deltaLabel="kamaygan" icon="warn" spark={D.KPI_SPARK.debt} sparkTone="danger"/>
        <KPICard label="Kech kelganlar" value="58" delta={4.3} deltaLabel="bu oy" icon="trendUp" spark={D.KPI_SPARK.trials} sparkTone="warning"/>
        <KPICard label="Mukammal davomat" value="124" delta={11.6} deltaLabel="talabalar" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
      </>}
      charts={<>
        <Card title="Haftalik davomat" sub="Barcha guruhlar"><AttendanceChart data={D.ATTENDANCE_WEEK}/></Card>
        <Card title="Davomat trendi" sub="Oxirgi 14 kun">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={D.TRIAL_DAILY.map((d, i) => ({ day: d.day, rate: 80 + (i % 4) * 3 + (i % 2 ? 2 : -1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
              <XAxis dataKey="day" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[60, 100]} tickFormatter={(v) => `${v}%`}/>
              <Tooltip content={<TT fmt={(v) => `${v}%`}/>}/>
              <Line type="monotone" dataKey="rate" stroke={CHART_COLORS.success} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.success }}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </>}
      table={
        <Card title="Diqqat talab qiluvchilar" sub="80% dan past davomatli" tight>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Talaba</th><th>Kurs</th><th>O'qituvchi</th><th className="num">Davomat</th><th></th></tr></thead>
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
                    <td><Button variant="secondary" size="sm" icon="mail">Bog'lanish</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      }
    />
  );
};

const TeachersReport = () => {
  const D = window.MockData;
  return (
    <ReportShell
      kpis={<>
        <KPICard label="Faol o'qituvchilar" value="10" delta={1} deltaLabel="bu oy" icon="users" spark={D.KPI_SPARK.students} sparkTone="primary"/>
        <KPICard label="O'rtacha reyting" value="4.62" delta={1.4} deltaLabel="5 dan" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="success"/>
        <KPICard label="Top performer" value="Aziza M." delta={0} deltaLabel="4.92 reyting" icon="user" spark={D.KPI_SPARK.students} sparkTone="info"/>
        <KPICard label="Ish haqi fondi" value="18.4M so'm" delta={3.2} deltaLabel="oy" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="warning"/>
      </>}
      charts={<>
        <Card title="O'qituvchilar bo'yicha talabalar soni" sub="Eng band o'qituvchilar">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={D.TEACHERS_FULL.slice(0, 8).map(t => ({ name: t.name.split(" ")[0], students: t.students }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
              <XAxis dataKey="name" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="students" name="Talabalar" fill={CHART_COLORS.primary} radius={[6,6,0,0]} barSize={24}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Reyting taqsimoti" sub="O'qituvchilar bo'yicha">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={D.TEACHERS_FULL.slice(0, 8).map(t => ({ name: t.name.split(" ")[0], rating: +t.rating }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
              <XAxis dataKey="name" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[3.5, 5]}/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="rating" name="Reyting" fill={CHART_COLORS.success} radius={[6,6,0,0]} barSize={24}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </>}
      table={
        <Card title="O'qituvchilar reytingi" tight>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>O'qituvchi</th><th>Fanlar</th><th className="num">Guruhlar</th><th className="num">Talabalar</th><th className="num">Reyting</th></tr></thead>
              <tbody>
                {D.TEACHERS_FULL.sort((a, b) => +b.rating - +a.rating).slice(0, 8).map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="cell-user">
                        <div className="avatar" style={{ background: D.avatarColor(t.name) }}>{D.initials(t.name)}</div>
                        <div className="meta"><strong>{t.name}</strong><span>{t.role}</span></div>
                      </div>
                    </td>
                    <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{t.subjects.slice(0,2).map(s => <Badge key={s}>{s}</Badge>)}</div></td>
                    <td className="num"><span className="mono">{t.groups}</span></td>
                    <td className="num"><span className="mono">{t.students}</span></td>
                    <td className="num"><span className="mono" style={{ fontWeight: 600, color: "var(--success)" }}>{t.rating}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      }
    />
  );
};

const LeadsReport = () => {
  const D = window.MockData;
  return (
    <ReportShell
      kpis={<>
        <KPICard label="Yangi lidlar" value="142" delta={18.4} deltaLabel="bu oy" icon="kanban" spark={D.KPI_SPARK.trials} sparkTone="primary"/>
        <KPICard label="Konversiya" value="45.1%" delta={3.2} deltaLabel="trial → paid" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="success"/>
        <KPICard label="O'rtacha bitim" value="650K so'm" delta={4.1} deltaLabel="bir lid" icon="money" spark={D.KPI_SPARK.students} sparkTone="warning"/>
        <KPICard label="Faol lidlar" value="26" delta={2.0} deltaLabel="bu oy" icon="users" spark={D.KPI_SPARK.trials} sparkTone="info"/>
      </>}
      charts={<>
        <Card title="Trial → Paid funnel" sub="Oxirgi 30 kun"><TrialFunnel data={D.TRIAL_FUNNEL}/></Card>
        <Card title="Lid manbalari" sub="Qaerdan kelmoqda">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={[
                { name: "Instagram", value: 48 },
                { name: "Telegram", value: 32 },
                { name: "Tanish", value: 28 },
                { name: "Google", value: 18 },
                { name: "Sayt", value: 16 },
              ]} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                {[CHART_COLORS.primary, CHART_COLORS.info, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger].map((c, i) => <Cell key={i} fill={c}/>)}
              </Pie>
              <Tooltip content={<TT/>}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </>}
    />
  );
};

const ReportsPage = ({ sub }) => {
  const view = sub || "revenue";
  const items = [
    { id: "revenue", label: "Daromad", icon: "money" },
    { id: "students", label: "Talabalar", icon: "students" },
    { id: "attendance", label: "Davomat", icon: "attendance" },
    { id: "teachers", label: "O'qituvchilar", icon: "user" },
    { id: "leads", label: "Lidlar", icon: "kanban" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Hisobotlar</h2>
          <p className="page-sub">Batafsil analitika va tahliliy ko'rinishlar.</p>
        </div>
        <div className="row">
          <Button variant="secondary" icon="calendar" size="sm">Davr: May 2026</Button>
          <Button variant="secondary" icon="download" size="sm">PDF eksport</Button>
        </div>
      </div>

      <SubNav items={items} current={view} onChange={(id) => window.__setRoute(`reports/${id}`)}/>

      <mR.div key={view}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {view === "revenue" && <RevenueReport/>}
        {view === "students" && <StudentsReport/>}
        {view === "attendance" && <AttendanceReport/>}
        {view === "teachers" && <TeachersReport/>}
        {view === "leads" && <LeadsReport/>}
      </mR.div>
    </div>
  );
};

window.ReportsPage = ReportsPage;
