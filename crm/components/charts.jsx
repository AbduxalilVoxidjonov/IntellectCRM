// Chart wrappers around Recharts with consistent styling
const {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  FunnelChart, Funnel, LabelList,
} = window.Recharts;

const CHART_COLORS = {
  primary: "oklch(0.55 0.18 282)",
  primarySoft: "oklch(0.85 0.08 282)",
  primaryFill: "oklch(0.6 0.18 282)",
  success: "oklch(0.62 0.14 158)",
  warning: "oklch(0.72 0.14 70)",
  danger: "oklch(0.62 0.2 25)",
  info: "oklch(0.65 0.13 230)",
  muted: "oklch(0.55 0.012 270)",
  grid: "oklch(0.93 0.005 270)",
};

const PIE_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.info,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  "oklch(0.6 0.15 320)",
];

const TT = ({ active, payload, label, fmt }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tt-card">
      {label !== undefined && <div className="lbl">{label}</div>}
      {payload.map((p, i) => (
        <div className="tt-row" key={i}>
          <span className="sw" style={{ background: p.color || p.fill || p.stroke }} />
          <span>{p.name}</span>
          <span className="v">{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// Revenue area chart with gradient
const RevenueChart = ({ data, fmt }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.32} />
          <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.warning} stopOpacity={0.22} />
          <stop offset="100%" stopColor={CHART_COLORS.warning} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
      <XAxis dataKey="month" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt}/>
      <Tooltip content={<TT fmt={fmt} />} />
      <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#gradRev)" />
      <Area type="monotone" dataKey="expense" name="Expense" stroke={CHART_COLORS.warning} strokeWidth={2} fill="url(#gradExp)" />
    </AreaChart>
  </ResponsiveContainer>
);

// Student growth (composed: bars new vs churn + line active)
const StudentGrowthChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
      <XAxis dataKey="month" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <Tooltip content={<TT />} />
      <Bar dataKey="new" name="New" fill={CHART_COLORS.primary} radius={[4,4,0,0]} barSize={14}/>
      <Bar dataKey="churned" name="Churned" fill={CHART_COLORS.danger} radius={[4,4,0,0]} barSize={14}/>
      <Line type="monotone" dataKey="active" name="Active total" stroke={CHART_COLORS.success} strokeWidth={2.5} dot={false}/>
    </ComposedChart>
  </ResponsiveContainer>
);

// Attendance stacked bar
const AttendanceChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
      <XAxis dataKey="day" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <Tooltip content={<TT />} />
      <Bar dataKey="present" name="Present" stackId="a" fill={CHART_COLORS.success} radius={[0,0,0,0]}/>
      <Bar dataKey="late" name="Late" stackId="a" fill={CHART_COLORS.warning} />
      <Bar dataKey="absent" name="Absent" stackId="a" fill={CHART_COLORS.danger} radius={[4,4,0,0]}/>
    </BarChart>
  </ResponsiveContainer>
);

// Debt donut
const DebtDonut = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <PieChart>
      <Pie data={data} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} cornerRadius={4}>
        {data.map((_, i) => <Cell key={i} fill={[CHART_COLORS.success, CHART_COLORS.warning, "oklch(0.68 0.16 35)", CHART_COLORS.danger][i % 4]} />)}
      </Pie>
      <Tooltip content={<TT fmt={(v) => formatUZS(v)} />}/>
    </PieChart>
  </ResponsiveContainer>
);

// Trial funnel
const TrialFunnel = ({ data }) => {
  // Custom funnel via stacked horizontal bars to be safer
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((row, i) => {
        const pct = (row.value / max) * 100;
        const colors = [CHART_COLORS.primary, CHART_COLORS.info, CHART_COLORS.success, CHART_COLORS.warning];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 100, fontSize: 12.5, fontWeight: 600, color: "var(--fg-2)" }}>{row.stage}</div>
            <div style={{ flex: 1, height: 24, background: "var(--bg-2)", borderRadius: 6, position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", inset: 0, width: `${pct}%`,
                background: colors[i % colors.length],
                borderRadius: 6,
                display: "flex", alignItems: "center", paddingLeft: 10,
                color: "#fff", fontSize: 12, fontWeight: 600,
                fontFamily: "var(--font-mono)",
                transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
              }}>{row.value}</div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", width: 50, textAlign: "right" }}>
              {i === 0 ? "100%" : `${Math.round((row.value / data[0].value) * 100)}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Course mix pie
const CourseMixPie = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
        {data.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
      </Pie>
      <Tooltip content={<TT />} />
    </PieChart>
  </ResponsiveContainer>
);

// Trial daily area
const TrialDaily = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="gradBook" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.info} stopOpacity={0.3} />
          <stop offset="100%" stopColor={CHART_COLORS.info} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
          <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
      <XAxis dataKey="day" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
      <Tooltip content={<TT />}/>
      <Area type="monotone" dataKey="booked" name="Booked" stroke={CHART_COLORS.info} strokeWidth={2} fill="url(#gradBook)"/>
      <Area type="monotone" dataKey="attended" name="Attended" stroke={CHART_COLORS.primary} strokeWidth={2} fill="none"/>
      <Area type="monotone" dataKey="converted" name="Converted" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#gradConv)"/>
    </AreaChart>
  </ResponsiveContainer>
);

// Mini sparkline
const Spark = ({ data, tone = "primary" }) => (
  <ResponsiveContainer width="100%" height={40}>
    <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS[tone]} stopOpacity={0.3}/>
          <stop offset="100%" stopColor={CHART_COLORS[tone]} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={CHART_COLORS[tone]} strokeWidth={1.75} fill={`url(#spark-${tone})`}/>
    </AreaChart>
  </ResponsiveContainer>
);

// Expense breakdown horizontal bar
const ExpenseBars = ({ data }) => (
  <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false}/>
      <XAxis type="number" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatUZS(v)}/>
      <YAxis type="category" dataKey="name" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={90}/>
      <Tooltip content={<TT fmt={(v) => formatUZS(v)}/>}/>
      <Bar dataKey="value" fill={CHART_COLORS.warning} radius={[0,6,6,0]} barSize={18}/>
    </BarChart>
  </ResponsiveContainer>
);

Object.assign(window, {
  RevenueChart, StudentGrowthChart, AttendanceChart, DebtDonut,
  TrialFunnel, CourseMixPie, TrialDaily, Spark, ExpenseBars,
  CHART_COLORS,
});
