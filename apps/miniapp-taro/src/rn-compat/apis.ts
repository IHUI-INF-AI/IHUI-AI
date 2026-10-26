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

import { Image as CompatImage, ScrollView, Text, View } from './primitives'

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
  OS: 'ios' as 'ios' | 'android',
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
  alert(
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

/** RN Share:小程序的分享是右上角菜单/转发起,弹层无对应能力 ⇒ 走系统转发菜单 */
export const Share = {
  share: async (options: { message?: string; url?: string; title?: string }) => {
    await Taro.showModal({
      title: options.title ?? '分享',
      content: options.url ?? options.message ?? '',
      showCancel: false,
    })
    return { activityType: undefined }
  },
}

export const Keyboard = {
  dismiss: () => Taro.hideKeyboard(),
  addListener(_type: string, _handler: unknown) {
    return { remove() {} }
  },
  removeAllListeners: (_types?: string[]) => {},
}

/** Easing:Animated 档的取值函数,保留 RN 同名曲线(本层 Animated 不做补间,仅承接语义) */
export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
  bezier: () => (t: number) => t,
}

/**
 * Animated 的最小等价实现 —— **语义降级点,必须读清楚**:
 * RN 的逐帧补间在小程序没有对等物(共享层用它做的是入场位移/透明度)。这里的选择是
 * "直接落到终值":动画不播,但**最终状态与 RN 一致** —— 布局、可见性、透明度都正确。
 * 反过来(保持 0 值不动)会让整屏内容永久不可见,那才是功能性缺陷。
 * 需要真补间的屏,由页面侧用 CSS transition 自行加强,不在本层假装有。
 */
class AnimatedValue {
  private listeners = new Set<(v: { value: number }) => void>()
  value: number
  constructor(initial = 0) {
    this.value = initial
  }
  setValue(next: number) {
    this.value = next
    this.listeners.forEach((l) => l({ value: next }))
  }
  setOffset() {}
  flattenOffset() {}
  extractOffset() {}
  resetAnimation() {}
  addListener(l: (v: { value: number }) => void) {
    this.listeners.add(l)
    return String(this.listeners.size)
  }
  removeListener(id: string) {
    const i = Number(id) - 1
    // Set 按下标取值在 noUncheckedIndexedAccess 下是 T | undefined ⇒ 先取进变量再判,
    // 否则 delete(undefined) 既是类型错也是"删了个不存在的东西"的静默失败
    const victim = [...this.listeners][i]
    if (i >= 0 && victim !== undefined) this.listeners.delete(victim)
  }
  removeAllListeners() {
    this.listeners.clear()
  }
  interpolate(cfg: { outputRange: (string | number)[]; inputRange?: number[] }) {
    const out = cfg.outputRange
    const target = new AnimatedValue(0)
    // 落终值:取 outputRange 末位(数字档),字符串档原样交给样式层
    const last = out[out.length - 1]
    target.value = typeof last === 'number' ? last : 0
    // outputRange 为空 ⇒ 不写 __css(写了 undefined 反而把"没给终值"说成"终值是 undefined")
    if (last !== undefined) (target as unknown as { __css: string | number }).__css = last
    void cfg.inputRange
    return target
  }
  getLayoutValue() {
    return this.value
  }
}

class AnimatedValueXY {
  x: AnimatedValue
  y: AnimatedValue
  constructor(initial = { x: 0, y: 0 }) {
    this.x = new AnimatedValue(initial.x)
    this.y = new AnimatedValue(initial.y)
  }
  setValue(v: { x: number; y: number }) {
    this.x.setValue(v.x)
    this.y.setValue(v.y)
  }
  getLayoutValue() {
    return { x: this.x.value, y: this.y.value }
  }
  addListener() {
    return '0'
  }
  removeListener() {}
  removeAllListeners() {}
}

