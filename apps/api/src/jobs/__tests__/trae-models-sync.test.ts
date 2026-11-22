// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// trae-models-sync 行为锁(2026-11-19):trae 反代上游模型自动上架任务的判据钉死。
// 样板:ops-retention-cleanup.test.ts(cron 形态 + start/stop 幂等 + index.ts 接线)
//      + ai-world-sync.test.ts(db 链式桩:每一环返回同一可迭代数组)。
// 判据不在本文件复算上游拉取(fetchUpstreamModelIdsForProvider 是号池适配器,由其自身测试钉),
// 本文件只钉:上游清单→逐条 upsert→跨上游去重这条链的编排、错误隔离、去重逻辑与调度接线。
//
// db 链式桩要点(照 ai-world-sync.test.ts):
//   select() 查询构造器兼容两种消费形态 ——
//   · syncTraeModels 父表查询走 await db.select().from().where().orderBy().limit(1) 取 [config]
//   · dedupTraeModelsInDb 子表查询走 for..of await db.select().from().where().orderBy() 直接遍历 rows
//   因此让 select/from/where/orderBy/limit 每一环都返回同一个「可迭代数组」,绝不逃逸到真实 drizzle-orm
//   (逃逸会因表对象是字符串桩而栈溢出)。每用例用 fromResults.push(父表行) / push(子表行)
//   按顺序排入 sync 的两次 select 结果。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { mockSchedule, mockStop, mockFetchUpstream, fromResults, insertReturning, mockDb } =
  vi.hoisted(() => {
    // select().from(table) 用「结果队列」分发:syncTraeModels 每轮固定两次 select ——
    //   ① 父表 ai_model_config 查 config 行(await 取数组)
    //   ② 子表 ai_model_config_models 遍历(dedupTraeModelsInDb for..of)
    // 测试用 fromResults.push(父表数组, 子表数组) 依次压入;队列空返回 []。
    //
    // 链式方法挂在【原型】而非数组自身:data 的自有属性只有数据元素,
    // drizzle orderSelectedFields 的 Object.entries 只见数据元素,绝不递归进方法 ⇒ 不栈溢出。
    // 每一环(from/where/orderBy/limit)都返回可迭代数组,保证 await + 解构 + for..of 三种消费都成立。
    const fromResults: unknown[][] = []
    const insertReturning = vi.fn()
    // 链式方法用 Object.defineProperties 挂为【非枚举】自有属性:
    //  · 保留 Array.prototype ⇒ Symbol.iterator 存在 ⇒ for..of / const [x]=... 解构都成立
    //  · 非枚举 ⇒ drizzle orderSelectedFields 的 Object.entries 看不见方法 ⇒ 不栈溢出
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
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({ returning: insertReturning })),
          returning: insertReturning,
        })),
      })),
      select: vi.fn(() => ({ from: mockFrom })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
      })),
    }
    // relay-account-pool-service 顶部 import 了 dbRead(其内含 fetchUpstreamModelIdsForProvider);
    // 测试里 fetchUpstreamModelIdsForProvider 已被整模块 mock 替换,但 service 模块仍会被 import
    // 求值,需给 dbRead 桩(同用 mockDb 即可,因测试不真正调它的 dbRead 路径)。
    mockDb.dbRead = mockDb
    return {
      mockSchedule: vi.fn(),
      mockStop: vi.fn(),
      mockFetchUpstream: vi.fn(),
      fromResults,
      insertReturning,
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
  // db/index.ts 顶层要 createReadWriteDb/buildPoolOptions 等真实导出求值;
  // 保留全部真实导出,只覆盖 syncTraeModels 引用的两张表对象(桩成带列键的对象)。
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    aiModelConfigModels: {
      configId: 'config_id',
      modelId: 'model_id',
      id: 'id',
      enabled: 'enabled',
    },
    aiModelConfig: { id: 'id', providerCode: 'provider_code' },
  }
})
vi.mock('../services/relay-account-pool-service.js', () => ({
  fetchUpstreamModelIdsForProvider: mockFetchUpstream,
}))
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  syncTraeModels,
  startTraeModelsScheduler,
  stopTraeModelsScheduler,
} from '../trae-models-sync.js'

