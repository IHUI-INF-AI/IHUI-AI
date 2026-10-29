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
 * - 凭据双格式兼容:tokenEnc 可为裸 JWT/opaque、token JSON({"accessToken":…})或 cookie 串
 *   ("token=…; refresh_token=…"),parseLoginState 在 resolveAccount 统一归一后再建请求;
 * - refreshToken() 主端点 /v2/plugin/auth/token/refresh(POST 无 body,不带 Authorization),
 *   失败按序回退备用端点 /v2/auth/token/refresh 与备用凭据字段(登录态内嵌 refresh),
 *   全部失败抛最后一次错误走既有错误分类;
 * - checkHealth()/listModels() 共用 /console/enterprises/personal/models(进程内缓存 1h);
 * - getQuota() 走用户中心权益接口(POST /billing/meter/get-user-resource-summary,
 *   取不到资源包才补 paid/free 明细;基址随 realm/domain 变、Origin 必须等于请求 host);
 * - classifyUpstreamFailure() 实现接口可选的富错误分类(返回 {kind}),
 *   区分 credit/session_dead/auth/rate/request 等,供转发层决定罚不罚号。
 *
 * 安全红线:凭证/token 一律不进日志与抛错 message。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { config } from '../../config/index.js'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import { parseJwtClaims } from '../relay-account-format.js'
import { normalizeStopList } from '../relay-stop-truncate.js'
import {
  billingBaseUrl,
  billingPathCandidates,
  buildBillingHeaders,
  buildChatHeaders,
  buildHealthHeaders,
  buildRefreshHeaders,
  chatBaseUrl,
  classifyUpstreamFailure,
  deriveConversationRequestId,
  deriveStableId,
  extractResourceList,
  extractSubscriptionInfo,
  isAuthFailureCore,
  isResourceSuccess,
  isResourceUnauthorized,
  normalizeCompletion,
  normalizeResourcePackage,
  normalizeStreamChunk,
  parseEnvelope,
  parseLoginState,
  prepareChatBody,
  randomHex32,
  REFRESH_ENDPOINT_PATHS,
  RESOURCE_SUMMARY_PATH,
  resolveIdentity,
  resolveRealm,
  resourceErrorMessage,
  workBuddyIdDeploymentSalt,
  type UpstreamFailureKind,
  type WorkBuddyIdSeed,
  type WorkBuddyIdentity,
  type WorkBuddyLoginState,
  type WorkBuddyRealm,
  type WorkBuddyResourcePackage,
} from './workbuddy-protocol.js'

/** listModels 进程内缓存:按 realm 分 key,TTL 1h(模型目录变化慢,健康检查不重复打上游) */
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000
const modelsCache = new Map<WorkBuddyRealm, { ids: string[]; at: number }>()

// =============================================================================
// 稳定身份派生种子(O72 整改@2026-10-28,判据全部在 workbuddy-protocol.deriveStableId)
// =============================================================================

/** 部署级机密盐(进程内一次算定;账号有存储设备材料时该档根本不参与派生) */
let cachedIdDeploymentSalt: string | null = null
function idDeploymentSalt(): string {
  if (cachedIdDeploymentSalt === null) {
    // 取 config 的必填密钥做域分隔;盐只在本地参与哈希,绝不出现在任何请求头/日志
    const secret =
      String(config.CREDENTIALS_ENCRYPTION_KEY ?? '') || String(config.JWT_SECRET ?? '')
    cachedIdDeploymentSalt = secret ? workBuddyIdDeploymentSalt(secret) : ''
  }
  return cachedIdDeploymentSalt
}

/** 由账号行组装 stable-id 种子:存储材料(machineId>deviceId)优先,部署盐兜底 */
function idSeedFor(row: AdapterAccountContext['row']): WorkBuddyIdSeed {
  return {
    uid: row.uid,
    storedMachineId: row.machineId,
    storedDeviceId: row.deviceId,
    deploymentSalt: idDeploymentSalt(),
  }
}

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

/** 账号上下文解析出的 realm + 身份 + 登录材料(每请求一次;凭据双格式在此归一) */
interface ResolvedAccount {
  realm: WorkBuddyRealm
  identity: WorkBuddyIdentity
  login: WorkBuddyLoginState
}

function resolveAccount(ctx: AdapterAccountContext): ResolvedAccount {
  const login = parseLoginState(ctx.credentials)
  const claims = login.accessToken ? parseJwtClaims(login.accessToken) : null
  const identity = resolveIdentity({
    extraMetadata: ctx.row.extraMetadata,
    claims,
    rowUid: ctx.row.uid,
  })
  return { realm: resolveRealm(identity.domain), identity, login }
}

