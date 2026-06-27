namespace IntellectCRM.Application.Dtos;

using System.ComponentModel.DataAnnotations;
using IntellectCRM.Domain;

// Frontend servislari kutadigan so'rov (request) va javob (response) shakllari.
// JSON camelCase'ga ASP.NET Core standart sozlamasi orqali aylantiriladi.

/* ---------- Auth ---------- */
public record LoginRequest(string Email, string Password);
public record UserDto(
    string Id, string FullName, string Role, string Email, string? AvatarUrl,
    List<string>? Permissions = null, string Phone = "");
public record LoginResponse(string Token, UserDto User);
/// <summary>O'quvchi/o'qituvchiga biriktirilgan tizim akkaunti ma'lumotlari (admin uchun).</summary>
public record CredentialsDto(string Login, string Password, string Role);
/// <summary>Joriy foydalanuvchi o'z login (email) va/yoki parolini o'zgartirishi uchun.
/// NewPassword bo'sh bo'lsa — parol o'zgarmaydi. CurrentPassword har doim talab qilinadi.
/// <paramref name="Phone"/> — ixtiyoriy, kiritilsa PhoneUtil.Normalize() orqali standartlashtirilib saqlanadi
/// (format: +998-XX-XXX-XX-XX; maksimum 32 belgi).</summary>
public record UpdateAccountRequest(string? Email, string CurrentPassword, string? NewPassword, string? Phone = null);
/// <summary>O'quvchi/ota-ona ilova ichida o'z parolini almashtirishi uchun.
/// Joriy parol bilan tasdiqlanadi; yangi parol kamida 8 belgi.</summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/* ---------- Students ---------- */
/// <summary>
/// O'quvchi yaratish/tahrirlash so'rovi. FISH alohida-alohida kiritiladi (LastName/FirstName/MiddleName);
/// agar bo'lsa, ulardan FullName yig'iladi. Ota-ona FISH ham alohida.
/// FullName/ParentFullName ixtiyoriy — yo'q bo'lsa parts'dan yig'iladi.
///
/// TELEFON VALIDATSIYA (PhoneUtil.Normalize orqali standartlashtirilib saqlanadi):
/// - <paramref name="Phone"/> — o'quvchi o'z raqami (ixtiyoriy, max 32 belgi); format: +998-XX-XXX-XX-XX
/// - <paramref name="FatherPhone"/> — ota raqami (ixtiyoriy, max 32 belgi)
/// - <paramref name="MotherPhone"/> — ona raqami (ixtiyoriy, max 32 belgi)
/// - <paramref name="ParentPhone"/> — asosiy ota-ona kontakti (ixtiyoriy, max 32 belgi);
///   tahrirda fatherPhone/motherPhone bo'lsa ular asosiy kontakt uchun ishlatiladi
/// Raqamlar ixtiyoriy; kiritilsa kamida 7 ta raqam bo'lishi kerak va 998 prefiksini o'z ichiga olishi kerak yoki
/// avtomatik 998 prefiksi qo'shiladi. Standartlashtirilgan format: +998-XX-XXX-XX-XX.
/// </summary>
public record StudentPayload(
    string FullName, string BirthDate, string Address, string Gender,
    string? ParentFullName, string? ParentPhone, string ClassName, string? EnrollmentDate,
    string? NewPassword = null,
    int? DiscountPct = null, decimal? DiscountAmount = null, string? DiscountNote = null,
    string? LastName = null, string? FirstName = null, string? MiddleName = null,
    string? BirthCertificateUrl = null,
    string? ParentLastName = null, string? ParentFirstName = null, string? ParentMiddleName = null,
    string? ParentPassportUrl = null,
    string? Phone = null,
    string? FatherFullName = null, string? FatherPhone = null,
    string? MotherFullName = null, string? MotherPhone = null);
public record PaymentRequest(decimal Amount, string? Month, string? GroupId = null, string? Comment = null);

/* ---------- Telefon dublikatini tekshirish (o'quvchi/ota-ona raqami) ---------- */
public record CheckPhonesRequest(
    string? Phone, string? FatherPhone, string? MotherPhone, string? ParentPhone, string? ExcludeId);
/// <summary>Mos kelgan mavjud o'quvchi: <paramref name="Phone"/> — kiritilgan (mos kelgan) raqam,
/// <paramref name="Role"/> — mavjud yozuvda qaysi raqam (O'quvchi/Ota/Ona/Ota-ona).</summary>
public record PhoneMatchDto(
    string Phone, string StudentId, string FullName, string ClassName, bool IsArchived, string Role);

/* ---------- Excel'dan ommaviy import ---------- */
public record StudentImportRowErrorDto(int Row, string Message);
public record StudentImportResultDto(int Created, int Failed, int Skipped, List<StudentImportRowErrorDto> Errors);

/* ---------- Teachers ---------- */
/// <summary>O'qituvchi yaratish/tahrirlash so'rovi.
/// <paramref name="Phone"/> — o'qituvchi telefoni (ixtiyoriy, max 32 belgi);
/// PhoneUtil.Normalize() orqali standartlashtirilib saqlanadi (format: +998-XX-XXX-XX-XX).
/// Kiritilsa kamita 7 ta raqam bo'lishi kerak. 998 prefiksi avtomatik qo'shiladi.
/// </summary>
public record TeacherPayload(
    string FullName, string BirthDate, string Address, string Gender,
    string HomeroomClass, List<string> SubjectIds, decimal Salary, string? SalaryStartMonth,
    string? NewPassword = null, List<string>? Permissions = null, string? Phone = null,
    string? PhotoUrl = null, string? Category = null, string? SalaryStartDate = null,
    string? SalaryMode = null, decimal SalaryPercent = 0, bool IsSupport = false);
public record MonthSalaryDto(string Month, decimal Expected, decimal Paid, decimal Remaining, string Status);
/// <summary>
/// Maosh hisobida bitta guruhning ulushi (davr bo'yicha): qaysi rejim (foiz/qat'iy), qiymati,
/// shu davrda guruhdan yig'ilgan to'lov bazasi va shu guruh keltirgan hisoblangan maosh.
/// </summary>
public record GroupSalaryLineDto(
    string GroupId, string GroupName, string CourseName, decimal MonthlyFee,
    string Mode, decimal Percent, decimal Fixed,
    decimal PeriodCollected, decimal PeriodExpected);
public record SalaryLedgerDto(
    string TeacherId, string FullName, decimal Salary,
    decimal TotalExpected, decimal TotalPaid, decimal Remaining,
    List<MonthSalaryDto> Months, List<PaymentDto> Payments,
    string SalaryMode = "fixed", decimal SalaryPercent = 0,
    List<GroupSalaryLineDto>? Groups = null);

/// <summary>O'qituvchi guruhlari maosh sozlamasini yangilash (per-guruh foiz/qat'iy summa).</summary>
public record GroupSalaryItemDto(string GroupId, string Mode, decimal Percent, decimal Fixed);
public record GroupSalaryUpdateRequest(List<GroupSalaryItemDto> Items);
public record SalaryReportRowDto(
    string TeacherId, string TeacherName, decimal Salary, decimal TotalPaid, int PaymentsCount,
    int Months, decimal Expected, decimal Remaining,
    string SalaryMode = "fixed", decimal SalaryPercent = 0);

/// <summary>O'qituvchilar davomati — oylik board (o'qituvchilar + belgilangan kunlar).</summary>
public record TeacherNameDto(string Id, string FullName, string StartDate = "");
public record TeacherAttendanceDto(string TeacherId, string Date, string Status, string Note);
public record TeacherAttendanceBoardDto(
    List<TeacherNameDto> Teachers, List<TeacherAttendanceDto> Entries);
public record SetTeacherAttendanceRequest(string TeacherId, string Date, string? Status, string? Note);
/// <summary>Bitta kun uchun BARCHA faol o'qituvchini belgilash (status bo'sh = o'sha kun tozalanadi).</summary>
public record SetTeacherAttendanceDayRequest(string Date, string? Status);

// ---------- Turniket/FaceID: o'qituvchilar davomati dashboard ----------
/// <summary>Dashboard bitta o'qituvchi qatori (kunlik).</summary>
public record TeacherDashboardRowDto(
    string TeacherId, string FullName, string? PhotoUrl, string DeviceUserId,
    string Status, string CheckIn, string CheckOut, string Expected, int LateMinutes, string Source);
/// <summary>Kunlik davomat jamlamasi.</summary>
public record AttendanceSummaryDto(int Total, int Present, int Late, int Absent, int NotArrived);
/// <summary>O'qituvchilar davomati dashboard (tanlangan kun).</summary>
public record TeacherAttendanceDashboardDto(
    string Date, bool TurnstileEnabled, string LastSync,
    AttendanceSummaryDto Summary, List<TeacherDashboardRowDto> Rows);
/// <summary>Sinxronlash natijasi.</summary>
public record TurnstileSyncResultDto(bool Ok, string Message, int EventsFetched, int Updated, string LastSync);

// ---------- Turniket: o'quvchilar kirgan/chiqqan vaqti ----------
/// <summary>O'quvchi turniket qatori: FISH, sinf, qurilma ID, kirgan/chiqqan vaqt (tanlangan kun).</summary>
public record StudentTurnstileRowDto(
    string StudentId, string FullName, string ClassName, string DeviceUserId,
    string CheckIn, string CheckOut, int Passes);
/// <summary>O'quvchilar turniket dashboard (tanlangan kun).</summary>
public record StudentTurnstileDashboardDto(
    string Date, bool TurnstileEnabled, string LastSync, int Present, int Total,
    List<StudentTurnstileRowDto> Rows);
/// <summary>O'quvchiga qurilma (turniket) ID biriktirish.</summary>
public record SetStudentDeviceRequest(string StudentId, string? DeviceUserId);
// ---------- Kamera (videokuzatuv) ----------
public record CameraDto(
    string Id, string Name, string Location, string RtspUrl, string RtspSubUrl,
    int RetentionDays, bool IsActive, string Note);
public record SaveCameraRequest(
    string Name, string? Location, string RtspUrl, string? RtspSubUrl,
    int RetentionDays = 7, bool IsActive = true, string? Note = null);
/// <summary>Kamera integratsiya sozlamasi.</summary>
public record CameraSettingsDto(bool Enabled, int CameraCount);
public record SaveCameraSettingsRequest(bool Enabled);
/// <summary>Avtomatik to'lov eslatmasi sozlamasi (qarzdorlarga Telegram + push, har 2 kunda).</summary>
public record PaymentReminderSettingsDto(bool Enabled);
public record SavePaymentReminderSettingsRequest(bool Enabled);
/// <summary>Moliyada o'quvchi qatori. Charged = jami to'liq oylik (chegirmasiz);
/// Discount = jami berilgan chegirma; Paid = haqiqiy naqd to'lovlar yig'indisi (turli oylar uchun);
/// Debt / Advance — joriy holatdan (balans). DiscountPct/Amount — qoidani ko'rsatish uchun.</summary>
public record StudentFinanceRowDto(
    string StudentId, string FullName, string ClassName,
    decimal Charged, decimal Discount, decimal Paid, decimal Debt, decimal Advance,
    int DiscountPct = 0, decimal DiscountAmount = 0);

/* ---------- Subjects (Kurslar) ---------- */
public record SubjectPayload(string Name, decimal Price = 0, decimal LessonPrice = 0);

/* ---------- Guruhlar (Groups) ---------- */
/// <summary>Xona konflikti: mavjud guruh bir xil xona, kun va vaqtda ishlaydi.</summary>
public record RoomConflictDto(
    string GroupId, string GroupName, string SharedDays, string ExistingSlot);

public record ClassPayload(
    string Name, int Grade, string Language, decimal MonthlyFee, string? Room,
    string? Status = null, string? StartDate = null, string? EndDate = null, int Capacity = 0,
    string? CourseId = null, string? TeacherId = null, string? Note = null,
    List<int>? Days = null, string? StartTime = null, string? EndTime = null,
    string? RoomId = null);

/// <summary>O'quvchining bitta guruh a'zoligi (M2M).</summary>
public record StudentGroupDto(
    string Id, string GroupId, string GroupName, string JoinedAt, string? LeftAt, bool IsActive,
    string Status, string CourseName, string TeacherName, decimal MonthlyFee,
    List<int> Days, string StartTime, string EndTime, string Room);
/// <summary>Guruhdagi bitta o'quvchi (a'zolar ro'yxati).</summary>
public record GroupMemberDto(
    string StudentId, string FullName, string JoinedAt, string? LeftAt, bool IsActive,
    string Status, string ActivatedAt, string FrozenAt, decimal Balance);