afterEach(() => {
  // 模块作用域 scheduledTask 跨用例残留:每轮收尾显式停表(照抄 ops-retention-cleanup.test.ts)
  stopTraeModelsScheduler()
  vi.clearAllMocks()
  fromResults.length = 0
})

describe('syncTraeModels — 编排与早退分支', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertReturning.mockReturnValue([])
    fromResults.length = 0
  })

  it('非法 provider code 直接早退,不碰 db / 不拉上游', async () => {
    const r = await syncTraeModels({ upstreamCode: 'not-a-platform' })
    expect(r.fetchOk).toBe(false)
    expect(r.configId).toBeNull()
    expect(r.errors[0]).toContain('not a relay provider code')
    expect(mockFetchUpstream).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('父表无该平台 config 行 → 早退,不拉上游', async () => {
    fromResults.length = 0 // 父表查询落空
    const r = await syncTraeModels({ upstreamCode: 'trae' })
    expect(r.configId).toBeNull()
    expect(r.errors[0]).toContain('no ai_model_config row')
  })

  it('上游 ok=false → 安全跳过,不误判、不写库(configId 仍带出)', async () => {
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: false, ids: [] }),
    })
    expect(r.fetchOk).toBe(false)
    expect(r.configId).toBe(48)
    expect(r.errors[0]).toContain('ok=false')
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('上游抛异常 → 记 fetch failed,fetchOk=false', async () => {
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => {
        throw new Error('HTTP 500')
      },
    })
    expect(r.fetchOk).toBe(false)
    expect(r.errors[0]).toContain('HTTP 500')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

describe('syncTraeModels — upsert 与逐条失败隔离', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 父表命中(id=48);dedup 在 sync 尾部跑,各用例按需 push 第二次(子表)结果
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    insertReturning.mockReturnValue([])
  })

  it('全部新增 → inserted=条数,exists=0', async () => {
    insertReturning.mockReturnValue([{ id: 1 }]) // 冲突未命中 = 新增
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x', 'gpt-y'] }),
    })
    expect(r.fetchOk).toBe(true)
    expect(r.upstreamModelCount).toBe(2)
    expect(r.inserted).toBe(2)
    expect(r.exists).toBe(0)
    expect(r.failed).toBe(0)
  })

  it('已存在(onConflict 命中 returning 空)→ 计 exists 不计 inserted', async () => {
    insertReturning.mockReturnValue([]) // 冲突命中 = 已存在
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x'] }),
    })
    expect(r.inserted).toBe(0)
    expect(r.exists).toBe(1)
  })

  it('单条 write 抛错只计 failed 并继续后续条(不整批中断)', async () => {
    const attempted: string[] = []
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['a-ok', 'a-boom', 'b-ok'] }),
      write: async (_configId, modelId) => {
        attempted.push(modelId)
        if (modelId === 'a-boom') throw new Error('db write failed')
        return 'inserted'
      },
    })
    expect(attempted).toEqual(['a-ok', 'a-boom', 'b-ok']) // 失败不中断后续
    expect(r.inserted).toBe(2)
    expect(r.failed).toBe(1)
    expect(r.errors[0]).toContain('a-boom')
    expect(r.errors[0]).toContain('db write failed')
  })

  it('串行写入:同一时刻只有一条 write 在飞(无并发)', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['m1', 'm2', 'm3'] }),
      write: async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        try {
          await new Promise((res) => setTimeout(res, 5))
          return 'inserted'
        } finally {
          inFlight--
        }
      },
    })
    expect(r.inserted).toBe(3)
    expect(maxInFlight).toBe(1) // 串行,绝不并发
  })

  it('dedup 阶段读的是 upsert 后的子表(父表 config 行不被误当下架候选)', async () => {
    insertReturning.mockReturnValue([{ id: 9 }])
    // 追加第二次 select(dedup 子表)结果:父表行已由 beforeEach 压入队首
    fromResults.push([
      { id: 1, modelId: 'gpt-x', enabled: true },
      { id: 2, modelId: 'gpt-x', enabled: true },
    ])
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x'] }),
    })
    expect(r.inserted).toBe(1)
    expect(r.deduped).toBe(1) // gpt-x id=2 重复被下架
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })
})

