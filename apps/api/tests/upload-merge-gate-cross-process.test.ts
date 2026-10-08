// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 分片上传合并闸「跨进程有界」收口票的回归(任务书 ①~⑤)。
// 全程离线:一律注入内存假 Redis(ZSET 语义的 Map),绝不真连库(§5 测试隔离铁律)。
import { describe, it, expect } from 'vitest'

import {
  createLayeredUploadMergeGate,
  UPLOAD_MERGE_ENV_KEY,
  UploadMergeStopFailedError,
  type UploadMergeNotice,
} from '../src/services/upload-merge-gate.js'
import {
  createRedisMergeSemaphore,
  MERGE_SEMAPHORE_ACQUIRE_LUA,
  MERGE_SEMAPHORE_RENEW_LUA,
  MERGE_SEMAPHORE_RELEASE_LUA,
  MERGE_SEMAPHORE_COUNT_LUA,
  MERGE_SEMAPHORE_QUARANTINE_WRITE_LUA,
  MERGE_SEMAPHORE_QUARANTINE_READ_LUA,
  type MergeSemaphoreRedis,
} from '../src/services/upload-merge-redis-semaphore.js'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 内存假 Redis:对六条 Lua 脚本各实现其语义(ZSET 五条 + 隔离记录 hash 两条共用 eval 通道)。
 *  业务判额逻辑只活在被测的脚本常量里,假 Redis 不重抄"要不要给槽"的判断,
 *  只按传入的 now/ttl/limit/token 演算 sorted-set。 */
function makeFakeRedis(): MergeSemaphoreRedis & { size(key: string): number } {
  const store = new Map<string, Map<string, number>>() // key -> (token -> expireAtScore)
  const hashes = new Map<string, Map<string, string>>() // key -> (field -> value)
  const set = (key: string): Map<string, number> => {
    let m = store.get(key)
    if (!m) {
      m = new Map()
      store.set(key, m)
    }
    return m
  }
  const setHash = (key: string): Map<string, string> => {
    let m = hashes.get(key)
    if (!m) {
      m = new Map()
      hashes.set(key, m)
    }
    return m
  }
  const purgeExpired = (m: Map<string, number>, now: number): void => {
    for (const [token, expireAt] of m) if (expireAt <= now) m.delete(token)
  }
  return {
    size: (key: string) => store.get(key)?.size ?? 0,
    async eval(_script: string, _numKeys: number, ...args: Array<string | number>): Promise<unknown> {
      const key = String(args[0])
      if (_script === MERGE_SEMAPHORE_QUARANTINE_WRITE_LUA) {
        // G-998089:HSET(field=slot token, value=JSON 隔离记录)
        setHash(key).set(String(args[1]), String(args[2]))
        return 1
      }
      if (_script === MERGE_SEMAPHORE_QUARANTINE_READ_LUA) {
        // G-998089:HGETALL 拍平成 [field, value, ...]
        const out: string[] = []
        for (const [f, v] of hashes.get(key) ?? []) out.push(f, v)
        return out
      }
      const m = set(key)
      if (_script === MERGE_SEMAPHORE_ACQUIRE_LUA) {
        const now = Number(args[1])
        const ttl = Number(args[2])
        const limit = Number(args[3])
        const token = String(args[4])
        purgeExpired(m, now)
        if (m.size < limit) {
          m.set(token, now + ttl)
          return [1, m.size]
        }
        return [0, m.size]
      }
      if (_script === MERGE_SEMAPHORE_RENEW_LUA) {
        const now = Number(args[1])
        const ttl = Number(args[2])
        const token = String(args[3])
        if (m.has(token)) {
          m.set(token, now + ttl)
          return 1
        }
        return 0
      }
      if (_script === MERGE_SEMAPHORE_RELEASE_LUA) {
        const token = String(args[1])
        const had = m.delete(token)
        return had ? 1 : 0
      }
      if (_script === MERGE_SEMAPHORE_COUNT_LUA) {
        purgeExpired(m, Number(args[1]))
        return m.size
      }
      throw new Error(`fake redis 收到未知脚本(可能脚本常量漂了)`)
    },
  }
}

