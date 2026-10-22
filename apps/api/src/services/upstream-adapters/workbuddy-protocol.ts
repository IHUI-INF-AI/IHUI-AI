// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy/CodeBuddy(腾讯 AI IDE)上游协议纯函数(2026-10-22 立)。
 *
 * 与 workbuddy-adapter.ts 拆分:本文件只做「字符串/对象进、字符串/对象出」的纯计算
 * (realm 判定、头构造、body 改写、响应信封解析、失败分类),不碰网络、不碰凭证存储,
 * 便于单测直接覆盖协议规格。设计要点:
 * - 上游是 OpenAI 兼容 /v2/chat/completions,但有一组 Go 服务端的硬性约束
 *   (强制流式、tool_choice 必须是 string、max_completion_tokens 别名等),集中在 prepareChatBody。
 * - 缺字段的身份头必须用 X-No-* 显式声明(=1),不得静默省略 —— 上游据此区分
 *   "客户端没带" 与 "用户确实没有该属性"。
 * - chat 请求绝不携带 X-Refresh-Token(红线:refreshToken 只走 refresh 端点)。
 * - 错误分类 classifyUpstreamFailure 决定转发层是否罚号:请求级错误(400 系)与限流
 *   不罚号;credit/session_dead/auth 走各自的自愈路径。
 */
import { createHash, randomBytes } from 'node:crypto'

// =============================================================================
// realm(国内 CN / 国际 global)判定与常量
// =============================================================================

export type WorkBuddyRealm = 'cn' | 'global'

const CN_CHAT_BASE = 'https://copilot.tencent.com'
const GLOBAL_CHAT_BASE = 'https://www.workbuddy.ai'
const CN_ORIGIN = 'https://www.codebuddy.cn'
const GLOBAL_ORIGIN = 'https://www.workbuddy.ai'

/** domain == workbuddy.ai 或 *.workbuddy.ai → global;缺失/其他 → CN(默认) */
export function resolveRealm(domain: string): WorkBuddyRealm {
  const d = domain.trim().toLowerCase()
  if (d === 'workbuddy.ai' || d.endsWith('.workbuddy.ai')) return 'global'
  return 'cn'
}

export function chatBaseUrl(realm: WorkBuddyRealm): string {
  return realm === 'global' ? GLOBAL_CHAT_BASE : CN_CHAT_BASE
}

export function originFor(realm: WorkBuddyRealm): string {
  return realm === 'global' ? GLOBAL_ORIGIN : CN_ORIGIN
}

/** UA 平台段:CN 为 WorkBuddy,global 为 WorkBuddy AI;产品/CLI 版本段两域一致 */
export function userAgentFor(realm: WorkBuddyRealm): string {
  const platform = realm === 'global' ? 'WorkBuddy AI' : 'WorkBuddy'
  return `${platform}/5.5.4 WorkBuddy/5.5.4 CLI/2.137.1`
}

export function acceptLanguageFor(realm: WorkBuddyRealm): string {
  return realm === 'global' ? 'en-US' : 'zh-CN'
}

// =============================================================================
// 请求关联 id(设备/会话指纹 + 会话聚合主键)
// =============================================================================

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** X-Machine-ID / X-Session-ID:sha256("wb2a:"+purpose+":"+uid) 前 36 hex(跨请求稳定、账号间互异) */
export function deriveStableId(purpose: 'machine' | 'session', uid: string): string {
  return sha256Hex(`wb2a:${purpose}:${uid}`).slice(0, 36)
}

/** 每请求随机 32hex(X-Conversation-Message-ID / X-Request-ID) */
export function randomHex32(): string {
  return randomBytes(16).toString('hex')
}

/**
 * X-Conversation-Request-ID(聚合主键):有 conversationId 时由 sha256 前 32 hex 派生
 * (保证同会话稳定);无则随机。
 */
export function deriveConversationRequestId(conversationId?: string): string {
  const cid = conversationId?.trim()
  if (cid) return sha256Hex(cid).slice(0, 32)
  return randomHex32()
}

// =============================================================================
// 身份字段解析(extraMetadata > JWT claims > row.uid 兜底)
// =============================================================================

export interface WorkBuddyIdentity {
  uid: string
  enterpriseId: string
  domain: string
}

