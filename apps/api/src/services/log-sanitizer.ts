// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 日志脱敏服务(2026-07-31 立,补齐 New API 已有的合规能力)。
 *
 * 与 plugins/log-sanitizer.ts(包装 pino logger 的 Fastify 插件)不同,
 * 本模块提供数据层的脱敏函数,供 admin/relay-logs 等路由在返回日志前调用,
 * 对 API Key / Email / Phone / Bearer Token / messages content / tool arguments 做正则脱敏。
 *
 * 三类导出:
 * - sanitizeLogEntry(entry, options): 对任意日志条目(对象/数组/字符串)递归脱敏
 * - sanitizeText(text, options): 对纯文本做正则脱敏
 * - sanitizeMessages(messages, options): 对 OpenAI messages 数组做结构化脱敏
 *
 * 脱敏规则:
 * - API Key:  sk-abc123xyz789 → sk-***xyz789(保留前 3 + 后 6)
 * - Email:    user@example.com → us**@example.com(保留前 2 + 域名)
 * - Phone:    13812345678 → 138****5678(保留前 3 + 后 4)
 * - Bearer:   Bearer eyJxxx.yyy.zzz → Bearer ***(JWT 整体替换)
 * - messages content: 替换为 [REDACTED length=N](N 为原长度)
 * - tool function.arguments: 替换为 [REDACTED](保留 tool_calls 结构)
 *
 * 入口封顶(A9E-1):所有会进入下方正则的字符串先在 sanitizeText 入口无条件
 * 截到 resolveSanitizeInputCap()(默认 4096,env IHUI_LOG_SANITIZE_MAX_CHARS 可覆盖),
 * 被截断时输出末尾追加 [TRUNCATED ...] 可见标记。顺序 = 先封顶、后正则,不可颠倒。
 */

// =============================================================================
// 类型定义
// =============================================================================

export interface SanitizeOptions {
  /** 默认 true,把 sk-xxx 替换为 sk-***xxx(同时脱敏 Bearer JWT) */
  redactApiKey?: boolean
  /** 默认 true,把 messages content 替换为 [REDACTED length=N] */
  redactUserContent?: boolean
  /** 默认 true,邮箱 a@b.com → a***@b.com */
  redactEmail?: boolean
  /** 默认 true,手机号 138****1234 */
  redactPhone?: boolean
  /** 默认 false,IP 默认不脱敏(审计需要) */
  redactIp?: boolean
  /** 默认 false,admin 可查看原始(由调用方传 true 跳过所有脱敏) */
  keepOriginalForAdmin?: boolean
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  redactApiKey: true,
  redactUserContent: true,
  redactEmail: true,
  redactPhone: true,
  redactIp: false,
  keepOriginalForAdmin: false,
}

function mergeDefaults(opts?: SanitizeOptions): Required<SanitizeOptions> {
  return { ...DEFAULT_OPTIONS, ...opts }
}

// =============================================================================
// 正则规则(按 spec 定义)
// =============================================================================

const API_KEY_REGEX = /sk-[A-Za-z0-9_-]{20,}/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX = /1[3-9]\d{9}/g
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const IPV4_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g

// =============================================================================
// 入口长度封顶(先封顶、后正则 — A9E-1 吸收,2026-09 立)
// =============================================================================

/**
 * 进入任何脱敏正则前的输入硬封顶(字符数,默认值)。
 * 清洗对象常是上游 HTTP 响应体 / 工具输出 / CI 日志片段,长度无界;
 * 多条带回溯风险的 Alternation 正则 × 无界输入 = 单条日志可拖垮请求线程。
 */
export const MAX_SANITIZE_INPUT_CHARS = 4096

/** 封顶值的 env 覆盖键(解析失败回默认值,且只警告一次) */
const ENV_MAX_SANITIZE_CHARS = 'IHUI_LOG_SANITIZE_MAX_CHARS'

