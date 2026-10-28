// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:OAuth 2.1 / OIDC 授权服务器「表面层」共享工具(2026-09-21 立)。
 *
 * 只放"多个 oauth-* 路由都要用、且与协议形状强相关"的纯函数,不放业务查询:
 *  - resolveIssuer        —— 规范 issuer 的唯一推导口径(禁止用查询参数)
 *  - isSafeExternalUrl    —— error_uri / 回跳地址白名单校验(SSRF + 钓鱼面)
 *  - oauthErrorReply      —— RFC 6749 §5.2 形状 + 兼容前端判定的数字 code
 *  - applyDiscoveryHeaders —— 发现文档的缓存/嗅探响应头
 *
 * 为什么 `/oauth/*` 不走项目统一的 `{code,message,data}`:
 * 第三方 Agent(MCP/Claude/Cursor)的 OAuth 客户端库只认 `error` 字段,包一层就解析失败;
 * 但 web 端 api-client 用 `if (data.code !== 0)` 判失败,故错误体**必须**同时带数字 `code`
 * (取 HTTP 状态码,恒 ≠ 0)。成功体保持 RFC 原生形状,不套 `{code:0}`。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { OAuthErrorCode } from '@ihui/auth'
import { config } from '../config/index.js'
import { isPrivateOrReservedIp } from './ssrf-guard.js'

/** RFC 6749 §5.2 允许的错误体形状(附加字段见 oauthErrorReply)。 */
export interface OAuthErrorBody {
  error: OAuthErrorCode
  error_description?: string
  /** 兼容 web 端 api-client 的 `data.code !== 0` 判定,恒为 HTTP 状态码(≠ 0)。 */
  code: number
  error_uri?: string
}

/** TLS socket 判定:fastify 的 `raw.socket` 静态类型是 net.Socket,没有 encrypted 字段。 */
function isTlsSocket(socket: unknown): boolean {
  return (
    typeof socket === 'object' &&
    socket !== null &&
    'encrypted' in socket &&
    (socket as { encrypted?: unknown }).encrypted === true
  )
}

/** 从 x-forwarded-proto + host 推出请求 origin(仅在无任何显式配置时兜底)。 */
function originFromHeaders(request: FastifyRequest): string {
  const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto'])
  const proto = forwardedProto ?? (isTlsSocket(request.raw.socket) ? 'https' : 'http')
  const host =
    firstHeaderValue(request.headers['x-forwarded-host']) ??
    request.headers.host ??
    `localhost:${config.PORT}`
  return `${proto}://${host}`
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined
  return value?.split(',')[0]?.trim() || undefined
}

function normalizeIssuer(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

/**
 * 规范 issuer —— 唯一优先级:`PUBLIC_BASE_URL > OAUTH_ISSUER > env.BASE_URL > 请求头推导`。
 *
 * 硬约束:**绝不**接受 `?issuer=` 这类查询参数。auth-extended.ts 的 authorize 端点曾把
 * issuer 查询参数原样拼进回跳,发现文档若照此产出,攻击者投毒一次即可让所有第三方
 * 客户端把 token 发到自己的域(且会被缓存 1 小时)。
 */
export function resolveIssuer(request?: FastifyRequest): string {
  const explicit =
    config.PUBLIC_BASE_URL ||
    config.OAUTH_ISSUER ||
    (process.env.BASE_URL ?? '').trim() ||
    (request ? originFromHeaders(request) : '')
  return normalizeIssuer(explicit)
}

/** 发现文档响应头:公共缓存 1h + 禁止 MIME 嗅探。 */
export function applyDiscoveryHeaders(reply: FastifyReply): FastifyReply {
  reply.header('cache-control', 'public, max-age=3600')
  reply.header('x-content-type-options', 'nosniff')
  return reply
}

/** error_uri 允许的主机名集合(小写、无端口);配置留空时只允许 issuer 自身。 */
function allowedErrorUriHosts(issuer: string): string[] {
  const fromConfig = config.OAUTH_ERROR_URI_HOSTS.split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0)
  const hosts = [...fromConfig]
  try {
    hosts.push(new URL(issuer).hostname.toLowerCase())
  } catch {
    // issuer 非法(未配置且无请求头)时不追加,交由白名单为空 → 一律丢弃 error_uri
  }
  return [...new Set(hosts)].filter((h) => h.length > 0)
}

