// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserInfoCard 用户信息卡的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:apps/miniapp-taro/src/components/UserInfoCard.tsx ↔
 * apps/mobile-rn/src/components/UserInfoCard.tsx(variant='new')。
 * (packages/app/src/components/UserInfoCard.tsx 与 features/cards 下的是 DOM/共享副本,
 *  App 屏幕实际渲染的是 mobile-rn 那份,本表只对这两条腿生效。)
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/user-info-card-spec`(禁挂根桶)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决规则:1 取 web(卡片内边距 web 端 `p-3` = 12);2 取触控与可读更稳的一档
 * (头像可点 → ≥44,徽章/成长值字号原小程序 10px、RN 11px 均低于 12 下限 → 收口 12,
 *  间距取两端较大者);3 平台机制差异见文件末。圆角与色档不在本表射程(守门 77 / 93 各管一段)。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/** 卡片内边距 12:web 端 UserInfoCard 就是 `p-3` = 12,规则 1 取 web;RN 端原 8 收口到 12。 */
export const USER_INFO_CARD_PADDING_PX = 12

/** 头像与信息列间距 12:两端现值已同(小程序 `gap-3` / RN `marginLeft: 12`),收一处防分叉。 */
export const USER_INFO_CARD_HEADER_GAP_PX = 12

/**
 * 头像边长 48:小程序 `w-12` = 48 是 Tailwind 整档且 ≥44 命中块下限;
 * RN 端原 `rpx(163)` ≈ 81.5 是从 Uniapp 旧稿换算来的非整档(注释自认"对齐旧项目"),规则 2 收口到 48。
 */
export const USER_INFO_CARD_AVATAR_PX = 48

/** 昵称字号 14:取与小程序/web 一致的正文档(规则 2 可读下限 12 之上,§4 compact);RN 端原 18 收口到 14。 */
export const USER_INFO_CARD_NAME_FONT_PX = 14

/** 小字档 12(角色/等级徽章、成长值标注、操作按钮文字):原小程序 10px、RN 11px 均低于 12,规则 2 取可读下限。 */
export const USER_INFO_CARD_SMALL_FONT_PX = 12

/** 徽章左右内边距 8:取两端较大者(小程序 `px-1.5` = 6 vs RN 8)。 */
export const USER_INFO_CARD_BADGE_PADDING_X_PX = 8

/** 徽章上下内边距 2:两端现值已同(`py-0.5` / `paddingVertical: 2`)。 */
export const USER_INFO_CARD_BADGE_PADDING_Y_PX = 2

/** 智汇值字号 12:两端现值已同(小程序 `text-xs` / RN 12)。 */
export const USER_INFO_CARD_TOKEN_FONT_PX = 12

/** 行与上一行的间距 8:取两端较大者(小程序 `mt-2` = 8 vs RN `marginTop: 6` 的等级行,统一 8)。 */
export const USER_INFO_CARD_ROW_MARGIN_TOP_PX = 8

/** 操作按钮(开通会员/退订/充值)左右内边距 12:取两端较大者(小程序 `px-3` = 12 vs RN 10)。 */
export const USER_INFO_CARD_ACTION_PADDING_X_PX = 12

/** 操作按钮上下内边距 4:两端现值已同(`py-1` / `paddingVertical: 4`)。 */
export const USER_INFO_CARD_ACTION_PADDING_Y_PX = 4

/** 未登录态「一键登录」文字 16:取两端较大者(RN 16 vs 小程序 `text-sm` = 14)。 */
export const USER_INFO_CARD_LOGIN_FONT_PX = 16

/** 头像盒子(方档 + overflow hidden 兜底裁切),居中结构只在这一处。 */
export function userInfoCardAvatarStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  width: U
  height: U
  overflow: 'hidden'
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
  flexShrink: 0
} {
  const side = toUnit(USER_INFO_CARD_AVATAR_PX)
  return {
    width: side,
    height: side,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

/**
 * 本族的平台机制差异登记(数值对齐、通道各端保留;台账 waivers 用):
 *  1. 未登录按钮形态:小程序端全宽条(`w-full py-3`),RN 端胶囊 inline —— 布局机制差异,
 *     文字档已同收 16;容器宽度不强行对齐。
 *  2. VIP 徽标:小程序端是远程图片徽标(h-4 w-10),RN 端是文字徽章 —— 素材体系差异,非数值档。
 *  3. 等级弹窗/邀请码行仅 RN 端存在(小程序端由页面自持弹层),单侧结构不进本表。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
