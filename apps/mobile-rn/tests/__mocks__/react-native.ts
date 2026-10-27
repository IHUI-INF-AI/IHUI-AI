// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * react-native mock for vitest/jsdom environment
 *
 * 防止 vitest 预打包时解析 react-native/index.js 中的 Flow type 语法失败。
 * 各测试文件自定义 vi.mock('react-native', ...) 时覆盖此 mock。
 * 未自定义 mock 的测试文件（如 token.test.ts、secure-store.test.ts）使用此 mock。
 */
import { createElement, type ReactNode } from 'react'

const isAnimValue = (v: unknown): v is { __getValue: () => number } =>
  !!v && typeof v === 'object' && '__getValue' in (v as Record<string, unknown>)

const sanitizeStyleObject = (style: object): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(style)) {
    // transform 的值是 Animated.Value 数组,DOM 侧无可断言意义,直接丢;
    // opacity 等标量位置上的 Animated.Value 要先求值成数字,否则 React DOM 抛
    // "The `style` prop expects a mapping from style properties to values"。
    if (k === 'transform') continue
    out[k] = isAnimValue(v) ? Number(v.__getValue()) : v
  }
  return out
}

const flattenStyle = (style: unknown): unknown => {
  // RN 的 Pressable 允许 `style={({pressed}) => [...]}`;DOM 拿到函数会直接抛
  // "expects a mapping … not a string"(typeof function !== object)。
  if (typeof style === 'function')
    return flattenStyle((style as (s: { pressed: boolean }) => unknown)({ pressed: false }))
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(flattenStyle))
  if (style && typeof style === 'object') return sanitizeStyleObject(style)
  return style
}

/**
 * RN 的 Pressable 还支持 **children 渲染函数**(`{({pressed}) => …}`)。替身此前把它原样
 * 交给 React ⇒ "Functions are not valid as a React child",标签根本不渲染
 * (MoreLink 把按压态从 style 移到 children 后,my-agents 两条用例当场即红)。
 * 与 flattenStyle 同一条规矩:共享替身必须覆盖真身的 API 面,不得退回各套件各自 vi.mock。
 */
const resolveChildren = (children: ReactNode): ReactNode =>
  typeof children === 'function'
    ? (children as unknown as (s: { pressed: boolean }) => ReactNode)({ pressed: false })
    : children

type Measurable = HTMLElement & {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void
}

/**
 * 这是 RN 测试的**全局单源替身**(vitest.config.ts 的 resolve.alias 把 'react-native'
 * 指到本文件)——新测试一律直接吃它,**禁止**再在测试文件里写 `vi.mock('react-native', …)`
 * 覆盖式文件内 mock(仓内尚存 27 份历史文件内 mock:文件内工厂优先于本替身,导致组件新用
 * 的 API(Animated.sequence/Easing.inOut/onLongPress 等)只在部分文件生效、其余齐崩
 * ——2026-10-24 实测 45 例红即此型)。组件新增 react-native API 消费时:补本文件,
 * 一处生效;确需文件内特化时用 importOriginal 部分覆盖,勿整厂复制。
 */
