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
import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react'
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
/**
 * 纯类型别名一律 `import type`(编译期擦除,不进运行时图):`./index` 会 `export * from './primitives'`,
 * 值层若互相 require 就是环 —— 类型层没有这个问题。
 */
import type {
  AccessibilityRole,
  ColorValue,
  GestureResponderEvent,
  GestureState,
  ImageLoadEventData,
  ImageSourcePropType,
  LayoutChangeEvent,
  NativeSyntheticEvent,
} from './index'

/**
 * RN 侧 props 面(与 RN 0.86 同名同形)—— **闭合**,不带索引签名。
 * 闭合的两个理由(都是现读的错因):
 *  1. 索引签名让未声明的键变成 unknown ⇒ 回调形参失去上下文类型(TS7006)、
 *     cn(props.className) 收 unknown(TS2345)、props.onPause?.() 不可调用(TS2349);
 *  2. keyof 被索引签名撑成 string|number ⇒ 下游 Omit<PressableProps,'style'>
 *     折叠成纯索引签名,连已声明的 accessibilityLabel 也退回 unknown。
 * className 不是 RN 原生键,是 nativewind 的模块增强(react-native-css-interop/types.d.ts),
 * 小程序宿主不加载那份增强 ⇒ 必须在这里显式声明。
 */
export interface RNCompatProps {
  style?: StyleProp<ViewStyle | TextStyle>
  children?: ReactNode
  className?: string
  testID?: string
  accessible?: boolean
  disabled?: boolean
  hitSlop?: number | { top?: number; left?: number; right?: number; bottom?: number }
  delayLongPress?: number
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only'
  accessibilityRole?: AccessibilityRole
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityState?: {
    disabled?: boolean
    selected?: boolean
    checked?: boolean | 'mixed'
    busy?: boolean
    expanded?: boolean
  }
  onPress?: (e: GestureResponderEvent) => void
  onLongPress?: (e: GestureResponderEvent) => void
  onPressIn?: (e: GestureResponderEvent) => void
  onPressOut?: (e: GestureResponderEvent) => void
  onLayout?: (e: LayoutChangeEvent) => void
  onFocus?: (e: NativeSyntheticEvent<{ target: number }>) => void
  onBlur?: (e: NativeSyntheticEvent<{ target: number }>) => void
  onLoad?: (e: NativeSyntheticEvent<ImageLoadEventData>) => void
  numberOfLines?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  selectable?: boolean
  allowFontScaling?: boolean
  maxFontSizeMultiplier?: number
  value?: string | boolean
  defaultValue?: string
  placeholder?: string
  placeholderTextColor?: ColorValue
  maxLength?: number
  editable?: boolean
  multiline?: boolean
  secureTextEntry?: boolean
  autoFocus?: boolean
  keyboardType?: string
  onChangeText?: (text: string) => void
  onValueChange?: (value: boolean) => void
  trackColor?: { false?: ColorValue; true?: ColorValue }
  thumbColor?: ColorValue
  source?: ImageSourcePropType
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat'
  horizontal?: boolean
  scrollEventThrottle?: number
  /**
   * responder 族(RN View 的原生事件面)。共享层会直接在 `<Animated.View onResponderRelease>` 上挂
   * 手势回调(ui-native/sheet 的遮罩点穿);不声明这一格,回调形参就没有上下文类型(TS7006)。
   * 小程序端不派发这几个事件(见 PanResponder 的降级点名),声明位只为让共享层写得出类型。
   */
  onStartShouldSetResponder?: (e: GestureResponderEvent) => boolean
  onResponderGrant?: (e: GestureResponderEvent) => void
  onResponderMove?: (e: GestureResponderEvent) => void
  onResponderRelease?: (e: GestureResponderEvent) => void
  onResponderTerminate?: (e: GestureResponderEvent) => void
}

/** 组件签名 = 闭合面 + 兜底键(各屏自定义属性照旧可传);派生类型(Omit/Pick)一律用 RNCompatProps */
export type RNBaseProps = RNCompatProps & { [key: string]: unknown }

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

type EventHandler = NonNullable<TaroViewProps['onLongPress']> | undefined
type ScrollEventHandler = NonNullable<TaroScrollViewProps['onScroll']> | undefined
type ScrollToLowerEventHandler = NonNullable<TaroScrollViewProps['onScrollToLower']> | undefined

