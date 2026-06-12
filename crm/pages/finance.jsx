// Finance — refactored to expose sub-routes (transactions, revenue, expenses, profit, debts)
const { motion: mF } = window.framerMotion;

const FinanceTransactionsView = ({ search }) => {
  const D = window.MockData;
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 8;

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return D.TRANSACTIONS.filter(t => {
      if (tab !== "all" && t.type !== tab) return false;
      if (!q) return true;
      return t.party.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    });
  }, [tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [tab, search]);

  return (
    <Card
      title="Tranzaksiyalar"
      sub={`${filtered.length} ta yozuv`}
      tight
      actions={
        <div className="row">
          <Tabs value={tab} onChange={setTab} options={[
            { value: "all", label: "Barchasi" },
            { value: "payment", label: "To'lovlar" },
            { value: "refund", label: "Qaytarishlar" },
            { value: "expense", label: "Xarajatlar" },
          ]}/>
          <Button variant="secondary" size="sm" icon="filter">Filtr</Button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <EmptyState icon="inbox" title="Tranzaksiya topilmadi" message="Filtr yoki qidiruvni o'zgartirib ko'ring."/>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Sana</th><th>Tomonlar</th><th>Kategoriya</th><th>Usul</th><th>Holat</th><th className="num">Summa</th></tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id}>
                    <td className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.date}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.party}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.id} · {t.course}</div>
                    </td>
                    <td>
                      <Badge tone={t.type === "expense" ? "amber" : (t.type === "refund" ? "red" : "violet")}>
                        {t.category}
                      </Badge>
                    </td>
                    <td><span style={{ fontSize: 12.5 }}>{t.method}</span></td>
                    <td><Badge tone={t.status === "completed" ? "green" : "amber"} dot>{t.status === "completed" ? "Yakunlangan" : "Kutilmoqda"}</Badge></td>
                    <td className="num" style={{ fontWeight: 600, color: t.amount < 0 ? "var(--danger)" : "var(--success)" }}>
                      {t.amount < 0 ? "−" : "+"}{Math.abs(t.amount).toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <div>Ko'rsatilmoqda <strong>{(page-1)*perPage + 1}</strong>–<strong>{Math.min(page*perPage, filtered.length)}</strong> / <strong>{filtered.length}</strong></div>
            <div className="pages">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><Icon name="chevronL" size={12}/></button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} className={`pg-btn ${page === i+1 ? "active" : ""}`} onClick={() => setPage(i+1)}>{i+1}</button>
              ))}
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><Icon name="chevronR" size={12}/></button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

const FinanceRevenueView = () => {
  const D = window.MockData;
  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Bu oy daromad" value="234.8M so'm" delta={12.4} deltaLabel="o'tgan oyga nisbatan" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
        <KPICard label="O'rtacha bitim" value="650K so'm" delta={4.1} deltaLabel="oxirgi 30 kun" icon="trendUp" spark={D.KPI_SPARK.trials} sparkTone="success"/>
        <KPICard label="To'lov sonlari" value="361" delta={8.2} deltaLabel="bu oy" icon="finance" spark={D.KPI_SPARK.students} sparkTone="info"/>
        <KPICard label="Qaytarishlar" value="6.4M so'm" delta={-12.3} deltaLabel="kamaygan" icon="refresh" spark={D.KPI_SPARK.debt} sparkTone="warning"/>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Daromad dinamikasi" sub="Yillik trend"><RevenueChart data={D.REVENUE_SERIES} fmt={formatUZS}/></Card>
        <Card title="Kurslar bo'yicha daromad" sub="Bu oy">
          <CourseMixPie data={D.COURSE_MIX.map(c => ({ name: c.name, value: c.value * 50000 }))}/>
        </Card>
      </div>
    </>
  );
};