const mk = (tag: string) =>
  function MockComp(props: { children?: ReactNode; ref?: unknown; [k: string]: unknown }) {
    const {
      style,
      onPress,
      onLongPress,
      onChangeText,
      onSubmitEditing,
      accessibilityLabel,
      ref,
      ...rest
    } = props
    /**
     * React 19 把 ref 当普通 prop 传给函数组件,而这里此前直接把它连同 `style` 一起
     * spread 到 DOM 上 —— 结果 ref 被静默丢弃,`triggerRef.current` 恒为 null,
     * 任何依赖 `measureInWindow` 锚定的组件(CategoryDropdown)在测试里"点了没反应",
     * 且不报错。这里补上真实测量(取 jsdom 的 getBoundingClientRect)。
     */
    const setRef = (node: HTMLElement | null) => {
      if (node && typeof (node as Measurable).measureInWindow !== 'function') {
        ;(node as Measurable).measureInWindow = (cb) => {
          const r = node.getBoundingClientRect()
          cb(r.x, r.y, r.width, r.height)
        }
      }
      if (typeof ref === 'function') ref(node)
      else if (ref && typeof ref === 'object') (ref as { current: unknown }).current = node
    }
    /**
     * RN TextInput 的受控入口是 onChangeText + onSubmitEditing(回车),DOM 侧对应
     * onChange / Enter 键;accessibilityLabel 对应 web aria-label(RTL getByLabelText 只认它)。
     * 不映射则这些属性只作为未知属性被 React DOM 丢弃 —— 受控输入在测试里"打不了字、
     * 提交不了",无障碍文案也检索不到(SearchOverlay 弹层三者皆用)。同 flattenStyle 一条规矩:
     * 共享替身必须覆盖真身 API 面,不在各套件各自 vi.mock。
     */
    const extra: Record<string, unknown> = {}
    if (typeof onChangeText === 'function')
      extra.onChange = (e: { target: { value: string } }) => {
        ;(onChangeText as (v: string) => void)(e.target.value)
      }
    if (typeof onSubmitEditing === 'function')
      extra.onKeyDown = (e: { key: string }) => {
        if (e.key === 'Enter') (onSubmitEditing as () => void)()
      }
    if (typeof accessibilityLabel === 'string') {
      extra['aria-label'] = accessibilityLabel
      // 兼发裸属性:渲染族测试(cart/payment 等)历史工厂把 accessibilityLabel 原样落 DOM,
      // 断言用 querySelector('button[accessibilitylabel="…"]');收归后两种查询都要能命中
      extra['accessibilitylabel'] = accessibilityLabel
    }
    return createElement(
      tag,
      {
        onContextMenu: onLongPress,
        ...rest,
        ...extra,
        ref: setRef,
        onClick: onPress,
        style: flattenStyle(style),
      },
      resolveChildren(props.children),
    )
  }

export const Platform = {
  OS: 'web' as const,
  // 2026-10-24 收归补齐:27 份历史文件内工厂全带 select(@react-navigation/native 等
  // 真实包会调),此前靠文件内 mock 纸糊;收归后这里必须自足
  select: (spec: Record<string, unknown>) =>
    'web' in spec
      ? spec['web']
      : ((spec['ios'] ?? spec['android'] ?? Object.values(spec)[0]) as unknown),
  Version: 0,
  isPad: false,
  isTV: false,
}

// 共享替身必须覆盖真身用到的 RN API:MoreLink 经 PixelRatio 换算 hairline/字号,替身缺这个出口时
// 表现是"渲染即抛 No PixelRatio export",而它影响的不止一枚测试(端内 6 个文件从 @ihui/rn-app 引
// MoreLink)。按真实 RN API 面补全,而不是在各套件里各自 vi.mock。
export const PixelRatio = {
  get: () => 1,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size: number) => size,
  roundToNearestPixel: (size: number) => size,
}
/**
 * 设备指纹采集器读 `I18nManager.getConstants().localeIdentifier` 作为语言段(它比 `Intl` 更接近
 * RN 真机上实际生效的那份 locale;而 `I18nManager.localeIdentifier` 这个直写属性在 RN 的 .d.ts
 * 里根本不存在,写它编译不过)。同上一条规矩:ESM 下 import 一个替身没有的出口不是拿到 undefined,
 * 而是 **整个模块加载失败** ⇒ 凡真身用到的 API 一律在这里补齐,不在各套件里各自 vi.mock。
 */
export const I18nManager = {
  localeIdentifier: 'en-US',
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  allowRTL: (_allow: boolean) => {},
  forceRTL: (_force: boolean) => {},
  swapLeftAndRightInRTL: (_flip: boolean) => {},
  getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en-US' }),
}
/**
 * src/theme/active-tokens.ts 在**模块求值时**调 Appearance.getColorScheme(),
 * 并在 release 下靠 DevSettings 之外的路径落盘。stub 缺这两个导出时,
 * 任何 transitively import 主题层的测试文件都会以 "No 'Appearance' export is
 * defined on the 'react-native' mock" 整文件加载失败(2026-09-23 实测 5 个文件)。
 */
export const windowColorSchemeCalls: Array<'light' | 'dark' | 'unspecified'> = []
export function __resetWindowColorSchemeCalls(): void {
  windowColorSchemeCalls.length = 0
}
export const Appearance = {
  getColorScheme: () => 'light' as 'light' | 'dark' | null,
  setColorScheme: (scheme: 'light' | 'dark' | 'unspecified') => {
    windowColorSchemeCalls.push(scheme)
  },
  addChangeListener: (_cb: (s: { colorScheme: 'light' | 'dark' | null }) => void) => ({
    remove() {},
  }),
}
export const DevSettings = {
  reload: (_reason?: string) => {},
}
export const View = mk('div')
export const Text = mk('span')
export const Pressable = mk('button')
export const TouchableOpacity = mk('button')
/**
 * ScrollView 不能是裸 `mk('div')`:它与普通 View 在 DOM 上完全同形,于是分类下拉面板
 * 「改成 ScrollView 才不会被 maxHeight+overflow:hidden 静默裁切」这条修复在测试里
 * 无从取证(换回 View 也全绿)。打一个 data 标记,让回归锁能选中真正承担滚动的容器。
 */
