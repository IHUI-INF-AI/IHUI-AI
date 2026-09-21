// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * react-native-svg mock for vitest/jsdom environment
 *
 * 并发会话 2d4363aa5d(emoji 图标统一为 lucide)引入 lucide-react-native 后,
 * 其 Icon.mjs `import * as NativeSvg from 'react-native-svg'`。
 * 真实 react-native-svg 包无 exports 字段,入口指向 Flow 源码(src/index.ts),
 * esbuild 加载时遇 Flow `typeof` 语法崩溃(SyntaxError: Unexpected token 'typeof'),
 * 导致 5 个 suite(agent-runtime-panel / agent-screen / message-center /
 * payment / plaza-screen)加载失败。
 *
 * 此 mock 提供 lucide 所需的 SVG 元素组件(通过 NativeSvg[UpperCasedTag]
 * 动态取 Svg/Path/Circle/...),直接渲染为 jsdom 可识别的原生 SVG DOM 标签。
 */
import { createElement, forwardRef, type ReactNode } from 'react'

type SvgCompProps = { children?: ReactNode; [k: string]: unknown }

const mkSvgComp = (domTag: string) =>
  forwardRef<SVGElement, SvgCompProps>((props, ref) =>
    // props 含 [k: string]: unknown 索引签名,children 会被收窄为 unknown,
    // 显式断言回 ReactNode 以通过 createElement 重载
    createElement(domTag, { ...props, ref }, props.children as ReactNode),
  )

// lucide Icon.mjs 通过 NativeSvg[UpperCasedTag] 动态访问元素组件,
// 这里覆盖 lucide iconNode 的全部标签集合 + react-native-svg 常用导出
export const Svg = mkSvgComp('svg')
export const Path = mkSvgComp('path')
export const Circle = mkSvgComp('circle')
export const Rect = mkSvgComp('rect')
export const Line = mkSvgComp('line')
export const Polyline = mkSvgComp('polyline')
export const Polygon = mkSvgComp('polygon')
export const Ellipse = mkSvgComp('ellipse')
export const G = mkSvgComp('g')
export const Defs = mkSvgComp('defs')
export const Use = mkSvgComp('use')
export const Text = mkSvgComp('text')
export const TSpan = mkSvgComp('tspan')
export const Stop = mkSvgComp('stop')
export const LinearGradient = mkSvgComp('linearGradient')
export const RadialGradient = mkSvgComp('radialGradient')
export const Mask = mkSvgComp('mask')
export const ClipPath = mkSvgComp('clipPath')
export const Pattern = mkSvgComp('pattern')
export const SvgSymbol = mkSvgComp('symbol')

// LoginScreen 直接使用 SvgXml/SvgUri:渲染为占位 svg(内容不参与断言)
export const SvgXml = () => createElement('svg', { 'data-testid': 'svg-xml' }, null)
export const SvgUri = () => createElement('svg', { 'data-testid': 'svg-uri' }, null)
export const SvgFromXml = SvgXml

export default Svg
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
