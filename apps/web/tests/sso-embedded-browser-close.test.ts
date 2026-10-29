// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端"在浏览器中登录"的关窗收尾(2026-10-13 立)—— sso-desktop-bridge 的三条契约:
 *   ① 换 token 成功 ⇒ 关掉打开时记住的**项目内嵌浏览器窗**(closeEmbeddedBrowser),
 *      且**只关一次**(OS 重复派发同一 deep-link 不再开第二次);
 *   ② 没有记住会话(走系统默认浏览器登录的路径)⇒ 不调用,静默跳过;
 *   ③ exchange 失败 ⇒ **不关窗**(浏览器窗留着,用户可就地重试),返回 false。
 *
 * 模块级状态(记住的会话 / 已处理的 sso_code)是本文件的主要测试面,所以每个用例
 * 用 vi.resetModules() + 动态 import 拿全新实例,不靠手工复位内部状态。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fakes = vi.hoisted(() => {
  const closeEmbeddedBrowser = vi.fn(async () => undefined)
  const exchangeSsoCode = vi.fn(async (_base: string, _code: string, _client: string) => null)
  const setToken = vi.fn()
  const setUser = vi.fn()
  return { closeEmbeddedBrowser, exchangeSsoCode, setToken, setUser }
})

vi.mock('@/lib/tauri-bridge', () => ({
  closeEmbeddedBrowser: fakes.closeEmbeddedBrowser,
}))

vi.mock('@ihui/shared', () => ({
  SSO_CLIENT_IDS: { DESKTOP: 'desktop' },
  extractSsoCode: (url: string) => {
    const m = /[?&]sso_code=([^&#]+)/.exec(url)
    return m ? decodeURIComponent(m[1]) : null
  },
  exchangeSsoCode: fakes.exchangeSsoCode,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({ setToken: fakes.setToken, setUser: fakes.setUser }),
  },
}))

vi.mock('@/lib/api-base-url', () => ({ resolveApiBaseUrl: () => 'http://api.test' }))

/** 每个用例重新加载模块,拿到干净的 pendingSsoEmbeddedWindow / lastProcessedCode。 */
async function loadBridge() {
  vi.resetModules()
  return await import('@/lib/sso-desktop-bridge')
}

const TOKEN_DATA = {
  accessToken: 'at',
  refreshToken: 'rt',
  user: { id: 'u1', nickname: 'n', avatar: null },
}

beforeEach(() => {
  fakes.closeEmbeddedBrowser.mockClear()
  fakes.exchangeSsoCode.mockClear().mockResolvedValue(null)
  fakes.setToken.mockClear()
  fakes.setUser.mockClear()
})

describe('sso-desktop-bridge — 内嵌浏览器窗关窗收尾', () => {
  it('① 换 token 成功后关掉记住的内嵌浏览器窗,且只关一次', async () => {
    const bridge = await loadBridge()
    bridge.rememberSsoEmbeddedWindow()
    fakes.exchangeSsoCode.mockResolvedValue(TOKEN_DATA)

    const first = await bridge.handleDesktopDeepLink('ihui://sso?sso_code=abc')
    expect(first).toBe(true)
    expect(fakes.closeEmbeddedBrowser).toHaveBeenCalledTimes(1)

    // OS 重复派发同一 deep-link:去重路径同样收尾,但会话已清账 ⇒ 不再开第二次关窗
    const second = await bridge.handleDesktopDeepLink('ihui://sso?sso_code=abc')
    expect(second).toBe(true)
    expect(fakes.closeEmbeddedBrowser).toHaveBeenCalledTimes(1)
  })

  it('② 没记住会话(系统浏览器回退路径)⇒ 登录照常,不调关窗', async () => {
    const bridge = await loadBridge()
    fakes.exchangeSsoCode.mockResolvedValue(TOKEN_DATA)

    expect(await bridge.handleDesktopDeepLink('ihui://sso?sso_code=abc')).toBe(true)
    expect(fakes.setToken).toHaveBeenCalled()
    expect(fakes.closeEmbeddedBrowser).not.toHaveBeenCalled()
  })

  it('③ exchange 失败 ⇒ 返回 false 且**不**关窗(内嵌浏览器窗留着供重试)', async () => {
    const bridge = await loadBridge()
    bridge.rememberSsoEmbeddedWindow()
    fakes.exchangeSsoCode.mockResolvedValue(null)

    expect(await bridge.handleDesktopDeepLink('ihui://sso?sso_code=bad')).toBe(false)
    expect(fakes.setToken).not.toHaveBeenCalled()
    expect(fakes.closeEmbeddedBrowser).not.toHaveBeenCalled()

    // 失败后同一个会话仍然记着:下一次成功要能关掉它
    fakes.exchangeSsoCode.mockResolvedValue(TOKEN_DATA)
    expect(await bridge.handleDesktopDeepLink('ihui://sso?sso_code=ok')).toBe(true)
    expect(fakes.closeEmbeddedBrowser).toHaveBeenCalledTimes(1)
  })

  it('④ 没有 sso_code 的深链不打扰关窗会话', async () => {
    const bridge = await loadBridge()
    bridge.rememberSsoEmbeddedWindow()

    expect(await bridge.handleDesktopDeepLink('ihui://callback')).toBe(false)
    expect(fakes.exchangeSsoCode).not.toHaveBeenCalled()
    expect(fakes.closeEmbeddedBrowser).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
