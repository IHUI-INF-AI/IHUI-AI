// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/apis.ts —— RN 非组件 API 的小程序端等价实现。
 *
 * 覆盖共享层实际用到的那一面(现读口径见 scripts/gen-rn-compat.mjs 的用量统计),
 * 每一项的"等价"含义写明白 —— 语义降级必须点名,不得静默变成"看起来能用"。
 */
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { Image as CompatImage, ScrollView, Text, View } from './primitives'
import type { RNBaseProps } from './primitives'

/** Dimensions:RN 的 dp 与小程序的 px 同为逻辑像素,直接取系统信息 */
export const Dimensions = {
  get(_dim: 'window' | 'screen') {
    const info = Taro.getSystemInfoSync()
    return {
      width: info.windowWidth,
      height: info.windowHeight,
      scale: info.pixelRatio,
      fontScale: 1,
    }
  },
  addEventListener(_type: string, _handler: unknown) {
    return { remove() {} }
  },
}

export function useWindowDimensions() {
  const info = Taro.getSystemInfoSync()
  return {
    width: info.windowWidth,
    height: info.windowHeight,
    scale: info.pixelRatio,
    fontScale: 1,
  }
}

/** 小程序没有 iOS/Android 之分,但共享层用 Platform.select 选档位 —— 按移动端处理 */
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  Version: 0,
  isIOS: true,
  isAndroid: false,
  isWeb: false,
  select<T>(spec: { ios?: T; android?: T; web?: T; native?: T; default?: T }): T | undefined {
    return spec.ios ?? spec.native ?? spec.default
  },
}

/** RN Alert.alert → 微信 showModal:按钮文案与顺序按 RN 语义映射(cancel 在前、destructive 为确认) */
export const Alert = {
  // 具名函数表达式而非方法简写:让守门 47 的 bare 判据能认出本文件的 `alert(` 是方法定义(适配层),不是浏览器裸调用
  alert: function alert(
    title?: string,
    message?: string,
    buttons?: Array<{
      text?: string
      style?: 'default' | 'cancel' | 'destructive'
      onPress?: () => void
    }>,
  ) {
    const list = buttons ?? []
    const cancel = list.find((b) => b.style === 'cancel')
    const rest = list.filter((b) => b.style !== 'cancel')
    const confirm = rest[rest.length - 1]
    if (list.length === 0) {
      void Taro.showModal({ title: title ?? '', content: message ?? '', showCancel: false })
      return
    }
    void Taro.showModal({
      title: title ?? '',
      content: message ?? '',
      showCancel: rest.length > 1 || Boolean(cancel),
      cancelText: cancel?.text ?? '取消',
      confirmText: confirm?.text ?? '确定',
      success: (res) => {
        if (res.confirm) confirm?.onPress?.()
        else cancel?.onPress?.()
      },
    })
  },
}

/** RN Linking.openURL:小程序只能开 web-view 页(与端内既有外链处理同一条路) */
export const Linking = {
  canOpenURL: async (_url: string) => true,
  openURL: async (url: string) => {
    await Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
    return true
  },
  addEventListener(_type: string, _handler: unknown) {
    return { remove() {} }
  },
  getInitialURL: async () => null,
}

/**
 * `action` 的唯一真值。返回值必须引用这两个常量而不是再写一遍字面量:
 * 调用方写的是 `res.action === Share.dismissedAction`,若常量与返回值任一格缺失,
 * `undefined === undefined` 恰为真 ⇒ 会把「分享已就绪」误判成「用户已取消」。
 * 这是静默假阴性,不是理论风险(共用的 RN 屏 AiCareerScreen 就是按该常量判的)。
 */
const SHARED_ACTION = 'sharedAction' as const
const DISMISSED_ACTION = 'dismissedAction' as const

/**
 * RN Share:小程序**没有**从代码直接拉起转发面板的 API(转发只能由右上角菜单或
 * `<button open-type="share">` 触发)。降级契约(登记差异):
 *  · 把 `url ?? message` 写进剪贴板 —— 用户仍能一键粘贴到任意会话;
 *  · 打开 `showShareMenu`(含朋友圈),让右上角转发入口可用;
 *  · 返回 `sharedAction`:表示「分享内容已就绪且转发入口已打开」,**不代表用户真的发出去了**
 *    (这一点平台无法观测;调用方若需精确结果只能依赖页面级 useShareAppMessage 的转发回调)。
 * 没有内容也开不了菜单时才返回 `dismissedAction`,让调用方的取消分支可达。
 */
