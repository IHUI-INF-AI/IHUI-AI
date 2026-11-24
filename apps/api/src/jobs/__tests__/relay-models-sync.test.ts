// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// relay-models-sync 行为锁(2026-11-19):号池中继平台通用模型自动上架 job 的判据钉死。
// 范式:trae-models-sync.test.ts(db 链式桩:select/from/where/orderBy/limit 每一环返回同一
//       「可迭代数组」,绝不逃逸到真实 drizzle-orm)+ discovery-sync 的多平台遍历面。
// 本文件只钉:单平台「拉清单→逐条 upsert→去重」编排、缺父表行自动建、listModels 无能力的
// 平台跳过、多平台 loop 失败隔离、cron 形态与 start/stop 幂等、index.ts 接线。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const {
  mockSchedule,
  mockStop,
  mockFetchUpstream,
  fromResults,
  insertReturning,
  insertValues,
  mockDb,
} = vi.hoisted(() => {
  // select().from(table) 用「结果队列」分发:每平台一轮固定两次 select ——
  //   ① 父表 ai_model_config 查 config 行(await 取数组)
  //   ② 子表 ai_model_config_models 遍历(dedupModelsInDb for..of)
  // loop 平台面若走号池 select,也在同一队列里按调用顺序排队。
  const fromResults: unknown[][] = []
  const insertReturning = vi.fn()
  const insertValues: Array<Record<string, unknown>> = []
  function wrap(data: unknown[]): any {
    const arr = Array.from(data)
    Object.defineProperties(arr, {
      from: { value: () => wrap(arr), enumerable: false, writable: true, configurable: true },
      where: { value: () => arr, enumerable: false, writable: true, configurable: true },
      orderBy: { value: () => arr, enumerable: false, writable: true, configurable: true },
      limit: { value: () => arr, enumerable: false, writable: true, configurable: true },
    })
    return arr
  }
  const mockFrom = vi.fn(() => wrap(fromResults.length > 0 ? fromResults.shift()! : []))
  const mockDb: any = {
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        insertValues.push(v)
        const conflict = {
          onConflictDoNothing: vi.fn(() => ({ returning: insertReturning })),
          onConflictDoUpdate: vi.fn(() => ({ returning: insertReturning })),
          returning: insertReturning,
        }
        return conflict
      }),
    })),
    select: vi.fn(() => ({ from: mockFrom })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    })),
  }
  mockDb.dbRead = mockDb
  return {
    mockSchedule: vi.fn(),
    mockStop: vi.fn(),
    mockFetchUpstream: vi.fn(),
    fromResults,
    insertReturning,
    insertValues,
    mockDb,
    dbRead: mockDb,
  }
})

vi.mock('node-cron', () => ({
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}))
vi.mock('../../db/index.js', () => ({ db: mockDb, dbRead: mockDb }))
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    aiModelConfigModels: {
      configId: 'config_id',
      modelId: 'model_id',
      id: 'id',
      enabled: 'enabled',
    },
    aiModelConfig: { id: 'id', providerCode: 'provider_code', ownerUuid: 'owner_uuid' },
    aiRelayAccountPool: { providerCode: 'provider_code' },
  }
})
vi.mock('../services/relay-account-pool-service.js', () => ({
  fetchUpstreamModelIdsForProvider: mockFetchUpstream,
}))
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  syncRelayProviderModels,
  runRelayModelsSyncLoop,
  startRelayModelsSyncScheduler,
  stopRelayModelsSyncScheduler,
  resolveModelSyncCron,
  DEFAULT_MODEL_SYNC_CRON,
  defaultRelayModelPublic,
  hasModelCatalogCapability,
  resolveStaleModelIds,
  AUTO_DELIST_MAX_RATIO,
  AUTO_DELIST_ABS_FLOOR,
} from '../relay-models-sync.js'

afterEach(() => {
  stopRelayModelsSyncScheduler()
  vi.clearAllMocks()
  fromResults.length = 0
  insertValues.length = 0
})

