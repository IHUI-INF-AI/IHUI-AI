// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 2026-11-28:空会话任务中心直达。
 *
 * 缺陷:空会话里工具面板默认收起，任务中心藏在第 20 个页签，用户实际找不到入口。
 * 现在 + 菜单的「任务中心」一次点击 = open:true + activeTab:'unified'，且按窗格寻址。
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { TaskCenterToggle } from '@/components/chat/tools-panel-toggle'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  getAiToolsPanelStoreForPane,
  resetAiToolsPanelPaneStores,
  useAiToolsPanelStore,
} from '@/stores/ai-tools-panel'

beforeEach(() => {
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false, activeTab: 'plan' })
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false, activeTab: 'plan' })
  window.localStorage.clear()
})

describe('任务中心直达入口', () => {
  it('Provider 外:一次点击展开面板并切到 unified(空会话零消息同样可达)', () => {
    render(<TaskCenterToggle />)
    expect(useAiToolsPanelStore.getState().open).toBe(false)
    expect(useAiToolsPanelStore.getState().activeTab).toBe('plan')

    fireEvent.click(screen.getByTestId('menu-task-center'))

    expect(useAiToolsPanelStore.getState().open).toBe(true)
    expect(useAiToolsPanelStore.getState().activeTab).toBe('unified')
  })

  it('Provider 内:按窗格寻址，点 A 不点亮 B、也不污染根单例', () => {
    const viewA = render(
      <ChatPaneProvider paneId="pane-task-center-a">
        <TaskCenterToggle />
      </ChatPaneProvider>,
    )
    render(
      <ChatPaneProvider paneId="pane-task-center-b">
        <TaskCenterToggle />
      </ChatPaneProvider>,
    )

    fireEvent.click(within(viewA.container).getByTestId('menu-task-center'))

    const a = getAiToolsPanelStoreForPane('pane-task-center-a').getState()
    const b = getAiToolsPanelStoreForPane('pane-task-center-b').getState()
    expect(a.open).toBe(true)
    expect(a.activeTab).toBe('unified')
    expect(b.open).toBe(false)
    expect(b.activeTab).toBe('plan')
    expect(useAiToolsPanelStore.getState().open).toBe(false)
    expect(useAiToolsPanelStore.getState().activeTab).toBe('plan')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