export const Share = {
  sharedAction: SHARED_ACTION,
  dismissedAction: DISMISSED_ACTION,
  share: async (options: { message?: string; url?: string; title?: string }) => {
    const content = options.url ?? options.message ?? ''
    if (content) {
      try {
        await Taro.setClipboardData({ data: content })
      } catch {
        // 剪贴板被拒不妨碍转发菜单这一出口,继续往下走
      }
    }
    if (typeof Taro.showShareMenu === 'function') {
      try {
        Taro.showShareMenu({
          withShareTicket: true,
          showShareItems: ['shareAppMessage', 'shareTimeline'],
          // 后台未开通分享权限 / 个人主体 appId 会 fail(与 utils/share.ts 同一口径:静默)
          fail: () => {},
        })
      } catch {
        // 同步抛(宿主未实现/参数被拒)也只降级到「内容已就绪」,不能把整次分享变成拒绝
      }
      return { action: SHARED_ACTION, activityType: undefined }
    }
    if (!content) return { action: DISMISSED_ACTION, activityType: undefined }
    return { action: SHARED_ACTION, activityType: undefined }
  },
}

export const Keyboard = {
  dismiss: () => Taro.hideKeyboard(),
  addListener(_type: string, _handler: unknown) {
    return { remove() {} }
  },
  removeAllListeners: (_types?: string[]) => {},
}

/**
 * Easing:与 RN 同名同义的取值曲线。`bezier` 用二分反解 x(t)(不引三方库),
 * 结果与 CSS cubic-bezier 同形;字符串/颜色插值不在本层做(见 interpolate 的登记差异)。
 */
