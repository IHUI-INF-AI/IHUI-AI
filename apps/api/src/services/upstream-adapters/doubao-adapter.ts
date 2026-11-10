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
 * 5. **chat 走 HTTP + SSE**(2026-11-10 纯 Node 打通,推翻了此前"走 IM 长连接"的误判):
 *    `POST /chat/completion`(单数、无 /api)带真实 cookie 直接 200 `text/event-stream`,
 *    答问正常;补监听 WebSocket 后全程零 `WS-CREATED` ⇒ **没有任何长连接**。
 *    前一轮判死的真实原因:路径猜成 `/api/chat/completions`(复数、带 /api)+ 那次被风控
 *    拦成 710022004,把"端点猜错"误读成"协议不存在"。
 * 6. `a_bogus` **不是硬门**:带真实 cookie 时不传/传空/传假都回 200(只影响风控评分)
 *    ⇒ 适配器不伪造签名。`/api/*` 才是签名墙(真票也 401);`/samantha/*`、`/im/*` 不需要。
 *
 * ## 仍未实证的边界(照旧不冒绿)
 * - 额度:豆包有额度体系(页面实证「每日签到领 200」;SSE 里 `commerce_usage_data_v1`
 *   显示「本轮免费」),但**无公开余额查询端点** ⇒ getQuota 保持未判定、quotaSupported=false。
 * - 工具调用 / 多模态:`content_block` 只发 10000 文本块,未实证 tool/image 块形状 ⇒ 不伪造。
 * - 国际版:豆包海外版 = Cici,DOUBAO_GLOBAL_BASE 常量预留(无本机取证,留位待实证)。
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
  UpstreamSocketRequest,
} from '../relay-upstream-adapters.js'
import type { RelayProviderCode } from '../relay-account-format.js'

// =============================================================================
// 端点与常量(推断值;改端点只改这里。全部未实证,拿真实抓包后在此收口)
// =============================================================================

/** 实证:2026-10-27 号机 Cookies 里 .doubao.com 会话族所在主域 */
const DOUBAO_BASE = 'https://www.doubao.com'

/**
 * chat 端点(2026-11-10 纯 Node 实弹打通,`200 text/event-stream`)。
 *
 * 前一轮曾把这个能力判死,结论是错的,错因记录在此以免重犯:
 * 当时在浏览器里等待 `waitForRequest(/completion/)` 超时,就断言"豆包对话走 IM 长连接、
 * 不走 HTTP"。实际是**路径猜错**(真路径是 `/chat/completion` 单数,不是 `/api/chat/completions`),
 * 且那次请求被字节风控拦成 `710022004 rate limited`。补监听 WebSocket 后全程零 `WS-CREATED`,
 * 证明根本没有长连接。
 *
 * 实证面(纯 Node,零 a_bogus / 零浏览器):
 * - `a_bogus` **不是硬门**:带真实 cookie 时,不传/传空/传假值都回 200,签名只影响风控评分;
 * - 必需的是 query 面(见 doubaoChatQuery)与 body 的 cmd 信封结构(见 buildChatRequest);
 * - 响应是标准 SSE,事件族:`SSE_ACK`(给出 conversation_id)/ `FULL_MSG_NOTIFY`(用户消息回显)/
 *   `STREAM_MSG_NOTIFY` / `STREAM_CHUNK`(patch_op 增量)/ `CHUNK_DELTA`(纯文本增量)/
 *   `SSE_REPLY_END`(end_type 1→消息完成, 2→答案完成, 3→流结束)/ `SSE_HEARTBEAT` / `STREAM_ERROR`。
 */
const DOUBAO_CHAT_URL = `${DOUBAO_BASE}/chat/completion`

/**
 * 实证:豆包主对话 bot id(浏览器抓包 `client_meta.bot_id`,全站 web 会话固定值)。
 * 不是账号相关字段,换号不变;若上游改版,抓包即可更新。
 */
const DOUBAO_BOT_ID = '7338286299411103781'

