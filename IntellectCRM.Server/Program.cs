using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;
using System.Security.Claims;
using IntellectCRM.Domain;
using IntellectCRM.Application.Abstractions;
using IntellectCRM.Application.Hubs;
using IntellectCRM.Application.Services;
using IntellectCRM.Infrastructure.Auth;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Server.Controllers;
using IntellectCRM.Server.Cti;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

// PostgreSQL (Npgsql): DateTime (Kind=Unspecified, AppClock — Toshkent local) ni `timestamp`
// (timezonesiz) sifatida saqlash — SQL Server'dagi xulqni saqlaydi. Aks holda Npgsql 6+ default
// `timestamptz` UTC talab qilib, har bir yozuvda istisno tashlaydi. Boshqa hech narsadan oldin o'rnatilishi shart.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

var defaultConn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default sozlanmagan.");

// ---------- Xizmatlar ----------
// PostgreSQL (Npgsql). Connection string `ConnectionStrings:Default` orqali beriladi
// (dev: appsettings.json, prod: muhit o'zgaruvchisi). 1GB RAM serverga ham sig'adi.
builder.Services.AddDbContext<AppDbContext>((sp, opt) =>
    opt.UseNpgsql(defaultConn,
            npg =>
            {
                // Vaqtinchalik DB uzilishlarini avtomatik qayta urinish bilan chidaydi.
                npg.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(10),
                    errorCodesToAdd: null);
                // Ko'p kolleksiyali Include'larni alohida so'rovlarga ajratadi — kartezian portlashning oldini oladi.
                npg.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            })
        // Kesh invalidatsiya interceptor'i — har SaveChanges'dan keyin o'zgargan entity turlari
        // versiyasini oshiradi (DataCache), bog'liq keshni avtomatik eskirtiradi.
        .AddInterceptors(sp.GetRequiredService<CacheInvalidationInterceptor>()));

// Application qatlamidagi xizmatlar konkret AppDbContext o'rniga IAppDbContext'ga
// bog'lanadi — uni o'sha scoped AppDbContext instansiyasiga ulaymiz.
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

// Kam o'zgaradigan ma'lumotlar (meta, fan/o'qituvchi nomlari) uchun qisqa-TTL kesh.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ReferenceCache>();
// "Ma'lumot o'zgarganda avtomatik yangilanadigan" versiyali kesh + uni oshiruvchi interceptor.
// Ikkalasi ham Singleton (versiyalar butun ilova bo'ylab yagona; interceptor holatsiz).
builder.Services.AddSingleton<DataCache>();
builder.Services.AddSingleton<CacheInvalidationInterceptor>();

// DataProtection kalitlarini DOIMIY volume'ga saqlaymiz. Aks holda kalitlar konteyner ichida
// (/root/.aspnet) turadi va HAR deploy'da yo'qoladi — natijada eski tokenlar/shifrlangan
// ma'lumotlar yaroqsiz bo'lib qoladi. /app/keys docker volume'iga ulangan (qarang docker-compose).
var keysDir = builder.Configuration["DataProtection:KeysPath"] ?? "/app/keys";
try { Directory.CreateDirectory(keysDir); } catch { /* dev'da yo'l bo'lmasligi mumkin — e'tiborsiz */ }
if (Directory.Exists(keysDir))
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keysDir))
        .SetApplicationName("IntellectCRM");

// JWT sozlamalari. Imzo kaliti appsettings'da SAQLANMAYDI (repoga tushmasligi uchun) —
// uni `Jwt__Key` muhit o'zgaruvchisi yoki `dotnet user-secrets` orqali bering.
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwtOptions.Key) || jwtOptions.Key.Length < 32)
{
    if (builder.Environment.IsDevelopment())
    {
        // Dev'da kalit berilmasa — vaqtinchalik tasodifiy kalit (server restartida tokenlar bekor bo'ladi).
        jwtOptions.Key = Convert.ToBase64String(
            System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
        Console.WriteLine("[WARN] Jwt:Key berilmagan — DEV uchun vaqtinchalik tasodifiy kalit ishlatilmoqda. "
            + "Prod'da Jwt__Key muhit o'zgaruvchisini o'rnating.");
    }
    else
    {
        throw new InvalidOperationException(
            "Jwt:Key sozlanmagan yoki 32 belgidan qisqa. Uni `Jwt__Key` muhit o'zgaruvchisi "
            + "yoki user-secrets orqali bering (hech qachon appsettings.json'ga yozmang).");
    }
}
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<JwtTokenService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
        };

        // SignalR (WebSocket) token'ni Authorization header'da yubora olmaydi —
        // chat hub uchun tokenni query string'dan ("access_token") qabul qilamiz.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            },

            // Token bekor qilish (revocation): imzo/muddat to'g'ri bo'lsa ham, akkaunt holatini
            // HAR so'rovda tekshiramiz — arxivlangan o'qituvchi/o'quvchi yoki o'chirilgan xodim/admin
            // eski tokeni bilan KIRA OLMAYDI. Parent (telefon orqali bog'lanadi) tekshirilmaydi.
            OnTokenValidated = async context =>
            {
                var p = context.Principal;
                var userId = p?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                             ?? p?.FindFirst("sub")?.Value;
                if (p is null || string.IsNullOrEmpty(userId)) return;

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();

                bool blocked;
                if (p.IsInRole(Roles.Teacher))
                    blocked = !await db.Teachers.AnyAsync(t => t.UserId == userId && !t.IsArchived);
                else if (p.IsInRole(Roles.Student))
                    // Arxivlangan YOKI admin tomonidan login cheklangan o'quvchi eski tokeni bilan kira olmaydi.
                    blocked = !await db.Students.AnyAsync(s => s.UserId == userId && !s.IsArchived && !s.LoginBlocked);
                else if (p.IsInRole(Roles.Staff) || p.IsInRole(Roles.Admin) || p.IsInRole(Roles.SuperAdmin))
                {
                    var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId);
                    blocked = u is null;
                    // Xodim (staff) ruxsatlarini HAR so'rovda DB'dan claim sifatida qo'shamiz — tokenga
                    // yozilmaydi, shuning uchun superadmin ruxsatni o'zgartirsa darrov amal qiladi
                    // (qayta login shart emas). AdminPerm atributi shu claim'larni tekshiradi.
                    if (!blocked && p.IsInRole(Roles.Staff) && u!.Permissions is { Count: > 0 } perms
                        && p.Identity is ClaimsIdentity ident)
                        foreach (var perm in perms)
                            ident.AddClaim(new Claim(AdminPermAttribute.ClaimType, perm));
                }
                else
                    blocked = false; // parent / boshqa — tegmaymiz

                if (blocked) context.Fail("Akkaunt arxivlangan yoki o'chirilgan");
            },
        };
    });
