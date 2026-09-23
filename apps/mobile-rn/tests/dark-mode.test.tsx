// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { type ReactNode } from 'react'

vi.mock('react-native', async () => {
  const { createElement } = await import('react')
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

import {
  getTokens,
  lightTokens,
  darkTokens,
  tokens,
  SettingsScreen,
  type SettingsScreenProps,
} from '@ihui/rn-app'

describe('getTokens 动态 token 逻辑', () => {
  it("getTokens('light') === lightTokens", () => {
    expect(getTokens('light')).toBe(lightTokens)
  })

  it("getTokens('dark') === darkTokens", () => {
    expect(getTokens('dark')).toBe(darkTokens)
  })

  // 断言值 = packages/design-tokens/src/rn-tokens.ts 的真值。
  // 2026-09-04 起浅色页面是 #F5F5F5(浅灰页面 + 白卡分层,对齐 web --color-background),
  // 深色页面是 #242424(替换原蓝灰 #1F2937)。此前本文件断言的是替换前的旧值,
  // 因为 @ihui/rn-app 测试替身里手抄了同一批旧字面值 ⇒ 色板改了几轮测试毫无反应。
  it("getTokens('light').surface.bg === '#F5F5F5'", () => {
    expect(getTokens('light').surface.bg).toBe('#F5F5F5')
  })

  it("getTokens('dark').surface.bg === '#242424'", () => {
    expect(getTokens('dark').surface.bg).toBe('#242424')
  })

  it('明暗模式 surface.bg 不同(核心:暗色模式真的不同)', () => {
    expect(getTokens('light').surface.bg).not.toBe(getTokens('dark').surface.bg)
  })

  // 卡片必须与页面分层(浅色白卡压灰页 / 深色深卡压浅一点的灰页),
  // 这是"容器背景没统一"那批报修的反例锚点。
  it('surface.card 与 surface.bg 两态均不同(卡片分层成立)', () => {
    expect(getTokens('light').surface.card).toBe('#FFFFFF')
    expect(getTokens('dark').surface.card).toBe('#1A1A1A')
    expect(getTokens('light').surface.card).not.toBe(getTokens('light').surface.bg)
    expect(getTokens('dark').surface.card).not.toBe(getTokens('dark').surface.bg)
  })

  // 旧断言 `dark.surface.bg === tokens.surface.dark` 已随 2026-09-04 色板对齐失效
  // (深页 #242424 vs base surface.dark #262626),不再作为不变量维护;
  // Tab Bar 取的是 base tokens.surface.dark,单独钉住它。
  it("tokens.surface.dark === '#262626'(RootNavigator Tab Bar 仍用)", () => {
    expect(tokens.surface.dark).toBe('#262626')
  })
})

describe('base tokens 保留(向后兼容 RootNavigator)', () => {
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
    onBack: () => {},
    ...overrides,
  }
}

/** #RRGGBB → DOM 的 rgb(r, g, b) 写法 */
function rgbOf(hex: string): string {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

describe('SettingsScreen colorScheme prop 渲染', () => {
  // 渲染层只钉"组件是否跟随 colorScheme 取 tk.surface.bg";色板**绝对值**由上面的
  // getTokens 单元断言钉死(#F5F5F5 / #242424)。若在此再抄一份字面值,色板一改就假红。
  it('colorScheme="dark" → 根容器 backgroundColor = 深色 surface.bg', () => {
    const { container } = render(<SettingsScreen {...makeProps({ colorScheme: 'dark' })} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toBe(rgbOf(getTokens('dark').surface.bg))
  })

  it('colorScheme="light"(显式) → 根容器 backgroundColor = 浅色 surface.bg', () => {
    const { container } = render(<SettingsScreen {...makeProps({ colorScheme: 'light' })} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toBe(rgbOf(getTokens('light').surface.bg))
  })

  it('不传 colorScheme(默认 light) → 根容器 backgroundColor = 浅色 surface.bg', () => {
    const { container } = render(<SettingsScreen {...makeProps()} />)
    const root = container.firstChild as HTMLElement
    expect(root.style.backgroundColor).toBe(rgbOf(getTokens('light').surface.bg))
  })

  it('同一组件两态取到不同底色(colorScheme 真的生效)', () => {
    const dark = render(<SettingsScreen {...makeProps({ colorScheme: 'dark' })} />)
    const light = render(<SettingsScreen {...makeProps({ colorScheme: 'light' })} />)
    expect((dark.container.firstChild as HTMLElement).style.backgroundColor).not.toBe(
      (light.container.firstChild as HTMLElement).style.backgroundColor,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
