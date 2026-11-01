// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/primitives.tsx —— RN 基础组件在小程序端的等价实现。
 *
 * 口径:这一层的存在只服务一件事 —— 让 `packages/app` 那份**平台无关渲染真相源**
 * 不加改动地在小程序里跑起来(AGENTS §4 明确禁止"两端各写一份靠对账追平")。
 *
 * 必须复刻的 RN 语义(不是可选项,写错整屏布局就塌):
 *  1. RN 默认 `flexDirection: column`、`alignItems: stretch`、子项不收缩 —— CSS 默认全是另一套,
 *     所以 compat View 自带 flex 基线样式,调用方样式再覆盖它。
 *  2. `numberOfLines` 在 RN 是排版能力,小程序只能靠 CSS line-clamp(style.ts 承接)。
 *  3. RN `Image` 默认 `resizeMode: cover`,Taro 默认 `scaleToFill` ⇒ 不显式映射会拉伸变形。
 */
import type { ComponentProps, ComponentType, JSX, ReactNode, Ref } from 'react'
import {
  Image as TaroImage,
  Input,
  ScrollView as TaroScrollView,
  Switch as TaroSwitch,
  Text as TaroText,
  Textarea,
  View as TaroView,
} from '@tarojs/components'

import { flattenStyle, toTaroStyle, type StyleProp, type TextStyle, type ViewStyle } from './style'

/* ─────────────────────────────────────────────────────────────────────────────
 * RN 事件面 / 实例句柄 / props 具名键表 —— 全仓唯一定义处。
 *
 * 为什么住在这里(而不是 index.ts):index.ts 是 `react-native` 的替代出口,primitives 反向
 * import 它就成模块环(module-cycle 判据不吃豁免,2026-10-30 实测)⇒ 组件 props 的类型位必须
 * 与组件本体同文件,由 index.ts 的 `export * from './primitives'` 再出口。
 *
 * ⚠️ 形态要求:一律 `export type`(不是 `export interface`)。守门 check-rn-compat-coverage 的
 * C1 出口采集(该文件 `ownExports()` 的三条正则)只认
 * `export const|function|class|let|var NAME` / `export type NAME` / `export {NAME}` 三种形,
 * `export interface` 不在其列 ⇒ 写成 interface 会被判"没在册",消费面一 import 整门红。
 * ───────────────────────────────────────────────────────────────────────────── */

/** RN `SyntheticEvent<T>` 的等价面:共享层会用 `e.stopPropagation()` / `e.preventDefault()` */
export type NativeSyntheticEvent<T> = {
  type: string
  target: number
  currentTarget: number
  bubbles: boolean
  cancelable: boolean
  defaultPrevented: boolean
  eventPhase: number
  isTrusted: boolean
  timestamp: number
  nativeEvent: T
  preventDefault: () => void
  stopPropagation: () => void
  isDefaultPrevented: () => boolean
  isPropagationStopped: () => boolean
  persist: () => void
}

export type GestureResponderEvent = NativeSyntheticEvent<unknown>

export type LayoutRectangle = { x: number; y: number; width: number; height: number }
export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>

/** Pressable 的 onFocus/onBlur 载荷(RN 侧是 TargetedEvent) */
export type TargetedEvent = { target: number }

/** PanResponder 的第二形参:此前只有 6 个键,共享层读 vx/vy/numberActiveTouches 就落 unknown */
export type GestureState = {
  nativeEvent: unknown
  x0: number
  y0: number
  dx: number
  dy: number
  vx: number
  vy: number
  moveX: number
  moveY: number
  numberActiveTouches: number
  indexOfSingleActiveTouch: number
  mostRecentTimeStamp: number
  touchBank: unknown[]
}

export type TextInputFocusEventData = {
  text: string
  selection: { start: number; end: number }
}
export type TextInputEndEditingEventData = { text: string }
export type TextInputSubmitEditingEventData = { text: string }
export type TextInputSelectionChangeEventData = {
  text: string
  selection: { start: number; end: number }
}
export type TextInputContentSizeChangeEventData = { contentWidth: number; contentHeight: number }
export type TextInputKeyPressEventData = { key: string }

/**
 * RN 的图像加载事件载荷是 `{ source: { width, height, uri } }`(width/height **不在**顶层)。
 * 此前本层写成 `{ width, height, uri? }`,而共享层 BusinessLicenseScreen / ModelRecordScreen
 * 按 RN 形态读 `e.nativeEvent.source` ⇒ 两端只有一端编得过。这里按 RN 现读形态更正,并在
 * Image 的 onLoad 适配里真造这个形状(否则类型对了、运行时仍是 undefined)。
 */
export type ImageLoadEventData = { source: { width: number; height: number; uri: string } }
export type ImageErrorEventData = { error: string }

