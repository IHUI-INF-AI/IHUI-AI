// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/apis.ts 的 Animated 补间引擎验收。
 *
 * 迁移前 `timing/spring/decay` 是"直接落终值"的假动画,本文件证的是现在**真的逐帧播**:
 *  · 时间轴:fake timers + Date,断言中途值是中间态、终值精确、结束回调 finished 语义;
 *  · 生命周期:stop 必须发 finished:false、冻结当前值、定时器清零;重复 start 不得留双帧;
 *  · 组合:sequence 串行、parallel 等齐、stagger 错峰、loop 按 iterations 收敛且 stop 可中断;
 *  · 取值:interpolate 分段线性/越界端点/字符串停在段末(登记差异)、add/multiply 是派生节点
 *    (每次取值现算,不是创建时快照 —— sheet 的 translateY 靠这条);
 *  · 渲染面:Animated.View 通过 renderToStaticMarkup 取证,样式里的节点确实被解成数。
 *
 * 取证边界:小程序宿主渲染层(live 30fps 重渲染)不在本机可跑,这里证的是**引擎与解值**,
 * 不是"真机已流畅"。useNativeDriver 无原生档、字符串/颜色插值退化已登记为允许差异。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const taro = vi.hoisted(() => ({
  getSystemInfoSync: vi.fn(() => ({
    windowWidth: 375,
    windowHeight: 667,
    pixelRatio: 2,
    screenHeight: 667,
    safeArea: { top: 20, bottom: 667, left: 0, right: 0 },
    theme: 'light',
  })),
}))

vi.mock('@tarojs/taro', () => ({ default: taro }))
vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return {
    View: make('div'),
    Text: make('span'),
    ScrollView: make('scroll-view'),
    Image: make('img'),
    Input: make('input'),
    Switch: make('switch'),
    Textarea: make('textarea'),
  }
})

import { Animated, Easing } from './apis'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('Easing', () => {
  it('端点、二次/三次曲线与 in/out/inOut 组合符合 RN 定义', () => {
    expect(Easing.linear(0.5)).toBe(0.5)
    expect(Easing.quad(0.5)).toBe(0.25)
    expect(Easing.cubic(0.5)).toBe(0.125)
    expect(Easing.ease(0)).toBe(0)
    expect(Easing.ease(1)).toBe(1)
    expect(Easing.out(Easing.quad)(0.5)).toBeCloseTo(0.75, 6)
    expect(Easing.inOut(Easing.quad)(0.25)).toBeCloseTo(0.125, 6)
    expect(Easing.inOut(Easing.quad)(0.75)).toBeCloseTo(0.875, 6)
    // bezier 用二分反解 x(t):对称曲线在中点也必须给中点
    const symmetric = Easing.bezier(0.5, 0.5, 0.5, 0.5)
    expect(symmetric(0.5)).toBeCloseTo(0.5, 3)
  })
})

