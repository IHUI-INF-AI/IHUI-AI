// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票85④ —— ConnectivityBanner 渲染级用例:档位直接来自共享层 `bannerKindFor`,
// 组件**不许自己再判一次**,所以这里只验"四档各画各的格、且措辞不串台":
//   none        不渲染;
//   slow        中性提示(慢网 ≠ 断网),桌面宿主内也不附"本地仍可用"(还没断);
//   unconfirmed 只说"连不上服务器",**绝不写成"你没网"**;
//   offline     才写"本机已断网",桌面宿主内补一句本地 Git 通道仍可用。

import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConnectivityBannerKind } from '@ihui/shared/utils/connectivity'

const hookState = vi.hoisted(() => ({ banner: 'none' as ConnectivityBannerKind }))
const tauriState = vi.hoisted(() => ({ isTauri: false }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `connectivity.${key}`,
}))

vi.mock('@/hooks/use-connectivity', () => ({
  useConnectivity: () => ({ banner: hookState.banner }),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => tauriState.isTauri,
}))

import { ConnectivityBanner } from '../ConnectivityBanner'

function bannerOf(kind: ConnectivityBannerKind) {
  hookState.banner = kind
  return render(<ConnectivityBanner />).container.querySelector(
    '[data-testid="connectivity-banner"]',
  )
}

beforeEach(() => {
  hookState.banner = 'none'
  tauriState.isTauri = false
})

afterEach(() => {
  tauriState.isTauri = false
})

describe('票85④ / ConnectivityBanner 四档', () => {
  it('none ⇒ 一个节点都不渲染(安静即常态)', () => {
    expect(bannerOf('none')).toBeNull()
  })

  it('slow ⇒ 独立的 slow 格,措辞是"慢"不是"断"', () => {
    const el = bannerOf('slow')
    expect(el?.getAttribute('data-kind')).toBe('slow')
    expect(el?.textContent).toContain('connectivity.slow')
    expect(el?.textContent).not.toContain('connectivity.deviceOffline')
    expect(el?.textContent).not.toContain('connectivity.unconfirmed')
  })

  it('slow 档即便在桌面宿主内也不附"本地 Git 通道"(还没断网,不必安抚)', () => {
    tauriState.isTauri = true
    const el = bannerOf('slow')
    expect(el?.getAttribute('data-kind')).toBe('slow')
    expect(el?.textContent).not.toContain('connectivity.hostLocalAvailable')
  })

  it('unconfirmed ⇒ 只报"连不上服务器",绝不写成"你没网"', () => {
    const el = bannerOf('unconfirmed')
    expect(el?.getAttribute('data-kind')).toBe('unconfirmed')
    expect(el?.textContent).toContain('connectivity.unconfirmed')
    expect(el?.textContent).not.toContain('connectivity.deviceOffline')
    // 浏览器内没有宿主本地通道可安抚
    expect(el?.textContent).not.toContain('connectivity.hostLocalAvailable')
  })

  it('offline ⇒ 才写"本机已断网"', () => {
    const el = bannerOf('offline')
    expect(el?.getAttribute('data-kind')).toBe('offline')
    expect(el?.textContent).toContain('connectivity.deviceOffline')
    expect(el?.textContent).not.toContain('connectivity.unconfirmed')
  })

  it('桌面宿主内 offline ⇒ 补一句「本地 Git 通道仍可用」(宿主 git 三命令零网络依赖)', () => {
    tauriState.isTauri = true
    const el = bannerOf('offline')
    expect(el?.textContent).toContain('connectivity.hostLocalAvailable')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
