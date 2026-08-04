using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// XODIM RUXSATLARI — qoidaning o'zi (<see cref="PermissionRules"/>).
///
/// <para>Bu xavfsizlikning tayanch nuqtasi: shu yerda xato bo'lsa, tor ruxsatli xodim boshqa
/// bo'limning ma'lumotini (jumladan <c>/uploads</c> dagi hujjat manzillarini) ochib olishi mumkin.
/// Mantiq <c>AdminPermAttribute</c> dan ajratib olingan — test loyihasi Server qatlamiga
/// bog'lanmagani uchun.</para>
/// </summary>
public class PermissionRulesTests
{
    // ---------------------------------------------------------------- HasSection

    [Fact]
    public void HasSection_TOLIQruxsat_Beradi()
    {
        Assert.True(PermissionRules.HasSection(["students"], "students"));
    }

    [Fact]
    public void HasSection_BITTAamalRuxsati_HamYETADI()
    {
        // "Faqat qo'shish" ruxsati bor xodim ham bo'lim ma'lumotini o'qiy oladi.
        Assert.True(PermissionRules.HasSection(["students:create"], "students"));
        Assert.True(PermissionRules.HasSection(["students:delete"], "students"));
    }

    [Fact]
    public void HasSection_BoshqaBOLIM_BERMAYDI()
    {
        Assert.False(PermissionRules.HasSection(["finance", "books:create"], "students"));
    }

    [Fact]
    public void HasSection_NOMIOXSHASHbolim_ADASHTIRMAYDI()
    {
        // Eng nozik joy: oddiy "boshlanadi" solishtiruvi bo'lsa, "students-arxiv" ruxsati
        // "students" ni ochib yuborardi. Faqat tenglik yoki "students:" prefiksi hisoblanadi.
        Assert.False(PermissionRules.HasSection(["students-arxiv"], "students"));
        Assert.False(PermissionRules.HasSection(["students2:create"], "students"));
        Assert.False(PermissionRules.HasSection(["studentsx"], "students"));
    }

    [Fact]
    public void HasSection_BOSHrouyxatVaNULL_BERMAYDI()
    {
        Assert.False(PermissionRules.HasSection([], "students"));
        Assert.False(PermissionRules.HasSection(null, "students"));
        Assert.False(PermissionRules.HasSection(["students"], ""));
    }

    // ---------------------------------------------------------------- HasFullSection

    [Fact]
    public void HasFullSection_FAQATyalangBolimniQabulQiladi()
    {
        Assert.True(PermissionRules.HasFullSection(["students"], "students"));
        // Bitta amal ruxsati TO'LIQ emas — nozik amallar (parol eksporti) uchun muhim.
        Assert.False(PermissionRules.HasFullSection(["students:create"], "students"));
    }

    // ---------------------------------------------------------------- Yozish

    [Theory]
    [InlineData("POST", "create")]
    [InlineData("post", "create")]
    [InlineData("DELETE", "delete")]
    [InlineData("PUT", "edit")]
    [InlineData("PATCH", "edit")]
    public void ActionFor_HTTPamaliniRuxsatHarakatigaOgiradi(string method, string kutilgan)
    {
        Assert.Equal(kutilgan, PermissionRules.ActionFor(method));
    }

    [Fact]
    public void CanWrite_ANIQamalRuxsati_FAQATOZamaliniOchadi()
    {
        string[] faqatQoshish = ["students:create"];

        Assert.True(PermissionRules.CanWrite(faqatQoshish, "students", "POST"));
        // Qo'shish ruxsati o'chirishga yaramaydi.
        Assert.False(PermissionRules.CanWrite(faqatQoshish, "students", "DELETE"));
        Assert.False(PermissionRules.CanWrite(faqatQoshish, "students", "PUT"));
    }

    [Fact]
    public void CanWrite_TOLIQruxsat_BARCHAamalniOchadi()
    {
        string[] toliq = ["students"];

        Assert.True(PermissionRules.CanWrite(toliq, "students", "POST"));
        Assert.True(PermissionRules.CanWrite(toliq, "students", "PUT"));
        Assert.True(PermissionRules.CanWrite(toliq, "students", "DELETE"));
    }

    [Fact]
    public void CanWrite_RuxsatYOQ_YOZDIRMAYDI()
    {
        Assert.False(PermissionRules.CanWrite(["finance"], "students", "POST"));
        Assert.False(PermissionRules.CanWrite(null, "students", "POST"));
    }
}
