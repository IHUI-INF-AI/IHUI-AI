import { describe, it, expect, vi } from 'vitest'

/**
 * 混沌工程测试 — 用 mock 模拟网络/磁盘/CPU/内存故障及服务降级策略.
 *
 * 覆盖: 网络延迟(500/1000/2000ms)、网络分区(节点隔离)、磁盘满(90/95/99%)、
 *      CPU 压力(50/80/100%)、内存压力(80/90/95%)、服务降级生效.
 */

// ---------- mock: 网络延迟注入 ----------
function injectLatency(ms: number): { injected: boolean; duration: number } {
  return { injected: ms > 0, duration: ms }
}

// ---------- mock: 网络分区(节点隔离) ----------
interface NodeState {
  name: string
  isolated: boolean
  reachable: string[]
}

function isolateNode(nodes: NodeState[], target: string): NodeState[] {
  return nodes.map((n) => {
    if (n.name === target) return { ...n, isolated: true, reachable: [] }
    return { ...n, reachable: n.reachable.filter((r) => r !== target) }
  })
}

// ---------- mock: 磁盘满 ----------
function diskPressure(usedPct: number): {
  alert: 'normal' | 'warning' | 'critical'
  writable: boolean
} {
  if (usedPct >= 0.99) return { alert: 'critical', writable: false }
  if (usedPct >= 0.95) return { alert: 'critical', writable: true }
  if (usedPct >= 0.9) return { alert: 'warning', writable: true }
  return { alert: 'normal', writable: true }
}

// ---------- mock: CPU 压力 ----------
function cpuPressure(utilization: number): { throttled: boolean; degraded: boolean } {
  return {
    throttled: utilization >= 1.0,
    degraded: utilization >= 0.8,
  }
}

// ---------- mock: 内存压力 ----------
function memoryPressure(utilization: number): { oomRisk: boolean; degraded: boolean } {
  return {
    oomRisk: utilization >= 0.95,
    degraded: utilization >= 0.9,
  }
}

// ---------- mock: 服务降级策略 ----------
interface ServiceDegradation {
  level: 'normal' | 'degraded' | 'critical'
  features: string[]
}

function evaluateDegradation(input: {
  disk: number
  cpu: number
  memory: number
}): ServiceDegradation {
  const flags = [diskPressure(input.disk), cpuPressure(input.cpu), memoryPressure(input.memory)]
  const critical = flags.some((f) =>
    'alert' in f ? f.alert === 'critical' : 'oomRisk' in f ? f.oomRisk : f.throttled,
  )
  const degraded = flags.some((f) =>
    'alert' in f ? f.alert === 'warning' : 'degraded' in f ? f.degraded : false,
  )
  if (critical) return { level: 'critical', features: ['read-only', 'rate-limit', 'cache-only'] }
  if (degraded) return { level: 'degraded', features: ['rate-limit', 'cache-only'] }
  return { level: 'normal', features: [] }
}

describe('chaos — 混沌工程', () => {
  describe('网络延迟注入', () => {
    it('500ms 注入成功', () => {
      const r = injectLatency(500)
      expect(r.injected).toBe(true)
      expect(r.duration).toBe(500)
    })
    it('1000ms 注入成功', () => {
      expect(injectLatency(1000).duration).toBe(1000)
    })
    it('2000ms 注入成功', () => {
      expect(injectLatency(2000).duration).toBe(2000)
    })
    it('0ms 不注入', () => {
      expect(injectLatency(0).injected).toBe(false)
    })
  })

  describe('网络分区 (节点隔离)', () => {
    const nodes: NodeState[] = [
      { name: 'a', isolated: false, reachable: ['b', 'c'] },
      { name: 'b', isolated: false, reachable: ['a', 'c'] },
      { name: 'c', isolated: false, reachable: ['a', 'b'] },
    ]
    it('隔离后目标节点 isolated=true', () => {
      const r = isolateNode(nodes, 'b')
      expect(r.find((n) => n.name === 'b')?.isolated).toBe(true)
    })
    it('隔离后其他节点不可达目标', () => {
      const r = isolateNode(nodes, 'b')
      expect(r.find((n) => n.name === 'a')?.reachable).not.toContain('b')
    })
    it('隔离 c 后 a 与 b 仍互通', () => {
      const r = isolateNode(nodes, 'c')
      expect(r.find((n) => n.name === 'a')?.reachable).toContain('b')
    })
  })

  describe('磁盘满', () => {
    it('90% → warning', () => expect(diskPressure(0.9).alert).toBe('warning'))
    it('95% → critical (仍可写)', () => {
      const r = diskPressure(0.95)
      expect(r.alert).toBe('critical')
      expect(r.writable).toBe(true)
    })
    it('99% → critical 且不可写', () => {
      const r = diskPressure(0.99)
      expect(r.alert).toBe('critical')
      expect(r.writable).toBe(false)
    })
    it('80% → normal', () => expect(diskPressure(0.8).alert).toBe('normal'))
  })

  describe('CPU 压力', () => {
    it('50% 不降级', () => expect(cpuPressure(0.5).degraded).toBe(false))
    it('80% 触发降级', () => expect(cpuPressure(0.8).degraded).toBe(true))
    it('100% 触发限流', () => {
      const r = cpuPressure(1.0)
      expect(r.throttled).toBe(true)
      expect(r.degraded).toBe(true)
    })
  })

  describe('内存压力', () => {
    it('80% 不降级', () => expect(memoryPressure(0.8).degraded).toBe(false))
    it('90% 触发降级', () => expect(memoryPressure(0.9).degraded).toBe(true))
    it('95% OOM 风险', () => {
      const r = memoryPressure(0.95)
      expect(r.oomRisk).toBe(true)
    })
  })

  describe('服务降级策略生效', () => {
    it('所有指标正常 → normal', () => {
      expect(evaluateDegradation({ disk: 0.5, cpu: 0.5, memory: 0.5 }).level).toBe('normal')
    })
    it('磁盘 90% → degraded', () => {
      expect(evaluateDegradation({ disk: 0.9, cpu: 0.5, memory: 0.5 }).level).toBe('degraded')
    })
    it('CPU 100% → critical (只读模式)', () => {
      const r = evaluateDegradation({ disk: 0.5, cpu: 1.0, memory: 0.5 })
      expect(r.level).toBe('critical')
      expect(r.features).toContain('read-only')
    })
    it('内存 95% → critical', () => {
      expect(evaluateDegradation({ disk: 0.5, cpu: 0.5, memory: 0.95 }).level).toBe('critical')
    })
    it('降级时调用限流 mock', () => {
      const limiter = vi.fn()
      const r = evaluateDegradation({ disk: 0.95, cpu: 0.9, memory: 0.9 })
      if (r.level !== 'normal') limiter()
      expect(limiter).toHaveBeenCalledTimes(1)
    })
  })
})
