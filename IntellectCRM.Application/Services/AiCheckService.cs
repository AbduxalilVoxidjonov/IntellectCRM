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

    /// <summary>Speaking (nutq) — Azure tanigan matn + talaffuz ballari bo'yicha tahlil prompti.</summary>
    public static string SpeakingPrompt(string? topic, string recognizedText, SpeakingResultDto azure)
    {
        var t = string.IsNullOrWhiteSpace(topic) ? "(mavzu berilmagan)" : topic!.Trim();
        var sb = new StringBuilder();
        sb.AppendLine("You are an expert English speaking examiner. The student spoke and a speech engine transcribed it.");
        sb.AppendLine($"Topic: {t}");
        sb.AppendLine($"Azure pronunciation scores (0-100): pronunciation={(int)azure.PronScore}, accuracy={(int)azure.Accuracy}, fluency={(int)azure.Fluency}, completeness={(int)azure.Completeness}, prosody={(int)azure.Prosody}.");
        sb.AppendLine("Transcribed speech:");
        sb.AppendLine("\"\"\"");
        sb.AppendLine(recognizedText);
        sb.AppendLine("\"\"\"");
        sb.AppendLine("Analyze the CONTENT (grammar, vocabulary, coherence, task relevance). Use the Azure scores for");
        sb.AppendLine($"\"pronunciation\" ({(int)azure.PronScore}) and \"fluency\" ({(int)azure.Fluency}). Return STRICT JSON only (no markdown).");
        sb.AppendLine("All text fields MUST be in UZBEK. Scores are integers 0-100. \"improved\" is a better spoken version. JSON shape:");
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
