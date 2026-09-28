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

/**
 * 元素角色 → 档位(**唯一一处**"这个元素该用哪档"的记录)。
 *
 * 为什么必须有它:上面的 RADIUS_STEPS 只把**档位值**收成一份,却从没规定**哪类元素取哪一档**,
 * 于是各端各人按直觉选 —— 实测同一张卡片小程序写 `rounded-lg`(8)、RN 写 `rnRadius.xl`(12),
 * FloatBox 一端 16 一端 8;而守门 77 只判"有没有绕档位表写死数字",两端都规矩引用 token 所以
 * 它一路报绿。跨端同名组件对账门(128)原本又以"圆角归 77 管"为由把圆角整族排除 ——
 * 两台尺子互相指认,这一格此前无人看守。
 *
 * 取值按**文档原意**而不是按档名:docs/UI_GUIDELINES.md §3.1 的角色是绑在 px 上的
 * (极小 2 / 小 4 / 中等 6 / 较大 8 / 大 12 / 特大 16),而 2026-09-23 档位表收口把
 * sm 从 2px 改成 4px、裸 rounded 从 4px 改成 8px,所以照档名抄文档会得到偏移一档的错值
 * —— 那两行文档像素现已随本表更正。
 *
 * 只登记有真实取用差异的角色,不得为"看起来全"而虚构角色;新角色必须同时有消费方。
 */
export const RADIUS_ROLES = {
  /** 极小元素:标签内角、计数点 */
  tiny: 'xs',
  /** 小元素:按钮、输入框 */
  control: 'sm',
  /** 中等元素:导航项、chip */
  chip: 'md',
  /** 较大元素:卡片、下拉(2026-09-27 用户定档:卡片一律此档,不取 xl) */
  card: 'lg',
  /** 大容器:面板、弹窗、抽屉、底部弹层 */
  panel: 'xl',
  /**
   * 轻量浮层:右键菜单 / tooltip / 菜单弹层(2026-09-28 票㉘ 单列)。
   * 它**不是** panel —— 一个 160px 宽的右键菜单套 12px 圆角会变成卡片;
   * 也**不是**"下拉列表":§3.1 早已把"下拉"定在 card 档,这一档只管贴锚点的小浮层。
   * 档位值 md 是表内既有档,不引入新数字。
   */
  popover: 'md',
  /**
   * 聊天气泡(2026-09-28 票㉘ 单列):它既不是卡片也不是控件 —— 两端会话流里成排出现的
   * 消息盒实测都是 2xl,把它并进 card 等于把聊天界面重新设计一遍。
   * 档位值 2xl 与 hero 同值,是"给它一个正确的名字",不是新增档。
   */
  bubble: '2xl',
  /** 特大容器:主卡片 */
  hero: '2xl',
}

/** 角色 → px 数值(RN StyleSheet / 内联 style 直接按角色取档) */
export const rnRadiusFor = Object.fromEntries(
  Object.entries(RADIUS_ROLES).map(([role, step]) => [role, RADIUS_STEPS[step]]),
)

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

/**
 * 生成「独立 HTML / 注入式 CSS 字符串」时用的档位表达式(cli 分享页、设计模板、扩展 content script
 * 这类拿不到应用 :root 的场合)。用法是模板字面量插值,值仍来自本表,不得再抄一份数字:
 *   `border-radius: ${RADIUS_CSS_PX.md};`
 */
export const RADIUS_CSS_PX = Object.fromEntries(
  Object.entries(RADIUS_STEPS).map(([step, px]) => [step, `${px}px`]),
)

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
