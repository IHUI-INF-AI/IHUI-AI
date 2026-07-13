import { describe, it, expect } from 'vitest'
import { ChaosInjector, FaultType, createFaultRule } from '../src/utils/chaos-injector.js'

describe('chaos-injector — 混沌测试异常注入', () => {
  describe('createFaultRule', () => {
    it('使用默认值创建规则', () => {
      const r = createFaultRule('user.get', FaultType.LATENCY)
      expect(r.target).toBe('user.get')
      expect(r.fault).toBe(FaultType.LATENCY)
      expect(r.probability).toBe(1)
      expect(r.latencyMs).toBe(100)
      expect(r.exceptionCtor).toBe(Error)
      expect(r.exceptionMsg).toBe('injected')
      expect(r.enabled).toBe(true)
    })
    it('自定义选项覆盖默认', () => {
      const r = createFaultRule('x', FaultType.EXCEPTION, {
        probability: 0.5,
        latencyMs: 200,
        exceptionMsg: 'boom',
        enabled: false,
      })
      expect(r.probability).toBe(0.5)
      expect(r.latencyMs).toBe(200)
      expect(r.exceptionMsg).toBe('boom')
      expect(r.enabled).toBe(false)
    })
  })

  describe('规则管理', () => {
    it('add 注册规则', () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY))
      expect(c.getStats().x).toBeDefined()
    })
    it('remove 移除规则', () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY))
      expect(c.remove('x')).toBe(true)
      expect(c.remove('x')).toBe(false)
    })
    it('enable 单个 target', () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY, { enabled: false }))
      c.enable('x')
      // 通过 hit 验证（启用后概率=1 必触发）
      return expect(c.hit('x')).resolves.toBe(true)
    })
    it('disable 单个 target', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY))
      c.disable('x')
      expect(await c.hit('x')).toBe(false)
    })
    it('disable 全局使所有规则失效', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY))
      c.disable()
      expect(await c.hit('x')).toBe(false)
    })
    it('enable 全局恢复', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY))
      c.disable()
      c.enable()
      expect(await c.hit('x')).toBe(true)
    })
  })

  describe('hit 故障注入', () => {
    it('LATENCY 注入延迟后返回 true', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY, { latencyMs: 1 }))
      const start = Date.now()
      const hit = await c.hit('x')
      expect(hit).toBe(true)
      expect(Date.now() - start).toBeGreaterThanOrEqual(0)
    })
    it('EXCEPTION 注入异常', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.EXCEPTION, { exceptionMsg: 'boom' }))
      await expect(c.hit('x')).rejects.toThrow('boom')
    })
    it('ABORT 注入 AbortError', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.ABORT, { exceptionMsg: 'cancelled' }))
      await expect(c.hit('x')).rejects.toThrow('AbortError: cancelled')
    })
    it('自定义 exceptionCtor', async () => {
      class CustomError extends Error {
        constructor(m: string) {
          super(m)
          this.name = 'CustomError'
        }
      }
      const c = new ChaosInjector(42)
      c.add(
        createFaultRule('x', FaultType.EXCEPTION, {
          exceptionCtor: CustomError,
          exceptionMsg: 'x',
        }),
      )
      try {
        await c.hit('x')
        expect.fail('应抛错')
      } catch (e) {
        expect(e).toBeInstanceOf(CustomError)
      }
    })
    it('未注册 target 返回 false 且计入 skip', async () => {
      const c = new ChaosInjector(42)
      expect(await c.hit('missing')).toBe(false)
      expect(c.getStats().missing.skip).toBe(1)
    })
    it('probability=0 不触发', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.EXCEPTION, { probability: 0 }))
      expect(await c.hit('x')).toBe(false)
      expect(c.getStats().x.skip).toBe(1)
    })
    it('种子化可复现（同种子同序列）', async () => {
      const c1 = new ChaosInjector(42)
      const c2 = new ChaosInjector(42)
      c1.add(createFaultRule('x', FaultType.EXCEPTION, { probability: 0.5 }))
      c2.add(createFaultRule('x', FaultType.EXCEPTION, { probability: 0.5 }))
      const r1 = await c1.hit('x').catch(() => 'threw')
      const r2 = await c2.hit('x').catch(() => 'threw')
      expect(r1).toEqual(r2)
    })
  })

  describe('wrap 包装函数', () => {
    it('注入延迟后执行 fn', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY, { latencyMs: 1 }))
      const r = await c.wrap('x', () => 'ok')
      expect(r).toBe('ok')
    })
    it('注入异常时不执行 fn', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.EXCEPTION))
      await expect(c.wrap('x', () => 'ok')).rejects.toThrow('injected')
    })
  })

  describe('getStats', () => {
    it('返回 hit/skip 计数快照', async () => {
      const c = new ChaosInjector(42)
      c.add(createFaultRule('x', FaultType.LATENCY, { probability: 1 }))
      await c.hit('x')
      await c.hit('missing')
      const s = c.getStats()
      expect(s.x.hit).toBe(1)
      expect(s.missing.skip).toBe(1)
    })
  })
})
