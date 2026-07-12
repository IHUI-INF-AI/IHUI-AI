import { View, Text } from '@tarojs/components'

export interface LoadingProps {
  fullScreen?: boolean
  text?: string
  mask?: boolean
}

export default function Loading({
  fullScreen = false,
  text = '加载中...',
  mask = true,
}: LoadingProps) {
  const spinner = (
    <View className="flex flex-col items-center justify-center">
      <View className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      {text ? <Text className="mt-2 text-sm text-gray-500">{text}</Text> : null}
    </View>
  )

  if (fullScreen) {
    return (
      <View
        className={`fixed inset-0 z-[100] flex items-center justify-center ${
          mask ? 'bg-black/40' : ''
        }`}
      >
        <View className="flex flex-col items-center justify-center px-6 py-5 bg-white rounded-xl shadow-sm">
          {spinner}
        </View>
      </View>
    )
  }

  return <View className="flex items-center justify-center py-8">{spinner}</View>
}

export interface SkeletonProps {
  rows?: number
  avatar?: boolean
  className?: string
}

export function Skeleton({ rows = 3, avatar = false, className = '' }: SkeletonProps) {
  return (
    <View className={`px-4 py-3 ${className}`}>
      <View className="flex items-start">
        {avatar && <View className="w-10 h-10 mr-3 rounded-full bg-gray-100 animate-pulse" />}
        <View className="flex-1 space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <View
              key={i}
              className="h-3 rounded bg-gray-100 animate-pulse"
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </View>
      </View>
    </View>
  )
}
