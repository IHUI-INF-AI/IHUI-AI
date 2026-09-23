// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useUiTextField 登记钩子单测(2026-09-21 立)。
 *
 * 只测一件事:**登记之后 AI 的 fill 是否真的改变了界面状态**。
 * 证据链必须是"渲染真组件 → snapshotFields 见到它 → setValueOnField → 读回 DOM 的 value",
 * 而不是只断言注册表内部计数 —— 后者能在"回了 ok 而界面没动"的假成功下照样绿。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, createElement, useState } from 'react'
import { render } from '@testing-library/react'
import { TextInput } from 'react-native'

import {
  countRegisteredFields,
  readFieldValue,
  resetRnFieldRegistry,
  setValueOnField,
  snapshotFields,
  isSensitiveFieldText,
} from '../src/lib/ui-field-registry'
import { useUiTextField } from '../src/lib/use-ui-text-field'
import { InputArea } from '../src/components/InputArea'

interface HarnessProps {
  label?: string
  initial?: string
  secure?: boolean
  keyboardType?: string
  disabled?: boolean
  /** 只读框:组件根本没有 setter */
  readonly?: boolean
}

/** 一个最小真实组件:state 归它自己,钩子把这个 state 的 setter 交给注册表 */
function Harness({
  label = '请输入昵称',
  initial = '',
  secure,
  keyboardType,
  disabled,
  readonly = false,
}: HarnessProps) {
  const [text, setText] = useState(initial)
  useUiTextField({
    label,
    value: text,
    setValue: readonly ? undefined : (v: string) => setText(v),
    secure,
    keyboardType,
    disabled,
    maxLength: 20,
    multiline: true,
  })
  return createElement(TextInput, { value: text, placeholder: label })
}

function firstField() {
  return snapshotFields().elements[0]
}

beforeEach(() => {
  resetRnFieldRegistry()
})

describe('useUiTextField — 真证据链:fill 之后组件 state 真的变了', () => {
  it('挂载即入表,writable:true,约束与标签如实', () => {
    render(createElement(Harness))
    const snapshot = snapshotFields()
    expect(snapshot.elements).toHaveLength(1)
    expect(firstField()).toMatchObject({
      id: 'fld:input#1',
      kind: 'input',
      label: '请输入昵称',
      value: '',
      writable: true,
      constraint: 'multiline maxLength=20',
    })
  })

  it('setValueOnField 写入后,读回 DOM 的 value 与注册表 value 都是新值', () => {
    const { container } = render(createElement(Harness))
    const id = firstField()?.id ?? ''
    expect(id).not.toBe('')

    // 注册表写入发生在 React 事件系统之外,必须过 act 才能观察到重渲染后的 DOM
    act(() => {
      setValueOnField(id, 'AI 写的')
    })

    const input = container.querySelector('input') as HTMLInputElement | null
    expect(input?.value).toBe('AI 写的')
    expect(readFieldValue(id)).toBe('AI 写的')
    expect(firstField()?.value).toBe('AI 写的')
  })

  it('父组件改标签后快照读到的是当下值(证明没有陈旧闭包)', () => {
    const { rerender } = render(createElement(Harness, { label: '请输入昵称' }))
    expect(firstField()?.label).toBe('请输入昵称')
    rerender(createElement(Harness, { label: '改个名字' }))
    expect(firstField()?.label).toBe('改个名字')
  })

  it('id 在同一 mount 实例内恒定:重渲染不换位、不重新申领', () => {
    const { rerender } = render(createElement(Harness, { initial: '甲' }))
    const before = firstField()?.id
    rerender(createElement(Harness, { initial: '甲' }))
    rerender(createElement(Harness, { initial: '乙' }))
    expect(firstField()?.id).toBe(before)
    expect(countRegisteredFields()).toBe(1)
  })

  it('卸载即摘除:旧 id 定位失败而不是漂到别的控件', () => {
    const { unmount } = render(createElement(Harness))
    const id = firstField()?.id ?? ''
    unmount()
    expect(countRegisteredFields()).toBe(0)
    expect(setValueOnField(id, 'x').errorCode).toBe('SELECTOR_NOT_FOUND')
  })
})