export type NativeMouseEvent = NativeSyntheticEvent<{
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  locationX: number
  locationY: number
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>

export type AccessibilityRole = string

/** RN 侧的 `Image.source` 形态(string / dp 号 / {uri} 三种都收,与 Image() 的解析一致) */
export type ImageSourcePropType =
  string | number | { uri?: string; width?: number; height?: number }

/**
 * RN 的 `<View>` 是类组件,`useRef<View>` 取到的是**实例句柄**;本层 View/Pressable 是函数组件,
 * React 19 把 ref 当普通 prop 传入 ⇒ 这里必须给出同名类型位,否则
 * `React.ComponentRef<typeof Pressable>` 解成 `never`(ui-native 的 Tappable 正用它),
 * 共享层的 `useRef<View>(null)` 直接报 TS2749。
 *
 * ⚠️ 类型面对齐 ≠ 能力对齐:本层组件**不回填**该句柄(真量坐标要走 Taro createSelectorQuery,
 * 需要一个 id,而共享层没给)⇒ 小程序宿主下 `measureInWindow` 的回调不会被调用,Tooltip /
 * CategoryDropdown 的自绘定位落回默认档。这是点名的降级,不是实现漏写。
 */
export type RNViewHandle = {
  measure: (
    callback: (x: number, y: number, width: number, height: number, px: number, py: number) => void,
  ) => void
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void
  measureLayout: (
    relativeToNativeNode: number,
    onFail: () => void,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
  ) => void
  focus: () => void
  blur: () => void
  isFocused: () => boolean
  setNativeProps: (props: Record<string, unknown>) => void
}

/** 与同名函数声明共存:type 位给 `useRef<View>` 用,value 位仍是组件本体 */
export type View = RNViewHandle

/** RN `Pressable` 的 state 回调形参 */
export type PressableStateCallbackType = { pressed: boolean }

/**
 * RN 组件 props 的**公共具名键表**(各组件独占的键在下面按组件另档)。
 * 此前这些键只落在索引签名上 ⇒ 取出来恒为 `unknown`,于是
 *  · `cn(..., className)` 报 TS2345(unknown 不是 ClassValue)
 *  · `onFocus?.(e)` 报 TS2349(unknown 不可调用)
 *  · `onFocus={(e) => …}` 报 TS7006(形参隐式 any)
 * RN 宿主下这些键由 RN 自己的类型给,所以只有小程序宿主红 —— 正是"一份源码两端编"要收的口。
 * 取值档刻意写得比 RN 宽(如 `keyboardType?: string`):这一层要的是**接受集对齐**,
 * 键名拼错的判据在 RN 宿主那边照样生效,不必在 adapter 里再造第二把尺。
 */
type RNComponentKeys = {
  id?: string
  testID?: string
  /** NativeWind/className 腿:共享源大量 `cn(..., className)`,不声明就是 unknown */
  className?: string
  accessible?: boolean
  accessibilityLabel?: string
  accessibilityRole?: AccessibilityRole
  accessibilityHint?: string
  accessibilityDescription?: string
  accessibilityState?: Record<string, boolean | undefined>
  accessibilityValue?: Record<string, number | string | undefined>
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive'
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants'
  pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto'
  collapsable?: boolean
  hitSlop?:
    | number
    | {
        top?: number
        left?: number
        right?: number
        bottom?: number
        vertical?: number
        horizontal?: number
      }
  // ── 按压/手势族
  /** RN 的 ViewProps 也带这一格(Touchable 族透传),共享源里 `<TouchableOpacity activeOpacity>` 大量在用 */
  activeOpacity?: number
  underlayColor?: string
  onPress?: (event: GestureResponderEvent) => void
  onPressIn?: (event: GestureResponderEvent) => void
  onPressOut?: (event: GestureResponderEvent) => void
  onPressMove?: (event: GestureResponderEvent) => void
  onLongPress?: (event: GestureResponderEvent) => void
  delayLongPress?: number
  delayPressIn?: number
  delayPressOut?: number
  pressRetentionOffset?: number | Record<string, number>
  android_disableSound?: boolean
  android_ripple?: Record<string, unknown>
  testOnly_pressed?: boolean
  unstable_pressDelay?: number
  cancelable?: boolean
  disabled?: boolean
  onHoverIn?: (event: NativeMouseEvent) => void
  onHoverOut?: (event: NativeMouseEvent) => void
  // ── Responder 族(sheet / collapsible 的拖拽与折叠)
  onStartShouldSetResponder?: (event: GestureResponderEvent) => boolean
  onMoveShouldSetResponder?: (event: GestureResponderEvent) => boolean
  onResponderGrant?: (event: GestureResponderEvent) => void
  onResponderMove?: (event: GestureResponderEvent) => void
  onResponderRelease?: (event: GestureResponderEvent) => void
  onResponderTerminate?: (event: GestureResponderEvent) => void
  onResponderTerminationRequest?: (event: GestureResponderEvent) => boolean
  onShouldBlockNativeResponder?: (event: GestureResponderEvent) => boolean
  // ── 布局回调
  onLayout?: (event: LayoutChangeEvent) => void
  // ── 文本族
  numberOfLines?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  selectable?: boolean
  adjustsFontSizeToFit?: boolean
  allowFontScaling?: boolean
  maxFontSizeMultiplier?: number
  suppressHighlighting?: boolean
  // ── 输入族
  value?: string | number
  defaultValue?: string
  placeholder?: string
  placeholderTextColor?: string
  editable?: boolean
  readOnly?: boolean
  multiline?: boolean
  maxLength?: number
  keyboardType?: string
  inputMode?: string
  returnKeyType?: string
  enterKeyHint?: string
  autoCapitalize?: string
  autoCorrect?: boolean
  autoFocus?: boolean
  blurOnSubmit?: boolean
  caretHidden?: boolean
  contextMenuHidden?: boolean
  secureTextEntry?: boolean
  selectTextOnFocus?: boolean
  showSoftInputOnFocus?: boolean
  selection?: { start: number; end: number } | null
  selectionColor?: string
  submitBehavior?: string
  inputAccessoryViewID?: string
  onChangeText?: (text: string) => void
  onFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData | TargetedEvent>) => void
  onBlur?: (event: NativeSyntheticEvent<TextInputFocusEventData | TargetedEvent>) => void
  onSubmitEditing?: (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void
  onEndEditing?: (event: NativeSyntheticEvent<TextInputEndEditingEventData>) => void
  onSelectionChange?: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void
  onKeyPress?: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void
  // ── 图片族
  source?: ImageSourcePropType
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat'
  onLoad?: (event: NativeSyntheticEvent<ImageLoadEventData>) => void
  onError?: (event: NativeSyntheticEvent<ImageErrorEventData>) => void
  defaultSource?: ImageSourcePropType
  fadeDuration?: number
  accessibilityIgnoresInvertColors?: boolean
  // ── 滚动/下拉刷新族(ScrollView 与列表族共用,签名两端一致)
  horizontal?: boolean
  scrollEnabled?: boolean
  pagingEnabled?: boolean
  showsHorizontalScrollIndicator?: boolean
  showsVerticalScrollIndicator?: boolean
  alwaysBounceHorizontal?: boolean
  alwaysBounceVertical?: boolean
  bounces?: boolean
  scrollsToTop?: boolean
  scrollEventThrottle?: number
  scrollIndicatorInsets?: Record<string, number>
  contentOffset?: { x?: number; y?: number }
  contentInset?: Record<string, number>
  contentContainerStyle?: StyleProp<ViewStyle | TextStyle>
  indicatorStyle?: 'default' | 'black' | 'white'
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled'
  keyboardDismissMode?: 'none' | 'interactive' | 'on-drag'
  stickyHeaderIndices?: number[]
  onScroll?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onMomentumScrollBegin?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onScrollBeginDrag?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onScrollEndDrag?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onScrollStateChanged?: (event: NativeSyntheticEvent<Record<string, unknown>>) => void
  onEndReached?: ((info?: unknown) => void) | null
  onEndReachedThreshold?: number
  onEndThreshold?: number
  refreshControl?: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  /** RN 列表族的 keyExtractor/渲染器在 RN 侧是 `?` 且带泛型,这里由 RNListProps<T> 收紧 */
  extraData?: unknown
  initialNumToRender?: number
  maxToRenderPerBatch?: number
  windowSize?: number
  estimatedItemSize?: number
  removeClippedSubviews?: boolean
  inverted?: boolean
  ListHeaderComponent?: ReactNode | ComponentType<Record<string, unknown>>
  ListFooterComponent?: ReactNode | ComponentType<Record<string, unknown>>
  ListEmptyComponent?: ReactNode | ComponentType<Record<string, unknown>>
  ItemSeparatorComponent?: ComponentType<Record<string, unknown>> | (() => ReactNode) | null
  /** `size`/`color`/`trackColor`/`thumbColor`/`onValueChange` 与 Modal 那族键**不进**公共表,
   *  由各组件的 props 档自带:公共表里出现同名键而 `interface X extends 公共表` 再声明成
   *  不同类型,会当场 TS2430(实测:ui-native 的 LoadingProps 给 `size?: LoadingSize`) */
}

/**
 * RN 组件 props 的公共面 = 具名键表 + style/children。
 *
 * ⚠️ 这一层**刻意没有索引签名**。此前写成 `{ [key: string]: unknown }` 兜住自定义属性,代价是
 * `Omit<T, K>` 会把整张具名表吃掉:`keyof T` 恒为 `string | number` ⇒ `Exclude<…, 'children'>`
 * 一个键都剔不掉 ⇒ `Pick` 出来只剩 `{[x:string]: unknown}`(2026-11-01 最小夹具实测坐实)。
 * 而共享源里有 4 处 `Omit<ComponentProps<typeof X>, …>`(avatar/tabs/loading/tappable)正靠它,
 * 于是 `className`/`disabled`/`onFocus` 在小程序宿主全部退化成 `unknown`,连片报
 * TS2345(ClassValue)/TS2349(不可调用)/TS7006(隐式 any)。RN 宿主下这些类型没有索引签名,
 * `Omit` 行为正常 ⇒ 去掉索引签名才是"两端同一接受集",缺键改由编译器逐条点名(已全数补齐)。
 */
export type RNBaseProps = RNComponentKeys & {
  style?: StyleProp<ViewStyle | TextStyle>
  children?: ReactNode
  /** React 19 起函数组件也把 ref 当普通 prop ⇒ 声明它,`ComponentRef<typeof View>` 才不解成 never */
  ref?: Ref<RNViewHandle>
}

/** Pressable 的 style/children 允许函数形态(RN 的 PressableStateCallbackType),其余键同公共表 */
export type RNPressableProps = Omit<RNBaseProps, 'style' | 'children'> & {
  style?:
    | StyleProp<ViewStyle | TextStyle>
    | ((state: PressableStateCallbackType) => StyleProp<ViewStyle | TextStyle>)
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode)
  /** React 19 把 ref 当普通 prop;声明它才让 `ComponentRef<typeof Pressable>` 解出句柄而非 never */
  ref?: Ref<RNViewHandle>
}

