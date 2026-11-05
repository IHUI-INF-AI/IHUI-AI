// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SecuritySettingsScreenProps, SecuritySettingsSection, TFunction } from '@ihui/types'
import { SecuritySettingsScreen } from '../SecuritySettingsScreen'

const t = ((key: string) => key) as unknown as TFunction

// 守门 theme-prop-wiring：主题驱动组件的渲染点必须显式接线（字面量与漏传同红）。
const testColorScheme: 'light' | 'dark' = 'light'

const SECTIONS: readonly SecuritySettingsSection[] = [
  {
    key: 'permissions',
    title: '系统权限',
    items: [
      {
        key: 'camera',
        label: '相机',
        stateText: '已授权',
        stateTone: 'success',
        action: { label: '去设置', onPress: vi.fn() },
      },
      { key: 'location', label: '位置', stateText: '已拒绝', stateTone: 'danger' },
    ],
  },
  {
    key: 'privacy',
    title: '隐私设置',
    items: [
      { key: 'mute', label: '个性化推荐', desc: '说明', value: true, onToggle: vi.fn() },
    ],
  },
]

const baseProps: SecuritySettingsScreenProps = {
  t,
  sections: SECTIONS,
  loading: false,
  error: '',
  onBack: vi.fn(),
}

afterEach(cleanup)

describe('SecuritySettingsScreen 端侧数据驱动', () => {
  it('sections 正向：标题/行/读数/尾部动作都由共享屏渲染', () => {
    render(<SecuritySettingsScreen {...baseProps} colorScheme={testColorScheme} />)
    expect(screen.getByText('系统权限')).toBeTruthy()
    expect(screen.getByText('隐私设置')).toBeTruthy()
    expect(screen.getByText('相机')).toBeTruthy()
    expect(screen.getByText('已授权')).toBeTruthy()
    expect(screen.getByText('已拒绝')).toBeTruthy()
    expect(screen.getByText('去设置')).toBeTruthy()
    expect(screen.getByText('个性化推荐')).toBeTruthy()
    expect(screen.getByText('说明')).toBeTruthy()
  })

  it('阴性对照：抹掉一行 item，该行 label 必不出现', () => {
    const trimmed: SecuritySettingsSection[] = [
      { ...SECTIONS[0], items: SECTIONS[0].items.slice(0, 1) },
      SECTIONS[1],
    ]
    render(
      <SecuritySettingsScreen
        {...baseProps}
        sections={trimmed}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.getByText('相机')).toBeTruthy()
    expect(screen.queryByText('位置')).toBeNull()
  })

  it('sections 为空走空态，不凭空造行', () => {
    render(<SecuritySettingsScreen {...baseProps} sections={[]} colorScheme={testColorScheme} />)
    expect(screen.queryByText('相机')).toBeNull()
    expect(screen.getByText('common.empty')).toBeTruthy()
  })

  it('只读行不得长假开关；显式给 onToggle 才渲染开关（正反对照）', () => {
    const { container: readOnly } = render(
      <SecuritySettingsScreen {...baseProps} colorScheme={testColorScheme} />,
    )
    expect(readOnly.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)

    cleanup()
    const noToggle = render(
      <SecuritySettingsScreen
        {...baseProps}
        sections={[{ key: 'p', items: [{ key: 'camera', label: '相机', stateText: '已授权' }] }]}
        colorScheme={testColorScheme}
      />,
    )
    expect(noToggle.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('showHeader 默认 true 渲染标题；显式 false（小程序端）不渲染', () => {
    const { unmount } = render(
      <SecuritySettingsScreen {...baseProps} colorScheme={testColorScheme} />,
    )
    expect(screen.getByText('securitySettings.title')).toBeTruthy()
    unmount()
    render(
      <SecuritySettingsScreen
        {...baseProps}
        showHeader={false}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.queryByText('securitySettings.title')).toBeNull()
  })

  it('footerLink 正向渲染；缺省不渲染（阴性对照）', () => {
    render(
      <SecuritySettingsScreen
        {...baseProps}
        footerLink={{ label: '隐私政策', onPress: vi.fn() }}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.getByText('隐私政策')).toBeTruthy()

    cleanup()
    render(<SecuritySettingsScreen {...baseProps} colorScheme={testColorScheme} />)
    expect(screen.queryByText('隐私政策')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