describe('Animated.timing', () => {
  it('逐帧推进:中途是中间态,到点精确落终值并发 finished:true', async () => {
    const value = new Animated.Value(0)
    const done = vi.fn()
    Animated.timing(value, {
      toValue: 100,
      duration: 100,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(done)
    await vi.advanceTimersByTimeAsync(50)
    const mid = value.__getValue()
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(value.__getValue()).toBe(100)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop:发 finished:false、冻结当前值、定时器清零', async () => {
    const value = new Animated.Value(0)
    const done = vi.fn()
    const anim = Animated.timing(value, { toValue: 100, duration: 1000 })
    anim.start(done)
    await vi.advanceTimersByTimeAsync(100)
    expect(value.__getValue()).toBeGreaterThan(0)
    expect(value.__getValue()).toBeLessThan(100)
    anim.stop()
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith({ finished: false })
    const frozen = value.__getValue()
    await vi.advanceTimersByTimeAsync(500)
    expect(value.__getValue()).toBe(frozen)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('重复 start 取消上一轮帧:不并发双帧,旧回调不重复触发', async () => {
    const value = new Animated.Value(0)
    const anim = Animated.timing(value, { toValue: 10, duration: 100 })
    const first = vi.fn()
    anim.start(first)
    await vi.advanceTimersByTimeAsync(40)
    expect(vi.getTimerCount()).toBe(1)
    const second = vi.fn()
    anim.start(second)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(150)
    expect(value.__getValue()).toBe(10)
    expect(second).toHaveBeenCalledWith({ finished: true })
    // 覆盖式重启:上一轮的完成回调被替换,不得再被调用
    expect(first).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('delay 期间值不动,延时结束后正常走完', async () => {
    const value = new Animated.Value(0)
    const done = vi.fn()
    Animated.timing(value, { toValue: 10, duration: 100, delay: 100 }).start(done)
    await vi.advanceTimersByTimeAsync(90)
    expect(value.__getValue()).toBe(0)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(160)
    expect(value.__getValue()).toBe(10)
    expect(done).toHaveBeenCalledWith({ finished: true })
  })
})

describe('Animated.spring / decay', () => {
  it('spring 收敛到 toValue 并结束', async () => {
    const value = new Animated.Value(0)
    const done = vi.fn()
    Animated.spring(value, {
      toValue: 100,
      stiffness: 200,
      damping: 20,
      mass: 1,
      useNativeDriver: true,
    }).start(done)
    await vi.advanceTimersByTimeAsync(4000)
    expect(value.__getValue()).toBe(100)
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('overshootClamping:全程不越过终值', async () => {
    const value = new Animated.Value(0)
    const samples: number[] = []
    value.addListener((event) => samples.push(event.value))
    const done = vi.fn()
    Animated.spring(value, {
      toValue: 100,
      stiffness: 200,
      damping: 5,
      mass: 1,
      overshootClamping: true,
    }).start(done)
    await vi.advanceTimersByTimeAsync(4000)
    expect(Math.max(...samples)).toBeLessThanOrEqual(100)
    expect(value.__getValue()).toBe(100)
    expect(done).toHaveBeenCalledWith({ finished: true })
  })

  it('decay 单调推移并因速度阈值结束', async () => {
    const value = new Animated.Value(0)
    const done = vi.fn()
    Animated.decay(value, { velocity: 2, deceleration: 0.9 }).start(done)
    await vi.advanceTimersByTimeAsync(1000)
    expect(value.__getValue()).toBeGreaterThan(0)
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Animated 组合', () => {
  it('sequence 串行:前一段 finish 后才启动下一段', async () => {
    const a = new Animated.Value(0)
    const b = new Animated.Value(0)
    const done = vi.fn()
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 66 }),
      Animated.timing(b, { toValue: 2, duration: 66 }),
    ]).start(done)
    await vi.advanceTimersByTimeAsync(80)
    expect(a.__getValue()).toBe(1)
    // 第二段刚起步(首帧落在 0 附近);只要还没推进到 1 就证明是串行而非并发
    expect(b.__getValue()).toBeLessThan(0.05)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(40)
    expect(b.__getValue()).toBeGreaterThan(0)
    expect(b.__getValue()).toBeLessThan(2)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(40)
    expect(b.__getValue()).toBe(2)
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('parallel 等最慢的一条,stop 连带子动画一起收尾', async () => {
    const fast = new Animated.Value(0)
    const slow = new Animated.Value(0)
    const done = vi.fn()
    const anim = Animated.parallel([
      Animated.timing(fast, { toValue: 1, duration: 66 }),
      Animated.timing(slow, { toValue: 1, duration: 132 }),
    ])
    anim.start(done)
    await vi.advanceTimersByTimeAsync(100)
    expect(fast.__getValue()).toBe(1)
    expect(slow.__getValue()).toBeLessThan(1)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60)
    expect(slow.__getValue()).toBe(1)
    expect(done).toHaveBeenCalledWith({ finished: true })
  })

  it('parallel.stop:发 finished:false,所有子帧清零', async () => {
    const a = new Animated.Value(0)
    const b = new Animated.Value(0)
    const done = vi.fn()
    const anim = Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 1000 }),
      Animated.timing(b, { toValue: 1, duration: 1000 }),
    ])
    anim.start(done)
    await vi.advanceTimersByTimeAsync(100)
    anim.stop()
    expect(done).toHaveBeenCalledWith({ finished: false })
    const frozenA = a.__getValue()
    const frozenB = b.__getValue()
    await vi.advanceTimersByTimeAsync(500)
    expect(a.__getValue()).toBe(frozenA)
    expect(b.__getValue()).toBe(frozenB)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stagger 错峰启动,全部结束才回调', async () => {
    const first = new Animated.Value(0)
    const second = new Animated.Value(0)
    const done = vi.fn()
    Animated.stagger(100, [
      Animated.timing(first, { toValue: 1, duration: 33 }),
      Animated.timing(second, { toValue: 1, duration: 33 }),
    ]).start(done)
    await vi.advanceTimersByTimeAsync(90)
    expect(first.__getValue()).toBe(1)
    expect(second.__getValue()).toBe(0)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(second.__getValue()).toBe(1)
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('loop 按 iterations 收敛;无限 loop 可被 stop 中断且不留帧', async () => {
    const counted = new Animated.Value(0)
    const countedDone = vi.fn()
    Animated.loop(Animated.timing(counted, { toValue: 1, duration: 33 }), {
      iterations: 2,
    }).start(countedDone)
    await vi.advanceTimersByTimeAsync(200)
    expect(countedDone).toHaveBeenCalledWith({ finished: true })
    expect(vi.getTimerCount()).toBe(0)

    const endless = new Animated.Value(0)
    const endlessDone = vi.fn()
    const loop = Animated.loop(Animated.timing(endless, { toValue: 1, duration: 500 }))
    loop.start(endlessDone)
    await vi.advanceTimersByTimeAsync(100)
    loop.stop()
    expect(endlessDone).toHaveBeenCalledWith({ finished: false })
    const frozen = endless.__getValue()
    await vi.advanceTimersByTimeAsync(500)
    expect(endless.__getValue()).toBe(frozen)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('取值与派生节点', () => {
  it('interpolate:分段线性、越界取端点、字符串停在段末(登记差异)', () => {
    const value = new Animated.Value(0)
    const linear = value.interpolate({ inputRange: [0, 1], outputRange: [0, 100] })
    value.setValue(0.5)
    expect(linear.__getValue()).toBe(50)
    value.setValue(-1)
    expect(linear.__getValue()).toBe(0)
    value.setValue(2)
    expect(linear.__getValue()).toBe(100)

    const piecewise = value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, 30] })
    value.setValue(0.25)
    expect(piecewise.__getValue()).toBe(5)
    value.setValue(0.75)
    expect(piecewise.__getValue()).toBe(20)

    const colors = value.interpolate({ inputRange: [0, 1], outputRange: ['#fff', '#000'] })
    value.setValue(0.5)
    expect(colors.__getValue()).toBe('#000')
  })

  it('add/multiply 是派生节点:跟随源值现算,不是创建时快照', () => {
    const value = new Animated.Value(2)
    const sum = Animated.add(value, 10)
    expect(sum.__getValue()).toBe(12)
    value.setValue(5)
    expect(sum.__getValue()).toBe(15)
    expect(sum.__animatedSources).toHaveLength(2)

    const half = value.interpolate({ inputRange: [0, 10], outputRange: [0, 1] })
    const scaled = Animated.multiply(half, 100)
    value.setValue(4)
    expect(scaled.__getValue()).toBe(40)
    value.setValue(8)
    expect(scaled.__getValue()).toBe(80)
  })

  it('ValueXY:两轴并行到终值,监听可退订', async () => {
    const xy = new Animated.ValueXY({ x: 0, y: 0 })
    const events: Array<{ x: number; y: number }> = []
    const id = xy.addListener((event) => events.push(event))
    const done = vi.fn()
    Animated.timing(xy, { toValue: { x: 10, y: 20 }, duration: 66 }).start(done)
    await vi.advanceTimersByTimeAsync(120)
    expect(xy.getLayoutValue()).toEqual({ x: 10, y: 20 })
    expect(done).toHaveBeenCalledWith({ finished: true })
    expect(events.length).toBeGreaterThan(0)
    const before = events.length
    xy.removeListener(id)
    xy.setValue({ x: 1, y: 2 })
    expect(events.length).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Animated.View 渲染面', () => {
  it('静态 style 与动画值合并:静态键一个不丢,动画键取当前帧值', () => {
    const opacity = new Animated.Value(0.5)
    const style = () => [
      { width: 120, backgroundColor: '#ff0000', paddingTop: 8 },
      { opacity: opacity as unknown as number },
    ]
    const first = renderToStaticMarkup(createElement(Animated.View, { style: style() }, 'probe'))
    expect(first).toContain('width:120px')
    expect(first).toContain('background-color:#ff0000')
    expect(first).toContain('padding-top:8px')
    expect(first).toContain('opacity:0.5')
    // 同一条 style 里动画节点必须现算:改值后新渲染不能停在创建时快照
    opacity.setValue(0)
    const second = renderToStaticMarkup(createElement(Animated.View, { style: style() }, 'probe'))
    expect(second).toContain('width:120px')
    expect(second).toContain('opacity:0')
  })

  it('把 transform 里的插值节点解成数值后交给底层组件(renderToStaticMarkup 取证)', () => {
    const value = new Animated.Value(0)
    const translateX = value.interpolate({ inputRange: [0, 1], outputRange: [0, 100] })
    value.setValue(0.5)
    const html = renderToStaticMarkup(
      createElement(
        Animated.View,
        { style: { transform: [{ translateX: translateX as unknown as number }] } },
        'probe',
      ),
    )
    expect(html).toContain('translateX(50px)')
    expect(html).toContain('probe')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
