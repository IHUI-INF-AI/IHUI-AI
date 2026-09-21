// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 控件注册表单测(2026-09-21 立)。
 *
 * 覆盖三件事:
 * 1. 诚实性 —— 没通道 / 没注册 / 已卸载 一律失败,不存在"回了 ok 而界面没动";
 * 2. id 稳定性 —— 重渲染、别处挂载卸载,老 id 不会漂到另一个控件上;
 * 3. 敏感面永不入表 —— 密码/验证码/支付/注销连 describe 都不出现。
 *
 * 另附一条真组件证据链:渲染 @ihui/ui-native 的 Input / Button(jsdom 下 react-native 已被
 * alias 成原生标签),fill 之后**读回 DOM 的 value**、click 之后断言 onPress 真的被调到。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createElement, act } from 'react'
import { render } from '@testing-library/react'
import { Button, Input } from '@ihui/ui-native'

import {
  countRegisteredFields,
  pressField,
  readFieldValue,
  registerRnField,
  resetRnFieldRegistry,
  setValueOnField,
  setFieldGroupProvider,
  snapshotFields,
  submitForm,
  isDestructiveFieldText,
  isSensitiveFieldText,
  type RnFieldSpec,
} from '../src/lib/ui-field-registry'

/**
 * 一个"组件"的最小模拟:state 归组件自己持有,write 就是它的 setState。
 * 注册表只经手这个 setter,所以"写入生效"与"组件真的改了 state"是同一件事。
 */
function mountFake(spec: Partial<RnFieldSpec> & { kind?: RnFieldSpec['kind'] }) {
  let state = ''
  let writes = 0
  const full: RnFieldSpec = {
    kind: 'input',
    label: () => '昵称',
    value: () => state,
    writable: () => true,
    write: (text) => {
      state = text
      writes += 1
    },
    ...spec,
  }
  const handle = registerRnField(full)
  return {
    handle,
    get state() {
      return state
    },
    get writes() {
      return writes
    },
  }
}

beforeEach(() => {
  resetRnFieldRegistry()
})

describe('register — 安全面黑名单', () => {
  it('敏感框与破坏性按钮一律拒绝入表(register 返回 null,describe 里不存在)', () => {
    expect(isSensitiveFieldText('登录密码')).toBe(true)
    expect(isSensitiveFieldText('短信验证码')).toBe(true)
    expect(isSensitiveFieldText('API Token')).toBe(true)
    expect(isDestructiveFieldText('删除账号')).toBe(true)
    expect(isDestructiveFieldText('注销登录')).toBe(true)
    expect(isDestructiveFieldText('立即支付')).toBe(true)
    expect(isDestructiveFieldText('保存草稿')).toBe(false)

    expect(mountFake({ label: () => '登录密码' }).handle).toBeNull()
    expect(mountFake({ sensitive: () => true }).handle).toBeNull()
    expect(mountFake({ kind: 'button', label: () => '确认支付' }).handle).toBeNull()
    expect(countRegisteredFields()).toBe(0)
    expect(snapshotFields().elements).toEqual([])
  })

  it('普通输入框正常入表,并带上 writable/pressable 结论', () => {
    mountFake({ label: () => '昵称', constraint: () => 'maxLength=20' })
    const snapshot = snapshotFields()
    expect(snapshot.elements).toHaveLength(1)
    expect(snapshot.elements[0]).toMatchObject({
      kind: 'input',
      label: '昵称',
      constraint: 'maxLength=20',
      writable: true,
    })
    // input 不谈 pressable:没有 onPress 通道就不该给这个字段
    expect(snapshot.elements[0]?.pressable).toBeUndefined()
  })
})