/// <summary>O'quvchini guruhga qo'shish so'rovi.</summary>
public record AddStudentToGroupRequest(string StudentId, string? JoinedAt);
/// <summary>A'zolikni aktivlashtirish/muzlatish so'rovi (sana ISO "YYYY-MM-DD"; bo'sh = bugun).</summary>
public record MembershipStatusRequest(string? Date, string? ReasonId = null);
/// <summary>Guruh to'ldirish hisoboti qatori: sig'im vs ro'yxatdagilar.</summary>
public record GroupFillRowDto(
    string GroupId, string Name, int Grade, int Capacity, int Enrolled, int FreeSeats, string Status);

/* ---------- Leads (CRM) ---------- */
/// <summary>Lid (bo'lajak o'quvchi) yaratish so'rovi.
/// TELEFON VALIDATSIYA (PhoneUtil.Normalize orqali standartlashtirilib saqlanadi):
/// - <paramref name="Phone"/> — lidning o'z raqami (ixtiyoriy, max 32 belgi); format: +998-XX-XXX-XX-XX
/// - <paramref name="FatherPhone"/> — ota raqami (ixtiyoriy, max 32 belgi)
/// - <paramref name="MotherPhone"/> — ona raqami (ixtiyoriy, max 32 belgi)
/// Raqamlar ixtiyoriy; kiritilsa kamita 7 ta raqam bo'lishi kerak. 998 prefiksi avtomatik qo'shiladi.
/// </summary>
public record LeadCreateRequest(
    string FullName, string Gender, string BirthDate,
    string? Phone, string? FatherFullName, string? FatherPhone,
    string? MotherFullName, string? MotherPhone, string? Note, string Stage,
    string? Source = null, string? InterestSubject = null);
/// <summary>Lid (bo'lajak o'quvchi) tahrirlash so'rovi.
/// TELEFON VALIDATSIYA (PhoneUtil.Normalize orqali standartlashtirilib saqlanadi):
/// - <paramref name="Phone"/> — lidning o'z raqami (ixtiyoriy, max 32 belgi); format: +998-XX-XXX-XX-XX
/// - <paramref name="FatherPhone"/> — ota raqami (ixtiyoriy, max 32 belgi)
/// - <paramref name="MotherPhone"/> — ona raqami (ixtiyoriy, max 32 belgi)
/// Raqamlar ixtiyoriy; kiritilsa kamita 7 ta raqam bo'lishi kerak. 998 prefiksi avtomatik qo'shiladi.
/// </summary>
public record LeadUpdateRequest(
    string FullName, string Gender, string BirthDate,
    string? Phone, string? FatherFullName, string? FatherPhone,
    string? MotherFullName, string? MotherPhone, string? Note,
    string? Source = null, string? InterestSubject = null);
public record LeadStageRequest(string Stage);

/// <summary>Lid hodisasi (tarix).</summary>
public record LeadEventDto(string Id, string Type, string Text, string ActorName, string CreatedAt);
/// <summary>Lidga hodisa/izoh qo'shish.</summary>
public record AddLeadEventRequest(string Type, string Text);
/// <summary>Lidni o'quvchiga aylantirish. EnrollmentDate berilmasa — bugun; GroupId berilsa o'quvchi shu guruhga qo'shiladi.</summary>
public record ConvertLeadRequest(string? EnrollmentDate, string? GroupId);
/// <summary>Sinov darsi.</summary>
public record TrialLessonDto(
    string Id, string LeadId, string GroupId, string GroupName, string ScheduledAt, string Result, string CreatedAt);
/// <summary>Sinov darsini belgilash.</summary>
public record ScheduleTrialRequest(string GroupId, string ScheduledAt);
/// <summary>Sinov darsi natijasi: stayed (qoldi) | left (ketdi).</summary>
public record TrialResultRequest(string Result);

/// <summary>Lid + birinchi dars davomat holati: "attended" | "absent" | "no-lesson".</summary>
public record LeadWithAttendanceDto(
    string Id, string FullName, string Gender, string BirthDate, string Phone,
    string FatherFullName, string FatherPhone, string MotherFullName, string MotherPhone,
    string? Note, string Stage, string Source, string InterestSubject, string? CreatedAt,
    string? ConvertedStudentId, string? FirstLessonAttendance);

/// <summary>CRM statistikasi: jami, bosqich/manba bo'yicha, konversiya %, oylik dinamika.</summary>
public record CrmStatChartItemDto(string Label, int Count);
public record CrmMonthlyDto(string Month, int Created, int Converted);
public record CrmStatsDto(
    int TotalLeads, int Converted, double ConversionRate,
    List<CrmStatChartItemDto> ByStage, List<CrmStatChartItemDto> BySource,
    List<CrmMonthlyDto> Monthly);

/* ---------- Lead stages ---------- */
public record StagePayload(string Title, string Color);
public record ReorderRequest(List<string> Ids);

/* ---------- Journal ---------- */
/// <summary>Jurnal ustuni — bir dars (sana + dars raqami).</summary>
public record JournalColumnDto(string Date, int Period);
/// <summary>Mavzular Excel importidagi xato qator (Excel qator raqami + sabab).</summary>
public record TopicImportRowErrorDto(int Row, string Reason);
/// <summary>Mavzular Excel import natijasi: to'ldirilgan / o'tkazib yuborilgan (bo'sh) / xato qatorlar.</summary>
public record TopicImportResultDto(int Imported, int Skipped, int Errors, List<TopicImportRowErrorDto> RowErrors);
public record JournalEntryDto(
    string StudentId, string Date, int Period, int? Grade, string? ReasonId,
    int Homework, int Behavior, MasteryLevel? Mastery);
public record SetJournalEntryRequest(
    string ClassId, string SubjectId, int Quarter, string StudentId, string Date, int Period,
    int? Grade, string? ReasonId, int Homework = 0, int Behavior = 0, MasteryLevel? Mastery = null);
public record JournalTopicDto(string Date, int Period, string Topic, string? Homework, bool Conducted);
/// <summary>Berilgan sanada o'tilgan (conducted) darslar — sinf+fan+dars raqami.</summary>
public record ConductedLessonDto(string ClassId, string SubjectId, int Period);

/* ---------- Guruh OYLIK jurnali (guruh sahifasidan) ---------- */
/// <summary>Guruh jurnali sarlavhasi: guruh + kurs + o'qituvchi + jadval ma'lumotlari.</summary>
public record GroupJournalInfoDto(
    string Id, string Name, string CourseId, string CourseName, string TeacherName,
    List<int> Days, string StartTime, string EndTime, string Room, string StartDate, decimal MonthlyFee);
/// <summary>Guruh jurnalidagi o'quvchi qatori (faqat faol a'zolar).</summary>
public record GroupJournalStudentDto(string StudentId, string FullName, string Status, string ActivatedAt, decimal Balance);
/// <summary>Guruhning bitta oylik jurnali: ustunlar guruh dars kunlari bo'yicha avtomatik, qatorlar — faol o'quvchilar.
/// <see cref="ConductedDates"/> — "o'tildi" deb belgilangan dars sanalari (sababsiz o'quvchi shu kunda KELDI = yashil).</summary>
public record GroupJournalDto(
    GroupJournalInfoDto Group, List<string> Months, string Month,
    List<JournalColumnDto> Columns, List<GroupJournalStudentDto> Students, List<JournalEntryDto> Entries,
    List<string> ConductedDates);
/// <summary>Bitta dars (sana) uchun BARCHA o'quvchiga birdan davomat. <see cref="Absent"/>=false → hammasi KELDI
/// (sabablar tozalanadi). =true → hammasi KELMADI: <see cref="ReasonId"/> berilsa shu sabab, aks holda standart
/// "Sababsiz" (yo'q bo'lsa avtomatik yaratiladi). Ikkala holatda ham dars "o'tildi" (Conducted) bo'ladi.</summary>
public record BulkAttendanceRequest(
    string ClassId, string SubjectId, string Date, int Period, List<string> StudentIds,
    string? ReasonId, bool Absent = false);
public record SetLessonNoteRequest(
    string ClassId, string SubjectId, int Quarter, string Date, int Period, string Topic, string? Homework, bool Conducted);

/* ---------- Settings ---------- */
public record LessonTimeDto(int Period, string StartTime, string EndTime);
public record AbsenceReasonDto(string Id, string Name, string Short, bool IsLate);
/// <summary>Jadval/hafta navigatsiyasi uchun davr oralig'i. Markazda chorak tizimi YO'Q —
/// bu o'quv yili oralig'idan sintez qilingan bitta davr (frontend hafta hisobi uchun).</summary>
public record QuarterPeriodDto(int Quarter, string StartDate, string EndDate, bool GradesOpen);
public record SchoolSettingsDto(
    List<LessonTimeDto> LessonTimes, List<AbsenceReasonDto> AbsenceReasons,
    List<QuarterPeriodDto> Quarters);
public record SaveAbsenceReasonsRequest(List<AbsenceReasonDto> AbsenceReasons);

/* ---------- Dashboard ---------- */
public record AdminStatsDto(int StudentsCount, int TeachersCount, double AverageGrade, double? AttendanceRate);
public record ClassPerformanceItemDto(string ClassId, string ClassName, double AverageGrade, double? AttendanceRate, string TeacherName = "");
public record TopClassDto(string Id, string Name, int StudentsCount, int ActiveCount, double AverageGrade);
public record StudentBreakdownDto(int Active, int Inactive, int Debtors, int Paid, int WithGroup, int WithoutGroup);
public record AdminDashboardDto(
    AdminStatsDto Stats, List<ClassPerformanceItemDto> ClassPerformance, List<TopClassDto> TopClasses,
    StudentBreakdownDto StudentBreakdown, int TotalGradesCount = 0);

/* ---------- Class performance / rating ---------- */
public record SubjectDto(string Id, string Name, decimal Price = 0);
public record StudentDto(
    string Id, string FullName, string BirthDate, string Address, string Gender,
    string ParentFullName, string ParentPhone, string ClassName, string EnrollmentDate, decimal Balance,
    int DiscountPct = 0, decimal DiscountAmount = 0, string DiscountNote = "",
    string LastName = "", string FirstName = "", string MiddleName = "",
    string? BirthCertificateUrl = null,
    string ParentLastName = "", string ParentFirstName = "", string ParentMiddleName = "",
    string? ParentPassportUrl = null,
    bool IsArchived = false, string? ArchivedAt = null, string? ArchiveReason = null);

/// <summary>O'quvchini arxivlash so'rovi — sababini saqlaydi (ReasonId yo'ki Reason).</summary>
public record ArchiveStudentRequest(string? Reason = null, string? ReasonId = null);

/* ---------- Intizomiy ball ---------- */
/// <summary>
/// Intizomiy ball sababi (nomi + ball). <c>Kind</c>: "other" — mustaqil intizomiy sabab;
/// "attendance" — davomat sababi (jurnalda ishlatiladi, manbai bitta).
/// </summary>
public record DisciplineReasonDto(string Id, string Name, int Points, string Kind);
public record SaveDisciplineReasonRequest(string Name, int Points);
/// <summary>Davomat sababiga ball belgilash so'rovi.</summary>
public record SetReasonPointsRequest(int Points);

/// <summary>O'quvchilarni baholash turi (admin xohlagancha qo'shadi).</summary>
public record EvaluationTypeDto(string Id, string Name, string Description);
public record SaveEvaluationTypeRequest(string Name, string? Description);

/// <summary>Bitta davomat sababidan o'quvchida necha marta bo'lgani (jurnal belgilaridan).</summary>
public record AttendanceReasonCountDto(string ReasonId, string Name, string Short, bool IsLate, int Count);

/// <summary>
/// Baholash jadvalidagi bitta o'quvchi qatori: qatnashish (o'tilgan/qatnashgan), davomat sabablari
/// bo'yicha taqsimot va baholash turlari bo'yicha baholar (typeId → 1-5).
/// </summary>
public record EvaluationRowDto(
    string StudentId,
    string FullName,
    string ClassName,
    int Conducted,
    int Attended,
    IReadOnlyList<AttendanceReasonCountDto> Reasons,
    Dictionary<string, int> Grades,
    double AvgGrade);

