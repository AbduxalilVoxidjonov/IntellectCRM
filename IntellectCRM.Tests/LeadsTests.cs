using System.Net;
using System.Text;
using System.Text.Json;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Microsoft.Extensions.Configuration;
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
    public void Matn_sorovnomada_javoblar_maydoni_yoq_bolsa_ham_ishlaydi()
    {
        // ⚠️ TEST O'ZGARDI (2026-08-22). Ilgari bu yerda ikkita test turardi:
        //   1) "..._yiqiladi" — MA'LUM XATONI qulflab turgan yashil test: so'rovnoma JSON'ida
        //      "Answers" maydoni bo'lmasa `a.Answers.Count` NullReferenceException berardi,
        //      `NotifyNewLeadAsync` tashqi catch'i uni yutar va BUTUN xabarnoma yo'qolardi;
        //   2) "..._ishlashi_kerak" — o'sha xatoni tasvirlaydigan `Skip` test.
        // Xato TUZATILDI (`LeadNotifier.BuildText`: `a.Answers is { Count: > 0 }` va
        // `ParseSurvey` da null elementlar tashlanadi), shuning uchun "yiqiladi" testi o'z
        // ma'nosini yo'qotdi — O'CHIRILDI, `Skip` esa OLIB TASHLANDI: endi TO'G'RI xulq
        // qulflanadi (javobsiz savol "—" bo'lib chiqadi, istisno YO'Q).
        var sub = new LevelTestSubmission
        {
            Score = 1, Total = 2, Percent = 50,
            SurveyJson = "[{\"Question\":\"Savol\"}]",
        };
        Assert.Contains("• Savol: —", BuildText(NewLead(), sub));
    }

    [Fact]
    public void Matn_sorovnomada_null_element_bolsa_ham_yiqilmaydi()
    {
        // Buzuq JSON ("[null]") butun matnni yiqitmasin — element JIM tashlanadi.
        var sub = new LevelTestSubmission
        {
            Score = 1, Total = 2, Percent = 50,
            SurveyJson = "[null,{\"Question\":\"Savol\",\"Answers\":[\"Ha\"]}]",
        };
        Assert.Contains("• Savol: Ha", BuildText(NewLead(), sub));
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

    // ===================== 5) LID KARTASI (guruhdagi xabar TAHRIRLANADI) =====================
    //
    // Rasmiy manba: `.claude/rules/messaging.md` → "LID KARTASI". Guruhdagi lid xabari — KARTA:
    // lid o'zgarganda yangi xabar yuborilmaydi, o'sha xabar `editMessageText` bilan JOYIDA
    // yangilanadi (`LeadNotifier.SyncCardAsync`).
    //
    // ⚠️ Bu bo'limdagi testlarda Telegram TOKEN sozlangan bo'lishi SHART: aks holda
    // `TelegramService.IsConfigured == false` bo'lib, har bir funksiya BIRINCHI qatoridayoq
    // qaytar edi va test hech nimani tekshirmasdi ("yashil, lekin bo'sh" test). Token
    // `TelegramTokenScope` orqali FAQAT joriy test oqimida beriladi (fayl oxiridagi izoh).

    /// <summary>Tarmoqqa chiqmaydigan, lekin har so'rovni YOZIB BORADIGAN Telegram xizmati.</summary>
    private static (TelegramService Telegram, FakeTelegramHandler Http) FakeTelegram(
        Func<string, (HttpStatusCode Code, string Body)>? responder = null)
    {
        var handler = new FakeTelegramHandler(responder);
        return (new TelegramService(new SingleHandlerHttpClientFactory(handler),
            NullLogger<TelegramService>.Instance), handler);
    }

    /// <summary>Lidning mavjud kartasi (Telegram xabariga bog'lovchi yozuv).</summary>
    private static LeadTelegramMessage Card(
        string leadId, long chatId = -100123, long messageId = 55,
        string hash = "eski-xesh", bool dead = false) => new()
    {
        LeadId = leadId, ChatId = chatId, MessageId = messageId,
        TextHash = hash, IsDead = dead, CreatedAt = AppClock.Iso(), UpdatedAt = AppClock.Iso(),
    };

    /// <summary>Bazaga saqlangan lid + (ixtiyoriy) kartalari.</summary>
    private static Lead SeedLead(IntellectCRM.Application.Abstractions.IAppDbContext ctx,
        params LeadTelegramMessage[] cards)
    {
        var lead = NewLead();
        ctx.Leads.Add(lead);
        foreach (var c in cards)
        {
            c.LeadId = lead.Id;
            ctx.LeadTelegramMessages.Add(c);
        }
        ctx.SaveChanges();
        return lead;
    }

    // ---- 5.1 ENG MUHIM HIMOYA: kartasi yo'q lidga karta YARATILMAYDI ----

    [Fact]
    public async Task Kartasi_yoq_lidga_yangi_karta_YARATILMAYDI()
    {
        // 🔴 Busiz deploydan ertasiga menejer kanbanda 200 ta eski lidni surganda guruhga
        // 200 ta yangi karta yog'ilardi. `SyncCardAsync` faqat MAVJUD kartani yangilaydi.
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx);                       // kartasi YO'Q (eski lid)
        ctx.LeadEvents.Add(new LeadEvent { LeadId = lead.Id, Type = "stage", Text = "Ko'chirildi" });
        ctx.SaveChanges();

        using var token = TelegramTokenScope.Use();     // bot SOZLANGAN — bahona qolmasin
        var (tg, http) = FakeTelegram();

        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);

        Assert.Empty(http.Calls);                       // HECH QANDAY so'rov (sendMessage ham) yo'q
        Assert.Empty(ctx.LeadTelegramMessages);         // yolg'on bog'lovchi yozuv ham paydo bo'lmadi
    }

    [Fact]
    public async Task Kartalari_hammasi_olik_bolsa_ham_yangisi_yaratilmaydi()
    {
        // `IsDead` yozuv "karta bor edi, endi yo'q" degani — bu ham YANGI karta yuborishga
        // asos bo'lmaydi (aks holda o'chirilgan xabar har o'zgarishda qaytib tug'ilardi).
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card("", dead: true));

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();

        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);

        Assert.Empty(http.Calls);
        Assert.True(ctx.LeadTelegramMessages.Single().IsDead);   // holati ham o'zgarmadi
    }

    // ---- 5.2 TextHash: bir xil matnga so'rov umuman yuborilmaydi ----

    [Fact]
    public async Task Karta_matni_ozgarmasa_tahrir_sorovi_umuman_yuborilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();

        // ⚠️ Karta matnida "🕒 Yangilandi: HH:mm" bor — agar ikki qadam orasida DAQIQA almashsa
        // matn (demak xesh ham) HAQIQATAN boshqacha bo'ladi va ikkinchi tahrir o'rinli bo'lardi.
        // Shuning uchun daqiqa almashgan bo'lsa qadam qaytadan bajariladi: test soatga bog'liq
        // bo'lib "goh yashil, goh qizil" bo'lmasin.
        int minute;
        do
        {
            minute = AppClock.Now.Minute;
            http.Clear();
            await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);   // xesh eski ⇒ TAHRIR ketadi
            Assert.Single(http.Calls);
            Assert.Equal("editMessageText", http.Calls[0].Method);

            http.Clear();
            await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);   // xesh AYNI ⇒ so'rov YO'Q
        }
        while (AppClock.Now.Minute != minute);

        Assert.Empty(http.Calls);
        Assert.NotEqual("eski-xesh", ctx.LeadTelegramMessages.Single().TextHash);
    }

    // ---- 5.3 Xatolar tasnifi: Gone / RateLimited ----

    [Fact]
    public async Task Xabar_topilmasa_karta_olik_deb_belgilanadi_va_qayta_urinilmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram(
            FakeTelegramHandler.Error(HttpStatusCode.BadRequest, "Bad Request: message to edit not found"));

        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);
        Assert.Single(http.Calls);
        Assert.True(ctx.LeadTelegramMessages.Single().IsDead);

        // Ikkinchi marta — o'lik yozuv umuman OLINMAYDI (tezlik chegarasi bekorga yemasin).
        http.Clear();
        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);
        Assert.Empty(http.Calls);
    }

    [Fact]
    public async Task Tezlik_chegarasida_xesh_saqlanmaydi_va_keyingi_ozgarishda_qayta_urinamiz()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram(
            FakeTelegramHandler.Error((HttpStatusCode)429, "Too Many Requests: retry after 3"));

        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);

        var row = ctx.LeadTelegramMessages.Single();
        Assert.False(row.IsDead);                 // 429 — xabar joyida, faqat "keyinroq"
        Assert.Equal("eski-xesh", row.TextHash);  // xesh SAQLANMADI ⇒ keyingi safar yana urinamiz

        http.Clear();
        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);
        Assert.Single(http.Calls);
    }

    // ---- 5.4 Bot sozlanmagan / hech qachon buzmaydi ----

    [Fact]
    public async Task Karta_boti_sozlanmagan_bolsa_jim_otadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));

        var (tg, http) = FakeTelegram();   // TelegramTokenScope ATAYIN ishlatilmadi ⇒ token yo'q

        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);
        Assert.Empty(http.Calls);
        Assert.Equal("eski-xesh", ctx.LeadTelegramMessages.Single().TextHash);

        // ⚠️ `MarkDeletedAsync` esa token bo'lmasa ham YOZUVLARNI TOZALAYDI (xabar tahrirlanmaydi):
        // lid o'chdi — hech qachon ishlatilmaydigan bog'lovchi qator qolib ketmasin.
        await LeadNotifier.MarkDeletedAsync(ctx, tg, lead.Id, lead.FullName);
        Assert.Empty(http.Calls);
        Assert.Empty(ctx.LeadTelegramMessages);
    }

    [Fact]
    public async Task Karta_hech_qachon_lid_amalini_buzmaydi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        using var token = TelegramTokenScope.Use();

        // (a) Telegram 500 qaytaradi, (b) lid yo'q, (c) id bo'sh, (d) yetim karta (lid o'chgan).
        var (tg, _) = FakeTelegram(FakeTelegramHandler.Error(HttpStatusCode.InternalServerError, "boom"));
        await LeadNotifier.SyncCardAsync(ctx, tg, "yoq-lid");
        await LeadNotifier.SyncCardAsync(ctx, tg, "");
        await LeadNotifier.MarkDeletedAsync(ctx, tg, "yoq-lid", "Kimdir");
        await LeadNotifier.MarkDeletedAsync(ctx, tg, "", "");

        ctx.LeadTelegramMessages.Add(Card("yetim-lid"));
        ctx.SaveChanges();
        await LeadNotifier.SyncCardAsync(ctx, tg, "yetim-lid");

        // (e) TARMOQ umuman yo'q (istisno tashlaydigan HttpClient) — bu ham yutilishi kerak.
        var lead = SeedLead(ctx, Card(""));
        var offline = new TelegramService(new NoNetworkHttpClientFactory(), NullLogger<TelegramService>.Instance);
        await LeadNotifier.SyncCardAsync(ctx, offline, lead.Id);
        await LeadNotifier.MarkDeletedAsync(ctx, offline, lead.Id, lead.FullName);
    }

    // ---- 5.5 O'chirish ----

    [Fact]
    public async Task Lid_ochirilganda_karta_matni_almashadi_va_yozuvlar_tozalanadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx,
            Card("", chatId: -100123, messageId: 55),
            Card("", chatId: -100777, messageId: 66, dead: true));

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();

        await LeadNotifier.MarkDeletedAsync(ctx, tg, lead.Id, lead.FullName);

        // Faqat TIRIK karta tahrirlanadi; xabar O'CHIRILMAYDI (deleteMessage 48 soatdan keyin ishlamaydi).
        var call = Assert.Single(http.Calls);
        Assert.Equal("editMessageText", call.Method);
        Assert.Equal(55, call.MessageId);
        Assert.Contains("🗑 Lid o'chirildi", call.Text);
        Assert.Contains("👤 Yangi Lid", call.Text);

        Assert.Empty(ctx.LeadTelegramMessages);   // yetim qatorlar to'planib qolmaydi
    }

    // ---- 5.6 Yangi lid / takroriy murojaat ----

    [Fact]
    public async Task Yangi_lid_yuborilganda_message_id_saqlanadi()
    {
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx);
        ctx.TelegramGroups.Add(new TelegramGroup { ChatId = -100123, IsActive = true });
        ctx.SaveChanges();

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();

        await LeadNotifier.NotifyNewLeadAsync(ctx, tg, lead, createdBy: "Sayt");

        var call = Assert.Single(http.Calls);
        Assert.Equal("sendMessage", call.Method);

        // ⚠️ Aynan SHU yozuv kartani keyin tahrirlash imkonini beradi — busiz karta rejimi yo'q.
        var row = ctx.LeadTelegramMessages.Single();
        Assert.Equal(-100123, row.ChatId);
        Assert.Equal(FakeTelegramHandler.NewMessageId, row.MessageId);
        Assert.NotEmpty(row.TextHash);
    }

    [Fact]
    public async Task Takroriy_murojaatda_karta_tahrirlanadi_va_ustiga_signal_yuboriladi()
    {
        // ⚠️ Telegram TAHRIRNI bildirishnoma qilmaydi — tashqaridan kelgan ish (takroriy murojaat,
        // test natijasi) sezilmay qolardi. Shuning uchun: tahrir + kartaga JAVOB qilib signal.
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));
        lead.RepeatCount = 2;
        ctx.TelegramGroups.Add(new TelegramGroup { ChatId = -100123, IsActive = true });
        ctx.SaveChanges();

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();

        await LeadNotifier.NotifyNewLeadAsync(ctx, tg, lead, isNewLead: false);

        Assert.Equal(2, http.Calls.Count);
        Assert.Equal("editMessageText", http.Calls[0].Method);   // KARTA yangilandi (yangi karta emas)
        Assert.Equal(55, http.Calls[0].MessageId);

        var signal = http.Calls[1];
        Assert.Equal("sendMessage", signal.Method);
        Assert.Equal(55, signal.ReplyTo);                        // kartaga JAVOB — bosilsa kartaga sakraydi
        Assert.Contains("🔁 Takroriy murojaat (×2)", signal.Text);
        Assert.Single(ctx.LeadTelegramMessages);                 // signal id'si SAQLANMAYDI
    }

    // ---- 5.7 ClassifyEditError — sof funksiya, tarmoqsiz ----

    [Theory]
    // «matn aynan eski» — xato emas, ish bajarilgan
    [InlineData(400, "Bad Request: message is not modified: specified new message content...", TgEditResult.NotModified)]
    [InlineData(400, "Message Is Not Modified", TgEditResult.NotModified)]              // registr farq qiladi
    // xabar/chat yo'q yoki bot u yerda emas — QAYTA URINILMAYDI
    [InlineData(400, "Bad Request: message to edit not found", TgEditResult.Gone)]
    [InlineData(400, "Bad Request: MESSAGE_ID_INVALID", TgEditResult.Gone)]
    [InlineData(400, "Bad Request: message_id_invalid", TgEditResult.Gone)]             // registr farq qiladi
    [InlineData(400, "Bad Request: chat not found", TgEditResult.Gone)]
    [InlineData(400, "Bad Request: message can't be edited", TgEditResult.Gone)]
    [InlineData(403, "Forbidden: bot was kicked from the supergroup chat", TgEditResult.Gone)]
    [InlineData(403, "Forbidden: bot is not a member of the supergroup chat", TgEditResult.Gone)]
    // tezlik chegarasi
    [InlineData(429, "Too Many Requests: retry after 5", TgEditResult.RateLimited)]
    [InlineData(200, "TOO MANY REQUESTS", TgEditResult.RateLimited)]                    // faqat matndan ham
    [InlineData(429, null, TgEditResult.RateLimited)]                                   // faqat koddan ham
    // noma'lum sabab
    [InlineData(400, "Bad Request: kutilmagan yangi sabab", TgEditResult.Failed)]
    [InlineData(500, "", TgEditResult.Failed)]
    [InlineData(500, null, TgEditResult.Failed)]                                        // description YO'Q
    public void Tahrir_xatosi_togri_tasniflanadi(int status, string? description, TgEditResult expected)
    {
        Assert.Equal(expected, TelegramService.ClassifyEditError(status, description));
    }

    [Fact]
    public void Tahrir_xatosida_matn_ozgarmagani_429_dan_USTUN()
    {
        // Tartib muhim: 429 bilan birga kelgan "not modified" ham MUVAFFAQIYAT deb qaraladi,
        // aks holda xesh saqlanmay, har safar qayta urinilardi.
        Assert.Equal(TgEditResult.NotModified,
            TelegramService.ClassifyEditError(429, "Bad Request: message is not modified"));
    }

    // ---- 5.8 Karta MATNI (BuildCardText) ----

    private static string BuildCardText(
        Lead lead, LevelTestSubmission? sub = null, string? testTitle = null, string? createdBy = null,
        string? stageTitle = null, TrialLesson? trial = null, string? trialGroupName = null,
        IReadOnlyList<LeadEvent>? notes = null) =>
        Reflect.StaticCall<string>(typeof(LeadNotifier), "BuildCardText",
            lead, sub, testTitle, createdBy, stageTitle, trial, trialGroupName,
            notes ?? new List<LeadEvent>());

    [Fact]
    public void Karta_matnida_lidning_JORIY_holati_boradi()
    {
        var lead = NewLead();
        lead.RepeatCount = 3;
        lead.LastRepeatAt = "2026-08-20T09:15:00";
        lead.ConvertedStudentId = "s-1";
        var trial = new TrialLesson { ScheduledAt = "2026-08-23T15:30", Result = "stayed" };
        var notes = new List<LeadEvent>
        {
            new() { Type = "call", Text = "Ota-onasi bilan gaplashildi", ActorName = "Aziz" },
            new() { Type = "note", Text = "Dushanbaga keladi" },
        };

        var text = BuildCardText(lead, stageTitle: "Aloqada", trial: trial,
            trialGroupName: "IELTS-1", notes: notes);

        Assert.Contains("📍 Bosqich: Aloqada", text);
        Assert.Contains("🎓 Sinov darsi: 2026-08-23 15:30 · IELTS-1 — qoldi", text);
        Assert.Contains("🔁 Takroriy murojaat: ×3 (2026-08-20 09:15)", text);
        Assert.Contains("💬 Oxirgi izohlar:", text);
        Assert.Contains("• Ota-onasi bilan gaplashildi — Aziz", text);
        Assert.Contains("• Dushanbaga keladi", text);
        Assert.Contains("✅ O'quvchi bo'ldi", text);
        Assert.Contains("🕒 Yangilandi:", text);   // karta TIRIK ekani ko'rinsin
    }

    [Fact]
    public void Karta_matnida_bosh_maydonlar_qator_chiqarmaydi()
    {
        var text = BuildCardText(NewLead());

        Assert.Contains("🆕 Yangi lid!", text);    // RepeatCount = 0 ⇒ "yangi" sarlavhasi
        Assert.Contains("— — —", text);            // holat bloki ajratkichi
        Assert.DoesNotContain("📍 Bosqich:", text);
        Assert.DoesNotContain("🎓 Sinov darsi:", text);
        Assert.DoesNotContain("🔁 Takroriy murojaat:", text);
        Assert.DoesNotContain("💬 Oxirgi izohlar:", text);
        Assert.DoesNotContain("✅ O'quvchi bo'ldi", text);
    }

    [Fact]
    public void Karta_sarlavhasi_takroriy_lidda_ozgaradi()
    {
        // Sarlavha lidning O'ZIDAN (RepeatCount) hisoblanadi — hodisadan emas, shu sabab har
        // tahrirda bir xil chiqadi (aks holda xesh bekorga farq qilardi).
        var lead = NewLead();
        lead.RepeatCount = 1;
        Assert.StartsWith("🔁 Mavjud lid yangilandi", BuildCardText(lead));
    }

    [Fact]
    public void Karta_uzun_izohni_qirqadi()
    {
        // Karta — TARIX emas, joriy holat: bitta uzun izoh butun kartani egallab olmasin.
        var lead = NewLead();
        var notes = new List<LeadEvent> { new() { Type = "note", Text = new string('a', 400) } };
        var text = BuildCardText(lead, notes: notes);

        Assert.Contains("…", text);
        Assert.DoesNotContain(new string('a', 200), text);
    }

    [Fact]
    public async Task Kartada_faqat_OXIRGI_ikkita_izoh_boradi()
    {
        // (`ComposeCardAsync` `Take(2)` qiladi — BuildCardText esa berilganini chizadi.)
        using var db = TestDb.Sqlite();
        var ctx = db.Context;
        var lead = SeedLead(ctx, Card(""));
        for (var i = 1; i <= 4; i++)
            ctx.LeadEvents.Add(new LeadEvent
            {
                LeadId = lead.Id, Type = "note", Text = $"izoh-{i}",
                CreatedAt = $"2026-08-2{i}T10:00:00",
            });
        ctx.SaveChanges();

        using var token = TelegramTokenScope.Use();
        var (tg, http) = FakeTelegram();
        await LeadNotifier.SyncCardAsync(ctx, tg, lead.Id);

        var text = Assert.Single(http.Calls).Text;
        Assert.Contains("• izoh-4", text);
        Assert.Contains("• izoh-3", text);
        Assert.DoesNotContain("• izoh-2", text);
        Assert.DoesNotContain("• izoh-1", text);
    }

    // ---- 5.9 4000 belgi chegarasi (Telegram'da 4096) ----

    private static string Trim(string text) =>
        Reflect.StaticCall<string>(typeof(LeadNotifier), "Trim", text);

    [Fact]
    public void Karta_matni_4000_belgidan_oshmaydi()
    {
        // Ilgari uzun so'rovnomali xabar Telegram chegarasidan oshib 400 olardi, xato esa jim
        // yutilib XABAR UMUMAN YO'QOLARDI.
        var lead = NewLead();
        lead.Note = new string('a', 9000);

        var text = BuildCardText(lead);

        Assert.True(text.Length <= 4000, $"karta matni {text.Length} belgi");
        Assert.EndsWith("…", text);
    }

    [Fact]
    public void Qirqishda_emoji_ortasidan_kesilmaydi()
    {
        // 3998 belgi + emoji (IKKI `char` — surrogat juftlik): oddiy qirqishda 3999-belgi
        // juftlikning YARMI bo'lib qolar va Telegram'da buzuq belgi chiqardi.
        var text = new string('a', 3998) + "😀" + new string('b', 100);

        var cut = Trim(text);

        Assert.True(cut.Length <= 4000);
        Assert.EndsWith("…", cut);
        // Yolg'iz surrogat UTF-8'ga o'girilganda U+FFFD ga aylanadi — shu bilan tekshiramiz.
        var roundTrip = Encoding.UTF8.GetString(Encoding.UTF8.GetBytes(cut));
        Assert.DoesNotContain("�", roundTrip);
    }

    [Fact]
    public void Chegaradan_qisqa_matn_qirqilmaydi()
    {
        var text = "🆕 Yangi lid!\n👤 Yangi Lid";
        Assert.Equal(text, Trim(text));
    }
}