builder.Services.AddAuthorization();

// Login endpoint uchun rate-limit — parol brute-force / credential-stuffing'ni sekinlashtiradi
// (IP bo'yicha daqiqada 10 urinish). Oshib ketsa 429 qaytadi.
// DIQQAT: Cloudflare tunnel ortida RemoteIpAddress BARCHA tashrifchilar uchun bitta (cloudflared
// konteyneri IP'si) — partitsiya shu bo'yicha bo'lsa limit hammaga UMUMIY bo'lib qoladi (bitta
// odam limitni tugatsa hamma 429 oladi). Shuning uchun haqiqiy IP CF-Connecting-IP (Cloudflare
// har doim qo'yadi) yoki X-Forwarded-For'dan olinadi; to'g'ridan ulanishda RemoteIpAddress.
static string ClientIp(HttpContext ctx)
{
    var cf = ctx.Request.Headers["CF-Connecting-IP"].ToString();
    if (!string.IsNullOrWhiteSpace(cf)) return cf.Trim();
    var xff = ctx.Request.Headers["X-Forwarded-For"].ToString();
    if (!string.IsNullOrWhiteSpace(xff)) return xff.Split(',')[0].Trim();
    return ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientIp(httpContext),
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    // Landing sahifasidagi "Bepul darsga yozilish" formasi — ochiq (auth'siz) endpoint,
    // spam/bot flood'ni sekinlashtiradi (IP bo'yicha daqiqada 5 ta so'rov).
    options.AddPolicy("public-lead", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientIp(httpContext),
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // GLOBAL (fallback) limiter — flood'ga qarshi himoya darvozasi (admission control). MUHIM: bir IP
    // ortida bir nechta xodim bo'lishi mumkin (markaz ofisi), shuning uchun AUTENTIFIKATSIYALANGAN
    // so'rov FOYDALANUVCHI bo'yicha (o'z bucketi — bir-birini bloklamaydi), anonim so'rov IP bo'yicha
    // partitsiyalanadi. Limit ATAYIN saxiy (daqiqada 600 ≈ 10/sek) — normal foydalanuvchi yetmaydi,
    // faqat qo'pol avtomatlashtirilgan flood 429 oladi. Endpoint-specific siyosatlar (login/public-lead)
    // buning ustiga qo'shimcha ishlaydi.
    options.GlobalLimiter = System.Threading.RateLimiting.PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var userId = ctx.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var key = !string.IsNullOrEmpty(userId) ? "u:" + userId : "ip:" + ClientIp(ctx);
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            key,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 600,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });
});

// Real-time guruh chati (SignalR)
builder.Services.AddSignalR();
builder.Services.AddScoped<ChatService>();

// Oylik to'lovlarni avtomatik hisoblovchi fon xizmati
builder.Services.AddHostedService<IntellectCRM.Application.Services.TuitionAccrualService>();
builder.Services.AddHostedService<IntellectCRM.Application.Services.TurnstileLiveService>();
// Avtomatik to'lov eslatmasi (qarzdorlarga Telegram + push, 09:00 Toshkent).
builder.Services.AddHostedService<IntellectCRM.Application.Services.PaymentReminderService>();
// O'qituvchiga davomat kiritish eslatmasi (dars boshlanishidan N daqiqa keyin, push + Telegram).
builder.Services.AddHostedService<IntellectCRM.Application.Services.LessonAttendanceReminderService>();
// Erkin eslatma (admin belgilagan matn+auditoriya+jadval, push + Telegram).
builder.Services.AddHostedService<IntellectCRM.Application.Services.CustomReminderService>();
// Tug'ilgan kun avto-SMS (09:00 Toshkent; "birthday" hodisasiga andoza bo'lsa).
builder.Services.AddHostedService<IntellectCRM.Application.Services.BirthdaySmsService>();
// Sinov darsi eslatmasi (09:00 Toshkent; ertaga bo'ladigan sinovlar; "trial_reminder" andoza bo'lsa).
builder.Services.AddHostedService<IntellectCRM.Application.Services.TrialReminderService>();
// Kunlik avtomatik backup — markaz ma'lumotlarini JSON qilib Telegram orqali adminga (jadval CenterMeta'da).
builder.Services.AddHostedService<IntellectCRM.Application.Services.BackupSchedulerService>();
builder.Services.AddHostedService<IntellectCRM.Application.Services.StaffTaskDispatchService>();
// Kunlik markaz AI tahlili (ertalab ~8:00 Toshkent; Gemini kaliti + AiDailyAnalysisEnabled bo'lsa).
builder.Services.AddHostedService<IntellectCRM.Application.Services.CenterAiSchedulerService>();

