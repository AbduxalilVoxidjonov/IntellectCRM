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
