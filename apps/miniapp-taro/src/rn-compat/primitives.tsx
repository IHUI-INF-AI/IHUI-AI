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
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
} from 'react'
import type { ComponentProps, ComponentType, ReactElement, ReactNode, Ref } from 'react'
import {
  Image as TaroImage,
  Input,
  RootPortal,
  ScrollView as TaroScrollView,
  Switch as TaroSwitch,
  Text as TaroText,
  Textarea,
  View as TaroView,
} from '@tarojs/components'
import Taro from '@tarojs/taro'

import { flattenStyle, toTaroStyle, type StyleProp, type TextStyle, type ViewStyle } from './style'
import {
  resolveLowerThresholdPx,
  resolveRefreshControl,
  resolveScrollViewBox,
  resolveTextLineClamp,
} from './props-resolution'
import { createPressHandlers } from './press-handlers'
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
  ListRenderItemInfo,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
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
  /**
   * 触点族(2026-11-14 补派发)。它与上面三格是**同一个物理动作的两套名字**:
   *   - `onTouchStart/Move/End/Cancel` 是 Taro 小程序真有的原生事件;
   *   - `onPressIn/onPressOut`        是 RN 的按压生命周期。
   *
   * 旧状态:两组都声明了,却一列都没派发(compat View 只接 onClick/onLongPress)。
   * 后果不是"少个按压态",是三件真事同时断:
   *   ① ui-native 的 Tappable(全仓 361 个调用点)靠 onPressIn/onPressOut 改内部 pressed
   *      ⇒ 小程序端 pressed 恒 false,**整端按压反馈为 0**;
   *   ② 共享层"按住说话"(ChatVoiceTurn / ChatComposer / SearchInput)靠同一对事件起停录音
   *      ⇒ 小程序端按下去不开始、松手不结束;
   *   ③ 函数形态 `style` / `children` 只能按 `{pressed:false}` 求值一次。
   * 现在由 Pressable 用 `createPressHandlers` 把 touch 翻译成 pressIn/pressOut(语义差异见该文件头注)。
   */
  onTouchStart?: (e: GestureResponderEvent) => void
  onTouchMove?: (e: GestureResponderEvent) => void
  onTouchEnd?: (e: GestureResponderEvent) => void
  onTouchCancel?: (e: GestureResponderEvent) => void
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

/**
 * TextInput 专用面:RN 的原生输入键单列一层,不并进 RNCompatProps。
 * 共享层 `Omit<ComponentPropsWithRef<typeof TextInput>, …>`(TextField.tsx:36)会把这些具名键
 * 原样带到 60+ 个调用点;放进通用面则 View/Switch 等也跟着多出输入专有键,面不再诚实。
 */
export interface RNTextInputProps extends RNCompatProps {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center'
  returnKeyType?:
    | 'default'
    | 'done'
    | 'emergency-call'
    | 'go'
    | 'google'
    | 'join'
    | 'next'
    | 'previous'
    | 'route'
    | 'search'
    | 'send'
    | 'yahoo'
  textContentType?: string
  underlineColorAndroid?: string
  clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always'
  onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void
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

/**
 * 合并 RN 基线与调用方样式,并按 className 让位。
 *
 * RN 侧 className(NativeWind) 与 style 是同一优先级按源码顺序合并;小程序侧 className
 * 走 wxss、style 走内联,**内联恒赢**。若把 VIEW_BASE 的 flexDirection:'column' /
 * alignItems:'stretch' / padding:0 / margin:0 原样序列化成内联,调用方的
 * `flex-row` / `items-center` / `px-3 py-2` 会被无声覆盖(横排变竖排、间距归零)。
 * 因此对 className 已声明的同类属性摘掉基线里对应键,让 wxss 生效;调用方 style
 * 显式给的同名键仍然赢(与 RN 的 style 优先级一致)。
 */
const CLASS_OVERRIDE_RULES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/(?:^|\s)flex-(?:row|col)(?:-reverse)?(?:\s|$)/, ['flexDirection']],
  [/(?:^|\s)items-/, ['alignItems']],
  [/(?:^|\s)justify-/, ['justifyContent']],
  [/(?:^|\s)(?:p|px|py|pt|pr|pb|pl)-/, ['padding']],
  [/(?:^|\s)(?:m|mx|my|mt|mr|mb|ml)-/, ['margin']],
]