describe('syncTraeModels — 跨上游去重', () => {
  it('同 model_id 重复行:保留最早(最小 id),其余置 enabled=false', async () => {
    // 第1次 select = 父表;第2次 = dedup 子表(gpt-x 有 id=1,3 两条 enabled 重复)
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    fromResults.push([
      { id: 1, modelId: 'gpt-x', enabled: true },
      { id: 2, modelId: 'gpt-y', enabled: true },
      { id: 3, modelId: 'gpt-x', enabled: true },
    ])
    insertReturning.mockReturnValue([{ id: 9 }])
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: ['gpt-x'] }),
    })
    expect(r.deduped).toBe(1) // 只下架 id=3 那条重复
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('已下架(enabled=false)的行不参与去重,不被再次触碰', async () => {
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    fromResults.push([
      { id: 1, modelId: 'gpt-x', enabled: true },
      { id: 3, modelId: 'gpt-x', enabled: false }, // 已下架,跳过
    ])
    insertReturning.mockReturnValue([])
    const r = await syncTraeModels({
      upstreamCode: 'trae',
      fetchUpstream: async () => ({ ok: true, ids: [] }),
    })
    expect(r.deduped).toBe(0)
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('调度器 — cron 形态 + 成对 start/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSchedule.mockReturnValue({ stop: mockStop })
  })

  it('start 注册每 6 小时(30 */6 * * *)Asia/Shanghai 的一枚 cron', () => {
    startTraeModelsScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(1)
    expect(mockSchedule.mock.calls[0]![0]).toBe('30 */6 * * *')
    expect(mockSchedule.mock.calls[0]![2]).toEqual({ timezone: 'Asia/Shanghai' })
  })

  it('ENABLE_TRAE_MODEL_SYNC=false 时 start 不注册任何 cron', () => {
    const prev = process.env.ENABLE_TRAE_MODEL_SYNC
    process.env.ENABLE_TRAE_MODEL_SYNC = 'false'
    try {
      startTraeModelsScheduler()
      expect(mockSchedule).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env.ENABLE_TRAE_MODEL_SYNC
      else process.env.ENABLE_TRAE_MODEL_SYNC = prev
    }
  })

  it('cron 回调跑一轮 syncTraeModels;失败被 try/catch 吞掉不抛', async () => {
    fromResults.length = 0
    fromResults.push([{ id: 48, providerCode: 'trae' }])
    fromResults.push([]) // dedup 子表空
    insertReturning.mockReturnValue([{ id: 1 }])
    startTraeModelsScheduler()
    const tick = mockSchedule.mock.calls[0]![1] as () => Promise<void>
    await expect(tick()).resolves.toBeUndefined() // 回调内部吞异常,绝不向外抛
  })

  it('重复 start 不再加第二枚计时器;stop 停表后可再起', () => {
    startTraeModelsScheduler()
    startTraeModelsScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(1)
    stopTraeModelsScheduler()
    expect(mockStop).toHaveBeenCalledTimes(1)
    startTraeModelsScheduler()
    expect(mockSchedule).toHaveBeenCalledTimes(2)
  })
})

describe('启动/关闭路径接线(装车判据)', () => {
  const indexSrc = readFileSync(fileURLToPath(new URL('../../index.ts', import.meta.url)), 'utf8')

  it('index.ts 在 startBackgroundSchedulers 里注册 startTraeModelsScheduler', () => {
    const from = indexSrc.indexOf('function startBackgroundSchedulers')
    const next = indexSrc.indexOf('\nasync function', from)
    const scoped = indexSrc.slice(from, next === -1 ? indexSrc.length : next)
    expect(from).toBeGreaterThan(-1)
    expect(scoped).toContain('startTraeModelsScheduler()')
    expect(indexSrc).toContain("from './jobs/trae-models-sync.js'")
  })

  it('index.ts 的 shutdown 相位清单里有 stopTraeModelsScheduler', () => {
    expect(indexSrc).toContain("syncStopPhase('stopTraeModelsScheduler', stopTraeModelsScheduler)")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
