using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 用户 / 工作区 / 工作流 / 统计模块。
/// </summary>
/// <remarks>
/// 端点(9 个):
/// <list type="bullet">
///   <item>GET  /v1/me(当前用户 + 配额)</item>
///   <item>GET  /v1/projects(项目列表)</item>
///   <item>GET  /v1/projects/:id/files(项目文件)</item>
///   <item>GET  /v1/workflows/:id(工作流详情)</item>
///   <item>POST /v1/workflows/instances(运行工作流)</item>
///   <item>POST /v1/workflows/coze/run(Coze 工作流)</item>
///   <item>POST /v1/workflows/n8n/run(n8n 工作流)</item>
///   <item>GET  /v1/usage(用量统计)</item>
///   <item>GET  /v1/usage/:vendor(厂商用量)</item>
/// </list>
/// </remarks>
public sealed class UserApi
{
    private readonly BaseClient _client;

    internal UserApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/me(当前用户信息 + 配额)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>用户信息(JsonElement)</returns>
    public Task<JsonElement?> MeAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/me", null, cancellationToken);

    /// <summary>GET /v1/projects(项目列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>项目列表(JsonElement)</returns>
    public Task<JsonElement?> ListProjectsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/projects", null, cancellationToken);

    /// <summary>GET /v1/projects/:id/files(项目文件列表)。</summary>
    /// <param name="projectId">项目 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文件列表(JsonElement)</returns>
    public Task<JsonElement?> ListProjectFilesAsync(string projectId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/projects/" + BaseClient.Encode(projectId) + "/files", null, cancellationToken);

    /// <summary>GET /v1/workflows/:id(工作流详情)。</summary>
    /// <param name="id">工作流 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>工作流详情(JsonElement)</returns>
    public Task<JsonElement?> GetWorkflowAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/workflows/" + BaseClient.Encode(id), null, cancellationToken);

    /// <summary>POST /v1/workflows/instances(运行工作流)。</summary>
    /// <param name="req">工作流运行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>运行结果(JsonElement)</returns>
    public Task<JsonElement?> RunWorkflowAsync(WorkflowRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/workflows/instances", req, cancellationToken);

    /// <summary>POST /v1/workflows/coze/run(Coze 工作流)。</summary>
    /// <param name="req">工作流运行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>运行结果(JsonElement,透传上游 Coze 响应)</returns>
    public Task<JsonElement?> RunCozeWorkflowAsync(WorkflowRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/workflows/coze/run", req, cancellationToken);

    /// <summary>POST /v1/workflows/n8n/run(n8n 工作流)。</summary>
    /// <param name="req">工作流运行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>运行结果(JsonElement,透传上游 n8n 响应)</returns>
    public Task<JsonElement?> RunN8nWorkflowAsync(WorkflowRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/workflows/n8n/run", req, cancellationToken);

    /// <summary>GET /v1/usage(用量统计)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>用量统计</returns>
    public Task<UsageResponse?> GetUsageAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<UsageResponse>("GET", "/usage", null, cancellationToken);

    /// <summary>GET /v1/usage/:vendor(厂商用量)。</summary>
    /// <param name="vendor">厂商标识</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>厂商用量(JsonElement)</returns>
    public Task<JsonElement?> GetVendorUsageAsync(string vendor, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/usage/" + BaseClient.Encode(vendor), null, cancellationToken);
}