describe('id 稳定性 — describe 之后紧接的 fill 不得打偏', () => {
  it('id 形如 fld:<kind>#<序号>,同一控件重渲染(读值变化)不换 id', () => {
    const a = mountFake({ label: () => '昵称' })
    const idA = a.handle?.id
    expect(idA).toMatch(/^fld:input#\d+$/)
    // 组件多次"渲染":值变了、标签变了,但同一个 mount 实例的 id 不变
    setValueOnField(idA ?? '', 'first')
    const renamed = registerRnField({
      kind: 'input',
      label: () => '昵称(已改)',
      value: () => 'x',
      writable: () => true,
      write: () => undefined,
    })
    expect(renamed?.id).not.toBe(idA)
    expect(snapshotFields().elements.find((el) => el.id === idA)?.value).toBe('first')
  })

  it('两次 describe 之间有新挂载与卸载,老 id 仍指向原控件,不会前移到别的控件', () => {
    const a = mountFake({ label: () => 'A' })
    const b = mountFake({ label: () => 'B' })
    const idA = a.handle?.id as string
    const idB = b.handle?.id as string
    expect(snapshotFields().elements.map((e) => e.id)).toEqual([idA, idB])

    // B 卸载 + 新控件 C 挂载:若按"注册顺序下标"定位,A 之后就会读到 C
    b.handle?.dispose()
    const c = mountFake({ label: () => 'C' })
    const second = snapshotFields()
    expect(second.elements.map((e) => e.label)).toEqual([
      'A',
      c.handle?.id === undefined ? '' : 'C',
    ])
    expect(second.elements.find((e) => e.id === idA)?.label).toBe('A')
    expect(second.elements.some((e) => e.id === idB)).toBe(false)

    // 已卸载的 id 必须如实失败,而不是"顺手写到下一个控件"
    const gone = setValueOnField(idB, 'hi')
    expect(gone.ok).toBe(false)
    expect(gone.errorCode).toBe('SELECTOR_NOT_FOUND')
    expect(a.state).toBe('')
  })

  it('dispose 幂等:重复卸载不影响别的控件', () => {
    const a = mountFake({ label: () => 'A' })
    const b = mountFake({ label: () => 'B' })
    a.handle?.dispose()
    a.handle?.dispose()
    expect(countRegisteredFields()).toBe(1)
    expect(pressField(b.handle?.id ?? '').errorCode).toBe('UNSUPPORTED_ACTION')
  })
})

describe('fill — 写入必须真生效,否则如实失败', () => {
  it('写入走组件自己的 setState,并回读写到的新值', () => {
    const a = mountFake({ label: () => '昵称' })
    const res = setValueOnField(a.handle?.id ?? '', '张三')
    expect(res.ok).toBe(true)
    expect(a.state).toBe('张三')
    expect(a.writes).toBe(1)
    expect(res.data).toMatchObject({ valueWritten: '张三', valueAfter: '张三' })
    expect(readFieldValue('昵称')).toBe('张三')
  })

  it('受控告件(writable=false)回 UNSUPPORTED_ACTION,不写任何状态', () => {
    const a = mountFake({
      label: () => '运行时输入',
      writable: () => false,
      write: () => {
        throw new Error('受控输入不应被写入')
      },
    })
    const res = setValueOnField(a.handle?.id ?? '', 'x')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(res.error).toContain('未开放写入通道')
    expect(a.writes).toBe(0)
    // describe 里它仍然可见,但明确标着不可写
    expect(snapshotFields().elements[0]).toMatchObject({ writable: false })
  })

  it('非输入框(button)不接受 fill', () => {
    const btn = mountFake({ kind: 'button', label: () => '保存' })
    const res = setValueOnField(btn.handle?.id ?? '', 'x')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('disabled 的输入框如实 EXECUTION_FAILED,不报成功', () => {
    const a = mountFake({ label: () => '备注', disabled: () => true })
    const res = setValueOnField(a.handle?.id ?? '', 'x')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
    expect(a.writes).toBe(0)
  })

  it('空 target 与查不到的 target 都回 SELECTOR_NOT_FOUND,并说明 id 只在快照内有效', () => {
    mountFake({ label: () => '昵称' })
    for (const target of ['', '   ', 'fld:input#999']) {
      const res = setValueOnField(target, 'x')
      expect(res.ok).toBe(false)
      expect(res.errorCode).toBe('SELECTOR_NOT_FOUND')
      expect(res.error).toContain('describe')
    }
  })

  it('同名标签命中多个控件时不猜,把候选 id 交回调用方', () => {
    const a = mountFake({ label: () => '备注' })
    const b = mountFake({ label: () => '备注' })
    const res = setValueOnField('备注', 'x')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('SELECTOR_NOT_FOUND')
    expect(res.error).toContain(a.handle?.id as string)
    expect(res.error).toContain(b.handle?.id as string)
    expect(a.state).toBe('')
    expect(b.state).toBe('')
  })
})

describe('click — 只有交出 onPress 的控件可点', () => {
  it('没有 press 通道 → UNSUPPORTED_ACTION 并说明原因', () => {
    const btn = mountFake({ kind: 'button', label: () => '保存' })
    const spec = { ...btn }
    expect(spec).toBeTruthy()
    const res = pressField(btn.handle?.id ?? '')
    // mountFake 默认给的是 input 的 write,kind=button 没有 press → 必须失败
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(res.error).toContain('未开放触发通道')
  })

  it('禁用中的按钮点击无效(EXECUTION_FAILED),不去派发一次没人处理的事件', () => {
    let pressed = 0
    const btn = mountFake({
      kind: 'button',
      label: () => '保存',
      write: undefined,
      press: () => {
        pressed += 1
      },
      disabled: () => true,
    })
    const res = pressField(btn.handle?.id ?? '')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
    expect(pressed).toBe(0)
  })

  it('可点按钮真的调到组件交出的 onPress', () => {
    let pressed = 0
    const btn = mountFake({
      kind: 'button',
      label: () => '保存草稿',
      write: undefined,
      press: () => {
        pressed += 1
      },
    })
    const res = pressField(btn.handle?.id ?? '')
    expect(res.ok).toBe(true)
    expect(pressed).toBe(1)
    expect(snapshotFields().elements[0]).toMatchObject({ pressable: true })
  })

  it('onPress 抛错 → EXECUTION_FAILED(异常不外泄给桥层,也不报成功)', () => {
    const btn = mountFake({
      kind: 'button',
      label: () => '刷新列表',
      write: undefined,
      press: () => {
        throw new Error('业务组件崩了')
      },
    })
    const res = pressField(btn.handle?.id ?? '')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
    expect(res.error).toContain('业务组件崩了')
  })
})

describe('submit — 没有表单通道就直说', () => {
  it('页面没有任何表单时回 UNSUPPORTED_ACTION,不退化成随便点一个按钮', () => {
    mountFake({ kind: 'button', label: () => '保存', write: undefined, press: () => undefined })
    const res = submitForm()
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(res.error).toContain('没有注册任何表单')
  })

  it('唯一表单可无参提交;指定 id / 指定标签都能定位', () => {
    let submitted = 0
    const form = mountFake({
      kind: 'form',
      label: () => '登录表单',
      write: undefined,
      submit: () => {
        submitted += 1
      },
    })
    expect(submitForm().ok).toBe(true)
    expect(submitted).toBe(1)
    expect(submitForm(form.handle?.id).ok).toBe(true)
    expect(submitForm('登录表单').ok).toBe(true)
    expect(submitted).toBe(3)
    expect(snapshotFields().elements[0]).toMatchObject({ kind: 'form', pressable: true })
  })

  it('两个表单且未指定目标时不猜;指定了非表单定位符时如实拒绝', () => {
    const a = mountFake({
      kind: 'form',
      label: () => '表单甲',
      write: undefined,
      submit: () => undefined,
    })
    mountFake({ kind: 'form', label: () => '表单乙', write: undefined, submit: () => undefined })
    const ambiguous = submitForm()
    expect(ambiguous.ok).toBe(false)
    expect(ambiguous.errorCode).toBe('SELECTOR_NOT_FOUND')
    const wrongKind = submitForm(a.handle ? '表单乙' : '缺失')
    expect(wrongKind.ok).toBe(true)
    const notForm = mountFake({ kind: 'button', label: () => '提交订单', write: undefined })
    const res = submitForm('提交订单')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(notForm.handle?.id).toBeTruthy()
  })
})

describe('上限与诚实计数', () => {
  it('超出上限的控件计入 suppressed 而不是静默丢弃', () => {
    for (let i = 0; i < 65; i += 1) mountFake({ label: () => `字段${i}` })
    const snapshot = snapshotFields(60)
    expect(snapshot.elements).toHaveLength(60)
    expect(snapshot.suppressed).toBe(5)
    expect(countRegisteredFields()).toBe(65)
  })

  it('groupProvider 注入后每个控件都带上分组,控件自己给的 group 优先', () => {
    setFieldGroupProvider(() => 'Wallet')
    mountFake({ label: () => '金额' })
    mountFake({ label: () => '自带分组', group: () => '自定义' })
    const snapshot = snapshotFields()
    expect(snapshot.elements[0]?.group).toBe('Wallet')
    expect(snapshot.elements[1]?.group).toBe('自定义')
    // 归位:后面的真组件用例不该继承这条注入
    setFieldGroupProvider(null)
    expect(snapshotFields().elements[0]?.group).toBeUndefined()
  })
})

describe('真组件:ui-native Input / Button 挂载即注册、卸载即摘除', () => {
  it('非受控 Input 可被 fill,DOM 的 value 真的变了(不是只写存储)', () => {
    const { container, unmount } = render(createElement(Input, { placeholder: '请输入昵称' }))
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    const snapshot = snapshotFields()
    expect(snapshot.elements).toHaveLength(1)
    expect(snapshot.elements[0]).toMatchObject({ label: '请输入昵称', writable: true })

    // 注册表写入发生在 React 事件系统之外,必须过 act 才能观察到重渲染后的 DOM
    let res = { ok: false }
    act(() => {
      res = { ok: setValueOnField(snapshot.elements[0]?.id ?? '', '李春川').ok }
    })
    expect(res.ok).toBe(true)
    // React DOM 更新受控 input 时只改 property 不改 attribute,故读 .value 而非 getAttribute
    expect((input as HTMLInputElement | null)?.value).toBe('李春川')

    unmount()
    expect(countRegisteredFields()).toBe(0)
    expect(setValueOnField(snapshot.elements[0]?.id ?? '', 'x').errorCode).toBe(
      'SELECTOR_NOT_FOUND',
    )
  })

  it('受控 Input 且父组件没给 onChangeText:真没写入通道,writable:false + fill 如实失败', () => {
    const { container } = render(
      createElement(Input, { value: '父组件的文本', placeholder: '昵称' }),
    )
    const element = snapshotFields().elements[0]
    expect(element).toMatchObject({ writable: false, value: '父组件的文本' })
    const res = setValueOnField(element?.id ?? '', 'AI 想改')
    expect(res.ok).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(container.querySelector('input')?.getAttribute('value')).toBe('父组件的文本')
  })

  it('密码/验证码框连 describe 都不出现;Button 无 onPress 不入表,有 onPress 可被 click', () => {
    const sensitive = render(
      createElement(Input, { secureTextEntry: true, placeholder: '登录密码' }),
    )
    expect(sensitive.container.querySelector('input')).not.toBeNull()
    expect(countRegisteredFields()).toBe(0)
    sensitive.unmount()

    const bare = render(createElement(Button, null, '普通按钮'))
    expect(countRegisteredFields()).toBe(0)
    bare.unmount()

    let pressed = 0
    const withPress = render(createElement(Button, { onPress: () => (pressed += 1) }, '保存草稿'))
    const element = snapshotFields().elements[0]
    expect(element).toMatchObject({ label: '保存草稿', pressable: true })
    expect(pressField(element?.id ?? '').ok).toBe(true)
    expect(pressed).toBe(1)
    withPress.unmount()
    expect(countRegisteredFields()).toBe(0)
  })

  it('受控 Input 且父组件给了 onChangeText:可写,走 onChangeText 后父 state 回流即界面真变', () => {
    let parentValue = '父组件的文本'
    const commits: string[] = []
    const commit = (next: string) => {
      commits.push(next)
      parentValue = next
    }
    const { container, rerender } = render(
      createElement(Input, { value: parentValue, placeholder: '昵称', onChangeText: commit }),
    )
    const element = snapshotFields().elements[0]
    // RN 端唯一在用的输入框(AgentRuntimePanel)就是这一形态:一律判不可写 = 能力缺失
    expect(element).toMatchObject({ writable: true, value: '父组件的文本' })

    let res = { ok: false }
    act(() => {
      res = { ok: setValueOnField(element?.id ?? '', 'AI 写入的文本').ok }
    })
    expect(res.ok).toBe(true)
    expect(commits).toEqual(['AI 写入的文本'])

    // 父组件 state 回流后重渲染,DOM 必须跟着变(证明"写进去了"不是只写了个回调)
    rerender(
      createElement(Input, { value: parentValue, placeholder: '昵称', onChangeText: commit }),
    )
    expect((container.querySelector('input') as HTMLInputElement | null)?.value).toBe(
      'AI 写入的文本',
    )
    expect(snapshotFields().elements[0]?.value).toBe('AI 写入的文本')
  })

  it('删除/支付类按钮即使带了 onPress 也不暴露给 AI', () => {
    let pressed = 0
    render(createElement(Button, { onPress: () => (pressed += 1) }, '确认支付'))
    render(createElement(Button, { accessibilityLabel: '注销账号', onPress: () => undefined }))
    expect(snapshotFields().elements).toEqual([])
    expect(pressField('确认支付').ok).toBe(false)
    expect(pressed).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
