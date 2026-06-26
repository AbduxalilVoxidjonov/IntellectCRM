using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Google Gemini (Generative Language API) — matnli tahlil (generateContent).
/// O'quvchi profilini (baholar, davomat, intizom, topshiriqlar, to'lov...) tahlil qilib,
/// o'zbek tilida xulosa/tavsiya qaytaradi ("AI Tahlil" tugmasi).
/// SDK'siz, REST orqali (Docker'da yengil). API kaliti DB'da (CenterMeta.GeminiApiKey),
/// model esa env GEMINI_MODEL (default <see cref="DefaultModel"/>) dan olinadi.
/// </summary>
public static class GeminiService
{
    public const string DefaultModel = "gemini-3.1-flash-lite";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(90) };

    public static bool IsConfigured(string? apiKey) => !string.IsNullOrWhiteSpace(apiKey);

    /// <summary>Modelni konfiguratsiyadan oladi (env GEMINI_MODEL), bo'lmasa default.</summary>
    public static string ResolveModel(IConfiguration? config) =>
        (config?["GEMINI_MODEL"] ?? config?["Gemini:Model"])?.Trim() is { Length: > 0 } m ? m : DefaultModel;

    /// <summary>Berilgan promptni Geminiga yuboradi va javob matnini qaytaradi.
    /// Muvaffaqiyatsiz bo'lsa (Ok=false) sabab Error'da bo'ladi.</summary>
    public static async Task<(bool Ok, string Text, string? Error)> GenerateAsync(
        string apiKey, string model, string prompt)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            return (false, "", "Gemini API kaliti sozlanmagan.");
        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
            var payload = new
            {
                contents = new[]
                {
                    new { role = "user", parts = new[] { new { text = prompt } } }
                },
                generationConfig = new { temperature = 0.5, maxOutputTokens = 2048 }
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("x-goog-api-key", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var resp = await Http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                var msg = TryExtractError(body);
                return (false, "", $"Gemini xato ({(int)resp.StatusCode}). {msg}");
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // Bloklangan bo'lsa (xavfsizlik filtrlari) — sabab.
            if (root.TryGetProperty("promptFeedback", out var pf) &&
                pf.TryGetProperty("blockReason", out var br))
                return (false, "", $"So'rov bloklandi: {br.GetString()}");

            if (!root.TryGetProperty("candidates", out var cands) || cands.GetArrayLength() == 0)
                return (false, "", "Javob bo'sh qaytdi.");

            var sb = new StringBuilder();
            var first = cands[0];
            if (first.TryGetProperty("content", out var content) &&
                content.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
                foreach (var p in parts.EnumerateArray())
                    if (p.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
                        sb.Append(t.GetString());

            var text = sb.ToString().Trim();
            return text.Length == 0
                ? (false, "", "Javob matni bo'sh.")
                : (true, text, null);
        }
        catch (TaskCanceledException)
        {
            return (false, "", "Vaqt tugadi (timeout) — qaytadan urinib ko'ring.");
        }
        catch (Exception ex)
        {
            return (false, "", $"Xatolik: {ex.Message}");
        }
    }

    private static string TryExtractError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err) &&
                err.TryGetProperty("message", out var m))
                return m.GetString() ?? "Kalit/model to'g'riligini tekshiring.";
        }
        catch { /* ignore */ }
        return "Kalit/model to'g'riligini tekshiring.";
    }
}
