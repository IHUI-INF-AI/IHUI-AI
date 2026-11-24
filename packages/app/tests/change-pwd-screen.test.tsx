// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 修改密码共享屏的两条注入点判据(第三批回补):
//   1. `inputMaxLength` 必须真的落到原生 TextInput 的 maxLength 上 —— 小程序原页三个框
//      都是 `maxlength={20}` 硬截断,重写薄壳时丢了;只写在 props 类型里不落输入框等于没修。
//   2. `errorVisibility` 必须控住错误出现时机,且缺省 `'on-change'` 与 web/RN、小程序原页同语义。
//
// 断言取 fake TextInput 落进 DOM 的属性,不取截图:maxLength 是原生输入框的行为开关。

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { ChangePwdScreen } from '../src/features/change-pwd/ChangePwdScreen'

vi.mock('lucide-react-native', () => ({
  ChevronLeft: (p: Record<string, unknown>) => createElement('i', p),
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const TextInput = (props: Record<string, unknown>) =>
    createElement('input', {
      'data-testid': 'rn-textinput',
      'data-style': JSON.stringify(flatten(props.style)),
      maxLength: props.maxLength as number | undefined,
      value: props.value as string | undefined,
      onChange: (e: { target: { value: string } }) =>
        (props.onChangeText as ((v: string) => void) | undefined)?.(e.target.value),
    })
  const View = (p: Record<string, unknown>) => createElement('div', p)
  const Text = (p: Record<string, unknown>) => createElement('span', p)
  const TouchableOpacity = (p: Record<string, unknown>) =>
    createElement('div', { onClick: p.onPress as never }, p.children as never)
  const Pressable = TouchableOpacity
  return {
    TextInput,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet: { flatten, create: (s: unknown) => s },
    Platform: { OS: 'web' },
    PixelRatio: { getFontScale: () => 1 },
  }
})

const t = (k: string) => k

function renderScreen(props: Record<string, unknown> = {}) {
  return render(
    createElement(ChangePwdScreen, {
      t,
      onBack: () => {},
      oldPwd: '',
      newPwd: 'abc',
      confirmPwd: 'abc',
      showOld: false,
      showNew: false,
      showConfirm: false,
      submitting: false,
      onOldChange: () => {},
      onNewChange: () => {},
      onConfirmChange: () => {},
      onToggleOld: () => {},
      onToggleNew: () => {},
      onToggleConfirm: () => {},
      onSubmit: () => {},
      // 端口闸会把 `() => {}` 判成"空实现"(assertRequiredPort),桩必须带实参使用
      onNavigate: (target: string) => {
        void target
      },
      onToast: (msg: string) => {
        void msg
      },
      ...props,
    } as never),
  )
}

const inputsOf = (c: { container: HTMLElement }) =>
  Array.from(c.container.querySelectorAll('[data-testid="rn-textinput"]')) as HTMLElement[]

describe('inputMaxLength:硬截断必须落到三个输入框', () => {
  it('传 20 ⇒ 旧/新/确认三个原生输入框都带 maxLength=20', () => {
    const r = renderScreen({ inputMaxLength: 20 })
    const inputs = inputsOf(r)
    expect(inputs).toHaveLength(3)
    for (const el of inputs) expect(el.getAttribute('maxlength')).toBe('20')
  })

  it('不传 ⇒ 三个框都没有 maxLength(web/RN 既有行为零变化)', () => {
    const inputs = inputsOf(renderScreen())
    for (const el of inputs) expect(el.getAttribute('maxlength')).toBeNull()
  })
})

describe('errorVisibility:错误出现时机', () => {
  it("缺省('on-change')⇒ 错误值非空即显(与 web/RN、小程序原页同语义)", () => {
    const r = renderScreen({ newPwdError: 'tooShort', confirmPwdError: 'mismatch' })
    expect(r.container.textContent).toContain('tooShort')
    expect(r.container.textContent).toContain('mismatch')
  })

  it("'on-submit' ⇒ 未点提交前不显;点一次提交后才显", () => {
    const r = renderScreen({
      newPwdError: 'tooShort',
      errorVisibility: 'on-submit',
      onSubmit: () => {},
    })
    expect(r.container.textContent).not.toContain('tooShort')
    const btn = r.container.querySelector('[data-testid="rn-textinput"]') // 占位:确保渲染完成
    expect(btn).toBeTruthy()
    // 提交按钮是 TouchableOpacity 桩(div):按文案定位
    const submit = Array.from(r.container.querySelectorAll('div')).find(
      (el) => (el.textContent || '').trim() === 'common.confirm',
    )
    expect(submit, '未找到提交按钮 ⇒ 判据未生效').toBeTruthy()
    fireEvent.click(submit as HTMLElement)
    expect(r.container.textContent).toContain('tooShort')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
