using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IntellectCRM.Infrastructure.Data;
using IntellectCRM.Domain;

namespace IntellectCRM.Server.Controllers;

[ApiController]
public class LandingCmsController(AppDbContext db) : ControllerBase
{
    // ==================== OMMAVIY ENDPOINT ====================

    /// <summary>Landing sahifasi uchun barcha faol ma'lumotlar (O'qituvchilar, Sertifikatlar, Fikrlar, FAQ).</summary>
    [HttpGet("api/public/landing-data")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicLandingData()
    {
        var teachers = await db.LandingTeachers
            .Where(t => t.IsActive)
            .OrderBy(t => t.Order)
            .ToListAsync();

        var certificates = await db.LandingCertificates
            .Where(c => c.IsActive)
            .OrderBy(c => c.Order)
            .ToListAsync();

        var testimonials = await db.LandingTestimonials
            .Where(t => t.IsActive)
            .OrderBy(t => t.Order)
            .ToListAsync();

        var faqs = await db.LandingFaqs
            .Where(f => f.IsActive)
            .OrderBy(f => f.Order)
            .ToListAsync();

        // Agar ma'lumotlar hali kiritilmagan bo'lsa (boshlang'ich holat), sukut bo'yicha ma'lumotlarni qaytaradi
        if (teachers.Count == 0)
        {
            teachers = GetDefaultTeachers();
        }

        if (certificates.Count == 0)
        {
            certificates = GetDefaultCertificates();
        }

        if (faqs.Count == 0)
        {
            faqs = GetDefaultFaqs();
        }

        await EnsureColumnsAsync();
        var meta = await db.CenterMeta.OrderBy(m => m.Id).FirstOrDefaultAsync();
        var mapUrl = string.IsNullOrWhiteSpace(meta?.MapIframeUrl)
            ? "https://www.openstreetmap.org/export/embed.html?bbox=70.9200,40.5400,70.9400,40.5520&layer=mapnik&marker=40.546115,70.930010"
            : meta.MapIframeUrl.Trim();

        var socials = new
        {
            telegramUrl = NormalizeUrl(meta?.TelegramUrl, "https://t.me/intellect_kokand"),
            instagramUrl = NormalizeUrl(meta?.InstagramUrl, "https://instagram.com/intellect_kokand"),
            youtubeUrl = NormalizeUrl(meta?.YoutubeUrl, "https://youtube.com"),
            facebookUrl = NormalizeUrl(meta?.FacebookUrl, "https://facebook.com"),
            centerEmail = string.IsNullOrWhiteSpace(meta?.CenterEmail) ? "info@intellect.uz" : meta.CenterEmail,
            appStoreUrl = NormalizeUrl(meta?.AppStoreUrl, string.Empty),
            playMarketUrl = NormalizeUrl(meta?.PlayMarketUrl, string.Empty),
            contactPhone = string.IsNullOrWhiteSpace(meta?.ContactPhone) ? "+998 (90) 344-44-34" : meta.ContactPhone,
            centerAddress = string.IsNullOrWhiteSpace(meta?.CenterAddress) ? "Farg'ona viloyati, Qo'qon shahar, Asqarali charxiy 5A" : meta.CenterAddress,
            workingHours = string.IsNullOrWhiteSpace(meta?.WorkingHours) ? "Dushanba — Shanba: 09:00 – 17:00" : meta.WorkingHours
        };

        return Ok(new
        {
            teachers,
            certificates,
            testimonials,
            faqs,
            mapUrl,
            socials
        });
    }

    // ==================== ADMIN MAP & SOCIALS ENDPOINTS ====================

    [HttpGet("api/admin/landing/socials")]
    [Authorize]
    public async Task<IActionResult> GetSocials()
    {
        await EnsureColumnsAsync();
        var meta = await db.CenterMeta.OrderBy(m => m.Id).FirstOrDefaultAsync();
        return Ok(new
        {
            telegramUrl = NormalizeUrl(meta?.TelegramUrl, "https://t.me/intellect_kokand"),
            instagramUrl = NormalizeUrl(meta?.InstagramUrl, "https://instagram.com/intellect_kokand"),
            youtubeUrl = NormalizeUrl(meta?.YoutubeUrl, "https://youtube.com"),
            facebookUrl = NormalizeUrl(meta?.FacebookUrl, "https://facebook.com"),
            centerEmail = string.IsNullOrWhiteSpace(meta?.CenterEmail) ? "info@intellect.uz" : meta.CenterEmail,
            appStoreUrl = NormalizeUrl(meta?.AppStoreUrl, string.Empty),
            playMarketUrl = NormalizeUrl(meta?.PlayMarketUrl, string.Empty),
            contactPhone = string.IsNullOrWhiteSpace(meta?.ContactPhone) ? "+998 (90) 344-44-34" : meta.ContactPhone,
            centerAddress = string.IsNullOrWhiteSpace(meta?.CenterAddress) ? "Farg'ona viloyati, Qo'qon shahar, Asqarali charxiy 5A" : meta.CenterAddress,
            workingHours = string.IsNullOrWhiteSpace(meta?.WorkingHours) ? "Dushanba — Shanba: 09:00 – 17:00" : meta.WorkingHours
        });
    }

    public class SocialsInput
    {
        public string? TelegramUrl { get; set; }
        public string? InstagramUrl { get; set; }
        public string? YoutubeUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? CenterEmail { get; set; }
        public string? AppStoreUrl { get; set; }
        public string? PlayMarketUrl { get; set; }
        public string? ContactPhone { get; set; }
        public string? CenterAddress { get; set; }
        public string? WorkingHours { get; set; }
    }

    private static string NormalizeUrl(string? url, string fallback = "")
    {
        if (string.IsNullOrWhiteSpace(url)) return fallback;
        var trimmed = url.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }
        return "https://" + trimmed;
    }

