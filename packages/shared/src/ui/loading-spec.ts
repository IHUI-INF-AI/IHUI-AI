// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loading 的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 为什么不是"一份 JSX 两端跑":小程序端的转圈是一枚 CSS 环(w/h + border + rounded + animate-spin),
 * RN 端的转圈是原生 ActivityIndicator(字形尺寸由平台控件决定,Android 不认数值档)。
 * 两端能在同一档上对齐的是**它占的盒子**与**文字/留白**,所以数字只写在本文件里,
 * 端内只做"单位换算 + 挂自己的原语"。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/loading-spec`(禁挂根桶,根桶会把整棵 src/chat 拉进被检程序)。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 转圈盒子 32:小程序端现档 `w-8 h-8` = 32px。RN 端没有对应的数字档(原生控件),
 * 用它包一层同档盒子,使两端的这一行高度由同一个数决定。
 */
export const LOADING_SPINNER_PX = 32

/** 说明文字 14:两端现值已同(小程序 `text-sm` / RN `fontSize: 14`),收进一处只为不再分叉。 */
export const LOADING_LABEL_FONT_PX = 14

/** 转圈与文字之间 8:小程序 `mt-2` = 8 vs RN `gap: 12` —— 取紧凑档(AGENTS.md §4 compact)。 */
export const LOADING_LABEL_GAP_PX = 8

/** 内联态上下留白 24:小程序 `py-8` = 32 vs RN `paddingVertical: 24` —— 同上取紧凑档。 */
export const LOADING_INLINE_PADDING_Y_PX = 24

/**
 * 内联态左右留白 16:此前 RN `paddingHorizontal: 16` 是端内独有一档、小程序内联态无横向留白。
 * 规则 2「间距取两端较大者」→ 定 16 并两端的内联容器同取,不再一端有档一端没有。
 */
export const LOADING_INLINE_PADDING_X_PX = 16

/** 原生指示器不进布局档,但占位盒必须同档:居中原语只在这一处排。 */
export function loadingSpinnerBoxStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  width: U
  height: U
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
} {
  return {
    width: toUnit(LOADING_SPINNER_PX),
    height: toUnit(LOADING_SPINNER_PX),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
