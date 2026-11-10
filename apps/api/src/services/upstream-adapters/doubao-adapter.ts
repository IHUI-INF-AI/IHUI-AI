// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包(字节豆包 web,字节账号登录)上游适配器(2026-10-27 立,2026-11-10 实证校准)。
 *
 * ## 2026-11-10 浏览器实弹校准(替换 10-27 的全部推断值)
 *
 * 方法:取号池 doubao 行的 12 条 .doubao.com 会话族 cookie,注入本机 Chrome,
 * 打开 https://www.doubao.com/chat/ —— 直接进登录态(侧边栏出现真实项目与历史会话),
 * 证明**票一直有效**。随后抓页面自身请求拿到真实契约,再用纯 Node fetch 逐条复现。
 *
 * 实证结论(逐条可复现):
 * 1. 判活端点 = `POST /im/conversation/batch_get`;
 *    正例 真票 → status_code 0 + 真实 user_id(=59830099522953);
 *    反例 空 cookie → 712012001「登录校验不合法」;伪造 sessionid → 游客 user_id + 空列表。
 * 2. **弱端点不可作判据**:`/samantha/user/preference/get` 与 `/samantha/notice/info`
 *    只校验 cookie 存在性 —— 伪造 32 位 sessionid 照样回 code:0,据此判活会把废票当活票。
 * 3. 必需 query 面:`aid=497858&real_aid=497858&device_platform=web&version_code=20800
 *    &device_id=…&pc_version=3.45.x`;缺则回 710020702「系统错误」(是参数问题,不是签名问题)。
 * 4. `content-type` 必须写 `application/json; encoding=utf-8`,否则 712012002「不支持编码类型」。
 * 5. **chat 不走 HTTP**:页面内发消息成功作答,但全程无 chat/completion 请求 ——
 *    对话走 IM cmd 长连接;`/api/chat/completions` 恒 401。⇒ buildChatRequest 仅契约占位。
 * 6. `/api/*` 是字节签名墙(真票也 401);`/samantha/*` 与 `/im/*` 不需要 a-bogus 签名。
 *
 * ## 仍未实证的边界(照旧不冒绿)
 * - 额度:豆包有额度体系(页面实证「每日签到领 200」),但**无公开余额查询端点** ⇒
 *   getQuota 保持未判定、quotaSupported=false。
 * - 国际版:豆包海外版 = Cici,DOUBAO_GLOBAL_BASE 常量预留(无本机取证,留位待实证)。
 * - chat 响应形状:IM 协议未解码,现有 SSE 帧透传逻辑对豆包不适用。
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

/** 实证:2026-10-27 号机 Cookies 里 .doubao.com 会话族所在主域 */
const DOUBAO_BASE = 'https://www.doubao.com'

/**
 * chat 端点(2026-11-10 浏览器实弹证伪):此路径恒 401,且豆包对话**根本不走 HTTP**。
 * 实测:在真实登录态页面里发送「1+1等于几」,消息正常上屏并由模型作答,但全程
 * 没有任何 chat/completion 类 HTTP 请求 —— 对话走的是 IM 长连接(cmd 编号协议,
 * pull_recent_conv_chain / thread_message),HTTP 面只有会话列表等旁路接口。
 * ⇒ 本常量仅为 RelayUpstreamAdapter 的接口契约占位,**不构成可用通路**。
 */
const DOUBAO_CHAT_URL = `${DOUBAO_BASE}/api/chat/completions`

/**
 * 额度端点(2026-11-10 实测):此路径恒 401(字节签名墙,真票也 401)。
 * 豆包确有额度体系(登录态页面实证:「每日签到领 200 额度,周一翻倍,签到 30 天得 8800」),
 * 但公开面未发现余额查询端点 ⇒ 仍声明 quotaSupported=false,零探测零假数(§0.3)。
 */
const DOUBAO_QUOTA_URL = `${DOUBAO_BASE}/api/user/quota`

/**
 * 会话票判活端点(2026-11-10 浏览器抓包 + 纯 Node 复现,强校验):
 * `/im/conversation/batch_get` 是**唯一实测能区分票真伪**的端点 ——
 *   · 空 cookie      ⇒ status_code 712012001「登录校验不合法」(硬拒收,可判 authFailed)
 *   · 真票          ⇒ status_code 0 + downlink_body.user_id = 真实号 id
 *   · 伪造 sessionid ⇒ status_code 0 但 user_id 变成游客 id(3018599589489431)、会话列表为空
 * 反面对照(同批实测):`/samantha/user/preference/get` 与 `/samantha/notice/info`
 * 只校验 cookie 存在性 —— 伪造 32 位 sessionid 照样回 code:0,**不足以判活**,故不作判据。
 */
