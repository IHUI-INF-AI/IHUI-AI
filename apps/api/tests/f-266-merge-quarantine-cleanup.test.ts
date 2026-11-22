// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-266 回归锁:合并隔离 hash 只有 HSET/HGETALL、无 HDEL/EXPIRE、读侧全量传输。
 *
 * 病灶:stop-failed ⇒ `quarantine(slotToken, payload)` 每次占用带自增后缀 ⇒ 字段名唯一且永不删除;
 * hash 无 TTL、收口成功不删、读侧 HGETALL 全量拉 ⇒ 长跑实例单调增长 + 传输量随存量放大。
 * 修法:写入带 TTL 与 zset 时间索引;读侧 HSCAN 游标分批;收口后 HDEL + ZREM;读侧惰性清理超窗。
 *
 * 全程离线:注入内存假 Redis(实现 hset/hscan/hgetall/hdel/zadd/zrem/zrangebyscore/expire 的
 * 最小语义并记录调用),绝不真连库(§5 测试隔离铁律)。
 */
import { readFileSync } from 'node:fs'

import { describe, it, expect } from 'vitest'

import {
  createLayeredUploadMergeGate,
  UPLOAD_MERGE_ENV_KEY,
  UploadMergeStopFailedError,
  type UploadMergeNotice,
} from '../src/services/upload-merge-gate.js'
import {
  createRedisMergeSemaphore,
  resolveUploadMergeSemaphoreKey,
  MERGE_SEMAPHORE_ACQUIRE_LUA,
  MERGE_SEMAPHORE_RENEW_LUA,
  MERGE_SEMAPHORE_RELEASE_LUA,
  MERGE_SEMAPHORE_COUNT_LUA,
  MERGE_SEMAPHORE_QUARANTINE_WRITE_LUA,
  MERGE_SEMAPHORE_QUARANTINE_INDEX_LUA,
  MERGE_SEMAPHORE_QUARANTINE_SCAN_LUA,
  MERGE_SEMAPHORE_QUARANTINE_READ_LUA,
  MERGE_SEMAPHORE_QUARANTINE_CLEAR_LUA,
  MERGE_SEMAPHORE_QUARANTINE_PURGE_LUA,
  UPLOAD_MERGE_QUARANTINE_RETENTION_MS,
  UPLOAD_MERGE_QUARANTINE_SCAN_COUNT,
  type MergeSemaphoreRedis,
} from '../src/services/upload-merge-redis-semaphore.js'

const ENV = { NODE_ENV: 'test' }
const SLOTS_KEY = resolveUploadMergeSemaphoreKey(ENV)
const HASH_KEY = `${SLOTS_KEY}:quarantine`
const INDEX_KEY = `${SLOTS_KEY}:quarantine:index`
const RETENTION_SEC = Math.ceil(UPLOAD_MERGE_QUARANTINE_RETENTION_MS / 1000)

interface Call {
  cmd: string
  key: string
  args: string[]
}

interface FakeRedis extends MergeSemaphoreRedis {
  calls: Call[]
  resetCalls(): void
  hashOf(key: string): Map<string, string>
  zsetOf(key: string): Map<string, number>
  ttlOf(key: string): number | undefined
  countCmd(cmd: string): number
}

/** 内存假 Redis:按被测脚本常量演算其语义,并把每条命令记进 calls ——
 *  "hgetall 未被调用 / hscan 被调用 / hdel+zrem 被调用"这些锁都靠它取证。 */
