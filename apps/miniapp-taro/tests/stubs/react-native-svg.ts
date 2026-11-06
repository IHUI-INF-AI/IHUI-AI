// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 react-native-svg 最小桩。
 *
 * 背景:小程序薄壳页会加载 RN 共享屏,屏里的图标来自 `lucide-react-native`;它的
 * Icon.mjs 静态 `import * as NativeSvg from 'react-native-svg'` 再按标签名取
 * `NativeSvg.Svg / NativeSvg[IconNodeTag]`。该依赖被 vitest 外部化后由 Node 直接加载,
 * 它内部 `require('react-native')` 绕过本仓 vitest 的裸包 alias,落到真包的 Flow 源码
 * (`import typeof * as ReactNativePublicAPI from './index.js.flow'`)⇒
 * `SyntaxError: Unexpected token 'typeof'`,整份测试文件在**收集期**就失败(零用例执行)。
 * 这里用 vitest alias + server.deps.inline 把这一环指到本桩:只把 SVG 标签映射成 DOM 标签,
 * 与既有 tests/stubs/react-native.ts 同型 —— 只切平台依赖,不改变任何被测判序。
 */

import { createElement, type ReactNode } from 'react'

type AnyProps = Record<string, unknown> & { children?: ReactNode }

const make = (tag: string) => {
  const Comp = (props: AnyProps) => createElement(tag, props)
  Comp.displayName = `RNSvgStub_${tag}`
  return Comp
}

export const Svg = make('svg')
export const Path = make('path')
export const Circle = make('circle')
export const Ellipse = make('ellipse')
export const G = make('g')
export const Line = make('line')
export const Polyline = make('polyline')
export const Polygon = make('polygon')
export const Rect = make('rect')
export const Text = make('text')
export const TSpan = make('tspan')
export const TextPath = make('textPath')
export const Defs = make('defs')
export const ClipPath = make('clipPath')
export const Mask = make('mask')
export const Marker = make('marker')
export const Pattern = make('pattern')
export const Use = make('use')
export const Symbol = make('symbol')
export const Image = make('image')
export const LinearGradient = make('linearGradient')
export const RadialGradient = make('radialGradient')
export const Stop = make('stop')
export const Filter = make('filter')
export const ForeignObject = make('foreignObject')

export default Svg