describe('useUiTextField — 敏感面与无写入通道', () => {
  it('secure 输入框在 snapshotFields 里根本不出现', () => {
    render(createElement(Harness, { label: '请输入登录口令', secure: true }))
    expect(snapshotFields().elements).toEqual([])
    expect(countRegisteredFields()).toBe(0)
  })

  it('keyboardType=password / visible-password 同样完全不注册', () => {
    render(createElement(Harness, { label: '交易口令', keyboardType: 'password' }))
    render(createElement(Harness, { label: '交易口令二', keyboardType: 'visible-password' }))
    expect(snapshotFields().elements).toEqual([])
  })

  it('只读框(组件交出 setter 前 state 不可写):入表但 writable:false,fill 如实失败', () => {
    render(createElement(Harness, { label: '邮箱', readonly: true, initial: 'a@b.c' }))
    const el = firstField()
    expect(el).toMatchObject({ label: '邮箱', value: 'a@b.c', writable: false })
    const res = setValueOnField(el?.id ?? '', '改成别的')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('disabled 为真时 fill 失败,且读回的是当下 disabled 而不是首帧', () => {
    const { rerender } = render(createElement(Harness, { label: '正在提交', disabled: true }))
    const el = firstField()
    expect(el?.disabled).toBe(true)
    expect(setValueOnField(el?.id ?? '', 'x').errorCode).toBe('EXECUTION_FAILED')
    rerender(createElement(Harness, { label: '正在提交', disabled: false }))
    expect(firstField()?.disabled).toBeUndefined()
  })

  it('标签命中注册表自身的敏感文本判据时拒绝入表(钩子不与之对抗)', () => {
    render(createElement(Harness, { label: '短信验证码' }))
    expect(snapshotFields().elements).toEqual([])
  })

  it('「Max Tokens」是计量单位不是凭据:必须可填;而真凭据语境仍一律吞掉', () => {
    // 计量语境:token 在这里是单位,判敏感会让 AI 对着一个不存在的字段(ModelConfigDialog 实测少 1/4)
    expect(isSensitiveFieldText('Max Tokens')).toBe(false)
    expect(isSensitiveFieldText('输出 tokens 上限')).toBe(false)
    expect(isSensitiveFieldText('上下文窗口')).toBe(false)
    render(createElement(Harness, { label: 'Max Tokens', initial: '4096' }))
    const el = firstField()
    expect(el).toMatchObject({ label: 'Max Tokens', writable: true })
    act(() => {
      setValueOnField(el?.id ?? '', '8192')
    })
    expect(el && readFieldValue(el.id)).toBe('8192')

    // 凭据语境:漏放才是不可逆的那一侧
    expect(isSensitiveFieldText('Access Token')).toBe(true)
    expect(isSensitiveFieldText('API Token')).toBe(true)
    expect(isSensitiveFieldText('访问令牌')).toBe(true)
    expect(isSensitiveFieldText('Token')).toBe(true)
  })
})

describe('业务真组件:InputArea 的裸 TextInput 接入后对 AI 可见可写', () => {
  it('挂载后 snapshotFields 出现该框,fill 之后 DOM value 与父组件 state 一起变', () => {
    let parentValue = ''
    function Host() {
      const [v, setV] = useState('')
      parentValue = v
      return createElement(InputArea, {
        value: v,
        onChangeText: setV,
        placeholder: '请输入您的问题',
        onSubmit: () => {},
      })
    }
    const { container } = render(createElement(Host))
    const el = firstField()
    expect(el).toMatchObject({ label: '请输入您的问题', writable: true, kind: 'input' })

    act(() => {
      setValueOnField(el?.id ?? '', 'AI 写的问题')
    })
    // 两道独立证据:父组件 state 真回流了,且界面(受控 input 的 DOM value)跟着变了
    expect(parentValue).toBe('AI 写的问题')
    const input = container.querySelector('input') as HTMLInputElement | null
    expect(input?.value).toBe('AI 写的问题')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
