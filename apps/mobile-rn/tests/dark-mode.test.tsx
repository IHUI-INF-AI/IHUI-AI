/**
 * 深色模式单元测试
 *
 * 验证 packages/app 共享层:
 * - getTokens(theme) 动态返回 light/dark token 集
 * - base tokens 保留(向后兼容 RootNavigator Tab Bar)
 * - SettingsScreen 接收 colorScheme prop 时根 View 背景色正确切换
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

vi.mock('react-native', () => {
  const { createElement } = require('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      return createElement(tag, props, props.children)
    }
  const Switch = (props: { value?: boolean; onValueChange?: (v: boolean) => void }) =>
    createElement('input', { type: 'checkbox', checked: !!props.value, readOnly: true })
  const Modal = (props: { visible?: boolean; children?: ReactNode }) =>
    props.visible ? createElement('div', null, props.children) : null
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    TextInput: mk('input'),
    Switch,
    Modal,
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

vi.mock('solito/link', () => ({
  TextLink: (props: { children?: ReactNode; textProps?: { style?: unknown } }) =>
    createElement('a', null, props.children),
}))

import { getTokens, lightTokens, darkTokens, tokens, SettingsScreen } from '@ihui/app'
import type { SettingsScreenProps } from '@ihui/app'

describe('getTokens 动态 token 逻辑', () => {
  it("getTokens('light') === lightTokens", () => {
    expect(getTokens('light')).toBe(lightTokens)
  })

  it("getTokens('dark') === darkTokens", () => {
    expect(getTokens('dark')).toBe(darkTokens)
  })

  it("getTokens('light').surface.bg === '#FFFFFF'", () => {
    expect(getTokens('light').surface.bg).toBe('#FFFFFF')
  })

  it("getTokens('dark').surface.bg === '#1F2937'", () => {
    expect(getTokens('dark').surface.bg).toBe('#1F2937')
  })

  it('明暗模式 surface.bg 不同(核心:暗色模式真的不同)', () => {
    expect(getTokens('light').surface.bg).not.toBe(getTokens('dark').surface.bg)
  })

  it("getTokens('dark').surface.bg === tokens.surface.dark(与 RootNavigator Tab Bar 一致)", () => {
    expect(getTokens('dark').surface.bg).toBe(tokens.surface.dark)
  })
})

describe('base tokens 保留(向后兼容 RootNavigator)', () => {
  it("tokens.surface.dark === '#1F2937'(RootNavigator Tab Bar 仍用)", () => {
    expect(tokens.surface.dark).toBe('#1F2937')
  })

  it("tokens.surface.light === '#FFFFFF'", () => {
    expect(tokens.surface.light).toBe('#FFFFFF')
  })
})

function makeProps(overrides: Partial<SettingsScreenProps> = {}): SettingsScreenProps {
  return {
    t: (key: string) => key,
    locale: 'zh-CN',
    localeOptions: [{ value: 'zh-CN', label: '中文' }],
    onSelectLocale: () => {},
    theme: 'light',
    themeOptions: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
    onSelectTheme: () => {},
    notifications: { push: true, message: true, email: false },
    onToggleNotification: () => {},
    onChangePassword: async () => true,
    onAlert: () => {},
    onConfirm: () => {},
    onLogout: () => {},
    menuItems: [],
    onMenuPress: () => {},
    ...overrides,
  }
}

describe('SettingsScreen colorScheme prop 渲染', () => {
  it('colorScheme="dark" → 根容器 backgroundColor 为 #1F2937', () => {
    const { container } = render(<SettingsScreen {...makeProps({ colorScheme: 'dark' })} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toMatch(/rgb\(31,\s*41,\s*55\)/i)
  })

  it('colorScheme="light"(显式) → 根容器 backgroundColor 为 #FFFFFF', () => {
    const { container } = render(<SettingsScreen {...makeProps({ colorScheme: 'light' })} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)/i)
  })

  it('不传 colorScheme(默认 light) → 根容器 backgroundColor 为 #FFFFFF', () => {
    const { container } = render(<SettingsScreen {...makeProps()} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)/i)
  })
})
