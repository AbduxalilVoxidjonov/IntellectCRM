// Tizimdagi barcha asosiy tiplar

/**
 * Tizim rollari.
 * - `superadmin` — tizim egasi: admin'ning hamma huquqlari + qulflangan amallarni (masalan,
 *   o'quv yili boshlangach guruhlashni) istalgan vaqtda o'zgartira oladi.
 * - `admin` — oddiy administrator. Qulflangan ma'lumotlarni o'zgartira olmaydi.
 */
export type Role = 'superadmin' | 'admin' | 'teacher' | 'student' | 'parent' | 'staff'

export type Gender = 'male' | 'female'

export interface User {
  id: string
  fullName: string
  role: Role
  email?: string
  avatarUrl?: string
  /** Telefon — admin/xodim botda yangi lid xabarnomasini olishi uchun */
  phone?: string
  /** O'qituvchi uchun ochiq bo'limlar (nav filtri); boshqa rollarda bo'lmaydi */
  permissions?: string[]
}

/** O'quvchi/o'qituvchiga biriktirilgan tizim akkaunti (login/parol) */
export interface Credentials {
  /** Tizimga kirish logini (email) */
  login: string
  /** Ochiq parol (admin topshirishi uchun) */
  password: string
  role: Role
}

/* ---------- Admin dashboard ---------- */

export interface AdminStats {
  studentsCount: number
  teachersCount: number
  /** Markaz o'rtacha bahosi (5 ballik tizim) */
  averageGrade: number
  /** Umumiy davomat foizi (0-100); o'tilgan dars bo'lmasa null */
  attendanceRate: number | null
}

export interface ClassPerformance {
  classId: string
  /** Masalan: "9-A" */
  className: string
  /** Guruh o'qituvchisi (grafik x o'qida ko'rsatiladi; guruh nomi hoverda) */
  teacherName?: string
  /** O'rtacha baho (5 ballik) */
  averageGrade: number
  /** Davomat foizi (0-100); o'tilgan dars bo'lmasa null */
  attendanceRate: number | null
}

export interface TopClass {
  id: string
  name: string
  studentsCount: number
  /** Aktiv (Status=="active") a'zolar soni — sinov/muzlatilgan emas */
  activeCount: number
  averageGrade: number
}

export interface StudentBreakdown {
  /** Faol talabalar (status=="active" faol a'zolik) */
  active: number
  /** Aktiv bo'lmagan talabalar */
  inactive: number
  /** Qarzdorlar (Balance < 0) */
  debtors: number
  /** Qarzi yo'q talabalar */
  paid: number
  /** Guruhi bor talabalar */
  withGroup: number
  /** Guruhsiz talabalar */
  withoutGroup: number
}

/** O'qituvchining talaba saqlab qolish statistikasi (lifetime, per-group) */
export interface TeacherPerformance {
  teacherId: string
  teacherName: string
  phone: string
  totalStudents: number
  activeStudents: number
  frozenStudents: number
  leftStudents: number
  retentionPercent: number
  lossPercent: number
  effectivenessScore: number
  groupCount: number
}

export interface AdminDashboard {
  stats: AdminStats
  classPerformance: ClassPerformance[]
  /** O'rtacha baho bo'yicha eng yuqori guruhlar */
  topClasses: TopClass[]
  /** O'quvchilar bo'yicha taqsimot */
  studentBreakdown: StudentBreakdown
  /** Shu oyda nechta ba'ho kiritilgan */
  totalGradesCount?: number
}

/* ---------- Bugungi darslar monitoringi (bosh sahifa) ---------- */
export interface TodayLessonMonitor {
  groupId: string
  groupName: string
  courseName: string
  teacherId: string
  teacherName: string
  room: string
  startTime: string
  endTime: string
  studentsCount: number
  /** Bugun davomat qilinganmi (Conducted dars belgilangan) */
  attendanceDone: boolean
  /** Bugun baho qo'yilganmi (jurnal bahosi yoki mezon belgisi) */
  gradesDone: boolean
}
export interface TodayLessons {
  date: string
  dayIndex: number
  lessons: TodayLessonMonitor[]
}

/* ---------- Markaz (butun o'quv markazi) kunlik AI tahlili ---------- */
export interface CenterPoint {
  label: string
  value: number
}
export interface CenterRevenue {
  expectedThisMonth: number
  collectedThisMonth: number
  outstandingDebt: number
  yesterdayIncome: number
  predictedMonthEnd: number
}
export interface CenterMetrics {
  activeStudents: number
  newLeadsThisMonth: number
  newLeadsYesterday: number
  convertedThisMonth: number
  departedThisMonth: number
  avgGradeThisMonth: number
  avgGradePrevMonth: number
  leadsBySource: CenterPoint[]
  departureReasons: CenterPoint[]
  incomeLast14Days: CenterPoint[]
}
export interface CenterAiNarrative {
  umumiy: string
  tushumTahlili: string
  baholarTahlili: string
  lidlar: string
  ketganlar: string
  xavflar: string[]
  tavsiyalar: string[]
  salomatlik: number
  trend: string
}
export interface CenterAiRecord {
  id: string
  date: string
  createdAt: string
  model: string
  health: number
  ai: CenterAiNarrative
  revenue: CenterRevenue
  metrics: CenterMetrics
}
export interface CenterAiHistoryItem {
  id: string
  date: string
  createdAt: string
  health: number
  summary: string
}
export interface CenterAiResponse {
  ok: boolean
  alreadyToday: boolean
  record: CenterAiRecord | null
  error: string | null
}

/* ---------- Lidlar (markazga qiziqqanlar) ---------- */

export type StageColor =
  | 'slate'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'cyan'
  | 'orange'

/** Kanban ustuni (lid bosqichi) */
export interface Stage {
  id: string
  title: string
  color: StageColor
}

export interface Lead {
  id: string
  /** Familiya Ism Sharif */
  fullName: string
  gender: Gender
  birthDate: string
  /** O'quvchining o'z telefon raqami */
  phone: string
  /** Otasining FISH */
  fatherFullName: string
  /** Otasining telefon raqami */
  fatherPhone: string
  /** Onasining FISH */
  motherFullName: string
  /** Onasining telefon raqami */
  motherPhone: string
  note?: string
  /** Tegishli ustun (Stage) id'si */
  stage: string
  /** Lid manbasi (Instagram, Referral, Sayt, Telegram, Tashrif, Boshqa) */
  source?: string
  /** Qiziqqan fani / yo'nalishi */
  interestSubject?: string
  /** Yaratilgan vaqti (ISO) */
  createdAt?: string
  /** Aylantirilgan o'quvchi id'si (null = hali aylantirilmagan) */
  convertedStudentId?: string | null
  /** Birinchi dars davomat holati: "attended" | "absent" | "no-lesson" */
  firstLessonAttendance?: 'attended' | 'absent' | 'no-lesson'
}

/** Lid tarixidagi voqea turi */
export type LeadEventType = 'note' | 'stage' | 'call' | 'trial' | 'convert' | 'created'

/** Lid tarixi (timeline) yozuvi */
export interface LeadEvent {
  id: string
  type: LeadEventType
  text: string
  actorName: string
  createdAt: string
}

/** Sinov darsi natijasi */
export type TrialResult = 'pending' | 'stayed' | 'left'

