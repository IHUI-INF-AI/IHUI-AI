// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// ===== 构造可按 select 列键路由结果的 dbRead 链式 stub =====
function makeChain(result: unknown) {
  const promise = Promise.resolve(result)
  const thenable = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    orderBy: () => thenable,
    groupBy: () => thenable,
    where: () => thenable,
    limit: () => thenable,
    leftJoin: () => chain,
  }
  const chain = {
    select: () => chain,
    from: () => chain,
    orderBy: () => thenable,
    groupBy: () => thenable,
    limit: () => thenable,
    where: () => thenable,
    leftJoin: () => chain,
  }
  return chain
}

/** 按首个 select 参数的列名路由返回值(各查询列集合互不重叠) */
function routeByColumns(cols: Record<string, unknown>): unknown {
  const keys = Object.keys(cols)
  if (keys.includes('loadBalanceStrategy'))
    return [
      {
        id: 'g1',
        name: 'G1',
        description: null,
        loadBalanceStrategy: 'weight',
        enabled: true,
        priority: 10,
        createdAt: null,
        updatedAt: null,
      },
    ]
  if (keys.includes('groupId') && keys.includes('count')) return [{ groupId: 'g1', count: 2 }]
  if (keys.includes('memberId'))
    return [
      {
        memberId: 'm1',
        keyPoolId: 'k1',
        weight: 1,
        createdAt: null,
        keyPoolName: 'K1',
        keyPoolProviderCode: 'openai',
        keyPoolEnabled: true,
      },
    ]
  if (keys.includes('p95LatencyMs'))
    return [
      {
        callCount: 10,
        totalTokens: 100,
        totalCostCents: 500,
        errorCount: 1,
        avgLatencyMs: 120,
        p95LatencyMs: 300,
      },
    ]
  // range 聚合(无 totalTokens/p95)
  return [{ callCount: 20, totalCostCents: 900, errorCount: 2 }]
}

vi.mock('../../db/index.js', () => ({
  dbRead: {
    select: vi.fn((cols: Record<string, unknown>) => makeChain(routeByColumns(cols))),
  },
}))

vi.mock('@ihui/database', () => ({
  aiRelayChannelGroups: {
    id: 'groups.id',
    name: 'groups.name',
    loadBalanceStrategy: 'groups.loadBalanceStrategy',
    priority: 'groups.priority',
    enabled: 'groups.enabled',
    description: 'groups.description',
    createdAt: 'groups.createdAt',
    updatedAt: 'groups.updatedAt',
  },
  aiRelayChannelGroupMembers: {
    id: 'members.id',
    groupId: 'members.groupId',
    keyPoolId: 'members.keyPoolId',
    weight: 'members.weight',
    createdAt: 'members.createdAt',
  },
  aiRelayKeyPool: {
    id: 'pool.id',
    name: 'pool.name',
    providerCode: 'pool.providerCode',
    isEnabled: 'pool.isEnabled',
  },
  llmCallLogs: {
    totalTokens: 'logs.totalTokens',
    metadata: 'logs.metadata',
    status: 'logs.status',
    latencyMs: 'logs.latencyMs',
    createdAt: 'logs.createdAt',
  },
}))

vi.mock('../../services/relay-channel-router.js', () => ({
  getCircuitState: vi.fn(() => ({ state: 'closed', failureCount: 0, lastFailureAt: null })),
  getRecentCalls: vi.fn(() => [{ latencyMs: 100 }, { latencyMs: 200 }]),
}))

vi.mock('../../services/relay-alert-rules-service.js', () => ({
  listAlertRules: vi.fn(async () => [{ id: 'r1', name: '规则1', metric: 'errorRate' }]),
  listRecentAlertEvents: vi.fn(async () => [{ id: 'e1', ruleId: 'r1', status: 'fired' }]),
}))

import { buildRelayOpsSnapshot } from '../relay-ops-snapshot.js'

describe('relay-ops-snapshot(#58 运营快照组装)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常路径:三段齐全且形状与 REST 契约一致', async () => {
    const snap = await buildRelayOpsSnapshot()
    expect(typeof snap.ts).toBe('string')
    expect(Number.isNaN(Date.parse(snap.ts))).toBe(false)

    // alerts
    expect(snap.alerts.rules).toHaveLength(1)
    expect(snap.alerts.events).toHaveLength(1)

    // channels:groups 与 stats 一一对应,统计含熔断汇总
    expect(snap.channels.groups).toHaveLength(1)
    expect(snap.channels.groups[0]!.memberCount).toBe(2)
    expect(snap.channels.stats).toHaveLength(1)
    const stat = snap.channels.stats[0]!
    expect(stat.group.id).toBe('g1')
    expect(stat.memberCount).toBe(1)
    expect(stat.circuitSummary).toEqual({ closed: 1, open: 0, halfOpen: 0 })
    expect(stat.members[0]!.avgLatencyMs).toBe(150)

    // usage:overview 含 today/yesterday/delta/last7d/last30d
    const ov = snap.usage.overview
    expect(ov).not.toBeNull()
    expect(ov!.today.callCount).toBe(10)
    expect(ov!.today.errorRate).toBeCloseTo(0.1)
    expect(ov!.yesterday.callCount).toBe(10)
    expect(ov!.last7d.callCount).toBe(20)
    expect(ov!.last30d.callCount).toBe(20)
    expect(ov!.delta.callCountDelta).toBeCloseTo(0)
  })

  it('告警服务抛错 → alerts 段降级为空数组,不拖垮整帧', async () => {
    const svc = await import('../../services/relay-alert-rules-service.js')
    vi.mocked(svc.listAlertRules).mockRejectedValueOnce(new Error('db down'))
    vi.mocked(svc.listRecentAlertEvents).mockRejectedValueOnce(new Error('db down'))
    const snap = await buildRelayOpsSnapshot()
    expect(snap.alerts.rules).toEqual([])
    expect(snap.alerts.events).toEqual([])
    expect(snap.usage.overview).not.toBeNull()
  })

  it('用量段异常 → usage.overview 为 null,其余段不受影响', async () => {
    // 让聚合查询的 dbRead 抛错:按列键路由,仅 period 聚合查询抛错
    const dbMod = await import('../../db/index.js')
    const original = vi.mocked(dbMod.dbRead.select).getMockImplementation()
    vi.mocked(dbMod.dbRead.select).mockImplementation(((cols: unknown) => {
      const c = cols as Record<string, unknown>
      if (c && 'p95LatencyMs' in c) throw new Error('aggregate down')
      return (original as unknown as (x: unknown) => unknown)(cols)
    }) as never)
    const snap = await buildRelayOpsSnapshot()
    expect(snap.usage.overview).toBeNull()
    expect(snap.alerts.rules).toHaveLength(1)
    expect(snap.channels.groups).toHaveLength(1)
    vi.mocked(dbMod.dbRead.select).mockImplementation(original as never)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
