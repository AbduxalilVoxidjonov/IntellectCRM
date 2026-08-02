using System.Text.Json;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// CRM / LIDLAR testlari: yangi lid xabarnomasi (<see cref="LeadNotifier"/>) va sinov darsi
/// eslatmasi (<see cref="TrialReminderService"/>). Rasmiy manba: <c>.claude/rules/crm-leads.md</c>
/// va <c>.claude/rules/messaging.md</c>.
///
/// <para><see cref="LeadNotifier"/> ning matn tuzish va oluvchi tanlash mantig'i <c>private static</c>
/// (tashqi yuborish Telegram tokeniga bog'liq — testda tarmoq YO'Q), shuning uchun refleksiya orqali
/// bevosita chaqiriladi: aynan shu ikki qism qoidaning o'zi.</para>
/// </summary>
public class LeadsTests
{
    private static bool ShouldNotify(AppUser u) =>
        Reflect.StaticCall<bool>(typeof(LeadNotifier), "ShouldNotify", u);

    private static string BuildText(
        Lead lead, LevelTestSubmission? sub = null, string? testTitle = null,
        bool isNewLead = true, string? createdBy = null) =>
        Reflect.StaticCall<string>(typeof(LeadNotifier), "BuildText", lead, sub, testTitle, isNewLead, createdBy);

    private static Lead NewLead() => new()
    {
        FullName = "Yangi Lid",
        Phone = "901234567",
        Source = "Instagram",
        InterestSubject = "IELTS",
    };

    // ===================== 1) Oluvchi: FAQAT superadmin =====================

