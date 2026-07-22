namespace Ihui.AI;

/// <summary>
/// SDK 异常基类,携带 HTTP 状态码 + 错误码 + 详情。
/// </summary>
/// <remarks>
/// 异常层级:
/// <code>
/// SdkException                // 基类
/// ├── AuthenticationException // 401 未授权
/// ├── PermissionException     // 403 禁止访问
/// ├── NotFoundException       // 404 资源不存在
/// ├── QuotaExceededException  // 429 配额超限
/// └── ServerException         // 5xx 服务端错误
/// </code>
/// </remarks>
public class SdkException : Exception
{
    /// <summary>HTTP 状态码(网络错误为 0)。</summary>
    public int Status { get; }

    /// <summary>错误码字符串(如 auth_invalid_api_key),可能为 null。</summary>
    public string? Code { get; }

    /// <summary>错误详情(来自响应体),可能为 null。</summary>
    public object? Details { get; }

    /// <summary>构造 SDK 异常。</summary>
    /// <param name="status">HTTP 状态码</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    public SdkException(int status, string? code, string message, object? details = null)
        : base(message)
    {
        Status = status;
        Code = code;
        Details = details;
    }

    /// <summary>根据 HTTP 状态码构造对应子类异常。</summary>
    /// <param name="status">HTTP 状态码</param>
    /// <param name="code">错误码</param>
    /// <param name="message">错误消息</param>
    /// <param name="details">错误详情</param>
    /// <returns>对应的 SdkException 子类实例</returns>
    public static SdkException FromStatus(int status, string? code, string message, object? details = null)
    {
        return status switch
        {
            401 => new AuthenticationException(status, code, message, details),
            403 => new PermissionException(status, code, message, details),
            404 => new NotFoundException(status, code, message, details),
            429 => new QuotaExceededException(status, code, message, details),
            >= 500 => new ServerException(status, code, message, details),
            _ => new SdkException(status, code, message, details)
        };
    }

    /// <inheritdoc/>
    public override string ToString()
    {
        return $"{GetType().Name}{{status={Status}, code='{Code}', message='{Message}'}}";
    }
}

/// <summary>
/// 根据 HTTP 状态码构造对应异常的工厂(静态工具类)。
/// </summary>
public static class SdkExceptionFactory
{
    /// <summary>根据 HTTP 状态码和响应体构造对应子类异常。</summary>
    /// <param name="status">HTTP 状态码</param>
    /// <param name="body">响应体字符串</param>
    /// <returns>对应的 SdkException 子类实例</returns>
    public static SdkException FromStatus(int status, string body)
    {
        string? code = "http_" + status;
        string message = "HTTP " + status;
        object? details = null;

        if (!string.IsNullOrEmpty(body))
        {
            try
            {
                using var doc = JsonUtil.ParseDocument(body);
                var root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.Object)
                {
                    var err = root.TryGetProperty("error", out var errEl) && errEl.ValueKind == JsonValueKind.Object
                        ? errEl
                        : root;

                    if (err.TryGetProperty("code", out var codeEl) && codeEl.ValueKind == JsonValueKind.String)
                        code = codeEl.GetString();

                    if (err.TryGetProperty("message", out var msgEl) && msgEl.ValueKind == JsonValueKind.String)
                        message = msgEl.GetString() ?? message;

                    if (err.TryGetProperty("details", out var detEl))
                        details = JsonUtil.ToObject(detEl);
                }
            }
            catch
            {
                // 解析失败,使用默认值
            }
        }

        return SdkException.FromStatus(status, code, message, details);
    }
}
