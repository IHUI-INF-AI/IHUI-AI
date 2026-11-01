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
// JSX 类型位随列表族一起搬进 ./primitives(React 19 起全局 JSX 命名空间不存在,必须显式取)

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

/** RN 侧的类型别名(共享层签名里会出现,缺了会让 miniapp 侧 typecheck 报错)
 *  ⚠️ 事件面 / Responder 族 / 组件 props 的类型位住在 ./primitives(由上面的 `export *` 再出口),
 *  这里**不得**再声明同名类型:同名局部声明会盖掉星号导出,于是同一概念出现两份形状 ——
 *  2026-11-01 实测到的现场就是 `ImageLoadEventData`(index 写 `{width,height,uri?}` 而 RN 是
 *  `{source:{width,height,uri}}`),共享源按 RN 形态读 `e.nativeEvent.source` 时只有一端编得过。 */
export type ColorValue = string
export type DimensionValue = number | string | `${number}%` | 'auto' | undefined
export type StatusBarStyle = 'default' | 'light-content' | 'dark-content'
export type Transitions = Record<string, unknown>
export type StyleAttrs = Record<string, unknown>

/**
 * 共享层与 RN 壳实际 import 的其余 RN 类型名(现读口径:量出的消费面差集)。
 * 这些是**类型位**,运行时被 babel 擦除,但缺一枚就让 miniapp 侧 `tsc --noEmit` 报
 * "has no exported member" —— 而构建(babel)照样绿,正是"构建能过、类型失明"那一型。
 * (守门 check-rn-compat-coverage C1 把这件事变成提交链上可判的:消费面具名取用的全集必须在册。)
 */
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

/**
 * 以下类型位此前在本文件各写一份,与 ./primitives 的组件 props 面**同一概念两处定义**
 * (§0.6)⇒ 整族搬进 ./primitives,由上面的 `export * from './primitives'` 再出口:
 * `ListRenderItemInfo` / `ListRenderItem` / `SectionListData` / `SectionListRenderItem`
 * (列表族 props 要用它们)、`ImageLoadEventData` / `ImageErrorEventData`、
 * `TextInputSubmitEditingEventData`、`PanResponderInstance` / `GestureState`。
 * 消费面按名 import 不受影响(出口名一个都没少)。
 */

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
