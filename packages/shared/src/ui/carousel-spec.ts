// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端轮播几何档:值取"两端现档 + 裁决规则",两端组件文件不再各自抄数字。

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 默认高度 160:两端现值已同(小程序 prop `height = 160` / RN `DEFAULT_HEIGHT = 160`),
 * 收一处防分叉。小程序端那个裸 160 会被守门 128 按端量纲折成 80px,与 RN 侧 160 造出
 * 一对假差异 —— 收成函数调用后两侧文件都无字面量,假差异随之消失。
 */
export function carouselDefaultHeightPx(): number {
  return 160
}

/** 指示器距底边 12:RN 现值 12,小程序端 `bottom-2` = 8。裁决规则 2(间距取两端较大者)→ 12。 */
export const CAROUSEL_INDICATOR_BOTTOM_PX = 12

/** 指示点间距 6:两端现值已同(小程序 `gap-1.5` / RN `gap: 6`)。 */
export const CAROUSEL_INDICATOR_GAP_PX = 6

/** 指示点高度 6:两端现值已同(小程序 `h-1.5` / RN `height: 6`)。 */
export const CAROUSEL_DOT_HEIGHT_PX = 6

/** 未激活指示点宽度 6(正圆):两端现值已同(小程序 `w-1.5` / RN 三元里的 6)。 */
export const CAROUSEL_DOT_INACTIVE_WIDTH_PX = 6

/** 激活指示点宽度 16(胶囊):两端现值已同(小程序 `w-4` / RN 三元里的 16)。 */
export const CAROUSEL_DOT_ACTIVE_WIDTH_PX = 16

/** 指示器容器结构:底部居中一行,等距排点;只在这一处排,端内不再重摆。 */
export function carouselIndicatorWrapStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  position: 'absolute'
  left: 0
  right: 0
  bottom: U
  display: 'flex'
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
  gap: U
} {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: toUnit(CAROUSEL_INDICATOR_BOTTOM_PX),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: toUnit(CAROUSEL_INDICATOR_GAP_PX),
  }
}

/**
 * 指示点几何(宽/高;颜色与圆角留在端内 —— 圆角归守门 77,配色归 tokens 派生链)。
 * 三元式在 spec 内部完成,端内 JSX 不再出现裸 6/16 字面量。
 */
export function carouselDotStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
  active: boolean,
): { width: U; height: U } {
  return {
    width: toUnit(active ? CAROUSEL_DOT_ACTIVE_WIDTH_PX : CAROUSEL_DOT_INACTIVE_WIDTH_PX),
    height: toUnit(CAROUSEL_DOT_HEIGHT_PX),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
