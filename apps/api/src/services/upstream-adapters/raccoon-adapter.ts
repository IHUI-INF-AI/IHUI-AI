// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * 商汤小浣熊（Raccoon Work）上游适配器(2026-11-11 立)。
 *
 * 取证链(详见 docs/raccoon-relay-api.md,全部本机实测):
 * - 鉴权:Authorization: Bearer <JWT>(cookie 形态实证 401 AUTH_ACCESS_TOKEN_MISSING);
 * - 余额:GET /api/web/points/v1/balance → code:0 + available_points(真弹 200);
 * - 任务:GET /api/web/points/v1/tasks(真弹 200);
 * - 对话:POST /api/web/llm/v2/chat/completions —— 端点与 origin 实证(asar 字面量 +
 *   桌面启动日志),**逐帧响应形状未实弹** ⇒ translate 按 OpenAI 兼容透传,
 *   业务错误形状 {code,message} 按 IAM 实证面识别;首呼由 forwarder 真弹定形。
 * - 续期:auth.json **无 refresh_token**,/api/web/auth/v1/refresh 请求形状未实证
 *   ⇒ refreshTokenSupported:false(不进保活窗口、不因"刷新失败"被自动摘除,§0.3)。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
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

const RACCOON_API_BASE = 'https://xiaohuanxiong.com'
const CHAT_PATH = '/api/web/llm/v2/chat/completions'
const MODELS_PATH = '/api/web/llm/v2/model_catalog'
const BALANCE_PATH = '/api/web/points/v1/balance'

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;与 grokbot/codearts 同款)
// =============================================================================

const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  return ((input: string | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      { ...(init ?? {}), dispatcher: agent } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

function resolveFetchImpl(opts: AdapterCallOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function readToken(ctx: AdapterAccountContext): string {
  const token = str(ctx.credentials.token)
  if (!token) throw new Error('raccoon 账号缺少 token(auth.json access_token 未导入或未解密)')
  return token
}

// =============================================================================
// chat 请求构造(Bearer + OpenAI body 透传)
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
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: req.stream ? 'text/event-stream' : 'application/json',
    authorization: `Bearer ${token}`,
  }
  return {
    url: `${RACCOON_API_BASE}${CHAT_PATH}`,
    method: 'POST',
    headers,
    rawBody: JSON.stringify(body),
  }
}

// =============================================================================
// 流式/非流式翻译(OpenAI 兼容透传;业务错误形状 {code,message} 按 IAM 实证面识别)
// =============================================================================

/** 业务错误识别:code 非 0/OK 数字且带 message ⇒ 视为错误帧(上游两态之一) */
function businessError(rec: Record<string, unknown>): TranslatedChunk | null {
  const code = rec['code']
  const message = rec['message']
  if (typeof code === 'string' && code !== '' && code !== 'OK' && typeof message === 'string') {
    return { openaiChunk: { error: { code, message, type: 'upstream_error' } }, done: true }
  }
  if (typeof code === 'number' && code !== 0 && typeof message === 'string') {
    return {
      openaiChunk: { error: { code: String(code), message, type: 'upstream_error' } },
      done: true,
    }
  }
  return null
}

function extractErrorFrame(rec: Record<string, unknown>): TranslatedChunk | null {
  const err = rec['error']
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const e = err as Record<string, unknown>
    const code = typeof e['code'] === 'string' ? e['code'] : 'upstream_error'
    const message = typeof e['message'] === 'string' ? e['message'] : ''
    return { openaiChunk: { error: { code, message, type: 'upstream_error' } }, done: true }
  }
  return businessError(rec)
}

function translateStreamChunk(
  _ctx: AdapterAccountContext,
  rawFrame: string,
  _state: StreamState,
): TranslatedChunk | null {
  let s = rawFrame.trim()
  if (s.startsWith('data:')) s = s.slice(5).trim()
  if (!s || s === '[DONE]') return null
  let obj: unknown
  try {
    obj = JSON.parse(s)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const rec = obj as Record<string, unknown>
  const err = extractErrorFrame(rec)
  if (err) return err
  return { openaiChunk: rec }
}

function translateNonStream(
  _ctx: AdapterAccountContext,
  responseBody: unknown,
): Record<string, unknown> {
  if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
    return {
      choices: [],
      error: { code: 'bad_response_shape', message: '非对象响应 ⇒ 未判定', type: 'upstream_error' },
    }
  }
  const rec = responseBody as Record<string, unknown>
  const err = extractErrorFrame(rec)
  if (err) return err.openaiChunk
  return rec
}

// =============================================================================
// 健康检查 / 余额(balance 真弹实证端点)
// =============================================================================