const DOUBAO_IM_BATCH_GET_URL = `${DOUBAO_BASE}/im/conversation/batch_get`

/** 实证:豆包 web 统一 query 面;缺 aid/real_aid 会被服务端按非法请求拒(710020702) */
const DOUBAO_AID = '497858'
/** 实证:浏览器抓包里的 pc_version(2.33.x 是桌面端版本号,web 用 3.45.x) */
const DOUBAO_PC_VERSION = '3.45.1'

/**
 * 实证:会话票失效业务码(两个面各一套,语义都是「没登录/票不合法」)。
 * 注意 IM 面用 `status_code`、samantha 面用 `code`,字段名不同,别混读。
 */
const DOUBAO_AUTH_CODES = new Set([710012001, 712012001])

/** 鉴权失效类响应文案标记(通用形态;无豆包专有实证码) */
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

/** 豆包上游错误(带 HTTP 状态码;消息截断防泄漏) */
export class DoubaoUpstreamError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message.slice(0, 500))
    this.name = 'DoubaoUpstreamError'
    this.statusCode = statusCode
  }
}

// =============================================================================
// Cookie 头组装(2026-11-10 实弹校准)
// =============================================================================

/**
 * 一条 cookie 的键/值是否「能进 HTTP 头」:只接受 Latin-1(码点 ≤ 0xff)且不含
 * 控制字符/分隔符。**不能 percent-encode 蒙过去** —— 2026-11-10 实测:把解密的
 * 损坏值(含 U+FFFD)编码成 %EF%BF%BD 后,undici 8.x 直接
 * `UND_ERR_INVALID_ARG: invalid cookie header` 拒收**整个头**,
 * 结果是 11 条好票被 1 条垃圾连带废掉,健康检查全变 fetch failed。
 * ⇒ 正确处置是剔除坏条、保留其余,并把剔除数如实报给健康检查。
 */
function isHeaderSafeToken(s: string): boolean {
  if (s === '') return false
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp > 0xff) return false
    // 0x00-0x1f / 0x7f 控制字符,Cookie 名不允许的分隔符,以及逗号分号空格
    if (cp <= 0x1f || cp === 0x7f) return false
    if (ch === ';' || ch === ',' || ch === ' ' || ch === '"' || ch === '\\') return false
  }
  return true
}

/**
 * 组 Cookie 头:credentials.cookies 逐条直通(name=value,零字段改写)。
 * cookies 为空且 tokenEnc 有值 ⇒ 按取证键名当 sessionid_ss/sessionid 用
 * (号池导入时字节 passport 会话票常落 tokenEnc;键序映射是推断,待实证收口)。
 * 两处皆空 ⇒ 抛错(该账号不可转发)。
 */
export function buildCookieHeader(ctx: AdapterAccountContext): string {
  const cookies = Array.isArray(ctx.credentials.cookies) ? ctx.credentials.cookies : []
  const pairs: string[] = []
  for (const c of cookies) {
    if (!c || typeof c !== 'object') continue
    const name = c['name']
    const value = c['value']
    if (typeof name !== 'string' || name === '') continue
    if (typeof value !== 'string' || value === '') continue
    if (!isHeaderSafeToken(name) || !isHeaderSafeToken(value)) continue
    pairs.push(`${name}=${value}`)
  }
  if (pairs.length > 0) return pairs.join('; ')
  const token = ctx.credentials.token
  if (token && isHeaderSafeToken(token)) {
    // 推断映射(未实证):tokenEnc 充当会话票,套用取证实证的两个会话键名
    return `sessionid_ss=${token}; sessionid=${token}`
  }
  throw new DoubaoUpstreamError(
    401,
    '豆包账号无可用 cookies/token(全部缺失或含不可进 HTTP 头的损坏字节)',
  )
}

/**
 * 统计被剔除的坏 cookie 名(仅名字,零值),供健康检查如实报告。
 * 用途:号池里该行的 msToken 已实测损坏(U+FFFD 首字节),剔除后不影响会话判活,
 * 但运营侧需要知道「凭据有一项是坏的」而不是以为全好。
 */
