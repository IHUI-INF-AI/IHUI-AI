// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Text, View } from '@tarojs/components'
import { cn, type VipBadgeBaseProps } from '@ihui/design-tokens'
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
 * VIP 徽章 —— 与 `packages/ui-native/src/vip-badge.tsx` 逐类对齐(「一模一样」契约)。
 *
 * API 1:1 复用 `@ihui/design-tokens` 的 `VipBadgeBaseProps`(size 'sm'|'md' + label,两端一致),
 * 默认值也同源自 `VIP_BADGE_DEFAULT_SIZE` / `VIP_BADGE_DEFAULT_LABEL`(端内不再手写 'sm'/'VIP')。
 * **取值档一律取自 `@ihui/shared/ui/vip-badge-spec`**,下面的「档 → 本端承载类」映射与 RN 壳逐字相等
 * (由 `scripts/gen-ui-mirror.mjs` 派生复核)⇒ 同一档位不可能在两端长出两种内边距/间隙/字号。
 *
 * 与 RN 的分歧(规则6 承载差异,逐条登记):
 * - 琥珀色:RN 走 `bg-amber-500/10` + `text-amber-600` 类;共享 preset 只含语义色、未含 Tailwind
 *   默认 amber 调色板(改 preset 会动正在飞的 design-tokens 包),本端改用与之等价的 rgba 内联
 *   (amber-500 #f59e0b @10% / amber-600 #d97706)。后续把 amber 收进共享 preset 后改回类名;
 * - `flex`:weapp 无「默认 flex 容器」语义,须显式给 display 档(`flex flex-row`),RN 侧 `flex-row` 即够。
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

/** 本端颜色承载(见上文规则6 登记):与 RN 的 amber 类等价的内联色值,单文件收口。 */
const AMBER_BG = 'rgba(245, 158, 11, 0.1)' // amber-500 @ 10%
const AMBER_FG = '#d97706' // amber-600

export function VipBadge({
  size = VIP_BADGE_DEFAULT_SIZE,
  label = VIP_BADGE_DEFAULT_LABEL,
}: VipBadgeBaseProps) {
  return (
    <View
      className={cn(
        'flex flex-row items-center',
        RADIUS_CLASS[VIP_BADGE_RADIUS_TIER],
        SIZING_CLASS[size],
      )}
      style={{ backgroundColor: AMBER_BG }}
    >
      <Text
        className={cn('font-medium', TEXT_CLASS[VIP_BADGE_TEXT_TIER])}
        style={{ color: AMBER_FG }}
      >
        {label}
      </Text>
    </View>
  )
}

export default VipBadge
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