/** RN 同名出口(ui-native/tappable.tsx 直接 `import type { PressableProps }`) */
export type PressableProps = RNPressableProps

export type RNTextInputProps = RNBaseProps

export type RNImageProps = RNBaseProps

export type RNScrollViewProps = RNBaseProps

export type RNRefreshControlProps = RNBaseProps

export type RNSwitchProps = Omit<RNBaseProps, 'value'> & {
  value?: boolean
  onValueChange?: (value: boolean) => void
  trackColor?: Record<string, string | undefined> | string
  thumbColor?: string
}

export type RNActivityIndicatorProps = RNBaseProps & {
  size?: number | 'small' | 'large'
  color?: string
}

export type RNModalProps = RNBaseProps & {
  visible?: boolean
  transparent?: boolean
  animationType?: 'none' | 'slide' | 'fade'
  onRequestClose?: () => void
  statusBarTranslucent?: boolean
  presentationStyle?: string
  deviceHeight?: number
  deviceWidth?: number
  supportedOrientations?: string[]
  onShow?: () => void
}

/**
 * 列表族的渲染器信息(RN 同名类型,消费面按名 import)。
 * `separators` 在 RN 侧必填,本层没有分隔器对象可给 ⇒ 设为可选并在这里点名,而不是造一个假的。
 */
