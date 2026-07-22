namespace Ihui.AI;

/// <summary>
/// 401 未授权异常 — API Key 无效或缺失。
/// </summary>
public class AuthenticationException : SdkException
{
    /// <summary>构造 AuthenticationException。</summary>
    /// <param name="status">HTTP 状态码(应为 401)</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public AuthenticationException(int status, string? code, string message, object? details = null)
        : base(status, code, message, details)
    {
    }
}
