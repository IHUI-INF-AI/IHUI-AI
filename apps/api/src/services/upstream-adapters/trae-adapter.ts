// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae CN(字节 AI IDE)上游适配器(2026-10-22 立)。
 *
 * 主路线:remote chat_sessions 两步会话(web 渠道,账号池友好)——
 *   1. POST {base}/chat_sessions           创建回合 → chat_session_id / message_id
 *   2. GET  {base}/chat_sessions/{id}/events?reply_to_message_id={mid}   SSE 拉流
 *   收尾 POST {base}/chat_sessions/{id}/stop 尽力而为,失败忽略(不阻塞主链路)
 *
 * Trae 是多段式协议 → 走 executeChat 整体执行入口(自管 fetch);
 * 单段式三件套(buildChatRequest/translateStreamChunk/translateNonStream)保留但直接抛错,
 * 转发层检测到 executeChat 存在就不会调它们。
 *
 * 401/403 自愈:创建/拉流任一请求命中鉴权失败 → 抛 TraeAuthFailureError,
 * 由转发层触发 refreshToken 后重试;适配器内部不循环重试。
 *
 * 协议字段实证(2026-10-22,反解 solo.trae.cn 线上 bundle `8974.b76c7073.js`):
 * - 创建体含 `custom_model` 描述符与 `query: JSON.stringify(块数组)`,见 buildCreatePayload
 * - 采样参数 `temperature/top_p/presence_penalty/frequency_penalty/seed/stop/
 *   response_format/max_output_tokens` 在整份 web bundle 中零出现 → 服务端固定,
 *   协议层无可发字段;其中 json mode 与 stop 由网关侧模拟(提示词 / 流式截断)
 * - `reasoning_effort_level` 是协议内真实字段,落在 `custom_model` 上,
 *   合法枚举由 model_list 的 `reasoning_effort_config.options` 给出
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  ChatExecuteOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamChatResult,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import {
  buildExchangeTokenBody,
  buildExchangeTokenProofBody,
  deviceMaterialFromSecrets,
  TRAE_EXCHANGE_TOKEN_COMBOS,
  TRAE_EXCHANGE_TOKEN_PROOF_URL as TRAE_EXCHANGE_TOKEN_PROOF_URL_DEFAULT,
  buildQueryBlocks,
  buildTraeCustomModel,
  createStopSequenceFilter,
  deriveBizSessionId,
  extractEntUsage,
  extractErrorInfo,
  extractGetUserTokenPayload,
  extractReasoningDelta,
  extractTextDelta,
  extractThoughtSnapshot,
  extractTokenPayload,
  extractUsage,
  flattenQuery,
  iterateSseEvents,
  normalizeEventName,
  responseFormatHint,
  TERMINAL_EVENT_NAMES,
  type OpenAiUsage,
} from './trae-protocol.js'
import { buildCookieHeader } from '../relay-account-format.js'

// =============================================================================
// 上游端点与 web 渠道指纹常量
// =============================================================================

/**
 * 端点可覆写档(2026-10-23 立):默认值 = 线上实证值,非生产档下允许用环境变量指到
 * 本机假上游,以便真跑协议线(见 tests/relay-trae-adapter-http.test.ts)。
 * 生产(NODE_ENV=production)一律吃死默认值 —— 环境变量不得把线上流量指走。
 */
