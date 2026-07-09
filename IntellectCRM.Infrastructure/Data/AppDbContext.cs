using Microsoft.EntityFrameworkCore;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Domain;

namespace IntellectCRM.Infrastructure.Data;

/// <summary>
/// Markaz ma'lumotlar bazasi (bitta o'quv markazi — multi-tenant emas).
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options)
    : DbContext(options), IAppDbContext
{
    // Maktab ma'lumotlari
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<TeacherAttendance> TeacherAttendances => Set<TeacherAttendance>();
    public DbSet<TurnstileEvent> TurnstileEvents => Set<TurnstileEvent>();
    public DbSet<Camera> Cameras => Set<Camera>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Group> Classes => Set<Group>();
    public DbSet<StudentGroup> StudentGroups => Set<StudentGroup>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadStage> LeadStages => Set<LeadStage>();
    public DbSet<LeadEvent> LeadEvents => Set<LeadEvent>();
    public DbSet<TrialLesson> TrialLessons => Set<TrialLesson>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<LessonNote> LessonNotes => Set<LessonNote>();
    public DbSet<AbsenceReason> AbsenceReasons => Set<AbsenceReason>();
    public DbSet<DisciplineReason> DisciplineReasons => Set<DisciplineReason>();
    public DbSet<DisciplinePoint> DisciplinePoints => Set<DisciplinePoint>();
    public DbSet<EvaluationType> EvaluationTypes => Set<EvaluationType>();
    public DbSet<EvaluationGrade> EvaluationGrades => Set<EvaluationGrade>();
    public DbSet<GradingCriterion> GradingCriteria => Set<GradingCriterion>();
    public DbSet<GroupGradingCriterion> GroupGradingCriteria => Set<GroupGradingCriterion>();
    public DbSet<CriterionGrade> CriterionGrades => Set<CriterionGrade>();
    public DbSet<FinanceTransaction> FinanceTransactions => Set<FinanceTransaction>();
    public DbSet<MonthlyCharge> MonthlyCharges => Set<MonthlyCharge>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<CenterMeta> CenterMeta => Set<CenterMeta>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Broadcast> Broadcasts => Set<Broadcast>();
    public DbSet<PushMessage> PushMessages => Set<PushMessage>();
    public DbSet<TelegramRegistration> TelegramRegistrations => Set<TelegramRegistration>();
    public DbSet<BotUser> BotUsers => Set<BotUser>();
    public DbSet<TelegramGroup> TelegramGroups => Set<TelegramGroup>();
    public DbSet<StaffTask> StaffTasks => Set<StaffTask>();
    public DbSet<StaffTaskLog> StaffTaskLogs => Set<StaffTaskLog>();
    public DbSet<BotSupportMessage> BotSupportMessages => Set<BotSupportMessage>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<AssignmentType> AssignmentTypes => Set<AssignmentType>();
    public DbSet<AssignmentMaterial> AssignmentMaterials => Set<AssignmentMaterial>();
    public DbSet<TestQuestion> TestQuestions => Set<TestQuestion>();
    public DbSet<AssignmentSubmission> AssignmentSubmissions => Set<AssignmentSubmission>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<ContractTemplate> ContractTemplates => Set<ContractTemplate>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();

    // LMS (Ta'lim)

    // Kurs sillabusi (Daraja → Mavzu → Band) + o'quvchi progressi
    public DbSet<CourseLevel> CourseLevels => Set<CourseLevel>();
    public DbSet<CourseTopic> CourseTopics => Set<CourseTopic>();
    public DbSet<CourseItem> CourseItems => Set<CourseItem>();
    public DbSet<CourseQuestion> CourseQuestions => Set<CourseQuestion>();
    public DbSet<CourseProgress> CourseProgresses => Set<CourseProgress>();
    public DbSet<GroupCurriculumLog> GroupCurriculumLogs => Set<GroupCurriculumLog>();

    // Amal sabablari (muzlatish/o'chirish/sinovga qaytarish/lid/guruh)
    public DbSet<ActionReason> ActionReasons => Set<ActionReason>();

    // Arxiv — o'chirilgan entity'larning JSON suratlari (ko'rish/tiklash uchun)
    public DbSet<ArchivedRecord> ArchivedRecords => Set<ArchivedRecord>();

    // Daraja testi (placement test → lid)
    public DbSet<LevelTest> LevelTests => Set<LevelTest>();
    public DbSet<LevelTestQuestion> LevelTestQuestions => Set<LevelTestQuestion>();
    public DbSet<LevelTestBand> LevelTestBands => Set<LevelTestBand>();
    public DbSet<LevelTestSubmission> LevelTestSubmissions => Set<LevelTestSubmission>();
    public DbSet<LevelTestInvite> LevelTestInvites => Set<LevelTestInvite>();

    // Support o'qituvchi bo'sh vaqt slotlari + bron
    public DbSet<SupportSlot> SupportSlots => Set<SupportSlot>();

    // Sertifikatlar
    public DbSet<CertificateTemplate> CertificateTemplates => Set<CertificateTemplate>();
    public DbSet<StudentCertificate> StudentCertificates => Set<StudentCertificate>();
    public DbSet<CertificateVerification> CertificateVerifications => Set<CertificateVerification>();

    // O'quvchi AI tahlili (Gemini)
    public DbSet<StudentAiAnalysis> StudentAiAnalyses => Set<StudentAiAnalysis>();

    // Markaz kunlik AI tahlili (Gemini)
    public DbSet<CenterAiAnalysis> CenterAiAnalyses => Set<CenterAiAnalysis>();

    // Xodim roli shablonlari
    public DbSet<StaffRoleTemplate> StaffRoleTemplates => Set<StaffRoleTemplate>();

    // O'quv xonalari
    public DbSet<Room> Rooms => Set<Room>();

    // Eskiz.uz SMS
    public DbSet<SmsBatch> SmsBatches => Set<SmsBatch>();
    public DbSet<SmsLog> SmsLogs => Set<SmsLog>();
    public DbSet<SmsTemplate> SmsTemplates => Set<SmsTemplate>();

    // Avto-xabarlar (yagona model: SMS+Push+Telegram)
    public DbSet<AutoMessageRule> AutoMessageRules => Set<AutoMessageRule>();

    // Call Center — qo'ng'iroqlar jurnali
    public DbSet<Call> Calls => Set<Call>();

    // CTI (Local Call) — Android agent-ilovalar (xodim telefonlari) bilan lokal call-center
    public DbSet<CtiAgent> CtiAgents => Set<CtiAgent>();
    public DbSet<CtiCallRecord> CtiCallRecords => Set<CtiCallRecord>();
    public DbSet<CtiCallEvent> CtiCallEvents => Set<CtiCallEvent>();
    public DbSet<CtiCommandLog> CtiCommandLogs => Set<CtiCommandLog>();

    // Tuman + maktab
    public DbSet<District> Districts => Set<District>();
    public DbSet<School> Schools => Set<School>();

    // AI tekshiruv (Speaking/Writing) + o'quvchi ruxsati
    public DbSet<AiCheck> AiChecks => Set<AiCheck>();
    public DbSet<StudentAiAccess> StudentAiAccesses => Set<StudentAiAccess>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // SQL Server: indeksda qatnashadigan string ustunlar default `nvarchar(max)` bo'lib
        // indekslanmaydi — ularga aniq maksimal uzunlik beramiz (nvarchar(N)). Qolgan matn
        // maydonlari nvarchar(max) bo'lib qoladi (kesilmaydi). Unicode (o'zbek/kirill) — nvarchar
        // tabiatan qo'llab-quvvatlaydi, alohida charset sozlash shart emas.
        b.Entity<AppUser>().Property(u => u.Email).HasMaxLength(256);
        foreach (var (type, prop) in new (Type, string)[]
        {
            (typeof(JournalEntry), "ClassId"), (typeof(JournalEntry), "SubjectId"),
            (typeof(LessonNote), "ClassId"), (typeof(LessonNote), "SubjectId"),
            (typeof(StudentGroup), "StudentId"), (typeof(StudentGroup), "GroupId"),
            (typeof(LeadEvent), "LeadId"), (typeof(TrialLesson), "LeadId"),
            (typeof(FinanceTransaction), "Date"),
            (typeof(MonthlyCharge), "StudentId"), (typeof(MonthlyCharge), "Month"), (typeof(MonthlyCharge), "GroupId"),
            (typeof(AuditLog), "EntityType"), (typeof(AuditLog), "EntityId"), (typeof(AuditLog), "Timestamp"),
            (typeof(AuditLog), "StudentId"), (typeof(AuditLog), "TeacherId"),
            (typeof(ChatMessage), "ClassName"),
            (typeof(Broadcast), "ClassName"),
            (typeof(TelegramRegistration), "StudentId"),
            (typeof(Assignment), "ClassId"), (typeof(Assignment), "SubjectId"), (typeof(Assignment), "CreatedByUserId"),
            (typeof(AssignmentSubmission), "AssignmentId"), (typeof(AssignmentSubmission), "StudentId"),
            (typeof(DeviceToken), "Token"), (typeof(DeviceToken), "UserId"),
            (typeof(ContractTemplate), "Target"),
            (typeof(Contract), "Target"), (typeof(Contract), "RecipientKey"),
            (typeof(Feedback), "Status"),
        })
            b.Entity(type).Property(prop).HasMaxLength(200);

        // Login (Email) unikal — DB darajasidagi unique indeks TOCTOU poyga holatida ham dublikatni
        // bloklaydi (parallel ro'yxatdan o'tish login'ni buzmasin).
        b.Entity<AppUser>().HasIndex(u => u.Email).IsUnique();

        // Pul maydonlari uchun aniqlik (SQL Server decimal(18,2))
        b.Entity<Student>().Property(s => s.Balance).HasPrecision(18, 2);
        b.Entity<Student>().Property(s => s.DiscountAmount).HasPrecision(18, 2);
        b.Entity<Group>().Property(c => c.MonthlyFee).HasPrecision(18, 2);
        b.Entity<Group>().Property(c => c.TeacherSalaryPercent).HasPrecision(18, 2);
        b.Entity<Group>().Property(c => c.TeacherSalaryFixed).HasPrecision(18, 2);
        b.Entity<Subject>().Property(s => s.Price).HasPrecision(18, 2);
        b.Entity<FinanceTransaction>().Property(t => t.Amount).HasPrecision(18, 2);
        b.Entity<MonthlyCharge>().Property(c => c.Amount).HasPrecision(18, 2);
        b.Entity<MonthlyCharge>().Property(c => c.Discount).HasPrecision(18, 2);
        b.Entity<Teacher>().Property(t => t.Salary).HasPrecision(18, 2);
        b.Entity<Teacher>().Property(t => t.BonusPct).HasPrecision(18, 2);
        b.Entity<Teacher>().Property(t => t.SalaryPercent).HasPrecision(18, 2);
        b.Entity<CenterMeta>().Property(m => m.SalaryRate1).HasPrecision(18, 2);
        b.Entity<CenterMeta>().Property(m => m.SalaryRate2).HasPrecision(18, 2);
        b.Entity<CenterMeta>().Property(m => m.SalaryRateMutaxasis).HasPrecision(18, 2);
        b.Entity<CenterMeta>().Property(m => m.SalaryRateOliy).HasPrecision(18, 2);

        // Tez-tez ishlatiladigan filtrlar uchun indekslar
        b.Entity<JournalEntry>().HasIndex(e => new { e.ClassId, e.SubjectId, e.Quarter });
        b.Entity<LessonNote>().HasIndex(e => new { e.ClassId, e.SubjectId, e.Quarter });
        b.Entity<Group>().HasIndex(c => c.TeacherId);
        b.Entity<StudentGroup>().HasIndex(sg => new { sg.StudentId, sg.GroupId }).IsUnique();
        b.Entity<StudentGroup>().HasIndex(sg => sg.GroupId);
        b.Entity<StudentGroup>().HasIndex(sg => new { sg.StudentId, sg.IsActive });
        b.Entity<LeadEvent>().HasIndex(e => e.LeadId);
        b.Entity<TrialLesson>().HasIndex(t => t.LeadId);
        b.Entity<FinanceTransaction>().HasIndex(t => t.Date);
        // Per-guruh billing: har (o'quvchi, guruh, oy) uchun bitta hisob.
        b.Entity<MonthlyCharge>().HasIndex(c => new { c.StudentId, c.GroupId, c.Month }).IsUnique();
        b.Entity<GroupCurriculumLog>().HasIndex(g => new { g.GroupId, g.ItemId });
        b.Entity<CourseQuestion>().HasIndex(q => q.ItemId);
        b.Entity<GroupGradingCriterion>().HasIndex(g => g.GroupId);
        b.Entity<GroupGradingCriterion>().HasIndex(g => new { g.GroupId, g.CriterionId }).IsUnique();
        b.Entity<CriterionGrade>().HasIndex(g => new { g.GroupId, g.StudentId, g.CriterionId, g.Date }).IsUnique();
        b.Entity<CriterionGrade>().HasIndex(g => new { g.GroupId, g.Date });

        b.Entity<AuditLog>().HasIndex(a => new { a.EntityType, a.EntityId });
        b.Entity<StudentAiAnalysis>().HasIndex(a => new { a.StudentId, a.Date });
        b.Entity<CenterAiAnalysis>().HasIndex(a => a.Date);
        b.Entity<SmsLog>().HasIndex(s => s.RequestId);
        b.Entity<SmsLog>().HasIndex(s => s.BatchId);
        // Call Center: o'quvchi tarixi, raqam bo'yicha moslash, "eng oxirgisi tepada" ro'yxat.
        b.Entity<Call>().HasIndex(c => c.StudentId);
        b.Entity<Call>().HasIndex(c => c.PhoneNumber);
        b.Entity<Call>().HasIndex(c => c.StartedAt);
        b.Entity<Call>().HasIndex(c => c.AsteriskUniqueId);
        b.Entity<Call>().HasIndex(c => c.ProviderDbId);

        // CTI (Local Call): agent logini unikal, tarix filtri (agent/raqam/vaqt), hodisa kaskad.
        b.Entity<CtiAgent>().Property(a => a.Login).HasMaxLength(100);
        b.Entity<CtiAgent>().HasIndex(a => a.Login).IsUnique();
        b.Entity<CtiCallRecord>().Property(c => c.AgentId).HasMaxLength(200);
        b.Entity<CtiCallRecord>().Property(c => c.RemoteNumber).HasMaxLength(50);
        b.Entity<CtiCallRecord>().HasIndex(c => c.AgentId);
        b.Entity<CtiCallRecord>().HasIndex(c => c.RemoteNumber);
        b.Entity<CtiCallRecord>().HasIndex(c => c.StartedAt);
        b.Entity<CtiCallEvent>().Property(e => e.CallId).HasMaxLength(200);
        b.Entity<CtiCallEvent>().HasIndex(e => e.CallId);
        b.Entity<CtiCallEvent>()
            .HasOne<CtiCallRecord>().WithMany()
            .HasForeignKey(e => e.CallId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<CtiCommandLog>().HasIndex(c => c.AgentId);
        b.Entity<AuditLog>().HasIndex(a => a.Timestamp);
        b.Entity<AuditLog>().HasIndex(a => a.StudentId);
        b.Entity<AuditLog>().HasIndex(a => a.TeacherId);

        // Xabarlar (chat/e'lon/telegram)
        b.Entity<ChatMessage>().HasIndex(m => new { m.ClassName, m.CreatedAt });
        b.Entity<Broadcast>().HasIndex(x => new { x.ClassName, x.CreatedAt });
        b.Entity<TelegramRegistration>().HasIndex(r => new { r.StudentId, r.ChatId }).IsUnique();
        b.Entity<TelegramRegistration>().HasIndex(r => r.ChatId);
        b.Entity<BotUser>().HasIndex(u => u.ChatId).IsUnique();
        b.Entity<TelegramGroup>().HasIndex(g => g.ChatId).IsUnique();
        b.Entity<BotSupportMessage>().HasIndex(m => m.ChatId);

        // Qo'shimcha topshiriqlar
        b.Entity<Assignment>().HasIndex(a => new { a.ClassId, a.SubjectId, a.Quarter });
        b.Entity<Assignment>().HasIndex(a => a.CreatedByUserId);
        b.Entity<Assignment>()
            .HasMany(a => a.Materials).WithOne().HasForeignKey(m => m.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<Assignment>()
            .HasMany(a => a.Questions).WithOne().HasForeignKey(q => q.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<AssignmentSubmission>().HasIndex(x => new { x.AssignmentId, x.StudentId }).IsUnique();
        b.Entity<AssignmentSubmission>().HasIndex(x => x.StudentId);

        // Foydalanuvchi sozlamalari va qurilma tokenlari
        b.Entity<UserSettings>().HasKey(s => s.UserId);
        b.Entity<DeviceToken>().HasIndex(d => d.Token).IsUnique();
        b.Entity<DeviceToken>().HasIndex(d => d.UserId);

        // Shartnomalar
        b.Entity<ContractTemplate>().HasIndex(t => t.Target);
        b.Entity<Contract>().HasIndex(c => new { c.Target, c.RecipientKey });

        // Boshqaruv: filiallar va taklif/shikoyatlar
        b.Entity<Feedback>().HasIndex(f => new { f.Status, f.CreatedAt });

        // Kurs sillabusi — indekslarda qatnashadigan string ustunlarga aniq uzunlik beriladi.
        foreach (var (type, prop) in new (Type, string)[]
        {
            (typeof(CourseLevel), "SubjectId"),
            (typeof(CourseTopic), "LevelId"),
            (typeof(CourseItem), "TopicId"),
            (typeof(CourseProgress), "StudentId"), (typeof(CourseProgress), "ItemId"),
        })
            b.Entity(type).Property(prop).HasMaxLength(200);
        b.Entity<CourseLevel>().HasIndex(l => new { l.SubjectId, l.Order });
        b.Entity<CourseTopic>().HasIndex(t => new { t.LevelId, t.Order });
        b.Entity<CourseItem>().HasIndex(i => new { i.TopicId, i.Order });
        b.Entity<CourseProgress>().HasIndex(p => new { p.StudentId, p.ItemId }).IsUnique();

        b.Entity<ActionReason>().HasIndex(r => new { r.Category, r.Order });

        // Tuman + maktab (maktab tuman ichida tartiblanadi/qidiriladi).
        b.Entity<District>().HasIndex(d => d.Order);
        b.Entity<School>().Property(s => s.DistrictId).HasMaxLength(200);
        b.Entity<School>().HasIndex(s => new { s.DistrictId, s.Order });

        // AI tekshiruv — o'quvchi + sana bo'yicha (kunlik limit/tarix), ruxsat o'quvchi bo'yicha.
        b.Entity<AiCheck>().Property(a => a.StudentId).HasMaxLength(200);
        b.Entity<AiCheck>().HasIndex(a => new { a.StudentId, a.Date });
        b.Entity<StudentAiAccess>().Property(a => a.StudentId).HasMaxLength(200);
        b.Entity<StudentAiAccess>().HasIndex(a => a.StudentId).IsUnique();

        b.Entity<ArchivedRecord>().HasIndex(r => new { r.Type, r.DeletedAt });

        // Daraja testi — Slug ommaviy URL kaliti (noyob, indekslanishi uchun uzunlik beriladi).
        b.Entity<LevelTest>().Property(t => t.Slug).HasMaxLength(64);
        b.Entity<LevelTest>().HasIndex(t => t.Slug).IsUnique();
        b.Entity<LevelTestQuestion>().HasIndex(q => new { q.TestId, q.Order });
        b.Entity<LevelTestBand>().HasIndex(x => new { x.TestId, x.Order });
        b.Entity<LevelTestSubmission>().HasIndex(s => new { s.TestId, s.CreatedAt });
        b.Entity<LevelTestInvite>().HasIndex(i => i.Token).IsUnique();
        b.Entity<LevelTestInvite>().HasIndex(i => new { i.TestId, i.CreatedAt });
        b.Entity<LevelTestInvite>().HasIndex(i => i.LeadId);

        // Sertifikatlar
        b.Entity<CertificateTemplate>().Property(t => t.CourseId).HasMaxLength(200);
        b.Entity<CertificateTemplate>().HasIndex(t => t.CourseId);

        // StudentCertificate
        b.Entity<StudentCertificate>().Property(c => c.StudentId).HasMaxLength(200);
        b.Entity<StudentCertificate>().Property(c => c.CourseId).HasMaxLength(200);
        b.Entity<StudentCertificate>()
            .HasOne<Student>().WithMany()
            .HasForeignKey(c => c.StudentId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<StudentCertificate>()
            .HasOne<Subject>().WithMany()
            .HasForeignKey(c => c.CourseId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<StudentCertificate>().HasIndex(c => new { c.StudentId, c.CourseId });
        b.Entity<StudentCertificate>().HasIndex(c => c.Status);
        b.Entity<StudentCertificate>().HasIndex(c => new { c.StudentId, c.CourseId, c.IssuedAt }).IsUnique();

        // CertificateVerification → StudentCertificate (FK, CASCADE)
        b.Entity<CertificateVerification>().Property(v => v.StudentCertificateId).HasMaxLength(200);
        b.Entity<CertificateVerification>()
            .HasOne<StudentCertificate>().WithMany()
            .HasForeignKey(v => v.StudentCertificateId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<CertificateVerification>().HasIndex(v => v.StudentCertificateId);

        // O'quv xonalari — tez-tez ishlatiladigan filtrlar
        b.Entity<Room>().HasIndex(r => r.IsActive);
        b.Entity<Room>().HasIndex(r => new { r.Name, r.IsActive });

        // Group.RoomId → Room (SET NULL on delete)
        b.Entity<Group>().HasIndex(c => c.RoomId);
        b.Entity<Group>()
            .HasOne<Room>().WithMany()
            .HasForeignKey(c => c.RoomId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
