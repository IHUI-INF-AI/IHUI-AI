// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae CN 上游协议纯函数辅助库(2026-10-22 立,配套 trae-adapter.ts)。
 *
 * 只放"无 IO、可单测"的纯函数:多轮扁平化、稳定会话 id、SSE 帧解析、
 * 增量字段探测、token 过期宽松解析、ExchangeToken 报文形状等。
 * 网络调用与错误语义全部留在 trae-adapter.ts 里。
 */
import { createHash } from 'node:crypto'

// =============================================================================
// 多轮扁平化(FlattenQuery)
// =============================================================================

/** 角色 → 扁平化段标签(上游 remote 会话只收单条 query 文本,多轮靠标签还原) */
const ROLE_LABELS: Record<string, string> = {
  system: '[System Instructions]',
  assistant: '[Previous Assistant Response]',
  tool: '[Tool Result]',
  user: '[User]',
}

/** 未知形状 content → 纯文本(字符串直取;数组取各 part 的 text/content;对象取 text/content) */
export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => contentToText(part))
      .filter((s) => s !== '')
      .join('')
  }
  if (content !== null && typeof content === 'object') {
    const o = content as Record<string, unknown>
    if (typeof o.text === 'string') return o.text
    if (typeof o.content === 'string') return o.content
  }
  return ''
}

/**
 * OpenAI messages → Trae 单条 query 文本。
 * 每段 `[标签]\n<正文>`,段间空行;空正文/未知角色的消息跳过。
 */
export function flattenQuery(messages: Array<{ role: string; content: unknown }>): string {
  const sections: string[] = []
  for (const m of messages) {
    const label = ROLE_LABELS[m.role]
    if (!label) continue
    const text = contentToText(m.content)
    if (text === '') continue
    sections.push(`${label}\n${text}`)
  }
  return sections.join('\n\n')
}

// =============================================================================
// 稳定会话 id(biz_session_id)
// =============================================================================

/**
 * `sha256(accountId + 0x1f + model)` 格式化成 UUIDv4 形态。
 *
 * 每账号+模型恒定(勿随机:上游按会话维度做风控/配额,随机 id 会被判定异常流量)。
 * 版本位固定 4、变体位固定 10xx,保证输出符合 UUIDv4 形状。
 */
export function deriveBizSessionId(accountId: string, model: string): string {
  const digest = createHash('sha256')
    .update(accountId + String.fromCharCode(0x1f) + model, 'utf8')
    .digest('hex')
  const d = digest.slice(0, 32)
  const variantNibble = ((parseInt(d.slice(16, 17), 16) & 0b1011) | 0b1000).toString(16)
  const s = d.slice(0, 12) + '4' + d.slice(13, 16) + variantNibble + d.slice(17, 32)
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

// =============================================================================
// SSE 事件流解析
// =============================================================================

/** 一条 SSE 事件(缺省事件名按 SSE 规范为 "message") */
export interface TraeSseEvent {
  event: string
  data: string
}

/** 事件名归一化别名表(上游驼峰连写 → 下划线规范名) */
const EVENT_NAME_ALIASES: Record<string, string> = {
  tokenusage: 'token_usage',
  modelconfig: 'model_config',
  planitem: 'plan_item',
}

/** 事件名归一化:小写 + 别名映射 */
export function normalizeEventName(name: string): string {
  const lower = name.trim().toLowerCase()
  return EVENT_NAME_ALIASES[lower] ?? lower
}

/** 终止事件名(data 为 [DONE] 之外的另一路终止信号) */
export const TERMINAL_EVENT_NAMES: ReadonlySet<string> = new Set([
  'done',
  'response_done',
  'stream_done',
])

/** 解析单个 SSE 事件块(不含块间空行);心跳/注释行以 ":" 开头,忽略 */
export function parseSseEventBlock(block: string): TraeSseEvent | null {
  let event: string | null = null
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue // 空行/心跳注释行
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      let v = line.slice(5)
      if (v.startsWith(' ')) v = v.slice(1) // SSE 规范:冒号后单空格剥离
      dataLines.push(v)
    }
  }
  if (event === null && dataLines.length === 0) return null
  return { event: event ?? 'message', data: dataLines.join('\n') }
}

