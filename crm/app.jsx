// Main app — routing between pages (now supports nested routes like "finance/transactions")
const { motion: m7, AnimatePresence: AP7 } = window.framerMotion;

function App() {
  const [route, setRoute] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // expose setter for SubNav components to navigate
  useEffect(() => { window.__setRoute = setRoute; }, []);

  // Initial fake load + when changing the top-level page
  const topLevel = route.split("/")[0];
  useEffect(() => {
    setLoading(true);
    setError(false);
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [topLevel]);

  // Reset search when top-level page changes
  useEffect(() => { setSearch(""); }, [topLevel]);

  const sub = route.includes("/") ? route.split("/")[1] : null;

  let content;
  if (error) {
    content = (
      <div className="page">
        <Card>
          <ErrorState
            title="Sahifa yuklanmadi"
            message="Ma'lumotlarni olishda xatolik. Yana urinib ko'ring."
            onRetry={() => { setError(false); setLoading(true); setTimeout(() => setLoading(false), 500); }}
          />
        </Card>
      </div>
    );
  } else if (loading) {
    content = <PageLoading/>;
  } else if (topLevel === "dashboard") content = <DashboardPage loading={false}/>;
  else if (topLevel === "leads") content = <KanbanPage search={search}/>;
  else if (topLevel === "students") content = <StudentsPage search={search}/>;
  else if (topLevel === "groups") content = <GroupsPage search={search}/>;
  else if (topLevel === "teachers") content = <TeachersPage search={search}/>;
  else if (topLevel === "finance") content = <FinancePage search={search} sub={sub}/>;
  else if (topLevel === "reports") content = <ReportsPage sub={sub}/>;
  else if (topLevel === "settings") content = <SettingsPage sub={sub}/>;
  else if (topLevel === "archive") content = <ArchivePage sub={sub}/>;

  return (
    <div className="app" data-screen-label={`Page: ${route}`}>
      <Sidebar current={route} onNav={setRoute}/>
      <div className="main">
        <Topbar current={route} search={search} onSearch={setSearch}/>
        <AP7 mode="wait">
          <m7.div
            key={route}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1 }}
          >
            {content}
          </m7.div>
        </AP7>
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Skeleton w={180} h={24} style={{ marginBottom: 8 }}/>
          <Skeleton w={260} h={14}/>
        </div>
      </div>
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="kpi" key={i}>
            <Skeleton w={100} h={12}/>
            <Skeleton w={140} h={26}/>
            <Skeleton w={110} h={14}/>
          </div>
        ))}
      </div>
      <SkeletonTable rows={6} cols={5}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