function endpoint(name: string, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback
  const v = process.env[name]?.trim()
  if (!v || !/^https?:\/\//.test(v)) return fallback
  return v.replace(/\/$/, '')
}

/** remote 会话 API 基址(web 渠道,solo.trae.cn 前端同款) */
const TRAE_REMOTE_BASE = endpoint(
  'TRAE_REMOTE_BASE',
  'https://trae-api-cn.mchost.guru/api/remote/v1',
)
/** OAuth token 交换端点(无需 Authorization) */
const TRAE_EXCHANGE_TOKEN_URL = endpoint(
  'TRAE_EXCHANGE_TOKEN_URL',
  'https://api.trae.cn/cloudide/api/v3/trae/oauth/ExchangeToken',
)
/** 新版(设备证明)ExchangeToken 端点;可经 env 覆写供本机假上游联调 */
const TRAE_EXCHANGE_TOKEN_PROOF_URL = endpoint(
  'TRAE_EXCHANGE_TOKEN_PROOF_URL',
  TRAE_EXCHANGE_TOKEN_PROOF_URL_DEFAULT,
)
/** web 官网 cookie 换票端点(线上实证:credentials:'include' 纯靠 HttpOnly cookie,
 * 返回 Result{Token,ExpiredAt};web 号无 refreshToken 时的自动续票唯一通道) */
const TRAE_GET_USER_TOKEN_URL = endpoint(
  'TRAE_GET_USER_TOKEN_URL',
  'https://api.trae.cn/cloudide/api/v3/common/GetUserToken',
)
/** 换票请求的站点身份(请求出自 work.trae.cn 页面,与 chat 的 solo.trae.cn 不同源) */
const WEB_LOGIN_ORIGIN = 'https://work.trae.cn'
/** 模型列表端点(健康检查 + listModels 共用,轻量不耗配额) */
const TRAE_MODEL_LIST_URL = endpoint(
  'TRAE_MODEL_LIST_URL',
  'https://trae-api-cn.mchost.guru/api/ide/v1/model_list?type=chat',
)
/** 积分余额端点(线上实证 2026-10-23:带 `Authorization: Cloud-IDE-JWT` ⇒ 200 且回
 *  usage_summary;无凭据 ⇒ 401 body.code=1001。只读,不进调度轮询) */
const TRAE_ENT_USAGE_URL = endpoint(
  'TRAE_ENT_USAGE_URL',
  'https://api.trae.cn/trae/api/v2/pay/web_user_ent_usage',
)

const WEB_ORIGIN = 'https://solo.trae.cn'
const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
/** 线上 web 客户端版本(index.html 的 window.gfdatav1.ver;bundle 展示层从未硬编码) */
const WEB_APP_VERSION = process.env.TRAE_WEB_APP_VERSION?.trim() || '1.0.0.315'
/** web 客户端上报的浏览器时区(Intl 结果;容器无 tzdata 时回落 CN 默认值) */
const WEB_TIMEZONE =
  process.env.TRAE_USER_TIMEZONE?.trim() ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  'Asia/Shanghai'

/**
 * web 渠道请求头(线上实证:solo.trae.cn main bundle 858726/857014)。
 * - CN 配置 `includeUserRegionHeader:false` ⇒ 不发 `x-user-region`(多发即指纹偏差)
 * - `X-Trae-User-Timezone` 是浏览器 Intl 实时值,固定为 Asia/Shanghai 属可接受近似
 * - `X-Trae-Authorized-Services` 只在账号有 LINKED provider 时发送;本网关无此概念 ⇒ 不发
 * - 全链路无签名/nonce/hmac,设备头只出现在企业 frontier 链路,web chat 零 device-id
 */
function buildWebHeaders(jwt: string, accept: 'json' | 'sse'): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Cloud-IDE-JWT ${jwt}`,
    'X-Trae-Client-Type': 'web',
    'X-Preferenced-Language': 'zh-CN',
    'X-Trae-User-Timezone': WEB_TIMEZONE,
    Origin: WEB_ORIGIN,
    Referer: `${WEB_ORIGIN}/`,
    'User-Agent': WEB_USER_AGENT,
  }
  if (accept === 'json') headers['Content-Type'] = 'application/json'
  else headers['Accept'] = 'text/event-stream'
  return headers
}

// =============================================================================
// 鉴权失败错误(转发层据此触发 refreshToken 重试)
// =============================================================================

/** Trae 上游 401/403 鉴权失败(跨 realm 判定用 name,不依赖 instanceof 唯一途径) */
export class TraeAuthFailureError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, detail?: string) {
    super(`Trae 上游鉴权失败(HTTP ${statusCode})${detail ? `: ${detail.slice(0, 300)}` : ''}`)
    this.name = 'TraeAuthFailureError'
    this.statusCode = statusCode
  }
}

/** 是否为 Trae 鉴权失败错误(供转发层/测试判定) */
export function isTraeAuthFailure(e: unknown): boolean {
  if (e instanceof TraeAuthFailureError) return true
  return (
    typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'TraeAuthFailureError'
  )
}

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连)
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
      { ...(init ?? {}), dispatcher } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

/** 优先级:opts.fetchImpl(测试打桩)> opts.proxyUrl(账号级代理)> 全局直连 */
function resolveFetchImpl(opts: ChatExecuteOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

// =============================================================================
// 创建会话请求体
// =============================================================================

/**
 * 组装 chat_sessions 创建请求体(字段面对齐线上 web 客户端 `buildSendMessageRequest`)。
 * - model="auto" → model_selection_strategy:"auto" 且 model_name 留空、不带 custom_model
 * - 手动选模 → 附 `custom_model` 描述符(reasoning_effort_level / prompt_max_tokens 的载体)
 * - model 以 "-work" 结尾 → solo_work_remote 智能体 + mode:"work"
 * - query 用 JSON.stringify(块数组) 而非裸文本(线上实证形状)
 * - biz_session_id 用账号+模型恒定派生值(上游按会话做风控/配额,严禁随机)
 */
function buildCreatePayload(
  accountId: string,
  req: NormalizedChatRequest,
  modelConfig?: Record<string, unknown> | null,
): Record<string, unknown> {
  const model = req.model ?? ''
  const isWork = model.endsWith('-work')
  const isAuto = model === 'auto'
  // 登录态标识:uid 由导入时从 JWT `data.id` 解析;`auto:` 前缀 = 解不出(未登录形态)⇒ 不发
  const userId = accountId.startsWith('auto:') ? '' : accountId
  const commonParams: Record<string, unknown> = {
    language: 'zh-cn',
    app_language: 'zh-cn',
    quality: 'stable',
    app_version: WEB_APP_VERSION,
    user_identity: 'Free',
    is_freshman: '0',
    // CN 配置 teaScope/teaTenant 均为 marscode(8974:22591);旧值 marscode-cn 不存在于 bundle
    scope: 'marscode',
    tenant: 'marscode',
    region: 'cn',
    aiRegion: 'CN',
    is_privacy_mode: 0,
    privacy_mode: 'off',
    // 线上 `solo_chat_mode:(t=d.mode)?t:""` —— 跟随 code/work,不是固定 code
    solo_chat_mode: isWork ? 'work' : 'code',
    biz_session_id: deriveBizSessionId(accountId, model),
  }
  if (userId) {
    // 登录用户上下文(main bundle 890993):biz_user_id / user_unique_id 同源 userId
    commonParams.biz_user_id = userId
    commonParams.user_unique_id = userId
  }

  // response_format 兜底:上游无此字段。json_schema 已由网关注入过同文案提示,
  // 这里用 includes 去重,避免同一 schema 提示出现两次;json_object 在此首次注入。
  const baseQuery = flattenQuery(req.messages)
  const hint = responseFormatHint(req.responseFormat)
  const queryText =
    hint === null || baseQuery.includes(hint)
      ? baseQuery
      : baseQuery === ''
        ? `[System Instructions]\n${hint}`
        : `[System Instructions]\n${hint}\n\n${baseQuery}`

  const initialMessage: Record<string, unknown> = {
    chat_session_id: '',
    content: [],
    query: JSON.stringify(buildQueryBlocks(queryText)),
    model_name: isAuto ? '' : model,
    agent_type: isWork ? 'solo_work_remote' : 'solo_agent_remote',
    agent_id: isWork ? 'solo_work_remote' : 'solo_agent_remote',
    model_selection_strategy: isAuto ? 'auto' : 'manual',
    common_params: JSON.stringify(commonParams),
  }

  const customModel = buildTraeCustomModel(model, modelConfig, req.reasoningEffort)
  if (customModel) initialMessage.custom_model = customModel

  return {
    mode: isWork ? 'work' : 'code',
    environment_id: 'default',
    env: 'remote',
    auto_create_project: false,
    origin: 'web',
    initial_message: initialMessage,
  }
}

// =============================================================================
// model_list 模型元数据缓存(custom_model / reasoning 枚举的权威来源)
// =============================================================================

type TraeModelConfig = Record<string, unknown>

const MODEL_CONFIG_TTL_MS = 5 * 60_000
const modelConfigCache = new Map<string, { at: number; configs: TraeModelConfig[] }>()

/** 缓存键 = 账号 uid + token(换 token 即失效,避免跨账号串数据) */
function modelConfigCacheKey(ctx: AdapterAccountContext): string {
  return `${ctx.row.uid}\x1f${ctx.credentials.token}`
}

/** 宽松取 model_configs(兼容顶层与 data 包裹) */
function extractModelConfigs(body: unknown): TraeModelConfig[] | null {
  if (body === null || typeof body !== 'object') return null
  const top = body as Record<string, unknown>
  const candidates: unknown[] = [top.model_configs]
  if (top.data !== null && typeof top.data === 'object') {
    candidates.push((top.data as Record<string, unknown>).model_configs)
  }
  for (const c of candidates) {
    if (Array.isArray(c)) return c as TraeModelConfig[]
  }
  return null
}

/** 命中缓存(不论是否过期都返回,过期标记供调用方决定是否刷新) */
function readModelConfigCache(
  ctx: AdapterAccountContext,
): { fresh: boolean; configs: TraeModelConfig[] } | null {
  const entry = modelConfigCache.get(modelConfigCacheKey(ctx))
  if (!entry) return null
  return { fresh: Date.now() - entry.at <= MODEL_CONFIG_TTL_MS, configs: entry.configs }
}

function rememberModelConfigs(ctx: AdapterAccountContext, configs: TraeModelConfig[]): void {
  modelConfigCache.set(modelConfigCacheKey(ctx), { at: Date.now(), configs })
}

/** 拉取 model_list;失败抛错(调用方降级为无元数据,绝不阻断 chat) */
async function fetchModelConfigs(
  fetchImpl: typeof fetch,
  jwt: string,
  signal?: AbortSignal,
): Promise<TraeModelConfig[]> {
  const res = await fetchImpl(TRAE_MODEL_LIST_URL, {
    method: 'GET',
    headers: { Authorization: `Cloud-IDE-JWT ${jwt}`, Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    await res.body?.cancel().catch(() => {})
    throw new Error(`model_list HTTP ${res.status}`)
  }
  return extractModelConfigs(await res.json().catch(() => null)) ?? []
}

/**
 * 取模型元数据:新鲜缓存 → 直用;否则刷新,失败回退过期缓存(可用性优先)。
 * 典型场景:首个 chat 请求触发一次 model_list(轻量不耗配额),之后 5 分钟内复用。
 */
async function ensureModelConfigs(
  ctx: AdapterAccountContext,
  fetchImpl: typeof fetch,
  jwt: string,
  signal?: AbortSignal,
): Promise<TraeModelConfig[]> {
  const cached = readModelConfigCache(ctx)
  if (cached?.fresh) return cached.configs
  try {
    const configs = await fetchModelConfigs(fetchImpl, jwt, signal)
    rememberModelConfigs(ctx, configs)
    return configs
  } catch {
    return cached?.configs ?? []
  }
}

/** 按模型名挑 model_config(兼容 name / config_name;`-work` 后缀剥离) */
function pickModelConfig(configs: TraeModelConfig[], model: string): TraeModelConfig | null {
  const name = (model.endsWith('-work') ? model.slice(0, -5) : model).toLowerCase()
  for (const c of configs) {
    const candidates = [c.name, c.config_name]
    if (candidates.some((v) => typeof v === 'string' && v.toLowerCase() === name)) return c
  }
  return null
}

// =============================================================================
// 响应辅助
// =============================================================================

/** 非 2xx 统一处理:读 body 文本 → 401/403 抛鉴权错,其余抛带状态码与截断 body 的富分类错 */
async function failIfNotOk(res: Response, action: string): Promise<void> {
  if (res.ok) return
  const text = await res.text().catch(() => '')
  if (res.status === 401 || res.status === 403) {
    throw new TraeAuthFailureError(res.status, text)
  }
  throw new TraeUpstreamError(
    res.status,
    `Trae ${action} 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 500)}` : ''}`,
  )
}