/**
 * RN 的 onPress 收的是原生事件对象,而端内点击位由 Taro 提供 ⇒ 把事件**透传**过去，
 * 而不是像旧写法那样 call 零参(改成从 Taro props 反解的事件签名后，零参调用当场编不过)。
 */
function clickHandler(
  props: RNBaseProps,
  extra?: () => void,
): ((event: Parameters<NonNullable<EventHandler>>[0]) => void) | undefined {
  const onPress = props.onPress as EventHandler
  if (props.disabled === true) return undefined
  if (!onPress && !extra) return undefined
  return (event) => {
    extra?.()
    onPress?.(event)
  }
}

/**
 * View 的签名成对写:第一支收兜底键(调用面:各屏往 View 上塞 id/自定义属性),
 * 第二支是**闭合面** —— 后端工具类型按"最后一个重载"取值:
 * `ComponentProps<typeof View>` / `Parameters<typeof View>` 因此拿到 RNCompatProps,
 * 于是 ui-native 的 `Omit<ComponentProps<typeof View>, 'children'>`(avatar/tabs)不会
 * 因索引签名把 keyof 撑成 string|number 而整块折叠成纯索引签名(className 退回 unknown)。
 * 纯类型手法,运行时仍是下面那一份实现。
 */
export function View(props: RNBaseProps): ReactElement
export function View(props: RNCompatProps): ReactElement
export function View(props: RNCompatProps) {
  // 实现体按**兜底面**读(id 等各屏自定义键不在闭合面上)。RNCompatProps 是 interface,
  // 结构上不满足 `{[k:string]: unknown}` 的索引签名要求(TS 只给匿名对象类型隐式索引),
  // 所以这一支只能取闭合面 + 断言;运行时形状同一个对象,零改动。
  const p = props as RNBaseProps
  const onClick = clickHandler(p)
  return (
    <TaroView
      className={typeof p.className === 'string' ? p.className : undefined}
      style={toTaroStyle(merged(p.style, VIEW_BASE))}
      id={typeof p.id === 'string' ? p.id : undefined}
      onClick={onClick}
      onLongPress={p.onLongPress as EventHandler}
    >
      {p.children}
    </TaroView>
  )
}

/**
 * RN 的 View 是 class(值/类型两侧都有);共享层 `useRef<View>(null)` 取的是**类型位**。
 * 本文件的 `export function View` 只占值位 ⇒ 这里补类型位(同名的类型与值分属两套声明空间,不冲突)。
 * 方法集只收共享层真用到的那三枚(Tooltip 的 measureInWindow;measure/setNativeProps 为同类惯例位)。
 */
export interface ViewInstance {
  measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void
  measure(
    cb: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void,
  ): void
  setNativeProps(props: Record<string, unknown>): void
}
export type View = ViewInstance

export function Text(props: RNBaseProps) {
  const onClick = clickHandler(props)
  const numberOfLines = props.numberOfLines as number | undefined
  // 单行且未给 flex 时,RN 的 Text 默认不换行不折行;多行交给 line-clamp(style.ts)
  const nowrap = numberOfLines === 1 ? { whiteSpace: 'nowrap' as const } : {}
  return (
    <TaroText
      className={typeof props.className === 'string' ? props.className : undefined}
      style={toTaroStyle({ ...flattenStyle(props.style), ...nowrap })}
      onClick={onClick}
      selectable={props.selectable as boolean | undefined}
    >
      {props.children}
    </TaroText>
  )
}

export const TouchableOpacity = View

/**
 * Pressable 的类型面必须收得住 RN 的**函数式** `children` / `style`:
 * 实现在下面本来就支持(运行时按 `{pressed:false}` 求值),但 `RNBaseProps` 只声明了
 * `ReactNode` / `StyleProp`,于是跨端共享包(ui-native 的 Tappable、packages/app 的
 * BackChevron/MoreLink)在小程序宿主下编不过(TS2322/TS7031)。
 * 只给 Pressable 放宽,View/Text 仍按原样(它们本来就不接受函数形态)。
 */