/** Lidga belgilangan sinov darsi */
export interface TrialLesson {
  id: string
  leadId: string
  groupId: string
  groupName: string
  scheduledAt: string
  result: TrialResult
  createdAt: string
}

/** CRM statistikasi */
export interface CrmStats {
  totalLeads: number
  converted: number
  /** Konversiya foizi (0-100) */
  conversionRate: number
  byStage: { label: string; count: number }[]
  bySource: { label: string; count: number }[]
  monthly: { month: string; created: number; converted: number }[]
}

/* ---------- O'quvchilar ---------- */

export interface Student {
  id: string
  /** Familiya Ism Sharif — parts'dan join qilinadi (saqlash + qidiruv uchun) */
  fullName: string
  /** Familiya (alohida) */
  lastName?: string
  /** Ism (alohida) */
  firstName?: string
  /** Otasining ismi / sharifi (alohida) */
  middleName?: string
  birthDate: string
  /** Metrika (tug'ilganlik haqida guvohnoma) rasm/skani manzili */
  birthCertificateUrl?: string | null
  address: string
  gender: Gender
  /** O'quvchining o'z telefon raqami */
  phone?: string
  /** Otasi F.I.SH */
  fatherFullName?: string
  /** Otasi telefon raqami */
  fatherPhone?: string
  /** Onasi F.I.SH */
  motherFullName?: string
  /** Onasi telefon raqami */
  motherPhone?: string
  /** Ota-onasi FISH — parts'dan join */
  parentFullName: string
  /** Ota-ona familiyasi */
  parentLastName?: string
  /** Ota-ona ismi */
  parentFirstName?: string
  /** Ota-ona otasining ismi / sharifi */
  parentMiddleName?: string
  /** Ota-onasi telefon raqami */
  parentPhone: string
  /** Ota-ona passport rasm/skani manzili */
  parentPassportUrl?: string | null
  /** Joylashuv kengligi (mobil ilovadan GPS) */
  latitude?: number | null
  /** Joylashuv uzunligi */
  longitude?: number | null
  /** Joylashuv manzili (reverse geocode) */
  locationAddress?: string | null
  /** Joylashuv oxirgi yangilangan vaqti (ISO) */
  locationUpdatedAt?: string | null
  /** Arxivlanganmi (o'quvchi markazdan ketgan/chiqarilgan) */
  isArchived?: boolean
  /** Arxivga olingan sana (ISO) */
  archivedAt?: string | null
  /** Arxivga olish sababi */
  archiveReason?: string | null
  /** Biriktirilgan asosiy guruh (ClassName) */
  className: string
  /** Tegishli tuman (District id). Bo'sh = tanlanmagan. */
  districtId?: string
  /** Tegishli maktab (School id). Bo'sh = tanlanmagan. */
  schoolId?: string
  /** Tuman nomi (faqat ko'rsatish uchun — backend to'ldiradi). */
  districtName?: string
  /** Maktab nomi/raqami (faqat ko'rsatish uchun — backend to'ldiradi). */
  schoolName?: string
  /** O'quvchi FAOL a'zo bo'lgan barcha guruh nomlari (ro'yxat ko'rinishi uchun) */
  groups?: string[]
  /** Kursda aktiv — kamida bitta a'zoligi "active" (sinov/muzlatilgan/guruhsiz emas) */
  active?: boolean
  /** Login/parol orqali tizimga kirish admin tomonidan cheklanganmi */
  loginBlocked?: boolean
  /** Markazga kelgan (qabul) sanasi (ISO) — oylik to'lov shu oydan boshlanadi */
  enrollmentDate: string
  /** Tizimga kiritilgan vaqt (ISO). "Yangi kiritilgani tepada" tartiblash uchun (eski yozuvda bo'sh). */
  createdAt?: string
  /** Balans (so'm): manfiy = qarzdor, 0 = qarzsiz, musbat = avans */
  balance: number
  /** Chegirma — foiz (0..100). Avval olib tashlanadi, keyin discountAmount ayriladi. */
  discountPct: number
  /** Chegirma — aniq summa (so'm). Foizdan keyin ayriladi. */
  discountAmount: number
  /** Chegirma izohi/sababi (masalan "Aka-uka chegirmasi"). */
  discountNote: string
  /** Chegirma amal qilish boshlanish oyi ("YYYY-MM"). Bo'sh — cheklovsiz (boshidan). */
  discountStartMonth?: string
  /** Chegirma amal qilish tugash oyi ("YYYY-MM"). Bo'sh — cheklovsiz. Ikkalasi bo'sh — har doim. */
  discountEndMonth?: string
  /** Chegirma qaysi GURUHGA tegishli (guruh id). Bo'sh/null — barcha guruh hisoblariga. */
  discountGroupId?: string | null
}

/* ---------- Tuman + maktab ---------- */

export interface School {
  id: string
  districtId: string
  /** Maktab raqami yoki nomi */
  name: string
  order: number
}

export interface District {
  id: string
  name: string
  order: number
  schools: School[]
}

/* ---------- AI tekshiruv (Speaking / Writing) ---------- */

export interface AiCheckScores {
  grammar: number
  vocabulary: number
  coherence: number
  task: number
  mechanics: number
  pronunciation: number
  fluency: number
}
export interface AiCorrection {
  original: string
  suggestion: string
  explanation: string
}
export interface AiVocab {
  word: string
  suggestion: string
  note: string
}
export interface AiCheckIelts {
  task: number
  coherence: number
  lexical: number
  grammar: number
  overall: number
  taskType: string
}
export interface AiCheckAnalysis {
  overall: number
  level: string
  scores: AiCheckScores
  summary: string
  strengths: string[]
  weaknesses: string[]
  corrections: AiCorrection[]
  vocabulary: AiVocab[]
  improved: string
  recommendations: string[]
  ielts?: AiCheckIelts | null
}
export interface SpeakingWord {
  word: string
  accuracy: number
  errorType: string
}
export interface AiCheckSpeech {
  recognizedText: string
  pronScore: number
  accuracy: number
  fluency: number
  completeness: number
  prosody: number
  words: SpeakingWord[]
}
/** "speaking" | "writing" */
export interface AiCheck {
  id: string
  type: 'speaking' | 'writing'
  prompt: string
  inputText: string
  recognizedText: string
  audioUrl: string
  score: number
  date: string
  createdAt: string
  analysis: AiCheckAnalysis | null
  speech: AiCheckSpeech | null
  taskType: string
}
export interface AiCheckListItem {
  id: string
  type: 'speaking' | 'writing'
  prompt: string
  score: number
  date: string
  createdAt: string
  hasAudio: boolean
}
export interface AiCheckStatus {
  geminiReady: boolean
  azureReady: boolean
  premium: boolean
  blocked: boolean
  limit: number
  usedToday: number
  remaining: number
}
/** Admin: foydalanuvchilar bo'yicha umumiy ko'rinish */
export interface AiCheckOverviewRow {
  studentId: string
  fullName: string
  className: string
  speakingCount: number
  writingCount: number
  total: number
  todayUsed: number
  effectiveLimit: number
  premium: boolean
  blocked: boolean
}

/* ---------- Xonalar ---------- */

export interface Room {
  id: string
  name: string
  capacity: number
  building?: string
  location?: string
  isActive: boolean
  createdAt: string
}

