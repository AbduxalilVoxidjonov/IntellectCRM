using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// `/uploads` DARVOZASINING QOIDALARI (<see cref="UploadAccessRules"/>).
///
/// <para>Bu yerdagi xato ikki tomonga og'ishi mumkin: maxfiy fayl ochilib ketadi, yoki login
/// sahifasining logotipi yo'qoladi (foydalanuvchi tizimga kira olmay qoladi degani emas, lekin
/// ko'rinishi buziladi). Shuning uchun ikkala yo'nalish ham testlanadi.</para>
/// </summary>
public class UploadAccessRulesTests
{
    // ---------------------------------------------------------------- FileNameOf

    [Theory]
    [InlineData("/uploads/abc123.png", "abc123.png")]
    [InlineData("abc123.png", "abc123.png")]
    [InlineData("/uploads/certificates/cert-1.pdf", "cert-1.pdf")]
    public void FileNameOf_FaqatFaylNominiOladi(string kirish, string kutilgan)
    {
        Assert.Equal(kutilgan, UploadAccessRules.FileNameOf(kirish));
    }

    [Fact]
    public void FileNameOf_SOROVQATORINItashlaydi()
    {
        // Brauzer keshni yangilash uchun "?v=2" qo'shishi mumkin — nom o'zgarmasligi kerak.
        Assert.Equal("logo.png", UploadAccessRules.FileNameOf("/uploads/logo.png?v=2"));
        Assert.Equal("logo.png", UploadAccessRules.FileNameOf("/uploads/logo.png#top"));
    }

    [Fact]
    public void FileNameOf_BOSHqiymatlarda_BOSHqaytaradi()
    {
        Assert.Equal("", UploadAccessRules.FileNameOf(null));
        Assert.Equal("", UploadAccessRules.FileNameOf("   "));
        Assert.Equal("", UploadAccessRules.FileNameOf("/uploads/"));
    }

    // ---------------------------------------------------------------- IsPublicFile

    [Fact]
    public void LOGOTIP_ochiqQoladi()
    {
        // Logotip login sahifasida va PWA manifestida kerak — foydalanuvchi hali kirmagan.
        var ochiq = UploadAccessRules.PublicNamesFrom(["/uploads/logo-abc.png"]);

        Assert.True(UploadAccessRules.IsPublicFile("/uploads/logo-abc.png", ochiq));
    }

    [Fact]
    public void BOSHQAfayl_OCHIQEMAS()
    {
        var ochiq = UploadAccessRules.PublicNamesFrom(["/uploads/logo-abc.png"]);

        // O'quvchi surati, passport skani, shartnoma — hech biri ro'yxatda emas.
        Assert.False(UploadAccessRules.IsPublicFile("/uploads/surat-xyz.jpg", ochiq));
        Assert.False(UploadAccessRules.IsPublicFile("/uploads/passport-1.pdf", ochiq));
    }

    [Fact]
    public void OchiqRoyxatBOSHbolsa_HECHNARSAochilmaydi()
    {
        Assert.False(UploadAccessRules.IsPublicFile("/uploads/logo-abc.png", []));
        Assert.False(UploadAccessRules.IsPublicFile("/uploads/logo-abc.png", null));
    }

    [Fact]
    public void OchiqFayl_PAPKAdanQATIYNAZARnomBoyichaTopiladi()
    {
        // Bazada manzil "/uploads/x.png", so'rov esa boshqacha yozilgan bo'lishi mumkin —
        // solishtirish faqat FAYL NOMI bo'yicha (papka tekis).
        var ochiq = UploadAccessRules.PublicNamesFrom(["/uploads/logo-abc.png"]);

        Assert.True(UploadAccessRules.IsPublicFile("/uploads/logo-abc.PNG", ochiq));
    }

    [Fact]
    public void PublicNamesFrom_BOSHvaNULLqiymatlarniTASHLAYDI()
    {
        // Logotip qo'yilmagan markazda ro'yxat BO'SH bo'lishi kerak — aks holda bo'sh nom
        // hamma narsani ochib yuborishi mumkin edi.
        var ochiq = UploadAccessRules.PublicNamesFrom([null, "", "   ", "/uploads/logo.png"]);

        Assert.Single(ochiq);
        Assert.Contains("logo.png", ochiq);
        Assert.False(UploadAccessRules.IsPublicFile("/uploads/", ochiq));
    }
}
