namespace Ihui.AI;

/// <summary>
/// IHUI SDK 客户端,聚合 13 个功能模块,封装 105 个 /v1/* API 端点。
/// </summary>
/// <remarks>
/// 用法:
/// <code>
/// var client = IhuiClient.CreateBuilder()
///     .WithApiKey("ihui_xxx")
///     .WithBaseUrl("http://localhost:3001")
///     .Build();
///
/// var resp = await client.Ai.CompletionsAsync(new ChatCompletionRequest
/// {
///     Model = "gpt-4o",
///     Messages = new List&lt;Message&gt; { new("user", "你好") }
/// });
/// </code>
/// <para>
/// 流式响应:
/// <code>
/// await foreach (var chunk in client.Ai.ChatCompletionsStreamAsync(req))
/// {
///     var delta = chunk.GetProperty("choices")[0]
///         .GetProperty("delta").GetProperty("content").GetString();
///     Console.Write(delta);
/// }
/// </code>
/// </para>
/// </remarks>
public sealed class IhuiClient : IDisposable
{
    /// <summary>AI 核心:chat / embeddings / vision / moa / models / userModels(13 端点)。</summary>
    public AiApi Ai { get; }

    /// <summary>Agent:列表 / 调用 / 高级执行 / Pipeline / 并行(12 端点)。</summary>
    public AgentsApi Agents { get; }

    /// <summary>音频:TTS / ASR / 语音对话 / 声纹 / 音乐(8 端点)。</summary>
    public AudioApi Audio { get; }

    /// <summary>图像:文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景(6 端点)。</summary>
    public ImagesApi Images { get; }

    /// <summary>视频:生成 / 任务查询 / 编排(3 端点)。</summary>
    public VideosApi Videos { get; }

    /// <summary>3D 模型生成(1 端点)。</summary>
    public ThreeDApi ThreeD { get; }

    /// <summary>生成队列:入队 / 状态 / 取消(3 端点)。</summary>
    public GenerationApi Generation { get; }

    /// <summary>知识库 / RAG / 知识图谱(13 端点)。</summary>
    public KnowledgeApi Knowledge { get; }

    /// <summary>MCP 工具 / 技能 / 人格 / 代码搜索 / 截图(16 端点)。</summary>
    public ToolsApi Tools { get; }

    /// <summary>记忆:保存 / 召回 / 搜索 / Dream / 分类记忆(8 端点)。</summary>
    public MemoryApi Memory { get; }

    /// <summary>消息:发布 / 订阅 / 状态(4 端点)。</summary>
    public MessagesApi Messages { get; }

    /// <summary>文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传(9 端点)。</summary>
    public FilesApi Files { get; }

    /// <summary>用户 / 工作区 / 工作流 / 统计(9 端点)。</summary>
    public UserApi User { get; }

    private readonly BaseClient _baseClient;

    /// <summary>用 SdkConfig 构造 IhuiClient。</summary>
    /// <param name="config">SDK 配置</param>
    public IhuiClient(SdkConfig config)
        : this(config, null)
    {
    }

    /// <summary>用 SdkConfig 和自定义 HttpClient 构造 IhuiClient。</summary>
    /// <param name="config">SDK 配置</param>
    /// <param name="httpClient">自定义 HttpClient(为 null 则内部创建)</param>
    public IhuiClient(SdkConfig config, HttpClient? httpClient)
    {
        _baseClient = new BaseClient(config, httpClient);
        Ai = new AiApi(_baseClient);
        Agents = new AgentsApi(_baseClient);
        Audio = new AudioApi(_baseClient);
        Images = new ImagesApi(_baseClient);
        Videos = new VideosApi(_baseClient);
        ThreeD = new ThreeDApi(_baseClient);
        Generation = new GenerationApi(_baseClient);
        Knowledge = new KnowledgeApi(_baseClient);
        Tools = new ToolsApi(_baseClient);
        Memory = new MemoryApi(_baseClient);
        Messages = new MessagesApi(_baseClient);
        Files = new FilesApi(_baseClient);
        User = new UserApi(_baseClient);
    }

    /// <summary>底层 BaseClient(供高级用户扩展)。</summary>
    public BaseClient GetBaseClient() => _baseClient;

    /// <summary>创建 Builder。</summary>
    /// <returns>新的 Builder 实例</returns>
    public static Builder CreateBuilder() => new();

    /// <inheritdoc/>
    public void Dispose() => _baseClient.Dispose();

    /// <summary>IhuiClient builder。</summary>
    public sealed class Builder
    {
        private readonly SdkConfig.Builder _configBuilder = SdkConfig.CreateBuilder();
        private HttpClient? _httpClient;

        internal Builder() { }

        /// <summary>设置 API Key(必需)。</summary>
        /// <param name="apiKey">API Key(格式 ihui_xxx)</param>
        /// <returns>当前 builder</returns>
        public Builder WithApiKey(string apiKey)
        {
            _configBuilder.WithApiKey(apiKey);
            return this;
        }

        /// <summary>设置 API Secret(可选)。</summary>
        /// <param name="secret">API Secret</param>
        /// <returns>当前 builder</returns>
        public Builder WithSecret(string? secret)
        {
            _configBuilder.WithSecret(secret);
            return this;
        }

        /// <summary>设置基础 URL。</summary>
        /// <param name="baseUrl">基础 URL(默认 http://localhost:3001)</param>
        /// <returns>当前 builder</returns>
        public Builder WithBaseUrl(string baseUrl)
        {
            _configBuilder.WithBaseUrl(baseUrl);
            return this;
        }

        /// <summary>设置请求超时。</summary>
        /// <param name="timeout">超时时长(默认 30s)</param>
        /// <returns>当前 builder</returns>
        public Builder WithTimeout(TimeSpan timeout)
        {
            _configBuilder.WithTimeout(timeout);
            return this;
        }

        /// <summary>设置最大重试次数。</summary>
        /// <param name="maxRetries">最大重试次数(默认 2)</param>
        /// <returns>当前 builder</returns>
        public Builder WithMaxRetries(int maxRetries)
        {
            _configBuilder.WithMaxRetries(maxRetries);
            return this;
        }

        /// <summary>设置自定义 HttpClient(可选,用于依赖注入或共享连接池)。</summary>
        /// <param name="httpClient">自定义 HttpClient</param>
        /// <returns>当前 builder</returns>
        public Builder WithHttpClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
            return this;
        }

        /// <summary>构建 IhuiClient。</summary>
        /// <returns>IhuiClient 实例</returns>
        public IhuiClient Build()
        {
            return new IhuiClient(_configBuilder.Build(), _httpClient);
        }
    }
}
