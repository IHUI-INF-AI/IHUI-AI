// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts(华为云码道)上游适配器(2026-10-22 立)。
 *
 * 上游协议要点(出处:CodeArts2API docs/UPSTREAM.md,对齐 CodeArts Agent 26.9.902):
 * - 推理端点 POST /api/v2/chat/completions 为**原生 OpenAI 格式**,body 透传;
 *   model 大小写敏感,必须与 model-id/model-name 头逐字一致(不一致报 InferHub…406)。
 * - 鉴权:STS 临时凭据(AK/SK/security_token,~2h)+ 每请求 SDK-HMAC-SHA256 签名(见 codearts-signer.ts)。
 * - 业务错误可能 HTTP 200 带 {"error_code","error_msg"} 帧,必须识别为失败。
 * - x-ot-session-id 按凭据稳定推导并复用(上游按它统计并发,每账号上限 3,超限 TM.00001041 = 临时故障)。
 * - 刷新:POST sts.cn-north-4.myhuaweicloud.com/v1/oauth2/tokens,form + DPoP(ES256 JWS);
 *   refresh_token 一次性轮转,且**整套 STS 凭据**(AK/SK/security_token)都会换新 → secrets 回写。
 *   失败不吞错:抛 CodeArtsRefreshError(带 failureKind:401/403→auth、429→rate、5xx→server、
 *   配额/积分→credit、STS5.1806/invalid_grant→session_dead);仅瞬态失败(rate/server)回退重试一次。
 *
 * 凭证映射:tokenEnc←security_token;refreshTokenEnc←refresh_token;
 * secretsEnc←JSON{accessKeyId,secretAccessKey,dpopPrivateKeyJwk,codeVerifier,clientId,domainId,userName}。
 */
import { createHash } from 'node:crypto'
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
  TokenRefreshResult,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import { buildDpopProof, randomHex, sha256Hex, signRequest } from './codearts-signer.js'

// =============================================================================
// 端点与常量(改端点只改这里)
// =============================================================================

const SNAP_HOST = 'https://snap-access.cn-north-4.myhuaweicloud.com'
const CHAT_URL = `${SNAP_HOST}/api/v2/chat/completions`
const BUILTIN_MODELS_URL = `${SNAP_HOST}/v1/model/builtin`
const STS_TOKEN_URL = 'https://sts.cn-north-4.myhuaweicloud.com/v1/oauth2/tokens'
/**
 * 限时福利余额端点(2026-10-27 取证自 codearts2api docs/reverse-engineering.md §8,
 * 逆向自 CodeArtsSpace 0.1.18:幂等,官方客户端打开模型菜单即调用;同 host 同签名,
 * 无 Agent-Type 头)。注意:CodeArts **没有**积分/套餐余额查询接口——官方明细只在
 * 控制台页 codearts.huaweicloud.com/portal/settings/personal-usage(免费额度按月
 * 重置,滑动窗口限流见官方 FAQ),本端点只覆盖限时福利 token 余额。
 */
const BENEFIT_BALANCE_URL = 'https://opengw.developer.huaweicloud.com/api/v1/user/tokens/balance'
/** OAuth 客户端标识(= 桌面端 product.json 的 urlProtocol);secrets 缺省时兜底 */
const DEFAULT_CLIENT_ID = 'codearts-agent'
const PLUGIN_VERSION = '26.9.902'

/** 凭证失效类错误码(触发 401 自愈路径) */
const AUTH_FAILURE_CODES = ['APIG.0301', 'APIG.0303', 'STS5.1804', 'STS5.1806']

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;对齐 trae-adapter 同款做法)
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
  // 必须用 npm undici 自身的 fetch:Node 内置 fetch 与 npm undici 的 Dispatcher 不互通(见 utils/proxy-dispatcher.ts 同款教训)
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
// secrets 读取
// =============================================================================

