// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import type { UiNodeSchema, UiTreeSchema } from '../hands-contract.js'
import {
  findNodeByText,
  findNodeByViewId,
  nearestClickable,
  resolveTapTarget,
  validateHandsCommand,
  planCommandFromIntent,
} from '../hands-logic.js'

/** 构造一个最小界面树:一个可滚动列表,内含「登录」按钮(自身不可点,父容器可点)与一个输入框。 */
function sampleTree(): UiTreeSchema {
  const loginText: UiNodeSchema = {
    viewId: null,
    text: '登录',
    className: 'android.widget.TextView',
    bounds: { left: 10, top: 100, right: 110, bottom: 140 },
    clickable: false,
    scrollable: false,
    editable: false,
    contentDescription: null,
  }
  const loginButton: UiNodeSchema = {
    viewId: 'com.example:id/login',
    text: null,
    className: 'android.widget.FrameLayout',
    bounds: { left: 10, top: 100, right: 110, bottom: 140 },
    clickable: true,
    scrollable: false,
    editable: false,
    contentDescription: null,
    children: [loginText],
  }
  const editText: UiNodeSchema = {
    viewId: 'com.example:id/account',
    text: '',
    className: 'android.widget.EditText',
    bounds: { left: 10, top: 20, right: 310, bottom: 60 },
    clickable: false,
    scrollable: false,
    editable: true,
    contentDescription: null,
  }
  const list: UiNodeSchema = {
    viewId: null,
    text: null,
    className: 'android.widget.ScrollView',
    bounds: { left: 0, top: 0, right: 360, bottom: 640 },
    clickable: false,
    scrollable: true,
    editable: false,
    contentDescription: null,
    children: [editText, loginButton],
  }
  return { root: list, capturedAt: 1700000000000 }
}

describe('Hands 纯逻辑 —— 界面树定位', () => {
  it('findNodeByText 子串匹配命中登录文本', () => {
    const node = findNodeByText(sampleTree(), '登录')
    expect(node?.text).toBe('登录')
  })

  it('findNodeByText exact=true 只全等', () => {
    expect(findNodeByText(sampleTree(), '登录', true)).not.toBeNull()
    expect(findNodeByText(sampleTree(), '登', true)).toBeNull()
  })

  it('findNodeByViewId 短名命中(末尾匹配)', () => {
    expect(findNodeByViewId(sampleTree(), 'login')?.viewId).toBe('com.example:id/login')
  })
})

describe('Hands 纯逻辑 —— 点击目标解析(决策:点哪)', () => {
  it('文本 selector 解析到「最近可点祖先」而非文本节点本身', () => {
    const r = resolveTapTarget(sampleTree(), { kind: 'text', text: '登录' })
    expect(r?.node?.clickable).toBe(true)
    expect(r?.node?.viewId).toBe('com.example:id/login')
  })

  it('viewId selector 直接命中可点节点', () => {
    const r = resolveTapTarget(sampleTree(), { kind: 'viewId', viewId: 'com.example:id/login' })
    expect(r?.node?.clickable).toBe(true)
  })

  it('coords selector 原样返回坐标', () => {
    const r = resolveTapTarget(sampleTree(), { kind: 'coords', x: 5, y: 5 })
    expect(r?.coords).toEqual({ x: 5, y: 5 })
    expect(r?.node).toBeUndefined()
  })

  it('nearestClickable 自身可点时返回自身', () => {
    const btn = findNodeByViewId(sampleTree(), 'login')!
    expect(nearestClickable(sampleTree(), btn)?.viewId).toBe('com.example:id/login')
  })
})

describe('Hands 纯逻辑 —— 命令校验护栏', () => {
  it('缺 id / type 判失败', () => {
    expect(validateHandsCommand({ id: '', type: 'back' }).ok).toBe(false)
    // @ts-expect-error 故意缺 type 测护栏
    expect(validateHandsCommand({ id: 'x' }).ok).toBe(false)
  })

  it('type 命令缺 text 判失败;coords 目标判失败', () => {
    expect(
      validateHandsCommand({ id: '1', type: 'type', target: { kind: 'viewId', viewId: 'a' } }).ok,
    ).toBe(false)
    expect(
      validateHandsCommand({
        id: '1',
        type: 'type',
        target: { kind: 'coords', x: 1, y: 1 },
        text: 'x',
      }).ok,
    ).toBe(false)
  })

  it('scroll 缺 direction 判失败', () => {
    expect(validateHandsCommand({ id: '1', type: 'scroll' }).ok).toBe(false)
  })

  it('合法 back / click 通过', () => {
    expect(validateHandsCommand({ id: '1', type: 'back' }).ok).toBe(true)
    expect(
      validateHandsCommand({ id: '1', type: 'click', target: { kind: 'viewId', viewId: 'a' } }).ok,
    ).toBe(true)
  })
})

describe('Hands 纯逻辑 —— 意图→命令(决策:界面树→动作)', () => {
  it('意图「点登录」生成 click + viewId 选择器', () => {
    const cmd = planCommandFromIntent(sampleTree(), { action: 'tap', label: '登录' })
    expect(cmd?.type).toBe('click')
    expect(cmd?.target).toEqual({ kind: 'viewId', viewId: 'com.example:id/login' })
  })

  it('意图「在 account 输入 xyz」生成 type 命令', () => {
    const cmd = planCommandFromIntent(sampleTree(), {
      action: 'input',
      label: 'account',
      value: 'xyz',
    })
    expect(cmd?.type).toBe('type')
    expect(cmd?.text).toBe('xyz')
    expect(cmd?.target).toEqual({ kind: 'viewId', viewId: 'com.example:id/account' })
  })

  it('意图 back / scroll 生成对应命令', () => {
    expect(planCommandFromIntent(sampleTree(), { action: 'back' })?.type).toBe('back')
    const s = planCommandFromIntent(sampleTree(), { action: 'scroll', direction: 'up' })
    expect(s?.type).toBe('scroll')
    expect(s?.direction).toBe('up')
  })

  it('定位不到目标时返回 null', () => {
    expect(planCommandFromIntent(sampleTree(), { action: 'tap', label: '不存在的按钮' })).toBeNull()
  })
})
