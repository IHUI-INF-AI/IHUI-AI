// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import type { Redis } from 'ioredis'
import { createFailSafeRateLimitStore } from '../rate-limit-failsafe-store.js'

/** store 对外回调 */
type Cb = (err: Error | null, res?: { current: number; ttl: number }) => void
/** ioredis defineCommand 脚本回调:返回的是 [current, ttl] 元组 */
type RawCb = (err: Error | null, res?: [number, number]) => void

function asRedis(fake: unknown): Redis {
  return fake as unknown as Redis
}

/** Redis 正常:按调用次数递增,并把收到的键记下来。 */
function workingRedis(keys: string[] = []) {
  const state = { n: 0 }
  return asRedis({
    defineCommand: () => {},
    ihuiRateLimit: (key: string, tw: string, _m: string, _c: string, _e: string, cb: RawCb) => {
      keys.push(key)
      state.n += 1
      cb(null, [state.n, Number(tw)])
    },
    ihuiRateLimitRead: (key: string, cb: RawCb) => {
      keys.push(key)
      cb(null, [state.n, 1000])
    },
  })
}

/** Redis 故障:每个命令立刻失败(对应 enableOfflineQueue:false 的效果)。 */
function failingRedis(keys: string[] = []) {
  return asRedis({
    defineCommand: () => {},
    ihuiRateLimit: (key: string, _t: string, _m: string, _c: string, _e: string, cb: Cb) => {
      keys.push(key)
      cb(new Error('ECONNREFUSED'))
    },
    ihuiRateLimitRead: (key: string, cb: Cb) => {
      keys.push(key)
      cb(new Error('ECONNREFUSED'))
    },
  })
}

/** 回调是同步的,所以调用返回后 res 一定已就位。 */
function incrOnce(
  store: { incr: (k: string, cb: Cb, tw: number, max: number) => void },
  key: string,
  max = 3,
): number {
  let current = -1
  store.incr(
    key,
    (err, res) => {
      if (err) throw err
      current = res!.current
    },
    60_000,
    max,
  )
  return current
}

describe('createFailSafeRateLimitStore — Redis 正常路径', () => {
  it('计数来自 Redis', () => {
    const Store = createFailSafeRateLimitStore(workingRedis(), 'ihui:rl:')
    const store = new Store()
    expect(incrOnce(store, '1.1.1.1')).toBe(1)
    expect(incrOnce(store, '1.1.1.1')).toBe(2)
  })

  it('键带命名空间前缀', () => {
    const keys: string[] = []
    const Store = createFailSafeRateLimitStore(workingRedis(keys), 'ihui:rl:')
    incrOnce(new Store(), '2.2.2.2')
    expect(keys[0]).toBe('ihui:rl:2.2.2.2')
  })
})

describe('createFailSafeRateLimitStore — Redis 故障路径', () => {
  it('不回退成放行:本地计数继续增长,能超过 max', () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const store = new Store()
    const seen = [1, 2, 3, 4, 5].map(() => incrOnce(store, '3.3.3.3', 3))
    expect(seen).toEqual([1, 2, 3, 4, 5])
    // 超过 max 之后 current 仍继续增长 ⇒ 调用方判 429,而不是 fail-open 放行
    expect(seen.at(-1)!).toBeGreaterThan(3)
  })

  it('本地兜底按 IP 隔离', () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const store = new Store()
    expect(incrOnce(store, '4.4.4.4')).toBe(1)
    expect(incrOnce(store, '4.4.4.4')).toBe(2)
    expect(incrOnce(store, '5.5.5.5')).toBe(1)
  })

  it('read 在故障时回退本地读,不抛错', () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const store = new Store()
    let result: { current: number; ttl: number } | undefined
    store.read(
      '6.6.6.6',
      (_err, res) => {
        result = res
      },
      60_000,
      3,
    )
    expect(result).toEqual({ current: 0, ttl: 0 })
  })
})

describe('createFailSafeRateLimitStore — child()', () => {
  it('子 store 使用「命名空间 + method + url + -」的独立键前缀', () => {
    const keys: string[] = []
    const Store = createFailSafeRateLimitStore(workingRedis(keys), 'ihui:rl:')
    const child = new Store().child({ routeInfo: { method: 'POST', url: '/api/login' } })
    incrOnce(child, '7.7.7.7')
    expect(keys[0]).toBe('ihui:rl:POST/api/login-7.7.7.7')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