describe('① 两个"进程"(两个闸实例共享同一个假 Redis)同时在跑,合并段峰值不超过上限', () => {
  it('limit=2 × 两闸各 3 路真并发:峰值受限于 2,全部成功,不拒绝', async () => {
    const fake = makeFakeRedis()
    const shared = { live: 0, peak: 0 }
    const mkGate = (owner: string) =>
      createLayeredUploadMergeGate({
        env: { [UPLOAD_MERGE_ENV_KEY]: '2', NODE_ENV: 'test' },
        redis: fake,
        pollIntervalMs: 4,
        leaseMs: 60_000,
        ownerToken: owner,
      })
    const gA = mkGate('procA')
    const gB = mkGate('procB')
    const body = async () => {
      shared.live += 1
      if (shared.live > shared.peak) shared.peak = shared.live
      await delay(12)
      shared.live -= 1
      return true
    }
    const tasks = [...Array(3).keys()].flatMap(() => [gA.runExclusive('a', body), gB.runExclusive('b', body)])
    const results = await Promise.allSettled(tasks)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect(shared.peak).toBeLessThanOrEqual(2) // 跨进程上限真的兜住了(两闸共享一份 Redis 状态)
    expect(shared.peak).toBe(2) // 也真跑到了 2 路 —— 闸没被误修成串行
    // 生效层必须是 redis(不是回落),且报得出跨进程占用读数。
    expect(gA.facts().activeLayer).toBe('redis')
    expect(gA.facts().layerReason).toBe('redis-active')
  })
})

describe('④ 变异对照:摘掉跨进程层 ⇒ ① 必红(两闸各限各的)', () => {
  it('同样两闸各 3 路,但不接 Redis(opts.redis 省略)⇒ 各限 2 ⇒ 全局峰值可到 4 > 2', async () => {
    const shared = { live: 0, peak: 0 }
    const mkGate = () =>
      createLayeredUploadMergeGate({
        env: { [UPLOAD_MERGE_ENV_KEY]: '2', NODE_ENV: 'test' },
        // 没有 redis ⇒ 层叠闸纯透传进程内闸,两闸互不知晓。
      })
    const gA = mkGate()
    const gB = mkGate()
    const body = async () => {
      shared.live += 1
      if (shared.live > shared.peak) shared.peak = shared.live
      await delay(12)
      shared.live -= 1
    }
    const tasks = [...Array(3).keys()].flatMap(() => [gA.runExclusive('a', body), gB.runExclusive('b', body)])
    await Promise.allSettled(tasks)
    // 这正是"进程内闸在多实例部署下各限 N"的旧故障形态 —— ① 的 ≤上限断言在摘层后必翻红。
    expect(shared.peak).toBeGreaterThan(2)
    expect(shared.peak).toBe(4)
    expect(gA.facts().activeLayer).toBe('in-process')
    expect(gA.facts().layerReason).toBe('redis-unconfigured')
  })
})

describe('② Redis 抛错 ⇒ 回落进程内闸、首次 warn、facts 报出降级原因(不得静默通过)', () => {
  it('provider 解析成功但首次 EVAL 抛错:落 in-process、degraded-to-in-process warn、reason 点名错误', async () => {
    const notices: UploadMergeNotice[] = []
    const broken: MergeSemaphoreRedis = {
      async eval(): Promise<unknown> {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8811')
      },
    }
    const gate = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '1', NODE_ENV: 'test' },
      redis: broken,
      pollIntervalMs: 4,
      leaseMs: 60_000,
      notify: (n) => notices.push(n),
    })
    // 即便降级,业务仍应成功(排队不拒绝),由进程内闸兜住。
    expect(await gate.runExclusive('m', async () => 'ok')).toBe('ok')
    const f = gate.facts()
    expect(f.activeLayer).toBe('in-process')
    expect(f.layerReason).toContain('redis-error')
    expect(f.layerReason).toContain('ECONNREFUSED')
    expect(f.redisFailures).toBeGreaterThanOrEqual(1)
    const deg = notices.filter((n) => n.event === 'degraded-to-in-process')
    expect(deg.length).toBe(1) // 首次立即喊
    expect(deg[0].level).toBe('warn')
    // 第二次取用不再重复喊(已 latch 降级,回落内层),但失败计数只在真正 EVAL 抛错那一次 +1。
    expect(await gate.runExclusive('m2', async () => 'ok2')).toBe('ok2')
    expect(notices.filter((n) => n.event === 'degraded-to-in-process')).toHaveLength(1)
  })
})

