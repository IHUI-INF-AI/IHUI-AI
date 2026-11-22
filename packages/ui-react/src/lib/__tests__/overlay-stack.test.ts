// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Esc 层栈协议的行为锁(`lib/overlay-stack.ts` + `lib/use-esc-stack.ts`)。
 *
 * 这一族此前零覆盖。它守的是"按一次 Esc 只关一层"这条用户可见语义,
 * 而它的失效方向恰好是**安静**的:栈序错了页面照样能开合,只是用户要连按多次
 * 才能退出,或一次 Esc 把整叠浮层全关掉。故这里的断言一律取"哪一层消费了这次 Esc"
 * 的可观察结果,而不是"函数被调用过"。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  __resetOverlayStack,
  getOverlayStack,
  isTopOverlay,
  popOverlay,
  pushOverlay,
} from '../overlay-stack'

afterEach(() => {
  __resetOverlayStack()
})

describe('overlay-stack: 注册/注销', () => {
  it('推入顺序即栈序,后开者在上', () => {
    pushOverlay('dialog')
    pushOverlay('sheet')
    expect(getOverlayStack()).toEqual(['dialog', 'sheet'])
  })

  it('重复 push 同一 id 只"移到栈顶",不产生重复项(重复挂载/重开不灭层)', () => {
    pushOverlay('dialog')
    pushOverlay('sheet')
    pushOverlay('dialog')
    expect(getOverlayStack()).toEqual(['sheet', 'dialog'])
  })

  it('pop 未注册 id 是 noop(卸载未挂载的层不改动别人的栈)', () => {
    pushOverlay('dialog')
    popOverlay('never-registered')
    expect(getOverlayStack()).toEqual(['dialog'])
  })

  it('pop 会清掉同一 id 的全部副本(重复 push 残留也能被一次注销干净)', () => {
    pushOverlay('dialog')
    pushOverlay('sheet')
    // 绕过 push 的幂等,直接制造重复项,证明 pop 不是"只删一层"
    const raw = getOverlayStack() as string[]
    raw.push('dialog')
    popOverlay('dialog')
    expect(getOverlayStack()).toEqual(['sheet'])
  })
})

describe('overlay-stack: isTopOverlay 的三条放行面', () => {
  it('栈为空时一律放行(没有层就不要互相拦)', () => {
    expect(isTopOverlay('anything')).toBe(true)
  })

  it('只有栈顶消费 Esc —— 底层必须让位', () => {
    pushOverlay('dialog')
    pushOverlay('sheet')
    expect(isTopOverlay('sheet')).toBe(true)
    expect(isTopOverlay('dialog')).toBe(false)
  })

  it('未接入栈的 id 一律放行(fail-open:接入本模块不得让既有 Esc 失灵)', () => {
    pushOverlay('dialog')
    expect(isTopOverlay('legacy-layer')).toBe(true)
  })

  it('栈顶被注销后,下一层立刻接住 Esc(逐层退出)', () => {
    pushOverlay('dialog')
    pushOverlay('sheet')
    popOverlay('sheet')
    expect(isTopOverlay('dialog')).toBe(true)
  })
})
