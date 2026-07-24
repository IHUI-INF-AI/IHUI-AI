import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

export interface AvatarProps {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'circle' | 'square'
  onClick?: () => void
}

const SIZES: Record<string, string> = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-14 h-14 text-lg',
}

export default function Avatar({
  src,
  name = '',
  size = 'md',
  shape = 'circle',
  onClick,
}: AvatarProps) {
  const sizeClass = SIZES[size]
  const shapeClass = shape === 'circle' ? 'rounded-md' : 'rounded-lg'

  if (src) {
    return (
      <Image
        className={cn(sizeClass, shapeClass, 'bg-muted')}
        src={src}
        mode="aspectFill"
        onClick={onClick}
      />
    )
  }

  return (
    <View
      className={cn('flex items-center justify-center', sizeClass, shapeClass, 'bg-primary/10')}
      onClick={onClick}
    >
      <Text className="text-primary font-medium">{name.charAt(0) || '?'}</Text>
    </View>
  )
}