const FinanceExpensesView = () => {
  const D = window.MockData;
  const expenseBreakdown = useMemo(() => {
    const map = {};
    D.TRANSACTIONS.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, []);
  const totalExp = expenseBreakdown.reduce((a, e) => a + e.value, 0);
  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Bu oy xarajat" value={formatUZS(totalExp)} delta={4.1} deltaLabel="o'tgan oyga nisbatan" icon="trendDn" spark={D.KPI_SPARK.debt} sparkTone="warning"/>
        <KPICard label="Eng katta xarajat" value={expenseBreakdown[0]?.name || "—"} delta={0} deltaLabel={`${formatUZS(expenseBreakdown[0]?.value || 0)}`} icon="warn" spark={D.KPI_SPARK.trials} sparkTone="danger"/>
        <KPICard label="Kategoriyalar" value={expenseBreakdown.length.toString()} delta={0} deltaLabel="faol" icon="filter" spark={D.KPI_SPARK.students} sparkTone="info"/>
        <KPICard label="Foyda nisbati" value="38.4%" delta={2.2} deltaLabel="daromadga nisbatan" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="success"/>
      </div>
      <div className="grid grid-2">
        <Card title="Kategoriyalar bo'yicha" sub="Bu oydagi xarajatlar">
          {expenseBreakdown.length ? <ExpenseBars data={expenseBreakdown}/> : <EmptyState title="Xarajat yo'q" message="Yozilgan xarajatlar bu yerda paydo bo'ladi."/>}
        </Card>
        <Card title="Daromad vs xarajat" sub="Oylik">
          <RevenueChart data={D.REVENUE_SERIES} fmt={formatUZS}/>
        </Card>
      </div>
    </>
  );
};

const FinanceProfitView = () => {
  const D = window.MockData;
  const profitData = D.REVENUE_SERIES.map(r => ({ month: r.month, profit: r.profit }));
  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Sof foyda (bu oy)" value="90.2M so'm" delta={14.7} deltaLabel="o'tgan oyga nisbatan" icon="trendUp" spark={D.KPI_SPARK.students} sparkTone="success"/>
        <KPICard label="Marjinallik" value="38.4%" delta={2.2} deltaLabel="o'sgan" icon="target" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
        <KPICard label="EBITDA" value="112.5M so'm" delta={11.0} deltaLabel="bu oy" icon="finance" spark={D.KPI_SPARK.students} sparkTone="info"/>
        <KPICard label="Yillik prognoz" value="1.2B so'm" delta={9.4} deltaLabel="loyiha" icon="spark" spark={D.KPI_SPARK.revenue} sparkTone="warning"/>
      </div>
      <Card title="Foyda dinamikasi" sub="Yillik trend">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={profitData}>
            <defs>
              <linearGradient id="gradProfitFin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.32}/>
                <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
            <XAxis dataKey="month" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatUZS}/>
            <Tooltip content={<TT fmt={formatUZS}/>}/>
            <Area type="monotone" dataKey="profit" name="Foyda" stroke={CHART_COLORS.success} strokeWidth={2.5} fill="url(#gradProfitFin)"/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
};

