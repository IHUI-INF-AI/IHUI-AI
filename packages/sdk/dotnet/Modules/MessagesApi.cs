using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 消息模块 — 发布 / 订阅 / 取消订阅 / 状态查询。
/// </summary>
/// <remarks>
/// 端点(4 个):
/// <list type="bullet">
///   <item>POST   /v1/messages(发布消息)</item>
///   <item>POST   /v1/messages/subscribe(订阅频道)</item>
///   <item>DELETE /v1/messages/subscribe/:id(取消订阅)</item>
///   <item>GET    /v1/messages/:id/status(消息状态)</item>
/// </list>
/// </remarks>
public sealed class MessagesApi
{
    private readonly BaseClient _client;

    internal MessagesApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/messages(发布消息)。</summary>
    /// <param name="req">请求体(channel / content 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>发布结果(JsonElement,含 messageId)</returns>
    public Task<JsonElement?> PublishAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/messages", req, cancellationToken);

    /// <summary>POST /v1/messages/subscribe(订阅频道)。</summary>
    /// <param name="req">请求体(channel / webhook 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>订阅结果(JsonElement,含 subscriptionId)</returns>
    public Task<JsonElement?> SubscribeAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/messages/subscribe", req, cancellationToken);

    /// <summary>DELETE /v1/messages/subscribe/:id(取消订阅)。</summary>
    /// <param name="subscriptionId">订阅 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>取消结果(JsonElement,含 subscriptionId / status)</returns>
    public Task<JsonElement?> UnsubscribeAsync(string subscriptionId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("DELETE", "/messages/subscribe/" + BaseClient.Encode(subscriptionId), null, cancellationToken);

    /// <summary>GET /v1/messages/:id/status(消息状态)。</summary>
    /// <param name="messageId">消息 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>消息状态(JsonElement)</returns>
    public Task<JsonElement?> GetStatusAsync(string messageId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/messages/" + BaseClient.Encode(messageId) + "/status", null, cancellationToken);
}
