using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Web;

namespace Ihui.AI;

/// <summary>
/// SDK 基础客户端 — 鉴权、重试、超时、错误处理。
/// </summary>
/// <remarks>
/// 封装:
/// <list type="bullet">
///   <item>鉴权:自动注入 <c>Authorization: Bearer ${apiKey}</c>,可选 <c>X-Api-Secret</c></item>
///   <item>重试:网络错误 + 5xx 自动重试(指数退避 500ms / 1000ms),429 不重试</item>
///   <item>超时:默认 30s,可配置;流式请求 Timeout = InfiniteTimeSpan</item>
///   <item>错误处理:根据 HTTP 状态码自动抛对应子类异常</item>
/// </list>
/// 所有业务模块共享一个 BaseClient 实例。
/// </remarks>
public sealed class BaseClient : IDisposable
{
    /// <summary>重试退避延迟(毫秒),对应第 1 次 / 第 2 次重试。</summary>
    private static readonly int[] RetryDelays = { 500, 1000 };

    private static readonly MediaTypeHeaderValue JsonContentType = new("application/json") { CharSet = "utf-8" };

    private readonly SdkConfig _config;
    private readonly HttpClient _httpClient;
    private readonly HttpClient _streamHttpClient;
    private readonly bool _ownsHttpClient;

    /// <summary>用 SdkConfig 构造 BaseClient。</summary>
    /// <param name="config">SDK 配置</param>
    public BaseClient(SdkConfig config) : this(config, null) { }