export type ListRenderItemInfo<T = unknown, Extra = unknown> = {
  item: T
  index: number
  separators?: unknown
  extraData?: Extra
}
export type ListRenderItem<T = unknown, Extra = unknown> = (
  info: ListRenderItemInfo<T, Extra>,
) => JSX.Element | null
export type SectionListData<T = unknown, Extra = unknown> = {
  key?: string
  title?: string
  data: T[]
} & Record<string, Extra | undefined>
export type SectionListRenderItem<T = unknown, Extra = unknown> = (
  info: ListRenderItemInfo<T, Extra> & { section: SectionListData<T, Extra>; index: number },
) => JSX.Element | null

/**
 * FlatList 的 props 面。**必须带泛型**:共享源写 `<FlatList<CouponItem> data=… renderItem=…>`,
 * 不带泛型就是 TS2558(Expected 0 type arguments);而 `data`/`renderItem`/`keyExtractor` 只有
 * 经同一个 `T` 互相连上,`renderItem={({ item }) => …}` 的 `item` 才有上下文类型(否则 TS7031
 * 隐式 any,并顺着把 `item.tags.map((tag) =>` 一起拖红)。
 */
export type RNFlatListProps<T> = RNBaseProps & {
  data?: readonly T[] | null
  renderItem?: ListRenderItem<T> | null
  keyExtractor?: (item: T, index: number) => string
  numColumns?: number
  columnWrapper?: ComponentType<Record<string, unknown>>
}

/** SectionList 的 props 面(段内行 + 段头渲染器) */
export type RNSectionListProps<T, SectionData = unknown> = RNBaseProps & {
  sections?: readonly SectionListData<T, SectionData>[] | null
  renderItem?: ListRenderItem<T> | null
  /**
   * 本层把 `renderSectionItem` 当**段头渲染器**用(小程序没有分区原语,只能逐段自绘:
   * 段头一次 + 段内行走 renderItem)。RN 的 SectionListRenderItem 形参还带 `item`,那是
   * RN 把段头也当作一行来渲染的实现细节 —— 本层不渲染段内行两次,所以只交 `{section,index}`,
   * 不仿一个拿不到的 item。RN 同名类型仍原样保留给消费面按名 import。
   */
  renderSectionItem?: (info: {
    section: SectionListData<T, SectionData>
    index: number
  }) => JSX.Element | null
  keyExtractor?: (item: T, index: number) => string
}

/** RN:flex column + 子项不收缩;compat View 的基线,调用方样式覆盖 */
const VIEW_BASE: ViewStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  alignContent: 'flex-start',
  flexShrink: 0,
  boxSizing: 'border-box',
  position: 'relative',
  borderStyle: 'solid',
  borderWidth: 0,
  margin: 0,
  padding: 0,
  minWidth: 0,
}

function merged(style: unknown, base: ViewStyle): ViewStyle {
  return { ...base, ...flattenStyle(style) }
}

