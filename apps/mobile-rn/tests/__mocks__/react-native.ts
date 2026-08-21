/**
 * react-native mock for vitest/jsdom environment
 *
 * 防止 vitest 预打包时解析 react-native/index.js 中的 Flow type 语法失败。
 * 各测试文件自定义 vi.mock('react-native', ...) 时覆盖此 mock。
 * 未自定义 mock 的测试文件（如 token.test.ts、secure-store.test.ts）使用此 mock。
 */
import { createElement, type ReactNode } from 'react'

const mk = (tag: string) =>
  function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
    return createElement(tag, props, props.children)
  }

export const Platform = { OS: 'web' as const }
export const View = mk('div')
export const Text = mk('span')
export const Pressable = mk('button')
export const TouchableOpacity = mk('button')
export const ScrollView = mk('div')
export const FlatList = mk('div')
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
