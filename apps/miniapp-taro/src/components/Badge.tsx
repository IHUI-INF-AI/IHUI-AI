// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentProps } from 'react'
import { View, Text } from '@tarojs/components'
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
 * 徽章组件 —— 与 `packages/ui-native/src/badge.tsx` 逐类对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/badge-spec`**(与 web 壳、RN 壳同源):改 spec 一处,三端同时跟随
 * —— 这就是「自动同步」的落点。本文件只做「档 → 本端承载类」的映射;**类名字面量必须留在这里**
 * (spec 文件不在 Tailwind 的扫描面内,拼串产不出规则;而字面量在壳里,扫描器才抓得到)。
 *
 * 四档的档名集合由 spec 钉住(`BADGE_VARIANT_TIERS`),本端按同样的四档给类名:
 * default / secondary / destructive / outline。缺档会被类型层挡住(spec 增档而本端没给类名 ⇒ tsc 直接红)。
 *
 * 平台承载差异(规则6,逐条登记):RN 端用 cva 生成类,小程序端无 cva,故以本地 Record 镜像同一组类
 * (与 Button 的 `md` 档处理同策略:共享类型与取值档复用、类常量本地化)。
 * `variant` 类型直接复用 `@ihui/design-tokens` 的 `BadgeBaseProps`(两端一致),不在此另起枚举。
 */
const RADIUS_CLASS: Record<typeof BADGE_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 10: 'px-2.5' }
const PADDING_Y_CLASS: Record<number, string> = { 2: 'py-0.5' }
const TEXT_CLASS: Record<typeof BADGE_TEXT_TIER, string> = { xs: 'text-xs' }

const BADGE_BASE = [
  'flex flex-row items-center',
  RADIUS_CLASS[BADGE_RADIUS_TIER],
  PADDING_X_CLASS[BADGE_PADDING_X_PX],
  PADDING_Y_CLASS[BADGE_PADDING_Y_PX],
].join(' ')

const BADGE_VARIANT_CLASSES: Record<(typeof BADGE_VARIANT_TIERS)[number], string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  destructive: 'bg-destructive',
  outline: 'border border-border bg-transparent',
}
const BADGE_TEXT_VARIANT_CLASSES: Record<(typeof BADGE_VARIANT_TIERS)[number], string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  outline: 'text-foreground',
}

export type BadgeProps = ComponentProps<typeof View> & BadgeBaseProps & { label?: string }

export function Badge({ variant, label, className, children, ...props }: BadgeProps) {
  const v = variant ?? BADGE_DEFAULT_VARIANT
  return (
    <View className={cn(BADGE_BASE, BADGE_VARIANT_CLASSES[v], className)} {...props}>
      <Text
        className={cn(TEXT_CLASS[BADGE_TEXT_TIER], 'font-semibold', BADGE_TEXT_VARIANT_CLASSES[v])}
      >
        {label ?? children}
      </Text>
    </View>
  )
}

export default Badge
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
