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
import type { ComponentProps, ReactNode } from 'react'
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

/** RN 组件的公共 props 面(逐键声明会漏掉各屏自定义属性,索引签名兜住) */
export interface RNBaseProps {
  style?: StyleProp<ViewStyle | TextStyle>
  children?: ReactNode
  testID?: string
  accessibilityLabel?: string
  [key: string]: unknown
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

export function View(props: RNBaseProps) {
  const onClick = clickHandler(props)
  return (
    <TaroView
      className={typeof props.className === 'string' ? props.className : undefined}
      style={toTaroStyle(merged(props.style, VIEW_BASE))}
      id={typeof props.id === 'string' ? props.id : undefined}
      onClick={onClick}
      onLongPress={props.onLongPress as EventHandler}
    >
      {props.children}
    </TaroView>
  )
}

export function Text(props: RNBaseProps) {
  const onClick = clickHandler(props)
  const numberOfLines = props.numberOfLines as number | undefined
  // 单行且未给 flex 时,RN 的 Text 默认不换行不折行;多行交给 line-clamp(style.ts)
  const nowrap = numberOfLines === 1 ? { whiteSpace: 'nowrap' as const } : {}
  return (
    <TaroText
      style={toTaroStyle({ ...flattenStyle(props.style), ...nowrap })}
      onClick={onClick}
      selectable={props.selectable as boolean | undefined}
    >
      {props.children}
    </TaroText>
  )
}

export const TouchableOpacity = View

export function Pressable(props: RNBaseProps) {
  const pressedStyle = props.style as ((state: { pressed: boolean }) => ViewStyle) | undefined
  const childrenFn = props.children as ((state: { pressed: boolean }) => ReactNode) | undefined
  const resolved =
    typeof pressedStyle === 'function' ? pressedStyle({ pressed: false }) : pressedStyle
  const child = typeof childrenFn === 'function' ? childrenFn({ pressed: false }) : props.children
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
  return (
    <TaroImage
      src={uri ?? ''}
      mode={RESIZE_MODE_TO_TARO[resizeMode] ?? 'aspectFill'}
      style={toTaroStyle(merged(props.style, VIEW_BASE))}
      className={typeof props.className === 'string' ? props.className : undefined}
      onClick={clickHandler(props)}
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

export function FlatList(props: RNBaseProps) {
  const data = (props.data as unknown[]) ?? []
  const renderItem = props.renderItem as
    ((info: { item: unknown; index: number }) => ReactNode) | undefined
  const keyExtractor = props.keyExtractor as ((item: unknown, index: number) => string) | undefined
  const numColumns = (props.numColumns as number) ?? 1
  const Header = props.ListHeaderComponent as ReactNode
  const Footer = props.ListFooterComponent as ReactNode
  const Empty = props.ListEmptyComponent as ReactNode
  const Separator = props.ItemSeparatorComponent as (() => ReactNode) | undefined
  const rows: unknown[][] = []
  if (numColumns > 1) {
    for (let i = 0; i < data.length; i += numColumns) rows.push(data.slice(i, i + numColumns))
  }
  const cell = (item: unknown, index: number) => (
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
export const PanResponder = {
  create: (config: Record<string, unknown>) => {
    const onStart = config.onStartShouldSetResponder as (() => boolean) | undefined
    return {
      get panHandlers() {
        return {
          onStartShouldSetResponder: onStart ? () => true : undefined,
          onResponderGrant: (config.onResponderGrant as unknown) ?? undefined,
          onResponderMove: (config.onResponderMove as unknown) ?? undefined,
          onResponderRelease: (config.onResponderRelease as unknown) ?? undefined,
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
