// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  setTokenProvider,
  refreshAccessTokenOnce,
  __resetRefreshStateForTest,
} from '../src/client.js'

/**
 * 2026-09-04 根治刷新风暴的单元验证:
 * 1. 并发去重:同一时刻多次 401 只触发一次 refreshAccessToken
 * 2. 失败冷却:refresh 失败后冷却窗口内不再重复发起(阻断串行风暴)
 * 3. 冷却恢复:窗口结束后可再次发起
 */
describe('refreshAccessTokenOnce 并发去重 + 失败冷却', () => {
  afterEach(() => {
    setTokenProvider({ getToken: () => null })
    __resetRefreshStateForTest()
  })

  it('并发调用共享同一 in-flight 请求,只触发一次 refreshAccessToken', async () => {
    const refresh = vi.fn(async () => 'new-token')
    setTokenProvider({ getToken: () => 'old', refreshAccessToken: refresh })

    const [a, b, c] = await Promise.all([
      refreshAccessTokenOnce(),
      refreshAccessTokenOnce(),
      refreshAccessTokenOnce(),
    ])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(a).toBe('new-token')
    expect(b).toBe('new-token')
    expect(c).toBe('new-token')
  })

  it('refresh 失败后进入冷却:后续调用复用失败结果,不重复发起', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh token expired')
    })
    setTokenProvider({ getToken: () => 'old', refreshAccessToken: refresh })

    // 第一次失败
    await expect(refreshAccessTokenOnce()).resolves.toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)

    // 冷却期内:多次调用都不再触发 refresh
    await refreshAccessTokenOnce()
    await refreshAccessTokenOnce()
    await refreshAccessTokenOnce()
    expect(refresh).toHaveBeenCalledTimes(1) // 仍是 1 次,风暴被阻断
  })

  it('冷却窗口结束后可再次发起 refresh', async () => {
    // 只 fake setTimeout(不 fake Promise),避免干扰 refreshAccessTokenOnce 内部的
    // Promise.resolve().then() 微任务链;冷却计时器是 setTimeout,可被 fake 快进。
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const refresh = vi.fn(async () => {
        throw new Error('expired')
      })
      setTokenProvider({ getToken: () => 'old', refreshAccessToken: refresh })

      const r1 = await refreshAccessTokenOnce()
      expect(r1).toBeNull()
      expect(refresh).toHaveBeenCalledTimes(1)

      // 冷却期内不重复
      await refreshAccessTokenOnce()
      expect(refresh).toHaveBeenCalledTimes(1)

      // 快进超过 5000ms 冷却窗口
      vi.advanceTimersByTime(5001)
      const r2 = await refreshAccessTokenOnce()
      expect(r2).toBeNull()
      expect(refresh).toHaveBeenCalledTimes(2) // 冷却恢复后可再次发起
    } finally {
      vi.useRealTimers()
    }
  })

  it('refresh 成功会清除冷却态(成功后立即可再次正常刷新)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const refresh = vi
        .fn()
        .mockRejectedValueOnce(new Error('expired'))
        .mockResolvedValueOnce('new-token')
      setTokenProvider({ getToken: () => 'old', refreshAccessToken: refresh })

      // 第一次失败进入冷却
      const r1 = await refreshAccessTokenOnce()
      expect(r1).toBeNull()
      expect(refresh).toHaveBeenCalledTimes(1)

      // 快进出冷却窗口
      vi.advanceTimersByTime(5001)

      // 第二次成功
      const r2 = await refreshAccessTokenOnce()
      expect(r2).toBe('new-token')
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('未注入 refreshAccessToken 时直接返回 null,不抛错', async () => {
    setTokenProvider({ getToken: () => 'old' })
    await expect(refreshAccessTokenOnce()).resolves.toBeNull()
  })
})
