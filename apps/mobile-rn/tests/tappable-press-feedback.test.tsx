// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Tappable 的行为锁。
//
// 为什么必须有这条测试:本仓上一版按压反馈用 `style={pressFeedback(...)}`(返回函数),而 interop 会把
// 注册表组件的函数形态 style 换成 `{}` ⇒ 元素整份内联样式消失(守门 131 真机定案同型)。
// Tappable 的全部意义就是"pressed 态留在组件内部,交给原生 Pressable 的必须是数组形态"。
// 没有测试钉住这一点,下一次又会漂回函数形态。
//
// 框架跟本端既有测试同形(vitest + @testing-library/react + vi.mock('react-native')),
// 不用 @testing-library/react-native —— 本端没装它(实跑报 resolve 失败)。
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { act, render } from '@testing-library/react'

// 原生 Pressable 换成探针:记下每次渲染收到的 props,直接看 style 的形态。
const seen = vi.hoisted(() => [])
vi.mock('react-native', () => ({
  Pressable: (props) => {
    seen.push(props)
    return createElement('div', null, props.children ?? null)
  },
  StyleSheet: {
    create: (s) => s,
    flatten: (s) => s,
    hairlineWidth: 1,
    absoluteFill: {},
    absoluteFillObject: {},
  },
  Platform: { OS: 'ios', Version: 18, select: (o) => o.ios },
}))

const { Tappable } = await import('@ihui/ui-native')

const base = { padding: 8, flexDirection: 'row' }
const evt = { nativeEvent: {} }
const last = () => seen[seen.length - 1]
/** pressed 是 state ⇒ handler 必须在 act 里调，否则重渲染不会发生(实测踩过)。 */
const pressIn = () => act(() => void last().onPressIn(evt))
const pressOut = () => act(() => void last().onPressOut(evt))

describe('Tappable 按压反馈', () => {
  it('未按下:原样式整体交给原生 Pressable，第二档是 falsy(不是函数)', () => {
    seen.length = 0
    render(createElement(Tappable, { style: base }))
    expect(seen.length).toBeGreaterThan(0)
    expect(typeof last().style).not.toBe('function')
    expect(Array.isArray(last().style)).toBe(true)
    expect(last().style).toEqual([base, false])
  })

  it('按下:叠一层不透明度且不丢原样式；松开回到原样', () => {
    seen.length = 0
    render(createElement(Tappable, { style: base }))
    pressIn()
    expect(last().style).toEqual([base, { opacity: 0.65 }])
    pressOut()
    expect(last().style).toEqual([base, false])
  })

  it('调用方自己的 onPressIn/onPressOut 仍被转调(包一层不能吃掉别人的回调)', () => {
    seen.length = 0
    const log = []
    render(
      createElement(Tappable, {
        style: base,
        onPressIn: () => log.push('in'),
        onPressOut: () => log.push('out'),
      }),
    )
    pressIn()
    pressOut()
    expect(log).toEqual(['in', 'out'])
  })

  it('透传其余 props(hitSlop / accessibilityRole)——换组件不得改变命中区与可访问性', () => {
    seen.length = 0
    render(createElement(Tappable, { style: base, hitSlop: 6, accessibilityRole: 'button' }))
    expect(last().hitSlop).toBe(6)
    expect(last().accessibilityRole).toBe('button')
  })

  it('入参本身是数组时整体保留(本仓有 18 枚 [a, cond ? b : null] 这一型)', () => {
    seen.length = 0
    const arr = [base, { backgroundColor: '#0a0' }]
    render(createElement(Tappable, { style: arr }))
    expect(last().style).toEqual([arr, false])
    pressIn()
    expect(last().style[1]).toEqual({ opacity: 0.65 })
    expect(last().style[0]).toBe(arr)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
