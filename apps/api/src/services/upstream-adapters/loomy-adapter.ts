// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loomy(科大讯飞 Loomy 桌面 Agent,Electron,loomy.xunfei.cn,讯飞账号手机号登录,
 * 积分制)上游适配器(2026-10-27 立)。
 *
 * 契约实证边界(§0.3 如实,不冒绿):
 * - **chat 链路已实证(2026-11-10)**:端点/鉴权/模型名/响应形状全部来自本机 Loomy
 *   0.9.39 内嵌 opencode 运行时(`/config` 实读 provider.imodel)+ 同票实弹 200 回包
 *   (标准 chat.completion;业务错误 = HTTP 200 + {code,desc} 信封)。quota 端点仍推断。
 * - 鉴权实证:Bearer 会话票 = loomy-auth-session JSON 的 `session` 字段(32-hex),
 *   见 loomySessionToken 注释。
 * - 积分制:客户端证据 loomy-points-summary(本地缓存)说明额度以积分形态存在,但
 *   **无公开额度端点** ⇒ getQuota 探测推断端点,200 也如实报「形状未实证 ⇒ 未判定」,
 *   绝不猜字段读成数字;401/403 ⇒ authFailed:true(唯一有把握的判定)。
 * - 国际版:讯飞海外暂无实证域名,LOOMY_GLOBAL_BASE 预留(null 占位,待实证再换)。
 * - chat 响应:推断上游可能 OpenAI SSE 同构 ⇒ 帧原样透传(零映射,§0.6);
 *   [DONE]/心跳由转发层统一处理,本适配器不发明字段。
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
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import type { RelayProviderCode } from '../relay-account-format.js'

// =============================================================================
// 端点与常量(改端点只改这里。chat 网关与模型清单已 2026-11-10 本机运行时取证 +
// 实弹验证;quota 端点仍为推断,拿真实抓包后在此收口)
// =============================================================================

/** 业务主站(登录/积分类 API 的域;2026-10-27 本机 Loomy 数据目录实证) */
const LOOMY_BASE = 'https://loomy.xunfei.cn'
/**
 * chat 网关(2026-11-10 实弹取证):本机 Loomy 0.9.39 的 opencode 运行时
 * (`opencode serve` 127.0.0.1 GET /config)实读 provider.imodel.options.baseURL =
 * `https://loomyad.xunfei.cn/api/v1`(@ai-sdk/openai-compatible ⇒ chat 路径 =
 * `<baseURL>/chat/completions`)。实弹 POST 200 返回标准 chat.completion
 * (usage 带 points_consumed 计费键)。旧推断路径 loomy.xunfei.cn/api/chat/completions
 * 实测 404 + SPA 兜底页,作废。
 */
const LOOMY_CHAT_URL = 'https://loomyad.xunfei.cn/api/v1/chat/completions'
/** 积分/额度端点(推断:积分制用户额度惯例路径;未实证) */
const LOOMY_QUOTA_URL = `${LOOMY_BASE}/api/user/points`

/**
 * 模型清单(2026-11-10 本机 opencode 运行时 /config 实读 provider.imodel.models,
 * 非猜测):只收 tool_call/文本产出档位,图像产出档(Hy-Image/doubao-seedream/
 * qwen-image)不入对话清单。网关认**裸模型名**(imodel/ 前缀是 opencode 侧的
 * provider 限定名,发给上游前由转发层剥掉平台前缀后即为裸名)。
 */
const LOOMY_MODEL_IDS = [
  'qwen3.8-flash',
  'spark-x2.6',
  'GLM-5.3-Flash',
  'DeepSeek-V4.1-Flash',
  'deepseek-v4-flash-0731',
  'mimo-v2.5',
  'auto',
]

/**
 * 池内票形态(2026-11-10 实证):导入载荷 loomy-auth-session 的 value = 整份会话 JSON
 * ({phone,maskedPhone,session,userid,loggedInAt}),而网关 Bearer 只认其中 `session`
 * (32-hex;实弹:整 JSON 当票 ⇒ code=100002 登录已失效,session 字段 ⇒ 200 正常补全)。
 * 非 JSON 形态按原票直通(兼容未来直存裸票的导入源)。
 */
export function loomySessionToken(token: string): string {
  const s = String(token ?? '').trim()
  if (!s.startsWith('{')) return s
  try {
    const j = JSON.parse(s) as { session?: unknown }
    const v = typeof j.session === 'string' ? j.session.trim() : ''
    return v || s
  } catch {
    return s
  }
}

/** 鉴权失效类响应文案标记(通用形态;无 Loomy 专有实证码) */
const AUTH_BODY_MARKERS = [
  'unauthorized',
  'invalid token',
  'token expired',
  'token has expired',
  '未登录',
  '请先登录',
  '登录已过期',
  '重新登录',
]

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;对齐 codearts/trae 同款做法)
// =============================================================================

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