function bezierEase(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (u: number, a: number, b: number): number => {
    const v = 1 - u
    return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u
  }
  return (t: number) => {
    const x = Math.min(1, Math.max(0, t))
    if (x === 0 || x === 1) return x
    let lo = 0
    let hi = 1
    let u = x
    for (let i = 0; i < 20; i++) {
      const actual = sample(u, x1, x2)
      if (Math.abs(actual - x) < 1e-4) break
      if (actual < x) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
    return sample(u, y1, y2)
  }
}

const EASE = bezierEase(0.42, 0, 1, 1)

export const Easing = {
  linear: (t: number) => t,
  ease: EASE,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  in: (fn: (t: number) => number) => (t: number) => fn(t),
  out: (fn: (t: number) => number) => (t: number) => 1 - fn(1 - t),
  inOut: (fn: (t: number) => number) => (t: number) =>
    t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2,
  bezier: (x1: number, y1: number, x2: number, y2: number) => bezierEase(x1, y1, x2, y2),
}

/**
 * Animated 补间引擎(小程序端)**真播动画**:
 *  · 时间轴用 setTimeout 驱动,步长 33ms(≈30fps)。小程序没有稳定的 requestAnimationFrame
 *    保证(各宿主实现参差),定时器是唯一可用的通道;30fps 是渲染成本与观感的平衡点。
 *  · 值节点只算数、不碰 React;`Animated.View|Text|ScrollView|Image` 订阅样式里的节点,
 *    值变了才重渲染(30fps 封顶),不再是"直接落终值"。
 *  · 纯 JS 驱动 ⇒ `useNativeDriver` 无原生通道可走,一律按 JS 档执行(登记差异)。
 *  · `loop/parallel/sequence/stagger` 的 stop 清自己的定时器;页面在 effect 清理里 stop 即可
 *    (ScreenStates 的 Shimmer / StudyIndex 的跑马灯都已按这个口径写)。
 */
type AnimationEnd = (result: { finished: boolean }) => void

interface AnimationInstance {
  start: (callback?: AnimationEnd) => void
  stop: () => void
  reset: () => void
}

interface AnimatedNodeLike {
  __getValue: () => unknown
  addListener?: (listener: (event: { value: unknown }) => void) => string
  removeListener?: (id: string) => void
  __animatedSource?: AnimatedNodeLike
  __animatedSources?: AnimatedNodeLike[]
}

function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value && typeof value === 'object') {
    const node = value as { __getValue?: () => unknown }
    if (typeof node.__getValue === 'function') {
      const n = Number(node.__getValue())
      return Number.isFinite(n) ? n : 0
    }
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

class AnimatedValue {
  private listeners = new Map<string, (event: { value: number }) => void>()
  private seq = 0
  value: number
  constructor(initial = 0) {
    this.value = initial
  }
  __getValue(): number {
    return this.value
  }
  setValue(next: number) {
    this.value = next
    const event = { value: next }
    this.listeners.forEach((listener) => listener(event))
  }
  setOffset(_offset: number) {}
  flattenOffset() {}
  extractOffset() {}
  resetAnimation() {}
  addListener(listener: (event: { value: number }) => void): string {
    const id = `v${++this.seq}`
    this.listeners.set(id, listener)
    return id
  }
  removeListener(id: string) {
    this.listeners.delete(id)
  }
  removeAllListeners() {
    this.listeners.clear()
  }
  interpolate(cfg: { outputRange: (string | number)[]; inputRange?: number[] }) {
    return new AnimatedInterpolation(this, cfg.inputRange ?? [0, 1], cfg.outputRange)
  }
  getLayoutValue() {
    return this.value
  }
}

/**
 * 插值节点:每次取值都从源节点现算,所以源变它自然变。
 * 自身不持有监听 —— 包装组件沿 `__animatedSource` 链直接订阅源节点,页面重渲染多少次
 * 都不会产生重复订阅;这是"每次 render 都新建 interpolate"也不漏内存的关键。
 */
class AnimatedInterpolation implements AnimatedNodeLike {
  __animatedSource: AnimatedNodeLike
  private source: AnimatedValue
  private inputRange: number[]
  private outputRange: (string | number)[]

  constructor(source: AnimatedValue, inputRange: number[], outputRange: (string | number)[]) {
    this.source = source
    this.inputRange = inputRange
    this.outputRange = outputRange
    this.__animatedSource = source
  }

  __getValue(): string | number {
    const fallback = this.outputRange[this.outputRange.length - 1] ?? 0
    if (this.inputRange.length < 2 || this.outputRange.length === 0) return fallback
    const count = Math.min(this.inputRange.length, this.outputRange.length)
    const x = this.source.__getValue()
    const firstInput = this.inputRange[0]
    const lastInput = this.inputRange[count - 1]
    if (firstInput === undefined || lastInput === undefined) return fallback
    if (x <= firstInput) return this.outputRange[0] ?? fallback
    if (x >= lastInput) return this.outputRange[count - 1] ?? fallback
    for (let i = 0; i < count - 1; i++) {
      const start = this.inputRange[i]
      const end = this.inputRange[i + 1]
      if (start === undefined || end === undefined || x < start || x > end) continue
      const from = this.outputRange[i]
      const to = this.outputRange[i + 1]
      if (typeof from === 'number' && typeof to === 'number') {
        const span = end - start
        const t = span === 0 ? 1 : (x - start) / span
        return from + (to - from) * t
      }
      // 颜色等字符串插值需要解析色值,本层不做(登记差异):停在段末值,不闪中间色
      return to ?? fallback
    }
    return fallback
  }
}

type AnimatedDerived = { __getValue: () => number; __animatedSources: AnimatedNodeLike[] }

function derivedOperation(
  sources: unknown[],
  compute: (values: number[]) => number,
): AnimatedDerived {
  const nodes = sources.map((source) => source as AnimatedNodeLike)
  return {
    __animatedSources: nodes,
    __getValue: () => compute(nodes.map((node) => numericValue(node))),
  }
}

class AnimatedValueXY {
  x: AnimatedValue
  y: AnimatedValue
  constructor(initial = { x: 0, y: 0 }) {
    this.x = new AnimatedValue(initial.x)
    this.y = new AnimatedValue(initial.y)
  }
  get __animatedSources(): AnimatedNodeLike[] {
    return [this.x, this.y]
  }
  setValue(v: { x: number; y: number }) {
    this.x.setValue(v.x)
    this.y.setValue(v.y)
  }
  __getValue() {
    return this.getLayoutValue()
  }
  getLayoutValue() {
    return { x: this.x.value, y: this.y.value }
  }
  addListener(listener: (event: { x: number; y: number }) => void): string {
    const xid = this.x.addListener(() => listener(this.getLayoutValue()))
    const yid = this.y.addListener(() => listener(this.getLayoutValue()))
    return `xy${xid}|${yid}`
  }
  removeListener(id: string) {
    const [xid, yid] = id.replace(/^xy/, '').split('|')
    if (xid) this.x.removeListener(xid)
    if (yid) this.y.removeListener(yid)
  }
  removeAllListeners() {
    this.x.removeAllListeners()
    this.y.removeAllListeners()
  }
}

/** 帧步长:30fps。再快只是空转定时器,小程序渲染层也吃不满 60fps。 */
const FRAME_MS = 33

/**
 * 单帧循环:**唯一**的定时器实现。`frame(elapsedMs)` 返回 true 表示动画结束。
 * delay 与 elapsed 都以 Date.now() 为基准(而不是累加 33ms),避免长动画累积漂移。
 */
function timerAnimation(frame: (elapsedMs: number) => boolean, delayMs: number): AnimationInstance {
  let timer: ReturnType<typeof setTimeout> | null = null
  let callback: AnimationEnd | undefined
  let started = false
  let emitted = false
  let startAt = 0

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  const emit = (result: { finished: boolean }) => {
    if (emitted) return
    emitted = true
    clear()
    const cb = callback
    callback = undefined
    cb?.(result)
  }
  const tick = () => {
    if (!started) return
    const current = Date.now()
    const elapsed = current - startAt - delayMs
    if (elapsed < 0) {
      timer = setTimeout(tick, Math.max(1, Math.min(FRAME_MS, -elapsed)))
      return
    }
    if (frame(elapsed)) {
      emit({ finished: true })
      return
    }
    timer = setTimeout(tick, FRAME_MS)
  }

  return {
    start(cb) {
      clear()
      callback = cb
      started = true
      emitted = false
      startAt = Date.now()
      timer = setTimeout(tick, Math.min(Math.max(0, delayMs), FRAME_MS))
    },
    stop() {
      if (!started || emitted) return
      started = false
      emit({ finished: false })
    },
    reset() {
      clear()
      started = false
      emitted = false
      callback = undefined
    },
  }
}

interface TimingConfigLike {
  toValue?: unknown
  duration?: number
  delay?: number
  easing?: unknown
  useNativeDriver?: boolean
  iterations?: number
  callback?: AnimationEnd
}

function createTiming(value: AnimatedValue, config: TimingConfigLike): AnimationInstance {
  const to = numericValue(config.toValue)
  const duration = Math.max(0, config.duration ?? 500)
  const easing =
    typeof config.easing === 'function' ? (config.easing as (t: number) => number) : EASE
  const delay = Math.max(0, config.delay ?? 0)
  let from = value.__getValue()
  const inner = timerAnimation((elapsed) => {
    const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration)
    const eased = easing(Math.min(1, Math.max(0, t)))
    value.setValue(t >= 1 ? to : from + (to - from) * eased)
    return t >= 1
  }, delay)
  return {
    start: (cb) => {
      // 每轮重新采起点:loop 复用同一个实例时必须从当前值再出发(不是首轮的旧值)
      from = value.__getValue()
      inner.start(cb ?? config.callback)
    },
    stop: inner.stop,
    reset: inner.reset,
  }
}