interface CodeArtsSecrets {
  accessKeyId: string
  secretAccessKey: string
  dpopPrivateKeyJwk: Record<string, unknown> | null
  codeVerifier: string
  clientId: string
  domainId: string
  userName: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 从解密后的 secrets 包提取 CodeArts 凭据;缺 AK/SK 抛错(该账号不可转发,由链路层摘除) */
function readSecrets(ctx: AdapterAccountContext): CodeArtsSecrets {
  const s = ctx.credentials.secrets
  const accessKeyId = str(s['accessKeyId'])
  const secretAccessKey = str(s['secretAccessKey'])
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('CodeArts 账号缺少 accessKeyId/secretAccessKey(secretsEnc 未导入或未解密)')
  }
  const jwk = s['dpopPrivateKeyJwk']
  return {
    accessKeyId,
    secretAccessKey,
    dpopPrivateKeyJwk:
      jwk && typeof jwk === 'object' && !Array.isArray(jwk)
        ? (jwk as Record<string, unknown>)
        : null,
    codeVerifier: str(s['codeVerifier']),
    clientId: str(s['clientId']) || DEFAULT_CLIENT_ID,
    domainId: str(s['domainId']),
    userName: str(s['userName']),
  }
}

/**
 * x-ot-session-id:ses_<sha256(domainId|AK) 前 32 位>。
 * 必须按凭据**稳定推导复用**(上游按它统计并发,每账号上限 3;每请求随机会立刻打爆 TM.00001041),
 * 凭据轮换(AK 变化)后自然换新。
 */
function deriveSessionId(domainId: string, accessKeyId: string): string {
  return `ses_${createHash('sha256').update(`${domainId}|${accessKeyId}`).digest('hex').slice(0, 32)}`
}

// =============================================================================
// chat 请求构造(含签名)
// =============================================================================

/** 组装推理请求的静态身份头(实测清单,26.9.902 对齐)。 */
function buildIdentityHeaders(model: string, sessionId: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'text/event-stream',
    'plugin-name': 'codemate_vscode',
    'plugin-version': PLUGIN_VERSION,
    'ide-name': 'VSCode',
    'ide-version': PLUGIN_VERSION,
    'app-id': 'CodeAgent3.0',
    'X-Language': 'zh-cn',
    'x-ot-client-type': 'IDE',
    'x-ot-client-version': PLUGIN_VERSION,
    'x-ot-function': 'agent-general',
    'x-ot-session-id': sessionId,
    'x-ot-parent-session-id': '',
    'x-ot-trace-id': randomHex(16), // 32 hex
    'x-ot-span-id': randomHex(8), // 16 hex
    'user-msg-id': `msg_${randomHex(12)}`, // 24 hex
    'created-time': new Date().toISOString(),
    is_confidential: 'false',
    // model-id/model-name 必须与 body.model 逐字一致(大小写敏感,不一致报 InferHub…406)
    'model-id': model,
    'model-name': model,
  }
}

function buildChatRequest(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
): UpstreamHttpRequest {
  const secrets = readSecrets(ctx)
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream,
  }
  if (typeof req.temperature === 'number') body['temperature'] = req.temperature
  if (typeof req.maxTokens === 'number') body['max_tokens'] = req.maxTokens
  // function-calling 透传(上游原生 OpenAI 形状,原样带入;签名基于同一 rawBody 字节,不受影响)
  if (req.tools !== undefined) body['tools'] = req.tools
  if (req.toolChoice !== undefined) body['tool_choice'] = req.toolChoice
  // OpenAI 兼容面透传:JSON mode / 确定性采样
  if (req.responseFormat !== undefined) body['response_format'] = req.responseFormat
  if (req.seed !== undefined) body['seed'] = req.seed
  // 签名与发送必须是**同一串字节**,所以固定用 rawBody 字符串透传
  const rawBody = JSON.stringify(body)
  const sessionId = deriveSessionId(secrets.domainId, secrets.accessKeyId)
  const headers = buildIdentityHeaders(req.model, sessionId)
  headers['X-Sdk-Content-Sha256'] = sha256Hex(rawBody)

  const signed = signRequest({
    accessKeyId: secrets.accessKeyId,
    secretAccessKey: secrets.secretAccessKey,
    securityToken: ctx.credentials.token,
    method: 'POST',
    url: CHAT_URL,
    body: rawBody,
    headers,
  })
  return { url: CHAT_URL, method: 'POST', headers: signed, rawBody }
}

// =============================================================================
// 流式/非流式翻译(上游即原生 OpenAI SSE,帧 JSON 原样透传)
// =============================================================================

/**
 * 业务错误帧识别:HTTP 200 也可能带 {"error_code","error_msg"}(如 4005 不支持的模型、
 * TM.00001041 并发超限)。识别为终止帧 + error 信息,由转发层转成失败,不得当成功。
 */