/** 统一信封 GET(模型目录);返回 {status, text} 供健康检查/列表复用 */
async function fetchModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ status: number; text: string }> {
  const { realm, login } = resolveAccount(ctx)
  const url = `${chatBaseUrl(realm)}/console/enterprises/personal/models`
  const res = await resolveFetchImpl(opts)(url, {
    method: 'GET',
    headers: buildHealthHeaders({ realm, accessToken: login.accessToken }),
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

// =============================================================================
// 权益/余额点查(上游用户中心 billing 接口)
// =============================================================================

interface BillingResponse {
  status: number
  url: string
  root: unknown
}

/** 解析回包 JSON(非法体 → null,不抛;原文不外泄) */
function parseJsonLoose(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * 权益接口单次 POST,按 realm 走路径候选。
 * **只有 404 换下一个候选**;401/403/WAF 10085 一律原样返回 —— 把它们当"路径不对"
 * 会掩盖真因,也会让承载层误判可重试。
 */
async function postBilling(
  fetchImpl: typeof fetch,
  base: string,
  realm: WorkBuddyRealm,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<BillingResponse> {
  const candidates = billingPathCandidates(realm, path)
  let last: BillingResponse = { status: 0, url: `${base}${candidates[0]}`, root: null }
  for (let i = 0; i < candidates.length; i += 1) {
    const url = `${base}${candidates[i]}`
    const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await res.text().catch(() => '')
    last = { status: res.status, url, root: parseJsonLoose(text) }
    if (res.status !== 404 || i + 1 === candidates.length) return last
  }
  return last
}

/**
 * 从一路回包里取资源包并归一。
 * HTTP 非 2xx / 信封失败 / 列表缺失 / 包内无任何数字 —— 一律返回空数组(不补 0)。
 */
function packagesFrom(
  res: BillingResponse,
  key: 'Packages' | 'Accounts',
  now: number,
): WorkBuddyResourcePackage[] {
  if (res.status < 200 || res.status >= 300) return []
  if (!isResourceSuccess(res.root)) return []
  const list = extractResourceList(res.root, key)
  if (!list) return []
  const out: WorkBuddyResourcePackage[] = []
  for (const item of list) {
    const pkg = normalizeResourcePackage(item, now)
    if (pkg) out.push(pkg)
  }
  return out
}

/** 单次刷新尝试(一个端点 × 一个刷新凭证);失败抛错,message 不带凭证 */
async function attemptRefresh(
  fetchImpl: typeof fetch,
  url: string,
  refreshToken: string,
  account: {
    realm: WorkBuddyRealm
    identity: WorkBuddyIdentity
    idSeed: WorkBuddyIdSeed
  },
): Promise<TokenRefreshResult> {
  const headers = buildRefreshHeaders({
    realm: account.realm,
    refreshToken,
    uid: account.identity.uid,
    enterpriseId: account.identity.enterpriseId,
    domain: account.identity.domain,
    machineId: deriveStableId('machine', account.idSeed),
    sessionId: deriveStableId('session', account.idSeed),
    conversationRequestId: deriveConversationRequestId(),
    messageRequestId: randomHex32(),
  })
  const res = await fetchImpl(url, { method: 'POST', headers })
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
  let expiresAt: Date | null
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    expiresAt = new Date(Date.now() + expiresIn * 1000)
  } else {
    // 上游没给到期 ⇒ null(未知)。不沿用旧值:旧值可能已被收敛到过去(上游拒收),
    // 沿用它会让"换票成功"当场又变成"已过期",也会把编造的未来时刻写回库里。
    expiresAt = null
  }
  return { token: accessToken, refreshToken: newRefresh, expiresAt }
}

export const workbuddyAdapter: RelayUpstreamAdapter = {
  providerCode: 'workbuddy',

  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest {
    const { realm, identity, login } = resolveAccount(ctx)
    const conversationRequestId = deriveConversationRequestId(req.conversationId)
    const messageRequestId = randomHex32()
    const idSeed = idSeedFor(ctx.row)
    const headers = buildChatHeaders({
      realm,
      accessToken: login.accessToken,
      uid: identity.uid,
      enterpriseId: identity.enterpriseId,
      domain: identity.domain,
      machineId: deriveStableId('machine', idSeed),
      sessionId: deriveStableId('session', idSeed),
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
    // reasoning_effort 原样透传(上游接受 OpenAI 语义 low/medium/high;不做本地值域裁剪)
    if (req.reasoningEffort !== undefined) raw['reasoning_effort'] = req.reasoningEffort
    // 采样面与工具开关(2026-10-23 实测上游均接受)
    if (req.topP !== undefined) raw['top_p'] = req.topP
    if (req.presencePenalty !== undefined) raw['presence_penalty'] = req.presencePenalty
    if (req.frequencyPenalty !== undefined) raw['frequency_penalty'] = req.frequencyPenalty
    if (req.parallelToolCalls !== undefined) raw['parallel_tool_calls'] = req.parallelToolCalls
    if (req.user !== undefined) raw['user'] = req.user
    if (req.serviceTier !== undefined) raw['service_tier'] = req.serviceTier
    if (req.topK !== undefined) raw['top_k'] = req.topK
    if (req.repetitionPenalty !== undefined) raw['repetition_penalty'] = req.repetitionPenalty
    if (req.logitBias !== undefined) raw['logit_bias'] = req.logitBias
    // stop 必须数组:上游 Go 服务对字符串形态直接 400(实测 code=11101)
    const stops = normalizeStopList(req.stop)
    if (stops.length > 0) raw['stop'] = stops
    // function-calling 透传:prepareChatBody 内 normalizeToolChoice 会做上游 string 形态归一
    if (req.tools !== undefined) raw['tools'] = req.tools
    if (req.toolChoice !== undefined) raw['tool_choice'] = req.toolChoice
    // OpenAI 兼容面透传:JSON mode / 确定性采样
    if (req.responseFormat !== undefined) raw['response_format'] = req.responseFormat
    if (req.seed !== undefined) raw['seed'] = req.seed
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

  /**
   * 刷新(带回退):首选 refreshToken × [主端点, 备用端点] → 备用凭据字段(登录态内嵌
   * refresh,来自 token JSON / cookie 串 / cookies 数组)× [主端点, 备用端点]。
   * 全部失败抛最后一次错误(message 只带状态码/信封 code,不带凭证),仍走既有错误分类。
   */
  async refreshToken(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    const { realm, identity, login } = resolveAccount(ctx)
    const candidates: string[] = []
    for (const rt of [
      ctx.credentials.refreshToken ?? '',
      login.refreshToken,
      login.embeddedRefreshToken,
    ]) {
      const v = rt.trim()
      if (v && !candidates.includes(v)) candidates.push(v)
    }
    if (candidates.length === 0) throw new Error('workbuddy refresh 失败: 账号缺少 refreshToken')
    const fetchImpl = resolveFetchImpl(opts)
    let lastErr: Error = new Error('workbuddy refresh 失败: 未知错误')
    for (const refreshToken of candidates) {
      for (const path of REFRESH_ENDPOINT_PATHS) {
        try {
          return await attemptRefresh(fetchImpl, `${chatBaseUrl(realm)}${path}`, refreshToken, {
            realm,
            identity,
            idSeed: idSeedFor(ctx.row),
          })
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e))
        }
      }
    }
    throw lastErr
  },

  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
    try {
      const { status, text } = await fetchModels(ctx, opts)
      if (status === 401 || status === 403)
        return { ok: false, authFailed: true, error: `HTTP ${status} 鉴权失效` }
      if (status >= 400) return { ok: false, indeterminate: true, error: `HTTP ${status}(未判定)` }
      const env = parseEnvelope(text)
      if (!env) return { ok: false, indeterminate: true, error: '响应信封非法(未判定)' }
      if (env.code !== 0) {
        const brief = env.msg ? `: ${env.msg.slice(0, 80)}` : ''
        return { ok: false, error: `code=${env.code}${brief}` }
      }
      const ids = extractModelIds(text)
      if (!ids || ids.length === 0) return { ok: false, error: 'models 列表为空' }
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        indeterminate: true,
        error: `${e instanceof Error ? e.message.slice(0, 120) : '健康检查请求失败'}(未判定)`,
      }
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

  /**
   * 余额/权益按需点查(管理面点查;不进健康检查轮询,不消耗对话配额)。
   *
   * 上游证据(2026-10-27 真号实弹):summary 单请求带回全部资源包的容量/用量
   * (字符串数字,协议层已归一),包级人名与到期字段上游不给 ⇒ packs 名如实用包码,
   * 套餐语义取 data.SubscriptionPackageName;paid/free 明细接口对无官方码集的
   * 请求体回 400 code 10001,不接(码集是官方客户端硬编码清单,不复制该脆弱面)。
   * 基址随 realm/domain 变(global=www.workbuddy.ai,CN 按 domain 在
   * codebuddy.cn / workbuddy.cn 之间二选一),Origin 必须等于本次请求 host。
   * 永不抛:一切失败归 ok:false —— "取不到"不得被读成"余额为零"。
   */
  async getQuota(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult> {
    try {
      const { realm, identity, login } = resolveAccount(ctx)
      if (!login.accessToken) return { ok: false, error: '账号无可用访问令牌(需重新登录)' }
      const base = billingBaseUrl(realm, identity.domain)
      const headers = buildBillingHeaders({
        realm,
        accessToken: login.accessToken,
        uid: identity.uid,
        enterpriseId: identity.enterpriseId,
        domain: identity.domain,
        origin: base,
      })
      const fetchImpl = resolveFetchImpl(opts)
      const now = Date.now()

      // 单请求 summary(2026-10-27 真号实证:paid/free 明细对无官方码集的请求体回
      // HTTP 400 code 10001,码集是官方客户端硬编码清单,不复制该脆弱面;
      // summary 的数字是字符串容量键、无包级人名与时间字段 ⇒ packs 名如实用包码,
      // 面板套餐语义由 data.SubscriptionPackageName 提供)
      const summaryRes = await postBilling(
        fetchImpl,
        base,
        realm,
        RESOURCE_SUMMARY_PATH,
        {},
        headers,
      )
      const responses: BillingResponse[] = [summaryRes]
      const pkgs = packagesFrom(summaryRes, 'Packages', now)

      if (pkgs.length === 0) {
        // 鉴权失效按适配器自己量到的状态码/信封 code 判(10085 WAF 不算),供承载层自愈
        const authFailed = responses.some(
          (r) => r.status === 401 || r.status === 403 || isResourceUnauthorized(r.root),
        )
        const detail = responses
          .map((r) => {
            const msg = resourceErrorMessage(r.root)
            return msg ? `${r.status}:${msg}` : `HTTP ${r.status}`
          })
          .join(' / ')
        const hint =
          identity.enterpriseId && !authFailed ? ';该账号带企业 ID,企业配额端点形状未取证' : ''
        return {
          ok: false,
          ...(authFailed ? { authFailed: true } : {}),
          error: `权益接口未给出可解析的资源包(${detail})${hint}`,
        }
      }

      const sum = (pick: (p: WorkBuddyResourcePackage) => number | undefined): number =>
        pkgs.reduce((acc, p) => acc + (pick(p) ?? 0), 0)
      const total = sum((p) => p.total)
      const remaining = sum((p) => p.remaining)
      const used = sum((p) => p.used)
      // resetsAt = 还有余量的包里最早到期的那个(不是第一枚 ⇒ 排序必须真做)
      const resetsAt = pkgs
        .filter((p) => (p.remaining ?? 0) > 0 && p.endAt)
        .map((p) => p.endAt as string)
        .sort()[0]
      const sub = extractSubscriptionInfo(summaryRes.root)

      return {
        ok: true,
        quota: {
          total,
          remaining,
          used,
          ...(total > 0 ? { ratio: Math.min(1, Math.max(0, used / total)) } : {}),
          unit: 'WorkBuddy 积分',
          ...(resetsAt ? { resetsAt } : {}),
          ...(sub.subscriptionName ? { subscriptionName: sub.subscriptionName } : {}),
          packs: pkgs.map((p) => ({
            ...(p.name || p.code ? { name: p.name ?? p.code } : {}),
            limit: p.total,
            remaining: p.remaining,
            ...(p.endAt ? { endAt: p.endAt } : {}),
          })),
        },
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : '余额查询请求失败' }
    }
  },

  isAuthFailure(statusCode: number, bodyText: string): boolean {
    return isAuthFailureCore(statusCode, bodyText)
  },

  isAuthError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
    // 刷新/上游抛错 message 里的 "HTTP 401/403" 还原成状态码判定(401 自愈依赖)
    const m = message.match(/HTTP\s+(\d{3})/i)
    const status = m ? Number(m[1]) : 0
    return isAuthFailureCore(status, message)
  },

  classifyUpstreamFailure(statusCode: number, bodyText: string): { kind: UpstreamFailureKind } {
    return { kind: classifyUpstreamFailure(statusCode, bodyText) }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
