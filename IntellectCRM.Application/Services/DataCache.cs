using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using IntellectCRM.Application.Abstractions;

namespace IntellectCRM.Application.Services;

/// <summary>
/// "Ma'lumot o'zgarganda avtomatik yangilanadigan" kesh qatlami. Og'ir (butun jadvalni yuklaydigan)
/// hisob-kitoblar natijasini keshlaydi va bog'liq jadvallardan biri o'zgarganda keshni AVTOMATIK
/// eskirtiradi — TTL tugashini kutmasdan.
///
/// <para><b>Ishlash printsipi (versiyali kalit):</b> har bir entity turi ("guruh") uchun
/// <see cref="ConcurrentDictionary{TKey,TValue}"/> da butun son "versiya" saqlanadi. Kesh yozuvining
/// TO'LIQ kaliti = mantiqiy kalit + bog'liq turlar versiyalari. Bog'liq jadvalga yozuv qo'shilsa/
/// o'zgarsa/o'chsa (interceptor orqali) o'sha turning versiyasi +1 bo'ladi → to'liq kalit o'zgaradi →
/// <see cref="IMemoryCache"/> uchun bu YANGI kalit, ya'ni natija qayta hisoblanadi. Eski (endi hech kim
/// so'ramaydigan) yozuv o'z TTL'i bilan xotiradan o'zi chiqib ketadi. Bu yondashuv keshni "invalidatsiya"
/// qilish (aniq kalitlarni o'chirish) muammosini butunlay chetlab o'tadi — biror joyda o'zgargan
/// versiyaning ta'sirini keshning O'ZI hal qiladi.</para>
///
/// <para><b>Nima uchun scope:</b> bu xizmat Singleton (versiyalar butun ilova bo'ylab yagona bo'lishi
/// shart). Scoped <see cref="IAppDbContext"/> ni singleton ushlab qololmaydi (captive dependency), shuning
/// uchun yuklash paytida <see cref="IServiceScopeFactory"/> orqali vaqtinchalik scope ochiladi va DbContext
/// o'sha yerdan olinadi. Keshga faqat o'zgarmas natija (DTO/record) saqlanadi — EF entity EMAS.</para>
///
/// <para>TTL bu yerda faqat <b>xavfsizlik tarmog'i</b>: interceptor sezmaydigan o'zgarishlar (masalan
/// DB'ga to'g'ridan-to'g'ri SQL, tashqi jarayon) uchun kesh baribir vaqti-vaqti bilan yangilanadi.
/// Asosiy (tezkor) yangilanish versiya orqali bo'ladi.</para>
/// </summary>
public sealed class DataCache(IMemoryCache cache, IServiceScopeFactory scopeFactory)
{
    // Entity turi nomi (masalan nameof(JournalEntry)) → joriy versiya. Yozuv o'zgarganda +1.
    private readonly ConcurrentDictionary<string, long> _versions = new();

    /// <summary>Guruh (entity turi) joriy versiyasi. Hali ko'rilmagan bo'lsa 0 dan boshlanadi.</summary>
    public long Version(string group) => _versions.GetOrAdd(group, 0);

    /// <summary>Berilgan guruhlarning har birining versiyasini +1 qiladi — shu turga bog'liq barcha
    /// kesh yozuvlarining to'liq kaliti o'zgaradi va keyingi so'rovda qayta hisoblanadi.</summary>
    public void Bump(IEnumerable<string> groups)
    {
        foreach (var g in groups)
            _versions.AddOrUpdate(g, 1, (_, v) => v + 1);
    }

    /// <summary>
    /// Keshdan oladi yoki (yo'q bo'lsa) <paramref name="load"/> orqali hisoblab keshga qo'yadi.
    /// To'liq kalit = <paramref name="key"/> + bog'liq turlar (<paramref name="dependsOn"/>) versiyalari;
    /// shu turlardan biri o'zgarsa kalit o'zgaradi va natija qayta hisoblanadi.
    /// </summary>
    /// <param name="key">Mantiqiy kalit (masalan "rating:school" yoki "dashboard:2026-07-02").</param>
    /// <param name="dependsOn">Natija bog'liq entity turlari nomlari (nameof(...)).</param>
    /// <param name="ttl">Xavfsizlik tarmog'i muddati (versiyadan mustaqil ravishda ham eskiradi).</param>
    /// <param name="load">Og'ir hisob-kitob — ajratilgan scope'dagi DbContext beriladi.</param>
    public async Task<T> GetOrCreateAsync<T>(
        string key, string[] dependsOn, TimeSpan ttl, Func<IAppDbContext, Task<T>> load)
    {
        var fullKey = key + ":" + string.Join(".", dependsOn.Select(Version));
        return (await cache.GetOrCreateAsync(fullKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = ttl;
            // Singleton xizmat scoped DbContext'ni ushlab qolmasligi uchun alohida scope (ReferenceCache uslubi).
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            return await load(db);
        }))!;
    }
}
