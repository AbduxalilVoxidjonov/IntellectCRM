using System.Text;
using System.Text.Json;
using IntellectCRM.Application.Dtos;

namespace IntellectCRM.Application.Services;

/// <summary>
/// AI tekshiruv (Speaking/Writing) yordamchisi — Gemini uchun prompt tuzadi va javob JSON'ini
/// strukturali <see cref="AiCheckAnalysisDto"/> ga aylantiradi (diagramma + tuzatish + so'z tahlili).
/// Gemini chaqirig'ining o'zi <see cref="GeminiService"/> orqali (jsonMode=true).
/// </summary>
public static class AiCheckService
{
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };

    private const string Schema =
        "{\n" +
        "  \"overall\": 0,\n" +
        "  \"level\": \"A1|A2|B1|B2|C1\",\n" +
        "  \"scores\": { \"grammar\": 0, \"vocabulary\": 0, \"coherence\": 0, \"task\": 0, \"mechanics\": 0, \"pronunciation\": 0, \"fluency\": 0 },\n" +
        "  \"summary\": \"umumiy xulosa (UZBEK)\",\n" +
        "  \"strengths\": [\"UZBEK\"],\n" +
        "  \"weaknesses\": [\"UZBEK\"],\n" +
        "  \"corrections\": [{ \"original\": \"...\", \"suggestion\": \"...\", \"explanation\": \"UZBEK\" }],\n" +
        "  \"vocabulary\": [{ \"word\": \"...\", \"suggestion\": \"...\", \"note\": \"UZBEK\" }],\n" +
        "  \"improved\": \"improved English version\",\n" +
        "  \"recommendations\": [\"UZBEK\"]\n" +
        "}";

    /// <summary>Writing (yozma) matn uchun tahlil prompti.</summary>
    public static string WritingPrompt(string? topic, string text)
    {
        var t = string.IsNullOrWhiteSpace(topic) ? "(mavzu berilmagan)" : topic!.Trim();
        var sb = new StringBuilder();
        sb.AppendLine("You are an expert English writing examiner. Analyze the student's writing below.");
        sb.AppendLine($"Topic: {t}");
        sb.AppendLine("Student's writing:");
        sb.AppendLine("\"\"\"");
        sb.AppendLine(text);
        sb.AppendLine("\"\"\"");
        sb.AppendLine("Return STRICT JSON only (no markdown). All explanatory/text fields (summary, explanation,");
        sb.AppendLine("note, strengths, weaknesses, recommendations) MUST be written in UZBEK. Scores are integers 0-100.");
        sb.AppendLine("\"improved\" is a corrected/improved version of the student's text in English.");
        sb.AppendLine("For writing, leave \"pronunciation\" and \"fluency\" as 0. JSON shape:");
        sb.AppendLine(Schema);
        return sb.ToString();
    }

    /// <summary>
    /// Speaking (nutq) — Azure tanigan matn + talaffuz ballari + HAR SO'Z aniqligi bo'yicha tahlil prompti.
    /// Gemini past aniqlikdagi so'zlar uchun talaffuz maslahatini "vocabulary" (word + note) ga,
    /// umumiy talaffuz tavsiyalarini "recommendations" ga yozadi.
    /// </summary>
    public static string SpeakingPrompt(string? topic, string recognizedText, SpeakingResultDto azure)
    {
        var t = string.IsNullOrWhiteSpace(topic) ? "(mavzu berilmagan)" : topic!.Trim();
        var wordCount = (azure.Words?.Count ?? 0) > 0
            ? azure.Words!.Count(w => w.ErrorType != "Omission")
            : recognizedText.Split(new[] { ' ', '\n', '\t' }, StringSplitOptions.RemoveEmptyEntries).Length;

        var sb = new StringBuilder();
        sb.AppendLine("You are an expert English pronunciation & speaking coach. The student spoke; Azure Speech");
        sb.AppendLine("assessed pronunciation per word. Your job: explain how to pronounce the weak words and coach the student.");
        sb.AppendLine($"Topic: {t}");
        sb.AppendLine($"Azure scores (0-100): pronunciation={(int)azure.PronScore}, accuracy={(int)azure.Accuracy}, fluency={(int)azure.Fluency}, completeness={(int)azure.Completeness}, prosody={(int)azure.Prosody}.");
        sb.AppendLine($"Word count spoken: {wordCount}.");
        sb.AppendLine("Transcribed speech:");
        sb.AppendLine("\"\"\"");
        sb.AppendLine(recognizedText);
        sb.AppendLine("\"\"\"");

        // Har so'z talaffuz aniqligi (Azure) — Gemini past so'zlarga e'tibor qaratadi.
        if (azure.Words is { Count: > 0 })
        {
            sb.AppendLine("Per-word pronunciation accuracy (0-100) and error type from Azure:");
            foreach (var w in azure.Words.Take(80))
                sb.AppendLine($"- \"{w.Word}\": accuracy={(int)w.Accuracy}, error={w.ErrorType}");
            sb.AppendLine("Focus your pronunciation tips on words with accuracy below 75 or with an error type.");
        }

        sb.AppendLine("Return STRICT JSON only (no markdown). All text fields MUST be in UZBEK. Scores are integers 0-100.");
        sb.AppendLine($"Use Azure values for \"pronunciation\" ({(int)azure.PronScore}) and \"fluency\" ({(int)azure.Fluency}).");
        sb.AppendLine("In \"vocabulary\", for EACH weak word put {word, suggestion (correct form/word), note (HOW to pronounce it, in UZBEK, e.g. phonetic hint)}.");
        sb.AppendLine("In \"recommendations\", give general pronunciation/speaking practice tips (UZBEK). \"improved\" is a better spoken version. JSON shape:");
        sb.AppendLine(Schema);
        return sb.ToString();
    }

    /// <summary>Gemini javob matnini (kod-fence/shovqin tozalanadi) <see cref="AiCheckAnalysisDto"/> ga aylantiradi.</summary>
    public static AiCheckAnalysisDto? Parse(string? text)
    {
        var t = (text ?? "").Trim();
        if (t.StartsWith("```"))
        {
            var nl = t.IndexOf('\n');
            if (nl >= 0) t = t[(nl + 1)..];
            if (t.EndsWith("```")) t = t[..^3];
            t = t.Trim();
        }
        var open = t.IndexOf('{');
        var close = t.LastIndexOf('}');
        if (open >= 0 && close > open) t = t[open..(close + 1)];
        try
        {
            var r = JsonSerializer.Deserialize<AiCheckAnalysisDto>(t, Opts);
            return r is null ? null : Sanitize(r);
        }
        catch { return null; }
    }

    /// <summary>Saqlangan AnalysisJson'ni DTO'ga (xavfsiz) o'qiydi.</summary>
    public static AiCheckAnalysisDto? ParseStored(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var r = JsonSerializer.Deserialize<AiCheckAnalysisDto>(json, Opts);
            return r is null ? null : Sanitize(r);
        }
        catch { return null; }
    }

    private static int C(int v) => Math.Clamp(v, 0, 100);

    /// <summary>Null'larni to'ldiradi, ballarni 0-100 ga qisadi.</summary>
    private static AiCheckAnalysisDto Sanitize(AiCheckAnalysisDto r)
    {
        var s = r.Scores ?? new AiCheckScoresDto(0, 0, 0, 0, 0, 0, 0);
        return new AiCheckAnalysisDto(
            C(r.Overall),
            (r.Level ?? "").Trim(),
            new AiCheckScoresDto(C(s.Grammar), C(s.Vocabulary), C(s.Coherence), C(s.Task), C(s.Mechanics), C(s.Pronunciation), C(s.Fluency)),
            r.Summary ?? "",
            r.Strengths ?? new List<string>(),
            r.Weaknesses ?? new List<string>(),
            r.Corrections ?? new List<AiCorrectionDto>(),
            r.Vocabulary ?? new List<AiVocabDto>(),
            r.Improved ?? "",
            r.Recommendations ?? new List<string>());
    }
}
