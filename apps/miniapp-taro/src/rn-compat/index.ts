// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/index.ts —— `react-native` 在小程序构建里的替代出口(由 config/index.ts 的 alias 指向这里)。
 *
 * 这一格存在的意义(AGENTS §4「一份平台无关组件源 + 平台 adapter,禁止两端各写一份靠对账追平」):
 * `packages/app`(@ihui/rn-app)是 RN 与小程序共同的渲染真相源 —— RN 端 268/279 屏已在委托它,
 * 而小程序端此前 0 处真实复用,于是每一枚要对齐的屏都得手写一份,门只能事后对账。
 * 有了本层,小程序页面只需 import 共享屏,样式与功能随源头自动同步,不再靠人逐屏重写。
 *
 * 口径:
 *  - 组件在 ./primitives,API 在 ./apis,图标在 ./icons-generated(生成物)。
 *  - 数字 = dp,落 `Npx`(weapp 的 px 与 RN 的 dp 同为逻辑像素,尺寸 1:1;不做 rpx 换算)。
 *  - 语义降级处(Animated 补间、lucide strokeWidth)在各自文件里点名,不静默。
 */
import Taro from '@tarojs/taro'
// React 19 起全局 JSX 命名空间不再存在,`JSX.Element` 必须从 react 显式取类型位
import type { JSX } from 'react'

export * from './primitives'
export * from './apis'
export * from './icons-generated'

/**
 * 星号导出的重名消歧(必须写成显式出口,顺序无关):
 * `Image`(primitives vs 图标 Image)、`Keyboard`(apis 的 Keyboard 模块 vs 图标 Keyboard)在
 * 三条 `export *` 里同名 ⇒ ESM 语义下**歧义名两侧都不出口**,消费面 `<Image source=…>` 直接拿到 undefined。
 * 构建里那两条 "conflicting star exports for the name …" 警告就是这个,不是噪音。
 * 显式重导出压过歧义:组件语义归 primitives,系统键盘归 apis;图标要叫 Image 时走 `@rn-shells` 之外的
 * lucide 出口(lucide-react-native$ 直接指 icons-generated,不经本桶,故图标名不受影响)。
 */
export { Image } from './primitives'
export { Keyboard } from './apis'

/**
 * RN 的 findNodeHandle 在小程序里没有对应物(没有原生 view tag)。
 * 现读有 node_modules 侧的库按名取用它(构建里报 "export 'findNodeHandle' was not found in 'react-native'"),
 * 缺这一格时那条路径会在运行时拿到 undefined 去调用 ⇒ 这里给出**点名的降级**:返回 null,
 * 与 Animated 那档同一纪律(降级必须可见,不能变成缺失)。
 */
export function findNodeHandle(_componentOrRef?: unknown): number | null {
  return null
}

export { StyleSheet } from './style'
export type { ViewStyle, TextStyle, ImageStyle, StyleProp } from './style'

/** RN 侧的类型别名(共享层签名里会出现,缺了会让 miniapp 侧 typecheck 报错) */
export type ColorValue = string
export type ImageSourcePropType =
  string | number | { uri?: string; width?: number; height?: number }
export type GestureResponderEvent = { nativeEvent: unknown }
export type LayoutChangeEvent = {
  nativeEvent: { layout: { x: number; y: number; width: number; height: number } }
}
export type NativeSyntheticEvent<T> = { nativeEvent: T }
export type StatusBarStyle = 'default' | 'light-content' | 'dark-content'
export type AccessibilityRole = string
export type Transitions = Record<string, unknown>
export type StyleAttrs = Record<string, unknown>

/**
 * 共享层与 RN 壳实际 import 的其余 RN 类型名(现读口径:node .ihui-agent/tmp 那把尺量出的差集)。
 * 这些是**类型位**,运行时被 babel 擦除,但缺一枚就让 miniapp 侧 `tsc --noEmit` 报
 * "has no exported member" —— 而构建(babel)照样绿,正是"构建能过、类型失明"那一型。
 */
export type DimensionValue = number | string | `${number}%` | 'auto' | undefined
export type ListRenderItemInfo<T = unknown, Extra = unknown> = {
  item: T
  index: number
  separators: unknown
  extraData?: Extra
}
export type ListRenderItem<T = unknown, Extra = unknown> = (
  info: ListRenderItemInfo<T, Extra>,
) => JSX.Element | null
export type SectionListData<T = unknown, Extra = unknown> = {
  title?: string
  data: T[]
} & Record<string, Extra | undefined>
export type SectionListRenderItem<T = unknown, Extra = unknown> = (
  info: ListRenderItemInfo<T, Extra> & { section: SectionListData<T, Extra>; index: number },
) => JSX.Element | null
export type NativeScrollEvent = {
  contentInset: { bottom: number; left: number; right: number; top: number }
  contentSize: { height: number; width: number }
  contentOffset: { x: number; y: number }
  layoutMeasurement: { height: number; width: number }
  zoomScale?: number
  velocityX?: number
  velocityY?: number
}
export type NativeScrollEventLike = NativeScrollEvent
export type ImageLoadEventData = { width: number; height: number; uri?: string }
export type TextInputSubmitEditingEventData = { text: string }
export type PanResponderInstance = { panHandlers: Record<string, unknown> }
export type GestureState = {
  x0: number
  y0: number
  dx: number
  dy: number
  moveX: number
  moveY: number
}

export const AppState = {
  isAvailable: true,
  currentState: 'active' as 'active' | 'background' | 'inactive',
  addEventListener: (_type: string, _handler: unknown) => ({ remove() {} }),
  getInitialAppState: async () => 'active',
}

export const Appearance = {
  getColorScheme: (): 'light' | 'dark' => {
    try {
      const info = Taro.getSystemInfoSync()
      return info.theme === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  },
  addChangeListener: (_handler: unknown) => ({ remove() {} }),
}

export const I18nManager = {
  isRTL: false,
  allowRTL: (_v: boolean) => {},
  forceRTL: (_v: boolean) => {},
  swapLeftAndRightInRTL: (_f: boolean, _s: boolean) => {},
}

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelRatioForImage: (_s: unknown) => 2,
}

/** 小程序的导航栏/状态栏由原生 chrome 管(端内 theme.json + src/lib/theme.ts),不接受 JS 逐屏设置 */
export const StatusBar = {
  setBarStyle: (_s: string, _a?: boolean) => {},
  setBackgroundColor: (_c: string, _t?: boolean) => {},
  setHidden: (_h: boolean) => {},
  setTranslucent: (_t: boolean) => {},
  pushStack: (_e: unknown) => {},
  popStack: () => {},
  currentHeight: 0,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