// Telegram bot (e'lon yuborish + ota-onalarni kontakt orqali ro'yxatga olish).
// Token appsettings "Telegram:BotToken" da; bo'sh bo'lsa bot ishga tushmaydi.
builder.Services.AddHttpClient();
builder.Services.AddSingleton<TelegramService>();
builder.Services.AddHostedService<TelegramBotService>();
// FCM (Firebase push) — service account CenterMeta'da; token keshi uchun singleton.
builder.Services.AddSingleton<FcmService>();
// Eskiz.uz SMS — login/parol CenterMeta'da; token keshi uchun singleton.
builder.Services.AddSingleton<EskizService>();
// YAGONA avto-xabar dispatcheri (SMS+Push+Telegram) — Eskiz/Fcm/Telegram singletonlariga tayanadi.
builder.Services.AddSingleton<AutoMessageService>();
// MoiZvonki (bulutli telefoniya — operator telefoni orqali) — YAGONA telefoniya provayderi.
// REST mijoz + webhook avto-obuna. Sozlanmagan bo'lsa Call Center moduli o'chiq (CallsController.Provider).
builder.Services.AddSingleton<MoiZvonkiService>();
builder.Services.AddHostedService<MoiZvonkiSetupService>();
// Qo'ng'iroqlar TARIXI sinxroni (calls.list) — webhook'siz ham tarix to'ladi; singleton
// sifatida ham ro'yxatda (controller qo'lda "Yangilash"da SyncOnceAsync'ni chaqiradi).
builder.Services.AddSingleton<MoiZvonkiCallSyncService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MoiZvonkiCallSyncService>());

// CTI (Local Call) — Android agent WebSocket ulanishlarini boshqaruvchi (jonli onlayn + dial buyruq).
builder.Services.AddSingleton<CtiConnectionManager>();
// Local SMS — agent telefonining SIM-kartasidan (send_sms) — Eskiz'ga muqobil provider sifatida
// MessagesController/AutoMessageService/CtiController tomonidan ishlatiladi.
builder.Services.AddSingleton<CtiSmsService>();

// O'zgarishlar tarixi (audit) — joriy foydalanuvchini aniqlash uchun HttpContext kerak
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IntellectCRM.Application.Services.AuditService>();

// Shartnoma andozasini (Word) to'ldirish xizmati
builder.Services.AddScoped<IntellectCRM.Application.Services.ContractService>();

// Sertifikat tizimi (HTML yaratish, hash, tekshirish)
builder.Services.AddScoped<IntellectCRM.Application.Services.CertificateService>();

// Turniket/FaceID integratsiyasi — o'qituvchilar davomatini avtomatik yuklash
builder.Services.AddScoped<IntellectCRM.Application.Services.TurnstileService>();

// Xona vaqt konflikti aniqlash (guruh yaratish/tahrirlashda warning)
builder.Services.AddScoped<IntellectCRM.Application.Services.RoomConflictService>();

// Xona bandlik va samaradorlik metrikalari
builder.Services.AddScoped<IntellectCRM.Application.Services.RoomUtilizationService>();

// Kamera (videokuzatuv) media-shlyuzi (MediaMTX) bilan ishlash
builder.Services.AddHttpClient<IntellectCRM.Application.Services.CameraGateway>();

// Javoblarni siqish (Brotli + Gzip). Level.Fastest — TTFB ga ortiqcha CPU yuk qo'ymaydi.
// Eslatma: Cloudflare orqasida bo'lsa, CF chetda allaqachon siqadi — bu origin uchun foydali.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// OutputCache — faqat OCHIQ (auth talab qilmaydigan) endpointlar uchun ([OutputCache] qo'yilganlar).
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("public-tenant", b => b.Expire(TimeSpan.FromSeconds(30)));
});

builder.Services.AddControllers();

var app = builder.Build();

