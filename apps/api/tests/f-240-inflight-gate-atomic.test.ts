// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-240 回归锁(2026-11-13)。
 *
 * 病灶:全局在途闸先 INCR 再 PEXPIRE,两条独立命令。INCR 成功、PEXPIRE 抛错时,
 * catch 直接降级进程内计数 ⇒ Redis 与内存各占一次(双计数),键还留在无 TTL 状态;
 * 归还只减内存,Redis 计数永久偏高,全局并发上限被逐步蚕食。
 *
 * 本文件锁:
 *   ① PEXPIRE 抛错(无 EVAL 的两段式分支):先 DECR 回滚并清掉归零残键,再把错误
 *      交给降级路径;内存只占一次,不双计数,不留无 TTL 键;
 *   ② 原子路径:支持 EVAL 时一次脚本调用完成 INCR+PEXPIRE,不再有独立 incr/pexpire;
 *   ③ 正常占用:计数递增、TTL 续到安全网时长;超上限在脚本内回滚,计数不越加越高;
 *   ④ 释放路径不变:release 只减一次(幂等),键已被 TTL 清掉时不留下负值键。
 *
 * 只 mock ioredis + config,不触达真实 Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY_GLOBAL_INFLIGHT = 'relay:pool:inflight:global'

const fake = vi.hoisted(() => {
  interface Row {
    value: string
    expiresAt: number
  }
  const state = {
    data: new Map<string, Row>(),
    calls: [] as Array<{ cmd: string; args: unknown[] }>,
    /** 独立 PEXPIRE 故障注入(原子脚本内部不受影响) */
    pexpireFails: false,
    /** true = 模拟不支持 EVAL 的 Redis 代理,走两段式分支 */
    noEval: false,
  }
  const live = (key: string): Row | undefined => {
    const row = state.data.get(key)
    if (!row) return undefined
    if (row.expiresAt > 0 && row.expiresAt <= Date.now()) {
      state.data.delete(key)
      return undefined
    }
    return row
  }
  const incrRaw = (key: string): number => {
    const row = live(key)
    const next = row ? Number(row.value) + 1 : 1
    state.data.set(key, { value: String(next), expiresAt: row?.expiresAt ?? 0 })
    return next
  }
  const decrRaw = (key: string): number => {
    const row = live(key)
    const next = row ? Number(row.value) - 1 : -1
    state.data.set(key, { value: String(next), expiresAt: row?.expiresAt ?? 0 })
    return next
  }

  class FakeIORedis {
    status = 'ready'
    on(): void {}
    quit(): Promise<'OK'> {
      return Promise.resolve('OK')
    }

    get eval():
      ((script: string, numKeys: number, ...args: unknown[]) => Promise<number>) | undefined {
      if (state.noEval) return undefined
      return async (script: string, _numKeys: number, ...args: unknown[]): Promise<number> => {
        state.calls.push({ cmd: 'eval', args: [script, ...args] })
        if (script.includes("redis.call('incr'")) {
          const key = String(args[0])
          const ttlMs = Number(args[1])
          const cap = Number(args[2])
          const v = incrRaw(key)
          if (v > cap) {
            decrRaw(key)
            return 0
          }
          const row = live(key)
          if (row) row.expiresAt = Date.now() + ttlMs
          return v
        }
        if (script.includes("redis.call('decr'")) {
          const key = String(args[0])
          const v = decrRaw(key)
          if (v < 0) {
            state.data.delete(key)
            return 0
          }
          return v
        }
        return 0
      }
    }

    async incr(key: string): Promise<number> {
      state.calls.push({ cmd: 'incr', args: [key] })
      return incrRaw(key)
    }

    async decr(key: string): Promise<number> {
      state.calls.push({ cmd: 'decr', args: [key] })
      return decrRaw(key)
    }

    async del(...keys: string[]): Promise<number> {
      state.calls.push({ cmd: 'del', args: keys })
      let n = 0
      for (const k of keys) if (state.data.delete(k)) n++
      return n
    }

    async pexpire(key: string, ttlMs: number): Promise<number> {
      state.calls.push({ cmd: 'pexpire', args: [key, ttlMs] })
      if (state.pexpireFails) throw new Error('fake redis: pexpire 网络抖动')
      const row = live(key)
      if (!row) return 0
      row.expiresAt = Date.now() + ttlMs
      return 1
    }

    async scan(): Promise<[string, string[]]> {
      return ['0', [...state.data.keys()]]
    }
  }

  return { FakeIORedis, state }
})

vi.mock('ioredis', () => ({ default: fake.FakeIORedis }))
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