/** 只警告一次的闩(不得每次打日志,否则垃圾 env 会把日志面 itself 淹掉) */
let invalidEnvWarned = false

/**
 * 解析当次生效的封顶值:env 为合法正整数时用 env,否则回 MAX_SANITIZE_INPUT_CHARS。
 * 每次调用现读 env(读对象属性 + Number 的成本远低于任何一条正则),
 * 但"垃圾值"警告全程至多一条。
 */
export function resolveSanitizeInputCap(): number {
  const raw = process.env[ENV_MAX_SANITIZE_CHARS]
  if (raw === undefined || raw.trim() === '') return MAX_SANITIZE_INPUT_CHARS
  const parsed = Number(raw)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  if (!invalidEnvWarned) {
    invalidEnvWarned = true
    console.warn(
      `[log-sanitizer] 环境变量 ${ENV_MAX_SANITIZE_CHARS}="${raw}" 不是正整数,` +
        `已回退默认封顶 ${MAX_SANITIZE_INPUT_CHARS}(本警告只输出一次)`,
    )
  }
  return MAX_SANITIZE_INPUT_CHARS
}

/** 被封顶这件事必须在输出里留下可见标记(含原长度与被丢的字符数),禁止静默变短 */
function truncationMarker(originalLength: number, keptLength: number): string {
  return `\n…[TRUNCATED 原长度=${originalLength}字符,已丢弃=${originalLength - keptLength}字符]`
}

// =============================================================================
// 内部脱敏函数
// =============================================================================

/** API Key 脱敏:sk-abc123xyz789 → sk-***xyz789(保留前 3 + 后 6) */
function redactApiKeyMatch(match: string): string {
  if (match.length <= 9) return 'sk-***'
  return `sk-***${match.slice(-6)}`
}

/** Email 脱敏:user@example.com → us**@example.com(保留前 2 + 域名) */
function redactEmailMatch(match: string): string {
  const at = match.indexOf('@')
  if (at < 0) return match
  const local = match.slice(0, at)
  const domain = match.slice(at)
  if (local.length <= 2) return `${local[0] ?? ''}***${domain}`
  return `${local.slice(0, 2)}**${domain}`
}

/** Phone 脱敏:13812345678 → 138****5678(保留前 3 + 后 4) */
function redactPhoneMatch(match: string): string {
  if (match.length < 11) return match
  return `${match.slice(0, 3)}****${match.slice(-4)}`
}

// =============================================================================
// 公开 API:sanitizeText
// =============================================================================

/**
 * 对纯文本做正则脱敏。
 * 按 options 控制各类敏感信息的脱敏开关,keepOriginalForAdmin=true 时直接返回原文。
 *
 * 【顺序不可颠倒:先封顶、后正则】
 * - 先封顶 ⇒ 脱敏正则永远只面对 ≤cap 的输入,ReDoS/无界 CPU 成本被结构性排除;
 *   并且脱敏面必然覆盖"最终会输出"的全部剩余输入。
 * - 若反过来"先正则后封顶":正则跑在整段无界自由文本上,封顶只是事后剪短结果 ——
 *   成本与回溯风险已经发生,封顶就失去了它存在的理由。
 * 截断不是静默行为:被丢弃的字符数与原长度以可见标记追加在输出末尾。
 */
export function sanitizeText(text: string, options?: SanitizeOptions): string {
  const opts = mergeDefaults(options)
  const cap = resolveSanitizeInputCap()
  const truncated = text.length > cap
  const input = truncated ? text.slice(0, cap) : text
  const marker = truncated ? truncationMarker(text.length, input.length) : ''
  if (opts.keepOriginalForAdmin) return input + marker

  let result = input

  if (opts.redactApiKey) {
    // Bearer JWT(整体替换,与 API Key 同属认证凭据)
    result = result.replace(BEARER_REGEX, 'Bearer ***')
    // API Key(保留前 3 + 后 6)
    result = result.replace(API_KEY_REGEX, redactApiKeyMatch)
  }
  if (opts.redactEmail) {
    result = result.replace(EMAIL_REGEX, redactEmailMatch)
  }
  if (opts.redactPhone) {
    result = result.replace(PHONE_REGEX, redactPhoneMatch)
  }
  if (opts.redactIp) {
    result = result.replace(IPV4_REGEX, '[IP REDACTED]')
  }

  return result + marker
}

