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
import Taro from '@tarojs/taro'

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

/**
 * RN 的「轴向简写」→ 物理两向展开。
 *
 * 为什么必须展开(2026-11-14 实测取证,不是推测):
 *   RN 的 `paddingHorizontal` / `paddingVertical` / `marginHorizontal` / `marginVertical`
 *   是 **RN 自有属性**,CSS 里根本不存在 `padding-horizontal` 这种键(没有 `-horizontal`
 *   / `-vertical` 作轴向后缀的 CSS 属性)。此前逐键原样透传,weapp 的 webview 遇到未知
 *   属性整条丢弃 ⇒ 共享屏在小程序端**所有轴向内/外边距静默消失**,且不报任何错。
 *
 * 取证链(可复现):
 *   1. `toTaroStyle({paddingHorizontal:16})` 实跑返回 `{paddingHorizontal:'16px'}`(旧行为);
 *   2. `grep -r paddingHorizontal apps/miniapp-taro/node_modules/@tarojs/` 命中 **0**
 *      —— Taro 运行时不认识这个键,不存在任何 RN 式兼容映射;
 *   3. 产物 `dist/*.js` 里该键原样保留(`stateBtn:{…,paddingHorizontal:…,paddingVertical:9}`),
 *      说明构建期也没有转译插件。
 *
 * 用量(packages/app/src + packages/ui-native/src 现读):paddingHorizontal 1602、
 * paddingVertical 1392、marginHorizontal 106、marginVertical 19 —— 这不是边角料。
 *
 * 顺序语义与 RN/Yoga 一致:展开写在原键所在位置,后出现的显式 `paddingLeft` 覆盖它,
 * 反之被它覆盖(与 RN 依对象键序逐次写入 Yoga 的行为同构)。
 */
const RN_AXIS_SHORTHAND: Readonly<Record<string, readonly [string, string]>> = {
  paddingHorizontal: ['paddingLeft', 'paddingRight'],
  paddingVertical: ['paddingTop', 'paddingBottom'],
  marginHorizontal: ['marginLeft', 'marginRight'],
  marginVertical: ['marginTop', 'marginBottom'],
}

/** 把 RN 的 shadowOpacity 折进颜色(CSS box-shadow 没有独立 alpha 通道) */
function withAlpha(color: string | undefined, opacity: number | undefined): string {
  const alpha = opacity === undefined ? 1 : Math.max(0, Math.min(1, opacity))
  const base = color ?? '#000000'
  // 命中的分组一律先取进具名变量再用:开 noUncheckedIndexedAccess 时 `hex[1]` 的类型是
  // string | undefined,直接在模板里链式 slice/相加会整片报 TS2532(2026-10-26 现读 9 处即此型)
  const six = /^#([0-9a-f]{6})$/i.exec(base)?.[1]
  if (six)
    return `rgba(${parseInt(six.slice(0, 2), 16)},${parseInt(six.slice(2, 4), 16)},${parseInt(six.slice(4, 6), 16)},${alpha})`
  const three = /^#([0-9a-f]{3})$/i.exec(base)?.[1]
  if (three) {
    // 用 charAt 而不是 three[i]:charAt 恒返回 string,而字符串下标在 noUncheckedIndexedAccess
    // 下是 string | undefined —— 长度已经正则证过也照样报 TS2532(尺子不继承我们的推理)
    const r = parseInt(three.charAt(0) + three.charAt(0), 16)
    const g = parseInt(three.charAt(1) + three.charAt(1), 16)
    const b = parseInt(three.charAt(2) + three.charAt(2), 16)
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
 * 逐键转译:数字补 px、轴向简写摊成物理两向、transform 归串、shadow 归 box-shadow、
 * numberOfLines 归 line-clamp、RN 专有键(非 CSS)丢弃 —— 丢弃即"小程序端不存在该能力",
 * 不是实现漏写。
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
    const axis = RN_AXIS_SHORTHAND[key]
    if (axis) {
      // 数字与字符串(含 rpx / var / calc)一视同仁:轴向简写不改变值的单位口径,
      // 只把"一个键"摊成"两个物理边"。数字走与普通键同一套补 px 规则。
      const expanded = typeof value === 'number' ? `${value}px` : (value as string)
      out[axis[0]] = expanded
      out[axis[1]] = expanded
      continue
    }
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
  /**
   * RN 的 `StyleSheet.hairlineWidth` = 设备物理 1px 的逻辑值(iOS/Android 都按 pixelRatio 折算)。
   * 本层用同一算式现算,而不是写死 1:写死会在 2x/3x 屏上把"1 物理像素描边"画成 2~3 像素粗,
   * 分隔线当场变粗一档。取不到 pixelRatio(旧基线/非端内环境)时退 1,与 RN 的兜底同值。
   * 这是本文件唯一的几何型取值 —— 其余仍是纯转译,不改任何尺寸。
   */
  get hairlineWidth(): number {
    try {
      return 1 / (Taro.getSystemInfoSync().pixelRatio || 1)
    } catch {
      return 1
    }
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
/**
 * 具名键补 `color`:索引签名下 `.color` 读出来是 unknown,共享层把
 * `styles.x.color` 交给 lucide 的 `color?: string`(ListPager.tsx:50/71)就成 TS2322。
 * 交集只收窄这一格,其它键仍是索引签名,Rn 侧写法的宽面不变。
 */
export type TextStyle = Record<string, unknown> & { color?: string }
export type ImageStyle = Record<string, unknown>
/**
 * 与 RN 的 `StyleProp<T>` 同形:**递归**数组与 falsy 都要收。
 * 2026-11-01:此前写成 `T | T[]`,只认一层数组;而 RN 侧写法常是
 * `style={[a, cond && b, [c]]}`(嵌套数组)—— 跨端共享包(packages/app / ui-native)
 * 在小程序宿主下因此成片 TS2322。递归化只是把类型面补齐,没有放宽键检查
 * (元素仍必须是 T)。RN 的 `RegisteredStyle<number>` 一支不收:Taro 没有注册表式样式位。
 * 2026-11-01 再补一支 `object`:`style={[styles.pressCard, style]}` 里调用方把 style 声明成
 * `object`(ScreenStates 的 PressableCard 就是),而 `ViewStyle` 是 `Record<string, unknown>`,
 * `object` 不带索引签名 ⇒ 整条数组在断言点 TS2322。收 `object` 只放行"样式形态",不放宽任何键检查。
 */
export type StyleProp<T> = T | object | false | null | undefined | ReadonlyArray<StyleProp<T>>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
