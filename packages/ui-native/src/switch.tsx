// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { ComponentProps } from 'react'
import { Switch as RNSwitch } from 'react-native'
import { cn } from '@ihui/design-tokens'

export type SwitchProps = ComponentProps<typeof RNSwitch>

export function Switch({ className, ...props }: SwitchProps) {
  return <RNSwitch className={cn(className)} accessibilityRole="switch" {...props} />
}
