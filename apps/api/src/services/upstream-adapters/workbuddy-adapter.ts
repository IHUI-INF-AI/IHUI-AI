// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy/CodeBuddy(腾讯 AI IDE)上游适配器(2026-10-22 立)。
 *
 * 上游是 OpenAI 兼容的单段式协议(POST /v2/chat/completions,SSE 标准 chunk),
 * 因此走通用链路:buildChatRequest → 转发层 fetch → translateStreamChunk,
 * 不实现 executeChat。协议纯计算全部在 workbuddy-protocol.ts,本文件只做编排:
 * - realm(CN copilot.tencent.com / global www.workbuddy.ai)按账号 domain 判定;
 * - 身份头(X-User-Id/X-Enterprise-Id/X-Domain)从 extraMetadata > JWT claims > row.uid 解析,
 *   缺字段用 X-No-* 显式声明;chat 请求绝不携带 X-Refresh-Token(红线);
 * - refreshToken() 走 /v2/plugin/auth/token/refresh(POST 无 body,不带 Authorization);
 * - checkHealth()/listModels() 共用 /console/enterprises/personal/models(进程内缓存 1h);
 * - classifyUpstreamFailure() 实现接口可选的富错误分类(返回 {kind}),
 *   区分 credit/session_dead/auth/rate/request 等,供转发层决定罚不罚号。
 *
 * 安全红线:凭证/token 一律不进日志与抛错 message。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import { parseJwtClaims } from '../relay-account-pool-service.js'
import {
  buildChatHeaders,
  buildHealthHeaders,
  buildRefreshHeaders,
  chatBaseUrl,
  classifyUpstreamFailure,
  deriveConversationRequestId,
  deriveStableId,
  isAuthFailureCore,
  normalizeCompletion,
  normalizeStreamChunk,
  parseEnvelope,
  prepareChatBody,
  randomHex32,
  resolveIdentity,
  resolveRealm,
  type UpstreamFailureKind,
  type WorkBuddyIdentity,
  type WorkBuddyRealm,
} from './workbuddy-protocol.js'

/** listModels 进程内缓存:按 realm 分 key,TTL 1h(模型目录变化慢,健康检查不重复打上游) */
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000
const modelsCache = new Map<WorkBuddyRealm, { ids: string[]; at: number }>()

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;与 trae-adapter 同款)
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
      { ...(init ?? {}), dispatcher } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

/** 优先级:opts.fetchImpl(测试打桩)> opts.proxyUrl(账号级代理)> 全局直连 */
function resolveFetchImpl(opts?: AdapterCallOptions): typeof fetch {
  if (opts?.fetchImpl) return opts.fetchImpl
  if (opts?.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

/** 账号上下文解析出的 realm + 身份(每请求一次) */
interface ResolvedAccount {
  realm: WorkBuddyRealm
  identity: WorkBuddyIdentity
}

function resolveAccount(ctx: AdapterAccountContext): ResolvedAccount {
  const claims = ctx.credentials.token ? parseJwtClaims(ctx.credentials.token) : null
  const identity = resolveIdentity({
    extraMetadata: ctx.row.extraMetadata,
    claims,
    rowUid: ctx.row.uid,
  })
  return { realm: resolveRealm(identity.domain), identity }
}

/** 统一信封 GET(模型目录);返回 {status, text} 供健康检查/列表复用 */
async function fetchModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ status: number; text: string }> {
  const { realm } = resolveAccount(ctx)
  const url = `${chatBaseUrl(realm)}/console/enterprises/personal/models`
  const res = await resolveFetchImpl(opts)(url, {
    method: 'GET',
    headers: buildHealthHeaders({ realm, accessToken: ctx.credentials.token }),
  })
  const text = await res.text().catch(() => '')
  return { status: res.status, text }
}

/** 从信封 data.models 提取模型 id 数组;非法结构 → null */
function extractModelIds(envelopeText: string): string[] | null {
  const env = parseEnvelope(envelopeText)
  if (!env || env.code !== 0) return null
  const data = env.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const models = (data as Record<string, unknown>)['models']
  if (!Array.isArray(models)) return null
  const ids: string[] = []
  for (const m of models) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue
    const id = (m as Record<string, unknown>)['id']
    if (typeof id === 'string' && id) ids.push(id)
  }
  return ids
}

