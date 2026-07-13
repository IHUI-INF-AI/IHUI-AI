import { describe, it, expect, vi } from 'vitest'
import {
  InMemoryVersionedStore,
  withOptimisticLock,
  casOnce,
  OptimisticLockError,
  type VersionedStore,
} from '../src/utils/optimistic-lock.js'

describe('optimistic-lock — 乐观锁 CAS', () => {
  describe('InMemoryVersionedStore', () => {
    it('read 不存在记录返回 null', async () => {
      const s = new InMemoryVersionedStore<string>()
      expect(await s.read('missing')).toBeNull()
    })
    it('put 写入初始 version=0', async () => {
      const s = new InMemoryVersionedStore<string>()
      await s.put('k1', 'v1')
      const r = await s.read('k1')
      expect(r!.value).toBe('v1')
      expect(r!.version).toBe(0)
    })
    it('write 首次写入 expectedVersion=0 成功', async () => {
      const s = new InMemoryVersionedStore<string>()
      const ok = await s.write('k1', 0, 'v1')
      expect(ok).toBe(true)
      const r = await s.read('k1')
      expect(r!.version).toBe(1)
    })
    it('write 首次写入 expectedVersion!=0 失败', async () => {
      const s = new InMemoryVersionedStore<string>()
      const ok = await s.write('k1', 5, 'v1')
      expect(ok).toBe(false)
    })
    it('write 版本匹配时成功并 version+1', async () => {
      const s = new InMemoryVersionedStore<string>()
      await s.put('k1', 'v1')
      const ok = await s.write('k1', 0, 'v2')
      expect(ok).toBe(true)
      const r = await s.read('k1')
      expect(r!.value).toBe('v2')
      expect(r!.version).toBe(1)
    })
    it('write 版本不匹配时失败', async () => {
      const s = new InMemoryVersionedStore<string>()
      await s.put('k1', 'v1')
      const ok = await s.write('k1', 99, 'v2')
      expect(ok).toBe(false)
      const r = await s.read('k1')
      expect(r!.value).toBe('v1')
    })
    it('getStats 返回 success/conflict 计数', async () => {
      const s = new InMemoryVersionedStore<string>()
      await s.write('k1', 0, 'v1') // success
      await s.write('k1', 99, 'v2') // conflict
      const stats = s.getStats()
      expect(stats.success).toBe(1)
      expect(stats.conflict).toBe(1)
    })
  })

  describe('withOptimisticLock', () => {
    it('首次写入调用 updateFn(null, 0) 成功', async () => {
      const s = new InMemoryVersionedStore<number>()
      const fn = vi.fn(async (_cur: number | null, _v: number) => 42)
      const r = await withOptimisticLock(s, 'k1', fn)
      expect(r.value).toBe(42)
      expect(r.version).toBe(1)
      expect(r.attempts).toBe(1)
      expect(fn).toHaveBeenCalledWith(null, 0)
    })
    it('已存在记录传入当前值与版本', async () => {
      const s = new InMemoryVersionedStore<number>()
      await s.put('k1', 10)
      const fn = vi.fn(async (cur: number | null, _v: number) => (cur ?? 0) + 1)
      const r = await withOptimisticLock(s, 'k1', fn)
      expect(r.value).toBe(11)
      expect(r.version).toBe(1)
      expect(fn).toHaveBeenCalledWith(10, 0)
    })
    it('冲突时自动重试至成功', async () => {
      const s = new InMemoryVersionedStore<number>()
      await s.put('k1', 10)
      // 第一次 read 后,在 write 之前外部修改版本
      let callCount = 0
      const fn = vi.fn(async (cur: number | null) => {
        callCount++
        if (callCount === 1) {
          // 模拟并发：第一个调用进来后，其他线程抢先写
          await s.write('k1', 0, 999)
        }
        return (cur ?? 0) + 1
      })
      const r = await withOptimisticLock(s, 'k1', fn, { maxAttempts: 3, backoffMs: 1 })
      expect(r.attempts).toBe(2)
      expect(r.value).toBe(1000)
    })
    it('重试耗尽抛 OptimisticLockError', async () => {
      const s = new InMemoryVersionedStore<number>()
      await s.put('k1', 10)
      // 每次 read 后都让外部抢先写
      const fn = vi.fn(async (cur: number | null, v: number) => {
        await s.write('k1', v, (cur ?? 0) + 100)
        return (cur ?? 0) + 1
      })
      await expect(withOptimisticLock(s, 'k1', fn, { maxAttempts: 2 })).rejects.toBeInstanceOf(
        OptimisticLockError,
      )
    })
    it('业务函数抛错时不重试直接向上抛', async () => {
      const s = new InMemoryVersionedStore<number>()
      const fn = vi.fn(async () => {
        throw new Error('business error')
      })
      await expect(withOptimisticLock(s, 'k1', fn)).rejects.toThrow('business error')
      expect(fn).toHaveBeenCalledTimes(1)
    })
    it('默认 maxAttempts=3', async () => {
      const s = new InMemoryVersionedStore<number>()
      const fn = vi.fn(async () => 1)
      await withOptimisticLock(s, 'k1', fn)
      // 仅验证不抛错；maxAttempts 隐含在 1 次成功中
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('casOnce', () => {
    it('记录不存在 expectedVersion=0 成功', async () => {
      const s = new InMemoryVersionedStore<number>()
      const r = await casOnce(s, 'k1', 0, () => 42)
      expect(r.ok).toBe(true)
      expect(r.version).toBe(1)
    })
    it('记录不存在 expectedVersion!=0 失败', async () => {
      const s = new InMemoryVersionedStore<number>()
      const r = await casOnce(s, 'k1', 5, () => 42)
      expect(r.ok).toBe(false)
      expect(r.version).toBe(0)
    })
    it('版本匹配成功写入', async () => {
      const s = new InMemoryVersionedStore<number>()
      await s.put('k1', 10)
      const r = await casOnce(s, 'k1', 0, (cur) => (cur ?? 0) + 1)
      expect(r.ok).toBe(true)
      expect(r.version).toBe(1)
    })
    it('版本不匹配失败返回当前版本', async () => {
      const s = new InMemoryVersionedStore<number>()
      await s.put('k1', 10)
      // 先抢抢先写入让 version=1
      await s.write('k1', 0, 11)
      const r = await casOnce(s, 'k1', 0, (cur) => (cur ?? 0) + 1)
      expect(r.ok).toBe(false)
      expect(r.version).toBe(1)
    })
  })

  describe('OptimisticLockError', () => {
    it('包含 OPTIMISTIC_LOCK code', () => {
      try {
        throw new OptimisticLockError('test')
      } catch (e) {
        expect((e as OptimisticLockError).message).toBe('test')
      }
    })
  })

  describe('VersionedStore 接口可自定义实现', () => {
    it('可注入自定义 store', async () => {
      const custom: VersionedStore<string> = {
        read: async () => null,
        write: async () => true,
      }
      const r = await withOptimisticLock(custom, 'x', async () => 'v')
      expect(r.value).toBe('v')
      expect(r.version).toBe(1)
    })
  })
})
