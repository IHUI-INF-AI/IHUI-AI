/**
 * 实时风控规则引擎 (Bug-127)。
 *
 * 迁移自旧架构 server/app/utils/risk_rule_engine.py。
 *
 * 设计要点：
 * 1. RiskRule 接口：条件匹配 (match) + 评分 (score) + 动作 (action) + 优先级。
 * 2. 5 条核心规则：异地登录 / 高频退款 / 异常 IP / 批量注册 / 大额提现。
 * 3. evaluateRisk(context) 返回总风险评分与建议动作。
 * 4. 规则按 priority 升序执行 (数字越小越优先)；命中 SCORE 仅累加分数不改变最终动作。
 * 5. 使用类型安全的谓词函数替代字符串表达式求值，避免注入风险。
 */

import { notifyLoginAnomaly } from './login-anomaly-notifier.js'
import { logger } from '../utils/logger.js'

/** 风控动作 */
export type RiskAction = 'ALLOW' | 'DENY' | 'REVIEW' | 'CHALLENGE' | 'SCORE'

/**
 * 风控上下文。所有字段可选，规则按需读取。
 */
export interface RiskContext {
  userId?: string
  ip?: string
  /** 登录地与常用地是否不一致 */
  loginRegionChanged?: boolean
  /** 滑动窗口内退款次数 */
  recentRefundCount?: number
  /** 退款统计窗口 (秒) */
  recentRefundWindowSec?: number
  /** IP 是否命中黑名单 */
  ipBlacklisted?: boolean
  /** 第三方 IP 风险评分 (0-100) */
  ipRiskScore?: number
  /** 同 IP 近期注册数 */
  sameIpRegisterCount?: number
  /** 提现金额 (分) */
  withdrawalAmountFen?: number
  /** 用户历史提现均值 (分) */
  avgWithdrawalFen?: number
  [key: string]: unknown
}

/** 风控规则 */
export interface RiskRule {
  ruleId: string
  name: string
  /** 匹配条件，返回 true 表示命中 */
  match(ctx: RiskContext): boolean
  action: RiskAction
  /** 命中后累加的风险分 */
  score: number
  /** 优先级，数字越小越优先 */
  priority: number
  enabled: boolean
  description: string
}

/** 命中记录 */
export interface RiskHit {
  ruleId: string
  name: string
  action: RiskAction
  score: number
  reason: string
  matchedAt: number
}

/** 评估结果 */
export interface RiskEvaluationResult {
  /** 累加风险评分 */
  totalScore: number
  /** 建议动作 */
  action: RiskAction
  /** 命中的规则列表 */
  hits: RiskHit[]
}

/** 大额提现阈值：5 万元 (分) */
const LARGE_WITHDRAWAL_FEN = 5_000_000
/** 高频退款阈值：窗口内 5 次 */
const HIGH_FREQ_REFUND_COUNT = 5
/** 批量注册阈值：同 IP 10 次 */
const BATCH_REGISTER_COUNT = 10
/** 异常 IP 风险分阈值 */
const ABNORMAL_IP_SCORE = 80
/** 总分达到此值时即便无 DENY/REVIEW 也升级为 REVIEW */
const SCORE_REVIEW_THRESHOLD = 100

/**
 * 5 条核心风控规则。
 */
export const DEFAULT_RULES: RiskRule[] = [
  {
    ruleId: 'R001_REMOTE_LOGIN',
    name: '异地登录检测',
    match: (ctx) => ctx.loginRegionChanged === true,
    action: 'CHALLENGE',
    score: 30,
    priority: 80,
    enabled: true,
    description: '登录地域与常用地域不一致，触发二次验证',
  },
  {
    ruleId: 'R002_HIGH_FREQ_REFUND',
    name: '高频退款检测',
    match: (ctx) => {
      const count = ctx.recentRefundCount ?? 0
      const window = ctx.recentRefundWindowSec ?? 0
      return window > 0 && count >= HIGH_FREQ_REFUND_COUNT
    },
    action: 'REVIEW',
    score: 40,
    priority: 70,
    enabled: true,
    description: '短时间内多次退款，疑似薅羊毛或欺诈',
  },
  {
    ruleId: 'R003_ABNORMAL_IP',
    name: '异常 IP 检测',
    match: (ctx) => ctx.ipBlacklisted === true || (ctx.ipRiskScore ?? 0) >= ABNORMAL_IP_SCORE,
    action: 'DENY',
    score: 60,
    priority: 90,
    enabled: true,
    description: 'IP 命中黑名单或第三方风险评分过高',
  },
  {
    ruleId: 'R004_BATCH_REGISTER',
    name: '批量注册检测',
    match: (ctx) => (ctx.sameIpRegisterCount ?? 0) >= BATCH_REGISTER_COUNT,
    action: 'REVIEW',
    score: 50,
    priority: 75,
    enabled: true,
    description: '同一 IP 短时间内大量注册，疑似羊毛党',
  },
  {
    ruleId: 'R005_LARGE_WITHDRAWAL',
    name: '大额提现检测',
    match: (ctx) => {
      const amt = ctx.withdrawalAmountFen ?? 0
      const avg = ctx.avgWithdrawalFen ?? 0
      // 超过 5 万元，或超过历史均值 5 倍
      return amt >= LARGE_WITHDRAWAL_FEN || (avg > 0 && amt >= avg * 5)
    },
    action: 'REVIEW',
    score: 45,
    priority: 72,
    enabled: true,
    description: '大额提现或显著超出历史均值，需人工复核',
  },
]