const ScrollViewBase = mk('div')
export function ScrollView(props: { children?: ReactNode; [k: string]: unknown }) {
  return createElement(ScrollViewBase, { ...props, 'data-rn-scrollview': 'true' })
}
/**
 * FlatList 必须是"真渲染"的 stub:`mk('div')` 直接吐掉 data/renderItem,任何把内容
 * 放进列表的组件在测试里都渲染成空壳 —— 断言照常通过,覆盖率为 0(假绿)。
 * 分类条 CategoryInlineBar 换成 FlatList 横向条后,order.test 15 例断言不到 tab 文案,
 * 就是这条被暴露出来,而不是那条断言写错了。
 */
export function FlatList(props: {
  data?: readonly unknown[]
  renderItem?: (info: { item: unknown; index: number }) => ReactNode
  keyExtractor?: (item: unknown, index: number) => string
  style?: unknown
  onPress?: unknown
  [k: string]: unknown
}) {
  const { data, renderItem, keyExtractor, style, onPress, children, ListEmptyComponent, ...rest } =
    props
  const rows = (data ?? []).map((item, index) =>
    createElement(
      'div',
      { key: keyExtractor ? keyExtractor(item, index) : index },
      renderItem ? renderItem({ item, index }) : null,
    ),
  )
  return createElement(
    'div',
    { ...rest, onClick: onPress, style: flattenStyle(style) },
    // 2026-10-24 收归补齐:空数据时落 ListEmptyComponent(空态骨架/文案)——27 份历史
    // 文件内工厂全处理它,渲染族(cart 等)的空态三分支用例钉的就是这一格
    rows.length ? rows : ((children ?? ListEmptyComponent) as ReactNode | undefined),
  )
}
export const TextInput = mk('input')
export const Image = mk('img')
export const ActivityIndicator = () => createElement('div', null, 'loading')
export const RefreshControl = () => null
export const Modal = (props: { visible?: boolean; children?: ReactNode }) =>
  props?.visible ? createElement('div', null, props.children) : null
export const Switch = (props: { value?: boolean; onValueChange?: (v: boolean) => void }) =>
  createElement('input', { type: 'checkbox', checked: !!props.value, readOnly: true })
export const useColorScheme = () => 'light'
export const StyleSheet = {
  create: (s: Record<string, unknown>) => {
    // 对齐 RN StyleSheet.create 返回冻结对象的行为，但用 String 包装数值 key，
    // 避免 React DOM setValueForStyle 对属性名 '0' 调用 Proxy set trap 时报
    // 'trap returned falsish' 错误（冻结对象 + 数值索引在 jsdom 下会 crash）。
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(s)) {
      out[String(k)] = v
    }
    return out
  },
  // 真身 API 面补齐:hairlineWidth 是分隔线/描边常用档(SearchOverlay divider 即用它),
  // absoluteFillObject 是全屏遮罩常用底(弹层 backdrop 即展开它)。缺了前者 height 变 NaN,
  // 缺了后者遮罩样式表静默丢铺满四边 —— 都不报错但断言失真。
  hairlineWidth: 1,
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
} as const
export const Dimensions = { get: () => ({ width: 375, height: 812 }) }
/**
 * CategoryDropdown 用 useWindowDimensions 做面板定位、用 BackHandler 接 Android 返回键。
 * 这两个导出缺失时,组件一挂载就 TypeError —— 于是"下拉窗"这一形态在全仓零测试覆盖
 * (不是没人想测,是桩不支持)。补上它才谈得上有证据。
 */
