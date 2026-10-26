// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 周期检查型自动续期(2026-10-26,mobile-rn / miniapp-taro 共用)。
 *
 * 这两端此前只有 401 兜底:空闲超过 15 分钟后第一次操作必先失败一次;流式与 ai-service
 * 通道连兜底都没有。本器把"到点续期"从"等请求撞 401"改成"自己按时换"。
 * 逐条锁:到点才刷 / 未到点不刷 / 显式登出不刷 / 重入只发一次。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  createTokenAutoRefresh,
  REFRESH_LEAD_MS,
  shouldRefreshNow,
} from '../../src/auth/auto-refresh'

const NOW = 1_700_000_000_000

/** 造一枚只带 exp 的 JWT(readExp 只解析 payload,不验签) */
function jwtExpiringIn(seconds: number, baseMs = NOW): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(baseMs / 1000) + seconds }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`
}

describe('shouldRefreshNow:按剩余寿命判定', () => {
  it('无 token / 非 JWT ⇒ false(不猜"应该能刷")', () => {
    expect(shouldRefreshNow(null, REFRESH_LEAD_MS, NOW)).toBe(false)
    expect(shouldRefreshNow('', REFRESH_LEAD_MS, NOW)).toBe(false)
    expect(shouldRefreshNow('not-a-jwt', REFRESH_LEAD_MS, NOW)).toBe(false)
  })

  it('剩余寿命仍充足 ⇒ false', () => {
    expect(shouldRefreshNow(jwtExpiringIn(10 * 60), REFRESH_LEAD_MS, NOW)).toBe(false)
  })

  it('剩余寿命进入提前窗口(≤5 分钟)⇒ true', () => {
    expect(shouldRefreshNow(jwtExpiringIn(3 * 60), REFRESH_LEAD_MS, NOW)).toBe(true)
    expect(shouldRefreshNow(jwtExpiringIn(0), REFRESH_LEAD_MS, NOW)).toBe(true)
  })

  it('已过期 ⇒ true(仍需交给续期实现去换,而不是直接判死)', () => {
    expect(shouldRefreshNow(jwtExpiringIn(-60), REFRESH_LEAD_MS, NOW)).toBe(true)
  })
})

describe('createTokenAutoRefresh:到点发起、未到点静默、登出跳过、重入去重', () => {
  it('到点 ⇒ 调用一次续期;未到点 ⇒ 不调用', async () => {
    const refresh = vi.fn(async () => 'new-token')
    const near = createTokenAutoRefresh({
      getToken: () => jwtExpiringIn(60),
      refresh,
      now: () => NOW,
    })
    expect(await near.checkNow()).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)

    const far = createTokenAutoRefresh({
      getToken: () => jwtExpiringIn(3600),
      refresh,
      now: () => NOW,
    })
    expect(await far.checkNow()).toBe(false)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('已显式登出 ⇒ 不续期(不得把刚退出的会话刷回来)', async () => {
    const refresh = vi.fn(async () => 'new-token')
    const handle = createTokenAutoRefresh({
      getToken: () => jwtExpiringIn(60),
      refresh,
      isSessionLoggedOut: () => true,
      now: () => NOW,
    })
    expect(await handle.checkNow()).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('续期在飞时再次检查 ⇒ 只发一次(共享单飞语义)', async () => {
    let resolveRefresh!: (v: string | null) => void
    const refresh = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const handle = createTokenAutoRefresh({
      getToken: () => jwtExpiringIn(60),
      refresh,
      now: () => NOW,
    })

    const first = handle.checkNow()
    expect(await handle.checkNow()).toBe(false)
    expect(refresh).toHaveBeenCalledTimes(1)

    resolveRefresh('new-token')
    expect(await first).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('start 幂等、stop 后清掉定时器', () => {
    const clear = vi.fn()
    let ticks = 0
    const handle = createTokenAutoRefresh({
      getToken: () => null,
      refresh: async () => null,
      now: () => NOW,
      setIntervalFn: (cb, ms) => {
        expect(ms).toBe(60_000)
        ticks++
        return { cb }
      },
      clearIntervalFn: clear,
    })

    handle.start()
    handle.start()
    expect(ticks).toBe(1)

    handle.stop()
    expect(clear).toHaveBeenCalledTimes(1)
    handle.stop()
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
