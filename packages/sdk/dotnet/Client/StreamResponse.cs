using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 流式响应(SSE 解析工具)— 将 HTTP 响应流解析为 <see cref="IAsyncEnumerable{JsonElement}"/>。
/// </summary>
/// <remarks>
/// 封装 Server-Sent Events 流式响应,逐行解析 <c>data: {json}</c> 格式。
/// 遇到 <c>data: [DONE]</c> 时结束迭代。
/// <para>
/// 用法:
/// <code>
/// await foreach (var chunk in client.Ai.ChatCompletionsStreamAsync(req))
/// {
///     var delta = chunk.GetProperty("choices")[0]
///         .GetProperty("delta")
///         .GetProperty("content")
///         .GetString();
///     Console.Write(delta);
/// }
/// </code>
/// </para>
/// </remarks>
public static class StreamResponse
{
    /// <summary>从 HTTP 响应流解析 SSE 事件,逐 chunk yield JsonElement。</summary>
    /// <param name="response">HTTP 响应消息(必须已 successful)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>IAsyncEnumerable,逐 chunk yield JsonElement</returns>
    public static async IAsyncEnumerable<JsonElement> ParseSseAsync(
        HttpResponseMessage response,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using (response)
        {
            var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using var reader = new StreamReader(stream, Encoding.UTF8);

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
                if (line is null) break;

                var trimmed = line.Trim();
                if (trimmed.Length == 0) continue;
                if (!trimmed.StartsWith("data:")) continue;

                var payload = trimmed.Substring(5).Trim();
                if (payload == "[DONE]") break;

                JsonElement element;
                try
                {
                    using var doc = JsonDocument.Parse(payload);
                    element = doc.RootElement.Clone();
                }
                catch
                {
                    continue;
                }

                yield return element;
            }
        }
    }
}
