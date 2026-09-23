// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 圆角档位唯一真相源(全端共用:web / miniapp-taro / mobile-rn / packages-app /
 * desktop / extension / cli / ui-react / ui-native)。
 *
 * 消费方式:
 *  - Tailwind v3 端(mobile-rn NativeWind / miniapp-taro)→ tailwind-preset.js 取 RADIUS_REM
 *  - JS 数值场景(RN StyleSheet.create、各端内联 style)→ 取 rnRadius(px 数值)
 *  - web(Tailwind v4 @theme)/ CSS 端 → 写 var(--radius-*),其值由
 *    scripts/check-radius-single-source.mjs 与本表逐档对账(CSS 无法 import JS,故以守门保同源)
 *
 * 档位值与 web(Tailwind v4 + packages/design-tokens/src/styles/tokens.css 的 --radius-*)
 * 逐档同值。两处历史漂移已在本表收口:
 *  1. v3 preset 曾把 sm 定义成 2px(Tailwind v3 默认),而 web v4 的 sm=4px —— 同名不同值,
 *     即"同名类跨端圆角不一致"的根因;现 sm=4px,2px 由 xs 承载。
 *  2. web tokens.css 显式 --radius: 0.5rem(裸 rounded=8px,注释自述与 --radius-lg 同值),
 *     而 v3 端裸 rounded 走 Tailwind 默认 4px;现统一 DEFAULT=8px 与 web 对齐。
 *
 * 改档位只需改本表的 RADIUS_STEPS 一处。
 */

/** 档位 → px 数值(RN StyleSheet / 内联 style 直接消费) */
export const RADIUS_STEPS = {
  xs: 2,
  sm: 4,
  /** 裸 rounded / rounded-none 之外的默认档,与 lg 同值(对齐 web --radius: 0.5rem) */
  DEFAULT: 8,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
}

/** 档位 → rem 字符串(Tailwind theme.borderRadius 消费;1rem = 16px) */
export const RADIUS_REM = Object.fromEntries(
  Object.entries(RADIUS_STEPS).map(([step, px]) => [step, `${px / 16}rem`]),
)

/** 档位 → 该档对应的 CSS 变量名(CSS 端引用形式,守门与迁移脚本共用) */
export const RADIUS_CSS_VAR = {
  xs: '--radius-xs',
  sm: '--radius-sm',
  DEFAULT: '--radius',
  md: '--radius-md',
  lg: '--radius-lg',
  xl: '--radius-xl',
  '2xl': '--radius-2xl',
}

/** RN / JS 侧消费入口:StyleSheet.create 里写 borderRadius: rnRadius.lg */
export const rnRadius = RADIUS_STEPS

/** 档位取值集合(px),供守门判定 */
export const RADIUS_SCALE_PX = [...new Set(Object.values(RADIUS_STEPS))].sort((a, b) => a - b)

/**
 * rpx(750 设计稿半单位)→ 档位名。历史代码大量写 rounded-[24rpx] / rpx(16),
 * 迁移时用它换算成档位,而不是继续保留换算表达式。
 */
export function rpxToStep(rpx) {
  const px = rpx / 2
  return Object.keys(RADIUS_STEPS).find((step) => RADIUS_STEPS[step] === px) || null
}

/** px → 档位名(唯一精确匹配才返回,不做就近吸附,避免静默改视觉) */
export function pxToStep(px) {
  return Object.keys(RADIUS_STEPS).find((step) => RADIUS_STEPS[step] === Number(px)) || null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
