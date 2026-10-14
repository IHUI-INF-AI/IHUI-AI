// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Desktop(Tauri WebView)adapter 采集口径分流回归锁(2026-10-14)。
 *
 * 锁定真缺陷:旧 desktop adapter 只喂常量 'tauri-desktop',与 RN 端修复前
 * "全网一个 hash"同型失效 —— 桌面端与普通浏览器同 UA 会撞出同一个指纹。
 * 修复后契约:
 *  - Tauri 运行时 → desktop 口径:platform 带 `tauri-desktop-<navigator.platform>` 前缀,
 *    且不采集 canvas/webgl(WebView2 与浏览器共用 GPU 栈,两端口径本就不承诺等值)。
 *  - 普通浏览器 → web 口径:platform 为原始 navigator.platform,不含 tauri-desktop- 前缀。
 *  - 判定发生在**采集时**而非模块求值时(对齐 useTauriIpcReady 钉死的 IPC 晚注入失效型)。
 *
 * 用 vi.resetModules + 动态 import 拿到全新 collector 实例,规避 60s 内存缓存把
 * 上一条用例的口径结果串到下一条;tauriState 在 vi.hoisted 作用域里跨 reset 存活,
 * 由每个用例在 import 之前切换,从而驱动 collectDesktopAware 的分流分支。
 */
const tauriState = vi.hoisted(() => ({ value: false }))

vi.mock('@/lib/api-base-url', () => ({
  isTauriRuntime: () => tauriState.value,
}))

describe('web/desktop 设备指纹采集口径分流', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Tauri 运行时走 desktop 口径:platform 带 tauri-desktop- 前缀,且不采集 canvas/webgl', async () => {
    tauriState.value = true
    const mod = await import('./use-device-fingerprint')
    const result = await mod.webDeviceFingerprintCollector.get()

    // 核心契约:桌面端平台标识必须带专属前缀,与普通浏览器区分开
    expect(result.source.platform?.startsWith('tauri-desktop-')).toBe(true)
    // 桌面端刻意不采集 canvas/webgl(WebView2 与浏览器共用 GPU 栈,口径不承诺等值)
    expect(result.source.canvas).toBeUndefined()
    expect(result.source.webgl).toBeUndefined()
    // 指纹形态:4 段 FNV-1a 拼接的 32 字符 16 进制
    expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/)
    expect(result.source.userAgent).toBeDefined()
  })

  it('普通浏览器走 web 口径:platform 不带 tauri-desktop- 前缀', async () => {
    tauriState.value = false
    const mod = await import('./use-device-fingerprint')
    const result = await mod.webDeviceFingerprintCollector.get()

    // 普通浏览器不得被误判成桌面端
    expect(result.source.platform?.startsWith('tauri-desktop-')).not.toBe(true)
    expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/)
  })

  it('Tauri IPC 晚注入窗口期(模块已求值但 __TAURI_INTERNALS__ 尚未就位)不把桌面端误判成浏览器', async () => {
    // 首采时 IPC 尚未注入(isTauriRuntime=false),collectDesktopAware 应回退 web 口径并
    // 启动补判轮询;这一格只验证"首采口径不提前锁定桌面端",桌面端在缓存过期后的下一次
    // 采集才切到 desktop 口径 —— 与 useTauriIpcReady 的轮询语义一致。
    tauriState.value = false
    const mod = await import('./use-device-fingerprint')
    const first = await mod.webDeviceFingerprintCollector.get()
    // 首采窗口期按 web 口径(平台不带 tauri-desktop- 前缀),不静默错挂桌面身份
    expect(first.source.platform?.startsWith('tauri-desktop-')).not.toBe(true)
  })
})
