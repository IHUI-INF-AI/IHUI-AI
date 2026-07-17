import { View } from '@tarojs/components'

export interface SkeletonCardProps {
  avatar?: boolean
  title?: boolean
  lines?: number
  className?: string
}

export default function SkeletonCard({
  avatar = true,
  title = true,
  lines = 2,
  className = '',
}: SkeletonCardProps) {
  return (
    <View className={`flex py-3 px-3 ${className}`}>
      {avatar && <View className="w-10 h-10 mr-3 rounded-md bg-gray-100 animate-pulse" />}
      <View className="flex-1 space-y-2">
        {title && <View className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />}
        {Array.from({ length: lines }).map((_, i) => (
          <View
            key={i}
            className="h-2.5 rounded bg-gray-100 animate-pulse"
            style={{ width: `${90 - i * 20}%` }}
          />
        ))}
      </View>
    </View>
  )
}