interface SpringConfigLike {
  toValue?: unknown
  speed?: number
  bounciness?: number
  tension?: number
  friction?: number
  stiffness?: number
  damping?: number
  mass?: number
  overshootClamping?: boolean
  restDisplacementThreshold?: number
  restSpeedThreshold?: number
  delay?: number
  easing?: unknown
  useNativeDriver?: boolean
  iterations?: number
  callback?: AnimationEnd
}

function createSpring(value: AnimatedValue, config: SpringConfigLike): AnimationInstance {
  const to = numericValue(config.toValue)
  // RN 两套参数:老的 tension/friction,新的 stiffness/damping/mass。两套都接。
  const stiffness = config.stiffness ?? config.tension ?? 100
  const damping = config.damping ?? config.friction ?? 10
  const mass = config.mass && config.mass > 0 ? config.mass : 1
  const restDisplacement = config.restDisplacementThreshold ?? 0.001
  const restSpeed = config.restSpeedThreshold ?? 0.001
  const overshootClamping = config.overshootClamping === true
  const delay = Math.max(0, config.delay ?? 0)
  let x = value.__getValue()
  let velocity = 0
  const inner = timerAnimation(() => {
    const dt = FRAME_MS / 1000
    const previous = x
    const acceleration = (-stiffness * (x - to) - damping * velocity) / mass
    velocity += acceleration * dt
    x += velocity * dt
    if (overshootClamping && previous !== to && (previous - to) * (x - to) <= 0) {
      x = to
      velocity = 0
    }
    value.setValue(x)
    if (Math.abs(x - to) <= restDisplacement && Math.abs(velocity) <= restSpeed) {
      value.setValue(to)
      return true
    }
    return false
  }, delay)
  return {
    start: (cb) => {
      x = value.__getValue()
      velocity = 0
      inner.start(cb ?? config.callback)
    },
    stop: inner.stop,
    reset: inner.reset,
  }
}

