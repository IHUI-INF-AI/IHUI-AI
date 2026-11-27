// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NativeBridgeBanner(2026-11-27 dev 壳误报收口)
 *
 * 三态锁定:① dev 壳(8801)不握手、不亮红条、桌面入口禁用;② 浏览器里不渲染;
 * ③ 远程窗口握手失败仍照旧亮红条并整体禁用 —— 生产旧壳告警不能被本次修改削弱。
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  isTauri: true,
  isLocalDev: false,
  handshake: vi.fn(),
}))

vi.mock('@/lib/api-base-url', () => ({
  isTauriRuntime: () => hoisted.isTauri,
  isLocalWebDevOrigin: () => hoisted.isLocalDev,
}))

vi.mock('@/lib/native-bridge-handshake', () => ({
  NATIVE_BRIDGE_PROTOCOL_VERSION: 1,
  runNativeBridgeHandshake: (...args: unknown[]) => hoisted.handshake(...args),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import {
  isNativeBridgeFeaturesEnabled,
  setNativeBridgeFeaturesEnabled,
} from '@/lib/native-bridge-state'

import { NativeBridgeBanner } from '../native-bridge-banner'

beforeEach(() => {
  hoisted.isTauri = true
  hoisted.isLocalDev = false
  hoisted.handshake.mockReset()
  setNativeBridgeFeaturesEnabled(true)
})

afterEach(() => {
  cleanup()
})

describe('NativeBridgeBanner', () => {
  it('dev 壳(8801):不握手、不亮红条,桌面入口保持禁用', async () => {
    hoisted.isLocalDev = true
    render(<NativeBridgeBanner />)
    await waitFor(() => expect(isNativeBridgeFeaturesEnabled()).toBe(false))
    expect(hoisted.handshake).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('浏览器(非 Tauri):不渲染,也不改桌面入口开关', async () => {
    hoisted.isTauri = false
    render(<NativeBridgeBanner />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(isNativeBridgeFeaturesEnabled()).toBe(true)
  })

  it('远程窗口握手失败:照旧亮红条、点名缺失命令并禁用桌面入口', async () => {
    hoisted.handshake.mockResolvedValue({
      ok: false,
      reason: 'invoke-failed',
      nativeVersion: '0.1.96',
      missing: ['get_native_bridge_manifest'],
      extra: [],
      detail: 'Command get_native_bridge_manifest not allowed by ACL',
    })
    render(<NativeBridgeBanner />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请更新桌面端')
    expect(alert.textContent).toContain('get_native_bridge_manifest')
    expect(isNativeBridgeFeaturesEnabled()).toBe(false)
  })

  it('远程窗口握手通过:不亮红条,桌面入口保持启用', async () => {
    hoisted.handshake.mockResolvedValue({
      ok: true,
      nativeVersion: '0.1.97',
      missing: [],
      extra: [],
    })
    render(<NativeBridgeBanner />)
    await waitFor(() => expect(hoisted.handshake).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(isNativeBridgeFeaturesEnabled()).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