function makeFakeRedis(): FakeRedis {
  const hashes = new Map<string, Map<string, string>>()
  const zsets = new Map<string, Map<string, number>>()
  const ttls = new Map<string, number>()
  const calls: Call[] = []

  const hashOf = (key: string): Map<string, string> => {
    let m = hashes.get(key)
    if (!m) {
      m = new Map()
      hashes.set(key, m)
    }
    return m
  }
  const zsetOf = (key: string): Map<string, number> => {
    let m = zsets.get(key)
    if (!m) {
      m = new Map()
      zsets.set(key, m)
    }
    return m
  }
  const record = (cmd: string, key: string, args: string[]): void => {
    calls.push({ cmd, key, args })
  }

  return {
    calls,
    resetCalls: () => {
      calls.length = 0
    },
    hashOf,
    zsetOf,
    ttlOf: (key) => ttls.get(key),
    countCmd: (cmd) => calls.filter((c) => c.cmd === cmd).length,
    async eval(
      script: string,
      _numKeys: number,
      ...rawArgs: Array<string | number>
    ): Promise<unknown> {
      const args = rawArgs.map(String)
      const key = args[0] ?? ''
      const arg = (i: number): string => args[i] ?? ''

      if (script === MERGE_SEMAPHORE_QUARANTINE_WRITE_LUA) {
        const field = arg(1)
        const value = arg(2)
        record('hset', key, [field, value])
        hashOf(key).set(field, value)
        record('expire', key, [arg(3)])
        ttls.set(key, Number(arg(3)))
        return 1
      }

      if (script === MERGE_SEMAPHORE_QUARANTINE_INDEX_LUA) {
        const score = arg(1)
        const field = arg(2)
        record('zadd', key, [score, field])
        zsetOf(key).set(field, Number(score))
        record('expire', key, [arg(3)])
        ttls.set(key, Number(arg(3)))
        return 1
      }

      if (script === MERGE_SEMAPHORE_QUARANTINE_SCAN_LUA) {
        record('hscan', key, [arg(1), arg(2)])
        const entries = [...hashOf(key).entries()]
        const start = Number(arg(1))
        const count = Math.max(1, Number(arg(2)))
        const slice = entries.slice(start, start + count)
        const next = start + count >= entries.length ? '0' : String(start + count)
        return [next, slice.flat()]
      }

      if (script === MERGE_SEMAPHORE_QUARANTINE_READ_LUA) {
        record('hgetall', key, [])
        return [...hashOf(key).entries()].flat()
      }

      if (script === MERGE_SEMAPHORE_QUARANTINE_CLEAR_LUA) {
        const indexKey = arg(1)
        const field = arg(2)
        record('hdel', key, [field])
        hashOf(key).delete(field)
        record('zrem', indexKey, [field])
        zsetOf(indexKey).delete(field)
        return 1
      }

      if (script === MERGE_SEMAPHORE_QUARANTINE_PURGE_LUA) {
        const indexKey = arg(1)
        const cutoff = Number(arg(2))
        record('zrangebyscore', indexKey, [arg(2)])
        const index = zsetOf(indexKey)
        const stale: string[] = []
        for (const [field, score] of index) if (score <= cutoff) stale.push(field)
        for (const field of stale) {
          record('hdel', key, [field])
          hashOf(key).delete(field)
          record('zrem', indexKey, [field])
          index.delete(field)
        }
        return stale.length
      }

      const slots = zsetOf(key)
      if (script === MERGE_SEMAPHORE_ACQUIRE_LUA) {
        const now = Number(arg(1))
        const ttl = Number(arg(2))
        const limit = Number(arg(3))
        const token = arg(4)
        for (const [member, expireAt] of slots) if (expireAt <= now) slots.delete(member)
        if (slots.size < limit) {
          slots.set(token, now + ttl)
          return [1, slots.size]
        }
        return [0, slots.size]
      }
      if (script === MERGE_SEMAPHORE_RENEW_LUA) {
        const token = arg(3)
        if (slots.has(token)) {
          slots.set(token, Number(arg(1)) + Number(arg(2)))
          return 1
        }
        return 0
      }
      if (script === MERGE_SEMAPHORE_RELEASE_LUA) {
        return slots.delete(arg(1)) ? 1 : 0
      }
      if (script === MERGE_SEMAPHORE_COUNT_LUA) {
        const now = Number(arg(1))
        for (const [member, expireAt] of slots) if (expireAt <= now) slots.delete(member)
        return slots.size
      }

      throw new Error('fake redis 收到未知脚本(脚本常量可能漂了)')
    },
  }
}

describe('① quarantine 写入:hash 带 TTL,zset 时间索引同步登记', () => {
  it('写入后 EXPIRE 覆盖 hash 与索引,索引 score = 写入时间戳', async () => {
    const fake = makeFakeRedis()
    const clock = 1_700_000_000_000
    const sem = createRedisMergeSemaphore({
      redis: fake,
      key: SLOTS_KEY,
      limit: 1,
      leaseMs: 1_000,
      now: () => clock,
    })

    await sem.quarantine('procA:1', JSON.stringify({ owner: 'procA', state: 'stop-failed' }))

    expect(fake.hashOf(HASH_KEY).get('procA:1')).toContain('stop-failed')
    expect(fake.zsetOf(INDEX_KEY).get('procA:1')).toBe(clock)
    expect(fake.ttlOf(HASH_KEY)).toBe(RETENTION_SEC)
    expect(fake.ttlOf(INDEX_KEY)).toBe(RETENTION_SEC)
    expect(fake.countCmd('expire')).toBe(2)
  })
})

describe('② 读取走 HSCAN 游标分批,不再全量 HGETALL', () => {
  it('150 条记录:HSCAN 多批读全、数据完整,hgetall 零调用', async () => {
    const fake = makeFakeRedis()
    const sem = createRedisMergeSemaphore({ redis: fake, key: SLOTS_KEY, limit: 1, leaseMs: 1_000 })
    const total = UPLOAD_MERGE_QUARANTINE_SCAN_COUNT * 2 + 22
    for (let i = 0; i < total; i += 1) await sem.quarantine(`tok-${i}`, JSON.stringify({ i }))
    fake.resetCalls()

    const out = await sem.readQuarantines()

    expect(Object.keys(out)).toHaveLength(total)
    expect(out['tok-0']).toBe(JSON.stringify({ i: 0 }))
    expect(out[`tok-${total - 1}`]).toBe(JSON.stringify({ i: total - 1 }))
    // 修复前读侧只有 HGETALL ⇒ 这两条断言必红(hscan 零调用、hgetall 一次)。
    expect(fake.countCmd('hgetall')).toBe(0)
    expect(fake.countCmd('hscan')).toBeGreaterThan(1)
  })
})