export const useWindowDimensions = () => ({ width: 375, height: 812, scale: 1, fontScale: 1 })
export const BackHandler = {
  addEventListener: (_event: string, _cb: () => boolean) => ({ remove() {} }),
  removeEventListener: (_event: string, _cb: () => boolean) => {},
  exitApp: () => {},
}
/**
 * AppState(2026-10-27 立):语音笔记面板用 `AppState.addEventListener('change')` 监听
 * App 退到后台(后台回收 ⇒ 录音被系统打断 ⇒ 收成 interrupted 终态)。
 * 桩要**可派发**:只给个空 addEventListener 的话,组件在测试里挂载即崩(AppState undefined),
 * 而"退后台"这条路径永远无法被用例触发 —— 等于把该形态锁在零覆盖区。
 * `__emit` 是替身专用出口(真身 AppState 上没有它)。
 */
type AppStateListener = (state: string) => void
const appStateListeners = new Set<AppStateListener>()
export const AppState = {
  currentState: 'active',
  addEventListener: (_event: string, cb: AppStateListener) => {
    appStateListeners.add(cb)
    return {
      remove: () => {
        appStateListeners.delete(cb)
      },
    }
  },
  removeEventListener: (_event: string, cb: AppStateListener) => {
    appStateListeners.delete(cb)
  },
  /** 替身专用:派发一次 AppState 变更 */
  __emit: (state: string) => {
    AppState.currentState = state
    for (const cb of [...appStateListeners]) cb(state)
  },
  __reset: () => {
    appStateListeners.clear()
    AppState.currentState = 'active'
  },
}
export const Animated = {
  View: mk('div'),
  Text: mk('span'),
  createAnimatedComponent: (comp: unknown) => comp,
  timing: () => ({ start: () => {} }),
  spring: () => ({ start: () => {} }),
  // 开合动画走 Animated.parallel([...]) —— 缺它同样必崩
  parallel: (anims: readonly { start: () => void }[]) => ({
    start: (cb?: unknown) => {
      anims.forEach((a) => a.start())
      if (typeof cb === 'function') (cb as () => void)()
    },
  }),
  // 2026-10-24:ScreenStates 骨架屏 shimmer 走 Animated.loop(Animated.sequence([...]))
  // —— 缺 sequence 时凡渲染骨架屏的屏(用本全局替身的全部测试)挂载即崩(g-469 七例即此型)
  sequence: (anims: readonly { start: () => void }[]) => ({
    start: (cb?: unknown) => {
      anims.forEach((a) => a.start())
      if (typeof cb === 'function') (cb as () => void)()
    },
  }),
  loop: (anim: { start: () => void }) => ({
    start: () => anim.start(),
    stop: () => {},
    reset: () => {},
  }),
  event: () => () => {},
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {},
  Value: class {
    // 不能写 private:导出的匿名类带私有成员会触发 TS4094(声明无法 emit)
    current: number
    constructor(initial: number) {
      this.current = initial
    }
    setValue(next: number) {
      this.current = next
    }
    // FloatBox(G-958 用例渲染链上)在 visible→false 的 effect 里调 stopAnimation 打断动画;
    // 替身缺它会让套件挂在收集后的首个渲染上(环境缺件,不是被测缺陷)。
    stopAnimation(callback?: (value: number) => void) {
      if (typeof callback === 'function') callback(this.current)
    }
    __getValue() {
      return this.current
    }
    interpolate() {
      return { __getValue: () => 0 }
    }
  },
}

// BottomPops(共享确认弹层,已进 App 根树)挂载即 PanResponder.create(下拉关闭手势);
// 开合动画取 Easing.inOut(Easing.ease)。AppConfirmHost 进树后任何渲染 App 的测试都会触达。
export const PanResponder = {
  create: () => ({ panHandlers: {} }),
}
// App.tsx 模块求值期注册组件 + 抑制黄框(2026-10-24 收归:此前 app-root-background-focused-route
// 与 video-immersive-band 两份文件内 mock 各自扩展这两键,现收进单源替身)
export const AppRegistry = {
  registerComponent: () => ({}),
  runApplication: () => {},
}
export const LogBox = {
  ignoreAllLogs: () => {},
  ignoreLogs: () => {},
  install: () => {},
}

export const Easing = {
  linear: 'linear',
  ease: 'ease',
  in: (easing: unknown) => easing,
  out: (easing: unknown) => easing,
  inOut: (easing: unknown) => easing,
}

const ReactNative = {
  Platform,
  Appearance,
  DevSettings,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
  useColorScheme,
  useWindowDimensions,
  StyleSheet,
  Dimensions,
  I18nManager,
  Animated,
  BackHandler,
  AppState,
  PanResponder,
  Easing,
}

export default ReactNative
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