/**
 * 风控规则引擎。
 */
export class RiskRuleEngine {
  private readonly rules = new Map<string, RiskRule>()
  private hits: RiskHit[] = []
  private readonly shortCircuit: boolean
  private readonly maxHits: number

  constructor(
    options: {
      rules?: RiskRule[]
      shortCircuit?: boolean
      maxHits?: number
    } = {},
  ) {
    const rules = options.rules ?? DEFAULT_RULES
    for (const r of rules) this.rules.set(r.ruleId, { ...r })
    this.shortCircuit = options.shortCircuit ?? false
    this.maxHits = options.maxHits ?? 10000
  }

  /** 新增规则。 */
  addRule(rule: RiskRule): void {
    this.rules.set(rule.ruleId, { ...rule })
  }

  /** 移除规则。 */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }

  /** 启用 / 禁用规则。 */
  enableRule(ruleId: string, enabled = true): boolean {
    const r = this.rules.get(ruleId)
    if (!r) return false
    r.enabled = enabled
    return true
  }

  /** 获取规则。 */
  getRule(ruleId: string): RiskRule | undefined {
    const r = this.rules.get(ruleId)
    return r ? { ...r } : undefined
  }

  /** 列出全部规则 (按优先级升序)。 */
  listRules(): RiskRule[] {
    return [...this.rules.values()].sort((a, b) => a.priority - b.priority)
  }

  /**
   * 评估单个 context 的风险，返回总评分与建议动作。
   */
  evaluateRisk(ctx: RiskContext): RiskEvaluationResult {
    const sorted = this.listRules()
    const hits: RiskHit[] = []
    let totalScore = 0
    let finalAction: RiskAction = 'ALLOW'

    for (const rule of sorted) {
      if (!rule.enabled) continue
      let matched = false
      try {
        matched = rule.match(ctx)
      } catch {
        // 规则异常视为未命中，不影响其他规则
        matched = false
      }
      if (!matched) continue

      const hit: RiskHit = {
        ruleId: rule.ruleId,
        name: rule.name,
        action: rule.action,
        score: rule.score,
        reason: rule.description,
        matchedAt: Date.now(),
      }
      hits.push(hit)
      totalScore += rule.score

      // SCORE 仅累加分数，不改变最终动作
      if (rule.action !== 'SCORE') {
        finalAction = rule.action
        if (this.shortCircuit) break
      }
    }

    // 累加写入历史命中
    this.recordHits(hits)

    // 总分过高但未触发明确动作时，升级为 REVIEW
    if (totalScore >= SCORE_REVIEW_THRESHOLD && finalAction === 'ALLOW') {
      finalAction = 'REVIEW'
    }

    return { totalScore, action: finalAction, hits }
  }

  /** 按 subject 查询历史命中。 */
  hitsBySubject(userId: string, limit = 100): RiskHit[] {
    return this.hits.filter((h) => h.ruleId.includes(userId)).slice(-limit)
  }

  /** 按规则 ID 查询历史命中。 */
  hitsByRule(ruleId: string, limit = 100): RiskHit[] {
    return this.hits.filter((h) => h.ruleId === ruleId).slice(-limit)
  }

  /** 清空历史命中，返回清除数。 */
  clearHits(): number {
    const n = this.hits.length
    this.hits = []
    return n
  }

  /** 引擎统计。 */
  getStats(): { rulesTotal: number; rulesEnabled: number; hitsTotal: number } {
    return {
      rulesTotal: this.rules.size,
      rulesEnabled: [...this.rules.values()].filter((r) => r.enabled).length,
      hitsTotal: this.hits.length,
    }
  }

  private recordHits(newHits: RiskHit[]): void {
    if (newHits.length === 0) return
    this.hits.push(...newHits)
    if (this.hits.length > this.maxHits) {
      this.hits = this.hits.slice(-this.maxHits)
    }
  }
}