// =================================================================================================
// LID KARTASI testlari uchun yordamchilar
// =================================================================================================

/// <summary>Telegram Bot API'ga ketgan bitta so'rov (JSON tanasidan o'qilgan holda).</summary>
/// <param name="Method">API metodi: <c>sendMessage</c> | <c>editMessageText</c>.</param>
internal sealed record TgCall(string Method, long ChatId, long MessageId, long? ReplyTo, string Text);

/// <summary>
/// Telegram javobini SOXTALASHTIRADIGAN handler: haqiqiy tarmoqqa chiqmaydi, lekin
/// <see cref="NoNetworkHttpClientFactory"/> dan farqli o'laroq so'rovni YOZIB BORADI.
///
/// <para>⚠️ Nega kerak: <c>TelegramService</c> har xatoni O'ZI yutadi (log + <c>false</c>), ya'ni
/// "tarmoqqa chiqsa test yiqiladi" usuli KARTA testlarida ishlamaydi — ortiqcha so'rov jimgina
/// yutilib, test baribir yashil qolardi. Shuning uchun so'rovlar SANALADI.</para>
/// </summary>
internal sealed class FakeTelegramHandler(
    Func<string, (HttpStatusCode Code, string Body)>? responder = null) : HttpMessageHandler
{
    /// <summary>Soxta Telegram bergan <c>message_id</c> (yangi xabar uchun).</summary>
    public const long NewMessageId = 777;

    private readonly List<TgCall> _calls = new();

    public IReadOnlyList<TgCall> Calls { get { lock (_calls) return _calls.ToList(); } }

    public void Clear() { lock (_calls) _calls.Clear(); }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        var method = request.RequestUri!.Segments[^1];
        var body = request.Content is null ? "{}" : await request.Content.ReadAsStringAsync(ct);
        using (var doc = JsonDocument.Parse(body))
        {
            var root = doc.RootElement;
            long Num(string name) => root.TryGetProperty(name, out var v) ? v.GetInt64() : 0;
            long? Opt(string name) => root.TryGetProperty(name, out var v) ? v.GetInt64() : null;
            var call = new TgCall(method, Num("chat_id"), Num("message_id"), Opt("reply_to_message_id"),
                root.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "");
            lock (_calls) _calls.Add(call);
        }

        var (code, responseBody) = (responder ?? Success)(method);
        return new HttpResponseMessage(code)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json"),
        };
    }

    /// <summary>Standart javob: hammasi muvaffaqiyatli (yangi xabar — <see cref="NewMessageId"/>).</summary>
    public static (HttpStatusCode, string) Success(string method) => method == "sendMessage"
        ? (HttpStatusCode.OK, $"{{\"ok\":true,\"result\":{{\"message_id\":{NewMessageId}}}}}")
        : (HttpStatusCode.OK, "{\"ok\":true}");

    /// <summary>Telegram xato javobi: <c>{"ok":false,"description":"..."}</c>.</summary>
    public static Func<string, (HttpStatusCode, string)> Error(HttpStatusCode code, string description) =>
        _ => (code, JsonSerializer.Serialize(new { ok = false, description }));
}

