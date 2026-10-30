// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/expo-blur.tsx —— expo-blur 在小程序端的等价实现(独立承载面)。
 *
 * 为什么必须有这一层(2026-10-31,按 webpack issuer 取证):
 * 壳复用腿把 `apps/mobile-rn/src/screens/*` 纳入小程序编译面,其中 Home/Course/Live/News/Plaza/Profile
 * 六屏与 TabBar 都 `import { BlurTargetView|BlurView } from 'expo-blur'`。没有替身时 webpack 解析到
 * `node_modules/expo-blur/build/index.js`(SDK 57),它 re-export 的 `BlurView` 经 `NativeBlurModule.js`
 * 再引 `expo-modules-core`;该包 `main: src/index.ts` 发**未编译 TS**,而 weapp webpack 不转译
 * node_modules 的 `.ts` ⇒ 整轮构建死在 `ModuleParseError: Unexpected token (5:7)`,产物出不来。
 *
 * 语义降级如实登记(不是空壳糊弄):
 *  · BlurTargetView 在 RN 侧是"被 TabBar 采样做动态模糊的目标区",本身无视觉 ⇒ 这里透传容器,
 *    ref 收下不使用(小程序没有可采样的原生模糊层,拿不到也无需拿)。
 *  · BlurView 的 `intensity` 是无高斯模糊原语时唯一可折算的量:强度越大越不透明,与 RN 观感同向;
 *    用 opacity 而不是硬编 rgba,避免在端内自立一档颜色(AGENTS §4 色档单一源头)。
 *  · `tint`/`blurMethod`/`blurTarget` 等原生参数只接收不使用 —— 小程序无对应原语,不假装等价。
 */
import type { ReactNode } from 'react'

import { View } from './primitives'
import { flattenStyle, type StyleProp, type TextStyle, type ViewStyle } from './style'

export interface BlurTargetViewProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle | TextStyle>
  /** RN 侧用于把 ref 交给 TabBar 采样;小程序无原生模糊层,收下不使用 */
  ref?: unknown
}

export function BlurTargetView({ children, style }: BlurTargetViewProps) {
  return <View style={style}>{children}</View>
}

export interface BlurViewProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle | TextStyle>
  intensity?: number
  tint?: 'light' | 'dark' | 'extra-light' | 'default' | 'systemChromeMaterial'
  blurMethod?: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus'
  blurTarget?: unknown
  [key: string]: unknown
}

export function BlurView({ children, style, intensity = 80 }: BlurViewProps) {
  const alpha = Math.min(1, Math.max(0, intensity / 100))
  return <View style={{ ...flattenStyle(style), opacity: alpha }}>{children}</View>
}

export default BlurView
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
