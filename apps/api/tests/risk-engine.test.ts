import { describe, it, expect } from 'vitest'
import {
  RiskRuleEngine,
  DEFAULT_RULES,
  getDefaultRiskEngine,
  evaluateRisk,
  type RiskRule,
} from '../src/services/risk-engine-service'

describe('RiskRuleEngine 默认规则', () => {
  it('加载 5 条核心规则', () => {
    const engine = new RiskRuleEngine()
    const rules = engine.listRules()
    expect(rules).toHaveLength(5)
    expect(rules.map((r) => r.ruleId).sort()).toEqual([
      'R001_REMOTE_LOGIN',
      'R002_HIGH_FREQ_REFUND',
      'R003_ABNORMAL_IP',
      'R004_BATCH_REGISTER',
      'R005_LARGE_WITHDRAWAL',
    ])
  })

  it('规则按 priority 升序排列', () => {
    const engine = new RiskRuleEngine()
    const rules = engine.listRules()
    for (let i = 1; i < rules.length; i++) {
      expect(rules[i].priority).toBeGreaterThanOrEqual(rules[i - 1].priority)
    }
  })

  it('DEFAULT_RULES 全部启用', () => {
    expect(DEFAULT_RULES.every((r) => r.enabled)).toBe(true)
  })
})

describe('RiskRuleEngine evaluateRisk 规则匹配', () => {
  it('无风险上下文 → ALLOW', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({ userId: 'u1' })
    expect(result.action).toBe('ALLOW')
    expect(result.totalScore).toBe(0)
    expect(result.hits).toHaveLength(0)
  })

  it('异地登录 → CHALLENGE', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      userId: 'u1',
      loginRegionChanged: true,
    })
    expect(result.action).toBe('CHALLENGE')
    expect(result.totalScore).toBe(30)
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].ruleId).toBe('R001_REMOTE_LOGIN')
  })

  it('高频退款 → REVIEW', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      userId: 'u1',
      recentRefundCount: 5,
      recentRefundWindowSec: 3600,
    })
    expect(result.action).toBe('REVIEW')
    expect(result.totalScore).toBe(40)
    expect(result.hits[0].ruleId).toBe('R002_HIGH_FREQ_REFUND')
  })

  it('高频退款窗口为 0 时不触发', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      recentRefundCount: 10,
      recentRefundWindowSec: 0,
    })
    expect(result.action).toBe('ALLOW')
  })

  it('异常 IP (黑名单) → DENY', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      userId: 'u1',
      ipBlacklisted: true,
    })
    expect(result.action).toBe('DENY')
    expect(result.totalScore).toBe(60)
    expect(result.hits[0].ruleId).toBe('R003_ABNORMAL_IP')
  })

  it('异常 IP (高风险评分) → DENY', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      ipRiskScore: 85,
    })
    expect(result.action).toBe('DENY')
  })

  it('异常 IP 风险评分低于阈值不触发', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({ ipRiskScore: 79 })
    expect(result.action).toBe('ALLOW')
  })

  it('批量注册 → REVIEW', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      sameIpRegisterCount: 10,
    })
    expect(result.action).toBe('REVIEW')
    expect(result.hits[0].ruleId).toBe('R004_BATCH_REGISTER')
  })

  it('大额提现 (超 5 万元) → REVIEW', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      withdrawalAmountFen: 5_000_000, // 5 万元
    })
    expect(result.action).toBe('REVIEW')
    expect(result.hits[0].ruleId).toBe('R005_LARGE_WITHDRAWAL')
  })

  it('大额提现 (超历史均值 5 倍) → REVIEW', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      withdrawalAmountFen: 500_000, // 5000 元
      avgWithdrawalFen: 100_000, // 历史均值 1000 元，5 倍 = 5000 元
    })
    expect(result.action).toBe('REVIEW')
  })

  it('多规则同时命中累加分数', () => {
    const engine = new RiskRuleEngine()
    const result = engine.evaluateRisk({
      userId: 'u1',
      loginRegionChanged: true, // 30 分 CHALLENGE
      ipBlacklisted: true, // 60 分 DENY
    })
    expect(result.hits).toHaveLength(2)
    expect(result.totalScore).toBe(90)
    // DENY 优先级最高 (priority 90 但 action DENY 覆盖 CHALLENGE)
    expect(result.action).toBe('DENY')
  })
})

