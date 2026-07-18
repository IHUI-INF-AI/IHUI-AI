import { describe, it, expect, vi } from 'vitest'

/**
 * FinOps 成本优化测试 — 用 mock 模拟云厂商 API.
 *
 * 覆盖: 资源利用率(CPU<30% 可缩容)、闲置资源(7天无请求)、存储优化(30天未访问转低频)、
 *      cross-zone 流量告警、月度预算 80% 告警.
 */

// ---------- mock: 云资源实例 ----------
interface CloudInstance {
  id: string
  cpuUtilization: number // 0~1
  lastRequestAt: number // epoch ms
  zone: string
}

/** 资源利用率监控: CPU < 30% 标记为可缩容. */
function findScalableInstances(instances: CloudInstance[]): CloudInstance[] {
  return instances.filter((i) => i.cpuUtilization < 0.3)
}

// ---------- mock: 闲置资源识别 ----------
function findIdleInstances(instances: CloudInstance[], now: number, idleDays = 7): CloudInstance[] {
  const idleMs = idleDays * 24 * 3600 * 1000
  return instances.filter((i) => now - i.lastRequestAt > idleMs)
}

// ---------- mock: 存储对象 ----------
interface StorageObject {
  key: string
  size: number
  lastAccessAt: number
  storageClass: 'standard' | 'infrequent_access' | 'archive'
}

/** 存储成本优化: 30 天未访问的对象转低频访问. */
function optimizeStorage(objects: StorageObject[], now: number): StorageObject[] {
  const threshold = 30 * 24 * 3600 * 1000
  return objects.map((o) => {
    if (now - o.lastAccessAt > threshold && o.storageClass === 'standard') {
      return { ...o, storageClass: 'infrequent_access' }
    }
    return o
  })
}

// ---------- mock: 网络流量 ----------
interface TrafficSample {
  sourceZone: string
  destZone: string
  bytes: number
}

function detectCrossZoneTraffic(
  samples: TrafficSample[],
  thresholdBytes = 100 * 1024 * 1024,
): TrafficSample[] {
  return samples.filter((s) => s.sourceZone !== s.destZone && s.bytes > thresholdBytes)
}

// ---------- mock: 月度预算告警 ----------
interface BudgetStatus {
  monthlyBudget: number
  spent: number
}

function checkBudgetAlert(status: BudgetStatus): {
  alert: boolean
  level: 'normal' | 'warning' | 'critical'
  pct: number
} {
  const pct = status.spent / status.monthlyBudget
  if (pct >= 1.0) return { alert: true, level: 'critical', pct }
  if (pct >= 0.8) return { alert: true, level: 'warning', pct }
  return { alert: false, level: 'normal', pct }
}

describe('finops — 成本优化', () => {
  const now = Date.now()

  describe('资源利用率监控 (CPU < 30% 可缩容)', () => {
    const instances: CloudInstance[] = [
      { id: 'i1', cpuUtilization: 0.15, lastRequestAt: now, zone: 'a' },
      { id: 'i2', cpuUtilization: 0.55, lastRequestAt: now, zone: 'b' },
      { id: 'i3', cpuUtilization: 0.29, lastRequestAt: now, zone: 'a' },
    ]
    it('识别 CPU=15% 可缩容', () => {
      const r = findScalableInstances(instances)
      expect(r.map((i) => i.id)).toContain('i1')
    })
    it('CPU=55% 不可缩容', () => {
      const r = findScalableInstances(instances)
      expect(r.map((i) => i.id)).not.toContain('i2')
    })
    it('CPU=29% 边界可缩容', () => {
      const r = findScalableInstances(instances)
      expect(r.map((i) => i.id)).toContain('i3')
    })
  })

  describe('闲置资源识别 (7 天无请求)', () => {
    const instances: CloudInstance[] = [
      { id: 'i1', cpuUtilization: 0.2, lastRequestAt: now - 8 * 86400_000, zone: 'a' },
      { id: 'i2', cpuUtilization: 0.2, lastRequestAt: now - 3 * 86400_000, zone: 'b' },
      { id: 'i3', cpuUtilization: 0.2, lastRequestAt: now - 7 * 86400_000 - 1, zone: 'a' },
    ]
    it('8 天未请求 → 闲置', () => {
      const r = findIdleInstances(instances, now)
      expect(r.map((i) => i.id)).toContain('i1')
    })
    it('3 天前请求 → 非闲置', () => {
      const r = findIdleInstances(instances, now)
      expect(r.map((i) => i.id)).not.toContain('i2')
    })
    it('7 天 + 1ms → 闲置 (边界)', () => {
      const r = findIdleInstances(instances, now)
      expect(r.map((i) => i.id)).toContain('i3')
    })
  })

  describe('存储成本优化 (30 天未访问转低频)', () => {
    const objects: StorageObject[] = [
      { key: 'a.txt', size: 1024, lastAccessAt: now - 35 * 86400_000, storageClass: 'standard' },
      { key: 'b.txt', size: 1024, lastAccessAt: now - 10 * 86400_000, storageClass: 'standard' },
      { key: 'c.txt', size: 1024, lastAccessAt: now - 60 * 86400_000, storageClass: 'archive' },
    ]
    it('35 天未访问 → infrequent_access; 10 天访问 / archive 不变', () => {
      const r = optimizeStorage(objects, now)
      expect(r.find((o) => o.key === 'a.txt')?.storageClass).toBe('infrequent_access')
      expect(r.find((o) => o.key === 'b.txt')?.storageClass).toBe('standard')
      expect(r.find((o) => o.key === 'c.txt')?.storageClass).toBe('archive')
    })
  })

  describe('网络流量优化 (cross-zone 告警)', () => {
    const samples: TrafficSample[] = [
      { sourceZone: 'a', destZone: 'a', bytes: 200 * 1024 * 1024 },
      { sourceZone: 'a', destZone: 'b', bytes: 150 * 1024 * 1024 },
      { sourceZone: 'a', destZone: 'b', bytes: 50 * 1024 * 1024 },
    ]
    it('cross-zone > 100MB 告警; 同 zone / 低阈值不告警', () => {
      const r = detectCrossZoneTraffic(samples)
      expect(r.find((s) => s.sourceZone === s.destZone)).toBeUndefined()
      expect(r).toHaveLength(1)
      expect(r[0]!.bytes).toBe(150 * 1024 * 1024)
      expect(detectCrossZoneTraffic(samples, 200 * 1024 * 1024)).toHaveLength(0)
    })
  })

  describe('成本告警 (月度预算 80%)', () => {
    it('60% 不告警 / 80% warning / 100% critical', () => {
      expect(checkBudgetAlert({ monthlyBudget: 1000, spent: 600 }).alert).toBe(false)
      const w = checkBudgetAlert({ monthlyBudget: 1000, spent: 800 })
      expect(w.alert).toBe(true)
      expect(w.level).toBe('warning')
      expect(checkBudgetAlert({ monthlyBudget: 1000, spent: 1000 }).level).toBe('critical')
    })
    it('超预算 120% → critical', () => {
      const r = checkBudgetAlert({ monthlyBudget: 1000, spent: 1200 })
      expect(r.alert).toBe(true)
      expect(r.level).toBe('critical')
      expect(r.pct).toBeCloseTo(1.2, 2)
    })
    it('告警时调用通知 mock', () => {
      const notifier = vi.fn()
      const r = checkBudgetAlert({ monthlyBudget: 1000, spent: 850 })
      if (r.alert) notifier(r.level)
      expect(notifier).toHaveBeenCalledWith('warning')
    })
  })
})