/// <summary>
/// Baholash jadvali: mavjud oylar katalogi, joriy (tanlangan) oy/hafta, ustun turlari va qatorlar.
/// Qatnashish/davomat tanlangan davr (oy yoki hafta) bo'yicha, baholar tanlangan oy bo'yicha.
/// </summary>
/// <summary>Baholash board guruh filtri uchun guruh varianti.</summary>
public record GroupOptionDto(string Id, string Name);
public record EvaluationBoardDto(
    IReadOnlyList<string> Months,
    string Month,
    int Week,
    IReadOnlyList<EvaluationTypeDto> Types,
    IReadOnlyList<EvaluationRowDto> Rows,
    string SubjectId = "",
    IReadOnlyList<SubjectDto>? Subjects = null,
    IReadOnlyList<GroupOptionDto>? Groups = null,
    string GroupId = "all");

/// <summary>
/// Baho qo'yish/yangilash/tozalash so'rovi (oy bo'yicha; Score null yoki 1-5 dan tashqari = tozalash).
/// <c>SubjectId</c> — qaysi fan ("" = umumiy). <c>ClassId</c> — o'qituvchi chaqiruvida egalik tekshiruvi uchun.
/// </summary>
public record SetEvaluationGradeRequest(
    string StudentId, string TypeId, string Month, int Week, int? Score,
    string? SubjectId = null, string? ClassId = null);

/// <summary>O'quvchining bitta fan bo'yicha oylik baholashlari (shaxsiy daftarda "fan kesimida").</summary>
public record SubjectEvaluationDto(string SubjectId, string SubjectName, double Avg, List<MonthlyEvaluationDto> Evaluations);
/// <summary>Ballar nazorati qatori: o'quvchi, sinf, plus (rag'bat), minus (jazo), qoldi (100+plus−minus).</summary>
public record DisciplineScoreRowDto(
    string StudentId, string FullName, string ClassName, int Plus, int Minus, int Remaining);
/// <summary>O'quvchiga ball kiritish so'rovi (sabab bo'yicha).</summary>
public record AddDisciplinePointRequest(string StudentId, string ReasonId, string? Note);
/// <summary>Bitta intizomiy ball yozuvi (tarix). <c>Source</c>: "manual" (qo'lda, o'chirsa bo'ladi) yoki "attendance" (jurnal davomati, faqat ko'rish).</summary>
public record DisciplinePointDto(
    string Id, string StudentId, string ReasonName, int Points, string Note, string CreatedAt,
    string CreatedBy, string Source);
/// <summary>O'quvchi/ota-ona ilovasi uchun intizomiy ball: qoldi + plus/minus + tarix (100 dan boshlanadi).</summary>
public record StudentDisciplineDto(int Remaining, int Plus, int Minus, List<DisciplinePointDto> Items);
/// <summary>O'quvchini arxivdan qaytarish — ixtiyoriy yangi parol (arxivlanganda parol bloklangan edi).</summary>
public record RestoreStudentRequest(string? NewPassword);

/// <summary>O'qituvchini arxivlash so'rovi — sababini saqlaydi.</summary>
public record ArchiveTeacherRequest(string Reason);
/// <summary>O'qituvchini arxivdan qaytarish — ixtiyoriy yangi parol (arxivlanganda parol bloklangan edi).</summary>
public record RestoreTeacherRequest(string? NewPassword);

/// <summary>
/// O'qituvchi faollik hisoboti — bitta qator (umumiy ko'rinish). Expected = jadvaldan kelib
/// chiqib bugungacha bo'lishi kerak bo'lgan darslar; Conducted = jurnal "o'tildi" belgilari;
/// foizlar bajarilgan/mavzu yozilgan/uy vazifa berilgan ulushini bildiradi. Status: active|low|none.
/// Came/Active/Trial/Frozen/Left — o'quvchi lifecycle sanoqlari (shu o'qituvchi guruhlari bo'yicha).
/// ConversionPct = Active / Came * 100 (sinovdan faolga aylanganlar foizi).
/// </summary>
public record TeacherReportRowDto(
    string TeacherId, string FullName, bool IsArchived,
    int Expected, int Conducted, int? DonePct,
    int Grades, int? TopicPct, int? HomeworkPct,
    string? LastActivity, string Status,
    int Came, int Active, int Trial, int Frozen, int Left, int? ConversionPct);

/// <summary>
/// O'qituvchilar hisoboti — umumiy ko'rinish javobi: mavjud oylar ro'yxati + tanlangan oy + qatorlar.
/// Month = "" bo'lsa Umumiy (barcha oylar yig'indisi).
/// </summary>
public record TeacherReportOverviewDto(
    List<string> Months, string Month, List<TeacherReportRowDto> Rows);

/// <summary>O'qituvchi hisoboti — sinf/fan kesimida bitta qator (batafsil ko'rinish).</summary>
public record TeacherReportBreakdownDto(
    string ClassName, string SubjectName,
    int Expected, int Conducted, int? DonePct,
    int Grades, int? TopicPct, int? HomeworkPct);

/// <summary>Bitta o'qituvchining batafsil hisoboti: umumiy ko'rsatkichlar + sinf/fan yoyilmasi.</summary>
public record TeacherReportDetailDto(
    string TeacherId, string FullName, bool IsArchived,
    int Expected, int Conducted, int? DonePct,
    int Grades, int? TopicPct, int? HomeworkPct,
    string? LastActivity, string Status,
    int Came, int Active, int Trial, int Frozen, int Left, int? ConversionPct,
    List<TeacherReportBreakdownDto> Rows);

/// <summary>O'quvchi (mobil ilova) o'z joylashuvini yangilash so'rovi — GPS dan keladi.</summary>
public record UpdateLocationRequest(double Latitude, double Longitude, string? Address);
/// <summary>Joriy saqlangan joylashuvni o'qish (ilova xaritada ko'rsatishi uchun). Hali yo'q bo'lsa null'lar.</summary>
public record StudentLocationDto(double? Latitude, double? Longitude, string? Address, string? UpdatedAt);
/// <summary>Admin xarita uchun — joylashuvi bor o'quvchi qatori.</summary>
public record StudentLocationRowDto(
    string StudentId, string FullName, string ClassName,
    double Latitude, double Longitude, string? Address, string? UpdatedAt);

/// <summary>Ota-ona bo'limidagi bitta farzand (qisqacha) + qurilma ma'lumoti.</summary>
public record ParentChildDto(
    string StudentId, string FullName, string ClassName,
    string? FirstLoginAt, string? LastLoginAt,
    string DeviceName = "", string Platform = "", string AppId = "");

/// <summary>
/// Admin "Ota-onalar" bo'limidagi bir ota-ona qatori — telefon bo'yicha guruhlangan.
/// IsActivated = farzandlardan kamida bittasi ilovaga kirgan (FirstLoginAt mavjud).
/// ActivatedAt = farzandlar orasida eng erta FirstLoginAt; LastSeenAt = eng kech LastLoginAt.
/// DeviceName/Platform = oxirgi faol qurilma (farzandlar bo'yicha).
/// </summary>
public record ParentRowDto(
    string FullName, string Phone, int ChildrenCount,
    bool IsActivated, string? ActivatedAt, string? LastSeenAt,
    List<ParentChildDto> Children, string DeviceName = "", string Platform = "");

/// <summary>Admin "Ilova → O'qituvchilar" bo'limidagi bir o'qituvchi qatori (ilova faolligi + qurilma).</summary>
public record TeacherAppRowDto(
    string TeacherId, string FullName, string Phone,
    bool IsActivated, string? ActivatedAt, string? LastSeenAt,
    string DeviceName, string Platform, string AppId);
/// <summary>Sinf hisobotidagi bitta o'quvchi qatori.</summary>
public record ClassStudentRowDto(StudentDto Student, Dictionary<string, double> Grades, double Average, double? Attendance);
public record ClassPerformanceDataDto(List<SubjectDto> Subjects, List<ClassStudentRowDto> Rows);
public record ClassStatsDto(int StudentsCount, double AverageGrade, double? Attendance);
public record StudentRatingRowDto(StudentDto Student, string ClassName, int Grade, double Average, double? Attendance);
/// <summary>O'quvchi davomati — har metrika chorak (1-4) → son ko'rinishida.</summary>
public record StudentAttendanceDto(
    Dictionary<int, int> MissedDays, Dictionary<int, int> IllnessDays,
    Dictionary<int, int> MissedLessons, Dictionary<int, int> IllnessLessons,
    Dictionary<int, int> LateCount);
/// <summary>Bitta o'quvchining o'zlashtirish va qatnashish hisoboti.</summary>
public record StudentReportDto(
    string StudentId, string FullName, string ClassName, string HomeroomTeacher, string ParentFullName,
    List<SubjectDto> Subjects, Dictionary<string, Dictionary<int, double>> Grades,
    StudentAttendanceDto Attendance);

/// <summary>O'quvchining bitta oydagi baholash turlari bo'yicha baholari.</summary>
public record MonthlyEvaluationDto(string Month, Dictionary<string, int> Grades, double Avg);
/// <summary>O'quvchining bitta OYDAGI ("yyyy-MM") uy vazifa/xulq jamlamasi (daftar — oyma-oy).</summary>
public record MonthMarksDto(string Month, int HomeworkDone, int HomeworkMissed, int BehaviorGood, int BehaviorBad);
/// <summary>O'quvchi davomati — har metrika OY ("yyyy-MM") → son ko'rinishida (daftar — oyma-oy).</summary>
public record MonthlyAttendanceDto(
    Dictionary<string, int> MissedDays, Dictionary<string, int> IllnessDays,
    Dictionary<string, int> MissedLessons, Dictionary<string, int> IllnessLessons,
    Dictionary<string, int> LateCount);

/// <summary>
/// O'quvchi shaxsiy daftari — bitta o'quvchi haqida BARCHA ma'lumot (profil, o'zlashtirish,
/// davomat, intizom, topshiriqlar, oylik baholash, uy vazifa va xulq).
/// </summary>
public record StudentNotebookDto(
    // Profil
    string Id, string FullName, string ClassName, string HomeroomTeacher,
    string ParentFullName, string ParentPhone, string Gender, string BirthDate,
    string EnrollmentDate, decimal Balance, string? PhotoUrl,
    // Shaxsiy ma'lumotlar
    string Address, int DiscountPct, decimal DiscountAmount, string DiscountNote,
    string? ParentPassportUrl,
    // O'zlashtirish — fan → OY ("yyyy-MM") → o'rtacha baho
    List<SubjectDto> Subjects, Dictionary<string, Dictionary<string, double>> Grades, double AvgGrade,
    // Davomat — oyma-oy
    MonthlyAttendanceDto Attendance, int Conducted, int Attended, int AttendancePct,
    List<AttendanceReasonCountDto> Reasons,
    // Intizom
    int DisciplineScore, int DisciplinePlus, int DisciplineMinus, List<DisciplinePointDto> DisciplinePoints,
    // Topshiriqlar
    StudentAssignmentScoresDto Assignments,
    // Oylik baholash — umumiy (fanlar o'rtachasi) + fan kesimida
    List<EvaluationTypeDto> EvaluationTypes, List<MonthlyEvaluationDto> Evaluations,
    List<SubjectEvaluationDto> EvaluationsBySubject,
    // Uy vazifa + xulq (oyma-oy)
    int HomeworkDone, int HomeworkMissed, int BehaviorGood, int BehaviorBad, List<MonthMarksDto> MarksTrend);

/// <summary>Portal reytingidagi bitta qator (o'quvchi/parent ko'rinishi — shaxsiy ma'lumotsiz: telefon/balans/manzil yo'q).</summary>
public record PortalRatingRowDto(
    int Rank, string StudentId, string FullName, string ClassName, double Average, double? Attendance);

/// <summary>
/// O'quvchi/parent reytingi (adminniki bilan bir xil hisob, o'rtacha baho bo'yicha): o'z sinfi TO'LIQ
/// ranglangan, maktab bo'yicha esa faqat TOP 15. `MeStudentId` — o'z qatorini ajratish uchun;
/// `MeSchoolRank` top 15 dan tashqarida bo'lsa ham o'quvchining maktab o'rnini beradi (`SchoolSize` — jami).
/// </summary>
public record PortalRatingDto(
    string MeStudentId,
    List<PortalRatingRowDto> ClassRows,
    List<PortalRatingRowDto> SchoolRows,
    int? MeSchoolRank, int SchoolSize);


/// <summary>Maktab ma'lumotlari (profil sozlamasi).</summary>
public record SchoolInfoDto(
    string Name, string Director, string Phone, string Email,
    string Address, string Region, string District, string LogoUrl = "");