/** 宽松取字符串字段(number 也接受;其余/空 → '') */
function str(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/**
 * 解析 X-User-Id / X-Enterprise-Id / X-Domain 三个身份字段。
 * claims 由调用方(adapter)用 parseJwtClaims 解好再传入,本函数保持零依赖纯计算。
 */
export function resolveIdentity(opts: {
  extraMetadata: unknown
  claims: Record<string, unknown> | null
  rowUid: string
}): WorkBuddyIdentity {
  const extra = asRecord(opts.extraMetadata)
  const claims = opts.claims
  const claimsData = asRecord(claims?.['data'])

  const uid =
    str(extra['uid']) ||
    str(claims?.['uid']) ||
    str(claims?.['sub']) ||
    str(claimsData['id']) ||
    opts.rowUid.trim()

  const enterpriseId =
    str(extra['enterpriseId']) || str(claims?.['enterpriseId']) || str(claims?.['enterprise_id'])

  const domain = str(extra['domain']) || str(claims?.['domain'])

  return { uid, enterpriseId, domain }
}

// =============================================================================
// 登录态双格式解析(cookie 串 / token JSON / 裸 JWT·opaque)
// =============================================================================

/** 解析后的登录材料;accessToken 为空 = 该账号无可用访问凭证(头构造走 X-No-*) */
export interface WorkBuddyLoginState {
  accessToken: string
  /** 首选刷新凭证:credentials.refreshToken 优先,缺省时取内嵌(JSON/cookie 串/cookies 数组) */
  refreshToken: string
  /** 内嵌形态的刷新凭证(与首选不同值时才作回退候选;首选失效时换用) */
  embeddedRefreshToken: string
}

const ACCESS_KEYS = ['accessToken', 'access_token', 'token', 'user_token']
const REFRESH_KEYS = ['refreshToken', 'refresh_token']

function firstStr(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = str(o[k])
    if (v) return v
  }
  return ''
}

/** "k1=v1; k2=v2" → 键值表(同名键取首个;无 '=' 段忽略) */
export function parseCookieString(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const seg of s.split(';')) {
    const eq = seg.indexOf('=')
    if (eq <= 0) continue
    const k = seg.slice(0, eq).trim()
    const v = seg.slice(eq + 1).trim()
    if (k && v && !(k in out)) out[k] = v
  }
  return out
}

/** 含已知鉴权 cookie 键名 + '=' → 判 cookie 串形态(避免把含 '=' 的 opaque token 误拆) */
function looksLikeCookieString(s: string): boolean {
  if (!s.includes('=')) return false
  const keys = [...ACCESS_KEYS, ...REFRESH_KEYS].join('|')
  return new RegExp(`(?:^|[;\\s])(?:${keys})\\s*=`).test(s)
}

/**
 * 登录态双格式兼容:凭据 token 可能是
 * - token JSON:{"accessToken":"AT","refreshToken":"RT"}(下划线别名同样认)
 * - cookie 串:"token=AT; refresh_token=RT"(已知键名才按 cookie 拆)
 * - 裸 JWT / opaque token:原样作 accessToken
 * 另支持 Chrome 导出 cookies 数组 [{name,value}] 兜底。刷新凭证:显式 refreshToken > 内嵌。
 */
export function parseLoginState(i: {
  token?: string | null
  refreshToken?: string | null
  cookies?: Array<Record<string, unknown>> | null
}): WorkBuddyLoginState {
  const primaryRefresh = str(i.refreshToken)
  let accessToken = ''
  let embedded = ''

  const token = str(i.token)
  if (token) {
    let jsonParsed = false
    if (token.startsWith('{')) {
      try {
        const o = asRecord(JSON.parse(token) as unknown)
        jsonParsed = true
        accessToken = firstStr(o, ACCESS_KEYS)
        embedded = firstStr(o, REFRESH_KEYS)
      } catch {
        /* 非法 JSON → 按不透明 token 处理 */
      }
    }
    if (!jsonParsed && looksLikeCookieString(token)) {
      const pairs: Record<string, unknown> = parseCookieString(token)
      accessToken = firstStr(pairs, ACCESS_KEYS)
      embedded = firstStr(pairs, REFRESH_KEYS)
    } else if (!jsonParsed && !accessToken) {
      accessToken = token
    }
  }

  if (!accessToken || !embedded) {
    for (const c of i.cookies ?? []) {
      const name = str(c?.['name'])
      const value = str(c?.['value'])
      if (!name || !value) continue
      if (!accessToken && ACCESS_KEYS.includes(name)) accessToken = value
      if (!embedded && REFRESH_KEYS.includes(name)) embedded = value
    }
  }

  return {
    accessToken,
    refreshToken: primaryRefresh || embedded,
    embeddedRefreshToken: embedded && embedded !== primaryRefresh ? embedded : '',
  }
}

