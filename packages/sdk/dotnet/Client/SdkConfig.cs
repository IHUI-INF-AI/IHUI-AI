namespace Ihui.AI;

/// <summary>
/// SDK 配置(不可变,builder 模式构建)。
/// </summary>
/// <remarks>
/// 配置项:
/// <list type="bullet">
///   <item><c>ApiKey</c> — 必需,API Key(格式 ihui_xxx)</item>
///   <item><c>Secret</c> — 可选,API Secret(创建/轮换时返回)</item>
///   <item><c>BaseUrl</c> — 基础 URL,默认 http://localhost:3001</item>
///   <item><c>Timeout</c> — 请求超时,默认 30s;流式请求不超时</item>
///   <item><c>MaxRetries</c> — 最大重试次数,默认 2;网络错误和 5xx 自动重试,429 不重试</item>
/// </list>
/// </remarks>
public sealed class SdkConfig
{
    /// <summary>默认基础 URL。</summary>
    public const string DefaultBaseUrl = "http://localhost:3001";

    /// <summary>默认超时。</summary>
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    /// <summary>默认最大重试次数。</summary>
    public const int DefaultMaxRetries = 2;

    /// <summary>API Key(必需)。</summary>
    public string ApiKey { get; }

    /// <summary>API Secret(可选)。</summary>
    public string? Secret { get; }

    /// <summary>基础 URL(无尾部斜杠)。</summary>
    public string BaseUrl { get; }

    /// <summary>请求超时。</summary>
    public TimeSpan Timeout { get; }

    /// <summary>最大重试次数。</summary>
    public int MaxRetries { get; }

    private SdkConfig(string apiKey, string? secret, string baseUrl, TimeSpan timeout, int maxRetries)
    {
        ApiKey = apiKey;
        Secret = secret;
        BaseUrl = NormalizeBaseUrl(baseUrl);
        Timeout = timeout;
        MaxRetries = maxRetries;
    }

    private static string NormalizeBaseUrl(string url)
    {
        return url.TrimEnd('/');
    }

    /// <summary>创建 Builder。</summary>
    /// <returns>新的 Builder 实例</returns>
    public static Builder CreateBuilder() => new();

    /// <summary>SDK 配置 builder。</summary>
    public sealed class Builder
    {
        private string? _apiKey;
        private string? _secret;
        private string? _baseUrl;
        private TimeSpan? _timeout;
        private int? _maxRetries;

        internal Builder() { }

        /// <summary>设置 API Key(必需)。</summary>
        /// <param name="apiKey">API Key(格式 ihui_xxx)</param>
        /// <returns>当前 builder</returns>
        public Builder WithApiKey(string apiKey)
        {
            _apiKey = apiKey;
            return this;
        }

        /// <summary>设置 API Secret(可选)。</summary>
        /// <param name="secret">API Secret</param>
        /// <returns>当前 builder</returns>
        public Builder WithSecret(string? secret)
        {
            _secret = secret;
            return this;
        }

        /// <summary>设置基础 URL。</summary>
        /// <param name="baseUrl">基础 URL(默认 http://localhost:3001)</param>
        /// <returns>当前 builder</returns>
        public Builder WithBaseUrl(string baseUrl)
        {
            _baseUrl = baseUrl;
            return this;
        }

        /// <summary>设置请求超时。</summary>
        /// <param name="timeout">超时时长(默认 30s)</param>
        /// <returns>当前 builder</returns>
        public Builder WithTimeout(TimeSpan timeout)
        {
            _timeout = timeout;
            return this;
        }

        /// <summary>设置最大重试次数。</summary>
        /// <param name="maxRetries">最大重试次数(默认 2)</param>
        /// <returns>当前 builder</returns>
        public Builder WithMaxRetries(int maxRetries)
        {
            _maxRetries = maxRetries;
            return this;
        }

        /// <summary>构建 SdkConfig。</summary>
        /// <returns>不可变的 SdkConfig 实例</returns>
        /// <exception cref="ArgumentNullException">apiKey 为 null 或空</exception>
        public SdkConfig Build()
        {
            if (string.IsNullOrEmpty(_apiKey))
                throw new ArgumentNullException(nameof(_apiKey), "apiKey is required");

            return new SdkConfig(
                _apiKey,
                _secret,
                _baseUrl ?? DefaultBaseUrl,
                _timeout ?? DefaultTimeout,
                _maxRetries ?? DefaultMaxRetries
            );
        }
    }
}
