using Microsoft.EntityFrameworkCore;
using IntellectCRM.Domain;

namespace IntellectCRM.Application.Abstractions;

/// <summary>
/// Ma'lumotlar bazasi konteksti abstraksiyasi. Application qatlamidagi xizmatlar
/// (Services) konkret <c>AppDbContext</c> (Infrastructure) o'rniga shu interfeysga
/// bog'lanadi — bu bog'liqlik yo'nalishini ichkariga (Domain/Application tomon)
/// saqlaydi. Infrastructure'dagi <c>AppDbContext</c> shu interfeysni implement qiladi,
/// DI esa <c>IAppDbContext</c> ni o'sha scoped <c>AppDbContext</c> ga ulaydi.
/// </summary>
public interface IAppDbContext
{
    DbSet<AppUser> Users { get; }
    DbSet<Student> Students { get; }
    DbSet<Teacher> Teachers { get; }
    DbSet<TeacherAttendance> TeacherAttendances { get; }
    DbSet<TurnstileEvent> TurnstileEvents { get; }
    DbSet<Camera> Cameras { get; }
    DbSet<Subject> Subjects { get; }
    DbSet<Group> Classes { get; }
    DbSet<StudentGroup> StudentGroups { get; }
    DbSet<Lead> Leads { get; }
    DbSet<LeadStage> LeadStages { get; }
    DbSet<LeadEvent> LeadEvents { get; }
    DbSet<TrialLesson> TrialLessons { get; }
    DbSet<JournalEntry> JournalEntries { get; }
    DbSet<LessonNote> LessonNotes { get; }
    DbSet<LessonReschedule> LessonReschedules { get; }
    DbSet<AbsenceReason> AbsenceReasons { get; }
    DbSet<DisciplineReason> DisciplineReasons { get; }
    DbSet<DisciplinePoint> DisciplinePoints { get; }
    DbSet<EvaluationType> EvaluationTypes { get; }
    DbSet<EvaluationGrade> EvaluationGrades { get; }
    DbSet<GradingCriterion> GradingCriteria { get; }
    DbSet<GroupGradingCriterion> GroupGradingCriteria { get; }
    DbSet<CriterionGrade> CriterionGrades { get; }
    DbSet<FinanceTransaction> FinanceTransactions { get; }
    DbSet<MonthlyCharge> MonthlyCharges { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<CenterMeta> CenterMeta { get; }
    DbSet<ChatMessage> ChatMessages { get; }
    DbSet<Broadcast> Broadcasts { get; }
    DbSet<PushMessage> PushMessages { get; }
    DbSet<TelegramRegistration> TelegramRegistrations { get; }
    DbSet<BotUser> BotUsers { get; }
    DbSet<TelegramGroup> TelegramGroups { get; }
    DbSet<StaffTask> StaffTasks { get; }
    DbSet<StaffTaskLog> StaffTaskLogs { get; }
    DbSet<BotSupportMessage> BotSupportMessages { get; }
    DbSet<Assignment> Assignments { get; }
    DbSet<AssignmentType> AssignmentTypes { get; }
    DbSet<AssignmentMaterial> AssignmentMaterials { get; }
    DbSet<TestQuestion> TestQuestions { get; }
    DbSet<AssignmentSubmission> AssignmentSubmissions { get; }
    DbSet<UserSettings> UserSettings { get; }
    DbSet<DeviceToken> DeviceTokens { get; }
    DbSet<UserNotification> UserNotifications { get; }
    DbSet<ContractTemplate> ContractTemplates { get; }
    DbSet<Contract> Contracts { get; }
    DbSet<Branch> Branches { get; }
    DbSet<Feedback> Feedbacks { get; }

    // Tuman + maktab (o'quvchi formasi uchun, sozlamalardan boshqariladi)
    DbSet<District> Districts { get; }
    DbSet<School> Schools { get; }

    // AI tekshiruv (Speaking/Writing) + o'quvchi ruxsati
    DbSet<AiCheck> AiChecks { get; }
    DbSet<StudentAiAccess> StudentAiAccesses { get; }

    // LMS (Ta'lim)

    // Kurs sillabusi (Daraja → Mavzu → Band) + o'quvchi progressi
    DbSet<CourseLevel> CourseLevels { get; }
    DbSet<CourseTopic> CourseTopics { get; }
    DbSet<CourseItem> CourseItems { get; }
    DbSet<CourseQuestion> CourseQuestions { get; }
    DbSet<CourseProgress> CourseProgresses { get; }
    DbSet<GroupCurriculumLog> GroupCurriculumLogs { get; }

    // Amal sabablari (muzlatish/o'chirish/sinovga qaytarish/lid/guruh)
    DbSet<ActionReason> ActionReasons { get; }
    DbSet<LeadSource> LeadSources { get; }

    // Arxiv — o'chirilgan entity'larning JSON suratlari (ko'rish/tiklash uchun)
    DbSet<ArchivedRecord> ArchivedRecords { get; }

    // Daraja testi (placement test → lid)
    DbSet<LevelTest> LevelTests { get; }
    DbSet<LevelTestQuestion> LevelTestQuestions { get; }
    DbSet<LevelTestBand> LevelTestBands { get; }
    DbSet<LevelTestSubmission> LevelTestSubmissions { get; }
    DbSet<LevelTestInvite> LevelTestInvites { get; }

    // Support o'qituvchi bo'sh vaqt slotlari + bron
    DbSet<SupportSlot> SupportSlots { get; }

    // Sertifikatlar
    DbSet<CertificateTemplate> CertificateTemplates { get; }
    DbSet<StudentCertificate> StudentCertificates { get; }
    DbSet<CertificateVerification> CertificateVerifications { get; }

    // O'quvchi AI tahlili (Gemini)
    DbSet<StudentAiAnalysis> StudentAiAnalyses { get; }

    // Markaz (butun o'quv markazi) kunlik AI tahlili (Gemini)
    DbSet<CenterAiAnalysis> CenterAiAnalyses { get; }

    // O'quv xonalari
    DbSet<Room> Rooms { get; }

    // Eskiz.uz SMS — yuborish partiyalari, raqam bo'yicha jurnal, andozalar
    DbSet<SmsBatch> SmsBatches { get; }
    DbSet<SmsLog> SmsLogs { get; }
    DbSet<SmsTemplate> SmsTemplates { get; }

    // Avto-xabarlar (yagona model: SMS+Push+Telegram) — Xabarlar → Avto xabarlar
    DbSet<AutoMessageRule> AutoMessageRules { get; }

    // Call Center — qo'ng'iroqlar jurnali
    DbSet<Call> Calls { get; }

    // CTI (Local Call) — Android agent-ilovalar bilan lokal call-center
    DbSet<CtiAgent> CtiAgents { get; }
    DbSet<CtiCallRecord> CtiCallRecords { get; }
    DbSet<CtiCallEvent> CtiCallEvents { get; }
    DbSet<CtiCommandLog> CtiCommandLogs { get; }

    int SaveChanges();
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
