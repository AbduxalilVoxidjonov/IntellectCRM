using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using IntellectCRM.Application.Dtos;

namespace IntellectCRM.Application.Services;

/// <summary>
/// Azure Speech (Cognitive Services) — TALAFFUZNI BAHOLASH (Pronunciation Assessment).
/// REST orqali (SDK'siz, Docker'da yengil): qisqa audio (WAV PCM 16kHz mono) yuboriladi,
/// xizmat nutqni matnga o'giradi VA talaffuzni baholaydi (accuracy/fluency/completeness/prosody +
/// per-word). ReferenceText berilsa shu matnga taqqoslanadi (scripted), bo'sh bo'lsa erkin (unscripted).
/// </summary>
public static class AzureSpeechService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(40) };

    public static bool IsConfigured(string? key, string? region) =>
        !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(region);

    /// <summary>Baytlar haqiqiy WAV (RIFF/WAVE) ekanini tekshiradi — ixtiyoriy/buzuq yuklamani
    /// pullik Azure chaqirig'iga jo'natmaslik uchun.</summary>
    public static bool LooksLikeWav(byte[] b) =>
        b.Length >= 12 &&
        b[0] == (byte)'R' && b[1] == (byte)'I' && b[2] == (byte)'F' && b[3] == (byte)'F' &&
        b[8] == (byte)'W' && b[9] == (byte)'A' && b[10] == (byte)'V' && b[11] == (byte)'E';

    public static async Task<SpeakingResultDto> AssessAsync(
        byte[] wav, string referenceText, string key, string region, string language = "en-US")
    {
        SpeakingResultDto Err(string m) => new("", 0, 0, 0, 0, 0, new(), m);
        try
        {
            // Pronunciation Assessment konfiguratsiyasi (base64 header sifatida uzatiladi).
            var config = new
            {
                ReferenceText = referenceText ?? "",
                GradingSystem = "HundredMark",
                Granularity = "Word",
                Dimension = "Comprehensive",
                EnableProsodyAssessment = true,
            };
            var configB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(config)));
            var url = $"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/" +
                      $"cognitiveservices/v1?language={language}&format=detailed";

            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("Ocp-Apim-Subscription-Key", key);
            req.Headers.Add("Pronunciation-Assessment", configB64);
            req.Headers.Add("Accept", "application/json");
            var content = new ByteArrayContent(wav);
            // DIQQAT: MediaTypeHeaderValue.Parse "codecs=audio/pcm" dagi '/' ni token sifatida
            // rad etadi ("format ... is invalid"). Shuning uchun xom header sifatida qo'yamiz.
            content.Headers.TryAddWithoutValidation(
                "Content-Type", "audio/wav; codecs=audio/pcm; samplerate=16000");
            req.Content = content;

            using var resp = await Http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
                return Err($"Azure xato ({(int)resp.StatusCode}). Kalit/region to'g'riligini tekshiring.");

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var status = root.TryGetProperty("RecognitionStatus", out var st) ? st.GetString() : "";
            if (status != "Success")
                return Err(status == "NoMatch" ? "Nutq aniqlanmadi — balandroq va aniqroq gapiring." : $"Holat: {status}");

            var display = root.TryGetProperty("DisplayText", out var dt) ? dt.GetString() ?? "" : "";
            if (!root.TryGetProperty("NBest", out var nbestArr) || nbestArr.GetArrayLength() == 0)
                return Err("Natija bo'sh.");
            var nbest = nbestArr[0];
            if (!nbest.TryGetProperty("PronunciationAssessment", out var pa))
                return Err("Talaffuz bahosi qaytmadi.");

            static double G(JsonElement e, string p) =>
                e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;

            var words = new List<SpeakingWordDto>();
            if (nbest.TryGetProperty("Words", out var wordsEl) && wordsEl.ValueKind == JsonValueKind.Array)
                foreach (var w in wordsEl.EnumerateArray())
                {
                    var word = w.TryGetProperty("Word", out var wd) ? wd.GetString() ?? "" : "";
                    double acc = 0;
                    var errType = "None";
                    if (w.TryGetProperty("PronunciationAssessment", out var wpa))
                    {
                        acc = G(wpa, "AccuracyScore");
                        errType = wpa.TryGetProperty("ErrorType", out var et) ? et.GetString() ?? "None" : "None";
                    }
                    words.Add(new SpeakingWordDto(word, acc, errType));
                }

            return new SpeakingResultDto(
                display, G(pa, "PronScore"), G(pa, "AccuracyScore"), G(pa, "FluencyScore"),
                G(pa, "CompletenessScore"), G(pa, "ProsodyScore"), words, null);
        }
        catch (TaskCanceledException)
        {
            return Err("Vaqt tugadi (timeout) — qaytadan urinib ko'ring.");
        }
        catch (Exception ex)
        {
            return Err($"Xatolik: {ex.Message}");
        }
    }
}