/// <summary>Maktab nomi + logo (brending — barcha foydalanuvchilar uchun).</summary>
public record SchoolNameDto(string Name, string TelegramChannel = "", string LogoUrl = "");
/// <summary>Ommaviy brending (login/daraja testi kabi autentifikatsiyasiz sahifalar uchun).</summary>
public record PublicBrandDto(string Name, string LogoUrl, string Phone);
/// <summary>Telegram bot sozlamasi (admin). Configured = token bo'sh emasligini bildiradi.</summary>
public record TelegramSettingsDto(string BotToken, string BotUsername, string BotName, bool Configured, string Channel = "");
/// <summary>Telegram bot sozlamasini saqlash so'rovi.</summary>
public record SaveTelegramSettingsRequest(string? BotToken, string? BotUsername, string? BotName, string? Channel);
/// <summary>Telegram backup konfiguratsiyasi — DB'dan o'qilgan holat.</summary>
public record TelegramBackupConfigDto(
    string? AdminChatId,
    int ScheduleHour,
    int ScheduleMinute,
    bool Enabled,
    DateTime? LastSentAt);
/// <summary>Telegram backup sozlamasini yangilash so'rovi.</summary>
public record SaveTelegramBackupConfigRequest(
    string? AdminChatId,
    int ScheduleHour,
    int ScheduleMinute,
    bool Enabled);
/// <summary>Ilova (APK) sozlamasi — Telegram bot ro'yxatdan o'tgan o'quvchi/o'qituvchiga yuboradigan fayl(lar).
/// Nom + hajm (bayt; 0 = yuklanmagan).</summary>
public record AppApkSettingsDto(string StudentApkName, long StudentApkSize, string TeacherApkName, long TeacherApkSize);
/// <summary>Firebase (FCM push) sozlamasi — faqat native (Flutter) ilovaga push yuborish uchun
/// Service Account JSON. Configured = JSON to'g'ri kiritilgan.</summary>
public record FirebaseSettingsDto(string ServiceAccountJson, bool Configured);
public record SaveFirebaseSettingsRequest(string? ServiceAccountJson);

/// <summary>Turniket/FaceID integratsiya sozlamasi (o'qituvchilar davomati avtomatik).
/// Parol javobda BO'SH qaytadi (xavfsizlik); HasPassword saqlanganini bildiradi.</summary>
public record TurnstileSettingsDto(
    bool Enabled, string Vendor, string Host, int Port, string Username, bool HasPassword,
    string WorkStartTime, int LateGraceMinutes, string LastSync,
    List<TeacherDeviceMapDto> Teachers);
/// <summary>O'qituvchi ↔ qurilma ID moslamasi.</summary>
public record TeacherDeviceMapDto(string TeacherId, string FullName, string DeviceUserId);
/// <summary>Turniket sozlamasini saqlash so'rovi. Password null/bo'sh = o'zgartirilmaydi (eski saqlanadi).</summary>
public record SaveTurnstileSettingsRequest(
    bool Enabled, string? Vendor, string? Host, int? Port, string? Username, string? Password,
    string? WorkStartTime, int? LateGraceMinutes, List<TeacherDeviceMapDto>? Teachers);

/* ---------- Finance (Moliya) ---------- */
public record FinanceTransactionDto(
    string Id, string Date, string Direction, string Category, decimal Amount,
    string? Note, string? StudentId, string? StudentName, string? TeacherId, string? TeacherName,
    string? Month, string? GroupId = null, string? Comment = null);
public record FinanceTransactionPayload(
    string Date, string Direction, string Category, decimal Amount, string? Note,
    string? StudentId, string? TeacherId, string? Month = null, string? GroupId = null, string? Comment = null);
public record CategoryAmountDto(string Category, decimal Amount);
public record FinanceSummaryDto(
    decimal TotalIncome, decimal TotalExpense, decimal Net,
    decimal TuitionIncome, decimal OtherIncome,
    List<CategoryAmountDto> IncomeByCategory, List<CategoryAmountDto> ExpenseByCategory,
    decimal StudentDebt, decimal StudentAdvance, int TransactionsCount);
public record FinanceMonthlyDto(string Month, decimal Income, decimal Expense);
public record AccrueResultDto(List<string> Months, int Count, decimal Total);

/* ---------- Ilova bildirishnomalari (o'quvchi/o'qituvchi tarixi) ---------- */
public record UserNotificationDto(string Id, string Title, string Body, string Type, string CreatedAt, bool Read, bool Confirmed);
public record NotificationsResponseDto(int Unread, List<UserNotificationDto> Items);

/* ---------- Kurs/guruh kesimida moliyaviy hisobot ---------- */
/// <summary>Bitta kurs (Subject) bo'yicha davr hisobi: hisoblangan/yig'ilgan, yig'ilish foizi,
/// to'liq to'lagan o'quvchilar nisbati. Daromad bo'yicha saralanadi.</summary>
public record CourseFinanceRowDto(
    string CourseId, string CourseName, decimal Price,
    int GroupCount, int StudentCount,
    decimal Billed, decimal Collected, decimal CollectionPct,
    int FullyPaidStudents, int BillableStudents, decimal PaidPct);
/// <summary>Bitta guruh bo'yicha davr hisobi (qaysi o'qituvchi guruhi faolroq).</summary>
public record GroupFinanceRowDto(
    string GroupId, string GroupName, string CourseName, string TeacherName,
    int StudentCount, decimal Billed, decimal Collected, decimal CollectionPct,
    int FullyPaidStudents, int BillableStudents);
public record CourseFinanceReportDto(
    string From, string To,
    decimal TotalBilled, decimal TotalCollected, decimal CollectionPct,
    List<CourseFinanceRowDto> Courses,
    List<GroupFinanceRowDto> Groups);

/* ---------- O'quvchi to'lov tarixi (ledger) ---------- */
/// <summary>Bitta oyning hisobi.
/// Charged = to'liq oylik (sinf narxi); Discount = shu oy uchun berilgan chegirma;
/// Paid = haqiqiy naqd to'lov (tx); Remaining = Charged − Discount − Paid (manfiy bo'lsa 0).</summary>
/// <summary>Oydagi bitta kurs ulushi (qaysi kursga qancha) — to'lov tarixida breakdown uchun.
/// GroupId — shu ulush qaysi guruh hisobiga tegishli (null = guruhsiz/ClassName); super admin
/// shu guruhning oylik hisobini alohida tahrirlashi uchun (ko'p guruhli o'quvchi).</summary>
public record MonthCourseDto(string CourseName, decimal Fee, string? GroupId = null);
public record MonthLedgerDto(
    string Month, decimal Charged, decimal Discount, decimal Paid, decimal Remaining, string Status,
    List<MonthCourseDto> Courses, string? GroupId = null);
public record PaymentDto(string Date, decimal Amount, string? Note, string? Month, string? Comment);
/// <summary>To'lov oynasi uchun BITTA guruh bo'yicha oylik hisob: shu guruhning oylik to'lovi (chegirma
/// ayirilgan), shu guruhga teglangan to'langan summa va qoldiq. Aggregate emas — faqat shu guruh.</summary>
public record GroupMonthDto(string Month, decimal Fee, decimal Paid, decimal Remaining, string Status);
public record GroupLedgerDto(string GroupId, string GroupName, string CourseName, List<GroupMonthDto> Months);
public record StudentLedgerDto(
    StudentDto Student, decimal Balance, decimal MonthlyFee,
    decimal TotalCharged, decimal TotalDiscount, decimal TotalPaid,
    List<MonthLedgerDto> Months, List<PaymentDto> Payments);
/// <summary>Super admin: oylik HISOBLANGAN summani qo'lda tahrirlash.</summary>
public record EditChargeRequest(decimal Amount);

/* ---------- O'zgarishlar tarixi (audit) ---------- */
public record AuditLogDto(
    string Id, string EntityType, string EntityId, string Action, string Timestamp,
    string? ActorName, string Summary, string? Before, string? After,
    string? StudentId, string? TeacherId);

/* ---------- Teacher portal (ilova) ---------- */
/// <summary>O'qituvchining o'z profili (ilovada ko'rsatish uchun).</summary>
public record TeacherProfileDto(
    string Id, string FullName, string Email, string HomeroomClass, List<SubjectDto> Subjects,
    List<string> Permissions, string? PhotoUrl = null, bool IsSupport = false);

/* ---------- Support o'qituvchi (bo'sh vaqt slot + bron) ---------- */
/// <summary>Admin "Support" ro'yxati elementi — support o'qituvchi + slot statistikasi.</summary>
public record SupportTeacherDto(
    string Id, string FullName, string Phone, string? PhotoUrl,
    int OpenCount, int BookedCount, int DoneCount);
/// <summary>Bitta support slot/dars yozuvi (admin va o'qituvchi ko'rinishi uchun umumiy).</summary>
public record SupportSlotDto(
    string Id, string TeacherId, string Date, string StartTime, string EndTime, string Status,
    string? StudentId, string StudentName, string Topic, string Notes, string? BookedAt);
/// <summary>Admin: bitta support o'qituvchi tafsiloti + uning slot/darslari (eng yangi birinchi).</summary>
public record SupportTeacherDetailDto(
    string Id, string FullName, string Phone, string? PhotoUrl, List<SupportSlotDto> Slots);
/// <summary>Support slot yaratish: sana + bo'sh vaqt bloki (StartTime..EndTime). SlotMinutes>0 bo'lsa
/// blok HAR ODAMGA shuncha daqiqalik bron-slotlarga bo'linadi (masalan 1 soat + 30 → 2 slot).
/// SlotMinutes=0 → butun blok bitta slot. RepeatWeeks>0 — shu hafta kuni keyingi N haftaga ham.</summary>
public record CreateSupportSlotRequest(
    string Date, string StartTime, string EndTime, int SlotMinutes = 0, int RepeatWeeks = 0);
/// <summary>Support dars yopish: mavzu + izoh.</summary>
public record CompleteSupportRequest(string Topic, string Notes);
/// <summary>O'quvchi ko'rinishidagi support o'qituvchi — bo'sh slotlari bilan.</summary>
public record StudentSupportTeacherDto(
    string TeacherId, string FullName, string? PhotoUrl, List<StudentSupportSlotDto> OpenSlots);
/// <summary>O'quvchi uchun bo'sh slot (bron qilish mumkin).</summary>
public record StudentSupportSlotDto(string Id, string Date, string StartTime, string EndTime);
/// <summary>O'quvchining support broni (o'z bronlari ro'yxati).</summary>
public record StudentSupportBookingDto(
    string Id, string TeacherId, string TeacherName, string Date, string StartTime, string EndTime,
    string Status, string Topic, string Notes);
/// <summary>O'quvchi support ekrani: bo'sh slotli supportlar + mening bronlarim.</summary>
public record StudentSupportDto(
    List<StudentSupportTeacherDto> Supports, List<StudentSupportBookingDto> MyBookings);
/// <summary>O'quvchi profilidagi support feedback — support o'qituvchining o'tilgan darsi (mavzu+izoh).</summary>
public record StudentSupportFeedbackDto(
    string Date, string StartTime, string EndTime, string TeacherName, string Topic, string Notes);
/// <summary>O'qituvchi dars beradigan bitta guruh (qaysi kurslarni o'qitishi).</summary>
public record TeacherClassDto(
    string ClassId, string ClassName, int Grade, List<SubjectDto> Subjects);
/* ---------- Student portal (ilova) ---------- */
/// <summary>O'quvchining o'z profili (ilovada ko'rsatish uchun).</summary>
public record StudentProfileDto(
    string Id, string FullName, string ClassName, string BirthDate, string Gender,
    string ParentFullName, string ParentPhone, string EnrollmentDate,
    string? PhotoUrl = null, string? ParentPhotoUrl = null);
/// <summary>O'quvchi jadvalidagi bitta dars (fan, o'qituvchi, kun, dars raqami, vaqt).</summary>
public record StudentLessonDto(
    int Day, int Period, string? StartTime, string? EndTime,
    string SubjectId, string SubjectName, string TeacherId, string TeacherName);
/// <summary>O'quvchi uchun dars mavzusi va uyga vazifa (sana + fan bo'yicha).
/// Shu o'quvchining o'sha (sana + dars raqami) jurnal yozuvi bo'lsa — Grade va Reason ham
/// bog'lab qaytariladi (bugungi/haftalik baholarni alohida endpoint'siz ko'rsatish uchun).</summary>
public record HomeworkItemDto(
    string Date, int Period, string SubjectId, string SubjectName,
    string Topic, string? Homework, bool Conducted,
    int? Grade, string? ReasonId, string? ReasonName, bool IsLate);

