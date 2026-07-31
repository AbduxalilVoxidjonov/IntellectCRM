using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using MigraDoc.DocumentObjectModel;
using MigraDoc.Rendering;
using PdfSharp.Fonts;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Shartnomaning PDF nusxasini hosil qiladi (PDFsharp/MigraDoc — to'liq managed, Docker'ga
/// qo'shimcha native paket kerak emas). Ikki manba: matnli andozadan (<see cref="FromText"/>)
/// va to'ldirilgan Word hujjatdan (<see cref="FromDocx"/>).
/// Shrift — DejaVu Sans (kirill + lotin + o'zbekcha <c>ʻ</c>), <c>Assets/Fonts</c> papkasidan
/// <see cref="IFontResolver"/> orqali ulanadi.
/// CHEKLOV: .docx dan ko'chirishda faqat asosiy formatlash saqlanadi (qalin/kursiv/tagchizilgan,
/// tekislash, shrift o'lchami, oddiy jadvallar). Murakkab tartib (rasm, ustunlar, kolontitul,
/// birlashtirilgan katak) yo'qoladi — bu qabul qilingan cheklov, tahrirlanadigan .docx nusxa qoladi.
/// </summary>
public class ContractPdfService
{
    /// <summary>PDF ichida ishlatiladigan shrift oilasi nomi (resolver shu nomni taniydi).</summary>
    private const string FontFamily = "DejaVu Sans";
    private const double DefaultSize = 11;

    static ContractPdfService()
    {
        // FontResolver — global va faqat bir marta o'rnatiladi (PDFsharp keyin o'zgartirishga ruxsat bermaydi).
        GlobalFontSettings.FontResolver ??= new DejaVuFontResolver();
    }

    /// <summary>
    /// Matnli andozadan PDF: A4, 2 sm hoshiya, DejaVu Sans 11pt. Har bir satr — alohida paragraf,
    /// bo'sh satr — interval (bo'sh paragraf).
    /// </summary>
    public byte[] FromText(string filledText)
    {
        var doc = NewDocument();
        var section = doc.LastSection;
        var lines = (filledText ?? string.Empty).Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
        foreach (var line in lines)
        {
            var p = section.AddParagraph();
            var text = Clean(line);
            if (text.Length > 0) p.AddText(text);
        }
        return Render(doc);
    }

    /// <summary>
    /// To'ldirilgan Word (.docx) hujjatdan PDF: paragraflar, run formatlari (qalin/kursiv/
    /// tagchizilgan), tekislash, shrift o'lchami va oddiy jadvallar ko'chiriladi.
    /// </summary>
    public byte[] FromDocx(byte[] docx)
    {
        var doc = NewDocument();
        var section = doc.LastSection;

        using var ms = new MemoryStream(docx, writable: false);
        using var word = WordprocessingDocument.Open(ms, false);
        var body = word.MainDocumentPart?.Document?.Body;
        if (body is not null)
        {
            foreach (var el in body.ChildElements)
            {
                if (el is W.Paragraph para) FillParagraph(section.AddParagraph(), para);
                else if (el is W.Table table) AddTable(section, table);
            }
        }
        // Bo'sh bo'limni MigraDoc ham chiqaradi, lekin kamida bitta paragraf bo'lgani xavfsizroq.
        if (section.Elements.Count == 0) section.AddParagraph();
        return Render(doc);
    }

    // ---------- Hujjat qurish ----------

    /// <summary>A4, 2 sm hoshiya, DejaVu Sans 11pt — umumiy sahifa sozlamalari.</summary>
    private static Document NewDocument()
    {
        var doc = new Document();
        var normal = doc.Styles["Normal"];
        if (normal is not null)
        {
            normal.Font.Name = FontFamily;
            normal.Font.Size = Unit.FromPoint(DefaultSize);
            normal.ParagraphFormat.SpaceAfter = Unit.FromPoint(2);
        }
        var section = doc.AddSection();
        section.PageSetup.PageFormat = PageFormat.A4;
        section.PageSetup.TopMargin = Unit.FromCentimeter(2);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(2);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(2);
        section.PageSetup.RightMargin = Unit.FromCentimeter(2);
        return doc;
    }

    private static byte[] Render(Document doc)
    {
        var renderer = new PdfDocumentRenderer { Document = doc };
        renderer.RenderDocument();
        using var ms = new MemoryStream();
        renderer.PdfDocument.Save(ms, false);
        return ms.ToArray();
    }

    /// <summary>Word paragrafini MigraDoc paragrafiga ko'chiradi (run formatlari bilan).</summary>
    private static void FillParagraph(Paragraph target, W.Paragraph para)
    {
        target.Format.Alignment = MapAlignment(para.ParagraphProperties?.Justification?.Val?.Value);

        foreach (var run in para.Descendants<W.Run>())
        {
            // Matn va satr uzilishlari — run ichidagi tartibda.
            foreach (var child in run.ChildElements)
            {
                switch (child)
                {
                    case W.Text t:
                        var text = Clean(t.Text);
                        if (text.Length == 0) continue;
                        ApplyRunFormat(target.AddFormattedText(text), run.RunProperties);
                        break;
                    case W.Break:
                        target.AddLineBreak();
                        break;
                    case W.TabChar:
                        target.AddText("    ");
                        break;
                }
            }
        }
    }

    /// <summary>Word run xossalarini (qalin/kursiv/tagchizilgan/o'lcham) MigraDoc matniga qo'llaydi.</summary>
    private static void ApplyRunFormat(FormattedText ft, W.RunProperties? rp)
    {
        if (rp is null) return;
        if (IsOn(rp.Bold)) ft.Bold = true;
        if (IsOn(rp.Italic)) ft.Italic = true;
        if (rp.Underline?.Val is not null && rp.Underline.Val.Value != W.UnderlineValues.None)
            ft.Underline = Underline.Single;
        // Word shrift o'lchamini yarim-punktda saqlaydi (sz=22 → 11pt).
        if (rp.FontSize?.Val?.Value is { } szRaw
            && double.TryParse(szRaw, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var half)
            && half > 0)
        {
            var size = half / 2;
            if (size is >= 4 and <= 72) ft.Size = Unit.FromPoint(size);
        }
    }

    /// <summary>Word'da <c>&lt;w:b/&gt;</c> (val'siz) ham "yoqilgan" degani.</summary>
    private static bool IsOn(W.OnOffType? prop) => prop is not null && (prop.Val is null || prop.Val.Value);

    private static ParagraphAlignment MapAlignment(W.JustificationValues? j)
    {
        if (j is null) return ParagraphAlignment.Left;
        if (j.Value == W.JustificationValues.Center) return ParagraphAlignment.Center;
        if (j.Value == W.JustificationValues.Right) return ParagraphAlignment.Right;
        if (j.Value == W.JustificationValues.Both) return ParagraphAlignment.Justify;
        return ParagraphAlignment.Left;
    }

    /// <summary>Oddiy jadval: ustunlar teng kenglikda, katakdagi paragraflar ko'chiriladi.</summary>
    private static void AddTable(Section section, W.Table wordTable)
    {
        var rows = wordTable.Elements<W.TableRow>().ToList();
        if (rows.Count == 0) return;
        var columns = rows.Max(r => r.Elements<W.TableCell>().Count());
        if (columns == 0) return;

        var table = section.AddTable();
        table.Borders.Width = 0.5;
        var usable = section.PageSetup.PageWidth.Point
                     - section.PageSetup.LeftMargin.Point - section.PageSetup.RightMargin.Point;
        for (var i = 0; i < columns; i++) table.AddColumn(Unit.FromPoint(usable / columns));

        foreach (var wr in rows)
        {
            var row = table.AddRow();
            var cells = wr.Elements<W.TableCell>().ToList();
            for (var i = 0; i < cells.Count && i < columns; i++)
            {
                var paras = cells[i].Elements<W.Paragraph>().ToList();
                if (paras.Count == 0) { row.Cells[i].AddParagraph(); continue; }
                foreach (var p in paras) FillParagraph(row.Cells[i].AddParagraph(), p);
            }
        }
    }

    /// <summary>MigraDoc qabul qilmaydigan boshqaruv belgilarini tozalaydi (tab → bo'shliq).</summary>
    private static string Clean(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var sb = new System.Text.StringBuilder(text.Length);
        foreach (var ch in text)
        {
            if (ch == '\t') sb.Append("    ");
            else if (ch is '\r' or '\n') sb.Append(' ');
            else if (!char.IsControl(ch)) sb.Append(ch);
        }
        return sb.ToString();
    }

    /// <summary>
    /// DejaVu Sans shriftini chiqish papkasidagi <c>Assets/Fonts</c> dan yuklaydi. PDFsharp'da
    /// tizim shriftlari yo'q (Linux/Docker konteynerida ham), shuning uchun shrift repo bilan keladi.
    /// Kirill, lotin va o'zbekcha <c>ʻ</c> (U+02BB) belgilarini qamrab oladi.
    /// </summary>
    private sealed class DejaVuFontResolver : IFontResolver
    {
        private static readonly Dictionary<string, string> Files = new(StringComparer.OrdinalIgnoreCase)
        {
            ["DejaVuSans"] = "DejaVuSans.ttf",
            ["DejaVuSans#b"] = "DejaVuSans-Bold.ttf",
            ["DejaVuSans#i"] = "DejaVuSans-Oblique.ttf",
            ["DejaVuSans#bi"] = "DejaVuSans-BoldOblique.ttf",
        };

        private static readonly Dictionary<string, byte[]> Cache = new(StringComparer.OrdinalIgnoreCase);
        private static readonly object Lock = new();

        public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
        {
            var suffix = (isBold, isItalic) switch
            {
                (true, true) => "#bi",
                (true, false) => "#b",
                (false, true) => "#i",
                _ => "",
            };
            return new FontResolverInfo("DejaVuSans" + suffix);
        }

        public byte[]? GetFont(string faceName)
        {
            lock (Lock)
            {
                if (Cache.TryGetValue(faceName, out var cached)) return cached;
                var file = Files.TryGetValue(faceName, out var f) ? f : Files["DejaVuSans"];
                var path = Path.Combine(AppContext.BaseDirectory, "Assets", "Fonts", file);
                // Fayl topilmasa — oddiy (Regular) variantga qaytamiz: PDF baribir hosil bo'lsin.
                if (!File.Exists(path))
                    path = Path.Combine(AppContext.BaseDirectory, "Assets", "Fonts", Files["DejaVuSans"]);
                var bytes = File.ReadAllBytes(path);
                Cache[faceName] = bytes;
                return bytes;
            }
        }
    }
}
