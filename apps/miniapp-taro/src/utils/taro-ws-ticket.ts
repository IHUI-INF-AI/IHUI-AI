// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 WS ticket 换取(Taro.request 实现)。
 *
 * 背景(2026-10-26):@ihui/api-client 的 ws-client 默认 ticketProvider 走包内
 * `fetchWsTicket`,而它第一行就是 `if (typeof fetch === 'undefined') return null`
 * —— 小程序运行时**没有全局 fetch** ⇒ 默认实现恒返回 null ⇒ ws-client 落到
 * `connectToken = ticket || fallbackToken`,长期直连 access token。
 * 而 access token 只有 15 分钟(auth 的 JWT_ACCESS_TTL_SECONDS=900),
 * 通知 WS 是长连接 ⇒ access 一过期服务端即 4003 拒绝 ⇒ 反复重连。
 *
 * 本文件给出小程序端的换票实现:POST /ws/ticket,access token 走 Authorization
 * 头(不进 URL),换回的 WS 票 5 分钟过期且 type='ws' 隔离。
 *
 * 失败语义与包内 `fetchWsTicket` 完全一致:**任何失败一律返回 null**,绝不抛错
 * —— 降级直连 access token 由 ws-client 兜住(降级不是错误,不得打断建连)。
 * 超时用 Taro.request 的 timeout 选项(小程序无 AbortSignal)。
 *
 * 换票失败是这一层的正常分支(与包内实现同款),故不写日志:真机零噪音,
 * 排障靠 ws-client 自己的重连/错误面。
 *
 * 平台特有:依赖 Taro 运行时(Taro.request),不适合共享层。
 */
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/auth'

/** 换票超时(ms)—— 与包内 fetchWsTicket 的 AbortSignal.timeout(10_000) 同档 */
export const WS_TICKET_REQUEST_TIMEOUT_MS = 10_000

/** 换票响应体形状(服务端信封 `{ code, message, data: { wsToken } }`) */
interface WsTicketResponse {
  data?: { wsToken?: unknown }
}

/**
 * 换票端点基址:从 API 基址剥掉 `/api` 路径前缀。
 *
 * **为什么必须剥**:服务端 `POST /ws/ticket` 挂在 `plugins/ws-notifications.ts`,
 * 该插件在 `apps/api/src/server.ts` 里**无 prefix 注册** ⇒ 端点是 `/ws/ticket`,
 * **不在 `/api` 之下**(`/api` 是逐路由注册的,见 server.ts 的 `prefix: '/api'` 用法)。
 * 而本端 `BASE_URL` 带 `/api` 后缀(如 `http://localhost:8802/api`),
 * 直接拼会打成 `/api/ws/ticket` ⇒ 404 ⇒ 票据化形同虚设(静默退化成不换票)。
 * 生产 nginx 同样把 `/ws` 列为独立握手区(location /ws),印证根路径这一口径。
 * web 端同理:其换票基址是 `http://localhost:8802`(无 /api)。
 *
 * 与端内 `buildTaroNotificationWsUrl`(同一桥层文件)剥 `/api` 的口径一致。
 * 相对基址(H5 dev 的 '/api')无法推导绝对 host ⇒ 返回 '' 由调用方降级直连。
 */
export function resolveWsTicketBaseUrl(baseUrl: string): string {
  const match = /^https?:\/\/[^/?#]+/i.exec(baseUrl.trim())
  return match ? match[0] : ''
}

/**
 * 用 access token 换一张短期 WS 票(POST /ws/ticket)。
 *
 * 返回 null 表示换票失败(网络/超时/非 2xx/响应体无 wsToken/无凭据/无 Taro),
 * 调用方应降级为直连 access token(服务端 wsAuth 兼容双 token)。
 *
 * @param baseUrl API 基础地址(含 /api 后缀;换票端点会剥掉 /api 前缀)
 * @param accessToken access token;缺省时回落到端内唯一凭据出口 getToken()
 */
export async function fetchTaroWsTicket(
  baseUrl: string,
  accessToken?: string,
): Promise<string | null> {
  // 无 Taro 运行时 ⇒ 无法换票,降级直连(与包内"无全局 fetch"同一条分支)
  if (!Taro || typeof Taro.request !== 'function') return null
  // 换票端点在根路径(/ws/ticket),不在 /api 之下 ⇒ 先剥 /api 前缀
  const ticketBase = resolveWsTicketBaseUrl(baseUrl)
  if (!ticketBase) return null
  const token =
    typeof accessToken === 'string' && accessToken.trim().length > 0 ? accessToken : getToken()
  if (!token) return null
  try {
    const res = await Taro.request<WsTicketResponse>({
      url: `${ticketBase}/ws/ticket`,
      method: 'POST',
      header: { Authorization: `Bearer ${token}` },
      timeout: WS_TICKET_REQUEST_TIMEOUT_MS,
    })
    const statusCode: unknown = res?.statusCode
    if (typeof statusCode !== 'number' || statusCode < 200 || statusCode >= 300) return null
    const wsToken = res?.data?.data?.wsToken
    return typeof wsToken === 'string' && wsToken.length > 0 ? wsToken : null
  } catch {
    // 换票失败不是错误:降级直连由 ws-client 兜住
    return null
  }
}

/**
 * 生成可直接注入 `createNotificationClient` 的 ticketProvider。
 *
 * 契约与包内 `WebSocketClientOptions.ticketProvider` 一致:
 * `(accessToken: string) => Promise<string | null>`。
 */
export function createTaroWsTicketProvider(
  baseUrl: string,
): (accessToken: string) => Promise<string | null> {
  return (accessToken: string) => fetchTaroWsTicket(baseUrl, accessToken)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