export interface RoomUtilization {
  roomId: string
  roomName: string
  capacity: number
  currentStudents: number
  totalSlots?: number
  gap?: number
  groupCount?: number
  occupancyPercent: number
  activeGroupCount: number
  weeklyActiveHours: number
  weeklyUtilizationPercent: number
  efficiencyScore: number
  efficiencyStatus: string
  building?: string
  location?: string
  groupNames?: string[]
}

/* ---------- Kurslar (fanlar) ---------- */

export interface Subject {
  id: string
  name: string
  /** Kurs narxi (so'm) — guruh oylik to'lovi shundan to'ldiriladi */
  price: number
  /** Bir dars uchun yaxlit narx (so'm) — qisman-oy aktivlashtirishda 12 tadan kam dars
   *  qolganda har bir dars uchun shu summa olinadi. 0 = kiritilmagan (eski pro-rata). */
  lessonPrice?: number
}

/* ---------- Guruhlar ---------- */

export type ClassLanguage = 'uz' | 'ru'

export interface Group {
  id: string
  /** Guruh nomi, masalan "3-A" */
  name: string
  /** Guruh darajasi (1-11), masalan 3 */
  grade: number
  /** O'zbek yoki rus tilidagi guruh */
  language: ClassLanguage
  /** Oylik to'lov (so'm) */
  monthlyFee: number
  /** Xona raqami (matnli, eski — backward compat) */
  room?: string
  /** Xona FK (Room.Id). Yangi guruhlarda shu ishlatiladi. */
  roomId?: string
  /** Guruh arxivlangan (arxivlanganda o'quvchilari ham arxivlanadi) */
  isArchived?: boolean
  /** Arxivga olingan sana (ISO) */
  archivedAt?: string | null
  /** Guruh holati */
  status?: 'active' | 'full' | 'archived'
  /** Boshlanish/tashkil topgan sanasi (ISO "YYYY-MM-DD") */
  startDate?: string
  /** Tugash sanasi (ISO) */
  endDate?: string
  /** Sig'im (0 = cheksiz) */
  capacity?: number
  /** Biriktirilgan kurs (Subject) id'si */
  courseId?: string
  /** Biriktirilgan o'qituvchi (Teacher) id'si */
  teacherId?: string
  /** Izoh */
  note?: string
  /** Hafta kunlari (0=Dushanba .. 6=Yakshanba) */
  days?: number[]
  /** Dars boshlanish vaqti "HH:mm" */
  startTime?: string
  /** Dars tugash vaqti "HH:mm" */
  endTime?: string
  /** Shu guruh uchun o'qituvchi maoshi rejimi: '' (umumiy) | 'percent' (guruh to'lovidan foiz) | 'fixed' (qat'iy summa) */
  teacherSalaryMode?: string
  /** Foizli bo'lsa — o'qituvchiga beriladigan ulush (%) */
  teacherSalaryPercent?: number
  /** Qat'iy bo'lsa — shu guruh uchun o'qituvchiga beriladigan oylik summa (so'm) */
  teacherSalaryFixed?: number
}

/** Guruh a'zosi (many-to-many a'zolik) */
export interface GroupMember {
  studentId: string
  fullName: string
  joinedAt: string
  leftAt?: string | null
  isActive: boolean
  /** To'lov holati: 'trial' (sinov) | 'active' (aktiv) | 'frozen' (muzlatilgan) */
  status: string
  /** Aktivlashtirilgan sana (ISO) */
  activatedAt: string
  /** Muzlatilgan sana (ISO) */
  frozenAt: string
  /** O'quvchi balansi (manfiy = qarz). */
  balance: number
}

/** O'quvchining guruh a'zoligi */
export interface StudentGroupMembership {
  id: string
  groupId: string
  groupName: string
  joinedAt: string
  leftAt?: string | null
  isActive: boolean
  status: string
  courseName: string
  teacherName: string
  monthlyFee: number
  days: number[]
  startTime: string
  endTime: string
  room: string
}

/** Guruh to'ldirish qatori */
export interface GroupFillRow {
  groupId: string
  name: string
  grade: number
  capacity: number
  enrolled: number
  freeSeats: number
  status: 'active' | 'full' | 'archived'
}

/** Bitta guruh bo'yicha oylik hisob (to'lov oynasi uchun — aggregate emas) */
export interface GroupMonth {
  /** "YYYY-MM" */
  month: string
  /** Shu guruhning shu oyga oylik to'lovi (chegirma ayirilgan) */
  fee: number
  /** Shu guruhga teglangan to'langan summa */
  paid: number
  /** Qoldiq (fee − paid) */
  remaining: number
  status: MonthStatus
}

export interface GroupLedger {
  groupId: string
  groupName: string
  courseName: string
  months: GroupMonth[]
}

/* ---------- Jurnal ---------- */

/**
 * Dars o'zlashtirish darajasi (mastery level) — o'qituvchi darsda o'quvchining
 * o'zlashtirish holati qaysi darajada ekanini belgilaydi.
 * - 0 = NonReactive (reaktiv emas — o'rgani emas, tushunarli emas)
 * - 1 = Reactive (reaktiv — o'rgani lekin yordam bilan)
 * - 2 = Active (faol — o'rgani va mustaqil ishlay oladi)
 * - 3 = ProActive (proaktiv — chuqur o'rgani va boshqalarga o'rgata oladi)
 */
export type MasteryLevel = 0 | 1 | 2 | 3

/** Jurnal ustuni: bitta dars (sana + dars raqami). */
export interface JournalColumn {
  date: string
  /** Dars raqami (1-10) */
  period: number
}

export interface JournalEntry {
  studentId: string
  /** Dars sanasi (ISO) */
  date: string
  /** Dars raqami (1-10) — bir kunda bir necha dars bo'lsa farqlash uchun */
  period: number
  /** Baho (1-5), agar kelgan va baholangan bo'lsa */
  grade?: number
  /** Davomat sababi id'si, agar kelmagan bo'lsa */
  reasonId?: string
  /** Uyga vazifa: 0 = belgilanmagan, 1 = qildi, 2 = qilmadi */
  homework?: number
  /** Xulq: 0 = belgilanmagan, 1 = yaxshi, 2 = yomon */
  behavior?: number
  /** Shu darsni o'zlashtirish darajasi (MasteryLevel: 0-3); null/undefined = belgilanmagan */
  mastery?: MasteryLevel | null
}

/** Dars ma'lumoti (sana + dars raqami bo'yicha): mavzu, uyga vazifa, o'tildi */
export interface JournalTopic {
  date: string
  period: number
  topic: string
  homework?: string
  /** Dars o'tildimi (ptichka) */
  conducted: boolean
}

/* ---------- Sozlamalar ---------- */

export interface QuarterPeriod {
  /** Chorak raqami 1-4 */
  quarter: number
  startDate: string
  endDate: string
  /** O'qituvchilarga shu chorak bahosini kiritish ochiqmi (admin boshqaradi) */
  gradesOpen: boolean
}

/** Davomat sababi (kelmaganlik turi) */
export interface AbsenceReason {
  id: string
  name: string
  /** Jurnal katagida ko'rsatiladigan qisqa belgi */
  short: string
  /** "Kech keldi" turi — yo'qlik emas (davomatga ta'sir qilmaydi), baho qo'ysa bo'ladi */
  isLate: boolean
}

