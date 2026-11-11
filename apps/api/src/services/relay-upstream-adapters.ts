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

// =============================================================================
// 上游长连接(2026-11-10 立)
//
// 背景:号池此前只有 buildChatRequest → fetch → SSE 一条路,全部 12 家适配器均无长连接
// 通道;而 chat-models 侧的 /v1/realtime、/ws/qwen-omni、/ws/doubao、/ws/zhipu 早已
// 是双向 WS 透传。同一项目两条链路能力不对等,故把长连接抽成传输层能力,契约开放给
// 每个适配器按平台实际情况声明。
//
// 设计约束:
// 1. **传输与协议解耦**:UpstreamSocket 是"一条活着的帧通道",不绑定 ws 协议;
//    上游只有 SSE 的平台(sse 模式)同样能拿到句柄,帧序列语义一致。
// 2. **翻译层零改动**:socket 帧最终被包装成标准 SSE Response 交给既有
//    consumeUpstreamResponse,翻译/usage 记账/成功判定/401 自愈全部复用,不另起一套。
// 3. **失败即回落**:socket 建连失败或首帧前中断 ⇒ 转发层退回 HTTP 单请求路径,
//    绝不因为新通道把存量可用性拖下水。
// =============================================================================

/** 上游长连接帧(文本帧承载 JSON / SSE data 行;二进制帧用于音频等) */
export interface UpstreamSocketFrame {
  /** 文本帧内容;与 binary 二选一 */
  text?: string
  /** 二进制帧内容;与 text 二选一 */
  binary?: Uint8Array
  /** 上游主动关闭时的 code(仅终止帧可带) */
  closeCode?: number
  closeReason?: string
}

/**
 * 适配器构造的上游长连接请求。
 * transport 缺省按 url scheme 推断:`ws(s)://` → 'ws',`http(s)://` → 'sse'。
 */
export interface UpstreamSocketRequest {
  url: string
  headers: Record<string, string>
  method?: 'GET' | 'POST'
  /** 建连后立即发送的首帧(WS 握手,如 session.update / 请求信封) */
  handshake?: unknown
  /** 请求体(sse 模式必填;ws 模式一般走 handshake) */
  body?: unknown
  rawBody?: string
  transport?: 'ws' | 'sse'
}

/** 上游长连接句柄(由传输层实现,适配器不直接构造) */
export interface UpstreamSocket {
  /** 发送一帧 */
  send(data: string | Uint8Array): void
  /** 主动关闭 */
  close(code?: number, reason?: string): void
  /** 帧异步序列;上游关闭/异常时序列自然结束(不抛,异常经 lastError 交付) */
  frames(): AsyncIterable<UpstreamSocketFrame>
  /** 最近一次错误(无错为 null) */
  lastError(): Error | null
}

/** 长连接建连选项(转发层注入) */
export interface UpstreamSocketOpenOptions {
  signal?: AbortSignal
  /** 账号级出口代理(行.proxyUrl;null = 直连)。ws 走 CONNECT 隧道 agent,sse 走注入的 fetch */
  proxyUrl?: string | null
  /** 建连超时(ms);缺省由传输层取 15s */
  connectTimeoutMs?: number
  /** WS 心跳间隔(ms);缺省 30s。0 = 关闭心跳(仅测试用,生产别关) */
  heartbeatMs?: number
  /** 建连成功后无新帧的空闲上限(ms);缺省 5 分钟。0 = 关闭看门狗 */
  idleTimeoutMs?: number
  /**
   * fetch 注入点(sse 模式用)。转发层必须传入自己的账号级 fetch,
   * 否则账号代理与连接期出口守卫都会被绕过(见 relay-socket-transport 文件头约束 1)。
   */
  fetchImpl?: typeof fetch
}