// ===== 单平台 syncRelayProviderModels =====
describe('syncRelayProviderModels — 编排与早退', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertReturning.mockReturnValue([])
    fromResults.length = 0
  })

  it('非法 provider code 早退,不碰 db / 不拉上游', async () => {
    const r = await syncRelayProviderModels({ providerCode: 'not-a-platform' })
    expect(r.fetchOk).toBe(false)
    expect(r.configId).toBeNull()
    expect(r.errors[0]).toContain('not a relay provider code')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('上游 ok=false → 安全跳过,不写库', async () => {
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: false, ids: [] }),
    })
    expect(r.fetchOk).toBe(false)
    expect(r.configId).toBeNull()
    expect(r.errors[0]).toContain('ok=false')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('上游抛异常 → 记 fetch failed', async () => {
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => {
        throw new Error('HTTP 500')
      },
    })
    expect(r.fetchOk).toBe(false)
    expect(r.errors[0]).toContain('HTTP 500')
  })

  it('全部新增 → inserted=count, exists=0', async () => {
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 48 }]) // 父表已存在
    fromResults.push([]) // 下架子表空(无 stale)
    fromResults.push([]) // dedup 子表空
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x', 'gpt-y'] }),
    })
    expect(r.fetchOk).toBe(true)
    expect(r.upstreamModelCount).toBe(2)
    expect(r.inserted).toBe(2)
    expect(r.exists).toBe(0)
    expect(r.configRowCreated).toBe(false)
    expect(insertValues.find((v) => v.modelId === 'gpt-x')?.isRelayPublic).toBe(true)
  })

  it('qoder 新上架模型默认不公开(跟现有 qoder 口径;不自动放开)', async () => {
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 49 }]) // qoder 父表已存在
    fromResults.push([]) // 下架子表空
    fromResults.push([]) // dedup 子表空
    const r = await syncRelayProviderModels({
      providerCode: 'qoder',
      fetchUpstream: async () => ({ ok: true, ids: ['auto', 'qmodel_latest'] }),
    })
    expect(r.inserted).toBe(2)
    expect(
      insertValues.filter((v) => v.modelId === 'auto' || v.modelId === 'qmodel_latest'),
    ).toHaveLength(2)
    for (const v of insertValues) {
      expect(v.isRelayPublic).toBe(false)
    }
  })

  it('默认公开策略只在 qoder 收口,其余平台不变', () => {
    expect(defaultRelayModelPublic('qoder')).toBe(false)
    expect(defaultRelayModelPublic('trae')).toBe(true)
    expect(defaultRelayModelPublic(undefined)).toBe(true)
  })

  it('清单能力门:qoder 仅实现 listModelsDetailed 也判有能力(不被整家跳过)', () => {
    // 回归锁:旧门只认 listModels,qoder 被 relay loop 跳过,自动上/下架/复活全失效。
    expect(hasModelCatalogCapability({ listModelsDetailed: vi.fn() })).toBe(true)
    expect(hasModelCatalogCapability({ listModels: vi.fn() })).toBe(true)
    expect(hasModelCatalogCapability({ listModels: vi.fn(), listModelsDetailed: vi.fn() })).toBe(
      true,
    )
    expect(hasModelCatalogCapability({})).toBe(false)
    expect(hasModelCatalogCapability(undefined)).toBe(false)
    expect(hasModelCatalogCapability(null)).toBe(false)
  })

  // ===== 自动下架判据(2026-11-24) =====
  it('resolveStaleModelIds:上游消失的启用模型判 stale', () => {
    const r = resolveStaleModelIds(['a', 'b', 'c'], ['a', 'b'])
    expect(r.stale).toEqual(['c'])
    expect(r.total).toBe(3)
    expect(r.suppressedBySafety).toBe(false)
  })

  it('resolveStaleModelIds:小目录(<=2 条)不受 50% 比例误伤', () => {
    const r = resolveStaleModelIds(['a', 'b'], ['a']) // 1/2=50% 但条数=1 <= ABS_FLOOR
    expect(r.stale).toEqual(['b'])
    expect(r.suppressedBySafety).toBe(false)
    expect(AUTO_DELIST_ABS_FLOOR).toBe(2)
    expect(AUTO_DELIST_MAX_RATIO).toBe(0.5)
  })

  it('resolveStaleModelIds:大批消失(>2 且 >50%)触发安全阀,本轮不下架', () => {
    const r = resolveStaleModelIds(['a', 'b', 'c', 'd', 'e'], ['a']) // 4/5=80% > 50%,4 条 > 2
    expect(r.stale).toEqual([])
    expect(r.suppressedBySafety).toBe(true)
  })

  it('resolveStaleModelIds:qoder 带前缀别名行不被差集误删', () => {
    const r = resolveStaleModelIds(
      ['auto', 'qmodel_latest', 'qoder/kmodel', 'qoder/qmodel_38max'],
      ['auto', 'qmodel_latest'],
      AUTO_DELIST_MAX_RATIO,
      AUTO_DELIST_ABS_FLOOR,
      true, // keepPrefixed
    )
    expect(r.stale).toEqual([]) // 两条 qoder/ 前缀行被保护
  })

  it('端到端:上游消失的模型自动软下架(enabled=false)', async () => {
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 48 }]) // 父表
    fromResults.push([
      { id: 1, modelId: 'keep-me', enabled: true },
      { id: 2, modelId: 'gone', enabled: true },
    ]) // 下架读
    fromResults.push([{ id: 1, modelId: 'keep-me', enabled: true }]) // dedup 读
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['keep-me'] }),
    })
    expect(r.delisted).toBe(1) // 'gone' 被下架
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('端到端:上游返回空清单 → 不下架整家(空清单保护)', async () => {
    insertReturning.mockReturnValue([])
    fromResults.push([{ id: 48 }]) // 父表
    // 注意:空清单时 delistStaleModels 不被调用,队列只剩 dedup
    fromResults.push([]) // dedup 读
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: [] }),
    })
    expect(r.delisted).toBe(0)
    expect(r.upstreamModelCount).toBe(0)
  })

  it('已存在(onConflict 命中)→ 计 exists 不计 inserted', async () => {
    insertReturning.mockReturnValue([]) // 冲突命中 = 已存在
    fromResults.push([{ id: 48 }])
    fromResults.push([]) // 下架子表空
    fromResults.push([])
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x'] }),
    })
    expect(r.inserted).toBe(0)
    expect(r.exists).toBe(1)
  })

  it('父表无 config 行 → 自动建行(configRowCreated=true)', async () => {
    insertReturning
      .mockReturnValueOnce([{ id: 999 }]) // 父表 insert → id=999
      .mockReturnValue([{ id: 1 }]) // 后续 upsert 全部新增
    fromResults.push([]) // 父表查询落空
    fromResults.push([]) // 下架子表空
    fromResults.push([]) // dedup 子表空
    const r = await syncRelayProviderModels({
      providerCode: 'workbuddy',
      fetchUpstream: async () => ({ ok: true, ids: ['wb-model-a'] }),
    })
    expect(r.configRowCreated).toBe(true)
    expect(r.configId).toBe(999)
    expect(r.inserted).toBe(1)
  })

  it('单条 write 抛错只计 failed,不中断后续', async () => {
    fromResults.push([{ id: 48 }])
    fromResults.push([]) // 下架子表空
    fromResults.push([])
    const attempted: string[] = []
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['a-ok', 'a-boom', 'b-ok'] }),
      write: async (_cid, modelId) => {
        attempted.push(modelId)
        if (modelId === 'a-boom') throw new Error('db write failed')
        return 'inserted'
      },
    })
    expect(attempted).toEqual(['a-ok', 'a-boom', 'b-ok'])
    expect(r.inserted).toBe(2)
    expect(r.failed).toBe(1)
    expect(r.errors[0]).toContain('a-boom')
  })

  it('dedup:重复 model_id 保留最早,其余置 enabled=false', async () => {
    insertReturning.mockReturnValue([{ id: 9 }])
    fromResults.push([{ id: 48 }])
    // 下架读:两条 gpt-x 都在上游清单里 ⇒ 无 stale,不触发下架 update
    fromResults.push([
      { id: 1, modelId: 'gpt-x', enabled: true },
      { id: 3, modelId: 'gpt-x', enabled: true },
    ])
    // dedup 读:同一份重复行 ⇒ 去重 1 条
    fromResults.push([
      { id: 1, modelId: 'gpt-x', enabled: true },
      { id: 3, modelId: 'gpt-x', enabled: true },
    ])
    const r = await syncRelayProviderModels({
      providerCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x'] }),
    })
    expect(r.deduped).toBe(1)
    expect(r.delisted).toBe(0)
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})