export interface SchoolSettings {
  quarters: QuarterPeriod[]
  absenceReasons: AbsenceReason[]
}

/* ---------- Moliya ---------- */

export type FinanceDirection = 'income' | 'expense'

export interface FinanceTransaction {
  id: string
  /** Sana (ISO) */
  date: string
  direction: FinanceDirection
  /** Toifa: tuition, salary, utilities, supplies, rent, donation, other ... */
  category: string
  /** Summa (musbat; yo'nalish belgini aniqlaydi) */
  amount: number
  note?: string
  /** O'quvchi to'lovi bo'lsa — tegishli o'quvchi id'si */
  studentId?: string
  /** Tuition to'lovi bo'lsa — qaysi guruh uchun (Group id); null = teglanmagan */
  groupId?: string | null
  /** Backend qaytaradigan o'quvchi nomi (qulaylik uchun) */
  studentName?: string
  /** O'qituvchi maoshi bo'lsa — tegishli o'qituvchi id'si */
  teacherId?: string
  /** Backend qaytaradigan o'qituvchi nomi */
  teacherName?: string
  /** Oylik to'lov bo'lsa — qaysi oy uchun ("YYYY-MM") */
  month?: string
  /** To'lov usuli: cash (Naqd) | card (Karta) | bank (Bank orqali) */
  method?: string
  /** Backend qaytaradigan guruh nomi (tuition to'lovi bo'lsa) */
  groupName?: string | null
  /** Kassir qo'lda yozgan izoh (chekda ko'rinadi) */
  comment?: string | null
  /** Kiritilgan vaqt (ISO "yyyy-MM-ddTHH:mm:ss", markaz mintaqasi UTC+5) — ro'yxatda soat ko'rsatish uchun */
  createdAt?: string
  /** Bu to'lovdan jami qancha VOZVRAT (pul qaytarish) qilingani (>0 = qisman/to'liq qaytarilgan) */
  refunded?: number
  /** Bu yozuvning O'ZI vozvrat bo'lsa — qaysi asl to'lov uchun (id) */
  refundOfId?: string | null
}

