using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

/// <summary>
/// Admin-bo'lim controlleri uchun ruxsat darvozasi (xodim/staff/cheklangan admin rollari uchun).
/// <list type="bullet">
///   <item><b>superadmin</b> — to'liq kirish, har doim (ruxsat tekshirilmaydi).</item>
///   <item><b>admin</b> — DEFAULT to'liq kirish (cheklov yo'q, eski xatti-harakat). Superadmin
///     "Xodimlar va rollar → Adminlar" orqali unga aniq ruxsat ro'yxati BERSA (kamida bitta
///     "perm" claim paydo bo'lsa) — o'sha nuqtadan boshlab <b>staff bilan bir xil qoidada</b>
///     cheklanadi (pastga qarang). Ruxsat ro'yxati bo'sh qilib qaytarilsa — yana cheklovsiz bo'ladi.</item>
///   <item><b>staff</b> (yoki cheklangan <b>admin</b>) — <b>O'QISH</b> (GET/HEAD) har doim ochiq:
///     bir bo'lim sahifasi boshqa bo'lim ma'lumotini o'qishi (masalan Moliya → o'quvchilar ro'yxati)
///     buzilmasligi uchun. "Ko'rish" (bo'lim ko'rinishi) FRONTEND'da (nav + RequirePerm) boshqariladi.
///     <b>YOZISH</b> esa AMAL bo'yicha ajratiladi: POST→<c>create</c> (qo'shish), PUT/PATCH→<c>edit</c>
///     (tahrir), DELETE→<c>delete</c> (o'chirish). Ruxsat tokeni ikki xil bo'ladi: yalang
///     <c>"section"</c> = TO'LIQ (barcha amallar, eski/backward-compat) yoki <c>"section:action"</c>
///     = faqat shu amal.</item>
///   <item>Boshqa rollar (teacher/student/parent) — taqiqlanadi.</item>
/// </list>
/// Ruxsat claim'lari tokenga yozilmaydi — ular HAR so'rovda DB'dan (Program.cs OnTokenValidated)
/// yuklanadi. Shuning uchun superadmin xodim/admin ruxsatini o'zgartirsa, u qayta login qilmasdan
/// darrov yangi ruxsat bilan ishlaydi.
/// </summary>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public sealed class AdminPermAttribute(string perm) : Attribute, IAuthorizationFilter
{
    /// <summary>Staff/cheklangan-admin ruxsatlari shu turdagi claim sifatida principal'ga qo'shiladi.</summary>
    public const string ClaimType = "perm";

    private readonly string _perm = perm;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true) { context.Result = new UnauthorizedResult(); return; }

        // Tizim egasi — har doim cheklovsiz.
        if (user.IsInRole(Roles.SuperAdmin)) return;

        // Admin — superadmin unga aniq ruxsat claim'lari BERMAGAN bo'lsa (default) to'liq kirish.
        // Claim'lar mavjud bo'lsa — pastdagi staff bilan bir xil qoida bo'yicha cheklanadi.
        if (user.IsInRole(Roles.Admin) && !user.Claims.Any(c => c.Type == ClaimType)) return;

        // Faqat xodim (staff) yoki cheklangan admin shu darvozadan o'tishi mumkin; qolganlari — rad.
        if (!user.IsInRole(Roles.Staff) && !user.IsInRole(Roles.Admin)) { context.Result = new ForbidResult(); return; }

        // O'qish har doim ochiq (bo'limlararo bog'liqliklar uchun); "ko'rish" frontend'da boshqariladi.
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method)) return;

        // Yozish amali → kerakli ruxsat harakati.
        var action = HttpMethods.IsPost(method) ? "create"
                   : HttpMethods.IsDelete(method) ? "delete"
                   : "edit"; // PUT / PATCH va boshqalar

        // Ruxsat: yalang "section" (TO'LIQ) YOKI aniq "section:action".
        bool Has(string value) => user.Claims.Any(c => c.Type == ClaimType && c.Value == value);
        if (!Has(_perm) && !Has(_perm + ":" + action)) context.Result = new ForbidResult();
    }
}
