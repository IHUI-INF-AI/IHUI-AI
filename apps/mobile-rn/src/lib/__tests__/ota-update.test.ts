// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 状态机取证(2026-10-27 立)。
 *
 * 钉四件事,都是"看起来在跑、其实没跑"的高发点:
 *   ① 环境不支持(dev / web)必须**不碰** expo-updates,而不是先调再兜底;
 *   ② 有更新才下载,下载完才是 ready(否则用户点更新会重启到一个没有更新的包);
 *   ③ 任何失败都只落 error 状态、绝不抛出(自动检查失败不能打扰用户);
 *   ④ 关闭过的一次性提示,在**新一轮**就绪时必须复位 —— 否则更新永远提示不出来。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}))

vi.mock('expo-updates', () => ({
  checkForUpdateAsync: h.checkForUpdateAsync,
  fetchUpdateAsync: h.fetchUpdateAsync,
  reloadAsync: h.reloadAsync,
  isEnabled: true,
}))

/**
 * 每个用例都拿一份全新的模块(store 是模块级单例,不重置会串味)。
 *
 * ⚠️ 陷阱(实测踩过):`vi.resetModules()` 之后必须**先重新 import react-native 再改 Platform.OS** ——
 * 否则拿到的是旧实例,而 ota-update 会加载一份新的 react-native(默认 OS='web')⇒
 * 所有用例都会静默落到 unsupported,看起来像"判据写错了",其实是测具自己串了实例。
 */
async function freshModule(opts: { dev?: boolean; os?: 'android' | 'ios' | 'web' } = {}) {
  vi.resetModules()
  vi.stubGlobal('__DEV__', opts.dev ?? false)
  const rn = (await import('react-native')) as unknown as { Platform: { OS: string } }
  Object.defineProperty(rn.Platform, 'OS', { value: opts.os ?? 'android', configurable: true })
  return await import('../ota-update')
}

describe('OTA 状态机:环境判定', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
  })

  it('dev 环境 ⇒ unsupported,且不去调 expo-updates', async () => {
    const mod = await freshModule({ dev: true })
    await expect(mod.checkOtaUpdate()).resolves.toBe('unsupported')
    expect(h.checkForUpdateAsync).not.toHaveBeenCalled()
  })

  it('web 平台 ⇒ unsupported(web 走自己的 PWA 链路)', async () => {
    const mod = await freshModule({ os: 'web' })
    await expect(mod.checkOtaUpdate()).resolves.toBe('unsupported')
    expect(h.checkForUpdateAsync).not.toHaveBeenCalled()
  })
})

describe('OTA 状态机:检查 → 下载 → 就绪', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
  })

  it('有更新 ⇒ 下载并落到 ready', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockResolvedValue(undefined)
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('ready')
    expect(h.fetchUpdateAsync).toHaveBeenCalledTimes(1)
  })

  it('无更新 ⇒ up-to-date,且不下载', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: false })
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('up-to-date')
    expect(h.fetchUpdateAsync).not.toHaveBeenCalled()
  })

  it('检查抛错 ⇒ error,不向上抛', async () => {
    h.checkForUpdateAsync.mockRejectedValue(new Error('offline'))
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('error')
  })

  it('下载抛错 ⇒ error(不能停在 downloading 假装还在下)', async () => {
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockRejectedValue(new Error('download broke'))
    const mod = await freshModule()
    await expect(mod.checkOtaUpdate()).resolves.toBe('error')
  })
})

describe('OTA 状态机:提示的一次性关闭与复位', () => {
  beforeEach(() => {
    h.checkForUpdateAsync.mockReset()
    h.fetchUpdateAsync.mockReset()
    h.reloadAsync.mockReset()
    h.checkForUpdateAsync.mockResolvedValue({ isAvailable: true })
    h.fetchUpdateAsync.mockResolvedValue(undefined)
  })

  it('关闭后 dismissed=true,新一轮就绪时复位为 false', async () => {
    const mod = await freshModule()
    await mod.checkOtaUpdate()
    mod.dismissOtaPrompt()
    expect(mod.otaSnapshot().dismissed).toBe(true)
    await mod.checkOtaUpdate()
    expect(mod.otaSnapshot().dismissed).toBe(false)
  })
})

describe('OTA 状态机:重启生效', () => {
  beforeEach(() => {
    h.reloadAsync.mockReset()
  })

  it('apply ⇒ 调 reloadAsync', async () => {
    h.reloadAsync.mockResolvedValue(undefined)
    const mod = await freshModule()
    await mod.applyOtaUpdate()
    expect(h.reloadAsync).toHaveBeenCalledTimes(1)
  })

  it('reload 失败 ⇒ 落 error(卡片保持可见可重试)', async () => {
    h.reloadAsync.mockRejectedValue(new Error('native channel broken'))
    const mod = await freshModule()
    await mod.applyOtaUpdate()
    expect(mod.otaSnapshot().state).toBe('error')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
