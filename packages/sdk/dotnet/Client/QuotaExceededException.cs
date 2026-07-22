namespace Ihui.AI;

/// <summary>
/// 429 配额超限异常 — 请求频率或用量超限。
/// </summary>
public class QuotaExceededException : SdkException
{
    /// <summary>构造 QuotaExceededException。</summary>
    /// <param name="status">HTTP 状态码(应为 429)</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public QuotaExceededException(int status, string? code, string message, object? details = null)
        : base(status, code, message, details)
    {
    }
}
