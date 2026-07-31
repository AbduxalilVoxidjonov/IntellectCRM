using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using IntellectCRM.Application.Dtos;
using IntellectCRM.Domain;
using System.Text.RegularExpressions;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Shartnoma Word (.docx) andozasini to'ldiradi: `@` bilan boshlanuvchi o'rinbosarlarni
/// (masalan <c>@fish</c>) berilgan qiymatlar bilan almashtiradi. Word matnni bir nechta "run"ga
/// bo'lib yozishi mumkinligi sababli almashtirish PARAGRAF darajasida bajariladi (run matnlari
/// birlashtiriladi, almashtiriladi, birinchi runga yoziladi). Noma'lum tokenlar o'z holicha qoladi.
/// </summary>
public class ContractService(IWebHostEnvironment env)
{
    private static readonly Regex TokenRx = new(@"@[A-Za-z_]+", RegexOptions.Compiled);

    /// <summary>Andoza faylini "/uploads/..." manzilidan o'qiydi (topilmasa null).</summary>
    public byte[]? ReadTemplate(string fileUrl)
    {
        var path = ResolveUpload(fileUrl);
        return path is null ? null : File.ReadAllBytes(path);
    }

    /// <summary>"/uploads/..." manzilini diskdagi yo'lga aylantiradi (fayl yo'q bo'lsa null).
    /// Manzildan FAQAT fayl nomi olinadi — papkadan chiqib ketish (path traversal) mumkin emas.</summary>
    public string? ResolveUpload(string? fileUrl)
    {
        var name = Path.GetFileName(fileUrl ?? "");
        if (string.IsNullOrEmpty(name)) return null;
        var path = Path.Combine(env.ContentRootPath, "uploads", name);
        return File.Exists(path) ? path : null;
    }

    /// <summary>Saqlangan hujjatni "/uploads" papkasiga tasodifiy nom bilan yozadi va URL qaytaradi.</summary>
    public async Task<string> SaveUploadAsync(byte[] bytes, string extension)
    {
        var dir = Path.Combine(env.ContentRootPath, "uploads");
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{extension}";
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
        return "/uploads/" + name;
    }

    /// <summary>Saqlangan shartnoma faylini o'chiradi (yo'q bo'lsa jim o'tadi).</summary>
    public void DeleteUpload(string? fileUrl)
    {
        var path = ResolveUpload(fileUrl);
        if (path is null) return;
        try { File.Delete(path); } catch { /* fayl band/yo'q — yozuvni o'chirishga to'sqinlik qilmaydi */ }
    }

    /// <summary>Fayl kengaytmasi bo'yicha MIME turi — imzolangan nusxa PDF bo'lmasligi ham mumkin
    /// (skaner rasm sifatida yuklashi mumkin), shuning uchun turni yo'ldan aniqlaymiz.</summary>
    public static string MimeOf(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "application/octet-stream",
    };

    /// <summary>Shartnoma yozuvini portal/admin uchun DTO'ga aylantiradi (admin, o'qituvchi va
    /// o'quvchi controller'lari bir xil ko'rinishdan foydalanadi).</summary>
    public static ContractDocDto ToDoc(Contract c) =>
        new(c.Id, c.Number,
            string.IsNullOrWhiteSpace(c.FileName) ? $"Shartnoma № {c.Number}" : c.FileName,
            c.Target, c.RecipientKey, c.RecipientName, c.TemplateName,
            c.SentAt.ToString("o"), c.PdfUrl, c.DocxUrl, c.SignedUrl,
            !string.IsNullOrEmpty(c.SignedUrl), c.Delivered, c.Status, c.Visible);

    /// <summary>Andoza baytlarini nusxalab, tokenlarni almashtiradi va yangi .docx baytlarini qaytaradi.</summary>
    public byte[] FillTemplate(byte[] docxBytes, IDictionary<string, string> tokens)
    {
        using var ms = new MemoryStream();
        ms.Write(docxBytes, 0, docxBytes.Length);
        ms.Position = 0;
        using (var doc = WordprocessingDocument.Open(ms, true))
        {
            var main = doc.MainDocumentPart;
            if (main?.Document is not null)
            {
                ReplaceIn(main.Document, tokens);
                foreach (var h in main.HeaderParts) ReplaceIn(h.Header, tokens);
                foreach (var f in main.FooterParts) ReplaceIn(f.Footer, tokens);
                main.Document.Save();
            }
        }
        return ms.ToArray();
    }

    /// <summary>Custom (matnli) andozadagi @-o'rinbosarlarni almashtirib TAYYOR MATN qaytaradi
    /// (PDF nusxasi shu matndan hosil qilinadi).</summary>
    public string FillText(string body, IDictionary<string, string> tokens) =>
        Apply(body ?? string.Empty, tokens);

    /// <summary>
    /// Custom (matnli) andozadan to'ldirilgan .docx hosil qiladi: matndagi `@`-o'rinbosarlar
    /// almashtiriladi, har bir satr alohida paragrafga aylanadi. Fayl yuklash shart emas.
    /// </summary>
    public byte[] BuildDocxFromText(string body, IDictionary<string, string> tokens)
    {
        var text = FillText(body, tokens);
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, DocumentFormat.OpenXml.WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            var docBody = new Body();
            foreach (var line in text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n'))
            {
                var run = new Run(new Text(line) { Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve });
                docBody.Append(new Paragraph(run));
            }
            main.Document = new Document(docBody);
            main.Document.Save();
        }
        return ms.ToArray();
    }

    private static void ReplaceIn(DocumentFormat.OpenXml.OpenXmlElement root, IDictionary<string, string> tokens)
    {
        foreach (var para in root.Descendants<Paragraph>())
        {
            var texts = para.Descendants<Text>().ToList();
            if (texts.Count == 0) continue;
            var combined = string.Concat(texts.Select(t => t.Text));
            if (!combined.Contains('@')) continue;
            var replaced = Apply(combined, tokens);
            if (replaced == combined) continue;
            texts[0].Text = replaced;
            texts[0].Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve;
            for (var i = 1; i < texts.Count; i++) texts[i].Text = "";
        }
    }

    private static string Apply(string input, IDictionary<string, string> tokens) =>
        TokenRx.Replace(input, m => tokens.TryGetValue(m.Value, out var v) ? v : m.Value);
}
