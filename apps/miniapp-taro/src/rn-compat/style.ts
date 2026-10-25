// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/style.ts —— RN StyleSheet → 小程序内联样式的唯一转译出口。
 *
 * 为什么存在:`packages/app`(共享屏真相源)用 RN 形态写样式(StyleSheet + 数字 dp),
 * 而小程序只吃 CSS 字符串/对象。本文件是这一格的平台 adapter —— 有了它,共享屏不必
 * 为小程序重写一遍样式(AGENTS §4「一份平台无关组件源 + 平台 adapter」)。
 *
 * 单位口径:RN 的数字是 dp,weapp 的 px 同为逻辑像素 ⇒ 数字按 1:1 落 `Npx`,
 * 与 RN 端物理尺寸等值(不做 rpx 换算:rpx 以 750 设计宽为基准,换算后与 RN 差 2 倍)。
 * 字符串一律原样透传(共享层里的 `var(--color-*)`、`rpx` 依赖这条)。
 */
import type { CSSProperties } from 'react'

/** RN 里按"无单位数字"语义处理的键(加 px 会破坏布局/透明度语义) */
const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'order',
  'fontWeight',
  'aspectRatio',
  'elevation',
  'shadowOpacity',
  'borderStartWidth',
  'borderEndWidth',
  'scale',
])

/** 把 RN 的 shadowOpacity 折进颜色(CSS box-shadow 没有独立 alpha 通道) */
function withAlpha(color: string | undefined, opacity: number | undefined): string {
  const alpha = opacity === undefined ? 1 : Math.max(0, Math.min(1, opacity))
  const base = color ?? '#000000'
  const hex = /^#([0-9a-f]{6})$/i.exec(base)
  if (hex)
    return `rgba(${parseInt(hex[1].slice(0, 2), 16)},${parseInt(hex[1].slice(2, 4), 16)},${parseInt(hex[1].slice(4, 6), 16)},${alpha})`
  if (/^#[0-9a-f]{3}$/i.test(base)) {
    const r = parseInt(base[1] + base[1], 16)
    const g = parseInt(base[2] + base[2], 16)
    const b = parseInt(base[3] + base[3], 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return base
}

/** RN iOS 阴影四件套 → CSS box-shadow 的近似(小程序无原生 shadow* 属性) */
function boxShadowFrom(style: Record<string, unknown>): string | undefined {
  const offset = style.shadowOffset as { width?: number; height?: number } | undefined
  const radius = style.shadowRadius as number | undefined
  const opacity = style.shadowOpacity as number | undefined
  if (radius === undefined && opacity === undefined) return undefined
  const w = offset?.width ?? 0
  const h = offset?.height ?? 0
  return `${w}px ${h}px ${radius ?? 0}px ${withAlpha(style.shadowColor as string | undefined, opacity)}`
}

/** RN transform 数组 → CSS transform 字符串(translate/scale 数字补 px) */
function transformToCss(items: unknown): string | undefined {
  if (!Array.isArray(items)) return undefined
  const UNIT_KEYS = new Set(['translateX', 'translateY', 'translate3d'])
  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return ''
      const [key, raw] = Object.entries(entry)[0] ?? []
      if (!key) return ''
      if (typeof raw === 'number') return UNIT_KEYS.has(key) ? `${key}(${raw}px)` : `${key}(${raw})`
      return `${key}(${raw})`
    })
    .filter(Boolean)
    .join(' ')
}

/** RN `numberOfLines` / `ellipsizeMode` → 多行截断(小程序靠 CSS line-clamp) */
function clampFrom(style: Record<string, unknown>): CSSProperties {
  const lines = style.numberOfLines as number | undefined
  if (!lines || lines <= 0) return {}
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  } as CSSProperties
}

/** 展平 RN 样式(数字档 | 对象 | 数组 | falsy)为一个普通对象 */
export function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {}
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, item) => Object.assign(acc, flattenStyle(item)),
      {},
    )
  }
  if (typeof style === 'object') return style as Record<string, unknown>
  return {}
}

/**
 * RN 样式 → Taro 可消费的内联样式对象。
 * 逐键转译:数字补 px、transform 归串、shadow 归 box-shadow、numberOfLines 归 line-clamp、
 * RN 专有键(非 CSS)丢弃 —— 丢弃即"小程序端不存在该能力",不是实现漏写。
 */
export function toTaroStyle(style: unknown): CSSProperties | undefined {
  const src = flattenStyle(style)
  if (Object.keys(src).length === 0) return undefined
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(src)) {
    if (value === undefined || value === null) continue
    if (key === 'transform') {
      const css = transformToCss(value)
      if (css) out.transform = css
      continue
    }
    if (
      key === 'shadowColor' ||
      key === 'shadowOffset' ||
      key === 'shadowRadius' ||
      key === 'shadowOpacity'
    ) {
      continue // 由下面 box-shadow 统一承接
    }
    if (key === 'elevation') {
      const e = Number(value)
      out.boxShadow = `0 ${Math.round(e / 2)}px ${e}px rgba(0,0,0,0.18)`
      continue
    }
    if (key === 'textShadowOffset' || key === 'textShadowOpacity') continue
    if (key === 'numberOfLines' || key === 'ellipsizeMode') continue
    if (typeof value === 'number') {
      out[key] = UNITLESS.has(key) ? value : `${value}px`
      continue
    }
    out[key] = value as string
  }
  const shadow = boxShadowFrom(src)
  if (shadow && !out.boxShadow) out.boxShadow = shadow
  const tsOffset = src.textShadowOffset as { width?: number; height?: number } | undefined
  if (tsOffset) {
    out.textShadow = `${tsOffset.width ?? 0}px ${tsOffset.height ?? 0}px ${
      (src.textShadowColor as string) ?? 'rgba(0,0,0,0.3)'
    }`
  }
  Object.assign(out, clampFrom(src))
  return out as CSSProperties
}

/**
 * RN `StyleSheet.create` 的替身:原样返回对象(RN 内部也只是把它冻结)。
 * 共享层大量写 `const styles = StyleSheet.create({...})` 再 `styles.x`,保持同形即可。
 */
export const StyleSheet = {
  create<T extends Record<string, Record<string, unknown>>>(styles: T): T {
    return styles
  },
  flatten(style: unknown): Record<string, unknown> {
    return flattenStyle(style)
  },
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as Record<
    string,
    unknown
  >,
  absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as Record<
    string,
    unknown
  >,
}

export type ViewStyle = Record<string, unknown>
export type TextStyle = Record<string, unknown>
export type ImageStyle = Record<string, unknown>
export type StyleProp<T> = T | T[] | false | null | undefined
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