// 事件位形状一律**从 Taro 组件自己的 props 反解**(ComponentProps),不自己写签名:
// 旧写法 `(...args: never[]) => void` 在 strictFunctionTypes 下把参数折成 never,与上游任何具体
// 事件类型都不兼容 ⇒ 4 处 TS2769(2026-10-26 现读)。名字对上号,改档时编译器会替我们追。
type TaroViewProps = ComponentProps<typeof TaroView>
type TaroScrollViewProps = ComponentProps<typeof TaroScrollView>
type TaroImageProps = ComponentProps<typeof TaroImage>
type TaroInputProps = ComponentProps<typeof Input>

type EventHandler = NonNullable<TaroViewProps['onLongPress']>
type ClickEventHandler = NonNullable<TaroViewProps['onClick']>
type ScrollEventHandler = NonNullable<TaroScrollViewProps['onScroll']>

/** Taro 事件 → RN 的 SyntheticEvent 形状(载荷类型由调用点给;单一换算口) */
function asNativeEvent<T>(event: unknown): NativeSyntheticEvent<T> {
  return event as unknown as NativeSyntheticEvent<T>
}

/**
 * RN 的事件对象在小程序宿主里其实就是 Taro 的事件(BaseEvent ⇒ 带 `detail`,也带
 * `stopPropagation`/`preventDefault`)⇒ 这里做**一次性边界换算**,把 RN 形状的类型交回调用方。
 * 换算只发生在 adapter(AGENTS §4「平台 adapter 注入」),共享源不为此加任何平台分支。
 */
function asGesture(event: unknown): GestureResponderEvent {
  return asNativeEvent<unknown>(event)
}

/** RN 形 handler 挂到 Taro 的事件位:没有就不挂(挂一个空函数会让 Taro 白绑一层) */
function toTaroTap(
  handler?: ((event: GestureResponderEvent) => void) | undefined,
): EventHandler | undefined {
  return handler
    ? (event) => {
        handler(asGesture(event))
      }
    : undefined
}

/**
 * RN 的 onPress 收的是原生事件对象,而端内点击位由 Taro 提供 ⇒ 把事件**透传**过去，
 * 而不是像旧写法那样 call 零参(改成从 Taro props 反解的事件签名后，零参调用当场编不过)。
 */
function clickHandler(props: RNBaseProps, extra?: () => void): ClickEventHandler | undefined {
  const onPress = props.onPress
  if (props.disabled === true) return undefined
  if (!onPress && !extra) return undefined
  return (event) => {
    extra?.()
    onPress?.(asGesture(event))
  }
}

export function View(props: RNBaseProps) {
  const onClick = clickHandler(props)
  return (
    <TaroView
      className={typeof props.className === 'string' ? props.className : undefined}
      style={toTaroStyle(merged(props.style, VIEW_BASE))}
      id={typeof props.id === 'string' ? props.id : undefined}
      onClick={onClick}
      onLongPress={toTaroTap(props.onLongPress)}
    >
      {props.children}
    </TaroView>
  )
}

export function Text(props: RNBaseProps) {
  const onClick = clickHandler(props)
  const numberOfLines = props.numberOfLines
  // 单行且未给 flex 时,RN 的 Text 默认不换行不折行;多行交给 line-clamp(style.ts)
  const nowrap = numberOfLines === 1 ? { whiteSpace: 'nowrap' as const } : {}
  return (
    <TaroText
      style={toTaroStyle({ ...flattenStyle(props.style), ...nowrap })}
      onClick={onClick}
      selectable={props.selectable}
    >
      {props.children}
    </TaroText>
  )
}

export const TouchableOpacity = View

/**
 * Pressable 的类型面必须收得住 RN 的**函数式** `children` / `style`(实现在下面本来就支持,
 * 运行时按 `{pressed:false}` 求值)。定义在上面的 RNPressableProps 档里,这里只做换算:
 * 函数形态先落回静态值,再交给 View(View 不接受函数形态 —— 与 RN 同一约束)。
 */
export function Pressable({ style, children, ...rest }: RNPressableProps) {
  const pressedStyle =
    typeof style === 'function' ? style({ pressed: false }) : (style as RNBaseProps['style'])
  const child = typeof children === 'function' ? children({ pressed: false }) : children
  return (
    <View {...rest} style={pressedStyle}>
      {child}
    </View>
  )
}

// 值档直接取 Image 组件自己的 mode 键集 ⇒ 写错一个模式名当场编不过(而不是运行时静默按默认档)
const RESIZE_MODE_TO_TARO: Record<string, NonNullable<TaroImageProps['mode']>> = {
  cover: 'aspectFill',
  contain: 'aspectFit',
  stretch: 'scaleToFill',
  center: 'widthFix',
  repeat: 'widthFix',
}

