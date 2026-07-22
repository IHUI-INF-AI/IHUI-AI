import type { ComponentProps } from 'react'
import { Image, Text, View } from 'react-native'
import { cn } from '@ihui/ui-primitives'

type AvatarSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const textSizeMap: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export interface AvatarProps extends Omit<ComponentProps<typeof View>, 'children'> {
  source?: ComponentProps<typeof Image>['source']
  name?: string
  size?: AvatarSize
  shape?: 'circle' | 'rounded'
}

export function Avatar({ source, name, size = 'md', shape = 'circle', className, ...props }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : ''

  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden bg-muted',
        sizeMap[size],
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
      accessibilityRole="image"
      accessibilityLabel={name ?? '头像'}
      {...props}
    >
      {source ? (
        <Image
          source={source}
          className={cn(shape === 'circle' ? 'rounded-full' : 'rounded-lg', 'h-full w-full')}
        />
      ) : (
        <Text className={cn('font-medium text-muted-foreground', textSizeMap[size])}>{initials}</Text>
      )}
    </View>
  )
}