    [HttpPost("api/admin/landing/socials")]
    [Authorize]
    public async Task<IActionResult> UpdateSocials([FromBody] SocialsInput? input)
    {
        await EnsureColumnsAsync();
        var allMetas = await db.CenterMeta.ToListAsync();
        if (allMetas.Count == 0)
        {
            var newMeta = new CenterMeta();
            db.CenterMeta.Add(newMeta);
            allMetas.Add(newMeta);
        }

        foreach (var meta in allMetas)
        {
            meta.TelegramUrl = NormalizeUrl(input?.TelegramUrl, "https://t.me/intellect_kokand");
            meta.InstagramUrl = NormalizeUrl(input?.InstagramUrl, "https://instagram.com/intellect_kokand");
            meta.YoutubeUrl = NormalizeUrl(input?.YoutubeUrl, "https://youtube.com");
            meta.FacebookUrl = NormalizeUrl(input?.FacebookUrl, "https://facebook.com");
            meta.CenterEmail = string.IsNullOrWhiteSpace(input?.CenterEmail) ? "info@intellect.uz" : input.CenterEmail.Trim();
            meta.AppStoreUrl = NormalizeUrl(input?.AppStoreUrl, string.Empty);
            meta.PlayMarketUrl = NormalizeUrl(input?.PlayMarketUrl, string.Empty);
            meta.ContactPhone = string.IsNullOrWhiteSpace(input?.ContactPhone) ? "+998 (90) 344-44-34" : input.ContactPhone.Trim();
            meta.CenterAddress = string.IsNullOrWhiteSpace(input?.CenterAddress) ? "Farg'ona viloyati, Qo'qon shahar, Asqarali charxiy 5A" : input.CenterAddress.Trim();
            meta.WorkingHours = string.IsNullOrWhiteSpace(input?.WorkingHours) ? "Dushanba — Shanba: 09:00 – 17:00" : input.WorkingHours.Trim();
        }

        await db.SaveChangesAsync();
        var updated = allMetas.First();
        return Ok(new { ok = true, socials = new {
            telegramUrl = updated.TelegramUrl,
            instagramUrl = updated.InstagramUrl,
            youtubeUrl = updated.YoutubeUrl,
            facebookUrl = updated.FacebookUrl,
            centerEmail = updated.CenterEmail,
            appStoreUrl = updated.AppStoreUrl,
            playMarketUrl = updated.PlayMarketUrl,
            contactPhone = updated.ContactPhone,
            centerAddress = updated.CenterAddress,
            workingHours = updated.WorkingHours
        } });
    }