// =============================================================================
// token 刷新端点(主端点失败后按序回退到备用端点)
// =============================================================================

/** 刷新端点路径(按 realm base 拼接);主 /v2/plugin/auth/token/refresh,备用 /v2/auth/token/refresh */
export const REFRESH_ENDPOINT_PATHS = ['/v2/plugin/auth/token/refresh', '/v2/auth/token/refresh']

// =============================================================================
// 请求头构造
// =============================================================================

export interface ChatHeaderInput {
  realm: WorkBuddyRealm
  accessToken: string
  uid: string
  enterpriseId: string
  domain: string
  machineId: string
  sessionId: string
  conversationRequestId: string
  messageRequestId: string
}

/** chat 请求头全集;空身份字段用 X-No-* 显式声明。绝不携带 X-Refresh-Token(红线)。 */
export function buildChatHeaders(i: ChatHeaderInput): Record<string, string> {
  const origin = originFor(i.realm)
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CodeBuddy-Request': '1',
    Origin: origin,
    Referer: origin,
    'User-Agent': userAgentFor(i.realm),
    'X-Product': 'SaaS',
    'Accept-Language': acceptLanguageFor(i.realm),
    'X-Machine-ID': i.machineId,
    'X-Session-ID': i.sessionId,
    'X-Conversation-Request-ID': i.conversationRequestId,
    'X-Conversation-Message-ID': i.messageRequestId,
    'X-Request-ID': i.messageRequestId,
    'X-Root-Request-ID': i.conversationRequestId,
  }
  if (i.accessToken) h['Authorization'] = `Bearer ${i.accessToken}`
  else h['X-No-Authorization'] = '1'
  if (i.uid) h['X-User-Id'] = i.uid
  else h['X-No-User-Id'] = '1'
  if (i.enterpriseId) h['X-Enterprise-Id'] = i.enterpriseId
  else h['X-No-Enterprise-Id'] = '1'
  if (i.domain) h['X-Domain'] = i.domain
  else h['X-No-Department-Info'] = '1'
  return h
}

/**
 * token 刷新请求头 = chat Common 头组(去掉 Authorization 系)+ X-Refresh-Token +
 * X-Enterprise-Id(有则发)+ X-Auth-Refresh-Source: workbuddy。
 * 不带 Authorization —— 刷新凭证只有 refreshToken。
 */
export function buildRefreshHeaders(
  i: Omit<ChatHeaderInput, 'accessToken'> & { refreshToken: string },
): Record<string, string> {
  const { refreshToken, ...common } = i
  const h = buildChatHeaders({ ...common, accessToken: '' })
  delete h['Authorization']
  delete h['X-No-Authorization']
  delete h['X-User-Id']
  delete h['X-No-User-Id']
  delete h['X-Domain']
  delete h['X-No-Department-Info']
  h['Accept'] = 'application/json'
  h['X-Refresh-Token'] = refreshToken
  h['X-Auth-Refresh-Source'] = 'workbuddy'
  return h
}

/** 模型目录 / 健康检查请求头(GET,最小集) */
export function buildHealthHeaders(i: {
  realm: WorkBuddyRealm
  accessToken: string
}): Record<string, string> {
  const origin = originFor(i.realm)
  const h: Record<string, string> = {
    Accept: 'application/json',
    Origin: origin,
    Referer: origin,
    'User-Agent': userAgentFor(i.realm),
    'X-CodeBuddy-Request': '1',
  }
  if (i.accessToken) h['Authorization'] = `Bearer ${i.accessToken}`
  return h
}

// =============================================================================
// 请求体改写(PrepareBody 顺序)
// =============================================================================

/**
 * 上游 body 硬性约束改写。入参是转发层归一化后的 OpenAI 形状 body(宽松 record,
 * tools/tool_choice 等扩展字段当前接口不透传,但本函数按完整规则处理,便于将来透传)。
 */