// ---------- Bazani yaratish va seed ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Migration startup retry — baza init bo'lgunga qadar kutadi (1GB server sekin bo'lishi mumkin)
    var maxRetries = 10;
    for (var attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            db.Database.Migrate();
            app.Logger.LogInformation("[migration] muvaffaqiyatli (urinish {Attempt}/{Max})", attempt, maxRetries);
            break;
        }
        catch (Exception ex) when (attempt < maxRetries)
        {
            app.Logger.LogWarning(ex,
                "[migration] urinish {Attempt}/{Max} muvaffaqiyatsiz — {Seconds}s kutishdan keyin qayta",
                attempt, maxRetries, attempt * 3);
            await Task.Delay(TimeSpan.FromSeconds(attempt * 3));
        }
    }

    // SELF-HEAL: eski "support" rolli akkauntlar role="teacher" bo'lishi kerak (support sahifasi
    // teacher portalida IsSupport bo'yicha ko'rinadi). "support" rol bilan ular /teacher portaliga
    // kira olmasdi — bir martalik idempotent tuzatish.
    try
    {
        var movedSupport = await db.Users.Where(u => u.Role == "support")
            .ExecuteUpdateAsync(up => up.SetProperty(u => u.Role, Roles.Teacher));
        if (movedSupport > 0)
            app.Logger.LogInformation("[fix] {N} ta 'support' rolli akkaunt 'teacher'ga ko'chirildi", movedSupport);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "[fix] support→teacher rol ko'chirish o'tkazib yuborildi");
    }

    // Birinchi ishga tushish: hech qanday foydalanuvchi bo'lmasa, standart SUPER ADMIN yaratamiz —
    // aks holda tizimga kira oladigan hech kim bo'lmaydi. Login/parol muhit o'zgaruvchisidan keladi
    // (Seed__OwnerLogin / Seed__OwnerPassword). Parol berilmasa — tasodifiy generatsiya qilinadi va
    // loglarga yoziladi. Diqqat: `Email` maydoni aslida USERNAME (login), email emas.
    if (!db.Users.Any())
    {
        var login = app.Configuration["Seed:OwnerLogin"];
        if (string.IsNullOrWhiteSpace(login)) login = "admin";
        var pwd = app.Configuration["Seed:OwnerPassword"];
        // Parol .env'da berilmaganda — tasodifiy generatsiya (faqat shu holatda logga yoziladi,
        // aks holda kira oladigan hech kim bo'lmaydi). Berilgan parol HECH QACHON logga yozilmaydi.
        var generated = string.IsNullOrWhiteSpace(pwd);
        if (generated) pwd = AccountFactory.GeneratePassword(10);
        var owner = new AppUser
        {
            FullName = "Super Admin",
            Role = Roles.SuperAdmin,
            Email = login,
            PasswordHash = PasswordHasher.Hash(pwd),
            InitialPassword = pwd,   // birinchi login'gacha ko'rinadi (AuthController tozalaydi)
        };
        db.Users.Add(owner);
        db.SaveChanges();
        if (generated)
            app.Logger.LogWarning(
                "[seed] Super admin yaratildi — login: '{Login}', parol: '{Password}' "
                + "(OWNER_PASSWORD berilmagani uchun generatsiya qilindi — ko'chirib oling va kirgach o'zgartiring).",
                login, pwd);
        else
            app.Logger.LogInformation(
                "[seed] Super admin yaratildi — login: '{Login}' (parol .env'dagi OWNER_PASSWORD — logga yozilmadi).",
                login);
    }

    // Amal sabablari (muzlatish/o'chirish/sinovga qaytarish/lid/guruh) — standart sabablar bilan
    // to'ldiriladi (admin keyin Sabablar bo'limida o'zgartiradi). PER-KATEGORIYA idempotent: jadval
    // prod'da allaqachon to'ldirilgan bo'lsa ham, faqat hozir BO'SH kategoriyalar seed qilinadi
    // (yangi kategoriyalar restartda qo'shiladi, mavjudlari takrorlanmaydi).
    {
        var defaults = new (string Cat, string[] Labels)[]
        {
            ("freeze", new[] { "Sog'liq sababli", "Ta'til / sayohat", "Moliyaviy qiyinchilik", "Vaqtincha tanaffus" }),
            ("return_trial", new[] { "Qayta sinov so'radi", "To'lov muammosi", "Darajani qayta tekshirish" }),
            ("remove_active", new[] { "Boshqa markazga o'tdi", "Ko'chib ketdi", "Darslardan voz kechdi", "Moliyaviy sabab" }),
            ("remove_trial", new[] { "Sinovdan keyin qoldirmadi", "Qiziqmadi", "Narx mos kelmadi" }),
            ("remove_frozen", new[] { "Uzoq vaqt qaytmadi", "Boshqa markazga o'tdi", "Voz kechdi" }),
            ("lead_delete", new[] { "Aloqaga chiqmadi", "Qiziqmadi", "Noto'g'ri raqam", "Takror / spam" }),
            ("group_delete", new[] { "O'quvchi yetarli emas", "O'qituvchi ketdi", "Kurs tugadi", "Guruhlar birlashtirildi" }),
            ("student_delete", new[] { "Boshqa markazga o'tdi", "Ko'chib ketdi", "Xato kiritilgan", "Voz kechdi" }),
            ("teacher_delete", new[] { "Ishdan bo'shadi", "Boshqa joyga o'tdi", "Xato kiritilgan" }),
            ("staff_delete", new[] { "Ishdan bo'shadi", "Xato kiritilgan" }),
            ("finance_delete", new[] { "Xato kiritilgan", "Takroriy to'lov", "Bekor qilindi", "Qaytarib berildi" }),
        };
        var existingCats = db.ActionReasons.Select(r => r.Category).Distinct().ToHashSet();
        var seeded = false;
        foreach (var (cat, labels) in defaults)
        {
            if (existingCats.Contains(cat)) continue;
            for (var i = 0; i < labels.Length; i++)
                db.ActionReasons.Add(new ActionReason { Category = cat, Label = labels[i], Order = i });
            seeded = true;
        }
        if (seeded)
        {
            db.SaveChanges();
            app.Logger.LogInformation("[seed] Standart amal sabablari yaratildi");
        }
    }

    // Lid bosqichlari (kanban ustunlari) — standart voronka bilan to'ldiriladi. IDEMPOTENT: faqat
    // jadval BO'SH bo'lsa seed qilinadi (admin keyin nomlash/o'chirish/tartiblashni o'zgartiradi).
    // Bu MUHIM: bosqich yo'q paytda daraja testidan tushgan lid Stage="" bilan yaratilib, kanbanda
    // ko'rinmay qolardi (hech qaysi ustunga tushmaydi). Bosqich doim mavjud bo'lsa — to'g'ri tushadi.
    if (!db.LeadStages.Any())
    {
        var stages = new (string Title, string Color)[]
        {
            ("Yangi", "blue"),
            ("Bog'lanildi", "cyan"),
            ("Sinov darsi", "amber"),
            ("O'ylanmoqda", "violet"),
            ("Aylantirildi", "emerald"),
        };
        for (var i = 0; i < stages.Length; i++)
            db.LeadStages.Add(new LeadStage { Title = stages[i].Title, Color = stages[i].Color, Order = i });
        db.SaveChanges();
        app.Logger.LogInformation("[seed] Standart lid bosqichlari yaratildi");
    }

    // SMS andozalari SEED QILINMAYDI — "Xabar matnlari" kutubxonasi faqat FOYDALANUVCHI yaratgan
    // matnlarni (qo'lda "Yangi matn" + "Xabar yaratish" avto qoidalari) ko'rsatadi. Bo'sh boshlanadi.
    // (Eski ReminderRule/SmsTemplate.IsAuto ko'chirish seed'i ham olib tashlangan.)

    // YETIM LIDLARNI TUZATISH: bosqichi mavjud bo'lmagan (eski bo'sh "" yoki o'chirilgan ustunga
    // tegishli) lidlar kanbanda ko'rinmaydi — ularni birinchi (Order) bosqichga ko'chiramiz.
    // Har restartda arzon ishlaydi (faqat yetim bo'lsa yozadi) → prod'dagi mavjud yetimlarni tuzatadi.
    {
        var validStageIds = db.LeadStages.Select(s => s.Id).ToList();
        var firstStageId = db.LeadStages.OrderBy(s => s.Order).Select(s => s.Id).FirstOrDefault();
        if (firstStageId is not null)
        {
            var orphans = db.Leads.Where(l => !validStageIds.Contains(l.Stage)).ToList();
            if (orphans.Count > 0)
            {
                foreach (var l in orphans) l.Stage = firstStageId;
                db.SaveChanges();
                app.Logger.LogInformation(
                    "[repair] {Count} ta yetim lid (bosqichsiz) birinchi bosqichga ko'chirildi", orphans.Count);
            }
        }
    }

    // Xodim roli shablonlari — yangi xodim qo'shishda tanlash uchun standart rol/ruxsatlar.
    // PER-KOD IDEMPOTENT: yo'q shablon YARATILADI; mavjudiga seed'dagi YETISHMAGAN ruxsatlar
    // QO'SHILADI (union — shablonlar UI'dan tahrirlanmaydi, ular tizim-boshqaruvidagi ro'yxat;
    // yangi bo'lim ruxsati (masalan "calls") chiqsa, mavjud bazada ham avtomatik yangilanadi).
    // TRY-CATCH: jadval yo'q bo'lsa (migration qo'llanmagan) logga yozib o'tadi.
    try
    {
        var templates = new (string Code, string Name, string Desc, string[] Perms)[]
        {
            ("call_operator", "Qo'ng'iroq operatori",
                "Qo'ng'iroq qabul qiladi (Call Center), lidlarni yaratadi va boshqaradi",
                new[] { "calls", "leads", "messages" }),
            ("cashier", "Kassir",
                "To'lovlarni kiritadi va boshqaradi, o'quvchi ma'lumotlarini ko'radi",
                new[] { "students", "finance", "messages" }),
            ("administrator", "Administrator",
                "Asosiy boshqaruv — guruhlar, o'quvchilar, o'qituvchilar, o'quv bo'limi",
                new[] { "leads", "students", "teachers", "classes", "schedule", "messages", "app" }),
        };
        var existingTemplates = db.StaffRoleTemplates.ToList();
        var created = 0;
        var patched = 0;
        foreach (var (code, name, desc, perms) in templates)
        {
            var tpl = existingTemplates.FirstOrDefault(t => t.Code == code);
            if (tpl is null)
            {
                db.StaffRoleTemplates.Add(new StaffRoleTemplate
                {
                    Code = code,
                    Name = name,
                    Description = desc,
                    DefaultPermissions = new List<string>(perms),
                });
                created++;
                continue;
            }
            // Mavjud shablonga faqat YANGI ruxsatlar qo'shiladi (nom/izoh tegilmaydi).
            var missing = perms.Where(p => !tpl.DefaultPermissions.Contains(p)).ToList();
            if (missing.Count > 0)
            {
                tpl.DefaultPermissions.AddRange(missing);
                patched++;
            }
        }
        if (created + patched > 0)
        {
            db.SaveChanges();
            app.Logger.LogInformation(
                "[seed] Xodim roli shablonlari sinxronlandi: {Created} yangi, {Patched} ruxsati to'ldirilgan",
                created, patched);
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex,
            "[seed] StaffRoleTemplates seed failed (migration qo'llanmagan bo'lsa normal) — keyingi restartda qayta urinyadi");
    }

    // Telegram bot tokeni — restartdan keyin bot avtomatik ishga tushadi; token yo'q bo'lsa
    // admin Sozlamadan kiritguncha kutadi.

    // ---------- Integratsiya sozlamalarini .env (config) dan CenterMeta'ga qo'llash ----------
    // ENV-WINS: .env'da berilgan integratsiya qiymati DB'dagidan USTUN turadi (har deploy'da qo'llanadi) —
    // admin .env'da boshqaradi, UI'da "Saqlash" bosish shart emas. .env'da BO'SH qoldirilgan integratsiya
    // esa UI'dan boshqariladi (DB'da saqlanadi, deploy buzmaydi). Bo'sh qiymatlar e'tiborsiz qoldiriladi.
    try
    {
        var cfg = app.Configuration;
        var meta = db.CenterMeta.FirstOrDefault();
        var existed = meta is not null;
        meta ??= new CenterMeta();
        var changed = false;
        void S(string key, Action<string> set)
        { var v = cfg[key]; if (!string.IsNullOrWhiteSpace(v)) { set(v.Trim()); changed = true; } }
        void B(string key, Action<bool> set)
        { var v = cfg[key]; if (!string.IsNullOrWhiteSpace(v) && bool.TryParse(v.Trim(), out var b)) { set(b); changed = true; } }
        void I(string key, Action<int> set)
        { var v = cfg[key]; if (!string.IsNullOrWhiteSpace(v) && int.TryParse(v.Trim(), out var n)) { set(n); changed = true; } }

        // Telegram bot
        S("Telegram:BotToken", v => meta.TelegramBotToken = v);
        S("Telegram:BotUsername", v => meta.TelegramBotUsername = v.TrimStart('@'));
        S("Telegram:BotName", v => meta.TelegramBotName = v);
        S("Telegram:Channel", v => meta.TelegramChannel = v);
        S("Telegram:AdminChatId", v => meta.TelegramAdminChatId = v);
        // Firebase (push)
        S("Fcm:ServiceAccountJson", v => meta.FcmServiceAccountJson = v);
        // Gemini (AI tahlil) — model alohida GEMINI_MODEL env'dan o'qiladi
        S("Gemini:ApiKey", v => meta.GeminiApiKey = v);
        // Azure Speech
        S("Azure:SpeechKey", v => meta.AzureSpeechKey = v);
        S("Azure:SpeechRegion", v => meta.AzureSpeechRegion = v);
        // Eskiz SMS
        S("Eskiz:Email", v => meta.EskizEmail = v);
        S("Eskiz:Password", v => meta.EskizPassword = v);
        S("Eskiz:From", v => meta.EskizFrom = v);
        // Turniket / FaceID
        B("Turnstile:Enabled", v => meta.TurnstileEnabled = v);
        S("Turnstile:Vendor", v => meta.TurnstileVendor = v);
        S("Turnstile:Host", v => meta.TurnstileHost = v);
        I("Turnstile:Port", v => meta.TurnstilePort = v);
        S("Turnstile:Username", v => meta.TurnstileUsername = v);
        S("Turnstile:Password", v => meta.TurnstilePassword = v);
        // Kamera
        B("Camera:Enabled", v => meta.CameraEnabled = v);
        // Kunlik AI tahlil
        B("AiAnalysis:Enabled", v => meta.AiDailyAnalysisEnabled = v);
        I("AiAnalysis:Hour", v => meta.AiDailyAnalysisHour = v);
        // Telegram backup
        B("Backup:TelegramEnabled", v => meta.TelegramBackupEnabled = v);
        I("Backup:Hour", v => meta.BackupScheduleHour = v);
        I("Backup:Minute", v => meta.BackupScheduleMinute = v);

        if (changed)
        {
            if (!existed) db.CenterMeta.Add(meta);
            db.SaveChanges();
            app.Logger.LogInformation("[env] Integratsiya sozlamalari .env dan qo'llandi (env-wins)");
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "[env] Integratsiya sozlamalarini .env dan qo'llashda xatolik (migratsiya qo'llanmagan bo'lsa normal)");
    }
}

