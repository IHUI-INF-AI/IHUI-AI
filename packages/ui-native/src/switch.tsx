import type { ComponentProps } from 'react'
import { Switch as RNSwitch } from 'react-native'
import { cn } from '@ihui/design-tokens'

export type SwitchProps = ComponentProps<typeof RNSwitch>

export function Switch({ className, ...props }: SwitchProps) {
  return <RNSwitch className={cn(className)} accessibilityRole="switch" {...props} />
}
