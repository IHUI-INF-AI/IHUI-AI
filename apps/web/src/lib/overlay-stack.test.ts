// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetOverlayStack,
  getOverlayStack,
  isTopOverlay,
  popOverlay,
  pushOverlay,
} from './overlay-stack'

describe('overlay-stack', () => {
  beforeEach(() => {
    __resetOverlayStack()
  })

  it('单层时该层消费 Esc', () => {
    pushOverlay('a')
    expect(isTopOverlay('a')).toBe(true)
  })

  it('后打开的层为栈顶,先打开的层不消费 Esc', () => {
    pushOverlay('a')
    pushOverlay('b')
    expect(getOverlayStack()).toEqual(['a', 'b'])
    expect(isTopOverlay('b')).toBe(true)
    expect(isTopOverlay('a')).toBe(false)
  })

  it('push 幂等:重复注册只移到栈顶,不产生重复项', () => {
    pushOverlay('a')
    pushOverlay('b')
    pushOverlay('a')
    expect(getOverlayStack()).toEqual(['b', 'a'])
    expect(isTopOverlay('a')).toBe(true)
    expect(isTopOverlay('b')).toBe(false)
  })

  it('pop 栈顶后,下一层成为可消费 Esc 的层(逐层退出)', () => {
    pushOverlay('a')
    pushOverlay('b')
    popOverlay('b')
    expect(isTopOverlay('a')).toBe(true)
  })

  it('pop 未注册的 id 与重复 pop 均为 noop', () => {
    pushOverlay('a')
    expect(() => popOverlay('missing')).not.toThrow()
    popOverlay('a')
    popOverlay('a')
    expect(getOverlayStack()).toEqual([])
  })

  it('fail-open:栈为空或未接入栈的 id 一律允许消费 Esc', () => {
    expect(isTopOverlay('anything')).toBe(true)
    pushOverlay('a')
    // 未接入层栈的浮层(Radix Dialog / Drawer 等)不受本模块影响
    expect(isTopOverlay('radix-dialog')).toBe(true)
    expect(isTopOverlay('a')).toBe(true)
  })

  it('三层叠加时一次 Esc 只有最上层被判定为可关闭', () => {
    pushOverlay('menu')
    pushOverlay('popover')
    pushOverlay('dialog')
    const closable = ['menu', 'popover', 'dialog'].filter(isTopOverlay)
    expect(closable).toEqual(['dialog'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
