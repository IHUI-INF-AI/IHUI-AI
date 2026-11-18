// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

/**
 * TopBarPinButton — 桌面端「窗口置顶」开关回归测试（2026-11-18 立）
 *
 * 钉住四件事：
 * 1. 真值取自宿主偏好（`desktopPrefs.alwaysOnTop`），不是组件自己的本地 state；
 * 2. 点击只发**一次** `updateDesktopPrefs({ alwaysOnTop: !当前 })` —— 开关是取反，
 *    不是写死 true（写死会让第二次点击什么都没发生而界面显示成功）；
 * 3. 浏览器（非桌面）与"宿主不支持该偏好"两种场景**不渲染**，不给点了没用的按钮；
 * 4. `aria-pressed` 与视觉态同步（无障碍读取的是状态，不是图标）。
 */

const mocks = vi.hoisted(() => {
  const updateDesktopPrefs = vi.fn()
  return {
    updateDesktopPrefs,
    desktop: {
      isDesktop: true,
      desktopPrefsLoading: false,
      desktopPrefsSupported: true,
      desktopPrefs: { alwaysOnTop: false },
      updateDesktopPrefs,
    },
  }
})

vi.mock('@/hooks/use-desktop', () => ({ useDesktop: () => mocks.desktop }))

// 词包断言用 key 本身：代码引用了不存在的键会以直出键名形态暴露出来。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Tooltip 在测试环境里只需要把 children 透出来（不断言气泡内容）
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { TopBarPinButton } from '../topbar-pin-button'

function setDesktopState(patch: Partial<typeof mocks.desktop>): void {
  Object.assign(mocks.desktop, patch)
}

beforeEach(() => {
  setDesktopState({
    isDesktop: true,
    desktopPrefsLoading: false,
    desktopPrefsSupported: true,
    desktopPrefs: { alwaysOnTop: false },
  })
  mocks.updateDesktopPrefs.mockReset()
  mocks.updateDesktopPrefs.mockResolvedValue({ alwaysOnTop: true })
})

afterEach(() => {
  cleanup()
})

describe('TopBarPinButton', () => {
  it('未置顶：aria-pressed=false，点击把偏好改成"置顶"', async () => {
    render(<TopBarPinButton />)
    const btn = screen.getByRole('button', { name: 'topBar.pin' })
    expect(btn.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(btn)

    await waitFor(() => expect(mocks.updateDesktopPrefs).toHaveBeenCalledTimes(1))
    expect(mocks.updateDesktopPrefs).toHaveBeenCalledWith({ alwaysOnTop: true })
  })

  it('已置顶：aria-pressed=true，点击取反（不是再写一次 true）', async () => {
    setDesktopState({ desktopPrefs: { alwaysOnTop: true } })
    render(<TopBarPinButton />)
    const btn = screen.getByRole('button', { name: 'topBar.unpin' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(btn)

    await waitFor(() => expect(mocks.updateDesktopPrefs).toHaveBeenCalledTimes(1))
    expect(mocks.updateDesktopPrefs).toHaveBeenCalledWith({ alwaysOnTop: false })
  })

  it('浏览器（非桌面）不渲染', () => {
    setDesktopState({ isDesktop: false })
    render(<TopBarPinButton />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('旧安装包不支持该偏好（supported=false）不渲染', () => {
    setDesktopState({ desktopPrefsSupported: false })
    render(<TopBarPinButton />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