/// <summary>O'quvchi jurnali — bitta dars qatori (sana + dars raqami + fan + o'qituvchi + mavzu/uyga vazifa + baho/sabab).</summary>
public record StudentJournalRowDto(
    string Date, int Period, int Quarter, int Week,
    string? StartTime, string? EndTime,
    string SubjectId, string SubjectName,
    string? TeacherId, string? TeacherName,
    string Topic, string? Homework, bool Conducted,
    int? Grade, string? ReasonId, string? ReasonName, bool IsLate);

/// <summary>O'quvchining bitta davomatsizlik (yoki kech qolish) yozuvi.</summary>
public record StudentAbsenceRowDto(
    string Date, int Period, int Quarter,
    string SubjectId, string SubjectName,
    string ReasonId, string ReasonName, bool IsLate, bool IsIll);

/// <summary>O'quvchi davomati — chorak bo'yicha umumiy + kunlik ro'yxat.</summary>
public record StudentAttendanceFullDto(
    StudentAttendanceDto Summary, List<StudentAbsenceRowDto> Rows);

/// <summary>Bosh sahifa uchun yagona payload — bir chaqiruvda hammasi.</summary>
public record StudentDashboardDto(
    StudentProfileDto Profile, PortalMetaDto Meta,
    List<StudentLessonDto> TodayLessons, List<HomeworkItemDto> TodayGrades,
    int PendingAssignmentsCount, decimal Balance, decimal MonthlyFee);

/// <summary>O'quvchi/foydalanuvchi shaxsiy sozlamasi (til, tema, bildirishnoma).</summary>
public record UserSettingsDto(string Language, string Theme, bool NotificationsEnabled);

/// <summary>Sozlamani yangilash so'rovi. Berilgan maydonlar yangilanadi, qolganlari saqlanadi.</summary>
public record SaveUserSettingsRequest(string? Language, string? Theme, bool? NotificationsEnabled);

/// <summary>Push qurilma tokenini ro'yxatdan o'tkazish so'rovi.</summary>
public record RegisterDeviceRequest(string Token, string? Platform, string? DeviceName, string? AppId);

/// <summary>Portal umumiy konteksti: dars vaqtlari, davomat sabablari, davr(lar) + joriy chorak/hafta.</summary>
public record PortalMetaDto(
    List<LessonTimeDto> LessonTimes,
    List<AbsenceReasonDto> AbsenceReasons, List<QuarterPeriodDto> Quarters,
    int CurrentQuarter = 1, int CurrentWeek = 1);

/* ---------- O'quvchi: topshiriqlar/testlar (xavfsiz — to'g'ri javob OSHKOR QILINMAYDI) ---------- */

/// <summary>Test savoli o'quvchi uchun — to'g'ri javob indeksi BERILMAYDI.</summary>
public record StudentTestQuestionDto(string Id, string Text, List<string> Options);
/// <summary>O'quvchi topshiriqlar ro'yxatidagi element (o'z holati bilan).</summary>
public record StudentAssignmentDto(
    string Id, string SubjectName, string Title, string Description, string Format,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    int QuestionCount, List<AssignmentMaterialDto> Materials,
    bool Completed, string? SubmittedAt, int? Score, string ReferenceText = "");
/// <summary>O'quvchi topshiriq tafsiloti (test bo'lsa — javobsiz savollar bilan).</summary>
public record StudentAssignmentDetailDto(
    string Id, string SubjectName, string Title, string Description, string Format,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    List<AssignmentMaterialDto> Materials, List<StudentTestQuestionDto> Questions,
    bool Completed, string? SubmittedAt, int? Score, string? AnswerText, string? FileUrl,
    string ReferenceText = "");
/// <summary>Test javobi: savol id + tanlangan variant indeksi.</summary>
public record TestAnswerInput(string QuestionId, int SelectedIndex);
/// <summary>Topshiriqni topshirish: test uchun Answers; yozma uchun AnswerText; fayl/video uchun FileUrl.</summary>
public record SubmitAssignmentRequest(
    List<TestAnswerInput>? Answers, string? AnswerText, string? FileUrl);
/// <summary>Topshirish natijasi: test bo'lsa ball + to'g'ri/jami.</summary>
public record SubmitResultDto(bool Completed, int? Score, int? CorrectCount, int? Total);


/* ---------- Messaging (chat + e'lon + telegram) ---------- */

/// <summary>Sinf guruh chatidagi bitta xabar. CreatedAt — ISO 8601 ("o" formati).</summary>
public record ChatMessageDto(
    string Id, string ClassName, string SenderUserId, string SenderName,
    string SenderRole, string Text, string CreatedAt);

/// <summary>Chatga xabar yuborish so'rovi (sinf URL'dan keladi).</summary>
public record SendChatRequest(string Text);

/// <summary>Admin uchun sinf chat/e'lon ro'yxati elementi.</summary>
public record ChatClassDto(
    string Name, int Grade, int StudentCount, int ParentCount, string? LastMessageAt);

/// <summary>Yuborilgan e'lon (Telegram). CreatedAt — ISO 8601.</summary>
public record BroadcastDto(
    string Id, string ClassName, string Text, string SenderName, string CreatedAt,
    int RecipientCount, int SentCount);

/// <summary>
/// E'lon yuborish so'rovi. <c>Scope</c>: "class" (ClassName sinfi), "all" (barcha sinf),
/// "selected" (StudentIds tanlangan o'quvchilar). <c>OnlyDebtors</c> — faqat balansi manfiylar.
/// <c>Text</c> ichida o'rinbosarlar bo'lishi mumkin: {fish} {sinf} {qarzdorlik} {balans} {ota-ona} {telefon}.
/// </summary>
public record SendBroadcastRequest(
    string? Scope, string? ClassName, bool OnlyDebtors, List<string>? StudentIds, string Text);

/// <summary>Telegramda ro'yxatdan o'tgan ota-ona. ChatId string (JS aniqligi uchun). Balance — qarz aniqlash uchun.</summary>
public record TelegramParentDto(
    string StudentId, string StudentName, string ClassName, decimal Balance,
    string ParentName, string Phone, string ChatId, string CreatedAt);

/// <summary>
/// Ilovaga push yuborish so'rovi. Audience: "parents" (ClassName ixtiyoriy) | "teachers" |
/// "selected" (UserIds tanlangan foydalanuvchilar).
/// </summary>
public record SendPushRequest(string Audience, string? ClassName, List<string>? UserIds, string Title, string Body);
/// <summary>Push uchun tanlanadigan oluvchi. UserId — akkaunt id; HasDevice = qurilma ulangan (push yetadi).</summary>
public record PushRecipientDto(string UserId, string Name, string Group, string Detail, bool HasDevice);
/// <summary>Yuborilgan push (tarix). CreatedAt — ISO. ConfirmedCount/TargetCount — tasdiqlash holati.</summary>
public record PushMessageDto(
    string Id, string Audience, string Title, string Body, string SenderName, string CreatedAt,
    int RecipientCount, int SentCount, int ConfirmedCount = 0, int TargetCount = 0);
/// <summary>Bitta e'lon (broadcast) bo'yicha oluvchining tasdiqlash holati — admin ko'rishi uchun.</summary>
public record PushConfirmationDto(string Name, string Group, bool Confirmed, string? ConfirmedAt);

/* ---------- SMS (Eskiz.uz) ---------- */
/// <summary>
/// SMS yuborish so'rovi. Audience: "parents" (o'quvchi ota-onasi raqami) | "students" (o'quvchi raqami) |
/// "teachers" (o'qituvchi raqami) | "selected" (StudentIds — ota-ona raqami). ClassName ixtiyoriy (parents/
/// students uchun guruh filtri). OnlyDebtors — faqat qarzdorlar. ToParent — "selected"da ota-ona (true)
/// yoki o'quvchi (false) raqamiga. Text ichida o'rinbosarlar bo'lishi mumkin ({fish} {sinf} {qarzdorlik} {balans} {telefon}).
/// </summary>
public record SendSmsRequest(string Audience, string? ClassName, bool OnlyDebtors, List<string>? StudentIds, string Text, bool ToParent = true);
/// <summary>Yuborilgan SMS partiyasi (tarix). CreatedAt — ISO.</summary>
public record SmsBatchDto(
    string Id, string Audience, string Message, string SenderName, string CreatedAt,
    int RecipientCount, int SentCount);
/// <summary>Bitta SMS jurnali (raqam bo'yicha) — partiya tafsilotida ko'rsatiladi.</summary>
public record SmsLogDto(string Id, string PhoneNumber, string RecipientName, string Status, string CreatedAt);
/// <summary>SMS (Eskiz) holati — admin UI uchun: sozlangan, sender, balans (bo'lsa).</summary>
public record SmsStatusDto(bool Configured, string From, decimal? Balance);
/// <summary>Eskiz callback (yetkazib berish holati webhook'i) tanasi.</summary>
public record EskizCallbackDto(string? request_id, string? message_id, string? phone_number, string? status, string? status_date);
/// <summary>SMS (Eskiz) sozlamasi holati — parol qaytarilmaydi.</summary>
public record EskizSettingsDto(string Email, string From, bool Configured, decimal? Balance);
/// <summary>SMS (Eskiz) login/parol/sender saqlash so'rovi (bo'sh qoldirilsa eski saqlanadi).</summary>
public record SaveEskizRequest(string? Email, string? Password, string? From);

/* ---------- Assignments (qo'shimcha topshiriqlar) ---------- */

/// <summary>Topshiriqqa biriktirilgan material (yuklangan fayl yoki havola).</summary>
public record AssignmentMaterialDto(string Id, string Name, string Url, long Size, string ContentType);
/// <summary>Test savoli (format=test).</summary>
public record TestQuestionDto(string Id, string Text, List<string> Options, int CorrectIndex, int Order);
/// <summary>Topshiriq/test (to'liq). Format: written|file|test|video. CreatedAt/Start/Due — ISO.</summary>
public record AssignmentDto(
    string Id, string CreatedByUserId, string SubjectId, string SubjectName, string Title,
    string Description, string Format, List<string> ClassIds, List<string> ClassNames,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    bool AutoGrade, string CreatedAt,
    List<AssignmentMaterialDto> Materials, List<TestQuestionDto> Questions, string ReferenceText = "");
public record MaterialInput(string Name, string Url, long Size, string ContentType);
public record QuestionInput(string Text, List<string> Options, int CorrectIndex);
/// <summary>Topshiriq yaratish/tahrirlash so'rovi (ham create, ham update).</summary>
public record SaveAssignmentRequest(
    string SubjectId, string Title, string? Description, string Format, List<string> ClassIds,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    bool AutoGrade, List<MaterialInput>? Materials, List<QuestionInput>? Questions,
    string? ReferenceText = null);
/// <summary>Yuklangan fayl haqida ma'lumot (upload javobida).</summary>
public record UploadedFileDto(string Name, string Url, long Size, string ContentType);

/* ---------- Shartnomalar ---------- */

/// <summary>Foydalanuvchi aniqlagan qo'shimcha @-o'rinbosar (doimiy qiymat bilan).</summary>
public record ContractFieldDto(string Key, string Value);
/// <summary>Shartnoma andozasi (yuklangan Word YOKI custom matnli). Body bo'sh bo'lmasa — matnli andoza.
/// Fields — foydalanuvchi qo'shgan qo'shimcha o'rinbosarlar (doimiy qiymatli).</summary>
public record ContractTemplateDto(string Id, string Target, string Name, string FileUrl, string FileName, string Body, List<ContractFieldDto> Fields, string UploadedAt);
/// <summary>Shartnoma andozasini yaratish/tahrirlash so'rovi. Word fayl (FileUrl, avval /api/admin/uploads orqali)
/// YOKI custom matn (Body) — kamida bittasi bo'lishi shart. Fields — qo'shimcha doimiy o'rinbosarlar.</summary>
public record CreateContractTemplateRequest(string Target, string Name, string? FileUrl, string? FileName, string? Body, List<ContractFieldDto>? Fields);
/// <summary>Ota-ona oluvchi qatori (telefon bo'yicha guruhlangan).</summary>
public record ParentRecipientDto(
    string Key, string ParentName, string Phone, List<string> Children, bool Registered, int? LastNumber);
/// <summary>Xodim oluvchi qatori.</summary>
public record StaffRecipientDto(
    string TeacherId, string FullName, string Phone, bool Registered, int? LastNumber);
/// <summary>Shartnoma yuborish so'rovi.</summary>
public record SendContractsRequest(string Target, string TemplateId, List<string> RecipientKeys);
/// <summary>Bitta oluvchi uchun yuborish natijasi.</summary>
public record SendResultDto(string RecipientKey, bool Ok, int? Number, string Message);