function merged(style: unknown, base: ViewStyle, className?: string): ViewStyle {
  const flat = flattenStyle(style)
  if (!className) return { ...base, ...flat }
  const skipped = new Set<string>()
  for (const [rule, keys] of CLASS_OVERRIDE_RULES) {
    if (rule.test(className)) {
      for (const k of keys) skipped.add(k)
    }
  }
  if (skipped.size === 0) return { ...base, ...flat }
  const effectiveBase: ViewStyle = {}
  for (const [k, v] of Object.entries(base)) {
    if (!skipped.has(k)) effectiveBase[k] = v
  }
  return { ...effectiveBase, ...flat }
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
/**
 * onLayout 下发(2026-11-06)。
 *
 * 旧状态:RNCompatProps 声明了 `onLayout`,但 View 从不调用它,声明等于没有;
 * 小程序也没有 View 级 onLayout 事件。Taro 侧唯一等价能力是
 * `Taro.createSelectorQuery().select('#id').boundingClientRect()`(Taro 的 WXML 节点查询),
 * 因此这里给节点补稳定 id,挂载后一帧取矩形并合成为 RN 形状的 `{nativeEvent:{layout}}`。
 *
 * 语义等价边界(必须明写,不能假装全等):
 *  - width/height 与 RN 同义(节点盒子尺寸);
 *  - x/y 取 boundingClientRect 的 left/top,是**可视区坐标**;RN 的 x/y 是**相对父节点**。
 *    Taro 没有"查父节点矩形"的原语,无法无创换算 ⇒ 本层只保证 width/height 全等,
 *    x/y 仅在节点位于页面原点/父节点无偏移时数值一致。共享层现读唯一消费点
 *    (BannerCarousel.tsx:onLayout)只用 width,不受这条差异影响。
 *  - 触发时机:挂载后一帧 + 样式串变化 + 页面尺寸变化(由调用方 effect 依赖驱动),
 *    不是 RN 那种原生布局观察器;纯父容器动画引起的变化不会自动重放。
 *
 * 取不到 SelectorQuery/节点(非端内环境、父级在原生自定义组件内)时**静默跳过**,
 * 不派发 0 尺寸假事件 —— 宁可未判定,也不让共享屏按错误宽度布局。
 */
type SelectorRect = { left?: number; top?: number; width?: number; height?: number } | null
let layoutProbeSeq = 0
let scrollProbeSeq = 0

function useLayoutBridge(p: RNBaseProps, needsId = false): string | undefined {
  const onLayout =
    typeof p.onLayout === 'function'
      ? (p.onLayout as (event: LayoutChangeEvent) => void)
      : undefined
  const autoId = useRef<string | null>(null)
  if ((onLayout || needsId) && typeof p.id !== 'string' && autoId.current === null) {
    autoId.current = `rn-layout-${++layoutProbeSeq}`
  }
  const probeId = typeof p.id === 'string' ? p.id : (autoId.current ?? undefined)
  const cbRef = useRef(onLayout)
  cbRef.current = onLayout
  // 样式串作依赖:共享屏换宽度(如 carousel 尺寸)时重新量一次;父子层内部变化不追。
  const styleKey = JSON.stringify(flattenStyle(p.style))
  useEffect(() => {
    const cb = cbRef.current
    if (!cb || !probeId) return
    if (typeof Taro.createSelectorQuery !== 'function') return
    const query = Taro.createSelectorQuery()
    let cancelled = false
    const measure = () => {
      query
        .select(`#${probeId}`)
        .boundingClientRect((raw: unknown) => {
          const rect = raw as SelectorRect
          if (cancelled || !rect) return
          if (typeof rect.width !== 'number' || typeof rect.height !== 'number') return
          cb({
            nativeEvent: {
              layout: {
                x: typeof rect.left === 'number' ? rect.left : 0,
                y: typeof rect.top === 'number' ? rect.top : 0,
                width: rect.width,
                height: rect.height,
              },
            },
          })
        })
        .exec()
    }
    if (typeof Taro.nextTick === 'function') Taro.nextTick(measure)
    else setTimeout(measure, 0)
    return () => {
      cancelled = true
    }
  }, [probeId, styleKey])
  return probeId
}

/**
 * 测量句柄(2026-11-14)。
 *
 * 此前 `ViewInstance.measureInWindow` **只在类型上下存在、运行时没有实现**,而且 View 不是
 * forwardRef ⇒ `useRef<View>(null)` 在小程序端恒为 null。共享屏
 * `components/category/CategoryDropdown.tsx:118` 正是靠
 * `triggerRef.current?.measureInWindow((x, y, w, h) => …)` 取锚点算下拉面板位置,
 * 于是小程序端下拉的定位信息**永远拿不到**(面板贴错位置或走兜底)。
 *
 * 实现走 weapp 的 createSelectorQuery:给节点一个稳定 id(与 onLayout 探针同一个 id 位),
 * 量出 boundingClientRect 后再回调。`setNativeProps` 在小程序无等价物 ⇒ 空实现并如实注释,
 * 不假装生效。rect 取不到时**不回调**(与 onLayout 同一纪律:不派发 0 尺寸假数据)。
 */
function useMeasureHandle(ref: ForwardedRef<ViewInstance>, measureId: string | undefined) {
  useImperativeHandle(
    ref,
    () => ({
      measureInWindow: (cb) => measureRect(measureId, (r) => cb(r.left, r.top, r.width, r.height)),
      // RN 的 measure 给 (x, y) = **相对父节点**、(pageX, pageY) = **页面坐标**。
      // weapp 的选择器只能给出**可视区坐标**(boundingClientRect.left/top),没有父相对 API
      // ⇒ x/y 如实退化为可视区坐标(见 PLATFORM-LIMITS §6),但 pageX/pageY 必须真算:
      // 拿视口 scrollOffset 补偿,不能把 left/top 直接冒充页面坐标(滚动后那是错的)。
      measure: (cb) =>
        measureRect(measureId, (r) =>
          measurePageOffset((offset) =>
            cb(r.left, r.top, r.width, r.height, r.left + offset.x, r.top + offset.y),
          ),
        ),
      // 小程序没有 setNativeProps 通道(样式只能走 state/props 重渲染),保留签名占位不装假映射
      setNativeProps: () => undefined,
    }),
    [measureId],
  )
}

/** 视口滚动量:把可视区坐标换算成页面坐标(pageX/pageY)用。取不到就按 0 算并如实退化为可视区。 */
function measurePageOffset(cb: (offset: { x: number; y: number }) => void): void {
  const query = Taro.createSelectorQuery()
  if (typeof query.selectViewport !== 'function') {
    cb({ x: 0, y: 0 })
    return
  }
  query
    .selectViewport()
    .scrollOffset((raw: unknown) => {
      const offset = raw as { scrollLeft?: number; scrollTop?: number } | null
      cb({
        x: typeof offset?.scrollLeft === 'number' ? offset.scrollLeft : 0,
        y: typeof offset?.scrollTop === 'number' ? offset.scrollTop : 0,
      })
    })
    .exec()
}

function measureRect(
  measureId: string | undefined,
  cb: (r: { left: number; top: number; width: number; height: number }) => void,
): void {
  if (!measureId || typeof Taro.createSelectorQuery !== 'function') return
  Taro.createSelectorQuery()
    .select(`#${measureId}`)
    .boundingClientRect((raw: unknown) => {
      const rect = raw as SelectorRect
      if (!rect) return
      if (typeof rect.width !== 'number' || typeof rect.height !== 'number') return
      cb({
        left: typeof rect.left === 'number' ? rect.left : 0,
        top: typeof rect.top === 'number' ? rect.top : 0,
        width: rect.width,
        height: rect.height,
      })
    })
    .exec()
}

function ViewInner(props: RNCompatProps, ref: ForwardedRef<ViewInstance>) {
  // 实现体按**兜底面**读(id 等各屏自定义键不在闭合面上)。RNCompatProps 是 interface,
  // 结构上不满足 `{[k:string]: unknown}` 的索引签名要求(TS 只给匿名对象类型隐式索引),
  // 所以这一支只能取闭合面 + 断言;运行时形状同一个对象,零改动。
  const p = props as RNBaseProps
  const onClick = clickHandler(p)
  // 挂了 ref 才需要 id:没 ref 的 View 不必为测量多生成一个选择器(节点 id 是全局开销)
  const probeId = useLayoutBridge(p, ref !== null && ref !== undefined)
  useMeasureHandle(ref, probeId)
  return (
    <TaroView
      className={typeof p.className === 'string' ? p.className : undefined}
      style={toTaroStyle(
        merged(p.style, VIEW_BASE, typeof p.className === 'string' ? p.className : undefined),
      )}
      id={probeId}
      onClick={onClick}
      onLongPress={p.onLongPress as EventHandler}
      onTouchStart={p.onTouchStart as TaroViewProps['onTouchStart']}
      onTouchMove={p.onTouchMove as TaroViewProps['onTouchMove']}
      onTouchEnd={p.onTouchEnd as TaroViewProps['onTouchEnd']}
      onTouchCancel={p.onTouchCancel as TaroViewProps['onTouchCancel']}
    >
      {p.children}
    </TaroView>
  )
}

/**
 * forwardRef 是**行为修复**而不是类型糖(与 ScrollView/FlatList/TextInput 同一条理由):
 * 共享层写 `<View ref={r}>` 再 `r.current.measureInWindow(cb)`,普通函数组件在小程序端 ref 恒 null,
 * 整条测量链静默失效(CategoryDropdown 的下拉定位就是这样拿不到锚点的)。
 */
export const View = forwardRef(ViewInner) as unknown as {
  (props: RNBaseProps & { ref?: Ref<ViewInstance> }): ReactElement
  (props: RNCompatProps & { ref?: Ref<ViewInstance> }): ReactElement
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
  // numberOfLines 是 RN 的 prop,不是样式键;旧实现只在 ===1 时补 nowrap,≥2 整条丢失。
  // resolveTextLineClamp 把 prop 归一成样式源(≥2 交给 style.ts clampFrom 生成 -webkit-line-clamp),
  // 单行维持原有 nowrap 排版,不改变既有单行视觉。
  const lineClamp = resolveTextLineClamp(numberOfLines)
  return (
    <TaroText
      className={typeof props.className === 'string' ? props.className : undefined}
      style={toTaroStyle({ ...flattenStyle(props.style), ...lineClamp })}
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
  const { style, children, onPressIn, onPressOut, ...rest } = props
  const styleFn = typeof style === 'function' ? style : undefined
  const childrenFn = typeof children === 'function' ? children : undefined
  /**
   * 按压态由这一层持有(2026-11-14)。旧实现把函数形态按 `{pressed:false}` 求值一次就定死,
   * 于是 Tappable 的 pressed 永远是 false、"按住说话"收不到起停 —— 详见 RNCompatProps.onTouchStart 注释。
   * `down` 必须放 ref:setPressed 会触发重渲染、闭包会重建,闭包变量存不住"按下中"。
   */
  const [pressed, setPressed] = useState(false)
  const down = useRef(false)
  /**
   * 只有真需要按压态时才绑触点:函数形态 style/children,或调用方传了 onPressIn/onPressOut。
   * 两者都没有时一个事件也不挂 —— 不给 weapp 每个可点节点白加 bindtouchstart/end。
   */
  const needPressState = Boolean(styleFn || childrenFn || onPressIn || onPressOut)
  const handlers = createPressHandlers({
    down,
    disabled: props.disabled === true,
    onPressIn,
    onPressOut,
    setPressed,
  })
  const resolved = styleFn ? styleFn({ pressed }) : style
  // 取反分支后 props.children 仍是「ReactNode | 函数」联合(TypeScript 无法把它收窄到非函数支),
  // 故显式断言成 ReactNode —— 运行时分支已保证走到这里的不是函数。
  const child = childrenFn ? childrenFn({ pressed }) : (children as ReactNode)
  return (
    <View
      {...rest}
      style={resolved}
      onTouchStart={needPressState ? handlers.onTouchStart : undefined}
      onTouchEnd={needPressState ? handlers.onTouchEnd : undefined}
      onTouchCancel={needPressState ? handlers.onTouchCancel : undefined}
    >
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
  return (
    <TaroImage
      src={uri ?? ''}
      mode={RESIZE_MODE_TO_TARO[resizeMode] ?? 'aspectFill'}
      style={toTaroStyle(
        merged(
          props.style,
          VIEW_BASE,
          typeof props.className === 'string' ? props.className : undefined,
        ),
      )}
      className={typeof props.className === 'string' ? props.className : undefined}
      onClick={clickHandler(props)}
      /**
       * onLoad 桥(2026-11-01):Taro 给 detail.{width,height},RN 消费面读
       * nativeEvent.source.{width,height,uri} —— 旧写法声明了 onLoad 却从不派发,
       * BusinessLicense/ModelRecord 两屏的"图片加载完再量尺寸"静默失效。
       */
      onLoad={(e) => {
        const d = (e as { detail?: { width?: number; height?: number } }).detail
        const w = d?.width ?? 0
        const h = d?.height ?? 0
        ;(props.onLoad as ((ev: NativeSyntheticEvent<ImageLoadEventData>) => void) | undefined)?.({
          nativeEvent: { source: { width: w, height: h, uri: uri ?? '' }, width: w, height: h },
        })
      }}
    />
  )
}

/**
 * 按 handler 引用记"上一次放行的时刻"(小程序无原生滚动节流档 ⇒ 这一层自己收口)。
 * 用 WeakMap:页面卸载后不留下任何引用，不会把已销毁的回调钉在内存里。
 */
const lastScrollAt = new WeakMap<object, number>()

/**
 * 把 Taro 的滚动事件补成 RN 形状(2026-11-14)。
 *
 * 为什么必须补:共享屏是按 RN 契约写的 —— `packages/app/src/features/article-list/ArticleListScreen.tsx:102`
 * 与 `square/SquareScreen.tsx:83` 都用 `e.nativeEvent.contentOffset.y > 200` 决定「回到顶部」按钮是否出现,
 * `_shared/BannerCarousel.tsx:67` 用 `e.nativeEvent.contentOffset.x / slideWidth` 算圆点索引。
 * 而 TaroScrollView 的事件载荷只有 `detail.scrollTop/scrollLeft`,**没有 `nativeEvent`** ⇒
 * 读取当场 TypeError(或按钮恒不出现)。类型抓不到:共享层把事件形参声明成 `any` 传下来的。
 *
 * 保留原始 `detail` 不删:`chat/ChatMessageList.tsx` 的 `readScrollEventTop` 是「双形状归一」,
 * 原生形状与小程序形状两种读法都必须继续成立,替换成只认一种会让小程序侧反过来读不到。
 */
function toRnScrollEvent(event: unknown): unknown {
  if (!event || typeof event !== 'object') return event
  const e = event as { nativeEvent?: unknown; detail?: Record<string, unknown> }
  if (e.nativeEvent) return event // 已是 RN 形状(自定义事件/测试夹具),不重复包装
  const d = e.detail ?? {}
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
  return {
    ...e,
    nativeEvent: {
      contentOffset: { x: num(d.scrollLeft), y: num(d.scrollTop) },
      contentSize: { width: num(d.scrollWidth), height: num(d.scrollHeight) },
      // 小程序不给视口尺寸。这里填 0 而不是编造一个值:消费面若据此算"距底部"会得到保守结果,
      // 但凭空写个数会让判据看起来成立、结论却是错的(与本仓「不把没量到渲染成 0 事实」同纪律)。
      layoutMeasurement: { width: 0, height: 0 },
      zoomScale: 1,
    },
  }
}

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

/**
 * 命令式滚动句柄(2026-11-05):RN 的 ScrollView 有实例方法,小程序没有 ⇒ 由这一层
 * 翻译成 scrollTop / scrollLeft / scrollWithAnimation 的状态更新再下传 TaroScrollView。
 * `getScrollResponder` 返回自身,承接 RN 里 `getScrollResponder().scrollTo(...)` 的写法。
 */
export interface ScrollViewHandle {
  scrollTo: (params: { x?: number; y?: number; animated?: boolean }) => void
  scrollToEnd: (params?: { animated?: boolean }) => void
  getScrollResponder: () => ScrollViewHandle
}

/**
 * 类型位:共享屏写 `useRef<ScrollView>(null)`(BannerCarousel.tsx:53)。值面已换成 compat 组件,
 * 没有同名类型时小程序侧把它当值实例化 ⇒ TS2749。补齐后读的是本层的命令式句柄形状。
 */
export type ScrollView = ScrollViewHandle

function ScrollViewInner(props: RNBaseProps, ref: ForwardedRef<ScrollViewHandle>) {
  const horizontal = props.horizontal === true
  const base: ViewStyle = horizontal ? { flexDirection: 'row' } : {}
  const throttleMs = typeof props.scrollEventThrottle === 'number' ? props.scrollEventThrottle : 16
  /**
   * onMomentumScrollEnd 承接(2026-11-14)。
   *
   * TaroScrollView 没有"惯性滚动结束"这个事件(只有 onScroll/onScrollToUpper/onScrollToLower),
   * 而共享层的轮播靠它同步圆点:`_shared/BannerCarousel.tsx:67` 在 onMomentumScrollEnd 里算索引
   * ⇒ 此前该回调**从未被调用**,用户滑到第 2 张,圆点还停在 1(只有自动播时才跟着走)。
   *
   * 近似方案:每次 onScroll 重置一个 120ms 定时器,静止 120ms 视为"滚动停止",用最后一次的
   * 偏移合成 RN 形状事件派发。为什么不更精确:weapp 没有 `decelerationRate` 可读,也没有
   * 滚动状态机;120ms 是"两次 onScroll 之间明显无新事件"的经验阈值,对翻页/停下都够用。
   */
  const momentumHandler = props.onMomentumScrollEnd as ((e: unknown) => void) | undefined
  const momentumTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScrollEvent = useRef<unknown>(null)
  useEffect(
    () => () => {
      if (momentumTimer.current) clearTimeout(momentumTimer.current)
    },
    [],
  )
  const userScroll = throttledScroll(props.onScroll as ScrollEventHandler, throttleMs)
  const onScrollInternal: NonNullable<ScrollEventHandler> | undefined =
    userScroll || momentumHandler
      ? (event) => {
          const rnEvent = toRnScrollEvent(event)
          lastScrollEvent.current = rnEvent
          userScroll?.(rnEvent as never)
          if (momentumHandler) {
            if (momentumTimer.current) clearTimeout(momentumTimer.current)
            momentumTimer.current = setTimeout(() => momentumHandler(lastScrollEvent.current), 120)
          }
        }
      : undefined
  const [imperative, setImperative] = useState<{
    top?: number
    left?: number
    animated?: boolean
  }>({})
  /**
   * 高度边界(2026-11-06):Taro scroll-view 必须有确定高度才会滚(官方 ScrollView.d.ts 明示)。
   * 共享层习惯写 `style={{flex:1}}`,在 RN 由父 flex 算高度,在 Taro 不成立 ——
   * 统一在原语层外包 flex:1 容器 + 内层 100%,不逐页打补丁。见 props-resolution.ts 的长注释。
   */
  const viewportBox = resolveScrollViewBox(flattenStyle(props.style), horizontal)
  /**
   * onEndReachedThreshold(2026-11-06):RN 的 threshold 是**可视长度倍数**,Taro 的 lowerThreshold
   * 是**px**。旧实现把同名旧键 onEndThreshold 直传、完全忽略 RN 键 ⇒ 共享屏传 0.5 等于没传。
   * 视口长度优先量 ScrollView 自身轴向尺寸(嵌套半屏列表才不会被整屏高度放大触发距离),
   * SelectorQuery 不可用时退回系统窗口尺寸,两者都取不到则保留 Taro 默认(不伪造 0)。
   */
  const threshold =
    typeof props.onEndReachedThreshold === 'number' ? props.onEndReachedThreshold : undefined
  const [measuredViewport, setMeasuredViewport] = useState<number | undefined>(undefined)
  const measureIdRef = useRef<string | null>(null)
  if (threshold !== undefined && measureIdRef.current === null) {
    measureIdRef.current = `rn-scroll-${++scrollProbeSeq}`
  }
  const measureId = typeof props.id === 'string' ? props.id : (measureIdRef.current ?? undefined)
  const [fallbackViewport] = useState<number | undefined>(() => {
    try {
      const info = Taro.getSystemInfoSync()
      return horizontal ? info.windowWidth : info.windowHeight
    } catch {
      return undefined
    }
  })
  useEffect(() => {
    if (threshold === undefined || !measureId) return
    if (typeof Taro.createSelectorQuery !== 'function') return
    const query = Taro.createSelectorQuery()
    let cancelled = false
    const measure = () => {
      query
        .select(`#${measureId}`)
        .boundingClientRect((raw: unknown) => {
          const rect = raw as SelectorRect
          if (cancelled || !rect) return
          const length = horizontal ? rect.width : rect.height
          if (typeof length === 'number' && length > 0) setMeasuredViewport(length)
        })
        .exec()
    }
    if (typeof Taro.nextTick === 'function') Taro.nextTick(measure)
    else setTimeout(measure, 0)
    return () => {
      cancelled = true
    }
  }, [measureId, horizontal, threshold])
  const lowerThreshold =
    resolveLowerThresholdPx(threshold, measuredViewport ?? fallbackViewport ?? 0) ??
    (typeof props.onEndThreshold === 'number' ? props.onEndThreshold : undefined)
  useImperativeHandle(ref, () => {
    const handle: ScrollViewHandle = {
      scrollTo: ({ x, y, animated }) => {
        setImperative((prev) => ({
          top: typeof y === 'number' ? y : prev.top,
          left: typeof x === 'number' ? x : prev.left,
          animated: animated !== false,
        }))
      },
      // RN 的 scrollToEnd 也是"滚到底",这里用足够大的增量走同一路径,不另造定位逻辑
      scrollToEnd: (params) => {
        setImperative((prev) => ({
          top: (prev.top ?? 0) + 1_000_000,
          left: prev.left,
          animated: params?.animated !== false,
        }))
      },
      getScrollResponder: () => handle,
    }
    return handle
  }, [])
  /**
   * 显式 prop 优先:FlatList 自己维护 scrollTop 并以 prop 下传,不能被命令式状态盖掉;
   * 只有直接给 ScrollView 挂 ref 调方法时才走 imperative。
   */
  const scrollTop = typeof props.scrollTop === 'number' ? props.scrollTop : imperative.top
  const scrollLeft = typeof props.scrollLeft === 'number' ? props.scrollLeft : imperative.left
  const scrollWithAnimation =
    typeof props.scrollWithAnimation === 'boolean'
      ? props.scrollWithAnimation
      : imperative.animated === true
  /**
   * 下拉刷新承接(2026-11-01):RN 的 refreshControl 是"挂 <RefreshControl> 子元素的声明位",
   * 手势由 ScrollView 承接;小程序等价物是 refresher 三件套 ⇒ 从元素里解出 refreshing/onRefresh
   * 接上(resolveRefreshControl 纯函数,行为钉在 props-resolution.test.ts)。
   * 此前三参全被丢弃 ⇒ 共享层 113 处下拉刷新在小程序端整条静默(§0.9 装好了没覆盖=没有)。
   */
  const rc = resolveRefreshControl(props.refreshControl)
  // RN 的 showsHorizontal/VerticalScrollIndicator 缺省 true;只有消费面显式给 false 才关滚动条
  // (旧写法硬编码 showScrollbar={false},与 RN 缺省相反 ⇒ 纯视觉分叉)。
  const showScrollbar = !(
    props.showsHorizontalScrollIndicator === false || props.showsVerticalScrollIndicator === false
  )
  const scrollNode = (
    <TaroScrollView
      /**
       * scrollEnabled 承接(2026-11-14):RN 的 `scrollEnabled={false}` 在共享层是**真在用的**
       * —— `features/income/IncomeScreen.tsx:181` 把它挂在内嵌列表上,目的是让外层页面独占纵向手势。
       * weapp 没有 scrollEnabled,等价物是把对应轴的 scrollX/scrollY 关掉;此前该 prop 被整体忽略
       * ⇒ 内嵌列表继续吃手势,与外层滚动互相抢(表现为"划一下页面不跟手,偶尔只动了里面那块")。
       */
      scrollX={horizontal && props.scrollEnabled !== false}
      scrollY={!horizontal && props.scrollEnabled !== false}
      /**
       * pagingEnabled 承接(2026-11-14):RN 轮播靠它一屏一停。共享层 `_shared/BannerCarousel.tsx:80`
       * 传了 `pagingEnabled`,此前被丢弃 ⇒ 用户可以把轮播**停在第 1、2 张中间**,松手不回弹,
       * 看起来像"图片错位"。Taro 的 ScrollView 有同名属性(映射到 weapp 的 paging-enabled,
       * 需 enhanced=true —— 本节点已开)。
       */
      pagingEnabled={props.pagingEnabled === true}
      // 分页场景下 RN 的快速停手语义;共享层未直接用 decelerationRate,这里只在显式要求时才开
      fastDeceleration={props.fastDeceleration === true}
      enhanced
      // 命令式滚动承载(2026-11-05):RN 端 `FlatList.scrollToEnd` 是 ref 方法,小程序侧没有
      // 对应实例方法 ⇒ 由 FlatList 适配层改写成 scrollTop 递增 + scrollWithAnimation,经此透传。
      scrollTop={scrollTop}
      scrollLeft={scrollLeft}
      scrollWithAnimation={scrollWithAnimation}
      // SectionList 的 scrollToLocation 翻译成 Taro 的 scrollIntoView(id 定位)
      scrollIntoView={typeof props.scrollIntoView === 'string' ? props.scrollIntoView : undefined}
      showScrollbar={showScrollbar}
      refresherEnabled={rc?.enabled === true}
      refresherTriggered={rc?.refreshing === true}
      onRefresherRefresh={rc?.onRefresh ? () => rc.onRefresh?.() : undefined}
      className={typeof props.className === 'string' ? props.className : undefined}
      // viewportBox.innerStyle:flex 场景补 height/width:100%,给原生 scroll-view 一个确定基准
      style={toTaroStyle(
        merged(
          props.style,
          { ...VIEW_BASE, ...base, ...viewportBox.innerStyle },
          typeof props.className === 'string' ? props.className : undefined,
        ),
      )}
      // threshold 测量用的稳定 id(共享屏自带 id 时优先用调用方的)
      id={measureId}
      // RN 的 scrollEventThrottle 在小程序没有原生对应档(旧写法把它当 Taro prop 直传,组件不认 ⇒ TS2769)
      // ⇒ 由这一层按同样的节奏收口:两次回调之间至少隔 throttleMs,超出窗口的直接吞掉
      onScroll={onScrollInternal}
      lowerThreshold={lowerThreshold}
      onScrollToLower={props.onEndReached as ScrollToLowerEventHandler}
    >
      {props.refreshControl as ReactNode}
      <View style={props.contentContainerStyle as ViewStyle}>{props.children}</View>
    </TaroScrollView>
  )
  /**
   * wrapper 只在"声明了 flex 但没显式尺寸"时出现:外层承担 flex 布局(吃父级剩余空间),
   * 内层 100% 才有百分比基准。显式高度/宽度路径原样直出,不改变既有盒模型。
   */
  return viewportBox.wrapperStyle ? (
    <View style={viewportBox.wrapperStyle as ViewStyle}>{scrollNode}</View>
  ) : (
    scrollNode
  )
}

/**
 * `forwardRef` 是**行为修复**而不是类型糖:RN 的 <ScrollView ref={r}> 拿得到实例,
 * 旧写法是普通函数组件 ⇒ ref 恒为 null,共享层里 `getScrollResponder().scrollTo(...)`
 * 这类写法在小程序端静默失效(阴性对照见 tests/rn-compat-flatlist-ref.test.tsx)。
 */
export const ScrollView = forwardRef(ScrollViewInner) as unknown as (
  props: RNBaseProps & { ref?: Ref<ScrollViewHandle> },
) => ReactElement

/**
 * 下拉刷新:RN 把它做成 ScrollView 的子元素;小程序的下拉手势由 ScrollView 的 refresher
 * 三件套承接(见 ScrollView 内 resolveRefreshControl)。本组件按 RN 语义**渲染产物为空**
 * —— 旧写法在 refreshing 时渲染一枚静态 spinner,那会让"原生 refresher + 内容内 spinner"
 * 双份出现,且 onRefresh 永远无人调用。
 */
export function RefreshControl(_props: RNBaseProps) {
  return null
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
  /**
   * 形参含 `separators`:共享屏把 `ListRenderItem<T>`(RN 的形参形状)直接传给本键,
   * 少一格时按逆变规则不兼容 ⇒ TS2322(DistributionOrderListScreen.tsx:143)。
   */
  renderItem?: (info: ListRenderItemInfo<T>) => ReactNode
  keyExtractor?: (item: T, index: number) => string
  numColumns?: number
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: ReactNode
  // RN 允许「元素」或「渲染函数/组件类型」两形(共享屏 ChatScreen.tsx:216/219 用 `() => <>…</>` 形)。
  ListHeaderComponent?: ReactNode | (() => ReactNode)
  ListFooterComponent?: ReactNode | (() => ReactNode)
  ListEmptyComponent?: ReactNode | (() => ReactNode)
  ItemSeparatorComponent?: () => ReactNode
  [key: string]: unknown
}
export interface FlatListHandle {
  scrollToEnd: (params?: { animated?: boolean }) => void
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void
  scrollToIndex: (params: {
    index: number
    animated?: boolean
    viewOffset?: number
    viewPosition?: number
  }) => void
}

/** RN 的 separators 句柄;compat 没有高亮分隔交互,给空实现满足形参类型 */
const LIST_SEPARATORS = {
  highlight: (): void => undefined,
  unhighlight: (): void => undefined,
  updateProps: (): void => undefined,
}

/**
 * 类型位:共享屏写 `useRef<FlatList<T> | null>`(如 packages/app/src/features/chat/ChatScreen.tsx:196),
 * 该写法在 RN 端取 react-native 的 `FlatList<T>` 类型。本文件把 react-native 整体替成了 compat,
 * 因此同名值必须配一枚同名类型,否则小程序侧 tsc 把 `FlatList<T>` 当值实例化 ⇒ TS2749。
 */
export interface FlatList<T = unknown> extends FlatListHandle {
  readonly __itemType?: T
}

/** 列表槽位两形折叠:元素直用;函数按 RN 语义视为渲染函数(含共享屏的 `() => <>…</>` 形) */
function renderListSlot(slot: ReactNode | (() => ReactNode) | undefined): ReactNode {
  if (typeof slot === 'function') {
    const fn = slot as (() => ReactNode) & { prototype?: { isReactComponent?: boolean } }
    return fn.prototype?.isReactComponent ? createElement(fn as never) : fn()
  }
  return slot
}

/**
 * ref 透传(2026-11-05,薄壳化前置):
 * 共享屏(`ChatScreen.tsx:199-203`)把 FlatList 的实例 ref 交给消费端,消费端用
 * `ref.scrollToEnd({animated:true})` 做流式自动滚底(RN 端真实方法)。
 * 本 compat 早先是普通函数组件 ⇒ React 不挂 ref,`onListRef?.(ref)` 永远拿到 null,
 * 小程序壳页的自动滚底整条静默丢失。这里补 forwardRef,并把命令式方法翻译成
 * 「scrollTop 递增 + scrollWithAnimation」交给 TaroScrollView(小程序无实例方法)。
 * 阴性对照见 tests/rn-compat-flatlist-ref.test.tsx:同现场用未补 ref 的旧形制必须拿不到句柄。
 */
function FlatListInner<T = unknown>(props: RNFlatListProps<T>, ref: ForwardedRef<FlatListHandle>) {
  const propScrollTop = typeof props.scrollTop === 'number' ? props.scrollTop : undefined
  const [scrollTop, setScrollTop] = useState<number | undefined>(propScrollTop)
  const [scrollWithAnimation, setScrollWithAnimation] = useState(false)
  /**
   * 受控 scrollTop 的 prop→state 同步(2026-11-12 补,**source-of-truth 缺陷**)。
   *
   * 旧形制把 `props.scrollTop` 只当 useState 的**初值**:挂载那一刻取一次,此后父级每次改这个
   * prop 都被这一层丢掉(`scrollTop={scrollTop}` 传的是内部 state)。后果不是"滚得不准"而是
   * **整条路不存在** —— pkg-ai 聊天页 2026-11-12 把流式跟底改写成"父级递增 scrollTop"之后,
   * 父级每帧算出的新值一次也没到达 ScrollView,只有命令式句柄(`ref.scrollToEnd`)那条腿还通。
   * 与下面 ScrollView 的注释同一条纪律:显式 prop 优先,命令式状态只作兜底。
   */
  useEffect(() => {
    if (propScrollTop === undefined) return
    setScrollTop(propScrollTop)
  }, [propScrollTop])
  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: (params) => {
        setScrollWithAnimation(params?.animated !== false)
        // scroll-view 的 scrollTop 超界会被原生 clamp 到底;每次递增避免"同值不触发滚动"。
        setScrollTop((prev) => (prev ?? 0) + 1_000_000)
      },
      scrollToOffset: ({ offset, animated }) => {
        setScrollWithAnimation(animated !== false)
        setScrollTop(offset)
      },
      scrollToIndex: (params) => {
        setScrollWithAnimation(params.animated !== false)
        setScrollTop((prev) => (prev ?? 0) + 1_000_000)
      },
    }),
    [],
  )
  const data = props.data ?? []
  const renderItem = props.renderItem
  const keyExtractor = props.keyExtractor
  const numColumns = props.numColumns ?? 1
  const Header = renderListSlot(props.ListHeaderComponent)
  const Footer = renderListSlot(props.ListFooterComponent)
  const Empty = renderListSlot(props.ListEmptyComponent)
  const Separator = props.ItemSeparatorComponent
  /**
   * inverted 承接(2026-11-14):RN 的聊天列表靠 `inverted` 让"最新在底部、列表贴着输入框长"。
   * 共享层 `chat/ChatRoomScreen.tsx:226`、`letter-chat/LetterChatScreen.tsx:94` 都挂了它,
   * 此前被丢弃 ⇒ 消息少时列表**贴顶**,内容增长方向反了,进场第一眼看不到最新那条。
   * 小程序没有 inverted,等价做法是把渲染顺序倒过来;但 renderItem/keyExtractor 收到的
   * `index` 必须仍是**逻辑下标**(RN 只翻视觉,不翻 index),所以先把 (item, index) 成对记下来再倒序。
   */
  const indexed = data.map((item, index) => ({ item, index }))
  const ordered = props.inverted === true ? [...indexed].reverse() : indexed
  const rows: { item: T; index: number }[][] = []
  if (numColumns > 1) {
    for (let i = 0; i < ordered.length; i += numColumns) rows.push(ordered.slice(i, i + numColumns))
  }
  const cell = (entry: { item: T; index: number }) => (
    <View
      key={keyExtractor ? keyExtractor(entry.item, entry.index) : String(entry.index)}
      style={numColumns > 1 ? { flexGrow: 1, flexBasis: `${100 / numColumns}%` } : undefined}
    >
      {renderItem?.({ item: entry.item, index: entry.index, separators: LIST_SEPARATORS })}
    </View>
  )
  /**
   * FlatList 直接挂 `refreshing` / `onRefresh`(而不是塞 <RefreshControl> 子元素)也是 RN 合法写法,
   * 共享层 `shop/CartScreen.tsx:168-169` 就是这么写的。此前两个 prop 都被丢弃 ⇒ 购物车下拉
   * **不触发刷新回调**(用户看到默认圆圈转一下又弹回,以为没生效)。这里补成 RN 语义等价的
   * refreshControl 元素,交给 ScrollView 的 refresher 三件套统一承接(与 113 处子元素写法同一条路)。
   */
  const refreshControl =
    props.refreshControl ??
    (typeof props.onRefresh === 'function'
      ? createElement(RefreshControl, {
          refreshing: props.refreshing === true,
          onRefresh: props.onRefresh as () => void,
        })
      : undefined)
  return (
    <ScrollView
      {...props}
      /**
       * columnWrapperStyle 承接(2026-11-14):RN 用它给多列行设 `gap`/`justifyContent`。
       * 共享层 6 个两列栅格页(AigcList / ImageGen 系列 / PointsMall / StudyIndex)都传了它,
       * 此前被丢弃 ⇒ 同一行两张卡片**贴在一起**,与 RN 端观感不一致。
       * 落地位置在下面的行容器(本层自己负责分行,所以这一格由本层消费,不再往 ScrollView 传)。
       */
      refreshControl={refreshControl}
      // onScroll 显式透传(2026-11-12):RN FlatList 合法消费 onScroll;此前只靠 {...props}
      // 摊入,兼容面 ScrollView 的 throttle 收口路径不变,这里让声明面自文档化、审计可寻。
      onScroll={props.onScroll as never}
      scrollTop={scrollTop}
      scrollWithAnimation={scrollWithAnimation}
    >
      {Header}
      {data.length === 0 ? Empty : null}
      {numColumns > 1
        ? rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[{ flexDirection: 'row' }, flattenStyle(props.columnWrapperStyle as never)]}
            >
              {row.map((entry) => cell(entry))}
            </View>
          ))
        : ordered.map((entry, seq) => (
            <View key={keyExtractor ? keyExtractor(entry.item, entry.index) : String(entry.index)}>
              {seq > 0 ? Separator?.() : null}
              {renderItem?.({ item: entry.item, index: entry.index, separators: LIST_SEPARATORS })}
            </View>
          ))}
      {Footer}
    </ScrollView>
  )
}

