// Dashboard page
const { motion: m2 } = window.framerMotion;

const KPICard = ({ label, value, delta, deltaLabel, icon, spark, sparkTone, loading }) => (
  <m2.div
    className="kpi"
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  >
    <div className="kpi-top">
      <div className="kpi-label">{label}</div>
      <div className="kpi-icon"><Icon name={icon} size={16}/></div>
    </div>
    <div className="kpi-value">
      {loading ? <Skeleton w={120} h={26}/> : value}
    </div>
    <div className="kpi-foot">
      {loading ? <Skeleton w={100} h={14}/> : (
        <>
          <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
            <Icon name={delta >= 0 ? "trendUp" : "trendDn"} size={11}/>
            {Math.abs(delta)}%
          </span>
          <span className="muted">{deltaLabel}</span>
        </>
      )}
    </div>
    {spark && !loading && <div className="kpi-spark"><Spark data={spark} tone={sparkTone}/></div>}
  </m2.div>
);

const DashboardPage = ({ loading }) => {
  const D = window.MockData;
  const [range, setRange] = useState("30d");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Good afternoon, Akmal 👋</h2>
          <p className="page-sub">Here's how Intellect is performing today, May 19.</p>
        </div>
        <div className="row">
          <Tabs value={range} onChange={setRange} options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "90d", label: "Quarter" },
            { value: "1y", label: "Year" },
          ]}/>
          <Button variant="secondary" icon="download" size="sm">Export</Button>
          <Button variant="primary" icon="plus" size="sm">Quick action</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <KPICard
          label="Monthly revenue" value="234.8M so'm" delta={12.4} deltaLabel="vs last month"
          icon="money" spark={D.KPI_SPARK.revenue} sparkTone="primary" loading={loading}
        />
        <KPICard
          label="Active students" value="487" delta={8.2} deltaLabel="+37 this month"
          icon="users" spark={D.KPI_SPARK.students} sparkTone="success" loading={loading}
        />
        <KPICard
          label="Trial → paid" value="64 / 142" delta={-3.1} deltaLabel="conversion 45.1%"
          icon="target" spark={D.KPI_SPARK.trials} sparkTone="info" loading={loading}
        />
        <KPICard
          label="Outstanding debt" value="15.5M so'm" delta={-5.6} deltaLabel="27 students"
          icon="warn" spark={D.KPI_SPARK.debt} sparkTone="warning" loading={loading}
        />
      </div>

      {/* Revenue + Trial funnel */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card
          title="Revenue vs expense"
          sub="Year-to-date, in so'm"
          actions={
            <div className="row">
              <Badge tone="violet" dot>Revenue</Badge>
              <Badge tone="amber" dot>Expense</Badge>
            </div>
          }
        >
          {loading ? <Skeleton w="100%" h={260} r={8}/> : <RevenueChart data={D.REVENUE_SERIES} fmt={formatUZS}/>}
        </Card>

        <Card title="Trial lesson funnel" sub="Last 30 days">
          {loading ? <Skeleton w="100%" h={200} r={8}/> : <TrialFunnel data={D.TRIAL_FUNNEL}/>}
          <hr className="hr"/>
          <div className="spread">
            <div>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Show-up rate</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>76.1%</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Conversion</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--success)" }}>45.1%</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Student growth + Attendance */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Student growth" sub="New vs churned · active total trend">
          {loading ? <Skeleton w="100%" h={240} r={8}/> : <StudentGrowthChart data={D.STUDENT_GROWTH}/>}
        </Card>

        <Card title="Attendance this week" sub="Across all groups">
          {loading ? <Skeleton w="100%" h={220} r={8}/> : <AttendanceChart data={D.ATTENDANCE_WEEK}/>}
          <div className="row" style={{ marginTop: 8, justifyContent: "center", gap: 16 }}>
            <Badge tone="green" dot>Present</Badge>
            <Badge tone="amber" dot>Late</Badge>
            <Badge tone="red" dot>Absent</Badge>
          </div>
        </Card>
      </div>

      {/* Debt + Trial daily + Course mix */}
      <div className="grid grid-3">
        <Card title="Debt aging" sub="By bucket (so'm)">
          {loading ? <Skeleton w="100%" h={200} r={8}/> : (
            <>
              <DebtDonut data={D.DEBT_BUCKETS}/>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {D.DEBT_BUCKETS.map((b, i) => (
                  <div className="spread" key={i} style={{ fontSize: 12.5 }}>
                    <div className="row">
                      <span className="badge dot" style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: ["var(--success)", "var(--warning)", "oklch(0.68 0.16 35)", "var(--danger)"][i],
                        padding: 0
                      }}></span>
                      <span>{b.name}</span>
                      <span className="muted">· {b.value} students</span>
                    </div>
                    <span className="mono" style={{ fontWeight: 600 }}>{formatUZS(b.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Trial bookings" sub="Last 14 days">
          {loading ? <Skeleton w="100%" h={220} r={8}/> : <TrialDaily data={D.TRIAL_DAILY}/>}
        </Card>

        <Card title="Course mix" sub="Active students by program">
          {loading ? <Skeleton w="100%" h={220} r={8}/> : <CourseMixPie data={D.COURSE_MIX}/>}
        </Card>
      </div>
    </div>
  );
};

window.DashboardPage = DashboardPage;