export function prepareChatBody(raw: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...raw }

  // 1. 强制流式(上游拒绝非流式;非流式客户端请求由转发层聚合)
  body['stream'] = true

  // 2. max_completion_tokens → max_tokens(显式 max_tokens 优先,别名只删)
  const alias = body['max_completion_tokens']
  delete body['max_completion_tokens']
  if (body['max_tokens'] === undefined && alias !== undefined) body['max_tokens'] = alias

  // 3. GPT 系模型 max_tokens 下限 16
  if (typeof body['model'] === 'string' && body['model'].startsWith('gpt-')) {
    const mt = body['max_tokens']
    if (typeof mt === 'number' && mt < 16) body['max_tokens'] = 16
  }

  // 4. 未显式带 stream_options 时补 include_usage(末帧 usage 计费依赖)
  if (body['stream_options'] === undefined) body['stream_options'] = { include_usage: true }

  // 5. tool_choice 归一化(上游 Go string,对象形态 400 code=11101)
  normalizeToolChoice(body)

  // 6+7. messages:role developer→system;image_url 字符串形态→对象形态
  if (Array.isArray(body['messages'])) body['messages'] = normalizeMessages(body['messages'])

  return body
}

function normalizeToolChoice(body: Record<string, unknown>): void {
  const tc = body['tool_choice']
  if (tc === undefined) return

  if (typeof tc === 'string') {
    if (tc === 'none') {
      delete body['tool_choice']
      delete body['tools']
      delete body['functions']
    }
    return // 'auto'/'required'/函数名等字符串形态原样保留
  }

  const o = asRecord(tc)
  const type = o['type']
  if (type === 'none') {
    delete body['tool_choice']
    delete body['tools']
    delete body['functions']
  } else if (type === 'auto' || type === 'required') {
    body['tool_choice'] = type
  } else if (type === 'function') {
    const name = str(asRecord(o['function'])['name'])
    body['tool_choice'] = name || 'auto'
  } else {
    delete body['tool_choice']
  }
}

function normalizeMessages(messages: unknown[]): unknown[] {
  return messages.map((m) => {
    if (!m || typeof m !== 'object') return m
    const msg = { ...(m as Record<string, unknown>) }
    if (msg['role'] === 'developer') msg['role'] = 'system'
    if (Array.isArray(msg['content'])) {
      msg['content'] = (msg['content'] as unknown[]).map((part) => {
        if (!part || typeof part !== 'object') return part
        const p = part as Record<string, unknown>
        // image_url 字符串形态 → {url: 原值} 对象形态
        if (typeof p['image_url'] === 'string') return { ...p, image_url: { url: p['image_url'] } }
        return p
      })
    }
    return msg
  })
}

// =============================================================================
// 响应信封与流式帧
// =============================================================================

export interface WorkBuddyEnvelope {
  code: number
  msg: string
  data: unknown
}

/** 统一响应信封 {code,msg,data};非法/无 code → null */
export function parseEnvelope(text: string): WorkBuddyEnvelope | null {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return null
  }
  const o = asRecord(j)
  if (typeof o['code'] !== 'number') return null
  return { code: o['code'], msg: str(o['msg']), data: o['data'] }
}

/**
 * SSE data 载荷(OpenAI chunk 形状)轻归一化:finish_reason ""→null、
 * usage 缺 total_tokens 时按 prompt+completion 补。非对象 → null。
 */
export function normalizeStreamChunk(parsed: unknown): Record<string, unknown> | null {
  const o = asRecord(parsed)
  if (Object.keys(o).length === 0) return null

  if (Array.isArray(o['choices'])) {
    for (const c of o['choices']) {
      const choice = asRecord(c)
      if (choice['finish_reason'] === '') choice['finish_reason'] = null
    }
  }

  const usage = asRecord(o['usage'])
  if (Object.keys(usage).length > 0) {
    const pt = usage['prompt_tokens']
    const ct = usage['completion_tokens']
    const tt = usage['total_tokens']
    if (typeof tt !== 'number' && typeof pt === 'number' && typeof ct === 'number') {
      usage['total_tokens'] = pt + ct
      o['usage'] = usage
    }
  }
  return o
}

/** 非流式 completion 规范化:确保 id/object/choices/usage 存在(上游本就是 OpenAI 形状) */
export function normalizeCompletion(body: unknown): Record<string, unknown> {
  let parsed = body
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = {}
    }
  }
  const o = asRecord(parsed)
  if (typeof o['id'] !== 'string' || !o['id']) o['id'] = `chatcmpl-${randomHex32()}`
  if (typeof o['object'] !== 'string' || !o['object']) o['object'] = 'chat.completion'
  if (!Array.isArray(o['choices'])) o['choices'] = []
  if (!o['usage'] || typeof o['usage'] !== 'object') o['usage'] = {}
  return o
}

