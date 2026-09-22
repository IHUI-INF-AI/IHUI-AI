// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * modal-overlay-watcher 单测(2026-09-22 立,桌面端窗口按钮模态压暗)。
 *
 * 覆盖 detectModalOverlayColor 的全部判据(候选选取 / 双层陷阱 / z 门槛 / alpha 门槛 /
 * 视口覆盖率 / 多遮罩取最大 z / 排除压暗层自身)与 subscribeModalDim 的观察者生命周期。
 * happy-dom 的 getBoundingClientRect 恒为 0,故按视口判据打桩(见 beforeEach)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  detectModalOverlayColor,
  getModalDimState,
  subscribeModalDim,
  type ModalDimState,
} from '@/lib/modal-overlay-watcher'

function makeRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as unknown as DOMRect
}

const observers: MutationObserver[] = []
let restoreRect: (() => void) | null = null

beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element): DOMRect {
    const partial = this.hasAttribute('data-partial-cover')
    return makeRect(
      partial ? window.innerWidth / 2 : window.innerWidth,
      partial ? window.innerHeight / 2 : window.innerHeight,
    )
  }
  restoreRect = () => {
    Element.prototype.getBoundingClientRect = original
  }
  observers.length = 0
  document.body.innerHTML = ''
})

afterEach(() => {
  restoreRect?.()
  restoreRect = null
  vi.unstubAllGlobals()
})

function overlay(
  options: {
    bg?: string
    z?: string
    position?: 'fixed' | 'absolute'
    classes?: string
    partial?: boolean
    dim?: boolean
    parent?: Element
  } = {},
): HTMLElement {
  const el = document.createElement('div')
  el.className = options.classes ?? 'fixed inset-0 z-modal'
  el.style.position = options.position ?? 'fixed'
  el.style.zIndex = options.z ?? '2000'
  if (options.bg !== undefined) el.style.backgroundColor = options.bg
  if (options.partial) el.setAttribute('data-partial-cover', '')
  if (options.dim) el.setAttribute('data-window-controls-dim', '')
  const parent = options.parent ?? document.body
  parent.appendChild(el)
  return el
}

function computedBg(el: Element): string {
  return window.getComputedStyle(el).backgroundColor
}

