// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Codex(OpenAI Codex CLI)上游适配器(2026-10-27 立)。
 *
 * 平台说明:**国际产品,无国内/国际分线**(chatgpt.com 单线,导入面无需区分站点点位)。
 *
 * 上游协议要点(出处:openai/codex 公开文档与仓库;端点/形状**未实弹取证** —— 本机
 * %USERPROFILE%\.codex 无 auth.json,以实弹抓包复核为准,§0.3 未判定处均已点名):
 * - ChatGPT 登录态走 chatgpt.com backend-api,POST {BACKEND}/codex/responses,
 *   OpenAI **Responses API** 形状(model/input/stream),store:false 不留副本;
 * - 鉴权:Bearer access_token(auth.json tokens.access_token)+ chatgpt-account-id 头;
 * - access token 90 天,CLI 到期前自动刷新;但 refresh 端点/客户端参数未实证 ⇒
 *   **不实现 refreshToken**(宁缺勿猜,401 自愈由承载层按 isAuthFailure 落 down)。
 *
 * 凭证映射(服务端导入层负责,本文件只读):tokenEnc←tokens.access_token;
 * refreshTokenEnc←tokens.refresh_token;secretsEnc←JSON{accountId}(tokens.account_id)。
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

// =============================================================================
// 端点与常量(改端点只改这里)
// =============================================================================

const CHATGPT_BACKEND = 'https://chatgpt.com/backend-api'
const CHAT_URL = `${CHATGPT_BACKEND}/codex/responses`
/** 已认证身份探测端点(chatgpt web 同源;形状未实证,仅用于鉴权判定) */
const IDENTITY_URL = `${CHATGPT_BACKEND}/me`

// =============================================================================
// secrets 读取
// =============================================================================

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** account_id 非密钥(会随 tokens raw 直通入库),缺省不带头(上游可能拒绝,由健康检查暴露) */
function readAccountId(ctx: AdapterAccountContext): string {
  return str(ctx.credentials.secrets['accountId'])
}

// =============================================================================
// chat 请求构造(Responses API 形状;body 键按公开文档写实)
// =============================================================================

/** OpenAI chat 消息 → Responses input item(content 非字符串时 JSON 串化,不做深度翻译) */
function toInputItem(m: { role: string; content: unknown }): Record<string, unknown> {
  const text = typeof m.content === 'string' ? m.content : (JSON.stringify(m.content) ?? '')
  const itemType = m.role === 'assistant' ? 'output_text' : 'input_text'
  return { type: 'message', role: m.role, content: [{ type: itemType, text }] }
}

function buildChatRequest(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
): UpstreamHttpRequest {
  const body: Record<string, unknown> = {
    model: req.model,
    input: req.messages.map(toInputItem),
    stream: req.stream,
    store: false, // ChatGPT backend 不落会话副本(Codex CLI 同款)
  }
  if (typeof req.temperature === 'number') body['temperature'] = req.temperature
  if (typeof req.topP === 'number') body['top_p'] = req.topP
  if (typeof req.maxTokens === 'number') body['max_output_tokens'] = req.maxTokens
  if (req.tools !== undefined) body['tools'] = req.tools
  if (req.toolChoice !== undefined) body['tool_choice'] = req.toolChoice
  if (req.parallelToolCalls !== undefined) body['parallel_tool_calls'] = req.parallelToolCalls
  if (typeof req.reasoningEffort === 'string') body['reasoning'] = { effort: req.reasoningEffort }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: req.stream ? 'text/event-stream' : 'application/json',
    authorization: `Bearer ${ctx.credentials.token}`,
    // Codex CLI 身份头(公开仓库 originator 常量;形状未实证,抓包复核后可调)
    originator: 'codex_cli_rs',
  }
  const accountId = readAccountId(ctx)
  if (accountId) headers['chatgpt-account-id'] = accountId
  return { url: CHAT_URL, method: 'POST', headers, body }
}

// =============================================================================
// 流式/非流式翻译(上游为 Responses API SSE 事件帧;事件名按公开文档,未实弹复核)
// =============================================================================

/**
 * Responses SSE → OpenAI chunk 的最小映射(事件名来自 OpenAI Responses API 公开文档):
 * - response.output_text.delta → delta.content 文本帧
 * - response.completed → usage 终帧(done)
 * - response.failed / error → 终止失败帧
 * 认不出的帧一律忽略(null)—— 不猜帧形,宁丢帧不编帧。
 */
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
  const type = typeof rec['type'] === 'string' ? rec['type'] : ''
  if (type === 'response.output_text.delta' && typeof rec['delta'] === 'string') {
    return {
      openaiChunk: {
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { content: rec['delta'] }, finish_reason: null }],
      },
    }
  }
  if (type === 'response.completed') {
    const response = rec['response'] as Record<string, unknown> | undefined
    const usage = response && typeof response === 'object' ? response['usage'] : undefined
    return {
      openaiChunk: {
        object: 'chat.completion.chunk',
        choices: [],
        ...(usage && typeof usage === 'object' ? { usage } : {}),
      },
      done: true,
    }
  }
  if (type === 'response.failed' || type === 'error' || rec['error'] !== undefined) {
    const err = rec['error'] as Record<string, unknown> | undefined
    return {
      openaiChunk: {
        error: {
          code: type || 'upstream_error',
          message: err && typeof err === 'object' ? String(err['message'] ?? '') : type,
          type: 'upstream_error',
        },
      },
      done: true,
    }
  }
  return null
}

