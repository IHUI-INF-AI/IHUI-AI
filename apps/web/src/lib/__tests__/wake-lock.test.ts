// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock, isTauriMock, wakeLockMock } = vi.hoisted(() => {
  const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
  return {
    invokeMock: vi.fn(),
    isTauriMock: vi.fn(),
    wakeLockMock: { request: vi.fn().mockResolvedValue(sentinel), sentinel },
  }
})

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@/lib/tauri-bridge', () => ({ isTauri: isTauriMock }))

import {
  acquireWakeLock,
  isWakeLockOwned,
  releaseWakeLock,
  resetWakeLockForTests,
} from '@/lib/wake-lock'

const flush = () => new Promise<void>((r) => setImmediate(r))

describe('长任务 wake lock owner 引用计数', () => {
  beforeEach(() => {
    resetWakeLockForTests()
    invokeMock.mockReset()
    isTauriMock.mockReset()
    wakeLockMock.request.mockClear()
    wakeLockMock.sentinel.release.mockClear()
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      configurable: true,
      value: wakeLockMock,
    })
  })

  it('最后一个 owner 离开才真正撤锁——A 任务结束不误放 B 的锁', async () => {
    isTauriMock.mockReturnValue(false)
    acquireWakeLock('stream-A')
    acquireWakeLock('stream-B')
    await flush()
    expect(wakeLockMock.request).toHaveBeenCalledTimes(1)

    releaseWakeLock('stream-A')
    expect(isWakeLockOwned()).toBe(true)
    expect(wakeLockMock.sentinel.release).not.toHaveBeenCalled()

    releaseWakeLock('stream-B')
    expect(isWakeLockOwned()).toBe(false)
    expect(wakeLockMock.sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('桌面通道 state=failed 时不冒充持锁,且不抛断主链路', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue({ state: 'failed', reason: 'SetThreadExecutionState-failed' })
    acquireWakeLock('desktop-stream')
    await flush()
    expect(invokeMock).toHaveBeenCalledWith('set_sleep_prevention', { active: true })
    releaseWakeLock('desktop-stream')
    // state=failed 时 requestHandle 返回的是 no-op 句柄(没真持锁),
    // 因此 release 不应再调 active=false —— 这正是 fail-closed 的正确语义。
    expect(invokeMock).toHaveBeenCalledTimes(1)
  })

  it('pending 期间被 release 的 owner 不会在申请完成后复活锁', async () => {
    isTauriMock.mockReturnValue(false)
    let resolveRequest!: (v: unknown) => void
    wakeLockMock.request.mockImplementationOnce(
      () => new Promise((r) => { resolveRequest = r }),
    )
    acquireWakeLock('aborted')
    releaseWakeLock('aborted')
    resolveRequest(wakeLockMock.sentinel)
    await flush()
    expect(isWakeLockOwned()).toBe(false)
    expect(wakeLockMock.sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('无 Wake Lock API 且桌面 command 抛错时降级为 no-op,不影响业务', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock.mockRejectedValue(new Error('command not registered'))
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      configurable: true,
      value: undefined,
    })
    expect(() => acquireWakeLock('fallback')).not.toThrow()
    await flush()
    expect(() => releaseWakeLock('fallback')).not.toThrow()
    expect(isWakeLockOwned()).toBe(false)
  })
})
