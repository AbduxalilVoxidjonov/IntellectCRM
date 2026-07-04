using AsterNET.Manager;
using AsterNET.Manager.Action;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Asterisk AMI (Manager Interface) mijozi — Call Center moduli uchun YAGONA ulanish nuqtasi.
/// Hozircha: Originate (chiquvchi qo'ng'iroq). Keyingi bosqichda AMI eventlari (NewState/Hangup)
/// shu servis orqali SignalR'ga uzatiladi — controller'lar AsterNET turlariga tegmaydi, shunda
/// transport (AsterNET → boshqa kutubxona/xom TCP) almashsa faqat shu fayl o'zgaradi.
///
/// Sozlash (appsettings yoki env, masalan <c>Asterisk__Host</c>):
///   "Asterisk": { "Enabled", "Host", "Port"(5038), "Username", "Password",
///     "OperatorChannel" ("PJSIP/{ext}" — operator SIP kanali shabloni),
///     "OutboundContext" (dialplan konteksti, masalan "from-internal"),
///     "DefaultOperatorExtension" (so'rovda berilmasa), "CallerId" }
///
/// Oqim (click-to-call): Originate AVVAL operator kanalini chaqiradi ({ext}), operator ko'targach
/// Asterisk dialplan orqali (Context+Exten=raqam) GSM gateway'dan o'quvchiga tering.
/// </summary>
public class AsteriskService(IConfiguration config, ILogger<AsteriskService> logger)
{
    private ManagerConnection? _mc;
    private readonly SemaphoreSlim _lock = new(1, 1);

    /// <summary>AMI'dan kelgan, Call Center'ga tegishli hodisa.
    /// Kind: "var" (CRM_CALL_ID o'rnatildi, Value=callId) | "state" (Value=ChannelStateDesc:
    /// Ringing/Up/...) | "hangup" (Value=cause kodi).</summary>
    public record AmiCallEvent(string Kind, string UniqueId, string Value);

    /// <summary>Qo'ng'iroq hodisalari oqimi — <see cref="AsteriskCallMonitorService"/> tinglaydi.
    /// DIQQAT: AsterNET socket thread'ida chaqiriladi — handler tez bo'lishi shart (queue'ga yozish).</summary>
    public event Action<AmiCallEvent>? CallEvent;

    public bool Enabled => config.GetValue<bool>("Asterisk:Enabled");
    public string DefaultOperatorExtension => config["Asterisk:DefaultOperatorExtension"] ?? "";

    private string Host => config["Asterisk:Host"] ?? "";
    private int Port => config.GetValue<int?>("Asterisk:Port") ?? 5038;
    private string Username => config["Asterisk:Username"] ?? "";
    private string Password => config["Asterisk:Password"] ?? "";
    private string OperatorChannelTemplate => config["Asterisk:OperatorChannel"] ?? "PJSIP/{ext}";
    private string OutboundContext => config["Asterisk:OutboundContext"] ?? "from-internal";
    private string CallerId => config["Asterisk:CallerId"] ?? "";

    /// <summary>Sozlamalar to'liqmi (Enabled + Host + Username).</summary>
    public bool IsConfigured => Enabled && Host.Length > 0 && Username.Length > 0;

    /// <summary>
    /// Chiquvchi qo'ng'iroq: operator kanali ({ext}) chaqiriladi, ko'targach dialplan
    /// (Context, Exten=raqam) orqali tashqi raqamga ulanadi. CRM_CALL_ID o'zgaruvchisi
    /// kanalga yoziladi — keyingi bosqichda eventlarni Call yozuviga bog'lash uchun.
    /// </summary>
    public async Task<(bool Ok, string Message)> OriginateAsync(
        string phoneNumber, string operatorExtension, string crmCallId, CancellationToken ct = default)
    {
        if (!IsConfigured) return (false, "Asterisk sozlanmagan (Asterisk:Enabled/Host/Username)");

        try
        {
            // AsterNET API sinxron (socket) — thread pool'da bajaramiz.
            return await Task.Run(() =>
            {
                var mc = GetConnection();
                var action = new OriginateAction
                {
                    Channel = OperatorChannelTemplate.Replace("{ext}", operatorExtension),
                    Context = OutboundContext,
                    Exten = phoneNumber,
                    Priority = "1",
                    CallerId = string.IsNullOrWhiteSpace(CallerId) ? phoneNumber : CallerId,
                    Async = true,
                    Timeout = 30_000,
                };
                // Kanal o'zgaruvchisi — AMI eventlarini Call yozuviga bog'lash uchun (2-bosqich).
                action.SetVariable("CRM_CALL_ID", crmCallId);
                var resp = mc.SendAction(action, 10_000);
                var ok = resp is not null && !string.Equals(resp.Response, "Error", StringComparison.OrdinalIgnoreCase);
                return (ok, resp?.Message ?? (ok ? "Originate yuborildi" : "Javob kelmadi"));
            }, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Asterisk Originate xatosi ({Phone})", phoneNumber);
            DropConnection(); // keyingi urinishda qayta ulanish
            return (false, $"Asterisk bilan ulanish xatosi: {ex.Message}");
        }
    }

    /// <summary>
    /// Ulanishni oldindan o'rnatish/tiklash — event monitor har 30s chaqiradi.
    /// Muvaffaqiyat = true; sozlanmagan yoki ulanib bo'lmasa false (exception yutiladi, log'lanadi).
    /// </summary>
    public bool TryEnsureConnected()
    {
        if (!IsConfigured) return false;
        try
        {
            GetConnection();
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning("Asterisk AMI ulanib bo'lmadi ({Host}:{Port}): {Msg}", Host, Port, ex.Message);
            DropConnection();
            return false;
        }
    }

    /// <summary>Ulangan ManagerConnection (kerak bo'lsa login qiladi). Chaqiruvchi exception'ni ushlaydi.</summary>
    private ManagerConnection GetConnection()
    {
        _lock.Wait();
        try
        {
            if (_mc is { } existing && existing.IsConnected()) return existing;

            _mc?.Logoff();
            var mc = new ManagerConnection(Host, Port, Username, Password);
            WireEvents(mc);
            mc.Login(10_000);
            logger.LogInformation("Asterisk AMI ulanish o'rnatildi ({Host}:{Port})", Host, Port);
            _mc = mc;
            return mc;
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>
    /// AMI hodisalarini <see cref="CallEvent"/>ga uzatish. Har yangi ulanishda qayta bog'lanadi.
    /// VarSet juda seryog' — faqat CRM_CALL_ID filtrlangan holda o'tkaziladi (AMI user'ida
    /// read=call,dialplan bo'lishi kerak, aks holda VarSet kelmaydi).
    /// </summary>
    private void WireEvents(ManagerConnection mc)
    {
        mc.VarSet += (_, e) =>
        {
            if (string.Equals(e.Variable, "CRM_CALL_ID", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrEmpty(e.Value))
                CallEvent?.Invoke(new AmiCallEvent("var", e.UniqueId ?? "", e.Value));
        };
        mc.NewState += (_, e) =>
            CallEvent?.Invoke(new AmiCallEvent("state", e.UniqueId ?? "", e.ChannelStateDesc ?? ""));
        mc.Hangup += (_, e) =>
            CallEvent?.Invoke(new AmiCallEvent("hangup", e.UniqueId ?? "", e.Cause.ToString()));
    }

    private void DropConnection()
    {
        _lock.Wait();
        try
        {
            try { _mc?.Logoff(); } catch { /* uzilgan bo'lishi mumkin */ }
            _mc = null;
        }
        finally
        {
            _lock.Release();
        }
    }
}
