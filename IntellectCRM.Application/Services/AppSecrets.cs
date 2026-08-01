using Microsoft.Extensions.Configuration;

namespace IntellectCRM.Application.Services;

/// <summary>
/// TIZIM KALITLARI (maxfiy qiymatlar) — YAGONA MANBA: <c>.env</c> / muhit o'zgaruvchilari.
///
/// <para><b>QOIDA:</b> API kaliti, token, parol va service-account JSON kabi maxfiy qiymatlar
/// BAZADA SAQLANMAYDI va UI'dan kiritilmaydi. Ilgari ular <c>CenterMeta</c> ustunlarida turardi —
/// bu ustunlar <c>RemoveSecretsFromDb</c> migratsiyasida O'CHIRILDI (baza dump'i/backup'i, audit
/// va SQL kirishi orqali kalit sizib chiqmasin). Yangi kalit qo'shilganda ham shu yerga qo'shiladi,
/// <c>CenterMeta</c>ga EMAS.</para>
///
/// <para>Har bir kalit IKKI xil nom bilan o'qiladi:
/// <list type="bullet">
///   <item><c>Telegram:BotToken</c> — docker-compose ichida <c>Telegram__BotToken</c> ko'rinishida
///     uzatiladi (prod'dagi asosiy yo'l);</item>
///   <item><c>TELEGRAM_BOT_TOKEN</c> — <c>.env</c> faylidagi xom nom (mahalliy <c>dotnet run</c>
///     yoki <c>env_file</c> bilan ishlaganda — <see cref="DotEnvFile"/> yuklaydi).</item>
/// </list>
/// Ikkalasi ham bo'lsa — birinchisi (aniq sozlangan) ustun.</para>
///
/// <para>Statik: <see cref="JournalService"/>, <see cref="CenterAiAnalysisService"/> kabi STATIK
/// xizmatlar ham kalitga muhtoj (AppClock bilan bir xil naqsh). <see cref="Init"/> Program.cs'da
/// bir marta chaqiriladi.</para>
/// </summary>
public static class AppSecrets
{
    private static IConfiguration? _config;

    /// <summary>Program.cs'da (boshqa hamma narsadan oldin) bir marta chaqiriladi.</summary>
    public static void Init(IConfiguration config) => _config = config;

    /// <summary>Konfiguratsiyadan qiymat: avval "Bo'lim:Kalit", so'ng xom .env nomi (ENV_NAME).</summary>
    private static string Read(string sectionKey, string envName)
    {
        var v = _config?[sectionKey];
        if (string.IsNullOrWhiteSpace(v)) v = _config?[envName];
        return (v ?? "").Trim();
    }

    /* ---------- Telegram bot ---------- */

    /// <summary>BotFather tokeni. Bo'sh — bot ishlamaydi (ilova baribir ishlaydi).</summary>
    public static string TelegramBotToken => Read("Telegram:BotToken", EnvKeys.TelegramBotToken);

    /* ---------- Karyera boti (Intellect Career — ALOHIDA bot) ---------- */

    /// <summary>Ishga qabul (vakansiya) botining BotFather tokeni. Asosiy botdan MUSTAQIL:
    /// bo'sh bo'lsa faqat karyera boti ishlamaydi, qolgan hamma narsa odatdagidek yuradi.</summary>
    public static string CareerBotToken => Read("Career:BotToken", EnvKeys.CareerBotToken);

    /* ---------- Push (Firebase / FCM) ---------- */

    /// <summary>Firebase service account JSON (to'liq, bir qatorda) — serverdan push yuborish uchun.
    /// Ichida <c>private_key</c> bor: eng maxfiy qiymatlardan biri.</summary>
    public static string FcmServiceAccountJson => Read("Fcm:ServiceAccountJson", EnvKeys.FcmServiceAccountJson);

    /* ---------- AI (Google Gemini) ---------- */

    public static string GeminiApiKey => Read("Gemini:ApiKey", EnvKeys.GeminiApiKey);

    /* ---------- Speaking / transkripsiya (Azure Cognitive Services) ---------- */

    public static string AzureSpeechKey => Read("Azure:SpeechKey", EnvKeys.AzureSpeechKey);
    /// <summary>Resurs hududi (maxfiy emas, lekin kalit bilan birga sozlanadi — yarmi UI'da,
    /// yarmi .env'da bo'lib qolmasin).</summary>
    public static string AzureSpeechRegion => Read("Azure:SpeechRegion", EnvKeys.AzureSpeechRegion);

    /* ---------- SMS (Eskiz.uz) ---------- */

    /// <summary>Eskiz kabinet login (email) — parol bilan birga hisob ma'lumoti.</summary>
    public static string EskizEmail => Read("Eskiz:Email", EnvKeys.EskizEmail);
    public static string EskizPassword => Read("Eskiz:Password", EnvKeys.EskizPassword);

    /* ---------- Turniket / FaceID qurilmasi ---------- */

    public static string TurnstileUsername => Read("Turnstile:Username", EnvKeys.TurnstileUsername);
    public static string TurnstilePassword => Read("Turnstile:Password", EnvKeys.TurnstilePassword);

    /* ---------- Holat (Sozlamalar sahifasi uchun) ---------- */

    public static bool TelegramConfigured => TelegramBotToken.Length > 0;
    public static bool CareerBotConfigured => CareerBotToken.Length > 0;
    public static bool GeminiConfigured => GeminiApiKey.Length > 0;
    public static bool AzureSpeechConfigured => AzureSpeechKey.Length > 0 && AzureSpeechRegion.Length > 0;
    public static bool EskizConfigured => EskizEmail.Length > 0 && EskizPassword.Length > 0;
    public static bool TurnstileCredentialsConfigured => TurnstileUsername.Length > 0 && TurnstilePassword.Length > 0;

    /// <summary>
    /// <c>.env</c> o'zgaruvchilari nomlari — Sozlamalar sahifasida adminga "qaysi qatorni qo'shish
    /// kerak" deb ko'rsatiladi va <see cref="DotEnvFile"/>/hujjatlar bilan bitta joyda turadi.
    /// </summary>
    public static class EnvKeys
    {
        public const string TelegramBotToken = "TELEGRAM_BOT_TOKEN";
        public const string CareerBotToken = "CAREER_BOT_TOKEN";
        public const string FcmServiceAccountJson = "FCM_SERVICE_ACCOUNT_JSON";
        public const string GeminiApiKey = "GEMINI_API_KEY";
        public const string AzureSpeechKey = "AZURE_SPEECH_KEY";
        public const string AzureSpeechRegion = "AZURE_SPEECH_REGION";
        public const string EskizEmail = "ESKIZ_EMAIL";
        public const string EskizPassword = "ESKIZ_PASSWORD";
        public const string TurnstileUsername = "TURNSTILE_USERNAME";
        public const string TurnstilePassword = "TURNSTILE_PASSWORD";
    }
}
