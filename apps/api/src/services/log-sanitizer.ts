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
 * 脱敏规则(2026-10-30 收口:凭据族改接共享层唯一规则源,本文件不再自持一套):
 * - API Key:  sk-abc123xyz789 → sk-***xyz789(保留前 3 + 后 6,管理员要能认出"是哪把 key")
 * - Email:    由共享层 redactEmails 出 `c***@域`(与旧自有实现同形态,已并入单源)
 * - Phone:    13812345678 → 138****5678(保留前 3 + 后 4;**平台特有**:中国大陆号段形状,共享层无此规则)
 * - 其余凭据族(PEM 私钥 / sk_ / ihui_ / ghp_ / AIza / AKIA / xox / glpat / 裸 JWT /
 *   Authorization: Basic / 通用 password= k=v / URL query 敏感参数):
 *   由共享层 `SECRET_RULES` + `redactUrl` 整段盖成 `[REDACTED_SECRET]` / `***REDACTED***`
 * - messages content: 替换为 [REDACTED length=N](N 为原长度)
 * - tool function.arguments: 替换为 [REDACTED](保留 tool_calls 结构)
 *
 * 【为什么凭据族必须吃共享层,而不是留一份自有正则】
 * 旧实现只认 `sk-[A-Za-z0-9_-]{20,}` 与 `Bearer <三段 JWT>` 两种形状。现读探针(16 族样本):
 * 数据层单走 sanitizeText 时 13 族原样出明文 —— `ghp_/AIza/AKIA/xoxb-/glpat-`、
 * PEM 私钥块、**不带 Bearer 前缀的裸 JWT**、`Bearer <不透明 token>`(非三段式,旧 BEARER_REGEX
 * 要两个点,匹配不上)、`password=xxx` 赋值、URL query 里的 api_key。而 relay-logs 的
 * 列表面与 metadata 面恰是**只过 sanitizeLogEntry**(详情面才在外面补 redactCredentialText),
 * ⇒ 这些明文随响应出仓。同一条"端内不得再写第二份脱敏规则"的纪律
 * (tests/log-sanitizer-plugin-credential-text.test.ts 头注 G-21③ 逐字)此前只管到日志中间件那半,
 * 数据层这半一直自成一套 —— 两处算同一件事必漂移,漂移已量到。
 *
 * 顺序纪律:本地"部分留尾"sk-/Bearer 两档必须排在共享层整段盖之前 ——
 * 先盖成 `sk-***尾` 后,共享 `sk-` 规则(要求 sk- 后 ≥20 个合法字符)不再命中,
 * 既保住管理员要的尾 6 位,又不会二次堆叠标记。
 *
 * 入口封顶(A9E-1):所有会进入下方正则的字符串先在 sanitizeText 入口无条件
 * 截到 resolveSanitizeInputCap()(默认 4096,env IHUI_LOG_SANITIZE_MAX_CHARS 可覆盖),
 * 被截断时输出末尾追加 [TRUNCATED ...] 可见标记。顺序 = 先封顶、后正则,不可颠倒。
 */

import { SECRET_RULES, redactEmails, redactIps, redactUrl } from '@ihui/shared/utils/redact'

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
// 本地形状规则(只留共享层没有的那两档)
// =============================================================================

/** 平台特有:中国大陆手机号段形状,共享层 redact 无此规则,留本文件 */
const PHONE_REGEX = /1[3-9]\d{9}/g

/**
 * 本地"部分留尾"两档(管理员要靠尾巴认出是哪把 key,不是整段盖掉):
 * sk- 形态与 `Bearer <三段 JWT>`。跑完这两档再交给共享层 SECRET_RULES 盖其余族,
 * 顺序不可颠倒(理由见文件头"顺序纪律")。
 */
const API_KEY_REGEX = /sk-[A-Za-z0-9_-]{20,}/g
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

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
    // 先本地"部分留尾"两档(顺序不可颠倒:盖成 sk-***尾 后共享 sk- 规则不再命中)
    result = result.replace(BEARER_REGEX, 'Bearer ***')
    result = result.replace(API_KEY_REGEX, redactApiKeyMatch)
    // 再吃共享层唯一规则源:其余凭据族(PEM/sk_/ihui_/ghp_/AIza/AKIA/xox/glpat/裸 JWT/
    // Basic/password= 赋值)整段盖掉,URL query 敏感参数只盖值不盖路径
    result = redactUrl(result)
    for (const rule of SECRET_RULES) result = result.replace(rule.pattern, rule.replacement)
  }
  if (opts.redactEmail) {
    result = redactEmails(result)
  }
  if (opts.redactPhone) {
    result = result.replace(PHONE_REGEX, redactPhoneMatch)
  }
  if (opts.redactIp) {
    result = redactIps(result)
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