function resolveFetchImpl(opts: AdapterCallOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

// =============================================================================
// 认证失败判定(401/403 是唯一有把握的信号;文案/登录墙为通用启发式)
// =============================================================================

/** 非 200 HTML 登录墙(上游风控跳登录页):识别为认证失效形态 */
function looksLikeHtmlLoginPage(bodyText: string): boolean {
  const s = bodyText.slice(0, 2048).toLowerCase()
  if (!s.includes('<html') && !s.includes('<!doctype html')) return false
  return (
    s.includes('login') ||
    s.includes('登录') ||
    s.includes('sign in') ||
    s.includes('signin') ||
    s.includes('认证')
  )
}

function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  /**
   * 404/405 = **端点不存在**,正文是 SPA 兜底页,不是鉴权结论(§0.3 取不到 ≠ 失效)。
   * 2026-10-28 实测:Loomy 的 quota 端点是推断的,真实站对未知路径回 404 + 整站 HTML,
   * 该 HTML 的导航里必然带「登录」二字 ⇒ 旧判据把好号判成 authFailed ⇒ 入池当场 health=down,
   * 调度器据此不下发任务(号池里多出一枚"看起来坏了"的好号)。
   */
  if (statusCode === 404 || statusCode === 405) return false
  const lower = bodyText.toLowerCase()
  if (AUTH_BODY_MARKERS.some((m) => lower.includes(m))) return true
  // HTML 登录墙只在"服务端正常应答"时才成立;错误码下的正文一律不作鉴权证据
  return statusCode >= 200 && statusCode < 400 && looksLikeHtmlLoginPage(bodyText)
}

/** Loomy 上游错误(带 HTTP 状态码;消息截断防泄漏) */
export class LoomyUpstreamError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message.slice(0, 500))
    this.name = 'LoomyUpstreamError'
    this.statusCode = statusCode
  }
}

// =============================================================================
// 适配器
// =============================================================================

