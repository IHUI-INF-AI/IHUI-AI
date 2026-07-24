import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@ihui/design-tokens'

export const buttonVariants = cva('flex flex-row items-center justify-center rounded-md', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      outline: 'border border-input bg-transparent text-foreground',
      ghost: 'bg-transparent text-foreground',
    },
    size: {
      sm: 'h-8 px-3',
      md: 'h-10 px-4',
      lg: 'h-12 px-6',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export interface ButtonProps
  extends ComponentProps<typeof Pressable>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  children?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50', className)}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text className="text-sm font-medium leading-none">{children}</Text>
      )}
    </Pressable>
  )
}