async function fetchBalance(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ status: number; body: Record<string, unknown> | null; text: string }> {
  const token = readToken(ctx)
  const res = await resolveFetchImpl(opts ?? {})(`${RACCOON_API_BASE}${BALANCE_PATH}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  const text = await res.text().catch(() => '')
  let body: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>
  } catch {}
  return { status: res.status, body, text }
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    const { status, body, text } = await fetchBalance(ctx, opts)
    if (status === 401 || status === 403)
      return { ok: false, authFailed: true, error: `balance HTTP ${status}` }
    if (status >= 500 || status === 0)
      return { ok: false, indeterminate: true, error: `balance HTTP ${status}` }
    if (status !== 200) return { ok: false, error: `balance HTTP ${status}: ${text.slice(0, 160)}` }
    if (!body || typeof body['code'] !== 'number') {
      return {
        ok: false,
        indeterminate: true,
        error: 'balance 200 但形状不符(缺 code) ⇒ 未判定,不猜字段',
      }
    }
    // 业务码先判:非 0 是**明确结论**(上游自己说的),不能因为同时缺 data 就退成"未判定"
    if (Number(body['code']) !== 0) {
      return {
        ok: false,
        error: `balance 业务码 ${body['code']}: ${String(body['message'] ?? '').slice(0, 160)}`,
      }
    }
    if (!body['data']) {
      return { ok: false, indeterminate: true, error: 'balance code:0 但缺 data ⇒ 未判定,不猜字段' }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      indeterminate: true,
      error: `健康检查异常: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  try {
    const { status, body, text } = await fetchBalance(ctx, opts)
    if (status === 401 || status === 403)
      return { ok: false, authFailed: true, error: `balance HTTP ${status}` }
    if (status !== 200) return { ok: false, error: `balance HTTP ${status}: ${text.slice(0, 200)}` }
    // 业务码先判:非 0 是明确结论,不能因为同时缺 data 就退成"未判定"
    const bizCode = body?.['code']
    if (typeof bizCode === 'number' && bizCode !== 0) {
      return {
        ok: false,
        error: `balance 业务码 ${bizCode}: ${String(body?.['message'] ?? '').slice(0, 200)}`,
      }
    }
    const data = body?.['data']
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'balance 200 但 data 非对象 ⇒ 未判定(不猜字段)' }
    }
    const d = data as Record<string, unknown>
    const available = d['available_points']
    if (typeof available !== 'number' || !Number.isFinite(available)) {
      return {
        ok: false,
        error: `balance 200 但 available_points 非数字(键=[${Object.keys(d).join(',')}]) ⇒ 未判定`,
      }
    }
    const daily = typeof d['daily_points'] === 'number' ? d['daily_points'] : undefined
    const reward = typeof d['reward_points'] === 'number' ? d['reward_points'] : undefined
    const packs: NonNullable<RelayQuotaResult['quota']>['packs'] = []
    if (typeof daily === 'number') packs.push({ name: 'daily(每日登录发放)', remaining: daily })
    if (typeof reward === 'number') packs.push({ name: 'reward(任务奖励)', remaining: reward })
    return {
      ok: true,
      quota: {
        remaining: available,
        unit: '小浣熊积分 available_points',
        ...(packs.length ? { packs } : {}),
      },
    }
  } catch (e) {
    return { ok: false, error: `余额点查失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** 模型清单(GET model_catalog;响应形状未逐字段实证 ⇒ 认得出就用,认不出如实未判定) */
async function listModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<string[]> {
  const token = readToken(ctx)
  const res = await resolveFetchImpl(opts ?? {})(`${RACCOON_API_BASE}${MODELS_PATH}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  let json: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') json = parsed as Record<string, unknown>
  } catch {}
  const container =
    json && typeof json['data'] === 'object' && json['data'] !== null
      ? (json['data'] as Record<string, unknown>)
      : json
  const arr =
    container && Array.isArray(container['models'])
      ? container['models']
      : container && Array.isArray(container['data'])
        ? container['data']
        : Array.isArray(container)
          ? container
          : null
  if (!arr) {
    throw new Error(
      `HTTP 200 但清单形状未实证(键=[${container ? Object.keys(container).join(',') : '(非对象)'}]) ⇒ 未判定`,
    )
  }
  const out: string[] = []
  for (const m of arr) {
    if (!m || typeof m !== 'object') continue
    const rec = m as Record<string, unknown>
    const id =
      typeof rec['id'] === 'string'
        ? rec['id']
        : typeof rec['model_id'] === 'string'
          ? rec['model_id']
          : ''
    if (id) out.push(id)
  }
  return out
}

// =============================================================================
// 认证失败判定与错误分级
// =============================================================================

const AUTH_BODY_MARKERS = [
  'unauthorized',
  'authentication failed',
  'token expired',
  'access token missing',
  'auth_access_token_missing',
  'auth_refresh_token',
]

function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  const lower = bodyText.toLowerCase()
  return AUTH_BODY_MARKERS.some((m) => lower.includes(m))
}

function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const m = message.match(/HTTP\s+(\d{3})/i)
  const status = m ? Number(m[1]) : 0
  return isAuthFailure(status, message)
}

const CREDIT_RE =
  /(积分不足|额度不足|余额不足|insufficient (quota|credit|balance|point)|quota exceeded|out of credit|payment required)/i

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
  return { kind: 'client' }
}

// =============================================================================
// 导出
// =============================================================================

export const raccoonAdapter: RelayUpstreamAdapter = {
  providerCode: 'raccoon',
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  checkHealth,
  getQuota,
  listModels,
  isAuthFailure,
  isAuthError,
  classifyUpstreamFailure,
  // balance/tasks 真弹实证 ⇒ 余额能力为真
  quotaSupported: true,
  // 无 refresh_token 且续期请求形状未实证 ⇒ 明确不可续,调度器不得进保活窗口
  refreshTokenSupported: false,
}
