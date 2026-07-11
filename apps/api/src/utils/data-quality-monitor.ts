/**
 * 数据质量监控.
 *
 * 完整性 / 准确性 / 一致性 / 及时性 / 唯一性 / 有效性 规则
 * + 异常告警 + 统计面板.
 *
 * 参考: git show 3ee96cf0:server/app/utils/data_quality_monitor.py
 */

/** 数据质量维度. */
export enum DQDimension {
  COMPLETENESS = 'COMPLETENESS',
  ACCURACY = 'ACCURACY',
  CONSISTENCY = 'CONSISTENCY',
  TIMELINESS = 'TIMELINESS',
  UNIQUENESS = 'UNIQUENESS',
  VALIDITY = 'VALIDITY',
}

/** 告警级别. */
export enum AlertLevel {
  OK = 'OK',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/** 比较运算符. */
export type Comparison = 'lt' | 'le' | 'gt' | 'ge' | 'eq'

/** 数据质量规则. */
export interface DQRule {
  ruleId: string
  name: string
  dimension: DQDimension
  dataset: string
  targetField: string
  threshold: number
  comparison: Comparison
  params: Record<string, unknown>
  enabled: boolean
  description: string
  createdAt: number
}

/** 数据样本. */
export interface DQSample {
  sampleId: string
  dataset: string
  data: Record<string, unknown>
  receivedAt: number
  source: string
}

/** 违规记录. */
export interface DQViolation {
  ruleId: string
  dataset: string
  field: string
  dimension: DQDimension
  level: AlertLevel
  actualValue: number
  threshold: number
  sampleId: string
  message: string
  detectedAt: number
}

/** 单规则指标. */
export interface DQMetric {
  ruleId: string
  dataset: string
  dimension: DQDimension
  total: number
  failed: number
  rate: number
  windowStart: number
  windowEnd: number
}

/** 配置. */
export interface DQConfig {
  windowSec: number
  maxSamples: number
  maxViolations: number
  maxAlertsPerRule: number
}

export const DEFAULT_DQ_CONFIG: DQConfig = {
  windowSec: 300,
  maxSamples: 10_000,
  maxViolations: 5000,
  maxAlertsPerRule: 50,
}

/** 比较运算. */
function compare(value: number, threshold: number, comp: Comparison): boolean {
  switch (comp) {
    case 'lt':
      return value < threshold
    case 'le':
      return value <= threshold
    case 'gt':
      return value > threshold
    case 'ge':
      return value >= threshold
    case 'eq':
      return value === threshold
  }
}

/** 创建规则的便捷工厂. */
export function createRule(
  opts: Partial<DQRule> & Pick<DQRule, 'ruleId' | 'dimension' | 'dataset'>,
): DQRule {
  return {
    name: opts.name ?? opts.ruleId,
    targetField: opts.targetField ?? '',
    threshold: opts.threshold ?? 0,
    comparison: opts.comparison ?? 'lt',
    params: opts.params ?? {},
    enabled: opts.enabled ?? true,
    description: opts.description ?? '',
    createdAt: opts.createdAt ?? Date.now() / 1000,
    ...opts,
  } as DQRule
}

/**
 * 数据质量监控器.
 */
export class DataQualityMonitor {
  private readonly config: DQConfig
  private readonly rules = new Map<string, DQRule>()
  private readonly samples: DQSample[] = []
  private readonly violations: DQViolation[] = []
  private readonly alertsByRule = new Map<string, number>()
  /** 唯一性: fingerprint -> ts */
  private readonly seenKeys = new Map<string, number>()
  private sampleCounter = 0

  constructor(config: Partial<DQConfig> = {}) {
    this.config = { ...DEFAULT_DQ_CONFIG, ...config }
  }

  /** 添加规则. */
  addRule(rule: DQRule): void {
    this.rules.set(rule.ruleId, rule)
  }

  /** 移除规则. */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }

  /** 启用/禁用规则. */
  enableRule(ruleId: string, enabled = true): boolean {
    const r = this.rules.get(ruleId)
    if (!r) return false
    r.enabled = enabled
    return true
  }

  /** 获取规则. */
  getRule(ruleId: string): DQRule | undefined {
    return this.rules.get(ruleId)
  }

  /** 列出规则 (可按 dataset 过滤). */
  listRules(dataset?: string): DQRule[] {
    const rs = Array.from(this.rules.values())
    return dataset ? rs.filter((r) => r.dataset === dataset) : rs
  }

  private generateSampleId(): string {
    this.sampleCounter += 1
    return `s-${Math.floor(Date.now())}-${this.sampleCounter}`
  }

