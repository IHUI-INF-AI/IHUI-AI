// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Grok Bot(SpaceXAI/xAI 常驻 Agent,Meta Muse 的对标)上游适配器(2026-10-27 立)。
 * 与 Grok Build CLI 是两条产品线,本适配器只服务常驻 Agent 号池。
 *
 * 上游协议要点(§0.3 如实声明:Grok Bot **无公开 API 文档**,以下为合理推断,集成后按实测修正):
 * - 端点:POST /v1/chat/completions,base 取 https://api.x.ai(xAI 公开 API 域,
 *   OpenAI 兼容面推断);改端点只改常量区。
 * - 鉴权:Authorization: Bearer <token>(推断)。本机 ~/.grokbot 的 daemon 凭证为
 *   sandSealedFile 密封串(密封方案未公开)⇒ 解封交服务端/后续取证,适配器只认
 *   ctx.credentials.token(§0.6 零映射)。
 * - 走 SuperGrok/Cursor 套餐,国际产品,无国内分线。
 * - 余额/配额:SuperGrok 套餐配额无公开查询端点 ⇒ getQuota 如实未判定,不发请求。
 * - 刷新:无公开续期协议 ⇒ 不实现 refreshToken;401 自愈后由人工重导补票。
 *
 * 错误面:HTTP 层 401/403 直接判鉴权失效;OpenAI 形 {"error":{...}} 帧(含 HTTP 200)
 * 识别为错误帧,不得当成功。degrade 纪律:形状不符 ⇒ indeterminate(不冒绿、不误杀好号)。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { RelayProviderCode } from '../relay-account-format.js'
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

// =============================================================================
// 端点与常量(改端点只改这里;当前为合理推断,实测后修正)
// =============================================================================

/** xAI 公开 API 域(推断;Grok Bot 常驻 Agent 未公开自有网关) */
const GROKBOT_API_BASE = 'https://api.x.ai'
const CHAT_PATH = '/v1/chat/completions'
const MODELS_PATH = '/v1/models'

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;对齐 codearts-adapter 同款做法)
// =============================================================================

/** proxyUrl → ProxyAgent 进程内缓存(每账号代理一个连接池,避免重复建 agent) */
const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  const dispatcher = agent
  // 必须用 npm undici 自身的 fetch:Node 内置 fetch 与 npm undici 的 Dispatcher 不互通
  return ((input: string | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      {
        ...(init ?? {}),
        dispatcher,
      } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

/** 优先级:opts.fetchImpl(测试打桩)> opts.proxyUrl(账号级代理)> 全局直连 */
function resolveFetchImpl(opts: AdapterCallOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

// =============================================================================
// 凭证读取(零映射:适配器只认 token;密封包拆分交服务端单一映射)
// =============================================================================

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 常驻 Agent 登录态 token;缺 token 抛错(该账号不可转发,由链路层摘除) */
function readToken(ctx: AdapterAccountContext): string {
  const token = str(ctx.credentials.token)
  if (!token) {
    throw new Error(
      'grokbot 账号缺少 token(tokenEnc 未导入或未解密;daemon 凭证为 sandSealedFile 密封串,解封后入库)',
    )
  }
  return token
}

// =============================================================================
// chat 请求构造(Bearer + body 透传)
// =============================================================================

function buildChatRequest(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
): UpstreamHttpRequest {
  const token = readToken(ctx)
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
  if (req.stop !== undefined) body['stop'] = req.stop
  if (typeof req.presencePenalty === 'number') body['presence_penalty'] = req.presencePenalty
  if (typeof req.frequencyPenalty === 'number') body['frequency_penalty'] = req.frequencyPenalty
  if (req.user !== undefined) body['user'] = req.user
  const rawBody = JSON.stringify(body)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: req.stream ? 'text/event-stream' : 'application/json',
    authorization: `Bearer ${token}`,
  }
  return { url: `${GROKBOT_API_BASE}${CHAT_PATH}`, method: 'POST', headers, rawBody }
}

// =============================================================================
// 流式/非流式翻译(推断上游为原生 OpenAI SSE,帧 JSON 原样透传)
// =============================================================================

/** 错误帧识别:{"error":{code?,message?}}(OpenAI 形,HTTP 200 也可能出现)→ 终止帧 */
function extractErrorFrame(rec: Record<string, unknown>): TranslatedChunk | null {
  const err = rec['error']
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const e = err as Record<string, unknown>
    const code = typeof e['code'] === 'string' ? e['code'] : 'upstream_error'
    const message = typeof e['message'] === 'string' ? e['message'] : ''
    return { openaiChunk: { error: { code, message, type: 'upstream_error' } }, done: true }
  }
  return null
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
      const e = err.openaiChunk['error'] as { code: string; message: string }
      throw new Error(`grokbot 上游业务错误 ${e.code}: ${e.message}`)
    }
  }
  return responseBody as Record<string, unknown>
}

// =============================================================================
// 健康检查与模型清单(GET /v1/models,轻量不耗配额)
// =============================================================================

