// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { __REFRESH_LOCK_NAME, withRefreshLock } from '../refresh-lock'

type FakeLockManager = {
  request: (name: string, callback: () => Promise<unknown>) => Promise<unknown>
}

/** 最小互斥锁实现:一次只跑一个回调,排队者按 FIFO 取锁。 */
function installFakeLocks(): { names: string[] } {
  const names: string[] = []
  const waiting: Array<() => void> = []
  let held = false
  const request = (name: string, callback: () => Promise<unknown>): Promise<unknown> => {
    names.push(name)
    return new Promise((resolve, reject) => {
      const run = async (): Promise<void> => {
        held = true
        try {
          resolve(await callback())
        } catch (err) {
          reject(err)
        } finally {
          held = false
          const next = waiting.shift()
          if (next) next()
        }
      }
      if (held) waiting.push(() => void run())
      else void run()
    })
  }
  Object.defineProperty(navigator, 'locks', {
    value: { request } as FakeLockManager,
    configurable: true,
  })
  return { names }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'locks')
  vi.restoreAllMocks()
})

describe('withRefreshLock', () => {
  it('环境没有 navigator.locks 时直接执行(行为与改动前一致)', async () => {
    Reflect.deleteProperty(navigator, 'locks')
    const fn = vi.fn(async () => 'token')
    await expect(withRefreshLock(fn)).resolves.toBe('token')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('并发刷新被串行化:第二个回调在第一个结束后才开始', async () => {
    const { names } = installFakeLocks()
    const events: string[] = []
    let releaseFirst: () => void = () => {}

    const first = withRefreshLock(async () => {
      events.push('first:start')
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      events.push('first:end')
      return 'a'
    })
    const second = withRefreshLock(async () => {
      events.push('second:start')
      return 'b'
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])

    releaseFirst()
    await expect(first).resolves.toBe('a')
    await expect(second).resolves.toBe('b')
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    expect(names).toEqual([__REFRESH_LOCK_NAME, __REFRESH_LOCK_NAME])
  })

  it('回调抛错向上透传,且锁被释放(后续调用照常取锁)', async () => {
    installFakeLocks()
    await expect(
      withRefreshLock(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await expect(withRefreshLock(async () => 'ok')).resolves.toBe('ok')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