  /** 完整性: 字段存在且非空. */
  private checkCompleteness(rule: DQRule, data: Record<string, unknown>): boolean {
    const field = rule.targetField
    if (!(field in data)) return false
    const v = data[field]
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)
      return false
    return true
  }

  /** 准确性: 枚举值 / 正则 / 数值范围. */
  private checkAccuracy(rule: DQRule, data: Record<string, unknown>): boolean {
    const field = rule.targetField
    if (!(field in data)) return false
    const v = data[field]
    if (v === null || v === undefined) return false
    const allowed = rule.params['allowedValues'] as unknown[] | undefined
    if (allowed && !allowed.includes(v)) return false
    const pattern = rule.params['pattern'] as string | undefined
    if (pattern && typeof v === 'string') {
      if (!new RegExp(pattern).test(v)) return false
    }
    const lo = rule.params['minValue'] as number | undefined
    const hi = rule.params['maxValue'] as number | undefined
    if (typeof v === 'number' && !Number.isNaN(v)) {
      if (lo !== undefined && v < lo) return false
      if (hi !== undefined && v > hi) return false
    }
    return true
  }

  /** 一致性: 字段对相等 / 简单公式. */
  private checkConsistency(rule: DQRule, data: Record<string, unknown>): boolean {
    const pairs = (rule.params['fieldPairs'] as Array<{ a: string; b: string }> | undefined) ?? []
    for (const pair of pairs) {
      if (!(pair.a in data) || !(pair.b in data)) return false
      if (data[pair.a] !== data[pair.b]) return false
    }
    return true
  }

  /** 及时性: 时间戳字段在允许延迟内. */
  private checkTimeliness(
    rule: DQRule,
    data: Record<string, unknown>,
    receivedAt: number,
  ): boolean {
    const field = rule.targetField
    if (!(field in data)) return false
    const raw = data[field]
    let ts: number
    if (typeof raw === 'number') {
      ts = raw
    } else if (typeof raw === 'string') {
      const parsed = Date.parse(raw)
      if (Number.isNaN(parsed)) return false
      ts = parsed / 1000
    } else {
      return false
    }
    const maxDelay = Number(rule.params['maxDelaySec'] ?? 0)
    return receivedAt - ts <= maxDelay
  }

  /** 唯一性: 字段值在 dataset 内不重复. */
  private checkUniqueness(rule: DQRule, data: Record<string, unknown>): boolean {
    const field = rule.targetField
    if (!(field in data)) return false
    const v = data[field]
    if (v === null || v === '' || v === undefined) return true
    const fp = `${rule.dataset}:${field}:${String(v)}`
    if (this.seenKeys.has(fp)) return false
    this.seenKeys.set(fp, Date.now() / 1000)
    return true
  }

  /** 有效性: email/phone/uuid/非负/非空. */
  private checkValidity(rule: DQRule, data: Record<string, unknown>): boolean {
    const field = rule.targetField
    if (!(field in data)) return false
    const v = data[field]
    if (v === null || v === undefined) return false
    const validator = rule.params['validator'] as string | undefined
    switch (validator) {
      case 'email':
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))
      case 'phone':
        return /^1[3-9]\d{9}$/.test(String(v))
      case 'uuid':
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          String(v),
        )
      case 'non_negative':
        return typeof v === 'number' && !Number.isNaN(v) && v >= 0
      case 'non_empty':
        if (typeof v === 'string') return v.trim() !== ''
        if (Array.isArray(v) || (typeof v === 'object' && v !== null))
          return Object.keys(v).length > 0
        return true
      default:
        return true
    }
  }

  /** 分派到对应维度的检查. */
  private dispatchCheck(rule: DQRule, data: Record<string, unknown>, receivedAt: number): boolean {
    switch (rule.dimension) {
      case DQDimension.COMPLETENESS:
        return this.checkCompleteness(rule, data)
      case DQDimension.ACCURACY:
        return this.checkAccuracy(rule, data)
      case DQDimension.CONSISTENCY:
        return this.checkConsistency(rule, data)
      case DQDimension.TIMELINESS:
        return this.checkTimeliness(rule, data, receivedAt)
      case DQDimension.UNIQUENESS:
        return this.checkUniqueness(rule, data)
      case DQDimension.VALIDITY:
        return this.checkValidity(rule, data)
      default:
        return true
    }
  }

  /** 喂入一条样本, 触发规则检查. */
  feed(dataset: string, data: Record<string, unknown>, source = ''): DQSample {
    const sample: DQSample = {
      sampleId: this.generateSampleId(),
      dataset,
      data: { ...data },
      source,
      receivedAt: Date.now() / 1000,
    }
    this.samples.push(sample)
    if (this.samples.length > this.config.maxSamples) this.samples.shift()
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.dataset !== dataset) continue
      const passed = this.dispatchCheck(rule, data, sample.receivedAt)
      if (!passed) this.recordViolation(rule, sample.sampleId, data)
    }
    return sample
  }

  private recordViolation(rule: DQRule, sampleId: string, data: Record<string, unknown>): void {
    let actual = 0
    let level = AlertLevel.ERROR
    if (rule.dimension === DQDimension.TIMELINESS) {
      const raw = data[rule.targetField]
      let ts = 0
      if (typeof raw === 'number') ts = raw
      else if (typeof raw === 'string') ts = Date.parse(raw) / 1000
      const maxDelay = Number(rule.params['maxDelaySec'] ?? 0)
      actual = Date.now() / 1000 - ts - maxDelay
      level = actual > 0 ? AlertLevel.CRITICAL : AlertLevel.WARN
    } else if (rule.dimension === DQDimension.UNIQUENESS) {
      actual = 1
    }
    const violation: DQViolation = {
      ruleId: rule.ruleId,
      dataset: rule.dataset,
      field: rule.targetField,
      dimension: rule.dimension,
      level,
      actualValue: actual,
      threshold: rule.threshold,
      sampleId,
      message: `${rule.name} 检测到违规`,
      detectedAt: Date.now() / 1000,
    }
    this.violations.push(violation)
    if (this.violations.length > this.config.maxViolations) this.violations.shift()
    const cnt = this.alertsByRule.get(rule.ruleId) ?? 0
    if (cnt < this.config.maxAlertsPerRule) this.alertsByRule.set(rule.ruleId, cnt + 1)
  }

  /** 获取违规列表. */
  getViolations(opts: { dataset?: string; ruleId?: string; limit?: number } = {}): DQViolation[] {
    const { dataset, ruleId, limit = 100 } = opts
    let vs = this.violations
    if (dataset) vs = vs.filter((v) => v.dataset === dataset)
    if (ruleId) vs = vs.filter((v) => v.ruleId === ruleId)
    return vs.slice(-limit)
  }

  /** 计算窗口内指标. */
  getMetrics(opts: { dataset?: string; windowSec?: number } = {}): DQMetric[] {
    const window = opts.windowSec ?? this.config.windowSec
    const now = Date.now() / 1000
    const start = now - window
    const samples = this.samples.filter(
      (s) => s.receivedAt >= start && (opts.dataset === undefined || s.dataset === opts.dataset),
    )
    const metrics: DQMetric[] = []
    for (const rule of this.rules.values()) {
      if (opts.dataset && rule.dataset !== opts.dataset) continue
      if (!rule.enabled) continue
      let total = 0
      let failed = 0
      for (const s of samples) {
        if (s.dataset !== rule.dataset) continue
        total += 1
        if (!this.dispatchCheck(rule, s.data, s.receivedAt)) failed += 1
      }
      const rate = total > 0 ? (total - failed) / total : 1
      metrics.push({
        ruleId: rule.ruleId,
        dataset: rule.dataset,
        dimension: rule.dimension,
        total,
        failed,
        rate,
        windowStart: start,
        windowEnd: now,
      })
    }
    return metrics
  }

  /** 健康检查. */
  health(dataset?: string): { ok: boolean; badMetrics: DQMetric[]; metricCount: number } {
    const metrics = this.getMetrics({ dataset })
    const bad = metrics.filter((m) => {
      const rule = this.rules.get(m.ruleId)
      if (!rule) return false
      return compare(m.rate, rule.threshold, rule.comparison)
    })
    return { ok: bad.length === 0, badMetrics: bad, metricCount: metrics.length }
  }

  /** 统计. */
  stats(): {
    rulesTotal: number
    rulesEnabled: number
    samplesTotal: number
    violationsTotal: number
    uniqueKeysTracked: number
  } {
    let rulesEnabled = 0
    for (const r of this.rules.values()) if (r.enabled) rulesEnabled += 1
    return {
      rulesTotal: this.rules.size,
      rulesEnabled,
      samplesTotal: this.samples.length,
      violationsTotal: this.violations.length,
      uniqueKeysTracked: this.seenKeys.size,
    }
  }

  /** 清空. */
  clear(): void {
    this.samples.length = 0
    this.violations.length = 0
    this.alertsByRule.clear()
    this.seenKeys.clear()
  }
}

/** 全局单例. */
export const dataQualityMonitor = new DataQualityMonitor()