export function Image(props: RNImageProps) {
  const source = props.source
  const uri =
    typeof source === 'string' ? source : typeof source === 'number' ? String(source) : source?.uri
  const resizeMode = props.resizeMode ?? 'cover'
  const onLoad = props.onLoad
  const onError = props.onError
  /**
   * RN 的 `onLoad` 载荷是 `{ source: { width, height, uri } }`,weapp 的 `bindload` 给的是
   * `e.detail.{width,height}` ⇒ 由这一层造出 RN 形状(共享屏靠它算图片宽高比:
   * BusinessLicenseScreen / ModelRecordScreen)。此前本层**没有转发** onLoad,所以那两屏在
   * 小程序端拿不到尺寸、只能按默认档排 —— 类型补齐若不接这条腿,就是"类型对了、运行时仍空"。
   */
  return (
    <TaroImage
      src={uri ?? ''}
      mode={RESIZE_MODE_TO_TARO[resizeMode] ?? 'aspectFill'}
      style={toTaroStyle(merged(props.style, VIEW_BASE))}
      className={typeof props.className === 'string' ? props.className : undefined}
      onClick={clickHandler(props)}
      onLoad={
        onLoad
          ? (event) => {
              const detail = (event as unknown as { detail?: { width?: number; height?: number } })
                .detail
              onLoad(
                asNativeEvent<ImageLoadEventData>({
                  ...(event as object),
                  nativeEvent: {
                    source: {
                      width: detail?.width ?? 0,
                      height: detail?.height ?? 0,
                      uri: uri ?? '',
                    },
                  },
                }),
              )
            }
          : undefined
      }
      onError={
        onError
          ? (event) => {
              const detail = (event as unknown as { detail?: { errMsg?: string } }).detail
              onError(
                asNativeEvent<ImageErrorEventData>({
                  ...(event as object),
                  nativeEvent: { error: detail?.errMsg ?? 'image load failed' },
                }),
              )
            }
          : undefined
      }
    />
  )
}

/**
 * 按 handler 引用记"上一次放行的时刻"(小程序无原生滚动节流档 ⇒ 这一层自己收口)。
 * 用 WeakMap:页面卸载后不留下任何引用，不会把已销毁的回调钉在内存里。
 */
const lastScrollAt = new WeakMap<object, number>()

function throttledScroll(
  handler: RNComponentKeys['onScroll'],
  ms: number,
): ScrollEventHandler | undefined {
  if (!handler) return undefined
  const gate = Number.isFinite(ms) && ms >= 0 ? ms : 16
  return (event) => {
    const now = Date.now()
    const prev = lastScrollAt.get(handler)
    if (prev !== undefined && now - prev < gate) return
    lastScrollAt.set(handler, now)
    handler(asNativeEvent<Record<string, unknown>>(event))
  }
}

export function ScrollView(props: RNScrollViewProps) {
  const horizontal = props.horizontal === true
  const base: ViewStyle = horizontal ? { flexDirection: 'row' } : {}
  const throttleMs = typeof props.scrollEventThrottle === 'number' ? props.scrollEventThrottle : 16
  const onEndReached = props.onEndReached
  return (
    <TaroScrollView
      scrollX={horizontal}
      scrollY={!horizontal}
      enhanced
      showScrollbar={false}
      style={toTaroStyle(merged(props.style, { ...VIEW_BASE, ...base }))}
      // RN 的 scrollEventThrottle 在小程序没有原生对应档(旧写法把它当 Taro prop 直传,组件不认 ⇒ TS2769)
      // ⇒ 由这一层按同样的节奏收口:两次回调之间至少隔 throttleMs,超出窗口的直接吞掉
      onScroll={throttledScroll(props.onScroll, throttleMs)}
      lowerThreshold={props.onEndThreshold}
      onScrollToLower={
        onEndReached ? (event) => onEndReached(asNativeEvent<unknown>(event)) : undefined
      }
    >
      {props.refreshControl}
      <View style={props.contentContainerStyle}>{props.children}</View>
    </TaroScrollView>
  )
}

/** 下拉刷新:RN 把它做成 ScrollView 的子元素;小程序的下拉手势属页面级,由页面壳承接 */
export function RefreshControl(props: RNRefreshControlProps) {
  if (props.refreshing !== true) return null
  return <View style={{ alignItems: 'center', paddingVertical: 8 }}>{props.children}</View>
}

/**
 * 列表族必须带**泛型**:共享源写 `<FlatList<CouponItem> data=… renderItem=…>`,不带泛型就是
 * TS2558(Expected 0 type arguments);而 `data`→`renderItem`→`keyExtractor` 三者的元素类型只有
 * 经同一个 `T` 连上,`renderItem={({ item }) => …}` 才拿得到上下文类型(否则 TS7031 隐式 any,
 * 并顺着把 `item.tags.map((tag) =>` 一起拖红)。
 */
export function FlatList<T = unknown>(props: RNFlatListProps<T>) {
  const data = props.data ?? []
  const renderItem = props.renderItem
  const keyExtractor = props.keyExtractor
  const numColumns = props.numColumns ?? 1
  const Header = props.ListHeaderComponent as ReactNode
  const Footer = props.ListFooterComponent as ReactNode
  const Empty = props.ListEmptyComponent as ReactNode
  const Separator = props.ItemSeparatorComponent as (() => ReactNode) | undefined
  const rows: T[][] = []
  if (numColumns > 1) {
    for (let i = 0; i < data.length; i += numColumns) {
      rows.push(data.slice(i, i + numColumns) as T[])
    }
  }
  const cell = (item: T, index: number) => (
    <View
      key={keyExtractor ? keyExtractor(item, index) : String(index)}
      style={numColumns > 1 ? { flexGrow: 1, flexBasis: `${100 / numColumns}%` } : undefined}
    >
      {renderItem?.({ item, index })}
    </View>
  )
  return (
    <ScrollView {...props}>
      {Header}
      {data.length === 0 ? Empty : null}
      {numColumns > 1
        ? rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row' }}>
              {row.map((item, col) => cell(item, rowIndex * numColumns + col))}
            </View>
          ))
        : data.map((item, index) => (
            <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>
              {index > 0 ? Separator?.() : null}
              {renderItem?.({ item, index })}
            </View>
          ))}
      {Footer}
    </ScrollView>
  )
}