/**
 * error_uri / 外链白名单校验(同步,不做 DNS —— 发现文档与错误响应是热路径)。
 *
 * 判定失败返回 null(调用方**丢弃**该字段,而不是回 400:错误响应不该因附带字段而升级)。
 * 拒绝面:
 *  - 非 http(s) 协议(javascript:/data:/file: → 渲染端 XSS)
 *  - 带 userinfo(`https://aizhs.top@evil.test/` → 视觉上"像"白名单域)
 *  - 主机名不在白名单(精确匹配,不做后缀匹配,防 `evil-aizhs.top` 混过 `aizhs.top`)
 *  - 主机名是内网/保留 IP 字面量(复用 ssrf-guard 的判定,防内网探测)
 *  - 非标准端口(仅 80/443/无端口)
 */
export function isSafeExternalUrl(raw: string | null | undefined, allowedHosts: string[]): string | null {
  if (!raw || typeof raw !== 'string') return null
  // 先要求"已是 scheme:// 规范形态":`https:evil.test/x` 这类 `:` 后直接跟路径的写法
  // 在 WHATWG 解析器里会被补全成 `https://evil.test/x`(hostname 非空、协议合法),
  // 于是"只查协议/主机名"的实现会放它过 —— 而浏览器把它当**相对 URL** 解析的场合并不少见。
  // 我们只发布规范形态,也就没必要接受非规范输入,直接从字符串层面拒掉。
  if (!/^https?:\/\//i.test(raw)) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const isLoopbackHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHost)) return null
  if (url.username || url.password) return null
  if (url.port !== '' && url.port !== '80' && url.port !== '443') return null
  if (isPrivateOrReservedIp(url.hostname)) return null
  const hostname = url.hostname.toLowerCase()
  if (!allowedHosts.includes(hostname)) return null
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '') || url.origin
}

/**
 * RFC 6749 §5.2 错误响应。`error_uri` 只有过白名单才会出现。
 * @param status 覆盖 HTTP 状态(默认用 oauthErrorStatus 的映射,由调用方传)
 */
export function buildOAuthErrorBody(
  error: OAuthErrorCode,
  status: number,
  errorDescription?: string,
  errorUri?: string | null,
): OAuthErrorBody {
  const body: OAuthErrorBody = { error, code: status }
  if (errorDescription) body.error_description = errorDescription
  if (errorUri) body.error_uri = errorUri
  return body
}

/** 直接发送 RFC 错误体(status 由调用方按 oauthErrorStatus 计算,避免二次映射漂移)。 */
export function oauthErrorReply(
  reply: FastifyReply,
  status: number,
  error: OAuthErrorCode,
  errorDescription?: string,
  errorUri?: string | null,
): FastifyReply {
  return reply
    .status(status)
    .type('application/json')
    .send(buildOAuthErrorBody(error, status, errorDescription, errorUri))
}

/**
 * 解析并校验请求里的 `error_uri` 候选值:
 * 只有服务端自己登记的文档链接才可能进来(绝不取请求参数),故这里只查白名单一次。
 */
export function sanitizeErrorUri(candidate: string | null | undefined, issuer: string): string | null {
  return isSafeExternalUrl(candidate, allowedErrorUriHosts(issuer))
}

/**
 * 生成一次错误响应的 `error_uri`(RFC 6749 §5.2 可选字段)。
 *
 * 候选值全部由服务端配置拼出(`OAUTH_ERROR_URI_BASE` > issuer 自身文档路径),
 * **绝不**从请求参数取值;拼完仍要过一遍白名单 —— 配置写错(如指到外域)时
 * 宁可少一个字段,也不能把钓鱼链接送到第三方客户端的渲染面上。
 */
export function errorUriFor(issuer: string, error: OAuthErrorCode): string | null {
  const base = config.OAUTH_ERROR_URI_BASE.trim()
  const candidate = base ? `${base.replace(/\/+$/, '')}#${error}` : `${issuer}/docs/oauth-errors#${error}`
  return sanitizeErrorUri(candidate, issuer)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
