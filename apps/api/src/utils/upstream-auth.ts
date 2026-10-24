// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L7066(G-396 拍板执行,2026-10-23):上游凭据错与会话失效分离。
 *
 * 拍板原文:「第三方 key 错改 502 + 独立 errorCode;客户端仅对鉴权端点真 401 触登出」。
 *
 * 适用判据(非会话场景):本 API 已在自己的鉴权层验过用户会话(如 checkAuth/authenticate
 * 先行),或出站走服务自身凭据(系统 token)。此时下游再回 401 只可能是「服务侧凭据被
 * 下游拒收」,与用户登录态无关 —— 若原样透传 401,packages/api-client 的 401 出口
 * (client.ts 的 refresh→notifyUnauthorized 链)会把它读成会话死亡,把用户踢去重新登录。
 *
 * 不适用:未经本地鉴权预检、且原样透传用户 Authorization 的通路 —— 那里的下游 401
 * 可能真是会话过期,必须保留 401 语义(否则真过期的 token 永远等不到登录屏)。
 */

export const UPSTREAM_AUTH_FAILED = 'UPSTREAM_AUTH_FAILED'
export const UPSTREAM_AUTH_FAILED_MESSAGE = '上游服务鉴权失败(服务侧凭据问题,非您的登录状态)'

/** 非会话场景下把下游状态码映射为出栈状态码:401 ⇒ 502,其余原样。 */
export function mapNonSessionUpstreamStatus(status: number): number {
  return status === 401 ? 502 : status
}

/** 映射生效时的响应体(带独立 errorCode,便于端内分型与排查)。 */
export function upstreamAuthFailedBody(): { code: number; message: string; errorCode: string } {
  return { code: 502, message: UPSTREAM_AUTH_FAILED_MESSAGE, errorCode: UPSTREAM_AUTH_FAILED }
}