const FinanceDebtsView = () => {
  const D = window.MockData;
  const debtStudents = D.STUDENTS.filter(s => s.balance < 0).sort((a, b) => a.balance - b.balance).slice(0, 12);
  const totalDebt = D.STUDENTS.reduce((a, s) => a + (s.balance < 0 ? -s.balance : 0), 0);

  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Jami qarz" value={formatUZS(totalDebt)} delta={-5.6} deltaLabel="kamaygan" icon="warn" spark={D.KPI_SPARK.debt} sparkTone="danger"/>
        <KPICard label="Qarzdorlar soni" value={D.STUDENTS.filter(s => s.balance < 0).length.toString()} delta={-2.4} deltaLabel="oxirgi 30 kun" icon="users" spark={D.KPI_SPARK.trials} sparkTone="warning"/>
        <KPICard label="60+ kunlik" value="3" delta={-1} deltaLabel="kritik holatda" icon="trendDn" spark={D.KPI_SPARK.debt} sparkTone="danger"/>
        <KPICard label="O'rtacha qarz" value="575K so'm" delta={-3.1} deltaLabel="bir kishiga" icon="finance" spark={D.KPI_SPARK.revenue} sparkTone="info"/>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Qarz davri bo'yicha" sub="Aging analysis"><DebtDonut data={D.DEBT_BUCKETS}/></Card>
        <Card title="Davriy taqsimot" sub="Bucket bo'yicha summa">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {D.DEBT_BUCKETS.map((b, i) => (
              <div key={i} className="spread" style={{ padding: "8px 12px", background: "var(--bg-2)", borderRadius: 8 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{b.name}</strong>
                  <div className="muted" style={{ fontSize: 11.5 }}>{b.value} ta talaba</div>
                </div>
                <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{formatUZS(b.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="Qarzdor talabalar" sub="Eng katta qarz birinchi" tight>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Talaba</th><th>Kurs</th><th>O'qituvchi</th><th className="num">Qarz</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {debtStudents.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="cell-user">
                      <div className="avatar" style={{ background: D.avatarColor(s.name) }}>{D.initials(s.name)}</div>
                      <div className="meta"><strong>{s.name}</strong><span>{s.phone}</span></div>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 12.5 }}>{s.course}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{s.teacher}</span></td>
                  <td className="num" style={{ fontWeight: 600, color: "var(--danger)" }}>−{Math.abs(s.balance).toLocaleString("en-US")}</td>
                  <td><Badge tone="red" dot>{s.status}</Badge></td>
                  <td><Button variant="secondary" size="sm" icon="phone">Bog'lanish</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
};

// Finance hub — chooses view based on current route
const FinancePage = ({ search, sub }) => {
  // sub can be: undefined, "transactions", "revenue", "expenses", "profit", "debts"
  const D = window.MockData;
  const view = sub || "overview";

  const items = [
    { id: "overview", label: "Umumiy", icon: "dashboard" },
    { id: "transactions", label: "Tranzaksiyalar", icon: "finance", badge: D.TRANSACTIONS.length, tone: "violet" },
    { id: "revenue", label: "Daromadlar", icon: "trendUp" },
    { id: "expenses", label: "Xarajatlar", icon: "trendDn" },
    { id: "profit", label: "Foyda", icon: "target" },
    { id: "debts", label: "Qarzdorlar", icon: "warn", badge: D.STUDENTS.filter(s => s.balance < 0).length, tone: "red" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Moliya</h2>
          <p className="page-sub">Daromadlar, xarajatlar, foyda va qarzdorlar — bir joyda.</p>
        </div>
        <div className="row">
          <Button variant="secondary" icon="download" size="sm">Eksport CSV</Button>
          <Button variant="primary" icon="plus" size="sm">Yangi tranzaksiya</Button>
        </div>
      </div>

      <SubNav
        items={items}
        current={view}
        onChange={(id) => window.__setRoute(id === "overview" ? "finance" : `finance/${id}`)}
      />

      <mF.div key={view}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {view === "overview" && <FinanceOverview/>}
        {view === "transactions" && <FinanceTransactionsView search={search}/>}
        {view === "revenue" && <FinanceRevenueView/>}
        {view === "expenses" && <FinanceExpensesView/>}
        {view === "profit" && <FinanceProfitView/>}
        {view === "debts" && <FinanceDebtsView/>}
      </mF.div>
    </div>
  );
};

const FinanceOverview = () => {
  const D = window.MockData;
  const revenue = D.TRANSACTIONS.filter(t => t.type === "payment").reduce((a, t) => a + t.amount, 0);
  const expenses = D.TRANSACTIONS.filter(t => t.type === "expense").reduce((a, t) => a + Math.abs(t.amount), 0);
  const profit = revenue - expenses;
  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Daromad (may)" value={formatUZS(revenue)} delta={9.2} deltaLabel="aprelga nisbatan" icon="money" spark={D.KPI_SPARK.revenue} sparkTone="primary"/>
        <KPICard label="Xarajat (may)" value={formatUZS(expenses)} delta={4.1} deltaLabel="aprelga nisbatan" icon="trendDn" spark={D.KPI_SPARK.debt} sparkTone="warning"/>
        <KPICard label="Sof foyda" value={formatUZS(profit)} delta={14.7} deltaLabel="marja 38.4%" icon="trendUp" spark={D.KPI_SPARK.students} sparkTone="success"/>
        <KPICard label="Qarzlar" value="15.5M so'm" delta={-5.6} deltaLabel="27 talaba" icon="warn" spark={D.KPI_SPARK.debt} sparkTone="info"/>
      </div>
      <div className="grid grid-2">
        <Card title="Daromad va xarajat trendi" sub="Oylik"><RevenueChart data={D.REVENUE_SERIES} fmt={formatUZS}/></Card>
        <Card title="Qarz aging" sub="Kategoriya bo'yicha">
          <DebtDonut data={D.DEBT_BUCKETS}/>
        </Card>
      </div>
    </>
  );
};

window.FinancePage = FinancePage;
