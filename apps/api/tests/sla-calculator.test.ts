import { describe, it, expect } from 'vitest'
import { SLACalculator, DEFAULT_SLA_TARGET, SRE_BURN_RULES } from '../src/utils/sla-calculator.js'

describe('sla-calculator — SLA 监控计算', () => {
  describe('DEFAULT_SLA_TARGET', () => {
    it('slo=0.999', () => expect(DEFAULT_SLA_TARGET.slo).toBe(0.999))
    it('windowSec=30 天', () => {
      expect(DEFAULT_SLA_TARGET.windowSec).toBe(30 * 24 * 3600)
    })
  })

  describe('SRE_BURN_RULES', () => {
    it('包含 4 条经典规则', () => {
      expect(SRE_BURN_RULES).toHaveLength(4)
    })
    it('包含 critical 与 warning 严重级别', () => {
      expect(SRE_BURN_RULES.some((r) => r.severity === 'critical')).toBe(true)
      expect(SRE_BURN_RULES.some((r) => r.severity === 'warning')).toBe(true)
    })
  })

  describe('record + availability', () => {
    it('无记录时可用率=1', () => {
      const s = new SLACalculator()
      expect(s.availability('1h')).toBe(1)
    })
    it('全部成功可用率=1', () => {
      const s = new SLACalculator()
      s.record(true)
      s.record(true)
      expect(s.availability('1h')).toBe(1)
    })
    it('1 次失败 3 次成功可用率=0.75', () => {
      const s = new SLACalculator()
      s.record(true)
      s.record(false)
      s.record(true)
      s.record(true)
      expect(s.availability('1h')).toBe(0.75)
    })
    it('不同窗口独立计算', () => {
      const s = new SLACalculator()
      const now = Date.now() / 1000
      // 0.5h 前的记录：只出现在 1h 窗口
      s.record(false, now - 1800)
      // 当前记录：所有窗口都有
      s.record(true, now)
      // 1h 窗口：2 条记录 1 失败
      expect(s.availability('1h')).toBe(0.5)
      // 24h 窗口：同上
      expect(s.availability('24h')).toBe(0.5)
    })
  })

  describe('errorBudgetRemaining', () => {
    it('无错误时预算剩余=1', () => {
      const s = new SLACalculator()
      s.record(true)
      expect(s.errorBudgetRemaining()).toBe(1)
    })
    it('消耗部分预算返回 0~1', () => {
      const s = new SLACalculator({ slo: 0.9 }) // 10% 错误预算
      s.record(false)
      s.record(false)
      s.record(true)
      s.record(true)
      // 可用率=0.5, slo=0.9, used=0.4, budget=0.1
      // remaining = 1 - 0.4/0.1 = 1 - 4 = -3 → max(0, ...)
      expect(s.errorBudgetRemaining()).toBe(0)
    })
    it('未消耗完预算返回正数', () => {
      const s = new SLACalculator({ slo: 0.9 })
      // 9 成 1 败 → 可用率 0.9 = slo, used=0, remaining=1
      for (let i = 0; i < 9; i++) s.record(true)
      s.record(false)
      expect(s.errorBudgetRemaining()).toBe(1)
    })
  })

  describe('burnRate', () => {
    it('无错误时 burnRate=0', () => {
      const s = new SLACalculator()
      s.record(true)
      expect(s.burnRate('1h')).toBe(0)
    })
    it('错误率 = 错误预算率时 burnRate=1', () => {
      const s = new SLACalculator({ slo: 0.9 })
      // 10% 错误率 = 10% 错误预算率 → burnRate=1
      s.record(false)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      s.record(true)
      expect(s.burnRate('1h')).toBeCloseTo(1, 5)
    })
    it('slo=1 时 burnRate=0', () => {
      const s = new SLACalculator({ slo: 1 })
      s.record(false)
      expect(s.burnRate('1h')).toBe(0)
    })
  })

  describe('checkMultiWindowBurn', () => {
    it('无错误时不触发', () => {
      const s = new SLACalculator()
      s.record(true)
      expect(s.checkMultiWindowBurn()).toEqual([])
    })
    it('错误率极高时触发规则', () => {
      const s = new SLACalculator({ slo: 0.999 })
      // 50% 错误率，burnRate = 0.5 / 0.001 = 500
      for (let i = 0; i < 50; i++) s.record(false)
      for (let i = 0; i < 50; i++) s.record(true)
      const alerts = s.checkMultiWindowBurn()
      expect(alerts.length).toBeGreaterThan(0)
    })
    it('自定义规则生效', () => {
      const s = new SLACalculator({ slo: 0.9 })
      s.record(false)
      s.record(true)
      // burnRate = 0.5 / 0.1 = 5
      const alerts = s.checkMultiWindowBurn([
        { short: '1h', long: '24h', shortThreshold: 4, longThreshold: 4, severity: 'warning' },
      ])
      expect(alerts).toHaveLength(1)
      expect(alerts[0]!.rule.severity).toBe('warning')
    })
  })

  describe('stats', () => {
    it('返回完整统计', () => {
      const s = new SLACalculator({ slo: 0.99 })
      s.record(true)
      s.record(false)
      const st = s.stats() as Record<string, number>
      expect(st.total).toBe(2)
      expect(st.errors).toBe(1)
      expect(st.slo).toBe(0.99)
      expect(st).toHaveProperty('avail1h')
      expect(st).toHaveProperty('avail24h')
      expect(st).toHaveProperty('burnRate1h')
      expect(st).toHaveProperty('errorBudgetRemaining')
    })
  })
})