function extractErrorFrame(obj: Record<string, unknown>): TranslatedChunk | null {
  const code = obj['error_code']
  if (typeof code !== 'string' || !code) return null
  const msg = typeof obj['error_msg'] === 'string' ? obj['error_msg'] : ''
  return {
    openaiChunk: { error: { code, message: msg, type: 'upstream_error' } },
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
      const e = err.openaiChunk['error'] as { code: string; message: string }
      throw new Error(`CodeArts 上游业务错误 ${e.code}: ${e.message}`)
    }
  }
  return responseBody as Record<string, unknown>
}

// =============================================================================
// token 刷新(OAuth2 + DPoP;整套 STS 凭据轮转)
// =============================================================================

/** 刷新响应信封(对字段位置保持宽容:顶层或 result 包一层) */
interface RefreshEnvelope {
  user_id?: string
  user_name?: string
  domain_id?: string
  refresh_token?: string
  credentials?: {
    access_key_id?: string
    secret_access_key?: string
    security_token?: string
    expiration?: string
  }
  result?: {
    refresh_token?: string
    credentials?: RefreshEnvelope['credentials']
  }
  error?: string
  error_description?: string
  error_code?: string
}

/** 刷新失败分类(与 classifyUpstreamFailure 同一套语义) */
export type CodeArtsRefreshFailureKind =
  'auth' | 'credit' | 'session_dead' | 'rate' | 'server' | 'client'

/**
 * 刷新失败的结构化抛错:不吞错,保留 failureKind 与 HTTP 状态码,
 * 供 isAuthError 判定与调度器/转发层正确分级(401/403→auth、429→rate、5xx→server、
 * 配额/积分→credit、STS5.1806/invalid_grant→session_dead)。
 */
export class CodeArtsRefreshError extends Error {
  readonly failureKind: CodeArtsRefreshFailureKind
  readonly statusCode: number
  constructor(kind: CodeArtsRefreshFailureKind, statusCode: number, message: string) {
    super(message)
    this.name = 'CodeArtsRefreshError'
    this.failureKind = kind
    this.statusCode = statusCode
  }
}

/** refresh_token 报废类标记(小写子串):重试无意义,直接抛 */
const REFRESH_DEAD_MARKERS = ['sts5.1806', 'invalid_grant', 'already used']
/** 凭证失效类标记:重新登录/刷新可救 */
const REFRESH_AUTH_MARKERS = ['sts5.1804', 'apig.0301', 'apig.0303']
/** 额度/积分/欠费类文案(剔除裸 insufficient/balance,防 "Insufficient privileges" 误判) */
const REFRESH_CREDIT_RE =
  /(欠费|额度|积分|余额不足|insufficient (credit|balance|quota)|quota exceeded|out of credit|payment required|\bcredit\b)/i

/** 刷新响应/异常 → failureKind:dead→session_dead,auth 码/401/403/登录墙→auth,429→rate,5xx→server,额度→credit,其余→client */
function classifyRefreshFailure(status: number, text: string): CodeArtsRefreshFailureKind {
  const lower = text.toLowerCase()
  if (REFRESH_DEAD_MARKERS.some((m) => lower.includes(m))) return 'session_dead'
  if (
    REFRESH_AUTH_MARKERS.some((m) => lower.includes(m)) ||
    status === 401 ||
    status === 403 ||
    looksLikeHtmlLoginPage(text)
  )
    return 'auth'
  if (status === 429) return 'rate'
  if (status >= 500) return 'server'
  if (status === 402 || REFRESH_CREDIT_RE.test(text)) return 'credit'
  return 'client'
}