describe('③ owner 租约到期后槽位可被复用(模拟崩溃不留永久占位)', () => {
  it('limit=1:持有者不 release,时钟推进过租约后,另一持有者能占到槽', async () => {
    const fake = makeFakeRedis()
    let clock = 1_000_000
    const sem = createRedisMergeSemaphore({ redis: fake, key: 'k', limit: 1, leaseMs: 100, now: () => clock })
    const a = await sem.acquire('ownerA:1')
    expect(a.granted).toBe(true)
    // 未释放(模拟进程崩溃):同一时刻再取必满。
    expect((await sem.acquire('ownerB:1')).granted).toBe(false)
    // 租约到期后(崩溃进程不再续租),僵尸槽被自动清掉,槽位复用。
    clock += 101
    const b = await sem.acquire('ownerB:1')
    expect(b.granted).toBe(true)
    expect(b.active).toBe(1)
    // owner token 语义:release 只能解自己的锁,不误删别人的槽。
    await sem.release('ownerA:1') // ownerA 早被 purge,这里 no-op
    expect((await sem.count())).toBe(1) // ownerB 仍在
    await sem.release('ownerB:1')
    expect(await sem.count()).toBe(0)
  })
})

describe('⑤ env=0 ⇒ 两层都报 unlimited 且各有喊话', () => {
  it('进程内层(不接 redis):unlimited + warn unlimited-mode,并发不设界', async () => {
    const notices: UploadMergeNotice[] = []
    const gate = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '0', NODE_ENV: 'test' },
      notify: (n) => notices.push(n),
    })
    await Promise.all([gate.runExclusive('a', async () => delay(6)), gate.runExclusive('b', async () => delay(6))])
    const un = notices.filter((n) => n.event === 'unlimited-mode')
    expect(un.length).toBeGreaterThanOrEqual(1)
    expect(un[0].level).toBe('warn')
    expect(gate.facts()).toMatchObject({ unlimited: true, effectiveLimit: null, limitSource: 'env-unlimited' })
  })
  it('跨进程层(redis):unlimited 走外层自己喊,两层互不遮蔽', async () => {
    const fake = makeFakeRedis()
    const notices: UploadMergeNotice[] = []
    const gate = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '0', NODE_ENV: 'test' },
      redis: fake,
      notify: (n) => notices.push(n),
    })
    await gate.runExclusive('m', async () => 1)
    const un = notices.filter((n) => n.event === 'unlimited-mode')
    expect(un.length).toBeGreaterThanOrEqual(1)
    expect(un[0].level).toBe('warn')
    const f = gate.facts()
    expect(f.unlimited).toBe(true)
    expect(f.effectiveLimit).toBeNull()
    expect(f.limitSource).toBe('env-unlimited')
    expect(f.activeLayer).toBe('redis')
    expect(f.layerReason).toBe('redis-bypassed-unlimited')
    // Redis 侧一份没被占(unlimited 不判额、不取槽)。
    expect(fake.size('ihui:upload-merge:test:slots')).toBe(0)
  })
})