interface DecayConfigLike {
  velocity?: number
  deceleration?: number
  callback?: AnimationEnd
}

function createDecay(value: AnimatedValue, config: DecayConfigLike): AnimationInstance {
  // velocity 的口径与 RN 手势 vx/vy 一致:逻辑像素/毫秒(deceleration 按毫秒衰减)
  const deceleration = config.deceleration ?? 0.998
  let velocity = config.velocity ?? 0
  let x = value.__getValue()
  let frames = 0
  const inner = timerAnimation(() => {
    velocity *= Math.pow(deceleration, FRAME_MS)
    x += velocity * FRAME_MS
    value.setValue(x)
    frames += 1
    // 速度阈值 + 20s 封顶:避免极慢衰减把定时器挂成常驻
    return Math.abs(velocity) < 0.001 || frames >= 600
  }, 0)
  return {
    start: (cb) => {
      velocity = config.velocity ?? 0
      x = value.__getValue()
      frames = 0
      inner.start(cb ?? config.callback)
    },
    stop: inner.stop,
    reset: inner.reset,
  }
}

function compositeParallel(children: AnimationInstance[]): AnimationInstance {
  let callback: AnimationEnd | undefined
  let outstanding = 0
  let stopped = false
  let finished = false

  const finish = (result: { finished: boolean }) => {
    if (finished) return
    finished = true
    const cb = callback
    callback = undefined
    cb?.(result)
  }

  return {
    start(cb) {
      callback = cb
      stopped = false
      finished = false
      if (children.length === 0) {
        finish({ finished: true })
        return
      }
      outstanding = children.length
      children.forEach((child) => {
        child.start((result) => {
          if (stopped || finished) return
          outstanding -= 1
          if (!result.finished) {
            children.forEach((other) => {
              if (other !== child) other.stop()
            })
            finish({ finished: false })
            return
          }
          if (outstanding === 0) finish({ finished: true })
        })
      })
    },
    stop() {
      if (finished) return
      stopped = true
      children.forEach((child) => child.stop())
      finish({ finished: false })
    },
    reset() {
      children.forEach((child) => child.reset())
    },
  }
}

function compositeSequence(children: AnimationInstance[]): AnimationInstance {
  let callback: AnimationEnd | undefined
  let index = 0
  let stopped = false
  let finished = false

  const finish = (result: { finished: boolean }) => {
    if (finished) return
    finished = true
    const cb = callback
    callback = undefined
    cb?.(result)
  }

  const runNext = () => {
    if (stopped || finished) return
    const child = children[index]
    if (!child) {
      finish({ finished: true })
      return
    }
    child.start((result) => {
      if (stopped || finished) return
      if (!result.finished) {
        finish({ finished: false })
        return
      }
      index += 1
      runNext()
    })
  }

  return {
    start(cb) {
      callback = cb
      stopped = false
      finished = false
      index = 0
      children.forEach((child) => child.reset())
      runNext()
    },
    stop() {
      if (finished) return
      stopped = true
      const child = children[index]
      child?.stop()
      finish({ finished: false })
    },
    reset() {
      children.forEach((child) => child.reset())
    },
  }
}