/** 构造并发起 models GET;返回解析后的 JSON 对象(非 2xx/解析失败/非对象抛错) */
async function fetchModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<Record<string, unknown>> {
  const token = readToken(ctx)
  const url = `${GROKBOT_API_BASE}${MODELS_PATH}`
  const res = await resolveFetchImpl(opts ?? {})(url, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error(`响应解析失败: ${text.slice(0, 200)}`)
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('响应形状非法')
  return obj as Record<string, unknown>
}

/**
 * 三态健康检查(契约语义):ok / ok:false+indeterminate(5xx/网络/形状不符,不写 down)/
 * ok:false+authFailed(401/403,明确拒收)。形状不符点名「未判定」,不冒绿。
 */
async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    const json = await fetchModels(ctx, opts)
    if (!Array.isArray(json['data'])) {
      return {
        ok: false,
        indeterminate: true,
        error: '模型清单响应缺少 data 数组(形状不符 ⇒ 未判定;grokbot 无公开 API 文档,以实测为准)',
      }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const m = msg.match(/^HTTP\s+(\d{3})/)
    const status = m ? Number(m[1]) : 0
    if (status === 401 || status === 403) return { ok: false, authFailed: true, error: msg }
    if (status === 0 || status >= 500) return { ok: false, indeterminate: true, error: msg }
    return { ok: false, error: msg }
  }
}

/** 模型列表(推断 {data:[{id}]} OpenAI 形状;id 非字符串的项跳过) */
async function listModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<string[]> {
  const json = await fetchModels(ctx, opts)
  const models = Array.isArray(json['data']) ? json['data'] : []
  const out: string[] = []
  for (const m of models) {
    if (!m || typeof m !== 'object') continue
    const id = (m as Record<string, unknown>)['id']
    if (typeof id === 'string' && id !== '') out.push(id)
  }
  return out
}

// =============================================================================
// 认证失败判定
// =============================================================================

/** 常见鉴权失效文案标记(小写比对) */
const AUTH_BODY_MARKERS = [
  'unauthorized',
  'invalid api key',
  'invalid_api_key',
  'missing api key',
  'authentication failed',
  'token expired',
]
/** token 失效类短语("The token has expired" 等) */
const TOKEN_BAD_RE = /token.{0,40}(expired|invalid)/i

/**
 * 401/403,或响应体带鉴权失效文案 → true(forwarder 的 401 自愈依赖判真)。
 * 429/5xx/参数错一律 false。
 */
function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  const lower = bodyText.toLowerCase()
  if (AUTH_BODY_MARKERS.some((m) => lower.includes(m))) return true
  return TOKEN_BAD_RE.test(bodyText)
}

/** 异常形态判定(message 里的 "HTTP 401/403" 还原成状态码判定) */
function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const m = message.match(/HTTP\s+(\d{3})/i)
  const status = m ? Number(m[1]) : 0
  return isAuthFailure(status, message)
}

// =============================================================================
// 富错误分级(转发层据此决定罚不罚号、罚多久)
// =============================================================================

/** 额度/套餐耗尽类文案(SuperGrok 套餐面;剔除裸 insufficient 防误判) */
const CREDIT_RE =
  /(套餐|额度|余额不足|insufficient (quota|credit|balance)|quota exceeded|out of credit|payment required)/i

/**
 * 错误分级:429 → rate(退避不罚号);402/额度套餐文案 → credit;
 * 401/403 与鉴权文案 → auth(401 自愈);404 → not_found;5xx → server;其他 4xx → client。
 */
function classifyUpstreamFailure(
  statusCode: number,
  bodyText: string,
): {
  kind: 'auth' | 'credit' | 'session_dead' | 'rate' | 'not_found' | 'request' | 'server' | 'client'
} {
  if (statusCode === 429) return { kind: 'rate' }
  if (statusCode === 402 || CREDIT_RE.test(bodyText)) return { kind: 'credit' }
  if (isAuthFailure(statusCode, bodyText)) return { kind: 'auth' }
  if (statusCode === 404) return { kind: 'not_found' }
  if (statusCode >= 500) return { kind: 'server' }
  if (statusCode >= 400) return { kind: 'client' }
  return { kind: 'client' }
}

// =============================================================================
// 余额/配额(§0.3 如实未判定:无公开端点,不发请求不猜字段)
// =============================================================================

/**
 * SuperGrok/Cursor 套餐配额**无公开查询端点** ⇒ 永远 ok:false + 未判定点名,
 * 不发请求、不猜字段。
 */
async function getQuota(
  _ctx: AdapterAccountContext,
  _opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  return {
    ok: false,
    error:
      'Grok Bot(SuperGrok/Cursor 套餐)无公开余额/配额查询端点(2026-10-27 取证) ⇒ 未判定(未发请求,不猜字段)',
  }
}

// =============================================================================
// 导出
// =============================================================================

export const grokbotAdapter: RelayUpstreamAdapter = {
  // 集成点:RELAY_PROVIDERS(relay-account-format.ts)尚未收录 'grokbot',由主会话统一补入;
  // 收录后此断言可删,providerCode 直接写字面量。
  providerCode: 'grokbot' as unknown as RelayProviderCode,
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  checkHealth,
  getQuota,
  listModels,
  isAuthFailure,
  isAuthError,
  classifyUpstreamFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
