// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-368 回归锁(2026-11-13)。
 *
 * 病灶:relay-channel-router 的 sessionAffinity 清理定时器原在模块顶层 if 块内启动,
 * import 即创建;worker 经 buildServer() 加载全部路由(admin/relay-channels)也会
 * import 到它 ⇒ API 与 worker 各持一份清理器,worker 侧纯浪费。
 *
 * 本席票权内的修法(与已合入的 F-367 生命周期形态同型):
 *   ① 启动收敛为幂等命名出口 startRelayChannelRouterSweep(),API 侧仍由模块加载
 *      自动启动(逐字节零回归,不引入「忘了 start 导致 affinity 内存不清理」的半成品);
 *   ② worker 入口 worker-entry.ts 在 buildServer() 之后显式 stopRelayChannelRouterSweep()
 *      关闭 worker 侧定时器;src/index.ts 关停相位本就调 stop,两侧对称不再双跑。
 *
 * 本文件锁:
 *   ① 模块导出的 start/stop 均为函数;import 时恰创建 1 个 10min 定时器(API 侧保底,零回归);
 *   ② start 幂等:已有定时器时重复调用不叠加;
 *   ③ stop 清掉定时器且幂等,停后可再 start 恢复;
 *   ④ 源码锁:worker 入口在 buildServer() 之后调 stop、不显式 start;API 入口关停相位配对 stop。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / crypto / quota(对齐
 * f-179-relay-key-decrypt-isolation.test.ts),不触达真实 PG / Redis。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDbReadSelect, mockCheckQuota, mockDecryptJSON } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockCheckQuota: vi.fn(),
  mockDecryptJSON: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  registerPoolTrackerCleanup: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  // 2026-11-19 补:上游导出里新增 users,手抄 mock 缺它 ⇒ 模块加载期整片崩。
  // 纯表身份桩(列对象按属性名缓存,保证 eq(users.id) 两次取值同引用)。
  users: new Proxy({} as Record<string, unknown>, {
    get: (cache, prop) =>
      (cache[prop as string] ??= { name: String(prop), toString: () => String(prop) }),
  }),
  aiModelConfig: {
    id: 'id',
    providerCode: 'provider_code',
    baseUrl: 'base_url',
    enabled: 'enabled',
  },
  aiModelConfigModels: {
    modelId: 'model_id',
    configId: 'config_id',
    enabled: 'enabled',
    isRelayPublic: 'is_relay_public',
  },
  aiRelayKeyPool: {
    id: 'id',
    apiKeyEnc: 'api_key_enc',
    providerCode: 'provider_code',
    weight: 'weight',
    isEnabled: 'is_enabled',
    tempUnschedulable: 'temp_unschedulable',
    extraMetadata: 'extra_metadata',
  },
  aiRelayChannelGroups: {
    id: 'id',
    name: 'name',
    loadBalanceStrategy: 'load_balance_strategy',
    enabled: 'enabled',
    priority: 'priority',
  },
  aiRelayChannelGroupMembers: {
    id: 'id',
    groupId: 'group_id',
    keyPoolId: 'key_pool_id',
    weight: 'weight',
  },
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn(),
  decryptJSON: mockDecryptJSON,
}))

vi.mock('../src/services/channel-quota-service.js', () => ({
  checkQuota: mockCheckQuota.mockResolvedValue({ allowed: true }),
}))

const here = path.dirname(fileURLToPath(import.meta.url))
const MODULE_PATH = '../src/services/relay-channel-router.js'
const SWEEP_INTERVAL_MS = 10 * 60 * 1000

/** 只声明本用例用到的两个生命周期函数,避免 import() 类型注解。 */
interface SweepModule {
  startRelayChannelRouterSweep: () => void
  stopRelayChannelRouterSweep: () => void
}

let mod: SweepModule | undefined
let setIntervalSpy: ReturnType<typeof vi.spyOn>
let clearIntervalSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.resetModules()
  mod = undefined
  setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
  clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
})

afterEach(() => {
  mod?.stopRelayChannelRouterSweep()
  vi.restoreAllMocks()
})

describe('F-368 relay-channel-router 亲和性清理定时器生命周期', () => {
  it('① import 导出 start/stop,import 本身不自启,显式 start 恰创建 1 个 10min 定时器', async () => {
    mod = await import(MODULE_PATH)
    expect(typeof mod.startRelayChannelRouterSweep).toBe('function')
    expect(typeof mod.stopRelayChannelRouterSweep).toBe('function')
    // F-368:定时器不再模块级自启 —— API 入口显式 start,worker 侧不持有
    expect(setIntervalSpy).not.toHaveBeenCalled()
    mod.startRelayChannelRouterSweep()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(SWEEP_INTERVAL_MS)
    expect(setIntervalSpy.mock.calls[0]?.[0]).toBeTypeOf('function')
  })

  it('② start 幂等:已有定时器时重复调用不叠加', async () => {
    mod = await import(MODULE_PATH)
    mod.startRelayChannelRouterSweep()
    mod.startRelayChannelRouterSweep()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('③ stop 清掉定时器且幂等,停后可再 start 恢复', async () => {
    mod = await import(MODULE_PATH)
    mod.startRelayChannelRouterSweep()
    const timer = setIntervalSpy.mock.results[0]?.value

    mod.stopRelayChannelRouterSweep()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy.mock.calls[0]?.[0]).toBe(timer)

    // 重复 stop 不再产生 clearInterval 调用
    mod.stopRelayChannelRouterSweep()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

    mod.startRelayChannelRouterSweep()
    expect(setIntervalSpy).toHaveBeenCalledTimes(2)
  })

  it('④ worker 入口在 buildServer() 后显式 stop、不显式 start;API 入口关停相位配对', () => {
    const workerSrc = readFileSync(path.join(here, '..', 'src', 'worker-entry.ts'), 'utf8')
    const indexSrc = readFileSync(path.join(here, '..', 'src', 'index.ts'), 'utf8')

    // worker 侧:buildServer() 加载路由后关闭,且不显式启动(与 F-367 同型)
    expect(workerSrc).toMatch(/await buildServer\(\)[\s\S]{0,400}stopRelayChannelRouterSweep\(\)/)
    expect(workerSrc).not.toMatch(/startRelayChannelRouterSweep/)

    // API 侧:既有关停相位仍调用 stop(只读核对,不在本席改动范围)
    expect(indexSrc).toMatch(/stopRelayChannelRouterSweep/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
