// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * listUserPoolModels 连通过滤单测(2026-11-11):交集 + 健康 down + ok=false 降级。
 * 零真实网络/数据库:drizzle 链式 mock(join=预置行 / 其余=账号行)+ 假 trae 适配器。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── db mock:join 查询供预置登记行,其余供账号行(与 relay-account-forwarder.test 同套路)──
let presetRows: Array<{ providerCode: string; modelId: string; displayName: string }> = []
let accountRows: unknown[] = []

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    const flags = { join: false }
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    step.innerJoin = vi.fn(() => {
      flags.join = true
      return step
    })
    return withSettlers(step, () => (flags.join ? presetRows : accountRows))
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'returning', 'values', 'set', 'where']) {
      step[m] = vi.fn(() => step)
    }
    return withSettlers(step, () => [])
  }
  return {
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

// config 打桩:REDIS_URL 指死端口 ⇒ shared-state 走内存兜底,绝不碰真实 Redis
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  isProductionGuard: false,
}))

vi.mock('../src/services/relay-proxy-pool.js', () => ({
  pickProxyForAccount: async () => null,
  reportProxyFailure: async () => {},
  reportProxySuccess: async () => {},
  resolveAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
  encryptAccountProxyUrl: (plain: string | null | undefined) => plain ?? null,
  maskAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
}))

vi.mock('undici', () => ({
  ProxyAgent: class {
    close(): void {}
  },
  Agent: class {
    constructor(_opts?: unknown) {}
    close(): void {}
  },
  fetch: vi.fn(),
}))

import {
  listUserPoolModels,
  poolModelHiddenReason,
} from '../src/services/relay-account-pool-service.js'
import {
  normalizePoolUpstreamModelId,
  recordModelNotFound,
  resetPoolModelHealthForTest,
} from '../src/services/relay-pool-model-health.js'
import {
  registerRelayAdapter,
  type RelayModelListResult,
  type RelayUpstreamAdapter,
} from '../src/services/relay-upstream-adapters.js'
import { registerAllRelayAdapters } from '../src/services/upstream-adapters/index.js'