function compositeStagger(delay: number, children: AnimationInstance[]): AnimationInstance {
  let callback: AnimationEnd | undefined
  let outstanding = 0
  let stopped = false
  let finished = false
  let timers: Array<ReturnType<typeof setTimeout>> = []

  const finish = (result: { finished: boolean }) => {
    if (finished) return
    finished = true
    timers.forEach((timer) => clearTimeout(timer))
    timers = []
    const cb = callback
    callback = undefined
    cb?.(result)
  }

  return {
    start(cb) {
      callback = cb
      stopped = false
      finished = false
      outstanding = children.length
      if (outstanding === 0) {
        finish({ finished: true })
        return
      }
      timers = children.map((child, i) =>
        setTimeout(
          () => {
            if (stopped || finished) return
            child.start((result) => {
              if (stopped || finished) return
              outstanding -= 1
              if (!result.finished) {
                children.forEach((other) => {
                  if (other !== child) other.stop()
                })
                finish({ finished: false })
                return
              }
              if (outstanding === 0) finish({ finished: true })
            })
          },
          Math.max(0, delay) * i,
        ),
      )
    },
    stop() {
      if (finished) return
      stopped = true
      children.forEach((child) => child.stop())
      finish({ finished: false })
    },
    reset() {
      children.forEach((child) => child.reset())
    },
  }
}

function createLoop(
  animation: AnimationInstance,
  config?: { iterations?: number; resetBeforeIteration?: boolean },
): AnimationInstance {
  let callback: AnimationEnd | undefined
  let iteration = 0
  let stopped = false
  let finished = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const total = config?.iterations

  const finish = (result: { finished: boolean }) => {
    if (finished) return
    finished = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    const cb = callback
    callback = undefined
    cb?.(result)
  }

  const run = () => {
    if (stopped || finished) return
    if (total !== undefined && iteration >= total) {
      finish({ finished: true })
      return
    }
    iteration += 1
    animation.start((result) => {
      if (stopped || finished) return
      if (!result.finished) {
        finish({ finished: false })
        return
      }
      if (total !== undefined && iteration >= total) {
        finish({ finished: true })
        return
      }
      // 让出一拍再起下一轮:同步递归会在 duration=0 时把栈打穿
      timer = setTimeout(run, 0)
    })
  }

  return {
    start(cb) {
      callback = cb
      stopped = false
      finished = false
      iteration = 0
      run()
    },
    stop() {
      if (finished) return
      stopped = true
      animation.stop()
      finish({ finished: false })
    },
    reset() {
      animation.reset()
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

/** 样式树里的动画节点收集:数组/对象逐层下钻,插值节点沿来源链走 */
function collectAnimatedNodes(value: unknown, out: Set<AnimatedNodeLike>): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectAnimatedNodes(item, out))
    return
  }
  const node = value as AnimatedNodeLike
  if (Array.isArray(node.__animatedSources)) {
    node.__animatedSources.forEach((source) => collectAnimatedNodes(source, out))
  }
  if (node.__animatedSource) collectAnimatedNodes(node.__animatedSource, out)
  if (typeof node.__getValue === 'function') {
    out.add(node)
    return
  }
  Object.values(value).forEach((item) => collectAnimatedNodes(item, out))
}

/** 值取值:动画节点现算,数组/对象递归,其余原样(交给 primitives/style 转译) */
function resolveAnimatedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveAnimatedValue)
  if (value && typeof value === 'object') {
    const node = value as { __getValue?: () => unknown }
    if (typeof node.__getValue === 'function') return node.__getValue()
    const out: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => {
      out[key] = resolveAnimatedValue(item)
    })
    return out
  }
  return value
}

/**
 * 订阅样式里的动画节点:每次 render 后做一次集合差分(新增订阅 / 消失退订),
 * 所以调用方每次 render 新建插值对象也不会积累监听;卸载时全部退订。
 * 依赖数组刻意留空 —— 它就是"每次 render 后同步一次",不能只在挂载时跑。
 */
