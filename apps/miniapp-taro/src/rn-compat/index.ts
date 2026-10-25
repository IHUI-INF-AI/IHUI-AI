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

export * from './primitives'
export * from './apis'
export * from './icons-generated'

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
