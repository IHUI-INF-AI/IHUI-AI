import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyRequest {
    /** 数据主体访问自身数据时（如 GDPR 导出）设置为 true，跳过响应脱敏 */
    skipResponseSanitization?: boolean
  }
}

/**
 * 敏感字段脱敏规则（响应脱敏与日志脱敏共用）。
 * - 字段名匹配大小写不敏感，子串包含即命中（如 passwordHash / refreshToken 均命中）。
 * - 默认覆盖：password / phone / idCard / bankCard / email / token / secret / apiKey
 */
export const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'phone',
  'idcard',
  'bankcard',
  'email',
  'token',
  'secret',
  'apikey', // 2026-07-24 安全加固:补 apiKey/api_key 脱敏,防 LLM provider key 泄露
] as const

const MASK = '***'

export interface SanitizerOptions {
  /** 额外的敏感字段名（与默认列表合并，全部小写）。 */
  extraKeys?: readonly string[]
  /** Bug-125 扩展: 字段级规则, 命中时优先使用规则策略(覆盖默认 maskValue). */
  rules?: FieldMaskRule[]
  /** Bug-125 扩展: HMAC/AES 密钥, 未提供时随机生成(进程级). */
  secretKey?: Buffer
}

/** 构建敏感字段名集合（小写）。 */
export function buildSensitiveKeySet(extra?: readonly string[]): Set<string> {
  return new Set([...DEFAULT_SENSITIVE_KEYS, ...(extra ?? [])].map((k) => k.toLowerCase()))
}

/** 判断字段名是否命中敏感规则（包含匹配，大小写不敏感）。 */
export function isSensitiveKey(key: string, keys: Set<string>): boolean {
  const lower = key.toLowerCase()
  for (const k of keys) {
    if (lower.includes(k)) return true
  }
  return false
}

/**
 * 按字段类型做差异化脱敏：
 * - phone：保留前 3 后 4
 * - email：保留首字符 + 域名
 * - 其余敏感字段：统一替换为 ***
 *
 * 注意: 此函数为旧版简单脱敏, 保留向后兼容 (log-sanitizer 依赖).
 * 新增字段请使用 MaskStrategy + DataMaskingPipeline.
 */
export function maskValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return MASK
  const lower = key.toLowerCase()
  if (lower.includes('phone')) {
    return value.length <= 7 ? MASK : `${value.slice(0, 3)}****${value.slice(-4)}`
  }
  if (lower.includes('email')) {
    const at = value.indexOf('@')
    if (at < 1) return MASK
    return `${value[0]}***${value.slice(at)}`
  }
  if (lower.includes('idcard')) {
    return maskIdCard(value)
  }
  return MASK
}

// ============================================================
// Bug-125 扩展: 多策略脱敏 (HASH / HMAC / AES / ID_CARD 等)
// 参考: git show 3ee96cf0:server/app/utils/data_masking_pipeline.py
// ============================================================

/** 脱敏策略. */
export enum MaskStrategy {
  /** 全掩码: [REDACTED] */
  FULL = 'full',
  /** 部分掩码: 保留前 N 后 M */
  PARTIAL = 'partial',
  /** SHA256 哈希(截断 16 位) */
  HASH = 'hash',
  /** HMAC-SHA256(截断 16 位) */
  HMAC = 'hmac',
  /** AES 加密(简化 XOR+base64, 非生产级) */
  AES = 'aes',
  /** 邮箱: a***@e.com */
  EMAIL = 'email',
  /** 手机: 138****8000 */
  PHONE = 'phone',
  /** 身份证: 110101********1234 */
  ID_CARD = 'id_card',
  /** 仅保留前 N */
  KEEP_PREFIX = 'keep_prefix',
  /** 自定义函数 */
  CUSTOM = 'custom',
}

/** 字段脱敏规则. */
export interface FieldMaskRule {
  /** 字段名(大小写不敏感, 子串匹配) */
  field: string
  /** 脱敏策略 */
  strategy: MaskStrategy
  /** PARTIAL/KEEP_PREFIX 保留前缀长度 */
  keepPrefix: number
  /** PARTIAL 保留后缀长度 */
  keepSuffix: number
  /** CUSTOM 策略的自定义函数 */
  customFn?: (value: unknown) => unknown
  /** 是否启用 */
  enabled: boolean
}

/** 脱敏审计记录. */
export interface MaskAudit {
  ts: number
  field: string
  strategy: string
  /** 原值 hash(前 12 位), 便于审计追踪 */
  originalHash: string
  /** 脱敏后值(截断 50 字符) */
  replaced: string
}

/** 创建规则的便捷工厂. */
export function createMaskRule(
  field: string,
  strategy: MaskStrategy = MaskStrategy.FULL,
  opts: Partial<Omit<FieldMaskRule, 'field' | 'strategy'>> = {},
): FieldMaskRule {
  return {
    field,
    strategy,
    keepPrefix: opts.keepPrefix ?? 0,
    keepSuffix: opts.keepSuffix ?? 0,
    customFn: opts.customFn,
    enabled: opts.enabled ?? true,
  }
}

