// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面 dev 壳不跑自动更新(2026-10-15 立)。
 *
 * 锁三格,缺一不完整:
 *  ① dev 壳(Tauri + 窗口 origin 端口 8801)⇒ 启动静默检查**不发生**(否则开发机被装线上
 *     构建并自杀重启,本轮 CDP 取证连续两次被它打断);
 *  ② 生产薄壳(Tauri + 远端站点)⇒ 照旧自动检查(零回归,强制自动更新策略不受本改判影响);
 *  ③ dev 壳 + `?dev-update=1` ⇒ **显式试验通道仍然可用**(isDevUpdateTest 那条早于本判据)。
 *
 * 判据本身住在 lib/api-base-url.ts(本测试只造窗口现场,不另写一份判定)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { checkForUpdatesMock, sessionSetMock } = vi.hoisted(() => ({
  checkForUpdatesMock: vi.fn(async () => null),
  sessionSetMock: vi.fn(),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => '__TAURI_INTERNALS__' in window,
  checkForUpdates: checkForUpdatesMock,
  restartApp: vi.fn(async () => {}),
  markUpdateInstalled: vi.fn(() => {}),
  // dev-update=1 走的是**模拟会话**(不调真实 checkForUpdates),所以第三格断言落在这颗 spy 上
  setAvailableUpdateSession: sessionSetMock,
}))

import { useUpdater } from '../use-updater'

function setWindow(url: string, tauri: boolean): void {
  const u = new URL(url)
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      origin: u.origin,
      href: u.href,
      search: u.search,
      pathname: u.pathname,
    },
  })
  if (tauri) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      writable: true,
      value: {},
    })
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

describe('桌面 dev 壳自动更新门', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    setWindow('http://localhost/', false)
  })

  it('dev 壳(8801)不跑启动静默检查', async () => {
    setWindow('http://localhost:8801/checkin', true)
    renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(checkForUpdatesMock).not.toHaveBeenCalled()
  })

  it('生产薄壳(远端站点)照旧自动检查 —— 零回归', async () => {
    setWindow('https://aizhs.top/checkin', true)
    renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1)
  })

  it('dev 壳 + ?dev-update=1 时显式试验通道仍可用(走模拟会话,不调真实 check)', async () => {
    setWindow('http://localhost:8801/checkin?dev-update=1', true)
    renderHook(() => useUpdater())
    await vi.advanceTimersByTimeAsync(60_000)
    // 显式开关必须先于 dev 壳判据生效:模拟会话被塞进 bridge(自动安装路径)
    expect(sessionSetMock).toHaveBeenCalled()
    expect(checkForUpdatesMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