describe('③ 收口成功:HDEL + ZREM 清掉隔离字段与时间索引', () => {
  it('stop-failed 后 closeoutStopFailed ⇒ 字段与索引成员都被删,槽位释放', async () => {
    const fake = makeFakeRedis()
    const notices: UploadMergeNotice[] = []
    const gate = createLayeredUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '1', ...ENV },
      redis: fake,
      pollIntervalMs: 4,
      leaseMs: 60_000,
      ownerToken: 'procQ',
      notify: (n) => notices.push(n),
    })

    await expect(
      gate.runExclusive('merge', async () => {
        throw new UploadMergeStopFailedError(['core'], 'core 未终态')
      }),
    ).rejects.toBeInstanceOf(UploadMergeStopFailedError)

    // 保锁期间记录在 Redis 侧(字段=slot token),且此时还没有任何删除动作。
    expect(fake.hashOf(HASH_KEY).has('procQ:1')).toBe(true)
    expect(fake.zsetOf(INDEX_KEY).has('procQ:1')).toBe(true)
    expect(fake.countCmd('hdel')).toBe(0)

    expect(await gate.closeoutStopFailed()).toBe(1)

    expect(fake.countCmd('hdel')).toBe(1)
    expect(fake.countCmd('zrem')).toBe(1)
    expect(fake.hashOf(HASH_KEY).has('procQ:1')).toBe(false)
    expect(fake.zsetOf(INDEX_KEY).has('procQ:1')).toBe(false)
    expect(notices.filter((n) => n.event === 'stop-failed')).toHaveLength(1)
  })
})

describe('④ 读侧惰性清理:只删超窗条目,窗内条目与无索引老存量保留', () => {
  it('早于保留窗口的记录被 HDEL+ZREM,窗内记录与老存量仍可读', async () => {
    const fake = makeFakeRedis()
    let clock = 1_700_000_000_000
    const sem = createRedisMergeSemaphore({
      redis: fake,
      key: SLOTS_KEY,
      limit: 1,
      leaseMs: 1_000,
      now: () => clock,
    })

    await sem.quarantine('old', JSON.stringify({ state: 'stop-failed' }))
    clock += UPLOAD_MERGE_QUARANTINE_RETENTION_MS + 1_000
    await sem.quarantine('fresh', JSON.stringify({ state: 'stop-failed' }))
    // 老实例留下的、zset 里没有索引的字段:必须仍能读到(兼容存量),不得被误删。
    fake.hashOf(HASH_KEY).set('legacy-no-index', JSON.stringify({ state: 'stop-failed' }))
    fake.resetCalls()

    const out = await sem.readQuarantines()

    expect(fake.countCmd('zrangebyscore')).toBe(1)
    expect(out).not.toHaveProperty('old')
    expect(out).toHaveProperty('fresh')
    expect(out).toHaveProperty('legacy-no-index')
    expect(fake.hashOf(HASH_KEY).has('old')).toBe(false)
    expect(fake.zsetOf(INDEX_KEY).has('old')).toBe(false)
    expect(fake.hashOf(HASH_KEY).has('fresh')).toBe(true)
    expect(fake.zsetOf(INDEX_KEY).has('fresh')).toBe(true)
  })
})

describe('⑤ Redis 抛错:隔离记录读写降级,不抛新错', () => {
  it('quarantine 与 readQuarantines 均 resolve(不 reject)', async () => {
    const broken: MergeSemaphoreRedis = {
      async eval(): Promise<unknown> {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8811')
      },
    }
    const sem = createRedisMergeSemaphore({
      redis: broken,
      key: SLOTS_KEY,
      limit: 1,
      leaseMs: 1_000,
    })

    await expect(sem.quarantine('t', '{}')).resolves.toBeUndefined()
    await expect(sem.readQuarantines()).resolves.toEqual({})
  })
})

describe('⑥ 源锁:读侧不再出现 HGETALL 调用', () => {
  it('semaphore 源文件不含小写 hgetall( 调用,且 HSCAN 在册', () => {
    const src = readFileSync(
      new URL('../src/services/upload-merge-redis-semaphore.ts', import.meta.url),
      'utf8',
    )
    expect(src.includes('hgetall(')).toBe(false)
    expect(src.includes("'HSCAN'")).toBe(true)
  })
})