/** 部分掩码: 保留前 prefix + 后 suffix. */
function maskPartial(s: string, prefix: number, suffix: number): string {
  if (s.length <= prefix + suffix) return MASK
  if (suffix > 0) {
    return s.slice(0, prefix) + '*'.repeat(s.length - prefix - suffix) + s.slice(-suffix)
  }
  return s.slice(0, prefix) + '*'.repeat(s.length - prefix)
}

/** 邮箱掩码: a***@e.com. */
function maskEmail(s: string): string {
  const at = s.indexOf('@')
  if (at < 1) return maskPartial(s, 1, 0)
  return `${s[0]}***${s.slice(at)}`
}

/** 手机掩码: 138****8000. */
function maskPhone(s: string): string {
  const digits = s.replace(/\D/g, '')
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`
  return MASK
}

/** 身份证掩码: 110101********1234. */
function maskIdCard(s: string): string {
  if (s.length >= 8) return s.slice(0, 6) + '*'.repeat(s.length - 10) + s.slice(-4)
  return MASK
}

/** AES 风格加密(简化: XOR + base64, 非生产级 AES). */
function aesLikeEncrypt(s: string, key: Buffer): string {
  const raw = Buffer.from(s, 'utf8')
  const xored = Buffer.allocUnsafe(raw.length)
  for (let i = 0; i < raw.length; i++) {
    xored[i] = raw[i]! ^ key[i % key.length]!
  }
  return `AES:${xored.toString('base64')}`
}

/**
 * 按规则应用脱敏策略.
 * @param rule 字段规则
 * @param value 原值
 * @param secretKey HMAC/AES 用的密钥
 */
export function applyMaskStrategy(rule: FieldMaskRule, value: unknown, secretKey: Buffer): string {
  const s = String(value)
  switch (rule.strategy) {
    case MaskStrategy.FULL:
      return '[REDACTED]'
    case MaskStrategy.PARTIAL:
      return maskPartial(s, rule.keepPrefix, rule.keepSuffix)
    case MaskStrategy.KEEP_PREFIX:
      return s.length > rule.keepPrefix ? `${s.slice(0, rule.keepPrefix)}***` : '***'
    case MaskStrategy.HASH:
      return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
    case MaskStrategy.HMAC:
      return createHmac('sha256', secretKey).update(s, 'utf8').digest('hex').slice(0, 16)
    case MaskStrategy.AES:
      return aesLikeEncrypt(s, secretKey)
    case MaskStrategy.EMAIL:
      return maskEmail(s)
    case MaskStrategy.PHONE:
      return maskPhone(s)
    case MaskStrategy.ID_CARD:
      return maskIdCard(s)
    case MaskStrategy.CUSTOM: {
      if (rule.customFn) {
        try {
          return String(rule.customFn(value))
        } catch {
          return '[ERROR]'
        }
      }
      return '[REDACTED]'
    }
    default:
      return '[REDACTED]'
  }
}

/**
 * 递归扫描对象/数组，对命中敏感字段名的值做脱敏。返回新对象（不改原对象）。
 *
 * 向后兼容: 第三个参数可选, 传入 rules + secretKey 时启用 Bug-125 多策略.
 */
export function sanitizeData(
  data: unknown,
  keys: Set<string>,
  opts?: { rules?: FieldMaskRule[]; secretKey?: Buffer },
): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, keys, opts))
  }
  if (data && typeof data === 'object') {
    const rules = opts?.rules
    const secretKey = opts?.secretKey
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      // Bug-125: 优先匹配字段规则
      const rule = rules ? findRule(k, rules) : undefined
      if (rule && rule.enabled) {
        out[k] = applyMaskStrategy(rule, v, secretKey ?? DEFAULT_SECRET_KEY)
      } else if (isSensitiveKey(k, keys)) {
        out[k] = maskValue(k, v)
      } else {
        out[k] = sanitizeData(v, keys, opts)
      }
    }
    return out
  }
  return data
}

/** 按字段名查找规则(大小写不敏感, 子串匹配). */
function findRule(field: string, rules: FieldMaskRule[]): FieldMaskRule | undefined {
  const lower = field.toLowerCase()
  return rules.find((r) => r.enabled && lower.includes(r.field.toLowerCase()))
}

/** 默认密钥(进程级随机, 未显式配置时使用). */
const DEFAULT_SECRET_KEY = randomBytes(32)

/**
 * 数据脱敏管道 (Bug-125).
 *
 * 在 sanitizeData 基础上提供: 规则管理 + 审计记录 + 统计.
 * 可独立使用, 也可由 responseSanitizerPlugin 内部调用.
 */
export class DataMaskingPipeline {
  private readonly secretKey: Buffer
  private readonly rules = new Map<string, FieldMaskRule>()
  private readonly audits: MaskAudit[] = []
  private readonly maxAudits = 2000
  private totalMasked = 0
  private totalSkipped = 0
  private totalFiltered = 0
  private readonly rowFilters: Array<(row: Record<string, unknown>) => boolean> = []

  constructor(opts: { secretKey?: Buffer; defaultStrategy?: MaskStrategy } = {}) {
    this.secretKey = opts.secretKey ?? randomBytes(32)
    void opts.defaultStrategy
  }

  /** 添加字段规则. */
  addRule(rule: FieldMaskRule): void {
    this.rules.set(rule.field, rule)
  }

  /** 移除字段规则. */
  removeRule(field: string): boolean {
    return this.rules.delete(field)
  }

  /** 添加行级过滤器 (返回 true 的行会被整体移除). */
  addRowFilter(fn: (row: Record<string, unknown>) => boolean): void {
    this.rowFilters.push(fn)
  }

  /** 递归脱敏单条数据. */
  mask(data: unknown, fieldName?: string): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => this.mask(item))
    }
    if (data && typeof data === 'object') {
      return this.maskDict(data as Record<string, unknown>)
    }
    if (fieldName !== undefined) {
      return this.maskValue(fieldName, data)
    }
    return data
  }

  /** 脱敏行列表 (应用行级过滤). */
  maskRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    for (const row of rows) {
      if (this.rowFilters.some((f) => f(row))) {
        this.totalFiltered += 1
        continue
      }
      out.push(this.maskDict(row))
    }
    return out
  }

  private maskDict(d: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(d)) {
      out[k] = this.mask(v, k)
    }
    return out
  }

  private maskValue(field: string, value: unknown): unknown {
    if (value === null || value === undefined) return value
    const rule = findRule(field, Array.from(this.rules.values()))
    if (!rule || !rule.enabled) {
      this.totalSkipped += 1
      return value
    }
    const res = applyMaskStrategy(rule, value, this.secretKey)
    this.totalMasked += 1
    this.audits.push({
      ts: Date.now() / 1000,
      field: rule.field,
      strategy: rule.strategy,
      originalHash: createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 12),
      replaced: res.slice(0, 50),
    })
    if (this.audits.length > this.maxAudits) this.audits.shift()
    return res
  }

  /** 查询审计记录. */
  listAudits(limit = 100): MaskAudit[] {
    return this.audits.slice(-limit)
  }

  /** 统计. */
  stats(): {
    totalMasked: number
    totalSkipped: number
    totalFiltered: number
    ruleCount: number
    rowFilterCount: number
  } {
    return {
      totalMasked: this.totalMasked,
      totalSkipped: this.totalSkipped,
      totalFiltered: this.totalFiltered,
      ruleCount: this.rules.size,
      rowFilterCount: this.rowFilters.length,
    }
  }
}

/** 全局单例. */
export const dataMasking = new DataMaskingPipeline()

/**
 * 响应脱敏管线：onSend 钩子，对 JSON 响应体递归脱敏敏感字段。
 * - 仅处理 application/json 且 2xx 响应
 * - SSE / 流式响应跳过（避免缓冲整流）
 * - 脱敏失败 fail-open（不影响正常响应）
 * - 数据主体访问自身数据时（如 GDPR 导出）可设置 request.skipResponseSanitization
 *   跳过脱敏，以保证数据主体合法访问其完整 PII
 */
const responseSanitizerPlugin: FastifyPluginAsync<SanitizerOptions> = async (
  server: FastifyInstance,
  opts: SanitizerOptions,
) => {
  const keys = buildSensitiveKeySet(opts.extraKeys)
  // Bug-125 扩展: 支持字段级规则 + 密钥
  const rules = opts.rules
  const secretKey = opts.secretKey ?? DEFAULT_SECRET_KEY
  const maskOpts = rules ? { rules, secretKey } : undefined

  server.addHook(
    'onSend',
    async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
      // 数据主体访问自身数据时跳过脱敏（GDPR 导出等场景）
      if (request.skipResponseSanitization) return payload
      const contentType = reply.getHeader('content-type')
      if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
        return payload
      }
      // SSE 不处理
      if (contentType.includes('text/event-stream')) return payload
      // 仅处理 2xx
      if (reply.statusCode < 200 || reply.statusCode >= 300) return payload
      if (typeof payload !== 'string' || payload.length === 0) return payload

      try {
        const data = JSON.parse(payload) as unknown
        const masked = sanitizeData(data, keys, maskOpts)
        // 未改动则返回原 payload（避免无谓的序列化）
        if (masked === data) return payload
        const body = JSON.stringify(masked)
        reply.header('content-length', Buffer.byteLength(body))
        return body
      } catch {
        // 脱敏失败不影响正常响应（fail-open）
        return payload
      }
    },
  )
}

export default fp(responseSanitizerPlugin, {
  name: 'response-sanitizer-plugin',
  fastify: '5.x',
})