/** happy-dom 的 MutationObserver 记录投递 + rAF 合并节流跨两个宏任务,单 tick 不够。 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
}

const DIM_ALPHA_LAYER = 'rgba(0, 0, 0, 0)'

describe('detectModalOverlayColor · 判据', () => {
  it('无遮罩 → null', () => {
    expect(detectModalOverlayColor(document)).toBeNull()
  })

  it('单层 fixed inset-0 有 alpha → 返回其 computed 色(原样字符串,供 inline style 直接用)', () => {
    const el = overlay({ bg: 'rgba(0, 0, 0, 0.8)' })
    expect(detectModalOverlayColor(document)).toBe(computedBg(el))
  })

  it('双层陷阱:父 fixed 透明 + 子 absolute 有背景 → 返回子层色', () => {
    const parent = overlay({ bg: DIM_ALPHA_LAYER })
    const child = overlay({
      classes: 'absolute inset-0 bg-black/80',
      position: 'absolute',
      bg: 'rgb(0 0 0 / 60%)',
      parent,
    })
    expect(detectModalOverlayColor(document)).toBe(computedBg(child))
  })

  it('z-index < 2000 的 fixed 全屏层不算遮罩', () => {
    overlay({ bg: 'rgba(0, 0, 0, 0.8)', z: '1999' })
    expect(detectModalOverlayColor(document)).toBeNull()
  })

  it('alpha < 0.05 / transparent / 解析不出的语法都不算', () => {
    overlay({ bg: 'rgba(0, 0, 0, 0.02)' })
    expect(detectModalOverlayColor(document)).toBeNull()
    overlay({ bg: 'rgb(0 0 0 / 2%)' })
    expect(detectModalOverlayColor(document)).toBeNull()
    overlay({ bg: 'transparent' })
    expect(detectModalOverlayColor(document)).toBeNull()
    overlay({ bg: 'black' })
    expect(detectModalOverlayColor(document)).toBeNull()
  })

  it('无 alpha 分量的三色语法视为不透明(实测算子会正常压暗)', () => {
    const el = overlay({ bg: 'rgb(0, 0, 0)' })
    expect(detectModalOverlayColor(document)).toBe(computedBg(el))
  })

  it('不覆盖满视口(≥98%)的 fixed 层不算', () => {
    overlay({ bg: 'rgba(0, 0, 0, 0.8)', partial: true })
    expect(detectModalOverlayColor(document)).toBeNull()
  })

  it('多个合格遮罩同时存在 → 取 z-index 最大的颜色', () => {
    const lower = overlay({ bg: 'rgba(0, 0, 0, 0.8)', z: '2000' })
    const upper = overlay({ bg: 'rgba(255, 255, 255, 0.5)', z: '3000' })
    expect(detectModalOverlayColor(document)).toBe(computedBg(upper))
    upper.remove()
    expect(detectModalOverlayColor(document)).toBe(computedBg(lower))
  })

  it('压暗覆盖层自身(含其祖先带 data-window-controls-dim)不参与检测', () => {
    overlay({ bg: 'rgba(0, 0, 0, 0.8)', dim: true })
    expect(detectModalOverlayColor(document)).toBeNull()
    const shell = overlay({ position: 'fixed', bg: DIM_ALPHA_LAYER, dim: true })
    overlay({ bg: 'rgba(0, 0, 0, 0.8)', parent: shell })
    expect(detectModalOverlayColor(document)).toBeNull()
  })

  it('class 写了 fixed 但 computed position 不是 fixed → 不算(以实测为准)', () => {
    overlay({ bg: 'rgba(0, 0, 0, 0.8)', position: 'absolute' })
    expect(detectModalOverlayColor(document)).toBeNull()
  })
})

describe('getModalDimState', () => {
  it('无遮罩 → { active:false, color:null },且颜色未变时返回同一对象(订阅者可 bail out)', () => {
    expect(getModalDimState()).toEqual({ active: false, color: null })
    expect(getModalDimState()).toBe(getModalDimState())
    overlay({ bg: 'rgba(0, 0, 0, 0.8)' })
    const mounted = getModalDimState()
    expect(mounted.active).toBe(true)
    expect(mounted.color).not.toBeNull()
    expect(getModalDimState()).toBe(mounted)
  })
})

describe('subscribeModalDim · 观察者生命周期', () => {
  beforeEach(() => {
    class TrackedMutationObserver extends MutationObserver {
      constructor(cb: MutationObserverCallback) {
        super(cb)
        observers.push(this)
      }
    }
    vi.stubGlobal('MutationObserver', TrackedMutationObserver)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
  })

  it('DOM 变更经 rAF 合并后通知;最后一个订阅者退订即 disconnect', async () => {
    const states: ModalDimState[] = []
    const unsubscribeFirst = subscribeModalDim((state) => states.push(state))
    const unsubscribeSecond = subscribeModalDim(() => {})
    expect(observers).toHaveLength(1)
    expect(states).toHaveLength(1)
    expect(states[0].active).toBe(false)

    const el = overlay({ bg: 'rgba(0, 0, 0, 0.8)' })
    await settle()
    expect(states).toHaveLength(2)
    expect(states[1].active).toBe(true)
    expect(states[1].color).toBe(computedBg(el))

    const disconnectSpy = vi.spyOn(observers[0], 'disconnect')
    unsubscribeSecond()
    expect(disconnectSpy).not.toHaveBeenCalled()

    unsubscribeFirst()
    expect(disconnectSpy).toHaveBeenCalledTimes(1)

    const frozen = states.length
    overlay({ bg: 'rgba(255, 0, 0, 0.5)' })
    el.remove()
    await settle()
    expect(states).toHaveLength(frozen)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
