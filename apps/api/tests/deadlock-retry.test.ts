import { describe, it, expect } from 'vitest'
import {
  isDeadlockError,
  DeadlockRetrier,
  withDeadlockRetry,
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
    it('errorCodes 包含 PG/MySQL 死锁码', () => {
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain('40P01')
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain('40001')
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain(1213)
      expect(DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes).toContain(1205)
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
    it('MySQL errno=1213 识别', () => {
      expect(isDeadlockError({ errno: 1213 })).toBe(true)
    })
    it('MySQL errno=1205 识别', () => {
      expect(isDeadlockError({ errno: 1205 })).toBe(true)
    })
    it('MySQL errno=1210 不识别', () => {
      expect(isDeadlockError({ errno: 1210 })).toBe(false)
    })
    it('MySQL number=1213 识别', () => {
      expect(isDeadlockError({ number: 1213 })).toBe(true)
    })
    it('MySQL errno=1213 字符串型 SQLSTATE 识别', () => {
      expect(isDeadlockError({ errno: '40001' })).toBe(true)
    })
    it('args 元组含 40P01 识别', () => {
      expect(isDeadlockError({ args: ['40P01', 'other'] })).toBe(true)
    })
    it('args 元组含 1213 识别', () => {
      expect(isDeadlockError({ args: [1213] })).toBe(true)
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
          if (count < 2) throw Object.assign(new Error('deadlock'), { errno: 1213 })
          return 'success'
        },
        { ...DEFAULT_DEADLOCK_RETRY_CONFIG, maxAttempts: 3, baseDelayMs: 1 },
      )
      expect(r).toBe('success')
    })
  })
})