/** Vozvrat (pul qaytarish) yozuvi — "Vozvratlar tarixi" uchun, asl to'lov ma'lumoti bilan. */
export interface Refund {
  id: string
  date: string
  amount: number
  studentId?: string | null
  studentName?: string | null
  groupId?: string | null
  groupName?: string | null
  month?: string | null
  reason?: string | null
  paymentId?: string | null
  paymentAmount?: number | null
  paymentDate?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

export interface CategoryAmount {
  category: string
  amount: number
}

export interface FinanceSummary {
  totalIncome: number
  totalExpense: number
  /** Sof = kirim - chiqim */
  net: number
  tuitionIncome: number
  otherIncome: number
  incomeByCategory: CategoryAmount[]
  expenseByCategory: CategoryAmount[]
  /** O'quvchilar jami qarzi (manfiy balanslar yig'indisi, musbat son) */
  studentDebt: number
  /** O'quvchilar jami avansi (musbat balanslar yig'indisi) */
  studentAdvance: number
  transactionsCount: number
}

export interface FinanceMonthly {
  /** "YYYY-MM" */
  month: string
  income: number
  expense: number
}

/* ---------- O'quvchi to'lov tarixi (ledger) ---------- */

export type MonthStatus = 'paid' | 'partial' | 'unpaid'

export interface MonthLedger {
  /** "YYYY-MM" */
  month: string
  /** Shu oyga hisoblangan TO'LIQ summa (guruh oylik narxi — chegirmasiz) */
  charged: number
  /** Shu oy uchun berilgan chegirma summasi */
  discount: number
  /** Qoplangan (haqiqiy naqd) summa — chegirma kirmaydi */
  paid: number
  /** Qolgan qarz = charged − discount − paid */
  remaining: number
  status: MonthStatus
  /** Shu oyda qaysi kurslarga (qancha) — breakdown */
  courses: MonthCourse[]
  /** Shu oy uchun guruh ID (per-group hisob bo'lsa) */
  groupId?: string
}

export interface MonthCourse {
  courseName: string
  fee: number
  /** Shu kurs ulushi qaysi guruh hisobiga tegishli (null = guruhsiz/ClassName) */
  groupId?: string | null
}

export interface LedgerPayment {
  date: string
  amount: number
  note?: string
  /** Foydalanuvchi kiritgan izoh (ixtiyoriy) */
  comment?: string
  /** Qaysi oy uchun to'langani ("YYYY-MM"), agar biriktirilgan bo'lsa */
  month?: string
  /** To'lov usuli: cash (Naqd) | card (Karta) | bank (Bank orqali) */
  method?: string
}

export interface StudentLedger {
  student: Student
  balance: number
  /** Hozirgi effektiv oylik to'lov (guruh narxi − chegirma) */
  monthlyFee: number
  /** Jami hisoblangan (to'liq narx — chegirmasiz) */
  totalCharged: number
  /** Jami berilgan chegirma (so'm) */
  totalDiscount: number
  /** Jami haqiqiy naqd to'langan summa (chegirma kirmaydi) */
  totalPaid: number
  months: MonthLedger[]
  payments: LedgerPayment[]
}

/* ---------- O'zgarishlar tarixi (audit) ---------- */

export type AuditAction = 'create' | 'update' | 'delete'

export interface AuditLog {
  id: string
  /** FinanceTransaction | TeacherSalary | ClassFee */
  entityType: string
  entityId: string
  action: AuditAction
  /** ISO "yyyy-MM-ddTHH:mm:ss" */
  timestamp: string
  /** O'zgartirgan foydalanuvchi nomi (yoki "Tizim") */
  actorName?: string
  /** O'qiladigan o'zbekcha izoh */
  summary: string
  /** O'zgarishdan oldingi holat (JSON satr) — create uchun yo'q */
  before?: string
  /** O'zgarishdan keyingi holat (JSON satr) — delete uchun yo'q */
  after?: string
  studentId?: string
  teacherId?: string
}

/* ---------- O'qituvchilar ---------- */

export interface Teacher {
  id: string
  /** Familiya Ism Sharif */
  fullName: string
  birthDate: string
  address: string
  gender: Gender
  /** Telefon raqami — Telegram bot orqali shartnoma olish uchun ro'yxatdan o'tishda moslashtiriladi */
  phone?: string
  /** O'qituvchining rasmi (profil surati) URL'i */
  photoUrl?: string | null
  /** Guruh rahbari bo'lsa — biriktirilgan guruh nomi; aks holda bo'sh */
  homeroomClass: string
  /** Dars beradigan fanlar (Subject id'lari) */
  subjectIds: string[]
  /** Maosh rejimi: 'fixed' (qat'iy summa) | 'percent' (guruh to'lovidan foiz). Standart 'fixed'. */
  salaryMode?: string
  /** Qat'iy oylik ish haqi (so'm) — salaryMode='fixed' da ishlatiladi */
  salary: number
  /** Foizli maosh ulushi (%) — salaryMode='percent' da: guruhdan yig'ilgan to'lovning shu foizi */
  salaryPercent?: number
  /** O'qituvchi toifasi: "oliy" | "1" | "2" | "mutaxasis" (bo'sh = belgilanmagan). Soat narxini belgilaydi. */
  category?: string
  /** Oylik qaysi oydan hisoblansin ("YYYY-MM"); bo'sh = hisobot davri boshidan (eski maydon) */
  salaryStartMonth: string
  /** Maosh qaysi KUNdan hisoblansin ("YYYY-MM-DD"); oy o'rtasida kelsa birinchi oy qisman */
  salaryStartDate?: string
  /** O'qituvchi web panelida ochiq bo'limlar (admin belgilaydi) */
  permissions: string[]
  /** Support o'qituvchimi — bo'sh vaqt slotlari + bron (Ilova → Support) */
  isSupport?: boolean
  /** Arxivlanganmi (ishdan ketgan/to'xtatilgan) */
  isArchived?: boolean
  /** Arxivga olingan sana (ISO) */
  archivedAt?: string | null
  /** Arxivga olish sababi */
  archiveReason?: string | null
}

/* ---------- O'qituvchi faollik hisoboti ---------- */

/** Bitta o'qituvchi qatori (umumiy ko'rinish). Status: active | low | none */
export interface TeacherReportRow {
  teacherId: string
  fullName: string
  isArchived: boolean
  /** Reja — jadvaldan kelib chiqib bugungacha bo'lishi kerak bo'lgan darslar */
  expected: number
  /** O'tilgan (jurnal "o'tildi" belgilari) */
  conducted: number
  /** Bajarilish foizi (conducted/expected); reja yo'q bo'lsa null */
  donePct: number | null
  /** Qo'yilgan baholar soni */
  grades: number
  /** O'tilgan darslarning necha %ida mavzu yozilgan */
  topicPct: number | null
  /** O'tilgan darslarning necha %ida uy vazifa berilgan */
  homeworkPct: number | null
  /** Oxirgi faollik sanasi (ISO) yoki null */
  lastActivity: string | null
  status: 'active' | 'low' | 'none'
  /** Jami kelgan o'quvchilar (barcha holatlar, shu o'qituvchi guruhlari) */
  came: number
  /** Faol (active) o'quvchilar soni */
  active: number
  /** Sinov (trial) o'quvchilar soni */
  trial: number
  /** Muzlatilgan (frozen) o'quvchilar soni */
  frozen: number
  /** Ketgan (IsActive=false) o'quvchilar soni */
  left: number
  /** Qolgan = HOZIRGI aktiv o'quvchilar (barcha guruhlarida; o'qituvchi performance "Faol" bilan bir xil).
   *  Kelgan/Faol/Sinov/Muzlatilgan/Ketgan esa tanlangan OYDAGI oqim. */
  remaining: number
  /** Sotuv konversiyasi foizi: active/came*100; came=0 bo'lsa null */
  conversionPct: number | null
}

/** Guruh/fan kesimida bitta qator (batafsil hisobot) */
export interface TeacherReportBreakdown {
  className: string
  subjectName: string
  expected: number
  conducted: number
  donePct: number | null
  grades: number
  topicPct: number | null
  homeworkPct: number | null
}

/** Bitta o'qituvchining batafsil hisoboti */
export interface TeacherReportDetail extends TeacherReportRow {
  rows: TeacherReportBreakdown[]
}

/**
 * Umumiy ko'rinish javobi: mavjud oylar ro'yxati ("yyyy-MM"), tanlangan oy
 * (bo'sh = Umumiy) va o'qituvchi qatorlari.
 */
export interface TeacherReportOverview {
  months: string[]
  month: string
  rows: TeacherReportRow[]
}

/* ---------- Shartnomalar ---------- */

/** target: 'parent' | 'staff' */
/** Foydalanuvchi qo'shgan qo'shimcha @-o'rinbosar (doimiy qiymat bilan) */
export interface ContractField {
  key: string
  value: string
}

export interface ContractTemplate {
  id: string
  target: 'parent' | 'staff'
  name: string
  fileUrl: string
  fileName: string
  /** Custom (matnli) andoza tanasi — bo'sh bo'lmasa matnli andoza (fayl emas) */
  body: string
  /** Foydalanuvchi qo'shgan qo'shimcha o'rinbosarlar (doimiy qiymatli) */
  fields: ContractField[]
  uploadedAt: string
}

/** O'quvchi oluvchi (shartnoma o'quvchi bo'yicha tuziladi) */
export interface StudentRecipient {
  studentId: string
  fullName: string
  parentName: string
  phone: string
  /** Faol guruh nomlari (vergul bilan) */
  groups: string
  /** Telegramda ro'yxatdan o'tganmi */
  registered: boolean
  /** Oxirgi shartnoma raqami */
  lastNumber: number | null
}

/** Xodim oluvchi */
export interface StaffRecipient {
  teacherId: string
  fullName: string
  phone: string
  registered: boolean
  lastNumber: number | null
}

/** Bitta oluvchiga yuborish natijasi */
export interface SendResult {
  recipientKey: string
  ok: boolean
  number: number | null
  message: string
}

/* ---------- Boshqaruv ---------- */

/** Filial (branch) */
export interface Branch {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters: number
  createdAt: string
}

/** Xodim (o'qituvchi bo'lmagan ishchi) */
export interface Staff {
  id: string
  fullName: string
  /** Lavozim yorlig'i (Kassir/Administrator/...) */
  position: string
  /** Tizim logini */
  login: string
  /** Ochiq admin bo'limlari (adminPermissions kalitlari) */
  permissions: string[]
  /** Telefon — botda yangi lid xabarnomasini olish uchun */
  phone?: string
}

/** Xodim roli shabloni — yangi xodim qo'shishda template tanlab olsa, default ruxsatlari avtomatik belgilanadi */
export interface StaffRoleTemplate {
  id: string
  code: string
  name: string
  description: string
  defaultPermissions: string[]
}

/** Taklif yoki shikoyat (ota-ona ilovasidan) */
export interface Feedback {
  id: string
  studentName: string
  parentName: string
  className: string
  /** suggestion | complaint */
  type: 'suggestion' | 'complaint'
  text: string
  createdAt: string
  /** new | resolved */
  status: 'new' | 'resolved'
  /** parent | teacher — yuboruvchi roli */
  senderRole: 'parent' | 'teacher'
  /** Yuboruvchining ismi (ota-ona yoki o'qituvchi) */
  senderName: string
  /** Biriktirilgan rasm ("/uploads/...") yoki null */
  imageUrl: string | null
}

/* ---------- O'qituvchi maoshi ---------- */

export interface SalaryHistory {
  teacherId: string
  fullName: string
  salary: number
  totalPaid: number
  payments: LedgerPayment[]
}

/** Bitta oyda bitta guruhning jurnal holati — maosh ushlanmasining sababi */
export interface SalaryLessonStat {
  groupId: string
  groupName: string
  /** Rejadagi darslar (guruh kunlari bo'yicha, muhlati o'tganlari) */
  planned: number
  /** Jurnalda "o'tildi" deb belgilangani */
  conducted: number
  /** Belgilanmagani (o'tilmagan hisoblanadi) */
  missed: number
  /** Shu guruh uchun ushlangan summa */
  deduction: number
  /** Belgilanmagan dars sanalari ("YYYY-MM-DD") */
  missedDates: string[]
}

/** Oy bo'yicha maosh holati */
export interface MonthSalary {
  /** "YYYY-MM" */
  month: string
  /** Shu oy uchun YAKUNIY (ushlanmadan keyingi) oylik */
  expected: number
  /** Shu oyda berilgan */
  paid: number
  /** Qoldiq (belgilangan − berilgan) */
  remaining: number
  status: MonthStatus
  /** Ushlanmagacha hisoblangan summa */
  baseExpected?: number
  /** Jurnalda belgilanmagan darslar uchun ushlanma */
  deduction?: number
  plannedLessons?: number
  conductedLessons?: number
  missedLessons?: number
  /** Ushlanma tafsiloti (guruhlar bo'yicha) — maosh jurnalga bog'langanda */
  lessons?: SalaryLessonStat[]
}

/** Maosh hisobida bitta guruhning ulushi (davr bo'yicha) */
export interface GroupSalaryLine {
  groupId: string
  groupName: string
  courseName: string
  monthlyFee: number
  /** Amaldagi rejim: 'percent' | 'fixed' */
  mode: string
  /** Foizli ulush (%) */
  percent: number
  /** Qat'iy summa (so'm) */
  fixed: number
  /** Shu davrda guruhdan yig'ilgan to'lov bazasi */
  periodCollected: number
  /** Shu guruh keltirgan hisoblangan maosh (davr bo'yicha) */
  periodExpected: number
}

/** O'qituvchi maoshi bo'yicha batafsil hisob (davr bo'yicha) */
export interface SalaryLedger {
  teacherId: string
  fullName: string
  salary: number
  /** Jami hisoblangan (oylik × davr oylari) */
  totalExpected: number
  /** Jami berilgan */
  totalPaid: number
  /** Umumiy qoldiq */
  remaining: number
  months: MonthSalary[]
  payments: LedgerPayment[]
  /** Maosh rejimi: 'fixed' | 'percent' */
  salaryMode?: string
  /** Foizli ulush (%) — salaryMode='percent' bo'lsa */
  salaryPercent?: number
  /** Per-guruh maosh taqsimoti (har guruh alohida rejim/qiymat + ulush) */
  groups?: GroupSalaryLine[]
  /** Davr bo'yicha jami ushlanma (jurnalda belgilanmagan darslar uchun) */
  totalDeduction?: number
  /** true — maosh jurnalga bog'langan (Guruhlar → Jurnal boshqaruvi) */
  journalLinked?: boolean
}

export interface SalaryReportRow {
  teacherId: string
  teacherName: string
  /** Belgilangan oylik */
  salary: number
  /** Davr ichida berilgan jami */
  totalPaid: number
  paymentsCount: number
  /** Davrdagi oylar soni */
  months: number
  /** Kerakli (oylik × davr oylari) */
  expected: number
  /** Qoldiq (kerakli − berilgan); manfiy = ortiqcha berilgan */
  remaining: number
  /** Maosh rejimi: 'fixed' | 'percent' */
  salaryMode?: string
  /** Foizli ulush (%) — salaryMode='percent' bo'lsa */
  salaryPercent?: number
  /** Jurnalda belgilanmagan darslar uchun ushlangan jami summa */
  deduction?: number
  /** Belgilanmagan darslar soni (davr bo'yicha) */
  missedLessons?: number
}

/** O'quvchilar bo'yicha moliya hisoboti qatori (joriy holat) */
export interface StudentFinanceRow {
  studentId: string
  fullName: string
  className: string
  /** Jami hisoblangan (TO'LIQ oylik to'lovlar yig'indisi — chegirmasiz) */
  charged: number
  /** Jami berilgan chegirma (so'm) */
  discount: number
  /** Jami HAQIQIY naqd to'lov (chegirma kirmaydi — to'langan summa o'zgarmaydi) */
  paid: number
  /** Qoldiq qarz (balansdan) */
  debt: number
  /** Ortiqcha to'langan (avans, balansdan) */
  advance: number
  /** Chegirma foizi qoidasi (0..100). 0 — chegirma yo'q. */
  discountPct: number
  /** Chegirma aniq summa qoidasi. 0 — chegirma yo'q. */
  discountAmount: number
}

/* ---------- Xabarlar (chat + e'lon + telegram) ---------- */

/** Guruh chatidagi bitta xabar */
export interface ChatMessage {
  id: string
  /** Qaysi guruh chati (guruh nomi) */
  className: string
  senderUserId: string
  senderName: string
  /** admin | teacher | student */
  senderRole: Role
  text: string
  /** ISO 8601 vaqt */
  createdAt: string
}

/** Admin "Xabarlar" bo'limidagi guruh kartasi */
export interface MessageClass {
  name: string
  grade: number
  studentCount: number
  /** Telegramda ro'yxatdan o'tgan (e'lon oluvchi) ota-onalar soni */
  parentCount: number
  /** Oxirgi chat xabari vaqti (ISO) yoki null */
  lastMessageAt: string | null
}

/** Telegram bot orqali yuborilgan e'lon */
export interface Broadcast {
  id: string
  className: string
  text: string
  senderName: string
  createdAt: string
  /** Yuborilganda ro'yxatda bo'lgan ota-onalar (chatlar) soni */
  recipientCount: number
  /** Muvaffaqiyatli yetkazilganlar soni */
  sentCount: number
}

/** Telegramda ro'yxatdan o'tgan ota-ona */
export interface TelegramParent {
  studentId: string
  studentName: string
  /** O'quvchi guruhi */
  className: string
  /** O'quvchi balansi (manfiy = qarz) — qarzdorlar filtri uchun */
  balance: number
  parentName: string
  phone: string
  chatId: string
  createdAt: string
}

/** Telegramda ro'yxatdan o'tgan o'qituvchi (xodim ro'yxati) — "Tanlab" e'lon uchun */
export interface TelegramTeacher {
  teacherId: string
  teacherName: string
  phone: string
  chatId: string
  createdAt: string
}

/* ---------- O'quvchilarni baholash ---------- */

/** Baholash turi (admin xohlagancha qo'shadi: nom + ixtiyoriy izoh) */
export interface EvaluationType {
  id: string
  name: string
  description: string
}

/** Bitta davomat sababidan o'quvchida necha marta bo'lgani (jurnal belgilaridan) */
export interface AttendanceReasonCount {
  reasonId: string
  name: string
  short: string
  isLate: boolean
  count: number
}

/** Baholash jadvalidagi bitta o'quvchi qatori */
export interface EvaluationRow {
  studentId: string
  fullName: string
  className: string
  /** O'tilgan darslar soni (guruhga mos) */
  conducted: number
  /** Qatnashgan darslar = o'tilgan − davomatsizlik (kech keldi mustasno) */
  attended: number
  /** Davomat sabablari taqsimoti (har sababdan necha marta) */
  reasons: AttendanceReasonCount[]
  /** Baholash turi id → baho (1-5) */
  grades: Record<string, number>
  /** Baholar o'rtachasi (0 = baho yo'q) */
  avgGrade: number
}

/** Baholash jadvali: oylar katalogi, tanlangan oy/hafta, ustun turlari + o'quvchi qatorlari */
export interface EvaluationBoard {
  /** Mavjud oylar ("YYYY-MM"), yangidan eskiga */
  months: string[]
  /** Tanlangan (joriy) oy "YYYY-MM" */
  month: string
  /** Tanlangan hafta (0 = butun oy, 1..5) */
  week: number
  types: EvaluationType[]
  rows: EvaluationRow[]
  /** Tanlangan fan id'si ("" yoki "all" = fanlar o'rtachasi, faqat ko'rish). */
  subjectId?: string
  /** Mavjud fanlar (admin board fan selektori uchun). */
  subjects?: { id: string; name: string }[]
  /** Mavjud guruhlar (guruh selektori uchun). */
  groups?: { id: string; name: string }[]
  /** Tanlangan guruh id'si ("all" = barcha guruhlar). */
  groupId?: string
}

/* ---------- Intizomiy ball ---------- */

/** Intizomiy ball sababi (nomi + ball, musbat=rag'bat / manfiy=jazo) */
export interface DisciplineReason {
  id: string
  name: string
  points: number
  /** "other" — mustaqil intizomiy sabab; "attendance" — davomat sababi (jurnalda ishlatiladi) */
  kind: 'other' | 'attendance'
}

/** Ballar nazorati qatori: o'quvchi, guruh, plus, minus, qoldi (100 + plus − minus) */
export interface DisciplineScoreRow {
  studentId: string
  fullName: string
  className: string
  plus: number
  minus: number
  remaining: number
}

/** Bitta intizomiy ball yozuvi (tarix) */
export interface DisciplinePoint {
  id: string
  studentId: string
  reasonName: string
  points: number
  note: string
  createdAt: string
  createdBy: string
  /** "manual" — qo'lda (o'chirsa bo'ladi), "attendance" — jurnal davomati (faqat ko'rish) */
  source: 'manual' | 'attendance'
}

/** Telegram bot holati (admin UI uchun) */
export interface TelegramStatus {
  configured: boolean
  botUsername: string
}

/** Push uchun tanlanadigan oluvchi */
export interface PushRecipient {
  /** Akkaunt id (UserId) */
  userId: string
  name: string
  /** "Ota-ona" yoki "O'qituvchi" */
  group: string
  /** Qo'shimcha (ota-ona uchun guruh) */
  detail: string
  /** Qurilma ulanganmi (push haqiqatan yetadimi) */
  hasDevice: boolean
}

/** Yuborilgan push bildirishnoma (tarix) */
export interface PushMessage {
  id: string
  audience: string
  title: string
  body: string
  senderName: string
  createdAt: string
  recipientCount: number
  sentCount: number
  /** Nechta oluvchi "Tasdiqlash" bosgani */
  confirmedCount: number
  /** Jami oluvchi (bildirishnoma yozilganlar) */
  targetCount: number
}

/* ---------- Topshiriqlar (qo'shimcha) ---------- */

/** Topshiriq formati */
export type AssignmentFormat = 'written' | 'file' | 'test' | 'video' | 'speaking'

/** Topshiriqqa biriktirilgan material (yuklangan fayl yoki havola) */
export interface AssignmentMaterial {
  id: string
  name: string
  url: string
  size: number
  contentType: string
  /** Ixtiyoriy hamrohlik audio (masalan shu materialni ovoz chiqarib o'qigan yozuv) */
  audioUrl?: string | null
}

/** Test savoli (format=test) */
export interface TestQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
  order: number
}