// ---------- Pipeline ----------

// Cloudflare Tunnel / reverse-proxy orqasida: haqiqiy mijoz IP'si (X-Forwarded-For) va
// HTTPS sxemasi (X-Forwarded-Proto) tiklanadi. Busiz login rate-limit hamma uchun bitta
// IP'ga (tunnel) tushib qoladi va HTTPS-redirect tsikli yuzaga kelishi mumkin.
// FAQAT prod'da yoqamiz (dev'da Vite proxy bu sarlavhalarni yubormaydi).
// MUHIM: konteyner portini internetga OCHMANG — unga faqat cloudflared kirsin.
if (!app.Environment.IsDevelopment())
{
    var fwd = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    };
    fwd.KnownNetworks.Clear();
    fwd.KnownProxies.Clear();
    app.UseForwardedHeaders(fwd);
}

// Javoblarni siqish — pipeline boshida (statik fayllar va API javoblari ham siqilsin).
app.UseResponseCompression();

// Xavfsizlik sarlavhalari — barcha javoblarga (statik fayllar va /uploads ham). MIME-sniffing,
// clickjacking va (prod'da) saqlangan XSS'ga qarshi himoya.
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    // /uploads fayllari (dars PDF va h.k.) SPA ichida iframe'da ko'rsatiladi —
    // faqat O'Z domenimizdan frame'lashga ruxsat, boshqa hamma javob DENY.
    var isUpload = context.Request.Path.StartsWithSegments("/uploads");
    headers["X-Content-Type-Options"] = "nosniff";
    headers["Referrer-Policy"] = "no-referrer";
    // CSP faqat prod'da — dev'da SPA Vite serverida alohida beriladi.
    if (!app.Environment.IsDevelopment() && isUpload)
    {
        headers["X-Frame-Options"] = "SAMEORIGIN";
        headers["Content-Security-Policy"] = "frame-ancestors 'self'";
    }
    else if (!app.Environment.IsDevelopment())
    {
        // CRM SPA — Telegram Mini App sifatida ham ochiladi: Telegram Web (web.telegram.org)
        // uni <iframe> ichida yuklaydi — avvalgi "frame-ancestors 'none'" buni bloklab, mijozda
        // "Oops, failed to load ..." xatosini chiqargan. Shu sabab Telegram domenlariga ham
        // frame'lashga ruxsat berilgan. X-Frame-Options ATAYLAB QO'YILMAYDI — u bir nechta domenni
        // qo'llamaydi (faqat DENY/SAMEORIGIN), zamonaviy brauzerlar baribir CSP frame-ancestors'ni
        // ustun qo'yadi; XFO: DENY qoldirilsa ba'zi mijozlarda CSP'ga qaramay bloklashi mumkin edi.
        headers["Content-Security-Policy"] =
            "default-src 'self'; " +
            "img-src 'self' data: blob: https:; " +
            // blob: — Call Center yozuv pleyeri (audio auth bilan blob qilib ochiladi) va
            // shunga o'xshash media; busiz prod'da <audio src="blob:..."> JIM bloklanadi.
            "media-src 'self' blob:; " +
            "style-src 'self' 'unsafe-inline'; " +
            // gstatic — FCM web SW (firebase-messaging-sw.js) importScripts qiladi.
            // telegram.org — bot Menu Button orqali Web App sifatida ochilganda kerak bo'ladigan SDK.
            "script-src 'self' https://www.gstatic.com https://telegram.org; " +
            "worker-src 'self'; " +
            // googleapis/gstatic — FCM web token olish (getToken) so'rovlari.
            "connect-src 'self' ws: wss: https://*.googleapis.com https://*.gstatic.com https://fcm.googleapis.com; " +
            "font-src 'self' data:; " +
            "frame-ancestors 'self' https://web.telegram.org https://*.web.telegram.org; object-src 'none'; base-uri 'self'";
    }
    else
    {
        headers["X-Frame-Options"] = "DENY";
    }
    await next();
});

