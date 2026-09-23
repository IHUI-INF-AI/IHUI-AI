// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控件注册表单测(2026-09-21 立)。
 *
 * 用纯 JS 假组件(闭包 + 手动 unregister)断言"组件交出通道 → 动作真的生效 / 没交出 → 如实失败",
 * 不依赖渲染环境;真机行为另由微信开发者工具验证。守住的是**绝不假成功**这条底线。
 * tsconfig 开了 noUncheckedIndexedAccess,故一律用具名查找取控件,取不到就直接抛(而不是 ! 断言)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { AppUiElement } from '@ihui/types'
import {
  MAX_SNAPSHOT_ELEMENTS,
  getSecuritySuppressedCount,
  isDestructiveControl,
  isSensitiveField,
  pressField,
  registerUiField,
  registerUiForm,
  resetUiFieldRegistryForTest,
  setFieldValue,
  snapshotUiFields,
  submitForm,
  type UiFieldSpec,
} from '../ui-field-registry'

function elementByLabel(label: string): AppUiElement {
  const found = snapshotUiFields().elements.find((element) => element.label === label)
  if (!found) throw new Error(`快照里没有控件「${label}」`)
  return found
}

function onlyElement(): AppUiElement {
  const { elements } = snapshotUiFields()
  const found = elements[0]
  if (!found || elements.length !== 1) {
    throw new Error(`快照应当只有 1 个控件,实际 ${elements.length}`)
  }
  return found
}

function onlyFormId(): string {
  const found = snapshotUiFields().forms[0]
  if (!found || !found.id) throw new Error('快照里没有可提交表单')
  return found.id
}

beforeEach(() => {
  resetUiFieldRegistryForTest()
})

describe('注册与快照 —— 只报组件真的交出来的通道', () => {
  it('交出 setValue 才 writable,交出 onPress 才 pressable(缺省时两者为 false)', () => {
    const unregister = registerUiField({
      kind: 'input',
      label: '昵称',
      readValue: () => '',
      setValue: () => {},
    })
    registerUiField({ kind: 'pressable', label: '只看不可点的提示' })
    expect(snapshotUiFields().elements).toHaveLength(2)
    expect(elementByLabel('昵称')).toMatchObject({
      writable: true,
      pressable: false,
      group: 'page',
    })
    expect(elementByLabel('只看不可点的提示')).toMatchObject({ writable: false, pressable: false })
    expect(unregister()).toBeUndefined()
    expect(snapshotUiFields().elements).toHaveLength(1)
  })

  it('id 形如 fld:<kind>#<序号>,序号全局单调不复用', () => {
    registerUiField({ kind: 'input', label: 'A' })
    registerUiField({ kind: 'number', label: 'B' })
    registerUiField({ kind: 'input', label: 'C' })
    expect(snapshotUiFields().elements.map((element) => element.id)).toEqual([
      'fld:input#1',
      'fld:number#2',
      'fld:input#3',
    ])
  })

  it('超上限的控件不静默丢弃:limitSuppressed 如实计数', () => {
    for (let i = 0; i < MAX_SNAPSHOT_ELEMENTS + 7; i++) {
      registerUiField({ kind: 'input', label: `字段${i}` })
    }
    const snapshot = snapshotUiFields()
    expect(snapshot.elements).toHaveLength(MAX_SNAPSHOT_ELEMENTS)
    expect(snapshot.limitSuppressed).toBe(7)
    expect(snapshot.total).toBe(MAX_SNAPSHOT_ELEMENTS + 7)
  })

  it('敏感输入与高危按钮连 describe 都不出现,只计入 securitySuppressed', () => {
    const specs: UiFieldSpec[] = [
      { kind: 'input', label: '登录密码', password: true },
      { kind: 'input', label: '账号', inputType: 'password' },
      { kind: 'input', label: '短信验证码' },
      { kind: 'input', label: 'App Token' },
      { kind: 'button', label: '删除账号', onPress: () => {} },
      { kind: 'button', label: '立即支付', onPress: () => {} },
      { kind: 'button', label: '余额提现', onPress: () => {} },
      { kind: 'button', label: '分享到微信', onPress: () => {} },
      { kind: 'button', label: '退出登录', onPress: () => {} },
    ]
    for (const spec of specs) registerUiField(spec)
    registerUiField({ kind: 'input', label: '昵称' })
    const snapshot = snapshotUiFields()
    expect(snapshot.elements.map((element) => element.label)).toEqual(['昵称'])
    expect(snapshot.securitySuppressed).toBe(specs.length)
    expect(getSecuritySuppressedCount()).toBe(specs.length)
  })

  it('PII 字段的值打码后回传,普通字段超长截断', () => {
    registerUiField({ kind: 'input', label: '手机号', readValue: () => '13800001111' })
    registerUiField({ kind: 'input', label: '备注', readValue: () => 'x'.repeat(200) })
    expect(elementByLabel('手机号').value).toBe('***')
    expect(elementByLabel('备注').value).toHaveLength(81)
    expect(elementByLabel('备注').value?.endsWith('…')).toBe(true)
  })

  it('敏感 / 高危判定单列:供组件侧自检', () => {
    expect(isSensitiveField({ kind: 'input', label: '口令', inputType: 'text' })).toBe(false)
    expect(isSensitiveField({ kind: 'input', label: '邀请码', placeholder: 'token' })).toBe(true)
    expect(isDestructiveControl({ label: '确认注销' })).toBe(true)
    expect(isDestructiveControl({ label: '保存草稿' })).toBe(false)
  })
})