/* ---------- O'quv xonalari ---------- */

/// <summary>O'quv xonasi (auditoriya).</summary>
public record RoomDto(
    string Id, string Name, int Capacity, string? Building, string? Location,
    bool IsActive, string CreatedAt);

/// <summary>
/// Xona samaradorlik metrikasi — bandlik, o'quvchi soni, haftalik bandlik foizi.
/// GET /api/admin/rooms/utilization-dashboard
/// </summary>
public record RoomUtilizationDto(
    string RoomId,
    string RoomName,
    int Capacity,
    int CurrentStudents,
    int TotalSlots,
    int Gap,
    int GroupCount,
    double OccupancyPercent,
    int ActiveGroupCount,
    double WeeklyActiveHours,
    double WeeklyUtilizationPercent,
    int EfficiencyScore,
    string EfficiencyStatus,
    string Building,
    string Location,
    List<string> GroupNames);

/// <summary>Xona yaratish so'rovi.</summary>
public record CreateRoomRequest(string Name, int Capacity, string? Building, string? Location);

/// <summary>Xona tahrirlash so'rovi (IsActive bilan — faollashtirish/o'chirish).</summary>
public record UpdateRoomRequest(string Name, int Capacity, string? Building, string? Location, bool IsActive);

/// <summary>
/// Xona sig'im samaradorligi — Total Slots = Capacity × GroupCount,
/// Utilization = ActualStudents / TotalSlots * 100.
/// GET /api/admin/rooms/{id}/capacity
/// </summary>
public record RoomCapacityMetric(
    string RoomId,
    string RoomName,
    int Capacity,
    int GroupCount,
    int TotalSlots,
    int ActualStudents,
    double UtilizationPercent,
    int Gap,
    string Status,
    List<RoomGroupSlotDto> Groups);

/// <summary>Har bir guruhning o'quvchi soni (capacity modal uchun).</summary>
public record RoomGroupSlotDto(string GroupId, string GroupName, int StudentCount, string? CourseName);

/// <summary>
/// Bitta xona uchun unified metrika — karta va modal ikkalasi uchun bitta manba.
/// GET /api/admin/rooms/{id}/detail
/// ActualStudents = barcha guruhlardagi o'quvchilar yig'indisi (unique emas — har guruh alohida slot).
/// OccupancyPercent = ActualStudents / TotalSlots (barcha guruhlar birlashtirilgan).
/// UtilizationPercent = ActualStudents / (Capacity × GroupCount) — OccupancyPercent bilan bir xil.
/// </summary>
public record RoomDetailMetricDto(
    string RoomId,
    string RoomName,
    string Building,
    string Location,
    int Capacity,
    int GroupCount,
    int TotalSlots,  // = Capacity × GroupCount
    int ActualStudents,  // = SUM of all groups' active students (NOT unique)
    double OccupancyPercent,  // = ActualStudents / TotalSlots * 100
    double UtilizationPercent,  // = ActualStudents / (Capacity × GroupCount) — alias of OccupancyPercent
    double WeeklyUtilizationPercent,
    double WeeklyActiveHours,
    int EfficiencyScore,
    string EfficiencyStatus,
    int Gap,
    List<RoomGroupDetailDto> Groups);

/// <summary>Xona ichidagi har bir guruh haqida batafsil ma'lumot (detail modal uchun).</summary>
public record RoomGroupDetailDto(
    string GroupId,
    string GroupName,
    string CourseName,
    string TeacherName,
    int StudentCount,
    int StudentCapacity,
    double UtilizationPercent,
    string Days,
    string TimeSlot);

/* ---------- Boshqaruv ---------- */

/// <summary>Filial (branch).</summary>
public record BranchDto(
    string Id, string Name, string Address, double Latitude, double Longitude,
    int RadiusMeters, string CreatedAt);
public record BranchPayload(
    string Name, string Address, double Latitude, double Longitude, int RadiusMeters);

/// <summary>Xodim (o'qituvchi bo'lmagan ishchi) — admin akkaunti bilan.</summary>
public record StaffDto(string Id, string FullName, string Position, string Login, List<string> Permissions, string Phone = "");
/// <summary>Xodim yaratish/tahrirlash so'rovi.
/// <paramref name="Phone"/> — xodim telefoni (ixtiyoriy, max 32 belgi);
/// PhoneUtil.Normalize() orqali standartlashtirilib saqlanadi (format: +998-XX-XXX-XX-XX).
/// Kiritilsa kamita 7 ta raqam bo'lishi kerak. 998 prefiksi avtomatik qo'shiladi.
/// </summary>
public record StaffPayload(string FullName, string Position, string? NewPassword = null, string? Phone = null);
/// <summary>Xodimning admin bo'lim ruxsatlari (faqat superadmin o'zgartiradi).</summary>
public record SetStaffPermissionsRequest(List<string> Permissions);

/// <summary>Xodim roli shabloni — yangi xodim qo'shishda template tanlab olsa, default ruxsatlari avtomatik belgilanadi.</summary>
public record StaffRoleTemplateDto(string Id, string Code, string Name, string Description, List<string> DefaultPermissions);

/// <summary>Xodim yaratishda rolle shablonini tanlab, qo'shimcha ruxsatlari bilan qo'shish so'rovi.</summary>
public record CreateStaffWithTemplateRequest(
    string FullName, string Position, string? Phone = null, string? NewPassword = null,
    string? TemplateCode = null, List<string>? ExtraPermissions = null);

/// <summary>Taklif/shikoyat — admin ko'rinishi uchun (yuboruvchi roli/ismi + ixtiyoriy rasm bilan).</summary>
public record FeedbackDto(
    string Id, string StudentName, string ParentName, string ClassName,
    string Type, string Text, string CreatedAt, string Status,
    string SenderRole, string SenderName, string? ImageUrl);
/// <summary>
/// Topshiriq natijasi — bitta o'quvchining holati: bajardimi, qachon, qancha ball (Score) hamda
/// yuborgan javobi (AnswerText — yozma) yoki fayli (FileUrl — fayl/video). Bularni o'qituvchi
/// ko'rib baholaydi; test esa avto-baholangan ball bilan keladi.
/// </summary>
public record SubmissionRowDto(
    string StudentId, string StudentName, string ClassName, bool Completed, string? SubmittedAt,
    int? Score, string? AnswerText, string? FileUrl);
/// <summary>
/// Topshiriq bo'yicha natijalar: jami / bajarganlar soni / har o'quvchi holati.
/// Format + MaxScore ballni to'g'ri ko'rsatish va javob turini (matn/fayl) bilish uchun.
/// </summary>
public record AssignmentResultDto(
    string AssignmentId, string Title, string Format, int MaxScore,
    int Total, int CompletedCount, List<SubmissionRowDto> Rows);
/// <summary>O'quvchi holatini belgilash (o'qituvchi).</summary>
public record SetSubmissionRequest(bool Completed, int? Score);
/// <summary>Topshiriq turi (Sozlamalarda boshqariladi — kategoriya; yangi forma ishlatmaydi).</summary>
public record AssignmentTypeDto(string Id, string Name);
public record SaveAssignmentTypesRequest(List<AssignmentTypeDto> Types);

/* ---------- Topshiriqlar bali (admin: sinf bo'yicha ball jadvali) ---------- */

/// <summary>Ball jadvalidagi ustun — bitta topshiriq.</summary>
public record AssignmentScoreColumnDto(
    string AssignmentId, string Title, string SubjectName, string Format, int MaxScore, string? DueDate);
/// <summary>Bitta katak — o'quvchining shu topshiriqdagi holati/bali.</summary>
public record AssignmentScoreCellDto(string AssignmentId, bool Completed, int? Score);
/// <summary>Bitta qator — o'quvchi va uning barcha topshiriqlardagi ballari.</summary>
public record AssignmentScoreRowDto(
    string StudentId, string FullName, string ClassName,
    List<AssignmentScoreCellDto> Cells, int TotalScore, int TotalMax, int GradedCount);
/// <summary>Sinf bo'yicha topshiriqlar ball jadvali (ustunlar = topshiriqlar, qatorlar = o'quvchilar).</summary>
public record AssignmentScoreboardDto(
    string ClassId, string ClassName,
    List<AssignmentScoreColumnDto> Assignments, List<AssignmentScoreRowDto> Students);

/* ---------- Topshiriq ballari (o'quvchi/ota-ona ko'rinishi) ---------- */

/// <summary>O'quvchining bitta topshiriqdagi bali.</summary>
public record StudentAssignmentScoreDto(
    string AssignmentId, string SubjectName, string Title, string Format,
    int MaxScore, int? Score, bool Completed, string? DueDate, string? SubmittedAt);
/// <summary>O'quvchining barcha topshiriqlari bo'yicha ballari + yig'ma.</summary>
public record StudentAssignmentScoresDto(
    int Count, int GradedCount, int TotalScore, int TotalMax,
    List<StudentAssignmentScoreDto> Items);

/* ---------- LMS (Ta'lim) ---------- */

/// <summary>LMS fani (admin ro'yxati va batafsil ko'rinish).</summary>
public record LmsSubjectDto(
    string Id, string ClassId, string ClassName,
    string Title, string Description,
    string UnlockMode, int BatchSize,
    int TopicsCount, string CreatedAt);

/// <summary>LMS moduli (admin) — fan ichidagi mavzular guruhi.</summary>
public record LmsModuleDto(
    string Id, string SubjectId, string Title, string Description, int Order, int TopicsCount);

/// <summary>LMS moduli yaratish/tahrirlash so'rovi.</summary>
public record SaveLmsModuleRequest(string Title, string? Description);

/// <summary>LMS modullar tartibini qayta belgilash.</summary>
public record ReorderLmsModulesRequest(List<string> ModuleIds);

/// <summary>LMS mavzusi (admin). Endi modulga tegishli (ModuleId).</summary>
public record LmsTopicDto(
    string Id, string ModuleId, string Title, string Description,
    string? VideoUrl, string? TextContent, int Order,
    List<LmsMaterialRowDto> Materials,
    int CompletedCount);

/// <summary>LMS material satri. Id so'rovda kelmasligi mumkin (yangi yuklangan fayl) —
/// server saqlashda o'zi yangi Id beradi, shu sabab nullable.</summary>
public record LmsMaterialRowDto(string? Id, string Name, string Url, long Size, string ContentType);

/// <summary>LMS fani yaratish/tahrirlash so'rovi.</summary>
public record SaveLmsSubjectRequest(
    string? ClassId, string Title, string? Description,
    string UnlockMode, int BatchSize);

/// <summary>LMS mavzusi yaratish/tahrirlash so'rovi.</summary>
public record SaveLmsTopicRequest(
    string Title, string? Description, string? VideoUrl, string? TextContent,
    List<LmsMaterialRowDto>? Materials);

/// <summary>LMS mavzular tartibini qayta belgilash.</summary>
public record ReorderLmsTopicsRequest(List<string> TopicIds);


/// <summary>O'quvchi uchun LMS mavzu (ochilganmi, tugallanganmi). Endi modulga tegishli (ModuleId).</summary>
public record StudentLmsTopicDto(
    string Id, string ModuleId, string Title, string Description,
    string? VideoUrl, string? TextContent, int Order,
    List<LmsMaterialRowDto> Materials,
    bool IsUnlocked, bool IsCompleted);

/// <summary>O'quvchi uchun LMS moduli — ichidagi mavzular (ochilish/progress bilan).</summary>
public record StudentLmsModuleDto(
    string Id, string Title, string Description, int Order,
    int TopicsCount, int CompletedCount, List<StudentLmsTopicDto> Topics);

/// <summary>O'quvchi uchun LMS fani ro'yxatdagi element.</summary>
public record StudentLmsSubjectDto(
    string Id, string Title, string Description,
    string UnlockMode, int BatchSize, int TopicsCount, int CompletedCount);

/* ---------- Fan progresi (dars o'tilishiga qarab — LMS'siz) ----------
   Reja (Planned) = chorakdagi sinf jadvalidagi shu fan dars kataklari soni.
   O'tilgan (Conducted) = o'qituvchi "dars o'tildi" deb belgilagan (LessonNote.Conducted) darslar.
   Progress = Conducted / Planned. */

