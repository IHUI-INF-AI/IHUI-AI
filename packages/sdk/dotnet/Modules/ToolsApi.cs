using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块。
/// </summary>
/// <remarks>
/// 端点(16 个):
/// <list type="bullet">
///   <item>GET  /v1/tools</item>
///   <item>POST /v1/tools/call</item>
///   <item>GET  /v1/resources</item>
///   <item>GET  /v1/resources/:uri</item>
///   <item>GET  /v1/prompts</item>
///   <item>POST /v1/prompts/invoke</item>
///   <item>GET  /v1/skills</item>
///   <item>GET  /v1/slash-commands</item>
///   <item>POST /v1/slash-commands</item>
///   <item>POST /v1/sampling</item>
///   <item>GET  /v1/personas</item>
///   <item>GET  /v1/personas/:name</item>
///   <item>POST /v1/tools/search-codebase</item>
///   <item>POST /v1/tools/search-web</item>
///   <item>POST /v1/tools/analyze-code</item>
///   <item>POST /v1/screenshot</item>
/// </list>
/// </remarks>
public sealed class ToolsApi
{
    private readonly BaseClient _client;

    internal ToolsApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/tools(MCP 工具列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>工具列表(JsonElement)</returns>
    public Task<JsonElement?> ListAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/tools", null, cancellationToken);

    /// <summary>POST /v1/tools/call(调用 MCP 工具)。</summary>
    /// <param name="req">工具调用请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>调用结果(JsonElement)</returns>
    public Task<JsonElement?> CallAsync(ToolCallRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/tools/call", req, cancellationToken);

    /// <summary>GET /v1/resources(MCP 资源列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>资源列表(JsonElement)</returns>
    public Task<JsonElement?> ListResourcesAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/resources", null, cancellationToken);

    /// <summary>GET /v1/resources/:uri(资源详情)。</summary>
    /// <param name="uri">资源 URI</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>资源详情(JsonElement)</returns>
    public Task<JsonElement?> GetResourceAsync(string uri, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/resources/" + BaseClient.Encode(uri), null, cancellationToken);

    /// <summary>GET /v1/prompts(MCP 提示词列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>提示词列表(JsonElement)</returns>
    public Task<JsonElement?> ListPromptsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/prompts", null, cancellationToken);

    /// <summary>POST /v1/prompts/invoke(调用提示词)。</summary>
    /// <param name="req">请求体(name / arguments 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>调用结果(JsonElement)</returns>
    public Task<JsonElement?> InvokePromptAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/prompts/invoke", req, cancellationToken);

    /// <summary>GET /v1/skills(技能列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>技能列表(JsonElement)</returns>
    public Task<JsonElement?> ListSkillsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/skills", null, cancellationToken);

    /// <summary>GET /v1/slash-commands(slash 命令列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>命令列表(JsonElement)</returns>
    public Task<JsonElement?> ListSlashCommandsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/slash-commands", null, cancellationToken);

    /// <summary>POST /v1/slash-commands(调用 slash 命令)。</summary>
    /// <param name="req">请求体(command / args)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>调用结果(JsonElement)</returns>
    public Task<JsonElement?> InvokeSlashCommandAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/slash-commands", req, cancellationToken);

    /// <summary>POST /v1/sampling(模型采样)。</summary>
    /// <param name="req">请求体(messages / model 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>采样结果(JsonElement)</returns>
    public Task<JsonElement?> SamplingAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/sampling", req, cancellationToken);

    /// <summary>GET /v1/personas(人格列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>人格列表(JsonElement)</returns>
    public Task<JsonElement?> ListPersonasAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/personas", null, cancellationToken);

    /// <summary>GET /v1/personas/:name(人格详情)。</summary>
    /// <param name="name">人格名称</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>人格详情(JsonElement)</returns>
    public Task<JsonElement?> GetPersonaAsync(string name, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/personas/" + BaseClient.Encode(name), null, cancellationToken);

    /// <summary>POST /v1/tools/search-codebase(代码库搜索)。</summary>
    /// <param name="req">请求体(query / filePattern 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>搜索结果(JsonElement)</returns>
    public Task<JsonElement?> SearchCodebaseAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/tools/search-codebase", req, cancellationToken);

    /// <summary>POST /v1/tools/search-web(网页搜索)。</summary>
    /// <param name="req">请求体(query / count 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>搜索结果(JsonElement)</returns>
    public Task<JsonElement?> SearchWebAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/tools/search-web", req, cancellationToken);

    /// <summary>POST /v1/tools/analyze-code(代码分析)。</summary>
    /// <param name="req">请求体(code / language / analysis 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>分析结果(JsonElement)</returns>
    public Task<JsonElement?> AnalyzeCodeAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/tools/analyze-code", req, cancellationToken);

    /// <summary>POST /v1/screenshot(网页截图)。</summary>
    /// <param name="req">请求体(url / width / height 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>截图结果(JsonElement,含 imageUrl)</returns>
    public Task<JsonElement?> ScreenshotAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/screenshot", req, cancellationToken);
}