describe('fill —— 只走组件自己的受控通道', () => {
  it('交出 setValue 的字段:数字规范成字符串后写入,并回读界面真值', () => {
    let stored = ''
    registerUiField({
      kind: 'number',
      label: '温度',
      readValue: () => stored,
      setValue: (next) => {
        stored = next
      },
    })
    const element = onlyElement()
    const result = setFieldValue(element.id, 0.7)
    expect(result.ok).toBe(true)
    expect(stored).toBe('0.7')
    expect(result.data).toMatchObject({ filled: element.id, valueAfter: '0.7', applied: true })
  })

  it('值握在业务页里的字段:writable=false 且 fill 如实失败(不写 storage、不假成功)', () => {
    registerUiField({ kind: 'input', label: '父页托管的标题' })
    const element = onlyElement()
    expect(element.writable).toBe(false)
    const result = setFieldValue(element.id, '改成别的东西')
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(result.error).toContain('未开放写入通道')
  })

  it('禁用中的字段拒绝代填', () => {
    registerUiField({ kind: 'input', label: '优惠码', setValue: () => {}, isDisabled: () => true })
    const element = onlyElement()
    expect(element.disabled).toBe(true)
    const result = setFieldValue(element.id, 'ABC')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('禁用态')
  })

  it('未知 id:失败并要求重新 describe,而不是命中"最相近"的控件', () => {
    registerUiField({ kind: 'input', label: '昵称', setValue: () => {} })
    const result = setFieldValue('fld:input#999', 'x')
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(result.error).toContain('describe')
  })

  it('value 非字符串/数字/布尔 → 如实拒绝', () => {
    registerUiField({ kind: 'input', label: '昵称', setValue: () => {} })
    expect(setFieldValue(onlyElement().id, { nested: 1 }).ok).toBe(false)
  })

  it('setValue 抛错转成 EXECUTION_FAILED(不把异常吞成成功)', () => {
    registerUiField({
      kind: 'input',
      label: '昵称',
      setValue: () => {
        throw new Error('父页拒绝')
      },
    })
    const result = setFieldValue(onlyElement().id, 'x')
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('父页拒绝')
  })
})

