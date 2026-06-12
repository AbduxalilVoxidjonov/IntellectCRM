// UI primitives + shared components (icons, buttons, badges, skeletons, modal, empty/error states)
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { motion, AnimatePresence } = window.framerMotion || {};

// ===== Icons (inline SVG, 18px default) =====
const Icon = ({ name, size = 18, stroke = 1.75 }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    kanban: <><rect x="3" y="3" width="6" height="18" rx="1.5"/><rect x="10" y="3" width="6" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/></>,
    finance: <><path d="M3 7h18M3 7v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7M3 7l3-4h12l3 4"/><path d="M9 12h6M12 10v4"/></>,
    students: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="10" r="2.5"/><path d="M16 14c2 0 5 1.4 5 4"/></>,
    attendance: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M8 13l2 2 4-4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 8H4c0-2 2-3 2-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <><path d="M5 12h14"/></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
    sort: <><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/></>,
    more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    chevronL: <><path d="M15 6l-6 6 6 6"/></>,
    chevronR: <><path d="M9 6l6 6-6 6"/></>,
    chevronD: <><path d="M6 9l6 6 6-6"/></>,
    chevronU: <><path d="M6 15l6-6 6 6"/></>,
    trendUp: <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
    trendDn: <><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M9 14c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5-1.3-2-3-2.5-3-1-3-2.5 1.3-2.5 3-2.5 3 1 3 2.5M12 7v2M12 15v2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="10" r="2.5"/><path d="M16 14c2 0 5 1.4 5 4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    book: <><path d="M4 4h11a4 4 0 0 1 4 4v12H7a3 3 0 0 0-3 3V4z"/><path d="M4 20a3 3 0 0 1 3-3h12"/></>,
    spark: <><path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6l-2 2M20.4 20.4l-2-2M5.6 18.4l-2-2M20.4 5.6l-2 2"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>,
    inbox: <><path d="M3 13l3-9h12l3 9M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6M3 13h5l1 3h6l1-3h5"/></>,
    warn: <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 16-5.7M21 4v5h-5"/><path d="M21 12a9 9 0 0 1-16 5.7M3 20v-5h5"/></>,
    download: <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    phone: <><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></>,
    trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    flag: <><path d="M4 21V4M4 4h14l-3 4 3 4H4"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></>,
    grip: <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
  };
  return <svg {...props}>{paths[name] || null}</svg>;
};

// ===== Buttons =====
const Button = ({ variant = "secondary", size, icon, iconRight, children, ...rest }) => (
  <button className={`btn btn-${variant}${size === "sm" ? " btn-sm" : ""}`} {...rest}>
    {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
  </button>
);

const IconButton = ({ icon, dot, ...rest }) => (
  <button className="icon-btn" {...rest}>
    <Icon name={icon} size={16} />
    {dot && <span className="dot" />}
  </button>
);

// ===== Badge =====
const Badge = ({ tone, dot, children }) => (
  <span className={`badge ${tone || ""}`}>
    {dot && <span className="dot" />}
    {children}
  </span>
);

// ===== Card =====
const Card = ({ title, sub, actions, children, tight, style }) => (
  <div className={`card ${tight ? "card-tight" : ""}`} style={style}>
    {(title || actions) && (
      <div className="card-header">
        <div>
          {title && <h3>{title}</h3>}
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions}
      </div>
    )}
    {!tight ? <div className="card-body">{children}</div> : children}
  </div>
);

// ===== Skeleton =====
const Skeleton = ({ w = "100%", h = 14, r = 6, style }) => (
  <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

const SkeletonTable = ({ rows = 6, cols = 5 }) => (
  <div className="card card-tight">
    <table className="table">
      <thead>
        <tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><Skeleton w={80} /></th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                {c === 0
                  ? <div className="cell-user"><Skeleton w={28} h={28} r={14}/><div style={{display:"flex",flexDirection:"column",gap:4}}><Skeleton w={100}/><Skeleton w={70} h={10}/></div></div>
                  : <Skeleton w={70 + (c * 10) % 50}/>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ===== Empty / Error =====
const EmptyState = ({ icon = "inbox", title = "No data yet", message = "When data is available it'll show up here.", action }) => (
  <div className="state">
    <div className="state-icon"><Icon name={icon} size={22}/></div>
    <h4>{title}</h4>
    <p>{message}</p>
    {action}
  </div>
);

const ErrorState = ({ title = "Something went wrong", message = "We couldn't load this. Try again in a moment.", onRetry }) => (
  <div className="state error">
    <div className="state-icon"><Icon name="warn" size={22}/></div>
    <h4>{title}</h4>
    <p>{message}</p>
    {onRetry && <Button variant="secondary" icon="refresh" onClick={onRetry} size="sm">Try again</Button>}
  </div>
);

// ===== Modal =====
const Modal = ({ open, onClose, title, children, footer, width = 540 }) => {
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="modal" style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="modal-header">
              <h3>{title}</h3>
              <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ===== Avatar =====
const Avatar = ({ name, size = 28 }) => {
  const { initials, avatarColor } = window.MockData;
  return (
    <div className="avatar" style={{
      width: size, height: size, background: avatarColor(name),
      fontSize: size * 0.4,
    }}>
      {initials(name)}
    </div>
  );
};

// ===== Helpers =====
const formatUZS = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${(abs/1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs/1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs/1e3).toFixed(0)}K`;
  return `${sign}${abs}`;
};
const formatUZSExact = (n) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US")} so'm`;

// ===== Tabs =====
const Tabs = ({ value, onChange, options }) => (
  <div className="tabs" role="tablist">
    {options.map(o => (
      <button key={o.value}
        className={`tab ${value === o.value ? "active" : ""}`}
        onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

// Export to global
Object.assign(window, {
  Icon, Button, IconButton, Badge, Card, Skeleton, SkeletonTable,
  EmptyState, ErrorState, Modal, Avatar, Tabs,
  formatUZS, formatUZSExact,
});
