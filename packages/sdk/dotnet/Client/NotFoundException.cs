namespace Ihui.AI;

/// <summary>
/// 404 资源不存在异常。
/// </summary>
public class NotFoundException : SdkException
{
    /// <summary>构造 NotFoundException。</summary>
    /// <param name="status">HTTP 状态码(应为 404)</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public NotFoundException(int status, string? code, string message, object? details = null)
        : base(status, code, message, details)
    {
    }
}
