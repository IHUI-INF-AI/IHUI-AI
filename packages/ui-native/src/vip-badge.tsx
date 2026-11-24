// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Text, View } from 'react-native'
import { type VipBadgeBaseProps } from '@ihui/design-tokens'
import {
  VIP_BADGE_DEFAULT_LABEL,
  VIP_BADGE_DEFAULT_SIZE,
  VIP_BADGE_MD_GAP_PX,
  VIP_BADGE_MD_PADDING_X_PX,
  VIP_BADGE_MD_PADDING_Y_PX,
  VIP_BADGE_RADIUS_TIER,
  type VIP_BADGE_SIZE_TIERS,
  VIP_BADGE_SM_GAP_PX,
  VIP_BADGE_SM_PADDING_X_PX,
  VIP_BADGE_SM_PADDING_Y_PX,
  VIP_BADGE_TEXT_TIER,
} from '@ihui/shared/ui/vip-badge-spec'

/**
 * 平台专属项(不下沉 vip-badge-spec,两端允许不同形,逐条登记):
 *  - 无 lucide `Crown` 图标:RN 端不引 lucide,图标走另一套通道;
 *  - 无 `dark:text-amber-500`:RN 端无 `dark:` 通道;
 *  - `flex-row`:web 的同义写法是 `inline-flex`;
 *  - 不收 `className` 入参(web 端收);
 *  - 琥珀色系(`bg-amber-500/10` / `text-amber-600`)与 `font-medium` 虽两端同值,但色值/字重是
 *    token 消费不是几何档 ⇒ 按规则6 留在端内,搬进 spec 会脱离 nativewind 扫描面。
 *  ⇒ 取值档一律取自 vip-badge-spec,本文件只做"档 → 本端承载类"的映射。
 *
 * 本族两端**现值零差异**(sizing 串逐字相同),下沉的是**回归锁**而非裁定结果:
 * 现在零差异不等于永远零差异,端内写死字面量即断链,由 vip-badge-wiring 判据判红。
 */
const RADIUS_CLASS: Record<typeof VIP_BADGE_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 8: 'px-2', 10: 'px-2.5' }
const PADDING_Y_CLASS: Record<number, string> = { 2: 'py-0.5', 4: 'py-1' }
const GAP_CLASS: Record<number, string> = { 2: 'gap-0.5', 4: 'gap-1' }
const TEXT_CLASS: Record<typeof VIP_BADGE_TEXT_TIER, string> = { xs: 'text-xs' }

/** 档名集合的消费形态:**类型级**键约束 —— spec 增档而本端没给类名 ⇒ tsc 直接红。 */
const SIZING_CLASS: Record<(typeof VIP_BADGE_SIZE_TIERS)[number], string> = {
  sm: [
    PADDING_X_CLASS[VIP_BADGE_SM_PADDING_X_PX],
    PADDING_Y_CLASS[VIP_BADGE_SM_PADDING_Y_PX],
    TEXT_CLASS[VIP_BADGE_TEXT_TIER],
    GAP_CLASS[VIP_BADGE_SM_GAP_PX],
  ].join(' '),
  md: [
    PADDING_X_CLASS[VIP_BADGE_MD_PADDING_X_PX],
    PADDING_Y_CLASS[VIP_BADGE_MD_PADDING_Y_PX],
    TEXT_CLASS[VIP_BADGE_TEXT_TIER],
    GAP_CLASS[VIP_BADGE_MD_GAP_PX],
  ].join(' '),
}

export function VipBadge({
  size = VIP_BADGE_DEFAULT_SIZE,
  label = VIP_BADGE_DEFAULT_LABEL,
}: VipBadgeBaseProps) {
  return (
    <View
      className={`flex-row items-center bg-amber-500/10 ${RADIUS_CLASS[VIP_BADGE_RADIUS_TIER]} ${SIZING_CLASS[size]}`}
    >
      <Text className={`font-medium text-amber-600 ${TEXT_CLASS[VIP_BADGE_TEXT_TIER]}`}>
        {label}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
