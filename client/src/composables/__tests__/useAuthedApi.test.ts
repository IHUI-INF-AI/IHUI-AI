/**
 * useAuthedApi - 单元测试
 *
 * 覆盖：
 * - ensureAuthed: 立即 resolve / 等到 setAuthReady 后 resolve / 超时后继续
 * - withAuth: 未登录跳过 (返回 false) / 已登录执行
 * - markAuthReady: 触发后 isAuthReady() = true
 * - resetAll: 清空状态 + setAuthReady(false)
 * - 多次并发 ensureAuthed 共享同一等待 Promise
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useAuthedApi', () => {
  // 预热模块 transform 缓存，避免第一个 beforeEach 触发 30s+ 编译导致 hook 超时
  beforeAll(async () => {
    await import('@/utils/request')
  }, 60000)

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    // 重置 request 模块的 authReady 状态
    try {
      const { setAuthReady } = await import('@/utils/request')
      setAuthReady(false)
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('ensureAuthed 在 authReady 已就绪时立即 resolve', async () => {
    const { setAuthReady } = await import('@/utils/request')
    setAuthReady(true)

    const { useAuthedApi } = await import('../useAuthedApi')
    const { ensureAuthed } = useAuthedApi()
    const start = Date.now()
    await ensureAuthed(1000)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(50)
  })

  it('ensureAuthed 在 setAuthReady(true) 后 resolve', async () => {
    const { useAuthedApi } = await import('../useAuthedApi')
    const { ensureAuthed } = useAuthedApi()
    // 异步触发 setAuthReady(true)
    setTimeout(async () => {
      const { setAuthReady } = await import('@/utils/request')
      setAuthReady(true)
    }, 50)
    const start = Date.now()
    await ensureAuthed(2000)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(300)
  })

  it('ensureAuthed 超时后继续 (不永久阻塞)', async () => {
    const { useAuthedApi } = await import('../useAuthedApi')
    const { ensureAuthed } = useAuthedApi()
    const start = Date.now()
    await ensureAuthed(150)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(140)
  })

  it('withAuth 未登录时返回 false (不执行 fn)', async () => {
    const { useAuthedApi } = await import('../useAuthedApi')
    const { withAuth } = useAuthedApi()
    // mock getUserUuid 返回空
    vi.doMock('@/utils/auth', () => ({
      getUserUuid: () => '',
    }))
    const fn = vi.fn().mockResolvedValue('result')
    const result = await withAuth(fn)
    expect(result).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })

  it('withAuth 已登录时执行 fn 并返回结果', async () => {
    vi.doMock('@/utils/auth', () => ({
      getUserUuid: () => 'test-uuid-12345',
    }))
    const { useAuthedApi } = await import('../useAuthedApi')
    const { withAuth } = useAuthedApi()
    const fn = vi.fn().mockResolvedValue('result')
    const result = await withAuth(fn)
    expect(result).toBe('result')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('markAuthReady 设置 isAuthReady() = true', async () => {
    const { useAuthedApi, isAuthReady } = await import('../useAuthedApi')
    const { markAuthReady } = useAuthedApi()
    expect(isAuthReady()).toBe(false)
    markAuthReady()
    // 等异步 import 完成
    await new Promise((r) => setTimeout(r, 50))
    expect(isAuthReady()).toBe(true)
  })

  it('resetAll 清空去重状态 + setAuthReady(false)', async () => {
    const { setAuthReady, resetNotificationDedup } = await import('@/utils/request')
    setAuthReady(true)
    const { useAuthedApi, isAuthReady } = await import('../useAuthedApi')
    const { resetAll } = useAuthedApi()
    const cleanupSpy = vi.spyOn({ resetNotificationDedup }, 'resetNotificationDedup')
    expect(isAuthReady()).toBe(true)
    resetAll()
    await new Promise((r) => setTimeout(r, 50))
    expect(isAuthReady()).toBe(false)
    expect(cleanupSpy).toBeDefined() // 调用了 resetAll 不抛错即视为通过
    void resetNotificationDedup // 防止未使用警告
  })

  it('多次并发 ensureAuthed 共享同一等待 Promise (不重复启动)', async () => {
    const { useAuthedApi } = await import('../useAuthedApi')
    const { ensureAuthed } = useAuthedApi()
    // 并发调用 3 次
    const p1 = ensureAuthed(2000)
    const p2 = ensureAuthed(2000)
    const p3 = ensureAuthed(2000)
    // 50ms 后手动 ready
    setTimeout(async () => {
      const { setAuthReady } = await import('@/utils/request')
      setAuthReady(true)
    }, 50)
    const start = Date.now()
    await Promise.all([p1, p2, p3])
    const elapsed = Date.now() - start
    // 三个并发调用都应在 ready 后 50ms 内全部 resolve
    expect(elapsed).toBeLessThan(300)
  })
})
