namespace IntellectCRM.Application.Dtos;

// Frontend servislari kutadigan so'rov (request) va javob (response) shakllari.
// JSON camelCase'ga ASP.NET Core standart sozlamasi orqali aylantiriladi.

/* ---------- Auth ---------- */
public record LoginRequest(string Email, string Password);
public record UserDto(
    string Id, string FullName, string Role, string Email, string? AvatarUrl,
    List<string>? Permissions = null);
public record LoginResponse(string Token, UserDto User);
/// <summary>O'quvchi/o'qituvchiga biriktirilgan tizim akkaunti ma'lumotlari (admin uchun).</summary>
public record CredentialsDto(string Login, string Password, string Role);
/// <summary>Joriy foydalanuvchi o'z login (email) va/yoki parolini o'zgartirishi uchun.
/// NewPassword bo'sh bo'lsa — parol o'zgarmaydi. CurrentPassword har doim talab qilinadi.</summary>
public record UpdateAccountRequest(string? Email, string CurrentPassword, string? NewPassword);
/// <summary>O'quvchi/ota-ona ilova ichida o'z parolini almashtirishi uchun.
/// Joriy parol bilan tasdiqlanadi; yangi parol kamida 8 belgi.</summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/* ---------- Students ---------- */
/// <summary>
/// O'quvchi yaratish/tahrirlash so'rovi. FISH alohida-alohida kiritiladi (LastName/FirstName/MiddleName);
/// agar bo'lsa, ulardan FullName yig'iladi. Ota-ona FISH ham alohida.
/// FullName/ParentFullName ixtiyoriy — yo'q bo'lsa parts'dan yig'iladi.
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
public record TeacherPayload(
    string FullName, string BirthDate, string Address, string Gender,
    string HomeroomClass, List<string> SubjectIds, decimal Salary, string? SalaryStartMonth,
    string? NewPassword = null, List<string>? Permissions = null, string? Phone = null,
    string? PhotoUrl = null, string? Category = null, string? SalaryStartDate = null,
    string? SalaryMode = null, decimal SalaryPercent = 0);
public record MonthSalaryDto(string Month, decimal Expected, decimal Paid, decimal Remaining, string Status);
public record SalaryLedgerDto(
    string TeacherId, string FullName, decimal Salary,
    decimal TotalExpected, decimal TotalPaid, decimal Remaining,
    List<MonthSalaryDto> Months, List<PaymentDto> Payments,
    string SalaryMode = "fixed", decimal SalaryPercent = 0);
public record SalaryReportRowDto(
    string TeacherId, string TeacherName, decimal Salary, decimal TotalPaid, int PaymentsCount,
    int Months, decimal Expected, decimal Remaining,
    string SalaryMode = "fixed", decimal SalaryPercent = 0);

/// <summary>O'qituvchilar davomati — oylik board (o'qituvchilar + belgilangan kunlar).</summary>
public record TeacherNameDto(string Id, string FullName, string StartDate = "");
public record TeacherAttendanceDto(string TeacherId, string Date, string Status, string Note);
public record DateRangeDto(string Start, string End);
public record TeacherAttendanceBoardDto(
    List<TeacherNameDto> Teachers, List<TeacherAttendanceDto> Entries, List<DateRangeDto> Quarters);
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
    string Date, bool TurnstileEnabled, string LastSync, bool InTeachingPeriod,
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
public record SubjectPayload(string Name, decimal Price = 0);

/* ---------- Guruhlar (Groups) ---------- */
public record ClassPayload(
    string Name, int Grade, string Language, decimal MonthlyFee, string? Room,
    string? Status = null, string? StartDate = null, string? EndDate = null, int Capacity = 0,
    string? CourseId = null, string? TeacherId = null, string? Note = null,
    List<int>? Days = null, string? StartTime = null, string? EndTime = null);

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
public record LeadCreateRequest(
    string FullName, string Gender, string BirthDate,
    string? Phone, string? FatherFullName, string? FatherPhone,
    string? MotherFullName, string? MotherPhone, string? Note, string Stage,
    string? Source = null, string? InterestSubject = null);
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
    int Homework, int Behavior, int? Mastery);
