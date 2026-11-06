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
export const Pressable = make('button')
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