describe('⑥ G-998089 stop-failed:临界区失败但自有子资源未终态 ⇒ 先收口自有资源才放锁', () => {
  it('抛 UploadMergeStopFailedError ⇒ (a)租约仍在(第二进程拿不到)、(b)状态=stop-failed 终态而非 released;资源终态收口 ⇒ 释放成功且接管者读到隔离记录', async () => {
    const fake = makeFakeRedis()
    const notices: UploadMergeNotice[] = []
    // 第二个参与方(procA):在临界区内抛错,且它本次拉起的子资源尚未终态
    // ⇒ 释放前置条件(子资源终态 ∧ 通道已关)不成立 ⇒ 保锁不放。
    const gateA = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '1', NODE_ENV: 'test' },
      redis: fake,
      pollIntervalMs: 4,
      leaseMs: 60_000,
      ownerToken: 'procA',
      notify: (n) => notices.push(n),
    })
    const pending = ['core', 'control-server']
    await expect(
      gateA.runExclusive('merge', async () => {
        throw new UploadMergeStopFailedError(pending, '启动装配失败:core 未终态 ∧ control 通道未关')
      }),
    ).rejects.toBeInstanceOf(UploadMergeStopFailedError)

    // (a) 锁/租约仍在:第二个进程此刻拿不到槽(limit=1,A 未收口 ⇒ B 必满)。
    const semB = createRedisMergeSemaphore({
      redis: fake,
      key: 'ihui:upload-merge:test:slots',
      limit: 1,
      leaseMs: 60_000,
    })
    expect((await semB.acquire('procB:1')).granted).toBe(false)

    // (b) 状态字段是"待人工收口"类终态,而不是 released。
    const recA = gateA.facts().stopFailedRecords
    expect(recA).toHaveLength(1)
    expect(recA[0]?.state).toBe('stop-failed')
    expect(recA[0]?.state).not.toBe('released')
    expect(recA[0]?.pendingResources).toEqual(pending)
    expect(recA[0]?.owner).toBe('procA')
    expect(recA[0]?.label).toBe('merge')
    // 失败必须响:首次 stop-failed 立即 warn,不得静默保锁。
    const sf = notices.filter((n) => n.event === 'stop-failed')
    expect(sf).toHaveLength(1)
    expect(sf[0]?.level).toBe('warn')

    // 随后资源终态 ⇒ 人工收口:释放成功,状态推进为 released。
    expect(await gateA.closeoutStopFailed()).toBe(1)
    const after = gateA.facts().stopFailedRecords
    expect(after[0]?.state).toBe('released')
    expect(after[0]?.releasedAtMs).not.toBeNull()

    // 收口后接管者拿得到槽,且**跨进程**能读到前者的隔离记录(在共享 Redis 侧,不是失败方内存)。
    expect((await semB.acquire('procB:1')).granted).toBe(true)
    const quarantines = await semB.readQuarantines()
    const q = JSON.parse(quarantines['procA:1'] ?? 'null') as {
      owner: string
      label: string
      pendingResources: string[]
      state: string
    } | null
    expect(q).not.toBeNull()
    expect(q?.owner).toBe('procA')
    expect(q?.pendingResources).toEqual(pending)
    expect(q?.state).toBe('released')
  })

  it('对照:子资源已全部终态的正常失败(普通 Error)⇒ 照旧放锁,不留 stop-failed 记录', async () => {
    const fake = makeFakeRedis()
    const gate = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '1', NODE_ENV: 'test' },
      redis: fake,
      pollIntervalMs: 4,
      leaseMs: 60_000,
      ownerToken: 'procC',
    })
    await expect(gate.runExclusive('m', async () => { throw new Error('普通失败') })).rejects.toThrow('普通失败')
    expect(gate.facts().stopFailedRecords).toHaveLength(0)
    // 槽已放:下一个进程拿得到。
    const semNext = createRedisMergeSemaphore({
      redis: fake,
      key: 'ihui:upload-merge:test:slots',
      limit: 1,
      leaseMs: 60_000,
    })
    expect((await semNext.acquire('procD:1')).granted).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