/** Topshiriq natijasi — bitta o'quvchining holati (bajardi/bajarmadi + ball + yuborgan javobi) */
export interface SubmissionRow {
  studentId: string
  studentName: string
  className: string
  completed: boolean
  submittedAt: string | null
  /** Qo'yilgan/avto-hisoblangan ball (yo'q bo'lsa null) */
  score: number | null
  /** Yozma javob matni (format=written) */
  answerText: string | null
  /** Yuklangan fayl manzili (format=file/video) */
  fileUrl: string | null
}

/** Topshiriq bo'yicha natijalar (kim bajardi/bajarmadi) */
export interface AssignmentResult {
  assignmentId: string
  title: string
  /** Topshiriq formati — ballni ko'rsatish va javob turini bilish uchun */
  format: AssignmentFormat
  /** Maksimal ball */
  maxScore: number
  total: number
  completedCount: number
  rows: SubmissionRow[]
}

/** Topshiriqlar bali (admin) — ustun: bitta topshiriq */
export interface AssignmentScoreColumn {
  assignmentId: string
  title: string
  subjectName: string
  format: AssignmentFormat
  maxScore: number
  dueDate: string | null
}
/** Bitta katak — o'quvchining shu topshiriqdagi holati/bali */
export interface AssignmentScoreCell {
  assignmentId: string
  completed: boolean
  score: number | null
}
/** Bitta qator — o'quvchi va barcha topshiriqlardagi ballari */
export interface AssignmentScoreRow {
  studentId: string
  fullName: string
  className: string
  cells: AssignmentScoreCell[]
  totalScore: number
  totalMax: number
  gradedCount: number
}
/** Guruh bo'yicha topshiriqlar ball jadvali */
export interface AssignmentScoreboard {
  classId: string
  className: string
  assignments: AssignmentScoreColumn[]
  students: AssignmentScoreRow[]
}