/** 从创建响应里宽松取 chat_session_id / message_id(兼容 data 包裹与顶层) */
function extractSessionIds(body: unknown): { chatSessionId: string; messageId: string } {
  const top = (body ?? {}) as Record<string, unknown>
  const data =
    top.data !== null && typeof top.data === 'object' ? (top.data as Record<string, unknown>) : top
  const chatSessionId =
    typeof data.chat_session_id === 'string'
      ? data.chat_session_id
      : typeof top.chat_session_id === 'string'
        ? top.chat_session_id
        : ''
  const messageId =
    typeof data.message_id === 'string'
      ? data.message_id
      : typeof top.message_id === 'string'
        ? top.message_id
        : ''
  if (!chatSessionId || !messageId) {
    throw new Error('Trae 创建会话响应缺少 chat_session_id/message_id')
  }
  return { chatSessionId, messageId }
}

// =============================================================================
// 事件流 → OpenAI chunk 翻译
// =============================================================================

interface ChunkMeta {
  id: string
  model: string
  created: number
}

/** 标准 chat.completion.chunk 公共头部字段 */
function chunkBase(meta: ChunkMeta): Record<string, unknown> {
  return {
    id: meta.id,
    object: 'chat.completion.chunk',
    created: meta.created,
    model: meta.model,
  }
}