/// <summary>Berilgan handler ustida HttpClient beradigan fabrika (handler QAYTA ishlatiladi —
/// shuning uchun <c>disposeHandler: false</c>: aks holda birinchi so'rovdan keyin yozuvlar yo'qolardi).</summary>
internal sealed class SingleHandlerHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}

/// <summary>
/// Telegram tokenini FAQAT JORIY TEST OQIMIDA "sozlangan" qilib ko'rsatadi
/// (<c>TelegramService.IsConfigured == true</c>).
///
/// <para><b>NEGA KERAK:</b> token <see cref="AppSecrets"/> dan (statik, global) o'qiladi va
/// <c>TelegramService.IsConfigured</c> <c>virtual</c> EMAS — ya'ni testda uni obyekt darajasida
/// almashtirib bo'lmaydi. Tokensiz esa <c>SyncCardAsync</c>/<c>MarkDeletedAsync</c> birinchi
/// qatoridayoq qaytadi va test HECH NIMANI tekshirmaydi.</para>
///
/// <para>⚠️ <b>PARALLEL TESTLAR BUZILMAYDI:</b> xUnit test klasslarini parallel yuritadi, shuning
/// uchun global <c>AppSecrets</c> ga token YOZIB QO'YIB bo'lmasdi (masalan
/// «Xabarnoma_bot_sozlanmagan_bolsa_jim_otadi» tasodifan qizarardi). Yechim: <c>AppSecrets</c> ga
/// bir marta shunday konfiguratsiya o'rnatiladi-ki, u qiymatni <see cref="AsyncLocal{T}"/> dan
/// oladi — ya'ni tokenni FAQAT shu <c>using</c> bloki ichidagi oqim ko'radi, boshqa hamma joyda
/// (va boshqa hamma kalit uchun) natija baribir BO'SH bo'ladi — Init'gacha bo'lgani bilan bir xil.</para>
/// </summary>
internal sealed class TelegramTokenScope : IDisposable
{
    private static readonly AsyncLocal<string?> Current = new();
    private static readonly AsyncLocalConfig Config = new(() => Current.Value);
    private static int _installed;

    public static TelegramTokenScope Use(string token = "test-bot-token")
    {
        if (Interlocked.Exchange(ref _installed, 1) == 0) AppSecrets.Init(Config);
        Current.Value = token;
        return new TelegramTokenScope();
    }

    public void Dispose() => Current.Value = null;

    /// <summary>Faqat Telegram token kalitiga javob beradigan (va faqat joriy oqimda!)
    /// eng kichik <see cref="IConfiguration"/>.</summary>
    private sealed class AsyncLocalConfig(Func<string?> token) : IConfiguration
    {
        private readonly IConfiguration _empty = new ConfigurationBuilder().Build();

        public string? this[string key]
        {
            get => key is "Telegram:BotToken" or AppSecrets.EnvKeys.TelegramBotToken ? token() : null;
            set { }
        }

        public IEnumerable<IConfigurationSection> GetChildren() => _empty.GetChildren();
        public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => _empty.GetReloadToken();
        public IConfigurationSection GetSection(string key) => _empty.GetSection(key);
    }
}