// =============================================================================
// 失败分类(转发层据此决定罚号/自愈/退避)
// =============================================================================

export type UpstreamFailureKind =
  'auth' | 'credit' | 'session_dead' | 'rate' | 'not_found' | 'request' | 'server' | 'client'

const CREDIT_MARKERS = [
  'insufficient credit',
  'no credit',
  'credit exhausted',
  'out of credit',
  'quota exceeded',
  'quota exhaust',
  'payment required',
  'credit not enough',
  'not enough credit',
  '积分不足',
  '额度不足',
  '余额不足',
  '积分用完',
  '额度用尽',
  '没有积分',
]

const RATE_MARKERS = [
  'rate limit',
  'rate-limiting',
  'rate-limited',
  'too many requests',
  'usage limit',
  '请求过于频繁',
  '限流',
]

/** 请求级错误(400 系,不罚号):文案标记 + 上游业务 code */
const REQUEST_MARKERS = [
  'unmarshal chat params failed',
  'prompt is too long',
  'invalid image_url',
  'queue.full',
  'blocked by security policy',
]
const REQUEST_CODES = [11101, 11115, 11135, 6021]

const TOKEN_BAD_RE = /token.*(expired|invalid)/
const SESSION_DEAD_RE = /offline user session not found/

/**
 * 鉴权失效的 body 文案标记:覆盖 JSON error 体({"error":{"code":"unauthorized"}})、
 * SSE 中途断流帧(data: {"error":{...}})与登录态失效提示(中英)。
 */
const AUTH_BODY_MARKERS = [
  'unauthorized',
  'authentication failed',
  'authentication_error',
  'invalid_token',
  'invalid token',
  'session expired',
  'not logged in',
  '重新登录',
  '登录已过期',
  '登录失效',
  '未登录',
]

/**
 * 非 200 返回 HTML 登录页(会话失效被重定向到登录墙)形态识别:
 * HTML 骨架 + 登录语义同现才算,避免把正常页面/错误模板误判为鉴权失效。
 */
export function looksLikeHtmlLoginPage(bodyText: string): boolean {
  const l = bodyText.toLowerCase()
  if (!l.includes('<html') && !l.includes('<!doctype html')) return false
  return (
    l.includes('login') ||
    l.includes('登录') ||
    l.includes('sign in') ||
    l.includes('sign-in') ||
    l.includes('signin') ||
    l.includes('认证')
  )
}

/** body 是否命中鉴权失效标记(不含状态码判定;401/403 由调用方先判) */
export function hasAuthFailureBodyMarker(bodyText: string): boolean {
  const lower = bodyText.toLowerCase()
  return (
    TOKEN_BAD_RE.test(lower) ||
    AUTH_BODY_MARKERS.some((m) => lower.includes(m)) ||
    looksLikeHtmlLoginPage(bodyText)
  )
}

/** 鉴权失效判定(401/403 或 body 命中会话死/token 过期/登录墙标记) */
export function isAuthFailureCore(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  const lower = bodyText.toLowerCase()
  if (SESSION_DEAD_RE.test(lower) || lower.includes('12153')) return true
  return hasAuthFailureBodyMarker(bodyText)
}

/**
 * 失败分类。判定顺序即优先级:credit → session_dead → auth → rate → not_found →
 * request → server → client。body 标记匹配一律大小写不敏感。
 */
export function classifyUpstreamFailure(statusCode: number, bodyText: string): UpstreamFailureKind {
  const lower = bodyText.toLowerCase()
  const env = parseEnvelope(bodyText)

  if (statusCode === 402 || CREDIT_MARKERS.some((m) => lower.includes(m))) return 'credit'
  if (SESSION_DEAD_RE.test(lower) || lower.includes('12153')) return 'session_dead'
  if (statusCode === 401 || statusCode === 403 || hasAuthFailureBodyMarker(bodyText)) return 'auth'
  if (
    statusCode === 429 ||
    RATE_MARKERS.some((m) => lower.includes(m)) ||
    (env?.code === 11140 && env.msg.toLowerCase().includes('the model provider is rate-limiting'))
  ) {
    return 'rate'
  }
  if (statusCode === 404) return 'not_found'
  if (
    (statusCode === 400 && REQUEST_MARKERS.some((m) => lower.includes(m))) ||
    (env !== null && REQUEST_CODES.includes(env.code))
  ) {
    return 'request'
  }
  if (statusCode >= 500) return 'server'
  return 'client'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