describe('click —— 只触发组件交出的 onPress', () => {
  it('await 异步 onPress 完成后才报成功', async () => {
    let done = false
    registerUiField({
      kind: 'button',
      label: '展开更多',
      onPress: async () => {
        await Promise.resolve()
        done = true
      },
    })
    const element = onlyElement()
    const result = await pressField(element.id)
    expect(done).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.data?.pressed).toBe(element.id)
  })

  it('pressable=false 的控件如实失败', async () => {
    registerUiField({ kind: 'input', label: '搜索框', setValue: () => {} })
    const result = await pressField(onlyElement().id)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('未开放触发通道')
  })

  it('onPress 抛错 → EXECUTION_FAILED', async () => {
    registerUiField({
      kind: 'button',
      label: '加载更多',
      onPress: () => {
        throw new Error('接口 500')
      },
    })
    const result = await pressField(onlyElement().id)
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('接口 500')
  })
})

describe('id 稳定性 —— 卸载/新挂载不得让老 id 指向别的控件', () => {
  it('老控件卸载后,老 id 既不复用也不改指新控件', async () => {
    const writesA: string[] = []
    const unregisterA = registerUiField({
      kind: 'input',
      label: 'A 页搜索',
      setValue: (v) => {
        writesA.push(v)
      },
    })
    expect(elementByLabel('A 页搜索').id).toBe('fld:input#1')
    unregisterA()

    let b = ''
    registerUiField({
      kind: 'input',
      label: 'B 页搜索',
      setValue: (v) => {
        b = v
      },
    })
    // 新控件拿到的是全新序号,不会继承 A 的 id
    expect(elementByLabel('B 页搜索').id).toBe('fld:input#2')

    const staleClick = await pressField('fld:input#1')
    expect(staleClick.ok).toBe(false)
    expect(staleClick.error).toContain('已从界面卸载')
    const staleFill = setFieldValue('fld:input#1', '劫持')
    expect(staleFill.ok).toBe(false)
    expect(b).toBe('')
  })

  it('同一控件重复定位命中同一个通道(多次 fill 不漂移)', () => {
    const writes: string[] = []
    registerUiField({
      kind: 'input',
      label: '备注',
      setValue: (v) => {
        writes.push(v)
      },
    })
    const element = onlyElement()
    snapshotUiFields()
    snapshotUiFields()
    setFieldValue(element.id, '一')
    setFieldValue(element.id, '二')
    expect(writes).toEqual(['一', '二'])
    expect(onlyElement().id).toBe(element.id)
  })
})

describe('submit —— 表单只认组件交出的 onSubmit', () => {
  it('唯一表单可省 form 参数,字段的 group 换算成表单展示 id', async () => {
    let submitted = 0
    registerUiField({ kind: 'input', label: '关键词', formKey: 'search' })
    registerUiForm({
      key: 'search',
      label: '搜索',
      onSubmit: () => {
        submitted += 1
      },
    })
    const formId = onlyFormId()
    expect(elementByLabel('关键词').group).toBe(formId)
    const result = await submitForm('')
    expect(result.ok).toBe(true)
    expect(submitted).toBe(1)
  })

  it('多个表单时必须显式指定 form,否则如实要求', async () => {
    registerUiForm({ key: 'a', label: '甲表单', onSubmit: () => {} })
    registerUiForm({ key: 'b', label: '乙表单', onSubmit: () => {} })
    const result = await submitForm('')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('必须显式指定 form')
  })

  it('没交出 onSubmit 的表单不进可调用面,直接指定 id 也只得到失败', async () => {
    registerUiForm({ key: 'draft', label: '草稿' })
    expect(snapshotUiFields().forms).toHaveLength(0)
    const result = await submitForm('form:1')
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('提交抛错 → EXECUTION_FAILED;异步提交被 await', async () => {
    registerUiForm({
      key: 'boom',
      label: '出错的表单',
      onSubmit: async () => {
        throw new Error('校验未通过')
      },
    })
    const result = await submitForm('')
    expect(result.errorCode).toBe('EXECUTION_FAILED')
    expect(result.error).toContain('校验未通过')
  })

  it('高危表单(发布/删除)不进表', () => {
    registerUiForm({ key: 'publish', label: '发布文章', onSubmit: () => {} })
    registerUiForm({ key: 'del', label: '删除草稿', onSubmit: () => {} })
    const snapshot = snapshotUiFields()
    expect(snapshot.forms).toHaveLength(0)
    expect(snapshot.securitySuppressed).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