// 先把真实适配器注册完(registerAllRelayAdapters 进程内一次性),再覆盖 trae 为假清单适配器,
// 之后 fetchUpstreamModelIds 内部的 registerAllRelayAdapters() 是 no-op,不会顶掉假适配器。
registerAllRelayAdapters()
let detailedResult: RelayModelListResult = { ok: false }
let detailedCalls = 0
registerRelayAdapter({
  providerCode: 'trae',
  buildChatRequest: () => {
    throw new Error('本文件只测清单过滤,不发 chat')
  },
  translateStreamChunk: () => null,
  translateNonStream: (_c, b) => b as Record<string, unknown>,
  checkHealth: async () => ({ ok: true }),
  isAuthFailure: () => false,
  listModelsDetailed: async () => {
    detailedCalls += 1
    return detailedResult
  },
} as unknown as RelayUpstreamAdapter)

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000)
function poolAccount(id: string): unknown {
  return {
    id,
    providerCode: 'trae',
    uid: `uid-${id}`,
    name: `测试号-${id}`,
    ownerUserId: 'u-filter',
    tokenEnc: 'enc:tok',
    refreshTokenEnc: 'enc:rt',
    cookiesEnc: null,
    secretsEnc: null,
    deviceId: null,
    machineId: null,
    tokenExpiresAt: FUTURE,
    refreshExpiresAt: null,
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'healthy',
    healthCheckedAt: null,
    lastErrorMessage: null,
    lastUsedAt: null,
    lastRefreshAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    proxyUrl: null,
    totalCalls: 0,
    extraMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

beforeEach(() => {
  presetRows = []
  accountRows = [poolAccount('acct-filter')]
  detailedResult = { ok: false }
  detailedCalls = 0
  resetPoolModelHealthForTest()
})

describe('listUserPoolModels 连通过滤', () => {
  it('ok=false(取不到清单):预置照出,不做交集 —— 取不到 ≠ 没模型', async () => {
    presetRows = [{ providerCode: 'trae', modelId: 'Doubao-A', displayName: '豆包A' }]
    const items = await listUserPoolModels('u-take-none')
    expect(items.map((m) => m.id)).toEqual(['Doubao-A'])
    expect(items[0].source).toBe('preset')
    expect(detailedCalls).toBe(1)
  })

  it('ok=true:上游清单不含的下架预置被交集隐藏,在册预置照出', async () => {
    presetRows = [
      { providerCode: 'trae', modelId: 'Doubao-A', displayName: '豆包A' },
      { providerCode: 'trae', modelId: 'GLM-Dead', displayName: '已下架' },
    ]
    detailedResult = { ok: true, models: [{ id: 'Doubao-A' }] }
    const items = await listUserPoolModels('u-intersect')
    expect(items.map((m) => m.id)).toEqual(['Doubao-A'])
  })

  it('裸名与 `<平台>/` 前缀双形态归一比对:不误杀、不重复', async () => {
    // 登记行用带前缀形态(qoder 式),上游清单报裸名:归一后同值,预置照出且不追加第二条
    presetRows = [{ providerCode: 'trae', modelId: 'trae/GLM-4', displayName: 'GLM4' }]
    detailedResult = { ok: true, models: [{ id: 'glm-4' }] }
    const items = await listUserPoolModels('u-dual-shape')
    expect(items.map((m) => m.id)).toEqual(['trae/GLM-4'])
    expect(items[0].source).toBe('preset')
  })

  it('健康 down:预置与上游条目都隐藏', async () => {
    presetRows = [{ providerCode: 'trae', modelId: 'Doubao-A', displayName: '豆包A' }]
    detailedResult = { ok: true, models: [{ id: 'Doubao-A' }, { id: 'NewOne' }] }
    recordModelNotFound('trae', 'trae/Doubao-A')
    recordModelNotFound('trae', 'doubao-a')
    const items = await listUserPoolModels('u-down')
    // 预置 Doubao-A 被 down 隐藏;同名上游条目按既有去重不再追加;NewOne 照出
    expect(items.map((m) => m.id)).toEqual(['trae/NewOne'])
  })

  it('上游独有模型照旧追加(source=upstream)', async () => {
    detailedResult = { ok: true, models: [{ id: 'NewOne' }] }
    const items = await listUserPoolModels('u-upstream-only')
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('trae/NewOne')
    expect(items[0].name).toBe('NewOne')
    expect(items[0].source).toBe('upstream')
    expect(items[0].provider).toBe('trae')
  })

  it('缓存命中沿用上一轮 ok 与清单:不再打上游', async () => {
    presetRows = [
      { providerCode: 'trae', modelId: 'Doubao-A', displayName: '豆包A' },
      { providerCode: 'trae', modelId: 'GLM-Dead', displayName: '已下架' },
    ]
    detailedResult = { ok: true, models: [{ id: 'Doubao-A' }] }
    const first = await listUserPoolModels('u-cache')
    expect(first.map((m) => m.id)).toEqual(['Doubao-A'])
    expect(detailedCalls).toBe(1)
    // 清单在缓存 TTL 内:第二轮命中缓存,不触上游;即便本轮上游改口也沿用旧结论
    detailedResult = { ok: false }
    const second = await listUserPoolModels('u-cache')
    expect(detailedCalls).toBe(1)
    expect(second.map((m) => m.id)).toEqual(['Doubao-A'])
  })
})

describe('poolModelHiddenReason(纯函数过滤判定)', () => {
  it('upstreamSet=null 免交集;判据异常 fail-open', () => {
    expect(poolModelHiddenReason('trae', 'any-model', null)).toBeNull()
  })

  it('集合未含 → intersection;前缀/裸名/大小写归一后命中 → null', () => {
    const set = new Set(['glm-4'])
    expect(poolModelHiddenReason('trae', 'Doubao-A', set)).toBe('intersection')
    expect(poolModelHiddenReason('trae', 'trae/GLM-4', set)).toBeNull()
    expect(poolModelHiddenReason('trae', 'GLM-4', set)).toBeNull()
  })

  it('down 结论优先于交集之外的显示(预置与上游都过健康闸)', () => {
    const set = new Set(['glm-4'])
    recordModelNotFound('trae', 'glm-4')
    expect(poolModelHiddenReason('trae', 'trae/GLM-4', set)).toBeNull() // 单次不 down
    recordModelNotFound('trae', 'glm-4')
    expect(poolModelHiddenReason('trae', 'GLM-4', set)).toBe('down')
    expect(poolModelHiddenReason('trae', 'glm-4', null)).toBe('down')
  })

  it('归一函数与判定共用:同一模型两套形态结论一致', () => {
    expect(normalizePoolUpstreamModelId('trae', 'trae/GLM-4')).toBe(
      normalizePoolUpstreamModelId('trae', 'GLM-4'),
    )
  })
})