/**
 * Trae SSE 事件 → OpenAI chunk 异步序列。
 *
 * - 文本/推理增量 → delta 帧
 * - stop 序列:上游无 stop 字段,用流式安全过滤器截断文本(命中即终止)
 * - token_usage 帧 → usage 终帧(choices:[] + usage)
 * - error 帧(event:error 或 code/error/detail 形状)→ 终止并抛错(带 code)
 * - [DONE]/done/response_done/stream_done → 终止
 * - 流提前断开没见 done → 兜底补 finish_reason stop 帧([DONE] 由转发层统一补发)
 */
async function* translateUpstreamEvents(
  body: ReadableStream<Uint8Array>,
  meta: ChunkMeta,
  stops?: readonly string[],
): AsyncGenerator<Record<string, unknown>> {
  const stopFilter = createStopSequenceFilter(stops)
  // 线上实证(2026-10-23 真号抓帧):reasoning_content 与 thought 都是**累积快照**——
  // 每帧携带当前全文并随事件重发,不能当增量 append。记录已发长度,只放差量;
  // 快照回退(变短)按全量重发兜底。
  let lastThought = ''
  let lastReasoning = ''

  for await (const ev of iterateSseEvents(body)) {
    const name = normalizeEventName(ev.event)
    const data = ev.data.trim()
    if (data === '[DONE]' || TERMINAL_EVENT_NAMES.has(name)) break

    let obj: Record<string, unknown> | null = null
    if (data !== '') {
      try {
        const parsed: unknown = JSON.parse(data)
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          obj = parsed as Record<string, unknown>
        }
      } catch {
        obj = null // 非 JSON 帧:忽略,不中断流
      }
    }
    if (!obj) continue

    if (name === 'error') {
      const code = obj.code !== undefined && obj.code !== null ? String(obj.code) : 'unknown'
      throw new TraeUpstreamError(0, `Trae 上游错误帧(code=${code}): ${data.slice(0, 500)}`, code)
    }
    const err = extractErrorInfo(obj)
    if (err) {
      throw new TraeUpstreamError(
        0,
        `Trae 上游错误帧(code=${err.code}): ${err.message || '未知错误'}`,
        err.code,
      )
    }

    const usage = extractUsage(obj, name)
    if (usage) {
      yield { ...chunkBase(meta), choices: [], usage }
      continue
    }

    const reasoningSnap = extractReasoningDelta(obj)
    if (reasoningSnap !== null) {
      const inc = reasoningSnap.startsWith(lastReasoning)
        ? reasoningSnap.slice(lastReasoning.length)
        : reasoningSnap
      if (inc !== '') {
        yield {
          ...chunkBase(meta),
          choices: [{ index: 0, delta: { reasoning_content: inc }, finish_reason: null }],
        }
      }
      lastReasoning = reasoningSnap
    }
    const thought = extractThoughtSnapshot(obj)
    if (thought !== null) {
      const inc = thought.startsWith(lastThought) ? thought.slice(lastThought.length) : thought
      if (inc !== '') {
        const filtered = stopFilter ? stopFilter.feed(inc) : { emit: inc, hit: false }
        if (filtered.emit !== '') {
          yield {
            ...chunkBase(meta),
            choices: [{ index: 0, delta: { content: filtered.emit }, finish_reason: null }],
          }
        }
        if (filtered.hit) break
      }
      lastThought = thought
    }
    if (reasoningSnap !== null || thought !== null) continue
    const text = extractTextDelta(obj)
    if (text !== null) {
      const filtered = stopFilter ? stopFilter.feed(text) : { emit: text, hit: false }
      if (filtered.emit !== '') {
        yield {
          ...chunkBase(meta),
          choices: [{ index: 0, delta: { content: filtered.emit }, finish_reason: null }],
        }
      }
      if (filtered.hit) {
        break // 命中 stop:取消上游流(见 iterateSseEvents finally)+ 收尾 stop
      }
    }
    // 其余事件(request_wait_in_queue / model_config 无增量等)忽略,不中断流
  }

  // 正常结束时放出被扣住的尾部余量(命中 stop 时为空串)
  if (stopFilter) {
    const tail = stopFilter.flush()
    if (tail !== '') {
      yield {
        ...chunkBase(meta),
        choices: [{ index: 0, delta: { content: tail }, finish_reason: null }],
      }
    }
  }

  // 兜底/收尾:无论正常 done 还是流提前断开,都补 finish_reason stop 帧
  yield {
    ...chunkBase(meta),
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  }
}

/** 在翻译序列外包一层"迭代结束即尽力 stop"的清理,失败一律忽略 */
function withStopCleanup(
  gen: AsyncGenerator<Record<string, unknown>>,
  stop: () => Promise<void>,
): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    try {
      yield* gen
    } finally {
      await stop().catch(() => {})
    }
  })()
}