export function listUnsafeCookieNames(ctx: AdapterAccountContext): string[] {
  const cookies = Array.isArray(ctx.credentials.cookies) ? ctx.credentials.cookies : []
  const bad: string[] = []
  for (const c of cookies) {
    if (!c || typeof c !== 'object') continue
    const name = c['name']
    const value = c['value']
    if (typeof name !== 'string' || name === '') continue
    if (typeof value !== 'string' || value === '') {
      bad.push(name)
      continue
    }
    if (!isHeaderSafeToken(name) || !isHeaderSafeToken(value)) bad.push(name)
  }
  return bad
}

/**
 * 兜底 device_id(2026-11-10 实测:服务端不校验其真实性,固定值可通)。
 * 号池行有 deviceId 时优先用行内值,避免同池多个号共用一个设备指纹。
 */
const DOUBAO_FALLBACK_DEVICE_ID = '7595255965021849098'

/** 实证:浏览器真实 UA(推断的 "Mozilla/5.0 DoubaoDesktop" 会被风控当成非浏览器流量) */
const DOUBAO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'

/**
 * 实证:豆包 web 统一 query 面(2026-11-10 浏览器抓包逐字复刻)。
 * 这串参数是**必需项**不是装饰:只带 page_size 打 /samantha/* 会被回 710020702「系统错误」,
 * 补全 version_code/aid/real_aid/device_platform/device_id/pc_version 后立刻 code:0。
 */
function doubaoWebQuery(ctx: AdapterAccountContext): string {
  const own = (ctx.row.deviceId ?? '').trim()
  return new URLSearchParams({
    version_code: '20800',
    language: 'zh',
    device_platform: 'web',
    doubao_device_platform: 'web',
    aid: DOUBAO_AID,
    real_aid: DOUBAO_AID,
    pkg_type: 'release_version',
    device_id: own || DOUBAO_FALLBACK_DEVICE_ID,
    pc_version: DOUBAO_PC_VERSION,
  }).toString()
}

/** 实证:IM 面请求头(content-type 必须带 `encoding=utf-8`,否则回 712012002「不支持编码类型」) */
function imRequestHeaders(ctx: AdapterAccountContext): Record<string, string> {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json; encoding=utf-8',
    cookie: buildCookieHeader(ctx),
    'agw-js-conv': 'str',
    'user-agent': DOUBAO_UA,
    referer: `${DOUBAO_BASE}/chat/`,
    origin: DOUBAO_BASE,
  }
}

/**
 * 实测有效的最轻 IM 请求:取「豆包」官方会话的一条信息。
 * 判活只看 status_code + downlink_body.user_id,不依赖会话是否存在 ——
 * 号里没有该会话时列表为空但 user_id 仍在,判据不受影响。
 */
function imProbeBody(): string {
  return JSON.stringify({
    cmd: 1111,
    uplink_body: {
      batch_get_conv_info_uplink_body: {
        conversation_id: ['102959638119426'],
        option: { recent_message_count_per_conv: 1 },
        ext: {},
      },
    },
    sequence_id: '00000000-0000-4000-8000-000000000000',
    channel: 2,
    version: '1',
  })
}

/** 额度/健康探测共用请求头(cookie 鉴权 + JSON accept;字段取证实证值) */
function probeRequestHeaders(ctx: AdapterAccountContext): Record<string, string> {
  return {
    accept: 'application/json',
    cookie: buildCookieHeader(ctx),
    'agw-js-conv': 'str',
    'user-agent': DOUBAO_UA,
    referer: `${DOUBAO_BASE}/chat/`,
  }
}

// =============================================================================
// 适配器
// =============================================================================