/** Topshiriq/test (boy model) */
export interface Assignment {
  id: string
  createdByUserId: string
  subjectId: string
  subjectName: string
  title: string
  description: string
  format: AssignmentFormat
  /** Beriladigan guruhlar (id'lar) */
  classIds: string[]
  /** Guruh nomlari (ko'rsatish uchun) */
  classNames: string[]
  /** Boshlash vaqti (ISO) yoki null */
  startDate: string | null
  /** Tugash/muddat vaqti (ISO) yoki null */
  dueDate: string | null
  lateAccept: boolean
  latePenaltyPct: number
  maxScore: number
  autoGrade: boolean
  createdAt: string
  materials: AssignmentMaterial[]
  questions: TestQuestion[]
  /** Speaking (format=speaking) uchun o'qiladigan matn */
  referenceText?: string
}

/** Topshiriq turi (Sozlamalarda boshqariladi) */
export interface AssignmentType {
  id: string
  name: string
}

/** Ota-onalar bo'limidagi farzand (qisqacha) */
export interface ParentChild {
  studentId: string
  fullName: string
  className: string
  firstLoginAt: string | null
  lastLoginAt: string | null
  /** Oxirgi faol qurilma nomi */
  deviceName?: string
  platform?: string
  /** Push provayder app_id */
  appId?: string
}

/** Ota-onalar ro'yxati qatori (telefon bo'yicha guruhlangan) */
export interface ParentRow {
  fullName: string
  phone: string
  childrenCount: number
  isActivated: boolean
  activatedAt: string | null
  lastSeenAt: string | null
  children: ParentChild[]
  /** Oxirgi faol qurilma (farzandlar bo'yicha) */
  deviceName?: string
  platform?: string
}

/** Ilova → O'qituvchilar qatori (o'qituvchi ilova faolligi + qurilma) */
export interface TeacherAppRow {
  teacherId: string
  fullName: string
  phone: string
  isActivated: boolean
  activatedAt: string | null
  lastSeenAt: string | null
  deviceName: string
  platform: string
  appId: string
}

/** Admin xarita sahifasi uchun — joylashuvi bor bitta o'quvchi qatori */
export interface StudentLocationRow {
  studentId: string
  fullName: string
  className: string
  latitude: number
  longitude: number
  address?: string | null
  updatedAt?: string | null
}

