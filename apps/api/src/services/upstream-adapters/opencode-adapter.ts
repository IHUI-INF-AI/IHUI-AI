// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenCode(sst/opencode)上游适配器(2026-10-27 立)。
 *
 * 平台说明:**国际产品,无国内/国际分线**(无站点点位区分,导入面同线)。
 *
 * 上游协议要点(出处:sst/opencode 公开文档;端点形状**未实弹取证**,§0.3 处均已点名):
 * - OpenCode 本体是 provider 聚合客户端:auth.json 每个 providerID 存 { type: "oauth"|"api",
 *   key/access/refresh/… },号池导入哪个 provider 的凭据,chat 面就用哪个凭据打该 provider
 *   的网关;OpenCode Zen 官方网关(OpenAI chat.completions 兼容形状)按公开文档写实,
 *   端点/路径未实弹复核前不冒绿;
 * - 鉴权:Bearer(type:"api" 用 key;type:"oauth" 用 access token —— 由服务端导入映射层
 *   决定哪个字段落 tokenEnc,本适配器只读 ctx.credentials.token);
 * - OAuth refresh 端点/客户端参数未实证 ⇒ **不实现 refreshToken**(宁缺勿猜,
 *   401 自愈由承载层按 isAuthFailure 落 down)。
 *
 * 凭证映射(服务端导入层负责,本文件只读):tokenEnc←auth.key 或 auth.access(按 type);
 * refreshTokenEnc←auth.refresh;secretsEnc←JSON{providerID, authType}。
 */
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import type { RelayProviderCode } from '../relay-account-format.js'
import { normalizeStopSequences } from '../relay-upstream-adapters.js'

// =============================================================================
// 端点与常量(改端点只改这里)
// =============================================================================

/** OpenCode Zen 官方网关(OpenAI chat.completions 兼容;路径未实弹复核,抓包后可调) */
const CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions'

// =============================================================================
// chat 请求构造(OpenAI 兼容形状,body 透传)
// =============================================================================

function buildChatRequest(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
): UpstreamHttpRequest {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream,
  }
  if (typeof req.temperature === 'number') body['temperature'] = req.temperature
  if (typeof req.topP === 'number') body['top_p'] = req.topP
  if (typeof req.maxTokens === 'number') body['max_tokens'] = req.maxTokens
  if (req.tools !== undefined) body['tools'] = req.tools
  if (req.toolChoice !== undefined) body['tool_choice'] = req.toolChoice
  if (req.responseFormat !== undefined) body['response_format'] = req.responseFormat
  if (req.seed !== undefined) body['seed'] = req.seed
  const stop = normalizeStopSequences(req.stop)
  if (stop) body['stop'] = stop
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: req.stream ? 'text/event-stream' : 'application/json',
    authorization: `Bearer ${ctx.credentials.token}`,
  }
  return { url: CHAT_URL, method: 'POST', headers, body }
}

// =============================================================================
// 流式/非流式翻译(上游 OpenAI 兼容,帧 JSON 原样透传;error 帧识别为终止失败)
// =============================================================================

/** {"error":…} 帧(HTTP 200 也可能带):识别为终止帧,由转发层转成失败,不得当成功 */
function extractErrorFrame(obj: Record<string, unknown>): TranslatedChunk | null {
  const err = obj['error']
  if (err === undefined || err === null) return null
  const message =
    err && typeof err === 'object'
      ? String((err as Record<string, unknown>)['message'] ?? '')
      : String(err)
  return {
    openaiChunk: { error: { message, type: 'upstream_error' } },
    done: true,
  }
}

function translateStreamChunk(
  _ctx: AdapterAccountContext,
  rawFrame: string,
  _state: StreamState,
): TranslatedChunk | null {
  let s = rawFrame.trim()
  if (s.startsWith('data:')) s = s.slice(5).trim()
  if (!s || s === '[DONE]') return null // [DONE] 由转发层统一补发
  let obj: unknown
  try {
    obj = JSON.parse(s)
  } catch {
    return null // 心跳/注释等非 JSON 帧:忽略
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const rec = obj as Record<string, unknown>
  return extractErrorFrame(rec) ?? { openaiChunk: rec }
}

function translateNonStream(
  _ctx: AdapterAccountContext,
  responseBody: unknown,
): Record<string, unknown> {
  if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
    const rec = responseBody as Record<string, unknown>
    const err = extractErrorFrame(rec)
    if (err) {
      const e = err.openaiChunk['error'] as { message: string }
      throw new Error(`OpenCode 上游业务错误: ${e.message}`)
    }
  }
  return responseBody as Record<string, unknown>
}

// =============================================================================
// 健康检查 / 余额(无已实证端点 ⇒ 一律如实未判定,不冒绿不编数)
// =============================================================================

/**
 * 轻量健康检查(§0.3):OpenCode 无已实证的轻量探测端点 —— 唯一可打的是 chat 面,
 * 但那会消耗真实配额(健康检查纪律:不得消耗大量配额)。故不探测,回未判定保留 unknown,
 * 待实弹取证到轻量端点后补实现。
 */
async function checkHealth(
  _ctx: AdapterAccountContext,
  _opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  return {
    ok: false,
    indeterminate: true,
    error: '无已实证的轻量探测端点 ⇒ 未判定(不做会耗配额的 chat 探测)',
  }
}

/**
 * 余额点查(§0.3 如实未判定):OpenCode **无公开额度端点** —— 额度在各个底层 provider
 * (OpenAI/Anthropic/Zen…),聚合面不可查。不发请求、不编数字;凭据是否失效由
 * chat 面实测 401 时按 isAuthFailure 判定。
 */
async function getQuota(
  _ctx: AdapterAccountContext,
  _opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  return {
    ok: false,
    error: '无公开额度端点 ⇒ 未判定(额度在各底层 provider,聚合面不可查;不猜字段读成数字)',
  }
}

// =============================================================================
// 认证失败判定
// =============================================================================

/** 常见认证失效文案标记(OpenAI 兼容网关的典型 4xx 体;大小写不敏感子串) */
const AUTH_BODY_MARKERS = [
  'unauthorized',
  'invalid_api_key',
  'invalid api key',
  'invalid token',
  'token expired',
  'token has expired',
  'session expired',
  'authentication',
]

/** 非 200 HTML 登录墙(上游风控跳转登录页):识别为认证失效形态 */
function looksLikeHtmlLoginPage(bodyText: string): boolean {
  const s = bodyText.slice(0, 2048).toLowerCase()
  if (!s.includes('<html') && !s.includes('<!doctype html')) return false
  return s.includes('login') || s.includes('sign in') || s.includes('signin')
}

/**
 * 401/403,或响应体带凭证失效文案 / HTML 登录墙 → true(转发层 401 自愈依赖判真)。
 * 429 / 5xx 一律 false(临时故障,走退避)。
 */
function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  const lower = bodyText.toLowerCase()
  if (AUTH_BODY_MARKERS.some((m) => lower.includes(m))) return true
  return looksLikeHtmlLoginPage(bodyText)
}

// =============================================================================
// 导出
// =============================================================================

// 注:'opencode' 尚未列入 relay-account-format.ts 的 RELAY_PROVIDERS(共享文件,主会话
// 统一集成时加入);此处 cast 保持 RelayUpstreamAdapter 契约形状,集成后即可去掉。
export const opencodeAdapter: RelayUpstreamAdapter = {
  providerCode: 'opencode' as RelayProviderCode,
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  checkHealth,
  getQuota,
  isAuthFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
