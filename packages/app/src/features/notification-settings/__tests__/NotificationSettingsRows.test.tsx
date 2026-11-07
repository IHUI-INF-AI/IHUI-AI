// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NotificationSettingsScreenProps, TFunction } from '@ihui/types'
import { NotificationSettingsScreen } from '../NotificationSettingsScreen'

const t = ((key: string) => key) as unknown as TFunction

const baseProps: NotificationSettingsScreenProps = {
  t,
  items: [],
  loading: false,
  saving: false,
  error: '',
  success: '',
  onToggle: vi.fn(),
  onSave: vi.fn(),
  onBack: vi.fn(),
}

// 守门 theme-prop-wiring：主题驱动组件的渲染点必须显式接线（字面量与漏传同红）。
const testColorScheme: 'light' | 'dark' = 'light'

afterEach(cleanup)

describe('NotificationSettingsScreen 端侧数据驱动', () => {
  it('items 正向：逐行渲染服务端偏好键的 label', () => {
    render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[
          { key: 'pushEnabled', label: '推送', enabled: true },
          { key: 'messageEnabled', label: '消息', enabled: false },
        ]}
      />,
    )
    expect(screen.getByText('推送')).toBeTruthy()
    expect(screen.getByText('消息')).toBeTruthy()
  })

  it('阴性对照：抹掉一行 item，该行 label 必不出现', () => {
    render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[{ key: 'pushEnabled', label: '推送', enabled: true }]}
      />,
    )
    expect(screen.getByText('推送')).toBeTruthy()
    expect(screen.queryByText('消息')).toBeNull()
  })

  it('items 为空走空态，不渲染任何行 label', () => {
    render(<NotificationSettingsScreen {...baseProps} />)
    expect(screen.queryByText('推送')).toBeNull()
    expect(screen.getByText('common.empty')).toBeTruthy()
  })

  it('extraLinks 正向：标题 + 每行 label/desc 都由共享屏渲染', () => {
    render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[{ key: 'pushEnabled', label: '推送', enabled: true }]}
        extraLinksTitle="更多入口"
        extraLinks={[
          { key: 'a', label: '入口甲', desc: '甲说明', onPress: vi.fn() },
          { key: 'b', label: '入口乙', onPress: vi.fn() },
        ]}
      />,
    )
    expect(screen.getByText('更多入口')).toBeTruthy()
    expect(screen.getByText('入口甲')).toBeTruthy()
    expect(screen.getByText('甲说明')).toBeTruthy()
    expect(screen.getByText('入口乙')).toBeTruthy()
  })

  it('阴性对照：不传 extraLinks 时标题与入口行都不出现', () => {
    render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[{ key: 'pushEnabled', label: '推送', enabled: true }]}
        extraLinksTitle="更多入口"
      />,
    )
    expect(screen.queryByText('更多入口')).toBeNull()
    expect(screen.queryByText('入口甲')).toBeNull()
  })

  it('showHeader 默认 true 渲染标题；显式 false（小程序端）不渲染', () => {
    const { unmount } = render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[{ key: 'pushEnabled', label: '推送', enabled: true }]}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.getByText('settings.notificationsTitle')).toBeTruthy()
    unmount()
    render(
      <NotificationSettingsScreen
        {...baseProps}
        items={[{ key: 'pushEnabled', label: '推送', enabled: true }]}
        showHeader={false}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.queryByText('settings.notificationsTitle')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