/** O'qituvchi dars beradigan guruh (o'qituvchi paneli uchun) */
export interface TeacherClass {
  classId: string
  className: string
  grade: number
  /** Shu guruhda o'qituvchi o'qitadigan kurs(lar) */
  subjects: Subject[]
}

/** Portal umumiy konteksti (choraklar, davomat sabablari + joriy chorak/hafta) */
export interface PortalMeta {
  quarters: QuarterPeriod[]
  absenceReasons: AbsenceReason[]
  currentQuarter: number
  currentWeek: number
}

// ===================== Kurs o'quv dasturi (curriculum / syllabus) =====================

/** Dars turi: matnli / video / audio / lug'at / test / pdf */
export type LessonType = 'text' | 'video' | 'audio' | 'vocab' | 'test' | 'pdf'

export interface CurriculumItem {
  id: string
  text: string
  note: string
  order: number
  /** Dars turi (kontent) */
  type: LessonType
  /** Qisqa meta yorlig'i ("12 daq" / "15 so'z" / "10 savol") */
  meta: string
  /** Dars kontenti to'liq kiritilganmi (tayyor) */
  ready: boolean
}
export interface CurriculumTopic {
  id: string
  title: string
  note: string
  order: number
  items: CurriculumItem[]
}
export interface CurriculumLevel {
  id: string
  name: string
  note: string
  order: number
  topics: CurriculumTopic[]
}
export interface Curriculum {
  subjectId: string
  courseName: string
  levels: CurriculumLevel[]
}

// ===================== Amal sabablari (action reasons) =====================

/** Kategoriya: freeze | return_trial | remove_active | remove_trial | remove_frozen | lead_delete | group_delete */
export interface ActionReason {
  id: string
  category: string
  label: string
  order: number
}

// ===================== Daraja testi (placement test) =====================

export interface LevelTestListItem {
  id: string
  title: string
  courseId: string
  courseName: string
  slug: string
  isActive: boolean
  createdAt: string
  questionCount: number
  submissionCount: number
}

export interface LevelTestQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
  order: number
  /** "question" (baholanadigan, to'g'ri javobli) yoki "survey" (so'rovnoma, checkbox, baholanmaydi) */
  kind: 'question' | 'survey'
  /** survey uchun: ko'p tanlash (checkbox) mumkinmi */
  multiple: boolean
}

export interface LevelTestBand {
  id: string
  label: string
  minPercent: number
  order: number
}

export interface LevelTestDetail {
  id: string
  title: string
  courseId: string
  courseName: string
  slug: string
  intro: string
  isActive: boolean
  createdAt: string
  questions: LevelTestQuestion[]
  bands: LevelTestBand[]
}

export interface LevelTestSubmission {
  id: string
  fullName: string
  phone: string
  age: number
  score: number
  total: number
  percent: number
  level: string
  createdAt: string
  leadId: string
  /** So'rovnoma javoblari (baholanmagan) */
  survey: { question: string; answers: string[] }[]
}

/** Test yaratish/yangilash payload'i */
export interface LevelTestPayload {
  title: string
  courseId: string
  intro: string
  isActive: boolean
  questions: {
    id?: string
    text: string
    options: string[]
    correctIndex: number
    kind?: 'question' | 'survey'
    multiple?: boolean
  }[]
  bands: { id?: string; label: string; minPercent: number }[]
}

// Ommaviy (anonim)
export interface PublicTestQuestion {
  id: string
  text: string
  options: string[]
  kind: 'question' | 'survey'
  multiple: boolean
}

export interface PublicTest {
  title: string
  intro: string
  courseName: string
  questions: PublicTestQuestion[]
}

export interface TestResult {
  score: number
  total: number
  percent: number
  level: string
  message: string
}

/** Arxivlangan (o'chirilgan) yozuv — Arxiv bo'limida ko'rsatiladi. */
export interface ArchivedRecord {
  id: string
  type: string
  entityId: string
  title: string
  subtitle: string
  reason?: string
  deletedAt: string
  actorName: string
}

/* ---------- O'quvchi sertifikati ---------- */

export interface StudentCertificateDto {
  id: string
  courseName: string
  issuedAt: string
  expiresAt?: string | null
  /** "active" | "expired" | "revoked" */
  status: string
  fileName: string
  downloadUrl: string
  downloadCount: number
  metadata?: Record<string, string> | null
}

/* ---------- BALL / REYTING (jurnal baholari + bajarilgan baholash mezonlari) ---------- */

/** Bitta o'quvchining markaz bo'yicha bali (admin "O'quvchilar" ro'yxatidagi "Ball" ustuni) */
export interface StudentBall {
  studentId: string
  /** Jurnal baholari yig'indisi */
  journalTotal: number
  /** Bajarilgan baholash mezonlari soni */
  criteriaDone: number
  /** Ball = journalTotal + criteriaDone */
  ball: number
  /** O'rtacha baho (baho qo'yilgan darslar bo'yicha) */
  average: number
}

/** O'qituvchi reytingidagi bitta qator */
export interface TeacherRatingRow {
  /** O'rin (1 = eng yuqori ball) */
  rank: number
  studentId: string
  fullName: string
  /** Shu o'qituvchining qaysi guruhlarida o'qiydi (vergul bilan) */
  groups: string
  journalTotal: number
  criteriaDone: number
  ball: number
  average: number
  /** Davomat % (o'tilgan dars yo'q bo'lsa null) */
  attendance: number | null
}

/** O'qituvchi guruhlaridagi o'quvchilar reytingi */
export interface TeacherRating {
  teacherId: string
  fullName: string
  groupsCount: number
  studentsCount: number
  averageBall: number
  rows: TeacherRatingRow[]
}

/** Lid manbasi (ma'lumotnoma) */
export interface LeadSource {
  id: string
  name: string
  order: number
}

// ===================== Test natijalari (O'quv bo'limi → Testlar natijalari) =====================

/** Testlar natijalari bosh sahifasi — guruh kartasi (yaratilgan testlar soni bilan). */
export interface TestGroupOverview {
  groupId: string
  name: string
  courseName: string
  teacherName: string
  studentCount: number
  testCount: number
}

/** Bitta test qatori (guruh testlar ro'yxatida). */
export interface GroupTest {
  id: string
  groupId: string
  name: string
  date: string
  maxScore: number
  createdAt: string
  createdBy: string
  studentCount: number
  scoredCount: number
  avgScore: number | null
}

/** Test natijasi qatori — bitta o'quvchi bali (rank=0 → ball kiritilmagan). */
export interface TestScoreRow {
  studentId: string
  fullName: string
  score: number | null
  rank: number
}

/** Test tafsiloti — test + o'quvchilar ballari (ball desc bo'yicha saralangan). */
export interface TestResultDetail {
  id: string
  groupId: string
  groupName: string
  name: string
  date: string
  maxScore: number
  createdAt: string
  createdBy: string
  rows: TestScoreRow[]
}

/** O'quvchi profilidagi test natijasi qatori (barcha guruhlaridan). */
export interface StudentTestResult {
  testId: string
  groupId: string
  groupName: string
  name: string
  date: string
  maxScore: number
  score: number | null
  rank: number
  total: number
}