if (!app.Environment.IsDevelopment())
    app.UseHsts();

// DIQQAT: UseDefaultFiles ATAYLAB ishlatilmaydi — `/` ni o'zimiz SPA fallback'da beramiz.
// SPA statik fayllari: Vite assetlari kontent-hash bilan (immutable, 1 yil); index.html — no-cache.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        var path = ctx.Context.Request.Path.Value ?? "";
        // Faqat Vite kontent-hashli assetlar (/assets/...) abadiy keshlanadi (nomi har build'da
        // o'zgaradi). Qolganlari — html, favicon (nomi o'zgarmaydi) — no-cache, aks holda
        // yangilanishlar brauzer/Cloudflare keshida ko'rinmay qoladi.
        if (path.Contains("/assets/", StringComparison.OrdinalIgnoreCase))
            headers.CacheControl = "public,max-age=31536000,immutable";
        else
            headers.CacheControl = "no-cache";
    },
});

// Yuklangan materiallar (/uploads) — alohida papkadan. Kesh PRIVATE: maxfiy hujjatlar (passport/tug'ilganlik
// guvohnomasi/shartnoma skanlari) Cloudflare/proxy/umumiy keshda SAQLANMASIN — faqat brauzerning o'z keshi
// (URL tasodifiy GUID + no-referrer bilan birga). (Auth-gating katta frontend refactor talab qiladi — kelajak.)
var uploadsDir = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "private,max-age=3600",
});

