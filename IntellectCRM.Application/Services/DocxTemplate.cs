using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text.RegularExpressions;

namespace IntellectCRM.Application.Services;

/// <summary>
/// WORD (.docx) ANDOZASIGA QIYMAT QO'YISH — <c>@</c> bilan boshlanuvchi o'rinbosarlarni
/// (masalan <c>@fish</c>) berilgan qiymatlar bilan almashtiradi.
///
/// <para><b>Nega paragraf darajasida?</b> Word bitta so'zni ham bir nechta "run"ga bo'lib yozishi
/// mumkin (imlo tekshiruvi, formatlash, til belgisi) — u holda XML'da <c>@fi</c> va <c>sh</c>
/// alohida turadi va oddiy <c>Replace</c> topa olmaydi. Shuning uchun paragrafdagi barcha
/// <see cref="Text"/> larning matni BIRLASHTIRILADI, almashtiriladi va birinchi runga yoziladi,
/// qolganlari bo'shatiladi. Formatlash birinchi runniki bo'yicha qoladi.</para>
///
/// <para>Bu mantiq ilgari <c>ContractService</c> ichida edi; sertifikat andozalari ham AYNAN shu
/// sintaksisdan foydalanadi, shuning uchun bitta joyga ajratildi — ikki xil "token qoidasi"
/// paydo bo'lmasin.</para>
/// </summary>
public static class DocxTemplate
{
    /// <summary>Faqat harf va pastki chiziq — <c>@fish</c>, <c>@max_ball</c>. Raqam bilan
    /// tugaydigan token YO'Q (matndagi "@2024" kabi yozuvlar token deb o'qilmasin).</summary>
    private static readonly Regex TokenRx = new(@"@[A-Za-z_]+", RegexOptions.Compiled);

    /// <summary>
    /// Andoza baytlarini nusxalab tokenlarni almashtiradi va yangi .docx baytlarini qaytaradi.
    /// Asosiy hujjat, kolontitullar (header/footer) va jadval ichidagi paragraflar ham qamraladi.
    /// Noma'lum tokenlar O'Z HOLICHA qoladi (andoza muallifi xatosini ko'rsin).
    /// </summary>
    public static byte[] Fill(byte[] docxBytes, IDictionary<string, string> tokens)
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

    /// <summary>Matndagi <c>@</c>-tokenlarni almashtiradi (matnli andozalar uchun).</summary>
    public static string Apply(string? input, IDictionary<string, string> tokens) =>
        TokenRx.Replace(input ?? string.Empty, m => tokens.TryGetValue(m.Value, out var v) ? v : m.Value);

    /// <summary>Matnda ishlatilgan barcha <c>@</c>-tokenlar (andozani tekshirish uchun).</summary>
    public static IReadOnlyCollection<string> FindTokens(string? input) =>
        TokenRx.Matches(input ?? string.Empty).Select(m => m.Value).Distinct().ToList();

    // =============================================================================================
    //  RASM O'RNINI ALMASHTIRISH (o'quvchi surati)
    // =============================================================================================

    /// <summary>Rasm o'rni deb tanib olinadigan nomlar (Word'dagi "Alt Text" / rasm nomi).</summary>
    private static readonly string[] PhotoMarkers = ["rasm", "surat", "foto", "photo"];