/**
 * 实证:CHUNK_DELTA 的文本与 patch 的 text_block 是**两条互补增量通道**,不是重复流。
 * 实测「1+1等于几」:patch 给 `1` `+`,CHUNK_DELTA 接着给 `1` `=` `2`,拼起来才是 `1+1=2`;
 * 任何单取一路都会少字(只取 CHUNK_DELTA 得 `1=2`,只取 patch 得 `1+`)。
 * ⇒ translateStreamChunk 两路都收;用 `state.doubaoAnswer` 做前缀去重,防上游改发全量时重复。
 */

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

/** 构造 OpenAI chat.completion.chunk(豆包流式/非流式共用;模块级,避免 this 绑定问题) */
function buildDoubaoDeltaChunk(
  state: StreamState,
  content: string,
  finishReason: 'stop' | null,
): Record<string, unknown> {
  if (typeof state['doubaoChunkId'] !== 'string') {
    state['doubaoChunkId'] = `chatcmpl-doubao-${Date.now().toString(36)}`
    state['doubaoCreated'] = Math.floor(Date.now() / 1000)
  }
  return {
    id: state['doubaoChunkId'],
    object: 'chat.completion.chunk',
    created: state['doubaoCreated'],
    model: 'doubao',
    choices: [
      {
        index: 0,
        delta: content === '' ? { role: 'assistant' } : { role: 'assistant', content },
        finish_reason: finishReason,
      },
    ],
  }
}

/**
 * 实证:chat 面 query 比 IM 面多一组端类型/区域参数(2026-11-10 浏览器抓包逐字复刻,
 * 纯 Node 复现可通)。故意**不带 `a_bogus`** —— 实测真票下不传也回 200(签名只影响风控评分)。
 */
function doubaoChatQuery(ctx: AdapterAccountContext): string {
  const own = (ctx.row.deviceId ?? '').trim()
  return new URLSearchParams({
    aid: DOUBAO_AID,
    real_aid: DOUBAO_AID,
    device_id: own || DOUBAO_FALLBACK_DEVICE_ID,
    device_platform: 'web',
    doubao_device_platform: 'web',
    doubao_pc_version: DOUBAO_PC_VERSION,
    language: 'zh',
    pc_version: DOUBAO_PC_VERSION,
    pkg_type: 'release_version',
    region: 'CN',
    sys_region: 'CN',
    samantha_web: '1',
    'use-olympus-account': '1',
    version_code: '20800',
    web_platform: 'browser',
    tz_name: 'Asia/Shanghai',
  }).toString()
}

/** 实证:chat 面请求头(抓包复刻;accept 用通配符,SSE 由 content-type 判定而非 accept 协商) */
function chatRequestHeaders(ctx: AdapterAccountContext): Record<string, string> {
  return {
    accept: '*/*',
    'content-type': 'application/json',
    cookie: buildCookieHeader(ctx),
    'agw-js-conv': 'str, str',
    'user-agent': DOUBAO_UA,
    referer: `${DOUBAO_BASE}/chat/`,
  }
}

