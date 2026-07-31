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
 */
export function sanitizeText(text: string, options?: SanitizeOptions): string {
  const opts = mergeDefaults(options)
  if (opts.keepOriginalForAdmin) return text

  let result = text

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

  return result
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
