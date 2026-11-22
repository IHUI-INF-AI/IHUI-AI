// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-shared-state 单测(2026-10-22 多实例 Redis 协同改造)。
 * 零真实 Redis:vi.mock('ioredis') 提供内存假客户端(支持 failMode 模拟 Redis 故障),
 * 同一套断言覆盖「Redis 优先」与「内存兜底」两档。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 假 ioredis:Map 存储 + PX/EX/NX/MGET/EVAL(compare-del)/SCAN 语义 ──
const fake = vi.hoisted(() => {
  interface Entry {
    value: string
    expiresAt: number // Infinity = 永不过期
  }
  const data = new Map<string, Entry>()
  const state = { failMode: false }
  const live = (key: string): Entry | null => {
    const e = data.get(key)
    if (!e) return null
    if (e.expiresAt <= Date.now()) {
      data.delete(key)
      return null
    }
    return e
  }
  const guard = (): void => {
    if (state.failMode) throw new Error('mock redis is down')
  }
  class FakeIORedis {
    status = 'ready'
    on(): void {}
    quit(): Promise<string> {
      return Promise.resolve('OK')
    }
    async set(key: string, value: string, ...args: unknown[]): Promise<string | null> {
      guard()
      let pxMs: number | undefined
      let nx = false
      for (let i = 0; i < args.length; i++) {
        const a = args[i]
        if (a === 'PX') pxMs = Number(args[++i])
        else if (a === 'EX') pxMs = Number(args[++i]) * 1000
        else if (a === 'NX') nx = true
      }
      if (nx && live(key)) return null
      data.set(key, { value, expiresAt: pxMs !== undefined ? Date.now() + pxMs : Infinity })
      return 'OK'
    }
    async get(key: string): Promise<string | null> {
      guard()
      return live(key)?.value ?? null
    }
    async mget(...keys: string[]): Promise<Array<string | null>> {
      guard()
      return keys.map((k) => live(k)?.value ?? null)
    }
    async del(...keys: string[]): Promise<number> {
      guard()
      let n = 0
      for (const k of keys) if (data.delete(k)) n++
      return n
    }
    async eval(script: string, _numKeys: number, ...args: unknown[]): Promise<number> {
      guard()
      // 仅需覆盖 LOCK_RELEASE_SCRIPT:get 比对 token 后 del
      if (script.includes("redis.call('del'")) {
        const key = String(args[0])
        const token = String(args[1])
        const e = live(key)
        if (e && e.value === token) {
          data.delete(key)
          return 1
        }
        return 0
      }
      return 0
    }
    async scan(
      _cursor: string,
      _matchKeyword?: string,
      pattern?: string,
      _countKeyword?: string,
      _count?: number,
    ): Promise<[string, string[]]> {
      guard()
      const prefix = pattern && pattern.endsWith('*') ? pattern.slice(0, -1) : ''
      const keys: string[] = []
      for (const k of data.keys()) {
        if (live(k) && (!prefix || k.startsWith(prefix))) keys.push(k)
      }
      return ['0', keys]
    }
  }
  return { FakeIORedis, data, state }
})

vi.mock('ioredis', () => ({ default: fake.FakeIORedis }))
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

import {
  __test__ as sharedState,
  clearAccountCooldown,
  getAccountsInCooldown,
  getSessionAffinity,
  setAccountCooldown,
  setSessionAffinity,
  tryAcquireSharedLock,
} from '../src/services/relay-account-shared-state.js'

beforeEach(async () => {
  fake.state.failMode = false
  await sharedState.reset()
})

describe('relay-account-shared-state — 账号冷却', () => {
  it('Redis 档:set 冷却 → 批量读命中;未冷却/未知号不命中', async () => {
    expect(sharedState.backend()).toBe('redis')
    await setAccountCooldown('acct-1', Date.now() + 60_000)
    const cooling = await getAccountsInCooldown(['acct-1', 'acct-2'])
    expect(cooling.has('acct-1')).toBe(true)
    expect(cooling.has('acct-2')).toBe(false)
  })

  it('冷却到期自动失效(键 TTL 语义)', async () => {
    await setAccountCooldown('acct-ttl', Date.now() + 30)
    expect((await getAccountsInCooldown(['acct-ttl'])).has('acct-ttl')).toBe(true)
    await new Promise((r) => setTimeout(r, 60))
    expect((await getAccountsInCooldown(['acct-ttl'])).has('acct-ttl')).toBe(false)
  })

  it('clear 解除冷却;对过去时间戳的 set 等价解除', async () => {
    await setAccountCooldown('acct-c', Date.now() + 60_000)
    await clearAccountCooldown('acct-c')
    expect((await getAccountsInCooldown(['acct-c'])).has('acct-c')).toBe(false)
    await setAccountCooldown('acct-c', Date.now() + 60_000)
    await setAccountCooldown('acct-c', Date.now() - 1)
    expect((await getAccountsInCooldown(['acct-c'])).has('acct-c')).toBe(false)
  })

  it('Redis 故障 ⇒ 内存兜底,行为一致且不抛错', async () => {
    fake.state.failMode = true
    await setAccountCooldown('acct-m', Date.now() + 60_000)
    expect((await getAccountsInCooldown(['acct-m'])).has('acct-m')).toBe(true)
    await clearAccountCooldown('acct-m')
    expect((await getAccountsInCooldown(['acct-m'])).has('acct-m')).toBe(false)
  })

  it('空输入直接返回空集(不打 Redis)', async () => {
    expect((await getAccountsInCooldown([])).size).toBe(0)
  })
})