// ---------------------------------------------------------------------------
// 默认单例 + 便捷函数
// ---------------------------------------------------------------------------

let defaultEngine: RiskRuleEngine | null = null

/** 获取默认引擎单例 (使用 5 条核心规则)。 */
export function getDefaultRiskEngine(): RiskRuleEngine {
  if (!defaultEngine) defaultEngine = new RiskRuleEngine()
  return defaultEngine
}

/**
 * 使用默认引擎评估风险。
 *
 * @example
 * const result = evaluateRisk({ loginRegionChanged: true, userId: 'u1' });
 * if (result.action === 'DENY') { ... }
 */
export function evaluateRisk(ctx: RiskContext): RiskEvaluationResult {
  return getDefaultRiskEngine().evaluateRisk(ctx)
}

// ---------------------------------------------------------------------------
// 登录异常通知集成 (login-anomaly-notifier)
// ---------------------------------------------------------------------------

/** 登录相关规则 ID(命中后触发登录异常通知)。 */
const LOGIN_ANOMALY_RULE_IDS = new Set(['R001_REMOTE_LOGIN', 'R003_ABNORMAL_IP'])

/**
 * 评估登录风险并触发异常通知。
 *
 * 在 evaluateRisk 基础上,若检测到登录相关异常(异地登录 / 异常 IP)且动作非 ALLOW,
 * 异步调用 notifyLoginAnomaly 发送站内信 / 邮件 / Webhook 通知。
 *
 * 降级:notifier 内部已 try-catch 各通道 + 6h Redis 去重;调用失败仅 logger.warn,
 * 不影响返回的 risk result,登录主流程按原 action 继续处理。
 */
export function evaluateLoginRisk(ctx: RiskContext): RiskEvaluationResult {
  const result = evaluateRisk(ctx)

  // 无 userId 或无命中 → 跳过通知
  const userId = ctx.userId
  if (!userId || result.hits.length === 0) return result

  // 查找首条登录相关命中(异地登录 / 异常 IP)
  const loginHit = result.hits.find((h) => LOGIN_ANOMALY_RULE_IDS.has(h.ruleId))
  if (!loginHit) return result

  // 仅在非 ALLOW(中/高风险)时通知;R001=CHALLENGE / R003=DENY 均满足
  if (result.action === 'ALLOW') return result

  // 异步触发通知(不阻塞主流程);notifier 自带 6h 去重 + 各通道独立 try-catch,
  // 此处 .catch 仅作 call-site 兜底(notifier 本身不会 reject)
  void notifyLoginAnomaly({
    userId,
    eventType: 'remote_login',
    ip: ctx.ip,
    userAgent: pickString(ctx, 'userAgent'),
    location: pickString(ctx, 'location'),
    deviceFingerprint: pickString(ctx, 'deviceFingerprint'),
    metadata: {
      ruleId: loginHit.ruleId,
      ruleName: loginHit.name,
      reason: loginHit.reason,
      totalScore: result.totalScore,
      action: result.action,
      riskLevel: riskLevelOf(result),
      timestamp: new Date().toISOString(),
    },
  }).catch((err) => {
    logger.warn('risk-engine: login anomaly notify failed', {
      err,
      userId,
      ruleId: loginHit.ruleId,
    })
  })

  return result
}

/** 从 RiskContext 索引签名中安全读取 string 字段。 */
function pickString(ctx: RiskContext, key: string): string | undefined {
  const v = ctx[key]
  return typeof v === 'string' ? v : undefined
}

/** 将评估结果映射为风险等级标签(供通知 metadata 使用)。 */
function riskLevelOf(result: RiskEvaluationResult): 'low' | 'medium' | 'high' {
  if (result.action === 'DENY') return 'high'
  if (result.action === 'REVIEW' || result.action === 'CHALLENGE') return 'medium'
  if (result.totalScore >= SCORE_REVIEW_THRESHOLD) return 'medium'
  return 'low'
}