/** 传输层工厂(转发层注入;测试可打桩) */
export interface UpstreamSocketFactory {
  open(req: UpstreamSocketRequest, opts?: UpstreamSocketOpenOptions): Promise<UpstreamSocket>
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
   * 上游响应里的 access token 相对寿命(秒),**只许原样上交**;上游未给 ⇒ undefined。
   * 目前仅用于留痕/未来校准,落库时刻仍以 expiresAt 为准。
   */
  expiresIn?: number
  /**
   * 上游响应里的 refresh token 相对寿命(秒),**只许原样上交**;上游未给 ⇒ undefined。
   * WorkBuddy 的 refresh 绝对寿命为 60 天,调度器据此写 refresh_expires_at(不可编造)。
   */
  refreshExpiresIn?: number
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

/** 模型清单条目(富形状;官方模型 id=名称,自定义模型 id 可能被上游截断) */
export interface RelayModelEntry {
  name: string
  id?: string
  /** id 非完整值(CLI 显示上限截断等)时恒 true,消费方不得当完整 id 用 */
  idTruncated?: boolean
}

/**
 * 上游模型清单富结果(2026-10-27 立,与既有 listModels(): string[] 并存):
 * - 既有 listModels 契约是纯 id 数组(trae/workbuddy/codearts 已实现且消费方依赖),
 *   不能改签名;qoder 的清单来自本机 CLI 登录态且含截断 id,无法忠实塞进 string[],
 *   故新增本富形状方法,永不抛(失败归 ok:false,不冒充)。
 * - scope 如实标注清单语义(如 qoder 的 'local-cli-login' = 本机 CLI 登录态的
 *   当前用户,不是号池任意账号)。
 */
export interface RelayModelListResult {
  ok: boolean
  error?: string
  /** 清单语义标注(如 'local-cli-login');ok:false 时可缺省 */
  scope?: string
  models?: RelayModelEntry[]
}

/** 富模型清单的执行选项(与 AdapterCallOptions 同形,单独命名便于语义区分) */
export type ModelListCallOptions = AdapterCallOptions

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
  /**
   * 刷新能力声明(2026-10-27 立,保活收敛用):`refreshToken` 方法存在 ≠ 真能刷新。
   * - 省略/true:适配器确有已实证续期端点 ⇒ 调度器可对它做临期刷新与空闲保活;
   * - false:方法有(或没有)但**恒无法续期**(如 doubao/loomy 的恒 null 空壳 stub,
   *   或 codex/opencode/zcode/lingma/grokbot 等无公开续期协议者)。
   *   这类平台账号**不得**进保活窗口、也不得被 refreshOne 判成"刷新失败"→ 自动摘除。
   * 判据:调度器统一用 `isRefreshableProviderCode()`(方法存在 且 本字段不为 false)。
   */
  refreshTokenSupported?: boolean
  /** 轻量健康检查(不得消耗大量配额;失败返回 ok:false + 原因;三态语义见 HealthCheckResult) */
  checkHealth(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<HealthCheckResult>
  /** 上游模型列表(可空:平台无此端点时健康检查退化为最小 chat 探测) */
  listModels?(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<string[]>
  /**
   * 余额/配额查询(可选:平台无已知端点则不实现,管理面显示"未支持")。
   * 按需调用(管理面点查),不进调度轮询;永不抛(失败归 ok:false)。
   */
  getQuota?(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult>
  /**
   * 余额端点能力声明(2026-11-10 立,与 refreshTokenSupported 同形):**getQuota 方法存在 ≠ 有已实证端点**。
   * - 省略/true:适配器确有已实证余额端点(trae/workbuddy/qoder/minimax/codearts/zcode/grokbot)
   *   ⇒ 承载层可真发点查并展示数值;
   * - false:方法有,但只是"探测推断端点、200 也如实报形状未实证 ⇒ 未判定"的空壳
   *   (doubao/lingma/loomy/codex/opencode 五个平台无公开余额端点)。这类平台**不得**让
   *   承载层逐号发无谓探测请求(拖慢列号窗口、探测 401 还会误触发 refresh 重试),应直接
   *   如实标"未支持",绝不拿 0 冒充额度耗尽(§0.3)。
   * 判据唯一真相源 = `hasVerifiedQuotaEndpoint()`(方法存在 且 本字段不为 false);
   * 承载层不得自己抄一份平台清单(§0.6),新平台接入只要不声明 false 就自动生效。
   */
  quotaSupported?: boolean
  /**
   * 长连接能力声明(2026-11-10 立,与 refreshTokenSupported/quotaSupported 同形):
   * **buildSocketRequest 方法存在 ≠ 真能长连接**,必须是适配器已实证的通道。
   * - 省略/false:该平台走 HTTP 单请求路径(现状);
   * - true:适配器实现 buildSocketRequest,转发层优先走长连接,**失败自动回落 HTTP**。
   * 判据唯一真相源 = `isSocketCapableAdapter()`(方法存在 且 本字段为 true)。
   */
  socketSupported?: boolean
  /**
   * 构造上游长连接请求(socketSupported=true 时必实现)。
   * 与 buildChatRequest 并列:同一份 NormalizedChatRequest,两种运输方式。
   */
  buildSocketRequest?(
    ctx: AdapterAccountContext,
    req: NormalizedChatRequest,
  ): UpstreamSocketRequest
  /**
   * 长连接帧 → OpenAI chunk(可选)。
   * 省略时转发层按 SSE 语义透传文本帧,复用 translateStreamChunk 翻译
   * (适用于上游帧格式与 HTTP 流一致的平台,如 sse 模式)。
   * 声明后由适配器自行翻译(适用于二进制/私有事件帧,如 realtime WS)。
   */
  translateSocketFrame?(
    ctx: AdapterAccountContext,
    frame: UpstreamSocketFrame,
    state: StreamState,
  ): TranslatedChunk | null
  /**
   * 富模型清单(可选,2026-10-27 立;与 listModels 并存的原因见 RelayModelListResult)。
   * 永不抛(失败归 ok:false);scope 如实标注清单语义。
   */
  listModelsDetailed?(
    ctx: AdapterAccountContext,
    opts?: ModelListCallOptions,
  ): Promise<RelayModelListResult>
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

/**
 * 平台是否真能续期(2026-10-27 立,保活收敛用)。
 * 判据 = 适配器**确有** `refreshToken` 方法 且 未显式声明 `refreshTokenSupported: false`。
 * - codearts/qoder/trae/workbuddy:方法存在且无 false 标记 ⇒ true;
 * - minimax:2026-11-06 起方法存在(按 mcode 3.1.10 字符串取证复现)⇒ 同判 true;
 *   **因上游 rt 是轮换型,它与 trae/qoder 一样必须在 CLIENT_FIRST_FLAGS 里登记 client-first**,
 *   否则续期能力会把本机客户端顶下线(两半同批是硬要求,不是可选项)。
 * - doubao/loomy:方法存在但显式 false(恒 null 空壳)⇒ false;
 * - codex/opencode/zcode/lingma/grokbot:方法不存在 ⇒ false。
 * 新平台接入只要没有 false 标记、且方法真实存在即自动生效,无需改调度器硬编码名单。
 */
export function isRefreshableProviderCode(providerCode: string): boolean {
  const a = getRelayAdapter(providerCode)
  if (!a) return false
  return typeof a.refreshToken === 'function' && a.refreshTokenSupported !== false
}

/**
 * 平台是否真有已实证余额端点(2026-11-10 立,承载层唯一判据;与 isRefreshableProviderCode 同形)。
 *
 * 为什么不能只问 `typeof adapter.getQuota === 'function'`:五个无公开余额端点的平台
 * (doubao/lingma/loomy/codex/opencode)**也实装了 getQuota**,但它们的实现只是"探测推断端点,
 * 200 也如实报形状未实证 ⇒ 未判定"的空壳。承载层若照常逐号点查,会白发 N 次网络请求拖慢
 * 列号窗口,且探测 401 会被误读成凭据失效、误触发 refresh 重试(§0.3 取不到 ≠ 失效)。
 *
 * 判据 = 方法存在 且 未显式声明 `quotaSupported: false`。声明 false 的平台由承载层直接
 * 如实标"未支持",零探测、零假数;新平台接入不声明即自动生效,无需改承载层硬编码名单(§0.6)。
 */
export function hasVerifiedQuotaEndpoint(
  adapter: Pick<RelayUpstreamAdapter, 'getQuota' | 'quotaSupported'> | null | undefined,
): adapter is RelayUpstreamAdapter & { getQuota: NonNullable<RelayUpstreamAdapter['getQuota']> } {
  return (
    !!adapter && typeof adapter.getQuota === 'function' && adapter.quotaSupported !== false
  )
}

/**
 * 平台是否真能走上游长连接(2026-11-10 立,转发层唯一判据;与上面两个同形)。
 *
 * 判据 = 适配器**显式**声明 `socketSupported: true` 且确有 `buildSocketRequest` 方法。
 * 与 quotaSupported 相反,这里缺省为 false:长连接是新通道,没实证过的平台不得被
 * 转发层"猜"进 socket 路径,否则每个请求都要先付一次多余建连失败再回落,纯亏。
 * 新平台接入时自行声明 true 即自动生效,转发层不维护硬编码名单(§0.6)。
 */
export function isSocketCapableAdapter(
  adapter: RelayUpstreamAdapter | null | undefined,
): adapter is RelayUpstreamAdapter & {
  socketSupported: true
  buildSocketRequest: NonNullable<RelayUpstreamAdapter['buildSocketRequest']>
} {
  return (
    !!adapter &&
    adapter.socketSupported === true &&
    typeof adapter.buildSocketRequest === 'function'
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