/**
 * 增量喂入缓冲区 → 完整事件列表 + 未完结余量。
 * 先归一 \r\n → \n,再按空行(\n\n)切块;最后一段无终止空行时留在 rest 里等下一批。
 */
export function splitSseBlocks(buffer: string): { events: TraeSseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: TraeSseEvent[] = []
  for (const block of parts) {
    const ev = parseSseEventBlock(block)
    if (ev) events.push(ev)
  }
  return { events, rest }
}

/**
 * ReadableStream → SSE 事件异步序列。
 * 流结束时对残段做一次补解析(部分服务端最后一块不带终止空行)。
 */
export async function* iterateSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<TraeSseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) buffer += decoder.decode(value, { stream: true })
      const { events, rest } = splitSseBlocks(buffer)
      buffer = rest
      for (const ev of events) yield ev
    }
    buffer += decoder.decode()
    if (buffer !== '') {
      const ev = parseSseEventBlock(buffer.replace(/\r\n/g, '\n'))
      if (ev) yield ev
    }
  } finally {
    reader.releaseLock()
  }
}

// =============================================================================
// 帧字段探测(文本增量 / 推理增量 / usage / error)
// =============================================================================

/**
 * 文本增量探测(按优先级):
 * delta / text / content / value / message.delta / message.text / data.delta / data.text。
 * content 为数组时按 parts 拼接。空串视为无增量(避免产出空 delta 帧)。
 */
export function extractTextDelta(obj: Record<string, unknown>): string | null {
  for (const key of ['delta', 'text', 'content', 'value'] as const) {
    const v = obj[key]
    if (typeof v === 'string' && v !== '') return v
    if (Array.isArray(v)) {
      const t = contentToText(v)
      if (t !== '') return t
    }
  }
  for (const [parentKey, childKey] of [
    ['message', 'delta'],
    ['message', 'text'],
    ['data', 'delta'],
    ['data', 'text'],
  ] as const) {
    const parent = obj[parentKey]
    if (parent !== null && typeof parent === 'object' && !Array.isArray(parent)) {
      const v = (parent as Record<string, unknown>)[childKey]
      if (typeof v === 'string' && v !== '') return v
    }
  }
  return null
}

/** 推理增量探测(reasoning_content / reasoning / thinking 字段,仅字符串) */
export function extractReasoningDelta(obj: Record<string, unknown>): string | null {
  for (const key of ['reasoning_content', 'reasoning', 'thinking'] as const) {
    const v = obj[key]
    if (typeof v === 'string' && v !== '') return v
  }
  return null
}

/** OpenAI usage 形状 */
export interface OpenAiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_tokens_details: { cached_tokens: number }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * token_usage 帧探测:事件名为 token_usage/usage 时整帧即 usage 对象;
 * 否则找 obj.usage 子对象。字段兼容 input_tokens/prompt_tokens、
 * output_tokens/completion_tokens、cached_tokens。无任何计数字段 → null。
 */
export function extractUsage(obj: Record<string, unknown>, eventName: string): OpenAiUsage | null {
  let src: Record<string, unknown> | null = null
  if (eventName === 'token_usage' || eventName === 'usage') src = obj
  else if (obj.usage !== null && typeof obj.usage === 'object' && !Array.isArray(obj.usage)) {
    src = obj.usage as Record<string, unknown>
  }
  if (!src) return null
  const prompt = num(src.input_tokens) ?? num(src.prompt_tokens)
  const completion = num(src.output_tokens) ?? num(src.completion_tokens)
  const cached = num(src.cached_tokens)
  if (prompt === null && completion === null && cached === null) return null
  const p = prompt ?? 0
  const c = completion ?? 0
  return {
    prompt_tokens: p,
    completion_tokens: c,
    total_tokens: num(src.total_tokens) ?? p + c,
    prompt_tokens_details: { cached_tokens: cached ?? 0 },
  }
}