export const doubaoAdapter: RelayUpstreamAdapter = {
  // 主会话集成点:需把 'doubao' 加入 relay-account-format.ts 的 RELAY_PROVIDERS(本文件不改共享文件)
  providerCode: 'doubao' as RelayProviderCode,
  // 刷新能力:恒 null 空壳 ⇒ 声明为不可续期(见 relay-upstream-adapters.isRefreshableProviderCode)。
  // 否则保活窗口/临期档会把"刷新失败"记到它头上,连续 3 次误判自动摘除好号。
  refreshTokenSupported: false,
  // 额度能力:无公开余额端点,getQuota 只是探测签名墙的推断路径(200 也如实报未判定)。
  // 声明 false ⇒ 承载层(切号列表/admin 点查)直接标"未支持",零探测、零假数(§0.3)。
  quotaSupported: false,

  /**
   * chat 请求构造 —— **2026-11-10 实弹证伪,本通路不成立**。
   *
   * 实测过程:注入真实会话票打开 https://www.doubao.com/chat/ (确认登录态),在输入框
   * 发送「1+1等于几」,消息上屏且模型正常作答,全程 `waitForRequest(/completion/)` 超时 ——
   * 豆包对话**不走 HTTP**,走的是 IM cmd 编号协议长连接(pull_recent_conv_chain /
   * thread_message 一族),HTTP 面只有会话列表/偏好等旁路接口。
   * 另测 `/api/chat/completions` 直接 401(签名墙)。
   *
   * 因此本方法保留仅为满足 RelayUpstreamAdapter 契约,**不产出可用的上游调用**。
   * 要真正打通豆包对话,需实现 IM 长连接协议(建连/心跳/cmd 编解码),属独立工程,
   * 不在本次收口范围。承载层应在此实现落地前避免把 doubao 纳入 chat 调度。
   */
  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest {
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
      url: DOUBAO_CHAT_URL,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: req.stream ? 'text/event-stream' : 'application/json',
        cookie: buildCookieHeader(ctx),
        'agw-js-conv': 'str',
        referer: `${DOUBAO_BASE}/chat/`,
        'user-agent': DOUBAO_UA,
      },
      rawBody,
    }
  },

  /**
   * 流式帧翻译(推断层):假设上游 SSE 同构 ⇒ JSON 帧**原样透传**(零映射)。
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
    throw new DoubaoUpstreamError(502, '豆包上游响应非 JSON 对象(形状未实证 ⇒ 未判定)')
  },

  /**
   * token 刷新:无实证刷新端点(字节 passport 会话票轮转靠重登)⇒ 恒 null(无法刷新)。
   * 401 自愈路径只能依赖 getQuota/checkHealth 的 authFailed 判定做摘除,不做续期。
   */
  async refreshToken(
    _ctx: AdapterAccountContext,
    _opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    return null
  },

  /**
   * 健康检查(2026-11-10 实证重写,三态语义对齐 HealthCheckResult)。
   *
   * 判据端点换成 `/im/conversation/batch_get` —— 本仓唯一实测能区分票真伪的豆包端点:
   *   · `status_code` ∈ {710012001, 712012001} ⇒ 上游明确拒收 ⇒ **authFailed**(写 down)
   *   · `status_code === 0` 且 `downlink_body…user_id` 非空 ⇒ **ok**(写 healthy)
   *   · 其他业务码 / 缺字段 / 非 2xx / 网络 ⇒ indeterminate(保留 unknown,绝不误杀)
   *
   * 为什么不用旧路径(2026-10-27 曾据 `/api/user/quota` 断言「豆包健康检查恒 unknown」):
   * 那是**端点选错**导致的假象 —— `/api/*` 是字节签名墙,真票也 401;
   * 而 `/samantha/user/preference/get` 又只校验 cookie 存在性,伪造 sessionid 照样回
   * `code:0`,两个极端都判不了活。换成 IM 面后正反用例可分离(见模块常量区实证注)。
   *
   * 额外防线:行内 `extraMetadata.doubaoUserId` 若已记录过真实 user_id,而本次探测拿到
   * 另一个 id(实测伪造票会被派一个游客 id ⇒ 典型「票被换/被顶号」形态)⇒ 直接 authFailed。
   */
  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
    const url = `${DOUBAO_IM_BATCH_GET_URL}?${doubaoWebQuery(ctx)}`
    let res: Response
    try {
      res = await resolveFetchImpl(opts ?? {})(url, {
        method: 'POST',
        headers: imRequestHeaders(ctx),
        body: imProbeBody(),
      })
    } catch (e) {
      // 本地构造的 401/403 只有一种来源:buildCookieHeader 报「本行没有可用的票」。
      // 那不是上游抖动,是**本行确实没有凭据** ⇒ 明确 authFailed,不留在未判定里冒充待复检。
      if (e instanceof DoubaoUpstreamError && (e.statusCode === 401 || e.statusCode === 403)) {
        return { ok: false, authFailed: true, error: e.message }
      }
      return {
        ok: false,
        indeterminate: true,
        error: `IM 判活探测失败:${e instanceof Error ? e.message : String(e)}(未判定)`,
      }
    }

    const text = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      return { ok: false, authFailed: true, error: `IM 判活探测 HTTP ${res.status}(上游拒收凭据)` }
    }
    if (!res.ok) {
      return {
        ok: false,
        indeterminate: true,
        error: `IM 判活探测 HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}(未判定)`,
      }
    }

    let obj: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, indeterminate: true, error: 'IM 判活响应非 JSON 对象(未判定)' }
      }
      obj = parsed as Record<string, unknown>
    } catch {
      return { ok: false, indeterminate: true, error: 'IM 判活响应无法解析为 JSON(未判定)' }
    }

    const statusCode =
      typeof obj['status_code'] === 'number' ? (obj['status_code'] as number) : null
    if (statusCode === null) {
      return { ok: false, indeterminate: true, error: 'IM 判活响应缺 status_code 字段(未判定)' }
    }
    const statusDesc = typeof obj['status_desc'] === 'string' ? (obj['status_desc'] as string) : ''
    if (DOUBAO_AUTH_CODES.has(statusCode)) {
      return {
        ok: false,
        authFailed: true,
        error: `会话票被上游拒收:status_code=${statusCode}${statusDesc ? ` ${statusDesc}` : ''}`,
      }
    }
    if (statusCode !== 0) {
      return {
        ok: false,
        indeterminate: true,
        error: `IM 判活业务码 ${statusCode}${statusDesc ? ` ${statusDesc}` : ''}(非鉴权类,未判定)`,
      }
    }

    const downlink = obj['downlink_body']
    const inner =
      downlink && typeof downlink === 'object'
        ? (downlink as Record<string, unknown>)['batch_get_conv_info_downlink_body']
        : undefined
    const userId =
      inner && typeof inner === 'object' ? (inner as Record<string, unknown>)['user_id'] : undefined
    if (typeof userId !== 'string' || userId === '') {
      return {
        ok: false,
        indeterminate: true,
        error: 'IM 判活 status_code=0 但响应无 user_id(形状不符,未判定)',
      }
    }

    const expected =
      ctx.row.extraMetadata && typeof ctx.row.extraMetadata === 'object'
        ? (ctx.row.extraMetadata as Record<string, unknown>)['doubaoUserId']
        : undefined
    if (typeof expected === 'string' && expected !== '' && expected !== userId) {
      return {
        ok: false,
        authFailed: true,
        error: `会话票不属于本行账号:期望 user_id=${expected},实测 ${userId}(票被更换或顶号)`,
      }
    }

    // 判活通过,但凭据里若有不可进 HTTP 头的损坏项(本号 msToken 实测如此),
    // 如实随结果报出:不影响本次判定,但运营侧要知道凭据不是全好。
    const unsafe = listUnsafeCookieNames(ctx)
    if (unsafe.length > 0) {
      return {
        ok: true,
        error: `判活通过;凭据含 ${unsafe.length} 条损坏项(${unsafe.join(',')})已剔除后判活,建议重新导入该会话票`,
      }
    }
    return { ok: true }
  },

  /**
   * 额度点查(§0.3 如实未判定)。
   *
   * 2026-11-10 复核结论:`/api/user/quota` 仍是**字节签名墙**,真票也 401 空体,
   * 与凭据失效不可区分 ⇒ 非 2xx 一律未判定,authFailed 不由此端点判定。
   *
   * 同时确认了「豆包确实有额度体系」(登录态页面实证:每日签到领 200 额度、周一翻倍、
   * 签到 30 天得 8800),但该额度只在页面内展示,浏览器抓包全程未见余额查询 HTTP 端点
   * ⇒ 维持 quotaSupported=false,承载层直接标「未支持」,零探测零假数。
   * 若日后从签到/会员接口实证出余额端点,应在此处收口而不是猜字段。
   */
  async getQuota(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(DOUBAO_QUOTA_URL, {
        method: 'GET',
        headers: probeRequestHeaders(ctx),
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) {
        return {
          ok: false,
          error: `quota HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}(端点为签名墙,401 与凭证失效不可区分 ⇒ 未判定)`,
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
          `豆包未发现公开额度端点,${DOUBAO_QUOTA_URL} 为推断路径,响应键=[${keys.join(',') || '(空)'}],` +
          '字段形状未实证 ⇒ 未判定(不猜字段读成数字)',
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `额度点查失败: ${msg}` }
    }
  },

  isAuthFailure,

  isAuthError(err: unknown): boolean {
    return err instanceof DoubaoUpstreamError && (err.statusCode === 401 || err.statusCode === 403)
  },

  /**
   * 富错误分类(状态码粗分;无实证业务错误码,不发明):
   * 401/403→auth(401 自愈)、402/积分算力耗尽文案→credit、429→rate、
   * 404→not_found、5xx→server、其他 4xx→client。
   */
  classifyUpstreamFailure(statusCode: number, bodyText: string) {
    if (statusCode === 401 || statusCode === 403) return { kind: 'auth' as const }
    if (
      statusCode === 402 ||
      /(积分|算力|points|credit).{0,20}(不足|用尽|耗尽|exhausted|insufficient)/i.test(bodyText)
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
