// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票85③ —— ConnectivityBanner 渲染级用例:四态各画各的格。

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConnectivityState } from '@/hooks/use-connectivity'

const hookState = vi.hoisted(() => ({ state: 'probing' as ConnectivityState }))
const tauriState = vi.hoisted(() => ({ isTauri: false }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `connectivity.${key}`,
}))

vi.mock('@/hooks/use-connectivity', () => ({
  useConnectivity: () => ({ state: hookState.state, lastCheckedAt: null }),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => tauriState.isTauri,
}))

import { ConnectivityBanner } from '../ConnectivityBanner'

beforeEach(() => {
  hookState.state = 'probing'
  tauriState.isTauri = false
})

describe('票85③ / ConnectivityBanner 四态', () => {
  it('online 与 probing 都不显示横幅(安静即常态;没结论 ≠ 在线的谎)', () => {
    hookState.state = 'online'
    const a = render(<ConnectivityBanner />)
    expect(a.container.querySelector('[data-testid="connectivity-banner"]')).toBeNull()
    a.unmount()
    hookState.state = 'probing'
    const b = render(<ConnectivityBanner />)
    expect(b.container.querySelector('[data-testid="connectivity-banner"]')).toBeNull()
  })

  it('device-offline ⇒ 独立一格 data-state,文案是断网而非"连不上服务器"', () => {
    hookState.state = 'device-offline'
    const { container } = render(<ConnectivityBanner />)
    const el = container.querySelector('[data-testid="connectivity-banner"]')
    expect(el?.getAttribute('data-state')).toBe('device-offline')
    expect(el?.textContent).toContain('connectivity.deviceOffline')
    expect(el?.textContent).not.toContain('connectivity.apiUnreachable')
  })

  it('api-unreachable ⇒ 独立一格;浏览器内不带"本地 Git 通道"注记', () => {
    hookState.state = 'api-unreachable'
    const { container } = render(<ConnectivityBanner />)
    const el = container.querySelector('[data-testid="connectivity-banner"]')
    expect(el?.getAttribute('data-state')).toBe('api-unreachable')
    expect(el?.textContent).toContain('connectivity.apiUnreachable')
    expect(el?.textContent).not.toContain('connectivity.hostLocalAvailable')
  })

  it('桌面宿主内 api-unreachable ⇒ 附带「本地 Git 通道仍可用」(宿主 git 三命令零网络依赖)', () => {
    hookState.state = 'api-unreachable'
    tauriState.isTauri = true
    const { container } = render(<ConnectivityBanner />)
    const el = container.querySelector('[data-testid="connectivity-banner"]')
    expect(el?.textContent).toContain('connectivity.hostLocalAvailable')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