/**
 * error 帧探测:{code, message|error|detail}。
 * 判据:code 为数字形态(非 0),或带 error/detail 字段;普通内容帧不会误中。
 */
export function extractErrorInfo(
  obj: Record<string, unknown>,
): { code: string; message: string } | null {
  const codeRaw = obj.code
  const numericCode =
    typeof codeRaw === 'number' && Number.isFinite(codeRaw) && codeRaw !== 0
      ? String(codeRaw)
      : typeof codeRaw === 'string' && /^-?\d+$/.test(codeRaw) && codeRaw !== '0'
        ? codeRaw
        : null
  const hasErrorField = obj.error !== undefined || obj.detail !== undefined
  if (numericCode === null && !hasErrorField) return null
  const msg = [obj.message, obj.error, obj.detail].find((v) => typeof v === 'string' && v !== '')
  const msgStr =
    typeof msg === 'string'
      ? msg
      : obj.error !== undefined && typeof obj.error !== 'string'
        ? JSON.stringify(obj.error)
        : ''
  return { code: numericCode ?? 'unknown', message: msgStr }
}

// =============================================================================
// Token 刷新报文(ExchangeToken)
// =============================================================================

/** Trae OAuth ExchangeToken 固定 ClientID(web 渠道公开常量) */
export const TRAE_OAUTH_CLIENT_ID = 'ono9krqynydwx5'

/** ExchangeToken 请求体固定形状(ClientSecret/UserID 为占位常量) */
export function buildExchangeTokenBody(refreshToken: string): Record<string, string> {
  return {
    ClientID: TRAE_OAUTH_CLIENT_ID,
    RefreshToken: refreshToken,
    ClientSecret: '-',
    UserID: '',
  }
}

/**
 * 过期时刻宽松解析:unix 秒(<1e12)/毫秒(>=1e12)/ISO 字符串均可;
 * 纯数字字符串按数字处理。无法解析 → null(调用方决定兜底)。
 */
export function parseExpiresAt(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null
  let n: number | null = null
  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string') {
    const t = raw.trim()
    if (/^-?\d+(\.\d+)?$/.test(t)) n = Number(t)
    else {
      const parsed = Date.parse(t)
      return Number.isNaN(parsed) ? null : new Date(parsed)
    }
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return null
  // 秒/毫秒启发式:1e12 秒 ≈ 公元 33658 年,超过它的一律按毫秒
  const ms = n < 1e12 ? n * 1000 : n
  return new Date(ms)
}

/** 刷新响应解析结果 */
export interface TraeTokenPayload {
  token: string
  refreshToken: string | null
  expiresAt: Date | null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v !== '') return v
  }
  return null
}

function pickAny(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

/**
 * ExchangeToken 响应宽松提取:Result/result 包裹层或顶层皆可;
 * Token 兼容 AccessToken/access_token;RefreshToken 可能轮换(有则回传);
 * 过期字段兼容 ExpiredAt/TokenExpireAt。无 Token → null(调用方抛错)。
 */
export function extractTokenPayload(body: unknown): TraeTokenPayload | null {
  if (body === null || typeof body !== 'object') return null
  const top = body as Record<string, unknown>
  const wrapped =
    top.Result !== null && typeof top.Result === 'object'
      ? (top.Result as Record<string, unknown>)
      : top.result !== null && typeof top.result === 'object'
        ? (top.result as Record<string, unknown>)
        : null
  const inner = wrapped ?? top
  const token =
    pickString(inner, ['Token', 'token', 'AccessToken', 'access_token']) ??
    pickString(top, ['Token', 'token', 'AccessToken', 'access_token'])
  if (!token) return null
  const refreshToken =
    pickString(inner, ['RefreshToken', 'refresh_token']) ??
    pickString(top, ['RefreshToken', 'refresh_token'])
  const expiresRaw =
    pickAny(inner, ['ExpiredAt', 'TokenExpireAt']) ?? pickAny(top, ['ExpiredAt', 'TokenExpireAt'])
  return { token, refreshToken: refreshToken ?? null, expiresAt: parseExpiresAt(expiresRaw) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
