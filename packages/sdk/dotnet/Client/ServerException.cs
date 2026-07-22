namespace Ihui.AI;

/// <summary>
/// 5xx 服务端错误异常。
/// </summary>
public class ServerException : SdkException
{
    /// <summary>构造 ServerException。</summary>
    /// <param name="status">HTTP 状态码(5xx)</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public ServerException(int status, string? code, string message, object? details = null)
        : base(status, code, message, details)
    {
    }
}
