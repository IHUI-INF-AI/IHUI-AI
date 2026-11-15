// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按压链路回归:compat 层把 Taro 触点翻译成 RN 的 onPressIn/onPressOut。
 *
 * 为什么要有这份用例:这条链此前是**声明了但从不派发**(`RNCompatProps` 有 onPressIn/onPressOut,
 * compat View 只接 onClick/onLongPress)。断掉的不是一处样式,而是 Tappable(361 个调用点)的
 * 整端按压反馈,以及共享层"按住说话"的起停录音。纯函数测行为 + 源码级测接线,两半都必要:
 * 只测纯函数,接线被人删掉也照样绿。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { createPressHandlers } from './press-handlers'

function setup(overrides: Partial<Parameters<typeof createPressHandlers>[0]> = {}) {
  const down = { current: false }
  const pressed: boolean[] = []
  const onPressIn = vi.fn()
  const onPressOut = vi.fn()
  const handlers = createPressHandlers({
    down,
    onPressIn,
    onPressOut,
    setPressed: (v) => pressed.push(v),
    ...overrides,
  })
  const evt = { nativeEvent: {} } as never
  return { handlers, pressed, onPressIn, onPressOut, down, evt }
}

describe('createPressHandlers:触点 → 按压生命周期', () => {
  it('按下派发 onPressIn 并置 pressed,松手派发 onPressOut 并复位', () => {
    const { handlers, pressed, onPressIn, onPressOut, evt } = setup()
    handlers.onTouchStart(evt)
    expect(onPressIn).toHaveBeenCalledTimes(1)
    expect(pressed).toEqual([true])
    handlers.onTouchEnd(evt)
    expect(onPressOut).toHaveBeenCalledTimes(1)
    expect(pressed).toEqual([true, false])
  })

  it('重复 touchstart(多指/重入)不重复派发 onPressIn', () => {
    const { handlers, onPressIn, pressed, evt } = setup()
    handlers.onTouchStart(evt)
    handlers.onTouchStart(evt)
    expect(onPressIn).toHaveBeenCalledTimes(1)
    expect(pressed).toEqual([true])
  })

  it('没按下就 touchend 不产生无主 onPressOut', () => {
    const { handlers, onPressOut, pressed, evt } = setup()
    handlers.onTouchEnd(evt)
    expect(onPressOut).not.toHaveBeenCalled()
    expect(pressed).toEqual([])
  })

  it('touchcancel 与 touchend 等价(手指滑出/系统打断),不会把 pressed 卡在真', () => {
    const { handlers, pressed, onPressOut, down, evt } = setup()
    handlers.onTouchStart(evt)
    handlers.onTouchCancel(evt)
    expect(pressed).toEqual([true, false])
    expect(onPressOut).toHaveBeenCalledTimes(1)
    expect(down.current).toBe(false)
  })

  it('disabled 时整条链路不响应(RN 的 Pressable 在 disabled 下同样不产生 press 事件)', () => {
    const { handlers, pressed, onPressIn, onPressOut, evt } = setup({ disabled: true })
    handlers.onTouchStart(evt)
    handlers.onTouchEnd(evt)
    expect(onPressIn).not.toHaveBeenCalled()
    expect(onPressOut).not.toHaveBeenCalled()
    expect(pressed).toEqual([])
  })

  it('松手后再次按下能重新触发(状态确实被复位,不是一次性)', () => {
    const { handlers, onPressIn, pressed, evt } = setup()
    handlers.onTouchStart(evt)
    handlers.onTouchEnd(evt)
    handlers.onTouchStart(evt)
    expect(onPressIn).toHaveBeenCalledTimes(2)
    expect(pressed).toEqual([true, false, true])
  })
})

describe('原语层接线契约(源码级,防"函数在但没人调用")', () => {
  const primitives = readFileSync(join(__dirname, 'primitives.tsx'), 'utf8')

  it('Pressable 把三个触点挂到 View 上', () => {
    expect(primitives).toContain(
      'onTouchStart={needPressState ? handlers.onTouchStart : undefined}',
    )
    expect(primitives).toContain('onTouchEnd={needPressState ? handlers.onTouchEnd : undefined}')
    expect(primitives).toContain(
      'onTouchCancel={needPressState ? handlers.onTouchCancel : undefined}',
    )
  })

  it('View 把触点四键真正转发给 TaroView(否则上面那三行等于没接)', () => {
    for (const key of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel']) {
      expect(primitives).toContain(`${key}={p.${key} as TaroViewProps['${key}']}`)
    }
  })

  it('按压态由 state 驱动,不再按 {pressed:false} 一次定死', () => {
    expect(primitives).toContain('styleFn({ pressed })')
    expect(primitives).toContain('childrenFn({ pressed })')
    expect(primitives).not.toContain('({ pressed: false })')
  })

  it('不需要按压态时不绑任何触点(不给 weapp 每个可点节点白加 bindtouch*)', () => {
    expect(primitives).toContain(
      'const needPressState = Boolean(styleFn || childrenFn || onPressIn || onPressOut)',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
