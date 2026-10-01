// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ close: 0 }))

interface FakeUpdate {
  version: string
  date?: string
  body?: string
  downloadAndInstall: (
    onEvent: (e: unknown) => void,
    options?: { timeout?: number },
  ) => Promise<void>
  close: () => Promise<void>
}

const session = vi.hoisted(() => ({ current: null as FakeUpdate | null }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: async () => session.current,
}))

function makeUpdate(onEventRef: { current: ((e: unknown) => void) | null }) {
  let rejectInstall: ((reason: Error) => void) | null = null
  const u: FakeUpdate = {
    version: '0.3.0',
    date: '2026-10-01T00:00:00Z',
    body: 'notes',
    downloadAndInstall: (onEvent) =>
      new Promise<void>((_resolve, reject) => {
        rejectInstall = reject
        onEventRef.current = onEvent
        onEvent({ event: 'Started', data: { contentLength: 100 } })
      }),
    close: async () => {
      calls.close += 1
      rejectInstall?.(new Error('resource closed'))
    },
  }
  return u
}

describe('tauri-bridge 更新下载超时与取消', () => {
  let onEventRef: { current: ((e: unknown) => void) | null }

  beforeEach(async () => {
    vi.resetModules()
    vi.useRealTimers()
    calls.close = 0
    onEventRef = { current: null }
    session.current = makeUpdate(onEventRef)
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {}, location: { hostname: 'localhost' } })
  })

  it('U1 主动取消:关闭底层资源并上抛 install_cancelled', async () => {
    const { checkForUpdates } = await import('../tauri-bridge')
    const s = await checkForUpdates()
    expect(s?.cancel).toBeTypeOf('function')
    const pending = s!.downloadAndInstall()
    await s!.cancel!()
    await expect(pending).rejects.toThrow('install_cancelled')
    expect(calls.close).toBeGreaterThan(0)
  })

  it('U2 事件停摆:无进展满 60s 才判超时(阳性对照——停摆要能红)', async () => {
    vi.useFakeTimers()
    const { checkForUpdates } = await import('../tauri-bridge')
    const s = await checkForUpdates()
    const pending = s!.downloadAndInstall()
    pending.catch(() => {})
    await vi.advanceTimersByTimeAsync(60_001)
    expect(calls.close).toBe(1)
    vi.useRealTimers()
    await expect(pending).rejects.toThrow('install_timeout')
  })

  it('U3 反向对照:持续有进展就不得判超时(慢但活的下载不得被掐)', async () => {
    vi.useFakeTimers()
    const { checkForUpdates } = await import('../tauri-bridge')
    const s = await checkForUpdates()
    const pending = s!.downloadAndInstall()
    pending.catch(() => {})
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(59_000)
      onEventRef.current?.({ event: 'Progress', data: { chunkLength: 10 } })
    }
    await vi.advanceTimersByTimeAsync(59_000)
    expect(calls.close).toBe(0)
    vi.useRealTimers()
    if (session.current) await session.current.close()
  })

  it('U4 总超时走插件自带 options.timeout,不在我方再搓一层', async () => {
    let seen: { timeout?: number } | undefined
    const base = session.current as FakeUpdate
    session.current = {
      ...base,
      downloadAndInstall: (_onEvent, options) => {
        seen = options
        return Promise.resolve()
      },
    }
    const { checkForUpdates } = await import('../tauri-bridge')
    const s = await checkForUpdates()
    await s!.downloadAndInstall()
    expect(seen).toEqual({ timeout: 600_000 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