/** 单次刷新尝试(每次全新 DPoP proof,jti 防重放);失败抛 CodeArtsRefreshError,message 不带凭证 */
async function attemptRefresh(
  fetchImpl: typeof fetch,
  secrets: CodeArtsSecrets,
  dpopPrivateKeyJwk: Record<string, unknown>,
  refreshTokenOld: string,
): Promise<TokenRefreshResult> {
  const proof = buildDpopProof(dpopPrivateKeyJwk, { htm: 'POST', htu: STS_TOKEN_URL })
  // form 体键序与 Go url.Values.Encode() 一致(字典序),纯离线构造便于测试桩
  const form = new URLSearchParams({
    client_id: secrets.clientId,
    code_verifier: secrets.codeVerifier,
    grant_type: 'refresh_token',
    refresh_token: refreshTokenOld,
  })
  // STS 刷新与 chat 走同一出口 IP(账号级代理),防上游风控因 IP 漂移触发额外校验
  let res: Response
  try {
    res = await fetchImpl(STS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        DPoP: proof,
      },
      body: form.toString(),
    })
  } catch (e) {
    // 网络异常 = 上游瞬态故障(server),可回退重试一次;message 只带异常名
    throw new CodeArtsRefreshError(
      'server',
      0,
      `CodeArts 续期请求失败: 网络异常 ${e instanceof Error ? e.name : String(e)}`,
    )
  }
  const text = await res.text().catch(() => '')
  let env: RefreshEnvelope
  try {
    env = JSON.parse(text) as RefreshEnvelope
  } catch {
    // 解析失败(常见为风控 HTML 登录墙):按响应体+状态分类,message 不带原文防凭证泄漏
    throw new CodeArtsRefreshError(
      classifyRefreshFailure(res.status, text),
      res.status,
      `CodeArts 续期响应解析失败 HTTP ${res.status}`,
    )
  }
  const creds = env.credentials ?? env.result?.credentials
  const newRefresh = env.refresh_token ?? env.result?.refresh_token ?? ''
  if (res.status >= 400 || !creds?.access_key_id || !creds.security_token) {
    // STS5.1806(refresh_token 已被使用)/ STS5.1804(过期)/ invalid_grant → 凭证报废;
    // detail 只取 error 字段(不回落原始 body,防凭证进 message),分类仍用全文
    const detail = env.error_description || env.error || env.error_code || ''
    throw new CodeArtsRefreshError(
      classifyRefreshFailure(res.status, `${detail} ${text}`),
      res.status,
      `CodeArts 续期失败 HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    )
  }
  const expiresAt = creds.expiration ? parseRfc3339(creds.expiration) : null
  return {
    token: creds.security_token,
    refreshToken: newRefresh || refreshTokenOld,
    // 响应无 expiration ⇒ null(未知);不再拿 2h 兜底冒充上游给的到期时刻
    expiresAt,
    // 刷新轮转**整套** STS 凭据,不止 security_token;DPoP 私钥/PKCE verifier 不变
    secrets: {
      accessKeyId: creds.access_key_id,
      secretAccessKey: creds.secret_access_key ?? '',
      dpopPrivateKeyJwk: secrets.dpopPrivateKeyJwk,
      codeVerifier: secrets.codeVerifier,
      clientId: secrets.clientId,
      domainId: env.domain_id ?? secrets.domainId,
      userName: env.user_name ?? secrets.userName,
    },
  }
}

async function refreshToken(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<TokenRefreshResult | null> {
  const secrets = readSecrets(ctx)
  const refreshTokenOld = ctx.credentials.refreshToken
  const jwk = secrets.dpopPrivateKeyJwk
  if (!refreshTokenOld || !secrets.codeVerifier || !jwk) {
    // 硬绑定:refresh_token 与 client_id、DPoP 私钥、PKCE verifier 绑定,缺任一无法续期
    throw new Error('缺少 refresh_token / DPoP 私钥 / PKCE verifier,无法续期')
  }
  const fetchImpl = resolveFetchImpl(opts ?? {})
  // 回退重试:仅瞬态失败(rate/server)重试一次(全新 DPoP jti 防重放);
  // auth/credit/session_dead/client 是确定性失败,不重试,防烧一次性 refresh_token
  let lastErr: Error = new Error('CodeArts 续期失败: 未知错误')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await attemptRefresh(fetchImpl, secrets, jwk, refreshTokenOld)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      const kind = e instanceof CodeArtsRefreshError ? e.failureKind : 'client'
      if (kind !== 'rate' && kind !== 'server') break
    }
  }
  throw lastErr
}

function parseRfc3339(s: string): Date | null {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// =============================================================================
// 健康检查与模型清单(GET /v1/model/builtin,轻量不耗配额)
// =============================================================================

/** 构造并发起已签名的模型清单 GET;返回解析后的 JSON(非 2xx/解析失败抛错) */
async function fetchBuiltinModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<Record<string, unknown>> {
  const secrets = readSecrets(ctx)
  const headers = signRequest({
    accessKeyId: secrets.accessKeyId,
    secretAccessKey: secrets.secretAccessKey,
    securityToken: ctx.credentials.token,
    method: 'GET',
    url: BUILTIN_MODELS_URL,
    headers: { 'agent-type': 'PromptCenter', accept: 'application/json' },
  })
  const res = await resolveFetchImpl(opts ?? {})(BUILTIN_MODELS_URL, { method: 'GET', headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error(`响应解析失败: ${text.slice(0, 200)}`)
  }
  if (!obj || typeof obj !== 'object') throw new Error('响应形状非法')
  return obj as Record<string, unknown>
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    const json = await fetchBuiltinModels(ctx, opts)
    const err = extractErrorFrame(json)
    if (err) {
      const e = err.openaiChunk['error'] as { code: string; message: string }
      return {
        ok: false,
        // 上游错误帧里的鉴权类错误码(APIG.0301/0303、STS5.1804 等)= 明确拒收
        authFailed: isAuthFailure(0, JSON.stringify(e)),
        error: `${e.code}: ${e.message}`,
      }
    }
    if (!Array.isArray(json['builtinModels'])) {
      return { ok: false, error: '模型清单响应缺少 builtinModels' }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const m = msg.match(/^HTTP\s+(\d{3})/)
    const status = m ? Number(m[1]) : 0
    return { ok: false, authFailed: isAuthFailure(status, msg), error: msg }
  }
}

async function listModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<string[]> {
  const json = await fetchBuiltinModels(ctx, opts)
  const models = Array.isArray(json['builtinModels']) ? json['builtinModels'] : []
  const out: string[] = []
  for (const m of models) {
    if (!m || typeof m !== 'object') continue
    const rec = m as Record<string, unknown>
    if (rec['enable'] === false) continue
    const id = typeof rec['model_id'] === 'string' ? rec['model_id'] : ''
    if (id) out.push(id)
  }
  return out
}

// =============================================================================
// 认证失败判定
// =============================================================================

/** 常见认证失效文案标记(JSON error 体 / SSE 中途断流帧都可能出现) */
const CA_AUTH_BODY_MARKERS = [
  'unauthorized',
  'authentication failed',
  'invalid token',
  'token has expired',
  'token expired',
  'security token has expired',
  'security token is expired',
  '重新登录',
  '登录已过期',
]
/** token 失效类短语("The security token is invalid" 等) */
const CA_TOKEN_BAD_RE = /token.{0,40}(expired|invalid)/i

/** 非 200 HTML 登录墙(上游风控跳转登录页):识别为认证失效形态 */
function looksLikeHtmlLoginPage(bodyText: string): boolean {
  const s = bodyText.slice(0, 2048).toLowerCase()
  if (!s.includes('<html') && !s.includes('<!doctype html')) return false
  return (
    s.includes('login') ||
    s.includes('登录') ||
    s.includes('sign in') ||
    s.includes('sign-in') ||
    s.includes('signin') ||
    s.includes('认证')
  )
}

/**
 * 401/403,或响应体带凭证失效类错误码(APIG.0301/0303 签名/凭据、STS5.1804/5.1806 续期),
 * 或常见认证文案 / token 失效短语 / HTML 登录墙 → true(forwarder 的 401 自愈依赖判真)。
 * TM.00001041(并发超限)是临时故障,返回 false 走退避而不是 401 自愈。
 */
function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  if (AUTH_FAILURE_CODES.some((code) => bodyText.includes(code))) return true
  const lower = bodyText.toLowerCase()
  if (CA_AUTH_BODY_MARKERS.some((m) => lower.includes(m))) return true
  if (CA_TOKEN_BAD_RE.test(bodyText)) return true
  return looksLikeHtmlLoginPage(bodyText)
}

/** 刷新抛错/上游异常 → 是否凭证失效(forwarder 401 自愈判定;结构化错误直接看 failureKind) */
function isAuthError(err: unknown): boolean {
  if (err instanceof CodeArtsRefreshError) return err.failureKind === 'auth'
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  // message 里的 "HTTP 401/403" 还原成状态码判定
  const m = message.match(/HTTP\s+(\d{3})/i)
  const status = m ? Number(m[1]) : 0
  return isAuthFailure(status, message)
}

// =============================================================================
// 富错误分级(转发层据此决定罚不罚号、罚多久)
// =============================================================================

/** 从响应体宽松提取错误码({"error_code":"..."} 或 {"code":"..."}) */
function extractErrorCode(bodyText: string): string {
  const m = bodyText.match(/"(?:error_code|code)"\s*:\s*"?([A-Za-z0-9._-]+)"?/)
  return m?.[1] ?? ''
}

/**
 * CodeArts 错误分级(与 isAuthFailure / classifyRefreshFailure 同一套语义):
 * - TM.00001041(并发会话超限)→ rate(60s 退避,不罚号)
 * - STS5.1806 / invalid_grant(refresh_token 已被使用,凭证报废)→ session_dead(永久摘除,重试无意义)
 * - APIG.0301/0303、STS5.1804 → auth(触发 401 自愈刷新)
 * - InferHub…406(model 头不一致)、4005(通道不支持该模型)、TM.00001027(资格类)→ request(参数级,不罚号)
 * - 402 / 额度/积分/欠费类文案 → credit(12h 冷却 + 摘除;上游暂无稳定错误码,按文案启发式识别;
 *   正则剔除裸 insufficient/balance,"Insufficient privileges" 不再误判)
 * - 401/403、认证文案、token 失效短语、HTML 登录墙 → auth(额度文案之后,保证 401 自愈触发)
 * - 其余按 HTTP 状态粗分:404→not_found、429→rate、5xx→server、其他 4xx→client
 */
function classifyUpstreamFailure(
  statusCode: number,
  bodyText: string,
): {
  kind: 'auth' | 'credit' | 'session_dead' | 'rate' | 'not_found' | 'request' | 'server' | 'client'
} {
  // 已知码一律子串匹配(与 isAuthFailure 同语义,不依赖 JSON 键形)
  if (bodyText.includes('TM.00001041')) return { kind: 'rate' }
  if (bodyText.includes('STS5.1806') || bodyText.toLowerCase().includes('invalid_grant'))
    return { kind: 'session_dead' }
  if (
    bodyText.includes('APIG.0301') ||
    bodyText.includes('APIG.0303') ||
    bodyText.includes('STS5.1804')
  ) {
    return { kind: 'auth' }
  }
  const code = extractErrorCode(bodyText)
  if (code.startsWith('InferHub') || code === '4005' || code === 'TM.00001027')
    return { kind: 'request' }
  if (statusCode === 402 || REFRESH_CREDIT_RE.test(bodyText)) return { kind: 'credit' }
  // 401/403 与认证文案/HTML 登录墙 → auth(先于状态粗分,保证 forwarder 401 自愈触发)
  if (isAuthFailure(statusCode, bodyText)) return { kind: 'auth' }
  if (statusCode === 404) return { kind: 'not_found' }
  if (statusCode === 429) return { kind: 'rate' }
  if (statusCode >= 500) return { kind: 'server' }
  if (statusCode >= 400) return { kind: 'client' }
  return { kind: 'client' }
}

/**
 * 限时福利余额点查(§0.3 如实未判定):端点已取证(见 BENEFIT_BALANCE_URL 注),
 * 但响应**字段形状未实证**(2026-10-27 本机实弹未做成:入库号 refresh 会话已被
 * 上游判死 STS5.1806,桌面端重登补票后可点查补证)。因此 200 一律回 ok:false +
 * 响应键名清单,绝不猜字段名读成数字——一旦清单可见,后续一轮即可补解析。
 */
async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  try {
    const secrets = readSecrets(ctx)
    const headers = signRequest({
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      securityToken: ctx.credentials.token,
      method: 'GET',
      url: BENEFIT_BALANCE_URL,
      headers: { accept: 'application/json' },
    })
    const res = await resolveFetchImpl(opts ?? {})(BENEFIT_BALANCE_URL, {
      method: 'GET',
      headers,
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return {
        ok: false,
        ...(codeartsAdapter.isAuthFailure(res.status, text) ? { authFailed: true } : {}),
        error: `balance HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }
    let keys: string[] = []
    try {
      const obj: unknown = JSON.parse(text)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        keys = Object.keys(obj as Record<string, unknown>)
      }
    } catch {
      /* 非 JSON 也如实报 */
    }
    return {
      ok: false,
      error: `余额端点已应答 200,响应键=[${keys.join(',') || '(空)'}],字段形状未实证 ⇒ 未判定(不猜字段读成数字)`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `余额点查失败: ${msg}` }
  }
}

// =============================================================================
// 导出
// =============================================================================

export const codeartsAdapter: RelayUpstreamAdapter = {
  providerCode: 'codearts',
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  refreshToken,
  checkHealth,
  getQuota,
  listModels,
  isAuthFailure,
  isAuthError,
  classifyUpstreamFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