/// <summary>O'quvchi/ota-ona uchun bitta fan progresi.</summary>
public record SubjectProgressDto(
    string SubjectId, string SubjectName,
    int Planned,          // chorakdagi jami reja darslar
    int Conducted,        // o'tilgan (belgilangan) darslar
    int Remaining,        // qolgan = Planned - Conducted
    int Percent,          // Conducted/Planned (0..100)
    int ExpectedByToday,  // shu kungacha bo'lishi kerak edi (orqada/oldinda aniqlash uchun)
    string? NextLessonDate,  // keyingi hali o'tilmagan reja dars sanasi (ISO) yoki null
    string? LastLessonDate); // chorakdagi oxirgi reja dars sanasi (ISO) yoki null

/// <summary>O'quvchining barcha fanlari bo'yicha umumiy + har bir fan progresi.</summary>
public record StudentSubjectsProgressDto(
    int Quarter,
    int TotalPlanned, int TotalConducted, int TotalPercent,
    List<SubjectProgressDto> Subjects);

/// <summary>Fan ichidagi bitta dars (yashil = o'tilgan, qizil = hali yo'q).</summary>
public record SubjectLessonDto(
    string Date, int Period, string? StartTime, string? EndTime,
    string Topic, string? Homework, bool Conducted, bool IsPast);

/// <summary>Fanga kirilganda — darslar ro'yxati va yig'ma sonlar.</summary>
public record SubjectProgressDetailDto(
    string SubjectId, string SubjectName, int Quarter,
    int Planned, int Conducted, int Remaining, int Percent,
    List<SubjectLessonDto> Lessons);

/// <summary>O'qituvchi progresi — bitta (sinf, fan) kesimi.</summary>
public record TeacherSubjectProgressDto(
    string ClassId, string ClassName, string SubjectId, string SubjectName,
    int Planned, int Conducted, int Remaining, int Percent, int ExpectedByToday);

/// <summary>O'qituvchining umumiy o'tilgan darslar progresi + kesimlar bo'yicha yoyilma.</summary>
public record TeacherProgressDto(
    int Quarter,
    int TotalPlanned, int TotalConducted, int TotalPercent,
    List<TeacherSubjectProgressDto> Items);

/* ---------- LMS o'qituvchi progress hisoboti (faqat ko'rish) ---------- */

/// <summary>Progress jadvalidagi ustun — mavzu (qisqacha).</summary>
public record LmsTopicBriefDto(string Id, string Title, int Order);
/// <summary>Progress jadvalidagi qator — o'quvchi va u tugatgan mavzular.</summary>
public record LmsStudentProgressDto(
    string StudentId, string FullName, List<string> CompletedTopicIds,
    int CompletedCount, int TotalCount);
/// <summary>O'qituvchi LMS progress hisoboti: mavzular (ustun) × o'quvchilar (qator) matritsasi.</summary>
public record LmsProgressReportDto(
    List<LmsTopicBriefDto> Topics, List<LmsStudentProgressDto> Students);

// ============================ AMAL SABABLARI (action reasons) ============================

/// <summary>Bitta amal sababi.</summary>
public record ActionReasonDto(string Id, string Category, string Label, int Order);

/// <summary>Sabab yaratish so'rovi.</summary>
public record ActionReasonCreate(string Category, string Label);

/// <summary>Sabab yangilash so'rovi.</summary>
public record ActionReasonUpdate(string Label);

// ============================ DARAJA TESTI (placement test) ============================

/// <summary>Admin ro'yxati uchun test qatori.</summary>
public record LevelTestListDto(
    string Id, string Title, string CourseId, string CourseName, string Slug,
    bool IsActive, string CreatedAt, int QuestionCount, int SubmissionCount);

/// <summary>Test elementi (admin) — Kind="question" (to'g'ri javobli) yoki "survey" (so'rovnoma, checkbox).</summary>
public record LevelTestQuestionDto(string Id, string Text, List<string> Options, int CorrectIndex, int Order,
    string Kind = "question", bool Multiple = false);

/// <summary>Daraja diapazoni.</summary>
public record LevelTestBandDto(string Id, string Label, int MinPercent, int Order);

/// <summary>Test to'liq tafsiloti (admin editor uchun).</summary>
public record LevelTestDetailDto(
    string Id, string Title, string CourseId, string CourseName, string Slug, string Intro,
    bool IsActive, string CreatedAt,
    List<LevelTestQuestionDto> Questions, List<LevelTestBandDto> Bands);

/// <summary>Element kiritish/yangilash payload'i (Id bo'sh bo'lsa yangi). Kind="question"|"survey".</summary>
public record LevelTestQuestionInput(string? Id, string Text, List<string> Options, int CorrectIndex,
    string Kind = "question", bool Multiple = false);

/// <summary>Daraja diapazoni payload'i.</summary>
public record LevelTestBandInput(string? Id, string Label, int MinPercent);

/// <summary>Test yaratish/yangilash payload'i.</summary>
public record LevelTestPayload(
    string Title, string CourseId, string Intro, bool IsActive,
    List<LevelTestQuestionInput> Questions, List<LevelTestBandInput> Bands);

/// <summary>So'rovnoma javobi (admin natijalarda) — savol matni + tanlangan variant(lar).</summary>
public record SurveyAnswerDto(string Question, List<string> Answers);

/// <summary>Test topshiruvi (admin — natijalar ro'yxati).</summary>
public record LevelTestSubmissionDto(
    string Id, string FullName, string Phone, int Age, int Score, int Total,
    int Percent, string Level, string CreatedAt, string LeadId, List<SurveyAnswerDto> Survey);

/// <summary>Daraja testi topshiruvchisi: aktiv bo'ldimi + qaysi guruh(lar)ga qo'shilgan va o'qituvchisi (FISH).
/// IsDeleted — lid o'chirilgan yoki o'quvchi o'chirilgan (lead→student→archived).</summary>
public record LevelTestStatRowDto(
    string SubmissionId, string FullName, string Phone, string Level, int Percent, string CreatedAt,
    string LeadId, string? StudentId, bool Active, string GroupName, string TeacherName, bool IsDeleted = false);
/// <summary>Daraja testi statistikasi: jami topshirgan + nechtasi aktiv o'quvchiga aylandi.</summary>
public record LevelTestStatsDto(
    int Total, int Active, List<LevelTestStatRowDto> Rows);

/* ---------- Baholash mezonlari (grading criteria) ---------- */
/// <summary>Baholash mezoni (kriteriya).</summary>
public record GradingCriterionDto(string Id, string Name, string Description, int MaxScore, int Order);
/// <summary>Mezon yaratish/yangilash payload'i.</summary>
public record CriterionInput(string Name, string? Description, int MaxScore);
/// <summary>Guruhga biriktirilgan mezonlar ro'yxatini saqlash (to'liq almashtiriladi).</summary>
public record GroupCriteriaInput(List<string> CriterionIds);
/// <summary>Baholash grid'idagi ustun (mezon).</summary>
public record GradingBoardCriterionDto(string Id, string Name, int Order);
/// <summary>Baholash grid'idagi qator (o'quvchi). DoneKeys — "criterionId|date" bo'yicha "bajardi" belgilangan kataklar.</summary>
public record GradingBoardStudentDto(string StudentId, string FullName, List<string> DoneKeys);
/// <summary>Guruh baholash grid'i: oy(lar) + dars sanalari + mezonlar (ustun) + faol o'quvchilar + bajardi belgilar.</summary>
public record GradingBoardDto(
    string GroupId, string GroupName,
    List<string> Months, string Month, List<string> Dates,
    List<GradingBoardCriterionDto> Criteria, List<GradingBoardStudentDto> Students);
/// <summary>Bitta katakni belgilash: shu sanada shu mezon bo'yicha bajardi (Done) yoki yo'q.</summary>
public record SetCriterionGradeRequest(string GroupId, string StudentId, string CriterionId, string Date, bool Done);
/// <summary>Shu sanada bitta mezon bo'yicha BARCHA faol o'quvchini belgilash/belgilamaslik (ommaviy).</summary>
public record BulkCriterionGradeRequest(string GroupId, string CriterionId, string Date, bool Done);
/// <summary>Guruh baholash statistikasi: oylik mezon ballari + nechta ba'ho kiritilgan.</summary>
public record GradingGroupSummaryDto(string GroupId, string GroupName, int ActiveStudents, int TotalGrades, double AverageScore);

/* ---------- Speaking (Azure Pronunciation Assessment) ---------- */
/// <summary>Bitta so'z bo'yicha talaffuz natijasi: aniqlik bali + xato turi (None/Mispronunciation/Omission/Insertion).</summary>
public record SpeakingWordDto(string Word, double Accuracy, string ErrorType);
/// <summary>Speaking baholash natijasi (Azure): tanilgan matn + ballar (0..100) + per-word.</summary>
public record SpeakingResultDto(
    string RecognizedText, double PronScore, double Accuracy, double Fluency,
    double Completeness, double Prosody, List<SpeakingWordDto> Words, string? Error);
/// <summary>Azure Speech sozlamasi holati (kalit qaytarilmaydi — faqat region + sozlanganmi).</summary>
public record AzureSpeechSettingsDto(string Region, bool Configured);
/// <summary>Azure Speech kalit/region saqlash so'rovi.</summary>
public record SaveAzureSpeechRequest(string? Key, string? Region);

/// <summary>Gemini AI sozlamasi holati (kalit qaytarilmaydi — faqat model + sozlanganmi).</summary>
public record GeminiSettingsDto(string Model, bool Configured);
/// <summary>Gemini API kaliti saqlash so'rovi (bo'sh qoldirilsa eski saqlanadi).</summary>
public record SaveGeminiRequest(string? Key);
/// <summary>AI tahlilidagi sohaviy baholar (0-100) — radar/diagramma uchun.</summary>
public record AiRatingsDto(int Akademik, int Davomat, int Intizom, int UyVazifa, int Faollik, int Umumiy);
/// <summary>O'quvchi AI tahlilining strukturali natijasi (matn bo'limlari + diagramma sonlari).</summary>
public record StudentAiAnalysisResultDto(
    string Umumiy, List<string> Kuchli, List<string> Zaif, string Dinamika,
    string Ozgarishlar, List<string> Tavsiyalar, AiRatingsDto Baholar, string Trend);
/// <summary>Saqlangan bitta AI tahlil yozuvi (tarix elementi).</summary>
public record StudentAiAnalysisRecordDto(
    string Id, string Date, string CreatedAt, string Model, int OverallScore,
    StudentAiAnalysisResultDto Result);
/// <summary>AI tahlil yaratish javobi. AlreadyToday=true bo'lsa bugun allaqachon qilingan
/// (yangi Gemini chaqirig'i bo'lmadi, mavjud yozuv qaytdi).</summary>
public record StudentAiAnalysisResponseDto(
    bool Ok, bool AlreadyToday, StudentAiAnalysisRecordDto? Record, string? Error);

/* ---------- Markaz (butun o'quv markazi) kunlik AI tahlili ---------- */
/// <summary>Diagramma uchun umumiy nuqta (yorliq + qiymat).</summary>
public record CenterPointDto(string Label, double Value);
/// <summary>Markaz moliyaviy prognozi (deterministik hisoblangan — AI emas).</summary>
public record CenterRevenueDto(
    decimal ExpectedThisMonth,   // shu oy kutilayotgan hisob (MonthlyCharge effektiv yig'indisi)
    decimal CollectedThisMonth,  // shu oy yig'ilgan tushum (income)
    decimal OutstandingDebt,     // jami qarzdorlik (manfiy balanslar yig'indisi, musbat)
    decimal YesterdayIncome,     // kechagi tushum
    decimal PredictedMonthEnd);  // oy oxirigacha taxminiy yig'iladigan tushum (chiziqli prognoz)
/// <summary>Markaz ko'rsatkichlari (deterministik hisoblangan raqamlar — diagramma uchun).</summary>
public record CenterMetricsDto(
    int ActiveStudents,
    int NewLeadsThisMonth,
    int NewLeadsYesterday,
    int ConvertedThisMonth,
    int DepartedThisMonth,
    double AvgGradeThisMonth,
    double AvgGradePrevMonth,
    List<CenterPointDto> LeadsBySource,
    List<CenterPointDto> DepartureReasons,
    List<CenterPointDto> IncomeLast14Days);
/// <summary>AI tomonidan yozilgan narrativ (o'zbek tilida) — markaz tahlili matn qismlari.</summary>
public record CenterAiNarrativeDto(
    string Umumiy, string TushumTahlili, string BaholarTahlili,
    string Lidlar, string Ketganlar, List<string> Xavflar,
    List<string> Tavsiyalar, int Salomatlik, string Trend);
