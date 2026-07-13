import { describe, it, expect, vi, afterEach } from 'vitest'
import { PessimisticLocker } from '../src/utils/pessimistic-lock.js'

describe('pessimistic-lock — 进程内悲观锁', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('acquire', () => {
    it('成功获取锁返回 owner token', () => {
      const l = new PessimisticLocker()
      const token = l.acquire('k1')
      expect(token).not.toBeNull()
      expect(typeof token).toBe('string')
    })
    it('使用自定义 owner', () => {
      const l = new PessimisticLocker()
      const token = l.acquire('k1', 'my-owner')
      expect(token).toBe('my-owner')
    })
    it('已被持有返回 null', () => {
      const l = new PessimisticLocker()
      l.acquire('k1')
      expect(l.acquire('k1')).toBeNull()
    })
    it('不同 key 互不影响', () => {
      const l = new PessimisticLocker()
      l.acquire('k1')
      expect(l.acquire('k2')).not.toBeNull()
    })
  })

  describe('release', () => {
    it('owner 匹配时成功释放', () => {
      const l = new PessimisticLocker()
      const token = l.acquire('k1')
      expect(l.release('k1', token!)).toBe(true)
      expect(l.acquire('k1')).not.toBeNull()
    })
    it('owner 不匹配时失败', () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'owner-a')
      expect(l.release('k1', 'owner-b')).toBe(false)
    })
    it('key 不存在时返回 false', () => {
      const l = new PessimisticLocker()
      expect(l.release('missing', 'o')).toBe(false)
    })
  })

  describe('lease 过期机制', () => {
    it('过期锁被 evict 后可重新获取', () => {
      vi.useFakeTimers()
      const l = new PessimisticLocker(1) // 1 秒租约
      l.acquire('k1')
      vi.advanceTimersByTime(1500)
      // 新 acquire 会触发 evict
      expect(l.acquire('k1')).not.toBeNull()
    })
  })

  describe('acquireWithRetry', () => {
    it('立即可用时获取', async () => {
      const l = new PessimisticLocker()
      const token = await l.acquireWithRetry('k1', 1000, 50)
      expect(token).not.toBeNull()
    })
    it('超时返回 null', async () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'first')
      const token = await l.acquireWithRetry('k1', 100, 30)
      expect(token).toBeNull()
    })
    it('持有人释放后重试可获取', async () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'first')
      // 100ms 后释放
      setTimeout(() => l.release('k1', 'first'), 80)
      const token = await l.acquireWithRetry('k1', 1000, 30)
      expect(token).not.toBeNull()
    })
  })

  describe('detectDeadlock', () => {
    it('同一 owner 持有多把锁时释放最旧', () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'owner-a')
      l.acquire('k2', 'owner-a')
      const dead = l.detectDeadlock()
      expect(dead).toHaveLength(1)
      expect(l.stats().deadlockResolved).toBe(1)
    })
    it('不同 owner 持锁不视为死锁', () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'owner-a')
      l.acquire('k2', 'owner-b')
      expect(l.detectDeadlock()).toHaveLength(0)
    })
    it('无锁时返回空', () => {
      const l = new PessimisticLocker()
      expect(l.detectDeadlock()).toEqual([])
    })
  })

  describe('stats', () => {
    it('反映 acquire/release/deadlockResolved/active', () => {
      const l = new PessimisticLocker()
      const t1 = l.acquire('k1', 'o1')
      l.acquire('k2', 'o1')
      // 先释放 k1（owner 匹配）
      l.release('k1', t1!)
      // 此时 o1 只剩 1 把锁（k2），detectDeadlock 不触发
      l.detectDeadlock()
      const s = l.stats()
      expect(s.acquired).toBe(2)
      expect(s.released).toBe(1)
      expect(s.deadlockResolved).toBe(0)
      expect(s.active).toBe(1)
    })
    it('detectDeadlock 释放最旧锁后 stats 正确', () => {
      const l = new PessimisticLocker()
      l.acquire('k1', 'o1')
      l.acquire('k2', 'o1')
      const dead = l.detectDeadlock() // 释放最旧（k1）
      expect(dead).toContain('k1')
      const s = l.stats()
      expect(s.deadlockResolved).toBe(1)
      expect(s.active).toBe(1)
    })
  })
})
