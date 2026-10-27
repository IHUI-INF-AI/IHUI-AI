// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 平台上游适配器注册表(2026-10-22 立,对标码道网关 CodeArtsGateway)。
 *
 * 每个平台(Trae / WorkBuddy / CodeArts)实现 RelayUpstreamAdapter 接口并注册到这里,
 * 供三条链路复用:
 * 1. 转发链路(relay-account-forwarder):buildChatRequest → 上游调用 → translateStreamChunk
 * 2. 调度器临期刷新 / 401 自愈:refreshToken
 * 3. admin 健康检查 / 模型列表:checkHealth / listModels
 *
 * 上游协议细节(端点/头/请求体/SSE 帧)全部封装在各平台实现内,链路层不感知。
 */
import { type AiRelayAccountPool } from '@ihui/database'
import type { AccountCredentials } from './relay-account-pool-service.js'
import { isRelayProviderCode, type RelayProviderCode } from './relay-account-format.js'

// =============================================================================
// 类型
// =============================================================================

/** 适配器拿到的账号上下文(凭证已解密,仅进程内使用,严禁写日志/响应) */
export interface AdapterAccountContext {
  row: AiRelayAccountPool
  credentials: AccountCredentials
}

/**
 * 健康检查三态语义(2026-10-23 立,与 §0.3「取不到 ≠ 失效」同源):
 * - `ok:true` → healthy
 * - `ok:false` + `indeterminate:true` → 上游暂时给不出判定依据(5xx / 网络 / 形状不符),
 *   **不得**写 down,保留 unknown 待下轮复检(避免上游抖动把好号误杀)
 * - `ok:false` 且无 indeterminate → 凭据被上游明确拒收(401/403 / 业务鉴权错)→ down
 */
export interface HealthCheckResult {
  ok: boolean
  error?: string
  indeterminate?: boolean
  /**
   * 上游**明确拒收**该凭据(401/403 / 业务鉴权错)。承载层据此在同一次写里把
   * tokenExpiresAt 收敛到当下 —— 到期列只是「可能仍可用」的弱证据,不得与拒收态背离。
   * 5xx / 网络 / 形状不符一律不得置真(那些走 indeterminate)。
   */
  authFailed?: boolean
}

/** 归一化的 chat 请求(OpenAI 形状,由转发层从客户端请求转换而来) */
export interface NormalizedChatRequest {
  model: string
  messages: Array<{ role: string; content: unknown }>
  temperature?: number
  maxTokens?: number
  stream: boolean
  /** 会话亲和 id(部分平台需要 conversation/session id 字段) */
  conversationId?: string
  /** OpenAI tools 函数调用原样透传(适配器按平台规则归一/改写) */
  tools?: unknown[]
  /** tool_choice 原样透传(WorkBuddy 上游需字符串归一) */
  toolChoice?: unknown
  /** OpenAI response_format 原样透传(JSON mode 等) */
  responseFormat?: unknown
  /** 采样确定性种子 */
  seed?: number
  /** 核采样(top_p),与 temperature 同属采样面 */
  topP?: number
  /** 频率/存在惩罚(OpenAI -2..2) */
  presencePenalty?: number
  frequencyPenalty?: number
  /** 并行工具调用开关 */
  parallelToolCalls?: boolean
  /** 终端用户标识(OpenAI user 字段,仅透传,不做鉴权) */
  user?: string
  /** 服务等级(OpenAI service_tier;上游不支持时忽略) */
  serviceTier?: string
  /**
   * 采样面补集(与 relay-upstream-forwarder 的 UpstreamForwardRequest 同键同型,
   * 2026-10-23 补齐:客户端面早有这三枚,归一契约缺位让消费方无处可接)。
   * 协议不接受的平台直接忽略该字段。
   */
  topK?: number
  repetitionPenalty?: number
  logitBias?: Record<string, number>
  /**
   * reasoning_effort 原样透传(OpenAI 语义 low/medium/high 等)。
   * Trae 落 `custom_model.reasoning_effort_level`,其余平台按原生字段透传。
   */
  reasoningEffort?: string | number
  /** stop 序列(协议无此字段的平台由适配器本地截断) */
  stop?: string[]
}

