using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// Agent 模块 — 列表 / 调用 / 高级执行 / Pipeline / 并行 / 任务分解。
/// </summary>
/// <remarks>
/// 端点(12 个):
/// <list type="bullet">
///   <item>GET  /v1/agents</item>
///   <item>GET  /v1/agents/:id</item>
///   <item>POST /v1/agents/:id/call</item>
///   <item>POST /v1/agents/execute(高级执行)</item>
///   <item>POST /v1/agents/execute/stream(SSE 流式执行)</item>
///   <item>GET  /v1/agents/tasks/:id/status</item>
///   <item>POST /v1/agents/tasks/:id/cancel</item>
///   <item>GET  /v1/agents/sessions</item>
///   <item>DELETE /v1/agents/sessions/:id</item>
///   <item>POST /v1/agents/pipeline</item>
///   <item>POST /v1/agents/parallel</item>
///   <item>POST /v1/agents/decompose</item>
/// </list>
/// </remarks>
public sealed class AgentsApi
{
    private readonly BaseClient _client;

    internal AgentsApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/agents(Agent 列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Agent 列表(JsonElement)</returns>
    public Task<JsonElement?> ListAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/agents", null, cancellationToken);

    /// <summary>GET /v1/agents/:id(Agent 详情)。</summary>
    /// <param name="id">Agent ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Agent 详情(JsonElement)</returns>
    public Task<JsonElement?> GetAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/agents/" + BaseClient.Encode(id), null, cancellationToken);

    /// <summary>POST /v1/agents/:id/call(调用 Agent)。</summary>
    /// <param name="id">Agent ID</param>
    /// <param name="req">请求体(input / context 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>调用结果(JsonElement)</returns>
    public Task<JsonElement?> CallAsync(string id, object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/agents/" + BaseClient.Encode(id) + "/call", req, cancellationToken);

    /// <summary>POST /v1/agents/execute(高级执行,支持 PermissionGuard)。</summary>
    /// <param name="req">Agent 执行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Agent 执行响应</returns>
    public Task<AgentExecuteResponse?> ExecuteAsync(AgentExecuteRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<AgentExecuteResponse>("POST", "/agents/execute", req, cancellationToken);

    /// <summary>POST /v1/agents/execute/stream(SSE 流式执行)。</summary>
    /// <param name="req">Agent 执行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>IAsyncEnumerable,逐事件 yield JsonElement</returns>
    public IAsyncEnumerable<JsonElement> ExecuteStreamAsync(AgentExecuteRequest req, CancellationToken cancellationToken = default)
        => _client.RequestStreamAsync("POST", "/agents/execute/stream", req, cancellationToken);

    /// <summary>GET /v1/agents/tasks/:id/status(任务状态)。</summary>
    /// <param name="taskId">任务 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>任务状态(JsonElement)</returns>
    public Task<JsonElement?> GetTaskStatusAsync(string taskId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/agents/tasks/" + BaseClient.Encode(taskId) + "/status", null, cancellationToken);

    /// <summary>POST /v1/agents/tasks/:id/cancel(取消任务)。</summary>
    /// <param name="taskId">任务 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    public Task CancelTaskAsync(string taskId, CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("POST", "/agents/tasks/" + BaseClient.Encode(taskId) + "/cancel", null, cancellationToken)!;

    /// <summary>GET /v1/agents/sessions(会话列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>会话列表(JsonElement)</returns>
    public Task<JsonElement?> ListSessionsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/agents/sessions", null, cancellationToken);

    /// <summary>DELETE /v1/agents/sessions/:id(删除会话)。</summary>
    /// <param name="id">会话 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    public Task DeleteSessionAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("DELETE", "/agents/sessions/" + BaseClient.Encode(id), null, cancellationToken)!;

    /// <summary>POST /v1/agents/pipeline(Pipeline 编排)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Pipeline 执行结果(JsonElement)</returns>
    public Task<JsonElement?> PipelineAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/agents/pipeline", req, cancellationToken);

    /// <summary>POST /v1/agents/parallel(并行执行)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>并行执行结果(JsonElement)</returns>
    public Task<JsonElement?> ParallelAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/agents/parallel", req, cancellationToken);

    /// <summary>POST /v1/agents/decompose(任务分解)。</summary>
    /// <param name="req">Agent 执行请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>任务分解结果(JsonElement,含 taskId / subtasks)</returns>
    public Task<JsonElement?> DecomposeAsync(AgentExecuteRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/agents/decompose", req, cancellationToken);
}