public record SetJournalEntryRequest(
    string ClassId, string SubjectId, int Quarter, string StudentId, string Date, int Period,
    int? Grade, string? ReasonId, int Homework = 0, int Behavior = 0, int? Mastery = null);
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
public record ClassPerformanceItemDto(string ClassId, string ClassName, double AverageGrade, double? AttendanceRate);
public record TopClassDto(string Id, string Name, int StudentsCount, double AverageGrade);
public record StudentBreakdownDto(int Active, int Inactive, int Debtors, int Paid, int WithGroup, int WithoutGroup);
public record AdminDashboardDto(
    AdminStatsDto Stats, List<ClassPerformanceItemDto> ClassPerformance, List<TopClassDto> TopClasses,
    StudentBreakdownDto StudentBreakdown);

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

/// <summary>O'quvchini arxivlash so'rovi — sababini saqlaydi.</summary>
public record ArchiveStudentRequest(string Reason);

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
/// </summary>
public record TeacherReportRowDto(
    string TeacherId, string FullName, bool IsArchived,
    int Expected, int Conducted, int? DonePct,
    int Grades, int? TopicPct, int? HomeworkPct,
    string? LastActivity, string Status);

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
    string Address, string Region, string District);
/// <summary>Maktab nomi (brending — barcha foydalanuvchilar uchun).</summary>
public record SchoolNameDto(string Name, string TelegramChannel = "");
/// <summary>Telegram bot sozlamasi (admin). Configured = token bo'sh emasligini bildiradi.</summary>
public record TelegramSettingsDto(string BotToken, string BotUsername, string BotName, bool Configured, string Channel = "");
/// <summary>Telegram bot sozlamasini saqlash so'rovi.</summary>
public record SaveTelegramSettingsRequest(string? BotToken, string? BotUsername, string? BotName, string? Channel);
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
    string? Month);
public record FinanceTransactionPayload(
    string Date, string Direction, string Category, decimal Amount, string? Note,
    string? StudentId, string? TeacherId);
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
/// <summary>Oydagi bitta kurs ulushi (qaysi kursga qancha) — to'lov tarixida breakdown uchun.</summary>
public record MonthCourseDto(string CourseName, decimal Fee);
public record MonthLedgerDto(
    string Month, decimal Charged, decimal Discount, decimal Paid, decimal Remaining, string Status,
    List<MonthCourseDto> Courses);
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
    List<string> Permissions, string? PhotoUrl = null);
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

/* ---------- Farzandni olib ketish (pickup) ---------- */
/// <summary>Ota-ona "Farzandimni olishga keldim" so'rovi (ixtiyoriy studentId — bir nechta farzand bo'lsa).</summary>
public record CreatePickupRequest(string? StudentId);
/// <summary>Pickup so'rovi holati. Status: "pending" | "accepted".</summary>
public record PickupRequestDto(
    string Id, string StudentId, string StudentName, string ClassName, string Status,
    string CreatedAt, string? AcceptedAt, string? AcceptedByName);
/// <summary>Sinf rahbarligi ro'yxatidagi bitta o'quvchi — ota-onasi kelgan (pending) bo'lsa belgilanadi.</summary>
public record HomeroomStudentDto(
    string StudentId, string FullName, bool HasPendingPickup, string? Status, string? RequestedAt);
/// <summary>Sinf rahbari farzandni ota-onasiga topshirish so'rovi.</summary>
public record HandoverRequest(string StudentId);
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
    bool Completed, string? SubmittedAt, int? Score);
/// <summary>O'quvchi topshiriq tafsiloti (test bo'lsa — javobsiz savollar bilan).</summary>
public record StudentAssignmentDetailDto(
    string Id, string SubjectName, string Title, string Description, string Format,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    List<AssignmentMaterialDto> Materials, List<StudentTestQuestionDto> Questions,
    bool Completed, string? SubmittedAt, int? Score, string? AnswerText, string? FileUrl);
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
    List<AssignmentMaterialDto> Materials, List<TestQuestionDto> Questions);
public record MaterialInput(string Name, string Url, long Size, string ContentType);
public record QuestionInput(string Text, List<string> Options, int CorrectIndex);
/// <summary>Topshiriq yaratish/tahrirlash so'rovi (ham create, ham update).</summary>
public record SaveAssignmentRequest(
    string SubjectId, string Title, string? Description, string Format, List<string> ClassIds,
    string? StartDate, string? DueDate, bool LateAccept, int LatePenaltyPct, int MaxScore,
    bool AutoGrade, List<MaterialInput>? Materials, List<QuestionInput>? Questions);
/// <summary>Yuklangan fayl haqida ma'lumot (upload javobida).</summary>
public record UploadedFileDto(string Name, string Url, long Size, string ContentType);