    [HttpGet("api/admin/landing/map-url")]
    [Authorize]
    public async Task<IActionResult> GetMapUrl()
    {
        await EnsureColumnsAsync();
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        var mapUrl = string.IsNullOrWhiteSpace(meta?.MapIframeUrl)
            ? "https://www.openstreetmap.org/export/embed.html?bbox=70.9200,40.5400,70.9400,40.5520&layer=mapnik&marker=40.546115,70.930010"
            : meta.MapIframeUrl.Trim();

        return Ok(new { mapUrl });
    }

    public class MapUrlInput
    {
        public string MapUrl { get; set; } = string.Empty;
    }

    private async Task EnsureColumnsAsync()
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""MapIframeUrl"" text DEFAULT '';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""TelegramUrl"" text DEFAULT 'https://t.me/intellect_kokand';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""InstagramUrl"" text DEFAULT 'https://instagram.com/intellect_kokand';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""YoutubeUrl"" text DEFAULT 'https://youtube.com';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""FacebookUrl"" text DEFAULT 'https://facebook.com';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""CenterEmail"" text DEFAULT 'info@intellect.uz';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""AppStoreUrl"" text DEFAULT '';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""PlayMarketUrl"" text DEFAULT '';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""ContactPhone"" text DEFAULT '+998 (90) 344-44-34';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""CenterAddress"" text DEFAULT 'Farg''ona viloyati, Qo''qon shahar, Asqarali charxiy 5A';
                ALTER TABLE ""CenterMeta"" ADD COLUMN IF NOT EXISTS ""WorkingHours"" text DEFAULT 'Dushanba — Shanba: 09:00 – 17:00';
            ");
        }
        catch { }
    }

    [HttpPost("api/admin/landing/map-url")]
    [Authorize]
    public async Task<IActionResult> UpdateMapUrl([FromBody] MapUrlInput? input)
    {
        await EnsureColumnsAsync();
        var meta = await db.CenterMeta.FirstOrDefaultAsync();
        if (meta == null)
        {
            meta = new CenterMeta();
            db.CenterMeta.Add(meta);
        }
        meta.MapIframeUrl = string.IsNullOrWhiteSpace(input?.MapUrl)
            ? "https://www.openstreetmap.org/export/embed.html?bbox=70.9200,40.5400,70.9400,40.5520&layer=mapnik&marker=40.546115,70.930010"
            : input.MapUrl.Trim();
        await db.SaveChangesAsync();
        return Ok(new { ok = true, mapUrl = meta.MapIframeUrl });
    }

    // ==================== ADMIN ENDPOINTS ====================

    // --- O'QITUVCHILAR (TEACHERS) ---

    [HttpGet("api/admin/landing/teachers")]
    [Authorize]
    public async Task<IActionResult> GetTeachers()
    {
        var list = await db.LandingTeachers.OrderBy(t => t.Order).ToListAsync();
        return Ok(list);
    }

    public record TeacherDto(
        string FullName,
        string Subject,
        string PhotoUrl,
        string Badge,
        string ShortBio,
        string FullBio,
        int Order,
        bool IsActive
    );

    [HttpPost("api/admin/landing/teachers")]
    [Authorize]
    public async Task<IActionResult> CreateTeacher([FromBody] TeacherDto dto)
    {
        var teacher = new LandingTeacher
        {
            FullName = dto.FullName.Trim(),
            Subject = dto.Subject.Trim(),
            PhotoUrl = dto.PhotoUrl.Trim(),
            Badge = dto.Badge.Trim(),
            ShortBio = dto.ShortBio.Trim(),
            FullBio = dto.FullBio.Trim(),
            Order = dto.Order,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.LandingTeachers.Add(teacher);
        await db.SaveChangesAsync();
        return Ok(teacher);
    }

    [HttpPut("api/admin/landing/teachers/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateTeacher(string id, [FromBody] TeacherDto dto)
    {
        var teacher = await db.LandingTeachers.FindAsync(id);
        if (teacher == null) return NotFound();

        teacher.FullName = dto.FullName.Trim();
        teacher.Subject = dto.Subject.Trim();
        teacher.PhotoUrl = dto.PhotoUrl.Trim();
        teacher.Badge = dto.Badge.Trim();
        teacher.ShortBio = dto.ShortBio.Trim();
        teacher.FullBio = dto.FullBio.Trim();
        teacher.Order = dto.Order;
        teacher.IsActive = dto.IsActive;

        await db.SaveChangesAsync();
        return Ok(teacher);
    }

    [HttpDelete("api/admin/landing/teachers/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteTeacher(string id)
    {
        var teacher = await db.LandingTeachers.FindAsync(id);
        if (teacher == null) return NotFound();
        db.LandingTeachers.Remove(teacher);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // --- SERTIFIKATLAR (CERTIFICATES) ---

    [HttpGet("api/admin/landing/certificates")]
    [Authorize]
    public async Task<IActionResult> GetCertificates()
    {
        var list = await db.LandingCertificates.OrderBy(c => c.Order).ToListAsync();
        return Ok(list);
    }

    public record CertificateDto(
        string Title,
        string StudentName,
        string ImageUrl,
        string Category,
        string CertType,
        string OverallScore,
        string Listening,
        string Reading,
        string Writing,
        string Speaking,
        string ResultNote,
        int Order,
        bool IsActive
    );

    [HttpPost("api/admin/landing/certificates")]
    [Authorize]
    public async Task<IActionResult> CreateCertificate([FromBody] CertificateDto dto)
    {
        var item = new LandingCertificate
        {
            Title = (dto.Title ?? "").Trim(),
            StudentName = (dto.StudentName ?? "").Trim(),
            ImageUrl = (dto.ImageUrl ?? "").Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Xalqaro" : dto.Category.Trim(),
            CertType = string.IsNullOrWhiteSpace(dto.CertType) ? "IELTS" : dto.CertType.Trim(),
            OverallScore = (dto.OverallScore ?? "").Trim(),
            Listening = (dto.Listening ?? "").Trim(),
            Reading = (dto.Reading ?? "").Trim(),
            Writing = (dto.Writing ?? "").Trim(),
            Speaking = (dto.Speaking ?? "").Trim(),
            ResultNote = (dto.ResultNote ?? "").Trim(),
            Order = dto.Order,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.LandingCertificates.Add(item);
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("api/admin/landing/certificates/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateCertificate(string id, [FromBody] CertificateDto dto)
    {
        var item = await db.LandingCertificates.FindAsync(id);
        if (item == null) return NotFound();

        item.Title = (dto.Title ?? "").Trim();
        item.StudentName = (dto.StudentName ?? "").Trim();
        item.ImageUrl = (dto.ImageUrl ?? "").Trim();
        item.Category = string.IsNullOrWhiteSpace(dto.Category) ? "Xalqaro" : dto.Category.Trim();
        item.CertType = string.IsNullOrWhiteSpace(dto.CertType) ? "IELTS" : dto.CertType.Trim();
        item.OverallScore = (dto.OverallScore ?? "").Trim();
        item.Listening = (dto.Listening ?? "").Trim();
        item.Reading = (dto.Reading ?? "").Trim();
        item.Writing = (dto.Writing ?? "").Trim();
        item.Speaking = (dto.Speaking ?? "").Trim();
        item.ResultNote = (dto.ResultNote ?? "").Trim();
        item.Order = dto.Order;
        item.IsActive = dto.IsActive;

        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("api/admin/landing/certificates/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteCertificate(string id)
    {
        var item = await db.LandingCertificates.FindAsync(id);
        if (item == null) return NotFound();
        db.LandingCertificates.Remove(item);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // --- FIKRLAR (TESTIMONIALS) ---

    [HttpGet("api/admin/landing/testimonials")]
    [Authorize]
    public async Task<IActionResult> GetTestimonials()
    {
        var list = await db.LandingTestimonials.OrderBy(t => t.Order).ToListAsync();
        return Ok(list);
    }

    public record TestimonialDto(
        string AuthorName,
        string AuthorRole,
        string AvatarUrl,
        int Rating,
        string Comment,
        int Order,
        bool IsActive
    );

    [HttpPost("api/admin/landing/testimonials")]
    [Authorize]
    public async Task<IActionResult> CreateTestimonial([FromBody] TestimonialDto dto)
    {
        var item = new LandingTestimonial
        {
            AuthorName = dto.AuthorName.Trim(),
            AuthorRole = dto.AuthorRole.Trim(),
            AvatarUrl = dto.AvatarUrl.Trim(),
            Rating = dto.Rating,
            Comment = dto.Comment.Trim(),
            Order = dto.Order,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.LandingTestimonials.Add(item);
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("api/admin/landing/testimonials/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateTestimonial(string id, [FromBody] TestimonialDto dto)
    {
        var item = await db.LandingTestimonials.FindAsync(id);
        if (item == null) return NotFound();

        item.AuthorName = dto.AuthorName.Trim();
        item.AuthorRole = dto.AuthorRole.Trim();
        item.AvatarUrl = dto.AvatarUrl.Trim();
        item.Rating = dto.Rating;
        item.Comment = dto.Comment.Trim();
        item.Order = dto.Order;
        item.IsActive = dto.IsActive;

        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("api/admin/landing/testimonials/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteTestimonial(string id)
    {
        var item = await db.LandingTestimonials.FindAsync(id);
        if (item == null) return NotFound();
        db.LandingTestimonials.Remove(item);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // --- FAQ (KO'P BERILADIGAN SAVOLLAR) ---

    [HttpGet("api/admin/landing/faqs")]
    [Authorize]
    public async Task<IActionResult> GetFaqs()
    {
        var list = await db.LandingFaqs.OrderBy(f => f.Order).ToListAsync();
        return Ok(list);
    }

    public record FaqDto(
        string Question,
        string Answer,
        int Order,
        bool IsActive
    );

    [HttpPost("api/admin/landing/faqs")]
    [Authorize]
    public async Task<IActionResult> CreateFaq([FromBody] FaqDto dto)
    {
        var item = new LandingFaq
        {
            Question = dto.Question.Trim(),
            Answer = dto.Answer.Trim(),
            Order = dto.Order,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        db.LandingFaqs.Add(item);
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("api/admin/landing/faqs/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateFaq(string id, [FromBody] FaqDto dto)
    {
        var item = await db.LandingFaqs.FindAsync(id);
        if (item == null) return NotFound();

        item.Question = dto.Question.Trim();
        item.Answer = dto.Answer.Trim();
        item.Order = dto.Order;
        item.IsActive = dto.IsActive;

        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("api/admin/landing/faqs/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteFaq(string id)
    {
        var item = await db.LandingFaqs.FindAsync(id);
        if (item == null) return NotFound();
        db.LandingFaqs.Remove(item);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ==================== DEFAULT FALLBACK DATA ====================

    private static List<LandingTeacher> GetDefaultTeachers()
    {
        return new List<LandingTeacher>
        {
            new LandingTeacher
            {
                Id = "t1",
                FullName = "Muhabbatxon Ubaydullayeva",
                Subject = "Bosh Ingliz tili va IELTS Ustozisi",
                PhotoUrl = "img/teachers/teacher-1.jpg",
                Badge = "IELTS 8.5+",
                ShortBio = "CELTA sertifikati sohibasi. Oliy toifali pedagogik tajribaga ega bo'lib, 500+ o'quvchilari IELTS 7.0+ natijalarni qo'lga kiritgan.",
                FullBio = "Muhabbatxon Ubaydullayeva — 8 yildan ortiq tajribaga ega bo'lgan yetakchi IELTS mutaxassisi. U Cambridge CELTA xalqaro o'qituvchilik sertifikatiga ega. Darslar intensiv so'zlashuv (Speaking), akademik yozish (Writing) va eshitib tushunish ko'nikmalarini rivojlantirishga qaratilgan. Uning rahbarligida 500 dan ortiq o'quvchilar IELTS 7.0 va undan yuqori natijalarni qayd etgan.",
                Order = 1,
                IsActive = true
            },
            new LandingTeacher
            {
                Id = "t2",
                FullName = "Abdumutal Abdujabborov",
                Subject = "Matematika & SAT Eksperti",
                PhotoUrl = "img/teachers/teacher-2.jpg",
                Badge = "SAT 1500+",
                ShortBio = "Mantiqiy fikrlash hamda abituriyentlarni DTM va SAT Math imtihonlariga 100% natija bilan tayyorlovchi tajribali mutaxassis.",
                FullBio = "Abdumutal Abdujabborov — Matematika va SAT Math bo'yicha 10+ yillik tajribaga ega oliy toifali ustoz. Uning o'quvchilari xalqaro SAT imtihonida 1500+ ball toplagan hamda O'zbekistondagi yetakchi va xorijiy universitetlarga davlat granti asosida o'qishga kirgan.",
                Order = 2,
                IsActive = true
            },
            new LandingTeacher
            {
                Id = "t3",
                FullName = "Rustamjon Nuriddinov",
                Subject = "Fizika va Oliy Ta'lim Tayyorgarligi",
                PhotoUrl = "img/teachers/teacher-3.jpg",
                Badge = "Fizika Eksperti",
                ShortBio = "Chuqurlashtirilgan fizika metodikasi, amaliy va nazariy darslar o'tkazish bo'yicha ko'plab grant talabalari ustozi.",
                FullBio = "Rustamjon Nuriddinov — Fizika fanidan murakkab masalalarni sodda va tushunarli usulda o'rgatuvchi ekspert. DTM imtihonlari hamda fizika olimpiadalari g'oliblarini tayyorlagan.",
                Order = 3,
                IsActive = true
            },
            new LandingTeacher
            {
                Id = "t4",
                FullName = "Nurjaxon Abduazizova",
                Subject = "Ona tili va Adabiyot Mutaxassisi",
                PhotoUrl = "img/teachers/teacher-4.jpg",
                Badge = "Milliy Sertifikat A+",
                ShortBio = "Ona tili va adabiyot fanidan DTM testlari va Milliy Sertifikat A+ natijalariga yo'naltirilgan intensiv metodika muallifi.",
                FullBio = "Nurjaxon Abduazizova — Milliy sertifikat (A, A+) hamda DTM imtihonlarida maksimal natija kafolati bilan dars beruvchi tajribali pedagog.",
                Order = 4,
                IsActive = true
            }
        };
    }

    private static List<LandingFaq> GetDefaultFaqs()
    {
        return new List<LandingFaq>
        {
            new LandingFaq
            {
                Id = "f1",
                Question = "Sinov darsi bepulmi?",
                Answer = "Ha, barcha fanlar bo'yicha birinchi dars mutlaqo bepul. O'quvchi dars jarayoni va ustoz bilan tanishib ko'rgach qaror qabul qiladi.",
                Order = 1,
                IsActive = true
            },
            new LandingFaq
            {
                Id = "f2",
                Question = "Mobil ilova orqali nimalarni kuzatish mumkin?",
                Answer = "Ota-onalar va o'quvchilar kunlik davomat, jurnal baholari, oylik test natijalari, dars jadvali hamda oylik to'lovlar balansini real vaqt rejimida kuzatib boradilar.",
                Order = 2,
                IsActive = true
            },
            new LandingFaq
            {
                Id = "f3",
                Question = "Darslar necha kishi guruhda o'tiladi?",
                Answer = "Har bir guruhda maksimum 12-15 nafar o'quvchi ta'lim oladi. Bu har bir o'quvchiga individual e'tibor qaratish imkonini beradi.",
                Order = 3,
                IsActive = true
            }
        };
    }

    private static List<LandingCertificate> GetDefaultCertificates()
    {
        return new List<LandingCertificate>
        {
            new LandingCertificate
            {
                Id = "c1",
                Title = "IELTS 8.5",
                StudentName = "MUKHAMMADISA MAKHMUDOV",
                ImageUrl = "img/certificates/cert-1.jpg",
                Category = "Xalqaro",
                CertType = "IELTS",
                OverallScore = "8.5",
                Listening = "9.0",
                Reading = "8.5",
                Writing = "7.5",
                Speaking = "8.0",
                Order = 1,
                IsActive = true
            },
            new LandingCertificate
            {
                Id = "c2",
                Title = "IELTS 8.0",
                StudentName = "KRISTINA KHAFIZOVA",
                ImageUrl = "img/certificates/cert-2.jpg",
                Category = "Xalqaro",
                CertType = "IELTS",
                OverallScore = "8.0",
                Listening = "8.5",
                Reading = "8.0",
                Writing = "7.5",
                Speaking = "8.5",
                Order = 2,
                IsActive = true
            },
            new LandingCertificate
            {
                Id = "c3",
                Title = "SAT Math 800",
                StudentName = "ASADBEK RAHIMOV",
                ImageUrl = "img/certificates/cert-3.jpg",
                Category = "Milliy",
                CertType = "SAT",
                OverallScore = "1520",
                Listening = "800",
                Reading = "720",
                Order = 3,
                IsActive = true
            }
        };
    }
}
