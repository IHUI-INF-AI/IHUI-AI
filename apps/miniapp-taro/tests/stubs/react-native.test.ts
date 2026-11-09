// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * react-native 测试桩的契约锁。
 *
 * 背景:tests/stubs/react-native.ts 是小程序页薄壳测试的平台依赖 —— vitest.config.ts
 * 把裸包 `react-native` alias 到该桩(knip 静态图看不见 alias 正则项,会把桩误判死代码)。
 * 本文件以真实 import 消费桩的全部导出面,锁两件事:
 *   ① 桩的导出集不得漂移(共享屏按 RN 原语写,缺一个原语整份 suite 收集即挂);
 *   ② vitest.config.ts 的 alias 接线不得被摘除(摘除后所有薄壳页用例直接红于模块解析失败)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as RNStub from './react-native'
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from './react-native'

const PRIMITIVES = [
  'View',
  'Text',
  'Image',
  'TouchableOpacity',
  'Pressable',
  'ScrollView',
  'TextInput',
  'Modal',
  'RefreshControl',
  'FlatList',
  'StyleSheet',
  'Platform',
  'Dimensions',
  'Animated',
] as const

describe('tests/stubs/react-native 契约', () => {
  it('导出集完整:每个 RN 原语都在位且可调用', () => {
    // 具名导入即逐名消费(knip 静态图可见),namespace 断言锁导出集不漂移。
    const named = {
      View,
      Text,
      Image,
      TouchableOpacity,
      Pressable,
      ScrollView,
      TextInput,
      Modal,
      RefreshControl,
      FlatList,
      StyleSheet,
      Platform,
      Dimensions,
      Animated,
    }
    for (const name of PRIMITIVES) {
      const value = (RNStub as Record<string, unknown>)[name]
      expect(value, `桩缺少原语 ${name}`).toBeDefined()
      expect(typeof value, `原语 ${name} 应为函数/对象`).toMatch(/function|object/)
      expect((named as Record<string, unknown>)[name], `具名导入 ${name} 应与 namespace 一致`).toBe(
        value,
      )
    }
  })

  it('各原语组件可渲染不抛错(壳屏渲染链的最小保证)', () => {
    expect(View({ children: null })).toBeTruthy()
    expect(Text({ children: 'x' })).toBeTruthy()
    expect(Image({ source: { uri: 'x' } })).toBeTruthy()
    expect(TouchableOpacity({ onPress: () => {} })).toBeTruthy()
    expect(Pressable({ onPress: () => {} })).toBeTruthy()
    expect(ScrollView({ children: null })).toBeTruthy()
    expect(TextInput({ value: '' })).toBeTruthy()
    expect(Modal({ visible: true, children: null })).toBeTruthy()
    expect(RefreshControl({ refreshing: false })).toBeNull()
    expect(Animated.View({ children: null })).toBeTruthy()
    expect(Animated.Text({ children: null })).toBeTruthy()
    expect(Animated.ScrollView({ children: null })).toBeTruthy()
    expect(Animated.createAnimatedComponent(View)).toBe(View)
  })

  it('FlatList 渲染 data 与头尾槽不抛错(壳屏渲染链的最小保证)', () => {
    const seen: unknown[] = []
    const node = RNStub.FlatList({
      data: [1, 2],
      renderItem: ({ item }: { item: unknown }) => {
        seen.push(item)
        return null
      },
      ListHeaderComponent: () => null,
      ListFooterComponent: null,
      ItemSeparatorComponent: () => null,
    })
    expect(seen).toEqual([1, 2])
    expect(node).toBeTruthy()
  })

  it('Platform/Dimensions 给出确定性读数', () => {
    expect(RNStub.Platform.OS).toBe('ios')
    expect(RNStub.Platform.select({ ios: 'a', default: 'b' })).toBe('a')
    expect(RNStub.Dimensions.get('window').width).toBe(375)
    expect(RNStub.StyleSheet.create({ a: { flex: 1 } })).toEqual({ a: { flex: 1 } })
  })

  it('② alias 接线源码锁:react-native 必须指到本桩', () => {
    const cfg = readFileSync(resolve(__dirname, '../../vitest.config.ts'), 'utf8')
    expect(cfg).toContain('find: /^react-native$/')
    expect(cfg).toContain('tests/stubs/react-native.ts')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
