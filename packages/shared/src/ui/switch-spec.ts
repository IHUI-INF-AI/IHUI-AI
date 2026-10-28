// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 本文件为 Switch 族的「结构与几何单一源」(web 薄壳与 RN 薄壳共用),形状照 card-spec。

/**
 * Switch 族的结构与几何单一源(web 薄壳与 RN 薄壳共用),形状照 card-spec / input-spec。
 *
 * 两端真实实现坐标:
 *  - web 端 = packages/ui-react/src/components/switch.tsx(Radix SwitchPrimitive,Neo-Brutalist 定制:
 *    硬偏移投影 3px、1.5px 前景框、brand-accent ON 底色、按下位移 2px);
 *  - RN 端  = packages/ui-native/src/switch.tsx(本票前为 RN 原生 Switch 薄包、无规格、零对齐;
 *    本票改为自绘 Pressable + Animated 拇指,几何/尺寸/圆角/位移全部取本表,与 web 逐像素对齐)。
 *
 * 本表只存**取值档**(逻辑 px + 圆角档名),不存承载形式;承载类名/样式表留在两端薄壳里。
 * 代价:两端壳必须把本表的每一个导出常量都接走并真用 —— 挂了常量却没人消费就是"造好没装车"。
 *
 * 颜色(规则6:机制/取值分叉,逐条登记 —— 允许不同形,**不下沉**):
 *  - ON 底色 token 名 = `brand-accent`(SWITCH_ON_BG_TOKEN):web 走 `bg-[var(--color-brand-accent)]`,
 *    RN 走 nativewind `bg-brand-accent`,值同源 rn-tokens.brandAccent / tokens.css --color-brand-accent;
 *  - 框色 = `foreground`、硬投影色 = `foreground`:web 走 CSS 变量,RN 走 style.shadowColor(明暗自适应);
 *  - 这些色值是 token 消费不是几何档 ⇒ 按规则6 留在端内,搬进 spec 会脱离 Tailwind / nativewind 扫描面。
 *
 * 圆角**只给档名不给 px**:px 归 packages/design-tokens/src/radius.js 的 RADIUS_STEPS 单源;
 * 本表只记"轨道/拇指取哪一档",两端各自把档名映射成本端承载类名
 * (web/RN 同义:track=rounded-md / thumb=rounded-sm)。
 *
 * 消费方式:子路径 `@ihui/shared/ui/switch-spec`(禁挂根桶:同 card-spec,根桶会把整棵 src 拉进被检程序)。
 * spec 内只存逻辑 px;web 端 1:1(CSS px),RN 端 1:1(逻辑 pt)。
 *
 * 裁定规则(同 O81 票④):
 *  - 规则1 两端现值已同,收一处防再分叉;
 *  - 规则2 同义不同值取 compact 较小档(本族 web 定稿即两端基准);
 *  - 规则6 平台承载机制差异(web 用 Radix data-[state] + active:,RN 用 Animated + style 投影)→ 允许不同形,注明理由。
 */

/** 尺寸档集合(类型级键约束:spec 增档而某端没接 ⇒ tsc 红)。 */
export const SWITCH_SIZE_TIERS = ['sm', 'md', 'lg'] as const
export type SwitchSizeTier = (typeof SWITCH_SIZE_TIERS)[number]

/** 轨道宽度(逻辑 px):web `w-9/w-11/w-[52px]` = 36/44/52。 */
export const SWITCH_TRACK_W_PX: Record<SwitchSizeTier, number> = { sm: 36, md: 44, lg: 52 }

/** 轨道高度(逻辑 px):web `h-5/h-6/h-7` = 20/24/28。 */
export const SWITCH_TRACK_H_PX: Record<SwitchSizeTier, number> = { sm: 20, md: 24, lg: 28 }

/** 轨道内边距(逻辑 px):web `p-[3px]` = 3。 */
export const SWITCH_TRACK_PADDING_PX = 3

/** 轨道边框宽(逻辑 px):web `border-[1.5px]` = 1.5。 */
export const SWITCH_TRACK_BORDER_W_PX = 1.5

/** 轨道圆角档名:web `rounded-md`(6px),方形圆角(Neo-Brutalist)。 */
export const SWITCH_TRACK_RADIUS_TIER = 'md'

/** 拇指尺寸(逻辑 px):web `h-3 w-3 / h-4 w-4 / h-5 w-5` = 12/16/20。 */
export const SWITCH_THUMB_SIZE_PX: Record<SwitchSizeTier, number> = { sm: 12, md: 16, lg: 20 }

/** 拇指圆角档名:web `rounded-sm`(3px)。 */
export const SWITCH_THUMB_RADIUS_TIER = 'sm'

/**
 * 拇指 ON 态位移(逻辑 px = 轨道宽 − 2×边框 − 2×内边距 − 拇指宽):
 * sm 36−3−3−12=18? 取 web 实定值 15(md 19 / lg 23,web 为留 1.5px 双边视觉余量而定)。
 * 两端共用此值驱动位移(web `translate-x-[Npx]` / RN Animated translateX)。
 */
export const SWITCH_THUMB_TRANSLATE_X_PX: Record<SwitchSizeTier, number> = {
  sm: 15,
  md: 19,
  lg: 23,
}

/** ON 底色 token 名(两端各自映射:web `bg-[var(--color-brand-accent)]` / RN `bg-brand-accent`)。 */
export const SWITCH_ON_BG_TOKEN = 'brand-accent'

/** 默认尺寸档。 */
export const SWITCH_DEFAULT_SIZE: SwitchSizeTier = 'md'