// Swagger ATAYLAB o'chirilgan (global) — butun API yuzasini ochib qo'ymaslik uchun
// `/api/swagger` UI/JSON endpointlari berilmaydi.

// CTI (Local Call) — Android agent WebSocket. UseWebSockets HTTPS-redirect'dan OLDIN: upgrade so'rovi
// redirect qilinmasin. /ws terminal branch — SPA fallback'ga tushmaydi. Auth QO'LDA (query ?token=)
// tekshiriladi (SignalR access_token uslubiga o'xshash), chunki brauzer/ilova WS'da header yubora olmaydi.
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.Map("/ws", wsApp => wsApp.Run(async ctx =>
{
    if (!ctx.WebSockets.IsWebSocketRequest)
    {
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var token = ctx.Request.Query["token"].ToString();
    var (valid, agentId) = ValidateAgentToken(token, jwtOptions);
    if (!valid)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }

    var manager = ctx.RequestServices.GetRequiredService<CtiConnectionManager>();
    var scopeFactory = ctx.RequestServices.GetRequiredService<IServiceScopeFactory>();
    var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("CtiWebSocket");
    var lifetime = ctx.RequestServices.GetRequiredService<IHostApplicationLifetime>();

    using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
    await CtiWebSocketHandler.HandleAsync(socket, agentId!, manager, scopeFactory, logger, lifetime.ApplicationStopping);
}));

