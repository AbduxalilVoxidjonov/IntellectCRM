using System.Text;
using System.Text.Json;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Azure Speech FAST TRANSCRIPTION — uzun audiolarni (qo'ng'iroq yozuvlari, 2 soatgacha,
/// mp3/wav/ogg) BIR so'rovda so'zma-so'z matnga o'giradi. Mavjud <see cref="AzureSpeechService"/>
/// short-audio (~60s WAV) bilan cheklangani uchun Call Center'ga alohida servis.
///
/// MUHIM: <c>profanityFilterMode=None</c> — matn HECH QANDAY moslashtirish/senzurasiz,
/// aytilganidek qaytadi (foydalanuvchi talabi: so'zma-so'z transkript).
/// Bir nechta locale berilsa Azure tilni o'zi aniqlaydi (o'zbek/rus aralash suhbatlar uchun).
/// Kalit/region — CenterMeta.AzureSpeechKey/Region (Speaking bilan bir xil).
/// DIQQAT: Fast Transcription hamma regionda emas (eastus, westeurope, southeastasia, ...);
/// region qo'llamasa Azure xatosi qaytadi va UI'da ko'rinadi.
/// </summary>
public static class AzureTranscribeService
{
    // Uzun audio — 5 daqiqagacha kutamiz (10 daqiqalik suhbat ~ 30-60s ishlanadi).
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };

    public static bool IsConfigured(string? key, string? region) =>
        !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(region);

    /// <summary>
    /// Audio faylni to'liq transkript qiladi. <paramref name="localesCsv"/> — masalan
    /// "uz-UZ,ru-RU" (bo'sh bo'lsa shu default). Qaytadi: (ok, matn, xato).
    /// </summary>
    public static async Task<(bool Ok, string Text, string? Error)> TranscribeAsync(
        byte[] audio, string fileName, string key, string region, string? localesCsv = null,
        CancellationToken ct = default)
    {
        if (!IsConfigured(key, region)) return (false, "", "Azure Speech sozlanmagan (kalit/region)");
        if (audio.Length == 0) return (false, "", "Audio bo'sh");
        if (audio.Length > 200_000_000) return (false, "", "Audio juda katta (200 MB dan oshmasin)");

        var locales = (string.IsNullOrWhiteSpace(localesCsv) ? "uz-UZ,ru-RU" : localesCsv)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var url = $"https://{region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15";

        // profanityFilterMode=None — so'zma-so'z (maskalash/olib tashlash YO'Q).
        var definition = JsonSerializer.Serialize(new
        {
            locales,
            profanityFilterMode = "None",
        });

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(audio);
        form.Add(audioContent, "audio", string.IsNullOrWhiteSpace(fileName) ? "audio.wav" : fileName);
        form.Add(new StringContent(definition, Encoding.UTF8, "application/json"), "definition");

        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
        req.Headers.Add("Ocp-Apim-Subscription-Key", key);

        HttpResponseMessage resp;
        try
        {
            resp = await Http.SendAsync(req, ct);
        }
        catch (Exception ex)
        {
            return (false, "", $"Azure bilan ulanish xatosi: {ex.Message}");
        }

        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            // Azure xato tanasi odatda {"error":{"code","message"}} — qisqartirib qaytaramiz.
            var msg = body.Length > 400 ? body[..400] : body;
            return (false, "", $"Azure transkripsiya xatosi (HTTP {(int)resp.StatusCode}): {msg}");
        }

        try
        {
            var root = JsonDocument.Parse(body).RootElement;
            // combinedPhrases — tayyor birlashtirilgan matn (kanal bo'yicha).
            if (root.TryGetProperty("combinedPhrases", out var combined) && combined.ValueKind == JsonValueKind.Array)
            {
                var parts = combined.EnumerateArray()
                    .Select(p => p.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "")
                    .Where(t => t.Length > 0);
                var text = string.Join("\n", parts).Trim();
                if (text.Length > 0) return (true, text, null);
            }
            // Zaxira: phrases[] dan yig'ish.
            if (root.TryGetProperty("phrases", out var phrases) && phrases.ValueKind == JsonValueKind.Array)
            {
                var text = string.Join(" ", phrases.EnumerateArray()
                    .Select(p => p.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "")
                    .Where(t => t.Length > 0)).Trim();
                if (text.Length > 0) return (true, text, null);
            }
            return (false, "", "Transkript bo'sh qaytdi (audio'da nutq topilmadi?)");
        }
        catch (Exception ex)
        {
            return (false, "", $"Azure javobini o'qib bo'lmadi: {ex.Message}");
        }
    }
}
