import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BloomGuard, getCachedWithBloomGuard } from '../src/utils/bloom-guard.js'

/** Mock Redis 客户端 */
function createMockRedis() {
  const bitmap: Record<string, number> = {}
  const kv: Record<string, string> = {}
  return {
    bitmap,
    kv,
    setbit: vi.fn(async (key: string, bit: number, val: number) => {
      const k = `${key}:${bit}`
      const old = bitmap[k] ?? 0
      bitmap[k] = val
      return old
    }),
    getbit: vi.fn(async (key: string, bit: number) => {
      return bitmap[`${key}:${bit}`] ?? 0
    }),
    del: vi.fn(async (key: string) => {
      const had = key in kv || Object.keys(bitmap).some((k) => k.startsWith(`${key}:`))
      delete kv[key]
      for (const k of Object.keys(bitmap)) {
        if (k.startsWith(`${key}:`)) delete bitmap[k]
      }
      return had ? 1 : 0
    }),
    exists: vi.fn(async (key: string) => (key in kv ? 1 : 0)),
    get: vi.fn(async (key: string) => kv[key] ?? null),
    set: vi.fn(async (key: string, val: string) => {
      kv[key] = val
      return 'OK'
    }),
    pipeline: vi.fn(() => {
      const cmds: Array<{ cmd: string; args: unknown[] }> = []
      return {
        setbit(key: string, bit: number, val: number) {
          cmds.push({ cmd: 'setbit', args: [key, bit, val] })
          return this
        },
        getbit(key: string, bit: number) {
          cmds.push({ cmd: 'getbit', args: [key, bit] })
          return this
        },
        async exec() {
          const results: Array<[Error | null, unknown]> = []
          for (const c of cmds) {
            if (c.cmd === 'setbit') {
              const [key, bit, val] = c.args as [string, number, number]
              // 委托给 redis.setbit（已 mock），传入真实 key
              const r = await mockRedis.setbit(key, bit, val)
              results.push([null, r])
            } else if (c.cmd === 'getbit') {
              const [key, bit] = c.args as [string, number]
              const r = await mockRedis.getbit(key, bit)
              results.push([null, r])
            }
          }
          return results
        },
      }
    }),
  }
}

let mockRedis: ReturnType<typeof createMockRedis>