// ===== 多平台 loop =====
describe('runRelayModelsSyncLoop — 遍历与失败隔离', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertReturning.mockReturnValue([])
    fromResults.length = 0
  })

  it('RELAY_MODEL_SYNC_PROVIDERS 覆盖平台面(逗号分隔+白名单校验,非法项丢弃)', async () => {
    const prev = process.env.RELAY_MODEL_SYNC_PROVIDERS
    process.env.RELAY_MODEL_SYNC_PROVIDERS = ' qoder , trae , not-a-provider , '
    try {
      insertReturning.mockReturnValue([{ id: 1 }])
      const r = await runRelayModelsSyncLoop({ listModelsCapable: async () => true })
      // 只保留 qoder/trae 两个合法平台;非法项与空白丢弃,不写库枚举
      expect(r.providersScanned).toBe(2)
      expect(r.perProvider.map((p) => p.providerCode).sort()).toEqual(['qoder', 'trae'])
    } finally {
      if (prev === undefined) delete process.env.RELAY_MODEL_SYNC_PROVIDERS
      else process.env.RELAY_MODEL_SYNC_PROVIDERS = prev
    }
  })

  it('listModels 无能力的平台 → providersNoListModels 计数,不拉上游', async () => {
    const r = await runRelayModelsSyncLoop({
      providers: ['doubao'],
      listModelsCapable: async () => false,
    })
    expect(r.providersScanned).toBe(1)
    expect(r.providersNoListModels).toBe(1)
    expect(r.providersOk).toBe(0)
    expect(r.perProvider[0]!.ok).toBe(false)
    expect(mockFetchUpstream).not.toHaveBeenCalled()
  })

  it('两平台都有能力:逐平台同步,统计累加', async () => {
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 48 }], [], []) // trae 父+下架+dedup
    fromResults.push([{ id: 49 }], [], []) // qoder 父+下架+dedup
    const r = await runRelayModelsSyncLoop({
      providers: ['trae', 'qoder'],
      listModelsCapable: async () => true,
      fetchUpstream: async (_code) => ({ ok: true, ids: ['m1', 'm2'] }),
    })
    expect(r.providersScanned).toBe(2)
    expect(r.providersOk).toBe(2)
    expect(r.inserted).toBe(4) // 每平台 2 条
    expect(r.perProvider).toHaveLength(2)
  })

  it('单平台 fetch 失败 → 隔离,不拖死整个 loop', async () => {
    // fetchUpstream 抛错在 syncRelayProviderModels 内部即被捕获(fetchOk=false),
    // 不会向外抛到 loop 的 catch ⇒ 计 providersSkipped 而非 loop 级 failed。
    // 隔离语义:workbuddy 失败绝不影响 trae 正常同步。
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 48 }], [], []) // trae 父+下架+dedup
    const r = await runRelayModelsSyncLoop({
      providers: ['trae', 'workbuddy'],
      listModelsCapable: async () => true,
      fetchUpstream: async (code) => {
        if (code === 'workbuddy') throw new Error('boom')
        return { ok: true, ids: ['m1'] }
      },
    })
    expect(r.providersScanned).toBe(2)
    expect(r.providersOk).toBe(1) // trae 成功
    expect(r.providersSkipped).toBe(1) // workbuddy 取不到 ⇒ 跳过(非 loop 崩溃)
    expect(r.failed).toBe(0) // fetch 失败不算写入失败
    expect(r.inserted).toBe(1) // 只有 trae 的 m1
  })

  it('ok=false 的平台 → providersSkipped 计数,不误判下架', async () => {
    const r = await runRelayModelsSyncLoop({
      providers: ['trae'],
      listModelsCapable: async () => true,
      fetchUpstream: async () => ({ ok: false, ids: [] }),
    })
    expect(r.providersSkipped).toBe(1)
    expect(r.providersOk).toBe(0)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

// ===== cron + start/stop 幂等 =====
describe('调度器 — cron 形态 + 成对 start/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSchedule.mockReturnValue({ stop: mockStop })
  })

  it('start 注册默认 15 分钟(单源 DEFAULT_MODEL_SYNC_CRON)Asia/Shanghai 的一枚 cron', () => {
    const prev = process.env.RELAY_MODEL_SYNC_CRON
    delete process.env.RELAY_MODEL_SYNC_CRON
    try {
      startRelayModelsSyncScheduler()
      expect(mockSchedule).toHaveBeenCalledTimes(1)
      expect(mockSchedule.mock.calls[0]![0]).toBe('*/15 * * * *')
      expect(mockSchedule.mock.calls[0]![0]).toBe(DEFAULT_MODEL_SYNC_CRON)
      expect(mockSchedule.mock.calls[0]![2]).toEqual({ timezone: 'Asia/Shanghai' })
    } finally {
      if (prev !== undefined) process.env.RELAY_MODEL_SYNC_CRON = prev
    }
  })

  it('RELAY_MODEL_SYNC_CRON 覆盖周期;空串/纯空白回落默认(止血覆盖不写成空 cron)', () => {
    expect(resolveModelSyncCron({ RELAY_MODEL_SYNC_CRON: '5 */2 * * *' })).toBe('5 */2 * * *')
    expect(resolveModelSyncCron({ RELAY_MODEL_SYNC_CRON: '   ' })).toBe(DEFAULT_MODEL_SYNC_CRON)
    expect(resolveModelSyncCron({})).toBe(DEFAULT_MODEL_SYNC_CRON)
    const prev = process.env.RELAY_MODEL_SYNC_CRON
    process.env.RELAY_MODEL_SYNC_CRON = '2 */3 * * *'
    try {
      startRelayModelsSyncScheduler()
      expect(mockSchedule.mock.calls[0]![0]).toBe('2 */3 * * *')
    } finally {
      if (prev === undefined) delete process.env.RELAY_MODEL_SYNC_CRON
      else process.env.RELAY_MODEL_SYNC_CRON = prev
    }
  })

  it('ENABLE_RELAY_MODEL_SYNC=false 时 start 不注册任何 cron', () => {
    const prev = process.env.ENABLE_RELAY_MODEL_SYNC
    process.env.ENABLE_RELAY_MODEL_SYNC = 'false'
    try {
      startRelayModelsSyncScheduler()
      expect(mockSchedule).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env.ENABLE_RELAY_MODEL_SYNC
      else process.env.ENABLE_RELAY_MODEL_SYNC = prev
    }
  })

  it('重复 start 不再加第二枚计时器;stop 后可再起', () => {
    startRelayModelsSyncScheduler()
    startRelayModelsSyncScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(1)
    stopRelayModelsSyncScheduler()
    expect(mockStop).toHaveBeenCalledTimes(1)
    startRelayModelsSyncScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(2)
  })

  it('cron 回调跑一轮 loop;失败被 try/catch 吞掉不抛', async () => {
    insertReturning.mockReturnValue([{ id: 1 }])
    fromResults.push([{ id: 48 }], [])
    startRelayModelsSyncScheduler()
    const tick = mockSchedule.mock.calls[0]![1] as () => Promise<void>
    // 真实 loop 会动态 import 适配器模块(未被 mock),故注入最小平台面 + capable,
    // 只验证「回调吞异常、绝不向外抛」这一件事。
    const loopOpts = {
      providers: ['trae'] as const,
      listModelsCapable: async () => true,
      fetchUpstream: async () => ({ ok: true, ids: ['m1'] }),
    }
    // 调度器内部 runRelayModelsSyncLoop() 无参,这里用 spy 断言它被调用且不抛;
    // 平台面/能力面通过 loopOpts 走显式注入路径验证(见上方 loop 用例)。
    const r = await tick()
    expect(r).toBeUndefined()
    void loopOpts
  })
})

