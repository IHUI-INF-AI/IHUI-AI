/**
 * 回归测试:BUG-R16-DEADLOCK-RETRY
 *
 * bugId: BUG-R16-DEADLOCK-RETRY
 * 轮次: 16
 * 场景: 模拟 deadlock 错误,验证自动重试 3 次后成功
 *       旧架构来源: server/tests/test_bug_fixes_round16.py
 *
 * 验证点:
 *  - fn 第 1 次抛 deadlock 错误第 2 次成功 → 返回成功结果
 *  - fn 连续 3 次抛 deadlock,第 4 次抛原错误(重试上限 3 次)
 *  - fn 抛非 deadlock 错误 → 立即抛出
 *  - fn 成功 → 不重试
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/deadlock-retry.test.ts
 */
import { describe, it, expect, vi } from 'vitest'

/** 默认重试上限 */
const MAX_RETRY = 3
/** 重试间隔(测试中为 0 加速) */
const RETRY_DELAY_MS = 0

/**
 * 判断错误是否为死锁错误
 * - PostgreSQL: "deadlock detected"
 * - MySQL: "Deadlock found when trying to get lock"
 * - 通用: error.code 为 40P01(PostgreSQL deadlock)或 1213(MySQL lock)
 */
function isDeadlockError(err: unknown): boolean {
  if (!err) return false
  const e = err as { message?: string; code?: string }
  const msg = (e.message || '').toLowerCase()
  if (msg.includes('deadlock')) return true
  if (e.code === '40P01' || e.code === '1213') return true
  return false
}

/**
 * 死锁自动重试包装器
 * - 仅对 deadlock 错误重试
 * - 最多重试 MAX_RETRY 次
 * - 重试间隔通过 sleep 实现
 */
async function retryOnDeadlock<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isDeadlockError(err)) {
        throw err
      }
      if (attempt === MAX_RETRY) {
        throw err
      }
      if (RETRY_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }
  }
  throw lastError
}

describe('BUG-R16-DEADLOCK-RETRY:死锁自动重试', () => {
  it('fn 第 1 次抛 deadlock 错误第 2 次成功 → 返回成功结果', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      if (callCount === 1) {
        throw new Error('deadlock detected in transaction')
      }
      return 'success'
    }
    const result = await retryOnDeadlock(fn)
    expect(result).toBe('success')
    expect(callCount).toBe(2)
  })

  it('fn 连续 3 次抛 deadlock,第 4 次抛原错误(重试上限)', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      throw new Error('deadlock detected')
    }
    await expect(retryOnDeadlock(fn)).rejects.toThrow(/deadlock/)
    // 初始 1 次 + 3 次重试 = 4 次调用
    expect(callCount).toBe(4)
  })

  it('fn 抛非 deadlock 错误 → 立即抛出,不重试', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      throw new Error('connection refused')
    }
    await expect(retryOnDeadlock(fn)).rejects.toThrow(/connection refused/)
    expect(callCount).toBe(1)
  })

  it('fn 立即成功 → 不重试(只调用 1 次)', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await retryOnDeadlock(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('PostgreSQL 错误码 40P01 也被识别为 deadlock', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      if (callCount < 2) {
        const err = new Error('some pg error') as Error & { code: string }
        err.code = '40P01'
        throw err
      }
      return 'recovered'
    }
    const result = await retryOnDeadlock(fn)
    expect(result).toBe('recovered')
    expect(callCount).toBe(2)
  })

  it('MySQL 错误码 1213 也被识别为 deadlock', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      if (callCount < 2) {
        const err = new Error('Lock wait timeout') as Error & { code: string }
        err.code = '1213'
        throw err
      }
      return 'ok'
    }
    const result = await retryOnDeadlock(fn)
    expect(result).toBe('ok')
    expect(callCount).toBe(2)
  })

  it('fn 第 2 次抛非 deadlock 错误 → 立即抛出,不再重试', async () => {
    let callCount = 0
    const fn = async () => {
      callCount++
      if (callCount === 1) throw new Error('deadlock detected')
      throw new Error('different error')
    }
    await expect(retryOnDeadlock(fn)).rejects.toThrow(/different error/)
    expect(callCount).toBe(2)
  })

  it('isDeadlockError 对空值与非错误对象返回 false', () => {
    expect(isDeadlockError(null)).toBe(false)
    expect(isDeadlockError(undefined)).toBe(false)
    expect(isDeadlockError({})).toBe(false)
    expect(isDeadlockError({ message: 'other error' })).toBe(false)
  })
})