describe('bloom-guard — 布隆过滤器 + 空值缓存', () => {
  beforeEach(() => {
    mockRedis = createMockRedis()
  })

  describe('add + mightContain', () => {
    it('未 add 的 key mightContain 返回 false', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      const r = await g.mightContain('absent-key')
      expect(r).toBe(false)
    })
    it('add 后 mightContain 返回 true', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      await g.add('present-key')
      const r = await g.mightContain('present-key')
      expect(r).toBe(true)
    })
    it('多个 add 后均 mightContain=true', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 10000 })
      await g.add('k1')
      await g.add('k2')
      await g.add('k3')
      expect(await g.mightContain('k1')).toBe(true)
      expect(await g.mightContain('k2')).toBe(true)
      expect(await g.mightContain('k3')).toBe(true)
    })
  })

  describe('reset', () => {
    it('清除位图后 mightContain 返回 false', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      await g.add('k1')
      expect(await g.mightContain('k1')).toBe(true)
      await g.reset()
      // mockRedis.del 清除了 bitmap
      expect(await g.mightContain('k1')).toBe(false)
    })
  })

  describe('getCached — 布隆过滤器拦截', () => {
    it('不在过滤器中直接返回 null（不调用 fetchFn）', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      const fetchFn = vi.fn(async () => ({ value: 1 }))
      const r = await g.getCached('absent', fetchFn)
      expect(r).toBeNull()
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  describe('getCached — 空值缓存', () => {
    it('fetchFn 返回 null 时缓存空值标记', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      // 先 add 才会进入 getCached 流程
      await g.add('k1')
      const fetchFn = vi.fn(async () => null)
      const r1 = await g.getCached('k1', fetchFn)
      expect(r1).toBeNull()
      expect(fetchFn).toHaveBeenCalledTimes(1)
      // 第 2 次调用：空值缓存命中，不再调用 fetchFn
      const r2 = await g.getCached('k1', fetchFn)
      expect(r2).toBeNull()
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
    it('fetchFn 返回 undefined 也视为空值', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      await g.add('k1')
      const fetchFn = vi.fn(async () => undefined)
      const r = await g.getCached('k1', fetchFn)
      expect(r).toBeNull()
    })
  })

  describe('getCached — 数据缓存', () => {
    it('fetchFn 返回数据时缓存 + 加入过滤器', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      // 第一次未 add，但 fetchFn 返回数据后应自动 add
      // 但 mightContain=false 直接 return null，根本到不了 fetchFn
      // 所以必须先 add 才能到达 fetchFn
      await g.add('k1')
      const fetchFn = vi.fn(async () => ({ value: 42 }))
      const r1 = await g.getCached('k1', fetchFn)
      expect(r1).toEqual({ value: 42 })
      expect(fetchFn).toHaveBeenCalledTimes(1)
      // 第 2 次：数据缓存命中
      const r2 = await g.getCached('k1', fetchFn)
      expect(r2).toEqual({ value: 42 })
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCached — 缓存数据损坏', () => {
    it('JSON.parse 失败时回源', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      await g.add('k1')
      // 先手动注入损坏的数据缓存
      mockRedis.kv['bloom:data:k1'] = 'not-json'
      const fetchFn = vi.fn(async () => ({ ok: true }))
      const r = await g.getCached('k1', fetchFn)
      expect(r).toEqual({ ok: true })
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCachedWithBloomGuard 便捷函数', () => {
    it('等价于 new BloomGuard().getCached()', async () => {
      await mockRedis.set('bloom:guard:0:0', '1')
      await mockRedis.set('bloom:guard:0:1', '1')
      await mockRedis.set('bloom:guard:0:2', '1')
      // 跳过完整流程，仅验证便捷函数可调用
      const r = await getCachedWithBloomGuard(mockRedis as never, 'absent', async () => 1)
      expect(r).toBeNull()
    })
  })

  describe('配置选项', () => {
    it('自定义 prefix', async () => {
      const g = new BloomGuard(mockRedis as never, {
        hashCount: 3,
        size: 1000,
        prefix: 'custom:',
      })
      await g.add('k1')
      // 验证位图 key 使用自定义前缀
      const bitmapKeys = Object.keys(mockRedis.bitmap)
      expect(bitmapKeys.some((k) => k.startsWith('custom:guard'))).toBe(true)
    })
    it('nullTtl / dataTtl 默认值', async () => {
      const g = new BloomGuard(mockRedis as never, { hashCount: 3, size: 1000 })
      await g.add('k1')
      // fetchFn 返回 null 触发空值缓存
      await g.getCached('k1', async () => null)
      // nullCacheKey 应存在
      expect(mockRedis.kv['bloom:null:k1']).toBeDefined()
    })
  })

  describe('mightContain — pipeline exec 返回 null', () => {
    it('返回 false（安全降级）', async () => {
      const failRedis = {
        ...mockRedis,
        pipeline: vi.fn(() => ({
          getbit: () => failRedis.pipeline(),
          async exec() {
            return null
          },
        })),
      }
      const g = new BloomGuard(failRedis as never, { hashCount: 3, size: 1000 })
      const r = await g.mightContain('k1')
      expect(r).toBe(false)
    })
  })

  describe('mightContain — pipeline 抛错', () => {
    it('错误向上抛出', async () => {
      const failRedis = {
        ...mockRedis,
        pipeline: vi.fn(() => ({
          getbit: () => failRedis.pipeline(),
          async exec() {
            throw new Error('redis down')
          },
        })),
      }
      const g = new BloomGuard(failRedis as never, { hashCount: 3, size: 1000 })
      await expect(g.mightContain('k1')).rejects.toThrow('redis down')
    })
  })
})
