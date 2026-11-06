// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 react-native 最小桩。
 *
 * 背景：小程序页薄壳后会 import `@ihui/rn-app/features/**` 的共享屏，共享屏按 RN
 * 原语写（View/Text/FlatList…）。主树 pnpm 链接面缺 `react-native/index.js`，
 * vitest 解析即失败。这里用 vitest alias 把裸 `react-native` 指到本桩：
 * 只把原语映射成 DOM 标签，不改变任何被测判序（与既有 @tarojs/components 桩同型）。
 */

import { createElement, type ReactNode } from 'react'

type AnyProps = Record<string, unknown> & { children?: ReactNode }

const make = (tag: string) => {
  const Comp = (props: AnyProps) => createElement(tag, props)
  Comp.displayName = `RNStub_${tag}`
  return Comp
}

export const View = make('div')
export const Text = make('span')
export const Image = make('img')
export const TouchableOpacity = make('button')
// Pressable 在真 RN 里支持函数子节点(渲染态 `({pressed}) => ReactNode`),壳的
// 胶囊按钮正是这个形态;交给 make 会把它当普通 child 渲染 ⇒ React 报
// "Functions are not valid as a React child"。这里按真实语义求值一次(pressed=false),
// 只补形状,不改任何断言。
export const Pressable = (
  props: AnyProps & { children?: ReactNode | ((s: { pressed: boolean }) => ReactNode) },
) => {
  const { children, ...rest } = props
  const content = typeof children === 'function' ? children({ pressed: false }) : children
  return createElement('button', rest, content)
}
Pressable.displayName = 'RNStub_Pressable'
export const ScrollView = make('div')
export const TextInput = make('input')
export const Modal = make('div')

export const RefreshControl = () => null

export function FlatList(props: {
  data?: unknown[]
  renderItem?: (arg: { item: unknown; index: number }) => ReactNode
  ListFooterComponent?: ReactNode | (() => ReactNode)
  ListHeaderComponent?: ReactNode | (() => ReactNode)
  ItemSeparatorComponent?: ReactNode | (() => ReactNode)
}) {
  const node = (value: ReactNode | (() => ReactNode) | undefined) =>
    typeof value === 'function' ? (value as () => ReactNode)() : (value ?? null)
  return createElement(
    'div',
    null,
    node(props.ListHeaderComponent),
    ...(props.data ?? []).flatMap((item, index) => {
      const rendered = props.renderItem?.({ item, index })
      const separator =
        index < (props.data ?? []).length - 1 ? node(props.ItemSeparatorComponent) : null
      return separator === null ? [rendered] : [rendered, separator]
    }),
    node(props.ListFooterComponent),
  )
}

export const StyleSheet = {
  create: (styles: unknown) => styles,
  flatten: (styles: unknown) => styles,
  hairlineWidth: 1,
  absoluteFillObject: {},
}

export const Platform = { OS: 'ios', select: (v: Record<string, unknown>) => v.ios ?? v.default }

// 2026-11-06 补齐:RN 共享屏的 ThemeContext / active-tokens 在模块求值期就会读 Appearance
// (systemMode)并可选调 DevSettings.reload;缺这两个原语时收集期直接 TypeError。
export const Appearance = {
  getColorScheme: (): 'light' | 'dark' => 'light',
  addChangeListener: (_listener?: unknown) => ({ remove: () => {} }),
  removeChangeListener: (_listener?: unknown) => {},
  setColorScheme: (_scheme: string) => {},
}

export const useColorScheme = (): 'light' | 'dark' =>
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'

export const DevSettings = {
  reload: (_reason?: string) => {},
}

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 2 }),
}

export const Animated = {
  View,
  Text,
  ScrollView,
  createAnimatedComponent: (component: unknown) => component,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