/** OpenAI content(string / parts 数组 / 对象) → 纯文本,未知形状按 JSON 兜底 */
function contentToPlainText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>
          if (typeof p['text'] === 'string') return p['text']
          if (typeof p['content'] === 'string') return p['content']
        }
        return ''
      })
      .filter((s) => s !== '')
      .join('')
  }
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c['text'] === 'string') return c['text']
    try {
      return JSON.stringify(content)
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * 多轮 → 单条消息文本(豆包 web 面一条 chat/completion 只收一条用户消息,
 * 多轮上下文靠 conversation_id;本仓没有豆包会话 id 映射 ⇒ 把历史压成一段带角色标签的文本)。
 * 单条 user 消息(最常见)逐字直传,不加任何标签,避免污染 prompt。
 */
function flattenMessagesForDoubao(messages: Array<{ role: string; content: unknown }>): string {
  if (messages.length === 1 && messages[0]?.role === 'user') {
    return contentToPlainText(messages[0].content)
  }
  const label = (role: string): string => {
    if (role === 'system') return '[系统指令]'
    if (role === 'assistant') return '[助手]'
    if (role === 'tool') return '[工具结果]'
    return '[用户]'
  }
  return messages
    .map((m) => `${label(String(m.role))} ${contentToPlainText(m.content)}`.trim())
    .filter((s) => s !== '' && s !== label(''))
    .join('\n')
}

// =============================================================================
// 上游会话续写缓存(2026-11-11 立)
// =============================================================================

/**
 * 豆包上游 conversation_id 续写缓存。
 *
 * 为什么要有:豆包多轮上下文靠 conversation_id —— 首轮 need_create 拿到 SSE_ACK 的
 * 数字会话 id,后续轮透传它才能在**同一对话里续写**。此前的折中是每轮全量压送历史
 * (内容不丢但每次重建对话,token 翻倍且易触发上游建对话频控)。
 *
 * 两个存储,各管一半:
 * - `conversationCache`(持久键 `${账号id}:${会话键}`):跨请求存数字会话 id,
 *   TTL 30min(与号池亲和 TTL 对齐)+ 容量 5000(超限先清过期,再删最旧)。
 * - `sessionKeyByCtx`(WeakMap<ctx, 会话键>):translateStreamChunk 拿不到 req,
 *   但 ctx 贯穿 buildChatRequest → translateStreamChunk 整个请求生命周期,
 *   用它桥接"本轮是哪个会话";ctx 被回收即自动清理,零泄漏、不占契约字段。
 */
const CONVERSATION_TTL_MS = 30 * 60_000
const CONVERSATION_CACHE_MAX = 5000
const conversationCache = new Map<string, { convId: string; expiresAt: number }>()
const sessionKeyByCtx = new WeakMap<AdapterAccountContext, string>()

/** 请求入口调用:把本轮会话键记到 ctx 上(供流式翻译端回写缓存) */
function bindDoubaoSessionKey(ctx: AdapterAccountContext, req: NormalizedChatRequest): void {
  sessionKeyByCtx.set(ctx, (req.conversationId ?? '').trim())
}

/** 查续写缓存:同账号+同会话键 → 上轮记录的数字会话 id;过期即删即 miss */
function lookupCachedConversation(ctx: AdapterAccountContext): string | undefined {
  const sessionKey = sessionKeyByCtx.get(ctx) ?? ''
  if (sessionKey === '') return undefined
  const key = `${String(ctx.row?.id ?? '')}:${sessionKey}`
  const hit = conversationCache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    conversationCache.delete(key)
    return undefined
  }
  return hit.convId
}

/** 流内捕获到上游会话 id 时写入(同会话幂等覆盖;超限先清过期,再淘汰最旧) */
function rememberConversation(ctx: AdapterAccountContext, convId: string): void {
  const sessionKey = sessionKeyByCtx.get(ctx)
  if (sessionKey === undefined || sessionKey === '') return
  const key = `${String(ctx.row?.id ?? '')}:${sessionKey}`
  const now = Date.now()
  if (conversationCache.size >= CONVERSATION_CACHE_MAX) {
    for (const [k, v] of conversationCache) {
      if (v.expiresAt <= now) conversationCache.delete(k)
      if (conversationCache.size < CONVERSATION_CACHE_MAX) break
    }
    while (conversationCache.size >= CONVERSATION_CACHE_MAX) {
      const oldest = conversationCache.keys().next().value
      if (oldest === undefined) break
      conversationCache.delete(oldest)
    }
  }
  conversationCache.set(key, { convId, expiresAt: now + CONVERSATION_TTL_MS })
}

/** 测试钩子:清空缓存(TTL/容量边界用 fake timers 推进时间验证) */
export function __clearDoubaoConversationCache(): void {
  conversationCache.clear()
}

/**
 * 实证:chat 请求体(2026-11-10 浏览器抓包 + 纯 Node 复现成功的最小充分集)。
 * 关键结构:`messages[].content_block[]` 里 `block_type:10000` 是文本块,
 * 文本放在 `content.text_block.text`;`option` 里 `agent_mode/conversation_mode/
 * sse_recv_event_options.support_chunk_delta` 三个开关缺一不可(缺则不下发 CHUNK_DELTA,
 * 只剩 patch 通道 ⇒ 丢字)。
 */
