// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { type BadgeBaseProps } from '@ihui/design-tokens'
import {
  BADGE_DEFAULT_VARIANT,
  BADGE_PADDING_X_PX,
  BADGE_PADDING_Y_PX,
  BADGE_RADIUS_TIER,
  BADGE_TEXT_TIER,
  type BADGE_VARIANT_TIERS,
} from '@ihui/shared/ui/badge-spec'

import { cn } from '../lib/utils'

/**
 * 平台专属项(不下沉 badge-spec,两端允许不同形,逐条登记):
 *  - `border` + 各档 `border-transparent`:web base 自带边框通道,RN 只有 outline 档显式给边框;
 *  - 各档 hover 态 `hover:bg-…/80` 与 `transition-colors`:依赖 CSS :hover 通道,RN 无此通道;
 *  - `focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`:web 键盘可达性专属通道,
 *    RN 走 accessibilityRole / accessibilityLabel 另一条通道;
 *  - `inline-flex`:RN 的同义写法是 `flex-row`;
 *  - 类名字面量:必须留在本文件 —— Tailwind 只扫本仓 ui-react 源,spec 文件不在扫描面内,
 *    拼串产不出规则;且必须是标准类,调用方的覆盖类才能经 cn 正常盖住。
 *  ⇒ 取值档一律取自 badge-spec,本文件只做"档 → 本端承载类"的映射。
 *
 * ⚠️ `default` 档**色值两端不同**(web `bg-cta / text-cta-foreground` vs RN `bg-primary /
 * text-primary-foreground`):按规则6 允许不同形,**色值不下沉**,待机主定档;本票下沉的是
 * **四档的档名集合**(BADGE_VARIANT_TIERS)—— 同名档缺档才会静默掉色,那才是真缺口。
 */
const RADIUS_CLASS: Record<typeof BADGE_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 10: 'px-2.5' }
const PADDING_Y_CLASS: Record<number, string> = { 2: 'py-0.5' }
const TEXT_CLASS: Record<typeof BADGE_TEXT_TIER, string> = { xs: 'text-xs' }

/**
 * 档名集合的消费形态:**类型级**键约束(Record<typeof BADGE_VARIANT_TIERS[number], …>)。
 * spec 增档而本端没给类名 ⇒ tsc 直接红 —— 这正是"缺档无告警"这一失效型的唯一挡法。
 */
const VARIANT_CLASS: Record<(typeof BADGE_VARIANT_TIERS)[number], string> = {
  default: 'border-transparent bg-cta text-cta-foreground hover:bg-cta/80',
  secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive:
    'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
  outline: 'text-foreground',
}

const badgeVariants = cva(
  [
    'inline-flex items-center border font-semibold transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    RADIUS_CLASS[BADGE_RADIUS_TIER],
    PADDING_X_CLASS[BADGE_PADDING_X_PX],
    PADDING_Y_CLASS[BADGE_PADDING_Y_PX],
    TEXT_CLASS[BADGE_TEXT_TIER],
  ].join(' '),
  {
    variants: {
      variant: VARIANT_CLASS,
    },
    defaultVariants: {
      variant: BADGE_DEFAULT_VARIANT,
    },
  },
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    BadgeBaseProps,
    Omit<VariantProps<typeof badgeVariants>, 'variant'> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
