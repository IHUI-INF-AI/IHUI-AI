namespace Ihui.AI;

/// <summary>
/// 403 禁止访问异常 — API Key 权限不足。
/// </summary>
public class PermissionException : SdkException
{
    /// <summary>构造 PermissionException。</summary>
    /// <param name="status">HTTP 状态码(应为 403)</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public PermissionException(int status, string? code, string message, object? details = null)
        : base(status, code, message, details)
    {
    }
}