function useAnimatedStyleSubscription(style: unknown): void {
  const [, setVersion] = useState(0)
  const bumpRef = useRef<(() => void) | null>(null)
  if (!bumpRef.current) bumpRef.current = () => setVersion((v) => v + 1)
  const subscriptionsRef = useRef<Map<AnimatedNodeLike, string>>(new Map())

  useEffect(() => {
    const nodes = new Set<AnimatedNodeLike>()
    collectAnimatedNodes(style, nodes)
    const subscriptions = subscriptionsRef.current
    subscriptions.forEach((id, node) => {
      if (nodes.has(node)) return
      node.removeListener?.(id)
      subscriptions.delete(node)
    })
    nodes.forEach((node) => {
      if (subscriptions.has(node) || typeof node.addListener !== 'function') return
      subscriptions.set(node, node.addListener(bumpRef.current!))
    })
  })

  useEffect(() => {
    const subscriptions = subscriptionsRef.current
    return () => {
      subscriptions.forEach((id, node) => node.removeListener?.(id))
      subscriptions.clear()
    }
  }, [])
}

/**
 * 包装组件:**保留静态 style,再叠加动画值** —— 逐叶解值,静态键原样透传。
 * 旧实现把整个 `style` 从 props 里摘掉(`const { style: _animatedStyle, ...rest }`),
 * 调用方写在同一个 style 里的背景/尺寸/边距会随动画一起消失;这比"动画直接落终值"更严重,
 * 因为它连不含动画的静态外观也一起丢了。当前实现要求两件事同时成立:
 *  ① 静态键(含数组/嵌套数组形态)一个不丢;② 动画节点在渲染时取**当前帧值**,不是创建时快照。
 * 回归锁见 animated.test.ts 的「静态 style 与动画值合并」用例。
 */
function createAnimatedComponent<P extends object>(Component: (props: P) => ReactElement) {
  return function AnimatedComponent(props: P): ReactElement {
    const style = (props as { style?: unknown }).style
    useAnimatedStyleSubscription(style)
    const Target = Component as unknown as (p: Record<string, unknown>) => ReactElement
    return Target({
      ...(props as unknown as Record<string, unknown>),
      style: resolveAnimatedValue(style),
    })
  }
}

type Animatable = unknown