// CTI WS token tekshiruvi: imzo/muddat/issuer/audience + rol == ctiagent. (agentId, valid) qaytaradi.
static (bool Valid, string? AgentId) ValidateAgentToken(string token, JwtOptions o)
{
    if (string.IsNullOrWhiteSpace(token)) return (false, null);
    try
    {
        var handler = new JwtSecurityTokenHandler();
        var principal = handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = o.Issuer,
            ValidAudience = o.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Key)),
        }, out _);
        if (!principal.IsInRole(Roles.CtiAgent)) return (false, null);
        var agentId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return string.IsNullOrEmpty(agentId) ? (false, null) : (true, agentId);
    }
    catch { return (false, null); }
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
// OutputCache middleware — tayyor turadi, lekin [OutputCache] faqat ochiq endpointlarga qo'yiladi
// (multi-tenant xavfsizligi uchun; pastdagi izohga qarang). Auth'dan keyin turishi shart.
app.UseOutputCache();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<LiveHub>("/hubs/live");

// API "tirikligi": https://<domen>/api ochilganda SPA HTML emas, JSON qaytaradi.
app.MapGet("/api", () => Results.Ok(new
{
    name = "IntellectCRM API",
    status = "ok",
    environment = app.Environment.EnvironmentName,
    timeUtc = DateTime.UtcNow,
}));
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

// Noma'lum /api/* yo'llari — SPA HTML emas, 404 JSON qaytsin (mobil/klient uchun toza).
app.MapFallback("/api/{**slug}", () => Results.NotFound(new { message = "API endpoint topilmadi" }));

// SPA fallback: barcha hostlar (intellectschool.uz, crm.intellectschool.uz, ...) → React SPA
// (index.html). SPA'ga kirilganda React `RootRedirect` autentifikatsiyasiz foydalanuvchini `/login`ga yuboradi.
// ISTISNO: apex domen (Tenancy:RootDomain va www.<RootDomain>) uchun — agar statik `landing.html` mavjud
// bo'lsa — o'sha qaytariladi (marketing sahifasi, CRM emas). `/landing` yo'li istalgan hostda ham
// (masalan crm.* ustida ham) preview/tekshirish uchun to'g'ridan-to'g'ri landing.html'ga yo'naltiradi.
var webRoot = app.Environment.WebRootPath
    ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var rootDomain = (builder.Configuration["Tenancy:RootDomain"] ?? "").Trim().ToLowerInvariant();

app.MapGet("/landing", async ctx =>
{
    var landingFile = Path.Combine(webRoot, "landing.html");
    if (!File.Exists(landingFile)) { ctx.Response.StatusCode = StatusCodes.Status404NotFound; return; }
    ctx.Response.ContentType = "text/html; charset=utf-8";
    // no-cache: telefon brauzerlari yangilangan sahifani darhol olsin (sahifa kichik, kesh shart emas).
    ctx.Response.Headers.CacheControl = "no-cache";
    await ctx.Response.SendFileAsync(landingFile);
});

app.MapFallback(async ctx =>
{
    var host = ctx.Request.Host.Host.ToLowerInvariant(); // portsiz
    var isApexHost = rootDomain.Length > 0 && (host == rootDomain || host == $"www.{rootDomain}");
    var landingFile = Path.Combine(webRoot, "landing.html");

    // Maxfiylik siyosati (/privacy) — apex domenda ham landing.html EMAS, React SPA sahifasi
    // ko'rsatilsin (Google Play talab qiladigan ochiq sahifa istalgan hostda ishlashi uchun).
    var path = ctx.Request.Path.Value?.ToLowerInvariant() ?? "";
    var isPrivacy = path.StartsWith("/privacy");

    if (isApexHost && !isPrivacy && File.Exists(landingFile))
    {
        ctx.Response.ContentType = "text/html; charset=utf-8";
        // no-cache: telefon brauzerlari yangilangan sahifani darhol olsin (sahifa kichik, kesh shart emas).
        ctx.Response.Headers.CacheControl = "no-cache";
        await ctx.Response.SendFileAsync(landingFile);
        return;
    }

    var file = Path.Combine(webRoot, "index.html");
    if (!File.Exists(file)) { ctx.Response.StatusCode = StatusCodes.Status404NotFound; return; }
    ctx.Response.ContentType = "text/html; charset=utf-8";
    ctx.Response.Headers.CacheControl = "no-cache";
    await ctx.Response.SendFileAsync(file);
});

app.Run();
