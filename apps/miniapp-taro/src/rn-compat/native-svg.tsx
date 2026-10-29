// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-svg.tsx —— `react-native-svg` 的小程序端承载。
 *
 * 为什么必须补(2026-10-26 闭包尺现读):该包入口就是**未编译的 TS**(package.json 的 main/react-native
 * 指向 `src/index.ts`),而壳承载闭包里有 `LoginScreen` 取用 `SvgXml`。weapp 侧 webpack 不转译
 * node_modules 的 .ts ⇒ `ModuleParseError`,整轮构建停摆(其余门全绿也照样出不了产物)。
 *
 * 降级口径(逐处点名,不静默):
 *   · `SvgXml` —— 有真等价物:XML 串编成 `data:image/svg+xml,…` 交给端内 Image 绘制。
 *     像素是否逐条同物由运行期验收那一票判,这里不自称已一致。
 *   · `Svg` 与子元素(Path/Rect/Circle/…)—— 小程序没有"把 RN 声明式矢量树序列化成图"的等价层,
 *     ⇒ 不绘制,渲染空容器并告警一次。要真对齐,出路是把源头的插画改成端内 lucide SVG 素材通道,
 *     不是在这里假装有。
 */
import { Image, View } from '@tarojs/components'
import type { JSX, ReactNode } from 'react'

const warned = new Set<string>()
function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

type BoxProps = { style?: unknown; children?: ReactNode; [k: string]: unknown }

/** XML 串 → 端内 Image 的 data URI(SVG)。本文件里唯一"有真等价物"的一档。 */
export function SvgXml({ xml, style }: { xml?: string; style?: unknown }): JSX.Element {
  if (!xml) return <View style={{ display: 'none' }} />
  return (
    <Image
      src={`data:image/svg+xml,${encodeURIComponent(xml)}`}
      style={(style as object) ?? { width: 24, height: 24 }}
      mode="aspectFit"
    />
  )
}

/** 声明式矢量树:端内无等价绘制层 ⇒ 空容器 + 点名。 */
function vectorUnsupported(name: string) {
  return function VectorNode(props: BoxProps): JSX.Element {
    warnOnce(
      `svg-${name}`,
      `react-native-svg 的 <${name}> 在小程序端没有等价绘制层 ⇒ 该插画不绘制(要真对齐请改用端内 lucide SVG 素材通道)`,
    )
    const { style } = props
    return <View style={{ ...(style as object), display: 'none' }} />
  }
}

const Svg = vectorUnsupported('Svg')
export default Svg
export const Path = vectorUnsupported('Path')
export const Rect = vectorUnsupported('Rect')
export const Circle = vectorUnsupported('Circle')
export const Ellipse = vectorUnsupported('Ellipse')
export const Line = vectorUnsupported('Line')
export const Polygon = vectorUnsupported('Polygon')
export const Polyline = vectorUnsupported('Polyline')
export const G = vectorUnsupported('G')
export const Defs = vectorUnsupported('Defs')
export const Stop = vectorUnsupported('Stop')
export const LinearGradient = vectorUnsupported('LinearGradient')
export const RadialGradient = vectorUnsupported('RadialGradient')
export const ClipPath = vectorUnsupported('ClipPath')
export const Mask = vectorUnsupported('Mask')
export const SvgText = vectorUnsupported('Text')

export type SvgProps = Record<string, unknown>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
