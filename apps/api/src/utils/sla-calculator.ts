/**
 * Bug-159: SLA 监控计算.
 *
 * 可用性 / 错误预算 / burn-rate:
 *   - 滑动窗口 (1h / 6h / 24h / 3d)
 *   - 多窗口多阈值 (Google SRE multi-window burn-rate)
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug159_sla.py
 */

/** SLA 目标. */
export interface SLATarget {
  name: string
  /** SLO 目标, 如 0.999 = 99.9%, 默认 0.999 */
  slo: number
  /** 窗口长度(秒), 默认 30 天 */
  windowSec: number
}

export const DEFAULT_SLA_TARGET: SLATarget = {
  name: 'default',
  slo: 0.999,
  windowSec: 30 * 24 * 3600,
}

/** 单次调用记录. */
interface CallRecord {
  ok: boolean
  ts: number
}

/** 窗口标识. */
export type WindowKey = '1h' | '6h' | '24h' | '3d' | '30d'

/** 多窗口 burn-rate 告警规则 (Google SRE). */
export interface MultiWindowBurnRule {
  /** 短窗口 */
  short: WindowKey
  /** 长窗口 */
  long: WindowKey
  /** 短窗口 burn-rate 阈值 */
  shortThreshold: number
  /** 长窗口 burn-rate 阈值 */
  longThreshold: number
  /** 严重级别 */
  severity: 'critical' | 'warning'
}

/**
 * Google SRE multi-window burn-rate 经典规则.
 * 当短窗口和长窗口都超过阈值时触发告警, 减少误报.
 * 来源: https://sre.google/workbook/alerting-on-slos/
 */
export const SRE_BURN_RULES: MultiWindowBurnRule[] = [
  { short: '1h', long: '3d', shortThreshold: 14.4, longThreshold: 6, severity: 'critical' },
  { short: '6h', long: '3d', shortThreshold: 6, longThreshold: 3, severity: 'critical' },
  { short: '1h', long: '24h', shortThreshold: 3, longThreshold: 1, severity: 'warning' },
  { short: '6h', long: '24h', shortThreshold: 2, longThreshold: 0.5, severity: 'warning' },
]

const WINDOW_SECONDS: Record<WindowKey, number> = {
  '1h': 3600,
  '6h': 6 * 3600,
  '24h': 24 * 3600,
  '3d': 3 * 24 * 3600,
  '30d': 30 * 24 * 3600,
}

/** burn-rate 触发结果. */
export interface BurnRateAlert {
  rule: MultiWindowBurnRule
  shortBurn: number
  longBurn: number
}

/**
 * SLA 计算器: 多窗口 + 错误预算 + burn-rate.
 */
export class SLACalculator {
  private readonly target: SLATarget
  /** 全量记录 (有上限, 防止内存爆炸) */
  private readonly records: CallRecord[] = []
  private readonly maxRecords = 200_000
  private readonly short1h: CallRecord[] = []
  private readonly mid6h: CallRecord[] = []
  private readonly long24h: CallRecord[] = []
  private readonly long3d: CallRecord[] = []

  constructor(target?: Partial<SLATarget>) {
    this.target = { ...DEFAULT_SLA_TARGET, ...target }
  }

  /** 记录一次调用结果. */
  record(ok: boolean, ts?: number): void {
    const t = ts ?? Date.now() / 1000
    const rec: CallRecord = { ok, ts: t }
    this.records.push(rec)
    if (this.records.length > this.maxRecords) this.records.shift()
    this.trim(this.short1h, t, WINDOW_SECONDS['1h'])
    this.trim(this.mid6h, t, WINDOW_SECONDS['6h'])
    this.trim(this.long24h, t, WINDOW_SECONDS['24h'])
    this.trim(this.long3d, t, WINDOW_SECONDS['3d'])
    this.short1h.push(rec)
    this.mid6h.push(rec)
    this.long24h.push(rec)
    this.long3d.push(rec)
  }

  private trim(q: CallRecord[], now: number, window: number): void {
    const limit = now - window
    while (q.length > 0 && q[0]!.ts < limit) q.shift()
  }

  /** 计算指定窗口的可用率. */
  availability(window: WindowKey = '24h'): number {
    let q: CallRecord[]
    switch (window) {
      case '1h':
        q = this.short1h
        break
      case '6h':
        q = this.mid6h
        break
      case '24h':
        q = this.long24h
        break
      case '3d':
        q = this.long3d
        break
      default:
        q = this.records
    }
    if (q.length === 0) return 1.0
    let err = 0
    for (const r of q) if (!r.ok) err += 1
    return 1 - err / q.length
  }

  /** 错误预算剩余比例 (0~1, 1=未消耗, 0=已耗尽). */
  errorBudgetRemaining(): number {
    const slo = this.target.slo
    const avail = this.availability('24h')
    const budgetTotal = 1 - slo
    if (budgetTotal <= 0) return 0
    const used = Math.max(0, slo - avail)
    return Math.max(0, 1 - used / budgetTotal)
  }

  /** 指定窗口的 burn-rate (错误率 / 错误预算率). */
  burnRate(window: WindowKey = '1h'): number {
    const slo = this.target.slo
    if (slo >= 1) return 0
    const avail = this.availability(window)
    const errRate = 1 - avail
    const budgetRate = 1 - slo
    return budgetRate > 0 ? errRate / budgetRate : 0
  }

  /** 检查 Google SRE 多窗口 burn-rate 规则, 返回触发的规则. */
  checkMultiWindowBurn(rules: MultiWindowBurnRule[] = SRE_BURN_RULES): BurnRateAlert[] {
    const out: BurnRateAlert[] = []
    for (const rule of rules) {
      const shortBurn = this.burnRate(rule.short)
      const longBurn = this.burnRate(rule.long)
      if (shortBurn >= rule.shortThreshold && longBurn >= rule.longThreshold) {
        out.push({ rule, shortBurn, longBurn })
      }
    }
    return out
  }

  /** 统计信息. */
  stats(): Record<string, unknown> {
    let total = 0
    let err = 0
    for (const r of this.records) {
      total += 1
      if (!r.ok) err += 1
    }
    return {
      total,
      errors: err,
      slo: this.target.slo,
      avail1h: this.availability('1h'),
      avail24h: this.availability('24h'),
      burnRate1h: this.burnRate('1h'),
      burnRate24h: this.burnRate('24h'),
      errorBudgetRemaining: this.errorBudgetRemaining(),
    }
  }
}

/** 全局单例. */
export const slaCalculator = new SLACalculator()