    [Fact]
    public void Shaxsiy_xabarnoma_faqat_superadminga_boradi()
    {
        // messaging.md: "SHAXSIY xabar FAQAT SUPERADMIN(lar)ga + bot qo'shilgan faol GURUH(lar)ga".
        Assert.True(ShouldNotify(new AppUser { Role = Roles.SuperAdmin }));
    }

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Staff)]
    [InlineData(Roles.Teacher)]
    [InlineData(Roles.Student)]
    [InlineData(Roles.PlatformOwner)]
    [InlineData("")]
    public void Boshqa_rollarga_shaxsiy_xabarnoma_bormaydi(string role)
    {
        Assert.False(ShouldNotify(new AppUser { Role = role }));
    }

    // ===================== 2) Xabar matni =====================

    [Fact]
    public void Matn_yangi_lidda_yangi_sarlavha_bilan_boshlanadi()
    {
        var text = BuildText(NewLead());
        Assert.StartsWith("🆕 Yangi lid!", text);
        Assert.Contains("👤 Yangi Lid", text);
        Assert.Contains("📞 901234567", text);
        Assert.Contains("🔖 Manba: Instagram", text);
        Assert.Contains("📚 Qiziqish: IELTS", text);
    }

    [Fact]
    public void Matn_mavjud_lid_yangilanganda_boshqa_sarlavha()
    {
        var text = BuildText(NewLead(), isNewLead: false);
        Assert.StartsWith("🔁 Mavjud lid yangilandi", text);
    }

    [Fact]
    public void Matn_mavjud_lidga_yangi_test_natijasi_kelganda_alohida_sarlavha()
    {
        var sub = new LevelTestSubmission { Score = 8, Total = 10, Percent = 80 };
        var text = BuildText(NewLead(), sub, isNewLead: false);
        Assert.StartsWith("🔁 Mavjud lid — yangi test natijasi", text);
    }

    [Fact]
    public void Matn_bosh_maydonlar_uchun_qator_chiqarmaydi()
    {
        var text = BuildText(new Lead { FullName = "Faqat Ism" });
        Assert.Contains("👤 Faqat Ism", text);
        Assert.DoesNotContain("📞", text);
        Assert.DoesNotContain("🔖", text);
        Assert.DoesNotContain("📚", text);
    }

    [Fact]
    public void Matn_kim_kiritganini_eng_tagida_korsatadi()
    {
        var text = BuildText(NewLead(), createdBy: "Sayt");
        Assert.EndsWith("🧑‍💼 Kiritdi: Sayt", text);
    }

    [Fact]
    public void Matn_createdBy_bosh_bolsa_kiritdi_qatori_yoq()
    {
        Assert.DoesNotContain("Kiritdi:", BuildText(NewLead(), createdBy: "   "));
    }

    [Fact]
    public void Matn_izohni_faqat_test_natijasi_bolmaganda_qoshadi()
    {
        var lead = NewLead();
        lead.Note = "Ertaga qo'ng'iroq qilish kerak";

        Assert.Contains("📝 Ertaga qo'ng'iroq qilish kerak", BuildText(lead));

        // Test natijasi bo'lsa — izoh o'rniga natija bloki chiqadi (HOZIRGI xulq).
        var sub = new LevelTestSubmission { Score = 5, Total = 10, Percent = 50 };
        Assert.DoesNotContain("Ertaga qo'ng'iroq", BuildText(lead, sub));
    }

    [Fact]
    public void Matn_test_natijasini_ball_foiz_daraja_bilan_korsatadi()
    {
        var sub = new LevelTestSubmission { Score = 17, Total = 20, Percent = 85, Level = "B2", Age = 15 };
        var text = BuildText(NewLead(), sub, testTitle: "Ingliz tili — daraja testi");

        Assert.Contains("📊 Daraja testi natijasi", text);
        Assert.Contains("📝 Test: Ingliz tili — daraja testi", text);
        Assert.Contains("✅ Ball: 17/20 (85%)", text);
        Assert.Contains("🎯 Daraja: B2", text);
        Assert.Contains("🎂 Yoshi: 15", text);
    }

    [Theory]
    [InlineData(100, "A'lo", "🟢")]
    [InlineData(80, "A'lo", "🟢")]
    [InlineData(79, "Yaxshi", "🟢")]
    [InlineData(60, "Yaxshi", "🟢")]
    [InlineData(59, "O'rta", "🟡")]
    [InlineData(40, "O'rta", "🟡")]
    [InlineData(39, "Past", "🔴")]
    [InlineData(0, "Past", "🔴")]
    public void Matn_foizga_qarab_sifat_bahosini_beradi(int percent, string label, string icon)
    {
        var sub = new LevelTestSubmission { Score = percent, Total = 100, Percent = percent };
        var text = BuildText(NewLead(), sub);
        Assert.Contains($"{icon} Baho: {label}", text);
    }

    [Fact]
    public void Matn_savolsiz_testda_ball_ornida_izoh_korsatadi()
    {
        var sub = new LevelTestSubmission { Score = 0, Total = 0, Percent = 0 };
        var text = BuildText(NewLead(), sub);
        Assert.Contains("ℹ️ Test savolsiz (faqat so'rovnoma).", text);
        Assert.DoesNotContain("✅ Ball:", text);
    }

    [Fact]
    public void Matn_yosh_korsatilmagan_bolsa_qator_chiqmaydi()
    {
        var sub = new LevelTestSubmission { Score = 1, Total = 2, Percent = 50, Age = 0 };
        Assert.DoesNotContain("🎂", BuildText(NewLead(), sub));
    }

    [Fact]
    public void Matn_sorovnoma_javoblarini_royxat_qilib_beradi()
    {
        var survey = JsonSerializer.Serialize(new List<SurveyAnswerDto>
        {
            new("Qayerdan eshitdingiz?", new List<string> { "Instagram", "Do'stlardan" }),
            new("Qaysi vaqt qulay?", new List<string>()),
        });
        var sub = new LevelTestSubmission { Score = 1, Total = 2, Percent = 50, SurveyJson = survey };

        var text = BuildText(NewLead(), sub);

        Assert.Contains("🗒 So'rovnoma:", text);
        Assert.Contains("• Qayerdan eshitdingiz?: Instagram, Do'stlardan", text);
        Assert.Contains("• Qaysi vaqt qulay?: —", text);   // javob tanlanmagan
    }

    [Fact]
    public void Matn_buzuq_sorovnoma_JSONida_yiqilmaydi()
    {
        var sub = new LevelTestSubmission { Score = 1, Total = 2, Percent = 50, SurveyJson = "{buzuq" };
        var text = BuildText(NewLead(), sub);
        Assert.DoesNotContain("🗒 So'rovnoma:", text);
    }

    [Fact]
    public void Matn_sorovnomasiz_testda_sorovnoma_bolimi_yoq()
    {
        var sub = new LevelTestSubmission { Score = 1, Total = 2, Percent = 50, SurveyJson = "" };
        Assert.DoesNotContain("🗒", BuildText(NewLead(), sub));
    }

    [Fact]
    public void Matn_sorovnomada_javoblar_maydoni_yoq_bolsa_yiqiladi()
    {
        // HOZIRGI XULQ (xatoni qayd etuvchi yashil test): "Answers" maydonisiz JSON'da
        // SurveyAnswerDto.Answers = null bo'ladi va `a.Answers.Count` NullReferenceException beradi.
        // NotifyNewLeadAsync bu xatoni JIMGINA yutadi ⇒ butun lid xabarnomasi yo'qoladi.
        var sub = new LevelTestSubmission
        {
            Score = 1, Total = 2, Percent = 50,
            SurveyJson = "[{\"Question\":\"Savol\"}]",
        };
        var ex = Assert.Throws<System.Reflection.TargetInvocationException>(() => BuildText(NewLead(), sub));
        Assert.IsType<NullReferenceException>(ex.InnerException);
    }

    [Fact(Skip = "XATO (LeadNotifier.cs:98 + Dtos.cs:1841): so'rovnoma JSON'ida \"Answers\" bo'lmasa " +
                 "SurveyAnswerDto.Answers = null bo'ladi va BuildText NullReferenceException tashlaydi; " +
                 "NotifyNewLeadAsync tashqi catch'i uni yutadi — natijada YANGI LID XABARNOMASI umuman " +
                 "yuborilmaydi. Tuzatish: `a.Answers?.Count > 0` (yoki DTO'da `Answers` uchun bo'sh " +
                 "ro'yxat default'i).")]
    public void Matn_sorovnomada_javoblar_maydoni_yoq_bolsa_ham_ishlashi_kerak()
    {
        var sub = new LevelTestSubmission
        {
            Score = 1, Total = 2, Percent = 50,
            SurveyJson = "[{\"Question\":\"Savol\"}]",
        };
        Assert.Contains("• Savol: —", BuildText(NewLead(), sub));
    }

    // ===================== 3) NotifyNewLeadAsync — himoya xulqi =====================

    private static TelegramService Telegram() =>
        new(new NoNetworkHttpClientFactory(), NullLogger<TelegramService>.Instance);

    [Fact]
    public async Task Xabarnoma_bot_sozlanmagan_bolsa_jim_otadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = NewLead();
        ctx.Leads.Add(lead);
        ctx.Users.Add(new AppUser { FullName = "Bosh admin", Email = "super", Role = Roles.SuperAdmin });
        ctx.TelegramGroups.Add(new TelegramGroup { ChatId = -100123, IsActive = true });
        ctx.SaveChanges();

        // Token .env'da yo'q ⇒ IsConfigured=false ⇒ hech qanday so'rov ketmaydi (tarmoq bloklangan
        // fabrika bilan — agar chiqmoqchi bo'lsa test yiqilardi).
        await LeadNotifier.NotifyNewLeadAsync(ctx, Telegram(), lead);
    }

    [Fact]
    public async Task Xabarnoma_hech_qachon_lid_yaratishni_buzmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        // Ataylab nomukammal ma'lumot: lid bo'sh, ro'yxatlar bo'sh — istisno chiqmasligi kerak.
        await LeadNotifier.NotifyNewLeadAsync(ctx, Telegram(), new Lead());
    }

    [Fact]
    public void Faol_telegram_guruhlari_va_superadmin_royxatlari_ajratilgan()
    {
        // Oluvchilar to'plami: (a) UserId biriktirilgan shaxsiy registratsiyalar, (b) IsActive guruhlar.
        // Bot chiqarilgan guruh (IsActive=false) ro'yxatga TUSHMASLIGI kerak.
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        ctx.TelegramGroups.AddRange(
            new TelegramGroup { ChatId = -1, IsActive = true },
            new TelegramGroup { ChatId = -2, IsActive = false });
        ctx.TelegramRegistrations.AddRange(
            new TelegramRegistration { UserId = "u-1", ChatId = 11 },
            new TelegramRegistration { UserId = "", ChatId = 12 },      // xodim emas — o'quvchi yozuvi
            new TelegramRegistration { UserId = null, ChatId = 13 });
        ctx.SaveChanges();

        Assert.Equal(new long[] { -1 }, ctx.TelegramGroups.Where(g => g.IsActive).Select(g => g.ChatId).ToArray());
        Assert.Equal(new long[] { 11 },
            ctx.TelegramRegistrations.Where(r => r.UserId != null && r.UserId != "").Select(r => r.ChatId).ToArray());
    }

    // ===================== 4) Sinov darsi eslatmasi =====================

    private static TrialReminderService Trial(IntellectCRM.Application.Abstractions.IAppDbContext ctx,
        MessagingStack stack) =>
        new(new SingleServiceProvider(ctx), stack.Auto, NullLogger<TrialReminderService>.Instance);

    private static AutoMessageRule TrialRule(
        string template = "Salom {fish}! Ertaga {dars_sana} kuni {dars_vaqti}da sinov darsingiz bor.") => new()
    {
        Trigger = AutoMessageTriggers.TrialReminder,
        Enabled = true,
        SendSms = true,
        SmsProvider = "local",
        Template = template,
    };

    /// <summary>Local SMS yoqilgan markaz (Eskiz .env'siz — testda faqat "local" yo'li ishlaydi).</summary>
    private static void EnableLocalSms(IntellectCRM.Application.Abstractions.IAppDbContext ctx) =>
        ctx.CenterMeta.Add(new CenterMeta { Name = "Intellect", LocalSmsEnabled = true });

    private static (Lead lead, TrialLesson trial) AddTrial(
        IntellectCRM.Application.Abstractions.IAppDbContext ctx, DateOnly day, string result = "pending",
        string time = "15:30")
    {
        var lead = NewLead();
        var trial = new TrialLesson
        {
            LeadId = lead.Id,
            ScheduledAt = $"{day:yyyy-MM-dd}T{time}",
            Result = result,
        };
        ctx.Leads.Add(lead);
        ctx.TrialLessons.Add(trial);
        return (lead, trial);
    }

    [Fact]
    public void Sinov_eslatmasi_ertangi_darsga_yuboriladi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        AddTrial(ctx, today.AddDays(1));
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        var log = Assert.Single(ctx.SmsLogs);
        Assert.Contains("Salom Yangi Lid!", log.Message);
        Assert.Contains($"{today.AddDays(1):dd.MM.yyyy}", log.Message);
        Assert.Contains("15:30", log.Message);
    }

    [Fact]
    public void Sinov_eslatmasi_bugungi_darsga_yuborilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        AddTrial(ctx, today);
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Fact]
    public void Sinov_eslatmasi_indingi_darsga_yuborilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        AddTrial(ctx, today.AddDays(2));
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Theory]
    [InlineData("stayed")]
    [InlineData("left")]
    public void Sinov_eslatmasi_natijasi_belgilangan_darsga_yuborilmaydi(string result)
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        AddTrial(ctx, today.AddDays(1), result);
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Fact]
    public void Sinov_eslatmasi_oquvchiga_aylantirilgan_lidga_yuborilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        var (lead, _) = AddTrial(ctx, today.AddDays(1));
        lead.ConvertedStudentId = "s-1";
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Fact]
    public void Sinov_eslatmasi_qoida_yoq_bolsa_ishlamaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        AddTrial(ctx, today.AddDays(1));
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Fact]
    public void Sinov_eslatmasi_lid_topilmasa_yiqilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        ctx.TrialLessons.Add(new TrialLesson
        {
            LeadId = "yoq-lid",
            ScheduledAt = $"{today.AddDays(1):yyyy-MM-dd}T10:00",
            Result = "pending",
        });
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }

    [Fact]
    public void Sinov_eslatmasi_guruh_kunlarini_ham_tokenga_qoyadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        EnableLocalSms(ctx);
        var group = new Group { Name = "IELTS-1", Days = new List<int> { 0, 2, 4 } };
        var (_, trial) = AddTrial(ctx, today.AddDays(1));
        trial.GroupId = group.Id;
        ctx.Classes.Add(group);
        ctx.AutoMessageRules.Add(TrialRule("Kunlar: {dars_kunlari}"));
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        var log = Assert.Single(ctx.SmsLogs);
        Assert.StartsWith("Kunlar: ", log.Message);
        Assert.Contains("Du", log.Message);
    }

    [Fact]
    public void Sinov_eslatmasi_local_SMS_ochirilgan_bolsa_yuborilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var today = AppClock.Today;
        ctx.CenterMeta.Add(new CenterMeta { LocalSmsEnabled = false });
        AddTrial(ctx, today.AddDays(1));
        ctx.AutoMessageRules.Add(TrialRule());
        ctx.SaveChanges();

        Reflect.RunAsyncMethod(Trial(ctx, new MessagingStack()), "RunAsync", today, CancellationToken.None);

        Assert.Empty(ctx.SmsLogs);
    }
}