export const loomyAdapter: RelayUpstreamAdapter = {
  // 主会话集成点:需把 'loomy' 加入 relay-account-format.ts 的 RELAY_PROVIDERS(本文件不改共享文件)
  providerCode: 'loomy' as RelayProviderCode,
  // 刷新能力:恒 null 空壳 ⇒ 声明为不可续期(见 relay-upstream-adapters.isRefreshableProviderCode)。
  // 否则保活窗口/临期档会把"刷新失败"记到它头上,连续 3 次误判自动摘除好号。
  refreshTokenSupported: false,

  /**
   * chat 请求构造(推断层):OpenAI 同构 body 透传,Bearer 票鉴权,accept 按 stream 二分。
   * 端点与响应形状均未实证(见模块头注);凭证缺 token 直接抛(该账号不可转发)。
   */
  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest {
    const token = ctx.credentials.token
    if (!token) {
      throw new LoomyUpstreamError(401, 'Loomy 账号缺少会话票(tokenEnc 未导入或未解密)')
    }
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: req.stream,
    }
    if (typeof req.temperature === 'number') body['temperature'] = req.temperature
    if (typeof req.maxTokens === 'number') body['max_tokens'] = req.maxTokens
    if (req.tools !== undefined) body['tools'] = req.tools
    if (req.toolChoice !== undefined) body['tool_choice'] = req.toolChoice
    if (req.responseFormat !== undefined) body['response_format'] = req.responseFormat
    const rawBody = JSON.stringify(body)
    return {
      url: LOOMY_CHAT_URL,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: req.stream ? 'text/event-stream' : 'application/json',
        // 会话票只认 session 字段(池内票为整份会话 JSON,见 loomySessionToken 注释)
        authorization: `Bearer ${loomySessionToken(token)}`,
        'user-agent': 'LoomyDesktop', // 推断桌面端 UA;真实 UA 未实证(实弹默认 UA 亦放行)
      },
      rawBody,
    }
  },

  /**
   * 流式帧翻译(推断层):假设上游 OpenAI SSE 同构 ⇒ JSON 帧**原样透传**(零映射)。
   * 心跳/非 JSON 帧忽略;[DONE] 由转发层统一补发。响应形状未实证,透传即未判定。
   */
  translateStreamChunk(
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
      return null // 心跳/注释等非 JSON 帧:忽略
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    return { openaiChunk: obj as Record<string, unknown> }
  },

  /**
   * 非流式响应翻译(2026-11-10 实弹):成功 = 标准 chat.completion 原样透传;
   * 网关业务错误走 **HTTP 200 + {code,desc,trace_id} 信封**(实读 code=100002
   * "登录已失效,请重新登录")——不拦截会被当成功透给前端且把好号记成健康。
   * 登录态类码(100001/100002/100003;本机解包 asar 会话协调器同款三分)
   * 映射为 401 触发自愈,其余业务码按上游错误抛出。
   */
  translateNonStream(_ctx: AdapterAccountContext, responseBody: unknown): Record<string, unknown> {
    if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
      const obj = responseBody as Record<string, unknown>
      if (obj['choices'] === undefined && obj['code'] !== undefined) {
        const code = String(obj['code'])
        const desc = String(obj['desc'] ?? '')
        const authCodes = new Set(['100001', '100002', '100003'])
        throw new LoomyUpstreamError(
          authCodes.has(code) ? 401 : 502,
          `Loomy 网关业务错误 code=${code}${desc ? `: ${desc.slice(0, 200)}` : ''}`,
        )
      }
      return obj
    }
    throw new LoomyUpstreamError(502, 'Loomy 上游响应非 JSON 对象(形状未实证 ⇒ 未判定)')
  },

  /**
   * token 刷新:无实证刷新端点 ⇒ 恒 null(= 该平台无法刷新)。
   * 401 自愈路径只能依赖 getQuota/checkHealth 的 authFailed 判定做摘除,不做续期。
   */
  async refreshToken(
    _ctx: AdapterAccountContext,
    _opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    return null
  },

  /**
   * 健康检查(三态语义,对齐 HealthCheckResult):
   * - 非 2xx:401/403 ⇒ 明确拒收(authFailed),5xx/网络 ⇒ indeterminate(不误杀好号);
   * - 2xx:端点本身是推断的,SPA 服务器对任意路径都可能回 200 ⇒ 形状未实证 ⇒ indeterminate。
   */
  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(LOOMY_QUOTA_URL, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${loomySessionToken(ctx.credentials.token)}`,
        },
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) {
        const rejected = isAuthFailure(res.status, text)
        return {
          ok: false,
          indeterminate: !rejected,
          // 只在明确拒收时写 authFailed;5xx/网络缺省(不得与 indeterminate 背离)
          ...(rejected ? { authFailed: true } : {}),
          error: `quota HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
            rejected ? '' : '(未判定)'
          }`,
        }
      }
      return {
        ok: false,
        indeterminate: true,
        error: 'quota 端点为推断形状,HTTP 200 无法区分真数据/SPA 兜底页 ⇒ 未判定',
      }
    } catch (e) {
      return {
        ok: false,
        indeterminate: true,
        error: `${e instanceof Error ? e.message : String(e)}(未判定)`,
      }
    }
  },

  /**
   * 积分余额点查(§0.3 如实未判定):**无公开额度端点**,LOOMY_QUOTA_URL 是推断路径。
   * 非 2xx ⇒ authFailed 按 isAuthFailure(401/403 是唯一有把握的判定);
   * 200 ⇒ 回响应键名清单 + 「形状未实证 ⇒ 未判定」,绝不猜字段读成数字
   * (一旦清单可见,后续一轮即可补解析;对齐 codearts getQuota 同款口径)。
   */
  async getQuota(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(LOOMY_QUOTA_URL, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${loomySessionToken(ctx.credentials.token)}`,
        },
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) {
        return {
          ok: false,
          ...(isAuthFailure(res.status, text) ? { authFailed: true } : {}),
          error: `points HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
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
        error:
          `Loomy 无公开额度端点,${LOOMY_QUOTA_URL} 为推断路径,响应键=[${keys.join(',') || '(空)'}],` +
          '字段形状未实证 ⇒ 未判定(不猜字段读成数字)',
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `积分点查失败: ${msg}` }
    }
  },

  isAuthFailure,

  /** 模型清单:客户端实证 id 静态登记(见 LOOMY_MODEL_IDS 注释;无上游清单端点) */
  async listModels(): Promise<string[]> {
    return [...LOOMY_MODEL_IDS]
  },

  isAuthError(err: unknown): boolean {
    return err instanceof LoomyUpstreamError && (err.statusCode === 401 || err.statusCode === 403)
  },

  /**
   * 富错误分类(状态码粗分;无实证业务错误码,不发明):
   * 401/403→auth(401 自愈)、402/积分耗尽文案→credit(积分制平台)、429→rate、
   * 404→not_found、5xx→server、其他 4xx→client。
   */
  classifyUpstreamFailure(statusCode: number, bodyText: string) {
    if (statusCode === 401 || statusCode === 403) return { kind: 'auth' as const }
    if (
      statusCode === 402 ||
      /(积分|points|credit).{0,20}(不足|用尽|耗尽|exhausted|insufficient)/i.test(bodyText)
    ) {
      return { kind: 'credit' as const }
    }
    if (statusCode === 429) return { kind: 'rate' as const }
    if (statusCode === 404) return { kind: 'not_found' as const }
    if (statusCode >= 500) return { kind: 'server' as const }
    if (statusCode === 400 || statusCode === 422) return { kind: 'request' as const }
    return { kind: 'client' as const }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
