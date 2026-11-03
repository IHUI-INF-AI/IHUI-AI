// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, type BadgeBaseProps } from '@ihui/design-tokens'
import {
  BADGE_DEFAULT_VARIANT,
  BADGE_PADDING_X_PX,
  BADGE_PADDING_Y_PX,
  BADGE_RADIUS_TIER,
  BADGE_TEXT_TIER,
  type BADGE_VARIANT_TIERS,
} from '@ihui/shared/ui/badge-spec'

/**
 * 平台专属项(不下沉 badge-spec,两端允许不同形,逐条登记):
 *  - `border border-border` / `bg-transparent`(outline 档):nativewind 不继承 web tokens 的边框默认色,
 *    RN 只在 outline 档显式给边框色类;web 是 base 带 `border` + 各档 `border-transparent`;
 *  - `accessibilityRole` / `accessibilityLabel`:RN 无障碍通道,web 走 div 语义 + focus-ring;
 *  - `flex-row`:web 的同义写法是 `inline-flex`;
 *  - 无 hover / focus 前缀:RN 端没有 CSS :hover / :focus 通道 ⇒ web 的各档 hover 态、
 *    transition-colors、focus:ring-* 都不在本端出现;
 *  - 类名字面量:必须留在本文件 —— nativewind 只扫本包源,spec 文件不在扫描面内,拼串产不出规则。
 *  ⇒ 取值档一律取自 badge-spec,本文件只做"档 → 本端承载类"的映射。
 *
 * ⚠️ `default` 档**色值两端不同**(RN `bg-primary / text-primary-foreground` vs
 * web `bg-cta / text-cta-foreground`):按规则6 允许不同形,**色值不下沉**,待机主定档;
 * 下沉的是**四档的档名集合**(BADGE_VARIANT_TIERS)—— 缺档才是真缺口。
 */
const RADIUS_CLASS: Record<typeof BADGE_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 10: 'px-2.5' }
const PADDING_Y_CLASS: Record<number, string> = { 2: 'py-0.5' }
const TEXT_CLASS: Record<typeof BADGE_TEXT_TIER, string> = { xs: 'text-xs' }

/** 档名集合的消费形态:**类型级**键约束 —— spec 增档而本端没给类名 ⇒ tsc 直接红。 */
const VARIANT_CLASS: Record<(typeof BADGE_VARIANT_TIERS)[number], string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  destructive: 'bg-destructive',
  outline: 'border border-border bg-transparent',
}

const badgeTextVariants: Record<(typeof BADGE_VARIANT_TIERS)[number], string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  outline: 'text-foreground',
}

export const badgeVariants = cva(
  [
    'flex-row items-center',
    RADIUS_CLASS[BADGE_RADIUS_TIER],
    PADDING_X_CLASS[BADGE_PADDING_X_PX],
    PADDING_Y_CLASS[BADGE_PADDING_Y_PX],
  ].join(' '),
  {
    variants: { variant: VARIANT_CLASS },
    defaultVariants: { variant: BADGE_DEFAULT_VARIANT },
  },
)

export interface BadgeProps
  extends
    ComponentProps<typeof View>,
    BadgeBaseProps,
    Omit<VariantProps<typeof badgeVariants>, 'variant'> {
  label?: string
}

export function Badge({ variant, label, className, ...props }: BadgeProps) {
  const v = variant ?? BADGE_DEFAULT_VARIANT
  return (
    <View
      className={cn(badgeVariants({ variant }), className)}
      accessibilityRole="text"
      accessibilityLabel={label}
      {...props}
    >
      <Text className={cn('font-semibold', TEXT_CLASS[BADGE_TEXT_TIER], badgeTextVariants[v])}>
        {label}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
