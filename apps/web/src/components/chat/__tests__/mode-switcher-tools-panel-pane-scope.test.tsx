// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G-935 缺口 A(2026-10-22):工具面板开关按窗格寻址。
 *
 * 缺陷本体:ModeSwitcher 的「工具面板」项此前写根单例 useAiToolsPanelStore，而面板体
 * ai-side-panel-tools.tsx 读 usePaneAiToolsPanelStore(Provider 内 = 窗格实例)
 * ⇒ 窗格内开关只点亮根格面板，开关环断裂。
 *
 * 成对留证:
 *   ① 正向 = 两窗格各挂一份 ModeSwitcher，点 A 内菜单项只点亮 A 的窗格实例，
 *      B 与根单例都不动(真实经过组件交互，不直接调 store 方法)；
 *   ② 反证 = Provider 外回落根单例，点开关点亮根单例(单窗格形态零回归)。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

import { ModeSwitcher } from '@/components/chat/mode-switcher'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  AI_TOOLS_PANEL_STORAGE_KEY,
  aiToolsPanelPaneCount,
  getAiToolsPanelStoreForPane,
  resetAiToolsPanelPaneStores,
  useAiToolsPanelStore,
} from '@/stores/ai-tools-panel'

/** 打开 Radix DropdownMenu:走键盘路径(与仓内既有下拉测试同款)，再补一次 click 兜底 */
function openModeMenu(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(trigger)
}

function triggerOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="mode-switcher"]')
  if (!el) throw new Error('ModeSwitcher trigger 未渲染')
  return el as HTMLElement
}

beforeEach(() => {
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false })
  // 必须放在 setState 之后:persist 会在 setState 时写原键，清早了断言原键未被写会误报
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false })
  window.localStorage.clear()
})

describe('ModeSwitcher 工具面板开关按窗格寻址(G-935 缺口A)', () => {
  it('① 正向:两窗格各挂开关，点 A 内菜单项只点亮 A 的窗格实例', () => {
    const viewA = render(
      <ChatPaneProvider paneId="pane-tools-a">
        <ModeSwitcher />
      </ChatPaneProvider>,
    )
    render(
      <ChatPaneProvider paneId="pane-tools-b">
        <ModeSwitcher />
      </ChatPaneProvider>,
    )
    // 开关读的是窗格实例:两份 ModeSwitcher 渲染时就各自建了实例(旧实现写根单例 ⇒ 0)
    expect(aiToolsPanelPaneCount()).toBe(2)

    openModeMenu(triggerOf(viewA.container))
    fireEvent.click(screen.getByTestId('menu-tools-panel'))

    expect(getAiToolsPanelStoreForPane('pane-tools-a').getState().open).toBe(true)
    expect(getAiToolsPanelStoreForPane('pane-tools-b').getState().open).toBe(false)
    expect(useAiToolsPanelStore.getState().open).toBe(false)
    // 窗格态只落窗格键,原全局键一个字节没被写(既有偏好通道不被窗格态污染)
    expect(window.localStorage.getItem(AI_TOOLS_PANEL_STORAGE_KEY)).toBeNull()
  })

  it('② 反证:Provider 外(单窗格形态)点开关点亮根单例，窗格实例不被创建', () => {
    const view = render(<ModeSwitcher />)
    expect(aiToolsPanelPaneCount()).toBe(0)

    openModeMenu(triggerOf(view.container))
    fireEvent.click(screen.getByTestId('menu-tools-panel'))

    expect(useAiToolsPanelStore.getState().open).toBe(true)
    expect(aiToolsPanelPaneCount()).toBe(0)
  })
})
// // [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
