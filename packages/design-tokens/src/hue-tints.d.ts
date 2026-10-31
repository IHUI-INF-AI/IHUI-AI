// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hue-tints.js 的类型声明(与本包 geometry.d.ts / radius.d.ts 同族约定:纯 JS 落档 + 伴生声明件)。
 * 取值依据与各族漂移的实测成因写在 hue-tints.js 头注。
 */

/** 带前景的色相族(与 hue-tints.js 的 FAMILIES 键一致;守门按单行解析本联合,不得换行拆档) */
export type HueFamily = 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'rose' | 'amber' | 'emerald' | 'orange' | 'slate' | 'zinc' | 'tailwindGray'

/** 只有底档的三族:前景已由语义档承载(rnTokens.text.tertiary / warning.amber)或仓内无消费方 */
export type HueTintOnlyFamily = 'neutral' | 'red' | 'green'

/** 一族的可取档 */
export interface HueEntry {
  /** 该族 -600 前景 */
  fg: string
  /** 该族 -700 前景(plan 域实测取此档) */
  fgStrong?: string
  /** 该族 -500 圆点/墨迹 */
  dot?: string
  /** -500 通道 + alpha 0.10 */
  tint: string
  /** -500 通道 + alpha 0.12 */
  tintStrong: string
}

/** 纯底档族:没有 fg —— 消费表若标注 `fg: string` 会当场编不过,那是诚实的拦法 */
export interface HueTintOnlyEntry {
  tint: string
  tintStrong: string
}

/** 展平后的消费入口:`rnHue.emerald.fg` / `rnHue.emerald.tint` */
export declare const rnHue: Record<HueFamily, HueEntry>

/** 纯底档族入口:`rnHueTintOnly.red.tintStrong` */
export declare const rnHueTintOnly: Record<HueTintOnlyFamily, HueTintOnlyEntry>

/** 带前景族名清单(驱动"每族都必须有消费方"这类对账时用) */
export declare function hueFamilies(): HueFamily[]

/** 纯底档族名清单 */
export declare function hueTintOnlyFamilies(): HueTintOnlyFamily[]

/** 函数形态:族名来自变量时用,两型都认 */
export declare function hueTint(name: HueFamily | HueTintOnlyFamily): string

/** 函数形态,强档 */
export declare function hueTintStrong(name: HueFamily | HueTintOnlyFamily): string
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
