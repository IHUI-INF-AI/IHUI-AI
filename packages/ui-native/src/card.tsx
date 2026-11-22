// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cn } from '@ihui/design-tokens'
import {
  CARD_CONTENT_PADDING_PX,
  CARD_FOOTER_GAP_PX,
  CARD_HEADER_GAP_PX,
  CARD_PADDING_PX,
  CARD_RADIUS_TIER,
} from '@ihui/shared/ui/card-spec'

/**
 * 平台专属项(不下沉 card-spec,两端允许不同形,逐条登记):
 *  - 类名字面量:必须留在本文件 —— nativewind 只扫本包源,spec 文件不在扫描面内,拼串产不出规则。
 *  ⇒ 取值档一律取自 card-spec,本文件只做"档 → 本端承载类"的映射。
 *
 * 2026-11-23 用户定档:卡片容器静息不画描边,只保留 `bg-card` 表面填充
 * (原 `border border-border` 已移除;页面底 surface.bg 与卡片 surface.card 的色差负责分层)。
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
      className={cn('bg-card', RADIUS_CLASS[CARD_RADIUS_TIER], className)}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
