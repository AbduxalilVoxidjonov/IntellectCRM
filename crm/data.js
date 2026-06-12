// Mock data for Intellect CRM
// Educational center / language school context

const COURSES = [
  "IELTS Advanced", "General English", "SAT Prep", "Math Olympiad",
  "Frontend Dev", "Python Basics", "Russian B1", "Kids English"
];
const TEACHERS = ["Aziza M.", "Bekzod K.", "Madina R.", "Sardor U.", "Nigora T.", "Jasur D."];
const SOURCES = ["Instagram", "Telegram", "Friend referral", "Google Ads", "Walk-in", "Website"];
const TAGS_POOL = [
  { label: "Hot", tone: "red" },
  { label: "Trial booked", tone: "violet" },
  { label: "Returning", tone: "blue" },
  { label: "VIP", tone: "amber" },
  { label: "Parent contact", tone: "green" },
  { label: "Online", tone: "blue" },
  { label: "Group", tone: "violet" },
  { label: "Individual", tone: "amber" },
];

const FIRST_NAMES = [
  "Aziza","Bekzod","Dilshod","Elnura","Farrukh","Gulnoza","Hamid","Iroda",
  "Javohir","Kamila","Laziz","Madina","Nodira","Oybek","Parizoda","Rustam",
  "Sevinch","Temur","Umida","Vohid","Xolida","Yusuf","Zarina","Alisher",
  "Diyora","Sherzod","Mukhlisa","Otabek","Sitora","Komron"
];
const LAST_NAMES = [
  "Karimov","Saidova","Yusupov","Rakhimova","Tursunov","Mirzaeva",
  "Nazarov","Ergasheva","Hakimov","Sobirova","Akhmedov","Juraeva",
  "Iskandarov","Maxmudova","Qodirov","Tashkentova","Olimov","Rashidova"
];

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = rng(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.floor(rand() * (b - a + 1)) + a;
const initials = (name) => name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
const avatarColor = (str) => {
  const hues = [12, 30, 50, 90, 140, 180, 220, 260, 300, 340];
  const i = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length;
  return `oklch(0.65 0.14 ${hues[i]})`;
};

// ===== Students =====
const STUDENTS = Array.from({ length: 87 }, (_, i) => {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[i % LAST_NAMES.length];
  const name = `${first} ${last}`;
  const course = pick(COURSES);
  const teacher = pick(TEACHERS);
  const phone = `+998 ${between(90,99)} ${between(100,999)}-${String(between(10,99))}-${String(between(10,99))}`;
  const balance = between(-3, 8) * 50000;
  const statuses = ["Active", "On hold", "Trial", "Graduated"];
  const status = balance < 0 ? "Active" : pick(statuses);
  return {
    id: `STU-${1000 + i}`,
    name, course, teacher, phone, balance,
    status,
    group: `${course.split(" ")[0]}-${between(1, 6)}`,
    joined: `2024-${String(between(1,12)).padStart(2,"0")}-${String(between(1,28)).padStart(2,"0")}`,
    attendance: between(72, 100),
    age: between(8, 28),
  };
});

// ===== Leads (Kanban) =====
const STAGES = [
  { id: "new", name: "New", color: "oklch(0.7 0.05 270)" },
  { id: "contacted", name: "Contacted", color: "oklch(0.65 0.13 230)" },
  { id: "trial", name: "Trial scheduled", color: "oklch(0.65 0.15 70)" },
  { id: "negotiation", name: "Negotiation", color: "oklch(0.55 0.18 282)" },
  { id: "won", name: "Won", color: "oklch(0.62 0.14 158)" },
  { id: "lost", name: "Lost", color: "oklch(0.6 0.2 25)" },
];

const LEADS = Array.from({ length: 26 }, (_, i) => {
  const first = FIRST_NAMES[(i * 3) % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 5) % LAST_NAMES.length];
  const name = `${first} ${last}`;
  const stage = pick(STAGES).id;
  const value = between(2, 18) * 100000;
  const tagsN = between(1, 3);
  const tags = Array.from({ length: tagsN }, () => pick(TAGS_POOL))
    .filter((t, idx, arr) => arr.findIndex(x => x.label === t.label) === idx);
  return {
    id: `LD-${2000 + i}`,
    name,
    course: pick(COURSES),
    source: pick(SOURCES),
    phone: `+998 ${between(90,99)} ${between(100,999)}-${String(between(10,99))}-${String(between(10,99))}`,
    stage,
    value,
    tags,
    daysInStage: between(0, 14),
    owner: pick(TEACHERS),
  };
});