// =============================================================================
// 适配器
// =============================================================================

const MULTI_PATH_MSG = 'trae 走 executeChat 多段式路径'

export const traeAdapter: RelayUpstreamAdapter = {
  providerCode: 'trae',

  buildChatRequest(_ctx: AdapterAccountContext, _req: NormalizedChatRequest): UpstreamHttpRequest {
    throw new Error(MULTI_PATH_MSG)
  },

  translateStreamChunk(
    _ctx: AdapterAccountContext,
    _rawFrame: string,
    _state: StreamState,
  ): TranslatedChunk | null {
    throw new Error(MULTI_PATH_MSG)
  },

  translateNonStream(_ctx: AdapterAccountContext, _responseBody: unknown): Record<string, unknown> {
    throw new Error(MULTI_PATH_MSG)
  },

  /**
   * 多段式执行入口:创建回合 → 拉事件流 → 翻译为 OpenAI chunk 序列。
   * 非流式(req.stream=false)内部仍走流式再本地聚合(上游无同步端点)。
   */
  async executeChat(
    ctx: AdapterAccountContext,
    req: NormalizedChatRequest,
    opts: ChatExecuteOptions,
  ): Promise<UpstreamChatResult> {
    const fetchImpl = resolveFetchImpl(opts)
    const jwt = ctx.credentials.token
    const meta: ChunkMeta = {
      id: '',
      model: req.model,
      created: Math.floor(Date.now() / 1000),
    }

    // 模型元数据(5 分钟缓存):custom_model / reasoning_effort 合法枚举 / 上下文窗口的来源。
    // 拉取失败不阻断 chat —— 降级为仅模型名的 preset 描述符。
    const modelConfigs = await ensureModelConfigs(ctx, fetchImpl, jwt, opts.signal)
    const modelConfig = pickModelConfig(modelConfigs, req.model ?? '')

    // 第 1 步:创建回合
    const createRes = await fetchImpl(`${TRAE_REMOTE_BASE}/chat_sessions`, {
      method: 'POST',
      headers: buildWebHeaders(jwt, 'json'),
      body: JSON.stringify(buildCreatePayload(ctx.row.uid, req, modelConfig)),
      signal: opts.signal,
    })
    await failIfNotOk(createRes, '创建会话')
    const createBody: unknown = await createRes.json().catch(() => null)
    const { chatSessionId, messageId } = extractSessionIds(createBody)
    meta.id = chatSessionId

    // 第 2 步:拉事件流
    const eventsUrl = `${TRAE_REMOTE_BASE}/chat_sessions/${encodeURIComponent(chatSessionId)}/events?reply_to_message_id=${encodeURIComponent(messageId)}`
    const eventsRes = await fetchImpl(eventsUrl, {
      method: 'GET',
      headers: buildWebHeaders(jwt, 'sse'),
      signal: opts.signal,
    })
    await failIfNotOk(eventsRes, '拉取事件流')
    const streamBody = eventsRes.body
    if (!streamBody) throw new Error('Trae 事件流响应无 body')

    // 收尾 stop:尽力而为,失败忽略
    const stopUrl = `${TRAE_REMOTE_BASE}/chat_sessions/${encodeURIComponent(chatSessionId)}/stop`
    const stop = async (): Promise<void> => {
      await fetchImpl(stopUrl, {
        method: 'POST',
        headers: buildWebHeaders(jwt, 'json'),
        // 线上 stopSession({chat_session_id, user_message_id})(8974:1005545);
        // 缺 user_message_id 时上游只返回 code -1(找不到最后一条用户消息)
        body: JSON.stringify({ chat_session_id: chatSessionId, user_message_id: messageId }),
      }).then(async (r) => {
        await r.body?.cancel()
      })
    }

    const chunkStream = withStopCleanup(
      translateUpstreamEvents(streamBody as ReadableStream<Uint8Array>, meta, req.stop),
      stop,
    )

    if (req.stream) return { stream: chunkStream }

    // 非流式:本地聚合完整 completion
    let content = ''
    let reasoning = ''
    let usage: OpenAiUsage | null = null
    let finishReason = 'stop'
    for await (const chunk of chunkStream) {
      const u = chunk.usage
      if (u !== null && typeof u === 'object') usage = u as OpenAiUsage
      const choices = chunk.choices
      if (Array.isArray(choices)) {
        for (const raw of choices) {
          const ch = raw as { delta?: Record<string, unknown>; finish_reason?: string | null }
          const deltaContent = ch.delta?.content
          if (typeof deltaContent === 'string') content += deltaContent
          const deltaReasoning = ch.delta?.reasoning_content
          if (typeof deltaReasoning === 'string') reasoning += deltaReasoning
          if (typeof ch.finish_reason === 'string' && ch.finish_reason !== '') {
            finishReason = ch.finish_reason
          }
        }
      }
    }
    const message: Record<string, unknown> = { role: 'assistant', content }
    if (reasoning !== '') message.reasoning_content = reasoning
    return {
      completion: {
        id: chatSessionId,
        object: 'chat.completion',
        created: meta.created,
        model: req.model,
        choices: [{ index: 0, message, finish_reason: finishReason }],
        usage: usage ?? {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          prompt_tokens_details: { cached_tokens: 0 },
          completion_tokens_details: { reasoning_tokens: 0 },
        },
      },
    }
  },

  /**
   * Token 刷新,三条通道:
   * 1. web 号(cookie 换票):账号有 cookies → POST GetUserToken(纯靠 Cookie,无 body 无
   *    Authorization),换出 ~6h 新 JWT。线上实证通道,web 号(无 refreshToken)的唯一续命方式。
   * 2. IDE 号 · 设备证明档:账号带设备材料(deviceId + secrets 里的密钥对)→ 走新版
   *    ExchangeToken(DeviceProof 签名)。桌面渠道签发的票只认这条路 —— 2026-10-25 实测:
   *    旧通道对桌面票恒回 10101 "refresh token is not matched to the client"。
   * 3. IDE 号·旧通道:无设备材料时的原 ExchangeToken(web 渠道票)。
   * cookie 路径失败且有 rt → 落回 IDE 通道;两条都不可用 → null;HTTP 失败 → 抛错(调度器计数摘除)。
   * opts.proxyUrl 非空时走账号级代理(与 chat 同出口 IP,防 Trae 风控因 IP 漂移触发校验)。
   */
  async refreshToken(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    const rt = ctx.credentials.refreshToken
    const cookieHeader = buildCookieHeader(ctx.credentials.cookies)
    const doFetch = resolveFetchImpl(opts ?? {})
    if (cookieHeader) {
      try {
        const res = await doFetch(TRAE_GET_USER_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Origin: WEB_LOGIN_ORIGIN,
            Referer: `${WEB_LOGIN_ORIGIN}/`,
            'User-Agent': WEB_USER_AGENT,
          },
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new TraeUpstreamError(
            res.status,
            `Trae GetUserToken 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
          )
        }
        const body: unknown = await res.json().catch(() => null)
        const payload = extractGetUserTokenPayload(body)
        if (!payload) throw new Error('Trae GetUserToken 响应无 Token')
        return {
          token: payload.token,
          // undefined = 调度器保留原 refreshTokenEnc(web 号本无 rt,IDE 号不丢 rt)
          refreshToken: undefined,
          expiresAt: payload.expiresAt,
        }
      } catch (e) {
        if (!rt) throw e
        // 有 rt:cookie 路径失败,落回 ExchangeToken
      }
    }
    if (!rt) return null
    const material = deviceMaterialFromSecrets(
      ctx.credentials.secrets,
      ctx.row.deviceId,
      ctx.row.machineId,
    )
    if (material) {
      // 「ClientID × 产品线」组合链:票由哪条线签发就只能用哪条线续。
      // 10101(rt 与客户端不匹配)/ 20403(设备与票不匹配)⇒ 换下一组再试;
      // 其余 HTTP 错直接抛(sweep 计数),别把网络故障误判成"票坏了"。
      // 失败尝试不轮换 rt(只有 2xx 才换),所以同一枚票可以安全地多组试。
      let lastProof: { status: number; text: string } | null = null
      for (const combo of TRAE_EXCHANGE_TOKEN_COMBOS) {
        const resProof = await doFetch(TRAE_EXCHANGE_TOKEN_PROOF_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cloudide-token': '' },
          body: JSON.stringify(
            buildExchangeTokenProofBody({
              ...material,
              ...combo,
              refreshToken: rt,
            }),
          ),
        })
        if (resProof.ok) {
          const body: unknown = await resProof.json().catch(() => null)
          const payload = extractTokenPayload(body)
          if (!payload) throw new Error('Trae ExchangeToken(设备证明) 响应无 Token')
          return {
            token: payload.token,
            refreshToken: payload.refreshToken,
            expiresAt: payload.expiresAt ?? null,
          }
        }
        const text = await resProof.text().catch(() => '')
        lastProof = { status: resProof.status, text }
        if (!/10101|20403/.test(text)) {
          throw new TraeUpstreamError(
            resProof.status,
            `Trae ExchangeToken(设备证明) 失败(HTTP ${resProof.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
          )
        }
      }
      // 全部组合都被"票/设备不匹配"拒 ⇒ 落回旧通道,让错误以原口径暴露
      void lastProof
    }
    const res = await doFetch(TRAE_EXCHANGE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildExchangeTokenBody(rt)),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new TraeUpstreamError(
        res.status,
        `Trae ExchangeToken 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
      )
    }
    const body: unknown = await res.json().catch(() => null)
    const payload = extractTokenPayload(body)
    if (!payload) throw new Error('Trae ExchangeToken 响应无 Token')
    return {
      token: payload.token,
      refreshToken: payload.refreshToken,
      // 上游未给/给不出可解析的过期时刻 → 保守兜底 24h(临期刷新 + 401 自愈双保险)
      expiresAt: payload.expiresAt ?? new Date(Date.now() + 24 * 3600_000),
    }
  },

  /**
   * 轻量健康检查 —— 按凭据链自证,不再单押 model_list(2026-10-23 重构)。
   *
   * 立因:此前唯一判据是 GET model_list;该端点属模型元数据面,2026-10-23 线上对
   * 任何凭据都回 500,而旧实现把非 2xx 一律写 down ⇒ 好号被误杀、面板 false alarm。
   *
   * 现行判据:
   * - web 号(有 cookie):POST GetUserToken。这既是它唯一的续命通道,也是凭据活性的
   *   最权威自证 —— 能换回 Token 就是活着;换不到 401/403 才是死。
   * - IDE 号(无 cookie):GET model_list(2xx + model_configs ⇒ healthy,顺带暖缓存)。
   * - 5xx / 网络异常 / 响应形状不符 → indeterminate(未判定),交调度器保留 unknown 复检。
   */
  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
    const doFetch = resolveFetchImpl(opts ?? {})
    const cookieHeader = buildCookieHeader(ctx.credentials.cookies)
    if (cookieHeader) {
      try {
        const res = await doFetch(TRAE_GET_USER_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Origin: WEB_LOGIN_ORIGIN,
            Referer: `${WEB_LOGIN_ORIGIN}/`,
            'User-Agent': WEB_USER_AGENT,
          },
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          const rejected = res.status === 401 || res.status === 403
          return {
            ok: false,
            indeterminate: !rejected,
            authFailed: rejected,
            error: `GetUserToken HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
              rejected ? '' : '(未判定)'
            }`,
          }
        }
        const payload = extractGetUserTokenPayload(await res.json().catch(() => null))
        if (!payload) {
          return { ok: false, indeterminate: true, error: 'GetUserToken 响应无 Token(未判定)' }
        }
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          indeterminate: true,
          error: `GetUserToken ${e instanceof Error ? e.message : String(e)}(未判定)`,
        }
      }
    }
    try {
      const res = await doFetch(TRAE_MODEL_LIST_URL, {
        method: 'GET',
        headers: {
          Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const rejected = res.status === 401 || res.status === 403
        // 5xx = 元数据端点自身故障,不是"凭据死"的结论。2026-10-24 线上实证:
        // model_list 对已认证请求恒 500,而同一枚 token 打 ent_usage 得 200 ⇒ 退到
        // ent_usage 自证凭据活性;否则活号会被一轮轮写成 down(比"未判定"更糟:直接摘除)。
        if (!rejected && res.status >= 500) {
          const fallback = await doFetch(TRAE_ENT_USAGE_URL, {
            method: 'GET',
            headers: {
              Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
              Accept: 'application/json',
            },
          })
          if (fallback.ok) return { ok: true }
          const fbRejected = fallback.status === 401 || fallback.status === 403
          return {
            ok: false,
            indeterminate: !fbRejected,
            authFailed: fbRejected,
            error: `model_list HTTP ${res.status};ent_usage HTTP ${fallback.status}${
              fbRejected ? '' : '(未判定)'
            }`,
          }
        }
        return {
          ok: false,
          indeterminate: !rejected,
          authFailed: rejected,
          error: `model_list HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
            rejected ? '' : '(未判定)'
          }`,
        }
      }
      const configs = extractModelConfigs(await res.json().catch(() => null))
      if (!configs) {
        return {
          ok: false,
          indeterminate: true,
          error: 'model_list 响应缺少 model_configs(未判定)',
        }
      }
      // 健康检查顺带暖缓存:后续 chat 的 custom_model 直接复用
      rememberModelConfigs(ctx, configs)
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        indeterminate: true,
        error: `model_list ${e instanceof Error ? e.message : String(e)}(未判定)`,
      }
    }
  },

  /** 模型列表:同健康检查端点,返回 model_configs[].name */
  async listModels(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<string[]> {
    const res = await resolveFetchImpl(opts ?? {})(TRAE_MODEL_LIST_URL, {
      method: 'GET',
      headers: {
        Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new TraeUpstreamError(
        res.status,
        `Trae model_list 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
      )
    }
    const configs = extractModelConfigs(await res.json().catch(() => null)) ?? []
    if (configs.length > 0) rememberModelConfigs(ctx, configs)
    return configs
      .map((c) => (typeof c?.name === 'string' ? c.name : null))
      .filter((n): n is string => n !== null && n !== '')
  },

  /**
   * 积分余额按需查询(管理面点查;不进健康检查轮询,不消耗对话配额)。
   * 永不抛:一切失败归 ok:false —— "取不到"不得被读成"余额为零"(§0.3)。
   */
  async getQuota(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult> {
    try {
      const cookieHeader = buildCookieHeader(ctx.credentials.cookies)
      const res = await resolveFetchImpl(opts ?? {})(TRAE_ENT_USAGE_URL, {
        method: 'GET',
        headers: {
          Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
          Accept: 'application/json',
          // 该端点属 web 域(api.trae.cn):线上那次 200 是在页面上下文带 cookie 取到的;
          // 只发 Authorization 是否够用,本机无法证明(唯一在册号的会话已被上游整体拒收,
          // JWT、cookie、两者叠加、无凭据四型同回 401 code 1001)。⇒ 取超集:
          // JWT + cookie + 站点身份头(与 GetUserToken 同一组常量,该端点已实证接受这套指纹)。
          Origin: WEB_LOGIN_ORIGIN,
          Referer: `${WEB_LOGIN_ORIGIN}/`,
          'User-Agent': WEB_USER_AGENT,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          // 鉴权失效判定与 isAuthFailure 同源(状态码当场量得),供承载层触发自愈
          authFailed: traeAdapter.isAuthFailure(res.status, text),
          error: `web_user_ent_usage HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        }
      }
      const usage = extractEntUsage(await res.json().catch(() => null))
      if (!usage) {
        return { ok: false, error: 'web_user_ent_usage 响应无 usage_summary ⇒ 未判定' }
      }
      const remaining =
        usage.total > 0 && usage.used >= 0 && usage.used <= usage.total
          ? usage.total - usage.used
          : undefined
      const endAts = usage.packs.map((p) => p.endAt).filter((e): e is string => e !== undefined)
      return {
        ok: true,
        quota: {
          used: usage.used,
          total: usage.total,
          remaining,
          ratio: usage.ratio,
          unit: 'trae 积分',
          resetsAt: endAts.length > 0 ? endAts.sort()[0] : undefined,
          packs: usage.packs,
        },
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  isAuthFailure(statusCode: number, bodyText: string): boolean {
    if (statusCode === 401 || statusCode === 403) return true
    const lower = bodyText.toLowerCase()
    return lower.includes('authentication_error') || lower.includes('unauthorized')
  },

  /** executeChat / refreshToken 抛出的鉴权失败(401/403)→ 触发刷新自愈与到期列收敛 */
  isAuthError(err: unknown): boolean {
    if (isTraeAuthFailure(err)) return true
    // refreshToken 的 HTTP 失败抛 TraeUpstreamError(带 statusCode),401/403 同属明确拒收
    return err instanceof TraeUpstreamError && (err.statusCode === 401 || err.statusCode === 403)
  },

  /** 富分类:与独立导出函数同源;network 归入 client(接口只接受 8 类) */
  classifyUpstreamFailure(statusCode: number, bodyText: string) {
    const kind = classifyUpstreamFailure(statusCode, bodyText)
    return { kind: kind === 'network' ? ('client' as const) : kind }
  },
}

// =============================================================================
// 上游失败富分类(供转发层按语义冷却/摘除,不再一律归为 network)
// =============================================================================

/** 与 relay-account-forwarder.ts 的 FailureKind 保持一致 */
export type FailureKind =
  | 'auth'
  | 'credit'
  | 'session_dead'
  | 'risk'
  | 'rate'
  | 'not_found'
  | 'request'
  | 'server'
  | 'client'
  | 'network'

/** 消息摘要里的敏感值打码(token/cookie 等键值);正文只保留可读片段 */
function redactUpstreamSummary(text: string): string {
  return text.replace(
    /("?(?:access_token|refresh_token|token|cookie|authorization)"?\s*[:=]\s*"?)([^"\s,;}]+)/gi,
    '$1***',
  )
}

/**
 * Trae 上游非鉴权失败(带 HTTP 状态码与可选上游业务码)。
 * 无 HTTP 状态时 statusCode=0(典型:SSE error 帧);消息截断 500 字防泄漏/防日志膨胀。
 */
export class TraeUpstreamError extends Error {
  readonly statusCode: number
  readonly upstreamCode?: number | string

  constructor(statusCode: number, message: string, upstreamCode?: number | string) {
    super(redactUpstreamSummary(message).slice(0, 500))
    this.name = 'TraeUpstreamError'
    this.statusCode = statusCode
    this.upstreamCode = upstreamCode
  }
}

const CREDIT_HINTS = ['额度', '积分', 'quota', 'insufficient', 'balance'] as const
const SESSION_DEAD_HINTS = [
  '登录失效',
  '请重新登录',
  'login required',
  'session expired',
  'token expired',
  '未授权',
  '会话过期',
] as const
const REQUEST_HINTS = [
  '参数',
  '长度',
  'context length',
  'invalid',
  'unsupported',
  '审核',
  '敏感',
] as const
/** 风控类提示词:文本面兜底(错误码解析不到时才看它) */
const RISK_HINTS = [
  '风险',
  '风控',
  '账号异常',
  '设备异常',
  '环境异常',
  'risk control',
  'risk_control',
  'account risk',
  'banned',
] as const

/**
 * 官方/社区实证的风控业务码(Trae 错误体形如 {code:4015,message:...})。
 * - 4015 账号或 IP 风险 / 4010 风险账号自动登出 / 4013 IP 地区禁用 / 4019 设备或签到风险
 * - 3004 / 4007 限流;4008 额度耗尽;4011 / 4021 日上限
 */
const RISK_CODES = new Set([4010, 4013, 4015, 4019])
const RATE_CODES = new Set([3004, 4007])
const CREDIT_CODES = new Set([4008, 4011, 4021])

function pickUpstreamCode(body: unknown, depth = 0): number | null {
  if (body === null || typeof body !== 'object' || depth > 3) return null
  const o = body as Record<string, unknown>
  for (const key of ['code', 'error_code', 'status_code']) {
    const v = o[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && /^-?\d{3,7}$/.test(v)) return Number(v)
  }
  for (const key of ['error', 'data', 'response', 'result']) {
    const nested = pickUpstreamCode(o[key], depth + 1)
    if (nested !== null) return nested
  }
  return null
}

/** 从错误体提取 Trae 业务码:优先 JSON,兜底 `code:4015` 文本扫描(抛出异常时只剩 message) */
export function extractUpstreamCode(bodyText: string): number | null {
  try {
    const parsed: unknown = JSON.parse(bodyText)
    const code = pickUpstreamCode(parsed)
    if (code !== null) return code
  } catch {
    /* 非 JSON 体走文本扫描 */
  }
  const m = /"?code"?\s*[:=]\s*"?(-?\d{3,7})\b/i.exec(bodyText)
  return m && m[1] !== undefined ? Number(m[1]) : null
}

function hitsAny(lowerText: string, hints: readonly string[]): boolean {
  return hints.some((h) => lowerText.includes(h))
}

/**
 * 上游失败分类:先看业务错误码(4015/4019/4010/4013 等),再看文本与 HTTP 状态。
 * 0 状态且文本无命中 → network;其余未知 → client。
 */
export function classifyUpstreamFailure(status: number, bodyText: string): FailureKind {
  const lower = bodyText.toLowerCase()
  const code = extractUpstreamCode(bodyText)
  if (code !== null) {
    if (RISK_CODES.has(code)) return 'risk'
    if (RATE_CODES.has(code)) return 'rate'
    if (CREDIT_CODES.has(code)) return 'credit'
  }
  if (hitsAny(lower, RISK_HINTS)) return 'risk'
  if (hitsAny(lower, CREDIT_HINTS)) return 'credit'
  if (hitsAny(lower, SESSION_DEAD_HINTS)) return 'session_dead'

  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate'
  if (status === 404) return 'not_found'
  if (status === 402) return 'credit'
  if (status >= 500 && status <= 599) return 'server'
  if (status === 400 || status === 413 || status === 422) return 'request'
  if (hitsAny(lower, REQUEST_HINTS)) return 'request'
  if (status === 0) return 'network'
  return 'client'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
