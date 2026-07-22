using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 音频模块 — TTS / ASR / 语音对话 / 声纹 / 音乐生成。
/// </summary>
/// <remarks>
/// 端点(8 个):
/// <list type="bullet">
///   <item>GET  /v1/audio/voices</item>
///   <item>POST /v1/audio/speech(TTS)</item>
///   <item>POST /v1/audio/transcriptions(ASR)</item>
///   <item>POST /v1/audio/chat(语音对话)</item>
///   <item>GET  /v1/audio/speakers(声纹列表)</item>
///   <item>POST /v1/audio/speakers(声纹注册)</item>
///   <item>POST /v1/audio/speakers/compare(声纹比对)</item>
///   <item>POST /v1/audio/music(音乐生成)</item>
/// </list>
/// </remarks>
public sealed class AudioApi
{
    private readonly BaseClient _client;

    internal AudioApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/audio/voices(音色列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>音色列表(JsonElement)</returns>
    public Task<JsonElement?> ListVoicesAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/audio/voices", null, cancellationToken);

    /// <summary>POST /v1/audio/speech(文字转语音)。</summary>
    /// <param name="req">TTS 请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>响应(JsonElement,含音频 URL 或 base64)</returns>
    public Task<JsonElement?> SpeechAsync(AudioSpeechRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/speech", req, cancellationToken);

    /// <summary>POST /v1/audio/transcriptions(语音转文字)。</summary>
    /// <param name="req">请求体(audio base64 / model 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>转写结果(JsonElement)</returns>
    public Task<JsonElement?> TranscriptionsAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/transcriptions", req, cancellationToken);

    /// <summary>POST /v1/audio/chat(语音对话)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>对话结果(JsonElement)</returns>
    public Task<JsonElement?> ChatAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/chat", req, cancellationToken);

    /// <summary>GET /v1/audio/speakers(声纹列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>声纹列表(JsonElement)</returns>
    public Task<JsonElement?> ListSpeakersAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/audio/speakers", null, cancellationToken);

    /// <summary>POST /v1/audio/speakers(声纹注册)。</summary>
    /// <param name="req">请求体(name / audio 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>注册结果(JsonElement)</returns>
    public Task<JsonElement?> RegisterSpeakerAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/speakers", req, cancellationToken);

    /// <summary>POST /v1/audio/speakers/compare(声纹比对)。</summary>
    /// <param name="req">请求体(audio1 / audio2 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>比对结果(JsonElement)</returns>
    public Task<JsonElement?> CompareSpeakersAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/speakers/compare", req, cancellationToken);

    /// <summary>POST /v1/audio/music(音乐生成)。</summary>
    /// <param name="req">请求体(prompt / duration 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>音乐生成结果(JsonElement)</returns>
    public Task<JsonElement?> MusicAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/audio/music", req, cancellationToken);
}