// =============================================================================
// 公开 API:sanitizeMessages
// =============================================================================

/**
 * 对 OpenAI messages 数组做结构化脱敏。
 *
 * - content(string)→ [REDACTED length=N](redactUserContent=true 时)
 * - content(array,多模态)→ text 部分替换为 [REDACTED length=N]
 * - tool_calls → 保留结构,function.arguments 替换为 [REDACTED](始终脱敏)
 * - 其余字段 → 递归 sanitizeText(正则脱敏 API Key/Email/Phone)
 */
export function sanitizeMessages(messages: unknown[], options?: SanitizeOptions): unknown[] {
  const opts = mergeDefaults(options)
  return messages.map((msg) => sanitizeMessageItem(msg, opts))
}

function sanitizeMessageItem(msg: unknown, opts: Required<SanitizeOptions>): unknown {
  if (msg === null || typeof msg !== 'object') return sanitizeValue(msg, opts)
  const obj = msg as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'content' && typeof v === 'string') {
      result[k] = opts.redactUserContent ? `[REDACTED length=${v.length}]` : sanitizeText(v, opts)
    } else if (k === 'content' && Array.isArray(v)) {
      result[k] = v.map((part) => sanitizeContentPart(part, opts))
    } else {
      result[k] = sanitizeValue(v, opts)
    }
  }
  return result
}

/** 多模态 content 数组元素脱敏:text 部分替换,其余保留结构 */
function sanitizeContentPart(part: unknown, opts: Required<SanitizeOptions>): unknown {
  if (part === null || typeof part !== 'object') return sanitizeValue(part, opts)
  const p = part as Record<string, unknown>
  if (typeof p['text'] === 'string') {
    const text = p['text']
    const redacted = opts.redactUserContent
      ? `[REDACTED length=${text.length}]`
      : sanitizeText(text, opts)
    return { ...p, text: redacted }
  }
  return sanitizeValue(part, opts)
}

// =============================================================================
// 公开 API:sanitizeLogEntry
// =============================================================================

/**
 * 对任意日志条目(对象/数组/字符串)递归脱敏。
 *
 * - keepOriginalForAdmin=true → 直接返回原值(跳过所有脱敏)
 * - string → sanitizeText(正则脱敏)
 * - array → 逐元素递归
 * - object → 逐字段递归,特殊处理:
 *   - messages(数组)→ sanitizeMessages(content 替换为 [REDACTED])
 *   - arguments(string)→ [REDACTED](tool_calls function.arguments,始终脱敏)
 * - null/undefined/number/boolean → 原值返回
 */
export function sanitizeLogEntry(entry: unknown, options?: SanitizeOptions): unknown {
  const opts = mergeDefaults(options)
  if (opts.keepOriginalForAdmin) return entry
  return sanitizeValue(entry, opts)
}

/** 递归脱敏核心:处理任意 unknown 值 */
function sanitizeValue(value: unknown, opts: Required<SanitizeOptions>): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return sanitizeText(value, opts)
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, opts))
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'messages' && Array.isArray(v)) {
        result[k] = sanitizeMessages(v, opts)
      } else if (k === 'arguments' && typeof v === 'string') {
        // tool_calls[].function.arguments(JSON 字符串)→ 始终脱敏
        result[k] = '[REDACTED]'
      } else {
        result[k] = sanitizeValue(v, opts)
      }
    }
    return result
  }
  return value
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