/* ---------- Shartnomalar ---------- */

/// <summary>Yuklangan Word andoza (ota-ona/xodim).</summary>
public record ContractTemplateDto(string Id, string Target, string Name, string FileUrl, string FileName, string UploadedAt);
/// <summary>Shartnoma andozasini yaratish so'rovi (fayl avval /api/admin/uploads orqali yuklanadi).</summary>
public record CreateContractTemplateRequest(string Target, string Name, string FileUrl, string FileName);
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

/* ---------- Boshqaruv ---------- */

/// <summary>Filial (branch).</summary>
public record BranchDto(
    string Id, string Name, string Address, double Latitude, double Longitude,
    int RadiusMeters, string CreatedAt);
public record BranchPayload(
    string Name, string Address, double Latitude, double Longitude, int RadiusMeters);

/// <summary>Xodim (o'qituvchi bo'lmagan ishchi) — admin akkaunti bilan.</summary>
public record StaffDto(string Id, string FullName, string Position, string Login, List<string> Permissions);
public record StaffPayload(string FullName, string Position, string? NewPassword = null);
/// <summary>Xodimning admin bo'lim ruxsatlari (faqat superadmin o'zgartiradi).</summary>
public record SetStaffPermissionsRequest(List<string> Permissions);

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

/// <summary>Test savoli (admin — to'g'ri javob bilan).</summary>
public record LevelTestQuestionDto(string Id, string Text, List<string> Options, int CorrectIndex, int Order);

/// <summary>Daraja diapazoni.</summary>
public record LevelTestBandDto(string Id, string Label, int MinPercent, int Order);

/// <summary>Test to'liq tafsiloti (admin editor uchun).</summary>
public record LevelTestDetailDto(
    string Id, string Title, string CourseId, string CourseName, string Slug, string Intro,
    bool IsActive, string CreatedAt,
    List<LevelTestQuestionDto> Questions, List<LevelTestBandDto> Bands);

/// <summary>Savol kiritish/yangilash payload'i (Id bo'sh bo'lsa yangi).</summary>
public record LevelTestQuestionInput(string? Id, string Text, List<string> Options, int CorrectIndex);

/// <summary>Daraja diapazoni payload'i.</summary>
public record LevelTestBandInput(string? Id, string Label, int MinPercent);

/// <summary>Test yaratish/yangilash payload'i.</summary>
public record LevelTestPayload(
    string Title, string CourseId, string Intro, bool IsActive,
    List<LevelTestQuestionInput> Questions, List<LevelTestBandInput> Bands);

/// <summary>Test topshiruvi (admin — natijalar ro'yxati).</summary>
public record LevelTestSubmissionDto(
    string Id, string FullName, string Phone, int Age, int Score, int Total,
    int Percent, string Level, string CreatedAt, string LeadId);

// ---- Ommaviy (anonim) ----

/// <summary>Ommaviy test savoli (to'g'ri javobSIZ).</summary>
public record PublicTestQuestionDto(string Id, string Text, List<string> Options);

/// <summary>Ommaviy test ko'rinishi (test ishlovchi uchun).</summary>
public record PublicTestDto(
    string Title, string Intro, string CourseName, List<PublicTestQuestionDto> Questions);

/// <summary>Test topshirish so'rovi: kontakt + javoblar (savol id → tanlangan variant indeksi).</summary>
public record TestSubmitRequest(
    string FullName, string Phone, int Age, Dictionary<string, int> Answers);

/// <summary>Test natijasi (topshirgandan keyin ko'rsatiladi).</summary>
public record TestResultDto(int Score, int Total, int Percent, string Level, string Message);

/// <summary>Arxiv yozuvi (o'chirilgan entity surati) — ko'rsatish uchun.</summary>
public record ArchivedRecordDto(
    string Id, string Type, string EntityId, string Title, string Subtitle,
    string? Reason, string DeletedAt, string ActorName);

/* ---------- Kurs sillabusi (Daraja → Mavzu → Band) ---------- */

/// <summary>Sillabus bandi (3-bosqich) — ko'rsatish uchun.</summary>
public record CurriculumItemDto(string Id, string Text, string Note, int Order);

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

/// <summary>O'quvchining bir sillabus bandi bo'yicha holatini o'rnatish so'rovi.</summary>
public record SetProgressRequest(string StudentId, string ItemId, bool Done);
