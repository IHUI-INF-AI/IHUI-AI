// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import {
  isDeadlockError,
  DeadlockRetrier,
  withDeadlockRetry,
  backoffDelay,
  DEFAULT_DEADLOCK_RETRY_CONFIG,
} from '../src/utils/deadlock-retry.js'

describe('deadlock-retry — 死锁重试', () => {
  describe('DEFAULT_DEADLOCK_RETRY_CONFIG', () => {
    it('maxAttempts=5', () => {
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.maxAttempts).toBe(5)
    })
    it('baseDelayMs=20', () => {
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.baseDelayMs).toBe(20)
    })
    it('maxDelayMs=500', () => {
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.maxDelayMs).toBe(500)
    })
    it('errorCodes 包含 PostgreSQL 死锁 SQLSTATE', () => {
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain('40P01')
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain('40001')
    })
  })

  describe('isDeadlockError', () => {
    it('PostgreSQL pgcode=40P01 识别', () => {
      expect(isDeadlockError({ pgcode: '40P01' })).toBe(true)
    })
    it('PostgreSQL sqlstate=40001 识别', () => {
      expect(isDeadlockError({ sqlstate: '40001' })).toBe(true)
    })
    it('PostgreSQL code=40P01 识别', () => {
      expect(isDeadlockError({ code: '40P01' })).toBe(true)
    })
    it('非死锁 SQLSTATE 不识别', () => {
      expect(isDeadlockError({ code: 'XX123' })).toBe(false)
    })
    it('errno 字段不被读取', () => {
      expect(isDeadlockError({ errno: 1213 })).toBe(false)
    })
    it('消息含 deadlock 识别', () => {
      expect(isDeadlockError(new Error('deadlock detected'))).toBe(true)
    })
    it('消息含 serialization failure 识别', () => {
      expect(isDeadlockError(new Error('serialization failure'))).toBe(true)
    })
    it('普通错误不识别', () => {
      expect(isDeadlockError(new Error('connection refused'))).toBe(false)
    })
    it('非对象（字符串）兜底匹配', () => {
      expect(isDeadlockError('something deadlock something')).toBe(true)
    })
    it('null 不识别', () => {
      expect(isDeadlockError(null)).toBe(false)
    })
    it('自定义 codes 生效', () => {
      expect(isDeadlockError({ pgcode: 'XX999' }, ['XX999'])).toBe(true)
      expect(isDeadlockError({ pgcode: '40P01' }, ['XX999'])).toBe(false)
    })
  })

  describe('DeadlockRetrier', () => {
    it('成功执行返回结果且不计入 retried', async () => {
      const r = new DeadlockRetrier({ ...DEFAULT_DEADLOCK_RETRY_CONFIG, maxAttempts: 3 })
      const result = await r.call(async () => 'ok')
      expect(result).toBe('ok')
      const stats = r.getStats()
      expect(stats.success).toBe(1)
      expect(stats.retried).toBe(0)
      expect(stats.exhausted).toBe(0)
    })
    it('死锁错误自动重试至成功', async () => {
      const r = new DeadlockRetrier({
        ...DEFAULT_DEADLOCK_RETRY_CONFIG,
        maxAttempts: 3,
        baseDelayMs: 1,
      })
      let callCount = 0
      const result = await r.call(async () => {
        callCount++
        if (callCount < 2) throw Object.assign(new Error('deadlock'), { pgcode: '40P01' })
        return 'ok'
      })
      expect(result).toBe('ok')
      expect(r.getStats().retried).toBe(1)
      expect(r.getStats().success).toBe(1)
    })
    it('非死锁错误不重试直接抛出', async () => {
      const r = new DeadlockRetrier({ ...DEFAULT_DEADLOCK_RETRY_CONFIG, maxAttempts: 3 })
      await expect(
        r.call(async () => {
          throw new Error('connection refused')
        }),
      ).rejects.toThrow('connection refused')
      expect(r.getStats().retried).toBe(0)
      expect(r.getStats().exhausted).toBe(0)
    })
    it('重试耗尽后抛出最后异常并计 exhausted', async () => {
      const r = new DeadlockRetrier({
        ...DEFAULT_DEADLOCK_RETRY_CONFIG,
        maxAttempts: 2,
        baseDelayMs: 1,
      })
      await expect(
        r.call(async () => {
          throw Object.assign(new Error('deadlock'), { pgcode: '40P01' })
        }),
      ).rejects.toThrow('deadlock')
      expect(r.getStats().retried).toBe(1)
      expect(r.getStats().exhausted).toBe(1)
      expect(r.getStats().success).toBe(0)
    })
    it('stats 返回快照不可修改内部状态', async () => {
      const r = new DeadlockRetrier()
      await r.call(async () => 1)
      const s = r.getStats()
      s.success = 999
      expect(r.getStats().success).toBe(1)
    })
  })

  describe('withDeadlockRetry 高阶函数', () => {
    it('成功执行返回结果', async () => {
      const r = await withDeadlockRetry(async () => 42)
      expect(r).toBe(42)
    })
    it('使用自定义 config', async () => {
      let count = 0
      const r = await withDeadlockRetry(
        async () => {
          count++
          if (count < 2) throw Object.assign(new Error('deadlock'), { pgcode: '40P01' })
          return 'success'
        },
        { ...DEFAULT_DEADLOCK_RETRY_CONFIG, maxAttempts: 3, baseDelayMs: 1 },
      )
      expect(r).toBe('success')
    })
  })

  describe('backoffDelay 指数退避序列', () => {
    function cfg(
      overrides: Partial<{
        baseDelayMs: number
        maxDelayMs: number
        maxAttempts: number
      }> = {},
    ) {
      return { ...DEFAULT_DEADLOCK_RETRY_CONFIG, ...overrides }
    }

    it('去抖(random=0.5)时按 base*2^(attempt-1) 严格递增', () => {
      // random=0.5 → offset=0 → 退避=base,便于锁定精确序列
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(backoffDelay(1, cfg())).toBe(20) // 20 * 2^0
        expect(backoffDelay(2, cfg())).toBe(40) // 20 * 2^1
        expect(backoffDelay(3, cfg())).toBe(80) // 20 * 2^2
        expect(backoffDelay(4, cfg())).toBe(160)
        expect(backoffDelay(5, cfg())).toBe(320)
      } finally {
        spy.mockRestore()
      }
    })

    it('退避被 maxDelayMs 上限截断', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        // base=640 → 截断为 500 上限
        expect(backoffDelay(6, cfg())).toBe(500)
        expect(backoffDelay(10, cfg())).toBe(500)
      } finally {
        spy.mockRestore()
      }
    })

    it('抖动偏移始终落在 base 的 ±20% 区间且非负', () => {
      // 不 mock random,验证任意随机值都不越界
      for (let i = 0; i < 200; i++) {
        const attempt = 3 // base=80,jitter=16 → [64,96]
        const base = Math.min(500, 20 * Math.pow(2, attempt - 1))
        const jitter = Math.floor(base * 0.2)
        const d = backoffDelay(attempt, cfg())
        expect(d).toBeGreaterThanOrEqual(base - jitter)
        expect(d).toBeLessThanOrEqual(base + jitter)
        expect(d).toBeGreaterThanOrEqual(0)
      }
    })

    it('自定义 base/maxDelay 生效', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(backoffDelay(2, cfg({ baseDelayMs: 100, maxDelayMs: 1000 }))).toBe(200)
        // base=400*2=800 < 1000,不截断
        expect(backoffDelay(3, cfg({ baseDelayMs: 100, maxDelayMs: 1000 }))).toBe(400)
        // base=100*2^4=1600 > 1000 → 截断为 1000
        expect(backoffDelay(5, cfg({ baseDelayMs: 100, maxDelayMs: 1000 }))).toBe(1000)
      } finally {
        spy.mockRestore()
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
