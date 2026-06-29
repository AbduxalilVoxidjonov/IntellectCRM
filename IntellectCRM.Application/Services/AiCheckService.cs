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

    /// <summary>Writing (yozma) matn uchun tahlil prompti. taskType: "ielts_task1"/"ielts_task2" — IELTS band bahosi.</summary>
    public static string WritingPrompt(string? topic, string text, string? taskType = null)
    {
        if (taskType is "ielts_task1" or "ielts_task2")
            return IeltsWritingPrompt(topic, text, taskType);

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

    /// <summary>IELTS Writing Task 1/Task 2 — rasmiy band deskriptorlari bo'yicha baholash prompti.</summary>
    private static string IeltsWritingPrompt(string? topic, string text, string taskType)
    {
        var isTask1 = taskType == "ielts_task1";
        var t = string.IsNullOrWhiteSpace(topic) ? "(question/prompt not provided)" : topic!.Trim();
        var firstCriterion = isTask1 ? "Task Achievement" : "Task Response";
        var sb = new StringBuilder();
        sb.AppendLine($"You are a certified IELTS Writing examiner. Assess the candidate's {(isTask1 ? "Academic Writing TASK 1 (report describing a chart/graph/table/diagram/process or map)" : "Writing TASK 2 (argumentative/discursive essay)")} strictly using the official IELTS band descriptors (band 0-9, half bands allowed).");
        sb.AppendLine($"Question / prompt: {t}");
        sb.AppendLine("Candidate's response:");
        sb.AppendLine("\"\"\"");
        sb.AppendLine(text);
        sb.AppendLine("\"\"\"");
        sb.AppendLine($"Score these FOUR criteria as IELTS bands (0-9, .5 steps): 1) {firstCriterion}, 2) Coherence and Cohesion, 3) Lexical Resource, 4) Grammatical Range and Accuracy.");
        sb.AppendLine("Overall band = average of the four, rounded to the nearest 0.5.");
        if (isTask1)
            sb.AppendLine("Task 1: penalize if under 150 words, if key features/overview are missing, or if data is inaccurate.");
        else
            sb.AppendLine("Task 2: penalize if under 250 words, if the position is unclear, or if the question is not fully addressed.");
        sb.AppendLine("Return STRICT JSON only (no markdown). All explanatory text (summary, explanation, note, strengths,");
        sb.AppendLine("weaknesses, recommendations) MUST be in UZBEK. \"improved\" is a band-9 model answer in English.");
        sb.AppendLine("Fill the \"ielts\" object with the band scores. Also fill \"scores\" (0-100) as band/9*100 for the bars,");
        sb.AppendLine($"\"overall\" (0-100) = ielts.overall/9*100, and \"level\" = \"Band {{ielts.overall}}\". Leave pronunciation/fluency 0.");
        sb.AppendLine("JSON shape:");
        sb.AppendLine(IeltsSchema(taskType));
        return sb.ToString();
    }

    private static string IeltsSchema(string taskType) =>
        "{\n" +
        "  \"overall\": 0,\n" +
        "  \"level\": \"Band X.X\",\n" +
        "  \"scores\": { \"grammar\": 0, \"vocabulary\": 0, \"coherence\": 0, \"task\": 0, \"mechanics\": 0, \"pronunciation\": 0, \"fluency\": 0 },\n" +
        "  \"ielts\": { \"task\": 0.0, \"coherence\": 0.0, \"lexical\": 0.0, \"grammar\": 0.0, \"overall\": 0.0, \"taskType\": \"" + taskType + "\" },\n" +
        "  \"summary\": \"umumiy xulosa (UZBEK)\",\n" +
        "  \"strengths\": [\"UZBEK\"],\n" +
        "  \"weaknesses\": [\"UZBEK\"],\n" +
        "  \"corrections\": [{ \"original\": \"...\", \"suggestion\": \"...\", \"explanation\": \"UZBEK\" }],\n" +
        "  \"vocabulary\": [{ \"word\": \"...\", \"suggestion\": \"...\", \"note\": \"UZBEK\" }],\n" +
        "  \"improved\": \"band-9 model answer in English\",\n" +
        "  \"recommendations\": [\"UZBEK\"]\n" +
        "}";

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
        if (open < 0) return null;
        var close = t.LastIndexOf('}');
        // close > open bo'lsa to'liq obyekt; aks holda javob KESILGAN (truncated) — oxirigacha olamiz.
        var body = close > open ? t[open..(close + 1)] : t[open..];
        var r = TryDeserialize(body) ?? TryDeserialize(RepairJson(body));
        return r is null ? null : Sanitize(r);
    }

    private static AiCheckAnalysisDto? TryDeserialize(string json)
    {
        try { return JsonSerializer.Deserialize<AiCheckAnalysisDto>(json, Opts); }
        catch { return null; }
    }

    /// <summary>Kesilgan (truncated) JSON'ni qutqarishga urinish: ochiq qolgan satr va qavslarni yopadi.
    /// Uzun band-9 esse limitga tushib qolsa, qisman tahlilni baribir ko'rsata olamiz.</summary>
    private static string RepairJson(string s)
    {
        var sb = new StringBuilder(s.Length + 16);
        var stack = new Stack<char>();
        bool inStr = false, esc = false;
        foreach (var c in s)
        {
            if (inStr)
            {
                if (esc) esc = false;
                else if (c == '\\') esc = true;
                else if (c == '"') inStr = false;
            }
            else if (c == '"') inStr = true;
            else if (c is '{' or '[') stack.Push(c);
            else if (c is '}' or ']') { if (stack.Count > 0) stack.Pop(); }
            sb.Append(c);
        }
        if (inStr) sb.Append('"');                                   // ochiq satrni yop
        while (stack.Count > 0) sb.Append(stack.Pop() == '{' ? '}' : ']'); // ochiq qavslarni yop
        return sb.ToString();
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
    private static double B(double v) => Math.Clamp(Math.Round(v * 2) / 2, 0, 9); // band 0-9, 0.5 qadam

    /// <summary>Null'larni to'ldiradi, ballarni 0-100 (IELTS bandlarini 0-9) ga qisadi.</summary>
    private static AiCheckAnalysisDto Sanitize(AiCheckAnalysisDto r)
    {
        var s = r.Scores ?? new AiCheckScoresDto(0, 0, 0, 0, 0, 0, 0);
        var ielts = r.Ielts is null ? null : new AiCheckIeltsDto(
            B(r.Ielts.Task), B(r.Ielts.Coherence), B(r.Ielts.Lexical), B(r.Ielts.Grammar), B(r.Ielts.Overall),
            (r.Ielts.TaskType ?? "").Trim());
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
            r.Recommendations ?? new List<string>(),
            ielts);
    }
}