// ===== Transactions =====
const TX_TYPES = ["payment", "refund", "expense"];
const EXPENSE_CATS = ["Salary", "Rent", "Utilities", "Marketing", "Supplies", "Software"];
const TRANSACTIONS = Array.from({ length: 32 }, (_, i) => {
  const type = i < 22 ? "payment" : (i < 25 ? "refund" : "expense");
  const amount = type === "expense" ? -between(5, 80) * 100000
               : type === "refund" ? -between(1, 5) * 100000
               : between(3, 15) * 100000;
  const stu = pick(STUDENTS);
  return {
    id: `TX-${5000 + i}`,
    date: `2026-05-${String(between(1, 19)).padStart(2,"0")}`,
    type,
    amount,
    category: type === "expense" ? pick(EXPENSE_CATS) : "Tuition",
    party: type === "expense" ? pick(EXPENSE_CATS) + " Co." : stu.name,
    course: type === "expense" ? "—" : stu.course,
    method: pick(["Card", "Cash", "Bank transfer", "Payme", "Click"]),
    status: pick(["completed", "completed", "completed", "pending"]),
  };
});

// ===== Time series =====
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const REVENUE_SERIES = months.map((m, i) => ({
  month: m,
  revenue: 18000000 + i * 1800000 + between(-2000000, 3000000),
  expense: 11000000 + i * 800000 + between(-1500000, 1500000),
}));
REVENUE_SERIES.forEach(d => d.profit = d.revenue - d.expense);

const STUDENT_GROWTH = months.map((m, i) => ({
  month: m,
  active: 240 + i * 22 + between(-10, 20),
  new: between(18, 42),
  churned: between(2, 12),
}));

const ATTENDANCE_WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => ({
  day: d,
  present: between(180, 240),
  late: between(8, 22),
  absent: between(10, 36),
}));

const DEBT_BUCKETS = [
  { name: "0–7 days", value: 12, amount: 2400000 },
  { name: "8–30 days", value: 8, amount: 4100000 },
  { name: "31–60 days", value: 4, amount: 3200000 },
  { name: "60+ days", value: 3, amount: 5800000 },
];

const TRIAL_FUNNEL = [
  { stage: "Booked", value: 142 },
  { stage: "Attended", value: 108 },
  { stage: "Followed up", value: 92 },
  { stage: "Converted", value: 64 },
];

const COURSE_MIX = COURSES.slice(0, 6).map((c, i) => ({
  name: c, value: between(40, 180)
}));

// hourly trial heat for last 14 days (for trial analytics)
const TRIAL_DAILY = Array.from({ length: 14 }, (_, i) => ({
  day: `D-${14 - i}`,
  booked: between(6, 18),
  attended: between(4, 14),
  converted: between(1, 9),
}));

// Tiny sparkline data for KPIs
const sparkSeries = (n, base, vol) => Array.from({ length: n }, (_, i) => ({
  i, v: base + Math.sin(i / 1.4) * vol + between(-vol/2, vol/2)
}));

const KPI_SPARK = {
  revenue: sparkSeries(14, 100, 18),
  students: sparkSeries(14, 60, 8),
  trials: sparkSeries(14, 40, 12),
  debt: sparkSeries(14, 50, 14),
};

// Calendar events
const CAL_EVENTS = {};
for (let d = 1; d <= 31; d++) {
  if (rand() < 0.7) {
    const c = [];
    if (rand() < 0.6) c.push({ label: `${between(3,8)} classes`, tone: "violet" });
    if (rand() < 0.4) c.push({ label: `${between(1,4)} trials`, tone: "amber" });
    if (rand() < 0.2) c.push({ label: "Holiday", tone: "red" });
    CAL_EVENTS[d] = c;
  }
}

// Class roster for attendance quick marking
const TODAY_CLASSES = [
  { id: "C1", name: "IELTS Advanced · Grp 3", time: "09:00 – 10:30", teacher: "Aziza M.", room: "Room 204", students: 14 },
  { id: "C2", name: "Frontend Dev · Grp 1", time: "11:00 – 13:00", teacher: "Bekzod K.", room: "Room 301", students: 12 },
  { id: "C3", name: "SAT Prep · Grp 2", time: "14:00 – 15:30", teacher: "Madina R.", room: "Room 102", students: 9 },
  { id: "C4", name: "Kids English · Grp 5", time: "16:00 – 17:00", teacher: "Sardor U.", room: "Room 110", students: 16 },
  { id: "C5", name: "Python Basics · Grp 4", time: "18:00 – 19:30", teacher: "Nigora T.", room: "Room 205", students: 11 },
];

// Roster for the active class
const CLASS_ROSTER = STUDENTS.slice(0, 14).map(s => ({
  id: s.id, name: s.name, status: null
}));

window.MockData = {
  COURSES, TEACHERS, SOURCES, TAGS_POOL,
  STUDENTS, STAGES, LEADS, TRANSACTIONS,
  REVENUE_SERIES, STUDENT_GROWTH, ATTENDANCE_WEEK, DEBT_BUCKETS,
  TRIAL_FUNNEL, COURSE_MIX, TRIAL_DAILY,
  KPI_SPARK, CAL_EVENTS, TODAY_CLASSES, CLASS_ROSTER,
  initials, avatarColor,
};