function buildChatBody(
  req: NormalizedChatRequest,
  text: string,
  cachedConvId?: string,
): Record<string, unknown> {
  const now = Date.now()
  const localConvId = `local_${now}`
  const messageId = crypto.randomUUID()
  const blockId = crypto.randomUUID()
  // 会话 id 决策(2026-11-11 立续写缓存),三级:
  // 1. 客户端显式给纯数字长串 → 直接透传(那就是上游真实会话 id);
  // 2. 否则查续写缓存(同账号+同会话键 → 上轮 SSE_ACK 记下的数字 id)→ 透传,上游续写;
  // 3. 都没有 → need_create_conversation 新建(多轮历史仍全量压送兜底,内容不丢)。
  // 绝不把自有 id 当作豆包 conversation_id 送给上游(会被判会话不存在)。
  const sessionKey = (req.conversationId ?? '').trim()
  const rawConv = /^\d{10,}$/.test(sessionKey) ? sessionKey : (cachedConvId ?? '')
  const convId = /^\d{10,}$/.test(rawConv) ? rawConv : ''
  return {
    client_meta: {
      local_conversation_id: localConvId,
      conversation_id: convId,
      bot_id: DOUBAO_BOT_ID,
      last_section_id: '',
      last_message_index: null,
      local_permissions: [],
    },
    messages: [
      {
        local_message_id: messageId,
        content_block: [
          {
            block_type: 10000,
            block_id: blockId,
            content: {
              text_block: { text, icon_url: '', icon_url_dark: '', summary: '' },
              pc_event_block: '',
            },
            parent_id: '',
            meta_info: [],
            extra_info: {},
            append_fields: [],
          },
        ],
        message_status: 0,
      },
    ],
    option: {
      create_time_ms: now,
      answer_with_suggest: false,
      agent_mode: 2,
      tts_switch: false,
      need_deep_think: 0,
      is_audio: false,
      need_create_conversation: convId === '',
      conversation_init_option: { need_ack_conversation: true },
      conversation_init_ext: { model_item_key: '0', reasoning_effort: '5', mode_id: '1' },
      model_config: { model_item_key: '0', model_extra_params: {}, reasoning_effort: 5 },
      aggregate_params: {
        conversation_mode: '1',
        mode_id: '1',
        model_item_key: '0',
        agent_mode: '2',
        reasoning_effort: '5',
        provider_id: '',
        mention_skill_list: '[]',
        mention_plugin_list: '[]',
        mention_ext: '[{}]',
      },
      conversation_mode: 1,
      sse_recv_event_options: { support_chunk_delta: true },
      support_lazy_fetch_stream: true,
      message_from: 0,
      is_old_user: true,
      scene_type: 0,
      unique_key: crypto.randomUUID(),
      start_seq: 0,
    },
    user_context: [],
    ext: {
      agent_mode: '2',
      use_deep_think: '0',
      is_finish: '1',
      commerce_credit_config_enable: '0',
    },
  }
}

