// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 间距档位唯一真相源(全端共用:mobile-rn / miniapp-taro / web)。
 *
 * 立因:RN 屏大量写死裸数字(padding:16 / margin:8 / gap:12…),小程序写 rpx 字面量,
 * 两端同一处间距各取一个数,守门 128 对账时批量为「视觉不一致」。缺一个单一真相源的间距档,
 * 页面就不可能「一模一样」。
 *
 * 取值依据:
 *  - 以 4px 为基(对齐 Tailwind 默认 0.25rem 步进 + 本项目几何档的整档习惯)。
 *    2026-10-31 改判:原句"不新造 2/6/10 这类散档"的前提是"web 只用整数步进",实测不成立
 *    —— Tailwind 原生 `.5` 半档 web 大量在用(10/6/2px 三值 6682 处),RN 亦独立同值取用;
 *    表不开这几档,这 2231 处 RN 取值就永远落不了档,"web 调档 ⇒ RN 自动跟随"对它们不成立。
 *    新准入线由 `check-web-rn-style-tiers.mjs` 逐值现算:**两端各自 ≥100 处**同值才进表,
 *    单端散写(实测 RN 13px 313 处 / web 21 处;RN 14px 184 处 / web 3 处)归"落回某档",不进表。
 *  - 语义角色(SPACING_ROLES)只登记有真实取用差异的角色,不得为"看起来全"而虚构。
 *
 * 消费方式(不得自创写法):
 *  - RN / 共享包数值场景 → `rnSpacing.md`(dp 数值,直接喂 StyleSheet)
 *  - 小程序 rpx 场景     → `taroSpacing.md`(已折 2 倍,直接喂 `rpx()`)
 *  - web / Tailwind      → 走 Tailwind 默认间距档(本表步进与其对齐)
 *
 * 新增档位的正确顺序:先在本表落一档(带取值依据)→ 两端同枚提交取用 → 由守门 128 复核。
 * 禁止在端内再写 `const PADDING = 16` 当第二份真相。
 */

/** 档位 → 逻辑 px(与 web 端同一量纲;1 逻辑 px = 2 rpx = 1 dp) */
export const SPACING_STEPS = {
  none: 0,
  /**
   * 半步档 2/6/10(2026-10-31 补,新尺 `check-web-rn-style-tiers.mjs` 量出来的):
   * 原头注写"以 4px 为基、不新造 2/6/10 这类散档",前提是"web 走 Tailwind 0.25rem 整数步进"。
   * **实测前提不成立** —— Tailwind 的 `.5` 半档原生存在且 web 在用:
   *   py-2.5=10px 2353 处、py-0.5=2px 1193 处、gap-1.5=6px 1189 处(web 侧三值合计 6682 处);
   *   RN 侧同一批值也在独立写:paddingHorizontal:10 425 处、gap:6 190 处、paddingVertical:2 104 处。
   * 两端各自成规模取用同一表外值 ⇒ 这不是"某一端写歪",而是**档表缺位**;缺位的直接后果是
   * 这些位置永远落不了档,于是"web 调档 ⇒ RN 自动跟随"在 2231 处 RN 取用上根本不成立。
   * 准入线(与 13px/14px 的分界,由上面那把尺逐值现算):**两端各自 ≥100 处**同值取用才进表。
   * 对照未过线的:RN `fontSize:13` 313 处而 web 仅 21 处、RN `padding:14` 184 处而 web 仅 3 处
   * ⇒ 那两型是单端散写,归"落回某档",**不得**借本轮把散档合法化。
   */
  '2xs': 2,
  /** 极紧:图标与文字间距、分隔线两侧 */
  xs: 4,
  /** 半步档:介于 xs 与 sm(web `gap-1.5` / `px-1.5` 同值) */
  'xs-loose': 6,
  /** 默认组内间距:标签与控件、按钮内边距 */
  sm: 8,
  /** 半步档:介于 sm 与 md(web `py-2.5` / `px-2.5` 同值) */
  'sm-loose': 10,
  /** 相关元素间:卡片内行距、列表项内部 */
  md: 12,
  /** 区块外边距 / 屏幕水平留白 */
  lg: 16,
  /** 区块间距 / 段落分隔 */
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const

/**
 * 语义角色 → 档位(**唯一一处**"这个位置该用哪档间距"的记录)。
 * 与 radius.js 的 RADIUS_ROLES 同构:档位值收口一份,角色映射再收口一份。
 */
export const SPACING_ROLES = {
  /** 图标—文字极紧间距 */
  gapTight: 'xs',
  /** 默认组内间距 */
  gap: 'sm',
  /** 相关元素间宽松间距 */
  gapLoose: 'md',
  /** 纵向堆叠区块间距 */
  stack: 'lg',
  /** 大区块 / 段落间距 */
  section: 'xl',
  /** 屏幕水平留白 */
  pagePadX: 'lg',
  /** 卡片内边距 */
  cardPad: 'lg',
  /** 紧凑卡片内边距 */
  cardPadSm: 'md',
  /** 列表项水平内边距 */
  listItemPadX: 'lg',
  /** 列表项垂直内边距 */
  listItemPadY: 'md',
} as const

/** RN / 共享包侧消费入口:StyleSheet 里写 `padding: rnSpacing.lg` */
export const rnSpacing = SPACING_STEPS

/** 小程序侧消费入口:`rpx(taroSpacing.lg)`,2 倍换算只在这一处发生 */
export const taroSpacing = Object.fromEntries(
  Object.entries(SPACING_STEPS).map(([step, px]) => [step, px * 2]),
) as Record<keyof typeof SPACING_STEPS, number>

/** 角色 → dp 数值(RN 直接消费) */
export const rnSpacingFor = Object.fromEntries(
  Object.entries(SPACING_ROLES).map(([role, step]) => [role, SPACING_STEPS[step]]),
) as Record<keyof typeof SPACING_ROLES, number>

/** 角色 → rpx 数值(小程序直接消费) */
export const taroSpacingFor = Object.fromEntries(
  Object.entries(SPACING_ROLES).map(([role, step]) => [role, SPACING_STEPS[step] * 2]),
) as Record<keyof typeof SPACING_ROLES, number>

export type SpacingStep = keyof typeof SPACING_STEPS
export type SpacingRole = keyof typeof SPACING_ROLES
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