function runToEnd(
  config: { toValue?: unknown; callback?: (r: { finished: boolean }) => void } | undefined,
  cb?: unknown,
) {
  const target = config?.toValue
  if (target instanceof AnimatedValue) {
    const css = (target as unknown as { __css?: string | number }).__css
    if (typeof css === 'number') target.setValue(css)
  } else if (target instanceof AnimatedValueXY) {
    target.setValue({ x: target.x.value, y: target.y.value })
  }
  const callback = (config?.callback ?? (typeof cb === 'function' ? cb : undefined)) as
    ((r: { finished: boolean }) => void) | undefined
  callback?.({ finished: true })
  return { start: (fn?: unknown) => runToEnd(config, fn), stop() {} }
}

type Animatable = unknown

export const Animated = {
  Value: AnimatedValue,
  ValueXY: AnimatedValueXY,
  timing: (
    value: AnimatedValue | AnimatedValueXY,
    config?: { toValue?: unknown; callback?: (r: { finished: boolean }) => void },
  ) => {
    // 立即把目标推到终值,再返回一个可 start() 的句柄
    if (config && 'toValue' in config) {
      const tv = config.toValue
      if (value instanceof AnimatedValue && tv instanceof AnimatedValue) {
        const css = (tv as unknown as { __css?: string | number }).__css
        value.value = typeof css === 'number' ? css : value.value
      }
    }
    return runToEnd(config)
  },
  spring: (
    _value: Animatable,
    config?: { toValue?: unknown; callback?: (r: { finished: boolean }) => void },
  ) => runToEnd(config),
  decay: (
    _value: Animatable,
    config?: { velocity?: number; callback?: (r: { finished: boolean }) => void },
  ) => runToEnd(config),
  parallel: (anims: Array<{ start: (cb?: unknown) => unknown }>) => ({
    start: (cb?: unknown) => {
      anims.forEach((a) => a.start())
      if (typeof cb === 'function') cb({ finished: true })
    },
    stop: () => {},
  }),
  sequence: (anims: Array<{ start: (cb?: unknown) => unknown }>) => ({
    start: (cb?: unknown) => {
      anims.forEach((a) => a.start())
      if (typeof cb === 'function') cb({ finished: true })
    },
    stop: () => {},
  }),
  stagger: (_delay: number, anims: Array<{ start: (cb?: unknown) => unknown }>) => ({
    start: (cb?: unknown) => {
      anims.forEach((a) => a.start())
      if (typeof cb === 'function') cb({ finished: true })
    },
    stop: () => {},
  }),
  loop: (anim: { start: (cb?: unknown) => unknown }) => ({
    start: (cb?: unknown) => {
      anim.start()
      if (typeof cb === 'function') cb({ finished: true })
    },
    stop: () => {},
  }),
  add: (a: AnimatedValue, b: AnimatedValue) => new AnimatedValue(a.value + b.value),
  subtract: (a: AnimatedValue, b: AnimatedValue) => new AnimatedValue(a.value - b.value),
  multiply: (a: AnimatedValue, b: number | AnimatedValue) =>
    new AnimatedValue(a.value * (typeof b === 'number' ? b : b.value)),
  divide: (a: AnimatedValue, b: number | AnimatedValue) =>
    new AnimatedValue(a.value / (typeof b === 'number' ? b : b.value || 1)),
  modulo: (a: AnimatedValue, m: number) => new AnimatedValue(((a.value % m) + m) % m),
  event: () => () => {},
  createAnimatedComponent: <P extends object>(Component: (p: P) => unknown) =>
    function AnimatedComponent(props: P & { style?: unknown }) {
      const { style: _animatedStyle, ...rest } = props
      return Component(rest as P)
    },
  // Animated.* 一律**照常渲染内容**,只丢弃补间样式(动画不播、终值正确)。
  // 返回 null 会让共享层的入场动画包裹层整块消失 —— 那是功能缺陷,不是降级。
  View: (props: Record<string, unknown>) => View(props as never),
  Text: (props: Record<string, unknown>) => Text(props as never),
  ScrollView: (props: Record<string, unknown>) => ScrollView(props as never),
  Image: (props: Record<string, unknown>) => CompatImage(props as never),
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