/**
 * 上游 error 对象 → 有界描述(该文案会进持久记录:字符串按码点截断、数组只报条数、
 * 其余只报类型/键数,绝不把整块对象 JSON 展开进去)。
 */
function describeUpstreamError(err: Record<string, unknown>): string {
  const msg = err['message']
  if (typeof msg === 'string') return Array.from(msg).slice(0, 200).join('')
  if (Array.isArray(msg)) return `array (${msg.length} items)`
  if (msg !== undefined) return typeof msg
  return `object(keys=${Object.keys(err).length})`
}

/** Responses 非流式响应 → 最小 OpenAI completion;认不出形状 ⇒ 抛错未判定(不编造) */
function translateNonStream(
  _ctx: AdapterAccountContext,
  responseBody: unknown,
): Record<string, unknown> {
  if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
    throw new Error('Codex 上游响应形状非法 ⇒ 未判定')
  }
  const rec = responseBody as Record<string, unknown>
  if (rec['error'] !== undefined) {
    const err = rec['error'] as Record<string, unknown>
    throw new Error(`Codex 上游业务错误: ${describeUpstreamError(err)}`)
  }
  const output = Array.isArray(rec['output']) ? rec['output'] : null
  if (!output) {
    throw new Error(
      `Codex 上游响应缺 output 数组(键=[${Object.keys(rec).join(',')}])⇒ 未判定(不猜字段)`,
    )
  }
  let text = ''
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (o['type'] !== 'message') continue
    const content = Array.isArray(o['content']) ? o['content'] : []
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as Record<string, unknown>)['type'] === 'output_text'
      ) {
        text += String((part as Record<string, unknown>)['text'] ?? '')
      }
    }
  }
  return {
    id: typeof rec['id'] === 'string' ? rec['id'] : '',
    object: 'chat.completion',
    model: typeof rec['model'] === 'string' ? rec['model'] : '',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    ...(rec['usage'] && typeof rec['usage'] === 'object' ? { usage: rec['usage'] } : {}),
  }
}

// =============================================================================
// 健康检查 / 余额(探测已认证身份端点;形状未实证 ⇒ 200 也未判定)
// =============================================================================

interface ProbeResult {
  status: number
  bodyKeys: string[]
  networkError?: string
}

async function probeIdentity(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<ProbeResult> {
  const fetchImpl = opts?.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${ctx.credentials.token}`,
  }
  const accountId = readAccountId(ctx)
  if (accountId) headers['chatgpt-account-id'] = accountId
  try {
    const res = await fetchImpl(IDENTITY_URL, { method: 'GET', headers })
    const text = await res.text().catch(() => '')
    let keys: string[] = []
    try {
      const obj: unknown = JSON.parse(text)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        keys = Object.keys(obj as Record<string, unknown>)
      }
    } catch {
      /* 非 JSON 也如实报 */
    }
    return { status: res.status, bodyKeys: keys }
  } catch (e) {
    return { status: 0, bodyKeys: [], networkError: e instanceof Error ? e.message : String(e) }
  }
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  const probe = await probeIdentity(ctx, opts)
  if (probe.networkError !== undefined) {
    return { ok: false, indeterminate: true, error: `探测网络异常: ${probe.networkError}(未判定)` }
  }
  if (probe.status === 401 || probe.status === 403) {
    return { ok: false, authFailed: true, error: `探测 HTTP ${probe.status}:上游明确拒收凭据` }
  }
  if (probe.status >= 200 && probe.status < 300) {
    // 通过鉴权但身份/可用性形状未实证 ⇒ 不冒绿,保留 unknown 待实弹取证后补判定
    return {
      ok: false,
      indeterminate: true,
      error: `探测端点 200,响应键=[${probe.bodyKeys.join(',') || '(空)'}],形状未实证 ⇒ 未判定`,
    }
  }
  return { ok: false, indeterminate: true, error: `探测 HTTP ${probe.status}(未判定)` }
}

/**
 * 余额点查(§0.3 如实未判定):Codex **无公开额度端点**(ChatGPT 订阅额度无编程查询面),
 * 只探测鉴权:实测 401/403 则 authFailed(承载层据此收敛);其余一律未判定,绝不编数字。
 */
async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  const probe = await probeIdentity(ctx, opts)
  if (probe.networkError !== undefined) {
    return { ok: false, error: `无公开额度端点;探测网络异常: ${probe.networkError} ⇒ 未判定` }
  }
  if (probe.status === 401 || probe.status === 403) {
    return {
      ok: false,
      authFailed: true,
      error: `无公开额度端点;凭证实测 HTTP ${probe.status} 被拒 ⇒ authFailed`,
    }
  }
  return {
    ok: false,
    error: `无公开额度端点 ⇒ 未判定(探测 HTTP ${probe.status},不猜额度字段读成数字)`,
  }
}

// =============================================================================
// 认证失败判定
// =============================================================================

/** 常见认证失效文案标记(Bearer 过期/被吊销的典型响应;大小写不敏感子串) */
const AUTH_BODY_MARKERS = [
  'unauthorized',
  'invalid_token',
  'invalid token',
  'token expired',
  'token has expired',
  'session expired',
  'please sign in',
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

// 注:'codex' 尚未列入 relay-account-format.ts 的 RELAY_PROVIDERS(共享文件,主会话统一集成
// 时加入);此处 cast 保持 RelayUpstreamAdapter 契约形状,集成后即可去掉。
export const codexAdapter: RelayUpstreamAdapter = {
  providerCode: 'codex' as RelayProviderCode,
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  checkHealth,
  getQuota,
  isAuthFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
