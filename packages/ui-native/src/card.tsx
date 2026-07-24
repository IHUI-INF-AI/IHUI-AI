import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cn } from '@ihui/design-tokens'

export type CardProps = ComponentProps<typeof View>
export type CardTitleProps = ComponentProps<typeof Text>

export function Card({ className, ...props }: CardProps) {
  return (
    <View className={cn('rounded-lg border border-border bg-card p-4', className)} {...props} />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return <View className={cn('mb-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return <Text className={cn('text-base font-semibold text-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <View className={cn(className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return <View className={cn('mt-2', className)} {...props} />
}
