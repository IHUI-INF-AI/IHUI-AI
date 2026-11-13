// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-678:转发失败 → 对外 HTTP 状态映射(纯函数,消费侧唯一判据)。
 *
 * 病灶:`ForwardResult.lastHttpStatus` 只写不读 —— 上游 400/401/404/429 经两条腿
 * (渠道直连 / 账号池)后都被压成 `ok:false`,v1-public 一律回 503,客户端无法区分
 * 「参数错 / 鉴权错 / 未知模型 / 限流」与「网关不可用」,重试策略失效。
 *
 * 判据:
 * - 4xx(上游对该请求的明确拒绝)⇒ 原样映射同状态码;429 若上游给了 Retry-After 就带上;
 * - 无 lastHttpStatus(无可用上游 / 网络错)与 5xx ⇒ 503(网关侧上游不可用)。
 * 只做状态码判定,不接触上游响应体/响应头,天然不会把上游敏感头透传给客户端。
 */

/** 失败结果里本函数需要的两个字段(ForwardFailure 的结构子集) */
export interface ForwardFailureShape {
  /** 最后一次上游 HTTP 状态(网络错误 / 无候选时为 undefined) */
  lastHttpStatus?: number
  /** 429 时上游给出的 Retry-After(原样字符串) */
  retryAfter?: string
}

export interface ForwardFailureHttp {
  /** 对外 HTTP 状态 */
  status: number
  /** 仅 429 且上游确实给了 Retry-After 时存在 */
  retryAfter?: string
}

export function mapForwardFailureToHttp(
  result: ForwardFailureShape | null | undefined,
): ForwardFailureHttp {
  const upstream = result?.lastHttpStatus
  if (upstream === undefined) return { status: 503 }
  if (upstream >= 400 && upstream < 500) {
    if (upstream === 429 && result?.retryAfter) return { status: 429, retryAfter: result.retryAfter }
    return { status: upstream }
  }
  return { status: 503 }
}