    /// <summary>用 SdkConfig 和自定义 HttpClient 构造 BaseClient。</summary>
    /// <param name="config">SDK 配置</param>
    /// <param name="httpClient">自定义 HttpClient(为 null 则内部创建)</param>
    public BaseClient(SdkConfig config, HttpClient? httpClient)
    {
        _config = config;

        if (httpClient != null)
        {
            _httpClient = httpClient;
            _streamHttpClient = httpClient;
            _ownsHttpClient = false;
        }
        else
        {
            var handler = new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) };
            _httpClient = new HttpClient(handler) { Timeout = config.Timeout };
            _streamHttpClient = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
            _ownsHttpClient = true;
        }
    }

    /// <summary>基础 URL(无尾部斜杠)。</summary>
    public string BaseUrl => _config.BaseUrl;

    /// <summary>API Key。</summary>
    public string ApiKey => _config.ApiKey;

    // ------------------------------------------------------------------
    // 公开请求方法
    // ------------------------------------------------------------------

    /// <summary>发起 JSON 请求并解析响应为指定类型。</summary>
    /// <typeparam name="T">响应类型</typeparam>
    /// <param name="method">HTTP 方法(GET/POST/PUT/DELETE)</param>
    /// <param name="path">路径(不含 /v1 前缀,如 /models)</param>
    /// <param name="body">请求体对象(将被 JSON 序列化);GET / DELETE 传 null</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>反序列化响应对象;空响应返回 default</returns>
    /// <exception cref="SdkException">请求失败</exception>
    public async Task<T?> RequestAsync<T>(string method, string path, object? body, CancellationToken cancellationToken = default)
    {
        var raw = await RequestRawAsync(method, path, body, cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(raw)) return default;
        return JsonUtil.FromJson<T>(raw);
    }

    /// <summary>发起 JSON 请求,返回原始响应字符串。</summary>
    /// <param name="method">HTTP 方法</param>
    /// <param name="path">路径</param>
    /// <param name="body">请求体对象;无请求体传 null</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>响应字符串;空响应返回 null</returns>
    /// <exception cref="SdkException">请求失败</exception>
    public async Task<string?> RequestRawAsync(string method, string path, object? body, CancellationToken cancellationToken = default)
    {
        SdkException? lastError = null;
        var maxRetries = _config.MaxRetries;

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            if (attempt > 0)
            {
                int delay = RetryDelays[Math.Min(attempt - 1, RetryDelays.Length - 1)];
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }

            try
            {
                using var request = BuildRequest(method, path, body);
                using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
                var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

                if (response.IsSuccessStatusCode)
                {
                    return text;
                }

                lastError = SdkExceptionFactory.FromStatus((int)response.StatusCode, text);

                // 429 和 4xx 不重试
                if ((int)response.StatusCode == 429 || (int)response.StatusCode < 500)
                {
                    break;
                }
                // 5xx 继续重试
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // 超时,继续重试
                lastError = new SdkException(0, "timeout", "Request timed out", null);
            }
            catch (SdkException)
            {
                throw;
            }
            catch (Exception e) when (e is HttpRequestException or IOException)
            {
                lastError = new SdkException(0, "network_error", "Network error: " + e.Message, null);
                // 网络错误继续重试
            }
        }

        throw lastError ?? new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /// <summary>发起 multipart/form-data 上传请求。</summary>
    /// <typeparam name="T">响应类型</typeparam>
    /// <param name="path">路径</param>
    /// <param name="content">MultipartFormDataContent(由调用方构造)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>反序列化响应对象</returns>
    /// <exception cref="SdkException">请求失败</exception>
    public async Task<T?> RequestMultipartAsync<T>(string path, MultipartFormDataContent content, CancellationToken cancellationToken = default)
    {
        SdkException? lastError = null;
        var maxRetries = _config.MaxRetries;

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            if (attempt > 0)
            {
                int delay = RetryDelays[Math.Min(attempt - 1, RetryDelays.Length - 1)];
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl(path)) { Content = content };
                ApplyAuthHeaders(request);
                using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
                var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

                if (response.IsSuccessStatusCode)
                {
                    return string.IsNullOrEmpty(text) ? default : JsonUtil.FromJson<T>(text);
                }

                lastError = SdkExceptionFactory.FromStatus((int)response.StatusCode, text);
                if ((int)response.StatusCode == 429 || (int)response.StatusCode < 500)
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                lastError = new SdkException(0, "timeout", "Request timed out", null);
            }
            catch (SdkException)
            {
                throw;
            }
            catch (Exception e) when (e is HttpRequestException or IOException)
            {
                lastError = new SdkException(0, "network_error", "Network error: " + e.Message, null);
            }
        }

        throw lastError ?? new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /// <summary>发起流式请求,返回 IAsyncEnumerable(JsonElement 逐 chunk yield)。</summary>
    /// <param name="method">HTTP 方法(通常为 POST)</param>
    /// <param name="path">路径</param>
    /// <param name="body">请求体对象;无请求体传 null</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>IAsyncEnumerable,逐 chunk yield JsonElement</returns>
    /// <exception cref="SdkException">请求失败</exception>
    public async IAsyncEnumerable<JsonElement> RequestStreamAsync(string method, string path, object? body, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        HttpResponseMessage response;
        try
        {
            using var request = BuildRequest(method, path, body);
            response = await _streamHttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                response.Dispose();
                throw SdkExceptionFactory.FromStatus((int)response.StatusCode, text);
            }
        }
        catch (SdkException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new SdkException(0, "timeout", "Stream request timed out", null);
        }
        catch (Exception e) when (e is HttpRequestException or IOException)
        {
            throw new SdkException(0, "network_error", "Network error: " + e.Message, null);
        }

        await foreach (var element in StreamResponse.ParseSseAsync(response, cancellationToken).ConfigureAwait(false))
        {
            yield return element;
        }
    }

    /// <summary>发起二进制下载请求,返回原始字节数组。</summary>
    /// <param name="path">路径</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>字节数组</returns>
    /// <exception cref="SdkException">请求失败</exception>
    public async Task<byte[]> RequestBytesAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, BuildUrl(path));
            ApplyAuthHeaders(request);
            using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                throw SdkExceptionFactory.FromStatus((int)response.StatusCode, text);
            }

            return await response.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (SdkException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new SdkException(0, "timeout", "Request timed out", null);
        }
        catch (Exception e) when (e is HttpRequestException or IOException)
        {
            throw new SdkException(0, "network_error", "Network error: " + e.Message, null);
        }
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

    private HttpRequestMessage BuildRequest(string method, string path, object? body)
    {
        var httpMethod = new HttpMethod(method.ToUpperInvariant());
        var request = new HttpRequestMessage(httpMethod, BuildUrl(path));

        if (body != null)
        {
            var json = JsonUtil.ToJson(body);
            request.Content = new StringContent(json, Encoding.UTF8);
            request.Content.Headers.ContentType = JsonContentType;
        }

        ApplyAuthHeaders(request);
        return request;
    }

    private void ApplyAuthHeaders(HttpRequestMessage request)
    {
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _config.ApiKey);
        if (_config.Secret != null)
        {
            request.Headers.TryAddWithoutValidation("X-Api-Secret", _config.Secret);
        }
    }

    private string BuildUrl(string path)
    {
        string p = path.StartsWith('/') ? path : "/" + path;
        return _config.BaseUrl + "/v1" + p;
    }

    /// <summary>对路径段进行 URL 编码。</summary>
    /// <param name="segment">路径段</param>
    /// <returns>编码后的字符串</returns>
    public static string Encode(string segment)
    {
        return HttpUtility.UrlEncode(segment);
    }

    /// <summary>将查询参数附加到 path 之后。</summary>
    /// <param name="path">路径</param>
    /// <param name="parameters">查询参数字典</param>
    /// <returns>拼接后的路径</returns>
    public static string WithQuery(string path, IDictionary<string, object?>? parameters)
    {
        if (parameters == null || parameters.Count == 0) return path;

        var sb = new StringBuilder(path);
        sb.Append(path.Contains('?') ? '&' : '?');

        bool first = true;
        foreach (var kvp in parameters)
        {
            if (kvp.Value == null) continue;
            if (!first) sb.Append('&');
            first = false;
            sb.Append(HttpUtility.UrlEncode(kvp.Key));
            sb.Append('=');
            sb.Append(HttpUtility.UrlEncode(Convert.ToString(kvp.Value, System.Globalization.CultureInfo.InvariantCulture)));
        }

        return sb.ToString();
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        if (_ownsHttpClient)
        {
            _httpClient.Dispose();
            _streamHttpClient.Dispose();
        }
    }
}