export const workbuddyAdapter: RelayUpstreamAdapter = {
  providerCode: 'workbuddy',

  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest {
    const { realm, identity } = resolveAccount(ctx)
    const conversationRequestId = deriveConversationRequestId(req.conversationId)
    const messageRequestId = randomHex32()
    const headers = buildChatHeaders({
      realm,
      accessToken: ctx.credentials.token,
      uid: identity.uid,
      enterpriseId: identity.enterpriseId,
      domain: identity.domain,
      machineId: deriveStableId('machine', ctx.row.uid),
      sessionId: deriveStableId('session', ctx.row.uid),
      conversationRequestId,
      messageRequestId,
    })
    const raw: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: true,
    }
    if (typeof req.temperature === 'number') raw['temperature'] = req.temperature
    if (typeof req.maxTokens === 'number') raw['max_tokens'] = req.maxTokens
    // function-calling 透传:prepareChatBody 内 normalizeToolChoice 会做上游 string 形态归一
    if (req.tools !== undefined) raw['tools'] = req.tools
    if (req.toolChoice !== undefined) raw['tool_choice'] = req.toolChoice
    return {
      url: `${chatBaseUrl(realm)}/v2/chat/completions`,
      method: 'POST',
      headers,
      body: prepareChatBody(raw),
    }
  },

  translateStreamChunk(
    _ctx: AdapterAccountContext,
    rawFrame: string,
    _state: StreamState,
  ): TranslatedChunk | null {
    // 帧可能是单行 data: 或含多行元数据的 SSE 事件块;取第一个 data: 载荷
    let payload: string | null = null
    for (const line of rawFrame.split('\n')) {
      const t = line.trim()
      if (t.startsWith('data:')) {
        payload = t.slice(5).trim()
        break
      }
    }
    if (payload === null || payload === '[DONE]') return null
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return null
    }
    const chunk = normalizeStreamChunk(parsed)
    if (!chunk) return null
    return { openaiChunk: chunk }
  },

  translateNonStream(_ctx: AdapterAccountContext, responseBody: unknown): Record<string, unknown> {
    return normalizeCompletion(responseBody)
  },

  async refreshToken(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    const refreshToken = ctx.credentials.refreshToken
    if (!refreshToken) throw new Error('workbuddy refresh 失败: 账号缺少 refreshToken')
    const { realm, identity } = resolveAccount(ctx)
    const url = `${chatBaseUrl(realm)}/v2/plugin/auth/token/refresh`
    const headers = buildRefreshHeaders({
      realm,
      refreshToken,
      uid: identity.uid,
      enterpriseId: identity.enterpriseId,
      domain: identity.domain,
      machineId: deriveStableId('machine', ctx.row.uid),
      sessionId: deriveStableId('session', ctx.row.uid),
      conversationRequestId: deriveConversationRequestId(),
      messageRequestId: randomHex32(),
    })
    const res = await resolveFetchImpl(opts)(url, { method: 'POST', headers })
    const text = await res.text().catch(() => '')
    // 抛错 message 只带状态码/信封 code,绝不带 body(可能含凭证)
    if (res.status >= 400) throw new Error(`workbuddy refresh 失败: HTTP ${res.status}`)
    const env = parseEnvelope(text)
    if (!env) throw new Error('workbuddy refresh 失败: 响应信封非法')
    if (env.code !== 0) throw new Error(`workbuddy refresh 失败: code=${env.code}`)
    const data =
      env.data && typeof env.data === 'object' && !Array.isArray(env.data)
        ? (env.data as Record<string, unknown>)
        : {}
    const accessToken = typeof data['accessToken'] === 'string' ? data['accessToken'].trim() : ''
    if (!accessToken)
      throw new Error('workbuddy refresh 失败: 上游未返回 accessToken(会话已死,需重新登录)')
    // 缺省 → null,由 scheduler 按"不改写"保留旧值
    const newRefresh =
      typeof data['refreshToken'] === 'string' && data['refreshToken'].trim()
        ? data['refreshToken'].trim()
        : null
    const expiresIn = typeof data['expiresIn'] === 'number' ? data['expiresIn'] : NaN
    let expiresAt: Date
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 1000)
    } else {
      // 防刷新风暴:缺省/非正 → 沿用旧过期时刻;row 也没有则 now+24h
      expiresAt = ctx.row.tokenExpiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
    return { token: accessToken, refreshToken: newRefresh, expiresAt }
  },

  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const { status, text } = await fetchModels(ctx, opts)
      if (status === 401 || status === 403) return { ok: false, error: `HTTP ${status} 鉴权失效` }
      if (status >= 400) return { ok: false, error: `HTTP ${status}` }
      const env = parseEnvelope(text)
      if (!env) return { ok: false, error: '响应信封非法' }
      if (env.code !== 0) {
        const brief = env.msg ? `: ${env.msg.slice(0, 80)}` : ''
        return { ok: false, error: `code=${env.code}${brief}` }
      }
      const ids = extractModelIds(text)
      if (!ids || ids.length === 0) return { ok: false, error: 'models 列表为空' }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : '健康检查请求失败' }
    }
  },

  async listModels(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<string[]> {
    const { realm } = resolveAccount(ctx)
    const hit = modelsCache.get(realm)
    if (hit && Date.now() - hit.at < MODELS_CACHE_TTL_MS) return hit.ids
    const { status, text } = await fetchModels(ctx, opts)
    if (status >= 400) throw new Error(`workbuddy listModels 失败: HTTP ${status}`)
    const env = parseEnvelope(text)
    if (!env || env.code !== 0) throw new Error('workbuddy listModels 失败: 响应信封非法')
    const ids = extractModelIds(text)
    if (!ids) throw new Error('workbuddy listModels 失败: models 结构非法')
    modelsCache.set(realm, { ids, at: Date.now() })
    return ids
  },

  isAuthFailure(statusCode: number, bodyText: string): boolean {
    return isAuthFailureCore(statusCode, bodyText)
  },

  isAuthError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
    return isAuthFailureCore(0, message)
  },

  classifyUpstreamFailure(statusCode: number, bodyText: string): { kind: UpstreamFailureKind } {
    return { kind: classifyUpstreamFailure(statusCode, bodyText) }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
