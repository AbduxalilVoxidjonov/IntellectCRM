using IntellectCRM.Application.Services;
using Xunit;

namespace IntellectCRM.Tests;

/// <summary>
/// `.env` KALITI KONTEYNERGA YETIB BORADIMI — drift qulfi.
///
/// <para><b>Real hodisa (2026-08-14):</b> Instagram moduli qo'shildi, `AppSecrets.EnvKeys` ga
/// `INSTAGRAM_APP_SECRET` va `INSTAGRAM_VERIFY_TOKEN` yozildi, `.env.example` ga ham tushdi —
/// lekin `docker-compose.yml` dagi `app` servisiga uzatilmadi. Prod'da `app` servisida
/// <c>env_file</c> YO'Q (faqat aniq `environment:` ro'yxati), ya'ni `.env` dagi qator compose
/// o'zgaruvchisi sifatida O'QILADI, lekin konteynerga UZATILMAYDI.</para>
///
/// <para>Natija foydalanuvchi uchun ko'rinmas edi: admin `.env` ga to'g'ri qiymatni yozadi,
/// `docker compose up -d` qiladi, lekin `AppSecrets.InstagramVerifyToken` baribir bo'sh qoladi
/// va webhook FAIL-CLOSED bo'lib Meta tasdig'ini 403 bilan rad etadi. Xato sozlamada emas,
/// compose faylida edi — buni topish uchun uch qatlamni (env → compose → AppSecrets) qo'lda
/// solishtirish kerak bo'ldi.</para>
///
/// <para>Shu sabab qoida test bilan qulflanadi: <b>`EnvKeys` ga qo'shilgan HAR bir kalit
/// `docker-compose.yml` da ham, `.env.example` da ham bo'lishi SHART.</b></para>
/// </summary>
public class EnvKeysWiringTests
{
    /// <summary>Repo ildizi — test bin papkasidan yuqoriga chiqib topiladi.</summary>
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "docker-compose.yml")))
            dir = dir.Parent;

        Assert.True(dir is not null, "docker-compose.yml topilmadi (repo ildizi aniqlanmadi).");
        return dir!.FullName;
    }

    /// <summary>`AppSecrets.EnvKeys` dagi barcha konstanta qiymatlari.</summary>
    public static TheoryData<string> AllKeys()
    {
        var data = new TheoryData<string>();
        foreach (var f in typeof(AppSecrets.EnvKeys).GetFields())
            if (f.IsLiteral && f.GetRawConstantValue() is string v)
                data.Add(v);
        return data;
    }

    /// <summary>
    /// Kalit prod compose'ida `app` servisiga uzatiladimi. Qidiruv `${KALIT` bo'yicha —
    /// `"${KALIT:-}"` ham, `"${KALIT}"` ham mos keladi.
    /// </summary>
    [Theory]
    [MemberData(nameof(AllKeys))]
    public void Prod_compose_kalitni_uzatadi(string key)
    {
        var compose = File.ReadAllText(Path.Combine(RepoRoot(), "docker-compose.yml"));

        Assert.True(compose.Contains("${" + key, StringComparison.Ordinal),
            $"`{key}` docker-compose.yml da YO'Q — .env ga yozilgan qiymat konteynerga yetib "
            + "bormaydi va modul jimgina sozlanmagan bo'lib qoladi. `app` servisining "
            + "`environment:` ro'yxatiga qo'shing (masalan `Bolim__Kalit: \"${" + key + ":-}\"`).");
    }

    /// <summary>
    /// Kalit `.env.example` da hujjatlangan bo'lishi shart — admin qaysi qatorni qo'shishini
    /// shu fayldan ko'radi (Sozlamalar sahifasi ham `EnvKeys` nomlarini ko'rsatadi).
    /// </summary>
    [Theory]
    [MemberData(nameof(AllKeys))]
    public void Env_example_kalitni_hujjatlaydi(string key)
    {
        var example = File.ReadAllText(Path.Combine(RepoRoot(), ".env.example"));

        Assert.True(example.Contains(key + "=", StringComparison.Ordinal),
            $"`{key}` .env.example da YO'Q — admin bu kalit borligini bilmaydi.");
    }
}
