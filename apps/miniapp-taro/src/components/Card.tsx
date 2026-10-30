// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Text, View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import {
  CARD_CONTENT_PADDING_PX,
  CARD_FOOTER_GAP_PX,
  CARD_HEADER_GAP_PX,
  CARD_PADDING_PX,
  CARD_RADIUS_TIER,
} from '@ihui/shared/ui/card-spec'

/**
 * 卡片组件 —— 与 `packages/ui-native/src/card.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/card-spec`**(与 web 壳、RN 壳同源):改 spec 一处,三端同时跟随
 * —— 这就是「自动同步」的落点。本文件只做「档 → 本端承载类」的映射;**类名字面量必须留在这里**
 * (spec 文件不在 Tailwind / nativewind 的扫描面内,拼串产不出规则)。
 *
 * 结构按 card-spec 的裁定:**内边距由块承载**(CardHeader / CardContent / CardFooter 各块),
 * 卡片根本身不持内边距 —— 与 web 壳同构,RN 壳也已收敛到同一形态。
 * 承载类与换算:
 * - rounded-lg → 圆角 card 档(见 radius.js RADIUS_ROLES.card)
 * - border-border + bg-card → 描边 / 表面色(token,暗色自动翻转)
 * - p-3 / px-3 / pt-3 / pb-3 → spec 的 12px 档(小程序侧 1px→2rpx,12px 即 24rpx,与 RN 的 12dp 等宽)
 * - mb-1.5 / mt-2 → spec 的 6px / 8px 间隙档
 *
 * 跨端差异由门 128 与本族接线判据(`scripts/check-ui-spec-mirror.mjs`)复核。
 */
const RADIUS_CLASS: Record<typeof CARD_RADIUS_TIER, string> = { lg: 'rounded-lg' }
const PADDING_CLASS: Record<number, string> = { 12: 'p-3' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const PADDING_T_CLASS: Record<number, string> = { 12: 'pt-3' }
const PADDING_B_CLASS: Record<number, string> = { 12: 'pb-3' }
const HEADER_GAP_CLASS: Record<number, string> = { 6: 'mb-1.5' }
const FOOTER_GAP_CLASS: Record<number, string> = { 8: 'mt-2' }

export type CardProps = ComponentProps<typeof View>
export type CardTitleProps = ComponentProps<typeof Text>
export type CardDescriptionProps = ComponentProps<typeof Text>

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn('border border-border bg-card', RADIUS_CLASS[CARD_RADIUS_TIER], className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        PADDING_X_CLASS[CARD_PADDING_PX],
        PADDING_T_CLASS[CARD_PADDING_PX],
        HEADER_GAP_CLASS[CARD_HEADER_GAP_PX],
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return <Text className={cn('text-base font-semibold text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <View className={cn(PADDING_CLASS[CARD_CONTENT_PADDING_PX], className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        PADDING_X_CLASS[CARD_PADDING_PX],
        PADDING_B_CLASS[CARD_PADDING_PX],
        FOOTER_GAP_CLASS[CARD_FOOTER_GAP_PX],
        className,
      )}
      {...props}
    />
  )
}

export default Card
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