describe('RiskRuleEngine SCORE 规则', () => {
  it('SCORE 规则仅累加分数不改变最终动作', () => {
    const engine = new RiskRuleEngine({
      rules: [
        {
          ruleId: 'S001',
          name: '评分规则',
          match: () => true,
          action: 'SCORE',
          score: 50,
          priority: 10,
          enabled: true,
          description: '仅累加分数',
        },
      ],
    })
    const result = engine.evaluateRisk({ userId: 'u1' })
    expect(result.totalScore).toBe(50)
    expect(result.action).toBe('ALLOW') // SCORE 不改变动作
    expect(result.hits).toHaveLength(1)
  })

  it('总分超阈值 (100) 升级为 REVIEW', () => {
    const engine = new RiskRuleEngine({
      rules: [
        {
          ruleId: 'S001',
          name: '评分规则 A',
          match: () => true,
          action: 'SCORE',
          score: 60,
          priority: 10,
          enabled: true,
          description: '评分 A',
        },
        {
          ruleId: 'S002',
          name: '评分规则 B',
          match: () => true,
          action: 'SCORE',
          score: 50,
          priority: 20,
          enabled: true,
          description: '评分 B',
        },
      ],
    })
    const result = engine.evaluateRisk({})
    expect(result.totalScore).toBe(110)
    expect(result.action).toBe('REVIEW') // 总分 ≥ 100 升级
  })
})

describe('RiskRuleEngine 规则管理', () => {
  it('addRule 新增规则', () => {
    const engine = new RiskRuleEngine({ rules: [] })
    expect(engine.listRules()).toHaveLength(0)

    const rule: RiskRule = {
      ruleId: 'CUSTOM_001',
      name: '自定义规则',
      match: () => true,
      action: 'DENY',
      score: 100,
      priority: 1,
      enabled: true,
      description: '测试',
    }
    engine.addRule(rule)
    expect(engine.listRules()).toHaveLength(1)
  })

  it('removeRule 移除规则', () => {
    const engine = new RiskRuleEngine()
    expect(engine.removeRule('R001_REMOTE_LOGIN')).toBe(true)
    expect(engine.getRule('R001_REMOTE_LOGIN')).toBeUndefined()
    expect(engine.removeRule('NOT_EXIST')).toBe(false)
  })

  it('enableRule / disableRule', () => {
    const engine = new RiskRuleEngine()
    expect(engine.enableRule('R003_ABNORMAL_IP', false)).toBe(true)
    const rule = engine.getRule('R003_ABNORMAL_IP')
    expect(rule?.enabled).toBe(false)

    // 禁用后评估不再触发
    const result = engine.evaluateRisk({ ipBlacklisted: true })
    expect(result.hits).toHaveLength(0)
  })

  it('getRule 返回副本 (不泄漏内部状态)', () => {
    const engine = new RiskRuleEngine()
    const rule = engine.getRule('R001_REMOTE_LOGIN')
    rule!.score = 999
    const ruleAgain = engine.getRule('R001_REMOTE_LOGIN')
    expect(ruleAgain!.score).toBe(30) // 原值未变
  })
})

describe('RiskRuleEngine 异常处理', () => {
  it('规则 match 抛错视为未命中', () => {
    const engine = new RiskRuleEngine({
      rules: [
        {
          ruleId: 'ERR_001',
          name: '会抛错的规则',
          match: () => {
            throw new Error('rule error')
          },
          action: 'DENY',
          score: 100,
          priority: 1,
          enabled: true,
          description: '测试异常',
        },
        {
          ruleId: 'OK_001',
          name: '正常规则',
          match: () => true,
          action: 'ALLOW',
          score: 0,
          priority: 2,
          enabled: true,
          description: '正常',
        },
      ],
    })
    const result = engine.evaluateRisk({})
    // 异常规则不命中，正常规则命中
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].ruleId).toBe('OK_001')
  })
})

describe('RiskRuleEngine 短路模式', () => {
  it('shortCircuit 命中首个非 SCORE 动作后停止', () => {
    const engine = new RiskRuleEngine({
      shortCircuit: true,
      rules: [
        {
          ruleId: 'FIRST',
          name: '第一条',
          match: () => true,
          action: 'REVIEW',
          score: 40,
          priority: 1,
          enabled: true,
          description: '先命中',
        },
        {
          ruleId: 'SECOND',
          name: '第二条',
          match: () => true,
          action: 'DENY',
          score: 60,
          priority: 2,
          enabled: true,
          description: '不应执行',
        },
      ],
    })
    const result = engine.evaluateRisk({})
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].ruleId).toBe('FIRST')
    expect(result.action).toBe('REVIEW')
  })
})

describe('RiskRuleEngine getStats', () => {
  it('统计规则数与命中数', () => {
    const engine = new RiskRuleEngine()
    engine.evaluateRisk({ ipBlacklisted: true })
    engine.evaluateRisk({ loginRegionChanged: true })

    const stats = engine.getStats()
    expect(stats.rulesTotal).toBe(5)
    expect(stats.rulesEnabled).toBe(5)
    expect(stats.hitsTotal).toBe(2)
  })
})

describe('默认引擎单例', () => {
  it('getDefaultRiskEngine 返回同一实例', () => {
    const a = getDefaultRiskEngine()
    const b = getDefaultRiskEngine()
    expect(a).toBe(b)
  })

  it('evaluateRisk 便捷函数使用默认引擎', () => {
    const result = evaluateRisk({ ipBlacklisted: true })
    expect(result.action).toBe('DENY')
  })
})