describe('relay-account-shared-state — 会话亲和', () => {
  it('set/get 往返;后写覆盖先写(换号后亲和迁移)', async () => {
    await setSessionAffinity('key-1|model-a', 'acct-A', 60_000)
    expect(await getSessionAffinity('key-1|model-a')).toBe('acct-A')
    await setSessionAffinity('key-1|model-a', 'acct-B', 60_000)
    expect(await getSessionAffinity('key-1|model-a')).toBe('acct-B')
  })

  it('TTL 到期读出 null;未写入的键读出 null', async () => {
    await setSessionAffinity('key-2|model-a', 'acct-A', 30)
    await new Promise((r) => setTimeout(r, 60))
    expect(await getSessionAffinity('key-2|model-a')).toBeNull()
    expect(await getSessionAffinity('never|model-a')).toBeNull()
  })

  it('Redis 故障 ⇒ 内存兜底往返一致', async () => {
    fake.state.failMode = true
    await setSessionAffinity('key-3|model-a', 'acct-A', 60_000)
    expect(await getSessionAffinity('key-3|model-a')).toBe('acct-A')
  })
})

describe('relay-account-shared-state — 巡检分布式锁', () => {
  it('SET NX 语义:持锁期间第二获取返回 null;释放后可再获', async () => {
    const l1 = await tryAcquireSharedLock('sweep', 5_000)
    expect(l1).not.toBeNull()
    const l2 = await tryAcquireSharedLock('sweep', 5_000)
    expect(l2).toBeNull()
    expect(await l1!.release()).toBe(true)
    const l3 = await tryAcquireSharedLock('sweep', 5_000)
    expect(l3).not.toBeNull()
    await l3!.release()
  })

  it('不同锁名互不阻塞', async () => {
    const a = await tryAcquireSharedLock('sweep-a', 5_000)
    const b = await tryAcquireSharedLock('sweep-b', 5_000)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    await a!.release()
    await b!.release()
  })

  it('token 校验:锁值被篡改后 release 返回 false(不误删他人锁)', async () => {
    const l = await tryAcquireSharedLock('sweep-t', 5_000)
    expect(l).not.toBeNull()
    fake.data.set('relay:pool:lock:sweep-t', { value: 'someone-else', expiresAt: Infinity })
    expect(await l!.release()).toBe(false)
    // 被抢走的锁不该能被原持有者释放掉:键仍是新值
    expect(await tryAcquireSharedLock('sweep-t', 5_000)).toBeNull()
    fake.data.delete('relay:pool:lock:sweep-t')
  })

  it('租约 TTL 到期自动可再获(进程崩溃自愈)', async () => {
    const l = await tryAcquireSharedLock('sweep-exp', 30)
    expect(l).not.toBeNull()
    await new Promise((r) => setTimeout(r, 60))
    const l2 = await tryAcquireSharedLock('sweep-exp', 5_000)
    expect(l2).not.toBeNull()
    await l2!.release()
  })

  it('Redis 故障 ⇒ 内存锁兜底,同进程互斥仍成立', async () => {
    fake.state.failMode = true
    const l1 = await tryAcquireSharedLock('sweep-mem', 5_000)
    expect(l1).not.toBeNull()
    expect(await tryAcquireSharedLock('sweep-mem', 5_000)).toBeNull()
    expect(await l1!.release()).toBe(true)
    const l2 = await tryAcquireSharedLock('sweep-mem', 5_000)
    expect(l2).not.toBeNull()
    await l2!.release()
  })
})

describe('relay-account-shared-state — 测试出口', () => {
  it('reset 清空两面(冷却/亲和/锁)', async () => {
    await setAccountCooldown('r-1', Date.now() + 60_000)
    await setSessionAffinity('r-k', 'r-1', 60_000)
    const l = await tryAcquireSharedLock('r-lock', 60_000)
    expect(l).not.toBeNull()
    await sharedState.reset()
    expect((await getAccountsInCooldown(['r-1'])).size).toBe(0)
    expect(await getSessionAffinity('r-k')).toBeNull()
    expect(await tryAcquireSharedLock('r-lock', 1_000)).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
