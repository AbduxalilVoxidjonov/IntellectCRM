// CRM Kanban with HTML5 drag & drop + live updates
const { motion: m3, AnimatePresence: AP3 } = window.framerMotion;

const LeadCard = ({ lead, onDragStart, onDragEnd, isDragging }) => {
  const D = window.MockData;
  return (
    <m3.div
      layout
      layoutId={lead.id}
      className={`lead-card ${isDragging ? "dragging" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="lead-top">
        <div className="row" style={{ gap: 8 }}>
          <Avatar name={lead.name} size={28}/>
          <div>
            <div className="lead-name">{lead.name}</div>
            <div className="lead-meta">{lead.course}</div>
          </div>
        </div>
        <button className="btn-ghost btn btn-sm" style={{ padding: 4 }}>
          <Icon name="more" size={14}/>
        </button>
      </div>
      <div className="lead-tags">
        {lead.tags.map((t, i) => <Badge tone={t.tone} key={i}>{t.label}</Badge>)}
      </div>
      <div className="lead-foot">
        <div className="row" style={{ gap: 6 }}>
          <Icon name="phone" size={11}/>
          <span style={{ fontSize: 11 }}>{lead.source}</span>
        </div>
        <span className="lead-value">{formatUZS(lead.value)}</span>
      </div>
    </m3.div>
  );
};

const KanbanPage = ({ search }) => {
  const D = window.MockData;
  const [leads, setLeads] = useState(D.LEADS);
  const [filter, setFilter] = useState("all");
  const [dragging, setDragging] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [pulse, setPulse] = useState(null);

  // Simulated live update — periodically nudge a lead's daysInStage and occasionally move one
  useEffect(() => {
    const t = setInterval(() => {
      setLeads(prev => {
        const idx = Math.floor(Math.random() * prev.length);
        const next = [...prev];
        next[idx] = { ...next[idx], daysInStage: next[idx].daysInStage + 1 };
        setPulse(next[idx].id);
        setTimeout(() => setPulse(null), 1500);
        return next;
      });
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (filter !== "all" && !l.tags.some(t => t.label.toLowerCase() === filter)) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) ||
        l.course.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q);
    });
  }, [leads, filter, search]);

  const byStage = useMemo(() => {
    const map = {};
    D.STAGES.forEach(s => map[s.id] = []);
    filtered.forEach(l => map[l.stage]?.push(l));
    return map;
  }, [filtered]);

  const onDragStart = (e, lead) => {
    setDragging(lead.id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", lead.id); } catch(_) {}
  };
  const onDragEnd = () => { setDragging(null); setDragOverCol(null); };
  const onDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(stage);
  };
  const onDrop = (e, stageId) => {
    e.preventDefault();
    const id = dragging || (e.dataTransfer.getData && e.dataTransfer.getData("text/plain"));
    if (!id) return;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: stageId, daysInStage: 0 } : l));
    setDragging(null);
    setDragOverCol(null);
  };

  const tagFilters = [
    { id: "all", label: "All leads" },
    { id: "hot", label: "Hot" },
    { id: "trial booked", label: "Trial booked" },
    { id: "vip", label: "VIP" },
    { id: "online", label: "Online" },
  ];

  // Stage stats
  const totalValue = leads.reduce((a, l) => a + (l.stage === "won" ? l.value : 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Lead pipeline</h2>
          <p className="page-sub">{leads.length} leads · {formatUZS(totalValue)} won this period</p>
        </div>
        <div className="row">
          <div className="live-dot"><span className="pulse"/> Live updates on</div>
          <Button variant="secondary" icon="filter" size="sm">Filters</Button>
          <Button variant="primary" icon="plus" size="sm">New lead</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="left">
          {tagFilters.map(t => (
            <button
              key={t.id}
              className={`filter-chip ${filter === t.id ? "active" : ""}`}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="right">
          <span className="muted" style={{ fontSize: 12 }}>Owner:</span>
          <button className="filter-chip">All teachers <Icon name="chevronD" size={12}/></button>
          <button className="filter-chip">This month <Icon name="chevronD" size={12}/></button>
        </div>
      </div>

      <div className="kanban">
        {D.STAGES.map(stage => {
          const cards = byStage[stage.id] || [];
          const value = cards.reduce((a, l) => a + l.value, 0);
          return (
            <div className="kanban-col" key={stage.id}>
              <div className="kanban-col-head">
                <div className="name">
                  <span className="stage-dot" style={{ background: stage.color }}/>
                  {stage.name}
                </div>
                <span className="count">{cards.length}</span>
                <span className="spacer"/>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{formatUZS(value)}</span>
              </div>
              <div
                className={`kanban-col-body ${dragOverCol === stage.id ? "drag-over" : ""}`}
                onDragOver={(e) => onDragOver(e, stage.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => onDrop(e, stage.id)}
              >
                <AP3 mode="popLayout">
                  {cards.length === 0 ? (
                    <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                      Drop leads here
                    </div>
                  ) : cards.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isDragging={dragging === lead.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </AP3>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "center" }}>
                  <Icon name="plus" size={12}/> Add lead
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AP3>
        {pulse && (
          <m3.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24,
              background: "var(--surface)", border: "1px solid var(--border)",
              padding: "10px 14px", borderRadius: 10,
              boxShadow: "var(--shadow-pop)",
              fontSize: 12.5, display: "flex", alignItems: "center", gap: 8,
              zIndex: 50,
            }}
          >
            <span className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }}/>
            <strong>Lead updated</strong> <span className="muted">· 1 stage refresh</span>
          </m3.div>
        )}
      </AP3>
    </div>
  );
};

window.KanbanPage = KanbanPage;