export const Animated = {
  Value: AnimatedValue,
  ValueXY: AnimatedValueXY,
  // 配置类型必须是 RN `Animated.TimingAnimationConfig` 的**超集**:消费方写的是标准 RN 配置
  // (`duration` / `useNativeDriver` / `easing` / `delay`)。类型面收不住会让跨端共享包
  // (ui-native 的 tooltip)在小程序宿主下编不过,「一份源码两端编」这条 §4 承诺就破了。
  timing: (
    value: AnimatedValue | AnimatedValueXY,
    config?: TimingConfigLike,
  ): AnimationInstance => {
    if (value instanceof AnimatedValueXY) {
      const target = (config?.toValue ?? {}) as { x?: unknown; y?: unknown }
      return compositeParallel([
        createTiming(value.x, { ...config, toValue: target.x ?? value.x.__getValue() }),
        createTiming(value.y, { ...config, toValue: target.y ?? value.y.__getValue() }),
      ])
    }
    return createTiming(value, config ?? {})
  },
  // 同 timing:必须是 RN `SpringAnimationConfig` 的超集(packages/app 的 ScreenStates
  // 直接用 `{ toValue, useNativeDriver, speed }` 写法)。
  spring: (value: Animatable, config?: SpringConfigLike): AnimationInstance => {
    if (value instanceof AnimatedValue) return createSpring(value, config ?? {})
    if (value instanceof AnimatedValueXY) {
      const target = (config?.toValue ?? {}) as { x?: unknown; y?: unknown }
      return compositeParallel([
        createSpring(value.x, { ...config, toValue: target.x ?? value.x.__getValue() }),
        createSpring(value.y, { ...config, toValue: target.y ?? value.y.__getValue() }),
      ])
    }
    return {
      start: (cb) => cb?.({ finished: true }),
      stop: () => {},
      reset: () => {},
    }
  },
  decay: (value: Animatable, config?: DecayConfigLike): AnimationInstance => {
    if (value instanceof AnimatedValue) return createDecay(value, config ?? {})
    return {
      start: (cb) => cb?.({ finished: true }),
      stop: () => {},
      reset: () => {},
    }
  },
  parallel: (anims: AnimationInstance[]) => compositeParallel(anims),
  sequence: (anims: AnimationInstance[]) => compositeSequence(anims),
  stagger: (delay: number, anims: AnimationInstance[]) => compositeStagger(delay, anims),
  loop: (
    anim: AnimationInstance,
    config?: { iterations?: number; resetBeforeIteration?: boolean },
  ) => createLoop(anim, config),
  // 四则/取模:返回**派生节点**(每次取值现算),不是创建时的快照 —— sheet 的
  // `Animated.add(baseTranslate, Animated.multiply(drag, -1))` 必须随 drag 变化而变化。
  add: (a: unknown, b: unknown) => derivedOperation([a, b], (v) => (v[0] ?? 0) + (v[1] ?? 0)),
  subtract: (a: unknown, b: unknown) => derivedOperation([a, b], (v) => (v[0] ?? 0) - (v[1] ?? 0)),
  multiply: (a: unknown, b: unknown) => derivedOperation([a, b], (v) => (v[0] ?? 0) * (v[1] ?? 0)),
  divide: (a: unknown, b: unknown) =>
    derivedOperation([a, b], (v) => (v[0] ?? 0) / ((v[1] ?? 0) || 1)),
  modulo: (a: unknown, m: unknown) =>
    derivedOperation([a, m], (v) => {
      const divisor = v[1] ?? 0
      return divisor === 0 ? 0 : (((v[0] ?? 0) % divisor) + divisor) % divisor
    }),
  event: () => () => {},
  createAnimatedComponent,
  // Animated.* 一律**照常渲染内容**,动画样式由包装组件解值后透传。
  // 入参取 RNBaseProps 而非 Record<string, unknown>:后者把每一枚回调都上下文定型成 unknown ⇒
  // 形参退回隐式 any(ui-native/sheet 的 `onResponderRelease={(e) => e.stopPropagation()}` 当场 TS7006)。
  View: createAnimatedComponent<RNBaseProps>((props) => View(props)),
  Text: createAnimatedComponent<RNBaseProps>((props) => Text(props as never)),
  ScrollView: createAnimatedComponent<RNBaseProps>((props) => ScrollView(props as never)),
  Image: createAnimatedComponent<RNBaseProps>((props) => CompatImage(props as never)),
}

export const Layout = {
  configureNext: () => {},
  animationEnabled: false,
}

export const BackHandler = {
  exitApp: () => Taro.exitMiniProgram(),
  addEventListener: (_type: string, _handler: unknown) => ({ remove() {} }),
  removeEventListener: (_type: string, _handler: unknown) => {},
}

export const DeviceEventEmitter = {
  addListener: (_type: string, _handler: unknown) => ({ remove() {} }),
  emit: (_type: string, _payload?: unknown) => true,
  removeAllListeners: (_type?: string) => {},
}

export const NativeEventEmitter = class {
  addListener() {
    return { remove() {} }
  }
  removeAllListeners() {}
  emit() {}
}

export const InteractionManager = {
  runAfterInteractions: (task: () => unknown) => {
    const id = setTimeout(() => task(), 0)
    return { then: (fn: () => void) => fn(), cancel: () => clearTimeout(id) }
  },
}

/** 读系统配色(非 hook 形态,供 Appearance 与 hook 共用 —— 钩子规则不许在非组件函数里调 use*) */
function readColorScheme(): 'light' | 'dark' {
  try {
    return Taro.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** RN 的 useColorScheme:小程序取微信 theme(auto 时由系统给),读不到按 light */
export function useColorScheme(): 'light' | 'dark' | null {
  return readColorScheme()
}

export const Appearance = {
  getColorScheme: (): 'light' | 'dark' => readColorScheme(),
  addChangeListener: (_handler: unknown) => ({ remove() {} }),
}

export const LayoutAnimation = {
  configureNext: (_config: unknown, _onComplete?: () => void) => {},
  Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
  Types: { stretch: 'stretch', opacity: 'opacity', scaleXY: 'scaleXY' },
  Properties: { duration: 'duration', delay: 'delay', interpolatingType: 'interpolatingType' },
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
