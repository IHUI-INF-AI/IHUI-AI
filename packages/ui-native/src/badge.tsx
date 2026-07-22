import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@ihui/ui-primitives'

export const badgeVariants = cva('flex-row items-center px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      destructive: 'bg-destructive',
      outline: 'border border-border bg-transparent',
    },
  },
  defaultVariants: { variant: 'default' },
})

const badgeTextVariants: Record<string, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  outline: 'text-foreground',
}

export interface BadgeProps extends ComponentProps<typeof View>, VariantProps<typeof badgeVariants> {
  label?: string
}

export function Badge({ variant, label, className, ...props }: BadgeProps) {
  const v = variant ?? 'default'
  return (
    <View className={cn(badgeVariants({ variant }), 'rounded-md', className)} {...props}>
      <Text className={cn('text-xs font-semibold', badgeTextVariants[v])}>{label}</Text>
    </View>
  )
}
