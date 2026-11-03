// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 2026-09-29 台账票 G-814411:令牌刷新写回前的 CAS 复核。
 * 刷新请求在飞期间凭据被另一路径更新(换 provider / 再登录 / 另一轮续期)时,
 * 迟到的刷新响应是过期账目,不得覆盖新凭据 —— 复核「active provider 未切换 +
 * 旧 accessToken 仍是当前值」,漂移即丢弃(返回 null)。
 * 本包没有 generation 计数器,activeProvider 的等价物就是 tokenProvider 对象身份。
 */
describe('refreshAccessTokenOnce 写回前 CAS 复核(G-814411)', () => {
  afterEach(() => {
    setTokenProvider({ getToken: () => null })
    __resetRefreshStateForTest()
  })

  /** 可控延宕的刷新桩:返回 pending promise 与其 resolver,供竞态注入用 */
  function deferredRefresh() {
    let resolveRefresh!: (t: string) => void
    const refresh = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    // 注意:resolver 必须经对象属性在调用时取(不能解构成 const 副本 —— 那会在
    // 刷新尚未执行时把 undefined 定格住)
    return { refresh, get resolveRefresh() { return resolveRefresh } }
  }

  it('token 未变时正常写回:刷新响应原样交回调用方(正向对照)', async () => {
    const refresh = vi.fn(async () => 'new-token')
    setTokenProvider({ getToken: () => 'old', refreshAccessToken: refresh })

    await expect(refreshAccessTokenOnce()).resolves.toBe('new-token')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('刷新返回前 activeProvider 已切换 ⇒ 旧响应被丢弃,不覆盖新凭据', async () => {
    const d = deferredRefresh()
    setTokenProvider({ getToken: () => 'old-a', refreshAccessToken: d.refresh })

    const pending = refreshAccessTokenOnce()
    await vi.waitFor(() => expect(d.refresh).toHaveBeenCalledTimes(1)) // 刷新已在飞

    // 竞态注入:刷新在飞期间 activeProvider 被切换,新凭据 'fresh-b' 已生效
    const refreshB = vi.fn(async () => 'new-b')
    setTokenProvider({ getToken: () => 'fresh-b', refreshAccessToken: refreshB })
    d.resolveRefresh('new-a')

    // 旧响应被丢弃:'new-a' 不会交回调用方(调用方因此无从用它覆盖当前凭据)
    await expect(pending).resolves.toBeNull()
    expect(refreshB).not.toHaveBeenCalled()

    // 丢弃不污染单例/冷却:新 provider 的下一次刷新可立即正常发起并写回
    await expect(refreshAccessTokenOnce()).resolves.toBe('new-b')
    expect(refreshB).toHaveBeenCalledTimes(1)
  })

  it('同一 provider 下凭据被另一路径更新 ⇒ 旧响应同样被丢弃', async () => {
    let currentToken = 'old'
    const d = deferredRefresh()
    setTokenProvider({ getToken: () => currentToken, refreshAccessToken: d.refresh })

    const pending = refreshAccessTokenOnce()
    await vi.waitFor(() => expect(d.refresh).toHaveBeenCalledTimes(1))

    // 竞态注入:provider 对象没换,但另一路径先一步把 token 写成了新值
    currentToken = 'rotated-by-other-path'
    d.resolveRefresh('stale-new')

    // 旧 accessToken 已不是当前值 ⇒ 旧响应丢弃,不覆盖
    await expect(pending).resolves.toBeNull()
  })

  it('刷新自身持久化(getToken 已等于响应新值)⇒ 放行,不误杀正常刷新', async () => {
    let currentToken = 'old'
    const refresh = vi.fn(async () => {
      // provider 契约:refreshAccessToken 内部自行持久化后再返回新 token
      currentToken = 'new-token'
      return 'new-token'
    })
    setTokenProvider({ getToken: () => currentToken, refreshAccessToken: refresh })

    await expect(refreshAccessTokenOnce()).resolves.toBe('new-token')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