export function TextInput(props: RNTextInputProps) {
  const multiline = props.multiline === true
  const keyboardType = props.keyboardType ?? 'default'
  const typeMap: Record<string, NonNullable<TaroInputProps['type']>> = {
    // 微信 input 的 type 只有 text/number/idcard/digit/safe-password/nickname ⇒ email/url/tel 无原生键盘档,
    // 落最接近的一档(数字类落 number),而不是把一个平台不认的值传下去
    'email-address': 'text',
    number: 'number',
    'decimal-pad': 'digit',
    'phone-pad': 'number',
    url: 'text',
  }
  const common = {
    value: (props.value as string) ?? '',
    placeholder: (props.placeholder as string) ?? '',
    maxlength: (props.maxLength as number) ?? -1,
    disabled: props.editable === false,
    autoFocus: props.autoFocus === true,
    style: toTaroStyle(merged(props.style, VIEW_BASE)),
  }
  if (multiline) {
    return (
      <Textarea {...common} onInput={(e) => props.onChangeText?.(String(e.detail?.value ?? ''))} />
    )
  }
  return (
    <Input
      {...common}
      type={typeMap[keyTypeOf(keyboardType)]}
      password={props.secureTextEntry === true}
      onInput={(e) => props.onChangeText?.(String(e.detail?.value ?? ''))}
    />
  )
}

function keyTypeOf(keyboardType: string): string {
  return keyboardType === 'default' ? 'text' : keyboardType
}

export function Switch(props: RNSwitchProps) {
  return (
    <TaroSwitch
      checked={props.value === true}
      color={typeof props.trackColor === 'string' ? props.trackColor : undefined}
      onChange={(e) => props.onValueChange?.(Boolean(e.detail?.value))}
    />
  )
}

export function ActivityIndicator(props: RNActivityIndicatorProps) {
  const size = props.size
  const px = size === 'large' ? 36 : size === 'small' ? 16 : typeof size === 'number' ? size : 20
  const color = props.color ?? 'var(--color-muted-foreground)'
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          borderWidth: Math.max(2, Math.round(px / 10)),
          borderColor: color,
          borderTopColor: 'transparent',
        }}
        className="rn-activity-indicator"
      />
    </View>
  )
}

export function Modal(props: RNModalProps) {
  if (props.visible !== true) return null
  const transparent = props.transparent === true
  const onBack = props.onRequestClose
  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: transparent ? 'transparent' : 'var(--color-background)',
        alignItems: transparent ? 'center' : 'stretch',
        justifyContent: transparent ? 'center' : 'flex-start',
      }}
    >
      {onBack ? (
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          // 遮罩点击走 RN 的 onPress 口:此前写成 `onClick`,而 compat View 只把 onPress 挂到
          // Taro 的点击位 ⇒ 这一格"点了没反应"(Android 返回键 onRequestClose 另有页面壳承接)。
          onPress={onBack}
        />
      ) : null}
      <View style={transparent ? undefined : { flex: 1 }}>{props.children}</View>
    </View>
  )
}

export const SafeAreaView = View
export const KeyboardAvoidingView = View
export const TouchableHighlight = View
export const TouchableWithoutFeedback = View

/** RN 的分区列表:小程序没有分区原语,按「SectionList 语义」逐段渲染(段头 + 段内行) */
export function SectionList<T = unknown, SectionData = unknown>(
  props: RNSectionListProps<T, SectionData>,
) {
  const sections = props.sections ?? []
  const renderSection = props.renderSectionItem
  const renderItem = props.renderItem
  const keyExtractor = props.keyExtractor
  const ItemSeparator =
    typeof props.ItemSeparatorComponent === 'function'
      ? (props.ItemSeparatorComponent as () => ReactNode)
      : undefined
  return (
    <ScrollView {...props}>
      {props.ListHeaderComponent as ReactNode}
      {sections.map((section, index) => (
        <View key={section.key ?? String(index)}>
          {renderSection?.({ section, index })}
          {(section.data ?? []).map((item, i) => (
            <View key={keyExtractor ? keyExtractor(item, i) : String(i)}>
              {i > 0 ? ItemSeparator?.() : null}
              {renderItem?.({ item, index: i }) ?? null}
            </View>
          ))}
        </View>
      ))}
      {props.ListFooterComponent as ReactNode}
    </ScrollView>
  )
}