export const FlatList = forwardRef(FlatListInner) as unknown as (<T = unknown>(
  props: RNFlatListProps<T> & { ref?: Ref<FlatListHandle> },
) => ReactElement) & { displayName?: string }

/**
 * 命令式焦点句柄(2026-11-05):RN 的 TextInput 有 focus/blur/clear/isFocused 实例方法。
 * 小程序没有实例方法 ⇒ focus/blur 翻译成 Taro 的 `focus` 布尔档(受控),clear 走 onChangeText('')。
 */
export interface TextInputHandle {
  focus: () => void
  blur: () => void
  clear: () => void
  isFocused: () => boolean
}

function TextInputInner(props: RNBaseProps, ref: ForwardedRef<TextInputHandle>) {
  const multiline = props.multiline === true
  const [focused, setFocused] = useState(false)
  // 句柄要跨 focus/blur 保持同一对象(ref 快照语义),故真值放 ref,state 只驱动 focus prop
  const focusedRef = useRef(false)
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        focusedRef.current = true
        setFocused(true)
      },
      blur: () => {
        focusedRef.current = false
        setFocused(false)
      },
      // RN 的 clear 是"清空原生文本";受控组件里等价于把空串回给 onChangeText
      clear: () => (props.onChangeText as ((t: string) => void) | undefined)?.(''),
      isFocused: () => focusedRef.current,
    }),
    [props.onChangeText],
  )
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
  /**
   * 焦点桥(2026-11-01):RN 消费面读 nativeEvent.{text,target},Taro 给 detail.value;
   * 旧写法声明了 onFocus/onBlur 却从不派发 ⇒ SearchInput/TextField/MessageInput 的
   * 聚焦态样式与失焦收起整条静默。消费面现读全部忽略载荷(零参回调),桥按最小形状合成。
   */
  const focusBridge = {
    onFocus: props.onFocus
      ? (e: { detail?: { value?: string } }) =>
          (
            props.onFocus as
              ((ev: NativeSyntheticEvent<{ target: number; text?: string }>) => void) | undefined
          )?.({ nativeEvent: { target: -1, text: String(e.detail?.value ?? '') } })
      : undefined,
    onBlur: props.onBlur
      ? (e: { detail?: { value?: string } }) =>
          (
            props.onBlur as
              ((ev: NativeSyntheticEvent<{ target: number; text?: string }>) => void) | undefined
          )?.({ nativeEvent: { target: -1, text: String(e.detail?.value ?? '') } })
      : undefined,
  }
  /**
   * 回车提交承接(2026-11-14)。
   *
   * RN 侧 `onSubmitEditing` + `returnKeyType` 是搜索/发消息/验证码的**主入口**:
   * 共享层现读 11 处 onSubmitEditing(SearchInput、SearchScreen、LetterChat、LiveDetail…)、
   * 22 处 returnKeyType。此前两者都只声明在类型上、运行时不读 ⇒ 用户按回车**什么都不发生**,
   * 键盘右下角永远写着"完成/换行"而不是"搜索/发送",所有这类链路只能靠再点一次按钮兜底。
   * weapp 的等价物是 `confirm-type` + `bindconfirm`,这里按同一语义接上。
   */
  const confirmType = RETURN_KEY_TO_CONFIRM[(props.returnKeyType as string) ?? ''] ?? 'done'
  const onSubmitEditing = props.onSubmitEditing as
    ((e: { nativeEvent: { text: string } }) => void) | undefined
  const common = {
    value: (props.value as string) ?? '',
    placeholder: (props.placeholder as string) ?? '',
    placeholderStyle: props.placeholderTextColor
      ? `color: ${props.placeholderTextColor as string}`
      : undefined,
    maxlength: (props.maxLength as number) ?? -1,
    disabled: props.editable === false,
    autoFocus: props.autoFocus === true,
    // 受控焦点:focus()/blur() 改的是这一位,和 autoFocus 取或,避免首次挂载把焦点抢回来
    focus: focused || props.autoFocus === true,
    className: typeof props.className === 'string' ? props.className : undefined,
    style: toTaroStyle(
      merged(
        props.style,
        VIEW_BASE,
        typeof props.className === 'string' ? props.className : undefined,
      ),
    ),
    confirmType,
    // RN 的 onConfirm 只在"键盘确认键"触发,与 onSubmitEditing 同义;取当前输入值随事件带出
    onConfirm: onSubmitEditing
      ? (e: { detail?: { value?: string } }) =>
          onSubmitEditing({ nativeEvent: { text: String(e.detail?.value ?? '') } })
      : undefined,
    ...focusBridge,
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

/** 同上:旧写法普通函数组件,<TextInput ref={r}> 恒为 null ⇒ focus() 静默丢失 */
export const TextInput = forwardRef(TextInputInner) as unknown as (
  /**
   * 闭合面(不是 RNBaseProps):后者带 `[key: string]: unknown`,
   * 共享层 `Omit<ComponentPropsWithRef<typeof TextInput>, …>`(TextField.tsx)会被索引签名
   * 折叠成纯索引签名 —— 具名键退回 unknown ⇒ 回调形参失去上下文类型(62 处 TS7006)。
   * 只收 `RNTextInputProps`(输入专有键),仍不带索引签名。
   */
  props: RNTextInputProps & { ref?: Ref<TextInputHandle> },
) => ReactElement

function keyTypeOf(keyboardType: string): string {
  return keyboardType === 'default' ? 'text' : keyboardType
}

/**
 * RN `returnKeyType` → weapp `confirm-type`。
 *
 * weapp 只认五档(send/search/next/go/done),RN 的其余取值(none/previous/emergency-call/…)
 * 在小程序键盘上没有对应能力 ⇒ 统一退 `done`(最接近 RN 的"完成")。
 * 不映射会更糟:缺省 `done` 也对,但"搜索"场景的键盘会写成"完成",用户不知道回车能提交。
 */
const RETURN_KEY_TO_CONFIRM: Record<string, 'send' | 'search' | 'next' | 'go' | 'done'> = {
  send: 'send',
  search: 'search',
  next: 'next',
  go: 'go',
  done: 'done',
  default: 'done',
}

export function Switch(props: RNBaseProps) {
  /**
   * trackColor 在 RN 是 {false,true} 对象或 string;TaroSwitch.color 只收一枚 on 态颜色。
   * 旧写法把对象**原样**塞进 color ⇒ 6 个设置屏的开关配色整条失效(2026-11-01 现读,
   * 消费面全部传对象形)。取 true 档;color 为 undefined 时交 Taro 缺省。
   * thumbColor 在 Taro 无等价键(滑块色由宿主主题定),声明位保留、不装假映射。
   */
  const track = props.trackColor as string | { false?: unknown; true?: unknown } | undefined
  const color = typeof track === 'string' ? track : (track?.true as string | undefined)
  return (
    <TaroSwitch
      checked={props.value === true}
      disabled={props.disabled === true}
      color={color}
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
  const overlay = (
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
  /**
   * Modal → Portal(2026-11-06)。
   *
   * RN Modal 是独立宿主层,不受祖先 overflow/transform/层叠上下文裁剪;旧实现只是
   * `position: fixed` 的普通 View,祖先一有 transform/overflow 就整块被裁,且小程序原生组件
   * (video/input)层叠顺序会盖住它。
   * Taro 没有 ReactDOM.createPortal(小程序无真实 DOM),等价能力是 `RootPortal`
   * (Taro 4.x 的 root-portal 原生节点;weapp 需基础库 ≥ 2.19.4,见 components/types/RootPortal.d.ts)。
   *
   * 降级(平台不可实现的部分,不藏):
   *  - 基础库过低/平台不支持 RootPortal 时退回旧行为 —— 仍是 fixed 覆盖层,但可能被祖先裁剪,
   *    这是 Taro 侧唯一可用能力,无法做真正"跳出文档流";调用方须避免把 Modal 嵌在有 transform 的容器里。
   *  - RN 的 animationType/presentationStyle 在 Taro 无等价物(本层不伪造动画);
   *    onShow/onDismiss 只能由调用方在 visible 变化处自行触发,本层不派发。
   */
  const Portal = RootPortal as unknown as ComponentType<{ children?: ReactNode }> | undefined
  if (!Portal) return overlay
  return createElement(Portal, null, overlay)
}

export const SafeAreaView = View
export const KeyboardAvoidingView = View
export const TouchableHighlight = View
export const TouchableWithoutFeedback = View

/**
 * 命令式定位句柄(2026-11-05):RN 的 SectionList 有 scrollToLocation / getScrollResponder。
 * 小程序拿不到 item 的测量值 ⇒ 不伪造像素偏移,改用 Taro 的 scrollIntoView(id 定位):
 * 行节点按 sectionIndex/itemIndex 编稳定 id,"滚到那一行"的语义不变。
 */
export interface SectionListHandle {
  scrollToLocation: (info: {
    sectionIndex: number
    itemIndex?: number
    animated?: boolean
    viewOffset?: number
    viewPosition?: number
  }) => void
  getScrollResponder: () => ScrollViewHandle | null
}

/** RN 的分区列表:小程序没有分区原语,按「SectionList 语义」逐段渲染(段头 + 段内行) */
function SectionListInner(props: RNBaseProps, ref: ForwardedRef<SectionListHandle>) {
  const sections =
    (props.sections as Array<{ key?: string; data?: unknown[]; renderItem?: unknown }>) ?? []
  const renderSection = props.renderSectionItem as
    ((info: { section: unknown; index: number }) => ReactNode) | undefined
  const ItemSeparator = props.ItemSeparatorComponent as (() => ReactNode) | undefined
  const scrollRef = useRef<ScrollViewHandle | null>(null)
  const [scrollIntoView, setScrollIntoView] = useState<string | undefined>(undefined)
  const [scrollWithAnimation, setScrollWithAnimation] = useState(true)
  useImperativeHandle(
    ref,
    () => ({
      scrollToLocation: ({ sectionIndex, itemIndex, animated }) => {
        setScrollIntoView(`sl-${sectionIndex}-${itemIndex ?? 0}`)
        setScrollWithAnimation(animated !== false)
      },
      getScrollResponder: () => scrollRef.current,
    }),
    [],
  )
  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      scrollIntoView={scrollIntoView}
      scrollWithAnimation={scrollWithAnimation}
    >
      {props.ListHeaderComponent as ReactNode}
      {sections.map((section, index) => (
        <View key={section.key ?? String(index)} id={`sl-${index}-h`}>
          {renderSection?.({ section, index })}
          {((section.data as unknown[]) ?? []).map((item, i) => (
            <View key={i} id={`sl-${index}-${i}`}>
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

/** 同上:旧写法普通函数组件,<SectionList ref={r}> 恒为 null ⇒ scrollToLocation 静默丢失 */
export const SectionList = forwardRef(SectionListInner) as unknown as (
  props: RNBaseProps & { ref?: Ref<SectionListHandle> },
) => ReactElement

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