    /// <summary>
    /// Andozadagi RASM O'RNINI o'quvchining surati bilan almashtiradi.
    ///
    /// <para><b>Nega matn tokeni emas?</b> <c>@rasm</c> kabi matn o'rniga rasm qo'yilsa, uning
    /// o'lchami va joylashuvini kod TAXMIN qilishi kerak bo'lardi. Buning o'rniga shablon muallifi
    /// Word'da rasm (istalgan surat — kulrang kvadrat, siluet) qo'yadi, o'lchami/ramkasi/matn bilan
    /// joylashuvini XOHLAGANCHA sozlaydi, biz esa faqat uning MAZMUNINI almashtiramiz. Natijada
    /// muallif ko'rgan ko'rinish aynan saqlanadi.</para>
    ///
    /// <para><b>Qaysi rasm tanlanadi?</b> Nomi/alt-matnida <c>rasm/surat/foto/photo</c> bo'lgani;
    /// bunday belgi yo'q bo'lsa va hujjatda BITTA rasm bo'lsa — o'sha. Aks holda (masalan logotip +
    /// rasm, ikkalasi ham belgilanmagan) hech narsa o'zgartirilmaydi — noto'g'ri rasmni buzib
    /// qo'ygandan ko'ra tegmagan yaxshi.</para>
    ///
    /// <para>Nisbat SAQLANADI: surat muallif ajratgan katak ICHIGA sig'diriladi (cho'zilmaydi),
    /// ya'ni joylashuv hech qachon buzilmaydi.</para>
    /// </summary>
    /// <param name="extension">Surat kengaytmasi (".jpg", ".png", ...). Qo'llab-quvvatlanmasa
    /// almashtirish O'TKAZIB YUBORILADI (andoza o'z holicha qoladi).</param>
    /// <returns>Yangi .docx baytlari (almashtirilmasa — kirish nusxasi).</returns>
    public static byte[] ReplaceImage(byte[] docxBytes, byte[] imageBytes, string extension)
    {
        var contentType = ContentTypeOf(extension);
        if (contentType is null || imageBytes.Length == 0) return docxBytes;

        using var ms = new MemoryStream();
        ms.Write(docxBytes, 0, docxBytes.Length);
        ms.Position = 0;
        using (var doc = WordprocessingDocument.Open(ms, true))
        {
            var main = doc.MainDocumentPart;
            if (main is not null)
            {
                // Asosiy hujjat, so'ng kolontitullar — birinchi mos kelgan joyda to'xtaymiz.
                var parts = new List<(OpenXmlPart Part, OpenXmlElement Root)>();
                if (main.Document is not null) parts.Add((main, main.Document));
                foreach (var h in main.HeaderParts) parts.Add((h, h.Header));
                foreach (var f in main.FooterParts) parts.Add((f, f.Footer));

                foreach (var (part, root) in parts)
                {
                    var drawing = FindPhotoDrawing(root);
                    if (drawing is null) continue;
                    SwapImage(part, drawing, imageBytes, contentType);
                    break;
                }
                main.Document?.Save();
            }
        }
        return ms.ToArray();
    }

    /// <summary>Hujjatda rasm o'rni bormi (andoza yuklanganda adminni ogohlantirish uchun).</summary>
    public static bool HasPhotoPlaceholder(byte[] docxBytes)
    {
        try
        {
            using var ms = new MemoryStream(docxBytes);
            using var doc = WordprocessingDocument.Open(ms, false);
            var main = doc.MainDocumentPart;
            if (main?.Document is null) return false;
            if (FindPhotoDrawing(main.Document) is not null) return true;
            return main.HeaderParts.Any(h => FindPhotoDrawing(h.Header) is not null)
                || main.FooterParts.Any(f => FindPhotoDrawing(f.Footer) is not null);
        }
        catch { return false; }   // buzuq fayl — "yo'q" deb hisoblaymiz, yuklashni bloklamaymiz
    }

    private static Drawing? FindPhotoDrawing(OpenXmlElement root)
    {
        var drawings = root.Descendants<Drawing>().ToList();
        if (drawings.Count == 0) return null;

        // 1) Nomi/alt-matni belgilangani.
        foreach (var d in drawings)
        {
            var props = d.Descendants<DocumentFormat.OpenXml.Drawing.Wordprocessing.DocProperties>();
            var label = string.Join(" ", props.Select(p => $"{p.Name?.Value} {p.Description?.Value}"))
                .ToLowerInvariant();
            if (PhotoMarkers.Any(m => label.Contains(m))) return d;
        }
        // 2) Belgi yo'q, lekin hujjatda BITTA rasm — o'sha.
        return drawings.Count == 1 ? drawings[0] : null;
    }