export interface PressableProps extends Omit<RNCompatProps, 'style' | 'children'> {
  style?:
    | StyleProp<ViewStyle | TextStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle | TextStyle>)
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode)
  /**
   * ref 位:RN 的 Pressable 是 forwardRef 组件,ui-native 的 Tappable 正按
   * `forwardRef<ComponentRef<typeof Pressable>>` 派生 ref 类型。本层的 Pressable 是普通函数组件,
   * 不声明这一格时 `ComponentRef<typeof Pressable>` 折成 never ⇒ Tappable 的 ref 变成 ForwardedRef<never>,
   * 消费面(Tooltip 的 `useRef<View>`)整条编不过。**只有类型位**:运行时 ref 不会落到任何原生节点上
   * (小程序没有 view tag,这条与 findNodeHandle 的降级同源,不是漏实现)。
   */
  ref?: Ref<ViewInstance>
}
/** 旧名保留(本仓历史写法);对外以 RN 官方名 PressableProps 为准 */
export type RNPressableProps = PressableProps

export function Pressable(props: RNPressableProps) {
  const pressedStyle = props.style as ((state: { pressed: boolean }) => ViewStyle) | undefined
  const childrenFn = props.children as ((state: { pressed: boolean }) => ReactNode) | undefined
  const resolved =
    typeof pressedStyle === 'function' ? pressedStyle({ pressed: false }) : pressedStyle
  // 取反分支后 props.children 仍是「ReactNode | 函数」联合(TypeScript 无法把它收窄到非函数支),
  // 故显式断言成 ReactNode —— 运行时分支已保证走到这里的不是函数。
  const child =
    typeof childrenFn === 'function'
      ? childrenFn({ pressed: false })
      : (props.children as ReactNode)
  return (
    <View {...props} style={resolved}>
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

export function Image(props: RNBaseProps) {
  const source = props.source as string | number | { uri?: string } | undefined
  const uri =
    typeof source === 'string' ? source : typeof source === 'number' ? String(source) : source?.uri
  const resizeMode = (props.resizeMode as string) ?? 'cover'
  const onLoad = props.onLoad as ((e: NativeSyntheticEvent<ImageLoadEventData>) => void) | undefined
  const onError = props.onError as
    ((e: NativeSyntheticEvent<{ error: string }>) => void) | undefined
  /**
   * RN 的 `onLoad` 载荷在 `nativeEvent.source`,weapp 的 `bindload` 给的是 `e.detail.{width,height}`
   * ⇒ 由这一层造出 RN 形状。此前本层**根本没转发** onLoad/onError:共享屏那两屏
   * (BusinessLicenseScreen / ModelRecordScreen)按 `e.nativeEvent.source` 算图片宽高比,在小程序端
   * 永远拿不到尺寸(类型补齐了也不等于接上了)。取不到就落 0,屏侧有 `width > 0` 兜 ⇒ 最坏退回原形态。
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
              const width = detail?.width ?? 0
              const height = detail?.height ?? 0
              onLoad({
                ...(event as object),
                nativeEvent: { source: { width, height, uri: uri ?? '' }, width, height, uri },
              } as unknown as NativeSyntheticEvent<ImageLoadEventData>)
            }
          : undefined
      }
      onError={
        onError
          ? (event) => {
              const detail = (event as unknown as { detail?: { errMsg?: string } }).detail
              onError({
                ...(event as object),
                nativeEvent: { error: detail?.errMsg ?? 'image load failed' },
              } as unknown as NativeSyntheticEvent<{ error: string }>)
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
  handler: ScrollEventHandler | undefined,
  ms: number,
): ScrollEventHandler | undefined {
  if (!handler) return undefined
  const gate = Number.isFinite(ms) && ms >= 0 ? ms : 16
  return (event) => {
    const now = Date.now()
    const prev = lastScrollAt.get(handler)
    if (prev !== undefined && now - prev < gate) return
    lastScrollAt.set(handler, now)
    handler(event)
  }
}

export function ScrollView(props: RNBaseProps) {
  const horizontal = props.horizontal === true
  const base: ViewStyle = horizontal ? { flexDirection: 'row' } : {}
  const throttleMs = typeof props.scrollEventThrottle === 'number' ? props.scrollEventThrottle : 16
  return (
    <TaroScrollView
      scrollX={horizontal}
      scrollY={!horizontal}
      enhanced
      showScrollbar={false}
      className={typeof props.className === 'string' ? props.className : undefined}
      style={toTaroStyle(merged(props.style, { ...VIEW_BASE, ...base }))}
      // RN 的 scrollEventThrottle 在小程序没有原生对应档(旧写法把它当 Taro prop 直传,组件不认 ⇒ TS2769)
      // ⇒ 由这一层按同样的节奏收口:两次回调之间至少隔 throttleMs,超出窗口的直接吞掉
      onScroll={throttledScroll(props.onScroll as ScrollEventHandler, throttleMs)}
      lowerThreshold={props.onEndThreshold as number | undefined}
      onScrollToLower={props.onEndReached as ScrollToLowerEventHandler}
    >
      {props.refreshControl as ReactNode}
      <View style={props.contentContainerStyle as ViewStyle}>{props.children}</View>
    </TaroScrollView>
  )
}

/** 下拉刷新:RN 把它做成 ScrollView 的子元素;小程序的下拉手势属页面级,由页面壳承接 */
export function RefreshControl(props: RNBaseProps) {
  if (props.refreshing !== true) return null
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>{props.children as ReactNode}</View>
  )
}

/**
 * FlatList 必须**泛型化**:共享层写 `<FlatList<CouponItem> …>`(显式类型实参),
 * 非泛型签名会当场 TS2558;而 `data` 不定型时 renderItem/keyExtractor 的形参又退回隐式 any(TS7006/TS7031)。
 * 末位 `[key: string]: unknown` 是兜底:列表族还有十余个 RN 专有键(onEndReached 等)由 ScrollView 承接。
 *
 * 名字**不能**叫 FlatListProps:react-native-css-interop 与 expo 的 types 都往 `react-native` 模块
 * (本 app 下即 ./index.ts)里 `declare module` 了一枚 `FlatListProps<ItemT>`,会与本文件同名声明
 * 按"同一模块的两份接口"合并 ⇒ TS2428(类型参数不一致)+ TS2314(被要求 2 个类型实参)。
 * 换成 RNFlatListProps 只是避让增强命名空间,语义与 RN 的 FlatListProps<T> 一致。
 */
export interface RNFlatListProps<T> {
  data?: readonly T[]
  renderItem?: (info: { item: T; index: number }) => ReactNode
  keyExtractor?: (item: T, index: number) => string
  numColumns?: number
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: ReactNode
  ListHeaderComponent?: ReactNode
  ListFooterComponent?: ReactNode
  ListEmptyComponent?: ReactNode
  ItemSeparatorComponent?: () => ReactNode
  [key: string]: unknown
}
export function FlatList<T = unknown>(props: RNFlatListProps<T>) {
  const data = props.data ?? []
  const renderItem = props.renderItem
  const keyExtractor = props.keyExtractor
  const numColumns = props.numColumns ?? 1
  const Header = props.ListHeaderComponent as ReactNode
  const Footer = props.ListFooterComponent as ReactNode
  const Empty = props.ListEmptyComponent as ReactNode
  const Separator = props.ItemSeparatorComponent
  const rows: T[][] = []
  if (numColumns > 1) {
    for (let i = 0; i < data.length; i += numColumns) rows.push(data.slice(i, i + numColumns))
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

export function TextInput(props: RNBaseProps) {
  const multiline = props.multiline === true
  const keyboardType = (props.keyboardType as string) ?? 'default'
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
    className: typeof props.className === 'string' ? props.className : undefined,
    style: toTaroStyle(merged(props.style, VIEW_BASE)),
  }
  if (multiline) {
    return (
      <Textarea
        {...common}
        onInput={(e) =>
          (props.onChangeText as ((t: string) => void) | undefined)?.(String(e.detail?.value ?? ''))
        }
      />
    )
  }
  return (
    <Input
      {...common}
      type={typeMap[keyTypeOf(keyboardType)]}
      password={props.secureTextEntry === true}
      onInput={(e) =>
        (props.onChangeText as ((t: string) => void) | undefined)?.(String(e.detail?.value ?? ''))
      }
    />
  )
}

function keyTypeOf(keyboardType: string): string {
  return keyboardType === 'default' ? 'text' : keyboardType
}

export function Switch(props: RNBaseProps) {
  return (
    <TaroSwitch
      checked={props.value === true}
      color={props.trackColor as string | undefined}
      onChange={(e) =>
        (props.onValueChange as ((v: boolean) => void) | undefined)?.(Boolean(e.detail?.value))
      }
    />
  )
}

export function ActivityIndicator(props: RNBaseProps) {
  const size = props.size as number | 'small' | 'large' | undefined
  const px = size === 'large' ? 36 : size === 'small' ? 16 : typeof size === 'number' ? size : 20
  const color = (props.color as string) ?? 'var(--color-muted-foreground)'
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

export function Modal(props: RNBaseProps) {
  if (props.visible !== true) return null
  const transparent = props.transparent === true
  const onBack = props.onRequestClose as (() => void) | undefined
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
          onClick={onBack}
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
export function SectionList(props: RNBaseProps) {
  const sections =
    (props.sections as Array<{ key?: string; data?: unknown[]; renderItem?: unknown }>) ?? []
  const renderSection = props.renderSectionItem as
    ((info: { section: unknown; index: number }) => ReactNode) | undefined
  const ItemSeparator = props.ItemSeparatorComponent as (() => ReactNode) | undefined
  return (
    <ScrollView {...props}>
      {props.ListHeaderComponent as ReactNode}
      {sections.map((section, index) => (
        <View key={section.key ?? String(index)}>
          {renderSection?.({ section, index })}
          {((section.data as unknown[]) ?? []).map((item, i) => (
            <View key={i}>
              {i > 0 ? ItemSeparator?.() : null}
              {(
                section as { renderItem?: (info: { item: unknown; index: number }) => ReactNode }
              ).renderItem?.({
                item,
                index: i,
              }) ?? null}
            </View>
          ))}
        </View>
      ))}
      {props.ListFooterComponent as ReactNode}
    </ScrollView>
  )
}

/** 背景图容器:RN 的 ImageBackground = Image 打底 + 内容浮在上层(absolute 铺满) */
export function ImageBackground(props: RNBaseProps) {
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
 * RN 手势Responder 族:小程序的事件模型是 tap/longpress,没有 MoveResponder。
 * 这里给"能编译、能点"的最小实现 —— 拖动/滑动类交互在小程序端需按端能力另写,
 * 本层不假装有(降级在此点名,与 Animated 的"落终值"同一处置纪律)。
 */
export interface PanResponderConfig {
  onStartShouldSetPanResponder?: (e: GestureResponderEvent, g: GestureState) => boolean
  onStartShouldSetPanResponderCapture?: (e: GestureResponderEvent, g: GestureState) => boolean
  onMoveShouldSetPanResponder?: (e: GestureResponderEvent, g: GestureState) => boolean
  onMoveShouldSetPanResponderCapture?: (e: GestureResponderEvent, g: GestureState) => boolean
  onPanResponderGrant?: (e: GestureResponderEvent, g: GestureState) => void
  onPanResponderMove?: (e: GestureResponderEvent, g: GestureState) => void
  onPanResponderRelease?: (e: GestureResponderEvent, g: GestureState) => void
  onPanResponderTerminate?: (e: GestureResponderEvent, g: GestureState) => void
}
export const PanResponder = {
  create: (config: PanResponderConfig) => {
    // 运行时口径不变:仍只读下面这几枚**旧键**(View 的 responder 原始名,不是 PanResponder 的配置名)。
    // 类型面按 RN 0.86 的 `create(config)` 收口 ⇒ 旧键不在该面上,这里单点断言把它取出来,
    // 取值行为一行未动(改成读 onStartShouldSetPanResponder 会真的改变手势放行条件)。
    const legacy = config as PanResponderConfig & {
      onStartShouldSetResponder?: () => boolean
      onResponderGrant?: (e: GestureResponderEvent) => void
      onResponderMove?: (e: GestureResponderEvent) => void
      onResponderRelease?: (e: GestureResponderEvent) => void
    }
    const onStart = legacy.onStartShouldSetResponder
    return {
      get panHandlers() {
        return {
          onStartShouldSetResponder: onStart ? () => true : undefined,
          onResponderGrant: legacy.onResponderGrant ?? undefined,
          onResponderMove: legacy.onResponderMove ?? undefined,
          onResponderRelease: legacy.onResponderRelease ?? undefined,
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