/** 适配器构造出的上游 HTTP 请求(转发层负责真正发出 + 代理出口) */
export interface UpstreamHttpRequest {
  url: string
  method: 'POST' | 'GET'
  headers: Record<string, string>
  /** JSON 请求体(与 rawBody 二选一) */
  body?: unknown
  rawBody?: string
}

/** token 刷新结果(转发层/调度器据此回写号池) */
export interface TokenRefreshResult {
  token: string
  refreshToken?: string | null
  /**
   * access token 到期时刻,**只许取上游响应当场给出的值**。
   * 上游未给/解析不出 ⇒ null(= 未知,库里就写 null);禁止沿用旧值或编造兜底时刻 ——
   * 该列曾被用来冒充「票仍可用」(2026-10-23 票:列记未来时刻而上游回 401)。
   */
  expiresAt: Date | null
  /**
   * 平台扩展敏感凭证整包(可选)。CodeArts 刷新会轮转**整套** STS 凭据(AK/SK/security_token),
   * 调度器据此 encryptField(JSON.stringify(...)) 回写 secretsEnc。
   */
  secrets?: Record<string, unknown>
}

/** 上游流式帧翻译结果(OpenAI chunk JSON 字符串,或 null = 忽略该帧) */
export interface TranslatedChunk {
  /** OpenAI chat.completion.chunk 形状对象;转发层序列化为 SSE data: 帧 */
  openaiChunk: Record<string, unknown>
  /** 是否终止帧([DONE] 由转发层统一补发) */
  done?: boolean
}

/** executeChat 的执行选项(转发层注入) */
export interface ChatExecuteOptions {
  signal?: AbortSignal
  /** 账号级出口代理(行.proxyUrl;null = 直连) */
  proxyUrl?: string | null
  /** fetch 注入点(测试打桩用;缺省 globalThis.fetch) */
  fetchImpl?: typeof fetch
}

/**
 * 生命周期调用(refresh/健康检查/模型列表)的执行选项。
 * 对标码道:凭证刷新与健康探测必须与 chat 走同一出口 IP,否则上游风控
 * (Trae 设备指纹/WorkBuddy 会话域)会因 IP 漂移触发额外校验。
 */
export interface AdapterCallOptions {
  proxyUrl?: string | null
  fetchImpl?: typeof fetch
}

/** executeChat 的返回:流式 = OpenAI chunk 异步序列;非流式 = 完整 completion */
export interface UpstreamChatResult {
  stream?: AsyncIterable<Record<string, unknown>>
  completion?: Record<string, unknown>
}

/**
 * 上游余额/配额查询结果(管理面按需展示,不进健康检查轮询)。
 * 平台给得到哪些字段就给哪些:trae 给 used/total/ratio(积分制),
 * qoder 只给 remaining(add-on credits)。全未知 ⇒ ok:false,不得用 0 冒充"余额为零"。
 * ok:false 时 quota 为空;平台无余额端点则适配器不实现本方法。
 */
export interface RelayQuotaResult {
  ok: boolean
  error?: string
  /**
   * 本次失败是否属"鉴权失效"。由适配器按**上游 HTTP 状态码**(它自己当场拿到的数)判定,
   * 不由承载层去匹配错误文案(§check-error-code-not-text-matching)。
   * 库里的 tokenExpiresAt 实测不可信(上游已回 401 而库里仍记着未来到期时刻),
   * 故承载层的刷新自愈必须以这一枚标志为准,而不是以时间戳为准。
   */
  authFailed?: boolean
  quota?: {
    used?: number
    total?: number
    /** 剩余量(平台直接给剩余时的首选字段) */
    remaining?: number
    /** consumed/total,0..1 */
    ratio?: number
    /** 原始单位说明(如 trae 积分) */
    unit?: string
    resetsAt?: string
    /** 订阅档名(workbuddy 实证:summary 的 SubscriptionPackageName,如"体验版";可选) */
    subscriptionName?: string
    packs?: Array<{ name?: string; limit?: number; remaining?: number; endAt?: string }>
  }
}