    private static void SwapImage(
        OpenXmlPart part, Drawing drawing, byte[] imageBytes, string contentType)
    {
        // YANGI rasm qismi qo'shiladi (mavjudining turini o'zgartirib bo'lmaydi: andozadagi
        // o'rin PNG bo'lib, surat JPEG bo'lsa baytlarni to'g'ridan-to'g'ri yozish hujjatni buzardi).
        // `AddNewPart<ImagePart>(contentType, id)` — content-type SATRI bilan ishlaydi, ya'ni
        // kutubxonaning ichki `ImagePartType` turiga bog'lanib qolmaymiz.
        var relId = "rIdPhoto" + Guid.NewGuid().ToString("N")[..8];
        var imagePart = part.AddNewPart<ImagePart>(contentType, relId);

        using (var src = new MemoryStream(imageBytes)) imagePart.FeedData(src);
        foreach (var blip in drawing.Descendants<DocumentFormat.OpenXml.Drawing.Blip>())
            blip.Embed = relId;

        // Nisbatni saqlab, muallif ajratgan katak ICHIGA sig'diramiz ("contain").
        var (w, h) = ImageSize(imageBytes);
        if (w <= 0 || h <= 0) return;
        var extent = drawing.Descendants<DocumentFormat.OpenXml.Drawing.Wordprocessing.Extent>().FirstOrDefault();
        if (extent?.Cx is null || extent.Cy is null) return;

        var scale = Math.Min(extent.Cx.Value / (double)w, extent.Cy.Value / (double)h);
        var cx = (long)Math.Round(w * scale);
        var cy = (long)Math.Round(h * scale);
        if (cx <= 0 || cy <= 0) return;

        extent.Cx = cx;
        extent.Cy = cy;
        // Shakl o'lchami ham (a:xfrm/a:ext) — aks holda Word rasmni katakka cho'zib ko'rsatadi.
        foreach (var ext in drawing.Descendants<DocumentFormat.OpenXml.Drawing.Extents>())
        {
            ext.Cx = cx;
            ext.Cy = cy;
        }
    }

    private static string? ContentTypeOf(string? extension) =>
        (extension ?? "").ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".tif" or ".tiff" => "image/tiff",
            // webp/heic — Word ularni ishonchli ko'rsatmaydi, andozaga tegmaymiz.
            // (O'quvchi surati kameradan JPEG bo'lib keladi — StudentPhotoDialog.)
            _ => null,
        };

    /// <summary>
    /// Rasm o'lchamini FAYL SARLAVHASIDAN o'qiydi (piksel). Tashqi kutubxona shart emas —
    /// bizga faqat NISBAT kerak, rasmni qayta chizish emas. Tanilmasa (0,0).
    /// </summary>
    internal static (int Width, int Height) ImageSize(byte[] data)
    {
        // PNG: 8 baytlik imzo + IHDR (kenglik 16..19, balandlik 20..23 — big-endian).
        if (data.Length > 24 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47)
            return (Be32(data, 16), Be32(data, 20));

        // JPEG: segmentlarni kezib SOFn (0xC0..0xCF, restart/DHT/DAC mustasno) markerini topamiz.
        if (data.Length > 4 && data[0] == 0xFF && data[1] == 0xD8)
        {
            var i = 2;
            while (i + 9 < data.Length)
            {
                if (data[i] != 0xFF) { i++; continue; }
                var marker = data[i + 1];
                // To'ldiruvchi 0xFF, SOI va RSTn — uzunliksiz markerlar.
                if (marker == 0xFF) { i++; continue; }
                if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
                var segLen = (data[i + 2] << 8) | data[i + 3];
                if (segLen < 2) break;
                var isSof = (marker >= 0xC0 && marker <= 0xCF)
                            && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
                if (isSof) return ((data[i + 7] << 8) | data[i + 8], (data[i + 5] << 8) | data[i + 6]);
                i += 2 + segLen;
            }
        }
        return (0, 0);
    }

    private static int Be32(byte[] d, int o) => (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];

    private static void ReplaceIn(OpenXmlElement root, IDictionary<string, string> tokens)
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
            texts[0].Space = SpaceProcessingModeValues.Preserve;
            for (var i = 1; i < texts.Count; i++) texts[i].Text = "";
        }
    }
}
