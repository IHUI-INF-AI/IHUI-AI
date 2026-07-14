import { View, Text, Image } from '@tarojs/components'

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
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  if (src) {
    return (
      <Image
        className={`${sizeClass} ${shapeClass} bg-gray-100`}
        src={src}
        mode="aspectFill"
        onClick={onClick}
      />
    )
  }

  return (
    <View
      className={`flex items-center justify-center ${sizeClass} ${shapeClass} bg-indigo-50`}
      onClick={onClick}
    >
      <Text className="text-indigo-500 font-medium">{name.charAt(0) || '?'}</Text>
    </View>
  )
}
