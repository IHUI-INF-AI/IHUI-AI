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

type Measurable = HTMLElement & {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void
}

const mk = (tag: string) =>
  function MockComp(props: { children?: ReactNode; ref?: unknown; [k: string]: unknown }) {
    const { style, onPress, ref, ...rest } = props
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
    return createElement(
      tag,
      { ...rest, ref: setRef, onClick: onPress, style: flattenStyle(style) },
      props.children,
    )
  }

export const Platform = { OS: 'web' as const }
/**
 * src/theme/active-tokens.ts 在**模块求值时**调 Appearance.getColorScheme(),
 * 并在 release 下靠 DevSettings 之外的路径落盘。stub 缺这两个导出时,
 * 任何 transitively import 主题层的测试文件都会以 "No 'Appearance' export is
 * defined on the 'react-native' mock" 整文件加载失败(2026-09-23 实测 5 个文件)。
 */
export const Appearance = {
  getColorScheme: () => 'light' as 'light' | 'dark' | null,
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
export const ScrollView = mk('div')
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
  const { data, renderItem, keyExtractor, style, onPress, children, ...rest } = props
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
    rows.length ? rows : (children as ReactNode | undefined),
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
  Value: class {
    // 不能写 private:导出的匿名类带私有成员会触发 TS4094(声明无法 emit)
    current: number
    constructor(initial: number) {
      this.current = initial
    }
    setValue(next: number) {
      this.current = next
    }
    __getValue() {
      return this.current
    }
    interpolate() {
      return { __getValue: () => 0 }
    }
  },
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
  Animated,
  BackHandler,
}

export default ReactNative
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