/**
 * 实证:IM 面请求头(content-type 必须带 `encoding=utf-8`,否则回 712012002「不支持编码类型」)
 */
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
   * chat 请求构造(2026-11-10 实证重写,纯 Node 已打通)。
   *
   * 前一轮把这里写成「契约占位、不产出可用上游调用」是错的 —— 错在端点路径猜成
   * `/api/chat/completions`(复数、带 /api),而真路径是 `/chat/completion`(单数、无 /api)。
   * 换对端点后同一个 cookie 直接 200 text/event-stream,且**不需要 a_bogus**。
   *
   * 模型名:豆包 web 面用 `conversation_init_ext.model_item_key` 选模型(默认 '0' = 豆包主模型),
   * 不认 OpenAI 的 `model` 字段 ⇒ 客户端传的 model 不映射,固定 '0'(见头注 quota/model 边界)。
   */
  buildChatRequest(ctx: AdapterAccountContext, req: NormalizedChatRequest): UpstreamHttpRequest {
    bindDoubaoSessionKey(ctx, req)
    const text = flattenMessagesForDoubao(req.messages)
    const rawBody = JSON.stringify(buildChatBody(req, text, lookupCachedConversation(ctx)))
    return {
      url: `${DOUBAO_CHAT_URL}?${doubaoChatQuery(ctx)}`,
      method: 'POST',
      headers: chatRequestHeaders(ctx),
      rawBody,
    }
  },

  /**
   * 长连接能力声明(2026-11-10 立)。
   *
   * **边界如实写**:豆包 web 面只有 HTTPS + SSE —— 2026-11-10 补 WebSocket 监听后
   * 全程零 `WS-CREATED`(见文件头实证记录),所以本平台声明的是 `transport: 'sse'`,
   * 即"一条活到流结束的上游连接",不是 WS。真正的豆包 WS 在火山方舟
   * (`wss://ark.cn-beijing.volces.com/api/v3/realtime`),那走 API Key 体系,
   * 与号池 cookie 是两套凭据,不在本适配器范围内(渠道侧 /ws/doubao 已接)。
   *
   * 声明它的理由不是性能:HTTP 路径与 sse 路径单请求开销等价。理由是
   * 1. 号池对外 WS 入口(/ws/relay/chat)需要一条统一的"上游连接"抽象来做取消传播;
   * 2. WS 运输层已实现并有测试覆盖,后续接入有真 WS 端点的平台只需改 transport 一个字段。
   * 性能上不吹收益 —— 若将来拿到豆包 web 面的 WS 证据,只改这里。
   */
  socketSupported: true,

  buildSocketRequest(
    ctx: AdapterAccountContext,
    req: NormalizedChatRequest,
  ): UpstreamSocketRequest {
    // 复用同一套端点/头/信封构造,只换运输方式:两条路径的上游语义必须逐字一致,
    // 否则 socket 通道会变成"另一个豆包适配器",迟早与 HTTP 路径漂移。
    // (不写 this.buildChatRequest:对象字面量方法的 this 绑定在冻结/解构后不稳)
    bindDoubaoSessionKey(ctx, req)
    const text = flattenMessagesForDoubao(req.messages)
    return {
      url: `${DOUBAO_CHAT_URL}?${doubaoChatQuery(ctx)}`,
      method: 'POST',
      headers: chatRequestHeaders(ctx),
      rawBody: JSON.stringify(buildChatBody(req, text, lookupCachedConversation(ctx))),
      transport: 'sse',
    }
  },

  /**
   * 流式帧翻译(2026-11-10 实证,纯 Node 抓到的 25 帧全覆盖)。
   *
   * 上游只给 `data:` 行(转发层的 readSseDataLines 剥掉了 event 名)⇒ **只能按 JSON 形状判别**:
   * - `error_code` 存在          ⇒ STREAM_ERROR,抛 DoubaoUpstreamError(交给转发层罚号/冷却)
   * - `end_type === 3`           ⇒ 流结束,发 finish_reason:'stop' 且 done:true
   * - `end_type` 其他(1/2)      ⇒ 中间收尾(消息完成/答案完成),忽略
   * - `text` 字符串              ⇒ CHUNK_DELTA 增量
   * - `patch_op[]`               ⇒ STREAM_CHUNK,只取 `patch_object===1` 里 `block_type===10000`
   *                                 的 `content.text_block.text`(loading_block 10101 / tts 111 /
   *                                 ext 50 / content_status 3 一律丢)
   * - 其余(SSE_ACK / FULL_MSG_NOTIFY / HEARTBEAT)⇒ null
   *
   * 两路增量**互补而非重复**(实测 patch 给 `1+`、CHUNK_DELTA 给 `1=2`,合起来才是 `1+1=2`),
   * 故都收;用 state.doubaoAnswer 做前缀去重,防上游某天改发全量导致重复输出。
   */
  translateStreamChunk(
    ctx: AdapterAccountContext,
    rawFrame: string,
    state: StreamState,
  ): TranslatedChunk | null {
    let s = rawFrame.trim()
    if (s.startsWith('data:')) s = s.slice(5).trim()
    if (!s || s === '[DONE]') return null
    let obj: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(s)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      obj = parsed as Record<string, unknown>
    } catch {
      return null // 心跳/注释等非 JSON 帧:忽略
    }

    // 0) 会话 id 捕获(2026-11-11 立续写缓存):任何帧顶层带纯数字长串 conversation_id
    //    (SSE_ACK 确认帧必然带;其余帧带了也是同一会话的幂等重复)⇒ 记入缓存。
    //    下一轮同会话请求透传它 ⇒ need_create_conversation=false,上游在同一对话续写。
    const ackConv = obj['conversation_id']
    if (typeof ackConv === 'string' && /^\d{10,}$/.test(ackConv)) {
      rememberConversation(ctx, ackConv)
    }

    // 1) 错误帧:上游业务错误必须冒泡,不能静默吞成"空回答"
    const errCode = obj['error_code']
    if (typeof errCode === 'number') {
      const msg = typeof obj['error_msg'] === 'string' ? obj['error_msg'] : ''
      // 710022004 = 风控限流(可冷却自愈)⇒ 用 429 让转发层按限流退避;其余归 502
      throw new DoubaoUpstreamError(
        String(errCode) === '710022004' ? 429 : 502,
        `豆包流错误 ${errCode}${msg ? `: ${msg}` : ''}`,
      )
    }

    // 2) 结束帧
    const endType = obj['end_type']
    if (typeof endType === 'number') {
      if (endType !== 3) return null // 1=消息完成, 2=答案完成:都不是流终点
      return {
        openaiChunk: buildDoubaoDeltaChunk(state, '', 'stop'),
        done: true,
      }
    }

    // 3) 正文增量:三条通道都要,缺一路就丢字(2026-11-10 短回答实测)
    //    a. CHUNK_DELTA         → obj.text
    //    b. STREAM_CHUNK patch   → patch_op[].patch_value.content_block[]
    //    c. STREAM_MSG_NOTIFY    → obj.content.content_block[]  ← 短回答的首字只在这里出现
    // 每条 10000 文本块按 block_id 累积(上游对同一 block 可能发增量,也可能发全量重发,
    // 统一用「已累积前缀」比对:是全量就取新增尾巴,是增量就直接追加)。
    let piece = ''
    if (typeof obj['text'] === 'string') piece += obj['text']

    const takeBlocks = (blocks: unknown): void => {
      if (!Array.isArray(blocks)) return
      for (const rawBlock of blocks) {
        if (!rawBlock || typeof rawBlock !== 'object') continue
        const block = rawBlock as Record<string, unknown>
        if (block['block_type'] !== 10000) continue // 10101 = loading 占位块,不是正文
        const content = block['content']
        if (!content || typeof content !== 'object') continue
        const tb = (content as Record<string, unknown>)['text_block']
        if (!tb || typeof tb !== 'object') continue
        const t = (tb as Record<string, unknown>)['text']
        if (typeof t !== 'string' || t === '') continue
        const blockId = typeof block['block_id'] === 'string' ? block['block_id'] : '(noid)'
        const key = `doubaoBlock:${blockId}`
        const prev = typeof state[key] === 'string' ? (state[key] as string) : ''
        if (t === prev) continue // 同块全量重发且无新增
        if (prev !== '' && t.startsWith(prev)) {
          piece += t.slice(prev.length) // 全量重发:只取新增尾巴
          state[key] = t
        } else {
          piece += t // 增量追加
          state[key] = prev + t
        }
      }
    }

    const ops = Array.isArray(obj['patch_op']) ? obj['patch_op'] : []
    for (const raw of ops) {
      if (!raw || typeof raw !== 'object') continue
      const op = raw as Record<string, unknown>
      if (op['patch_object'] !== 1) continue // 1 = content_block;111=tts / 50=ext / 3=status
      const pv = op['patch_value']
      if (!pv || typeof pv !== 'object') continue
      takeBlocks((pv as Record<string, unknown>)['content_block'])
    }
    const notifyContent = obj['content']
    if (notifyContent && typeof notifyContent === 'object') {
      takeBlocks((notifyContent as Record<string, unknown>)['content_block'])
    }

    if (piece === '') return null

    // 跨通道去重:CHUNK_DELTA 与 block 通道理论上互补,但上游若把同段发两遍,
    // 只保留「累积串尾巴之后」的那部分。
    const acc = typeof state['doubaoAnswer'] === 'string' ? state['doubaoAnswer'] : ''
    if (piece === acc) return null
    if (acc !== '' && piece.startsWith(acc) && piece.length > acc.length) {
      piece = piece.slice(acc.length)
    }
    state['doubaoAnswer'] = acc + piece
    return { openaiChunk: buildDoubaoDeltaChunk(state, piece, null) }
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
