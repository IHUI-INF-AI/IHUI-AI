import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EscalationEngine, Channel, DEFAULT_POLICY } from '../src/utils/alert-escalation.js'

describe('alert-escalation — 阶梯式告警升级', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('DEFAULT_POLICY', () => {
    it('包含 5 个步骤 LOG→EMAIL→SMS→PHONE→ONCALL', () => {
      expect(DEFAULT_POLICY.steps.map((s) => s.channel)).toEqual([
        Channel.LOG,
        Channel.EMAIL,
        Channel.SMS,
        Channel.PHONE,
        Channel.ONCALL,
      ])
    })
    it('afterSec 递增', () => {
      const secs = DEFAULT_POLICY.steps.map((s) => s.afterSec)
      for (let i = 1; i < secs.length; i++) {
        expect(secs[i]).toBeGreaterThan(secs[i - 1]!)
      }
    })
  })

  describe('fire', () => {
    it('创建新告警 lastEscalatedStep=-1', () => {
      const e = new EscalationEngine()
      const a = e.fire('alert-1', 'crit', {})
      expect(a.lastEscalatedStep).toBe(-1)
      expect(a.acked).toBe(false)
      expect(a.severity).toBe('crit')
    })
    it('重复 fire 同一 alertId 返回同一对象', () => {
      const e = new EscalationEngine()
      const a1 = e.fire('alert-1', 'crit', {})
      const a2 = e.fire('alert-1', 'crit', {})
      expect(a1).toBe(a2)
    })
  })

  describe('ack', () => {
    it('ack 已存在告警返回 true', () => {
      const e = new EscalationEngine()
      e.fire('alert-1', 'crit', {})
      expect(e.ack('alert-1')).toBe(true)
      expect(e.active()[0]!.acked).toBe(true)
    })
    it('ack 不存在告警返回 false', () => {
      const e = new EscalationEngine()
      expect(e.ack('missing')).toBe(false)
    })
  })

  describe('tick 升级', () => {
    it('立即 tick 触发 LOG（afterSec=0）', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      const triggers = e.tick()
      expect(triggers).toHaveLength(1)
      expect(triggers[0]!.channel).toBe(Channel.LOG)
      expect(triggers[0]!.alertId).toBe('a1')
    })
    it('60s 后触发 EMAIL', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      e.tick()
      vi.advanceTimersByTime(60 * 1000)
      const triggers = e.tick()
      expect(triggers).toHaveLength(1)
      expect(triggers[0]!.channel).toBe(Channel.EMAIL)
    })
    it('多步同时触发时按顺序返回', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      vi.advanceTimersByTime(300 * 1000) // 已过 LOG+EMAIL+SMS 时间
      const triggers = e.tick()
      expect(triggers.map((t) => t.channel)).toEqual([Channel.LOG, Channel.EMAIL, Channel.SMS])
    })
    it('ack 后不再升级', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      e.ack('a1')
      vi.advanceTimersByTime(3600 * 1000)
      expect(e.tick()).toEqual([])
    })
    it('template 为空时使用 severity 作为 message', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit-sev', {})
      const triggers = e.tick()
      expect(triggers[0]!.message).toBe('crit-sev')
    })
    it('template 非空时使用 template', () => {
      const policy = {
        name: 'custom',
        steps: [{ channel: Channel.LOG, afterSec: 0, template: 'TPL' }],
      }
      const e = new EscalationEngine(policy)
      e.fire('a1', 'crit', {})
      const triggers = e.tick()
      expect(triggers[0]!.message).toBe('TPL')
    })
    it('调用 send 回调', () => {
      const send = vi.fn()
      const e = new EscalationEngine(undefined, send)
      e.fire('a1', 'crit', {})
      e.tick()
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(Channel.LOG, 'a1', 'crit')
    })
    it('send 抛错不影响 tick 返回', () => {
      const send = vi.fn(() => {
        throw new Error('send failed')
      })
      const e = new EscalationEngine(undefined, send)
      e.fire('a1', 'crit', {})
      const triggers = e.tick()
      expect(triggers).toHaveLength(1)
    })
  })

  describe('active', () => {
    it('返回所有活跃告警', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      e.fire('a2', 'warn', {})
      expect(e.active()).toHaveLength(2)
    })
  })

  describe('stats', () => {
    it('反映 active 与 acked 计数', () => {
      const e = new EscalationEngine()
      e.fire('a1', 'crit', {})
      e.fire('a2', 'warn', {})
      e.ack('a1')
      const s = e.stats()
      expect(s.active).toBe(2)
      expect(s.acked).toBe(1)
    })
  })
})
