using IntellectCRM.Application.Services;
using IntellectCRM.Domain;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// "BOG'LANISH KERAK" moduli qoidalari (<see cref="ContactService"/>) — bosqichlar, natijalar,
/// muddat va o'tish cheklovi. Butun navbat va hisobot shu kalitlarga tayanadi.
/// </summary>
public class ContactServiceTests
{
    // ==================== Bosqichlar ====================

    [Theory]
    [InlineData(ContactStatuses.New, true)]
    [InlineData(ContactStatuses.Callback, true)]
    [InlineData(ContactStatuses.Done, false)]
    [InlineData(ContactStatuses.Failed, false)]
    public void Ochiq_bosqichlar_faqat_new_va_callback(string status, bool expected)
        => Assert.Equal(expected, ContactService.IsOpen(status));

    [Fact]
    public void Notanish_bosqich_ochiq_hisoblanmaydi()
    {
        // Navbat "ochiq" ro'yxatiga kirmaydi — buzuq yozuv navbatni to'ldirib qo'ymasin.
        Assert.False(ContactService.IsOpen("allaqachon-yoq"));
        Assert.False(ContactService.IsOpen(null));
        Assert.False(ContactService.IsValidStatus("allaqachon-yoq"));
    }

    [Fact]
    public void Bosqich_yorligi_notanish_kalitda_kalitni_ozini_qaytaradi()
    {
        Assert.Equal("Hal bo'ldi", ContactService.StatusLabel(ContactStatuses.Done));
        // Yorliq topilmasa BO'SH emas, kalit qaytadi — tarixda "nima bo'lgani" ko'rinib tursin.
        Assert.Equal("yangi-bosqich", ContactService.StatusLabel("yangi-bosqich"));
    }

    // ==================== O'tish qoidasi ====================

    [Theory]
    [InlineData(ContactStatuses.Callback, true)]
    [InlineData(ContactStatuses.Done, true)]
    [InlineData(ContactStatuses.Failed, true)]
    // "new" ATAYIN taqiqlangan: bog'langandan keyin boshiga qaytish navbatni cheksiz aylantirardi
    // va hisobotda hech qanday bosqich ko'rinmasdi.
    [InlineData(ContactStatuses.New, false)]
    [InlineData("boshqa", false)]
    [InlineData(null, false)]
    public void Keyingi_bosqich_faqat_uchtadan_bolishi_mumkin(string? next, bool expected)
        => Assert.Equal(expected, ContactService.CanTransitionTo(next));

    // ==================== Natijalar ====================

    [Fact]
    public void BOGLANILDI_faqat_gaplashilgan_natijalarda_sanaladi()
    {
        // Kunlik hisobotdagi "nechta odam bilan bog'lanildi" AYNAN shu bo'yicha — ko'tarmagan
        // qo'ng'iroq urinish bo'ladi, lekin "bog'lanildi" EMAS.
        Assert.True(ContactService.Reached("answered"));
        Assert.True(ContactService.Reached("other"));
        Assert.False(ContactService.Reached("no_answer"));
        Assert.False(ContactService.Reached("busy"));
        Assert.False(ContactService.Reached("wrong_number"));
        // Noma'lum/bo'sh natija ham "bog'lanildi" deb sanalmaydi (hisobot shishib ketmasin).
        Assert.False(ContactService.Reached("allaqachon-yoq"));
        Assert.False(ContactService.Reached(null));
    }

    [Fact]
    public void Natija_kaliti_tekshiriladi()
    {
        Assert.True(ContactService.IsValidResult("no_answer"));
        Assert.False(ContactService.IsValidResult("koturmadi"));
        Assert.False(ContactService.IsValidResult(null));
    }

    // ==================== Muddat ====================

    [Theory]
    // Faqat "qayta qo'ng'iroq" bosqichida va sana BUGUNDAN OLDIN bo'lsa.
    [InlineData(ContactStatuses.Callback, "2026-08-04", "2026-08-05", true)]
    [InlineData(ContactStatuses.Callback, "2026-08-05", "2026-08-05", false)]   // bugun — hali o'tmagan
    [InlineData(ContactStatuses.Callback, "2026-08-06", "2026-08-05", false)]
    [InlineData(ContactStatuses.Callback, "", "2026-08-05", false)]             // sana yo'q
    [InlineData(ContactStatuses.New, "2026-08-01", "2026-08-05", false)]        // boshqa bosqich
    [InlineData(ContactStatuses.Done, "2026-08-01", "2026-08-05", false)]
    public void Muddati_otgan_faqat_qayta_qongiroqda_hisoblanadi(
        string status, string due, string today, bool expected)
        => Assert.Equal(expected, ContactService.IsOverdue(status, due, today));

    // ==================== Katalog butunligi ====================

    [Fact]
    public void Bosqich_va_natija_kalitlari_takrorlanmaydi()
    {
        Assert.Equal(ContactService.Statuses.Count,
            ContactService.Statuses.Select(s => s.Key).Distinct().Count());
        Assert.Equal(ContactService.Results.Count,
            ContactService.Results.Select(r => r.Key).Distinct().Count());
    }

    [Fact]
    public void Ochiq_bosqichlar_royxati_katalog_bilan_mos()
    {
        // `OpenStatuses` va `Statuses[].IsOpen` — ikkita joy, bir xil haqiqat bo'lishi SHART
        // (biri navbat so'rovida, ikkinchisi UI chiplarida ishlatiladi).
        var fromCatalog = ContactService.Statuses.Where(s => s.IsOpen).Select(s => s.Key).OrderBy(k => k);
        Assert.Equal(fromCatalog, ContactService.OpenStatuses.OrderBy(k => k));
    }

    [Fact]
    public void Entity_default_holati_navbatga_tushadi()
    {
        // Yangi talab hech narsa berilmasa ham NAVBATDA bo'lishi kerak — aks holda yaratilgan
        // talab hech kimga ko'rinmay yo'qolardi.
        Assert.True(ContactService.IsOpen(new ContactRequest().Status));
    }
}