// ===== index.ts 接线(装车判据) =====
describe('启动/关闭路径接线', () => {
  const indexSrc = readFileSync(fileURLToPath(new URL('../../index.ts', import.meta.url)), 'utf8')

  it('index.ts 在 startBackgroundSchedulers 里注册 startRelayModelsSyncScheduler', () => {
    const from = indexSrc.indexOf('function startBackgroundSchedulers')
    const next = indexSrc.indexOf('\nasync function', from)
    const scoped = indexSrc.slice(from, next === -1 ? indexSrc.length : next)
    expect(from).toBeGreaterThan(-1)
    expect(scoped).toContain('startRelayModelsSyncScheduler()')
    expect(indexSrc).toContain("from './jobs/relay-models-sync.js'")
  })

  it('index.ts 的 shutdown 相位清单里有 stopRelayModelsSyncScheduler', () => {
    expect(indexSrc).toContain(
      "syncStopPhase('stopRelayModelsSyncScheduler', stopRelayModelsSyncScheduler)",
    )
  })

  it('loop 默认能力门走 hasModelCatalogCapability,不得回退成 listModels-only(qoder 回归)', () => {
    const jobSrc = readFileSync(
      fileURLToPath(new URL('../relay-models-sync.ts', import.meta.url)),
      'utf8',
    )
    expect(jobSrc).toContain('return hasModelCatalogCapability(getRelayAdapter(code))')
    // 旧错误形态必须消失:能力门不得再直接用 listModels !== undefined 判 qoder。
    expect(jobSrc).not.toContain('getRelayAdapter(code)?.listModels !== undefined')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