import {
  __test__ as sharedState,
  tryAcquireGlobalInflight,
} from '../src/services/relay-account-shared-state.js'
import { logger } from '../src/utils/logger.js'

beforeEach(async () => {
  fake.state.noEval = false
  fake.state.pexpireFails = false
  fake.state.data.clear()
  await sharedState.reset()
  fake.state.calls.length = 0
})

describe('F-240 全局在途闸 INCR+PEXPIRE 原子化', () => {
  it('PEXPIRE 抛错:先 DECR 回滚(归零删键)再如实报错,内存只占一次', async () => {
    fake.state.noEval = true
    fake.state.pexpireFails = true
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    try {
      const h = await tryAcquireGlobalInflight(5)
      expect(h).not.toBeNull()
      expect(h?.backend).toBe('memory')

      const cmds = fake.state.calls.map((c) => c.cmd)
      // incr 只发生一次:失败后不得再补一次计数
      expect(cmds.filter((c) => c === 'incr')).toHaveLength(1)
      expect(cmds).toEqual(['incr', 'pexpire', 'decr', 'del'])
      // 回滚后归零的键被删掉:不留无 TTL 残键
      expect(fake.state.data.has(KEY_GLOBAL_INFLIGHT)).toBe(false)
      // 降级只占一个内存坑(不是双计数)
      expect(sharedState.globalInflightMemory()).toBe(1)

      const logged = errSpy.mock.calls
        .map(([msg, meta]) => `${String(msg)} ${JSON.stringify(meta ?? {})}`)
        .join('\n')
      expect(logged).toContain('tryAcquireGlobalInflight')
      expect(logged).toContain('pexpire 网络抖动')

      await h?.release()
      expect(sharedState.globalInflightMemory()).toBe(0)
    } finally {
      errSpy.mockRestore()
    }
  })

  it('原子路径:一次 EVAL 完成 INCR+PEXPIRE,不再有独立 incr/pexpire 往返', async () => {
    // 独立 PEXPIRE 注入故障:仍能占坑 ⇒ 证明走的是脚本内原子路径
    fake.state.pexpireFails = true
    const h = await tryAcquireGlobalInflight(2)
    expect(h?.backend).toBe('redis')
    expect(fake.state.calls.map((c) => c.cmd)).toEqual(['eval'])
    expect(fake.state.calls[0]?.args.slice(1)).toEqual([
      KEY_GLOBAL_INFLIGHT,
      sharedState.globalInflightTtlMs(),
      2,
    ])
    const row = fake.state.data.get(KEY_GLOBAL_INFLIGHT)
    expect(row?.value).toBe('1')
    expect(Number(row?.expiresAt)).toBeGreaterThan(Date.now() + 60_000)
    expect(sharedState.globalInflightMemory()).toBe(0)
    await h?.release()
  })

  it('正常占用:计数递增且续安全网 TTL;超上限在脚本内回滚,计数不变', async () => {
    const ttl = sharedState.globalInflightTtlMs()
    const h1 = await tryAcquireGlobalInflight(2)
    const h2 = await tryAcquireGlobalInflight(2)
    expect(h1?.backend).toBe('redis')
    expect(h2?.backend).toBe('redis')
    const row = fake.state.data.get(KEY_GLOBAL_INFLIGHT)
    expect(row?.value).toBe('2')
    const remain = Number(row?.expiresAt) - Date.now()
    expect(remain).toBeGreaterThan(ttl - 5_000)
    expect(remain).toBeLessThanOrEqual(ttl)

    // 达上限:脚本内 INCR 后立即 DECR 并返回 0,计数回到 2
    expect(await tryAcquireGlobalInflight(2)).toBeNull()
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('2')
    expect(sharedState.globalInflightMemory()).toBe(0)

    await h1?.release()
    await h2?.release()
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('0')
  })

  it('释放路径不变:release 只减一次(幂等);键已被 TTL 清掉时不留下负值键', async () => {
    const h = await tryAcquireGlobalInflight(3)
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('1')

    await h?.release()
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('0')
    const releaseEvals = fake.state.calls.filter((c) => c.cmd === 'eval')
    expect(releaseEvals).toHaveLength(2) // acquire 1 次 + release 1 次,均为单条脚本
    await h?.release() // 幂等:同一 handle 不再二次扣减
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('0')

    const h2 = await tryAcquireGlobalInflight(3)
    fake.state.data.delete(KEY_GLOBAL_INFLIGHT) // 模拟 TTL 到期,键已被 Redis 清掉
    await h2?.release()
    expect(fake.state.data.has(KEY_GLOBAL_INFLIGHT)).toBe(false)
    expect(sharedState.globalInflightMemory()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
