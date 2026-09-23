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

const flattenStyle = (style: unknown): unknown => {
  // RN 的 Pressable 允许 `style={({pressed}) => [...]}`;DOM 拿到函数会直接抛
  // "expects a mapping … not a string"(typeof function !== object)。
  if (typeof style === 'function')
    return flattenStyle((style as (s: { pressed: boolean }) => unknown)({ pressed: false }))
  if (!Array.isArray(style)) return style
  return Object.assign({}, ...style.filter(Boolean).map(flattenStyle))
}

const mk = (tag: string) =>
  function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
    const { style, onPress, ...rest } = props
    return createElement(
      tag,
      { ...rest, onClick: onPress, style: flattenStyle(style) },
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
export const Animated = {
  View: mk('div'),
  Text: mk('span'),
  createAnimatedComponent: (comp: unknown) => comp,
  timing: () => ({ start: () => {} }),
  spring: () => ({ start: () => {} }),
  Value: class {
    constructor(_v: number) {}
    setValue(_v: number) {}
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
  StyleSheet,
  Dimensions,
  Animated,
}

export default ReactNative
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