/// <summary>Saqlangan bitta markaz AI tahlil yozuvi (to'liq: AI narrativ + raqamlar).</summary>
public record CenterAiRecordDto(
    string Id, string Date, string CreatedAt, string Model, int Health,
    CenterAiNarrativeDto Ai, CenterRevenueDto Revenue, CenterMetricsDto Metrics);
/// <summary>Tarix ro'yxati elementi (qisqa).</summary>
public record CenterAiHistoryItemDto(string Id, string Date, string CreatedAt, int Health, string Summary);
/// <summary>Markaz AI tahlil yaratish javobi. AlreadyToday=true bo'lsa bugun allaqachon qilingan.</summary>
public record CenterAiResponseDto(
    bool Ok, bool AlreadyToday, CenterAiRecordDto? Record, string? Error);

/* ---------- O'quvchi baholash statistikasi (oylik + har darslik) ---------- */
/// <summary>Mezon bo'yicha OYLIK xulosa: shu oyda nechta darsda bajargan / jami dars.</summary>
public record StudentGradingCriterionDto(string Id, string Name, int Done, int Total);
/// <summary>Bitta dars (sana) — shu darsda bajarilgan mezon id'lari.</summary>
public record StudentGradingDateDto(string Date, List<string> DoneCriterionIds);
/// <summary>O'quvchining bitta guruhdagi baholash statistikasi (oylik xulosa + har darslik).</summary>
public record StudentGradingGroupDto(
    string GroupId, string GroupName, List<string> Months, string Month, List<string> Dates,
    List<StudentGradingCriterionDto> Criteria, List<StudentGradingDateDto> Lessons);

/* ---------- Baholash aggregatsiya (o'quvchi-level totals) ---------- */
/// <summary>Guruh baholash jadvali ichida o'quvchi qatori: nechta mezon biriktirilgan,
/// nechta mezon checklari bajarilgan, o'rtacha hajm (TotalScore/CriteriaCount).</summary>
public record StudentGradingTotalDto(
    string Id,
    string FullName,
    int CriteriaCount,
    int TotalScore,
    double AverageScore);

/* ---------- Baholash xulosa (oylik o'rtacha va jami) ---------- */
/// <summary>Bitta oyda baholash xulosa: o'rtacha ba'ho + jami ba'holi darslar / jami mezonlar.</summary>
public record MonthGradingSummaryDto(
    string Month, double AverageScore, int TotalScore, int CriteriaCount);

// ---- Ommaviy (anonim) ----

/// <summary>Ommaviy test elementi (to'g'ri javobSIZ). Kind="question" (radio) yoki "survey" (checkbox).</summary>
public record PublicTestQuestionDto(string Id, string Text, List<string> Options,
    string Kind = "question", bool Multiple = false);

/// <summary>Ommaviy test ko'rinishi (test ishlovchi uchun).</summary>
public record PublicTestDto(
    string Title, string Intro, string CourseName, List<PublicTestQuestionDto> Questions);

/// <summary>Test topshirish so'rovi: kontakt + savol javoblari (savol id → variant indeksi) +
/// so'rovnoma javoblari (element id → tanlangan variant indekslari ro'yxati).</summary>
public record TestSubmitRequest(
    string FullName, string Phone, int Age, Dictionary<string, int> Answers,
    Dictionary<string, List<int>>? SurveyAnswers = null);

/// <summary>Test natijasi (topshirgandan keyin ko'rsatiladi).</summary>
public record TestResultDto(int Score, int Total, int Percent, string Level, string Message);

/// <summary>Arxiv yozuvi (o'chirilgan entity surati) — ko'rsatish uchun.</summary>
public record ArchivedRecordDto(
    string Id, string Type, string EntityId, string Title, string Subtitle,
    string? Reason, string DeletedAt, string ActorName);

/* ---------- Kurs sillabusi (Daraja → Mavzu → Band) ---------- */

/// <summary>Sillabus bandi / DARS (3-bosqich) — daraxtda ko'rsatish uchun (tur + meta + tayyorlik).</summary>
public record CurriculumItemDto(string Id, string Text, string Note, int Order, string Type, string Meta, bool Ready);

/// <summary>Lug'at (vocab) yozuvi: so'z + tarjima.</summary>
public record VocabEntryDto(string Term, string Meaning);
/// <summary>Test savoli: matn + variantlar + to'g'ri javob indeksi.</summary>
public record CourseQuestionDto(string Id, string Text, List<string> Options, int CorrectIndex);
/// <summary>Bitta darsning TO'LIQ kontenti (tahrirlovchi + ko'rish ekrani uchun).</summary>
public record CourseItemDetailDto(
    string Id, string TopicId, string Text, string Note, int Order,
    string Type, string VideoUrl, string AudioUrl, string TextContent, string Meta,
    List<VocabEntryDto> Vocab, List<CourseQuestionDto> Questions);
/// <summary>Dars kontentini saqlash payload'i (nom + tur + kontent + lug'at + test savollari).</summary>
public record SaveItemContentRequest(
    string Text, string Type, string? VideoUrl, string? AudioUrl, string? TextContent, string? Meta,
    List<VocabEntryDto>? Vocab, List<CourseQuestionDto>? Questions);

/// <summary>Sillabus mavzusi (2-bosqich) + uning bandlari.</summary>
public record CurriculumTopicDto(string Id, string Title, string Note, int Order, List<CurriculumItemDto> Items);

/// <summary>Sillabus darajasi (1-bosqich) + uning mavzulari.</summary>
public record CurriculumLevelDto(string Id, string Name, string Note, int Order, List<CurriculumTopicDto> Topics);

/// <summary>Kursning to'liq sillabusi (Daraja → Mavzu → Band).</summary>
public record CurriculumDto(string SubjectId, string CourseName, List<CurriculumLevelDto> Levels);

// ---- Guruh sillabus o'tilishi + tugash prognozi ----
/// <summary>Guruh sillabus bandi: o'tilgan (Covered) bayrog'i + o'tilgan sana (CoveredDate) bilan.</summary>
public record GroupCurriculumItemDto(string Id, string Text, string Note, int Order, bool Covered, string CoveredDate);
/// <summary>O'quvchining bir guruhda o'tilgan sillabus bandi (yoki takrorlash darsi) — vaqt jadvali yozuvi.</summary>
public record CoverageLogEntryDto(string Date, string CourseName, string GroupName, string LevelName, string TopicTitle, string ItemText, bool IsRevision);
/// <summary>Guruh sillabus mavzusi.</summary>
public record GroupCurriculumTopicDto(string Id, string Title, string Note, int Order, List<GroupCurriculumItemDto> Items);
/// <summary>Guruh sillabus darajasi.</summary>
public record GroupCurriculumLevelDto(string Id, string Name, string Note, int Order, List<GroupCurriculumTopicDto> Topics);
/// <summary>Guruhning sillabus o'tilishi + tugash prognozi.</summary>
public record GroupCurriculumDto(
    string GroupId, string CourseId, string CourseName,
    int TotalItems, int CoveredCount, int RevisionLessons, int TotalLessons,
    int RemainingItems, int EstLessonsLeft, int LessonsPerWeek, string EstFinishDate,
    List<GroupCurriculumLevelDto> Levels);
/// <summary>Bandni o'tilgan/o'tilmagan deb belgilash payload'i.</summary>
public record CoverRequest(string ItemId, bool Covered);
/// <summary>Takrorlash darsi qo'shish/olib tashlash payload'i (Delta &gt; 0 qo'shadi, &lt; 0 olib tashlaydi).</summary>
public record RevisionRequest(int Delta);

/// <summary>Daraja yaratish/yangilash payload'i.</summary>
public record LevelInput(string Name, string? Note);
/// <summary>Mavzu yaratish/yangilash payload'i.</summary>
public record TopicInput(string Title, string? Note);
/// <summary>Band yaratish/yangilash payload'i.</summary>
public record ItemInput(string Text, string? Note);

/// <summary>Import: band.</summary>
public record ImportItemDto(string Text, string? Note);
/// <summary>Import: mavzu + bandlari.</summary>
public record ImportTopicDto(string Title, string? Note, List<ImportItemDto> Items);
/// <summary>Import: daraja + mavzulari.</summary>
public record ImportLevelDto(string Name, string? Note, List<ImportTopicDto> Topics);
/// <summary>Butun sillabusni almashtirish (import) payload'i.</summary>
public record CurriculumImportDto(List<ImportLevelDto> Levels);

// ============================ SERTIFIKAT ============================

/// <summary>O'quvchi sertifikati (portal ko'rinishi).</summary>
public record StudentCertificateDto(
    string Id,
    string CourseName,
    string IssuedAt,
    string ExpiresAt,
    string Status,
    string FileName,
    string DownloadUrl,
    int DownloadCount,
    string Metadata);

/// <summary>Admin: o'quvchining tugatgan kursi + sertifikati (StudentDetailPage uchun).</summary>
public record StudentCompletedCourseDto(
    string CertificateId,
    string CourseId,
    string CourseName,
    string IssuedAt,
    string ExpiresAt,
    string Status,
    string FileName,
    string DownloadUrl,
    int DownloadCount,
    string GroupName);

/// <summary>Sertifikat andozasi yaratish so'rovi (admin: kurs + HTML shablon).</summary>
public record CreateCertificateTemplateRequest(
    string Name,
    string CourseId,
    string HtmlTemplate,
    int ValidityDays = 0);

/// <summary>Sertifikat andozasi (admin ko'rinishi).</summary>
public record CertificateTemplateDto(
    string Id,
    string Name,
    string CourseId,
    string CourseName,
    int ValidityDays,
    string CreatedAt);

/// <summary>Sertifikat andozasini yangilash so'rovi (admin: name, courseId, HTML shablon, muddati).</summary>
public record UpdateCertificateTemplateRequest(
    string Name,
    string CourseId,
    string HtmlTemplate,
    int ValidityDays = 0);

/// <summary>Ommaviy sertifikat tekshirish natijasi.</summary>
public record CertificateVerificationDto(
    bool IsValid,
    string StudentName,
    string CourseName,
    string IssuedAt,
    string ExpiresAt,
    string Status,
    bool HashMatched,
    string Metadata,
    string ErrorMessage);

/// <summary>
/// Guruhni yakunlash va YANGI guruh ochish so'rovi (Hybrid).
/// Eski guruh arxivlanadi, o'quvchilarga sertifikat beriladi, yangi kurs/guruh ochiladi.
/// </summary>
public record CompleteAndTransferRequest(
    bool AutoEnrollNewGroup = true,
    string? NewGroupName = null,
    string? CompletionNotes = null,
    /// <summary>Yangi guruh qaysi kurs bilan ochiladi. Bo'sh bo'lsa — eski guruh kursi qayta ishlatiladi.</summary>
    string? TargetCourseId = null);

/// <summary>Complete-and-Transfer (Hybrid) natijasi.</summary>
public record CompleteAndTransferResultDto(
    bool Ok,
    string ArchivedGroupId,
    string NewGroupId,
    int CertificatesGenerated,
    int EnrolledInNew,
    string? TargetCourseName = null);

/// <summary>Admin tomonidan qo'lda sertifikat yaratish so'rovi.</summary>
public record GenerateCertificateRequest(string CourseId, string? Notes = null);

/// <summary>O'quvchining bir sillabus bandi bo'yicha holatini o'rnatish so'rovi.</summary>
public record SetProgressRequest(string StudentId, string ItemId, bool Done);

/* ---------- Teacher performance ---------- */
/// <summary>
/// Bitta o'qituvchining talaba saqlab qolish statistikasi (barcha guruhlari bo'yicha lifetime).
/// Per-group hisob: bir talaba 2 guruhda bo'lsa = 2 slot.
/// </summary>
public record TeacherPerformanceDto(
    string TeacherId,
    string TeacherName,
    string Phone,
    /// <summary>Umumiy slot soni (StudentGroup yozuvlari).</summary>
    int TotalStudents,
    /// <summary>Hozirda faol (Status=="active") slotlar.</summary>
    int ActiveStudents,
    /// <summary>Muzlatilgan (Status=="frozen") slotlar.</summary>
    int FrozenStudents,
    /// <summary>Guruhdan chiqib ketgan (IsActive==false) slotlar.</summary>
    int LeftStudents,
    /// <summary>Active / Total * 100 (0-100).</summary>
    double RetentionPercent,
    /// <summary>(Frozen + Left) / Total * 100 (0-100).</summary>
    double LossPercent,
    /// <summary>0-100 ball: round(RetentionPercent).</summary>
    int EffectivenessScore,
    /// <summary>O'qituvchi biriktirilgan guruhlar soni (arxivlanmagan).</summary>
    int GroupCount
);
