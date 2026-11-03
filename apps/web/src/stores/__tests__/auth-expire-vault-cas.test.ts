// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * expireSession 的桌面 vault 清理必须是 CAS(2026-10-20)。
 *
 * 病灶:被动失效(服务端 401)曾无差别 `setDesktopRefreshToken(null)`,而桌面多窗口共用
 * 同一份 auth.json —— 另一窗口刚轮转写回的新 token 会被这一刀抹掉,下次冷启动无凭据可刷,
 * 用户感知就是"自动登录时好时坏"。
 *
 * 本组用真 store + 可编程 vault 验行为(不看源码形状):
 * - vault 仍是本窗口那一份 ⇒ 清(null);
 * - vault 已被别的窗口轮转成新值 ⇒ 一次都不写;
 * - 本窗口不知道用过哪一份(冷启动 state 里没有)⇒ 不碰;
 * - 全程不落登出标记(被动失效 ≠ 用户主动退出)。
 */

const mocks = vi.hoisted(() => ({
  isDesktopEnv: vi.fn(() => true),
  vaultGet: vi.fn(async (): Promise<string | null> => null),
  vaultSet: vi.fn(async (_token: string | null): Promise<void> => {}),
  apiLogout: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: true })),
}))

vi.mock('@/lib/desktop-token-vault', () => ({
  isDesktopEnv: mocks.isDesktopEnv,
  getDesktopRefreshToken: mocks.vaultGet,
  setDesktopRefreshToken: mocks.vaultSet,
}))

vi.mock('@ihui/api-client', () => ({
  logout: mocks.apiLogout,
}))

import { useAuthStore } from '../auth'
import {
  clearSessionLoggedOutMarker,
  isSessionLoggedOut,
  __resetSessionLoggedOutMirrorForTest,
} from '@/lib/session-marker'

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('useAuthStore.expireSession → 桌面 vault CAS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isDesktopEnv.mockReturnValue(true)
    mocks.vaultGet.mockReset()
    mocks.vaultGet.mockResolvedValue(null)
    mocks.vaultSet.mockReset()
    mocks.vaultSet.mockResolvedValue(undefined)
    mocks.apiLogout.mockReset()
    mocks.apiLogout.mockResolvedValue({ success: true })
    clearSessionLoggedOutMarker()
    __resetSessionLoggedOutMirrorForTest()
    useAuthStore.setState({
      token: 'at-1',
      refreshToken: 'rt-old',
      isAuthenticated: true,
      user: null,
    })
  })

  it('vault 仍是本窗口用过的那一份 ⇒ 清掉(null)', async () => {
    mocks.vaultGet.mockResolvedValue('rt-old')

    useAuthStore.getState().expireSession()
    await flush()

    expect(mocks.vaultSet).toHaveBeenCalledTimes(1)
    expect(mocks.vaultSet).toHaveBeenCalledWith(null)
  })

  it('vault 已被另一窗口轮转成新 token ⇒ 一次都不写', async () => {
    mocks.vaultGet.mockResolvedValue('rt-new')

    useAuthStore.getState().expireSession()
    await flush()

    expect(mocks.vaultSet).not.toHaveBeenCalled()
  })

  it('本窗口不知道用过哪一份(state 无 refreshToken)⇒ 不碰 vault', async () => {
    useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false })

    useAuthStore.getState().expireSession()
    await flush()

    expect(mocks.vaultGet).not.toHaveBeenCalled()
    expect(mocks.vaultSet).not.toHaveBeenCalled()
  })

  it('被动失效不得落登出标记,也不得调 /auth/logout', async () => {
    mocks.vaultGet.mockResolvedValue('rt-old')

    useAuthStore.getState().expireSession()
    await flush()

    expect(isSessionLoggedOut()).toBe(false)
    expect(mocks.apiLogout).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('浏览器环境(isDesktopEnv=false)不读写 vault', async () => {
    mocks.isDesktopEnv.mockReturnValue(false)

    useAuthStore.getState().expireSession()
    await flush()

    expect(mocks.vaultGet).not.toHaveBeenCalled()
    expect(mocks.vaultSet).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