/** 背景图容器:RN 的 ImageBackground = Image 打底 + 内容浮在上层(absolute 铺满) */
export function ImageBackground(props: RNImageProps) {
  return (
    <View style={{ ...flattenStyle(props.style), position: 'relative', overflow: 'hidden' }}>
      <Image
        {...props}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />
      <View style={{ position: 'relative' }}>{props.children}</View>
    </View>
  )
}

/**
 * RN `PanResponder.create` 的 config 面。回调必须给到真签名:此前这里是
 * `Record<string, unknown>`,于是共享源 `onMoveShouldSetPanResponder: (_, g) => g.dy > 5`
 * 的两个形参在小程序宿主全是隐式 any(TS7006,6 条)。索引签名保留,是为了 RN 那串
 * `onStartShouldSetPanResponderCapture` 之类的键不必逐条列全。
 */
export type RNPanResponderConfig = {
  onStartShouldSetResponder?: (e: GestureResponderEvent, state: GestureState) => boolean
  onMoveShouldSetResponder?: (e: GestureResponderEvent, state: GestureState) => boolean
  onStartShouldSetPanResponder?: (e: GestureResponderEvent, state: GestureState) => boolean
  onStartShouldSetPanResponderCapture?: (e: GestureResponderEvent, state: GestureState) => boolean
  onMoveShouldSetPanResponder?: (e: GestureResponderEvent, state: GestureState) => boolean
  onMoveShouldSetPanResponderCapture?: (e: GestureResponderEvent, state: GestureState) => boolean
  onPanResponderTerminationRequest?: (e: GestureResponderEvent, state: GestureState) => boolean
  onPanResponderGrant?: (e: GestureResponderEvent, state: GestureState) => void
  onPanResponderMove?: (e: GestureResponderEvent, state: GestureState) => void
  onPanResponderRelease?: (e: GestureResponderEvent, state: GestureState) => void
  onPanResponderTerminate?: (e: GestureResponderEvent, state: GestureState) => void
  onShouldBlockNativeResponder?: (e: GestureResponderEvent, state: GestureState) => boolean
  [key: string]: unknown
}

/** `panHandlers` 摊开后挂到元素上的键(与 RNBaseProps 的 Responder 族同名同签名) */
export type RNPanHandlers = {
  onStartShouldSetResponder?: (e: GestureResponderEvent) => boolean
  onResponderGrant?: (e: GestureResponderEvent) => void
  onResponderMove?: (e: GestureResponderEvent) => void
  onResponderRelease?: (e: GestureResponderEvent) => void
  onResponderTerminate?: (e: GestureResponderEvent) => void
  onResponderTerminationRequest?: (e: GestureResponderEvent) => boolean
}

export type PanResponderInstance = { panHandlers: RNPanHandlers }

/**
 * 本层不产 GestureState:小程序的事件模型是 tap/longpress,没有 MoveResponder,
 * 也没有 `dx/vy/touchBank` 那一套几何可量(文件头点名的降级)。
 * 这一档全 0 是"量不出来"的显式表达,不是伪造中间值 —— 且它实际上**到不了调用方**:
 * compat 的 View/Animated.View 只把 onPress/onLongPress 挂到 Taro 的点击位,Responder 族键
 * 在这一层被丢弃(见 primitives 头注与 apis.ts 的 Animated 降级说明)。
 */
const ZERO_GESTURE_STATE: GestureState = {
  nativeEvent: undefined,
  x0: 0,
  y0: 0,
  dx: 0,
  dy: 0,
  vx: 0,
  vy: 0,
  moveX: 0,
  moveY: 0,
  numberActiveTouches: 0,
  indexOfSingleActiveTouch: 0,
  mostRecentTimeStamp: 0,
  touchBank: [],
}

/**
 * RN 手势Responder 族:小程序的事件模型是 tap/longpress,没有 MoveResponder。
 * 这里给"能编译、能点"的最小实现 —— 拖动/滑动类交互在小程序端需按端能力另写,
 * 本层不假装有(降级在此点名,与 Animated 的"落终值"同一处置纪律)。
 */
export const PanResponder = {
  create(config: RNPanResponderConfig): PanResponderInstance {
    const onStart = config.onStartShouldSetPanResponder
    const grant = config.onPanResponderGrant
    const move = config.onPanResponderMove
    const release = config.onPanResponderRelease
    const terminate = config.onPanResponderTerminate
    return {
      get panHandlers(): RNPanHandlers {
        return {
          onStartShouldSetResponder: onStart ? () => true : undefined,
          onResponderGrant: grant ? (e) => grant(e, ZERO_GESTURE_STATE) : undefined,
          onResponderMove: move ? (e) => move(e, ZERO_GESTURE_STATE) : undefined,
          onResponderRelease: release ? (e) => release(e, ZERO_GESTURE_STATE) : undefined,
          onResponderTerminate: terminate ? (e) => terminate(e, ZERO_GESTURE_STATE) : undefined,
        }
      },
    }
  },
}

export const NativeModules: Record<string, unknown> = {}
export const DevSettings = {
  addEventListener: () => ({ remove() {} }),
  reload: () => {},
  openDevMenu: () => {},
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
