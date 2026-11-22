// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 号池模型目录自动同步单测(2026-11-18)。
 * 重点钉两条安全边界:
 * ① 下架判据 retiredModelIdsOf 的归一 + 取不到清单绝不判下架;
 * ② 整轮 sync:ok=false 的平台整块跳过(既不插新也不退役)。
 * db/logger 全 mock(按 @ihui/database 真实表对象分流);真实 SQL 正确性由集成环境保证。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    accountRows: [] as Array<Record<string, unknown>>,
    discoveryRows: [] as Array<Record<string, unknown>>,
    insertedRows: [] as Array<Record<string, unknown>>,
    updatedWhere: [] as unknown,
  }
})

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// @ihui/database:只 mock 同步腿用到的两张表(真实列定义由数据库包保证,这里给占位列)
vi.mock('@ihui/database', () => {
  const col = () => ({ __col: true })
  const aiRelayAccountPool = {
    __table: 'account',
    providerCode: col(),
    isEnabled: col(),
    tempUnschedulable: col(),
    healthStatus: col(),
    ownerUserId: col(),
  }
  const aiRelayDiscovery = {
    __table: 'discovery',
    providerCode: col(),
    modelId: col(),
    id: col(),
    status: col(),
  }
  return { aiRelayAccountPool, aiRelayDiscovery }
})

// drizzle-orm:轻量占位(真实 SQL 正确性由集成环境保证)
vi.mock('drizzle-orm', () => ({
  and: (..._a: unknown[]) => ({ __and: true }),
  eq: (_c: unknown, v: unknown) => ({ __eq: v }),
  inArray: (_c: unknown, vals: unknown[]) => ({ __in: vals }),
  isNotNull: (_c: unknown) => ({ __notNull: true }),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    insert: () => ({
      values: (vals: Array<Record<string, unknown>>) => ({
        onConflictDoNothing: async () => {
          hoisted.insertedRows.push(...vals)
          return []
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: async (w: unknown) => {
          hoisted.updatedWhere = w
          return []
        },
      }),
    }),
  },
  dbRead: {
    select: () => ({
      from: (table: unknown) => {
        // 两条查询(sync 里的账号查询 / 发现表查询)都是 .where() 直接 await → 行数组。
        // 按表身份分流返回各自的数据。(fetchUpstreamModelIdsForProvider 已被 mock,不走真实链)
        const tableName = (table as { __table?: string })?.__table
        return {
          where: async () =>
            tableName === 'account' ? hoisted.accountRows : hoisted.discoveryRows,
        }
      },
    }),
  },
}))

vi.mock('../../services/relay-account-pool-scheduler.js', () => ({
  accountSchedulableCondition: () => ({ __sched: true }),
}))

const upstreamByProvider = new Map<string, { ok: boolean; ids: string[] }>()
vi.mock('../../services/relay-account-pool-service.js', () => ({
  fetchUpstreamModelIdsForProvider: async (code: string) =>
    upstreamByProvider.get(code) ?? { ok: false, ids: [] },
}))

vi.mock('../../services/relay-account-format.js', () => ({
  isRelayProviderCode: (v: string) => ['trae', 'workbuddy', 'codearts'].includes(v),
}))

import {
  retiredModelIdsOf,
  syncRelayPoolModelDiscovery,
} from '../relay-pool-model-discovery-sync.js'

describe('retiredModelIdsOf(下架判据)', () => {
  it('上游不再报的待审批 id 被判下架', () => {
    expect(retiredModelIdsOf(['m-old', 'm-live'], ['m-live', 'm-new'])).toEqual(['m-old'])
  })

  it('取不到上游清单(null)⇒ 绝不判下架(返回空集)', () => {
    expect(retiredModelIdsOf(['m-old', 'm-live'], null)).toEqual([])
  })

  it('归一:裸名 / <平台>/ 前缀 / 大小写差异视为同一模型', () => {
    expect(retiredModelIdsOf(['Trae/Step-3', 'step-3'], ['trae/step-3', 'STEP-3'])).toEqual([])
  })

  it('上一轮为空 ⇒ 无下架', () => {
    expect(retiredModelIdsOf([], ['m-new'])).toEqual([])
  })
})

describe('syncRelayPoolModelDiscovery(整轮)', () => {
  beforeEach(() => {
    hoisted.accountRows = []
    hoisted.discoveryRows = []
    hoisted.insertedRows = []
    hoisted.updatedWhere = null
    upstreamByProvider.clear()
  })

  it('无可调度号 ⇒ 零平台扫描', async () => {
    const result = await syncRelayPoolModelDiscovery()
    expect(result.providersScanned).toBe(0)
    expect(result.modelsDiscovered).toBe(0)
    expect(result.modelsRetired).toBe(0)
  })

  it('ok=false 平台整块跳过:不插新、不退役(取不到 ≠ 没模型)', async () => {
    hoisted.accountRows = [{ providerCode: 'trae' }]
    upstreamByProvider.set('trae', { ok: false, ids: [] })
    const result = await syncRelayPoolModelDiscovery()
    expect(result.providersScanned).toBe(1)
    expect(result.providersSkipped).toBe(1)
    expect(result.providersOk).toBe(0)
    expect(result.modelsDiscovered).toBe(0)
    expect(result.modelsRetired).toBe(0)
    expect(hoisted.insertedRows).toEqual([])
  })

  it('ok=true:上游新模型进发现表且 status=discovered', async () => {
    hoisted.accountRows = [{ providerCode: 'trae' }]
    upstreamByProvider.set('trae', { ok: true, ids: ['step-3', 'step-4'] })
    const result = await syncRelayPoolModelDiscovery()
    expect(result.providersOk).toBe(1)
    expect(result.modelsDiscovered).toBe(2)
    expect(hoisted.insertedRows.map((r) => r.modelId).sort()).toEqual(['step-3', 'step-4'])
    expect(hoisted.insertedRows.every((r) => r.status === 'discovered')).toBe(true)
  })

  it('ok=true 且发现表已有同模型 ⇒ 不重复插', async () => {
    hoisted.accountRows = [{ providerCode: 'trae' }]
    hoisted.discoveryRows = [{ id: 'd1', modelId: 'step-3', status: 'discovered' }]
    upstreamByProvider.set('trae', { ok: true, ids: ['step-3'] })
    const result = await syncRelayPoolModelDiscovery()
    expect(result.modelsDiscovered).toBe(0)
    expect(hoisted.insertedRows).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