/** 余额查询的执行选项(与 AdapterCallOptions 同形,单独命名便于语义区分) */
export type QuotaCallOptions = AdapterCallOptions

export interface RelayUpstreamAdapter {
  providerCode: RelayProviderCode
  /** 构造上游 chat 请求(单段式协议;两段式协议平台改实现 executeChat) */
  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest
  /** 上游流式帧 → OpenAI chunk(逐帧);非流式响应整体翻译 */
  translateStreamChunk(
    ctx: AdapterAccountContext,
    rawFrame: string,
    state: StreamState,
  ): TranslatedChunk | null
  translateNonStream(ctx: AdapterAccountContext, responseBody: unknown): Record<string, unknown>
  /**
   * 多段式上游协议(如 Trae remote:创建会话 → 拉事件流)的整体执行入口。
   * 定义后转发层直接调用它(适配器自己发 fetch);未定义则走
   * buildChatRequest → fetch → translateStreamChunk 的通用单请求路径。
   */
  executeChat?(
    ctx: AdapterAccountContext,
    req: NormalizedChatRequest,
    opts: ChatExecuteOptions,
  ): Promise<UpstreamChatResult>
  /** token 临期刷新 / 401 自愈;返回 null = 该平台无需/无法刷新(opts.proxyUrl 应透传上游) */
  refreshToken?(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null>
  /** 轻量健康检查(不得消耗大量配额;失败返回 ok:false + 原因;三态语义见 HealthCheckResult) */
  checkHealth(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<HealthCheckResult>
  /** 上游模型列表(可空:平台无此端点时健康检查退化为最小 chat 探测) */
  listModels?(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<string[]>
  /**
   * 余额/配额查询(可选:平台无已知端点则不实现,管理面显示"未支持")。
   * 按需调用(管理面点查),不进调度轮询;永不抛(失败归 ok:false)。
   */
  getQuota?(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult>
  /** 上游响应是否 401/会话失效(触发 401 自愈刷新重试一次) */
  isAuthFailure(statusCode: number, bodyText: string): boolean
  /** executeChat 路径抛出的异常是否为鉴权失效(等价于 isAuthFailure 的异常形态) */
  isAuthError?(err: unknown): boolean
  /**
   * 富错误分类(可选,对标码道分级冷却):转发层据此决定「罚不罚号、罚多久」。
   * - credit(积分耗尽)→ 12h 冷却 + 摘除;rate → 60s;session_dead → 永久摘除
   * - not_found → 短冷却不计数;request(参数级)→ 不罚号直接透传
   * 未实现时转发层回退 isAuthFailure + HTTP 状态粗分类。
   */
  classifyUpstreamFailure?(
    statusCode: number,
    bodyText: string,
  ): {
    kind:
      | 'auth'
      | 'credit'
      | 'session_dead'
      | 'risk'
      | 'rate'
      | 'not_found'
      | 'request'
      | 'server'
      | 'client'
  }
}

/** 流式翻译的跨帧状态(每请求一个实例,由转发层创建持有) */
export interface StreamState {
  [k: string]: unknown
}

/**
 * stop 参数归一化(OpenAI 允许 string 或 string[])。
 * 空串/非字符串项剔除;归一后为空 → undefined(视同未传)。
 */
export function normalizeStopSequences(stop: unknown): string[] | undefined {
  const raw = Array.isArray(stop) ? stop : typeof stop === 'string' ? [stop] : []
  const seqs = raw.filter((s): s is string => typeof s === 'string' && s !== '')
  return seqs.length > 0 ? seqs : undefined
}

// =============================================================================
// 注册表
// =============================================================================

const registry = new Map<string, RelayUpstreamAdapter>()

export function registerRelayAdapter(adapter: RelayUpstreamAdapter): void {
  registry.set(adapter.providerCode, adapter)
}

/** 取适配器;providerCode 非法或未注册 → null(调用方决定降级) */
export function getRelayAdapter(providerCode: string): RelayUpstreamAdapter | null {
  if (!isRelayProviderCode(providerCode)) return null
  return registry.get(providerCode) ?? null
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
