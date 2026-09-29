// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享输入框 TextField 的判据锁(packages/app 层唯一实现)。
//
// 这个文件存在的理由不是"组件能渲染",而是钉住三件在别处会静默坏掉的事:
//   1. **聚焦必须取墨档**(亮 #000000 / 暗 #FFFFFF)—— 用户报"所有输入框的激活态描边没了",
//      根因就是这一族在 60+ 个输入框里从来没写过;写成 brandAccent(蓝)或 surface.light
//      (深色档案下 #262626,压在同色页面上等于没有)都会让"有聚焦态"这件事账面成立而屏幕上看不见。
//   2. **常态必须已经占好 1px 边框位**,聚焦只换颜色 —— 聚焦才加粗会让整屏内容跳动
//      (web 端 `border border-input` → `focus-visible:border-primary` 同样是换色不换宽)。
//   3. **调用方自带描边时不得被本组件覆盖** —— 否则登录页等已定稿的输入框会被顺手改脸。
//
// 断言取的是 fake TextInput 落进 DOM 的 `data-style`(flatten 后的样式对象),而不是截图:
// 颜色值必须逐字比,jsdom 会把 '#000000' 归一成 'rgb(0, 0, 0)',拿它当判据就得先归一化两边,
// 而那层归一化本身会成为新的失明点。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { TextField } from '../src/components/TextField'

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style == null) return {}
    if (Array.isArray(style)) return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const TextInput = (props: Record<string, unknown>) => {
    const flat = flatten(props.style)
    return createElement('input', {
      'data-testid': 'rn-textinput',
      'data-style': JSON.stringify(flat),
      onFocus: props.onFocus as (() => void) | undefined,
      onBlur: props.onBlur as (() => void) | undefined,
    })
  }
  const View = (p: Record<string, unknown>) => createElement('div', p)
  const Text = (p: Record<string, unknown>) => createElement('span', p)
  const StyleSheet = { flatten, create: (s: unknown) => s }
  return { TextInput, View, Text, StyleSheet, Platform: { OS: 'web' } }
})

const styleOf = (el: HTMLElement) => JSON.parse(el.getAttribute('data-style') || '{}') as Record<string, string>

const renderField = (props: Record<string, unknown> = {}) => {
  const r = render(createElement(TextField, { colorScheme: 'light', placeholder: 'p', ...props } as never))
  // 取容器内节点而不是全局 testId:该包的 vitest 配置未开 globals,RTL 的自动 cleanup
  // 不会在每个用例后拆 DOM,同名 testId 会在第二个用例上撞成"multiple elements"。
  const input = r.container.querySelector('[data-testid="rn-textinput"]') as HTMLElement
  expect(input).toBeTruthy()
  return { input }
}

describe('TextField 聚焦描边', () => {
  it('常态取 1px 透明描边占位 —— 聚焦不得改宽度,只换颜色', () => {
    const { input } = renderField()
    const rest = styleOf(input)
    expect(rest.borderWidth).toBe(1)
    expect(rest.borderColor).toBe('transparent')

    fireEvent.focus(input)
    const focus = styleOf(input)
    expect(focus.borderWidth).toBe(1)
    expect(focus.borderColor).not.toBe('transparent')
  })

  it('浅色聚焦 = 纯黑 #000000(墨档),不是 brandAccent 蓝、也不是 surface 灰', () => {
    const { input } = renderField()
    fireEvent.focus(input)
    expect(styleOf(input).borderColor).toBe('#000000')
  })

  it('深色聚焦 = 纯白 #FFFFFF —— 旧写法取 surface.light 在深色页上是 #262626,等于看不见', () => {
    const { input } = renderField({ colorScheme: 'dark' })
    fireEvent.focus(input)
    expect(styleOf(input).borderColor).toBe('#FFFFFF')
  })

  it('失焦回到常态(聚焦态不得粘住)', () => {
    const { input } = renderField()
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(styleOf(input).borderColor).toBe('transparent')
  })

  it('调用方自带描边时逐字生效(本组件不得覆盖已定稿外观)', () => {
    const { input } = renderField({ style: { borderWidth: 2, borderColor: '#123456', height: 40 } })
    expect(styleOf(input)).toMatchObject({ borderWidth: 2, borderColor: '#123456', height: 40 })
  })

  it('focusedStyle 排在共享墨档之后,供登录页这类"聚焦加粗"的差异需求覆盖', () => {
    const { input } = renderField({ focusedStyle: { borderWidth: 2 } })
    fireEvent.focus(input)
    expect(styleOf(input).borderWidth).toBe(2)
    expect(styleOf(input).borderColor).toBe('#000000')
  })

  it('onFocus/onBlur 透传给调用方(内部记账不得吃掉宿主回调)', () => {
    let inCalls = 0
    let outCalls = 0
    const { input } = renderField({ onFocus: () => inCalls++, onBlur: () => outCalls++ })
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(inCalls).toBe(1)
    expect(outCalls).toBe(1)
  })
})

describe('TextField 与 web/小程序同源', () => {
  it('web 端聚焦仍是 border-primary(墨档),三端取同一档而非各取一档', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const css = readFileSync(join(here, '../../ui-react/src/components/input.tsx'), 'utf8')
    expect(css).toMatch(/focus-visible:border-primary/)
    expect(css).toMatch(/border border-input/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
