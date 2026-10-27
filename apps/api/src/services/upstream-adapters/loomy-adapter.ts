// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loomy(科大讯飞 Loomy 桌面 Agent,Electron,loomy.xunfei.cn,讯飞账号手机号登录,
 * 积分制)上游适配器(2026-10-27 立)。
 *
 * 契约实证边界(§0.3 如实,不冒绿):
 * - 上游是讯飞私有端点,**没有公开文档**;2026-10-27 本机取证(scripts/lib/loomy-auth-extract.mjs
 *   头注)连会话 token 的持久化键都未实证到,更没有端点/请求体证据 ⇒ 本文件所有请求构造
 *   都停在「合理推断+未判定」层:端点/头/请求体按 Electron 客户端惯例推断,注释逐条标
 *   「推断」,响应形状一律未实证 —— 拿到真实回包前不做任何字段级解析。
 * - 鉴权推断:手机号登录后发 Bearer 会话票 ⇒ `authorization: Bearer <token>`(推断)。
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
// 端点与常量(推断值;改端点只改这里。全部未实证,拿真实抓包后在此收口)
// =============================================================================

/** 实证:2026-10-27 本机 Loomy 数据目录唯一现身的业务域(上报域 idatalog.iflysec.com 不计) */
const LOOMY_BASE = 'https://loomy.xunfei.cn'
/** 海外预留:讯飞海外域名未实证,null 占位;拿到实证再换(常量字段留位要求,导出供管理面读取) */
export const LOOMY_GLOBAL_BASE: string | null = null
/** chat 端点(推断:OpenAI 同构惯例路径;未实证) */
const LOOMY_CHAT_URL = `${LOOMY_BASE}/api/chat/completions`
/** 积分/额度端点(推断:积分制用户额度惯例路径;未实证) */
const LOOMY_QUOTA_URL = `${LOOMY_BASE}/api/user/points`

/** chat 直连契约未实证的统一错误(转发层按普通上游错误处理,不刷新不重试) */
export const LOOMY_CHAT_CONTRACT_UNVERIFIED =
  'LOOMY_CHAT_CONTRACT_UNVERIFIED: Loomy 上游为讯飞私有端点,无公开文档;' +
  'chat 请求构造为合理推断形状,响应形状未实证,直连结果只能如实未判定'

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
  const lower = bodyText.toLowerCase()
  if (AUTH_BODY_MARKERS.some((m) => lower.includes(m))) return true
  return looksLikeHtmlLoginPage(bodyText)
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
        authorization: `Bearer ${token}`,
        'user-agent': 'LoomyDesktop', // 推断桌面端 UA;真实 UA 未实证
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

  /** 非流式整体透传(推断层;不做字段翻译,§0.6) */
  translateNonStream(_ctx: AdapterAccountContext, responseBody: unknown): Record<string, unknown> {
    if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
      return responseBody as Record<string, unknown>
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
          authorization: `Bearer ${ctx.credentials.token}`,
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
          authorization: `Bearer ${ctx.credentials.token}`,
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
