// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * tokenUtils 保活契约测试(2026-11-14 修「登录完还弹窗 / refreshToken 不保活」)。
 *
 * 锁定三条行为(此前缺失其中两条,导致 access token 15min 后必然 401、401 抖动即弹登录框):
 * 1. 浏览器 cookie 模式下内存 refreshToken 恒为 null,startAutoRefresh 仍必须按 JWT exp 调度
 *    —— 续期凭据是 httpOnly cookie,由浏览器自动附带,不需要 JS 持有 refreshToken;
 * 2. 默认提前 5 分钟续期,未进入窗口前不得提前打 /auth/refresh;
 * 3. 回前台(visibilitychange)时:已在续期窗口内立即补刷,否则按当前 token 重新排程
 *    —— 后台标签页/系统休眠会冻结 setTimeout,错过调度后必须靠这一支补回来。
 */
const mocks = vi.hoisted(() => ({
  state: { token: null as string | null, refreshToken: null as string | null },
  setToken: vi.fn(),
  refreshAccessTokenOnce: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({
      token: mocks.state.token,
      refreshToken: mocks.state.refreshToken,
      setToken: mocks.setToken,
    }),
  },
}))

vi.mock('@ihui/api-client', () => ({
  refreshAccessTokenOnce: mocks.refreshAccessTokenOnce,
}))

import { startAutoRefresh, stopAutoRefresh } from './tokenUtils'

/** 造一个只有 payload.exp 有意义的 JWT(readExp 不验签) */
function makeJwt(expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`
}

const BASE = new Date('2026-11-14T08:00:00Z').getTime()
/** 每个用例把时钟往前推 1min:refreshOnWake 有 15s 节流,同刻连测会被上一用例吃掉 */
let caseIndex = 0

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE + caseIndex * 60_000)
  caseIndex += 1
  setVisibility('visible')
  mocks.state.token = null
  mocks.state.refreshToken = null
  mocks.setToken.mockReset()
  mocks.refreshAccessTokenOnce.mockReset()
  mocks.refreshAccessTokenOnce.mockResolvedValue(null)
})

afterEach(() => {
  stopAutoRefresh()
  vi.useRealTimers()
})

describe('startAutoRefresh 保活调度', () => {
  it('内存 refreshToken 为 null(cookie 模式)仍然调度,并在过期前 5 分钟续期', async () => {
    mocks.state.token = makeJwt(15 * 60) // 15min 后过期 → 应在 10min 时续期
    mocks.state.refreshToken = null

    startAutoRefresh()

    await vi.advanceTimersByTimeAsync(10 * 60_000 - 1_000)
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('stopAutoRefresh 后不再触发续期(登出即停保活)', async () => {
    mocks.state.token = makeJwt(15 * 60)

    startAutoRefresh()
    stopAutoRefresh()

    await vi.advanceTimersByTimeAsync(20 * 60_000)
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })
})

describe('回前台补刷(visibilitychange)', () => {
  it('已进入续期窗口 → 立即补刷(不等错过的 setTimeout)', async () => {
    mocks.state.token = makeJwt(60) // 1min 后过期,已在 5min 提前量内

    startAutoRefresh()
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('离过期还早 → 不立即刷新,按当前 token 重新排程', async () => {
    mocks.state.token = makeJwt(15 * 60)

    startAutoRefresh()
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()

    // 重新排程仍按 exp 提前 5min:再走 10min 才续期
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('页面在后台(hidden)时事件不触发刷新', async () => {
    mocks.state.token = makeJwt(60)
    setVisibility('hidden')

    startAutoRefresh()
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
